import { sqliteMigrationsFolder } from '@code-quest/db-schema';
import { rawDeltas } from '@code-quest/db-schema/sqlite';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../db/sqlite-client.ts';
import { DrizzleRawDeltaStore } from '../drizzle-raw-delta-repository.ts';
import type { RawDeltaEntry } from '../raw-delta-repository.ts';

function makeEntry(overrides: Partial<RawDeltaEntry> = {}): RawDeltaEntry {
  return {
    parentId: 'parent-xyz',
    sessionId: 'sess-1',
    direction: 'out',
    raw: '{"type":"stream_event","event":{"type":"content_block_delta"}}',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('DrizzleRawDeltaStore', () => {
  let store: DrizzleRawDeltaStore;

  beforeEach(() => {
    const db = createDatabase(':memory:');
    migrate(db, { migrationsFolder: sqliteMigrationsFolder });
    store = new DrizzleRawDeltaStore(db, rawDeltas);
  });

  it('appends and retrieves via getBySession', async () => {
    await store.append(makeEntry({ raw: 'delta-1' }));
    const results = await store.getBySession('sess-1');

    expect(results).toHaveLength(1);
    expect(results[0]!.parentId).toBe('parent-xyz');
    expect(results[0]!.raw).toBe('delta-1');
    expect(results[0]!.sessionId).toBe('sess-1');
    expect(results[0]!.direction).toBe('out');
  });

  it('preserves parent_id across multiple inserts', async () => {
    await store.append(makeEntry({ parentId: 'parent-A', raw: 'a-1' }));
    await store.append(makeEntry({ parentId: 'parent-A', raw: 'a-2' }));
    await store.append(makeEntry({ parentId: 'parent-B', raw: 'b-1' }));

    const results = await store.getBySession('sess-1');
    expect(results.map((r) => r.parentId)).toEqual(['parent-A', 'parent-A', 'parent-B']);
  });

  it('returns results ordered by createdAt', async () => {
    const now = Date.now();
    await store.append(makeEntry({ raw: 'c', timestamp: now + 20 }));
    await store.append(makeEntry({ raw: 'a', timestamp: now }));
    await store.append(makeEntry({ raw: 'b', timestamp: now + 10 }));

    const results = await store.getBySession('sess-1');
    expect(results.map((r) => r.raw)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for unknown session', async () => {
    expect(await store.getBySession('nope')).toEqual([]);
  });

  it('scopes getBySession by sessionId', async () => {
    await store.append(makeEntry({ sessionId: 'A', raw: 'a' }));
    await store.append(makeEntry({ sessionId: 'B', raw: 'b' }));

    expect((await store.getBySession('A')).map((r) => r.raw)).toEqual(['a']);
    expect((await store.getBySession('B')).map((r) => r.raw)).toEqual(['b']);
  });
});
