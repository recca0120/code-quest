import type { PluginCliRunResult, PluginCliService } from '../claude/plugin-cli.ts';

/** In-memory PluginCliService for tests. Programmable per-args via `setResult`;
 *  any unprogrammed args returns ok=false. Records every invocation in `calls`. */
export class FakePluginCli implements PluginCliService {
  readonly calls: string[][] = [];
  private results = new Map<string, PluginCliRunResult>();

  setResult(args: string[], result: Partial<PluginCliRunResult> & { stdout?: string }): void {
    this.results.set(args.join(' '), {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      ok: result.ok ?? true,
    });
  }

  async run(args: string[]): Promise<PluginCliRunResult> {
    this.calls.push(args);
    return this.results.get(args.join(' ')) ?? { stdout: '', stderr: '', ok: false };
  }
}
