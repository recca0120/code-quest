import 'reflect-metadata';
import { sqliteMigrationsFolder, sqliteSchema } from '@code-quest/db-schema';
import type { DiffFile } from '@code-quest/diff-file';
import type { FileWatcher } from '@code-quest/file-watcher';
import { type Filesystem, RootGuardFilesystem } from '@code-quest/filesystem';
import type { Git } from '@code-quest/git';
import type { Openspec } from '@code-quest/openspec';
import type { ProcessProvider } from '@code-quest/schemas';
import type { PluginCliService } from '@code-quest/summoner';
import { FakeDiffFile, FakeOpenspec, FakePluginCli } from '@code-quest/summoner/test';
import { FakeFilesystem, FakeFileWatcher, FakeGit } from '@code-quest/test-kit';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Container } from 'inversify';
import { createContainer } from '../container.ts';
import { createDatabase } from '../db/sqlite-client.ts';
import type { SettingsStore } from '../services/settings-store.ts';
import { TYPES } from '../types.ts';
import { InMemorySettingsStore } from './in-memory-settings-store.ts';

interface TestContainerOverrides {
  processProvider?: ProcessProvider;
  filesystemService?: Filesystem;
  gitService?: Git;
  openspecService?: Openspec;
  pluginCli?: PluginCliService;
  diffFileService?: DiffFile;
  watchService?: FileWatcher;
  historyBatchSize?: number;
  autoMode?: boolean;
  rawEvents?: { writeDeltas?: boolean; readDeltas?: boolean };
}

export function createTestContainer(overrides: TestContainerOverrides = {}): Container {
  const sqliteDatabase = createDatabase(':memory:');
  migrate(sqliteDatabase, { migrationsFolder: sqliteMigrationsFolder });

  const container = createContainer({
    ...overrides,
    watchService: overrides.watchService ?? new FakeFileWatcher(),
    storeConfig: {
      databases: [
        { type: 'sqlite', url: 'file::memory:', db: sqliteDatabase, schema: sqliteSchema },
      ],
    },
    historyBatchSize: overrides.historyBatchSize,
    autoMode: overrides.autoMode ?? true,
    rawEvents: { writeDeltas: false, readDeltas: false, ...overrides.rawEvents },
  });

  // Use in-memory settings in tests to avoid file system state leaking between runs
  container.rebind<SettingsStore>(TYPES.SettingsStore).toConstantValue(new InMemorySettingsStore());

  const guardedFs =
    overrides.filesystemService ??
    (() => {
      const fakeFs = new FakeFilesystem();
      return new RootGuardFilesystem(fakeFs, () => fakeFs.getRoots());
    })();
  container.rebind<Filesystem>(TYPES.Filesystem).toConstantValue(guardedFs);

  container.rebind<Git>(TYPES.Git).toConstantValue(overrides.gitService ?? new FakeGit());

  container
    .rebind<Openspec>(TYPES.Openspec)
    .toConstantValue(overrides.openspecService ?? new FakeOpenspec());

  container
    .rebind<PluginCliService>(TYPES.PluginCliService)
    .toConstantValue(overrides.pluginCli ?? new FakePluginCli());

  container
    .rebind<DiffFile>(TYPES.DiffFile)
    .toConstantValue(overrides.diffFileService ?? new FakeDiffFile());

  return container;
}
