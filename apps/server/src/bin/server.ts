import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import type { TransportHandle } from '@code-quest/schemas';
import { ChildProcessProvider } from '@code-quest/summoner';
import {
  auth,
  bearerAuth,
  heartbeat,
  NullAuthenticator,
  RpcChannel,
  type RpcChannelSocket,
  resumable,
  WsTransport,
  wsAdapter,
} from '@code-quest/transport';
import { type BannerItem, errMsg, formatBanner } from '@code-quest/utils';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config, resolveSqlitePath } from '../config.ts';
import { createContainer, type StoreConfig } from '../container.ts';
import { createDatabaseFromUrl } from '../db/create-database.ts';
import { buildChannelsSnapshot } from '../http/debug-channels.ts';
import { logger } from '../logger.ts';
import { ReconnectableRpc } from '../remote/reconnectable-rpc.ts';
import type { ChannelEmitter } from '../socket/channel-emitter.ts';
import type { ChannelManager } from '../socket/channel-manager.ts';
import type { SocketServer } from '../socket/server.ts';
import { TokenAuthenticator } from '../socket/token-authenticator.ts';
import { TYPES } from '../types.ts';

const WS_PATH = '/ws';
const SUMMONER_PATH = '/summoner';
const SHUTDOWN_TIMEOUT_MS = 10_000;

const databases = config.database.map(createDatabaseFromUrl);
const storeConfig: StoreConfig = { databases };

const sqliteEntries = databases.filter((e) => e.type === 'sqlite');
if (sqliteEntries.length > 0) {
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
  const bundledMigrations = join(import.meta.dirname, '../migrations/sqlite');
  const migrationsFolder = existsSync(bundledMigrations)
    ? bundledMigrations
    : (await import('@code-quest/db-schema')).sqliteMigrationsFolder;
  for (const entry of sqliteEntries) {
    migrate(entry.db, { migrationsFolder });
    logger.info({ path: resolveSqlitePath(entry.url) }, 'SQLite migrated');
  }
}

if (config.rawEvents.readDeltas && !config.rawEvents.writeDeltas) {
  logger.warn(
    'RAW_EVENTS_READ_DELTAS=true but RAW_EVENTS_WRITE_DELTAS=false — ' +
      'no deltas will ever be persisted, so UNION reads an empty table. ' +
      'Did you mean to set both?',
  );
}

function requireSummonerToken(): string {
  if (!config.summonerToken)
    throw new Error('SUMMONER_TOKEN must be set when SUMMONER_MODE=remote');
  return config.summonerToken;
}

const app = express();
// upgrade-insecure-requests tells browsers to rewrite resource URLs to HTTPS.
// It must be off when Node serves plain HTTP (default); set HTTPS_MODE=true
// when Node terminates TLS directly to re-enable HSTS and this directive.
const cspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
if (!config.httpsMode) delete cspDirectives['upgrade-insecure-requests'];
app.use(helmet({ hsts: config.httpsMode, contentSecurityPolicy: { directives: cspDirectives } }));
app.use(cors());

const httpServer = createServer(app);

// Mount transports per config. socket.io and ws are independent and can both
// run on the same http server (different paths). Default is ws-only.
const authenticator = config.authToken
  ? new TokenAuthenticator(config.authToken)
  : new NullAuthenticator();
const handles: TransportHandle[] = [];
if (config.transport.socketio) {
  const { SocketIoTransport } = await import('../transport/socket-io-transport.ts');
  handles.push(new SocketIoTransport({ authenticator, cors: { origin: '*' } }).attach(httpServer));
}

let channelEmitter: ChannelEmitter | null = null;

const wsTransport = new WsTransport(wsAdapter(), logger);
if (config.transport.ws) {
  wsTransport.route(
    WS_PATH,
    [
      auth(authenticator),
      heartbeat({ pingIntervalMs: 25_000, idleTimeoutMs: 60_000 }),
      resumable({
        onRebind: (socket, previousSocketId) =>
          channelEmitter?.reattachSocket(socket, previousSocketId),
        onExpire: (socketId) => channelEmitter?.expireSocket(socketId),
      }),
    ],
    () => {},
  );
}

function registerTransports(socketSrv: SocketServer): void {
  for (const handle of handles) socketSrv.register(handle);
  logger.info(
    { ws: config.transport.ws, socketio: config.transport.socketio },
    'Transports attached',
  );
}

let container: ReturnType<typeof createContainer> | null = null;

if (config.summonerMode === 'local') {
  container = createContainer({
    processProvider: new ChildProcessProvider(),
    storeConfig,
    fsRoots: config.fsRoots,
    rawEvents: config.rawEvents,
  });
  channelEmitter = container.get<ChannelEmitter>(TYPES.ChannelEventRouter);
  handles.push(wsTransport.attach(httpServer));
  registerTransports(container.get<SocketServer>(TYPES.SocketServer));
}

if (config.summonerMode === 'remote') {
  container = setupSummonerMode();
}

function setupSummonerMode() {
  const summonerToken = requireSummonerToken();
  const reconnectableRpc = new ReconnectableRpc();

  const c = createContainer({
    remoteRpc: reconnectableRpc,
    storeConfig,
    rawEvents: config.rawEvents,
  });

  wsTransport.route(
    SUMMONER_PATH,
    [
      bearerAuth(summonerToken),
      heartbeat({ pingIntervalMs: 5_000, idleTimeoutMs: 15_000 }),
      resumable(),
    ],
    (_socket, ctx) => {
      const rpc = new RpcChannel(ctx.socket as RpcChannelSocket);
      reconnectableRpc.replace(rpc);
      broadcastRemoteStatus(c, true);

      rpc.on('disconnect', () => broadcastRemoteStatus(c, false));
    },
  );

  channelEmitter = c.get<ChannelEmitter>(TYPES.ChannelEventRouter);
  handles.push(wsTransport.attach(httpServer));
  registerTransports(c.get<SocketServer>(TYPES.SocketServer));
  return c;
}

function broadcastRemoteStatus(c: ReturnType<typeof createContainer>, connected: boolean) {
  logger.info(connected ? 'remote summoner connected' : 'remote summoner disconnected');
  c.get<ChannelEmitter>(TYPES.ChannelEventRouter).broadcastAll('remote:status', { connected });
}

const HEALTH_PATH = '/health';

app.get(HEALTH_PATH, (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

if (config.debug) {
  app.get('/debug/channels', (_req, res) => {
    const channelManager = container?.get<ChannelManager>(TYPES.ChannelManager);
    if (!channelManager) {
      res.status(503).json({ error: 'Server not ready' });
      return;
    }
    res.json(buildChannelsSnapshot(channelManager));
  });
}

const publicDir = process.env.PUBLIC_DIR
  ? join(process.cwd(), process.env.PUBLIC_DIR)
  : [join(import.meta.dirname, '../public'), join(import.meta.dirname, '../../../web/dist')].find(
      (dir) => existsSync(join(dir, 'index.html')),
    );
if (publicDir) {
  app.use(express.static(publicDir));
  // SPA fallback
  app.get('*path', (req, res, next) => {
    if (req.path.startsWith(HEALTH_PATH)) return next();
    res.sendFile(join(publicDir, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    err instanceof Error && 'status' in err && typeof err.status === 'number' ? err.status : 500;
  const message = errMsg(err, 'Internal Server Error');
  if (status >= 500) logger.error({ err, status }, 'Unhandled request error');
  res.status(status).json({ error: message });
});

httpServer.listen(config.port, () => {
  printBanner();
  logger.info({ port: config.port }, 'Server listening');
});

function printBanner() {
  const base = `http://localhost:${config.port}`;
  const items: BannerItem[] = [
    { key: 'Local', value: base },
    { key: 'Health', value: `${base}/health` },
    { key: 'WS', value: `ws://localhost:${config.port}${WS_PATH}` },
  ];

  if (config.summonerMode === 'remote') {
    items.push({ key: 'Summoner', value: `ws://localhost:${config.port}${SUMMONER_PATH}` });
    items.push({ key: 'Mode', value: 'remote' });
    const tokenValue = config.summonerTokenGenerated
      ? `${config.summonerToken} (auto-generated)`
      : '***';
    items.push({ key: 'Token', value: tokenValue });
  } else {
    items.push({ key: 'Mode', value: 'local' });
  }

  const transports = [config.transport.ws && 'ws', config.transport.socketio && 'socket.io']
    .filter(Boolean)
    .join(', ');
  items.push({ key: 'Transport', value: transports });

  for (const url of config.database) {
    const masked = url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    items.push({ icon: '✓', key: 'Database', value: masked });
  }

  items.push({
    key: 'Static',
    value: publicDir ? `${publicDir} ✓` : 'not found',
    icon: publicDir ? '✓' : '✗',
  });

  console.log(formatBanner('Code Quest Server', items));
}

const shutdown = () => {
  logger.info('Shutting down gracefully...');
  Promise.all(handles.map((h) => h.close())).finally(() => {
    httpServer.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
