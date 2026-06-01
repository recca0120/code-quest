import { join } from 'node:path';
import { LocalFilesystem } from '@code-quest/filesystem';
import { JsonlFileReader, MemoryWriter } from '@code-quest/session-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import { DbSessionReader } from '../db-session-reader.ts';
import { DbSessionWriter } from '../db-session-writer.ts';
import type { RawEventStore } from '../raw-event-store.ts';
import type { SessionStore } from '../session-store.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SESSION_ID = 'b3dbab57-8da8-40c9-86e8-11aadc1881e8';
const JSONL_PATH = join(FIXTURES, 'b3dbab57.jsonl');

describe('DbSessionWriter', () => {
  let rawEventService: RawEventStore;
  let sessionStore: SessionStore;

  beforeEach(() => {
    const container = createTestContainer();
    rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
    sessionStore = container.get<SessionStore>(TYPES.SessionStore);
  });

  it('writes session record and events to DB', async () => {
    const data = await new JsonlFileReader(JSONL_PATH, new LocalFilesystem()).read(SESSION_ID);
    await new DbSessionWriter(rawEventService, sessionStore).write(SESSION_ID, data);

    const session = await sessionStore.getById(SESSION_ID);
    expect(session?.id).toBe(SESSION_ID);
    expect(session?.cwd).toBe('/Users/recca0120/WebstormProjects/cc-office');

    const events = await rawEventService.getBySession(SESSION_ID);
    expect(events.length).toBe(data.events.length);
  });

  it('skip guard: does not re-write if already in DB', async () => {
    const data = await new JsonlFileReader(JSONL_PATH, new LocalFilesystem()).read(SESSION_ID);
    const writer = new DbSessionWriter(rawEventService, sessionStore);
    await writer.write(SESSION_ID, data);
    const countFirst = (await rawEventService.getBySession(SESSION_ID)).length;
    expect(countFirst).toBeGreaterThan(0);

    await writer.write(SESSION_ID, data);
    const countSecond = (await rawEventService.getBySession(SESSION_ID)).length;
    expect(countSecond).toBe(countFirst);
  });
});

describe('DbSessionReader', () => {
  let rawEventService: RawEventStore;
  let sessionStore: SessionStore;
  let seededEventCount: number;

  beforeEach(async () => {
    const container = createTestContainer();
    rawEventService = container.get<RawEventStore>(TYPES.RawEventStore);
    sessionStore = container.get<SessionStore>(TYPES.SessionStore);

    const data = await new JsonlFileReader(JSONL_PATH, new LocalFilesystem()).read(SESSION_ID);
    seededEventCount = data.events.length;
    await new DbSessionWriter(rawEventService, sessionStore).write(SESSION_ID, data);
  });

  it('reads back the same events that were written', async () => {
    const { events, record } = await new DbSessionReader(rawEventService, sessionStore).read(
      SESSION_ID,
    );
    expect(record.id).toBe(SESSION_ID);
    expect(events.length).toBe(seededEventCount);
  });

  it('round-trips: write to DB -> read from DB -> write to Memory', async () => {
    const data = await new DbSessionReader(rawEventService, sessionStore).read(SESSION_ID);
    const sink = new MemoryWriter();
    await sink.write(SESSION_ID, data);
    const stored = sink.data.get(SESSION_ID);
    expect(stored?.record.id).toBe(SESSION_ID);
    expect(stored?.events.length).toBe(seededEventCount);
  });
});
