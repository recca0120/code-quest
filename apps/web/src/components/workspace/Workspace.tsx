import type { WorktreeInfo } from '@code-quest/git';
import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCommandPaletteActions } from '@/contexts/CommandPaletteContext';
import { useGitActions, useGitState } from '@/contexts/GitContext';
import { useNavigationState } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  buildSessionPaneLabels,
  TabProvider,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';
import { NO_FORM } from '@/utils/hotkey-options';
import { CommandPalette } from '../palette/CommandPalette.tsx';
import { AddProjectDialog } from '../project/AddProjectDialog.tsx';
import { CreateWorktreeDialog } from '../project/CreateWorktreeDialog.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';
import { KeyboardShortcutsProvider } from './KeyboardShortcutsProvider.tsx';
import { NavigationIntentBridge } from './NavigationIntentBridge.tsx';
import { PanePicker } from './PanePicker.tsx';
import { TabContainer } from './TabContainer.tsx';

type PanePickerConfig = Omit<
  React.ComponentProps<typeof PanePicker>,
  'onShowHere' | 'onOpenToolPane' | 'onResume' | 'pastSessions'
>;

function ConnectedPanePicker(props: PanePickerConfig) {
  const { setSessionInPane, setContentInPane, focusPane, splitPaneAndSetContent, openToolColumn } =
    usePaneActions();
  const { focusedPaneId, paneRoot } = usePaneState();
  const { listSessions, resume } = useSession();
  const [pastSessions, setPastSessions] = useState<
    Array<{ id: string; channelId: string; title?: string; cwd?: string; createdAt: string }>
  >([]);

  useEffect(() => {
    if (!props.open) return;
    void listSessions({ excludeLive: true, limit: 50 }).then((res) => {
      if (res.ok)
        setPastSessions(
          res.data.sessions.map((s) => ({
            id: s.id,
            channelId: s.channelId,
            title: s.title,
            cwd: s.cwd,
            createdAt: s.createdAt,
          })),
        );
    });
  }, [props.open, listSessions]);

  const sessionPaneLabels = buildSessionPaneLabels(paneRoot);

  const enrichedSessions = props.sessions?.map((s) => ({
    ...s,
    paneLabel: sessionPaneLabels.get(s.channelId) || undefined,
  }));

  return (
    <PanePicker
      {...props}
      sessions={enrichedSessions}
      pastSessions={pastSessions}
      onShowHere={(channelId, paneId) => {
        const target = paneId ?? focusedPaneId;
        if (target) {
          const session = props.sessions?.find((s) => s.channelId === channelId);
          setSessionInPane(target, channelId, session?.cwd ?? null);
          focusPane(target);
        }
        props.onClose();
      }}
      onResume={async (sessionId) => {
        const res = await resume(sessionId);
        const target = props.targetPaneId ?? focusedPaneId;
        if (target) {
          const past = pastSessions.find((s) => s.id === sessionId);
          setSessionInPane(target, res.channelId, past?.cwd ?? null);
          focusPane(target);
        }
        props.onClose();
      }}
      onOpenToolPane={(type, cwd, paneId, opts) => {
        if (opts?.split) {
          // ⌘⏎ 分割開啟（handoff §4 鍵位列）
          splitPaneAndSetContent('h', { type, target: { kind: 'fixed', cwd } });
        } else {
          const target = paneId ?? focusedPaneId;
          if (target) {
            setContentInPane(target, { type, target: { kind: 'fixed', cwd } });
            focusPane(target);
          }
        }
        props.onClose();
      }}
      onOpenCombo={(cwd, projectCwd) => {
        // 標準工作組（⌘1）：先建右側 files/git 直欄（focus 留原 pane），chat 經
        // pendingSession 管線落原 focused pane
        openToolColumn(cwd);
        props.onNewSession?.(cwd, projectCwd, undefined);
      }}
    />
  );
}

const ADD_PROJECT_ERRORS: Record<string, (p: string) => string> = {
  path_not_found: (p) => `Path not found: ${p}`,
  path_not_directory: (p) => `Not a directory: ${p}`,
};

function DocumentTitle() {
  const { sessions } = useSession();
  const isBusy = sessions.some((s) => s.state === 'busy');
  useEffect(() => {
    document.title = isBusy ? '⟳ Code Quest' : 'Code Quest';
  }, [isBusy]);
  return null;
}

export function Workspace(): React.JSX.Element {
  const { openPalette, registerActions } = useCommandPaletteActions();
  // ⌘K 讓給 PanePicker（handoff §4：唯一內容入口）；palette 改 ⌘⇧K
  useHotkeys('mod+shift+k', () => openPalette(), NO_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [worktreeDialogOpen, setWorktreeDialogOpen] = useState(false);
  const [panePickerOpen, setOpenInPaneModalOpen] = useState(false);
  const [openInPaneTargetPaneId, setOpenInPaneTargetPaneId] = useState<string | undefined>();
  const [pendingSession, setPendingSession] = useState<{
    projectCwd: string;
    sessionCwd: string;
    branch?: string;
    targetPaneId?: string;
  } | null>(null);

  useEffect(() => {
    registerActions({
      onAddProject: () => setDialogOpen(true),
      onOpenSettings: () => setSettingsOpen(true),
    });
  }, [registerActions]);

  const { projects, activeProjectCwd } = useProjectState();
  const { sessions } = useSession();
  const { selectedWorktreeCwd } = useNavigationState();
  const { addProject, setActiveProject } = useProjectActions();
  const { listing } = useGitState();
  const { list: listWorktrees } = useGitActions();

  // Stable identities for TabContainer props — Workspace re-renders on every
  // session:states tick; inline arrows here would defeat memo(TabContainer)
  // and churn paneEnvironment (the D5 render-isolation invariant)
  const handleSessionCreated = useCallback(() => setPendingSession(null), []);
  const handleOpenModal = useCallback((paneId?: string) => {
    setOpenInPaneTargetPaneId(paneId);
    setOpenInPaneModalOpen(true);
  }, []);
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const handleOpenAddProjectDialog = useCallback(() => setDialogOpen(true), []);
  const handleNewWorktree = useCallback(
    (projectCwd: string) => {
      setActiveProject(projectCwd);
      setWorktreeDialogOpen(true);
    },
    [setActiveProject],
  );

  useEffect(() => {
    for (const p of projects) {
      if (!(p.cwd in listing)) {
        void listWorktrees(p.cwd);
      }
    }
  }, [projects, listing, listWorktrees]);

  async function handleAddProject(cwd: string) {
    const res = await addProject(cwd);
    if ('error' in res) {
      const p = res.path ?? cwd;
      const msg = ADD_PROJECT_ERRORS[res.error]?.(p) ?? `Could not add project (${res.error})`;
      toast.error(msg);
      return;
    }
    setDialogOpen(false);
  }

  const addedProjectCwds = useMemo(() => new Set(projects.map((p) => p.cwd)), [projects]);

  // Stable identity per pendingSession value — an inline object would re-fire
  // TabContainer's create effect on every Workspace render (duplicate sessions)
  const pendingNewSession = useMemo(
    () =>
      pendingSession
        ? {
            cwd: pendingSession.sessionCwd,
            projectCwd: pendingSession.projectCwd,
            branch: pendingSession.branch,
            targetPaneId: pendingSession.targetPaneId,
          }
        : null,
    [pendingSession],
  );

  const allWorktrees = useMemo(() => {
    const result: Record<string, WorktreeInfo[]> = {};
    for (const p of projects) {
      const entry = listing[p.cwd];
      // undefined = 尚未載入（picker 顯示 loading）；error/非陣列 = 已回但失敗 → 空列表
      if (entry !== undefined) result[p.cwd] = Array.isArray(entry) ? entry : [];
    }
    return result;
  }, [listing, projects]);

  const projectList = useMemo(
    () => projects.map((p) => ({ cwd: p.cwd, name: p.name })),
    [projects],
  );

  return (
    <main className="flex flex-col flex-1 overflow-hidden">
      <CommandPalette />
      <DocumentTitle />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpenIcon className="w-10 h-10" />}
          message="No projects yet"
          actionLabel="Add Project"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <TabProvider
          sessions={sessions}
          cwd={activeProjectCwd ?? undefined}
          selectedCwd={
            activeProjectCwd ? (selectedWorktreeCwd[activeProjectCwd] ?? undefined) : undefined
          }
        >
          <NavigationIntentBridge />
          <KeyboardShortcutsProvider
            onNewSession={(cwd, projectCwd) => {
              setActiveProject(projectCwd);
              setPendingSession({ projectCwd, sessionCwd: cwd });
            }}
            onNewWorktree={handleNewWorktree}
            onAddProject={handleOpenAddProjectDialog}
            onOpenPicker={handleOpenModal}
          >
            <TabContainer
              pendingNewSession={pendingNewSession}
              onSessionCreated={handleSessionCreated}
              onOpenModal={handleOpenModal}
              onOpenSettings={handleOpenSettings}
              onAddProject={handleOpenAddProjectDialog}
              onNewWorktree={handleNewWorktree}
            />
          </KeyboardShortcutsProvider>
          <ConnectedPanePicker
            open={panePickerOpen}
            onClose={() => setOpenInPaneModalOpen(false)}
            sessions={sessions.map((s) => ({
              channelId: s.channelId,
              title: s.title,
              status: s.state === 'busy' ? ('busy' as const) : ('idle' as const),
              branch: s.branch,
              cwd: s.cwd,
            }))}
            projects={projectList}
            allWorktrees={allWorktrees}
            activeProjectCwd={activeProjectCwd ?? undefined}
            targetPaneId={openInPaneTargetPaneId}
            onNewSession={(cwd, projectCwd, targetPaneId) => {
              setActiveProject(projectCwd);
              setPendingSession({ projectCwd, sessionCwd: cwd, targetPaneId });
              setOpenInPaneModalOpen(false);
            }}
            onNewWorktree={(projectCwd) => {
              setActiveProject(projectCwd);
              setWorktreeDialogOpen(true);
              setOpenInPaneModalOpen(false);
            }}
            onAddProject={() => {
              setDialogOpen(true);
              setOpenInPaneModalOpen(false);
            }}
          />
        </TabProvider>
      )}
      <AddProjectDialog
        open={dialogOpen}
        onSelect={handleAddProject}
        onClose={() => setDialogOpen(false)}
        addedProjectCwds={addedProjectCwds}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {worktreeDialogOpen && activeProjectCwd && (
        <CreateWorktreeDialog
          open
          cwd={activeProjectCwd}
          onClose={() => setWorktreeDialogOpen(false)}
          onCreated={(path) => {
            // 所有現行入口都來自 new-session flow — 建完即開，終結 8 步 dead-end
            setPendingSession({ projectCwd: activeProjectCwd, sessionCwd: path });
          }}
        />
      )}
    </main>
  );
}
