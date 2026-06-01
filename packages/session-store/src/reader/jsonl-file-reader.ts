import { decodeSession } from '../jsonl/decoder.ts';
import type { SessionData } from '../types.ts';
import { FileReader } from './file-reader.ts';

export class JsonlFileReader extends FileReader {
  protected decode(lines: string[], sessionId: string): SessionData {
    return decodeSession(lines, sessionId);
  }
}
