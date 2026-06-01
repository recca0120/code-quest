import { sqliteMigrationsFolder } from '@code-quest/db-schema';
import { rawDeltas, rawEvents } from '@code-quest/db-schema/sqlite';
import type { RawEvent } from '@code-quest/summoner';
import { segments as s } from '@code-quest/test-kit';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from '../../db/sqlite-client.ts';
import { DrizzleRawDeltaStore } from '../drizzle-raw-delta-repository.ts';
import { DrizzleRawEventStore } from '../drizzle-raw-event-repository.ts';

describe('DrizzleRawEventStore', () => {
  let db: ReturnType<typeof createDatabase>;
  let store: DrizzleRawEventStore;

  beforeEach(() => {
    db = createDatabase(':memory:');
    migrate(db, { migrationsFolder: sqliteMigrationsFolder });
    store = new DrizzleRawEventStore(db, rawEvents);
  });

  it('appends and retrieves raw events via getBySession', async () => {
    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-1',
      direction: 'out',
      raw: s.assistant('hello'),
    };

    const id = await store.append(event);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const results = await store.getBySession('sess-1');
    expect(results).toHaveLength(1);
    expect(results[0]!.sessionId).toBe('sess-1');
    expect(results[0]!.direction).toBe('out');
    expect(results[0]!.raw).toBe(event.raw);
  });

  it('append uses the provided id verbatim when given', async () => {
    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-fixed',
      direction: 'out',
      raw: s.assistant('x'),
    };

    const returned = await store.append(event, 'fixed-id-123');
    expect(returned).toBe('fixed-id-123');
  });

  it('returns empty array for unknown session', async () => {
    const results = await store.getBySession('nonexistent');
    expect(results).toEqual([]);
  });

  it('appends multiple entries for same session', async () => {
    for (let i = 0; i < 3; i++) {
      await store.append({
        timestamp: Date.now() + i,
        sessionId: 'sess-3',
        direction: 'out',
        raw: `line ${i}`,
      });
    }

    const results = await store.getBySession('sess-3');
    expect(results).toHaveLength(3);
  });

  describe('getPreview', () => {
    it('returns last assistant text', async () => {
      const now = Date.now();
      await store.append({
        timestamp: now,
        sessionId: 'sess-p',
        direction: 'out',
        raw: s.assistant('Looking at the code'),
      });
      await store.append({
        timestamp: now + 1,
        sessionId: 'sess-p',
        direction: 'out',
        raw: s.assistant('Fixed the bug'),
      });

      const preview = await store.getPreview('sess-p');
      expect(preview.lastAssistant).toBe('Fixed the bug');
    });

    it('returns empty for unknown session', async () => {
      const preview = await store.getPreview('nonexistent');
      expect(preview.lastAssistant).toBeUndefined();
    });

    it('returns empty when no assistant messages', async () => {
      await store.append({
        timestamp: Date.now(),
        sessionId: 'sess-u',
        direction: 'in',
        raw: JSON.stringify({
          type: 'user',
          message: { content: [{ type: 'text', text: 'hello' }] },
        }),
      });

      const preview = await store.getPreview('sess-u');
      expect(preview.lastAssistant).toBeUndefined();
    });
  });

  it('returns entries ordered by createdAt', async () => {
    const now = Date.now();
    await store.append({
      timestamp: now + 200,
      sessionId: 'sess-4',
      direction: 'out',
      raw: 'c',
    });
    await store.append({
      timestamp: now,
      sessionId: 'sess-4',
      direction: 'out',
      raw: 'a',
    });
    await store.append({
      timestamp: now + 100,
      sessionId: 'sess-4',
      direction: 'out',
      raw: 'b',
    });

    const results = await store.getBySession('sess-4');
    expect(results.map((r) => r.raw)).toEqual(['a', 'b', 'c']);
  });

  describe('cloneEvents', () => {
    it('copies rows under a new sessionId preserving order and content', async () => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        await store.append({
          timestamp: now + i,
          sessionId: 'sess-parent',
          direction: i === 0 ? 'in' : 'out',
          raw: `raw-${i}`,
        });
      }

      await store.cloneEvents('sess-parent', 'sess-new');
      const cloned = await store.getBySession('sess-new');

      expect(cloned).toHaveLength(3);
      expect(cloned.map((r) => r.sessionId)).toEqual(['sess-new', 'sess-new', 'sess-new']);
      expect(cloned.map((r) => r.raw)).toEqual(['raw-0', 'raw-1', 'raw-2']);
      expect(cloned.map((r) => r.direction)).toEqual(['in', 'out', 'out']);
    });

    it('is a no-op when source has zero rows', async () => {
      await store.cloneEvents('sess-empty', 'sess-dest');
      const rows = await store.getBySession('sess-dest');
      expect(rows).toEqual([]);
    });

    it('rejects cloning to the same sessionId', async () => {
      await expect(store.cloneEvents('sess-x', 'sess-x')).rejects.toThrow();
    });
  });

  describe('hasUserEcho', () => {
    it('returns false when no out events with type:user', async () => {
      await store.append({
        timestamp: Date.now(),
        sessionId: 's',
        direction: 'in',
        raw: JSON.stringify({ type: 'user', message: { content: [] } }),
      });
      expect(await store.hasUserEcho('s')).toBe(false);
    });

    it('returns true when an out event has type:user', async () => {
      await store.append({
        timestamp: Date.now(),
        sessionId: 's',
        direction: 'out',
        raw: JSON.stringify({ type: 'user', message: { content: [] } }),
      });
      expect(await store.hasUserEcho('s')).toBe(true);
    });

    it('returns false for unknown session', async () => {
      expect(await store.hasUserEcho('nonexistent')).toBe(false);
    });
  });

  describe('streamBySession', () => {
    it('yields all events in a single batch when count <= batchSize', async () => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        await store.append({
          timestamp: now + i,
          sessionId: 's',
          direction: 'out',
          raw: `r${i}`,
        });
      }
      const batches: RawEvent[][] = [];
      for await (const batch of store.streamBySession('s', 10)) batches.push(batch);
      expect(batches).toHaveLength(1);
      expect(batches[0]!.map((e) => e.raw)).toEqual(['r0', 'r1', 'r2']);
    });

    it('yields multiple batches when count > batchSize', async () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        await store.append({
          timestamp: now + i,
          sessionId: 's',
          direction: 'out',
          raw: `r${i}`,
        });
      }
      const batches: RawEvent[][] = [];
      for await (const batch of store.streamBySession('s', 2)) batches.push(batch);
      expect(batches).toHaveLength(3);
      expect(batches.flat().map((e) => e.raw)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
    });

    it('yields nothing for unknown session', async () => {
      const batches: RawEvent[][] = [];
      for await (const batch of store.streamBySession('nonexistent', 10)) batches.push(batch);
      expect(batches).toHaveLength(0);
    });

    it('does not include delta table events', async () => {
      const db2 = createDatabase(':memory:');
      migrate(db2, { migrationsFolder: sqliteMigrationsFolder });
      const unionStore = new DrizzleRawEventStore(db2, rawEvents, rawDeltas);
      const deltaStore = new DrizzleRawDeltaStore(db2, rawDeltas);
      const now = Date.now();
      await unionStore.append({
        sessionId: 's',
        direction: 'in',
        raw: 'event',
        timestamp: now,
      });
      await deltaStore.append({
        parentId: '',
        sessionId: 's',
        direction: 'out',
        raw: 'delta',
        timestamp: now + 10,
      });

      const batches: RawEvent[][] = [];
      for await (const batch of unionStore.streamBySession('s', 10)) batches.push(batch);
      expect(batches.flat().map((e) => e.raw)).toEqual(['event']);
    });
  });

  describe('getBySession with delta table — UNION ALL', () => {
    it('merges events + deltas ordered by createdAt and id', async () => {
      const db = createDatabase(':memory:');
      migrate(db, { migrationsFolder: sqliteMigrationsFolder });
      const unionStore = new DrizzleRawEventStore(db, rawEvents, rawDeltas);
      const deltaStore = new DrizzleRawDeltaStore(db, rawDeltas);

      const now = Date.now();
      await unionStore.append({
        sessionId: 'S',
        direction: 'in',
        raw: 'E0',
        timestamp: now,
      });
      await deltaStore.append({
        parentId: '',
        sessionId: 'S',
        direction: 'out',
        raw: 'D1',
        timestamp: now + 10,
      });
      await unionStore.append({
        sessionId: 'S',
        direction: 'out',
        raw: 'E2',
        timestamp: now + 20,
      });
      await deltaStore.append({
        parentId: '',
        sessionId: 'S',
        direction: 'out',
        raw: 'D3',
        timestamp: now + 30,
      });

      const rows = await unionStore.getBySession('S');
      expect(rows.map((r) => r.raw)).toEqual(['E0', 'D1', 'E2', 'D3']);
    });

    it('appended RawEvent has no seq field', async () => {
      const db2 = createDatabase(':memory:');
      migrate(db2, { migrationsFolder: sqliteMigrationsFolder });
      const s = new DrizzleRawEventStore(db2, rawEvents);
      await s.append({ sessionId: 'x', direction: 'out', raw: 'r', timestamp: Date.now() });
      const results = await s.getBySession('x');
      expect(results).toHaveLength(1);
      expect(results[0]).not.toHaveProperty('seq');
    });

    it('cloneEvents still reads events only (deltas stay put)', async () => {
      const db = createDatabase(':memory:');
      migrate(db, { migrationsFolder: sqliteMigrationsFolder });
      const unionStore = new DrizzleRawEventStore(db, rawEvents, rawDeltas);
      const deltaStore = new DrizzleRawDeltaStore(db, rawDeltas);

      await unionStore.append({
        sessionId: 'parent',
        direction: 'in',
        raw: 'event-A',
        timestamp: Date.now(),
      });
      await deltaStore.append({
        parentId: '',
        sessionId: 'parent',
        direction: 'out',
        raw: 'delta-A',
        timestamp: Date.now() + 10,
      });

      await unionStore.cloneEvents('parent', 'child');

      // Child has only event rows — deltas were NOT cloned into raw_events.
      const childUnion = await unionStore.getBySession('child');
      const childDeltas = await deltaStore.getBySession('child');
      expect(childUnion.map((r) => r.raw)).toEqual(['event-A']);
      expect(childDeltas).toEqual([]);
    });
  });
});
