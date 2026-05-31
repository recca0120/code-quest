// Fakes

export { FakeAgentTransport } from './fake-agent-transport.ts';
export { FakeClaude } from './fake-claude.ts';
export { FakeFileWatcher } from './fake-file-watcher.ts';
export type { FileTree } from './fake-filesystem.ts';
export { FakeFilesystem } from './fake-filesystem.ts';
export { FakeGit } from './fake-git.ts';
export type { ReceivedMessageMap } from './fake-process-provider.ts';
export { FakeProcessHandle, FakeProcessProvider } from './fake-process-provider.ts';
export type { FakeSocket } from './fake-socket.ts';
export { createFakeSocket } from './fake-socket.ts';
export type { ServerConnector } from './fake-summoner.ts';
export { createFakeSummoner, FakeSummoner } from './fake-summoner.ts';
// Fixture paths
export type { SegmentBuilders } from './segment-builders.ts';
export { createSegments } from './segment-builders.ts';
// Segment builders (Node.js)
export { resetSeq, segments } from './segments-node.ts';
