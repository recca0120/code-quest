import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeFilesystem } from '@code-quest/test-kit';
import { describe, expect, it } from 'vitest';
import { JsonlFileReader } from '../jsonl-file-reader.ts';
import { JsonlFileWriter } from '../jsonl-file-writer.ts';
import { MemoryWriter } from '../memory.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const SESSION_ID = 'b3dbab57-8da8-40c9-86e8-11aadc1881e8';
const JSONL_PATH = join(FIXTURES, 'b3dbab57.jsonl');
const FIXTURE_CONTENT = readFileSync(JSONL_PATH, 'utf-8');

const jsonlAssistants = FIXTURE_CONTENT.split('\n')
  .filter(Boolean)
  .filter((l) => JSON.parse(l).type === 'assistant');

function makeFs(): FakeFilesystem {
  const fs = new FakeFilesystem();
  fs.addFile(JSONL_PATH, FIXTURE_CONTENT);
  return fs;
}

async function readFixture(): ReturnType<JsonlFileReader['read']> {
  return new JsonlFileReader(JSONL_PATH, makeFs()).read(SESSION_ID);
}

describe('JsonlFileWriter', () => {
  const OUT_PATH = '/fake/out.jsonl';

  it('writes assistant entries with correct message.content', async () => {
    const fakeFs = new FakeFilesystem();
    const data = await readFixture();
    await new JsonlFileWriter(OUT_PATH, fakeFs).write(SESSION_ID, data);

    const written = fakeFs.getFile(OUT_PATH)!.split('\n').filter(Boolean);
    const assistants = written.filter((l) => JSON.parse(l).type === 'assistant');
    expect(assistants).toHaveLength(jsonlAssistants.length);
    assistants.forEach((line, i) => {
      const original = jsonlAssistants[i];
      if (!original) throw new Error(`No fixture for index ${i}`);
      expect(JSON.parse(line).message.content).toEqual(JSON.parse(original).message.content);
    });
  });

  it('skips stream_event entries', async () => {
    const fakeFs = new FakeFilesystem();
    const data = await readFixture();
    await new JsonlFileWriter(OUT_PATH, fakeFs).write(SESSION_ID, data);
    const written = fakeFs.getFile(OUT_PATH)!.split('\n').filter(Boolean);
    expect(written.filter((l) => JSON.parse(l).type === 'stream_event')).toHaveLength(0);
  });

  it('throws when Filesystem write fails', async () => {
    const data = await readFixture();
    const fakeFs = new FakeFilesystem();
    fakeFs.failNextWrite('/tmp/fail.jsonl');
    await expect(
      new JsonlFileWriter('/tmp/fail.jsonl', fakeFs).write(SESSION_ID, data),
    ).rejects.toThrow('Cannot write file');
  });

  it('writes correct message.content for first assistant entry', async () => {
    const fakeFs = new FakeFilesystem();
    const data = await readFixture();
    const outPath = '/tmp/test-output.jsonl';
    await new JsonlFileWriter(outPath, fakeFs).write(SESSION_ID, data);

    const content = fakeFs.getFile(outPath);
    expect(content).toBeDefined();
    const assistants = content!
      .split('\n')
      .filter(Boolean)
      .filter((l) => JSON.parse(l).type === 'assistant');
    expect(assistants).toHaveLength(jsonlAssistants.length);
    expect(JSON.parse(assistants[0]!).message.content).toEqual(
      JSON.parse(jsonlAssistants[0]!).message.content,
    );
  });
});

describe('MemoryWriter', () => {
  it('stores written data accessible via .data', async () => {
    const source = await readFixture();
    const writer = new MemoryWriter();
    await writer.write(SESSION_ID, source);
    const stored = writer.data.get(SESSION_ID);
    expect(stored?.events).toHaveLength(source.events.length);
    expect(stored?.record.id).toBe(SESSION_ID);
  });
});
