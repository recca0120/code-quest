import { useEffect, useRef, useState } from 'react';

const INTERVAL_MS = 100;
const EASING_FACTOR = 0.15;

export function useSmoothedValue(target: number | undefined): number {
  const resolved = target ?? 0;
  const [displayed, setDisplayed] = useState(resolved);
  const valueRef = useRef(resolved);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const clearCurrent = (): void => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (resolved < valueRef.current) {
      valueRef.current = resolved;
      setDisplayed(resolved);
      clearCurrent();
      return clearCurrent;
    }

    if (resolved === valueRef.current) return clearCurrent;

    clearCurrent();
    intervalRef.current = setInterval(() => {
      const diff = resolved - valueRef.current;
      const next = valueRef.current + Math.max(1, Math.ceil(diff * EASING_FACTOR));
      const clamped = Math.min(next, resolved);
      if (clamped !== valueRef.current) setDisplayed(clamped);
      valueRef.current = clamped;
      if (clamped >= resolved) clearCurrent();
    }, INTERVAL_MS);

    return clearCurrent;
  }, [resolved]);

  return displayed;
}
