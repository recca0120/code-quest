import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/solid';
import { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/utils/clipboard';

export const HOVER_COPY_BASE =
  'p-1 rounded text-muted hover:text-text hover:bg-surface-hover opacity-0 transition-opacity cursor-pointer';

const COPY_SUCCESS_DURATION_MS = 2000;

export function CopyButton({
  text,
  getText,
  className,
  title = 'Copy',
  'aria-label': ariaLabel,
}: {
  text?: string;
  getText?: () => string;
  className?: string;
  title?: string;
  'aria-label'?: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleClick = () => {
    copyToClipboard(getText ? getText() : (text ?? ''));
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPY_SUCCESS_DURATION_MS);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={copied ? 'Copied!' : title}
      aria-label={ariaLabel}
    >
      {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
    </button>
  );
}
