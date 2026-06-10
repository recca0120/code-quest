## ADDED Requirements

### Requirement: Battle Scene Layout
The system SHALL render the chat view as a DQ-style battle scene in RPG mode, containing a slime sprite area, a bottom command menu, and a collapsible battle log panel.

#### Scenario: Scene composition
- **WHEN** RPG mode is active and a session is loaded
- **THEN** the system SHALL render (a) a centered-upper sprite stage, (b) a bottom DQ blue-frame command menu, and (c) a right-side collapsible "戰鬥記錄" panel

#### Scenario: Transition into battle
- **WHEN** entering battle scene
- **THEN** the system SHALL play a circle-shrink black-out transition ≤ 500ms

### Requirement: Slime Sprite State Machine
The system SHALL drive the slime sprite through visual states mapped from session events.

#### Scenario: Idle when no in-flight request
- **WHEN** no request is active
- **THEN** the sprite SHALL render the idle animation

#### Scenario: Thinking state
- **WHEN** a thinking block is streaming
- **THEN** the sprite SHALL render a chanting glow animation

#### Scenario: Tool-use state
- **WHEN** a tool call is in progress
- **THEN** the sprite SHALL render the corresponding tool animation (attack/investigate/write/summon)

#### Scenario: Error state
- **WHEN** the session reports an error
- **THEN** the sprite SHALL flash red briefly

#### Scenario: Done state
- **WHEN** a response completes successfully
- **THEN** the sprite SHALL render a satisfied pose momentarily before returning to idle

### Requirement: Bottom Command Menu
The bottom menu SHALL expose 戰鬥 / 魔法 / 道具 / 作戰 / 逃跑 commands.

#### Scenario: Default focus is 戰鬥
- **WHEN** the battle scene mounts
- **THEN** the focus SHALL be on 戰鬥 with the prompt textarea active
- **AND** Enter SHALL submit the prompt

#### Scenario: Command opens submenu
- **WHEN** 魔法 / 道具 / 作戰 is activated
- **THEN** the system SHALL open the corresponding submenu (skills / worktree / system prompt)

#### Scenario: 逃跑 aborts
- **WHEN** 逃跑 is activated during an in-flight request
- **THEN** the system SHALL abort the current stream and display "しかし まわりこまれてしまった！" on failure

### Requirement: Prompt Input Preserves Usability
The 戰鬥 command's input SHALL remain a standard multiline textarea with only visual DQ styling.

#### Scenario: Multiline input
- **WHEN** the user presses Shift+Enter
- **THEN** a newline SHALL be inserted without submitting

#### Scenario: Code block copy
- **WHEN** the user copies from a code block in the battle log
- **THEN** copy behavior SHALL be identical to Classic mode

### Requirement: Collapsible Battle Log
The battle log panel SHALL show MessageList content with DQ typewriter streaming and be collapsible.

#### Scenario: Collapse / expand
- **WHEN** the user toggles the panel
- **THEN** width SHALL animate ≤ 250ms and preserve scroll position on re-expand

#### Scenario: Auto-scroll behavior matches Classic
- **WHEN** a new message streams in
- **THEN** auto-scroll SHALL behave identically to Classic mode (`auto-scroll` spec)
