/**
 * Shared Storybook decorator for components that need Channel context.
 * Builds sub-provider tree directly — ChannelProvider not used (no initialState needed).
 */

import type { PendingControl } from '@code-quest/schemas';
import type { StoryObj } from '@storybook/react-vite';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { expect } from 'storybook/test';
import { AppConfigProvider } from '../contexts/AppInitContext.tsx';
import { CommandPaletteProvider } from '../contexts/CommandPaletteContext.tsx';
import { ChannelComposeProvider } from '../contexts/channel/ChannelComposeContext.tsx';
import {
  ChannelConfigProvider,
  type ConfigState,
} from '../contexts/channel/ChannelConfigContext.tsx';
import { ChannelControlProvider } from '../contexts/channel/ChannelControlContext.tsx';
import { ChannelMessagesProvider } from '../contexts/channel/ChannelMessagesContext.tsx';
import { ChannelMetaProvider } from '../contexts/channel/ChannelMetaContext.tsx';
import { ChannelSocketRouterProvider } from '../contexts/channel/ChannelSocketRouterContext.tsx';
import { MessageVisibilityProvider } from '../contexts/channel/MessageVisibilityContext.tsx';
import { FsProvider } from '../contexts/FsContext.tsx';
import { GitProvider } from '../contexts/GitContext.tsx';
import { NavigationProvider } from '../contexts/NavigationContext.tsx';
import { PluginProvider } from '../contexts/PluginContext.tsx';
import { ProjectProvider } from '../contexts/ProjectContext.tsx';
import { SessionProvider } from '../contexts/SessionContext.tsx';
import { SocketProvider } from '../contexts/SocketContext.tsx';
import { TabProvider } from '../contexts/TabContext.tsx';
import { createSocket, type TypedSocket } from '../socket/client.ts';
import { DISMISSIBLE_IDS, type EffectiveColorTheme } from '../stores/preferences-schema.ts';
import type { Density } from '../stores/usePreferencesStore.ts';
import { usePreferencesStore } from '../stores/usePreferencesStore.ts';
import type { ChannelState } from '../types/chat.ts';

export const STORY_CHANNEL_ID = 'story';

export const SCENARIO_CLASS = 'flex flex-col h-screen bg-bg text-text';

interface StoryChannelOptions {
  /** Override ChannelConfigProvider initial config (model, tools, permissionMode, etc.) */
  config?: Partial<ConfigState>;
  /** Override ChannelMessagesProvider initial state (messages, status, etc.) */
  messages?: Partial<ChannelState>;
  /** Initial pending controls for ChannelControlProvider */
  pendingControls?: PendingControl[];
  /** Wrapper className for story content */
  className?: string;
}

const DEFAULT_STORY_CLASS = 'max-w-3xl bg-bg text-text p-6 relative';

function AppProviderShell({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(() => {
    const result = createSocket();
    return result instanceof Promise ? null : result;
  });
  useEffect(() => {
    if (socket) return;
    const result = createSocket();
    if (result instanceof Promise) result.then(setSocket);
  }, [socket]);
  if (!socket) return null;
  return (
    <SocketProvider socket={socket}>
      <AppConfigProvider>
        <SessionProvider>
          <PluginProvider>
            <ProjectProvider>
              <NavigationProvider>
                <GitProvider>
                  <FsProvider>
                    <TabProvider>{children}</TabProvider>
                  </FsProvider>
                </GitProvider>
              </NavigationProvider>
            </ProjectProvider>
          </PluginProvider>
        </SessionProvider>
      </AppConfigProvider>
    </SocketProvider>
  );
}

/** App-level providers only (Socket, Session, Plugin, Tab). No Channel context. */
export function withStoryApp(options?: {
  className?: string;
}): (Story: () => React.ReactNode) => React.JSX.Element {
  return (Story: () => React.ReactNode) => (
    <AppProviderShell>
      <div className={options?.className ?? DEFAULT_STORY_CLASS}>
        <Story />
      </div>
    </AppProviderShell>
  );
}

/** App + Channel providers with optional initial config/messages state. */
export function withStoryChannel(
  options?: StoryChannelOptions,
): (Story: () => React.ReactNode) => React.JSX.Element {
  return (Story: () => React.ReactNode) => (
    <AppProviderShell>
      <StoryProviders
        config={options?.config}
        messages={options?.messages}
        pendingControls={options?.pendingControls}
      >
        <div className={options?.className ?? DEFAULT_STORY_CLASS}>
          <Story />
        </div>
      </StoryProviders>
    </AppProviderShell>
  );
}

export function withScenario(
  state: Partial<ChannelState>,
): (Story: () => React.ReactNode) => React.JSX.Element {
  return withStoryChannel({ className: SCENARIO_CLASS, messages: state });
}

export const expectTextbox: StoryObj['play'] = async ({ canvas }) => {
  await expect(await canvas.findByRole('textbox')).toBeInTheDocument();
};

/** Applies theme/density data-attrs to <html> for the duration of a story.
 *  Useful for previewing palette variants per story without changing app state. */
export function withThemePreset({
  theme,
  density,
}: {
  theme?: EffectiveColorTheme;
  density?: Density;
} = {}): (Story: () => React.ReactNode) => React.JSX.Element {
  return (Story: () => React.ReactNode) => (
    <ThemePresetWrapper theme={theme} density={density}>
      <Story />
    </ThemePresetWrapper>
  );
}

function ThemePresetWrapper({
  theme,
  density,
  children,
}: {
  theme?: EffectiveColorTheme;
  density?: Density;
  children: React.ReactNode;
}) {
  // play functions read computed style synchronously after render; layout timing
  // prevents a flicker between wrong and correct theme before assertions run.
  useLayoutEffect(() => {
    const ds = document.documentElement.dataset;
    const prevTheme = ds.theme;
    const prevDensity = ds.density;
    if (theme) ds.theme = theme;
    if (density) ds.density = density;
    return () => {
      if (prevTheme === undefined) delete ds.theme;
      else ds.theme = prevTheme;
      if (prevDensity === undefined) delete ds.density;
      else ds.density = prevDensity;
    };
  }, [theme, density]);
  return <>{children}</>;
}

function StoryProviders({
  config,
  messages,
  pendingControls,
  children,
}: {
  config?: Partial<ConfigState>;
  messages?: Partial<ChannelState>;
  pendingControls?: PendingControl[];
  children: React.ReactNode;
}) {
  const messageQueueRef = useRef<string[]>([]);

  useLayoutEffect(() => {
    const { hiddenItems, hideItem } = usePreferencesStore.getState();
    if (!hiddenItems.includes(DISMISSIBLE_IDS.onboardingOverlay)) {
      hideItem(DISMISSIBLE_IDS.onboardingOverlay);
    }
  }, []);

  return (
    <ChannelMetaProvider channelId={STORY_CHANNEL_ID}>
      <ChannelSocketRouterProvider>
        <ChannelMessagesProvider
          readyToJoin
          initialState={messages}
          dequeueMessage={() => messageQueueRef.current.shift()}
          messageQueueRef={messageQueueRef}
        >
          <ChannelControlProvider initialPendingControls={pendingControls}>
            <ChannelConfigProvider initialConfig={config}>
              <MessageVisibilityProvider>
                <CommandPaletteProvider>
                  <ChannelComposeProvider>{children}</ChannelComposeProvider>
                </CommandPaletteProvider>
              </MessageVisibilityProvider>
            </ChannelConfigProvider>
          </ChannelControlProvider>
        </ChannelMessagesProvider>
      </ChannelSocketRouterProvider>
    </ChannelMetaProvider>
  );
}
