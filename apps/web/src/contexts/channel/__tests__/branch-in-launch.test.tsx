import { EVENTS } from '@code-quest/schemas';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChannelProvider } from '@/contexts/channel/ChannelContext.tsx';
import { createTestWrapper } from '@/test/create-test-wrapper.tsx';

function wrap(Wrapper: ReturnType<typeof createTestWrapper>['Wrapper'], ui: React.ReactNode) {
  return render(<Wrapper>{ui}</Wrapper>);
}

describe('ChannelProvider branch propagation', () => {
  it('includes branch in session:launch payload when branch prop provided', async () => {
    const { summoner, Wrapper } = createTestWrapper();
    const channelId = 'test-ch-1';

    await act(async () => {
      wrap(
        Wrapper,
        <ChannelProvider
          channelId={channelId}
          cwd="/my/project"
          mode="new"
          branch="feat/my-feature"
        >
          <div />
        </ChannelProvider>,
      );
    });

    const launchEvents = summoner.sentEvents(EVENTS.session.launch);
    expect(launchEvents.length).toBeGreaterThan(0);
    expect(launchEvents[0]).toMatchObject({
      channelId,
      cwd: '/my/project',
      branch: 'feat/my-feature',
    });
  });

  it('omits branch from session:launch when branch prop not provided', async () => {
    const { summoner, Wrapper } = createTestWrapper();
    const channelId = 'test-ch-2';

    await act(async () => {
      wrap(
        Wrapper,
        <ChannelProvider channelId={channelId} cwd="/my/project" mode="new">
          <div />
        </ChannelProvider>,
      );
    });

    const launchEvents = summoner.sentEvents(EVENTS.session.launch);
    expect(launchEvents.length).toBeGreaterThan(0);
    expect(launchEvents[0]?.branch).toBeUndefined();
  });
});
