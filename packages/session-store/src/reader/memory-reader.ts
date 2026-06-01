import { makeDefaultSessionRecord } from '../jsonl/decoder.ts';
import type { SessionData, SessionReader } from '../types.ts';

export class MemoryReader implements SessionReader {
  private readonly data: Map<string, SessionData>;
  constructor(data: Map<string, SessionData>) {
    this.data = data;
  }

  async read(sessionId: string): Promise<SessionData> {
    return this.data.get(sessionId) ?? { events: [], record: makeDefaultSessionRecord(sessionId) };
  }
}
