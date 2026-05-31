import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type FakeClaude, segments as s } from '@code-quest/test-kit';
import type { SessionStore } from '../../../services/session-store.ts';
import {
  createFakeServer,
  createFakeSummoner,
  createTestContainer,
  getChannelManager,
  setupSession,
} from '../../../test/index.ts';
import { TYPES } from '../../../types.ts';

function waitForDiffReview(claude: FakeClaude): Promise<void> {
  return vi.waitFor(() => {
    expect(claude.receivedEvents('control:diff_review').length).toBeGreaterThan(0);
  });
}

describe('ChatHandler > control', () => {
  describe('pending control_request queue', () => {
    it('forwards control_request events to client', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(
        s.controlRequest('req-1', 'can_use_tool', 'Bash', { command: 'ls' }),
      );

      const permEvents = claude.receivedEvents('control:permission');
      expect(permEvents.length).toBeGreaterThan(0);
      expect(permEvents[0]!.toolName).toBe('Bash');
      expect(permEvents[0]!.requestId).toBe('req-1');
      expect(permEvents[0]!.input).toEqual({ command: 'ls' });
      expect((permEvents[0] as Record<string, unknown>).inputs).toBeUndefined();
    });

    it('control_request tracked in channel', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(
        s.controlRequest('req-1', 'can_use_tool', 'Bash', { command: 'ls' }),
      );

      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)?.hasControlRequest('req-1')).toBe(true);
    });

    it('removes from pending after control_response', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: { command: 'ls' } } }),
      );
      await claude.emitSegment(
        s.controlRequest('req-1', 'can_use_tool', 'Bash', { command: 'ls' }),
      );

      await claude.send('chat:respond', {
        channelId,
        requestId: 'req-1',
        response: { behavior: 'allow', updatedInput: {} },
      });

      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)?.hasControlRequest('req-1')).toBe(false);
      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });

    it('forwards hook_callback to client', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequest('hook-1', 'hook_callback'));

      const hookEvents = claude.receivedEvents('control:hook_callback');
      expect(hookEvents.length).toBeGreaterThan(0);
    });

    it('removes pending on control_cancel_request and forwards chat:cancel_request', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_1', name: 'Bash', input: {} } }),
      );
      await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Bash', {}));
      await claude.emitSegment(s.controlCancelRequest('req-1'));

      const cancelEvents = claude.receivedEvents('chat:cancel_request');
      expect(cancelEvents.length).toBeGreaterThan(0);
      expect(cancelEvents[0]!.targetRequestId).toBe('req-1');

      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)?.hasControlRequest('req-1')).toBe(false);
    });

    describe('parallel control_requests', () => {
      it('forwards multiple control_requests to client', async () => {
        const { claude, channelId } = await setupSession();

        await claude.send('chat:send', { channelId, message: 'go' });
        await claude.emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: {} } }),
        );
        await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Read', {}));
        await claude.emitSegment(s.controlRequest('req-2', 'can_use_tool', 'Write', {}));

        const permEvents = claude.receivedEvents('control:permission');
        expect(permEvents.length).toBe(2);
        expect(permEvents[0]!.requestId).toBe('req-1');
        expect(permEvents[1]!.requestId).toBe('req-2');
      });

      it('resumes after all parallel CRs responded', async () => {
        const { claude, channelId } = await setupSession();

        await claude.send('chat:send', { channelId, message: 'go' });
        await claude.emitSegment(
          s.assistant({ toolUse: { id: 'toolu_1', name: 'Read', input: {} } }),
        );
        await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Read', {}));
        await claude.emitSegment(s.controlRequest('req-2', 'can_use_tool', 'Write', {}));

        await claude.send('chat:respond', {
          channelId,
          requestId: 'req-1',
          response: { behavior: 'allow', updatedInput: {} },
        });
        await claude.send('chat:respond', {
          channelId,
          requestId: 'req-2',
          response: { behavior: 'allow', updatedInput: {} },
        });

        expect(claude.received('control_response').length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('chat:respond for diff', () => {
    it('forwards accepted diff response', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestOpenDiff('diff-1', {
          originalFilePath: '/tmp/old.ts',
          newFilePath: '/tmp/new.ts',
        }),
      );
      await waitForDiffReview(claude);

      await claude.send('chat:respond', {
        channelId,
        requestId: 'diff-1',
        response: { behavior: 'allow', updatedInput: {} },
      });

      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });

    it('forwards rejected diff response', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestOpenDiff('diff-1', {
          originalFilePath: '/tmp/old.ts',
          newFilePath: '/tmp/new.ts',
        }),
      );
      await waitForDiffReview(claude);

      await claude.send('chat:respond', {
        channelId,
        requestId: 'diff-1',
        response: { behavior: 'deny', message: 'rejected' },
      });

      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });
  });

  describe('elicitation control_request', () => {
    it('pushes elicitation_request to client', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequestElicitation('elicit-1', { message: 'Enter URL' }));

      const elicitEvents = claude.receivedEvents('control:elicitation');
      expect(elicitEvents.length).toBeGreaterThan(0);
      expect(elicitEvents[0]!.requestId).toBe('elicit-1');
    });

    it('chat:respond forwards elicitation answer to CLI', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequestElicitation('elicit-1', { message: 'Enter URL' }));

      await claude.send('chat:respond', {
        requestId: 'elicit-1',
        response: { behavior: 'allow', updatedInput: { url: 'https://example.com' } },
      });

      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });

    it('chat:respond with deny sends decline to CLI', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequestElicitation('elicit-1', { message: 'Enter URL' }));

      await claude.send('chat:respond', {
        requestId: 'elicit-1',
        response: { behavior: 'deny', message: 'no thanks' },
      });

      expect(claude.received('control_response').length).toBeGreaterThan(0);
    });

    it('maps mode:"url" → inputType:"url"', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestElicitation('elicit-url', {
          message: 'Enter URL',
          mode: 'url',
          url: 'https://auth.example.com',
        }),
      );

      const elicitEvents = claude.receivedEvents('control:elicitation');
      expect(elicitEvents.length).toBeGreaterThan(0);
    });

    it('maps mode:"form" → extracts options from schema', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestElicitation('elicit-form', {
          message: 'Pick option',
          mode: 'form',
          requestedSchema: { properties: { choice: { type: 'string', enum: ['A', 'B', 'C'] } } },
        }),
      );

      const elicitEvents = claude.receivedEvents('control:elicitation');
      expect(elicitEvents.length).toBeGreaterThan(0);
    });
  });

  describe('initialize control_request', () => {
    it('system/init pushes settings:update on launch', async () => {
      const claude = createFakeSummoner().claude();

      await claude.initialize();

      const configEvents = claude.receivedEvents('settings:update');
      expect(configEvents.length).toBeGreaterThan(0);
    });

    it('system/init persists session with session_id', async () => {
      const { container, channelId } = await setupSession('my-session-id');

      const sessionStore = container.get<SessionStore>(TYPES.SessionStore);
      const record = await sessionStore.getByChannelId(channelId);
      expect(record?.id).toBe('my-session-id');
    });
  });

  describe('open_diff control_request', () => {
    it('pushes diff_review_request to client', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestOpenDiff('diff-1', {
          originalFilePath: '/tmp/old.ts',
          newFilePath: '/tmp/new.ts',
        }),
      );
      await waitForDiffReview(claude);
    });
  });

  describe('open_url / open_file control_request', () => {
    it('open_in_editor: forwards as raw:event to client', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequestOpenInEditor('open-1'));

      const rawEvents = claude.receivedEvents('raw:event');
      expect(rawEvents.length).toBeGreaterThan(0);
      expect(rawEvents[0]!.rawType).toBe('control_request/open_in_editor');
    });
  });

  describe('initialize response fields', () => {
    it('initialize response includes accountInfo from controlResponse', async () => {
      const claude = createFakeSummoner().claude();

      await claude.initialize(
        s.init('sess'),
        s.controlResponse('init', {
          account: { email: 'user@test.com', subscriptionType: 'Claude Max' },
        }),
      );

      const stateUpdates = claude.receivedEvents('settings:update');
      const accountUpdate = stateUpdates.find((e) => e.accountInfo);
      expect(accountUpdate).toBeDefined();
      expect(accountUpdate!.accountInfo!.email).toBe('user@test.com');
    });
  });

  describe('elicitation modes', () => {
    it('maps mode:"form" → extracts options from requested_schema properties', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestElicitation('elicit-form-opts', {
          message: 'Pick option',
          mode: 'form',
          requestedSchema: {
            properties: { choice: { type: 'string', enum: ['A', 'B', 'C'] } },
          },
        }),
      );

      const elicitEvents = claude.receivedEvents('control:elicitation');
      expect(elicitEvents.length).toBeGreaterThan(0);
      expect(elicitEvents[0]!.requestId).toBe('elicit-form-opts');
    });

    it('maps mode:"url" → inputType:"url" and forwards url field', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestElicitation('elicit-url-field', {
          message: 'Enter URL',
          mode: 'url',
          url: 'https://auth.example.com',
        }),
      );

      const elicitEvents = claude.receivedEvents('control:elicitation');
      expect(elicitEvents.length).toBeGreaterThan(0);
      expect(elicitEvents[0]!.requestId).toBe('elicit-url-field');
    });
  });

  describe('open_diff error handling', () => {
    it('auto-denies control request when diffFileService.read throws', async () => {
      const throwingDiffFile = {
        async read(): Promise<string> {
          throw new Error('disk read failed');
        },
      };
      const container = createTestContainer({
        diffFileService: throwingDiffFile,
      });
      const server = createFakeServer(container);
      const summoner = createFakeSummoner(server);
      const claude = summoner.claude();
      const channelId = await claude.initialize(s.init('cli-sess'));

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestOpenDiff('diff-err', {
          originalFilePath: '/tmp/old.ts',
          newFilePath: '/tmp/new.ts',
        }),
      );

      await vi.waitFor(() => {
        expect(claude.received('control_response').length).toBeGreaterThan(0);
      });
    });
  });

  describe('open_diff with file content', () => {
    it('emits diff_review_request with real file content', async () => {
      const dir = join(tmpdir(), `cc-diff-test-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      const origPath = join(dir, 'original.ts');
      const newPath = join(dir, 'new.ts');
      writeFileSync(origPath, 'const a = 1;');
      writeFileSync(newPath, 'const a = 2;');

      try {
        const { claude, channelId } = await setupSession();

        await claude.send('chat:send', { channelId, message: 'go' });
        await claude.emitSegment(
          s.controlRequestOpenDiff('diff-content-1', {
            originalFilePath: origPath,
            newFilePath: newPath,
          }),
        );
        await waitForDiffReview(claude);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('uses empty string when file does not exist', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequestOpenDiff('diff-nofile', {
          originalFilePath: '/nonexistent/original.ts',
          newFilePath: '/nonexistent/new.ts',
        }),
      );
      await waitForDiffReview(claude);
    });
  });

  describe('open_url / open_file control_request (extended)', () => {
    it('open_url: pushes request to client as raw:event', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(s.controlRequestOpenInEditor('open-url-1'));

      const rawEvents = claude.receivedEvents('raw:event');
      expect(rawEvents.length).toBeGreaterThan(0);
      expect(rawEvents[0]!.rawType).toBe('control_request/open_in_editor');
    });
  });

  describe('partial CR response + reconnect', () => {
    it('removes only responded CR from pending', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_p1', name: 'Read', input: {} } }),
      );
      await claude.emitSegment(s.controlRequest('req-a', 'can_use_tool', 'Read', {}));
      await claude.emitSegment(s.controlRequest('req-b', 'can_use_tool', 'Write', {}));

      // Respond to req-a only
      await claude.send('chat:respond', {
        channelId,
        requestId: 'req-a',
        response: { behavior: 'allow', updatedInput: {} },
      });

      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)?.hasControlRequest('req-a')).toBe(false);
      expect(mgr.get(channelId)?.hasControlRequest('req-b')).toBe(true);
    });
  });

  it('responds to control request from scene', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'go' });

    await claude.emitSegment(s.assistant({ toolUse: { id: 'toolu_1', name: 'Write', input: {} } }));
    await claude.emitSegment(s.controlRequest('req-1', 'can_use_tool', 'Write', {}));

    const permEvents = claude.receivedEvents('control:permission');
    expect(permEvents.length).toBeGreaterThan(0);

    await claude.send('chat:respond', {
      channelId,
      requestId: 'req-1',
      response: { behavior: 'allow', updatedInput: {} },
    });

    await claude.emitSegment(s.toolResult('toolu_1', 'ok'));
    await claude.emitSegment(s.result());

    const resultEvents = claude.receivedEvents('message:result');
    expect(resultEvents.length).toBeGreaterThan(0);
  });

  it('response from client triggers respondToControlRequest', async () => {
    const { claude, channelId } = await setupSession();

    await claude.send('chat:send', { channelId, message: 'go' });

    await claude.emitSegment(s.assistant({ toolUse: { id: 'toolu_3', name: 'Write', input: {} } }));
    await claude.emitSegment(s.controlRequest('req-resp-1', 'can_use_tool', 'Write', {}));

    const permEvents = claude.receivedEvents('control:permission');
    expect(permEvents.length).toBeGreaterThan(0);

    await claude.send('chat:respond', {
      channelId,
      requestId: 'req-resp-1',
      response: { behavior: 'allow', updatedInput: {} },
    });

    await claude.emitSegment(s.toolResult('toolu_3', 'ok'));
    await claude.emitSegment(s.result());

    const resultEvents = claude.receivedEvents('message:result');
    expect(resultEvents.length).toBeGreaterThan(0);
  });

  describe('reconnect / pending CR replay', () => {
    it('stores control_request in pending when session has CR', async () => {
      const { container, claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.assistant({ toolUse: { id: 'toolu_p', name: 'Bash', input: {} } }),
      );
      await claude.emitSegment(s.controlRequest('req-pending', 'can_use_tool', 'Bash', {}));

      const mgr = getChannelManager(container);
      expect(mgr.get(channelId)?.hasControlRequest('req-pending')).toBe(true);
    });

    it('replays pending CRs on rejoin via second socket', async () => {
      const server = createFakeServer();
      const windowA = createFakeSummoner(server);
      const channelId = await windowA.claude().initialize(s.init('cli-sess'));

      await windowA.send('chat:send', { channelId, message: 'go' });
      await windowA
        .claude()
        .emitSegment(s.assistant({ toolUse: { id: 'toolu_r', name: 'Read', input: {} } }));
      await windowA
        .claude()
        .emitSegment(s.controlRequest('req-replay', 'can_use_tool', 'Read', {}));

      const windowB = createFakeSummoner(server);
      await windowB.send('session:join', { channelId });

      await vi.waitFor(() => {
        const bPermEvents = windowB.receivedEvents('control:permission');
        expect(bPermEvents.length).toBeGreaterThan(0);
        expect(bPermEvents[0].requestId).toBe('req-replay');
      });
    });

    it('does not hang: mcp_message cleared on session kill', async () => {
      const { claude, channelId } = await setupSession();

      await claude.send('chat:send', { channelId, message: 'go' });
      await claude.emitSegment(
        s.controlRequest('mcp-kill', 'mcp_message', undefined, {
          server_name: 'test',
          message: { jsonrpc: '2.0', method: 'test', id: 1 },
        }),
      );

      await claude.send('session:close', { channelId });

      expect(claude.handle.signal.aborted).toBe(true);
    });
  });
});
