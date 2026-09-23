import { readingChapterLayoutMap, prepareReadingChapterLayoutMap } from './ReadingSurfaceLayoutMap';
import type { ReadingParagraphBoundaryMode } from './ReadingParagraphProjection';
import { readingSessionDocuments } from './ReadingSessionDocuments';
import { extendReadingParagraphWindow, readReadingDocumentWindow, type ReadingDocumentWindow, type ReadingParagraphWindowDirection } from './ReadingDocumentWindow';
import type { BookRequestPriority } from '../../app/BookRequestScheduler';
import { readReadingCatalog, readReadingEntrySnapshot, qualifyReadingEntryWindow, type ReadingEntrySnapshot } from './ReadingEntrySnapshot';
import { captureRemotePositionContext, encodeRemotePositionContext, decodeRemotePositionMigration, decodeRemotePositionScope, type RemoteReadingPositionScope, type RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import { diagnosticCodeOf } from '../../app/LogPrivacy';
import type { JsonObject, RequestOptions, ReaderCoreResultEvent } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import {
  LocalReadingFlowGateway,
  type LocalReadingAnchor,
  type LocalReadingChapter,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingProgressUpdate,
  type LocalReadingResolvedLocation,
  type LocalReadingToc,
  type LocalReadingTocEntry,
} from './LocalReadingFlowGateway';
import {
  RemoteReadingFlowGateway,
  type RemoteReadingSession,
  type RemoteReadingBookSeed,
} from './RemoteReadingFlowGateway';
import { hasKnownReadingImageGeometry, type ReadingSessionChapter, type ReadingSessionImage } from './ReadingChapterWindow';
import { materializeReadingDocument } from './ReadingDocumentProjection';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { readingSessionProgressOwner, ReadingSessionProgressOwner, type ReadingSessionProgressAccess } from './ReadingSessionProgressOwner';
import type { image } from '@kit.ImageKit';
import { preparedRemoteChapterMatches, preparedRemoteChapterPositionMatches } from './RemoteReadingEvidence';
import { classifyRemoteReadingCommandFailure } from './RemoteReadingContract';

/**
 * The source-specific acquisition state admitted into one reader instance.
 * Remote URL/rule variables remain inside the already-opened remote session;
 * the renderer only sees this discriminant through the gateway below.
 */
export type ReadingSessionSource =
  | { kind: 'local' }
  | { kind: 'remote'; session?: RemoteReadingSession; seed?: RemoteReadingBookSeed;
      onSessionReady?: (session: RemoteReadingSession) => void };

export interface ReadingSessionOpenIntent {
  sourceId: string;
  bookId: string;
  remoteSession?: RemoteReadingSession;
  remoteBookSeed?: RemoteReadingBookSeed;
  /** Prepared body reuse bypasses the cold snapshot's atomic pending check. */
  hasPreparedEntry?: boolean;
  sourceSwitchTransactionId?: string;
  isCurrent: () => boolean;
  resolveSourceSwitchTransactionId: (sourceId: string, bookId: string) => Promise<string | undefined>;
  onRemoteSessionReady: (session: RemoteReadingSession) => void;
}

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
  nextCursor?: string;
};

/**
 * One execution boundary for the shared pagination/reader component.
 *
 * It is deliberately an adapter, not a second orchestration framework: local
 * and remote keep their typed Core gateways, while this class normalizes only
 * the values the renderer actually consumes.
 */
export class ReadingSessionFlowGateway {
  /** Mount first; acquisition and transaction admission belong to this flow.
   * Every awaited result checks the same selection/lifecycle intent before it
   * can publish a remote session or install a gateway in the visible reader.
   */
  static async open(intent: ReadingSessionOpenIntent, runtime: ReadingGatewayRuntime): Promise<ReadingSessionFlowGateway | undefined> {
    if (!intent.isCurrent()) return undefined;
    let source: ReadingSessionSource;
    if (intent.sourceId === 'local') {
      if (intent.remoteSession !== undefined) throw new Error('local reading session must not carry remote acquisition state');
      source = { kind: 'local' };
    } else {
      let session = intent.remoteSession;
      if (session === undefined) {
        const seed = intent.remoteBookSeed;
        if (seed === undefined || seed.sourceId !== intent.sourceId || seed.bookId !== intent.bookId)
          throw new Error('READING_SESSION_IDENTITY_UNAVAILABLE');
        if (runtime.supportsCoreCapability?.('reading.entry.snapshot.v1') !== true) {
          const acquisition = runtime.bookAcquisitions?.();
          if (acquisition === undefined) throw new Error('READING_SESSION_ACQUISITION_UNAVAILABLE');
          const admission = await acquisition.acquireBookWithBackgroundRefresh(seed, { isCurrent: intent.isCurrent });
          if (!intent.isCurrent()) return undefined;
          session = admission.session;
        }
      }
      if (session !== undefined && (session.identity.sourceId !== intent.sourceId || session.identity.bookId !== intent.bookId))
        throw new Error('READING_SESSION_IDENTITY_MISMATCH');
      source = { kind: 'remote', session, seed: intent.remoteBookSeed, onSessionReady: intent.onRemoteSessionReady };
      if (session !== undefined) intent.onRemoteSessionReady(session);
      if (!intent.isCurrent()) return undefined;
    }
    const deferTransaction = source.kind === 'remote' && intent.hasPreparedEntry !== true &&
      intent.sourceSwitchTransactionId === undefined &&
      runtime.supportsCoreCapability?.('reading.entry.snapshot.v1') === true;
    const transactionId = intent.sourceSwitchTransactionId ?? (source.kind === 'local' || deferTransaction ? undefined :
      await intent.resolveSourceSwitchTransactionId(intent.sourceId, intent.bookId));
    if (!intent.isCurrent()) return undefined;
    const gateway = new ReadingSessionFlowGateway(intent.sourceId, intent.bookId, source, runtime, transactionId);
    if (deferTransaction) gateway.pendingSourceSwitchResolver = async (): Promise<string | undefined> => {
      if (!intent.isCurrent()) throw new Error('reading source-switch admission cancelled');
      const resolved = await intent.resolveSourceSwitchTransactionId(intent.sourceId, intent.bookId);
      if (!intent.isCurrent()) throw new Error('reading source-switch admission cancelled');
      return resolved;
    };
    return gateway;
  }

  private readonly sourceId: string;
  private readonly bookId: string;
  private readonly source: ReadingSessionSource;
  private readonly runtimeOwner: ReadingGatewayRuntime;
  private readonly local: LocalReadingFlowGateway;
  private readonly remote: RemoteReadingFlowGateway;
  private sourceSwitchTransactionId: string | undefined;
  private pendingSourceSwitchResolver: (() => Promise<string | undefined>) | undefined;
  private sourceSwitchResolution: Promise<string | undefined> | undefined;
  private preparedChapterConsumed: boolean = false;
  private progressOwner: ReadingSessionProgressOwner;
  private retainedEntrySnapshot: ReadingEntrySnapshot | undefined;

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
    if (source.kind === 'remote' && source.session !== undefined &&
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
    // The existing serial lane retains only the small local gateway (runtime +
    // promise tail), never this session's catalog, prepared body or images.
    const lane = this.local;
    this.progressOwner = readingSessionProgressOwner(runtimeOwner, sourceId, bookId,
      (operation: () => Promise<void>): Promise<void> => lane.runProgressCommitSerial(operation));
  }

  /** A cached document is usable before an optional remote fetch session exists. */
  async loadEntrySnapshot(chapterIndex: number | undefined, isCurrent: () => boolean,
    positionContext?: RemoteReadingPositionContext, windowMode?: ReadingParagraphBoundaryMode): Promise<ReadingEntrySnapshot | undefined> {
    if (this.hasPendingSourceSwitch()) return undefined;
    let snapshot = await readReadingEntrySnapshot(this.runtimeOwner, this.sourceId, this.bookId,
      chapterIndex, isCurrent, positionContext, windowMode === undefined ? undefined : 8192);
    if (snapshot === undefined) {
      // Missing includes sourceSwitchPending. Resolve the original transaction
      // before any catalog/session fallback can select or persist its target.
      await this.ensureSourceSwitchAdmission(isCurrent);
      return undefined;
    }
    if (snapshot.chapter.sourceCorrectionRequired === true) {
      if (this.runtimeOwner.allowSourceContentCorrection === false) return undefined;
      snapshot = await this.repairEntrySourceCorrection(snapshot, isCurrent, positionContext,
        windowMode === undefined ? undefined : 8192);
    }
    if (snapshot !== undefined && windowMode !== undefined) {
      const qualified = qualifyReadingEntryWindow(snapshot, windowMode);
      if (qualified === undefined) {
        const original = snapshot;
        // A giant paragraph needs its original context, not a second whole
        // chapter RPC. Keep entry progress/navigation from the one snapshot.
        const chapter = await extendReadingParagraphWindow(this.runtimeOwner, original.chapter,
          original.requestedScalar ?? 0, 'after', windowMode,
          (): boolean => original.isCurrent() && isCurrent() && !this.hasPendingSourceSwitch(), false);
        snapshot = { ...original, chapter };
      } else snapshot = qualified;
    }
    if (snapshot !== undefined && snapshot.isCurrent() && isCurrent()) {
      // Core checked this exact book's pending transaction in the same entry
      // snapshot. Its mutation/selection guard is the admission proof; no
      // preceding whole pending-list RPC is needed for this ordinary entry.
      this.pendingSourceSwitchResolver = undefined;
      this.retainedEntrySnapshot = snapshot;
      const navigation = snapshot.navigation;
      this.configureDocuments(navigation === undefined ?
        [{ index: snapshot.chapter.chapterIndex, title: snapshot.chapter.chapterTitle, downloadState: 'unknown', navigable: true }] :
        [...navigation.before, navigation.current, ...navigation.after]);
      readingSessionDocuments(this.runtimeOwner).admit(snapshot.chapter, true);
    }
    return snapshot;
  }

  private async repairEntrySourceCorrection(snapshot: ReadingEntrySnapshot, isCurrent: () => boolean,
    positionContext?: RemoteReadingPositionContext, windowScalarLimit?: number): Promise<ReadingEntrySnapshot> {
    const chapter = snapshot.chapter;
    if (chapter.bodyVersion === undefined || chapter.processingVersion === undefined)
      throw new Error('source correction requires the original content scope');
    const captured = captureRemotePositionContext(positionContext) ?? {
      bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion, anchors: [] };
    let repaired: JsonObject | undefined;
    // A source correction has no HTTP input. Earlier progress writes finish
    // before Core captures all durable positions; later writes use the receipt.
    await this.runProgressCommitSerial(async (): Promise<void> => {
      if (!isCurrent()) throw new Error('source correction was cancelled');
      const result = await this.runtimeOwner.request('chapter.content', {
        sourceId: this.sourceId, bookId: this.bookId, chapterIndex: chapter.chapterIndex,
        upgradeCachedContent: true, positionContext: encodeRemotePositionContext(captured),
      }, { shouldCancel: (): boolean => !isCurrent() });
      repaired = result.data;
    });
    if (!isCurrent() || repaired === undefined) throw new Error('source correction was cancelled');
    const data: JsonObject = repaired;
    if (data['sourceId'] !== this.sourceId || data['bookId'] !== this.bookId ||
      typeof data['bodyVersion'] !== 'string' || typeof data['processingVersion'] !== 'string')
      throw new Error('source correction identity mismatch');
    const bodyVersion = data['bodyVersion'] as string, processingVersion = data['processingVersion'] as string;
    const migration = decodeRemotePositionMigration(data['positionMigration'], this.sourceId, this.bookId,
      bodyVersion, processingVersion, captured);
    const nextContext: RemoteReadingPositionContext | undefined = positionContext === undefined ? undefined : {
      bodyVersion, processingVersion, anchors: migration?.anchors.map((anchor) => ({ id: anchor.id, offset: anchor.offset })) ?? captured.anchors };
    const fresh = await readReadingEntrySnapshot(this.runtimeOwner, this.sourceId, this.bookId,
      chapter.chapterIndex, isCurrent, nextContext, windowScalarLimit);
    if (fresh === undefined || fresh.chapter.sourceCorrectionRequired === true ||
      fresh.chapter.bodyVersion !== bodyVersion || fresh.chapter.processingVersion !== processingVersion)
      throw new Error('source correction publication changed before display');
    return { ...fresh, chapter: { ...fresh.chapter, positionMigration: migration } };
  }

  private entryPositionMatches(chapter: ReadingSessionChapter, context?: RemoteReadingPositionContext): boolean {
    if (context === undefined) return true;
    try {
      decodeRemotePositionMigration(chapter.positionMigration, this.sourceId, this.bookId,
        chapter.bodyVersion, chapter.processingVersion, context);
      return true;
    } catch (_) { return false; }
  }

  private async ensureSourceSwitchAdmission(isCurrent?: () => boolean): Promise<void> {
    if (isCurrent?.() === false) throw new Error('reading source-switch admission cancelled');
    const resolver = this.pendingSourceSwitchResolver;
    if (resolver === undefined) return;
    const operation = this.sourceSwitchResolution ?? resolver();
    this.sourceSwitchResolution = operation;
    try {
      const transactionId = await operation;
      if (isCurrent?.() === false) throw new Error('reading source-switch admission cancelled');
      if (this.pendingSourceSwitchResolver === resolver) {
        if (transactionId !== undefined) requireNonBlank(transactionId, 'sourceSwitchTransactionId');
        this.sourceSwitchTransactionId = transactionId;
        this.pendingSourceSwitchResolver = undefined;
      }
    } finally {
      if (this.sourceSwitchResolution === operation) this.sourceSwitchResolution = undefined;
    }
  }

  captureEntryContentValidity(): () => boolean {
    return this.runtimeOwner.captureReadingContentValidity?.(this.sourceId, this.bookId) ?? ((): boolean => true);
  }

  /** The caller has synchronously validated the dedicated Core read receipt.
   * No catalog, source-switch query or acquisition is dispatched here. */
  admitPreparedEntry(snapshot: ReadingEntrySnapshot): void {
    if (!snapshot.isCurrent() || snapshot.chapter.sourceId !== this.sourceId || snapshot.chapter.bookId !== this.bookId ||
      this.hasPendingSourceSwitch()) throw new Error('READING_PREPARED_ENTRY_IDENTITY_MISMATCH');
    this.retainedEntrySnapshot = snapshot;
    const navigation = snapshot.navigation;
    this.configureDocuments(navigation === undefined ?
      [{ index: snapshot.chapter.chapterIndex, title: snapshot.chapter.chapterTitle, downloadState: 'unknown', navigable: true }] :
      [...navigation.before, navigation.current, ...navigation.after]);
    readingSessionDocuments(this.runtimeOwner).admit(snapshot.chapter, true);
  }

  /** Expand an admitted entry without acquisition or a second position read
   * becoming authoritative. The source mutation and chapter versions must
   * still match; a late expansion can never replace a newer selection. */
  async completeEntryChapter(chapter: ReadingSessionChapter, isCurrent: () => boolean,
    priority: BookRequestPriority = 'foreground'): Promise<ReadingSessionChapter> {
    this.assertBook(chapter.bookId);
    if (chapter.sourceId !== this.sourceId || !isCurrent() || this.hasPendingSourceSwitch())
      throw new Error('reading entry expansion was cancelled');
    if (chapter.documentRange === undefined) return chapter;
    if (chapter.bodyVersion === undefined || chapter.processingVersion === undefined)
      throw new Error('reading entry expansion scope is missing');
    const runtime = this.runtimeOwner, coordinator = runtime.bookAcquisitions?.();
    const projection: ReadingGatewayRuntime = {
      supportsCoreCapability: (capability: string): boolean => runtime.supportsCoreCapability?.(capability) === true,
      captureReadingContentValidity: (source: string, book: string): (() => boolean) =>
        runtime.captureReadingContentValidity?.(source, book) ?? ((): boolean => true),
      request: (method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> =>
        coordinator === undefined ? runtime.request(method, params, options) :
          coordinator.request(method, params, { ...options, canContinue: isCurrent }, priority),
    };
    const snapshot = await readReadingEntrySnapshot(projection, this.sourceId, this.bookId,
      chapter.chapterIndex, isCurrent, { bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
        anchors: [{ id: 'entry', offset: chapter.documentRange.startScalar }] });
    if (snapshot === undefined || !snapshot.isCurrent() || !isCurrent()) throw new Error('reading entry expansion unavailable');
    if (snapshot.chapter.bodyVersion !== chapter.bodyVersion || snapshot.chapter.processingVersion !== chapter.processingVersion)
      throw new Error('reading entry expansion scope changed');
    const full = snapshot.chapter;
    const map = await prepareReadingChapterLayoutMap(full, (): boolean => snapshot.isCurrent() && isCurrent());
    const range = chapter.documentRange;
    if (map.scalarCount() !== range.totalScalars ||
      map.sliceByScalar(range.startScalar, range.endScalar) !== chapter.content)
      throw new Error('reading entry expansion range changed');
    if (full.contentVersion !== chapter.contentVersion) throw new Error('reading entry expansion identity changed');
    readingSessionDocuments(this.runtimeOwner).admit(full, true);
    return full;
  }

  /** Mounted UI owns this observer; a retained session must not retain an old page. */
  observeRemoteSession(observer: (session: RemoteReadingSession) => void): () => void {
    if (this.source.kind !== 'remote') return (): void => {};
    const source = this.source;
    source.onSessionReady = observer;
    return (): void => { if (source.onSessionReady === observer) source.onSessionReady = undefined; };
  }

  async ensureRemoteSession(isCurrent?: () => boolean,
    priority: BookRequestPriority = 'foreground'): Promise<RemoteReadingSession> {
    if (this.source.kind !== 'remote') throw new Error('local reader has no remote acquisition');
    if (isCurrent?.() === false) throw new Error('reading acquisition cancelled');
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    if (this.source.session !== undefined) return this.source.session;
    const source = this.source;
    const seed = source.seed;
    const acquisition = this.runtimeOwner.bookAcquisitions?.();
    if (seed === undefined || acquisition === undefined) throw new Error('READING_SESSION_ACQUISITION_UNAVAILABLE');
    // The process coordinator already shares acquisition and owns independent
    // consumers. Do not add a promise owned by the first caller here: a cancelled
    // background neighbour must not cancel a foreground caller joining later.
    const admission = await acquisition.acquireBookWithBackgroundRefresh(seed, { isCurrent }, priority);
    if (isCurrent?.() === false) throw new Error('reading acquisition cancelled');
    const session = admission.session;
    if (session.identity.sourceId !== this.sourceId || session.identity.bookId !== this.bookId) throw new Error('READING_SESSION_IDENTITY_MISMATCH');
    if (source.session !== session) {
      source.session = session;
      source.onSessionReady?.(session);
    }
    return session;
  }

  async loadDocumentWindow(scope: RemoteReadingPositionScope, startScalar: number, scalarLimit: number,
    isCurrent: () => boolean): Promise<ReadingDocumentWindow | undefined> {
    this.assertBook(scope.bookId);
    if (scope.sourceId !== this.sourceId || this.hasPendingSourceSwitch()) return undefined;
    return readReadingDocumentWindow(this.runtimeOwner, scope, startScalar, scalarLimit, isCurrent);
  }

  /** Preserve the admitted side while one page obtains its missing original
   * paragraph context. The resulting partial DTO never enters chapter cache. */
  async loadParagraphWindow(chapter: ReadingSessionChapter, anchorScalar: number,
    direction: ReadingParagraphWindowDirection, mode: ReadingParagraphBoundaryMode,
    isCurrent: () => boolean): Promise<ReadingSessionChapter> {
    this.assertBook(chapter.bookId);
    if (chapter.sourceId !== this.sourceId || this.hasPendingSourceSwitch())
      throw new Error('reading paragraph window was cancelled');
    return extendReadingParagraphWindow(this.runtimeOwner, chapter, anchorScalar, direction, mode,
      (): boolean => isCurrent() && !this.hasPendingSourceSwitch());
  }

  supportsExactContentMetrics(): boolean {
    return this.source.kind === 'local';
  }

  remoteSession(): RemoteReadingSession | undefined {
    return this.source.kind === 'remote' ? this.source.session : undefined;
  }

  hasPendingSourceSwitch(): boolean {
    return this.sourceSwitchTransactionId !== undefined;
  }

  supportsContentSearch(): boolean {
    return true;
  }

  private configureDocuments(entries: LocalReadingTocEntry[]): void {
    const valid = this.runtimeOwner.captureReadingContentValidity?.(this.sourceId, this.bookId);
    if (valid === undefined || this.hasPendingSourceSwitch()) return;
    readingSessionDocuments(this.runtimeOwner).configure(this.sourceId, this.bookId,
      entries.filter((entry): boolean => entry.navigable !== false).map((entry): number => entry.index), valid);
  }

  async loadToc(bookId: string, isCurrent?: () => boolean): Promise<LocalReadingToc> {
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    const toc = await this.loadTocProjection(bookId, isCurrent);
    if (isCurrent?.() === false) throw new Error('reading catalog request was cancelled');
    this.configureDocuments(toc.entries);
    return toc;
  }

  private async loadTocProjection(bookId: string, isCurrent?: () => boolean): Promise<LocalReadingToc> {
    this.assertBook(bookId);
    if (!this.hasPendingSourceSwitch()) {
      const catalog = await readReadingCatalog(this.runtimeOwner, this.sourceId, bookId, (): boolean => isCurrent?.() !== false);
      if (catalog !== undefined) return catalog;
    }
    if (this.source.kind === 'local') {
      return this.local.loadToc(bookId, isCurrent);
    }
    if (isCurrent?.() === false) throw new Error('reading catalog request was cancelled');
    const session = await this.ensureRemoteSession(isCurrent);
    const coordinator = this.runtimeOwner.bookAcquisitions?.();
    const currentProjection = this.runtimeOwner.hasCurrentCatalogProjection?.(session) ??
      coordinator?.hasCurrentCatalogProjection?.(session) === true;
    const entries = currentProjection ? session.entries :
      await this.remote.loadCachedTocProjection(session, isCurrent);
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
    if (isCurrent?.() === false) throw new Error('reading progress request was cancelled');
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    const pending = this.sourceSwitchTransactionId === undefined ? this.progressOwner.pendingProgress() : undefined;
    return pending ?? this.loadDurableProgress(bookId, isCurrent);
  }

  private async loadDurableProgress(bookId: string, isCurrent?: () => boolean): Promise<LocalReadingProgressState> {
    this.assertBook(bookId);
    if (this.source.kind === 'local') {
      return this.local.loadProgress(bookId, isCurrent);
    }
    const state = await this.remote.loadProgress({ sourceId: this.sourceId, bookId: this.bookId }, isCurrent);
    if (state.kind === 'missing') {
      return state;
    }
    return {
      kind: 'restored',
      ...(state.progressRevision === undefined ? {} : { progressRevision: state.progressRevision }),
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

  /** Optional neighbour work uses the shared background lane, never a new
   * progress owner or a force-refresh/source-switch transaction. */
  async prefetchChapter(bookId: string, chapterIndex: number,
    isCurrent: () => boolean): Promise<ReadingSessionChapter> {
    this.assertBook(bookId);
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    if (!isCurrent() || this.hasPendingSourceSwitch()) throw new Error('reading neighbour preparation cancelled');
    const documents = readingSessionDocuments(this.runtimeOwner);
    const retained = documents.read(this.sourceId, bookId, chapterIndex);
    if (retained !== undefined) {
      if (retained.sourceCorrectionRequired === true) throw new Error('source content correction requires foreground reading');
      return retained;
    }
    const runtime = this.runtimeOwner;
    const coordinator = runtime.bookAcquisitions?.();
    const revision = coordinator?.readingProjectionRevision();
    const contentValid = runtime.captureReadingContentValidity?.(this.sourceId, this.bookId);
    const valid = (): boolean => isCurrent() && contentValid?.() !== false &&
      coordinator?.readingProjectionRevision() === revision;
    const background: ReadingGatewayRuntime = {
      allowSourceContentCorrection: false,
      supportsCoreCapability: (capability: string): boolean => runtime.supportsCoreCapability?.(capability) === true,
      request: (method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> => {
        if (!valid() || params['forceRefresh'] === true || params['upgradeCachedContent'] === true || method === 'reading.progress.update' ||
          method.startsWith('source.switch.')) return Promise.reject(new Error('reading neighbour preparation cancelled'));
        const guarded: RequestOptions = { ...options,
          shouldCancel: (): boolean => !valid() || options.shouldCancel?.() === true };
        return coordinator === undefined ? runtime.request(method, params, guarded) :
          coordinator.request(method, params, { ...guarded, canContinue: valid }, 'background');
      },
    };
    if (this.source.kind === 'remote' && this.source.session === undefined) {
      const cached = await readReadingEntrySnapshot(background, this.sourceId, bookId, chapterIndex, valid);
      if (cached !== undefined) {
        if (cached.chapter.sourceCorrectionRequired === true) throw new Error('source content correction requires foreground reading');
        documents.admit(cached.chapter, false); return cached.chapter;
      }
    }
    const chapter = this.source.kind === 'remote' ?
      await new RemoteReadingFlowGateway(background).loadChapter(await this.ensureRemoteSession(valid, 'background'), chapterIndex, valid) :
      await this.materializeLocalChapter(await new LocalReadingFlowGateway(background).loadChapter(bookId, chapterIndex, valid), valid);
    if (!valid()) throw new Error('reading neighbour preparation cancelled');
    if (chapter.sourceCorrectionRequired === true) throw new Error('source content correction requires foreground reading');
    documents.admit(chapter, false);
    return chapter;
  }

  async loadChapter(bookId: string, chapterIndex: number, isCurrent?: () => boolean,
    forceRefresh: boolean = false, positionContext?: RemoteReadingPositionContext): Promise<ReadingSessionChapter> {
    this.assertBook(bookId);
    if (isCurrent?.() === false) throw new Error('reading chapter request was cancelled');
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    const context = captureRemotePositionContext(positionContext);
    const documents = readingSessionDocuments(this.runtimeOwner);
    // A fresh narrow snapshot owns the current request's position proof. The
    // process window only supplies subsequent/remounted body reads.
    if (!forceRefresh && !this.hasPendingSourceSwitch() && this.retainedEntrySnapshot === undefined) {
      const retained = documents.read(this.sourceId, bookId, chapterIndex, context);
      if (retained !== undefined && retained.sourceCorrectionRequired !== true) { documents.admit(retained, true); return retained; }
    }
    const chapter = await this.loadChapterFresh(bookId, chapterIndex, isCurrent, forceRefresh, context);
    if (isCurrent?.() === false) throw new Error('reading chapter request was cancelled');
    if (!this.hasPendingSourceSwitch()) documents.admit(chapter, true);
    return chapter;
  }

  private async loadChapterFresh(
    bookId: string,
    chapterIndex: number,
    isCurrent?: () => boolean,
    forceRefresh: boolean = false,
    positionContext?: RemoteReadingPositionContext,
  ): Promise<ReadingSessionChapter> {
    this.assertBook(bookId);
    if (this.source.kind === 'local' && !forceRefresh) {
      const retained = this.retainedEntrySnapshot;
      if (retained !== undefined && retained.chapter.chapterIndex === chapterIndex && retained.isCurrent() &&
        this.entryPositionMatches(retained.chapter, positionContext)) {
        this.retainedEntrySnapshot = undefined;
        return retained.chapter;
      }
    }
    if (this.source.kind === 'remote') {
      positionContext = captureRemotePositionContext(positionContext);
      if (!forceRefresh && !this.hasPendingSourceSwitch()) {
        const retained = this.retainedEntrySnapshot;
        if (retained !== undefined && retained.chapter.chapterIndex === chapterIndex && retained.isCurrent() &&
          this.entryPositionMatches(retained.chapter, positionContext)) {
          this.retainedEntrySnapshot = undefined;
          return retained.chapter;
        }
        if (this.source.session === undefined) {
          const snapshot = await this.loadEntrySnapshot(chapterIndex, isCurrent ?? ((): boolean => true), positionContext);
          if (snapshot !== undefined) return snapshot.chapter;
        }
      }
      const session = await this.ensureRemoteSession(isCurrent);
      const prepared = session.preparedChapter;
      const coordinator = this.runtimeOwner.bookAcquisitions?.();
      if (!forceRefresh && !this.preparedChapterConsumed && prepared !== undefined && prepared.chapter.sourceCorrectionRequired !== true &&
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
        await this.runProgressCommitSerial(async (): Promise<void> => {
          refreshed = await this.remote.loadChapter(session, chapterIndex, isCurrent, true, positionContext);
        });
        if (refreshed === undefined) throw new Error('reading refresh returned no chapter');
        chapter = refreshed;
      } else {
        chapter = await this.remote.loadChapter(session, chapterIndex, isCurrent, false, positionContext);
        if (chapter.sourceCorrectionRequired === true && !this.hasPendingSourceSwitch()) {
          const corrected = await this.loadEntrySnapshot(chapterIndex, isCurrent ?? ((): boolean => true), positionContext);
          if (corrected !== undefined) chapter = corrected.chapter;
        }
      }
      if (prepared?.chapter.chapterIndex === chapterIndex) this.preparedChapterConsumed = true;
      return chapter;
    }
    const chapter = await this.local.loadChapter(bookId, chapterIndex, isCurrent);
    // Local rule mutations migrate durable anchors atomically in Core. An old
    // bookmark/selection must not be relabelled with the newly processed body.
    decodeRemotePositionMigration(undefined, this.sourceId, bookId,
      chapter.bodyVersion, chapter.processingVersion, positionContext);
    return this.materializeLocalChapter(chapter, isCurrent);
  }

  private async materializeLocalChapter(chapter: LocalReadingChapter,
    isCurrent?: () => boolean): Promise<ReadingSessionChapter> {
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
      bodyVersion: chapter.bodyVersion,
      processingVersion: chapter.processingVersion,
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
        this.source.kind !== 'remote' || this.source.session?.acquisitionMode !== 'offline',
        isCurrent,
      );
      if (isCurrent !== undefined && !isCurrent()) {
        this.runtimeOwner.releaseReadingImage?.(payload.fileUri, payload.pixelMap);
        throw new Error('reading body image request was cancelled');
      }
      if (hasKnownReadingImageGeometry(image) &&
        (payload.intrinsicWidth !== image.intrinsicWidth || payload.intrinsicHeight !== image.intrinsicHeight)) {
        this.runtimeOwner.releaseReadingImage?.(payload.fileUri, payload.pixelMap);
        throw new Error('READING_IMAGE_INTRINSIC_GEOMETRY_MISMATCH');
      }
      return {
        source: image.source,
        baseUrl: image.baseUrl,
        startScalar: image.startScalar,
        endScalar: image.endScalar,
        state: 'ready',
        pixelMap: payload.pixelMap,
        fileUri: payload.fileUri,
        intrinsicWidth: payload.intrinsicWidth ?? payload.width,
        intrinsicHeight: payload.intrinsicHeight ?? payload.height,
        imageWidthBasisPoints: image.imageWidthBasisPoints,
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
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    if (this.source.kind === 'local') {
      return this.local.resolveLocation(bookId, chapterTitle, anchor, layout, isCurrent);
    }
    return this.remote.resolveLocation(
      { sourceId: this.sourceId, bookId: this.bookId },
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
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
    if (this.source.kind === 'local') {
      const stored = await this.local.updateProgress(bookId, update, isCurrent);
      this.progressOwner.noteCommitted();
      return stored;
    }
    const transactionId = this.sourceSwitchTransactionId;
    const stored = await this.remote.updateProgress(
      { sourceId: this.sourceId, bookId: this.bookId },
      update,
      isCurrent,
      transactionId,
    );
    if (transactionId !== undefined) {
      this.sourceSwitchTransactionId = undefined;
    }
    this.progressOwner.noteCommitted();
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
    const stored = await this.resolveAndUpdateProgressUnowned(bookId, chapterTitle, anchor, layout, isCurrent);
    this.progressOwner.noteCommitted();
    return stored;
  }

  private async resolveAndUpdateProgressUnowned(bookId: string, chapterTitle: string | undefined,
    anchor: LocalReadingAnchor, layout: LocalReadingLayout, isCurrent?: () => boolean): Promise<LocalReadingProgress> {
    this.assertBook(bookId);
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission(isCurrent);
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
      { sourceId: this.sourceId, bookId: this.bookId },
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
    if (page.nextCursor !== undefined) {
      void this.closeContentSearch(page.nextCursor).catch((_error: Error): void => {});
    }
    return page.results;
  }

  async searchContentPage(
    bookId: string,
    keyword: string,
    limit: number,
    offset: number = 0,
    isCurrent?: () => boolean,
    cursor?: string,
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
    // New fields are sent only after Core capability negotiation.
    const useCursor = this.runtimeOwner.supportsCoreCapability?.('search.content.cursor.v1') === true;
    if (cursor !== undefined) {
      if (!useCursor) throw new Error('正文搜索会话已失效，请重新搜索。');
      params['cursor'] = cursor;
    } else if (offset > 0) params['offset'] = offset;
    else if (useCursor) params['useCursor'] = true;
    const result = await this.runtimeOwner.request('search.content', params,
      isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() })
      .catch((error: Error): never => { throw classifyRemoteReadingCommandFailure('search.content', error); });
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
    const nextCursor = result.data['nextCursor'];
    if (nextCursor !== undefined && (typeof nextCursor !== 'string' || nextCursor.length > 64)) {
      throw new Error('search.content returned invalid nextCursor');
    }
    return { results: matches, offset, limit, hasMore: rawHasMore === true,
      ...(typeof nextCursor === 'string' ? { nextCursor } : {}) };
  }

  async closeContentSearch(cursor: string): Promise<void> {
    if (this.runtimeOwner.supportsCoreCapability?.('search.content.cursor.v1') !== true) return;
    await this.runtimeOwner.request('search.content', {
      keyword: 'close', sourceId: this.sourceId, bookId: this.bookId, cursor, closeCursor: true,
    }, { timeoutMs: 5000 });
  }

  async runProgressCommitSerial(operation: () => Promise<void>): Promise<void> {
    if (this.pendingSourceSwitchResolver !== undefined) await this.ensureSourceSwitchAdmission();
    return this.progressOwner.runSerial(operation);
  }

  canPersistPresentedProgress(): boolean {
    return this.pendingSourceSwitchResolver === undefined && !this.hasPendingSourceSwitch() &&
      this.runtimeOwner.supportsCoreCapability?.('reading.progress.compareAndSet.v1') === true;
  }

  persistPresentedProgress(bookId: string, chapterTitle: string | undefined,
    anchor: LocalReadingAnchor, layout: LocalReadingLayout): Promise<LocalReadingProgress> {
    this.assertBook(bookId);
    if (this.sourceSwitchTransactionId !== undefined || this.pendingSourceSwitchResolver !== undefined)
      throw new Error('READING_PRESENTED_PROGRESS_TRANSACTION_PENDING');
    return this.progressOwner.persistPresented(chapterTitle, anchor, layout, this.progressAccess());
  }

  async awaitPresentedProgressPersistence(): Promise<LocalReadingProgress | undefined> {
    return this.progressOwner.awaitPersistence();
  }

  pendingPresentedProgress(): LocalReadingProgressState | undefined {
    return this.sourceSwitchTransactionId === undefined ? this.progressOwner.pendingProgress() : undefined;
  }

  private progressAccess(): ReadingSessionProgressAccess {
    const bookId = this.bookId;
    const local = this.local;
    // A pending position owns only identity and the command adapter. Do not
    // capture this session (which may still have a prepared chapter/catalog).
    const remote = new RemoteReadingFlowGateway(this.runtimeOwner);
    const identity = this.source.kind === 'remote' ? { sourceId: this.sourceId, bookId: this.bookId } : undefined;
    return {
      read: (isCurrent: () => boolean): Promise<LocalReadingProgressState> => identity === undefined ?
        local.loadProgress(bookId, isCurrent) : remote.loadProgress(identity, isCurrent),
      write: (title: string | undefined, anchor: LocalReadingAnchor, layout: LocalReadingLayout,
        isCurrent: () => boolean, expectedProgressRevision?: string): Promise<LocalReadingProgress> => {
        const update: LocalReadingProgressUpdate = { chapterIndex: anchor.chapterIndex,
          chapterOffset: anchor.chapterOffset, chapterProgress: anchor.chapterProgress,
          expectedProgressRevision,
          expectedBodyVersion: anchor.bodyVersion, expectedProcessingVersion: anchor.processingVersion };
        const resolution = { chapterTitle: title, anchor, layout };
        return identity === undefined ? local.updateProgress(bookId, update, isCurrent, resolution) :
          remote.updateProgress(identity, update, isCurrent, undefined, resolution);
      },
    };
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
      intrinsicWidth: image.intrinsicWidth,
      intrinsicHeight: image.intrinsicHeight,
      imageWidthBasisPoints: image.imageWidthBasisPoints,
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
