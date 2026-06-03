const MAX_LEN = 22;
const HEAD = 14;
const TAIL = 6;

export function midTruncate(str: string): string {
  if (str.length <= MAX_LEN) return str;
  return `${str.slice(0, HEAD)}…${str.slice(-TAIL)}`;
}
