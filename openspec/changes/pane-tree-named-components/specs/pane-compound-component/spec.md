# pane-compound-component Spec Delta

## MODIFIED Requirements

### Requirement: WorktreeSwitcher standalone component

（`setContentInPane` 的 content shape 由扁平 `{ type, cwd }` 改為 `target` union）

The system SHALL provide a `WorktreeSwitcher` component that displays the current worktree branch label and a dropdown to switch the pane's target within a pane.

#### Scenario: WorktreeSwitcher switches pane content on selection

- **WHEN** user selects a worktree from the dropdown
- **THEN** `setContentInPane` SHALL be called with content of shape `{ type, target: { kind: 'fixed', cwd } }` and the dropdown SHALL close
