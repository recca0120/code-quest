import { isMarkdownMime, langForMime } from '@code-quest/utils';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import { lazy, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { CodeBlock } from '../chat/renderers/CodeBlock.tsx';
import { MarkdownContent } from '../chat/renderers/MarkdownContent.tsx';
import { Button } from '../ui/Button.tsx';
import { ResizeHandle } from './ResizeHandle.tsx';

const PdfViewer = lazy(() => import('./PdfViewer.tsx').then((m) => ({ default: m.PdfViewer })));

const DEFAULT_WIDTH = 672;
const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.8;

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
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

  useEffect(() => {
    if (open) setViewMode('preview');
  }, [open]);

  const isMarkdown = state.kind === 'ready' && isMarkdownMime(state.contentType);
  const language = state.kind === 'ready' ? langForMime(state.contentType, title) : undefined;

  function handleResize(clientX: number) {
    const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
    setDrawerWidth(Math.min(Math.max(window.innerWidth - clientX, MIN_WIDTH), maxWidth));
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-overlay bg-overlay" />
        <RadixDialog.Content
          aria-label={title}
          className="fixed inset-y-0 right-0 z-modal bg-surface border-l border-border flex flex-col"
          style={{ width: drawerWidth }}
        >
          <ResizeHandle
            onResize={handleResize}
            className="absolute left-0 top-0 bottom-0 w-1 hover:bg-accent/50 active:bg-accent"
          />

          <RadixDialog.Title className="flex items-center gap-2 px-4 py-3 border-b border-border text-sm font-medium shrink-0">
            <span className="flex-1 truncate">{title}</span>
          </RadixDialog.Title>

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

          {state.kind === 'pdf' ? (
            <Suspense fallback={<div className="p-4 text-sm text-muted">Loading…</div>}>
              <PdfViewer data={state.data} className="flex-1 min-h-0 px-4 py-2" />
            </Suspense>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {state.kind === 'image' ? (
                <div className="flex items-center justify-center">
                  <img src={state.src} alt={title} className="max-w-full object-contain rounded" />
                </div>
              ) : (
                <PreviewContent
                  state={state}
                  language={language}
                  isMarkdown={isMarkdown}
                  viewMode={viewMode}
                />
              )}
            </div>
          )}

          {actions && (
            <div className="flex gap-2 px-4 py-3 border-t border-border shrink-0">{actions}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function PreviewContent({
  state,
  language,
  isMarkdown,
  viewMode,
}: {
  state: Exclude<PreviewState, { kind: 'pdf' } | { kind: 'image' }>;
  language?: string;
  isMarkdown: boolean;
  viewMode: 'preview' | 'raw';
}) {
  if (state.kind === 'loading') {
    return <div className="text-sm text-muted">Loading…</div>;
  }
  if (state.kind === 'too-large') {
    return <div className="text-sm text-muted">File too large to preview (over 2 MB).</div>;
  }
  if (state.kind === 'error') {
    return <div className="text-sm text-warning">{state.message}</div>;
  }
  if (isMarkdown && viewMode === 'preview') {
    return <MarkdownContent content={state.content} />;
  }
  if (language) {
    return (
      <div className="text-xs">
        <CodeBlock code={state.content} language={language} />
      </div>
    );
  }
  return <VirtualLineTable content={state.content} className="flex-1 min-h-0" />;
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
