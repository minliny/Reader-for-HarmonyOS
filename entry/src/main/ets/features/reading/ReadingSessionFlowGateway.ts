import { captureRemotePositionContext, decodeRemotePositionScope, type RemoteReadingPositionScope, type RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import { diagnosticCodeOf } from '../../app/LogPrivacy';
import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import {
  LocalReadingFlowGateway,
  type LocalReadingAnchor,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingProgressUpdate,
  type LocalReadingResolvedLocation,
  type LocalReadingToc,
} from './LocalReadingFlowGateway';
import {
  RemoteReadingFlowGateway,
  type RemoteReadingSession,
} from './RemoteReadingFlowGateway';
import type { ReadingSessionChapter, ReadingSessionImage } from './ReadingChapterWindow';
import { materializeReadingDocument } from './ReadingDocumentProjection';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { image } from '@kit.ImageKit';
import { preparedRemoteChapterMatches, preparedRemoteChapterPositionMatches } from './RemoteReadingEvidence';

/**
 * The source-specific acquisition state admitted into one reader instance.
 * Remote URL/rule variables remain inside the already-opened remote session;
 * the renderer only sees this discriminant through the gateway below.
 */
export type ReadingSessionSource =
  | { kind: 'local' }
  | { kind: 'remote'; session: RemoteReadingSession };

/**
 * One literal occurrence in Core's source-scoped chapter cache. Both local
 * and remote reading sessions use this DTO. Search covers every currently
 * materialized chapter occurrence and never changes acquisition state.
 */
export type ReadingContentSearchResult = {
  positionScope?: RemoteReadingPositionScope;
  sourceId: string;
  bookId: string;
  bookName: string;
  chapterIndex: number;
  chapterOffset: number;
  matchLength: number;
  snippetStart: number;
  chapterTitle: string;
  snippet: string;
};

/** One bounded page of source-scoped cached-content matches. */
export type ReadingContentSearchPage = {
  results: ReadingContentSearchResult[];
  offset: number;
  limit: number;
  hasMore: boolean;
};

/**
 * One execution boundary for the shared pagination/reader component.
 *
 * It is deliberately an adapter, not a second orchestration framework: local
 * and remote keep their typed Core gateways, while this class normalizes only
 * the values the renderer actually consumes.
 */
export class ReadingSessionFlowGateway {
  private readonly sourceId: string;
  private readonly bookId: string;
  private readonly source: ReadingSessionSource;
  private readonly runtimeOwner: ReadingGatewayRuntime;
  private readonly local: LocalReadingFlowGateway;
  private readonly remote: RemoteReadingFlowGateway;
  private sourceSwitchTransactionId: string | undefined;
  private preparedChapterConsumed: boolean = false;

  constructor(
    sourceId: string,
    bookId: string,
    source: ReadingSessionSource,
    runtimeOwner: ReadingGatewayRuntime,
    sourceSwitchTransactionId: string | undefined = undefined,
  ) {
    requireNonBlank(sourceId, 'sourceId');
    requireNonBlank(bookId, 'bookId');
    if ((source.kind === 'local') !== (sourceId === 'local')) {
      throw new Error('reading session source kind does not match sourceId');
    }
    if (source.kind === 'remote' &&
      (source.session.identity.sourceId !== sourceId || source.session.identity.bookId !== bookId)) {
      throw new Error('remote reading session identity mismatch');
    }
    if (sourceSwitchTransactionId !== undefined) {
      requireNonBlank(sourceSwitchTransactionId, 'sourceSwitchTransactionId');
      if (source.kind !== 'remote') {
        throw new Error('local reading session cannot finalize a source switch');
      }
    }
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.source = source;
    this.runtimeOwner = runtimeOwner;
    this.local = new LocalReadingFlowGateway(runtimeOwner);
    this.remote = new RemoteReadingFlowGateway(runtimeOwner);
    this.sourceSwitchTransactionId = sourceSwitchTransactionId;
  }

  supportsExactContentMetrics(): boolean {
    return this.source.kind === 'local';
  }

  supportsContentSearch(): boolean {
    return true;
  }

  async loadToc(bookId: string, isCurrent?: () => boolean): Promise<LocalReadingToc> {
    this.assertBook(bookId);
    if (this.source.kind === 'local') {
      return this.local.loadToc(bookId, isCurrent);
    }
    const entries = await this.remote.loadCachedTocProjection(this.source.session, isCurrent);
    return {
      bookId,
      entries: entries.map((entry) => ({
        index: entry.index,
        title: entry.title,
        downloadState: 'unknown',
      })),
    };
  }

  async loadProgress(bookId: string, isCurrent?: () => boolean): Promise<LocalReadingProgressState> {
    this.assertBook(bookId);
    if (this.source.kind === 'local') {
      return this.local.loadProgress(bookId, isCurrent);
    }
    const state = await this.remote.loadProgress(this.source.session.identity, isCurrent);
    if (state.kind === 'missing') {
      return state;
    }
    return {
      kind: 'restored',
      progress: {
        bookId: state.progress.bookId,
        chapterIndex: state.progress.chapterIndex,
        chapterOffset: state.progress.chapterOffset,
        chapterProgress: state.progress.chapterProgress,
        updatedAt: state.progress.updatedAt,
        locationRevision: state.progress.locationRevision,
        ...(state.progress.bodyVersion === undefined ? {} : { bodyVersion: state.progress.bodyVersion, processingVersion: state.progress.processingVersion }),
      },
    };
  }

  async loadContentMetrics(
    bookId: string,
    isCurrent?: () => boolean,
  ): Promise<LocalReadingContentMetrics | undefined> {
    this.assertBook(bookId);
    if (this.source.kind === 'remote') {
      return undefined;
    }
    return this.local.loadContentMetrics(bookId, isCurrent);
  }

  async loadChapter(
    bookId: string,
    chapterIndex: number,
    isCurrent?: () => boolean,
    forceRefresh: boolean = false,
    positionContext?: RemoteReadingPositionContext,
  ): Promise<ReadingSessionChapter> {
    this.assertBook(bookId);
    if (this.source.kind === 'remote') {
      positionContext = captureRemotePositionContext(positionContext);
      const session = this.source.session;
      const prepared = session.preparedChapter;
      const coordinator = this.runtimeOwner.bookAcquisitions?.();
      if (!forceRefresh && !this.preparedChapterConsumed && prepared !== undefined &&
        preparedRemoteChapterPositionMatches(prepared, positionContext) &&
        preparedRemoteChapterMatches(prepared, session, chapterIndex, coordinator?.readingProjectionRevision() ?? 0)) {
        const version = coordinator === undefined ? session.sourceVersion : await coordinator.currentSourceVersion(this.sourceId);
        if (isCurrent?.() === false) throw new Error('reading chapter request was cancelled');
        if (version === session.sourceVersion && preparedRemoteChapterPositionMatches(prepared, positionContext) &&
          preparedRemoteChapterMatches(prepared, session, chapterIndex, coordinator?.readingProjectionRevision() ?? 0)) {
          this.preparedChapterConsumed = true;
          return prepared.chapter;
        }
      }
      let chapter: ReadingSessionChapter;
      if (forceRefresh) {
        // Refresh atomically replaces body AND positions in Core. Wait for
        // earlier dispatched progress writes before capturing its snapshot,
        // and keep later writes behind the whole HTTP/publication operation.
        let refreshed: ReadingSessionChapter | undefined;
        await this.remote.runProgressCommitSerial(async (): Promise<void> => {
          refreshed = await this.remote.loadChapter(this.source.session, chapterIndex, isCurrent, true, positionContext);
        });
        if (refreshed === undefined) throw new Error('reading refresh returned no chapter');
        chapter = refreshed;
      } else {
        chapter = await this.remote.loadChapter(this.source.session, chapterIndex, isCurrent, false, positionContext);
      }
      if (prepared?.chapter.chapterIndex === chapterIndex) this.preparedChapterConsumed = true;
      return chapter;
    }
    const chapter = await this.local.loadChapter(bookId, chapterIndex, isCurrent);
    const documentData: JsonObject = { content: chapter.content };
    if (chapter.blocks !== undefined) {
      documentData['blocks'] = chapter.blocks;
    }
    const document = await materializeReadingDocument(
      documentData,
      this.sourceId,
      undefined,
      this.runtimeOwner,
      isCurrent,
    );
    return {
      sourceId: this.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle,
      chapterUrl: undefined,
      content: document.content,
      images: document.images,
      contentVersion: document.contentVersion,
      extractionVia: 'local',
    };
  }

  /**
   * Resolve only the image pagination has reached. A resource failure is a
   * stable failed block, not a failed chapter; stale requests still cancel.
   */
  async resolveReadingImage(
    chapter: ReadingSessionChapter,
    image: ReadingSessionImage,
    isCurrent?: () => boolean,
  ): Promise<ReadingSessionImage> {
    if (chapter.sourceId !== this.sourceId || chapter.bookId !== this.bookId) {
      throw new Error('reading image chapter identity mismatch');
    }
    if (image.state !== 'pending') {
      return image;
    }
    if (this.runtimeOwner.loadReadingImage === undefined) {
      return this.failedReadingImage(image);
    }
    try {
      const payload = await this.runtimeOwner.loadReadingImage(
        this.sourceId,
        this.bookId,
        chapter.chapterIndex,
        chapter.contentVersion,
        image.source,
        image.baseUrl,
        this.source.kind !== 'remote' || this.source.session.acquisitionMode !== 'offline',
        isCurrent,
      );
      if (isCurrent !== undefined && !isCurrent()) {
        this.runtimeOwner.releaseReadingImage?.(payload.fileUri, payload.pixelMap);
        throw new Error('reading body image request was cancelled');
      }
      return {
        source: image.source,
        baseUrl: image.baseUrl,
        startScalar: image.startScalar,
        endScalar: image.endScalar,
        state: 'ready',
        pixelMap: payload.pixelMap,
        fileUri: payload.fileUri,
        intrinsicWidth: payload.width,
        intrinsicHeight: payload.height,
        revision: payload.revision,
      };
    } catch (error) {
      if (isCurrent !== undefined && !isCurrent()) {
        throw error;
      }
      console.error(`reading image resolve failed: ${diagnosticCodeOf(errorMessageOf(error))}`);
      return this.failedReadingImage(image);
    }
  }

  releaseReadingImage(fileUri: string, pixelMap?: image.PixelMap): void {
    this.runtimeOwner.releaseReadingImage?.(fileUri, pixelMap);
  }

  async resolveLocation(
    bookId: string,
    chapterTitle: string | undefined,
    anchor: LocalReadingAnchor,
    layout: LocalReadingLayout,
    isCurrent?: () => boolean,
  ): Promise<LocalReadingResolvedLocation> {
    this.assertBook(bookId);
    if (this.source.kind === 'local') {
      return this.local.resolveLocation(bookId, chapterTitle, anchor, layout, isCurrent);
    }
    return this.remote.resolveLocation(
      this.source.session.identity,
      chapterTitle,
      anchor,
      layout,
      isCurrent,
    );
  }

  async updateProgress(
    bookId: string,
    update: LocalReadingProgressUpdate,
    isCurrent?: () => boolean,
  ): Promise<LocalReadingProgress> {
    this.assertBook(bookId);
    if (this.source.kind === 'local') {
      return this.local.updateProgress(bookId, update, isCurrent);
    }
    const transactionId = this.sourceSwitchTransactionId;
    const stored = await this.remote.updateProgress(
      this.source.session.identity,
      update,
      isCurrent,
      transactionId,
    );
    if (transactionId !== undefined) {
      this.sourceSwitchTransactionId = undefined;
    }
    return {
      bookId: stored.bookId,
      chapterIndex: stored.chapterIndex,
      chapterOffset: stored.chapterOffset,
      chapterProgress: stored.chapterProgress,
      updatedAt: stored.updatedAt,
      locationRevision: stored.locationRevision,
      ...(stored.bodyVersion === undefined ? {} : { bodyVersion: stored.bodyVersion, processingVersion: stored.processingVersion }),
    };
  }

  async resolveAndUpdateProgress(
    bookId: string,
    chapterTitle: string | undefined,
    anchor: LocalReadingAnchor,
    layout: LocalReadingLayout,
    isCurrent?: () => boolean,
  ): Promise<LocalReadingProgress> {
    this.assertBook(bookId);
    const update: LocalReadingProgressUpdate = {
      chapterIndex: anchor.chapterIndex,
      chapterOffset: anchor.chapterOffset,
      chapterProgress: anchor.chapterProgress,
      expectedBodyVersion: anchor.bodyVersion, expectedProcessingVersion: anchor.processingVersion,
    };
    const resolution = { chapterTitle, anchor, layout };
    if (this.source.kind === 'local') {
      return this.local.updateProgress(bookId, update, isCurrent, resolution);
    }
    const transactionId = this.sourceSwitchTransactionId;
    const stored = await this.remote.updateProgress(
      this.source.session.identity,
      update,
      isCurrent,
      transactionId,
      resolution,
    );
    if (transactionId !== undefined) {
      this.sourceSwitchTransactionId = undefined;
    }
    return {
      bookId: stored.bookId,
      chapterIndex: stored.chapterIndex,
      chapterOffset: stored.chapterOffset,
      chapterProgress: stored.chapterProgress,
      updatedAt: stored.updatedAt,
      locationRevision: stored.locationRevision,
      ...(stored.bodyVersion === undefined ? {} : { bodyVersion: stored.bodyVersion, processingVersion: stored.processingVersion }),
    };
  }

  async searchContent(
    bookId: string,
    keyword: string,
    limit: number,
    isCurrent?: () => boolean,
  ): Promise<ReadingContentSearchResult[]> {
    const page = await this.searchContentPage(bookId, keyword, limit, 0, isCurrent);
    return page.results;
  }

  async searchContentPage(
    bookId: string,
    keyword: string,
    limit: number,
    offset: number = 0,
    isCurrent?: () => boolean,
  ): Promise<ReadingContentSearchPage> {
    this.assertBook(bookId);
    requireNonBlank(keyword, 'keyword');
    requireNonNegativeInteger(limit, 'limit');
    requireNonNegativeInteger(offset, 'offset');
    const params: JsonObject = {
      keyword: keyword.trim(),
      sourceId: this.sourceId,
      bookId: this.bookId,
      maxResults: limit,
    };
    // Keep the legacy first-page wire shape byte-for-byte compatible while
    // making subsequent pages explicit and independently cancellable.
    if (offset > 0) params['offset'] = offset;
    const result = await this.runtimeOwner.request('search.content', params,
      isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() });
    const rawResults = result.data['results'];
    if (!Array.isArray(rawResults)) {
      throw new Error('search.content returned invalid results');
    }
    const matches: ReadingContentSearchResult[] = [];
    for (const rawMatch of rawResults) {
      const match = requireObject(rawMatch, 'search.content result');
      if (match['sourceId'] !== this.sourceId || match['bookId'] !== this.bookId) {
        throw new Error('search.content returned a mismatched reading identity');
      }
      const positionScope = decodeRemotePositionScope(match['positionScope']);
      if (positionScope !== undefined && (positionScope.sourceId !== this.sourceId || positionScope.bookId !== this.bookId ||
        positionScope.chapterIndex !== match['chapterIndex'])) throw new Error('search.content returned a mismatched position scope');
      matches.push({
        ...(positionScope === undefined ? {} : { positionScope }),
        sourceId: this.sourceId,
        bookId: this.bookId,
        bookName: requireString(match, 'bookName', 'search.content result'),
        chapterIndex: requireNonNegativeIntegerValue(match, 'chapterIndex', 'search.content result'),
        chapterOffset: requireNonNegativeIntegerValue(match, 'chapterOffset', 'search.content result'),
        matchLength: requireNonNegativeIntegerValue(match, 'matchLength', 'search.content result'),
        snippetStart: requireNonNegativeIntegerValue(match, 'snippetStart', 'search.content result'),
        chapterTitle: requireString(match, 'chapterTitle', 'search.content result'),
        snippet: requireString(match, 'snippet', 'search.content result'),
      });
    }
    const rawHasMore = result.data['hasMore'];
    if (rawHasMore !== undefined && typeof rawHasMore !== 'boolean') {
      throw new Error('search.content returned invalid hasMore');
    }
    return { results: matches, offset, limit, hasMore: rawHasMore === true };
  }

  async runProgressCommitSerial(operation: () => Promise<void>): Promise<void> {
    if (this.source.kind === 'local') {
      return this.local.runProgressCommitSerial(operation);
    }
    return this.remote.runProgressCommitSerial(operation);
  }

  private assertBook(bookId: string): void {
    if (bookId !== this.bookId) {
      throw new Error('reading session book identity mismatch');
    }
  }

  private failedReadingImage(image: ReadingSessionImage): ReadingSessionImage {
    return {
      source: image.source,
      baseUrl: image.baseUrl,
      startScalar: image.startScalar,
      endScalar: image.endScalar,
      state: 'failed',
      pixelMap: undefined,
      fileUri: '',
      intrinsicWidth: 0,
      intrinsicHeight: 0,
      revision: 'body-image-failed-v1',
    };
  }
}

function requireNonBlank(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be non-blank`);
  }
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
}

function requireObject(value: unknown, context: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} returned a non-object value`);
  }
  return value as JsonObject;
}

function requireString(value: JsonObject, key: string, context: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string') {
    throw new Error(`${context} returned invalid ${key}`);
  }
  return candidate;
}

function requireNonNegativeIntegerValue(value: JsonObject, key: string, context: string): number {
  const candidate = value[key];
  if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
    throw new Error(`${context} returned invalid ${key}`);
  }
  return candidate;
}
