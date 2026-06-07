import { resolve } from 'node:path';
import type { WorktreeInfo } from '@code-quest/git';
import type { ProviderClientConfig, TypedSocket } from '@code-quest/schemas';
import { type ControlResponse, EVENTS, type SessionBroadcastState } from '@code-quest/schemas';
import type { LaunchOptions, ProviderAdapter } from '@code-quest/summoner';
import { logger } from '../logger.ts';
import type { RunnerFactory } from '../types.ts';
import { Channel, type ChannelHooks } from './channel.ts';
import type { ChannelEmitter } from './channel-emitter.ts';
import type { RawRecorder } from './raw-recorder.ts';
import { pickDefined } from './utils/helpers.ts';

/** Minimal interface ChannelManager needs from SessionHistory + sessionStore. */
export interface SessionLookup {
  resolveSessionId(channelId: string): Promise<string>;
  resolveCwdAndProjectRoot(
    channelId: string,
    sessionId: string,
  ): Promise<{ cwd: string; projectRoot: string }>;
}

interface CreateChannelOptions {
  launchOptions?: LaunchOptions;
  initOptions?: Record<string, unknown>;
  cwd: string;
  worktree?: WorktreeInfo;
  /** Called after wiring but before spawn — use to add sockets so they receive init events. */
  onBeforeSpawn?: (channel: Channel) => void;
}

export class ChannelManager {
  private channels = new Map<string, Channel>();
  private hooks: ChannelHooks;
  private _cachedModels: unknown[] | undefined;
  get cachedModels(): unknown[] | undefined {
    return this._cachedModels;
  }

  set cachedModels(models: unknown[] | undefined) {
    this._cachedModels = models;
  }

  private runnerFactory: RunnerFactory;
  private adapter: ProviderAdapter;
  private rawRecorder: RawRecorder;
  private emitter: ChannelEmitter;
  private sessions: SessionLookup;
  constructor(
    runnerFactory: RunnerFactory,
    adapter: ProviderAdapter,
    rawRecorder: RawRecorder,
    emitter: ChannelEmitter,
    sessions: SessionLookup,
  ) {
    this.runnerFactory = runnerFactory;
    this.adapter = adapter;
    this.rawRecorder = rawRecorder;
    this.emitter = emitter;
    this.sessions = sessions;
    this.hooks = {
      onClientMessage: (ch, message) =>
        emitter.dispatchRunnerMessage(ch, message.name, message.payload),
      onExit: (ch, code) => emitter.dispatch('channel:exit', ch, { code }),
    };
  }

  /** Re-wire a channel if it was unwired (e.g. after all sockets disconnected). */
  ensureBound(channel: Channel): void {
    if (!channel.isBound) {
      channel.bindRunner(this.hooks);
    }
  }

  get provider(): string {
    return this.adapter.command;
  }

  get runnerCommand(): string {
    return this.runnerFactory.command;
  }

  get providerClientConfig(): ProviderClientConfig {
    return this.adapter.clientConfig;
  }

  get(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /** Find channel that owns a pending control request. Returns [channelId, channel]. */
  findByRequestId(requestId: string): [string, Channel] | undefined {
    for (const [id, ch] of this.channels) {
      if (ch.hasControlRequest(requestId)) {
        return [id, ch];
      }
    }
    return undefined;
  }

  private setupChannel(
    channelId: string,
    runner: ReturnType<RunnerFactory['create']>,
    cwd: string,
  ): Channel {
    const channel = new Channel(runner, channelId, this.provider, cwd);
    this.channels.set(channelId, channel);
    channel.bindRunner(this.hooks);
    this.rawRecorder.wire(channel);
    return channel;
  }

  async create(
    channelId: string,
    opts: CreateChannelOptions,
  ): Promise<{ channel: Channel; initResult: ControlResponse }> {
    const { channel, initResultPromise } = this.createEager(channelId, opts);
    const initResult = await initResultPromise;
    return { channel, initResult };
  }

  /**
   * Spawn the CLI process and return immediately without waiting for the CLI's
   * initialize control_response. The `channel.readyPromise` resolves when CLI
   * init completes. Use this when you want to broadcast channel existence
   * (session:created) and ack the caller before CLI is fully ready.
   */
  createEager(
    channelId: string,
    opts: CreateChannelOptions,
  ): { channel: Channel; initResultPromise: Promise<ControlResponse> } {
    const existing = this.channels.get(channelId);
    if (existing && !existing.exited) {
      throw new Error(`Channel already exists: ${channelId}`);
    }
    const rawCwd = opts.worktree?.path ?? opts.cwd;
    const cwd = resolve(rawCwd);
    const runner = this.runnerFactory.create(opts.launchOptions, { cwd });
    const channel = this.setupChannel(channelId, runner, cwd);
    logger.info({ channelId }, 'Channel created');

    if (opts.worktree) channel.worktree = opts.worktree;

    opts.onBeforeSpawn?.(channel);
    runner.spawn();
    logger.info({ channelId }, 'CLI process started');

    const initResultPromise = channel.sendRequest('session:initialize', opts.initOptions ?? {});
    const readyPromise = initResultPromise.then(() => {});
    // Suppress unhandled-rejection on readyPromise itself; the error is
    // handled via initResultPromise.catch() in handleResume and will also
    // surface to any caller that awaits channel.readyPromise.
    readyPromise.catch(() => {});
    channel.setReadyPromise(readyPromise);

    return { channel, initResultPromise };
  }

  async join(channelId: string): Promise<{ channel: Channel }> {
    const existing = this.channels.get(channelId);
    if (existing && !existing.exited) {
      return { channel: existing };
    }

    // Lazy resume from DB
    const sessionId = await this.sessions.resolveSessionId(channelId);
    if (sessionId === channelId) {
      throw new Error(`Session not found: ${channelId}`);
    }

    const { cwd, projectRoot } = await this.sessions.resolveCwdAndProjectRoot(channelId, sessionId);

    const runner = this.runnerFactory.create({ resumeSessionId: sessionId }, { cwd });
    const channel = this.setupChannel(channelId, runner, cwd);
    channel.projectRoot = projectRoot;
    logger.info({ channelId }, 'Channel created');
    runner.spawn();
    logger.info({ channelId }, 'CLI process started');
    await channel.sendRequest('session:initialize');

    return { channel };
  }

  destroy(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    try {
      channel.kill();
    } catch (err) {
      // kill() may throw if process already exited — safe to ignore
      logger.debug({ err, channelId }, 'kill() failed during channel removal');
    }
    channel.destroy();
    this.channels.delete(channelId);
    logger.info({ channelId }, 'Channel destroyed');
  }

  getAliveChannels(): Array<[string, Channel]> {
    return [...this.channels].filter(([, ch]) => !ch.exited);
  }

  /** Destroy all channels — for test teardown only. Clears timers without killing processes. */
  destroyAll(): void {
    for (const [channelId, channel] of [...this.channels]) {
      channel.destroy();
      this.channels.delete(channelId);
    }
  }

  getFirstAlive(): Channel | undefined {
    return this.getAliveChannels()[0]?.[1];
  }

  /** sessionIds of alive channels that have already received `system:init`.
   *  Callers needing this (e.g. `session:list excludeLive`) shouldn't have
   *  to reach into `Channel[]` and re-filter. */
  getAliveSessionIds(): string[] {
    return this.getAliveChannels().flatMap(([, ch]) => (ch.sessionId ? [ch.sessionId] : []));
  }

  findAliveBySessionId(sessionId: string): Channel | undefined {
    for (const ch of this.channels.values()) {
      if (!ch.exited && ch.sessionId === sessionId) return ch;
    }
    return undefined;
  }

  // ── Socket tracking ──

  addSocketToChannel(channel: Channel, socket: TypedSocket): void {
    this.emitter.addSocketToChannel(channel.channelId, socket);
  }

  removeSocketFromAll(socketId: string): void {
    const channelIds = this.emitter.removeSocketFromAll(socketId);
    if (!channelIds) return;

    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;

      if (this.emitter.getSocketCount(channelId) === 0) {
        channel.unbindRunner();
      }
    }
  }

  broadcastSessionState(channelId: string, state: SessionBroadcastState, title?: string): void {
    const ch = this.channels.get(channelId);
    const ss = ch?.sessionConfig ?? {};

    this.emitter.broadcastAll(EVENTS.session.states, {
      sessions: [
        {
          channelId,
          state,
          ...pickDefined({
            cwd: ch?.cwd,
            projectRoot: ch?.projectRoot ?? undefined,
            title,
            effort: ss.effort,
          }),
        },
      ],
    });

    const settings = ch?.toSettingsUpdatePayload();
    if (settings) {
      this.emitter.emit(channelId, EVENTS.settings.update, { channelId, ...settings });
    }
  }
}
