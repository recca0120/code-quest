import { type core, z } from 'zod';

// ── Reusable shape aliases ──

type Opt<T extends z.ZodType> = z.ZodOptional<T>;
type Str = z.ZodString;
type Num = z.ZodNumber;
type Bool = z.ZodBoolean;
type Unk = z.ZodUnknown;
type Loose<S extends core.$ZodLooseShape> = z.ZodObject<S, core.$loose>;

// ── System subtypes ──

export const systemInitSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'init'>;
  session_id: Str;
  cwd: Opt<Str>;
  model: Opt<Str>;
  tools: Opt<z.ZodArray<Str>>;
  mcp_servers: Opt<z.ZodArray<Loose<{ name: Str; status: Str }>>>;
  permissionMode: Opt<Str>;
  slash_commands: Opt<z.ZodArray<Str>>;
  fast_mode_state: Opt<Str>;
  current_repo: Opt<Loose<{ branch: Str; is_clean: Bool }>>;
  apiKeySource: Opt<Str>;
  claude_code_version: Opt<Str>;
  output_style: Opt<Str>;
  agents: Opt<z.ZodArray<Str>>;
  skills: Opt<z.ZodArray<Str>>;
  plugins: Opt<z.ZodArray<Unk>>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('init'),
  session_id: z.string(),
  cwd: z.string().optional(),
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  mcp_servers: z.array(z.looseObject({ name: z.string(), status: z.string() })).optional(),
  permissionMode: z.string().optional(),
  slash_commands: z.array(z.string()).optional(),
  fast_mode_state: z.string().optional(),
  current_repo: z.looseObject({ branch: z.string(), is_clean: z.boolean() }).optional(),
  apiKeySource: z.string().optional(),
  claude_code_version: z.string().optional(),
  output_style: z.string().optional(),
  agents: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  plugins: z.array(z.unknown()).optional(),
  uuid: z.string().optional(),
});

export const systemStatusSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'status'>;
  status: z.ZodNullable<Str>;
  permissionMode: Opt<Str>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('status'),
  status: z.string().nullable(),
  permissionMode: z.string().optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemHookStartedSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'hook_started'>;
  hook_id: Str;
  hook_name: Str;
  hook_event: Str;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('hook_started'),
  hook_id: z.string(),
  hook_name: z.string(),
  hook_event: z.string(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemHookResponseSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'hook_response'>;
  hook_id: Str;
  hook_name: Str;
  hook_event: Str;
  hook_event_name: Opt<Str>;
  output: Opt<Str>;
  stdout: Opt<Str>;
  stderr: Opt<Str>;
  exit_code: Opt<Num>;
  outcome: Opt<Str>;
  additional_context: Opt<Unk>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('hook_response'),
  hook_id: z.string(),
  hook_name: z.string(),
  hook_event: z.string(),
  hook_event_name: z.string().optional(),
  output: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exit_code: z.number().optional(),
  outcome: z.string().optional(),
  additional_context: z.unknown().optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemCompactBoundarySchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'compact_boundary'>;
  compactMetadata: Opt<Loose<{ preservedSegment: Opt<Bool> }>>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('compact_boundary'),
  compactMetadata: z.looseObject({ preservedSegment: z.boolean().optional() }).optional(),
});

const systemPostTurnSummarySchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'post_turn_summary'>;
  summary: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('post_turn_summary'),
  summary: z.string().optional(),
});

const systemSessionStateChangedSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'session_state_changed'>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('session_state_changed'),
});

export const systemApiRetrySchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'api_retry'>;
  attempt: Num;
  max_retries: Num;
  retry_delay_ms: Opt<Num>;
  error_status: Opt<Num>;
  error: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('api_retry'),
  attempt: z.number(),
  max_retries: z.number(),
  retry_delay_ms: z.number().optional(),
  error_status: z.number().optional(),
  error: z.string().optional(),
});

export const systemTaskStartedSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'task_started'>;
  task_id: Opt<Str>;
  tool_use_id: Opt<Str>;
  description: Opt<Str>;
  task_type: Opt<
    z.ZodEnum<{ local_agent: 'local_agent'; local_bash: 'local_bash'; subagent: 'subagent' }>
  >;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('task_started'),
  task_id: z.string().optional(),
  tool_use_id: z.string().optional(),
  description: z.string().optional(),
  task_type: z.enum(['local_agent', 'local_bash', 'subagent']).optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemTaskNotificationSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'task_notification'>;
  task_id: Str;
  tool_use_id: Opt<Str>;
  status: Opt<Str>;
  output_file: Opt<Str>;
  summary: Opt<Str>;
  usage: Opt<z.ZodRecord<Str, Unk>>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('task_notification'),
  task_id: z.string(),
  tool_use_id: z.string().optional(),
  status: z.string().optional(),
  output_file: z.string().optional(),
  summary: z.string().optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemTaskProgressSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'task_progress'>;
  task_id: Str;
  tool_use_id: Opt<Str>;
  description: Opt<Str>;
  usage: Opt<z.ZodRecord<Str, Unk>>;
  last_tool_name: Opt<Str>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('task_progress'),
  task_id: z.string(),
  tool_use_id: z.string().optional(),
  description: z.string().optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  last_tool_name: z.string().optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

export const systemBridgeStateSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'bridge_state'>;
  state: z.ZodEnum<{ ready: 'ready'; disconnected: 'disconnected'; error: 'error' }>;
  detail: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('bridge_state'),
  state: z.enum(['ready', 'disconnected', 'error']),
  detail: z.string().optional(),
});

export const systemMirrorErrorSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: z.ZodLiteral<'mirror_error'>;
  error: Str;
  key: Opt<Unk>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.literal('mirror_error'),
  error: z.string(),
  key: z.unknown().optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

// Fallback for unknown system subtypes
const systemFallbackSchema: Loose<{
  type: z.ZodLiteral<'system'>;
  subtype: Str;
}> = z.looseObject({
  type: z.literal('system'),
  subtype: z.string(),
});

// ── Assistant ──

// Shared usage shape — Claude API guarantees these are numbers when present.
type ApiUsageShape = {
  input_tokens: Opt<Num>;
  output_tokens: Opt<Num>;
  cache_read_input_tokens: Opt<Num>;
  cache_creation_input_tokens: Opt<Num>;
};

const apiUsageSchema: Opt<Loose<ApiUsageShape>> = z
  .looseObject({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    cache_creation_input_tokens: z.number().optional(),
  })
  .optional();

export const assistantSchema: Loose<{
  type: z.ZodLiteral<'assistant'>;
  message: Loose<{
    model: Opt<Str>;
    id: Opt<Str>;
    role: Opt<Str>;
    content: Opt<z.ZodArray<z.ZodRecord<Str, Unk>>>;
    stop_reason: Opt<z.ZodNullable<Str>>;
    usage: Opt<Loose<ApiUsageShape>>;
  }>;
  parent_tool_use_id: Opt<z.ZodNullable<Str>>;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('assistant'),
  message: z.looseObject({
    model: z.string().optional(),
    id: z.string().optional(),
    role: z.string().optional(),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
    stop_reason: z.string().nullable().optional(),
    usage: apiUsageSchema,
  }),
  parent_tool_use_id: z.string().nullable().optional(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── User ──

export const userSchema: Loose<{
  type: z.ZodLiteral<'user'>;
  message: Loose<{
    role: Opt<Str>;
    content: Opt<z.ZodUnion<readonly [z.ZodArray<z.ZodRecord<Str, Unk>>, Str]>>;
  }>;
  parent_tool_use_id: Opt<z.ZodNullable<Str>>;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
  tool_use_result: Opt<z.ZodUnion<readonly [Str, z.ZodRecord<Str, Unk>]>>;
  isSynthetic: Opt<Bool>;
}> = z.looseObject({
  type: z.literal('user'),
  message: z.looseObject({
    role: z.string().optional(),
    // content can be an array (normal messages) or a string (slash command stdout echo)
    content: z.union([z.array(z.record(z.string(), z.unknown())), z.string()]).optional(),
  }),
  parent_tool_use_id: z.string().nullable().optional(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
  tool_use_result: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  isSynthetic: z.boolean().optional(),
});

// ── Result ──

export const resultSchema: Loose<{
  type: z.ZodLiteral<'result'>;
  subtype: Str;
  is_error: Opt<Bool>;
  duration_ms: Opt<Num>;
  duration_api_ms: Opt<Num>;
  num_turns: Opt<Num>;
  result: Opt<Str>;
  stop_reason: Opt<z.ZodNullable<Str>>;
  session_id: Opt<Str>;
  total_cost_usd: Opt<Num>;
  usage: Opt<Loose<ApiUsageShape>>;
  modelUsage: Opt<z.ZodRecord<Str, Unk>>;
  errors: Opt<z.ZodArray<Str>>;
  uuid: Opt<Str>;
  fast_mode_state: Opt<Str>;
  permission_denials: Opt<z.ZodArray<Unk>>;
  terminal_reason: Opt<Str>;
}> = z.looseObject({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean().optional(),
  duration_ms: z.number().optional(),
  duration_api_ms: z.number().optional(),
  num_turns: z.number().optional(),
  result: z.string().optional(),
  stop_reason: z.string().nullable().optional(),
  session_id: z.string().optional(),
  total_cost_usd: z.number().optional(),
  usage: apiUsageSchema,
  modelUsage: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.string()).optional(),
  uuid: z.string().optional(),
  fast_mode_state: z.string().optional(),
  permission_denials: z.array(z.unknown()).optional(),
  terminal_reason: z.string().optional(),
});

// ── Control request ──

export const controlRequestSchema: Loose<{
  type: z.ZodLiteral<'control_request'>;
  request_id: Str;
  request: Loose<{
    subtype: Str;
    tool_name: Opt<Str>;
    input: Opt<Unk>;
    permission_suggestions: Opt<z.ZodArray<z.ZodRecord<Str, Unk>>>;
    decision_reason: Opt<Str>;
    tool_use_id: Opt<Str>;
    callback_id: Opt<Str>;
    blocked_path: Opt<z.ZodNullable<Str>>;
    agent_id: Opt<Str>;
    elicitation_id: Opt<Str>;
    mcp_server_name: Opt<Str>;
  }>;
}> = z.looseObject({
  type: z.literal('control_request'),
  request_id: z.string(),
  request: z.looseObject({
    subtype: z.string(),
    tool_name: z.string().optional(),
    input: z.unknown().optional(),
    permission_suggestions: z.array(z.record(z.string(), z.unknown())).optional(),
    decision_reason: z.string().optional(),
    tool_use_id: z.string().optional(),
    callback_id: z.string().optional(),
    blocked_path: z.string().nullable().optional(),
    agent_id: z.string().optional(),
    elicitation_id: z.string().optional(),
    mcp_server_name: z.string().optional(),
  }),
});

// ── Control response ──

const controlResponseSchema: Loose<{
  type: z.ZodLiteral<'control_response'>;
  response: Loose<{
    subtype: Str;
    request_id: Str;
    response: Opt<z.ZodRecord<Str, Unk>>;
    error: Opt<Str>;
  }>;
}> = z.looseObject({
  type: z.literal('control_response'),
  response: z.looseObject({
    subtype: z.string(),
    request_id: z.string(),
    response: z.record(z.string(), z.unknown()).optional(),
    error: z.string().optional(),
  }),
});

// ── Control cancel request ──

const controlCancelRequestSchema: Loose<{
  type: z.ZodLiteral<'control_cancel_request'>;
  request_id: Str;
}> = z.looseObject({
  type: z.literal('control_cancel_request'),
  request_id: z.string(),
});

// ── Stream event ──

export const streamEventSchema: Loose<{
  type: z.ZodLiteral<'stream_event'>;
  event: Loose<{
    type: Str;
    index: Opt<Num>;
    delta: Opt<
      Loose<{
        type: Opt<Str>;
        text: Opt<Str>;
        thinking: Opt<Str>;
        partial_json: Opt<Str>;
        citation: Opt<Unk>;
        citations: Opt<z.ZodArray<Unk>>;
        signature: Opt<Str>;
      }>
    >;
    content_block: Opt<
      Loose<{
        type: Opt<Str>;
        id: Opt<Str>;
        name: Opt<Str>;
        input: Opt<z.ZodRecord<Str, Unk>>;
      }>
    >;
    message: Opt<z.ZodRecord<Str, Unk>>;
    usage: Opt<z.ZodRecord<Str, Unk>>;
  }>;
  session_id: Opt<Str>;
  parent_tool_use_id: Opt<z.ZodNullable<Str>>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('stream_event'),
  event: z.looseObject({
    type: z.string(),
    index: z.number().optional(),
    delta: z
      .looseObject({
        type: z.string().optional(),
        text: z.string().optional(),
        thinking: z.string().optional(),
        estimated_tokens: z.number().optional(),
        partial_json: z.string().optional(),
        citation: z.unknown().optional(),
        citations: z.array(z.unknown()).optional(),
        signature: z.string().optional(),
      })
      .optional(),
    content_block: z
      .looseObject({
        type: z.string().optional(),
        id: z.string().optional(),
        name: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    message: z.record(z.string(), z.unknown()).optional(),
    usage: z.record(z.string(), z.unknown()).optional(),
  }),
  session_id: z.string().optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  uuid: z.string().optional(),
});

// ── Rate limit event ──

export const rateLimitEventSchema: Loose<{
  type: z.ZodLiteral<'rate_limit_event'>;
  rate_limit_info: Loose<{
    status: Str;
    resetsAt: Opt<z.ZodUnion<readonly [Num, Str]>>;
    rateLimitType: Opt<Str>;
    utilization: Opt<z.ZodUnion<readonly [Num, z.ZodRecord<Str, Unk>]>>;
    overageStatus: Opt<Str>;
    isUsingOverage: Opt<Bool>;
  }>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('rate_limit_event'),
  rate_limit_info: z.looseObject({
    status: z.string(),
    resetsAt: z.union([z.number(), z.string()]).optional(),
    rateLimitType: z.string().optional(),
    utilization: z.union([z.number(), z.record(z.string(), z.unknown())]).optional(),
    overageStatus: z.string().optional(),
    isUsingOverage: z.boolean().optional(),
  }),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

// ── Streamlined (fast mode) ──

export const streamlinedTextSchema: Loose<{
  type: z.ZodLiteral<'streamlined_text'>;
  text: Str;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('streamlined_text'),
  text: z.string(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

export const streamlinedToolUseSummarySchema: Loose<{
  type: z.ZodLiteral<'streamlined_tool_use_summary'>;
  tool_summary: Str;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('streamlined_tool_use_summary'),
  tool_summary: z.string(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── Experiment gates ──

export const experimentGatesSchema: Loose<{
  type: z.ZodLiteral<'experiment_gates'>;
  gates: z.ZodRecord<Str, z.ZodUnion<readonly [Bool, Str]>>;
}> = z.looseObject({
  type: z.literal('experiment_gates'),
  gates: z.record(z.string(), z.union([z.boolean(), z.string()])),
});

// ── Available models ──

export const availableModelsSchema: Loose<{
  type: z.ZodLiteral<'available_models'>;
  models: z.ZodArray<Str>;
}> = z.looseObject({
  type: z.literal('available_models'),
  models: z.array(z.string()),
});

// ── Tool use (top-level) ──

const toolUseSchema: Loose<{
  type: z.ZodLiteral<'tool_use'>;
  id: Str;
  name: Str;
  input: z.ZodRecord<Str, Unk>;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── Notification ──

export const notificationSchema: Loose<{
  type: z.ZodLiteral<'notification'>;
  message: Str;
  timestamp: Opt<Num>;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('notification'),
  message: z.string(),
  timestamp: z.number().optional(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── New session notification ──

const newSessionNotificationSchema: Loose<{
  type: z.ZodLiteral<'new_session_notification'>;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('new_session_notification'),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── Error ──

export const errorSchema: Loose<{
  type: z.ZodLiteral<'error'>;
  error: Loose<{ type: Str; message: Str }>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('error'),
  error: z.looseObject({ type: z.string(), message: z.string() }),
  session_id: z.string().optional(),
});

// ── Auth URL ──

export const authUrlSchema: Loose<{
  type: z.ZodLiteral<'auth_url'>;
  url: Str;
  method: Str;
  session_id: Opt<Str>;
  uuid: Opt<Str>;
}> = z.looseObject({
  type: z.literal('auth_url'),
  url: z.string(),
  method: z.string(),
  session_id: z.string().optional(),
  uuid: z.string().optional(),
});

// ── Keep alive ──

const keepAliveSchema: Loose<{
  type: z.ZodLiteral<'keep_alive'>;
}> = z.looseObject({
  type: z.literal('keep_alive'),
});

// ── Auth status ──

export const authStatusSchema: Loose<{
  type: z.ZodLiteral<'auth_status'>;
  isAuthenticating: Bool;
  output: z.ZodArray<Unk>;
  account: Opt<z.ZodRecord<Str, Unk>>;
  uuid: Opt<Str>;
  session_id: Opt<Str>;
}> = z.looseObject({
  type: z.literal('auth_status'),
  isAuthenticating: z.boolean(),
  output: z.array(z.unknown()),
  account: z.record(z.string(), z.unknown()).optional(),
  uuid: z.string().optional(),
  session_id: z.string().optional(),
});

// ── Raw event (synthesized by runner for unknown/parse-error lines) ──

const rawEventSchema: Loose<{
  type: z.ZodLiteral<'raw_event'>;
  rawType: Str;
  data: z.ZodRecord<Str, Unk>;
}> = z.looseObject({
  type: z.literal('raw_event'),
  rawType: z.string(),
  data: z.record(z.string(), z.unknown()),
});

// ── Speech ──

export const speechToTextMessageSchema: Loose<{
  type: z.ZodLiteral<'speech_to_text_message'>;
  channelId: Str;
  text: Str;
  done: Bool;
}> = z.looseObject({
  type: z.literal('speech_to_text_message'),
  channelId: z.string(),
  text: z.string(),
  done: z.boolean(),
});

// ── Type registry: type string → schema ──

const systemSubtypeRegistry: Record<string, z.ZodType> = {
  init: systemInitSchema,
  status: systemStatusSchema,
  hook_started: systemHookStartedSchema,
  hook_response: systemHookResponseSchema,
  compact_boundary: systemCompactBoundarySchema,
  post_turn_summary: systemPostTurnSummarySchema,
  session_state_changed: systemSessionStateChangedSchema,
  api_retry: systemApiRetrySchema,
  task_started: systemTaskStartedSchema,
  task_notification: systemTaskNotificationSchema,
  task_progress: systemTaskProgressSchema,
  bridge_state: systemBridgeStateSchema,
  mirror_error: systemMirrorErrorSchema,
};

const typeRegistry: Record<string, z.ZodType> = {
  assistant: assistantSchema,
  user: userSchema,
  result: resultSchema,
  control_request: controlRequestSchema,
  control_response: controlResponseSchema,
  control_cancel_request: controlCancelRequestSchema,
  stream_event: streamEventSchema,
  rate_limit_event: rateLimitEventSchema,
  streamlined_text: streamlinedTextSchema,
  streamlined_tool_use_summary: streamlinedToolUseSummarySchema,
  experiment_gates: experimentGatesSchema,
  available_models: availableModelsSchema,
  tool_use: toolUseSchema,
  notification: notificationSchema,
  new_session_notification: newSessionNotificationSchema,
  error: errorSchema,
  auth_url: authUrlSchema,
  auth_status: authStatusSchema,
  keep_alive: keepAliveSchema,
  speech_to_text_message: speechToTextMessageSchema,
};

/**
 * Look up the Zod schema for a given CLI event type (and optional subtype for system events).
 * Returns undefined if the type is unknown.
 */
export function getSchemaForType(type: string, subtype?: string): z.ZodType | undefined {
  if (type === 'system') {
    return (subtype && systemSubtypeRegistry[subtype]) || systemFallbackSchema;
  }
  return typeRegistry[type];
}

/** Set of all known CLI event type strings. */
export const KNOWN_EVENT_TYPES: Set<string> = new Set(['system', ...Object.keys(typeRegistry)]);

/** Union type inferred from all CLI event Zod schemas.
 *
 * NOTE: Hand-maintained alongside `typeRegistry` / `systemSubtypeRegistry`.
 * `z.discriminatedUnion('type', [...])` doesn't fit because system events
 * all share `type: 'system'` and distinguish by `subtype` — zod requires
 * unique discriminant values. Flattening system into top-level types would
 * break the CLI wire contract. If a schema is added, it MUST be appended
 * below AND in the appropriate registry above. */
export type ProtocolMessage =
  | z.infer<typeof systemInitSchema>
  | z.infer<typeof systemStatusSchema>
  | z.infer<typeof systemHookStartedSchema>
  | z.infer<typeof systemHookResponseSchema>
  | z.infer<typeof systemCompactBoundarySchema>
  | z.infer<typeof systemTaskStartedSchema>
  | z.infer<typeof systemTaskNotificationSchema>
  | z.infer<typeof systemTaskProgressSchema>
  | z.infer<typeof systemBridgeStateSchema>
  | z.infer<typeof systemMirrorErrorSchema>
  | z.infer<typeof systemPostTurnSummarySchema>
  | z.infer<typeof systemSessionStateChangedSchema>
  | z.infer<typeof systemFallbackSchema>
  | z.infer<typeof assistantSchema>
  | z.infer<typeof userSchema>
  | z.infer<typeof resultSchema>
  | z.infer<typeof controlRequestSchema>
  | z.infer<typeof controlResponseSchema>
  | z.infer<typeof controlCancelRequestSchema>
  | z.infer<typeof streamEventSchema>
  | z.infer<typeof rateLimitEventSchema>
  | z.infer<typeof streamlinedTextSchema>
  | z.infer<typeof streamlinedToolUseSummarySchema>
  | z.infer<typeof experimentGatesSchema>
  | z.infer<typeof availableModelsSchema>
  | z.infer<typeof toolUseSchema>
  | z.infer<typeof notificationSchema>
  | z.infer<typeof newSessionNotificationSchema>
  | z.infer<typeof errorSchema>
  | z.infer<typeof authUrlSchema>
  | z.infer<typeof authStatusSchema>
  | z.infer<typeof keepAliveSchema>
  | z.infer<typeof rawEventSchema>
  | z.infer<typeof speechToTextMessageSchema>;
