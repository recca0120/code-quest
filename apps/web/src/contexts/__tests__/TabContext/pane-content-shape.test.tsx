import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type PaneNode, TabProvider, usePaneActions, usePaneState } from '@/contexts/TabContext';

function collectLeaves(node: PaneNode): Extract<PaneNode, { type: 'leaf' }>[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

let probeState: ReturnType<typeof usePaneState> | null = null;
let probeActions: ReturnType<typeof usePaneActions> | null = null;

function Probe() {
  probeState = usePaneState();
  probeActions = usePaneActions();
  return <span data-testid="probe" />;
}

function renderProbe() {
  render(
    <TabProvider>
      <Probe />
    </TabProvider>,
  );
  expect(screen.getByTestId('probe')).toBeInTheDocument();
  const leaves = () => collectLeaves(probeState!.paneRoot);
  return { leaves, actions: () => probeActions!, state: () => probeState! };
}

describe('PaneContent shape — session leaf carries cwd (1.1 / 1.2)', () => {
  it('setSessionInPane(paneId, sessionId, cwd) writes sessionId AND cwd into leaf content', () => {
    const { leaves, actions } = renderProbe();
    const paneId = leaves()[0]!.id;

    act(() => actions().setSessionInPane(paneId, 'ch-1', '/repo/feat'));

    expect(leaves()[0]!.content).toEqual({
      type: 'session',
      sessionId: 'ch-1',
      cwd: '/repo/feat',
    });
  });

  it('setSessionInPane(paneId, null, null) clears binding and cwd', () => {
    const { leaves, actions } = renderProbe();
    const paneId = leaves()[0]!.id;

    act(() => actions().setSessionInPane(paneId, 'ch-1', '/repo/feat'));
    act(() => actions().setSessionInPane(paneId, null, null));

    expect(leaves()[0]!.content).toEqual({ type: 'session', sessionId: null, cwd: null });
  });

  it('splitPaneAndAssign(direction, sessionId, cwd) creates the new leaf with cwd', () => {
    const { leaves, actions } = renderProbe();
    const firstId = leaves()[0]!.id;
    act(() => actions().focusPane(firstId));

    act(() => actions().splitPaneAndAssign('h', 'ch-2', '/repo/main'));

    const newLeaf = leaves().find(
      (l) => l.content.type === 'session' && l.content.sessionId === 'ch-2',
    );
    expect(newLeaf?.content).toEqual({ type: 'session', sessionId: 'ch-2', cwd: '/repo/main' });
  });

  it('default empty leaf has null sessionId and null cwd', () => {
    const { leaves } = renderProbe();
    expect(leaves()[0]!.content).toEqual({ type: 'session', sessionId: null, cwd: null });
  });
});
