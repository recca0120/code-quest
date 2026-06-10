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
import type { TypedSocket } from '@/socket/client';
import { rpc } from '@/socket/rpc';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { parseUnifiedDiff } from '@/utils/parse-unified-diff';

interface GitActions {
  discardFile: (cwd: string, file: string) => Promise<{ ok: true } | { error: string }>;
  fetch: (cwd: string) => Promise<{ ok: true } | { error: string }>;
  pull: (cwd: string) => Promise<{ ok: true; fastForwarded: boolean } | { error: string }>;
  refetchGitStatus: (cwd: string) => Promise<void>;
}

async function handleRpcResult<T extends object>(
  result: T | { error: string },
  options: {
    successMessage: (result: T) => string;
    knownErrors?: Partial<Record<string, string>>;
    fallbackErrorPrefix: string;
    onSuccess?: (result: T) => Promise<void> | void;
  },
): Promise<void> {
  if ('error' in result) {
    const known = options.knownErrors?.[result.error];
    if (known) toast(known);
    else toast.error(`${options.fallbackErrorPrefix}: ${result.error}`);
    return;
  }
  toast.success(options.successMessage(result));
  await options.onSuccess?.(result);
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

export interface GitPaneActions {
  stageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  runFetch: () => Promise<void>;
  runPull: () => Promise<void>;
  push: () => Promise<void>;
  openDiff: (filePath: string, fileStatus: string) => Promise<void>;
  handleDiscard: (filePath: string, onSuccess: () => void) => Promise<void>;
}

export function createGitViewActions(
  cwd: string,
  socket: TypedSocket,
  gitActions: GitActions,
  options: { onDiffOpen?: (diff: DiffFile) => void } = {},
): GitPaneActions {
  const { discardFile, fetch, pull, refetchGitStatus } = gitActions;
  const refetch = (): Promise<void> => refetchGitStatus(cwd);

  async function stageAll(): Promise<void> {
    const result = await rpcParsed(socket, gitAddResultSchema, EVENTS.git.add, { cwd });
    await handleRpcResult(result, {
      successMessage: () => 'Staged all changes',
      fallbackErrorPrefix: 'Stage failed',
      onSuccess: refetch,
    });
  }

  async function commit(message: string): Promise<void> {
    const result = await rpcParsed(socket, gitCommitResultSchema, EVENTS.git.commit, {
      cwd,
      message,
    });
    await handleRpcResult(result, {
      successMessage: (r) => `Committed ${r.hash.slice(0, 7)}`,
      knownErrors: { 'nothing-to-commit': 'Nothing to commit. Stage first.' },
      fallbackErrorPrefix: 'Commit failed',
      onSuccess: refetch,
    });
  }

  async function runFetch(): Promise<void> {
    const result = await fetch(cwd);
    await handleRpcResult(result, {
      successMessage: () => 'Fetched',
      fallbackErrorPrefix: 'Fetch failed',
    });
  }

  async function runPull(): Promise<void> {
    const result = await pull(cwd);
    await handleRpcResult(result, {
      successMessage: (r) => (r.fastForwarded ? 'Pulled' : 'Already up to date'),
      knownErrors: {
        'non-ff': 'Pull rejected (non-FF). Run `git pull --rebase` manually.',
        'no-upstream': 'No upstream — set one with `git push -u`',
      },
      fallbackErrorPrefix: 'Pull failed',
      onSuccess: refetch,
    });
  }

  async function push(): Promise<void> {
    const result = await rpcParsed(socket, gitPushResultSchema, EVENTS.git.push, { cwd });
    await handleRpcResult(result, {
      successMessage: () => 'Pushed',
      knownErrors: {
        'no-upstream': 'No upstream — set one with git push -u',
        rejected: 'Push rejected (non-FF). Pull first.',
      },
      fallbackErrorPrefix: 'Push failed',
    });
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
    await handleRpcResult(result, {
      successMessage: () => `Discarded ${filePath}`,
      fallbackErrorPrefix: 'Discard failed',
      onSuccess,
    });
  }

  return { stageAll, commit, runFetch, runPull, push, openDiff, handleDiscard };
}
