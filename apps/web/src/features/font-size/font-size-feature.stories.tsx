import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { toMenuItem } from '@/lib/adapters/to-menu-item';
import type { FontSize } from '@/stores/usePreferencesStore';
import { createFontSizeFeature } from './font-size-feature.ts';

function FontSizeFeaturePreview({
  fontSize,
  setFontSize,
}: {
  fontSize: FontSize;
  setFontSize: (v: FontSize) => void;
}): React.JSX.Element {
  const feature = toMenuItem(createFontSizeFeature({ fontSize, setFontSize }));
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

const meta: Meta<typeof FontSizeFeaturePreview> = {
  component: FontSizeFeaturePreview,
  tags: ['autodocs'],
  args: { setFontSize: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text p-6 min-h-30">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FontSizeFeaturePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = { args: { fontSize: 's' } };
export const Medium: Story = { args: { fontSize: 'm' } };
export const Large: Story = { args: { fontSize: 'l' } };
export const ExtraLarge: Story = { args: { fontSize: 'xl' } };
