import {
  type Broadcaster,
  FilesDataSource,
  GitDataSource,
  LocalBroadcaster,
} from '@code-quest/broadcaster';
import { REMOTE_METHODS } from '@code-quest/schemas';
import { FakeAgentTransport, FakeFilesystem, FakeFileWatcher, FakeGit } from '@code-quest/test-kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BroadcasterHandler } from '../broadcaster-handler.ts';

function snapshots(emitted: Array<[string, unknown]>, type?: string) {
  return emitted.filter(([e, p]) => {
    if (e !== REMOTE_METHODS.watch.snapshot) return false;
    if (type) return (p as Record<string, unknown>).type === type;
    return true;
  });
}

describe('BroadcasterHandler', () => {
  let watch: FakeFileWatcher;
  let fs: FakeFilesystem;
  let git: FakeGit;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    watch = new FakeFileWatcher();
    fs = new FakeFilesystem();
    fs.setRoots(['/repo']);
    git = new FakeGit();
    broadcaster = new LocalBroadcaster()
      .add('files', (cwd) => new FilesDataSource(cwd, watch, fs))
      .add('git', (cwd) => new GitDataSource(cwd, watch, git));
  });

  it('watch.start sends initial files snapshot on subscribe', async () => {
    const transport = new FakeAgentTransport();
    new BroadcasterHandler(broadcaster).attach(transport);

    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'files').length > 0, { timeout: 500 });

    const snap = snapshots(transport.emitted, 'files')[0]![1] as Record<string, unknown>;
    expect(snap.cwd).toBe('/repo');
    expect(snap.type).toBe('files');
  });

  it('watch.start pushes files snapshot on file change', async () => {
    const transport = new FakeAgentTransport();
    new BroadcasterHandler(broadcaster).attach(transport);

    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'files').length > 0, { timeout: 500 });

    const countBefore = snapshots(transport.emitted, 'files').length;
    watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'files').length > countBefore, {
      timeout: 500,
    });

    const snap = snapshots(transport.emitted, 'files').at(-1)![1] as Record<string, unknown>;
    expect(snap.cwd).toBe('/repo');
    expect(snap.type).toBe('files');
  });

  it('watch.start pushes git snapshot on .git/HEAD change', async () => {
    const transport = new FakeAgentTransport();
    new BroadcasterHandler(broadcaster).attach(transport);

    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'git').length > 0, { timeout: 500 });

    const countBefore = snapshots(transport.emitted, 'git').length;
    watch.simulate('/repo', { type: 'change', path: '.git/HEAD' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'git').length > countBefore, {
      timeout: 500,
    });

    const snap = snapshots(transport.emitted, 'git').at(-1)![1] as Record<string, unknown>;
    expect(snap.cwd).toBe('/repo');
    expect(snap.type).toBe('git');
  });

  it('watch.stop unsubscribes and stops snapshot delivery', async () => {
    const transport = new FakeAgentTransport();
    new BroadcasterHandler(broadcaster).attach(transport);

    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' });
    await vi.waitUntil(() => snapshots(transport.emitted).length > 0, { timeout: 500 });

    await transport.request(REMOTE_METHODS.watch.stop, { cwd: '/repo' });
    const countBefore = transport.emitted.length;

    watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    await new Promise((r) => setTimeout(r, 50));

    expect(transport.emitted.length).toBe(countBefore);
  });

  it('watch.start for same cwd is guarded — does not create duplicate subscription', async () => {
    const transport = new FakeAgentTransport();
    new BroadcasterHandler(broadcaster).attach(transport);

    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'files').length > 0, { timeout: 500 });
    await transport.request(REMOTE_METHODS.watch.start, { cwd: '/repo' }); // duplicate
    const countAfter = snapshots(transport.emitted, 'files').length;

    watch.simulate('/repo', { type: 'change', path: 'src/foo.ts' });
    await vi.waitUntil(() => snapshots(transport.emitted, 'files').length > countAfter, {
      timeout: 500,
    });

    expect(snapshots(transport.emitted, 'files').length).toBe(countAfter + 1);
  });
});
