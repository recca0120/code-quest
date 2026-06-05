import { z } from 'zod';

import { rpcResult } from './rpc.ts';

export const fsEntryTypeSchema: z.ZodEnum<{ file: 'file'; directory: 'directory' }> = z.enum([
  'file',
  'directory',
]);
export type FsEntryType = z.infer<typeof fsEntryTypeSchema>;

// ── Browse ──

export const fsDirectorySchema: z.ZodObject<
  { name: z.ZodString; path: z.ZodString },
  z.core.$strip
> = z.object({
  name: z.string(),
  path: z.string(),
});
export type FsDirectory = z.infer<typeof fsDirectorySchema>;

export const fsFileSchema: z.ZodObject<
  { name: z.ZodString; path: z.ZodString; size: z.ZodNumber },
  z.core.$strip
> = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
});
export type FsFile = z.infer<typeof fsFileSchema>;

export const fsBrowsePayloadSchema: z.ZodObject<
  { path: z.ZodOptional<z.ZodString>; showHidden: z.ZodDefault<z.ZodBoolean> },
  z.core.$strip
> = z.object({ path: z.string().optional(), showHidden: z.boolean().default(false) });
export type FsBrowsePayload = z.infer<typeof fsBrowsePayloadSchema>;

export const fsBrowseResponseSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        directories: z.ZodArray<typeof fsDirectorySchema>;
        files: z.ZodDefault<z.ZodArray<typeof fsFileSchema>>;
      },
      z.core.$strip
    >,
    z.ZodObject<{ error: z.ZodString }, z.core.$strip>,
  ]
> = z.union([
  z.object({
    directories: z.array(fsDirectorySchema),
    files: z.array(fsFileSchema).default([]),
  }),
  z.object({ error: z.string() }),
]);
export type FsBrowseResponse = z.infer<typeof fsBrowseResponseSchema>;

// ── Read ──

export const fsReadPayloadSchema: z.ZodObject<
  { file: z.ZodString; cwd: z.ZodOptional<z.ZodString>; maxBytes: z.ZodOptional<z.ZodNumber> },
  z.core.$strip
> = z.object({
  file: z.string(),
  cwd: z.string().optional(),
  maxBytes: z.number().optional(),
});
export type FsReadPayload = z.infer<typeof fsReadPayloadSchema>;

export const fsReadResponseSchema: z.ZodUnion<
  readonly [
    z.ZodObject<
      {
        content: z.ZodString;
        contentType: z.ZodString;
        encoding: z.ZodEnum<{ 'utf-8': 'utf-8'; base64: 'base64' }>;
      },
      z.core.$strip
    >,
    z.ZodObject<{ tooLarge: z.ZodLiteral<true> }, z.core.$strip>,
    z.ZodObject<{ error: z.ZodString }, z.core.$strip>,
  ]
> = z.union([
  z.object({
    content: z.string(),
    contentType: z.string(),
    encoding: z.enum(['utf-8', 'base64']),
  }),
  z.object({ tooLarge: z.literal(true) }),
  z.object({ error: z.string() }),
]);
export type FsReadResponse = z.infer<typeof fsReadResponseSchema>;

// ── Search ──

export const fsSearchPayloadSchema: z.ZodObject<
  { cwd: z.ZodString; pattern: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  pattern: z.string(),
});
export type FsSearchPayload = z.infer<typeof fsSearchPayloadSchema>;

export const fsSearchResultSchema: z.ZodObject<
  { path: z.ZodString; name: z.ZodString; type: typeof fsEntryTypeSchema },
  z.core.$strip
> = z.object({
  path: z.string(),
  name: z.string(),
  type: fsEntryTypeSchema,
});
export type FsSearchResult = z.infer<typeof fsSearchResultSchema>;

export const fsSearchResponseSchema: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        ok: z.ZodLiteral<true>;
        data: z.ZodObject<{ files: z.ZodArray<typeof fsSearchResultSchema> }, z.core.$strip>;
      },
      z.core.$strip
    >,
    z.ZodObject<
      { ok: z.ZodLiteral<false>; error: z.ZodString; code: z.ZodOptional<z.ZodString> },
      z.core.$strip
    >,
  ],
  'ok'
> = rpcResult(z.object({ files: z.array(fsSearchResultSchema) }));
export type FsSearchResponse = z.infer<typeof fsSearchResponseSchema>;

// ── Mutations: create / delete / rename / copy / move ──

/** Tagged result reused across all five mutation RPCs. */
export const fsMutationResultSchema: z.ZodUnion<
  readonly [
    z.ZodObject<{ ok: z.ZodLiteral<true> }, z.core.$strip>,
    z.ZodObject<{ error: z.ZodString }, z.core.$strip>,
  ]
> = z.union([z.object({ ok: z.literal(true) }), z.object({ error: z.string() })]);
export const fsCreatePayloadSchema: z.ZodObject<
  { path: z.ZodString; kind: typeof fsEntryTypeSchema },
  z.core.$strip
> = z.object({
  path: z.string(),
  kind: fsEntryTypeSchema,
});
export type FsCreatePayload = z.infer<typeof fsCreatePayloadSchema>;

export const fsDeletePayloadSchema: z.ZodObject<{ path: z.ZodString }, z.core.$strip> = z.object({
  path: z.string(),
});
export type FsDeletePayload = z.infer<typeof fsDeletePayloadSchema>;

export const fsRenamePayloadSchema: z.ZodObject<
  { from: z.ZodString; to: z.ZodString },
  z.core.$strip
> = z.object({ from: z.string(), to: z.string() });
export type FsRenamePayload = z.infer<typeof fsRenamePayloadSchema>;

export const fsCopyPayloadSchema: z.ZodObject<
  { from: z.ZodString; to: z.ZodString },
  z.core.$strip
> = z.object({ from: z.string(), to: z.string() });
export type FsCopyPayload = z.infer<typeof fsCopyPayloadSchema>;

export const fsMovePayloadSchema: z.ZodObject<
  { from: z.ZodString; to: z.ZodString },
  z.core.$strip
> = z.object({ from: z.string(), to: z.string() });
export type FsMovePayload = z.infer<typeof fsMovePayloadSchema>;

// ── Watch / unwatch ──

export const fsWatchPayloadSchema: z.ZodObject<
  { cwd: z.ZodString; subscriberId: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  subscriberId: z.string(),
});
export type FsWatchPayload = z.infer<typeof fsWatchPayloadSchema>;

export const fsUnwatchPayloadSchema: z.ZodObject<{ subscriberId: z.ZodString }, z.core.$strip> =
  z.object({
    subscriberId: z.string(),
  });
export type FsUnwatchPayload = z.infer<typeof fsUnwatchPayloadSchema>;

export const watchStartPayloadSchema: z.ZodObject<{ cwd: z.ZodString }, z.core.$strip> = z.object({
  cwd: z.string(),
});
export type WatchStartPayload = z.infer<typeof watchStartPayloadSchema>;
