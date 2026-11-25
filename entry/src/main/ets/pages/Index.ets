import { sourceSwitchTriggerFocusId } from '../features/source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderDirectoryTargetProof } from '../features/reading/application/ReaderDirectoryTargetProof';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../ui/feedback/ReaderTransientFeedback';
import { ReaderNativeAlertOwner, type ReaderNativeAlertLease, type ReaderNativeAlertOptions, type ReaderNativeAlertSpecId } from '../ui/platform/ReaderNativeAlertOwner';
import { ReaderNativeAlertWindow } from '../ui/platform/ReaderNativeAlertWindow';
import { ReaderDocumentPickerActivity } from '../platform/ReaderDocumentPickerActivity';
import { MangaPositionHydrator, type MangaPositionCandidate, type MangaPositionScene } from '../features/manga/presentation/MangaPositionHydrator';
import { MangaSourceLogin, type MangaSourceLoginScene } from '../features/manga/presentation/MangaSourceLogin';
import { FrameCallback } from '@kit.ArkUI';
import { readerAppColor } from '../ui/foundation/ReaderThemeRegistry';
import { BookshelfGroupDialog } from '../features/bookshelf/ui/BookshelfGroupDialog';
import { BookshelfGroupPresentation } from '../features/bookshelf/presentation/BookshelfGroupPresentation';
import type { SearchHost } from '../features/search/application/SearchHost';
import { ReaderLibrarySearchSurface } from '../features/search/ui/ReaderLibrarySearchSurface';
import { LibrarySearchPresentation } from '../features/search/presentation/LibrarySearchPresentation';
import { LibrarySearchResults } from '../features/search/ui/LibrarySearchResults';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { ReaderUIVerificationProbe, type ReaderUIVerificationChannel } from '../app/diagnostics/ReaderUIVerificationProbe';
import { ReaderEntryStartupTrace, ReaderStartupTrace, type ReaderShelfEntryPhase } from '../app/ReaderStartupTrace';
import { ReaderExitActions, type ReaderExitActionPorts } from '../app/composition/ReaderExitActions';
import type { SystemFileOpenReaderIdentity } from '../app/navigation/ReaderSystemFileOpenNavigationHost';
import { errorMessageOf } from '../app/ErrorMessage';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerContentSafeTop } from '../ui/foundation/ReaderWindowMetrics';
import type {
  ShelfBook,
  BookshelfState,
} from '../app/ReaderCoreGateway';
import {
  type BookshelfDataState,
  type BookshelfFilter,
} from '../features/bookshelf/application/BookshelfFlowGateway';
import { BookshelfDetailPresentation } from '../features/bookshelf/presentation/BookshelfDetailPresentation';
import { BookshelfDetailScene, type BookshelfDetailScenePorts } from '../features/bookshelf/ui/BookshelfDetailScene';
import type { BookshelfReadableAdmissionSnapshot } from '../features/bookshelf/application/BookshelfReadableAdmissionOwner';
import type { BookshelfOperationSnapshot } from '../features/bookshelf/application/BookshelfOperationOwner';
import { BookshelfMutationPresentation } from '../features/bookshelf/presentation/BookshelfMutationPresentation';
import { BookshelfImportScene } from '../features/bookshelf/ui/BookshelfImportScene';
import { BookRemovalDialogHost } from '../features/bookshelf/ui/BookRemovalDialogHost';
import { BookRemovalDialogPresentation } from '../features/bookshelf/presentation/BookRemovalDialogPresentation';
import { BookshelfMultiSelectPage } from '../features/bookshelf/ui/BookshelfMultiSelectPage';
import { BookshelfManagementPresentation } from '../features/bookshelf/presentation/BookshelfManagementPresentation';
import { BookshelfManagementSurface } from '../features/bookshelf/ui/BookshelfManagementSurface';
import {
  BookshelfHost,
  type BookshelfManagementSnapshot,
} from '../features/bookshelf/application/BookshelfHost';
import { BookshelfReadPresentation, type BookshelfProjectionScene } from '../features/bookshelf/presentation/BookshelfReadPresentation';
import type { BookshelfProjectionOwner, BookshelfProjectionSnapshot } from '../features/bookshelf/application/BookshelfProjectionOwner';
import { BookshelfCatalogPresentation } from '../features/bookshelf/presentation/BookshelfCatalogPresentation';
import { BookshelfScene, type BookshelfSceneDestination, type BookshelfScenePorts } from '../features/bookshelf/ui/BookshelfScene';
import type { BookshelfDetailReturnFocus } from '../features/bookshelf/presentation/BookshelfViewState';
import type { BookshelfCatalogOwner } from '../features/bookshelf/application/BookshelfCatalogOwner';
import type { BookshelfNamedSource } from '../features/bookshelf/application/BookshelfSourceNameProjection';
import { DiscoverScenePresentation } from '../features/discover/presentation/DiscoverScenePresentation';
import { DiscoverSurface } from '../features/discover/ui/DiscoverSurface';
import type { DiscoverBook } from '../features/discover/application/DiscoverGateway';
import { RetainedReaderScene, type RetainedReaderScenePorts } from '../app/composition/RetainedReaderScene';
import { ReaderReadingEntryActions, type ReaderReadingEntryActionPorts } from '../app/composition/ReaderReadingEntryActions';
import { DetailDirectoryScene } from '../features/reading/ui/DetailDirectoryScene';
import { ReaderDirectoryJourney, type ReaderDirectoryJourneyPorts, type ReaderDirectoryJourneyScope } from '../app/composition/ReaderDirectoryJourney';
import { ReaderSourceSwitchSurfaces } from '../app/composition/ReaderSourceSwitchSurfaces';
import { ReaderSourceSwitchJourney, type ReaderSourceSwitchJourneyPorts, type ReaderSourceSwitchScope } from '../app/composition/ReaderSourceSwitchJourney';
import { readerSourceSwitchActions, type ReaderSourceSwitchActions } from '../app/composition/ReaderSourceSwitchActions';
import { ReaderTransientToast } from '../ui/feedback/ReaderTransientToast';
import type { ReaderSurfaceRect } from '../ui/layout/ReaderSurfaceRect';
import { LOCAL_SOURCE_ID } from '../features/reading/application/LocalReadingFlowGateway';
import type { ReadingBookDetail } from '../features/reading/presentation/ReadingBookDetail';
import { ReadingEntryPresentation, type ReadingEntryPorts, type CachedChapterRecoveryPorts,
  type ReaderExitRequest, type ReadingShelfPreparationScene, type ReadingDirectoryNavigationPorts,
  type ReadingShelfEntryIntent } from '../features/reading/presentation/ReadingEntryPresentation';
import {
  RemoteChapterCacheRefreshError,
  type RemoteReadingBookSeed,
  type RemoteReadingSession,
} from '../features/reading/application/RemoteReadingFlowGateway';
import { ReadingCommitPresentation, type ReadingCommitScene, type ReadingCommitPorts } from '../features/reading/presentation/ReadingCommitPresentation';
import { MangaSourceSwitchPresentation, type MangaSourceSwitchPorts, type MangaSourceSwitchScene } from '../features/manga/presentation/MangaSourceSwitchPresentation';
import type {
  SearchBook,
} from '../features/search/application/SearchGateway';
import { RssJourneyPresentation, type RssRoute } from '../features/rss/presentation/RssJourneyPresentation';
import { RssJourneySurface } from '../features/rss/ui/RssJourneySurface';
import { SettingsPresentation, type SettingsRoute } from '../features/settings/presentation/SettingsPresentation';
import { SettingsScenes, type SettingsDestination } from '../app/composition/SettingsScenes';
import { ReaderWideSettingsShell } from '../features/settings/ui/ReaderWideSettingsShell';
import type { SettingsPane } from '../features/settings/presentation/SettingsNavigationItems';
import { ReaderLibraryAcquisitionBinding } from '../app/composition/ReaderLibraryAcquisitionBinding';
import { ReaderLibraryJourney, type ReaderLibraryJourneyPorts, type ReaderLibraryScope,
  type ReaderLibraryHeaderActions } from '../app/composition/ReaderLibraryJourney';
import { ReaderSettingsJourney, type ReaderSettingsJourneyPorts, type ReaderSettingsJourneyScope } from '../app/composition/ReaderSettingsJourney';
import { ReaderSourceJourney, type ReaderSourceJourneyPorts, type ReaderSourceJourneyScope } from '../app/composition/ReaderSourceJourney';
import { ReaderDownloadJourney, type ReaderDownloadJourneyPorts, type ReaderDownloadJourneyScope } from '../app/composition/ReaderDownloadJourney';
import { ReaderJourneyRecoveryNotices } from '../app/composition/ReaderJourneyRecoveryNotices';
import { readerLegacySnapshotRecoveryView } from '../app/ReaderRecoveryProjection';
import { SharedDownloadScene } from '../features/downloads/ui/SharedDownloadScene';
import { SharedDownloadPresentation, type DownloadReadingEntry } from '../features/downloads/presentation/SharedDownloadPresentation';
import type { SharedDownloadOpeningIntent } from '../features/downloads/presentation/SharedDownloadUiContract';
import { RulesManagementPresentation } from '../features/settings/presentation/RulesManagementPresentation';
import { RulesManagementSurface, rulesManagementImportFocus } from '../features/settings/ui/RulesManagementSurface';
import { SourceJourneyPresentation } from '../features/source/presentation/SourceJourneyPresentation';
import { SourceJourneySurface } from '../features/source/ui/SourceJourneySurface';
import type { SourceSwitchProbeQuery } from '../features/source/application/SourceSwitchGateway';
import type { SourceSwitchHost, SourceSwitchPendingTransaction } from '../features/source/application/SourceSwitchHost';
import { SourceSwitchPresentation, sourceSwitchProbeQuery, type SourceSwitchScene,
  type SourceSwitchWorkflowPorts } from '../features/source/presentation/SourceSwitchPresentation';
import { SyncPresentation } from '../features/sync/presentation/SyncPresentation';
import { SyncSurface } from '../features/sync/ui/SyncSurface';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerExpandedLayout } from '../ui/layout/ReaderLayoutCapability';
import { ArkWebExecutionHost } from '../ui/platform/ArkWebExecutionHost';
import { JsonImportDialog } from '../app/composition/JsonImportDialog';
import { JsonImportPresentation, type JsonImportOpening } from '../app/composition/JsonImportPresentation';
import { isReaderProductSurfaceEnabled } from '../app/ReaderProductScope';
import { ReaderNavigation, retainedReaderRoute, type DetailReturnRoute, type DirectoryReturnTarget,
  type ReaderNavigationSnapshot, type ReaderReturnContext, type ReaderRoute, type SettingsSection,
  type ReaderBackTarget, type ReaderRouteMotionKind, type TemporaryBackScope } from '../app/navigation/ReaderNavigation';
import { readerSceneTransition, READER_ROUTE_PARENT_DIM, READER_ROUTE_PARENT_PARALLAX } from '../app/navigation/ReaderRouteMotion';
import { motionAnimateParam } from '../ui/foundation/MotionSpec';
import { ReaderRouteStackSurface, type ReaderRouteSurfaceKey } from '../app/navigation/ReaderRouteStackSurface';
import { ReaderPostLayoutFrame } from '../ui/layout/ReaderPostLayoutFrame';
import { ReaderLayoutDebugOverlay } from '../app/composition/ReaderLayoutDebugOverlay';

const DOMAIN = 0x5244;




class ReaderSourceFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

class ReaderNavigationBackfillFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

let rssIndexInstance: number = 0;


@Entry
@Component
struct Index {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  private readonly entryStartupTrace: ReaderEntryStartupTrace = new ReaderEntryStartupTrace(
    (phase: ReaderShelfEntryPhase, attempt: number, navigation: number, elapsedMs: number): void => {
      hilog.info(DOMAIN, 'Reader',
        'PERF shelf-entry phase=%{public}s attempt=%{public}d navigation=%{public}d elapsedMs=%{public}d',
        phase, attempt, navigation, elapsedMs);
    });
  @State private shelfMutations: BookshelfMutationPresentation = new BookshelfMutationPresentation({
    host: (): BookshelfHost => this.bookshelfHost,
    owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner,
    isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
    route: (): string => this.route, generation: (): number => this.navigationGeneration,
    mounting: (): number => this.detailShelfAdmissionMount, instance: (): number => this.rssInstanceIdentity,
    retired: (): boolean => this.shelfReceiptRetired, filter: (): BookshelfFilter => this.shelfFilter(),
    pickerInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput,
    invalidate: (): void => this.invalidateBookshelfProjection(),
    refreshShelf: (): void => this.refreshBookshelf(),
    apply: (shelf: BookshelfDataState): void => this.applyBookshelfState(shelf),
    readSelection: (): Promise<BookshelfState | undefined> => this.shelfRead.selection(),
    shelfProjection: (): BookshelfProjectionSnapshot => this.shelfRead.snapshot,
    readingActive: (): boolean => this.readingEntry.sessionActive,
    selectionMatches: (selection: BookshelfState, current: () => boolean, filter?: BookshelfFilter): Promise<boolean | undefined> =>
      this.shelfRead.selectionMatches(selection, current, filter),
    confirmRemoval: (message: string, action: () => void): void => this.openBookRemovalDialog(message, action),
    leaveSelection: (): void => this.libraryJourney.returnToBookshelf(),
    finishSelection: (): void => this.libraryJourney.finishSelection(),
    feedback: (message: string, current: () => boolean): void => {
      this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
        (): boolean => this.searchAppForeground && current());
    },
  });
  private shelfReceiptRetired: boolean = false;
  private nativeAlertOwner: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private nativeAlertWindowUnsubscribe: (() => void) | undefined = undefined;
  private documentPickerUnsubscribe: (() => void) | undefined = undefined;
  @State private shelfGroupPresentation: BookshelfGroupPresentation = new BookshelfGroupPresentation();
  @State private shelfRead: BookshelfReadPresentation = new BookshelfReadPresentation({
    scene: (): BookshelfProjectionScene | undefined => this.bookshelfProjectionScene(),
    projection: (owner: ReaderRuntimeOwner): BookshelfProjectionOwner | undefined => this.bookshelfHost.projection(owner),
    sources: (): BookshelfNamedSource[][] => [this.librarySearch.host.sources(), this.sourceJourney.snapshot().sources,
      this.sourceJourney.snapshot().tools.sources],
    membership: (books: ShelfBook[]): void => this.librarySearch.host.updateShelf(books),
    accepted: (state: BookshelfDataState): void => this.libraryJourney.acceptShelfState(state),
    ready: (): void => this.traceStartupStage?.('shelf.model-ready', 'ready'),
    beginRead: (): number => this.beginStartupStage?.('shelf.query') ?? -1,
    endRead: (startedAt: number, status: string): void => this.endStartupStage?.('shelf.query', startedAt, status),
  });
  @State private downloadPresentation: SharedDownloadPresentation = new SharedDownloadPresentation();
  @State private shelfCatalog: BookshelfCatalogPresentation = new BookshelfCatalogPresentation({
    scene: (): BookshelfProjectionScene | undefined => this.bookshelfProjectionScene(),
    catalog: (owner: ReaderRuntimeOwner): BookshelfCatalogOwner | undefined => this.bookshelfHost.catalog(owner),
    automaticAllowed: (): boolean => this.settingsPresentation.autoCheckUpdateEnabled() &&
      !this.readingEntry.sessionActive && this.searchAppForeground,
    revision: (): string => this.shelfRead.snapshot.revision,
    filter: (): BookshelfFilter => this.shelfRead.filter(),
    project: (state: BookshelfDataState): void => {
      this.shelfRead.invalidate();
      this.shelfRead.accept(state, true);
    },
    prefetch: (session: RemoteReadingSession, current: () => boolean, owner: ReaderRuntimeOwner): Promise<void> =>
      this.readingCommits.prefetch(session, undefined, current, owner),
    feedback: (message: string, current: () => boolean): void => {
      this.transientFeedback.show(() => this.getUIContext(),
        { message, duration: READER_FEEDBACK_EXTENDED_MS }, (): boolean => this.searchAppForeground && current());
    },
  });
  private readonly bookRemovalConfirmation: BookRemovalDialogPresentation = new BookRemovalDialogPresentation();
  @State private shelfManagement: BookshelfManagementPresentation = new BookshelfManagementPresentation();
  private readonly navigationOwner: ReaderNavigation = new ReaderNavigation();
  private arkWebBack: (() => boolean) | undefined = undefined;
  private detailMoreBack: (() => boolean) | undefined = undefined;
  private detailMoreBackIdentity: string = '';
  @State private arkWebCapturesInput: boolean = false;
  @State @Watch('onSearchVisibilityChanged') private route: ReaderRoute = this.navigationOwner.snapshot().route;
  @State private navigationGeneration: number = this.navigationOwner.snapshot().generation;
  @State private directoryReturnTarget: DirectoryReturnTarget = this.navigationOwner.snapshot().directoryReturnTarget;
  @State private settingsSection: SettingsSection = this.navigationOwner.snapshot().settingsSection;
  @State private wideSettingsCollapsed: boolean = false;
  @State private wideSettingsLane: ReaderRouteSurfaceKey = 'settings-general';
  @State private wideSettingsMotion: ReaderRouteMotionKind = 'tab';
  @State private visibleRouteMotion: ReaderRouteMotionKind | 'none' = 'none';
  @State private readerParentProgress: number = 0;
  @State private readerDetailCover: boolean = false;
  private readerDetailCoverGeneration: number = 0;
  @State private pendingBackDuringCover: number | undefined = undefined;
  private readerOriginLane: ReaderRoute = 'bookshelf';
  @State private sourceOpeningGeneration: number = 0;
  @State private sourceToolsOpeningGeneration: number = 0;
  private publishNavigation(snapshot: ReaderNavigationSnapshot): void {
    const restoringDirectory = this.route === 'reading' && snapshot.route === 'directory' &&
      snapshot.directoryReturnTarget === 'detail';
    if (snapshot.generation !== this.navigationGeneration || snapshot.route !== this.route) {
      this.bookRemovalConfirmation.dismiss();
      this.jsonImportPresentation.dismiss();
      this.pendingBackDuringCover = undefined;
      this.readerDetailCover = false;
    }
    if (this.route === 'bookshelf' && snapshot.route !== 'bookshelf' && this.bookshelfModalVisible()) {
      if (this.shelfMutations.snapshot.importPresentation !== undefined) this.shelfMutations.closeImport();
      if (this.shelfGroupPresentation.identity.length > 0) this.shelfGroupPresentation.retire();
    }
    if (this.route === 'detail' && snapshot.route !== 'detail') {
      this.shelfGroupPresentation.retire();
      this.detailMoreBack = undefined;
      this.detailMoreBackIdentity = '';
    }
    const routeChanged = snapshot.route !== this.route;
    const fromReader = this.route === 'reading' || (this.route === 'directory' && this.directoryReturnTarget === 'readerControl');
    const toReader = snapshot.route === 'reading' ||
      (snapshot.route === 'directory' && snapshot.directoryReturnTarget === 'readerControl');
    const previousLane = routeChanged && !fromReader && toReader ? this.appRouteLane() : this.readerOriginLane;
    if (routeChanged) {
      const from = this.route, to = snapshot.route;
      if (to === 'source') this.sourceOpeningGeneration = snapshot.generation;
      else if (to === 'sourceTools') this.sourceToolsOpeningGeneration = snapshot.generation;
      const shelfSearch = (from === 'bookshelf' && to === 'search') || (from === 'search' && to === 'bookshelf');
      const readerChangesHost = !fromReader && toReader && previousLane !== this.navigationOwner.returns.snapshot().readingOrigin;
      this.visibleRouteMotion = shelfSearch || (fromReader && toReader) || readerChangesHost ?
        'none' : this.navigationOwner.routeMotion();
    }
    // Keep the last right-hand pane mounted while the whole Settings tab leaves.
    const pane = this.navigationOwner.settingsPane();
    if (pane !== undefined) {
      const lane: ReaderRouteSurfaceKey = pane === 'general' ? 'settings-general' : pane === 'about' ? 'settings-about' :
        snapshot.route === 'sourceTools' ? 'sourceTools' : pane;
      if (lane !== this.wideSettingsLane) {
        this.wideSettingsMotion = snapshot.route === this.route ? 'tab' : this.navigationOwner.routeMotion();
        this.wideSettingsLane = lane;
      }
    }
    this.navigationGeneration = snapshot.generation;
    this.directoryReturnTarget = snapshot.directoryReturnTarget;
    this.settingsSection = snapshot.settingsSection;
    this.route = snapshot.route;
    if (routeChanged) {
      if (fromReader !== toReader) {
        const lane = this.appRouteLane();
        const sameLane = previousLane === lane;
        if (toReader) this.readerOriginLane = lane;
        // Hold the exited reader's paint below the native detail push.
        const cover = fromReader && snapshot.route === 'detail' && this.visibleRouteMotion === 'push' &&
          this.searchAppForeground && this.readingEntry.book !== undefined;
        if (cover) {
          this.readerDetailCoverGeneration += 1;
          this.readerDetailCover = true;
        }
        this.updateReaderParentMotion(toReader, sameLane && !this.readerDetailCover);
      }
    }
    if (restoringDirectory) this.directoryJourney.refreshDetailPosition();
  }
  private setSettingsSection(section: SettingsSection): void {
    this.publishNavigation(this.navigationOwner.setSettingsSection(section));
  }
  private navigateTo(route: ReaderRoute, motion?: ReaderRouteMotionKind): void {
    this.publishNavigation(this.navigationOwner.show(route, motion));
  }
  private updateReaderParentMotion(open: boolean, sameLane: boolean): void {
    const progress = open && sameLane ? 1 : 0;
    if (this.readerParentProgress === progress) return;
    if (sameLane && this.searchAppForeground && !this.appReduceMotion) {
      const timing = motionAnimateParam(open ? 'app.navigation.push' : 'app.navigation.pop');
      this.getUIContext().animateTo(timing, (): void => { this.readerParentProgress = progress; });
    } else {
      this.readerParentProgress = progress;
    }
  }

  private readerParentMotionProgress(): number {
    return this.searchAppForeground && !this.appReduceMotion ? this.readerParentProgress : 0;
  }

  private detailAboveReader(): boolean {
    return this.route === 'detail' && this.visibleRouteMotion === 'push';
  }

  private completeReaderDetailCover(generation: number): void {
    if (!this.readerDetailCover || generation !== this.readerDetailCoverGeneration || this.route !== 'detail') return;
    this.readerDetailCover = false;
    if (this.pendingBackDuringCover !== generation) return;
    // Allow the retired reader surface to leave layout before Back recreates it.
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (this.pendingBackDuringCover !== generation) return;
        this.pendingBackDuringCover = undefined;
        if (this.route === 'detail' && this.searchAppForeground) this.onBackPress();
      }));
    } catch (_) {
      this.pendingBackDuringCover = undefined;
    }
  }

  private appRouteBackGestureEnabled(): boolean {
    return !this.readerDetailCover && this.pendingBackDuringCover === undefined && this.journeyRecoveryInputAllowed() &&
      retainedReaderRoute(this.route, this.directoryReturnTarget) === undefined;
  }
  @StorageLink('readerAppForeground') @Watch('onSearchVisibilityChanged') private searchAppForeground: boolean = true;
  @State private jsonImportPresentation: JsonImportPresentation = new JsonImportPresentation();
  @State private readingEntryActions: ReaderReadingEntryActions =
    new ReaderReadingEntryActions(this.navigationOwner, this.entryStartupTrace, this.readingEntryActionPorts());

  private readingEntryActionPorts(): ReaderReadingEntryActionPorts {
    return {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      mounting: (): number => this.detailShelfAdmissionMount,
      entry: (): ReadingEntryPresentation => this.readingEntry,
      search: (): LibrarySearchPresentation => this.librarySearch,
      sourceSwitch: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      advance: (): number => this.nextNavigationGeneration(),
      show: (route: ReaderRoute): void => this.navigateTo(route),
      bindReader: (): void => this.bindReadingEntryReader(),
      restoreReaderReturn: (context: ReaderReturnContext | undefined): boolean => this.downloadNavigation.restoreReaderReturn(context),
      entryPorts: (owner: ReaderRuntimeOwner): ReadingEntryPorts => this.readingEntryPorts(owner),
      sourceName: (sourceId: string, name?: string): string => this.sourceDisplayName(sourceId, name),
      detailReadAllowed: (): boolean => this.journeyRecoveryInputAllowed(),
      failure: (title: string, message: string): void => this.showReadingFailure(title, message),
      afterOpening: (project: () => void): void => project(),
      postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderNavigationBackfillFrame(action)),
      refreshNearEnd: (session: RemoteReadingSession, chapterIndex: number): void => this.readingCommits.refreshNearEnd(session, chapterIndex),
    };
  }
  @State private rulesPresentation: RulesManagementPresentation = new RulesManagementPresentation();
  @State private discoverPresentation: DiscoverScenePresentation = new DiscoverScenePresentation();
  @State private sourceSwitchPresentation: SourceSwitchPresentation = new SourceSwitchPresentation();
  @State private readingCommits: ReadingCommitPresentation = new ReadingCommitPresentation(this.readingCommitPorts());

  private readingCommitPorts(): ReadingCommitPorts {
    return {
      entry: (): ReadingEntryPresentation => this.readingEntry,
      scene: (): ReadingCommitScene => ({ owner: this.mountedRuntimeOwner, retired: this.shelfReceiptRetired,
        navigation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
        active: this.readingEntry.sessionActive, readyGeneration: this.readingEntry.readyGeneration }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      finalize: (sourceId: string, bookId: string, transactionId: string): SourceSwitchPendingTransaction | undefined =>
        this.sourceSwitchPresentation.finalizeTarget(this.sourceSwitchScene(), { sourceId, bookId }, transactionId),
      cleanup: (sourceId: string, bookId: string): void => this.directoryJourney.operations.cleanupRetiredSource(sourceId, bookId),
      sourceName: (sourceId: string, name: string): string => this.sourceDisplayName(sourceId, name),
      applyRefreshedSession: (session: RemoteReadingSession): void => this.readingEntryActions.acceptReaderSession(session),
      refreshShelf: (): void => this.refreshBookshelf(),
      notifyFileNavigation: (): void => this.consumeSystemFileOpen(),
      diagnostic: (stage: 'window' | 'catalog', message: string): void => {
        hilog.warn(DOMAIN, 'Reader', stage === 'catalog' ? 'Near-end catalog refresh failed: %{private}s' :
          'Rolling chapter cache incomplete: %{private}s', message);
      },
    };
  }
  private readonly sourceSwitchJourney: ReaderSourceSwitchJourney =
    new ReaderSourceSwitchJourney(this.navigationOwner, this.sourceSwitchJourneyPorts());

  private sourceSwitchJourneyPorts(): ReaderSourceSwitchJourneyPorts {
    return {
      scope: (): ReaderSourceSwitchScope => ({ owner: this.mountedRuntimeOwner,
        retired: this.shelfReceiptRetired, mount: this.detailShelfAdmissionMount }),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      entryActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      entryPorts: (owner: ReaderRuntimeOwner): ReadingEntryPorts => this.readingEntryPorts(owner),
      source: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      manga: (): MangaSourceSwitchPresentation => this.mangaSourceSwitch,
      search: (): LibrarySearchPresentation => this.librarySearch,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      captureReturn: (): ReaderReturnContext | undefined => this.downloadNavigation.captureReaderReturn(),
      restoreReturn: (context: ReaderReturnContext | undefined): boolean => this.downloadNavigation.restoreReaderReturn(context),
      advance: (): void => { this.nextNavigationGeneration(); },
      showReading: (): void => this.navigateTo('reading'),
      leaveReader: (): void => this.readingExitActions.completeReturn(),
      bindReader: (): void => this.bindReadingEntryReader(),
      sourceName: (sourceId: string, name?: string): string => this.sourceDisplayName(sourceId, name),
      invalidateDownloads: (): void => this.downloadPresentation.invalidateMembership(),
      refreshShelf: (): void => this.refreshBookshelf(),
      navigationSettled: (): void => this.consumeSystemFileOpen(),
    };
  }

  @State private mangaSourceSwitch: MangaSourceSwitchPresentation =
    new MangaSourceSwitchPresentation(this.mangaSourceSwitchPorts());
  private readonly sourceSwitchActions: ReaderSourceSwitchActions = readerSourceSwitchActions(
    (): SourceSwitchPresentation => this.sourceSwitchPresentation,
    (): MangaSourceSwitchPresentation => this.mangaSourceSwitch,
    (): boolean => this.readingEntry.book?.contentKind === 'manga',
    (): SourceSwitchWorkflowPorts => this.sourceSwitchPorts(),
  );

  private mangaSourceSwitchPorts(): MangaSourceSwitchPorts {
    const ports: MangaSourceSwitchPorts = {
      scene: (): MangaSourceSwitchScene => this.sourceSwitchJourney.mangaScene(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      source: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      sourceHost: (): SourceSwitchHost | undefined => this.getSourceSwitchHost(),
      query: (): SourceSwitchProbeQuery => this.sourceSwitchProbeQuery(),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      preview: (seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession): void =>
        this.sourceSwitchJourney.preview(seed, sourceName, session),
      committed: (book: ShelfBook, session: RemoteReadingSession, chapterIndex: number): void =>
        this.performSourceSwitchSeam(book, session, chapterIndex),
      chapterStartFeedback: (current: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message: '已从本章开头继续' },
          (): boolean => this.searchAppForeground && current()); } catch (_) {}
      },
      refreshShelf: (): void => this.refreshBookshelf(),
      showReaderFailure: (): void => this.sourceSwitchJourney.presentReaderFailure(),
      savedRecovery: (message: string, current: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.journeyRecoveryInputAllowed() && current()); }
        catch (_) {}
      },
      recovery: (message: string, label: string, retry: (() => void) | undefined, current: () => boolean): void =>
        this.showIndexRecoveryNotice(message, label, retry, current),
      consumeFileOpen: (): void => this.consumeSystemFileOpen(),
    };
    return ports;
  }

  private readonly directoryJourney: ReaderDirectoryJourney = new ReaderDirectoryJourney(this.navigationOwner, this.directoryJourneyPorts());

  private directoryJourneyPorts(): ReaderDirectoryJourneyPorts {
    return {
      scope: (): ReaderDirectoryJourneyScope => ({ owner: this.mountedRuntimeOwner, mount: this.detailShelfAdmissionMount,
        retired: this.shelfReceiptRetired, foreground: this.searchAppForeground !== false,
        covered: this.arkWebCapturesInput || this.sourceSwitchPresentation.isSurfacePresented() || this.mangaSourceSwitch.selectionVisible }),
      ownsRuntime: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      advance: (): void => { this.nextNavigationGeneration(); },
      openReading: (chapter: number, proof?: ReaderDirectoryTargetProof): void => this.openReading(chapter, proof),
      bindReader: (): void => this.bindReadingEntryReader(),
      requestExit: (): void => this.requestReadingExit(),
      showDownloads: (key: string): void => {
        if (this.readingEntry.sessionActive) this.downloadNavigation.requestFromReader(key);
        else this.downloadNavigation.open({ kind: 'fresh', detailKey: key });
      },
      afterReaderExitInDetail: (action: () => void): void => this.requestReaderBookInfo(action),
      confirmOfflineClear: (title: string, message: string, accept: () => void, current: () => boolean): void =>
        this.confirmDirectoryCacheClear(title, message, accept, current),
      feedback: (message: string): void => this.showOfflineDownloadFeedback(message),
      bookmarkFeedback: (book: ReadingBookDetail, message: string): void => {
        try {
          this.transientFeedback.show(() => this.getUIContext(), { message },
            (): boolean => this.searchAppForeground && !this.shelfReceiptRetired &&
            this.isCurrentRuntime(this.mountedRuntimeOwner) && this.readingEntry.book === book);
        } catch (_) {}
      },
    };
  }

  private readonly mangaPositions: MangaPositionHydrator = new MangaPositionHydrator();
  private readonly mangaSourceLogin: MangaSourceLogin = new MangaSourceLogin();
  @State private detailShelfAdmissionMount: number = 0;
  @State private detailShelf: BookshelfDetailPresentation = new BookshelfDetailPresentation({
    owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner,
    isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
    retired: (): boolean => this.shelfReceiptRetired, route: (): string => this.route,
    generation: (): number => this.navigationGeneration, mounting: (): number => this.detailShelfAdmissionMount,
    book: (): ReadingBookDetail | undefined => this.readingEntry.book,
    session: (): RemoteReadingSession | undefined => this.readingEntry.session,
    inBookshelf: (): boolean => this.readingEntry.inBookshelf,
    blocked: (book: ReadingBookDetail): boolean => this.readingEntry.sessionActive || this.sourceSwitchPresentation.isSurfacePresented() ||
      this.sourceSwitchPresentation.pending !== undefined || this.sourceSwitchPresentation.host()?.blocksExit(book) === true ||
      this.readingEntry.offlineOperationActive,
    host: (): BookshelfHost => this.bookshelfHost, mutations: (): BookshelfMutationPresentation => this.shelfMutations,
    filter: (): BookshelfFilter => this.shelfFilter(),
    setMembership: (membership: boolean): void => { this.readingEntry.inBookshelf = membership; },
    refreshBookshelf: (): void => this.refreshBookshelf(), refreshSearchMembership: (): void => this.refreshSearchShelfMembership(),
    invalidateProjection: (): void => this.invalidateBookshelfProjection(),
    applyProjection: (shelf: BookshelfDataState): void => this.applyBookshelfState(shelf),
    confirm: (message: string, action: () => void): void => this.openBookRemovalDialog(message, action),
    showFailure: (title: string, message: string): void => this.showReadingFailure(title, message),
    postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderNavigationBackfillFrame(action)),
  });
  @State private readingEntry: ReadingEntryPresentation = new ReadingEntryPresentation();
  @State private settingsPresentation: SettingsPresentation = new SettingsPresentation();
  private readonly libraryAcquisition: ReaderLibraryAcquisitionBinding = new ReaderLibraryAcquisitionBinding();
  @State private librarySearch: LibrarySearchPresentation = new LibrarySearchPresentation(
    (): boolean => this.libraryAcquisition.currentOwner() !== undefined && this.searchAppForeground &&
      (this.route === 'search' || this.navigationOwner.isSearchDetailJourney()),
    (): boolean => this.libraryAcquisition.currentOwner() !== undefined && this.navigationOwner.isSearchDetailJourney(),
  );
  private bookshelfHost: BookshelfHost = new BookshelfHost(
    (snapshot: BookshelfManagementSnapshot): void => this.shelfManagement.accept(snapshot),
    (): boolean => this.route === 'bookshelfManagement',
    undefined,
    (snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner): void => {
      const removalPending = this.shelfMutations.snapshot.removalKey.length > 0;
      const importOpen = this.shelfMutations.snapshot.importPresentation !== undefined;
      this.shelfMutations.accept(snapshot, owner);
      if ((removalPending && this.shelfMutations.snapshot.removalKey.length === 0) ||
        (importOpen && this.shelfMutations.snapshot.importPresentation === undefined)) {
        this.readingExitActions.navigationSettled();
      }
    },
    (snapshots: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner): void => this.detailShelf.accept(snapshots, owner),
  );
  private mountedRuntimeOwner: ReaderRuntimeOwner | undefined;
  private readonly libraryJourney: ReaderLibraryJourney = new ReaderLibraryJourney(this.navigationOwner, this.libraryJourneyPorts());

  private libraryJourneyPorts(): ReaderLibraryJourneyPorts {
    return {
      scope: (): ReaderLibraryScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
        retired: this.shelfReceiptRetired, inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      shelfHost: (): BookshelfHost => this.bookshelfHost,
      management: (): BookshelfManagementPresentation => this.shelfManagement,
      group: (): BookshelfGroupPresentation => this.shelfGroupPresentation,
      read: (): BookshelfReadPresentation => this.shelfRead,
      catalog: (): BookshelfCatalogPresentation => this.shelfCatalog,
      preparePersistedShelf: (): void => this.preparePersistedShelfBooks(),
      emptyShelfReady: (): void => this.traceStartupStage?.('shelf.empty-model-ready', 'ready'),
      mutations: (): BookshelfMutationPresentation => this.shelfMutations,
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      search: (): LibrarySearchPresentation => this.librarySearch,
      acquisition: (): ReaderLibraryAcquisitionBinding => this.libraryAcquisition,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      loadLocalBook: (bookId: string): Promise<ShelfBook | undefined> => this.bookshelfHost.loadShelfBook(LOCAL_SOURCE_ID, bookId),
      sourceName: (sourceId: string): string => this.sourceDisplayName(sourceId),
      failure: (title: string, message: string): void => this.showReadingFailure(title, message),
      advance: (): number => this.nextNavigationGeneration(),
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
      refreshShelf: (): void => this.refreshBookshelf(),
      readbackOnBookshelf: (): void => this.detailShelf.readbackOnBookshelf(),
      clearRssSelection: (): void => this.rssJourney.clearSelection(),
      showDiscover: (): void => this.openDiscover(true),
      feedback: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.searchAppForeground && current());
      },
      bookshelfInputAllowed: (): boolean => this.searchAppForeground && this.bookshelfContentAcceptsInput(),
      back: (): void => { this.onBackPress(); },
    };
  }

  private readonly settingsNavigation: ReaderSettingsJourney = new ReaderSettingsJourney(this.navigationOwner, this.settingsNavigationPorts());

  private settingsNavigationPorts(): ReaderSettingsJourneyPorts {
    return {
      scope: (): ReaderSettingsJourneyScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity,
        mounting: this.detailShelfAdmissionMount, retired: this.shelfReceiptRetired,
        inputAllowed: this.rulesManagementInputAllowed() }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      settings: (): SettingsPresentation => this.settingsPresentation,
      rules: (): RulesManagementPresentation => this.rulesPresentation,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      showBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
    };
  }

  private readonly sourceJourney: SourceJourneyPresentation = new SourceJourneyPresentation();
  private readonly sourceNavigation: ReaderSourceJourney = new ReaderSourceJourney(this.navigationOwner, this.sourceNavigationPorts());

  private sourceNavigationPorts(): ReaderSourceJourneyPorts {
    return {
      scope: (): ReaderSourceJourneyScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity,
        mounting: this.detailShelfAdmissionMount, retired: this.shelfReceiptRetired,
        inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      presentation: (): SourceJourneyPresentation => this.sourceJourney,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      search: (): LibrarySearchPresentation => this.librarySearch,
      acquisition: (): ReaderLibraryAcquisitionBinding => this.libraryAcquisition,
      settings: (): ReaderSettingsJourney => this.settingsNavigation,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
    };
  }
  private readonly downloadNavigation: ReaderDownloadJourney = new ReaderDownloadJourney(this.navigationOwner, this.downloadNavigationPorts());

  private downloadNavigationPorts(): ReaderDownloadJourneyPorts {
    return {
      scope: (): ReaderDownloadJourneyScope => ({ instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
        inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      downloads: (): SharedDownloadPresentation => this.downloadPresentation,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      exitActions: (): ReaderExitActions => this.readingExitActions,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      showBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
      showSettings: (): void => this.settingsNavigation.returnToSettings(),
      openDetailDirectory: (): void => this.directoryJourney.open('detail'),
      feedback: (message: string): void => this.showOfflineDownloadFeedback(message),
    };
  }

  private readonly rssInstanceIdentity: number = ++rssIndexInstance;
  @State private syncPresentation: SyncPresentation = new SyncPresentation();
  @State private rssJourney: RssJourneyPresentation = new RssJourneyPresentation({
    route: (): string => this.route, generation: (): number => this.navigationGeneration,
    mounting: (): number => this.detailShelfAdmissionMount, instance: (): number => this.rssInstanceIdentity,
    owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner, retired: (): boolean => this.shelfReceiptRetired,
    isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
    advance: (): number => this.nextNavigationGeneration(),
    show: (route: RssRoute, motion?: 'tab'): void => this.navigateTo(route, motion),
    endReading: (): void => {
      this.readingEntry.endReading(this.mountedRuntimeOwner);
    },
    importVisible: (): boolean => this.jsonImportPresentation.opening !== undefined,
    openImport: (context: 'rssMerge' | 'rssReplace'): void =>
      this.jsonImportPresentation.openRss(this.rssJourney, context, this.rssJourney.rssPresentationIdentity),
    confirm: (options: ReaderNativeAlertOptions, current: () => boolean): void => {
      this.showIndexAlert('confirmation-cancelable', options, current);
    },
    scheme: (): string => this.appThemeScheme,
  });
  private readonly readingExitActions: ReaderExitActions = new ReaderExitActions(this.navigationOwner, this.readingExitActionPorts());

  private readingExitActionPorts(): ReaderExitActionPorts {
    return {
      entry: (): ReadingEntryPresentation => this.readingEntry,
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      mounting: (): number => this.detailShelfAdmissionMount,
      foreground: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput && ReaderNativeAlertWindow.hasWindow(),
      captureReturn: (): ReaderReturnContext | undefined => this.downloadNavigation.captureReaderReturn(),
      switchBlocked: (book: ReadingBookDetail): boolean => this.sourceSwitchPresentation.host()?.blocksExit(book) === true,
      fileOpenBlocked: (): boolean => !ReaderNativeAlertWindow.hasWindow() || ReaderNativeAlertWindow.isPresented() ||
        ReaderDocumentPickerActivity.isPending() ||
        this.shelfMutations.snapshot.removalKey.length > 0 ||
        (this.route === 'bookshelf' && this.shelfMutations.snapshot.importPresentation !== undefined),
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      bindReader: (): void => this.bindReadingEntryReader(),
      hydrateMangaPosition: (book: ReadingBookDetail): void => this.hydrateMangaPositions([book]),
      refreshDetail: (): void => { void this.readingEntryActions.refreshDetailAcquisition(); },
      refreshShelf: (): void => this.refreshBookshelf(),
      returnToBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
      returnFromDetail: (): void => this.libraryJourney.returnFromDetail(),
      showDownloads: (intent: SharedDownloadOpeningIntent): void => this.downloadNavigation.open(intent),
      showRules: (): void => this.settingsNavigation.presentRulesFromReader(),
      unavailableDownloads: (): void => this.showOfflineDownloadFeedback('阅读位置尚未就绪，请稍后打开下载管理'),
      prepareFileOpen: (): void => {
        this.retireSourceSwitchPresentation();
        this.dismissJsonImport();
      },
      openShelfBook: (book: ShelfBook): void => this.openShelfBook(book),
      resolveFileReaderTransaction: async (book: SystemFileOpenReaderIdentity): Promise<void> => {
        await this.resolveReaderSourceSwitchTransaction(book.sourceId, book.bookId);
      },
      fileNotice: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.searchAppForeground && current());
      },
    };
  }
  aboutToAppear(): void {
    this.mountedRuntimeOwner = ReaderRuntimeOwner.current();
    this.shelfReceiptRetired = false;
    this.arkWebCapturesInput = false;
    this.detailShelfAdmissionMount += 1;
    this.libraryAcquisition.mount(this.mountedRuntimeOwner, {
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      detailBook: (): ReadingBookDetail | undefined => this.readingEntry.book,
      refreshShelf: (): void => this.refreshBookshelf(),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
      refreshDetail: (): void => { void this.readingEntryActions.refreshDetailAcquisition(); },
    });
    this.librarySearch.model.verification = {
      enabled: (): boolean => ReaderUIVerificationProbe.enabled(),
      emit: (kind: string, channel: ReaderUIVerificationChannel, payload: Object): void =>
        ReaderUIVerificationProbe.emit(kind, channel, payload),
    };
    this.librarySearch.mount();
    this.detailShelf.mount(this.mountedRuntimeOwner);
    // Mount after configuration recovery to avoid recursively waiting on that barrier.
    this.settingsPresentation.mount(this.mountedRuntimeOwner, (): void => this.shelfCatalog.automatic(this.shelfRead.snapshot.books));
    this.shelfMutations.restore();
    // Show the shelf immediately and read original source-switch receipts in parallel.
    this.refreshBookshelf();
    void this.reconcilePendingSourceSwitches();
    this.mountSystemFileOpenNavigation(this.mountedRuntimeOwner);
  }

  aboutToDisappear(): void {
    this.shelfReceiptRetired = true;
    this.readerDetailCover = false;
    this.pendingBackDuringCover = undefined;
    this.sourceSwitchPresentation.retireMangaRecovery();
    this.entryStartupTrace.retire();
    this.libraryAcquisition.dispose();
    this.mangaPositions.retire();
    this.nativeAlertWindowUnsubscribe?.();
    this.nativeAlertWindowUnsubscribe = undefined;
    this.documentPickerUnsubscribe?.();
    this.documentPickerUnsubscribe = undefined;
    this.readingExitActions.dispose();
    this.transientFeedback.reset();
    this.downloadPresentation.dispose();
    this.readingCommits.retire();
    this.navigationOwner.retire();
    this.settingsPresentation.dispose();
    this.sourceJourney.retire();
    this.nativeAlertOwner.retire();
    this.shelfCatalog.retire();
    this.shelfManagement.retire();
    this.shelfGroupPresentation.retire();
    this.discoverPresentation.retire();
    this.rulesPresentation.retire();
    this.syncPresentation.retire();
    this.bookRemovalConfirmation.dismiss();
    this.dismissJsonImport();
    this.shelfRead.retire();
    this.shelfMutations.detach();
    this.detailShelf.detach();
    this.rssJourney.retire();
    this.readingEntry.clearExitRequest();
    // The library binding already retires this root's preparation scope.
    this.readingEntry.retire(false);
    this.retireSourceSwitchPresentation();
    this.librarySearch.dispose();
    this.librarySearch.model.verification = undefined;
    this.mountedRuntimeOwner = undefined;
  }

  onBackPress(): boolean {
    if (this.currentReadingRuntime() === undefined) return false;
    if (this.readerDetailCover) {
      this.pendingBackDuringCover = this.readerDetailCoverGeneration;
      return true;
    }
    if (this.pendingBackDuringCover !== undefined) return true;
    return this.navigationOwner.dispatchBack({
      wideSettings: this.wideSettingsPane() !== undefined,
      nativeSurface: (): boolean => this.arkWebBack?.() === true ||
        (this.route === 'detail' && (this.shelfGroupPresentation.back() || this.detailMoreBack?.() === true)),
      mangaSelection: this.mangaSourceSwitch.selectionVisible ? (): void => this.mangaSourceSwitch.backFromSelection() : undefined,
      bookRemoval: this.bookRemovalConfirmation.isOpen() ? (): void => { this.bookRemovalConfirmation.dismiss(); } : undefined,
      jsonImport: this.jsonImportPresentation.opening !== undefined ? (): void => this.dismissJsonImport() : undefined,
      sourceSwitch: this.sourceSwitchPresentation.isSurfacePresented() ? this.sourceSwitchActions.back : undefined,
      bookshelfImport: this.route === 'bookshelf' && this.shelfMutations.snapshot.importPresentation !== undefined ?
        (): void => this.shelfMutations.closeImport() : undefined,
      bookshelfGroup: (): boolean => this.shelfGroupPresentation.back(),
      temporaryOwner: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      onTemporaryFailure: (error: Error): void => {
        try { hilog.error(DOMAIN, 'Reader', 'Temporary surface Back failed: %{private}s', errorMessageOf(error)); } catch (_) {}
      },
      shelfPreparation: this.readingEntryActions.shelfPreparing ? (): void => this.cancelShelfReadingPreparation() : undefined,
      destination: (target: ReaderBackTarget): void => this.dispatchBackDestination(target),
    });
  }

  private cancelShelfReadingPreparation(): void { this.readingExitActions.cancelShelfPreparation(); }

  private dispatchBackDestination(target: ReaderBackTarget): void {
    switch (target) {
      case 'bookshelf':
        this.libraryJourney.returnToBookshelf(undefined, this.wideSettingsPane() === undefined ? undefined : 'tab');
        break;
      case 'leaveSelection': this.libraryJourney.backFromSelection(); break;
      case 'bookshelfSettingsOrigin': this.settingsNavigation.returnFromBookshelfSettings(); break;
      case 'generalSettingsHome': this.setSettingsSection('home'); break;
      case 'settings': this.settingsNavigation.returnToSettings(); break;
      case 'searchMode': this.libraryJourney.back(); break;
      case 'sourceManagement': this.sourceNavigation.returnToManagement(); break;
      case 'sourceOrigin': this.sourceNavigation.returnFromManagement(); break;
      case 'downloadsOrigin': this.downloadNavigation.returnFromDownloads(); break;
      case 'rulesOrigin': this.settingsNavigation.returnFromRulesManagement(); break;
      case 'directoryOrigin': this.closeDirectory(); break;
      case 'readerExit': this.requestReadingExit(); break;
      case 'detailExit': this.handleDetailBack(); break;
      case 'rss': this.rssJourney.returnToRss(); break;
      case 'rssFeed': this.rssJourney.returnFromRssSourceFeed(); break;
      case 'rssEntry': this.rssJourney.returnFromRssEntryDetail(); break;
      case 'rssSubscriptionList': this.rssJourney.returnToRssSubscriptionManagement(); break;
    }
  }

  private handleDetailBack(): void {
    this.navigationOwner.backFromDetail(this.readingEntry.currentExitLease(), (): void => this.libraryJourney.returnFromDetail());
  }

  private bookshelfScenePorts(owner: ReaderRuntimeOwner | undefined, mounting: number): BookshelfScenePorts {
    return {
      isCurrent: (navigation: number): boolean => this.isCurrentBookshelfPresentation(navigation, owner, mounting),
      isInteractive: (navigation: number): boolean => this.isInteractiveBookshelfPresentation(navigation, owner, mounting),
      registerMore: (handler: (() => void) | undefined, identity: string, navigation: number): void => {
        if (handler === undefined || (owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount &&
          navigation === this.navigationGeneration)) this.librarySearch.bindShelfMore(identity, navigation, mounting, handler);
      },
      registerBack: (handler: (() => boolean) | undefined, identity: string, navigation: number): void => {
        this.registerTemporaryBackBridge('bookshelf', navigation, owner, handler, identity);
      },
      measureContinueCard: (rect: ReaderSurfaceRect | undefined, navigation: number, bookKey: string): void => {
        if (owner === undefined || owner !== this.mountedRuntimeOwner || !this.isCurrentRuntime(owner) ||
          this.shelfReceiptRetired || mounting !== this.detailShelfAdmissionMount ||
          navigation !== this.navigationGeneration || (this.route !== 'bookshelf' && this.route !== 'search')) return;
        this.librarySearch.measureContinueCard(rect, navigation, mounting, bookKey, this.shelfRead.snapshot.continueReading);
      },
      prepareVisibleBooks: (books: ShelfBook[]): void => this.prepareVisibleReadingBooks(books),
      openDestination: (destination: BookshelfSceneDestination): void => {
        switch (destination) {
          case 'search': this.libraryJourney.openSearch('empty-shelf'); break;
          case 'discover': this.openDiscover(); break;
          case 'rss': this.rssJourney.openRss(); break;
          case 'settings': this.settingsNavigation.openSettings(); break;
          case 'bookshelfSettings': this.settingsNavigation.openBookshelfSettings(); break;
          case 'bookshelfManagement': this.libraryJourney.openBookshelfManagement(); break;
          case 'downloads': this.downloadNavigation.open(); break;
        }
      },
      openBook: (selection: ShelfBook): void => this.openShelfBook(selection),
      openSelection: (book?: ShelfBook): void => this.libraryJourney.openBookshelfMultiSelect(book),
      openBookInfo: (book: ShelfBook, focus?: BookshelfDetailReturnFocus): void =>
        this.navigationOwner.openBookshelfDetail(focus, (): void => this.openShelfBookInfo(book)),
      takeDetailReturnFocus: (navigation: number): BookshelfDetailReturnFocus | undefined =>
        this.navigationOwner.takeReturnedBookshelfFocus(navigation),
      openGroup: (book: ShelfBook, focusTarget?: string): void => this.libraryJourney.openShelfGroup(book, focusTarget),
    };
  }

  private expandedLayout(): boolean {
    if (this.readerWindowMetricsRevision < 0) return false;
    return readerExpandedLayout(ReaderWindowCoordinator.metrics());
  }

  @Builder
  private discoverPageContent() {
    ForEach([this.navigationGeneration], (generation: number): void => {
      DiscoverSurface({ presentation: this.discoverPresentation, identity: this.discoverIdentity(generation, this.detailShelfAdmissionMount),
        expandedLayout: this.expandedLayout(), onBack: (): void => this.libraryJourney.returnToBookshelf(),
        onRss: (): void => this.rssJourney.openRss(), onSettings: (): void => this.settingsNavigation.openSettings(),
        onOpenBook: (book: DiscoverBook): void => {
          if (!this.isCurrentRoute(generation, 'discover') || !this.searchAppForeground || this.arkWebCapturesInput) return;
          this.navigationOwner.admitDetailFrom('discover', (): void => {
            this.readingEntryActions.openRemoteDetail({ seed: { sourceId: book.sourceId, bookId: book.bookId,
              detailUrl: book.bookId, title: book.name, author: book.author, coverUrl: book.coverUrl, intro: book.intro,
              contentKind: book.category === 'comic' ? 'manga' : 'text' }, sourceName: this.sourceDisplayName(book.sourceId) }, 'discover');
          });
        } });
    }, (generation: number): string => generation.toString());
  }

  private discoverIdentity(generation: number, mounting: number): string {
    return JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'discover']);
  }

  @Builder
  private searchPageContent() {
    ForEach([this.searchResultsKey()], (key: string) => {
      this.searchPageSurface(key, this.mountedRuntimeOwner, this.detailShelfAdmissionMount, this.librarySearch.host);
    }, (key: string): string => key);
  }

  @Builder
  private searchPageSurface(key: string, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SearchHost) {
    LibrarySearchResults({
      presentation: this.librarySearch,
      coordinator: this.libraryAcquisition.coordinator(),
      isCurrent: (): boolean => this.isCurrentSearchPresentation(key, owner, mounting, host),
      presented: this.route === 'search' && this.searchAppForeground && !this.arkWebCapturesInput,
      isVisible: (): boolean => this.route === 'search' && this.searchAppForeground && !this.arkWebCapturesInput,
      reduceMotion: this.appReduceMotion,
      expandedLayout: this.expandedLayout(),
      onBack: (): void => { this.onBackPress(); },
      onQuery: (keyword: string, scopeSourceIds?: string[]): void => this.libraryJourney.search(keyword, scopeSourceIds),
      onResult: (book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void =>
        this.libraryJourney.selectResult(book, variants, cover, focusKey),
      onManageSources: (): void => this.sourceNavigation.manageFromSearch(),
    });
  }

  private isCurrentSearchPresentation(key: string, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SearchHost): boolean {
    return this.searchResultsAttached() && key === this.searchResultsKey() &&
      this.libraryJourney.ownsSearchPresentation(owner, mounting, host);
  }

  private searchResultsKey(): string {
    // Query revision belongs to the search host; publication makes changes observable here.
    this.librarySearch.publicationRevision;
    return JSON.stringify([this.librarySearch.identity, this.librarySearch.host.viewState.revision, this.detailShelfAdmissionMount]);
  }

  private searchResultsAttached(): boolean {
    return this.route === 'search' || (this.librarySearch.mode !== 'idle' &&
      (this.navigationOwner.isSearchDetailJourney() ||
        ((this.route === 'source' || this.route === 'sourceTools') && this.navigationOwner.returns.sourceOrigin().target === 'search')));
  }

  @Builder
  private librarySearchResults() {
    if (this.searchResultsAttached()) {
      this.searchPageContent();
    }
  }

  @Builder
  private librarySearchSurface(owner: ReaderRuntimeOwner | undefined, host: SearchHost,
    actions: ReaderLibraryHeaderActions = this.libraryJourney.headerActions(owner, host)) {
    ReaderLibrarySearchSurface({
      model: this.librarySearch.model, mode: this.librarySearch.mode, identity: this.librarySearch.identity,
      navigationGeneration: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
      // Search owns an opaque material. Keep the real List position so closing
      // search or returning from detail never flashes the idle tint at mid-list.
      headerScrolled: (this.route === 'bookshelf' || (this.route === 'search' && this.librarySearch.mode === 'idle')) &&
        this.shelfRead.snapshot.visualAdmitted && this.shelfRead.headerScrolled,
      moreIdentity: this.librarySearch.shelfMoreIdentity(this.navigationGeneration, this.detailShelfAdmissionMount),
      animateOnAppear: this.librarySearch.animateOnAppear, expandedLayout: this.expandedLayout(),
      reduceMotion: this.appReduceMotion,
      continueCardRect: this.librarySearch.continueCardRect(this.navigationGeneration, this.detailShelfAdmissionMount,
        this.shelfRead.snapshot.continueReading),
      onHistoryCoverageChanged: actions.onHistoryCoverageChanged,
      results: (): void => { this.librarySearchResults(); },
      onOpen: actions.onOpen,
      onBack: actions.onBack,
      onInputRequested: actions.onInputRequested,
      onMore: actions.onMore,
      onHeaderBottom: actions.onHeaderBottom,
      onSettled: actions.onSettled,
    }).enabled(this.route === 'search' || this.bookshelfContentAcceptsInput())
      .hitTestBehavior(this.route === 'search' || this.bookshelfContentAcceptsInput() ? HitTestMode.Transparent : HitTestMode.None)
      .accessibilityLevel(this.route === 'search' || this.bookshelfContentAcceptsInput() ? 'auto' : 'no-hide-descendants');
  }

  private bookshelfModalVisible(): boolean {
    return this.route === 'bookshelf' && (this.shelfMutations.snapshot.importPresentation !== undefined ||
      this.shelfGroupPresentation.identity.length > 0);
  }

  private bookshelfContentAcceptsInput(): boolean {
    return !this.arkWebCapturesInput && this.route === 'bookshelf' && !this.readingEntryActions.shelfPreparing &&
      !this.readingEntry.sessionActive && !this.bookshelfModalVisible() &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  private isInteractiveBookshelfPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number): boolean {
    return this.libraryJourney.isInteractiveBookshelf(generation, owner, mounting);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.pageSurfaces();
      Stack({ alignContent: Alignment.TopStart }) {
        BookRemovalDialogHost({ presentation: this.bookRemovalConfirmation });
      }.width('100%').height('100%')
        .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL])
        .hitTestBehavior(HitTestMode.Transparent);
      Stack({ alignContent: Alignment.TopStart }) {
        ArkWebExecutionHost({
          onBackBridge: (handler: (() => boolean) | undefined): void => { this.arkWebBack = handler; },
          onInputCaptureChange: (captured: boolean): void => {
            if (this.shelfReceiptRetired || this.arkWebCapturesInput === captured) return;
            this.arkWebCapturesInput = captured;
            if (!captured) this.readingExitActions.navigationSettled();
          },
        });
      }.width('100%').height('100%').padding({ top: this.overlaySafeTop() })
        .hitTestBehavior(HitTestMode.Transparent);
    }
      .width('100%')
      .height('100%')
      .backgroundColor(readerAppColor('app.window.background', this.appThemeScheme))
      .expandSafeArea(this.mangaOwnsWindowEdges() ? [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT] : [SafeAreaType.SYSTEM],
        this.mangaOwnsWindowEdges() ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] :
          this.readerOwnsWindowEdges() ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM] : [SafeAreaEdge.BOTTOM])
      .ignoreLayoutSafeArea(this.mangaOwnsWindowEdges() ? [LayoutSafeAreaType.SYSTEM] : [],
        this.mangaOwnsWindowEdges() ? [LayoutSafeAreaEdge.ALL] : [])
  }

  @Builder
  private pageSurfaces() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderRouteStackSurface({
          route: this.appRouteLane(), routeMotion: this.searchAppForeground ? this.visibleRouteMotion : 'none',
          surfaceId: 'reader-app-route-stack',
          viewportWidth: this.routeViewportWidth(), reduceMotion: this.appReduceMotion,
          readerCoverGeneration: this.readerDetailCover ? this.readerDetailCoverGeneration : undefined,
          onReaderCovered: (generation: number): void => this.completeReaderDetailCover(generation),
          backGestureEnabled: this.appRouteBackGestureEnabled(),
          content: (route: ReaderRouteSurfaceKey): void => { this.appRouteContent(route as ReaderRoute); },
          onBack: (): boolean => this.onBackPress(),
        });
        Column().width('100%').height('100%').backgroundColor(Color.Black)
          .opacity(this.readerParentMotionProgress() * READER_ROUTE_PARENT_DIM)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
      }.width('100%').height('100%')
        .translate({ x: -this.routeViewportWidth() * READER_ROUTE_PARENT_PARALLAX * this.readerParentMotionProgress() })
        .zIndex(this.detailAboveReader() ? 1 : 0);
      Stack({ alignContent: Alignment.TopStart }) {
        if ((this.readingEntry.sessionActive || this.readerDetailCover) && this.readingEntry.book !== undefined) {
          RetainedReaderScene({
            reading: this.readingEntry, commits: this.readingCommits,
            source: this.sourceSwitchPresentation, manga: this.mangaSourceSwitch,
            visibleRoute: this.readerDetailCover ? 'reading' : retainedReaderRoute(this.route, this.directoryReturnTarget),
            expandedLayout: this.expandedLayout(), reduceMotion: this.appReduceMotion,
            inputAllowed: this.readingEntry.sessionActive && this.searchAppForeground && !this.arkWebCapturesInput,
            ports: this.retainedReaderPorts(),
          }).transition(readerSceneTransition(this.routeViewportWidth(), this.appReduceMotion,
            this.searchAppForeground && !this.readerDetailCover));
        }
      }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
        .zIndex(this.detailAboveReader() ? 0 : 1);
      this.pageOverlays();
    }
    .width('100%').height('100%')
    .enabled(!this.arkWebCapturesInput)
    .hitTestBehavior(this.arkWebCapturesInput ? HitTestMode.None : HitTestMode.Default)
    .accessibilityLevel(this.arkWebCapturesInput ? 'no-hide-descendants' : 'auto');
  }

  private routeViewportWidth(): number {
    this.readerWindowMetricsRevision;
    return ReaderWindowCoordinator.metrics().windowRect.width;
  }

  private overlaySafeTop(): number {
    return this.readerOwnsWindowEdges() ? 0 : this.appContentTopInset();
  }

  private appRouteLane(): ReaderRoute {
    if (this.route === 'search') return 'bookshelf';
    if (retainedReaderRoute(this.route, this.directoryReturnTarget) !== undefined) {
      return this.navigationOwner.returns.snapshot().readingOrigin;
    }
    if (this.wideSettingsPane() !== undefined) return 'settings';
    return this.route;
  }

  private appRouteSafeTop(route: ReaderRoute): number {
    if (route === 'detail' || route === 'directory') return 0;
    return this.appContentTopInset();
  }

  @Builder
  private appRouteContent(route: ReaderRoute) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (route === 'bookshelf') {
        this.bookshelfRoute();
      } else if (route === 'detail') {
        this.detailRoute();
      } else if (route === 'directory') {
        this.externalDirectory();
      } else if (route === 'settings' && this.expandedLayout()) {
        this.wideSettingsRoute();
      } else {
        this.secondaryRouteSurface(route);
      }
    }.width('100%').height('100%').padding({ top: this.appRouteSafeTop(route) });
  }

  @Builder
  private bookshelfRoute() {
    ForEach([this.detailShelfAdmissionMount], (mounting: number): void => {
      BookshelfScene({
        read: this.shelfRead, mutations: this.shelfMutations, catalog: this.shelfCatalog,
        navigation: this.navigationGeneration,
        feedbackEnabled: this.route === 'bookshelf' && !this.readingEntry.sessionActive && !this.readingEntryActions.shelfPreparing,
        continueCardSuppressed: this.route === 'search' &&
          this.librarySearch.continueCardSuppressed(this.navigationGeneration, this.detailShelfAdmissionMount),
        reduceMotion: this.appReduceMotion,
        tapBottomScrollTop: this.settingsPresentation.snapshot.tapBottomScrollTop,
        ports: this.bookshelfScenePorts(this.mountedRuntimeOwner, mounting),
      })
        .enabled(this.bookshelfContentAcceptsInput())
        .hitTestBehavior(this.bookshelfContentAcceptsInput() ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel(this.bookshelfContentAcceptsInput() ? 'auto' : 'no-hide-descendants')
        .customProperty('readerLayoutDebugExcluded', this.route !== 'bookshelf');
    }, (mounting: number): string => mounting.toString());
    this.librarySearchSurface(this.mountedRuntimeOwner, this.librarySearch.host);
  }

  @Builder
  private detailRoute() {
    BookshelfDetailScene({
      entry: this.readingEntry, detail: this.detailShelf, mutations: this.shelfMutations,
      identity: this.detailShelf.identity(), foreground: this.detailContentIsForeground(),
      directoryRetained: this.isDetailDirectoryRoute() || this.navigationOwner.retainsDetailDirectory(),
      mutationEnabled: this.readingEntry.book !== undefined && this.detailShelf.mutationEnabled(this.readingEntry.book),
      ports: this.detailScenePorts(),
    });
  }

  @Builder
  private wideSettingsRoute() {
    ReaderWideSettingsShell({
      pane: this.wideSettingsSelection(), collapsed: this.wideSettingsCollapsed,
      interactive: this.wideSettingsInputAllowed(),
      onToggle: (): void => {
        if (this.wideSettingsInputAllowed()) this.wideSettingsCollapsed = !this.wideSettingsCollapsed;
      },
      onPane: (pane: SettingsPane): void => this.requestWideSettingsPane(pane),
      onMainTab: (tab: string): void => this.requestWideSettingsMainTab(tab),
      content: (width: number): void => { this.secondaryRouteStack(width); },
    });
  }

  @Builder
  private pageOverlays() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderSourceSwitchSurfaces({
          reading: this.readingEntry, source: this.sourceSwitchPresentation, manga: this.mangaSourceSwitch,
          entryPickerAllowed: this.route === 'detail' || this.route === 'bookshelf' || this.isDetailDirectoryRoute(),
          interactive: this.searchAppForeground && !this.arkWebCapturesInput,
          reduceMotion: this.appReduceMotion, consumeTopInset: this.readerOwnsWindowEdges(),
          actions: this.sourceSwitchActions,
        });
      }.width('100%').height('100%').padding({ top: this.overlaySafeTop() })
        .hitTestBehavior(HitTestMode.Transparent);
      this.modalOverlays();
      this.feedbackOverlays();
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private modalOverlays() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.route === 'bookshelf' || this.route === 'detail') {
        BookshelfGroupDialog({ presentation: this.shelfGroupPresentation,
          isInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
            (this.route === 'bookshelf' || this.route === 'detail'),
        });
      }
      if (this.route === 'bookshelf') {
        BookshelfImportScene({ presentation: this.shelfMutations, navigation: this.navigationGeneration,
          reduceMotion: this.appReduceMotion,
          canRestoreFocus: (): boolean => this.isInteractiveBookshelfPresentation(
            this.navigationGeneration, this.mountedRuntimeOwner, this.detailShelfAdmissionMount) &&
            !this.bookRemovalConfirmation.isOpen() && this.jsonImportPresentation.opening === undefined &&
            !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible,
        });
      }
      if (this.jsonImportPresentation.opening !== undefined) {
        this.jsonImportContent();
      }
    }.width('100%').height('100%')
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.ALL])
      .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private feedbackOverlays() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderJourneyRecoveryNotices({
        reading: this.readingEntry, detail: this.detailShelf, topInset: this.messageSafeTop(),
        startupRecoveryVisible: this.bookshelfContentAcceptsInput(),
        startupRecovery: readerLegacySnapshotRecoveryView(this.mountedRuntimeOwner?.legacySnapshotMigrationRecovery()),
        interactive: this.journeyRecoveryInputAllowed(),
        canInteract: (): boolean => this.journeyRecoveryInputAllowed(),
        mangaRecoveryVisible: this.canPresentMangaRecovery(),
        mangaRecovery: this.sourceSwitchPresentation.mangaRecovery,
        mangaRecoveryActionLabel: this.sourceSwitchPresentation.mangaRecoveryActionLabel,
        mangaRecoveryBusy: this.sourceSwitchPresentation.mangaRecoveryBusy,
        onMangaRecovery: (generation: number): void => {
          if (this.canPresentMangaRecovery()) this.sourceSwitchPresentation.retryMangaRecovery(generation);
        },
      });
      // Runtime geometry guide is last so it can outline every mounted page
      // surface without intercepting input.
      ReaderLayoutDebugOverlay();
      // One app-owned short-feedback host sits above every route. Domain
      // owners publish only AppStorage facts through ReaderTransientFeedback.
      ReaderTransientToast()
    }
    .width('100%').height('100%').padding({ top: this.overlaySafeTop() })
    .zIndex(2).hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private syncContent(embeddedWide: boolean = false) {
    ForEach([this.navigationGeneration], (generation: number): void => {
      SyncSurface({ presentation: this.syncPresentation, identity: this.syncIdentity(generation, this.detailShelfAdmissionMount),
        expandedLayout: this.expandedLayout(), embeddedWide, onBack: (): void => this.settingsNavigation.returnToSettings() });
    }, (generation: number): string => generation.toString());
  }

  private syncIdentity(generation: number, mounting: number): string {
    return JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'sync']);
  }

  @Builder
  private rssContent(route: RssRoute) {
    ForEach([this.navigationGeneration], (generation: number): void => {
      RssJourneySurface({ presentation: this.rssJourney, route, generation, owner: this.mountedRuntimeOwner,
        mounting: this.detailShelfAdmissionMount,
        identity: route === 'rssSubscriptionEditor' ? this.rssJourney.rssEditorPresentationIdentity : this.rssJourney.rssPresentationIdentity,
        expandedLayout: this.expandedLayout(), onBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
        onSettings: (): void => this.settingsNavigation.openSettings(), onDiscover: (): void => this.openDiscover() })
        .enabled(this.jsonImportPresentation.opening === undefined)
        .accessibilityLevel(this.jsonImportPresentation.opening === undefined ? 'auto' : 'no-hide-descendants');
    }, (generation: number): string => generation.toString());
  }

  private detailScenePorts(): BookshelfDetailScenePorts {
    return {
      captureAction: (identity: string): (() => boolean) => {
        const owner = this.mountedRuntimeOwner;
        return (): boolean => this.isCurrentDetailPresentation(identity, owner);
      },
      retainedShareFile: async (bookId: string, current: () => boolean): Promise<string | undefined> => {
        const owner = this.currentReadingRuntime();
        return owner === undefined || !current() ? undefined : owner.retainedLocalBookSourcePath(bookId, current);
      },
      openReading: (chapterIndex?: number): void => this.openReading(chapterIndex),
      openDirectory: (): void => this.openFullDirectory(),
      retryCatalog: (): void => {
        const owner = this.currentReadingRuntime();
        if (owner !== undefined) this.readingEntry.retryDirectoryCatalog(owner);
      },
      openSourceSwitch: (focusId?: string): void => this.openDetailSourceSwitch(focusId),
      openDownloads: (): void => this.downloadNavigation.open(),
      openGroup: (identity: string, focusId?: string): void => { void this.openCurrentDetailGroup(identity, focusId); },
      projectCurrentChapter: (identity: string): void => {
        const owner = this.mountedRuntimeOwner;
        const current = (): boolean => this.isCurrentDetailPresentation(identity, owner);
        if (current()) this.readingEntry.projectDetailDirectoryPosition(owner, this.shelfRead.snapshot.books, current);
      },
      registerMoreBack: (handler: (() => boolean) | undefined, identity: string): void => {
        if (handler === undefined && this.detailMoreBackIdentity !== identity) return;
        this.detailMoreBackIdentity = handler === undefined ? '' : identity;
        this.detailMoreBack = handler;
      },
      back: (): void => { this.onBackPress(); },
    };
  }

  private async openCurrentDetailGroup(identity: string, focusId?: string): Promise<void> {
    const owner = this.mountedRuntimeOwner;
    const book = this.readingEntry.book;
    if (owner === undefined || book === undefined || !this.readingEntry.inBookshelf ||
      !this.isCurrentDetailPresentation(identity, owner)) return;
    const mounting = this.detailShelfAdmissionMount, navigation = this.navigationGeneration;
    const current = (): boolean => this.route === 'detail' && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && this.detailShelfAdmissionMount === mounting && this.navigationGeneration === navigation &&
      this.detailShelf.isCurrent(identity) && this.readingEntry.inBookshelf &&
      this.readingEntry.book?.sourceId === book.sourceId && this.readingEntry.book?.bookId === book.bookId;
    try {
      const shelfBook = await this.bookshelfHost.loadShelfBook(book.sourceId, book.bookId);
      if (!current() || !this.detailContentIsForeground() || shelfBook === undefined ||
        shelfBook.sourceId !== book.sourceId || shelfBook.bookId !== book.bookId) return;
      this.shelfGroupPresentation.open(owner, shelfBook, identity, current, (): void => {
        this.shelfRead.invalidate();
        this.refreshBookshelf();
      }, (message: string, admitted: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.searchAppForeground && current() && admitted());
      }, focusId, (): boolean => this.detailContentIsForeground() && current());
    } catch (error) {
      if (current()) hilog.warn(DOMAIN, 'Reader', 'Detail shelf group lookup: %{private}s', errorMessageOf(error));
    }
  }

  private detailContentIsForeground(): boolean {
    return this.searchAppForeground !== false && !this.arkWebCapturesInput && this.route === 'detail' &&
      this.shelfGroupPresentation.identity.length === 0 &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  private isCurrentDetailPresentation(identity: string, owner: ReaderRuntimeOwner | undefined): boolean {
    return this.detailContentIsForeground() && owner !== undefined && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && this.detailShelf.isCurrent(identity);
  }

  private isDirectoryOpeningCurrent(opening: number, target: DirectoryReturnTarget): boolean {
    return this.directoryJourney.isOpeningCurrent(opening, target);
  }

  private isDetailDirectoryRoute(): boolean {
    return this.route === 'directory' && this.directoryReturnTarget === 'detail';
  }

  private wideSettingsPane(): SettingsPane | undefined {
    if (!this.expandedLayout()) return undefined;
    if (this.route === 'settings') return this.settingsSection === 'about' ? 'about' : 'general';
    return this.navigationOwner.settingsPane();
  }

  private wideSettingsSelection(): SettingsPane {
    if (this.wideSettingsLane === 'settings-general') return 'general';
    if (this.wideSettingsLane === 'settings-about') return 'about';
    if (this.wideSettingsLane === 'sourceTools') return 'source';
    return this.wideSettingsLane as SettingsPane;
  }

  private wideSettingsInputAllowed(): boolean {
    return this.wideSettingsPane() !== undefined && this.rulesManagementInputAllowed() &&
      !this.bookRemovalConfirmation.isOpen() && !ReaderNativeAlertWindow.isPresented() &&
      this.navigationOwner.canSwitchSettingsPane(this.currentReadingRuntime());
  }

  private requestWideSettingsPane(pane: SettingsPane): void {
    if (!this.wideSettingsInputAllowed()) return;
    if (pane === 'source' && this.route === 'sourceTools') {
      this.sourceNavigation.returnToManagement();
      return;
    }
    if (pane === 'general' || pane === 'about') {
      this.settingsNavigation.returnToSettings(pane);
    } else {
      this.settingsNavigation.returnToSettings('home', false);
      this.openSettingsDestination(pane);
    }
    if (this.wideSettingsPane() === pane) this.wideSettingsMotion = 'tab';
  }

  private requestWideSettingsMainTab(tab: string): void {
    if (!this.wideSettingsInputAllowed()) return;
    if (tab === 'bookshelf') this.libraryJourney.returnToBookshelf(undefined, 'tab');
    else if (tab === 'discover') this.openDiscover(false, 'tab');
    else if (tab === 'rss') this.rssJourney.openRss('tab');
  }

  @Builder
  private secondaryRouteStack(width: number) {
    ReaderRouteStackSurface({
      route: this.wideSettingsLane,
      surfaceId: 'reader-wide-settings-route-stack',
      routeMotion: this.searchAppForeground ? this.wideSettingsMotion : 'none', reduceMotion: this.appReduceMotion,
      viewportWidth: width, backGestureEnabled: this.journeyRecoveryInputAllowed(),
      content: (route: ReaderRouteSurfaceKey): void => { this.wideSettingsContent(route); },
      onBack: (): boolean => this.onBackPress(),
    }).width('100%').height('100%')
      .backgroundColor(readerAppColor('app.window.background', this.appThemeScheme));
  }

  @Builder
  private wideSettingsContent(route: ReaderRouteSurfaceKey) {
    if (route === 'settings-general') {
      this.settingsContent('settings', true, 'general');
    } else if (route === 'settings-about') {
      this.settingsContent('settings', true, 'about');
    } else {
      this.secondaryRouteSurface(route as ReaderRoute, true);
    }
  }

  @Builder
  private secondaryRouteSurface(route: ReaderRoute, embeddedWide: boolean = false) {
    if (route === 'bookshelfSettings') {
      this.settingsContent('bookshelfSettings', embeddedWide);
    } else if (route === 'bookshelfMultiSelect') {
      ForEach([this.shelfMutations.selection.identity], (identity: number): void => {
        BookshelfMultiSelectPage({
          books: this.shelfMutations.selection.books,
          ready: this.shelfMutations.selection.ready,
          initialSelectedKey: this.shelfMutations.selection.initialKey,
          busy: this.shelfMutations.snapshot.batchRemovalBusy || this.shelfMutations.selectionVerifying,
          isInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
            this.route === 'bookshelfMultiSelect' && identity === this.shelfMutations.selection.identity,
          onCancel: (): void => { if (identity === this.shelfMutations.selection.identity) this.libraryJourney.returnToBookshelf(); },
          onRemoveSelected: (keys: string[]): void => this.shelfMutations.requestSelectionRemoval(identity, keys),
        });
      }, (identity: number): string => identity.toString());
    } else if (route === 'bookshelfManagement') {
      BookshelfManagementSurface({ presentation: this.shelfManagement, onBack: (): void => this.libraryJourney.returnToBookshelf() });
    } else if (isReaderProductSurfaceEnabled('rss') && (route === 'rss' || route === 'rssSubscriptionManagement' ||
      route === 'rssSubscriptionEditor' || route === 'rssSourceFeed' || route === 'rssEntryDetail')) {
      this.rssContent(route);
    } else if (isReaderProductSurfaceEnabled('discover') && route === 'discover') {
      this.discoverPageContent();
    } else if (route === 'settings') {
      this.settingsContent('settings', embeddedWide);
    } else if (route === 'downloads') {
      this.downloadsContent(embeddedWide);
    } else if (route === 'rulesManagement') {
      this.rulesManagementContent();
    } else if (route === 'source' || route === 'sourceTools') {
      this.sourceJourneyContent(route === 'sourceTools', embeddedWide);
    } else if (isReaderProductSurfaceEnabled('sync') && route === 'sync') {
      this.syncContent(embeddedWide);
    }
  }

  @Builder
  private externalDirectory() {
    if (this.readingEntry.book !== undefined) {
      DetailDirectoryScene({ reduceMotion: this.appReduceMotion,
        reading: this.readingEntry,
        operations: this.directoryJourney.operations,
        navigation: this.directoryNavigationPorts(),
        interactive: this.isDirectoryOpeningCurrent(this.readingEntry.detailDirectoryPresentationGeneration, 'detail'),
        mangaDownloadEnabled: this.readingEntry.book.contentKind === 'manga' &&
          this.mountedRuntimeOwner?.supportsCoreCapability('manga.offline.v1') === true,
        isOpeningCurrent: (opening: number): boolean => this.isDirectoryOpeningCurrent(opening, 'detail'),
        onRetryCatalog: (): void => this.retryDirectoryCatalog(),
        onSwitchSource: (): void => this.openDetailSourceSwitch(),
        onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number): void =>
          this.registerDirectoryBackBridge('detail', opening, handler, identity),
        onBack: (): void => this.closeDirectory(),
      }).width('100%').height('100%')
        .enabled(this.isDetailDirectoryRoute())
        .hitTestBehavior(this.isDetailDirectoryRoute() ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel(this.isDetailDirectoryRoute() ? 'auto' : 'no-hide-descendants');
    }
  }

  private readerOwnsWindowEdges(): boolean {
    if (this.mangaSourceSwitch.selectionVisible) return true;
    // Detail and its standalone directory each own their safe-top inset.
    if (this.readingEntry.book !== undefined && (this.route === 'detail' || this.isDetailDirectoryRoute())) return true;
    return this.readingEntry.sessionActive && (this.route === 'reading' ||
      (this.route === 'directory' && this.directoryReturnTarget === 'readerControl'));
  }

  private mangaOwnsWindowEdges(): boolean {
    if (this.mangaSourceSwitch.selectionVisible) return true;
    return (this.readingEntry.sessionActive || this.readerDetailCover) && this.readingEntry.contentKind === 'manga' &&
      this.readerOwnsWindowEdges();
  }

  private appContentTopInset(): number {
    // Reading the revision makes Window callbacks observable to this root;
    // the metric values themselves remain owned by ReaderWindowCoordinator.
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    return readerContentSafeTop(ReaderWindowCoordinator.metrics());
  }

  private openDiscover(returningFromDetail: boolean = false, motion?: 'tab'): void {
    if (!isReaderProductSurfaceEnabled('discover')) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingEntry.endReading(this.mountedRuntimeOwner);
    this.navigateTo('discover', returningFromDetail ? 'pop' : motion);
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined) return;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    this.discoverPresentation.open(owner, this.discoverIdentity(generation, mounting), (): boolean =>
      !this.shelfReceiptRetired && this.isCurrentRoute(generation, 'discover') && isReaderProductSurfaceEnabled('discover') &&
      owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount && this.isCurrentRuntime(owner), returningFromDetail);
  }

  @Builder
  private downloadsContent(embeddedWide: boolean = false) {
    SharedDownloadScene({
      presentation: this.downloadPresentation, reduceMotion: this.appReduceMotion,
      active: this.route === 'downloads', isPaintCurrent: (): boolean => this.route === 'downloads',
      covered: this.arkWebCapturesInput, embeddedWide,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean): void =>
        this.registerTemporaryBackBridge('downloads', this.navigationGeneration, this.mountedRuntimeOwner, handler, identity, blocksSettingsSwitch),
      onBack: (): void => { this.onBackPress(); },
      onRead: (entry: DownloadReadingEntry): void => this.downloadNavigation.openChapter(entry),
      onFeedback: (message: string): void => this.showOfflineDownloadFeedback(message),
    });
  }

  @Builder
  private settingsContent(route: SettingsRoute, embeddedWide: boolean = false, section?: 'general' | 'about') {
    SettingsScenes({
      presentation: this.settingsPresentation, route, section: section ?? this.settingsSection,
      active: this.settingsPaintCurrent(route, section),
      isPaintCurrent: (): boolean => this.settingsPaintCurrent(route, section),
      expandedLayout: this.expandedLayout(), embeddedWide, generation: this.navigationGeneration,
      isInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
        this.route === route && this.currentReadingRuntime() !== undefined,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean): void =>
        this.registerTemporaryBackBridge('settings', this.navigationGeneration, this.mountedRuntimeOwner, handler, identity, blocksSettingsSwitch),
      onSectionChange: (section: SettingsSection): void => {
        const next = this.navigationOwner.selectSettingsSection(section, (): void => { this.onBackPress(); });
        if (next !== undefined) this.publishNavigation(next);
      },
      onBack: (): void => {
        if (route === 'bookshelfSettings') this.onBackPress();
        else this.libraryJourney.returnToBookshelf();
      },
      onOpen: (destination: SettingsDestination): void => {
        if (this.route === 'settings' && this.settingsSection === 'home' && this.currentReadingRuntime() !== undefined) {
          this.openSettingsDestination(destination);
        }
      },
    });
  }

  private settingsPaintCurrent(route: SettingsRoute, section: 'general' | 'about' | undefined): boolean {
    return this.route === route && (section === undefined || this.wideSettingsPane() === section);
  }

  private openSettingsDestination(destination: SettingsDestination): void {
    switch (destination) {
      case 'source': this.sourceNavigation.openManagement(); break;
      case 'rulesManagement': this.settingsNavigation.openRulesManagement(); break;
      case 'sync': this.openSync(); break;
      case 'bookshelfSettings': this.settingsNavigation.openBookshelfSettings(); break;
      case 'downloads': this.downloadNavigation.open(); break;
      case 'rss': this.rssJourney.openRss(); break;
      case 'discover': this.openDiscover(); break;
    }
  }

  @Builder
  private rulesManagementContent() {
    ForEach([this.navigationGeneration], (generation: number): void => {
      this.rulesManagementSurface(this.settingsNavigation.rulesIdentity(generation, this.detailShelfAdmissionMount));
    }, (generation: number): string => generation.toString());
  }

  @Builder
  private rulesManagementSurface(identity: string) {
    RulesManagementSurface({ presentation: this.rulesPresentation, identity,
      inputEnabled: this.rulesManagementInputAllowed(),
      onBack: (): void => this.settingsNavigation.returnFromRulesManagement(),
      onImport: (): void => this.jsonImportPresentation.openRuleBundle(this.rulesPresentation, identity,
        rulesManagementImportFocus(identity)),
    }).enabled(this.jsonImportPresentation.opening === undefined)
      .accessibilityLevel(this.jsonImportPresentation.opening === undefined ? 'auto' : 'no-hide-descendants');
  }

  private rulesManagementInputAllowed(): boolean {
    return this.searchAppForeground && !this.arkWebCapturesInput && this.jsonImportPresentation.opening === undefined;
  }

  private registerTemporaryBackBridge(
    scope: TemporaryBackScope,
    generation: number,
    owner: ReaderRuntimeOwner | undefined,
    handler: (() => boolean) | undefined,
    identity: string,
    blocksSettingsSwitch?: () => boolean,
  ): void {
    if (owner === undefined || this.currentReadingRuntime() !== owner) return;
    this.navigationOwner.setTemporaryBack(scope, generation, owner, handler, identity, blocksSettingsSwitch);
  }

  private registerDirectoryBackBridge(target: DirectoryReturnTarget, opening: number,
    handler: (() => boolean) | undefined, identity: string): void {
    this.directoryJourney.registerBack(target, opening, handler, identity);
  }

  private isCurrentRuntime(owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && ReaderRuntimeOwner.isCurrent(owner);
  }

  @Builder
  private sourceJourneyContent(showingTools: boolean, embeddedWide: boolean = false) {
    // Advancing the navigation generation retires business actions before the
    // route changes. Preserve the covered lane's viewport until a real return.
    ForEach([showingTools ? this.sourceToolsOpeningGeneration : this.sourceOpeningGeneration],
      (generation: number): void => {
        this.sourceJourneySurface(generation, this.mountedRuntimeOwner, showingTools, embeddedWide,
          this.sourceNavigation.identity(generation, this.detailShelfAdmissionMount, showingTools ? 'sourceTools' : 'source'));
      }, (generation: number): string =>
        this.sourceNavigation.identity(generation, this.detailShelfAdmissionMount, showingTools ? 'sourceTools' : 'source'));
  }

  @Builder
  private sourceJourneySurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    showingTools: boolean, embeddedWide: boolean, identity: string) {
    SourceJourneySurface({
      presentation: this.sourceJourney, identity, showingTools, expandedLayout: this.expandedLayout(), embeddedWide,
      reduceMotion: this.appReduceMotion,
      inputEnabled: this.searchAppForeground && !this.arkWebCapturesInput &&
        this.jsonImportPresentation.opening === undefined,
      isInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
        this.jsonImportPresentation.opening === undefined,
      onBack: (): void => { this.onBackPress(); },
      onOpenTools: (): void => this.sourceNavigation.openTools(),
      onImport: (preferred?: string, fallback?: string): void => {
        if (this.searchAppForeground && !this.arkWebCapturesInput && this.sourceJourney.isManagementCurrent(identity))
          this.jsonImportPresentation.openBookSource(this.sourceJourney, identity,
            (): (() => void) | undefined => this.sourceNavigation.importSearchAction(),
            { preferred: preferred ?? '', fallback: fallback ?? '' });
      },
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
        this.registerTemporaryBackBridge('source', generation, owner, handler, bridgeIdentity);
      },
      onToolsTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
        this.registerTemporaryBackBridge('sourceTools', generation, owner, handler, bridgeIdentity);
      },
      onShowDeleteAlert: (options: ReaderNativeAlertOptions, current: () => boolean): void => {
        this.showIndexAlert('confirmation-cancelable', options, current);
      },
    })
      .enabled(this.jsonImportPresentation.opening === undefined)
      .accessibilityLevel(this.jsonImportPresentation.opening === undefined ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private jsonImportContent() {
    if (this.jsonImportPresentation.opening !== undefined) {
      ForEach([this.jsonImportPresentation.opening], (opening: JsonImportOpening): void => {
        JsonImportDialog({
          title: opening.title, description: opening.description, expandedLayout: this.expandedLayout(),
          openingId: opening.id,
          captureFocusReturn: () => this.jsonImportPresentation.captureFocusReturn(opening.id, (): boolean =>
            !this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
            (opening.context === 'bookSource' && this.route === 'source' ||
              opening.context === 'ruleBundle' && this.route === 'rulesManagement')),
          isInputAllowed: (): boolean => !this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
            this.jsonImportPresentation.isOpeningCurrent(opening.id),
          onDismiss: (): void => this.jsonImportPresentation.dismiss(opening.id),
          onSelectLocal: (): void => {
            if (!this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
              this.jsonImportPresentation.opening?.id === opening.id) this.jsonImportPresentation.submit(opening.id);
          },
          onImportOnline: (url: string): void => {
            if (!this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
              this.jsonImportPresentation.opening?.id === opening.id) this.jsonImportPresentation.submit(opening.id, url);
          },
        });
      }, (opening: JsonImportOpening): string => opening.id.toString());
    }
  }

  private dismissJsonImport(): void { this.jsonImportPresentation.dismiss(); }

  private showIndexAlert(spec: ReaderNativeAlertSpecId, options: ReaderNativeAlertOptions,
    isCurrent: () => boolean = (): boolean => true): ReaderNativeAlertLease | undefined {
    if (this.shelfReceiptRetired || !this.searchAppForeground || this.arkWebCapturesInput) return undefined;
    try {
      const owner = ReaderRuntimeOwner.current();
      const generation = this.navigationGeneration;
      const route = this.route;
      const current = (): boolean => {
        if (this.shelfReceiptRetired || !this.searchAppForeground || this.arkWebCapturesInput) return false;
        try { return this.isCurrentRuntime(owner) && generation === this.navigationGeneration &&
          this.route === route && isCurrent(); }
        catch (_) { return false; }
      };
      return this.nativeAlertOwner.present(
        (native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), spec, options, current);
    } catch (error) {
      // The native notice is a separate platform outcome. A durable import,
      // deletion or read ACK must survive a synchronous presentation failure.
      try { hilog.warn(DOMAIN, 'Reader', 'Native Alert presentation failed: %{private}s', errorMessageOf(error)); }
      catch (_) {}
      return undefined;
    }
  }

  private openSync(): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingEntry.endReading(this.mountedRuntimeOwner);
    this.navigateTo('sync');
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined) return;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    this.syncPresentation.open(owner, this.syncIdentity(generation, mounting), (): boolean =>
      !this.shelfReceiptRetired && this.isCurrentRoute(generation, 'sync') && isReaderProductSurfaceEnabled('sync') &&
      owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount && this.isCurrentRuntime(owner));
  }

  private onSearchVisibilityChanged(): void {
    if (!this.searchAppForeground) {
      this.readerDetailCover = false;
      this.pendingBackDuringCover = undefined;
    }
    this.transientFeedback.reset();
    if (this.libraryAcquisition.currentOwner() === undefined || this.shelfReceiptRetired) return;
    this.readingEntry.shelfPreparationVisibilityChanged((): ReadingShelfPreparationScene => this.readingShelfPreparationScene());
    this.libraryAcquisition.visibilityChanged(this.route === 'search' && this.searchAppForeground);
    this.librarySearch.host.visibilityChanged();
    void this.readingEntryActions.refreshDetailAcquisition();
    this.readingExitActions.navigationSettled();
  }

  private openShelfBook(selection: ShelfBook): void {
    this.readingEntryActions.resumeShelf(selection);
  }



  private readingEntryPorts(owner: ReaderRuntimeOwner): ReadingEntryPorts {
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    return {
      current: (): boolean => !this.shelfReceiptRetired && this.libraryAcquisition.currentOwner() === owner &&
        generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount,
      projectionVisible: (): boolean => this.route === 'detail' && !this.readingEntry.sessionActive && !this.sourceSwitchPresentation.isSurfacePresented(),
      membership: () => this.detailShelf.readingMembership(),
      cacheDecision: (error: RemoteChapterCacheRefreshError, current: () => boolean): Promise<boolean> =>
        this.chooseCachedChapterRefresh(error, current),
      notice: (title: string, message: string): void => this.showReadingFailure(title, message),
      refreshShelf: (): void => this.refreshBookshelf(),
    };
  }

  private bindReadingEntryReader(): void {
    const owner = this.currentReadingRuntime();
    if (owner !== undefined) this.readingEntry.bindReader(owner, this.readingEntryPorts(owner));
  }

  private readingShelfPreparationScene(): ReadingShelfPreparationScene {
    return { runtime: this.libraryAcquisition.currentOwner(), mounting: this.detailShelfAdmissionMount,
      foreground: this.searchAppForeground, shelfVisible: this.route === 'bookshelf',
      settingsAvailable: this.settingsPresentation.ready(), revision: this.shelfRead.snapshot.revision,
      shared: this.shelfCatalog.snapshot.seeds };
  }

  private preparePersistedShelfBooks(): void {
    this.readingEntry.prepareShelf((): ReadingShelfPreparationScene => this.readingShelfPreparationScene());
  }

  private hydrateMangaPositions(books: MangaPositionCandidate[]): void {
    this.mangaPositions.hydrateVisible(books, (): MangaPositionScene => {
      const shelf = this.shelfRead.snapshot;
      return { owner: this.libraryAcquisition.currentOwner(), mounting: this.detailShelfAdmissionMount,
        navigation: this.navigationGeneration, route: this.route, shelfGeneration: shelf.generation, shelfBooks: shelf.books,
        continueReading: shelf.continueReading, detail: this.readingEntry.book,
        covered: this.readingEntry.sessionActive || this.sourceSwitchPresentation.isSurfacePresented() || this.mangaSourceSwitch.selectionVisible };
    }, (): void => this.readingEntry.refreshMangaPosition());
  }

  private prepareVisibleReadingBooks(books: ShelfBook[]): void {
    this.hydrateMangaPositions(books);
    this.readingEntry.prepareShelf((): ReadingShelfPreparationScene => this.readingShelfPreparationScene(), books);
  }

  private traceStartupStage(stage: string, status: string = 'event'): void {
    ReaderStartupTrace.current()?.mark(stage, status);
  }

  private beginStartupStage(stage: string): number {
    return ReaderStartupTrace.current()?.begin(stage) ?? -1;
  }

  private endStartupStage(stage: string, startedAt: number, status: string): void {
    ReaderStartupTrace.current()?.end(stage, startedAt, status);
  }

  private openShelfBookInfo(selection: ShelfBook, retainedParent?: DetailReturnRoute): void {
    this.openShelfEntry(selection, 'info', retainedParent);
  }

  private openShelfEntry(selection: ShelfBook, intent: ReadingShelfEntryIntent, retainedParent?: DetailReturnRoute): void {
    this.readingEntryActions.openShelfEntry(selection, intent, retainedParent);
  }

  private showOfflineDownloadFeedback(message: string): void {
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.searchAppForeground && (!this.shelfReceiptRetired && this.isCurrentRuntime(this.mountedRuntimeOwner)));
    } catch (_) {
      // Presentation must not cancel the durable Core download operation.
    }
  }

  private confirmDirectoryCacheClear(title: string, message: string, accept: () => void, current: () => boolean): void {
    this.showIndexAlert('confirmation-cancelable', {
      title, message,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '清除',
        fontColor: readerAppColor('app.action.nativeDestructive', this.appThemeScheme),
        action: accept,
      },
    }, current);
  }

  private openBookRemovalDialog(message: string, action: () => void): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined) return;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount, route = this.route;
    const current = (): boolean => !this.shelfReceiptRetired && generation === this.navigationGeneration &&
      mounting === this.detailShelfAdmissionMount && route === this.route &&
      this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      this.searchAppForeground && !this.arkWebCapturesInput;
    this.bookRemovalConfirmation.open(message, current, action, (phase: 'open' | 'close', error: Object): void => {
      hilog.warn(DOMAIN, 'Reader', 'Book removal dialog %{public}s failed: %{private}s', phase, errorMessageOf(error));
    });
  }

  private openReading(chapterIndex: number | undefined, mangaDirectoryTargetProof?: ReaderDirectoryTargetProof): void {
    this.readingEntryActions.openReading(chapterIndex, mangaDirectoryTargetProof);
  }

  private retainedReaderPorts(): RetainedReaderScenePorts {
    return {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      inputCurrent: (readerIdentity: string): boolean => this.readerContentInputCurrent(readerIdentity),
      directory: this.directoryJourney.operations, directoryNavigation: this.directoryNavigationPorts(),
      toggleMangaShelf: (): void => this.requestMangaShelfMutation(),
      loginMangaSource: (): Promise<void> => this.mangaSourceLogin.openCurrent((): MangaSourceLoginScene => ({
        owner: this.currentReadingRuntime(), sourceId: this.readingEntry.book?.sourceId,
        navigation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
        readerIdentity: this.currentReaderPresentationIdentity(),
        chapterRequest: this.readingEntry.mangaChapterRequestGeneration,
        foreground: this.searchAppForeground, route: this.route, sessionActive: this.readingEntry.sessionActive,
        contentKind: this.readingEntry.contentKind, sourceSwitchVisible: this.sourceSwitchPresentation.isSurfacePresented(),
        candidateVisible: this.mangaSourceSwitch.selectionVisible,
      })),
      attachExit: (request: ReaderExitRequest, identity: string, current: () => boolean,
        mangaGeneration?: number): (() => void) | undefined =>
        this.registerReadingExitRequest(request, identity, current, mangaGeneration),
      exit: (identity: string): void => this.onReaderExited(identity),
      cancelExit: (identity: string): void => this.cancelReaderExitDestination(identity),
      ready: (chapter: number, sourceId: string, bookId: string, generation: number): void =>
        this.readingEntryActions.readingReadyCallback(sourceId, bookId, generation)(chapter),
      sessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean): void =>
        this.readingEntryActions.acceptReaderSession(session, refreshDirectoryDisplay),
      resetFeedback: (): void => this.transientFeedback.reset(),
      openBookInfo: (): void => this.requestReaderBookInfo(),
      openDownloads: (): void => this.downloadNavigation.requestFromReader(),
      isDirectoryOpeningCurrent: (opening: number): boolean => this.isDirectoryOpeningCurrent(opening, 'readerControl'),
      directoryBack: (handler: (() => boolean) | undefined, identity: string, opening: number): void =>
        this.registerDirectoryBackBridge('readerControl', opening, handler, identity),
      openDirectory: (): void => this.openReaderControlDirectory(),
      closeDirectory: (): void => this.closeDirectory(),
      openSourceSwitch: (focusId?: string): void => this.openSourceSwitch(focusId),
      sourceSwitch: this.sourceSwitchActions,
      resolveSourceSwitchTransaction: (sourceId: string, bookId: string): Promise<string | undefined> =>
        this.resolveReaderSourceSwitchTransaction(sourceId, bookId),
    };
  }

  private directoryNavigationPorts(): ReadingDirectoryNavigationPorts { return this.directoryJourney.navigationPorts(); }

  private openFullDirectory(): void { this.directoryJourney.open('detail'); }

  private openReaderControlDirectory(): void { this.directoryJourney.open('readerControl'); }

  private retryDirectoryCatalog(): void { this.directoryJourney.retryDetailCatalog(); }

  private requestMangaShelfMutation(): void {
    this.readingExitActions.requestMangaShelfMutation((): void => this.detailShelf.request(this.detailShelf.identity()));
  }

  private requestReaderBookInfo(afterOpen?: () => void): void { this.readingExitActions.requestBookInfo(afterOpen); }

  private currentReaderPresentationIdentity(): string {
    return this.readingEntry.readerPresentationIdentity();
  }

  private registerReadingExitRequest(requestExit: ReaderExitRequest, readerIdentity: string,
    surfaceCurrent: () => boolean, mangaGeneration?: number): (() => void) | undefined {
    return this.readingExitActions.attach(requestExit, readerIdentity, surfaceCurrent, mangaGeneration);
  }

  private cancelReaderExitDestination(readerIdentity: string): void { this.readingExitActions.cancel(readerIdentity); }

  private onReaderExited(readerIdentity: string): void { this.readingExitActions.accepted(readerIdentity); }

  private closeDirectory(): void { this.directoryJourney.close(); }

  private requestReadingExit(): void { this.readingExitActions.requestExit(); }



  private sourceSwitchScene(): SourceSwitchScene { return this.sourceSwitchJourney.scene(); }

  private getSourceSwitchHost(): SourceSwitchHost | undefined { return this.sourceSwitchJourney.host(); }

  private sourceSwitchPorts(): SourceSwitchWorkflowPorts { return this.sourceSwitchJourney.workflow(); }

  private retireSourceSwitchPresentation(): void { this.sourceSwitchJourney.retire(); }

  private openSourceSwitch(focusId: string = ''): void {
    this.sourceSwitchJourney.openReader();
    this.bindSourceSwitchFocus(focusId);
  }

  private openDetailSourceSwitch(focusId: string = ''): void {
    this.sourceSwitchJourney.openDetail();
    this.bindSourceSwitchFocus(focusId);
  }

  private bindSourceSwitchFocus(focusId: string): void {
    const source = this.sourceSwitchPresentation, owner = this.currentReadingRuntime(), book = this.readingEntry.book;
    if (!source.visible || owner === undefined || book === undefined) return;
    const scope = source.scopeId, route = this.route, navigation = this.navigationGeneration;
    const sourceId = book.sourceId, bookId = book.bookId, mounting = this.detailShelfAdmissionMount;
    const fallback = sourceSwitchTriggerFocusId(sourceId, bookId, route === 'detail' ? 'detail-back' : 'reader-body');
    source.bindSurfaceFocus(scope, {
      current: (): boolean => !this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
        this.isCurrentRuntime(owner) && this.route === route && this.navigationGeneration === navigation &&
        this.detailShelfAdmissionMount === mounting && this.readingEntry.book?.sourceId === sourceId &&
        this.readingEntry.book?.bookId === bookId && !this.mangaSourceSwitch.selectionVisible &&
        !this.bookRemovalConfirmation.isOpen() && this.jsonImportPresentation.opening === undefined,
      postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderSourceFocusFrame(action)),
      request: (target: string): void => this.getUIContext().getFocusController().requestFocus(target),
      restore: (): void => {
        const focus = this.getUIContext().getFocusController();
        if (focusId.length > 0) {
          try {
            const rect = this.getUIContext().getComponentUtils().getRectangleById(focusId);
            if (rect.size.width > 0 && rect.size.height > 0) { focus.requestFocus(focusId); return; }
          } catch (_) {}
        }
        try { focus.requestFocus(fallback); } catch (_) {}
      },
    });
  }

  private sourceSwitchProbeQuery(): SourceSwitchProbeQuery { return sourceSwitchProbeQuery(this.readingEntry); }

  private performSourceSwitchSeam(book: ShelfBook, session?: RemoteReadingSession, chapterIndex?: number): void {
    this.sourceSwitchJourney.commit(book, session, chapterIndex);
  }

  private currentReadingRuntime(): ReaderRuntimeOwner | undefined {
    if (this.shelfReceiptRetired) return undefined;
    const owner = this.libraryAcquisition.currentOwner();
    return owner === this.mountedRuntimeOwner ? owner : undefined;
  }

  private readerContentInputCurrent(readerIdentity: string): boolean {
    return this.currentReadingRuntime() !== undefined && this.readingEntry.sessionActive &&
      readerIdentity === this.currentReaderPresentationIdentity() &&
      retainedReaderRoute(this.route, this.directoryReturnTarget) === 'reading' &&
      this.searchAppForeground && !this.arkWebCapturesInput &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  private chooseCachedChapterRefresh(error: RemoteChapterCacheRefreshError, current: () => boolean): Promise<boolean> {
    const ports: CachedChapterRecoveryPorts = {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      notice: (message: string, label: string, action: () => void, admitted: () => boolean): void =>
        this.showIndexRecoveryNotice(message, label, action, admitted),
      feedback: (message: string, admitted: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.journeyRecoveryInputAllowed() && admitted()); } catch (_) {}
      },
    };
    return this.readingEntry.chooseCachedChapterRefresh(error, current, ports);
  }

  private showReadingFailure(title: string, message: string): void {
    const detail = this.readingEntry.projectAdmissionFailure(message, this.route === 'detail' && !this.readingEntry.sessionActive);
    try { this.transientFeedback.show(() => this.getUIContext(), { message: `${title}：${detail}`, duration: READER_FEEDBACK_EXTENDED_MS },
      (): boolean => this.searchAppForeground && this.currentReadingRuntime() !== undefined); } catch (_) {}
  }

  private messageSafeTop(): number {
    this.readerWindowMetricsRevision;
    // Ordinary App pages already inherit Index's safe-top padding.
    return this.readerOwnsWindowEdges() ? readerContentSafeTop(ReaderWindowCoordinator.metrics()) : 0;
  }

  private showIndexRecoveryNotice(message: string, actionLabel: string = '', action?: () => void,
    admitted: () => boolean = (): boolean => true): void {
    const generation = this.navigationGeneration, route = this.route;
    const owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount;
    const current = (): boolean => !this.shelfReceiptRetired && generation === this.navigationGeneration &&
      route === this.route && owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount &&
      this.isCurrentRuntime(owner) && admitted();
    this.readingEntry.showRecoveryNotice(message, actionLabel, action, current);
  }

  private reconcilePendingSourceSwitches(): Promise<void> {
    return this.sourceSwitchPresentation.inspectPending((): SourceSwitchScene => this.sourceSwitchScene(),
      (count: number): void => hilog.info(DOMAIN, 'Reader', 'Retained pending source switches: %{public}d', count),
      (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Pending source switch read failed: %{private}s', errorMessageOf(error)),
      (): void => this.refreshBookshelf());
  }

  private journeyRecoveryInputAllowed(): boolean {
    return this.searchAppForeground && !this.arkWebCapturesInput && this.currentReadingRuntime() !== undefined &&
      !this.bookshelfModalVisible() && !this.bookRemovalConfirmation.isOpen() &&
      this.jsonImportPresentation.opening === undefined && !this.sourceSwitchPresentation.isSurfacePresented() &&
      !this.mangaSourceSwitch.selectionVisible;
  }

  private canPresentMangaRecovery(): boolean {
    return this.bookshelfContentAcceptsInput() && this.journeyRecoveryInputAllowed();
  }

  private resolveReaderSourceSwitchTransaction(sourceId: string, bookId: string): Promise<string | undefined> {
    return this.sourceSwitchPresentation.resolveReaderTransaction({ sourceId, bookId }, this.sourceSwitchPorts());
  }



  private mountSystemFileOpenNavigation(owner: ReaderRuntimeOwner): void {
    this.nativeAlertWindowUnsubscribe?.();
    this.documentPickerUnsubscribe?.();
    const mounting = this.detailShelfAdmissionMount;
    const settled = (): void => {
      if (mounting === this.detailShelfAdmissionMount && this.currentReadingRuntime() === owner) {
        this.readingExitActions.navigationSettled();
      }
    };
    this.nativeAlertWindowUnsubscribe = ReaderNativeAlertWindow.subscribe(settled);
    this.documentPickerUnsubscribe = ReaderDocumentPickerActivity.subscribe(settled);
    this.readingExitActions.mountSystemFile(owner);
  }

  private consumeSystemFileOpen(): void { this.readingExitActions.consumeSystemFile(); }

  private sourceDisplayName(sourceId: string, persistedName: string = ''): string {
    const candidate = this.sourceSwitchPresentation.namedCandidate;
    return this.shelfRead.sourceDisplayName(sourceId, persistedName, candidate === undefined ? undefined :
      { sourceId: candidate.sourceId, sourceName: candidate.sourceName });
  }

  private shelfFilter(): BookshelfFilter {
    return this.shelfRead.filter();
  }

  private bookshelfProjectionScene(): BookshelfProjectionScene | undefined {
    const owner = this.libraryAcquisition.currentOwner();
    if (owner === undefined || this.shelfReceiptRetired) return undefined;
    return { owner, instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
      navigation: this.navigationGeneration, route: this.route };
  }

  private isCurrentBookshelfPresentation(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number): boolean {
    return this.libraryJourney.isCurrentBookshelf(generation, owner, mounting);
  }

  private refreshSearchShelfMembership(): void {
    this.shelfRead.refreshMembership();
  }

  private refreshBookshelf(): void {
    this.shelfRead.refresh();
  }

  private invalidateBookshelfProjection(): void {
    this.shelfRead.invalidate();
  }



  private nextNavigationGeneration(): number {
    this.transientFeedback.reset();
    this.downloadPresentation.retire();
    this.readingCommits.retire();
    this.settingsPresentation.retire();
    this.sourceJourney.retire();
    this.retireSourceSwitchPresentation();
    this.rssJourney.retire();
    this.readingEntry.retire();
    this.shelfCatalog.retire();
    this.shelfMutations.retireSelection();
    this.shelfManagement.retire();
    this.shelfGroupPresentation.retire();
    this.discoverPresentation.retire();
    this.rulesPresentation.retire();
    this.syncPresentation.retire();
    this.nativeAlertOwner.retire();
    this.readingEntryActions.retirePreparation();
    this.publishNavigation(this.navigationOwner.advance());
    return this.navigationGeneration;
  }

  private isCurrentRoute(generation: number, route: ReaderRoute): boolean {
    return generation === this.navigationGeneration && this.route === route;
  }

  private applyBookshelfState(state: BookshelfDataState): void {
    this.shelfRead.accept(state);
  }

}
