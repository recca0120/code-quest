## Why

Sessions created outside this app (terminal `claude`, VSCode extension, other instances) are never recorded in the app's session store, making them invisible in the session list and inaccessible for history replay. Conversely, sessions created inside this app cannot be resumed from the terminal or seen by other JSONL-based tools.

The fix is a bidirectional bridge between Claude CLI's native `~/.claude/projects/<cwd>/<sessionId>.jsonl` format and the app's `raw_events` DB. Because JSONL files live on the local machine where `summoner` runs (which may be remote from `server`), the bridge must go through the existing WS protocol.

## What Changes

- Add `packages/jsonl-codec/` — `JsonlReader` and `JsonlWriter` as pure functions shared across packages
- Add `JsonlImporter` in `summoner`: scans local `~/.claude/projects/`, reads JSONL, sends raw_events to server via WS
- Add `JsonlExporter` in `summoner`: receives raw_events from server via WS, writes JSONL to local filesystem
- Add WS handlers in `server`: receives imported raw_events → writes to DB; sends export requests → triggers summoner

## Capabilities

### New Capabilities

- `jsonl-session-import`: Summoner scans local JSONL files and imports external sessions into the app via WS, enabling terminal/VSCode sessions to appear in the session list with full history replay
- `jsonl-session-export`: Server notifies summoner to export a session's raw_events to JSONL, enabling `claude --resume` and other JSONL tools to see app-created sessions

### Modified Capabilities

## Impact

- `packages/jsonl-codec/` — 新增 package（`JsonlReader`、`JsonlWriter`）
- `apps/summoner/src/jsonl/` — `JsonlImporter`、`JsonlExporter`
- `apps/server/src/socket/handlers/jsonl/` — WS handlers（import、export）
- `apps/server/src/container.ts` — wiring
- No frontend changes required
- No DB schema changes
