import type { AnswerRecord, Lang, Progress, SessionState } from '../types';

const KEY = {
  progress: 'az104.progress.v1',
  session: 'az104.session.v1',
  lang: 'az104.lang',
  theme: 'az104.theme',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeRaw(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing, quota, blocked storage — the app still works, just forgetfully */
  }
}

export const emptyProgress = (): Progress => ({ stats: {}, bookmarks: [], history: [] });

export const loadProgress = (): Progress => read<Progress>(KEY.progress, emptyProgress());
export const saveProgress = (p: Progress) => write(KEY.progress, p);

export function recordAnswer(p: Progress, a: AnswerRecord): Progress {
  const prev = p.stats[a.questionId] ?? { seen: 0, correct: 0, wrong: 0, lastAt: 0, lastCorrect: false };
  return {
    ...p,
    stats: {
      ...p.stats,
      [a.questionId]: {
        seen: prev.seen + 1,
        correct: prev.correct + (a.correct ? 1 : 0),
        wrong: prev.wrong + (a.correct ? 0 : 1),
        lastAt: a.at,
        lastCorrect: a.correct,
      },
    },
  };
}

export function toggleBookmark(p: Progress, id: number): Progress {
  const has = p.bookmarks.includes(id);
  return { ...p, bookmarks: has ? p.bookmarks.filter((x) => x !== id) : [...p.bookmarks, id] };
}

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(KEY.session);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionState;
    return s && Array.isArray(s.questionIds) && s.questionIds.length ? s : null;
  } catch {
    return null;
  }
}

export const saveSession = (s: SessionState | null) => {
  if (s) write(KEY.session, s);
  else {
    try {
      localStorage.removeItem(KEY.session);
    } catch {
      /* ignore */
    }
  }
};

export function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY.lang);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
}
export const saveLang = (l: Lang) => writeRaw(KEY.lang, l);

export type Theme = 'light' | 'dark';

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY.theme);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
export const saveTheme = (t: Theme) => writeRaw(KEY.theme, t);
