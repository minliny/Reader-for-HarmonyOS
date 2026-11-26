import type { JsonObject } from '@reader/core-harmony';
import type { SourceCheckOutcome, SourceImportCandidate, SourceImportFailure } from './SourceGateway';

export type SourceV9TransferPane = 'import' | 'subscriptions';
export type SourceV9ImportOrigin = 'file' | 'url' | 'paste';
export type SourceV9Depth = 'L2' | 'L4' | 'L5';
export type SourceV9Mode = 'search' | 'explore';
export type SourceV9GroupStrategy = 'preserve' | 'fill' | 'all';

interface SourceV9CheckEvidence {
  report?: SourceCheckOutcome;
  observedAtMs?: number;
  previousReport?: { report: SourceCheckOutcome; observedAtMs?: number };
}

export function retireV9CheckReport<T extends SourceV9CheckEvidence>(row: T): T {
  if (row.report === undefined) return row;
  return { ...row, previousReport: { report: row.report, observedAtMs: row.observedAtMs },
    report: undefined, observedAtMs: undefined };
}

export interface SourceV9ImportRow extends SourceV9CheckEvidence {
  index: number;
  candidate?: SourceImportCandidate;
  problem?: string;
  selected: boolean;
  deselectedByCheck?: boolean;
}

export interface SourceV9ImportedReport {
  sourceId: string;
  candidate: JsonObject;
  report: SourceCheckOutcome;
  observedAtMs?: number;
  sourceVersion?: string;
}

export type SourceV9ChangeKind = 'added' | 'update' | 'conflict' | 'removedRemote' | 'unchanged' | 'localOnly';

export interface SourceV9Change extends SourceV9CheckEvidence {
  key: string;
  name: string;
  kind: SourceV9ChangeKind;
  selectable: boolean;
  selected: boolean;
  overwrite: boolean;
  sourceId?: string;
  expectedVersion?: string;
  candidate?: JsonObject;
  rule?: JsonObject;
}

export function buildV9ImportRows(items: SourceImportCandidate[], failures: SourceImportFailure[]): SourceV9ImportRow[] {
  const rows = items.map((candidate: SourceImportCandidate): SourceV9ImportRow => ({
    index: candidate.index, candidate, selected: candidate.supported,
  }));
  for (const failure of failures) rows.push({ index: failure.index, problem: failure.message, selected: false });
  return rows.sort((left: SourceV9ImportRow, right: SourceV9ImportRow): number => left.index - right.index);
}

export function chooseV9ImportRow(rows: SourceV9ImportRow[], index: number, selected: boolean): SourceV9ImportRow[] {
  return rows.map((row: SourceV9ImportRow): SourceV9ImportRow =>
    row.index === index && row.candidate?.supported === true ? { ...row, selected, deselectedByCheck: false } : row);
}

export function assignV9ImportSelection(rows: SourceV9ImportRow[], selected: boolean,
  passedOnly: boolean = false): SourceV9ImportRow[] {
  return rows.map((row: SourceV9ImportRow): SourceV9ImportRow => ({
    ...row, selected: selected && row.candidate?.supported === true && (!passedOnly || row.report?.available === true),
    deselectedByCheck: false,
  }));
}

export function resetV9ImportChecks(rows: SourceV9ImportRow[]): SourceV9ImportRow[] {
  return rows.map((row: SourceV9ImportRow): SourceV9ImportRow => ({
    ...row, selected: row.candidate?.supported === true && (row.selected || row.deselectedByCheck === true),
    deselectedByCheck: false, report: undefined, previousReport: undefined, observedAtMs: undefined,
  }));
}

export function applyV9ImportReport(rows: SourceV9ImportRow[], index: number, report: SourceCheckOutcome,
  observedAtMs: number): SourceV9ImportRow[] {
  return rows.map((row: SourceV9ImportRow): SourceV9ImportRow => {
    if (row.index !== index || row.candidate?.supported !== true) return row;
    const positionalFailure = report.oneRowEphemeralL1Failure === true && report.sourceId === 'ephemeral:1' && !report.available;
    if (row.candidate.sourceId !== report.sourceId && !positionalFailure) return row;
    return { ...row, report, observedAtMs, previousReport: undefined, selected: row.selected && report.available,
      deselectedByCheck: !report.available && (row.selected || row.deselectedByCheck === true) };
  });
}

export function sourceV9SelectedImportRows(rows: SourceV9ImportRow[]): SourceImportCandidate[] {
  const selected: SourceImportCandidate[] = [];
  for (const row of rows) {
    const candidate = row.candidate;
    if (row.selected && candidate?.supported === true) selected.push(candidate);
  }
  return selected;
}

export function sourceV9ImportedReports(rows: SourceV9ImportRow[], importedSourceIds: string[]): SourceV9ImportedReport[] {
  const imported = new Set(importedSourceIds);
  const reports: SourceV9ImportedReport[] = [];
  for (const row of rows) {
    if (row.candidate?.supported === true && row.report?.sourceId === row.candidate.sourceId &&
      imported.has(row.candidate.sourceId)) {
      reports.push({ sourceId: row.candidate.sourceId, candidate: row.candidate.bookSource,
        report: row.report, observedAtMs: row.observedAtMs });
    }
  }
  return reports;
}

export function sourceV9ChangesToApply(rows: SourceV9Change[]): SourceV9Change[] {
  return rows.filter((row: SourceV9Change): boolean => row.selectable && row.selected &&
    (row.kind === 'added' || row.kind === 'update' || (row.kind === 'conflict' && row.overwrite)));
}

export function sourceV9Levels(depth: SourceV9Depth): string[] {
  return ['L1', 'L2', 'L3', 'L4', 'L5'].slice(0, Number(depth.slice(1)));
}

export const SOURCE_V9_IMPORT_CHECK_CONCURRENCY = 8;

/** Stopping makes the dispatched request's cancellation predicate false.
 * A late result cannot become evidence or cause another dispatch. */
export async function runV9CandidateChecks<T, R>(rows: T[], current: () => boolean, execute: (row: T) => Promise<R>,
  started: (row: T) => void, completed: (row: T, report: R) => void, failed: (row: T) => void,
  concurrency: number = 1): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < rows.length) {
      if (!current()) return;
      const row = rows[next];
      next += 1;
      started(row);
      if (!current()) return;
      let report: R;
      try {
        report = await execute(row);
      } catch (_) {
        if (!current()) return;
        failed(row);
        continue;
      }
      if (!current()) return;
      completed(row, report);
    }
  };
  const limit = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;
  const width = Math.min(limit, rows.length);
  const workers: Promise<void>[] = [];
  for (let index = 0; index < width; index += 1) workers.push(worker());
  await Promise.all(workers);
}

export function sourceV9CanonicalDocument(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map((item: unknown): string => sourceV9CanonicalDocument(item)).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const object = value as JsonObject;
    const parts = Object.keys(object).sort().map((key: string): string =>
      JSON.stringify(key) + ':' + sourceV9CanonicalDocument(object[key]));
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Comparison only. Core still parses and stores the original replacement-rule DTO. */
export function sourceV9ReplaceRuleComparable(rule: JsonObject): string {
  const defaults: JsonObject = {
    name: '', pattern: '', replacement: '', scopeTitle: false, scopeSource: false,
    scopeContent: true, isEnabled: true, isRegex: true, timeoutMillisecond: 3000, order: 0,
  };
  const comparable: JsonObject = { ...defaults, ...rule };
  for (const key of ['group', 'scope', 'excludeScope']) {
    if (comparable[key] === null) delete comparable[key];
  }
  return sourceV9CanonicalDocument(comparable);
}
