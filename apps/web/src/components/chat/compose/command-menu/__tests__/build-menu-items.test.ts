import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAttachFileFeature } from '@/features/attach-file/attach-file-feature';
import { btwSignal, createBtwFeature, createBtwLocalFeature } from '@/features/btw/btw-feature';
import { createClearFeature } from '@/features/clear/clear-feature';
import { createEffortFeature } from '@/features/effort/effort-feature';
import { createFastModeFeature } from '@/features/fast-mode/fast-mode-feature';
import { createManagePluginsFeature } from '@/features/manage-plugins/manage-plugins-feature';
import { createMcpServersFeature } from '@/features/mcp-servers/mcp-servers-feature';
import { createMcpStatusFeature } from '@/features/mcp-status/mcp-status-feature';
import { createMentionFileFeature } from '@/features/mention-file/mention-file-feature';
import { createModelFeature } from '@/features/model/model-feature';
import { createThinkingFeature } from '@/features/thinking/thinking-feature';
import type { Feature } from '@/lib/feature';
import { createFeatureRegistry } from '@/lib/feature-registry';
import { buildMenuItems } from '../build-menu-items.ts';

type BuildMenuItemsParams = Parameters<typeof buildMenuItems>[0];

function defaultParams(overrides?: Partial<BuildMenuItemsParams>): BuildMenuItemsParams {
  return {
    slashCommands: [],
    registry: createFeatureRegistry(),
    compose: { executeSlashCommand: vi.fn() },
    ...overrides,
  };
}

describe('buildMenuItems', () => {
  afterEach(() => {
    btwSignal.setState({ open: false, question: '', answer: null, loading: false, error: null });
  });
  it('returns all 6 sections', () => {
    const sections = buildMenuItems(defaultParams());
    expect(Object.keys(sections)).toEqual([
      'context',
      'model',
      'customize',
      'slash',
      'settings',
      'support',
    ]);
  });

  it('context section includes attach-file from registry MenuItemView', () => {
    const registry = createFeatureRegistry();
    const onAttachFile = vi.fn();
    registry.register(createAttachFileFeature({ onAttachFile }));
    const { context } = buildMenuItems(defaultParams({ registry }));
    expect(context.map((i) => i.id)).toContain('attach-file');
  });

  it('clicking attach-file calls onAttachFile and has closeSilent dismiss', () => {
    const onAttachFile = vi.fn();
    const registry = createFeatureRegistry();
    registry.register(createAttachFileFeature({ onAttachFile }));
    const { context } = buildMenuItems(defaultParams({ registry }));
    const item = context.find((i) => i.id === 'attach-file');
    item?.onClick?.();
    expect(onAttachFile).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('closeSilent');
  });

  it('context section includes mention-file from registry MenuItemView', () => {
    const registry = createFeatureRegistry();
    const mentionFile = vi.fn();
    registry.register(createMentionFileFeature({ mentionFile }));
    const { context } = buildMenuItems(defaultParams({ registry }));
    expect(context.map((i) => i.id)).toContain('mention-file');
  });

  it('clicking mention-file calls mentionFile and has close dismiss', () => {
    const mentionFile = vi.fn();
    const registry = createFeatureRegistry();
    registry.register(createMentionFileFeature({ mentionFile }));
    const { context } = buildMenuItems(defaultParams({ registry }));
    const item = context.find((i) => i.id === 'mention-file');
    item?.onClick?.();
    expect(mentionFile).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('close');
  });

  it('context section includes clear item from registry MenuItemView', () => {
    const registry = createFeatureRegistry();
    const clearMessages = vi.fn();
    const clearModifiedFiles = vi.fn();
    registry.register(
      createClearFeature({ clearMessages, clearModifiedFiles, sendMessage: vi.fn() }),
    );
    const { context } = buildMenuItems(defaultParams({ registry }));
    expect(context.map((i) => i.id)).toContain('clear');
  });

  it('slash section maps slashCommands to menu items sorted by label', () => {
    const btwLocalFeature = createBtwLocalFeature({
      slashFilter: null,
      baseFeature: createBtwFeature({ askSideQuestion: vi.fn() }),
    });
    const { slash } = buildMenuItems(
      defaultParams({ slashCommands: ['help', 'review'], localFeatures: [btwLocalFeature] }),
    );
    expect(slash).toHaveLength(3);
    expect(slash[0]!.id).toBe('btw');
    expect(slash[1]!.label).toBe('/help');
    expect(slash[2]!.label).toBe('/review');
  });

  it('model section includes fast-mode when supportsFastMode is true', () => {
    const localFeatures = [createFastModeFeature({ fastModeState: null, setFastMode: vi.fn() })];
    const { model } = buildMenuItems(defaultParams({ localFeatures }));
    expect(model.map((i) => i.id)).toContain('fast-mode');
  });

  it('model section excludes fast-mode when supportsFastMode is false', () => {
    const { model } = buildMenuItems(defaultParams());
    expect(model.map((i) => i.id)).not.toContain('fast-mode');
  });

  it('model section order: switch model → effort → thinking → fast-mode → account & usage', () => {
    const registry = createFeatureRegistry();
    registry.register({
      id: 'usage',
      label: 'Account & usage',
      section: 'Model',
      execute: vi.fn(),
    });
    const localFeatures = [
      createModelFeature({ modelLabel: 'Opus', channelId: 'ch-test' }),
      createEffortFeature({ effort: null, effortLevels: ['low', 'max'], onSetEffort: vi.fn() }),
      createThinkingFeature({ isThinkingOn: false, onSetThinkingLevel: vi.fn() }),
      createFastModeFeature({ fastModeState: null, setFastMode: vi.fn() }),
    ];
    const { model } = buildMenuItems(defaultParams({ registry, localFeatures }));
    expect(model.map((i) => i.id)).toEqual([
      'model',
      'effort-level',
      'toggle-thinking',
      'fast-mode',
      'usage',
    ]);
  });

  it('model item with closeSilent has closeSilent dismiss', () => {
    const execute = vi.fn();
    const registry = createFeatureRegistry();
    registry.register({
      id: 'model',
      label: 'Switch model',
      section: 'Model',
      order: 0,
      ui: { closeSilent: true },
      execute,
    });
    const { model } = buildMenuItems(defaultParams({ registry }));
    const item = model.find((i) => i.id === 'model');
    item?.onClick?.();
    expect(execute).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('closeSilent');
  });

  it('clicking clear item calls clearMessages + clearModifiedFiles and has close dismiss', () => {
    const clearMessages = vi.fn();
    const clearModifiedFiles = vi.fn();
    const registry = createFeatureRegistry();
    registry.register(
      createClearFeature({ clearMessages, clearModifiedFiles, sendMessage: vi.fn() }),
    );
    const { context } = buildMenuItems(defaultParams({ registry }));
    const item = context.find((i) => i.id === 'clear');
    item?.onClick?.();
    expect(clearMessages).toHaveBeenCalled();
    expect(clearModifiedFiles).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('close');
  });

  it('context section includes rewind item from registry MenuItemView', () => {
    const registry = createFeatureRegistry();
    registry.register({
      id: 'rewind',
      label: 'Rewind',
      section: 'Context',
      execute: vi.fn(),
    });
    const { context } = buildMenuItems(defaultParams({ registry }));
    expect(context.map((i) => i.id)).toContain('rewind');
  });

  describe('/btw item', () => {
    it('is always present in slash section', () => {
      const localFeatures = [
        createBtwLocalFeature({
          slashFilter: null,
          baseFeature: createBtwFeature({ askSideQuestion: vi.fn() }),
        }),
      ];
      const { slash } = buildMenuItems(defaultParams({ localFeatures }));
      expect(slash.some((i) => i.id === 'btw')).toBe(true);
    });

    it('is disabled when slashFilter has no question text', () => {
      const localFeatures = [
        createBtwLocalFeature({
          slashFilter: 'btw',
          baseFeature: createBtwFeature({ askSideQuestion: vi.fn() }),
        }),
      ];
      const { slash } = buildMenuItems(defaultParams({ localFeatures }));
      const btw = slash.find((i) => i.id === 'btw');
      expect(btw?.disabled).toBe(true);
    });

    it('is enabled when slashFilter is "btw <question>"', () => {
      const localFeatures = [
        createBtwLocalFeature({
          slashFilter: 'btw hello world',
          baseFeature: createBtwFeature({ askSideQuestion: vi.fn() }),
        }),
      ];
      const { slash } = buildMenuItems(defaultParams({ localFeatures }));
      const btw = slash.find((i) => i.id === 'btw');
      expect(btw?.disabled).toBe(false);
    });

    it('invokes btw feature with question when clicked', () => {
      const askSideQuestion = vi.fn().mockResolvedValue({ ok: true, data: { answer: '4' } });
      const btwSlashFeature = createBtwFeature({ askSideQuestion });
      const localFeatures = [
        createBtwLocalFeature({ slashFilter: 'btw what is 2+2?', baseFeature: btwSlashFeature }),
      ];
      const { slash } = buildMenuItems(defaultParams({ localFeatures }));
      const btw = slash.find((i) => i.id === 'btw');
      btw?.onClick?.();
      expect(askSideQuestion).toHaveBeenCalledWith('what is 2+2?');
      expect(btw?.dismissBehavior).toBe('close');
    });

    it('does not invoke btw feature when question is empty', () => {
      const askSideQuestion = vi.fn();
      const btwSlashFeature = createBtwFeature({ askSideQuestion });
      const localFeatures = [
        createBtwLocalFeature({ slashFilter: 'btw', baseFeature: btwSlashFeature }),
      ];
      const { slash } = buildMenuItems(defaultParams({ localFeatures }));
      const btw = slash.find((i) => i.id === 'btw');
      btw?.onClick?.();
      expect(askSideQuestion).not.toHaveBeenCalled();
    });
  });

  it('customize section includes mcp-status, mcp-servers, plugins from registry', () => {
    const registry = createFeatureRegistry();
    registry.register(createMcpStatusFeature({ onMcpStatus: vi.fn() }));
    registry.register(createMcpServersFeature({ onToggleMcp: vi.fn() }));
    registry.register(createManagePluginsFeature({ onManagePlugins: vi.fn() }));
    const { customize } = buildMenuItems(defaultParams({ registry }));
    expect(customize.map((i) => i.id)).toContain('mcp-status');
    expect(customize.map((i) => i.id)).toContain('mcp-servers');
    expect(customize.map((i) => i.id)).toContain('plugins');
  });

  it('clicking mcp-status calls onMcpStatus and has closeSilent dismiss', () => {
    const onMcpStatus = vi.fn();
    const registry = createFeatureRegistry();
    registry.register(createMcpStatusFeature({ onMcpStatus }));
    const { customize } = buildMenuItems(defaultParams({ registry }));
    const item = customize.find((i) => i.id === 'mcp-status');
    item?.onClick?.();
    expect(onMcpStatus).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('closeSilent');
  });

  it('slash section includes registry SlashCommandView with execute', () => {
    const registry = createFeatureRegistry();
    registry.register({
      id: 'reload-plugins',
      label: '/reload-plugins',
      section: 'Slash Commands',
      execute: vi.fn(),
      slash: { command: '/reload-plugins', invoke: vi.fn() },
    });
    const { slash } = buildMenuItems(defaultParams({ registry }));
    expect(slash.map((i) => i.id)).toContain('reload-plugins');
  });

  it('clicking registry slash feature calls feature.execute and has close dismiss', () => {
    const execute = vi.fn();
    const registry = createFeatureRegistry();
    registry.register({
      id: 'reload-plugins',
      label: '/reload-plugins',
      section: 'Slash Commands',
      execute,
      slash: { command: '/reload-plugins', invoke: vi.fn() },
    });
    const { slash } = buildMenuItems(defaultParams({ registry }));
    const item = slash.find((i) => i.id === 'reload-plugins');
    item?.onClick?.();
    expect(execute).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('close');
  });

  it('clicking registry rewind feature calls feature.execute and has close dismiss', () => {
    const execute = vi.fn();
    const registry = createFeatureRegistry();
    const feature: Feature = {
      id: 'rewind',
      label: 'Rewind',
      section: 'Context',
      execute,
    };
    registry.register(feature);
    const { context } = buildMenuItems(defaultParams({ registry }));
    const item = context.find((i) => i.id === 'rewind');
    item?.onClick?.();
    expect(execute).toHaveBeenCalled();
    expect(item?.dismissBehavior).toBe('close');
  });

  describe('regression: btw + CLI slash commands', () => {
    it('btw appears exactly once in slash section when registered + wrapped locally', () => {
      // Production scenario: ChannelMessagesContext registers createBtwFeature
      // and CommandMenu adds createBtwLocalFeature to localFeatures per render.
      // Previously this caused a duplicate /btw row.
      const registry = createFeatureRegistry();
      const baseFeature = createBtwFeature({ askSideQuestion: vi.fn() });
      registry.register(baseFeature);
      const localFeatures = [createBtwLocalFeature({ slashFilter: 'btw q', baseFeature })];
      const { slash } = buildMenuItems(defaultParams({ registry, localFeatures }));
      const btwItems = slash.filter((i) => i.id === 'btw');
      expect(btwItems).toHaveLength(1);
    });

    it('CLI-only slash commands still appear in slash section', () => {
      // Server-provided builtins like /help, /bash, /terminal that are NOT in registry
      // must still render as CLI-slash items.
      const registry = createFeatureRegistry();
      registry.register(createBtwFeature({ askSideQuestion: vi.fn() })); // in registry
      const { slash } = buildMenuItems(
        defaultParams({
          registry,
          slashCommands: ['help', 'bash', 'terminal', 'compact', 'btw'],
        }),
      );
      const labels = slash.map((i) => i.label);
      // CLI-only builtins appear
      expect(labels).toContain('/help');
      expect(labels).toContain('/bash');
      expect(labels).toContain('/terminal');
      // /btw appears (via registry) but not duplicated by CLI list
      expect(labels.filter((l) => l === '/btw')).toHaveLength(1);
    });
  });
});
