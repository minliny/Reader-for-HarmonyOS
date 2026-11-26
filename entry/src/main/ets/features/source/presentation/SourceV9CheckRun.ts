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

/** Batch checks are network bound; a small worker pool keeps dead hosts from serialising the batch. */
export const SOURCE_V9_BATCH_CHECK_CONCURRENCY = 8;

export async function runSourceV9Checks(sources: BookSource[], current: () => boolean,
  check: (source: BookSource) => Promise<SourceV9CheckRow>,
  publish: (result: SourceV9CheckRow) => void, concurrency: number = 1): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < sources.length) {
      if (!current()) return;
      const source = sources[next];
      next += 1;
      const result = await check(source);
      if (!current()) return;
      publish(result);
    }
  };
  const limit = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;
  const width = Math.min(limit, sources.length);
  const workers: Promise<void>[] = [];
  for (let index = 0; index < width; index += 1) workers.push(worker());
  await Promise.all(workers);
}
