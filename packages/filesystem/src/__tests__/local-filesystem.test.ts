import { join } from 'node:path';
import { type DirectoryEntry, LocalFilesystem } from '@code-quest/filesystem';
import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async () => (await import('memfs')).fs);
vi.mock('node:fs/promises', async () => (await import('memfs')).fs.promises);

const ROOT = '/test-root';

let service: LocalFilesystem;
let memfs: typeof import('node:fs');

beforeEach(async () => {
  vol.fromJSON({
    [join(ROOT, 'alpha/.keep')]: '',
    [join(ROOT, 'beta/nested/.keep')]: '',
    [join(ROOT, '.hidden/.keep')]: '',
    [join(ROOT, 'node_modules/.keep')]: '',
    [join(ROOT, '.git/.keep')]: '',
    [join(ROOT, 'src/index.ts')]: 'export {}',
    [join(ROOT, 'src/utils.ts')]: 'export const x = 1',
    [join(ROOT, 'package.json')]: '{}',
  });
  memfs = (await import('memfs')).fs as unknown as typeof import('node:fs');
  service = new LocalFilesystem(undefined, memfs);
});

afterEach(() => vol.reset());

describe('LocalFilesystem', () => {
  describe('browseDirectories', () => {
    it('returns empty when no path', async () => {
      expect(await service.browseDirectories()).toEqual([]);
    });

    it('lists child directories sorted', async () => {
      const names = (await service.browseDirectories(ROOT)).map((d: DirectoryEntry) => d.name);
      expect(names).toContain('alpha');
      expect(names).toContain('beta');
      expect(names).toEqual([...names].sort());
    });

    it('filters hidden directories', async () => {
      const names = (await service.browseDirectories(ROOT)).map((d: DirectoryEntry) => d.name);
      expect(names).not.toContain('.hidden');
      expect(names).not.toContain('.git');
    });

    it('filters ignored directories', async () => {
      const names = (await service.browseDirectories(ROOT)).map((d: DirectoryEntry) => d.name);
      expect(names).not.toContain('node_modules');
    });

    it('excludes symlinks', async () => {
      vol.symlinkSync(join(ROOT, 'alpha'), join(ROOT, 'link-to-alpha'));
      const names = (await service.browseDirectories(ROOT)).map((d: DirectoryEntry) => d.name);
      expect(names).not.toContain('link-to-alpha');
    });

    it('returns empty for non-existent path', async () => {
      expect(await service.browseDirectories(join(ROOT, 'nope'))).toEqual([]);
    });
  });

  describe('browseEntries', () => {
    it('hides dot entries by default', async () => {
      const result = await service.browseEntries(ROOT);
      const names = result.directories.map((d) => d.name);
      expect(names).not.toContain('.hidden');
      expect(names).not.toContain('.git');
    });

    it('shows dot entries when showHidden=true, but always excludes .git', async () => {
      const result = await service.browseEntries(ROOT, { showHidden: true });
      const names = result.directories.map((d) => d.name);
      expect(names).toContain('.hidden');
      expect(names).not.toContain('.git');
    });

    it('shows hidden files when showHidden=true', async () => {
      vol.writeFileSync(join(ROOT, '.env'), 'SECRET=1');
      const result = await service.browseEntries(ROOT, { showHidden: true });
      const fileNames = result.files.map((f) => f.name);
      expect(fileNames).toContain('.env');
    });

    it('hides hidden files by default', async () => {
      vol.writeFileSync(join(ROOT, '.env'), 'SECRET=1');
      const result = await service.browseEntries(ROOT);
      const fileNames = result.files.map((f) => f.name);
      expect(fileNames).not.toContain('.env');
    });
  });

  describe('listFiles', () => {
    it('empty pattern returns root entries', async () => {
      const results = await service.listFiles(ROOT, '');
      expect(results.some((f) => f.type === 'directory')).toBe(true);
      expect(results.some((f) => f.type === 'file')).toBe(true);
    });

    it('trailing slash lists directory contents', async () => {
      const results = await service.listFiles(ROOT, 'src/');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((f) => f.path.startsWith('src/'))).toBe(true);
    });

    it('other patterns do fuzzy search', async () => {
      const results = await service.listFiles(ROOT, 'utils');
      expect(results.some((f) => f.name.includes('utils'))).toBe(true);
    });
  });

  describe('readFile', () => {
    it('returns utf-8 content with contentType and encoding for a text file (absolute)', async () => {
      vol.writeFileSync(join(ROOT, 'app.ts'), 'export {}');
      expect(await service.readFile(join(ROOT, 'app.ts'))).toEqual({
        content: 'export {}',
        contentType: 'text/plain',
        encoding: 'utf-8',
      });
    });

    it('returns base64 content with contentType application/pdf for a .pdf file', async () => {
      const pdfBytes = Buffer.from('%PDF-fake');
      vol.writeFileSync(join(ROOT, 'report.pdf'), pdfBytes);
      const result = await service.readFile(join(ROOT, 'report.pdf'));
      expect(result).toEqual({
        content: pdfBytes.toString('base64'),
        contentType: 'application/pdf',
        encoding: 'base64',
      });
    });

    it('returns base64 content for a .png file', async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      vol.writeFileSync(join(ROOT, 'image.png'), bytes);
      const result = await service.readFile(join(ROOT, 'image.png'));
      expect(result).toMatchObject({ contentType: 'image/png', encoding: 'base64' });
    });

    it('returns error for non-existent file', async () => {
      const result = await service.readFile(join(ROOT, 'missing.ts'));
      expect(result).toMatchObject({ error: expect.stringContaining('missing.ts') });
    });

    it('returns { tooLarge: true } when file size exceeds maxBytes', async () => {
      vol.writeFileSync(join(ROOT, 'big.txt'), 'x'.repeat(100));
      const result = await service.readFile(join(ROOT, 'big.txt'), { maxBytes: 50 });
      expect(result).toEqual({ tooLarge: true });
    });

    it('reads file normally when size is within maxBytes', async () => {
      vol.writeFileSync(join(ROOT, 'small.txt'), 'hello');
      const result = await service.readFile(join(ROOT, 'small.txt'), { maxBytes: 100 });
      expect(result).toMatchObject({ content: 'hello', encoding: 'utf-8' });
    });

    it('reads relative path when cwd provided', async () => {
      const result = await service.readFile('package.json', { cwd: ROOT });
      expect(result).toMatchObject({ content: '{}', encoding: 'utf-8' });
    });

    it('rejects path traversal when cwd is provided', async () => {
      expect(await service.readFile('../../etc/passwd', { cwd: ROOT })).toEqual({
        error: 'Path traversal not allowed',
      });
    });

    it('returns error for non-existent relative file', async () => {
      expect(await service.readFile('nope.txt', { cwd: ROOT })).toMatchObject({
        error: expect.stringContaining('nope.txt'),
      });
    });
  });

  describe('exists', () => {
    it('returns true for existing directory', async () => {
      expect(await service.exists(ROOT)).toBe(true);
      expect(await service.exists(join(ROOT, 'alpha'))).toBe(true);
    });

    it('returns true for existing file', async () => {
      expect(await service.exists(join(ROOT, 'package.json'))).toBe(true);
    });

    it('returns false for non-existent path', async () => {
      expect(await service.exists(join(ROOT, 'does-not-exist'))).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('returns true for directory', async () => {
      expect(await service.isDirectory(ROOT)).toBe(true);
      expect(await service.isDirectory(join(ROOT, 'alpha'))).toBe(true);
    });

    it('returns false for file', async () => {
      expect(await service.isDirectory(join(ROOT, 'package.json'))).toBe(false);
    });

    it('returns false for non-existent path', async () => {
      expect(await service.isDirectory(join(ROOT, 'nope'))).toBe(false);
    });
  });

  describe('statKind', () => {
    it('returns "directory" for a directory', async () => {
      expect(await service.statKind(ROOT)).toBe('directory');
      expect(await service.statKind(join(ROOT, 'alpha'))).toBe('directory');
    });

    it('returns "file" for a file', async () => {
      expect(await service.statKind(join(ROOT, 'package.json'))).toBe('file');
    });

    it('returns null for non-existent path', async () => {
      expect(await service.statKind(join(ROOT, 'nope'))).toBeNull();
    });
  });

  describe('mutations (create / delete / rename / copy / move)', () => {
    const MROOT = '/mutation-root';
    let svc: LocalFilesystem;

    beforeEach(() => {
      vol.mkdirSync(MROOT, { recursive: true });
      svc = new LocalFilesystem(undefined, memfs);
    });

    it('create file then delete it', async () => {
      const p = join(MROOT, 'created.txt');
      expect(await svc.create(p, 'file')).toEqual({ ok: true });
      expect(await svc.exists(p)).toBe(true);
      expect(await svc.delete(p)).toEqual({ ok: true });
      expect(await svc.exists(p)).toBe(false);
    });

    it('create directory then delete it recursively', async () => {
      const dir = join(MROOT, 'dir-recursive');
      expect(await svc.create(dir, 'directory')).toEqual({ ok: true });
      vol.writeFileSync(join(dir, 'inner.txt'), 'content');
      expect(await svc.delete(dir)).toEqual({ ok: true });
      expect(await svc.exists(dir)).toBe(false);
    });

    it('create rejects existing target', async () => {
      const p = join(MROOT, 'pre-existing.txt');
      vol.writeFileSync(p, 'x');
      expect(await svc.create(p, 'file')).toEqual({ error: 'exists' });
    });

    it('rename moves a file', async () => {
      const a = join(MROOT, 'rename-a.txt');
      const b = join(MROOT, 'rename-b.txt');
      vol.writeFileSync(a, 'rename me');
      expect(await svc.rename(a, b)).toEqual({ ok: true });
      expect(await svc.exists(a)).toBe(false);
      expect(await svc.readFile(b)).toMatchObject({ content: 'rename me' });
    });

    it('rename rejects when destination exists', async () => {
      const a = join(MROOT, 'src-collide.txt');
      const b = join(MROOT, 'dst-collide.txt');
      vol.writeFileSync(a, 'a');
      vol.writeFileSync(b, 'b');
      expect(await svc.rename(a, b)).toEqual({ error: 'exists' });
    });

    it('copy duplicates a file', async () => {
      const a = join(MROOT, 'orig.txt');
      const b = join(MROOT, 'orig-copy.txt');
      vol.writeFileSync(a, 'hello');
      expect(await svc.copy(a, b)).toEqual({ ok: true });
      expect(await svc.readFile(b)).toMatchObject({ content: 'hello' });
      expect(await svc.exists(a)).toBe(true);
    });

    it('copy duplicates a directory recursively', async () => {
      const src = join(MROOT, 'tree-src');
      vol.mkdirSync(src);
      vol.writeFileSync(join(src, 'inner.txt'), 'inside');
      const dst = join(MROOT, 'tree-dst');
      expect(await svc.copy(src, dst)).toEqual({ ok: true });
      expect(await svc.readFile(join(dst, 'inner.txt'))).toMatchObject({
        content: 'inside',
      });
    });

    it('move across directories', async () => {
      const subA = join(MROOT, 'mv-a');
      const subB = join(MROOT, 'mv-b');
      vol.mkdirSync(subA);
      vol.mkdirSync(subB);
      const from = join(subA, 'item.txt');
      const to = join(subB, 'item.txt');
      vol.writeFileSync(from, 'moved');
      expect(await svc.move(from, to)).toEqual({ ok: true });
      expect(await svc.exists(from)).toBe(false);
      expect(await svc.readFile(to)).toMatchObject({ content: 'moved' });
    });
  });
});
