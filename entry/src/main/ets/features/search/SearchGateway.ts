import { bookTitleAuthorKey, readBookAuthorIdentity, type BookAuthorIdentityProof } from '../common/BookAuthorMetadata';
import type { JsonObject } from '@reader/core-harmony';
import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import { errorMessageOf, httpTransportFailureSummary, type HttpTransportFailureSummary } from '../../app/ErrorMessage';
import { SearchBookProjection, type SearchBookPatch } from './SearchBookProjection';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  classifyReaderSource,
  readerSourceCategoryIsText,
  type ReaderSourceCategory,
} from '../source/ReaderSourceCategory';

/**
 * A single `book.search` result. Reader Core serializes the domain `Book`
 * shape (`bookId`, `title`, `lastChapter`); the source identity is supplied by
 * the request that produced it, not guessed from a stale search cache.
 */
export type SearchBook = {
  /** Assigned when this exact identity first enters a query, before category filtering. */
  admittedOrder?: number;
  acquisition?: JsonObject;
  groupKey?: string;
  sourceId: string;
  sourceName: string;
  /** The source's own URL identity (legado `bookSourceUrl`). */
  bookSourceUrl: string;
  bookId: string;
  /** Exact detail URL/path emitted as Core's non-blank remote `bookId`. */
  detailUrl: string;
  /** Search sweep that produced this result; stale sweeps are rejected downstream. */
  searchRequestId: string;
  /** Opaque Core hash of the complete source rule definition. */
  sourceRuleVersion: string;
  category: ReaderSourceCategory;
  title: string;
  author: string;
  authorIdentity?: BookAuthorIdentityProof;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  latestChapterTitle?: string;
  /** Typed continuation variables emitted by this exact search result. */
  variables: SearchBookVariable[];
};

export type SearchBookVariable = {
  name: string;
  value: string;
};

/** Preserve every candidate field while assigning this query's admission order. */
export function searchBookWithAdmission(book: SearchBook, admittedOrder: number): SearchBook {
  return { ...book, admittedOrder };
}

export type SearchHistory = {
  keywords: string[];
  count: number;
};

export type SearchResultDelta = {
  baseRevision: number;
  revision: number;
  reset: boolean;
  upserted: SearchBook[];
  removedKeys: string[];
};

/**
 * A single `source.list` entry used by search intent selection. `enabled`
 * is the persisted Core state, not a presentation-derived default: callers
 * decide which of the returned sources may be searched.
 */
export type SearchSource = {
  sourceVersion?: string;
  sourceId: string;
  name: string;
  enabled: boolean;
  /** Source URL identity from `source.list`; falls back to sourceId when absent. */
  baseUrl?: string;
  /** Legado `bookSourceGroup`, trimmed; undefined when the source declares none. */
  group?: string;
  category: ReaderSourceCategory;
};

export type SearchOutcome =
  | { ok: true; results: SearchBook[]; discardedCount?: number; discardedReasons?: string[] }
  | { ok: false; error: string; diagnostic?: HttpTransportFailureSummary };

type SearchRequestGuard = () => boolean;

type LocalSearchMatchedPage = {
  offset: number;
  length: number;
  bookIds: string[];
};

/**
 * Feature-local gateway for the Search page. It owns the Core protocol
 * boundary for `search.history.*`, `source.list`, and `book.search`, and
 * validates every JSON envelope before the page sees it. Cache projection
 * joins only books already admitted to this query and dispatches no source HTTP.
 */
export class SearchGateway {
  private static readonly LOCAL_SEARCH_PAGE_SIZE: number = 128;
  private static readonly LOCAL_SEARCH_FULL_PAGE_THRESHOLD: number = 32;
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private searchRequestCounter: number = 0;
  private cachedSources: SearchSource[] | undefined = undefined;
  private cachedSourceRevision: number | undefined = undefined;
  private loadingSources: Promise<SearchSource[]> | undefined = undefined;
  private loadingSourceRevision: number | undefined = undefined;
  private bookProjectionEpoch: number = 0;
  private bookProjection: SearchBookProjection = new SearchBookProjection();

  private sourceRevision(): number | undefined {
    return this.runtimeOwner.bookAcquisitions?.().sourceRegistryRevision?.();
  }

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /**
   * A stable id for one search sweep. Every result of the sweep carries it, so
   * callers can reject late async results from an older keyword/scope.
   */
  generateSearchRequestId(keyword: string): string {
    this.searchRequestCounter += 1;
    return `search-${Date.now().toString(36)}-${this.searchRequestCounter}-${keyword.length}`;
  }

  private sourceBookUrl(source: SearchSource): string {
    return source.baseUrl !== undefined && source.baseUrl.trim().length > 0 ?
      source.baseUrl : source.sourceId;
  }

  async loadHistory(): Promise<SearchHistory> {
    const result = await this.runtimeOwner.request('search.history.list', {});
    const rawKeywords = result.data['keywords'];
    const total = result.data['count'];
    if (!Array.isArray(rawKeywords) || typeof total !== 'number' || !Number.isInteger(total) || total < 0) {
      throw new Error('search.history.list returned invalid data');
    }
    const keywords: string[] = [];
    for (const raw of rawKeywords) {
      if (typeof raw !== 'string' || raw.trim().length === 0) {
        throw new Error('search.history.list returned a non-string keyword');
      }
      keywords.push(raw);
    }
    return { keywords, count: total };
  }

  async addHistory(keyword: string): Promise<void> {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      throw new Error('search.history.add requires a non-blank keyword');
    }
    await this.runtimeOwner.request('search.history.add', { keyword });
  }

  async clearHistory(): Promise<void> {
    await this.runtimeOwner.request('search.history.clear', {});
  }

  /**
   * `book.search` is a real Core call that routes live source requests through
   * the Host. The Harmony Host deliberately rejects transport semantics it
   * cannot honor (for example followRedirects=false); the caller receives that
   * failure explicitly and must render its admitted error state rather than
   * relabeling unrelated cached `search-book.list` data as this keyword.
   */
  async searchBySource(
    source: SearchSource,
    keyword: string,
    isCurrent?: SearchRequestGuard,
    searchRequestId?: string,
    canDispatch?: SearchRequestGuard,
  ): Promise<SearchOutcome> {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      return { ok: false, error: 'empty keyword' };
    }
    if (typeof source.sourceId !== 'string' || source.sourceId.length === 0) {
      return { ok: false, error: 'empty sourceId' };
    }
    // Older injected callers may not yet carry the derived field. Such
    // callers represent the legacy text-source contract; the source-list
    // decoder always supplies an explicit category for real app traffic.
    const sourceCategory = source.category ?? 'novel';
    if (!readerSourceCategoryIsText(sourceCategory)) {
      return { ok: false, error: `source category ${sourceCategory} is not supported by the novel reader` };
    }
    const requestId = searchRequestId !== undefined && searchRequestId.length > 0 ?
      searchRequestId : this.generateSearchRequestId(keyword);
    const identity = {
      searchRequestId: requestId,
      bookSourceUrl: this.sourceBookUrl(source),
      sourceRuleVersion: source.sourceVersion ?? '',
    };
    try {
      const result = await this.runtimeOwner.request('book.search', {
        sourceId: source.sourceId,
        keyword: keyword,
      }, this.requestOptions(isCurrent, canDispatch));
      const data = result.data;
      const returnedSourceId = requiredString(data, 'sourceId');
      if (returnedSourceId !== source.sourceId) {
        return { ok: false, error: 'book.search returned a mismatched sourceId' };
      }
      if (data['sourceVersion'] !== undefined) {
        if (typeof data['sourceVersion'] !== 'string' || data['sourceVersion'].length === 0 ||
          (source.sourceVersion !== undefined && data['sourceVersion'] !== source.sourceVersion)) {
          return { ok: false, error: 'book.search returned a mismatched sourceVersion' };
        }
        identity.sourceRuleVersion = data['sourceVersion'] as string;
      }
      const rawBooks = data['books'];
      if (!Array.isArray(rawBooks)) {
        return { ok: false, error: 'book.search returned invalid books' };
      }
      const books: SearchBook[] = [];
      let discardedCount = 0;
      const discardedReasons: string[] = [];
      let processed = 0;
      for (const raw of rawBooks) {
        if (++processed % 32 === 0) {
          await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
          if (isCurrent?.() === false) return { ok: false, error: 'search superseded' };
        }
        try { books.push(decodeBookSearchResult(raw, source, identity)); }
        catch (error) {
          discardedCount += 1;
          // Decoder messages name only fields; do not retain response values.
          if (discardedReasons.length < 4) discardedReasons.push(errorMessageOf(error));
        }
      }
      if (books.length === 0 && discardedCount > 0) return { ok: false, error: discardedReasons[0] };
      if (discardedCount > 0) return { ok: true, results: books, discardedCount, discardedReasons };
      return { ok: true, results: books };
    } catch (error) {
      const message = errorMessageOf(error);
      const diagnostic = httpTransportFailureSummary(error);
      return diagnostic === undefined ? { ok: false, error: message } : { ok: false, error: message, diagnostic };
    }
  }

  async searchLocalBooks(keyword: string, searchRequestId: string,
    isCurrent?: SearchRequestGuard): Promise<SearchBook[]> {
    // Local imports are materialized into the shelf transactionally; removing
    // a local member deletes its parsed catalog too. Remote shelf members are
    // deliberately excluded from the local-import result category.
    const query = keyword.trim().toLocaleLowerCase();
    // SQLite lower() is ASCII-only whereas toLocaleLowerCase() also folds
    // characters such as K into ASCII. A full SQL keyword filter would drop
    // valid existing results. Han characters cannot be created by case folding,
    // so a contiguous Han run is a safe candidate prefilter; the Host still
    // applies the exact title/author match below (Core also matches bookId).
    const safeRun = /[\u3400-\u9fff]+/.exec(query);
    const safeKeyword = safeRun === null ? undefined : safeRun[0];
    const baseParams: JsonObject = { sourceKind: 'local' };
    if (safeKeyword !== undefined) baseParams['keyword'] = safeKeyword;
    if (this.runtimeOwner.supportsCoreCapability?.('bookshelf.pageProjection.v1') !== true) {
      // An older Core may not understand sourceKind/keyword. Retain the
      // original unfiltered request and Host-side local/title/author filter.
      this.assertCurrentLocalSearch(isCurrent);
      const result = await this.runtimeOwner.request('bookshelf.list', {}, this.requestOptions(isCurrent));
      this.assertCurrentLocalSearch(isCurrent);
      const books: SearchBook[] = [];
      this.appendLocalMatches(result.data['books'], query, searchRequestId, books);
      return books;
    }
    // A page projection omits intro, which the search card and detail consume.
    // For a safe Han candidate, bounded Full DTO pages avoid one exact lookup
    // per match. Otherwise Core's ASCII-only lower() cannot narrow the query:
    // scan lightweight membership pages and hydrate only exact Host matches.
    // Both paths are revision-bound so a concurrent shelf write cannot publish
    // a mixed-version result.
    const lightweight = safeKeyword === undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      this.assertCurrentLocalSearch(isCurrent);
      const initialRevision = await this.localShelfRevision(baseParams, isCurrent);
      if (initialRevision === undefined) continue;
      const books: SearchBook[] = [];
      const matchedPages: LocalSearchMatchedPage[] = [];
      let offset = 0;
      let total: number | undefined;
      let changed = false;
      while (true) {
        this.assertCurrentLocalSearch(isCurrent);
        const params: JsonObject = { ...baseParams,
          limit: SearchGateway.LOCAL_SEARCH_PAGE_SIZE, offset };
        if (lightweight) {
          params['pageProjection'] = true;
          params['membershipOnly'] = true;
          params['projectionRevision'] = initialRevision;
        }
        const page = (await this.runtimeOwner.request('bookshelf.list', params,
          this.requestOptions(isCurrent))).data;
        this.assertCurrentLocalSearch(isCurrent);
        const pageBooks = page['books'];
        const pageTotal = page['total'];
        if (!Array.isArray(pageBooks) || pageBooks.length > SearchGateway.LOCAL_SEARCH_PAGE_SIZE ||
          typeof pageTotal !== 'number' || !Number.isSafeInteger(pageTotal) || pageTotal < 0) {
          throw new Error('local search returned invalid page');
        }
        if (lightweight) {
          if (typeof page['changed'] !== 'boolean' ||
            typeof page['projectionRevision'] !== 'string' || page['projectionRevision'].length === 0 ||
            typeof page['offset'] !== 'number' || page['offset'] !== offset ||
            (page['changed'] && pageBooks.length !== 0)) {
            throw new Error('local search returned invalid page projection');
          }
          if (page['changed'] || page['projectionRevision'] !== initialRevision) {
            changed = true;
            break;
          }
        }
        if (total === undefined) total = pageTotal;
        if (pageTotal !== total || offset + pageBooks.length > total ||
          (pageBooks.length === 0 && offset < total)) {
          changed = true;
          break;
        }
        if (lightweight) {
          const pageMatches: string[] = [];
          for (const raw of pageBooks) {
            const book = this.localShelfBookObject(raw);
            if (book['sourceId'] === 'local' && this.localBookMatches(book, query)) {
              pageMatches.push(requiredNonBlankString(book, 'bookId'));
            }
          }
          if (pageMatches.length > 0) matchedPages.push({ offset, length: pageBooks.length,
            bookIds: pageMatches });
        } else {
          this.appendLocalMatches(pageBooks, query, searchRequestId, books);
        }
        offset += pageBooks.length;
        if (offset >= total) break;
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
      if (changed) continue;
      if (lightweight) {
        for (const matchedPage of matchedPages) {
          if (matchedPage.bookIds.length >= SearchGateway.LOCAL_SEARCH_FULL_PAGE_THRESHOLD) {
            this.assertCurrentLocalSearch(isCurrent);
            const fullPage = (await this.runtimeOwner.request('bookshelf.list', { ...baseParams,
              limit: SearchGateway.LOCAL_SEARCH_PAGE_SIZE, offset: matchedPage.offset },
            this.requestOptions(isCurrent))).data;
            this.assertCurrentLocalSearch(isCurrent);
            const rows = fullPage['books'];
            if (!Array.isArray(rows) || rows.length > SearchGateway.LOCAL_SEARCH_PAGE_SIZE ||
              typeof fullPage['total'] !== 'number' || !Number.isSafeInteger(fullPage['total'])) {
              throw new Error('local search returned invalid full page');
            }
            if (fullPage['total'] !== total || rows.length !== matchedPage.length) {
              changed = true;
              break;
            }
            const start = books.length;
            this.appendLocalMatches(rows, query, searchRequestId, books);
            const hydratedIds = books.slice(start).map((book: SearchBook): string => book.bookId);
            if (hydratedIds.length !== matchedPage.bookIds.length ||
              hydratedIds.some((id: string, index: number): boolean => id !== matchedPage.bookIds[index])) {
              changed = true;
              break;
            }
          } else {
            for (const bookId of matchedPage.bookIds) {
              this.assertCurrentLocalSearch(isCurrent);
              const detail = (await this.runtimeOwner.request('bookshelf.get',
                { sourceId: 'local', bookId }, this.requestOptions(isCurrent))).data['book'];
              this.assertCurrentLocalSearch(isCurrent);
              if (detail === null) {
                changed = true;
                break;
              }
              const fullBook = this.localShelfBookObject(detail);
              if (fullBook['sourceId'] !== 'local' || fullBook['bookId'] !== bookId) {
                throw new Error('local search returned mismatched exact book');
              }
              if (!this.localBookMatches(fullBook, query)) {
                changed = true;
                break;
              }
              this.appendLocalMatches([fullBook], query, searchRequestId, books);
            }
            if (changed) break;
          }
        }
      }
      if (changed) continue;
      this.assertCurrentLocalSearch(isCurrent);
      const finalRevision = await this.localShelfRevision(baseParams, isCurrent);
      if (finalRevision === initialRevision) return books;
    }
    throw new Error('local search shelf changed while reading');
  }

  private async localShelfRevision(baseParams: JsonObject,
    isCurrent?: SearchRequestGuard): Promise<string | undefined> {
    const page = (await this.runtimeOwner.request('bookshelf.list', { ...baseParams,
      pageProjection: true, membershipOnly: true, limit: 1, offset: 0 },
    this.requestOptions(isCurrent))).data;
    this.assertCurrentLocalSearch(isCurrent);
    const revision = page['projectionRevision'];
    if (!Array.isArray(page['books']) || typeof revision !== 'string' || revision.length === 0 ||
      typeof page['changed'] !== 'boolean') {
      throw new Error('local search returned invalid revision projection');
    }
    return page['changed'] ? undefined : revision;
  }

  private appendLocalMatches(rows: unknown, query: string, searchRequestId: string, books: SearchBook[]): void {
    if (!Array.isArray(rows)) throw new Error('local search returned invalid books');
    for (const raw of rows) {
      const book = this.localShelfBookObject(raw);
      if (book['sourceId'] !== 'local') continue;
      const title = requiredNonBlankString(book, 'title');
      const author = requiredString(book, 'author');
      if (!this.localBookMatches(book, query)) continue;
      books.push({ sourceId: 'local', sourceName: '本地导入', bookSourceUrl: '',
        bookId: requiredNonBlankString(book, 'bookId'), detailUrl: '', searchRequestId,
        sourceRuleVersion: 'local', category: 'novel', title, author,
        coverUrl: optionalString(book, 'coverUrl'), intro: optionalString(book, 'intro'),
        kind: optionalString(book, 'kind'), variables: [] });
    }
  }

  private localShelfBookObject(value: unknown): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('local search returned invalid book');
    }
    return value as JsonObject;
  }

  private localBookMatches(book: JsonObject, query: string): boolean {
    const title = requiredNonBlankString(book, 'title');
    const author = requiredString(book, 'author');
    return title.toLocaleLowerCase().includes(query) || author.toLocaleLowerCase().includes(query);
  }

  private assertCurrentLocalSearch(isCurrent?: SearchRequestGuard): void {
    if (isCurrent?.() === false) throw new Error('local search superseded');
  }

  async loadSources(): Promise<SearchSource[]> {
    const revision = this.sourceRevision();
    // Opening Search and immediately submitting share one versioned source
    // projection. Unknown revisions deliberately do not reuse stale metadata.
    if (revision !== undefined && this.cachedSourceRevision === revision && this.cachedSources !== undefined) {
      return this.cachedSources;
    }
    if (revision !== undefined && this.loadingSourceRevision === revision && this.loadingSources !== undefined) {
      return this.loadingSources;
    }
    const loading = this.readSources(revision);
    this.loadingSources = loading;
    this.loadingSourceRevision = revision;
    try { return await loading; }
    finally {
      if (this.loadingSources === loading) this.loadingSources = undefined;
    }
  }

  private async readSources(revision: number | undefined): Promise<SearchSource[]> {
    const result = await this.runtimeOwner.request('source.list', {});
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources: SearchSource[] = [];
    let processed = 0;
    for (const raw of rawSources) {
      if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('source.list returned a non-object source');
      }
      const source = raw as JsonObject;
      const sourceId = requiredString(source, 'sourceId');
      const name = requiredString(source, 'name');
      const enabled = requiredBoolean(source, 'enabled');
      const baseUrl = optionalString(source, 'baseUrl');
      let bookSourceType: unknown = undefined;
      const decoded: SearchSource = {
        sourceId, name, enabled, sourceVersion: optionalString(source, 'sourceVersion'),
        category: 'novel',
      };
      if (baseUrl !== undefined) {
        decoded.baseUrl = baseUrl;
      }
      const rawBookSource = source['bookSource'];
      if (rawBookSource !== null && typeof rawBookSource === 'object' && !Array.isArray(rawBookSource)) {
        const rawBookSourceObject = rawBookSource as JsonObject;
        bookSourceType = rawBookSourceObject['bookSourceType'];
        const group = optionalString(rawBookSourceObject, 'bookSourceGroup');
        if (group !== undefined && group.trim().length > 0) {
          decoded.group = group.trim();
        }
      }
      decoded.category = classifyReaderSource({ bookSourceType, name, group: decoded.group,
        sourceId, baseUrl });
      sources.push(decoded);
    }
    if (revision !== this.sourceRevision()) throw new Error('source registry changed while loading');
    this.cachedSources = sources;
    this.cachedSourceRevision = revision;
    return sources;
  }

  resetBookProjection(): void { this.bookProjectionEpoch += 1; this.bookProjection.reset(); }

  async refreshBookDelta(books: Map<string, SearchBook>, change: BookAcquisitionChange): Promise<SearchBookPatch> {
    const epoch = this.bookProjectionEpoch;
    const sources = await this.loadSources();
    if (epoch !== this.bookProjectionEpoch) throw new Error('search projection superseded');
    const revision = this.sourceRevision();
    return this.bookProjection.refresh(books, change, sources,
      async (method: string, params: JsonObject): Promise<JsonObject> => {
        const result = await this.runtimeOwner.request(method, params);
        return result.data;
      }, (): boolean => revision === this.sourceRevision());
  }

  /** Compatibility entry for callers without a query-owned identity index. */
  async refreshBooks(books: SearchBook[], change?: BookAcquisitionChange): Promise<SearchBook[]> {
    const indexed = new Map<string, SearchBook>();
    for (const book of books) indexed.set(`${book.sourceId}\u0000${book.bookId}`, book);
    const patch = await this.refreshBookDelta(indexed, change ?? { reset: true, identities: [] });
    if (patch.upserted.length === 0 && patch.removedKeys.length === 0) return books;
    for (const key of patch.removedKeys) indexed.delete(key);
    for (const book of patch.upserted) indexed.set(`${book.sourceId}\u0000${book.bookId}`, book);
    return Array.from(indexed.values());
  }

  private requestOptions(isCurrent: SearchRequestGuard | undefined, canDispatch?: SearchRequestGuard): BookRequestOptions {
    return { shouldCancel: isCurrent === undefined ? undefined : (): boolean => !isCurrent(), canDispatch };
  }
}

/**
 * Decode one live Core search item without deriving a second remote identity.
 * The domain `bookId` is also the exact detail URL/path consumed by
 * `book.detail`, so both fields deliberately retain the same validated value.
 * Every result carries the full immutable source identity of the request that
 * produced it: any dedupe or aggregation downstream must keep per-source rows.
 */
function decodeBookSearchResult(
  value: unknown,
  source: SearchSource,
  identity: { searchRequestId: string; bookSourceUrl: string; sourceRuleVersion: string },
): SearchBook {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('book.search returned a non-object book');
  }
  const book = value as JsonObject;
  // A blank remote identity or title would create a non-actionable, empty
  // Figma card. Reject malformed source data rather than fabricating a route.
  const bookId = requiredNonBlankString(book, 'bookId');
  const authorIdentity = readBookAuthorIdentity(book['authorIdentity'], optionalString(book, 'author') ?? '', identity.sourceRuleVersion);
  const decoded: SearchBook = {
    sourceId: source.sourceId,
    sourceName: source.name,
    bookSourceUrl: identity.bookSourceUrl,
    bookId,
    detailUrl: bookId,
    searchRequestId: identity.searchRequestId,
    sourceRuleVersion: identity.sourceRuleVersion,
    category: source.category ?? 'novel',
    groupKey: bookTitleAuthorKey(requiredNonBlankString(book, 'title'), optionalString(book, 'author') ?? '',
      authorIdentity, identity.sourceRuleVersion),
    title: requiredNonBlankString(book, 'title'),
    author: optionalString(book, 'author') ?? '',
    variables: decodeBookSearchVariables(book['variables']),
  };
  if (authorIdentity !== undefined) decoded.authorIdentity = authorIdentity;
  const coverUrl = optionalString(book, 'coverUrl');
  const intro = optionalString(book, 'intro');
  const kind = optionalString(book, 'kind');
  const latestChapterTitle = optionalString(book, 'lastChapter');
  if (coverUrl !== undefined) {
    decoded.coverUrl = coverUrl;
  }
  if (intro !== undefined) {
    decoded.intro = intro;
  }
  if (kind !== undefined) {
    decoded.kind = kind;
  }
  if (latestChapterTitle !== undefined) {
    decoded.latestChapterTitle = latestChapterTitle;
  }
  return decoded;
}

function decodeBookSearchVariables(value: unknown): SearchBookVariable[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('book.search returned invalid variables');
  }
  const rawVariables = value as JsonObject;
  const names = Object.keys(rawVariables).sort();
  const variables: SearchBookVariable[] = [];
  for (const name of names) {
    const variableValue = rawVariables[name];
    if (typeof variableValue !== 'string') {
      throw new Error('book.search returned non-string variables');
    }
    variables.push({ name, value: variableValue });
  }
  return variables;
}

function requiredString(value: JsonObject, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string') {
    throw new Error(`search protocol returned invalid ${key}`);
  }
  return candidate;
}

function requiredNonBlankString(value: JsonObject, key: string): string {
  const candidate = requiredString(value, key);
  if (candidate.trim().length === 0) {
    throw new Error(`search protocol returned blank ${key}`);
  }
  return candidate;
}

function requiredBoolean(value: JsonObject, key: string): boolean {
  const candidate = value[key];
  if (typeof candidate !== 'boolean') {
    throw new Error(`search protocol returned invalid ${key}`);
  }
  return candidate;
}

function optionalString(value: JsonObject, key: string): string | undefined {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) {
    return undefined;
  }
  if (typeof candidate !== 'string') {
    throw new Error(`search protocol returned invalid ${key}`);
  }
  return candidate;
}
