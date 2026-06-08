import type {
  ControlResponse,
  InitResponseResult,
  SessionInitPayload,
  SessionLaunchPayload,
  SocketCallback,
  TypedSocket,
} from '@code-quest/schemas';
import {
  channelExitPayloadSchema,
  controlInitResponseSchema,
  ERROR_CODES,
  EVENTS,
  sessionInitEventSchema,
  sessionJoinPayloadSchema,
  sessionLaunchPayloadSchema,
  sessionResumePayloadSchema,
} from '@code-quest/schemas';
import { errMsg } from '@code-quest/utils';
import { config } from '../../../config.ts';
import { logger } from '../../../logger.ts';
import type { HandlerContext } from '../../../types.ts';
import type { Channel } from '../../channel.ts';
import { BROADCAST_CHANNEL_ID, withChannel } from '../../channel-emitter.ts';
import { DEFAULT_THINKING_TOKENS } from '../../schemas.ts';
import { pickDefined } from '../../utils/helpers.ts';
import { resolveProjectRoot } from '../../utils/project-root.ts';
import { err, ok } from '../../utils/rpc.ts';

/** Substring the Claude CLI emits on stderr when `--resume <sid>` cannot
 *  find the JSONL (session died / was deleted / wrong cwd). Matched as a
 *  substring because the full message also includes the sessionId. */
const CLI_RESUME_MISSING_MARKER = 'No conversation found';

function markDeadIfMissing(
  sessionStore: { updateStatus: (id: string, status: string) => Promise<unknown> },
  sessionId: string | undefined,
  message: string,
): void {
  if (sessionId && message.includes(CLI_RESUME_MISSING_MARKER)) {
    sessionStore
      .updateStatus(sessionId, 'dead')
      .catch((e) => logger.warn({ err: e }, 'Failed to mark session dead'));
  }
}

function ackAndBroadcastCreated(
  channel: Channel,
  emitter: Pick<HandlerContext['emitter'], 'broadcastAll'>,
  callback: SocketCallback | undefined,
  result: InitResponseResult,
  initialPrompt?: string,
): void {
  callback?.(ok({ channelId: channel.channelId, ...result }));
  emitter.broadcastAll(EVENTS.session.created, {
    channelId: channel.channelId,
    cwd: channel.cwd,
    projectRoot: channel.projectRoot ?? channel.cwd,
  });
  if (initialPrompt) channel.sendMessage(initialPrompt);
}

function parseInitResponse(response: ControlResponse): InitResponseResult {
  const initResponse = controlInitResponseSchema.parse(response.response ?? {});
  const { commands, models, account } = initResponse;
  const slashCommands = Array.isArray(commands)
    ? [...new Set(commands.map((c) => c.name))]
    : undefined;
  return { slashCommands, models, account };
}

function buildSessionInitPayload(channel: Channel): SessionInitPayload {
  const meta = channel.metaCache;
  return {
    channelId: channel.channelId,
    ...pickDefined({
      model: meta.model,
      tools: meta.tools,
      permissionMode: meta.permissionMode,
      fastModeState: meta.fastModeState,
      mcpServers: meta.mcpServers,
      slashCommands: meta.slashCommands,
    }),
    config: { ...channel.sessionConfig },
  };
}

export function create({
  channelManager,
  settingsStore,
  sessionStore,
  projectAutoUpserter,
  sessionHistory,
  emitter,
  gitService,
}: Pick<
  HandlerContext,
  | 'channelManager'
  | 'settingsStore'
  | 'sessionStore'
  | 'projectAutoUpserter'
  | 'sessionHistory'
  | 'emitter'
  | 'gitService'
>): void {
  /** Push the session:init payload + cached models list to a single socket.
   *  Used by both launch finalization and session:join history replay. */
  function emitInitState(channel: Channel, socket: TypedSocket | undefined): void {
    if (!socket) return;
    socket.emit(EVENTS.session.init, buildSessionInitPayload(channel));
    if (channelManager.cachedModels) {
      socket.emit(EVENTS.app.models, {
        channelId: BROADCAST_CHANNEL_ID,
        models: channelManager.cachedModels,
      });
    }
  }

  async function applyPerLaunchSettings(
    channel: Channel,
    parsed: Pick<SessionLaunchPayload, 'model' | 'permissionMode' | 'thinkingLevel'>,
  ): Promise<void> {
    const applySetting = (event: string, payload: Record<string, unknown>, label: string) =>
      channel
        .sendRequest(event, payload)
        .catch((e) => logger.warn({ err: e }, `Failed to set ${label}`));

    if (parsed.model) {
      await applySetting(EVENTS.settings.set_model, { model: parsed.model }, 'model');
    }
    if (parsed.permissionMode) {
      await applySetting(
        EVENTS.settings.set_permission_mode,
        { mode: parsed.permissionMode },
        'permission mode',
      );
    }
    if (parsed.thinkingLevel) {
      await applySetting(
        EVENTS.settings.set_thinking_level,
        { tokens: parsed.thinkingLevel === 'off' ? 0 : DEFAULT_THINKING_TOKENS },
        'thinking tokens',
      );
    }
  }

  async function applyInitResponseAndBroadcast(
    initResult: ControlResponse,
  ): Promise<InitResponseResult> {
    const result = parseInitResponse(initResult);
    const { models, account } = result;

    if (models) {
      channelManager.cachedModels = models;
      await settingsStore.set(channelManager.provider, 'models', models);
      emitter.broadcastAll(EVENTS.app.models, { channelId: BROADCAST_CHANNEL_ID, models });
    }

    if (account && Object.keys(account).length > 0) {
      const { email, subscriptionType, authMethod, organization } = account;
      emitter.broadcastAll(EVENTS.settings.update, {
        channelId: BROADCAST_CHANNEL_ID,
        accountInfo: { email, subscriptionType, authMethod, organization },
      });
    }

    return result;
  }

  function buildLaunchOpts(parsed: SessionLaunchPayload): {
    launchOptions: Record<string, unknown>;
    initOptions: Record<string, unknown>;
  } {
    // When thinking is on, pass `--thinking adaptive` at spawn. code-quest's
    // per-launch settings only send a runtime `set_max_thinking_tokens`
    // control request; without this CLI flag, Opus 4.7 silently defaults
    // thinking output to `omitted` (API-default flip vs 4.6) and our
    // thinkingDisplay/summarized knob is gated out by buildArgs.
    const injectThinkingFlag =
      parsed.thinkingLevel !== 'off' && parsed.launchOptions?.thinking === undefined;
    const launchOptions = {
      thinkingDisplay: config.thinkingDisplay,
      ...(injectThinkingFlag ? { thinking: 'adaptive' as const } : {}),
      ...parsed.launchOptions,
      ...(config.allowDangerouslySkipPermissions ? { allowDangerouslySkipPermissions: true } : {}),
    };
    const clientOpts = parsed.initOptions ?? {};
    const initOptions: Record<string, unknown> = {
      ...clientOpts,
      appendSystemPrompt: [clientOpts.appendSystemPrompt, config.systemPrompt]
        .filter(Boolean)
        .join('\n'),
    };
    return { launchOptions, initOptions };
  }

  async function finalizeAndNotify(
    channel: Channel,
    parsed: SessionLaunchPayload,
    initResult: ControlResponse,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    await applyPerLaunchSettings(channel, parsed);
    const { slashCommands, models, account } = await applyInitResponseAndBroadcast(initResult);

    channel.updateMetaCache({
      ...(parsed.model && { model: parsed.model }),
      ...(parsed.permissionMode && { permissionMode: parsed.permissionMode }),
      ...(slashCommands && { slashCommands }),
    });

    emitInitState(channel, socket);
    ackAndBroadcastCreated(
      channel,
      emitter,
      callback,
      { slashCommands, models, account },
      parsed.initialPrompt,
    );
  }

  async function handleLaunch(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const parsed = sessionLaunchPayloadSchema.parse(payload);
      // Payload cwd is optional at protocol layer; UI always supplies it via
      // project context. Fallback to process.cwd() for scripts / direct API
      // callers so Channel.cwd's string invariant is always satisfied.
      const cwd = parsed.cwd ?? process.cwd();
      const channelId = parsed.channelId ?? crypto.randomUUID();
      const { launchOptions, initOptions } = buildLaunchOpts(parsed);
      const projectRoot = await resolveProjectRoot(gitService, cwd);
      const { channel, initResult } = await channelManager.create(channelId, {
        launchOptions,
        initOptions,
        cwd,
        onBeforeSpawn: (ch) => {
          ch.projectRoot = projectRoot;
          if (parsed.branch) ch.branch = parsed.branch;
          if (socket) channelManager.addSocketToChannel(ch, socket);
        },
      });

      // persist is deferred to onSessionInit (session:init may arrive after control_response)

      logger.info({ channelId }, 'Session created');
      await finalizeAndNotify(channel, parsed, initResult, socket, callback);
    } catch (e) {
      logger.error({ err: e }, 'Failed to create session');
      callback?.(err(errMsg(e, 'Failed to create session')));
    }
  }

  async function replayAndEmitState(channel: Channel, socket?: TypedSocket): Promise<void> {
    channelManager.ensureBound(channel);

    const replaySessionId = await sessionHistory.resolveSessionId(channel.channelId);
    if (socket) {
      await sessionHistory.replayPendingControlRequests(socket, channel.channelId, replaySessionId);
    }

    emitInitState(channel, socket);
  }

  async function handleJoin(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { channelId } = sessionJoinPayloadSchema.parse(payload);
      const existing = channelManager.get(channelId);
      let channel: Channel;
      if (existing && !existing.exited) {
        channel = existing;
      } else {
        try {
          ({ channel } = await channelManager.join(channelId));
        } catch (e) {
          logger.debug({ err: e }, 'failed to join channel during connect');
          callback?.(err('Session not found', ERROR_CODES.SESSION_NOT_FOUND));
          return;
        }
      }

      // Wait for CLI init to complete before replaying history.
      // Relevant for resumed channels where createEager was used.
      await channel.readyPromise;

      await replayAndEmitState(channel, socket);
      if (socket) {
        const replayId = crypto.randomUUID();
        for await (const batch of sessionHistory.streamSessionHistory(channel.channelId)) {
          socket.emit(EVENTS.session.history, { channelId, events: batch, replayId });
        }
        channelManager.addSocketToChannel(channel, socket);
      }

      logger.info({ channelId }, 'Session joined');
      const state = channel.isProcessing ? 'busy' : 'idle';
      callback?.(ok({ channelId, state, meta: channel.metaCache, cwd: channel.cwd }));
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to join session')));
    }
  }

  function onSessionInit(ch: Channel, payload: unknown): void {
    channelManager.broadcastSessionState(ch.channelId, 'busy');

    // Persist when session:init arrives (sessionId now available).
    // All channel-creation paths set ch.projectRoot before spawn.
    if (ch.sessionId) {
      const projectRoot = ch.projectRoot ?? ch.cwd;
      const parsed = sessionInitEventSchema.safeParse(payload);
      const runnerArgs = parsed.success ? (parsed.data.args ?? []) : [];
      if (runnerArgs.length === 0) {
        logger.warn(
          { channelId: ch.channelId },
          'session:init payload missing args; DB record will store [] (check ProcessRunner augmentation)',
        );
      }
      sessionStore
        .upsert({
          id: ch.sessionId,
          channelId: ch.channelId,
          provider: channelManager.provider,
          command: channelManager.runnerCommand,
          args: JSON.stringify(runnerArgs),
          cwd: ch.cwd,
          projectRoot,
          mode: 'interactive',
          role: 'chat',
          ...(ch.parentId ? { parentId: ch.parentId } : {}),
          createdAt: new Date().toISOString(),
        })
        .catch((err) => logger.error({ err }, 'Failed to persist session'));

      // Bridge: ensure projects entity exists + broadcast.
      // ProjectAutoUpserter encapsulates the cross-store concern.
      void projectAutoUpserter.onSessionCreated(projectRoot);
    }
  }

  function onChannelExit(ch: Channel, payload: unknown): void {
    const parsed = channelExitPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ err: parsed.error, payload }, 'Invalid channel exit payload');
    }
    channelManager.broadcastSessionState(ch.channelId, 'exited');
    ch.resetSessionConfig();
    logger.info({ channelId: ch.channelId }, 'Session closed');
    emitter.emit(ch.channelId, EVENTS.session.closed, {
      channelId: ch.channelId,
      ...(ch.lastError ? { error: ch.lastError } : {}),
    });
  }

  async function handleResume(
    _ch: Channel | null,
    payload: unknown,
    socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    let sessionId: string | undefined;
    try {
      const parsed = sessionResumePayloadSchema.parse(payload);
      sessionId = parsed.sessionId;
      const reused = channelManager.findAliveBySessionId(sessionId);
      if (reused) {
        callback?.(ok({ channelId: reused.channelId }));
        return;
      }

      // Pull the historical row to recover its cwd — CLI looks up the JSONL
      // at ~/.claude/projects/<encoded-cwd-of-process>/<sid>.jsonl, so the
      // child must spawn with the same cwd or "No conversation found" fires.
      const row = await sessionStore.getById(sessionId);
      if (!row?.cwd) {
        callback?.(err('session row has no cwd; cannot resume', ERROR_CODES.NO_CWD));
        return;
      }
      const cwd = row.cwd;

      const newChannelId = crypto.randomUUID();
      const projectRoot = row.projectRoot ?? (await resolveProjectRoot(gitService, cwd));
      const launchOptions = {
        resumeSessionId: sessionId,
        ...(config.allowDangerouslySkipPermissions
          ? { allowDangerouslySkipPermissions: true }
          : {}),
      };
      const { channel, initResultPromise } = channelManager.createEager(newChannelId, {
        launchOptions,
        cwd,
        onBeforeSpawn: (ch) => {
          // We already know the sessionId — it IS the resume target.
          // Setting it here lets a subsequent session:join correctly
          // resolve the sessionId for history replay without waiting
          // for the CLI's system:init to round-trip.
          if (sessionId) ch.sessionId = sessionId;
          ch.projectRoot = projectRoot;
          if (socket) channelManager.addSocketToChannel(ch, socket);
        },
      });

      // Broadcast and ack immediately — tab appears before CLI finishes init.
      ackAndBroadcastCreated(channel, emitter, callback, {});

      // Build the full init chain: apply response + update metaCache.
      // Override readyPromise so any concurrent session:join waits for the
      // full chain — not just the bare initResultPromise.then(() => {}) set
      // by createEager — ensuring slashCommands are in metaCache before join
      // reads it.
      const fullChainPromise = initResultPromise.then(async (initResult) => {
        const { slashCommands } = await applyInitResponseAndBroadcast(initResult);
        channel.updateMetaCache({ ...(slashCommands && { slashCommands }) });
      });
      channel.setReadyPromise(fullChainPromise);

      fullChainPromise.catch((e) => {
        const message = errMsg(e, 'Failed to apply init response after resume');
        markDeadIfMissing(sessionStore, sessionId, message);
        logger.warn({ err: e }, message);
      });
    } catch (e) {
      const message = errMsg(e, 'Failed to resume session');
      markDeadIfMissing(sessionStore, sessionId, message);
      callback?.(err(message));
    }
  }

  emitter.on(EVENTS.session.init, withChannel(onSessionInit));
  emitter.on('channel:exit', withChannel(onChannelExit));
  emitter.on(EVENTS.session.launch, handleLaunch);
  emitter.on(EVENTS.session.join, handleJoin);
  emitter.on(EVENTS.session.resume, handleResume);
}
