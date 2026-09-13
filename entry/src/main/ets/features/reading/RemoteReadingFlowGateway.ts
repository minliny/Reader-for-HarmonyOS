import type {
  JsonObject,
  ReaderCoreResultEvent,
  RequestOptions,
} from '@reader/core-harmony';
import {
  assertRemoteReadingHostRequirements,
  assertRemoteReadingNonBlankString,
  classifyRemoteReadingCommandFailure,
  createRemoteReadingIdentity,
  decodeRemoteReadingVariables,
  encodeRemoteReadingVariables,
  mergeRemoteReadingVariables,
  RemoteReadingGatewayError,
  type RemoteReadingTocDiagnostic,
  type RemoteReadingCommand,
  type RemoteReadingHostCapabilityId,
  type RemoteReadingIdentity,
  type RemoteReadingVariable,
} from './RemoteReadingContract';
import { type ReadingSessionChapter } from './ReadingChapterWindow';
import { materializeReadingDocument } from './ReadingDocumentProjection';
import { classifyChapterBody, RemoteReadingSourceError } from './RemoteContentAdmission';
import type {
  ChapterBodyReadableVerdict,
  ChapterBodyRejectedVerdict,
  ChapterBodyVerdict,
} from './RemoteContentAdmission';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';

export type RemoteReadingBookSeed = {
  sourceVersion?: string;
  sourceId: string;
  bookId: string;
  /** Exact detail URL/path produced by the source search result. */
  detailUrl: string;
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
  /** Transient variables emitted by the search rule for this exact item. */
  searchVariables?: RemoteReadingVariable[];
};

export type RemoteReadingBookDetail = {
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  kind?: string;
  lastChapter?: string;
};

export type RemoteReadingTocEntry = {
  index: number;
  title: string;
  url: string;
  variables: RemoteReadingVariable[];
};

export type RemoteReadingSession = {
  sourceVersion?: string;
  acquisitionMode: 'online' | 'offline';
  identity: RemoteReadingIdentity;
  detailUrl: string;
  tocUrl: string;
  book: RemoteReadingBookDetail;
  /** Search + detail variables, ready to be overridden by a TOC entry. */
  continuationVariables: RemoteReadingVariable[];
  entries: RemoteReadingTocEntry[];
  hostRequirements: RemoteReadingHostCapabilityId[];
};

export type RemoteReadingProgress = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  updatedAt: number;
  locationRevision?: string;
};

export type RemoteReadingProgressState =
  | { kind: 'missing' }
  | { kind: 'restored'; progress: RemoteReadingProgress };

export type RemoteReadingProgressUpdate = {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision?: string;
};

export type RemoteReadingAnchor = {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
};

export type RemoteReadingLayout = {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight?: number;
  pageIndex?: number;
  pageCount?: number;
};

export type RemoteReadingResolvedLocation = {
  sourceId: string;
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

export type RemoteReadingAtomicResolution = {
  chapterTitle?: string;
  anchor: RemoteReadingAnchor;
  layout: RemoteReadingLayout;
};

export type RemoteReadingOpenOptions = {
  forceRefresh?: boolean;
  isCurrent?: () => boolean;
  /** Requirements known from source metadata; blocked Host semantics stop before I/O. */
  hostRequirements?: RemoteReadingHostCapabilityId[];
};

/**
 * Remote acquisition for the shared native reading session. It never routes
 * through LocalReadingFlowGateway: source execution keeps the exact Core-owned
 * `(sourceId, bookId)` identity until a chapter is materialized, then returns
 * the same ReadingSessionChapter shape consumed by local pagination.
 */
export class RemoteReadingFlowGateway {
  // Keep ordering within one admitted reader while allowing a newly opened
  // session to proceed independently from stale work owned by an old reader.
  private progressCommitTail: Promise<void> = Promise.resolve();
  private readonly runtimeOwner: ReadingGatewayRuntime;
  private indexedEntries: RemoteReadingTocEntry[] | undefined = undefined;
  private chapterByIndex: Map<number, RemoteReadingTocEntry> = new Map();

  constructor(runtimeOwner: ReadingGatewayRuntime) {
    this.runtimeOwner = runtimeOwner;
  }

  async openSession(
    seed: RemoteReadingBookSeed,
    options: RemoteReadingOpenOptions = {},
  ): Promise<RemoteReadingSession> {
    const coordinator = this.runtimeOwner.bookAcquisitions?.();
    if (coordinator !== undefined) return coordinator.acquireBook(seed, options);
    const identity = createRemoteReadingIdentity(seed.sourceId, seed.bookId);
    assertRemoteReadingNonBlankString(seed.detailUrl, 'detailUrl');
    assertRemoteReadingNonBlankString(seed.title, 'title');
    if (typeof seed.author !== 'string') {
      throw new RemoteReadingGatewayError('invalidInput', 'author must be a string');
    }
    const hostRequirements = options.hostRequirements === undefined ?
      ['httpExecute'] as RemoteReadingHostCapabilityId[] : options.hostRequirements.slice();
    assertRemoteReadingHostRequirements(hostRequirements);

    const searchVariables = mergeRemoteReadingVariables([], seed.searchVariables ?? []);
    const baseBook = this.bookSeedParams(seed, searchVariables);
    const detailResult = await this.request('book.detail', {
      sourceId: identity.sourceId,
      book: baseBook,
      bookUrl: seed.detailUrl,
    }, options.isCurrent);
    if (detailResult.data['sourceId'] !== identity.sourceId) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        'book.detail returned a mismatched sourceId',
        'book.detail',
      );
    }
    const rawBook = this.requireObject(detailResult.data['book'], 'book.detail book');
    if (this.requireNonBlankString(rawBook, 'bookId', 'book.detail book') !== identity.bookId) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        'book.detail returned a mismatched bookId',
        'book.detail',
      );
    }
    const book = this.decodeBookDetail(rawBook);
    const tocUrl = this.optionalString(detailResult.data, 'tocUrl', 'book.detail');
    if (tocUrl === undefined || tocUrl.trim().length === 0) {
      throw new RemoteReadingGatewayError(
        'missingTocUrl',
        'book.detail did not return the TOC URL required by book.toc',
        'book.detail',
      );
    }
    const detailVariables = decodeRemoteReadingVariables(
      detailResult.data['variables'],
      'book.detail',
      true,
    );
    const continuationVariables = mergeRemoteReadingVariables(searchVariables, detailVariables);

    const tocResult = await this.request('book.toc', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      tocUrl,
      variables: encodeRemoteReadingVariables(continuationVariables),
    }, options.isCurrent);
    this.assertIdentity(tocResult.data, identity, 'book.toc');
    const entries = this.decodeToc(tocResult.data['toc']);
    if (entries.length === 0) {
      const diagnostic: RemoteReadingTocDiagnostic = {
        sourceId: identity.sourceId,
        bookId: identity.bookId,
        tocUrl,
        returnedEntryCount: 0,
      };
      throw new RemoteReadingGatewayError(
        'emptyToc', 'book.toc returned no readable chapters', 'book.toc', undefined, diagnostic);
    }
    return {
      acquisitionMode: 'online',
      sourceVersion: typeof detailResult.data['sourceVersion'] === 'string' ? detailResult.data['sourceVersion'] as string : seed.sourceVersion,
      identity,
      detailUrl: seed.detailUrl,
      tocUrl,
      book,
      continuationVariables,
      entries,
      hostRequirements,
    };
  }

  /**
   * Reconstruct the smallest valid reading session from Core's durable TOC.
   * This path performs no source request and is admitted only when Core proves
   * that a cached TOC exists. Individual chapters remain fail-closed below.
   */
  async openCachedSession(
    seed: RemoteReadingBookSeed,
    isCurrent?: () => boolean,
  ): Promise<RemoteReadingSession> {
    const identity = createRemoteReadingIdentity(seed.sourceId, seed.bookId);
    assertRemoteReadingNonBlankString(seed.detailUrl, 'detailUrl');
    assertRemoteReadingNonBlankString(seed.title, 'title');
    if (typeof seed.author !== 'string') {
      throw new RemoteReadingGatewayError('invalidInput', 'author must be a string');
    }
    const result = await this.request('cache.book.status', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      includeGlobalStats: false,
      includeChapterStates: false,
    }, isCurrent);
    this.assertIdentity(result.data, identity, 'cache.book.status');
    if (result.data['tocAvailable'] !== true) {
      throw new RemoteReadingGatewayError(
        'cachedSessionUnavailable',
        'REMOTE_TOC_NOT_DOWNLOADED',
        'cache.book.status',
      );
    }
    const rawChapters = result.data['chapters'];
    if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
      throw new RemoteReadingGatewayError(
        'cachedSessionUnavailable',
        'REMOTE_TOC_NOT_DOWNLOADED',
        'cache.book.status',
      );
    }
    const entries: RemoteReadingTocEntry[] = [];
    const continuationVariables = decodeRemoteReadingVariables(
      result.data['continuationVariables'],
      'cache.book.status',
      true,
    );
    for (let position = 0; position < rawChapters.length; position += 1) {
      const raw = this.requireObject(rawChapters[position], 'cache.book.status chapter');
      const index = this.requireChapterIndex(raw, 'chapterIndex', 'cache.book.status chapter');
      if (index !== position) {
        throw new RemoteReadingGatewayError(
          'invalidResponse',
          'cache.book.status returned a non-contiguous cached TOC',
          'cache.book.status',
        );
      }
      entries.push({
        index,
        title: this.requireNonBlankString(raw, 'title', 'cache.book.status chapter'),
        url: this.requireNonBlankString(raw, 'url', 'cache.book.status chapter'),
        variables: decodeRemoteReadingVariables(
          raw['variables'],
          'cache.book.status chapter',
          true,
        ),
      });
    }
    return {
      acquisitionMode: 'offline',
      sourceVersion: seed.sourceVersion,
      identity,
      detailUrl: seed.detailUrl,
      tocUrl: '',
      book: {
        title: seed.title,
        author: seed.author,
        coverUrl: seed.coverUrl,
        intro: seed.intro,
        kind: seed.kind,
        lastChapter: seed.lastChapter,
      },
      continuationVariables: mergeRemoteReadingVariables(
        seed.searchVariables ?? [],
        continuationVariables,
      ),
      entries,
      hostRequirements: [],
    };
  }

  /**
   * Admit a shelf book from Core's durable catalog without waiting for an
   * online detail/TOC refresh. Chapter loading remains cache-first and may
   * use the source transport when a body was explicitly cleared.
   */
  async openCachedCatalogSession(
    seed: RemoteReadingBookSeed,
    isCurrent?: () => boolean,
  ): Promise<RemoteReadingSession> {
    const cached = await this.openCachedSession(seed, isCurrent);
    return {
      acquisitionMode: 'online',
      sourceVersion: cached.sourceVersion,
      identity: cached.identity,
      detailUrl: cached.detailUrl,
      tocUrl: cached.tocUrl,
      book: cached.book,
      continuationVariables: cached.continuationVariables,
      entries: cached.entries,
      hostRequirements: ['httpExecute'],
    };
  }

  /**
   * Re-project cached TOC titles after a Core display-setting change.
   * `cache.book.status` reads the canonical cached TOC and performs no source
   * request, so changing Chinese conversion never refetches a real book source.
   */
  async loadCachedTocProjection(
    session: RemoteReadingSession,
    isCurrent?: () => boolean,
  ): Promise<RemoteReadingTocEntry[]> {
    const identity = createRemoteReadingIdentity(session.identity.sourceId, session.identity.bookId);
    const result = await this.request('cache.book.status', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      includeGlobalStats: false,
    }, isCurrent);
    this.assertIdentity(result.data, identity, 'cache.book.status');
    const rawChapters = result.data['chapters'];
    if (!Array.isArray(rawChapters) || rawChapters.length !== session.entries.length) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'cache.book.status returned an incomplete cached TOC projection',
        'cache.book.status',
      );
    }
    return rawChapters.map((value: unknown, position: number): RemoteReadingTocEntry => {
      const raw = this.requireObject(value, 'cache.book.status chapter');
      const index = this.requireChapterIndex(raw, 'chapterIndex', 'cache.book.status chapter');
      if (index !== position || session.entries[position].index !== index) {
        throw new RemoteReadingGatewayError(
          'invalidResponse',
          'cache.book.status returned a non-contiguous cached TOC projection',
          'cache.book.status',
        );
      }
      return {
        index,
        title: this.requireNonBlankString(raw, 'title', 'cache.book.status chapter'),
        url: this.requireNonBlankString(raw, 'url', 'cache.book.status chapter'),
        variables: session.entries[position].variables,
      };
    });
  }

  async loadChapter(
    session: RemoteReadingSession,
    chapterIndex: number,
    isCurrent?: () => boolean,
  ): Promise<ReadingSessionChapter> {
    const coordinator = this.runtimeOwner.bookAcquisitions?.();
    const attemptAt = coordinator?.beginAttempt() ?? Date.now();
    const identity = createRemoteReadingIdentity(session.identity.sourceId, session.identity.bookId);
    this.assertChapterIndex(chapterIndex, 'chapterIndex');
    assertRemoteReadingHostRequirements(session.hostRequirements);
    const selected = this.chapterEntry(session, chapterIndex);
    if (selected === undefined) {
      throw new RemoteReadingGatewayError(
        'chapterNotFound',
        `chapter ${chapterIndex} is not present in the remote session TOC`,
      );
    }
    if (session.acquisitionMode === 'offline') {
      await this.assertOfflineChapterAvailable(identity, chapterIndex, isCurrent);
    }
    assertRemoteReadingNonBlankString(selected.title, 'session chapter title');
    assertRemoteReadingNonBlankString(selected.url, 'session chapter URL');
    const variables = mergeRemoteReadingVariables(session.continuationVariables, selected.variables);
    const result = await this.request('chapter.content', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterTitle: selected.title,
      chapterIndex: selected.index,
      chapterUrl: selected.url,
      variables: encodeRemoteReadingVariables(variables),
    }, isCurrent);
    this.assertIdentity(result.data, identity, 'chapter.content');
    // chapter index is the navigation identity; title is a Core-projected
    // display value and can legitimately change after a Chinese conversion
    // mode switch.
    const returnedTitle = this.requireNonBlankString(result.data, 'chapterTitle', 'chapter.content');
    if (typeof result.data['content'] !== 'string') {
      throw new RemoteReadingGatewayError(
        'nonTextChapter',
        'chapter.content returned structured JS data that the text reader cannot render',
        'chapter.content',
      );
    }
    const via = result.data['via'];
    if (via !== 'rule' && via !== 'js' && via !== 'cache') {
      throw new RemoteReadingGatewayError('invalidResponse', 'chapter.content returned invalid via', 'chapter.content');
    }
    const document = await materializeReadingDocument(
      result.data,
      identity.sourceId,
      this.chapterResponseBaseUrl(result.data) ?? selected.url,
      this.runtimeOwner,
      isCurrent,
    );
    // The projected body must be real chapter text: paywall placeholders,
    // login pages, captcha interstitials and blank bodies are typed source
    // failures so the UI can offer a user-confirmed source switch. Image
    // chapters render without text and skip the text-length probe.
    const imageBodyVerdict: ChapterBodyReadableVerdict = { kind: 'readable' };
    const bodyVerdict: ChapterBodyVerdict = document.images.length > 0 ?
      imageBodyVerdict : classifyChapterBody(document.content);
    if (bodyVerdict.kind !== 'readable') {
      const rejected: ChapterBodyRejectedVerdict = bodyVerdict;
      if (coordinator !== undefined) {
        void coordinator.reportVerdict(session, selected.url, rejected.reason, attemptAt).catch((): void => {});
      }
      throw new RemoteReadingSourceError(
        rejected.kind,
        `chapter ${chapterIndex} body was rejected: ${rejected.reason}`,
        'chapter.content',
      );
    }
    if (coordinator !== undefined) {
      void coordinator.reportVerdict(session, selected.url, undefined, attemptAt).catch((): void => {});
    }
    return {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex,
      chapterTitle: returnedTitle,
      chapterUrl: selected.url,
      content: document.content,
      images: document.images,
      contentVersion: document.contentVersion,
      extractionVia: via === 'cache' ? 'rule' : via,
    };
  }

  private chapterEntry(
    session: RemoteReadingSession,
    chapterIndex: number,
  ): RemoteReadingTocEntry | undefined {
    if (this.indexedEntries !== session.entries) {
      const chapterByIndex = new Map<number, RemoteReadingTocEntry>();
      for (const entry of session.entries) {
        chapterByIndex.set(entry.index, entry);
      }
      this.indexedEntries = session.entries;
      this.chapterByIndex = chapterByIndex;
    }
    return this.chapterByIndex.get(chapterIndex);
  }

  private async assertOfflineChapterAvailable(
    identity: RemoteReadingIdentity,
    chapterIndex: number,
    isCurrent?: () => boolean,
  ): Promise<void> {
    const result = await this.request('cache.book.status', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      includeGlobalStats: false,
    }, isCurrent);
    this.assertIdentity(result.data, identity, 'cache.book.status');
    const rawChapters = result.data['chapters'];
    if (!Array.isArray(rawChapters)) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'cache.book.status returned invalid chapters',
        'cache.book.status',
      );
    }
    for (const rawValue of rawChapters) {
      const raw = this.requireObject(rawValue, 'cache.book.status chapter');
      if (this.requireChapterIndex(raw, 'chapterIndex', 'cache.book.status chapter') !== chapterIndex) {
        continue;
      }
      const state = this.requireString(raw, 'state', 'cache.book.status chapter');
      const cachedBytesValue = raw['cachedBytes'];
      const cachedBytes = typeof cachedBytesValue === 'number' && Number.isSafeInteger(cachedBytesValue) &&
        cachedBytesValue >= 0 ? cachedBytesValue : 0;
      if (state === 'cached' || state === 'completed' || cachedBytes > 0) {
        return;
      }
      break;
    }
    throw new RemoteReadingGatewayError(
      'chapterNotDownloaded',
      'REMOTE_CHAPTER_NOT_DOWNLOADED',
      'cache.book.status',
    );
  }

  /** Prefer the Host's exact redirect/WebView completion URL for relative media. */
  private chapterResponseBaseUrl(data: JsonObject): string | undefined {
    const http = data['http'];
    if (http === null || typeof http !== 'object' || Array.isArray(http)) {
      return undefined;
    }
    return this.optionalString(http as JsonObject, 'finalUrl', 'chapter.content http');
  }

  async loadProgress(
    identityValue: RemoteReadingIdentity,
    isCurrent?: () => boolean,
  ): Promise<RemoteReadingProgressState> {
    const identity = createRemoteReadingIdentity(identityValue.sourceId, identityValue.bookId);
    const result = await this.request('reading.progress.get', {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
    }, isCurrent);
    const found = result.data['found'];
    if (typeof found !== 'boolean') {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reading.progress.get returned invalid found',
        'reading.progress.get',
      );
    }
    if (!found) {
      if (result.data['progress'] !== null) {
        throw new RemoteReadingGatewayError(
          'invalidResponse',
          'reading.progress.get returned progress for a missing current row',
          'reading.progress.get',
        );
      }
      return { kind: 'missing' };
    }
    return {
      kind: 'restored',
      progress: this.decodeProgress(result.data['progress'], identity, 'reading.progress.get'),
    };
  }

  async resolveLocation(
    identityValue: RemoteReadingIdentity,
    chapterTitle: string | undefined,
    anchor: RemoteReadingAnchor,
    layout: RemoteReadingLayout,
    isCurrent?: () => boolean,
  ): Promise<RemoteReadingResolvedLocation> {
    const identity = createRemoteReadingIdentity(identityValue.sourceId, identityValue.bookId);
    if (chapterTitle !== undefined && typeof chapterTitle !== 'string') {
      throw new RemoteReadingGatewayError('invalidInput', 'chapterTitle must be a string when provided');
    }
    this.assertChapterIndex(anchor.chapterIndex, 'anchor.chapterIndex');
    this.assertNonNegativeInteger(anchor.chapterOffset, 'anchor.chapterOffset');
    this.assertProgress(anchor.chapterProgress, 'anchor.chapterProgress');
    this.assertLayout(layout);
    const params: JsonObject = {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex: anchor.chapterIndex,
      anchor: {
        chapterOffset: anchor.chapterOffset,
        chapterProgress: anchor.chapterProgress,
      },
      layout: this.locationLayoutParams(layout),
    };
    if (chapterTitle !== undefined && chapterTitle.length > 0) {
      params['chapterTitle'] = chapterTitle;
    }
    const result = await this.request('reader.location.resolve', params, isCurrent);
    if (result.data['resolved'] !== true) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reader.location.resolve did not confirm resolution',
        'reader.location.resolve',
      );
    }
    const canonical = this.requireObject(
      result.data['canonicalLocation'],
      'reader.location.resolve canonicalLocation',
    );
    if (this.requireNonBlankString(canonical, 'bookId', 'reader.location.resolve canonicalLocation') !==
      identity.bookId) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        'reader.location.resolve returned a mismatched bookId',
        'reader.location.resolve',
      );
    }
    const chapterIndex = this.requireChapterIndex(
      canonical,
      'chapterIndex',
      'reader.location.resolve canonicalLocation',
    );
    const chapterOffset = this.requireNonNegativeInteger(
      canonical,
      'chapterOffset',
      'reader.location.resolve canonicalLocation',
    );
    const chapterProgress = this.requireProgress(
      canonical,
      'chapterProgress',
      'reader.location.resolve canonicalLocation',
    );
    if (chapterIndex !== anchor.chapterIndex || chapterOffset !== anchor.chapterOffset) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        'reader.location.resolve returned a different primary anchor',
        'reader.location.resolve',
      );
    }
    // Core owns the canonical location. Keep the layout-independent chapter
    // index and Unicode-scalar offset exact, but consume Core's bounded
    // progress fallback: an f64 JSON round trip may legitimately move its
    // final decimal digit even when the primary anchor is unchanged.
    return {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex,
      chapterOffset,
      chapterProgress,
      locationRevision: this.requireNonBlankString(
        canonical,
        'locationRevision',
        'reader.location.resolve canonicalLocation',
      ),
      resolverVersion: this.requireNonBlankString(result.data, 'resolverVersion', 'reader.location.resolve'),
      reflow: this.requireOffsetAnchorReflow(result.data['reflow']),
    };
  }

  async updateProgress(
    identityValue: RemoteReadingIdentity,
    update: RemoteReadingProgressUpdate,
    isCurrent?: () => boolean,
    sourceSwitchTransactionId?: string,
    resolution?: RemoteReadingAtomicResolution,
  ): Promise<RemoteReadingProgress> {
    const identity = createRemoteReadingIdentity(identityValue.sourceId, identityValue.bookId);
    this.assertChapterIndex(update.chapterIndex, 'update.chapterIndex');
    this.assertNonNegativeInteger(update.chapterOffset, 'update.chapterOffset');
    this.assertProgress(update.chapterProgress, 'update.chapterProgress');
    if (update.locationRevision !== undefined) {
      assertRemoteReadingNonBlankString(update.locationRevision, 'update.locationRevision');
    }
    if (resolution !== undefined) {
      this.assertChapterIndex(resolution.anchor.chapterIndex, 'resolution.anchor.chapterIndex');
      this.assertNonNegativeInteger(resolution.anchor.chapterOffset, 'resolution.anchor.chapterOffset');
      this.assertProgress(resolution.anchor.chapterProgress, 'resolution.anchor.chapterProgress');
      this.assertLayout(resolution.layout);
      if (resolution.anchor.chapterIndex !== update.chapterIndex ||
        resolution.anchor.chapterOffset !== update.chapterOffset ||
        resolution.anchor.chapterProgress !== update.chapterProgress) {
        throw new RemoteReadingGatewayError(
          'invalidInput',
          'atomic progress resolution must match the progress update anchor',
          'reading.progress.update',
        );
      }
    }
    if (sourceSwitchTransactionId !== undefined) {
      assertRemoteReadingNonBlankString(sourceSwitchTransactionId, 'sourceSwitchTransactionId');
      if (update.locationRevision === undefined && resolution === undefined) {
        throw new RemoteReadingGatewayError(
          'invalidResponse',
          'source switch finalization requires canonical locationRevision',
          'reading.progress.update',
        );
      }
    }
    const params: JsonObject = {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex: update.chapterIndex,
      chapterOffset: update.chapterOffset,
      chapterProgress: update.chapterProgress,
    };
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
    if (sourceSwitchTransactionId !== undefined) {
      params['transactionId'] = sourceSwitchTransactionId;
    }
    const result = await this.request('reading.progress.update', params, isCurrent);
    if (result.data['stored'] !== true) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reading.progress.update did not confirm storage',
        'reading.progress.update',
      );
    }
    const stored = this.decodeProgress(result.data, identity, 'reading.progress.update');
    if (resolution !== undefined && stored.locationRevision === undefined) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reading.progress.update did not resolve a canonical location',
        'reading.progress.update',
      );
    }
    if (stored.chapterIndex !== update.chapterIndex || stored.chapterOffset !== update.chapterOffset ||
      (update.locationRevision !== undefined && stored.locationRevision !== update.locationRevision)) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        'reading.progress.update retained a different current progress row',
        'reading.progress.update',
      );
    }
    if (sourceSwitchTransactionId !== undefined &&
      (result.data['transactionId'] !== sourceSwitchTransactionId ||
        result.data['sourceSwitchFinalized'] !== true)) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reading.progress.update did not atomically finalize the source switch',
        'reading.progress.update',
      );
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

  private async request(
    command: RemoteReadingCommand,
    params: JsonObject,
    isCurrent: (() => boolean) | undefined,
  ): Promise<ReaderCoreResultEvent> {
    try {
      return await this.runtimeOwner.request(command, params, this.requestOptions(isCurrent));
    } catch (error) {
      throw classifyRemoteReadingCommandFailure(command, error);
    }
  }

  private requestOptions(isCurrent: (() => boolean) | undefined): RequestOptions {
    return isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
  }

  private bookSeedParams(seed: RemoteReadingBookSeed, variables: RemoteReadingVariable[]): JsonObject {
    const book: JsonObject = {
      bookId: seed.bookId,
      title: seed.title,
      author: seed.author,
    };
    this.copyOptionalString(book, 'coverUrl', seed.coverUrl);
    this.copyOptionalString(book, 'intro', seed.intro);
    this.copyOptionalString(book, 'kind', seed.kind);
    this.copyOptionalString(book, 'lastChapter', seed.lastChapter);
    if (variables.length > 0) {
      book['variables'] = encodeRemoteReadingVariables(variables);
    }
    return book;
  }

  private decodeBookDetail(value: JsonObject): RemoteReadingBookDetail {
    const detail: RemoteReadingBookDetail = {
      title: this.requireNonBlankString(value, 'title', 'book.detail book'),
      author: this.requireString(value, 'author', 'book.detail book'),
    };
    const coverUrl = this.optionalString(value, 'coverUrl', 'book.detail book');
    const intro = this.optionalString(value, 'intro', 'book.detail book');
    const kind = this.optionalString(value, 'kind', 'book.detail book');
    const lastChapter = this.optionalString(value, 'lastChapter', 'book.detail book');
    if (coverUrl !== undefined) {
      detail.coverUrl = coverUrl;
    }
    if (intro !== undefined) {
      detail.intro = intro;
    }
    if (kind !== undefined) {
      detail.kind = kind;
    }
    if (lastChapter !== undefined) {
      detail.lastChapter = lastChapter;
    }
    return detail;
  }

  private decodeToc(value: unknown): RemoteReadingTocEntry[] {
    if (!Array.isArray(value)) {
      throw new RemoteReadingGatewayError('invalidResponse', 'book.toc returned invalid toc', 'book.toc');
    }
    const entries: RemoteReadingTocEntry[] = [];
    for (let position = 0; position < value.length; position += 1) {
      const raw = this.requireObject(value[position], 'book.toc entry');
      const index = this.requireChapterIndex(raw, 'index', 'book.toc entry');
      // Reader Runtime re-indexes a completed multi-page TOC contiguously.
      // Any other order is an unsafe response for page navigation.
      if (index !== position) {
        throw new RemoteReadingGatewayError(
          'invalidResponse',
          'book.toc returned a non-contiguous chapter index',
          'book.toc',
        );
      }
      entries.push({
        index,
        title: this.requireNonBlankString(raw, 'title', 'book.toc entry'),
        url: this.requireNonBlankString(raw, 'url', 'book.toc entry'),
        variables: decodeRemoteReadingVariables(raw['variables'], 'book.toc entry', true),
      });
    }
    return entries;
  }

  private decodeProgress(
    value: unknown,
    identity: RemoteReadingIdentity,
    command: 'reading.progress.get' | 'reading.progress.update',
  ): RemoteReadingProgress {
    const progress = this.requireObject(value, `${command} progress`);
    this.assertIdentity(progress, identity, command);
    const decoded: RemoteReadingProgress = {
      sourceId: identity.sourceId,
      bookId: identity.bookId,
      chapterIndex: this.requireChapterIndex(progress, 'chapterIndex', command),
      chapterOffset: this.requireNonNegativeInteger(progress, 'chapterOffset', command),
      chapterProgress: this.requireProgress(progress, 'chapterProgress', command),
      updatedAt: this.requireNonNegativeInteger(progress, 'updatedAt', command),
    };
    const revision = this.optionalString(progress, 'locationRevision', command);
    if (revision !== undefined) {
      decoded.locationRevision = revision;
    }
    return decoded;
  }

  private assertIdentity(value: JsonObject, identity: RemoteReadingIdentity, command: RemoteReadingCommand): void {
    if (value['sourceId'] !== identity.sourceId || value['bookId'] !== identity.bookId) {
      throw new RemoteReadingGatewayError(
        'identityMismatch',
        `${command} returned a mismatched composite key`,
        command,
      );
    }
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned a non-object value`);
    }
    return value as JsonObject;
  }

  private requireString(value: JsonObject, key: string, context: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonBlankString(value: JsonObject, key: string, context: string): string {
    const candidate = this.requireString(value, key, context);
    if (candidate.trim().length === 0) {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned blank ${key}`);
    }
    return candidate;
  }

  private optionalString(value: JsonObject, key: string, context: string): string | undefined {
    const candidate = value[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireNonNegativeInteger(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireChapterIndex(value: JsonObject, key: string, context: string): number {
    const candidate = this.requireNonNegativeInteger(value, key, context);
    if (candidate > 0x7fffffff) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        `${context} returned a chapter index unsupported by chapter.content`,
      );
    }
    return candidate;
  }

  private requireProgress(value: JsonObject, key: string, context: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
      throw new RemoteReadingGatewayError('invalidResponse', `${context} returned invalid ${key}`);
    }
    return candidate;
  }

  private requireOffsetAnchorReflow(value: unknown): RemoteReadingResolvedLocation['reflow'] {
    const reflow = this.requireObject(value, 'reader.location.resolve reflow');
    if (reflow['strategy'] !== 'offsetAnchor' || reflow['primaryAnchor'] !== 'chapterOffset' ||
      reflow['fallbackAnchor'] !== 'chapterProgress' || reflow['layoutIndependent'] !== true) {
      throw new RemoteReadingGatewayError(
        'invalidResponse',
        'reader.location.resolve returned an unsupported reflow rule',
        'reader.location.resolve',
      );
    }
    return {
      strategy: 'offsetAnchor',
      primaryAnchor: 'chapterOffset',
      fallbackAnchor: 'chapterProgress',
      layoutIndependent: true,
    };
  }

  private copyOptionalString(target: JsonObject, key: string, value: string | undefined): void {
    if (value === undefined) {
      return;
    }
    if (typeof value !== 'string') {
      throw new RemoteReadingGatewayError('invalidInput', `${key} must be a string when provided`);
    }
    target[key] = value;
  }

  private assertChapterIndex(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x7fffffff) {
      throw new RemoteReadingGatewayError('invalidInput', `${field} must be a non-negative int32`);
    }
  }

  private assertNonNegativeInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RemoteReadingGatewayError('invalidInput', `${field} must be a non-negative safe integer`);
    }
  }

  private assertProgress(value: number, field: string): void {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RemoteReadingGatewayError('invalidInput', `${field} must be between 0 and 1`);
    }
  }

  private assertLayout(layout: RemoteReadingLayout): void {
    this.assertPositiveUint32(layout.viewportWidth, 'layout.viewportWidth');
    this.assertPositiveUint32(layout.viewportHeight, 'layout.viewportHeight');
    if (!Number.isFinite(layout.fontScale) || layout.fontScale <= 0) {
      throw new RemoteReadingGatewayError('invalidInput', 'layout.fontScale must be positive and finite');
    }
    if (layout.lineHeight !== undefined && (!Number.isFinite(layout.lineHeight) || layout.lineHeight <= 0)) {
      throw new RemoteReadingGatewayError('invalidInput', 'layout.lineHeight must be positive and finite');
    }
    if (layout.pageCount !== undefined) {
      this.assertPositiveUint32(layout.pageCount, 'layout.pageCount');
    }
    if (layout.pageIndex !== undefined) {
      this.assertNonNegativeUint32(layout.pageIndex, 'layout.pageIndex');
      if (layout.pageCount !== undefined && layout.pageIndex >= layout.pageCount) {
        throw new RemoteReadingGatewayError('invalidInput', 'layout.pageIndex must be below layout.pageCount');
      }
    }
  }

  private locationLayoutParams(layout: RemoteReadingLayout): JsonObject {
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

  private assertPositiveUint32(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 0xffffffff) {
      throw new RemoteReadingGatewayError('invalidInput', `${field} must be a positive uint32`);
    }
  }

  private assertNonNegativeUint32(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new RemoteReadingGatewayError('invalidInput', `${field} must be a non-negative uint32`);
    }
  }
}
