import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyButton, HOVER_COPY_BASE } from '@/components/ui/CopyButton';
import { cn } from '@/utils/cn';

const meta: Meta<typeof CopyButton> = {
  component: CopyButton,
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text p-6 w-90">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// CodeBlock-style overlay: CopyButton sits absolutely over a group-hover container
export const CodeBlockOverlay: Story = {
  render: (args) => (
    <div className="relative group/code bg-code-block rounded p-3">
      <pre className="text-xs font-mono m-0 text-text">{'const x = 42;\nconsole.log(x);'}</pre>
      <CopyButton
        {...args}
        text={'const x = 42;\nconsole.log(x);'}
        className={cn(HOVER_COPY_BASE, 'absolute top-2 right-2 group-hover/code:opacity-100')}
      />
    </div>
  ),
  args: {},
};

// ChatMessage-style: appears next to message content on hover
export const MessageHoverReveal: Story = {
  render: (args) => (
    <div className="group flex items-start gap-2 bg-surface rounded p-3">
      <span className="text-text flex-1">
        Hover this row to reveal the copy button on the right.
      </span>
      <CopyButton
        {...args}
        text="Copied from the message"
        className={cn(HOVER_COPY_BASE, 'group-hover:opacity-100')}
      />
    </div>
  ),
  args: {},
};

// Always-visible standalone button (no group-hover)
export const Standalone: Story = {
  render: (args) => (
    <div className="flex items-center gap-2 bg-surface rounded p-3">
      <span className="text-text">Copy this text:</span>
      <CopyButton
        {...args}
        text="Hello, world!"
        className="p-1 rounded text-muted hover:text-text hover:bg-surface-hover cursor-pointer"
        title="Copy greeting"
      />
    </div>
  ),
  args: {},
};
