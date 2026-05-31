import { join } from 'node:path';
import { FakeFilesystem } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { RootGuardFilesystem } from '../root-guard-filesystem.ts';
import { PathOutsideRootsError } from '../types.ts';

const ROOT = '/allowed';
const OTHER = '/other';

function makeGuarded(inner = new FakeFilesystem()) {
  return { inner, guarded: new RootGuardFilesystem(inner, [ROOT]) };
}

describe('RootGuardFilesystem', () => {
  describe('browseDirectories', () => {
    it('returns roots when no path given', async () => {
      const { guarded } = makeGuarded();
      expect(await guarded.browseDirectories()).toEqual([{ name: 'allowed', path: ROOT }]);
    });

    it('delegates to inner when path is within roots', async () => {
      const inner = new FakeFilesystem();
      inner.addDirectory(ROOT, ['sub']);
      const guarded = new RootGuardFilesystem(inner, [ROOT]);
      const result = await guarded.browseDirectories(ROOT);
      expect(result).toEqual([{ name: 'sub', path: join(ROOT, 'sub') }]);
    });

    it('throws PathOutsideRootsError when path is outside roots', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.browseDirectories(OTHER)).rejects.toThrow(PathOutsideRootsError);
    });
  });

  describe('browseEntries', () => {
    it('returns roots as directories when no path given', async () => {
      const { guarded } = makeGuarded();
      const result = await guarded.browseEntries();
      expect(result.directories).toEqual([{ name: 'allowed', path: ROOT }]);
      expect(result.files).toEqual([]);
    });

    it('delegates to inner when path is within roots', async () => {
      const inner = new FakeFilesystem();
      inner.addDirectory(ROOT, ['sub']);
      inner.addFile(join(ROOT, 'file.txt'), 'hello');
      const guarded = new RootGuardFilesystem(inner, [ROOT]);
      const result = await guarded.browseEntries(ROOT);
      expect(result.directories).toEqual([{ name: 'sub', path: join(ROOT, 'sub') }]);
      expect(result.files).toEqual([{ name: 'file.txt', path: join(ROOT, 'file.txt') }]);
    });

    it('throws PathOutsideRootsError when path is outside roots', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.browseEntries(OTHER)).rejects.toThrow(PathOutsideRootsError);
    });
  });

  describe('readFile', () => {
    it('delegates to inner when cwd is within roots', async () => {
      const inner = new FakeFilesystem();
      inner.addFile(join(ROOT, 'file.txt'), 'content');
      const guarded = new RootGuardFilesystem(inner, [ROOT]);
      expect(await guarded.readFile(ROOT, 'file.txt')).toEqual({ content: 'content' });
    });

    it('returns error when cwd is outside roots', async () => {
      const { guarded } = makeGuarded();
      const result = await guarded.readFile(OTHER, 'file.txt');
      expect(result).toEqual({ error: 'Path traversal not allowed' });
    });
  });

  describe('readFileAbsolute', () => {
    it('delegates to inner when path is within roots', async () => {
      const inner = new FakeFilesystem();
      inner.addFile(join(ROOT, 'file.txt'), 'hello');
      const guarded = new RootGuardFilesystem(inner, [ROOT]);
      const result = await guarded.readFileAbsolute(join(ROOT, 'file.txt'));
      expect(result).toMatchObject({ content: 'hello' });
    });

    it('throws PathOutsideRootsError when path is outside roots', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.readFileAbsolute(join(OTHER, 'file.txt'))).rejects.toThrow(
        PathOutsideRootsError,
      );
    });
  });

  describe('path check', () => {
    it('accepts root itself', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.browseDirectories(ROOT)).resolves.not.toThrow();
    });

    it('accepts nested path inside root', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.browseDirectories(join(ROOT, 'a', 'b'))).resolves.not.toThrow();
    });

    it('rejects prefix-similar but not inside (foo vs foo-bar)', async () => {
      const { guarded } = makeGuarded();
      await expect(guarded.browseDirectories(`${ROOT}-sibling`)).rejects.toThrow(
        PathOutsideRootsError,
      );
    });
  });
});
