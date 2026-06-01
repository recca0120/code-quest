/** Shared visual tokens for `ui/` primitives.
 *
 *  Centralizes recipes that previously drifted across components.
 *  Compose into a primitive's className via `cn(...)`.
 *
 *  Concerns covered: shape + state. Color palette stays in Tailwind
 *  theme tokens (bg-bg, text-text-*, accent, danger, ...).
 */

/** Single focus-visible recipe for all interactive primitives.
 *  ring-2 + accent matches the project's existing EffortSwitch baseline. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** Default control border. */
export const controlBorder = 'border border-border';

/** Tab trigger active indicator + text color switching.
 *  Compose with size/layout classes via cn(tabTrigger, ...). */
export const tabTrigger =
  'border-b-2 border-transparent text-muted hover:text-text data-[state=active]:border-accent data-[state=active]:text-text';

/** Compact tab trigger (text-xs, standard padding). Used by dialog/panel tabs. */
export const tabTriggerCompact: string = `${tabTrigger} px-3 py-1.5 text-xs -mb-px`;
