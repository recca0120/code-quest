import { Button } from './Button.tsx';

interface ErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
}: ErrorFallbackProps): React.JSX.Element {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <span className="text-4xl">⚠</span>
      <h2 className="text-lg font-semibold text-bright">Something went wrong</h2>
      <p className="text-sm text-muted max-w-md">{message}</p>
      <Button
        variant="primary"
        size="md"
        className="rounded-lg font-medium py-2"
        onClick={resetErrorBoundary}
      >
        Try again
      </Button>
    </div>
  );
}
