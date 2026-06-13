import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { composeProviders } from '../compose-providers';

function createProvider(testId: string) {
  return function Provider({ children }: { children: ReactNode }) {
    return <div data-testid={testId}>{children}</div>;
  };
}

describe('composeProviders', () => {
  it('wraps children in providers from outer to inner (array order)', () => {
    const A = createProvider('a');
    const B = createProvider('b');
    const C = createProvider('c');
    const Composed = composeProviders([A, B, C]);

    render(
      <Composed>
        <span data-testid="child">hello</span>
      </Composed>,
    );

    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');
    const c = screen.getByTestId('c');
    const child = screen.getByTestId('child');

    expect(a).toContainElement(b);
    expect(b).toContainElement(c);
    expect(c).toContainElement(child);
  });

  it('renders children directly when array is empty', () => {
    const Composed = composeProviders([]);

    render(
      <Composed>
        <span data-testid="child">hello</span>
      </Composed>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('works with a single provider', () => {
    const A = createProvider('a');
    const Composed = composeProviders([A]);

    render(
      <Composed>
        <span data-testid="child">hello</span>
      </Composed>,
    );

    expect(screen.getByTestId('a')).toContainElement(screen.getByTestId('child'));
  });
});
