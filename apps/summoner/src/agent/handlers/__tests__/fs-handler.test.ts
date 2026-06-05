import { REMOTE_METHODS } from '@code-quest/schemas';
import { FakeAgentTransport, FakeFilesystem } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { FsHandler } from '../fs-handler.ts';

describe('FsHandler', () => {
  let fs: FakeFilesystem;

  beforeEach(() => {
    fs = new FakeFilesystem();
    fs.setRoots(['/repo']);
    fs.addDirectory('/repo', ['src', 'tests']);
    fs.addFile('/repo/src/index.ts', 'export {}');
    fs.addFile('/repo/src/util.ts', 'export const x = 1');
  });

  function makeHandler() {
    const transport = new FakeAgentTransport();
    new FsHandler(fs).attach(transport);
    return { request: transport.request.bind(transport) };
  }

  it('browseDirectories returns root entries when no path given', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.browseDirectories, {});
    expect(result).toEqual({ entries: [{ name: 'repo', path: '/repo' }] });
  });

  it('browseDirectories returns children of a given path', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.browseDirectories, { path: '/repo' });
    expect(result).toEqual({
      entries: [
        { name: 'src', path: '/repo/src' },
        { name: 'tests', path: '/repo/tests' },
      ],
    });
  });

  it('browseEntries returns directories and files for a path', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.browseEntries, { path: '/repo/src' });
    expect(result).toMatchObject({
      directories: [],
      files: [
        { name: 'index.ts', path: '/repo/src/index.ts' },
        { name: 'util.ts', path: '/repo/src/util.ts' },
      ],
    });
  });

  it('readFile returns file content', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.read, {
      file: '/repo/src/index.ts',
    });
    expect((result as Record<string, unknown>).content).toBe('export {}');
    expect((result as Record<string, unknown>).encoding).toBe('utf-8');
  });

  it('writeFile writes content and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.writeFile, {
      absolutePath: '/repo/src/index.ts',
      content: 'new content',
    });
    expect(result).toEqual({ ok: true });
    const readResult = await fs.readFile('/repo/src/index.ts');
    expect((readResult as Record<string, unknown>).content).toBe('new content');
  });

  it('create creates a new file and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.create, {
      absolutePath: '/repo/src/new.ts',
      kind: 'file',
    });
    expect(result).toEqual({ ok: true });
  });

  it('delete removes a file and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.delete, {
      absolutePath: '/repo/src/util.ts',
    });
    expect(result).toEqual({ ok: true });
    expect(await fs.exists('/repo/src/util.ts')).toBe(false);
  });

  it('rename renames a file and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.rename, {
      from: '/repo/src/util.ts',
      to: '/repo/src/helpers.ts',
    });
    expect(result).toEqual({ ok: true });
    expect(await fs.exists('/repo/src/helpers.ts')).toBe(true);
    expect(await fs.exists('/repo/src/util.ts')).toBe(false);
  });

  it('copy copies a file and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.copy, {
      from: '/repo/src/util.ts',
      to: '/repo/src/util-copy.ts',
    });
    expect(result).toEqual({ ok: true });
    expect(await fs.exists('/repo/src/util.ts')).toBe(true);
    expect(await fs.exists('/repo/src/util-copy.ts')).toBe(true);
  });

  it('move moves a file and returns ok', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.move, {
      from: '/repo/src/util.ts',
      to: '/repo/src/moved.ts',
    });
    expect(result).toEqual({ ok: true });
    expect(await fs.exists('/repo/src/moved.ts')).toBe(true);
    expect(await fs.exists('/repo/src/util.ts')).toBe(false);
  });

  it('list returns files under cwd matching pattern', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.list, { cwd: '/repo/src', pattern: 'index' });
    expect(result).toEqual({
      files: [{ path: 'index.ts', name: 'index.ts', type: 'file' }],
    });
  });

  it('read returns file content relative to cwd', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.read, {
      file: 'index.ts',
      cwd: '/repo/src',
    });
    expect(result).toMatchObject({ content: 'export {}' });
  });

  it('exists returns true for an existing file', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.exists, { path: '/repo/src/index.ts' });
    expect(result).toEqual({ exists: true });
  });

  it('exists returns false for a missing path', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.exists, { path: '/repo/src/missing.ts' });
    expect(result).toEqual({ exists: false });
  });

  it('isDirectory returns true for a directory', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.isDirectory, { path: '/repo/src' });
    expect(result).toEqual({ isDirectory: true });
  });

  it('isDirectory returns false for a file', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.isDirectory, { path: '/repo/src/index.ts' });
    expect(result).toEqual({ isDirectory: false });
  });

  it('statKind returns "file" for a file', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.statKind, { path: '/repo/src/index.ts' });
    expect(result).toEqual({ kind: 'file' });
  });

  it('statKind returns "directory" for a directory', async () => {
    const { request } = makeHandler();
    const result = await request(REMOTE_METHODS.fs.statKind, { path: '/repo/src' });
    expect(result).toEqual({ kind: 'directory' });
  });
});
