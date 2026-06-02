import type { ModelInfo } from '@code-quest/schemas';
import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { getModelDisplayInfo, getModelInfoDisplayName } from '@/utils/model-utils';

const optionButtonClass = (isSelected: boolean) =>
  cn(
    'w-full text-left mx-1 px-2 py-1 flex items-center justify-between transition-colors rounded-sm',
    isSelected ? 'bg-selected' : 'hover:tint-10',
    'focus:bg-selected focus:outline-none',
  );

interface ModelPickerPopoverProps {
  currentModel: string | null;
  availableModels: ModelInfo[];
  onSwitch: (model: string) => void;
  defaultModelDescription?: string;
}

function ModelOptionButton({
  displayName,
  subLabel,
  isSelected,
  onSelect,
}: {
  displayName: string;
  subLabel: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      onClick={onSelect}
      className={optionButtonClass(isSelected)}
    >
      <div>
        <div className="text-text font-medium">{displayName}</div>
        <div className="text-muted text-xs mt-0.5 opacity-70">{subLabel}</div>
      </div>
      {isSelected && <span className="text-muted shrink-0 ml-3">✓</span>}
    </button>
  );
}

export function ModelPickerPopover({
  currentModel,
  availableModels,
  onSwitch,
  defaultModelDescription,
}: ModelPickerPopoverProps): React.JSX.Element {
  const defaultModelValue = availableModels[0]?.value ?? null;
  const hasDefaultEntry = availableModels.some(
    (m) => m.value === 'default' || m.displayName === 'Default (recommended)',
  );

  const defaultDisplay = !hasDefaultEntry
    ? getModelDisplayInfo('', availableModels, defaultModelDescription)
    : null;

  const listboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = listboxRef.current?.querySelector<HTMLElement>(
      '[role="option"][aria-selected="true"]',
    );
    (selected ?? listboxRef.current)?.focus();
  }, []);

  const getOptions = () =>
    Array.from(listboxRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

  const handleSelect = (value: string) => {
    onSwitch(value === '' ? (defaultModelValue ?? '') : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const options = getOptions();
    const focusedIndex = options.indexOf(document.activeElement as HTMLElement);
    const selectedIndex = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
    const currentIndex = focusedIndex >= 0 ? focusedIndex : selectedIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      options[Math.min(currentIndex + 1, options.length - 1)]?.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      options[Math.max(currentIndex - 1, 0)]?.focus();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const focused = document.activeElement as HTMLElement;
      if (options.includes(focused)) focused.click();
      return;
    }
  };

  return (
    <div
      ref={listboxRef}
      role="listbox"
      tabIndex={0}
      className="bg-surface border border-border rounded shadow-floating overflow-hidden text-xs animate-fade-in-fast max-h-75 overflow-y-auto pb-2 focus:outline-none"
      onKeyDown={handleKeyDown}
    >
      {defaultDisplay && (
        <ModelOptionButton
          displayName={defaultDisplay.displayName}
          subLabel={defaultDisplay.subLabel}
          isSelected={currentModel === defaultModelValue}
          onSelect={() => handleSelect('')}
        />
      )}
      {availableModels.map((item) => {
        const { displayName, subLabel } = getModelInfoDisplayName(
          item,
          item.value,
          availableModels,
        );
        return (
          <ModelOptionButton
            key={item.value}
            displayName={displayName}
            subLabel={subLabel}
            isSelected={currentModel === item.value}
            onSelect={() => handleSelect(item.value)}
          />
        );
      })}
    </div>
  );
}
