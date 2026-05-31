import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { LocalGit } from '@code-quest/git';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tmpDir: string;
let service: LocalGit;

function git(args: string, cwd = tmpDir) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

beforeAll(() => {
  tmpDir = realpathSync(mkdtempSync(join(os.tmpdir(), 'git-service-test-')));
  git('init');
  git('config user.email "test@test.com"');
  git('config user.name "Test"');
  writeFileSync(join(tmpDir, 'file.txt'), 'hello');
  git('add .');
  git('commit -m "initial"');
  service = new LocalGit();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const SKIP = !process.env.RUN_INTEGRATION;

describe.skipIf(SKIP)('LocalGit', () => {
  describe('status', () => {
    it('returns branch and clean state', async () => {
      const result = await service.status(tmpDir);
      expect(result.branch).toBeDefined();
      expect(result.isClean).toBe(true);
      expect(result.changedFiles).toEqual([]);
    });

    it('detects dirty state', async () => {
      writeFileSync(join(tmpDir, 'dirty.txt'), 'changed');
      const result = await service.status(tmpDir);
      expect(result.isClean).toBe(false);
      expect(result.changedFiles.length).toBeGreaterThan(0);
      rmSync(join(tmpDir, 'dirty.txt'));
    });

    it('throws for non-git directory', async () => {
      const nonGit = realpathSync(mkdtempSync(join(os.tmpdir(), 'non-git-')));
      await expect(service.status(nonGit)).rejects.toThrow();
      rmSync(nonGit, { recursive: true, force: true });
    });
  });

  describe('checkout', () => {
    it('switches to existing branch', async () => {
      git('branch test-branch');
      await service.checkout(tmpDir, 'test-branch');
      const result = await service.status(tmpDir);
      expect(result.branch).toBe('test-branch');
      git('checkout -');
    });

    it('throws for non-existent branch', async () => {
      await expect(service.checkout(tmpDir, 'nonexistent-xyz')).rejects.toThrow();
    });
  });

  describe('log', () => {
    it('returns commit entries', async () => {
      const result = await service.log(tmpDir);
      if (!('entries' in result)) throw new Error('expected entries');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0]).toMatchObject({
        hash: expect.any(String),
        message: expect.any(String),
        author: expect.any(String),
        date: expect.any(String),
      });
    });

    it('respects limit', async () => {
      writeFileSync(join(tmpDir, 'a.txt'), 'a');
      git('add . && git commit -m "second"');
      writeFileSync(join(tmpDir, 'b.txt'), 'b');
      git('add . && git commit -m "third"');

      const result = await service.log(tmpDir, 1);
      if (!('entries' in result)) throw new Error('expected entries');
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('diff', () => {
    it('returns empty diff for clean repo', async () => {
      const result = await service.diff(tmpDir);
      expect(result.diff).toBe('');
    });

    it('returns diff for modified files', async () => {
      writeFileSync(join(tmpDir, 'file.txt'), 'modified');
      const result = await service.diff(tmpDir);
      expect(result.diff).toContain('modified');
      git('checkout -- file.txt');
    });

    it('returns per-file unstaged diff (M status)', async () => {
      writeFileSync(join(tmpDir, 'file.txt'), 'unstaged change');
      const result = await service.diff(tmpDir, 'file.txt', 'M');
      expect(result.diff).toContain('unstaged change');
      git('checkout -- file.txt');
    });

    it('returns per-file staged diff (A status)', async () => {
      writeFileSync(join(tmpDir, 'new-file.txt'), 'staged content');
      git('add new-file.txt');
      const result = await service.diff(tmpDir, 'new-file.txt', 'A');
      expect(result.diff).toContain('staged content');
      git('rm --cached new-file.txt');
      rmSync(join(tmpDir, 'new-file.txt'));
    });

    it('returns file content as pseudo-diff for untracked file (?? status)', async () => {
      writeFileSync(join(tmpDir, 'untracked.txt'), 'brand new file');
      const result = await service.diff(tmpDir, 'untracked.txt', '??');
      expect(result.diff).toContain('brand new file');
      rmSync(join(tmpDir, 'untracked.txt'));
    });

    it('returns empty diff when untracked filePath traverses outside cwd', async () => {
      const result = await service.diff(tmpDir, '../../etc/passwd', '??');
      expect(result.diff).toBe('');
    });
  });

  describe('getRepoRoot', () => {
    it('returns root for path inside repo', async () => {
      const sub = join(tmpDir, 'subdir');
      mkdirSync(sub, { recursive: true });
      const root = await service.getRepoRoot(sub);
      expect(root).toBe(tmpDir);
    });

    it('returns null for non-repo path', async () => {
      const nonGit = realpathSync(mkdtempSync(join(os.tmpdir(), 'non-git-')));
      const root = await service.getRepoRoot(nonGit);
      expect(root).toBeNull();
      rmSync(nonGit, { recursive: true, force: true });
    });
  });

  describe('getProjectRoot', () => {
    it('returns main repo path for main working tree', async () => {
      const root = await service.getProjectRoot(tmpDir);
      expect(root).toBe(tmpDir);
    });

    it('returns main repo path for subdirectory of main working tree', async () => {
      const sub = join(tmpDir, 'subdir-for-project-root');
      mkdirSync(sub, { recursive: true });
      const root = await service.getProjectRoot(sub);
      expect(root).toBe(tmpDir);
    });

    it('returns main repo path (not worktree path) when called from a worktree', async () => {
      // Create a worktree, then verify getProjectRoot from inside it returns the main repo
      const wt = await service.createWorktree(tmpDir, { name: 'project-root-wt' });
      try {
        const root = await service.getProjectRoot(wt.path);
        expect(root).toBe(tmpDir);
      } finally {
        await service.deleteWorktree(tmpDir, 'project-root-wt');
      }
    });

    it('returns null for non-git path', async () => {
      const nonGit = realpathSync(mkdtempSync(join(os.tmpdir(), 'non-git-proj-')));
      const root = await service.getProjectRoot(nonGit);
      expect(root).toBeNull();
      rmSync(nonGit, { recursive: true, force: true });
    });
  });

  describe('capabilities', () => {
    it('declares worktree support', () => {
      expect(service.capabilities.worktree).toBe(true);
    });
  });

  describe('worktree', () => {
    it('roundtrip: create + list + delete', async () => {
      const wt = await service.createWorktree(tmpDir, { name: 'roundtrip-wt' });
      expect(wt.name).toBe('roundtrip-wt');
      expect(wt.branch).toBe('worktree-roundtrip-wt');

      const list = await service.listWorktrees(tmpDir);
      expect(list.some((w) => w.name === 'roundtrip-wt')).toBe(true);

      await service.deleteWorktree(tmpDir, 'roundtrip-wt');
      const after = await service.listWorktrees(tmpDir);
      expect(after.some((w) => w.name === 'roundtrip-wt')).toBe(false);
    });

    it('createWorktree rejects invalid name', async () => {
      await expect(service.createWorktree(tmpDir, { name: '../bad' })).rejects.toThrow(
        /Invalid worktree name/,
      );
    });
  });
});
