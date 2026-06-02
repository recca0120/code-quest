import { EVENTS, fsReadResponseSchema } from '@code-quest/schemas';
import { isMarkdownMime, isPdfMime, langForMime } from '@code-quest/utils';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { rpc } from '@/socket/rpc';
import { CodeBlock } from '../chat/renderers/CodeBlock.tsx';
import { MarkdownContent } from '../chat/renderers/MarkdownContent.tsx';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

const PdfViewer = lazy(() => import('./PdfViewer.tsx').then((m) => ({ default: m.PdfViewer })));

/** UTF-16 code units, not bytes — `string.length`. Files this big take
 *  hundreds of ms to syntax-highlight, which is what we actually want to
 *  guard against. The "500 KB" UI label is a pragmatic approximation. */
const PREVIEW_CHAR_LIMIT = 500 * 1024;

interface FilePreviewModalProps {
  path: string;
  onClose: () => void;
  onMention: (path: string) => void;
}

export function FilePreviewModal({
  path,
  onClose,
  onMention,
}: FilePreviewModalProps): React.JSX.Element {
  const { socket } = useSocket();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; content: string; contentType: string }
    | { kind: 'pdf'; data: string }
    | { kind: 'too-large' }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const response = await rpc(socket, EVENTS.fs.read, { path });
      if (cancelled) return;
      const parsed = fsReadResponseSchema.safeParse(response);
      if (!parsed.success) {
        setState({ kind: 'error', message: 'Read failed' });
        return;
      }
      if ('error' in parsed.data) {
        setState({ kind: 'error', message: parsed.data.error });
        return;
      }
      const { content, contentType, encoding } = parsed.data;
      if (encoding === 'base64' && isPdfMime(contentType)) {
        setState({ kind: 'pdf', data: content });
        return;
      }
      if (content.length > PREVIEW_CHAR_LIMIT) {
        setState({ kind: 'too-large' });
        return;
      }
      setState({ kind: 'ready', content, contentType });
    })();
    return () => {
      cancelled = true;
    };
  }, [path, socket]);

  const isPdf = state.kind === 'pdf';
  const isMarkdown = state.kind === 'ready' && isMarkdownMime(state.contentType);
  const language = state.kind === 'ready' ? langForMime(state.contentType, path) : undefined;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={path} size="lg" scrollable={!isPdf}>
        <div className={`flex flex-col gap-3 ${isPdf ? 'h-full min-h-0' : ''}`}>
          {isMarkdown && (
            <div className="flex gap-1 self-end">
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
            <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
              <PdfViewer data={state.data} className="flex-1 min-h-0" />
            </Suspense>
          ) : (
            <PreviewBody
              state={state}
              language={language}
              isMarkdown={isMarkdown}
              viewMode={viewMode}
            />
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="primary" size="sm" onClick={() => onMention(path)}>
              Mention
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(path);
              }}
            >
              Copy path
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  state,
  language,
  isMarkdown,
  viewMode,
}: {
  state:
    | { kind: 'loading' }
    | { kind: 'ready'; content: string; contentType: string }
    | { kind: 'too-large' }
    | { kind: 'error'; message: string };
  language?: string;
  isMarkdown: boolean;
  viewMode: 'preview' | 'raw';
}) {
  if (state.kind === 'loading') {
    return <div className="text-sm text-muted">Loading…</div>;
  }
  if (state.kind === 'too-large') {
    return <div className="text-sm text-muted">File too large to preview (over 500 KB).</div>;
  }
  if (state.kind === 'error') {
    return <div className="text-sm text-warning">{state.message}</div>;
  }
  if (isMarkdown && viewMode === 'preview') {
    return (
      <div className="overflow-auto max-h-dialog-body">
        <MarkdownContent content={state.content} />
      </div>
    );
  }
  if (language) {
    return (
      <div className="overflow-auto max-h-dialog-body text-xs">
        <CodeBlock code={state.content} language={language} />
      </div>
    );
  }
  const lines = state.content.split('\n');
  return (
    <div className="bg-bg/40 border border-border rounded overflow-auto max-h-dialog-body font-mono text-xs leading-relaxed">
      <table className="w-full">
        <tbody>
          {lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: line order is fixed for this static render
            <tr key={i}>
              <td className="text-dim text-right pr-3 pl-2 select-none w-10 align-top">{i + 1}</td>
              <td className="whitespace-pre pr-2 align-top">{line || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
