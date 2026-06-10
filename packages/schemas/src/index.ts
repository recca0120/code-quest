// Content types

// Remote summoner ↔ server protocol (JSON-RPC 2.0 over WebSocket)
export { REMOTE_METHODS } from './adapter/remote/methods.ts';
export * from './adapter/remote/protocol.ts';
export * from './adapter/remote/protocol-schemas.ts';
// Transport interfaces (no implementation)
export type { AgentTransport } from './adapter/transport/agent-transport.ts';
export type { Transport, TransportHandle } from './adapter/transport/transport.ts';
export type { SocketCallback, TypedSocket } from './adapter/transport/types.ts';
// Errors
export { ERROR_CODES, type ErrorCode } from './errors.ts';
// Process provider interface (summoner ↔ server contract)
export type { ProcessHandle, ProcessProvider, ProcessRunResult } from './process-provider.ts';
// Zod schemas — server↔client contracts
export * from './socket/actions.ts';
export * from './socket/auth.ts';
export * from './socket/blocks.ts';
export * from './socket/common.ts';
export * from './socket/control.ts';
export * from './socket/control-response.ts';
export * from './socket/fs.ts';
export * from './socket/fs-dirty.ts';
export * from './socket/git.ts';
export * from './socket/hook.ts';
export * from './socket/layout.ts';
export * from './socket/mcp.ts';
export * from './socket/message.ts';
export * from './socket/message-meta.ts';
export * from './socket/message-payloads.ts';
export * from './socket/message-stats.ts';
export * from './socket/message-stream.ts';
export * from './socket/notification.ts';
export * from './socket/openspec.ts';
export * from './socket/permission-mode.ts';
export * from './socket/plan.ts';
export * from './socket/plugin.ts';
export * from './socket/projects.ts';
export * from './socket/provider.ts';
export * from './socket/question.ts';
export * from './socket/rpc.ts';
export * from './socket/session.ts';
export * from './socket/settings.ts';
// Socket event types
export type {
  ClientMessage,
  ClientToServerEvents,
  MessagePayloadMap,
  ServerToClientEvents,
} from './socket/socket-events.ts';
export { EVENTS } from './socket/socket-events.ts';
export * from './socket/system.ts';
export * from './socket/task.ts';
export * from './socket/terminal.ts';
export * from './socket/worktree.ts';
