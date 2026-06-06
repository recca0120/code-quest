import type { GitFileChange } from '@code-quest/git';
import { useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGitActions, useGitStatus } from '@/contexts/GitContext';
import { cn } from '@/utils/cn';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CommandHint } from '../ui/CommandHint.tsx';
import { PaneStatusFooter } from '../ui/PaneStatusFooter.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { CommitComposer } from './CommitComposer.tsx';
import { DiffDrawer } from './DiffDrawer.tsx';
import { useGitPaneActions } from './useGitPaneActions.ts';

interface GitPaneProps {
  cwd: string;
}

const STATUS_LABEL: Record<string, { mark: string; cls: string }> = {
  M: { mark: 'M', cls: 'text-warning' },
  A: { mark: 'A', cls: 'text-success' },
  D: { mark: 'D', cls: 'text-danger' },
  R: { mark: 'R', cls: 'text-info' },
  '??': { mark: '?', cls: 'text-success/70' },
  U: { mark: 'U', cls: 'text-success/70' },
};

function statusFor(s: string): { mark: string; cls: string } {
  return STATUS_LABEL[s] ?? { mark: s.slice(0, 1) || '·', cls: 'text-muted' };
}

export function GitPane({ cwd }: GitPaneProps): React.JSX.Element {
  const { refetchGitStatus } = useGitActions();
  const data = useGitStatus(cwd);
  const refetch = () => refetchGitStatus(cwd);
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null);

  const { stageAll, commit, runFetch, runPull, push, openDiff, handleDiscard } = useGitPaneActions(
    cwd,
    { onDiffOpen: setDiffFile },
  );

  // ── Early returns (must follow ALL hook calls above) ──
  if (data && 'notARepo' in data) {
    return (
      <EmptyState
        icon={
          <span className="text-4xl text-accent" aria-hidden>
            ⎇
          </span>
        }
        message="Not a git repository."
        hint={<CommandHint command="git init" />}
      />
    );
  }
  if (data && 'error' in data) {
    return <EmptyState message={data.error} />;
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted">
        <Spinner className="w-5 h-5" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  const status = data;
  const hasChanges = !status.isClean;
  const changedCount = status.changedFiles.length;
  const ahead = status.ahead ?? 0;
  const behind = status.behind ?? 0;
  const diffFileStatus = diffFile
    ? status.changedFiles.find((f) => f.file === diffFile.path)?.status
    : undefined;
  const canDiscardDiffFile = diffFileStatus !== undefined && diffFileStatus !== '??';

  return (
    <section className="flex flex-col h-full" aria-label="git-pane">
      <div className="flex-1 min-h-0 overflow-auto">
        <section className="px-3 py-2 border-b border-border text-sm">
          <div className="flex items-center justify-between mb-1">
            <h4 className="section-label m-0">Changes ({changedCount})</h4>
            {hasChanges && (
              <ActionButton
                onClick={stageAll}
                variant="ghost"
                size="xs"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Stage all
              </ActionButton>
            )}
          </div>
          <ChangedFiles
            files={status.changedFiles}
            onPick={openDiff}
            onDiscard={(filePath) => void handleDiscard(filePath, refetch)}
          />
          {hasChanges && (
            <CommitComposer onCommit={(msg) => void commit(msg)} count={changedCount} />
          )}
        </section>

        <section className="px-3 py-2">
          <h4 className="section-label m-0 mb-1">Actions</h4>
          <div className="flex gap-2 text-xs">
            <ActionButton onClick={runFetch} variant="secondary" size="xs">
              Fetch
            </ActionButton>
            <ActionButton onClick={runPull} variant="secondary" size="xs">
              Pull
            </ActionButton>
            <ActionButton onClick={push} variant="secondary" size="xs">
              Push
            </ActionButton>
          </div>
        </section>
      </div>
      <PaneStatusFooter>
        <span>{status.branch ?? 'unknown'}</span>
        <span>·</span>
        <span>
          {changedCount} {changedCount === 1 ? 'change' : 'changes'}
        </span>
        {(ahead > 0 || behind > 0) && (
          <>
            <span>·</span>
            {ahead > 0 && <span>↑{ahead}</span>}
            {behind > 0 && <span>↓{behind}</span>}
          </>
        )}
      </PaneStatusFooter>
      {diffFile ? (
        <DiffDrawer
          open={true}
          file={diffFile}
          canDiscard={canDiscardDiffFile}
          onClose={() => setDiffFile(null)}
          onDiscard={() => void handleDiscard(diffFile.path, () => setDiffFile(null))}
        />
      ) : (
        <DiffDrawer open={false} onClose={() => setDiffFile(null)} />
      )}
    </section>
  );
}

function FileRow({
  file,
  onPick,
  onDiscard,
}: {
  file: GitFileChange;
  onPick: (path: string, status: string) => void;
  onDiscard?: (path: string) => void;
}) {
  const { mark, cls } = statusFor(file.status);
  const canDiscard = file.status !== '??';
  return (
    <li className="group relative flex items-center">
      <button
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-left px-1 py-0.5 hover:bg-hover-tint rounded"
        onClick={() => onPick(file.file, file.status)}
      >
        <span className={cn('font-mono w-4 text-xs shrink-0', cls)}>{mark}</span>
        <span className="font-mono text-xs truncate">{file.file}</span>
      </button>
      {onDiscard && canDiscard && (
        <button
          type="button"
          aria-label={`Discard ${file.file}`}
          onClick={(e) => {
            e.stopPropagation();
            onDiscard(file.file);
          }}
          className="shrink-0 px-1 text-subtle hover:text-danger opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </li>
  );
}

function ChangedFiles({
  files,
  onPick,
  onDiscard,
}: {
  files: GitFileChange[];
  onPick: (path: string, status: string) => void;
  onDiscard?: (path: string) => void;
}) {
  if (files.length === 0) {
    return <div className="text-muted text-xs px-1">No changes</div>;
  }
  return (
    <ul className="flex flex-col">
      {files.map((f) => (
        <FileRow key={f.file} file={f} onPick={onPick} onDiscard={onDiscard} />
      ))}
    </ul>
  );
}
