import { useMemo, useState } from 'react';
import type { Lang, Question, SessionState, Topic, TranslationMap } from '../types';
import { formatDuration, makeT, topicLabel } from '../lib/i18n';
import { score } from '../lib/quiz';
import { Badge, ProgressBar } from './ui';
import { QuestionCard } from './QuestionCard';

export function Results({
  session, byId, lang, translations, onHome, onRetryWrong,
}: {
  session: SessionState;
  byId: Map<number, Question>;
  lang: Lang;
  translations: TranslationMap;
  onHome: () => void;
  onRetryWrong: (ids: number[]) => void;
}) {
  const t = makeT(lang);
  const [reviewing, setReviewing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'wrong'>('wrong');

  const s = useMemo(() => score(session, byId), [session, byId]);
  const elapsed = (session.finishedAt ?? Date.now()) - session.startedAt;
  const wrong = session.questionIds.filter((id) => !session.answers[id]?.correct);
  const selfGradedCount = Object.values(session.answers).filter((a) => a.selfGraded).length;

  const shown = reviewing
    ? session.questionIds.filter((id) => filter === 'all' || !session.answers[id]?.correct)
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <section className="card p-6 text-center">
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('results')}</p>
        <p className={`mt-2 text-5xl font-bold tabular-nums ${s.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {s.percent}%
        </p>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          {s.correct} / {s.total}
        </p>
        <div className="mt-3 flex justify-center">
          <Badge tone={s.passed ? 'green' : 'red'}>{s.passed ? t('passed') : t('failed')}</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('passMarkNote')}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <Cell label={t('correct')} value={String(s.correct)} tone="text-emerald-600 dark:text-emerald-400" />
          <Cell label={t('incorrect')} value={String(s.wrong)} tone="text-rose-600 dark:text-rose-400" />
          <Cell label={t('unanswered')} value={String(s.unanswered)} />
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {t('timeSpent')}: {formatDuration(elapsed)}
          {selfGradedCount > 0 && <> · {t('selfGradedNote')}</>}
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('byDomain')}
        </h2>
        <div className="space-y-3">
          {Object.entries(s.byTopic).map(([topic, v]) => (
            <div key={topic}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{topicLabel(topic as Topic, lang)}</span>
                <span className="tabular-nums text-slate-500">{v.correct}/{v.total}</span>
              </div>
              <ProgressBar value={(v.correct / v.total) * 100} tone={v.correct / v.total >= 0.7 ? 'green' : 'amber'} />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => setReviewing((v) => !v)}>
          {t('reviewAnswers')}
        </button>
        {wrong.length > 0 && (
          <button type="button" className="btn-ghost" onClick={() => onRetryWrong(wrong)}>
            {t('retryWrong')} ({wrong.length})
          </button>
        )}
        <button type="button" className="btn-ghost ml-auto" onClick={onHome}>
          {t('backHome')}
        </button>
      </div>

      {reviewing && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={filter === 'wrong' ? 'btn-primary text-xs' : 'btn-ghost text-xs'}
              onClick={() => setFilter('wrong')}
            >
              {t('incorrect')} ({wrong.length})
            </button>
            <button
              type="button"
              className={filter === 'all' ? 'btn-primary text-xs' : 'btn-ghost text-xs'}
              onClick={() => setFilter('all')}
            >
              {t('allDomains')} ({session.questionIds.length})
            </button>
          </div>
          {shown.map((id) => {
            const q = byId.get(id);
            if (!q) return null;
            const rec = session.answers[id];
            return (
              <div key={id}>
                {rec && (
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('yourAnswer')}: {rec.selfGraded ? (rec.correct ? t('iWasRight') : t('iWasWrong')) : rec.selected.join(', ') || '—'}
                  </p>
                )}
                <QuestionCard
                  question={q}
                  lang={lang}
                  translations={translations}
                  showFeedback={false}
                  shuffleOptions={false}
                  selected={rec?.selected ?? []}
                  revealed
                  readOnly
                  onSelect={() => {}}
                  onCheck={() => {}}
                  onSelfGrade={() => {}}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone = 'text-slate-700 dark:text-slate-200' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
