import { createFakeServer, createTestContainer } from '@code-quest/server/test';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('returns claude and user', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    expect(claude).toBeDefined();
    expect(claude.emitSegment).toBeDefined();
    expect(user).toBeDefined();
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

    // Session title shows in breadcrumb bar after first user message.
    const breadcrumb = await screen.findByLabelText('chat-breadcrumb');
    const { within } = await import('@testing-library/react');
    expect(within(breadcrumb).getByText('fix the login page')).toBeInTheDocument();

    // DB has CLI-generated title
    const sessionStore = container.get<{
      getByChannelId(channelId: string): Promise<{ title?: string } | null>;
    }>(Symbol.for('SessionStore'));
    const record = await sessionStore.getByChannelId(channelId);
    expect(record).toBeDefined();
    expect(record!.title).toBe('Fix the login bug');
  });
});
