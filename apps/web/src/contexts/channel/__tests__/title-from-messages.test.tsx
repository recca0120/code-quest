import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('title derived from messages', () => {
  it('sets session title from first user message (shown in pane header)', async () => {
    const { user, addProject: addProj } = await renderWithWorkspace();
    const project = await addProj();
    await project.launchSession();
    await sendUserMessage(user, 'Fix the login bug please');

    // title 顯示已遷移 pane header（單一 header）
    const header = screen.getAllByTestId('pane-header')[0]!;
    await within(header).findByText('Fix the login bug please');
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

    const header = screen.getAllByTestId('pane-header')[0]!;
    await within(header).findByText('First message');
    expect(within(header).queryByText('Second message')).not.toBeInTheDocument();
  });
});
