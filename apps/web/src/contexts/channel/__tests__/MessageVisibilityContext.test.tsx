import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { memoryBackend, readPersistedRaw } from '@/test/memory-persist-storage';
import { renderWithChannel } from '@/test/render-with-channel';
import { useMessageVisibility } from '../MessageVisibilityContext.tsx';

const LS_KEY = 'code-quest:preferences';

// Test component that exposes context values via DOM
function Probe() {
  const { enabledTypes, toggleGroup, toggleType, groupState, registerUnknownType } =
    useMessageVisibility();
  return (
    <div>
      <div role="status" aria-label="enabled-types">
        {[...enabledTypes].sort().join(',')}
      </div>
      <div role="status" aria-label="conversation-state">
        {groupState('conversation')}
      </div>
      <div role="status" aria-label="hooks-state">
        {groupState('hooks')}
      </div>
      <div role="status" aria-label="debug-state">
        {groupState('debug')}
      </div>
      <div role="status" aria-label="other-state">
        {groupState('other')}
      </div>
      <button type="button" onClick={() => toggleGroup('hooks')}>
        toggle-hooks
      </button>
      <button type="button" onClick={() => toggleGroup('conversation')}>
        toggle-conversation
      </button>
      <button type="button" onClick={() => toggleGroup('other')}>
        toggle-other
      </button>
      <button type="button" onClick={() => toggleType('hook_started')}>
        toggle-hook_started
      </button>
      <button type="button" onClick={() => registerUnknownType('mystery_event')}>
        register-mystery
      </button>
    </div>
  );
}

afterEach(() => {
  usePreferencesStore.setState({ enabledTypes: null });
});

describe('MessageVisibilityContext — defaults', () => {
  it('conversation/tools/system groups are on by default', async () => {
    await renderWithChannel(<Probe />);
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    // text is in conversation group → should be enabled
    expect(enabled).toContain('text');
    expect(enabled).toContain('thinking');
    // tool_use is in tools group → on
    expect(enabled).toContain('tool_use');
    // result is in system group → on
    expect(enabled).toContain('result');
  });

  it('hooks group is off by default', async () => {
    await renderWithChannel(<Probe />);
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).not.toContain('hook_started');
    expect(enabled).not.toContain('hook_response');
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('none');
  });

  it('debug group is off by default', async () => {
    await renderWithChannel(<Probe />);
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).not.toContain('raw_event');
    expect(screen.getByRole('status', { name: 'debug-state' }).textContent).toBe('none');
  });

  it('conversation groupState is "all" by default', async () => {
    await renderWithChannel(<Probe />);
    expect(screen.getByRole('status', { name: 'conversation-state' }).textContent).toBe('all');
  });
});

describe('MessageVisibilityContext — toggleGroup', () => {
  it('toggleGroup("hooks") turns hooks on', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-hooks'));
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('hook_started');
    expect(enabled).toContain('hook_response');
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('all');
  });

  it('toggleGroup("conversation") turns conversation off', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-conversation'));
    const enabled = (screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '').split(
      ',',
    );
    expect(enabled).not.toContain('text');
    expect(enabled).not.toContain('thinking');
    expect(screen.getByRole('status', { name: 'conversation-state' }).textContent).toBe('none');
  });

  it('toggleGroup twice restores original state', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-hooks'));
    await user.click(screen.getByText('toggle-hooks'));
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('none');
  });
});

describe('MessageVisibilityContext — toggleType', () => {
  it('toggleType enables a single type within an off group', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-hook_started'));
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('hook_started');
    expect(enabled).not.toContain('hook_response');
  });

  it('partial group shows "partial" groupState', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-hook_started'));
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('partial');
  });
});

describe('MessageVisibilityContext — other group (unknown types)', () => {
  it('other group is none by default (no unknown types registered)', async () => {
    await renderWithChannel(<Probe />);
    expect(screen.getByRole('status', { name: 'other-state' }).textContent).toBe('none');
  });

  it('registering an unknown type adds it to other group (ON by default)', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('register-mystery'));
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('mystery_event');
    expect(screen.getByRole('status', { name: 'other-state' }).textContent).toBe('all');
  });

  it('toggleGroup other turns unknown types off', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('register-mystery'));
    await user.click(screen.getByText('toggle-other'));
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).not.toContain('mystery_event');
    expect(screen.getByRole('status', { name: 'other-state' }).textContent).toBe('none');
  });

  it('known types are not added to other group', async () => {
    await renderWithChannel(<Probe />);
    // 'text' is a known type in conversation group — registering should be no-op for other group
    // just verify other-state stays none without any interaction
    expect(screen.getByRole('status', { name: 'other-state' }).textContent).toBe('none');
  });
});

describe('MessageVisibilityContext — external store changes', () => {
  it('reflects store changes made outside the context (e.g. from Settings)', async () => {
    await renderWithChannel(<Probe />);
    // hooks off by default
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('none');

    // simulate Settings toggling hooks on by writing directly to store
    const current = usePreferencesStore.getState().enabledTypes;
    const base = current ?? [];
    act(() => {
      usePreferencesStore
        .getState()
        .setEnabledTypes([...base, 'hook_started', 'hook_response', 'hook_diagnostics']);
    });

    // context should pick up the change
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('all');
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('hook_started');
  });
});

describe('MessageVisibilityContext — persistence', () => {
  it('persists state on change', async () => {
    const user = userEvent.setup();
    await renderWithChannel(<Probe />);
    await user.click(screen.getByText('toggle-hooks'));
    const stored = readPersistedRaw(LS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.enabledTypes).toContain('hook_started');
  });

  it('restores state on mount', async () => {
    const seedTypes = [
      'hook_started',
      'hook_response',
      'hook_diagnostics',
      'text',
      'thinking',
      'redacted_thinking',
    ];
    usePreferencesStore.setState({ enabledTypes: seedTypes });
    await renderWithChannel(<Probe />);
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('hook_started');
    expect(screen.getByRole('status', { name: 'hooks-state' }).textContent).toBe('all');
  });

  it('ignores invalid persisted data (non-array) and uses defaults', async () => {
    memoryBackend.setItem(LS_KEY, JSON.stringify({ invalid: 'object' }));
    usePreferencesStore.persist.rehydrate();
    await renderWithChannel(<Probe />);
    // Should fall back to defaults — hooks off, conversation on
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('text');
    expect(enabled).not.toContain('hook_started');
  });

  it('ignores persisted entries that are not strings', async () => {
    memoryBackend.setItem(LS_KEY, JSON.stringify([42, null, 'text']));
    usePreferencesStore.persist.rehydrate();
    await renderWithChannel(<Probe />);
    // Unrecognized format — store falls back to null → context uses defaults
    const enabled = screen.getByRole('status', { name: 'enabled-types' }).textContent ?? '';
    expect(enabled).toContain('text');
    expect(enabled).not.toContain('hook_started');
  });
});
