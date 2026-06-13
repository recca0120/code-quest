import {
  fsMutationResultSchema,
  gitAddResultSchema,
  gitBranchListSchema,
  gitBranchResultSchema,
  gitCommitResultSchema,
  gitDiffResultSchema,
  gitDiscardFileResultSchema,
  gitFetchResultSchema,
  gitLogResultSchema,
  gitNullableRootSchema,
  gitPullResultSchema,
  gitPushResultSchema,
  gitStatusResultSchema,
  gitWorktreeListSchema,
  REMOTE_METHODS,
  worktreeInfoSchema,
} from '@code-quest/schemas';
import type {
  CreateWorktreeOptions,
  DiffStatResult,
  Git,
  GitAddResult,
  GitCommitResult,
  GitDiffResult,
  GitDiscardFileResult,
  GitFetchResult,
  GitLogResult,
  GitPullResult,
  GitPushResult,
  GitStatusResult,
  RemoteRpc,
  WorktreeInfo,
} from './types.ts';

export class RemoteGit implements Git {
  readonly capabilities = { worktree: true };
  private readonly rpc: RemoteRpc;

  constructor(rpc: RemoteRpc) {
    this.rpc = rpc;
  }

  async status(cwd: string): Promise<GitStatusResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.status, { cwd });
    return gitStatusResultSchema.parse(raw);
  }

  async diffStat(cwd: string): Promise<DiffStatResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.diffStat, { cwd });
    return raw as DiffStatResult;
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    await this.rpc.request(REMOTE_METHODS.git.checkout, { cwd, branch });
  }

  async log(cwd: string, limit?: number): Promise<GitLogResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.log, { cwd, limit });
    return gitLogResultSchema.parse(raw);
  }

  async diff(cwd: string, filePath?: string, status?: string): Promise<GitDiffResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.diff, { cwd, filePath, status });
    return gitDiffResultSchema.parse(raw);
  }

  async add(cwd: string, paths?: string[]): Promise<GitAddResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.add, { cwd, paths });
    return gitAddResultSchema.parse(raw);
  }

  async commit(cwd: string, message: string): Promise<GitCommitResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.commit, { cwd, message });
    return gitCommitResultSchema.parse(raw);
  }

  async push(cwd: string): Promise<GitPushResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.push, { cwd });
    return gitPushResultSchema.parse(raw);
  }

  async fetch(cwd: string): Promise<GitFetchResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.fetch, { cwd });
    return gitFetchResultSchema.parse(raw);
  }

  async pull(cwd: string): Promise<GitPullResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.pull, { cwd });
    return gitPullResultSchema.parse(raw);
  }

  async discardFile(cwd: string, file: string): Promise<GitDiscardFileResult> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.discardFile, { cwd, file });
    return gitDiscardFileResultSchema.parse(raw);
  }

  private async _getRoot(method: string, cwd: string): Promise<string | null> {
    const raw = await this.rpc.request(method, { cwd });
    return gitNullableRootSchema.parse(raw);
  }

  async getRepoRoot(cwd: string): Promise<string | null> {
    return this._getRoot(REMOTE_METHODS.git.getRepoRoot, cwd);
  }

  async getProjectRoot(cwd: string): Promise<string | null> {
    return this._getRoot(REMOTE_METHODS.git.getProjectRoot, cwd);
  }

  async initRepo(cwd: string): Promise<{ branch: string }> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.initRepo, { cwd });
    return gitBranchResultSchema.parse(raw);
  }

  async listBranches(repoRoot: string): Promise<string[]> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.listBranches, { repoRoot });
    return gitBranchListSchema.parse(raw);
  }

  async createWorktree(repoRoot: string, opts?: CreateWorktreeOptions): Promise<WorktreeInfo> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.createWorktree, { repoRoot, opts });
    return worktreeInfoSchema.parse(raw);
  }

  async listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.listWorktrees, { repoRoot });
    return gitWorktreeListSchema.parse(raw);
  }

  async deleteWorktree(repoRoot: string, name: string): Promise<void> {
    await this.rpc.request(REMOTE_METHODS.git.deleteWorktree, { repoRoot, name });
  }

  async renameWorktree(worktreeCwd: string, newBranchName: string): Promise<{ branch: string }> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.renameWorktree, {
      worktreeCwd,
      newBranchName,
    });
    return gitBranchResultSchema.parse(raw);
  }

  async archiveWorktree(
    repoRoot: string,
    name: string,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { error: string }> {
    const raw = await this.rpc.request(REMOTE_METHODS.git.archiveWorktree, {
      repoRoot,
      name,
      opts,
    });
    return fsMutationResultSchema.parse(raw);
  }
}
