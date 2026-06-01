import type { RawEvent } from '@code-quest/summoner';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContainer } from '../../test/create-test-container.ts';
import { TYPES } from '../../types.ts';
import type { RawEventStore } from '../raw-event-store.ts';

function makeEvent(overrides: Partial<RawEvent> = {}): RawEvent {
  return { sessionId: 'sess', direction: 'out', raw: '{}', timestamp: 0, ...overrides };
}

describe('RawEventStore', () => {
  let service: RawEventStore;

  beforeEach(() => {
    service = createTestContainer().get<RawEventStore>(TYPES.RawEventStore);
  });

  it('appendEvent persists event retrievable by getBySession', async () => {
    await service.appendEvent(makeEvent({ raw: 'hello' }));
    const events = await service.getBySession('sess');
    expect(events).toHaveLength(1);
    expect(events[0]?.raw).toBe('hello');
  });

  it('appendEvent with explicit id uses that id', async () => {
    const id = await service.appendEvent(makeEvent(), 'custom-id');
    expect(id).toBe('custom-id');
  });

  it('appendDelta does not appear in getBySession (events only)', async () => {
    await service.appendEvent(makeEvent({ direction: 'in', raw: 'user input' }));
    await service.appendDelta({
      parentId: 'p',
      sessionId: 'sess',
      direction: 'out',
      raw: 'delta',
      timestamp: 0,
    });
    const events = await service.getBySession('sess');
    expect(events).toHaveLength(1);
  });

  it('getBySession returns events for the given session only', async () => {
    await service.appendEvent(makeEvent({ sessionId: 'sess-a' }));
    await service.appendEvent(makeEvent({ sessionId: 'sess-b' }));
    expect(await service.getBySession('sess-a')).toHaveLength(1);
    expect(await service.getBySession('sess-b')).toHaveLength(1);
  });

  it('deleteBySession removes events and deltas for that session', async () => {
    await service.appendEvent(makeEvent());
    await service.deleteBySession('sess');
    expect(await service.getBySession('sess')).toHaveLength(0);
  });

  it('cloneEvents copies events under new sessionId', async () => {
    await service.appendEvent(makeEvent({ raw: 'original' }));
    await service.cloneEvents('sess', 'sess-clone');
    const cloned = await service.getBySession('sess-clone');
    expect(cloned).toHaveLength(1);
    expect(cloned[0]?.raw).toBe('original');
  });
});
