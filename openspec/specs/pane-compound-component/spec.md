# pane-compound-component Specification

## Purpose
TBD - created by archiving change pane-toolbar-unification. Update Purpose after archive.
## Requirements
### Requirement: Pane compound component renders Toolbar and Content slots
The system SHALL provide a `Pane` compound component with `Pane.Toolbar` and `Pane.Content` sub-components.
`Pane.Toolbar` SHALL render split/close/DnD controls and accept `children` as a custom tools slot.
`Pane.Content` SHALL render a scrollable content container.

#### Scenario: Pane.Toolbar renders split and close buttons
- **WHEN** `Pane.Toolbar` is rendered with `paneId`, `onSplitH`, `onSplitV`, `onClose` props
- **THEN** split-horizontal (`data-testid="pane-split-h"`), split-vertical (`data-testid="pane-split-v"`), and close (`data-testid="pane-close"`) buttons SHALL be visible

#### Scenario: Pane.Toolbar renders custom tools slot
- **WHEN** `Pane.Toolbar` is rendered with children
- **THEN** the children SHALL appear inside the toolbar alongside the default controls

#### Scenario: Pane.Toolbar without children renders only default controls
- **WHEN** `Pane.Toolbar` is rendered with no children
- **THEN** only split and close buttons SHALL be visible

#### Scenario: Pane.Content renders children in scrollable container
- **WHEN** `Pane.Content` is rendered with a child component
- **THEN** the child SHALL be visible inside a flex-1 overflow-auto container

### Requirement: WorktreeSwitcher standalone component
The system SHALL provide a `WorktreeSwitcher` component that displays the current worktree branch label and a dropdown to switch CWD within a pane.

#### Scenario: WorktreeSwitcher shows emoji, label and current branch
- **WHEN** `WorktreeSwitcher` is rendered with `emoji`, `label`, `cwd` matching an entry in `availableWorktrees`
- **THEN** the worktree switcher button SHALL display the emoji, label, and `⎇ branch` of the matching worktree

#### Scenario: WorktreeSwitcher opens dropdown on click
- **WHEN** user clicks the button with `aria-label="worktree switcher"`
- **THEN** a `data-testid="cwd-dropdown"` SHALL appear listing all `availableWorktrees` with `⎇ branch (projectName)` format

#### Scenario: WorktreeSwitcher switches pane content on selection
- **WHEN** user selects a worktree from the dropdown
- **THEN** `setContentInPane` SHALL be called with the new CWD and the dropdown SHALL close

