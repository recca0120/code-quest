const THOUSAND = 1_000;
const MILLION = 1_000_000;

export function formatTokens(n: number): string {
  if (n >= MILLION) return `${(n / MILLION).toFixed(1)}M`;
  if (n >= THOUSAND) return `${(n / THOUSAND).toFixed(1)}k`;
  return String(n);
}

export function formatTokenCount(n: number): string | null {
  if (n <= 0) return null;
  return `${formatTokens(n)} tokens`;
}
