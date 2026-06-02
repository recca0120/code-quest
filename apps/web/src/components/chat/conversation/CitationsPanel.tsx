interface Citation {
  url?: string;
  title?: string;
  citedText?: string;
}

const citationKey = (c: Citation) => c.url ?? c.title ?? c.citedText ?? 'Source';

interface CitationsPanelProps {
  citations: Citation[];
}

export function CitationsPanel({ citations }: CitationsPanelProps): React.ReactNode {
  if (citations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 text-xs">
      {citations.map((c) => {
        const key = citationKey(c);
        const label = c.title ?? c.citedText ?? key;
        return c.url ? (
          <a
            key={key}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {label}
          </a>
        ) : (
          <span key={key} className="text-muted">
            {label}
          </span>
        );
      })}
    </div>
  );
}
