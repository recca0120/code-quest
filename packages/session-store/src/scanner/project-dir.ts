export function decodeProjectDir(encoded: string): string {
  return encoded.replace(/-/g, '/');
}

export function encodeProjectDir(cwd: string): string {
  return cwd.replace(/\//g, '-');
}
