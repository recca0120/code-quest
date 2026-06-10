import { createFakeServer } from '@code-quest/server/test';
import { type FakeClaude, segments as s } from '@code-quest/test-kit';
import { act, type RenderResult, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { onTestFinished } from 'vitest';
import { AppConfigProvider } from '../contexts/AppInitContext.tsx';
import { CommandPaletteProvider } from '../contexts/CommandPaletteContext.tsx';
import { ChannelProvider, type SessionMode } from '../contexts/channel/ChannelContext.tsx';
import { NavigationProvider } from '../contexts/NavigationContext.tsx';
import { PluginProvider } from '../contexts/PluginContext.tsx';
import { ProjectProvider } from '../contexts/ProjectContext.tsx';
import { SessionProvider } from '../contexts/SessionContext.tsx';
import { SocketProvider } from '../contexts/SocketContext.tsx';
import { TabProvider } from '../contexts/TabContext.tsx';
import type { ChannelState } from '../types/chat.ts';
import { createFakeSummoner, type FakeSummoner } from './fake-summoner.ts';

interface RenderWithChannelOptions {
  channelId?: string;
  summoner?: FakeSummoner;
  initSegment?: string;
  /** Extra segments passed to claude.initialize (e.g. controlResponse). */
  extraSegments?: string[];
  cwd?: string;
  onNewChannel?: (cwd: string) => void;
  /** Skip claude.initialize — useful for testing launch failure. */
  skipInit?: boolean;
  mode?: SessionMode;
  /** Pre-populate ChannelMessagesProvider state — useful for testing
   *  resume scenarios where messages already exist on mount. */
  initialState?: Partial<ChannelState>;
}

interface RenderWithChannelResult extends RenderResult {
  claude: FakeClaude;
  summoner: FakeSummoner;
  channelId: string;
}

const DEFAULT_TEST_CWD = '/test/cwd';

export async function renderWithChannel(
  ui: ReactElement,
  options: RenderWithChannelOptions = {},
): Promise<RenderWithChannelResult> {
  // Create server explicitly when not shared so we can destroy it after the test.
  // Destroying clears pending ControlRequestTracker timers that would otherwise
  // keep the Node.js event loop busy in singleFork mode, slowing subsequent tests.
  const ownedServer = options.summoner ? null : createFakeServer();
  const summoner = options.summoner ?? createFakeSummoner(ownedServer!);
  onTestFinished(() => ownedServer?.destroy());
  const claude = summoner.claude() as FakeClaude;
  const channelId = options.channelId ?? crypto.randomUUID();
  // Used only for the launch-payload default. ChannelProvider keeps
  // options.cwd (undefined skips the React-side session:launch).
  const mode = options.mode ?? 'resume';
  const launchCwd = options.cwd ?? DEFAULT_TEST_CWD;

  // 1. Render first — mount providers, register socket listeners (like production)
  const result = render(ui, {
    wrapper: ({ children }) => (
      <SocketProvider socket={summoner.socket}>
        <AppConfigProvider>
          <SessionProvider>
            <PluginProvider>
              <ProjectProvider>
                <NavigationProvider>
                  <CommandPaletteProvider>
                    <TabProvider cwd={options.cwd}>
                      <ChannelProvider
                        channelId={channelId}
                        cwd={options.cwd}
                        mode={mode}
                        onNewChannel={options.onNewChannel}
                        initialState={options.initialState}
                      >
                        {children}
                      </ChannelProvider>
                    </TabProvider>
                  </CommandPaletteProvider>
                </NavigationProvider>
              </ProjectProvider>
            </PluginProvider>
          </SessionProvider>
        </AppConfigProvider>
      </SocketProvider>
    ),
  });

  // 2. Initialize after render — matches production flow (App renders, then session starts)
  if (!options.skipInit) {
    const initSeg = options.initSegment ?? s.init('cli-session');
    const extraSegs = options.extraSegments ?? [];
    await act(async () => {
      await claude.initialize({ launch: { channelId, cwd: launchCwd } }, initSeg, ...extraSegs);
    });
  }

  // Flush join ACK — ChannelMessagesProvider fires session:join on mount,
  // the server handler is async (await readyPromise, etc.). Multiple
  // microtask ticks are needed for the ACK to arrive.
  if (mode === 'resume') {
    await act(async () => {
      for (let i = 0; i < 3; i++) await new Promise<void>((r) => queueMicrotask(r));
    });
  }

  return { ...result, claude, summoner, channelId };
}
