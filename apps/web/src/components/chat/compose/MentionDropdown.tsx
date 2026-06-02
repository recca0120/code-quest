import type { FsSearchResult } from '@code-quest/schemas';
import { HighlightText } from '@/components/chat/ui/HighlightText';
import { FileIcon, FolderIcon } from '@/components/icons/MentionIcons';
import { cn } from '@/utils/cn';
import { slugify } from '@/utils/slugify';

export type SearchStatus = 'idle' | 'loading' | 'done';

const noop = () => {};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'directory':
      return <FolderIcon className="w-5 h-5" />;
    default:
      return <FileIcon className="w-5 h-5" />;
  }
}

function mentionOptionId(index: number, path: string): string {
  return `mention-option-${index}-${slugify(path)}`;
}

function FileResultItem({
  file,
  index,
  selectedIndex,
  mentionQuery,
  onSelect,
  onHover,
  itemRef,
}: {
  file: FsSearchResult;
  index: number;
  selectedIndex: number;
  mentionQuery: string;
  onSelect: (path: string, navigateInto: boolean) => void;
  onHover: (index: number) => void;
  itemRef: React.Ref<HTMLDivElement> | null;
}) {
  const isActive = index === selectedIndex;
  const directoryPath =
    file.type === 'file' && file.path.length > file.name.length
      ? file.path.substring(0, file.path.length - file.name.length)
      : null;

  return (
    <div
      id={mentionOptionId(index, file.path)}
      ref={itemRef}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(`@${file.path}`, file.type === 'directory');
      }}
      onMouseEnter={() => onHover(index)}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 cursor-pointer rounded',
        isActive ? 'bg-selected text-selected-text' : 'hover:tint-5',
      )}
    >
      <div className="w-5 h-5 flex items-center justify-center text-muted opacity-60 shrink-0">
        <TypeIcon type={file.type} />
      </div>
      {file.type === 'file' ? (
        <>
          <span className="text-xs font-mono text-text truncate">
            <HighlightText
              text={file.name}
              query={mentionQuery}
              as="span"
              highlightClassName="text-accent font-semibold"
            />
          </span>
          {directoryPath && (
            <span className="text-xs font-mono text-muted truncate">{directoryPath}</span>
          )}
        </>
      ) : (
        <span className="text-xs font-mono text-text truncate">
          <HighlightText
            text={file.path}
            query={mentionQuery}
            as="span"
            highlightClassName="text-accent font-semibold"
          />
        </span>
      )}
    </div>
  );
}

function DropdownItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="w-full text-left px-3 py-1.5 text-xs text-text hover:tint-10 font-mono"
    >
      {label}
    </button>
  );
}

interface MentionDropdownProps {
  id?: string;
  mentionQuery: string;
  filteredSuggestions: string[];
  fileResults: FsSearchResult[];
  searchStatus: SearchStatus;
  selectedIndex: number;
  hasFileSearch: boolean;
  onSelectMention: (suggestion: string, navigateInto: boolean) => void;
  onHover?: (index: number) => void;
  activeItemRef?: React.Ref<HTMLDivElement>;
}

export function MentionDropdown({
  id,
  mentionQuery,
  filteredSuggestions,
  fileResults,
  searchStatus,
  selectedIndex,
  hasFileSearch,
  onSelectMention,
  onHover,
  activeItemRef,
}: MentionDropdownProps): React.JSX.Element {
  const activeId =
    hasFileSearch && selectedIndex >= 0 && fileResults[selectedIndex]
      ? mentionOptionId(selectedIndex, fileResults[selectedIndex].path)
      : undefined;

  return (
    <div
      id={id}
      role="listbox"
      tabIndex={-1}
      aria-label="mention-dropdown"
      aria-activedescendant={activeId}
      className="bg-surface border border-border rounded-lg shadow-floating overflow-hidden animate-fade-in-fast z-modal"
    >
      <div className="max-h-75 overflow-y-auto py-0.5">
        {hasFileSearch && searchStatus === 'loading' && (
          <div className="px-3 py-2 text-xs text-muted text-center">Searching…</div>
        )}
        {hasFileSearch && searchStatus === 'done' && fileResults.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted text-center">No files found</div>
        )}
        {!hasFileSearch &&
          filteredSuggestions.length > 0 &&
          filteredSuggestions.map((s) => (
            <DropdownItem key={s} label={s} onSelect={() => onSelectMention(s, false)} />
          ))}
        {hasFileSearch &&
          fileResults.length > 0 &&
          fileResults.map((f, i) => (
            <FileResultItem
              key={f.path}
              file={f}
              index={i}
              selectedIndex={selectedIndex}
              mentionQuery={mentionQuery}
              onSelect={onSelectMention}
              onHover={onHover ?? noop}
              itemRef={i === selectedIndex ? (activeItemRef ?? null) : null}
            />
          ))}
      </div>
    </div>
  );
}
