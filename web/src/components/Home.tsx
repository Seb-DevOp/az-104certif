import { useMemo, useState } from 'react';
import type { ExamConfig, Lang, Mode, Progress, Question, Topic } from '../types';
import { makeT, topicLabel, TOPICS } from '../lib/i18n';
import { wrongIds } from '../lib/quiz';
import { Badge, ProgressBar } from './ui';

export type Launch = {
  mode: Mode;
  config: ExamConfig;
  only?: number[];
  prioritiseWeak: boolean;
};

const EXAM_PRESETS = [
  { count: 50, minutes: 75 },
  { count: 25, minutes: 40 },
  { count: 100, minutes: 150 },
];

export function Home({
  bank, progress, lang, hasSession, onStart, onResume, onDiscard, onResetProgress,
}: {
  bank: Question[];
  progress: Progress;
  lang: Lang;
  hasSession: boolean;
  onStart: (l: Launch) => void;
  onResume: () => void;
  onDiscard: () => void;
  onResetProgress: () => void;
}) {
  const t = makeT(lang);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [preset, setPreset] = useState(0);
  const [practiceCount, setPracticeCount] = useState(20);
  const [prioritiseWeak, setPrioritiseWeak] = useState(true);

  const mistakes = useMemo(() => wrongIds(progress), [progress]);
  const bookmarks = progress.bookmarks;

  const available = useMemo(
    () => (topics.length ? bank.filter((q) => topics.includes(q.topic)) : bank).length,
    [bank, topics],
  );

  const seenCount = Object.values(progress.stats).filter((s) => s.seen > 0).length;
  const masteredCount = Object.values(progress.stats).filter((s) => s.seen > 0 && s.lastCorrect).length;

  const toggleTopic = (topic: Topic) =>
    setTopics((cur) => (cur.includes(topic) ? cur.filter((x) => x !== topic) : [...cur, topic]));

  const baseConfig = (count: number, minutes: number): ExamConfig => ({
    count: Math.min(count, available),
    minutes,
    topics,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t('appName')}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{t('tagline')}</p>
        <p className="mt-1 text-sm text-slate-500">
          {bank.length} {t('totalQuestions').toLowerCase()}
        </p>
      </section>

      {hasSession && (
        <section className="card flex flex-wrap items-center gap-3 border-azure-300 bg-azure-50 p-4 dark:border-azure-800 dark:bg-azure-950/40">
          <span className="text-sm font-medium text-azure-900 dark:text-azure-100">{t('resumeSession')}</span>
          <button type="button" className="btn-primary ml-auto" onClick={onResume}>
            {t('resume')}
          </button>
          <button type="button" className="btn-ghost" onClick={onDiscard}>
            {t('discard')}
          </button>
        </section>
      )}

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('domains')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTopics([])}
            className={`chip border px-3 py-1.5 transition-colors ${
              topics.length === 0
                ? 'border-azure-600 bg-azure-600 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('allDomains')}
          </button>
          {TOPICS.map((topic) => {
            const on = topics.includes(topic);
            const count = bank.filter((q) => q.topic === topic).length;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                className={`chip border px-3 py-1.5 transition-colors ${
                  on
                    ? 'border-azure-600 bg-azure-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {topicLabel(topic, lang)}
                <span className={on ? 'text-azure-100' : 'text-slate-400'}>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={prioritiseWeak}
            onChange={(e) => setPrioritiseWeak(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-azure-600 focus:ring-azure-500"
          />
          <span>
            {t('prioritiseWeak')}
            <span className="block text-xs text-slate-500 dark:text-slate-400">{t('prioritiseWeakHint')}</span>
          </span>
        </label>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card flex flex-col p-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('practiceMode')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('practiceDesc')}</p>
          <div className="mt-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="practice-count">
              {t('questionCount')}: <span className="font-semibold text-slate-800 dark:text-slate-200">{practiceCount}</span>
            </label>
            <input
              id="practice-count"
              type="range"
              min={5}
              max={Math.max(5, Math.min(200, available))}
              step={5}
              value={Math.min(practiceCount, Math.max(5, available))}
              onChange={(e) => setPracticeCount(Number(e.target.value))}
              className="mt-1 w-full accent-azure-600"
            />
          </div>
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={!available}
            onClick={() => onStart({ mode: 'practice', config: baseConfig(practiceCount, 0), prioritiseWeak })}
          >
            {t('start')}
          </button>
        </section>

        <section className="card flex flex-col p-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('examMode')}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('examDesc')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAM_PRESETS.map((p, i) => (
              <button
                key={p.count}
                type="button"
                onClick={() => setPreset(i)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  preset === i
                    ? 'border-azure-600 bg-azure-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {p.count} Q · {p.minutes} {t('minutes')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            disabled={!available}
            onClick={() =>
              onStart({
                mode: 'exam',
                config: baseConfig(EXAM_PRESETS[preset].count, EXAM_PRESETS[preset].minutes),
                prioritiseWeak: false,
              })
            }
          >
            {t('start')}
          </button>
        </section>
      </div>

      {!available && (
        <p className="text-center text-sm text-rose-600 dark:text-rose-400">{t('noQuestions')}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SecondaryCard
          title={t('reviewMode')}
          desc={t('reviewDesc')}
          count={mistakes.length}
          disabled={!mistakes.length}
          cta={t('start')}
          onClick={() =>
            onStart({
              mode: 'practice',
              config: { count: mistakes.length, minutes: 0, topics: [] },
              only: mistakes,
              prioritiseWeak: false,
            })
          }
        />
        <SecondaryCard
          title={t('bookmarksMode')}
          desc={t('bookmarksDesc')}
          count={bookmarks.length}
          disabled={!bookmarks.length}
          cta={t('start')}
          onClick={() =>
            onStart({
              mode: 'practice',
              config: { count: bookmarks.length, minutes: 0, topics: [] },
              only: bookmarks,
              prioritiseWeak: false,
            })
          }
        />
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('progress')}
        </h2>
        {seenCount === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noProgress')}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label={t('answered')} value={`${seenCount}/${bank.length}`} />
              <Stat label={t('mastery')} value={`${Math.round((masteredCount / bank.length) * 100)}%`} />
              <Stat label={t('attempts')} value={String(Object.values(progress.stats).reduce((n, s) => n + s.seen, 0))} />
            </div>
            <div className="space-y-2">
              {TOPICS.map((topic) => {
                const ids = bank.filter((q) => q.topic === topic);
                if (!ids.length) return null;
                const ok = ids.filter((q) => progress.stats[q.id]?.lastCorrect).length;
                return (
                  <div key={topic}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{topicLabel(topic, lang)}</span>
                      <span className="tabular-nums text-slate-500">{ok}/{ids.length}</span>
                    </div>
                    <ProgressBar value={(ok / ids.length) * 100} tone={ok / ids.length >= 0.7 ? 'green' : 'blue'} />
                  </div>
                );
              })}
            </div>
            {progress.history.length > 0 && (
              <div>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('lastExams')}
                </p>
                <ul className="space-y-1 text-sm">
                  {progress.history.slice(0, 5).map((h) => (
                    <li key={h.at} className="flex items-center gap-2">
                      <span className="text-slate-500">{new Date(h.at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                      <span className="tabular-nums text-slate-700 dark:text-slate-200">
                        {h.score}/{h.total}
                      </span>
                      <Badge tone={h.score / h.total >= 0.7 ? 'green' : 'red'}>
                        {Math.round((h.score / h.total) * 100)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className="btn-subtle text-xs text-rose-600 dark:text-rose-400" onClick={onResetProgress}>
              {t('resetProgress')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
      <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function SecondaryCard({
  title, desc, count, disabled, cta, onClick,
}: {
  title: string;
  desc: string;
  count: number;
  disabled: boolean;
  cta: string;
  onClick: () => void;
}) {
  return (
    <section className="card flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {title} <span className="text-sm font-normal text-slate-500">({count})</span>
        </h3>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
      </div>
      <button type="button" className="btn-ghost shrink-0" disabled={disabled} onClick={onClick}>
        {cta}
      </button>
    </section>
  );
}
