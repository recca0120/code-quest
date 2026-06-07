import type { OpenspecChangeSummary, OpenspecKind, OpenspecSpecSummary } from '@code-quest/schemas';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { toast } from 'sonner';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOpenspecActions, useOpenspecList } from '@/contexts/OpenspecContext';
import { pluralize } from '@/utils/pluralize';
import { Badge } from '../ui/Badge.tsx';
import { CommandHint } from '../ui/CommandHint.tsx';
import { InlinePlaceholder } from '../ui/InlinePlaceholder.tsx';
import { PaneSection } from '../ui/PaneSection.tsx';
import { PaneStatusFooter } from '../ui/PaneStatusFooter.tsx';
import { SkeletonRows } from '../ui/SkeletonRows.tsx';
import { ArchiveChangeDialog } from './ArchiveChangeDialog.tsx';
import { NewChangeDialog } from './NewChangeDialog.tsx';
import { SpecDrawer } from './SpecDrawer.tsx';

async function runOpenspecAction(
  action: () => Promise<{ error: string } | object>,
  options: {
    errorPrefix: string;
    successMessage: string;
    onSuccess: () => void;
    refetch: () => Promise<unknown>;
  },
): Promise<void> {
  const result = await action();
  if ('error' in result) {
    toast.error(`${options.errorPrefix}: ${result.error}`);
    return;
  }
  toast.success(options.successMessage);
  options.onSuccess();
  await options.refetch();
}

interface SpecPaneProps {
  cwd: string;
}

export function SpecPane({ cwd }: SpecPaneProps): React.JSX.Element {
  const data = useOpenspecList(cwd);
  const { changeNew, archive, refetchOpenspecList } = useOpenspecActions();
  const [open, setOpen] = useState<{ kind: OpenspecKind; name: string } | null>(null);
  const [newChangeOpen, setNewChangeOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  async function handleCreateChange(name: string) {
    await runOpenspecAction(() => changeNew(cwd, name), {
      errorPrefix: 'Create failed',
      successMessage: `Created change ${name}`,
      onSuccess: () => setNewChangeOpen(false),
      refetch: () => refetchOpenspecList(cwd),
    });
  }

  async function handleArchive(name: string, opts: { skipSpecs: boolean }) {
    await runOpenspecAction(() => archive(cwd, name, opts), {
      errorPrefix: 'Archive failed',
      successMessage: `Archived ${name}`,
      onSuccess: () => setArchiveTarget(null),
      refetch: () => refetchOpenspecList(cwd),
    });
  }

  if (data && 'error' in data) {
    if (data.error === 'no-openspec') {
      return (
        <EmptyState
          icon={<ClipboardDocumentListIcon className="w-9 h-9" />}
          message="No openspec/ directory in this project."
          hint={<CommandHint command="openspec init" />}
        />
      );
    }
    if (data.error === 'openspec-cli-not-found') {
      return (
        <EmptyState
          icon={<ClipboardDocumentListIcon className="w-9 h-9" />}
          message="openspec CLI not found on PATH."
          hint={<CommandHint command="npm i -g @fission-codes/openspec" />}
        />
      );
    }
    return <EmptyState message={data.error} />;
  }

  const isLoading = !data;

  return (
    <section className="flex flex-col h-full" aria-label="spec-pane">
      <div className="flex-1 min-h-0 overflow-auto text-sm">
        <PaneSection
          title="Active changes"
          scope="worktree"
          action={
            <InlineAction
              variant="accent"
              aria-label="New change"
              className="hover:underline"
              onClick={() => setNewChangeOpen(true)}
            >
              + new
            </InlineAction>
          }
        >
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : data.changes.length > 0 ? (
            <ul className="flex flex-col">
              {data.changes.map((c) => (
                <ChangeRow
                  key={c.name}
                  change={c}
                  onOpen={() => setOpen({ kind: 'change', name: c.name })}
                  onArchive={() => setArchiveTarget(c.name)}
                />
              ))}
            </ul>
          ) : (
            <InlinePlaceholder>No active changes</InlinePlaceholder>
          )}
        </PaneSection>
        <PaneSection title="Specs" scope="project">
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : data.specs.length > 0 ? (
            <ul className="flex flex-col">
              {data.specs.map((s) => (
                <SpecRow
                  key={s.capability}
                  spec={s}
                  onOpen={() => setOpen({ kind: 'spec', name: s.capability })}
                />
              ))}
            </ul>
          ) : (
            <InlinePlaceholder>No specs</InlinePlaceholder>
          )}
        </PaneSection>
      </div>
      {!isLoading && (
        <PaneStatusFooter>
          <span>{pluralize(data.changes.length, 'change')}</span>
          <span>·</span>
          <span>{pluralize(data.specs.length, 'spec')}</span>
        </PaneStatusFooter>
      )}
      <SpecDrawer
        open={!!open}
        cwd={cwd}
        kind={open?.kind ?? 'change'}
        name={open?.name ?? ''}
        onClose={() => setOpen(null)}
      />
      <NewChangeDialog
        open={newChangeOpen}
        onSubmit={handleCreateChange}
        onClose={() => setNewChangeOpen(false)}
      />
      {archiveTarget !== null && (
        <ArchiveChangeDialog
          open
          name={archiveTarget}
          onSubmit={(opts) => handleArchive(archiveTarget, opts)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
    </section>
  );
}

function ChangeRow({
  change: c,
  onOpen,
  onArchive,
}: {
  change: OpenspecChangeSummary;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const ready = c.status === 'complete';
  return (
    <li className="flex items-center gap-2 px-1 py-0.5 hover:bg-hover-tint rounded">
      <button
        type="button"
        aria-label={`spec-change-row-${c.name}`}
        className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        onClick={onOpen}
      >
        <span aria-hidden className="text-xs">
          📋
        </span>
        <span className="font-mono text-xs truncate flex-1">{c.name}</span>
      </button>
      {ready && (
        <>
          <Badge
            variant="success"
            mono
            size="xs"
            border
            role="status"
            aria-label={`spec-ready-badge-${c.name}`}
            className="uppercase tracking-wide"
          >
            Ready
          </Badge>
          <button
            type="button"
            aria-label={`Archive ${c.name}`}
            onClick={onArchive}
            className="shrink-0 px-1.5 py-px rounded border border-border text-muted hover:border-danger hover:text-danger font-mono text-2xs uppercase cursor-pointer"
          >
            Archive
          </button>
        </>
      )}
      {c.tasks && (
        <Badge
          variant="muted"
          mono
          size="xs"
          border
          role="status"
          aria-label={`spec-task-pill-${c.name}`}
        >
          {c.tasks.done}/{c.tasks.total}
        </Badge>
      )}
    </li>
  );
}

function SpecRow({ spec: s, onOpen }: { spec: OpenspecSpecSummary; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-label={`spec-capability-row-${s.capability}`}
        className="flex items-center gap-2 w-full text-left px-1 py-0.5 hover:bg-hover-tint rounded"
        onClick={onOpen}
      >
        <span aria-hidden className="text-dim text-xs">
          ▸
        </span>
        <span className="font-mono text-xs">{s.capability}</span>
      </button>
    </li>
  );
}
