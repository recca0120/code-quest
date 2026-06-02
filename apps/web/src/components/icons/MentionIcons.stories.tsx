import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddContextIcon, FileIcon, FolderIcon } from './MentionIcons.tsx';

const Gallery = (): React.JSX.Element => (
  <div className="flex flex-col gap-4 bg-bg text-text p-6">
    <div className="flex items-center gap-3">
      <FileIcon className="w-5 h-5" />
      <span className="text-xs text-muted">FileIcon (DocumentIcon)</span>
    </div>
    <div className="flex items-center gap-3">
      <FolderIcon className="w-5 h-5" />
      <span className="text-xs text-muted">FolderIcon</span>
    </div>
    <div className="flex items-center gap-3">
      <AddContextIcon className="w-5 h-5" />
      <span className="text-xs text-muted">AddContextIcon (custom)</span>
    </div>
  </div>
);

const meta: Meta<typeof Gallery> = {
  component: Gallery,
  title: 'icons/MentionIcons',
  tags: ['autodocs'],
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
