import { EVENTS } from '@code-quest/schemas';
import { useEffect, useState } from 'react';
import { useFsActions } from '@/contexts/FsContext';
import { useGitActions, useGitStatus } from '@/contexts/GitContext';
import { useOpenspecList } from '@/contexts/OpenspecContext';
import { useSocket } from '@/contexts/SocketContext';
import { rpc } from '@/socket/rpc';

// ── ContextPanelGit ──

interface ContextPanelGitProps {
  cwd: string;
}

export function ContextPanelGit({ cwd }: ContextPanelGitProps): React.JSX.Element {
  const { refetchGitStatus, diff } = useGitActions();
  const status = useGitStatus(cwd);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, string>>({});

  async function handleFileClick(file: string, fileStatus: string): Promise<void> {
    if (expandedFile === file) {
      setExpandedFile(null);
      return;
    }
    setExpandedFile(file);
    if (diffs[file]) return;
    const result = await diff(cwd, file, fileStatus);
    if ('diff' in result) {
      setDiffs((prev) => ({ ...prev, [file]: result.diff }));
    }
  }

  return (
    <div data-testid="context-panel-git" className="p-2 text-xs">
      {status === undefined && <p className="text-muted-foreground">Loading...</p>}
      {'notARepo' in (status ?? {}) && (
        <p className="text-muted-foreground">Not a git repository</p>
      )}
      {'error' in (status ?? {}) && (
        <p className="text-destructive">{(status as { error: string }).error}</p>
      )}
      {status && 'branch' in status && (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">⎇ {status.branch}</span>
            <button
              type="button"
              aria-label="Refresh"
              onClick={() => refetchGitStatus(cwd)}
              className="opacity-60 hover:opacity-100"
            >
              ↺
            </button>
          </div>
          {status.hasUpstream && (
            <p className="text-muted-foreground mb-1">
              ↑{status.ahead ?? 0} ↓{status.behind ?? 0}
            </p>
          )}
          <p className="text-muted-foreground mb-1">{status.isClean ? 'Clean' : 'Dirty'}</p>
          <ul className="space-y-0.5">
            {status.changedFiles.map((f) => (
              <li key={f.file}>
                <button
                  type="button"
                  className="text-left w-full hover:underline"
                  onClick={() => handleFileClick(f.file, f.status)}
                >
                  {f.status} {f.file}
                </button>
                {expandedFile === f.file && diffs[f.file] !== undefined && (
                  <pre className="bg-muted p-1 mt-1 overflow-auto text-xs whitespace-pre-wrap">
                    {diffs[f.file]}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── ContextPanelSpec ──

interface ContextPanelSpecProps {
  cwd: string;
}

export function ContextPanelSpec({ cwd }: ContextPanelSpecProps): React.JSX.Element {
  const result = useOpenspecList(cwd);
  const { socket } = useSocket();
  const [expandedChange, setExpandedChange] = useState<string | null>(null);
  const [changeContents, setChangeContents] = useState<Record<string, string>>({});

  async function handleChangeClick(name: string): Promise<void> {
    if (expandedChange === name) {
      setExpandedChange(null);
      return;
    }
    setExpandedChange(name);
    if (changeContents[name]) return;
    const res = await rpc(socket, EVENTS.openspec.read, {
      cwd,
      kind: 'change',
      name,
      artifact: 'tasks',
    });
    if ('content' in res) {
      setChangeContents((prev) => ({ ...prev, [name]: res.content }));
    }
  }

  return (
    <div data-testid="context-panel-spec" className="p-2 text-xs">
      {result === undefined && <p className="text-muted-foreground">Loading...</p>}
      {'error' in (result ?? {}) && (
        <p className="text-destructive">{(result as { error: string }).error}</p>
      )}
      {result && 'changes' in result && (
        <>
          {result.changes.length > 0 && (
            <div className="mb-2">
              <p className="font-medium mb-1">Changes</p>
              <ul className="space-y-0.5">
                {result.changes.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      aria-label={c.name}
                      className="flex items-center justify-between gap-1 w-full text-left hover:underline"
                      onClick={() => handleChangeClick(c.name)}
                    >
                      <span>{c.name}</span>
                      <span className="flex items-center gap-1">
                        {c.tasks && (
                          <span className="text-muted-foreground">
                            {c.tasks.done}/{c.tasks.total} tasks
                          </span>
                        )}
                        <span className="text-muted-foreground">{c.status}</span>
                      </span>
                    </button>
                    {expandedChange === c.name && changeContents[c.name] !== undefined && (
                      <pre className="bg-muted p-1 mt-1 overflow-auto text-xs whitespace-pre-wrap">
                        {changeContents[c.name]}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.specs.length > 0 && (
            <div>
              <p className="font-medium mb-1">Specs</p>
              <ul className="space-y-0.5">
                {result.specs.map((s) => (
                  <li key={s.capability}>{s.capability}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── ContextPanelFiles ──

interface FsEntry {
  name: string;
  path: string;
  kind: 'dir' | 'file';
}

interface ContextPanelFilesProps {
  cwd: string;
}

export function ContextPanelFiles({ cwd }: ContextPanelFilesProps): React.JSX.Element {
  const { browse } = useFsActions();
  const [currentPath, setCurrentPath] = useState(cwd);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    browse(currentPath).then((result) => {
      if ('error' in result) {
        setEntries([]);
      } else {
        const dirs: FsEntry[] = result.directories.map((d) => ({
          name: d.name,
          path: d.path,
          kind: 'dir',
        }));
        const files: FsEntry[] = result.files.map((f) => ({
          name: f.name,
          path: f.path,
          kind: 'file',
        }));
        setEntries([...dirs, ...files]);
      }
      setLoading(false);
    });
  }, [currentPath, browse]);

  // Build breadcrumbs from cwd root to currentPath
  function buildBreadcrumbs(): { label: string; path: string }[] {
    const breadcrumbs: { label: string; path: string }[] = [];
    const parts = currentPath.split('/').filter(Boolean);
    const cwdParts = cwd.split('/').filter(Boolean);

    // Start from cwd root
    for (let i = cwdParts.length - 1; i < parts.length; i++) {
      const path = `/${parts.slice(0, i + 1).join('/')}`;
      breadcrumbs.push({ label: parts[i] ?? '', path });
    }
    return breadcrumbs;
  }

  const breadcrumbs = buildBreadcrumbs();

  return (
    <div data-testid="context-panel-files" className="p-2 text-xs">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                className={
                  i === breadcrumbs.length - 1
                    ? 'font-medium'
                    : 'text-muted-foreground hover:underline'
                }
                onClick={() => setCurrentPath(crumb.path)}
                disabled={i === breadcrumbs.length - 1}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {loading && <p className="text-muted-foreground">Loading...</p>}
      {!loading && (
        <ul className="space-y-0.5">
          {entries.map((entry) => (
            <li key={entry.path}>
              {entry.kind === 'dir' ? (
                <button
                  type="button"
                  className="text-left w-full hover:underline font-medium"
                  onClick={() => setCurrentPath(entry.path)}
                >
                  <span aria-hidden="true">📁 </span>
                  <span>{entry.name}</span>
                </button>
              ) : (
                <span className="text-muted-foreground">
                  <span aria-hidden="true">📄 </span>
                  <span>{entry.name}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
