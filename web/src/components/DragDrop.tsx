import { useMemo, useState } from 'react';
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor,
  pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import type { DragDropSpec, Lang } from '../types';
import { makeT } from '../lib/i18n';

/** Where every item currently sits: target id, or POOL when still unplaced. */
const POOL = '__pool__';
type Placement = Record<string, string>;

/**
 * Drop where the pointer is, not where the dragged card's centre happens to land. The
 * default rect-based strategies measure the floating overlay against zones separated by
 * gaps, which drops an item on its neighbour when the card is taller than the zone.
 * `closestCenter` is kept as the fallback for the keyboard sensor, which has no pointer.
 */
const dropWherePointing: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

/** Re-measure on every drag: the pool shrinks as items leave it, moving the zones below. */
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

function Chip({ label, dragging }: { label: string; dragging?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${
        dragging
          ? 'border-azure-500 bg-azure-50 text-azure-900 dark:bg-azure-900 dark:text-azure-50'
          : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
      }`}
    >
      {label}
    </div>
  );
}

function DraggableChip({ id, label, disabled }: { id: string; label: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none ${disabled ? '' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-40' : ''}`}
    >
      <Chip label={label} />
    </div>
  );
}

function DropZone({
  id, label, children, state,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  state?: 'correct' | 'wrong';
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const border =
    state === 'correct'
      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
      : state === 'wrong'
        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
        : isOver
          ? 'border-azure-500 bg-azure-50 dark:bg-azure-950/40'
          : 'border-dashed border-slate-300 dark:border-slate-700';
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <p className="text-sm text-slate-700 dark:text-slate-300">{label}</p>
      <div ref={setNodeRef} className={`min-h-[3rem] rounded-lg border-2 p-2 transition-colors ${border}`}>
        {children}
      </div>
    </div>
  );
}

export interface DragDropProps {
  spec: DragDropSpec;
  lang: Lang;
  /** Locked once the answer has been checked. */
  revealed: boolean;
  /** Placement to start from, so navigating back to a question restores the board. */
  initialPlaced?: Record<string, string[]>;
  perTarget?: Record<string, boolean>;
  onChange: (placed: Record<string, string[]>) => void;
}

export function DragDrop({ spec, lang, revealed, initialPlaced, perTarget, onChange }: DragDropProps) {
  const t = makeT(lang);
  const [placement, setPlacement] = useState<Placement>(() => {
    const start: Placement = Object.fromEntries(spec.items.map((i) => [i.id, POOL]));
    for (const [target, items] of Object.entries(initialPlaced ?? {})) {
      for (const item of items) if (item in start) start[item] = target;
    }
    return start;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const labels = useMemo(() => new Map(spec.items.map((i) => [i.id, i.label])), [spec.items]);
  const inZone = (zone: string) => spec.items.filter((i) => placement[i.id] === zone);

  const commit = (next: Placement) => {
    setPlacement(next);
    const placed: Record<string, string[]> = {};
    for (const target of spec.targets) {
      placed[target.id] = spec.items.filter((i) => next[i.id] === target.id).map((i) => i.id);
    }
    onChange(placed);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (revealed) return;
    const item = String(e.active.id);
    const zone = e.over ? String(e.over.id) : POOL;
    if (placement[item] === zone) return;
    commit({ ...placement, [item]: zone });
  };

  const reset = () => commit(Object.fromEntries(spec.items.map((i) => [i.id, POOL])));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropWherePointing}
      measuring={MEASURING}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{spec.prompt || t('dragHint')}</p>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('dragPool')}
          </p>
          <DropZone id={POOL} label="">
            <div className="flex flex-wrap gap-2">
              {inZone(POOL).map((i) => (
                <DraggableChip key={i.id} id={i.id} label={i.label} disabled={revealed} />
              ))}
              {!inZone(POOL).length && (
                <span className="px-1 text-xs text-slate-400">—</span>
              )}
            </div>
          </DropZone>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('dragTargets')}
          </p>
          <div className="space-y-3">
            {spec.targets.map((target) => (
              <DropZone
                key={target.id}
                id={target.id}
                label={target.label}
                state={perTarget ? (perTarget[target.id] ? 'correct' : 'wrong') : undefined}
              >
                <div className="flex flex-wrap gap-2">
                  {inZone(target.id).map((i) => (
                    <DraggableChip key={i.id} id={i.id} label={i.label} disabled={revealed} />
                  ))}
                  {!inZone(target.id).length && (
                    <span className="px-1 text-xs text-slate-400">{t('dropHere')}</span>
                  )}
                </div>
              </DropZone>
            ))}
          </div>
        </div>

        {!revealed && (
          <button type="button" className="btn-subtle text-xs" onClick={reset}>
            {t('reset')}
          </button>
        )}

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

      <DragOverlay>{activeId ? <Chip label={labels.get(activeId) ?? ''} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
