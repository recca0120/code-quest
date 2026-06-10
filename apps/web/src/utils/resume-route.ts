import type { SessionSummary } from '@code-quest/schemas';

type ResumeRoute =
  | { type: 'replace'; oldChannelId: string; newChannelId: string }
  | { type: 'activate'; cwd: string; channelId: string }
  | { type: 'noop' };

/** Decide what to do with a picked session after useResume() resolved.
 *
 *  - If the current ChatShell's tab is empty (no messages) AND the picked
 *    session belongs to the same project, replace the current tab in place
 *    so the user doesn't end up with two tabs for the same chat.
 *  - Otherwise, when the picked session has a cwd, route to that project
 *    via pendingActivateChannel so the right TabProvider activates it.
 *  - When cwd is missing on the picked row (shouldn't happen for persisted
 *    sessions, but possible with legacy rows), fall through to no-op.
 */
export function resumeRoute(opts: {
  isEmpty: boolean;
  currentCwd: string | null;
  currentChannelId: string | null;
  picked: SessionSummary;
  spawnedChannelId: string;
}): ResumeRoute {
  const { isEmpty, currentCwd, currentChannelId, picked, spawnedChannelId } = opts;
  const sameProject = !!picked.cwd && picked.cwd === currentCwd;
  if (isEmpty && sameProject && currentChannelId) {
    return { type: 'replace', oldChannelId: currentChannelId, newChannelId: spawnedChannelId };
  }
  if (picked.cwd) {
    return { type: 'activate', cwd: picked.cwd, channelId: spawnedChannelId };
  }
  return { type: 'noop' };
}
