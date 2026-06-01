import type { RawEvent } from '@code-quest/summoner';
import { and, asc, type Column, desc, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { DrizzleDb } from './drizzle-types.ts';
import {
  type BaseRawTable,
  directionSchema,
  extractTextFromRaw,
  type RawEventRepository,
  type SessionPreview,
} from './raw-event-repository.ts';

const rawEventRowSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  dir: z.string(),
  raw: z.string(),
  createdAt: z.string(),
});

type RawEventRow = z.infer<typeof rawEventRowSchema>;

interface RawDeltasTable extends BaseRawTable {
  parentId: Column;
}

/** Drizzle's select-builder chain supports .unionAll + .orderBy; our minimal
 *  DrizzleDb structural type omits those methods. This local shape narrows
 *  just enough to keep the UNION ALL call typechecked without leaking raw
 *  dialect types. */
interface PageableQuery<T> extends Promise<T[]> {
  limit(n: number): { offset(n: number): Promise<T[]> } & Promise<T[]>;
}

interface UnionableSelectBuilder<T> {
  from(table: unknown): {
    where(cond: unknown): {
      unionAll(other: unknown): {
        orderBy(...cols: unknown[]): Promise<T[]>;
      };
    };
  };
}

function findText(rows: RawEventRow[], type: 'user' | 'assistant'): string | undefined {
  for (const row of rows) {
    const text = extractTextFromRaw(row.raw, type);
    if (text) return text;
  }
  return undefined;
}

function toRawEvent(row: RawEventRow): RawEvent {
  return {
    timestamp: new Date(row.createdAt).getTime(),
    sessionId: row.sessionId,
    direction: directionSchema.parse(row.dir),
    raw: row.raw,
  };
}

function parseRawRows(rows: unknown): RawEventRow[] {
  return z.array(rawEventRowSchema).parse(rows);
}

function parseRows(rows: unknown): RawEvent[] {
  return parseRawRows(rows).map(toRawEvent);
}

export class DrizzleRawEventStore implements RawEventRepository {
  /**
   * @param deltaTable optional sibling table. When supplied, `getBySession`
   *   emits a SQL `UNION ALL` across raw_events + raw_deltas. Omitted for
   *   single-table scenarios (e.g. isolated unit tests).
   */
  private db: DrizzleDb;
  private table: BaseRawTable;
  private deltaTable?: RawDeltasTable;
  constructor(db: DrizzleDb, table: BaseRawTable, deltaTable?: RawDeltasTable) {
    this.db = db;
    this.table = table;
    this.deltaTable = deltaTable;
  }

  async append(event: RawEvent, id?: string): Promise<string> {
    const rowId = id ?? uuidv7();
    await this.db.insert(this.table).values({
      id: rowId,
      sessionId: event.sessionId,
      dir: event.direction,
      raw: event.raw,
      createdAt: new Date(event.timestamp).toISOString(),
    });
    return rowId;
  }

  async appendBatch(events: RawEvent[]): Promise<void> {
    if (events.length === 0) return;
    const values = events.map((event) => ({
      id: uuidv7(),
      sessionId: event.sessionId,
      dir: event.direction,
      raw: event.raw,
      createdAt: new Date(event.timestamp).toISOString(),
    }));
    await this.db.insert(this.table).values(values);
  }

  async getPreview(sessionId: string): Promise<SessionPreview> {
    // Last 10 'out' rows because not every out event is an assistant message (init, status, etc.).
    const [lastOutRaw, firstInRaw] = await Promise.all([
      this.db
        .select()
        .from(this.table)
        .where(and(eq(this.table.sessionId, sessionId), eq(this.table.dir, 'out')))
        .orderBy(desc(this.table.createdAt), desc(this.table.id))
        .limit(10),
      this.db
        .select()
        .from(this.table)
        .where(and(eq(this.table.sessionId, sessionId), eq(this.table.dir, 'in')))
        .orderBy(asc(this.table.createdAt), asc(this.table.id))
        .limit(5),
    ]);

    return {
      lastAssistant: findText(parseRawRows(lastOutRaw), 'assistant'),
      firstUser: findText(parseRawRows(firstInRaw), 'user'),
    };
  }

  async cloneEvents(fromSessionId: string, toSessionId: string, ids?: string[]): Promise<void> {
    if (fromSessionId === toSessionId) {
      throw new Error('cloneEvents: source and destination sessionId must differ');
    }
    // Events-only read — deltas are debug data and don't belong to a fork.
    const rows = await this.getEventsBySession(fromSessionId);
    if (rows.length === 0) return;
    const values = rows.map((row, i) => ({
      id: ids?.[i] ?? uuidv7(),
      sessionId: toSessionId,
      dir: row.direction,
      raw: row.raw,
      createdAt: new Date(row.timestamp).toISOString(),
    }));
    await this.db.insert(this.table).values(values);
  }

  async getBySession(sessionId: string): Promise<RawEvent[]> {
    if (!this.deltaTable) return this.getEventsBySession(sessionId);
    const rows = await this.getUnionBySession(sessionId, this.deltaTable);
    return parseRows(rows);
  }

  private getUnionBySession(sessionId: string, deltaTable: typeof this.table) {
    const selectCols = (table: typeof this.table) => ({
      id: table.id,
      sessionId: table.sessionId,
      dir: table.dir,
      raw: table.raw,
      createdAt: table.createdAt,
    });

    const builder = this.db.select as unknown as (
      cols: ReturnType<typeof selectCols>,
    ) => UnionableSelectBuilder<RawEventRow>;

    const eventsQ = builder
      .call(this.db, selectCols(this.table))
      .from(this.table)
      .where(eq(this.table.sessionId, sessionId));
    const deltasQ = builder
      .call(this.db, selectCols(deltaTable))
      .from(deltaTable)
      .where(eq(deltaTable.sessionId, sessionId));

    return eventsQ.unionAll(deltasQ).orderBy(asc(this.table.createdAt), asc(this.table.id));
  }

  private async getEventsBySession(sessionId: string): Promise<RawEvent[]> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.sessionId, sessionId))
      .orderBy(asc(this.table.createdAt), asc(this.table.id));

    return parseRows(rows);
  }

  async countBySession(sessionId: string): Promise<number> {
    const countRows = async (table: BaseRawTable) => {
      const rows = await this.db
        .select({ count: sql`count(*)` })
        .from(table)
        .where(eq(table.sessionId, sessionId));
      return z.coerce.number().parse((rows[0] as { count: unknown } | undefined)?.count ?? 0);
    };
    const [eventsCount, deltasCount] = await Promise.all([
      countRows(this.table),
      this.deltaTable ? countRows(this.deltaTable) : Promise.resolve(0),
    ]);
    return eventsCount + deltasCount;
  }

  async hasEvents(sessionId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.sessionId, sessionId))
      .limit(1);
    return rows.length > 0;
  }

  async hasUserEcho(sessionId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.sessionId, sessionId),
          eq(this.table.dir, 'out'),
          sql`json_extract(${this.table.raw}, '$.type') = 'user'`,
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.db.delete(this.table).where(eq(this.table.sessionId, sessionId));
  }

  async *streamBySession(sessionId: string, batchSize: number): AsyncGenerator<RawEvent[]> {
    let cursor: { createdAt: string; id: string } | undefined;
    while (true) {
      const cond = cursor
        ? and(
            eq(this.table.sessionId, sessionId),
            sql`(${this.table.createdAt}, ${this.table.id}) > (${cursor.createdAt}, ${cursor.id})`,
          )
        : eq(this.table.sessionId, sessionId);
      const rows = await (
        this.db
          .select()
          .from(this.table)
          .where(cond)
          .orderBy(asc(this.table.createdAt), asc(this.table.id)) as PageableQuery<RawEventRow>
      ).limit(batchSize);
      const parsed = parseRawRows(rows);
      if (parsed.length === 0) break;
      const last = parsed[parsed.length - 1] as RawEventRow;
      cursor = { createdAt: last.createdAt, id: last.id };
      yield parsed.map(toRawEvent);
      if (parsed.length < batchSize) break;
    }
  }
}
