import type { RawEvent } from '@code-quest/summoner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawDeltaEntry, RawDeltaRepository } from '../raw-delta-repository.ts';
import type { RawEventRepository } from '../raw-event-repository.ts';
import { RawEventStore } from '../raw-event-store.ts';

function mockEventStore(overrides: Partial<RawEventRepository> = {}): RawEventRepository {
  return {
    append: vi.fn(async () => 'evt-id'),
    getBySession: vi.fn(async () => []),
    getPreview: vi.fn(async () => ({})),
    cloneEvents: vi.fn(async () => {}),
    countBySession: vi.fn(async () => 0),
    hasEvents: vi.fn(async () => false),
    hasUserEcho: vi.fn(async () => false),
    streamBySession: vi.fn(async function* () {}),
    deleteBySession: vi.fn(async () => {}),
    ...overrides,
  };
}

function mockDeltaStore(overrides: Partial<RawDeltaRepository> = {}): RawDeltaRepository {
  return {
    append: vi.fn(async () => {}),
    getBySession: vi.fn(async () => []),
    deleteBySession: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    sessionId: 'sess',
    direction: 'out',
    raw: 'x',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeDelta(overrides: Partial<RawDeltaEntry> = {}): RawDeltaEntry {
  return {
    parentId: 'parent',
    sessionId: 'sess',
    direction: 'out',
    raw: 'd',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('RawEventStore', () => {
  let eventStore: RawEventRepository;
  let deltaStore: RawDeltaRepository;
  let service: RawEventStore;

  beforeEach(() => {
    eventStore = mockEventStore();
    deltaStore = mockDeltaStore();
    service = new RawEventStore(eventStore, deltaStore);
  });

  it('appendEvent routes to eventStore.append and returns the id', async () => {
    const id = await service.appendEvent(makeEvent());
    expect(id).toBe('evt-id');
    expect(eventStore.append).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess', direction: 'out', raw: 'x' }),
      undefined,
    );
    expect(deltaStore.append).not.toHaveBeenCalled();
  });

  it('appendEvent forwards caller-supplied id', async () => {
    await service.appendEvent(makeEvent(), 'custom-id');
    expect(eventStore.append).toHaveBeenCalledWith(expect.anything(), 'custom-id');
  });

  it('appendDelta routes to deltaStore.append', async () => {
    await service.appendDelta(makeDelta());
    expect(deltaStore.append).toHaveBeenCalledTimes(1);
    expect(deltaStore.append).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess', direction: 'out' }),
    );
    expect(eventStore.append).not.toHaveBeenCalled();
  });

  it('getBySession delegates to eventStore (UNION happens inside the store)', async () => {
    const rows = [makeEvent({ raw: 'E' })];
    eventStore = mockEventStore({ getBySession: vi.fn(async () => rows) });
    service = new RawEventStore(eventStore, deltaStore);

    expect(await service.getBySession('sess')).toEqual(rows);
    expect(eventStore.getBySession).toHaveBeenCalledWith('sess');
    expect(deltaStore.getBySession).not.toHaveBeenCalled();
  });

  it('getPreview delegates to eventStore only', async () => {
    await service.getPreview('sess');
    expect(eventStore.getPreview).toHaveBeenCalledWith('sess');
  });

  it('cloneEvents delegates to eventStore only (deltas never follow a fork)', async () => {
    await service.cloneEvents('sess-a', 'sess-b');
    expect(eventStore.cloneEvents).toHaveBeenCalledWith('sess-a', 'sess-b');
    expect(deltaStore.getBySession).not.toHaveBeenCalled();
  });

  it('deleteBySession deletes from both eventStore and deltaStore', async () => {
    await service.deleteBySession('sess-del');
    expect(eventStore.deleteBySession).toHaveBeenCalledWith('sess-del');
    expect(deltaStore.deleteBySession).toHaveBeenCalledWith('sess-del');
  });
});
