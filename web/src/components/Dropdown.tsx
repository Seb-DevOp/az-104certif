import type { DropdownSpec, Lang } from '../types';
import { makeT } from '../lib/i18n';

export interface DropdownProps {
  spec: DropdownSpec;
  lang: Lang;
  /** Field id -> chosen option index. Absent means unanswered. */
  value: Record<string, number>;
  revealed: boolean;
  onChange: (next: Record<string, number>) => void;
}

/**
 * The exam's answer area of drop-down menus. Each field is graded on its own, and after
 * checking a wrong field shows the choice the key expects.
 */
export function Dropdown({ spec, lang, value, revealed, onChange }: DropdownProps) {
  const t = makeT(lang);

  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{spec.prompt || t('dropdownHint')}</p>

      <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        {spec.fields.map((f) => {
          const picked = value[f.id];
          const ok = picked === f.answer;
          const border = !revealed
            ? 'border-slate-300 dark:border-slate-600'
            : ok
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
              : 'border-rose-500 bg-rose-50 dark:bg-rose-950/40';
          return (
            <div key={f.id} className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
              <label className="text-sm text-slate-800 dark:text-slate-200" htmlFor={`dd-${f.id}`}>
                {f.label}
              </label>
              <div>
                <select
                  id={`dd-${f.id}`}
                  disabled={revealed}
                  value={picked ?? ''}
                  onChange={(e) => onChange({ ...value, [f.id]: Number(e.target.value) })}
                  className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-default dark:bg-slate-900 dark:text-slate-100 ${border}`}
                >
                  <option value="" disabled>
                    {t('choose')}
                  </option>
                  {f.options.map((o, i) => (
                    <option key={i} value={i}>
                      {o}
                    </option>
                  ))}
                </select>
                {revealed && !ok && (
                  <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                    {t('correctAnswer')} : {f.options[f.answer]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
