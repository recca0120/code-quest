import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withThemePreset } from '@/test/story-decorator';
import { SettingsDialog } from './SettingsDialog.tsx';

const meta: Meta<typeof SettingsDialog> = {
  component: SettingsDialog,
  tags: ['autodocs'],
  args: { onClose: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text min-h-100 flex items-center justify-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = { args: { open: false } };
export const Open: Story = { args: { open: true } };

export const DarkDefault: Story = {
  args: { open: true },
  decorators: [withThemePreset({ theme: 'clay-dark', density: 'default' })],
};
export const DarkCompact: Story = {
  args: { open: true },
  decorators: [withThemePreset({ theme: 'clay-dark', density: 'compact' })],
};
export const LightDefault: Story = {
  args: { open: true },
  decorators: [withThemePreset({ theme: 'light', density: 'default' })],
};
export const LightCompact: Story = {
  args: { open: true },
  decorators: [withThemePreset({ theme: 'light', density: 'compact' })],
};
