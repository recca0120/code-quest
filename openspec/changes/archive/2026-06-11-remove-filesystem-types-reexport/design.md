## Context

`apps/summoner/src/filesystem/types.ts` exists solely to re-export eight types from `@code-quest/shared`. The types themselves have always lived in shared; this file adds a redundant hop. Five files inside `apps/summoner` import from it.

## Goals / Non-Goals

**Goals:**
- Delete the re-export shell
- All five consumers import directly from `@code-quest/shared`

**Non-Goals:**
- Moving or renaming any types
- Changing any type definitions
- Touching consumers outside `apps/summoner`

## Decisions

**Direct import from `@code-quest/shared`** — All eight types are already exported from shared's public surface. No new exports need to be added.

**Single PR, no intermediate state** — The file and its five consumers are updated atomically. The deleted file is never in a half-removed state because TypeScript will error immediately if any import is broken.

## Risks / Trade-offs

No runtime risk — this is a types-only change. The only risk is missing a consumer; mitigated by running `grep -r "filesystem/types"` to confirm zero references remain after the edit.
