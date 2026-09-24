import { appendExpectedPositionVersions, decodeRemotePositionScope, encodeRemotePositionScope, type RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { RemoteReadingIdentity } from './RemoteReadingContract';

/**
 * Page-facing, materialized local-book TOC entry. The Core-owned local URL
 * and rule variables are deliberately not exposed because selecting a local
 * chapter is solely by its stable zero-based index.
 */
export type LocalReadingTocEntry = {
  index: number;
  title: string;
  /** 1-based navigation depth when the local book has a structured TOC. */
  level?: number;
  downloadState: LocalReadingDownloadState;
  /** Remote volume headings retain their index but cannot navigate/download/bookmark. */
  navigable?: boolean;
  // `undefined` means the bookmark projection has not been admitted yet;
  // an empty array is the Core-confirmed "no bookmarks" result.
  bookmarks?: LocalReadingBookmark[];
};

export type LocalReadingDownloadState =
  'unknown' | 'missing' | 'queued' | 'inProgress' | 'cached' | 'completed' | 'failed' | 'cancelled';

export type LocalReadingBookmark = {
  positionScope?: RemoteReadingPositionScope;
  time: number;
  chapterIndex: number;
  chapterOffset: number;
  chapterTitle: string;
  content: string;
  /** Original text, separate from the user's note in content. */
  bookText?: string;
};

export type LocalReadingChapterStartBookmarkInput = {
  positionScope?: RemoteReadingPositionScope;
  bookName: string;
  bookAuthor: string;
  chapterIndex: number;
  chapterTitle: string;
};

export type LocalReadingPositionBookmarkInput = LocalReadingChapterStartBookmarkInput & {
  chapterOffset: number;
  bookText?: string;
};

export type LocalReadingToc = {
  bookId: string;
  revision?: string;
  entries: LocalReadingTocEntry[];
};

/**
 * The actual body returned from Core materialized chapter storage. A page can
 * lay this out, but it never receives the Core result envelope.
 */
export type LocalReadingChapter = {
  bodyVersion?: string;
  processingVersion?: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  content: string;
  blocks?: unknown[];
};

/**
 * One half-open Unicode-scalar interval in Core's exact processed chapter
 * output. These are content metrics, not ArkUI layout/page measurements.
 */
export type LocalReadingChapterContentMetric = {
  chapterIndex: number;
  scalarLength: number;
  cumulativeStart: number;
  cumulativeEnd: number;
};

/** Core-owned whole-book scalar index for a fully materialized local book. */
export type LocalReadingContentMetrics = {
  bookId: string;
  totalScalarLength: number;
  chapters: LocalReadingChapterContentMetric[];
};

/**
 * The Core-owned current reading position for one local book. `chapterOffset`
 * is deliberately preserved as the Core protocol name; the reading surface
 * supplies its Unicode-scalar measurement to this field rather than this
 * gateway inventing a second position model.
 */
export type LocalReadingProgress = {
  bodyVersion?: string;
  processingVersion?: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  updatedAt: number;
  locationRevision?: string;
};

export type LocalReadingProgressState =
  | { kind: 'missing'; progressRevision?: string }
  | { kind: 'restored'; progress: LocalReadingProgress;
      progressRevision?: string;
      /** In-process displayed intent only; locationRevision/updatedAt are not a durable receipt. */
      presentationPending?: boolean };

export type LocalReadingProgressUpdate = {
  expectedProgressRevision?: string;
  expectedBodyVersion?: string;
  expectedProcessingVersion?: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision?: string;
};

/** Host-measured layout facts accepted by Core's canonical location resolver. */
export type LocalReadingLayout = {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight?: number;
  pageIndex?: number;
  pageCount?: number;
};

/** One Unicode-scalar anchor emitted by the local pagination/measurement layer. */
export type LocalReadingAnchor = {
  bodyVersion?: string;
  processingVersion?: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
};

/** Core's layout-independent reading identity, exposed without a protocol envelope. */
export type LocalReadingResolvedLocation = {
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string;
  resolverVersion: string;
  reflow: {
    strategy: 'offsetAnchor';
    primaryAnchor: 'chapterOffset';
    fallbackAnchor: 'chapterProgress';
    layoutIndependent: true;
  };
};

export type LocalReadingAtomicResolution = {
  chapterTitle?: string;
  anchor: LocalReadingAnchor;
  layout: LocalReadingLayout;
};

const LOCAL_SOURCE_ID = 'local';

/**
 * A reader transaction supplies this guard instead of exposing NAPI request
 * identifiers to ArkUI. Once it returns false, the SDK cancels a still-pending
 * Core command before it can delay a newer chapter selection.
 */
type LocalReadingRequestGuard = () => boolean;

/**
 * The only local-reading Core boundary for ArkUI pages. Local-book import
 * materializes the book in Core storage; this gateway reads that materialized
 * state and maps it to page data without exposing Core envelopes or protocol
 * fields that the pages do not need.
 */
export class LocalReadingFlowGateway {
  /**
   * Progress is current-book, last-write-wins state in Core. The atomic Core
   * update owns resolve plus persistence; this instance tail only preserves
   * the ordering of writes within one active reading session.
   */
  // Serialization belongs to this reading session. A slow commit from a
  // closed book must never hold the next session behind a process-global tail.
  private progressCommitTail: Promise<void> = Promise.resolve();
  private readonly runtimeOwner: ReadingGatewayRuntime;

  constructor(runtimeOwner: ReadingGatewayRuntime) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadToc(bookId: string, isCurrent?: LocalReadingRequestGuard): Promise<LocalReadingToc> {
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request('local_book.toc', { bookId }, this.requestOptions(isCurrent));
    this.assertLocalSource(result.data, 'local_book.toc');
    this.assertMatchingBookId(result.data, bookId, 'local_book.toc');

    const rawToc = result.data['toc'];
    if (!Array.isArray(rawToc)) {
      throw new Error('local_book.toc returned invalid toc');
    }

    const entries: LocalReadingTocEntry[] = [];
    const seenIndices = new Set<number>();
    for (const rawEntry of rawToc) {
      const entry = this.requireObject(rawEntry, 'local_book.toc entry');
      const index = this.requireNonNegativeInteger(entry, 'index', 'local_book.toc entry');
      if (seenIndices.has(index)) {
        throw new Error('local_book.toc returned duplicate chapter index');
      }
      seenIndices.add(index);
      // Although the URL is not page state, validate the complete required
      // Core entry shape before using its title and index.
      this.requireString(entry, 'url', 'local_book.toc entry');
      const level = entry['level'] === undefined ? undefined :
        this.requireNonNegativeInteger(entry, 'level', 'local_book.toc entry');
      if (level === 0) throw new Error('local_book.toc returned invalid navigation level');
      entries.push({
        index,
        title: this.requireString(entry, 'title', 'local_book.toc entry'),
        level,
        downloadState: 'unknown',
      });
    }
    return { bookId, entries };
  }

  /**
   * Joins the Core-owned bookmark and cache/download facts onto an already
   * validated local TOC. No absence is inferred before both commands return.
   */
  async loadDirectoryProjection(
    bookId: string,
    bookName: string,
    bookAuthor: string,
    entries: LocalReadingTocEntry[],
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    this.assertNonBlankString(bookId, 'bookId');
    this.assertNonBlankString(bookName, 'bookName');
    if (typeof bookAuthor !== 'string') {
      throw new Error('bookAuthor must be a string');
    }
    const requests = await Promise.all([
      this.runtimeOwner.request('cache.book.status', {
        sourceId: LOCAL_SOURCE_ID,
        bookId,
        includeGlobalStats: false,
      }, this.requestOptions(isCurrent)),
      this.loadBookmarkProjection(bookName, bookAuthor, entries, isCurrent),
    ]);
    const cacheData = requests[0].data;
    this.assertLocalSource(cacheData, 'cache.book.status');
    this.assertMatchingBookId(cacheData, bookId, 'cache.book.status');
    const rawStatuses = cacheData['chapters'];
    if (!Array.isArray(rawStatuses)) {
      throw new Error('cache.book.status returned invalid chapters');
    }
    const stateByChapter = new Map<number, LocalReadingDownloadState>();
    for (const rawStatus of rawStatuses) {
      const status = this.requireObject(rawStatus, 'cache.book.status chapter');
      const chapterIndex = this.requireNonNegativeInteger(
        status,
        'chapterIndex',
        'cache.book.status chapter',
      );
      stateByChapter.set(
        chapterIndex,
        this.requireDownloadState(status, 'state', 'cache.book.status chapter'),
      );
    }

    const bookmarkEntries = requests[1];
    const projected: LocalReadingTocEntry[] = [];
    for (const entry of bookmarkEntries) {
      projected.push({
        index: entry.index,
        title: entry.title,
        level: entry.level,
        downloadState: stateByChapter.get(entry.index) ?? 'unknown',
        navigable: entry.navigable,
        bookmarks: entry.bookmarks,
      });
    }
    return projected;
  }

  /**
   * Joins source-independent Core bookmarks onto any validated reading TOC.
   * Existing download state is preserved because local and remote offline
   * projections have different owners.
   */
  async loadBookmarkProjection(
    bookName: string,
    bookAuthor: string,
    entries: LocalReadingTocEntry[],
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    this.assertNonBlankString(bookName, 'bookName');
    if (typeof bookAuthor !== 'string') {
      throw new Error('bookAuthor must be a string');
    }
    const result = await this.runtimeOwner.request('bookmark.list', {
      bookName,
      bookAuthor,
    }, this.requestOptions(isCurrent));
    const rawBookmarks = result.data['bookmarks'];
    if (!Array.isArray(rawBookmarks)) {
      throw new Error('bookmark.list returned invalid bookmarks');
    }
    const bookmarks: LocalReadingBookmark[] = [];
    for (const rawBookmark of rawBookmarks) {
      const bookmark = this.requireObject(rawBookmark, 'bookmark.list bookmark');
      if (this.requireString(bookmark, 'bookName', 'bookmark.list bookmark') !== bookName ||
        this.requireString(bookmark, 'bookAuthor', 'bookmark.list bookmark') !== bookAuthor) {
        throw new Error('bookmark.list returned a bookmark for a different book');
      }
      const chapterIndex = this.requireSafeInteger(bookmark, 'chapterIndex', 'bookmark.list bookmark');
      if (chapterIndex < 0) {
        continue;
      }
      const positionScope = decodeRemotePositionScope(bookmark['positionScope']);
      if (positionScope !== undefined && positionScope.chapterIndex !== chapterIndex) throw new Error('bookmark.list position scope chapter mismatch');
      bookmarks.push({
        ...(positionScope === undefined ? {} : { positionScope }),
        time: this.requireSafeInteger(bookmark, 'time', 'bookmark.list bookmark'),
        chapterIndex,
        chapterOffset: this.requireNonNegativeInteger(bookmark, 'chapterPos', 'bookmark.list bookmark'),
        chapterTitle: this.requireString(bookmark, 'chapterName', 'bookmark.list bookmark'),
        content: this.requireString(bookmark, 'content', 'bookmark.list bookmark'),
        bookText: this.requireString(bookmark, 'bookText', 'bookmark.list bookmark'),
      });
    }

    const bookmarksByChapter = new Map<number, LocalReadingBookmark[]>();
    for (const bookmark of bookmarks) {
      const grouped = bookmarksByChapter.get(bookmark.chapterIndex);
      if (grouped === undefined) {
        bookmarksByChapter.set(bookmark.chapterIndex, [bookmark]);
      } else {
        grouped.push(bookmark);
      }
    }

    const projected: LocalReadingTocEntry[] = [];
    for (const entry of entries) {
      projected.push({
        index: entry.index,
        title: entry.title,
        level: entry.level,
        downloadState: entry.downloadState,
        navigable: entry.navigable,
        bookmarks: bookmarksByChapter.get(entry.index) ?? [],
      });
    }
    return projected;
  }

  /**
   * Creates the exact chapter-start bookmark represented by an empty TOC-row
   * marker. `chapterPos: 0` is the unique Unicode-scalar anchor for the start
   * of that chapter; optional note/text fields retain Core's empty defaults.
   */
  async createChapterStartBookmark(
    input: LocalReadingChapterStartBookmarkInput,
    isCurrent?: LocalReadingRequestGuard,
    remoteIdentity?: RemoteReadingIdentity,
  ): Promise<LocalReadingBookmark> {
    const captured: LocalReadingPositionBookmarkInput = {
      bookName: input.bookName, bookAuthor: input.bookAuthor, chapterIndex: input.chapterIndex,
      chapterOffset: 0, chapterTitle: input.chapterTitle,
      positionScope: input.positionScope === undefined ? undefined : decodeRemotePositionScope(encodeRemotePositionScope(input.positionScope)),
    };
    if (remoteIdentity !== undefined && remoteIdentity.sourceId !== LOCAL_SOURCE_ID) {
      const identity: RemoteReadingIdentity = { sourceId: remoteIdentity.sourceId, bookId: remoteIdentity.bookId };
      if (captured.positionScope !== undefined && (captured.positionScope.sourceId !== identity.sourceId ||
        captured.positionScope.bookId !== identity.bookId)) throw new Error('bookmark position scope identity mismatch');
      if (captured.positionScope === undefined) captured.positionScope =
        await this.loadChapterStartPositionScope(identity, captured.chapterIndex, isCurrent);
    }
    if (isCurrent?.() === false) throw new Error('bookmark creation superseded');
    return this.createPositionBookmark(captured, isCurrent);
  }

  /** A new chapter-start anchor is always zero in the current Core body.
   * This proof is never attached to a persisted bookmark's historical offset.
   * Omit every fetch input so a cache race/miss cannot launch source HTTP.
   */
  private async loadChapterStartPositionScope(identity: RemoteReadingIdentity, chapterIndex: number,
    isCurrent?: LocalReadingRequestGuard): Promise<RemoteReadingPositionScope | undefined> {
    this.assertNonBlankString(identity.sourceId, 'sourceId');
    this.assertNonBlankString(identity.bookId, 'bookId');
    this.assertNonNegativeInteger(chapterIndex, 'chapterIndex');
    if (isCurrent?.() === false) throw new Error('bookmark creation superseded');
    const status = await this.runtimeOwner.request('cache.book.status', { sourceId: identity.sourceId, bookId: identity.bookId,
      includeGlobalStats: false, includeChapterStates: true }, this.requestOptions(isCurrent));
    if (isCurrent?.() === false) throw new Error('bookmark creation superseded');
    if (status.data['sourceId'] !== identity.sourceId || status.data['bookId'] !== identity.bookId ||
      !Array.isArray(status.data['chapters'])) throw new Error('bookmark cache status identity mismatch');
    let selected: JsonObject | undefined = undefined;
    for (const raw of status.data['chapters']) {
      const chapter = this.requireObject(raw, 'cache.book.status chapter');
      if (this.requireNonNegativeInteger(chapter, 'chapterIndex', 'cache.book.status chapter') !== chapterIndex) continue;
      if (selected !== undefined) throw new Error('duplicate bookmark cache chapter');
      selected = chapter;
    }
    if (selected === undefined) return undefined;
    const cachedBytes = this.requireNonNegativeInteger(selected, 'cachedBytes', 'cache.book.status chapter');
    if (cachedBytes === 0 && selected['state'] !== 'cached' && selected['state'] !== 'completed') return undefined;
    const result = await this.runtimeOwner.request('chapter.content', { sourceId: identity.sourceId,
      bookId: identity.bookId, chapterIndex }, this.requestOptions(isCurrent));
    if (isCurrent?.() === false) throw new Error('bookmark creation superseded');
    if (result.data['sourceId'] !== identity.sourceId || result.data['bookId'] !== identity.bookId ||
      result.data['via'] !== 'cache' || typeof result.data['content'] !== 'string') throw new Error('bookmark cached body identity mismatch');
    return decodeRemotePositionScope({ sourceId: identity.sourceId, bookId: identity.bookId, chapterIndex,
      bodyVersion: result.data['bodyVersion'], processingVersion: result.data['processingVersion'] });
  }

  /** Creates a bookmark at one exact Core Unicode-scalar reading anchor. */
  async createPositionBookmark(
    input: LocalReadingPositionBookmarkInput,
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingBookmark> {
    this.assertNonBlankString(input.bookName, 'bookName');
    if (typeof input.bookAuthor !== 'string') {
      throw new Error('bookAuthor must be a string');
    }
    this.assertNonNegativeInteger(input.chapterIndex, 'chapterIndex');
    this.assertNonNegativeInteger(input.chapterOffset, 'chapterOffset');
    this.assertNonBlankString(input.chapterTitle, 'chapterTitle');
    const params: JsonObject = {
      bookName: input.bookName, bookAuthor: input.bookAuthor, chapterIndex: input.chapterIndex,
      chapterPos: input.chapterOffset, chapterName: input.chapterTitle, bookText: input.bookText ?? '',
    };
    if (input.positionScope !== undefined) {
      if (input.positionScope.chapterIndex !== input.chapterIndex) throw new Error('bookmark position scope chapter mismatch');
      params['positionScope'] = encodeRemotePositionScope(input.positionScope);
    }
    const result = await this.runtimeOwner.request('bookmark.create', params, this.requestOptions(isCurrent));
    const rawBookmark = this.requireObject(result.data['bookmark'], 'bookmark.create bookmark');
    const time = this.requireSafeInteger(rawBookmark, 'time', 'bookmark.create bookmark');
    const bookName = this.requireString(rawBookmark, 'bookName', 'bookmark.create bookmark');
    const bookAuthor = this.requireString(rawBookmark, 'bookAuthor', 'bookmark.create bookmark');
    const chapterIndex = this.requireSafeInteger(rawBookmark, 'chapterIndex', 'bookmark.create bookmark');
    const chapterOffset = this.requireNonNegativeInteger(
      rawBookmark,
      'chapterPos',
      'bookmark.create bookmark',
    );
    const chapterTitle = this.requireString(rawBookmark, 'chapterName', 'bookmark.create bookmark');
    const bookText = this.requireString(rawBookmark, 'bookText', 'bookmark.create bookmark');
    const content = this.requireString(rawBookmark, 'content', 'bookmark.create bookmark');
    if (bookName !== input.bookName || bookAuthor !== input.bookAuthor ||
      chapterIndex !== input.chapterIndex || chapterOffset !== input.chapterOffset ||
      chapterTitle !== input.chapterTitle) {
      throw new Error('bookmark.create returned a mismatched position bookmark');
    }
    const positionScope = decodeRemotePositionScope(rawBookmark['positionScope']);
    if (input.positionScope !== undefined && (positionScope === undefined || positionScope.sourceId !== input.positionScope.sourceId ||
      positionScope.bookId !== input.positionScope.bookId || positionScope.chapterIndex !== input.positionScope.chapterIndex ||
      positionScope.bodyVersion !== input.positionScope.bodyVersion || positionScope.processingVersion !== input.positionScope.processingVersion)) {
      throw new Error('bookmark.create returned a mismatched position scope');
    }
    return { time, chapterIndex, chapterOffset, chapterTitle, content, bookText,
      ...(positionScope === undefined ? {} : { positionScope }) };
  }

  /** Deletes one already-projected bookmark by its Core-owned primary key. */
  async deleteBookmark(
    time: number,
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(time)) {
      throw new Error('time must be a safe integer');
    }
    const result = await this.runtimeOwner.request('bookmark.delete', {
      time,
    }, this.requestOptions(isCurrent));
    const returnedTime = this.requireSafeInteger(result.data, 'time', 'bookmark.delete');
    if (returnedTime !== time) {
      throw new Error('bookmark.delete returned a mismatched time');
    }
    const deleted = result.data['deleted'];
    if (typeof deleted !== 'boolean') {
      throw new Error('bookmark.delete returned invalid deleted');
    }
    return deleted;
  }

  async loadChapter(
    bookId: string,
    chapterIndex: number,
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingChapter> {
    this.assertNonBlankString(bookId, 'bookId');
    this.assertNonNegativeInteger(chapterIndex, 'chapterIndex');
    const result = await this.runtimeOwner.request('local_book.chapter.content', {
      bookId,
      chapterIndex,
    }, this.requestOptions(isCurrent));
    this.assertLocalSource(result.data, 'local_book.chapter.content');
    this.assertMatchingBookId(result.data, bookId, 'local_book.chapter.content');
    const returnedIndex = this.requireNonNegativeInteger(
      result.data,
      'chapterIndex',
      'local_book.chapter.content',
    );
    if (returnedIndex !== chapterIndex) {
      throw new Error('local_book.chapter.content returned a mismatched chapterIndex');
    }
    const bodyVersion = this.optionalString(result.data, 'bodyVersion', 'local_book.chapter.content');
    const processingVersion = this.optionalString(result.data, 'processingVersion', 'local_book.chapter.content');
    appendExpectedPositionVersions({}, bodyVersion, processingVersion);
    return {
      bookId,
      chapterIndex: returnedIndex,
      chapterTitle: this.requireString(result.data, 'chapterTitle', 'local_book.chapter.content'),
      content: this.requireString(result.data, 'content', 'local_book.chapter.content'),
      blocks: this.optionalArray(result.data, 'blocks', 'local_book.chapter.content'),
      ...(bodyVersion === undefined ? {} : { bodyVersion }),
      ...(processingVersion === undefined ? {} : { processingVersion }),
    };
  }

  private optionalArray(value: JsonObject, field: string, context: string): unknown[] | undefined {
    const raw = value[field];
    if (raw === undefined) {
      return undefined;
    }
    if (!Array.isArray(raw)) {
      throw new Error(`${context} returned invalid ${field}`);
    }
    return raw;
  }

  /**
   * Reads exact whole-book progress metrics without loading chapter bodies
   * into ArkUI. Core applies the same canonical ContentProcessor path as
   * `local_book.chapter.content` before counting Unicode scalars.
   */
  async loadContentMetrics(
    bookId: string,
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingContentMetrics> {
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request(
      'local_book.content.metrics',
      { bookId },
      this.requestOptions(isCurrent),
    );
    this.assertLocalSource(result.data, 'local_book.content.metrics');
    this.assertMatchingBookId(result.data, bookId, 'local_book.content.metrics');
    const totalScalarLength = this.requireNonNegativeInteger(
      result.data,
      'totalScalarLength',
      'local_book.content.metrics',
    );
    const rawChapters = result.data['chapters'];
    if (!Array.isArray(rawChapters)) {
      throw new Error('local_book.content.metrics returned invalid chapters');
    }

    const chapters: LocalReadingChapterContentMetric[] = [];
    const seenIndices = new Set<number>();
    let expectedStart = 0;
    for (const rawChapter of rawChapters) {
      const chapter = this.requireObject(rawChapter, 'local_book.content.metrics chapter');
      const chapterIndex = this.requireNonNegativeInteger(
        chapter,
        'chapterIndex',
        'local_book.content.metrics chapter',
      );
      if (seenIndices.has(chapterIndex)) {
        throw new Error('local_book.content.metrics returned duplicate chapterIndex');
      }
      seenIndices.add(chapterIndex);
      const scalarLength = this.requireNonNegativeInteger(
        chapter,
        'scalarLength',
        'local_book.content.metrics chapter',
      );
      const cumulativeStart = this.requireNonNegativeInteger(
        chapter,
        'cumulativeStart',
        'local_book.content.metrics chapter',
      );
      const cumulativeEnd = this.requireNonNegativeInteger(
        chapter,
        'cumulativeEnd',
        'local_book.content.metrics chapter',
      );
      if (cumulativeStart !== expectedStart ||
        !Number.isSafeInteger(cumulativeStart + scalarLength) ||
        cumulativeEnd !== cumulativeStart + scalarLength) {
        throw new Error('local_book.content.metrics returned a non-contiguous scalar index');
      }
      chapters.push({
        chapterIndex,
        scalarLength,
        cumulativeStart,
        cumulativeEnd,
      });
      expectedStart = cumulativeEnd;
    }
    if (expectedStart !== totalScalarLength) {
      throw new Error('local_book.content.metrics returned a mismatched totalScalarLength');
    }
    return { bookId, totalScalarLength, chapters };
  }

  async loadProgress(bookId: string, isCurrent?: LocalReadingRequestGuard): Promise<LocalReadingProgressState> {
    this.assertNonBlankString(bookId, 'bookId');
    const result = await this.runtimeOwner.request('reading.progress.get', {
      bookId,
      sourceId: LOCAL_SOURCE_ID,
    }, this.requestOptions(isCurrent));
    const found = result.data['found'];
    if (typeof found !== 'boolean') {
      throw new Error('reading.progress.get returned invalid found');
    }
    const rawProgress = result.data['progress'];
    const progressRevision = this.optionalString(result.data, 'progressRevision', 'reading.progress.get');
    if (this.runtimeOwner.supportsCoreCapability?.('reading.progress.compareAndSet.v1') === true && !progressRevision)
      throw new Error('READING_PROGRESS_REVISION_MISSING');
    if (!found) {
      if (rawProgress !== null) {
        throw new Error('reading.progress.get returned progress for a missing row');
      }
      return { kind: 'missing', ...(progressRevision === undefined ? {} : { progressRevision }) };
    }
    return {
      kind: 'restored',
      ...(progressRevision === undefined ? {} : { progressRevision }),
      progress: this.decodeProgress(rawProgress, bookId, 'reading.progress.get'),
    };
  }

  /**
   * Converts a measured, local Unicode-scalar anchor into the Core-owned
   * canonical location. This command is pure; persistence remains an explicit
   * subsequent `reading.progress.update` user intent.
   */
  async resolveLocation(
    bookId: string,
    chapterTitle: string | undefined,
    anchor: LocalReadingAnchor,
    layout: LocalReadingLayout,
    isCurrent?: LocalReadingRequestGuard,
  ): Promise<LocalReadingResolvedLocation> {
    this.assertNonBlankString(bookId, 'bookId');
    if (chapterTitle !== undefined && typeof chapterTitle !== 'string') {
      throw new Error('chapterTitle must be a string when provided');
    }
    this.assertChapterIndex(anchor.chapterIndex, 'chapterIndex');
    this.assertNonNegativeInteger(anchor.chapterOffset, 'chapterOffset');
    this.assertProgress(anchor.chapterProgress, 'chapterProgress');
    this.assertLayout(layout);

    const params: JsonObject = {
      sourceId: LOCAL_SOURCE_ID,
      bookId,
      chapterIndex: anchor.chapterIndex,
      anchor: {
        chapterOffset: anchor.chapterOffset,
        chapterProgress: anchor.chapterProgress,
      },
      layout: this.locationLayoutParams(layout),
    };
    // Core treats this display-only diagnostic as optional. A materialized
    // EPUB chapter may validly have no title; emitting an empty title used to
    // reject the otherwise usable reader position and leave the surface blank.
    if (chapterTitle !== undefined && chapterTitle.length > 0) {
      params['chapterTitle'] = chapterTitle;
    }
    const result = await this.runtimeOwner.request(
      'reader.location.resolve',
      params,
      this.requestOptions(isCurrent),
    );
    if (result.data['resolved'] !== true) {
      throw new Error('reader.location.resolve did not confirm resolution');
    }
    const canonical = this.requireObject(result.data['canonicalLocation'], 'reader.location.resolve canonicalLocation');
    const resolvedBookId = this.requireString(canonical, 'bookId', 'reader.location.resolve canonicalLocation');
    if (resolvedBookId !== bookId) {
      throw new Error('reader.location.resolve returned a mismatched bookId');
    }
    const resolvedChapterIndex = this.requireChapterIndex(
      canonical,
      'chapterIndex',
      'reader.location.resolve canonicalLocation',
    );
    if (resolvedChapterIndex !== anchor.chapterIndex) {
      throw new Error('reader.location.resolve returned a mismatched chapterIndex');
    }
    const resolvedOffset = this.requireNonNegativeInteger(
      canonical,
      'chapterOffset',
      'reader.location.resolve canonicalLocation',
    );
    if (resolvedOffset !== anchor.chapterOffset) {
      throw new Error('reader.location.resolve returned a mismatched chapterOffset');
    }
    const resolvedProgress = this.requireProgress(
      canonical,
      'chapterProgress',
      'reader.location.resolve canonicalLocation',
    );
    // Core owns the canonical location. Keep the layout-independent chapter
    // index and Unicode-scalar offset exact, but consume Core's bounded
    // progress fallback: an f64 JSON round trip may legitimately move its
    // final decimal digit even when the primary anchor is unchanged.
    const reflow = this.requireOffsetAnchorReflow(result.data['reflow']);
    return {
      bookId,
      chapterIndex: resolvedChapterIndex,
      chapterOffset: resolvedOffset,
      chapterProgress: resolvedProgress,
      locationRevision: this.requireString(canonical, 'locationRevision', 'reader.location.resolve canonicalLocation'),
      resolverVersion: this.requireString(result.data, 'resolverVersion', 'reader.location.resolve'),
      reflow,
    };
  }

  async updateProgress(
    bookId: string,
    update: LocalReadingProgressUpdate,
    isCurrent?: LocalReadingRequestGuard,
    resolution?: LocalReadingAtomicResolution,
  ): Promise<LocalReadingProgress> {
    this.assertNonBlankString(bookId, 'bookId');
    this.assertChapterIndex(update.chapterIndex, 'chapterIndex');
    this.assertNonNegativeInteger(update.chapterOffset, 'chapterOffset');
    this.assertProgress(update.chapterProgress, 'chapterProgress');
    if (update.locationRevision !== undefined) {
      this.assertNonBlankString(update.locationRevision, 'locationRevision');
    }
    if (resolution !== undefined) {
      this.assertChapterIndex(resolution.anchor.chapterIndex, 'resolution.anchor.chapterIndex');
      this.assertNonNegativeInteger(resolution.anchor.chapterOffset, 'resolution.anchor.chapterOffset');
      this.assertProgress(resolution.anchor.chapterProgress, 'resolution.anchor.chapterProgress');
      this.assertLayout(resolution.layout);
      if (resolution.anchor.chapterIndex !== update.chapterIndex ||
        resolution.anchor.chapterOffset !== update.chapterOffset ||
        resolution.anchor.chapterProgress !== update.chapterProgress) {
        throw new Error('atomic progress resolution must match the progress update anchor');
      }
    }

    const params: JsonObject = {
      bookId,
      sourceId: LOCAL_SOURCE_ID,
      chapterIndex: update.chapterIndex,
      chapterOffset: update.chapterOffset,
      chapterProgress: update.chapterProgress,
    };
    appendExpectedPositionVersions(params, update.expectedBodyVersion ?? resolution?.anchor.bodyVersion,
      update.expectedProcessingVersion ?? resolution?.anchor.processingVersion);
    if (update.expectedProgressRevision !== undefined) {
      this.assertNonBlankString(update.expectedProgressRevision, 'expectedProgressRevision');
      params['expectedProgressRevision'] = update.expectedProgressRevision;
    }
    if (update.locationRevision !== undefined) {
      params['locationRevision'] = update.locationRevision;
    }
    if (resolution !== undefined) {
      params['anchor'] = {
        chapterOffset: resolution.anchor.chapterOffset,
        chapterProgress: resolution.anchor.chapterProgress,
      };
      params['layout'] = this.locationLayoutParams(resolution.layout);
      if (resolution.chapterTitle !== undefined && resolution.chapterTitle.length > 0) {
        params['chapterTitle'] = resolution.chapterTitle;
      }
    }
    const result = await this.runtimeOwner.request(
      'reading.progress.update',
      params,
      this.requestOptions(isCurrent),
    );
    if (result.data['stored'] !== true) {
      throw new Error('reading.progress.update did not confirm storage');
    }
    const stored = this.decodeProgress(result.data, bookId, 'reading.progress.update');
    if (resolution !== undefined && stored.locationRevision === undefined) {
      throw new Error('reading.progress.update did not resolve a canonical location');
    }
    // Core storage may retain a newer current row under its timestamp LWW
    // policy. `stored: true` confirms command handling, not that this caller's
    // anchor won; never let the page treat a different retained chapter/offset
    // as its own successful first-page commit.
    if ((params['expectedBodyVersion'] !== undefined && stored.bodyVersion !== params['expectedBodyVersion']) ||
      (params['expectedProcessingVersion'] !== undefined && stored.processingVersion !== params['expectedProcessingVersion']) ||
      stored.chapterIndex !== update.chapterIndex || stored.chapterOffset !== update.chapterOffset ||
      (update.locationRevision !== undefined && stored.locationRevision !== update.locationRevision)) {
      throw new Error('reading.progress.update retained a different current progress row');
    }
    return stored;
  }

  async runProgressCommitSerial(operation: () => Promise<void>): Promise<void> {
    const predecessor = this.progressCommitTail;
    let release: () => void = (): void => {};
    this.progressCommitTail = new Promise<void>((resolve: () => void): void => {
      release = resolve;
    });
    try {
      await predecessor;
      await operation();
    } finally {
      release();
    }
  }

  private requestOptions(isCurrent: LocalReadingRequestGuard | undefined): RequestOptions {
    if (isCurrent === undefined) {
      return {};
    }
    return {
      shouldCancel: (): boolean => !isCurrent(),
    };
  }

  private decodeProgress(value: unknown, expectedBookId: string, command: string): LocalReadingProgress {
    const progress = this.requireObject(value, `${command} progress`);
    this.assertLocalSource(progress, command);
    this.assertMatchingBookId(progress, expectedBookId, command);
    const bodyVersion = this.optionalString(progress, 'bodyVersion', command);
    const processingVersion = this.optionalString(progress, 'processingVersion', command);
    appendExpectedPositionVersions({}, bodyVersion, processingVersion);
    const locationRevision = this.optionalString(progress, 'locationRevision', command);
    return {
      bookId: expectedBookId,
      chapterIndex: this.requireChapterIndex(progress, 'chapterIndex', command),
      chapterOffset: this.requireNonNegativeInteger(progress, 'chapterOffset', command),
      chapterProgress: this.requireProgress(progress, 'chapterProgress', command),
      updatedAt: this.requireNonNegativeInteger(progress, 'updatedAt', command),
      ...(locationRevision === undefined ? {} : { locationRevision }),
      ...(bodyVersion === undefined ? {} : { bodyVersion }),
      ...(processingVersion === undefined ? {} : { processingVersion }),
    };
  }

  private assertLocalSource(value: JsonObject, command: string): void {
    if (value['sourceId'] !== LOCAL_SOURCE_ID) {
      throw new Error(`${command} returned a non-local sourceId`);
    }
  }

  private assertMatchingBookId(value: JsonObject, expectedBookId: string, command: string): void {
    if (value['bookId'] !== expectedBookId) {
      throw new Error(`${command} returned a mismatched bookId`);
    }
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${context} returned a non-object value`);
    }
    return value as JsonObject;
  }

  private requireString(value: JsonObject, key: string, context: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string, context: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonNegativeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireSafeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)) {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireDownloadState(
    value: JsonObject,
    key: string,
    context: string,
  ): LocalReadingDownloadState {
    const candidate = value[key];
    if (candidate === 'missing' || candidate === 'queued' || candidate === 'inProgress' ||
      candidate === 'cached' || candidate === 'completed' || candidate === 'failed' ||
      candidate === 'cancelled') {
      return candidate;
    }
    throw new Error(`${context} returned invalid ${key}`);
  }

  private requireProgress(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
      throw new Error(`${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private assertNonBlankString(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${field} must be a non-blank string`);
    }
  }

  private assertNonNegativeInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative safe integer`);
    }
  }

  private assertChapterIndex(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new Error(`${field} must be a non-negative uint32`);
    }
  }

  private assertLayout(layout: LocalReadingLayout): void {
    this.assertPositiveUint32(layout.viewportWidth, 'layout.viewportWidth');
    this.assertPositiveUint32(layout.viewportHeight, 'layout.viewportHeight');
    if (!Number.isFinite(layout.fontScale) || layout.fontScale <= 0) {
      throw new Error('layout.fontScale must be a positive finite number');
    }
    if (layout.lineHeight !== undefined && (!Number.isFinite(layout.lineHeight) || layout.lineHeight <= 0)) {
      throw new Error('layout.lineHeight must be a positive finite number');
    }
    if (layout.pageCount !== undefined) {
      this.assertPositiveUint32(layout.pageCount, 'layout.pageCount');
    }
    if (layout.pageIndex !== undefined) {
      this.assertNonNegativeUint32(layout.pageIndex, 'layout.pageIndex');
      if (layout.pageCount !== undefined && layout.pageIndex >= layout.pageCount) {
        throw new Error('layout.pageIndex must be lower than layout.pageCount');
      }
    }
  }

  private locationLayoutParams(layout: LocalReadingLayout): JsonObject {
    const params: JsonObject = {
      viewportWidth: layout.viewportWidth,
      viewportHeight: layout.viewportHeight,
      fontScale: layout.fontScale,
    };
    if (layout.lineHeight !== undefined) {
      params['lineHeight'] = layout.lineHeight;
    }
    if (layout.pageIndex !== undefined) {
      params['pageIndex'] = layout.pageIndex;
    }
    if (layout.pageCount !== undefined) {
      params['pageCount'] = layout.pageCount;
    }
    return params;
  }

  private requireOffsetAnchorReflow(value: unknown): LocalReadingResolvedLocation['reflow'] {
    const reflow = this.requireObject(value, 'reader.location.resolve reflow');
    if (reflow['strategy'] !== 'offsetAnchor' ||
      reflow['primaryAnchor'] !== 'chapterOffset' ||
      reflow['fallbackAnchor'] !== 'chapterProgress' ||
      reflow['layoutIndependent'] !== true) {
      throw new Error('reader.location.resolve returned an unsupported reflow rule');
    }
    return {
      strategy: 'offsetAnchor',
      primaryAnchor: 'chapterOffset',
      fallbackAnchor: 'chapterProgress',
      layoutIndependent: true,
    };
  }

  private requireChapterIndex(value: JsonObject, key: string, context: string): number {
    const candidate = this.requireNonNegativeInteger(value, key, context);
    if (candidate > 0xffffffff) {
      throw new Error(`${context} returned out-of-range ${key}`);
    }
    return candidate;
  }

  private assertPositiveUint32(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff) {
      throw new Error(`${field} must be a positive uint32`);
    }
  }

  private assertNonNegativeUint32(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new Error(`${field} must be a non-negative uint32`);
    }
  }

  private assertProgress(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${field} must be between 0 and 1`);
    }
  }
}
