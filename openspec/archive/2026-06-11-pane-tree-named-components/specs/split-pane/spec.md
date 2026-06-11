# split-pane Spec Delta

## MODIFIED Requirements

### Requirement: PaneTree leaf renders named pane components through a unified shell

The system SHALL render the pane tree via `PaneTree` → `PaneSplit` → `PaneLeaf`（原 SplitPane/SplitPaneNode/SplitPaneLeaf 更名）。`PaneLeaf` SHALL dispatch each leaf to a named pane component（SessionPane / GitPane / FilesPane / OpenspecPane / WorktreesPaneContainer）via an exhaustive switch。`Pane` + `Pane.Toolbar` SHALL be rendered by the shared `PaneShell` only — named components contribute a tools slot and a body。Session panes SHALL NOT wrap their body in `Pane.Content`（自管捲動，scrollable: false）。

#### Scenario: Session pane renders toolbar without WorktreeSwitcher

- **WHEN** a leaf node with `type: 'session'` is rendered
- **THEN** the pane SHALL have a toolbar with split/close buttons but no worktree switcher，且 body 不包在 `Pane.Content` 內

#### Scenario: Git pane renders toolbar with WorktreeSwitcher

- **WHEN** a leaf node with `type: 'git'` is rendered
- **THEN** the pane SHALL have a toolbar containing a `WorktreeSwitcher` with emoji "🌿" and label "Git"

#### Scenario: Openspec pane renders toolbar with WorktreeSwitcher

（原「Spec pane」scenario：content type 由 `'spec'` rename 為 `'openspec'`）

- **WHEN** a leaf node with `type: 'openspec'` is rendered
- **THEN** the pane SHALL have a toolbar containing a `WorktreeSwitcher` with emoji "📋" and label "Spec"

#### Scenario: Worktrees pane gains the standard toolbar

- **WHEN** a leaf node with `type: 'worktrees'` is rendered
- **THEN** the pane SHALL have the standard toolbar（原裸 div 包裝移除）

#### Scenario: No stacked toolbar — single toolbar row per pane

- **WHEN** any tool pane (git/files/openspec) is rendered
- **THEN** only one toolbar row SHALL be visible

## ADDED Requirements

### Requirement: solo rendering replaces hidden-attribute zoom

zoom／mobile 的行為 SHALL 改為 solo rendering（PaneSplit 只渲染含目標的一側，無 percentage wrapper 與 divider）——見 `specs/pane-tree/spec.md`。

#### Scenario: hidden attribute no longer used for zoom
- WHEN a pane is zoomed
- THEN other panes SHALL NOT be rendered (solo rendering), not hidden via attribute
