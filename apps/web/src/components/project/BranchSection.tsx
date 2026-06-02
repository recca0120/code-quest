import type { GitStatusResult } from '@code-quest/git';
import { InlineAction } from '@/components/chat/ui/InlineAction';
import { SectionLabel } from '../ui/SectionLabel.tsx';
import { BranchPopover } from './BranchPopover.tsx';

interface BranchSectionProps {
  status: GitStatusResult | null;
  branches: string[];
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectBranch: (branch: string) => void | Promise<void>;
}

export function BranchSection({
  status,
  branches,
  popoverOpen,
  onPopoverOpenChange,
  onSelectBranch,
}: BranchSectionProps): React.JSX.Element {
  return (
    <section className="px-3 py-2 border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <SectionLabel as="h4" className="m-0">
          Branch
        </SectionLabel>
        <BranchPopover
          trigger={
            <InlineAction variant="accent" aria-label="Switch branch" className="hover:underline">
              switch ⌄
            </InlineAction>
          }
          open={popoverOpen}
          onOpenChange={onPopoverOpenChange}
          branches={branches}
          current={status?.branch ?? null}
          onSelect={onSelectBranch}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded border border-border bg-bg/40 font-mono text-xs text-text">
          <span className="text-accent">⎇</span>
          <span>{status?.branch ?? '…'}</span>
        </span>
        {status && (
          <UpstreamBadge
            ahead={status.ahead}
            behind={status.behind}
            hasUpstream={status.hasUpstream}
          />
        )}
      </div>
    </section>
  );
}

function UpstreamBadge({
  ahead,
  behind,
  hasUpstream,
}: {
  ahead?: number;
  behind?: number;
  hasUpstream?: boolean;
}) {
  if (hasUpstream === false) {
    return <span className="text-xs text-dim">(no upstream)</span>;
  }
  const a = ahead ?? 0;
  const b = behind ?? 0;
  if (a === 0 && b === 0) {
    return <span className="text-xs text-dim">up to date</span>;
  }
  return (
    <span className="text-xs font-mono text-muted">
      {a > 0 && <span className="mr-1">↑{a}</span>}
      {b > 0 && <span>↓{b}</span>}
    </span>
  );
}
