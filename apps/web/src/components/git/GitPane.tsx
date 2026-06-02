import type { GitAddResult, GitCommitResult, GitFileChange, GitPushResult } from '@code-quest/git';
import type { ClientToServerEvents } from '@code-quest/schemas';
import {
  EVENTS,
  gitAddResultSchema,
  gitCommitResultSchema,
  gitDiffByCwdResultSchema,
  gitPushResultSchema,
} from '@code-quest/schemas';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGitActions, useGitStatus } from '@/contexts/GitContext';
import { useSocket } from '@/contexts/SocketContext';
import type { TypedSocket } from '@/socket/client';
import { rpc } from '@/socket/rpc';
import { cn } from '@/utils/cn';
import { type DiffFile, parseUnifiedDiff } from '@/utils/parse-unified-diff';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CommandHint } from '../ui/CommandHint.tsx';
import { PaneStatusFooter } from '../ui/PaneStatusFooter.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { CommitComposer } from './CommitComposer.tsx';
import { DiffModal } from './DiffModal.tsx';

interface GitPaneProps {
  cwd: string;
}

async function rpcParsed<T, E extends keyof ClientToServerEvents>(
  socket: TypedSocket,
  schema: ZodType<T>,
  event: E,
  ...args: Parameters<ClientToServerEvents[E]> extends [...infer P, infer _Cb] ? P : never
): Promise<T | { error: string }> {
  // biome-ignore lint/suspicious/noExplicitAny: rpc generic constraints can't express this call pattern without an escape hatch
  const raw = await (rpc as any)(socket, event, ...args);
  return schema.safeParse(raw).data ?? { error: 'Invalid response' };
}

const STATUS_LABEL: Record<string, { mark: string; cls: string }> = {
  M: { mark: 'M', cls: 'text-warning' },
  A: { mark: 'A', cls: 'text-success' },
  D: { mark: 'D', cls: 'text-danger' },
  R: { mark: 'R', cls: 'text-info' },
  '??': { mark: '?', cls: 'text-success/70' },
  U: { mark: 'U', cls: 'text-success/70' },
};

function statusFor(s: string): { mark: string; cls: string } {
  return STATUS_LABEL[s] ?? { mark: s.slice(0, 1) || '·', cls: 'text-muted' };
}

export function GitPane({ cwd }: GitPaneProps): React.JSX.Element {
  const { socket } = useSocket();
  const { discardFile, fetch, pull, refetchGitStatus } = useGitActions();
  const data = useGitStatus(cwd);
  function refetch() {
    return refetchGitStatus(cwd);
  }
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null);
  async function stageAll() {
    const result: GitAddResult = await rpcParsed(socket, gitAddResultSchema, EVENTS.git.add, {
      cwd,
    });
    if ('error' in result) toast.error(`Stage failed: ${result.error}`);
    else toast.success('Staged all changes');
    await refetch();
  }

  async function commit(message: string) {
    const result: GitCommitResult = await rpcParsed(
      socket,
      gitCommitResultSchema,
      EVENTS.git.commit,
      { cwd, message },
    );
    if ('error' in result) {
      if (result.error === 'nothing-to-commit') {
        toast('Nothing to commit. Stage first.');
      } else {
        toast.error(`Commit failed: ${result.error}`);
      }
      return;
    }
    toast.success(`Committed ${result.hash.slice(0, 7)}`);
    await refetch();
  }

  async function runFetch() {
    const result = await fetch(cwd);
    if ('error' in result) toast.error(`Fetch failed: ${result.error}`);
    else toast.success('Fetched');
  }

  async function runPull() {
    const result = await pull(cwd);
    if ('error' in result) {
      if (result.error === 'non-ff') {
        toast('Pull rejected (non-FF). Run `git pull --rebase` manually.');
      } else if (result.error === 'no-upstream') {
        toast('No upstream — set one with `git push -u`');
      } else {
        toast.error(`Pull failed: ${result.error}`);
      }
      return;
    }
    toast.success(result.fastForwarded ? 'Pulled' : 'Already up to date');
    await refetch();
  }

  async function push() {
    const result: GitPushResult = await rpcParsed(socket, gitPushResultSchema, EVENTS.git.push, {
      cwd,
    });
    if ('error' in result) {
      if (result.error === 'no-upstream') toast('No upstream — set one with git push -u');
      else if (result.error === 'rejected') toast('Push rejected (non-FF). Pull first.');
      else toast.error(`Push failed: ${result.error}`);
      return;
    }
    toast.success('Pushed');
  }

  async function openDiff(filePath: string, fileStatus: string) {
    const response = await rpc(socket, EVENTS.git.diff, { cwd, filePath, status: fileStatus });
    const parsed = gitDiffByCwdResultSchema.safeParse(response);
    if (!parsed.success) {
      toast.error('Diff unavailable: invalid response');
      return;
    }
    if ('error' in parsed.data) {
      toast.error(`Diff failed: ${parsed.data.error}`);
      return;
    }
    const files = parseUnifiedDiff(parsed.data.diff);
    const match = files.find((f) => f.path === filePath);
    setDiffFile(
      match ?? {
        path: filePath,
        isBinary: false,
        added: 0,
        removed: 0,
        lines: [{ kind: 'meta', text: 'No diff available.' }],
      },
    );
  }

  // ── Early returns (must follow ALL hook calls above) ──
  if (data && 'notARepo' in data) {
    return (
      <EmptyState
        icon={
          <span className="text-4xl text-accent" aria-hidden>
            ⎇
          </span>
        }
        message="Not a git repository."
        hint={<CommandHint command="git init" />}
      />
    );
  }
  if (data && 'error' in data) {
    return <EmptyState message={data.error} />;
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted">
        <Spinner className="w-5 h-5" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  // After the early returns above, `data` is the success branch — drop the
  // dead defensive narrowing.
  const status = data;
  const hasChanges = !status.isClean;
  const changedCount = status.changedFiles.length;
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;
  const diffFileStatus = diffFile
    ? status.changedFiles.find((f) => f.file === diffFile.path)?.status
    : undefined;
  const canDiscardDiffFile = diffFileStatus !== undefined && diffFileStatus !== '??';

  return (
    <section className="flex flex-col h-full" aria-label="git-pane">
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Changes section — flows naturally; pane scrolls as one. */}
        <section className="px-3 py-2 border-b border-border text-sm">
          <div className="flex items-center justify-between mb-1">
            <h4 className="section-label m-0">Changes ({changedCount})</h4>
            {hasChanges && (
              <ActionButton
                onClick={stageAll}
                variant="ghost"
                size="xs"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Stage all
              </ActionButton>
            )}
          </div>
          <ChangedFiles files={status.changedFiles} onPick={openDiff} />
          {hasChanges && (
            <CommitComposer onCommit={(msg) => void commit(msg)} count={changedCount} />
          )}
        </section>

        {/* Actions section — sits right under Changes content, not pinned. */}
        <section className="px-3 py-2">
          <h4 className="section-label m-0 mb-1">Actions</h4>
          <div className="flex gap-2 text-xs">
            <ActionButton onClick={runFetch} variant="secondary" size="xs">
              Fetch
            </ActionButton>
            <ActionButton onClick={runPull} variant="secondary" size="xs">
              Pull
            </ActionButton>
            <ActionButton onClick={push} variant="secondary" size="xs">
              Push
            </ActionButton>
          </div>
        </section>
      </div>
      <PaneStatusFooter>
        <span>{status.branch ?? 'unknown'}</span>
        <span>·</span>
        <span>
          {changedCount} {changedCount === 1 ? 'change' : 'changes'}
        </span>
        {(ahead > 0 || behind > 0) && (
          <>
            <span>·</span>
            {ahead > 0 && <span>↑{ahead}</span>}
            {behind > 0 && <span>↓{behind}</span>}
          </>
        )}
      </PaneStatusFooter>
      {diffFile && (
        <DiffModal
          file={diffFile}
          onClose={() => setDiffFile(null)}
          canDiscard={canDiscardDiffFile}
          onDiscard={async () => {
            const result = await discardFile(cwd, diffFile.path);
            if ('error' in result) toast.error(`Discard failed: ${result.error}`);
            else {
              toast.success(`Discarded ${diffFile.path}`);
              setDiffFile(null);
            }
          }}
        />
      )}
    </section>
  );
}

function ChangedFiles({
  files,
  onPick,
}: {
  files: GitFileChange[];
  onPick: (path: string, status: string) => void;
}) {
  if (files.length === 0) {
    return <div className="text-muted text-xs px-1">No changes</div>;
  }
  return (
    <ul className="flex flex-col">
      {files.map((f) => {
        const { mark, cls } = statusFor(f.status);
        return (
          <li key={f.file}>
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left px-1 py-0.5 hover:bg-hover-tint rounded"
              onClick={() => onPick(f.file, f.status)}
            >
              <span className={cn('font-mono w-4 text-xs', cls)}>{mark}</span>
              <span className="font-mono text-xs truncate">{f.file}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
