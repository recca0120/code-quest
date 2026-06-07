import { segments as s } from '@code-quest/test-kit';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChatInputArea } from '@/components/chat/compose/ChatInputArea';
import { renderWithChannel } from '@/test/render-with-channel';

async function renderChatInputArea(initOpts?: Parameters<typeof s.init>[1]) {
  return renderWithChannel(<ChatInputArea />, {
    initSegment: s.init('sess-1', initOpts),
    extraSegments: [s.controlResponse('init', { models: [{ value: 'claude-sonnet-4-20250514' }] })],
  });
}

describe('slash command integration', () => {
  describe('click outside', () => {
    it('clicking outside keeps / in textarea', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: ['compact'] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/');
      expect(screen.getByText('Slash Commands')).toBeInTheDocument();

      await user.click(document.body);
      expect(textarea).toHaveValue('/');
    });
  });

  describe('Escape key', () => {
    it('Escape closes command menu opened via / typing', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: ['compact'] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/');
      expect(screen.getByText('Slash Commands')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
    });

    it('Escape closes command menu opened via button click', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: ['compact'] });

      await user.click(screen.getByTitle('Show command menu (/)'));
      expect(screen.getByText('Slash Commands')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
    });

    it('Escape restores focus to textarea after closing button-click menu', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: ['compact'] });
      const textarea = screen.getByRole('textbox');

      await user.click(screen.getByTitle('Show command menu (/)'));
      await user.keyboard('{Escape}');

      await waitFor(() => expect(textarea).toHaveFocus());
    });

    it('Escape closes mention dropdown opened via Mention file button (from button-click menu)', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: [] });

      await user.click(screen.getByTitle('Show command menu (/)'));
      await user.click(screen.getByRole('menuitem', { name: 'Mention file from this project...' }));

      await waitFor(() => expect(screen.getByLabelText('mention-dropdown')).toBeInTheDocument());

      await user.keyboard('{Escape}');
      expect(screen.queryByLabelText('mention-dropdown')).not.toBeInTheDocument();
    });

    it('Escape closes mention dropdown opened via Mention file button (from / menu)', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: [] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/mention');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(screen.getByLabelText('mention-dropdown')).toBeInTheDocument());

      await user.keyboard('{Escape}');
      expect(screen.queryByLabelText('mention-dropdown')).not.toBeInTheDocument();
    });

    it('Escape closes the slash menu and keeps / in textarea with focus', async () => {
      const user = userEvent.setup();
      await renderChatInputArea({ slashCommands: ['compact'] });
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, '/');
      expect(screen.getByText('Slash Commands')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
      expect(textarea).toHaveValue('/');
      expect(textarea).toHaveFocus();
    });
  });
});
