// Translates the question bank into French with Claude.
//
//   ANTHROPIC_API_KEY=... npm run translate -- [--lang fr] [--limit 50] [--model claude-opus-5]
//
// Output goes to web/public/data/<lang>.json, keyed by question id. The file is rewritten
// after every batch, so the run is resumable: questions already present are skipped and an
// interrupted run simply picks up where it stopped. Questions the app cannot find a
// translation for fall back to the original English and are badged "EN" in the UI, so a
// partial file is a perfectly valid state to ship.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'web', 'public', 'data');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const LANG = arg('lang', 'fr');
const MODEL = arg('model', 'claude-opus-5');
const LIMIT = Number(arg('limit', '0')) || Infinity;
const BATCH_SIZE = Number(arg('batch', '6'));
const CONCURRENCY = Number(arg('concurrency', '3'));

const LANGUAGE_NAME = { fr: 'French (France)' }[LANG] || LANG;

const SYSTEM = `You translate Microsoft Azure AZ-104 certification exam questions from English into ${LANGUAGE_NAME}.

Rules, in priority order:
1. Never change the meaning. These are exam questions; a mistranslation teaches the wrong answer.
2. Keep every Azure product name, service name, RBAC role name, portal blade name, PowerShell/CLI cmdlet, resource name, identifier and code fragment in English, exactly as written. Examples that must NOT be translated: "Azure Active Directory", "Storage Account Contributor", "New-AzureADMSInvitation", "Log Analytics workspace", "VM1", "RG1", "contoso.com".
3. Translate the surrounding prose naturally into ${LANGUAGE_NAME} — do not translate word for word, write the way a French Azure administrator would.
4. Preserve the paragraph structure: the "text" array must have exactly the same number of entries as the input, in the same order.
5. Preserve the option keys (A, B, C…) exactly.
6. Keep URLs untouched.
7. Use "vous" for the reader. Use standard IT French ("machine virtuelle", "abonnement", "groupe de ressources", "compte de stockage", "réseau virtuel", "règle d'alerte").

Reply with a single JSON object and nothing else — no prose, no markdown fence. Shape:
{"<question id>": {"text": ["..."], "options": {"A": "...", "B": "..."}, "explanation": "...", "interactive": {"prompt": "...", "items": {"<id>": "..."}, "targets": {"<id>": "..."}, "statements": {"<id>": "..."}}}}
Omit "options" when the question has none, "explanation" when it is empty, and "interactive" when it is absent from the input. Inside "interactive", reply only with the sub-keys present in the input.`;

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error(`No Anthropic credentials found.

Set one of:
  export ANTHROPIC_API_KEY=sk-ant-...       (console.anthropic.com)
  export ANTHROPIC_AUTH_TOKEN=...

Without them the existing web/public/data/${LANG}.json is left untouched; untranslated
questions simply show in English with an "EN" badge.`);
  process.exit(1);
}

const client = new Anthropic();

const questions = JSON.parse(fs.readFileSync(path.join(DATA, 'questions.json'), 'utf8'));
const interactivePath = path.join(DATA, 'interactive.json');
const interactive = fs.existsSync(interactivePath)
  ? JSON.parse(fs.readFileSync(interactivePath, 'utf8'))
  : {};

const outPath = path.join(DATA, `${LANG}.json`);
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

const todo = questions.filter((q) => !out[String(q.id)]).slice(0, LIMIT);
console.log(`${questions.length} questions, ${Object.keys(out).length} already translated, ${todo.length} to do.`);
if (!todo.length) process.exit(0);

/** Strips everything the model can be tempted to wrap JSON in. */
function parseJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`no JSON object in reply: ${raw.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
}

function payload(q) {
  const item = { id: q.id, text: q.text };
  if (q.options.length) item.options = Object.fromEntries(q.options.map((o) => [o.key, o.text]));
  if (q.explanation) item.explanation = q.explanation;
  const spec = interactive[String(q.id)];
  if (spec) {
    item.interactive = spec.kind === 'yesno'
      ? {
          prompt: spec.prompt,
          statements: Object.fromEntries(spec.statements.map((s) => [s.id, s.text])),
        }
      : {
          prompt: spec.prompt,
          items: Object.fromEntries(spec.items.map((i) => [i.id, i.label])),
          targets: Object.fromEntries(spec.targets.map((t) => [t.id, t.label])),
        };
    if (!item.interactive.prompt) delete item.interactive.prompt;
  }
  return item;
}

async function translateBatch(batch, attempt = 1) {
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: JSON.stringify(batch.map(payload), null, 1) }],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new Error('refused');
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { parsed: parseJSON(text), usage: message.usage };
  } catch (err) {
    const retryable =
      err instanceof Anthropic.RateLimitError ||
      err instanceof Anthropic.APIConnectionError ||
      (err instanceof Anthropic.APIError && err.status >= 500) ||
      err instanceof SyntaxError ||
      /no JSON object/.test(String(err.message));
    if (!retryable || attempt >= 4) throw err;
    const wait = 2 ** attempt * 1500;
    console.warn(`  batch ${batch[0].id}-${batch.at(-1).id}: ${err.message} — retry ${attempt} in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    return translateBatch(batch, attempt + 1);
  }
}

const batches = [];
for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));

let done = 0, inTokens = 0, outTokens = 0;
const save = () => fs.writeFileSync(outPath, JSON.stringify(out, null, 1));

// A small worker pool: several batches in flight, one shared cursor.
let cursor = 0;
async function worker() {
  for (;;) {
    const batch = batches[cursor++];
    if (!batch) return;
    try {
      const { parsed, usage } = await translateBatch(batch);
      inTokens += usage.input_tokens ?? 0;
      outTokens += usage.output_tokens ?? 0;
      for (const q of batch) {
        const entry = parsed[String(q.id)];
        if (!entry?.text?.length) {
          console.warn(`  Q${q.id}: missing from reply, left untranslated`);
          continue;
        }
        out[String(q.id)] = entry;
      }
      save();
      done += batch.length;
      process.stdout.write(`  ${done}/${todo.length} (Q${batch[0].id}-${batch.at(-1).id})\n`);
    } catch (err) {
      console.error(`  batch ${batch[0].id}-${batch.at(-1).id} failed: ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
save();
console.log(`Done. ${Object.keys(out).length}/${questions.length} translated → ${path.relative(ROOT, outPath)}`);
console.log(`Tokens: ${inTokens} in, ${outTokens} out.`);
