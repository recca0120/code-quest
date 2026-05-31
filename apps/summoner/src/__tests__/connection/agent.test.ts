import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FakeFilesystem, FakeGit, FakeProcessProvider } from '@code-quest/test-kit';
import { type Envelope, RpcChannel, toRpcSocket } from '@code-quest/transport';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { Agent } from '../../agent/agent.ts';
import { FsHandler } from '../../agent/handlers/fs-handler.ts';
import { GitHandler } from '../../agent/handlers/git-handler.ts';
import { ProcessHandler } from '../../agent/handlers/process-handler.ts';

function makeSetup() {
  let httpServer: HttpServer;
  let wss: WebSocketServer;

  async function setup() {
    const processProvider = new FakeProcessProvider();
    const filesystem = new FakeFilesystem();
    const git = new FakeGit();

    httpServer = createServer();
    wss = new WebSocketServer({ noServer: true });

    const agent = new Agent([
      new ProcessHandler(processProvider),
      new FsHandler(filesystem),
      new GitHandler(git),
    ]);
    httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        agent.attach(new RpcChannel(toRpcSocket(ws)));
      });
    });

    await new Promise<void>((r) => httpServer.listen(0, r));

    const { port } = httpServer.address() as AddressInfo;
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((r) => client.once('open', r));

    let nextId = 1;
    function rpc<R>(method: string, params: unknown): Promise<R> {
      return new Promise((resolve, reject) => {
        const id = String(nextId++);
        const handler = (raw: Buffer) => {
          const env = JSON.parse(raw.toString()) as Envelope;
          if (env.kind === 'response' && env.id === id) {
            client.off('message', handler);
            if (env.ok) resolve(env.data as R);
            else reject(new Error(env.error ?? 'Unknown error'));
          }
        };
        client.on('message', handler);
        client.send(JSON.stringify({ kind: 'request', id, event: method, data: params }));
      });
    }

    return { processProvider, filesystem, git, client, rpc, agent };
  }

  async function teardown() {
    await new Promise<void>((r) => wss.close(() => r()));
    await new Promise<void>((r) => httpServer.close(() => r()));
  }

  return { setup, teardown };
}

describe('Agent', () => {
  const { setup, teardown } = makeSetup();
  let ctx: Awaited<ReturnType<ReturnType<typeof makeSetup>['setup']>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    ctx.client.close();
    await teardown();
  });

  function collectNotifications(client: (typeof ctx)['client']): Envelope[] {
    const notifications: Envelope[] = [];
    client.on('message', (raw) => {
      const env = JSON.parse(raw.toString()) as Envelope;
      if (env.kind === 'event') notifications.push(env);
    });
    return notifications;
  }

  describe('process dispatch', () => {
    it('spawns a process and streams stdout lines then exit', async () => {
      const notifications = collectNotifications(ctx.client);

      await ctx.rpc<{ ok: true }>('process/spawn', {
        sessionId: 'sess-1',
        command: 'echo',
        args: ['hello'],
        cwd: '/tmp',
      });

      ctx.processProvider.latest.emit('line1');
      ctx.processProvider.latest.emit('line2');
      ctx.processProvider.latest.abort();

      await new Promise<void>((r) => setTimeout(r, 20));

      const stdouts = notifications.filter(
        (n) => n.kind === 'event' && n.event === 'process/stdout',
      );
      const exits = notifications.filter((n) => n.kind === 'event' && n.event === 'process/exit');

      expect(stdouts).toHaveLength(2);
      expect((stdouts[0] as { data: { line: string } }).data.line).toBe('line1');
      expect(exits).toHaveLength(1);
      expect((exits[0] as { data: { code: number | null } }).data.code).toBeNull();
    });

    it('forwards real exit code via process/exit notification', async () => {
      const notifications = collectNotifications(ctx.client);

      await ctx.rpc('process/spawn', {
        sessionId: 'sess-exit',
        command: 'failing',
        args: [],
      });

      ctx.processProvider.latest.abort(1);
      await new Promise<void>((r) => setTimeout(r, 20));

      const exits = notifications.filter((n) => n.kind === 'event' && n.event === 'process/exit');
      expect(exits).toHaveLength(1);
      expect((exits[0] as { data: { code: number } }).data.code).toBe(1);
    });

    it('streams stderr via process/stderr notification', async () => {
      const notifications = collectNotifications(ctx.client);

      await ctx.rpc('process/spawn', {
        sessionId: 'sess-stderr',
        command: 'warn',
        args: [],
      });

      ctx.processProvider.latest.emitStderr('warning: something');
      ctx.processProvider.latest.abort();
      await new Promise<void>((r) => setTimeout(r, 20));

      const stderrs = notifications.filter(
        (n) => n.kind === 'event' && n.event === 'process/stderr',
      );
      expect(stderrs).toHaveLength(1);
      expect((stderrs[0] as { data: { line: string } }).data.line).toBe('warning: something');
    });

    it('forwards stdin to the spawned process', async () => {
      await ctx.rpc('process/spawn', { sessionId: 'sess-2', command: 'cat', args: [] });
      const data = JSON.stringify({ type: 'user', message: 'hello' });
      await ctx.rpc('process/stdin', { sessionId: 'sess-2', data });

      const received = ctx.processProvider.latest.received('user');
      expect(received[0]).toMatchObject({ type: 'user', message: 'hello' });
    });

    it('kills the spawned process', async () => {
      await ctx.rpc('process/spawn', { sessionId: 'sess-3', command: 'sleep', args: ['10'] });
      await ctx.rpc('process/kill', { sessionId: 'sess-3' });

      expect(ctx.processProvider.latest.signal.aborted).toBe(true);
    });
  });

  describe('fs dispatch', () => {
    it('browseDirectories returns entries from Filesystem', async () => {
      ctx.filesystem.fromTree('/projects', { app: {}, blog: {} });

      const result = await ctx.rpc<{ entries: { name: string; path: string }[] }>(
        'fs/browseDirectories',
        { path: '/projects' },
      );

      expect(result.entries).toEqual([
        { name: 'app', path: '/projects/app' },
        { name: 'blog', path: '/projects/blog' },
      ]);
    });

    it('fs/exists returns true for a known file', async () => {
      ctx.filesystem.fromTree('/', { tmp: { 'hello.txt': 'hello' } });

      const result = await ctx.rpc<{ exists: boolean }>('fs/exists', { path: '/tmp/hello.txt' });
      expect(result.exists).toBe(true);
    });
  });

  describe('git dispatch', () => {
    it('git/status returns the current branch', async () => {
      ctx.git.setBranch('feat/test');

      const result = await ctx.rpc<{ branch: string }>('git/status', { cwd: '/repo' });
      expect(result.branch).toBe('feat/test');
    });
  });

  describe('error handling', () => {
    it('returns error for unknown method', async () => {
      await expect(ctx.rpc('unknown/method', {})).rejects.toThrow('Unknown method: unknown/method');
    });
  });

  describe('dispose', () => {
    it('aborts all spawned processes on dispose', async () => {
      await ctx.rpc('process/spawn', { sessionId: 'a', command: 'sleep', args: ['10'] });
      await ctx.rpc('process/spawn', { sessionId: 'b', command: 'sleep', args: ['10'] });

      ctx.agent.dispose();

      expect(ctx.processProvider.all[0]!.signal.aborted).toBe(true);
      expect(ctx.processProvider.all[1]!.signal.aborted).toBe(true);
    });
  });

  describe('duplicate sessionId spawn', () => {
    it('rejects duplicate spawn and leaves original process running', async () => {
      await ctx.rpc('process/spawn', { sessionId: 'dup', command: 'sleep', args: ['10'] });
      const original = ctx.processProvider.all[0]!;

      await expect(
        ctx.rpc('process/spawn', { sessionId: 'dup', command: 'sleep', args: ['10'] }),
      ).rejects.toThrow();

      expect(original.signal.aborted).toBe(false);
      expect(ctx.processProvider.all).toHaveLength(1);
    });

    it('allows respawn after process exits', async () => {
      await ctx.rpc('process/spawn', { sessionId: 'reuse', command: 'sleep', args: ['10'] });
      const first = ctx.processProvider.all[0]!;

      // Abort the process to trigger exit cleanup in streamProcess
      first.abort();
      // Flush microtasks so streamProcess finally block runs and removes sessionId
      await new Promise((r) => setTimeout(r, 10));

      const result = await ctx.rpc<{ ok: true }>('process/spawn', {
        sessionId: 'reuse',
        command: 'sleep',
        args: ['10'],
      });
      expect(result).toEqual({ ok: true });
      expect(ctx.processProvider.all).toHaveLength(2);
    });
  });
});
