import type {
  ControlPermissionResponse,
  PendingControl,
  PlanCommentData,
} from '@code-quest/schemas';
import { planInputSchema } from '@code-quest/schemas';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FloatingCard } from '@/components/chat/ui/FloatingCard';
import { useChannelMessages } from '@/contexts/channel';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import { cn } from '@/utils/cn';
import { pluralize } from '@/utils/pluralize';
import { MarkdownContent } from '../renderers/MarkdownContent.tsx';
import { PlanCommentPopover } from './PlanCommentPopover.tsx';

const DEFAULT_FEEDBACK_MESSAGE = 'User chose to stay in plan mode and continue planning';

const formatComment = (c: PlanCommentData) => `[On "${c.selectedText}"]: ${c.comment}`;

interface PlanReviewBannerProps {
  pending: PendingControl;
  onRespond: (response: ControlPermissionResponse) => void;
}

export function PlanReviewBanner({ pending, onRespond }: PlanReviewBannerProps): React.JSX.Element {
  const parsed = useMemo(() => planInputSchema.safeParse(pending.input), [pending.input]);
  const plan = parsed.data?.plan;
  const allowedPrompts = parsed.data?.allowedPrompts;
  const [comment, setComment] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const planContentRef = useRef<HTMLDivElement>(null);
  const planComments = useChannelStore((s) => s.planComments);
  const { addPlanComment, clearPlanComments } = useChannelMessages();

  // biome-ignore lint/correctness/useExhaustiveDependencies: requestId is the trigger, not a consumed value
  useEffect(() => {
    setComment('');
    setFeedbackOpen(false);
  }, [pending.requestId]);

  const handleApprove = () => {
    const userFeedback =
      planComments.length > 0 ? planComments.map(formatComment).join('\n') : undefined;
    clearPlanComments();
    onRespond({
      behavior: 'allow',
      updatedInput: pending.input ?? {},
      ...(userFeedback !== undefined ? { userFeedback } : {}),
    });
  };

  const handleSendFeedback = () => {
    const trimmedComment = comment.trim();
    const commentParts = [
      ...(trimmedComment ? [trimmedComment] : []),
      ...planComments.map(formatComment),
    ];
    clearPlanComments();
    setFeedbackOpen(false);
    onRespond({
      behavior: 'deny',
      message: commentParts.join('\n') || DEFAULT_FEEDBACK_MESSAGE,
      interrupt: false,
    });
  };

  const actions = feedbackOpen
    ? [
        {
          label: 'Cancel',
          action: () => {
            setComment('');
            setFeedbackOpen(false);
          },
          primary: false,
        },
        { label: 'Send Feedback', action: handleSendFeedback, primary: true },
      ]
    : [
        { label: 'Continue Planning', action: () => setFeedbackOpen(true), primary: false },
        { label: 'Approve Plan', action: handleApprove, primary: true },
      ];

  return (
    <FloatingCard className="relative overflow-hidden mb-1.5 px-2 py-2">
      <div className="absolute inset-0 bg-bg rounded-lg" />

      <div className="relative z-raised text-text">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <ClipboardDocumentListIcon className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-sm font-bold">Plan Review</span>
          {planComments.length > 0 && (
            <span className="text-xs text-accent font-normal ml-1">
              ({pluralize(planComments.length, 'comment')})
            </span>
          )}
        </div>

        {plan && (
          <div
            ref={planContentRef}
            className="relative bg-input-overlay rounded p-2 border border-border mb-2 prose prose-invert prose-sm max-w-none"
          >
            <MarkdownContent content={plan} />
            <PlanCommentPopover containerRef={planContentRef} onAddComment={addPlanComment} />
          </div>
        )}

        {allowedPrompts && allowedPrompts.length > 0 && (
          <div className="text-xs text-muted px-1 mb-2">
            <span className="font-medium">Requested permissions: </span>
            {allowedPrompts.map((p) => {
              const label = String(p.prompt ?? p.tool ?? JSON.stringify(p));
              return (
                <span
                  key={label}
                  className="inline-block bg-hover-tint rounded px-1.5 py-0.5 mr-1 mt-0.5"
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}

        {feedbackOpen && (
          <textarea
            placeholder="Add feedback..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full text-xs bg-input-overlay rounded px-2 py-1.5 text-text border border-border resize-y mb-2"
            // biome-ignore lint/a11y/noAutofocus: focus is intentional when expanding inline
            autoFocus
          />
        )}
      </div>

      <div className="relative z-raised flex flex-col gap-2">
        {actions.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={opt.action}
            className={cn(
              'w-full text-left text-xs px-2 py-1.5 rounded cursor-pointer font-medium transition-colors',
              opt.primary
                ? 'bg-accent text-selected-text font-bold'
                : 'bg-transparent text-text inset-border',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </FloatingCard>
  );
}
