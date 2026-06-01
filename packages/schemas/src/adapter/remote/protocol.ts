// JSON-RPC 2.0 types for remote summoner ↔ server communication.
import type { z } from 'zod';
import type { fsReadFileAbsoluteResponseSchema } from './protocol-schemas.ts';

// ---------- Framing ----------

export interface JsonRpcRequest<M extends string = string, P = unknown> {
  id: number | string;
  method: M;
  params: P;
}

export interface JsonRpcResponse<R = unknown> {
  id: number | string;
  result?: R;
  error?: JsonRpcError;
}

export interface JsonRpcNotification<M extends string = string, P = unknown> {
  method: M;
  params: P;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ---------- Common ----------

export interface OkResult {
  ok: true;
}

// ---------- process/spawn ----------

export interface ProcessSpawnParams {
  sessionId: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export type ProcessSpawnResult = OkResult;

// ---------- process/stdin ----------

export interface ProcessStdinParams {
  sessionId: string;
  data: string;
}

export type ProcessStdinResult = OkResult;

// ---------- process/kill ----------

export interface ProcessKillParams {
  sessionId: string;
}

export type ProcessKillResult = OkResult;

// ---------- process/stdout (notification: summoner → server) ----------

export interface ProcessStdoutParams {
  sessionId: string;
  line: string;
}

// ---------- process/stderr (notification: summoner → server) ----------

export interface ProcessStderrParams {
  sessionId: string;
  line: string;
}

// ---------- process/exit (notification: summoner → server) ----------

export interface ProcessExitParams {
  sessionId: string;
  code: number | null;
}

// ---------- fs/read ----------

export interface FsReadParams {
  cwd: string;
  filePath: string;
}

export type FsReadResult = { content: string } | { error: string };

// ---------- fs/list ----------

export interface FsListParams {
  cwd: string;
  pattern: string;
}

export interface FsListResult {
  files: Array<{ path: string; name: string; type: 'file' | 'directory' }>;
}

// ---------- fs/browseDirectories ----------

export interface FsBrowseDirectoriesParams {
  path?: string;
}

export interface FsBrowseDirectoriesResult {
  entries: Array<{ name: string; path: string }>;
}

// ---------- fs/browseEntries ----------

export interface FsBrowseEntriesParams {
  path?: string;
  showHidden?: boolean;
}

export interface FsBrowseEntriesResult {
  directories: Array<{ name: string; path: string }>;
  files: Array<{ name: string; path: string }>;
}

// ---------- fs/readFileAbsolute ----------

export interface FsReadFileAbsoluteParams {
  absolutePath: string;
}

export type FsReadFileAbsoluteResult = z.infer<typeof fsReadFileAbsoluteResponseSchema>;

// ---------- fs/writeFile ----------

export interface FsWriteFileAbsoluteParams {
  absolutePath: string;
  content: string;
}

export type FsWriteFileAbsoluteResult = { ok: true } | { error: string };

// ---------- fs/create ----------

export interface FsCreateParams {
  absolutePath: string;
  kind: 'file' | 'directory';
}

// ---------- fs/delete ----------

export interface FsDeleteParams {
  absolutePath: string;
}

// ---------- fs/rename ----------

export interface FsRenameParams {
  from: string;
  to: string;
}

// ---------- fs/copy ----------

export interface FsCopyParams {
  from: string;
  to: string;
}

// ---------- fs/move ----------

export interface FsMoveParams {
  from: string;
  to: string;
}

// ---------- fs/exists ----------

export interface FsExistsParams {
  path: string;
}

export interface FsExistsResult {
  exists: boolean;
}

// ---------- fs/isDirectory ----------

export interface FsIsDirectoryParams {
  path: string;
}

export interface FsIsDirectoryResult {
  isDirectory: boolean;
}

// ---------- fs/statKind ----------

export interface FsStatKindParams {
  path: string;
}

export interface FsStatKindResult {
  kind: 'file' | 'directory' | null;
}

// ---------- git/* ----------

export interface GitCwdParams {
  cwd: string;
}

export interface GitCheckoutParams {
  cwd: string;
  branch: string;
}

export interface GitLogParams {
  cwd: string;
  limit?: number;
}

export interface GitDiffParams {
  cwd: string;
  filePath?: string;
  status?: string;
}

export interface GitAddParams {
  cwd: string;
  paths?: string[];
}

export interface GitCommitParams {
  cwd: string;
  message: string;
}

export interface GitDiscardFileParams {
  cwd: string;
  file: string;
}

export interface GitListBranchesParams {
  repoRoot: string;
}

export interface GitCreateWorktreeParams {
  repoRoot: string;
  opts?: {
    name?: string;
    existingBranch?: string;
    newBranch?: string;
    baseBranch?: string;
    path?: string;
  };
}

export interface GitListWorktreesParams {
  repoRoot: string;
}

export interface GitDeleteWorktreeParams {
  repoRoot: string;
  name: string;
}

export interface GitRenameWorktreeParams {
  worktreeCwd: string;
  newBranchName: string;
}

export interface GitArchiveWorktreeParams {
  repoRoot: string;
  name: string;
  opts?: { force?: boolean };
}

// ---------- Typed request/response/notification unions ----------

export type RemoteRequest =
  | JsonRpcRequest<'process/spawn', ProcessSpawnParams>
  | JsonRpcRequest<'process/stdin', ProcessStdinParams>
  | JsonRpcRequest<'process/kill', ProcessKillParams>
  | JsonRpcRequest<'fs/read', FsReadParams>
  | JsonRpcRequest<'fs/list', FsListParams>
  | JsonRpcRequest<'fs/browseDirectories', FsBrowseDirectoriesParams>
  | JsonRpcRequest<'fs/browseEntries', FsBrowseEntriesParams>
  | JsonRpcRequest<'fs/readFileAbsolute', FsReadFileAbsoluteParams>
  | JsonRpcRequest<'fs/writeFile', FsWriteFileAbsoluteParams>
  | JsonRpcRequest<'fs/create', FsCreateParams>
  | JsonRpcRequest<'fs/delete', FsDeleteParams>
  | JsonRpcRequest<'fs/rename', FsRenameParams>
  | JsonRpcRequest<'fs/copy', FsCopyParams>
  | JsonRpcRequest<'fs/move', FsMoveParams>
  | JsonRpcRequest<'fs/exists', FsExistsParams>
  | JsonRpcRequest<'fs/isDirectory', FsIsDirectoryParams>
  | JsonRpcRequest<'fs/statKind', FsStatKindParams>
  | JsonRpcRequest<'git/status', GitCwdParams>
  | JsonRpcRequest<'git/checkout', GitCheckoutParams>
  | JsonRpcRequest<'git/log', GitLogParams>
  | JsonRpcRequest<'git/diff', GitDiffParams>
  | JsonRpcRequest<'git/add', GitAddParams>
  | JsonRpcRequest<'git/commit', GitCommitParams>
  | JsonRpcRequest<'git/push', GitCwdParams>
  | JsonRpcRequest<'git/fetch', GitCwdParams>
  | JsonRpcRequest<'git/pull', GitCwdParams>
  | JsonRpcRequest<'git/discardFile', GitDiscardFileParams>
  | JsonRpcRequest<'git/getRepoRoot', GitCwdParams>
  | JsonRpcRequest<'git/getProjectRoot', GitCwdParams>
  | JsonRpcRequest<'git/initRepo', GitCwdParams>
  | JsonRpcRequest<'git/listBranches', GitListBranchesParams>
  | JsonRpcRequest<'git/createWorktree', GitCreateWorktreeParams>
  | JsonRpcRequest<'git/listWorktrees', GitListWorktreesParams>
  | JsonRpcRequest<'git/deleteWorktree', GitDeleteWorktreeParams>
  | JsonRpcRequest<'git/renameWorktree', GitRenameWorktreeParams>
  | JsonRpcRequest<'git/archiveWorktree', GitArchiveWorktreeParams>;

export type RemoteNotification =
  | JsonRpcNotification<'process/stdout', ProcessStdoutParams>
  | JsonRpcNotification<'process/stderr', ProcessStderrParams>
  | JsonRpcNotification<'process/exit', ProcessExitParams>;
