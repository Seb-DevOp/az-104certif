// Merges the hand-written translation batches in tools/fr/ into
// web/public/data/fr.json.
//
//   node tools/merge-translations.mjs [fr]
//
// Translating 542 questions is done in batches, one file per batch, so that a batch is a
// small self-contained diff rather than a rewrite of a growing 500 KB file. Later batches
// win over earlier ones for the same question id, and per-question keys are merged rather
// than replaced — a batch that only carries `interactive.statements` does not wipe a `text`
// written by an earlier one.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const lang = process.argv[2] || 'fr';
const BATCH_DIR = path.join(ROOT, 'tools', lang);
const OUT = path.join(ROOT, 'web', 'public', 'data', `${lang}.json`);

if (!fs.existsSync(BATCH_DIR)) {
  console.error(`No batch directory at tools/${lang}/`);
  process.exit(1);
}

const files = fs.readdirSync(BATCH_DIR).filter((f) => f.endsWith('.json')).sort();
const merged = {};
const seen = new Map();
const problems = [];

for (const file of files) {
  const batch = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, file), 'utf8'));
  for (const [id, entry] of Object.entries(batch)) {
    if (id.startsWith('_')) continue;
    const prev = merged[id] ?? {};
    // Batches are expected to complete each other — one adds `interactive` labels, a later
    // one adds the stem. Only flag a genuine conflict, where both set the same key.
    const clash = Object.keys(entry).filter((k) => k !== 'interactive' && k in prev);
    if (clash.length && seen.get(id) !== file) {
      problems.push(`Q${id}: ${clash.join(', ')} set in both ${seen.get(id)} and ${file}`);
    }
    seen.set(id, file);
    merged[id] = {
      ...prev,
      ...entry,
      interactive: entry.interactive || prev.interactive
        ? { ...prev.interactive, ...entry.interactive }
        : undefined,
    };
    if (!merged[id].interactive) delete merged[id].interactive;
  }
}

// Stable, numeric key order keeps the diff readable as batches land out of order.
const ordered = {};
for (const id of Object.keys(merged).sort((a, b) => Number(a) - Number(b))) ordered[id] = merged[id];

fs.writeFileSync(OUT, JSON.stringify(ordered, null, 1) + '\n');

const full = Object.values(ordered).filter((e) => e.text?.length).length;
console.log(`${files.length} batches -> ${Object.keys(ordered).length} questions (${full} with a translated stem)`);
if (problems.length) {
  console.log(`\n${problems.length} problems:\n  ` + problems.join('\n  '));
  process.exitCode = 1;
}
