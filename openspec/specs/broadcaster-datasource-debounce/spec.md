# broadcaster-datasource-debounce Specification

## Purpose
TBD - created by archiving change datasource-onchange-debounce. Update Purpose after archive.
## Requirements
### Requirement: Watcher burst coalesced into single onChange notification

`DataSource` SHALL debounce watcher events so that all events arriving within a configurable window fire `onChange` callbacks exactly once, after the window expires.

#### Scenario: Single event fires after debounce window

- **WHEN** one watcher event arrives
- **THEN** `onChange` callbacks are NOT called immediately
- **AND** after the debounce window elapses, `onChange` callbacks are called exactly once

#### Scenario: Multiple events within window coalesced

- **WHEN** three watcher events arrive within the debounce window
- **THEN** `onChange` callbacks are called exactly once (not three times)
- **AND** the callback fires after the window expires following the last event

#### Scenario: Events separated by more than window fire independently

- **WHEN** one watcher event arrives and the debounce window elapses
- **AND** a second watcher event arrives after the window
- **THEN** `onChange` callbacks are called twice in total (once per burst)

### Requirement: Debounce timer cleared on dispose

`DataSource.dispose()` SHALL cancel any pending debounce timer so that `onChange` callbacks are not invoked after the data source is disposed.

#### Scenario: Pending callback suppressed after dispose

- **WHEN** a watcher event arrives (debounce window not yet elapsed)
- **AND** `dispose()` is called before the window elapses
- **THEN** `onChange` callbacks are NOT called

### Requirement: Default debounce window is 80 ms

`DataSource` SHALL use a default debounce window of 80 ms when no window is provided.

#### Scenario: Default window applied

- **WHEN** a `DataSource` is constructed without specifying a debounce window
- **AND** a watcher event arrives
- **THEN** callbacks fire after approximately 80 ms

