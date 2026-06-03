import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import {
  menuContentClass as MENU_CONTENT_CLASS,
  type MenuItem,
  renderMenuItems,
} from '../ui/MenuContent.tsx';

interface WorktreeMenuCallbacks {
  onOpenHere?: () => void;
  onOpenInNewChat: () => void;
  onOpenPastSession?: () => void;
  onSwitchBranch?: () => void;
  onCopyPath: () => void;
  onRename?: () => void;
  onArchive?: () => void;
  onDelete: () => void;
}

function buildItems(cb: WorktreeMenuCallbacks): MenuItem[] {
  const items: MenuItem[] = [];
  if (cb.onOpenHere) items.push({ key: 'open', label: 'Open here', onSelect: cb.onOpenHere });
  items.push({ key: 'new-chat', label: 'Open in new chat', onSelect: cb.onOpenInNewChat });
  if (cb.onOpenPastSession)
    items.push({
      key: 'past-session',
      label: 'Open past session…',
      onSelect: cb.onOpenPastSession,
    });
  if (cb.onSwitchBranch)
    items.push({ key: 'switch-branch', label: 'Switch branch…', onSelect: cb.onSwitchBranch });
  items.push({ key: 'copy', label: 'Copy path', onSelect: cb.onCopyPath });
  if (cb.onRename) items.push({ key: 'rename', label: 'Rename…', onSelect: cb.onRename });
  if (cb.onArchive) items.push({ key: 'archive', label: 'Archive', onSelect: cb.onArchive });
  items.push({
    key: 'delete',
    label: 'Delete',
    onSelect: cb.onDelete,
    danger: true,
    separatorBefore: true,
  });
  return items;
}

interface DropdownProps extends WorktreeMenuCallbacks {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function WorktreeDropdownMenu({
  trigger,
  open,
  onOpenChange,
  defaultOpen,
  ...callbacks
}: DropdownProps): React.JSX.Element {
  const items = buildItems(callbacks);
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
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

interface ContextProps extends WorktreeMenuCallbacks {
  children: ReactNode;
}

export function WorktreeContextMenu({ children, ...callbacks }: ContextProps): React.JSX.Element {
  const items = buildItems(callbacks);
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
