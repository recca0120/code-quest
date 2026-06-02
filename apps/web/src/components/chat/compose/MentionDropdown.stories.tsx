import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MentionDropdown } from './MentionDropdown.tsx';

const meta: Meta<typeof MentionDropdown> = {
  component: MentionDropdown,
  tags: ['autodocs'],
  args: { onSelectMention: fn() },
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div className="bg-bg text-text w-2xl p-4 flex flex-col gap-1">
        <Story />
        {/* Simulated compose input to give the dropdown spatial context */}
        <div className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-muted">
          @
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof MentionDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticSuggestions: Story = {
  args: {
    mentionQuery: 'src',
    filteredSuggestions: ['src/index.ts', 'src/App.tsx', 'src/utils/helpers.ts'],
    fileResults: [],
    searchStatus: 'idle',
    selectedIndex: -1,
    hasFileSearch: false,
  },
};

export const FileSearchResults: Story = {
  args: {
    mentionQuery: 'main',
    filteredSuggestions: [],
    fileResults: [
      { path: 'src/main.ts', name: 'main.ts', type: 'file' },
      { path: 'src/main.test.ts', name: 'main.test.ts', type: 'file' },
      { path: 'apps/server/src/main.ts', name: 'main.ts', type: 'file' },
    ],
    searchStatus: 'done',
    selectedIndex: 1,
    hasFileSearch: true,
  },
};

export const Loading: Story = {
  args: {
    mentionQuery: 'test',
    filteredSuggestions: [],
    fileResults: [],
    searchStatus: 'loading',
    selectedIndex: -1,
    hasFileSearch: true,
  },
};

export const NoResults: Story = {
  args: {
    mentionQuery: 'nonexistent',
    filteredSuggestions: [],
    fileResults: [],
    searchStatus: 'done',
    selectedIndex: -1,
    hasFileSearch: true,
  },
};

export const DirectoryResults: Story = {
  args: {
    mentionQuery: 'src',
    filteredSuggestions: [],
    fileResults: [
      { path: 'src/', name: 'src', type: 'directory' },
      { path: 'src/components/', name: 'components', type: 'directory' },
      { path: 'src/utils/', name: 'utils', type: 'directory' },
    ],
    searchStatus: 'done',
    selectedIndex: 0,
    hasFileSearch: true,
  },
};
