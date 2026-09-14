import type { SearchBook } from './SearchGateway';

/** Reader admission facts, scoped to the exact source rule version. */
export function searchCandidateRank(book: SearchBook, now: number = Date.now()): number {
  const facts = book.acquisition;
  if (facts === undefined || facts['sourceVersion'] !== book.sourceRuleVersion ||
    facts['stale'] === true || book.sourceRuleVersion.length === 0) return 2;
  const catalogAt = typeof facts['catalogAt'] === 'number' ? facts['catalogAt'] as number : 0;
  const readableAt = typeof facts['readableAt'] === 'number' ? facts['readableAt'] as number : 0;
  const failure = facts['failure'] as Record<string, unknown> | undefined;
  const failureAt = typeof failure?.['at'] === 'number' ? failure['at'] as number : 0;
  if (failureAt > Math.max(catalogAt, readableAt) && now - failureAt < 86400000) return 3;
  if (catalogAt <= 0 || now - catalogAt >= 86400000) return 2;
  return readableAt >= catalogAt ? 0 : 1;
}
