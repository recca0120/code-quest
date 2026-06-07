import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateBranchName, validateWorktreeName } from '@code-quest/utils';
import type { GitCommands } from './commands.ts';
import { NotARepoError } from './errors.ts';
import { createGit, rawGit } from './git-runner.ts';
import type { CreateWorktreeOptions, MinimalLogger, WorktreeInfo } from './types.ts';
import { noopLogger } from './types.ts';

const WORKTREE_PATH_RE = /[/\\]\.claude[/\\]worktrees[/\\]([^/\\]+)$/;
const WORKTREE_BRANCH_PREFIX = 'worktree-';

function worktreeDir(repoRoot: string, name: string): string {
  return join(repoRoot, '.claude', 'worktrees', name);
}

export function assertWorktreeName(name: string): void {
  const err = validateWorktreeName(name);
  if (err) throw new Error(`Invalid worktree name: ${err}`);
}

export function detectWorktree(path: string): WorktreeInfo | null {
  const match = WORKTREE_PATH_RE.exec(path);
  if (!match) return null;
  return { name: match[1] ?? '', path };
}

function toWorktreeInfo(entry: { worktreePath?: string; branch?: string }): WorktreeInfo | null {
  if (!entry.worktreePath) return null;
  const match = entry.worktreePath.match(WORKTREE_PATH_RE);
  if (match) {
    return { name: match[1] ?? '', path: entry.worktreePath, branch: entry.branch };
  }
  const fallback = entry.worktreePath.split(/[/\\]/).filter(Boolean).pop() ?? '';
  const name = entry.branch ?? fallback;
  return { name, path: entry.worktreePath, branch: entry.branch };
}

function parseWorktreeList(stdout: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  let current: { worktreePath?: string; branch?: string } = {};

  const flush = () => {
    const info = toWorktreeInfo(current);
    if (info) worktrees.push(info);
    current = {};
  };

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      current.worktreePath = line.slice('worktree '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === '') {
      flush();
    }
  }
  flush();

  return worktrees;
}

export class GitWorktreeOps {
  private readonly commands: GitCommands;
  private readonly logger: MinimalLogger;

  constructor(commands: GitCommands, logger?: MinimalLogger) {
    this.commands = commands;
    this.logger = logger ?? noopLogger;
  }

  private resolveWorktreeParams(opts: CreateWorktreeOptions): {
    worktreeName: string;
    branch: string;
    createBranch: boolean;
  } {
    const { existingBranch, newBranch, name } = opts;
    if (existingBranch) {
      return {
        worktreeName: name ?? this.branchToSlug(existingBranch),
        branch: existingBranch,
        createBranch: false,
      };
    }
    if (newBranch) {
      return {
        worktreeName: name ?? this.branchToSlug(newBranch),
        branch: newBranch,
        createBranch: true,
      };
    }
    const worktreeName = name ?? this.generateWorktreeName();
    return {
      worktreeName,
      branch: `${WORKTREE_BRANCH_PREFIX}${worktreeName}`,
      createBranch: true,
    };
  }

  async createWorktree(repoRoot: string, opts: CreateWorktreeOptions = {}): Promise<WorktreeInfo> {
    const { baseBranch, path } = opts;
    const { worktreeName, branch, createBranch } = this.resolveWorktreeParams(opts);
    assertWorktreeName(worktreeName);

    const worktreePath = path ?? worktreeDir(repoRoot, worktreeName);

    if (await this.isExistingWorktree(worktreePath)) {
      return { name: worktreeName, path: worktreePath, branch };
    }

    if (createBranch) {
      const isAutoBranch = branch === `${WORKTREE_BRANCH_PREFIX}${worktreeName}` && !opts.newBranch;
      await this.addWorktree(repoRoot, worktreePath, branch, baseBranch, isAutoBranch);
    } else {
      await mkdir(join(worktreePath, '..'), { recursive: true });
      const result = await rawGit(createGit(repoRoot), ['worktree', 'add', worktreePath, branch]);
      if (result.exitCode !== 0) {
        throw new Error(result.stdout.trim() || 'git worktree add failed');
      }
    }
    this.logger.debug({ name: worktreeName, cwd: worktreePath }, 'Worktree created');
    return { name: worktreeName, path: worktreePath, branch };
  }

  async listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    if ((await this.commands.getRepoRoot(repoRoot)) === null) {
      throw new NotARepoError(repoRoot);
    }
    const result = await rawGit(createGit(repoRoot), ['worktree', 'list', '--porcelain']);
    if (result.exitCode !== 0) return [];
    return parseWorktreeList(result.stdout);
  }

  async deleteWorktree(repoRoot: string, name: string): Promise<void> {
    assertWorktreeName(name);
    const worktreePath = worktreeDir(repoRoot, name);
    const branchName = `${WORKTREE_BRANCH_PREFIX}${name}`;
    const git = createGit(repoRoot);

    await rawGit(git, ['worktree', 'remove', worktreePath]);
    await rawGit(git, ['branch', '-D', branchName]);
    this.logger.debug({ name, repoRoot }, 'Worktree deleted');
  }

  async renameWorktree(worktreeCwd: string, newBranchName: string): Promise<{ branch: string }> {
    const branchErr = validateBranchName(newBranchName);
    if (branchErr) throw new Error(`Invalid branch name: ${branchErr}`);
    const result = await rawGit(createGit(worktreeCwd), ['branch', '-m', newBranchName]);
    if (result.exitCode !== 0) {
      throw new Error(result.stdout || `git branch -m failed (exit ${result.exitCode})`);
    }
    return { branch: newBranchName };
  }

  async archiveWorktree(
    repoRoot: string,
    name: string,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { error: string }> {
    assertWorktreeName(name);
    const worktreePath = worktreeDir(repoRoot, name);
    const args = ['worktree', 'remove', worktreePath];
    if (opts?.force) args.push('--force');
    const result = await rawGit(createGit(repoRoot), args);
    if (result.exitCode !== 0) {
      const errorText = result.stdout.toLowerCase();
      if (/(modified|untracked|locked|not empty|contains modifications)/.test(errorText)) {
        return { error: 'dirty' };
      }
      return { error: result.stdout || `git worktree remove failed (exit ${result.exitCode})` };
    }
    return { ok: true };
  }

  private branchToSlug(branch: string): string {
    return branch.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  private generateWorktreeName(): string {
    return `claude-session-${new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14)}`;
  }

  private async isExistingWorktree(worktreePath: string): Promise<boolean> {
    try {
      const check = await rawGit(createGit(worktreePath), ['rev-parse', '--show-toplevel']);
      return check.exitCode === 0 && resolve(check.stdout.trim()) === resolve(worktreePath);
    } catch {
      return false;
    }
  }

  private async addWorktree(
    repoRoot: string,
    worktreePath: string,
    branchName: string,
    baseBranchOverride: string | undefined,
    allowBranchNuke: boolean,
  ): Promise<void> {
    await mkdir(join(worktreePath, '..'), { recursive: true });

    const git = createGit(repoRoot);
    const defaultBranch = baseBranchOverride ?? (await this.getDefaultBranch(repoRoot));
    let base = defaultBranch;
    if (!baseBranchOverride) {
      const [fetchResult] = await Promise.all([
        rawGit(git, ['fetch', 'origin', defaultBranch]),
        rawGit(git, ['worktree', 'prune']),
      ]);
      base = fetchResult.exitCode === 0 ? `origin/${defaultBranch}` : 'HEAD';
    } else {
      await rawGit(git, ['worktree', 'prune']);
    }
    if (allowBranchNuke) {
      await rawGit(git, ['branch', '-D', branchName]);
    }

    const result = await rawGit(git, ['worktree', 'add', '-b', branchName, worktreePath, base]);
    if (result.exitCode !== 0) {
      throw new Error(result.stdout.trim() || 'git worktree add failed');
    }
  }

  private async getDefaultBranch(repoRoot: string): Promise<string> {
    const git = createGit(repoRoot);
    const result = await rawGit(git, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    if (result.exitCode === 0) {
      return result.stdout.trim().replace('refs/remotes/origin/', '');
    }
    for (const name of ['main', 'master']) {
      const check = await rawGit(git, [
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/remotes/origin/${name}`,
      ]);
      if (check.exitCode === 0) return name;
    }
    return 'main';
  }
}
