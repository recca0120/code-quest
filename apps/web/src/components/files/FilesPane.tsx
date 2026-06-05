import { EVENTS, fsReadResponseSchema } from '@code-quest/schemas';
import { imageDataUri, isImageMime, isPdfMime } from '@code-quest/utils';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFsActions } from '@/contexts/FsContext';
import { useGitStatus } from '@/contexts/GitContext';
import { useSocket } from '@/contexts/SocketContext';
import type { TypedSocket } from '@/socket/client';
import { rpc } from '@/socket/rpc';
import { basename } from '@/utils/basename';
import { Button } from '../ui/Button.tsx';
import { FileTree } from './FileTree.tsx';
import { PreviewDrawer, type PreviewState } from './PreviewDrawer.tsx';

const PREVIEW_BYTE_LIMIT = 2 * 1024 * 1024;

async function loadPreview(
  socket: TypedSocket,
  path: string,
  maxBytes: number,
): Promise<PreviewState> {
  const response = await rpc(socket, EVENTS.fs.read, { file: path, maxBytes });
  const parsed = fsReadResponseSchema.safeParse(response);
  if (!parsed.success) return { kind: 'error', message: 'Read failed' };
  if ('error' in parsed.data) return { kind: 'error', message: parsed.data.error };
  if ('tooLarge' in parsed.data) return { kind: 'too-large' };

  const { content, contentType, encoding } = parsed.data;
  if (encoding === 'base64' && isPdfMime(contentType)) return { kind: 'pdf', data: content };
  if (encoding === 'base64' && isImageMime(contentType)) {
    return { kind: 'image', src: imageDataUri(contentType, content), contentType };
  }
  return { kind: 'ready', content, contentType };
}

interface FilesPaneProps {
  cwd: string;
  onMention: (path: string) => void;
}

type PreviewFile = { path: string; size: number };

export function FilesPane({ cwd, onMention }: FilesPaneProps): React.JSX.Element {
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: 'loading' });
  const [rootError, setRootError] = useState<string | null>(null);
  const { browse } = useFsActions();
  const { socket } = useSocket();
  const gitData = useGitStatus(cwd);

  // Probe the cwd once per change to surface "outside allowed roots" (and any
  // other early errors) as a clear empty state instead of a blank tree. The
  // FileTree's own dataLoader fetches in parallel; this probe is the first
  // signal that lets the pane render an error message.
  useEffect(() => {
    let cancelled = false;
    setRootError(null);
    void browse(cwd).then((res) => {
      if (cancelled) return;
      if ('error' in res) setRootError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, browse]);

  useEffect(() => {
    if (!previewFile) return;
    // Skip the RPC entirely when the file is already known to be too large.
    if (previewFile.size > PREVIEW_BYTE_LIMIT) {
      setPreviewState({ kind: 'too-large' });
      return;
    }
    let cancelled = false;
    setPreviewState({ kind: 'loading' });
    loadPreview(socket, previewFile.path, PREVIEW_BYTE_LIMIT)
      .then((state) => {
        if (!cancelled) setPreviewState(state);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setPreviewState({ kind: 'error', message: 'Unexpected error' });
      });
    return () => {
      cancelled = true;
    };
  }, [previewFile, socket]);

  const gitMarks = useMemo(() => {
    const marks = new Map<string, string>();
    if (gitData && 'changedFiles' in gitData) {
      // POSIX-only path joining — server emits forward-slash paths from git
      // status (`f.file` is repo-relative) and FileTree's absolute paths
      // (server fs:browse) likewise use `/`. Strip a trailing slash on cwd
      // to avoid double-slash when cwd is a root like '/'.
      const normalizedCwd = cwd.endsWith('/') ? cwd.slice(0, -1) : cwd;
      for (const f of gitData.changedFiles) {
        marks.set(`${normalizedCwd}/${f.file}`, f.status);
      }
    }
    return marks;
  }, [gitData, cwd]);

  function handleActivate(file: { path: string; size?: number }, event: MouseEvent<Element>) {
    if (event.metaKey || event.ctrlKey) {
      onMention(file.path);
      return;
    }
    if (event.altKey) {
      toast('Open in editor — coming soon');
      return;
    }
    setPreviewFile((prev) =>
      prev?.path === file.path ? prev : { path: file.path, size: file.size ?? 0 },
    );
  }

  if (rootError) {
    return <EmptyState message={rootError} />;
  }

  const filename = previewFile ? basename(previewFile.path) : '';
  const drawerActions = previewFile && (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          onMention(previewFile.path);
          setPreviewFile(null);
        }}
      >
        Mention
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(previewFile.path);
        }}
      >
        Copy path
      </Button>
    </>
  );

  return (
    <section className="flex flex-col h-full" aria-label="files-pane">
      <div className="flex-1 min-h-0 overflow-auto">
        <FileTree
          key={cwd}
          rootCwd={cwd}
          showHidden
          gitMarks={gitMarks}
          onActivate={handleActivate}
        />
      </div>
      <PreviewDrawer
        open={!!previewFile}
        title={filename}
        state={previewState}
        onClose={() => setPreviewFile(null)}
        actions={drawerActions}
      />
    </section>
  );
}
