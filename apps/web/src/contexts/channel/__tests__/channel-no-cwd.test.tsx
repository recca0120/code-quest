import { EVENTS } from '@code-quest/schemas';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChannelProvider } from '@/contexts/channel/ChannelContext.tsx';
import { createTestWrapper } from '@/test/create-test-wrapper.tsx';

describe('ChannelProvider — missing cwd on new session', () => {
  it('when cwd is undefined and mode is new, shows error instead of stuck connecting', async () => {
    const { summoner, Wrapper } = createTestWrapper();

    await act(async () => {
      render(
        <Wrapper>
          <ChannelProvider channelId="ch-no-cwd" cwd={undefined} mode="new">
            <div data-testid="content">Connected</div>
          </ChannelProvider>
        </Wrapper>,
      );
    });

    // Should NOT be stuck in connecting forever
    expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();

    // Should show an error (not the children, not just spinning)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    // Should NOT have sent session:launch (no cwd to send)
    expect(summoner.sentEvents(EVENTS.session.launch).length).toBe(0);
  });
});
