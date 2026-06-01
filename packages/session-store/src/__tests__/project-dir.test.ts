import { describe, expect, it } from 'vitest';
import { decodeProjectDir, encodeProjectDir } from '../project-dir.ts';

describe('decodeProjectDir', () => {
  it('decodes encoded path back to absolute path', () => {
    expect(decodeProjectDir('-Users-recca0120-WebstormProjects-myapp')).toBe(
      '/Users/recca0120/WebstormProjects/myapp',
    );
  });

  it('round-trips with encodeProjectDir when path has no literal dashes', () => {
    const cwd = '/Users/foo/bar/project';
    expect(decodeProjectDir(encodeProjectDir(cwd))).toBe(cwd);
  });
});

describe('encodeProjectDir', () => {
  it('encodes slashes as dashes', () => {
    expect(encodeProjectDir('/Users/recca0120/WebstormProjects/myapp')).toBe(
      '-Users-recca0120-WebstormProjects-myapp',
    );
  });

  // Known limitation: paths with literal dashes are ambiguous after encoding.
  // All existing JSONL tools share this limitation. In practice, rely on the
  // cwd field inside JSONL entries rather than decoding the directory name.
  it('encodes paths with literal dashes identically to path separators', () => {
    expect(encodeProjectDir('/Users/foo/bar-baz')).toBe(encodeProjectDir('/Users/foo/bar/baz'));
  });
});
