## 1. Types & Interface

- [ ] 1.1 Rewrite `ReadFileResult` in `types.ts` to `{ content, contentType, encoding } | { tooLarge: true } | { error }`
- [ ] 1.2 Remove `ReadFileAbsoluteResult` from `types.ts`
- [ ] 1.3 Update `Filesystem` interface: replace `readFileAbsolute` + old `readFile` with `readFile(file, cwd?, opts?)`
- [ ] 1.4 Export `ReadFileResult` from `packages/filesystem/src/index.ts` (remove `ReadFileAbsoluteResult`)

## 2. Red Tests (TDD)

- [ ] 2.1 Rewrite `readFileAbsolute` describe block in `local-filesystem.test.ts` → `readFile` with new signature
- [ ] 2.2 Add scenario: returns `{ tooLarge: true }` when size > maxBytes
- [ ] 2.3 Add scenario: reads normally when size ≤ maxBytes
- [ ] 2.4 Update existing `readFile` describe block for new argument order `(file, cwd?)`
- [ ] 2.5 Update `root-guard-filesystem.test.ts` assertions for new result shape

## 3. LocalFilesystem

- [ ] 3.1 Remove `readFileAbsolute` method
- [ ] 3.2 Implement new `readFile(file, cwd?, opts?)`: resolve path (absolute when no cwd, relative+guarded when cwd), stat for maxBytes, then read

## 4. Other Implementations

- [ ] 4.1 Update `RemoteFilesystem.readFile` — new signature, pass `{ file, cwd, maxBytes }` in RPC payload
- [ ] 4.2 Update `RootGuardFilesystem` — remove `readFileAbsolute`, update `readFile` delegation
- [ ] 4.3 Update `FakeFilesystem` in `packages/test-kit` — remove `readFileAbsolute`, update `readFile`

## 5. Schemas

- [ ] 5.1 Update `fsFileSchema` in `packages/schemas/src/socket/fs.ts` (request: `{ file, cwd?, maxBytes? }`)
- [ ] 5.2 Update `fsReadResponseSchema` in `protocol-schemas.ts` to match new `ReadFileResult`

## 6. Server Handler

- [ ] 6.1 Update `fs:read` handler to call `readFile(file, cwd, { maxBytes })` with new signature

## 7. Frontend Call Site

- [ ] 7.1 Update `loadPreview` in `FilesPane.tsx` to call `readFile` with new signature and pass `maxBytes: PREVIEW_CHAR_LIMIT`

## 8. Cleanup

- [ ] 8.1 Delete any remaining references to `readFileAbsolute` (grep check)
- [ ] 8.2 Run `tsc --noEmit` to confirm no type errors
- [ ] 8.3 Run tests — all green
