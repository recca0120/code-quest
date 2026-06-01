import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { MarkdownContent } from '../renderers/MarkdownContent.tsx';

interface SideQuestionDialogProps {
  open: boolean;
  question: string;
  answer: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  /** Optional portal target to scope the backdrop to a subset of the viewport
   *  (e.g. ChatPanel) instead of covering the whole app. */
  container?: HTMLElement | null;
}

export function SideQuestionDialog({
  open,
  question,
  answer,
  loading,
  error,
  onClose,
  container,
}: SideQuestionDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Side question"
        hideTitle
        container={container}
        className="max-w-150 w-full p-0 overflow-hidden mt-[15vh] top-0 translate-y-0"
      >
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <p className="text-xs text-muted font-mono truncate">/btw {question}</p>
        </div>
        <div className="px-4 py-3 max-h-[55vh] overflow-y-auto text-sm">
          {loading && <p className="text-muted">Thinking…</p>}
          {!loading && error && <p className="text-danger">{error}</p>}
          {!loading && answer !== null && <MarkdownContent content={answer} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
