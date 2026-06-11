import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    expect(container.style.width).toBe('58%');
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
