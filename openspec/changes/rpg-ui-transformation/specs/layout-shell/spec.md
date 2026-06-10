## ADDED Requirements

### Requirement: Shell Mode Selection
The layout shell SHALL select the presentation shell (Classic vs RPG) based on the active app mode without duplicating routes or data layer.

#### Scenario: Classic mode renders existing layout
- **WHEN** `appMode=classic`
- **THEN** the shell SHALL render the existing Desktop / Tablet / Mobile layouts unchanged

#### Scenario: RPG mode renders RPG shell
- **WHEN** `appMode=rpg`
- **THEN** the shell SHALL render the RPG shell (cartridge list / battle scene / etc.) and SHALL NOT render ActivityBar + Sidebar + EditorArea three-column layout

#### Scenario: Route data stays shared
- **WHEN** switching between modes during a session
- **THEN** the active project / session / socket state SHALL remain intact

### Requirement: Mode Toggle Entry Point
The shell SHALL expose a discoverable mode toggle in settings and in an always-reachable menu.

#### Scenario: Toggle accessible in Classic mode
- **WHEN** a Classic-mode user opens settings
- **THEN** an "App Mode" toggle SHALL appear with options Classic / RPG

#### Scenario: Toggle accessible in RPG mode
- **WHEN** an RPG-mode user opens the せつめいしょ (settings) menu
- **THEN** the same toggle SHALL be available, with current mode reflected

### Requirement: RPG Assets Lazy Loading
RPG-only assets (sprites, audio, pixel fonts) SHALL NOT load in Classic mode.

#### Scenario: Classic mode network profile
- **WHEN** `appMode=classic` and the user navigates the app
- **THEN** no request SHALL be made to `/rpg/` assets (sprites, audio, pixel fonts)

#### Scenario: RPG mode lazy-loads on entry
- **WHEN** the user switches to RPG mode
- **THEN** RPG assets SHALL load on demand via dynamic import
