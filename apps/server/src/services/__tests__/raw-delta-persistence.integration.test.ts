import { rawDeltas, rawEvents } from '@code-quest/db-schema/sqlite';
import { segments as s } from '@code-quest/test-kit';
import { describe, expect, it, vi } from 'vitest';
import type { DrizzleDatabase } from '../../db/sqlite-client.ts';
import { createFakeServer, createFakeSummoner, createTestContainer } from '../../test/index.ts';
import { TYPES } from '../../types.ts';
import type { RawEventStore } from '../raw-event-store.ts';

function deltaLine(text: string): string {
  return JSON.stringify({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    },
  });
}

async function runTurn(
  sessionId: string,
  rawEventsConfig?: { writeDeltas?: boolean; readDeltas?: boolean },
) {
  const container = createTestContainer({ rawEvents: rawEventsConfig });
  const server = createFakeServer(container);
  const summoner = createFakeSummoner(server);
  const claude = summoner.claude();
  await claude.initialize(s.init(sessionId));

  await claude.send('chat:send', { channelId: sessionId, message: 'hi' });
  await claude.emitSegment(deltaLine('Hel'));
  await claude.emitSegment(deltaLine('lo'));
  await claude.emitSegment(s.assistant('Hello'));
  await claude.emitSegment(s.result());

  // Wait until the assistant + result rows are persisted (instead of a
  // fixed sleep — flaky on slow CI, wasteful on fast machines).
  const db = container.get<DrizzleDatabase>(TYPES.Database);
  await vi.waitFor(async () => {
    const rows = await db.select().from(rawEvents);
    if (rows.length < 2) throw new Error('persistence not settled');
  });
  return container;
}

describe('raw delta persistence — four flag quadrants', () => {
  it('WRITE=false, READ=false — clean mode: no deltas persisted, UNION skipped', async () => {
    const container = await runTurn('sess-q1');

    const db = container.get<DrizzleDatabase>(TYPES.Database);
    const deltaRows = await db.select().from(rawDeltas);
    expect(deltaRows).toEqual([]);

    const svc = container.get<RawEventStore>(TYPES.RawEventStore);
    const rows = await svc.getBySession('sess-q1');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.raw.includes('content_block_delta'))).toBe(true);
  });

  it('WRITE=true, READ=false — quiet persist: deltas stored but not surfaced by getBySession', async () => {
    const container = await runTurn('sess-q2', { writeDeltas: true });

    const db = container.get<DrizzleDatabase>(TYPES.Database);
    const deltaRows = await db.select().from(rawDeltas);
    expect(deltaRows.length).toBeGreaterThanOrEqual(2);

    const svc = container.get<RawEventStore>(TYPES.RawEventStore);
    const rows = await svc.getBySession('sess-q2');
    expect(rows.every((r) => !r.raw.includes('content_block_delta'))).toBe(true);
  });

  it('WRITE=true, READ=true — full debug: deltas persisted and surfaced via UNION', async () => {
    const container = await runTurn('sess-q3', { writeDeltas: true, readDeltas: true });

    const db = container.get<DrizzleDatabase>(TYPES.Database);
    const deltaRows = await db.select().from(rawDeltas);
    expect(deltaRows.length).toBeGreaterThanOrEqual(2);

    const svc = container.get<RawEventStore>(TYPES.RawEventStore);
    const unioned = await svc.getBySession('sess-q3');
    expect(unioned.some((r) => r.raw.includes('content_block_delta'))).toBe(true);
    expect(unioned.some((r) => r.raw.startsWith('{"type":"assistant"'))).toBe(true);
  });

  it('WRITE=false, READ=true — no-op UNION: empty delta table, events still returned', async () => {
    const container = await runTurn('sess-q4', { readDeltas: true });

    const db = container.get<DrizzleDatabase>(TYPES.Database);
    const deltaRows = await db.select().from(rawDeltas);
    expect(deltaRows).toEqual([]);

    const svc = container.get<RawEventStore>(TYPES.RawEventStore);
    const rows = await svc.getBySession('sess-q4');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.raw.includes('content_block_delta'))).toBe(true);
  });
});
