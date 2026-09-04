// Turns the hot-area screenshots into playable questions, automatically.
//
//   ANTHROPIC_API_KEY=... npm run data:transcribe -- [--limit 20] [--ids 21,26] [--force]
//
// Why this can work at all: for a hot-area question the dump ships two screenshots — the
// blank answer area and the same area with the key highlighted in green. The second one
// therefore carries BOTH the wording of every row/menu AND the correct choice, so a model
// that can see the image can reconstruct the whole question. That is exactly what
// interactive.json holds, and what tools/yesno-seed.json was transcribed by hand.
//
// Output is written to web/public/data/interactive.json, one question at a time, so the run
// is resumable and an interruption loses nothing. Questions that already have an entry are
// skipped unless --force.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'web', 'public', 'data');
const IMG = path.join(ROOT, 'web', 'public', 'img');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const MODEL = arg('model', 'claude-opus-5');
const LIMIT = Number(arg('limit', '0')) || Infinity;
const ONLY = arg('ids', '') ? new Set(arg('ids', '').split(',').map((s) => s.trim())) : null;
const CONCURRENCY = Number(arg('concurrency', '3'));

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error(`No Anthropic credentials found. Set ANTHROPIC_API_KEY (console.anthropic.com).

This step needs a model that can read images: the answers only exist inside the
screenshots. Without it, transcribe by hand into tools/yesno-seed.json instead — see the
README, "Questions interactives".`);
  process.exit(1);
}

const SYSTEM = `You transcribe screenshots of Microsoft AZ-104 exam "hot area" questions into structured JSON.

You are given a question's stem and its screenshots. The LAST screenshot is the answer key: it shows the same answer area as the earlier ones, but with the correct choice highlighted (usually a green fill or a filled radio button). Earlier screenshots may be exhibits (tables, portal captures, code) that provide context but hold no answer.

Reply with a single JSON object and nothing else — no prose, no markdown fence. Choose ONE shape:

Yes/No grid — a table of statements with Yes and No columns:
{"kind":"yesno","statements":[{"id":"s1","text":"<statement, verbatim>","answer":true}]}
"answer" is true when the Yes column is the highlighted one.

Drop-down menus — an answer area of labelled menus, each listing its choices:
{"kind":"dropdown","fields":[{"id":"f1","label":"<label, verbatim>","options":["<choice 1>","<choice 2>"],"answer":0}]}
"answer" is the 0-based index into "options" of the highlighted choice. List every choice shown in the menu, in the order shown.

If the screenshots do not clearly show BOTH the wording and which choice is correct, reply exactly:
{"kind":"unclear","reason":"<one short sentence>"}

Rules:
- Transcribe wording verbatim in English, including product, role and resource names. Do not translate, summarise or fix typos.
- ids are s1, s2, … for statements and f1, f2, … for fields, in the order they appear top to bottom.
- Never guess an answer that is not visibly highlighted. "unclear" is always better than a plausible invention: a wrong key teaches the wrong thing.`;

const client = new Anthropic();
const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const targetPath = path.join(DATA, 'interactive.json');
const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

const todo = questions
  .filter((q) => q.format === 'hotspot' && q.answerImages.length)
  .filter((q) => (ONLY ? ONLY.has(String(q.id)) : true))
  .filter((q) => flag('force') || !target[String(q.id)])
  .slice(0, LIMIT);

console.log(`${todo.length} hot-area questions to transcribe (model ${MODEL}).`);
if (!todo.length) process.exit(0);

const MEDIA = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

function imageBlock(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: MEDIA[ext] || 'image/webp',
      data: fs.readFileSync(path.join(IMG, file)).toString('base64'),
    },
  };
}

function parseJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`no JSON object in reply: ${raw.slice(0, 160)}`);
  return JSON.parse(body.slice(start, end + 1));
}

/** Rejects anything the app could not render or grade. */
function validate(spec) {
  if (spec.kind === 'unclear') return spec.reason || 'model reported unclear';
  if (spec.kind === 'yesno') {
    if (!Array.isArray(spec.statements) || !spec.statements.length) return 'no statements';
    for (const s of spec.statements) {
      if (typeof s.id !== 'string' || typeof s.text !== 'string' || !s.text.trim()) return 'bad statement';
      if (typeof s.answer !== 'boolean') return 'statement answer is not a boolean';
    }
    return null;
  }
  if (spec.kind === 'dropdown') {
    if (!Array.isArray(spec.fields) || !spec.fields.length) return 'no fields';
    for (const f of spec.fields) {
      if (typeof f.id !== 'string' || typeof f.label !== 'string') return 'bad field';
      if (!Array.isArray(f.options) || f.options.length < 2) return 'field needs at least two options';
      if (!Number.isInteger(f.answer) || f.answer < 0 || f.answer >= f.options.length) {
        return 'field answer index out of range';
      }
    }
    return null;
  }
  return `unknown kind "${spec.kind}"`;
}

async function transcribe(q, attempt = 1) {
  // Exhibits first, answer key last — the prompt tells the model to read it that way.
  const images = [...q.images, ...q.answerImages];
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map(imageBlock),
            {
              type: 'text',
              text: `Question ${q.id}. Stem:\n\n${q.text.join('\n\n')}\n\nThe last image is the answer key.`,
            },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('refused');
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { spec: parseJSON(text), usage: message.usage };
  } catch (err) {
    const retryable =
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.APIConnectionError ||
      (err instanceof Anthropic.APIError && err.status >= 500) ||
      err instanceof SyntaxError ||
      /no JSON object/.test(String(err.message));
    if (!retryable || attempt >= 4) throw err;
    const waitMs = 2 ** attempt * 1500;
    console.warn(`  Q${q.id}: ${err.message} — retry ${attempt} in ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    return transcribe(q, attempt + 1);
  }
}

const save = () => fs.writeFileSync(targetPath, JSON.stringify(target, null, 1) + '\n');
const stats = { written: 0, unclear: 0, failed: 0, inTokens: 0, outTokens: 0 };
const unclear = [];

let cursor = 0;
async function worker() {
  for (;;) {
    const q = todo[cursor++];
    if (!q) return;
    try {
      const { spec, usage } = await transcribe(q);
      stats.inTokens += usage.input_tokens ?? 0;
      stats.outTokens += usage.output_tokens ?? 0;
      const problem = validate(spec);
      if (problem) {
        stats.unclear++;
        unclear.push(`Q${q.id}: ${problem}`);
        console.log(`  Q${q.id}: left as a screenshot (${problem})`);
        continue;
      }
      target[String(q.id)] = spec;
      save();
      stats.written++;
      const size = spec.kind === 'yesno' ? spec.statements.length : spec.fields.length;
      console.log(`  Q${q.id}: ${spec.kind}, ${size} rows  [${stats.written}/${todo.length}]`);
    } catch (err) {
      stats.failed++;
      console.error(`  Q${q.id} failed: ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
save();

console.log(`\nTranscribed ${stats.written}, left alone ${stats.unclear}, failed ${stats.failed}.`);
console.log(`Tokens: ${stats.inTokens} in, ${stats.outTokens} out.`);
if (unclear.length) console.log('\nNot transcribed:\n  ' + unclear.join('\n  '));
console.log('\nReview before shipping: a wrong answer key is worse than a screenshot.');
console.log('  npm run check:interactive');
