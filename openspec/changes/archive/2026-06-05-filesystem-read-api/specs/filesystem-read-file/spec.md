## ADDED Requirements

### Requirement: Unified readFile replaces readFileAbsolute and old readFile
The `Filesystem` interface SHALL expose a single `readFile(file: string, cwd?: string, opts?: { maxBytes?: number })` method that handles both absolute paths and cwd-relative paths. The old `readFileAbsolute` method SHALL be removed.

#### Scenario: Read absolute path without cwd
- **WHEN** `readFile('/abs/path/file.ts')` is called with no cwd
- **THEN** the system reads the file at the absolute path and returns `{ content, contentType, encoding }`

#### Scenario: Read relative path with cwd
- **WHEN** `readFile('src/index.ts', '/project')` is called
- **THEN** the system resolves `file` relative to `cwd` and returns the file content

#### Scenario: Path traversal rejected when cwd is provided
- **WHEN** `readFile('../../etc/passwd', '/project')` is called
- **THEN** the system returns `{ error: 'Path traversal not allowed' }`

#### Scenario: File not found
- **WHEN** `readFile('/nonexistent.txt')` is called
- **THEN** the system returns `{ error: <message containing the path> }`

### Requirement: readFile returns unified result with contentType and encoding
The return type `ReadFileResult` SHALL carry `contentType` and `encoding` fields on success, matching the former `ReadFileAbsoluteResult` shape.

#### Scenario: Text file returns utf-8 encoding
- **WHEN** `readFile('/path/file.ts')` is called and the file is a text file
- **THEN** the result is `{ content: <text>, contentType: 'text/plain', encoding: 'utf-8' }`

#### Scenario: Binary file returns base64 encoding
- **WHEN** `readFile('/path/image.png')` is called
- **THEN** the result is `{ content: <base64>, contentType: 'image/png', encoding: 'base64' }`

### Requirement: readFile supports maxBytes guard
When `maxBytes` is provided, the system SHALL stat the file first and return `{ tooLarge: true }` without reading content if the file size exceeds the limit.

#### Scenario: File exceeds maxBytes returns tooLarge
- **WHEN** `readFile('/path/big.txt', undefined, { maxBytes: 50 })` is called and the file is 100 bytes
- **THEN** the system returns `{ tooLarge: true }` without reading the file content

#### Scenario: File within maxBytes reads normally
- **WHEN** `readFile('/path/small.txt', undefined, { maxBytes: 100 })` is called and the file is 5 bytes
- **THEN** the system returns `{ content: <text>, contentType, encoding }`
