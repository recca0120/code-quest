/** Mono-styled inline shell command pill — used inside EmptyState `hint`
 *  slots to give users an actionable next step (e.g., `openspec init`). */
export function CommandHint({ command }: { command: string }): React.JSX.Element {
  return (
    <code className="font-mono text-xs bg-surface px-2 py-0.5 rounded border border-border text-muted">
      {command}
    </code>
  );
}
