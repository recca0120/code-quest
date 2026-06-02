import {
  EVENTS,
  type OpenspecArtifactKind,
  type OpenspecKind,
  openspecArtifactKindSchema,
  openspecReadResultSchema,
} from '@code-quest/schemas';
import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TaskChecklist } from '@/components/ui/TaskChecklist';
import { useOpenspecActions } from '@/contexts/OpenspecContext';
import { useSocket } from '@/contexts/SocketContext';
import { rpc } from '@/socket/rpc';
import { MarkdownContent } from '../chat/renderers/MarkdownContent.tsx';
import { tabTriggerCompact } from '../ui/_tokens.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';

interface SpecModalProps {
  cwd: string;
  kind: OpenspecKind;
  name: string;
  onClose: () => void;
}

const CHANGE_TABS: OpenspecArtifactKind[] = openspecArtifactKindSchema.options.filter(
  (k) => k !== 'spec',
);
const TAB_LABEL: Record<OpenspecArtifactKind, string> = {
  proposal: 'Proposal',
  design: 'Design',
  tasks: 'Tasks',
  spec: 'Spec',
};

export function SpecModal({ cwd, kind, name, onClose }: SpecModalProps): React.JSX.Element {
  const tabs: OpenspecArtifactKind[] = kind === 'change' ? CHANGE_TABS : ['spec'];
  const [active, setActive] = useState<OpenspecArtifactKind>(tabs[0] ?? 'spec');
  const { socket } = useSocket();
  const { toggleTask, refetchOpenspecList } = useOpenspecActions();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; content: string } | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      const response = await rpc(socket, EVENTS.openspec.read, {
        cwd,
        kind,
        name,
        artifact: active,
      });
      if (cancelled) return;
      const parsed = openspecReadResultSchema.safeParse(response);
      if (!parsed.success) {
        setState({ kind: 'error', message: 'Invalid response' });
        return;
      }
      if ('error' in parsed.data) {
        setState({ kind: 'error', message: parsed.data.error });
        return;
      }
      setState({ kind: 'ready', content: parsed.data.content });
    })();
    return () => {
      cancelled = true;
    };
  }, [active, cwd, kind, name, socket]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`${kind === 'change' ? 'Change' : 'Spec'}: ${name}`} size="lg">
        <Tabs.Root
          value={active}
          onValueChange={(v) => setActive(v as OpenspecArtifactKind)}
          className="flex flex-col gap-3"
        >
          {tabs.length > 1 && (
            <Tabs.List className="flex gap-1 border-b border-border">
              {tabs.map((t) => (
                <Tabs.Trigger key={t} value={t} className={tabTriggerCompact}>
                  {TAB_LABEL[t]}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          )}
          <div className="text-sm bg-bg/40 border border-border rounded p-3 overflow-auto max-h-dialog-body leading-relaxed">
            {state.kind === 'loading' && <span className="text-muted text-xs">Loading…</span>}
            {state.kind === 'error' && (
              <span className="text-warning text-xs">{state.message}</span>
            )}
            {state.kind === 'ready' &&
              (kind === 'change' && active === 'tasks' ? (
                <TaskChecklist
                  content={state.content}
                  onToggle={async (lineIndex) => {
                    const result = await toggleTask(cwd, name, lineIndex);
                    if ('ok' in result) {
                      await refetchOpenspecList(cwd);
                    }
                    return result;
                  }}
                  onError={(message) => toast.error(`Toggle failed: ${message}`)}
                />
              ) : (
                <MarkdownContent content={state.content} />
              ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
