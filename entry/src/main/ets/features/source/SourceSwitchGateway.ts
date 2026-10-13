import { bookAuthorIdentity, readBookAuthorIdentity, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
import { readBookSearchTiming } from '../common/BookSearchTiming';
import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';
import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import { runBookSourceWorkers } from '../../app/BookRequestScheduler';
import type { RemoteReadingVariable } from '../reading/RemoteReadingContract';
import type { RemoteReadingBookSeed, RemoteReadingSession, RemoteReadingTocEntry } from '../reading/RemoteReadingFlowGateway';
import { errorMessageOf, isDomainResolutionFailure, isNetworkEnvironmentFailure } from '../../app/ErrorMessage';
import { acquisitionCandidateRank, acquisitionReadableCurrent, acquisitionBookFailureCurrent,
  acquisitionAttemptFailureCurrent } from '../common/BookAcquisitionPresentation';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryIsReadable,
  type ReaderSourceCategory,
} from './ReaderSourceCategory';
import { sourceSwitchProviderFamilyKey } from './SourceSwitchProviderFamily';
import { decodeBookSearchResult, type SearchSource } from '../search/SearchGateway';

// Legado caps ChangeBookSourceDialog at nine workers. Keep one lane in reserve
// for the foreground reading session while avoiding one unbounded request per
// imported source.
const SOURCE_SWITCH_DISCOVERY_CONCURRENCY = 8;
const SOURCE_SWITCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Page-facing source-switch candidate. Discovery supplies the stable book
 * identity; the detail/TOC/content probe supplies the chapter and response
 * time fields persisted through Core `search-book.*` storage.
 */
export type SourceSwitchCandidate = {
  acquisitionState?: 'discovered' | 'catalogReady' | 'readable' | 'failed' | 'attemptFailed' | 'stale';
  acquisitionMessage?: string;
  verifiedChapterUrl?: string;
  sourceVersion?: string;
  searchVariables?: RemoteReadingVariable[];
  sourceId: string;
  sourceName?: string;
  /** Display-only provider family; sourceId/bookUrl remain the identity. */
  providerFamily?: string;
  providerFamilyCount?: number;
  category: ReaderSourceCategory;
  sourceOrder?: number;
  bookUrl: string;
  bookName: string;
  author?: string;
  authorIdentity?: BookAuthorIdentityProof;
  coverUrl?: string;
  latestChapterTitle?: string;
  currentChapterTitle?: string;
  currentChapterIndex?: number;
  chapterWordCount?: number;
  checkedAt?: number;
  /** Version-bound source search duration; never first-image/content latency. */
  latencyMs?: number;
  latencyKind?: 'search';
  latencyMeasuredAt?: number;
  offline?: boolean;
  timeout?: boolean;
  isCurrent?: boolean;
};

export type SourceSwitchProbeQuery = {
  contentKind?: 'text' | 'manga';
  sourceId: string;
  bookId: string;
  bookName: string;
  author: string;
  authorIdentity?: BookAuthorIdentityProof;
  sourceVersion?: string;
  currentChapterIndex: number;
  currentChapterTitle: string;
};

type SourceSwitchRegistryEntry = {
  sourceId: string;
  sourceName: string;
  sourceOrder: number;
  sourceVersion?: string;
  category: ReaderSourceCategory;
  baseUrl?: string;
  providerFamily: string;
};

type SourceSwitchCachedChapter = {
  title: string;
  index?: number;
};

type SourceSwitchSearchSample = {
  sourceVersion?: string;
  latencyMs: number;
  measuredAt: number;
};

/** Shared by live Search seeds and persisted candidate projection. Legacy
 * body respondTime and timing from another source rule are never admitted. */
export const readSourceSwitchSearchTiming = readBookSearchTiming;

/** Stable identity shared by discovery, rendering, and click admission. */
export function sourceSwitchCandidateKey(sourceId: string, bookUrl: string): string {
  return `${sourceId.length}:${sourceId}:${bookUrl.length}:${bookUrl}`;
}

/** Match the search card's distinct-source unit; alternate URLs stay selectable. */
export function sourceSwitchSourceCount(candidates: SourceSwitchCandidate[]): number {
  const sources = new Set<string>();
  // Status text counts selectable source identities. Provider-family folding
  // only changes the visible row; sourceId/bookUrl remain the exact action
  // target and alternate rules must still be counted as distinct sources.
  for (const candidate of candidates) sources.add(candidate.sourceId);
  return sources.size;
}

/** The current shelf binding is context, not a selectable alternate source. */
export function sourceSwitchIsAlternative(candidate: SourceSwitchCandidate): boolean {
  return candidate.isCurrent !== true;
}

function deduplicateSourceSwitchCandidates(
  candidates: SourceSwitchCandidate[],
): SourceSwitchCandidate[] {
  const result: SourceSwitchCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export type SourceSwitchDiscoveryOutcome =
  | { kind: 'sources'; candidates: SourceSwitchCandidate[] }
  | { kind: 'noSources' };

export type SourceSwitchTargetTocEntry = {
  index: number;
  title: string;
  url: string;
  variables: JsonObject;
};

export type SourceSwitchTargetToc = {
  /** The already acquired catalog/context is handed to the existing reader. */
  readingSession: RemoteReadingSession;
  sourceId: string;
  bookId: string;
  bookName: string;
  author: string;
  coverUrl?: string;
  latestChapterTitle?: string;
  intro?: string;
  kind?: string;
  tocUrl: string;
  variables: JsonObject;
  entries: SourceSwitchTargetTocEntry[];
};

export type SourceSwitchNewTocEntry = {
  chapterId: string;
  chapterTitle: string;
  chapterUrl: string;
  order: number;
};

export type SourceSwitchTarget = {
  sourceId: string;
  bookId: string;
  title: string;
  author?: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
};

export type SourceSwitchCommitParams = {
  operationId?: string;
  sequence?: number;
  from: { sourceId: string; bookId: string };
  target: SourceSwitchTarget;
  newToc: SourceSwitchNewTocEntry[];
  currentChapterTitle: string;
  currentChapterIndex: number;
  updatedAt: number;
};

export interface SourceSwitchOperationHead { operationId: string; sequence: number; }
export interface SourceSwitchTransactionProjection {
  operationId: string;
  sequence: number;
  payloadFingerprint: string;
  from: { sourceId: string; bookId: string };
  target: { sourceId: string; bookId: string };
  phase: 'pending' | 'finalized' | 'rolledBack';
  commit: SourceSwitchCommittedOutcome;
  restoredBook?: ShelfBook;
}
export interface SourceSwitchOperationQuery {
  head?: SourceSwitchOperationHead;
  transaction?: SourceSwitchTransactionProjection;
}

/** Core-owned durable transaction identity. Harmony never receives the journal. */
export type SourceSwitchTransactionId = string;

export type SourceSwitchCommitOutcome =
  | SourceSwitchCommittedOutcome
  | { status: 'failed'; error: string; transactionId?: SourceSwitchTransactionId };

export interface SourceSwitchCommittedOutcome {
    status: 'success';
    book: ShelfBook;
    matchedChapter: SourceSwitchNewTocEntry;
    transactionId: SourceSwitchTransactionId;
}

export type SourceSwitchRollbackResult = {
  transactionId: SourceSwitchTransactionId;
  changed: boolean;
  restoredBook: ShelfBook;
};

export type PendingSourceSwitch = {
  transactionId: SourceSwitchTransactionId;
  fromSourceId: string;
  fromBookId: string;
  targetSourceId: string;
  targetBookId: string;
};

/**
 * Feature-local gateway for the source-switch flow. Owns the
 * `change.bookSource` / `book.detail` / `book.toc` / `source.switch.commit` /
 * `source.switch.rollback` boundary and validates every JSON envelope before
 * the panel sees it.
 *
 * `book.search`, `book.detail`, and `book.toc` are remote commands that
 * delegate the HTTP round-trip to the Host via `http.execute`. Host transport
 * limits surface as a plain Error, which Index presents through the admitted
 * discovery/failure state. The wire contract is authoritative regardless.
 */
export class SourceSwitchGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private readonly normalizedMatchText = new Map<string, string>();
  private cachedSources: Map<string, SourceSwitchRegistryEntry> | undefined;
  private cachedNonReadableSourceIds = new Set<string>();
  private cachedSourceRevision: number | undefined;
  private confirmedScope: string = '';
  private confirmedCandidates = new Set<string>();
  private discoveryGeneration: number = 0;
  private discoveryScope: string = '';
  private discoverySamples = new Map<string, SourceSwitchSearchSample>();

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /** Historical aliases can be polluted by a source misparsing another book
   * at the same URL. A relation snapshot scopes the read, but only current
   * exact title/author metadata authorizes a selectable source. */
  admitsCandidate(candidate: SourceSwitchCandidate, query: SourceSwitchProbeQuery): boolean {
    return this.matchesCandidateBook(candidate, query);
  }

  /** A shelf projection can outlive its reading session. Recover only the
   * existing exact book's current rule proof; an alias or raw @ prefix never
   * authorizes stripping a pen-name character. This read performs no HTTP. */
  async resolveProbeQueryIdentity(query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined = undefined,
    expectedCandidate: SourceSwitchCandidate | undefined = undefined): Promise<SourceSwitchProbeQuery> {
    if (isCurrent?.() === false) return query;
    this.validateProbeQuery(query);
    const revision = this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision();
    let sources: Map<string, SourceSwitchRegistryEntry>;
    try {
      sources = new Map(await this.loadEnabledSources(isCurrent));
    } catch (error) {
      if (isCurrent?.() === false) return query;
      throw error;
    }
    if (isCurrent?.() === false) return query;
    if (revision !== this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision()) {
      throw new Error('书源配置已变更，请重试');
    }
    if (this.cachedNonReadableSourceIds.has(query.sourceId)) {
      throw new Error('当前书源提供书评或其他非阅读内容，请返回搜索选择小说正文书源。');
    }
    // A visible row may predate a registry update. Reuse this same snapshot
    // to qualify its exact target before acquisition or any progress write.
    if (expectedCandidate !== undefined) {
      const target = sources.get(expectedCandidate.sourceId);
      if (target === undefined || target.category !== expectedCandidate.category ||
        (target.category === 'comic') !== (query.contentKind === 'manga') ||
        target.sourceVersion !== expectedCandidate.sourceVersion) {
        throw new Error('候选书源已变更或不可用，请重新查找');
      }
    }
    const source = sources.get(query.sourceId);
    if (!query.author.startsWith('@')) return query;
    const currentVersion = source?.sourceVersion;
    const currentProof = readBookAuthorIdentity(query.authorIdentity, query.author, currentVersion);
    if (currentProof !== undefined) return query.sourceVersion === currentVersion ? query :
      { ...query, sourceVersion: currentVersion };
    // A proof bound only to the caller's old source hash cannot authorize an
    // author conversion after the registry changed or the source disappeared.
    const unproved = query.authorIdentity === undefined ? query :
      { ...query, authorIdentity: undefined, sourceVersion: currentVersion };
    if (currentVersion === undefined || currentVersion.length === 0) return unproved;
    let data: JsonObject;
    try {
      data = (await this.runtimeOwner.request('search-book.get', { origin: query.sourceId, bookUrl: query.bookId },
        this.requestOptions(isCurrent))).data;
    } catch (error) {
      if (isCurrent?.() === false) return unproved;
      throw error;
    }
    if (isCurrent?.() === false) return unproved;
    if (revision !== this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision()) {
      throw new Error('书源配置已变更，请重试');
    }
    const raw = data['book'];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return unproved;
    const book = raw as JsonObject;
    if (book['origin'] !== query.sourceId || book['bookUrl'] !== query.bookId ||
      book['name'] !== query.bookName || book['author'] !== query.author) return unproved;
    const acquisition = book['acquisition'];
    if (acquisition === null || typeof acquisition !== 'object' || Array.isArray(acquisition)) return unproved;
    const facts = acquisition as JsonObject;
    if (facts['sourceVersion'] !== currentVersion) return unproved;
    const proof = readBookAuthorIdentity(facts['authorIdentity'], query.author, currentVersion);
    return proof === undefined ? unproved : { ...query, authorIdentity: proof, sourceVersion: currentVersion };
  }

  /** A rule can return another book's detail at the requested URL. Compare
   * resolved metadata before delivering a preview or accepting a shelf write.
   * An existing canonical candidate or the current book supplies the allowed
   * title/author; an unobserved alias cannot authorize changing books. */
  assertAcquiredBook(candidate: SourceSwitchCandidate, session: RemoteReadingSession,
    query: SourceSwitchProbeQuery): void {
    const resolved: SourceSwitchCandidate = { ...candidate, bookName: session.book.title,
      author: session.book.author, authorIdentity: session.book.authorIdentity, sourceVersion: session.sourceVersion };
    const expected: SourceSwitchProbeQuery = { ...query, bookName: candidate.bookName,
      author: candidate.author ?? '', authorIdentity: candidate.authorIdentity, sourceVersion: candidate.sourceVersion };
    if (!this.matchesCandidateBook(resolved, expected) && !this.matchesCandidateBook(resolved, query)) {
      throw new Error('书源返回的书名或作者与当前书籍不一致，已阻止换源');
    }
  }

  /**
   * Legado-compatible first paint: read durable SearchBook rows, hide disabled
   * sources, and retain expired successes with an explicit stale state. No
   * source HTTP is attempted from this path.
   */
  async loadCachedCandidates(
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined = undefined,
    known: SourceSwitchCandidate[] = [],
    _change: BookAcquisitionChange | undefined = undefined,
  ): Promise<SourceSwitchCandidate[]> {
    this.validateProbeQuery(query);
    const enabledSources = new Map(await this.loadEnabledSources(isCurrent));
    for (const [id, source] of enabledSources) {
      if ((source.category === 'comic') !== (query.contentKind === 'manga')) enabledSources.delete(id);
    }
    const scope = sourceSwitchCandidateKey(query.sourceId, query.bookId);
    const confirmed = new Set(this.confirmedScope === scope ? this.confirmedCandidates : []);
    const revision = this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision();
    const knownByKey = new Map<string, SourceSwitchCandidate>();
    for (const candidate of known) {
      knownByKey.set(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl), candidate);
    }
    // Core owns the indexed alias closure. Stage a complete, version-consistent
    // relation before replacing the pane; a partial page never means deletion.
    const records = await this.loadRelatedBooks(query, enabledSources, isCurrent);
    if (isCurrent?.() === false) return [];
    const candidates: SourceSwitchCandidate[] = [];
    for (const book of records) {
      const sourceId = this.requireString(book, 'origin', 'search-book.related');
      const source = enabledSources.get(sourceId);
      confirmed.add(sourceSwitchCandidateKey(sourceId, this.requireString(book, 'bookUrl', 'search-book.related')));
      if (source !== undefined) {
        const decoded = this.decodeCachedCandidate(book, query, this.optionalNumber(book, 'time') ?? 0, source);
        if (!this.admitsCandidate(decoded, query)) continue;
        const previous = knownByKey.get(sourceSwitchCandidateKey(decoded.sourceId, decoded.bookUrl));
        // Preserve an in-memory timing while Core persistence catches up. A
        // source-version mismatch must never display timing from another rule.
        candidates.push(previous !== undefined && decoded.latencyMs === undefined &&
          previous.latencyKind === 'search' && previous.latencyMs !== undefined &&
          previous.sourceVersion === source.sourceVersion ? {
            ...decoded,
            latencyMs: previous.latencyMs,
            latencyKind: 'search',
            latencyMeasuredAt: previous.latencyMeasuredAt,
          } : decoded);
      }
    }
    const keys = new Set(candidates.map((candidate: SourceSwitchCandidate): string =>
      sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl)));
    // A live Search seed may lead its durable publication. Explicitly missing
    // rows may survive that race; persisted rows outside this relation may not.
    const unpersisted = new Set<string>();
    const extras = known.filter((candidate: SourceSwitchCandidate): boolean =>
      enabledSources.has(query.sourceId) && enabledSources.has(candidate.sourceId) &&
      this.matchesCandidateBook(candidate, query) &&
      !keys.has(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl)));
    for (let start = 0; start < extras.length; start += 128) {
      const batch = extras.slice(start, start + 128);
      const expected = new Set(batch.map((candidate: SourceSwitchCandidate): string =>
        sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl)));
      const result = await this.runtimeOwner.request('search-book.batch.get', { identities: batch.map(
        (candidate: SourceSwitchCandidate): JsonObject => ({ sourceId: candidate.sourceId, bookId: candidate.bookUrl })) },
        this.requestOptions(isCurrent));
      if (isCurrent?.() === false) return [];
      if (result.data['complete'] !== true || !Array.isArray(result.data['books']) || !Array.isArray(result.data['missing'])) {
        throw new Error('候选身份快照不完整');
      }
      const returned = new Set<string>();
      for (const raw of result.data['books']) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('候选身份无效');
        const row = raw as JsonObject;
        const key = sourceSwitchCandidateKey(this.requireString(row, 'origin', 'search-book.batch.get'),
          this.requireString(row, 'bookUrl', 'search-book.batch.get'));
        if (!expected.has(key) || returned.has(key)) throw new Error('候选身份不匹配');
        returned.add(key); confirmed.add(key);
      }
      for (const raw of result.data['missing']) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('候选身份无效');
        const row = raw as JsonObject;
        const key = sourceSwitchCandidateKey(this.requireString(row, 'sourceId', 'search-book.batch.get'),
          this.requireString(row, 'bookId', 'search-book.batch.get'));
        if (!expected.has(key) || returned.has(key)) throw new Error('候选身份不匹配');
        returned.add(key); if (!confirmed.has(key)) unpersisted.add(key);
      }
      if (returned.size !== expected.size) throw new Error('候选身份快照缺失');
    }
    for (const candidate of known) {
      const source = enabledSources.get(candidate.sourceId);
      const key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
      if (source === undefined || keys.has(key) || !unpersisted.has(key)) continue;
      candidates.push({ ...candidate, sourceName: source.sourceName, sourceOrder: source.sourceOrder,
        providerFamily: source.providerFamily,
        acquisitionState: candidate.sourceVersion === source.sourceVersion ? candidate.acquisitionState : 'stale',
        isCurrent: candidate.sourceId === query.sourceId && candidate.bookUrl === query.bookId });
      keys.add(key);
    }
    if (isCurrent?.() === false) return [];
    if (revision !== this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision()) throw new Error('书源配置已变更，请重试');
    this.confirmedScope = scope; this.confirmedCandidates = confirmed;
    return this.sortCandidates(candidates.map((candidate: SourceSwitchCandidate): SourceSwitchCandidate => {
      const source = enabledSources.get(candidate.sourceId);
      const sample = this.discoveryScope === scope ? this.discoverySamples.get(
        sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl)) : undefined;
      const currentSample = sample !== undefined && sample.sourceVersion === source?.sourceVersion ? sample : undefined;
      // A live, version-bound sample supersedes the durable acquisition fact.
      // Legacy respondTime has no stage/version contract and remains ignored.
      return currentSample !== undefined && currentSample.measuredAt >= (candidate.latencyMeasuredAt ?? 0)
        ? { ...candidate, latencyMs: currentSample.latencyMs, latencyKind: 'search',
          latencyMeasuredAt: currentSample.measuredAt } : candidate;
    }));
  }

  private async loadRelatedBooks(
    query: SourceSwitchProbeQuery,
    sources: Map<string, SourceSwitchRegistryEntry>,
    isCurrent: (() => boolean) | undefined,
  ): Promise<JsonObject[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const records: JsonObject[] = [];
      const identities = new Set<string>();
      const cursors = new Set<string>();
      const versions = new Map<string, string>();
      let snapshot: string | undefined = undefined;
      let relation: string | undefined = undefined;
      let relationRevision: string | undefined = undefined;
      let cursor: string | undefined = undefined;
      try {
        do {
          if (isCurrent?.() === false) return [];
          const params: JsonObject = { identity: { sourceId: query.sourceId, bookId: query.bookId },
            name: query.bookName, author: query.author, limit: 128 };
          // Manga candidates use the source-scoped relation projection. The
          // default relation mode remains strict for novel source switching.
          if (query.contentKind === 'manga') params['mode'] = 'mangaCandidates';
          if (cursor !== undefined) params['cursor'] = cursor;
          const response = await this.runtimeOwner.request('search-book.related', params, this.requestOptions(isCurrent));
          if (isCurrent?.() === false) return [];
          const data = response.data;
          if (!Array.isArray(data['books']) || data['books'].length > 128 ||
            !Array.isArray(data['sourceVersions']) || typeof data['complete'] !== 'boolean') {
            throw new Error('同书候选快照不完整');
          }
          const observed = this.requireString(data, 'snapshotRevision', 'search-book.related');
          if (snapshot !== undefined && snapshot !== observed) throw new Error('同书候选快照已变更，请重试');
          snapshot = observed;
          for (const value of data['sourceVersions']) {
            if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('候选书源版本无效');
            const stamp = value as JsonObject;
            const sourceId = this.requireString(stamp, 'sourceId', 'search-book.related');
            const version = this.requireString(stamp, 'sourceVersion', 'search-book.related');
            const old = versions.get(sourceId);
            if (old !== undefined && old !== version) throw new Error('候选书源版本已变更');
            const source = sources.get(sourceId);
            if (source !== undefined && (stamp['enabled'] !== true ||
              (source.sourceVersion !== undefined && source.sourceVersion !== version))) throw new Error('书源配置已变更，请重试');
            versions.set(sourceId, version);
          }
          for (const raw of data['books']) {
            if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('同书候选数据无效');
            const book = raw as JsonObject;
            const sourceId = this.requireString(book, 'origin', 'search-book.related');
            const bookId = this.requireString(book, 'bookUrl', 'search-book.related');
            const key = sourceSwitchCandidateKey(sourceId, bookId);
            const bookRelation = this.requireString(book, 'relationKey', 'search-book.related');
            const bookRevision = this.requireString(book, 'relationRevision', 'search-book.related');
            if (!versions.has(sourceId) || identities.has(key) ||
              (relation !== undefined && (relation !== bookRelation || relationRevision !== bookRevision))) {
              throw new Error('同书候选身份或关系版本不一致');
            }
            identities.add(key); relation = bookRelation; relationRevision = bookRevision;
            records.push(book);
          }
          cursor = data['complete'] === true ? undefined : this.requireString(data, 'nextCursor', 'search-book.related');
          if (cursor !== undefined) {
            if (cursors.has(cursor) || data['books'].length === 0) throw new Error('同书候选分页未推进');
            cursors.add(cursor);
            await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
          }
        } while (cursor !== undefined);
        return records;
      } catch (error) {
        const failure = error as Record<string, unknown>;
        const details = failure['details'] as Record<string, unknown> | undefined;
        if (attempt === 0 && details?.['reason'] === 'CURSOR_STALE' && isCurrent?.() !== false) continue;
        throw error;
      }
    }
    throw new Error('同书候选快照已过期，请重试');
  }

  /**
   * Explicit refresh discovers missing candidates without deleting successes.
   * Each completed source and existing acquisition publication can update the
   * pane before the sweep ends. Search timing never promotes readability.
   */
  async refreshCandidates(
    query: SourceSwitchProbeQuery,
    isCurrent: (() => boolean) | undefined = undefined,
    excludedSourceIds: string[] = [],
    onProgress: ((candidates: SourceSwitchCandidate[]) => void) | undefined = undefined,
    initialCandidates: SourceSwitchCandidate[] = [],
  ): Promise<SourceSwitchDiscoveryOutcome> {
    this.validateProbeQuery(query);
    if (isCurrent?.() === false) return { kind: 'noSources' };
    const generation = ++this.discoveryGeneration;
    const scope = sourceSwitchCandidateKey(query.sourceId, query.bookId);
    if (this.discoveryScope !== scope) this.discoverySamples.clear();
    this.discoveryScope = scope;
    let finished = false;
    const current = (): boolean => !finished && generation === this.discoveryGeneration && isCurrent?.() !== false;
    const candidateMap = new Map<string, SourceSwitchCandidate>();
    for (const candidate of initialCandidates) {
      if (!this.admitsCandidate(candidate, query)) continue;
      candidateMap.set(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl), candidate);
    }
    let candidates: SourceSwitchCandidate[] = this.sortCandidates(Array.from(candidateMap.values()));
    let enabledSources: Map<string, SourceSwitchRegistryEntry> | undefined;
    const pendingIdentityKeys = new Set<string>();
    const pendingIdentityValues = new Map<string, { sourceId: string; bookId: string }>();
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let flushInFlight: Promise<void> = Promise.resolve();
    let flushWaiters: Array<{ resolve: () => void; active: boolean }> = [];
    let cancelled = false;

    const publish = (): void => {
      if (!current()) return;
      candidates = this.sortCandidates(Array.from(candidateMap.values()));
      onProgress?.(candidates);
    };

    const mergeCandidate = (candidate: SourceSwitchCandidate, queueProjection: boolean = true): void => {
      if (!this.admitsCandidate(candidate, query)) return;
      const key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
      const previous = candidateMap.get(key);
      if (previous === undefined && candidate.acquisitionState === undefined) {
        candidate = { ...candidate, acquisitionState: 'discovered' };
      }
      // Discovery and acquisition updates are partial facts. Preserve fields
      // already proven by the cache when a later event only carries identity
      // or timing, while allowing a newer failure/readability state through.
      candidateMap.set(key, previous === undefined ? candidate : { ...previous, ...candidate,
        acquisitionState: candidate.acquisitionState === undefined ? previous.acquisitionState : candidate.acquisitionState,
        latencyMs: candidate.latencyMs === undefined ? previous.latencyMs : candidate.latencyMs,
        latencyKind: candidate.latencyKind === undefined ? previous.latencyKind : candidate.latencyKind,
        latencyMeasuredAt: candidate.latencyMeasuredAt === undefined ? previous.latencyMeasuredAt : candidate.latencyMeasuredAt,
        searchVariables: candidate.searchVariables === undefined ? previous.searchVariables : candidate.searchVariables,
        authorIdentity: candidate.authorIdentity === undefined ? previous.authorIdentity : candidate.authorIdentity });
      if (queueProjection) {
        pendingIdentityKeys.add(key);
        pendingIdentityValues.set(key, { sourceId: candidate.sourceId, bookId: candidate.bookUrl });
      }
    };

    const mergeIdentities = (identities: { sourceId: string; bookId: string }[]): void => {
      for (const identity of identities) {
        if (typeof identity.sourceId !== 'string' || typeof identity.bookId !== 'string' ||
          identity.sourceId.trim().length === 0 || identity.bookId.trim().length === 0) continue;
        const key = sourceSwitchCandidateKey(identity.sourceId, identity.bookId);
        pendingIdentityKeys.add(key);
        pendingIdentityValues.set(key, { sourceId: identity.sourceId, bookId: identity.bookId });
      }
    };

    const settleFlushWaiters = (): void => {
      if (!cancelled && (debounceTimer !== undefined || pendingIdentityKeys.size > 0)) return;
      const waiters = flushWaiters;
      flushWaiters = [];
      for (const waiter of waiters) {
        if (!waiter.active) continue;
        waiter.active = false;
        waiter.resolve();
      }
    };

    // A source sweep can be retired while the debounce timer or a batch RPC is
    // pending. Clear queued identities and release every waiter immediately;
    // the in-flight request still observes requestOptions(current) and is
    // allowed to settle independently.
    const cancelFlush = (): void => {
      if (cancelled) return;
      cancelled = true;
      if (debounceTimer !== undefined) { clearTimeout(debounceTimer); debounceTimer = undefined; }
      pendingIdentityKeys.clear(); pendingIdentityValues.clear();
      settleFlushWaiters();
    };

    const flushDelta = async (): Promise<void> => {
      if (!current() || pendingIdentityKeys.size === 0) return;
      const keys = Array.from(pendingIdentityKeys);
      pendingIdentityKeys.clear();
      if (enabledSources === undefined) enabledSources = new Map(await this.loadEnabledSources(current));
      for (let start = 0; start < keys.length; start += 128) {
        if (!current()) return;
        const batch = keys.slice(start, start + 128);
        const result = await this.runtimeOwner.request('search-book.batch.get', {
          identities: batch.map((key: string): JsonObject => {
            const identity = pendingIdentityValues.get(key);
            if (identity !== undefined) return { sourceId: identity.sourceId, bookId: identity.bookId };
            const candidate = candidateMap.get(key);
            if (candidate !== undefined) return { sourceId: candidate.sourceId, bookId: candidate.bookUrl };
            throw new Error('候选身份索引缺失');
          }),
        }, this.requestOptions(current));
        if (!current()) return;
        if (result.data['complete'] !== true || !Array.isArray(result.data['books']) ||
          !Array.isArray(result.data['missing'])) throw new Error('候选身份快照不完整');
        const expected = new Set(batch);
        const returned = new Set<string>();
        for (const raw of result.data['books']) {
          if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('候选身份无效');
          const row = raw as JsonObject;
          const sourceId = this.requireString(row, 'origin', 'search-book.batch.get');
          const bookId = this.requireString(row, 'bookUrl', 'search-book.batch.get');
          const key = sourceSwitchCandidateKey(sourceId, bookId);
          if (!expected.has(key) || returned.has(key)) throw new Error('候选身份不匹配');
          returned.add(key);
          const source = enabledSources.get(sourceId);
          if (source !== undefined && (source.category === 'comic') === (query.contentKind === 'manga')) mergeCandidate(this.decodeCachedCandidate(row, query,
            this.optionalNumber(row, 'time') ?? Date.now(), source), false);
          if (!pendingIdentityKeys.has(key)) pendingIdentityValues.delete(key);
        }
        for (const raw of result.data['missing']) {
          if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('候选身份无效');
          const row = raw as JsonObject;
          const key = sourceSwitchCandidateKey(this.requireString(row, 'sourceId', 'search-book.batch.get'),
            this.requireString(row, 'bookId', 'search-book.batch.get'));
          if (!expected.has(key) || returned.has(key)) throw new Error('候选身份不匹配');
          returned.add(key);
          if (!pendingIdentityKeys.has(key)) pendingIdentityValues.delete(key);
        }
        if (returned.size !== expected.size) throw new Error('候选身份快照缺失');
        publish();
      }
    };

    let scheduleFlush: () => void = (): void => {};
    const runFlush = (): void => {
      flushInFlight = flushInFlight.then(flushDelta).catch((): void => {
        // Partial acquisition failures retain the last known candidate. The
        // final complete relation check remains authoritative for deletion.
      }).finally((): void => {
        if (current() && pendingIdentityKeys.size > 0) scheduleFlush();
        settleFlushWaiters();
      });
    };

    scheduleFlush = (): void => {
      if (!current() || debounceTimer !== undefined || pendingIdentityKeys.size === 0) return;
      debounceTimer = setTimeout((): void => {
        debounceTimer = undefined;
        runFlush();
      }, 100);
    };

    const awaitFlush = async (): Promise<void> => {
      while (!cancelled && (debounceTimer !== undefined || pendingIdentityKeys.size > 0)) {
        if (!current()) { cancelFlush(); return; }
        await new Promise<void>((resolve): void => {
          const waiter = { resolve, active: true };
          flushWaiters.push(waiter);
          const poll = (): void => {
            if (!waiter.active) return;
            if (!current()) { waiter.active = false; cancelFlush(); resolve(); return; }
            setTimeout(poll, 16);
          };
          setTimeout(poll, 16);
        });
      }
      if (cancelled || !current()) { cancelFlush(); return; }
      let watching = true;
      const cancellation = new Promise<void>((resolve): void => {
        const poll = (): void => {
          if (!watching) return;
          if (!current()) { cancelFlush(); resolve(); return; }
          setTimeout(poll, 16);
        };
        setTimeout(poll, 16);
      });
      await Promise.race([flushInFlight, cancellation]);
      watching = false;
      if (!cancelled && !current()) cancelFlush();
      if (!cancelled && (debounceTimer !== undefined || pendingIdentityKeys.size > 0)) await awaitFlush();
    };

    const projectInitial = async (): Promise<void> => {
      const updated = await this.loadCachedCandidates(query, current, initialCandidates);
      if (!current()) return;
      candidateMap.clear();
      for (const candidate of updated) candidateMap.set(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl), candidate);
      candidates = updated;
      onProgress?.(candidates);
    };
    const coordinator = this.runtimeOwner.bookAcquisitions?.();
    const unsubscribe = onProgress === undefined ? undefined : coordinator?.subscribe?.((change: BookAcquisitionChange): void => {
      if (!current() || (!change.reset && change.identities.length === 0)) return;
      if (change.reset) mergeIdentities(Array.from(candidateMap.values()).map((candidate): { sourceId: string; bookId: string } =>
        ({ sourceId: candidate.sourceId, bookId: candidate.bookUrl })));
      mergeIdentities(change.identities);
      publish();
      scheduleFlush();
    });
    try {
      if (!current()) return { kind: 'noSources' };
      await projectInitial();
      await this.discoverCandidates(query.sourceId, query.bookId, query.bookName, current, excludedSourceIds, query.contentKind,
        async (discovered: SourceSwitchCandidate[]): Promise<void> => {
          if (!current()) return;
          for (const candidate of discovered) {
            if (candidate.latencyKind === 'search' && candidate.latencyMs !== undefined &&
              candidate.latencyMeasuredAt !== undefined) {
              this.discoverySamples.set(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl), {
                sourceVersion: candidate.sourceVersion, latencyMs: candidate.latencyMs,
                measuredAt: candidate.latencyMeasuredAt });
            }
            mergeCandidate(candidate);
          }
          publish();
          scheduleFlush();
        }, query);
      if (!current()) return { kind: 'noSources' };
      await awaitFlush();
      // One complete relation read at the end owns membership/deletion. A
      // source completion never performs this read, so N source results do not
      // become N full relation scans.
      const finalCandidates = await this.loadCachedCandidates(query, current, Array.from(candidateMap.values()));
      if (!current()) return { kind: 'noSources' };
      candidateMap.clear();
      for (const candidate of finalCandidates) candidateMap.set(sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl), candidate);
      candidates = finalCandidates;
      onProgress?.(candidates);
      return candidates.length === 0 ? { kind: 'noSources' } : { kind: 'sources', candidates };
    } catch (error) {
      if (!current()) return { kind: 'noSources' };
      throw error;
    } finally {
      finished = true;
      if (isCurrent?.() === false || generation !== this.discoveryGeneration) cancelFlush();
      if (debounceTimer !== undefined) { clearTimeout(debounceTimer); debounceTimer = undefined; }
      unsubscribe?.();
    }
  }

  /**
   * Search each enabled source through the shared `book.search` decoder.
   * Core's multi-source command soft-skips HTTP/parse failures, so a single
   * source search is required to distinguish failures from a valid empty list.
   */
  async discoverCandidates(
    sourceId: string,
    bookId: string,
    keyword: string,
    isCurrent: (() => boolean) | undefined = undefined,
    excludedSourceIds: string[] = [],
    contentKind: 'text' | 'manga' = 'text',
    onSourceComplete: ((candidates: SourceSwitchCandidate[]) => Promise<void>) | undefined = undefined,
    expectedBook: SourceSwitchProbeQuery | undefined = undefined,
  ): Promise<SourceSwitchDiscoveryOutcome> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    this.assertNonBlankString(keyword, 'keyword');
    const list = await this.runtimeOwner.request(
      'source.list',
      { enabledOnly: true },
      this.requestOptions(isCurrent),
    );
    if (isCurrent?.() === false) return { kind: 'noSources' };
    const rawSources = list.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources: SourceSwitchRegistryEntry[] = [];
    const excluded = new Set(excludedSourceIds);
    for (let sourceOrder = 0; sourceOrder < rawSources.length; sourceOrder += 1) {
      const raw = rawSources[sourceOrder];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      if (source['enabled'] !== true) {
        continue;
      }
      const sourceId = this.optionalString(source, 'sourceId');
      if (sourceId !== undefined && excluded.has(sourceId)) continue;
      if (sourceId !== undefined && sourceId.length > 0) {
        const sourceName = this.optionalString(source, 'name');
        const rawBookSource = source['bookSource'];
        let bookSourceType: unknown = undefined;
        let group: string | undefined = undefined;
        if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
          const bookSource = rawBookSource as JsonObject;
          bookSourceType = bookSource['bookSourceType'];
          group = this.optionalString(bookSource, 'bookSourceGroup');
        }
        const category = classifyReaderSource({ bookSourceType, name: sourceName, group, sourceId,
          baseUrl: this.optionalString(source, 'baseUrl') });
        if (contentKind === 'manga' ? category !== 'comic' : !readerSourceCategoryIsText(category)) continue;
        const baseUrl = this.optionalString(source, 'baseUrl');
        sources.push({
          sourceId,
          sourceName: sourceName === undefined || sourceName.trim().length === 0 ? sourceId : sourceName,
          sourceOrder,
          sourceVersion: this.optionalString(source, 'sourceVersion'),
          category,
          baseUrl,
          providerFamily: sourceSwitchProviderFamilyKey(sourceName, baseUrl),
        });
      }
    }
    if (sources.length === 0) {
      return { kind: 'noSources' };
    }
    const candidates: SourceSwitchCandidate[] = [];
    let domainFailures = 0;
    let sourceFailures = 0;
    const httpStatuses = new Map<number, number>();
    await runBookSourceWorkers(sources, SOURCE_SWITCH_DISCOVERY_CONCURRENCY,
      async (source: SourceSwitchRegistryEntry): Promise<void> => {
        let group: SourceSwitchCandidate[];
        try {
          group = await this.discoverFromSource(keyword, source, isCurrent, expectedBook);
        } catch (error) {
          if (isCurrent?.() === false) return;
          if (!isDomainResolutionFailure(error)) {
            if (isNetworkEnvironmentFailure(error)) throw error;
            sourceFailures += 1;
            const status = this.discoveryHttpStatus(error);
            if (status !== undefined) httpStatuses.set(status, (httpStatuses.get(status) ?? 0) + 1);
            return;
          }
          // A failed candidate hostname must not cancel independent sources.
          // Route/proxy configuration failures still stop the shared batch.
          domainFailures += 1;
          return;
        }
        if (isCurrent?.() !== false) {
          candidates.push(...group);
          await onSourceComplete?.(group);
        }
      }, async (): Promise<boolean> => isCurrent?.() !== false);
    if (isCurrent?.() === false) return { kind: 'noSources' };
    const statuses = Array.from(httpStatuses.keys()).sort((left: number, right: number): number => left - right)
      .slice(0, 4).map((status: number): string => `HTTP ${status}：${httpStatuses.get(status)}个`);
    const responseSummary = statuses.length === 0 ? '' : `（${statuses.join('，')}）`;
    if (candidates.length === 0 && domainFailures > 0) {
      throw new Error(domainFailures === sources.length
        ? '本次换源搜索的书源均出现域名解析失败，请稍后重试或调整书源。'
        : `本次换源搜索未找到可用候选，其中${domainFailures}个书源域名解析失败${sourceFailures > 0 ? `，${sourceFailures}个书源请求或规则执行失败${responseSummary}` : ''}，请稍后重试或调整书源。`);
    }
    if (candidates.length === 0 && sourceFailures > 0) {
      throw new Error(`本次换源搜索未找到可用候选，${sourceFailures}个书源请求或规则执行失败${responseSummary}，请重试或调整书源。`);
    }
    candidates.sort((left: SourceSwitchCandidate, right: SourceSwitchCandidate): number =>
      (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0));
    const uniqueCandidates = deduplicateSourceSwitchCandidates(candidates);
    const currentCandidateKey = sourceSwitchCandidateKey(sourceId, bookId);
    for (const candidate of uniqueCandidates) {
      candidate.isCurrent = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) === currentCandidateKey;
    }
    return { kind: 'sources', candidates: uniqueCandidates };
  }

  private async discoverFromSource(
    keyword: string,
    source: SourceSwitchRegistryEntry,
    isCurrent: (() => boolean) | undefined,
    expectedBook: SourceSwitchProbeQuery | undefined,
  ): Promise<SourceSwitchCandidate[]> {
    if (isCurrent?.() === false) return [];
    const startedAt = Date.now();
    const result = await this.runtimeOwner.request(
      'book.search',
      { sourceId: source.sourceId, keyword, page: 1 },
      this.requestOptions(isCurrent),
    );
    if (isCurrent?.() === false) return [];
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const measuredAt = Date.now();
    const decoded = await this.decodeDiscoveryCandidates(result.data, source, isCurrent);
    const candidates = decoded.filter((candidate): boolean =>
      expectedBook !== undefined ? this.matchesCandidateBook(candidate, expectedBook) :
        this.normalizeBookName(candidate.bookName) === this.normalizeBookName(keyword))
      .map((candidate: SourceSwitchCandidate): SourceSwitchCandidate =>
        ({ ...candidate, latencyMs, latencyKind: 'search', latencyMeasuredAt: measuredAt }));
    // Search latency is a durable, version-bound fact. A failed timing
    // write must never hide a valid discovery result (legacy rows and
    // read-only runtimes are allowed), while successful writes make the next
    // drawer open show the last measured value without another search.
    for (const candidate of candidates) {
      await this.persistSearchTiming(candidate, candidate.sourceVersion, latencyMs, measuredAt, isCurrent);
    }
    return candidates;
  }

  /** Aggregate only numeric HTTP evidence; arbitrary source error text and
   * response bodies must not enter the discovery empty/error presentation. */
  private discoveryHttpStatus(error: unknown): number | undefined {
    if (error === null || typeof error !== 'object' || Array.isArray(error)) return undefined;
    const raw = error as JsonObject;
    const event = raw['event'] as JsonObject | undefined;
    const failure = (event?.['error'] ?? raw['error'] ?? raw) as JsonObject;
    const details = failure?.['details'] as JsonObject | undefined;
    if (details?.['category'] !== 'SOURCE_HTTP_FAILED') return undefined;
    const host = details['host'] as JsonObject | undefined;
    const diagnostics = host?.['diagnostics'] as JsonObject | undefined;
    const evidence = (details['cause'] ?? diagnostics?.['details'] ?? details) as JsonObject;
    const status = evidence?.['httpStatus'];
    return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
      ? status : undefined;
  }

  private async persistSearchTiming(
    candidate: SourceSwitchCandidate,
    sourceVersion: string | undefined,
    latencyMs: number,
    measuredAt: number,
    isCurrent: (() => boolean) | undefined,
  ): Promise<void> {
    if (sourceVersion === undefined || sourceVersion.trim().length === 0 || isCurrent?.() === false) return;
    try {
      await this.runtimeOwner.request('search-book.put', {
        bookUrl: candidate.bookUrl,
        origin: candidate.sourceId,
        acquisition: {
          schemaVersion: 2,
          sourceVersion,
          stage: 'search',
          checkedAt: measuredAt,
          searchTiming: { kind: 'search', sourceVersion, durationMs: latencyMs, measuredAt },
        },
      }, this.requestOptions(isCurrent));
    } catch (_error) {
      // Timing is an enrichment. Discovery remains usable when Core is an
      // older build, a legacy row is missing, or persistence is unavailable.
    }
  }

  private async decodeDiscoveryCandidates(
    data: JsonObject,
    source: SourceSwitchRegistryEntry,
    isCurrent: (() => boolean) | undefined,
  ): Promise<SourceSwitchCandidate[]> {
    if (data['sourceId'] !== source.sourceId) throw new Error('book.search returned a mismatched sourceId');
    const returnedVersion = data['sourceVersion'];
    if (returnedVersion !== undefined && (typeof returnedVersion !== 'string' || returnedVersion.length === 0 ||
      (source.sourceVersion !== undefined && returnedVersion !== source.sourceVersion))) {
      throw new Error('book.search returned a mismatched sourceVersion');
    }
    if ((source.category === 'comic' && data['contentKind'] !== 'manga') ||
      (source.category === 'novel' && data['contentKind'] !== undefined && data['contentKind'] !== 'text')) {
      throw new Error('book.search returned a mismatched contentKind');
    }
    const rawCandidates = data['books'];
    if (!Array.isArray(rawCandidates)) {
      throw new Error('book.search returned invalid books');
    }
    const searchSource: SearchSource = { sourceId: source.sourceId, name: source.sourceName,
      enabled: true, category: source.category, baseUrl: source.baseUrl, sourceVersion: source.sourceVersion };
    const version = typeof returnedVersion === 'string' ? returnedVersion : source.sourceVersion ?? '';
    const candidates: SourceSwitchCandidate[] = [];
    let discarded = 0;
    let processed = 0;
    for (const raw of rawCandidates) {
      if (++processed % 32 === 0) {
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (isCurrent?.() === false) return [];
      }
      try {
        const book = decodeBookSearchResult(raw, searchSource, { searchRequestId: `source-switch-${source.sourceId}`,
          bookSourceUrl: source.baseUrl ?? source.sourceId, sourceRuleVersion: version });
        candidates.push({
          sourceId: book.sourceId,
          sourceName: source.sourceName,
          category: source.category,
          sourceOrder: source.sourceOrder,
          sourceVersion: version.length > 0 ? version : undefined,
          providerFamily: source.providerFamily,
          bookUrl: book.bookId,
          bookName: book.title,
          author: book.author,
          authorIdentity: book.authorIdentity,
          coverUrl: book.coverUrl,
          latestChapterTitle: book.latestChapterTitle,
          searchVariables: book.variables,
        });
      } catch (_error) {
        discarded += 1;
      }
    }
    if (candidates.length === 0 && discarded > 0) throw new Error('book.search returned invalid books');
    return candidates;
  }

  /**
   * Resolves the target detail before fetching its chapter table. `book.toc`
   * cannot infer a TOC request from `{sourceId, bookId}` alone: the Core wire
   * contract requires the `tocUrl` and rule variables produced by
   * `book.detail`. Both remote commands need the `http.execute` host.
   */
  async fetchTargetToc(
    sourceId: string,
    bookId: string,
    isCurrent: (() => boolean) | undefined = undefined,
    candidate: SourceSwitchCandidate | undefined = undefined,
  ): Promise<SourceSwitchTargetToc> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');

    const coordinator = this.runtimeOwner.bookAcquisitions?.();
    if (coordinator !== undefined) {
      if (candidate !== undefined && (candidate.sourceId !== sourceId || candidate.bookUrl !== bookId)) {
        throw new Error('source switch candidate identity mismatch');
      }
      // Live candidates can precede their durable search row. The shared
      // coordinator already reconciles that row and its rule-bound variables.
      let seed: RemoteReadingBookSeed;
      if (candidate !== undefined) {
        seed = { sourceId, bookId, detailUrl: bookId, title: candidate.bookName,
          contentKind: candidate.category === 'comic' ? 'manga' : 'text',
          author: candidate.author ?? '', authorIdentity: candidate.authorIdentity,
          sourceVersion: candidate.sourceVersion, searchVariables: candidate.searchVariables,
          coverUrl: candidate.coverUrl, lastChapter: candidate.latestChapterTitle };
      } else {
        const stored = await this.runtimeOwner.request('search-book.get', { origin: sourceId, bookUrl: bookId });
        const book = this.requireObject(stored.data['book'], 'search-book.get');
        seed = { sourceId, bookId, detailUrl: bookId,
          title: this.requireString(book, 'name', 'search-book.get'), author: this.optionalString(book, 'author') ?? '' };
      }
      if (isCurrent?.() === false) throw new Error('source switch aborted');
      const session = await coordinator.acquireBook(seed, { isCurrent });
      if (session.identity.sourceId !== sourceId || session.identity.bookId !== bookId) {
        throw new Error('source switch returned a mismatched reading session');
      }
      const variables: JsonObject = {};
      for (const variable of session.continuationVariables) variables[variable.name] = variable.value;
      return { readingSession: session, sourceId, bookId, bookName: session.book.title, author: session.book.author,
        coverUrl: session.book.coverUrl, latestChapterTitle: session.book.lastChapter,
        intro: session.book.intro, kind: session.book.kind,
        tocUrl: session.tocUrl, variables,
        entries: session.entries.map((entry): SourceSwitchTargetTocEntry => {
          const entryVariables: JsonObject = {};
          for (const variable of entry.variables) entryVariables[variable.name] = variable.value;
          return { index: entry.index, title: entry.title, url: entry.url, variables: entryVariables };
        }) };
    }

    const detail = await this.runtimeOwner.request(
      'book.detail',
      {
        sourceId,
        book: { bookId },
        bookUrl: bookId,
      },
      this.requestOptions(isCurrent),
    );
    const detailBook = this.requireObject(detail.data['book'], 'book.detail book');
    const detailSourceId = this.requireString(detail.data, 'sourceId', 'book.detail');
    const detailBookId = this.requireString(detailBook, 'bookId', 'book.detail book');
    if (detailSourceId !== sourceId || detailBookId !== bookId) {
      throw new Error('book.detail returned a mismatched composite key');
    }
    // An absent/blank TOC URL is not recoverable by `book.toc`; fail before a
    // knowingly invalid Core request instead of silently substituting bookId.
    const tocUrl = this.requireString(detail.data, 'tocUrl', 'book.detail');
    const bookName = this.requireString(detailBook, 'title', 'book.detail book');
    const author = this.optionalString(detailBook, 'author') ?? '';
    const coverUrl = this.optionalString(detailBook, 'coverUrl');
    const latestChapterTitle = this.optionalString(detailBook, 'lastChapter');
    const intro = this.optionalString(detailBook, 'intro');
    const kind = this.optionalString(detailBook, 'kind');
    // `book.toc` variables are optional in the Core contract (serde default
    // empty map); `book.detail` only emits them when the source's rules produce
    // any. Requiring an object here would fail-closed against real sources
    // whose detail rules carry no variables.
    const rawVariables = detail.data['variables'];
    const variables: JsonObject =
      rawVariables === undefined || rawVariables === null
        ? {}
        : this.requireStringMap(rawVariables, 'variables', 'book.detail');

    const result = await this.runtimeOwner.request(
      'book.toc',
      { sourceId, bookId, tocUrl, variables },
      this.requestOptions(isCurrent),
    );
    const rawSourceId = result.data['sourceId'];
    const rawBookId = result.data['bookId'];
    if (rawSourceId !== sourceId || rawBookId !== bookId) {
      throw new Error('book.toc returned a mismatched composite key');
    }
    const rawToc = result.data['toc'];
    if (!Array.isArray(rawToc)) {
      throw new Error('book.toc returned invalid data');
    }
    const entries: SourceSwitchTargetTocEntry[] = [];
    for (const raw of rawToc) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('book.toc returned a non-object entry');
      }
      const entry = raw as JsonObject;
      const index = this.requireNonNegativeInteger(entry, 'index', 'book.toc');
      const title = this.requireString(entry, 'title', 'book.toc');
      const url = this.requireString(entry, 'url', 'book.toc');
      const rawEntryVariables = entry['variables'];
      const entryVariables = rawEntryVariables === undefined || rawEntryVariables === null
        ? {}
        : this.requireStringMap(rawEntryVariables, 'variables', 'book.toc');
      entries.push({ index, title, url, variables: entryVariables });
    }
    const continuationVariables: RemoteReadingVariable[] = [];
    for (const name of Object.keys(variables)) {
      continuationVariables.push({ name, value: variables[name] as string });
    }
    const catalogAt = this.optionalNumber(result.data, 'catalogAt');
    if (catalogAt !== undefined && (!Number.isSafeInteger(catalogAt) || catalogAt < 0)) {
      throw new Error('book.toc returned invalid catalogAt');
    }
    const readingSession: RemoteReadingSession = {
      acquisitionMode: 'online', identity: { sourceId, bookId }, detailUrl: bookId, tocUrl,
      sourceVersion: this.optionalString(result.data, 'sourceVersion') ?? this.optionalString(detail.data, 'sourceVersion'),
      catalogAt, catalogVersion: this.optionalString(result.data, 'catalogVersion'),
      contextVersion: this.optionalString(result.data, 'contextVersion'),
      book: { title: bookName, author, coverUrl, lastChapter: latestChapterTitle, intro, kind },
      continuationVariables, hostRequirements: ['httpExecute'],
      entries: entries.map((entry): RemoteReadingTocEntry => {
        const entryVariables: RemoteReadingVariable[] = [];
        for (const name of Object.keys(entry.variables)) {
          entryVariables.push({ name, value: entry.variables[name] as string });
        }
        return { index: entry.index, title: entry.title, url: entry.url, variables: entryVariables };
      }),
    };
    const target: SourceSwitchTargetToc = {
      readingSession,
      sourceId,
      bookId,
      bookName,
      author,
      intro,
      kind,
      tocUrl,
      variables,
      entries,
    };
    if (coverUrl !== undefined) {
      target.coverUrl = coverUrl;
    }
    if (latestChapterTitle !== undefined) {
      target.latestChapterTitle = latestChapterTitle;
    }
    return target;
  }

  private matchProbeChapter(
    entries: SourceSwitchTargetTocEntry[],
    query: SourceSwitchProbeQuery,
  ): SourceSwitchTargetTocEntry {
    for (const entry of entries) {
      if (entry.title === query.currentChapterTitle) {
        return entry;
      }
    }
    const normalizedTitle = this.normalizeChapterTitle(query.currentChapterTitle);
    for (const entry of entries) {
      if (this.normalizeChapterTitle(entry.title) === normalizedTitle) {
        return entry;
      }
    }
    for (const entry of entries) {
      if (entry.index === query.currentChapterIndex) {
        return entry;
      }
    }
    return entries[0];
  }

  /**
   * Atomically re-points an existing shelf book to the target source. This is
   * a storage-only command; its structured rollback journal remains inside
   * Core and Harmony receives only an opaque transaction id.
   */
  async commitSwitch(
    params: SourceSwitchCommitParams,
    isCurrent: (() => boolean) | undefined = undefined,
    evidence: ReaderWriteEvidence | undefined = undefined,
  ): Promise<SourceSwitchCommitOutcome> {
    this.assertNonBlankString(params.from.sourceId, 'from.sourceId');
    this.assertNonBlankString(params.from.bookId, 'from.bookId');
    this.assertNonBlankString(params.target.sourceId, 'target.sourceId');
    this.assertNonBlankString(params.target.bookId, 'target.bookId');
    this.assertNonBlankString(params.target.title, 'target.title');
    if ((params.operationId === undefined) !== (params.sequence === undefined)) throw new Error('source switch caller identity must be complete');
    if (params.operationId !== undefined && (params.operationId.trim().length === 0 ||
      typeof params.sequence !== 'number' || !Number.isSafeInteger(params.sequence) || params.sequence <= 0)) {
      throw new Error('source switch caller identity is invalid');
    }
    // A durable chapter index remains usable when the old body's processing
    // context is stale and its title cannot be proven. Core owns index matching.
    if (typeof params.currentChapterTitle !== 'string') {
      throw new Error('currentChapterTitle must be a string');
    }
    if (params.newToc.length === 0) {
      throw new Error('source.switch.commit requires a non-empty newToc');
    }
    if (!Number.isSafeInteger(params.currentChapterIndex) || params.currentChapterIndex < 0) {
      throw new Error('source.switch.commit requires a non-negative currentChapterIndex');
    }
    let transactionId: string | undefined = undefined;
    try {
      const result = await this.runtimeOwner.request(
        'source.switch.commit',
        params as unknown as JsonObject,
        evidence === undefined ? this.requestOptions(isCurrent) : this.durableRequestOptions(isCurrent, evidence),
      );
      const rawBook = result.data['book'];
      transactionId = this.requireString(result.data, 'transactionId', 'source.switch.commit');
      if (params.operationId !== undefined && transactionId !== params.operationId) throw new Error('source switch returned another caller identity');
      if (result.data['phase'] !== 'pending') {
        throw new Error('source.switch.commit returned an invalid phase');
      }
      if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
        throw new Error('source.switch.commit returned an invalid book');
      }
      const matchedChapter = this.decodeMatchedChapter(result.data['matchedChapter']);
      const book = this.decodeShelfBook(rawBook);
      if (book.sourceId !== params.target.sourceId || book.bookId !== params.target.bookId ||
        !params.newToc.some((entry): boolean => entry.chapterId === matchedChapter.chapterId &&
          entry.chapterTitle === matchedChapter.chapterTitle && entry.chapterUrl === matchedChapter.chapterUrl &&
          entry.order === matchedChapter.order)) {
        throw new Error('source.switch.commit returned another book or an unadmitted chapter');
      }
      const outcome: SourceSwitchCommitOutcome = {
        status: 'success',
        book,
        matchedChapter,
        transactionId,
      };
      evidence?.confirmed();
      return outcome;
    } catch (error) {
      if (isReaderCoreTransactionPendingError(error)) evidence?.rejectedBeforeExecution();
      const message = errorMessageOf(error);
      return transactionId === undefined
        ? { status: 'failed', error: message }
        : { status: 'failed', error: message, transactionId };
    }
  }

  /**
   * Compensates a previous commit via its opaque durable transaction id.
   * Finalized or stale transactions are rejected without overwriting progress.
   */
  async rollbackSwitch(
    transactionId: SourceSwitchTransactionId,
    isCurrent: (() => boolean) | undefined = undefined,
    evidence: ReaderWriteEvidence | undefined = undefined,
  ): Promise<SourceSwitchRollbackResult> {
    this.assertNonBlankString(transactionId, 'transactionId');
    const result = await this.runtimeOwner.request(
      'source.switch.rollback',
      { transactionId },
      evidence === undefined ? this.requestOptions(isCurrent) : this.durableRequestOptions(isCurrent, evidence),
    );
    if (result.data['transactionId'] !== transactionId || result.data['phase'] !== 'rolledBack' ||
      typeof result.data['changed'] !== 'boolean') {
      throw new Error('source.switch.rollback returned an invalid transaction result');
    }
    const rawBook = result.data['restoredBook'];
    if (typeof rawBook !== 'object' || rawBook === null || Array.isArray(rawBook)) {
      throw new Error('source.switch.rollback returned an invalid restored book');
    }
    const outcome: SourceSwitchRollbackResult = {
      transactionId,
      changed: result.data['changed'] as boolean,
      restoredBook: this.decodeShelfBook(rawBook),
    };
    evidence?.confirmed();
    return outcome;
  }

  /**
   * Reads Core's opaque pending-transaction projection for lifecycle
   * reconciliation. Harmony receives only the exact from/target identities
   * and transaction id; the durable journal remains owned by Core.
   */
  async listPendingSwitches(
    isCurrent: (() => boolean) | undefined = undefined,
  ): Promise<PendingSourceSwitch[]> {
    const result = await this.runtimeOwner.request(
      'source.switch.pending.list',
      {},
      this.requestOptions(isCurrent),
    );
    const rawPending = result.data['pending'];
    if (!Array.isArray(rawPending)) {
      throw new Error('source.switch.pending.list returned invalid pending');
    }
    const pending: PendingSourceSwitch[] = [];
    const transactionIds = new Set<string>();
    for (const value of rawPending) {
      const row = this.requireObject(value, 'source.switch.pending.list row');
      const transactionId = this.requireString(row, 'transactionId', 'source.switch.pending.list');
      if (row['phase'] !== 'pending' || transactionIds.has(transactionId)) {
        throw new Error('source.switch.pending.list returned an invalid transaction row');
      }
      const from = this.requireObject(row['from'], 'source.switch.pending.list from');
      const target = this.requireObject(row['target'], 'source.switch.pending.list target');
      transactionIds.add(transactionId);
      pending.push({
        transactionId,
        fromSourceId: this.requireString(from, 'sourceId', 'source.switch.pending.list from'),
        fromBookId: this.requireString(from, 'bookId', 'source.switch.pending.list from'),
        targetSourceId: this.requireString(target, 'sourceId', 'source.switch.pending.list target'),
        targetBookId: this.requireString(target, 'bookId', 'source.switch.pending.list target'),
      });
    }
    return pending;
  }

  /** Pure exact caller-lineage query. expected is the originally fixed full
   * payload; Core owns its SHA-256 comparison and all durable phase proof. */
  async queryTransaction(operationId: string, expected?: SourceSwitchCommitParams,
    isCurrent?: () => boolean): Promise<SourceSwitchOperationQuery> {
    this.assertNonBlankString(operationId, 'operationId');
    const params: JsonObject = { operationId };
    if (expected !== undefined) params['expected'] = expected as unknown as JsonObject;
    const result = await this.runtimeOwner.request('source.switch.transaction.query', params, this.requestOptions(isCurrent));
    const rawHead = result.data['head'];
    const head: SourceSwitchOperationHead | undefined = rawHead === null ? undefined : {
      operationId: this.requireString(this.requireObject(rawHead, 'source.switch.transaction.query head'), 'operationId', 'source.switch.transaction.query'),
      sequence: this.requirePositiveSequence(this.requireObject(rawHead, 'source.switch.transaction.query head'), 'sequence'),
    };
    const raw = result.data['transaction'];
    if (raw === null) return { head };
    const row = this.requireObject(raw, 'source.switch.transaction.query transaction');
    const sequence = this.requirePositiveSequence(row, 'sequence');
    const from = this.requireObject(row['from'], 'source.switch.transaction.query from');
    const target = this.requireObject(row['target'], 'source.switch.transaction.query target');
    const phase = row['phase'];
    const fingerprint = this.requireString(row, 'payloadFingerprint', 'source.switch.transaction.query');
    if (row['operationId'] !== operationId || !/^[0-9a-f]{64}$/.test(fingerprint) ||
      (phase !== 'pending' && phase !== 'finalized' && phase !== 'rolledBack') ||
      head === undefined || head.sequence < sequence ||
      (head.sequence === sequence && head.operationId !== operationId)) {
      throw new Error('source.switch.transaction.query returned invalid exact lineage');
    }
    const commit = this.requireObject(row['commit'], 'source.switch.transaction.query commit');
    const book = this.decodeShelfBook(commit['book']);
    const matchedChapter = this.decodeMatchedChapter(commit['matchedChapter']);
    const fromIdentity = { sourceId: this.requireString(from, 'sourceId', 'source.switch.transaction.query'),
      bookId: this.requireString(from, 'bookId', 'source.switch.transaction.query') };
    const targetIdentity = { sourceId: this.requireString(target, 'sourceId', 'source.switch.transaction.query'),
      bookId: this.requireString(target, 'bookId', 'source.switch.transaction.query') };
    if (commit['transactionId'] !== operationId || book.sourceId !== targetIdentity.sourceId || book.bookId !== targetIdentity.bookId ||
      (expected !== undefined && (expected.operationId !== operationId || expected.sequence !== sequence ||
        expected.from.sourceId !== fromIdentity.sourceId || expected.from.bookId !== fromIdentity.bookId ||
        expected.target.sourceId !== targetIdentity.sourceId || expected.target.bookId !== targetIdentity.bookId ||
        !expected.newToc.some((entry): boolean => entry.chapterId === matchedChapter.chapterId &&
          entry.chapterTitle === matchedChapter.chapterTitle && entry.chapterUrl === matchedChapter.chapterUrl && entry.order === matchedChapter.order)))) {
      throw new Error('source.switch.transaction.query returned mismatched exact payload');
    }
    const restoredBook = phase === 'rolledBack' ? this.decodeShelfBook(row['restoredBook']) : undefined;
    if (restoredBook !== undefined && (restoredBook.sourceId !== fromIdentity.sourceId || restoredBook.bookId !== fromIdentity.bookId)) {
      throw new Error('source.switch.transaction.query returned another restored identity');
    }
    return { head, transaction: { operationId, sequence, payloadFingerprint: fingerprint, from: fromIdentity,
      target: targetIdentity, phase, commit: { status: 'success', transactionId: operationId, book, matchedChapter }, restoredBook } };
  }

  private requirePositiveSequence(row: JsonObject, key: string): number {
    const value = row[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('source switch sequence is invalid');
    return value;
  }

  private decodeMatchedChapter(value: unknown): SourceSwitchNewTocEntry {
    const chapter = this.requireObject(value, 'source.switch matchedChapter');
    return {
      chapterId: this.requireString(chapter, 'chapterId', 'source.switch matchedChapter'),
      chapterTitle: this.requireString(chapter, 'chapterTitle', 'source.switch matchedChapter'),
      chapterUrl: this.requireString(chapter, 'chapterUrl', 'source.switch matchedChapter'),
      order: this.requireNonNegativeInteger(chapter, 'order', 'source.switch matchedChapter'),
    };
  }

  private requestOptions(isCurrent: (() => boolean) | undefined): RequestOptions {
    if (isCurrent === undefined) {
      return {};
    }
    return {
      shouldCancel: (): boolean => !isCurrent(),
    };
  }

  private durableRequestOptions(isCurrent: (() => boolean) | undefined,
    evidence: ReaderWriteEvidence): BookRequestOptions {
    // Runtime checks these after startup, immediately before the real SDK send.
    // shouldCancel is deliberately absent: UI retirement cannot cancel an
    // accepted storage transaction or discard its late exact ACK.
    const admitted = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && isCurrent?.() !== false;
    return { canContinue: admitted, canDispatch: admitted, onDispatch: (): void => evidence.dispatched() };
  }

  private decodeShelfBook(value: unknown): ShelfBook {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('source.switch returned a non-object book');
    }
    const book = value as JsonObject;
    const decoded: ShelfBook = {
      sourceId: this.requiredString(book, 'sourceId'),
      bookId: this.requiredString(book, 'bookId'),
      title: this.requiredString(book, 'title'),
      author: this.requiredString(book, 'author'),
      addedAt: this.requiredNumber(book, 'addedAt'),
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const intro = this.optionalString(book, 'intro');
    const lastChapter = this.optionalString(book, 'lastChapter');
    const lastReadAt = this.optionalNumber(book, 'lastReadAt');
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (lastChapter !== undefined) {
      decoded.lastChapter = lastChapter;
    }
    if (lastReadAt !== undefined) {
      decoded.lastReadAt = lastReadAt;
    }
    return decoded;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredNumber(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate)) {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'number') {
      throw new Error(`source.switch protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonNegativeInteger(value: JsonObject, key: string, command: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 0) {
      throw new Error(`${command} returned an invalid ${key}`);
    }
    return candidate;
  }

  private requireString(value: JsonObject, key: string, command: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      throw new Error(`${command} returned an invalid ${key}`);
    }
    return candidate;
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context} returned a non-object value`);
    }
    return value as JsonObject;
  }

  private requireStringMap(value: unknown, key: string, command: string): JsonObject {
    const raw = this.requireObject(value, `${command} ${key}`);
    const decoded: JsonObject = {};
    for (const variableName of Object.keys(raw)) {
      const variableValue = raw[variableName];
      if (typeof variableValue !== 'string') {
        throw new Error(`${command} returned invalid ${key}`);
      }
      decoded[variableName] = variableValue;
    }
    return decoded;
  }

  private async loadEnabledSources(
    isCurrent: (() => boolean) | undefined,
  ): Promise<Map<string, SourceSwitchRegistryEntry>> {
    const revision = this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision();
    if (revision !== undefined && this.cachedSourceRevision === revision && this.cachedSources !== undefined) return this.cachedSources;
    const result = await this.runtimeOwner.request(
      'source.list',
      { enabledOnly: true },
      this.requestOptions(isCurrent),
    );
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources = new Map<string, SourceSwitchRegistryEntry>();
    const nonReadable = new Set<string>();
    for (let sourceOrder = 0; sourceOrder < rawSources.length; sourceOrder += 1) {
      const raw = rawSources[sourceOrder];
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        continue;
      }
      const source = raw as JsonObject;
      const sourceId = this.optionalString(source, 'sourceId');
      const sourceVersion = source['sourceVersion'];
      if (sourceVersion !== undefined &&
        (typeof sourceVersion !== 'string' || sourceVersion.trim().length === 0)) continue;
      if (source['enabled'] === true && sourceId !== undefined && sourceId.trim().length > 0) {
        const sourceName = this.optionalString(source, 'name');
        const rawBookSource = source['bookSource'];
        let bookSourceType: unknown = undefined;
        let group: string | undefined = undefined;
        if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
          const bookSource = rawBookSource as JsonObject;
          bookSourceType = bookSource['bookSourceType'];
          group = this.optionalString(bookSource, 'bookSourceGroup');
        }
        const category = classifyReaderSource({ bookSourceType, name: sourceName, group, sourceId,
          baseUrl: this.optionalString(source, 'baseUrl') });
        if (!readerSourceCategoryIsReadable(category)) { nonReadable.add(sourceId); continue; }
        const baseUrl = this.optionalString(source, 'baseUrl');
        sources.set(sourceId, {
          sourceId,
          sourceName: sourceName === undefined || sourceName.trim().length === 0 ? sourceId : sourceName,
          sourceOrder,
          sourceVersion: this.optionalString(source, 'sourceVersion'),
          category,
          baseUrl,
          providerFamily: sourceSwitchProviderFamilyKey(sourceName, baseUrl),
        });
      }
    }
    if (revision !== this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision()) throw new Error('书源配置已变更，请重试');
    this.cachedSourceRevision = revision;
    this.cachedSources = sources;
    this.cachedNonReadableSourceIds = nonReadable;
    return sources;
  }

  private matchesCandidateBook(
    candidate: SourceSwitchCandidate,
    query: SourceSwitchProbeQuery,
  ): boolean {
    return this.normalizeBookName(candidate.bookName) === this.normalizeBookName(query.bookName) &&
      bookAuthorIdentity(candidate.author ?? '', candidate.authorIdentity, candidate.sourceVersion) ===
        bookAuthorIdentity(query.author, query.authorIdentity, query.sourceVersion);
  }

  private decodeCachedCandidate(
    book: JsonObject,
    query: SourceSwitchProbeQuery,
    checkedAt: number,
    source: SourceSwitchRegistryEntry,
  ): SourceSwitchCandidate {
    const sourceId = this.requireString(book, 'origin', 'search-book.related');
    const bookUrl = this.requireString(book, 'bookUrl', 'search-book.related');
    const bookName = this.requireString(book, 'name', 'search-book.related');
    const candidate: SourceSwitchCandidate = {
      sourceId,
      sourceName: source.sourceName,
      category: source.category,
      sourceOrder: source.sourceOrder,
      providerFamily: source.providerFamily,
      bookUrl,
      bookName,
      checkedAt,
      isCurrent: sourceSwitchCandidateKey(sourceId, bookUrl) ===
        sourceSwitchCandidateKey(query.sourceId, query.bookId),
    };
    const facts = book['acquisition'] as JsonObject | undefined;
    const version = facts === undefined ? undefined : this.optionalString(facts, 'sourceVersion');
    candidate.sourceVersion = version;
    const timing = readSourceSwitchSearchTiming(facts, source.sourceVersion);
    if (timing !== undefined) {
      candidate.latencyMs = timing.latencyMs;
      candidate.latencyKind = 'search';
      candidate.latencyMeasuredAt = timing.latencyMeasuredAt;
    }
    const catalogAt = facts === undefined ? checkedAt : this.optionalNumber(facts, 'catalogAt') ?? checkedAt;
    const stale = catalogAt <= 0 || Date.now() < catalogAt || Date.now() - catalogAt >= SOURCE_SWITCH_CACHE_TTL_MS ||
      facts?.['stale'] === true || (source.sourceVersion !== undefined && version !== source.sourceVersion);
    const failure = facts?.['failure'] as JsonObject | undefined;
    const rank = acquisitionCandidateRank(facts, source.sourceVersion ?? '');
    const unconfirmedFailure = acquisitionAttemptFailureCurrent(facts, source.sourceVersion ?? '') && rank !== 3;
    candidate.acquisitionState = stale ? 'stale' : rank === 3 ? 'failed' : unconfirmedFailure ? 'attemptFailed' : rank === 0 ? 'readable' :
      rank === 1 ? 'catalogReady' : 'discovered';
    candidate.verifiedChapterUrl = acquisitionReadableCurrent(facts, source.sourceVersion ?? '') && facts !== undefined ?
      this.optionalString(facts, 'readableChapterUrl') : undefined;
    candidate.acquisitionMessage = acquisitionBookFailureCurrent(facts, source.sourceVersion ?? '') && failure !== undefined ?
      this.optionalString(failure, 'message') : unconfirmedFailure ? '上次读取失败' : undefined;
    const variable = this.optionalString(book, 'variable');
    if (variable !== undefined) {
      try {
        const parsed = JSON.parse(variable) as JsonObject;
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const variables: RemoteReadingVariable[] = [];
          for (const name of Object.keys(parsed)) {
            if (typeof parsed[name] !== 'string') throw new Error('候选续传变量无效');
            variables.push({ name, value: parsed[name] as string });
          }
          candidate.searchVariables = variables;
        }
      } catch (_error) { /* Legacy invalid variable JSON cannot authorize a request context. */ }
    }
    const author = this.optionalString(book, 'author');
    const coverUrl = this.optionalString(book, 'coverUrl');
    const latestChapterTitle = this.optionalString(book, 'latestChapterTitle');
    const chapterWordCount = this.optionalNumber(book, 'chapterWordCount');
    const cachedChapter = this.parseCachedChapter(this.optionalString(book, 'chapterWordCountText'));
    if (author !== undefined && author.length > 0) {
      candidate.author = author;
      candidate.authorIdentity = readBookAuthorIdentity(facts?.['authorIdentity'], author, source.sourceVersion);
    }
    if (coverUrl !== undefined && coverUrl.length > 0) {
      candidate.coverUrl = coverUrl;
    }
    if (latestChapterTitle !== undefined && latestChapterTitle.length > 0) {
      candidate.latestChapterTitle = latestChapterTitle;
    }
    if (chapterWordCount !== undefined && chapterWordCount >= 0) {
      candidate.chapterWordCount = chapterWordCount;
    }
    if (cachedChapter !== undefined) {
      candidate.currentChapterTitle = cachedChapter.title;
      if (cachedChapter.index !== undefined) {
        candidate.currentChapterIndex = cachedChapter.index;
      }
    }
    return candidate;
  }

  private parseCachedChapter(value: string | undefined): SourceSwitchCachedChapter | undefined {
    if (value === undefined || value.trim().length === 0) {
      return undefined;
    }
    const firstLine = value.split('\n')[0].trim();
    const match = /^\[(\d+)]\s*(.*)$/.exec(firstLine);
    if (match === null) {
      return { title: firstLine };
    }
    const oneBasedIndex = Number(match[1]);
    const title = match[2].trim();
    if (!Number.isInteger(oneBasedIndex) || oneBasedIndex <= 0 || title.length === 0) {
      return { title: firstLine };
    }
    return { title, index: oneBasedIndex - 1 };
  }

  private sortCandidates(candidates: SourceSwitchCandidate[]): SourceSwitchCandidate[] {
    return candidates.slice().sort((left: SourceSwitchCandidate, right: SourceSwitchCandidate): number => {
      const leftLatency = left.latencyKind === 'search' && left.latencyMs !== undefined &&
        Number.isFinite(left.latencyMs) && left.latencyMs >= 0 ? left.latencyMs : Number.POSITIVE_INFINITY;
      const rightLatency = right.latencyKind === 'search' && right.latencyMs !== undefined &&
        Number.isFinite(right.latencyMs) && right.latencyMs >= 0 ? right.latencyMs : Number.POSITIVE_INFINITY;
      if (leftLatency !== rightLatency) return leftLatency < rightLatency ? -1 : 1;
      const order = (left.sourceOrder ?? 0) - (right.sourceOrder ?? 0);
      if (order !== 0) {
        return order;
      }
      const leftKey = sourceSwitchCandidateKey(left.sourceId, left.bookUrl);
      const rightKey = sourceSwitchCandidateKey(right.sourceId, right.bookUrl);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  }

  private normalizeBookName(value: string): string {
    const cached = this.normalizedMatchText.get(value);
    if (cached !== undefined) return cached;
    const normalized = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (value.length <= 2048) {
      if (this.normalizedMatchText.size >= 2048) {
        for (const oldest of this.normalizedMatchText.keys()) { this.normalizedMatchText.delete(oldest); break; }
      }
      this.normalizedMatchText.set(value, normalized);
    }
    return normalized;
  }

  private matchesAuthor(candidateAuthor: string | undefined, queryAuthor: string): boolean {
    const expected = this.normalizeAuthor(queryAuthor);
    return this.normalizeAuthor(candidateAuthor ?? '') === expected;
  }

  private normalizeAuthor(value: string): string {
    return bookAuthorIdentity(value);
  }

  private normalizeChapterTitle(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private mergeVariables(base: JsonObject, override: JsonObject): JsonObject {
    const merged: JsonObject = {};
    for (const key of Object.keys(base)) {
      merged[key] = base[key];
    }
    for (const key of Object.keys(override)) {
      merged[key] = override[key];
    }
    return merged;
  }

  private validateProbeQuery(query: SourceSwitchProbeQuery): void {
    this.assertNonBlankString(query.sourceId, 'sourceId');
    this.assertNonBlankString(query.bookId, 'bookId');
    this.assertNonBlankString(query.bookName, 'bookName');

    if (!Number.isInteger(query.currentChapterIndex) || query.currentChapterIndex < 0) {
      throw new Error('currentChapterIndex must be a non-negative integer');
    }
  }

  private assertNonBlankString(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${field} must be a non-blank string`);
    }
  }
}

/**
 * Pure mapping from a discovered candidate + its fetched TOC into the
 * `source.switch.commit` params. Keeps Index thin and the mapping testable.
 */
export function buildSourceSwitchCommitParams(
  from: { sourceId: string; bookId: string },
  candidate: SourceSwitchCandidate,
  toc: SourceSwitchTargetToc,
  currentChapterTitle: string,
  currentChapterIndex: number,
  updatedAt: number,
): SourceSwitchCommitParams {
  if (candidate.sourceId !== toc.sourceId || candidate.bookUrl !== toc.bookId ||
    toc.readingSession.identity.sourceId !== toc.sourceId || toc.readingSession.identity.bookId !== toc.bookId) {
    throw new Error('source switch candidate and acquired catalog identities do not match');
  }
  const target: SourceSwitchTarget = {
    sourceId: toc.sourceId,
    bookId: toc.bookId,
    title: toc.bookName,
    author: toc.author,
    intro: toc.intro,
    kind: toc.kind,
    lastChapter: toc.latestChapterTitle,
  };
  if (toc.coverUrl !== undefined) {
    target.coverUrl = toc.coverUrl;
  }
  const newToc: SourceSwitchNewTocEntry[] = [];
  for (const entry of toc.entries) {
    newToc.push({
      chapterId: entry.url,
      chapterTitle: entry.title,
      chapterUrl: entry.url,
      order: entry.index,
    });
  }
  return {
    from,
    target,
    newToc,
    currentChapterTitle,
    currentChapterIndex,
    updatedAt,
  };
}
