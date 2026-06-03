import * as Tabs from '@radix-ui/react-tabs';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { TabBar } from './TabBar.tsx';

const meta: Meta<typeof TabBar> = {
  component: TabBar,
  tags: ['autodocs'],
  args: { onSelectTab: fn(), onCloseTab: fn(), onNewTab: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <Tabs.Root defaultValue="" className="bg-surface text-text">
        <Story />
      </Tabs.Root>
    ),
  ],
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { tabs: [], activeTabId: null },
};

export const SingleTab: Story = {
  args: {
    tabs: [{ sessionId: 'abc12345', title: 'Session 1', status: 'idle' }],
    activeTabId: 'abc12345',
  },
};

export const MultipleTabs: Story = {
  args: {
    tabs: [
      { sessionId: 'abc12345', title: 'Fix Auth', status: 'idle' },
      { sessionId: 'def67890', title: 'Add Tests', status: 'processing' },
      { sessionId: 'ghi11111', status: 'connecting' },
      { sessionId: 'jkl22222', title: 'Done', status: 'disconnected' },
    ],
    activeTabId: 'abc12345',
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('Add Tests'));
    await expect(args.onSelectTab).toHaveBeenCalledWith('def67890');
  },
};

export const CloseTab: Story = {
  args: {
    tabs: [
      { sessionId: 'abc12345', title: 'Fix Auth', status: 'idle' },
      { sessionId: 'def67890', title: 'Add Tests', status: 'processing' },
    ],
    activeTabId: 'abc12345',
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /close fix auth/i }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: /^close$/i }));
    await expect(args.onCloseTab).toHaveBeenCalledWith('abc12345');
  },
};

export const WithWorktrees: Story = {
  args: {
    tabs: [
      { sessionId: 'main-1', title: 'main', status: 'idle' },
      {
        sessionId: 'wt-1',
        title: 'Feature A',
        status: 'idle',
        worktree: { name: 'feat-a', path: '/repo/.claude/worktrees/feat-a' },
      },
      {
        sessionId: 'wt-2',
        title: 'Bugfix',
        status: 'processing',
        worktree: { name: 'fix-bug', path: '/repo/.claude/worktrees/fix-bug' },
      },
    ],
    activeTabId: 'main-1',
  },
};
