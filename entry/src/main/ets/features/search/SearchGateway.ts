import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

/**
 * A single `book.search` result. Reader Core serializes the domain `Book`
 * shape (`bookId`, `title`, `lastChapter`); the source identity is supplied by
 * the request that produced it, not guessed from a stale search cache.
 */
export type SearchBook = {
  sourceId: string;
  sourceName: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  latestChapterTitle?: string;
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

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
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
  ): Promise<SearchOutcome> {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      return { ok: false, error: 'empty keyword' };
    }
    if (typeof source.sourceId !== 'string' || source.sourceId.length === 0) {
      return { ok: false, error: 'empty sourceId' };
    }
    try {
      const result = await this.runtimeOwner.request('book.search', {
        sourceId: source.sourceId,
        keyword: keyword,
      }, this.requestOptions(isCurrent));
      const data = result.data;
      const returnedSourceId = this.requiredString(data, 'sourceId');
      if (returnedSourceId !== source.sourceId) {
        return { ok: false, error: 'book.search returned a mismatched sourceId' };
      }
      const rawBooks = data['books'];
      if (!Array.isArray(rawBooks)) {
        return { ok: false, error: 'book.search returned invalid books' };
      }
      const books: SearchBook[] = [];
      for (const raw of rawBooks) {
        books.push(this.decodeBookSearchResult(raw, source));
      }
      return { ok: true, results: books };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      return { ok: false, error: message };
    }
  }

  private decodeBookSearchResult(value: unknown, source: SearchSource): SearchBook {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('book.search returned a non-object book');
    }
    const book = value as JsonObject;
    const decoded: SearchBook = {
      sourceId: source.sourceId,
      sourceName: source.name,
      // A blank remote identity or title would create a non-actionable, empty
      // Figma card. Core's live book.search contract supplies both; reject a
      // malformed response as a source failure instead of rendering a fake
      // result.
      bookId: this.requiredNonBlankString(book, 'bookId'),
      title: this.requiredNonBlankString(book, 'title'),
      author: this.optionalString(book, 'author') ?? '',
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const intro = this.optionalString(book, 'intro');
    const latestChapterTitle = this.optionalString(book, 'lastChapter');
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (latestChapterTitle !== undefined) {
      decoded.latestChapterTitle = latestChapterTitle;
    }
    return decoded;
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
      const sourceId = this.requiredString(source, 'sourceId');
      const name = this.requiredString(source, 'name');
      const enabled = this.requiredBoolean(source, 'enabled');
      sources.push({ sourceId, name, enabled });
    }
    return sources;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`search protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredNonBlankString(value: JsonObject, key: string): string {
    const candidate = this.requiredString(value, key);
    if (candidate.trim().length === 0) {
      throw new Error(`search protocol returned blank ${key}`);
    }
    return candidate;
  }

  private requiredBoolean(value: JsonObject, key: string): boolean {
    const candidate = value[key];
    if (typeof candidate !== 'boolean') {
      throw new Error(`search protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`search protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private requestOptions(isCurrent: SearchRequestGuard | undefined): RequestOptions {
    return isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
  }
}
