import { basename } from 'node:path';
import type { Filesystem } from '@code-quest/filesystem';
import type { SessionReader, SessionWriter } from '@code-quest/session-store';
import { JsonlFileReader, JsonlFileWriter, Transfer } from '@code-quest/session-store';

export class SessionTransfer {
  private readonly reader: SessionReader;
  private readonly writer: SessionWriter;
  private readonly filesystem: Filesystem;

  constructor(reader: SessionReader, writer: SessionWriter, filesystem: Filesystem) {
    this.reader = reader;
    this.writer = writer;
    this.filesystem = filesystem;
  }

  async importSession(filePath: string): Promise<void> {
    const fileReader = new JsonlFileReader(filePath, this.filesystem);
    // Use filename as fallback so events without explicit sessionId get a reasonable ID
    const filenameId = basename(filePath, '.jsonl');
    const data = await fileReader.read(filenameId);
    // Authoritative sessionId comes from the record, not the filename
    const sessionId = data.record.id;
    const normalized = {
      ...data,
      events: data.events.map((e) => ({ ...e, sessionId })),
    };
    await this.writer.write(sessionId, normalized);
  }

  async exportSession(sessionId: string, outputPath: string): Promise<void> {
    await new Transfer(this.reader, new JsonlFileWriter(outputPath, this.filesystem)).run(
      sessionId,
    );
  }
}
