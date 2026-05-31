import { GitCommands } from './commands.ts';
import type {
  CreateWorktreeOptions,
  Git,
  GitDiffResult,
  GitLogResult,
  GitStatusResult,
  MinimalLogger,
  WorktreeInfo,
} from './types.ts';
import { GitWorktreeOps } from './worktree.ts';

export class LocalGit implements Git {
  readonly capabilities = { worktree: true } as const;

  private commands: GitCommands;
  private worktree: GitWorktreeOps;

  constructor(logger?: MinimalLogger) {
    this.commands = new GitCommands(logger);
    this.worktree = new GitWorktreeOps(this.commands, logger);
  }

  status = (cwd: string): Promise<GitStatusResult> => this.commands.status(cwd);
  checkout = (cwd: string, branch: string): Promise<void> => this.commands.checkout(cwd, branch);
  log = (cwd: string, limit?: number): Promise<GitLogResult> => this.commands.log(cwd, limit);
  diff = (cwd: string, filePath?: string, status?: string): Promise<GitDiffResult> =>
    this.commands.diff(cwd, filePath, status);
  add = (cwd: string, paths?: string[]): Promise<{ ok: true } | { error: string }> =>
    this.commands.add(cwd, paths);
  commit = (
    cwd: string,
    message: string,
  ): Promise<{ ok: true; hash: string } | { error: string }> => this.commands.commit(cwd, message);
  push = (cwd: string): Promise<{ ok: true } | { error: string }> => this.commands.push(cwd);
  fetch = (cwd: string): Promise<{ ok: true } | { error: string }> => this.commands.fetch(cwd);
  pull = (cwd: string): Promise<{ ok: true; fastForwarded: boolean } | { error: string }> =>
    this.commands.pull(cwd);
  discardFile = (cwd: string, file: string): Promise<{ ok: true } | { error: string }> =>
    this.commands.discardFile(cwd, file);
  getRepoRoot = (cwd: string): Promise<string | null> => this.commands.getRepoRoot(cwd);
  getProjectRoot = (cwd: string): Promise<string | null> => this.commands.getProjectRoot(cwd);
  initRepo = (cwd: string): Promise<{ branch: string }> => this.commands.initRepo(cwd);
  listBranches = (repoRoot: string): Promise<string[]> => this.commands.listBranches(repoRoot);

  createWorktree = (repoRoot: string, opts?: CreateWorktreeOptions): Promise<WorktreeInfo> =>
    this.worktree.createWorktree(repoRoot, opts);
  listWorktrees = (repoRoot: string): Promise<WorktreeInfo[]> =>
    this.worktree.listWorktrees(repoRoot);
  deleteWorktree = (repoRoot: string, name: string): Promise<void> =>
    this.worktree.deleteWorktree(repoRoot, name);
  renameWorktree = (worktreeCwd: string, newBranchName: string): Promise<{ branch: string }> =>
    this.worktree.renameWorktree(worktreeCwd, newBranchName);
  archiveWorktree = (
    repoRoot: string,
    name: string,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { error: string }> =>
    this.worktree.archiveWorktree(repoRoot, name, opts);
}
