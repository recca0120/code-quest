import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VISIBILITY_GROUPS } from '@/contexts/channel/MessageVisibilityContext';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { SettingsDialog } from '../SettingsDialog.tsx';

function resetStore() {
  usePreferencesStore.setState({
    colorTheme: 'clay-dark',
    fontSize: 'm',
    density: 'default',
    hiddenItems: [],
  });
  usePreferencesStore.setState({ enabledTypes: null });
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    usePreferencesStore.setState({ enabledTypes: null });
  });

  it('does not render when closed', () => {
    render(<SettingsDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking Close calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SettingsDialog open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('layout', () => {
    it('renders left nav with Theme and Display sections', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      const nav = screen.getByRole('navigation', { name: 'Settings sections' });
      const items = within(nav).getAllByRole('tab');
      expect(items.map((el) => el.textContent)).toEqual(['Theme', 'Display']);
    });

    it('Theme is active by default', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');
    });

    it('clicking Display switches the active section', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('tab', { name: 'Display' }));
      expect(screen.getByRole('tab', { name: 'Display' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'false');
    });

    it('shows live-save hint', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(
        screen.getByText(/Changes apply instantly and are saved automatically/i),
      ).toBeInTheDocument();
    });
  });

  describe('Theme section', () => {
    it('renders theme preference controls by default', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByLabelText('switch-color-theme-pills')).toBeInTheDocument();
      expect(screen.getByLabelText('font-size-pills')).toBeInTheDocument();
      expect(screen.getByLabelText('density-pills')).toBeInTheDocument();
    });

    it('color theme pills include Dark, Light, Roast, and System', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Roast' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
    });

    it('reflects current store values as selected pills', () => {
      usePreferencesStore.setState({ colorTheme: 'light', fontSize: 'l', density: 'compact' });
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Large' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();
    });

    it('clicking fontSize=Large updates store', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('radio', { name: 'Large' }));
      expect(usePreferencesStore.getState().fontSize).toBe('l');
    });

    it('clicking Light theme updates store', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('radio', { name: 'Light' }));
      expect(usePreferencesStore.getState().colorTheme).toBe('light');
    });

    it('clicking Compact density updates store', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('radio', { name: 'Compact' }));
      expect(usePreferencesStore.getState().density).toBe('compact');
    });
  });

  describe('Display section', () => {
    it('renders filter group rows when Display tab is active', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('tab', { name: 'Display' }));
      for (const group of VISIBILITY_GROUPS) {
        expect(screen.getByLabelText(`group-row-${group.id}`)).toBeInTheDocument();
      }
    });

    it('does not show filter groups when Theme tab is active', () => {
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      expect(screen.queryByLabelText('group-row-conversation')).not.toBeInTheDocument();
    });

    it('conversation group is on by default', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('tab', { name: 'Display' }));
      expect(screen.getByLabelText('group-row-conversation')).toHaveAttribute('data-state', 'all');
    });

    it('hooks group is off by default', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('tab', { name: 'Display' }));
      expect(screen.getByLabelText('group-row-hooks')).toHaveAttribute('data-state', 'none');
    });

    it('toggling a group updates the visibility store', async () => {
      const user = userEvent.setup();
      render(<SettingsDialog open={true} onClose={vi.fn()} />);
      await user.click(screen.getByRole('tab', { name: 'Display' }));
      const hooksRow = screen.getByLabelText('group-row-hooks');
      const toggle = within(hooksRow).getByLabelText('group-toggle');
      await user.click(toggle);
      const stored = usePreferencesStore.getState().enabledTypes;
      expect(stored).toContain('hook_started');
    });
  });
});
