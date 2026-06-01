import { decodeSession } from './decoder.ts';
import { FileReader } from './file-reader.ts';
import type { SessionData } from './types.ts';

export class JsonlFileReader extends FileReader {
  protected decode(lines: string[], sessionId: string): SessionData {
    return decodeSession(lines, sessionId);
  }
}
