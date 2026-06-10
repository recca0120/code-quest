import type { Broadcaster } from '@code-quest/broadcaster';
import type { DiffFile } from '@code-quest/diff-file';
import type { Filesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import type { Openspec } from '@code-quest/openspec';
import type { TransportHandle } from '@code-quest/schemas';
import type { PluginCliService } from '@code-quest/summoner';
import { inject, injectable } from 'inversify';
import type { ProjectAutoUpserter } from '../services/project-auto-upserter.ts';
import type { ProjectStore } from '../services/project-store.ts';
import type { RawEventStore } from '../services/raw-event-store.ts';
import type { SessionStore } from '../services/session-store.ts';
import type { SettingsStore } from '../services/settings-store.ts';
import type { UsageTracker } from '../services/usage-tracker.ts';
import { type HandlerContext, TYPES } from '../types.ts';
import type { ChannelEmitter } from './channel-emitter.ts';
import type { ChannelManager } from './channel-manager.ts';
import * as claudeAuth from './claude/auth.ts';
import * as claudeMcpServers from './claude/mcp-servers.ts';
import * as claudePlugin from './claude/plugin.ts';
import * as app from './handlers/app.ts';
import * as autoRespond from './handlers/auto-respond.ts';
import * as fs from './handlers/fs.ts';
import * as git from './handlers/git.ts';
import * as layout from './handlers/layout.ts';
import * as mcp from './handlers/mcp.ts';
import * as message from './handlers/message.ts';
import * as openspec from './handlers/openspec.ts';
import * as permission from './handlers/permission.ts';
import * as plan from './handlers/plan.ts';
import * as projects from './handlers/projects.ts';
import * as sessionCommand from './handlers/session/command.ts';
import * as sessionConnect from './handlers/session/connect.ts';
import * as sessionFork from './handlers/session/fork.ts';
import type { SessionHistory } from './handlers/session/history.ts';
import * as sessionQuery from './handlers/session/query.ts';
import * as settings from './handlers/settings.ts';
import * as speech from './handlers/speech.ts';
import * as terminal from './handlers/terminal.ts';
import * as usage from './handlers/usage.ts';
import type { LayoutStore } from './layout-store.ts';

@injectable()
export class SocketServer {
  private autoMode: boolean;
  private rawEventService: RawEventStore;
  private sessionStore: SessionStore;
  private projectStore: ProjectStore;
  private projectAutoUpserter: ProjectAutoUpserter;
  private usageTracker: UsageTracker;
  private channelManager: ChannelManager;
  private sessionHistory: SessionHistory;
  private emitter: ChannelEmitter;
  private filesystemService: Filesystem;
  private gitService: Git;
  private openspecService: Openspec;
  private pluginCli: PluginCliService;
  private diffFileService: DiffFile;
  private settingsStore: SettingsStore;
  private broadcaster: Broadcaster;
  private layoutStore: LayoutStore;
  constructor(
    @inject(TYPES.AutoMode) autoMode: boolean,
    @inject(TYPES.RawEventStore) rawEventService: RawEventStore,
    @inject(TYPES.SessionStore) sessionStore: SessionStore,
    @inject(TYPES.ProjectStore) projectStore: ProjectStore,
    @inject(TYPES.ProjectAutoUpserter) projectAutoUpserter: ProjectAutoUpserter,
    @inject(TYPES.UsageTracker) usageTracker: UsageTracker,
    @inject(TYPES.ChannelManager) channelManager: ChannelManager,
    @inject(TYPES.SessionHistory) sessionHistory: SessionHistory,
    @inject(TYPES.ChannelEventRouter) emitter: ChannelEmitter,
    @inject(TYPES.Filesystem) filesystemService: Filesystem,
    @inject(TYPES.Git) gitService: Git,
    @inject(TYPES.Openspec) openspecService: Openspec,
    @inject(TYPES.PluginCliService) pluginCli: PluginCliService,
    @inject(TYPES.DiffFile) diffFileService: DiffFile,
    @inject(TYPES.SettingsStore) settingsStore: SettingsStore,
    @inject(TYPES.Broadcaster) broadcaster: Broadcaster,
    @inject(TYPES.LayoutStore) layoutStore: LayoutStore,
  ) {
    this.autoMode = autoMode;
    this.rawEventService = rawEventService;
    this.sessionStore = sessionStore;
    this.projectStore = projectStore;
    this.projectAutoUpserter = projectAutoUpserter;
    this.usageTracker = usageTracker;
    this.channelManager = channelManager;
    this.sessionHistory = sessionHistory;
    this.emitter = emitter;
    this.filesystemService = filesystemService;
    this.gitService = gitService;
    this.openspecService = openspecService;
    this.pluginCli = pluginCli;
    this.diffFileService = diffFileService;
    this.settingsStore = settingsStore;
    this.broadcaster = broadcaster;
    this.layoutStore = layoutStore;
  }

  private handlersWired = false;

  /**
   * Wire handlers (idempotent) and bridge new connections from the given
   * TransportHandle into the shared ChannelEmitter.
   *
   * Multiple TransportHandles MAY be registered (e.g. socket.io + ws):
   * handlers register exactly once; each subsequent call only attaches its
   * transport's connection stream into the same emitter.
   */
  register(handle: TransportHandle): void {
    this.wireHandlers();
    this.attachTransport(handle);
  }

  /**
   * Wire only the connection bridge for an additional transport. Use this
   * when you have already called `register()` once (or `wireHandlers()`
   * directly) and just need to plug in another transport.
   */
  attachTransport(handle: TransportHandle): void {
    const em = this.emitter;
    const cm = this.channelManager;
    handle.onConnection((socket) => {
      em.handleConnection(socket, (id) => cm.get(id));
    });
  }

  /** Register all handlers onto the shared emitter. Idempotent. */
  private wireHandlers(): void {
    if (this.handlersWired) return;
    this.handlersWired = true;

    const ctx = this.buildHandlerContext();
    this.registerAllHandlers(ctx);
  }

  private buildHandlerContext(): HandlerContext {
    return {
      autoMode: this.autoMode,
      emitter: this.emitter,
      channelManager: this.channelManager,
      sessionStore: this.sessionStore,
      projectStore: this.projectStore,
      projectAutoUpserter: this.projectAutoUpserter,
      settingsStore: this.settingsStore,
      usageTracker: this.usageTracker,
      sessionHistory: this.sessionHistory,
      rawEventService: this.rawEventService,
      filesystemService: this.filesystemService,
      gitService: this.gitService,
      openspecService: this.openspecService,
      pluginCli: this.pluginCli,
      diffFileService: this.diffFileService,
      planHandler: plan.create({ emitter: this.emitter }),
      broadcaster: this.broadcaster,
      layoutStore: this.layoutStore,
    };
  }

  private registerAllHandlers(ctx: HandlerContext): void {
    usage.create(ctx);
    autoRespond.create(ctx);
    permission.create(ctx);
    speech.create(ctx);
    terminal.create(ctx);
    mcp.create(ctx);
    fs.create(ctx);
    openspec.create(ctx);
    projects.create(ctx);
    settings.create(ctx);
    git.create(ctx);
    message.create(ctx);
    app.create(ctx);
    layout.create(ctx);
    sessionConnect.create(ctx);
    sessionCommand.create(ctx);
    sessionFork.create(ctx);
    sessionQuery.create(ctx);

    if (this.channelManager.provider === 'claude') {
      claudeAuth.create(ctx);
      claudeMcpServers.create(ctx);
      claudePlugin.create(ctx);
    }
  }
}
