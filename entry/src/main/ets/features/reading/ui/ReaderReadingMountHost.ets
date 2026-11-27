import type { ReaderReadingProgressHost } from './ReaderReadingProgressHost';
import type { ReaderReadingMeasurementAdmissionHost } from './ReaderReadingMeasurementAdmissionHost';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReadingChromeRenderSnapshot, ReadingSessionRenderSnapshot, ReadingPageTurnRenderSnapshot } from './ReaderReadingSurfaceHost';
import type { ReadingPhase } from '../application/ReadingExperienceRenderSnapshots';
import { resolveReadingChapterOpeningAnchor } from '../application/ReadingChapterOpening';
import { ReadingPaginationPrefix } from '../application/ReadingPaginationIndex';
import type { HarmonySmartGestureHost } from '../../../platform/interaction/HarmonySmartGestureHost';
import type { ReaderProgressProducerHost } from '../application/ReaderProgressProducerHost';
import type { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import type { ReaderReadingImageResidencyHost } from './ReaderReadingImageResidencyHost';
import type { ReadingWindowLayoutInput } from '../application/ReadingMeasurementCoordinator';
import type { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type { ReaderControlReplacePanel } from '../presentation/ReaderControlReplacePanel';
import type { PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import type { ReaderControlDirectorySession } from './ReaderControlDirectoryHost';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderControlGeometryHost } from './ReaderControlGeometryHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import type { ReaderReadingPageChromeHost } from './ReaderReadingPageChromeHost';
import type { ReaderReadingChapterPresentationHost } from './ReaderReadingChapterPresentationHost';
import type { ReaderReadingChapterAcquisitionHost } from './ReaderReadingChapterAcquisitionHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import type { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderReadingContentMutationHost } from './ReaderReadingContentMutationHost';
import type { ReaderBrightnessSession } from './ReaderBrightnessSession';
import type { BookTurnNativeEvent } from './BookTurnPresentationSession';
import type { ReadingSourceSwitchOverlayHost } from './ReadingSourceSwitchOverlayHost';
import { createReaderControlSessionState } from './ReaderControlSessionState';
import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderStartupTrace } from '../../../app/ReaderStartupTrace';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { readerFontFamilyReady, registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import { admitObservedReadingCatalog,
  type ReadingCatalogProtectedWindow, type ReadingCatalogRequest } from '../application/ReadingChapterCatalogAdmission';
import { readingChapterWindowOrder, type ReadingChapterWindow, type ReadingSessionChapter } from '../application/ReadingChapterWindow';
import { ReadingEntryHydrationCoordinator, readingEntryToc, type ReadingEntryCatalogPort,
  type ReadingEntryWindowPortRequest, type ReadingFirstBuild, type ReadingFirstFrameEntry,
  type ReadingFirstFrameRead } from '../application/ReadingEntryHydrationCoordinator';
import { readPreparedReadingEntrySnapshot, type ReadingEntryNavigation,
  type ReadingEntrySnapshot as CoreReadingEntrySnapshot } from '../application/ReadingEntrySnapshot';
import type { ReadingEntrySnapshot } from '../application/ReadingEntryPreparation';
import type { ReadingEntryWindowLane } from '../application/ReadingEntryWindowExpansion';
import type { ReadingExitProgressCoordinator } from '../application/ReadingExitProgressCoordinator';
import type { InitialReadingOpenRequest, InitialReadingSelection, InitialReadingSnapshot,
  ReadingInitialChapterHost } from '../application/ReadingInitialChapter';
import { ReadingInteractiveChapterPreparation, type ReadingNearEndCatalogRequest } from '../application/ReadingInteractiveChapterPreparation';
import type { LocalReadingProgressState, LocalReadingToc, LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { InitialReadingToc, type ParagraphRange } from '../application/ReadingMeasurementFacts';
import { readingParagraphBoundaryMode, type ReadingParagraphBoundaryMode } from '../application/ReadingParagraphProjection';
import type { ReadingPaginationKey, ReadingPaginationPrefixObservation } from '../application/ReadingPaginationIndex';
import { ReadingSessionFlowGateway, type ReadingSessionSource } from '../application/ReadingSessionFlowGateway';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../application/RemoteReadingFlowGateway';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import { readerEntryNavigationItem } from '../presentation/ReaderDirectoryProjection';
import type { ReaderMaterializedChapterContext, ReaderRetainedPresentation } from '../presentation/ReaderPagePresentationModels';
import { readingEntryHandoff, ReaderRetainedPageInput, retainConfirmedReadingPage } from '../presentation/ReaderRetainedPresentationHost';
import { readerAppearanceSnapshotFontFamily } from './ReaderAppearanceRenderStyle';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

export interface ReaderReadingMountRoute {
  readonly sourceId: string;
  readonly bookId: string;
  readonly bookKind: string | undefined;
  readonly remoteSession: RemoteReadingSession | undefined;
  readonly remoteBookSeed: RemoteReadingBookSeed | undefined;
  readonly sourceSwitchTransactionId: string | undefined;
  readonly requestedChapterIndex: number | undefined;
  readonly requestedBookmarkAnchor: ReaderBookmarkAnchorRequest | undefined;
  readonly directoryEntries: LocalReadingTocEntry[];
}

export interface ReaderReadingMountRoutes {
  readonly current: () => ReaderReadingMountRoute;
  readonly isReaderIdentityCurrent: () => boolean;
  readonly resolveSourceSwitchTransactionId: (sourceId: string, bookId: string) => Promise<string | undefined>;
  readonly onRemoteSessionReady: (session: RemoteReadingSession) => void;
}

export interface ReaderReadingEntryLayout {
  readonly appearance: ReaderAppearanceSnapshot;
  readonly settings: ReaderSettingsSnapshot;
  readonly appearanceReady: boolean;
  readonly settingsReady: boolean;
  readonly viewportReady: boolean;
}

export interface ReaderReadingEntryFrame {
  readonly phase: 'loading' | 'measuring' | 'ready' | 'failed';
  readonly chapter: ReadingSessionChapter | undefined;
  readonly page: PhysicalReadingPage | undefined;
  readonly visiblePageSelectionToken: number;
  readonly measurementEpoch: number;
  readonly visibleBody: boolean;
  readonly measurementCompleting: boolean;
  readonly exitRequested: boolean;
  readonly foreground: boolean;
  readonly chromeActive: boolean;
  readonly continuousEntryPositionReady: boolean;
}

export interface ReaderReadingRetainedPageCapture {
  readonly measurementDeferred: boolean;
  readonly pageTurnPending: boolean;
  readonly selectionInFlight: boolean;
  readonly paragraphCount: number;
  readonly captureContext: () => ReaderMaterializedChapterContext;
  readonly matchesCurrentPagination: (key: ReadingPaginationKey) => boolean;
}

export interface ReaderReadingMountPresentation {
  readonly selectionToken: () => number;
  readonly exitRequested: () => boolean;
  readonly frame: () => ReaderReadingEntryFrame;
  readonly layout: () => ReaderReadingEntryLayout;
  readonly layoutSignature: () => string;
  readonly uiContext: () => UIContext;
  readonly publishMounted: (mounted: boolean) => void;
  readonly loadAppearance: (lifecycle: number) => Promise<void>;
  readonly loadSettings: (lifecycle: number) => Promise<void>;
  readonly applyLoadedSystemPreferences: () => void;
  readonly resolveBookmarkPosition: (bookmark: ReaderBookmarkAnchorRequest) => RemoteReadingPositionContext | undefined;
  readonly restoreProgress: (progress: LocalReadingProgressState | undefined, bookmarkRequestId: number | undefined) => void;
  readonly openInitialChapter: (request: InitialReadingOpenRequest) => Promise<void>;
  readonly publishPersistedEntry: (entry: ReadingFirstFrameEntry, selection: number) => void;
  readonly retainedPresentation: () => ReaderRetainedPresentation | undefined;
  readonly publishRetainedEntry: (entry: ReaderRetainedPresentation, key: ReadingPaginationKey, observation: ReadingPaginationPrefixObservation, selection: number, lifecycle: number) => void;
  readonly captureRetainedPage: () => ReaderReadingRetainedPageCapture;
  readonly isVisiblePageCurrent: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number) => boolean;
  readonly beginMeasurement: (lifecycle: number) => void;
  readonly restartMeasurement: (lifecycle: number) => void;
  readonly admitExpandedWindow: (chapter: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap, lifecycle: number, selection: number) => void;
  readonly beginReadingRecord: (lifecycle: number) => void;
  readonly preparePageTurn: () => void;
  readonly notifyReadingReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number) => void;
  readonly fail: (error: Error, lifecycle: number) => void;
}

export interface ReaderReadingMountCatalog {
  readonly currentToc: () => LocalReadingTocEntry[];
  readonly readableToc: () => LocalReadingTocEntry[];
  readonly currentChapter: () => ReadingSessionChapter | undefined;
  readonly protectReadingWindow: (chapter: ReadingSessionChapter) => ReadingCatalogProtectedWindow;
  readonly publishToc: (entries: LocalReadingTocEntry[]) => void;
  readonly directoryChanged: (entries: LocalReadingTocEntry[]) => void;
  readonly publishLoading: (loading: boolean) => void;
  readonly publishLoadFailed: (failed: boolean) => void;
  readonly stopAutomaticPagingAfterCatalogFailure: () => boolean;
  readonly releaseUnretainedImages: () => void;
  readonly reportPrefetch: () => void;
  readonly resumePaging: () => void;
}

export interface ReaderReadingMountStart {
  readonly retireRecovery: () => void;
  readonly resetSpeech: () => void;
  readonly initializePresentation: (lifecycle: number) => void;
  readonly resetEntryPresentation: (lifecycle: number) => void;
  readonly registerExit: () => (() => void) | undefined;
}

export interface ReaderReadingMountEnd {
  readonly retirePresentation: () => void;
  readonly restoreAppWindow: () => void;
  readonly detachOperators: () => (() => void) | undefined;
  readonly finishPresentation: () => void;
}

export interface ReaderReadingNativeMountActors {
  readonly preferences: ReaderReadingPreferencesHost;
  readonly controlDirectory: ReaderControlDirectorySession;
  readonly controlVerification: ReaderControlVerificationSession;
  readonly controlGeometry: ReaderControlGeometryHost;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly turn: ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly settlement: ReaderPageTurnSettlementHost;
  readonly preparation: ReaderPageTurnPreparationHost;
  readonly measured: ReaderMeasuredPagePublication;
  readonly surface: ReaderReadingSurfaceHost;
  readonly pageChrome: ReaderReadingPageChromeHost;
  readonly chapterPresentation: ReaderReadingChapterPresentationHost;
  readonly acquisition: ReaderReadingChapterAcquisitionHost;
  readonly speech: ReaderReadingSpeechHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly autoPage: ReaderAutoPageCoordinator;
  readonly auxiliary: ReaderAuxiliarySessionHost;
  readonly contentMutation: ReaderReadingContentMutationHost;
  readonly producers: ReaderProgressProducerHost;
  readonly record: ReaderReadingRecordHost;
  readonly images: ReaderReadingImageResidencyHost;
  readonly smartGesture: HarmonySmartGestureHost;
  readonly sourceSwitch: ReadingSourceSwitchOverlayHost;
  readonly brightness: ReaderBrightnessSession;
  readonly search: ReaderContentSearchPublication;
  readonly replace: ReaderControlReplacePanel;
}

export interface ReaderReadingNativeMountView {
  readonly registerExit: () => (() => void) | undefined;
  readonly admitInitialWindowGeometry: () => void;
  readonly controlInputBoundaryChanged: () => void;
  readonly publishBookTurnCapability: () => void;
  readonly hideNativeTurnSurface: () => void;
  readonly bindScreenLockObservation: () => void;
  readonly invalidatePageTurnRuntime: (disposeTextures: boolean) => void;
  readonly windowLayout: () => ReadingWindowLayoutInput;
  readonly clearExitRequest: () => void;
  readonly windowChromeActive: () => boolean;
  readonly clearLoadingChapter: () => void;
  readonly retirePrefetch: () => void;
}

/** Native facts needed to adopt a persisted or retained entry. Route identity
 * and gateway leases stay in ReaderReadingMountHost. */
export interface ReaderMountedEntryScene {
  readonly mount: () => ReaderReadingMountHost;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly measured: ReaderMeasuredPagePublication;
  readonly surface: ReaderReadingSurfaceHost;
  readonly preferences: ReaderReadingPreferencesHost;
  readonly acquisition: ReaderReadingChapterAcquisitionHost;
  readonly images: () => ReaderReadingImageResidencyHost;
  readonly firstPage: () => ReaderReadingMeasurementAdmissionHost;
  readonly progress: () => ReaderReadingProgressHost;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly settlement: () => ReaderPageTurnSettlementHost;
  readonly directory: () => ReaderControlDirectoryOperationsHost;
  readonly turnInput: () => ReaderPageTurnInputHost;
  readonly recovery: () => ReaderReadingRecoveryHost;
  readonly autoPage: () => ReaderAutoPageCoordinator;
  readonly exitProgress: ReadingExitProgressCoordinator;
  readonly foreground: () => boolean;
  readonly windowChromeActive: () => boolean;
  readonly selection: () => number;
  readonly uiContext: () => UIContext;
  readonly viewportReady: () => boolean;
  readonly layoutSignature: () => string;
  readonly paginationKey: () => ReadingPaginationKey;
  readonly retainedEntry: () => ReaderRetainedPresentation | undefined;
  readonly bookmarkPosition: (bookmark: ReaderBookmarkAnchorRequest) => RemoteReadingPositionContext | undefined;
  readonly publishMounted: (mounted: boolean) => void;
  readonly publishPhase: (phase: ReadingPhase) => void;
  readonly admitChapterVersion: (index: number, version: string) => void;
  readonly retainWindow: () => void;
  readonly traceInputReady: (lifecycle: number) => void;
  readonly resumeAutomatic: () => void;
  readonly startRecord: (lifecycle: number) => void;
  readonly readableToc: () => LocalReadingTocEntry[];
  readonly publishToc: (entries: LocalReadingTocEntry[]) => void;
  readonly directoryChanged: (entries: LocalReadingTocEntry[]) => void;
  readonly publishCatalogLoading: (loading: boolean) => void;
  readonly publishCatalogFailed: (failed: boolean) => void;
  readonly reportPrefetch: () => void;
  readonly resumePaging: () => void;
}

const LOCAL_READING_SOURCE_ID = 'local';

/** Owns the route's acquisition, mounted continuation and catalog admission.
 * Native rendering and acknowledged progress remain owned by the same reader. */
export class ReaderReadingMountHost {
  private entryProgress: LocalReadingProgressState | undefined = undefined;
  private consumedBookmarkRequest: number = -1;
  private readonly chapterWindow: ReadingChapterWindow;
  private readonly feedback: ReaderTransientFeedback;
  private readonly progress: ReadingExitProgressCoordinator;
  private readonly routes: ReaderReadingMountRoutes;
  private readonly view: ReaderReadingMountPresentation;
  private readonly catalog: ReaderReadingMountCatalog;
  private readonly chapterPreparation: ReadingInteractiveChapterPreparation;
  readonly hydration: ReadingEntryHydrationCoordinator;
  private lifecycle: number = 0;
  private mounted: boolean = false;
  private session: ReadingSessionFlowGateway | undefined;
  private observeSession: (() => void) | undefined;
  private withdrawExit: (() => void) | undefined;
  private prepared: ReadingEntrySnapshot | undefined;
  private navigation: ReadingEntryNavigation | undefined;
  private catalogPending: boolean = false;
  private catalogAdmissionRevision: number = 0;
  private resumeOnlyChapter: number | undefined;

  constructor(chapterWindow: ReadingChapterWindow, feedback: ReaderTransientFeedback,
    progress: ReadingExitProgressCoordinator, routes: ReaderReadingMountRoutes, view: ReaderReadingMountPresentation,
    catalog: ReaderReadingMountCatalog, chapterPreparation: ReadingInteractiveChapterPreparation) {
    this.chapterWindow = chapterWindow;
    this.feedback = feedback;
    this.progress = progress;
    this.routes = routes;
    this.view = view;
    this.catalog = catalog;
    this.chapterPreparation = chapterPreparation;
    this.hydration = new ReadingEntryHydrationCoordinator({
      chapterWindow,
      catalog: this.catalogPort(),
      isSessionActive: (lifecycle: number): boolean => this.isSessionActive(lifecycle),
      captureWindowSelection: (chapter: ReadingSessionChapter): (() => boolean) => {
        const lifecycle = this.lifecycle, selection = this.view.selectionToken();
        return (): boolean => this.isSelectionActive(lifecycle, selection) && this.view.frame().chapter === chapter;
      },
      captureWindowRequest: (chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowPortRequest =>
        this.captureWindowExpansion(chapter, lane),
      postFrame: (run: () => void): void => this.view.uiContext().postFrameCallback(new ReaderUIFrameCallback(run)),
      reportWindowFailure: (error: Error): void =>
        hilog.warn(0x5244, 'Reader', 'Reading entry expansion: %{private}s', errorMessageOf(error)),
    }, {
      now: (): number => Date.now(),
      mark: (entryId: number, phase: string, status: string): void => {
        ReaderStartupTrace.current()?.mark(`reader.${phase}`, status, entryId);
      },
      phase: (phase: string, lifecycle: number, elapsedMs: number): void => {
        hilog.info(0x5244, 'Reader', 'PERF reader-entry phase=%{public}s lifecycle=%{public}d elapsedMs=%{public}d',
          phase, lifecycle, elapsedMs);
      },
      firstBuild: (outcome: ReadingFirstBuild, elapsedMs: number): void => {
        hilog.info(0x5244, 'Reader', 'PERF reader-entry first-build=%{public}s elapsedMs=%{public}d', outcome, elapsedMs);
      },
    }, {
      set: (delay: number, callback: () => void): number => setTimeout(callback, delay),
      clear: (handle: number): void => clearTimeout(handle),
      visibleBody: (): boolean => this.view.frame().visibleBody,
      ready: (): boolean => this.view.frame().phase === 'ready',
      activeSelection: (lifecycle: number, selection: number): boolean => this.isSelectionActive(lifecycle, selection),
      completing: (): boolean => {
        const frame = this.view.frame();
        return this.mounted && !frame.exitRequested && frame.phase === 'measuring' && frame.measurementCompleting;
      },
      restartMeasurement: (): void => this.view.restartMeasurement(this.lifecycle),
      fail: (error: Error, lifecycle: number): void => this.view.fail(error, lifecycle),
    });
  }

  get lifecycleToken(): number { return this.lifecycle; }
  get gateway(): ReadingSessionFlowGateway | undefined { return this.session; }
  get preparedEntry(): ReadingEntrySnapshot | undefined { return this.prepared; }
  get entryCatalogNavigation(): ReadingEntryNavigation | undefined { return this.navigation; }
  get entryCatalogPending(): boolean { return this.catalogPending; }

  isMountedToken(lifecycle: number): boolean { return this.mounted && lifecycle === this.lifecycle; }

  isSessionActive(lifecycle: number): boolean {
    return this.isMountedToken(lifecycle) && !this.view.exitRequested() && this.routes.isReaderIdentityCurrent();
  }

  isSelectionActive(lifecycle: number, selection: number): boolean {
    return this.isSessionActive(lifecycle) && selection === this.view.selectionToken();
  }

  activeGateway(): ReadingSessionFlowGateway {
    if (this.session === undefined) throw new Error('reading session gateway is not initialized');
    return this.session;
  }

  discardPreparedEntry(): void { this.prepared = undefined; }

  restoredProgress(): LocalReadingProgressState | undefined { return this.entryProgress; }

  recordRestoration(progress: LocalReadingProgressState | undefined, bookmarkRequestId?: number): void {
    this.entryProgress = progress;
    if (bookmarkRequestId !== undefined) this.consumedBookmarkRequest = bookmarkRequestId;
  }

  hasConsumedBookmarkAnchor(requestId: number): boolean { return this.consumedBookmarkRequest === requestId; }

  consumeBookmarkAnchor(requestId: number): void { this.consumedBookmarkRequest = requestId; }

  mountNative(actors: ReaderReadingNativeMountActors, native: ReaderReadingNativeMountView): void {
    this.mount({
      retireRecovery: (): void => actors.recovery.retire(),
      resetSpeech: (): void => actors.speech.beginMount(),
      initializePresentation: (lifecycle: number): void => this.initializeNativePresentation(actors, native, lifecycle),
      resetEntryPresentation: (): void => {
        actors.chapterPresentation.resetReadyReceipt();
        actors.directory.invalidateCatalog();
        actors.acquisition.beginMount();
        this.progress.resetProgress();
        actors.directory.selection.reset();
        actors.chapterPresentation.clearChapterPresentation();
        actors.speech.resetPreparation();
        actors.contentMutation.resetConversionLoad();
        registerReaderFonts(this.view.uiContext().getFont());
      },
      registerExit: (): (() => void) | undefined => native.registerExit(),
    });
  }

  private initializeNativePresentation(actors: ReaderReadingNativeMountActors, native: ReaderReadingNativeMountView,
    lifecycle: number): void {
    const preferences = actors.preferences;
    const turn = actors.turn;
    preferences.beginWindowPolicyOwnership(lifecycle);
    preferences.restoreEntryPresentation();
    native.admitInitialWindowGeometry();
    actors.controlDirectory.request(createReaderControlSessionState());
    actors.controlVerification.start();
    actors.directory.beginMount();
    actors.controlDirectory.beginMount();
    actors.controlGeometry.beginMount();
    native.controlInputBoundaryChanged();
    native.publishBookTurnCapability();
    turn.surfaceRecoveryPending = false;
    turn.awaitingSlots = false;
    // An absent or retired front buffer cannot enter the first composition.
    native.hideNativeTurnSurface();
    turn.surfaceGeneration = 0;
    turn.texture.invalidate(true);
    turn.session.clearCapturedTextures();
    turn.session.setEventListener((event: BookTurnNativeEvent): void => turn.onNativeEvent(event));
    preferences.attachSystemEvents();
    native.bindScreenLockObservation();
    actors.settlement.clearDeferred();
    native.invalidatePageTurnRuntime(false);
    const measured = actors.measured;
    measured.measurementCoordinator.rememberWindowLayout(native.windowLayout());
    preferences.applyWindowChrome();
    preferences.applyWindowPolicyForChromeOwner();
    native.clearExitRequest();
    preferences.bindAppearanceSaveRecovery(lifecycle);
    this.progress.resetExitDelivery();
    actors.record.retire();
    this.progress.resetWriteActivity();
    actors.producers.retireContinuous();
    actors.surface.continuousUserInteractionActive = false;
    actors.images.resetChapter();
    measured.measurementCompleting = false;
    measured.measurementCoordinator.clearDeferredRequest();
    actors.autoPage.cancelStart();
    actors.autoPage.reset();
    actors.pageChrome.startClock(lifecycle);
  }

  unmountNative(actors: ReaderReadingNativeMountActors, native: ReaderReadingNativeMountView): void {
    this.unmount({
      retirePresentation: (): void => this.retireNativePresentation(actors, native),
      restoreAppWindow: (): void => {
        native.clearLoadingChapter();
        native.controlInputBoundaryChanged();
        if (this.routes.isReaderIdentityCurrent() && native.windowChromeActive()) ReaderWindowCoordinator.requestAppChrome();
        actors.preferences.releaseWindowPolicyOwnership();
      },
      detachOperators: (): (() => void) | undefined => this.detachNativeOperators(actors),
      finishPresentation: (): void => {
        actors.measured.resetPaginationDraft();
        actors.measured.measurementRun.cancelDeadline();
        actors.preparation.cancelRetry();
        actors.measured.nativeMeasurement.clear();
      },
    });
  }

  private retireNativePresentation(actors: ReaderReadingNativeMountActors, native: ReaderReadingNativeMountView): void {
    actors.smartGesture.detach();
    native.retirePrefetch();
    actors.controlGeometry.fontOrder.retire();
    actors.controlVerification.stop();
    actors.recovery.retire();
    actors.preferences.retireAppearanceSaveRecovery();
    actors.controlGeometry.retireMinimum();
    this.feedback.reset();
    this.progress.retireRetainedVisit();
    actors.sourceSwitch.retire();
    actors.producers.retireContinuous();
    actors.auxiliary.clearStaticCapsuleOrigin();
    actors.auxiliary.finish();
    actors.bookmark.retire();
    // A route unmount must leave final writes with the original exit handoff.
    native.invalidatePageTurnRuntime(true);
    const turn = actors.turn;
    turn.session.setEventListener((_event: BookTurnNativeEvent): void => {});
    turn.texture.invalidate(true);
    turn.motion = undefined;
    turn.surfaceGeneration += 1;
    native.hideNativeTurnSurface();
    actors.settlement.clearDeferred();
    actors.brightness.restore();
    actors.preferences.retireSystemEvents();
  }

  private detachNativeOperators(actors: ReaderReadingNativeMountActors): (() => void) | undefined {
    actors.search.cancel();
    actors.replace.advancePanel();
    actors.measured.measurementCoordinator.clearDeferredLayoutInvalidation();
    actors.replace.invalidateMutation();
    actors.autoPage.cancelStart();
    actors.autoPage.dispose();
    actors.autoPage.clearPageTimer(true);
    actors.autoPage.clearSessionTimer(true);
    actors.pageChrome.retireClock();
    actors.auxiliary.retirePendingCapsuleMeasurement();
    actors.record.retire();
    const disposeSpeech = actors.speech.detach();
    actors.measured.previousChapterMeasurement = undefined;
    actors.directory.selection.reset();
    actors.chapterPresentation.clearChapterPresentation();
    actors.images.close();
    this.chapterWindow.clear();
    return disposeSpeech;
  }

  mount(actions: ReaderReadingMountStart): void {
    actions.retireRecovery();
    this.lifecycle += 1;
    const lifecycle = this.lifecycle;
    actions.resetSpeech();
    this.hydration.beginMount(lifecycle, ReaderStartupTrace.current()?.currentEntryId() ?? 0);
    this.mounted = true;
    this.view.publishMounted(true);
    actions.initializePresentation(lifecycle);
    // The reader may mount before its catalog exists. Acquisition and its
    // failure stay part of the same mounted continuation.
    this.session = undefined;
    this.resumeOnlyChapter = undefined;
    this.navigation = undefined;
    this.catalogPending = false;
    this.catalog.publishLoading(false);
    this.catalog.publishLoadFailed(false);
    actions.resetEntryPresentation(lifecycle);
    this.withdrawExit = actions.registerExit();
    if (!this.restoreRetainedEntry(lifecycle) && this.restorePersistedFirstFrame(lifecycle) === 'unavailable') {
      this.hydration.armReadyDeadline(lifecycle, this.view.selectionToken());
      void this.loadInitialReading(lifecycle);
    }
  }

  unmount(actions: ReaderReadingMountEnd): void {
    actions.retirePresentation();
    this.mounted = false;
    this.view.publishMounted(false);
    actions.restoreAppWindow();
    this.lifecycle += 1;
    this.hydration.retireMount();
    const disposeSpeech = actions.detachOperators();
    this.observeSession?.();
    this.observeSession = undefined;
    this.session = undefined;
    disposeSpeech?.();
    actions.finishPresentation();
    this.withdrawExit?.();
    this.withdrawExit = undefined;
  }

  loadInitialReading(lifecycle: number): Promise<void> {
    return this.hydration.startAsyncEntry(lifecycle, this.initialChapterHost());
  }

  restartPreparedReadingEntry(lifecycle: number, selection: number, layoutReady: Promise<void[]>): Promise<void> {
    return this.hydration.restartPreparedEntry(lifecycle, selection, layoutReady, this.initialChapterHost());
  }

  private async ensureReadingSession(lifecycle: number, selection: number, discardPrepared: boolean = false): Promise<void> {
    if (this.session !== undefined) return;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycle, selection) && this.view.frame().phase !== 'failed';
    const owner = ReaderRuntimeOwner.current();
    const preparation = owner.readingEntryPreparations();
    const route = this.routes.current();
    const prepared = !discardPrepared && route.requestedChapterIndex === undefined &&
      route.requestedBookmarkAnchor === undefined && route.sourceSwitchTransactionId === undefined ?
      preparation.take(route.sourceId, route.bookId) : undefined;
    preparation.setPaused(true);
    const opening = this.routes.current();
    let transactionPending = opening.sourceSwitchTransactionId !== undefined;
    let preparedSession: RemoteReadingSession | undefined;
    const gateway = await ReadingSessionFlowGateway.open({
      sourceId: opening.sourceId,
      bookId: opening.bookId,
      hasPreparedEntry: prepared !== undefined,
      remoteSession: discardPrepared ? undefined :
        (prepared?.isCurrent() === true ? prepared.gateway.remoteSession() : opening.remoteSession),
      remoteBookSeed: opening.remoteBookSeed,
      sourceSwitchTransactionId: opening.sourceSwitchTransactionId,
      isCurrent,
      resolveSourceSwitchTransactionId: async (sourceId: string, bookId: string): Promise<string | undefined> => {
        const transaction = await this.routes.resolveSourceSwitchTransactionId(sourceId, bookId);
        transactionPending = transaction !== undefined;
        return transaction;
      },
      onRemoteSessionReady: (session: RemoteReadingSession): void => {
        if (prepared === undefined) this.routes.onRemoteSessionReady(session);
        else preparedSession = session;
      },
    }, owner);
    if (!isCurrent() || gateway === undefined) return;
    if (prepared !== undefined && (!prepared.isCurrent() || transactionPending)) {
      await this.ensureReadingSession(lifecycle, selection, true);
      return;
    }
    this.session = gateway;
    this.subscribeRemoteSession(gateway, lifecycle);
    this.prepared = !transactionPending && prepared?.isCurrent() === true ? prepared : undefined;
    if (preparedSession !== undefined) this.routes.onRemoteSessionReady(preparedSession);
  }

  private subscribeRemoteSession(gateway: ReadingSessionFlowGateway, lifecycle: number): void {
    this.observeSession?.();
    this.observeSession = gateway.observeRemoteSession?.((session: RemoteReadingSession): void => {
      if (this.isSessionActive(lifecycle)) this.routes.onRemoteSessionReady(session);
    });
  }

  private restorePersistedFirstFrame(lifecycle: number): ReadingFirstBuild {
    const owner = ReaderRuntimeOwner.current();
    const metrics = ReaderWindowCoordinator.metrics();
    const layout = this.view.layout();
    return this.hydration.restoreFirstFrame(lifecycle, {
      appearanceReady: layout.appearanceReady,
      settingsReady: layout.settingsReady,
      viewportReady: layout.viewportReady && metrics.ready,
      fontReady: (): boolean => readerFontFamilyReady(readerAppearanceSnapshotFontFamily(this.view.layout().appearance)),
      sourceSwitchPending: this.routes.current().sourceSwitchTransactionId !== undefined,
      supportsPreparedEntry: (): boolean => owner.supportsCoreCapability('reading.entry.firstFrame.v1'),
      screenDirection: layout.settings.screenDirection,
      width: metrics.windowRect.width,
      height: metrics.windowRect.height,
    }, (): ReadingFirstFrameRead => {
      const selection = this.view.selectionToken();
      const isCurrent = (): boolean => this.isSelectionActive(lifecycle, selection);
      const route = this.routes.current();
      const source: ReadingSessionSource = route.sourceId === LOCAL_READING_SOURCE_ID ? { kind: 'local' } :
        { kind: 'remote', session: route.remoteSession, seed: route.remoteBookSeed,
          onSessionReady: (session: RemoteReadingSession): void => {
            if (isCurrent()) this.routes.onRemoteSessionReady(session);
          } };
      const gateway = new ReadingSessionFlowGateway(route.sourceId, route.bookId, source, owner);
      return {
        sourceId: route.sourceId,
        bookId: route.bookId,
        requestedChapter: this.normalizedRequestedChapter(route),
        bookmark: route.requestedBookmarkAnchor,
        pendingProgress: gateway.pendingPresentedProgress(),
        navigationMode: this.view.layout().settings.navigationMode,
        isCurrent,
        windowIsCurrent: (): boolean => ReaderWindowCoordinator.metrics().revision === metrics.revision,
        read: (index: number | undefined, current: () => boolean,
          context: RemoteReadingPositionContext | undefined): CoreReadingEntrySnapshot | undefined => {
          const live = this.routes.current();
          return readPreparedReadingEntrySnapshot(owner, live.sourceId, live.bookId, index, current,
            readingParagraphBoundaryMode(live.sourceId, live.bookKind), context);
        },
        install: (snapshot: CoreReadingEntrySnapshot): boolean => {
          if (!this.admitEntryResume(snapshot)) return false;
          gateway.admitPreparedEntry(snapshot);
          this.session = gateway;
          return true;
        },
        publish: (entry: ReadingFirstFrameEntry): void => {
          this.subscribeRemoteSession(gateway, lifecycle);
          this.prepared = undefined;
          this.navigation = entry.snapshot.navigation;
          this.catalogPending = true;
          this.catalog.publishToc(entry.entries);
          this.configureChapterWindow(entry.entries);
          this.view.publishPersistedEntry(entry, selection);
          ReaderRuntimeOwner.current().readingEntryPreparations().setPaused(true);
          this.view.applyLoadedSystemPreferences();
        },
        measure: (): 'ready' | 'deferred' | 'failed' => {
          this.view.beginMeasurement(lifecycle);
          const frame = this.view.frame();
          return frame.phase === 'failed' ? 'failed' :
            frame.phase === 'ready' && frame.page !== undefined && frame.visibleBody ? 'ready' : 'deferred';
        },
        fail: (error: Error): void => this.view.fail(error, lifecycle),
      };
    });
  }

  private restoreRetainedEntry(lifecycle: number): boolean {
    if (!ReaderRuntimeOwner.current().optionalReadingEntryMemoryEnabled()) return false;
    const snapshot = this.view.retainedPresentation();
    if (snapshot === undefined || !snapshot.isCurrent()) return false;
    const route = this.routes.current();
    const layout = this.view.layout();
    if (!layout.viewportReady || !layout.settingsReady || route.requestedChapterIndex !== undefined ||
      route.requestedBookmarkAnchor !== undefined || route.sourceSwitchTransactionId !== undefined ||
      snapshot.sourceId !== route.sourceId || snapshot.bookId !== route.bookId ||
      snapshot.gateway.hasPendingSourceSwitch() || layout.appearance.customFont !== undefined ||
      snapshot.appearanceKey !== JSON.stringify(layout.appearance) ||
      snapshot.settingsKey !== JSON.stringify(layout.settings) ||
      snapshot.densityPixels !== ReaderWindowCoordinator.metrics().densityPixels ||
      snapshot.layoutKey !== this.view.layoutSignature()) return false;
    const retainedDraft = snapshot.context.paginationDraft;
    const retainedKey: ReadingPaginationKey = {
      sourceId: route.sourceId, bookId: route.bookId, chapterIndex: snapshot.context.chapter.chapterIndex,
      contentVersion: snapshot.context.contentVersion, layoutSignature: snapshot.layoutKey,
    };
    const observation = retainedDraft?.matches(retainedKey) === true ?
      retainedDraft.observationForPageStart(snapshot.page.startScalar) : undefined;
    if (observation === undefined || observation.endScalarExclusive !== snapshot.page.endScalar) return false;
    this.hydration.startTrace(lifecycle);
    this.hydration.trace(lifecycle, 'retained-layout-ready');
    const selection = this.view.selectionToken();
    const isCurrent = (): boolean => {
      if (!this.isSelectionActive(lifecycle, selection)) return false;
      const frame = this.view.frame();
      return frame.phase === 'ready' && frame.page === snapshot.page && frame.chapter === snapshot.context.chapter;
    };
    this.session = snapshot.gateway;
    this.subscribeRemoteSession(snapshot.gateway, lifecycle);
    this.prepared = undefined;
    this.navigation = snapshot.navigation;
    this.catalogPending = snapshot.catalogPending;
    this.catalog.publishToc(snapshot.toc);
    this.configureChapterWindow();
    this.view.publishRetainedEntry(snapshot, retainedKey, observation, selection, lifecycle);
    if (!isCurrent()) return true;
    this.progress.retainCommittedVisit();
    this.admitRetainedReadingRecency();
    ReaderRuntimeOwner.current().readingEntryPreparations().setPaused(true);
    this.view.applyLoadedSystemPreferences();
    this.view.beginReadingRecord(lifecycle);
    if (!this.catalogPending) this.catalog.directoryChanged(snapshot.toc);
    if (!isCurrent()) return true;
    const remote = snapshot.gateway.remoteSession();
    if (remote !== undefined) this.routes.onRemoteSessionReady(remote);
    if (!isCurrent()) return true;
    this.view.preparePageTurn();
    this.view.notifyReadingReady(snapshot.context.chapter, snapshot.page, selection, lifecycle);
    if (isCurrent()) this.admitRetainedReadingRecency();
    return true;
  }

  admitRetainedReadingRecency(): void {
    const receipt = this.progress.retainedVisit;
    const frame = this.view.frame();
    const page = frame.page, chapter = frame.chapter;
    if (receipt === undefined || this.progress.retainedVisitVisible || !this.mounted ||
      !frame.foreground || !frame.chromeActive || frame.exitRequested || !this.routes.isReaderIdentityCurrent() ||
      receipt !== this.progress.committed || page === undefined || chapter === undefined) return;
    const route = this.routes.current();
    if (receipt.sourceId !== route.sourceId || receipt.bookId !== route.bookId ||
      receipt.chapterIndex !== chapter.chapterIndex || receipt.chapterOffset !== page.startScalar ||
      !this.view.isVisiblePageCurrent(page, chapter, frame.visiblePageSelectionToken, this.lifecycle)) return;
    this.progress.presentRetainedVisit();
  }

  retainConfirmedEntryPresentation(): void {
    const owner = ReaderRuntimeOwner.current();
    const handoff = readingEntryHandoff(owner);
    handoff.clear();
    if (!owner.optionalReadingEntryMemoryEnabled() || this.resumeOnlyChapter !== undefined ||
      this.progress.retainedVisitSkipped) return;
    const frame = this.view.frame();
    const page = frame.page, chapter = frame.chapter;
    const progress = this.progress.committed, session = this.session;
    if (frame.phase !== 'ready' || page === undefined || chapter === undefined || progress === undefined || session === undefined)
      return;
    const layout = this.view.layout();
    if (!layout.viewportReady || layout.settings.navigationMode !== 'paged' || layout.appearance.customFont !== undefined ||
      page.measuredAppearance === undefined || JSON.stringify(page.measuredAppearance) !== JSON.stringify(layout.appearance)) return;
    const capture = this.view.captureRetainedPage();
    if (capture.measurementDeferred || capture.pageTurnPending || chapter.images.length > 0 || page.fragments.length === 0 ||
      progress.chapterIndex !== chapter.chapterIndex || progress.chapterOffset !== page.startScalar ||
      session.hasPendingSourceSwitch() || capture.selectionInFlight) return;
    const route = this.routes.current();
    if (route.sourceSwitchTransactionId !== undefined) return;
    retainConfirmedReadingPage(new ReaderRetainedPageInput(
      owner, handoff, page, chapter, progress, session, route.sourceId, route.bookId, this.catalog.currentToc(),
      capture.paragraphCount, (): ReaderMaterializedChapterContext => capture.captureContext(),
      (key: ReadingPaginationKey): boolean => capture.matchesCurrentPagination(key),
      (): string => JSON.stringify(this.view.layout().appearance), (): string => JSON.stringify(this.view.layout().settings),
      (): string => this.view.layoutSignature(), (): number => ReaderWindowCoordinator.metrics().densityPixels,
      this.navigation, this.catalogPending,
    ));
  }

  private initialChapterHost(): ReadingInitialChapterHost {
    return {
      selectionToken: (): number => this.view.selectionToken(),
      isSelectionActive: (lifecycle: number, selection: number): boolean => this.isSelectionActive(lifecycle, selection),
      hasFailed: (): boolean => this.view.frame().phase === 'failed',
      ensureSession: (lifecycle: number, selection: number, discard?: boolean): Promise<void> =>
        this.ensureReadingSession(lifecycle, selection, discard),
      startTrace: (lifecycle: number): void => {
        this.hydration.startTrace(lifecycle);
        this.hydration.trace(lifecycle, 'start');
      },
      trace: (phase: string, lifecycle: number): void => this.hydration.trace(lifecycle, phase),
      loadAppearance: (lifecycle: number): Promise<void> => this.view.loadAppearance(lifecycle),
      loadSettings: (lifecycle: number): Promise<void> => this.view.loadSettings(lifecycle),
      activeGateway: (): ReadingSessionFlowGateway => this.activeGateway(),
      bookId: (): string => this.routes.current().bookId,
      isLocal: (): boolean => this.routes.current().sourceId === LOCAL_READING_SOURCE_ID,
      sourceSwitchRequested: (): boolean => this.routes.current().sourceSwitchTransactionId !== undefined,
      hasPendingSourceSwitch: (): boolean => this.session?.hasPendingSourceSwitch() === true,
      remoteSession: (): RemoteReadingSession | undefined => this.session?.remoteSession() ?? this.routes.current().remoteSession,
      paragraphBoundaryMode: (): ReadingParagraphBoundaryMode => this.paragraphBoundaryMode(),
      preparedEntry: (): ReadingEntrySnapshot | undefined => this.prepared,
      discardPreparedEntry: (): void => this.discardPreparedEntry(),
      retirePreparedSession: (): void => {
        this.prepared = undefined;
        // Keep the original listener until a new gateway is admitted or the
        // mount retires. Giving up a prepared body does not retire its mount.
        this.session = undefined;
      },
      waitForContentIdle: (): Promise<void> => {
        const owner = ReaderRuntimeOwner.current();
        const route = this.routes.current();
        return owner.waitForReadingContentIdle(route.sourceId, route.bookId);
      },
      clearChapterWindow: (): void => this.chapterWindow.clear(),
      loadToc: (current: () => boolean): Promise<LocalReadingToc> => this.loadInitialToc(current),
      admitFullToc: (entries: LocalReadingTocEntry[]): void => {
        this.catalog.publishToc(entries);
        this.catalog.directoryChanged(entries);
      },
      admitSnapshotToc: (snapshot: InitialReadingSnapshot): boolean => {
        if (!this.admitEntryResume(snapshot)) return false;
        this.navigation = snapshot.navigation;
        this.catalogPending = true;
        this.catalog.publishToc(readingEntryToc(snapshot));
        return true;
      },
      configureChapterWindow: (): void => this.configureChapterWindow(),
      readableToc: (): LocalReadingTocEntry[] => this.catalog.readableToc(),
      selection: (): InitialReadingSelection => {
        const route = this.routes.current();
        return { chapterIndex: this.normalizedRequestedChapter(route), bookmark: route.requestedBookmarkAnchor };
      },
      positionContext: (bookmark: ReaderBookmarkAnchorRequest): RemoteReadingPositionContext | undefined =>
        this.view.resolveBookmarkPosition(bookmark),
      requireKnownChapter: (index: number | undefined): number => this.requireKnownChapter(index),
      restoreProgress: (progress: LocalReadingProgressState | undefined, bookmark: ReaderBookmarkAnchorRequest | undefined): void =>
        this.view.restoreProgress(progress, bookmark?.requestId),
      openInitialChapter: (request: InitialReadingOpenRequest): Promise<void> => this.view.openInitialChapter(request),
      fail: (error: Error, lifecycle: number): void => this.view.fail(error, lifecycle),
    };
  }

  normalizedRequestedChapter(route: ReaderReadingMountRoute = this.routes.current()): number | undefined {
    const value = route.requestedChapterIndex;
    return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }

  requireKnownChapter(chapterIndex: number | undefined): number {
    if (this.catalog.readableToc().length === 0) throw new Error('LOCAL_TOC_EMPTY');
    if (chapterIndex === undefined) return this.catalog.readableToc()[0].index;
    if (this.chapterWindow.contains(chapterIndex)) return chapterIndex;
    throw new Error('LOCAL_TOC_CHAPTER_NOT_FOUND');
  }

  private loadInitialToc(current: () => boolean): Promise<LocalReadingToc> {
    const route = this.routes.current();
    if (route.directoryEntries.length === 0) return this.activeGateway().loadToc(route.bookId, current);
    return Promise.resolve(new InitialReadingToc(route.bookId, route.directoryEntries));
  }

  private admitEntryResume(snapshot: InitialReadingSnapshot): boolean {
    if (snapshot.resumeOnly === true) {
      const route = this.routes.current();
      if (this.normalizedRequestedChapter(route) !== undefined || route.requestedBookmarkAnchor !== undefined ||
        route.sourceSwitchTransactionId !== undefined || !snapshot.isCurrent() ||
        snapshot.chapter.sourceId !== route.sourceId || snapshot.chapter.bookId !== route.bookId ||
        snapshot.progress.kind !== 'restored' || snapshot.progress.progress.chapterIndex !== snapshot.chapter.chapterIndex)
        return false;
      this.resumeOnlyChapter = snapshot.chapter.chapterIndex;
    } else {
      if (snapshot.navigation?.current.navigable === false) return false;
      this.resumeOnlyChapter = undefined;
    }
    return true;
  }

  configureChapterWindow(entries: LocalReadingTocEntry[] = this.catalog.currentToc()): void {
    const order = readingChapterWindowOrder(entries, this.resumeOnlyChapter);
    const route = this.routes.current();
    this.chapterWindow.configure(route.sourceId, route.bookId, order, this.resumeOnlyChapter);
  }

  setCurrentReadingChapter(chapter: ReadingSessionChapter): void {
    this.chapterWindow.setCurrent(chapter);
    if (this.resumeOnlyChapter !== undefined && chapter.chapterIndex !== this.resumeOnlyChapter) {
      this.resumeOnlyChapter = undefined;
      this.activeGateway().clearEntryResume();
    }
  }

  entryChapterPosition(chapterIndex: number): number | undefined {
    return readerEntryNavigationItem(this.navigation, chapterIndex)?.readablePosition;
  }

  scheduleEntryWindowHydration(): void {
    const frame = this.view.frame();
    this.hydration.scheduleWindow(frame.chapter, this.view.layout().settings.navigationMode, frame.continuousEntryPositionReady);
  }

  private captureWindowExpansion(chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowPortRequest {
    const lifecycle = this.lifecycle, selection = this.view.selectionToken();
    const measurement = this.view.frame().measurementEpoch;
    const gateway = this.activeGateway();
    const contentCurrent = gateway.captureEntryContentValidity?.();
    return {
      isCurrent: (): boolean => {
        if (!this.isSelectionActive(lifecycle, selection)) return false;
        const live = this.view.frame();
        return live.chapter === chapter && live.measurementEpoch === measurement && contentCurrent?.() !== false;
      },
      complete: (current: () => boolean): Promise<ReadingSessionChapter> => gateway.completeEntryChapter(chapter, current, lane),
      boundaryMode: (): ReadingParagraphBoundaryMode => this.paragraphBoundaryMode(),
      admit: (expanded: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap): void =>
        this.view.admitExpandedWindow(expanded, ranges, map, lifecycle, selection),
    };
  }

  private paragraphBoundaryMode(): ReadingParagraphBoundaryMode {
    const route = this.routes.current();
    return readingParagraphBoundaryMode(route.sourceId, route.bookKind);
  }

  private catalogPort(): ReadingEntryCatalogPort {
    return {
      pending: (): boolean => this.catalogPending,
      startRequest: (): ReadingCatalogRequest => {
        const lifecycle = this.lifecycle, route = this.routes.current();
        const admissionRevision = this.catalogAdmissionRevision;
        const isCurrent = (): boolean => {
          if (!this.isSessionActive(lifecycle)) return false;
          const live = this.routes.current();
          return route.sourceId === live.sourceId && route.bookId === live.bookId &&
            admissionRevision === this.catalogAdmissionRevision;
        };
        this.catalog.publishLoading(true);
        this.catalog.publishLoadFailed(false);
        return { isCurrent, load: (): Promise<LocalReadingToc> => this.activeGateway().loadToc(route.bookId, isCurrent) };
      },
      currentChapter: (): ReadingSessionChapter | undefined => this.catalog.currentChapter(),
      resumeOnlyChapterIndex: (): number | undefined => this.resumeOnlyChapter,
      installCatalog: (entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void => {
        this.navigation = undefined;
        this.catalogPending = false;
        this.catalog.publishLoadFailed(false);
        this.catalog.publishToc(entries);
        this.configureChapterWindow();
        this.setCurrentReadingChapter(current);
      },
      afterAdmitted: (entries: LocalReadingTocEntry[]): void => {
        this.catalog.releaseUnretainedImages();
        this.catalog.directoryChanged(entries);
        this.prepareRemoteCatalogNearEnd();
      },
      fail: (current: () => boolean): void => this.onEntryCatalogFailure(current),
      finish: (): void => this.catalog.publishLoading(false),
      resumePaging: (): void => this.catalog.resumePaging(),
      reportDeferredFailure: (error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Deferred reader catalog: %{private}s', errorMessageOf(error));
      },
    };
  }

  private onEntryCatalogFailure(isCurrent: () => boolean): void {
    if (isCurrent()) this.catalog.publishLoadFailed(true);
    if (isCurrent() && this.catalog.stopAutomaticPagingAfterCatalogFailure()) {
      try {
        this.feedback.show(() => this.view.uiContext(),
          { message: '目录加载失败，自动翻页已停止，请重试' },
          (): boolean => {
            if (!isCurrent()) return false;
            const frame = this.view.frame();
            return frame.foreground && frame.chromeActive;
          });
      } catch (_) { /* The reading session may already be leaving. */ }
    }
  }

  onRemoteCatalogChanged(): void {
    const route = this.routes.current();
    const session = route.remoteSession;
    const gateway = this.session;
    const current = this.catalog.currentChapter();
    if (!this.isSessionActive(this.lifecycle) || session === undefined || gateway === undefined ||
      current === undefined || session.identity.sourceId !== route.sourceId || session.identity.bookId !== route.bookId) return;
    admitObservedReadingCatalog(session, gateway.remoteSession(), current, route.sourceId, route.bookId, this.chapterWindow, {
      catalogPending: (): boolean => this.catalogPending,
      currentToc: (): LocalReadingTocEntry[] => this.catalog.currentToc(),
      protectedWindow: (): ReadingCatalogProtectedWindow => this.catalog.protectReadingWindow(current),
      admitSession: (): boolean => gateway.admitRemoteCatalog(session),
      beginCatalogUpdate: (): void => {
        this.catalogAdmissionRevision += 1;
        this.catalog.reportPrefetch();
        this.navigation = undefined;
        this.catalogPending = false;
      },
      installCatalog: (entries: LocalReadingTocEntry[], currentChapter: ReadingSessionChapter): void => {
        this.catalog.publishToc(entries);
        const live = this.routes.current();
        this.chapterWindow.configure(live.sourceId, live.bookId, this.catalog.readableToc().map((item): number => item.index));
        this.chapterWindow.setCurrent(currentChapter);
      },
      afterAdmitted: (): void => {
        this.catalog.releaseUnretainedImages();
        this.catalog.resumePaging();
      },
    });
  }

  prepareRemoteCatalogNearEnd(): void {
    const gateway = this.session;
    const current = this.catalog.currentChapter();
    if (this.routes.current().sourceId === LOCAL_READING_SOURCE_ID || this.view.frame().phase !== 'ready' ||
      this.catalogPending || gateway === undefined || gateway.remoteSession() !== undefined || current === undefined) return;
    this.chapterPreparation.prepareNearEndCatalog((): number | undefined => {
      const entries = this.catalog.readableToc();
      const position = this.chapterWindow.position(current.chapterIndex);
      return position < 0 ? undefined : entries.length - position - 1;
    }, (): ReadingNearEndCatalogRequest => {
      const lifecycle = this.lifecycle, route = this.routes.current();
      return {
        key: JSON.stringify([route.sourceId, route.bookId, lifecycle]),
        isCurrent: (): boolean => {
          if (!this.isSessionActive(lifecycle) || this.session !== gateway) return false;
          const live = this.routes.current();
          return live.sourceId === route.sourceId && live.bookId === route.bookId;
        },
        load: (currentRequest: () => boolean): Promise<RemoteReadingSession> =>
          gateway.ensureRemoteSession(currentRequest, 'background'),
        reportFailure: (error: Error): void => {
          hilog.warn(0x5244, 'Reader', 'Near-end session preparation: %{private}s', errorMessageOf(error));
        },
      };
    });
  }
}

export function readerMountedEntryPresentation(scene: ReaderMountedEntryScene): ReaderReadingMountPresentation {
  return {
    selectionToken: (): number => scene.selection(),
    exitRequested: (): boolean => scene.session().exitRequested,
    frame: (): ReaderReadingEntryFrame => ({
      phase: scene.session().phase, chapter: scene.measured.chapter, page: scene.measured.page,
      visiblePageSelectionToken: scene.measured.selection, measurementEpoch: scene.projection().measurementEpoch,
      visibleBody: scene.projection().visibleFragments.length > 0,
      measurementCompleting: scene.measured.measurementCompleting, exitRequested: scene.session().exitRequested,
      foreground: scene.foreground(), chromeActive: scene.windowChromeActive(),
      continuousEntryPositionReady: scene.surface.continuousEntryPositionReady,
    }),
    layout: (): ReaderReadingEntryLayout => ({
      appearance: scene.chrome().appearanceSnapshot, settings: scene.chrome().readerSettingsSnapshot,
      appearanceReady: scene.preferences.entryAppearanceReady, settingsReady: scene.preferences.readerSettingsLoaded,
      viewportReady: scene.viewportReady(),
    }),
    layoutSignature: (): string => scene.layoutSignature(),
    uiContext: (): UIContext => scene.uiContext(),
    publishMounted: (mounted: boolean): void => scene.publishMounted(mounted),
    loadAppearance: (lifecycle: number): Promise<void> => scene.preferences.loadAppearanceSnapshot(lifecycle),
    loadSettings: (lifecycle: number): Promise<void> => scene.preferences.loadReaderSettingsSnapshot(lifecycle),
    applyLoadedSystemPreferences: (): void => scene.preferences.applyLoadedSystemPreferences(),
    resolveBookmarkPosition: (bookmark: ReaderBookmarkAnchorRequest): RemoteReadingPositionContext | undefined =>
      scene.bookmarkPosition(bookmark),
    restoreProgress: (progress: LocalReadingProgressState | undefined, bookmarkRequestId: number | undefined): void => {
      scene.mount().recordRestoration(progress, bookmarkRequestId);
    },
    openInitialChapter: (request: InitialReadingOpenRequest): Promise<void> =>
      scene.acquisition.openChapter(request.chapterIndex, true, request.lifecycleToken, request.selectionToken, request.offset,
        undefined, false, request.positionContext, request.layoutReady, request.unreadCandidates),
    publishPersistedEntry: (entry: ReadingFirstFrameEntry, selectionToken: number): void => {
      const chapter = entry.snapshot.chapter;
    scene.mount().recordRestoration(entry.progress, entry.bookmarkRequestId);
    scene.admitChapterVersion(chapter.chapterIndex, chapter.contentVersion);
    scene.mount().setCurrentReadingChapter(chapter);
    scene.retainWindow();
    scene.measured.chapter = chapter;
    scene.images().indexChapter(chapter);
    scene.measured.materializedChapterSelectionToken = selectionToken;
    scene.preferences.markAppearanceLoaded();
    admitReaderRestoredAnchor(scene.measured, scene.exitProgress, chapter, entry.map, scene.mount().restoredProgress(), entry.requestedScalar);
    },
    retainedPresentation: (): ReaderRetainedPresentation | undefined => scene.retainedEntry(),
    publishRetainedEntry: (snapshot: ReaderRetainedPresentation, retainedKey: ReadingPaginationKey,
      observation: ReadingPaginationPrefixObservation, selectionToken: number, lifecycleToken: number): void => {
    scene.measured.restoreMaterializedChapterContext(snapshot.context, true);
    // The handoff stays constant-size. Neighbour preparation expands a new
    // run, never the retained snapshot, and always starts with the real page.
    scene.measured.physicalPagination.draft = new ReadingPaginationPrefix(retainedKey, observation);
    scene.measured.physicalPagination.requestedAnchor = observation.requestScalar;
    scene.measured.materializedChapterSelectionToken = selectionToken;
    scene.mount().setCurrentReadingChapter(snapshot.context.chapter);
    scene.images().indexChapter(snapshot.context.chapter);
    scene.firstPage().publishMeasuredFirstPage(snapshot.page, snapshot.context.chapter, selectionToken);
    scene.measured.desiredChapterOffset = snapshot.page.startScalar;
    scene.measured.desiredChapterProgress = snapshot.progress.chapterProgress;
    scene.publishPhase('ready');
    scene.preferences.markAppearanceLoaded();
    scene.measured.measurementCompleting = false;
    scene.traceInputReady(lifecycleToken);
    scene.progress().admitCommittedProgress(snapshot.progress);
    },
    captureRetainedPage: (): ReaderReadingRetainedPageCapture => ({
      measurementDeferred: scene.measured.measurementCoordinator.hasDeferredWork(),
      pageTurnPending: scene.preparation().pending !== undefined || scene.settlement().prepared.prepared !== undefined,
      selectionInFlight: scene.directory().selection.ticket !== undefined,
      paragraphCount: scene.measured.nativeMeasurement.chapterRanges.length,
      captureContext: (): ReaderMaterializedChapterContext => scene.measured.captureMaterializedChapterContext(),
      matchesCurrentPagination: (key: ReadingPaginationKey): boolean => scene.measured.physicalPagination.sameKey(key, scene.paginationKey()),
    }),
    isVisiblePageCurrent: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      scene.progress().isVisiblePageCurrent(page, chapter, selection, lifecycle),
    beginMeasurement: (lifecycle: number): void => scene.measured.beginMeasurement(lifecycle),
    restartMeasurement: (lifecycle: number): void => {
      scene.measured.physicalPagination.index.invalidateMeasurement();
      scene.measured.measurementCompleting = false;
      scene.measured.batchProcessing = false;
      scene.measured.beginMeasurement(lifecycle);
    },
    admitExpandedWindow: (expanded: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap,
      lifecycle: number, selection: number): void => {
        scene.measured.chapter = expanded;
        scene.measured.chapterLayoutMap = map;
        scene.measured.materializedContentVersion = expanded.contentVersion;
        scene.mount().setCurrentReadingChapter(expanded);
        scene.images().indexChapter(expanded);
        scene.measured.nativeMeasurement.chapterRanges = ranges;
        scene.retainWindow();
        if (scene.chrome().readerSettingsSnapshot.navigationMode === 'continuous') scene.surface.rebuildContinuousFragments(true);
        // Existing visible native nodes and absolute page facts stay unchanged.
        if (scene.session().phase === 'ready') {
          scene.preparation().schedule();
          scene.acquisition.prefetchNextChapter(expanded, lifecycle, selection);
          scene.turnInput().drain();
          scene.resumeAutomatic();
        }
    },
    beginReadingRecord: (lifecycle: number): void => scene.startRecord(lifecycle),
    preparePageTurn: (): void => scene.preparation().schedule(),
    notifyReadingReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number): void => {
      scene.directory().notifyReadingReady(chapter.chapterIndex, chapter.chapterTitle, page, selection, lifecycle);
    },
    fail: (error: Error, lifecycle: number): void => scene.recovery().fail(error, lifecycle),
  };
}

export function readerMountedEntryCatalog(scene: ReaderMountedEntryScene): ReaderReadingMountCatalog {
  return {
    currentToc: (): LocalReadingTocEntry[] => scene.chrome().tocEntries,
    readableToc: (): LocalReadingTocEntry[] => scene.readableToc(),
    currentChapter: (): ReadingSessionChapter | undefined => scene.preparation().pending?.origin.chapter ?? scene.measured.chapter,
    protectReadingWindow: (current: ReadingSessionChapter): ReadingCatalogProtectedWindow => {
        const gesture = scene.turnInput().pointerId >= 0 ? scene.settlement().pageTurn.admittedPrepared() : undefined;
        return {
          bodies: [current, scene.measured.chapter, scene.measured.adjacentMeasurementContext?.chapter, gesture?.context.chapter,
            scene.settlement().prepared.prepared?.context.chapter, scene.directory().selection.origin?.context.chapter,
            scene.directory().selection.candidate?.context.chapter],
          discardUnprotectedPreparations: (): void => scene.settlement().pageTurn.clearUnprotectedNeighbours(gesture),
        };
    },
    publishToc: (entries: LocalReadingTocEntry[]): void => scene.publishToc(entries),
    directoryChanged: (entries: LocalReadingTocEntry[]): void => scene.directoryChanged(entries),
    publishLoading: (loading: boolean): void => scene.publishCatalogLoading(loading),
    publishLoadFailed: (failed: boolean): void => scene.publishCatalogFailed(failed),
    stopAutomaticPagingAfterCatalogFailure: (): boolean => scene.autoPage().catalogLoadFailed(),
    releaseUnretainedImages: (): void => scene.images().releaseUnretainedReadingImages(),
    reportPrefetch: (): void => scene.reportPrefetch(),
    resumePaging: (): void => scene.resumePaging(),
  };
}

export function admitReaderRestoredAnchor(measured: ReaderMeasuredPagePublication, progress: ReadingExitProgressCoordinator,
  chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap, restored: LocalReadingProgressState | undefined,
  offset?: number, position?: number): void {
  progress.clearCommitted();
  measured.chapterLayoutMap = map;
  measured.materializedContentVersion = chapter.contentVersion;
  const target = resolveReadingChapterOpeningAnchor(chapter, map, restored, offset, position);
  measured.desiredChapterOffset = target.offset;
  measured.desiredChapterProgress = target.progress;
}
