import { asyncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react/react-compiler';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFsActions, useFsBrowse } from '@/contexts/FsContext';
import { basename } from '@/utils/basename';
import { nextDuplicateName } from '@/utils/duplicate-name';
import { sortEntriesDirsFirst } from '@/utils/sort-entries';

import { SkeletonRows } from '../ui/SkeletonRows.tsx';
import { DeleteEntryConfirmDialog } from './DeleteEntryConfirmDialog.tsx';
import { FileTreeRow } from './FileTreeRow.tsx';
import { NewEntryDialog } from './NewEntryDialog.tsx';

const ITEM_CLS =
  'w-full px-3 py-1 text-left text-sm data-[highlighted]:bg-accent/20 outline-none cursor-pointer';
const DANGER_CLS =
  'w-full px-3 py-1 text-left text-sm text-danger data-[highlighted]:bg-danger/10 outline-none cursor-pointer';

type EntryItem =
  | { name: string; path: string; kind: 'directory' }
  | { name: string; path: string; kind: 'file'; size: number };

export function FileTree({
  rootCwd,
  showHidden,
  gitMarks,
  onSelect,
  onActivate,
  onHighlight,
  highlightedPath,
  disabledPaths,
}: {
  /** When set, root items are children of this path (instead of the
   *  server-configured allowed roots). Used by FilesPane to scope the tree
   *  to the active project's cwd. */
  rootCwd?: string;
  showHidden?: boolean;
  /** Map<absolute-path, git-status-mark> — render badge per matching file. */
  gitMarks?: Map<string, string>;
  onSelect?: (path: string) => void;
  onActivate?: (file: EntryItem, event: MouseEvent) => void;
  onHighlight?: (path: string) => void;
  highlightedPath?: string | null;
  /** Absolute paths that should render as visually disabled and ignore
   *  click / double-click / highlight (right-click context menu still
   *  works for fs CRUD). Used by AddProjectDialog to mark already-added
   *  project roots. */
  disabledPaths?: ReadonlySet<string>;
}): React.JSX.Element {
  const { browseEntries } = useFsBrowse();
  const fsActions = useFsActions();
  const { subscribeFsDirty } = fsActions;

  const [loadingItemData, setLoadingItemData] = useState<string[]>([]);
  const [loadingItemChildrens, setLoadingItemChildrens] = useState<string[]>([]);
  /** Flips true after the first `dataLoader.getChildrenWithData('root')`
   *  resolves. Resets implicitly on cwd change because the parent uses
   *  `<FileTree key={cwd}>` to remount. */
  const [hasLoadedRoot, setHasLoadedRoot] = useState(false);
  /** Per-path entry kind, populated as `getChildrenWithData` resolves —
   *  feeds `dataLoader.getItem` so file leaves don't lie about isItemFolder
   *  during focus/refresh callbacks before their parent re-fetches. */
  const kindByPathRef = useRef<Map<string, 'file' | 'directory'>>(new Map());
  /** Inline-rename: holds the target path while user types a new name. */
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null);
  /** Pending dialog state. */
  const [newEntry, setNewEntry] = useState<{ parent: string; kind: 'file' | 'directory' } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<{ path: string; descendantCount: number } | null>(null);

  /** Resolve the directory a context-menu action targets. For directory rows
   *  use the row itself; for file rows use the parent. */
  function targetDirFor(path: string, isDir: boolean): string {
    if (isDir) return path;
    const slash = path.lastIndexOf('/');
    return slash === -1 ? path : path.slice(0, slash);
  }

  async function handleDuplicate(path: string) {
    const parent = targetDirFor(path, false);
    const name = basename(path);
    const browseResult = await browseEntries(parent);
    if ('error' in browseResult) {
      toast.error(`Duplicate failed: ${browseResult.error}`);
      return;
    }
    const { directories, files } = browseResult;
    const siblings = [...directories.map((d) => d.name), ...files.map((f) => f.name)];
    const dest = `${parent}/${nextDuplicateName(siblings, name)}`;
    const result = await fsActions.copy(path, dest);
    if ('error' in result) toast.error(`Duplicate failed: ${result.error}`);
    else toast.success(`Duplicated to ${basename(dest)}`);
  }

  async function handleSubmitNew(name: string) {
    if (!newEntry) return;
    const path = `${newEntry.parent}/${name}`;
    const result = await fsActions.create(path, newEntry.kind);
    if ('error' in result) {
      toast.error(`Create failed: ${result.error}`);
      return;
    }
    toast.success(`Created ${name}`);
    setNewEntry(null);
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    const result = await fsActions.delete(deleting.path);
    if ('error' in result) {
      toast.error(`Delete failed: ${result.error}`);
      return;
    }
    toast.success(`Deleted ${basename(deleting.path)}`);
    setDeleting(null);
  }

  async function commitRename() {
    if (!renaming) return;
    const { path, value } = renaming;
    const newName = value.trim();
    setRenaming(null);
    if (!newName || newName === basename(path)) return;
    const slash = path.lastIndexOf('/');
    const parent = slash === -1 ? '' : path.slice(0, slash);
    const dest = parent ? `${parent}/${newName}` : newName;
    const result = await fsActions.rename(path, dest);
    if ('error' in result) toast.error(`Rename failed: ${result.error}`);
  }

  const getTree = useTree<EntryItem>({
    rootItemId: 'root',
    state: { loadingItemData, loadingItemChildrens },
    setLoadingItemData,
    setLoadingItemChildrens,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === 'directory',
    createLoadingItemData: () => ({ name: 'Loading...', path: '', kind: 'directory' }),
    dataLoader: {
      getItem: (itemId): EntryItem => {
        const kind = kindByPathRef.current.get(itemId) ?? 'directory';
        // Default 'directory' for unknowns (root, not-yet-visited) — once
        // a parent has been expanded we cache the actual kind so file
        // leaves stop lying about isItemFolder.
        if (kind === 'file') return { name: basename(itemId), path: itemId, kind: 'file', size: 0 };
        return { name: basename(itemId), path: itemId, kind: 'directory' };
      },
      getChildrenWithData: async (itemId) => {
        const path = itemId === 'root' ? rootCwd : itemId;
        const result = await browseEntries(path, { showHidden });
        if (itemId === 'root') setHasLoadedRoot(true);
        if ('error' in result) return [];
        for (const d of result.directories) kindByPathRef.current.set(d.path, 'directory');
        for (const f of result.files) kindByPathRef.current.set(f.path, 'file');
        const entries = sortEntriesDirsFirst([
          ...result.directories.map((d) => ({ ...d, kind: 'directory' as const })),
          ...result.files.map((f) => ({ ...f, kind: 'file' as const })),
        ]);
        return entries.map((entry) => ({ id: entry.path, data: entry }));
      },
    },
    features: [asyncDataLoaderFeature],
  });

  const tree = getTree();
  // `tree` is recreated every render by headless-tree; hold it in a ref
  // so the fs:dirty subscribe effect doesn't tear down + rebuild on each
  // render. The callback reads treeRef.current at event time.
  const treeRef = useRef(tree);
  treeRef.current = tree;

  // Fine-grained invalidation: subscribe to per-cwd fs:dirty events;
  // for each batch's relative path, derive parent dir's absolute path
  // and invalidate that tree node's children. Items not yet expanded
  // are skipped (the dataLoader fetches fresh on user expansion).
  useEffect(() => {
    if (!rootCwd) return;
    return subscribeFsDirty(rootCwd, (paths) => {
      const invalidated = new Set<string>();
      for (const relPath of paths) {
        const slash = relPath.lastIndexOf('/');
        const parentAbs = slash === -1 ? rootCwd : `${rootCwd}/${relPath.slice(0, slash)}`;
        const id = parentAbs === rootCwd ? 'root' : parentAbs;
        if (invalidated.has(id)) continue;
        invalidated.add(id);
        const item = treeRef.current.getItemInstance(id);
        if (!item) continue;
        void item.invalidateChildrenIds(true);
      }
    });
  }, [rootCwd, subscribeFsDirty]);

  return (
    <div {...tree.getContainerProps()} role="tree" className="relative">
      {!hasLoadedRoot && <SkeletonRows count={5} />}
      {tree.getItems().map((item) => {
        const data = item.getItemData();
        const isHighlighted = highlightedPath === data.path;
        const isFile = data.kind === 'file';
        const isDir = !isFile;
        const isDisabled = disabledPaths?.has(data.path) ?? false;
        const targetParent = targetDirFor(data.path, isDir);
        const renameForRow = renaming && renaming.path === data.path ? renaming : null;
        const row = (
          <FileTreeRow
            item={item}
            isHighlighted={isHighlighted}
            isDisabled={isDisabled}
            gitMark={isFile ? gitMarks?.get(data.path) : undefined}
            rename={
              renameForRow
                ? {
                    value: renameForRow.value,
                    onChange: (value) => setRenaming({ path: data.path, value }),
                    onSubmit: () => void commitRename(),
                    onCancel: () => setRenaming(null),
                  }
                : null
            }
            onClick={(e) => {
              if (isDisabled) {
                e.stopPropagation();
                return;
              }
              item.getProps().onClick?.(e);
              onHighlight?.(data.path);
              if (isFile && data.path) onActivate?.(data, e);
            }}
            onDoubleClick={() => {
              if (isDisabled) return;
              if (data.path) onSelect?.(data.path);
            }}
          />
        );
        return (
          <ContextMenu.Root key={item.getId()}>
            <ContextMenu.Trigger asChild>{row}</ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="z-modal bg-surface border border-border rounded shadow-floating py-1 min-w-44">
                {isFile && (
                  <ContextMenu.Item
                    onSelect={() => {
                      if (data.path) onSelect?.(data.path);
                    }}
                    className={ITEM_CLS}
                  >
                    Open in New Tab
                  </ContextMenu.Item>
                )}
                {isFile && <ContextMenu.Separator className="my-1 border-t border-border" />}
                <ContextMenu.Item
                  onSelect={() => setNewEntry({ parent: targetParent, kind: 'file' })}
                  className={ITEM_CLS}
                >
                  New file…
                </ContextMenu.Item>
                <ContextMenu.Item
                  onSelect={() => setNewEntry({ parent: targetParent, kind: 'directory' })}
                  className={ITEM_CLS}
                >
                  New folder…
                </ContextMenu.Item>
                <ContextMenu.Item
                  onSelect={() => setRenaming({ path: data.path, value: item.getItemName() })}
                  className={ITEM_CLS}
                >
                  Rename…
                </ContextMenu.Item>
                {isFile && (
                  <ContextMenu.Item
                    onSelect={() => void handleDuplicate(data.path)}
                    className={ITEM_CLS}
                  >
                    Duplicate
                  </ContextMenu.Item>
                )}
                <ContextMenu.Separator className="my-1 border-t border-border" />
                <ContextMenu.Item
                  onSelect={() => setDeleting({ path: data.path, descendantCount: 0 })}
                  className={DANGER_CLS}
                >
                  Delete
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        );
      })}
      {newEntry && (
        <NewEntryDialog
          open
          kind={newEntry.kind}
          parentLabel={newEntry.parent}
          onSubmit={handleSubmitNew}
          onClose={() => setNewEntry(null)}
        />
      )}
      {deleting && (
        <DeleteEntryConfirmDialog
          open
          name={basename(deleting.path)}
          descendantCount={deleting.descendantCount}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
