import type { Git } from '@code-quest/git';
import type { AgentTransport } from '@code-quest/schemas';
import {
  gitAddParamsSchema,
  gitArchiveWorktreeParamsSchema,
  gitCheckoutParamsSchema,
  gitCommitParamsSchema,
  gitCreateWorktreeParamsSchema,
  gitCwdParamsSchema,
  gitDeleteWorktreeParamsSchema,
  gitDiffParamsSchema,
  gitDiscardFileParamsSchema,
  gitListBranchesParamsSchema,
  gitListWorktreesParamsSchema,
  gitLogParamsSchema,
  gitRenameWorktreeParamsSchema,
  REMOTE_METHODS,
} from '@code-quest/schemas';
import type { AgentHandler } from '../agent-handler.ts';

function parseCwd(p: unknown): string {
  return gitCwdParamsSchema.parse(p).cwd;
}

export class GitHandler implements AgentHandler {
  private readonly git: Git;

  constructor(git: Git) {
    this.git = git;
  }

  attach(rpc: AgentTransport): void {
    const git = this.git;

    rpc.onRequest(REMOTE_METHODS.git.status, async (p) => git.status(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.checkout, async (p) => {
      const { cwd, branch } = gitCheckoutParamsSchema.parse(p);
      await git.checkout(cwd, branch);
      return { ok: true };
    });
    rpc.onRequest(REMOTE_METHODS.git.log, async (p) => {
      const { cwd, limit } = gitLogParamsSchema.parse(p);
      return git.log(cwd, limit);
    });
    rpc.onRequest(REMOTE_METHODS.git.diff, async (p) => {
      const { cwd, filePath, status } = gitDiffParamsSchema.parse(p);
      return git.diff(cwd, filePath, status);
    });
    rpc.onRequest(REMOTE_METHODS.git.add, async (p) => {
      const { cwd, paths } = gitAddParamsSchema.parse(p);
      return git.add(cwd, paths);
    });
    rpc.onRequest(REMOTE_METHODS.git.commit, async (p) => {
      const { cwd, message } = gitCommitParamsSchema.parse(p);
      return git.commit(cwd, message);
    });
    rpc.onRequest(REMOTE_METHODS.git.push, async (p) => git.push(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.fetch, async (p) => git.fetch(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.pull, async (p) => git.pull(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.discardFile, async (p) => {
      const { cwd, file } = gitDiscardFileParamsSchema.parse(p);
      return git.discardFile(cwd, file);
    });
    rpc.onRequest(REMOTE_METHODS.git.getRepoRoot, async (p) => git.getRepoRoot(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.getProjectRoot, async (p) => git.getProjectRoot(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.initRepo, async (p) => git.initRepo(parseCwd(p)));
    rpc.onRequest(REMOTE_METHODS.git.listBranches, async (p) =>
      git.listBranches(gitListBranchesParamsSchema.parse(p).repoRoot),
    );
    rpc.onRequest(REMOTE_METHODS.git.createWorktree, async (p) => {
      const { repoRoot, opts } = gitCreateWorktreeParamsSchema.parse(p);
      return git.createWorktree(repoRoot, opts);
    });
    rpc.onRequest(REMOTE_METHODS.git.listWorktrees, async (p) =>
      git.listWorktrees(gitListWorktreesParamsSchema.parse(p).repoRoot),
    );
    rpc.onRequest(REMOTE_METHODS.git.deleteWorktree, async (p) => {
      const { repoRoot, name } = gitDeleteWorktreeParamsSchema.parse(p);
      await git.deleteWorktree(repoRoot, name);
      return { ok: true };
    });
    rpc.onRequest(REMOTE_METHODS.git.renameWorktree, async (p) => {
      const { worktreeCwd, newBranchName } = gitRenameWorktreeParamsSchema.parse(p);
      return git.renameWorktree(worktreeCwd, newBranchName);
    });
    rpc.onRequest(REMOTE_METHODS.git.archiveWorktree, async (p) => {
      const { repoRoot, name, opts } = gitArchiveWorktreeParamsSchema.parse(p);
      return git.archiveWorktree(repoRoot, name, opts);
    });
  }
}
