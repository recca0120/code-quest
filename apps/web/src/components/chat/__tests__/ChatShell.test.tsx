import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatShell } from '../ChatShell.tsx';

describe('ChatShell layout (compound component)', () => {
  it('Header slot renders its children', () => {
    render(
      <ChatShell>
        <ChatShell.Header>
          <div>My Header</div>
        </ChatShell.Header>
      </ChatShell>,
    );
    expect(screen.getByText('My Header')).toBeInTheDocument();
  });

  it('Body slot renders its children', () => {
    render(
      <ChatShell>
        <ChatShell.Body>
          <div>Message List</div>
        </ChatShell.Body>
      </ChatShell>,
    );
    expect(screen.getByText('Message List')).toBeInTheDocument();
  });

  it('Footer slot renders its children', () => {
    render(
      <ChatShell>
        <ChatShell.Footer>
          <div>Compose</div>
        </ChatShell.Footer>
      </ChatShell>,
    );
    expect(screen.getByText('Compose')).toBeInTheDocument();
  });

  it('Side slot renders when provided', () => {
    render(
      <ChatShell>
        <ChatShell.Side>
          <div>Side Panel</div>
        </ChatShell.Side>
      </ChatShell>,
    );
    expect(screen.getByText('Side Panel')).toBeInTheDocument();
  });

  it('Side slot is absent when not provided', () => {
    const { container } = render(
      <ChatShell>
        <ChatShell.Header>
          <div>header</div>
        </ChatShell.Header>
      </ChatShell>,
    );
    expect(container.querySelector('[data-side-panel]')).not.toBeInTheDocument();
  });

  it('renders without error when no children provided', () => {
    expect(() => render(<ChatShell />)).not.toThrow();
  });

  it('Body slot children are direct flex children of the chat column (no extra wrapper div)', () => {
    render(
      <ChatShell>
        <ChatShell.Body>
          <div>body content</div>
        </ChatShell.Body>
      </ChatShell>,
    );
    const bodyChild = screen.getByText('body content');
    // Parent should be the chat column (relative flex-col), not an intermediate wrapper
    const chatColumn = bodyChild.parentElement;
    expect(chatColumn?.className).toMatch(/relative/);
    expect(chatColumn?.className).toMatch(/flex-col/);
  });

  it('Footer slot content appears inside the absolute footer container', () => {
    render(
      <ChatShell>
        <ChatShell.Footer>
          <div>compose input</div>
        </ChatShell.Footer>
      </ChatShell>,
    );
    const footerContent = screen.getByText('compose input');
    // Walk up to find the absolute-positioned ancestor
    let el: HTMLElement | null = footerContent;
    let foundAbsolute = false;
    while (el) {
      if (el.className.includes('absolute') && el.className.includes('bottom-0')) {
        foundAbsolute = true;
        break;
      }
      el = el.parentElement;
    }
    expect(foundAbsolute).toBe(true);
  });
});
