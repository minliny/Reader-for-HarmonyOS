import { ReaderReadingRouteSelectionHost } from './ReaderReadingRouteSelectionHost';
import { ReaderReadingDocumentIndexHost, type ReaderReadingDocumentIndexView, type ReaderReadingDocumentIdentity } from './ReaderReadingDocumentIndexHost';
import { ReaderMountedReadingScene, type ReaderMountedReadingSceneActors, type ReaderMountedReadingSceneView, ReaderReadingInputDevices,
  type ReaderReadingInputDeviceActors, type ReaderReadingInputDeviceView, ReaderReadingViewportHost, type ReaderReadingViewportView,
  type ReaderReadingViewportEffects, type ReaderReadingViewportScope, ReaderReadingSurfaceHost, type ReaderContinuousSurfaceView,
  type ReaderContinuousSurfaceEffects, type ReaderReadingStageActors, ReadingChromeRenderSnapshot, type ReadingChromeRenderUpdate,
  ReadingPageTurnRenderSnapshot, type ReadingPageTurnRenderUpdate, ReadingOverlayRenderSnapshot, type ReadingOverlayRenderUpdate,
  ReadingSessionRenderSnapshot, type ReadingSessionRenderUpdate } from './ReaderReadingSurfaceHost';
import { ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import { readerNativeReadingRecovery, type ReaderNativeRecoveryView, type ReaderNativeRecoveryActors, ReaderReadingRecoveryHost,
  type ReaderReadingRecoveryScope, type ReaderReadingDirectoryRecovery, type ReaderReadingSourceRecovery } from './ReaderReadingRecoveryHost';
import { ReaderReadingPlaybackFlowHost, type ReaderPlaybackScene, type ReaderPlaybackPage, type ReaderPlaybackCapsule,
  type ReaderPlaybackPrefetch, type ReaderPlaybackLifecycleEffects } from './ReaderReadingPlaybackFlowHost';
import { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import { readerMountedEntryPresentation, readerMountedEntryCatalog, admitReaderRestoredAnchor, type ReaderMountedEntryScene,
  type ReaderReadingNativeMountActors, type ReaderReadingNativeMountView, ReaderReadingMountHost, type ReaderReadingMountRoute,
  type ReaderReadingMountRoutes } from './ReaderReadingMountHost';
import { ReaderReadingImageResidencyHost, type ReaderReadingImageResidencyOwners, type ReaderReadingImageResidencyView,
  type ReaderReadingImageScope } from './ReaderReadingImageResidencyHost';
import type { ReaderAuxiliaryCapsulePorts, ReaderAuxiliaryCapsulePresentation, ReaderAuxiliaryCapsuleFreeze, ReaderAuxiliaryCapsuleControl,
  ReaderAuxiliaryCapsuleControlRevisions, ReaderAuxiliaryCapsuleChrome, ReaderAuxiliaryCapsuleChromeAnchor, ReaderAuxiliaryCapsuleLayout,
  ReaderAuxiliaryCapsuleLayoutIdentity, ReaderAuxiliaryCapsuleActivity, ReaderAuxiliaryCapsuleRoute } from './ReaderAuxiliarySessionHost';
import { ReaderReadingChapterPresentationHost, type ReaderReadingChapterPresentationScope, type ReaderReadingChapterPresentationLifetime,
  type ReaderReadingChapterPresentationView, type ReaderReadingChapterPresentationSpeech,
  type ReaderReadingChapterPresentationReady } from './ReaderReadingChapterPresentationHost';
import { ReaderReadingPageChromeHost, type ReaderContinuousChromeCatalogWitness, type ReaderPageChromeDocument, type ReaderPageChromeView,
  type ReaderPageChromeEffects, type ReaderRetainedChapterFrame } from './ReaderReadingPageChromeHost';
import { ReaderReadingProgressHost, type ReaderReadingProgressOwners, type ReaderReadingProgressView, type ReaderReadingExitEffects,
  type ReaderReadingBackControls } from './ReaderReadingProgressHost';
import { type ReaderControlPlaybackSourceMinimum, ReaderControlGeometryHost, type ReaderControlGeometryScene,
  type ReaderControlGeometryPublication, type ReaderControlGeometryEffects } from './ReaderControlGeometryHost';
import { ReaderReadingMeasurementAdmissionHost, type ReaderMeasuredPageAdmissionNative, type ReaderMeasuredPageAdmissionView,
  type ReaderMeasuredPageAdmissionFlow, type ReaderMeasuredPageAdmissionFacts, type ReaderMeasuredPageVisibility,
  type ReaderMeasuredFirstPage } from './ReaderReadingMeasurementAdmissionHost';
import { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import { ReaderControlDirectoryOperationsHost, type ReaderControlDirectoryDataPort, type ReaderControlDirectoryScopePort,
  type ReaderControlDirectoryBookmarkPort, type ReaderControlDirectoryActionsPort, type ReaderControlDirectoryDisplayPort } from './ReaderControlDirectoryOperationsHost';
import { ReaderReadingContentMutationHost, type ReaderReadingContentScope, type ReaderReadingContentLifetime, type ReaderReadingConversionView,
  type ReaderReadingContentPosition, type ReaderReadingContentProjection } from './ReaderReadingContentMutationHost';
import { ReaderPageTurnSettlementHost, type ReaderPageTurnDeferredEffects } from './ReaderPageTurnSettlementHost';
import type { ReaderDeferredControlMinimum } from './ReaderControlMinimumState';
import { ReaderReadingChapterAcquisitionHost, type ReaderChapterAcquisitionScope, type ReaderChapterAcquisitionSession, type ReaderChapterAcquisitionEntry,
  type ReaderAcquiredChapter, type ReaderChapterMaterializedSample, type ReaderChapterAcquisitionPresentation, type ReaderChapterAcquisitionPages,
  type ReaderChapterAcquisitionRecovery, type ReaderChapterSelectionRetirement, type ReaderChapterRangeAcquisition } from './ReaderReadingChapterAcquisitionHost';
import { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import { ReaderReadingSpeechHost, type ReaderReadingSpeechSession, type ReaderReadingSpeechView,
  type ReaderReadingSpeechProgress, type ReaderReadingSpeechChapter, type ReaderReadingSpeechAdvanceSelection,
  type ReaderReadingSpeechControls, type ReaderReadingSpeechPresentation } from './ReaderReadingSpeechHost';
import {
  ReaderBookmarkInteractionHost, type ReaderBookmarkChrome, type ReaderBookmarkGestureFinish,
  type ReaderBookmarkInteractionPorts, type ReaderBookmarkPointer,
  type ReaderBookmarkProjectionUpdate, type ReaderBookmarkRenderProjection,
  type ReaderBookmarkScope, type ReaderBookmarkViewport,
} from './ReaderBookmarkInteractionHost';
import { ReaderReadingPreferencesHost, type ReaderReadingPreferenceScope, type ReaderReadingPreferencesLifetime,
  type ReaderReadingPreferencesPage, type ReaderReadingPreferencesView, type ReaderReadingPreferencesWindow } from './ReaderReadingPreferencesHost';
import { type ReaderReversePagePorts, ReaderMeasuredPagePublication, type ReaderFirstPageSurfacePublication, type ReaderMeasureView,
  type ReaderMeasureImages, type ReaderMeasureEffects } from './ReaderMeasuredPagePublication';
import { publishReadingPresentationPhase, type ReadingPhase } from '../application/ReadingExperienceRenderSnapshots';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderTextSelectionActivity } from '../application/ReaderKeyboardShortcuts';
import { DEFAULT_READER_SMART_GESTURES, type ReaderSmartGestureSettings } from '../application/ReaderSmartGesturePolicy';
import { CoreReadingAnchor, type CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import {
  ReaderMaterializedChapterContext, ReaderRetainedPresentation, ReaderControlSelectionDisplay,
  PreparedReaderPageTurn,
} from '../presentation/ReaderPagePresentationModels';
import type { ReaderExitRequest } from '../presentation/ReadingEntryPresentation';
import { ReadingCommit } from '../application/ReadingCommit';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderProgressProducerHost, type ReaderProgressProducerIntent } from '../application/ReaderProgressProducerHost';
import { ReadingExitProgressCoordinator, type ReadingProgressIdentity } from '../application/ReadingExitProgressCoordinator';
import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';
import { type ReaderSourceSwitchReadingScene, ReadingSourceSwitchOverlayHost } from './ReadingSourceSwitchOverlayHost';
import { ReadingAuxiliaryFlowBridge, type ReadingCapsuleMeasurement } from '../application/ReadingAuxiliaryFlowBridge';
import { ReadingInteractiveChapterPreparation } from '../application/ReadingInteractiveChapterPreparation';
import { MeasurementParagraph, PhysicalReadingPage } from './ReadingMeasurementModels';
import { exportReaderQuoteCard } from './ReaderQuoteCardExporter';
import { readerSystemShareActions } from './ReaderSharePresentation';
import type { ReaderQuoteCardAction, ReaderQuoteCardCopy } from '../application/ReaderShareActions';
import { type ReadingWindowLayoutInput } from '../application/ReadingMeasurementCoordinator';
import { type ReadingEntryNavigation } from '../application/ReadingEntrySnapshot';
import { type ReaderTtsFollowScope, type ReaderTtsFollowLease, type ReaderTtsFollowTarget } from './ReaderTtsPageFollow';
import { createRequestedRemoteReadingPositionContext,
  type RemoteReadingPositionContext, type RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { ReaderAutoPageStatus, ReaderAutoPagePauseReason, ReaderAutoPageState } from './ReaderAutoPageState';
import { ReaderAuxiliarySessionHost, type ReaderAuxiliarySessionView, type ReaderAuxiliarySessionControlSurface,
  type ReaderAuxiliarySessionEnvironment } from './ReaderAuxiliarySessionHost';
import { ReaderControlCapsuleVerification, type ReaderControlCapsuleSpeechFacts } from './ReaderControlCapsuleVerification';
import { type ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { ReaderPageGeometryHost } from './ReaderPageGeometryHost';
import { settings } from '@kit.BasicServicesKit';
import { ReaderBrightnessSession } from './ReaderBrightnessSession';
import { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import { type LocalReadingDownloadState, type LocalReadingAnchor, type LocalReadingContentMetrics, type LocalReadingLayout,
  type LocalReadingProgress, type LocalReadingProgressState, type LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReadingSessionFlowGateway, type ReadingSessionCommittedProgress } from '../application/ReadingSessionFlowGateway';
import { type RemoteReadingSession, type RemoteReadingBookSeed } from '../application/RemoteReadingFlowGateway';
import type { ReadingEntrySnapshot } from '../application/ReadingEntryPreparation';
import { type RemoteReadingFailureKind } from '../application/RemoteContentAdmission';
import { type ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import { ReadingSurfacePageFragment } from './ReadingSurface';
import {
  completeReaderPageGestureSettlement, createReaderPageGestureState,
  type ReaderPageGestureDecision, type ReaderPageTurnDirection,
} from './ReaderPageGestureState';
import { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReaderControlPage } from './ReaderControlPanel';
import {
  ReaderControlDirectorySession, type ReaderNativeControlFrameRoute,
  type ReaderNativeControlFrameInput, readerNativeControlIntent,
  type ReaderNativeControlActors, type ReaderNativeControlActions,
  type ReaderControlDirectoryLifecycle,
} from './ReaderControlDirectoryHost';
import type { ReaderControlIntentHandler, ReaderControlLaunchSource } from './ReaderControlPanelNativeContract';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import {
  ReaderControlNavigation, type ReaderControlFontOrderFacts, type ReaderControlNavigationIntent,
  type ReaderControlNavigationScope,
} from './ReaderControlPresentationCoordinator';
import { type ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import { type ReaderControlTemporaryInputKind, readerControlContentLocation, type ReaderControlSessionState,
  type ReaderControlLocation } from './ReaderControlSessionState';
import { readerControlHostVisible, type ReaderControlHostTiming } from './ReaderControlHostSession';
import { type ReaderControlSelectionStoredProgress, type ReaderControlSelectionTicket } from '../application/ReaderControlSelectionTransaction';
import { ReaderDeferredChapterSelection, type ReaderChapterSelectionScope } from '../presentation/ReaderChapterSelectionOwner';
import {
  readerTtsSessionBlocksAutoPageStart, type ReaderSessionCapsuleSnapshot,
  type ReaderSessionCapsuleType,
} from './ReaderSessionCapsuleModel';
import { ReaderPageChromeSnapshot } from '../presentation/ReaderPageChromeModel';
import { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import { type ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from '../presentation/ReaderDirectoryMarkerState';
import { RulesMutationOwner } from '../../settings/application/RulesMutationOwner';
import { ReaderControlReplaceGateway, ReaderControlReplaceGatewayError } from '../application/ReaderControlReplaceGateway';
import { type ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import { ReaderControlReplacePanel, type ReaderControlReplaceSession } from '../presentation/ReaderControlReplacePanel';
import { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { type ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import {
  ReadingChapterWindow, hasKnownReadingImageGeometry, type ReadingSessionChapter,
  type ReadingSessionImage,
} from '../application/ReadingChapterWindow';
import { readingParagraphBoundaryMode, type ReadingParagraphBoundaryMode } from '../application/ReadingParagraphProjection';
import { lastVisibleReadingScalar } from '../application/ReadingChapterOpening';
import { window } from '@kit.ArkUI';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReadingPrefetchActivity } from '../application/ReadingPrefetchHost';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  type ReaderControlPlaybackPresentation, type ReaderTtsPauseWitness,
  type ReaderTtsPlaybackScope, type ReaderTtsStartPage,
} from '../application/ReaderTtsPlaybackOwner';
import type { ReaderTtsCapsuleTiming } from '../../../app/ReaderStartupTrace';
import { type ReaderTtsState } from '../application/ReaderTtsState';
import { type ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import {
  type ReaderAppearanceFontSlot, type ReaderAppearanceSnapshot, type ReaderAppearanceTheme,
} from '../application/ReaderAppearanceState';
import { ReaderControlLayoutSnapshot, ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReadingRecordGateway } from '../application/ReadingRecordGateway';
import { type ReaderNavigationMode, type ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
export { ReaderRetainedPresentation } from '../presentation/ReaderPagePresentationModels';
export { readerEntryPresentation } from '../presentation/ReaderRetainedPresentationHost';

/**
 * Chapter-level paragraph boundaries.  These remain deliberately tiny: a
 * long EPUB is indexed once, but no paragraph text, local map, or ArkUI
 * controller is retained until its current first-page batch is measured.
 */
interface ReaderMeasuredFirstPagePresentation {
  readonly page: PhysicalReadingPage;
  readonly chapter: ReadingSessionChapter;
  readonly progress: number;
  readonly selectionToken: number;
  readonly lifecycleToken: number;
}

type ReaderPageTurnInputPhase = 'idle' | 'tracking' | 'dragging' | 'settling';
/** Unified visual presentation phase shared by gesture, settle and promotion. */
export type ReaderPagePresentationPhase =
  | 'idle'
  | 'tracking'
  | 'settling'
  | 'logicalPromoted'
  | 'arkuiPresented'
  | 'surfaceHidden'
  | 'released'
  | 'rollback';
/**
 * Outcome of one preparation attempt: begun (measuring the target),
 * retry (transiently busy, re-drain with backoff), abandon (target does not
 * exist and no discovery lane exists for it).
 */
type ReaderPageTurnPreparationOutcome = 'begun' | 'retry' | 'abandon';

interface ReaderControlSpeechAvailability {
  resolved: boolean;
  engine: string;
  status: string;
}

interface ReaderControlCapsulePauseFacts {
  generation: number;
  type: string;
  status: string;
  kind: string;
  reason: ReaderAutoPagePauseReason;
  desiredPlaying: boolean;
}

const LOCAL_READING_SOURCE_ID = 'local';
const READER_BOOK_TURN_COMPONENT_ID = 'reader-book-turn-surface';
/** Contract ceiling for one prepared page texture before RGB8 upload. */
/** Stable empty input for the mounted-but-hidden Reader Control shell. */
const EMPTY_CONTROL_DIRECTORY_ENTRIES: LocalReadingTocEntry[] = [];
/** Engineering ceiling only; it has no visual meaning or design authority. */
// Keep one lazy row close to one phone viewport. This bounds the error of the
// scalar-to-height interpolation used to restore an intra-row reading anchor.
/**
 * The hidden-layout deadline stops at the first Core persistence boundary.
 * Keep a separate, non-visual upper bound for an initial page that still has
 * no visible body while its chapter read, location resolution, or first
 * progress write is pending. A timeout is recoverable within the reader.
 */
/**
 * consumeMeasuredBatch cancels the layout deadline before completeFirstPage
 * resolves the location anchor (an online-source RPC that can suspend
 * indefinitely). Without a watchdog a suspended anchor leaves
 * measurementCompleting stuck true, canTurnPage false forever, and every
 * tap/drag silently dropped. Normal completion is well under 1s.
 */
/** Persist real foreground reading time in bounded atomic deltas. */
/** One visible search page; Core returns an explicit hasMore bit for the rest. */
const READER_CONTENT_SEARCH_PAGE_SIZE = 50;

/**
 * Shared immersive reading implementation for local and remote sessions.
 *
 * Source-specific Core commands end at ReadingSessionFlowGateway. From the
 * materialized chapter onward, both sources use this one physical pagination,
 * progress, TTS, directory, and page-turn state machine.
 *
 * Figma source:
 * - `15 · Reader 2` Phone ReadingSurface `1023:18355` (390 × 844)
 * - `15 · Reader 2` TabletExpanded `1023:18371` (760 × 960)
 */
@Component
export struct ReadingExperience {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') @Watch('reconcileSessionLaunchLayout') private readerAppScheme: string = 'day';
  @StorageLink('readerSystemScheme') private readerSystemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private launchNavigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerAppearanceRevision') @Watch('onSharedAppearanceChanged') private sharedAppearanceRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('onAppForegroundChanged') appForeground: boolean = true;
  @StorageLink('readerSmartGestureSettings') @Watch('syncSmartGestureMonitor')
  private smartGestureSettings: ReaderSmartGestureSettings = DEFAULT_READER_SMART_GESTURES;
  @StorageLink('readerWindowMetricsRevision') @Watch('onWindowMetricsRevisionChanged')
  readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onReaderIdentityChanged') sourceId: string = LOCAL_READING_SOURCE_ID;
  @Prop @Watch('onReaderIdentityChanged') bookId: string;
  @Prop bookKind: string | undefined = undefined;
  @Prop @Watch('onRemoteCatalogChanged') remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  isReaderIdentityCurrent: () => boolean = (): boolean => true;
  inputCurrent: (() => boolean) | undefined = undefined;
  @Prop sourceSwitchFailureMessage: string = '';
  onRemoteSessionReady: (session: RemoteReadingSession) => void = (_session: RemoteReadingSession): void => {};
  onRetryFailedSourceSwitch: (scopeId?: number) => void = (): void => {};
  onDismissSourceSwitchFailure: (scopeId?: number) => void = (): void => {};
  onRollbackReaderTarget: (transactionId: string, scopeId: number) => void =
    (_transactionId: string, _scopeId: number): void => {};
  @Prop sourceSwitchScopeId: number = 0;
  resolveSourceSwitchTransactionId: (sourceId: string, bookId: string) => Promise<string | undefined> =
    async (_sourceId: string, _bookId: string): Promise<string | undefined> => undefined;
  @Prop sourceSwitchTransactionId: string | undefined = undefined;
  @Prop sourceSwitchRollbackInFlight: boolean = false;
  @Prop @Watch('sourceSwitchCompletionChanged') sourceSwitchCompletion: SourceSwitchCompletionPresentation | undefined = undefined;
  @Prop @Watch('sourceSwitchCompletionChanged') readingReadyGeneration: number = 0;
  @Prop @Watch('sourceSwitchCompletionVisibleChanged') sourceSwitchCompletionVisible: boolean = false;
  @Prop sourceSwitchPresentationVisible: boolean = false;
  @Prop @Watch('onRequestedChapterChanged') requestedChapterIndex: number | undefined = undefined;
  // Full Directory bookmark row: host-originated precise (chapter, offset)
  // anchor; mirrors the selectSearchResult exact-scalar jump. The requestId
  // bump makes repeated same-bookmark clicks re-fire the seek.
  @Prop @Watch('onRequestedBookmarkAnchorChanged') requestedBookmarkAnchor:
    ReaderBookmarkAnchorRequest | undefined = undefined;
  // Static per-session book identity for stable bookmark ids.
  @Prop bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  @Prop @Watch('onExpandedLayoutChanged') expandedLayout: boolean;
  @Prop paneWidthHint: number = 0;
  @Prop paneHeightHint: number = 0;
  @Prop @Watch('onWindowChromeActiveChanged') windowChromeActive: boolean = false;
  @Prop @Watch('onWindowChromeActiveChanged') windowChromeOverlayActive: boolean = false;
  @Prop @Watch('onSessionLaunchReduceMotionChanged') reduceMotion: boolean = false;
  /**
   * The host owns the system Back event. It receives this guarded request
   * function and must invoke it instead of changing the route directly.
   * Explicit navigation bypasses control-layer Back, but shares the same
   * serialized page/record persistence before returning route ownership.
   * `onExit` below is then called only after the current anchor commit has
   * settled (or there was no materialized page to commit).
   */
  onExitRequestHandler: (requestExit: ReaderExitRequest) => (() => void) | undefined = () => undefined;
  onExit: () => void = (): void => {};
  onExitCancelled: () => void = (): void => {};
  /**
   * Reports a first real page only after measurement, Core persistence and
   * page/slot publication. The route itself is available immediately; this
   * signal updates its committed chapter and releases optional projections.
  */
  onReadingReady: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onReadingCommitted: (commit: ReadingCommit) => void = (_commit: ReadingCommit): void => {};
  onReadingPrefetchActivity?: (activity: ReadingPrefetchActivity) => void;
  onReadingFailure: (sourceId: string, bookId: string, message: string,
    failureKind?: RemoteReadingFailureKind) => void =
    (_sourceId: string, _bookId: string, _message: string,
      _failureKind?: RemoteReadingFailureKind): void => {};
  /**
   * Reports a chapter only after its first physical page has been measured and
   * its Unicode-scalar anchor has been accepted by Core.  Full Directory may
   * use this as its selected-row state; it must never treat a merely loaded
   * chapter as safe to reveal on the ReadingSurface.
   */
  onChapterCommitted: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};
  onOpenBookInfo: () => void = (): void => {};
  onSwitchSource: (focusId?: string) => void = (): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadBook: () => void = (): void => {};
  @Prop @Watch('onPrefetchDownloadActivityChanged') offlineBookOperationActive: boolean = false;
  onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]) => void =
    (_entries: LocalReadingTocEntry[]): void => {};
  onLoadControlBookmarks: (sourceId: string, bookId: string, isCurrent: () => boolean) => Promise<void> =
    (_sourceId: string, _bookId: string, _isCurrent: () => boolean): Promise<void> =>
      Promise.reject(new Error('Bookmark projection loader unavailable'));
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest) => void =
    (_request: ReaderPageBookmarkToggleRequest): void => {};

  @State private chromeState: ReadingChromeRenderSnapshot = new ReadingChromeRenderSnapshot();
  @State private pageTurnProjection: ReadingPageTurnRenderSnapshot = new ReadingPageTurnRenderSnapshot();
  @State private overlayState: ReadingOverlayRenderSnapshot = new ReadingOverlayRenderSnapshot();
  @State private sessionStatus: ReadingSessionRenderSnapshot = new ReadingSessionRenderSnapshot();

  private publishChromeState(update: ReadingChromeRenderUpdate): void {
    this.chromeState = new ReadingChromeRenderSnapshot(this.chromeState, update);
  }

  private publishPageTurnProjection(update: ReadingPageTurnRenderUpdate): void {
    this.pageTurnProjection = new ReadingPageTurnRenderSnapshot(this.pageTurnProjection, update);
  }

  private publishOverlayState(update: ReadingOverlayRenderUpdate): void {
    this.overlayState = new ReadingOverlayRenderSnapshot(this.overlayState, update);
  }

  private publishSessionStatus(update: ReadingSessionRenderUpdate): void {
    this.sessionStatus = new ReadingSessionRenderSnapshot(this.sessionStatus, update);
  }

  private publishPresentationPhase(phase: ReadingPhase): void {
    publishReadingPresentationPhase(this.sessionStatus.phase, phase,
      (next: ReadingPhase): void => this.publishSessionStatus({ phase: next }),
      (): void => this.sourceSwitchCompletionChanged());
  }

  private readonly sourceSwitchScene: ReaderSourceSwitchReadingScene = {
    sourceId: (): string => this.sourceId,
    bookId: (): string => this.bookId,
    readyGeneration: (): number => this.readingReadyGeneration,
    candidate: (): ReaderMeasuredPagePublication => this.measuredPage,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    phase: (): ReadingPhase => this.sessionStatus.phase,
    exiting: (): boolean => this.sessionStatus.exitRequested,
    foreground: (): boolean => this.appForeground,
    showCompletion: (): boolean => this.sourceSwitchCompletionVisible,
    failureMessage: (): string => this.sourceSwitchFailureMessage,
    sessionCurrent: (): boolean => this.isReaderIdentityCurrent(),
    awaitingSourceSwitch: (): boolean => this.mountHost.gateway === undefined ?
      this.sourceSwitchTransactionId !== undefined : this.mountHost.gateway.hasPendingSourceSwitch(),
    visualSelection: (): number => this.overlayState.sourceSwitchVisualSelectionToken,
    onContinuousRange: (start: number, end: number, progress: number): void => this.surface.onContinuousVisibleRangeChanged(start, end, progress),
    verifyControl: (): void => this.controlInteraction.publishControlVerificationReady(),
  };

  private readonly sourceSwitchOverlay: ReadingSourceSwitchOverlayHost = new ReadingSourceSwitchOverlayHost({
    completion: (): SourceSwitchCompletionPresentation | undefined => this.sourceSwitchCompletion,
    lifecycle: (): number => this.mountHost.lifecycleToken,
    selection: (): number => this.chapterSelectionToken,
    mounted: (): boolean => this.sessionStatus.mounted,
    revision: (continuous: boolean): number => continuous ? this.pageTurnProjection.continuousRenderRevision : this.pageTurnProjection.pageTurnRenderRevision,
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous' && this.surface.hasContinuousRenderContent(),
    reducedMotion: (): boolean => this.reduceMotion,
    uiContext: (): UIContext => this.getUIContext(),
    publishOpacity: (opacity: number): void => { this.publishOverlayState({ sourceSwitchRevealOpacity: opacity }); },
    publishSelection: (selection: number): void => { this.publishOverlayState({ sourceSwitchVisualSelectionToken: selection }); },
    visible: (): boolean => this.overlayState.sourceSwitchRevealOpacity > 0,
  }, this.sourceSwitchScene);
  @Prop bookTitle: string = '';
  @Prop bookAuthor: string = '';
  @Prop sourceName: string = '';
  @Prop totalChapters: number = 0;
  @Prop @Watch('onControlDirectoryDataChanged') directoryEntries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onControlBookmarkFailureChanged') bookmarkLoadMessage: string = '';
  @Prop bookmarkRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, presentationId: string) => void = (): void => {};
  onReconcileOffline: (generation: number, presentationId: string) => void = (): void => {};
  onContinueOffline: (generation: number, presentationId: string) => void = (): void => {};
  // External overlays may temporarily obscure the reader. In-reader Full
  // Directory is now the same control session, not an external overlay route.
  @Prop @Watch('onControlObscuredChanged') controlObscured: boolean = false;
  /** Directory/source-switch/hidden routes explicitly transfer pointer ownership away from the reader. */
  @Prop @Watch('onControlInputBoundaryChanged') interactionBlocked: boolean = false;
  private readonly controlVerification: ReaderControlVerificationSession = new ReaderControlVerificationSession();
  private readonly auxiliaryFlows: ReadingAuxiliaryFlowBridge = new ReadingAuxiliaryFlowBridge();
  private readonly playbackScene: ReaderPlaybackScene = {
    scope: (): ReaderTtsFollowScope => ({ sourceId: this.sourceId, bookId: this.bookId, lifecycleToken: this.mountHost.lifecycleToken }),
    session: (): ReadingSessionRenderSnapshot => this.sessionStatus,
    foreground: (): boolean => this.appForeground,
    sessionActive: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    inputCurrent: (): boolean => this.controlInteraction.readerInputIsCurrent(),
    windowActive: (): boolean => this.windowChromeActive,
    windowOverlay: (): boolean => this.windowChromeOverlayActive,
    controlsBlockTurn: (): boolean => this.controlInteraction.controlVisible() || this.controlObscured || this.interactionBlocked,
    interactionBlocked: (): boolean => this.interactionBlocked,
    controlsObscured: (): boolean => this.controlObscured,
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    context: (): UIContext => this.getUIContext(),
    advanceAutomaticRevision: (): void => this.publishSessionStatus({ autoPageRevision: this.sessionStatus.autoPageRevision + 1 }),
    speech: (): ReaderReadingSpeechHost => this.speech,
  };
  private readonly playbackPage: ReaderPlaybackPage = {
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    runtime: (): ReaderPageTurnRuntimeHost => this.turnRuntime,
    measured: (): ReaderMeasuredPagePublication => this.measuredPage,
    surface: (): ReaderReadingSurfaceHost => this.surface,
    progressInFlight: (): boolean => this.exitProgress.writeActive || this.progressProducers.continuousInFlight,
    currentPaginationKey: (): ReadingPaginationKey => this.documentIndex.currentPaginationKey(),
    containsChapter: (index: number): boolean => this.documentIndex.isKnownControlChapter(index),
    retireUncommittedSpeechChapter: (): void => this.chapterPresentation.cancelUncommittedTtsChapter(),
    selectSpeechTarget: (target: ReaderTtsFollowTarget): void =>
      this.directoryOps.selectAnchor(target.chapterIndex, target.scalar, false, false, undefined, -1, false, false, undefined, target),
  };
  private readonly playbackCapsule: ReaderPlaybackCapsule = {
    host: (): ReaderAuxiliarySessionHost => this.auxiliarySession,
    launch: (): ReaderSessionLaunchTransaction | undefined => this.overlayState.sessionLaunch,
    verification: (): ReaderControlVerificationSession => this.controlVerification,
    hideControlForAutomaticCapsule: (): void => this.hideControlForStaticSessionCapsule('autoPage'),
  };
  private readonly playbackPrefetch: ReaderPlaybackPrefetch = {
    listening: (): boolean => this.onReadingPrefetchActivity !== undefined,
    identityCurrent: (): boolean => this.isReaderIdentityCurrent() !== false,
    screenLocked: (): boolean => this.readingPrefetchScreenLocked,
    committed: (): ReadingCommit | undefined => this.exitProgress.committed,
    publish: (activity: ReadingPrefetchActivity): void => this.onReadingPrefetchActivity?.(activity),
  };
  private readonly playbackLifetime: ReaderPlaybackLifecycleEffects = {
    syncSmartGesture: (): void => this.inputDevices.sync(),
    applyWindowPolicy: (): void => this.preferences.applyWindowPolicyForChromeOwner(),
    retireSourceSwitchOverlay: (): void => this.sourceSwitchOverlay.retire(),
    controlInputBoundaryChanged: (): void => this.onControlInputBoundaryChanged(),
    retireBookmarkForBackground: (): void => this.readerBookmark.background(),
    screenAwakeForeground: (foreground: boolean): void => this.preferences.setScreenAwakeForeground(foreground),
    retireDurationForBackground: (): void => {
      this.captureReadingRecordElapsed(false);
      this.clearReadingRecordTimer();
      void this.flushReadingRecord().catch((error: Error): void => {
        try { hilog.error(0x5244, 'Reader', '%{private}s', `Reading duration: ${this.errorMessage(error)}`); }
        catch (_) {}
      });
    },
    admitRetainedRecency: (): void => this.mountHost.admitRetainedReadingRecency(),
    beginDuration: (lifecycle: number): void => this.beginReadingRecordClock(lifecycle),
    retireRecovery: (): void => this.recovery.retire(),
    rearmScreenAwake: (): void => this.preferences.rearmScreenAwake(),
  };
  private readonly playback: ReaderReadingPlaybackFlowHost = new ReaderReadingPlaybackFlowHost(this.transientFeedback, this.auxiliaryFlows,
    this.playbackScene, this.playbackPage, this.playbackCapsule, this.playbackPrefetch, this.playbackLifetime);

  private readonly capsuleVerification: ReaderControlCapsuleVerification = new ReaderControlCapsuleVerification(this.controlVerification);
  private readonly quickSearchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  // One presentation transaction and immutable sample own every launch actor.
  private readonly auxiliarySessionView: ReaderAuxiliarySessionView = {
    read: (): ReaderSessionLaunchTransaction | undefined => this.overlayState.sessionLaunch,
    publish: (launch: ReaderSessionLaunchTransaction | undefined): void => {
      this.publishOverlayState(launch === undefined ? { sessionLaunch: { value: undefined },
        sessionLaunchControlSource: { value: undefined } } : { sessionLaunch: { value: launch } });
    },
    publishControlSource: (source: ReaderControlLaunchSource): void =>
      this.publishOverlayState({ sessionLaunchControlSource: { value: source } }),
    stageOpacity: (): number => this.overlayState.sessionLaunchStageOpacity,
    setStageOpacity: (opacity: number): void => { this.publishOverlayState({ sessionLaunchStageOpacity: opacity }); },
    beginFooterExit: (launch: ReaderSessionLaunchTransaction): void => {
      this.publishOverlayState({ sessionLaunchFooterExiting: true });
      this.publishOverlayState({ sessionLaunchFooterOffset: launch.sample.footerTranslateX });
      this.publishOverlayState({ sessionLaunchFooterOpacity: launch.sample.footerOpacity });
      this.publishOverlayState({ sessionLaunchFooterExitProgress: 0 });
    },
    finalizeFooterExit: (): void => {
      if (!this.overlayState.sessionLaunchFooterExiting) return;
      this.publishOverlayState({ sessionLaunchFooterOffset: 0 });
      this.publishOverlayState({ sessionLaunchFooterExitProgress: 1 });
      this.publishOverlayState({ sessionLaunchFooterOpacity: 1 });
    },
    clearFooterExit: (): void => {
      this.publishOverlayState({ sessionLaunchFooterExiting: false });
      this.publishOverlayState({ sessionLaunchFooterExitProgress: 0 });
    },
    renderChanged: (): void => { this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }); },
  };
  private readonly auxiliarySessionControl: ReaderAuxiliarySessionControlSurface = {
    layoutKey: (): string => this.auxiliarySession.sessionLaunchLayoutKey(),
    hide: (): void => this.controlInteraction.commitSessionLaunchControlHidden(),
    restore: (duration: number): void => this.auxiliarySession.restoreCapsuleControl(duration),
  };
  private readonly auxiliarySessionEnvironment: ReaderAuxiliarySessionEnvironment = {
    ready: (): boolean => this.sessionStatus.mounted && this.appForeground && !this.sessionStatus.exitRequested,
    mounted: (): boolean => this.sessionStatus.mounted,
    exiting: (): boolean => this.sessionStatus.exitRequested,
    uiContext: (): UIContext => this.getUIContext(),
    viewportRevision: (): number => this.readerWindowMetricsRevision,
    reducedMotion: (): boolean => this.reduceMotion,
    observing: (): boolean => this.controlVerification.observing(),
    drainPageTurn: (): void => this.turnRuntime.preparation.drain(),
    updateWindow: (): void => this.preferences.applyWindowPolicyForChromeOwner(),
    speechFacts: (launch: ReaderSessionLaunchTransaction): ReaderControlCapsuleSpeechFacts | undefined =>
      this.sessionLaunchSpeechFacts(launch),
    automaticStatus: (): ReaderAutoPageStatus => this.playback.automaticState().status,
    retireBusinessStart: (type: ReaderSessionCapsuleType): void => {
      if (type === 'tts') this.speech.cancelPending();
      else this.playback.auto.cancelStart();
    },
  };
  private readonly capsulePresentation: ReaderAuxiliaryCapsulePresentation = {
    phase: (): ReadingPhase => this.sessionStatus.phase,
    hasPaintedBody: (): boolean => this.measuredPage.page !== undefined && this.pageTurnProjection.visibleFragments.length > 0,
    obscured: (): boolean => this.controlObscured,
    blocked: (): boolean => this.interactionBlocked,
    active: (): boolean => this.mountHost.isSessionActive(this.mountHost.lifecycleToken),
    freeze: (): ReaderAuxiliaryCapsuleFreeze => {
      const frozen = this.pageTurnProjection.pageTurnSessionCapsuleFrozen;
      return { frozen, snapshot: frozen ? this.turnRuntime.input.capsule : undefined };
    },
    pageChromeFrozen: (): boolean => this.pageChrome.frozen(),
    measurement: (): ReadingCapsuleMeasurement | undefined => this.chromeState.sessionCapsuleMeasurement,
    publishMeasurement: (receipt: ReadingCapsuleMeasurement): void =>
      this.publishChromeState({ sessionCapsuleMeasurement: { value: receipt } }),
  };
  private readonly capsuleControl: ReaderAuxiliaryCapsuleControl = {
    visible: (): boolean => this.controlInteraction.controlVisible(),
    closingForCapsule: (): boolean => this.chromeState.sessionControlClosing,
    shellExitArmed: (): boolean => this.controlInteraction.controlShellExitArmed(),
    currentPage: (): ReaderControlPage => this.controlInteraction.controlPage(),
    layout: (revision: number): ReaderControlLayoutSnapshot => this.controlGeometry.layout(revision),
    revisions: (): ReaderAuxiliaryCapsuleControlRevisions => ({
      open: this.chromeState.controlOpenRevision, moduleVisit: this.controlDirectory.visitRevision(),
    }),
    playbackMinimum: (kind: 'tts' | 'autoPage', revision: number): ReaderControlPlaybackSourceMinimum =>
      this.controlGeometry.playbackSourceMinimum(kind, revision),
    visualSession: (): ReaderControlSessionState => this.controlDirectory.visualSession(),
    cancelNavigation: (): void => { this.controlInteraction.cancelControlNavigationIntent(); },
    invalidateBackdrop: (): void => this.controlGeometry.invalidateBackdrop(),
    publishRestoredSession: (session: ReaderControlSessionState): void => {
      this.controlDirectory.request(session);
      this.controlDirectory.copyVisual(session);
    },
  };
  private readonly capsuleChrome: ReaderAuxiliaryCapsuleChrome = {
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    continuousProgressText: (): string => this.chromeState.continuousChromeProgressText,
    continuousChrome: (text: string): ReaderPageChromeSnapshot =>
      this.surface.continuousPageChromeSnapshot(this.pageTurnProjection.continuousRenderRevision, text),
    currentTurnPage: (): ReaderPageTurnRenderPage => this.pageChrome.currentPage(),
    presentedAnchor: (): ReaderAuxiliaryCapsuleChromeAnchor => ({
      chapterIndex: this.currentChapterIndex(), pageStart: this.measuredPage.page?.startScalar,
      clockText: this.chromeState.pageChromeClockText, renderRevision: this.pageTurnProjection.pageTurnRenderRevision,
    }),
    presentedPageChrome: (): ReaderPageChromeSnapshot => this.pageChrome.currentBodyChrome(),
  };
  private readonly capsuleLayout: ReaderAuxiliaryCapsuleLayout = {
    route: (): ReaderAuxiliaryCapsuleRoute => ({
      lifecycle: this.mountHost.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId,
    }),
    identity: (): ReaderAuxiliaryCapsuleLayoutIdentity => ({
      width: this.chromeState.viewportWidth, height: this.chromeState.viewportHeight, scheme: this.readerAppScheme,
      activeTheme: this.chromeState.appearanceSnapshot.activeTheme,
    }),
    paginationSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    readingLayout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
    epoch: (): number => this.pageTurnProjection.measurementEpoch,
    paletteRevision: (): number => this.sharedAppearanceRevision,
    appearanceGeneration: (): number => this.preferences.appearanceMutationGeneration,
    suspendAdjacent: (): void => this.turnRuntime.preparation.suspend(),
    invalidateTextures: (): void => this.turnRuntime.presentation.texture.invalidate(),
  };
  private readonly capsuleActivity: ReaderAuxiliaryCapsuleActivity = {
    automatic: (): Readonly<ReaderAutoPageState> => this.playback.automaticState(),
    speech: (): ReaderTtsState => this.sessionStatus.ttsState,
    inputCurrent: (): boolean => this.controlInteraction.readerInputIsCurrent(),
    pageTurnIdle: (): boolean => this.turnRuntime.inputPhase() === 'idle',
    setSpeechDesiredPlaying: (desired: boolean): void => this.speech.setDesiredPlaying(desired),
    toggleAutoPage: (): void => this.playback.toggleAutoPage(),
    pauseAutoPage: (): void => this.playback.pauseAutoPage('manual'),
    toggleSpeech: (): void => this.speech.toggleTts(),
  };
  private readonly capsulePorts: ReaderAuxiliaryCapsulePorts = {
    presentation: this.capsulePresentation, control: this.capsuleControl, chrome: this.capsuleChrome,
    layout: this.capsuleLayout, activity: this.capsuleActivity,
  };

  private readonly auxiliarySession: ReaderAuxiliarySessionHost = new ReaderAuxiliarySessionHost(this.capsuleVerification,
    this.auxiliarySessionView, this.auxiliarySessionControl, this.auxiliarySessionEnvironment, this.capsulePorts);

  entryPresentationProvider: () => ReaderRetainedPresentation | undefined = (): ReaderRetainedPresentation | undefined => undefined;
  private readonly replaceRuntime: ReaderRuntimeOwner = ReaderRuntimeOwner.current();
  private readonly replacePanel: ReaderControlReplacePanel = new ReaderControlReplacePanel(
    RulesMutationOwner.forRuntime(this.replaceRuntime), new ReaderControlReplaceGateway(this.replaceRuntime), {
      readState: (): ReaderControlReplaceState => this.chromeState.controlReplaceState,
      publishState: (state: ReaderControlReplaceState): void => { this.publishChromeState({ controlReplaceState: state }); },
      recovery: (): ReaderRecoveryView => this.overlayState.replaceRecovery,
      publishRecovery: (recovery: ReaderRecoveryView): void => { this.publishOverlayState({ replaceRecovery: recovery }); },
      panelOpen: (): boolean => this.controlInteraction.controlVisible() && readerControlContentLocation(this.chromeState.controlSession).module === 'replace',
      committedPresentationIdentity: (): string => this.controlGeometry.committedIdentity(),
      controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    }, {
      session: (): ReaderControlReplaceSession => ({ lifecycleToken: this.mountHost.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId }),
      runtimeCurrent: (): boolean => this.readerReplaceRuntimeCurrent(),
      sessionActive: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
      chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
      selectionToken: (): number => this.chapterSelectionToken,
      selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
      persistPosition: (): Promise<() => boolean> => this.contentMutation.persistBeforeContentMutation(),
      reloadContent: (lifecycle: number, book: string): void => this.contentMutation.reloadCurrentPageAfterReplacePersist(lifecycle, book),
    }, (error: Error): boolean => error instanceof ReaderControlReplaceGatewayError && error.writeUncertain);
  private readonly preferenceLifetime: ReaderReadingPreferencesLifetime = {
    scope: (): ReaderReadingPreferenceScope => ({ lifecycleToken: this.mountHost.lifecycleToken,
      sourceId: this.sourceId, bookId: this.bookId, chapterSelectionToken: this.chapterSelectionToken }),
    mounted: (): boolean => this.sessionStatus.mounted,
    mountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
    sessionActive: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    readerIdentityCurrent: (): boolean => this.isReaderIdentityCurrent?.() !== false,
    trace: (phase: 'settings-read' | 'settings-window', lifecycle: number): void => this.traceInitialReadingPhase?.(phase, lifecycle),
  };
  private readonly preferenceView: ReaderReadingPreferencesView = {
    settings: (): ReaderSettingsSnapshot => this.chromeState.readerSettingsSnapshot,
    appearance: (): ReaderAppearanceSnapshot => this.chromeState.appearanceSnapshot,
    publishSettings: (snapshot: ReaderSettingsSnapshot): void => this.publishChromeState({ readerSettingsSnapshot: snapshot }),
    publishEntryAppearance: (snapshot: ReaderAppearanceSnapshot): void => this.publishChromeState({ appearanceSnapshot: snapshot }),
    admitAppearance: (snapshot: ReaderAppearanceSnapshot): void => this.readingViewport.admitAppearanceSnapshot(snapshot),
    settingsRecovery: (): ReaderRecoveryView => this.overlayState.readerSettingsRecovery,
    publishSettingsRecovery: (recovery: ReaderRecoveryView, busy: boolean): void => {
      this.publishOverlayState({ readerSettingsRecovery: recovery });
      this.publishOverlayState({ readerSettingsRecoveryBusy: busy });
    },
    appearanceRecovery: (): ReaderRecoveryView => this.overlayState.appearanceSaveRecovery,
    publishAppearanceRecovery: (recovery: ReaderRecoveryView): void => this.publishOverlayState({ appearanceSaveRecovery: recovery }),
    publishAppearanceRecoveryBusy: (busy: boolean): void => this.publishOverlayState({ appearanceSaveRecoveryBusy: busy }),
    recoveryInputCurrent: (): boolean => this.recovery.inputCurrent(),
    appearanceRecoveryChanged: (): void => { if (!this.recovery.hasContent()) this.recovery.retire(); },
  };
  private readonly preferenceWindow: ReaderReadingPreferencesWindow = {
    uiContext: (): UIContext => this.getUIContext(),
    foreground: (): boolean => this.appForeground,
    chromeActive: (): boolean => this.windowChromeActive,
    overlayActive: (): boolean => this.windowChromeOverlayActive,
    expanded: (): boolean => this.expandedLayout,
    controlsPresented: (): boolean => this.controlsPresentedForWindow(),
    capsuleStageFlying: (): boolean => this.overlayState.sessionLaunch?.ownership === 'stage' && !this.overlayState.sessionLaunch.sample.finished,
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    publishControlsPresented: (presented: boolean): void => this.publishChromeState({ windowControlsPresented: presented }),
    publishPolicyPending: (pending: boolean): void => this.publishChromeState({ readerWindowPolicyPending: pending }),
    ttsWindowAwakeRequested: (): boolean => this.speech.ttsWindowAwakeRequested(),
    stopTtsOnScreenOff: (): void => this.speech.stopTtsOnScreenOff(),
    volumePageTurn: (direction: ReaderPageTurnDirection): void => {
      this.playback.manualInteraction();
      this.turnRuntime.input.request(direction);
    },
  };
  private readonly preferencePage: ReaderReadingPreferencesPage = {
    expandedLayout: (): boolean => this.readingViewport.readingLayout().widthClass === 'expanded',
    inputCurrent: (): boolean => this.controlInteraction.readerInputIsCurrent(),
    inputIdle: (): boolean => this.turnRuntime.inputPhase() === 'idle',
    deferWindowSettings: (snapshot: ReaderSettingsSnapshot): void => {
      this.turnRuntime.pageTurn.deferWindowSettings(snapshot);
      this.turnRuntime.rollbackForDeferredMutation();
    },
    visibleContinuousScalar: (): number => this.surface.continuousVisibleScalar,
    restoreFromContinuousScalar: (scalar: number): void => { this.measuredPage.desiredChapterOffset = scalar; },
    reflowWindow: (): void => this.readingViewport.reflowAfterWindowGeometryChange(),
    renderChanged: (): void => this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
    resumePendingAutoPageTurn: (): void => this.playback.auto.resumePendingTurn(),
    sampleAndCommitContinuous: (lifecycle: number): Promise<void> => {
      this.surface.continuousAnchorSampler?.();
      return this.readingProgress.commitContinuousProgress(lifecycle);
    },
    invalidatePageTurnRuntime: (): void => this.turnRuntime.invalidate(true),
    resetBookTurnFailure: (): void => this.publishPageTurnProjection({ bookTurnRuntimeFailed: false }),
    publishNavigationModeChange: (mode: ReaderNavigationMode): void => {
      if (!this.routeSelection.hasCurrentMaterializedChapter()) return;
      if (mode === 'continuous') {
        this.surface.rebuildContinuousFragments(false, this.measuredPage.page?.startScalar ?? this.measuredPage.desiredChapterOffset);
        this.surface.continuousProgressRevision += 1;
      } else this.measuredPage.beginCanonicalModeMeasurement(this.surface.continuousVisibleScalar);
    },
    preparePageTurnIfReady: (): void => { if (this.sessionStatus.phase === 'ready') this.turnRuntime.preparation.schedule(); },
  };
  private readonly preferences: ReaderReadingPreferencesHost = new ReaderReadingPreferencesHost(this.replaceRuntime,
    this.transientFeedback, this.preferenceLifetime, this.preferenceView, this.preferenceWindow, this.preferencePage);
  private readonly controlDirectoryLifecycle: ReaderControlDirectoryLifecycle = {
    publish: (session: ReaderControlSessionState): void => this.publishChromeState({ controlSession: session }),
    preferences: (): ReaderReadingPreferencesHost => this.preferences,
    geometry: (): ReaderControlGeometryHost => this.controlGeometry,
    verification: (): ReaderControlVerificationSession => this.controlVerification,
    openRevision: (): number => this.chromeState.controlOpenRevision,
    cancelAutomaticStart: (): void => this.turnRuntime.cancelAutomaticPageStart(),
    scheduleSpeechFollow: (): void => this.playback.scheduleTtsFollow(),
    publishClosing: (closing: boolean): void => this.controlInteraction.admitSessionControlClosing(closing),
    windowOwnedByControl: (): boolean => this.controlsPresentedForWindow(),
    preparation: (): ReaderPageTurnPreparationHost => this.turnRuntime.preparation,
    search: (): ReaderContentSearchPublication => this.quickSearchPublication,
    bumpSearchRevision: (): void => this.publishChromeState({ quickSearchRevision: this.chromeState.quickSearchRevision + 1 }),
    replace: (): ReaderControlReplacePanel => this.replacePanel,
    preparePage: (page: ReaderControlPage): void => this.controlInteraction.prepareControlPage(page),
    resetSearch: (): void => this.controlInteraction.resetQuickSearch(),
    canResumeReading: (): boolean => this.sessionStatus.mounted && !this.sessionStatus.exitRequested,
    resumeAutomatic: (): void => this.playback.auto.resumePendingTurn(),
  };
  private readonly controlDirectory: ReaderControlDirectorySession =
    new ReaderControlDirectorySession(this.chromeState.controlSession, this.controlDirectoryLifecycle);

  private readingPrefetchScreenLocked: boolean = false;
  private readonly readingRecordGateway: ReadingRecordGateway =
    ReaderRuntimeOwner.current().getReadingRecordGateway();
  private readonly progressProducers: ReaderProgressProducerHost = new ReaderProgressProducerHost();
  private readonly exitProgress: ReadingExitProgressCoordinator = new ReadingExitProgressCoordinator(this.progressProducers);
  private readonly chapterWindow: ReadingChapterWindow = new ReadingChapterWindow();
  private readonly interactiveChapterPreparation: ReadingInteractiveChapterPreparation = new ReadingInteractiveChapterPreparation();
  private readonly measurementView: ReaderMeasureView = {
    lifecycle: (): number => this.mountHost.lifecycleToken,
    sourceId: (): string => this.sourceId,
    bookId: (): string => this.bookId,
    bookKind: (): string | undefined => this.bookKind,
    sessionActive: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
    selectionCurrent: (selection: number): boolean => this.routeSelection.isSelectionCurrent(selection),
    epoch: (): number => this.pageTurnProjection.measurementEpoch,
    layout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
    hasMeasuredViewport: (): boolean => this.readingViewport.hasMeasuredViewport(),
    context: (): UIContext => this.getUIContext(),
    appearance: (): ReaderAppearanceSnapshot => this.chromeState.appearanceSnapshot,
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    phase: (): ReadingPhase => this.sessionStatus.phase,
    visibleFragments: (): ReadingSurfacePageFragment[] => this.pageTurnProjection.visibleFragments,
    currentPaginationKey: (): ReadingPaginationKey => this.documentIndex.currentPaginationKey(),
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    lastVisibleScalar: (content: string, map: ReadingSurfaceLayoutMap): number => this.lastVisibleScalar(content, map),
    preparationPending: (): boolean => this.turnRuntime.preparation.pending !== undefined,
    noPendingSelection: (): boolean => this.turnRuntime.preparation.pending === undefined && this.directoryOps.selection.ticket === undefined,
  };
  private readonly measurementEffects: ReaderMeasureEffects = {
    publishPhase: (phase: ReadingPhase): void => this.publishPresentationPhase(phase),
    clearVisibleFragments: (): void => this.publishPageTurnProjection({ visibleFragments: [] }),
    hideChapterTitle: (): void => this.publishChromeState({ showChapterTitle: false }),
    invalidateHiddenMeasurementTree: (): void => this.publishPageTurnProjection({ measurementEpoch: this.pageTurnProjection.measurementEpoch + 1 }),
    ensureReadyDeadline: (lifecycle: number, selection: number): void => this.mountHost.hydration.ensureReadyDeadline(lifecycle, selection),
    armCompletionDeadline: (): void => this.mountHost.hydration.armCompletionDeadline(),
    retainNativeParagraphResources: (): void => this.imageResidency.retainNativeParagraphResources(),
    expandParagraphWindow: (request: ReaderChapterRangeAcquisition): void => this.acquisition.expandParagraphWindow(request),
    admitVisibleChapter: (chapter: ReadingSessionChapter): void => this.mountHost.setCurrentReadingChapter(chapter),
    completePreparedPageTurn: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): void =>
      this.turnRuntime.preparation.complete(page, generation, selection, lifecycle),
    completeFirstPage: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): Promise<void> =>
      this.firstPageAdmission.completeFirstPage(page, generation, selection, lifecycle),
    recordFirstLayout: (lifecycle: number): void => this.traceInitialReadingPhase?.('first-layout-ready', lifecycle),
    fail: (error: Error, lifecycle: number): void => this.recovery.fail(error, lifecycle),
  };
  private readonly measurementImages: ReaderMeasureImages = {
    forParagraph: (paragraph: MeasurementParagraph): ReadingSessionImage | undefined => this.imageResidency.readingImageForParagraph(paragraph),
    scaledHeight: (image: ReadingSessionImage, capacity: number): number => this.scaledReadingImageHeight(image, capacity),
    resolvePending: (image: ReadingSessionImage, generation: number, selection: number, lifecycle: number): void =>
      this.imageResidency.resolvePendingReadingImage(image, generation, selection, lifecycle),
    indexChapter: (chapter: ReadingSessionChapter): void => this.imageResidency.indexChapter(chapter),
  };
  private readonly reversePagePorts: ReaderReversePagePorts = {
    window: this.chapterWindow,
    preparation: (): ReaderPageTurnPreparationHost => this.turnRuntime.preparation,
    settlement: (): ReaderPageTurnSettlementHost => this.turnRuntime.settlement,
    input: (): ReaderPageTurnInputHost => this.turnRuntime.input,
    acquisition: (): ReaderReadingChapterAcquisitionHost => this.acquisition,
    chapterPresentation: (): ReaderReadingChapterPresentationHost => this.chapterPresentation,
    firstPage: (): ReaderReadingMeasurementAdmissionHost => this.firstPageAdmission,
    mounted: (): boolean => this.sessionStatus.mounted,
    selection: (): number => this.chapterSelectionToken,
    nextSelection: (): number => { this.chapterSelectionToken += 1; return this.chapterSelectionToken; },
    knownChapter: (chapter: number): boolean => this.documentIndex.isKnownControlChapter(chapter),
    adjacentChapter: (chapter: number, step: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapter, step),
    canTurn: (): boolean => this.turnRuntime.canTurnPage(),
    inputIdle: (): boolean => this.turnRuntime.inputPhase() === 'idle',
    stablePage: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      this.routeSelection.isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    retainWindow: (): void => this.documentIndex.retainCurrentChapterWindow(),
    admitNeighbourVersion: (chapter: number, version: string): void => this.documentIndex.admitChapterContentVersion(chapter, version),
    publishTurnRevision: (): void =>
      this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
    resolvePageImages: (chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]): void =>
      this.imageResidency.resolvePageImagePixels(chapter, fragments),
    releaseImages: (): void => this.imageResidency.releaseUnretainedReadingImages(),
    resumeAutomatic: (): void => this.playback.auto.resumePendingTurn(),
    resumeSpeech: (): void => this.playback.resumeTtsFollow(),
    scheduleTexture: (): void => this.turnRuntime.presentation.texture.schedule(),
    clearRestoredProgress: (): void => { this.mountHost.recordRestoration(undefined); },
  };

  private readonly measuredPage: ReaderMeasuredPagePublication =
    new ReaderMeasuredPagePublication(this.measurementView, this.measurementEffects, this.measurementImages, this.reversePagePorts);

  private readingSessionScope(): ReaderChapterAcquisitionScope {
    return { sourceId: this.sourceId, bookId: this.bookId, lifecycleToken: this.mountHost.lifecycleToken,
      selectionToken: this.chapterSelectionToken };
  }

  private readonly acquisitionSession: ReaderChapterAcquisitionSession = {
    scope: (): ReaderChapterAcquisitionScope => this.readingSessionScope(),
    gateway: (): ReadingSessionFlowGateway => this.mountHost.activeGateway(),
    hasGateway: (): boolean => this.mountHost.gateway !== undefined,
    window: (): ReadingChapterWindow => this.chapterWindow,
    boundaryMode: (): ReadingParagraphBoundaryMode => readingParagraphBoundaryMode(this.sourceId, this.bookKind),
    selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
    active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    mountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
  };
  private readonly acquisitionEntry: ReaderChapterAcquisitionEntry = {
    toc: (): LocalReadingTocEntry[] => this.chromeState.tocEntries,
    requireKnownChapter: (index: number): void => { this.mountHost.requireKnownChapter(index); },
    catalogPending: (): boolean => this.mountHost.entryCatalogPending,
    downloadState: (index: number, proof: ReaderDirectoryTargetProof | undefined): LocalReadingDownloadState | undefined =>
      this.mountHost.knownChapterDownloadState(index, proof),
    prepared: (): ReadingEntrySnapshot | undefined => this.mountHost.preparedEntry,
    discardPrepared: (): void => this.mountHost.discardPreparedEntry(),
    restartPrepared: (lifecycle: number, selection: number, layout: Promise<void[]>): Promise<void> =>
      this.mountHost.restartPreparedReadingEntry(lifecycle, selection, layout),
    restoredProgress: (): LocalReadingProgressState | undefined => this.mountHost.restoredProgress(),
    updateRestoredProgress: (progress: LocalReadingProgressState): void => { this.mountHost.recordRestoration(progress); },
    markRetainedBodyReady: (lifecycle: number, selection: number): void => this.chapterPresentation.markRetainedChapterBodyReady(lifecycle, selection),
    traceChapterReady: (lifecycle: number): void => this.traceInitialReadingPhase('chapter-ready', lifecycle),
  };
  private readonly acquisitionPresentation: ReaderChapterAcquisitionPresentation = {
    admitVersion: (index: number, version: string): void => this.documentIndex.admitChapterContentVersion(index, version),
    setCurrentWindowChapter: (chapter: ReadingSessionChapter): void => this.mountHost.setCurrentReadingChapter(chapter),
    retainWindow: (): void => this.documentIndex.retainCurrentChapterWindow(),
    present: (admission: ReaderAcquiredChapter): void => {
      this.measuredPage.chapter = admission.chapter;
      this.imageResidency.indexChapter(admission.chapter);
      this.measuredPage.materializedChapterSelectionToken = admission.selectionToken;
      admitReaderRestoredAnchor(this.measuredPage, this.exitProgress, admission.chapter, admission.projection.map,
        admission.isInitial ? this.mountHost.restoredProgress() : undefined, admission.requestedOffset, admission.requestedProgress);
      this.measuredPage.nativeMeasurement.chapterRanges = admission.projection.ranges;
      if (this.readingViewport.hasMeasuredViewport()) this.measuredPage.beginMeasurement(admission.lifecycleToken);
    },
    materializedSample: (): ReaderChapterMaterializedSample | undefined => {
      const chapter = this.measuredPage.chapter;
      const map = this.measuredPage.chapterLayoutMap;
      return chapter === undefined || map === undefined ? undefined : { chapter, map };
    },
    publishMetrics: (metrics: LocalReadingContentMetrics | undefined): void =>
      this.publishSessionStatus({ contentMetrics: { value: metrics } }),
  };
  private readonly acquisitionPages: ReaderChapterAcquisitionPages = {
    visiblePage: (): PhysicalReadingPage | undefined => this.measuredPage.page,
    chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    hasFacingChapter: (): boolean => this.readingViewport.readingLayout().facingChapterWidth > 0,
    stableVisibleOwner: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      this.routeSelection.isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    isReadableTarget: (index: number): boolean => this.documentIndex.isKnownControlChapter(index),
    turnGeneration: (): number => this.turnRuntime.preparation.generation,
    stillWantsNeighbour: (direction: ReaderPageTurnDirection): boolean =>
      this.turnRuntime.pageTurn.direction() === direction || this.turnRuntime.input.pointerId >= 0,
    reviseFacingSpread: (): void => {
      if (this.turnRuntime.inputPhase() === 'idle') {
        this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 });
      }
    },
    prepareAdjacent: (direction: ReaderPageTurnDirection): void => {
      this.turnRuntime.preparation.enqueue(direction);
      this.turnRuntime.preparation.drain();
    },
  };
  private readonly acquisitionRecovery: ReaderChapterAcquisitionRecovery = {
    fail: (error: Error, lifecycle: number): void => this.recovery.fail(error, lifecycle),
    showRecovery: (message: string, label: string, refresh: () => void): void => this.recovery.show(message, label, refresh),
    beginCacheRefresh: (index: number, lifecycle: number, context: RemoteReadingPositionContext | undefined): number => {
      this.chapterSelectionToken += 1;
      this.chapterPresentation.beginRetainedChapterPresentation(index, lifecycle, this.chapterSelectionToken, true, context);
      this.acquisition.resetForChapterSelection();
      this.publishOverlayState({ failureCode: '' });
      this.mountHost.hydration.armReadyDeadline(lifecycle, this.chapterSelectionToken);
      return this.chapterSelectionToken;
    },
    reloadBookmarks: (chapter: ReadingSessionChapter, lifecycle: number, selection: number): void =>
      this.directoryOps.refreshBookmarks(chapter, lifecycle, selection),
    uiContext: (): UIContext => this.getUIContext(),
    feedbackForeground: (): boolean => this.appForeground && this.windowChromeActive,
  };
  private readonly acquisitionRetirement: ReaderChapterSelectionRetirement = {
    retireOpeningRun: (): void => {
      this.publishSessionStatus({ loadingChapterIndex: { value: undefined } });
      this.measuredPage.measurementRun.resetSelection();
    },
    retireRecovery: (): void => this.recovery.show(''),
    invalidatePageTurn: (rapid: boolean, tts: boolean): void => {
      this.firstPageAdmission.retireOrdinaryMeasurement();
      this.turnRuntime.invalidate(true, rapid, tts);
    },
    clearWorkingMeasurement: (): void => this.measuredPage.retireWorkingSelection(),
    resetVisibleProjection: (preserveDisplay: boolean): void =>
      this.surface.retireSelection(preserveDisplay || this.chapterPresentation.retainedChapterFrame() !== undefined),
    clearMaterializedContent: (): void => {
      this.imageResidency.resetChapter();
      this.measuredPage.retireMaterializedSelection();
      this.publishPageTurnProjection({ measurementEpoch: this.pageTurnProjection.measurementEpoch + 1 });
      this.publishPresentationPhase('loading');
    },
    cancelSelectionDeadlines: (): void => {
      this.measuredPage.measurementRun.cancelDeadline();
      this.mountHost.hydration.cancelReadyDeadline();
      this.mountHost.hydration.cancelCompletionDeadline();
      this.mountHost.hydration.resetCompletionRetries();
      this.turnRuntime.preparation.cancelRetry();
    },
  };
  private readonly acquisition: ReaderReadingChapterAcquisitionHost = new ReaderReadingChapterAcquisitionHost(this.transientFeedback,
    this.interactiveChapterPreparation, this.acquisitionSession, this.acquisitionEntry, this.acquisitionPresentation,
    this.acquisitionPages, this.acquisitionRecovery, this.acquisitionRetirement);

  private readonly contentLifetime: ReaderReadingContentLifetime = {
    scope: (): ReaderReadingContentScope => this.readingSessionScope(),
    mounted: (): boolean => this.sessionStatus.mounted,
    active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
  };
  private readonly conversionView: ReaderReadingConversionView = {
    mode: (): ReaderChineseConversionMode => this.chromeState.chineseConversionMode,
    publishMode: (mode: ReaderChineseConversionMode): void => this.publishChromeState({ chineseConversionMode: mode }),
    operationId: (): string => this.chromeState.chineseConversionOperationId,
    publishOperationId: (id: string): void => this.publishChromeState({ chineseConversionOperationId: id }),
    uiContext: (): UIContext => this.getUIContext(),
    foreground: (): boolean => this.appForeground,
    windowChromeActive: (): boolean => this.windowChromeActive,
  };
  private readonly contentPosition: ReaderReadingContentPosition = {
    gateway: (): ReadingSessionFlowGateway => this.mountHost.activeGateway(),
    chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    failed: (): boolean => this.sessionStatus.phase === 'failed',
    navigationMode: (): ReaderNavigationMode => this.chromeState.readerSettingsSnapshot.navigationMode,
    hasVisiblePage: (): boolean => this.measuredPage.page !== undefined,
    visiblePageStart: (): number | undefined => this.measuredPage.page?.startScalar,
    sampleContinuousAnchor: (): void => this.surface.continuousAnchorSampler?.(),
    continuousVisibleScalar: (): number => this.surface.continuousVisibleScalar,
    awaitFirstPagePersistence: (): Promise<void> => this.firstPageAdmission.awaitOrdinaryFirstPagePersistence(),
    commitContinuousProgress: (lifecycle: number): Promise<void> => this.readingProgress.commitContinuousProgress(lifecycle),
    commitVisiblePage: (lifecycle: number): Promise<void> => this.readingProgress.commitVisiblePage(lifecycle),
    committed: (): ReadingCommit | undefined => this.exitProgress.committed,
    selectMappedPosition: (chapterIndex: number, offset: number, context?: RemoteReadingPositionContext): void =>
      this.directoryOps.selectAnchor(chapterIndex, offset, false, true, undefined, -1, false, false, context),
    retryReading: (): void => this.recovery.retryReading(),
    showPositionRecovery: (message: string, label: string, retry: () => void): void => this.recovery.show(message, label, retry),
  };
  private readonly contentProjection: ReaderReadingContentProjection = {
    settlementActive: (): boolean => this.pageTurnProjection.pageTurnSettlementActive,
    preparationActive: (): boolean => this.turnRuntime.preparation.pending !== undefined,
    chapterSelectionPending: (): boolean => this.directoryOps.selection.ticket !== undefined,
    deferContentProjection: (chapterIndex: number): void => this.turnRuntime.pageTurn.deferContentProjection(chapterIndex),
    deferReplaceReload: (): void => this.turnRuntime.pageTurn.deferReplaceReload(),
    invalidatePageTurnRuntime: (): void => this.turnRuntime.invalidate(true),
    clearProcessedChapters: (): void => {
      this.acquisition.clearContentMetrics();
      this.documentIndex.invalidateProcessedContent();
    },
    retireQuickSearch: (): void => {
      this.quickSearchPublication.cancel();
      this.controlInteraction.publishQuickSearchState({ kind: 'idle' });
    },
    admitToc: (entries: LocalReadingTocEntry[]): void => this.admitTocEntries(entries),
    notifyDirectoryChanged: (entries: LocalReadingTocEntry[]): void => this.onDirectoryProjectionChanged(entries),
  };
  private readonly contentMutation: ReaderReadingContentMutationHost = new ReaderReadingContentMutationHost(this.replaceRuntime,
    this.auxiliaryFlows, this.transientFeedback, this.contentLifetime, this.conversionView, this.contentPosition, this.contentProjection);

  private readonly continuousSurfaceView: ReaderContinuousSurfaceView = {
    retainedChrome: (): ReaderPageChromeSnapshot | undefined => this.chapterPresentation.retainedChapterFrame()?.continuousChrome,
    currentChapterIndex: (): number => this.currentChapterIndex(),
    liveChrome: (revision: number, offset: number, count: number): ReaderPageChromeSnapshot =>
      this.pageChrome.continuousSnapshot(revision, offset, count),
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    revision: (): number => this.pageTurnProjection.continuousRenderRevision,
    progressText: (): string => this.chromeState.continuousChromeProgressText,
    hasPartialEntryWindow: (): boolean => this.hasPartialEntryWindow(),
    inFlightDirection: (): ReaderPageTurnDirection | undefined => this.turnRuntime.pageTurn.inFlightDirection,
    lifecycle: (): number => this.mountHost.lifecycleToken,
    selection: (): number => this.chapterSelectionToken,
    turnSerial: (): number => this.turnRuntime.input.transactionSerial,
    mountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
    exiting: (): boolean => this.sessionStatus.exitRequested,
    adjacentChapterIndex: (chapterIndex: number, delta: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapterIndex, delta),
    appearance: (): ReaderAppearanceSnapshot => this.readingViewport.visibleReadingAppearance(),
    measurementTextWidth: (): number => this.measurementTextWidth(),
    context: (): UIContext => this.getUIContext(),
    imageAt: (startScalar: number): ReadingSessionImage | undefined => this.imageResidency.atScalar(startScalar),
    visibleFragments: (): ReadingSurfacePageFragment[] => this.pageTurnProjection.visibleFragments,
    layout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    scaledImageHeight: (image: ReadingSessionImage, capacity: number): number => this.scaledReadingImageHeight(image, capacity),
    ttsState: (): ReaderTtsState => this.sessionStatus.ttsState,
    ttsFollowHighlight: (): boolean => this.sessionStatus.ttsFollowHighlight,
    mounted: (): boolean => this.sessionStatus.mounted,
    controlVisible: (): boolean => this.controlInteraction.controlVisible(),
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    progressInFlight: (): boolean => this.progressProducers.continuousInFlight,
    isUnknownCatalogEdge: (chapterIndex: number, direction: ReaderPageTurnDirection): boolean => this.turnRuntime.input.isUnknownCatalogEdge(chapterIndex, direction),
    viewportHeight: (): number => this.chromeState.viewportHeight,
    reducedMotion: (): boolean => this.reduceMotion,
  };
  private readonly continuousSurfaceEffects: ReaderContinuousSurfaceEffects = {
    publishSelectionActive: (active: boolean): void => this.publishPageTurnProjection({ textSelectionActive: active }),
    retirePagePointer: (): void => this.turnRuntime.input.retirePointer(),
    retireRecovery: (): void => this.recovery.retire(),
    manualInteraction: (): void => this.playback.manualInteraction(),
    publishProgressText: (text: string): void => this.publishChromeState({ continuousChromeProgressText: text }),
    resolveContinuousImage: (startScalar: number): void => this.imageResidency.resolveContinuousImage(startScalar),
    scheduleEntryWindowHydration: (): void => this.mountHost.scheduleEntryWindowHydration(),
    commitProgress: (lifecycle: number): Promise<void> => this.readingProgress.commitContinuousProgress(lifecycle),
    completeRapid: (direction: ReaderPageTurnDirection): void => {
      this.turnRuntime.pageTurn.completeRapid(direction);
      this.turnRuntime.input.drain();
    },
    turnToPreviousChapter: (target: number, from: number, offset: number): boolean => this.turnRuntime.input.turnToPreviousChapter(target, from, offset),
    openPageTurnChapter: (chapterIndex: number, offset: number): boolean => this.routeSelection.openPageTurnChapter(chapterIndex, offset),
    bumpRevision: (): void => this.publishPageTurnProjection({ continuousRenderRevision: this.pageTurnProjection.continuousRenderRevision + 1 }),
    requestCatalogForTurn: (): void => this.turnRuntime.input.requestCatalog(),
  };
  private readonly surface: ReaderReadingSurfaceHost =
    new ReaderReadingSurfaceHost(this.measuredPage, this.continuousSurfaceView, this.continuousSurfaceEffects);

  private readonly mountRoutes: ReaderReadingMountRoutes = {
    current: (): ReaderReadingMountRoute => ({
      sourceId: this.sourceId, bookId: this.bookId, bookKind: this.bookKind, remoteSession: this.remoteSession,
      remoteBookSeed: this.remoteBookSeed, sourceSwitchTransactionId: this.sourceSwitchTransactionId,
      requestedChapterIndex: this.requestedChapterIndex, requestedBookmarkAnchor: this.requestedBookmarkAnchor,
      directoryEntries: this.directoryEntries,
    }),
    isReaderIdentityCurrent: (): boolean => this.isReaderIdentityCurrent?.() !== false,
    resolveSourceSwitchTransactionId: (sourceId: string, bookId: string): Promise<string | undefined> =>
      this.resolveSourceSwitchTransactionId(sourceId, bookId),
    onRemoteSessionReady: (session: RemoteReadingSession): void => this.onRemoteSessionReady(session),
  };
  private readonly entryScene: ReaderMountedEntryScene = {
    mount: (): ReaderReadingMountHost => this.mountHost,
    chrome: (): ReadingChromeRenderSnapshot => this.chromeState,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    session: (): ReadingSessionRenderSnapshot => this.sessionStatus,
    measured: this.measuredPage, surface: this.surface, preferences: this.preferences,
    acquisition: this.acquisition, exitProgress: this.exitProgress,
    images: (): ReaderReadingImageResidencyHost => this.imageResidency,
    firstPage: (): ReaderReadingMeasurementAdmissionHost => this.firstPageAdmission,
    progress: (): ReaderReadingProgressHost => this.readingProgress,
    preparation: (): ReaderPageTurnPreparationHost => this.turnRuntime.preparation,
    settlement: (): ReaderPageTurnSettlementHost => this.turnRuntime.settlement,
    directory: (): ReaderControlDirectoryOperationsHost => this.directoryOps,
    turnInput: (): ReaderPageTurnInputHost => this.turnRuntime.input,
    recovery: (): ReaderReadingRecoveryHost => this.recovery,
    autoPage: (): ReaderAutoPageCoordinator => this.playback.auto,
    foreground: (): boolean => this.appForeground,
    windowChromeActive: (): boolean => this.windowChromeActive,
    selection: (): number => this.chapterSelectionToken,
    uiContext: (): UIContext => this.getUIContext(),
    viewportReady: (): boolean => this.readingViewport.hasMeasuredViewport(),
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    paginationKey: (): ReadingPaginationKey => this.documentIndex.currentPaginationKey(),
    retainedEntry: (): ReaderRetainedPresentation | undefined => this.entryPresentationProvider(),
    bookmarkPosition: (bookmark: ReaderBookmarkAnchorRequest): RemoteReadingPositionContext | undefined =>
      this.positionContextForScope(bookmark.positionScope, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.directoryTargetProof),
    publishMounted: (mounted: boolean): void => this.publishSessionStatus({ mounted }),
    publishPhase: (phase: ReadingPhase): void => this.publishPresentationPhase(phase),
    admitChapterVersion: (index: number, version: string): void => this.documentIndex.admitChapterContentVersion(index, version),
    retainWindow: (): void => this.documentIndex.retainCurrentChapterWindow(),
    traceInputReady: (lifecycle: number): void => this.traceInitialReadingPhase('input-ready', lifecycle),
    resumeAutomatic: (): void => this.playback.auto.resumePendingTurn(),
    startRecord: (lifecycle: number): void => this.beginReadingRecordClock(lifecycle),
    readableToc: (): LocalReadingTocEntry[] => this.documentIndex.readingTocEntries(),
    publishToc: (entries: LocalReadingTocEntry[]): void => this.admitTocEntries(entries),
    directoryChanged: (entries: LocalReadingTocEntry[]): void => this.onDirectoryProjectionChanged(entries),
    publishCatalogLoading: (loading: boolean): void => this.publishSessionStatus({ entryCatalogLoading: loading }),
    publishCatalogFailed: (failed: boolean): void => this.publishSessionStatus({ entryCatalogLoadFailed: failed }),
    reportPrefetch: (): void => this.playback.reportPrefetch(),
    resumePaging: (): void => this.resumeAfterCatalogChange(),
  };

  private readonly mountHost: ReaderReadingMountHost = new ReaderReadingMountHost(this.chapterWindow, this.transientFeedback,
    this.exitProgress, this.mountRoutes, readerMountedEntryPresentation(this.entryScene), readerMountedEntryCatalog(this.entryScene),
    this.interactiveChapterPreparation);
  private readonly directoryRecovery: ReaderReadingDirectoryRecovery = {
    current: (): ReadingDirectoryRecovery => this.bookmarkRecovery,
    reconcileBookmarks: (generation: number, presentation: string): void => this.onReconcileBookmarks(generation, presentation),
    continueBookmarks: (generation: number, presentation: string): void => this.onContinueBookmarks(generation, presentation),
    reconcileOffline: (generation: number, presentation: string): void => this.onReconcileOffline(generation, presentation),
    continueOffline: (generation: number, presentation: string): void => this.onContinueOffline(generation, presentation),
  };
  private readonly sourceRecovery: ReaderReadingSourceRecovery = {
    presentationVisible: (): boolean => this.sourceSwitchPresentationVisible,
    rollbackInFlight: (): boolean => this.sourceSwitchRollbackInFlight,
    scopeId: (): number => this.sourceSwitchScopeId,
    transactionId: (): string | undefined => this.sourceSwitchTransactionId,
    rollback: (transactionId: string, scopeId: number): void => this.onRollbackReaderTarget(transactionId, scopeId),
  };

  private readonly nativeRecoveryActors: ReaderNativeRecoveryActors = {
    mount: this.mountHost, measured: this.measuredPage, preferences: this.preferences, exitProgress: this.exitProgress,
    acquisition: this.acquisition, playback: this.playback,
    runtime: (): ReaderPageTurnRuntimeHost => this.turnRuntime,
    directory: (): ReaderControlDirectoryOperationsHost => this.directoryOps,
    chapterPresentation: (): ReaderReadingChapterPresentationHost => this.chapterPresentation,
    viewport: (): ReaderReadingViewportHost => this.readingViewport,
    record: (): ReaderReadingRecordHost => this.readingRecordHost,
  };
  private readonly nativeRecoveryView: ReaderNativeRecoveryView = {
    scope: (): ReaderReadingRecoveryScope => this.readingSessionScope(),
    session: (): ReadingSessionRenderSnapshot => this.sessionStatus,
    overlay: (): ReadingOverlayRenderSnapshot => this.overlayState,
    publishOverlay: (update: ReadingOverlayRenderUpdate): void => this.publishOverlayState(update),
    publishSession: (update: ReadingSessionRenderUpdate): void => this.publishSessionStatus(update),
    markFailed: (): void => this.publishPresentationPhase('failed'),
    preferenceModule: (): string => this.readerPreferenceModule(),
    uiContext: (): UIContext => this.getUIContext(),
    expanded: (): boolean => this.expandedLayout,
    controlLayout: (): ReaderControlLayoutSnapshot => this.controlGeometry.layout(this.readerWindowMetricsRevision),
    controlVisible: (): boolean => this.controlInteraction.controlVisible(),
    controlMotionVisible: (): boolean => this.controlInteraction.controlMotionVisible(),
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    hideControl: (): void => this.controlInteraction.hideControl(),
    readerInputCurrent: (): boolean => this.controlInteraction.readerInputIsCurrent(),
    advanceSelection: (): void => { this.chapterSelectionToken += 1; },
    reportFailure: (source: string, book: string, code: string, kind: RemoteReadingFailureKind): void =>
      this.onReadingFailure(source, book, code, kind),
  };
  private readonly recovery: ReaderReadingRecoveryHost = readerNativeReadingRecovery(
    this.nativeRecoveryActors, this.nativeRecoveryView, this.directoryRecovery, this.sourceRecovery);

  private readonly firstPageSurfacePublication: ReaderFirstPageSurfacePublication = {
    publishBody: (page: PhysicalReadingPage): void => this.publishPageTurnProjection({ visibleFragments: page.fragments }),
    clearLoadingTarget: (): void => this.publishSessionStatus({ loadingChapterIndex: { value: undefined } }),
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    presentContinuous: (page: PhysicalReadingPage): void =>
      this.surface.rebuildContinuousFragments(false, this.chapterPresentation.continuousChapterCommitScalar(page)),
    finishRetained: (lifecycle: number, selection: number): void => this.chapterPresentation.finishRetainedChapterPresentation(lifecycle, selection),
    releaseUnretainedImages: (): void => this.imageResidency.releaseUnretainedReadingImages(),
  };
  private controlScope(): ReaderControlNavigationScope {
    return { sourceId: this.sourceId, bookId: this.bookId, lifecycleToken: this.mountHost.lifecycleToken,
      openRevision: this.chromeState.controlOpenRevision, visitRevision: this.controlDirectory.visitRevision() };
  }

  private readonly controlGeometryScene: ReaderControlGeometryScene = {
    scope: (): ReaderControlNavigationScope => this.controlScope(),
    uiContext: (): UIContext => this.getUIContext(),
    mounted: (): boolean => this.sessionStatus.mounted,
    mountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
    active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    foreground: (): boolean => this.appForeground,
    chromeActive: (): boolean => this.windowChromeActive,
    overlayActive: (): boolean => this.windowChromeOverlayActive,
    interactionBlocked: (): boolean => this.interactionBlocked,
    controlObscured: (): boolean => this.controlObscured,
    width: (): number => this.readingViewport.effectiveViewportWidth(),
    height: (): number => this.readingViewport.effectiveViewportHeight(),
    expanded: (): boolean => this.expandedLayout,
    pageInputIdle: (): boolean => this.turnRuntime.inputPhase() === 'idle',
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    session: (): ReaderControlSessionState => this.chromeState.controlSession,
    motionSession: (): ReaderControlSessionState => this.controlInteraction.controlMotionSession(),
    navigation: (): ReaderControlNavigation => this.controlInteraction.navigation,
    auxiliarySession: (): ReaderAuxiliarySessionHost => this.auxiliarySession,
    launch: (): ReaderSessionLaunchTransaction | undefined => this.overlayState.sessionLaunch,
  };
  private readonly controlGeometryPublication: ReaderControlGeometryPublication = {
    readReceipt: (): ReaderControlPresentationReceipt | undefined => this.chromeState.controlPresentationReceipt,
    publishReceipt: (receipt: ReaderControlPresentationReceipt | undefined): void =>
      this.publishChromeState({ controlPresentationReceipt: { value: receipt } }),
    readRevision: (): number => this.chromeState.controlMinimumRevision,
    publishRevision: (revision: number): void => this.publishChromeState({ controlMinimumRevision: revision }),
    publishReady: (ready: boolean): void => this.publishChromeState({ controlMinimumReady: ready }),
    publishTemporaryLayer: (kind: ReaderControlTemporaryInputKind): void => this.publishChromeState({ controlTemporaryLayerPresented: kind }),
    publishTemporaryDismiss: (revision: number): void => this.publishChromeState({ dismissControlTemporaryRevision: revision }),
    publishTemporaryRetire: (revision: number): void => this.publishChromeState({ retireControlTemporaryRevision: revision }),
  };
  private readonly controlGeometryEffects: ReaderControlGeometryEffects = {
    commitNavigation: (location: ReaderControlLocation, intent: ReaderControlNavigationIntent, source: ReaderControlSessionState,
      session: ReaderControlSessionState): ReaderControlPage | undefined => {
      return this.controlDirectory.acceptMeasuredVisit(location, intent, source, session,
        (): void => this.publishChromeState({ controlNavigationIntent: { value: undefined } }));
    },
    prepareControlPage: (page: ReaderControlPage): void => this.controlInteraction.prepareControlPage(page),
    prepareReplace: (): void => this.controlInteraction.prepareControlReplacePage(),
    dismissFromBackdrop: (): void => this.controlInteraction.hideControl('backdrop'),
    fontOrder: (): ReaderAppearanceFontSlot[] => this.preferences.appearanceFontOrder(),
    commitFontOrder: (order: ReaderAppearanceFontSlot[]): Promise<ReaderAppearanceSnapshot | undefined> =>
      this.preferences.commitAppearanceFontOrder(order),
    fontOrderDisplayed: (facts: ReaderControlFontOrderFacts): void =>
      this.controlVerification.effect('font-reorder', 'order-admitted', facts),
  };
  private readonly controlGeometry: ReaderControlGeometryHost = new ReaderControlGeometryHost(
    this.controlGeometryScene, this.controlGeometryPublication, this.controlGeometryEffects);
  private readonly controlInteraction: ReaderReadingControlInteractionHost = new ReaderReadingControlInteractionHost({
    session: this.controlDirectory, geometry: this.controlGeometry,
    directory: (): ReaderControlDirectoryOperationsHost => this.directoryOps,
    mount: (): ReaderReadingMountHost => this.mountHost,
    turn: (): ReaderPageTurnRuntimeHost => this.turnRuntime,
    auxiliary: (): ReaderAuxiliarySessionHost => this.auxiliarySession,
    recovery: (): ReaderReadingRecoveryHost => this.recovery,
    speech: (): ReaderReadingSpeechHost => this.speech,
    preferences: (): ReaderReadingPreferencesHost => this.preferences,
    contentMutation: (): ReaderReadingContentMutationHost => this.contentMutation,
    acquisition: (): ReaderReadingChapterAcquisitionHost => this.acquisition,
    verification: this.controlVerification,
    brightness: (): ReaderBrightnessSession => this.brightnessSession,
    replace: this.replacePanel, search: this.quickSearchPublication,
  }, {
    scope: (): ReaderControlNavigationScope => this.controlScope(),
    mounted: (): boolean => this.sessionStatus.mounted,
    exiting: (): boolean => this.sessionStatus.exitRequested,
    foreground: (): boolean => this.appForeground,
    windowChromeActive: (): boolean => this.windowChromeActive,
    windowChromeOverlayActive: (): boolean => this.windowChromeOverlayActive,
    controlObscured: (): boolean => this.controlObscured,
    interactionBlocked: (): boolean => this.interactionBlocked,
    readerIdentityCurrent: (): boolean => this.isReaderIdentityCurrent?.() !== false,
    externalInputCurrent: (): boolean => this.inputCurrent?.() ?? true,
    reducedMotion: (): boolean => this.reduceMotion,
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    sessionLaunchActive: (): boolean => this.overlayState.sessionLaunch !== undefined,
    bookTitle: (): string => this.bookTitle,
    currentChapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    viewportStart: (): number | undefined => this.currentReadingViewportStart(),
  }, {
    session: (): ReaderControlSessionState => this.chromeState.controlSession,
    openRevision: (): number => this.chromeState.controlOpenRevision,
    advanceOpenRevision: (): void => this.publishChromeState({ controlOpenRevision: this.chromeState.controlOpenRevision + 1 }),
    navigationIntent: (): ReaderControlNavigationIntent | undefined => this.chromeState.controlNavigationIntent,
    publishNavigationIntent: (intent: ReaderControlNavigationIntent | undefined): void =>
      this.publishChromeState({ controlNavigationIntent: { value: intent } }),
    presentationReceipt: (): ReaderControlPresentationReceipt | undefined => this.chromeState.controlPresentationReceipt,
    minimumReady: (): boolean => this.chromeState.controlMinimumReady,
    replaceMutationPending: (): boolean => this.chromeState.controlReplaceState.mutationPending,
    searchQuery: (): string => this.chromeState.quickSearchQuery,
    publishSearchQuery: (query: string): void => this.publishChromeState({ quickSearchQuery: query }),
    searchRevision: (): number => this.chromeState.quickSearchRevision,
    advanceSearchRevision: (): void => this.publishChromeState({ quickSearchRevision: this.chromeState.quickSearchRevision + 1 }),
    sessionClosing: (): boolean => this.chromeState.sessionControlClosing,
    publishClosing: (closing: boolean): void => this.publishChromeState({ sessionControlClosing: closing }),
    advancePageRenderRevision: (): void => this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
    pageTurnSettlementActive: (): boolean => this.pageTurnProjection.pageTurnSettlementActive,
    pageTurnInputOwned: (): boolean => this.pageTurnProjection.pageTurnInputOwned,
    hasMeasuredViewport: (): boolean => !(this.chromeState.viewportWidth <= 0 || this.chromeState.viewportHeight <= 0),
    navigationMode: (): ReaderNavigationMode => this.chromeState.readerSettingsSnapshot.navigationMode,
    hasContinuousContent: (): boolean => this.surface.hasContinuousRenderContent(),
  }, {
    observePrefetch: (): void => this.playback.reportPrefetch(),
    retirePendingPlaybackStarts: (): void => this.playback.retirePendingStarts(),
    pauseAutomaticForRefresh: (): void => this.playback.pauseAutoPage('touch'),
    openSourcePicker: (focusId?: string): void => this.onSwitchSource(focusId),
  });

  private onControlInputBoundaryChanged(): void {
    this.controlInteraction.onControlInputBoundaryChanged();
  }

  private readonly settlementDeferred: ReaderPageTurnDeferredEffects = {
    controlMinimum: (): ReaderDeferredControlMinimum | undefined => this.controlGeometry.minimum.deferred,
    clearControlMinimum: (): void => this.controlGeometry.minimum.clearDeferred(),
    admitControlMinimum: (minimum: ReaderDeferredControlMinimum): void => this.controlGeometry.admit(minimum.candidates, minimum.identity),
    exit: (): void => this.readingProgress.beginExit(),
    requestedChapterChanged: (): void => this.onRequestedChapterChanged(),
    selectChapter: (selection: ReaderDeferredChapterSelection): void => {
      this.directoryOps.selectAnchor(selection.chapterIndex, selection.chapterOffset, selection.requireChapterStart, selection.stopTts,
        selection.requestedProgress, selection.controlOwnerRevision, selection.closeControlOnCommit,
        selection.refreshContent, selection.positionContext, selection.ttsOwner);
    },
    reloadReplacement: (lifecycle: number, bookId: string): void => this.contentMutation.reloadCurrentPageAfterReplacePersist(lifecycle, bookId),
    reloadProjection: (lifecycle: number, chapterIndex: number): void => this.contentMutation.reloadCurrentChapterAfterContentProjectionChange(lifecycle, chapterIndex),
    appearance: (snapshot: ReaderAppearanceSnapshot): void => this.readingViewport.admitAppearanceSnapshot(snapshot),
    viewport: (width: number, height: number, lifecycle: number): void => this.readingViewport.admitReaderViewportSize(width, height, lifecycle),
    reflowWindow: (): void => this.readingViewport.reflowAfterWindowGeometryChange(),
    windowSettings: (settings: ReaderSettingsSnapshot): void => this.preferences.commitReaderWindowSettings(settings),
  };
  private readonly turnRuntime: ReaderPageTurnRuntimeHost = new ReaderPageTurnRuntimeHost(
    READER_BOOK_TURN_COMPONENT_ID, this.chapterWindow, {
      lifecycle: (): number => this.mountHost.lifecycleToken,
      selection: (): number => this.chapterSelectionToken,
      mounted: (): boolean => this.sessionStatus.mounted,
      isMountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
      active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
      exiting: (): boolean => this.sessionStatus.exitRequested,
      foreground: (): boolean => this.appForeground,
      identity: (): ReadingProgressIdentity => ({ sourceId: this.sourceId, bookId: this.bookId }),
      phase: (): ReadingPhase => this.sessionStatus.phase,
      interactionEnabled: (): boolean => this.controlInteraction.isReaderPageInteractionEnabled(),
      controlVisible: (): boolean => this.controlInteraction.controlVisible(),
      controlObscured: (): boolean => this.controlObscured,
      interactionBlocked: (): boolean => this.interactionBlocked,
      windowPolicyPending: (): boolean => this.chromeState.readerWindowPolicyPending,
      speechFollowCurrent: (lease: ReaderTtsFollowLease): boolean => this.playback.isTtsFollowCurrent(lease),
    }, {
      measured: (): ReaderMeasuredPagePublication => this.measuredPage,
      currentChapter: (): number => this.currentChapterIndex(),
      currentPaginationKey: (): ReadingPaginationKey => this.documentIndex.currentPaginationKey(),
      paginationKey: (chapter: number): ReadingPaginationKey | undefined => this.documentIndex.paginationKeyForChapter(chapter),
      paginationLayoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
      knownContentVersion: (chapter: number): string | undefined => this.documentIndex.knownContentVersion(chapter),
      adjacentChapter: (chapter: number, step: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapter, step),
      catalogPending: (): boolean => this.mountHost.entryCatalogPending,
      catalogInFlight: (): boolean => this.mountHost.hydration.catalogInFlight(),
      chapterPosition: (chapter: number): number | undefined => this.mountHost.entryChapterPosition(chapter),
      catalogCount: (): number | undefined => this.mountHost.entryCatalogNavigation?.readableChapterCount,
      hydrateCatalog: (): Promise<void> => this.mountHost.hydration.hydrateCatalog(),
      measureCommittedPage: (offset: number): void => this.routeSelection.measureCommittedPageAt(offset),
      openChapter: (chapter: number, offset: number): boolean => this.routeSelection.openPageTurnChapter(chapter, offset),
      requestChapter: (direction: ReaderPageTurnDirection, chapter: number): void => this.acquisition.requestPageTurnChapter(direction, chapter),
      admitContentVersion: (chapter: number, version: string): void => this.documentIndex.admitChapterContentVersion(chapter, version),
    }, {
      projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
      publish: (update: ReadingPageTurnRenderUpdate): void => this.publishPageTurnProjection(update),
      settings: (): ReaderSettingsSnapshot => this.chromeState.readerSettingsSnapshot,
      appearance: (): ReaderAppearanceSnapshot => this.chromeState.appearanceSnapshot,
      layout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
      viewportWidth: (): number => this.chromeState.viewportWidth,
      viewportHeight: (): number => this.chromeState.viewportHeight,
      reduceMotion: (): boolean => this.reduceMotion,
      context: (): UIContext => this.getUIContext(),
      currentPage: (): ReaderPageTurnRenderPage => this.pageChrome.currentPage(),
      preparedPage: (direction: ReaderPageTurnDirection): ReaderPageTurnRenderPage | undefined => this.pageChrome.preparedPage(direction),
      captureCapsule: (): ReaderSessionCapsuleSnapshot | undefined => this.auxiliarySession.liveSessionCapsuleSnapshot(),
      continuousSurface: (): ReaderReadingSurfaceHost => this.surface,
      launchRenderWorkBlocked: (): boolean => this.auxiliarySession.sessionLaunchRenderWorkBlocked(),
      publishChapter: (showTitle: boolean, title: string): void => {
        this.publishChromeState({ showChapterTitle: showTitle });
        this.publishChromeState({ chapterTitle: title });
      },
      publishPhase: (phase: 'loading' | 'ready'): void => this.publishPresentationPhase(phase),
    }, {
      gateway: (): ReadingSessionFlowGateway => this.mountHost.activeGateway(),
      exitProgress: (): ReadingExitProgressCoordinator => this.exitProgress,
      producers: (): ReaderProgressProducerHost => this.progressProducers,
      layout: (): CoreReadingLayout => this.documentIndex.coreLayout(),
      canPresentOrdinaryPage: (chapter: ReadingSessionChapter): boolean => this.firstPageAdmission.canPresentOrdinaryPage(chapter),
      visiblePageCurrent: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
        this.firstPageAdmission.isOrdinaryFirstPagePresentationCurrent(page, chapter, selection, lifecycle),
      admit: (stored: LocalReadingProgress): void => this.readingProgress.admitCommittedProgress(stored),
      retireOrdinaryMeasurement: (): void => this.firstPageAdmission.retireOrdinaryMeasurement(),
    }, {
      automatic: (): Readonly<ReaderAutoPageState> => this.playback.automaticState(),
      autoPage: (): ReaderAutoPageCoordinator => this.playback.auto,
      bookmark: (): ReaderBookmarkInteractionHost => this.readerBookmark,
      observeChapterTransition: (chapter: number): void =>
        this.chapterPresentation.observeChapterTransition(this.sourceId === LOCAL_READING_SOURCE_ID ? 'local' : 'cache', chapter),
      resumeAutomaticTurn: (): void => this.playback.auto.resumePendingTurn(),
      resumeSpeechFollow: (): void => this.playback.resumeTtsFollow(),
      invalidateSpeechFollow: (): void => this.playback.invalidateTtsFollow(),
      speechFollowFailed: (lease: ReaderTtsFollowLease): void => this.playback.ttsFollowFailed(lease),
      openControl: (): void => this.controlInteraction.openReaderControl(),
      flushDeferredChrome: (): void => this.pageChrome.flushDeferred(),
      prefetchInteraction: (manual: boolean): void => this.playback.reportPrefetch(manual, true),
      releaseImages: (): void => this.imageResidency.releaseUnretainedReadingImages(),
      resolveImages: (chapter: ReadingSessionChapter, page: PhysicalReadingPage): void => this.imageResidency.resolvePageImagePixels(chapter, page.fragments),
      settlePresentationRecovery: (): void => this.recovery.settle('presentation'),
      notifyReadingReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number): boolean =>
        this.directoryOps.notifyReadingReady(chapter.chapterIndex, chapter.chapterTitle, page, selection, lifecycle),
      prefetchNextChapter: (chapter: ReadingSessionChapter, lifecycle: number, selection: number): void =>
        this.acquisition.prefetchNextChapter(chapter, lifecycle, selection),
      automaticPageCommitted: (): void => this.playback.auto.pageCommitted(),
      armAutomaticTimer: (): void => this.playback.auto.armPageTimer(true),
    }, this.settlementDeferred);

  private readonly brightnessSession: ReaderBrightnessSession = new ReaderBrightnessSession({
    writer: () => ReaderWindowCoordinator.brightness(),
    isMounted: (): boolean => this.sessionStatus.mounted,
    observeSystemBrightness: (): Promise<string> | undefined => {
      const context = this.getUIContext().getHostContext();
      return context === undefined ? undefined :
        settings.getValue(context, settings.display.SCREEN_BRIGHTNESS_STATUS);
    },
    readAutomatic: (): boolean => this.chromeState.brightnessAutomatic,
    readPercent: (): number => this.chromeState.brightnessPercent,
    publishAutomatic: (automatic: boolean): void => { this.publishChromeState({ brightnessAutomatic: automatic }); },
    publishPercent: (percent: number): void => { this.publishChromeState({ brightnessPercent: percent }); },
    publishRevision: (): void => { this.publishChromeState({ brightnessRevision: this.chromeState.brightnessRevision + 1 }); },
    reportFailure: (operation: string, error: Error): void => {
      hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness ${operation} failed: ${error.message}`);
    },
  });
  /** Normalize a continuous viewport to a chapter-head page before publishing paged mode. */
  /** Covers pagination, resolveLocation, and the initial progress write. */
  /** Invalidates every continuation captured by a prior mounted instance. */
  /** Bumped per directory chapter selection so stale loads cannot win. */
  private chapterSelectionToken: number = 0;
  /** Prevents a late startup load from replacing a newer in-session choice. */
  private readonly directoryData: ReaderControlDirectoryDataPort = {
    parentEntries: (): LocalReadingTocEntry[] => this.directoryEntries,
    publishEntriesRevision: (revision: number): void => this.publishChromeState({ controlDirectoryEntriesRevision: revision }),
    tocEntries: (): LocalReadingTocEntry[] => this.chromeState.tocEntries,
    catalogPending: (): boolean => this.mountHost.entryCatalogPending,
    catalogNavigation: (): ReadingEntryNavigation | undefined => this.mountHost.entryCatalogNavigation,
    readingToc: (): LocalReadingTocEntry[] => this.documentIndex.readingTocEntries(),
    hydrateCatalog: (): Promise<void> => this.mountHost.hydration.hydrateCatalog(),
    contentMetrics: (): LocalReadingContentMetrics | undefined => this.sessionStatus.contentMetrics,
    chapterWindow: this.chapterWindow,
    chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    chapterMap: (): ReadingSurfaceLayoutMap | undefined => this.measuredPage.chapterLayoutMap,
    currentChapterIndex: (): number => this.currentChapterIndex(),
    adjacentChapter: (chapter: number, delta: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapter, delta),
    isKnownChapter: (chapter: number): boolean => this.documentIndex.isKnownControlChapter(chapter),
  };
  private readonly directoryScope: ReaderControlDirectoryScopePort = {
    scope: (): ReaderChapterSelectionScope => this.readingSessionScope(),
    nextSelection: (): number => { this.chapterSelectionToken += 1; return this.chapterSelectionToken; },
    mounted: (): boolean => this.sessionStatus.mounted,
    exiting: (): boolean => this.sessionStatus.exitRequested,
    active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
    session: (): ReaderControlSessionState => this.chromeState.controlSession,
    visualSession: (): ReaderControlSessionState => this.controlDirectory.visualSession(),
    controlVisible: (): boolean => this.controlInteraction.controlVisible(),
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    controlClosing: (): boolean => this.controlInteraction.controlShellExitArmed(),
    openRevision: (): number => this.chromeState.controlOpenRevision,
    moduleVisit: (): number => this.controlDirectory.visitRevision(),
    foreground: (): boolean => this.appForeground,
    windowChromeActive: (): boolean => this.windowChromeActive,
    uiContext: (): UIContext => this.getUIContext(),
    verification: (): ReaderControlVerificationSession => this.controlVerification,
  };
  private readonly directoryBookmarks: ReaderControlDirectoryBookmarkPort = {
    message: (): string => this.bookmarkLoadMessage,
    read: (sourceId: string, bookId: string, current: () => boolean): Promise<void> =>
      this.onLoadControlBookmarks(sourceId, bookId, current),
    publishFailed: (failed: boolean): void => this.publishChromeState({ controlBookmarkLoadFailed: failed }),
    reconcileChangedMarkers: (): void => {
      this.readerBookmark.onDirectoryChanged();
      if (this.turnRuntime.usesBookTurnSimulation() && this.turnRuntime.inputPhase() === 'idle') {
        this.turnRuntime.presentation.texture.invalidate(true); this.turnRuntime.presentation.texture.schedule();
      }
    },
  };
  private readonly directoryActions: ReaderControlDirectoryActionsPort = {
    gateway: (): ReadingSessionFlowGateway => this.mountHost.activeGateway(),
    yieldPrefetchForDownload: (): void => this.playback.reportPrefetch(false, true),
    downloadBook: (): void => this.onDownloadBook(),
    downloadChapter: (chapter: number): void => this.onDownloadChapter(chapter),
    clearChapterEndTimer: (): void => this.speech.clearTtsChapterEndTimer(),
    prepareSelection: (request: ReaderDeferredChapterSelection): boolean => this.routeSelection.prepareChapterSelectionRequest(request),
    queueOnSettlement: (request: ReaderDeferredChapterSelection): boolean => this.routeSelection.queueChapterSelectionOnSettlement(request),
    interruptPlayback: (stopTts: boolean): void => this.speech.interruptForContentChange(stopTts),
    loadSelection: (request: ReaderDeferredChapterSelection, lifecycle: number, selection: number): void =>
      this.routeSelection.loadAdmittedChapterSelection(request, lifecycle, selection),
    closeControl: (): void => this.controlInteraction.hideControl(),
    reopenRefreshed: (ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
      context: RemoteReadingPositionContext): Promise<void> => this.acquisition.openChapter(stored.chapterIndex, false,
      ticket.lifecycleToken, ticket.selectionToken, stored.chapterOffset, undefined, false, context),
  };
  private readonly directoryDisplay: ReaderControlDirectoryDisplayPort = {
    visiblePage: (): PhysicalReadingPage | undefined => this.measuredPage.page,
    committed: (): ReadingCommit | undefined => this.exitProgress.committed,
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    visibleScalar: (): number => this.surface.continuousVisibleScalar,
    pageToken: (): number => this.measuredPage.selection,
    materializedToken: (): number => this.measuredPage.materializedChapterSelectionToken,
    materializedCurrent: (): boolean => this.routeSelection.hasCurrentMaterializedChapter(),
    captureMaterialized: (): ReaderMaterializedChapterContext => this.measuredPage.captureMaterializedChapterContext(),
    preparationOrigin: (): ReaderMaterializedChapterContext | undefined =>
      this.turnRuntime.preparation.pending?.origin ?? this.measuredPage.previousChapterMeasurement?.origin,
    preparedChapter: (): ReadingSessionChapter | undefined => this.turnRuntime.preparation.pending?.origin.chapter,
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    stablePage: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      this.routeSelection.isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    chapterCommitted: (chapter: number, title: string): void => this.onChapterCommitted(chapter, title),
    presentationReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number): boolean =>
      this.chapterPresentation.notifyReadingPresentationReady(chapter, page, selection, lifecycle),
    finishTrace: (lifecycle: number): void => this.mountHost.hydration.finishTrace(lifecycle),
    beginRetainedFailure: (ticket: ReaderControlSelectionTicket): void =>
      this.chapterPresentation.beginRetainedChapterPresentation(ticket.targetChapterIndex, ticket.lifecycleToken, ticket.selectionToken, false, undefined, undefined, true),
    resetAfterSelectionFailure: (): void => this.acquisition.resetForChapterSelection(),
    invalidateUnverifiedDisplay: (): void => {
      this.chapterPresentation.clearChapterPresentation(); this.exitProgress.clearCommitted(); this.publishPresentationPhase('failed');
    },
    publishFailure: (code: string, hint: (admittedCode: string) => string): void => {
      this.publishOverlayState({ failureCode: code });
      this.publishOverlayState({ failureHint: hint(this.overlayState.failureCode) });
    },
    retireFailedTurn: (): void => this.turnRuntime.finishPerformance('failed'),
    showRecovery: (message: string, label: string, retry: () => void): void => this.recovery.show(message, label, retry),
    restoreVerified: (display: ReaderControlSelectionDisplay, stored: ReaderControlSelectionStoredProgress): void =>
      this.routeSelection.restoreVerifiedControlSelection(display, stored),
    releaseImages: (): void => this.imageResidency.releaseUnretainedReadingImages(),
  };
  private readonly directoryOps: ReaderControlDirectoryOperationsHost = new ReaderControlDirectoryOperationsHost(this.directoryData,
    this.directoryScope, this.directoryBookmarks, this.directoryActions, this.directoryDisplay, this.transientFeedback);

  private readonly firstPageNative: ReaderMeasuredPageAdmissionNative = {
    measurementCoordinator: this.measuredPage.measurementCoordinator,
    isMeasurementCurrent: (generation: number, selection: number, lifecycle: number): boolean =>
      this.measuredPage.isMeasurementCurrent(generation, selection, lifecycle),
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    captureMeasuredPage: (): ReaderMeasuredPageAdmissionFacts => ({
      layout: this.documentIndex.coreLayout(), chapter: this.measuredPage.requireChapter(), scalarCount: this.measuredPage.requireChapterLayoutMap().scalarCount(),
    }),
    captureMaterializedChapter: (): ReaderMaterializedChapterContext => this.measuredPage.captureMaterializedChapterContext(),
    currentPage: (): ReaderMeasuredPageVisibility => ({
      page: this.measuredPage.page, visibleSelection: this.measuredPage.selection, chapter: this.measuredPage.chapter,
      preparationOrigin: this.turnRuntime.preparation.pending?.origin.chapter,
    }),
    hasVisibleBody: (): boolean => this.pageTurnProjection.visibleFragments.length > 0,
    publishPhysicalPage: (page: PhysicalReadingPage, lifecycle: number, selection: number): void =>
      this.measuredPage.publishFirstPage(page, lifecycle, selection, this.firstPageSurfacePublication),
    setMeasuredPosition: (offset: number, progress: number): void => {
      this.measuredPage.desiredChapterOffset = offset; this.measuredPage.desiredChapterProgress = progress;
    },
    finishMeasurement: (): void => this.measuredPage.physicalPagination.index.finishMeasurement(),
    releaseCompleting: (): void => { this.measuredPage.measurementCompleting = false; },
    resumeDeferredMeasurement: (lifecycle: number): void => this.measuredPage.resumeDeferredMeasurement(lifecycle),
  };
  private readonly firstPageView: ReaderMeasuredPageAdmissionView = {
    bookId: (): string => this.bookId,
    selectionToken: (): number => this.chapterSelectionToken,
    isReaderIdentityCurrent: (): boolean => this.isReaderIdentityCurrent?.() !== false,
    sourceSwitchRequested: (): boolean => this.sourceSwitchTransactionId !== undefined,
    navigationMode: (): ReaderNavigationMode => this.chromeState.readerSettingsSnapshot.navigationMode,
    canRemeasurePresentedPage: (): boolean => this.sessionStatus.phase === 'ready' && !this.sessionStatus.exitRequested,
    publishReadyPhase: (): void => this.publishPresentationPhase('ready'),
    publishTitleVisibility: (start: number): void => this.publishChromeState({ showChapterTitle: this.measuredPage.isChapterFirstPageStart(start) }),
    publishTitle: (title: string): void => this.publishChromeState({ chapterTitle: title }),
    refreshPageProvider: (): void =>
      this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
    fail: (error: Error, lifecycle: number): void => this.recovery.fail(error, lifecycle),
  };
  private readonly firstPageFlow: ReaderMeasuredPageAdmissionFlow = {
    captureProgressIntent: (chapter: ReadingSessionChapter, anchor: LocalReadingAnchor, layout: CoreReadingLayout,
      owner: () => boolean, current: () => boolean, publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent =>
      this.readingProgress.progressProducerIntent(chapter, anchor, layout, owner, current, publish),
    admitCommittedProgress: (stored: ReadingSessionCommittedProgress): void => this.readingProgress.admitCommittedProgress(stored),
    directoryProof: (chapter: ReadingSessionChapter, selection: number): ReaderDirectoryTargetProof | undefined =>
      this.acquisition.directoryProofForProgress(chapter, selection),
    acknowledgeDirectoryProof: (selection: number, proof: ReaderDirectoryTargetProof, bookId: string, index: number): void =>
      this.acquisition.acknowledgeDirectoryProof(selection, proof, bookId, index),
    admitRetainedSpeechCommit: (): void => this.chapterPresentation.admitTtsCommit(),
    beginReadingRecord: (lifecycle: number): void => this.beginReadingRecordClock(lifecycle),
    finishPageTurnPerf: (outcome: 'presented' | 'committed'): void => this.turnRuntime.finishPerformance(outcome),
    notifyPresentationReady: (first: ReaderMeasuredFirstPage): boolean =>
      this.chapterPresentation.notifyReadingPresentationReady(first.chapter, first.page, first.selectionToken, first.lifecycleToken),
    notifyControlReadingReady: (first: ReaderMeasuredFirstPage): boolean =>
      this.directoryOps.notifyReadingReady(first.chapter.chapterIndex, first.chapter.chapterTitle, first.page, first.selectionToken, first.lifecycleToken),
    completeControlSelection: (stored: ReadingSessionCommittedProgress, first: ReaderMeasuredFirstPage): void =>
      this.directoryOps.completeAfterCommit(stored, first.page, first.selectionToken, first.lifecycleToken),
    prepareNextPageTurn: (): void => this.turnRuntime.preparation.schedule(),
    prefetchNextChapter: (first: ReaderMeasuredFirstPage): void =>
      this.acquisition.prefetchNextChapter(first.chapter, first.lifecycleToken, first.selectionToken),
    completeRapidTurn: (): void => this.turnRuntime.pageTurn.completeRapid(),
    drainRapidTurn: (): void => { this.turnRuntime.input.drain(); },
    notifyAutomaticPageCommit: (): void => this.playback.auto.pageCommitted(),
  };
  private readonly firstPageAdmission: ReaderReadingMeasurementAdmissionHost = new ReaderReadingMeasurementAdmissionHost(this.mountHost,
    this.firstPageNative, this.firstPageView, this.firstPageFlow, this.directoryOps.selection, this.progressProducers);
  /** Prevents a late Settings load from replacing a newer in-session choice. */
  /** The selection token that owns `chapter` and its layout map. */
  /** The selection token that owns the currently mounted hidden measurement tree. */
  private readonly bookmarkPorts: ReaderBookmarkInteractionPorts = {
    scope: (): ReaderBookmarkScope => ({ sourceId: this.sourceId, bookId: this.bookId, lifecycle: this.mountHost.lifecycleToken,
      selection: this.chapterSelectionToken, mounted: this.sessionStatus.mounted, exitRequested: this.sessionStatus.exitRequested }),
    pointer: (): ReaderBookmarkPointer => ({ epoch: this.turnRuntime.input.pointerEpoch, inputRevision: this.pageTurnProjection.pageTurnInputRevision }),
    viewport: (): ReaderBookmarkViewport | undefined => this.currentBookmarkViewport(),
    chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    layoutMap: (): ReadingSurfaceLayoutMap | undefined => this.measuredPage.chapterLayoutMap,
    directory: (): LocalReadingTocEntry[] => this.directoryOps.entries(),
    recovery: (): ReadingDirectoryRecovery => this.bookmarkRecovery,
    dispatch: (request: ReaderPageBookmarkToggleRequest): void => this.onTogglePageBookmark(request),
    interactionEnabled: (): boolean => this.controlInteraction.isReaderPageInteractionEnabled(),
    canTurnPage: (): boolean => this.turnRuntime.canTurnPage(),
    tapOnlyInput: (): boolean => this.turnRuntime.tapOnlyInput(),
    yieldSpeculativePage: (): void => {
      if (this.measuredPage.adjacentMeasurementContext !== undefined && this.controlInteraction.isReaderPageInteractionEnabled() &&
        !this.turnRuntime.tapOnlyInput()) this.turnRuntime.preparation.suspend();
    },
    finishGesture: (finish: ReaderBookmarkGestureFinish): void => this.finishBookmarkGestureInArena(finish),
    pageTurnDisplaced: (): boolean => this.pageTurnProjection.pageTurnOffsetX !== 0 || this.pageTurnProjection.pageTurnDirection !== undefined,
    uiContext: (): UIContext => this.getUIContext(),
    layout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
    geometry: (): ReaderPageGeometryHost => this.readingViewport.geometry,
    chrome: (): ReaderBookmarkChrome => ({ settings: this.chromeState.readerSettingsSnapshot,
      bookTitle: this.bookTitle, clockText: this.chromeState.pageChromeClockText }),
    theme: (): ReaderAppearanceTheme => this.readingViewport.visibleReadingAppearance().activeTheme,
    reduceMotion: (): boolean => this.reduceMotion,
    feedbackCurrent: (): boolean => this.mountHost.isSessionActive(this.mountHost.lifecycleToken) && this.appForeground && this.windowChromeActive,
    projection: (): ReaderBookmarkRenderProjection => this.pageTurnProjection,
    publishProjection: (update: ReaderBookmarkProjectionUpdate): void => this.publishPageTurnProjection({
      bookmarkPageOffsetY: update.bookmarkPageOffsetY,
      bookmarkRibbonFrame: update.bookmarkRibbonFrame === undefined ? undefined : { value: update.bookmarkRibbonFrame.value },
      bookmarkPullHintOpacity: update.bookmarkPullHintOpacity,
      bookmarkPreviewChanged: update.bookmarkPreviewChanged,
      bookmarkPendingTarget: update.bookmarkPendingTarget,
      bookmarkPresentationRevision: update.bookmarkPresentationRevision,
    }),
    unavailableMessage: (): string => this.overlayState.bookmarkUnavailableMessage,
    publishUnavailableMessage: (message: string): void => this.publishOverlayState({ bookmarkUnavailableMessage: message }),
  };
  private readonly readerBookmark: ReaderBookmarkInteractionHost =
    new ReaderBookmarkInteractionHost(this.bookmarkPorts, this.transientFeedback);

  private finishBookmarkGestureInArena(finish: ReaderBookmarkGestureFinish): void {
    if (finish === 'stale') {
      if (!this.sessionStatus.mounted || this.turnRuntime.pageTurn.gesture.owner !== 'bookmark') return;
      this.turnRuntime.pageTurn.gesture = createReaderPageGestureState();
      this.publishPageTurnProjection({ pageTurnInputOwned: false });
      this.turnRuntime.presentation.phase = 'idle';
      this.pageChrome.flushDeferred();
      if (this.turnRuntime.pageTurn.exitPending) this.turnRuntime.settlement.resumeDeferred();
      return;
    }
    if (this.turnRuntime.usesBookTurnSimulation() && this.turnRuntime.inputPhase() === 'idle') {
      this.turnRuntime.presentation.texture.invalidate(true);
      this.turnRuntime.presentation.texture.schedule();
    }
    if (this.turnRuntime.pageTurn.gesture.owner !== 'bookmark') return;
    this.turnRuntime.pageTurn.gesture = completeReaderPageGestureSettlement(this.turnRuntime.pageTurn.gesture);
    this.publishPageTurnProjection({ pageTurnInputOwned: false });
    this.turnRuntime.presentation.phase = 'idle';
    this.pageChrome.flushDeferred();
    if (this.turnRuntime.pageTurn.exitPending) {
      this.turnRuntime.settlement.resumeDeferred();
      return;
    }
    if (this.appForeground && !this.sessionStatus.exitRequested) this.turnRuntime.preparation.drain();
  }

  private readonly textSelectionActivity: ReaderTextSelectionActivity = new ReaderTextSelectionActivity();
  private quoteShareGeneration: number = 0;
  private readonly quoteCardAction: ReaderQuoteCardAction = (text: string, anchor: string, selectionCurrent: () => boolean) => {
    const generation = ++this.quoteShareGeneration;
    const selection = this.chapterSelectionToken;
    const current = (): boolean => generation === this.quoteShareGeneration &&
      selection === this.chapterSelectionToken && this.inputDevices.textSelectionEnabled() && selectionCurrent();
    const title = this.bookTitle;
    const author = this.bookAuthor;
    const appearance = this.readingViewport.visibleReadingAppearance();
    const actions = readerSystemShareActions(() => this.getUIContext(), anchor);
    return actions.shareQuoteCard(text, title,
      (): Promise<ReaderQuoteCardCopy | undefined> => exportReaderQuoteCard(this.getUIContext(), text, title, author, appearance, current),
      current);
  };
  private readonly readingRecordHost: ReaderReadingRecordHost = new ReaderReadingRecordHost(
    this.readingRecordGateway, (): string => this.bookTitle.trim().length > 0 ? this.bookTitle.trim() : this.bookId,
    (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s', `Reading duration: ${this.errorMessage(error)}`));
  /** Layout facts admitted for the last window-metrics revision. */

  private readonly speechSession: ReaderReadingSpeechSession = {
    scope: (): ReaderTtsPlaybackScope => ({ lifecycleToken: this.mountHost.lifecycleToken, selectionToken: this.chapterSelectionToken,
      sourceId: this.sourceId, bookId: this.bookId }),
    uiContext: (): UIContext => this.getUIContext(),
    mounted: (): boolean => this.sessionStatus.mounted,
    mountedToken: (lifecycle: number): boolean => this.mountHost.isMountedToken(lifecycle),
    active: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    foreground: (): boolean => this.appForeground,
    progressAllowed: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle) ||
      (this.sessionStatus.exitRequested && this.mountHost.isMountedToken(lifecycle) && this.isReaderIdentityCurrent?.() !== false),
  };
  private readonly speechView: ReaderReadingSpeechView = {
    publish: (presentation: ReaderReadingSpeechPresentation): void => this.publishSpeechPresentation(presentation),
    applyWindowPolicy: (): Promise<void> =>
      this.preferences.applyReaderWindowPolicy(this.chromeState.readerSettingsSnapshot, this.controlsPresentedForWindow()),
    observePrefetch: (): void => this.playback.reportPrefetch(),
    followPage: (state: ReaderTtsState): void => this.playback.offerTts(state),
    retirePageFollow: (): void => this.playback.invalidateTtsFollow(),
  };
  private readonly speechProgress: ReaderReadingSpeechProgress = {
    chapter: (): ReadingSessionChapter | undefined => this.measuredPage.chapter,
    scalarCount: (): number => this.measuredPage.requireChapterLayoutMap().scalarCount(),
    layout: (): LocalReadingLayout => this.documentIndex.coreLayout(),
    intent: (chapter: ReadingSessionChapter, anchor: CoreReadingAnchor, layout: LocalReadingLayout,
      current: () => boolean, publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent =>
      this.readingProgress.progressProducerIntent(chapter, anchor, layout, current, current, publish),
    commit: (intent: ReaderProgressProducerIntent): Promise<void> => this.progressProducers.commitTts(intent),
    admit: (stored: LocalReadingProgress): void => this.readingProgress.admitCommittedProgress(stored),
    accepted: (): ReadingCommit | undefined => this.exitProgress.committed,
  };
  private readonly speechChapter: ReaderReadingSpeechChapter = {
    startPage: (): ReaderTtsStartPage | undefined => this.ttsStartPage(),
    materializedContentVersion: (): string => this.measuredPage.materializedContentVersion,
    hydrateEntry: (chapter: ReadingSessionChapter): Promise<void> => this.mountHost.hydration.expandWindow(chapter),
    window: (): ReadingChapterWindow => this.chapterWindow,
    captureAdvanceSelection: (state: ReaderTtsState): ReaderReadingSpeechAdvanceSelection => {
      const owner = this.playback.ttsLease(state);
      return {
        sessionGeneration: owner.sessionGeneration, positionGeneration: owner.positionGeneration,
        isCurrent: (): boolean => this.playback.isTtsFollowCurrent(owner),
        select: (target: number, offset: number): void => {
          this.directoryOps.selectAnchor(target, offset, offset === 0, false, undefined, -1, false, false, undefined, owner);
        },
      };
    },
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    hydrateCatalogForNext: (chapterIndex: number): Promise<void> | undefined =>
      this.turnRuntime.input.isUnknownCatalogEdge(chapterIndex, 'next') ? this.mountHost.hydration.hydrateCatalog() : undefined,
    nextChapterIndex: (chapterIndex: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapterIndex, 1),
    load: (target: number, current: () => boolean): Promise<ReadingSessionChapter> =>
      this.mountHost.activeGateway().loadChapter(this.bookId, target, current),
    admitContentVersion: (chapter: ReadingSessionChapter): void => this.documentIndex.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion),
  };
  private readonly speechControls: ReaderReadingSpeechControls = {
    capsule: {
    capture: (): ReaderControlPlaybackPresentation => this.captureControlPlaybackPresentation(),
    beginForStart: (): boolean => this.beginTtsStartCapsule(),
    beginForResume: (presentation: ReaderControlPlaybackPresentation): boolean | undefined =>
      this.isControlPlaybackPresentationCurrent(presentation, 'tts') ? !this.auxiliarySession.beginSessionCapsuleMorph('tts') : undefined,
    pauseWitness: (): ReaderTtsPauseWitness | undefined => this.captureTtsPauseWitness(),
    desiredPlaying: (): boolean => this.overlayState.sessionLaunch?.geometry.type === 'tts' ? this.overlayState.sessionLaunch.desiredPlaying : true,
    timing: (): ReaderTtsCapsuleTiming | undefined => this.capsuleVerification.ttsTiming(this.overlayState.sessionLaunch?.generation),
    showStatic: (presentation: ReaderControlPlaybackPresentation): void => this.showAcknowledgedStaticTtsCapsule(presentation),
    observeStart: (): void => this.onSessionLaunchTtsState(this.sessionStatus.ttsState),
    fail: (): void => this.auxiliarySession.cancel('failure'),
  },
    inputAllowed: (): boolean => this.controlInteraction.readerInputIsCurrent() && !this.windowChromeOverlayActive,
    controlVisible: (): boolean => this.controlInteraction.controlVisible(),
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    chromeOverlayActive: (): boolean => this.windowChromeOverlayActive,
    preferenceModule: (): string => this.readerPreferenceModule(),
    openTtsConfiguration: (): void => {
      this.controlInteraction.openReaderControl();
      this.controlInteraction.setControlPage('moduleTts');
    },
    onSpeechState: (state: ReaderTtsState): void => this.onSessionLaunchTtsState(state),
    retireBlockedStarts: (): void => this.playback.retirePendingStarts(),
    retireSpeechCapsule: (): void => {
      this.auxiliarySession.clearStaticCapsuleOrigin('tts');
      if (this.overlayState.sessionLaunch?.geometry.type === 'tts') this.auxiliarySession.cancel('stop');
    },
    autoPageActive: (): boolean => this.playback.automaticState().status !== 'stopped',
    cancelAutoPageStart: (): void => this.playback.auto.cancelStart(),
    pauseAutoPage: (): void => this.playback.pauseAutoPage('manual'),
    stopAutoPage: (): void => this.playback.stopAutoPage(),
  };
  private readonly speech: ReaderReadingSpeechHost = new ReaderReadingSpeechHost(this.transientFeedback,
    this.speechSession, this.speechView, this.speechProgress, this.speechChapter, this.speechControls);

  private publishSpeechPresentation(presentation: ReaderReadingSpeechPresentation): void {
    this.publishSessionStatus({
      ttsState: presentation.ttsState, ttsTimerMode: presentation.ttsTimerMode,
      ttsTimerMinutes: presentation.ttsTimerMinutes, ttsTimerSeconds: presentation.ttsTimerSeconds,
      ttsFollowHighlight: presentation.ttsFollowHighlight, ttsPauseOnInterruption: presentation.ttsPauseOnInterruption,
      ttsAllowMixing: presentation.ttsAllowMixing, ttsBackgroundPlayback: presentation.ttsBackgroundPlayback,
      ttsKeepScreenOn: presentation.ttsKeepScreenOn, ttsFailurePolicy: presentation.ttsFailurePolicy,
      ttsEngine: presentation.ttsEngine, ttsHttpEngines: presentation.ttsHttpEngines,
      ttsVoiceOptions: presentation.ttsVoiceOptions, ttsLanguage: presentation.ttsLanguage, ttsPerson: presentation.ttsPerson,
    });
    this.publishOverlayState({
      ttsPreferencesRecovery: presentation.ttsPreferencesRecovery, ttsPreferencesRecoveryBusy: presentation.ttsPreferencesRecoveryBusy,
      ttsConfigurationLoading: presentation.ttsConfigurationLoading, ttsConfigurationLoadFailed: presentation.ttsConfigurationLoadFailed,
      ttsConfigurationRecovery: presentation.ttsConfigurationRecovery,
    });
  }

  private readonly readingProgressOwners: ReaderReadingProgressOwners = {
    progress: this.exitProgress, mount: this.mountHost, measured: this.measuredPage, surface: this.surface,
    speech: this.speech, turn: this.turnRuntime.settlement, turnInput: this.turnRuntime.input, bookmark: this.readerBookmark,
    autoPage: this.playback.auto, auxiliary: this.auxiliarySession, record: this.readingRecordHost,
    recordGateway: this.readingRecordGateway, recovery: this.recovery, controlVerification: this.controlVerification,
  };
  private readonly readingProgressView: ReaderReadingProgressView = {
    identity: (): ReadingProgressIdentity => ({ sourceId: this.sourceId, bookId: this.bookId }),
    ready: (): boolean => this.sessionStatus.phase === 'ready',
    currentSelection: (): number => this.chapterSelectionToken,
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    layout: (): LocalReadingLayout => this.documentIndex.coreLayout(),
    mayRenewRetainedVisit: (): boolean => this.appForeground && this.windowChromeActive && this.isReaderIdentityCurrent?.() !== false,
    exitRequested: (): boolean => this.sessionStatus.exitRequested,
    settlementActive: (): boolean => this.pageTurnProjection.pageTurnSettlementActive,
    publishCommit: (commit: ReadingCommit): void => this.onReadingCommitted(commit),
  };
  private readonly readingExitEffects: ReaderReadingExitEffects = {
    markRequested: (): void => { this.publishSessionStatus({ exitRequested: true }); },
    observePrefetch: (): void => this.playback.reportPrefetch(),
    rollbackUncommittedTurn: (): boolean => this.turnRuntime.rollbackUncommittedBookTurnSettlement(),
    releaseTurnRecoveryInput: (): void => this.turnRuntime.releaseRecoveryInput(),
    retireCapsuleOrigin: (): void => { this.auxiliarySession.clearStaticCapsuleOrigin(); },
    exit: (): void => this.onExit(),
  };
  private readonly readingBackControls: ReaderReadingBackControls = {
    visible: (): boolean => this.controlInteraction.controlVisible(),
    cancelPendingNavigation: (): boolean => this.controlInteraction.cancelControlNavigationIntent(),
    invalidateBackdrop: (): void => this.controlGeometry.invalidateBackdrop(),
    consumeKeyboard: (): boolean => this.controlGeometry.consumeKeyboardBack(),
    consumeTemporaryBack: (report: () => void): boolean => this.controlGeometry.consumeTemporaryBack(report),
    visualSession: (): ReaderControlSessionState => this.controlDirectory.visualSession(),
    timing: (): ReaderControlHostTiming => this.controlInteraction.controlTiming(),
    requestBackSession: (session: ReaderControlSessionState): void => this.controlInteraction.requestControlSession(session, 'system-back'),
  };
  private readonly readingProgress: ReaderReadingProgressHost = new ReaderReadingProgressHost(this.readingProgressOwners,
    this.readingProgressView, this.readingExitEffects, this.readingBackControls);

  private readonly pageChromeDocument: ReaderPageChromeDocument = {
    measured: (): ReaderMeasuredPagePublication => this.measuredPage,
    preparedOrigin: (): ReaderMaterializedChapterContext | undefined => this.turnRuntime.preparation.pending?.origin,
    retained: (): ReaderRetainedChapterFrame | undefined => this.chapterPresentation.retainedChapterFrame(),
    captureMaterialized: (): ReaderMaterializedChapterContext => this.measuredPage.captureMaterializedChapterContext(),
    preparedIsFresh: (prepared: PreparedReaderPageTurn): boolean => this.turnRuntime.input.preparedIsFresh(prepared),
    catalogPending: (): boolean => this.mountHost.entryCatalogPending,
    continuousCatalog: (): ReaderContinuousChromeCatalogWitness => ({ toc: this.chromeState.tocEntries,
      revision: this.directoryOps.sourceRevision(), navigation: this.mountHost.entryCatalogNavigation }),
    catalogCount: (): number | undefined => this.mountHost.entryCatalogNavigation?.readableChapterCount,
    toc: (): LocalReadingTocEntry[] => this.documentIndex.readingTocEntries(),
    tocEntryAt: (chapter: number): LocalReadingTocEntry | undefined => this.documentIndex.tocEntryAt(chapter),
    readablePosition: (chapter: number): number => this.documentIndex.readableChapterPosition(chapter),
    adjacentChapter: (chapter: number): number | undefined => this.documentIndex.adjacentChapterIndex(chapter, 1),
    chapterInWindow: (chapter: number): ReadingSessionChapter | undefined => this.chapterWindow.get(chapter),
    metrics: (): LocalReadingContentMetrics | undefined => this.sessionStatus.contentMetrics,
    metricsPercent: (metrics: LocalReadingContentMetrics, chapter: number, scalar: number): number =>
      this.acquisition.metricsPercent(metrics, chapter, scalar),
  };
  private readonly pageChromeView: ReaderPageChromeView = {
    sourceId: (): string => this.sourceId,
    bookId: (): string => this.bookId,
    bookTitle: (): string => this.bookTitle,
    sessionActive: (lifecycle: number): boolean => this.mountHost.isSessionActive(lifecycle),
    settlement: (): ReaderPageTurnSettlementHost => this.turnRuntime.settlement,
    bookmark: (): ReaderBookmarkInteractionHost => this.readerBookmark,
    chrome: (): ReadingChromeRenderSnapshot => this.chromeState,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    layout: (): ReaderReadingLayoutSnapshot => this.readingViewport.readingLayout(),
    layoutSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    visibleAppearance: (): ReaderAppearanceSnapshot => this.readingViewport.visibleReadingAppearance(),
    appearanceAtPage: (page: PhysicalReadingPage): ReaderAppearanceSnapshot => this.readingViewport.pageReadingAppearance(page),
    continuousChrome: (): ReaderPageChromeSnapshot | undefined => this.surface.hasContinuousRenderContent() ?
      this.surface.continuousPageChromeSnapshot(this.pageTurnProjection.continuousRenderRevision, this.chromeState.continuousChromeProgressText) : undefined,
    launchInProgress: (): boolean => this.overlayState.sessionLaunch !== undefined,
    capsuleVisible: (): boolean => this.auxiliarySession.shouldShowSessionCapsule(),
    capsuleWidth: (): number => this.auxiliarySession.activeSessionCapsuleWidth(),
    capsuleHeight: (): number => this.auxiliarySession.activeSessionCapsuleHeight(),
  };
  private readonly pageChromeEffects: ReaderPageChromeEffects = {
    publishClock: (text: string): void => this.publishChromeState({ pageChromeClockText: text }),
    advanceRenderRevision: (): void =>
      this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
    scheduleTextures: (): void => this.turnRuntime.presentation.texture.schedule(),
    flushReadingImagePixels: (): void => this.imageResidency.flushDeferredReadingImagePixels(),
    clearCapsuleFreeze: (): void => this.turnRuntime.input.clearCapsule(),
    flushCapsuleMeasurement: (): void => this.auxiliarySession.flushCapsuleMeasurement(),
  };
  private readonly pageChrome: ReaderReadingPageChromeHost = new ReaderReadingPageChromeHost(
    this.pageChromeDocument, this.pageChromeView, this.pageChromeEffects);

  private readonly chapterPresentationLifetime: ReaderReadingChapterPresentationLifetime = {
    scope: (): ReaderReadingChapterPresentationScope => ({
      lifecycleToken: this.mountHost.lifecycleToken, selectionToken: this.chapterSelectionToken,
    }),
    selectionActive: (lifecycle: number, selection: number): boolean => this.mountHost.isSelectionActive(lifecycle, selection),
    mounted: (): boolean => this.sessionStatus.mounted,
    exiting: (): boolean => this.sessionStatus.exitRequested,
  };
  private readonly chapterPresentationView: ReaderReadingChapterPresentationView = {
    currentChapterIndex: (): number => this.currentChapterIndex(),
    localSource: (): boolean => this.sourceId === LOCAL_READING_SOURCE_ID,
    captureRetained: (): ReaderRetainedChapterFrame | undefined => this.pageChrome.captureRetained(),
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    loadingPermitted: (): boolean => this.windowChromeActive && this.sessionStatus.phase !== 'failed' &&
      this.sourceSwitchFailureMessage.length === 0 && !this.sourceSwitchOverlay.shouldShowPreparation() &&
      !(this.directoryOps.selection.ticket?.closeOnCommit === false && this.controlInteraction.controlVisible()) &&
      !(this.measuredPage.page !== undefined && this.measuredPage.selection === this.chapterSelectionToken),
    observeRevision: (): void => { this.pageTurnProjection.chapterPresentationRevision; },
    publishRevision: (): void =>
      this.publishPageTurnProjection({ chapterPresentationRevision: this.pageTurnProjection.chapterPresentationRevision + 1 }),
  };
  private readonly chapterPresentationSpeech: ReaderReadingChapterPresentationSpeech = {
    offset: (): number | undefined => this.sessionStatus.ttsState.charStart,
    followHighlight: (): boolean => this.sessionStatus.ttsFollowHighlight,
    owns: (lease: ReaderTtsFollowLease): boolean => this.playback.holdsTtsLease(lease),
    matchesMaterializedChapter: (): boolean => this.sessionStatus.ttsState.chapterIndex === this.measuredPage.chapter?.chapterIndex &&
      this.sessionStatus.ttsState.contentVersion === this.measuredPage.materializedContentVersion,
    retireAbandonedSelection: (): void => {
      this.chapterSelectionToken += 1;
      this.directoryOps.selection.reset();
      this.acquisition.resetForChapterSelection(false, true, true);
    },
    restoreOrigin: (frame: ReaderRetainedChapterFrame): void => {
      this.measuredPage.restoreMaterializedChapterContext(frame.context, true);
      this.measuredPage.admit(frame.page, this.chapterSelectionToken);
      this.publishPageTurnProjection({ visibleFragments: frame.page.fragments });
      this.publishPresentationPhase('ready');
      this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 });
    },
    prepareTurn: (): void => this.turnRuntime.preparation.schedule(),
  };
  private readonly chapterPresentationReady: ReaderReadingChapterPresentationReady = {
    current: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      this.sessionStatus.phase === 'ready' && this.routeSelection.isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    resolveImages: (chapter: ReadingSessionChapter, page: PhysicalReadingPage): void => this.imageResidency.resolvePageImagePixels(chapter, page.fragments),
    traceReady: (lifecycle: number): void => this.traceInitialReadingPhase('ready-deliver', lifecycle),
    scheduleCatalog: (): void => this.mountHost.hydration.scheduleCatalog(),
    settlePresentationRecovery: (): void => this.recovery.settle('presentation'),
    onReadingReady: (chapter: number): void => this.onReadingReady(chapter),
    observePrefetch: (): void => this.playback.reportPrefetch(),
    prepareCatalogNearEnd: (): void => this.mountHost.prepareRemoteCatalogNearEnd(),
    clearTtsPositioning: (): void => this.playback.clearTtsPositioning(),
    scheduleTtsFollowResume: (): void => this.playback.scheduleTtsFollow(),
    scheduleTtsWarmup: (): void => this.speech.scheduleTtsPresentationWarmup(),
  };
  private readonly chapterPresentation: ReaderReadingChapterPresentationHost = new ReaderReadingChapterPresentationHost(
    this.chapterWindow, this.chapterPresentationLifetime, this.chapterPresentationView, this.chapterPresentationSpeech,
    this.chapterPresentationReady);

  private readonly viewportView: ReaderReadingViewportView = {
    scope: (): ReaderReadingViewportScope => ({ sourceId: this.sourceId, bookId: this.bookId }),
    chrome: (): ReadingChromeRenderSnapshot => this.chromeState,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    phase: (): ReadingPhase => this.sessionStatus.phase,
    lifecycle: (): number => this.mountHost.lifecycleToken,
    expanded: (): boolean => this.expandedLayout,
    paneWidth: (): number => this.paneWidthHint,
    paneHeight: (): number => this.paneHeightHint,
    bookTitle: (): string => this.bookTitle,
    context: (): UIContext => this.getUIContext(),
    observeWindowMetrics: (): void => { this.readerWindowMetricsRevision; },
    paginationSignature: (): string => this.documentIndex.paginationLayoutSignature(),
    hasCurrentChapter: (): boolean => this.routeSelection.hasCurrentMaterializedChapter(),
  };
  private readonly viewportEffects: ReaderReadingViewportEffects = {
    measured: (): ReaderMeasuredPagePublication => this.measuredPage,
    runtime: (): ReaderPageTurnRuntimeHost => this.turnRuntime,
    surface: (): ReaderReadingSurfaceHost => this.surface,
    preferences: (): ReaderReadingPreferencesHost => this.preferences,
    auxiliary: (): ReaderAuxiliarySessionHost => this.auxiliarySession,
    publishChrome: (update: ReadingChromeRenderUpdate): void => this.publishChromeState(update),
    publishTurn: (update: ReadingPageTurnRenderUpdate): void => this.publishPageTurnProjection(update),
  };
  private readonly readingViewport: ReaderReadingViewportHost = new ReaderReadingViewportHost(this.viewportView, this.viewportEffects);

  private readonly imageOwners: ReaderReadingImageResidencyOwners = {
    measured: this.measuredPage, mount: this.mountHost, surface: this.surface, window: this.chapterWindow,
    turn: this.turnRuntime.settlement, turnPresentation: this.turnRuntime.presentation, directory: this.directoryOps, recovery: this.recovery,
  };
  private readonly imageView: ReaderReadingImageResidencyView = {
    scope: (): ReaderReadingImageScope => ({ sourceId: this.sourceId, bookId: this.bookId, selection: this.chapterSelectionToken }),
    continuous: (): boolean => this.chromeState.readerSettingsSnapshot.navigationMode === 'continuous',
    turnIdle: (): boolean => this.turnRuntime.inputPhase() === 'idle',
    chromeFrozen: (): boolean => this.pageChrome.frozen(),
    visibleFragments: (): ReadingSurfacePageFragment[] => this.pageTurnProjection.visibleFragments,
    readyPage: (): PhysicalReadingPage | undefined => this.chapterPresentation.readyPage,
    retainedChapter: (): ReadingSessionChapter | undefined => this.chapterPresentation.retainedChapterFrame()?.context.chapter,
    retainWindow: (): void => this.documentIndex.retainCurrentChapterWindow(),
    publishVisibleFragments: (fragments: ReadingSurfacePageFragment[]): void => this.publishPageTurnProjection({ visibleFragments: fragments }),
    publishContinuousRevision: (): void =>
      this.publishPageTurnProjection({ continuousRenderRevision: this.pageTurnProjection.continuousRenderRevision + 1 }),
    publishPageTurnRevision: (): void =>
      this.publishPageTurnProjection({ pageTurnRenderRevision: this.pageTurnProjection.pageTurnRenderRevision + 1 }),
  };
  private readonly imageResidency: ReaderReadingImageResidencyHost = new ReaderReadingImageResidencyHost(this.imageOwners, this.imageView);

  private readonly inputDeviceActors: ReaderReadingInputDeviceActors = {
    sourceSwitch: this.sourceSwitchOverlay, chapterPresentation: this.chapterPresentation,
    geometry: this.controlGeometry, recovery: this.recovery, selection: this.textSelectionActivity,
    progress: this.readingProgress, turn: this.turnRuntime, control: this.controlDirectory, directory: this.directoryOps,
    mount: this.mountHost, playback: this.playback, surface: this.surface,
  };
  private readonly inputDeviceView: ReaderReadingInputDeviceView = {
    session: (): ReadingSessionRenderSnapshot => this.sessionStatus,
    overlay: (): ReadingOverlayRenderSnapshot => this.overlayState,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    chrome: (): ReadingChromeRenderSnapshot => this.chromeState,
    foreground: (): boolean => this.appForeground,
    settings: (): ReaderSmartGestureSettings => this.smartGestureSettings,
    windowActive: (): boolean => this.windowChromeActive,
    windowOverlay: (): boolean => this.windowChromeOverlayActive,
    identityCurrent: (): boolean => this.isReaderIdentityCurrent?.() !== false,
    context: (): UIContext => this.getUIContext(),
    readerInputCurrent: (): boolean => this.controlInteraction.readerInputIsCurrent(),
    pageInputCurrent: (): boolean => this.controlInteraction.isReaderPageInteractionEnabled(),
    controlVisible: (): boolean => this.controlInteraction.controlVisible(),
    controlObscured: (): boolean => this.controlObscured,
    interactionBlocked: (): boolean => this.interactionBlocked,
    sourceSwitchVisible: (): boolean => this.sourceSwitchPresentationVisible,
    sourceSwitchFailure: (): string => this.sourceSwitchFailureMessage,
    sourceSwitchRollingBack: (): boolean => this.sourceSwitchRollbackInFlight,
    openControl: (shortcut?: 'search' | 'directory'): void => this.controlInteraction.openReaderControl(undefined, shortcut),
  };
  private readonly inputDevices: ReaderReadingInputDevices = new ReaderReadingInputDevices(this.inputDeviceActors, this.inputDeviceView);

  private readonly documentIndexView: ReaderReadingDocumentIndexView = {
    identity: (): ReaderReadingDocumentIdentity => ({ sourceId: this.sourceId, bookId: this.bookId }),
    appearance: (): ReaderAppearanceSnapshot => this.chromeState.appearanceSnapshot,
    toc: (): LocalReadingTocEntry[] => this.chromeState.tocEntries,
  };
  private readonly documentIndex: ReaderReadingDocumentIndexHost = new ReaderReadingDocumentIndexHost(
    this.chapterWindow, this.measuredPage, this.mountHost, this.readingViewport, this.imageResidency, this.documentIndexView);

  private readonly routeSelection: ReaderReadingRouteSelectionHost = new ReaderReadingRouteSelectionHost(this.chapterWindow, {
    mount: (): ReaderReadingMountHost => this.mountHost,
    directory: (): ReaderControlDirectoryOperationsHost => this.directoryOps,
    chapter: (): ReaderReadingChapterPresentationHost => this.chapterPresentation,
    acquisition: (): ReaderReadingChapterAcquisitionHost => this.acquisition,
    measured: (): ReaderMeasuredPagePublication => this.measuredPage,
    firstPage: (): ReaderReadingMeasurementAdmissionHost => this.firstPageAdmission,
    turn: (): ReaderPageTurnRuntimeHost => this.turnRuntime,
    control: (): ReaderReadingControlInteractionHost => this.controlInteraction,
    speech: (): ReaderReadingSpeechHost => this.speech,
    playback: (): ReaderReadingPlaybackFlowHost => this.playback,
    surface: (): ReaderReadingSurfaceHost => this.surface,
    progress: (): ReaderReadingProgressHost => this.readingProgress,
  }, {
    mounted: (): boolean => this.sessionStatus.mounted, exiting: (): boolean => this.sessionStatus.exitRequested,
    failed: (): boolean => this.sessionStatus.phase === 'failed',
    selection: (): number => this.chapterSelectionToken, advanceSelection: (): void => { this.chapterSelectionToken += 1; },
    settlementActive: (): boolean => this.pageTurnProjection.pageTurnSettlementActive,
    controlOpenRevision: (): number => this.chromeState.controlOpenRevision,
    publishLoadingChapter: (chapter: number): void => this.publishSessionStatus({ loadingChapterIndex: { value: chapter } }),
    publishVisibleFragments: (fragments: ReadingSurfacePageFragment[]): void => this.publishPageTurnProjection({ visibleFragments: fragments }),
    publishChapterTitle: (title: string): void => this.publishChromeState({ chapterTitle: title }),
    publishShowChapterTitle: (show: boolean): void => this.publishChromeState({ showChapterTitle: show }),
    publishReady: (): void => this.publishPresentationPhase('ready'),
  });
  private onRequestedChapterChanged(): void { this.routeSelection.requestedChapterChanged(this.requestedChapterIndex); }
  private onRequestedBookmarkAnchorChanged(): void {
    this.routeSelection.requestedBookmarkAnchorChanged(this.requestedBookmarkAnchor);
  }

  private readonly nativeMountActors: ReaderReadingNativeMountActors = {
    preferences: this.preferences, controlDirectory: this.controlDirectory, controlVerification: this.controlVerification,
    controlGeometry: this.controlGeometry, directory: this.directoryOps, turn: this.turnRuntime.presentation, settlement: this.turnRuntime.settlement,
    preparation: this.turnRuntime.preparation, measured: this.measuredPage, surface: this.surface, pageChrome: this.pageChrome,
    chapterPresentation: this.chapterPresentation, acquisition: this.acquisition, speech: this.speech, recovery: this.recovery,
    bookmark: this.readerBookmark, autoPage: this.playback.auto, auxiliary: this.auxiliarySession,
    contentMutation: this.contentMutation, producers: this.progressProducers, record: this.readingRecordHost,
    images: this.imageResidency, smartGesture: this.inputDevices.native, sourceSwitch: this.sourceSwitchOverlay,
    brightness: this.brightnessSession, search: this.quickSearchPublication, replace: this.replacePanel,
  };
  private readonly nativeMountView: ReaderReadingNativeMountView = {
    registerExit: (): (() => void) | undefined =>
      this.onExitRequestHandler((intent?: 'navigation'): void =>
        intent === 'navigation' ? this.readingProgress.beginExit() : this.readingProgress.requestExit()),
    admitInitialWindowGeometry: (): void => this.readingViewport.admitInitialWindowGeometry(),
    controlInputBoundaryChanged: (): void => this.onControlInputBoundaryChanged(),
    publishBookTurnCapability: (): void => this.publishPageTurnProjection({ bookTurnRuntimeFailed: false }),
    hideNativeTurnSurface: (): void => this.publishPageTurnProjection({ bookTurnSurfaceOpacity: 0 }),
    bindScreenLockObservation: (): void => {
      this.readingPrefetchScreenLocked = false;
      if (this.sourceId !== LOCAL_READING_SOURCE_ID && this.onReadingPrefetchActivity !== undefined) {
        this.preferences.setScreenLockObserver((locked: boolean): void => {
          this.readingPrefetchScreenLocked = locked;
          this.playback.reportPrefetch();
        });
      }
    },
    invalidatePageTurnRuntime: (disposeTextures: boolean): void => this.turnRuntime.invalidate(disposeTextures),
    windowLayout: (): ReadingWindowLayoutInput => this.readingViewport.windowMetricsLayoutInput(),
    clearExitRequest: (): void => this.publishSessionStatus({ exitRequested: false }),
    windowChromeActive: (): boolean => this.windowChromeActive,
    clearLoadingChapter: (): void => this.publishSessionStatus({ loadingChapterIndex: { value: undefined } }),
    retirePrefetch: (): void => this.playback.reportPrefetch(false, false, true),
  };

  private readonly readingStageActors: ReaderReadingStageActors = {
    surface: this.surface, bookmark: this.readerBookmark, input: this.turnRuntime.input, turn: this.turnRuntime.presentation,
    preparation: (): ReaderPageTurnPreparationHost => this.turnRuntime.preparation,
    releaseDeferredPointer: (): void => this.turnRuntime.pageTurn.releaseDeferredPointer(),
    framePresented: (revision: number): void => {
      this.turnRuntime.presentation.onFrameScheduled(revision);
      this.sourceSwitchOverlay.pagePresented(revision);
    },
    openControl: (origin: 'continuous-tap' | 'paged-tap'): void => this.controlInteraction.openReaderControl(origin),
    manualInteraction: (): void => this.playback.manualInteraction(),
    gestureDecision: (decision: ReaderPageGestureDecision): ReaderPageGestureDecision => this.onReaderPageGestureDecision(decision),
    interactionEnabled: (): boolean => this.controlInteraction.isReaderPageInteractionEnabled(),
    textSelectionEnabled: (): boolean => this.inputDevices.textSelectionEnabled(),
    inputRevision: (): number => this.pageTurnProjection.pageTurnInputRevision,
    tapOnly: (): boolean => this.turnRuntime.tapOnlyInput(),
    currentPage: (): ReaderPageTurnRenderPage => this.pageChrome.currentPage(),
    neighbourPage: (direction: ReaderPageTurnDirection): ReaderPageTurnRenderPage | undefined => this.pageChrome.preparedPage(direction),
    selectionActivity: (owner: string, active: boolean): void => this.surface.admitTextSelectionActivity(this.textSelectionActivity, owner, active),
    quoteCard: this.quoteCardAction,
  };

  aboutToAppear(): void { this.mountHost.mountNative(this.nativeMountActors, this.nativeMountView); }

  aboutToDisappear(): void { this.mountHost.unmountNative(this.nativeMountActors, this.nativeMountView); }
  private readonly mountedSceneActors: ReaderMountedReadingSceneActors = {
    stage: this.readingStageActors, surface: this.surface, viewport: this.readingViewport, input: this.inputDevices,
    controls: this.controlInteraction, controlDirectory: this.controlDirectory, controlGeometry: this.controlGeometry,
    playback: this.playback, chapterPresentation: this.chapterPresentation, pageChrome: this.pageChrome,
    sourceSwitch: this.sourceSwitchOverlay, bookmark: this.readerBookmark, turn: this.turnRuntime, recovery: this.recovery,
    capsule: this.auxiliarySession, preferences: this.preferences, speech: this.speech, mount: this.mountHost,
    progress: this.readingProgress, measured: this.measuredPage,
  };

  private readonly mountedSceneView: ReaderMountedReadingSceneView = {
    bookTurnSurfaceId: READER_BOOK_TURN_COMPONENT_ID,
    controlFrame: (): ReaderNativeControlFrameInput => this.controlFrameInput,
    controlIntent: (): ReaderControlIntentHandler => this.controlPanelIntent(),
    sessionLaunchMaterial: (): ReaderSurfaceMaterialDecision =>
      readerSurfaceMaterialDecision('sessionCapsule', this.launchNavigationPreferences, this.readerAppScheme, this.readerSystemScheme),
    preferenceModule: (): string => this.readerPreferenceModule(),
    loadingTitle: (): string => this.loadingChapterTitle(),
    scheme: (): string => this.readerAppScheme,
    reduceMotion: (): boolean => this.reduceMotion,
    windowChromeActive: (): boolean => this.windowChromeActive,
    sourceSwitchFailure: (): string => this.sourceSwitchFailureMessage,
    sourceSwitchScope: (): number => this.sourceSwitchScopeId,
    sourceSwitchVisible: (): boolean => this.sourceSwitchPresentationVisible,
    sourceSwitchRollingBack: (): boolean => this.sourceSwitchRollbackInFlight,
    sourceSwitchTransaction: (): string | undefined => this.sourceSwitchTransactionId,
    dismissSourceSwitchFailure: (scope: number): void => this.onDismissSourceSwitchFailure(scope),
    retrySourceSwitch: (scope: number): void => this.onRetryFailedSourceSwitch(scope),
    switchSource: (focus?: string): void => this.onSwitchSource(focus),
    selection: (): number => this.chapterSelectionToken,
    windowMetricsRevision: (): number => this.readerWindowMetricsRevision,
    bookmarkRecovery: (): ReadingDirectoryRecovery => this.bookmarkRecovery,
    smartGesturesEnabled: (): boolean => this.smartGestureSettings.enabled,
    controlObscured: (): boolean => this.controlObscured,
    expanded: (): boolean => this.expandedLayout,
    foreground: (): boolean => this.appForeground,
    sourceName: (): string => this.sourceName,
    sourceId: (): string => this.sourceId,
    bookId: (): string => this.bookId,
  };

  build() {
    ReaderMountedReadingScene({ actors: this.mountedSceneActors, view: this.mountedSceneView,
      chrome: this.chromeState, session: this.sessionStatus, overlay: this.overlayState, projection: this.pageTurnProjection });
  }

  private readonly controlFrameInput: ReaderNativeControlFrameInput = {
    route: (): ReaderNativeControlFrameRoute => ({
      sourceId: this.sourceId, sourceName: this.sourceName, bookId: this.bookId, bookTitle: this.bookTitle, chapterCount: this.totalChapters,
    }),
    chrome: (): ReadingChromeRenderSnapshot => this.chromeState,
    overlay: (): ReadingOverlayRenderSnapshot => this.overlayState,
    projection: (): ReadingPageTurnRenderSnapshot => this.pageTurnProjection,
    session: (): ReadingSessionRenderSnapshot => this.sessionStatus,
    mount: this.mountHost, geometry: this.controlGeometry, pageChrome: this.pageChrome, directory: this.directoryOps,
    bookmark: this.readerBookmark, auxiliary: this.auxiliarySession, recovery: this.recovery,
    mutation: this.contentMutation, brightness: this.brightnessSession,
    selectionPossible: (): boolean => this.inputDevices.textSelectionEnabled(),
    systemFontScale: (): number => this.readingViewport.readingLayout().systemFontScale,
    appScheme: (): string => this.readerAppScheme,
    windowMetricsRevision: (): number => this.readerWindowMetricsRevision,
    readableTocCount: (): number => this.documentIndex.readingTocEntries().length,
    currentReadablePosition: (): number => this.documentIndex.readableChapterPosition(this.currentChapterIndex()),
    currentChapter: (): number => this.currentChapterIndex(),
    controlInputEnabled: (): boolean => this.controlInteraction.isControlInputEnabled(),
    controlObscured: (): boolean => this.controlObscured,
    chapterStartBookmarkEnabled: (): boolean => this.chapterStartBookmarkCreationEnabled,
    bookmarkMessage: (): string => this.bookmarkLoadMessage,
    bookmarkRecovery: (): ReadingDirectoryRecovery => this.bookmarkRecovery,
    automaticState: (): Readonly<ReaderAutoPageState> => this.playback.automaticState(),
    automaticConfiguration: (): Readonly<ReaderAutoPageFullConfiguration> => this.playback.automaticConfiguration(),
    reducedMotion: (): boolean => this.reduceMotion,
    offlineOperationActive: (): boolean => this.offlineBookOperationActive,
    refreshEnabled: (): boolean => this.controlInteraction.canRefreshCurrentChapter(),
    verification: (): ReaderControlVerificationSession => this.controlVerification,
    bookmarkIdentity: (): ReaderBookIdentity | undefined => this.bookmarkIdentity,
    searchPublication: this.quickSearchPublication,
  };
  private controlPanelIntent(): ReaderControlIntentHandler {
    const actors: ReaderNativeControlActors = {
      interaction: this.controlInteraction, playback: this.playback, replace: this.replacePanel,
      session: this.controlDirectory, geometry: this.controlGeometry, recovery: this.recovery, directory: this.directoryOps,
      progress: this.readingProgress, turnInput: this.turnRuntime.input, brightness: this.brightnessSession,
      preferences: this.preferences, mutation: this.contentMutation, speech: this.speech, bookmarks: this.readerBookmark,
      auxiliary: this.auxiliarySession,
    };
    const actions: ReaderNativeControlActions = {
      bookmarkEnabled: (): boolean => this.controlInteraction.isControlInputEnabled() && this.controlInteraction.controlMotionPage() === 'home' &&
        this.readerBookmark.controlEnabled(this.pageTurnProjection.bookmarkPresentationRevision + this.pageTurnProjection.pageTurnRenderRevision),
      windowMetricsRevision: (): number => this.readerWindowMetricsRevision,
      openBookInfo: (): void => this.onOpenBookInfo(),
      deleteBookmarks: (times: number[]): void => { if (this.bookmarkWriteEnabled()) this.onDeleteBookmarks(times); },
      createBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
        if (this.bookmarkWriteEnabled()) this.onCreateChapterStartBookmark(request);
      },
      reduceMotion: (): boolean => this.reduceMotion,
    };
    return readerNativeControlIntent(actors, actions);
  }

  private bookmarkWriteEnabled(): boolean {
    return this.bookmarkRecovery.bookmarkWriteEnabled === true;
  }

  private readerPreferenceModule(): string {
    const location = readerControlContentLocation(this.chromeState.controlSession);
    return location.level === 'secondary' ? location.module : '';
  }

  private onReaderIdentityChanged(): void {
    this.auxiliarySession.clearStaticCapsuleOrigin();
    this.speech.clearResumePresentation();
    this.recovery.retire();
  }

  private loadingChapterTitle(): string {
    const index = this.directoryOps.selection.ticket?.targetChapterIndex ?? this.sessionStatus.loadingChapterIndex ??
      this.requestedBookmarkAnchor?.chapterIndex ?? this.requestedChapterIndex;
    return index === undefined ? '' :
      this.documentIndex.readingTocEntries().find((entry: LocalReadingTocEntry): boolean => entry.index === index)?.title ?? '';
  }
  private sourceSwitchCompletionVisibleChanged(): void { this.sourceSwitchOverlay.visibilityChanged(); }
  private sourceSwitchCompletionChanged(): void { this.sourceSwitchOverlay.completionChanged(); }

  private traceInitialReadingPhase(phase: string, lifecycleToken: number): void {
    this.mountHost.hydration.trace(lifecycleToken, phase);
  }

  private hasPartialEntryWindow(): boolean {
    return this.measuredPage.chapter?.documentRange !== undefined;
  }

  private onRemoteCatalogChanged(): void { this.mountHost.onRemoteCatalogChanged(); }

  private resumeAfterCatalogChange(): void {
    // Appending does not retire an in-flight neighbouring-page measure.
    this.turnRuntime.preparation.enqueue('next');
    this.turnRuntime.preparation.enqueue('previous');
    this.turnRuntime.input.drain();
    this.playback.auto.resumePendingTurn();
  }
  private admitTocEntries(entries: LocalReadingTocEntry[]): void {
    this.directoryOps.admitToc(entries, (next: LocalReadingTocEntry[]): void => {
      this.publishChromeState({ tocEntries: next });
      this.acquisition.captureDownloadFacts();
    });
  }

  private onExpandedLayoutChanged(): void {
    if (!this.sessionStatus.mounted) {
      return;
    }
    this.readingViewport.reflowAfterWindowGeometryChange();
    this.preferences.applyWindowPolicyForChromeOwner();
  }

  private onWindowMetricsRevisionChanged(): void {
    if (!this.sessionStatus.mounted) {
      return;
    }
    if (!this.controlGeometry.refreshEditingEnvironment()) {
      this.controlGeometry.minimum.invalidateRequest();
      this.controlGeometry.schedule();
    }
    this.auxiliarySession.reconcileCapsuleLayout();
    this.readingViewport.reflowAfterWindowGeometryChange();
  }

  /**
   * Last non-whitespace scalar of the chapter content. Used to pull a stale
   * EOF/blank-line restore anchor back to a visible glyph; the paragraph-range
   * clamp inside beginMeasurement applies the same upper bound later.
   */
  private lastVisibleScalar(content: string, map: ReadingSurfaceLayoutMap): number {
    return lastVisibleReadingScalar(content, map);
  }

  private scaledReadingImageHeight(image: ReadingSessionImage, pageCapacity: number): number {
    if (image.state !== 'ready' && !hasKnownReadingImageGeometry(image)) {
      throw new Error('READING_IMAGE_NOT_READY');
    }
    if (image.intrinsicWidth <= 0 || image.intrinsicHeight <= 0) {
      throw new Error('READING_IMAGE_DIMENSIONS_INVALID');
    }
    const fitted = this.measurementTextWidth() * ((image.imageWidthBasisPoints ?? 10000) / 10000) *
      image.intrinsicHeight / image.intrinsicWidth;
    return Math.max(1, Math.min(pageCapacity, fitted));
  }

  private measurementTextWidth(): number {
    return this.readingViewport.readingLayout().bodyWidth();
  }

  private currentChapterIndex(): number {
    return this.measuredPage.chapter === undefined ? -1 : this.measuredPage.chapter.chapterIndex;
  }

  private captureControlPlaybackPresentation(): ReaderControlPlaybackPresentation {
    const location = readerControlContentLocation(this.chromeState.controlSession);
    return { lifecycleToken: this.mountHost.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId,
      openRevision: this.chromeState.controlOpenRevision, moduleVisitRevision: this.controlDirectory.visitRevision(),
      module: location.level === 'secondary' ? location.module : 'home' };
  }

  private isControlPlaybackPresentationCurrent(presentation: ReaderControlPlaybackPresentation,
    module: string): boolean {
    const location = readerControlContentLocation(this.chromeState.controlSession);
    return this.mountHost.isSessionActive(presentation.lifecycleToken) &&
      presentation.sourceId === this.sourceId && presentation.bookId === this.bookId &&
      // During a capsule morph the control host is intentionally hidden at
      // capture start; the morph generation itself owns presentation validity.
      (this.controlInteraction.controlVisible() || this.overlayState.sessionLaunch !== undefined) &&
      !(this.controlInteraction.controlShellExitArmed() && this.overlayState.sessionLaunch === undefined) &&
      presentation.openRevision === this.chromeState.controlOpenRevision &&
      presentation.moduleVisitRevision === this.controlDirectory.visitRevision() &&
      presentation.module === module && location.level === 'secondary' && location.module === module;
  }

  private beginTtsStartCapsule(): boolean {
    if (this.sessionStatus.phase !== 'ready' || this.measuredPage.chapter === undefined || this.measuredPage.page === undefined) return false;
    if (this.controlVerification.observing()) {
      const facts: ReaderControlSpeechAvailability = {
        resolved: this.speech.isPrepared(), engine: this.sessionStatus.ttsEngine, status: this.sessionStatus.ttsState.status,
      };
      this.controlVerification.effect('capsule-launch', 'tts-availability', facts);
    }
    return !this.auxiliarySession.beginSessionCapsuleMorph('tts');
  }

  private captureTtsPauseWitness(): ReaderTtsPauseWitness | undefined {
    const launch = this.overlayState.sessionLaunch;
    const speechGeneration = this.sessionStatus.ttsState.sessionGeneration;
    if (launch?.geometry.type !== 'tts' || !this.controlVerification.observing()) return undefined;
    return {
      speechGeneration,
      confirm: (): void => {
        const current = this.overlayState.sessionLaunch;
        if (current?.generation !== launch.generation || current.ownership !== 'stage' || current.desiredPlaying) return;
        this.capsuleVerification.ownerState('tts-pause-confirmed', current, this.sessionLaunchSpeechFacts(current));
      },
    };
  }

  private showAcknowledgedStaticTtsCapsule(presentation: ReaderControlPlaybackPresentation): void {
    if (this.overlayState.sessionLaunch === undefined && this.controlInteraction.readerInputIsCurrent() && !this.windowChromeOverlayActive &&
      this.isControlPlaybackPresentationCurrent(presentation, 'tts')) this.hideControlForStaticSessionCapsule('tts');
  }

  private ttsStartPage(): ReaderTtsStartPage | undefined {
    const chapter = this.measuredPage.chapter;
    const page = this.measuredPage.page;
    if (!this.sessionStatus.mounted || this.sessionStatus.phase !== 'ready' || chapter === undefined || page === undefined ||
      this.measuredPage.materializedContentVersion.length === 0) return undefined;
    return { chapter, startScalar: page.startScalar };
  }

  private onPrefetchDownloadActivityChanged(): void { this.playback.reportPrefetch(); }
  private onAppForegroundChanged(): void { this.playback.foregroundChanged(); }

  private beginReadingRecordClock(lifecycleToken: number): void {
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    this.readingRecordHost.begin((): boolean => this.mountHost.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId && this.appForeground && !this.sessionStatus.exitRequested);
  }

  private clearReadingRecordTimer(): void { this.readingRecordHost.clearTimer(); }

  private captureReadingRecordElapsed(continueClock: boolean): void { this.readingRecordHost.capture(continueClock); }

  private flushReadingRecord(): Promise<void> { return this.readingRecordHost.flush(); }

  private onControlObscuredChanged(): void {
    this.onControlInputBoundaryChanged();
    if (this.controlObscured) {
      this.playback.pauseAutoPage('touch');
    }
  }

  private onWindowChromeActiveChanged(): void {
    this.inputDevices.sync();
    if (!this.windowChromeActive) this.transientFeedback.reset();
    this.mountHost.admitRetainedReadingRecency();
    this.onControlInputBoundaryChanged();
    this.preferences.applyWindowChrome();
    this.preferences.applyWindowPolicyForChromeOwner();
  }

  private controlsPresentedForWindow(): boolean {
    return this.overlayState.sessionLaunch?.ownership === 'stage' ? this.overlayState.sessionLaunch.sample.controlsPresented :
      readerControlHostVisible(this.controlDirectory.visualSession());
  }
  private onControlBookmarkFailureChanged(): void { this.directoryOps.onControlBookmarkFailureChanged(); }
  private onControlDirectoryDataChanged(): void { this.directoryOps.onDirectoryDataChanged(); }

  private onSessionLaunchReduceMotionChanged(): void {
    if (this.reduceMotion) this.sourceSwitchOverlay.finishWash();
    if (this.reduceMotion) this.turnRuntime.retireForReduceMotion();
    this.auxiliarySession.reduceMotion();
  }

  private onSessionLaunchTtsState(state: ReaderTtsState): void {
    const resume = this.speech.acknowledgeResume(state, (): boolean => this.overlayState.sessionLaunch === undefined);
    if (resume !== undefined) this.showAcknowledgedStaticTtsCapsule(resume);
    if (!readerTtsSessionBlocksAutoPageStart(state.status)) this.auxiliarySession.clearStaticCapsuleOrigin('tts');
    const launch = this.overlayState.sessionLaunch;
    if (launch === undefined || launch.geometry.type !== 'tts' || launch.ownership !== 'stage') return;
    if (state.status === 'error' || state.status === 'failed' || state.status === 'unavailable') {
      this.auxiliarySession.cancel('failure'); return;
    }
    if (state.status === 'completed' || (state.status === 'idle' && launch.businessStatus !== 'preparing')) {
      this.auxiliarySession.cancel('stop'); return;
    }
    const status = state.status === 'playing' ? 'playing' :
      state.status === 'paused' || state.status === 'interrupted' ? 'paused' : undefined;
    if (status !== undefined) this.auxiliarySession.acknowledgeSpeech(launch, status,
      (current: ReaderSessionLaunchTransaction): ReaderControlCapsuleSpeechFacts | undefined => this.sessionLaunchSpeechFacts(current, state));
  }

  private sessionLaunchSpeechFacts(launch: ReaderSessionLaunchTransaction,
    state: ReaderTtsState = this.sessionStatus.ttsState): ReaderControlCapsuleSpeechFacts | undefined {
    if (launch.geometry.type !== 'tts' || !this.controlVerification.observing()) return undefined;
    const transport = this.speech.transportState();
    if (transport === undefined || transport.sessionGeneration !== state.sessionGeneration) return undefined;
    return { engine: transport.engine, sessionGeneration: state.sessionGeneration, status: state.status,
      audioStarted: state.audioStarted === true, audioSession: transport.audioSession, pauseReason: state.pauseReason };
  }

  private hideControlForStaticSessionCapsule(type: ReaderSessionCapsuleType): void {
    this.controlInteraction.hideControl('host-dismiss', type);
  }

  private syncSmartGestureMonitor(): void { this.inputDevices.sync(); }

  private reconcileSessionLaunchLayout(): void { this.auxiliarySession.reconcileCapsuleLayout(); }

  private onSharedAppearanceChanged(): void {
    if (this.sessionStatus.mounted && !this.sessionStatus.exitRequested && this.preferences.appearanceLoaded) {
      this.controlGeometry.fontOrder.reconcile();
      // Shared preference notifications may arrive before the initiating
      // control's font receipt. Use the same readiness and stale-owner guards.
      void this.preferences.loadAppearanceSnapshot(this.mountHost.lifecycleToken);
    }
  }

  /** Page-turn and control surfaces are mutually exclusive input owners. */
  private pageTurnOwnsReaderInput(): boolean {
    return this.turnRuntime.inputPhase() !== 'idle';
  }

  private readerReplaceRuntimeCurrent(): boolean {
    try { return ReaderRuntimeOwner.current() === this.replaceRuntime; } catch (_) { return false; }
  }

  private positionContextForScope(scope: RemoteReadingPositionScope | undefined,
    chapterIndex: number, offset: number, directoryTargetProof?: ReaderDirectoryTargetProof): RemoteReadingPositionContext | undefined {
    return createRequestedRemoteReadingPositionContext(
      this.sourceId, this.bookId, chapterIndex, offset, scope, directoryTargetProof);
  }

  private onReaderPageGestureDecision(decision: ReaderPageGestureDecision): ReaderPageGestureDecision {
    return decision;
  }

  private currentReadingViewportStart(): number | undefined {
    if (this.chromeState.readerSettingsSnapshot.navigationMode !== 'continuous') return this.measuredPage.page?.startScalar;
    return this.routeSelection.hasCurrentMaterializedChapter() && this.surface.continuousProjection.fragments.length > 0 ?
      this.surface.continuousVisibleScalar : undefined;
  }

  private currentBookmarkViewport(): ReaderBookmarkViewport | undefined {
    if (this.chromeState.readerSettingsSnapshot.navigationMode !== 'continuous') {
      const page = this.measuredPage.page;
      return page === undefined ? undefined : { startScalar: page.startScalar, endScalar: page.endScalar };
    }
    const startScalar = this.currentReadingViewportStart();
    const last = this.surface.continuousProjection.fragments[this.surface.continuousProjection.visibleEnd];
    if (startScalar === undefined || last === undefined) return undefined;
    return { startScalar: startScalar, endScalar: Math.max(startScalar, last.endScalar) };
  }

  private errorMessage(error: Error): string {
    return error.message;
  }
}
