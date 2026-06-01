import { segments as s } from '@code-quest/test-kit';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputArea } from '@/components/chat/compose/ChatInputArea';
import { renderWithChannel } from '@/test/render-with-channel';

async function renderChatInputArea(initOpts?: Parameters<typeof s.init>[1]) {
  return renderWithChannel(<ChatInputArea />, {
    initSegment: s.init('sess-1', initOpts),
    extraSegments: [s.controlResponse('init', { models: [{ value: 'claude-sonnet-4-20250514' }] })],
  });
}

async function renderChatInputAreaStrict(initOpts?: Parameters<typeof s.init>[1]) {
  return renderWithChannel(
    <StrictMode>
      <ChatInputArea />
    </StrictMode>,
    {
      initSegment: s.init('sess-1', initOpts),
      extraSegments: [
        s.controlResponse('init', { models: [{ value: 'claude-sonnet-4-20250514' }] }),
      ],
    },
  );
}

describe('slash command integration', () => {
  // singleFork runs all component tests in one process; a prior test may leave
  // fake timers active, which freezes waitFor's internal setTimeout polling.
  beforeEach(() => vi.useRealTimers());

  describe('Mention file from this project', () => {
    it('Click inserts @ into textarea, closes slash menu, and triggers mention search', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: [] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/');
      await user.click(screen.getByRole('menuitem', { name: 'Mention file from this project...' }));

      expect(textarea).toHaveValue('@');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();

      // After 200ms debounce, mention search should start (shows "Searching…")
      await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument(), {
        timeout: 1000,
      });
    });

    it('Tab selects it and inserts @ replacing the slash', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: [] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/mention');
      const item = screen.getByRole('menuitem', { name: 'Mention file from this project...' });
      expect(item.className).toContain('bg-selected');

      await user.keyboard('{Tab}');

      expect(textarea).toHaveValue('@');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
    });

    it('Enter selects it and inserts @ replacing the slash', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: [] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/mention');
      await user.keyboard('{Enter}');

      expect(textarea).toHaveValue('@');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
    });

    it('Tab in StrictMode does not produce @@', async () => {
      const user = userEvent.setup();
      await renderChatInputAreaStrict({ slashCommands: [] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/mention');
      await user.keyboard('{Tab}');

      expect(textarea).toHaveValue('@');
    });
  });
});
