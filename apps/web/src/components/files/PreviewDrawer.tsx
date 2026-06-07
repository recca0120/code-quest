import { isMarkdownMime, langForMime } from '@code-quest/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { RightDrawer } from '@/components/ui/RightDrawer.tsx';
import { cn } from '@/utils/cn';
import { CodeBlock } from '../chat/renderers/CodeBlock.tsx';
import { MarkdownContent } from '../chat/renderers/MarkdownContent.tsx';
import { Button } from '../ui/Button.tsx';

const PdfViewer = lazy(() => import('./PdfViewer.tsx').then((m) => ({ default: m.PdfViewer })));

export type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; content: string; contentType: string }
  | { kind: 'pdf'; data: string }
  | { kind: 'image'; src: string; contentType: string }
  | { kind: 'too-large' }
  | { kind: 'error'; message: string };

interface PreviewDrawerProps {
  open: boolean;
  title: string;
  state: PreviewState;
  onClose: () => void;
  actions?: ReactNode;
}

export function PreviewDrawer({
  open,
  title,
  state,
  onClose,
  actions,
}: PreviewDrawerProps): React.JSX.Element {
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

  useEffect(() => {
    if (open) setViewMode('preview');
  }, [open]);

  const isMarkdown = state.kind === 'ready' && isMarkdownMime(state.contentType);

  return (
    <RightDrawer
      open={open}
      title={title}
      width={672}
      onClose={onClose}
      footer={actions}
      overlayTestId="preview-drawer-overlay"
      footerTestId="drawer-footer"
    >
      {isMarkdown && (
        <div className="flex gap-1 px-4 pt-2 shrink-0">
          <Button
            variant={viewMode === 'preview' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('preview')}
          >
            Preview
          </Button>
          <Button
            variant={viewMode === 'raw' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('raw')}
          >
            Raw
          </Button>
        </div>
      )}
      <PreviewContent state={state} title={title} isMarkdown={isMarkdown} viewMode={viewMode} />
    </RightDrawer>
  );
}

function PreviewContent({
  state,
  title,
  isMarkdown,
  viewMode,
}: {
  state: PreviewState;
  title: string;
  isMarkdown: boolean;
  viewMode: 'preview' | 'raw';
}): React.JSX.Element {
  const language = state.kind === 'ready' ? langForMime(state.contentType, title) : undefined;
  if (state.kind === 'pdf') {
    return (
      <Suspense fallback={<div className="p-4 text-sm text-muted">Loading…</div>}>
        <PdfViewer data={state.data} className="flex-1 min-h-0 px-4 py-2" />
      </Suspense>
    );
  }

  let body: React.ReactNode;
  if (state.kind === 'loading') {
    body = <div className="text-sm text-muted">Loading…</div>;
  } else if (state.kind === 'too-large') {
    body = <div className="text-sm text-muted">File too large to preview (over 2 MB).</div>;
  } else if (state.kind === 'error') {
    body = <div className="text-sm text-warning">{state.message}</div>;
  } else if (state.kind === 'image') {
    body = (
      <div className="flex items-center justify-center">
        <img src={state.src} alt={title} className="max-w-full object-contain rounded" />
      </div>
    );
  } else if (isMarkdown && viewMode === 'preview') {
    body = <MarkdownContent content={state.content} />;
  } else if (language) {
    body = (
      <div className="text-xs">
        <CodeBlock code={state.content} language={language} />
      </div>
    );
  } else {
    body = <VirtualLineTable content={state.content} className="flex-1 min-h-0" />;
  }

  return <div className="flex-1 min-h-0 overflow-auto p-4">{body}</div>;
}

const LINE_HEIGHT = 20;

function VirtualLineTable({ content, className }: { content: string; className?: string }) {
  const lines = useMemo(() => content.split('\n'), [content]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 20,
  });

  return (
    <div
      ref={scrollRef}
      data-testid="line-table-scroll"
      className={cn(
        'bg-bg/40 border border-border rounded font-mono text-xs leading-relaxed overflow-auto',
        className,
      )}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.index}
            style={{ position: 'absolute', top: row.start, width: '100%', height: LINE_HEIGHT }}
            className="flex"
          >
            <span className="text-dim text-right pr-3 pl-2 select-none w-10 shrink-0">
              {row.index + 1}
            </span>
            <span className="whitespace-pre pr-2 flex-1">{lines[row.index] || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
