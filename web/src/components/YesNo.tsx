import type { Lang, YesNoSpec } from '../types';
import { makeT } from '../lib/i18n';

export interface YesNoProps {
  spec: YesNoSpec;
  lang: Lang;
  /** Statement id -> the learner's pick. Absent means unanswered. */
  value: Record<string, boolean>;
  /** Locked once the answer has been checked. */
  revealed: boolean;
  onChange: (next: Record<string, boolean>) => void;
}

/**
 * The exam's Yes/No statement grid. Each row is an independent true/false judgement; after
 * checking, every row shows whether it was right and what the key says.
 */
export function YesNo({ spec, lang, value, revealed, onChange }: YesNoProps) {
  const t = makeT(lang);

  const pick = (id: string, answer: boolean) => {
    if (revealed) return;
    onChange({ ...value, [id]: answer });
  };

  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{spec.prompt || t('yesNoHint')}</p>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          <span>{t('statements')}</span>
          <span className="flex gap-2">
            <span className="w-12 text-center">{t('yes')}</span>
            <span className="w-12 text-center">{t('no')}</span>
          </span>
        </div>

        {spec.statements.map((s) => {
          const picked = value[s.id];
          const answered = picked !== undefined;
          const ok = answered && picked === s.answer;
          const rowTone = !revealed
            ? ''
            : ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30'
              : 'bg-rose-50 dark:bg-rose-950/30';
          return (
            <div
              key={s.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800 ${rowTone}`}
            >
              <div>
                <p className="text-sm text-slate-800 dark:text-slate-200">{s.text}</p>
                {revealed && !ok && (
                  <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                    {t('correctAnswer')} : {s.answer ? t('yes') : t('no')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {[true, false].map((choice) => {
                  const isPicked = picked === choice;
                  const isKey = revealed && s.answer === choice;
                  return (
                    <button
                      key={String(choice)}
                      type="button"
                      disabled={revealed}
                      aria-pressed={isPicked}
                      aria-label={`${s.text} — ${choice ? t('yes') : t('no')}`}
                      onClick={() => pick(s.id, choice)}
                      className={`h-9 w-12 rounded-md border text-xs font-semibold transition-colors disabled:cursor-default ${
                        isKey
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isPicked
                            ? revealed
                              ? 'border-rose-500 bg-rose-500 text-white'
                              : 'border-azure-600 bg-azure-600 text-white'
                            : 'border-slate-300 bg-white text-slate-500 hover:border-azure-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {choice ? t('yes') : t('no')}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
