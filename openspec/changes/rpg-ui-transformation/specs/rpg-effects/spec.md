## ADDED Requirements

### Requirement: Tool Call Animations
The system SHALL play tool-specific animations during tool calls in RPG mode.

#### Scenario: Bash shows sword slash
- **WHEN** a Bash tool call starts
- **THEN** a sword-slash animation SHALL play over the target area

#### Scenario: Read shows investigation
- **WHEN** a Read tool call starts
- **THEN** an investigate/magnifier animation SHALL play

#### Scenario: Write/Edit shows magic circle
- **WHEN** a Write or Edit tool call starts
- **THEN** a magic-circle-writing animation SHALL play

#### Scenario: WebFetch shows summon
- **WHEN** a WebFetch/WebSearch tool call starts
- **THEN** a summon animation SHALL play

#### Scenario: Parallel tool calls
- **WHEN** multiple tool calls run in parallel
- **THEN** animations SHALL render concurrently without overlap-induced jitter

### Requirement: Status Ailments
The system SHALL render ailment effects for error, rate limit, and context-full states.

#### Scenario: Poison on error
- **WHEN** an error event occurs
- **THEN** the slime SHALL flash green (どく)

#### Scenario: Sleep on rate limit
- **WHEN** a rate-limit condition is detected
- **THEN** the slime SHALL render a sleeping animation (ねむり) with "Zzz" overlay

#### Scenario: Confusion on context near full
- **WHEN** context remaining < 5%
- **THEN** the slime SHALL render a confusion swirl (こんらん)

### Requirement: Audio System
The system SHALL provide CC0 chiptune SFX with a singleton audio manager.

#### Scenario: First-run opt-in
- **WHEN** the user first enters RPG mode
- **THEN** the system SHALL prompt once whether to enable audio and persist the choice

#### Scenario: Menu / confirm / damage / victory cues
- **WHEN** a corresponding UI event fires
- **THEN** the system SHALL play the matching SFX if audio is enabled

#### Scenario: Classic mode loads no audio
- **WHEN** Classic mode is active
- **THEN** audio assets SHALL NOT be requested from the network

### Requirement: Transition Budget
All RPG transitions SHALL complete within 500ms.

#### Scenario: Battle entry transition
- **WHEN** entering the battle scene
- **THEN** the transition SHALL complete in ≤ 500ms

#### Scenario: Respect reduced-motion
- **WHEN** `prefers-reduced-motion: reduce` is set
- **THEN** transitions SHALL be skipped or reduced to a simple fade
