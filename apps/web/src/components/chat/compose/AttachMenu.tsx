import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { FloatingCard } from '@/components/chat/ui/FloatingCard';
import { AddContextIcon } from '@/components/icons/MentionIcons';
import { IconButton } from '@/components/ui/IconButton';
import { PlusIcon } from '@/components/ui/Icons';

export function AttachMenu({
  onAttachFile,
  onMentionFile,
}: {
  onAttachFile?: () => void;
  onMentionFile?: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);

  if (!onAttachFile && !onMentionFile) return null;

  const items: Array<{
    id: string;
    label: string;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [];

  if (onAttachFile)
    items.push({
      id: 'upload',
      label: 'Upload from computer',
      title: 'Attach files from your computer',
      icon: <ArrowUpTrayIcon className="w-4 h-4" />,
      onClick: () => {
        onAttachFile();
        setOpen(false);
      },
    });

  if (onMentionFile)
    items.push({
      id: 'files',
      label: 'Add context',
      title: 'Add files or folders to the conversation',
      icon: <AddContextIcon className="w-4 h-4" />,
      onClick: () => {
        onMentionFile();
        setOpen(false);
      },
    });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <IconButton title="Add" className="shrink-0">
          <PlusIcon className="w-5 h-5" />
        </IconButton>
      </Popover.Trigger>
      {open && (
        <Popover.Content
          side="top"
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          className="z-modal"
        >
          <FloatingCard className="min-w-50 overflow-hidden px-0 py-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.title}
                onClick={item.onClick}
                className="w-full text-left px-3 py-2 text-xs text-text hover:tint-5 flex items-center gap-2"
              >
                <span className="w-4 h-4 flex items-center justify-center text-muted opacity-70">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </FloatingCard>
        </Popover.Content>
      )}
    </Popover.Root>
  );
}
