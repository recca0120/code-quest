import { FilesView } from '@/components/files/FilesView';
import { GitView } from '@/components/git/GitView';
import { SpecView } from '@/components/spec/SpecView';

export function renderPaneView(type: 'git' | 'files' | 'openspec', cwd: string): React.ReactNode {
  switch (type) {
    case 'git':
      return <GitView cwd={cwd} />;
    case 'files':
      return <FilesView cwd={cwd} />;
    case 'openspec':
      return <SpecView cwd={cwd} />;
  }
}
