import { useEffect, useRef, useState, type ReactNode } from 'react';
import { imageUrl } from '../lib/data';

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'blue' | 'green' | 'red' | 'amber'; children: ReactNode }) {
  const tones = {
    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    blue: 'bg-azure-100 text-azure-800 dark:bg-azure-900/50 dark:text-azure-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
    red: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  } as const;
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function ProgressBar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'amber' }) {
  const tones = { blue: 'bg-azure-600', green: 'bg-emerald-500', amber: 'bg-amber-500' } as const;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${tones[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * Exhibit screenshots are often wider than the column and carry small text, so they open
 * into a full-screen lightbox on click.
 */
export function Exhibit({ files, label }: { files: string[]; label: string }) {
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (!files.length) return null;
  return (
    <div className="exhibit space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      {files.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setZoom(f)}
          className="block w-full cursor-zoom-in overflow-x-auto rounded-md"
          aria-label={`${label} — agrandir / enlarge`}
        >
          <img src={imageUrl(f)} alt={label} loading="lazy" className="mx-auto max-w-full" />
        </button>
      ))}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-950/80 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={imageUrl(zoom)} alt={label} className="max-h-none w-auto max-w-none cursor-zoom-out rounded-lg bg-white shadow-2xl" />
        </div>
      )}
    </div>
  );
}

/** Renders explanation text: paragraphs, with "Box 1:" style leads picked out. */
export function Explanation({ text }: { text: string }) {
  return (
    <div className="prose-stem text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {text.split('\n\n').map((para, i) => {
        const m = para.match(/^(Box \d+|Étape \d+|Step \d+)\s*:\s*(.*)$/s);
        return (
          <p key={i}>
            {m ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{m[1]}: </span>
                {m[2]}
              </>
            ) : (
              para
            )}
          </p>
        );
      })}
    </div>
  );
}

export function Toggle({
  options, value, onChange, ariaLabel,
}: {
  options: { value: string; label: ReactNode; title?: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === o.value
              ? 'bg-azure-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Countdown that ticks locally and calls `onExpire` once when the deadline passes. */
export function Countdown({ endsAt, onExpire, render }: { endsAt: number; onExpire: () => void; render: (msLeft: number) => ReactNode }) {
  const [left, setLeft] = useState(() => endsAt - Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const ms = endsAt - Date.now();
      setLeft(ms);
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  return <>{render(Math.max(0, left))}</>;
}
