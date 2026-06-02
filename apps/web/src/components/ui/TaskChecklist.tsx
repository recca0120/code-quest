import { useEffect, useState } from 'react';
import { Checkbox } from './Checkbox.tsx';

interface TaskLine {
  lineIndex: number;
  indent: string;
  checked: boolean;
  text: string;
}

const TASK_RE = /^(\s*)-\s+\[( |x|X)\]\s*(.*)$/;

type Line = TaskLine | { lineIndex: number; kind: 'raw'; text: string };

interface TaskChecklistProps {
  content: string;
  onToggle: (lineIndex: number) => Promise<{ ok: true; checked: boolean } | { error: string }>;
  onError?: (message: string) => void;
}

function parseLines(content: string): Line[] {
  return content.split('\n').map((raw, lineIndex) => {
    const match = raw.match(TASK_RE);
    if (!match) return { lineIndex, kind: 'raw', text: raw };
    const [, indent, mark, text] = match;
    return {
      lineIndex,
      indent: indent ?? '',
      checked: mark?.toLowerCase() === 'x',
      text: text ?? '',
    };
  });
}

function isTaskLine(line: Line): line is TaskLine {
  return !('kind' in line);
}

export function TaskChecklist({
  content,
  onToggle,
  onError,
}: TaskChecklistProps): React.JSX.Element {
  const [lines, setLines] = useState<Line[]>(() => parseLines(content));

  useEffect(() => {
    setLines(parseLines(content));
  }, [content]);

  async function toggle(lineIndex: number) {
    let prevChecked = false;
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineIndex !== lineIndex || !isTaskLine(l)) return l;
        prevChecked = l.checked;
        return { ...l, checked: !l.checked };
      }),
    );
    const result = await onToggle(lineIndex);
    if ('error' in result) {
      setLines((prev) =>
        prev.map((l) =>
          l.lineIndex !== lineIndex || !isTaskLine(l) ? l : { ...l, checked: prevChecked },
        ),
      );
      onError?.(result.error);
    }
  }

  return (
    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
      {lines.map((line) => {
        if (!isTaskLine(line)) {
          return (
            <div key={line.lineIndex} className="text-muted">
              {line.text || ' '}
            </div>
          );
        }
        const checkboxId = `task-line-${line.lineIndex}`;
        return (
          <label
            key={line.lineIndex}
            htmlFor={checkboxId}
            aria-label={`task-line-${line.lineIndex}`}
            className="flex items-start gap-2 py-0.5 cursor-pointer hover:bg-hover-tint rounded"
          >
            <span aria-hidden className="whitespace-pre">
              {line.indent}
            </span>
            <Checkbox
              id={checkboxId}
              checked={line.checked}
              onCheckedChange={() => void toggle(line.lineIndex)}
              className="mt-0.5"
            />
            <span className={line.checked ? 'text-dim line-through' : 'text-text'}>
              {line.text}
            </span>
          </label>
        );
      })}
    </div>
  );
}
