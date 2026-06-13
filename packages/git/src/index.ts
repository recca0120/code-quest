export { AlreadyRepoError, NotARepoError } from './errors.ts';
export { LocalGit } from './local-git.ts';
export { RemoteGit } from './remote-git.ts';
export type {
  CreateWorktreeOptions,
  DiffStatFile,
  DiffStatResult,
  Git,
  GitAddResult,
  GitCommitResult,
  GitDiffResult,
  GitDiscardFileResult,
  GitFetchResult,
  GitFileChange,
  GitLogEntry,
  GitLogResult,
  GitPullResult,
  GitPushResult,
  GitStatusResult,
  WorktreeInfo,
} from './types.ts';
export { assertWorktreeName, detectWorktree } from './worktree.ts';
