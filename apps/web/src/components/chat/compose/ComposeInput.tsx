import type { FsSearchResult } from '@code-quest/schemas';
import * as Popover from '@radix-ui/react-popover';

import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { slashPaletteState } from '@/components/chat/compose/command-menu/slash-palette-state';
import { ImagePreviewModal } from '@/components/chat/ui/ImagePreviewModal';
import { useChannelCompose, useChannelConfig, useChannelMessages } from '@/contexts/channel';
import { selectIsActive, useChannelStore } from '@/stores/ChannelStoreContext';
import { cn } from '@/utils/cn';
import { getMentionQuery, MENTION_REGEX } from '@/utils/slash-query';
import { sortEntriesDirsFirst } from '@/utils/sort-entries';
import { MentionDropdown, type SearchStatus } from './MentionDropdown.tsx';

const DEFAULT_PERMISSION_MODES = ['normal', 'acceptEdits', 'plan', 'bypassPermissions'];

function FileAttachmentChip({
  file,
  objectUrl,
  index,
  onRemove,
  onPreview,
}: {
  file: File;
  objectUrl: string;
  index: number;
  onRemove: (index: number) => void;
  onPreview: (src: string, alt: string) => void;
}) {
  if (file.type.startsWith('image/')) {
    return (
      <div className="relative shrink-0 group">
        <button
          type="button"
          className="block"
          onClick={() => onPreview(objectUrl, file.name)}
          aria-label={`Preview ${file.name}`}
        >
          <img
            src={objectUrl}
            alt={file.name}
            className="h-12 w-12 object-cover rounded-md border border-border cursor-pointer"
          />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -top-1 -right-1 bg-surface border border-border rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 leading-none"
          aria-label={`Remove ${file.name}`}
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <div className="bg-code-block border border-border rounded-md flex items-center gap-1.5 px-2.5 py-1.5 text-xs shrink-0">
      <span className="max-w-40 truncate">📄 {file.name}</span>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="text-muted hover:text-text leading-none"
        aria-label={`Remove ${file.name}`}
      >
        ✕
      </button>
    </div>
  );
}

type InputHistory = { history: string[]; index: number; draft: string };

function historyCycleUp(ref: InputHistory, currentValue: string): string | null {
  if (ref.history.length === 0) return null;
  if (ref.index === -1) {
    ref.draft = currentValue;
    ref.index = ref.history.length - 1;
  } else if (ref.index > 0) {
    ref.index--;
  }
  return ref.history[ref.index] ?? null;
}

function historyCycleDown(ref: InputHistory): string {
  if (ref.index === -1) return '';
  if (ref.index < ref.history.length - 1) {
    ref.index++;
    return ref.history[ref.index] ?? '';
  }
  ref.index = -1;
  return ref.draft;
}

const TEXTAREA_BASE_CLASS =
  'w-full bg-transparent text-text pl-3.5 py-2.5 resize-none focus:outline-none disabled:opacity-50 placeholder:text-muted overflow-hidden [grid-area:1/1]';

function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

const MENTION_LISTBOX_ID = 'mention-dropdown-listbox';
const MENTION_DEBOUNCE_MS = 200;

function scrollActiveIntoView(el: HTMLDivElement | null) {
  el?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
}

export function ComposeInput({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}): React.JSX.Element {
  const hasMicButton = isSpeechSupported();
  const textareaClass = cn(TEXTAREA_BASE_CLASS, hasMicButton ? 'pr-10' : 'pr-3.5');
  const isProcessing = useChannelStore(selectIsActive);
  const historyMessages = useChannelStore((s) => s.historyMessages);
  const { searchFiles } = useChannelMessages();
  const { providerConfig, permissionMode, setPermissionMode } = useChannelConfig();
  const compose = useChannelCompose();

  const {
    value,
    updateValue,
    cursorPos,
    setCursorPos,
    registerFocus,
    registerMentionTrigger,
    slashOpen,
    mentionOpen,
    openMention,
    closeMention,
    dismissSlash,
    submit,
    attachedFiles,
    addAttachments,
    removeAttachment,
  } = compose;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    registerFocus((pos?: number) => {
      const el = textareaRef.current;
      if (!el) return;
      setTimeout(() => {
        el.focus();
        if (pos !== undefined) el.setSelectionRange(pos, pos);
      }, 0);
    });
  }, [registerFocus]);

  const historyRef = useRef<InputHistory>({ history: [], index: -1, draft: '' });

  useEffect(() => {
    historyRef.current.history = historyMessages ?? [];
  }, [historyMessages]);

  const [previewSrc, setPreviewSrc] = useState<{ src: string; alt: string } | null>(null);
  const [fileResults, setFileResults] = useState<FsSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');

  const mentionQuery = mentionOpen ? getMentionQuery(value, cursorPos) : null;

  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    setSearchStatus('loading');
    const result = await searchFiles(query);
    const files = result.ok ? result.data.files : [];
    setFileResults(sortEntriesDirsFirst(files));
    setSearchStatus('done');
  }, MENTION_DEBOUNCE_MS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedSearch is stable (useDebouncedCallback)
  useEffect(() => {
    registerMentionTrigger((value: string, pos: number) => {
      const query = getMentionQuery(value, pos);
      if (query !== null) {
        setSelectedIndex(-1);
        setSearchStatus('loading');
        debouncedSearch(query);
      }
    });
  }, [registerMentionTrigger]);

  const handleChange = (newValue: string) => {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? newValue.length;
    updateValue(newValue, pos);

    const query = getMentionQuery(newValue, pos);
    if (query !== null) {
      openMention();
      setSelectedIndex(-1);
      debouncedSearch(query);
    } else {
      handleCloseMention();
      setFileResults([]);
    }
  };

  const handleSelectMention = (suggestion: string, navigateInto: boolean) => {
    const pos = cursorPos;
    const before = value.slice(0, pos);
    const match = before.match(MENTION_REGEX);
    if (!match) return;

    const start = before.length - match[0].length + (match[1] ? 1 : 0);

    if (navigateInto) {
      const newValue = `${value.slice(0, start)}${suggestion}${value.slice(pos)}`;
      const newCursorPos = start + suggestion.length;
      updateValue(newValue, newCursorPos);
      setSelectedIndex(0);
      const newQuery = getMentionQuery(newValue, newCursorPos);
      if (newQuery !== null) {
        debouncedSearch(newQuery);
      }
      textareaRef.current?.focus();
      return;
    }

    const newValue = `${value.slice(0, start)}${suggestion} ${value.slice(pos)}`;
    updateValue(newValue);
    handleCloseMention();
    setFileResults([]);
    setSearchStatus('idle');
    textareaRef.current?.focus();
  };

  const syncCursorPos = () => {
    const el = textareaRef.current;
    if (el) setCursorPos(el.selectionStart);
  };

  function handleCloseMention() {
    closeMention();
    setFileResults([]);
  }

  function handlePermissionCycleShortcut(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (e.key !== 'Tab' || !e.shiftKey || slashOpen || mentionOpen) return false;
    e.preventDefault();
    const configModes = providerConfig?.permissionModes;
    const modeIds = configModes?.length ? configModes.map((m) => m.id) : DEFAULT_PERMISSION_MODES;
    const currentIndex = modeIds.indexOf(permissionMode ?? 'normal');
    setPermissionMode(modeIds[(currentIndex + 1) % modeIds.length] ?? 'normal');
    return true;
  }

  function handleSlashKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismissSlash();
      return true;
    }
    // Enter only belongs to the palette when it has something to select —
    // otherwise it must fall through so `/unknown` can reach the CLI.
    if (e.key === 'Enter') {
      if (slashPaletteState.itemsCount === 0) return false;
      e.preventDefault();
      return true;
    }
    if (['Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      return true;
    }
    return false;
  }

  function handleMentionKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCloseMention();
      return true;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => {
        const len = fileResults.length;
        if (len === 0) return i;
        if (e.key === 'ArrowDown') return i >= len - 1 ? 0 : i + 1;
        return i <= 0 ? len - 1 : i - 1;
      });
      return true;
    }
    if (e.key === 'Tab' && selectedIndex >= 0) {
      e.preventDefault();
      const item = fileResults[selectedIndex];
      if (item) handleSelectMention(`@${item.path}`, item.type === 'directory');
      return true;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (selectedIndex >= 0) {
        e.preventDefault();
        const item = fileResults[selectedIndex];
        if (item) handleSelectMention(`@${item.path}`, false);
      } else {
        handleCloseMention();
      }
      return true;
    }
    return false;
  }

  function handleHistoryKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (e.key === 'ArrowUp') {
      const el = textareaRef.current;
      const firstNewline = value.indexOf('\n');
      const cursorOnFirstLine = !el || firstNewline === -1 || el.selectionStart <= firstNewline;
      if (!cursorOnFirstLine) return false;
      const msg = historyCycleUp(historyRef.current, value);
      if (msg !== null) {
        e.preventDefault();
        updateValue(msg);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = 0;
            textareaRef.current.selectionEnd = 0;
          }
        });
      }
      return true;
    }
    if (e.key === 'ArrowDown' && historyRef.current.index !== -1) {
      e.preventDefault();
      updateValue(historyCycleDown(historyRef.current));
      return true;
    }
    return false;
  }

  function handleSubmitKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    historyRef.current.index = -1;
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (handlePermissionCycleShortcut(e)) return;
    if (slashOpen && handleSlashKeyDown(e)) return;
    if (mentionOpen && handleMentionKeyDown(e)) return;
    if (handleHistoryKeyDown(e)) return;
    handleSubmitKeyDown(e);
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>): void {
    const images: File[] = [];
    for (const item of e.clipboardData.items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    }
    if (images.length === 0) return;
    e.preventDefault();
    addAttachments(images);
  }

  const hasFileResults = fileResults.length > 0 || searchStatus !== 'idle';
  const showMentionDropdown = mentionOpen && hasFileResults;

  return (
    <>
      <Popover.Root open={showMentionDropdown}>
        <Popover.Anchor virtualRef={containerRef as React.RefObject<Element>} />
        {attachedFiles.length > 0 && (
          <div className="flex overflow-x-auto gap-1 px-2 pb-1 pt-2">
            {attachedFiles.map(({ id, file, objectUrl }, index) => (
              <FileAttachmentChip
                key={id}
                file={file}
                objectUrl={objectUrl}
                index={index}
                onRemove={removeAttachment}
                onPreview={(src, alt) => setPreviewSrc({ src, alt })}
              />
            ))}
          </div>
        )}
        <div
          className="grid max-h-50 overflow-y-auto"
          role="combobox"
          tabIndex={-1}
          aria-haspopup="listbox"
          aria-expanded={showMentionDropdown}
          aria-controls={showMentionDropdown ? MENTION_LISTBOX_ID : undefined}
          aria-autocomplete="list"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSelect={syncCursorPos}
            onClick={syncCursorPos}
            placeholder={
              isProcessing
                ? 'Queue another message…'
                : (providerConfig?.brand.placeholder ?? '⌘ Esc to focus or unfocus Claude')
            }
            className={textareaClass}
          />
          <div className={cn(textareaClass, 'invisible whitespace-pre-wrap')} aria-hidden="true">
            {`${value}\n`}
          </div>
        </div>
        {showMentionDropdown && (
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            avoidCollisions={false}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={() => {
              handleCloseMention();
              setFileResults([]);
            }}
            onFocusOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            style={{ width: 'var(--radix-popper-anchor-width)' }}
          >
            <MentionDropdown
              id={MENTION_LISTBOX_ID}
              mentionQuery={mentionQuery ?? ''}
              filteredSuggestions={[]}
              fileResults={fileResults}
              searchStatus={searchStatus}
              selectedIndex={selectedIndex}
              hasFileSearch={true}
              onSelectMention={handleSelectMention}
              onHover={setSelectedIndex}
              activeItemRef={scrollActiveIntoView}
            />
          </Popover.Content>
        )}
      </Popover.Root>
      {previewSrc && (
        <ImagePreviewModal
          src={previewSrc.src}
          alt={previewSrc.alt}
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </>
  );
}
