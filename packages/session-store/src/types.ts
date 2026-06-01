import type { RawEvent } from '@code-quest/summoner';

export interface JsonlSessionRecord {
  id: string;
  channelId: string;
  provider: string;
  command: string;
  args: string;
  cwd: string;
  projectRoot: string;
  mode: string;
  role: string;
  createdAt: string;
}

export interface SessionData {
  events: RawEvent[];
  record: JsonlSessionRecord;
}

export interface SessionReader {
  read(sessionId: string): Promise<SessionData>;
}

export interface SessionWriter {
  write(sessionId: string, data: SessionData): Promise<void>;
}

export interface SessionSummary {
  sessionId: string;
  createdAt?: string;
  jsonlPath?: string;
  title?: string;
  sizeBytes?: number;
  decodableLines?: number;
}

export interface ProjectSummary {
  cwd: string;
  encodedDir?: string;
  sessions: SessionSummary[];
}

export interface ProjectList {
  scanProjects(): Promise<ProjectSummary[]>;
  hasSession(sessionId: string): Promise<boolean>;
  countEvents(sessionId: string): Promise<number>;
}
