## ADDED Requirements

### Requirement: Startup scan imports external sessions
On server start, the app SHALL scan all `~/.claude/projects/<encoded-cwd>/` directories for `*.jsonl` files (excluding `agent-*.jsonl`) and import any session whose `sessionId` is not already present in `raw_events`.

#### Scenario: External session appears in session list after server start
- **WHEN** a JSONL file exists at `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` and the session is not in the DB
- **THEN** after server startup the session SHALL appear in `session.list` results

#### Scenario: Already-recorded session is not duplicated
- **WHEN** a session was created via this app and already has rows in `raw_events`
- **THEN** the startup scan SHALL skip that session and not insert duplicate rows

### Requirement: Real-time detection of new JSONL sessions
The app SHALL watch the `~/.claude/projects/` directories and import new JSONL files as they appear, without requiring a server restart.

#### Scenario: New external session becomes visible without restart
- **WHEN** a new `<sessionId>.jsonl` file is created in a watched project directory while the server is running
- **THEN** the session SHALL be imported and visible in `session.list` within a few seconds

### Requirement: JSONL entries stored as raw_events
The importer SHALL convert each non-sidechain JSONL entry into a raw_event with `direction: 'out'` and store it via `rawEventService.appendEvent`.

#### Scenario: History replay works for imported session
- **WHEN** a client calls `session.get` for an imported external session
- **THEN** the response SHALL include conversation history reconstructed from the imported raw_events

#### Scenario: Sidechain entries are excluded
- **WHEN** a JSONL entry has `isSidechain: true`
- **THEN** that entry SHALL NOT be stored as a raw_event

### Requirement: SessionRecord created from JSONL metadata
The importer SHALL upsert a `SessionRecord` derived from the JSONL file, using the first non-metadata entry's `cwd`, `sessionId`, and `timestamp` fields.

#### Scenario: SessionRecord fields populated correctly
- **WHEN** a JSONL file is imported
- **THEN** the resulting `SessionRecord` SHALL have `id = sessionId`, `cwd = decoded project dir`, `createdAt = timestamp of first entry`, `provider = 'claude'`
