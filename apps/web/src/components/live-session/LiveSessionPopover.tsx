import type { SessionStateSummary } from '@code-quest/schemas';
import * as Popover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { basename } from '@/utils/basename';
import { Button } from '../ui/Button.tsx';

export interface LiveSessionPopoverProps {
  session: SessionStateSummary;
  /** Element that opens the popover. Wrapped in `Popover.Trigger asChild`. */
  trigger?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpen: (channelId: string) => void;
  onStop: (channelId: string) => void;
  onSplit: (channelId: string) => void;
}

export function LiveSessionPopover({
  session,
  trigger,
  defaultOpen,
  open,
  onOpenChange,
  onOpen,
  onStop,
  onSplit,
}: LiveSessionPopoverProps): React.JSX.Element {
  const projectLabel = basename(session.projectRoot);
  const cwdLabel =
    session.cwd && session.cwd !== session.projectRoot ? `/${basename(session.cwd)}` : '';

  return (
    <Popover.Root defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
      {trigger && <Popover.Trigger asChild>{trigger}</Popover.Trigger>}
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-modal min-w-64 rounded border border-border bg-surface shadow-floating p-3 text-sm flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              {projectLabel}
              {cwdLabel}
            </span>
            <span className="ml-auto text-xs uppercase tracking-wide text-dim">
              {session.state}
            </span>
          </div>
          {session.title && <div className="text-xs text-muted truncate">{session.title}</div>}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Popover.Close asChild>
              <Button size="xs" variant="primary" onClick={() => onOpen(session.channelId)}>
                Open
              </Button>
            </Popover.Close>
            <Popover.Close asChild>
              <Button size="xs" variant="secondary" onClick={() => onSplit(session.channelId)}>
                Split
              </Button>
            </Popover.Close>
            {session.state === 'busy' && (
              <Popover.Close asChild>
                <Button
                  size="xs"
                  variant="danger"
                  className="ml-auto"
                  onClick={() => onStop(session.channelId)}
                >
                  Stop
                </Button>
              </Popover.Close>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
