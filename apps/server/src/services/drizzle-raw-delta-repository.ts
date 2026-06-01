import { asc, type Column, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { DrizzleDb } from './drizzle-types.ts';
import type { RawDeltaEntry, RawDeltaRepository } from './raw-delta-repository.ts';
import { type BaseRawTable, directionSchema } from './raw-event-repository.ts';

const rowSchema = z.object({
  id: z.string(),
  parentId: z.string(),
  sessionId: z.string(),
  dir: z.string(),
  raw: z.string(),
  createdAt: z.string(),
});

interface RawDeltasTable extends BaseRawTable {
  parentId: Column;
}

export class DrizzleRawDeltaStore implements RawDeltaRepository {
  private db: DrizzleDb;
  private table: RawDeltasTable;
  constructor(db: DrizzleDb, table: RawDeltasTable) {
    this.db = db;
    this.table = table;
  }

  async append(event: RawDeltaEntry): Promise<void> {
    await this.db.insert(this.table).values({
      id: uuidv7(),
      parentId: event.parentId,
      sessionId: event.sessionId,
      dir: event.direction,
      raw: event.raw,
      createdAt: new Date(event.timestamp).toISOString(),
    });
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.sessionId, sessionId));
  }

  async getBySession(sessionId: string): Promise<RawDeltaEntry[]> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.sessionId, sessionId))
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return z
      .array(rowSchema)
      .parse(rows)
      .map((row) => ({
        parentId: row.parentId,
        sessionId: row.sessionId,
        direction: directionSchema.parse(row.dir),
        raw: row.raw,
        timestamp: new Date(row.createdAt).getTime(),
      }));
  }
}
