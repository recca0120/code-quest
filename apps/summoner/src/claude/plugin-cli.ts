import { spawn } from 'node:child_process';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { errMsg } from '@code-quest/utils';
import { logger } from '../logger.ts';

export interface PluginCliRunResult {
  stdout: string;
  stderr: string;
  ok: boolean;
}

/** Async wrapper for `claude plugin <args>`. Args go directly to `spawn`
 *  (no shell) so client-supplied values can't be shell-interpreted. */
export interface PluginCliService {
  run(args: string[]): Promise<PluginCliRunResult>;
}

interface LocalPluginCliOptions {
  /** Override the binary name. Default `'claude'`. Tests pass `'echo'`. */
  binary?: string;
  /** First positional arg, prepended to every `run(args)`. Default `'plugin'`
   *  (the only subcommand this service ever calls). Tests can pass `''` to
   *  exercise the binary directly. */
  subcommand?: string;
  /** Process timeout, ms. Default 30s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class LocalPluginCli implements PluginCliService {
  private readonly binary: string;
  private readonly subcommand: string;
  private readonly timeoutMs: number;

  constructor(opts: LocalPluginCliOptions = {}) {
    this.binary = opts.binary ?? 'claude';
    this.subcommand = opts.subcommand ?? 'plugin';
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Spawn `binary [subcommand?] ...args`, redirecting stdout to a temp
   *  file via fd. Required because the claude CLI calls `process.exit()`
   *  without waiting for stdout to drain when stdout is a pipe; bytes
   *  still in the OS pipe buffer get dropped, truncating large outputs
   *  at the buffer boundary (~16-64KB depending on macOS/Linux defaults).
   *
   *  Symptom: `plugin list --available` returned only 24576 bytes via
   *  Node spawn-with-pipe, but 90636 bytes via shell `| wc -c` — same
   *  command, different reader pacing. Aggressive `readable+read` didn't
   *  help, confirming the loss is on the writer side, not the reader.
   *
   *  Fix: pass a file fd as stdout. File writes go straight to the page
   *  cache; there's no in-flight buffer to lose on early exit. */
  async run(args: string[]): Promise<PluginCliRunResult> {
    const fullArgs = this.subcommand ? [this.subcommand, ...args] : args;
    const dir = await mkdtemp(join(tmpdir(), 'cc-plugin-cli-'));
    const outPath = join(dir, 'stdout');
    let outFh: Awaited<ReturnType<typeof open>> | null = null;
    try {
      outFh = await open(outPath, 'w');
      const result = await spawnCollect(this.binary, fullArgs, outFh.fd, this.timeoutMs);
      // Close the write fd before reading or stdout may be incomplete.
      await outFh.close();
      outFh = null;
      const stdout = await readFile(outPath, 'utf-8');
      return { stdout, stderr: result.stderr, ok: result.ok };
    } catch (err) {
      logger.error({ err, binary: this.binary, args: fullArgs }, '[LocalPluginCli] run failed');
      return { stdout: '', stderr: errMsg(err), ok: false };
    } finally {
      if (outFh) await outFh.close().catch(() => {});
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

interface SpawnCollectResult {
  stderr: string;
  ok: boolean;
}

function spawnCollect(
  binary: string,
  args: string[],
  stdoutFd: number,
  timeoutMs: number,
): Promise<SpawnCollectResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', stdoutFd, 'pipe'] });
    const stderrChunks: Buffer[] = [];
    child.stderr?.on('data', (c: Buffer) => stderrChunks.push(c));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      resolve({
        stderr: timedOut ? `[timeout ${timeoutMs}ms] ${stderr}` : stderr,
        ok: code === 0 && !timedOut,
      });
    });
  });
}
