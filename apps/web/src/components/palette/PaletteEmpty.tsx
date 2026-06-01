interface PaletteEmptyProps {
  /** Raw (display) query string. Empty/whitespace → renders "no messages yet";
   *  otherwise → renders "no matches for <query>". */
  query: string;
}

export function PaletteEmpty({ query }: PaletteEmptyProps): React.JSX.Element {
  const hasQuery = query.trim().length > 0;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 font-mono text-xs text-muted">
      <span className="text-2xl opacity-50">∅</span>
      {hasQuery ? (
        <span>
          no matches for <span className="text-accent">"{query}"</span>
        </span>
      ) : (
        <span>no messages yet</span>
      )}
    </div>
  );
}
