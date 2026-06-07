import type { Filesystem } from '@code-quest/filesystem';
import type {
  OpenspecArchiveResult,
  OpenspecArtifactKind,
  OpenspecChangeNewResult,
  OpenspecChangeSummary,
  OpenspecKind,
  OpenspecListResult,
  OpenspecReadResult,
  OpenspecSpecSummary,
  OpenspecToggleTaskResult,
  ProcessProvider,
} from '@code-quest/schemas';
import { z } from 'zod';
import type { Openspec, OpenspecArchiveOptions } from './types.ts';

function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const { code } = err as { code: unknown };
  return typeof code === 'string' ? code : undefined;
}

const ARTIFACT_FILENAME: Record<OpenspecArtifactKind, string> = {
  proposal: 'proposal.md',
  design: 'design.md',
  tasks: 'tasks.md',
  spec: 'spec.md',
};

const OPENSPEC_KIND_DIR: Record<OpenspecKind, string> = {
  change: 'changes',
  spec: 'specs',
};

const TASK_LINE_RE = /^(\s*-\s+\[)( |x|X)(\] .*)$/;

/** Wire shape of `openspec list --json` (changes payload). */
const cliChangeSchema = z.object({
  name: z.string(),
  completedTasks: z.number().int().nonnegative(),
  totalTasks: z.number().int().nonnegative(),
  status: z.enum(['in-progress', 'complete', 'no-tasks']),
  lastModified: z.string().optional(),
});

const cliListChangesSchema = z.object({ changes: z.array(cliChangeSchema) });

/** Wire shape of `openspec spec list --json` (top-level array). */
const cliSpecSchema = z.object({ id: z.string() });
const cliSpecListSchema = z.array(cliSpecSchema);

type CliChange = z.infer<typeof cliChangeSchema>;
type CliSpec = z.infer<typeof cliSpecSchema>;

function toChangeSummary(c: CliChange): OpenspecChangeSummary {
  return {
    name: c.name,
    tasks: c.totalTasks > 0 ? { done: c.completedTasks, total: c.totalTasks } : null,
    status: c.status,
  };
}

function toSpecSummary(s: CliSpec): OpenspecSpecSummary {
  return { capability: s.id };
}

export class LocalOpenspec implements Openspec {
  /** `process` is required for changeNew + list (they spawn the openspec CLI).
   *  read/toggleTask only touch the filesystem and work without it. */
  private readonly fs: Filesystem;
  private readonly process?: ProcessProvider;

  constructor(fs: Filesystem, process?: ProcessProvider) {
    this.fs = fs;
    this.process = process;
  }

  async list(cwd: string): Promise<OpenspecListResult> {
    if (!this.process) return { error: 'process-runner-unavailable' };
    // Pre-flight: openspec CLI in an uninitialized project returns non-JSON
    // (parses as 'parse-changes-failed' downstream — confusing). Catch the
    // common case explicitly so the UI can render a friendly empty state.
    if (!(await this.fs.isDirectory(`${cwd}/openspec`))) {
      return { error: 'no-openspec' };
    }
    try {
      const [changesRaw, specsRaw] = await Promise.all([
        this.process.runOnce('openspec', ['list', '--json'], { cwd }),
        this.process.runOnce('openspec', ['spec', 'list', '--json'], { cwd }),
      ]);
      const changesParsed = cliListChangesSchema.safeParse(safeJsonParse(changesRaw.stdout));
      // `openspec spec list --json` outputs plain text when there are no specs (CLI bug).
      // Treat any non-JSON response as an empty list rather than a hard error.
      const specsJson = safeJsonParse(specsRaw.stdout) ?? [];
      const specsParsed = cliSpecListSchema.safeParse(specsJson);
      if (!changesParsed.success) return { error: 'parse-changes-failed' };
      if (!specsParsed.success) return { error: 'parse-specs-failed' };
      const changes: OpenspecChangeSummary[] = changesParsed.data.changes.map(toChangeSummary);
      const specs: OpenspecSpecSummary[] = specsParsed.data.map(toSpecSummary);
      return { changes, specs };
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return { error: 'openspec-cli-not-found' };
      throw err;
    }
  }

  async read(
    cwd: string,
    kind: OpenspecKind,
    name: string,
    artifact: OpenspecArtifactKind,
  ): Promise<OpenspecReadResult> {
    if (!isSafeName(name)) return { error: 'Invalid name' };
    const dir = OPENSPEC_KIND_DIR[kind];
    const file = ARTIFACT_FILENAME[artifact];
    const path = `${cwd}/openspec/${dir}/${name}/${file}`;
    const result = await this.fs.readFile(path);
    if ('error' in result) return { error: result.error };
    if ('tooLarge' in result) return { error: 'File too large' };
    return { content: result.content };
  }

  async changeNew(cwd: string, name: string): Promise<OpenspecChangeNewResult> {
    if (!isSlug(name)) return { error: 'invalid-name' };
    return this.runOpenspecCmd(cwd, ['new', 'change', name]);
  }

  async archive(
    cwd: string,
    name: string,
    opts: OpenspecArchiveOptions = {},
  ): Promise<OpenspecArchiveResult> {
    if (!isSlug(name)) return { error: 'invalid-name' };
    const args = ['archive', name, '-y'];
    if (opts.skipSpecs) args.push('--skip-specs');
    return this.runOpenspecCmd(cwd, args);
  }

  private async runOpenspecCmd(
    cwd: string,
    args: string[],
  ): Promise<{ ok: true } | { error: string }> {
    if (!this.process) return { error: 'process-runner-unavailable' };
    const r = await this.process.runOnce('openspec', args, { cwd });
    if (r.exitCode !== 0) {
      return { error: r.stderr.trim() || `openspec ${args[0]} exited ${r.exitCode}` };
    }
    return { ok: true };
  }

  async toggleTask(
    cwd: string,
    name: string,
    lineIndex: number,
  ): Promise<OpenspecToggleTaskResult> {
    if (!isSlug(name)) return { error: 'invalid-name' };
    const path = `${cwd}/openspec/${OPENSPEC_KIND_DIR.change}/${name}/tasks.md`;
    const read = await this.fs.readFile(path);
    if ('error' in read) return { error: read.error };
    if ('tooLarge' in read) return { error: 'File too large' };
    const lines = read.content.split('\n');
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return { error: 'line-out-of-range' };
    }
    const match = lines[lineIndex]?.match(TASK_LINE_RE);
    if (!match) return { error: 'not-a-task-line' };
    const [, prefix, mark, rest] = match;
    if (!prefix || !rest) return { error: 'not-a-task-line' };
    const checked = mark === ' ';
    lines[lineIndex] = `${prefix}${checked ? 'x' : ' '}${rest}`;
    const write = await this.fs.writeFile(path, lines.join('\n'));
    if ('error' in write) return { error: write.error };
    return { ok: true, checked };
  }
}

function isSafeName(name: string): boolean {
  return !name.includes('/') && !name.includes('\\') && !name.includes('..') && name.length > 0;
}

function isSlug(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
