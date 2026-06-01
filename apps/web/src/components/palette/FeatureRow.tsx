import { useState } from 'react';
import { deriveGroupAggregate } from '@/lib/derive-group-aggregate';
import type { Feature } from '@/lib/feature';
import { cn } from '@/utils/cn';
import { TOGGLE_PILL_BASE, togglePillColor, togglePillSymbol } from '../ui/TriStateIndicator.tsx';
import { toPaletteCommand } from './to-palette-command.tsx';

interface FeatureRowProps {
  feature: Feature;
  isActive: boolean;
  onActiveChange?: (id: string | null) => void;
  onExecute?: (feature: Feature) => void;
}

function FlatRow({ feature, isActive, onActiveChange, onExecute }: FeatureRowProps) {
  const cmd = toPaletteCommand(feature);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onMouseEnter is hover-tracking only; keyboard interaction is provided by the inner <button>
    <div
      onMouseEnter={() => onActiveChange?.(feature.id)}
      className={cn(
        'flex items-center justify-between gap-3 w-full px-4 py-2 transition-[background] duration-100',
        isActive
          ? 'bg-row-active-bg border-l-2 border-l-accent'
          : 'bg-transparent border-l-2 border-l-transparent',
      )}
    >
      <button
        type="button"
        data-active={isActive || undefined}
        onClick={() => (onExecute ? onExecute(feature) : feature.execute())}
        disabled={feature.disabled}
        className={cn(
          'flex-1 bg-transparent border-none text-left p-0',
          'text-sm text-text overflow-hidden text-ellipsis whitespace-nowrap',
          feature.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        {cmd.label}
      </button>
      {cmd.trailing && (
        // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops propagation
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {cmd.trailing}
        </span>
      )}
    </div>
  );
}

type GroupState = Extract<NonNullable<Feature['state']>, { kind: 'group' }>;

function GroupRow({
  feature,
  groupState,
  isActive,
}: {
  feature: Feature;
  groupState: GroupState;
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const agg = deriveGroupAggregate(groupState.items);

  const handleAggToggle = () => {
    if (agg === 'partial' && groupState.onPartial) {
      groupState.onPartial();
      return;
    }
    // all-on → toggle every item off; all-off → toggle every item on
    for (const item of groupState.items) item.toggle();
  };

  return (
    <section
      aria-label={`group-row-${feature.id}`}
      data-state={agg}
      data-active={isActive || undefined}
      className="px-4 py-0.5"
    >
      <div className="flex items-center h-8 gap-2">
        <button
          type="button"
          aria-label="group-label"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 flex-1 bg-transparent border-0 text-left p-0 text-xs font-mono cursor-pointer',
            agg === 'none' ? 'text-muted' : 'text-text',
          )}
        >
          <span>{feature.label}</span>
        </button>
        <button
          type="button"
          aria-label="group-toggle"
          data-state={agg}
          onClick={(e) => {
            e.stopPropagation();
            handleAggToggle();
          }}
          className={cn(
            TOGGLE_PILL_BASE,
            togglePillColor(agg),
            'tracking-wider cursor-pointer shrink-0',
          )}
        >
          {togglePillSymbol(agg)}
        </button>
      </div>
      {expanded && groupState.items.length > 0 && (
        <div className="pb-1.5 pl-5">
          {groupState.items.map((item) => (
            <section
              key={item.value}
              aria-label={`type-row-${item.value}`}
              className="flex items-center gap-2 h-7"
            >
              <span
                className={cn(
                  'text-xs font-mono shrink-0 w-36 overflow-hidden text-ellipsis whitespace-nowrap',
                  item.on ? 'text-text' : 'text-muted',
                )}
              >
                {item.label}
              </span>
              <span
                role="note"
                aria-label={`type-sample-${item.value}`}
                className="text-xs font-mono text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {item.preview ?? ''}
              </span>
              <button
                type="button"
                aria-label={`type-pill-${item.value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  item.toggle();
                }}
                className={cn(
                  TOGGLE_PILL_BASE,
                  togglePillColor(item.on ? 'all' : 'none'),
                  'tracking-wider cursor-pointer shrink-0',
                )}
              >
                {togglePillSymbol(item.on ? 'all' : 'none')}
              </button>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export function FeatureRow(props: FeatureRowProps): React.JSX.Element {
  const state = props.feature.state;
  if (state?.kind === 'group') {
    return <GroupRow feature={props.feature} groupState={state} isActive={props.isActive} />;
  }
  return <FlatRow {...props} />;
}
