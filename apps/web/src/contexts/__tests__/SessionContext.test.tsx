import { segments as s } from '@code-quest/test-kit';
import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emitAssistantTurn, sendUserMessage } from '@/test/helpers';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('SessionProvider (global config only)', () => {
  it('renders UI after connect and launch', async () => {
    const { addProject: addProj } = await renderWithWorkspace();
    const proj = await addProj();
    await proj.launchSession();
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('assistant reply is rendered after emitting an assistant turn', async () => {
    const { claude, user, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await sendUserMessage(user);
    await emitAssistantTurn(claude);

    expect(screen.queryAllByText(/hi/).length).toBeGreaterThan(0);
  });

  it('experiment_gates event does not crash', async () => {
    const { claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();
    await act(async () => {
      await claude.emitSegment(s.experimentGates({ review_upsell: true }));
    });

    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });

  it('disconnect shows toast warning', async () => {
    const { claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await act(async () => {
      claude.disconnect();
    });

    expect(await screen.findByText('Disconnected from server')).toBeInTheDocument();
  });

  it('connect_error shows toast error', async () => {
    const { claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    const listeners = claude.listeners('connect_error');
    await act(async () => {
      for (const fn of listeners) (fn as (err: Error) => void)(new Error('Connection refused'));
    });

    expect(await screen.findByText(/Connection refused/i)).toBeInTheDocument();
  });

  it('reconnects successfully', async () => {
    const { claude, addProject } = await renderWithWorkspace();
    const project = await addProject();
    await project.launchSession();

    await act(async () => {
      claude.disconnect();
    });
    await act(async () => {
      claude.connect();
    });

    expect(claude.connected).toBe(true);
    expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
  });
});
