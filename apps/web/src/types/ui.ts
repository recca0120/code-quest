import type {
  ChatStats,
  ForkConversationResponse,
  MessageAttachment,
  MessageRole,
  RewindResult,
  RpcResult,
} from '@code-quest/schemas';

export type SessionStatus =
  | 'disconnected'
  | 'idle'
  | 'processing'
  | 'connecting'
  | 'busy'
  | 'cancelling';

export type RewindFn = (messageId: string) => Promise<RpcResult<RewindResult>>;

export type ForkFn = (messageId: string) => Promise<ForkConversationResponse>;

// ── UI-layer meta shapes (React prop types) ──

interface HookStartedMeta {
  hookEvent?: string;
  hookId?: string;
  hookName?: string;
}

interface HookResponseMeta {
  output?: string;
  hookEvent?: string;
  hookId?: string;
  hookName?: string;
}

interface HookDiagnosticsMeta {
  diagnostics?: string;
}

export interface ImageMeta {
  source?: { type?: string; media_type?: string; data?: string };
}

export interface DocumentMeta {
  title?: string;
  source?: { type?: string; media_type?: string; data?: string };
}

interface RateLimitMeta {
  rateLimitInfo?: Record<string, unknown>;
}

// ── Message type discriminated union ──

/** UI-layer message base — after adapter projection. id/timestamp are
 *  UI-assigned; attachments are UI concepts (file mentions). */
interface MessageBase {
  id: string;
  /** JSONL-canonical uuid assigned by CLI/server. Absent until CLI echoes the message. */
  cliUuid?: string;
  role: MessageRole;
  content: string;
  parentToolUseId?: string;
  timestamp: number;
  attachments?: MessageAttachment[];
}

type MessageType =
  | 'text'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'pending_action'
  | 'action_result'
  | 'task_started'
  | 'compact_boundary'
  | 'post_turn_summary'
  | 'streamlined_text'
  | 'streamlined_tool_use_summary'
  | 'rate_limit_event'
  | 'hook_started'
  | 'hook_response'
  | 'hook_diagnostics'
  | 'unknown_delta'
  | 'raw_event'
  | 'unhandled'
  | 'content_block_start'
  | 'file:updated'
  | 'image'
  | 'document'
  | 'meta'
  | 'interrupt'
  | 'redacted_thinking'
  | 'slash_command_result';

/** Maps message types to their top-level typed fields (migrating from meta) */
interface TopLevelMap {
  text: { renderAs?: 'markdown' | 'plain'; history?: boolean };
  tool_use: {
    toolId?: string;
    input?: Record<string, unknown>;
    model?: string;
    partialInput?: string;
    result?: { content?: string; is_error?: boolean };
    taskStatus?: string;
    taskType?: string;
  };
  tool_result: { toolId?: string; name?: string; is_error?: boolean; contentBlocks?: unknown[] };
  thinking: { budget_tokens?: number; durationMs?: number | null; isStreaming?: boolean };
  error: { detail?: string };
  hook_started: HookStartedMeta;
  hook_response: HookResponseMeta;
  hook_diagnostics: HookDiagnosticsMeta;
  image: ImageMeta;
  document: DocumentMeta;
  task_started: { taskType?: string };
  rate_limit_event: RateLimitMeta;
  content_block_start: { blockType?: string };
  result: { stats?: ChatStats };
  unknown_delta: { data?: unknown };
  raw_event: { data?: unknown };
  unhandled: { event?: unknown };
  pending_action: { requestId?: string; input?: unknown };
}

type TopLevel<T> = T extends keyof TopLevelMap ? TopLevelMap[T] : unknown;

/** Typed message variant — meta removed; all fields are top-level via TopLevelMap */
export type Message =
  | { [T in MessageType]: MessageBase & { type: T } & TopLevel<T> }[MessageType]
  | AssistantTurn;

// ── AssistantTurn (compound message) ──

type BlockType = 'thinking' | 'text' | 'tool_use';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  parentToolUseId?: string;
  toolId?: string;
  input?: Record<string, unknown>;
  model?: string;
  partialInput?: string;
  isStreaming?: boolean;
  estimatedTokens?: number;
  durationMs?: number | null;
  budget_tokens?: number;
  citations?: Array<{ url?: string; title?: string; citedText?: string }>;
}

export interface AssistantTurn {
  id: string;
  cliUuid?: string;
  role: 'assistant';
  type: 'assistant_turn';
  timestamp: number;
  model?: string;
  messageId?: string;
  blocks: Block[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  stopReason?: string;
  isStreaming?: boolean;
  content: string;
  parentToolUseId?: string;
  attachments?: MessageAttachment[];
}
