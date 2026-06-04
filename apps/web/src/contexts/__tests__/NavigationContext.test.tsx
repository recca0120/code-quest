import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  NavigationProvider,
  useNavigationActions,
  useNavigationState,
} from '../NavigationContext.tsx';

function wrapper({ children }: { children: ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>;
}

describe('NavigationContext', () => {
  describe('pendingActivateChannel', () => {
    it('starts as null', () => {
      const { result } = renderHook(() => useNavigationState(), { wrapper });
      expect(result.current.pendingActivateChannel).toBeNull();
    });

    it('requestActivateChannel sets pendingActivateChannel', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.requestActivateChannel('/proj', 'ch-1');
      });

      expect(result.current.state.pendingActivateChannel).toEqual({
        cwd: '/proj',
        channelId: 'ch-1',
      });
    });

    it('actions object keeps stable identity across state updates', () => {
      const { result, rerender } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      const firstActions = result.current.actions;

      act(() => {
        result.current.actions.requestActivateChannel('/proj', 'ch-1');
      });
      rerender();

      expect(result.current.actions).toBe(firstActions);
    });

    it('clearPendingActivate resets to null', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.requestActivateChannel('/proj', 'ch-1');
      });
      act(() => {
        result.current.actions.clearPendingActivate();
      });

      expect(result.current.state.pendingActivateChannel).toBeNull();
    });
  });

  describe('activeCwd', () => {
    it('starts as null', () => {
      const { result } = renderHook(() => useNavigationState(), { wrapper });
      expect(result.current.activeCwd).toBeNull();
    });

    it('setActiveCwd updates activeCwd', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.setActiveCwd('/repo/worktree');
      });

      expect(result.current.state.activeCwd).toBe('/repo/worktree');
    });

    it('setActiveCwd(null) clears activeCwd', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.setActiveCwd('/repo/wt');
      });
      act(() => {
        result.current.actions.setActiveCwd(null);
      });

      expect(result.current.state.activeCwd).toBeNull();
    });
  });

  it('state object keeps stable identity when no state changes', () => {
    const { result, rerender } = renderHook(() => useNavigationState(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  describe('navigation memory', () => {
    it('lastWorktreeByProject starts empty', () => {
      const { result } = renderHook(() => useNavigationState(), { wrapper });
      expect(result.current.lastWorktreeByProject).toEqual({});
    });

    it('recordLastWorktree stores the worktree for the project', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      act(() => {
        result.current.actions.recordLastWorktree('/proj', '/proj/wt-feat');
      });
      expect(result.current.state.lastWorktreeByProject).toEqual({ '/proj': '/proj/wt-feat' });
    });

    it('recordLastWorktree updates when called again for same project', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      act(() => result.current.actions.recordLastWorktree('/proj', '/proj/wt-a'));
      act(() => result.current.actions.recordLastWorktree('/proj', '/proj/wt-b'));
      expect(result.current.state.lastWorktreeByProject['/proj']).toBe('/proj/wt-b');
    });

    it('lastTabByWorktree starts empty', () => {
      const { result } = renderHook(() => useNavigationState(), { wrapper });
      expect(result.current.lastTabByWorktree).toEqual({});
    });

    it('recordLastTab stores the channelId for the worktree', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      act(() => {
        result.current.actions.recordLastTab('/proj/wt-feat', 'ch-abc');
      });
      expect(result.current.state.lastTabByWorktree).toEqual({ '/proj/wt-feat': 'ch-abc' });
    });

    it('recordLastTab updates when called again for same worktree', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      act(() => result.current.actions.recordLastTab('/proj/wt', 'ch-1'));
      act(() => result.current.actions.recordLastTab('/proj/wt', 'ch-2'));
      expect(result.current.state.lastTabByWorktree['/proj/wt']).toBe('ch-2');
    });

    it('actions keep stable identity after recordLastWorktree', () => {
      const { result, rerender } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );
      const first = result.current.actions;
      act(() => result.current.actions.recordLastWorktree('/proj', '/proj/wt'));
      rerender();
      expect(result.current.actions).toBe(first);
    });
  });

  describe('pendingOpenWorktree', () => {
    it('requestOpenWorktree sets intent with forceNew default false', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.requestOpenWorktree('/proj', '/proj/.claude/worktrees/x');
      });

      expect(result.current.state.pendingOpenWorktree).toEqual({
        projectCwd: '/proj',
        worktreeCwd: '/proj/.claude/worktrees/x',
        forceNew: false,
      });
    });

    it('requestOpenWorktree with forceNew=true', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.requestOpenWorktree('/p', '/p/wt', true);
      });

      expect(result.current.state.pendingOpenWorktree?.forceNew).toBe(true);
    });

    it('clearPendingOpenWorktree resets to null', () => {
      const { result } = renderHook(
        () => ({ state: useNavigationState(), actions: useNavigationActions() }),
        { wrapper },
      );

      act(() => {
        result.current.actions.requestOpenWorktree('/p', '/p/wt');
      });
      act(() => {
        result.current.actions.clearPendingOpenWorktree();
      });

      expect(result.current.state.pendingOpenWorktree).toBeNull();
    });
  });
});
