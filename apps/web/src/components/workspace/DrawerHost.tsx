import { useEffect, useState } from 'react';
import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import { useDrawerActions, useDrawerState } from '@/contexts/DrawerContext';
import { type PaneContent, usePaneActions } from '@/contexts/TabContext';

function drawerTitle(content: PaneContent): string {
  if ('target' in content && content.target.kind === 'fixed') return content.target.cwd;
  return content.type;
}

function renderDrawerBody(content: PaneContent): React.ReactNode {
  if (!('target' in content) || content.target.kind !== 'fixed') return null;
  const cwd = content.target.cwd;
  switch (content.type) {
    case 'git':
      return <GitView cwd={cwd} />;
    case 'files':
      return <FilesView cwd={cwd} />;
    case 'openspec':
      return <SpecView cwd={cwd} />;
    default:
      return null;
  }
}

/**
 * 右側滑入 drawer（handoff §5）：遮罩點擊／esc 關閉；
 * 「⊞ 釘選成 pane」把 descriptor 轉成 focused pane 右側的新 leaf（registry 同源），
 * 走既有 layout 管線存檔。寬 56%（min 480px），動效吃 --dur-drawer。
 */
export function DrawerHost(): React.JSX.Element | null {
  const { drawer } = useDrawerState();
  const { closeDrawer } = useDrawerActions();
  const { splitPaneAndSetContent } = usePaneActions();
  const [widthPx, setWidthPx] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // 開新 drawer 時重置寬度狀態
  // biome-ignore lint/correctness/useExhaustiveDependencies: 以 drawer 身份重置
  useEffect(() => {
    setWidthPx(null);
    setFullscreen(false);
  }, [drawer]);

  function handleGrabberDown(e: React.PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    function onMove(ev: PointerEvent): void {
      const next = window.innerWidth - ev.clientX;
      setWidthPx(Math.max(480, Math.min(window.innerWidth - 80, next)));
    }
    function onUp(): void {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  useEffect(() => {
    if (!drawer) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer, closeDrawer]);

  if (!drawer) return null;

  function handlePin(): void {
    if (!drawer) return;
    splitPaneAndSetContent('h', drawer.content);
    closeDrawer();
  }

  return (
    <div className="fixed inset-0 z-float">
      {/* 遮罩：esc 已是鍵盤等效（document listener），按鈕語意給點擊關閉 */}
      <button
        type="button"
        aria-label="close drawer overlay"
        data-testid="drawer-overlay"
        onClick={closeDrawer}
        className="absolute inset-0 bg-overlay cursor-default"
      />
      <aside
        data-testid="workspace-drawer"
        aria-label="drawer"
        className="absolute bg-surface shadow-floating flex flex-col max-md:inset-x-0 max-md:bottom-0 max-md:h-2/3 max-md:rounded-t-(--radius-sheet) max-md:border-t md:right-0 md:top-0 md:bottom-0 md:border-l border-border max-md:pb-(--safe-bottom)"
        style={{
          // width + minWidth 等價 max(480px, 56%)，且 jsdom 可解析
          width: fullscreen ? '100%' : widthPx !== null ? `${widthPx}px` : 'var(--drawer-w)',
          minWidth: fullscreen ? undefined : 'var(--drawer-min-w)',
        }}
      >
        {/* 左緣拖寬把手（handoff §5：左緣 6px 熱區） */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: resize 把手——鍵盤等效為 ⤢ 全螢幕切換 */}
        <div
          data-testid="drawer-grabber"
          onPointerDown={handleGrabberDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40"
        />
        <header className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
          <span className="font-mono text-xs font-semibold truncate">
            {drawerTitle(drawer.content)}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handlePin}
              className="px-2 py-1 text-xs rounded bg-accent text-selected-text"
            >
              ⊞ 釘選成 pane
            </button>
            <button
              type="button"
              aria-label="toggle drawer fullscreen"
              onClick={() => setFullscreen((v) => !v)}
              className="px-2 py-1 text-xs opacity-60 hover:opacity-100"
              title="全螢幕"
            >
              ⤢
            </button>
            <button
              type="button"
              aria-label="close drawer"
              onClick={closeDrawer}
              className="px-2 py-1 text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </span>
        </header>
        <div className="flex-1 min-h-0 overflow-auto">{renderDrawerBody(drawer.content)}</div>
        <footer className="px-4 py-1.5 border-t border-border-subtle font-mono text-2xs text-dim shrink-0">
          esc 關閉／拖左緣調寬度／釘選後成為 pane tree 的新 leaf
        </footer>
      </aside>
    </div>
  );
}
