/** Reads diff source files for `control_request/open_diff` flows.
 *
 *  IMPORTANT: This service intentionally bypasses `fsRoots` validation —
 *  Claude CLI delivers paths that may point at commit blobs, scratch files,
 *  or other locations outside the user's project roots, but they are still
 *  legitimate diff inputs. Use this ONLY for IPC-supplied paths originating
 *  from the CLI control channel; never expose it to client RPC. */
export interface DiffFile {
  /** Resolves with the file contents, or `''` for missing/empty/error
   *  cases (matches the legacy `readFileOrEmpty` contract). */
  read(path: string): Promise<string>;
}
