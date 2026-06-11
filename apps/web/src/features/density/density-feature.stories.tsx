import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { toMenuItem } from '@/lib/adapters/to-menu-item';
import type { Density } from '@/stores/usePreferencesStore';
import { createDensityFeature } from './density-feature.ts';

function DensityFeaturePreview({
  density,
  setDensity,
}: {
  density: Density;
  setDensity: (v: Density) => void;
}): React.JSX.Element {
  const feature = toMenuItem(createDensityFeature({ density, setDensity }));
  return (
    <button
      type="button"
      onClick={feature.execute}
      className="text-left px-3 py-1 w-80 flex items-center justify-between text-text hover:bg-white/10 rounded"
    >
      <span>{feature.menuItem.label}</span>
      {feature.menuItem.trailing}
    </button>
  );
}

const meta: Meta<typeof DensityFeaturePreview> = {
  component: DensityFeaturePreview,
  tags: ['autodocs'],
  args: { setDensity: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text p-6 min-h-30">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DensityFeaturePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = { args: { density: 'compact' } };
export const Default: Story = { args: { density: 'default' } };
export const Relaxed: Story = { args: { density: 'relaxed' } };
