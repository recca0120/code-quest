import { basename } from 'node:path';
import type { Filesystem } from '@code-quest/filesystem';
import type {
  ExportableSession,
  ImportStatusEntry,
  SessionReader,
  SessionScanner,
  SessionWriter,
} from '@code-quest/session-store';
import { JsonlFileReader, JsonlFileWriter, Transfer } from '@code-quest/session-store';
import { checkbox, Separator, select } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  buildGroupedChoices,
  formatExportSession,
  formatImportSession,
  groupByDate,
} from './session-manager-format.ts';

async function selectProject<T extends { cwd: string; sessions: unknown[] }>(
  message: string,
  projects: T[],
  formatCount: (p: T) => string,
): Promise<T | null> {
  return select({
    message,
    choices: [
      ...projects.map((p) => ({
        name: `${p.cwd}   ${chalk.gray(`${String(p.sessions.length)} sessions`)} · ${formatCount(p)}`,
        value: p,
      })),
      new Separator(),
      { name: chalk.dim('← Back'), value: null },
    ],
  });
}

async function runBatch<T>(
  items: T[],
  getLabel: (item: T) => string,
  action: (item: T) => Promise<void>,
): Promise<void> {
  console.log(`\nProcessing ${items.length} session(s)...`);
  for (const item of items) {
    process.stdout.write(`  ${chalk.dim(getLabel(item))}... `);
    await action(item);
    console.log(chalk.green('✓'));
  }
  console.log(chalk.green(`\nDone. ${items.length} session(s) processed.\n`));
}

// ── SessionManager class ──────────────────────────────────────────────────

export class SessionManager {
  private readonly scanner: SessionScanner;
  private readonly reader: SessionReader;
  private readonly writer: SessionWriter;
  private readonly filesystem: Filesystem;

  constructor(
    scanner: SessionScanner,
    reader: SessionReader,
    writer: SessionWriter,
    filesystem: Filesystem,
  ) {
    this.scanner = scanner;
    this.reader = reader;
    this.writer = writer;
    this.filesystem = filesystem;
  }

  async importSession(jsonlPath: string): Promise<void> {
    const sessionId = basename(jsonlPath, '.jsonl');
    await new Transfer(new JsonlFileReader(jsonlPath, this.filesystem), this.writer).run(sessionId);
  }

  async exportSession(sessionId: string, outputPath: string): Promise<void> {
    await new Transfer(this.reader, new JsonlFileWriter(outputPath, this.filesystem)).run(
      sessionId,
    );
  }

  async run(): Promise<void> {
    console.log(chalk.bold.cyan('\n── Session Manager ──\n'));

    while (true) {
      const action = await select({
        message: 'What do you want to do?',
        choices: [
          { name: `Import  ${chalk.dim('JSONL → DB')}`, value: 'import' },
          { name: `Export  ${chalk.dim('DB → JSONL')}`, value: 'export' },
          new Separator(),
          { name: 'Exit', value: 'exit' },
        ],
      });

      if (action === 'exit') break;
      else if (action === 'import') await this.runImport();
      else if (action === 'export') await this.runExport();
    }

    console.log(chalk.dim('\nBye.\n'));
  }

  private async runImport(): Promise<void> {
    console.log(chalk.dim('\nScanning ~/.claude/projects/ ...'));
    const projects = await this.scanner.scanProjects();

    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    while (true) {
      const projectChoice = await selectProject(
        `Select a project  ${chalk.dim('[import mode]')}`,
        projects,
        (p) =>
          p.notImportedCount > 0
            ? chalk.yellow(`${p.notImportedCount} not imported`)
            : chalk.gray('all imported'),
      );
      if (!projectChoice) break;

      console.log(chalk.dim('\nLoading session statuses...'));
      const sessionStatuses = await this.scanner.resolveImportStatuses(
        projectChoice.sessions,
        projectChoice.importedIds,
      );

      const groups = groupByDate(sessionStatuses, ({ session }) => session.createdAt);
      const choices = buildGroupedChoices(groups, ({ session, status }) => ({
        name: formatImportSession(session, status),
        checked: status === 'NOT_IMPORTED' || status === 'PARTIAL',
        disabled: status === 'IMPORTED' ? chalk.gray('(already imported)') : false,
      }));

      const toImport = await checkbox({
        message: `${projectChoice.cwd} — select sessions to import`,
        choices,
      });

      const selected = toImport.filter((s): s is ImportStatusEntry => s !== null);
      const withPath = selected.filter(
        (s): s is ImportStatusEntry & { session: { jsonlPath: string } } =>
          s.session.jsonlPath != null,
      );
      if (withPath.length === 0) continue;

      await runBatch(
        withPath,
        ({ session }) => session.sessionId.slice(0, 8),
        ({ session }) => this.importSession(session.jsonlPath),
      );
    }
  }

  private async runExport(): Promise<void> {
    console.log(chalk.dim('\nLoading exportable sessions...'));
    const projects = (await this.scanner.scanExportable()).sort(
      (a, b) => b.sessions.length - a.sessions.length,
    );

    if (projects.length === 0) {
      console.log('No exportable sessions found.');
      return;
    }

    while (true) {
      const projectChoice = await selectProject(
        `Select a project  ${chalk.dim('[export mode]')}`,
        projects,
        (p) =>
          p.notExportedCount > 0
            ? chalk.cyan(`${p.notExportedCount} exportable`)
            : chalk.gray('all exported'),
      );
      if (!projectChoice) break;

      const exportGroups = groupByDate(projectChoice.sessions, (s) => s.session.createdAt);
      const choices = buildGroupedChoices(exportGroups, (s) => ({
        name: formatExportSession(s),
        checked: s.status === 'NOT_EXPORTED',
        disabled: s.status === 'EXPORTED' ? chalk.gray('(already exported)') : false,
      }));

      const toExport = await checkbox({
        message: `${projectChoice.cwd} — select sessions to export`,
        choices,
      });

      const selected = toExport.filter((s): s is ExportableSession => s !== null);
      if (selected.length === 0) continue;

      await runBatch(
        selected,
        (s) => s.session.sessionId.slice(0, 8),
        (s) => this.exportSession(s.session.sessionId, s.jsonlPath),
      );
    }
  }
}
