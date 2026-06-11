import {
  createFakeServer,
  createTestContainer,
  type ProjectStore,
  TYPES,
} from '@code-quest/server/test';
import { segments as s } from '@code-quest/test-kit';
import { act, screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithWorkspace } from '@/test/render-with-workspace';

describe('TabProvider', () => {
  describe('tab bar UI', () => {
    it('renders tab bar after adding project', async () => {
      const { addProject } = await renderWithWorkspace();
      await addProject({ path: '/projects', dirName: 'my-app' });
      expect(screen.getByRole('button', { name: /New Session/ })).toBeInTheDocument();
    });

    it('session is visible after launch', async () => {
      const { addProject: addProj } = await renderWithWorkspace();
      const proj = await addProj();
      await proj.launchSession();
      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });
  });

  describe('document title', () => {
    it('shows spinner prefix when session is busy and returns to base on idle', async () => {
      const { claude, user, addProject } = await renderWithWorkspace();
      const project = await addProject();
      await project.launchSession();
      const textarea = screen.getByPlaceholderText(/Esc to focus/i);
      await user.click(textarea);
      await user.type(textarea, 'hello');
      await user.keyboard('{Enter}');

      expect(document.title).toBe('⟳ Code Quest');

      await act(async () => {
        await claude.emitSegment(s.result());
      });
      expect(document.title).toBe('Code Quest');
    });
  });

  describe('socket events', () => {
    it('launching a session does not create duplicate tabs', async () => {
      const { claude, summoner, addProject: addProj } = await renderWithWorkspace();
      const proj = await addProj();
      await proj.launchSession();
      // Emit assistant turn to ensure session is stable
      await act(async () => {
        await claude.emitSegment(s.result());
      });
      // ② socket：React 層只發了一次 session:launch（無重複 spawn）
      expect(summoner.sentEvents('session:launch')).toHaveLength(1);
      // ① UI：only one session panel should be visible
      expect(screen.getAllByPlaceholderText(/Esc to focus/i)).toHaveLength(1);
    });

    it('a session launched elsewhere with cwd auto-creates the project (no manual addProject)', async () => {
      // 真隔離：不走 addProject——project 必須由 session 生命週期自動長出
      // （server: session:init → ProjectAutoUpserter → projects:added broadcast）
      const container = createTestContainer();
      const server = createFakeServer(container);
      onTestFinished(() => server.destroy());
      const summoner = createFakeSummoner(server);
      await renderWithWorkspace({ summoner });
      expect(screen.getByText('No projects yet')).toBeInTheDocument();

      // 另一個裝置 launch 一個帶 cwd 的 session（真 server pipeline；CLI init
      // segments 由 harness 的 prepareInit 供給容器綁定的 provider）
      const seeder = createFakeSummoner(server).claude();
      await act(async () => {
        await seeder.send('session:launch', { channelId: 'ch-auto', cwd: '/auto/repo' });
      });

      // ① UI：project 出現 → EmptyState 讓位給 workspace tab bar
      await screen.findByTestId('workspace-tab-bar');
      expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
      // ② 廣播：本 client 收到 projects:added
      expect(summoner.receivedEvents('projects:added')).toHaveLength(1);
      // ③ server store：projects row 已寫入
      await expect(
        container.get<ProjectStore>(TYPES.ProjectStore).getByPath('/auto/repo'),
      ).resolves.toMatchObject({ path: '/auto/repo' });
    });

    it('workspace remains visible after session becomes dead', async () => {
      const { claude, addProject } = await renderWithWorkspace();
      const project = await addProject();
      await project.launchSession();
      await act(async () => {
        await claude.emitSegment(s.resultResumeNotFound({ errors: ['No conversation found'] }));
      });
      await act(async () => {
        claude.handle.abort();
      });

      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });
  });
});
