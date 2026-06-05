import type { ComponentType, ReactNode } from 'react';
import { dangerMenuItemClass, menuItemClass } from './MenuItem.tsx';

export const menuContentClass =
  'z-modal min-w-45 rounded border border-border bg-surface shadow-floating py-1';

export type MenuItem = {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
};

type ItemProps = { onSelect: () => void; className: string; children: ReactNode };
type SeparatorProps = { className: string };

export function renderMenuItems(
  items: MenuItem[],
  Item: ComponentType<ItemProps>,
  Separator: ComponentType<SeparatorProps>,
): React.JSX.Element[] {
  return items.map((item) => (
    <div key={item.key}>
      {item.separatorBefore && <Separator className="my-1 border-t border-border" />}
      <Item onSelect={item.onSelect} className={item.danger ? dangerMenuItemClass : menuItemClass}>
        {item.label}
      </Item>
    </div>
  ));
}
