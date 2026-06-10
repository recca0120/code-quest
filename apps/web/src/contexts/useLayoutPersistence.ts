/**
 * Layout persistence protocol unit (layout-persistence F1 v2 echo guard):
 * - rev guard: ignore layout:sync with rev <= lastSeenRev (stale / own echo)
 * - lastAppliedJson is computed from the APPLIED state — this is what breaks the
 *   save↔sync loop even when view-state preservation makes our state differ from
 *   the incoming payload (relies on serialize∘deserialize ≡ identity)
 * - LWW apply: adopt the incoming tree wholesale + dedupe channelIds; only
 *   view-state (activeTab / focused / zoomed) is preserved on sync
 *
 * Soft-bound contexts (direct useContext, no throwing hooks) keep the owning
 * provider mountable without SocketProvider / AppConfigProvider in tests.
 */
import type { PersistedLayout } from '@code-quest/schemas';
import {
  dedupeLayoutChannelIds,
  EVENTS,
  migrateLegacyToV2,
  persistedLayoutSchema,
} from '@code-quest/schemas';
import { type Dispatch, type SetStateAction, useContext, useEffect, useRef } from 'react';
import { AppConfigActionsContext } from './AppInitContext.tsx';
import { deserializeNode, serializeLayout } from './pane-codecs.ts';
import { firstLeafId, hasLeaf, type WorkspaceTabStateValue } from './pane-tree.ts';
import { SocketContext } from './SocketContext.tsx';

/** rev 只存在於下行 payload（layout:sync / app:init），schema parse 會 strip——先讀。 */
function readRev(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const rev = (payload as { rev?: unknown }).rev;
  return typeof rev === 'number' ? rev : null;
}

function hasTabId(id: string): (t: { id: string }) => boolean {
  return (t) => t.id === id;
}

export function useLayoutPersistence(
  wsState: WorkspaceTabStateValue,
  setWsState: Dispatch<SetStateAction<WorkspaceTabStateValue>>,
): void {
  const lastSeenRevRef = useRef(0);
  const lastAppliedJsonRef = useRef<string | null>(null);
  // activeTabId is a cold-start preference: only the FIRST init applies it.
  // Reconnect re-fires app:init with the stored layout — that replay must not
  // steal the local active tab (spec: "activeTabId SHALL 僅在 app:init 初次套用").
  const initAppliedRef = useRef(false);

  function applyLayout(layout: PersistedLayout, source: 'init' | 'sync') {
    if (!layout.tabs.length) return;
    const deduped = dedupeLayoutChannelIds(layout);
    setWsState((prev) => {
      // LWW: adopt the incoming tree wholesale; only view-state is preserved
      const workspaceTabs = deduped.tabs.map((t) => {
        const prevTab = prev.workspaceTabs.find((p) => p.id === t.id);
        const paneRoot = deserializeNode(t.paneRoot);
        return {
          id: t.id,
          label: t.label,
          paneRoot,
          focusedPaneId:
            prevTab?.focusedPaneId && hasLeaf(paneRoot, prevTab.focusedPaneId)
              ? prevTab.focusedPaneId
              : firstLeafId(paneRoot),
          zoomedPaneId:
            prevTab?.zoomedPaneId && hasLeaf(paneRoot, prevTab.zoomedPaneId)
              ? prevTab.zoomedPaneId
              : null,
        };
      });
      // activeTabId is a cold-start preference: applied on init, never steals
      // the local view on sync (unless the local tab vanished from incoming)
      const keepLocalActive =
        source === 'sync' &&
        prev.activeWorkspaceTabId !== null &&
        workspaceTabs.some(hasTabId(prev.activeWorkspaceTabId));
      const candidate = keepLocalActive ? prev.activeWorkspaceTabId : deduped.activeTabId;
      // Membership guard (clamp-not-reject): a corrupt/foreign activeTabId must
      // not leave paneState dangling — fall back to the first tab
      const activeWorkspaceTabId =
        candidate !== null && workspaceTabs.some(hasTabId(candidate))
          ? candidate
          : (workspaceTabs[0]?.id ?? null);
      const next: WorkspaceTabStateValue = { workspaceTabs, activeWorkspaceTabId };
      lastAppliedJsonRef.current = JSON.stringify(serializeLayout(next));
      return next;
    });
  }

  // Subscribe to app:init ACK to rehydrate layout (optional — works without AppConfigProvider)
  const appConfigActions = useContext(AppConfigActionsContext);
  // biome-ignore lint/correctness/useExhaustiveDependencies: applyLayout and appConfigActions are stable
  useEffect(() => {
    if (!appConfigActions) return;
    return appConfigActions.subscribeInit((data) => {
      const layout = (data as { layout?: unknown }).layout;
      if (!layout) return;
      const rev = readRev(layout);
      const parsed = persistedLayoutSchema.safeParse(migrateLegacyToV2(layout));
      if (!parsed.success) return;
      if (rev !== null) lastSeenRevRef.current = Math.max(lastSeenRevRef.current, rev);
      applyLayout(parsed.data, initAppliedRef.current ? 'sync' : 'init');
      initAppliedRef.current = true;
    });
  }, [appConfigActions]);

  // Listen for layout:sync from server (cross-device update)
  const socketCtx = useContext(SocketContext);
  const socket = socketCtx?.socket ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: applyLayout is stable
  useEffect(() => {
    if (!socket) return;
    function onSync(payload: unknown) {
      const rev = readRev(payload);
      if (rev !== null && rev <= lastSeenRevRef.current) return; // stale / own echo
      const parsed = persistedLayoutSchema.safeParse(migrateLegacyToV2(payload));
      if (!parsed.success) return;
      if (rev !== null) lastSeenRevRef.current = rev;
      applyLayout(parsed.data, 'sync');
    }
    socket.on(EVENTS.layout.sync, onSync);
    return () => {
      socket.off(EVENTS.layout.sync, onSync);
    };
  }, [socket]);

  // Debounced layout:save — emit 500ms after wsState changes (skip initial mount).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: socket is stable; save is driven by wsState only
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!socket) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const serialized = serializeLayout(wsState);
      const json = JSON.stringify(serialized);
      if (json === lastAppliedJsonRef.current) return;
      socket.emit(EVENTS.layout.save, serialized, (res) => {
        if (typeof res === 'object' && res !== null && (res as { ok?: boolean }).ok === true) {
          const rev = (res as { rev?: number }).rev;
          if (typeof rev === 'number') {
            lastSeenRevRef.current = Math.max(lastSeenRevRef.current, rev);
          }
          lastAppliedJsonRef.current = json;
        }
      });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [wsState]);
}
