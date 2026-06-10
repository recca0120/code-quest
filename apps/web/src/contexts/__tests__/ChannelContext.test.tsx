/* biome-ignore-all lint/suspicious/noExplicitAny: test file */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { MessageList } from '@/components/chat/conversation/MessageList';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import { createFakeSummoner } from '@/test/fake-summoner';
import { renderWithChannel } from '@/test/render-with-channel';
import { renderWithWorkspace } from '@/test/render-with-workspace';
import { AppConfigProvider } from '../AppInitContext.tsx';
import { ChannelProvider } from '../channel/ChannelContext.tsx';
import { useChannelId, useChannelMessages } from '../channel/index.ts';
import { NavigationProvider } from '../NavigationContext.tsx';
import { PluginProvider } from '../PluginContext.tsx';
import { ProjectProvider } from '../ProjectContext.tsx';
import { SessionProvider } from '../SessionContext.tsx';
import { SocketProvider } from '../SocketContext.tsx';
import { TabProvider } from '../TabContext.tsx';

/** Test harness that exposes channel state + actions to the DOM */
function ChannelTestHarness() {
  const actions = useChannelMessages();
  const channelId = useChannelId();
  const isCancelling = useChannelStore((s) => s.status === 'cancelling');
  const modifiedFiles = useChannelStore((s) => s.modifiedFiles);
  const planComments = useChannelStore((s) => s.planComments);
  return (
    <div>
      <span role="status" aria-label="channelId">
        {channelId}
      </span>
      <span role="status" aria-label="isCancelling">
        {String(isCancelling)}
      </span>
      <span role="status" aria-label="modifiedFiles">
        {JSON.stringify(modifiedFiles)}
      </span>
      <span role="status" aria-label="planComments">
        {JSON.stringify(planComments)}
      </span>
      <button type="button" onClick={actions.abort}>
        abort
      </button>
      <button type="button" onClick={actions.clearModifiedFiles}>
        clearModifiedFiles
      </button>
      <button type="button" onClick={() => actions.removeModifiedFile('nonexistent.ts')}>
        removeModifiedFile
      </button>
      <button
        type="button"
        onClick={() =>
          actions.addPlanComment({
            id: 'c1',
            selectedText: 'foo',
            sectionHeading: 'Plan',
            comment: 'bar',
          })
        }
      >
        addPlanComment
      </button>
      <button type="button" onClick={actions.clearPlanComments}>
        clearPlanComments
      </button>
    </div>
  );
}

async function setup() {
  const user = userEvent.setup();
  const ctx = await renderWithChannel(<ChannelTestHarness />);
  return { ...ctx, user };
}

describe('ChannelContext', () => {
  it('provides channelId via useChannelMessages', async () => {
    const { channelId } = await setup();
    expect(screen.getByRole('status', { name: 'channelId' })).toHaveTextContent(channelId);
  });

  it('abort changes status to cancelling', async () => {
    const { user } = await setup();
    expect(screen.getByRole('status', { name: 'isCancelling' })).toHaveTextContent('false');
    await user.click(screen.getByRole('button', { name: 'abort' }));
    expect(screen.getByRole('status', { name: 'isCancelling' })).toHaveTextContent('true');
  });

  it('throws when useChannelMessages is called outside provider', () => {
    expect(() => {
      renderHook(() => useChannelMessages());
    }).toThrow('must be used within a ChannelMessagesProvider');
  });

  describe('semantic state APIs', () => {
    it('clearModifiedFiles resets modifiedFiles to empty', async () => {
      const { user } = await setup();
      await user.click(screen.getByRole('button', { name: 'clearModifiedFiles' }));
      expect(screen.getByRole('status', { name: 'modifiedFiles' })).toHaveTextContent('{}');
    });

    it('removeModifiedFile removes a single file', async () => {
      const { user } = await setup();
      await user.click(screen.getByRole('button', { name: 'clearModifiedFiles' }));
      await user.click(screen.getByRole('button', { name: 'removeModifiedFile' }));
      expect(screen.getByRole('status', { name: 'modifiedFiles' })).toHaveTextContent('{}');
    });

    it('addPlanComment adds a comment', async () => {
      const { user } = await setup();
      const comment = { id: 'c1', selectedText: 'foo', sectionHeading: 'Plan', comment: 'bar' };
      await user.click(screen.getByRole('button', { name: 'addPlanComment' }));
      expect(screen.getByRole('status', { name: 'planComments' })).toHaveTextContent(
        JSON.stringify([comment]),
      );
    });

    it('clearPlanComments resets to empty', async () => {
      const { user } = await setup();
      await user.click(screen.getByRole('button', { name: 'addPlanComment' }));
      await user.click(screen.getByRole('button', { name: 'clearPlanComments' }));
      expect(screen.getByRole('status', { name: 'planComments' })).toHaveTextContent('[]');
    });
  });

  describe('action reference stability', () => {
    function RefStabilityHarness({ actionName }: { actionName: 'addPlanComment' | 'abort' }) {
      const ctx = useChannelMessages();
      const action = ctx[actionName];
      const initialRef = useRef(action);
      const stable = action === initialRef.current;
      return (
        <div>
          <span role="status" aria-label="stable">
            {String(stable)}
          </span>
          <button
            type="button"
            onClick={() =>
              ctx.addPlanComment({ id: 'c1', selectedText: 'x', sectionHeading: '', comment: 'y' })
            }
          >
            trigger
          </button>
        </div>
      );
    }

    it('addPlanComment keeps the same reference after state change', async () => {
      const user = userEvent.setup();
      await renderWithChannel(<RefStabilityHarness actionName="addPlanComment" />);
      expect(screen.getByRole('status', { name: 'stable' })).toHaveTextContent('true');
      await user.click(screen.getByRole('button', { name: 'trigger' }));
      expect(screen.getByRole('status', { name: 'stable' })).toHaveTextContent('true');
    });

    it('abort keeps the same reference after state change', async () => {
      const user = userEvent.setup();
      await renderWithChannel(<RefStabilityHarness actionName="abort" />);
      expect(screen.getByRole('status', { name: 'stable' })).toHaveTextContent('true');
      await user.click(screen.getByRole('button', { name: 'trigger' }));
      expect(screen.getByRole('status', { name: 'stable' })).toHaveTextContent('true');
    });
  });

  describe('launch mode', () => {
    it('launch creates session and renders channel content', async () => {
      const { addProject } = await renderWithWorkspace();
      const project = await addProject();
      await project.launchSession();

      expect(screen.getByPlaceholderText(/Esc to focus/i)).toBeInTheDocument();
    });

    it('launch failure shows error UI with retry button', async () => {
      const summoner = createFakeSummoner();
      summoner.claude().prepareInit();
      const origEmit = summoner.socket.emit.bind(summoner.socket);
      // @ts-expect-error — intercepting FakeSocket.emit to simulate server error
      summoner.socket.emit = (event: string, ...args: unknown[]) => {
        if (event === 'session:launch') {
          const cb = args[args.length - 1];
          if (typeof cb === 'function') cb({ error: 'CLI not found' });
          return summoner.socket;
        }
        return origEmit(event, ...args);
      };

      await renderWithChannel(<span>loaded</span>, {
        summoner,
        cwd: '/bad/path',
        skipInit: true,
        mode: 'new',
      });

      expect(
        await screen.findByText(/Failed to connect/, {}, { timeout: 3000 }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.queryByText('loaded')).not.toBeInTheDocument();
    });

    it('join failure shows error message in message list', async () => {
      const channelId = crypto.randomUUID();

      await renderWithChannel(<MessageList />, { channelId, skipInit: true });

      expect(await screen.findByText(/Session not found/i)).toBeInTheDocument();
    });

    it('join failure still allows session:states processing', async () => {
      const summoner = createFakeSummoner();
      summoner.claude().prepareInit();
      const channelId = crypto.randomUUID();

      const origEmit = summoner.socket.emit.bind(summoner.socket);
      // @ts-expect-error — intercepting FakeSocket.emit to simulate server error
      summoner.socket.emit = (event: string, ...args: unknown[]) => {
        if (event === 'session:join') {
          const cb = args[args.length - 1];
          if (typeof cb === 'function') cb({ error: 'Session not found' });
          return summoner.socket;
        }
        return origEmit(event, ...args);
      };

      function StatusHarness() {
        const isProcessing = useChannelStore(
          (s) => s.status === 'processing' || s.status === 'busy' || s.status === 'cancelling',
        );
        return (
          <span role="status" aria-label="processing">
            {String(isProcessing)}
          </span>
        );
      }

      await renderWithChannel(<StatusHarness />, { summoner, channelId, skipInit: true });

      await act(async () => {
        summoner.claude().pushSessionState(channelId, 'busy', { projectRoot: '/repo' });
      });

      expect(screen.getByRole('status', { name: 'processing' })).toHaveTextContent('true');
    });
  });

  describe('resume join (mode=resume)', () => {
    it('shows SpinnerVerb before join ACK, then renders children', async () => {
      const summoner = createFakeSummoner();
      const claude = summoner.claude();
      const channelId = await claude.initialize();
      const held = summoner.holdEmit('session:join');

      await renderWithChannel(<span>loaded</span>, {
        summoner,
        channelId,
        skipInit: true,
      });

      // Before join ACK — SpinnerVerb visible, children hidden
      expect(screen.getByLabelText('spinner-verb')).toBeInTheDocument();
      expect(screen.queryByText('loaded')).not.toBeInTheDocument();

      // Release join ACK
      await act(() => held.release());

      // After join ACK — children visible, SpinnerVerb gone
      expect(screen.getByText('loaded')).toBeInTheDocument();
      expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
    });

    it('renders children after join completes (standard renderWithChannel flow)', async () => {
      // Default renderWithChannel: init → render → join ACK flushed in act
      await renderWithChannel(<span>loaded</span>);

      expect(screen.getByText('loaded')).toBeInTheDocument();
      expect(screen.queryByLabelText('spinner-verb')).not.toBeInTheDocument();
    });
  });

  describe('session mode gating', () => {
    it('resume / fork tab does NOT spawn the CLI', async () => {
      const summoner = createFakeSummoner();

      await renderWithChannel(<span>loaded</span>, {
        summoner,
        cwd: '/repo',
        mode: 'resume',
        skipInit: true,
      });

      expect(summoner.sentEvents('session:launch')).toEqual([]);
    });

    it('new tab spawns the CLI on mount', async () => {
      const summoner = createFakeSummoner();
      summoner.claude().prepareInit();

      await renderWithChannel(<span>loaded</span>, {
        summoner,
        cwd: '/repo',
        mode: 'new',
        skipInit: true,
      });

      await waitFor(() => expect(summoner.sentEvents('session:launch')).toHaveLength(1));
    });

    it('session:join is NOT sent before session:launch callback completes', async () => {
      const summoner = createFakeSummoner();
      summoner.claude().prepareInit();
      const held = summoner.holdEmit('session:launch');

      await renderWithChannel(<span>loaded</span>, {
        summoner,
        cwd: '/repo',
        mode: 'new',
        skipInit: true,
      });

      await waitFor(() => expect(summoner.sentEvents('session:launch')).toHaveLength(1));
      expect(summoner.sentEvents('session:join')).toHaveLength(0);

      await act(async () => {
        held.release();
        await new Promise<void>((r) => queueMicrotask(r));
      });

      await waitFor(() => expect(summoner.sentEvents('session:join')).toHaveLength(1));
    });

    it('switching projects on a launched tab does not re-spawn the CLI', async () => {
      const summoner = createFakeSummoner();
      summoner.claude().prepareInit();

      function Wrapper({ cwd }: { cwd: string }) {
        return (
          <SocketProvider socket={summoner.socket}>
            <AppConfigProvider>
              <SessionProvider>
                <PluginProvider>
                  <ProjectProvider>
                    <NavigationProvider>
                      <TabProvider cwd={cwd}>
                        <ChannelProvider channelId="ch-1" cwd={cwd} mode="new">
                          <span>loaded</span>
                        </ChannelProvider>
                      </TabProvider>
                    </NavigationProvider>
                  </ProjectProvider>
                </PluginProvider>
              </SessionProvider>
            </AppConfigProvider>
          </SocketProvider>
        );
      }
      const { rerender } = render(<Wrapper cwd="/a" />);
      await waitFor(() => expect(summoner.sentEvents('session:launch')).toHaveLength(1));

      rerender(<Wrapper cwd="/b" />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(summoner.sentEvents('session:launch')).toHaveLength(1);
    });
  });
});
