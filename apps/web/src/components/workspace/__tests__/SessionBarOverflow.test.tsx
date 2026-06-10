/**
 * Gap-C: SessionBar overflow — maxVisible 必須動態計算並傳入
 * （從 MobileGapFixes.test.tsx 拆出：該檔對 PaneLeafBody 做 module mock，
 *   與本測試的 renderWithWorkspace 全真 harness 衝突）
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionBar } from '@/components/workspace/SessionBar';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Gap-C: SessionBar overflow 在超出寬度時應顯示 »N 按鈕
// ─────────────────────────────────────────────────────────────────────
describe('Gap-C: SessionBar overflow activates when maxVisible is passed', () => {
  it('»N button appears when sessions exceed maxVisible', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      channelId: `ch-${i}`,
      title: `Session ${i}`,
      tabStatus: 'idle' as const,
      branch: undefined,
    }));

    render(
      <Wrapper>
        <SessionBar sessions={sessions} maxVisible={3} onCloseSession={() => {}} />
      </Wrapper>,
    );

    // With maxVisible=3 and 5 sessions, »2 should appear
    expect(screen.getByLabelText('»2')).toBeInTheDocument();
  });

  it('»N button is absent when all sessions fit', () => {
    const sessions = Array.from({ length: 2 }, (_, i) => ({
      channelId: `ch-${i}`,
      title: `Session ${i}`,
      tabStatus: 'idle' as const,
      branch: undefined,
    }));

    render(
      <Wrapper>
        <SessionBar sessions={sessions} maxVisible={5} onCloseSession={() => {}} />
      </Wrapper>,
    );

    expect(screen.queryByLabelText(/»/)).not.toBeInTheDocument();
  });

  it('renders the session bar inside the full workspace without crashing (smoke — jsdom reports zero width so maxVisible cannot be exercised here)', async () => {
    // This tests that TabContainer actually passes a computed maxVisible
    // In jsdom, offsetWidth is 0 by default — we verify the prop wiring exists
    // by checking the session bar renders and overflow infrastructure is present
    const result = await renderWithWorkspace();
    const project = await result.addProject();
    for (let i = 0; i < 5; i++) {
      await project.launchSession();
    }
    // Session bar must be rendered
    expect(screen.getByTestId('session-bar')).toBeInTheDocument();
    // The overflow implementation should be wired (even if jsdom reports 0 width)
    // so that when rendered in a real browser with limited width, »N shows
    // We verify no crash and the data-testid is present
  });
});
