import { CheckIcon } from '@heroicons/react/24/outline';
import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/utils/cn';
import { focusRing } from './_tokens.ts';

const trackClass = (isOn: boolean) =>
  cn(
    'flex items-center w-7 h-3.5 rounded-full transition-colors shrink-0',
    isOn ? 'bg-accent' : 'bg-hover-tint',
  );

const thumbClass = (isOn: boolean) =>
  cn(
    'block w-3 h-3 rounded-full bg-white will-change-transform transition-transform',
    'translate-x-0.5',
    isOn && 'translate-x-3.5',
  );

const Check = () => (
  <CheckIcon
    aria-hidden="true"
    className="absolute inset-0 m-auto w-2 h-2 text-accent"
    strokeWidth={2.5}
  />
);

/** When `onClick` is provided renders a Radix Switch (role="switch", keyboard
 *  Space toggles). When omitted renders a display-only pill — used inside
 *  another button (e.g. menu item) where nesting a Radix Switch would create
 *  a button-in-button violation. */
export function ToggleSwitch({
  isOn,
  onClick,
}: {
  isOn: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  if (!onClick) {
    return (
      <div className={trackClass(isOn)}>
        <div className={thumbClass(isOn)}>{isOn && <Check />}</div>
      </div>
    );
  }
  return (
    <Switch.Root
      checked={isOn}
      onCheckedChange={onClick}
      className={cn(trackClass(isOn), focusRing)}
    >
      <Switch.Thumb className={thumbClass(isOn)}>{isOn && <Check />}</Switch.Thumb>
    </Switch.Root>
  );
}
