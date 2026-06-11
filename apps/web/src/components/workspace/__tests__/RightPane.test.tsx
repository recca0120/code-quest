/**
 * CT2.5/CT2.8 + RP.1–RP.4: RightPane 使用完整 Pane 元件
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RightPane } from '@/components/workspace/RightPane';
import { FsProvider } from '@/contexts/FsContext';
import { GitProvider } from '@/contexts/GitContext';
import { OpenspecProvider } from '@/contexts/OpenspecContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner, type FakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<FakeSummoner | null>(null);
  if (!ref.current) ref.current = createFakeSummoner();
  return (
    <SocketProvider socket={ref.current.socket}>
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

describe('RightPane — tab shell', () => {
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

// RP.1–RP.3: 各 tab 渲染對應的完整 pane 元件
describe('RightPane (RP.1) Files tab renders FilesPane', () => {
  it('shows files-pane section when Files tab is active', () => {
    render(
      <Wrapper>
        <RightPane cwd="/test" initialTab="files" />
      </Wrapper>,
    );
    expect(screen.getByRole('region', { name: 'files-pane' })).toBeInTheDocument();
  });
});

describe('RightPane (RP.2) Git tab renders GitPane', () => {
  it('shows git-pane section when Git tab is active', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <RightPane cwd="/test" initialTab="files" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('tab', { name: /Git/i }));
    expect(screen.getByRole('region', { name: 'git-pane' })).toBeInTheDocument();
  });
});

describe('RightPane (RP.3) Spec tab renders SpecPane', () => {
  it('shows spec-pane section when Spec tab is active', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <RightPane cwd="/test" initialTab="files" />
      </Wrapper>,
    );
    await user.click(screen.getByRole('tab', { name: /Spec/i }));
    expect(screen.getByRole('region', { name: 'spec-pane' })).toBeInTheDocument();
  });
});

// RP.4: RightPane 接受 onMention prop 並傳給 FilesPane
describe('RightPane (RP.4) onMention prop wired to FilesPane', () => {
  it('accepts onMention prop and renders files-pane', () => {
    const onMention = vi.fn();
    render(
      <Wrapper>
        <RightPane cwd="/test" initialTab="files" onMention={onMention} />
      </Wrapper>,
    );
    // FilesPane 應該正常 render（有 aria-label="files-pane"）
    expect(screen.getByRole('region', { name: 'files-pane' })).toBeInTheDocument();
  });
});
