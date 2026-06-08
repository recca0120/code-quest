import { EVENTS } from '@code-quest/schemas';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChannelProvider } from '@/contexts/channel/ChannelContext.tsx';
import { createTestWrapper } from '@/test/create-test-wrapper.tsx';

describe('ChannelProvider — "Channel already exists" recovery', () => {
  it('when remounted after launch, treats "Channel already exists" as join (not error)', async () => {
    const { summoner, Wrapper } = createTestWrapper();
    const channelId = 'ch-remount-test';

    // First mount — launch succeeds, channel is created on server
    const { unmount } = render(
      <Wrapper>
        <ChannelProvider channelId={channelId} cwd="/project" mode="new">
          <div data-testid="content">Connected</div>
        </ChannelProvider>
      </Wrapper>,
    );

    // Wait for session:launch to be sent (channel is now live on server)
    await waitFor(() => expect(summoner.sentEvents(EVENTS.session.launch).length).toBe(1));
    unmount();

    // Second mount — same channelId, same server: server throws "Channel already exists"
    await act(async () => {
      render(
        <Wrapper>
          <ChannelProvider channelId={channelId} cwd="/project" mode="new">
            <div data-testid="content">Connected</div>
          </ChannelProvider>
        </Wrapper>,
      );
    });

    // Should NOT show the error — should join existing channel instead
    expect(screen.queryByText(/Channel already exists/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    // Verify that session:launch was sent twice (once per mount)
    expect(summoner.sentEvents(EVENTS.session.launch).length).toBe(2);
  });
});
