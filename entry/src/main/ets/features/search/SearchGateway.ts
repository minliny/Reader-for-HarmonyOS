import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

/**
 * A single search result book, decoded from the Core `SearchBookData` wire
 * shape. The page consumes only the fields the Figma Search ResultCard draws.
 */
export type SearchBook = {
  bookUrl: string;
  origin: string;
  originName: string;
  name: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  latestChapterTitle?: string;
  wordCount?: string;
};

export type SearchHistory = {
  keywords: string[];
  count: number;
};

export type SearchSource = {
  sourceId: string;
  name: string;
};

export type SearchOutcome =
  | { ok: true; results: SearchBook[] }
  | { ok: false; error: string };

/**
 * Feature-local gateway for the Search page. It owns the Core protocol
 * boundary for `search.history.*` and `search-book.*` and validates every
 * JSON envelope before the page sees it. It never creates a runtime.
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

  async loadSearchBooks(): Promise<SearchBook[]> {
    const result = await this.runtimeOwner.request('search-book.list', {});
    const rawBooks = result.data['books'];
    if (!Array.isArray(rawBooks)) {
      throw new Error('search-book.list returned invalid data');
    }
    const books: SearchBook[] = [];
    for (const raw of rawBooks) {
      books.push(this.decodeSearchBook(raw));
    }
    return books;
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
   * `book.search` is a real Core call that needs `http.execute` for live
   * network search across sources. The current Host only registers
   * `persistence.get/put`, so the call will fail unless the result was
   * already cached. On failure we fall back to `search-book.list` and
   * surface an explicit error so the UI shows the error state rather
   * than silently masking the host gap.
   */
  async searchBySource(sourceId: string, keyword: string): Promise<SearchOutcome> {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      return { ok: false, error: 'empty keyword' };
    }
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      return { ok: false, error: 'empty sourceId' };
    }
    try {
      const result = await this.runtimeOwner.request('book.search', {
        sourceId: sourceId,
        keyword: keyword,
      });
      const data = result.data;
      const rawBooks = data['books'];
      if (!Array.isArray(rawBooks)) {
        return { ok: true, results: [] };
      }
      const books: SearchBook[] = [];
      for (const raw of rawBooks) {
        const decoded = this.decodeBookSearchResult(raw, keyword);
        if (decoded !== undefined) {
          books.push(decoded);
        }
      }
      return { ok: true, results: books };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      return { ok: false, error: message };
    }
  }

  private decodeBookSearchResult(value: unknown, keyword: string): SearchBook | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined;
    }
    const book = value as JsonObject;
    const name = this.optionalString(book, 'name');
    if (name === undefined) {
      return undefined;
    }
    const decoded: SearchBook = {
      bookUrl: this.optionalString(book, 'bookUrl') ?? keyword,
      origin: this.optionalString(book, 'origin') ?? '',
      originName: this.optionalString(book, 'originName') ?? '',
      name: name,
      author: this.optionalString(book, 'author') ?? '',
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const intro = this.optionalString(book, 'intro');
    const latestChapterTitle = this.optionalString(book, 'latestChapterTitle');
    const wordCount = this.optionalString(book, 'wordCount');
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (latestChapterTitle !== undefined) {
      decoded.latestChapterTitle = latestChapterTitle;
    }
    if (wordCount !== undefined) {
      decoded.wordCount = wordCount;
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
      const name = this.optionalString(source, 'name');
      const sourceId = this.optionalString(source, 'sourceId');
      const enabled = source['enabled'];
      if (name === undefined || sourceId === undefined || enabled === true) {
        if (name !== undefined && sourceId !== undefined) {
          sources.push({ sourceId, name });
        }
      }
    }
    return sources;
  }

  private decodeSearchBook(value: unknown): SearchBook {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('search-book.list returned a non-object book');
    }
    const book = value as JsonObject;
    const decoded: SearchBook = {
      bookUrl: this.requiredString(book, 'bookUrl'),
      origin: this.optionalString(book, 'origin') ?? '',
      originName: this.optionalString(book, 'originName') ?? '',
      name: this.requiredString(book, 'name'),
      author: this.optionalString(book, 'author') ?? '',
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const intro = this.optionalString(book, 'intro');
    const latestChapterTitle = this.optionalString(book, 'latestChapterTitle');
    const wordCount = this.optionalString(book, 'wordCount');
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (latestChapterTitle !== undefined) {
      decoded.latestChapterTitle = latestChapterTitle;
    }
    if (wordCount !== undefined) {
      decoded.wordCount = wordCount;
    }
    return decoded;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
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
}