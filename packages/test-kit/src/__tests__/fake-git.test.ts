import { FakeGit } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';

describe('FakeGit', () => {
  describe('status', () => {
    it('returns default branch and clean state', async () => {
      const git = new FakeGit();
      const result = await git.status('/repo');
      expect(result).toMatchObject({ branch: 'main', isClean: true, changedFiles: [] });
    });

    it('returns configured state', async () => {
      const git = new FakeGit();
      git.setBranch('feature-x');
      git.setClean(false);
      git.setChangedFiles([{ status: 'M', file: 'index.ts' }]);

      const result = await git.status('/repo');
      expect(result.branch).toBe('feature-x');
      expect(result.isClean).toBe(false);
      expect(result.changedFiles).toHaveLength(1);
    });
  });

  describe('checkout', () => {
    it('succeeds by default', async () => {
      const git = new FakeGit();
      await expect(git.checkout('/repo', 'feature-x')).resolves.toBeUndefined();
    });

    it('throws when error configured', async () => {
      const git = new FakeGit();
      git.setCheckoutError(new Error('no such branch'));
      await expect(git.checkout('/repo', 'bad')).rejects.toThrow('no such branch');
    });
  });

  describe('log', () => {
    it('returns configured entries', async () => {
      const git = new FakeGit();
      git.setLogEntries([
        { hash: 'abc', message: 'feat', author: 'A', date: '2024-01-01' },
        { hash: 'def', message: 'fix', author: 'B', date: '2024-01-02' },
      ]);
      const result = await git.log('/repo');
      if (!('entries' in result)) throw new Error('expected entries');
      expect(result.entries).toHaveLength(2);
    });

    it('respects limit', async () => {
      const git = new FakeGit();
      git.setLogEntries([
        { hash: 'a', message: 'a', author: 'A', date: '1' },
        { hash: 'b', message: 'b', author: 'B', date: '2' },
        { hash: 'c', message: 'c', author: 'C', date: '3' },
      ]);
      const result = await git.log('/repo', 2);
      if (!('entries' in result)) throw new Error('expected entries');
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('diff', () => {
    it('returns configured diff', async () => {
      const git = new FakeGit();
      git.setDiff('+added');
      const result = await git.diff('/repo');
      expect(result.diff).toBe('+added');
    });
  });

  describe('worktree', () => {
    it('getRepoRoot returns configured root', async () => {
      const git = new FakeGit();
      expect(await git.getRepoRoot('/repo/src')).toBe('/repo');
    });

    it('getRepoRoot returns null when not a repo', async () => {
      const git = new FakeGit();
      git.setRepoRoot(null);
      expect(await git.getRepoRoot('/tmp')).toBeNull();
    });

    it('createWorktree adds and returns worktree', async () => {
      const git = new FakeGit();
      const wt = await git.createWorktree('/repo', { name: 'my-task' });
      expect(wt.name).toBe('my-task');
      expect(wt.branch).toBe('worktree-my-task');
      expect(await git.listWorktrees('/repo')).toHaveLength(1);
    });

    it('listWorktrees returns added worktrees', async () => {
      const git = new FakeGit();
      git.addWorktree({
        name: 'wt-1',
        path: '/repo/.claude/worktrees/wt-1',
        branch: 'worktree-wt-1',
      });
      expect(await git.listWorktrees('/repo')).toHaveLength(1);
    });

    it('deleteWorktree removes worktree', async () => {
      const git = new FakeGit();
      await git.createWorktree('/repo', { name: 'to-delete' });
      await git.deleteWorktree('/repo', 'to-delete');
      expect(await git.listWorktrees('/repo')).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      const git = new FakeGit();
      git.setBranch('other');
      git.setDiff('+x');
      git.addWorktree({ name: 'wt', path: '/p', branch: 'b' });
      git.reset();

      expect((await git.status('/r')).branch).toBe('main');
      expect((await git.diff('/r')).diff).toBe('');
      // After reset, only the default-seeded /repo is treated as a git repo.
      expect(await git.listWorktrees('/repo')).toHaveLength(0);
    });
  });

  describe('renameWorktree', () => {
    it('updates branch on a registered worktree', async () => {
      const git = new FakeGit();
      git.addWorktree({ name: 'feat-x', path: '/repo/.wt/feat-x', branch: 'old' });
      const result = await git.renameWorktree('/repo/.wt/feat-x', 'new-name');
      expect(result).toEqual({ branch: 'new-name' });
      const wts = await git.listWorktrees('/repo');
      expect(wts.find((w) => w.path === '/repo/.wt/feat-x')?.branch).toBe('new-name');
    });

    it('throws when worktree path is not registered', async () => {
      const git = new FakeGit();
      await expect(git.renameWorktree('/unknown', 'x')).rejects.toThrow(
        'Worktree not registered at /unknown',
      );
    });
  });

  describe('archiveWorktree', () => {
    it('removes the worktree entry, keeping repo otherwise intact', async () => {
      const git = new FakeGit();
      git.addWorktree({ name: 'feat-x', path: '/repo/.wt/feat-x', branch: 'old' });
      const result = await git.archiveWorktree('/repo', 'feat-x');
      expect(result).toEqual({ ok: true });
      const wts = await git.listWorktrees('/repo');
      expect(wts.find((w) => w.name === 'feat-x')).toBeUndefined();
    });

    it('returns dirty error when configured', async () => {
      const git = new FakeGit();
      git.addWorktree({ name: 'feat-x', path: '/repo/.wt/feat-x', branch: 'old' });
      git.setArchiveDirty(true);
      const result = await git.archiveWorktree('/repo', 'feat-x');
      expect(result).toEqual({ error: 'dirty' });
      // worktree NOT removed when dirty
      expect((await git.listWorktrees('/repo')).some((w) => w.name === 'feat-x')).toBe(true);
    });

    it('force=true bypasses dirty check', async () => {
      const git = new FakeGit();
      git.addWorktree({ name: 'feat-x', path: '/repo/.wt/feat-x', branch: 'old' });
      git.setArchiveDirty(true);
      const result = await git.archiveWorktree('/repo', 'feat-x', { force: true });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('add/commit/push', () => {
    it('add (no paths) stages all changed files into counter', async () => {
      const git = new FakeGit();
      git.setChangedFiles([
        { status: 'M', file: 'a.ts' },
        { status: '??', file: 'b.ts' },
      ]);
      await git.add('/repo');
      expect(git.stagedCount).toBe(2);
    });

    it('commit returns hash and clears state', async () => {
      const git = new FakeGit();
      git.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
      await git.add('/repo');
      const result = await git.commit('/repo', 'wip');
      expect(result).toMatchObject({ ok: true });
      if ('hash' in result) expect(result.hash).toMatch(/^fake-/);
      expect(git.stagedCount).toBe(0);
    });

    it('commit returns nothing-to-commit error when no staged files', async () => {
      const git = new FakeGit();
      expect(await git.commit('/repo', 'wip')).toEqual({ error: 'nothing-to-commit' });
    });

    it('commit surfaces configured error', async () => {
      const git = new FakeGit();
      git.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
      await git.add('/repo');
      git.setCommitError('hook-failed');
      expect(await git.commit('/repo', 'wip')).toEqual({ error: 'hook-failed' });
    });

    it('push returns ok by default and surfaces configured error', async () => {
      const git = new FakeGit();
      expect(await git.push('/repo')).toEqual({ ok: true });
      git.setPushError('rejected');
      expect(await git.push('/repo')).toEqual({ error: 'rejected' });
    });
  });
});

// ── Contract tests (run the same suite against the real Git too) ──
import { type ContractSetup, gitContract } from '@code-quest/git/contract';

let pathCounter = 0;
const uniquePath = (prefix: string): string => `${prefix}-${++pathCounter}`;

gitContract('FakeGit', async (): Promise<ContractSetup> => {
  const service = new FakeGit();
  return {
    service,
    cwd: uniquePath('/non-git'),
    makeExistingRepo: async () => {
      const path = uniquePath('/repo');
      await service.initRepo(path);
      return path;
    },
  };
});
