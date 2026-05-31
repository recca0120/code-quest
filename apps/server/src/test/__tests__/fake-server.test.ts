import type { FsBrowseResponse } from '@code-quest/schemas';
import { FakeClaude, segments as s } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../index.ts';

describe('FakeSummoner', () => {
  it('summoner.claude() returns a working FakeClaude', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = await claude.initialize();
    expect(channelId).toBeTruthy();
  });

  it('fs:browse uses FakeFilesystem', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().fromTree('/projects', { app: {}, blog: {} });

    const claude = summoner.claude();
    await claude.initialize();

    const result = await claude.send<FsBrowseResponse>('fs:browse', {});
    if ('error' in result) throw new Error(result.error);
    expect(result.directories).toEqual([{ name: 'projects', path: '/projects' }]);

    const children = await claude.send<FsBrowseResponse>('fs:browse', {
      path: '/projects',
    });
    if ('error' in children) throw new Error(children.error);
    expect(children.directories).toEqual([
      { name: 'app', path: '/projects/app' },
      { name: 'blog', path: '/projects/blog' },
    ]);
  });

  it('fs:browse returns error when path is outside allowed roots', async () => {
    const summoner = createFakeSummoner();
    summoner.filesystem().fromTree('/projects', {});

    const claude = summoner.claude();
    await claude.initialize();

    const result = await claude.send<FsBrowseResponse>('fs:browse', {
      path: '/unknown',
    });
    expect(result).toEqual({ error: 'Path outside allowed roots' });
  });

  it('multi-window: both clients can browse filesystem', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const windowA = createFakeSummoner(server);
    const windowB = createFakeSummoner(server);

    windowA.filesystem().fromTree('/shared', { data: {} });

    const claudeA = windowA.claude();
    await claudeA.initialize();

    const claudeB = windowB.claude();
    await claudeB.initialize();

    // Both see the same fake filesystem (shared via server)
    const resultA = await claudeA.send<FsBrowseResponse>('fs:browse', {
      path: '/shared',
    });
    const resultB = await claudeB.send<FsBrowseResponse>('fs:browse', {
      path: '/shared',
    });

    if ('error' in resultA) throw new Error(resultA.error);
    if ('error' in resultB) throw new Error(resultB.error);
    expect(resultA.directories).toEqual([{ name: 'data', path: '/shared/data' }]);
    expect(resultB.directories).toEqual([{ name: 'data', path: '/shared/data' }]);
  });

  it('events() returns all recorded events', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    await claude.initialize();

    await claude.emitSegment(s.assistant('hello'));

    const all = claude.receivedEvents();
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((e) => e.event === 'message:assistant')).toBe(true);
  });

  it('events(name) filters by event name', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    const channelId = await claude.initialize();

    await claude.emitSegment(s.assistant('hello'));

    const assistantEvents = claude.receivedEvents('message:assistant');
    expect(assistantEvents.length).toBeGreaterThan(0);
    expect(assistantEvents[0]).toHaveProperty('channelId', channelId);
  });

  it('events() records in arrival order — session:init before message:assistant', async () => {
    const summoner = createFakeSummoner();
    const claude = summoner.claude();
    await claude.initialize();

    await claude.emitSegment(s.assistant('hi'));

    const all = claude.receivedEvents();
    const eventNames = all.map((e) => e.event);
    const initIdx = eventNames.indexOf('session:init');
    const assistIdx = eventNames.indexOf('message:assistant');
    expect(initIdx).toBeLessThan(assistIdx);
  });
});

// ── New: FakeServer tests (target API) ──

describe('FakeServer', () => {
  it('server.connect() returns working socket/provider/filesystem', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const { socket, provider, filesystem } = server.connect();
    expect(socket).toBeTruthy();
    expect(provider).toBeTruthy();
    expect(filesystem).toBeTruthy();
  });

  it('two connects share the same filesystem', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const a = server.connect();
    const b = server.connect();
    expect(a.filesystem).toBe(b.filesystem);
    expect(a.socket).not.toBe(b.socket);
  });

  it('connect returns a socket that can receive server events', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const { socket } = server.connect();

    // Verify socket is connected by checking it has serverSocket
    const serverSocket = socket.serverSocket;
    expect(serverSocket).toBeTruthy();

    // Verify server→client delivery works
    const received: unknown[] = [];
    socket.on('test-event', (data: unknown) => received.push(data));
    serverSocket.emit('test-event', { hello: 'world' });

    await new Promise<void>((r) => queueMicrotask(r));
    expect(received).toEqual([{ hello: 'world' }]);
  });

  it('client→server emit triggers registered handler', () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const { socket } = server.connect();

    let dispatched = false;
    socket.serverSocket.on('test-client-event', () => {
      dispatched = true;
    });
    socket.emit('test-client-event', {});
    expect(dispatched).toBe(true);
  });

  it('FakeClaude can initialize via FakeServer connection', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const { socket, provider } = server.connect();

    const claude = new FakeClaude({ socket, provider });
    const channelId = await claude.initialize();
    expect(channelId).toBeTruthy();
  });
});
