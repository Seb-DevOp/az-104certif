import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bank } from './lib/data';
import { loadBank, loadTranslations } from './lib/data';
import { makeT } from './lib/i18n';
import * as store from './lib/storage';
import { newSession, pickQuestions } from './lib/quiz';
import type { Lang, Progress, SessionState, TranslationMap } from './types';
import { Home, type Launch } from './components/Home';
import { Quiz } from './components/Quiz';
import { Results } from './components/Results';
import { Toggle } from './components/ui';

export default function App() {
  const [lang, setLang] = useState<Lang>(store.loadLang);
  const [theme, setTheme] = useState<store.Theme>(store.loadTheme);
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [progress, setProgress] = useState<Progress>(store.loadProgress);
  const [session, setSessionState] = useState<SessionState | null>(store.loadSession);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  /** Set once the learner leaves a finished session's results screen. */
  const [viewingResults, setViewingResults] = useState(() => Boolean(store.loadSession()?.finishedAt));

  const t = makeT(lang);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = lang;
    store.saveTheme(theme);
    store.saveLang(lang);
  }, [theme, lang]);

  const load = useCallback(() => {
    setError(null);
    loadBank().then(setBank).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    loadTranslations(lang).then(setTranslations);
  }, [lang]);

  const setSession = useCallback((s: SessionState | null) => {
    setSessionState(s);
    store.saveSession(s);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    setProgress(next);
    store.saveProgress(next);
  }, []);

  const start = useCallback(
    (launch: Launch) => {
      if (!bank) return;
      const ids = pickQuestions(bank.questions, {
        count: launch.config.count,
        topics: launch.config.topics,
        only: launch.only,
        prioritiseWeak: launch.prioritiseWeak,
        progress,
      });
      if (!ids.length) return;
      setViewingResults(false);
      setSession(newSession(launch.mode, ids, { ...launch.config, count: ids.length }));
    },
    [bank, progress, setSession],
  );

  const onAnswered = useCallback(
    (questionId: number, correct: boolean) => {
      persistProgress(
        store.recordAnswer(progress, { questionId, selected: [], correct, selfGraded: false, at: Date.now() }),
      );
    },
    [progress, persistProgress],
  );

  // The quiz hands over the finished session rather than App reading its own state, which
  // would still hold the pre-submit copy in this tick.
  const finish = useCallback(
    (done: SessionState) => {
      setViewingResults(true);
      setSession(done);
      // Practice mode already recorded each answer as it was checked; exam mode defers all
      // grading to submission, so its statistics and history are written here, once.
      if (done.mode !== 'exam' || session?.finishedAt) return;
      let next = progress;
      for (const [qid, rec] of Object.entries(done.answers)) {
        next = store.recordAnswer(next, { ...rec, questionId: Number(qid) });
      }
      const correct = Object.values(done.answers).filter((a) => a.correct).length;
      persistProgress({
        ...next,
        history: [
          {
            at: done.finishedAt ?? Date.now(),
            score: correct,
            total: done.questionIds.length,
            minutes: done.config.minutes,
          },
          ...next.history,
        ].slice(0, 20),
      });
    },
    [session, progress, persistProgress, setSession],
  );

  const quit = useCallback(() => {
    if (session && !session.finishedAt && Object.keys(session.answers).length && !confirm(t('quitConfirm'))) return;
    setViewingResults(false);
    setSession(null);
  }, [session, setSession, t]);

  const header = useMemo(
    () => (
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-100/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => (session ? quit() : undefined)}
            className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-azure-600 text-xs text-white">AZ</span>
            104
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Toggle
              ariaLabel="Language"
              value={lang}
              onChange={(v) => setLang(v as Lang)}
              options={[
                { value: 'fr', label: 'FR' },
                { value: 'en', label: 'EN' },
              ]}
            />
            <Toggle
              ariaLabel={t('theme')}
              value={theme}
              onChange={(v) => setTheme(v as store.Theme)}
              options={[
                { value: 'light', label: '☀', title: 'Light' },
                { value: 'dark', label: '☾', title: 'Dark' },
              ]}
            />
          </div>
        </div>
      </header>
    ),
    [lang, theme, session, quit, t],
  );

  if (error) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <p className="text-slate-700 dark:text-slate-300">{t('loadError')}</p>
          <p className="mt-1 text-xs text-slate-400">{error}</p>
          <button type="button" className="btn-primary mt-4" onClick={load}>
            {t('retry')}
          </button>
        </div>
      </>
    );
  }

  if (!bank) {
    return (
      <>
        {header}
        <div className="px-4 py-20 text-center text-slate-500 dark:text-slate-400">{t('loading')}</div>
      </>
    );
  }

  return (
    <>
      {header}
      <main>
        {session && session.finishedAt && viewingResults ? (
          <Results
            session={session}
            byId={bank.byId}
            lang={lang}
            translations={translations}
            onHome={() => {
              setViewingResults(false);
              setSession(null);
            }}
            onRetryWrong={(ids) =>
              start({ mode: 'practice', config: { count: ids.length, minutes: 0, topics: [] }, only: ids, prioritiseWeak: false })
            }
          />
        ) : session && !session.finishedAt ? (
          <Quiz
            session={session}
            byId={bank.byId}
            lang={lang}
            translations={translations}
            progress={progress}
            shuffleOptions={shuffleOptions}
            onSession={setSession}
            onAnswered={onAnswered}
            onBookmark={(id) => persistProgress(store.toggleBookmark(progress, id))}
            onFinish={finish}
            onQuit={quit}
          />
        ) : (
          <Home
            bank={bank.questions}
            progress={progress}
            lang={lang}
            hasSession={Boolean(session && !session.finishedAt)}
            onStart={start}
            onResume={() => setViewingResults(false)}
            onDiscard={() => setSession(null)}
            onResetProgress={() => {
              if (confirm(t('resetConfirm'))) persistProgress(store.emptyProgress());
            }}
          />
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 pt-2 text-center text-xs text-slate-400">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={shuffleOptions}
            onChange={(e) => setShuffleOptions(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-azure-600"
          />
          {t('shuffle')}
        </label>
      </footer>
    </>
  );
}
