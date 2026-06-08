import { detectWorktree, type WorktreeInfo } from '@code-quest/git';
import type {
  ChannelMetaCache,
  ClientMessage,
  ControlResponse,
  ResolvedControlResponse,
  SessionConfig,
} from '@code-quest/schemas';
import {
  errorMessageEventSchema,
  sessionInitConfigSchema,
  sessionInitEventSchema,
  sessionStatusEventSchema,
} from '@code-quest/schemas';
import type { ProcessRunner } from '@code-quest/summoner';
import { isRecord } from '@code-quest/utils';
import type { z } from 'zod';
import { logger } from '../logger.ts';
import { ControlRequestTracker, DEFAULT_CONTROL_TIMEOUT } from './control-request-tracker.ts';
import type { RequestMeta } from './schemas.ts';
import { pickDefined } from './utils/helpers.ts';

/** Callbacks invoked by Channel when runner events occur. */
export interface ChannelHooks {
  onClientMessage?: (channel: Channel, event: ClientMessage) => void;
  onExit?: (channel: Channel, code: number | null) => void;
}

/** Stored listener references for unbindRunner cleanup. */
interface RunnerListenerRefs {
  clientMessage: (message: ClientMessage) => void;
  controlResponse: (response: ResolvedControlResponse) => void;
  exit: (code: number | null) => void;
}

export class Channel {
  // ── Identity ──
  readonly channelId: string;
  readonly runner: ProcessRunner;
  readonly provider: string;

  // ── State ──
  private _sessionConfig: SessionConfig = {};
  private _metaCache: ChannelMetaCache = {};
  private _sessionId: string | null = null;
  private _cwd: string;
  private _projectRoot: string | null = null;
  private _worktree: WorktreeInfo | null = null;
  private _branch: string | undefined;
  private _lastError: string | undefined;
  private _exited = false;

  // ── UI / Metadata (not CLI config) ──
  private _titleGenerated = false;
  private _pendingTitlePrompt: string | undefined;
  private _title: string | undefined;
  private _parentId: string | undefined;

  // ── Initialization ──
  private _readyPromise: Promise<void> = Promise.resolve();

  get readyPromise(): Promise<void> {
    return this._readyPromise;
  }

  setReadyPromise(p: Promise<void>): void {
    this._readyPromise = p;
  }

  // ── Processing ──
  private _isProcessing = false;

  // ── Control requests ──
  private readonly controlRequests: ControlRequestTracker;
  private readonly mcpTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  // ── Meta ──
  terminalLines: string[] = [];

  get sessionId(): string | null {
    return this._sessionId;
  }
  set sessionId(v: string | null) {
    this._sessionId = v;
  }

  get cwd(): string {
    return this._cwd;
  }

  get projectRoot(): string | null {
    return this._projectRoot;
  }
  set projectRoot(v: string | null) {
    this._projectRoot = v;
  }

  get worktree(): WorktreeInfo | null {
    return this._worktree;
  }
  set worktree(v: WorktreeInfo | null) {
    this._worktree = v;
    if (v) this._cwd = v.path;
  }

  get branch(): string | undefined {
    return this._branch;
  }
  set branch(v: string | undefined) {
    this._branch = v;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }
  set lastError(v: string | undefined) {
    this._lastError = v;
  }

  get exited(): boolean {
    return this._exited;
  }

  get titleGenerated(): boolean {
    return this._titleGenerated;
  }
  set titleGenerated(v: boolean) {
    this._titleGenerated = v;
  }

  get pendingTitlePrompt(): string | undefined {
    return this._pendingTitlePrompt;
  }
  set pendingTitlePrompt(v: string | undefined) {
    this._pendingTitlePrompt = v;
  }

  get title(): string | undefined {
    return this._title;
  }
  set title(v: string | undefined) {
    this._title = v;
  }

  get parentId(): string | undefined {
    return this._parentId;
  }
  set parentId(v: string | undefined) {
    this._parentId = v;
  }

  constructor(
    runner: ProcessRunner,
    channelId: string,
    provider: string,
    cwd: string,
    controlTimeout: number = DEFAULT_CONTROL_TIMEOUT,
  ) {
    this.channelId = channelId;
    this.runner = runner;
    this.provider = provider;
    this._cwd = cwd;
    this.controlRequests = new ControlRequestTracker(controlTimeout);
  }

  // ── State accessors ──

  get sessionConfig(): SessionConfig {
    return this._sessionConfig;
  }

  get metaCache(): ChannelMetaCache {
    return this._metaCache;
  }

  updateSessionConfig(partial: Partial<SessionConfig>): void {
    this._sessionConfig = { ...this._sessionConfig, ...partial };
  }

  resetSessionConfig(): void {
    this._sessionConfig = {};
  }

  updateMetaCache(partial: Partial<ChannelMetaCache>): void {
    this._metaCache = { ...this._metaCache, ...partial };
  }

  /**
   * Build the `settings:update` payload derived from sessionConfig, cwd, and worktree.
   * Returns undefined when no non-empty fields are present (so callers can skip emit).
   * `title` isn't stored on Channel; pass through if the caller has one.
   */
  toSettingsUpdatePayload(): Record<string, unknown> | undefined {
    const ss = this._sessionConfig;
    const settings = pickDefined({
      model: ss.model,
      defaultCwd: this.cwd,
      worktree: this._worktree ?? undefined,
      permissionMode: ss.permissionMode,
      thinkingLevel: ss.thinkingLevel,
      mcpServers: ss.mcpServers,
      tools: ss.tools,
      effort: ss.effort,
    });
    return Object.keys(settings).length > 0 ? settings : undefined;
  }

  // ── Processing ──

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  startProcessing(): void {
    this._isProcessing = true;
  }

  endProcessing(): void {
    this._isProcessing = false;
  }

  get isBound(): boolean {
    return this._runnerListeners !== null;
  }

  // ── Control request tracking ──

  trackControlRequest(requestId: string, meta: RequestMeta): void {
    this.controlRequests.trackInbound(requestId, meta);
  }

  removeControlRequest(requestId: string): void {
    this.controlRequests.removeInbound(requestId);
  }

  hasControlRequest(requestId: string): boolean {
    return this.controlRequests.hasInbound(requestId);
  }

  getControlRequestMeta(requestId: string): RequestMeta | undefined {
    return this.controlRequests.getInboundMeta(requestId);
  }

  setMcpTimeout(requestId: string, timer: ReturnType<typeof setTimeout>): void {
    this.mcpTimeouts.set(requestId, timer);
  }

  clearMcpTimeout(requestId: string): void {
    const t = this.mcpTimeouts.get(requestId);
    if (t) clearTimeout(t);
    this.mcpTimeouts.delete(requestId);
  }

  // ── Runner wrappers ──

  sendMessage(text: string): void {
    this.runner.sendMessage(text);
  }

  respondToRequest(requestId: string, response: Record<string, unknown>): void {
    this.runner.respondToControlRequest(requestId, response);
  }

  write(data: string): void {
    this.runner.write(data);
  }

  kill(): void {
    this.runner.kill();
  }

  sendRequest(event: string, payload: Record<string, unknown> = {}): Promise<ControlResponse> {
    const { subtype, input } = this.runner.formatRequest(event, payload);
    return this.controlRequests.sendOutbound(
      (s, p, id) => this.runner.sendControlRequest(s, p, id),
      subtype,
      input,
    );
  }

  private safeApply<S extends z.ZodTypeAny>(
    schema: S,
    payload: unknown,
    label: string,
    apply: (data: z.infer<S>) => void,
  ): void {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ err: parsed.error, channelId: this.channelId }, `Malformed ${label}`);
      return;
    }
    apply(parsed.data);
  }

  private applyErrorMessage(payload: unknown): void {
    this.safeApply(errorMessageEventSchema, payload, 'error:message', ({ message }) => {
      this.lastError = message;
    });
  }

  private applySessionInit(payload: unknown): void {
    this.safeApply(sessionInitEventSchema, payload, 'session:init', (init) => {
      if (init.sessionId) this.sessionId = init.sessionId;
      this.applySessionInitConfig(init.config ?? {});
      this.updateMetaCache(
        pickDefined({
          model: init.model,
          tools: init.tools,
          permissionMode: init.permissionMode,
          fastModeState: init.fastModeState,
          mcpServers: init.mcpServers,
          slashCommands: init.slashCommands,
        }),
      );
    });
  }

  private applySessionInitConfig(config: unknown): void {
    this.safeApply(
      sessionInitConfigSchema,
      config,
      'session:init config',
      ({ cwd: initCwd, ...initConfig }) => {
        if (initCwd) {
          this._cwd = initCwd;
          const wt = detectWorktree(initCwd);
          if (wt) this.worktree = wt;
        }
        this.updateSessionConfig(initConfig);
      },
    );
  }

  private applySessionStatus(payload: unknown): void {
    this.safeApply(sessionStatusEventSchema, payload, 'session:status', ({ permissionMode }) => {
      if (permissionMode !== undefined) this.updateSessionConfig({ permissionMode });
    });
  }

  /** Update channel internal state from runner messages. */
  private handleInternalMessage(clientMessage: ClientMessage): void {
    switch (clientMessage.name) {
      case 'error:message':
        this.applyErrorMessage(clientMessage.payload);
        break;
      case 'session:init':
        this.applySessionInit(clientMessage.payload);
        break;
      case 'session:status':
        this.applySessionStatus(clientMessage.payload);
        break;
    }
  }

  private _runnerListeners: RunnerListenerRefs | null = null;

  bindRunner(hooks: ChannelHooks = {}): void {
    if (this._runnerListeners) return; // already wired

    const onClientMessage = (message: ClientMessage) => {
      const msg = augmentSessionInit(message, this.runner.launchArgs);
      this.handleInternalMessage(msg);
      hooks.onClientMessage?.(this, msg);
    };

    const onControlResponse = (response: ResolvedControlResponse) => {
      this.controlRequests.resolveOutbound(response);
    };

    const onExit = (code: number | null) => {
      logger.info({ channelId: this.channelId, exitCode: code }, 'CLI process exited');
      this._exited = true;
      this.controlRequests.rejectAllPending(this.lastError ?? `Process exited with code ${code}`);

      // Delegate cleanup to hook (broadcastSessionConfig, session:closed emit)
      hooks.onExit?.(this, code);
    };

    this._runnerListeners = {
      clientMessage: onClientMessage,
      controlResponse: onControlResponse,
      exit: onExit,
    };

    this.runner.on('client_message', onClientMessage);
    this.runner.on('control_response', onControlResponse);
    this.runner.on('exit', onExit);
  }

  unbindRunner(): void {
    if (!this._runnerListeners) return;
    const l = this._runnerListeners;
    this.runner.removeListener('client_message', l.clientMessage);
    this.runner.removeListener('control_response', l.controlResponse);
    this.runner.removeListener('exit', l.exit);
    this._runnerListeners = null;
  }

  destroy(): void {
    this.unbindRunner();
    this.controlRequests.clear();
    for (const timer of this.mcpTimeouts.values()) clearTimeout(timer);
    this.mcpTimeouts.clear();
    this.resetSessionConfig();
    this._exited = true;
  }
}

function augmentSessionInit(message: ClientMessage, launchArgs: string[]): ClientMessage {
  if (message.name !== 'session:init') return message;
  const base = isRecord(message.payload) ? message.payload : {};
  return { ...message, payload: { ...base, args: launchArgs } };
}
