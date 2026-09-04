import { useEffect, useMemo, useState } from 'react';
import type { Lang, Question, TranslationMap } from '../types';
import { localise } from '../lib/data';
import { makeT, topicLabel } from '../lib/i18n';
import {
  decodeDragAnswer, decodeDropdown, decodeYesNo, dropdownAnswered, encodeDragAnswer,
  encodeDropdown, encodeYesNo, gradeDragDrop, gradeDropdown, gradeYesNo, shuffle,
  yesNoAnswered,
} from '../lib/quiz';
import { Badge, Exhibit, Explanation } from './ui';
import { DragDrop } from './DragDrop';
import { YesNo } from './YesNo';
import { Dropdown } from './Dropdown';

export interface QuestionCardProps {
  question: Question;
  lang: Lang;
  translations: TranslationMap;
  /** Practice grades immediately; exam defers all feedback to the results screen. */
  showFeedback: boolean;
  shuffleOptions: boolean;
  selected: string[];
  revealed: boolean;
  onSelect: (keys: string[]) => void;
  /** Practice mode: the learner checked their answer. */
  onCheck: (correct: boolean) => void;
  /** Reveal questions: the learner graded themselves. */
  onSelfGrade: (correct: boolean) => void;
  /** Read-only rendering for the post-exam review. */
  readOnly?: boolean;
}

export function QuestionCard(props: QuestionCardProps) {
  const {
    question: q, lang, translations, showFeedback, shuffleOptions,
    selected, revealed, onSelect, onCheck, onSelfGrade, readOnly,
  } = props;
  const t = makeT(lang);
  const loc = useMemo(() => localise(q, lang, translations), [q, lang, translations]);
  const [dragPlacement, setDragPlacement] = useState<Record<string, string[]>>(() =>
    decodeDragAnswer(selected),
  );
  const [yesNoPicks, setYesNoPicks] = useState<Record<string, boolean>>(() => decodeYesNo(selected));
  const [dropdownPicks, setDropdownPicks] = useState<Record<string, number>>(() => decodeDropdown(selected));

  useEffect(() => {
    setDragPlacement(decodeDragAnswer(selected));
    setYesNoPicks(decodeYesNo(selected));
    setDropdownPicks(decodeDropdown(selected));
  }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shuffling is keyed on the question so the order is stable while it is on screen.
  const options = useMemo(
    () => (shuffleOptions ? shuffle(loc.options) : loc.options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.id, shuffleOptions, loc.options],
  );

  const locked = revealed || readOnly;
  const isMulti = q.type === 'multi';
  const isReveal = q.type === 'reveal';
  const spec = loc.interactive;
  const dragSpec = spec?.kind === 'dragdrop' ? spec : undefined;
  const yesNoSpec = spec?.kind === 'yesno' ? spec : undefined;
  const dropdownSpec = spec?.kind === 'dropdown' ? spec : undefined;

  const toggle = (key: string) => {
    if (locked) return;
    if (isMulti) onSelect(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
    else onSelect([key]);
  };

  // Keyboard: 1-6 pick an option, Enter checks. Only while the card is live.
  useEffect(() => {
    if (locked || isReveal || spec) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        toggle(options[n - 1].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const correctSet = new Set(q.answer);
  const dragResult = dragSpec && revealed ? gradeDragDrop(dragSpec, dragPlacement) : undefined;
  const wasCorrect = spec
    ? yesNoSpec
      ? gradeYesNo(yesNoSpec, yesNoPicks)
      : dropdownSpec
        ? gradeDropdown(dropdownSpec, dropdownPicks)
        : Boolean(dragResult?.correct)
    : revealed && !isReveal && selected.length === q.answer.length && selected.every((k) => correctSet.has(k));
  // Self-graded questions state their own verdict; everything else gets a banner.
  const showVerdict = revealed && (Boolean(spec) || !isReveal);

  return (
    <article className="card animate-fade-up p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="blue">{topicLabel(q.topic, lang)}</Badge>
        {q.format === 'hotspot' && <Badge tone="amber">{t('hotspotBadge')}</Badge>}
        {q.format === 'dragdrop' && <Badge tone="amber">{t('dragdropBadge')}</Badge>}
        {isMulti && <Badge tone="slate">{t('multiBadge')}</Badge>}
        {!loc.translated && lang === 'fr' && (
          <span title={t('untranslatedHint')}>
            <Badge tone="slate">{t('untranslated')}</Badge>
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">#{q.id}</span>
      </header>

      <div className="prose-stem text-[0.95rem] leading-relaxed text-slate-800 dark:text-slate-200">
        {loc.text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {q.images.length > 0 && (
        <div className="mt-4">
          <Exhibit files={q.images} label={t('exhibit')} />
        </div>
      )}

      {dropdownSpec ? (
        <>
          <Dropdown
            spec={dropdownSpec}
            lang={lang}
            value={dropdownPicks}
            revealed={Boolean(locked)}
            onChange={(picks) => {
              setDropdownPicks(picks);
              onSelect(encodeDropdown(picks));
            }}
          />
          {!locked && !readOnly && showFeedback && (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={!dropdownAnswered(dropdownSpec, dropdownPicks)}
              onClick={() => onCheck(gradeDropdown(dropdownSpec, dropdownPicks))}
            >
              {t('validate')}
            </button>
          )}
        </>
      ) : yesNoSpec ? (
        <>
          <YesNo
            spec={yesNoSpec}
            lang={lang}
            value={yesNoPicks}
            revealed={Boolean(locked)}
            onChange={(picks) => {
              setYesNoPicks(picks);
              // Encoded so the session persists a grid answer like any other.
              onSelect(encodeYesNo(picks));
            }}
          />
          {!locked && !readOnly && showFeedback && (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={!yesNoAnswered(yesNoSpec, yesNoPicks)}
              onClick={() => onCheck(gradeYesNo(yesNoSpec, yesNoPicks))}
            >
              {t('validate')}
            </button>
          )}
        </>
      ) : dragSpec ? (
        <div className="mt-5">
          <DragDrop
            key={q.id}
            spec={dragSpec}
            lang={lang}
            revealed={Boolean(locked)}
            initialPlaced={dragPlacement}
            perTarget={dragResult?.perTarget}
            onChange={(placed) => {
              setDragPlacement(placed);
              // Encoded so the session persists a drag answer like any other.
              onSelect(encodeDragAnswer(placed));
            }}
          />
          {!locked && !readOnly && showFeedback && (
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => onCheck(gradeDragDrop(dragSpec, dragPlacement).correct)}
            >
              {t('validate')}
            </button>
          )}
        </div>
      ) : isReveal ? (
        <RevealBody q={q} lang={lang} revealed={Boolean(revealed)} readOnly={readOnly} onSelfGrade={onSelfGrade} onCheck={onCheck} explanation={loc.explanation} />
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            {isMulti ? t('selectAll') : t('selectOne')}
          </p>
          <ul className="mt-2 space-y-2">
            {options.map((o, i) => {
              const picked = selected.includes(o.key);
              const isRight = correctSet.has(o.key);
              let cls = 'border-slate-200 bg-white hover:border-azure-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-azure-600';
              if (picked && !revealed) cls = 'border-azure-500 bg-azure-50 dark:border-azure-500 dark:bg-azure-950/50';
              if (revealed && isRight) cls = 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40';
              else if (revealed && picked) cls = 'border-rose-500 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/40';
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    disabled={Boolean(locked)}
                    aria-pressed={picked}
                    onClick={() => toggle(o.key)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-default ${cls}`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        revealed && isRight
                          ? 'bg-emerald-600 text-white'
                          : revealed && picked
                            ? 'bg-rose-600 text-white'
                            : picked
                              ? 'bg-azure-600 text-white'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {o.key}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">{o.text}</span>
                    {!locked && (
                      <span className="ml-auto hidden shrink-0 text-[10px] text-slate-400 sm:block">{i + 1}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {!locked && showFeedback && (
            <button
              type="button"
              className="btn-primary mt-4"
              disabled={!selected.length}
              onClick={() => onCheck(selected.length === q.answer.length && selected.every((k) => correctSet.has(k)))}
            >
              {t('validate')}
            </button>
          )}
        </>
      )}

      {showVerdict && (
        <div className={`mt-5 rounded-lg p-4 ${wasCorrect ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}`}>
          <p className={`text-sm font-semibold ${wasCorrect ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'}`}>
            {wasCorrect ? `✓ ${t('correct')}` : `✕ ${t('incorrect')}`}
            {/* The drag board lists its own answer key, so only MCQs spell the keys out. */}
            {!wasCorrect && !spec && (
              <span className="ml-2 font-normal">{t('correctAnswer')} : {q.answer.join(', ')}</span>
            )}
          </p>
        </div>
      )}

      {revealed && (!isReveal || spec) && <AnswerDetail q={q} lang={lang} explanation={loc.explanation} />}
    </article>
  );
}

function RevealBody({
  q, lang, revealed, readOnly, onSelfGrade, onCheck, explanation,
}: {
  q: Question;
  lang: Lang;
  revealed: boolean;
  readOnly?: boolean;
  onSelfGrade: (c: boolean) => void;
  onCheck: (c: boolean) => void;
  explanation: string;
}) {
  const t = makeT(lang);
  return (
    <div className="mt-4 space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {t('revealHint')}
      </p>

      {!revealed && !readOnly && (
        <button type="button" className="btn-primary" onClick={() => onCheck(false)}>
          {t('showAnswer')}
        </button>
      )}

      {revealed && (
        <>
          <Exhibit files={q.answerImages} label={t('answerKey')} />
          <AnswerDetail q={q} lang={lang} explanation={explanation} showImages={false} />
          {!readOnly && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{t('selfGrade')}</p>
              <div className="flex gap-2">
                <button type="button" className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onSelfGrade(true)}>
                  ✓ {t('iWasRight')}
                </button>
                <button type="button" className="btn bg-rose-600 text-white hover:bg-rose-700" onClick={() => onSelfGrade(false)}>
                  ✕ {t('iWasWrong')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnswerDetail({ q, lang, explanation, showImages = true }: { q: Question; lang: Lang; explanation: string; showImages?: boolean }) {
  const t = makeT(lang);
  const hasAnswerImages = showImages && q.answerImages.length > 0;
  if (!explanation && !q.references.length && !hasAnswerImages) return null;
  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      {hasAnswerImages && <Exhibit files={q.answerImages} label={t('answerKey')} />}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('explanation')}
        </p>
        {explanation ? (
          <Explanation text={explanation} />
        ) : (
          <p className="text-sm italic text-slate-500 dark:text-slate-400">{t('noExplanation')}</p>
        )}
      </div>
      {q.references.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('references')}
          </p>
          <ul className="space-y-1">
            {q.references.map((r) => (
              <li key={r}>
                <a
                  href={r}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all text-xs text-azure-700 underline underline-offset-2 hover:text-azure-900 dark:text-azure-400 dark:hover:text-azure-300"
                >
                  {r}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
