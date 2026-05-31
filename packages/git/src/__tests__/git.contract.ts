import type { Git } from '@code-quest/git';
import { AlreadyRepoError, NotARepoError } from '@code-quest/git';
import { describe, expect, it } from 'vitest';

/** Setup must produce a fresh service + a path we can pass as `cwd`.
 *  - `cwd` MUST point to a directory that is NOT yet a git repo.
 *  - `makeExistingRepo()` MUST return a path that IS already a git repo. */
export interface ContractSetup {
  service: Git;
  cwd: string;
  makeExistingRepo: () => Promise<string>;
}

export function gitContract(name: string, setup: () => Promise<ContractSetup>): void {
  describe(`${name} — Git contract`, () => {
    describe('initRepo', () => {
      it('non-git path → returns { branch: "main" }, creates .git, has 1 commit', async () => {
        const { service, cwd } = await setup();
        const res = await service.initRepo(cwd);
        expect(res.branch).toBe('main');
        // Side effects observable via existing API: listWorktrees must now succeed
        // and return at least the main worktree.
        const wts = await service.listWorktrees(cwd);
        expect(wts.length).toBeGreaterThanOrEqual(1);
        expect(wts.some((w) => w.name === 'main' || w.branch === 'main')).toBe(true);
      });

      it('already a repo → throws AlreadyRepoError', async () => {
        const { service, makeExistingRepo } = await setup();
        const cwd = await makeExistingRepo();
        await expect(service.initRepo(cwd)).rejects.toBeInstanceOf(AlreadyRepoError);
      });
    });

    describe('listWorktrees', () => {
      it('non-git path → throws NotARepoError', async () => {
        const { service, cwd } = await setup();
        await expect(service.listWorktrees(cwd)).rejects.toBeInstanceOf(NotARepoError);
      });

      it('git repo → returns array containing main', async () => {
        const { service, makeExistingRepo } = await setup();
        const cwd = await makeExistingRepo();
        const wts = await service.listWorktrees(cwd);
        expect(wts.some((w) => w.branch === 'main' || w.name === 'main')).toBe(true);
      });
    });

    describe('listBranches', () => {
      it('non-git path → throws NotARepoError', async () => {
        const { service, cwd } = await setup();
        await expect(service.listBranches(cwd)).rejects.toBeInstanceOf(NotARepoError);
      });

      it('git repo → returns array containing main', async () => {
        const { service, makeExistingRepo } = await setup();
        const cwd = await makeExistingRepo();
        const branches = await service.listBranches(cwd);
        expect(branches).toContain('main');
      });
    });
  });
}
