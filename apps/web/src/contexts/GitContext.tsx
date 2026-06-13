import type { GitStatusResult, WorktreeInfo } from '@code-quest/git';
import type {
  GitStatusByCwdResult,
  WorktreeAddedEvent,
  WorktreeBranchChangedEvent,
  WorktreeRemovedEvent,
} from '@code-quest/schemas';
import { EVENTS, gitStatusByCwdResultSchema, gitStatusResultSchema } from '@code-quest/schemas';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useDirtyQueryCache } from '../hooks/use-dirty-query-cache.ts';
import { rpc } from '../socket/rpc.ts';
import { parseSnapshot } from '../utils/parse-snapshot.ts';
import { createQueryCache } from '../utils/query-cache.ts';
import { useSocket } from './SocketContext.tsx';

/** Sentinel stored in `listing` when the project is not a git repo. */
export const NOT_A_REPO = 'not_a_repo' as const;
export type WorktreeListingEntry = WorktreeInfo[] | typeof NOT_A_REPO;

interface WorktreeState {
  listing: Record<string, WorktreeListingEntry>;
}

type CreateWorktreeResult = { worktreePath: string; name: string; branch?: string };
type ListResult = WorktreeInfo[] | { error: 'not_a_repo' | string };
type InitRepoResult = { ok: true; branch: string } | { ok: false; error: string };

interface CreateWorktreeArgs {
  cwd: string;
  name?: string;
  existingBranch?: string;
  newBranch?: string;
  baseBranch?: string;
  path?: string;
}

type CheckoutResult = { ok: true; branch: string } | { ok: false; error: string };

type GitFetchResult = { ok: true } | { error: string };
type GitPullResult = { ok: true; fastForwarded: boolean } | { error: string };

interface WorktreeActions {
  create: (
    cwdOrArgs: string | CreateWorktreeArgs,
    name?: string,
  ) => Promise<CreateWorktreeResult | { error: string }>;
  list: (cwd: string) => Promise<ListResult>;
  /** Remove a worktree by name. Always updates the local listing on success.
   *  `opts.force` defaults to false (allows the server to reject with `'dirty'`
   *  so callers can prompt the user). Set `force: true` for the "fire and
   *  forget" remove path. */
  removeWorktree: (
    projectCwd: string,
    name: string,
    opts?: { force?: boolean },
  ) => Promise<{ ok: true } | { error: string }>;
  initRepo: (cwd: string) => Promise<InitRepoResult>;
  listBranches: (cwd: string) => Promise<string[] | { error: string }>;
  checkout: (worktreeCwd: string, branch: string) => Promise<CheckoutResult>;
  status: (worktreeCwd: string) => Promise<
    | {
        branch: string;
        isClean: boolean;
        changedFilesCount: number;
        insertions: number;
        deletions: number;
      }
    | { error: string }
  >;
  rename: (
    worktreeCwd: string,
    newBranchName: string,
  ) => Promise<{ branch: string } | { error: string }>;
  diff: (
    cwd: string,
    filePath?: string,
    status?: string,
  ) => Promise<{ diff: string } | { error: string }>;
  fetch: (cwd: string) => Promise<GitFetchResult>;
  pull: (cwd: string) => Promise<GitPullResult>;
  discardFile: (cwd: string, file: string) => Promise<{ ok: true } | { error: string }>;

  // ── Per-cwd git status: external store API for useSyncExternalStore ──
  /** Synchronous snapshot of cached git status for `cwd`. `undefined` if
   *  not yet fetched. Pair with `subscribeGitStatusChange` via
   *  `useSyncExternalStore` (or use the `useGitStatus` adapter hook). */
  getGitStatus: (cwd: string) => GitStatusByCwdResult | undefined;
  /** Notify on cache change for `cwd`. Parameterless callback — consumer
   *  reads new value via `getGitStatus(cwd)`. First subscribe per cwd
   *  triggers an initial fetch. Returned unsubscribe is idempotent. */
  subscribeGitStatusChange: (cwd: string, onChange: () => void) => () => void;
  /** Force a refetch (used by Refresh button etc.). */
  refetchGitStatus: (cwd: string) => Promise<void>;
}

const GitStateContext = createContext<WorktreeState | null>(null);
const GitActionsContext = createContext<WorktreeActions | null>(null);

export function useGitState(): WorktreeState {
  const ctx = useContext(GitStateContext);
  if (!ctx) throw new Error('useGitState must be used within GitProvider');
  return ctx;
}

export function useGitActions(): WorktreeActions {
  const ctx = useContext(GitActionsContext);
  if (!ctx) throw new Error('useGitActions must be used within GitProvider');
  return ctx;
}

/** External-store adapter: returns the cached git status for `cwd`,
 *  re-rendering the component when it changes. First mount per cwd
 *  triggers fetch. Synchronous snapshot read = zero flicker on cwd
 *  switches when the new cwd is already cached. */
export function useGitStatus(cwd: string): GitStatusByCwdResult | undefined {
  const { getGitStatus, subscribeGitStatusChange } = useGitActions();
  const subscribe = useCallback(
    (cb: () => void) => subscribeGitStatusChange(cwd, cb),
    [cwd, subscribeGitStatusChange],
  );
  const getSnapshot = useCallback(() => getGitStatus(cwd), [cwd, getGitStatus]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

const fetchGitStatus =
  (socket: ReturnType<typeof useSocket>['socket'] | null) =>
  async (cwd: string): Promise<GitStatusByCwdResult> => {
    if (!socket) return { error: 'invalid_response' };
    const response = await rpc(socket, EVENTS.git.status, { cwd });
    const parsed = gitStatusByCwdResultSchema.safeParse(response);
    return parsed.success ? parsed.data : { error: 'invalid_response' };
  };

const extractGitDirtyCwd = (payload: unknown): string | null => {
  if (typeof payload === 'object' && payload !== null && 'cwd' in payload) {
    const cwd = (payload as { cwd: unknown }).cwd;
    return typeof cwd === 'string' ? cwd : null;
  }
  return null;
};

const extractGitSnapshot = (payload: unknown): GitStatusResult | null =>
  parseSnapshot(payload, gitStatusResultSchema);

export function GitProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { socket } = useSocket();
  const [listing, setListing] = useState<Record<string, WorktreeListingEntry>>({});

  const [statusStore] = useState(() =>
    createQueryCache<GitStatusByCwdResult>({
      fetch: fetchGitStatus(socket),
      idPrefix: 'git-sub',
    }),
  );

  useDirtyQueryCache(
    socket,
    statusStore,
    fetchGitStatus,
    EVENTS.git.dirty,
    extractGitDirtyCwd,
    extractGitSnapshot,
  );

  const actions = useMemo<WorktreeActions>(
    () => ({
      async create(cwdOrArgs, name) {
        const payload: CreateWorktreeArgs =
          typeof cwdOrArgs === 'string' ? { cwd: cwdOrArgs, name } : cwdOrArgs;
        const res = await rpc(socket, EVENTS.git.worktree.add, payload);
        return res.ok ? res.data : { error: res.error };
      },
      async list(cwd) {
        const res = await rpc(socket, EVENTS.git.worktree.list, { cwd });
        if (!res.ok) {
          if (res.error === 'not_a_repo') {
            setListing((prev) => ({ ...prev, [cwd]: NOT_A_REPO }));
          }
          return { error: res.error };
        }
        setListing((prev) => ({ ...prev, [cwd]: res.data.worktrees }));
        return res.data.worktrees;
      },
      async removeWorktree(projectCwd, name, opts) {
        const res = await rpc(socket, EVENTS.git.worktree.remove, {
          projectCwd,
          name,
          force: opts?.force ?? false,
        });
        if ('ok' in res) {
          setListing((prev) => {
            const next = { ...prev };
            const entry = next[projectCwd];
            if (Array.isArray(entry)) next[projectCwd] = entry.filter((w) => w.name !== name);
            return next;
          });
          return { ok: true };
        }
        return { error: res.error };
      },
      async initRepo(cwd) {
        const res = await rpc(socket, EVENTS.git.init, { cwd });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, branch: res.data.branch };
      },
      async listBranches(cwd) {
        const res = await rpc(socket, EVENTS.git.branches, { cwd });
        return res.ok ? res.data.branches : { error: res.error };
      },
      async checkout(worktreeCwd, branch) {
        const res = await rpc(socket, EVENTS.git.checkout, { cwd: worktreeCwd, branch });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, branch: res.data.branch };
      },
      async status(worktreeCwd) {
        const res = await rpc(socket, EVENTS.git.statusSummary, { cwd: worktreeCwd });
        return res.ok ? res.data : { error: res.error };
      },
      getGitStatus: statusStore.get,
      subscribeGitStatusChange: statusStore.subscribe,
      refetchGitStatus: statusStore.refetch,
      async rename(worktreeCwd, newBranchName) {
        const res = await rpc(socket, EVENTS.git.worktree.rename, {
          cwd: worktreeCwd,
          newBranchName,
        });
        return res.ok ? res.data : { error: res.error };
      },
      diff: (cwd, filePath, status) => rpc(socket, EVENTS.git.diff, { cwd, filePath, status }),
      fetch: (cwd) => rpc(socket, EVENTS.git.fetch, { cwd }),
      pull: (cwd) => rpc(socket, EVENTS.git.pull, { cwd }),
      discardFile: (cwd, file) => rpc(socket, EVENTS.git.discardFile, { cwd, file }),
    }),
    [socket, statusStore],
  );

  useEffect(() => {
    if (!socket) return;
    const onAdded = (event: WorktreeAddedEvent) => {
      setListing((prev) => {
        const entry = prev[event.projectCwd];
        if (entry === undefined) return prev;
        const nextList: WorktreeInfo[] = Array.isArray(entry) ? [...entry] : [];
        if (nextList.some((w) => w.name === event.worktree.name)) return prev;
        nextList.push(event.worktree);
        return { ...prev, [event.projectCwd]: nextList };
      });
    };
    const onRemoved = (event: WorktreeRemovedEvent) => {
      setListing((prev) => {
        const entry = prev[event.projectCwd];
        if (!Array.isArray(entry)) return prev;
        if (!entry.some((w) => w.name === event.name)) return prev;
        return { ...prev, [event.projectCwd]: entry.filter((w) => w.name !== event.name) };
      });
    };
    const onBranchChanged = (event: WorktreeBranchChangedEvent) => {
      setListing((prev) => {
        const entry = prev[event.projectCwd];
        if (!Array.isArray(entry)) return prev;
        const target = entry.find((w) => w.path === event.worktreePath);
        if (!target || target.branch === event.branch) return prev;
        return {
          ...prev,
          [event.projectCwd]: entry.map((w) =>
            w.path === event.worktreePath ? { ...w, branch: event.branch } : w,
          ),
        };
      });
      void statusStore.refetchIfSubscribed(event.worktreePath);
    };

    socket.on(EVENTS.worktree.added, onAdded);
    socket.on(EVENTS.worktree.removed, onRemoved);
    socket.on(EVENTS.worktree.branchChanged, onBranchChanged);
    return () => {
      socket.off(EVENTS.worktree.added, onAdded);
      socket.off(EVENTS.worktree.removed, onRemoved);
      socket.off(EVENTS.worktree.branchChanged, onBranchChanged);
    };
  }, [socket, statusStore]);

  const state = useMemo<WorktreeState>(() => ({ listing }), [listing]);
  return (
    <GitStateContext.Provider value={state}>
      <GitActionsContext.Provider value={actions}>{children}</GitActionsContext.Provider>
    </GitStateContext.Provider>
  );
}
