## 1. Update consumers

- [x] 1.1 Update `apps/summoner/src/browser.ts` — import `FilesystemService` from `@code-quest/shared` instead of `./filesystem/types`
- [x] 1.2 Update `apps/summoner/src/index.ts` — import `FilesystemService` from `@code-quest/shared` instead of `./filesystem/types`
- [x] 1.3 Update `apps/summoner/src/test/fake-filesystem-service.ts` — import all used types from `@code-quest/shared`
- [x] 1.4 Update `apps/summoner/src/openspec/local.ts` — import `FilesystemService` from `@code-quest/shared`
- [x] 1.5 Update `apps/summoner/src/filesystem/local.ts` — import types from `@code-quest/shared`

## 2. Delete the re-export shell

- [x] 2.1 Delete `apps/summoner/src/filesystem/types.ts`
- [x] 2.2 Verify no remaining references: `grep -r "filesystem/types" apps/summoner/src`
