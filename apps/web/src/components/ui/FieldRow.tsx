export function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const FIELD_CONTROL_CLASS =
  'w-full px-2 py-1.5 text-sm rounded border border-border bg-bg/60 focus:outline-none focus:border-accent';
