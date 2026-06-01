import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

interface SpeechInputButtonProps {
  isListening: boolean;
  onToggle: () => void;
  isSupported: boolean;
  interimText?: string;
  className?: string;
}

export function SpeechInputButton({
  isListening,
  onToggle,
  isSupported,
  interimText,
  className,
}: SpeechInputButtonProps): React.ReactNode {
  if (!isSupported) return null;

  return (
    <div className={cn('relative flex items-center', className)}>
      {interimText && (
        <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs italic text-muted bg-surface border border-border rounded px-2 py-1 whitespace-nowrap max-w-50 truncate pointer-events-none">
          {interimText}
        </span>
      )}
      <IconButton
        aria-label={isListening ? 'Stop mic' : 'Start mic'}
        title={isListening ? 'Stop recording' : 'Start voice input'}
        onClick={onToggle}
        className="relative text-muted hover:text-bright"
      >
        {isListening ? (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-danger" />
          </span>
        ) : (
          <MicrophoneIcon className="w-4 h-4" />
        )}
      </IconButton>
    </div>
  );
}
