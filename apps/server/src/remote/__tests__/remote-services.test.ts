import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { RemoteFilesystem } from '@code-quest/filesystem';
import { RemoteGit } from '@code-quest/git';
import { Agent, FsHandler, GitHandler, ProcessHandler } from '@code-quest/summoner/connection';
import { FakeFilesystem, FakeGit, FakeProcessProvider } from '@code-quest/test-kit';
import { RpcChannel, type RpcChannelSocket } from '@code-quest/transport';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

function wrapWs(ws: WebSocket): RpcChannelSocket {
  return {
    send: (data: string) => ws.send(data),
    onMessage: (fn: (data: string) => void) =>
      ws.on('message', (raw: Buffer) => fn(raw.toString())),
    onClose: (fn: () => void) => ws.on('close', fn),
  };
}

function makeSetup() {
  let httpServer: HttpServer;
  let wss: WebSocketServer;

  async function setup() {
    const filesystem = new FakeFilesystem();
    const git = new FakeGit();

    httpServer = createServer();
    wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        new Agent([
          new ProcessHandler(new FakeProcessProvider()),
          new FsHandler(filesystem),
          new GitHandler(git),
        ]).attach(new RpcChannel(wrapWs(ws)));
      });
    });

    await new Promise<void>((r) => httpServer.listen(0, r));

    const { port } = httpServer.address() as AddressInfo;
    const clientWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((r) => clientWs.once('open', r));

    const rpc = new RpcChannel(wrapWs(clientWs));
    const fsService = new RemoteFilesystem(rpc);
    const gitService = new RemoteGit(rpc);

    return { filesystem, git, rpc, fsService, gitService, clientWs };
  }

  async function teardown(clientWs: WebSocket) {
    clientWs.close();
    await new Promise<void>((r) => clientWs.once('close', r));
    await new Promise<void>((r) => wss.close(() => r()));
    await new Promise<void>((r) => httpServer.close(() => r()));
  }

  return { setup, teardown };
}

// ─── RemoteFilesystem ────────────────────────────────────────────────

describe('RemoteFilesystem', () => {
  const { setup, teardown } = makeSetup();
  let ctx: Awaited<ReturnType<ReturnType<typeof makeSetup>['setup']>>;

  beforeEach(async () => {
    ctx = await setup();
  });
  afterEach(async () => {
    await teardown(ctx.clientWs);
  });

  it('browseDirectories — returns root entries', async () => {
    ctx.filesystem.fromTree('/projects', {});
    const entries = await ctx.fsService.browseDirectories();
    expect(entries).toEqual([{ name: 'projects', path: '/projects' }]);
  });

  it('browseDirectories — returns children of a path', async () => {
    ctx.filesystem.fromTree('/projects', { app: {}, blog: {} });
    const entries = await ctx.fsService.browseDirectories('/projects');
    expect(entries).toEqual([
      { name: 'app', path: '/projects/app' },
      { name: 'blog', path: '/projects/blog' },
    ]);
  });

  it('browseEntries — returns directories and files', async () => {
    ctx.filesystem.fromTree('/src', { lib: {}, 'index.ts': '' });
    const result = await ctx.fsService.browseEntries('/src');
    expect(result.directories).toEqual([{ name: 'lib', path: '/src/lib' }]);
    expect(result.files).toMatchObject([{ name: 'index.ts', path: '/src/index.ts' }]);
  });

  it('readFile — returns file content for absolute path', async () => {
    ctx.filesystem.fromTree('/tmp', { 'hello.txt': 'hello world' });
    const result = await ctx.fsService.readFile('/tmp/hello.txt');
    expect(result).toMatchObject({ content: 'hello world' });
  });

  it('writeFile — persists content to disk', async () => {
    ctx.filesystem.fromTree('/tmp', {});
    await ctx.fsService.writeFile('/tmp/out.txt', 'written');
    expect(await ctx.fsService.exists('/tmp/out.txt')).toBe(true);
  });

  it('readFile — returns previously written content', async () => {
    ctx.filesystem.fromTree('/tmp', {});
    await ctx.fsService.writeFile('/tmp/out.txt', 'written');
    const result = await ctx.fsService.readFile('/tmp/out.txt');
    expect(result).toMatchObject({ content: 'written' });
  });

  it('readFile — reads file relative to cwd', async () => {
    ctx.filesystem.fromTree('/workspace', { src: { 'main.ts': 'export {}' } });
    const result = await ctx.fsService.readFile('src/main.ts', { cwd: '/workspace' });
    expect(result).toMatchObject({ content: 'export {}' });
  });

  it('listFiles — returns matching files', async () => {
    ctx.filesystem.fromTree('/workspace', { src: { 'main.ts': '', 'util.ts': '' } });
    const files = await ctx.fsService.listFiles('/workspace/src', 'main');
    expect(files.map((f) => f.name)).toContain('main.ts');
    expect(files.map((f) => f.name)).not.toContain('util.ts');
  });

  it('exists — true for known file, false for missing', async () => {
    ctx.filesystem.fromTree('/', { tmp: { 'hello.txt': '' } });
    expect(await ctx.fsService.exists('/tmp/hello.txt')).toBe(true);
    expect(await ctx.fsService.exists('/tmp/missing.txt')).toBe(false);
  });

  it('isDirectory — true for directory, false for file', async () => {
    ctx.filesystem.fromTree('/', { tmp: { 'file.txt': '' } });
    expect(await ctx.fsService.isDirectory('/tmp')).toBe(true);
    expect(await ctx.fsService.isDirectory('/tmp/file.txt')).toBe(false);
  });

  it('statKind — returns file/directory/null', async () => {
    ctx.filesystem.fromTree('/tmp', { 'a.txt': '' });
    expect(await ctx.fsService.statKind('/tmp')).toBe('directory');
    expect(await ctx.fsService.statKind('/tmp/a.txt')).toBe('file');
    expect(await ctx.fsService.statKind('/tmp/nope')).toBeNull();
  });

  it('create — creates a file', async () => {
    ctx.filesystem.fromTree('/tmp', {});
    const result = await ctx.fsService.create('/tmp/new.txt', 'file');
    expect(result).toEqual({ ok: true });
    expect(await ctx.fsService.exists('/tmp/new.txt')).toBe(true);
  });

  it('delete — removes a file', async () => {
    ctx.filesystem.fromTree('/tmp', { 'to-delete.txt': '' });
    const result = await ctx.fsService.delete('/tmp/to-delete.txt');
    expect(result).toEqual({ ok: true });
    expect(await ctx.fsService.exists('/tmp/to-delete.txt')).toBe(false);
  });

  it('rename — moves a file to a new path', async () => {
    ctx.filesystem.fromTree('/tmp', { 'old.txt': 'data' });
    const result = await ctx.fsService.rename('/tmp/old.txt', '/tmp/new.txt');
    expect(result).toEqual({ ok: true });
    expect(await ctx.fsService.exists('/tmp/new.txt')).toBe(true);
    expect(await ctx.fsService.exists('/tmp/old.txt')).toBe(false);
  });

  it('copy — duplicates a file', async () => {
    ctx.filesystem.fromTree('/tmp', { 'src.txt': 'hello' });
    const result = await ctx.fsService.copy('/tmp/src.txt', '/tmp/dst.txt');
    expect(result).toEqual({ ok: true });
    expect(await ctx.fsService.exists('/tmp/src.txt')).toBe(true);
    expect(await ctx.fsService.exists('/tmp/dst.txt')).toBe(true);
  });

  it('move — aliases rename', async () => {
    ctx.filesystem.fromTree('/tmp', { 'a.txt': '' });
    const result = await ctx.fsService.move('/tmp/a.txt', '/tmp/b.txt');
    expect(result).toEqual({ ok: true });
    expect(await ctx.fsService.exists('/tmp/b.txt')).toBe(true);
  });

  it('rejects when connection is closed', async () => {
    ctx.rpc.close();
    await expect(ctx.fsService.browseDirectories()).rejects.toThrow('RpcChannel closed');
  });
});

// ─── RemoteGit ────────────────────────────────────────────────────────

describe('RemoteGit', () => {
  const { setup, teardown } = makeSetup();
  let ctx: Awaited<ReturnType<ReturnType<typeof makeSetup>['setup']>>;

  beforeEach(async () => {
    ctx = await setup();
  });
  afterEach(async () => {
    await teardown(ctx.clientWs);
  });

  it('status — returns branch and clean state', async () => {
    ctx.git.setBranch('feat/remote');
    ctx.git.setClean(false);
    const result = await ctx.gitService.status('/repo');
    expect(result.branch).toBe('feat/remote');
    expect(result.isClean).toBe(false);
  });

  it('checkout — resolves without throwing', async () => {
    await expect(ctx.gitService.checkout('/repo', 'main')).resolves.toBeUndefined();
  });

  it('log — returns configured entries', async () => {
    ctx.git.setLogEntries([{ hash: 'abc123', message: 'init', author: 'dev', date: '2024-01-01' }]);
    const result = await ctx.gitService.log('/repo', 10);
    expect('entries' in result && result.entries[0]?.hash).toBe('abc123');
  });

  it('diff — returns configured diff string', async () => {
    ctx.git.setDiff('- old\n+ new');
    const result = await ctx.gitService.diff('/repo', 'src/a.ts', 'M');
    expect(result.diff).toBe('- old\n+ new');
  });

  it('add — stages files and returns ok', async () => {
    ctx.git.setChangedFiles([{ file: 'a.ts', status: 'M' }]);
    const result = await ctx.gitService.add('/repo', ['a.ts']);
    expect(result).toEqual({ ok: true });
    expect(ctx.git.stagedCount).toBe(1);
  });

  it('commit — returns hash after staging', async () => {
    ctx.git.setChangedFiles([{ file: 'a.ts', status: 'M' }]);
    await ctx.gitService.add('/repo', ['a.ts']);
    const result = await ctx.gitService.commit('/repo', 'chore: update');
    expect('hash' in result && result.hash).toMatch(/^fake-/);
  });

  it('push — returns ok', async () => {
    const result = await ctx.gitService.push('/repo');
    expect(result).toEqual({ ok: true });
  });

  it('fetch — returns ok', async () => {
    const result = await ctx.gitService.fetch('/repo');
    expect(result).toEqual({ ok: true });
  });

  it('pull — returns ok with fastForwarded', async () => {
    const result = await ctx.gitService.pull('/repo');
    expect('ok' in result && result.ok).toBe(true);
  });

  it('discardFile — removes file and returns ok', async () => {
    const result = await ctx.gitService.discardFile('/repo', 'src/a.ts');
    expect(result).toEqual({ ok: true });
    expect(ctx.git.discardedFiles).toContain('src/a.ts');
  });

  it('getRepoRoot — returns configured root', async () => {
    ctx.git.setRepoRoot('/workspace/my-repo');
    expect(await ctx.gitService.getRepoRoot('/workspace/my-repo/src')).toBe('/workspace/my-repo');
  });

  it('getProjectRoot — returns configured project root', async () => {
    ctx.git.setProjectRoot('/workspace/project');
    expect(await ctx.gitService.getProjectRoot('/workspace/project/src')).toBe(
      '/workspace/project',
    );
  });

  it('initRepo — initialises a new repo', async () => {
    const result = await ctx.gitService.initRepo('/new-repo');
    expect(result).toEqual({ branch: 'main' });
  });

  it('listBranches — returns empty list by default', async () => {
    ctx.git.markAsRepo('/repo');
    const result = await ctx.gitService.listBranches('/repo');
    expect(result).toEqual(['main']);
  });

  it('createWorktree — returns worktree info', async () => {
    const result = await ctx.gitService.createWorktree('/repo', { newBranch: 'feat/wt' });
    expect(result.branch).toBe('feat/wt');
  });

  it('listWorktrees — returns configured worktrees', async () => {
    ctx.git.markAsRepo('/repo');
    ctx.git.addWorktree({ name: 'feat-wt', path: '/repo/feat-wt', branch: 'feat/wt' });
    const result = await ctx.gitService.listWorktrees('/repo');
    expect(result.some((w) => w.name === 'feat-wt')).toBe(true);
  });

  it('deleteWorktree — resolves without throwing', async () => {
    ctx.git.addWorktree({ name: 'to-delete', path: '/repo/to-delete', branch: 'feat/delete' });
    await expect(ctx.gitService.deleteWorktree('/repo', 'to-delete')).resolves.toBeUndefined();
  });

  it('renameWorktree — returns renamed worktree info', async () => {
    ctx.git.addWorktree({ name: 'old-wt', path: '/repo/old-wt', branch: 'feat/old' });
    const result = await ctx.gitService.renameWorktree('/repo/old-wt', 'feat/new');
    expect(result.branch).toBe('feat/new');
  });

  it('archiveWorktree — returns archive result', async () => {
    ctx.git.addWorktree({ name: 'wt', path: '/repo/wt', branch: 'feat/archive' });
    const result = await ctx.gitService.archiveWorktree('/repo', 'wt', {});
    expect(result).toEqual({ ok: true });
  });

  it('rejects when connection is closed', async () => {
    ctx.rpc.close();
    await expect(ctx.gitService.status('/repo')).rejects.toThrow('RpcChannel closed');
  });
});
