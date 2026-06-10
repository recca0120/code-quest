# split-pane Specification

## Purpose
TBD - created by archiving change pane-toolbar-unification. Update Purpose after archive.
## Requirements
### Requirement: SplitPane leaf renders Pane compound component
The system SHALL render each leaf node in the pane tree using the `Pane` compound component instead of directly rendering `PaneHeader` + content.
Each content type (session, git, files, spec, worktrees) SHALL be rendered as `Pane` with `Pane.Toolbar` and `Pane.Content`.

#### Scenario: Session pane renders Pane.Toolbar without custom tools
- **WHEN** a leaf node with `type: 'session'` is rendered
- **THEN** the pane SHALL have a `Pane.Toolbar` with split and close buttons but no worktree switcher

#### Scenario: Git pane renders Pane.Toolbar with WorktreeSwitcher
- **WHEN** a leaf node with `type: 'git'` is rendered
- **THEN** the pane SHALL have a `Pane.Toolbar` containing a `WorktreeSwitcher` with emoji "🌿" and label "Git"

#### Scenario: Files pane renders Pane.Toolbar with WorktreeSwitcher
- **WHEN** a leaf node with `type: 'files'` is rendered
- **THEN** the pane SHALL have a `Pane.Toolbar` containing a `WorktreeSwitcher` with emoji "📁" and label "Files"

#### Scenario: Spec pane renders Pane.Toolbar with WorktreeSwitcher
- **WHEN** a leaf node with `type: 'spec'` is rendered
- **THEN** the pane SHALL have a `Pane.Toolbar` containing a `WorktreeSwitcher` with emoji "📋" and label "Spec"

#### Scenario: No stacked toolbar — single toolbar row per pane
- **WHEN** any tool pane (git/files/spec) is rendered
- **THEN** only one toolbar row SHALL be visible (no `tool-pane-header` below `pane-header`)

