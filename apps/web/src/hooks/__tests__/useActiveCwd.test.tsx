import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { NavigationStateContext, useActiveCwd } from '@/contexts/NavigationContext';
import { ProjectStateContext } from '@/contexts/ProjectContext';

function NavigationStub({
  activeCwd,
  children,
}: {
  activeCwd: string | null;
  children: ReactNode;
}) {
  return (
    <NavigationStateContext.Provider
      value={{
        pendingActivateChannel: null,
        pendingOpenWorktree: null,
        selectedWorktreeCwd: {},
        activeCwd,
        lastWorktreeByProject: {},
        lastTabByWorktree: {},
      }}
    >
      {children}
    </NavigationStateContext.Provider>
  );
}

function ProjectStub({ cwd, children }: { cwd: string | null; children: ReactNode }) {
  return (
    <ProjectStateContext.Provider value={{ projects: [], activeProjectCwd: cwd }}>
      {children}
    </ProjectStateContext.Provider>
  );
}

describe('useActiveCwd', () => {
  it('returns null when rendered outside any provider', () => {
    const { result } = renderHook(() => useActiveCwd());
    expect(result.current).toBeNull();
  });

  it('returns activeProjectCwd when no activeCwd is set', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <NavigationStub activeCwd={null}>
          <ProjectStub cwd="/my/project">{children}</ProjectStub>
        </NavigationStub>
      );
    }
    const { result } = renderHook(() => useActiveCwd(), { wrapper: Wrapper });
    expect(result.current).toBe('/my/project');
  });

  it('prefers activeCwd over activeProjectCwd when set', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <NavigationStub activeCwd="/repo/.claude/worktrees/wt">
          <ProjectStub cwd="/repo">{children}</ProjectStub>
        </NavigationStub>
      );
    }
    const { result } = renderHook(() => useActiveCwd(), { wrapper: Wrapper });
    expect(result.current).toBe('/repo/.claude/worktrees/wt');
  });

  it('falls through when activeCwd is null', () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <NavigationStub activeCwd={null}>
          <ProjectStub cwd="/repo">{children}</ProjectStub>
        </NavigationStub>
      );
    }
    const { result } = renderHook(() => useActiveCwd(), { wrapper: Wrapper });
    expect(result.current).toBe('/repo');
  });
});
