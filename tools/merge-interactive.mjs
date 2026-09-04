// Expands tools/yesno-seed.json (a terse hand-transcription format) into the yesno entries
// of web/public/data/interactive.json, leaving any hand-authored dragdrop entries alone.
//
//   node tools/merge-interactive.mjs
//
// The seed format is one array per question id: [["statement text", true|false], ...]
// where the boolean is whether Yes is the correct answer.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SEED = path.join(ROOT, 'tools', 'yesno-seed.json');
const TARGET = path.join(ROOT, 'web', 'public', 'data', 'interactive.json');
const BANK = path.join(ROOT, 'web', 'public', 'data', 'questions.json');

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
const target = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
const questions = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(questions.map((q) => [String(q.id), q]));

let added = 0, replaced = 0;
const problems = [];

for (const [id, rows] of Object.entries(seed)) {
  if (id.startsWith('_')) continue;
  const q = byId.get(id);
  if (!q) { problems.push(`Q${id}: not in the question bank`); continue; }
  if (q.format !== 'hotspot') problems.push(`Q${id}: format is "${q.format}", expected hotspot`);
  if (!Array.isArray(rows) || !rows.length) { problems.push(`Q${id}: no statements`); continue; }

  const statements = rows.map(([text, answer], i) => {
    if (typeof text !== 'string' || typeof answer !== 'boolean') {
      problems.push(`Q${id} row ${i + 1}: expected ["text", true|false]`);
    }
    return { id: `s${i + 1}`, text, answer };
  });

  if (target[id]) replaced++; else added++;
  target[id] = { kind: 'yesno', statements };
}

fs.writeFileSync(TARGET, JSON.stringify(target, null, 1) + '\n');

const kinds = Object.entries(target).reduce((a, [k, v]) => {
  if (!k.startsWith('_')) a[v.kind] = (a[v.kind] || 0) + 1;
  return a;
}, {});
console.log(`interactive.json: ${added} added, ${replaced} replaced`);
console.log('  by kind:', kinds);
if (problems.length) {
  console.log(`\n${problems.length} problems:\n  ` + problems.join('\n  '));
  process.exitCode = 1;
}
