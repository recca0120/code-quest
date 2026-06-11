import type { Project } from '@/contexts/ProjectContext';

function byLastOpenedDesc(a: Project, b: Project): number {
  return a.lastOpenedAt < b.lastOpenedAt ? 1 : -1;
}

export function splitPinnedRecent(projects: Project[]): { pinned: Project[]; recent: Project[] } {
  const pinned: Project[] = [];
  const recent: Project[] = [];
  for (const p of projects) {
    if (p.pinned) pinned.push(p);
    else recent.push(p);
  }
  return { pinned: pinned.sort(byLastOpenedDesc), recent: recent.sort(byLastOpenedDesc) };
}
