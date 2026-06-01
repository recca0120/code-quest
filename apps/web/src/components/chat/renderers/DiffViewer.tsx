import type React from 'react';
import { useState } from 'react';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { cn } from '@/utils/cn';
import { extractNewContent, parseDiffFileName, parseHunkStart } from '@/utils/diff';

interface DiffViewerProps {
  content: string;
  editable?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onAcceptEdited?: (editedContent: string) => void;
}

function AcceptRejectButtons({
  onAccept,
  onReject,
  onEdit,
}: {
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <InlineAction variant="success" className="font-medium" onClick={onAccept}>
        ✓ Accept
      </InlineAction>
      <InlineAction variant="danger" className="font-medium" onClick={onReject}>
        ✗ Reject
      </InlineAction>
      {onEdit && (
        <InlineAction variant="accent" className="font-medium" onClick={onEdit}>
          ✎ Edit
        </InlineAction>
      )}
    </div>
  );
}

type DiffType = 'added' | 'removed' | 'header' | 'context';

interface AnnotatedLine {
  cls: string;
  diffType?: DiffType;
  gutter: string;
  text: string;
}

function annotateLines(lines: string[]): AnnotatedLine[] {
  const PAD = 4;
  let oldLine = 0;
  let newLine = 0;
  return lines.map((line) => {
    if (line.startsWith('@@')) {
      const hunk = parseHunkStart(line);
      if (hunk) {
        oldLine = hunk.oldStart;
        newLine = hunk.newStart;
      }
      return { cls: 'text-accent', diffType: 'header', gutter: '  ', text: line };
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      return { cls: 'text-muted', diffType: 'header', gutter: '  ', text: line };
    }
    if (line.startsWith('+')) {
      const gutter = String(newLine++).padStart(PAD);
      return { cls: 'text-success', diffType: 'added', gutter, text: line };
    }
    if (line.startsWith('-')) {
      const gutter = String(oldLine++).padStart(PAD);
      return { cls: 'text-danger', diffType: 'removed', gutter, text: line };
    }
    const gutter = oldLine > 0 ? String(newLine++).padStart(PAD) : '';
    if (oldLine > 0) oldLine++;
    return { cls: '', diffType: 'context', gutter, text: line };
  });
}

function DiffFileHeader({
  fileName,
  actions,
  lines,
}: {
  fileName: string;
  actions?: React.ReactNode;
  lines?: string[];
}) {
  let insertions = 0;
  let deletions = 0;
  if (lines) {
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) insertions++;
      else if (l.startsWith('-') && !l.startsWith('---')) deletions++;
    }
  }
  return (
    <section
      className="flex items-center justify-between bg-surface-hover px-3 py-1.5 rounded-t-lg border border-border border-b-0"
      aria-label="diff-filename"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted">{fileName}</span>
        {lines && (
          <span className="flex items-center gap-1">
            <span className="text-success font-mono text-xs">+{insertions}</span>
            <span className="text-danger font-mono text-xs">-{deletions}</span>
          </span>
        )}
      </div>
      {actions}
    </section>
  );
}

export function DiffViewer({
  content,
  editable,
  onAccept,
  onReject,
  onAcceptEdited,
}: DiffViewerProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const fileName = parseDiffFileName(content);
  const annotated = annotateLines(content.split('\n'));

  const handleEdit = () => {
    setEditedContent(extractNewContent(content));
    setIsEditing(true);
  };

  const handleApplyEdit = () => {
    onAcceptEdited?.(editedContent);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div>
        {fileName && <DiffFileHeader fileName={fileName} lines={content.split('\n')} />}
        <textarea
          className="w-full bg-code-block p-3 text-xs font-mono border border-border rounded-b-lg"
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          aria-label="diff-edit-textarea"
          rows={10}
        />
        <div className="flex gap-2 mt-1">
          <InlineAction variant="success" className="font-medium" onClick={handleApplyEdit}>
            Apply Edit
          </InlineAction>
          <InlineAction
            variant="muted"
            className="font-medium hover:text-subtle"
            onClick={() => setIsEditing(false)}
          >
            Cancel
          </InlineAction>
        </div>
      </div>
    );
  }

  return (
    <div>
      {fileName ? (
        <DiffFileHeader
          fileName={fileName}
          lines={content.split('\n')}
          actions={
            editable ? (
              <AcceptRejectButtons
                onAccept={onAccept}
                onReject={onReject}
                onEdit={onAcceptEdited ? handleEdit : undefined}
              />
            ) : undefined
          }
        />
      ) : (
        editable && (
          <div className="flex gap-2 mb-1">
            <AcceptRejectButtons
              onAccept={onAccept}
              onReject={onReject}
              onEdit={onAcceptEdited ? handleEdit : undefined}
            />
          </div>
        )
      )}
      <pre
        className={cn(
          'bg-code-block p-3 overflow-x-auto text-xs font-mono border border-border',
          fileName ? 'rounded-b-lg' : 'rounded-lg',
        )}
      >
        {annotated.map(({ cls, diffType, gutter, text }, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff lines render once, never reorder
          <div key={`${i}-${gutter ?? ''}`} className={cls} data-diff-type={diffType}>
            {gutter && <span className="text-dim select-none mr-2">{gutter}</span>}
            {text}
          </div>
        ))}
      </pre>
    </div>
  );
}
