import type { ControlPermissionResponse, PendingControl, Question } from '@code-quest/schemas';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FloatingCard } from '@/components/chat/ui/FloatingCard';
import { ChevronDown } from '@/components/ui/Icons';
import { useChannelConfig } from '@/contexts/channel';
import { cn } from '@/utils/cn';
import { QuestionContent } from './QuestionContent.tsx';

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤'];

function isAskUserQuestion(
  input: Record<string, unknown>,
): input is Record<string, unknown> & { questions: Question[] } {
  return Array.isArray(input.questions) && input.questions.length > 0;
}

export function ToolPermissionCard({
  pending,
  onRespond,
}: {
  pending: PendingControl;
  onRespond: (response: ControlPermissionResponse) => void;
}): React.JSX.Element {
  const { providerConfig } = useChannelConfig();
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [denyMessage, setDenyMessage] = useState('');
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const input = pending.input ?? {};
  const [editedInput, setEditedInput] = useState<Record<string, unknown> | null>(null);
  const updatedInput = editedInput ?? input;

  const toolName = pending.toolName ?? 'Unknown';
  const hasInput = Object.keys(input).length > 0;
  const isQuestion = toolName === 'AskUserQuestion' && isAskUserQuestion(input);

  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);

  const handleAnswersChange = (answers: Record<string, string>, allAnswered: boolean) => {
    setQuestionAnswers(answers);
    setAllQuestionsAnswered(allAnswered);
  };

  const options = isQuestion
    ? [
        {
          label: 'Submit answers',
          action: () =>
            onRespond({
              behavior: 'allow',
              updatedInput: { ...input, answers: questionAnswers },
            }),
          disabled: !allQuestionsAnswered,
        },
      ]
    : [
        { label: 'Yes', action: () => onRespond({ behavior: 'allow', updatedInput }) },
        ...(pending.permissionSuggestions
          ? [
              {
                label: 'Yes, allow for this session',
                action: () =>
                  onRespond({
                    behavior: 'allow',
                    updatedInput,
                    updatedPermissions: pending.permissionSuggestions,
                  }),
              },
            ]
          : []),
        {
          label: 'No',
          action: () => {
            const msg = denyMessage.trim() || 'User denied this action';
            onRespond({ behavior: 'deny', message: msg, interrupt: false });
          },
        },
      ];

  const handleKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    handleKeyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onRespond({ behavior: 'deny', message: 'User cancelled', interrupt: false });
        return;
      }
      if (!isQuestion) {
        const num = Number(e.key);
        if (num >= 1 && num <= options.length) {
          e.preventDefault();
          options[num - 1]?.action();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIdx((i) => Math.min(i + 1, options.length));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIdx((i) => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
          e.preventDefault();
          if (focusedIdx < options.length) {
            options[focusedIdx]?.action();
          }
        }
      }
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyRef.current(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <FloatingCard
      as="fieldset"
      ref={containerRef}
      aria-label="Permission request"
      className="relative overflow-hidden mb-1.5 px-2 py-2 outline-none focus-within:border-accent/50"
      data-focused-index={focusedIdx}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-bg rounded-lg" />

      {/* Content */}
      <div className="relative z-raised text-text">
        {isQuestion ? (
          <QuestionContent questions={input.questions} onAnswersChange={handleAnswersChange} />
        ) : (
          <>
            <div className="font-bold text-sm mb-1">
              Do you want to proceed with <strong>{toolName}</strong>?
            </div>

            {/* Tool-specific content */}
            {toolName === 'Bash' && typeof input.command === 'string' && (
              <div className="mb-1">
                <div
                  className="text-xs bg-input-overlay rounded p-2 overflow-auto max-h-32 font-mono focus:outline-none focus:ring-1 focus:ring-accent/50"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onInput={(e) => {
                    const text = e.currentTarget.textContent ?? '';
                    setEditedInput({ ...input, command: text });
                  }}
                >
                  {input.command}
                </div>
                {typeof input.description === 'string' && (
                  <p className="text-xs text-subtle mt-1">{input.description}</p>
                )}
              </div>
            )}

            {/* Collapsible details */}
            {hasInput && (
              <div className="text-xs text-muted mb-1.5">
                <details>
                  <summary className="cursor-pointer select-none inline-flex items-center gap-1">
                    <span>Details</span>
                    <ChevronDown className="w-3 h-3 shrink-0 transition-transform [details[open]>&]:rotate-180" />
                  </summary>
                  <pre className="mt-2 p-2 text-xs font-mono bg-input-overlay border border-border rounded overflow-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="relative z-raised flex flex-col gap-2 mt-2">
        {options.map((opt, i) => {
          const isLast = i === options.length - 1;
          return (
            <div key={opt.label} className={cn(isLast && !isQuestion && 'flex flex-col gap-2')}>
              <button
                type="button"
                onClick={opt.action}
                disabled={'disabled' in opt ? opt.disabled : false}
                onMouseEnter={() => setFocusedIdx(i)}
                className={cn(
                  'w-full text-left text-xs px-2 py-1.5 rounded border-0 cursor-pointer font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  i === focusedIdx
                    ? 'bg-accent text-selected-text font-bold'
                    : 'bg-transparent text-text inset-border',
                )}
              >
                <span className="opacity-60 pr-1">{CIRCLED_NUMBERS[i]}</span> {opt.label}
              </button>
              {/* Reject input — grouped with No button, hidden for AskUserQuestion */}
              {isLast && !isQuestion && (
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Tell ${providerConfig?.brand.name ?? 'Claude'} what to do instead`}
                  value={denyMessage}
                  onChange={(e) => setDenyMessage(e.target.value)}
                  onMouseEnter={() => setFocusedIdx(options.length)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && denyMessage.trim()) {
                      e.stopPropagation();
                      onRespond({
                        behavior: 'deny',
                        message: denyMessage.trim(),
                        interrupt: false,
                      });
                    }
                  }}
                  className={cn(
                    'w-full text-xs bg-transparent rounded px-2 py-1.5 text-text placeholder:text-subtle focus:outline-none',
                    focusedIdx === options.length
                      ? 'border border-accent/50'
                      : 'border border-transparent inset-border',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard hint */}
      <div className="relative z-raised text-xs text-subtle mt-2">Esc to cancel</div>
    </FloatingCard>
  );
}
