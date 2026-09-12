import type { JsonObject } from '@reader/core-harmony';
import type { BookRequestOptions } from '../../app/BookRequestScheduler';
import { errorMessageOf } from '../../app/ErrorMessage';
import { CachedBookIdentityResolver } from '../common/CachedBookIdentity';
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
  | { ok: true; results: SearchBook[] }
  | { ok: false; error: string };

type SearchRequestGuard = () => boolean;

/**
 * Feature-local gateway for the Search page. It owns the Core protocol
 * boundary for `search.history.*`, `source.list`, and `book.search`, and
 * validates every JSON envelope before the page sees it. Cache projection
 * joins only books already admitted to this query and dispatches no source HTTP.
 */
export class SearchGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private searchRequestCounter: number = 0;
  private readonly bookIdentities = new CachedBookIdentityResolver();

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
      if (typeof data['sourceVersion'] === 'string') identity.sourceRuleVersion = data['sourceVersion'] as string;
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

  async searchLocalBooks(keyword: string, searchRequestId: string): Promise<SearchBook[]> {
    // Local imports are materialized into the shelf transactionally; removing
    // a local member deletes its parsed catalog too. Remote shelf members are
    // deliberately excluded from the local-import result category.
    const result = await this.runtimeOwner.request('bookshelf.list', {});
    const rows = result.data['books'];
    if (!Array.isArray(rows)) throw new Error('local search returned invalid books');
    const query = keyword.trim().toLocaleLowerCase();
    const books: SearchBook[] = [];
    for (const raw of rows) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('local search returned invalid book');
      }
      const book = raw as JsonObject;
      if (book['sourceId'] !== 'local') continue;
      const title = requiredNonBlankString(book, 'title');
      const author = requiredString(book, 'author');
      if (!title.toLocaleLowerCase().includes(query) && !author.toLocaleLowerCase().includes(query)) continue;
      books.push({ sourceId: 'local', sourceName: '本地导入', bookSourceUrl: '',
        bookId: requiredNonBlankString(book, 'bookId'), detailUrl: '', searchRequestId,
        sourceRuleVersion: 'local', category: 'novel', title, author,
        coverUrl: optionalString(book, 'coverUrl'), intro: optionalString(book, 'intro'),
        kind: optionalString(book, 'kind'), variables: [] });
    }
    return books;
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
    return sources;
  }

  async refreshBooks(books: SearchBook[]): Promise<SearchBook[]> {
    const sources = await this.loadSources();
    const enabledSources = new Map<string, SearchSource>();
    for (const source of sources) {
      if (source.enabled && readerSourceCategoryIsText(source.category)) enabledSources.set(source.sourceId, source);
    }
    const result = await this.runtimeOwner.request('search-book.list', {});
    const rows = result.data['books'];
    if (!Array.isArray(rows)) return books;
    // A completed broad search can contain thousands of per-source variants.
    // Keep each projection slice bounded so input and rendering can run even
    // when the first refresh has no cached aliases yet.
    let processed = 0;
    const byKey = new Map<string, JsonObject>();
    for (const value of rows) {
      if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const row = value as JsonObject;
        byKey.set(JSON.stringify([row['origin'], row['bookUrl']]), row);
      }
    }
    const identities = await this.bookIdentities.build(Array.from(byKey.values()), new Set(enabledSources.keys()));
    const admittedGroups = new Map<string, SearchBook>();
    const groupKeyOwners = new Map<string, string>();
    const refreshed: SearchBook[] = [];
    const seen = new Set<string>();
    for (const book of books) {
      if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      const key = JSON.stringify([book.sourceId, book.bookId]);
      const row = byKey.get(key);
      const facts = row?.['acquisition'] as JsonObject | undefined;
      const current = row !== undefined && facts?.['sourceVersion'] === book.sourceRuleVersion;
      const projected: SearchBook = current ? { ...book, title: optionalString(row, 'name') || book.title,
        author: optionalString(row, 'author') ?? book.author,
        coverUrl: optionalString(row, 'coverUrl') ?? book.coverUrl,
        intro: optionalString(row, 'intro') ?? book.intro,
        kind: optionalString(row, 'kind') ?? book.kind,
        latestChapterTitle: optionalString(row, 'latestChapterTitle') ?? book.latestChapterTitle,
        acquisition: facts } : { ...book };
      if (book.sourceId !== 'local' && !enabledSources.has(book.sourceId)) continue;
      refreshed.push(projected); seen.add(key);
      if (book.sourceId === 'local') continue;
      const component = identities.groupFor(book.sourceId, book.bookId) ??
        identities.groupForAlias(this.bookIdentities.aliasKey(book.title, book.author)) ?? key;
      const first = admittedGroups.get(component);
      if (first !== undefined) {
        projected.groupKey = first.groupKey;
      } else {
        // Cache membership is canonical; card identity is navigation-owned.
        // Retain the earliest admitted card when two aliases join, and avoid
        // re-merging separate canonical books with the same old display key.
        let groupKey = book.groupKey ?? this.bookIdentities.aliasKey(book.title, book.author);
        const owner = groupKeyOwners.get(groupKey);
        if (owner !== undefined && owner !== component) groupKey = JSON.stringify(['book', book.sourceId, book.bookId]);
        projected.groupKey = groupKey;
        groupKeyOwners.set(groupKey, component);
        admittedGroups.set(component, projected);
      }
    }
    // A source discovered from another page joins only a book already admitted
    // to this query. Unrelated cached books never become search results.
    for (const row of byKey.values()) {
      if (++processed % 32 === 0) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      const sourceId = optionalString(row, 'origin');
      const bookId = optionalString(row, 'bookUrl');
      const title = optionalString(row, 'name');
      if (sourceId === undefined || bookId === undefined || title === undefined) continue;
      const key = JSON.stringify([sourceId, bookId]);
      if (seen.has(key)) continue;
      const source = enabledSources.get(sourceId);
      if (source === undefined || !readerSourceCategoryIsText(source.category)) continue;
      const facts = row['acquisition'] as JsonObject | undefined;
      const author = optionalString(row, 'author') ?? '';
      const component = identities.groupFor(sourceId, bookId);
      const group = component === undefined ? undefined : admittedGroups.get(component);
      if (group === undefined) continue;
      const variables = optionalString(row, 'variable');
      let decodedVariables: SearchBookVariable[] = [];
      try { if (variables !== undefined) decodedVariables = decodeBookSearchVariables(JSON.parse(variables)); } catch (_error) { /* Legacy invalid continuation must not poison other sources. */ }
      refreshed.push({ sourceId, sourceName: source.name, bookSourceUrl: this.sourceBookUrl(source),
        bookId, detailUrl: bookId, title, author, sourceRuleVersion: facts === undefined ? '' : optionalString(facts, 'sourceVersion') ?? '',
        searchRequestId: group.searchRequestId, groupKey: group.groupKey, category: source.category,
        coverUrl: optionalString(row, 'coverUrl'), intro: optionalString(row, 'intro'), kind: optionalString(row, 'kind'),
        latestChapterTitle: optionalString(row, 'latestChapterTitle'), acquisition: facts, variables: decodedVariables });
      seen.add(key);
    }
    return refreshed;
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
  const decoded: SearchBook = {
    sourceId: source.sourceId,
    sourceName: source.name,
    bookSourceUrl: identity.bookSourceUrl,
    bookId,
    detailUrl: bookId,
    searchRequestId: identity.searchRequestId,
    sourceRuleVersion: identity.sourceRuleVersion,
    category: source.category ?? 'novel',
    groupKey: `${requiredNonBlankString(book, 'title').trim().replace(/\s+/g, ' ').toLocaleLowerCase()}\u0000${(optionalString(book, 'author') ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`,
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
