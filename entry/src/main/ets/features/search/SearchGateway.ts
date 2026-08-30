import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

/**
 * A single `book.search` result. Reader Core serializes the domain `Book`
 * shape (`bookId`, `title`, `lastChapter`); the source identity is supplied by
 * the request that produced it, not guessed from a stale search cache.
 */
export type SearchBook = {
  sourceId: string;
  sourceName: string;
  /** The source's own URL identity (legado `bookSourceUrl`). */
  bookSourceUrl: string;
  bookId: string;
  /** Exact detail URL/path emitted as Core's non-blank remote `bookId`. */
  detailUrl: string;
  /** Search sweep that produced this result; stale sweeps are rejected downstream. */
  searchRequestId: string;
  /** Bumped whenever the source's baseUrl changes under this gateway. */
  sourceRuleVersion: number;
  title: string;
  author: string;
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

export type SearchHistory = {
  keywords: string[];
  count: number;
};

/**
 * A single `source.list` entry used by search intent selection. `enabled`
 * is the persisted Core state, not a presentation-derived default: callers
 * decide which of the returned sources may be searched.
 */
export type SearchSource = {
  sourceId: string;
  name: string;
  enabled: boolean;
  /** Source URL identity from `source.list`; falls back to sourceId when absent. */
  baseUrl?: string;
};

export type SearchOutcome =
  | { ok: true; results: SearchBook[] }
  | { ok: false; error: string };

type SearchRequestGuard = () => boolean;

/**
 * Feature-local gateway for the Search page. It owns the Core protocol
 * boundary for `search.history.*`, `source.list`, and `book.search`, and
 * validates every JSON envelope before the page sees it. It never creates a
 * runtime or turns `search-book.list` cache records into live query results.
 */
export class SearchGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private readonly sourceRuleVersions: Map<string, number> = new Map();
  private readonly sourceBaseUrls: Map<string, string> = new Map();
  private searchRequestCounter: number = 0;

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

  /**
   * Per-source rule version: stable while the source's baseUrl is unchanged,
   * incremented when Core reports a different baseUrl for the same sourceId.
   * Part of the immutable result identity consumed by detail admission keys.
   */
  private currentSourceRuleVersion(source: SearchSource): number {
    const baseUrl = source.baseUrl === undefined || source.baseUrl.trim().length === 0 ?
      source.sourceId : source.baseUrl;
    const previousBaseUrl = this.sourceBaseUrls.get(source.sourceId);
    if (previousBaseUrl === undefined) {
      this.sourceBaseUrls.set(source.sourceId, baseUrl);
      this.sourceRuleVersions.set(source.sourceId, 1);
      return 1;
    }
    if (previousBaseUrl !== baseUrl) {
      const next = (this.sourceRuleVersions.get(source.sourceId) ?? 1) + 1;
      this.sourceBaseUrls.set(source.sourceId, baseUrl);
      this.sourceRuleVersions.set(source.sourceId, next);
      return next;
    }
    const current = this.sourceRuleVersions.get(source.sourceId) ?? 1;
    this.sourceRuleVersions.set(source.sourceId, current);
    return current;
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
  ): Promise<SearchOutcome> {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      return { ok: false, error: 'empty keyword' };
    }
    if (typeof source.sourceId !== 'string' || source.sourceId.length === 0) {
      return { ok: false, error: 'empty sourceId' };
    }
    const requestId = searchRequestId !== undefined && searchRequestId.length > 0 ?
      searchRequestId : this.generateSearchRequestId(keyword);
    const identity = {
      searchRequestId: requestId,
      bookSourceUrl: this.sourceBookUrl(source),
      sourceRuleVersion: this.currentSourceRuleVersion(source),
    };
    try {
      const result = await this.runtimeOwner.request('book.search', {
        sourceId: source.sourceId,
        keyword: keyword,
      }, this.requestOptions(isCurrent));
      const data = result.data;
      const returnedSourceId = requiredString(data, 'sourceId');
      if (returnedSourceId !== source.sourceId) {
        return { ok: false, error: 'book.search returned a mismatched sourceId' };
      }
      const rawBooks = data['books'];
      if (!Array.isArray(rawBooks)) {
        return { ok: false, error: 'book.search returned invalid books' };
      }
      const books: SearchBook[] = [];
      for (const raw of rawBooks) {
        books.push(decodeBookSearchResult(raw, source, identity));
      }
      return { ok: true, results: books };
    } catch (error) {
      const message = errorMessageOf(error);
      return { ok: false, error: message };
    }
  }

  async loadSources(): Promise<SearchSource[]> {
    const result = await this.runtimeOwner.request('source.list', {});
    const rawSources = result.data['sources'];
    if (!Array.isArray(rawSources)) {
      throw new Error('source.list returned invalid data');
    }
    const sources: SearchSource[] = [];
    for (const raw of rawSources) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('source.list returned a non-object source');
      }
      const source = raw as JsonObject;
      const sourceId = requiredString(source, 'sourceId');
      const name = requiredString(source, 'name');
      const enabled = requiredBoolean(source, 'enabled');
      const baseUrl = optionalString(source, 'baseUrl');
      const decoded: SearchSource = { sourceId, name, enabled };
      if (baseUrl !== undefined) {
        decoded.baseUrl = baseUrl;
      }
      // Register the rule version eagerly so a source-list refresh that swaps a
      // source's baseUrl bumps the version before the next search runs.
      this.currentSourceRuleVersion(decoded);
      sources.push(decoded);
    }
    return sources;
  }

  private requestOptions(isCurrent: SearchRequestGuard | undefined): RequestOptions {
    return isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
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
  identity: { searchRequestId: string; bookSourceUrl: string; sourceRuleVersion: number },
): SearchBook {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('book.search returned a non-object book');
  }
  const book = value as JsonObject;
  // A blank remote identity or title would create a non-actionable, empty
  // Figma card. Reject malformed source data rather than fabricating a route.
  const bookId = requiredNonBlankString(book, 'bookId');
  const decoded: SearchBook = {
    sourceId: source.sourceId,
    sourceName: source.name,
    bookSourceUrl: identity.bookSourceUrl,
    bookId,
    detailUrl: bookId,
    searchRequestId: identity.searchRequestId,
    sourceRuleVersion: identity.sourceRuleVersion,
    title: requiredNonBlankString(book, 'title'),
    author: optionalString(book, 'author') ?? '',
    variables: decodeBookSearchVariables(book['variables']),
  };
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
