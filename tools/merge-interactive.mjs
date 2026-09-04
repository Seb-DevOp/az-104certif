// Expands the terse hand-transcription seeds into web/public/data/interactive.json,
// leaving hand-authored dragdrop entries alone.
//
//   node tools/merge-interactive.mjs
//
// Seed formats, one entry per question id:
//   yesno-seed.json     [["statement text", true|false], ...]        true = Yes is correct
//   dropdown-seed.json  [["label", ["choice", ...], answerIndex], ...]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'web', 'public', 'data', 'interactive.json');
const BANK = path.join(ROOT, 'web', 'public', 'data', 'questions.json');

const target = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
const questions = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(questions.map((q) => [String(q.id), q]));

let added = 0, replaced = 0;
const problems = [];

/** Shared checks, then hand off to the per-kind builder. */
function mergeSeed(file, build) {
  const seedPath = path.join(ROOT, 'tools', file);
  if (!fs.existsSync(seedPath)) return;
  for (const [id, rows] of Object.entries(JSON.parse(fs.readFileSync(seedPath, 'utf8')))) {
    if (id.startsWith('_')) continue;
    const q = byId.get(id);
    if (!q) { problems.push(`${file} Q${id}: not in the question bank`); continue; }
    if (q.format !== 'hotspot') problems.push(`${file} Q${id}: format is "${q.format}", expected hotspot`);
    if (!Array.isArray(rows) || !rows.length) { problems.push(`${file} Q${id}: no rows`); continue; }
    const spec = build(id, rows, file);
    if (!spec) continue;
    if (target[id]) replaced++; else added++;
    target[id] = spec;
  }
}

mergeSeed('yesno-seed.json', (id, rows, file) => ({
  kind: 'yesno',
  statements: rows.map(([text, answer], i) => {
    if (typeof text !== 'string' || typeof answer !== 'boolean') {
      problems.push(`${file} Q${id} row ${i + 1}: expected ["text", true|false]`);
    }
    return { id: `s${i + 1}`, text, answer };
  }),
}));

mergeSeed('dropdown-seed.json', (id, rows, file) => ({
  kind: 'dropdown',
  fields: rows.map(([label, options, answer], i) => {
    if (typeof label !== 'string' || !Array.isArray(options) || options.length < 2) {
      problems.push(`${file} Q${id} row ${i + 1}: expected ["label", ["choice", ...], index]`);
    } else if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      problems.push(`${file} Q${id} row ${i + 1}: answer index ${answer} out of range`);
    }
    return { id: `f${i + 1}`, label, options, answer };
  }),
}));

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
