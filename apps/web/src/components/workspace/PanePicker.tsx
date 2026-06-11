import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { PANE_TYPE_REGISTRY, type PaneTypeEntry } from './pane-registry';
import { useCommandFeatures } from './useCommandFeatures';

interface SessionInfo {
  channelId: string;
  title?: string;
  status?: 'idle' | 'busy';
  branch?: string;
  paneLabel?: string;
  cwd?: string;
}

interface PastSessionInfo {
  id: string;
  channelId: string;
  title?: string;
  cwd?: string;
  createdAt: string;
}

interface WorktreeInfo {
  path: string;
  branch?: string;
  name: string;
}

interface ProjectInfo {
  cwd: string;
  name: string;
}

type ToolTabType = 'git' | 'files' | 'openspec';
type ImportFormat = 'claude-jsonl';

interface PickerOpenOpts {
  split?: boolean;
}

interface PanePickerProps {
  open: boolean;
  onClose: () => void;
  /** 開啟時的初始搜尋列值（⌘⇧K 預填 '›' 直達指令模式） */
  initialQuery?: string;
  sessions?: SessionInfo[];
  pastSessions?: PastSessionInfo[];
  projects?: ProjectInfo[];
  allWorktrees?: Record<string, WorktreeInfo[]>;
  activeProjectCwd?: string;
  targetPaneId?: string;
  onShowHere?: (channelId: string, paneId?: string) => void;
  onResume?: (sessionId: string) => void;
  onNewSession?: (cwd: string, projectCwd: string, paneId?: string, opts?: PickerOpenOpts) => void;
  onOpenToolPane?: (type: ToolTabType, cwd: string, paneId?: string, opts?: PickerOpenOpts) => void;
  onOpenCombo?: (cwd: string, projectCwd: string) => void;
  onNewWorktree?: (projectCwd: string) => void;
  onImport?: (format: ImportFormat, cwd: string) => void;
  onAddProject?: () => void;
}

function relativeTime(iso: string): string {
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ── 欄3 的動作清單（鍵盤導航的單一平面 list）────────────────────────────────

type ContentItem =
  | { kind: 'type'; entry: PaneTypeEntry }
  | { kind: 'active'; session: SessionInfo }
  | { kind: 'resume'; session: PastSessionInfo }
  | { kind: 'combo' }
  | { kind: 'import' };

function contentItemLabel(item: ContentItem): string {
  switch (item.kind) {
    case 'type':
      return item.entry.label;
    case 'active':
      return item.session.title ?? item.session.channelId;
    case 'resume':
      return item.session.title ?? item.session.id;
    case 'combo':
      return '標準工作組 chat＋files＋git';
    case 'import':
      return 'Import';
  }
}

// ── Import 子頁（Miller 之外唯一保留的 view stack 層）────────────────────────

function ImportView({
  worktreePath,
  branch,
  onImport,
  onBack,
}: {
  worktreePath: string;
  branch: string;
  onImport?: (format: ImportFormat, cwd: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-sm font-mono">
          ←
        </button>
        <span className="text-sm text-muted">Import — ⎇ {branch}</span>
      </div>
      <button
        type="button"
        onClick={() => onImport?.('claude-jsonl', worktreePath)}
        className="px-3 py-2 text-sm text-left rounded-(--radius-row) border border-border hover:bg-hover-tint"
      >
        📄 Claude JSONL
      </button>
    </div>
  );
}

// ── CommandModeView（unified-command-entry §3）──────────────────────────────

function CommandModeView({
  query,
  onQueryChange,
  onClose,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const features = useCommandFeatures();
  const commandQuery = query.slice(1).toLowerCase(); // 去掉 › 前綴
  const [sel, setSel] = useState(0);

  const filtered = useMemo(
    () =>
      commandQuery
        ? features.filter(
            (f) => f.label.toLowerCase().includes(commandQuery) || f.id.includes(commandQuery),
          )
        : features,
    [features, commandQuery],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: commandQuery derives from query; sel must reset when search text changes
  useEffect(() => {
    setSel(0);
  }, [query]);

  function handleKey(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[sel];
      if (item) {
        item.execute();
        onClose();
      }
    }
  }

  return (
    <div data-testid="command-mode" className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 mb-2">
        <span aria-hidden="true" className="text-accent font-bold">
          ›
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="輸入指令…"
          aria-label="picker search"
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-dim"
        />
        <kbd className="font-mono text-2xs text-subtle border border-border rounded px-1 py-0.5">
          esc
        </kbd>
      </div>
      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 'var(--palette-max-h)' }}>
        {filtered.map((f, idx) => (
          <button
            key={f.id}
            type="button"
            data-testid={`command-item-${f.id}`}
            data-active={sel === idx || undefined}
            onClick={() => {
              f.execute();
              onClose();
            }}
            className={`flex items-center gap-2 px-3 text-sm text-left rounded-(--radius-row) ${
              sel === idx ? 'bg-selected text-selected-text' : 'hover:bg-hover-tint'
            }`}
            style={{ minHeight: 'var(--palette-row-h)' }}
          >
            <span className="truncate">{f.label}</span>
            {f.description && (
              <span className="ml-auto text-2xs text-subtle truncate">{f.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PanePicker（Miller 三欄，handoff §4：乙案定案）───────────────────────────

export function PanePicker({
  open,
  onClose,
  initialQuery,
  sessions = [],
  pastSessions = [],
  projects = [],
  allWorktrees = {},
  activeProjectCwd,
  targetPaneId,
  onShowHere,
  onResume,
  onNewSession,
  onOpenToolPane,
  onOpenCombo,
  onNewWorktree,
  onImport,
  onAddProject,
}: PanePickerProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [col, setCol] = useState<0 | 1 | 2>(2);
  const [selProjectCwd, setSelProjectCwd] = useState<string | null>(null);
  const [selWorktreePath, setSelWorktreePath] = useState<string | null>(null);
  const [sel3, setSel3] = useState(0);
  const [importTarget, setImportTarget] = useState<{ path: string; branch: string } | null>(null);

  // 開啟時重置；預設選 active project 的第一個 worktree、焦點在欄3（最常見：直接開內容）
  useEffect(() => {
    if (open) {
      setQuery(initialQuery ?? '');
      setCol(2);
      setSelProjectCwd(null);
      setSelWorktreePath(null);
      setSel3(0);
      setImportTarget(null);
    }
  }, [open, initialQuery]);

  const q = query.toLowerCase();
  // 搜尋語意：欄1 只在「有 project 命中」時過濾——查 worktree/session 名時
  // projects 欄保持完整，聯動不斷
  const filteredProjects = useMemo(() => {
    if (!q) return projects;
    const hit = projects.filter((p) => p.name.toLowerCase().includes(q));
    return hit.length > 0 ? hit : projects;
  }, [projects, q]);

  const projectCwd =
    selProjectCwd ??
    (activeProjectCwd && filteredProjects.some((p) => p.cwd === activeProjectCwd)
      ? activeProjectCwd
      : (filteredProjects[0]?.cwd ?? null));

  const worktreesRaw = projectCwd ? allWorktrees[projectCwd] : undefined;
  const worktreesLoading = projectCwd !== null && worktreesRaw === undefined;
  const filteredWorktrees = useMemo(() => {
    const list = worktreesRaw ?? [];
    return q ? list.filter((w) => (w.branch ?? w.name).toLowerCase().includes(q)) : list;
  }, [worktreesRaw, q]);

  const worktreePath =
    selWorktreePath && filteredWorktrees.some((w) => w.path === selWorktreePath)
      ? selWorktreePath
      : (filteredWorktrees[0]?.path ?? null);
  const worktree = filteredWorktrees.find((w) => w.path === worktreePath) ?? null;
  const branch = worktree ? (worktree.branch ?? worktree.name) : '';

  const activeSessions = sessions.filter((s) => s.cwd === worktreePath);
  const resumeSessions = pastSessions.filter((s) => s.cwd === worktreePath);

  const contentItems = useMemo<ContentItem[]>(() => {
    const items: ContentItem[] = PANE_TYPE_REGISTRY.map((entry) => ({ kind: 'type', entry }));
    for (const s of activeSessions) items.push({ kind: 'active', session: s });
    for (const s of resumeSessions) items.push({ kind: 'resume', session: s });
    if (onOpenCombo) items.push({ kind: 'combo' });
    if (onImport) items.push({ kind: 'import' });
    return q
      ? items.filter((i) => contentItemLabel(i).toLowerCase().includes(q) || i.kind === 'type')
      : items;
  }, [activeSessions, resumeSessions, onOpenCombo, onImport, q]);

  function activate(item: ContentItem, opts?: PickerOpenOpts): void {
    if (!worktreePath || !projectCwd) return;
    switch (item.kind) {
      case 'type':
        if (item.entry.key === 'chat') {
          onNewSession?.(worktreePath, projectCwd, targetPaneId, opts);
        } else {
          onOpenToolPane?.(item.entry.key, worktreePath, targetPaneId, opts);
        }
        break;
      case 'active':
        onShowHere?.(item.session.channelId, targetPaneId);
        break;
      case 'resume':
        onResume?.(item.session.id);
        break;
      case 'combo':
        onOpenCombo?.(worktreePath, projectCwd);
        break;
      case 'import':
        setImportTarget({ path: worktreePath, branch });
        break;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (importTarget) return;
    const inInput = (e.target as HTMLElement).tagName === 'INPUT';

    // ←→ 換欄（搜尋框內有文字時讓給游標移動）
    if (e.key === 'ArrowLeft' && (!inInput || query === '')) {
      e.preventDefault();
      setCol((c) => (c > 0 ? ((c - 1) as 0 | 1 | 2) : c));
      return;
    }
    if (e.key === 'ArrowRight' && (!inInput || query === '')) {
      e.preventDefault();
      setCol((c) => (c < 2 ? ((c + 1) as 0 | 1 | 2) : c));
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      if (col === 0) {
        const idx = filteredProjects.findIndex((p) => p.cwd === projectCwd);
        const next = filteredProjects[idx + delta];
        if (next) {
          setSelProjectCwd(next.cwd);
          setSelWorktreePath(null);
          setSel3(0);
        }
      } else if (col === 1) {
        const idx = filteredWorktrees.findIndex((w) => w.path === worktreePath);
        const next = filteredWorktrees[idx + delta];
        if (next) {
          setSelWorktreePath(next.path);
          setSel3(0);
        }
      } else {
        setSel3((i) => Math.min(Math.max(i + delta, 0), contentItems.length - 1));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = contentItems[col === 2 ? sel3 : 0];
      if (item) activate(item, e.metaKey || e.ctrlKey ? { split: true } : undefined);
      return;
    }
    // 快捷字母直選類型（registry 驅動）；⌘1 常用組合
    if (!inInput) {
      const entry = PANE_TYPE_REGISTRY.find(
        (t) => t.hotkey && t.hotkey.toLowerCase() === e.key.toLowerCase(),
      );
      if (entry && worktreePath) {
        e.preventDefault();
        activate({ kind: 'type', entry });
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '1' && onOpenCombo && worktreePath) {
      e.preventDefault();
      activate({ kind: 'combo' });
    }
  }

  function handleClose(): void {
    setImportTarget(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      {/* 視覺無標題（handoff §4：頂部即搜尋列）；title 留給 Radix 作 sr-only a11y 名稱 */}
      <DialogContent title="Open in pane" hideTitle size="picker">
        {importTarget ? (
          <ImportView
            worktreePath={importTarget.path}
            branch={importTarget.branch}
            onImport={onImport}
            onBack={() => setImportTarget(null)}
          />
        ) : query.startsWith('›') ? (
          <CommandModeView query={query} onQueryChange={setQuery} onClose={handleClose} />
        ) : (
          // biome-ignore lint/a11y/noStaticElementInteractions: 鍵盤協定容器——焦點落在內部互動元素上
          <div onKeyDown={handleKeyDown} data-testid="pane-picker-miller">
            <div className="flex items-center gap-2 border-b border-border px-2 mb-2">
              <span aria-hidden="true" className="text-subtle">
                ⌕
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋 project / worktree / session…"
                aria-label="picker search"
                className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-dim"
              />
              <kbd className="font-mono text-2xs text-subtle border border-border rounded px-1 py-0.5">
                esc
              </kbd>
            </div>
            <div className="flex flex-col lg:flex-row gap-3 min-h-64">
              {/* 欄1 Projects */}
              <div
                data-testid="pane-picker-col-projects"
                className="flex flex-col"
                style={{ flex: 4 }}
              >
                <p className="section-label mb-1">Projects</p>
                {filteredProjects.map((p) => (
                  <button
                    key={p.cwd}
                    type="button"
                    data-active={p.cwd === projectCwd || undefined}
                    onClick={() => {
                      setSelProjectCwd(p.cwd);
                      setSelWorktreePath(null);
                      setSel3(0);
                      setCol(0);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 text-sm text-left rounded-(--radius-row) ${
                      p.cwd === projectCwd
                        ? 'bg-selected text-selected-text'
                        : 'hover:bg-hover-tint'
                    }`}
                  >
                    {/* active 列 glyph 上 accent（design .tx-node.active .glyph） */}
                    <span
                      aria-hidden="true"
                      className={p.cwd === projectCwd ? 'text-accent' : 'text-subtle'}
                    >
                      ⌂
                    </span>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto font-mono text-2xs text-subtle">
                      {(allWorktrees[p.cwd] ?? []).length}⎇
                    </span>
                  </button>
                ))}
                {onAddProject && (
                  <button
                    type="button"
                    onClick={onAddProject}
                    className="px-2 py-1 text-xs text-left text-subtle hover:text-text mt-auto"
                  >
                    + Add project…
                  </button>
                )}
              </div>

              {/* 欄2 Worktrees */}
              <div
                data-testid="pane-picker-col-worktrees"
                className="flex flex-col lg:border-l border-t lg:border-t-0 border-border-subtle lg:pl-3 pt-2 lg:pt-0"
                style={{ flex: 5 }}
              >
                <p className="section-label mb-1">Worktrees</p>
                {worktreesLoading ? (
                  <p
                    data-testid="picker-worktrees-loading"
                    className="text-xs text-subtle px-2 py-1"
                  >
                    Loading worktrees…
                  </p>
                ) : (
                  filteredWorktrees.map((w) => {
                    const chats = sessions.filter((s) => s.cwd === w.path);
                    const busy = chats.some((s) => s.status === 'busy');
                    return (
                      <button
                        key={w.path}
                        type="button"
                        data-active={w.path === worktreePath || undefined}
                        onClick={() => {
                          setSelWorktreePath(w.path);
                          setSel3(0);
                          setCol(1);
                        }}
                        className={`flex items-center gap-2 px-2 py-1 text-left rounded-(--radius-row) ${
                          w.path === worktreePath
                            ? 'bg-selected text-selected-text'
                            : 'hover:bg-hover-tint'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={w.path === worktreePath ? 'text-accent' : 'text-subtle'}
                        >
                          ⎇
                        </span>
                        <span className="font-mono text-xs truncate">{w.branch ?? w.name}</span>
                        <span className="ml-auto font-mono text-2xs text-subtle whitespace-nowrap">
                          {chats.length > 0 && `${chats.length} chat${chats.length > 1 ? 's' : ''}`}
                          {busy && <span className="text-accent">・busy</span>}
                        </span>
                      </button>
                    );
                  })
                )}
                {onNewWorktree && projectCwd && (
                  <button
                    type="button"
                    onClick={() => onNewWorktree(projectCwd)}
                    className="px-2 py-1 text-xs text-left text-subtle hover:text-text mt-auto"
                  >
                    + New worktree…
                  </button>
                )}
              </div>

              {/* 欄3 內容（type grid＋進行中＋resume＋常用組合） */}
              <div
                data-testid="pane-picker-col-content"
                className="flex flex-col lg:border-l border-t lg:border-t-0 border-border-subtle lg:pl-3 pt-2 lg:pt-0 overflow-y-auto"
                style={{ flex: 6 }}
              >
                <p className="section-label mb-1">新增 pane</p>
                {/* 類型卡照 design .tx-type：bg-bg＋border-border、radius 9px 無 token 以
                    --radius-card(10) 近似、hover ≈ border-accent/55＋row-active-bg */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {contentItems.map((item, idx) =>
                    item.kind === 'type' ? (
                      <button
                        key={item.entry.key}
                        type="button"
                        data-testid={`picker-type-${item.entry.key}`}
                        data-active={(col === 2 && sel3 === idx) || undefined}
                        aria-label={
                          item.entry.key === 'chat'
                            ? 'New chat session'
                            : `Open ${item.entry.label} pane`
                        }
                        onClick={(e) =>
                          activate(item, e.metaKey || e.ctrlKey ? { split: true } : undefined)
                        }
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 text-xs rounded-(--radius-card) border ${
                          col === 2 && sel3 === idx
                            ? 'border-accent bg-selected'
                            : 'border-border bg-bg hover:border-accent/55 hover:bg-(--color-row-active-bg)'
                        }`}
                      >
                        <span aria-hidden="true">{item.entry.icon}</span>
                        <span>{item.entry.label}</span>
                        <span className="font-mono text-2xs text-subtle">
                          {item.entry.hotkey ?? '⏎'}
                        </span>
                      </button>
                    ) : null,
                  )}
                </div>

                {activeSessions.length > 0 && (
                  <>
                    <p className="section-label mb-1">進行中</p>
                    {/* 整列可點即 Show here（決策 15，design 無獨立鈕）；⏎ 走 activate 同路徑 */}
                    {contentItems.map((item, idx) =>
                      item.kind === 'active' ? (
                        <button
                          key={item.session.channelId}
                          type="button"
                          data-testid={`modal-session-item-${item.session.channelId}`}
                          data-active={(col === 2 && sel3 === idx) || undefined}
                          onClick={() => activate(item)}
                          className={`flex items-center px-2 py-1.5 rounded-(--radius-row) text-sm text-left ${
                            col === 2 && sel3 === idx ? 'bg-selected' : 'hover:bg-hover-tint'
                          }`}
                        >
                          <span className="truncate">
                            <span className={item.session.status === 'busy' ? 'text-accent' : ''}>
                              {item.session.status === 'busy' ? '●' : '○'}
                            </span>{' '}
                            {item.session.title ?? item.session.channelId}
                            {item.session.paneLabel && (
                              <span className="text-xs text-subtle ml-2">
                                ← {item.session.paneLabel}
                              </span>
                            )}
                          </span>
                        </button>
                      ) : null,
                    )}
                  </>
                )}

                {resumeSessions.length > 0 && (
                  <>
                    <p className="section-label mb-1 mt-2">歷史（resume）</p>
                    {contentItems.map((item, idx) =>
                      item.kind === 'resume' ? (
                        <button
                          key={item.session.id}
                          type="button"
                          data-testid={`picker-resume-item-${item.session.id}`}
                          data-active={(col === 2 && sel3 === idx) || undefined}
                          onClick={() => onResume?.(item.session.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-(--radius-row) text-sm text-left ${
                            col === 2 && sel3 === idx ? 'bg-selected' : 'hover:bg-hover-tint'
                          }`}
                        >
                          <span aria-hidden="true">⟲</span>
                          <span className="truncate">{item.session.title ?? item.session.id}</span>
                          <span className="ml-auto text-2xs text-subtle whitespace-nowrap">
                            {relativeTime(item.session.createdAt)}
                          </span>
                        </button>
                      ) : null,
                    )}
                  </>
                )}

                <div className="mt-auto pt-2 flex flex-col gap-1">
                  {contentItems.map((item, idx) =>
                    item.kind === 'combo' ? (
                      <button
                        key="combo"
                        type="button"
                        data-testid="picker-combo-standard"
                        data-active={(col === 2 && sel3 === idx) || undefined}
                        onClick={() => activate(item)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-(--radius-row) text-sm text-left border border-dashed ${
                          col === 2 && sel3 === idx
                            ? 'border-accent bg-selected'
                            : 'border-border hover:bg-hover-tint'
                        }`}
                      >
                        <span aria-hidden="true">⊞</span>
                        <span>標準工作組 chat＋files＋git</span>
                        <span className="ml-auto font-mono text-2xs text-subtle">⌘1</span>
                      </button>
                    ) : item.kind === 'import' ? (
                      <button
                        key="import"
                        type="button"
                        data-active={(col === 2 && sel3 === idx) || undefined}
                        onClick={() => activate(item)}
                        className="px-2 py-1 text-xs text-left text-subtle hover:text-text"
                      >
                        ⬆ Import…
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-3 pt-2 border-t border-border-subtle font-mono text-2xs text-subtle">
              <span>←→ 換欄</span>
              <span>↑↓ 移動</span>
              <span>⏎ 開啟到目前 pane</span>
              <span>⌘⏎ 分割開啟</span>
              <span>F/G/O 直選類型</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
