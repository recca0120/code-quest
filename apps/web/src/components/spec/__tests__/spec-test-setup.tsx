import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { createFakeSummoner } from '@/test/fake-summoner';
import { FsProvidersWrapper } from '@/test/wrap-fs-providers';

type SetupResult = {
  summoner: ReturnType<typeof createFakeSummoner>;
  Wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;
};

export function setup(): SetupResult {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return (
      <FsProvidersWrapper socket={summoner.socket}>
        {children}
        <Toaster />
      </FsProvidersWrapper>
    );
  }
  return { summoner, Wrapper };
}
