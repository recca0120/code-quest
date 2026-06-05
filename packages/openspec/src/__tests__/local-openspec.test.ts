import { FakeFilesystem, FakeProcessProvider } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { LocalOpenspec } from '../local-openspec.ts';

function setup({ seedOpenspecDir = true } = {}) {
  const fs = new FakeFilesystem();
  fs.fromTree('/repo', seedOpenspecDir ? { openspec: {} } : {});
  const process = new FakeProcessProvider();
  return { fs, process, reader: new LocalOpenspec(fs, process) };
}

/** CLI-output factories — keeps tests readable without repeating literal JSON. */
function changeJson(
  name: string,
  opts: { done?: number; total?: number; status?: 'in-progress' | 'complete' } = {},
) {
  return {
    name,
    completedTasks: opts.done ?? 0,
    totalTasks: opts.total ?? 0,
    status: opts.status ?? 'in-progress',
    lastModified: '2026-04-24T00:00:00.000Z',
  };
}

function enqueueListResponses(
  process: FakeProcessProvider,
  changes: ReturnType<typeof changeJson>[],
  specs: { id: string }[],
): void {
  process.enqueueRunOnce({
    exitCode: 0,
    stdout: JSON.stringify({ changes }),
    stderr: '',
  });
  process.enqueueRunOnce({
    exitCode: 0,
    stdout: JSON.stringify(specs),
    stderr: '',
  });
}

describe('LocalOpenspec', () => {
  describe('list', () => {
    it('returns empty changes/specs when CLI reports none', async () => {
      const { process, reader } = setup();
      enqueueListResponses(process, [], []);
      const result = await reader.list('/repo');
      expect(result).toEqual({ changes: [], specs: [] });
    });

    it('returns no-openspec error when project has no openspec/ directory', async () => {
      const { reader } = setup({ seedOpenspecDir: false });
      const result = await reader.list('/repo');
      expect(result).toEqual({ error: 'no-openspec' });
    });

    it('does not call the CLI when openspec/ is missing', async () => {
      const { process, reader } = setup({ seedOpenspecDir: false });
      await reader.list('/repo');
      expect(process.runOnceCalls.length).toBe(0);
    });

    it('parses `openspec list --json` for changes (task counts + status)', async () => {
      const { process, reader } = setup();
      enqueueListResponses(
        process,
        [changeJson('add-foo', { done: 1, total: 2, status: 'in-progress' })],
        [{ id: 'auth' }],
      );

      const result = await reader.list('/repo');
      if ('error' in result) throw new Error('unexpected error');
      expect(result.changes).toEqual([
        { name: 'add-foo', tasks: { done: 1, total: 2 }, status: 'in-progress' },
      ]);
      expect(result.specs).toEqual([{ capability: 'auth' }]);
    });

    it('change with totalTasks=0 → tasks: null', async () => {
      const { process, reader } = setup();
      enqueueListResponses(
        process,
        [changeJson('no-tasks', { done: 0, total: 0, status: 'in-progress' })],
        [],
      );
      const result = await reader.list('/repo');
      if ('error' in result) throw new Error('unexpected error');
      expect(result.changes[0]!.tasks).toBeNull();
    });

    it('accepts CLI status "no-tasks" (third value beyond in-progress/complete)', async () => {
      const { process, reader } = setup();
      // openspec list --json reports status='no-tasks' for changes that have
      // no tasks.md or zero tasks declared.
      process.enqueueRunOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          changes: [
            {
              name: 'no-tasks-change',
              completedTasks: 0,
              totalTasks: 0,
              status: 'no-tasks',
              lastModified: '2026-04-24T00:00:00.000Z',
            },
          ],
        }),
        stderr: '',
      });
      process.enqueueRunOnce({ exitCode: 0, stdout: '[]', stderr: '' });
      const result = await reader.list('/repo');
      if ('error' in result) throw new Error(result.error);
      expect(result.changes[0]).toEqual({
        name: 'no-tasks-change',
        tasks: null,
        status: 'no-tasks',
      });
    });

    it('spawns `openspec list --json` and `openspec spec list --json` in cwd', async () => {
      const { process, reader } = setup();
      enqueueListResponses(process, [], []);
      await reader.list('/repo');
      expect(process.runOnceCalls).toEqual([
        { command: 'openspec', args: ['list', '--json'], options: { cwd: '/repo' } },
        { command: 'openspec', args: ['spec', 'list', '--json'], options: { cwd: '/repo' } },
      ]);
    });

    it('returns openspec-cli-not-found when the binary is missing (ENOENT)', async () => {
      const { reader: _reader } = setup();
      // Replace process with one that throws ENOENT on runOnce
      const failing = new FakeProcessProvider();
      failing.enqueueRunOnce({ exitCode: 0, stdout: '', stderr: '' });
      const fs = new FakeFilesystem();
      fs.fromTree('/repo', { openspec: {} });
      const broken = new LocalOpenspec(fs, {
        spawn: () => {
          throw new Error('not used');
        },
        runOnce: async () => {
          throw Object.assign(new Error('spawn openspec ENOENT'), { code: 'ENOENT' });
        },
      });
      const result = await broken.list('/repo');
      expect(result).toEqual({ error: 'openspec-cli-not-found' });
      expect(failing.runOnceCalls).toHaveLength(0);
    });

    it('surfaces parse error when CLI returns non-JSON', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 0, stdout: 'not json', stderr: '' });
      const result = await reader.list('/repo');
      expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('treats "No items found" spec list output as empty specs (CLI bug workaround)', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({
        exitCode: 0,
        stdout: JSON.stringify({ changes: [] }),
        stderr: '',
      });
      process.enqueueRunOnce({ exitCode: 0, stdout: 'No items found', stderr: '' });
      const result = await reader.list('/repo');
      expect(result).toEqual({ changes: [], specs: [] });
    });

    it('treats "No specs found." spec list output as empty specs (CLI bug workaround)', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({
        exitCode: 0,
        stdout: JSON.stringify({ changes: [] }),
        stderr: '',
      });
      process.enqueueRunOnce({ exitCode: 0, stdout: 'No specs found.', stderr: '' });
      const result = await reader.list('/repo');
      expect(result).toEqual({ changes: [], specs: [] });
    });
  });

  describe('read', () => {
    it('reads a change artifact', async () => {
      const { fs, reader } = setup();
      fs.fromTree('/repo', { openspec: { changes: { x: { 'proposal.md': '# X proposal' } } } });

      const result = await reader.read('/repo', 'change', 'x', 'proposal');
      expect(result).toMatchObject({ content: '# X proposal' });
    });

    it('returns error for missing artifact', async () => {
      const { reader } = setup();
      const result = await reader.read('/repo', 'change', 'missing', 'proposal');
      expect(result).toMatchObject({ error: expect.any(String) });
    });

    it('rejects path traversal', async () => {
      const { reader } = setup();
      const result = await reader.read('/repo', 'change', '../../etc/passwd', 'proposal');
      expect(result).toMatchObject({ error: expect.any(String) });
    });
  });

  describe('changeNew', () => {
    it('spawns `openspec new change <name>` in cwd on success', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 0, stdout: '', stderr: '' });
      const result = await reader.changeNew('/repo', 'add-foo');
      expect(result).toEqual({ ok: true });
      expect(process.runOnceCalls).toEqual([
        { command: 'openspec', args: ['new', 'change', 'add-foo'], options: { cwd: '/repo' } },
      ]);
    });

    it('returns error on non-zero exit (prefers stderr)', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 1, stdout: '', stderr: 'change already exists' });
      const result = await reader.changeNew('/repo', 'dup');
      expect(result).toEqual({ error: 'change already exists' });
    });

    it('rejects invalid slug without spawning', async () => {
      const { process, reader } = setup();
      const result = await reader.changeNew('/repo', 'BadName');
      expect(result).toEqual({ error: 'invalid-name' });
      expect(process.runOnceCalls).toHaveLength(0);
    });

    it('returns process-runner-unavailable when no ProcessProvider injected', async () => {
      const fs = new FakeFilesystem();
      const reader = new LocalOpenspec(fs);
      const result = await reader.changeNew('/repo', 'ok-name');
      expect(result).toEqual({ error: 'process-runner-unavailable' });
    });
  });

  describe('archive', () => {
    it('spawns `openspec archive <name> -y` in cwd on success', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 0, stdout: '', stderr: '' });
      const result = await reader.archive('/repo', 'add-foo');
      expect(result).toEqual({ ok: true });
      expect(process.runOnceCalls).toEqual([
        { command: 'openspec', args: ['archive', 'add-foo', '-y'], options: { cwd: '/repo' } },
      ]);
    });

    it('appends --skip-specs when skipSpecs=true', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 0, stdout: '', stderr: '' });
      await reader.archive('/repo', 'add-foo', { skipSpecs: true });
      expect(process.runOnceCalls[0]!.args).toEqual(['archive', 'add-foo', '-y', '--skip-specs']);
    });

    it('returns error on non-zero exit (prefers stderr)', async () => {
      const { process, reader } = setup();
      process.enqueueRunOnce({ exitCode: 1, stdout: '', stderr: 'change still has open tasks' });
      expect(await reader.archive('/repo', 'incomplete')).toEqual({
        error: 'change still has open tasks',
      });
    });

    it('rejects invalid slug without spawning', async () => {
      const { process, reader } = setup();
      const result = await reader.archive('/repo', 'BadName');
      expect(result).toEqual({ error: 'invalid-name' });
      expect(process.runOnceCalls).toHaveLength(0);
    });

    it('returns process-runner-unavailable when no ProcessProvider injected', async () => {
      const fs = new FakeFilesystem();
      const reader = new LocalOpenspec(fs);
      expect(await reader.archive('/repo', 'ok-name')).toEqual({
        error: 'process-runner-unavailable',
      });
    });
  });

  describe('toggleTask', () => {
    function seedTasks(fs: FakeFilesystem, content: string) {
      fs.fromTree('/repo', {
        openspec: {
          changes: {
            'add-foo': {
              'tasks.md': content,
            },
          },
        },
      });
    }

    it('flips `- [ ]` → `- [x]` at lineIndex and writes back', async () => {
      const { fs, reader } = setup();
      seedTasks(fs, '- [ ] one\n- [ ] two\n');
      const result = await reader.toggleTask('/repo', 'add-foo', 1);
      expect(result).toEqual({ ok: true, checked: true });
      const read = await fs.readFile('/repo/openspec/changes/add-foo/tasks.md');
      if ('error' in read || 'tooLarge' in read) throw new Error('unexpected result');
      expect(read.content).toBe('- [ ] one\n- [x] two\n');
    });

    it('flips `- [x]` → `- [ ]` and reports checked=false', async () => {
      const { fs, reader } = setup();
      seedTasks(fs, '- [x] done\n');
      const result = await reader.toggleTask('/repo', 'add-foo', 0);
      expect(result).toEqual({ ok: true, checked: false });
      const read = await fs.readFile('/repo/openspec/changes/add-foo/tasks.md');
      if ('error' in read || 'tooLarge' in read) throw new Error('unexpected result');
      expect(read.content).toBe('- [ ] done\n');
    });

    it('returns not-a-task-line when the target line is plain text', async () => {
      const { fs, reader } = setup();
      seedTasks(fs, '## Heading\n- [ ] one\n');
      expect(await reader.toggleTask('/repo', 'add-foo', 0)).toEqual({ error: 'not-a-task-line' });
    });

    it('returns line-out-of-range when lineIndex exceeds file length', async () => {
      const { fs, reader } = setup();
      seedTasks(fs, '- [ ] only\n');
      expect(await reader.toggleTask('/repo', 'add-foo', 99)).toEqual({
        error: 'line-out-of-range',
      });
    });

    it('rejects invalid slug', async () => {
      const { reader } = setup();
      expect(await reader.toggleTask('/repo', '../escape', 0)).toEqual({ error: 'invalid-name' });
    });

    it('surfaces read error when tasks.md is missing', async () => {
      const { reader } = setup();
      const result = await reader.toggleTask('/repo', 'add-foo', 0);
      expect(result).toMatchObject({ error: expect.any(String) });
    });
  });
});
