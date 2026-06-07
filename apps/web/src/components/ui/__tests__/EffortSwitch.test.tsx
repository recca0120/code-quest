import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EffortSwitch } from '../EffortSwitch.tsx';

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

describe('EffortSwitch behavior', () => {
  it('exposes role="slider" with aria-valuemin/max/now mapped to level index', () => {
    render(<EffortSwitch level="high" levels={LEVELS} onSelect={vi.fn()} />);
    const sl = screen.getByRole('slider');
    expect(sl).toHaveAttribute('aria-valuemin', '0');
    expect(sl).toHaveAttribute('aria-valuemax', String(LEVELS.length - 1));
    expect(sl).toHaveAttribute('aria-valuenow', '2');
  });

  it('ArrowRight advances the level', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EffortSwitch level="medium" levels={LEVELS} onSelect={onSelect} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');
    expect(onSelect).toHaveBeenLastCalledWith('high');
  });

  it('ArrowLeft retreats the level', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EffortSwitch level="medium" levels={LEVELS} onSelect={onSelect} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowLeft}');
    expect(onSelect).toHaveBeenLastCalledWith('low');
  });

  it('Home key jumps to first level', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EffortSwitch level="medium" levels={LEVELS} onSelect={onSelect} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{Home}');
    expect(onSelect).toHaveBeenLastCalledWith('low');
  });

  it('End key jumps to last level', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<EffortSwitch level="medium" levels={LEVELS} onSelect={onSelect} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{End}');
    expect(onSelect).toHaveBeenLastCalledWith('max');
  });

  it('click at the visible right edge picks max (linear mapping across full pill)', () => {
    const onSelect = vi.fn();
    render(<EffortSwitch level="low" levels={LEVELS} onSelect={onSelect} />);
    const root = screen.getByRole('slider');
    const PILL = 100;
    root.getBoundingClientRect = () =>
      ({
        left: 0,
        right: PILL,
        top: 0,
        bottom: 20,
        x: 0,
        y: 0,
        width: PILL,
        height: 20,
        toJSON() {},
      }) as DOMRect;
    // Use detail=1 so the click handler doesn't early-return on detail===0.
    fireEvent.click(root, { clientX: PILL - 1, clientY: 10, detail: 1 });
    expect(onSelect).toHaveBeenLastCalledWith('max');
  });

  it('click at left edge picks low', () => {
    const onSelect = vi.fn();
    render(<EffortSwitch level="max" levels={LEVELS} onSelect={onSelect} />);
    const root = screen.getByRole('slider');
    const PILL = 100;
    root.getBoundingClientRect = () =>
      ({
        left: 0,
        right: PILL,
        top: 0,
        bottom: 20,
        x: 0,
        y: 0,
        width: PILL,
        height: 20,
        toJSON() {},
      }) as DOMRect;
    fireEvent.click(root, { clientX: 1, clientY: 10, detail: 1 });
    expect(onSelect).toHaveBeenLastCalledWith('low');
  });
});

describe('EffortSwitch visual contract', () => {
  it('thumb is vertically centered in track', () => {
    const { container } = render(<EffortSwitch level="low" levels={LEVELS} />);
    const thumb = container.querySelector('[aria-label="effort-switch-thumb"]')!;
    expect(thumb.className).toMatch(/top-1\/2/);
    expect(thumb.className).toMatch(/-translate-y-1\/2/);
  });

  it('thumb has a subtle ring so it stays visible on any mode-accent fill', () => {
    const { container } = render(<EffortSwitch level="low" levels={LEVELS} />);
    const thumb = container.querySelector('[aria-label="effort-switch-thumb"]')!;
    expect(thumb.className).toMatch(/ring-/);
  });

  it('renders ticks only for positions after the thumb (count-adaptive)', () => {
    const atLow = render(<EffortSwitch level="low" levels={LEVELS} />);
    expect(atLow.container.querySelectorAll('[aria-label="effort-switch-tick"]')).toHaveLength(
      LEVELS.length - 1,
    );

    const atHigh = render(<EffortSwitch level="high" levels={LEVELS} />);
    expect(atHigh.container.querySelectorAll('[aria-label="effort-switch-tick"]')).toHaveLength(2);

    const atMax = render(<EffortSwitch level="max" levels={LEVELS} />);
    expect(atMax.container.querySelectorAll('[aria-label="effort-switch-tick"]')).toHaveLength(0);
  });

  it('visible pill height matches the thumb/fill bar (slim h-3.5, not h-5)', () => {
    // User-reported: command menu showed the visible frame oversized
    // relative to thumb/fill — wanted the slim "inner bar" look as the
    // canonical visual, with the larger box reserved for the click hit
    // area. Track height collapses to h-3.5 to match thumb + fill.
    const { container } = render(<EffortSwitch level="medium" levels={LEVELS} />);
    const track = container.querySelector('[aria-label="effort-switch-track"]')! as HTMLElement;
    const fill = container.querySelector('[aria-label="effort-switch-fill"]')! as HTMLElement;
    expect(track.className).toMatch(/\bh-3\.5\b/);
    expect(fill.className).toMatch(/\b(h-3\.5|h-full)\b/);
  });

  it('focus ring owner must not be the same element that clips overflow', () => {
    const { container } = render(<EffortSwitch level="low" levels={LEVELS} />);
    const focusOwner = container.querySelector('[role="slider"]')!;
    expect(focusOwner.className).toMatch(/focus-visible:ring-/);
    expect(focusOwner.className).not.toMatch(/overflow-hidden/);
    const clipper = container.querySelector('[aria-label="effort-switch-track"]')!;
    expect(clipper.className).toMatch(/overflow-hidden/);
  });

  // happy-dom drops complex calc() values set via element.style — intercept
  // the setter to capture what React writes.
  function captureStyleWrites(prop: string) {
    const writes: string[] = [];
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
    Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
      set(v: string) {
        writes.push(v);
        desc?.set?.call(this, v);
      },
      get() {
        return desc?.get?.call(this) ?? '';
      },
      configurable: true,
    });
    return {
      writes,
      restore: () => Object.defineProperty(CSSStyleDeclaration.prototype, prop, desc!),
    };
  }

  it('fill uses container% + CSS var for thumb size (density + font-size adaptive)', () => {
    const { writes, restore } = captureStyleWrites('width');

    render(<EffortSwitch level="low" levels={LEVELS} />);
    const lowWidth = writes.find((w) => w.includes('100%'));
    expect(lowWidth).toBeDefined();
    expect(lowWidth).toMatch(/var\(--spacing\)\s*\*\s*3\.5/);

    writes.length = 0;
    render(<EffortSwitch level="max" levels={LEVELS} />);
    const maxWidth = writes.find((w) => w.includes('100%'));
    expect(maxWidth).toBeDefined();
    expect(maxWidth).not.toMatch(/\b\d+px\b/);

    restore();
  });

  it('thumb edges align flush with pill edges (no overhang)', () => {
    const { writes, restore } = captureStyleWrites('left');

    render(<EffortSwitch level="max" levels={LEVELS} />);
    const maxLeft = writes.find((w) => w.includes('100%'));
    expect(maxLeft).toBeDefined();
    expect(maxLeft).toMatch(/-/);
    expect(maxLeft).not.toMatch(/\b\d+px\b/);

    restore();
  });
});
