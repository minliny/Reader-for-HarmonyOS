import type { BookSource, SourceCheckOutcome } from '../application/SourceGateway';

export interface SourceV9CheckRow {
  source: BookSource;
  outcome?: SourceCheckOutcome;
  error?: string;
}

export function recordSourceV9Check(rows: SourceV9CheckRow[], result: SourceV9CheckRow): SourceV9CheckRow[] {
  const existing = rows.findIndex((row: SourceV9CheckRow): boolean => row.source.sourceId === result.source.sourceId);
  if (existing < 0) return rows.concat([result]);
  // A cancelled or inadmissible retest must not replace completed evidence.
  if (rows[existing].outcome !== undefined && result.outcome === undefined) return rows;
  const next = rows.slice();
  next[existing] = result;
  return next;
}

export async function runSourceV9Checks(sources: BookSource[], current: () => boolean,
  check: (source: BookSource) => Promise<SourceV9CheckRow>,
  publish: (result: SourceV9CheckRow) => void): Promise<void> {
  for (const source of sources) {
    if (!current()) return;
    const result = await check(source);
    if (!current()) return;
    publish(result);
  }
}
