## Why

`apps/summoner/src/filesystem/types.ts` is a pure re-export shell — it contains no logic, no transformations, and no additional types. It only re-exports eight types verbatim from `@code-quest/shared`. This indirection adds a layer with no value: consumers must import from summoner's internal path instead of directly from the authoritative shared package where the types live.

## What Changes

Delete `apps/summoner/src/filesystem/types.ts` and update all five consumers to import the types directly from `@code-quest/shared`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

**Filesystem type imports** — The types (`DirectoryEntry`, `FileKind`, `FileResult`, `FilesystemService`, `FsMutationResult`, `ReadFileAbsoluteResult`, `ReadFileResult`, `WriteFileResult`) remain unchanged; only the import path changes from `./types` or `../filesystem/types` to `@code-quest/shared`.

## Impact

- Deletes one file: `apps/summoner/src/filesystem/types.ts`
- Updates five files: `browser.ts`, `index.ts`, `test/fake-filesystem-service.ts`, `openspec/local.ts`, `filesystem/local.ts`
- No runtime behaviour change; types-only edit
- Consumers outside the summoner package (server, web) are unaffected — they already import from `@code-quest/shared` or from summoner's public exports, not from this internal types file
