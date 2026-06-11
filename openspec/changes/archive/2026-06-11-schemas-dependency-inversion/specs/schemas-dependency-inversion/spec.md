## ADDED Requirements

### Requirement: Git domain types live in git package
`packages/git` SHALL define all git operation result types (`GitStatusResult`, `GitLogResult`, `GitDiffResult`, `GitCommitResult`, `GitAddResult`, `GitPullResult`, `GitPushResult`, `GitFetchResult`, `GitDiscardFileResult`, `WorktreeInfo`) as TypeScript types in `src/types.ts`.

#### Scenario: Git result types importable from @code-quest/git
- **WHEN** a consumer imports `GitStatusResult` from `@code-quest/git`
- **THEN** the type resolves correctly without importing from `@code-quest/schemas`

#### Scenario: Git package does not import result types from schemas
- **WHEN** building `packages/git`
- **THEN** no import of `GitStatusResult`, `WorktreeInfo` or other domain result types from `@code-quest/schemas` exists in the source

### Requirement: Filesystem domain types live in filesystem package
`packages/filesystem` SHALL define `FsMutationResult` as a TypeScript type in `src/types.ts`.

#### Scenario: FsMutationResult importable from @code-quest/filesystem
- **WHEN** a consumer imports `FsMutationResult` from `@code-quest/filesystem`
- **THEN** the type resolves correctly without importing from `@code-quest/schemas`

#### Scenario: Filesystem package does not import FsMutationResult from schemas
- **WHEN** building `packages/filesystem`
- **THEN** no import of `FsMutationResult` from `@code-quest/schemas` exists in the source

### Requirement: Schemas re-exports domain types for backward compatibility
`packages/schemas` SHALL re-export all moved types from their new home packages so existing consumers need no import path changes.

#### Scenario: Existing consumers continue to work
- **WHEN** any package imports `GitStatusResult` or `FsMutationResult` from `@code-quest/schemas`
- **THEN** the import resolves correctly (via re-export)

#### Scenario: Schemas package depends on git and filesystem
- **WHEN** inspecting `packages/schemas/package.json`
- **THEN** `@code-quest/git` and `@code-quest/filesystem` appear in dependencies
