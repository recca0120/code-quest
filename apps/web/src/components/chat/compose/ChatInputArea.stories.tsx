import type { Meta, StoryObj } from '@storybook/react-vite';
import { withStoryChannel } from '@/test/story-decorator';
import { ChatInputArea } from './ChatInputArea.tsx';

// ChatInputArea is an absolute overlay at the bottom of ChatShell.
// Use fullscreen layout and flex-end so it renders in its natural position.
const CLASS = 'flex flex-col justify-end w-2xl h-64 bg-bg text-text px-4 pb-4';

const meta: Meta<typeof ChatInputArea> = {
  component: ChatInputArea,
  tags: ['autodocs'],
} satisfies Meta<typeof ChatInputArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withStoryChannel({ className: CLASS })],
};

export const Processing: Story = {
  decorators: [withStoryChannel({ messages: { status: 'processing' }, className: CLASS })],
};

export const WithPermissionMode: Story = {
  decorators: [withStoryChannel({ config: { permissionMode: 'acceptEdits' }, className: CLASS })],
};
