import type { Question } from '@code-quest/schemas';
import { useRef, useState } from 'react';
import { TextField } from '@/components/chat/ui/TextField';
import { CheckMark } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

function CheckIndicator({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'w-3.5 h-3.5 rounded-sm border flex items-center justify-center',
        checked ? 'bg-accent border-accent' : 'border-text-muted/40',
      )}
    >
      {checked && (
        <span className="text-selected-text">
          <CheckMark className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}

function RadioIndicator({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'w-3.5 h-3.5 rounded-full border flex items-center justify-center',
        checked ? 'border-accent' : 'border-text-muted/40',
      )}
    >
      {checked && <div className="w-2 h-2 rounded-full bg-accent" />}
    </div>
  );
}

function OptionItem({
  label,
  description,
  selected,
  multiSelect,
  onSelect,
  onKeySelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  multiSelect: boolean;
  onSelect: () => void;
  onKeySelect: (e: React.KeyboardEvent) => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: matches extension — div with role
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: dynamic role checkbox/radio
    <div
      role={multiSelect ? 'checkbox' : 'radio'}
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKeySelect}
      className={cn(
        'flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer text-xs',
        selected ? 'bg-accent/10' : 'hover:bg-hover-tint',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {multiSelect ? (
          <CheckIndicator checked={selected} />
        ) : (
          <RadioIndicator checked={selected} />
        )}
      </div>
      <div>
        <div className="text-text">{label}</div>
        {description && <div className="text-muted text-xs">{description}</div>}
      </div>
    </div>
  );
}

function buildAnswers(
  questions: Question[],
  selections: Record<string, Set<string>>,
  otherTexts: Record<string, string>,
): { answers: Record<string, string>; allAnswered: boolean } {
  const allAnswered = questions.every((q) => {
    const sel = selections[q.question];
    if (!sel || sel.size === 0) return false;
    if (sel.has('Other') && !(otherTexts[q.question] ?? '').trim()) return false;
    return true;
  });
  const answers = Object.fromEntries(
    questions.map((q) => {
      const sel = selections[q.question];
      if (!sel || sel.size === 0) return [q.question, ''];
      if (sel.has('Other')) {
        const other = otherTexts[q.question] ?? '';
        if (q.multiSelect) {
          const normal = [...sel].filter((s) => s !== 'Other');
          return [q.question, [...normal, other].filter(Boolean).join(', ')];
        }
        return [q.question, other];
      }
      return [q.question, [...sel].join(', ')];
    }),
  );
  return { answers, allAnswered };
}

export function QuestionContent({
  questions,
  onAnswersChange,
}: {
  questions: Question[];
  onAnswersChange: (answers: Record<string, string>, allAnswered: boolean) => void;
}): React.ReactNode {
  const [activeTab, setActiveTab] = useState(0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const otherInputRef = useRef<HTMLInputElement>(null);

  function notifyAnswers(
    nextSelections: Record<string, Set<string>>,
    nextOtherTexts: Record<string, string>,
  ) {
    const { answers, allAnswered } = buildAnswers(questions, nextSelections, nextOtherTexts);
    onAnswersChange(answers, allAnswered);
  }

  const handleSelect = (questionText: string, value: string, multiSelect: boolean) => {
    const current = selections[questionText] ?? new Set<string>();
    const next = new Set(current);
    if (multiSelect) {
      if (next.has(value)) next.delete(value);
      else next.add(value);
    } else {
      next.clear();
      next.add(value);
    }
    if (value === 'Other') {
      setTimeout(() => otherInputRef.current?.focus(), 0);
    }
    const nextSelections = { ...selections, [questionText]: next };
    setSelections(nextSelections);
    notifyAnswers(nextSelections, otherTexts);
  };

  const handleOtherText = (questionText: string, text: string) => {
    const nextOtherTexts = { ...otherTexts, [questionText]: text };
    setOtherTexts(nextOtherTexts);
    notifyAnswers(selections, nextOtherTexts);
  };

  const currentQuestion = questions[activeTab];
  if (!currentQuestion) return null;

  const isSelected = (label: string) => selections[currentQuestion.question]?.has(label) ?? false;

  const handleKeySelect = (value: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(currentQuestion.question, value, currentQuestion.multiSelect);
    }
  };

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex items-center gap-2 mb-3 -mt-1" role="tablist">
        {questions.map((q, i) => {
          const isActive = i === activeTab;
          const isAnswered = (selections[q.question]?.size ?? 0) > 0;
          return (
            <button
              key={q.header}
              type="button"
              role="tab"
              aria-label={q.header}
              aria-selected={isActive}
              data-answered={isAnswered ? 'true' : undefined}
              onClick={() => setActiveTab(i)}
              className={cn(
                'text-xs font-medium bg-transparent border-0 border-b-2 cursor-pointer px-0.5 py-1 min-w-0 truncate',
                isActive ? 'text-text border-accent' : 'text-muted border-transparent',
              )}
            >
              {q.header}
            </button>
          );
        })}
      </div>

      {/* Current question */}
      <div className="text-sm font-medium text-text mb-2">{currentQuestion.question}</div>

      {/* Options */}
      <div className="flex flex-col gap-1">
        {currentQuestion.options.map((opt) => (
          <OptionItem
            key={opt.label}
            label={opt.label}
            description={opt.description}
            selected={isSelected(opt.label)}
            multiSelect={currentQuestion.multiSelect}
            onSelect={() =>
              handleSelect(currentQuestion.question, opt.label, currentQuestion.multiSelect)
            }
            onKeySelect={handleKeySelect(opt.label)}
          />
        ))}

        {/* Other option */}
        <OptionItem
          label="Other"
          selected={isSelected('Other')}
          multiSelect={currentQuestion.multiSelect}
          onSelect={() =>
            handleSelect(currentQuestion.question, 'Other', currentQuestion.multiSelect)
          }
          onKeySelect={handleKeySelect('Other')}
        />

        {isSelected('Other') && (
          <TextField
            inputRef={otherInputRef}
            placeholder="Type your answer..."
            value={otherTexts[currentQuestion.question] ?? ''}
            onChange={(v) => handleOtherText(currentQuestion.question, v)}
            className="text-xs ml-6"
          />
        )}
      </div>
    </div>
  );
}
