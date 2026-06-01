import { encodeEvent } from '../jsonl/encoder.ts';
import type { SessionData } from '../types.ts';
import { FileWriter } from './file-writer.ts';

export class JsonlFileWriter extends FileWriter {
  protected encode(sessionId: string, data: SessionData): string {
    const { cwd } = data.record;
    const context = { sessionId, cwd };
    return data.events
      .flatMap((e) => {
        const line = encodeEvent(e, context);
        return line ? [`${line}\n`] : [];
      })
      .join('');
  }
}
