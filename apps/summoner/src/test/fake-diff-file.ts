import type { DiffFile } from '@code-quest/diff-file';

/** In-memory DiffFile for tests. Seed contents via `set`; unseeded
 *  paths return '' (matches LocalDiffFile's missing-file behavior). */
export class FakeDiffFile implements DiffFile {
  readonly calls: string[] = [];
  private contents = new Map<string, string>();

  set(path: string, content: string): void {
    this.contents.set(path, content);
  }

  async read(path: string): Promise<string> {
    this.calls.push(path);
    return this.contents.get(path) ?? '';
  }
}
