## MODIFIED Requirements

### Requirement: input_json_delta patches correct tool_use via streamingToolUseId
`onInputJsonChunk` uses `streamingToolUseId` from ChannelState to find the target message, not "last tool_use". When a session closes or is aborted before `message:assistant` is received, `partialInput` on all in-progress tool_use blocks SHALL be cleared to prevent orphaned string accumulation in memory.

#### Scenario: Chunks arrive for streaming tool_use
- **WHEN** `stream:input_json_delta` arrives while `streamingToolUseId` is set
- **THEN** `partialInput` is appended to the message matching `streamingToolUseId`

#### Scenario: partialInput cleared on normal message:assistant completion
- **WHEN** `message:assistant` arrives with a tool_use block matching `streamingToolUseId`
- **THEN** `partialInput` is cleared and `input` is set to the complete parsed value

#### Scenario: partialInput cleared on session abort
- **WHEN** a session is aborted (user clicks Stop) before `message:assistant` is received
- **THEN** `partialInput` is set to `undefined` on all tool_use blocks in the current turn

#### Scenario: partialInput cleared on unexpected session close
- **WHEN** the session closes unexpectedly (network drop, server crash) while a tool_use is streaming
- **THEN** `partialInput` is set to `undefined` on all in-progress tool_use blocks
