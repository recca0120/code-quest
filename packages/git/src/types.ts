// ── Domain types ──

export type GitFileChange = { status: string; file: string };
export type GitLogEntry = { hash: string; message: string; author: string; date: string };

export type GitStatusResult = {
  branch: string;
  isClean: boolean;
  changedFiles: GitFileChange[];
  ahead?: number;
  behind?: number;
  hasUpstream?: boolean;
};

export type GitLogResult = { entries: GitLogEntry[] } | { error: string };
export type GitDiffResult = { diff: string };

export type GitAddResult = { ok: true } | { error: string };
export type GitCommitResult = { ok: true; hash: string } | { error: string };
export type GitPushResult = { ok: true } | { error: string };
export type GitFetchResult = { ok: true } | { error: string };
export type GitPullResult = { ok: true; fastForwarded: boolean } | { error: string };
export type GitDiscardFileResult = { ok: true } | { error: string };

export type WorktreeInfo = { name: string; path: string; branch?: string };

// ── Service interfaces ──

export interface CreateWorktreeOptions {
  name?: string;
  existingBranch?: string;
  newBranch?: string;
  baseBranch?: string;
  path?: string;
}

interface GitCapabilities {
  readonly worktree: boolean;
}

export interface Git {
  readonly capabilities: GitCapabilities;

  status(cwd: string): Promise<GitStatusResult>;
  checkout(cwd: string, branch: string): Promise<void>;
  log(cwd: string, limit?: number): Promise<GitLogResult>;
  diff(cwd: string, filePath?: string, status?: string): Promise<GitDiffResult>;
  add(cwd: string, paths?: string[]): Promise<GitAddResult>;
  commit(cwd: string, message: string): Promise<GitCommitResult>;
  push(cwd: string): Promise<GitPushResult>;
  fetch(cwd: string): Promise<GitFetchResult>;
  pull(cwd: string): Promise<GitPullResult>;
  discardFile(cwd: string, file: string): Promise<GitDiscardFileResult>;
  getRepoRoot(cwd: string): Promise<string | null>;
  getProjectRoot(cwd: string): Promise<string | null>;
  initRepo(cwd: string): Promise<{ branch: string }>;
  listBranches(repoRoot: string): Promise<string[]>;
  createWorktree(repoRoot: string, opts?: CreateWorktreeOptions): Promise<WorktreeInfo>;
  listWorktrees(repoRoot: string): Promise<WorktreeInfo[]>;
  deleteWorktree(repoRoot: string, name: string): Promise<void>;
  renameWorktree(worktreeCwd: string, newBranchName: string): Promise<{ branch: string }>;
  archiveWorktree(
    repoRoot: string,
    name: string,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { error: string }>;
}

export interface MinimalLogger {
  debug(obj: object, msg: string): void;
  warn(msg: string): void;
  error(obj: object, msg: string): void;
}

export interface RemoteRpc {
  request<R = unknown>(method: string, params: unknown): Promise<R>;
}

export const noopLogger: MinimalLogger = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};
