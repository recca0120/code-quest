import type { FsMutationResult } from '@code-quest/filesystem';
import type {
  GitAddResult,
  GitCommitResult,
  GitDiscardFileResult,
  GitFetchResult,
  GitLogResult,
  GitPullResult,
  GitPushResult,
} from '@code-quest/git';
import type { ActionOpenFilePayload, ActionOpenUrlPayload } from './actions.ts';
import type { AuthStatus, LoginPayload, OAuthCodePayload } from './auth.ts';
import type {
  CancelRequestPayload,
  ChannelIdPayload,
  ErrorMessagePayload,
  SpeechToTextMessagePayload,
} from './common.ts';
import type {
  ControlCancelPayload,
  ControlDiffReviewPayload,
  ControlElicitationPayload,
  ControlMcpPayload,
  ControlPermissionPayload,
} from './control.ts';
import type { ControlResponse } from './control-response.ts';
import type {
  FsBrowsePayload,
  FsBrowseResponse,
  FsCopyPayload,
  FsCreatePayload,
  FsDeletePayload,
  FsMovePayload,
  FsReadPayload,
  FsReadResponse,
  FsRenamePayload,
  FsSearchPayload,
  FsSearchResponse,
  FsUnwatchPayload,
  FsWatchPayload,
} from './fs.ts';
import type { FilesDirtyEvent, GitDirtyEvent } from './fs-dirty.ts';
import type {
  GitAddPayload,
  GitCommitPayload,
  GitDiffByCwdPayload,
  GitDiffByCwdResult,
  GitDiscardFilePayload,
  GitExecPayload,
  GitExecResponse,
  GitFetchPayload,
  GitLogPayload,
  GitPullPayload,
  GitPushPayload,
  GitStatusByCwdPayload,
  GitStatusByCwdResult,
  GitUpdateSkippedBranchPayload,
} from './git.ts';
import type { HookResponsePayload, HookStartedPayload } from './hook.ts';
import type { PersistedLayout } from './layout.ts';
import type {
  DisableChromeMcpResponse,
  DisableJupyterMcpResponse,
  EnableJupyterMcpResponse,
  EnsureChromeMcpResponse,
  McpAuthenticatePayload,
  McpGetServersPayload,
  McpMessagePayload,
  McpOAuthCallbackPayload,
  McpReconnectPayload,
  McpSetEnabledPayload,
  McpSetServersPayload,
} from './mcp.ts';
import type {
  ChatAskSideQuestionPayload,
  ChatCancelAsyncMessagePayload,
  ChatCancelPayload,
  ChatRespondPayload,
  ChatRewindCodePayload,
  ChatSendPayload,
  ChatStopTaskPayload,
  SideQuestionResult,
} from './message.ts';
import type {
  MessageAssistantPayload,
  MessageResultPayload,
  MessageUserPayload,
} from './message-payloads.ts';
import type {
  StreamBlockStartPayload,
  StreamBlockStopPayload,
  StreamChunkPayload,
  StreamCompactionPayload,
  StreamEndPayload,
  StreamMessageDeltaPayload,
  StreamMessageStartPayload,
  StreamTextPayload,
  StreamToolSummaryPayload,
} from './message-stream.ts';
import type {
  NotificationAuthStatusPayload,
  NotificationAuthUrlPayload,
  NotificationShowPayload,
  NotificationToastPayload,
  RawEventPayload,
} from './notification.ts';
import type {
  OpenspecArchivePayload,
  OpenspecArchiveResult,
  OpenspecChangeNewPayload,
  OpenspecChangeNewResult,
  OpenspecDirtyEvent,
  OpenspecListPayload,
  OpenspecListResult,
  OpenspecReadPayload,
  OpenspecReadResult,
  OpenspecToggleTaskPayload,
  OpenspecToggleTaskResult,
} from './openspec.ts';
import type {
  GetPlanCommentsResponse,
  PlanCommentPayload,
  PlanRemoveCommentPayload,
} from './plan.ts';
import type {
  AddMarketplacePayload,
  ListMarketplacesResponse,
  ListPluginsPayload,
  ListPluginsResponse,
  MarketplaceResult,
  PluginInstallPayload,
  PluginReloadPayload,
  PluginReloadRequestPayload,
  PluginReloadResult,
  PluginResult,
  PluginTogglePayload,
  PluginUninstallPayload,
  RefreshMarketplacePayload,
  RemoveMarketplacePayload,
} from './plugin.ts';
import type {
  Project,
  ProjectsAddPayload,
  ProjectsAddResponse,
  ProjectsListPayload,
  ProjectsListResponse,
  ProjectsRemovedEvent,
  ProjectsRemovePayload,
  ProjectsRemoveResponse,
  ProjectsUpdatePayload,
  ProjectsUpdateResponse,
} from './projects.ts';
import type { GetProviderConfigResponse } from './provider.ts';
import type { Ack, RpcResult } from './rpc.ts';
import type {
  CancelRequestEventPayload,
  CloseChannelPayload,
  ForkConversationResponse,
  GenerateSessionTitleResponse,
  GetSessionResponse,
  InitResponse,
  RawEventsResponse,
  RewindResult,
  SessionClosedPayload,
  SessionClosePayload,
  SessionCreatedPayload,
  SessionDeadPayload,
  SessionDeletePayload,
  SessionForkPayload,
  SessionGenerateTitlePayload,
  SessionGetPayload,
  SessionInitPayload,
  SessionJoinPayload,
  SessionJoinResponse,
  SessionLaunchPayload,
  SessionLaunchResponse,
  SessionListPayload,
  SessionListRemotePayload,
  SessionListResponse,
  SessionRenamePayload,
  SessionResumePayload,
  SessionResumeResponse,
  SessionStatesPayload,
  SessionStatusPayload,
  SessionTeleportPayload,
  SessionUpdateStatePayload,
  TeleportSessionResponse,
} from './session.ts';
import type {
  SettingsApplyPayload,
  SettingsGetStatePayload,
  SettingsSetModelPayload,
  SettingsSetPermissionModePayload,
  SettingsSetProactivePayload,
  SettingsSetRemoteControlPayload,
  SettingsSetThinkingLevelPayload,
  StateUsagePayload,
  UpdateStatePayload,
} from './settings.ts';
import type {
  ChatHookCallbackRespondPayload,
  ControlHookCallbackPayload,
  SystemApiRetryPayload,
  SystemAvailableModelsPayload,
  SystemCompactBoundaryPayload,
  SystemExperimentGatesPayload,
  SystemMirrorErrorPayload,
  SystemPostTurnSummaryPayload,
  SystemRateLimitPayload,
  SystemRemoteControlPayload,
} from './system.ts';
import type { TaskNotificationPayload, TaskProgressPayload, TaskStartedPayload } from './task.ts';
import type {
  TerminalGetContentsPayload,
  TerminalGetContentsResponse,
  TerminalOpenClaudePayload,
} from './terminal.ts';
import type {
  CreateWorktreePayload,
  CreateWorktreeResponse,
  InitRepoPayload,
  InitRepoResponse,
  ListBranchesPayload,
  ListBranchesResponse,
  ListWorktreesPayload,
  WorktreeAddedEvent,
  WorktreeArchivePayload,
  WorktreeArchiveResponse,
  WorktreeBranchChangedEvent,
  WorktreeCheckoutPayload,
  WorktreeCheckoutResponse,
  WorktreeListResponse,
  WorktreeRemovedEvent,
  WorktreeRenamePayload,
  WorktreeRenameResponse,
  WorktreeStatusPayload,
  WorktreeStatusResponse,
} from './worktree.ts';

export interface ClientToServerEvents {
  // ── Chat Operations ──
  'chat:rewind_code': (
    payload: ChatRewindCodePayload,
    callback: (response: RpcResult<RewindResult>) => void,
  ) => void;
  'chat:ask_side_question': (
    payload: ChatAskSideQuestionPayload,
    callback: (response: RpcResult<SideQuestionResult>) => void,
  ) => void;

  // ── Aligned: Settings ──
  'settings:set_model': (payload: SettingsSetModelPayload, cb: (res: Ack) => void) => void;
  'settings:set_permission_mode': (payload: SettingsSetPermissionModePayload) => void;
  'settings:set_thinking_level': (payload: SettingsSetThinkingLevelPayload) => void;
  'settings:refresh_usage': (payload: ChannelIdPayload) => void;
  'settings:apply': (payload: SettingsApplyPayload, callback: (response: Ack) => void) => void;
  'settings:state': (
    payload: SettingsGetStatePayload,
    callback: (response: RpcResult<{ state: Record<string, unknown> }>) => void,
  ) => void;

  // ── Aligned: Session Management ──
  'session:list': (
    payload: SessionListPayload,
    callback: (response: SessionListResponse) => void,
  ) => void;
  'session:list_remote': (
    payload: SessionListRemotePayload,
    callback: (response: SessionListResponse) => void,
  ) => void;
  'session:get': (
    payload: SessionGetPayload,
    callback: (response: GetSessionResponse) => void,
  ) => void;
  'session:teleport': (
    payload: SessionTeleportPayload,
    callback: (response: TeleportSessionResponse) => void,
  ) => void;
  'session:fork': (
    payload: SessionForkPayload,
    callback: (response: ForkConversationResponse) => void,
  ) => void;
  'session:rename': (payload: SessionRenamePayload, callback: (response: Ack) => void) => void;
  'session:delete': (payload: SessionDeletePayload, callback: (response: Ack) => void) => void;
  'session:update_state': (
    payload: SessionUpdateStatePayload,
    callback: (response: Ack) => void,
  ) => void;

  // ── Aligned: Layout ──
  'layout:save': (payload: PersistedLayout) => void;

  // ── Aligned: MCP ──
  'mcp:servers': (
    payload: McpGetServersPayload,
    callback: (response: ControlResponse) => void,
  ) => void;
  'mcp:toggle': (
    payload: McpSetEnabledPayload,
    callback: (response: ControlResponse) => void,
  ) => void;
  'mcp:reconnect': (
    payload: McpReconnectPayload,
    callback: (response: ControlResponse) => void,
  ) => void;
  'mcp:authenticate': (
    payload: McpAuthenticatePayload,
    callback: (result: RpcResult<{ authUrl?: string }>) => void,
  ) => void;
  'mcp:clear_auth': (payload: McpAuthenticatePayload, callback: (result: Ack) => void) => void;
  'mcp:oauth_callback': (payload: McpOAuthCallbackPayload, callback: (result: Ack) => void) => void;
  'mcp:set_servers': (
    payload: McpSetServersPayload,
    callback: (response: ControlResponse) => void,
  ) => void;
  'mcp:message': (
    payload: McpMessagePayload,
    callback: (response: ControlResponse) => void,
  ) => void;
  'mcp:ensure_chrome': (
    payload: ChannelIdPayload,
    callback: (response: EnsureChromeMcpResponse) => void,
  ) => void;
  'mcp:disable_chrome': (
    payload: ChannelIdPayload,
    callback: (response: DisableChromeMcpResponse) => void,
  ) => void;
  'mcp:enable_jupyter': (
    payload: ChannelIdPayload,
    callback: (response: EnableJupyterMcpResponse) => void,
  ) => void;
  'mcp:disable_jupyter': (
    payload: ChannelIdPayload,
    callback: (response: DisableJupyterMcpResponse) => void,
  ) => void;
  'mcp:ask_debugger': (
    payload: ChannelIdPayload,
    callback: (response: RpcResult<{ response: { type: 'ask_debugger_help_response' } }>) => void,
  ) => void;

  // ── Filesystem (global, cwd-scoped — ) ──
  'fs:browse': (payload: FsBrowsePayload, callback: (response: FsBrowseResponse) => void) => void;
  'fs:read': (payload: FsReadPayload, callback: (response: FsReadResponse) => void) => void;
  'fs:search': (payload: FsSearchPayload, callback: (response: FsSearchResponse) => void) => void;
  'fs:watch': (payload: FsWatchPayload, callback?: () => void) => void;
  'fs:unwatch': (payload: FsUnwatchPayload, callback?: () => void) => void;
  'fs:create': (payload: FsCreatePayload, callback: (result: FsMutationResult) => void) => void;
  'fs:delete': (payload: FsDeletePayload, callback: (result: FsMutationResult) => void) => void;
  'fs:rename': (payload: FsRenamePayload, callback: (result: FsMutationResult) => void) => void;
  'fs:copy': (payload: FsCopyPayload, callback: (result: FsMutationResult) => void) => void;
  'fs:move': (payload: FsMovePayload, callback: (result: FsMutationResult) => void) => void;
  'openspec:list': (
    payload: OpenspecListPayload,
    callback: (result: OpenspecListResult) => void,
  ) => void;
  'openspec:read': (
    payload: OpenspecReadPayload,
    callback: (result: OpenspecReadResult) => void,
  ) => void;
  'openspec:changeNew': (
    payload: OpenspecChangeNewPayload,
    callback: (result: OpenspecChangeNewResult) => void,
  ) => void;
  'openspec:archive': (
    payload: OpenspecArchivePayload,
    callback: (result: OpenspecArchiveResult) => void,
  ) => void;
  'openspec:toggleTask': (
    payload: OpenspecToggleTaskPayload,
    callback: (result: OpenspecToggleTaskResult) => void,
  ) => void;

  // ── Projects (global, no channel) ──
  'projects:list': (
    payload: ProjectsListPayload,
    callback: (response: ProjectsListResponse) => void,
  ) => void;
  'projects:add': (
    payload: ProjectsAddPayload,
    callback: (response: ProjectsAddResponse) => void,
  ) => void;
  'projects:update': (
    payload: ProjectsUpdatePayload,
    callback: (response: ProjectsUpdateResponse) => void,
  ) => void;
  'projects:remove': (
    payload: ProjectsRemovePayload,
    callback: (response: ProjectsRemoveResponse) => void,
  ) => void;

  // ── Aligned: Git (per-cwd, mirrors `git` CLI) ──
  'git:init': (payload: InitRepoPayload, callback: (response: InitRepoResponse) => void) => void;
  'git:branches': (
    payload: ListBranchesPayload,
    callback: (response: ListBranchesResponse) => void,
  ) => void;
  'git:checkout': (
    payload: WorktreeCheckoutPayload,
    callback: (response: WorktreeCheckoutResponse) => void,
  ) => void;
  'git:status': (
    payload: GitStatusByCwdPayload,
    callback: (result: GitStatusByCwdResult) => void,
  ) => void;
  'git:statusSummary': (
    payload: WorktreeStatusPayload,
    callback: (response: WorktreeStatusResponse) => void,
  ) => void;
  'git:diff': (
    payload: GitDiffByCwdPayload,
    callback: (result: GitDiffByCwdResult) => void,
  ) => void;
  'git:log': (payload: GitLogPayload, callback: (result: GitLogResult) => void) => void;
  'git:add': (payload: GitAddPayload, callback: (result: GitAddResult) => void) => void;
  'git:commit': (payload: GitCommitPayload, callback: (result: GitCommitResult) => void) => void;
  'git:push': (payload: GitPushPayload, callback: (result: GitPushResult) => void) => void;
  'git:fetch': (payload: GitFetchPayload, callback: (result: GitFetchResult) => void) => void;
  'git:pull': (payload: GitPullPayload, callback: (result: GitPullResult) => void) => void;
  'git:discardFile': (
    payload: GitDiscardFilePayload,
    callback: (result: GitDiscardFileResult) => void,
  ) => void;
  'git:update_skipped_branch': (
    payload: GitUpdateSkippedBranchPayload,
    callback: (response: Ack) => void,
  ) => void;
  'git:exec': (payload: GitExecPayload, callback: (response: GitExecResponse) => void) => void;
  'git:worktree:list': (
    payload: ListWorktreesPayload,
    callback: (response: WorktreeListResponse) => void,
  ) => void;
  'git:worktree:add': (
    payload: CreateWorktreePayload,
    callback: (response: CreateWorktreeResponse) => void,
  ) => void;
  'git:worktree:remove': (
    payload: WorktreeArchivePayload,
    callback: (response: WorktreeArchiveResponse) => void,
  ) => void;
  'git:worktree:rename': (
    payload: WorktreeRenamePayload,
    callback: (response: WorktreeRenameResponse) => void,
  ) => void;

  // ── Aligned: Plugin ──
  'plugin:list': (
    payload: ListPluginsPayload,
    callback: (result: ListPluginsResponse) => void,
  ) => void;
  'plugin:install': (
    payload: PluginInstallPayload,
    callback: (result: PluginResult) => void,
  ) => void;
  'plugin:uninstall': (
    payload: PluginUninstallPayload,
    callback: (result: PluginResult) => void,
  ) => void;
  'plugin:toggle': (payload: PluginTogglePayload, callback: (result: PluginResult) => void) => void;
  'plugin:list_marketplaces': (callback: (result: ListMarketplacesResponse) => void) => void;
  'plugin:add_marketplace': (
    payload: AddMarketplacePayload,
    callback: (result: MarketplaceResult) => void,
  ) => void;
  'plugin:remove_marketplace': (
    payload: RemoveMarketplacePayload,
    callback: (result: MarketplaceResult) => void,
  ) => void;
  'plugin:refresh_marketplace': (
    payload: RefreshMarketplacePayload,
    callback: (result: MarketplaceResult) => void,
  ) => void;
  'plugin:reload': (
    payload: PluginReloadRequestPayload,
    callback: (result: PluginReloadResult) => void,
  ) => void;

  // ── Aligned: Auth ──
  'auth:status': (callback: (result: AuthStatus) => void) => void;
  'auth:login': (
    payload: LoginPayload,
    callback: (result: RpcResult<{ auth?: unknown }>) => void,
  ) => void;
  'auth:oauth_code': (payload: OAuthCodePayload, callback: (result: Ack) => void) => void;

  // ── Aligned: Plan ──
  'plan:comment': (payload: PlanCommentPayload, callback: (response: Ack) => void) => void;
  'plan:comments': (
    payload: ChannelIdPayload,
    callback: (response: GetPlanCommentsResponse) => void,
  ) => void;
  'plan:remove_comment': (
    payload: PlanRemoveCommentPayload,
    callback: (response: Ack) => void,
  ) => void;
  'plan:close_preview': (payload: ChannelIdPayload, callback: (response: Ack) => void) => void;

  // ── Clean relay protocol: new C→S events ──
  'session:launch': (
    payload: SessionLaunchPayload,
    callback: (response: SessionLaunchResponse) => void,
  ) => void;
  'session:close': (payload: SessionClosePayload) => void;
  'session:resume': (
    payload: SessionResumePayload,
    callback: (response: SessionResumeResponse) => void,
  ) => void;
  'session:join': (
    payload: SessionJoinPayload,
    callback: (response: SessionJoinResponse) => void,
  ) => void;
  'chat:send': (payload: ChatSendPayload) => void;
  'chat:cancel': (payload: ChatCancelPayload) => void;
  'chat:respond': (payload: ChatRespondPayload) => void;

  'chat:stop_task': (payload: ChatStopTaskPayload) => void;
  'session:raw_events': (
    payload: ChannelIdPayload,
    callback: (response: RawEventsResponse) => void,
  ) => void;
  'app:init': (callback: (response: InitResponse) => void) => void;
  'chat:cancel_request': (payload: CancelRequestPayload) => void;
  'app:config': (
    payload: ChannelIdPayload,
    callback: (response: GetProviderConfigResponse) => void,
  ) => void;
  'terminal:read': (
    payload: TerminalGetContentsPayload,
    callback: (response: TerminalGetContentsResponse) => void,
  ) => void;
  'terminal:open_claude': (
    payload: TerminalOpenClaudePayload,
    callback: (response: RpcResult<{ channelId: string }>) => void,
  ) => void;

  // ── Aligned: Speech-to-Text ──
  'speech:start': (payload: ChannelIdPayload) => void;
  'speech:stop': (payload: ChannelIdPayload) => void;

  // ── Protocol Alignment: new control_request subtypes ──
  'chat:cancel_async': (payload: ChatCancelAsyncMessagePayload) => void;
  'settings:set_proactive': (payload: SettingsSetProactivePayload) => void;
  'session:generate_title': (
    payload: SessionGenerateTitlePayload,
    callback: (response: GenerateSessionTitleResponse) => void,
  ) => void;
  'settings:set_remote_control': (payload: SettingsSetRemoteControlPayload) => void;
  'chat:hook_respond': (payload: ChatHookCallbackRespondPayload) => void;
}

// ── ClientMessage discriminated union ──
// Producer-side (summoner transform → server Channel) message envelope.
// Each variant binds a precise payload; runtime validation lives in the
// corresponding wire schema (or internal-only schema) exported from ./schemas.

/** Strip channelId — Channel layer injects it post-emit. */
type WireBase<K extends keyof ServerToClientEvents> = Omit<
  Parameters<ServerToClientEvents[K]>[0],
  'channelId'
>;

/** Names emitted by transforms but never sent on the wire directly — they
 * are handled by Channel/auto-respond server handlers, NOT by clients. */
interface InternalOnlyMessageMap {
  'control:open_diff': {
    requestId: string;
    originalPath: string;
    newPath: string;
  };
  'control:forward': {
    requestId: string;
    subtype: string;
    toolName?: string;
    toolUseId?: string;
    input?: unknown;
    suggestions?: unknown[];
    callbackId?: string;
  };
  'mcp:auto_respond': {
    requestId: string;
    response: { mcp_response: Record<string, unknown> };
  };
  'settings:get_settings': { requestId: string };
  'settings:model_updated': { requestId: string; input?: Record<string, unknown> };
  'settings:permission_mode_updated': { requestId: string; input?: Record<string, unknown> };
}

/** Wire events whose producer payload differs from the wire payload
 * (extra scaffolding fields consumed server-side before socket emit). */
interface ProducerOverrideMap {
  // sessionId carried for Channel.handleInternalMessage; args injected by
  // ProcessRunner for session persistence (record actual spawn args).
  'session:init': Omit<WireBase<'session:init'>, 'config'> & {
    sessionId?: string;
    config?: Record<string, unknown>;
    args?: string[];
  };
  // Producer adds requestId + response scaffolding for auto-respond handler
  'notification:show': Omit<WireBase<'notification:show'>, 'severity' | 'buttons'> & {
    requestId: string;
    severity: 'info' | 'warning' | 'error';
    buttons?: unknown[];
    response: { type: 'show_notification_response' };
  };
  'action:open_url': WireBase<'action:open_url'> & {
    requestId: string;
    response: { type: 'open_url_response' };
  };
  'action:open_file': WireBase<'action:open_file'> & {
    requestId: string;
    response: { type: 'open_file_response' };
  };
  // Producer uses numeric utilization; wire RateLimitInfo has Record<string,unknown>.
  // Kept as producer-side shape here — server-side normalization converts before wire emit.
  'system:rate_limit': {
    info: {
      status: string;
      rateLimitType?: string;
      resetsAt?: string;
      utilization?: number;
      overageStatus?: string;
      isUsingOverage?: boolean;
    };
  };
}

/** Server-only events never produced by a transform — excluded from the union. */
type TransformOmittedWireEvents =
  | 'chat:cancel_request'
  | 'plan:comment_added'
  | 'plan:comment_removed'
  | 'session:close_channel'
  | 'session:created'
  | 'session:closed'
  | 'session:dead'
  | 'session:states'
  | 'control:diff_review'
  | 'settings:update'
  | 'settings:usage';

type StraightWireMap = {
  [K in Exclude<
    keyof ServerToClientEvents,
    keyof ProducerOverrideMap | TransformOmittedWireEvents
  >]: WireBase<K>;
};

export interface MessagePayloadMap
  extends InternalOnlyMessageMap,
    ProducerOverrideMap,
    StraightWireMap {}

export type ClientMessage = {
  [K in keyof MessagePayloadMap]: { name: K; payload: MessagePayloadMap[K] };
}[keyof MessagePayloadMap];

export interface ServerToClientEvents {
  // ── Per-channel broadcast events ──
  'chat:cancel_request': (payload: CancelRequestEventPayload) => void;
  'plan:comment_added': (payload: PlanCommentPayload) => void;
  'plan:comment_removed': (payload: PlanRemoveCommentPayload) => void;
  'speech:message': (payload: SpeechToTextMessagePayload) => void;

  // ── Session lifecycle ──
  'session:close_channel': (payload: CloseChannelPayload) => void;
  'session:created': (payload: SessionCreatedPayload) => void;
  'session:closed': (payload: SessionClosedPayload) => void;
  'session:dead': (payload: SessionDeadPayload) => void;
  'session:states': (payload: SessionStatesPayload) => void;

  // ── Projects (global broadcast) ──
  'projects:listed': (projects: Project[]) => void;
  'projects:added': (project: Project) => void;
  'projects:updated': (project: Project) => void;
  'projects:removed': (event: ProjectsRemovedEvent) => void;

  // ── FS / Git dirty (per-cwd broadcast) ──
  'files:dirty': (payload: FilesDirtyEvent) => void;
  'git:dirty': (payload: GitDirtyEvent) => void;
  'openspec:dirty': (payload: OpenspecDirtyEvent) => void;

  // ── Worktree (global broadcast) ──
  'worktree:added': (event: WorktreeAddedEvent) => void;
  'worktree:removed': (event: WorktreeRemovedEvent) => void;
  'worktree:branchChanged': (event: WorktreeBranchChangedEvent) => void;

  // ── Layout (global broadcast) ──
  'layout:sync': (payload: PersistedLayout) => void;

  // ══════════════════════════════════════════════════════════
  // Named socket events (type:subtype format)
  // Each event has its own typed payload.
  // ══════════════════════════════════════════════════════════

  // ── Messages ──
  'message:assistant': (payload: MessageAssistantPayload) => void;
  'message:user': (payload: MessageUserPayload) => void;
  'message:result': (payload: MessageResultPayload) => void;

  // ── Streaming ──
  'stream:chunk': (payload: StreamChunkPayload) => void;
  'stream:end': (payload: StreamEndPayload) => void;
  'stream:text': (payload: StreamTextPayload) => void;
  'stream:tool_summary': (payload: StreamToolSummaryPayload) => void;
  'stream:block_start': (payload: StreamBlockStartPayload) => void;
  'stream:block_stop': (payload: StreamBlockStopPayload) => void;
  'stream:message_start': (payload: StreamMessageStartPayload) => void;
  'stream:message_delta': (payload: StreamMessageDeltaPayload) => void;
  'stream:compaction': (payload: StreamCompactionPayload) => void;

  // ── Session (extends existing session:* pattern) ──
  'session:init': (payload: SessionInitPayload) => void;
  'session:status': (payload: SessionStatusPayload) => void;
  'session:history': (payload: {
    channelId: string;
    events: ClientMessage[];
    replayId: string;
  }) => void;

  // ── Control ──
  'control:permission': (payload: ControlPermissionPayload) => void;
  'control:elicitation': (payload: ControlElicitationPayload) => void;
  'control:diff_review': (payload: ControlDiffReviewPayload) => void;
  'control:mcp': (payload: ControlMcpPayload) => void;
  'control:cancel': (payload: ControlCancelPayload) => void;
  'control:hook_callback': (payload: ControlHookCallbackPayload) => void;

  // ── Hook ──
  'hook:started': (payload: HookStartedPayload) => void;
  'hook:response': (payload: HookResponsePayload) => void;

  // ── Task ──
  'task:started': (payload: TaskStartedPayload) => void;
  'task:progress': (payload: TaskProgressPayload) => void;
  'task:notification': (payload: TaskNotificationPayload) => void;

  // ── System ──
  'system:compact_boundary': (payload: SystemCompactBoundaryPayload) => void;
  'system:rate_limit': (payload: SystemRateLimitPayload) => void;
  'system:api_retry': (payload: SystemApiRetryPayload) => void;
  'app:experiment_gates': (payload: SystemExperimentGatesPayload) => void;
  'app:models': (payload: SystemAvailableModelsPayload) => void;
  'system:remote_control': (payload: SystemRemoteControlPayload) => void;
  'system:mirror_error': (payload: SystemMirrorErrorPayload) => void;
  'system:post_turn_summary': (payload: SystemPostTurnSummaryPayload) => void;
  'plugin:reloaded': (payload: PluginReloadPayload) => void;

  // ── Notifications ──
  'notification:toast': (payload: NotificationToastPayload) => void;
  'notification:show': (payload: NotificationShowPayload) => void;
  'notification:auth_url': (payload: NotificationAuthUrlPayload) => void;
  'notification:auth_status': (payload: NotificationAuthStatusPayload) => void;

  // ── Actions ──
  'action:open_url': (payload: ActionOpenUrlPayload) => void;
  'action:open_file': (payload: ActionOpenFilePayload) => void;

  // ── Remote summoner ──
  'remote:status': (payload: { connected: boolean }) => void;

  // ── Error ──
  'error:message': (payload: ErrorMessagePayload) => void;

  // ── Raw / unknown ──
  'raw:event': (payload: RawEventPayload) => void;

  // ── State (replaces request-based state updates) ──
  'settings:update': (payload: UpdateStatePayload) => void;
  'settings:usage': (payload: StateUsagePayload) => void;

  // ── Transport ──
  'state:refresh_required': (payload: Record<string, never>) => void;
}

/**
 * Centralised socket event names. Use `EVENTS.<ns>.<name>` instead of
 * bare string literals so typos are caught at type-check time and
 * renames flow through a single source.
 */
export const EVENTS = {
  action: {
    open_file: 'action:open_file',
    open_url: 'action:open_url',
  },
  app: {
    config: 'app:config',
    experiment_gates: 'app:experiment_gates',
    init: 'app:init',
    models: 'app:models',
  },
  layout: {
    save: 'layout:save',
    sync: 'layout:sync',
  },
  auth: {
    login: 'auth:login',
    oauth_code: 'auth:oauth_code',
    status: 'auth:status',
  },
  chat: {
    ask_side_question: 'chat:ask_side_question',
    cancel: 'chat:cancel',
    cancel_async: 'chat:cancel_async',
    cancel_request: 'chat:cancel_request',
    hook_respond: 'chat:hook_respond',
    respond: 'chat:respond',
    rewind_code: 'chat:rewind_code',
    send: 'chat:send',
    stop_task: 'chat:stop_task',
  },
  control: {
    cancel: 'control:cancel',
    diff_review: 'control:diff_review',
    elicitation: 'control:elicitation',
    forward: 'control:forward',
    hook_callback: 'control:hook_callback',
    mcp: 'control:mcp',
    open_diff: 'control:open_diff',
    permission: 'control:permission',
  },
  error: {
    message: 'error:message',
  },
  openspec: {
    list: 'openspec:list',
    read: 'openspec:read',
    changeNew: 'openspec:changeNew',
    archive: 'openspec:archive',
    toggleTask: 'openspec:toggleTask',
    // Server → client broadcast: openspec/* file changed
    dirty: 'openspec:dirty',
  },
  projects: {
    list: 'projects:list',
    add: 'projects:add',
    update: 'projects:update',
    remove: 'projects:remove',
    listed: 'projects:listed',
    added: 'projects:added',
    updated: 'projects:updated',
    removed: 'projects:removed',
  },
  fs: {
    // RPC (cwd-scoped, )
    browse: 'fs:browse',
    read: 'fs:read',
    search: 'fs:search',
    watch: 'fs:watch',
    unwatch: 'fs:unwatch',
    create: 'fs:create',
    delete: 'fs:delete',
    rename: 'fs:rename',
    copy: 'fs:copy',
    move: 'fs:move',
    // Server → client broadcast: file changes detected by chokidar
    dirty: 'files:dirty',
  },
  git: {
    init: 'git:init',
    branches: 'git:branches',
    checkout: 'git:checkout',
    status: 'git:status',
    statusSummary: 'git:statusSummary',
    diff: 'git:diff',
    log: 'git:log',
    add: 'git:add',
    commit: 'git:commit',
    push: 'git:push',
    fetch: 'git:fetch',
    pull: 'git:pull',
    discardFile: 'git:discardFile',
    exec: 'git:exec',
    update_skipped_branch: 'git:update_skipped_branch',
    // Server → client broadcast: git state changed (HEAD / index / refs)
    dirty: 'git:dirty',
    worktree: {
      list: 'git:worktree:list',
      add: 'git:worktree:add',
      remove: 'git:worktree:remove',
      rename: 'git:worktree:rename',
    },
  },
  mcp: {
    ask_debugger: 'mcp:ask_debugger',
    authenticate: 'mcp:authenticate',
    auto_respond: 'mcp:auto_respond',
    clear_auth: 'mcp:clear_auth',
    disable_chrome: 'mcp:disable_chrome',
    disable_jupyter: 'mcp:disable_jupyter',
    enable_jupyter: 'mcp:enable_jupyter',
    ensure_chrome: 'mcp:ensure_chrome',
    message: 'mcp:message',
    oauth_callback: 'mcp:oauth_callback',
    reconnect: 'mcp:reconnect',
    servers: 'mcp:servers',
    set_servers: 'mcp:set_servers',
    toggle: 'mcp:toggle',
  },
  message: {
    assistant: 'message:assistant',
    result: 'message:result',
    user: 'message:user',
  },
  notification: {
    auth_status: 'notification:auth_status',
    auth_url: 'notification:auth_url',
    show: 'notification:show',
    toast: 'notification:toast',
  },
  plan: {
    close_preview: 'plan:close_preview',
    comment: 'plan:comment',
    comment_added: 'plan:comment_added',
    comment_removed: 'plan:comment_removed',
    comments: 'plan:comments',
    remove_comment: 'plan:remove_comment',
  },
  plugin: {
    add_marketplace: 'plugin:add_marketplace',
    install: 'plugin:install',
    list: 'plugin:list',
    list_marketplaces: 'plugin:list_marketplaces',
    refresh_marketplace: 'plugin:refresh_marketplace',
    reload: 'plugin:reload',
    reloaded: 'plugin:reloaded',
    remove_marketplace: 'plugin:remove_marketplace',
    toggle: 'plugin:toggle',
    uninstall: 'plugin:uninstall',
  },
  raw: {
    event: 'raw:event',
  },
  session: {
    close: 'session:close',
    close_channel: 'session:close_channel',
    closed: 'session:closed',
    created: 'session:created',
    dead: 'session:dead',
    delete: 'session:delete',
    fork: 'session:fork',
    generate_title: 'session:generate_title',
    get: 'session:get',
    history: 'session:history',
    init: 'session:init',
    join: 'session:join',
    launch: 'session:launch',
    list: 'session:list',
    list_remote: 'session:list_remote',
    raw_events: 'session:raw_events',
    rename: 'session:rename',
    resume: 'session:resume',
    states: 'session:states',
    status: 'session:status',
    teleport: 'session:teleport',
    update_state: 'session:update_state',
  },
  settings: {
    apply: 'settings:apply',
    get_settings: 'settings:get_settings',
    model_updated: 'settings:model_updated',
    permission_mode_updated: 'settings:permission_mode_updated',
    refresh_usage: 'settings:refresh_usage',
    set_model: 'settings:set_model',
    set_permission_mode: 'settings:set_permission_mode',
    set_proactive: 'settings:set_proactive',
    set_remote_control: 'settings:set_remote_control',
    set_thinking_level: 'settings:set_thinking_level',
    state: 'settings:state',
    update: 'settings:update',
    usage: 'settings:usage',
  },
  speech: {
    message: 'speech:message',
    start: 'speech:start',
    stop: 'speech:stop',
  },
  stream: {
    block_start: 'stream:block_start',
    block_stop: 'stream:block_stop',
    chunk: 'stream:chunk',
    compaction: 'stream:compaction',
    end: 'stream:end',
    message_delta: 'stream:message_delta',
    message_start: 'stream:message_start',
    text: 'stream:text',
    tool_summary: 'stream:tool_summary',
  },
  system: {
    api_retry: 'system:api_retry',
    compact_boundary: 'system:compact_boundary',
    mirror_error: 'system:mirror_error',
    post_turn_summary: 'system:post_turn_summary',
    rate_limit: 'system:rate_limit',
    remote_control: 'system:remote_control',
  },
  hook: {
    started: 'hook:started',
    response: 'hook:response',
  },
  task: {
    started: 'task:started',
    progress: 'task:progress',
    notification: 'task:notification',
  },
  terminal: {
    open_claude: 'terminal:open_claude',
    read: 'terminal:read',
  },
  /** Server → client broadcast events (notifications). RPC events for
   *  worktree management live under `git.worktree.*`. */
  worktree: {
    added: 'worktree:added',
    branchChanged: 'worktree:branchChanged',
    removed: 'worktree:removed',
  },
  state: {
    refresh_required: 'state:refresh_required',
  },
} as const;
