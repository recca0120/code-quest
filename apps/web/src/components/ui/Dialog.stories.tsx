import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Dialog, DialogClose, DialogContent } from './Dialog.tsx';

const meta: Meta<typeof DialogContent> = {
  title: 'ui/Dialog',
  component: DialogContent,
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text p-4">
        <Dialog open>
          <Story />
        </Dialog>
      </div>
    ),
  ],
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Dialog Title',
    children: <p className="text-sm text-muted">This is the dialog content.</p>,
  },
};

export const WithActions: Story = {
  args: {
    title: 'Confirm Action',
    children: (
      <div>
        <p className="text-sm text-muted mb-4">Are you sure you want to proceed?</p>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:bg-white/5"
            >
              Cancel
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={fn()}
            className="text-xs px-3 py-1.5 rounded bg-accent text-white hover:bg-accent/80"
          >
            Confirm
          </button>
        </div>
      </div>
    ),
  },
};

export const Mandatory: Story = {
  args: {
    title: 'Required Action',
    mandatory: true,
    children: (
      <div>
        <p className="text-sm text-muted mb-4">
          You must complete this action to continue. Press Escape or click outside — nothing
          happens.
        </p>
        <button
          type="button"
          className="text-xs px-3 py-1.5 rounded bg-success text-white hover:bg-success/80"
        >
          Complete
        </button>
      </div>
    ),
  },
};

export const HiddenTitle: Story = {
  args: {
    title: 'Hidden Title (sr-only)',
    hideTitle: true,
    children: <p className="text-sm text-muted">Title is visually hidden but accessible.</p>,
  },
};

export const WideContent: Story = {
  args: {
    title: 'Wide Dialog',
    className: 'max-w-2xl w-full',
    children: (
      <p className="text-sm text-muted">
        This dialog uses a wider max-width via the className prop.
      </p>
    ),
  },
};
