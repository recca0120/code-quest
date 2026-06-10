/**
 * P1 session-identity: TabMeta carries project/worktree identity at creation
 * (worktree-centric-workspace 1.1).
 */
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

describe('createNewTab — identity fields (1.1)', () => {
  it('writes cwd, projectCwd and branch into TabMeta', () => {
    render(
      <TabProvider>
        <Probe />
      </TabProvider>,
    );

    let channelId = '';
    act(() => {
      channelId = actionsProbe!.createNewTab({
        cwd: '/repo/wt-feat',
        projectCwd: '/repo',
        branch: 'feat/x',
      }).channelId;
    });

    expect(stateProbe!.tabs[channelId]).toMatchObject({
      cwd: '/repo/wt-feat',
      projectCwd: '/repo',
      branch: 'feat/x',
    });
  });

  it('identity fields stay undefined when not provided (default-cwd path)', () => {
    render(
      <TabProvider cwd="/repo">
        <Probe />
      </TabProvider>,
    );

    let channelId = '';
    act(() => {
      channelId = actionsProbe!.createNewTab().channelId;
    });

    const meta = stateProbe!.tabs[channelId]!;
    expect(meta.cwd).toBe('/repo');
    expect(meta.projectCwd).toBeUndefined();
    expect(meta.branch).toBeUndefined();
  });
});
