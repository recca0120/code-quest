import { ChevronRightIcon } from '@heroicons/react/24/outline';
import * as Collapsible from '@radix-ui/react-collapsible';

export function CollapsibleBlock({
  header,
  defaultOpen,
  open,
  onOpenChange,
  children,
}: {
  header: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Collapsible.Root
      {...(open !== undefined ? { open, onOpenChange } : { defaultOpen: defaultOpen ?? false })}
    >
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2 cursor-pointer select-none text-sm text-muted hover:text-text transition-colors"
        >
          {header}
          <ChevronRightIcon
            aria-hidden="true"
            className="w-4 h-4 opacity-50 transition-transform group-data-[state=open]:rotate-90"
          />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-2 pl-6">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
