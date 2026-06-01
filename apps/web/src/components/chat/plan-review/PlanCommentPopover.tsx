import type { PlanCommentData } from '@code-quest/schemas';
import * as Popover from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { Button } from '@/components/ui/Button';

interface PlanCommentPopoverProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onAddComment: (comment: PlanCommentData) => void;
}

const MAX_QUOTE_LENGTH = 50;

export function PlanCommentPopover({
  containerRef,
  onAddComment,
}: PlanCommentPopoverProps): React.JSX.Element {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Radix Popover.Anchor virtualRef — its getBoundingClientRect is read on
   *  every reposition, so we just point it at the live Range and Radix
   *  handles the rest (flip/shift/scroll updates). */
  const anchorRef = useRef<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect: () => new DOMRect(),
  });

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelectedText(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelectedText(null);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setSelectedText(null);
      return;
    }

    anchorRef.current = { getBoundingClientRect: () => range.getBoundingClientRect() };
    setSelectedText(text);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleMouseUp stable via React Compiler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [containerRef]);

  useEffect(() => {
    if (selectedText) {
      inputRef.current?.focus();
    }
  }, [selectedText]);

  const resetForm = () => {
    setCommentText('');
    setSelectedText(null);
  };

  const handleSubmit = () => {
    if (!selectedText || !commentText.trim()) return;
    onAddComment({
      id: crypto.randomUUID(),
      comment: commentText.trim(),
      selectedText,
      sectionHeading: '',
    });
    resetForm();
    window.getSelection()?.removeAllRanges();
  };

  return (
    <Popover.Root
      open={!!selectedText}
      onOpenChange={(open) => {
        if (!open) resetForm();
      }}
    >
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-modal bg-surface border border-border rounded-lg shadow-floating p-2 w-64"
        >
          {selectedText && (
            <>
              <div className="text-xs text-muted mb-1 truncate" title={selectedText}>
                &ldquo;
                {selectedText.length > MAX_QUOTE_LENGTH
                  ? `${selectedText.slice(0, MAX_QUOTE_LENGTH)}...`
                  : selectedText}
                &rdquo;
              </div>
              <textarea
                ref={inputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add comment..."
                rows={2}
                className="w-full text-sm bg-input-overlay rounded px-2 py-1 text-text border border-floating-border-subtle resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                  if (e.key === 'Escape') resetForm();
                }}
              />
              <div className="flex justify-end gap-1 mt-1">
                <InlineAction className="px-2 py-0.5" onClick={resetForm}>
                  Cancel
                </InlineAction>
                <Button
                  variant="primary"
                  size="xs"
                  className="px-2 py-0.5"
                  disabled={!commentText.trim()}
                  onClick={handleSubmit}
                >
                  Comment
                </Button>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
