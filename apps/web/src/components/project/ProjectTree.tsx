import type { Project } from '@/contexts/ProjectContext';
import { GroupHeader } from '../ui/GroupHeader.tsx';
import { SectionHeader } from '../ui/SectionHeader.tsx';
import { ProjectRow } from './ProjectRow.tsx';
import { splitPinnedRecent } from './project-utils.ts';

export function ProjectTree({
  projects,
  activeProjectCwd,
  onSelectProject,
  onAdd,
}: {
  projects: Project[];
  activeProjectCwd: string | null;
  onSelectProject: (cwd: string) => void;
  onAdd: () => void;
}): React.JSX.Element {
  const { pinned, recent } = splitPinnedRecent(projects);
  const showRecentHeader = pinned.length > 0 && recent.length > 0;

  function renderGroup(group: Project[]) {
    return group.map((p) => (
      <ProjectRow
        key={p.cwd}
        project={p}
        active={p.cwd === activeProjectCwd}
        onSelect={() => onSelectProject(p.cwd)}
      />
    ));
  }

  return (
    <div className="flex flex-col h-full">
      <SectionHeader className="flex items-center justify-between">
        Projects
        <button
          type="button"
          aria-label="Add Project"
          onClick={onAdd}
          className="text-subtle hover:text-text font-normal text-base leading-none"
          title="Add Project"
        >
          +
        </button>
      </SectionHeader>
      <div className="flex-1 overflow-auto px-2">
        {pinned.length > 0 && <GroupHeader>Pinned</GroupHeader>}
        {renderGroup(pinned)}
        {showRecentHeader && <GroupHeader>Recent</GroupHeader>}
        {renderGroup(recent)}
      </div>
    </div>
  );
}
