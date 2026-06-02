import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { ModifiedFilesPanel } from './ModifiedFilesPanel.tsx';

const meta: Meta<typeof ModifiedFilesPanel> = {
  component: ModifiedFilesPanel,
  tags: ['autodocs'],
  args: { onAccept: fn(), onRewind: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text w-2xl p-4 flex flex-col gap-2">
        {/* Simulated compose box to show spatial context */}
        <div className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-muted">
          Type a message...
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ModifiedFilesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    files: [
      {
        path: 'src/app.ts',
        status: 'modified',
        oldContent: 'const a = 1;\nconst b = 2;\n',
        newContent: 'const a = 42;\nconst b = 2;\n',
      },
      {
        path: 'src/new-file.ts',
        status: 'added',
        newContent: 'export function hello() {\n  return "world";\n}\n',
      },
      { path: 'src/removed.ts', status: 'deleted', oldContent: 'export const gone = true;\n' },
    ],
  },
};

export const SingleFile: Story = {
  args: {
    files: [
      {
        path: 'config.json',
        status: 'modified',
        oldContent: '{"key": "old"}',
        newContent: '{"key": "new"}',
      },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('config.json'));
    await userEvent.click(canvas.getByRole('button', { name: /accept/i }));
    await expect(args.onAccept).toHaveBeenCalledWith('config.json');
  },
};

export const RewindFile: Story = {
  args: {
    files: [
      {
        path: 'src/app.ts',
        status: 'modified',
        oldContent: 'const a = 1;\n',
        newContent: 'const a = 42;\n',
      },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('src/app.ts'));
    await userEvent.click(canvas.getByRole('button', { name: /rewind/i }));
    await expect(args.onRewind).toHaveBeenCalledWith('src/app.ts');
  },
};
