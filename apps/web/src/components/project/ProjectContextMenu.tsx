import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { type ReactNode, useContext } from 'react';
import { AppInitStateContext } from '@/contexts/AppInitContext';
import {
  menuContentClass as MENU_CONTENT_CLASS,
  type MenuItem,
  renderMenuItems,
} from '../ui/MenuContent.tsx';

export interface ProjectMenuCallbacks {
  onSelectResume: () => void;
  onSelectCreateWorktree?: () => void;
  onSelectRename?: () => void;
  onSelectRemove?: () => void;
  onSelectInitRepo?: () => void;
  onCopyPath?: () => void;
}

export function buildProjectMenuItems(
  callbacks: ProjectMenuCallbacks,
  capabilities: { worktree: boolean },
): MenuItem[] {
  const items: MenuItem[] = [
    { key: 'resume', label: 'Open past session…', onSelect: callbacks.onSelectResume },
  ];
  if (capabilities.worktree && callbacks.onSelectCreateWorktree)
    items.push({
      key: 'worktree',
      label: 'Create Worktree…',
      onSelect: callbacks.onSelectCreateWorktree,
    });
  if (callbacks.onSelectInitRepo)
    items.push({
      key: 'init',
      label: 'Initialize as git repo',
      onSelect: callbacks.onSelectInitRepo,
    });
  if (callbacks.onCopyPath)
    items.push({ key: 'copy-path', label: 'Copy path', onSelect: callbacks.onCopyPath });
  if (callbacks.onSelectRename)
    items.push({ key: 'rename', label: 'Rename…', onSelect: callbacks.onSelectRename });
  if (callbacks.onSelectRemove)
    items.push({
      key: 'remove',
      label: 'Remove…',
      onSelect: callbacks.onSelectRemove,
      danger: true,
      separatorBefore: true,
    });
  return items;
}

function useItemList(callbacks: ProjectMenuCallbacks): MenuItem[] {
  const capabilities = useContext(AppInitStateContext)?.capabilities ?? { worktree: false };
  return buildProjectMenuItems(callbacks, capabilities);
}

interface DropdownProps extends ProjectMenuCallbacks {
  trigger: ReactNode;
}

export function ProjectDropdownMenu({ trigger, ...callbacks }: DropdownProps): React.JSX.Element {
  const items = useItemList(callbacks);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className={MENU_CONTENT_CLASS}
        >
          {renderMenuItems(items, DropdownMenu.Item, DropdownMenu.Separator)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface ContextProps extends ProjectMenuCallbacks {
  children: ReactNode;
  /** Disable the right-click menu (e.g. when no cwd available). */
  disabled?: boolean;
}

export function ProjectContextMenu({
  children,
  disabled,
  ...callbacks
}: ContextProps): React.JSX.Element {
  const items = useItemList(callbacks);
  if (disabled) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={MENU_CONTENT_CLASS}>
          {renderMenuItems(items, ContextMenu.Item, ContextMenu.Separator)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
