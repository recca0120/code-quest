import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Agent, FsHandler, GitHandler, ProcessHandler } from '@code-quest/summoner/connection';
import { FakeFilesystem, FakeGit, FakeProcessProvider } from '@code-quest/test-kit';
import { RpcChannel, type RpcChannelSocket } from '@code-quest/transport';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { RemoteProcessProvider } from '../process-provider.ts';

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
    const agentProcessProvider = new FakeProcessProvider();

    httpServer = createServer();
    wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        new Agent([
          new ProcessHandler(agentProcessProvider),
          new FsHandler(new FakeFilesystem()),
          new GitHandler(new FakeGit()),
        ]).attach(new RpcChannel(wrapWs(ws)));
      });
    });

    await new Promise<void>((r) => httpServer.listen(0, r));

    const { port } = httpServer.address() as AddressInfo;
    const clientWs = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((r) => clientWs.once('open', r));

    const rpc = new RpcChannel(wrapWs(clientWs));
    const remoteProvider = new RemoteProcessProvider(rpc);

    return { agentProcessProvider, rpc, remoteProvider, clientWs };
  }

  async function teardown() {
    await new Promise<void>((r) => wss.close(() => r()));
    await new Promise<void>((r) => httpServer.close(() => r()));
  }

  return { setup, teardown };
}

describe('RemoteProcessProvider', () => {
  const { setup, teardown } = makeSetup();
  let ctx: Awaited<ReturnType<ReturnType<typeof makeSetup>['setup']>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    ctx.clientWs.close();
    await teardown();
  });

  it('streams stdout lines from the remote process', async () => {
    const handle = ctx.remoteProvider.spawn('echo', ['hello']);

    await new Promise<void>((r) => setTimeout(r, 20));

    ctx.agentProcessProvider.latest.emit('line-a');
    ctx.agentProcessProvider.latest.emit('line-b');
    ctx.agentProcessProvider.latest.abort();

    const lines: string[] = [];
    for await (const line of handle.lines) {
      lines.push(line);
    }

    expect(lines).toEqual(['line-a', 'line-b']);
  });

  it('sends stdin to the remote process', async () => {
    const handle = ctx.remoteProvider.spawn('cat', []);
    await new Promise<void>((r) => setTimeout(r, 20));

    const data = JSON.stringify({ type: 'user', message: 'hi' });
    handle.send(data);
    await new Promise<void>((r) => setTimeout(r, 20));

    const received = ctx.agentProcessProvider.latest.received('user');
    expect(received[0]).toMatchObject({ type: 'user', message: 'hi' });
  });

  it('abort() stops the line stream', async () => {
    const handle = ctx.remoteProvider.spawn('sleep', ['10']);
    await new Promise<void>((r) => setTimeout(r, 20));

    const collected: string[] = [];
    const iterDone = (async () => {
      for await (const line of handle.lines) {
        collected.push(line);
      }
    })();

    handle.abort();
    await iterDone;
    await new Promise<void>((r) => setTimeout(r, 20));

    expect(handle.signal.aborted).toBe(true);
    expect(ctx.agentProcessProvider.latest.signal.aborted).toBe(true);
  });

  it('runOnce collects lines and returns exit code from process/exit notification', async () => {
    const promise = ctx.remoteProvider.runOnce('echo', ['hello']);

    await new Promise<void>((r) => setTimeout(r, 20));
    ctx.agentProcessProvider.latest.emit('line-a');
    ctx.agentProcessProvider.latest.emit('line-b');
    ctx.agentProcessProvider.latest.abort();

    const result = await promise;
    expect(result.stdout).toBe('line-a\nline-b');
    expect(result.exitCode).toBeNull();
  });

  it('runOnce collects stderr from process/stderr notifications', async () => {
    const promise = ctx.remoteProvider.runOnce('warn', []);

    await new Promise<void>((r) => setTimeout(r, 20));
    ctx.agentProcessProvider.latest.emit('out-line');
    ctx.agentProcessProvider.latest.emitStderr('err-line');
    ctx.agentProcessProvider.latest.abort();

    const result = await promise;
    expect(result.stdout).toBe('out-line');
    expect(result.stderr).toBe('err-line');
  });

  it('lines iterator terminates when aborted before iteration begins', async () => {
    const handle = ctx.remoteProvider.spawn('sleep', ['999']);
    handle.abort();
    await new Promise<void>((r) => setTimeout(r, 20));

    const lines: string[] = [];
    for await (const line of handle.lines) {
      lines.push(line);
    }
    expect(lines).toEqual([]);
  });

  it('propagates numeric exit code to handle.signal.reason', async () => {
    const handle = ctx.remoteProvider.spawn('exit', ['42']);
    await new Promise<void>((r) => setTimeout(r, 20));
    ctx.agentProcessProvider.latest.abort(42);

    for await (const _ of handle.lines) {
      /* drain */
    }

    expect(handle.signal.reason).toBe(42);
  });

  it('maps non-numeric abort reason to null exit code (process killed)', async () => {
    const handle = ctx.remoteProvider.spawn('kill', []);
    await new Promise<void>((r) => setTimeout(r, 20));
    ctx.agentProcessProvider.latest.abort(); // no reason → null exit code

    for await (const _ of handle.lines) {
      /* drain */
    }

    // reason is a DOMException (default AbortError) or undefined — not a number
    expect(typeof handle.signal.reason).not.toBe('number');
  });

  it('spawn request fails gracefully when rpc channel is closed', async () => {
    ctx.rpc.close();
    const result = await ctx.remoteProvider.runOnce('echo', []);
    expect(result.exitCode).toBeNull();
  });
});
