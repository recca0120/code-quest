import type { Openspec, OpenspecArchiveOptions } from '@code-quest/openspec';
import type {
  OpenspecArchiveResult,
  OpenspecArtifactKind,
  OpenspecChangeNewResult,
  OpenspecChangeSummary,
  OpenspecListResult,
  OpenspecReadResult,
  OpenspecSpecSummary,
  OpenspecToggleTaskResult,
} from '@code-quest/schemas';

/** In-memory fake for `Openspec` — mirrors `FakeGit` shape.
 *  Tests seed changes/specs/file content imperatively via `setXxx` helpers;
 *  the service reads from those maps instead of touching the filesystem. */
export class FakeOpenspec implements Openspec {
  private _changes: OpenspecChangeSummary[] = [];
  private _specs: OpenspecSpecSummary[] = [];
  private _listError: string | null = null;
  /** keyed by `${cwd}|${kind}|${name}|${artifact}` */
  private _contents = new Map<string, string>();
  private _readError: string | null = null;
  private _changeNewError: string | null = null;
  private _archiveError: string | null = null;
  private _toggleTaskError: string | null = null;
  private _toggleTaskChecked = true;
  private _changeNewCalls: Array<{ cwd: string; name: string }> = [];
  private _archiveCalls: Array<{ cwd: string; name: string; skipSpecs?: boolean }> = [];
  private _toggleTaskCalls: Array<{ cwd: string; name: string; lineIndex: number }> = [];

  // ── Setup API ──

  setChanges(changes: OpenspecChangeSummary[]): void {
    this._changes = changes;
  }

  setSpecs(specs: OpenspecSpecSummary[]): void {
    this._specs = specs;
  }

  setListError(error: string | null): void {
    this._listError = error;
  }

  setContent(
    cwd: string,
    kind: 'change' | 'spec',
    name: string,
    artifact: OpenspecArtifactKind,
    content: string,
  ): void {
    this._contents.set(contentKey(cwd, kind, name, artifact), content);
  }

  setReadError(error: string | null): void {
    this._readError = error;
  }

  setChangeNewError(error: string | null): void {
    this._changeNewError = error;
  }

  setArchiveError(error: string | null): void {
    this._archiveError = error;
  }

  setToggleTaskError(error: string | null): void {
    this._toggleTaskError = error;
  }

  /** Toggle response: when set, `toggleTask` returns this `checked` value;
   *  default is `true` (line was unchecked → checked). */
  setToggleTaskChecked(checked: boolean): void {
    this._toggleTaskChecked = checked;
  }

  get changeNewCalls(): ReadonlyArray<{ cwd: string; name: string }> {
    return this._changeNewCalls;
  }

  get archiveCalls(): ReadonlyArray<{ cwd: string; name: string; skipSpecs?: boolean }> {
    return this._archiveCalls;
  }

  get toggleTaskCalls(): ReadonlyArray<{ cwd: string; name: string; lineIndex: number }> {
    return this._toggleTaskCalls;
  }

  reset(): void {
    this._changes = [];
    this._specs = [];
    this._listError = null;
    this._contents.clear();
    this._readError = null;
    this._changeNewError = null;
    this._archiveError = null;
    this._toggleTaskError = null;
    this._toggleTaskChecked = true;
    this._changeNewCalls = [];
    this._archiveCalls = [];
    this._toggleTaskCalls = [];
  }

  // ── Openspec interface ──

  async list(_cwd: string): Promise<OpenspecListResult> {
    if (this._listError) return { error: this._listError };
    return { changes: this._changes, specs: this._specs };
  }

  async read(
    cwd: string,
    kind: 'change' | 'spec',
    name: string,
    artifact: OpenspecArtifactKind,
  ): Promise<OpenspecReadResult> {
    if (this._readError) return { error: this._readError };
    const content = this._contents.get(contentKey(cwd, kind, name, artifact));
    if (content === undefined) return { error: `Not found: ${name}/${artifact}` };
    return { content };
  }

  async changeNew(cwd: string, name: string): Promise<OpenspecChangeNewResult> {
    this._changeNewCalls.push({ cwd, name });
    if (this._changeNewError) return { error: this._changeNewError };
    return { ok: true };
  }

  async archive(
    cwd: string,
    name: string,
    opts: OpenspecArchiveOptions = {},
  ): Promise<OpenspecArchiveResult> {
    this._archiveCalls.push({ cwd, name, skipSpecs: opts.skipSpecs });
    if (this._archiveError) return { error: this._archiveError };
    return { ok: true };
  }

  async toggleTask(
    cwd: string,
    name: string,
    lineIndex: number,
  ): Promise<OpenspecToggleTaskResult> {
    this._toggleTaskCalls.push({ cwd, name, lineIndex });
    if (this._toggleTaskError) return { error: this._toggleTaskError };
    return { ok: true, checked: this._toggleTaskChecked };
  }
}

function contentKey(
  cwd: string,
  kind: 'change' | 'spec',
  name: string,
  artifact: OpenspecArtifactKind,
): string {
  return `${cwd}|${kind}|${name}|${artifact}`;
}
