import type {
  ChatStats,
  ControlDiffReviewPayload,
  ControlElicitationPayload,
  PlanCommentData,
} from '@code-quest/schemas';
import type { Task } from './task.ts';
import type { Message, SessionStatus } from './ui.ts';

interface TerminalSession {
  id: string;
  title: string;
  outputLines: string[];
}

export type PendingElicitation = Omit<ControlElicitationPayload, 'channelId'>;

export type PendingDiffReview = Omit<ControlDiffReviewPayload, 'channelId'>;

export interface ChannelState {
  channelId: string;
  messages: Message[];
  historyMessages: string[];
  status: SessionStatus;
  stats: ChatStats | null;
  statusText: string | null;
  isContextCompressed: boolean;
  modifiedFiles: Record<string, { oldContent?: string | null; newContent?: string | null }>;
  planComments: PlanCommentData[];
  terminalSessions: Record<string, TerminalSession>;
  isTextStreaming: boolean;
  isThinkingStreaming: boolean;
  wasStreamedViaDelta: boolean;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  streamingToolUseId?: string;
  tasks: Map<string, Task>;
  results: Map<string, ToolResult>;
}

export interface ToolResult {
  content?: string;
  is_error?: boolean;
}

export function initialChannelState(channelId: string): ChannelState {
  return {
    channelId,
    messages: [],
    historyMessages: [],
    status: 'idle',
    stats: null,
    statusText: null,
    isContextCompressed: false,
    modifiedFiles: {},
    planComments: [],
    terminalSessions: {},
    isTextStreaming: false,
    isThinkingStreaming: false,
    wasStreamedViaDelta: false,
    tasks: new Map(),
    results: new Map(),
  };
}

export interface FileSnapshot {
  messageId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
}

export type InitOptions = {
  systemPrompt?: string;
  appendSystemPrompt?: string;
} & Record<string, unknown>;

export type ChannelChangeUpdate = {
  title?: string;
  status?: SessionStatus;
  /** channel 的 permission mode（pane 殼邊框換色用——handoff §2） */
  permissionMode?: string;
};
