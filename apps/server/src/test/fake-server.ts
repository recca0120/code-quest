import type { RootGuardFilesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import type { Openspec } from '@code-quest/openspec';
import type { PluginCliService } from '@code-quest/summoner';
import type { FakeOpenspec, FakePluginCli } from '@code-quest/summoner/test';
import {
  createFakeSocket,
  type FakeClaude,
  type FakeFilesystem,
  type FakeGit,
  FakeProcessProvider,
  type FakeSocket,
  type FakeSummoner,
  segments as s,
  createFakeSummoner as summonerCreateFakeSummoner,
} from '@code-quest/test-kit';
import type { Container } from 'inversify';
import type { ChannelManager } from '../socket/channel-manager.ts';
import type { SocketServer } from '../socket/server.ts';
import { TYPES } from '../types.ts';
import { createTestContainer } from './create-test-container.ts';

/**
 * FakeServer — shared server infrastructure.
 *
 * Holds the DI container, socket server registration, and manages connections.
 * Each connect() creates a new socket/provider pair (one window).
 */
export class FakeServer {
  private readonly _container: Container;
  private _connectionHandler: ((serverSocket: unknown) => void) | null = null;
  private readonly _allServerSockets: FakeSocket['serverSocket'][] = [];

  constructor(container: Container) {
    this._container = container;

    const socketServer = container.get<SocketServer>(TYPES.SocketServer);

    // Bridge: provide a fake TransportHandle whose onConnection feeds the
    // socket pushed by `connect()` into the SocketServer.
    socketServer.register({
      onConnection: (cb) => {
        this._connectionHandler = cb as (s: unknown) => void;
        return () => {
          this._connectionHandler = null;
        };
      },
      close: async () => {},
    });
  }

  /**
   * Destroy all channels and disconnect all sockets.
   * Call in test teardown (afterEach / onTestFinished) to prevent timer leaks
   * that slow down subsequent tests in the same singleFork process.
   */
  destroy(): void {
    for (const serverSocket of this._allServerSockets) {
      serverSocket.emit('disconnect');
    }
    const manager = this._container.get<ChannelManager>(TYPES.ChannelManager);
    manager.destroyAll();
  }

  /** Create a new window connection — returns socket, provider, filesystem, git. */
  connect(): {
    socket: FakeSocket;
    provider: FakeProcessProvider;
    filesystem: FakeFilesystem;
    git: FakeGit;
    openspec: FakeOpenspec;
    pluginCli: FakePluginCli;
  } {
    const socket = createFakeSocket();
    this._allServerSockets.push(socket.serverSocket);
    this._connectionHandler?.(socket.serverSocket);
    const provider = new FakeProcessProvider();
    if (!this._container.isBound(TYPES.ProcessProvider)) {
      this._container.bind(TYPES.ProcessProvider).toConstantValue(provider);
    }
    const guarded = this._container.get<RootGuardFilesystem>(
      TYPES.Filesystem,
    ) as RootGuardFilesystem;
    const filesystem = guarded.filesystem as FakeFilesystem;
    const git = this._container.get<Git>(TYPES.Git) as FakeGit;
    const openspec = this._container.get<Openspec>(TYPES.Openspec) as FakeOpenspec;
    const pluginCli = this._container.get<PluginCliService>(
      TYPES.PluginCliService,
    ) as FakePluginCli;
    return { socket, provider, filesystem, git, openspec, pluginCli };
  }
}

/** Create a FakeServer. Pass a container for tests that need direct container access. */
export function createFakeServer(container?: Container): FakeServer {
  return new FakeServer(container ?? createTestContainer());
}

/** Create a FakeSummoner (one window). Optionally connect to a shared FakeServer. */
export function createFakeSummoner(server?: FakeServer): FakeSummoner {
  return summonerCreateFakeSummoner(server ?? new FakeServer(createTestContainer()));
}

/**
 * setupSession — shared setup for tests that need a fully initialized session.
 * Creates container, server, summoner, claude, and runs initialize to get a channelId.
 */
export async function setupSession(
  sessionId = 'cli-sess',
  containerOpts?: Parameters<typeof createTestContainer>[0],
): Promise<{
  container: Container;
  server: FakeServer;
  summoner: FakeSummoner;
  claude: FakeClaude;
  channelId: string;
}> {
  const container = createTestContainer(containerOpts);
  const server = new FakeServer(container);
  const summoner = summonerCreateFakeSummoner(server);
  const claude = summoner.claude();
  const channelId = await claude.initialize(s.init(sessionId));
  return { container, server, summoner, claude, channelId };
}

/**
 * getChannelManager — retrieves the ChannelManager from a DI container.
 */
export function getChannelManager(container: Container): InstanceType<typeof ChannelManager> {
  return container.get(TYPES.ChannelManager) as InstanceType<typeof ChannelManager>;
}
