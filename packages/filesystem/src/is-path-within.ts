import { isAbsolute, relative, resolve } from 'node:path';

export function isPathWithin(root: string, path: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  if (resolvedPath === resolvedRoot) return true;
  const rel = relative(resolvedRoot, resolvedPath);
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}
