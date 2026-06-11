import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlideOverPane } from '../SlideOverPane';

describe('SlideOverPane 容器（2.1）', () => {
  it('渲染 absolute 定位、58% 寬、z-25、圓角、進場動效', () => {
    render(
      <SlideOverPane>
        <div data-testid="child">hello</div>
      </SlideOverPane>,
    );
    const container = screen.getByTestId('slide-over-pane');
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();

    const cls = container.className;
    expect(cls).toMatch(/absolute/);
    expect(cls).toMatch(/z-25/);
    expect(cls).toMatch(/rounded/);
    // 58% width via inline style
    expect(container.style.width).toBe('var(--slideover-w)');
  });

  it('visible=false 時不渲染', () => {
    render(
      <SlideOverPane visible={false}>
        <div data-testid="child">hello</div>
      </SlideOverPane>,
    );
    expect(screen.queryByTestId('slide-over-pane')).not.toBeInTheDocument();
  });
});

describe('SlideOverPane 右滑手勢收回（4.1）', () => {
  it('右滑 > 100px → 呼叫 onSwipeClose', () => {
    const onSwipeClose = vi.fn();
    render(
      <SlideOverPane onSwipeClose={onSwipeClose}>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 420 });
    fireEvent.pointerUp(pane);
    expect(onSwipeClose).toHaveBeenCalledTimes(1);
  });

  it('右滑 < 100px → 不觸發 onSwipeClose', () => {
    const onSwipeClose = vi.fn();
    render(
      <SlideOverPane onSwipeClose={onSwipeClose}>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 380 });
    fireEvent.pointerUp(pane);
    expect(onSwipeClose).not.toHaveBeenCalled();
  });

  it('右滑中即時 translateX 反映（drag feedback）', () => {
    render(
      <SlideOverPane>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 350 });
    expect(pane.style.transform).toContain('translateX(50px)');
  });

  it('左滑不觸發 onSwipeClose', () => {
    const onSwipeClose = vi.fn();
    render(
      <SlideOverPane onSwipeClose={onSwipeClose}>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 180 });
    fireEvent.pointerUp(pane);
    expect(onSwipeClose).not.toHaveBeenCalled();
  });
});

describe('SlideOverPane zoom 優先（6.1）', () => {
  it('visible=false 時不渲染（zoom mode 由 PaneTree 傳 visible=false）', () => {
    render(
      <SlideOverPane visible={false}>
        <div data-testid="child">hello</div>
      </SlideOverPane>,
    );
    expect(screen.queryByTestId('slide-over-pane')).not.toBeInTheDocument();
  });
});

describe('SlideOverPane 左拖釘選（5.1）', () => {
  it('左拖 > 100px + pointerup → 呼叫 onPinToSplit', () => {
    const onPinToSplit = vi.fn();
    render(
      <SlideOverPane onPinToSplit={onPinToSplit}>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 180 });
    fireEvent.pointerUp(pane);
    expect(onPinToSplit).toHaveBeenCalledTimes(1);
  });

  it('左拖 < 100px → 不觸發 onPinToSplit', () => {
    const onPinToSplit = vi.fn();
    render(
      <SlideOverPane onPinToSplit={onPinToSplit}>
        <div>content</div>
      </SlideOverPane>,
    );
    const pane = screen.getByTestId('slide-over-pane');
    fireEvent.pointerDown(pane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(pane, { clientX: 250 });
    fireEvent.pointerUp(pane);
    expect(onPinToSplit).not.toHaveBeenCalled();
  });
});
