export type Topic = 'mixed' | 'identity' | 'storage' | 'compute' | 'networking' | 'monitor';

/** How the question is answered. `reveal` questions are graded by the learner. */
export type QuestionType = 'single' | 'multi' | 'reveal';

/** How the question was presented in the original exam. */
export type QuestionFormat = 'standard' | 'hotspot' | 'dragdrop' | 'simulation';

export interface Option {
  key: string;
  text: string;
}

export interface Question {
  id: number;
  topic: Topic;
  type: QuestionType;
  format: QuestionFormat;
  /** Stem, already re-flowed into paragraphs. */
  text: string[];
  options: Option[];
  /** Option keys that are correct. Empty for `reveal` questions. */
  answer: string[];
  explanation: string;
  references: string[];
  /** Exhibit screenshots shown with the question. */
  images: string[];
  /** Answer-key screenshots, hidden until the answer is revealed. */
  answerImages: string[];
  page: number;
  /** Present only for questions upgraded to a playable drag-and-drop. */
  interactive?: DragDropSpec;
}

/**
 * An exam-style "drag the item onto the target" question. Authored in
 * data/interactive.json for questions whose answer key is otherwise just a screenshot.
 */
export interface DragDropSpec {
  kind: 'dragdrop';
  /** Prompt shown above the board, e.g. "Drag each action to the right step". */
  prompt?: string;
  /** The pool of draggable items. */
  items: { id: string; label: string }[];
  /** Ordered drop targets. `accepts` lists the item ids that are correct here. */
  targets: { id: string; label: string; accepts: string[] }[];
  /** When true, every item must be placed; otherwise the pool may hold distractors. */
  exhaustive?: boolean;
}

export type Lang = 'fr' | 'en';

/** Per-question French text, keyed by question id. Missing entries fall back to English. */
export interface Translation {
  text?: string[];
  options?: Record<string, string>;
  explanation?: string;
  /** French labels for a hand-authored drag-and-drop, keyed by item / target id. */
  interactive?: {
    prompt?: string;
    items?: Record<string, string>;
    targets?: Record<string, string>;
  };
}

export type TranslationMap = Record<string, Translation>;

/** What the learner did on one question, in one attempt. */
export interface AnswerRecord {
  questionId: number;
  selected: string[];
  correct: boolean;
  /** True when the learner graded themselves (reveal questions). */
  selfGraded: boolean;
  at: number;
}

export type Mode = 'practice' | 'exam';

export interface ExamConfig {
  count: number;
  minutes: number;
  topics: Topic[];
}

export interface SessionState {
  mode: Mode;
  questionIds: number[];
  index: number;
  answers: Record<number, AnswerRecord>;
  flagged: number[];
  startedAt: number;
  /** Exam only: wall-clock deadline. */
  endsAt?: number;
  finishedAt?: number;
  config: ExamConfig;
}

/** Long-lived per-question statistics, persisted across sessions. */
export interface QuestionStat {
  seen: number;
  correct: number;
  wrong: number;
  lastAt: number;
  lastCorrect: boolean;
}

export interface Progress {
  stats: Record<number, QuestionStat>;
  bookmarks: number[];
  /** Completed exam sessions, most recent first. */
  history: { at: number; score: number; total: number; minutes: number }[];
}
