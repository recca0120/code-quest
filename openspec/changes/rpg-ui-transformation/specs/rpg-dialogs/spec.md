## ADDED Requirements

### Requirement: Permission Prompt as Spell Acquisition
The system SHALL render tool permission prompts as a "習得新咒文" animation with an approve/deny blue-frame choice in RPG mode.

#### Scenario: Approve grants permission
- **WHEN** the user selects 許可 on the spell-acquisition dialog
- **THEN** the system SHALL grant permission identical to Classic mode behavior

#### Scenario: Deny blocks the call
- **WHEN** the user selects 拒否
- **THEN** the system SHALL block the tool call and record denial identical to Classic mode

#### Scenario: Classic fallback preserved
- **WHEN** Classic mode is active
- **THEN** the original permission dialog SHALL render unchanged

### Requirement: Plan Mode as War Council
The system SHALL render plan-mode interactions as a DQ party 作戰會議 scene.

#### Scenario: Enter plan mode
- **WHEN** plan mode starts
- **THEN** the system SHALL show party sprites around a council layout and stream the plan content

#### Scenario: Accept plan
- **WHEN** the user confirms the plan
- **THEN** the system SHALL exit the council scene and return to battle

### Requirement: Todo List as Quest Log
The system SHALL render TodoWrite items as a parchment-style クエスト一覧.

#### Scenario: Completed quest chimes
- **WHEN** a todo transitions to completed
- **THEN** a quest-complete SFX SHALL play if audio is enabled and the item SHALL render with a checkmark

### Requirement: Compact as Inn Rest
The system SHALL render `/compact` as an inn-rest animation.

#### Scenario: Inn rest animation on compact
- **WHEN** compaction starts
- **THEN** the system SHALL play a fade-to-night-and-dawn animation and show "ぐっすり休んで HP が全回復した"
- **AND** the HP bar SHALL animate back to full once compaction completes

### Requirement: Error Recovery as Church Revival
The system SHALL surface error recovery / checkpoint restore as a church-revival ritual.

#### Scenario: Restore from checkpoint
- **WHEN** the user triggers a rewind / restore
- **THEN** the system SHALL play a short revival animation and then restore the session state

### Requirement: Auto-Save Indicator
The system SHALL flash an auto-save indicator on each completed exchange in RPG mode.

#### Scenario: Flash on message persist
- **WHEN** a message is persisted
- **THEN** a bottom-right flash SHALL show "ぼうけんのしょ に きろくします" for ≤ 1.5s
