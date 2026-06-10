import type { GitFileChange } from '@code-quest/git';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGitActions, useGitStatus } from '@/contexts/GitContext';
import { useSocket } from '@/contexts/SocketContext';
import { cn } from '@/utils/cn';
import { gitStatusMark } from '@/utils/git-status';
import type { DiffFile } from '@/utils/parse-unified-diff';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CommandHint } from '../ui/CommandHint.tsx';
import { InlinePlaceholder } from '../ui/InlinePlaceholder.tsx';
import { PaneSection } from '../ui/PaneSection.tsx';
import { PaneStatusFooter } from '../ui/PaneStatusFooter.tsx';
import { RowActionButton } from '../ui/RowActionButton.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { CommitComposer } from './CommitComposer.tsx';
import { createGitViewActions } from './createGitViewActions.ts';
import { DiffDrawer } from './DiffDrawer.tsx';

interface GitViewProps {
  cwd: string;
}

export function GitView({ cwd }: GitViewProps): React.JSX.Element {
  const { socket } = useSocket();
  const gitActions = useGitActions();
  const data = useGitStatus(cwd);
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null);

  const { stageAll, commit, runFetch, runPull, push, openDiff, handleDiscard } = useMemo(
    () => createGitViewActions(cwd, socket, gitActions, { onDiffOpen: setDiffFile }),
    [cwd, socket, gitActions],
  );
  const refetch = () => gitActions.refetchGitStatus(cwd);

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

  const hasChanges = !data.isClean;
  const changedCount = data.changedFiles.length;
  const ahead = data.ahead ?? 0;
  const behind = data.behind ?? 0;
  const diffFileStatus = diffFile
    ? data.changedFiles.find((f) => f.file === diffFile.path)?.status
    : undefined;
  const canDiscardDiffFile = diffFileStatus !== undefined && diffFileStatus !== '??';

  return (
    <section className="flex flex-col h-full" aria-label="git-pane">
      <div className="flex-1 min-h-0 overflow-auto">
        <PaneSection
          title={`Changes (${changedCount})`}
          action={
            hasChanges && (
              <ActionButton
                onClick={stageAll}
                variant="ghost"
                size="xs"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Stage all
              </ActionButton>
            )
          }
          bordered
          className="text-sm"
        >
          <ChangedFiles
            files={data.changedFiles}
            onPick={openDiff}
            onDiscard={(filePath) => void handleDiscard(filePath, refetch)}
          />
          {hasChanges && (
            <CommitComposer onCommit={(msg) => void commit(msg)} count={changedCount} />
          )}
        </PaneSection>

        <PaneSection title="Actions">
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
        </PaneSection>
      </div>
      <PaneStatusFooter>
        <span>{data.branch ?? 'unknown'}</span>
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
  const { mark, cls } = gitStatusMark(file.status);
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
        <RowActionButton
          aria-label={`Discard ${file.file}`}
          onClick={() => onDiscard(file.file)}
          className="text-subtle hover:text-danger opacity-0 group-hover:opacity-100"
        >
          ×
        </RowActionButton>
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
    return <InlinePlaceholder>No changes</InlinePlaceholder>;
  }
  return (
    <ul className="flex flex-col">
      {files.map((f) => (
        <FileRow key={f.file} file={f} onPick={onPick} onDiscard={onDiscard} />
      ))}
    </ul>
  );
}
