# compose-providers Specification

## Purpose
TBD - created by archiving change provider-flatten. Update Purpose after archive.
## Requirements
### Requirement: composeProviders utility
系統 SHALL 提供 `composeProviders` 函式，接收 Provider 元件陣列，回傳單一包裹元件。

#### Scenario: 巢狀等價
- **GIVEN** Provider 陣列 `[A, B, C]`
- **WHEN** `composeProviders([A, B, C])` 包裹 `<span>child</span>`
- **THEN** DOM 輸出等同 `<A><B><C><span>child</span></C></B></A>`

#### Scenario: 空陣列
- **GIVEN** 空陣列 `[]`
- **WHEN** 包裹 children
- **THEN** 直接渲染 children，不加任何 wrapper

#### Scenario: 單一 Provider
- **GIVEN** 陣列 `[A]`
- **WHEN** 包裹 children
- **THEN** 等同 `<A>{children}</A>`

### Requirement: AppProviders 改用 composeProviders
`App.tsx` 的 `AppProviders` MUST 改用 `composeProviders` 宣告，保持相同的 Provider 順序。

#### Scenario: 所有 context 仍可存取
- **WHEN** App 渲染完成
- **THEN** Workspace 內的所有既有 useContext（Session / Plugin / Project / Navigation / Git / Fs / Openspec / CommandPalette）正常回傳

#### Scenario: 既有測試全部通過
- **WHEN** 重構完成
- **THEN** 所有既有測試通過，tsc clean

