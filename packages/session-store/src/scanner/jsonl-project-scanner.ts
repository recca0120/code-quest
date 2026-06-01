import { parseLine, parseLines } from '../jsonl/decoder.ts';
import { FileProjectScanner, type SessionMeta } from './file-project-scanner.ts';

function extractSessionMeta(lines: string[]): SessionMeta {
  let title: string | undefined;
  let createdAt: string | undefined;
  let cwd = '';
  let decodableLines = 0;
  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') title = entry.aiTitle;
    if (!createdAt && typeof entry.timestamp === 'string') createdAt = entry.timestamp;
    if (!cwd && typeof entry.cwd === 'string') cwd = entry.cwd;
    decodableLines++;
  }
  return { title, createdAt, cwd, decodableLines };
}

export class JsonlProjectScanner extends FileProjectScanner {
  protected isSessionFile(name: string): boolean {
    return name.endsWith('.jsonl') && !name.startsWith('agent-');
  }

  protected extractMeta(content: string): SessionMeta {
    return extractSessionMeta(parseLines(content));
  }
}
