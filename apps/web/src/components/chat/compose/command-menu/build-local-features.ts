import type { EffortLevel } from '@code-quest/schemas';
import { createAttachFileFeature } from '@/features/attach-file/attach-file-feature';
import { createBtwLocalFeature } from '@/features/btw/btw-feature';
import { createEffortFeature } from '@/features/effort/effort-feature';
import { createFastModeFeature } from '@/features/fast-mode/fast-mode-feature';
import { createGeneralConfigFeature } from '@/features/general-config/general-config-feature';
import { createManagePluginsFeature } from '@/features/manage-plugins/manage-plugins-feature';
import { createMcpServersFeature } from '@/features/mcp-servers/mcp-servers-feature';
import { createMcpStatusFeature } from '@/features/mcp-status/mcp-status-feature';
import { createModelFeature } from '@/features/model/model-feature';
import { createSwitchAccountFeature } from '@/features/switch-account/switch-account-feature';
import { createThinkingFeature } from '@/features/thinking/thinking-feature';
import { createViewHelpFeature } from '@/features/view-help/view-help-feature';
import type { Feature } from '@/lib/feature';
import type { FeatureRegistry } from '@/lib/feature-registry';
import { openUrl } from '@/utils/open-url';

interface BuildLocalFeaturesParams {
  modelLabel: string;
  channelId: string;
  onAttachFile?: () => void;
  onMcpStatus?: () => void;
  onToggleMcp?: () => void;
  onManagePlugins?: () => void;
  docsUrl?: string;
  effort: EffortLevel | null;
  effortLevels: EffortLevel[];
  onSetEffort: (effort: string) => void;
  isThinkingOn: boolean;
  onSetThinkingLevel: (level: string) => void;
  supportsFastMode: boolean;
  fastModeState: 'on' | 'off' | null;
  setFastMode: (enabled: boolean) => void;
  slashFilter: string | null;
  registry: FeatureRegistry;
}

export function buildLocalFeatures(params: BuildLocalFeaturesParams): Feature[] {
  const btwBaseFeature = params.registry.getFeatures().find((f) => f.id === 'btw');

  return [
    createModelFeature({ modelLabel: params.modelLabel, channelId: params.channelId }),
    createAttachFileFeature({ onAttachFile: params.onAttachFile }),
    createMcpStatusFeature({ onMcpStatus: params.onMcpStatus }),
    createMcpServersFeature({ onToggleMcp: params.onToggleMcp }),
    createManagePluginsFeature({ onManagePlugins: params.onManagePlugins }),
    createGeneralConfigFeature(),
    createSwitchAccountFeature(),
    createViewHelpFeature({ openUrl, docsUrl: params.docsUrl }),
    createEffortFeature({
      effort: params.effort,
      effortLevels: params.effortLevels,
      onSetEffort: params.onSetEffort,
    }),
    createThinkingFeature({
      isThinkingOn: params.isThinkingOn,
      onSetThinkingLevel: params.onSetThinkingLevel,
    }),
    ...(params.supportsFastMode
      ? [
          createFastModeFeature({
            fastModeState: params.fastModeState,
            setFastMode: params.setFastMode,
          }),
        ]
      : []),
    ...(btwBaseFeature
      ? [createBtwLocalFeature({ slashFilter: params.slashFilter, baseFeature: btwBaseFeature })]
      : []),
  ];
}
