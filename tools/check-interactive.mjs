// Validates web/public/data/interactive.json against the question bank.
// Worth running after tools/transcribe-hotspots.mjs, which writes specs a model produced.
//   node tools/check-interactive.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'web', 'public', 'data');

const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const specs = JSON.parse(fs.readFileSync(path.join(DATA, 'interactive.json'), 'utf8'));
const byId = new Map(questions.map((q) => [String(q.id), q]));

const problems = [];
const counts = {};

for (const [id, spec] of Object.entries(specs)) {
  if (id.startsWith('_')) continue;
  const q = byId.get(id);
  if (!q) { problems.push(`Q${id}: not in the question bank`); continue; }
  counts[spec.kind] = (counts[spec.kind] || 0) + 1;

  const seen = new Set();
  const uniqueId = (elemId, what) => {
    if (typeof elemId !== 'string' || !elemId) problems.push(`Q${id}: ${what} has no id`);
    else if (seen.has(elemId)) problems.push(`Q${id}: duplicate id "${elemId}"`);
    seen.add(elemId);
  };

  if (spec.kind === 'yesno') {
    if (!spec.statements?.length) problems.push(`Q${id}: no statements`);
    for (const s of spec.statements ?? []) {
      uniqueId(s.id, 'statement');
      if (!s.text?.trim()) problems.push(`Q${id}/${s.id}: empty text`);
      if (typeof s.answer !== 'boolean') problems.push(`Q${id}/${s.id}: answer is not a boolean`);
    }
  } else if (spec.kind === 'dropdown') {
    if (!spec.fields?.length) problems.push(`Q${id}: no fields`);
    for (const f of spec.fields ?? []) {
      uniqueId(f.id, 'field');
      if (!f.label?.trim()) problems.push(`Q${id}/${f.id}: empty label`);
      if (!Array.isArray(f.options) || f.options.length < 2) {
        problems.push(`Q${id}/${f.id}: needs at least two options`);
      } else if (new Set(f.options).size !== f.options.length) {
        problems.push(`Q${id}/${f.id}: duplicate options`);
      }
      if (!Number.isInteger(f.answer) || f.answer < 0 || f.answer >= (f.options?.length ?? 0)) {
        problems.push(`Q${id}/${f.id}: answer index out of range`);
      }
    }
  } else if (spec.kind === 'dragdrop') {
    if (!spec.items?.length) problems.push(`Q${id}: no items`);
    if (!spec.targets?.length) problems.push(`Q${id}: no targets`);
    const itemIds = new Set((spec.items ?? []).map((i) => i.id));
    for (const i of spec.items ?? []) uniqueId(i.id, 'item');
    for (const tgt of spec.targets ?? []) {
      uniqueId(tgt.id, 'target');
      for (const a of tgt.accepts ?? []) {
        if (!itemIds.has(a)) problems.push(`Q${id}/${tgt.id}: accepts unknown item "${a}"`);
      }
      if (!tgt.accepts?.length) problems.push(`Q${id}/${tgt.id}: accepts nothing`);
    }
    // Every item accepted somewhere would make the pool answer itself; distractors are fine,
    // but a target accepting an item no other target can hold is the usual authoring slip.
    const accepted = new Set((spec.targets ?? []).flatMap((tgt) => tgt.accepts ?? []));
    if (accepted.size === itemIds.size && itemIds.size > accepted.size) {
      problems.push(`Q${id}: every item is accepted, so the question cannot be got wrong`);
    }
  } else {
    problems.push(`Q${id}: unknown kind "${spec.kind}"`);
  }
}

const hotspots = questions.filter((q) => q.format === 'hotspot').length;
const covered = Object.keys(specs).filter((k) => !k.startsWith('_')).length;
console.log(`interactive.json: ${covered} questions`);
console.log('  by kind:', counts);
console.log(`  hot-area questions still shown as a screenshot: ${hotspots - (counts.yesno ?? 0) - (counts.dropdown ?? 0)}`);
if (problems.length) {
  console.log(`\n${problems.length} problems:\n  ` + problems.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('No problems.');
}
