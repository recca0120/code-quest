import {
  AlreadyRepoError,
  type CreateWorktreeOptions,
  type Git,
  type GitDiffResult,
  type GitLogResult,
  type GitStatusResult,
  NotARepoError,
  type WorktreeInfo,
} from '@code-quest/git';

export class FakeGit implements Git {
  readonly capabilities = { worktree: true } as const;

  private _branch = 'main';
  private _clean = true;
  private _changedFiles: GitStatusResult['changedFiles'] = [];
  private _logEntries: Extract<GitLogResult, { entries: unknown }>['entries'] = [];
  private _logError: string | null = null;
  private _diff = '';
  private _repoRoot: string | null = '/repo';
  private _projectRoot: string | null = null;
  private _worktrees: WorktreeInfo[] = [];
  private _checkoutError: Error | null = null;
  private _statusError: Error | null = null;
  private _archiveDirty = false;
  private _ahead = 0;
  private _behind = 0;
  private _hasUpstream: boolean | undefined = undefined;
  private _stagedCount = 0;
  private _commitError: string | null = null;
  private _pushError: string | null = null;
  private _fetchError: string | null = null;
  private _pullError: string | null = null;
  private _pullFastForwarded = true;
  private _discardError: string | null = null;
  private _discardedFiles: string[] = [];
  private _commitHashCounter = 0;
  /** Paths registered as git repos. Default seed `/repo` keeps legacy tests
   *  (which never call markAsRepo) working without changes. */
  private _initializedRepos = new Set<string>(['/repo']);
  /** Per-cwd branch overrides — used by tests that switch cwd to verify
   *  the consumer re-fetches. Falls back to `_branch` for unknown cwds. */
  private _branchByCwd = new Map<string, string>();

  // ── Setup API ──

  setBranch(branch: string): void {
    this._branch = branch;
  }

  /** Per-cwd branch override; takes precedence over `setBranch` in `status`. */
  setBranchForCwd(cwd: string, branch: string): void {
    this._branchByCwd.set(cwd, branch);
  }

  setClean(clean: boolean): void {
    this._clean = clean;
  }

  setChangedFiles(files: GitStatusResult['changedFiles']): void {
    this._changedFiles = files;
  }

  setLogEntries(entries: Extract<GitLogResult, { entries: unknown }>['entries']): void {
    this._logEntries = entries;
  }

  setLogError(message: string | null): void {
    this._logError = message;
  }

  setDiff(diff: string): void {
    this._diff = diff;
  }

  setRepoRoot(root: string | null): void {
    this._repoRoot = root;
  }

  addWorktree(wt: WorktreeInfo): void {
    this._worktrees.push(wt);
  }

  setCheckoutError(err: Error | null): void {
    this._checkoutError = err;
  }

  setStatusError(err: Error | null): void {
    this._statusError = err;
  }

  setArchiveDirty(dirty: boolean): void {
    this._archiveDirty = dirty;
  }

  setAheadBehind(ahead: number, behind: number, hasUpstream = true): void {
    this._ahead = ahead;
    this._behind = behind;
    this._hasUpstream = hasUpstream;
  }

  setCommitError(err: string | null): void {
    this._commitError = err;
  }

  setPushError(err: string | null): void {
    this._pushError = err;
  }

  setFetchError(err: string | null): void {
    this._fetchError = err;
  }

  /** @param err - null for success; 'non-ff' / 'no-upstream' / string. */
  setPullError(err: string | null): void {
    this._pullError = err;
  }

  setPullFastForwarded(ff: boolean): void {
    this._pullFastForwarded = ff;
  }

  setDiscardError(err: string | null): void {
    this._discardError = err;
  }

  /** Files that have been discarded via `discardFile` — useful for tests
   *  asserting the right path reached the service. */
  get discardedFiles(): readonly string[] {
    return this._discardedFiles;
  }

  /** Read the staged-files counter (for tests). */
  get stagedCount(): number {
    return this._stagedCount;
  }

  /** Register a path as an existing git repo (so listWorktrees won't throw). */
  markAsRepo(path: string): void {
    this._initializedRepos.add(path);
  }

  reset(): void {
    this._branch = 'main';
    this._clean = true;
    this._changedFiles = [];
    this._logEntries = [];
    this._diff = '';
    this._repoRoot = '/repo';
    this._projectRoot = null;
    this._worktrees = [];
    this._checkoutError = null;
    this._statusError = null;
    this._archiveDirty = false;
    this._ahead = 0;
    this._behind = 0;
    this._hasUpstream = undefined;
    this._stagedCount = 0;
    this._commitError = null;
    this._pushError = null;
    this._fetchError = null;
    this._pullError = null;
    this._pullFastForwarded = true;
    this._discardError = null;
    this._discardedFiles = [];
    this._commitHashCounter = 0;
    this._initializedRepos = new Set<string>(['/repo']);
    this._branchByCwd.clear();
  }

  // ── Git interface ──

  async status(cwd: string): Promise<GitStatusResult> {
    if (this._statusError) throw this._statusError;
    return {
      branch: this._branchByCwd.get(cwd) ?? this._branch,
      isClean: this._clean,
      changedFiles: this._changedFiles,
      ahead: this._ahead,
      behind: this._behind,
      hasUpstream: this._hasUpstream,
    };
  }

  async checkout(_cwd: string, _branch: string): Promise<void> {
    if (this._checkoutError) throw this._checkoutError;
  }

  async log(_cwd: string, limit?: number): Promise<GitLogResult> {
    if (this._logError) throw new Error(this._logError);
    const entries = limit ? this._logEntries.slice(0, limit) : this._logEntries;
    return { entries };
  }

  async diff(_cwd: string): Promise<GitDiffResult> {
    return { diff: this._diff };
  }

  async add(_cwd: string, paths?: string[]): Promise<{ ok: true } | { error: string }> {
    if (paths && paths.length > 0) {
      const set = new Set(paths);
      const matched = this._changedFiles.filter((f) => set.has(f.file));
      this._stagedCount += matched.length;
    } else {
      this._stagedCount = this._changedFiles.length;
    }
    return { ok: true };
  }

  async commit(
    _cwd: string,
    _message: string,
  ): Promise<{ ok: true; hash: string } | { error: string }> {
    if (this._commitError) return { error: this._commitError };
    if (this._stagedCount === 0) return { error: 'nothing-to-commit' };
    this._stagedCount = 0;
    this._changedFiles = [];
    this._clean = true;
    this._commitHashCounter += 1;
    return { ok: true, hash: `fake-${this._commitHashCounter.toString(16).padStart(7, '0')}` };
  }

  async push(_cwd: string): Promise<{ ok: true } | { error: string }> {
    if (this._pushError) return { error: this._pushError };
    return { ok: true };
  }

  async fetch(_cwd: string): Promise<{ ok: true } | { error: string }> {
    if (this._fetchError) return { error: this._fetchError };
    return { ok: true };
  }

  async pull(_cwd: string): Promise<{ ok: true; fastForwarded: boolean } | { error: string }> {
    if (this._pullError) return { error: this._pullError };
    return { ok: true, fastForwarded: this._pullFastForwarded };
  }

  async discardFile(_cwd: string, file: string): Promise<{ ok: true } | { error: string }> {
    if (this._discardError) return { error: this._discardError };
    this._discardedFiles.push(file);
    return { ok: true };
  }

  setProjectRoot(root: string | null): void {
    this._projectRoot = root;
  }

  async getProjectRoot(_cwd: string): Promise<string | null> {
    return this._projectRoot;
  }

  async getRepoRoot(_cwd: string): Promise<string | null> {
    return this._repoRoot;
  }

  async initRepo(cwd: string): Promise<{ branch: string }> {
    if (this._initializedRepos.has(cwd)) throw new AlreadyRepoError(cwd);
    this._initializedRepos.add(cwd);
    this._worktrees.push({ name: 'main', path: cwd, branch: 'main' });
    return { branch: 'main' };
  }

  async createWorktree(repoRoot: string, opts: CreateWorktreeOptions = {}): Promise<WorktreeInfo> {
    const { existingBranch, newBranch, name, path } = opts;
    let wtName: string;
    let branch: string;
    if (existingBranch) {
      wtName = name ?? existingBranch.replace(/\//g, '-');
      branch = existingBranch;
    } else if (newBranch) {
      wtName = name ?? newBranch.replace(/\//g, '-');
      branch = newBranch;
    } else {
      wtName = name ?? `claude-session-${Date.now()}`;
      branch = `worktree-${wtName}`;
    }
    const wt: WorktreeInfo = {
      name: wtName,
      path: path ?? `${repoRoot}/.claude/worktrees/${wtName}`,
      branch,
    };
    this._worktrees.push(wt);
    return wt;
  }

  async listBranches(repoRoot: string): Promise<string[]> {
    if (!this._initializedRepos.has(repoRoot)) throw new NotARepoError(repoRoot);
    // Default includes 'main'; test may configure via markAsRepo + initRepo.
    const branchSet = new Set<string>(['main']);
    for (const wt of this._worktrees) {
      if (wt.branch) branchSet.add(wt.branch);
    }
    return [...branchSet];
  }

  async listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    if (!this._initializedRepos.has(repoRoot)) throw new NotARepoError(repoRoot);
    return this._worktrees;
  }

  async deleteWorktree(_repoRoot: string, name: string): Promise<void> {
    this._worktrees = this._worktrees.filter((wt) => wt.name !== name);
  }

  async renameWorktree(worktreeCwd: string, newBranchName: string): Promise<{ branch: string }> {
    const wt = this._worktrees.find((w) => w.path === worktreeCwd);
    if (!wt) throw new Error(`Worktree not registered at ${worktreeCwd}`);
    wt.branch = newBranchName;
    return { branch: newBranchName };
  }

  async archiveWorktree(
    _repoRoot: string,
    name: string,
    opts?: { force?: boolean },
  ): Promise<{ ok: true } | { error: string }> {
    if (this._archiveDirty && !opts?.force) {
      return { error: 'dirty' };
    }
    this._worktrees = this._worktrees.filter((wt) => wt.name !== name);
    return { ok: true };
  }
}
