# pane-codecs Specification

## Purpose

PaneContent ⇄ PersistedPaneContent 的純函式序列化層（`contexts/pane-codecs.ts`，零 React import）。TabContext 的 layout save/rehydrate 唯一出入口；echo guard 與跨裝置還原正確性的基礎。

## ADDED Requirements

### Requirement: Codec round-trip is identity

For every `PaneContent` variant, `serializeContent(deserializeContent(x))` SHALL equal `x`（structural equality，以 wire shape 為基準）。`deserializeContent` SHALL be lossless：session 的 channelId/cwd 無條件保留，不做存活判斷、不改寫 content。Session codec SHALL map `channelId`（wire）⇄ `sessionId`（client）作為唯一的欄位改名。

#### Scenario: random tree round-trip（property test）

- **WHEN** an arbitrary valid pane tree（隨機深度/方向/content 組合）is serialized then deserialized
- **THEN** the result SHALL be structurally identical to the input

#### Scenario: dead channelId survives round-trip

- **WHEN** a session content with a channelId not present in any live session is deserialized
- **THEN** the channelId and cwd SHALL be preserved as-is（判死是 render 層的事）

### Requirement: Deserialize is permissive

`deserializeContent` SHALL NOT validate cwd existence, worktree membership, or session liveness. Validation and degradation SHALL happen at render time.

#### Scenario: deleted worktree cwd passes through

- **WHEN** a git content whose `target.cwd` points to a removed worktree is deserialized
- **THEN** deserialization SHALL succeed and preserve the cwd（render 層由 WorktreeSwitcher 顯示警示態）

### Requirement: Exhaustive mapped-type registries

Serializers and deserializers SHALL be declared as mapped types over `PaneContent['type']`／`PersistedPaneContent['type']`, with a static assertion that the two key unions are equal. Dispatch SHALL use generic indexed access（零 `as` cast）。

#### Scenario: missing codec fails compilation

- **WHEN** a new content variant is added without its serializer/deserializer entry
- **THEN** TypeScript compilation SHALL fail

#### Scenario: client/wire union drift fails compilation

- **WHEN** a type key exists in `PaneContent` but not `PersistedPaneContent`（or vice versa）
- **THEN** the `AssertEqual` static assertion SHALL fail compilation

### Requirement: Ratio precision and clamping

`serializeNode` SHALL round split ratios to 4 decimal places. `deserializeNode` SHALL clamp ratios to `[0.05, 0.95]`；invalid values（NaN、負數、>1）SHALL clamp to the nearest bound.

#### Scenario: drag-produced float is rounded

- **WHEN** a split with ratio `0.6342819…` is serialized
- **THEN** the persisted ratio SHALL be `0.6343`，且再次 round-trip 不再變動（echo guard 字串比對穩定）

#### Scenario: corrupt ratio cannot hide a pane

- **WHEN** a persisted split with ratio `0`（或 NaN）is deserialized
- **THEN** the ratio SHALL be clamped to `0.05`，兩側 pane 皆可見

### Requirement: Serialization requires no external context

`serializeContent` / `serializeNode` SHALL be pure functions of the tree（無 tabs map、無 ctx 參數）。Session 的 cwd 由綁定動作（`setSessionInPane(paneId, sessionId, cwd)` 與 `splitPaneAndAssign(direction, sessionId, cwd)`）寫入 content，序列化時直接讀取。

#### Scenario: serialize immediately after bind

- **WHEN** a session is bound to a pane and serialization runs before any session meta update
- **THEN** the persisted session leaf SHALL carry the cwd provided at bind time（不依賴 tabs map 的載入時序）
