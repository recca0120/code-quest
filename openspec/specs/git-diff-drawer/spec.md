# git-diff-drawer Specification

## Purpose
TBD - created by archiving change git-pane-diff-drawer. Update Purpose after archive.
## Requirements
### Requirement: Diff opens in side-panel drawer
The git pane SHALL display a changed file's unified diff inside a `RightDrawer` side-panel rather than a centred modal dialog. The drawer SHALL slide in from the right and leave the changed-files list visible.

#### Scenario: User clicks a changed file
- **WHEN** the user clicks a file row in the git pane
- **THEN** a `RightDrawer` opens from the right with the file path and diff stats (`+N -M`) as the title

#### Scenario: Drawer shows diff content
- **WHEN** the drawer is open and the diff contains text lines
- **THEN** each line SHALL be rendered with coloured background — green for additions, red for deletions, neutral for context and hunks

#### Scenario: Binary file
- **WHEN** the opened file is binary (`isBinary === true`)
- **THEN** the drawer SHALL show "Binary file changed." instead of diff lines

#### Scenario: Long diff truncation
- **WHEN** the diff exceeds 5000 lines
- **THEN** the drawer SHALL render only the first 5000 lines and display a truncation warning

#### Scenario: Closing the drawer
- **WHEN** the user clicks the ✕ button or presses Escape
- **THEN** the drawer SHALL close and the git pane list SHALL remain in place

### Requirement: Copy-path action in drawer footer
The drawer footer SHALL include a "Copy path" button that writes the file's absolute path to the clipboard.

#### Scenario: Copy path
- **WHEN** the user clicks "Copy path"
- **THEN** the file path SHALL be written to the clipboard

### Requirement: Two-step Discard action in drawer footer
The drawer footer SHALL include a "Discard" button for tracked files. A single click transitions to a "Confirm?" state for 3 seconds; a second click within that window triggers the discard. Untracked files (`status === '??'`) SHALL render the button as disabled.

#### Scenario: First Discard click
- **WHEN** the user clicks "Discard" on a tracked file
- **THEN** the button label changes to "Confirm?" and starts a 3-second countdown

#### Scenario: Confirmed Discard
- **WHEN** the user clicks "Confirm?"
- **THEN** the discard action SHALL execute

#### Scenario: Confirm window expires
- **WHEN** 3 seconds elapse without a second click
- **THEN** the button SHALL revert to "Discard" without discarding

#### Scenario: Discard disabled for untracked files
- **WHEN** the opened file has status `??`
- **THEN** the "Discard" button SHALL be rendered disabled with a tooltip "New file — delete via file tree"

