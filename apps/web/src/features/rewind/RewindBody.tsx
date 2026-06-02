export function RewindBody({ forked = false }: { forked?: boolean }): React.JSX.Element {
  return (
    <>
      {forked && <p>A new forked conversation will be created after rewinding.</p>}
      <p>
        The code <strong className="font-semibold text-text">has not changed</strong>, so no code
        will be restored.
      </p>
      <p className="text-muted/70">
        ⓘ Rewinding does not affect files edited manually or via bash.
      </p>
    </>
  );
}
