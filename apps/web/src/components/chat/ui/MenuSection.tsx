import type { RefObject } from 'react';
import type { MenuItem } from '@/components/chat/compose/command-menu/menu-types.ts';
import { cn } from '@/utils/cn';

function MenuItemRow({
  item,
  isActive,
  activeItemRef,
  onHover,
  onSelect,
}: {
  item: MenuItem;
  isActive: boolean;
  activeItemRef: RefObject<HTMLButtonElement | null>;
  onHover: (id: string) => void;
  onSelect: (item: MenuItem) => void;
}): React.ReactNode {
  return (
    <button
      ref={isActive ? activeItemRef : null}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(item.id)}
      className={cn(
        'text-left px-3 py-1 w-full flex items-center justify-between disabled:text-muted disabled:cursor-not-allowed',
        isActive ? 'bg-selected text-selected-text' : 'text-text hover:tint-10',
      )}
    >
      <span className="flex items-center gap-1.5">
        {item.label}
        {item.description && (
          <span className="font-mono text-xs text-muted">{item.description}</span>
        )}
      </span>
      {item.trailing && <span>{item.trailing}</span>}
    </button>
  );
}

export function MenuSection({
  label,
  items,
  activeId,
  activeItemRef,
  onHover,
  onSelect,
  isFirst = false,
}: {
  label: string;
  items: MenuItem[];
  activeId: string | null;
  activeItemRef: RefObject<HTMLButtonElement | null>;
  onHover: (id: string) => void;
  onSelect: (item: MenuItem) => void;
  isFirst?: boolean;
}): React.ReactNode {
  if (items.length === 0) return null;
  return (
    <>
      {!isFirst && <div className="h-px bg-border my-1" />}
      {/* biome-ignore lint/a11y/useSemanticElements: role=group on div is correct; fieldset has unwanted browser styling */}
      <div role="group" aria-label={label}>
        <div className="px-3 py-1 text-sm opacity-50 text-text" aria-hidden="true">
          {label}
        </div>
        {items.map((item) => (
          <MenuItemRow
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            activeItemRef={activeItemRef}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}
