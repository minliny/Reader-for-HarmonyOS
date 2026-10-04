import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { isReaderCoreTransactionPendingError } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';

export type ShelfBook = {
  contentKind?: 'text' | 'manga' | 'audio';
  sourceId: string;
  /** Core projects the existing durable source registry, independent of source.list. */
  sourceName?: string;
  bookId: string;
  title: string;
  author: string;
  /** Core-owned book kind. Local imports use values such as `TXT` / `EPUB`. */
  kind?: string;
  coverUrl?: string;
  intro?: string;
  lastChapter?: string;
  addedAt: number;
  lastReadAt?: number;
  group?: string;
  sortIndex?: number;
  unreadCount?: number;
  lastCheckAt?: number;
  currentChapterTitle?: string;
  currentChapterIndex?: number;
  chapterCount?: number;
  /** Whole-book progress in basis points, 0..10000. */
  readProgress?: number;
  readingPosition?: ShelfReadingPosition;
};

export type ShelfReadingPosition = {
  chapterIndex: number;
  chapterOffset: number;
  updatedAt: number;
  locationRevision?: string;
  bodyVersion?: string;
  processingVersion?: string;
};

export type BookshelfState = {
  books: ShelfBook[];
  total: number;
  unfilteredTotal?: number;
  unfilteredOnlineTotal?: number;
  projectionRevision?: string;
  changed?: boolean;
  offset?: number;
  anchorFound?: boolean;
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

export type BookshelfListParams = {
  anchor?: BookshelfRemoveTarget;
  pageProjection?: boolean;
  membershipOnly?: boolean;
  projectionRevision?: string;
  readingState?: string;
  sourceKind?: string;
  contentKind?: string;
  offset?: number;
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

/** Actual Core dispatch/ACK observation, before any independent Host cleanup. */
export interface BookshelfRemovalObservation<T> {
  dispatched: () => void;
  confirmed: (value: T) => void;
  rejectedBeforeExecution: () => void;
}

/**
 * The page-facing boundary for this slice. It translates the Core protocol to
 * page data and intentionally owns all JSON validation outside ArkUI pages.
 */
export class ReaderCoreGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadBookshelf(params: BookshelfListParams = {}, isCurrent?: () => boolean, background: boolean = false): Promise<BookshelfState> {
    if (isCurrent?.() === false) throw new Error('BOOKSHELF_READ_CANCELLED');
    if (params.contentKind !== undefined && params.contentKind !== 'all' &&
      this.runtimeOwner.supportsCoreCapability?.('bookshelf.contentKindFilter.v1') !== true)
      throw new Error('漫画类型筛选需要配套的 Core 版本，请更新应用');
    if (params.contentKind === 'all') delete params.contentKind;
    const options = { shouldCancel: (): boolean => isCurrent?.() === false };
    const result = background ? await this.runtimeOwner.bookAcquisitions().request('bookshelf.list', params, options, 'background') :
      await this.runtimeOwner.request('bookshelf.list', params, options);
    if (isCurrent?.() === false) throw new Error('BOOKSHELF_READ_CANCELLED');
    const rawBooks = result.data['books'];
    const total = result.data['total'];
    if (!Array.isArray(rawBooks) || typeof total !== 'number' || !Number.isInteger(total) || total < 0) {
      throw new Error('bookshelf.list returned invalid data');
    }
    const books: ShelfBook[] = [];
    for (const rawBook of rawBooks) {
      books.push(this.decodeShelfBook(rawBook));
    }
    const projectionRevision = result.data['projectionRevision'];
    const changed = result.data['changed'];
    const unfilteredTotal = result.data['unfilteredTotal'];
    const unfilteredOnlineTotal = result.data['unfilteredOnlineTotal'];
    if (params.pageProjection === true && (typeof projectionRevision !== 'string' || projectionRevision.length === 0 ||
      typeof changed !== 'boolean' || typeof unfilteredTotal !== 'number' || !Number.isSafeInteger(unfilteredTotal) || unfilteredTotal < total || typeof unfilteredOnlineTotal !== 'number' || !Number.isSafeInteger(unfilteredOnlineTotal) ||
      unfilteredOnlineTotal < 0 || unfilteredOnlineTotal > unfilteredTotal || books.length > (params.limit ?? 0) || (changed && books.length !== 0)))
      throw new Error('bookshelf.list returned invalid page projection');
    const offset = result.data['offset'];
    const anchorFound = result.data['anchorFound'];
    if (params.pageProjection === true && this.supportsShelfAnchorPages() &&
      (typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0 ||
       (!changed && params.anchor !== undefined && typeof anchorFound !== 'boolean') ||
       (!changed && params.anchor === undefined && offset !== (params.offset ?? 0))))
      throw new Error('bookshelf.list returned invalid page offset');
    return { books, total, offset: typeof offset === 'number' ? offset : params.offset,
      anchorFound: typeof anchorFound === 'boolean' ? anchorFound : undefined, unfilteredOnlineTotal: typeof unfilteredOnlineTotal === 'number' ? unfilteredOnlineTotal : undefined, unfilteredTotal: typeof unfilteredTotal === 'number' ? unfilteredTotal : undefined,
      projectionRevision: typeof projectionRevision === 'string' ? projectionRevision : undefined,
      changed: typeof changed === 'boolean' ? changed : undefined };

  }

  supportsShelfAnchorPages(): boolean {
    return this.runtimeOwner.supportsCoreCapability?.('bookshelf.anchorPage.v1') === true;
  }

  supportsShelfPages(): boolean {
    return this.runtimeOwner.supportsCoreCapability?.('bookshelf.pageProjection.v1') === true;
  }

  async loadContinueReading(isCurrent?: () => boolean): Promise<ShelfBook | undefined> {
    const state = await this.loadBookshelf({
      hasReadingProgress: true,
      sortBy: 'lastReadAt',
      sortDirection: 'descending',
      limit: 1,
    }, isCurrent);
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
    const result = book.sourceId === 'local' ? await this.runtimeOwner.request('bookshelf.add', params) :
      await this.runtimeOwner.bookAcquisitions().addReadableBook(params);
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
  async loadShelfBook(sourceId: string, bookId: string, current?: () => boolean): Promise<ShelfBook | undefined> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    if (current !== undefined && !current()) throw new Error('BOOKSHELF_READ_RETIRED');
    const result = await this.runtimeOwner.request('bookshelf.get', { sourceId, bookId },
      current === undefined ? undefined : { shouldCancel: (): boolean => !current() });
    if (current !== undefined && !current()) throw new Error('BOOKSHELF_READ_RETIRED');
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
  async removeBook(sourceId: string, bookId: string, observation?: BookshelfRemovalObservation<boolean>): Promise<boolean> {
    this.assertNonBlankString(sourceId, 'sourceId');
    this.assertNonBlankString(bookId, 'bookId');
    observation?.dispatched();
    let result: ReaderCoreResultEvent;
    try {
      result = await this.runtimeOwner.request('bookshelf.remove', { sourceId, bookId });
    } catch (error) {
      if (isReaderCoreTransactionPendingError(error)) observation?.rejectedBeforeExecution();
      throw error;
    }
    const removed = this.qualifyBookRemoval(result.data);
    observation?.confirmed(removed);
    if (sourceId === 'local') {
      // Run for both removed and idempotent-missing receipts so a repeated
      // delete can finish an earlier interrupted Host file cleanup.
      await this.runtimeOwner.releaseLocalBookAsset(bookId);
    }
    return removed;
  }

  async removeBooks(targets: BookshelfRemoveTarget[], observation?: BookshelfRemovalObservation<BookshelfRemoveBatchReceipt>): Promise<BookshelfRemoveBatchReceipt> {
    if (targets.length === 0) {
      throw new Error('bookshelf.removeBatch requires at least one target');
    }
    const encoded: JsonObject[] = [];
    for (const target of targets) {
      this.assertNonBlankString(target.sourceId, 'sourceId');
      this.assertNonBlankString(target.bookId, 'bookId');
      encoded.push({ sourceId: target.sourceId, bookId: target.bookId });
    }
    observation?.dispatched();
    let result: ReaderCoreResultEvent;
    try {
      result = await this.runtimeOwner.request('bookshelf.removeBatch', { targets: encoded });
    } catch (error) {
      if (isReaderCoreTransactionPendingError(error)) observation?.rejectedBeforeExecution();
      throw error;
    }
    const receipt = this.qualifyBookBatchRemoval(targets, result.data);
    observation?.confirmed(receipt);
    const released = new Set<string>();
    for (const target of targets) {
      if (target.sourceId === 'local') {
        released.add(target.bookId);
      }
    }
    await this.releaseLocalBookAssets(Array.from(released));
    return receipt;
  }

  /** The original Core ACK decoders are shared by legacy calls and exact
   * durable receipts. No shelf membership snapshot can substitute for them. */
  qualifyBookRemoval(data: JsonObject): boolean {
    const removed = data['removed'];
    if (typeof removed !== 'boolean') throw new Error('bookshelf.remove returned invalid data');
    return removed;
  }

  qualifyBookBatchRemoval(targets: BookshelfRemoveTarget[], data: JsonObject): BookshelfRemoveBatchReceipt {
    const receipt: BookshelfRemoveBatchReceipt = {
      requestedCount: this.requiredNonNegativeInteger(data, 'requestedCount', 'bookshelf.removeBatch'),
      uniqueCount: this.requiredNonNegativeInteger(data, 'uniqueCount', 'bookshelf.removeBatch'),
      removedTargets: this.decodeRemoveTargets(data['removedTargets']),
      missingTargets: this.decodeRemoveTargets(data['missingTargets']),
      duplicateTargets: this.decodeRemoveTargets(data['duplicateTargets']),
    };
    // An unrelated/partial payload is not an ACK for this requested set.
    const identity = (target: BookshelfRemoveTarget): string => JSON.stringify([target.sourceId, target.bookId]);
    const expected = new Set(targets.map(identity));
    const seenRequested: Set<string> = new Set();
    const expectedDuplicates: string[] = [];
    for (const target of targets) {
      const key = identity(target);
      if (seenRequested.has(key)) expectedDuplicates.push(key);
      else seenRequested.add(key);
    }
    const acknowledged = receipt.removedTargets.concat(receipt.missingTargets).map(identity);
    const acknowledgedSet = new Set(acknowledged);
    if (receipt.requestedCount !== targets.length || receipt.uniqueCount !== expected.size ||
      acknowledged.length !== expected.size || acknowledgedSet.size !== expected.size ||
      acknowledged.some((key: string): boolean => !expected.has(key)) ||
      receipt.duplicateTargets.length !== targets.length - expected.size ||
      receipt.duplicateTargets.some((target: BookshelfRemoveTarget): boolean => !expected.has(identity(target))) ||
      JSON.stringify(receipt.duplicateTargets.map(identity).sort()) !== JSON.stringify(expectedDuplicates.sort())) {
      throw new Error('bookshelf.removeBatch returned a mismatched receipt');
    }
    return receipt;
  }

  async finishBookRemoval(targets: BookshelfRemoveTarget[], current: () => boolean): Promise<void> {
    const local = new Set<string>();
    for (const target of targets) {
      this.assertNonBlankString(target.sourceId, 'sourceId'); this.assertNonBlankString(target.bookId, 'bookId');
      if (target.sourceId === 'local') local.add(target.bookId);
    }
    await this.releaseLocalBookAssets(Array.from(local), current);
  }

  private async releaseLocalBookAssets(bookIds: string[], current?: () => boolean): Promise<void> {
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextIndex < bookIds.length) {
        if (current !== undefined && !current()) throw new Error('BOOKSHELF_REMOVAL_CLEANUP_RETIRED');
        const index = nextIndex;
        nextIndex += 1;
        await this.runtimeOwner.releaseLocalBookAsset(bookIds[index]);
      }
    };
    const workers: Array<Promise<void>> = [];
    const count = Math.min(2, bookIds.length);
    for (let index = 0; index < count; index += 1) {
      workers.push(worker());
    }
    await Promise.all(workers);
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
      sortIndex: this.requiredNumber(book, 'sortIndex'),
      unreadCount: this.optionalNonNegativeInteger(book, 'unreadCount', 'bookshelf.list') ?? 0,
      chapterCount: this.optionalNonNegativeInteger(book, 'chapterCount', 'bookshelf.list') ?? 0,
    };
    const coverUrl = this.optionalString(book, 'coverUrl');
    const contentKind = this.optionalString(book, 'contentKind');
    if (contentKind !== undefined) {
      if (contentKind !== 'text' && contentKind !== 'manga' && contentKind !== 'audio') throw new Error('invalid shelf contentKind');
      decoded.contentKind = contentKind;
    }
    const intro = this.optionalString(book, 'intro');
    const sourceName = this.optionalString(book, 'sourceName');
    const kind = this.optionalString(book, 'kind');
    const lastChapter = this.optionalString(book, 'lastChapter');
    const lastReadAt = this.optionalNumber(book, 'lastReadAt');
    const group = this.optionalString(book, 'group');
    const lastCheckAt = this.optionalNumber(book, 'lastCheckAt');
    const currentChapterTitle = this.optionalString(book, 'currentChapterTitle');
    const currentChapterIndex = this.optionalNumber(book, 'currentChapterIndex');
    const readProgress = this.optionalNumber(book, 'readProgress');
    const readingPosition = this.decodeShelfReadingPosition(book['readingPosition']);
    if (readingPosition !== undefined) decoded.readingPosition = readingPosition;
    if (coverUrl !== undefined) {
      decoded.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      decoded.intro = intro;
    }
    if (sourceName !== undefined) {
      const name = sourceName.trim();
      decoded.sourceName = name.length > 0 && name !== decoded.sourceId.trim() &&
        !/^[a-z][a-z0-9+.-]*:/i.test(name) && !/^www\./i.test(name)
        ? name : '书源名称暂不可用';
    }
    if (kind !== undefined) {
      decoded.kind = kind;
    }
    if (lastChapter !== undefined) {
      decoded.lastChapter = lastChapter;
    }
    if (lastReadAt !== undefined) {
      decoded.lastReadAt = lastReadAt;
    }
    if (group !== undefined) {
      decoded.group = group;
    }
    if (lastCheckAt !== undefined) {
      decoded.lastCheckAt = lastCheckAt;
    }
    if (currentChapterTitle !== undefined) {
      decoded.currentChapterTitle = currentChapterTitle;
    }
    if (currentChapterIndex !== undefined) {
      decoded.currentChapterIndex = currentChapterIndex;
    }
    if (readProgress !== undefined) {
      decoded.readProgress = readProgress;
    }
    return decoded;
  }

  private decodeShelfReadingPosition(value: unknown): ShelfReadingPosition | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    // A malformed optional projection is a preparation miss, never a failure
    // to load an otherwise valid bookshelf. Core progress remains authoritative.
    try {
      const position = value as JsonObject;
      const chapterIndex = this.requiredNonNegativeInteger(position, 'chapterIndex', 'bookshelf.list');
      const chapterOffset = this.requiredNonNegativeInteger(position, 'chapterOffset', 'bookshelf.list');
      const updatedAt = this.requiredNonNegativeInteger(position, 'updatedAt', 'bookshelf.list');
      const bodyVersion = this.optionalString(position, 'bodyVersion');
      const processingVersion = this.optionalString(position, 'processingVersion');
      if ((bodyVersion === undefined) !== (processingVersion === undefined) ||
        bodyVersion?.trim().length === 0 || processingVersion?.trim().length === 0) return undefined;
      return { chapterIndex, chapterOffset, updatedAt,
        locationRevision: this.optionalString(position, 'locationRevision'), bodyVersion, processingVersion };
    } catch (_) {
      return undefined;
    }
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

  private optionalNonNegativeInteger(
    value: JsonObject,
    key: string,
    context: string,
  ): number | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
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
