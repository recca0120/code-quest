export { isPathWithin } from './is-path-within.ts';
export { LocalFilesystem } from './local-filesystem.ts';
export { RemoteFilesystem } from './remote-filesystem.ts';
export { RootGuardFilesystem } from './root-guard-filesystem.ts';
export type {
  DirectoryEntry,
  FileKind,
  FileResult,
  Filesystem,
  FsMutationResult,
  ReadFileAbsoluteResult,
  ReadFileResult,
  WriteFileResult,
} from './types.ts';
export { PathOutsideRootsError } from './types.ts';
