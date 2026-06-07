import { FakeProcessHandle, FakeProcessProvider } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';

describe('FakeProcessHandle', () => {
  it('emit pushes to lines iterable', async () => {
    const handle = new FakeProcessHandle();
    handle.emit('{"type":"init"}');
    handle.emit('{"type":"assistant"}');
    handle.abort(); // end iteration

    const lines: string[] = [];
    for await (const line of handle.lines) {
      lines.push(line);
    }

    expect(lines).toEqual(['{"type":"init"}', '{"type":"assistant"}']);
  });

  it('lines waits for emit (async push)', async () => {
    const handle = new FakeProcessHandle();

    const linePromise = (async () => {
      const result: string[] = [];
      for await (const line of handle.lines) {
        result.push(line);
        if (result.length >= 1) handle.abort();
      }
      return result;
    })();

    // emit after iteration started
    handle.emit('{"type":"delayed"}');

    const lines = await linePromise;
    expect(lines).toEqual(['{"type":"delayed"}']);
  });

  it('send collects to received()', () => {
    const handle = new FakeProcessHandle();
    handle.send('{"type":"user","message":"hello"}');
    handle.send('{"type":"control_response","request_id":"r1"}');

    expect(handle.received()).toEqual([
      { type: 'user', message: 'hello' },
      { type: 'control_response', request_id: 'r1' },
    ]);
  });

  it('received(type) filters by type', () => {
    const handle = new FakeProcessHandle();
    handle.send('{"type":"user","message":"hello"}');
    handle.send('{"type":"control_response","request_id":"r1"}');
    handle.send('{"type":"user","message":"bye"}');

    expect(handle.received('user')).toEqual([
      { type: 'user', message: 'hello' },
      { type: 'user', message: 'bye' },
    ]);
    expect(handle.received('control_response')).toEqual([
      { type: 'control_response', request_id: 'r1' },
    ]);
  });

  it('abort ends lines iteration', async () => {
    const handle = new FakeProcessHandle();
    handle.abort();

    const lines: string[] = [];
    for await (const line of handle.lines) {
      lines.push(line);
    }

    expect(lines).toEqual([]);
    expect(handle.signal.aborted).toBe(true);
  });

  it('abort resolves pending next() with done', async () => {
    const handle = new FakeProcessHandle();

    const linePromise = (async () => {
      const result: string[] = [];
      for await (const line of handle.lines) {
        result.push(line);
      }
      return result;
    })();

    // Let iteration start, then abort
    await new Promise((r) => setTimeout(r, 10));
    handle.abort();

    const lines = await linePromise;
    expect(lines).toEqual([]);
  });
});

describe('FakeProcessProvider', () => {
  it('spawn returns FakeProcessHandle', () => {
    const provider = new FakeProcessProvider();
    const handle = provider.spawn('claude', ['--json']);

    expect(handle).toBeInstanceOf(FakeProcessHandle);
    expect(provider.latest).toBe(handle);
  });

  it('tracks all spawned handles', () => {
    const provider = new FakeProcessProvider();
    const h1 = provider.spawn('claude', []);
    const h2 = provider.spawn('claude', []);

    expect(provider.all).toEqual([h1, h2]);
    expect(provider.latest).toBe(h2);
  });

  it('reset() clears handles, spawnCalls, runOnceCalls, and queued responses', async () => {
    const provider = new FakeProcessProvider();
    provider.spawn('claude', ['--json']);
    provider.enqueueRunOnce({ exitCode: 0, stdout: 'out', stderr: '' });

    provider.reset();

    expect(provider.all).toHaveLength(0);
    expect(provider.spawnCalls).toHaveLength(0);
    expect(provider.runOnceCalls).toHaveLength(0);
    // Queued response was cleared — next runOnce returns default
    const result = await provider.runOnce('x', []);
    expect(result).toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });
});
