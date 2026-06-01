import { ChoicePills } from '@/components/ui/ChoicePills';
import { EffortSwitch } from '@/components/ui/EffortSwitch';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { TriStateIndicator } from '@/components/ui/TriStateIndicator';
import { deriveGroupAggregate } from '../derive-group-aggregate.ts';
import type { Feature, FeatureState } from '../feature.ts';

interface MenuItemView {
  id: string;
  menuItem: {
    label: string;
    section: string;
    order?: number;
    closeSilent?: boolean;
    filterOnly?: boolean;
    description?: string;
    trailing?: React.ReactNode;
    disabled?: boolean;
    matchFirstToken?: boolean;
  };
  execute(): void;
}

interface TrailingOpts {
  featureId?: string;
}

export function renderMenuTrailing(state?: FeatureState, opts?: TrailingOpts): React.ReactNode {
  if (!state) return undefined;
  if (state.kind === 'toggle') {
    return (
      <span
        role="status"
        aria-label={opts?.featureId ? `${opts.featureId}-switch` : 'toggle-switch'}
        data-state={state.active ? 'on' : 'off'}
      >
        <ToggleSwitch isOn={state.active} />
      </span>
    );
  }
  if (state.kind === 'group') {
    return (
      <TriStateIndicator
        state={deriveGroupAggregate(state.items)}
        onPartial={state.onPartial}
        featureId={opts?.featureId}
      />
    );
  }
  if (state.kind === 'select') {
    return (
      <span role="status" aria-label="select-current" className="font-mono text-xs text-muted">
        {state.currentValue}
      </span>
    );
  }
  if (state.kind === 'segmented') {
    return (
      <EffortSwitch
        level={state.currentValue ?? undefined}
        levels={state.options}
        onSelect={state.onSelect}
      />
    );
  }
  if (state.kind === 'choice') {
    return (
      <ChoicePills
        options={state.options}
        currentValue={state.currentValue}
        onSelect={state.onSelect}
        featureId={opts?.featureId}
      />
    );
  }
  state satisfies never;
  return null;
}

export function toMenuItem(f: Feature): MenuItemView {
  return {
    id: f.id,
    menuItem: {
      label: f.label,
      section: f.section,
      order: f.order,
      description: f.description,
      disabled: f.disabled,
      closeSilent: f.ui?.closeSilent ?? f.state?.kind === 'toggle',
      matchFirstToken: f.ui?.matchFirstToken,
      filterOnly: f.ui?.filterOnly,
      trailing: renderMenuTrailing(f.state, { featureId: f.id }),
    },
    execute: f.execute,
  };
}
