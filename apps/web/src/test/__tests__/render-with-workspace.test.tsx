import {
  createFakeServer,
  createTestContainer,
  type SessionStore,
  TYPES,
} from '@code-quest/server/test';
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSummoner } from '../fake-summoner.ts';
import { emitAssistantTurn, sendUserMessage } from '../helpers.tsx';
import { renderWithWorkspace } from '../render-with-workspace.tsx';

describe('renderWithWorkspace', () => {
  it('renders Workspace with a new tab', async () => {
    const { addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('claude.emitSegment flushes React without explicit act()', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user, 'hello');

    await emitAssistantTurn(claude, 'Reply from Claude');

    // getByText (not findByText) — proves flush happened synchronously after emit
    expect(screen.getByText(/Reply from Claude/)).toBeInTheDocument();
  });

  it('auto-generates title after first prompt and persists to DB', async () => {
    const container = createTestContainer();
    const server = createFakeServer(container);
    const summoner = createFakeSummoner(server);
    const { claude, user, addProject } = await renderWithWorkspace({ summoner });
    const project = await addProject();
    const channelId = await project.launchSession();

    claude.setControlRequestHandler((req) => {
      if (req.subtype === 'generate_session_title') {
        return { title: 'Fix the login bug' };
      }
      return null;
    });

    // User sends a prompt
    await sendUserMessage(user, 'fix the login page');

    // CLI responds
    await emitAssistantTurn(claude, 'ok');

    // ① UI: session title shows in the pane header after first user message.
    const breadcrumb = screen.getAllByTestId('pane-header')[0]!;
    expect(within(breadcrumb).getByText('fix the login page')).toBeInTheDocument();

    // ② Server broadcast: session:states carries the CLI-generated title.
    await vi.waitFor(() => {
      const summaries = claude
        .receivedEvents('session:states')
        .flatMap((payload) => payload.sessions);
      expect(summaries).toContainEqual(
        expect.objectContaining({ channelId, title: 'Fix the login bug' }),
      );
    });

    // ③ DB: CLI-generated title persisted (poll — persistence races the broadcast).
    const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
    await expect
      .poll(async () => (await sessionStore.getByChannelId(channelId))?.title)
      .toBe('Fix the login bug');
  });
});
