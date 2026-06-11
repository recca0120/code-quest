import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { CommandPaletteProvider, useCommandPaletteActions } from '@/contexts/CommandPaletteContext';
import { useChannelsStore } from '@/stores/channels-store';
import { withStoryChannel, withThemePreset } from '@/test/story-decorator';
import type { Message } from '@/types/ui';
import { CommandPalette } from './CommandPalette.tsx';

const messages: Message[] = [
  {
    id: '1',
    role: 'user',
    timestamp: Date.now() - 3000,
    type: 'text',
    content: 'Fix the login bug',
  },
  {
    id: '2',
    role: 'assistant',
    timestamp: Date.now() - 2000,
    type: 'text',
    content: 'Looking at the authentication logic now.',
  },
  {
    id: '3',
    role: 'assistant',
    timestamp: Date.now() - 1000,
    type: 'tool_use',
    content: 'Read',
    meta: { toolId: 't1', name: 'Read', input: {} },
  } as Message,
];

function AutoOpen({ tab }: { tab?: string }) {
  const { openPalette } = useCommandPaletteActions();
  useEffect(() => {
    openPalette(tab ? { tab } : undefined);
  }, [openPalette, tab]);
  return null;
}

function SeedRegistry() {
  useEffect(() => {
    useChannelsStore.getState().setChannelState('story', (prev) => ({ ...prev, messages }));
    return () => useChannelsStore.getState().removeChannel('story');
  }, []);
  return null;
}

function PaletteStory({ tab }: { tab?: string }) {
  return (
    <CommandPaletteProvider>
      <SeedRegistry />
      <AutoOpen tab={tab} />
      <CommandPalette />
    </CommandPaletteProvider>
  );
}

const meta: Meta<typeof CommandPalette> = {
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [withStoryChannel({ messages: { messages }, className: 'h-screen bg-bg text-text' })],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <PaletteStory />,
};

export const MessagesTab: Story = {
  render: () => <PaletteStory tab="messages" />,
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <PaletteStory />,
};

export const DarkDefault: Story = {
  decorators: [withThemePreset({ theme: 'clay-dark', density: 'default' })],
  render: () => <PaletteStory />,
};

export const DarkCompact: Story = {
  decorators: [withThemePreset({ theme: 'clay-dark', density: 'compact' })],
  render: () => <PaletteStory />,
};

export const LightDefault: Story = {
  decorators: [withThemePreset({ theme: 'light', density: 'default' })],
  render: () => <PaletteStory />,
};

export const LightCompact: Story = {
  decorators: [withThemePreset({ theme: 'light', density: 'compact' })],
  render: () => <PaletteStory />,
};
