## ADDED Requirements

### Requirement: Subagent Party Sprites
The system SHALL render active subagents as party-member sprites alongside the main slime in battle scene.

#### Scenario: Subagent appears on delegation
- **WHEN** a subagent is delegated to via Task/Agent tool
- **THEN** a sprite representing that subagent SHALL appear in the party line and perform an action animation

#### Scenario: Subagent leaves on completion
- **WHEN** the subagent reports completion
- **THEN** its sprite SHALL fade out over ≤ 500ms

### Requirement: MCP Contract Beasts
The system SHALL render configured MCP servers as contract-beast icons visible in battle scene.

#### Scenario: Render MCP icons
- **WHEN** one or more MCP servers are configured for the session
- **THEN** each SHALL render as an icon in a dedicated contract slot with a tooltip showing the MCP name

#### Scenario: MCP unavailable
- **WHEN** an MCP server is disconnected
- **THEN** its icon SHALL render greyed out with a broken-chain overlay

### Requirement: CLI Provider as Race Selector
The system SHALL visually represent the active CLI provider (claude / gemini / ...) as the protagonist "race".

#### Scenario: Provider swap updates sprite palette
- **WHEN** the user switches CLI provider
- **THEN** the main sprite SHALL update its palette/variant without page reload
