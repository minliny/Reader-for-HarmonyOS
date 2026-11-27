import type { JsonObject } from '@reader/core-harmony';
import { sourceV9CanonicalDocument, type SourceV9ImportedReport, type SourceV9Change } from './SourceV9TransferState.ts';

export interface StoredSourceTransferEvidence {
  sourceVersion: string;
  bookSource: JsonObject;
}

export function storedSourceTransferEvidence(rows: unknown, selected: Set<string>): Map<string, StoredSourceTransferEvidence> {
  const indexed = new Map<string, StoredSourceTransferEvidence>();
  const seen = new Set<string>();
  if (!Array.isArray(rows)) return indexed;
  for (const item of rows) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as JsonObject;
    const id = row['sourceId'];
    if (typeof id !== 'string' || !selected.has(id)) continue;
    if (seen.has(id)) { indexed.delete(id); continue; }
    seen.add(id);
    const raw = row['bookSource'];
    const version = row['sourceVersion'];
    if (typeof version === 'string' && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      indexed.set(id, { sourceVersion: version, bookSource: raw as JsonObject });
    }
  }
  return indexed;
}

export function qualifySourceTransferReports(reports: SourceV9ImportedReport[],
  stored: Map<string, StoredSourceTransferEvidence>): SourceV9ImportedReport[] {
  const verified: SourceV9ImportedReport[] = [];
  for (const report of reports) {
    const digest = report.report.report?.ruleDigest;
    const entry = stored.get(report.sourceId);
    if (report.report.sourceId !== report.sourceId || digest === undefined || entry?.sourceVersion !== digest) continue;
    if (sourceV9CanonicalDocument(entry.bookSource) === sourceV9CanonicalDocument(report.candidate)) {
      verified.push({ ...report, sourceVersion: digest });
    }
  }
  return verified;
}

export function remainingSourceReviewRows(rows: SourceV9Change[], confirmed: Set<string>): SourceV9Change[] {
  return rows.filter((row: SourceV9Change): boolean => !confirmed.has(row.key));
}
