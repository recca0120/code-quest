export function filterTabsByWorktree<T extends { sessionId: string; cwd?: string | null }>(
  tabs: T[],
  selectedWorktreeCwd: string | null | undefined,
): T[] {
  if (!selectedWorktreeCwd) return tabs;
  return tabs.filter((t) => t.cwd === selectedWorktreeCwd);
}
