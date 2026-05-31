/* biome-ignore-all lint/suspicious/noExplicitAny: test file uses type assertions */
import { segments as s } from '@code-quest/test-kit';
import { createFakeSummoner } from '../../../test/index.ts';
import { resetClaudeState } from '../state.ts';

async function setup(sessionId = 'cli-sess') {
  const summoner = createFakeSummoner();
  const claude = summoner.claude();
  const channelId = await claude.initialize(s.init(sessionId));
  const pluginCli = summoner.pluginCli();
  if (!pluginCli) throw new Error('FakePluginCli not wired');
  return { claude, channelId, pluginCli };
}

describe('ChatHandler > plugin', () => {
  // NOTE: resetClaudeState() is needed because state.ts holds module-level state shared across
  // tests. Eliminating this would require making the state injectable via the DI container
  // (binding it to TYPES.ClaudeState), which is a larger refactor. Left as-is intentionally.
  beforeEach(() => resetClaudeState());

  describe('plugin handlers', () => {
    it('plugin:list parses JSON stdout from CLI', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['list', '--json'], {
        ok: true,
        stdout: '[{"id":"p1","name":"Test Plugin","enabled":true}]',
      });

      const result = await claude.send<{ installed: unknown[]; available: unknown[] }>(
        'plugin:list',
        {},
      );

      expect(pluginCli.calls).toContainEqual(['list', '--json']);
      expect(result.installed).toEqual([{ id: 'p1', name: 'Test Plugin', enabled: true }]);
    });

    it('plugin:list returns empty array when CLI fails', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['list', '--json'], { ok: false, stderr: 'not found' });

      const result = await claude.send<{ installed: unknown[]; available: unknown[] }>(
        'plugin:list',
        {},
      );

      expect(result.installed).toEqual([]);
    });

    it('plugin:install returns success with needsRestart when CLI succeeds', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['install', 'test-plugin'], { ok: true, stdout: 'Installed' });

      const result = await claude.send<{ success: boolean; needsRestart?: boolean }>(
        'plugin:install',
        { pluginId: 'test-plugin' },
      );

      expect(pluginCli.calls).toContainEqual(['install', 'test-plugin']);
      expect(result).toEqual({ success: true, needsRestart: true });
    });

    it('plugin:install returns error when CLI fails', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['install', 'bad-plugin'], { ok: false, stderr: 'Plugin not found' });

      const result = await claude.send<{ success: boolean; error?: string }>('plugin:install', {
        pluginId: 'bad-plugin',
      });

      expect(result).toEqual({ success: false, error: 'Plugin not found' });
    });

    it('plugin:uninstall returns success with needsRestart', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['uninstall', 'test-plugin'], { ok: true, stdout: 'Uninstalled' });

      const result = await claude.send<{ success: boolean; needsRestart?: boolean }>(
        'plugin:uninstall',
        { pluginId: 'test-plugin' },
      );

      expect(pluginCli.calls).toContainEqual(['uninstall', 'test-plugin']);
      expect(result).toEqual({ success: true, needsRestart: true });
    });

    it('plugin:toggle calls enable/disable and returns needsRestart', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['enable', 'test-plugin'], { ok: true });
      pluginCli.setResult(['disable', 'test-plugin'], { ok: true });

      const result = await claude.send<{ success: boolean; needsRestart?: boolean }>(
        'plugin:toggle',
        { pluginId: 'test-plugin', enabled: true },
      );

      expect(pluginCli.calls).toContainEqual(['enable', 'test-plugin']);
      expect(result).toEqual({ success: true, needsRestart: true });

      const result2 = await claude.send<{ success: boolean; needsRestart?: boolean }>(
        'plugin:toggle',
        { pluginId: 'test-plugin', enabled: false },
      );

      expect(pluginCli.calls).toContainEqual(['disable', 'test-plugin']);
      expect(result2).toEqual({ success: true, needsRestart: true });
    });
  });

  describe('marketplace handlers', () => {
    it('plugin:list_marketplaces parses JSON stdout', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['marketplace', 'list', '--json'], {
        ok: true,
        stdout:
          '[{"name":"m1","source":"github","repo":"anthropics/test-plugins","installLocation":"/tmp/plugins/m1"}]',
      });

      const result = await claude.send<{ marketplaces: unknown[] }>('plugin:list_marketplaces');

      expect(pluginCli.calls).toContainEqual(['marketplace', 'list', '--json']);
      expect(result.marketplaces).toEqual([
        {
          name: 'm1',
          config: {
            source: { source: 'github', repo: 'anthropics/test-plugins' },
            installLocation: '/tmp/plugins/m1',
          },
          pluginCount: 0,
          installedCount: 0,
        },
      ]);
    });

    it('plugin:list_marketplaces returns empty on failure', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['marketplace', 'list', '--json'], { ok: false, stderr: 'err' });

      const result = await claude.send<{ marketplaces: unknown[] }>('plugin:list_marketplaces');

      expect(result.marketplaces).toEqual([]);
    });

    it('plugin:add_marketplace succeeds', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['marketplace', 'add', 'https://example.com'], {
        ok: true,
        stdout: 'Added',
      });

      const result = await claude.send<{ success: boolean }>('plugin:add_marketplace', {
        source: 'https://example.com',
      });

      expect(pluginCli.calls).toContainEqual(['marketplace', 'add', 'https://example.com']);
      expect(result).toEqual({ success: true });
    });

    it('plugin:remove_marketplace succeeds', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['marketplace', 'remove', 'm1'], { ok: true, stdout: 'Removed' });

      const result = await claude.send<{ success: boolean }>('plugin:remove_marketplace', {
        marketplaceId: 'm1',
      });

      expect(pluginCli.calls).toContainEqual(['marketplace', 'remove', 'm1']);
      expect(result).toEqual({ success: true });
    });

    it('plugin:refresh_marketplace succeeds', async () => {
      const { claude, pluginCli } = await setup();
      pluginCli.setResult(['marketplace', 'update', 'm1'], { ok: true, stdout: 'Updated' });

      const result = await claude.send<{ success: boolean }>('plugin:refresh_marketplace', {
        marketplaceId: 'm1',
      });

      expect(pluginCli.calls).toContainEqual(['marketplace', 'update', 'm1']);
      expect(result).toEqual({ success: true });
    });
  });

  describe('plugin:reload', () => {
    it('returns success with commands/agents/plugins/mcpServers from CLI response', async () => {
      const { claude, channelId } = await setup();

      const reloadResponse = {
        commands: [{ name: 'simplify', description: 'Review code', argumentHint: '' }],
        agents: [{ name: 'general-purpose', description: 'General agent' }],
        plugins: [{ id: 'p1', name: 'Plugin 1', enabled: true }],
        mcpServers: [{ name: 'github', status: 'connected' }],
      };

      claude.setControlRequestHandler((req) => {
        if (req.subtype === 'reload_plugins') {
          return reloadResponse;
        }
        return null;
      });

      const result = await claude.send<{
        success: boolean;
        data?: typeof reloadResponse;
      }>('plugin:reload', { channelId });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(reloadResponse);
    });

    it('returns success:true with no data when CLI responds without response body', async () => {
      const { claude, channelId } = await setup();

      const result = await claude.send<{ success: boolean; data?: unknown }>('plugin:reload', {
        channelId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });
});
