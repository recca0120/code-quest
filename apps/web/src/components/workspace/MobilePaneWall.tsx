import { useState } from 'react';
import { leafIdsInOrder, type PaneNode, usePaneActions, usePaneState } from '@/contexts/TabContext';
import { useMobileMode } from './useMobileMode';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

function leafLabel(node: PaneNode, id: string): string {
  if (node.type === 'leaf') {
    if (node.id !== id) return '';
    const c = node.content;
    if (c.type === 'session') return c.cwd ? (c.cwd.split('/').pop() ?? 'chat') : 'chat';
    return c.type;
  }
  return leafLabel(node.first, id) || leafLabel(node.second, id);
}

/**
 * Mobile 卡片牆切換器（handoff §8）：pane tree 攤平成 2 欄卡片，
 * 點卡＝focusPane（solo rendering 跟著換）。⊞ 開關。
 */
export function MobilePaneWall(): React.JSX.Element | null {
  const { paneRoot } = usePaneState();
  const { focusPane } = usePaneActions();
  const isMobile = useMobileMode();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;
  const leaves = leafIdsInOrder(paneRoot);
  if (leaves.length < 2) return null;

  return (
    <>
      <button
        type="button"
        data-testid="mobile-pane-wall-toggle"
        aria-label="open pane switcher"
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-3 z-float size-9 rounded-full bg-surface border border-border text-text shadow-floating"
      >
        ⊞
      </button>
      {open && (
        <div className="fixed inset-0 z-overlay flex flex-col bg-overlay">
          <button
            type="button"
            aria-label="close pane switcher"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div
            data-testid="mobile-pane-wall"
            className="relative grid grid-cols-2 gap-3 p-4 mt-12 overflow-y-auto"
          >
            {leaves.map((id, idx) => (
              <button
                key={id}
                type="button"
                data-testid={`pane-wall-card-${id}`}
                data-pane-id={id}
                onClick={() => {
                  focusPane(id);
                  setOpen(false);
                }}
                className="flex flex-col items-start gap-2 h-24 p-3 rounded-(--radius-card) border border-border bg-surface text-left text-sm hover:border-accent"
              >
                <span className="font-mono text-2xs text-accent">{CIRCLED[idx] ?? idx + 1}</span>
                <span className="truncate text-text">{leafLabel(paneRoot, id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
