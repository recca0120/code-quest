import { toPermissionMode } from '@code-quest/schemas';
import { useRef } from 'react';
import { useChannelComposeActions, useChannelConfig, useChannelMessages } from '@/contexts/channel';
import { useChannelStore } from '@/stores/ChannelStoreContext';
import { cn } from '@/utils/cn';
import { ReviewUpsellBanner } from '../plan-review/ReviewUpsellBanner.tsx';
import { PendingActionButtons } from '../tool-use/PendingActionButtons.tsx';
import { ComposeInput } from './ComposeInput.tsx';
import { ComposeToolbar } from './ComposeToolbar.tsx';
import { type ModifiedFile, ModifiedFilesPanel } from './ModifiedFilesPanel.tsx';
import { SpeechInputContainer } from './SpeechInputContainer.tsx';

export function ChatInputArea(): React.JSX.Element {
  const { permissionMode } = useChannelConfig();
  const { focusTextarea, addAttachments, insertSlashCommand } = useChannelComposeActions();
  const modifiedFiles = useChannelStore((s) => s.modifiedFiles);
  const { removeModifiedFile } = useChannelMessages();

  const modifiedFileEntries = Object.entries(modifiedFiles);
  const modifiedFileList: ModifiedFile[] = modifiedFileEntries.map(([path, entry]) => ({
    path,
    status: !entry.oldContent ? 'added' : !entry.newContent ? 'deleted' : 'modified',
    oldContent: entry.oldContent ?? undefined,
    newContent: entry.newContent ?? undefined,
  }));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) addAttachments(files);
          e.target.value = '';
        }}
      />
      <PendingActionButtons />
      <ReviewUpsellBanner />
      <div
        ref={containerRef}
        data-mode={toPermissionMode(permissionMode)}
        className={cn(
          'rounded-xl bg-surface border border-(--color-composer-border) transition-all relative shadow-sm',
          'focus-within:border-mode-accent',
          'focus-within:shadow-[0_1px_2px_rgba(var(--color-mode-accent-rgb),var(--mode-shadow-alpha,0))]',
        )}
        onClick={focusTextarea}
        role="none"
      >
        <ComposeInput containerRef={containerRef} />
        <SpeechInputContainer
          onFinal={insertSlashCommand}
          className="absolute top-2 right-2 z-raised"
        />
        <ComposeToolbar containerRef={containerRef} onAttachFile={openFilePicker} />
      </div>
      {modifiedFileEntries.length > 0 && (
        <ModifiedFilesPanel files={modifiedFileList} onAccept={removeModifiedFile} />
      )}
    </>
  );
}
