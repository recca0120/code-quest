import 'dotenv/config';
import { WsClient } from '@code-quest/transport';
import { formatBanner } from '@code-quest/utils';
import { Agent } from './agent/agent.ts';
import { BroadcasterHandler } from './agent/handlers/broadcaster-handler.ts';
import { FsHandler } from './agent/handlers/fs-handler.ts';
import { GitHandler } from './agent/handlers/git-handler.ts';
import { ProcessHandler } from './agent/handlers/process-handler.ts';
import { loadConfig } from './config.ts';
import { createContainer, TOKENS } from './container.ts';
import { logger } from './logger.ts';

const config = loadConfig({
  argv: process.argv.slice(2),
  env: process.env,
});

if (config.showHelp) {
  console.log(`
  Usage: summoner [options]

  Options:
    --server <url>    Server WebSocket URL (default: ws://127.0.0.1:3000/summoner)
    --token <token>   Authentication token (required)
    --roots <paths>   Comma-separated directories to share (default: $HOME)
    --help, -h        Show this help

  Environment variables:
    SUMMONER_SERVER   Same as --server
    SUMMONER_TOKEN    Same as --token
    EXPLORER_ROOTS    Same as --roots
`);
  process.exit(0);
}

if (!config.token) {
  logger.error('Token required. Use --token <token> or set SUMMONER_TOKEN env var.');
  process.exit(1);
}

logger.info(
  formatBanner('Code Quest Summoner', [
    { key: 'Server', value: config.server },
    { key: 'Token', value: '***' },
    { key: 'Roots', value: config.fsRoots.join(', ') },
  ]),
);

const container = createContainer(config);

const serverUrl = new URL(config.server);
serverUrl.searchParams.set('sessionKey', crypto.randomUUID());

const client = new WsClient(serverUrl.toString(), {
  headers: { Authorization: `Bearer ${config.token}` },
});

const agent = new Agent([
  new ProcessHandler(container.get(TOKENS.ProcessProvider)),
  new FsHandler(container.get(TOKENS.Filesystem)),
  new GitHandler(container.get(TOKENS.Git)),
  new BroadcasterHandler(container.get(TOKENS.Broadcaster)),
]);
agent.attach(client);

client.setLifecycleListener({
  onOpen: (id) => logger.info({ connectionId: id }, `[summoner] connected to ${config.server}`),
  onClose: () => logger.warn('[summoner] disconnected, reconnecting...'),
});

client.connect();

process.on('uncaughtException', (err) => {
  const counts: Record<string, number> = {};
  for (const h of (process as unknown as { _getActiveHandles(): object[] })._getActiveHandles()) {
    const type = (h as object).constructor?.name ?? 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  logger.error({ err, openHandles: counts }, '[summoner] uncaught exception — continuing');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '[summoner] unhandled rejection — continuing');
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    agent.dispose();
    client.disconnect();
    process.exit(0);
  });
}
