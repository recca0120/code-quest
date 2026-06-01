export interface RawDeltaEntry {
  parentId: string;
  sessionId: string;
  direction: 'in' | 'out' | 'err';
  raw: string;
  timestamp: number;
}

export interface RawDeltaRepository {
  append(event: RawDeltaEntry): Promise<void>;
  getBySession(sessionId: string): Promise<RawDeltaEntry[]>;
  deleteBySession(sessionId: string): Promise<void>;
}
