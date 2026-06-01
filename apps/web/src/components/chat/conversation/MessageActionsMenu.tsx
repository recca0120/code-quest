import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FloatingCard } from '@/components/chat/ui/FloatingCard';
import { MenuItem } from '@/components/ui/MenuItem';

interface MessageActionItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface MessageActionsMenuProps {
  items: ReadonlyArray<MessageActionItem | false | '' | null | undefined>;
}

export function MessageActionsMenu({ items }: MessageActionsMenuProps): React.JSX.Element {
  const visible = items.filter((i): i is MessageActionItem => Boolean(i));

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Message actions"
          title="Message actions"
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-full border border-border text-muted hover:text-text hover:bg-hover-tint transition-opacity cursor-pointer"
        >
          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={8} className="z-popover">
          <FloatingCard className="min-w-50 flex flex-col px-0 py-1">
            {visible.map((item) => (
              <MenuItem
                key={item.label}
                as={DropdownMenu.Item}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className="text-xs data-[disabled]:opacity-50 transition-colors"
              >
                {item.label}
              </MenuItem>
            ))}
          </FloatingCard>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
