import * as RadioGroup from '@radix-ui/react-radio-group';
import { cn } from '@/utils/cn';
import { focusRing } from './_tokens.ts';

interface ChoiceOption {
  value: string;
  label: string;
}

interface ChoicePillsProps {
  options: ChoiceOption[];
  currentValue: string;
  onSelect: (v: string) => void;
  /** Optional testid prefix — individual pills get `${featureId}-pill-${value}`. */
  featureId?: string;
}

/**
 * Compact radio-pill group for discrete equal-weight choices
 * (theme / density / font-size). For ordered magnitudes use EffortSwitch.
 *
 * Behavior provided by Radix RadioGroup: role="radio", aria-checked,
 * roving tabindex, ArrowLeft/ArrowRight/ArrowUp/ArrowDown nav, Space/Enter.
 */
export function ChoicePills({
  options,
  currentValue,
  onSelect,
  featureId,
}: ChoicePillsProps): React.JSX.Element {
  return (
    <RadioGroup.Root
      value={currentValue}
      onValueChange={onSelect}
      aria-label={featureId ? `${featureId}-pills` : 'choice-pills'}
      className="inline-flex gap-1"
      orientation="horizontal"
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          aria-label={opt.label}
          className={cn(
            'text-xs font-mono font-bold rounded-sm px-1.5 py-0.5 border cursor-pointer',
            opt.value === currentValue
              ? 'bg-accent text-selected-text border-accent'
              : 'text-muted border-border hover:text-text',
            focusRing,
          )}
        >
          {opt.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
