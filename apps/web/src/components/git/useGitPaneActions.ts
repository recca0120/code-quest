import type { ClientToServerEvents } from '@code-quest/schemas';
import {
  EVENTS,
  gitAddResultSchema,
  gitCommitResultSchema,
  gitDiffByCwdResultSchema,
  gitPushResultSchema,
} from '@code-quest/schemas';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import { useGitActions } from '@/contexts/GitContext';
import { useSocket } from '@/contexts/SocketContext';
import type { TypedSocket } from '@/socket/client';
import { rpc } from '@/socket/rpc';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { parseUnifiedDiff } from '@/utils/parse-unified-diff';

export type DiffState = DiffFile;

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

export interface GitPaneActions {
  stageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  runFetch: () => Promise<void>;
  runPull: () => Promise<void>;
  push: () => Promise<void>;
  openDiff: (filePath: string, fileStatus: string) => Promise<void>;
  handleDiscard: (filePath: string, onSuccess: () => void) => Promise<void>;
}

export function useGitPaneActions(
  cwd: string,
  options: {
    onDiffOpen?: (diff: DiffState) => void;
  } = {},
): GitPaneActions {
  const { socket } = useSocket();
  const { discardFile, fetch, pull, refetchGitStatus } = useGitActions();
  const refetch = (): Promise<unknown> => refetchGitStatus(cwd);

  async function stageAll(): Promise<void> {
    const result = await rpcParsed(socket, gitAddResultSchema, EVENTS.git.add, { cwd });
    if ('error' in result) toast.error(`Stage failed: ${result.error}`);
    else toast.success('Staged all changes');
    await refetch();
  }

  async function commit(message: string): Promise<void> {
    const result = await rpcParsed(socket, gitCommitResultSchema, EVENTS.git.commit, {
      cwd,
      message,
    });
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

  async function runFetch(): Promise<void> {
    const result = await fetch(cwd);
    if ('error' in result) toast.error(`Fetch failed: ${result.error}`);
    else toast.success('Fetched');
  }

  async function runPull(): Promise<void> {
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

  async function push(): Promise<void> {
    const result = await rpcParsed(socket, gitPushResultSchema, EVENTS.git.push, { cwd });
    if ('error' in result) {
      if (result.error === 'no-upstream') toast('No upstream — set one with git push -u');
      else if (result.error === 'rejected') toast('Push rejected (non-FF). Pull first.');
      else toast.error(`Push failed: ${result.error}`);
      return;
    }
    toast.success('Pushed');
  }

  async function openDiff(filePath: string, fileStatus: string): Promise<void> {
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
    options.onDiffOpen?.(
      match ?? {
        path: filePath,
        isBinary: false,
        added: 0,
        removed: 0,
        lines: [{ kind: 'meta', text: 'No diff available.' }],
      },
    );
  }

  async function handleDiscard(filePath: string, onSuccess: () => void): Promise<void> {
    const result = await discardFile(cwd, filePath);
    if ('error' in result) {
      toast.error(`Discard failed: ${result.error}`);
      return;
    }
    toast.success(`Discarded ${filePath}`);
    onSuccess();
  }

  return { stageAll, commit, runFetch, runPull, push, openDiff, handleDiscard };
}
