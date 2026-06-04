## ADDED Requirements

### Requirement: Messages per channel are capped at a rolling window
The in-memory message store for each channel SHALL enforce a maximum of 500 messages. When a new batch of messages would exceed this cap, the oldest messages are dropped so that only the most recent 500 remain. The cap applies after each `applyHistoryBatch` and after each incremental append during streaming.

#### Scenario: History replay within cap
- **WHEN** `session:history` delivers 300 messages to a channel with 0 existing messages
- **THEN** all 300 messages are stored and the array length is 300

#### Scenario: History replay exceeds cap
- **WHEN** `session:history` delivers 600 messages to a channel with 0 existing messages
- **THEN** only the most recent 500 messages are stored and the array length is 500

#### Scenario: Incremental streaming stays within cap
- **WHEN** a channel already has 500 messages and one more assistant message is appended
- **THEN** the oldest message is dropped and the array length remains 500

### Requirement: historyMessages (compose input history) is capped
The `historyMessages` array used for compose input up-arrow navigation SHALL be capped at 100 entries. Older entries are dropped when the cap is exceeded.

#### Scenario: Input history within cap
- **WHEN** fewer than 100 messages have been sent in a session
- **THEN** all sent messages are available for up-arrow recall

#### Scenario: Input history exceeds cap
- **WHEN** more than 100 messages have been sent
- **THEN** only the 100 most recent are retained for recall

### Requirement: Feature handlers are registered once per channel mount
`buildMessagesActions` SHALL register feature handlers exactly once when a channel mounts, and unregister them when the channel unmounts. Re-renders that rebuild action objects MUST NOT cause duplicate handler registrations.

#### Scenario: Initial mount registers handlers
- **WHEN** a `ChannelMessagesProvider` mounts for a given channelId
- **THEN** each feature handler is registered exactly once in the registry

#### Scenario: State update does not re-register handlers
- **WHEN** channel state updates (e.g. new message arrives) causing a re-render
- **THEN** the number of registered handlers remains unchanged

#### Scenario: Unmount cleans up handlers
- **WHEN** a `ChannelMessagesProvider` unmounts
- **THEN** all feature handlers for that channel are removed from the registry
