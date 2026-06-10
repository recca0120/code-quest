import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App.tsx';
import { usePreferencesStore } from '../stores/usePreferencesStore.ts';

describe('App', () => {
  it('renders Workspace without hitting ErrorBoundary — all providers are present', async () => {
    render(<App />);

    await waitFor(() => expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument());
  });

  it('shows only EmptyState when no projects exist — no sidebar or tab bar', async () => {
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add Project' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('tablist', { name: 'tab-bar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'sidebar-panel' })).not.toBeInTheDocument();
  });

  it('syncs preferences axes to <html> data-attrs', async () => {
    usePreferencesStore.setState({
      colorTheme: 'light',
      fontSize: 'lg',
      density: 'compact',
    });
    render(<App />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
    expect(document.documentElement.dataset.font).toBe('lg');
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('writes resolved effective theme to data-theme when preference is system', async () => {
    usePreferencesStore.setState({ colorTheme: 'system' });
    render(<App />);
    await waitFor(() => {
      const theme = document.documentElement.dataset.theme;
      expect(theme === 'dark' || theme === 'light').toBe(true);
    });
    expect(document.documentElement.dataset.theme).not.toBe('system');
  });
});
