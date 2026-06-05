import type { OpenspecKind } from '@code-quest/schemas';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { toast } from 'sonner';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOpenspecActions, useOpenspecList } from '@/contexts/OpenspecContext';
import { pluralize } from '@/utils/pluralize';
import { Badge } from '../ui/Badge.tsx';
import { CommandHint } from '../ui/CommandHint.tsx';
import { PaneStatusFooter } from '../ui/PaneStatusFooter.tsx';
import { SectionLabel } from '../ui/SectionLabel.tsx';
import { SkeletonRows } from '../ui/SkeletonRows.tsx';
import { ArchiveChangeDialog } from './ArchiveChangeDialog.tsx';
import { NewChangeDialog } from './NewChangeDialog.tsx';
import { SpecDrawer } from './SpecDrawer.tsx';

interface SpecPaneProps {
  cwd: string;
}

interface OpenSpec {
  kind: OpenspecKind;
  name: string;
}

export function SpecPane({ cwd }: SpecPaneProps): React.JSX.Element {
  const data = useOpenspecList(cwd);
  const { changeNew, archive, refetchOpenspecList } = useOpenspecActions();
  const [open, setOpen] = useState<OpenSpec | null>(null);
  const [newChangeOpen, setNewChangeOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  async function handleCreateChange(name: string) {
    const result = await changeNew(cwd, name);
    if ('error' in result) {
      toast.error(`Create failed: ${result.error}`);
      return;
    }
    toast.success(`Created change ${name}`);
    setNewChangeOpen(false);
    await refetchOpenspecList(cwd);
  }

  async function handleArchive(name: string, opts: { skipSpecs: boolean }) {
    const result = await archive(cwd, name, opts);
    if ('error' in result) {
      toast.error(`Archive failed: ${result.error}`);
      return;
    }
    toast.success(`Archived ${name}`);
    setArchiveTarget(null);
    await refetchOpenspecList(cwd);
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

  // `data === undefined` while the openspec list fetch is in flight. Keep the
  // Section frame visible so the `+ new` action stays reachable; substitute a
  // small loading hint in place of each section's body.
  const isLoading = !data;

  return (
    <section className="flex flex-col h-full" aria-label="spec-pane">
      <div className="flex-1 min-h-0 overflow-auto p-2 text-sm">
        <Section
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
              {data.changes.map((c) => {
                const ready = c.status === 'complete';
                return (
                  <li
                    key={c.name}
                    className="flex items-center gap-2 px-1 py-0.5 hover:bg-hover-tint rounded"
                  >
                    <button
                      type="button"
                      aria-label={`spec-change-row-${c.name}`}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                      onClick={() => setOpen({ kind: 'change', name: c.name })}
                    >
                      <span aria-hidden className="text-xs">
                        📋
                      </span>
                      <span className="font-mono text-xs truncate flex-1">{c.name}</span>
                    </button>
                    {ready && (
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
                    )}
                    {ready && (
                      <button
                        type="button"
                        aria-label={`Archive ${c.name}`}
                        onClick={() => setArchiveTarget(c.name)}
                        className="shrink-0 px-1.5 py-px rounded border border-border text-muted hover:border-danger hover:text-danger font-mono text-2xs uppercase cursor-pointer"
                      >
                        Archive
                      </button>
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
              })}
            </ul>
          ) : (
            <div className="text-dim text-xs px-1">No active changes</div>
          )}
        </Section>
        <Section title="Specs" scope="project">
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : data.specs.length > 0 ? (
            <ul className="flex flex-col">
              {data.specs.map((s) => (
                <li key={s.capability}>
                  <button
                    type="button"
                    aria-label={`spec-capability-row-${s.capability}`}
                    className="flex items-center gap-2 w-full text-left px-1 py-0.5 hover:bg-hover-tint rounded"
                    onClick={() => setOpen({ kind: 'spec', name: s.capability })}
                  >
                    <span aria-hidden className="text-dim text-xs">
                      ▸
                    </span>
                    <span className="font-mono text-xs">{s.capability}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-dim text-xs px-1">No specs</div>
          )}
        </Section>
      </div>
      {data && !('error' in data) && (
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
      <ArchiveChangeDialog
        open={archiveTarget !== null}
        name={archiveTarget ?? ''}
        onSubmit={(opts) =>
          archiveTarget ? handleArchive(archiveTarget, opts) : Promise.resolve()
        }
        onClose={() => setArchiveTarget(null)}
      />
    </section>
  );
}

function Section({
  title,
  scope,
  action,
  children,
}: {
  title: string;
  scope?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <SectionLabel as="h3" className="px-1 mb-1 flex items-baseline gap-1">
        <span>{title}</span>
        {scope && <span className="text-xs text-dim normal-case">({scope})</span>}
        {action && <span className="ml-auto">{action}</span>}
      </SectionLabel>
      {children}
    </div>
  );
}
