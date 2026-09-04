// The question bank is generated from AZ-104_dump.pdf and is deliberately not committed
// (see .gitignore). Without it the app builds fine and then 404s at runtime, which is a
// confusing way to find out, so fail here with instructions instead.
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve(import.meta.dirname, '..', 'public');
const BANK = path.join(PUBLIC, 'data', 'questions.json');
const IMAGES = path.join(PUBLIC, 'img');

const problems = [];

if (!fs.existsSync(BANK)) {
  problems.push('web/public/data/questions.json is missing');
} else {
  try {
    const questions = JSON.parse(fs.readFileSync(BANK, 'utf8'));
    if (!Array.isArray(questions) || questions.length === 0) {
      problems.push('web/public/data/questions.json contains no questions');
    }
  } catch (err) {
    problems.push(`web/public/data/questions.json is not valid JSON (${err.message})`);
  }
}

if (!fs.existsSync(IMAGES) || fs.readdirSync(IMAGES).length === 0) {
  problems.push('web/public/img/ is missing or empty (exhibit and answer-key screenshots)');
}

if (problems.length) {
  console.error(`\nCannot build: the generated question bank is not present.\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
These files are extracted from AZ-104_dump.pdf and are not tracked in git.
To generate them:

  1. place your copy of AZ-104_dump.pdf at the repository root
  2. install poppler so that 'pdftotext' is on the PATH
  3. npm install --prefix tools
  4. npm run data        (about 3 minutes)
`);
  process.exit(1);
}
