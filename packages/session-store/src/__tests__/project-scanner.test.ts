import { join } from 'node:path';
import { FakeFilesystem } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { JsonlProjectScanner } from '../scanner/jsonl-project-scanner.ts';

const PROJECTS_DIR = '/home/.claude/projects';
const ENCODED_DIR = '-Users-alice-myapp';
const PROJECT_DIR = join(PROJECTS_DIR, ENCODED_DIR);
const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const JSONL_PATH = join(PROJECT_DIR, `${SESSION_ID}.jsonl`);

function makeJsonlContent(lines: Record<string, unknown>[]): string {
  return lines.map((l) => JSON.stringify(l)).join('\n');
}

function makeFs(): FakeFilesystem {
  return new FakeFilesystem();
}

describe('JsonlProjectScanner', () => {
  it('scanProjects returns empty array when projects dir is empty', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, []);
    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    expect(await scanner.scanProjects()).toEqual([]);
  });

  it('scanProjects returns project with sessions', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        {
          type: 'user',
          sessionId: SESSION_ID,
          cwd: '/Users/alice/myapp',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        { type: 'assistant', sessionId: SESSION_ID, timestamp: '2026-01-01T00:00:01.000Z' },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    const projects = await scanner.scanProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.cwd).toBe('/Users/alice/myapp');
    expect(projects[0]?.sessions).toHaveLength(1);
    expect(projects[0]?.sessions[0]?.sessionId).toBe(SESSION_ID);
  });

  it('scanProjects uses decodeProjectDir as fallback when JSONL has no cwd', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        { type: 'user', sessionId: SESSION_ID, timestamp: '2026-01-01T00:00:00.000Z' },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    const projects = await scanner.scanProjects();

    expect(projects[0]?.cwd).toBe('/Users/alice/myapp');
  });

  it('scanSessions skips agent-*.jsonl files', async () => {
    const agentFile = join(PROJECT_DIR, 'agent-sub.jsonl');
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`, 'agent-sub.jsonl']);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        {
          type: 'user',
          sessionId: SESSION_ID,
          cwd: '/Users/alice/myapp',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );
    fs.addFile(
      agentFile,
      makeJsonlContent([
        {
          type: 'user',
          sessionId: 'sub',
          cwd: '/Users/alice/myapp',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    const projects = await scanner.scanProjects();

    expect(projects[0]?.sessions).toHaveLength(1);
    expect(projects[0]?.sessions[0]?.sessionId).toBe(SESSION_ID);
  });

  it('session meta includes title from ai-title entry', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        {
          type: 'user',
          sessionId: SESSION_ID,
          cwd: '/Users/alice/myapp',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        { type: 'ai-title', aiTitle: 'My Session Title' },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    const projects = await scanner.scanProjects();

    expect(projects[0]?.sessions[0]?.title).toBe('My Session Title');
  });

  it('hasSession returns true when the jsonl file exists in any project dir', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        { type: 'user', sessionId: SESSION_ID, cwd: '/x', timestamp: '2026-01-01T00:00:00.000Z' },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    expect(await scanner.hasSession(SESSION_ID)).toBe(true);
  });

  it('hasSession returns false when the jsonl file does not exist', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        { type: 'user', sessionId: SESSION_ID, cwd: '/x', timestamp: '2026-01-01T00:00:00.000Z' },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    expect(await scanner.hasSession('unknown-session-id')).toBe(false);
  });

  it('countEvents returns decodable line count for the session', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        { type: 'user', sessionId: SESSION_ID, cwd: '/x', timestamp: '2026-01-01T00:00:00.000Z' },
        { type: 'assistant', sessionId: SESSION_ID, timestamp: '2026-01-01T00:00:01.000Z' },
        {
          type: 'user',
          sessionId: SESSION_ID,
          isSidechain: true,
          timestamp: '2026-01-01T00:00:02.000Z',
        },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    expect(await scanner.countEvents(SESSION_ID)).toBe(2);
  });

  it('countEvents returns 0 when session does not exist', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, []);

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    expect(await scanner.countEvents('unknown')).toBe(0);
  });

  it('scanProjects populates decodableLines, skipping sidechain entries', async () => {
    const fs = makeFs();
    fs.addDirectory(PROJECTS_DIR, [ENCODED_DIR]);
    fs.addDirectory(PROJECT_DIR, [`${SESSION_ID}.jsonl`]);
    fs.addFile(
      JSONL_PATH,
      makeJsonlContent([
        { type: 'user', sessionId: SESSION_ID, timestamp: '2026-01-01T00:00:00.000Z', cwd: '/x' },
        { type: 'assistant', sessionId: SESSION_ID, timestamp: '2026-01-01T00:00:01.000Z' },
        {
          type: 'user',
          sessionId: SESSION_ID,
          isSidechain: true,
          timestamp: '2026-01-01T00:00:02.000Z',
        },
      ]),
    );

    const scanner = new JsonlProjectScanner(fs, PROJECTS_DIR);
    const projects = await scanner.scanProjects();
    expect(projects[0]?.sessions[0]?.decodableLines).toBe(2);
  });
});
