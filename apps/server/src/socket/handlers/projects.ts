import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Filesystem } from '@code-quest/filesystem';
import { PathOutsideRootsError } from '@code-quest/filesystem';
import {
  EVENTS,
  type ProjectsError,
  type ProjectsRemoveResponse,
  type ProjectsUpdateResponse,
  projectsAddPayloadSchema,
  projectsListPayloadSchema,
  projectsRemovePayloadSchema,
  projectsUpdatePayloadSchema,
  type SocketCallback,
  type TypedSocket,
} from '@code-quest/schemas';
import { errMsg } from '@code-quest/utils';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';

function canonicalize(path: string): string {
  if (path.startsWith('~')) return resolve(homedir(), path.slice(1).replace(/^\/+/, ''));
  return resolve(path);
}

async function validateAddPath(fs: Filesystem, path: string): Promise<ProjectsError | null> {
  try {
    const kind = await fs.statKind(path);
    if (kind === null) return { error: 'path_not_found', path };
    if (kind !== 'directory') return { error: 'path_not_directory', path };
    return null;
  } catch (e) {
    if (e instanceof PathOutsideRootsError) return { error: 'path_outside_roots', path };
    return { error: 'path_not_found', path };
  }
}

export function create({
  emitter,
  projectStore,
  filesystemService: fs,
  channelManager,
}: Pick<
  HandlerContext,
  'emitter' | 'projectStore' | 'filesystemService' | 'channelManager'
>): void {
  async function handleList(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      projectsListPayloadSchema.parse(payload);
      const projects = await projectStore.list();
      callback?.({ projects });
    } catch (err) {
      logger.warn({ err }, 'Failed to list projects');
      callback?.({ error: errMsg(err, 'Failed to list projects') });
    }
  }

  async function handleAdd(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { path: rawPath } = projectsAddPayloadSchema.parse(payload);
      const path = canonicalize(rawPath);
      const error = await validateAddPath(fs, path);
      if (error) {
        callback?.(error);
        return;
      }
      const project = await projectStore.upsert(path);
      emitter.broadcastAll(EVENTS.projects.added, project);
      callback?.(project);
    } catch (err) {
      logger.warn({ err }, 'Failed to add project');
      callback?.({ error: 'invalid_payload' });
    }
  }

  // Asymmetry by design: `projects:add` is gated by isWithinRoots, but
  // `projects:update` and `projects:remove` are NOT. Once a project is in the
  // DB, users must remain able to rename/pin/clean it up even after admin
  // shrinks EXPLORER_ROOTS — otherwise legacy entries become unmanageable.
  async function handleUpdate(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { id, patch } = projectsUpdatePayloadSchema.parse(payload);
      const updated = await projectStore.update(id, patch);
      if (!updated) {
        const res: ProjectsUpdateResponse = { error: 'project_not_found' };
        callback?.(res);
        return;
      }
      emitter.broadcastAll(EVENTS.projects.updated, updated);
      callback?.(updated);
    } catch (err) {
      logger.warn({ err }, 'Failed to update project');
      callback?.({ error: 'invalid_payload' });
    }
  }

  async function handleRemove(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { id } = projectsRemovePayloadSchema.parse(payload);
      const existing = await projectStore.getById(id);
      if (!existing) {
        const res: ProjectsRemoveResponse = { error: 'project_not_found' };
        callback?.(res);
        return;
      }
      // Reject only if a LIVE channel currently runs in this project. We
      // intentionally consult ChannelManager (in-memory, source of truth for
      // running processes) rather than sessionStore — DB rows can carry stale
      // status='active' across server restarts and would otherwise block
      // removal of projects whose processes died long ago.
      const aliveForPath = channelManager
        .getAliveChannels()
        .filter(([, ch]) => (ch.projectRoot ?? ch.cwd) === existing.path);
      if (aliveForPath.length > 0) {
        const res: ProjectsRemoveResponse = {
          error: 'project_has_active_sessions',
          activeSessionCount: aliveForPath.length,
        };
        callback?.(res);
        return;
      }
      await projectStore.remove(id);
      emitter.broadcastAll(EVENTS.projects.removed, { id, path: existing.path });
      callback?.({ ok: true });
    } catch (err) {
      logger.warn({ err }, 'Failed to remove project');
      callback?.({ error: 'invalid_payload' });
    }
  }

  emitter.on(EVENTS.projects.list, handleList);
  emitter.on(EVENTS.projects.add, handleAdd);
  emitter.on(EVENTS.projects.update, handleUpdate);
  emitter.on(EVENTS.projects.remove, handleRemove);
}
