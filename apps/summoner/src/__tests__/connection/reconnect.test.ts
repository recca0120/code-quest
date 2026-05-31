import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FakeFilesystem, FakeGit, FakeProcessProvider } from '@code-quest/test-kit';
import { RpcChannel, toRpcSocket, WsClient } from '@code-quest/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { Agent } from '../../agent/agent.ts';
import { FsHandler } from '../../agent/handlers/fs-handler.ts';
import { GitHandler } from '../../agent/handlers/git-handler.ts';
import { ProcessHandler } from '../../agent/handlers/process-handler.ts';

describe('Connection reconnect loop', () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;

  beforeEach(async () => {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
    await new Promise<void>((r) => httpServer.listen(0, r));
  });

  afterEach(async () => {
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    httpServer.closeAllConnections();
    await new Promise<void>((r) => httpServer.close(() => r()));
  });

  function url(): string {
    const { port } = httpServer.address() as AddressInfo;
    return `ws://127.0.0.1:${port}`;
  }

  function makeAgent(opts: { processProvider?: FakeProcessProvider } = {}): {
    agent: Agent;
    processProvider: FakeProcessProvider;
  } {
    const processProvider = opts.processProvider ?? new FakeProcessProvider();
    const agent = new Agent([
      new ProcessHandler(processProvider),
      new FsHandler(new FakeFilesystem()),
      new GitHandler(new FakeGit()),
    ]);
    return { agent, processProvider };
  }

  function makeClient(
    agent: Agent,
    extraOpts: ConstructorParameters<typeof WsClient>[1] = {},
  ): WsClient {
    const client = new WsClient(url(), { initialBackoffMs: 50, ...extraOpts });
    agent.attach(client);
    client.connect();
    return client;
  }

  it('reconnects and registers handlers on new connection', async () => {
    let connectionCount = 0;
    const serverRpcs: RpcChannel[] = [];

    wss.on('connection', (ws) => {
      connectionCount++;
      serverRpcs.push(new RpcChannel(toRpcSocket(ws)));
    });

    const filesystem = new FakeFilesystem();
    const agent = new Agent([
      new ProcessHandler(new FakeProcessProvider()),
      new FsHandler(filesystem),
      new GitHandler(new FakeGit()),
    ]);
    const events: string[] = [];

    const client = new WsClient(url(), { initialBackoffMs: 50 });
    agent.attach(client);

    client.setLifecycleListener({
      onOpen: () => events.push('connect'),
      onClose: () => events.push('disconnect'),
    });
    client.connect();

    await vi.waitFor(() => expect(connectionCount).toBe(1));

    // Kill connection at network level
    client.forceCloseUnderlying();

    // Wait for reconnect
    await vi.waitFor(() => expect(connectionCount).toBe(2), { timeout: 2000 });
    expect(events.filter((e) => e === 'disconnect')).toHaveLength(1);
    expect(events.filter((e) => e === 'connect')).toHaveLength(2);

    // Handlers persist on WsClient — new server connection can call fs/exists
    filesystem.fromTree('/', { tmp: { 'test.txt': 'content' } });
    const result = await serverRpcs[1]!.request('fs/exists', { path: '/tmp/test.txt' });
    expect(result).toEqual({ exists: true });

    client.disconnect();
  });

  it('disconnect() stops reconnecting', async () => {
    let connectionCount = 0;
    wss.on('connection', () => {
      connectionCount++;
    });

    const { agent } = makeAgent();
    const client = makeClient(agent);

    await vi.waitFor(() => expect(connectionCount).toBe(1));
    client.disconnect();

    await new Promise<void>((r) => setTimeout(r, 200));
    expect(connectionCount).toBe(1);
  });

  it('summoner→server push events (stdout/exit) arrive on the new connection after reconnect', async () => {
    let connectionCount = 0;
    const serverRpcs: RpcChannel[] = [];
    const stdoutEvents: unknown[] = [];
    const exitEvents: unknown[] = [];

    wss.on('connection', (ws) => {
      connectionCount++;
      const rpc = new RpcChannel(toRpcSocket(ws));
      serverRpcs.push(rpc);
      rpc.on('process/stdout', (data) => stdoutEvents.push(data));
      rpc.on('process/exit', (data) => exitEvents.push(data));
    });

    const { agent, processProvider } = makeAgent();
    const client = makeClient(agent);

    // First connection: spawn a process
    await vi.waitFor(() => expect(connectionCount).toBe(1));
    await serverRpcs[0]!.request('process/spawn', {
      sessionId: 'sess-reconnect',
      command: 'cat',
      args: [],
    });

    // Kill the WS connection — WsClient will reconnect automatically
    client.forceCloseUnderlying();
    await vi.waitFor(() => expect(connectionCount).toBe(2), { timeout: 2000 });

    // Process still running, emit output after reconnect
    processProvider.latest.emit('hello after reconnect');
    processProvider.latest.abort();

    await vi.waitFor(() => expect(stdoutEvents).toHaveLength(1), { timeout: 1000 });
    expect((stdoutEvents[0] as { line: string }).line).toBe('hello after reconnect');
    await vi.waitFor(() => expect(exitEvents).toHaveLength(1), { timeout: 1000 });

    client.disconnect();
  });

  it('continues reconnecting after repeated disconnects', async () => {
    let connectionCount = 0;
    wss.on('connection', (ws) => {
      connectionCount++;
      // Terminate after a brief delay so handleOpen fires but reconnect is still needed
      setTimeout(() => ws.terminate(), 10);
    });

    const { agent } = makeAgent();
    const client = makeClient(agent, { maxBackoffMs: 200 });

    await vi.waitFor(() => expect(connectionCount).toBeGreaterThanOrEqual(4), { timeout: 5000 });
    client.disconnect();
  });
});
