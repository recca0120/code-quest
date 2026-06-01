/**
 * Drizzle does not expose a shared base type across SQLite / MySQL dialects.
 * We define a minimal structural interface so stores work with both.
 *
 * @see https://deepwiki.com/drizzle-team/drizzle-orm/2.2-query-building
 */

interface DrizzleQueryResult extends Promise<unknown[]> {
  limit(n: number): { offset(n: number): Promise<unknown[]> } & Promise<unknown[]>;
  orderBy(...cols: unknown[]): {
    limit(n: number): { offset(n: number): Promise<unknown[]> } & Promise<unknown[]>;
  } & Promise<unknown[]>;
}

interface DrizzleSelectFrom extends DrizzleQueryResult {
  where(cond: unknown): DrizzleQueryResult;
}

export interface DrizzleDb {
  insert(table: unknown): { values(v: unknown): Promise<unknown> };
  select(cols?: unknown): {
    from(table: unknown): DrizzleSelectFrom;
  };
  update(table: unknown): {
    set(values: unknown): { where(cond: unknown): Promise<unknown> };
  };
  delete(table: unknown): { where(cond: unknown): Promise<unknown> };
}
