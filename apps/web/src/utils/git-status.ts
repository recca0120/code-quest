type GitStatusCode = 'M' | 'A' | 'D' | 'R' | '??' | 'U';

export const GIT_STATUS_MARKS: Record<GitStatusCode, { mark: string; cls: string }> = {
  M: { mark: 'M', cls: 'text-warning' },
  A: { mark: 'A', cls: 'text-success' },
  D: { mark: 'D', cls: 'text-danger' },
  R: { mark: 'R', cls: 'text-info' },
  '??': { mark: '?', cls: 'text-success/70' },
  U: { mark: 'U', cls: 'text-success/70' },
};

export function gitStatusMark(status: string): { mark: string; cls: string } {
  const entry = GIT_STATUS_MARKS[status as GitStatusCode];
  if (entry) return entry;
  return { mark: status.slice(0, 1) || '·', cls: 'text-muted' };
}
