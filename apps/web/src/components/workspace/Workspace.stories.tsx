import type { Meta, StoryObj } from '@storybook/react-vite';
import { makeSession, makeWorktreeSession } from '@/test/story-fixtures';
import { withStoryWorkspaceFixtures } from '@/test/story-workspace-decorator';
import { Workspace } from './Workspace.tsx';

const meta: Meta<typeof Workspace> = {
  component: Workspace,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Workspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyProject: Story = {
  decorators: [withStoryWorkspaceFixtures()],
};

export const ActiveChat: Story = {
  decorators: [withStoryWorkspaceFixtures({ sessions: [makeSession()] })],
};

export const WithWorktree: Story = {
  decorators: [
    withStoryWorkspaceFixtures({
      sessions: [makeWorktreeSession()],
      capabilities: { worktree: true },
    }),
  ],
};
