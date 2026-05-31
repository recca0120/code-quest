import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalDiffFile } from '../local-diff-file.ts';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-diff-'));
  writeFileSync(join(dir, 'a.txt'), 'hello');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('LocalDiffFile', () => {
  it('reads any absolute path regardless of fsRoots', async () => {
    const reader = new LocalDiffFile();
    expect(await reader.read(join(dir, 'a.txt'))).toBe('hello');
  });

  it("returns '' when the file does not exist", async () => {
    const reader = new LocalDiffFile();
    expect(await reader.read(join(dir, 'missing.txt'))).toBe('');
  });

  it("returns '' for empty input path (Claude CLI sometimes sends '')", async () => {
    const reader = new LocalDiffFile();
    expect(await reader.read('')).toBe('');
  });
});
