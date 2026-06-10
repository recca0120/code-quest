## ADDED Requirements

### Requirement: i18n Resource Structure
The system SHALL externalize all RPG mode user-facing text into locale resource files.

#### Scenario: Locale files live under rpg/i18n
- **WHEN** developers add RPG text
- **THEN** strings SHALL be defined in `packages/client/src/rpg/i18n/<locale>.ts`, not hard-coded in components

#### Scenario: Keys use Japanese-origin identifiers
- **WHEN** defining a new i18n key
- **THEN** the key SHALL use the Japanese-origin term (e.g. `menu.battle`, `status.doku`) with an inline comment mapping to the DQ term

### Requirement: useRpgText Hook
The system SHALL provide a `useRpgText(key)` hook that returns the localized string for the active locale.

#### Scenario: Fallback to zh-TW
- **WHEN** the active locale is missing a key
- **THEN** the hook SHALL fall back to `zh-TW` and log a dev warning

#### Scenario: Missing key in all locales
- **WHEN** a key is missing in every locale
- **THEN** the hook SHALL return the key string itself (not throw)

### Requirement: Initial Locale Set
v1 SHALL ship with `zh-TW` as the default locale and reserve `ja` and `en` stubs.

#### Scenario: zh-TW is complete
- **WHEN** RPG mode is used in v1
- **THEN** all defined keys SHALL have zh-TW values

#### Scenario: ja / en exist as stubs
- **WHEN** reviewing locale files
- **THEN** `ja.ts` and `en.ts` SHALL exist with the same key structure (values may be empty placeholders)
