import { useEffect, useRef, useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { Button } from '../ui/Button.tsx';

interface CommitComposerProps {
  onCommit: (message: string) => void;
  /** Number of changed files — surfaced in the submit button label
   *  (e.g. "Commit 3"). Omit to use the plain "Commit" label. */
  count?: number;
}

export function CommitComposer({ onCommit, count }: CommitComposerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const subjectRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (expanded) subjectRef.current?.focus();
  }, [expanded]);

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full text-left border border-dashed border-border hover:border-accent"
        onClick={() => setExpanded(true)}
      >
        + Commit message…
      </Button>
    );
  }

  function submit() {
    const message = body ? `${subject.trim()}\n\n${body.trim()}` : subject.trim();
    if (!message) return;
    onCommit(message);
    setSubject('');
    setBody('');
    setExpanded(false);
  }

  return (
    <section
      className="mt-3 flex flex-col gap-1 p-2 border border-border rounded bg-bg/40"
      aria-label="commit-composer"
    >
      <input
        ref={subjectRef}
        type="text"
        value={subject}
        placeholder="Subject"
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === 'Escape') setExpanded(false);
        }}
        className="px-2 py-1 rounded border border-border bg-surface text-xs font-mono"
      />
      <textarea
        value={body}
        placeholder="Body (optional)"
        rows={3}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
        className="px-2 py-1 rounded border border-border bg-surface text-xs font-mono resize-none"
      />
      <div className="flex justify-end gap-2 mt-1">
        <InlineAction
          className="px-2 py-0.5"
          onClick={() => {
            setExpanded(false);
            setSubject('');
            setBody('');
          }}
        >
          Cancel
        </InlineAction>
        <Button
          variant="primary"
          size="xs"
          disabled={!subject.trim()}
          className="py-0.5"
          onClick={submit}
        >
          {count !== undefined && count > 0 ? `Commit ${count}` : 'Commit'}
        </Button>
      </div>
    </section>
  );
}
