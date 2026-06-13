## ADDED Requirements

### Requirement: composeProviders utility
建立 `composeProviders` 函式，接收 Provider 元件陣列，回傳單一包裹元件。

#### Scenario: 巢狀等價
- **GIVEN** 一組 Provider 陣列 `[A, B, C]`
- **WHEN** `composeProviders([A, B, C])` 包裹 children
- **THEN** DOM 輸出等同 `<A><B><C>{children}</C></B></A>`

#### Scenario: 空陣列
- **GIVEN** 空陣列 `[]`
- **WHEN** 包裹 children
- **THEN** 直接渲染 children，不加任何 wrapper

### Requirement: AppProviders 改用 composeProviders
`App.tsx` 的 `AppProviders` 改用 `composeProviders` 宣告。

#### Scenario: 所有 context 仍可存取
- **WHEN** App 渲染完成
- **THEN** 所有既有 context（Session / Plugin / Project / Navigation / Git / Fs / Openspec / CommandPalette）在 Workspace 內皆可正常 useContext

#### Scenario: 行為不變
- **WHEN** 重構前後
- **THEN** 所有既有測試通過，無新增失敗
