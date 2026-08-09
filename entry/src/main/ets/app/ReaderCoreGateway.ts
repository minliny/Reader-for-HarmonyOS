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

export type ShelfBookUpsert = {
  sourceId: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
};

export type BookshelfAddReceipt = {
  sourceId: string;
  bookId: string;
  created: boolean;
  addedAt: number;
};

type BookshelfListParams = {
  hasReadingProgress?: boolean;
  sortBy?: 'manual' | 'addedAt' | 'lastReadAt' | 'title' | 'author';
  sortDirection?: 'ascending' | 'descending';
  limit?: number;
};

export type BookshelfRemoveTarget = {
  sourceId: string;
  bookId: string;
};

export type BookshelfRemoveBatchReceipt = {
  requestedCount: number;
  uniqueCount: number;
  removedTargets: BookshelfRemoveTarget[];
  missingTargets: BookshelfRemoveTarget[];
  duplicateTargets: BookshelfRemoveTarget[];
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

  /** Upserts one local or remote book through Core's composite shelf key. */
  async upsertBook(book: ShelfBookUpsert): Promise<BookshelfAddReceipt> {
    this.assertNonBlankString(book.sourceId, 'sourceId');
    this.assertNonBlankString(book.bookId, 'bookId');
    this.assertNonBlankString(book.title, 'title');
    if (typeof book.author !== 'string') {
      throw new Error('bookshelf.add requires an author string');
    }
    const params: JsonObject = {
      sourceId: book.sourceId,
      bookId: book.bookId,
      title: book.title,
      author: book.author,
    };
    if (book.coverUrl !== undefined) params['coverUrl'] = book.coverUrl;
    if (book.intro !== undefined) params['intro'] = book.intro;
    if (book.kind !== undefined) params['kind'] = book.kind;
    if (book.lastChapter !== undefined) params['lastChapter'] = book.lastChapter;
    const result = await this.runtimeOwner.request('bookshelf.add', params);
    const sourceId = this.requiredString(result.data, 'sourceId');
    const bookId = this.requiredString(result.data, 'bookId');
    const created = result.data['created'];
    const addedAt = this.requiredNumber(result.data, 'addedAt');
    if (sourceId !== book.sourceId || bookId !== book.bookId || typeof created !== 'boolean') {
      throw new Error('bookshelf.add returned an invalid composite identity');
    }
    return { sourceId, bookId, created, addedAt };
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

  /** Core deletes local materialization first; Host releases the EPUB second. */
  async removeBook(sourceId: string, bookId: string): Promise<boolean> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request('bookshelf.remove', { sourceId, bookId });
    const removed = result.data['removed'];
    if (typeof removed !== 'boolean') {
      throw new Error('bookshelf.remove returned invalid data');
    }
    if (sourceId === 'local') {
      // Run for both removed and idempotent-missing receipts so a repeated
      // delete can finish an earlier interrupted Host file cleanup.
      await this.runtimeOwner.releaseLocalBookAsset(bookId);
    }
    return removed;
  }

  async removeBooks(targets: BookshelfRemoveTarget[]): Promise<BookshelfRemoveBatchReceipt> {
    if (targets.length === 0) {
      throw new Error('bookshelf.removeBatch requires at least one target');
    }
    const encoded: JsonObject[] = [];
    for (const target of targets) {
      this.assertNonBlankString(target.sourceId, 'sourceId');
      this.assertNonBlankString(target.bookId, 'bookId');
      encoded.push({ sourceId: target.sourceId, bookId: target.bookId });
    }
    const result = await this.runtimeOwner.request('bookshelf.removeBatch', { targets: encoded });
    const receipt: BookshelfRemoveBatchReceipt = {
      requestedCount: this.requiredNonNegativeInteger(result.data, 'requestedCount', 'bookshelf.removeBatch'),
      uniqueCount: this.requiredNonNegativeInteger(result.data, 'uniqueCount', 'bookshelf.removeBatch'),
      removedTargets: this.decodeRemoveTargets(result.data['removedTargets']),
      missingTargets: this.decodeRemoveTargets(result.data['missingTargets']),
      duplicateTargets: this.decodeRemoveTargets(result.data['duplicateTargets']),
    };
    const released: string[] = [];
    for (const target of targets) {
      if (target.sourceId === 'local' && released.indexOf(target.bookId) < 0) {
        released.push(target.bookId);
        await this.runtimeOwner.releaseLocalBookAsset(target.bookId);
      }
    }
    return receipt;
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

  private requiredNonNegativeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private decodeRemoveTargets(value: unknown): BookshelfRemoveTarget[] {
    if (!Array.isArray(value)) {
      throw new Error('bookshelf.removeBatch returned invalid targets');
    }
    const targets: BookshelfRemoveTarget[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('bookshelf.removeBatch returned an invalid target');
      }
      const target = raw as JsonObject;
      targets.push({
        sourceId: this.requiredString(target, 'sourceId'),
        bookId: this.requiredString(target, 'bookId'),
      });
    }
    return targets;
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
