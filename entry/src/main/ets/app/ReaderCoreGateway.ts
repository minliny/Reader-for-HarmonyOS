import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';

export type ShelfBook = {
  sourceId: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  lastChapter?: string;
  addedAt: number;
  lastReadAt?: number;
};

export type BookshelfState = {
  books: ShelfBook[];
  total: number;
};

type BookshelfListParams = {
  hasReadingProgress?: boolean;
  sortBy?: 'manual' | 'addedAt' | 'lastReadAt' | 'title' | 'author';
  sortDirection?: 'ascending' | 'descending';
  limit?: number;
};

/**
 * The page-facing boundary for this slice. It translates the Core protocol to
 * page data and intentionally owns all JSON validation outside ArkUI pages.
 */
export class ReaderCoreGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadBookshelf(params: BookshelfListParams = {}): Promise<BookshelfState> {
    const result = await this.runtimeOwner.request('bookshelf.list', params);
    const rawBooks = result.data['books'];
    const total = result.data['total'];
    if (!Array.isArray(rawBooks) || typeof total !== 'number' || !Number.isInteger(total) || total < 0) {
      throw new Error('bookshelf.list returned invalid data');
    }
    const books: ShelfBook[] = [];
    for (const rawBook of rawBooks) {
      books.push(this.decodeShelfBook(rawBook));
    }
    return { books, total };
  }

  async loadContinueReading(): Promise<ShelfBook | undefined> {
    const state = await this.loadBookshelf({
      hasReadingProgress: true,
      sortBy: 'lastReadAt',
      sortDirection: 'descending',
      limit: 1,
    });
    return state.books.length === 0 ? undefined : state.books[0];
  }

  /**
   * Reads one already-materialized shelf record by its Core composite key.
   *
   * The Bookshelf card only carries a snapshot.  Detail routes re-read this
   * DTO so they never rely on a hand-copied or UI-owned book model.  Local
   * imports use `sourceId: 'local'`, but the validation deliberately keeps
   * the Core composite identity intact instead of creating a second local
   * lookup protocol in ArkUI.
   */
  async loadShelfBook(sourceId: string, bookId: string): Promise<ShelfBook | undefined> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request('bookshelf.get', { sourceId, bookId });
    const rawBook = result.data['book'];
    if (rawBook === null) {
      return undefined;
    }
    const book = this.decodeShelfBook(rawBook);
    if (book.sourceId !== sourceId || book.bookId !== bookId) {
      throw new Error('bookshelf.get returned a mismatched composite key');
    }
    return book;
  }

  private decodeShelfBook(value: unknown): ShelfBook {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('bookshelf.list returned a non-object book');
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
    if (typeof candidate !== 'string') {
      throw new Error(`bookshelf.list returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`bookshelf.list returned invalid ${key}`);
    }
    return candidate;
  }

  private requiredNumber(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error(`bookshelf.list returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalNumber(value: JsonObject, key: string): number | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
      throw new Error(`bookshelf.list returned invalid ${key}`);
    }
    return candidate;
  }

  private assertNonBlankString(value: string, key: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`bookshelf.get requires a non-blank ${key}`);
    }
  }
}
