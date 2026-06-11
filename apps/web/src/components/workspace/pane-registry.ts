import type { PaneContent } from '@/contexts/TabContext';

/**
 * Pane 類型 registry（handoff: State Management / tmux-details TxAtoms）。
 * picker 的類型 grid、dock chips、drawer「釘選成 pane」都從這裡讀——
 * 新增 terminal / diff 等類型時只要註冊一筆，三個入口自動出現。
 */
export interface PaneTypeEntry {
  key: 'chat' | 'files' | 'git' | 'openspec';
  icon: string;
  label: string;
  /** picker 第三欄的快捷字母（chat 用 ⏎ 直開，無字母） */
  hotkey: string | null;
  /** 由 worktree cwd 建構 leaf content descriptor */
  makeContent: (cwd: string) => PaneContent;
}

export const PANE_TYPE_REGISTRY: readonly PaneTypeEntry[] = [
  {
    key: 'chat',
    icon: '✦',
    label: 'chat',
    hotkey: null,
    makeContent: (cwd) => ({ type: 'session', sessionId: null, cwd }),
  },
  {
    key: 'files',
    icon: '▤',
    label: 'files',
    hotkey: 'F',
    makeContent: (cwd) => ({ type: 'files', target: { kind: 'fixed', cwd } }),
  },
  {
    key: 'git',
    icon: '±',
    label: 'git',
    hotkey: 'G',
    makeContent: (cwd) => ({ type: 'git', target: { kind: 'fixed', cwd } }),
  },
  {
    key: 'openspec',
    icon: '◈',
    label: 'spec',
    hotkey: 'O',
    makeContent: (cwd) => ({ type: 'openspec', target: { kind: 'fixed', cwd } }),
  },
  // 未來：{ key: 'diff', hotkey: 'D' }、{ key: 'terminal', hotkey: 'T' } 註冊即生效
] as const;
