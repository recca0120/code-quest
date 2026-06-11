import { segments as s } from '@code-quest/test-kit';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithChannel } from '@/test/render-with-channel';
import { HeaderBar } from '../HeaderBar.tsx';

const INIT = {
  initSegment: s.init('sess-1', { model: 'claude-sonnet-4-6' }),
  extraSegments: [
    s.controlResponse('init', {
      models: [{ value: 'claude-sonnet-4-6', displayName: 'Sonnet 4.6' }],
    }),
  ],
};

async function renderHeaderBar(props: Partial<React.ComponentProps<typeof HeaderBar>> = {}) {
  return renderWithChannel(<HeaderBar {...props} />, INIT);
}

describe('HeaderBar (context mode)', () => {
  it('shows model badge but no status dot or label', async () => {
    await renderHeaderBar();
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument();
    expect(screen.queryByText(/^Connected$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Disconnected$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Processing$/i)).not.toBeInTheDocument();
  });

  it('title prop still works', async () => {
    await renderHeaderBar({ title: 'Fix bug' });
    expect(screen.getByText('Fix bug')).toBeInTheDocument();
  });

  it('shows truncated channelId when no title', async () => {
    const { channelId } = await renderHeaderBar();
    expect(screen.getByText(`${channelId.slice(0, 8)}…`)).toBeInTheDocument();
  });

  it('does not show command palette button (moved to workspace topbar)', async () => {
    await renderHeaderBar();
    expect(screen.queryByTitle('Command Palette (⌘K)')).not.toBeInTheDocument();
  });

  it('renders children as actions slot', async () => {
    await renderWithChannel(
      <HeaderBar title="Test">
        <button type="button">Custom Action</button>
      </HeaderBar>,
      INIT,
    );
    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });
});
