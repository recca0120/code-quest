import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStoryApp } from '@/test/story-decorator';
import { TabContainer } from './TabContainer.tsx';

const meta: Meta<typeof TabContainer> = {
  component: TabContainer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [withStoryApp({ className: 'h-screen flex flex-col bg-bg text-text' })],
} satisfies Meta<typeof TabContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithPendingSession: Story = {
  args: { pendingNewSessionCwd: '/projects/code-quest' },
};
