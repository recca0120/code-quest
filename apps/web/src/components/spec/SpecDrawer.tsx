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
import { RightDrawer } from '@/components/ui/RightDrawer.tsx';
import { TaskChecklist } from '@/components/ui/TaskChecklist';
import { useOpenspecActions } from '@/contexts/OpenspecContext';
import { useSocket } from '@/contexts/SocketContext';
import { rpc } from '@/socket/rpc';
import { MarkdownContent } from '../chat/renderers/MarkdownContent.tsx';
import { tabTriggerCompact } from '../ui/_tokens.ts';

interface SpecDrawerProps {
  open: boolean;
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
const TABS_BY_KIND: Record<OpenspecKind, OpenspecArtifactKind[]> = {
  change: CHANGE_TABS,
  spec: ['spec'],
};

type TabState =
  | { kind: 'loading' }
  | { kind: 'ready'; content: string }
  | { kind: 'error'; message: string };

export function SpecDrawer({ open, cwd, kind, name, onClose }: SpecDrawerProps): React.JSX.Element {
  const tabs = TABS_BY_KIND[kind];
  const [active, setActive] = useState<OpenspecArtifactKind>(tabs[0] ?? 'spec');
  const { socket } = useSocket();
  const { toggleTask, refetchOpenspecList } = useOpenspecActions();
  const [state, setState] = useState<TabState>({ kind: 'loading' });

  // biome-ignore lint/correctness/useExhaustiveDependencies: name resets the tab when the user switches to a different item of the same kind
  useEffect(() => {
    setActive(TABS_BY_KIND[kind][0] ?? 'spec');
  }, [kind, name]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    rpc(socket, EVENTS.openspec.read, { cwd, kind, name, artifact: active })
      .then((response) => {
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
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error', message: 'Request failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, active, cwd, kind, name, socket]);

  const title = `${kind === 'change' ? 'Change' : 'Spec'}: ${name}`;

  return (
    <RightDrawer open={open} title={title} onClose={onClose}>
      <Tabs.Root
        value={active}
        onValueChange={(v) => setActive(v as OpenspecArtifactKind)}
        className="flex flex-col flex-1 min-h-0"
      >
        {tabs.length > 1 && (
          <Tabs.List className="flex gap-1 px-4 pt-2 border-b border-border shrink-0">
            {tabs.map((t) => (
              <Tabs.Trigger key={t} value={t} className={tabTriggerCompact}>
                {TAB_LABEL[t]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        )}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {state.kind === 'loading' && <div className="text-sm text-muted">Loading…</div>}
          {state.kind === 'error' && <div className="text-sm text-warning">{state.message}</div>}
          {state.kind === 'ready' &&
            (kind === 'change' && active === 'tasks' ? (
              <TaskChecklist
                content={state.content}
                onToggle={async (lineIndex) => {
                  const result = await toggleTask(cwd, name, lineIndex);
                  if ('ok' in result) await refetchOpenspecList(cwd);
                  return result;
                }}
                onError={(message) => toast.error(`Toggle failed: ${message}`)}
              />
            ) : (
              <MarkdownContent content={state.content} />
            ))}
        </div>
      </Tabs.Root>
    </RightDrawer>
  );
}
