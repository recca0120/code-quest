# pane-tree Specification

## Purpose

Pane 樹的 named component 渲染層：PaneTree（遞迴）→ PaneSplit（方向/比例）→ PaneLeaf（focus/toolbar 統一組裝）→ named pane components（SessionPane / GitPane / FilesPane / OpenspecPane / WorktreesPane）。取代 SplitPane + PaneLeafContent if/else dispatch。

## ADDED Requirements

### Requirement: PaneLeaf renders unified Pane shell with exhaustive dispatch

`PaneLeaf` SHALL render the `Pane` compound (`Pane.Toolbar` with common props + body) for every leaf node, and SHALL dispatch the body via an exhaustive switch over `PaneContent['type']`（`default: content satisfies never`）。Named pane components SHALL NOT render their own `Pane.Toolbar`; they only contribute a `ToolbarTools` slot and a `Body`.

#### Scenario: every content type gets a toolbar

- **WHEN** a leaf of any content type（session/git/files/openspec/worktrees）is rendered
- **THEN** exactly one `data-testid="pane-header"` SHALL be visible with split/close buttons（worktrees 不再例外）

#### Scenario: tool pane contributes WorktreeSwitcher via slot

- **WHEN** a git/files/openspec leaf is rendered
- **THEN** the toolbar SHALL contain a `WorktreeSwitcher`（aria-label="worktree switcher"）alongside the default controls

#### Scenario: adding a new content type without a view fails compilation

- **WHEN** a new variant is added to `PaneContent` without a corresponding switch case
- **THEN** TypeScript compilation SHALL fail（`satisfies never` 窮舉保護）

### Requirement: PaneLeaf provides stable identity and swap wiring

`PaneLeaf` SHALL render with `key={node.id}` and SHALL pass `onSwap: (sourceId) => swapPane(sourceId, node.id)` to `Pane.Toolbar`.

#### Scenario: DnD swap between two panes

- **WHEN** user drags pane A's header and drops it on pane B's header
- **THEN** the two leaves' contents SHALL be exchanged（leaf ids 不變）

### Requirement: Zoom and mobile solo rendering happens at PaneSplit

`PaneSplit` SHALL determine solo target（`zoomedPaneId ?? (isMobile ? focusedPaneId : null)`）。When the target is in exactly one subtree, `PaneSplit` SHALL render only that subtree without the percentage wrapper and without `PaneDivider`.

#### Scenario: zoomed pane fills the root

- **WHEN** a pane inside a 40%-wide split is zoomed
- **THEN** the zoomed pane SHALL occupy the full `split-pane-root` area（無 percentage wrapper、無 divider 渲染——不是 hidden 佔位）

#### Scenario: mobile shows only the focused pane

- **WHEN** mobile mode is active and a pane is focused
- **THEN** only the focused pane SHALL be rendered, occupying the full area

### Requirement: SessionPane resolves liveness at render time

`SessionPane` SHALL render `TabContent` when `tabs[content.sessionId]` exists, and SHALL render an empty-pane state with a restore hint（「上次: {project} ⎇ {branch}」由 `content.cwd` 即時反查，不持久化 branch）when meta is absent. The transition in both directions SHALL be automatic（無需重建 leaf）。

#### Scenario: session arrives after layout（self-heal）

- **WHEN** a session leaf is rendered before its session meta exists, and the meta later appears（sessions 晚到）
- **THEN** the same leaf SHALL switch from empty-pane to `TabContent` automatically

#### Scenario: session dies while bound

- **WHEN** `session:closed`/`session:dead` removes the bound session's meta
- **THEN** the same leaf SHALL degrade to empty-pane with the cwd restore hint（content 不變，僅 render 分支切換）

#### Scenario: restored leaf with live channel rebinds without spawning

- **WHEN** a layout containing `channelId` of a still-alive session is rehydrated
- **THEN** the pane SHALL mount `TabContent` in resume mode（session:join，不 spawn 新 process）

### Requirement: Empty-state gate must not hide tool-pane layouts

The workspace SHALL render `PaneTree` whenever the layout is not the default empty state（單一 workspace tab 且 paneRoot 為單一 empty session leaf），regardless of whether any session tabs exist.

#### Scenario: pure tool-pane layout after server restart

- **WHEN** a restored layout contains only git/worktrees panes and zero live sessions
- **THEN** those panes SHALL be visible（不被全域 EmptyState gate 吃掉）

### Requirement: TabContent remains the shared mount unit

`TabContent`（ChannelProvider wrapper）SHALL remain a standalone component shared by panes and `SessionPool`; a channelId SHALL be mounted at most once across panes and pools.

#### Scenario: unassigned live session stays mounted in pool

- **WHEN** a live session is not assigned to any pane
- **THEN** its `TabContent` SHALL be mounted inside `SessionPool`（hidden），且全 app 僅此一份
