import { useMemo } from 'react';
import type { DragDropSpec, Lang } from '../types';
import { makeT } from '../lib/i18n';

export interface PlacementProps {
  spec: DragDropSpec;
  lang: Lang;
  /** Target id -> the item ids placed in it. */
  value: Record<string, string[]>;
  /** Locked once the answer has been checked. */
  revealed: boolean;
  perTarget?: Record<string, boolean>;
  onChange: (placed: Record<string, string[]>) => void;
}

/** One menu on screen: which target it feeds, and which slot of that target. */
interface Slot {
  key: string;
  targetId: string;
  index: number;
  label: string;
}

/**
 * The answer area of a drag-and-drop question, rendered as one menu per slot rather than as
 * a board. Dragging needs a pointer it can track across the page, which touch devices do not
 * give reliably, so on a phone the board was unusable; a `<select>` is native everywhere and
 * keyboard-accessible for free.
 *
 * The question data is unchanged — it still describes targets that accept items, which is
 * what the exam shows — and grading still compares the items in each target as a set.
 */
export function Placement({ spec, lang, value, revealed, perTarget, onChange }: PlacementProps) {
  const t = makeT(lang);

  const labels = useMemo(() => new Map(spec.items.map((i) => [i.id, i.label])), [spec.items]);

  // A target that holds a single item is labelled by the target itself ("Step 2", "User1");
  // one that holds several is split into that many numbered slots, since the answer is a set
  // of settings rather than an ordered list.
  const slots = useMemo<Slot[]>(
    () =>
      spec.targets.flatMap((target) =>
        target.accepts.map((_, index) => ({
          key: `${target.id}#${index}`,
          targetId: target.id,
          index,
          label: target.accepts.length === 1 ? target.label : `${t('choiceN')} ${index + 1}`,
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.targets, lang],
  );

  const itemIn = (slot: Slot) => value[slot.targetId]?.[slot.index] ?? '';

  /** Every item already chosen, and in which slot, so no item can be used twice. */
  const takenBy = new Map<string, string>();
  for (const slot of slots) {
    const item = itemIn(slot);
    if (item) takenBy.set(item, slot.key);
  }

  const setSlot = (slot: Slot, itemId: string) => {
    // An empty slot keeps its place as an empty string rather than collapsing the array,
    // otherwise filling the second menu first would make the choice jump to the first.
    // A half-filled target still grades wrong, and Check stays disabled until every slot
    // is filled, so the blanks never reach the score.
    const next: Record<string, string[]> = {};
    for (const target of spec.targets) next[target.id] = target.accepts.map(() => '');
    for (const s of slots) {
      const chosen = s.key === slot.key ? itemId : itemIn(s);
      // Picking an item that sits elsewhere moves it here, the way dragging it would have.
      next[s.targetId][s.index] = s.key !== slot.key && chosen === itemId ? '' : chosen;
    }
    onChange(next);
  };

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">{spec.prompt || t('placementHint')}</p>

      <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        {slots.map((slot) => {
          const chosen = itemIn(slot);
          const verdict = perTarget?.[slot.targetId];
          const border =
            verdict === undefined
              ? 'border-slate-300 dark:border-slate-600'
              : verdict
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-rose-500 bg-rose-50 dark:bg-rose-950/40';
          return (
            <div
              key={slot.key}
              className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4"
            >
              <label className="text-sm text-slate-800 dark:text-slate-200" htmlFor={`pl-${slot.key}`}>
                {slot.label}
              </label>
              <select
                id={`pl-${slot.key}`}
                disabled={revealed}
                value={chosen}
                onChange={(e) => setSlot(slot, e.target.value)}
                className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-default dark:bg-slate-900 dark:text-slate-100 ${border}`}
              >
                <option value="" disabled>
                  {t('choose')}
                </option>
                {spec.items.map((item) => {
                  const heldElsewhere = takenBy.has(item.id) && takenBy.get(item.id) !== slot.key;
                  return (
                    <option key={item.id} value={item.id} disabled={heldElsewhere}>
                      {item.label}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}

        {!revealed && (
          <button type="button" className="btn-subtle text-xs" onClick={() => onChange({})}>
            {t('reset')}
          </button>
        )}
      </div>

      {revealed && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">{t('correctAnswer')}</p>
          <ul className="space-y-1 text-slate-600 dark:text-slate-300">
            {spec.targets.map((target) => (
              <li key={target.id}>
                <span className="font-medium">{target.label}</span> →{' '}
                {target.accepts.map((id) => labels.get(id) ?? id).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
