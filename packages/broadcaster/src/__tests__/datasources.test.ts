import { FakeFilesystem, FakeFileWatcher, FakeGit } from '@code-quest/test-kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesDataSource } from '../data-sources/files-data-source.ts';
import { GitDataSource } from '../data-sources/git-data-source.ts';
import { OpenspecDataSource, type OpenspecLike } from '../data-sources/openspec-data-source.ts';

function makeFakeOpenspec(): OpenspecLike {
  return {
    list: vi.fn(async () => ({ changes: [], specs: [] })),
  };
}

// ── FilesDataSource ──

describe('FilesDataSource', () => {
  it('read() returns files from filesystem service', async () => {
    const watch = new FakeFileWatcher();
    const fs = new FakeFilesystem();
    fs.setRoots(['/repo']);
    fs.addFile('/repo/foo.ts', '');
    const ds = new FilesDataSource('/repo', watch, fs);
    const result = await ds.read();
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('foo.ts');
  });

  describe('onChange filter', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('notifies onChange when a regular file changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new FilesDataSource('/repo', watch, new FakeFilesystem());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
      vi.advanceTimersByTime(80);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does NOT notify onChange for .git/HEAD changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new FilesDataSource('/repo', watch, new FakeFilesystem());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: '.git/HEAD' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT notify onChange for node_modules changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new FilesDataSource('/repo', watch, new FakeFilesystem());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'node_modules/pkg/index.js' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT notify onChange for dist changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new FilesDataSource('/repo', watch, new FakeFilesystem());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'dist/bundle.js' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });

    it('unsubscribed onChange listener stops receiving callbacks', () => {
      const watch = new FakeFileWatcher();
      const ds = new FilesDataSource('/repo', watch, new FakeFilesystem());
      const cb = vi.fn();
      const off = ds.onChange(cb);
      off();
      watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

// ── GitDataSource ──

describe('GitDataSource', () => {
  it('read() returns git status', async () => {
    const watch = new FakeFileWatcher();
    const git = new FakeGit();
    git.setBranch('feature/x');
    git.setClean(false);
    const ds = new GitDataSource('/repo', watch, git);
    const result = await ds.read();
    expect(result.branch).toBe('feature/x');
    expect(result.isClean).toBe(false);
  });

  describe('onChange filter', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('notifies onChange for .git/HEAD change', () => {
      const watch = new FakeFileWatcher();
      const ds = new GitDataSource('/repo', watch, new FakeGit());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: '.git/HEAD' });
      vi.advanceTimersByTime(80);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('notifies onChange for .git/index change', () => {
      const watch = new FakeFileWatcher();
      const ds = new GitDataSource('/repo', watch, new FakeGit());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: '.git/index' });
      vi.advanceTimersByTime(80);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('notifies onChange for .git/refs/heads/main change', () => {
      const watch = new FakeFileWatcher();
      const ds = new GitDataSource('/repo', watch, new FakeGit());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: '.git/refs/heads/main' });
      vi.advanceTimersByTime(80);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does NOT notify onChange for regular file changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new GitDataSource('/repo', watch, new FakeGit());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT notify onChange for .git/objects changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new GitDataSource('/repo', watch, new FakeGit());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: '.git/objects/ab/cdef' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

// ── OpenspecDataSource ──

describe('OpenspecDataSource', () => {
  it('read() returns openspec list', async () => {
    const watch = new FakeFileWatcher();
    const openspec = {
      list: vi.fn(async () => ({
        changes: [{ name: 'my-change', tasks: null, status: 'in-progress' as const }],
        specs: [],
      })),
    };
    const ds = new OpenspecDataSource('/repo', watch, openspec);
    const result = await ds.read();
    if (!('changes' in result)) throw new Error('unexpected error result');
    expect(result.changes).toHaveLength(1);
  });

  describe('onChange filter', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('notifies onChange for openspec/ file changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new OpenspecDataSource('/repo', watch, makeFakeOpenspec());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'openspec/changes/foo/design.md' });
      vi.advanceTimersByTime(80);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does NOT notify onChange for non-openspec file changes', () => {
      const watch = new FakeFileWatcher();
      const ds = new OpenspecDataSource('/repo', watch, makeFakeOpenspec());
      const cb = vi.fn();
      ds.onChange(cb);
      watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
      vi.advanceTimersByTime(80);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
