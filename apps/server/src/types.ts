import type { Broadcaster } from '@code-quest/broadcaster';
import type { DiffFile } from '@code-quest/diff-file';
import type { Filesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import type { Openspec } from '@code-quest/openspec';
import type { LaunchOptions, PluginCliService, ProcessRunner } from '@code-quest/summoner';
import type { ProjectAutoUpserter } from './services/project-auto-upserter.ts';
import type { ProjectStore } from './services/project-store.ts';
import type { RawEventStore } from './services/raw-event-store.ts';
import type { SessionStore } from './services/session-store.ts';
import type { SettingsStore } from './services/settings-store.ts';
import type { UsageTracker } from './services/usage-tracker.ts';
import type { ChannelEmitter } from './socket/channel-emitter.ts';
import type { ChannelManager } from './socket/channel-manager.ts';
import type { PlanApi } from './socket/handlers/plan.ts';
import type { SessionHistory } from './socket/handlers/session/history.ts';

export interface RunnerFactory {
  create(opts?: LaunchOptions, spawnOptions?: Record<string, unknown>): ProcessRunner;
  readonly command: string;
}

export const TYPES: {
  readonly RunnerFactory: symbol;
  readonly SessionStore: symbol;
  readonly ProjectStore: symbol;
  readonly ProjectAutoUpserter: symbol;
  readonly RawEventStore: symbol;
  readonly SocketServer: symbol;
  readonly Database: symbol;
  readonly UsageTracker: symbol;
  readonly SettingsStore: symbol;
  readonly ChannelManager: symbol;
  readonly SessionHistory: symbol;
  readonly ChannelEventRouter: symbol;
  readonly Filesystem: symbol;
  readonly Git: symbol;
  readonly Openspec: symbol;
  readonly PluginCliService: symbol;
  readonly DiffFile: symbol;
  readonly ProcessProvider: symbol;
  readonly FileWatcher: symbol;
  readonly AutoMode: symbol;
  readonly Broadcaster: symbol;
} = {
  RunnerFactory: Symbol.for('RunnerFactory'),
  SessionStore: Symbol.for('SessionStore'),
  ProjectStore: Symbol.for('ProjectStore'),
  ProjectAutoUpserter: Symbol.for('ProjectAutoUpserter'),
  RawEventStore: Symbol.for('RawEventStore'),
  SocketServer: Symbol.for('SocketServer'),
  Database: Symbol.for('Database'),
  UsageTracker: Symbol.for('UsageTracker'),
  SettingsStore: Symbol.for('SettingsStore'),
  ChannelManager: Symbol.for('ChannelManager'),
  SessionHistory: Symbol.for('SessionHistory'),
  ChannelEventRouter: Symbol.for('ChannelEventRouter'),
  Filesystem: Symbol.for('Filesystem'),
  Git: Symbol.for('Git'),
  Openspec: Symbol.for('Openspec'),
  PluginCliService: Symbol.for('PluginCliService'),
  DiffFile: Symbol.for('DiffFile'),
  ProcessProvider: Symbol.for('ProcessProvider'),
  FileWatcher: Symbol.for('FileWatcher'),
  AutoMode: Symbol.for('AutoMode'),
  Broadcaster: Symbol.for('Broadcaster'),
} as const;

export interface HandlerContext {
  autoMode: boolean;
  emitter: ChannelEmitter;
  channelManager: ChannelManager;
  sessionStore: SessionStore;
  projectStore: ProjectStore;
  projectAutoUpserter: ProjectAutoUpserter;
  settingsStore: SettingsStore;
  usageTracker: UsageTracker;
  sessionHistory: SessionHistory;
  rawEventService: RawEventStore;
  filesystemService: Filesystem;
  gitService: Git;
  openspecService: Openspec;
  pluginCli: PluginCliService;
  diffFileService: DiffFile;
  planHandler: PlanApi;
  broadcaster: Broadcaster;
}
