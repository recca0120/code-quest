import { toast } from 'sonner';

/** handoff §2：pane 最小 320×160——低於下限拒絕分割並 toast 提示。 */
const MIN_W = 320;
const MIN_H = 160;

/**
 * 以 pane 的實際 DOM 尺寸檢查分割是否會低於最小尺寸。
 * 無佈局環境（jsdom rect 0）放行——護欄只在真瀏覽器有意義。
 */
export function guardSplitMinSize(paneId: string | null, direction: 'h' | 'v'): boolean {
  if (!paneId) return true;
  const el = document.querySelector(`[data-pane-id="${CSS.escape(paneId)}"]`);
  if (!el) return true;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return true; // jsdom／未佈局
  const fits = direction === 'h' ? rect.width >= MIN_W * 2 : rect.height >= MIN_H * 2;
  if (!fits) {
    toast.error(`Pane 太小無法分割（最小 ${MIN_W}×${MIN_H}）`);
  }
  return fits;
}
