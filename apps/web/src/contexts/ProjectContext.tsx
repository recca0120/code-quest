import {
  EVENTS,
  type ProjectsRemovedEvent,
  type Project as ServerProject,
} from '@code-quest/schemas';
import { isRecord } from '@code-quest/utils';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { useSocket } from './SocketContext.tsx';

export interface Project {
  cwd: string;
  name: string;
  pinned: boolean;
  lastOpenedAt: string;
}

/** Adapter: server `Project` (path + metadata) → UI `Project` (cwd + name + ...).
 *  Maps server-side `path` to UI-side `cwd`; passes through metadata fields. */
function toUiProject(p: ServerProject): Project {
  return {
    cwd: p.path,
    name: p.name,
    pinned: p.pinned,
    lastOpenedAt: p.lastOpenedAt,
  };
}

interface ProjectState {
  projects: Project[];
  activeProjectCwd: string | null;
}

interface ProjectActions {
  /**
   * Adds project via server. Returns project on success or
   * `{ error: 'path_not_found' | 'path_not_directory' | ... }`.
   * Becomes the active project on success.
   */
  addProject: (cwd: string) => Promise<Project | { error: string; path?: string }>;
  setActiveProject: (cwd: string) => void;

  /** Toggle pinned state via server. */
  pinProject: (cwd: string, pinned: boolean) => Promise<ProjectMutationResult>;
  /** Update display name via server. */
  renameProject: (cwd: string, name: string) => Promise<ProjectMutationResult>;
  /**
   * Remove project via server. Server rejects when active sessions exist
   * for the path; resolves to `{ error: 'project_has_active_sessions',
   * activeSessionCount }` in that case.
   */
  removeProject: (cwd: string) => Promise<ProjectMutationResult>;
}

const ProjectStateContext: React.Context<ProjectState | null> = createContext<ProjectState | null>(
  null,
);
export const ProjectActionsContext: React.Context<ProjectActions | null> =
  createContext<ProjectActions | null>(null);

export function useProjectState(): ProjectState {
  const ctx = useContext(ProjectStateContext);
  if (!ctx) throw new Error('useProjectState must be used within a ProjectProvider');
  return ctx;
}

export function useProjectActions(): ProjectActions {
  const ctx = useContext(ProjectActionsContext);
  if (!ctx) throw new Error('useProjectActions must be used within a ProjectProvider');
  return ctx;
}

type Socket = ReturnType<typeof useSocket>['socket'];

/** Resolve (socket, target) for a cwd, returning the pre-flight error when either fails. */
function resolveTarget(
  socket: Socket | null,
  knownProjects: ServerProject[],
  cwd: string,
): { socket: Socket; target: ServerProject } | { error: 'socket_not_ready' | 'project_not_found' } {
  if (!socket) return { error: 'socket_not_ready' };
  const target = knownProjects.find((p) => p.path === cwd);
  if (!target) return { error: 'project_not_found' };
  return { socket, target };
}

function logOnError(action: string, res: unknown): void {
  if (isRecord(res) && 'error' in res && res.error) {
    console.warn(`[ProjectContext] ${action} failed:`, res);
  }
}

function mutateProject(
  socket: Socket | null,
  knownProjects: ServerProject[],
  cwd: string,
  patch: { name?: string; pinned?: boolean; color?: string | null },
): Promise<ProjectMutationResult> {
  return new Promise((resolve) => {
    const pre = resolveTarget(socket, knownProjects, cwd);
    if ('error' in pre) {
      logOnError('pinProject/renameProject', pre);
      resolve(pre);
      return;
    }
    pre.socket.emit(EVENTS.projects.update, { id: pre.target.id, patch }, (res) => {
      logOnError('projects:update', res);
      resolve('error' in res ? res : toUiProject(res));
    });
  });
}

function removeProjectImpl(
  socket: Socket | null,
  knownProjects: ServerProject[],
  cwd: string,
): Promise<ProjectMutationResult> {
  return new Promise((resolve) => {
    const pre = resolveTarget(socket, knownProjects, cwd);
    if ('error' in pre) {
      logOnError('removeProject', pre);
      resolve(pre);
      return;
    }
    pre.socket.emit(EVENTS.projects.remove, { id: pre.target.id }, (res) => {
      logOnError('projects:remove', res);
      resolve('error' in res ? res : toUiProject(pre.target));
    });
  });
}

type ProjectMutationResult = Project | { error: string; activeSessionCount?: number };

function pickNextActive(remaining: ServerProject[]): string | null {
  if (remaining.length === 0) return null;
  const sorted = [...remaining].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.lastOpenedAt < b.lastOpenedAt ? 1 : -1;
  });
  return sorted[0]?.path ?? null;
}

export function ProjectProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { socket } = useSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectCwd, setActiveProjectCwd] = useState<string | null>(null);

  // Stable socket ref so actions captured in initial useState don't go stale.
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Server projects (with `id` + path) — actions need this to resolve cwd → id.
  const serverProjectsRef = useRef<ServerProject[]>([]);
  const activeRef = useRef<string | null>(activeProjectCwd);
  useEffect(() => {
    activeRef.current = activeProjectCwd;
  }, [activeProjectCwd]);

  useEffect(() => {
    if (!socket) return;

    socket.emit(EVENTS.projects.list, {}, (res) => {
      if ('error' in res) {
        toast.error(`Failed to load projects: ${res.error}`);
        return;
      }
      serverProjectsRef.current = res.projects;
      setProjects(res.projects.map(toUiProject));
    });

    const onAdded = (p: ServerProject) => {
      const exists = serverProjectsRef.current.some((x) => x.path === p.path);
      if (!exists) serverProjectsRef.current = [...serverProjectsRef.current, p];
      setProjects((prev) =>
        prev.some((x) => x.cwd === p.path) ? prev : [...prev, toUiProject(p)],
      );
    };
    const onUpdated = (p: ServerProject) => {
      serverProjectsRef.current = serverProjectsRef.current.map((x) => (x.path === p.path ? p : x));
      setProjects((prev) => prev.map((x) => (x.cwd === p.path ? toUiProject(p) : x)));
    };
    const onRemoved = (event: ProjectsRemovedEvent) => {
      serverProjectsRef.current = serverProjectsRef.current.filter((x) => x.path !== event.path);
      setProjects((prev) => prev.filter((x) => x.cwd !== event.path));
      // If removed project was active, switch to next (pinned-first, then recent).
      if (activeRef.current === event.path) {
        const next = pickNextActive(serverProjectsRef.current);
        setActiveProjectCwd(next);
      }
    };

    socket.on(EVENTS.projects.added, onAdded);
    socket.on(EVENTS.projects.updated, onUpdated);
    socket.on(EVENTS.projects.removed, onRemoved);

    return () => {
      socket.off(EVENTS.projects.added, onAdded);
      socket.off(EVENTS.projects.updated, onUpdated);
      socket.off(EVENTS.projects.removed, onRemoved);
    };
  }, [socket]);

  // Stable identity for actions — TabProvider relies on this in dep arrays.
  const [actions] = useState<ProjectActions>(() => ({
    addProject: (cwd: string) =>
      new Promise<Project | { error: string; path?: string }>((resolve) => {
        const s = socketRef.current;
        if (!s) {
          resolve({ error: 'socket_not_ready' });
          return;
        }
        s.emit(EVENTS.projects.add, { path: cwd }, (res) => {
          if ('error' in res) {
            logOnError('projects:add', res);
            resolve(res);
            return;
          }
          setActiveProjectCwd(res.path);
          resolve(toUiProject(res));
        });
      }),
    setActiveProject: (cwd: string) => setActiveProjectCwd(cwd),

    pinProject: (cwd: string, pinned: boolean) =>
      mutateProject(socketRef.current, serverProjectsRef.current, cwd, { pinned }),
    renameProject: (cwd: string, name: string) =>
      mutateProject(socketRef.current, serverProjectsRef.current, cwd, { name }),
    removeProject: (cwd: string) =>
      removeProjectImpl(socketRef.current, serverProjectsRef.current, cwd),
  }));

  const state = useMemo<ProjectState>(
    () => ({ projects, activeProjectCwd }),
    [projects, activeProjectCwd],
  );
  return (
    <ProjectStateContext.Provider value={state}>
      <ProjectActionsContext.Provider value={actions}>{children}</ProjectActionsContext.Provider>
    </ProjectStateContext.Provider>
  );
}
