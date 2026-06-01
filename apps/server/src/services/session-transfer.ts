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
    const sessionId = basename(filePath, '.jsonl');
    await new Transfer(new JsonlFileReader(filePath, this.filesystem), this.writer).run(sessionId);
  }

  async exportSession(sessionId: string, outputPath: string): Promise<void> {
    await new Transfer(this.reader, new JsonlFileWriter(outputPath, this.filesystem)).run(
      sessionId,
    );
  }
}
