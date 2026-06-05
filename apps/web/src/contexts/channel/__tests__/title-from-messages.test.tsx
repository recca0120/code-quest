import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('title derived from messages', () => {
  it('sets session title from first user message (shown in breadcrumb)', async () => {
    const { user, addProject: addProj } = await renderWithWorkspace();
    const project = await addProj();
    await project.launchSession();
    await sendUserMessage(user, 'Fix the login bug please');

    const breadcrumb = await screen.findByLabelText('chat-breadcrumb');
    expect(within(breadcrumb).getByText('Fix the login bug please')).toBeInTheDocument();
  });

  it('does not update title on second message', async () => {
    const { user, addProject: addProj } = await renderWithWorkspace();
    const project = await addProj();
    await project.launchSession();
    const textarea = screen.getByPlaceholderText(/Esc to focus/i);

    await user.click(textarea);
    await user.type(textarea, 'First message');
    await user.keyboard('{Enter}');

    await user.click(textarea);
    await user.type(textarea, 'Second message');
    await user.keyboard('{Enter}');

    const breadcrumb = await screen.findByLabelText('chat-breadcrumb');
    expect(within(breadcrumb).getByText('First message')).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Second message')).not.toBeInTheDocument();
  });
});
