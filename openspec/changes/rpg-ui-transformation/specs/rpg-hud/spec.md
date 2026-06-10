## ADDED Requirements

### Requirement: HP/MP/G/LV HUD
The system SHALL render a DQ-style HUD showing HP, MP, G, and LV in the battle scene.

#### Scenario: HP reflects context remaining
- **WHEN** a session has a known model context window
- **THEN** HP SHALL display `remaining / max` tokens and a bar proportional to remaining context

#### Scenario: HP low warning
- **WHEN** HP falls below 15%
- **THEN** the HP bar SHALL flash red and a compact suggestion SHALL surface

#### Scenario: MP reflects token budget
- **WHEN** the user has set a daily token budget
- **THEN** MP SHALL display `consumed / budget`
- **AND WHEN** no budget is set, MP SHALL display "∞"

#### Scenario: G reflects accumulated cost
- **WHEN** usage data is available
- **THEN** G SHALL display accumulated USD cost for the current session in DQ-style digits

#### Scenario: LV reflects message count
- **WHEN** the session has N user+assistant messages
- **THEN** LV SHALL display a level derived from N (formula documented in impl)

### Requirement: HUD Degradation
The HUD SHALL degrade gracefully when data is unknown.

#### Scenario: Unknown context window
- **WHEN** the model context size is not resolvable
- **THEN** HP SHALL display "???/???" without breaking layout

#### Scenario: Missing cost data
- **WHEN** usage telemetry is unavailable
- **THEN** G SHALL display "--" instead of a numeric value
