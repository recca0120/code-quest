/** Effort level slider matching extension's toggle UI.
 *  Pill track with fill, notch dots, and a thumb handle.
 *
 *  NOT migrated to `@radix-ui/react-slider` — the original visual contract
 *  (thumb edges align flush with pill edges via `(100% - thumbWidth) * ratio`,
 *  fill bar always present including the under-thumb pill at value=0) doesn't
 *  fit Radix Slider's center-aligned thumb / 0-width-Range-at-min model.
 *  We trade the Radix-supplied keyboard/click behavior for visual fidelity;
 *  hand-rolled handlers below cover Arrow keys + click-to-position. */

import { cn } from '@/utils/cn';
import { focusRing } from './_tokens.ts';

const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

export function effortLabel(level?: string): string {
  return level ? (EFFORT_LABELS[level] ?? level) : 'Auto';
}

interface EffortSwitchProps {
  level?: string;
  levels: string[];
  onSelect?: (level: string) => void;
}

// Thumb size in CSS terms — matches `w-3.5 h-3.5` so it scales with both the
// density axis (via --spacing) and the font-size axis (via rem). Layout is
// fully container-relative so the track width can be anything.
const THUMB_CSS = 'calc(var(--spacing) * 3.5)';

function pct(idx: number, count: number) {
  return count > 1 ? idx / (count - 1) : 0;
}

export function EffortSwitch({ level, levels, onSelect }: EffortSwitchProps): React.JSX.Element {
  const idx = level ? levels.indexOf(level) : 0;
  const count = levels.length;
  const ratio = pct(idx, count);

  const travel = `(100% - ${THUMB_CSS})`;
  const thumbLeft = `calc(${travel} * ${ratio})`;
  const fillWidth = `calc(${travel} * ${ratio} + ${THUMB_CSS})`;
  const notchLeft = (i: number) => `calc(${travel} * ${pct(i, count)} + ${THUMB_CSS} / 2)`;

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!onSelect) return;
    e.stopPropagation();
    if (e.detail === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextLevel = levels[Math.round(x * (count - 1))];
    if (nextLevel) onSelect(nextLevel);
  };

  const ticksAfterThumb = Array.from({ length: count - idx - 1 }, (_, k) => idx + 1 + k);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-valuenow={idx}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-label="Effort level"
      aria-disabled={!onSelect || undefined}
      className={cn('relative w-19 h-5 rounded-full shrink-0 cursor-pointer', focusRing)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (!onSelect) return;
        let next = idx;
        if (e.key === 'ArrowRight') next = Math.min(count - 1, idx + 1);
        else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = count - 1;
        else return;
        e.preventDefault();
        const nextLevel = levels[next];
        if (next !== idx && nextLevel) onSelect(nextLevel);
      }}
      title="Click a position to set effort level"
    >
      <div
        role="presentation"
        aria-label="effort-switch-track"
        // Visible pill rides at the same h-3.5 as thumb + fill so the
        // three read as a single coherent slim slider; the outer wrapper
        // (h-5) supplies the larger click hit area + focus ring slot.
        className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-3.5 rounded-full bg-surface-hover overflow-hidden"
      >
        <div
          role="presentation"
          aria-label="effort-switch-fill"
          className="absolute top-0 left-0 h-full rounded-full bg-accent transition-all duration-150"
          style={{ width: fillWidth }}
        />
        {ticksAfterThumb.map((i) => (
          <div
            key={levels[i]}
            role="presentation"
            aria-label="effort-switch-tick"
            className={cn(
              'absolute top-1/2 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1/2',
              'bg-text/35',
            )}
            style={{ left: notchLeft(i) }}
          />
        ))}
        <div
          role="presentation"
          aria-label="effort-switch-thumb"
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full',
            'bg-white shadow-sm ring-1 ring-border/20', // bg-white: 設計意圖，不改
            'transition-all duration-150',
          )}
          style={{ left: thumbLeft }}
        />
      </div>
    </div>
  );
}
