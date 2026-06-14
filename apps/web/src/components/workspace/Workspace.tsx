import type { WorktreeInfo } from '@code-quest/git';
import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCommandPaletteActions, useCommandPaletteState } from '@/contexts/CommandPaletteContext';
import { DrawerProvider } from '@/contexts/DrawerContext.tsx';
import { useGitActions, useGitState } from '@/contexts/GitContext';
import { useNavigationState } from '@/contexts/NavigationContext';
import { useProjectActions, useProjectState } from '@/contexts/ProjectContext';
import { useSession } from '@/contexts/SessionContext';
import {
  findPaneByChannel,
  leafIdsInOrder,
  TabProvider,
  usePaneActions,
  usePaneState,
} from '@/contexts/TabContext';
import {
  useWorkspaceDialogsActions,
  WorkspaceDialogsProvider,
} from '@/contexts/WorkspaceDialogsContext';
import { NO_FORM } from '@/utils/hotkey-options';
import { DrawerHost } from './DrawerHost.tsx';
import { KeyboardShortcutsProvider } from './KeyboardShortcutsProvider.tsx';
import { NavigationIntentBridge } from './NavigationIntentBridge.tsx';
import { PanePicker } from './PanePicker.tsx';
import { CIRCLED } from './pane-label.ts';
import { TabContainer } from './TabContainer.tsx';
import { WorkspaceDialogs } from './WorkspaceDialogs.tsx';

type PanePickerConfig = Omit<
  React.ComponentProps<typeof PanePicker>,
  'onShowHere' | 'onOpenToolPane' | 'onResume' | 'pastSessions'
>;

function ConnectedPanePicker(props: PanePickerConfig) {
  const { setSessionInPane, setContentInPane, focusPane, splitPaneAndSetContent, openToolColumn } =
    usePaneActions();
  const { focusedPaneId, paneRoot } = usePaneState();
  const { listSessions, resume } = useSession();
  const { jumpTo } = useCommandPaletteActions();
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

  // 進行中列的 pane 編號（handoff §4）：與 ZoomBar/Pane badge 同源 leafIdsInOrder ①②…
  const leaves = leafIdsInOrder(paneRoot);

  const enrichedSessions = props.sessions?.map((s) => {
    const paneId = findPaneByChannel(paneRoot, s.channelId);
    const idx = paneId ? leaves.indexOf(paneId) : -1;
    return {
      ...s,
      paneLabel:
        idx >= 0 ? `pane ${idx < CIRCLED.length ? CIRCLED[idx] : `#${idx + 1}`}` : undefined,
    };
  });

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
      onJumpTo={(channelId, messageId) => {
        jumpTo(channelId, messageId);
        props.onClose();
      }}
    />
  );
}

function DocumentTitle() {
  const { sessions } = useSession();
  const isBusy = sessions.some((s) => s.state === 'busy');
  useEffect(() => {
    document.title = isBusy ? '⟳ Code Quest' : 'Code Quest';
  }, [isBusy]);
  return null;
}

export function Workspace(): React.JSX.Element {
  return (
    <WorkspaceDialogsProvider>
      <WorkspaceInner />
    </WorkspaceDialogsProvider>
  );
}

function WorkspaceInner(): React.JSX.Element {
  const { closePalette } = useCommandPaletteActions();
  const { open: paletteOpen, defaultTab: paletteDefaultTab } = useCommandPaletteState();
  const { openAddProject, openSettings, openCreateWorktree } = useWorkspaceDialogsActions();
  const [panePickerOpen, setOpenInPaneModalOpen] = useState(false);
  const [pickerInitialQuery, setPickerInitialQuery] = useState<string | undefined>();
  const [openInPaneTargetPaneId, setOpenInPaneTargetPaneId] = useState<string | undefined>();
  const [pendingSession, setPendingSession] = useState<{
    projectCwd: string;
    sessionCwd: string;
    branch?: string;
    targetPaneId?: string;
  } | null>(null);

  const { projects, activeProjectCwd } = useProjectState();
  const { sessions } = useSession();
  const { selectedWorktreeCwd } = useNavigationState();
  const { setActiveProject } = useProjectActions();
  const { listing } = useGitState();
  const { list: listWorktrees } = useGitActions();

  const handleSessionCreated = useCallback(() => setPendingSession(null), []);
  const handleOpenModal = useCallback((paneId?: string, opts?: { initialQuery?: string }) => {
    setOpenInPaneTargetPaneId(paneId);
    setPickerInitialQuery(opts?.initialQuery);
    setOpenInPaneModalOpen(true);
  }, []);
  useHotkeys('mod+shift+k', () => handleOpenModal(undefined, { initialQuery: '›' }), NO_FORM);

  useEffect(() => {
    if (paletteOpen) {
      closePalette();
      const initialQuery = paletteDefaultTab === 'messages' ? '›search ' : '›';
      handleOpenModal(undefined, { initialQuery });
    }
  }, [paletteOpen, paletteDefaultTab, closePalette, handleOpenModal]);

  const handleOpenSettings = useCallback(() => openSettings(), [openSettings]);
  const handleNewWorktree = useCallback(
    (projectCwd: string) => {
      setActiveProject(projectCwd);
      openCreateWorktree(projectCwd);
    },
    [setActiveProject, openCreateWorktree],
  );

  useEffect(() => {
    for (const p of projects) {
      if (!(p.cwd in listing)) {
        void listWorktrees(p.cwd);
      }
    }
  }, [projects, listing, listWorktrees]);

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
      <DocumentTitle />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpenIcon className="w-10 h-10" />}
          message="No projects yet"
          actionLabel="Add Project"
          onAction={openAddProject}
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
          <DrawerProvider>
            <KeyboardShortcutsProvider onOpenPicker={handleOpenModal}>
              <TabContainer
                pendingNewSession={pendingNewSession}
                onSessionCreated={handleSessionCreated}
                onOpenModal={handleOpenModal}
                onOpenSettings={handleOpenSettings}
                onNewWorktree={handleNewWorktree}
              />
              <DrawerHost />
            </KeyboardShortcutsProvider>
          </DrawerProvider>
          <ConnectedPanePicker
            open={panePickerOpen}
            onClose={() => setOpenInPaneModalOpen(false)}
            initialQuery={pickerInitialQuery}
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
            onNewSession={(cwd, projectCwd, targetPaneId, _opts, branch) => {
              setActiveProject(projectCwd);
              setPendingSession({ projectCwd, sessionCwd: cwd, targetPaneId, branch });
              setOpenInPaneModalOpen(false);
            }}
            onNewWorktree={(projectCwd) => {
              setActiveProject(projectCwd);
              openCreateWorktree(projectCwd);
              setOpenInPaneModalOpen(false);
            }}
            onAddProject={() => {
              openAddProject();
              setOpenInPaneModalOpen(false);
            }}
          />
        </TabProvider>
      )}
      <WorkspaceDialogs
        onWorktreeCreated={(projectCwd, path) => {
          setPendingSession({ projectCwd, sessionCwd: path });
        }}
      />
    </main>
  );
}
