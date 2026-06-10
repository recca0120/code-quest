import { z } from 'zod';

const persistedPaneContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), cwd: z.string().nullable() }),
  z.object({ type: z.literal('files'), cwd: z.string() }),
  z.object({ type: z.literal('git'), cwd: z.string() }),
  z.object({ type: z.literal('openspec'), cwd: z.string() }),
]);

type PersistedPaneContent = z.infer<typeof persistedPaneContentSchema>;

type PersistedPaneLeaf = { type: 'leaf'; id: string; content: PersistedPaneContent };
type PersistedPaneSplit = {
  type: 'split';
  id: string;
  direction: 'h' | 'v';
  ratio: number;
  first: PersistedPaneNode;
  second: PersistedPaneNode;
};
type PersistedPaneNode = PersistedPaneLeaf | PersistedPaneSplit;

const persistedPaneNodeSchema: z.ZodType<PersistedPaneNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('leaf'),
      id: z.string(),
      content: persistedPaneContentSchema,
    }),
    z.object({
      type: z.literal('split'),
      id: z.string(),
      direction: z.enum(['h', 'v']),
      ratio: z.number(),
      first: persistedPaneNodeSchema,
      second: persistedPaneNodeSchema,
    }),
  ]),
);

export const persistedTabSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  paneRoot: persistedPaneNodeSchema,
});
export type PersistedTab = z.infer<typeof persistedTabSchema>;

export const persistedLayoutSchema = z.object({
  tabs: z.array(persistedTabSchema),
  activeTabId: z.string(),
});
export type PersistedLayout = z.infer<typeof persistedLayoutSchema>;
