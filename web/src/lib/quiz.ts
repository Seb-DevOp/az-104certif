import type {
  AnswerRecord, DragDropSpec, ExamConfig, InteractiveSpec, Mode, Progress, Question,
  DropdownSpec, SessionState, Topic, YesNoSpec,
} from '../types';

/** Fisher-Yates, seeded off Math.random — good enough for shuffling a quiz. */
export function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PickOptions {
  count: number;
  topics: Topic[];
  /** Restrict to a specific set of ids (mistake review, bookmarks). */
  only?: number[];
  /** Put never-seen and previously-missed questions first. */
  prioritiseWeak?: boolean;
  progress: Progress;
}

/**
 * Chooses the questions for a session. With `prioritiseWeak` the bank is bucketed into
 * never-seen / last-answer-wrong / mastered, each bucket shuffled, then drawn in that order
 * so a short session spends its slots where they teach the most.
 */
export function pickQuestions(bank: Question[], opts: PickOptions): number[] {
  const allowed = new Set(opts.topics);
  const onlySet = opts.only ? new Set(opts.only) : null;
  const pool = bank.filter(
    (q) => (!allowed.size || allowed.has(q.topic)) && (!onlySet || onlySet.has(q.id)),
  );

  if (!opts.prioritiseWeak) return shuffle(pool).slice(0, opts.count).map((q) => q.id);

  const unseen: Question[] = [], missed: Question[] = [], known: Question[] = [];
  for (const q of pool) {
    const st = opts.progress.stats[q.id];
    if (!st || !st.seen) unseen.push(q);
    else if (!st.lastCorrect) missed.push(q);
    else known.push(q);
  }
  return [...shuffle(missed), ...shuffle(unseen), ...shuffle(known)]
    .slice(0, opts.count)
    .map((q) => q.id);
}

export const sameAnswer = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function newSession(mode: Mode, questionIds: number[], config: ExamConfig): SessionState {
  const startedAt = Date.now();
  return {
    mode,
    questionIds,
    index: 0,
    answers: {},
    flagged: [],
    startedAt,
    endsAt: mode === 'exam' ? startedAt + config.minutes * 60_000 : undefined,
    config,
  };
}

export interface Scoring {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  passed: boolean;
  byTopic: Record<string, { total: number; correct: number }>;
}

/** The official AZ-104 pass mark is 700/1000 — treated here as 70% of questions. */
export const PASS_RATIO = 0.7;

export function score(session: SessionState, byId: Map<number, Question>): Scoring {
  const byTopic: Scoring['byTopic'] = {};
  let correct = 0, answered = 0;
  for (const id of session.questionIds) {
    const q = byId.get(id);
    if (!q) continue;
    const bucket = (byTopic[q.topic] ??= { total: 0, correct: 0 });
    bucket.total++;
    const rec = session.answers[id];
    if (!rec) continue;
    answered++;
    if (rec.correct) { correct++; bucket.correct++; }
  }
  const total = session.questionIds.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return {
    total,
    answered,
    correct,
    wrong: answered - correct,
    unanswered: total - answered,
    percent,
    passed: total > 0 && correct / total >= PASS_RATIO,
    byTopic,
  };
}

export function makeRecord(
  questionId: number,
  selected: string[],
  correct: boolean,
  selfGraded: boolean,
): AnswerRecord {
  return { questionId, selected, correct, selfGraded, at: Date.now() };
}

/** Question ids the learner has answered and got wrong most recently. */
export function wrongIds(progress: Progress): number[] {
  return Object.entries(progress.stats)
    .filter(([, s]) => s.seen > 0 && !s.lastCorrect)
    .sort((a, b) => b[1].lastAt - a[1].lastAt)
    .map(([id]) => Number(id));
}

export interface DragDropResult {
  correct: boolean;
  /** Target id -> whether the items placed there are exactly the accepted set. */
  perTarget: Record<string, boolean>;
}

export function gradeDragDrop(
  spec: DragDropSpec,
  placed: Record<string, string[]>,
): DragDropResult {
  const perTarget: Record<string, boolean> = {};
  let allOk = true;
  for (const t of spec.targets) {
    const ok = sameAnswer(placed[t.id] ?? [], t.accepts);
    perTarget[t.id] = ok;
    if (!ok) allOk = false;
  }
  return { correct: allOk, perTarget };
}

/**
 * The exam awards a point per correct row, but a session scores one point per question, so
 * a Yes/No grid counts as correct only when every row is right.
 */
export function gradeYesNo(spec: YesNoSpec, picks: Record<string, boolean>): boolean {
  return spec.statements.every((s) => picks[s.id] === s.answer);
}

export const yesNoAnswered = (spec: YesNoSpec, picks: Record<string, boolean>) =>
  spec.statements.every((s) => picks[s.id] !== undefined);

export const encodeYesNo = (picks: Record<string, boolean>): string[] =>
  Object.entries(picks).map(([id, v]) => `${id}:${v ? 'yes' : 'no'}`);

export function decodeYesNo(encoded: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const entry of encoded) {
    const sep = entry.indexOf(':');
    if (sep < 0) continue;
    const v = entry.slice(sep + 1);
    if (v === 'yes' || v === 'no') out[entry.slice(0, sep)] = v === 'yes';
  }
  return out;
}

export function gradeDropdown(spec: DropdownSpec, picks: Record<string, number>): boolean {
  return spec.fields.every((f) => picks[f.id] === f.answer);
}

export const dropdownAnswered = (spec: DropdownSpec, picks: Record<string, number>) =>
  spec.fields.every((f) => picks[f.id] !== undefined);

export const encodeDropdown = (picks: Record<string, number>): string[] =>
  Object.entries(picks).map(([id, i]) => `${id}:${i}`);

export function decodeDropdown(encoded: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of encoded) {
    const sep = entry.indexOf(':');
    if (sep < 0) continue;
    const n = Number(entry.slice(sep + 1));
    if (Number.isInteger(n)) out[entry.slice(0, sep)] = n;
  }
  return out;
}

/** Machine-graded interactive questions, whatever their shape. */
export function gradeInteractive(spec: InteractiveSpec, selected: readonly string[]): boolean {
  if (spec.kind === 'yesno') return gradeYesNo(spec, decodeYesNo(selected));
  if (spec.kind === 'dropdown') return gradeDropdown(spec, decodeDropdown(selected));
  return gradeDragDrop(spec, decodeDragAnswer(selected)).correct;
}

/**
 * Drag-and-drop answers are stored in the same `string[]` slot as multiple-choice keys so a
 * session persists uniformly. One entry per target: `targetId:itemA+itemB`.
 */
export const encodeDragAnswer = (placed: Record<string, string[]>): string[] =>
  Object.entries(placed).map(([target, items]) => `${target}:${items.join('+')}`);

export function decodeDragAnswer(encoded: readonly string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of encoded) {
    const sep = entry.indexOf(':');
    if (sep < 0) continue;
    const rest = entry.slice(sep + 1);
    out[entry.slice(0, sep)] = rest ? rest.split('+') : [];
  }
  return out;
}
