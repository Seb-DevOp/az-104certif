import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang, Progress, Question, SessionState, TranslationMap } from '../types';
import { formatDuration, makeT } from '../lib/i18n';
import { gradeInteractive, makeRecord } from '../lib/quiz';
import { Countdown, ProgressBar } from './ui';
import { QuestionCard } from './QuestionCard';

export function Quiz({
  session, byId, lang, translations, progress, shuffleOptions,
  onSession, onAnswered, onBookmark, onFinish, onQuit,
}: {
  session: SessionState;
  byId: Map<number, Question>;
  lang: Lang;
  translations: TranslationMap;
  progress: Progress;
  shuffleOptions: boolean;
  onSession: (s: SessionState) => void;
  onAnswered: (questionId: number, correct: boolean) => void;
  onBookmark: (questionId: number) => void;
  onFinish: (finished: SessionState) => void;
  onQuit: () => void;
}) {
  const t = makeT(lang);
  const isExam = session.mode === 'exam';
  const id = session.questionIds[session.index];
  const q = byId.get(id);

  // Draft selection for the question on screen. In exam mode it is committed on navigation
  // so answers survive going back and forth; in practice mode it is committed on check.
  const [draft, setDraft] = useState<string[]>(() => session.answers[id]?.selected ?? []);
  const [revealed, setRevealed] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  // Swap the draft during render, not in an effect. <DragDrop> seeds its board from the
  // draft the first time it mounts for a question, and an effect only runs after that
  // mount — which handed each drag-and-drop question the previous one's chips.
  const [shownId, setShownId] = useState(id);
  if (shownId !== id) {
    setShownId(id);
    setDraft(session.answers[id]?.selected ?? []);
    setRevealed(false);
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  // A question upgraded to a playable drag-and-drop is machine-graded even though the
  // source dump classes it as a self-graded 'reveal'.
  const selfGradedOnly = Boolean(q && q.type === 'reveal' && !q.interactive);
  const answeredCount = Object.keys(session.answers).length;
  const flagged = session.flagged.includes(id);
  const bookmarked = progress.bookmarks.includes(id);

  const commitExamDraft = useCallback(
    (base: SessionState): SessionState => {
      if (!isExam || !q || !draft.length) return base;
      const correct = q.interactive
        ? gradeInteractive(q.interactive, draft)
        : q.type === 'reveal'
          ? false
          : draft.length === q.answer.length && draft.every((k) => q.answer.includes(k));
      return { ...base, answers: { ...base.answers, [id]: makeRecord(id, draft, correct, selfGradedOnly) } };
    },
    [isExam, q, draft, id, selfGradedOnly],
  );

  const go = (delta: number) => {
    const next = Math.min(session.questionIds.length - 1, Math.max(0, session.index + delta));
    onSession({ ...commitExamDraft(session), index: next });
  };

  const jump = (index: number) => {
    onSession({ ...commitExamDraft(session), index });
    setShowPalette(false);
  };

  const finish = () => {
    const done = { ...commitExamDraft(session), finishedAt: Date.now() };
    onSession(done);
    onFinish(done);
  };

  const toggleFlag = () =>
    onSession({
      ...session,
      flagged: flagged ? session.flagged.filter((x) => x !== id) : [...session.flagged, id],
    });

  // Practice mode: checking commits the answer and reveals the explanation.
  const check = (correct: boolean) => {
    if (!q) return;
    setRevealed(true);
    if (selfGradedOnly) return; // the learner grades themselves in a second step
    onSession({ ...session, answers: { ...session.answers, [id]: makeRecord(id, draft, correct, false) } });
    onAnswered(id, correct);
  };

  // Recording the grade and advancing must be one update: two onSession calls in the same
  // tick would both build on the pre-grade session, and the second would drop the answer.
  const selfGrade = (correct: boolean) => {
    if (!q) return;
    const graded: SessionState = {
      ...session,
      answers: { ...session.answers, [id]: makeRecord(id, [], correct, true) },
    };
    onAnswered(id, correct);
    if (session.index < session.questionIds.length - 1) {
      onSession({ ...graded, index: session.index + 1 });
    } else {
      const done = { ...graded, finishedAt: Date.now() };
      onSession(done);
      onFinish(done);
    }
  };

  // Enter advances: check first, then move on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
      e.preventDefault();
      if (!isExam && !revealed && draft.length && q && !selfGradedOnly) {
        check(draft.length === q.answer.length && draft.every((k) => q.answer.includes(k)));
      } else if (session.index < session.questionIds.length - 1) go(1);
      else finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-slate-600 dark:text-slate-400">{t('noQuestions')}</p>
        <button type="button" className="btn-ghost mt-4" onClick={onQuit}>{t('backHome')}</button>
      </div>
    );
  }

  const isLast = session.index === session.questionIds.length - 1;
  const canAdvance = isExam || revealed || selfGradedOnly;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-subtle text-xs" onClick={onQuit}>
            ← {t('quit')}
          </button>
          <span className="text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
            {t('question')} {session.index + 1} {t('of')} {session.questionIds.length}
          </span>
          {isExam && session.endsAt && (
            <Countdown
              endsAt={session.endsAt}
              onExpire={finish}
              render={(ms) => (
                <span
                  className={`ml-auto rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${
                    ms < 5 * 60_000
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                  title={t('timeLeft')}
                >
                  {formatDuration(ms)}
                </span>
              )}
            />
          )}
          {!isExam && (
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {answeredCount} {t('answered').toLowerCase()}
            </span>
          )}
        </div>
        <ProgressBar value={((session.index + 1) / session.questionIds.length) * 100} />
      </header>

      <QuestionCard
        question={q}
        lang={lang}
        translations={translations}
        showFeedback={!isExam}
        shuffleOptions={shuffleOptions}
        selected={draft}
        revealed={!isExam && revealed}
        onSelect={setDraft}
        onCheck={check}
        onSelfGrade={selfGrade}
      />

      <nav className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost" disabled={session.index === 0} onClick={() => go(-1)}>
          {t('previous')}
        </button>

        <button
          type="button"
          className={`btn-ghost ${flagged ? 'border-amber-500 text-amber-700 dark:text-amber-300' : ''}`}
          onClick={toggleFlag}
        >
          {flagged ? `★ ${t('flagged')}` : `☆ ${t('flag')}`}
        </button>

        <button
          type="button"
          className={`btn-ghost ${bookmarked ? 'border-azure-500 text-azure-700 dark:text-azure-300' : ''}`}
          onClick={() => onBookmark(id)}
        >
          {bookmarked ? `◆ ${t('bookmarked')}` : `◇ ${t('bookmark')}`}
        </button>

        {isExam && (
          <button type="button" className="btn-ghost" onClick={() => setShowPalette((v) => !v)}>
            {t('jumpTo')}
          </button>
        )}

        <div className="ml-auto flex gap-2">
          {isLast ? (
            <button type="button" className="btn-primary" onClick={finish} disabled={!isExam && !canAdvance && !answeredCount}>
              {isExam ? t('submitExam') : t('finish')}
            </button>
          ) : (
            <button type="button" className={canAdvance ? 'btn-primary' : 'btn-ghost'} onClick={() => go(1)}>
              {canAdvance ? t('next') : t('skip')}
            </button>
          )}
        </div>
      </nav>

      {!isExam && (
        <p className="mt-3 text-center text-xs text-slate-400">{t('keyboardHint')}</p>
      )}

      {isExam && showPalette && (
        <Palette session={session} onJump={jump} />
      )}
    </div>
  );
}

function Palette({ session, onJump }: { session: SessionState; onJump: (i: number) => void }) {
  const cells = useMemo(
    () =>
      session.questionIds.map((qid, i) => ({
        i,
        qid,
        answered: Boolean(session.answers[qid]),
        flagged: session.flagged.includes(qid),
      })),
    [session],
  );
  return (
    <div className="card mt-4 p-4">
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {cells.map((c) => (
          <button
            key={c.qid}
            type="button"
            onClick={() => onJump(c.i)}
            className={`relative h-9 rounded-md text-xs font-semibold tabular-nums transition-colors ${
              c.i === session.index
                ? 'bg-azure-600 text-white'
                : c.answered
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {c.i + 1}
            {c.flagged && <span className="absolute right-0.5 top-0 text-[9px] text-amber-500">★</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
