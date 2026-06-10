import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useState } from 'react';
import { useGitActions } from '@/contexts/GitContext';
import { tabTriggerCompact } from '../ui/_tokens.ts';
import { Button } from '../ui/Button.tsx';
import { Dialog, DialogContent } from '../ui/Dialog.tsx';
import { DialogFooter } from '../ui/DialogFooter.tsx';
import { ExistingPane } from './worktree-dialog/ExistingPane.tsx';
import { NewPane } from './worktree-dialog/NewPane.tsx';
import { autoDerivePath, buildWorktreeCommand } from './worktree-dialog-helpers.ts';

type Mode = 'existing' | 'new';

interface FormState {
  existingBranch: string;
  existingPath: string;
  newBranch: string;
  baseBranch: string;
  newPath: string;
}

const DEFAULT_FORM: FormState = {
  existingBranch: '',
  existingPath: '',
  newBranch: '',
  baseBranch: 'main',
  newPath: '',
};

export function CreateWorktreeDialog({
  open,
  cwd,
  onClose,
  onCreated,
}: {
  open: boolean;
  cwd: string;
  onClose: () => void;
  /** 建立成功（new-session flow 用它接續開 session，終結 dead-end）。 */
  onCreated?: (path: string) => void;
}): React.JSX.Element {
  const { create, listBranches } = useGitActions();

  const [mode, setMode] = useState<Mode>('existing');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [branches, setBranches] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches when dialog opens. Errors swallowed — dropdown just stays empty.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const res = await listBranches(cwd);
      if (cancelled) return;
      if (Array.isArray(res)) setBranches(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cwd, listBranches]);

  function resetAndClose() {
    setForm(DEFAULT_FORM);
    setError(null);
    setMode('existing');
    onClose();
  }

  const activeBranch = mode === 'existing' ? form.existingBranch : form.newBranch;
  const activePath =
    (mode === 'existing' ? form.existingPath : form.newPath) || autoDerivePath(cwd, activeBranch);
  const previewCommand = buildWorktreeCommand({
    mode,
    branch: activeBranch,
    baseBranch: mode === 'new' ? form.baseBranch : undefined,
    path: activePath,
  });

  const submitDisabled =
    isCreating || (mode === 'existing' ? !form.existingBranch : !form.newBranch);

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const payload =
        mode === 'existing'
          ? { cwd, existingBranch: form.existingBranch, path: activePath }
          : { cwd, newBranch: form.newBranch, baseBranch: form.baseBranch, path: activePath };
      const result = await create(payload);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onCreated?.(activePath);
      resetAndClose();
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent title="New worktree" className="w-120">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Tabs.Root
            value={mode}
            onValueChange={(v) => {
              if (v === 'existing' || v === 'new') setMode(v);
            }}
          >
            <Tabs.List className="flex gap-1 border-b border-border -mx-4 px-4">
              <Tabs.Trigger value="existing" className={tabTriggerCompact}>
                Checkout existing
              </Tabs.Trigger>
              <Tabs.Trigger value="new" className={tabTriggerCompact}>
                Create new branch
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="existing">
              <ExistingPane
                branches={branches}
                value={form.existingBranch}
                onBranchChange={(v) => setForm((f) => ({ ...f, existingBranch: v }))}
                path={form.existingPath}
                placeholderPath={autoDerivePath(cwd, form.existingBranch)}
                onPathChange={(v) => setForm((f) => ({ ...f, existingPath: v }))}
              />
            </Tabs.Content>
            <Tabs.Content value="new">
              <NewPane
                branchName={form.newBranch}
                onBranchNameChange={(v) => setForm((f) => ({ ...f, newBranch: v }))}
                baseBranch={form.baseBranch}
                baseOptions={branches.length > 0 ? branches : ['main']}
                onBaseChange={(v) => setForm((f) => ({ ...f, baseBranch: v }))}
                path={form.newPath}
                placeholderPath={autoDerivePath(cwd, form.newBranch)}
                onPathChange={(v) => setForm((f) => ({ ...f, newPath: v }))}
              />
            </Tabs.Content>
          </Tabs.Root>

          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-mono rounded bg-bg/40 border border-border">
            <span className="text-muted">command</span>
            <span role="status" aria-label="worktree-command-preview" className="truncate">
              {previewCommand}
            </span>
          </div>
          {error ? <div className="text-xs text-danger">{error}</div> : null}

          <DialogFooter variant="bleed">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={resetAndClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={submitDisabled}>
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
