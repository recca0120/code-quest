import type { SpawnOptions } from 'node:child_process';
import type { ProcessHandle, ProcessProvider, ProcessRunResult } from '@code-quest/schemas';
import {
  processExitEventSchema,
  processLineEventSchema,
  REMOTE_METHODS,
} from '@code-quest/schemas';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.ts';
import type { RemoteRpcWithEvents } from './types.ts';

const DONE_RESULT: IteratorReturnResult<undefined> = { value: undefined, done: true };

class LineStream implements AsyncIterable<string> {
  readonly stderrLines: string[] = [];
  readonly exitCode: Promise<number | null>;
  private resolveExitCode!: (code: number | null) => void;
  private readonly unsubscribers: Array<() => void> = [];
  private readonly onExit?: (code: number | null) => void;

  constructor(
    rpc: RemoteRpcWithEvents,
    sessionId: string,
    signal: AbortSignal,
    onExit?: (code: number | null) => void,
  ) {
    this.onExit = onExit;
    this.exitCode = new Promise<number | null>((r) => {
      this.resolveExitCode = r;
    });

    this.unsubscribers.push(
      rpc.on(REMOTE_METHODS.process.stdout, (data) => {
        const parsed = processLineEventSchema.safeParse(data);
        if (parsed.success && parsed.data.sessionId === sessionId) this.enqueue(parsed.data.line);
      }),
      rpc.on(REMOTE_METHODS.process.stderr, (data) => {
        const parsed = processLineEventSchema.safeParse(data);
        if (parsed.success && parsed.data.sessionId === sessionId)
          this.stderrLines.push(parsed.data.line);
      }),
      rpc.on(REMOTE_METHODS.process.exit, (data) => {
        const parsed = processExitEventSchema.safeParse(data);
        if (parsed.success && parsed.data.sessionId === sessionId) this.finish(parsed.data.code);
      }),
    );

    const onAbort = () => this.finish(null);
    signal.addEventListener('abort', onAbort);
    this.unsubscribers.push(() => signal.removeEventListener('abort', onAbort));

    if (signal.aborted) this.finish(null);
  }

  private queue: string[] = [];
  private done = false;
  private resolve: (() => void) | null = null;

  private enqueue(line: string): void {
    this.queue.push(line);
    this.resolve?.();
    this.resolve = null;
  }

  private finish(code: number | null): void {
    if (this.done) return;
    this.done = true;
    this.onExit?.(code);
    this.resolveExitCode(code);
    this.resolve?.();
    this.resolve = null;
  }

  private cleanup(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: async () => {
        while (this.queue.length === 0 && !this.done) {
          await new Promise<void>((r) => {
            this.resolve = r;
          });
        }
        if (this.queue.length > 0) {
          const value = this.queue.shift() ?? '';
          return { value, done: false };
        }
        this.cleanup();
        return DONE_RESULT;
      },
      return: () => {
        this.done = true;
        this.resolveExitCode(null);
        this.cleanup();
        return Promise.resolve(DONE_RESULT);
      },
    };
  }
}

export class RemoteProcessProvider implements ProcessProvider {
  private readonly rpc: RemoteRpcWithEvents;

  constructor(rpc: RemoteRpcWithEvents) {
    this.rpc = rpc;
  }

  spawn(command: string, args: string[], options?: SpawnOptions): ProcessHandle {
    const { sessionId, controller, stream } = this.startProcess(command, args, options);

    const rpc = this.rpc;
    return {
      lines: stream,
      signal: controller.signal,
      send(raw: string): void {
        rpc.request(REMOTE_METHODS.process.stdin, { sessionId, data: raw }).catch((e) => {
          logger.warn({ err: e, sessionId }, 'process/stdin failed');
        });
      },
      abort(): void {
        controller.abort();
        rpc.request(REMOTE_METHODS.process.kill, { sessionId }).catch((e) => {
          logger.warn({ err: e, sessionId }, 'process/kill failed');
        });
      },
    };
  }

  async runOnce(
    command: string,
    args: string[],
    options?: SpawnOptions,
  ): Promise<ProcessRunResult> {
    const { stream } = this.startProcess(command, args, options);

    const collected: string[] = [];
    for await (const line of stream) {
      collected.push(line);
    }
    const code = await stream.exitCode;
    return { exitCode: code, stdout: collected.join('\n'), stderr: stream.stderrLines.join('\n') };
  }

  private startProcess(
    command: string,
    args: string[],
    options?: SpawnOptions,
  ): { sessionId: string; controller: AbortController; stream: LineStream } {
    const sessionId = uuidv4();
    const controller = new AbortController();
    const stream = new LineStream(this.rpc, sessionId, controller.signal, (code) => {
      if (!controller.signal.aborted) controller.abort(code ?? undefined);
    });
    this.fireSpawn(sessionId, command, args, options, controller);
    return { sessionId, controller, stream };
  }

  private fireSpawn(
    sessionId: string,
    command: string,
    args: string[],
    options: SpawnOptions | undefined,
    controller: AbortController,
  ): void {
    this.rpc
      .request<{ ok: true }>(REMOTE_METHODS.process.spawn, {
        sessionId,
        command,
        args,
        cwd: options?.cwd?.toString(),
        env: options?.env
          ? Object.fromEntries(
              Object.entries(options.env).filter((e): e is [string, string] => e[1] != null),
            )
          : undefined,
      })
      .catch((e) => {
        logger.warn({ err: e, sessionId }, 'process/spawn failed');
        controller.abort();
      });
  }
}
