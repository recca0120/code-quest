import { AlreadyRepoError, NotARepoError } from '@code-quest/git';
import type { SocketCallback, TypedSocket } from '@code-quest/schemas';
import {
  createWorktreePayloadSchema,
  EVENTS,
  gitAddPayloadSchema,
  gitCommitPayloadSchema,
  gitDiffByCwdPayloadSchema,
  gitDiscardFilePayloadSchema,
  gitFetchPayloadSchema,
  gitLogPayloadSchema,
  gitPullPayloadSchema,
  gitPushPayloadSchema,
  gitStatusByCwdPayloadSchema,
  initRepoPayloadSchema,
  listBranchesPayloadSchema,
  listWorktreesPayloadSchema,
  worktreeArchivePayloadSchema,
  worktreeCheckoutPayloadSchema,
  worktreeRenamePayloadSchema,
  worktreeStatusPayloadSchema,
} from '@code-quest/schemas';
import { errMsg } from '@code-quest/utils';
import { logger } from '../../logger.ts';
import type { HandlerContext } from '../../types.ts';
import { err, ok } from '../utils/rpc.ts';

const NOT_A_REPO = 'not_a_repo';

export function create({
  emitter,
  gitService,
}: Pick<HandlerContext, 'emitter' | 'gitService'>): void {
  const resolveProjectRoot = (cwd: string): Promise<string | null> =>
    gitService.getProjectRoot(cwd).catch((err) => {
      logger.debug({ err, cwd }, 'getProjectRoot failed, falling back to null');
      return null;
    });

  function broadcastDirty(cwd: string): void {
    emitter.broadcastAll(EVENTS.git.dirty, { cwd });
  }

  async function handleInit(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = initRepoPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const res = await gitService.initRepo(parsed.data.cwd);
      emitter.broadcastAll(EVENTS.worktree.added, {
        projectCwd: parsed.data.cwd,
        worktree: { name: 'main', path: parsed.data.cwd, branch: res.branch },
      });
      callback?.(ok({ branch: res.branch }));
    } catch (e) {
      if (e instanceof AlreadyRepoError) {
        callback?.(err('already_a_repo'));
        return;
      }
      callback?.(err(errMsg(e, 'Failed to initialize repo')));
    }
  }

  async function handleBranches(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = listBranchesPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const projectRoot = await gitService.getProjectRoot(parsed.data.cwd);
      if (!projectRoot) {
        callback?.(err(NOT_A_REPO));
        return;
      }
      callback?.(ok({ branches: await gitService.listBranches(projectRoot) }));
    } catch (e) {
      if (e instanceof NotARepoError) {
        callback?.(err(NOT_A_REPO));
        return;
      }
      callback?.(err(errMsg(e, 'Failed to list branches')));
    }
  }

  async function handleCheckout(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = worktreeCheckoutPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    const { cwd, branch } = parsed.data;
    try {
      const projectRoot = await gitService.getProjectRoot(cwd);
      if (!projectRoot) {
        callback?.(err(NOT_A_REPO));
        return;
      }
      await gitService.checkout(cwd, branch);
      emitter.broadcastAll(EVENTS.worktree.branchChanged, {
        projectCwd: projectRoot,
        worktreePath: cwd,
        branch,
      });
      callback?.(ok({ branch }));
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to checkout')));
    }
  }

  async function handleStatus(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd } = gitStatusByCwdPayloadSchema.parse(payload);

      callback?.(await gitService.status(cwd));
    } catch (e) {
      if (e instanceof NotARepoError) {
        callback?.({ notARepo: true });
        return;
      }
      callback?.({ error: errMsg(e, 'Status failed') });
    }
  }

  async function handleStatusSummary(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = worktreeStatusPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const cwd = parsed.data.cwd;
      const [status, diffStat] = await Promise.all([
        gitService.status(cwd),
        gitService.diffStat(cwd),
      ]);
      callback?.(
        ok({
          branch: status.branch,
          isClean: status.isClean,
          changedFilesCount: status.changedFiles.length,
          insertions: diffStat.totalInsertions,
          deletions: diffStat.totalDeletions,
        }),
      );
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to get status')));
    }
  }

  async function handleDiff(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd, filePath, status } = gitDiffByCwdPayloadSchema.parse(payload);

      callback?.(await gitService.diff(cwd, filePath, status));
    } catch (e) {
      callback?.({ error: errMsg(e, 'Diff failed') });
    }
  }

  async function handleLog(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd, limit } = gitLogPayloadSchema.parse(payload);

      callback?.(await gitService.log(cwd, limit));
    } catch (e) {
      logger.warn({ err: e }, 'Failed to get git log');
      callback?.({ error: errMsg(e, 'Failed to get git log') });
    }
  }

  async function handleAdd(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd, paths } = gitAddPayloadSchema.parse(payload);

      const result = await gitService.add(cwd, paths);
      if ('ok' in result) broadcastDirty(cwd);
      callback?.(result);
    } catch (e) {
      callback?.({ error: errMsg(e, 'Add failed') });
    }
  }

  async function handleCommit(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd, message } = gitCommitPayloadSchema.parse(payload);

      const result = await gitService.commit(cwd, message);
      if ('ok' in result) broadcastDirty(cwd);
      callback?.(result);
    } catch (e) {
      callback?.({ error: errMsg(e, 'Commit failed') });
    }
  }

  async function handlePush(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd } = gitPushPayloadSchema.parse(payload);

      callback?.(await gitService.push(cwd));
    } catch (e) {
      callback?.({ error: errMsg(e, 'Push failed') });
    }
  }

  async function handleFetch(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd } = gitFetchPayloadSchema.parse(payload);

      callback?.(await gitService.fetch(cwd));
    } catch (e) {
      callback?.({ error: errMsg(e, 'Fetch failed') });
    }
  }

  async function handlePull(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd } = gitPullPayloadSchema.parse(payload);

      callback?.(await gitService.pull(cwd));
    } catch (e) {
      callback?.({ error: errMsg(e, 'Pull failed') });
    }
  }

  async function handleDiscardFile(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    try {
      const { cwd, file } = gitDiscardFilePayloadSchema.parse(payload);

      callback?.(await gitService.discardFile(cwd, file));
    } catch (e) {
      callback?.({ error: errMsg(e, 'Discard failed') });
    }
  }

  async function handleWorktreeList(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = listWorktreesPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const projectRoot = await gitService.getProjectRoot(parsed.data.cwd);
      if (!projectRoot) {
        callback?.(err(NOT_A_REPO));
        return;
      }
      callback?.(ok({ worktrees: await gitService.listWorktrees(projectRoot) }));
    } catch (e) {
      if (e instanceof NotARepoError) {
        callback?.(err(NOT_A_REPO));
        return;
      }
      callback?.(err(errMsg(e, 'Failed to list worktrees')));
    }
  }

  async function handleWorktreeAdd(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = createWorktreePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    const { cwd, name, existingBranch, newBranch, baseBranch, path } = parsed.data;
    const projectRoot = await resolveProjectRoot(cwd);
    if (!projectRoot) {
      callback?.(err('Not inside a git repository'));
      return;
    }
    try {
      const info = await gitService.createWorktree(projectRoot, {
        name,
        existingBranch,
        newBranch,
        baseBranch,
        path,
      });
      emitter.broadcastAll(EVENTS.worktree.added, { projectCwd: projectRoot, worktree: info });
      callback?.(ok({ worktreePath: info.path, name: info.name, branch: info.branch }));
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to create worktree')));
    }
  }

  async function handleWorktreeRemove(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = worktreeArchivePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const result = await gitService.archiveWorktree(parsed.data.projectCwd, parsed.data.name, {
        force: parsed.data.force ?? false,
      });
      if ('ok' in result) {
        emitter.broadcastAll(EVENTS.worktree.removed, {
          projectCwd: parsed.data.projectCwd,
          name: parsed.data.name,
        });
      }
      callback?.(result);
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to remove worktree')));
    }
  }

  async function handleWorktreeRename(
    _ch: unknown,
    payload: unknown,
    _socket?: TypedSocket,
    callback?: SocketCallback,
  ): Promise<void> {
    const parsed = worktreeRenamePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      callback?.(err(parsed.error.message));
      return;
    }
    try {
      const { branch } = await gitService.renameWorktree(
        parsed.data.cwd,
        parsed.data.newBranchName,
      );
      const projectRoot = await gitService.getProjectRoot(parsed.data.cwd);
      if (projectRoot) {
        emitter.broadcastAll(EVENTS.worktree.branchChanged, {
          projectCwd: projectRoot,
          worktreePath: parsed.data.cwd,
          branch,
        });
      }
      callback?.(ok({ branch }));
    } catch (e) {
      callback?.(err(errMsg(e, 'Failed to rename worktree')));
    }
  }

  emitter.on(EVENTS.git.init, handleInit);
  emitter.on(EVENTS.git.branches, handleBranches);
  emitter.on(EVENTS.git.checkout, handleCheckout);
  emitter.on(EVENTS.git.status, handleStatus);
  emitter.on(EVENTS.git.statusSummary, handleStatusSummary);
  emitter.on(EVENTS.git.diff, handleDiff);
  emitter.on(EVENTS.git.log, handleLog);
  emitter.on(EVENTS.git.add, handleAdd);
  emitter.on(EVENTS.git.commit, handleCommit);
  emitter.on(EVENTS.git.push, handlePush);
  emitter.on(EVENTS.git.fetch, handleFetch);
  emitter.on(EVENTS.git.pull, handlePull);
  emitter.on(EVENTS.git.discardFile, handleDiscardFile);
  emitter.on(EVENTS.git.worktree.list, handleWorktreeList);
  emitter.on(EVENTS.git.worktree.add, handleWorktreeAdd);
  emitter.on(EVENTS.git.worktree.remove, handleWorktreeRemove);
  emitter.on(EVENTS.git.worktree.rename, handleWorktreeRename);
}
