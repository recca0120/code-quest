## ADDED Requirements

### Requirement: App Mode Toggle
The system SHALL provide a toggle between Classic and RPG UI modes that persists across sessions.

#### Scenario: Default mode is Classic
- **WHEN** a first-time user loads the app
- **THEN** the system SHALL render Classic mode and set `appMode=classic` in localStorage

#### Scenario: Switch to RPG mode
- **WHEN** the user toggles mode to RPG from settings
- **THEN** the system SHALL lazy-load RPG assets and render the RPG shell
- **AND** persist `appMode=rpg` in localStorage

#### Scenario: RPG mode persists across reload
- **WHEN** a user with `appMode=rpg` reloads
- **THEN** the system SHALL restore RPG mode without flashing Classic UI

### Requirement: Cartridge Project List
The system SHALL display the project list as SFC-style cartridges in RPG mode.

#### Scenario: Render project cartridges
- **WHEN** RPG mode is active and projects exist
- **THEN** each project SHALL render as a cartridge with the project name on a label sticker

#### Scenario: Select a cartridge
- **WHEN** a user clicks or presses Enter on a cartridge
- **THEN** the system SHALL navigate to the DQ blue-frame menu for that project

### Requirement: DQ Blue-Frame Menu Component
The system SHALL provide a reusable DQ-style blue-frame menu supporting keyboard and mouse navigation.

#### Scenario: Keyboard navigation
- **WHEN** the menu is focused
- **THEN** ArrowUp/ArrowDown SHALL move the cursor
- **AND** Enter SHALL confirm, Esc SHALL cancel

#### Scenario: Number shortcuts
- **WHEN** the user presses 1–4 with the menu focused
- **THEN** the system SHALL activate the corresponding item

### Requirement: Project Entry Menu
On selecting a cartridge, the system SHALL show a DQ menu with New Adventure / Load Record / Settings.

#### Scenario: New adventure starts fresh session
- **WHEN** the user selects "New Adventure"
- **THEN** the system SHALL create a new session and enter the battle scene

#### Scenario: Load record opens session picker
- **WHEN** the user selects "Load Record"
- **THEN** the system SHALL show the 3-slot session picker

### Requirement: Session Picker (Adventure Log)
The system SHALL render session selection as a DQ 3-slot "ぼうけんのしょ" style list with pagination.

#### Scenario: Show three slots per page
- **WHEN** sessions exist
- **THEN** the picker SHALL render up to 3 slots per page with session label and last-modified time

#### Scenario: Empty slot
- **WHEN** fewer than 3 sessions exist
- **THEN** remaining slots SHALL render as "（つづきから はじめる）" empty placeholder

### Requirement: Accessibility of RPG Shell
RPG shell SHALL respect `prefers-reduced-motion` and provide a text-size fallback.

#### Scenario: Reduced motion
- **WHEN** `prefers-reduced-motion: reduce` is set
- **THEN** the system SHALL disable non-essential animations and transitions

#### Scenario: Minimum effective font size
- **WHEN** rendering pixel-font text in RPG mode
- **THEN** the effective size SHALL be ≥ 14px
