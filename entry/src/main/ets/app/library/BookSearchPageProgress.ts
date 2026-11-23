import type { JsonObject } from '@reader/core-harmony';

export interface BookSearchPageReceipt {
  sourceId: string;
  sourceVersion?: string;
  query: string;
  requestedPage: number;
  state: 'next' | 'end' | 'unknown';
  nextPage?: number;
  requestFingerprint?: string;
  responseFingerprint: string;
  candidateFingerprint: string;
  reason?: string;
}

/** Validates only Core acquisition facts. AnalyzeUrl and rule parsing stay in Core. */
export function readBookSearchPageReceipt(raw: unknown, sourceId: string, sourceVersion: string | undefined,
  query: string, requestedPage: number): BookSearchPageReceipt {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('book.search page receipt missing');
  const value = raw as JsonObject;
  const state = value['state'];
  const digest = (key: string, optional: boolean = false): string | undefined => {
    const text = value[key];
    if (optional && text === undefined) return undefined;
    if (typeof text !== 'string' || !/^[0-9a-f]{64}$/.test(text)) throw new Error('book.search page fingerprint invalid');
    return text;
  };
  if (value['sourceId'] !== sourceId || value['query'] !== query || value['requestedPage'] !== requestedPage ||
    !Number.isSafeInteger(requestedPage) || requestedPage < 1 ||
    (state !== 'next' && state !== 'end' && state !== 'unknown') ||
    (sourceVersion !== undefined && value['sourceVersion'] !== sourceVersion) ||
    (value['sourceVersion'] !== undefined && (typeof value['sourceVersion'] !== 'string' || (value['sourceVersion'] as string).length === 0)) ||
    (state === 'next' ? value['nextPage'] !== requestedPage + 1 : value['nextPage'] !== undefined)) {
    throw new Error('book.search page receipt identity invalid');
  }
  const request = digest('requestFingerprint', state === 'unknown');
  return { sourceId, sourceVersion: value['sourceVersion'] as string | undefined, query, requestedPage, state,
    nextPage: state === 'next' ? value['nextPage'] as number : undefined, requestFingerprint: request,
    responseFingerprint: digest('responseFingerprint')!, candidateFingerprint: digest('candidateFingerprint')!,
    reason: typeof value['reason'] === 'string' ? value['reason'] as string : undefined };
}

/** One query/source owns its exact uncompleted page. First-round completion,
 * exhaustion, failed dispatch and no progress remain separate facts. */
export class BookSearchPageProgress {
  page: number = 1;
  state: 'ready' | 'end' | 'unknown' | 'satisfied' = 'ready';
  reason: string = '';
  private readonly requests: Map<string, number> = new Map<string, number>();
  private readonly responses: Map<string, number> = new Map<string, number>();
  private readonly candidates: Map<string, number> = new Map<string, number>();

  private readonly bookIds: Set<string> = new Set<string>();
  accept(receipt: BookSearchPageReceipt | undefined, bookIds?: string[]): void {
    if (receipt === undefined) { this.state = 'unknown'; this.reason = 'legacyReceipt'; return; }
    let newBooks = 0;
    if (bookIds !== undefined) for (const id of bookIds) { if (!this.bookIds.has(id)) { this.bookIds.add(id); newBooks += 1; } }
    if (receipt.state === 'next' && bookIds !== undefined && bookIds.length > 0 && newBooks === 0) {
      this.state = 'unknown'; this.reason = 'noNewCandidates'; return;
    }
    if (receipt.requestedPage !== this.page) throw new Error('book.search page order changed');
    if ((receipt.requestFingerprint !== undefined && this.requests.has(receipt.requestFingerprint) && this.requests.get(receipt.requestFingerprint) !== receipt.requestedPage) ||
      this.responses.has(receipt.responseFingerprint) && this.responses.get(receipt.responseFingerprint) !== receipt.requestedPage || this.candidates.has(receipt.candidateFingerprint) && this.candidates.get(receipt.candidateFingerprint) !== receipt.requestedPage) {
      this.state = 'unknown'; this.reason = 'noProgress'; return;
    }
    if (receipt.requestFingerprint !== undefined) this.requests.set(receipt.requestFingerprint,receipt.requestedPage);
    this.responses.set(receipt.responseFingerprint,receipt.requestedPage); this.candidates.set(receipt.candidateFingerprint,receipt.requestedPage);
    if (receipt.state === 'end') this.state = 'end';
    else if (receipt.state === 'unknown') { this.state = 'unknown'; this.reason = receipt.reason ?? 'unverifiedResponse'; }
    else { this.page = receipt.nextPage!; this.state = 'ready'; }
  }
}
