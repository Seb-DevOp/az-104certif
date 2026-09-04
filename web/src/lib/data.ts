import type { InteractiveSpec, Lang, Question, Translation, TranslationMap } from '../types';

const BASE = import.meta.env.BASE_URL || '/';

export interface Bank {
  questions: Question[];
  byId: Map<number, Question>;
}

// 'no-cache' revalidates rather than refetching: the server answers 304 when the file is
// unchanged. 'force-cache' would pin whatever the browser saw on a previous deploy.
async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}data/${path}`, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function loadBank(): Promise<Bank> {
  const res = await fetch(`${BASE}data/questions.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`questions.json: HTTP ${res.status}`);
  const questions = (await res.json()) as Question[];

  // Questions promoted to a playable drag-and-drop live in a separate overlay file so the
  // generated bank can be regenerated from the PDF without losing hand-authored work.
  const interactive = await getJSON<Record<string, InteractiveSpec>>('interactive.json', {});
  for (const q of questions) {
    const spec = interactive[String(q.id)];
    if (spec) q.interactive = spec;
  }

  return { questions, byId: new Map(questions.map((q) => [q.id, q])) };
}

const translationCache = new Map<Lang, TranslationMap>();

export async function loadTranslations(lang: Lang): Promise<TranslationMap> {
  if (lang === 'en') return {};
  const cached = translationCache.get(lang);
  if (cached) return cached;
  const map = await getJSON<TranslationMap>(`${lang}.json`, {});
  translationCache.set(lang, map);
  return map;
}

export interface LocalisedQuestion {
  text: string[];
  options: { key: string; text: string }[];
  explanation: string;
  interactive?: InteractiveSpec;
  /** False when the French layer has no entry and English is being shown instead. */
  translated: boolean;
}

/** Applies the French label overrides for whichever interactive shape this question uses. */
function localiseSpec(
  spec: InteractiveSpec | undefined,
  tr: NonNullable<Translation['interactive']> | undefined,
): InteractiveSpec | undefined {
  if (!spec || !tr) return spec;
  const prompt = tr.prompt ?? spec.prompt;
  if (spec.kind === 'yesno') {
    return {
      ...spec,
      prompt,
      statements: spec.statements.map((s) => ({ ...s, text: tr.statements?.[s.id] ?? s.text })),
    };
  }
  return {
    ...spec,
    prompt,
    items: spec.items.map((i) => ({ ...i, label: tr.items?.[i.id] ?? i.label })),
    targets: spec.targets.map((t) => ({ ...t, label: tr.targets?.[t.id] ?? t.label })),
  };
}

export function localise(q: Question, lang: Lang, tr: TranslationMap): LocalisedQuestion {
  const entry = lang === 'en' ? undefined : tr[String(q.id)];
  if (!entry) {
    return {
      text: q.text,
      options: q.options,
      explanation: q.explanation,
      interactive: q.interactive,
      translated: lang === 'en',
    };
  }
  return {
    text: entry.text?.length ? entry.text : q.text,
    options: q.options.map((o) => ({ key: o.key, text: entry.options?.[o.key] ?? o.text })),
    explanation: entry.explanation || q.explanation,
    interactive: localiseSpec(q.interactive, entry.interactive),
    // An entry may translate only part of a question — the statements of a Yes/No grid, say,
    // while the scenario is still English. The badge tracks the stem, which is what the
    // learner reads first.
    translated: Boolean(entry.text?.length),
  };
}

export const imageUrl = (file: string) => `${BASE}img/${file}`;
