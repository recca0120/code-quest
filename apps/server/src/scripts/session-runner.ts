import type {
  ExportableSession,
  ImportStatusEntry,
  SessionMigrator,
} from '@code-quest/session-store';
import { checkbox, Separator, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import type { SessionTransfer } from '../services/session-transfer.ts';
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

export class SessionRunner {
  private readonly scanner: SessionMigrator;
  private readonly transfer: SessionTransfer;

  constructor(scanner: SessionMigrator, transfer: SessionTransfer) {
    this.scanner = scanner;
    this.transfer = transfer;
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
    const spinner = ora('Scanning ~/.claude/projects/').start();
    const projects = await this.scanner.scanProjects();
    spinner.stop();

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

      const statusSpinner = ora('Loading session statuses').start();
      const sessionStatuses = await this.scanner.resolveImportStatuses(
        projectChoice.sessions,
        projectChoice.importedIds,
      );
      statusSpinner.stop();

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
        (s): s is ImportStatusEntry & { session: { filePath: string } } =>
          s.session.filePath != null,
      );
      if (withPath.length === 0) continue;

      await runBatch(
        withPath,
        ({ session }) => session.sessionId.slice(0, 8),
        ({ session }) => this.transfer.importSession(session.filePath),
      );
    }
  }

  private async runExport(): Promise<void> {
    const spinner = ora('Loading exportable sessions').start();
    const projects = (await this.scanner.scanExportable()).sort(
      (a, b) => b.sessions.length - a.sessions.length,
    );
    spinner.stop();

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
        (s) => this.transfer.exportSession(s.session.sessionId, s.filePath),
      );
    }
  }
}
