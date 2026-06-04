import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { useGitPaneActions } from '../useGitPaneActions';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  summoner.filesystem().addDirectory('/repo', []);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SocketProvider socket={summoner.socket}>
        <GitProvider>
          <FsProvider>
            <OpenspecProvider>
              {children}
              <Toaster />
            </OpenspecProvider>
          </FsProvider>
        </GitProvider>
      </SocketProvider>
    );
  }

  return { summoner, Wrapper };
}

type HookHarnessProps = {
  cwd: string;
  onDiscarded?: () => void;
  onDiffOpen?: (diff: import('../useGitPaneActions').DiffState) => void;
};

describe('useGitPaneActions', () => {
  describe('commit', () => {
    it('calls git.commit with cwd and message, shows success toast', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setClean(false);
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);
      // Stage files first so commit succeeds
      await summoner.git()!.add('/repo');

      render(
        <Wrapper>
          <HookHarness cwd="/repo" />
        </Wrapper>,
      );

      const commitBtn = screen.getByTestId('commit-btn');
      await act(async () => {
        commitBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/committed/i)).toBeInTheDocument();
      });
    });

    it('shows error toast when commit fails', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setCommitError('some-error');

      render(
        <Wrapper>
          <HookHarness cwd="/repo" />
        </Wrapper>,
      );

      const commitBtn = screen.getByTestId('commit-btn');
      await act(async () => {
        commitBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/commit failed/i)).toBeInTheDocument();
      });
    });

    it('shows nothing-to-commit toast when nothing staged', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');

      render(
        <Wrapper>
          <HookHarness cwd="/repo" />
        </Wrapper>,
      );

      const commitBtn = screen.getByTestId('commit-btn');
      await act(async () => {
        commitBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/nothing to commit/i)).toBeInTheDocument();
      });
    });
  });

  describe('stageAll', () => {
    it('calls git.add with cwd and shows success toast', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'a.ts' }]);

      render(
        <Wrapper>
          <HookHarness cwd="/repo" />
        </Wrapper>,
      );

      const btn = screen.getByTestId('stage-all-btn');
      await act(async () => {
        btn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/staged all/i)).toBeInTheDocument();
      });
      expect(summoner.git()!.stagedCount).toBe(1);
    });
  });

  describe('handleDiscard', () => {
    it('calls discardFile and invokes onDiscarded callback on success', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setChangedFiles([{ status: 'M', file: 'src/foo.ts' }]);

      const onDiscarded = vi.fn();

      render(
        <Wrapper>
          <HookHarness cwd="/repo" onDiscarded={onDiscarded} />
        </Wrapper>,
      );

      const btn = screen.getByTestId('discard-btn');
      await act(async () => {
        btn.click();
      });

      await waitFor(() => {
        expect(summoner.git()!.discardedFiles).toContain('src/foo.ts');
      });
      expect(onDiscarded).toHaveBeenCalled();
    });

    it('shows error toast and does not call onDiscarded when discard fails', async () => {
      const { summoner, Wrapper } = setup();
      summoner.git()!.setBranch('main');
      summoner.git()!.setDiscardError('permission denied');

      const onDiscarded = vi.fn();

      render(
        <Wrapper>
          <HookHarness cwd="/repo" onDiscarded={onDiscarded} />
        </Wrapper>,
      );

      const btn = screen.getByTestId('discard-btn');
      await act(async () => {
        btn.click();
      });

      await waitFor(() => {
        expect(screen.getByText(/discard failed/i)).toBeInTheDocument();
      });
      expect(onDiscarded).not.toHaveBeenCalled();
    });
  });
});

// ── Test harness component ──

function HookHarness({ cwd, onDiscarded, onDiffOpen }: HookHarnessProps) {
  const { stageAll, commit, handleDiscard } = useGitPaneActions(cwd, { onDiffOpen });

  return (
    <div>
      <button
        type="button"
        data-testid="commit-btn"
        onClick={() => void commit('test commit message')}
      >
        Commit
      </button>
      <button type="button" data-testid="stage-all-btn" onClick={() => void stageAll()}>
        Stage All
      </button>
      <button
        type="button"
        data-testid="discard-btn"
        onClick={() => void handleDiscard('src/foo.ts', onDiscarded ?? (() => {}))}
      >
        Discard
      </button>
    </div>
  );
}
