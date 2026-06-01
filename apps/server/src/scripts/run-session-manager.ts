import { homedir } from 'node:os';
import { join } from 'node:path';
import { sqliteMigrationsFolder } from '@code-quest/db-schema';
import { LocalFilesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import { JsonlProjectScanner, SessionScanner } from '@code-quest/session-store';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config.ts';
import { createContainer } from '../container.ts';
import { createDatabaseFromUrl } from '../db/create-database.ts';
import { DbProjectList } from '../services/db-project-list.ts';
import { DbSessionReader } from '../services/db-session-reader.ts';
import { DbSessionWriter } from '../services/db-session-writer.ts';
import type { RawEventStore } from '../services/raw-event-store.ts';
import type { SessionStore } from '../services/session-store.ts';
import { TYPES } from '../types.ts';
import { SessionManager } from './session-manager.ts';

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
  const scanFs = new RootGuardFilesystem(new LocalFilesystem(), [claudeProjectsDir]);
  const jsonlProjects = new JsonlProjectScanner(scanFs, claudeProjectsDir);
  const dbProjects = new DbProjectList(rawEventService, sessionStore);
  const scanner = new SessionScanner(jsonlProjects, dbProjects);

  const writeFs = new LocalFilesystem();
  const reader = new DbSessionReader(rawEventService, sessionStore);
  const writer = new DbSessionWriter(rawEventService, sessionStore);
  await new SessionManager(scanner, reader, writer, writeFs).run();
}

const SILENT_EXIT_PATTERNS = ['force closed', 'ExitPromptError'];

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (SILENT_EXIT_PATTERNS.some((p) => msg.includes(p))) process.exit(0);
  console.error(e);
  process.exit(1);
});
