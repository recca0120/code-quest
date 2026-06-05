import type { WorktreeInfo } from '@code-quest/git';
import { BottomSheet, BottomSheetItem } from '../ui/BottomSheet.tsx';
import { buildWorktreeMenuItems, type WorktreeMenuCallbacks } from './WorktreeContextMenu.tsx';

interface WorktreeBottomSheetProps extends WorktreeMenuCallbacks {
  wt: WorktreeInfo;
  onClose: () => void;
}

export function WorktreeBottomSheet({
  wt,
  onClose,
  ...callbacks
}: WorktreeBottomSheetProps): React.JSX.Element {
  const items = buildWorktreeMenuItems(callbacks);
  return (
    <BottomSheet open title={wt.branch ?? wt.name} onClose={onClose}>
      {items.map((item) => (
        <BottomSheetItem
          key={item.key}
          variant={item.danger ? 'destructive' : 'default'}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </BottomSheetItem>
      ))}
    </BottomSheet>
  );
}
