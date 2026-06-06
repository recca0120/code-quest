## Context

`FilesPane` uses `PreviewDrawer` (a `RightDrawer` side-panel) and `SpecPane` uses `SpecDrawer` (also a `RightDrawer`). `GitPane` is the odd one out — it opens diffs in a centred `DiffModal` (`Dialog`), which covers the entire workspace. The goal is to bring git into the same pattern.

All three panes share `RightDrawer` as the container primitive. Each drawer is specialised for its domain: file content (text/image/pdf), spec markdown with tabs, and unified diff with coloured lines. The content models are different enough that no intermediate shell abstraction adds value.

## Goals / Non-Goals

**Goals:**
- Replace `DiffModal` with `DiffDrawer` in `GitPane`
- `DiffDrawer` wraps `RightDrawer` directly — same pattern as `PreviewDrawer` and `SpecDrawer`
- Diff content, Copy-path, and two-step Discard actions move into the drawer
- Delete `DiffModal` once replaced

**Non-Goals:**
- Extracting a shared `DrawerShell` / `ContentDrawer` abstraction — `RightDrawer` is already the shared primitive
- Changing the diff loading or git-status logic in `useGitPaneActions`

## Decisions

**`DiffDrawer` wraps `RightDrawer` directly**
Alternatives: (1) extend `PreviewDrawer` by adding a `diff` kind to `PreviewState` — rejected because mixing file-preview semantics with diff semantics inflates one component; (2) add a `DrawerShell` wrapper — rejected because each drawer's top-area and content handling is different enough that the shared code would be minimal.

**Drawer is open-controlled by `open={!!diffFile}` in `GitPane`**
Same pattern as `FilesPane` (`open={!!previewFile}`). The drawer mounts once and transitions open/closed — no remount on each click.

**Discard confirm logic stays in `DiffDrawer`**
`CONFIRM_WINDOW_MS = 3000` two-step confirm is UI state owned by the drawer, not `GitPane`. Keeps `GitPane` clean.

**`DiffModal.tsx` deleted after replacement**
Zero other consumers. Keeping it would create confusion about which to use.

## Risks / Trade-offs

- Line truncation (`LINE_LIMIT = 5000`) is preserved — long diffs still show a warning. No change in behaviour.
- Drawer width (`672`) matches `PreviewDrawer` — consistent side-panel size across panes.

## Migration Plan

1. Create `DiffDrawer.tsx` (new file, wraps `RightDrawer`)
2. Update `GitPane.tsx` to use `DiffDrawer` instead of `DiffModal`
3. Delete `DiffModal.tsx`
4. Update tests
