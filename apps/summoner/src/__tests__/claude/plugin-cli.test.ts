import { describe, expect, it } from 'vitest';
import { LocalPluginCli } from '../../claude/plugin-cli.ts';

describe('LocalPluginCli', () => {
  it('run resolves with stdout/ok=true for a successful command', async () => {
    const svc = new LocalPluginCli({ binary: 'echo' });
    const result = await svc.run(['hello']);
    expect(result.ok).toBe(true);
    // Service prepends `plugin` (binary's first subcommand) since callers
    // identify themselves via service name, not by repeating "plugin".
    expect(result.stdout.trim()).toBe('plugin hello');
  });

  it('prepends the `plugin` subcommand so callers pass only sub-args', async () => {
    // Regression for: callers were doing svc.run(['list', '--json']) and
    // hitting `unknown option '--json'` because the actual claude CLI is
    // `claude plugin list --json` — the `plugin` subcommand had been
    // silently dropped after the service moved from server to summoner.
    const svc = new LocalPluginCli({ binary: 'echo' });
    const result = await svc.run(['list', '--json']);
    expect(result.stdout.trim()).toBe('plugin list --json');
  });

  it('run resolves with ok=false AND surfaces the error message when binary is missing', async () => {
    const svc = new LocalPluginCli({ binary: 'this-does-not-exist-xyz' });
    const result = await svc.run(['list']);
    expect(result.ok).toBe(false);
    // Without the error info, callers can't distinguish ENOENT from a CLI
    // non-zero exit — UI shows a generic "Failed" toast and operators have
    // nothing to triage with.
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it('child sees a regular file at stdout, not a pipe (workaround for claude CLI early-exit truncation)', async () => {
    // Regression for: claude CLI process.exit()s without waiting for
    // stdout to drain when stdout is a pipe; bytes still in the OS pipe
    // buffer get dropped (real-world: 24576/49120/57304 bytes via Node
    // spawn-pipe, vs 90636 via shell `| wc -c` — same command, different
    // reader pacing). Passing a file fd as stdout bypasses the in-flight
    // buffer entirely. Pin the workaround structurally.
    const svc = new LocalPluginCli({ binary: 'node', subcommand: '' });
    const result = await svc.run([
      '-e',
      'const t=require("fs").fstatSync(1);process.stdout.write(t.isFile()?"file":t.isFIFO()?"pipe":"other")',
    ]);
    expect(result.ok).toBe(true);
    expect(result.stdout).toBe('file');
  });

  it('round-trips large stdout (>256KB) intact', async () => {
    const svc = new LocalPluginCli({ binary: 'node', subcommand: '' });
    const SIZE = 256 * 1024;
    const result = await svc.run(['-e', `process.stdout.write("x".repeat(${SIZE}))`]);
    expect(result.ok).toBe(true);
    expect(result.stdout.length).toBe(SIZE);
  });

  it('does NOT shell-interpret args (security: no command injection)', async () => {
    const svc = new LocalPluginCli({ binary: 'echo' });
    // If args were shell-interpolated the `;` would terminate echo and
    // run a second command. With execFile (no shell) the literal string
    // round-trips through the single argv slot.
    const result = await svc.run(['hello;', 'echo', 'pwned']);
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('hello;');
    expect(result.stdout).toContain('echo');
    expect(result.stdout).toContain('pwned');
  });
});
