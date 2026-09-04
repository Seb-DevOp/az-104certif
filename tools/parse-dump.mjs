// Parses the pdftotext output of AZ-104_dump.pdf into structured questions.
// Run via `npm run data` from the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const TXT = path.join(ROOT, 'tools', '.dump.txt');
if (!fs.existsSync(TXT)) {
  execFileSync('pdftotext', ['-layout', path.join(ROOT, 'AZ-104_dump.pdf'), TXT], { stdio: 'inherit' });
}

const TOPICS = [
  [/Mixed Questions/i, 'mixed'],
  [/Manage Azure identities and governance/i, 'identity'],
  [/Implement and manage storage/i, 'storage'],
  [/Deploy and manage Azure compute/i, 'compute'],
  [/Implement and manage virtual networking/i, 'networking'],
  [/Monitor and maintain Azure resources/i, 'monitor'],
];

const raw = fs.readFileSync(TXT, 'utf8');

// Flatten pages into a line list that remembers which PDF page each line came from.
const lines = [];
raw.split('\f').forEach((pageText, i) => {
  const page = i + 1;
  for (const l of pageText.split(/\r?\n/)) lines.push({ text: l, page });
});

const FOOTER = /^\s*https:\/\/virtulearner\.com\s+\d+\s*$/;
const HEADER = /^\s*AZ-104\s*$/;
const TOPIC_LINE = /^\s*Exam Topic:\s*(.+?)\s+Question Set\s+\d+\s*$/;
const Q_START = /^\s*QUESTION:\s*(\d+)\s*$/;

// Pass 1: drop page furniture, track the active topic, record question start offsets.
let topic = 'mixed';
const clean = [];
const starts = [];
for (const { text, page } of lines) {
  if (FOOTER.test(text) || HEADER.test(text)) continue;
  const t = text.match(TOPIC_LINE);
  if (t) {
    const hit = TOPICS.find(([re]) => re.test(t[1]));
    topic = hit ? hit[1] : 'mixed';
    continue;
  }
  const q = text.match(Q_START);
  if (q) starts.push({ index: clean.length, id: Number(q[1]), topic });
  clean.push({ text: text.trim(), page });
}

/**
 * The dump's bullet glyphs come out of pdftotext as U+FFFD. They always introduce a list
 * item inside a run-on paragraph, so a real bullet reads better than a dropped character.
 */
const tidy = (s) => s.replace(/�/g, '•').replace(/\s{2,}/g, ' ').trim();

/** Re-flows pdftotext's hard-wrapped lines back into paragraphs. */
function paragraphs(slice) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) out.push(buf); buf = ''; };
  for (const l of slice) {
    const t = l.text;
    if (!t) { flush(); continue; }
    if (/^(Note|NOTE|Hot Area|Select and Place|Answer Area|Solution|Reference)\s*:/.test(t)) flush();
    buf = buf ? buf + ' ' + t : t;
  }
  flush();
  return out.map(tidy).filter(Boolean);
}

function joinUrls(slice) {
  const urls = [];
  for (const l of slice) {
    const t = l.text;
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) urls.push(t);
    else if (urls.length) urls[urls.length - 1] += t;
  }
  return [...new Set(urls.map((u) => u.replace(/[\s�]+/g, '').replace(/[.,;]+$/, '')))];
}

// Images are attributed by where they physically sit in the PDF: everything between the
// "QUESTION: n" marker and that question's "Answer(s):" line is an exhibit, everything
// between "Answer(s):" and the next "QUESTION:" marker is the worked answer. This matters
// because a question, its answer key and the next question routinely share one page.
const { pages: imagePages, marks: pageMarks } = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'images.json'), 'utf8'),
);

const PAGE_SPAN = 10000; // any y on a page is far below this, so page*SPAN+y sorts documents
const flatMarks = [];
for (const [page, marks] of Object.entries(pageMarks)) {
  for (const m of marks) flatMarks.push({ ...m, page: Number(page), pos: Number(page) * PAGE_SPAN + m.y });
}
flatMarks.sort((a, b) => a.pos - b.pos);

const flatImages = [];
for (const [page, entries] of Object.entries(imagePages)) {
  for (const e of entries) {
    flatImages.push({ file: e.file, pos: Number(page) * PAGE_SPAN + (e.top + e.bottom) / 2 });
  }
}
flatImages.sort((a, b) => a.pos - b.pos);

/** Splits a question's images into exhibits and answer-key screenshots. */
function imagesFor(id) {
  const i = flatMarks.findIndex((m) => m.kind === 'question' && m.id === id);
  if (i < 0) return { images: [], answerImages: [] };
  let end = Infinity;
  for (let j = i + 1; j < flatMarks.length; j++) {
    if (flatMarks[j].kind === 'question') { end = flatMarks[j].pos; break; }
  }
  const answerMark = flatMarks.slice(i + 1).find((m) => m.pos < end && m.kind === 'answer');
  const cut = answerMark ? answerMark.pos : end;
  const own = flatImages.filter((im) => im.pos > flatMarks[i].pos && im.pos < end);
  return {
    images: own.filter((im) => im.pos < cut).map((im) => im.file),
    answerImages: own.filter((im) => im.pos >= cut).map((im) => im.file),
  };
}

const questions = [];
const problems = [];

for (let s = 0; s < starts.length; s++) {
  const from = starts[s].index;
  const to = s + 1 < starts.length ? starts[s + 1].index : clean.length;
  const block = clean.slice(from + 1, to);

  const iAnswer = block.findIndex((l) => /^Answer\(s\):/.test(l.text));
  if (iAnswer < 0) { problems.push(`Q${starts[s].id}: no Answer(s) line`); continue; }
  const answer = block[iAnswer].text.replace(/^Answer\(s\):\s*/, '').split(/[,\s]+/).filter(Boolean);

  // The option list is the last contiguous A./B./C... run before the answer line.
  let optStart = -1;
  for (let i = iAnswer - 1; i >= 0; i--) {
    if (!/^A\.\s/.test(block[i].text)) continue;
    const letters = [];
    for (let j = i; j < iAnswer; j++) {
      const m = block[j].text.match(/^([A-F])\.\s/);
      if (m) letters.push(m[1]);
    }
    if (letters.length && letters.every((L, k) => L.charCodeAt(0) - 65 === k)) { optStart = i; break; }
  }
  if (optStart < 0) { problems.push(`Q${starts[s].id}: no option block`); continue; }

  const options = [];
  for (let i = optStart; i < iAnswer; i++) {
    const m = block[i].text.match(/^([A-F])\.\s+(.*)$/);
    if (m) options.push({ key: m[1], text: m[2] });
    else if (options.length && block[i].text) options[options.length - 1].text += ' ' + block[i].text;
  }
  for (const o of options) o.text = tidy(o.text);

  // A leading HOTSPOT / DRAG DROP marker is metadata, not part of the stem.
  let head = 0;
  let format = 'standard';
  const marker = block[0] ? block[0].text : '';
  if (/^HOTSPOT\b/.test(marker)) { format = 'hotspot'; head = 1; }
  else if (/^DRAG DROP\b/.test(marker)) { format = 'dragdrop'; head = 1; }
  else if (/^SIMULATION\b/i.test(marker)) { format = 'simulation'; head = 1; }

  const stem = paragraphs(block.slice(head, optStart))
    .filter((p) => !/^(Hot Area|Select and Place|Answer Area)\s*:?\s*$/i.test(p));

  // Explanation + references follow the answer line.
  const tail = block.slice(iAnswer + 1);
  const iRef = tail.findIndex((l) => /^References?:/.test(l.text));
  const explSlice = (iRef < 0 ? tail : tail.slice(0, iRef))
    .filter((l) => !/^Explanations?:\s*$/.test(l.text));
  const explanation = paragraphs(explSlice).join('\n\n');
  const references = iRef < 0 ? [] : joinUrls(tail.slice(iRef + 1));

  const startPage = block[0] ? block[0].page : clean[from].page;
  const { images: qImages, answerImages: aImages } = imagesFor(starts[s].id);

  const isReveal = options.length === 1 && /See Explanation section/i.test(options[0].text);
  const type = isReveal ? 'reveal' : answer.length > 1 ? 'multi' : 'single';

  questions.push({
    id: starts[s].id,
    topic: starts[s].topic,
    type,
    format,
    text: stem,
    options: isReveal ? [] : options,
    answer: isReveal ? [] : answer,
    explanation,
    references,
    images: qImages,
    answerImages: aImages,
    page: startPage,

  });
}

for (const q of questions) {
  if (!q.text.length && !q.images.length) problems.push(`Q${q.id}: empty stem`);
  if (q.type !== 'reveal') {
    const keys = q.options.map((o) => o.key);
    for (const a of q.answer) if (!keys.includes(a)) problems.push(`Q${q.id}: answer ${a} not in options`);
  } else if (!q.answerImages.length && !q.explanation) {
    problems.push(`Q${q.id}: reveal question with no answer image and no explanation`);
  }
}

fs.writeFileSync(path.join(ROOT, 'web', 'public', 'data', 'questions.json'), JSON.stringify(questions, null, 1));

const by = (fn) => questions.reduce((a, q) => { const k = fn(q); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`Parsed ${questions.length} questions`);
console.log('  by topic :', by((q) => q.topic));
console.log('  by type  :', by((q) => q.type));
console.log('  by format:', by((q) => q.format));
console.log(`  with question images: ${questions.filter((q) => q.images.length).length}`);
console.log(`  with answer images  : ${questions.filter((q) => q.answerImages.length).length}`);
console.log(`  without explanation : ${questions.filter((q) => !q.explanation).length}`);
if (problems.length) console.log(`\n${problems.length} problems:\n  ` + problems.slice(0, 40).join('\n  '));
