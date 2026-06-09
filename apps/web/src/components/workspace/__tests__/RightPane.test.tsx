/**
 * CT2.5/CT2.8: RightPane component tests
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RightPane } from '@/components/workspace/RightPane';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <GitProvider>
        <FsProvider>
          <OpenspecProvider>
            <TabProvider>{children}</TabProvider>
          </OpenspecProvider>
        </FsProvider>
      </GitProvider>
    </SocketProvider>
  );
}

describe('RightPane', () => {
  it('defaults to files tab when no initialTab given', () => {
    render(
      <Wrapper>
        <RightPane cwd="/test" />
      </Wrapper>,
    );
    expect(screen.getByRole('tab', { name: /Files/i })).toHaveAttribute('data-state', 'active');
  });

  it('shows git tab when initialTab="git"', () => {
    render(
      <Wrapper>
        <RightPane cwd="/test" initialTab="git" />
      </Wrapper>,
    );
    expect(screen.getByRole('tab', { name: /Git/i })).toHaveAttribute('data-state', 'active');
  });

  it('shows right-pane-body region', () => {
    render(
      <Wrapper>
        <RightPane cwd="/test" />
      </Wrapper>,
    );
    expect(screen.getByRole('region', { name: 'right-pane-body' })).toBeInTheDocument();
  });
});
