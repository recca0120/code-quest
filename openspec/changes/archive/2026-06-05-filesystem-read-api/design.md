## Context

The `Filesystem` interface currently exposes two overlapping methods:

- `readFile(cwd: string, filePath: string): Promise<ReadFileResult>` — resolves a relative path within a cwd, returns `{ content }` or `{ error }`
- `readFileAbsolute(absolutePath: string): Promise<ReadFileAbsoluteResult>` — reads by absolute path, returns `{ content, contentType, encoding }` or `{ error }`

The two return types are incompatible and the split forces callers (e.g. `FilesPane`) to know which method to use. More critically, `readFileAbsolute` reads the entire file into memory before returning, causing RPC transport timeouts (30 s ceiling) on large files.

## Goals / Non-Goals

**Goals:**
- Single `readFile(file, cwd?)` that handles both absolute and relative paths
- Unified `ReadFileResult` with `contentType`, `encoding`, and `tooLarge` variant
- `maxBytes` option that stats the file first and returns `{ tooLarge: true }` without reading content
- All implementations updated (Local, Remote, RootGuard, Fake)
- Server handler and schemas updated
- Call site in `FilesPane.loadPreview` updated with `maxBytes`

**Non-Goals:**
- Streaming (`readStream`) — deferred
- Pagination or chunked reads
- Changes to `readLines`

## Decisions

### D1: Signature `readFile(file, cwd?)`

Old `readFile(cwd, filePath)` put cwd first; the new signature puts the target first, matching POSIX tool conventions (`cat <file>`) and making the cwd optional. When `cwd` is omitted, `file` is treated as absolute. When `cwd` is provided, `file` is resolved relative to it (path traversal guard still applies).

Alternatives considered:
- Keep two methods — rejected; forces callers to branch on knowledge of path type
- `readFile(opts: { file, cwd?, maxBytes? })` — rejected; options bag is overkill for 2 positional params and an option

### D2: Unified `ReadFileResult`

Old `ReadFileResult = { content } | { error }` lacked `contentType`/`encoding`. New type aligns with `ReadFileAbsoluteResult` and adds `tooLarge`:

```ts
export type ReadFileResult =
  | { content: string; contentType: string; encoding: 'utf-8' | 'base64' }
  | { tooLarge: true }
  | { error: string };
```

`ReadFileAbsoluteResult` is removed; all consumers use `ReadFileResult`.

### D3: `maxBytes` via `stat` before read

`readFile` accepts an optional `{ maxBytes?: number }` second-positional or options parameter. Implementation: `stat(path)` first; if `size > maxBytes` return `{ tooLarge: true }` without reading. Cost is one extra syscall per call — acceptable vs. OOM/timeout on large files.

### D4: Remove `readFileAbsolute` from the interface

All existing usages of `readFileAbsolute` (mutations tests, server handler) are migrated to `readFile(absolutePath)`. The method is deleted from the interface and all implementations.

### D5: Server schema stays flat

`fsReadResponseSchema` (Zod) is updated to match `ReadFileResult`. The RPC method name stays `fs:read`; only the response shape changes.

## Risks / Trade-offs

- [Breaking change on interface] All implementations must be updated atomically — TypeScript will catch mismatches at compile time.
- [Remote implementation] `RemoteFilesystem.readFile` must be updated to pass `cwd` as part of the RPC payload; the server handler must accept optional `cwd`.
- [Fake filesystem] `FakeFilesystem.readFile` must be updated in test-kit; any test that calls the old two-arg `readFile(cwd, file)` will need to flip argument order to `readFile(file, cwd)`.

## Migration Plan

1. Update `Filesystem` interface and types (`types.ts`)
2. Update `LocalFilesystem` — implement new signature, remove `readFileAbsolute`
3. Update `RemoteFilesystem` — pass `{ file, cwd?, maxBytes? }` to RPC
4. Update `RootGuardFilesystem` — delegate to inner with new signature
5. Update `FakeFilesystem` in test-kit
6. Update schemas (`fs.ts`, `protocol-schemas.ts`)
7. Update server handler (`fs:read`)
8. Update `FilesPane.loadPreview` call site
9. Update / migrate all tests

## Open Questions

- None — streaming deferred, decisions are clear.
