import { z } from 'zod';
import { channelMetaCacheSchema } from './common.ts';
import { rpcResult } from './rpc.ts';
import { effortLevelSchema } from './settings.ts';

const clientMessageSchema: z.ZodObject<
  { name: z.ZodString; payload: z.ZodRecord<z.ZodString, z.ZodUnknown> },
  z.core.$strip
> = z.object({
  name: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const SESSION_LIST_LIMIT = 100;

// ── Session summary ──

export const sessionSummarySchema: z.ZodObject<
  {
    id: z.ZodString;
    channelId: z.ZodString;
    provider: z.ZodString;
    command: z.ZodString;
    args: z.ZodString;
    cwd: z.ZodOptional<z.ZodString>;
    projectRoot: z.ZodString;
    mode: z.ZodString;
    role: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    isActive: z.ZodOptional<z.ZodBoolean>;
    lastAssistantMessage: z.ZodOptional<z.ZodString>;
    firstUserMessage: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
> = z.object({
  /** The durable sessionId (DB row PK). Use this when calling useResume(). */
  id: z.string(),
  channelId: z.string(),
  provider: z.string(),
  command: z.string(),
  args: z.string(),
  cwd: z.string().optional(),
  projectRoot: z.string(),
  mode: z.string(),
  role: z.string(),
  parentId: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string(),
  isActive: z.boolean().optional(),
  lastAssistantMessage: z.string().optional(),
  firstUserMessage: z.string().optional(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionListResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<
          {
            sessions: z.ZodArray<typeof sessionSummarySchema>;
            total: z.ZodNumber;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    sessions: z.array(sessionSummarySchema),
    total: z.number(),
  }),
);
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

// ── Internal schemas ──

const hookEntrySchema: z.ZodObject<
  {
    matcher: z.ZodString;
    hookCallbackIds: z.ZodArray<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
  },
  z.core.$strip
> = z.object({
  matcher: z.string(),
  hookCallbackIds: z.array(z.string()),
  timeout: z.number().optional(),
});

export const initializeOptionsSchema: z.ZodObject<
  {
    hooks: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<typeof hookEntrySchema>>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    appendSystemPrompt: z.ZodOptional<z.ZodString>;
    jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    agents: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    resumeSessionAt: z.ZodOptional<z.ZodString>;
  },
  z.core.$loose
> = z.looseObject({
  hooks: z.record(z.string(), z.array(hookEntrySchema)).optional(),
  systemPrompt: z.string().optional(),
  appendSystemPrompt: z.string().optional(),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  agents: z.record(z.string(), z.unknown()).optional(),
  resumeSessionAt: z.string().optional(),
});
export type InitializeOptions = z.infer<typeof initializeOptionsSchema>;

export const launchOptionsSchema: z.ZodOptional<
  z.ZodObject<
    {
      resumeSessionId: z.ZodOptional<z.ZodString>;
      continueSession: z.ZodOptional<z.ZodBoolean>;
      forkSession: z.ZodOptional<z.ZodBoolean>;
      sessionId: z.ZodOptional<z.ZodString>;
      resumeSessionAt: z.ZodOptional<z.ZodString>;
      noSessionPersistence: z.ZodOptional<z.ZodBoolean>;
      model: z.ZodOptional<z.ZodString>;
      fallbackModel: z.ZodOptional<z.ZodString>;
      thinking: z.ZodOptional<
        z.ZodUnion<readonly [z.ZodLiteral<'adaptive'>, z.ZodLiteral<'disabled'>, z.ZodNumber]>
      >;
      effort: z.ZodOptional<typeof effortLevelSchema>;
      maxTurns: z.ZodOptional<z.ZodNumber>;
      maxBudgetUsd: z.ZodOptional<z.ZodNumber>;
      agent: z.ZodOptional<z.ZodString>;
      allowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
      disallowedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
      tools: z.ZodOptional<z.ZodArray<z.ZodString>>;
      mcpConfig: z.ZodOptional<
        z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>
      >;
      settingSources: z.ZodOptional<z.ZodArray<z.ZodString>>;
      strictMcpConfig: z.ZodOptional<z.ZodBoolean>;
      permissionMode: z.ZodOptional<z.ZodString>;
      proactive: z.ZodOptional<z.ZodBoolean>;
      assistant: z.ZodOptional<z.ZodBoolean>;
      jsonSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      betas: z.ZodOptional<z.ZodArray<z.ZodString>>;
      debug: z.ZodOptional<z.ZodBoolean>;
      debugFile: z.ZodOptional<z.ZodString>;
      debugToStderr: z.ZodOptional<z.ZodBoolean>;
      addDirs: z.ZodOptional<z.ZodArray<z.ZodString>>;
      pluginDirs: z.ZodOptional<z.ZodArray<z.ZodString>>;
    },
    z.core.$strip
  >
> = z
  .object({
    resumeSessionId: z.string().optional(),
    continueSession: z.boolean().optional(),
    forkSession: z.boolean().optional(),
    sessionId: z.string().optional(),
    resumeSessionAt: z.string().optional(),
    noSessionPersistence: z.boolean().optional(),
    model: z.string().optional(),
    fallbackModel: z.string().optional(),
    thinking: z.union([z.literal('adaptive'), z.literal('disabled'), z.number()]).optional(),
    effort: effortLevelSchema.optional(),
    maxTurns: z.number().optional(),
    maxBudgetUsd: z.number().optional(),
    agent: z.string().optional(),
    allowedTools: z.array(z.string()).optional(),
    disallowedTools: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    mcpConfig: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    settingSources: z.array(z.string()).optional(),
    strictMcpConfig: z.boolean().optional(),
    permissionMode: z.string().optional(),
    proactive: z.boolean().optional(),
    assistant: z.boolean().optional(),
    jsonSchema: z.record(z.string(), z.unknown()).optional(),
    betas: z.array(z.string()).optional(),
    debug: z.boolean().optional(),
    debugFile: z.string().optional(),
    debugToStderr: z.boolean().optional(),
    addDirs: z.array(z.string()).optional(),
    pluginDirs: z.array(z.string()).optional(),
  })
  .optional();

export const sessionLaunchPayloadSchema = z.object({
  channelId: z.string().optional(),
  initialPrompt: z.string().optional(),
  model: z.string().optional(),
  permissionMode: z.string().optional(),
  thinkingLevel: z.string().optional(),
  cwd: z.string().optional(),
  branch: z.string().optional(),
  initOptions: initializeOptionsSchema.optional(),
  launchOptions: launchOptionsSchema,
});
export type SessionLaunchPayload = z.infer<typeof sessionLaunchPayloadSchema>;

export const sessionJoinPayloadSchema: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> =
  z.object({
    channelId: z.string(),
  });
export type SessionJoinPayload = z.infer<typeof sessionJoinPayloadSchema>;

export const sessionClosePayloadSchema: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> =
  z.object({
    channelId: z.string(),
  });
export type SessionClosePayload = z.infer<typeof sessionClosePayloadSchema>;

export const sessionListPayloadSchema: z.ZodObject<
  {
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    cwd: z.ZodOptional<z.ZodString>;
    hasParentId: z.ZodOptional<z.ZodBoolean>;
    excludeLive: z.ZodOptional<z.ZodBoolean>;
  },
  z.core.$strip
> = z.object({
  limit: z.number().min(1).max(SESSION_LIST_LIMIT).optional(),
  offset: z.number().min(0).optional(),
  cwd: z.string().optional(),
  hasParentId: z.boolean().optional(),
  /** When true, omit sessions whose sessionId currently has an alive Channel. */
  excludeLive: z.boolean().optional(),
});
export type SessionListPayload = z.infer<typeof sessionListPayloadSchema>;

export const sessionResumePayloadSchema: z.ZodObject<{ sessionId: z.ZodString }, z.core.$strip> =
  z.object({
    sessionId: z.string(),
  });
export type SessionResumePayload = z.infer<typeof sessionResumePayloadSchema>;

export const sessionResumeResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      { ok: z.ZodLiteral<true>; data: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(z.object({ channelId: z.string() }));
export type SessionResumeResponse = z.infer<typeof sessionResumeResponseSchema>;

export const sessionListRemotePayloadSchema: z.ZodObject<
  { limit: z.ZodOptional<z.ZodNumber>; offset: z.ZodOptional<z.ZodNumber> },
  z.core.$strip
> = z.object({
  limit: z.number().min(1).max(SESSION_LIST_LIMIT).optional(),
  offset: z.number().min(0).optional(),
});
export type SessionListRemotePayload = z.infer<typeof sessionListRemotePayloadSchema>;

export const sessionGetPayloadSchema: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> =
  z.object({
    channelId: z.string(),
  });
export type SessionGetPayload = z.infer<typeof sessionGetPayloadSchema>;

export const sessionRenamePayloadSchema: z.ZodObject<
  { channelId: z.ZodString; title: z.ZodString },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  title: z.string().min(1).max(200),
});
export type SessionRenamePayload = z.infer<typeof sessionRenamePayloadSchema>;

export const sessionDeletePayloadSchema: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> =
  z.object({
    channelId: z.string(),
  });
export type SessionDeletePayload = z.infer<typeof sessionDeletePayloadSchema>;

export const sessionForkPayloadSchema: z.ZodObject<
  {
    forkedFromChannelId: z.ZodString;
    resumeSessionAt: z.ZodOptional<z.ZodString>;
    newChannelId: z.ZodString;
  },
  z.core.$strip
> = z.object({
  forkedFromChannelId: z.string(),
  resumeSessionAt: z.string().optional(),
  newChannelId: z.string(),
});
export type SessionForkPayload = z.infer<typeof sessionForkPayloadSchema>;

export const sessionTeleportPayloadSchema: z.ZodObject<
  { remoteChannelId: z.ZodString; branch: z.ZodOptional<z.ZodString>; newChannelId: z.ZodString },
  z.core.$strip
> = z.object({
  remoteChannelId: z.string(),
  branch: z.string().optional(),
  newChannelId: z.string(),
});
export type SessionTeleportPayload = z.infer<typeof sessionTeleportPayloadSchema>;

export const sessionUpdateStatePayloadSchema: z.ZodObject<
  {
    channelId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodEnum<{ busy: 'busy'; idle: 'idle' }>>;
  },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  title: z.string().optional(),
  state: z.enum(['busy', 'idle']).optional(),
});
export type SessionUpdateStatePayload = z.infer<typeof sessionUpdateStatePayloadSchema>;

export const sessionBroadcastStateSchema: z.ZodEnum<{
  disconnected: 'disconnected';
  busy: 'busy';
  idle: 'idle';
  launching: 'launching';
  exited: 'exited';
}> = z.enum(['launching', 'busy', 'idle', 'exited', 'disconnected']);
export type SessionBroadcastState = z.infer<typeof sessionBroadcastStateSchema>;

export const sessionStateSummarySchema: z.ZodObject<
  {
    channelId: z.ZodString;
    state: typeof sessionBroadcastStateSchema;
    title: z.ZodOptional<z.ZodString>;
    effort: z.ZodOptional<typeof effortLevelSchema>;
    cwd: z.ZodOptional<z.ZodString>;
    projectRoot: z.ZodString;
    branch: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  state: sessionBroadcastStateSchema,
  title: z.string().optional(),
  effort: effortLevelSchema.optional(),
  cwd: z.string().optional(),
  projectRoot: z.string(),
  branch: z.string().optional(),
});
export type SessionStateSummary = z.infer<typeof sessionStateSummarySchema>;

// ── Response schemas ──

export const sessionLaunchResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<
          {
            channelId: z.ZodString;
            slashCommands: z.ZodOptional<z.ZodArray<z.ZodString>>;
            models: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
            account: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    channelId: z.string(),
    slashCommands: z.array(z.string()).optional(),
    models: z.array(z.unknown()).optional(),
    account: z.record(z.string(), z.unknown()).optional(),
  }),
);
export type SessionLaunchResponse = z.infer<typeof sessionLaunchResponseSchema>;

export const sessionJoinResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<
          {
            channelId: z.ZodString;
            state: z.ZodString;
            meta: typeof channelMetaCacheSchema;
            cwd: z.ZodString;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    channelId: z.string(),
    state: z.string(),
    meta: channelMetaCacheSchema,
    cwd: z.string(),
  }),
);
export type SessionJoinResponse = z.infer<typeof sessionJoinResponseSchema>;

export const getSessionResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<
          {
            session: typeof sessionSummarySchema;
            events: z.ZodArray<typeof clientMessageSchema>;
            meta: typeof channelMetaCacheSchema;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    session: sessionSummarySchema,
    events: z.array(clientMessageSchema),
    meta: channelMetaCacheSchema,
  }),
);
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>;

export const teleportSessionResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<
          {
            channelId: z.ZodString;
            events: z.ZodArray<typeof clientMessageSchema>;
            branchCheckoutFailed: z.ZodOptional<z.ZodBoolean>;
            branch: z.ZodOptional<z.ZodString>;
          },
          z.core.$strip
        >;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    channelId: z.string(),
    events: z.array(clientMessageSchema),
    branchCheckoutFailed: z.boolean().optional(),
    branch: z.string().optional(),
  }),
);
export type TeleportSessionResponse = z.infer<typeof teleportSessionResponseSchema>;

export const forkConversationResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<{ channelId: z.ZodString; parentChannelId: z.ZodString }, z.core.$strip>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(
  z.object({
    channelId: z.string(),
    parentChannelId: z.string(),
  }),
);
export type ForkConversationResponse = z.infer<typeof forkConversationResponseSchema>;

export const initResponseSchema: z.ZodObject<
  {
    settings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    sessions: z.ZodArray<typeof sessionStateSummarySchema>;
    activeChannelId: z.ZodOptional<z.ZodString>;
    models: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    capabilities: z.ZodOptional<z.ZodObject<{ worktree: z.ZodBoolean }, z.core.$strip>>;
  },
  z.core.$loose
> = z.looseObject({
  settings: z.record(z.string(), z.unknown()),
  sessions: z.array(sessionStateSummarySchema),
  activeChannelId: z.string().optional(),
  models: z.array(z.unknown()).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
  capabilities: z.object({ worktree: z.boolean() }).optional(),
});
export type InitResponse = z.infer<typeof initResponseSchema>;

export const rawEventsResponseSchema: z.ZodObject<
  { events: z.ZodArray<z.ZodUnknown> },
  z.core.$loose
> = z.looseObject({
  events: z.array(z.unknown()),
});
export type RawEventsResponse = z.infer<typeof rawEventsResponseSchema>;

// ── S2C payloads ──

export const sessionCreatedPayloadSchema: z.ZodObject<
  { channelId: z.ZodString; cwd: z.ZodString; projectRoot: z.ZodString },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  cwd: z.string(),
  projectRoot: z.string(),
});
export type SessionCreatedPayload = z.infer<typeof sessionCreatedPayloadSchema>;

export const sessionClosedPayloadSchema: z.ZodObject<
  { channelId: z.ZodString; error: z.ZodOptional<z.ZodString> },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  error: z.string().optional(),
});
export type SessionClosedPayload = z.infer<typeof sessionClosedPayloadSchema>;

export const sessionDeadPayloadSchema: z.ZodObject<{ channelId: z.ZodString }, z.core.$strip> =
  z.object({
    channelId: z.string(),
  });
export type SessionDeadPayload = z.infer<typeof sessionDeadPayloadSchema>;

export const sessionStatesPayloadSchema: z.ZodObject<
  {
    sessions: z.ZodArray<typeof sessionStateSummarySchema>;
    activeChannelId: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
> = z.object({
  sessions: z.array(sessionStateSummarySchema),
  activeChannelId: z.string().optional(),
});
export type SessionStatesPayload = z.infer<typeof sessionStatesPayloadSchema>;

export const sessionInitPayloadSchema: z.ZodObject<
  {
    channelId: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    permissionMode: z.ZodOptional<z.ZodString>;
    fastModeState: z.ZodOptional<z.ZodUnknown>;
    slashCommands: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mcpServers: z.ZodOptional<
      z.ZodArray<z.ZodObject<{ name: z.ZodString; status: z.ZodString }, z.core.$strip>>
    >;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
  },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  permissionMode: z.string().optional(),
  fastModeState: z.unknown().optional(),
  slashCommands: z.array(z.string()).optional(),
  mcpServers: z.array(z.object({ name: z.string(), status: z.string() })).optional(),
  config: z.record(z.string(), z.unknown()),
});
export type SessionInitPayload = z.infer<typeof sessionInitPayloadSchema>;

export const sessionStatusPayloadSchema: z.ZodObject<
  { channelId: z.ZodString; status: z.ZodString; permissionMode: z.ZodOptional<z.ZodString> },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  status: z.string(),
  permissionMode: z.string().optional(),
});
export type SessionStatusPayload = z.infer<typeof sessionStatusPayloadSchema>;

/** channel:exit payload */
export const channelExitPayloadSchema: z.ZodObject<
  { code: z.ZodNullable<z.ZodNumber> },
  z.core.$loose
> = z.looseObject({
  code: z.number().nullable(),
});
export type ChannelExitPayload = z.infer<typeof channelExitPayloadSchema>;

export const closeChannelPayloadSchema: z.ZodObject<
  { channelId: z.ZodString; error: z.ZodOptional<z.ZodString> },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  error: z.string().optional(),
});
export type CloseChannelPayload = z.infer<typeof closeChannelPayloadSchema>;

export const cancelRequestEventPayloadSchema: z.ZodObject<
  { channelId: z.ZodString; targetRequestId: z.ZodString },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  targetRequestId: z.string(),
});
export type CancelRequestEventPayload = z.infer<typeof cancelRequestEventPayloadSchema>;

// ── Session title ──

export const sessionGenerateTitlePayloadSchema: z.ZodObject<
  { channelId: z.ZodString; description: z.ZodString; persist: z.ZodBoolean },
  z.core.$strip
> = z.object({
  channelId: z.string(),
  description: z.string(),
  persist: z.boolean(),
});
export type SessionGenerateTitlePayload = z.infer<typeof sessionGenerateTitlePayloadSchema>;

export const generateSessionTitleResponseSchema: z.ZodObject<
  { success: z.ZodBoolean; result: z.ZodOptional<z.ZodUnknown>; error: z.ZodOptional<z.ZodString> },
  z.core.$loose
> = z.looseObject({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
export type GenerateSessionTitleResponse = z.infer<typeof generateSessionTitleResponseSchema>;

// ── Rewind ──

export const fileDiffSchema: z.ZodObject<
  { oldContent: z.ZodNullable<z.ZodString>; newContent: z.ZodNullable<z.ZodString> },
  z.core.$strip
> = z.object({
  oldContent: z.string().nullable(),
  newContent: z.string().nullable(),
});
export type FileDiff = z.infer<typeof fileDiffSchema>;

// ── Internal stdout events (server) ──

export const errorMessageEventSchema: z.ZodObject<{ message: z.ZodString }, z.core.$loose> =
  z.looseObject({ message: z.string() });
export type ErrorMessageEvent = z.infer<typeof errorMessageEventSchema>;

export const sessionInitEventSchema: z.ZodObject<
  {
    sessionId: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    model: z.ZodOptional<z.ZodString>;
    permissionMode: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    fastModeState: z.ZodOptional<z.ZodUnknown>;
    mcpServers: z.ZodOptional<
      z.ZodArray<z.ZodObject<{ name: z.ZodString; status: z.ZodString }, z.core.$loose>>
    >;
    slashCommands: z.ZodOptional<z.ZodArray<z.ZodString>>;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
  },
  z.core.$loose
> = z.looseObject({
  sessionId: z.string().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  model: z.string().optional(),
  permissionMode: z.string().optional(),
  tools: z.array(z.string()).optional(),
  fastModeState: z.unknown().optional(),
  mcpServers: z.array(z.looseObject({ name: z.string(), status: z.string() })).optional(),
  slashCommands: z.array(z.string()).optional(),
  /** Runner-augmented: the resolved CLI args passed to child_process.spawn. */
  args: z.array(z.string()).optional(),
});
export type SessionInitEvent = z.infer<typeof sessionInitEventSchema>;

export const sessionStatusEventSchema: z.ZodObject<
  { permissionMode: z.ZodOptional<z.ZodString> },
  z.core.$loose
> = z.looseObject({
  permissionMode: z.string().optional(),
});
export type SessionStatusEvent = z.infer<typeof sessionStatusEventSchema>;

export const controlRequestEventSchema: z.ZodObject<{ requestId: z.ZodString }, z.core.$loose> =
  z.looseObject({ requestId: z.string() });
export type ControlRequestEvent = z.infer<typeof controlRequestEventSchema>;

export const sessionConfigSchema: z.ZodObject<
  {
    model: z.ZodOptional<z.ZodString>;
    permissionMode: z.ZodOptional<z.ZodString>;
    effort: z.ZodOptional<typeof effortLevelSchema>;
    thinkingLevel: z.ZodOptional<z.ZodString>;
    tools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mcpServers: z.ZodOptional<
      z.ZodArray<z.ZodObject<{ name: z.ZodString; status: z.ZodString }, z.core.$strip>>
    >;
  },
  z.core.$strip
> = z.object({
  model: z.string().optional(),
  permissionMode: z.string().optional(),
  effort: effortLevelSchema.optional(),
  thinkingLevel: z.string().optional(),
  tools: z.array(z.string()).optional(),
  mcpServers: z.array(z.object({ name: z.string(), status: z.string() })).optional(),
});
export type SessionConfig = z.infer<typeof sessionConfigSchema>;

/** Extract config fields from session:init. cwd extracted separately to channel.cwd. */
export const sessionInitConfigSchema: z.ZodObject<
  {
    model: z.ZodOptional<z.ZodString>;
    permissionMode: z.ZodOptional<z.ZodString>;
    effort: z.ZodOptional<typeof effortLevelSchema>;
    cwd: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
> = sessionConfigSchema
  .pick({
    model: true,
    permissionMode: true,
    effort: true,
  })
  .extend({ cwd: z.string().optional() });
export type SessionInitConfig = z.infer<typeof sessionInitConfigSchema>;

// ── Init response result (server connect handler) ──

export const initResponseResultSchema: z.ZodObject<
  {
    slashCommands: z.ZodOptional<z.ZodArray<z.ZodString>>;
    models: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    account: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  z.core.$strip
> = z.object({
  slashCommands: z.array(z.string()).optional(),
  models: z.array(z.unknown()).optional(),
  account: z.record(z.string(), z.unknown()).optional(),
});
export type InitResponseResult = z.infer<typeof initResponseResultSchema>;

export const rewindResultSchema: z.ZodObject<
  {
    canRewind: z.ZodBoolean;
    filesChanged: z.ZodOptional<z.ZodArray<z.ZodString>>;
    fileDiffs: z.ZodOptional<z.ZodRecord<z.ZodString, typeof fileDiffSchema>>;
    insertions: z.ZodOptional<z.ZodNumber>;
    deletions: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
> = z.object({
  canRewind: z.boolean(),
  filesChanged: z.array(z.string()).optional(),
  fileDiffs: z.record(z.string(), fileDiffSchema).optional(),
  insertions: z.number().optional(),
  deletions: z.number().optional(),
  error: z.string().optional(),
});
export type RewindResult = z.infer<typeof rewindResultSchema>;
