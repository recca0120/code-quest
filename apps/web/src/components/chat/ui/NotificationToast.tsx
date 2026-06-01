import { toast } from 'sonner';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/utils/cn';

interface NotificationButton {
  label: string;
  value: string;
}

interface NotificationToastProps {
  message: string;
  severity?: 'info' | 'warning' | 'error';
  buttons: NotificationButton[];
  onButton: (value: string) => void;
  onDismiss: () => void;
}

export function showNotificationToast(
  message: string,
  severity: 'info' | 'warning' | 'error',
  buttons: string[],
  onRespond: (response: Record<string, unknown>) => void,
): void {
  if (buttons.length > 1) {
    toast.custom(
      (id: string | number) => (
        <NotificationToast
          message={message}
          severity={severity}
          buttons={buttons.map((label) => ({ label, value: label }))}
          onButton={(value) => {
            toast.dismiss(id);
            onRespond({ buttonValue: value });
          }}
          onDismiss={() => {
            toast.dismiss(id);
            onRespond({});
          }}
        />
      ),
      { duration: Infinity },
    );
  } else {
    const showToast =
      severity === 'error' ? toast.error : severity === 'warning' ? toast.warning : toast.info;
    showToast(message, {
      duration: Infinity,
      action: {
        label: buttons[0] ?? '',
        onClick: () => onRespond({ buttonValue: buttons[0] ?? '' }),
      },
      onDismiss: () => onRespond({}),
    });
  }
}

export function NotificationToast({
  message,
  severity = 'info',
  buttons,
  onButton,
  onDismiss,
}: NotificationToastProps): React.ReactNode {
  return (
    <div
      role="alert"
      className={cn(
        'bg-surface border rounded-md px-4 py-3 shadow-floating',
        severity === 'error'
          ? 'border-danger'
          : severity === 'warning'
            ? 'border-warning'
            : 'border-accent',
      )}
    >
      <div className="text-sm text-text mb-3">{message}</div>
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <Button
            key={btn.value}
            variant="primary"
            size="xs"
            className="rounded-md text-sm font-medium"
            onClick={() => onButton(btn.value)}
          >
            {btn.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="xs"
          className="rounded-md text-sm font-medium bg-hover-tint text-muted hover:bg-surface-hover"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
