import { homedir } from 'node:os';
import { join } from 'node:path';
import { sqliteMigrationsFolder } from '@code-quest/db-schema';
import { LocalFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import { JsonlProjectScanner, SessionMigrator } from '@code-quest/session-store';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config.ts';
import { createContainer } from '../container.ts';
import { createDatabaseFromUrl } from '../db/create-database.ts';
import { DbProjectScanner } from '../services/db-project-scanner.ts';
import { DbSessionReader } from '../services/db-session-reader.ts';
import { DbSessionWriter } from '../services/db-session-writer.ts';
import type { RawEventStore } from '../services/raw-event-store.ts';
import type { SessionStore } from '../services/session-store.ts';
import { SessionTransfer } from '../services/session-transfer.ts';
import { TYPES } from '../types.ts';
import { SessionRunner } from './session-runner.ts';

async function main() {
  if (config.database.length === 0) throw new Error('No databases configured');

  const entries = config.database.map(createDatabaseFromUrl);

  for (const entry of entries) {
    if (entry.type === 'sqlite') {
      migrate(entry.db, { migrationsFolder: sqliteMigrationsFolder });
    }
  }

  const container = createContainer({
    storeConfig: { databases: entries },
    rawEvents: { writeDeltas: false, readDeltas: false },
  });

  const rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
  const sessionStore = container.get<SessionStore>(TYPES.SessionStore);

  const claudeProjectsDir = join(homedir(), '.claude', 'projects');
  const guardedFs = new RootGuardFilesystem(new LocalFilesystem(), [claudeProjectsDir]);
  const source = new JsonlProjectScanner(guardedFs, claudeProjectsDir);
  const target = new DbProjectScanner(rawEventService, sessionStore);
  const scanner = new SessionMigrator(source, target);

  const reader = new DbSessionReader(rawEventService, sessionStore);
  const writer = new DbSessionWriter(rawEventService, sessionStore);
  const transfer = new SessionTransfer(reader, writer, guardedFs);

  await new SessionRunner(scanner, transfer).run();
}

const SILENT_EXIT_PATTERNS = ['force closed', 'ExitPromptError'];

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (SILENT_EXIT_PATTERNS.some((p) => msg.includes(p))) process.exit(0);
  console.error(e);
  process.exit(1);
});
