import { useEffect, useState } from 'react';
import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';
import { useDrawerActions, useDrawerState } from '@/contexts/DrawerContext';
import { type PaneContent, usePaneActions } from '@/contexts/TabContext';
import { PANE_TYPE_REGISTRY } from './pane-registry';
import { useMobileMode } from './useMobileMode';

function drawerTitle(content: PaneContent): string {
  if ('target' in content && content.target.kind === 'fixed') return content.target.cwd;
  return content.type;
}

/** 類型 icon（handoff §5 header）：content.type → registry（session 走 chat 鍵） */
function drawerIcon(content: PaneContent): string | null {
  const key = content.type === 'session' ? 'chat' : content.type;
  return PANE_TYPE_REGISTRY.find((entry) => entry.key === key)?.icon ?? null;
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
  const isMobile = useMobileMode();
  // mobile bottom sheet 三段 snap（handoff §8：0／66／100）——0＝關閉
  const [sheetSnap, setSheetSnap] = useState<66 | 100>(66);
  // 滑入動效：初掛 translate-x-full（mobile translate-y-full）→ 0，遮罩 fade
  const [entered, setEntered] = useState(false);

  // 開新 drawer 時重置寬度狀態，並起動滑入 transition
  // biome-ignore lint/correctness/useExhaustiveDependencies: 以 drawer 身份重置
  useEffect(() => {
    setWidthPx(null);
    setFullscreen(false);
    setSheetSnap(66);
    setEntered(false);
    if (!drawer) return;
    // 兩拍 rAF：先讓初掛 translate 進到樣式計算，下一拍翻轉觸發 transition
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [drawer]);

  function handleSheetGrabberDown(e: React.PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    function onUp(ev: PointerEvent): void {
      window.removeEventListener('pointerup', onUp);
      const ratio = 1 - ev.clientY / window.innerHeight;
      if (ratio > 0.83) setSheetSnap(100);
      else if (ratio > 0.33) setSheetSnap(66);
      else closeDrawer();
    }
    window.addEventListener('pointerup', onUp);
  }

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
        className={`absolute inset-0 bg-bg/45 cursor-default transition-opacity duration-(--dur-drawer) ease-(--ease-out-soft) ${entered ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        data-testid="workspace-drawer"
        aria-label="drawer"
        className={`absolute bg-bg shadow-floating flex flex-col max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-(--radius-sheet) max-md:border-t md:right-0 md:top-0 md:bottom-0 md:border-l border-border max-md:pb-(--safe-bottom) transition-transform duration-(--dur-drawer) ease-(--ease-out-soft) ${entered ? 'translate-x-0 translate-y-0' : 'max-md:translate-y-full md:translate-x-full'}`}
        style={
          isMobile
            ? { height: `${sheetSnap}%` }
            : {
                // width + minWidth 等價 max(480px, 56%)，且 jsdom 可解析
                width: fullscreen ? '100%' : widthPx !== null ? `${widthPx}px` : 'var(--drawer-w)',
                minWidth: fullscreen ? undefined : 'var(--drawer-min-w)',
              }
        }
      >
        {/* mobile sheet grabber（44×5）：上下拖 snap 0/66/100 */}
        {isMobile && (
          // biome-ignore lint/a11y/noStaticElementInteractions: sheet 拖拉把手——esc／遮罩為等效關閉
          <div
            data-testid="sheet-grabber"
            onPointerDown={handleSheetGrabberDown}
            className="flex justify-center py-1.5 cursor-grab shrink-0"
          >
            <span className="w-11 h-(--sheet-grabber-h) rounded-full bg-text-dim" />
          </div>
        )}
        {/* 左緣拖寬把手（handoff §5：左緣 6px 熱區＋中央 44px 把手條）——mobile sheet 不提供 */}
        {!isMobile && (
          // biome-ignore lint/a11y/noStaticElementInteractions: resize 把手——鍵盤等效為 ⤢ 全螢幕切換
          <div
            data-testid="drawer-grabber"
            onPointerDown={handleGrabberDown}
            className="group absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 flex items-center justify-center"
          >
            <span className="w-(--drawer-grab-bar-w) h-11 rounded-full bg-text-dim group-hover:bg-accent" />
          </div>
        )}
        <header className="flex items-center gap-2 px-4 h-10 border-b border-border-subtle bg-surface shrink-0">
          {drawerIcon(drawer.content) && (
            <span aria-hidden="true" className="text-dim">
              {drawerIcon(drawer.content)}
            </span>
          )}
          <span className="font-mono text-xs font-semibold truncate">
            {drawerTitle(drawer.content)}
          </span>
          {/* diffstat（handoff §5）：資料管線尚未提供 diff 統計——有資料後補在標題右側 */}
          <span className="ml-auto flex items-center gap-2">
            {!isMobile && (
              <button
                type="button"
                onClick={handlePin}
                className="px-2 py-1 text-xs rounded-(--radius-row) bg-accent-soft border border-accent/45 text-accent"
              >
                ⊞ 釘選成 pane
              </button>
            )}
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
          {isMobile
            ? '上拉全螢幕／下拉關閉'
            : 'esc 關閉／拖左緣調寬度／釘選後成為 pane tree 的新 leaf'}
        </footer>
      </aside>
    </div>
  );
}
