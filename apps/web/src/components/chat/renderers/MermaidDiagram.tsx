import mermaid from 'mermaid';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEffectiveColorTheme } from '@/hooks/useEffectiveColorTheme.ts';

// mermaid.initialize is global — track last applied theme to avoid redundant calls
// and races between concurrent diagram instances
let initializedTheme: string | null = null;

function initializeMermaid(theme: 'dark' | 'default') {
  if (initializedTheme === theme) return;
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
  initializedTheme = theme;
}

/** Reset the module-level theme cache. Only for use in tests. */
export function _resetMermaidThemeCache(): void {
  initializedTheme = null;
}

export function MermaidDiagram({ code }: { code: string }): React.JSX.Element | null {
  const idRef = useRef(`mermaid-${crypto.randomUUID()}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useEffectiveColorTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        initializeMermaid(theme === 'clay-dark' || theme === 'roast' ? 'dark' : 'default');
        const result = await mermaid.render(idRef.current, code);
        // mermaid appends a hidden element to body with this id; remove it to avoid accumulation
        document.getElementById(`d${idRef.current}`)?.remove();
        if (!cancelled && containerRef.current) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(result.svg, 'text/html');
          const svgEl = doc.querySelector('svg');
          if (svgEl) containerRef.current.replaceChildren(svgEl);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  if (error) {
    return (
      <pre className="text-danger text-xs whitespace-pre-wrap p-3 bg-surface rounded">{error}</pre>
    );
  }

  return <div ref={containerRef} className="my-3 overflow-x-auto" />;
}
