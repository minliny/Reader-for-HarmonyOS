import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingEntryNavigation } from '../application/ReadingEntrySnapshot';
import type { LocalReadingBookmark, LocalReadingContentMetrics, LocalReadingProgress,
  LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { ReadingContentSearchResult, ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { RemoteReadingPositionContext, RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { remoteReadingFailureKindOf } from '../application/RemoteContentAdmission';
import type { ReaderControlSelectionCommit, ReaderControlSelectionDisplayAnchor, ReaderControlSelectionOwner,
  ReaderControlSelectionStoredProgress, ReaderControlSelectionTicket } from '../application/ReaderControlSelectionTransaction';
import { projectReaderChapterBookmarkExcerpts, ReaderControlBookmarkRead, readerBookmarkReadFailureSuperseded,
  type ReaderControlBookmarkReadIntent } from '../presentation/ReaderBookmarkProjection';
import { ReaderChapterSelectionOwner, ReaderDeferredChapterSelection, type ReaderChapterSelectionDispatch,
  type ReaderChapterSelectionPresentation, type ReaderChapterSelectionScope } from '../presentation/ReaderChapterSelectionOwner';
import { ReaderControlCatalogRouting, ReaderControlSelectionObservations, readerControlBookmarkPosition,
  type ReaderControlCatalogRoutingHost, type ReaderControlCatalogTarget, type ReaderControlDeferredCatalogSelection,
  type ReaderControlObservedCommit, type ReaderControlSelectionObservationHost,
  type ReaderDirectorySelectionFacts, type ReaderQuickSearchSelectionFacts } from '../presentation/ReaderControlSelectionRouting';
import { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import { projectReaderControlDirectoryTitles, readerEntryNavigationItem } from '../presentation/ReaderDirectoryProjection';
import { ReaderControlSelectionOrigin, type ReaderControlSelectionCandidate, type ReaderControlSelectionDisplay,
  type ReaderMaterializedChapterContext } from '../presentation/ReaderPagePresentationModels';
import { readingFailureHint } from '../presentation/ReadingFailurePresentation';
import { readerControlContentLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderTtsFollowLease } from './ReaderTtsPageFollow';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';

const LOCAL_READING_SOURCE_ID = 'local';
const EMPTY_CONTROL_DIRECTORY_ENTRIES: LocalReadingTocEntry[] = [];

export interface ReaderControlDirectoryDataPort {
  readonly parentEntries: () => LocalReadingTocEntry[];
  readonly tocEntries: () => LocalReadingTocEntry[];
  readonly catalogPending: () => boolean;
  readonly catalogNavigation: () => ReadingEntryNavigation | undefined;
  readonly readingToc: () => LocalReadingTocEntry[];
  readonly hydrateCatalog: () => Promise<void>;
  readonly contentMetrics: () => LocalReadingContentMetrics | undefined;
  readonly chapterWindow: ReadingChapterWindow;
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly chapterMap: () => ReadingSurfaceLayoutMap | undefined;
  readonly currentChapterIndex: () => number;
  readonly adjacentChapter: (chapterIndex: number, delta: number) => number | undefined;
  readonly isKnownChapter: (chapterIndex: number) => boolean;
}

export interface ReaderControlDirectoryScopePort {
  readonly scope: () => ReaderChapterSelectionScope;
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly selectionActive: (lifecycle: number, selection: number) => boolean;
  readonly nextSelection: () => number;
  readonly session: () => ReaderControlSessionState;
  readonly visualSession: () => ReaderControlSessionState;
  readonly controlVisible: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly controlClosing: () => boolean;
  readonly openRevision: () => number;
  readonly moduleVisit: () => number;
  readonly foreground: () => boolean;
  readonly windowChromeActive: () => boolean;
  readonly uiContext: () => UIContext;
  readonly verification: () => ReaderControlVerificationSession;
}

export interface ReaderControlDirectoryBookmarkPort {
  readonly message: () => string;
  readonly read: (sourceId: string, bookId: string, isCurrent: () => boolean) => Promise<void>;
  readonly publishFailed: (failed: boolean) => void;
  readonly reconcileChangedMarkers: () => void;
}

export interface ReaderControlDirectoryActionsPort {
  readonly gateway: () => ReadingSessionFlowGateway;
  readonly yieldPrefetchForDownload: () => void;
  readonly downloadBook: () => void;
  readonly downloadChapter: (chapterIndex: number) => void;
  readonly clearChapterEndTimer: () => void;
  readonly prepareSelection: (request: ReaderDeferredChapterSelection) => boolean;
  readonly queueOnSettlement: (request: ReaderDeferredChapterSelection) => boolean;
  readonly interruptPlayback: (stopTts: boolean) => void;
  readonly loadSelection: (request: ReaderDeferredChapterSelection, lifecycle: number, selection: number) => void;
  readonly closeControl: () => void;
  readonly reopenRefreshed: (ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
    context: RemoteReadingPositionContext) => Promise<void>;
}

export interface ReaderControlDirectoryDisplayPort {
  readonly visiblePage: () => PhysicalReadingPage | undefined;
  readonly committed: () => ReadingCommit | undefined;
  readonly continuous: () => boolean;
  readonly visibleScalar: () => number;
  readonly pageToken: () => number;
  readonly materializedToken: () => number;
  readonly materializedCurrent: () => boolean;
  readonly captureMaterialized: () => ReaderMaterializedChapterContext;
  readonly preparationOrigin: () => ReaderMaterializedChapterContext | undefined;
  readonly preparedChapter: () => ReadingSessionChapter | undefined;
  readonly layoutSignature: () => string;
  readonly ready: () => boolean;
  readonly stablePage: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number) => boolean;
  readonly chapterCommitted: (chapterIndex: number, chapterTitle: string) => void;
  readonly presentationReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number) => boolean;
  readonly finishTrace: (lifecycle: number) => void;
  readonly beginRetainedFailure: (ticket: ReaderControlSelectionTicket) => void;
  readonly resetAfterSelectionFailure: () => void;
  readonly invalidateUnverifiedDisplay: () => void;
  readonly publishFailure: (code: string, hint: (admittedCode: string) => string) => void;
  readonly retireFailedTurn: () => void;
  readonly showRecovery: (message: string, label: string, retry: () => void) => void;
  readonly restoreVerified: (display: ReaderControlSelectionDisplay, stored: ReaderControlSelectionStoredProgress) => void;
  readonly releaseImages: () => void;
}

/** Owns the directory's stable publication, bookmark read generation and
 * selection transaction. Mounted rendering and progress still use their
 * original owners to apply an accepted display or recover a failed one. */
export class ReaderControlDirectoryOperationsHost {
  readonly publication: ReaderDirectoryDataPublication = new ReaderDirectoryDataPublication();
  readonly selection: ReaderChapterSelectionOwner<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin,
    ReaderControlSelectionCandidate>;
  private readonly catalogRouting: ReaderControlCatalogRouting;
  private readonly observations: ReaderControlSelectionObservations;
  private readonly bookmarkRead: ReaderControlBookmarkRead = new ReaderControlBookmarkRead();
  private readonly data: ReaderControlDirectoryDataPort;
  private readonly view: ReaderControlDirectoryScopePort;
  private readonly bookmarks: ReaderControlDirectoryBookmarkPort;
  private readonly actions: ReaderControlDirectoryActionsPort;
  private readonly display: ReaderControlDirectoryDisplayPort;
  private readonly transientFeedback: ReaderTransientFeedback;
  private directoryRetained: boolean = false;
  private parentSource: LocalReadingTocEntry[] | undefined = undefined;
  private tocSource: LocalReadingTocEntry[] | undefined = undefined;
  private projection: LocalReadingTocEntry[] = [];
  private excerptSource: LocalReadingTocEntry[] | undefined = undefined;
  private excerptChapter: ReadingSessionChapter | undefined = undefined;
  private excerptProjection: LocalReadingTocEntry[] = [];
  private readonly excerptCache: Map<string, string> = new Map<string, string>();
  private bookmarkFailed: boolean = false;

  constructor(data: ReaderControlDirectoryDataPort, view: ReaderControlDirectoryScopePort,
    bookmarks: ReaderControlDirectoryBookmarkPort, actions: ReaderControlDirectoryActionsPort,
    display: ReaderControlDirectoryDisplayPort, feedback: ReaderTransientFeedback) {
    this.data = data;
    this.view = view;
    this.bookmarks = bookmarks;
    this.actions = actions;
    this.display = display;
    this.transientFeedback = feedback;
    const catalog: ReaderControlCatalogRoutingHost = {
      canDispatch: (): boolean => this.canDispatchChapterIntent(),
      isCatalogPending: (): boolean => this.data.catalogPending(),
      captureControlOwner: (): (() => boolean) => this.captureCatalogOwner(),
      hydrate: (): Promise<void> => this.data.hydrateCatalog(),
      findAdjacent: (delta: number): number | undefined => this.data.adjacentChapter(this.data.currentChapterIndex(), delta),
      metrics: (): LocalReadingContentMetrics | undefined => this.data.contentMetrics(),
      catalogLength: (): number => this.data.readingToc().length,
      dispatch: (target: ReaderControlCatalogTarget): void => this.dispatchCatalogTarget(target),
      warn: (action: string, error: Error): void =>
        hilog.warn(0x5244, 'Reader', `Reading ${action} catalog: %{private}s`, errorMessageOf(error)),
    };
    this.catalogRouting = new ReaderControlCatalogRouting(catalog);
    const dispatch: ReaderChapterSelectionDispatch = {
      prepare: (request: ReaderDeferredChapterSelection): boolean => this.actions.prepareSelection(request),
      scope: (): ReaderChapterSelectionScope => this.view.scope(),
      owner: (): ReaderControlSelectionOwner => this.selectionOwner(),
      nextSelection: (): number => this.view.nextSelection(),
      adoptControlRevision: (): number => this.view.controlVisible() && !this.view.controlClosing() ? this.view.openRevision() : -1,
      openRevision: (): number => this.view.openRevision(),
      selectionActive: (lifecycle: number, selection: number): boolean => this.view.selectionActive(lifecycle, selection),
      isKnown: (chapterIndex: number): boolean => this.data.isKnownChapter(chapterIndex),
      catalogPending: (): boolean => this.data.catalogPending(),
      deferCatalog: (capture: () => ReaderControlDeferredCatalogSelection): void => this.catalogRouting.deferSelection(capture),
      chapterAt: (chapterIndex: number): ReadingSessionChapter | undefined => this.data.chapterWindow.get(chapterIndex),
      queueOnSettlement: (request: ReaderDeferredChapterSelection): boolean => this.actions.queueOnSettlement(request),
      interruptPlayback: (stopTts: boolean): void => this.actions.interruptPlayback(stopTts),
      resetObservations: (): void => this.observations.reset(),
      load: (request: ReaderDeferredChapterSelection, lifecycle: number, selection: number): void =>
        this.actions.loadSelection(request, lifecycle, selection),
      closeControl: (): void => this.actions.closeControl(),
    };
    const presentation: ReaderChapterSelectionPresentation<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin> = {
      captureVisibleOrigin: (): ReaderControlSelectionOrigin | undefined => this.captureVisibleOrigin(),
      anchor: (display: ReaderControlSelectionDisplay | undefined): ReaderControlSelectionDisplayAnchor | undefined => this.anchor(display),
      matchesLayout: (display: ReaderControlSelectionDisplay): boolean =>
        display.layoutSignature === this.display.layoutSignature() && display.continuous === this.display.continuous(),
      beginFailure: (error: Error): void => this.beginFailure(error),
      invalidateUnverifiedDisplay: (): void => this.display.invalidateUnverifiedDisplay(),
      showFailure: (ticket: ReaderControlSelectionTicket, error: Error, detail: string): void => this.showFailure(ticket, error, detail),
      restore: (display: ReaderControlSelectionDisplay, stored: ReaderControlSelectionStoredProgress): void =>
        this.display.restoreVerified(display, stored),
      completeRestoredTarget: (ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
        stored: ReaderControlSelectionStoredProgress): void =>
        this.completeAfterCommit(stored, display.page, ticket.selectionToken, ticket.lifecycleToken),
      notifyRestored: (ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
        stored: ReaderControlSelectionStoredProgress): void => this.notifyRestored(ticket, display, stored),
      reopenRefreshed: (ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
        context: RemoteReadingPositionContext): Promise<void> => this.actions.reopenRefreshed(ticket, stored, context),
    };
    this.selection = new ReaderChapterSelectionOwner<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin,
      ReaderControlSelectionCandidate>(dispatch, presentation, (): ReadingSessionFlowGateway => this.actions.gateway());
    const observation: ReaderControlSelectionObservationHost = {
      selectionToken: (): number => this.view.scope().selectionToken,
      ticket: (): ReaderControlSelectionTicket | undefined => this.selection.ticket,
      owner: (): ReaderControlSelectionOwner => this.selectionOwner(),
      readingIdentity: (): string => this.view.verification().observationIdentity(),
      publishQuick: (stage: 'selection-admitted' | 'selection-committed', facts: ReaderQuickSearchSelectionFacts): void =>
        this.view.verification().effect('search-results', stage, facts),
      publishDirectory: (stage: 'selection-admitted' | 'selection-committed', facts: ReaderDirectorySelectionFacts): void =>
        this.view.verification().effect('directory-selection', stage, facts),
    };
    this.observations = new ReaderControlSelectionObservations(observation);
  }

  beginMount(): void { this.directoryRetained = false; }

  retainDirectory(): void { this.directoryRetained = true; }

  /** Admission publishes the session TOC before invalidating its merge cache. */
  admitToc(entries: LocalReadingTocEntry[], publish: (entries: LocalReadingTocEntry[]) => void): void {
    if (entries.length > 0) this.retainDirectory();
    publish(entries);
    this.tocSource = undefined;
    this.projection = [];
  }

  publishDirectory(hostVisible: boolean): number {
    return this.publication.publish(hostVisible || this.directoryRetained ? this.entries() : EMPTY_CONTROL_DIRECTORY_ENTRIES);
  }

  entries(): LocalReadingTocEntry[] {
    const entries = this.sourceEntries();
    const chapter = this.data.chapter();
    const map = this.data.chapterMap();
    if (chapter === undefined || map === undefined) return entries;
    if (this.excerptSource === entries && this.excerptChapter === chapter) return this.excerptProjection;
    this.excerptSource = entries;
    this.excerptChapter = chapter;
    this.excerptProjection = entries;
    const projection = projectReaderChapterBookmarkExcerpts(entries, chapter.chapterIndex,
      (mark: LocalReadingBookmark): boolean => this.bookmarkMatchesCurrentChapter(mark),
      (mark: LocalReadingBookmark): string | undefined => this.excerpt(chapter, map, mark));
    if (projection !== entries) this.excerptProjection = projection;
    return projection;
  }

  private sourceEntries(): LocalReadingTocEntry[] {
    if (this.data.catalogPending()) return this.data.tocEntries();
    const entries = this.data.parentEntries();
    const toc = this.data.tocEntries();
    if (entries.length === 0) return toc;
    if (toc === entries) return entries;
    if (this.parentSource === entries && this.tocSource === toc) return this.projection;
    this.projection = projectReaderControlDirectoryTitles(entries, toc);
    this.parentSource = entries;
    this.tocSource = toc;
    return this.projection;
  }

  private excerpt(chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap, mark: LocalReadingBookmark): string | undefined {
    const end = Math.min(map.scalarCount(), mark.chapterOffset + 160);
    if (mark.chapterOffset >= map.scalarCount() || !map.containsScalar(mark.chapterOffset) || !map.containsScalar(end)) return undefined;
    const key = JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex, chapter.contentVersion, mark.time, mark.chapterOffset]);
    let excerpt = this.excerptCache.get(key);
    if (excerpt !== undefined) return excerpt;
    excerpt = chapter.content.substring(map.utf16ForScalar(mark.chapterOffset), map.utf16ForScalar(end));
    if (this.excerptCache.size >= 128) {
      for (const oldest of this.excerptCache.keys()) { this.excerptCache.delete(oldest); break; }
    }
    this.excerptCache.set(key, excerpt);
    return excerpt;
  }

  bookmarkMatchesCurrentChapter(mark: LocalReadingBookmark): boolean {
    if (this.view.scope().sourceId === LOCAL_READING_SOURCE_ID) return true;
    const chapter = this.data.chapter();
    const scope = mark.positionScope;
    return chapter !== undefined && scope !== undefined &&
      scope.sourceId === chapter.sourceId && scope.bookId === chapter.bookId &&
      scope.chapterIndex === chapter.chapterIndex && mark.chapterIndex === chapter.chapterIndex &&
      scope.bodyVersion === chapter.bodyVersion && scope.processingVersion === chapter.processingVersion;
  }

  catalogPosition(): number {
    const navigation = this.data.catalogNavigation();
    return navigation === undefined ? -1 : readerEntryNavigationItem(navigation, this.data.currentChapterIndex())?.position ?? -1;
  }

  loadBookmarks(): void {
    const location = readerControlContentLocation(this.view.session());
    if (!this.view.mounted() || this.view.exiting() || !this.view.controlVisible() ||
      location.level !== 'secondary' || location.module !== 'directory') return;
    const lifecycle = this.view.scope().lifecycleToken;
    this.bookmarkRead.open((ownsGeneration: () => boolean): ReaderControlBookmarkReadIntent => {
      const revision = this.view.openRevision();
      const scope = this.view.scope();
      const entriesAtStart = this.data.parentEntries();
      return {
        isCurrent: (): boolean => {
          const currentLocation = readerControlContentLocation(this.view.session());
          const current = this.view.scope();
          return this.view.active(lifecycle) && ownsGeneration() && revision === this.view.openRevision() &&
            scope.sourceId === current.sourceId && scope.bookId === current.bookId &&
            this.view.controlVisible() && currentLocation.level === 'secondary' && currentLocation.module === 'directory';
        },
        load: (isCurrent: () => boolean): Promise<void> => this.bookmarks.read(scope.sourceId, scope.bookId, isCurrent),
        failed: (error: Error): void => {
          if (readerBookmarkReadFailureSuperseded(this.bookmarks.message(), entriesAtStart, this.data.parentEntries())) return;
          this.setBookmarkFailed(true);
          hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark projection failed: ${error.message}`);
        },
      };
    }, (): void => this.setBookmarkFailed(false));
  }

  refreshBookmarks(chapter: ReadingSessionChapter, lifecycle: number, selection: number): void {
    this.bookmarkRead.refresh((ownsGeneration: () => boolean): ReaderControlBookmarkReadIntent => ({
      isCurrent: (): boolean => this.view.selectionActive(lifecycle, selection) && this.data.chapter() === chapter && ownsGeneration(),
      load: (isCurrent: () => boolean): Promise<void> => this.bookmarks.read(chapter.sourceId, chapter.bookId, isCurrent),
      failed: (_error: Error): void => this.setBookmarkFailed(true),
    }), (): void => this.setBookmarkFailed(false));
  }

  onControlBookmarkFailureChanged(): void {
    if (this.bookmarks.message().length === 0) {
      this.bookmarkRead.clearNotice();
      this.onDirectoryDataChanged();
      return;
    }
    this.setBookmarkFailed(true);
    if (!this.view.mounted() || this.view.exiting() || !this.view.foreground() || !this.view.windowChromeActive()) return;
    const scope = this.view.scope();
    const noticeKey = `${scope.lifecycleToken}:${scope.sourceId}:${scope.bookId}:${this.bookmarks.message()}`;
    if (!this.bookmarkRead.admitNotice(noticeKey)) return;
    try {
      this.transientFeedback.show((): UIContext => this.view.uiContext(), {
        message: `${this.bookmarks.message()}。请打开目录－书签重新载入。`,
      }, (): boolean => this.feedbackCurrent());
    } catch (error) {
      hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark notice unavailable: ${(error as Error).message}`);
    }
  }

  onDirectoryDataChanged(): void {
    this.bookmarks.reconcileChangedMarkers();
    const entries = this.data.parentEntries();
    if (entries.length > 0) this.retainDirectory();
    const location = readerControlContentLocation(this.view.session());
    if (!this.view.controlVisible() || location.level !== 'secondary' || location.module !== 'directory') return;
    if (this.bookmarks.message().length > 0) {
      if (!this.bookmarkRead.isPending()) this.setBookmarkFailed(true);
      return;
    }
    const unknown = entries.some((entry: LocalReadingTocEntry): boolean => entry.bookmarks === undefined);
    if (!unknown) this.setBookmarkFailed(false);
    else if (!this.bookmarkRead.isPending() && !this.bookmarkFailed) this.loadBookmarks();
  }

  private setBookmarkFailed(failed: boolean): void {
    this.bookmarkFailed = failed;
    this.bookmarks.publishFailed(failed);
  }

  private feedbackCurrent(): boolean {
    return this.view.active(this.view.scope().lifecycleToken) && this.view.foreground() && this.view.windowChromeActive();
  }

  requestDownload(chapterIndex?: number): void {
    this.actions.yieldPrefetchForDownload();
    const lifecycle = this.view.scope().lifecycleToken;
    const current = (): boolean => this.view.active(lifecycle);
    void this.actions.gateway().ensureRemoteSession(current).then((): void => {
      if (!current()) return;
      if (chapterIndex === undefined) this.actions.downloadBook();
      else this.actions.downloadChapter(chapterIndex);
    }).catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', 'Reading download admission: %{private}s', errorMessageOf(error));
    });
  }

  selectBookmarkAnchor(chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope,
    directoryTargetProof?: ReaderDirectoryTargetProof): void {
    let context: RemoteReadingPositionContext | undefined;
    try {
      const scope = this.view.scope();
      context = readerControlBookmarkPosition({ sourceId: scope.sourceId, bookId: scope.bookId,
        local: scope.sourceId === LOCAL_READING_SOURCE_ID, chapterIndex, chapterOffset, positionScope, directoryTargetProof });
    } catch (_) {
      try {
        this.transientFeedback.show((): UIContext => this.view.uiContext(), {
          message: '该位置的正文版本暂时无法确认，已保留原书签和阅读位置，请从目录打开章节',
        }, (): boolean => this.feedbackCurrent());
      } catch (_) {}
      return;
    }
    this.actions.clearChapterEndTimer();
    this.selectAnchor(chapterIndex, chapterOffset, false, true, undefined, -2, true, false, context);
  }

  selectChapter(chapterIndex: number): void {
    if (!this.data.isKnownChapter(chapterIndex)) {
      if (this.data.catalogPending()) this.selectAnchor(chapterIndex, 0, true);
      return;
    }
    const origin = this.selection.captureOrigin();
    if (this.selection.ticket === undefined && origin !== undefined &&
      chapterIndex === origin.committedProgress.chapterIndex) {
      this.actions.closeControl();
      return;
    }
    this.actions.clearChapterEndTimer();
    this.observeDirectorySelection(chapterIndex, origin?.committedProgress.chapterIndex ?? -1,
      (): void => this.selectAnchor(chapterIndex, 0, true));
  }

  selectNavigationTarget(chapterIndex: number, chapterOffset: number,
    positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void {
    const from = chapterOffset === 0 && this.view.verification().observing() ?
      this.selection.captureOrigin()?.committedProgress.chapterIndex ?? -1 : -1;
    this.observeDirectorySelection(chapterIndex, from,
      (): void => this.selectBookmarkAnchor(chapterIndex, chapterOffset, positionScope, directoryTargetProof));
  }

  private observeDirectorySelection(chapterIndex: number, fromChapterIndex: number, dispatch: () => void): void {
    const visual = this.view.visualSession();
    const location = readerControlContentLocation(visual);
    const verification = this.view.verification();
    const readingId = verification.observing() && this.view.scope().sourceId === LOCAL_READING_SOURCE_ID &&
      location.level === 'secondary' && location.module === 'directory' && location.directoryTab === 'directory' &&
      location.form === 'full' ? verification.observationIdentity() : '';
    this.observations.observeDirectory({ readingId, fromChapterIndex, chapterIndex, readEpoch: (): number => visual.epoch }, dispatch);
  }

  observeQuickSelection(readingId: string, scope: number, ordinal: number, epoch: number, target: ReadingContentSearchResult): void {
    this.observations.observeQuick({ readingId, scope, ordinal, epoch, target },
      (): void => this.selectBookmarkAnchor(target.chapterIndex, target.chapterOffset, target.positionScope));
  }

  private canDispatchChapterIntent(): boolean {
    return this.view.controlInputEnabled() && this.view.controlVisible() && !this.view.controlClosing();
  }

  private captureCatalogOwner(): () => boolean {
    const scope = this.view.scope();
    const chapterIndex = this.data.currentChapterIndex();
    const revision = this.view.openRevision();
    const visit = this.view.moduleVisit();
    return (): boolean => {
      if (!this.view.selectionActive(scope.lifecycleToken, scope.selectionToken) || !this.canDispatchChapterIntent()) return false;
      const current = this.view.scope();
      return scope.sourceId === current.sourceId && scope.bookId === current.bookId &&
        chapterIndex === this.data.currentChapterIndex() && revision === this.view.openRevision() && visit === this.view.moduleVisit();
    };
  }

  invalidateCatalog(): void { this.catalogRouting.invalidate(); }
  step(delta: number): void { this.catalogRouting.step(delta); }
  seek(percent: number): void { this.catalogRouting.seek(percent); }

  private dispatchCatalogTarget(target: ReaderControlCatalogTarget): void {
    this.actions.clearChapterEndTimer();
    if (target.kind === 'head') this.selectAnchor(target.chapterIndex, 0, true);
    else if (target.kind === 'exact') this.selectAnchor(target.chapterIndex, target.chapterOffset, false, true, undefined, -2, false);
    else this.selectAnchor(this.data.readingToc()[target.position].index, 0, false, true, target.chapterProgress, -2, false);
  }

  selectAnchor(chapterIndex: number, chapterOffset: number, requireChapterStart: boolean, stopTts: boolean = true,
    requestedProgress?: number, controlOwnerRevision: number = -2, closeControlOnCommit: boolean = true,
    refreshContent: boolean = false, positionContext?: RemoteReadingPositionContext, ttsOwner?: ReaderTtsFollowLease): void {
    this.selection.select(new ReaderDeferredChapterSelection(chapterIndex, chapterOffset, requireChapterStart, stopTts,
      requestedProgress, controlOwnerRevision, closeControlOnCommit, refreshContent, positionContext, ttsOwner));
  }

  private selectionOwner(): ReaderControlSelectionOwner {
    const scope = this.view.scope();
    return {
      sourceId: scope.sourceId, bookId: scope.bookId, lifecycleToken: scope.lifecycleToken, selectionToken: scope.selectionToken,
      controlOpenRevision: this.view.openRevision(), mounted: this.view.mounted(), exitRequested: this.view.exiting(),
      controlVisible: this.view.controlVisible(), controlClosing: this.view.controlClosing(),
    };
  }

  private captureVisibleOrigin(): ReaderControlSelectionOrigin | undefined {
    const page = this.display.visiblePage();
    const committed = this.display.committed();
    const continuous = this.display.continuous();
    const visibleScalar = continuous ? this.display.visibleScalar() : (page?.startScalar ?? 0);
    if (this.display.materializedCurrent() && page !== undefined && committed !== undefined &&
      this.matchesVisibleCommit(committed, page, continuous, this.data.chapter()?.chapterIndex)) {
      return new ReaderControlSelectionOrigin(this.display.captureMaterialized(), page, committed,
        visibleScalar, continuous, this.display.layoutSignature());
    }
    const origin = this.display.preparationOrigin();
    if (origin !== undefined && page !== undefined && committed !== undefined &&
      this.matchesVisibleCommit(committed, page, continuous, origin.chapter.chapterIndex)) {
      return new ReaderControlSelectionOrigin(origin, page, committed, visibleScalar, continuous, this.display.layoutSignature());
    }
    return undefined;
  }

  private matchesVisibleCommit(committed: ReadingCommit, page: PhysicalReadingPage, continuous: boolean,
    chapterIndex: number | undefined): boolean {
    const scope = this.view.scope();
    return this.display.pageToken() === scope.selectionToken && committed.sourceId === scope.sourceId &&
      committed.bookId === scope.bookId && committed.chapterIndex === chapterIndex &&
      (continuous || committed.chapterOffset === page.startScalar);
  }

  completeAfterCommit(stored: LocalReadingProgress, page: PhysicalReadingPage, selection: number, lifecycle: number): void {
    this.selection.complete(selection, lifecycle, (): ReaderControlSelectionCommit => ({
      phaseReady: this.display.ready(), materializedSelectionToken: this.display.materializedToken(),
      visibleSelectionToken: this.display.pageToken(), visibleChapterIndex: this.data.chapter()?.chapterIndex ?? -1,
      visiblePageStartScalar: page.startScalar, storedChapterIndex: stored.chapterIndex, storedChapterOffset: stored.chapterOffset,
    }), (ticket: ReaderControlSelectionTicket, owner: ReaderControlSelectionOwner): void => {
      this.observations.complete(ticket, owner, (): ReaderControlObservedCommit => ({
        phaseReady: this.display.ready(), materializedSelectionToken: this.display.materializedToken(),
        visibleSelectionToken: this.display.pageToken(), visibleChapterIndex: this.data.chapter()?.chapterIndex,
        storedChapterIndex: stored.chapterIndex, storedChapterOffset: stored.chapterOffset,
        pageStartScalar: page.startScalar, pageEndScalar: page.endScalar,
      }));
    });
  }

  private beginFailure(error: Error): void {
    const ticket = this.selection.ticket;
    if (ticket !== undefined) this.display.beginRetainedFailure(ticket);
    this.display.resetAfterSelectionFailure();
    this.publishFailure(error);
  }

  private anchor(display: ReaderControlSelectionDisplay | undefined): ReaderControlSelectionDisplayAnchor | undefined {
    if (display === undefined) return undefined;
    return {
      chapterIndex: display.context.chapter.chapterIndex, pageStartScalar: display.page.startScalar,
      visibleScalar: display.visibleScalar, scalarCount: display.context.layoutMap.scalarCount(),
      continuous: display.continuous, bodyVersion: display.context.chapter.bodyVersion,
      processingVersion: display.context.chapter.processingVersion,
    };
  }

  private notifyRestored(ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
    stored: ReaderControlSelectionStoredProgress): void {
    if (this.notifyReadingReady(stored.chapterIndex, display.context.chapter.chapterTitle,
      display.page, ticket.selectionToken, ticket.lifecycleToken)) this.display.releaseImages();
  }

  notifyReadingReady(chapterIndex: number, chapterTitle: string, page: PhysicalReadingPage | undefined = this.display.visiblePage(),
    selection: number = this.view.scope().selectionToken, lifecycle: number = this.view.scope().lifecycleToken): boolean {
    const materialized = this.data.chapter();
    const chapter = materialized?.chapterIndex === chapterIndex ? materialized : this.display.preparedChapter();
    const isCurrent = (): boolean => page !== undefined && chapter !== undefined && chapter.chapterIndex === chapterIndex &&
      this.display.ready() && this.display.stablePage(page, chapter, selection, lifecycle);
    if (!isCurrent()) return false;
    try { this.display.chapterCommitted(chapterIndex, chapterTitle); }
    catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience chapter observer failed: ${(error as Error).message}`);
    }
    if (!isCurrent()) return false;
    const delivered = this.display.presentationReady(chapter as ReadingSessionChapter, page as PhysicalReadingPage, selection, lifecycle);
    if (delivered) this.display.finishTrace(lifecycle);
    return delivered;
  }

  private showFailure(ticket: ReaderControlSelectionTicket, error: Error, detail: string): void {
    this.publishFailure(error);
    this.display.retireFailedTurn();
    const retry = this.selection.retryAction(ticket);
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience control selection failed: ${error.message}; ${detail}`);
    this.display.showRecovery(ticket.refreshContent === true ? '本章暂未刷新，原书签和记录已保留。' :
      '暂未跳转，原阅读位置已保留。', '重试', retry);
  }

  private publishFailure(error: Error): void {
    this.display.publishFailure(error.message, (admittedCode: string): string =>
      readingFailureHint(admittedCode, remoteReadingFailureKindOf(error)));
  }
}
