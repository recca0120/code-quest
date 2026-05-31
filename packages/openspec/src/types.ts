import type {
  OpenspecArchiveResult,
  OpenspecArtifactKind,
  OpenspecChangeNewResult,
  OpenspecKind,
  OpenspecListResult,
  OpenspecReadResult,
  OpenspecToggleTaskResult,
} from '@code-quest/schemas';

export interface OpenspecArchiveOptions {
  /** Skip propagating the change's delta specs into the main spec tree. */
  skipSpecs?: boolean;
}

export interface Openspec {
  list(cwd: string): Promise<OpenspecListResult>;
  read(
    cwd: string,
    kind: OpenspecKind,
    name: string,
    artifact: OpenspecArtifactKind,
  ): Promise<OpenspecReadResult>;
  /** Spawn `openspec new change <name>` in cwd. */
  changeNew(cwd: string, name: string): Promise<OpenspecChangeNewResult>;
  /** Spawn `openspec archive <name> -y [--skip-specs]` in cwd. */
  archive(cwd: string, name: string, opts?: OpenspecArchiveOptions): Promise<OpenspecArchiveResult>;
  /** Read tasks.md, flip `- [ ]` ↔ `- [x]` at `lineIndex`, write back. */
  toggleTask(cwd: string, name: string, lineIndex: number): Promise<OpenspecToggleTaskResult>;
}
