import type { Lang, Topic } from '../types';

/**
 * UI strings. Both locales are always complete — question *content* is a separate,
 * partially-translated layer (see lib/data.ts).
 */
const DICT = {
  appName: { fr: 'AZ-104 Trainer', en: 'AZ-104 Trainer' },
  tagline: {
    fr: 'Préparez la certification Microsoft Azure Administrator',
    en: 'Prepare for the Microsoft Azure Administrator certification',
  },

  // Home
  practiceMode: { fr: 'Mode entraînement', en: 'Practice mode' },
  practiceDesc: {
    fr: 'Une question à la fois, avec correction et explication immédiates.',
    en: 'One question at a time, with instant grading and explanation.',
  },
  examMode: { fr: 'Mode examen', en: 'Exam mode' },
  examDesc: {
    fr: 'Une série de questions chronométrée, corrigée à la fin.',
    en: 'A timed run of questions, graded once you submit.',
  },
  reviewMode: { fr: 'Réviser mes erreurs', en: 'Review my mistakes' },
  reviewDesc: {
    fr: 'Rejouez uniquement les questions que vous avez ratées.',
    en: 'Replay only the questions you got wrong.',
  },
  bookmarksMode: { fr: 'Questions marquées', en: 'Bookmarked questions' },
  bookmarksDesc: {
    fr: 'Rejouez les questions que vous avez mises de côté.',
    en: 'Replay the questions you set aside.',
  },
  start: { fr: 'Commencer', en: 'Start' },
  resume: { fr: 'Reprendre', en: 'Resume' },
  resumeSession: { fr: 'Session en cours', en: 'Session in progress' },
  discard: { fr: 'Abandonner', en: 'Discard' },

  // Setup
  domains: { fr: 'Domaines', en: 'Domains' },
  allDomains: { fr: 'Tous les domaines', en: 'All domains' },
  questionCount: { fr: 'Nombre de questions', en: 'Number of questions' },
  duration: { fr: 'Durée', en: 'Duration' },
  minutes: { fr: 'min', en: 'min' },
  shuffle: { fr: 'Mélanger les réponses', en: 'Shuffle answers' },
  prioritiseWeak: { fr: "Prioriser mes points faibles", en: 'Prioritise my weak spots' },
  prioritiseWeakHint: {
    fr: 'Place en tête les questions jamais vues ou ratées.',
    en: 'Puts unseen and previously-missed questions first.',
  },

  // Quiz
  question: { fr: 'Question', en: 'Question' },
  of: { fr: 'sur', en: 'of' },
  validate: { fr: 'Valider', en: 'Check' },
  next: { fr: 'Suivant', en: 'Next' },
  previous: { fr: 'Précédent', en: 'Previous' },
  finish: { fr: 'Terminer', en: 'Finish' },
  submitExam: { fr: "Terminer l'examen", en: 'Submit exam' },
  skip: { fr: 'Passer', en: 'Skip' },
  flag: { fr: 'Marquer', en: 'Flag' },
  flagged: { fr: 'Marquée', en: 'Flagged' },
  bookmark: { fr: 'Mettre de côté', en: 'Bookmark' },
  bookmarked: { fr: 'Mise de côté', en: 'Bookmarked' },
  correct: { fr: 'Correct', en: 'Correct' },
  incorrect: { fr: 'Incorrect', en: 'Incorrect' },
  correctAnswer: { fr: 'Bonne réponse', en: 'Correct answer' },
  yourAnswer: { fr: 'Votre réponse', en: 'Your answer' },
  explanation: { fr: 'Explication', en: 'Explanation' },
  references: { fr: 'Références', en: 'References' },
  noExplanation: {
    fr: "Le corrigé de cette question est fourni sous forme d'image.",
    en: 'The answer key for this question is provided as an image.',
  },
  selectAll: { fr: 'Sélectionnez toutes les réponses correctes.', en: 'Select all correct answers.' },
  selectOne: { fr: 'Sélectionnez une réponse.', en: 'Select one answer.' },
  exhibit: { fr: 'Énoncé (capture)', en: 'Exhibit' },
  answerKey: { fr: 'Corrigé (capture)', en: 'Answer key' },

  // Reveal / self-graded
  revealHint: {
    fr: "Question interactive de l'examen (zone active / glisser-déposer). Répondez mentalement ou sur papier, puis affichez le corrigé.",
    en: 'Interactive exam question (hot area / drag and drop). Answer it in your head or on paper, then reveal the key.',
  },
  showAnswer: { fr: 'Afficher le corrigé', en: 'Reveal the answer' },
  selfGrade: { fr: 'Aviez-vous juste ?', en: 'Did you get it right?' },
  iWasRight: { fr: "J'avais juste", en: 'I was right' },
  iWasWrong: { fr: "J'avais faux", en: 'I was wrong' },

  // Drag and drop
  dragHint: {
    fr: 'Glissez chaque élément vers la bonne cible.',
    en: 'Drag each item onto the right target.',
  },
  dragPool: { fr: 'Éléments', en: 'Items' },
  dragTargets: { fr: 'Zone de réponse', en: 'Answer area' },
  dropHere: { fr: 'Déposer ici', en: 'Drop here' },

  // Yes / No statement grid
  yesNoHint: {
    fr: "Pour chaque affirmation, choisissez Oui si elle est vraie, sinon Non.",
    en: 'For each statement, select Yes if it is true, otherwise No.',
  },
  statements: { fr: 'Affirmations', en: 'Statements' },
  yes: { fr: 'Oui', en: 'Yes' },
  no: { fr: 'Non', en: 'No' },

  // Drop-down answer area
  dropdownHint: {
    fr: 'Choisissez la bonne réponse dans chaque menu déroulant.',
    en: 'Pick the right answer in each drop-down menu.',
  },
  choose: { fr: '— Choisir —', en: '— Choose —' },
  reset: { fr: 'Réinitialiser', en: 'Reset' },

  // Results
  results: { fr: 'Résultats', en: 'Results' },
  score: { fr: 'Score', en: 'Score' },
  passed: { fr: 'Réussi', en: 'Passed' },
  failed: { fr: 'Échoué', en: 'Failed' },
  passMarkNote: {
    fr: 'Le seuil officiel AZ-104 est de 700/1000, soit environ 70 %.',
    en: 'The official AZ-104 pass mark is 700/1000, roughly 70%.',
  },
  timeSpent: { fr: 'Temps passé', en: 'Time spent' },
  byDomain: { fr: 'Par domaine', en: 'By domain' },
  reviewAnswers: { fr: 'Revoir les questions', en: 'Review the questions' },
  backHome: { fr: "Retour à l'accueil", en: 'Back to home' },
  retryWrong: { fr: 'Rejouer mes erreurs', en: 'Retry my mistakes' },
  unanswered: { fr: 'Sans réponse', en: 'Unanswered' },
  selfGradedNote: {
    fr: 'Questions auto-évaluées incluses dans le score.',
    en: 'Self-graded questions are included in the score.',
  },

  // Progress
  progress: { fr: 'Progression', en: 'Progress' },
  answered: { fr: 'Répondu', en: 'Answered' },
  mastery: { fr: 'Maîtrise', en: 'Mastery' },
  totalQuestions: { fr: 'Questions au total', en: 'Total questions' },
  attempts: { fr: 'Tentatives', en: 'Attempts' },
  lastExams: { fr: 'Derniers examens', en: 'Recent exams' },
  resetProgress: { fr: 'Réinitialiser ma progression', en: 'Reset my progress' },
  resetConfirm: {
    fr: 'Effacer toute votre progression et vos marque-pages ?',
    en: 'Erase all your progress and bookmarks?',
  },
  noProgress: { fr: 'Aucune donnée pour le moment.', en: 'Nothing recorded yet.' },

  // Misc
  loading: { fr: 'Chargement…', en: 'Loading…' },
  loadError: { fr: 'Impossible de charger les questions.', en: 'Could not load the questions.' },
  retry: { fr: 'Réessayer', en: 'Retry' },
  timeLeft: { fr: 'Temps restant', en: 'Time left' },
  timeUp: { fr: 'Temps écoulé', en: "Time's up" },
  quit: { fr: 'Quitter', en: 'Quit' },
  quitConfirm: {
    fr: 'Quitter la session en cours ? Votre progression sur cette session sera perdue.',
    en: 'Leave this session? Your progress in it will be lost.',
  },
  theme: { fr: 'Thème', en: 'Theme' },
  untranslated: { fr: 'EN', en: 'EN' },
  untranslatedHint: {
    fr: "Cette question n'est pas encore traduite, elle est affichée en anglais.",
    en: 'Shown in English.',
  },
  keyboardHint: {
    fr: 'Raccourcis : 1-6 pour choisir, Entrée pour valider / continuer.',
    en: 'Shortcuts: 1-6 to pick, Enter to check / continue.',
  },
  hotspotBadge: { fr: 'Zone active', en: 'Hot area' },
  dragdropBadge: { fr: 'Glisser-déposer', en: 'Drag and drop' },
  multiBadge: { fr: 'Réponses multiples', en: 'Multiple answers' },
  jumpTo: { fr: 'Aller à la question', en: 'Jump to question' },
  noQuestions: {
    fr: 'Aucune question ne correspond à ces filtres.',
    en: 'No question matches these filters.',
  },
} as const;

export type StringKey = keyof typeof DICT;

const TOPIC_LABELS: Record<Topic, { fr: string; en: string }> = {
  mixed: { fr: 'Questions mixtes', en: 'Mixed questions' },
  identity: { fr: 'Identités et gouvernance', en: 'Identity and governance' },
  storage: { fr: 'Stockage', en: 'Storage' },
  compute: { fr: 'Calcul (compute)', en: 'Compute' },
  networking: { fr: 'Réseau virtuel', en: 'Virtual networking' },
  monitor: { fr: 'Supervision et maintenance', en: 'Monitoring and maintenance' },
};

export const TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

export function makeT(lang: Lang) {
  return (key: StringKey): string => DICT[key][lang];
}

export const topicLabel = (topic: Topic, lang: Lang) => TOPIC_LABELS[topic][lang];

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
