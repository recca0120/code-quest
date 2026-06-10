// Mirrors <App /> shell (Toaster + ErrorBoundary + Workspace) without createSocket().
// For workspace-state variants see Workspace.stories.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';
import { ErrorFallback } from './components/ui/ErrorFallback.tsx';
import { Workspace } from './components/workspace/Workspace.tsx';
import { makeSession } from './test/story-fixtures.ts';
import { withStoryWorkspaceFixtures } from './test/story-workspace-decorator.tsx';

function AppShell(): React.JSX.Element {
  return (
    <>
      <Toaster position="top-right" richColors />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Workspace />
      </ErrorBoundary>
    </>
  );
}

const meta: Meta<typeof AppShell> = {
  title: 'App/Shell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultShell: Story = {
  decorators: [withStoryWorkspaceFixtures({ sessions: [makeSession()] })],
};
