import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withThemePreset } from '@/test/story-decorator';
import { SearchField } from './SearchField.tsx';

const meta: Meta<typeof SearchField> = {
  component: SearchField,
  tags: ['autodocs'],
  args: { onChange: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text w-160">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { value: '', placeholder: 'Search…' } };

export const Filled: Story = { args: { value: 'my-query', placeholder: 'Search…' } };

export const WithTrailing: Story = {
  args: {
    value: '',
    placeholder: 'Search…',
    trailing: <span className="text-xs text-muted font-mono">⌘K</span>,
  },
};

export const Light: Story = {
  args: { value: 'light', placeholder: 'Search…' },
  decorators: [withThemePreset({ theme: 'light' })],
};
