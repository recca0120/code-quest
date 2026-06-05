## Why

`readFileAbsolute(absolutePath)` reads entire files into memory before returning, causing RPC transport timeouts (30 s) for large files. The method name is also misleading — two separate methods (`readFile(cwd, filePath)` and `readFileAbsolute(absolutePath)`) serve overlapping purposes with inconsistent signatures.

## What Changes

- **BREAKING** Rename and unify `readFileAbsolute(absolutePath)` + `readFile(cwd, filePath)` into a single `readFile(file: string, cwd?: string)` on the `Filesystem` interface
- New `readFile` resolves `file` relative to `cwd` when `cwd` is provided, or treats it as an absolute path when `cwd` is omitted
- Add `maxBytes?: number` option to `readFile` — returns `{ tooLarge: true }` when the file exceeds the limit before reading contents
- `ReadFileResult` unified with `ReadFileAbsoluteResult`: result now carries `contentType`, `encoding`, and the `tooLarge` variant
- Update all implementations: `LocalFilesystem`, `RemoteFilesystem`, `RootGuardFilesystem`, `FakeFilesystem`
- Update server RPC handler (`fs:read`) and request/response schemas
- Update `loadPreview` in `FilesPane` to call new signature with `maxBytes`
- Remove old `readFileAbsolute` tests; add new `readFile` tests covering unified signature

## Capabilities

### New Capabilities
- `filesystem-read-file`: Unified `readFile(file, cwd?)` API with `maxBytes` guard, replacing both `readFile` and `readFileAbsolute`

### Modified Capabilities
<!-- No existing spec-level behavior changes beyond the new unified method -->

## Impact

- `packages/filesystem/src/types.ts` — `Filesystem` interface, `ReadFileResult`, `ReadFileAbsoluteResult`
- `packages/filesystem/src/local-filesystem.ts`
- `packages/filesystem/src/remote-filesystem.ts`
- `packages/filesystem/src/root-guard-filesystem.ts`
- `packages/test-kit/src/fake-filesystem.ts`
- `packages/schemas/src/socket/fs.ts` + `packages/schemas/src/adapter/remote/protocol-schemas.ts`
- `apps/web/src/components/files/FilesPane.tsx` (call site update)
- All `readFileAbsolute` tests in `local-filesystem.test.ts` and `root-guard-filesystem.test.ts`
