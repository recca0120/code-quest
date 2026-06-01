import type { ExportableSession, ImportStatus, SessionSummary } from '@code-quest/session-store';
import { Separator } from '@inquirer/prompts';
import chalk from 'chalk';

export type DateGroup = 'Today' | 'This Week' | 'Older';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return chalk.dim(`${(bytes / 1024 / 1024).toFixed(1)}MB`);
  return chalk.dim(`${Math.round(bytes / 1024)}KB`);
}

function getDateGroup(createdAt?: string): DateGroup {
  if (!createdAt) return 'Older';
  const d = new Date(createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - d.getTime()) / MS_PER_DAY;
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return 'This Week';
  return 'Older';
}

const IMPORT_LABEL: Record<ImportStatus, string> = {
  NOT_IMPORTED: 'NOT_IMPORTED'.padEnd(12),
  PARTIAL: chalk.yellow('PARTIAL'.padEnd(12)),
  IMPORTED: chalk.gray('IMPORTED'.padEnd(12)),
};

export function formatImportSession(session: SessionSummary, status: ImportStatus): string {
  const label = IMPORT_LABEL[status];
  const date = chalk.gray((session.createdAt ?? '????-??-??').slice(0, 10));
  const size = formatSize(session.sizeBytes ?? 0);
  const title = (session.title ?? session.sessionId.slice(0, 8)).slice(0, 45);
  return `${label}  ${date}  ${size.padEnd(8)}  ${title}`;
}

export function formatExportSession(s: ExportableSession): string {
  const label = s.status === 'EXPORTED' ? chalk.gray(s.status.padEnd(12)) : s.status.padEnd(12);
  const date = chalk.gray((s.session.createdAt ?? '????-??-??').slice(0, 10));
  const title = (s.session.title ?? s.session.sessionId.slice(0, 8)).slice(0, 50);
  return `${label}  ${date}  ${title}`;
}

export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string | undefined,
): { label: DateGroup; items: T[] }[] {
  const groups: { label: DateGroup; items: T[] }[] = [
    { label: 'Today', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const item of items) {
    const group = getDateGroup(getDate(item));
    groups.find((g) => g.label === group)?.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

export type ChoiceItem<T> = {
  name: string;
  value: T | null;
  checked?: boolean;
  disabled?: string | boolean;
};

export function buildGroupedChoices<T>(
  groups: { label: DateGroup; items: T[] }[],
  formatItem: (item: T) => { name: string; checked: boolean; disabled: string | false },
): Array<Separator | ChoiceItem<T>> {
  const choices: Array<Separator | ChoiceItem<T>> = [];
  for (const group of groups) {
    choices.push(new Separator(chalk.bold(`──── ${group.label} ────`)));
    for (const item of group.items) {
      const { name, checked, disabled } = formatItem(item);
      choices.push({ name, value: item, checked, disabled });
    }
  }
  choices.push(new Separator());
  choices.push({ name: chalk.dim('← Back'), value: null });
  return choices;
}
