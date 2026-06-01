import type { SessionReader, SessionWriter } from './types.ts';

export class Transfer {
  private readonly reader: SessionReader;
  private readonly writer: SessionWriter;

  constructor(reader: SessionReader, writer: SessionWriter) {
    this.reader = reader;
    this.writer = writer;
  }

  async run(sessionId: string): Promise<void> {
    const data = await this.reader.read(sessionId);
    await this.writer.write(sessionId, data);
  }
}
