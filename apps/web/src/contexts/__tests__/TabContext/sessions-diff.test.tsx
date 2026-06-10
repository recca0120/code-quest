/**
 * sessions prop diff — the added=1+removed=1 swap heuristic must only replace
 * the ACTIVE tab when the removed session IS the active tab. Otherwise a
 * background session dying in the same tick as a new session appearing would
 * kill the user's active tab (and leave the dead one as a zombie).
 */
import type { SessionStateSummary } from '@code-quest/schemas';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';

let stateProbe: ReturnType<typeof useTabState> | null = null;
let actionsProbe: ReturnType<typeof useTabActions> | null = null;

function Probe() {
  stateProbe = useTabState();
  actionsProbe = useTabActions();
  return null;
}

function summary(channelId: string, cwd: string): SessionStateSummary {
  return { channelId, state: 'idle', cwd, projectRoot: cwd };
}

function Harness({ sessions }: { sessions: SessionStateSummary[] }) {
  return (
    <TabProvider sessions={sessions}>
      <Probe />
    </TabProvider>
  );
}

describe('sessions diff — 1-added/1-removed swap heuristic', () => {
  it('does NOT replace the active tab when the removed session is a background one', () => {
    const { rerender } = render(<Harness sessions={[]} />);

    // active tab X created locally
    let x = '';
    act(() => {
      x = actionsProbe!.createNewTab({ cwd: '/x' }).channelId;
    });
    expect(stateProbe!.activeTabId).toBe(x);

    // server now reports X and a background session B
    rerender(<Harness sessions={[summary(x, '/x'), summary('ch-b', '/b')]} />);
    expect(Object.keys(stateProbe!.tabs).sort()).toEqual([x, 'ch-b'].sort());

    // background B dies while new session C appears in the same tick
    rerender(<Harness sessions={[summary(x, '/x'), summary('ch-c', '/c')]} />);

    // active tab X must survive; B removed; C added
    expect(stateProbe!.activeTabId).toBe(x);
    expect(stateProbe!.tabs[x]).toBeDefined();
    expect(stateProbe!.tabs['ch-b']).toBeUndefined();
    expect(stateProbe!.tabs['ch-c']).toBeDefined();
  });

  it('still replaces the active tab when the removed session IS the active tab (session swap)', () => {
    const { rerender } = render(<Harness sessions={[summary('ch-a', '/a')]} />);

    act(() => actionsProbe!.setActiveTab('ch-a'));
    expect(stateProbe!.activeTabId).toBe('ch-a');

    // active session is swapped for a new channel (e.g. resume/teleport)
    rerender(<Harness sessions={[summary('ch-a2', '/a')]} />);

    expect(stateProbe!.activeTabId).toBe('ch-a2');
    expect(stateProbe!.tabs['ch-a']).toBeUndefined();
    expect(stateProbe!.tabs['ch-a2']).toBeDefined();
  });
});
