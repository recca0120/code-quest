import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { createGitPaneActions } from '../createGitPaneActions';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  summoner.filesystem().addDirectory('/repo', []);
  return summoner;
}

describe('createGitPaneActions', () => {
  describe('commit', () => {
    it('calls git.commit with cwd and message, shows success toast', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
      await summoner.git()!.add('/repo');

      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.commit('test commit message');

      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/committed/i));
    });

    it('shows error toast when commit fails', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setCommitError('some-error');

      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.commit('test commit message');

      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/commit failed/i));
    });

    it('shows nothing-to-commit toast when nothing staged', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');

      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.commit('test commit message');

      expect(toast).toHaveBeenCalledWith(expect.stringMatching(/nothing to commit/i));
    });
  });

  describe('stageAll', () => {
    it('calls git.add and shows staged-all toast', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);

      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.stageAll();

      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/staged all/i));
    });
  });

  describe('handleDiscard', () => {
    it('calls discardFile and invokes onDiscarded callback on success', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'src/foo.ts' }]);

      const onDiscarded = vi.fn();
      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.handleDiscard('src/foo.ts', onDiscarded);

      expect(summoner.git()!.discardedFiles).toEqual(['src/foo.ts']);
      expect(onDiscarded).toHaveBeenCalled();
    });

    it('shows error toast and does not call onDiscarded when discard fails', async () => {
      const summoner = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setDiscardError('permission denied');

      const onDiscarded = vi.fn();
      const actions = createGitPaneActions('/repo', summoner.socket, {
        discardFile: summoner.git()!.discardFile.bind(summoner.git()),
        fetch: summoner.git()!.fetch.bind(summoner.git()),
        pull: summoner.git()!.pull.bind(summoner.git()),
        refetchGitStatus: vi.fn().mockResolvedValue(undefined),
      });

      await actions.handleDiscard('src/foo.ts', onDiscarded);

      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/discard failed/i));
      expect(onDiscarded).not.toHaveBeenCalled();
    });
  });
});
