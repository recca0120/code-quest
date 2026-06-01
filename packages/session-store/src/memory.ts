import { makeDefaultSessionRecord } from './decoder.ts';
import type { SessionData, SessionReader, SessionWriter } from './types.ts';

export class MemoryReader implements SessionReader {
  private readonly data: Map<string, SessionData>;
  constructor(data: Map<string, SessionData>) {
    this.data = data;
  }

  async read(sessionId: string): Promise<SessionData> {
    return this.data.get(sessionId) ?? { events: [], record: makeDefaultSessionRecord(sessionId) };
  }
}

export class MemoryWriter implements SessionWriter {
  readonly data: Map<string, SessionData> = new Map();

  async write(sessionId: string, data: SessionData): Promise<void> {
    this.data.set(sessionId, data);
  }
}
