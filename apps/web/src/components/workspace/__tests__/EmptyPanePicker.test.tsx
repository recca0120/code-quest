/**
 * Group 8: EmptyPanePicker tests
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EmptyPanePicker } from '@/components/workspace/EmptyPanePicker';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, usePaneState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

function Wrapper({ children }: { children: React.ReactNode }) {
  const summoner = createFakeSummoner();
  return (
    <SocketProvider socket={summoner.socket}>
      <TabProvider>{children}</TabProvider>
    </SocketProvider>
  );
}

const sessions = [
  { channelId: 'ch-1', title: 'Task A' },
  { channelId: 'ch-2', title: 'Task B' },
];

// 8.1: empty picker lists inactive sessions
describe('EmptyPanePicker (8.1) lists inactive sessions', () => {
  it('shows all available sessions in picker', () => {
    render(
      <Wrapper>
        <EmptyPanePicker paneId="pane-1" sessions={sessions} />
      </Wrapper>,
    );
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });
});

// 8.3: selecting session fills pane
describe('EmptyPanePicker (8.3) select session fills pane', () => {
  it('clicking session sets it in pane', async () => {
    const user = userEvent.setup();
    let leafSessionId: string | null = null;

    function Test() {
      const { paneRoot } = usePaneState();
      const paneId = paneRoot.type === 'leaf' ? paneRoot.id : '';
      leafSessionId =
        paneRoot.type === 'leaf' && paneRoot.content.type === 'session'
          ? paneRoot.content.sessionId
          : null;
      return <EmptyPanePicker paneId={paneId} sessions={sessions} />;
    }

    render(
      <Wrapper>
        <Test />
      </Wrapper>,
    );

    await user.click(screen.getByText('Task A'));
    expect(leafSessionId).toBe('ch-1');
  });
});
