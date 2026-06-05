import { z } from 'zod';
import { fsEntryTypeSchema } from '../../socket/fs.ts';
import { worktreeInfoSchema } from '../../socket/worktree.ts';

// ── Process ──

export const processSpawnParamsSchema: z.ZodObject<
  {
    sessionId: z.ZodString;
    command: z.ZodString;
    args: z.ZodArray<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
  },
  z.core.$strip
> = z.object({
  sessionId: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const processStdinParamsSchema: z.ZodObject<
  { sessionId: z.ZodString; data: z.ZodString },
  z.core.$strip
> = z.object({
  sessionId: z.string(),
  data: z.string(),
});

export const processKillParamsSchema: z.ZodObject<{ sessionId: z.ZodString }, z.core.$strip> =
  z.object({
    sessionId: z.string(),
  });

export const processLineEventSchema: z.ZodObject<
  { sessionId: z.ZodString; line: z.ZodString },
  z.core.$strip
> = z.object({
  sessionId: z.string(),
  line: z.string(),
});

export const processExitEventSchema: z.ZodObject<
  { sessionId: z.ZodString; code: z.ZodNullable<z.ZodNumber> },
  z.core.$strip
> = z.object({
  sessionId: z.string(),
  code: z.number().nullable(),
});

// ── Filesystem ──

export const fsBrowseDirectoriesParamsSchema: z.ZodObject<
  { path: z.ZodOptional<z.ZodString> },
  z.core.$strip
> = z.object({
  path: z.string().optional(),
});

export const fsBrowseEntriesParamsSchema: z.ZodObject<
  { path: z.ZodOptional<z.ZodString>; showHidden: z.ZodOptional<z.ZodBoolean> },
  z.core.$strip
> = z.object({
  path: z.string().optional(),
  showHidden: z.boolean().optional(),
});

export const fsWriteFileAbsoluteParamsSchema: z.ZodObject<
  { absolutePath: z.ZodString; content: z.ZodString },
  z.core.$strip
> = z.object({
  absolutePath: z.string(),
  content: z.string(),
});

export const fsCreateParamsSchema: z.ZodObject<
  { absolutePath: z.ZodString; kind: typeof fsEntryTypeSchema },
  z.core.$strip
> = z.object({
  absolutePath: z.string(),
  kind: fsEntryTypeSchema,
});

export const fsDeleteParamsSchema: z.ZodObject<{ absolutePath: z.ZodString }, z.core.$strip> =
  z.object({
    absolutePath: z.string(),
  });

const fromToSchema: z.ZodObject<{ from: z.ZodString; to: z.ZodString }, z.core.$strip> = z.object({
  from: z.string(),
  to: z.string(),
});

export const fsRenameParamsSchema: typeof fromToSchema = fromToSchema;
export const fsCopyParamsSchema: typeof fromToSchema = fromToSchema;
export const fsMoveParamsSchema: typeof fromToSchema = fromToSchema;

export const fsListParamsSchema: z.ZodObject<
  { cwd: z.ZodString; pattern: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  pattern: z.string(),
});

export const fsReadParamsSchema: z.ZodObject<
  { file: z.ZodString; cwd: z.ZodOptional<z.ZodString>; maxBytes: z.ZodOptional<z.ZodNumber> },
  z.core.$strip
> = z.object({
  file: z.string(),
  cwd: z.string().optional(),
  maxBytes: z.number().optional(),
});

const pathParamSchema: z.ZodObject<{ path: z.ZodString }, z.core.$strip> = z.object({
  path: z.string(),
});

export const fsExistsParamsSchema: typeof pathParamSchema = pathParamSchema;

export const fsIsDirectoryParamsSchema: typeof pathParamSchema = pathParamSchema;

export const fsStatKindParamsSchema: typeof pathParamSchema = pathParamSchema;

// ── Filesystem responses ──

const directoryEntrySchema: z.ZodObject<{ name: z.ZodString; path: z.ZodString }, z.core.$strip> =
  z.object({ name: z.string(), path: z.string() });

const fileEntrySchema = z.object({ name: z.string(), path: z.string(), size: z.number() });

export const fsBrowseDirectoriesResponseSchema: z.ZodObject<
  { entries: z.ZodArray<typeof directoryEntrySchema> },
  z.core.$strip
> = z.object({
  entries: z.array(directoryEntrySchema),
});

export const fsBrowseEntriesResponseSchema: z.ZodObject<
  {
    directories: z.ZodArray<typeof directoryEntrySchema>;
    files: z.ZodArray<
      z.ZodObject<{ name: z.ZodString; path: z.ZodString; size: z.ZodNumber }, z.core.$strip>
    >;
  },
  z.core.$strip
> = z.object({
  directories: z.array(directoryEntrySchema),
  files: z.array(fileEntrySchema),
});

const fileResultSchema: z.ZodObject<
  { path: z.ZodString; name: z.ZodString; type: typeof fsEntryTypeSchema },
  z.core.$strip
> = z.object({
  path: z.string(),
  name: z.string(),
  type: fsEntryTypeSchema,
});

export const fsListResponseSchema: z.ZodObject<
  { files: z.ZodArray<typeof fileResultSchema> },
  z.core.$strip
> = z.object({
  files: z.array(fileResultSchema),
});

export const fsExistsResponseSchema: z.ZodObject<{ exists: z.ZodBoolean }, z.core.$strip> =
  z.object({ exists: z.boolean() });
export const fsIsDirectoryResponseSchema: z.ZodObject<
  { isDirectory: z.ZodBoolean },
  z.core.$strip
> = z.object({ isDirectory: z.boolean() });
export const fsStatKindResponseSchema: z.ZodObject<
  { kind: z.ZodNullable<typeof fsEntryTypeSchema> },
  z.core.$strip
> = z.object({
  kind: fsEntryTypeSchema.nullable(),
});

export const fsReadFileResponseSchema: z.ZodUnion<
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
  z.object({ content: z.string(), contentType: z.string(), encoding: z.enum(['utf-8', 'base64']) }),
  z.object({ tooLarge: z.literal(true) }),
  z.object({ error: z.string() }),
]);

// ── Git responses ──

export const gitNullableRootSchema: z.ZodNullable<z.ZodString> = z.string().nullable();

export const gitBranchResultSchema: z.ZodObject<{ branch: z.ZodString }, z.core.$strip> = z.object({
  branch: z.string(),
});

export const gitBranchListSchema: z.ZodArray<z.ZodString> = z.array(z.string());

export const gitWorktreeListSchema: z.ZodArray<typeof worktreeInfoSchema> =
  z.array(worktreeInfoSchema);

// ── Git ──

export const gitCwdParamsSchema: z.ZodObject<{ cwd: z.ZodString }, z.core.$strip> = z.object({
  cwd: z.string(),
});

export const gitCheckoutParamsSchema: z.ZodObject<
  { cwd: z.ZodString; branch: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  branch: z.string(),
});

export const gitLogParamsSchema: z.ZodObject<
  { cwd: z.ZodString; limit: z.ZodOptional<z.ZodNumber> },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  limit: z.number().optional(),
});

export const gitDiffParamsSchema: z.ZodObject<
  { cwd: z.ZodString; filePath: z.ZodOptional<z.ZodString>; status: z.ZodOptional<z.ZodString> },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  filePath: z.string().optional(),
  status: z.string().optional(),
});

export const gitAddParamsSchema: z.ZodObject<
  { cwd: z.ZodString; paths: z.ZodOptional<z.ZodArray<z.ZodString>> },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  paths: z.array(z.string()).optional(),
});

export const gitCommitParamsSchema: z.ZodObject<
  { cwd: z.ZodString; message: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  message: z.string(),
});

export const gitDiscardFileParamsSchema: z.ZodObject<
  { cwd: z.ZodString; file: z.ZodString },
  z.core.$strip
> = z.object({
  cwd: z.string(),
  file: z.string(),
});

export const gitListBranchesParamsSchema: z.ZodObject<{ repoRoot: z.ZodString }, z.core.$strip> =
  z.object({
    repoRoot: z.string(),
  });

export const gitCreateWorktreeParamsSchema: z.ZodObject<
  {
    repoRoot: z.ZodString;
    opts: z.ZodOptional<
      z.ZodObject<
        {
          name: z.ZodOptional<z.ZodString>;
          existingBranch: z.ZodOptional<z.ZodString>;
          newBranch: z.ZodOptional<z.ZodString>;
          baseBranch: z.ZodOptional<z.ZodString>;
          path: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
> = z.object({
  repoRoot: z.string(),
  opts: z
    .object({
      name: z.string().optional(),
      existingBranch: z.string().optional(),
      newBranch: z.string().optional(),
      baseBranch: z.string().optional(),
      path: z.string().optional(),
    })
    .optional(),
});

export const gitListWorktreesParamsSchema: z.ZodObject<{ repoRoot: z.ZodString }, z.core.$strip> =
  z.object({
    repoRoot: z.string(),
  });

export const gitDeleteWorktreeParamsSchema: z.ZodObject<
  { repoRoot: z.ZodString; name: z.ZodString },
  z.core.$strip
> = z.object({
  repoRoot: z.string(),
  name: z.string(),
});

export const gitRenameWorktreeParamsSchema: z.ZodObject<
  { worktreeCwd: z.ZodString; newBranchName: z.ZodString },
  z.core.$strip
> = z.object({
  worktreeCwd: z.string(),
  newBranchName: z.string(),
});

export const gitArchiveWorktreeParamsSchema: z.ZodObject<
  {
    repoRoot: z.ZodString;
    name: z.ZodString;
    opts: z.ZodOptional<z.ZodObject<{ force: z.ZodOptional<z.ZodBoolean> }, z.core.$strip>>;
  },
  z.core.$strip
> = z.object({
  repoRoot: z.string(),
  name: z.string(),
  opts: z.object({ force: z.boolean().optional() }).optional(),
});
