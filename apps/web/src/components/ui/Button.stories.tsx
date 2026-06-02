import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { withThemePreset } from '@/test/story-decorator';
import { Button } from './Button.tsx';

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ['autodocs'],
  args: { onClick: fn(), children: 'Action' },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text p-6 flex gap-2 items-start">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Danger: Story = { args: { variant: 'danger' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Disabled: Story = { args: { disabled: true } };
export const SizeMd: Story = { args: { size: 'md' } };

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['primary', 'secondary', 'danger', 'ghost'] as const).map((variant) => (
        <div key={variant} className="flex gap-2 items-center">
          <span className="text-xs text-muted w-20">{variant}</span>
          <Button variant={variant} size="xs">
            xs
          </Button>
          <Button variant={variant} size="sm">
            sm
          </Button>
          <Button variant={variant} size="md">
            md
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const LightMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['primary', 'secondary', 'danger', 'ghost'] as const).map((variant) => (
        <div key={variant} className="flex gap-2 items-center">
          <span className="text-xs text-muted w-20">{variant}</span>
          <Button variant={variant}>button</Button>
        </div>
      ))}
    </div>
  ),
  decorators: [withThemePreset({ theme: 'light' })],
};
