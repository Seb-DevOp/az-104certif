import type { DragDropSpec, Lang, Question, TranslationMap } from '../types';

const BASE = import.meta.env.BASE_URL || '/';

export interface Bank {
  questions: Question[];
  byId: Map<number, Question>;
}

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}data/${path}`, { cache: 'force-cache' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function loadBank(): Promise<Bank> {
  const res = await fetch(`${BASE}data/questions.json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`questions.json: HTTP ${res.status}`);
  const questions = (await res.json()) as Question[];

  // Questions promoted to a playable drag-and-drop live in a separate overlay file so the
  // generated bank can be regenerated from the PDF without losing hand-authored work.
  const interactive = await getJSON<Record<string, DragDropSpec>>('interactive.json', {});
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
  interactive?: DragDropSpec;
  /** False when the French layer has no entry and English is being shown instead. */
  translated: boolean;
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
  const ix = entry.interactive;
  return {
    text: entry.text?.length ? entry.text : q.text,
    options: q.options.map((o) => ({ key: o.key, text: entry.options?.[o.key] ?? o.text })),
    explanation: entry.explanation || q.explanation,
    interactive:
      q.interactive && ix
        ? {
            ...q.interactive,
            prompt: ix.prompt ?? q.interactive.prompt,
            items: q.interactive.items.map((i) => ({ ...i, label: ix.items?.[i.id] ?? i.label })),
            targets: q.interactive.targets.map((t) => ({ ...t, label: ix.targets?.[t.id] ?? t.label })),
          }
        : q.interactive,
    translated: true,
  };
}

export const imageUrl = (file: string) => `${BASE}img/${file}`;
