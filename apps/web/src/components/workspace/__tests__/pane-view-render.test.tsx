import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderPaneView } from '../pane-view-render';

vi.mock('@/components/git/GitView', () => ({
  GitView: ({ cwd }: { cwd: string }) => <div data-testid="git-view">{cwd}</div>,
}));
vi.mock('@/components/files/FilesView', () => ({
  FilesView: ({ cwd }: { cwd: string }) => <div data-testid="files-view">{cwd}</div>,
}));
vi.mock('@/components/spec/SpecView', () => ({
  SpecView: ({ cwd }: { cwd: string }) => <div data-testid="spec-view">{cwd}</div>,
}));

describe('renderPaneView', () => {
  it('renders GitView for git type', () => {
    render(renderPaneView('git', '/repo') as React.ReactElement);
    expect(screen.getByTestId('git-view')).toHaveTextContent('/repo');
  });

  it('renders FilesView for files type', () => {
    render(renderPaneView('files', '/repo') as React.ReactElement);
    expect(screen.getByTestId('files-view')).toHaveTextContent('/repo');
  });

  it('renders SpecView for openspec type', () => {
    render(renderPaneView('openspec', '/repo') as React.ReactElement);
    expect(screen.getByTestId('spec-view')).toHaveTextContent('/repo');
  });
});
