import { encodeEvent } from '../jsonl/encoder.ts';
import type { SessionData } from '../types.ts';
import { FileWriter } from './file-writer.ts';

function enrichLine(raw: string, sessionId: string, cwd: string): string | null {
  try {
    const entry = JSON.parse(raw) as Record<string, unknown>;
    entry.sessionId = sessionId;
    if (cwd) entry.cwd = cwd;
    return `${JSON.stringify(entry)}\n`;
  } catch {
    console.warn('JsonlFileWriter: failed to parse event raw, skipping');
    return null;
  }
}

export class JsonlFileWriter extends FileWriter {
  protected encode(sessionId: string, data: SessionData): string {
    const { cwd } = data.record;
    return data.events
      .flatMap((e) => {
        const raw = encodeEvent(e);
        if (!raw) return [];
        const line = enrichLine(raw, sessionId, cwd);
        return line ? [line] : [];
      })
      .join('');
  }
}
