import type { RawEvent } from '@code-quest/summoner';
import type { SessionData, SessionRecord } from '../types.ts';

export interface JsonlEntry {
  type: string;
  isSidechain?: boolean;
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  aiTitle?: string;
  snapshot?: { timestamp?: string };
  [key: string]: unknown;
}

const SESSION_DEFAULTS = {
  provider: 'claude',
  command: 'claude',
  args: '[]',
  mode: 'interactive',
  role: 'chat',
} as const;

export function makeDefaultSessionRecord(id: string): SessionRecord {
  return {
    id,
    channelId: id,
    ...SESSION_DEFAULTS,
    cwd: '',
    projectRoot: '',
    createdAt: new Date().toISOString(),
  };
}

export function parseLine(line: string): JsonlEntry | null {
  if (!line.trim()) return null;
  try {
    const entry = JSON.parse(line) as JsonlEntry;
    if (typeof entry.type !== 'string') return null;
    return entry.isSidechain ? null : entry;
  } catch {
    return null;
  }
}

function buildSessionRecord(
  entry: JsonlEntry & { sessionId: string; cwd: string; timestamp: string },
): SessionRecord {
  return {
    id: entry.sessionId,
    channelId: entry.sessionId,
    ...SESSION_DEFAULTS,
    cwd: entry.cwd,
    projectRoot: entry.cwd,
    createdAt: entry.timestamp,
  };
}

function parseTimestamp(s: string | undefined): number | null {
  if (s == null) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function resolveTimestamp(entry: JsonlEntry, fallback: number): number {
  return parseTimestamp(entry.timestamp) ?? parseTimestamp(entry.snapshot?.timestamp) ?? fallback;
}

export class JsonlDecoder {
  private lastTimestamp = 0;
  private readonly fallbackSessionId: string;

  constructor(fallbackSessionId: string) {
    this.fallbackSessionId = fallbackSessionId;
  }

  readLine(line: string, parsed?: JsonlEntry): RawEvent | null {
    const entry = parsed ?? parseLine(line);
    if (!entry) return null;

    const sessionId = entry.sessionId ?? this.fallbackSessionId;
    const timestamp = resolveTimestamp(entry, this.lastTimestamp || Date.now());
    if (timestamp > 0) this.lastTimestamp = timestamp;

    return { sessionId, direction: 'out', raw: line, timestamp };
  }
}

function hasSessionFields(
  e: JsonlEntry,
): e is JsonlEntry & { sessionId: string; cwd: string; timestamp: string } {
  return (
    typeof e.sessionId === 'string' && typeof e.cwd === 'string' && typeof e.timestamp === 'string'
  );
}

export function decodeSession(lines: string[], sessionId: string): SessionData {
  const decoder = new JsonlDecoder(sessionId);
  let record: SessionRecord | null = null;
  const events = lines.flatMap((l) => {
    const entry = parseLine(l);
    if (!entry) return [];
    if (!record && hasSessionFields(entry)) {
      record = buildSessionRecord(entry);
    }
    const e = decoder.readLine(l, entry);
    return e ? [e] : [];
  });
  return { events, record: record ?? makeDefaultSessionRecord(sessionId) };
}

export function parseLines(content: string): string[] {
  return content.split('\n').filter((l) => l.trim());
}
