## Why

The git pane currently opens diffs in a centred modal dialog that covers the entire workspace. The files pane and spec pane both use a `RightDrawer` side-panel pattern that keeps the file list visible while content is previewed — the git pane should be consistent with this established UX.

## What Changes

- Add `DiffDrawer.tsx` — a `RightDrawer`-based component that renders the coloured diff lines, truncation warning, Copy-path and Discard (with two-step confirm) actions.
- `GitPane.tsx` — replace `DiffModal` usage with `DiffDrawer`; drawer is controlled by `open={!!diffFile}`.
- Remove `DiffModal.tsx` and its test file — no other consumers.
- Update `GitPane.test.tsx` to match the new drawer interaction.

## Capabilities

### New Capabilities

- `git-diff-drawer`: Side-panel diff viewer for git changed files, replacing the centred modal. Renders unified diff with syntax colouring, truncation guard, Copy-path and two-step Discard actions inside a `RightDrawer`.

### Modified Capabilities

<!-- none — no existing spec-level behaviour changes -->

## Impact

- `apps/web/src/components/git/DiffDrawer.tsx` (new)
- `apps/web/src/components/git/DiffModal.tsx` (deleted)
- `apps/web/src/components/git/GitPane.tsx` (updated)
- `apps/web/src/components/git/__tests__/GitPane.test.tsx` (updated)
- `apps/web/src/components/git/__tests__/DiffModal.test.tsx` (deleted if it exists)
