import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeFilesystem } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { decodeSession } from '../jsonl/decoder.ts';
import { JsonlFileReader } from '../reader/jsonl-file-reader.ts';
import { MemoryReader } from '../reader/memory-reader.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SESSION_ID = 'b3dbab57-8da8-40c9-86e8-11aadc1881e8';
const JSONL_PATH = join(FIXTURES, 'b3dbab57.jsonl');
const FIXTURE_CONTENT = readFileSync(JSONL_PATH, 'utf-8');

const mysqlAssistant: string[] = JSON.parse(
  readFileSync(join(FIXTURES, 'b3dbab57-assistant-raw-events.json'), 'utf-8'),
);

function makeFs(): FakeFilesystem {
  const fs = new FakeFilesystem();
  fs.addFile(JSONL_PATH, FIXTURE_CONTENT);
  return fs;
}

describe('JsonlFileReader', () => {
  it('reads assistant events from JSONL file', async () => {
    const reader = new JsonlFileReader(JSONL_PATH, makeFs());
    const { events } = await reader.read(SESSION_ID);
    const assistants = events.filter((e) => JSON.parse(e.raw).type === 'assistant');
    expect(assistants).toHaveLength(64);
  });

  it('assistant message.content matches MySQL raw_events', async () => {
    const reader = new JsonlFileReader(JSONL_PATH, makeFs());
    const { events } = await reader.read(SESSION_ID);
    const assistants = events.filter((e) => JSON.parse(e.raw).type === 'assistant');

    assistants.forEach((event, i) => {
      const original = mysqlAssistant[i];
      if (!original) throw new Error(`No fixture for index ${i}`);
      expect(JSON.parse(event.raw).message.content).toEqual(JSON.parse(original).message.content);
    });
  });

  it('returns session record with correct id and cwd', async () => {
    const reader = new JsonlFileReader(JSONL_PATH, makeFs());
    const { record } = await reader.read(SESSION_ID);
    expect(record.id).toBe(SESSION_ID);
    expect(record.cwd).toBe('/Users/recca0120/WebstormProjects/cc-office');
  });

  it('throws when file not found in Filesystem', async () => {
    const reader = new JsonlFileReader('/nonexistent.jsonl', new FakeFilesystem());
    await expect(reader.read('any')).rejects.toThrow('Cannot read file');
  });
});

describe('decodeSession', () => {
  it('produces same result as JsonlFileReader.read', async () => {
    const lines = FIXTURE_CONTENT.split('\n').filter((l) => l.trim());
    const { events, record } = decodeSession(lines, SESSION_ID);
    const reader = new JsonlFileReader(JSONL_PATH, makeFs());
    const expected = await reader.read(SESSION_ID);
    expect(events).toHaveLength(expected.events.length);
    expect(record.id).toBe(expected.record.id);
    expect(record.cwd).toBe(expected.record.cwd);
  });
});

describe('MemoryReader', () => {
  it('returns empty data for unknown sessionId', async () => {
    const reader = new MemoryReader(new Map());
    const { events } = await reader.read('unknown');
    expect(events).toHaveLength(0);
  });

  it('round-trips with MemoryWriter', async () => {
    const source = new JsonlFileReader(JSONL_PATH, makeFs());
    const { events, record } = await source.read(SESSION_ID);

    const memory = new Map([[SESSION_ID, { events, record }]]);
    const reader = new MemoryReader(memory);
    const result = await reader.read(SESSION_ID);
    expect(result.events).toHaveLength(events.length);
    expect(result.record.id).toBe(SESSION_ID);
  });
});
