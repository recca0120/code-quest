import type { WorktreeInfo } from '@code-quest/git';
import {
  type AccountInfo,
  type Ack,
  type ControlResponse,
  type EffortLevel,
  EVENTS,
  getProviderConfigResponseSchema,
  type ModelInfo,
  type ProviderClientConfig,
  type RpcResult,
  type UsageQuota,
} from '@code-quest/schemas';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from '../SessionContext.tsx';
import { useSocket } from '../SocketContext.tsx';
import { useChannelMessages } from './ChannelMessagesContext.tsx';
import { useChannelId } from './ChannelMetaContext.tsx';
import { useChannelSocketRouter } from './ChannelSocketRouterContext.tsx';
import { configHandlers, createConfigActions, parseModels, toEffort } from './handlers/settings.ts';

export interface ConfigState {
  model: string | null;
  availableModels: ModelInfo[];
  mcpServers: Array<{ name: string; status: string; scope?: string }>;
  tools: string[];
  permissionMode: string | null;
  thinkingLevel: string;
  effort: EffortLevel | null;
  fastModeState: 'on' | 'off' | null;
  config: Record<string, unknown>;
  currentRepo: string | null;
  slashCommands: string[];
  providerConfig?: ProviderClientConfig;
  accountInfo: AccountInfo | null;
  experimentGates: Record<string, boolean>;
  usageQuota: UsageQuota | null;
  contextUsage: Record<string, unknown> | null;
  worktree: WorktreeInfo | null;
}

export interface ChannelConfigValue extends ConfigState {
  isFastMode: boolean;
  providerConfig?: ProviderClientConfig;
  setModel: (model: string) => void;
  setPermissionMode: (mode: string) => void;
  setThinkingLevel: (level: string) => void;
  setFastMode: (enabled: boolean) => void;
  setEffort: (effort: string) => Promise<Ack>;
  mcpStatus: () => Promise<ControlResponse>;
  mcpToggle: (serverName: string, enabled: boolean) => Promise<ControlResponse>;
  mcpReconnect: (serverName: string) => Promise<ControlResponse>;
  mcpSetServers: (servers: Record<string, unknown>) => Promise<ControlResponse>;
  mcpMessage: (serverName: string, message: Record<string, unknown>) => Promise<ControlResponse>;
  mcpListTools: (serverName: string) => Promise<unknown[]>;
  mcpAuthenticate: (serverName: string) => Promise<RpcResult<{ authUrl?: string }>>;
  mcpOAuthCallback: (serverName: string, callbackUrl: string) => Promise<Ack>;
  mcpClearAuth: (serverName: string) => Promise<Ack>;
  ensureChromeMcpEnabled: () => Promise<ControlResponse>;
  disableChromeMcp: () => Promise<ControlResponse>;
  enableJupyterMcp: () => Promise<ControlResponse>;
  disableJupyterMcp: () => Promise<ControlResponse>;
  askDebuggerHelp: () => Promise<RpcResult<{ response: { type: 'ask_debugger_help_response' } }>>;
  requestUsageUpdate: () => void;
  openNewChannel: (cwd: string) => void;
}

type ConfigStateValue = ConfigState & { isFastMode: boolean };
type ConfigActionsValue = Omit<ChannelConfigValue, keyof ConfigStateValue>;

const ConfigStateContext = createContext<ConfigStateValue | null>(null);
const ConfigActionsContext = createContext<ConfigActionsValue | null>(null);

export function useChannelConfig(): ChannelConfigValue {
  const state = useContext(ConfigStateContext);
  const actions = useContext(ConfigActionsContext);
  if (!state || !actions) throw new Error('useChannelConfig must be used within a ChannelProvider');
  return { ...state, ...actions };
}

export function buildInitialConfig(
  opts: Record<string, unknown>,
): Partial<Pick<ConfigState, 'model' | 'permissionMode'>> {
  const result: Partial<Pick<ConfigState, 'model' | 'permissionMode'>> = {};
  if (typeof opts.model === 'string') result.model = opts.model;
  if (typeof opts.permissionMode === 'string') result.permissionMode = opts.permissionMode;
  return result;
}

const INITIAL_CONFIG: ConfigState = {
  model: null,
  availableModels: [],
  mcpServers: [],
  tools: [],
  permissionMode: null,
  thinkingLevel: 'off',
  effort: null,
  fastModeState: null,
  config: {},
  currentRepo: null,
  slashCommands: [],
  accountInfo: null,
  experimentGates: {},
  usageQuota: null,
  contextUsage: null,
  worktree: null,
};

export function ChannelConfigProvider({
  initialConfig,
  onNewChannel,
  onChange,
  children,
}: {
  initialConfig?: Partial<ConfigState>;
  onNewChannel?: (cwd: string) => void;
  /** 回報 config 層變更給 shell（permissionMode → TabMeta → pane 殼換色） */
  onChange?: (update: { permissionMode?: string }) => void;
  children: ReactNode;
}): React.JSX.Element {
  const channelId = useChannelId();
  const { addSystemMessage } = useChannelMessages();
  const [configState, setConfigState] = useState<ConfigState>(() => ({
    ...INITIAL_CONFIG,
    ...initialConfig,
  }));

  const { socket } = useSocket();

  const onNewChannelRef = useRef(onNewChannel);
  onNewChannelRef.current = onNewChannel;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // permissionMode 變更回報 shell（pane 殼邊框換色——handoff §2）
  useEffect(() => {
    if (configState.permissionMode) {
      onChangeRef.current?.({ permissionMode: configState.permissionMode });
    }
  }, [configState.permissionMode]);

  // ── Fetch provider config on mount ──
  useEffect(() => {
    if (!channelId) return;
    socket.emit(EVENTS.app.config, { channelId }, (raw) => {
      const parsed = getProviderConfigResponseSchema.safeParse(raw);
      if (!parsed.success) return;
      const res = parsed.data;
      const models =
        Array.isArray(res.models) && res.models.length > 0
          ? parseModels(res.models)
          : res.providerConfig?.defaultModels
            ? parseModels(res.providerConfig.defaultModels)
            : undefined;
      setConfigState((prev) => ({
        ...prev,
        ...(res.providerConfig ? { providerConfig: res.providerConfig } : {}),
        ...(models ? { availableModels: models } : {}),
        ...(res.effort ? { effort: toEffort(res.effort) } : {}),
      }));
    });
  }, [channelId, socket]);

  const router = useChannelSocketRouter();

  // ── Auto-wiring: handler map events ──
  useEffect(() => {
    if (!channelId) return;
    return router.register(configHandlers, setConfigState);
  }, [channelId, router]);

  // ── Derive effort from SessionContext.sessions ──
  // effort is broadcast globally via session:states; sync it here.
  const { sessionsMap } = useSession();
  useEffect(() => {
    if (!channelId) return;
    const summary = sessionsMap.get(channelId);
    if (!summary) return;
    setConfigState((prev) => {
      const nextEffort = summary.effort ? toEffort(summary.effort) : prev.effort;
      if (prev.effort === nextEffort) return prev;
      return { ...prev, effort: nextEffort };
    });
  }, [channelId, sessionsMap]);

  // ── Actions (rebuilt when socket/channelId change) ──
  const actions = useMemo<ConfigActionsValue>(
    () => ({
      ...createConfigActions({ socket, channelId, setState: setConfigState, addSystemMessage }),
      openNewChannel: (cwd: string) => onNewChannelRef.current?.(cwd),
    }),
    [socket, channelId, addSystemMessage],
  );

  // ── State value ──
  const stateValue: ConfigStateValue = {
    ...configState,
    isFastMode: configState.fastModeState === 'on',
  };

  return (
    <ConfigActionsContext.Provider value={actions}>
      <ConfigStateContext.Provider value={stateValue}>{children}</ConfigStateContext.Provider>
    </ConfigActionsContext.Provider>
  );
}
