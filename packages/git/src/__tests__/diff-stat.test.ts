import { describe, expect, it, vi } from 'vitest';
import { GitCommands } from '../commands.ts';
import * as runner from '../git-runner.ts';

vi.mock('../git-runner.ts', () => ({
  createGit: vi.fn(),
  rawGit: vi.fn(),
}));

function mockRawGit(unstaged: string, staged: string) {
  const fakeGit = {} as never;
  vi.mocked(runner.createGit).mockReturnValue(fakeGit);
  vi.mocked(runner.rawGit).mockImplementation(async (_git, args) => {
    if (args.includes('--cached')) return { stdout: staged, exitCode: 0 };
    return { stdout: unstaged, exitCode: 0 };
  });
}

describe('GitCommands.diffStat', () => {
  const commands = new GitCommands();

  it('parses numstat output with multiple files', async () => {
    mockRawGit('10\t3\tsrc/a.ts\n32\t4\tsrc/b.ts\n', '');

    const result = await commands.diffStat('/repo');

    expect(result.files).toEqual([
      { file: 'src/a.ts', insertions: 10, deletions: 3 },
      { file: 'src/b.ts', insertions: 32, deletions: 4 },
    ]);
    expect(result.totalInsertions).toBe(42);
    expect(result.totalDeletions).toBe(7);
  });

  it('merges unstaged and staged stats for the same file', async () => {
    mockRawGit('5\t2\tsrc/a.ts\n', '3\t1\tsrc/a.ts\n');

    const result = await commands.diffStat('/repo');

    expect(result.files).toEqual([{ file: 'src/a.ts', insertions: 8, deletions: 3 }]);
    expect(result.totalInsertions).toBe(8);
    expect(result.totalDeletions).toBe(3);
  });

  it('treats binary files (-\\t-) as 0/0', async () => {
    mockRawGit('-\t-\timage.png\n5\t1\tsrc/a.ts\n', '');

    const result = await commands.diffStat('/repo');

    expect(result.files).toEqual([
      { file: 'image.png', insertions: 0, deletions: 0 },
      { file: 'src/a.ts', insertions: 5, deletions: 1 },
    ]);
    expect(result.totalInsertions).toBe(5);
    expect(result.totalDeletions).toBe(1);
  });

  it('returns zeros for empty output (clean repo)', async () => {
    mockRawGit('', '');

    const result = await commands.diffStat('/repo');

    expect(result.files).toEqual([]);
    expect(result.totalInsertions).toBe(0);
    expect(result.totalDeletions).toBe(0);
  });

  it('handles renamed files with => arrow notation', async () => {
    mockRawGit('2\t1\tsrc/{old.ts => new.ts}\n', '');

    const result = await commands.diffStat('/repo');

    expect(result.files).toEqual([{ file: 'src/{old.ts => new.ts}', insertions: 2, deletions: 1 }]);
  });
});
