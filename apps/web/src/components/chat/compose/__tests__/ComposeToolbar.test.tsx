import { segments as s } from '@code-quest/test-kit';
import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

async function setup() {
  const summoner = createFakeSummoner();
  summoner.claude().prepareInit(
    s.init('compose-test', {
      mcpServers: [{ name: 'github', status: 'connected' }],
    }),
  );
  const result = await renderWithWorkspace({ summoner });
  const project = await result.addProject();
  await project.launchSession();
  return result;
}

async function openMcpStatusDialog(user: ReturnType<typeof userEvent.setup>) {
  const textarea = screen.getAllByRole('textbox').find((el) => el.tagName === 'TEXTAREA')!;
  await user.type(textarea, '/mcp');
  await user.click(await screen.findByText('MCP status'));
}

describe('ComposeToolbar mcpRefresh', () => {
  it('shows refreshed server list from mcpStatus response', async () => {
    const { user } = await setup();
    await sendUserMessage(user, 'hello');

    await openMcpStatusDialog(user);

    expect(await screen.findByText('github')).toBeInTheDocument();
  });
});
