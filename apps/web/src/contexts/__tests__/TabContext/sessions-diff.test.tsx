/**
 * sessions prop diff — the added=1+removed=1 swap heuristic must only replace
 * the ACTIVE tab when the removed session IS the active tab. Otherwise a
 * background session dying in the same tick as a new session appearing would
 * kill the user's active tab (and leave the dead one as a zombie).
 *
 * 慣例（fake-summoner-client skill）：sessions 不用 rerender props 餵，
 * 改走真 SessionProvider——bridge 鏡像 Workspace.tsx 的接線
 * （useSession().sessions → TabProvider sessions prop），session 生死由
 * claude.pushServerEvent('session:states' / 'session:dead') 經真 socket 流入。
 * 「同 tick」靠同一個 act 內連續 push（React 18 batching 合成單次 diff）。
 */
import type { SessionStateSummary } from '@code-quest/schemas';
import { createFakeServer } from '@code-quest/server/test';
import { act, render } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { AppConfigProvider } from '@/contexts/AppInitContext';
import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { TabProvider, useTabActions, useTabState } from '@/contexts/TabContext';
import { createFakeSummoner } from '@/test/fake-summoner';

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

/** Every distinct `sessions` array TabProvider received, in commit order.
 *  The swap-heuristic tests assert on this to prove dead+states really
 *  landed as ONE diff tick (otherwise remove-then-add would pass trivially
 *  without exercising the heuristic). */
let sessionsHistory: SessionStateSummary[][] = [];
let lastSessions: SessionStateSummary[] | null = null;

/** Channel-id signatures of the sessions transitions committed after `mark`. */
function transitionsAfter(mark: number): string[] {
  return sessionsHistory.slice(mark).map((list) => list.map((s) => s.channelId).join());
}

/** Mirrors Workspace.tsx wiring: useSession().sessions → TabProvider sessions prop. */
function SessionsBridge() {
  const { sessions } = useSession();
  if (sessions !== lastSessions) {
    lastSessions = sessions;
    sessionsHistory.push(sessions);
  }
  return (
    <TabProvider sessions={sessions}>
      <Probe />
    </TabProvider>
  );
}

/** Render the real provider stack and settle app:init (its replay does a
 *  wholesale setSessions — pushes must come after it, like in production). */
async function renderHarness() {
  sessionsHistory = [];
  lastSessions = null;
  const server = createFakeServer();
  onTestFinished(() => server.destroy());
  const summoner = createFakeSummoner(server);

  render(
    <SocketProvider socket={summoner.socket}>
      <AppConfigProvider>
        <SessionProvider>
          <SessionsBridge />
        </SessionProvider>
      </AppConfigProvider>
    </SocketProvider>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(summoner.sentEvents('app:init')).toHaveLength(1);

  return { summoner, claude: summoner.claude() };
}

describe('sessions diff — 1-added/1-removed swap heuristic', () => {
  it('does NOT replace the active tab when the removed session is a background one', async () => {
    const { claude } = await renderHarness();

    // active tab X created locally (arrange)
    let x = '';
    act(() => {
      x = actionsProbe!.createNewTab({ cwd: '/x' }).channelId;
    });
    expect(stateProbe!.activeTabId).toBe(x);

    // server now reports X and a background session B
    await act(async () => {
      claude.pushServerEvent('session:states', {
        sessions: [summary(x, '/x'), summary('ch-b', '/b')],
      });
    });
    expect(Object.keys(stateProbe!.tabs).sort()).toEqual([x, 'ch-b'].sort());

    // background B dies while new session C appears in the same tick —
    // both pushes in one act() batch into a single sessions diff
    const mark = sessionsHistory.length;
    await act(async () => {
      claude.pushServerEvent('session:dead', { channelId: 'ch-b' });
      claude.pushServerEvent('session:states', { sessions: [summary('ch-c', '/c')] });
    });
    // exactly ONE transition straight to [x, ch-c] — proves the diff effect
    // saw added=1+removed=1 in a single tick (the heuristic's trigger shape)
    expect(transitionsAfter(mark)).toEqual([`${x},ch-c`]);

    // active tab X must survive; B removed; C added
    expect(stateProbe!.activeTabId).toBe(x);
    expect(stateProbe!.tabs[x]).toBeDefined();
    expect(stateProbe!.tabs['ch-b']).toBeUndefined();
    expect(stateProbe!.tabs['ch-c']).toBeDefined();
  });

  it('still replaces the active tab when the removed session IS the active tab (session swap)', async () => {
    const { claude } = await renderHarness();

    // server reports session A plus a background session BG — the BG tab is what
    // separates true swap semantics (active follows the NEW channel) from the
    // fallback add+remove path (removeTab would promote the first remaining key,
    // i.e. ch-bg, to active). Without it both code paths converge on ch-a2.
    await act(async () => {
      claude.pushServerEvent('session:states', {
        sessions: [summary('ch-a', '/a'), summary('ch-bg', '/bg')],
      });
    });
    act(() => actionsProbe!.setActiveTab('ch-a'));
    expect(stateProbe!.activeTabId).toBe('ch-a');
    expect(Object.keys(stateProbe!.tabs).sort()).toEqual(['ch-a', 'ch-bg']);

    // active session is swapped for a new channel (e.g. resume/teleport)
    const mark = sessionsHistory.length;
    await act(async () => {
      claude.pushServerEvent('session:dead', { channelId: 'ch-a' });
      claude.pushServerEvent('session:states', { sessions: [summary('ch-a2', '/a')] });
    });
    // single-tick swap shape, same proof as above
    expect(transitionsAfter(mark)).toEqual(['ch-bg,ch-a2']);

    // swap 語意：active 必須跟到新 channel（fallback 會把 active 落到 ch-bg）
    expect(stateProbe!.activeTabId).toBe('ch-a2');
    expect(stateProbe!.tabs['ch-a']).toBeUndefined();
    expect(stateProbe!.tabs['ch-a2']).toBeDefined();
    // 背景 session 不受 swap 影響：仍在、且非 active
    expect(stateProbe!.tabs['ch-bg']).toBeDefined();
  });
});
