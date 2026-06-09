import type { SessionSummary } from '@code-quest/schemas';
import { ClockIcon } from '@heroicons/react/24/outline';
import * as Popover from '@radix-ui/react-popover';
import { useSyncExternalStore } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { useChannelId } from '@/contexts/channel';
import { useProjectState } from '@/contexts/ProjectContext';
import { resumeOpenSignal } from '@/features/resume/resume-feature';
import { SessionHistoryPopover } from './session/SessionHistoryPopover.tsx';

interface ResumeButtonProps {
  onResumed: (spawnedId: string, picked: SessionSummary) => void;
}

export function ResumeButton({ onResumed }: ResumeButtonProps): React.JSX.Element {
  const { activeProjectCwd } = useProjectState();
  const channelId = useChannelId();

  const resumeIsOpen = useSyncExternalStore(
    (cb) => resumeOpenSignal.subscribe(cb),
    () => resumeOpenSignal.isOpenFor(channelId),
  );

  return (
    <Popover.Root
      open={resumeIsOpen}
      onOpenChange={(open) => resumeOpenSignal.setOpen(open, channelId)}
    >
      <Popover.Trigger asChild>
        <IconButton
          title="Session history"
          aria-label="Session history"
          className="text-muted hover:text-text"
        >
          <ClockIcon className="w-4 h-4" aria-hidden="true" />
        </IconButton>
      </Popover.Trigger>
      <SessionHistoryPopover
        cwd={activeProjectCwd ?? undefined}
        onClose={() => resumeOpenSignal.setOpen(false, null)}
        onResumed={onResumed}
        side="bottom"
        align="end"
      />
    </Popover.Root>
  );
}
