import type { PaneNode } from '@/contexts/TabContext';

export const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

export function formatWorktreeLabel(wt: { branch?: string; name: string }): string {
  return wt.branch ?? wt.name;
}

/**
 * leaf 的顯示名（mobile 卡片牆／tablet 直立條共用）：
 * session → cwd 尾段（無 cwd 退 'chat'）；其他類型 → 類型名。
 */
export function leafLabel(node: PaneNode, id: string): string {
  if (node.type === 'leaf') {
    if (node.id !== id) return '';
    const c = node.content;
    if (c.type === 'session') return c.cwd ? (c.cwd.split('/').pop() ?? 'chat') : 'chat';
    return c.type;
  }
  return leafLabel(node.first, id) || leafLabel(node.second, id);
}
