import type { Meta, StoryObj } from '@storybook/react-vite';
import { PanelHeader } from '@/components/chat/ui/PanelHeader';
import { withThemePreset } from '@/test/story-decorator';

const meta: Meta<typeof PanelHeader> = {
  component: PanelHeader,
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text w-135">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  args: { title: 'Raw Events' },
};

export const WithActions: Story = {
  args: {
    title: 'Terminal',
    actions: (
      <div className="flex gap-2">
        <button type="button" className="text-muted hover:text-text text-xs">
          Clear
        </button>
        <button type="button" className="text-muted hover:text-text text-xs">
          ✕
        </button>
      </div>
    ),
  },
};

export const Light: Story = {
  args: { title: 'Files' },
  decorators: [withThemePreset({ theme: 'light' })],
};
