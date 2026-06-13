import type { ComponentType, ReactNode } from 'react';

type ProviderComponent = ComponentType<{ children: ReactNode }>;

export function composeProviders(providers: ProviderComponent[]): ProviderComponent {
  return function ComposedProviders({ children }: { children: ReactNode }) {
    return providers.reduceRight<ReactNode>(
      // biome-ignore lint/correctness/useJsxKeyInIterable: static provider list, never reordered
      (acc, Provider) => <Provider>{acc}</Provider>,
      children,
    );
  };
}
