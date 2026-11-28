import {
  completeReaderFirstPage, ReaderOrdinaryFirstPagePersistence,
  type ReaderFirstPageMeasurementLease, type ReaderFirstPagePlan, type ReaderOrdinaryFirstPageReceipt,
} from './ReaderFirstPageAdmission.ts';
import { hydrateReadingEntryCatalog, type ReadingCatalogRequest } from './ReadingChapterCatalogAdmission.ts';
import {
  ReadingEntryWindowExpansion,
  type ReadingEntryWindowLane,
  type ReadingEntryWindowRequest,
} from './ReadingEntryWindowExpansion.ts';
import { hasKnownReadingImageGeometry, type ReadingChapterWindow, type ReadingSessionChapter,
  type ReadingSessionImage } from './ReadingChapterWindow.ts';
import { readingChapterLayoutMap, type ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap.ts';
import { createRequestedRemoteReadingPositionContext, type RemoteReadingPositionContext } from './RemoteReadingPositionMigration.ts';
import type { ParagraphRange } from './ReadingMeasurementFacts';
import type { ReadingParagraphBoundaryMode } from './ReadingParagraphProjection';
import type { LocalReadingProgressState, LocalReadingTocEntry } from './LocalReadingFlowTypes';
import type { ReadingEntrySnapshot } from './ReadingEntrySnapshot';
import {
  loadInitialReading, restartPreparedReadingEntry, type InitialReadingSnapshot, type ReadingInitialChapterHost,
} from './ReadingInitialChapter.ts';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import type { ReaderNavigationMode, ReaderScreenDirection } from './ReaderSettingsState';
import type { ReaderProgressProducerHost, ReaderProgressProducerIntent } from './ReaderProgressProducerHost';

export type ReadingFirstBuild = 'unavailable' | 'ready' | 'deferred' | 'failed';

interface ReadingEntryMount {
  readonly lifecycle: number;
  readonly startupTraceId: number;
}

export interface ReadingFirstFrameReadiness {
  readonly appearanceReady: boolean;
  readonly settingsReady: boolean;
  readonly viewportReady: boolean;
  readonly fontReady: () => boolean;
  readonly sourceSwitchPending: boolean;
  readonly supportsPreparedEntry: () => boolean;
  readonly screenDirection: ReaderScreenDirection;
  readonly width: number;
  readonly height: number;
}

export interface ReadingFirstFrameRead {
  readonly sourceId: string;
  readonly bookId: string;
  readonly requestedChapter: number | undefined;
  readonly bookmark: ReaderBookmarkAnchorRequest | undefined;
  readonly pendingProgress: LocalReadingProgressState | undefined;
  readonly navigationMode: ReaderNavigationMode;
  isCurrent(): boolean;
  windowIsCurrent(): boolean;
  read(chapterIndex: number | undefined, isCurrent: () => boolean,
    context: RemoteReadingPositionContext | undefined): ReadingEntrySnapshot | undefined;
  install(snapshot: ReadingEntrySnapshot): boolean;
  publish(entry: ReadingFirstFrameEntry): void;
  measure(): 'ready' | 'deferred' | 'failed';
  fail(error: Error): void;
}

export interface ReadingFirstFrameEntry {
  readonly snapshot: ReadingEntrySnapshot;
  readonly map: ReadingSurfaceLayoutMap;
  readonly entries: LocalReadingTocEntry[];
  readonly progress: LocalReadingProgressState | undefined;
  readonly requestedScalar: number | undefined;
  readonly bookmarkRequestId: number | undefined;
}

interface ReadingFirstFrameTarget {
  readonly chapterIndex: number | undefined;
  readonly context: RemoteReadingPositionContext | undefined;
}

export interface ReadingEntryCatalogPort {
  pending(): boolean;
  startRequest(): ReadingCatalogRequest;
  currentChapter(): ReadingSessionChapter | undefined;
  resumeOnlyChapterIndex(): number | undefined;
  installCatalog(entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void;
  afterAdmitted(entries: LocalReadingTocEntry[]): void;
  fail(isCurrent: () => boolean): void;
  finish(): void;
  resumePaging(): void;
  reportDeferredFailure(error: Error): void;
}

export interface ReadingEntryWindowPortRequest {
  isCurrent(): boolean;
  complete(isCurrent: () => boolean): Promise<ReadingSessionChapter>;
  boundaryMode(): ReadingParagraphBoundaryMode;
  admit(chapter: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap): void;
}

export interface ReadingEntryHydrationHost {
  isSessionActive(lifecycle: number): boolean;
  readonly chapterWindow: ReadingChapterWindow;
  readonly catalog: ReadingEntryCatalogPort;
  captureWindowSelection(chapter: ReadingSessionChapter): () => boolean;
  captureWindowRequest(chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowPortRequest;
  postFrame(run: () => void): void;
  reportWindowFailure(error: Error): void;
}

export interface ReadingEntryDiagnostics {
  now(): number;
  mark(entryId: number, phase: string, status: string): void;
  phase(phase: string, lifecycle: number, elapsedMs: number): void;
  firstBuild(outcome: ReadingFirstBuild, elapsedMs: number): void;
}

const FIRST_PAGE_READY_TIMEOUT_MS = 30_000;
const FIRST_PAGE_COMPLETION_DEADLINE_MS = 10_000;
const FIRST_PAGE_COMPLETION_MAX_RETRIES = 3;

export interface ReadingEntryDeadlineHost {
  set(delay: number, callback: () => void): number;
  clear(handle: number): void;
  visibleBody(): boolean;
  ready(): boolean;
  activeSelection(lifecycle: number, selection: number): boolean;
  completing(): boolean;
  restartMeasurement(): void;
  fail(error: Error, lifecycle: number): void;
}

export function readingEntryToc(snapshot: InitialReadingSnapshot): LocalReadingTocEntry[] {
  const navigation = snapshot.navigation;
  if (navigation !== undefined) return [...navigation.before, navigation.current, ...navigation.after];
  const chapter = snapshot.chapter;
  return [{ index: chapter.chapterIndex, title: chapter.chapterTitle, downloadState: 'unknown',
    navigable: snapshot.resumeOnly !== true }];
}

function preparedEntryUnavailable(input: ReadingFirstFrameReadiness): string {
  if (!input.appearanceReady) return 'appearanceNotReady';
  if (!input.settingsReady) return 'settingsNotReady';
  if (!input.viewportReady) return 'viewportNotReady';
  if (!input.fontReady()) return 'fontNotReady';
  if (input.sourceSwitchPending) return 'sourceSwitchPending';
  if (!input.supportsPreparedEntry()) return 'capabilityUnavailable';
  if ((input.screenDirection === 'portrait' && input.width > input.height) ||
    (input.screenDirection === 'landscape' && input.height > input.width)) return 'orientationNotReady';
  return '';
}

function firstFrameTarget(input: ReadingFirstFrameRead): ReadingFirstFrameTarget | undefined {
  const bookmark = input.bookmark;
  const requested = input.requestedChapter;
  if (bookmark !== undefined) {
    if (!Number.isSafeInteger(bookmark.chapterOffset) || bookmark.chapterOffset < 0 ||
      (requested !== undefined && requested !== bookmark.chapterIndex) ||
      (bookmark.chapterOffset > 0 && bookmark.positionScope === undefined)) return undefined;
    return { chapterIndex: bookmark.chapterIndex, context: createRequestedRemoteReadingPositionContext(
      input.sourceId, input.bookId, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.positionScope,
      bookmark.directoryTargetProof) };
  }
  if (requested !== undefined) return { chapterIndex: requested, context: undefined };
  const position = input.pendingProgress?.kind === 'restored' ? input.pendingProgress.progress : undefined;
  if (position === undefined) return { chapterIndex: undefined, context: undefined };
  if (position.bodyVersion === undefined || position.processingVersion === undefined) return undefined;
  return { chapterIndex: position.chapterIndex,
    context: { bodyVersion: position.bodyVersion, processingVersion: position.processingVersion,
      anchors: [{ id: 'presented', offset: position.chapterOffset }] } };
}

/** Owns the mounted entry from the synchronous persisted attempt through
 * the first durable position and deferred body/catalog admission. The caller
 * retains native measurement and the visible page's publication. */
export class ReadingEntryHydrationCoordinator {
  private mount: ReadingEntryMount | undefined = undefined;
  private traceStartedAt: number = -1;
  private traceDelivered: boolean = false;
  private catalogTask: Promise<void> | undefined = undefined;
  private catalogFrameQueued: boolean = false;
  private readonly persistence: ReaderOrdinaryFirstPagePersistence = new ReaderOrdinaryFirstPagePersistence();
  private readonly expansion: ReadingEntryWindowExpansion;
  private readyTimer: number = -1;
  private readyGeneration: number = 0;
  private completionTimer: number = -1;
  private completionGeneration: number = 0;
  private completionRetries: number = 0;
  private readonly host: ReadingEntryHydrationHost;
  private readonly deadlines: ReadingEntryDeadlineHost;
  private readonly diagnostics: ReadingEntryDiagnostics;

  constructor(host: ReadingEntryHydrationHost, diagnostics: ReadingEntryDiagnostics, deadlines: ReadingEntryDeadlineHost) {
    this.host = host;
    this.diagnostics = diagnostics;
    this.deadlines = deadlines;
    this.expansion = new ReadingEntryWindowExpansion({
      captureSelection: (chapter: ReadingSessionChapter): (() => boolean) => {
        const mount = this.mount;
        const current = host.captureWindowSelection(chapter);
        return (): boolean => this.isMounted(mount) && current();
      },
      captureRequest: (chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowRequest => {
        const mount = this.mount;
        const request = host.captureWindowRequest(chapter, lane);
        return {
          isCurrent: (): boolean => this.isMounted(mount) && request.isCurrent(),
          complete: (isCurrent: () => boolean): Promise<ReadingSessionChapter> => request.complete(isCurrent),
          firstPagePersistence: (): Promise<void> | undefined => this.persistence.pending(),
          boundaryMode: (): ReadingParagraphBoundaryMode => request.boundaryMode(),
          admit: (expanded: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap): void =>
            request.admit(expanded, ranges, map),
        };
      },
      postFrame: (run: () => void): void => {
        const mount = this.mount;
        host.postFrame((): void => { if (this.isMounted(mount)) run(); });
      },
      reportBackgroundFailure: (error: Error): void => host.reportWindowFailure(error),
    });
  }

  beginMount(lifecycle: number, startupTraceId: number): void {
    this.retireMount();
    this.mount = { lifecycle, startupTraceId };
  }

  retireMount(): void {
    this.mount = undefined;
    this.traceStartedAt = -1;
    this.traceDelivered = false;
    this.catalogFrameQueued = false;
    this.catalogTask = undefined;
    this.expansion.reset();
    this.cancelReadyDeadline();
    this.cancelCompletionDeadline();
    this.resetCompletionRetries();
  }

  startAsyncEntry(lifecycle: number, host: ReadingInitialChapterHost): Promise<void> {
    if (this.mount?.lifecycle !== lifecycle) return Promise.resolve();
    return loadInitialReading(lifecycle, host);
  }

  restartPreparedEntry(lifecycle: number, selection: number, layoutReady: Promise<void[]>,
    host: ReadingInitialChapterHost): Promise<void> {
    if (this.mount?.lifecycle !== lifecycle) return Promise.resolve();
    return restartPreparedReadingEntry(lifecycle, selection, layoutReady, host);
  }

  ensureReadyDeadline(lifecycle: number, selection: number): void {
    if (!this.deadlines.visibleBody() && !this.deadlines.ready() && this.readyTimer < 0) this.armReadyDeadline(lifecycle, selection);
  }

  armReadyDeadline(lifecycle: number, selection: number): void {
    const mount = this.mount;
    if (mount?.lifecycle !== lifecycle || this.deadlines.visibleBody()) return;
    this.cancelReadyDeadline();
    const generation = this.readyGeneration;
    this.readyTimer = this.deadlines.set(FIRST_PAGE_READY_TIMEOUT_MS, (): void => {
      if (!this.isMounted(mount) || generation !== this.readyGeneration) return;
      this.readyTimer = -1;
      if (!this.deadlines.activeSelection(lifecycle, selection) || this.deadlines.ready() || this.deadlines.visibleBody()) return;
      this.deadlines.fail(new Error('PAGINATION_FIRST_PAGE_READY_TIMEOUT'), lifecycle);
    });
  }

  cancelReadyDeadline(): void {
    this.readyGeneration += 1;
    if (this.readyTimer < 0) return;
    this.deadlines.clear(this.readyTimer);
    this.readyTimer = -1;
  }

  armCompletionDeadline(): void {
    const mount = this.mount;
    if (mount === undefined) return;
    this.cancelCompletionDeadline();
    const generation = ++this.completionGeneration;
    this.completionTimer = this.deadlines.set(FIRST_PAGE_COMPLETION_DEADLINE_MS, (): void => {
      if (!this.isMounted(mount) || generation !== this.completionGeneration) return;
      this.completionTimer = -1;
      if (!this.deadlines.completing()) return;
      if (this.completionRetries >= FIRST_PAGE_COMPLETION_MAX_RETRIES) {
        this.resetCompletionRetries();
        this.deadlines.fail(new Error('READING_FIRST_PAGE_COMPLETION_TIMEOUT'), mount.lifecycle);
        return;
      }
      this.completionRetries += 1;
      this.deadlines.restartMeasurement();
      this.armCompletionDeadline();
    });
  }

  cancelCompletionDeadline(): void {
    this.completionGeneration += 1;
    if (this.completionTimer < 0) return;
    this.deadlines.clear(this.completionTimer);
    this.completionTimer = -1;
  }

  resetCompletionRetries(): void { this.completionRetries = 0; }

  startTrace(lifecycle: number): void {
    if (this.mount?.lifecycle !== lifecycle) return;
    this.traceStartedAt = this.diagnostics.now();
    this.traceDelivered = false;
  }

  trace(lifecycle: number, phase: string): void {
    try {
      if (this.mount?.lifecycle !== lifecycle || this.traceStartedAt < 0 || this.traceDelivered) return;
      this.mark(phase, 'event');
      this.diagnostics.phase(phase, lifecycle, this.elapsed());
    } catch (_) { /* Diagnostics must not release a first-page admission barrier. */ }
  }

  finishTrace(lifecycle: number): void {
    if (this.mount?.lifecycle === lifecycle) this.traceDelivered = true;
  }

  restoreFirstFrame(lifecycle: number, readiness: ReadingFirstFrameReadiness,
    capture: () => ReadingFirstFrameRead): ReadingFirstBuild {
    const mount = this.mount;
    if (mount?.lifecycle !== lifecycle) return 'unavailable';
    const unavailable = preparedEntryUnavailable(readiness);
    if (unavailable.length > 0) {
      this.mark('prepared-admission', unavailable);
      return 'unavailable';
    }
    let accepted: ReadingFirstFrameRead | undefined;
    try {
      const request = capture();
      const target = firstFrameTarget(request);
      if (target === undefined) return 'unavailable';
      const isCurrent = (): boolean => this.isMounted(mount) && request.isCurrent();
      this.startTrace(lifecycle);
      this.trace(lifecycle, 'persisted-entry-read');
      const snapshot = request.read(target.chapterIndex, isCurrent, target.context);
      if (snapshot === undefined || !snapshot.isCurrent() || !isCurrent() || !request.windowIsCurrent()) return 'unavailable';
      const chapter = snapshot.chapter;
      const map = readingChapterLayoutMap(chapter);
      if (map.scalarCount() === 0 || (request.navigationMode === 'continuous' &&
        chapter.images.some((image: ReadingSessionImage): boolean => !hasKnownReadingImageGeometry(image)))) return 'unavailable';
      const entries = readingEntryToc(snapshot);
      if (!request.install(snapshot)) return 'unavailable';
      accepted = request;
      const bookmark = request.bookmark;
      request.publish({ snapshot, map, entries,
        progress: bookmark !== undefined || request.requestedChapter !== undefined ?
          undefined : request.pendingProgress ?? snapshot.progress,
        requestedScalar: bookmark?.chapterOffset ?? snapshot.requestedScalar,
        bookmarkRequestId: bookmark?.requestId });
      this.trace(lifecycle, 'persisted-entry-decoded');
      const outcome = request.measure();
      if (this.isMounted(mount)) {
        this.mark('first-build', outcome);
        this.diagnostics.firstBuild(outcome, this.elapsed());
      }
      return outcome;
    } catch (error) {
      if (accepted !== undefined) {
        if (this.isMounted(mount)) accepted.fail(error as Error);
        return 'failed';
      }
      this.trace(lifecycle, 'persisted-entry-rejected');
      return 'unavailable';
    }
  }

  completeFirstPage(lifecycle: number, lease: ReaderFirstPageMeasurementLease,
    prepare: (layoutSignature: string) => ReaderFirstPagePlan): Promise<void> {
    if (this.mount?.lifecycle !== lifecycle) return Promise.resolve();
    return completeReaderFirstPage(lease, prepare);
  }

  firstPageRoute(hasPresentation: boolean, directSelection: boolean, sourceSwitch: boolean,
    pendingSourceSwitch: () => boolean, ordinaryPage: () => boolean): 'cold' | 'ordinaryTurn' | 'durable' {
    if (!hasPresentation && !directSelection && !sourceSwitch && !pendingSourceSwitch()) return 'cold';
    return ordinaryPage() ? 'ordinaryTurn' : 'durable';
  }

  persistFirstPage(lifecycle: number, producer: ReaderProgressProducerHost,
    capture: () => ReaderProgressProducerIntent, presentedTurn: boolean,
    receipt: ReaderOrdinaryFirstPageReceipt): Promise<void> {
    const mount = this.mount;
    return this.persistence.persist(producer, capture, presentedTurn, {
      traceIfReaderCurrent: (): boolean => {
        if (mount === undefined || mount.lifecycle !== lifecycle || !this.isMounted(mount) || !receipt.traceIfReaderCurrent())
          return false;
        this.trace(lifecycle, 'first-persist');
        return true;
      },
      isPresentationCurrent: receipt.isPresentationCurrent,
      layoutIsCurrent: receipt.layoutIsCurrent,
      requestRemeasurement: receipt.requestRemeasurement,
      ready: receipt.ready,
      failed: receipt.failed,
    });
  }

  releaseFirstPagePersistence(): void {
    this.persistence.release();
  }

  scheduleWindow(chapter: ReadingSessionChapter | undefined, navigation: ReaderNavigationMode,
    continuousPositionReady: boolean): void {
    if (this.mount === undefined || (navigation === 'continuous' && !continuousPositionReady)) return;
    this.expansion.schedule(chapter);
  }

  expandWindow(chapter: ReadingSessionChapter): Promise<void> {
    if (this.mount === undefined) return Promise.resolve();
    return this.expansion.expand(chapter, 'foreground');
  }

  catalogInFlight(): boolean {
    return this.catalogTask !== undefined;
  }

  scheduleCatalog(): void {
    const mount = this.mount;
    const catalog = this.host.catalog;
    if (mount === undefined || !catalog.pending() || this.catalogInFlight() || this.catalogFrameQueued) return;
    this.catalogFrameQueued = true;
    this.host.postFrame((): void => {
      this.catalogFrameQueued = false;
      if (!this.isMounted(mount) || !this.host.isSessionActive(mount.lifecycle)) return;
      void this.hydrateCatalog().catch((error: Error): void => catalog.reportDeferredFailure(error));
    });
  }

  hydrateCatalog(): Promise<void> {
    const mount = this.mount;
    if (mount === undefined) return Promise.resolve();
    const catalog = this.host.catalog;
    return hydrateReadingEntryCatalog(this.host.chapterWindow, {
      pending: (): boolean => catalog.pending(),
      task: (): Promise<void> | undefined => this.catalogTask,
      startRequest: (): ReadingCatalogRequest => {
        const request = catalog.startRequest();
        return { isCurrent: (): boolean => this.isMounted(mount) && request.isCurrent(), load: () => request.load() };
      },
      currentChapter: (): ReadingSessionChapter | undefined => catalog.currentChapter(),
      resumeOnlyChapterIndex: (): number | undefined => catalog.resumeOnlyChapterIndex(),
      installCatalog: (entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void =>
        catalog.installCatalog(entries, current),
      afterAdmitted: (entries: LocalReadingTocEntry[]): void => catalog.afterAdmitted(entries),
      track: (operation: Promise<void>): void => { this.catalogTask = operation; },
      fail: (isCurrent: () => boolean): void => catalog.fail(isCurrent),
      finish: (operation: Promise<void>): void => {
        if (this.catalogTask !== operation) return;
        this.catalogTask = undefined;
        catalog.finish();
      },
      resumePaging: (): void => catalog.resumePaging(),
    });
  }

  private isMounted(mount: ReadingEntryMount | undefined): boolean {
    return mount !== undefined && this.mount === mount;
  }

  private mark(phase: string, status: string): void {
    const entryId = this.mount?.startupTraceId ?? 0;
    if (entryId > 0) this.diagnostics.mark(entryId, phase, status);
  }

  private elapsed(): number {
    return Math.max(0, this.diagnostics.now() - this.traceStartedAt);
  }
}
