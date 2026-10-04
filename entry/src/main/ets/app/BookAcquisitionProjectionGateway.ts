import type { JsonObject } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from './ReaderRuntimeOwner';

/** Read-only, exact-identity Core projection. No source/network acquisition. */
export interface BookAcquisitionDetailFacts {
  schemaVersion?: number;
  sourceVersion?: string;
  catalogVersion?: string;
  contextVersion?: string;
  catalogAt?: number;
  verificationCurrent?: boolean;
  stale?: boolean;
}

export interface BookAcquisitionDetailProjection {
  origin: string;
  bookUrl: string;
  contentKind?: 'text' | 'manga' | 'audio';
  name?: string;
  author?: string;
  intro?: string;
  coverUrl?: string;
  kind?: string;
  latestChapterTitle?: string;
  acquisition?: BookAcquisitionDetailFacts;
}

function record(value: unknown, field: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid cached book ${field}`);
  }
  return value as JsonObject;
}

function text(row: JsonObject, field: string): string | undefined {
  const value = row[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`Invalid cached book ${field}`);
  return value;
}

function count(row: JsonObject, field: string): number | undefined {
  const value = row[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
    (field === 'schemaVersion' && !Number.isInteger(value))) throw new Error(`Invalid cached book ${field}`);
  return value;
}

function flag(row: JsonObject, field: string): boolean | undefined {
  const value = row[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new Error(`Invalid cached book ${field}`);
  return value;
}

function contentKind(row: JsonObject): 'text' | 'manga' | 'audio' | undefined {
  const value = text(row, 'contentKind');
  if (value !== undefined && value !== 'text' && value !== 'manga' && value !== 'audio') {
    throw new Error('Invalid cached book contentKind');
  }
  return value;
}

/** This gateway supplies typed cache data, never an inferred write receipt. */
export class BookAcquisitionProjectionGateway {
  private readonly owner: ReaderRuntimeOwner;

  constructor(owner: ReaderRuntimeOwner) { this.owner = owner; }

  async load(sourceId: string, bookId: string,
    isCurrent: () => boolean): Promise<BookAcquisitionDetailProjection | undefined> {
    if (!isCurrent()) return undefined;
    const result = await this.owner.request('search-book.get', { origin: sourceId, bookUrl: bookId }, { canDispatch: isCurrent, canContinue: isCurrent });
    if (!isCurrent()) return undefined;
    const raw = result.data['book'];
    if (raw === undefined || raw === null) return undefined;
    const row = record(raw, 'row');
    // A missing legacy identity is insufficient evidence to replace an admitted
    // detail. Never borrow metadata or readable facts from a same-title row.
    if (row['origin'] !== sourceId || row['bookUrl'] !== bookId) throw new Error('Cached book identity mismatch');
    const projection: BookAcquisitionDetailProjection = { origin: sourceId, bookUrl: bookId,
      name: text(row, 'name'), author: text(row, 'author'), intro: text(row, 'intro'),
      coverUrl: text(row, 'coverUrl'), contentKind: contentKind(row), kind: text(row, 'kind'), latestChapterTitle: text(row, 'latestChapterTitle') };
    if (row['acquisition'] !== undefined && row['acquisition'] !== null) {
      const facts = record(row['acquisition'], 'acquisition');
      projection.acquisition = { schemaVersion: count(facts, 'schemaVersion'),
        sourceVersion: text(facts, 'sourceVersion'), catalogVersion: text(facts, 'catalogVersion'),
        contextVersion: text(facts, 'contextVersion'), catalogAt: count(facts, 'catalogAt'),
        verificationCurrent: flag(facts, 'verificationCurrent'), stale: flag(facts, 'stale') };
    }
    return projection;
  }
}
