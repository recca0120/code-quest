import { sqliteMigrationsFolder } from '@code-quest/db-schema';
import { rawEvents } from '@code-quest/db-schema/sqlite';
import type { RawEvent } from '@code-quest/summoner';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from '../../db/sqlite-client.ts';
import { CompositeRawEventStore } from '../composite-raw-event-repository.ts';
import { DrizzleRawEventStore } from '../drizzle-raw-event-repository.ts';
import type { RawEventRepository } from '../raw-event-repository.ts';

function stubStore(overrides: Partial<RawEventRepository> = {}): RawEventRepository {
  return {
    async append() {
      return 'id';
    },
    async getBySession() {
      return [];
    },
    async getPreview() {
      return {};
    },
    async cloneEvents() {},
    async countBySession() {
      return 0;
    },
    async hasEvents() {
      return false;
    },
    async hasUserEcho() {
      return false;
    },
    async *streamBySession() {},
    async deleteBySession() {},
    ...overrides,
  };
}

describe('CompositeRawEventStore', () => {
  let storeA: DrizzleRawEventStore;
  let storeB: DrizzleRawEventStore;

  beforeEach(() => {
    const dbA = createDatabase(':memory:');
    migrate(dbA, { migrationsFolder: sqliteMigrationsFolder });
    storeA = new DrizzleRawEventStore(dbA, rawEvents);

    const dbB = createDatabase(':memory:');
    migrate(dbB, { migrationsFolder: sqliteMigrationsFolder });
    storeB = new DrizzleRawEventStore(dbB, rawEvents);
  });

  it('appends to all stores', async () => {
    const composite = new CompositeRawEventStore([storeA, storeB]);

    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-1',
      direction: 'out',
      raw: 'hello',
    };

    await composite.append(event);

    expect(await storeA.getBySession('sess-1')).toHaveLength(1);
    expect(await storeB.getBySession('sess-1')).toHaveLength(1);
  });

  it('reads from the first store', async () => {
    const composite = new CompositeRawEventStore([storeA, storeB]);

    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-1',
      direction: 'out',
      raw: 'data',
    };

    await composite.append(event);
    const results = await composite.getBySession('sess-1');
    expect(results).toHaveLength(1);
    expect(results[0]!.raw).toBe('data');
  });

  it('throws when constructed with empty stores array', () => {
    expect(() => new CompositeRawEventStore([])).toThrow(
      'CompositeStore requires at least one store',
    );
  });

  it('throws when all stores fail on append', async () => {
    const failStore1 = stubStore({
      async append() {
        throw new Error('fail1');
      },
    });
    const failStore2 = stubStore({
      async append() {
        throw new Error('fail2');
      },
    });
    const composite = new CompositeRawEventStore([failStore1, failStore2]);

    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-1',
      direction: 'out',
      raw: 'test',
    };

    await expect(composite.append(event)).rejects.toThrow('All stores failed: raw event append');
  });

  it('continues writing to other stores even if one fails', async () => {
    const failStore = stubStore({
      async append() {
        throw new Error('fail');
      },
    });
    const composite = new CompositeRawEventStore([failStore, storeB]);

    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess-1',
      direction: 'out',
      raw: 'test',
    };

    await composite.append(event);
    const results = await storeB.getBySession('sess-1');
    expect(results).toHaveLength(1);
  });

  it('generates id once and passes it to all inner stores', async () => {
    const idsSeenBy: string[] = [];
    const makeSpy = (): RawEventRepository =>
      stubStore({
        async append(_e, id) {
          idsSeenBy.push(id ?? '(none)');
          return id ?? 'local';
        },
      });
    const a = makeSpy();
    const b = makeSpy();
    const composite = new CompositeRawEventStore([a, b]);

    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess',
      direction: 'out',
      raw: 'x',
    };

    const returnedId = await composite.append(event);

    expect(idsSeenBy).toHaveLength(2);
    expect(idsSeenBy[0]).toBe(idsSeenBy[1]);
    expect(returnedId).toBe(idsSeenBy[0]);
    expect(returnedId).toMatch(/^[0-9a-f]{8}-/);
  });

  it('cloneEvents generates ids once and passes the same ids to every inner store', async () => {
    const idsSeenByA: string[][] = [];
    const idsSeenByB: string[][] = [];
    const makeSpy = (captured: string[][]): RawEventRepository =>
      stubStore({
        async append(_event, id) {
          return id ?? 'gen';
        },
        async getBySession() {
          return [
            { timestamp: 0, sessionId: 'parent', direction: 'in', raw: 'r-0', seq: 0 },
            { timestamp: 1, sessionId: 'parent', direction: 'out', raw: 'r-1', seq: 1 },
          ];
        },
        async cloneEvents(_from, _to, ids) {
          captured.push(ids ?? []);
        },
      });
    const spyA = makeSpy(idsSeenByA);
    const spyB = makeSpy(idsSeenByB);
    const composite = new CompositeRawEventStore([spyA, spyB]);

    await composite.cloneEvents('parent', 'child');

    expect(idsSeenByA[0]).toHaveLength(2);
    expect(idsSeenByA[0]).toEqual(idsSeenByB[0]);
    for (const id of idsSeenByA[0]!) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    }
  });

  it('honors explicitly provided id', async () => {
    const spy = stubStore({
      async append(_e, id) {
        return id ?? 'unset';
      },
    });
    const composite = new CompositeRawEventStore([spy]);
    const event: RawEvent = {
      timestamp: Date.now(),
      sessionId: 'sess',
      direction: 'out',
      raw: 'x',
    };
    const id = await composite.append(event, 'caller-supplied-id');
    expect(id).toBe('caller-supplied-id');
  });
});
