// Validates a translation file against the question bank and the interactive overlay.
//   node tools/check-translations.mjs [fr]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'web', 'public', 'data');
const lang = process.argv[2] || 'fr';

const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const interactive = JSON.parse(fs.readFileSync(path.join(DATA, 'interactive.json'), 'utf8'));
const tr = JSON.parse(fs.readFileSync(path.join(DATA, `${lang}.json`), 'utf8'));
const byId = new Map(questions.map((q) => [String(q.id), q]));

const problems = [];
let full = 0, partial = 0;

for (const [id, entry] of Object.entries(tr)) {
  if (id.startsWith('_')) continue;
  const q = byId.get(id);
  if (!q) { problems.push(`Q${id}: not in the question bank`); continue; }

  if (entry.text?.length) {
    full++;
    // A mismatched paragraph count means the stem was re-flowed, not translated.
    if (entry.text.length !== q.text.length) {
      problems.push(`Q${id}: ${entry.text.length} paragraphs translated, source has ${q.text.length}`);
    }
  } else {
    partial++;
  }

  for (const key of Object.keys(entry.options ?? {})) {
    if (!q.options.some((o) => o.key === key)) problems.push(`Q${id}: option "${key}" does not exist`);
  }

  const spec = interactive[id];
  const ix = entry.interactive;
  if (ix && !spec) problems.push(`Q${id}: interactive translation but no interactive spec`);
  if (ix && spec) {
    const ids = new Set(
      spec.kind === 'yesno' ? spec.statements.map((s) => s.id)
      : spec.kind === 'dropdown' ? spec.fields.map((f) => f.id)
      : [...spec.items.map((i) => i.id), ...spec.targets.map((t) => t.id)],
    );
    for (const k of Object.keys({ ...ix.statements, ...ix.items, ...ix.targets, ...ix.fields })) {
      if (!ids.has(k)) problems.push(`Q${id}: interactive id "${k}" does not exist in the spec`);
    }
    if (spec.kind === 'yesno' && ix.statements) {
      const missing = spec.statements.filter((s) => !ix.statements[s.id]).map((s) => s.id);
      if (missing.length) problems.push(`Q${id}: statements not translated: ${missing.join(', ')}`);
    }
    if (spec.kind === 'dropdown' && ix.fields) {
      for (const f of spec.fields) {
        // A translated choice list must stay aligned with the spec, because the answer is
        // an index into it.
        const opts = ix.fields[f.id]?.options;
        if (opts && opts.length !== f.options.length) {
          problems.push(`Q${id}/${f.id}: ${opts.length} options translated, spec has ${f.options.length}`);
        }
      }
    }
  }
}

console.log(`${lang}.json: ${full} fully translated, ${partial} partial, ${questions.length} in the bank`);
if (problems.length) {
  console.log(`\n${problems.length} problems:\n  ` + problems.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('No problems.');
}
