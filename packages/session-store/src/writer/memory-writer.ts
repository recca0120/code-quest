import type { SessionData, SessionWriter } from '../types.ts';

export class MemoryWriter implements SessionWriter {
  readonly data: Map<string, SessionData> = new Map();

  async write(sessionId: string, data: SessionData): Promise<void> {
    this.data.set(sessionId, data);
  }
}
