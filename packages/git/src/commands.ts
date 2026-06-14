import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import type { SimpleGit } from 'simple-git';
import { AlreadyRepoError, NotARepoError } from './errors.ts';
import { createGit, rawGit } from './git-runner.ts';
import type {
  DiffStatResult,
  GitDiffResult,
  GitLogResult,
  GitStatusResult,
  MinimalLogger,
} from './types.ts';
import { noopLogger } from './types.ts';

const GIT_STATUS_UNTRACKED = '??';
const GIT_STATUS_STAGED_NEW = 'A';

const NOTHING_TO_COMMIT = 'nothing-to-commit';
const RE_NO_UPSTREAM = /no upstream|set-upstream/;
const RE_REJECTED = /rejected|non-fast-forward/;
const RE_ALREADY_UP_TO_DATE = /already up.to.date/i;
const RE_NON_FF = /not possible to fast-forward|non-fast-forward|divergent/;
const RE_NO_TRACKING = /no tracking information|no upstream/;

function toPseudoDiff(filePath: string, content: string): string {
  return `+++ b/${filePath}\n${content
    .split('\n')
    .map((l) => `+${l}`)
    .join('\n')}`;
}

function toChangedFile(f: { index: string; working_dir: string; path: string }) {
  return { status: `${f.index}${f.working_dir}`.trim(), file: f.path };
}

function toLogEntry(e: { hash: string; message: string; author_name: string; date: string }) {
  return { hash: e.hash, message: e.message, author: e.author_name, date: e.date };
}

export class GitCommands {
  private readonly logger: MinimalLogger;

  constructor(logger?: MinimalLogger) {
    this.logger = logger ?? noopLogger;
  }

  async status(cwd: string): Promise<GitStatusResult> {
    const git = createGit(cwd);
    const s = await git.status();
    return {
      branch: s.current ?? 'unknown',
      isClean: s.isClean(),
      changedFiles: s.files.map(toChangedFile),
      ahead: s.ahead,
      behind: s.behind,
      hasUpstream: s.tracking != null,
    };
  }

  async diffStat(cwd: string): Promise<DiffStatResult> {
    const git = createGit(cwd);
    const [unstaged, staged] = await Promise.all([
      rawGit(git, ['diff', '--numstat']),
      rawGit(git, ['diff', '--numstat', '--cached']),
    ]);
    const map = new Map<string, { insertions: number; deletions: number }>();
    for (const output of [unstaged.stdout, staged.stdout]) {
      for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        const ins = parts[0] ?? '-';
        const del = parts[1] ?? '-';
        const file = parts.slice(2).join('\t');
        const insertions = ins === '-' ? 0 : Number.parseInt(ins, 10);
        const deletions = del === '-' ? 0 : Number.parseInt(del, 10);
        const existing = map.get(file);
        if (existing) {
          existing.insertions += insertions;
          existing.deletions += deletions;
        } else {
          map.set(file, { insertions, deletions });
        }
      }
    }
    let totalInsertions = 0;
    let totalDeletions = 0;
    const files = [...map.entries()].map(([file, stats]) => {
      totalInsertions += stats.insertions;
      totalDeletions += stats.deletions;
      return { file, ...stats };
    });
    return { files, totalInsertions, totalDeletions };
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    const git = createGit(cwd);
    await this.checkoutWithFallback(git, branch);
  }

  async log(cwd: string, limit?: number): Promise<GitLogResult> {
    const git = createGit(cwd);
    const result = await git.log({ maxCount: limit ?? 20 });
    return { entries: result.all.map(toLogEntry) };
  }

  async diff(cwd: string, filePath?: string, status?: string): Promise<GitDiffResult> {
    const git = createGit(cwd);
    if (!filePath) {
      return { diff: await git.diff() };
    }
    if (status === GIT_STATUS_UNTRACKED) {
      const absolute = resolve(cwd, filePath);
      const content = await readFile(absolute, 'utf-8').catch(() => '');
      return { diff: toPseudoDiff(filePath, content) };
    }
    if (status === GIT_STATUS_STAGED_NEW) {
      return { diff: await git.diff(['--staged', '--', filePath]) };
    }
    return { diff: await git.diff(['HEAD', '--', filePath]) };
  }

  async add(cwd: string, paths?: string[]): Promise<{ ok: true } | { error: string }> {
    const args = paths && paths.length > 0 ? ['add', '--', ...paths] : ['add', '-A'];
    return this.runGitCmd(cwd, args);
  }

  async commit(
    cwd: string,
    message: string,
  ): Promise<{ ok: true; hash: string } | { error: string }> {
    const git = createGit(cwd);
    const status = await git.status();
    if (status.staged.length === 0) return { error: NOTHING_TO_COMMIT };
    const result = await rawGit(git, ['commit', '-m', message], this.logger);
    if (result.exitCode !== 0) {
      return { error: result.stdout.trim() || 'git commit failed' };
    }
    const hash = (await rawGit(git, ['rev-parse', 'HEAD'], this.logger)).stdout.trim();
    return { ok: true, hash };
  }

  async push(cwd: string): Promise<{ ok: true } | { error: string }> {
    const result = await rawGit(createGit(cwd), ['push'], this.logger);
    if (result.exitCode === 0) return { ok: true };
    const out = result.stdout.toLowerCase();
    if (RE_NO_UPSTREAM.test(out)) return { error: 'no-upstream' };
    if (RE_REJECTED.test(out)) return { error: 'rejected' };
    return { error: result.stdout.trim() || 'git push failed' };
  }

  async fetch(cwd: string): Promise<{ ok: true } | { error: string }> {
    return this.runGitCmd(cwd, ['fetch', '--all']);
  }

  async discardFile(cwd: string, file: string): Promise<{ ok: true } | { error: string }> {
    return this.runGitCmd(cwd, ['checkout', '--', file]);
  }

  async pull(cwd: string): Promise<{ ok: true; fastForwarded: boolean } | { error: string }> {
    const result = await rawGit(createGit(cwd), ['pull', '--ff-only'], this.logger);
    if (result.exitCode === 0) {
      const fastForwarded = !RE_ALREADY_UP_TO_DATE.test(result.stdout);
      return { ok: true, fastForwarded };
    }
    const out = result.stdout.toLowerCase();
    if (RE_NON_FF.test(out)) return { error: 'non-ff' };
    if (RE_NO_TRACKING.test(out)) return { error: 'no-upstream' };
    return { error: result.stdout.trim() || 'git pull failed' };
  }

  private async runGitCmd(cwd: string, args: string[]): Promise<{ ok: true } | { error: string }> {
    const result = await rawGit(createGit(cwd), args, this.logger);
    return result.exitCode === 0
      ? { ok: true }
      : { error: result.stdout.trim() || `git ${args.join(' ')} failed` };
  }

  async getRepoRoot(cwd: string): Promise<string | null> {
    try {
      return (await createGit(cwd).revparse(['--show-toplevel'])).trim();
    } catch (err) {
      this.logger.debug({ err }, '[Git] getRepoRoot failed');
      return null;
    }
  }

  async getProjectRoot(cwd: string): Promise<string | null> {
    try {
      const git = createGit(cwd);
      const commonDir = (await git.revparse(['--git-common-dir'])).trim();
      const absolute = isAbsolute(commonDir) ? commonDir : resolve(cwd, commonDir);
      const dotGitIdx = absolute.lastIndexOf(`${sep}.git`);
      if (dotGitIdx === -1) return absolute;
      return absolute.slice(0, dotGitIdx);
    } catch (err) {
      this.logger.debug({ err }, '[Git] getProjectRoot failed');
      return null;
    }
  }

  async initRepo(cwd: string): Promise<{ branch: string }> {
    if ((await this.getRepoRoot(cwd)) !== null) throw new AlreadyRepoError(cwd);
    const git = createGit(cwd);
    await git.raw(['init', '-b', 'main']);
    try {
      await git.raw(['commit', '--allow-empty', '-m', 'Initial commit']);
    } catch (err) {
      this.logger.debug({ err }, '[Git] commit without user config failed, retrying');
      await git.raw([
        '-c',
        'user.email=code-quest@local',
        '-c',
        'user.name=code-quest',
        'commit',
        '--allow-empty',
        '-m',
        'Initial commit',
      ]);
    }
    return { branch: 'main' };
  }

  async listBranches(repoRoot: string): Promise<string[]> {
    if ((await this.getRepoRoot(repoRoot)) === null) throw new NotARepoError(repoRoot);
    const result = await rawGit(
      createGit(repoRoot),
      ['branch', '--list', '--format=%(refname:short)'],
      this.logger,
    );
    if (result.exitCode === 0) {
      return result.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    }
    return [];
  }

  private async checkoutWithFallback(git: SimpleGit, branch: string): Promise<void> {
    try {
      await git.checkout(branch);
      return;
    } catch (err) {
      this.logger.debug({ err }, '[Git] checkout strategy 1 failed');
    }
    try {
      await git.fetch('origin');
      await git.checkout(branch);
      return;
    } catch (err) {
      this.logger.debug({ err }, '[Git] checkout strategy 2 failed');
    }
    await git.checkout(['-t', `origin/${branch}`]);
  }
}
