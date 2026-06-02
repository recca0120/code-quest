import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  BorderedIconButton,
  CheckMark,
  ChevronDown,
  ChevronRight,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SlashCommandIcon,
  TrashIcon,
  XIcon,
} from './Icons.tsx';

const ICONS = [
  { name: 'SearchIcon', Icon: SearchIcon },
  { name: 'ChevronDown', Icon: ChevronDown },
  { name: 'ChevronRight', Icon: ChevronRight },
  { name: 'CheckMark', Icon: CheckMark },
  { name: 'XIcon', Icon: XIcon },
  { name: 'TrashIcon', Icon: TrashIcon },
  { name: 'RefreshIcon', Icon: RefreshIcon },
  { name: 'PlusIcon', Icon: PlusIcon },
  { name: 'SlashCommandIcon', Icon: SlashCommandIcon },
] as const;

const Gallery = (): React.JSX.Element => (
  <div className="flex flex-col gap-6 bg-bg text-text p-6">
    <section>
      <h3 className="text-xs text-muted mb-3">Icons (w-6 h-6)</h3>
      <div className="grid grid-cols-4 gap-4">
        {ICONS.map(({ name, Icon }) => (
          <div key={name} className="flex items-center gap-2">
            <Icon className="w-6 h-6 shrink-0" />
            <span className="text-xs font-mono">{name}</span>
          </div>
        ))}
      </div>
    </section>

    <section>
      <h3 className="text-xs text-muted mb-3">Size variants (PlusIcon)</h3>
      <div className="flex items-end gap-4">
        <PlusIcon className="w-3 h-3" />
        <PlusIcon className="w-4 h-4" />
        <PlusIcon className="w-5 h-5" />
        <PlusIcon className="w-6 h-6" />
        <PlusIcon className="w-8 h-8" />
      </div>
    </section>

    <section>
      <h3 className="text-xs text-muted mb-3">BorderedIconButton</h3>
      <div className="flex gap-2 items-center">
        <BorderedIconButton label="Delete" onClick={fn()} danger>
          <TrashIcon className="w-4 h-4" />
        </BorderedIconButton>
        <BorderedIconButton label="Refresh" onClick={fn()}>
          <RefreshIcon className="w-4 h-4" />
        </BorderedIconButton>
        <BorderedIconButton label="Close" onClick={fn()} disabled>
          <XIcon className="w-4 h-4" />
        </BorderedIconButton>
      </div>
    </section>
  </div>
);

const meta: Meta<typeof Gallery> = {
  component: Gallery,
  title: 'ui/Icons',
  tags: ['autodocs'],
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {};
