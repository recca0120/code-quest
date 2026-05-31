/* biome-ignore-all lint/suspicious/noExplicitAny: test file uses type assertions */

import type { Ack } from '@code-quest/schemas';
import { segments as s } from '@code-quest/test-kit';
import { createFakeSummoner } from '../../../test/index.ts';

type GitEmptyResp = Ack;

async function setup(sessionId = 'cli-sess') {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  const claude = summoner.claude();
  const channelId = await claude.initialize(s.init(sessionId));
  return { claude, channelId, git: summoner.git()! };
}

describe('ChatHandler > git', () => {
  it('git:update_skipped_branch records entry and returns success', async () => {
    const { claude, channelId } = await setup();

    const result = await claude.send<GitEmptyResp>('git:update_skipped_branch', {
      channelId,
      branch: 'feature/x',
      failed: true,
    });

    expect(result.ok).toBe(true);
  });

  describe('git:log and git:diff', () => {
    it('git:log parses formatted output into entries', async () => {
      const { claude, git } = await setup();
      git.setLogEntries([
        {
          hash: 'abc123',
          message: 'feat: add login',
          author: 'Alice',
          date: '2024-01-01 10:00:00 +0000',
        },
        { hash: 'def456', message: 'fix: typo', author: 'Bob', date: '2024-01-02 11:00:00 +0000' },
      ]);

      const result = await claude.send<{
        entries: Array<{ hash: string; message: string; author: string; date: string }>;
      }>('git:log', { cwd: '/repo', limit: 5 });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        hash: 'abc123',
        message: 'feat: add login',
        author: 'Alice',
        date: '2024-01-01 10:00:00 +0000',
      });
    });

    it('git:log surfaces error result when service throws', async () => {
      const { claude, git } = await setup();
      git.setLogError('fatal: bad revision');

      const result = await claude.send<{ entries?: unknown[]; error?: string }>('git:log', {
        cwd: '/repo',
      });

      expect(result.error).toBe('fatal: bad revision');
      expect(result.entries).toBeUndefined();
    });

    it('git:diff returns diff output', async () => {
      const { claude, git } = await setup();
      git.setDiff('+added\n-removed\n');

      const result = await claude.send<{ diff: string }>('git:diff', { cwd: '/repo' });

      expect(result.diff).toBe('+added\n-removed\n');
    });

    it('git:diff returns empty string on error', async () => {
      const { claude } = await setup();
      // FakeGit default: empty diff

      const result = await claude.send<{ diff: string }>('git:diff', { cwd: '/repo' });

      expect(result.diff).toBe('');
    });
  });

  describe('git:checkout', () => {
    it('should succeed when checkout works', async () => {
      const { claude, git } = await setup();
      git.setProjectRoot('/repo');

      const result = await claude.send<GitEmptyResp>('git:checkout', {
        cwd: '/repo',
        branch: 'feature/test',
      });

      expect(result.ok).toBe(true);
    });

    it('should return error when checkout fails', async () => {
      const { claude, git } = await setup();
      git.setCheckoutError(new Error('fatal: no such branch'));

      const result = await claude.send<GitEmptyResp>('git:checkout', {
        cwd: '/repo',
        branch: 'nonexistent',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeDefined();
    });
  });

  describe('git:discardFile', () => {
    it('records the file and returns ok', async () => {
      const { claude, git } = await setup();
      const result = await claude.send<{ ok: true } | { error: string }>('git:discardFile', {
        cwd: '/repo',
        file: 'src/foo.ts',
      });
      expect(result).toEqual({ ok: true });
      expect(git.discardedFiles).toEqual(['src/foo.ts']);
    });

    it('returns error when service fails', async () => {
      const { claude, git } = await setup();
      git.setDiscardError('pathspec did not match any files');
      const result = await claude.send<{ ok: true } | { error: string }>('git:discardFile', {
        cwd: '/repo',
        file: 'src/missing.ts',
      });
      expect(result).toEqual({ error: 'pathspec did not match any files' });
    });
  });
});
