import { errMsg } from '@code-quest/utils';
import { GitResponseError, type SimpleGit, simpleGit } from 'simple-git';
import type { MinimalLogger } from './types.ts';

export function createGit(cwd?: string): SimpleGit {
  return simpleGit({ baseDir: cwd ?? process.cwd(), trimmed: true });
}

export async function rawGit(
  git: SimpleGit,
  args: string[],
  logger?: MinimalLogger,
): Promise<{ stdout: string; exitCode: number }> {
  try {
    const stdout = await git.raw(args);
    return { stdout, exitCode: 0 };
  } catch (err) {
    logger?.debug({ err, args: args.join(' ') }, '[Git] git raw failed');
    const fromGitField =
      err instanceof GitResponseError && typeof err.git === 'string' ? err.git : '';
    const stdout = fromGitField || errMsg(err);
    return { stdout, exitCode: 1 };
  }
}
