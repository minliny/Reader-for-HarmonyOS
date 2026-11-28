import type { UIContext } from '@ohos.arkui.UIContext';
import { settings } from '@kit.BasicServicesKit';
import {
  type ReaderReadingDocumentIndexHost,
} from './ReaderReadingDocumentIndexHost';
import {
  type ReaderReadingRouteSelectionHost,
} from './ReaderReadingRouteSelectionHost';
import {
  type ReaderReadingViewportHost,
  type ReaderReadingSurfaceHost,
  type ReaderContinuousSurfaceView,
  type ReaderContinuousSurfaceEffects,
  ReadingChromeRenderSnapshot,
  type ReadingChromeRenderUpdate,
  ReadingPageTurnRenderSnapshot,
  type ReadingPageTurnRenderUpdate,
  ReadingOverlayRenderSnapshot,
  type ReadingOverlayRenderUpdate,
  ReadingSessionRenderSnapshot,
  type ReadingSessionRenderUpdate,
} from './ReaderReadingSurfaceHost';
import { type ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import { type ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import { type ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import { type ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import { type ReaderReadingMountHost } from './ReaderReadingMountHost';
import {
  type ReaderReadingImageResidencyHost,
  type ReaderReadingImageResidencyOwners,
  type ReaderReadingImageResidencyView,
  type ReaderReadingImageScope,
} from './ReaderReadingImageResidencyHost';
import {
  type ReaderAuxiliarySessionHost,
  type ReaderAuxiliarySessionView,
  type ReaderAuxiliarySessionControlSurface,
  type ReaderAuxiliarySessionEnvironment,
  type ReaderAuxiliaryCapsulePorts,
  type ReaderAuxiliaryCapsulePresentation,
  type ReaderAuxiliaryCapsuleFreeze,
  type ReaderAuxiliaryCapsuleControl,
  type ReaderAuxiliaryCapsuleControlRevisions,
  type ReaderAuxiliaryCapsuleChrome,
  type ReaderAuxiliaryCapsuleChromeAnchor,
  type ReaderAuxiliaryCapsuleLayout,
  type ReaderAuxiliaryCapsuleLayoutIdentity,
  type ReaderAuxiliaryCapsuleActivity,
  type ReaderAuxiliaryCapsuleRoute,
} from './ReaderAuxiliarySessionHost';
import {
  type ReaderReadingChapterPresentationHost,
  type ReaderReadingChapterPresentationScope,
  type ReaderReadingChapterPresentationLifetime,
  type ReaderReadingChapterPresentationView,
  type ReaderReadingChapterPresentationSpeech,
  type ReaderReadingChapterPresentationReady,
} from './ReaderReadingChapterPresentationHost';
import {
  type ReaderReadingPageChromeHost,
  type ReaderContinuousChromeCatalogWitness,
  type ReaderPageChromeDocument,
  type ReaderPageChromeView,
  type ReaderPageChromeEffects,
  type ReaderRetainedChapterFrame,
} from './ReaderReadingPageChromeHost';
import {
  type ReaderReadingProgressHost,
  type ReaderReadingProgressOwners,
  type ReaderReadingProgressView,
  type ReaderReadingExitEffects,
  type ReaderReadingBackControls,
} from './ReaderReadingProgressHost';
import {
  type ReaderControlGeometryHost,
  type ReaderControlPlaybackSourceMinimum,
} from './ReaderControlGeometryHost';
import {
  type ReaderReadingMeasurementAdmissionHost,
  type ReaderMeasuredPageAdmissionNative,
  type ReaderMeasuredPageAdmissionView,
  type ReaderMeasuredPageAdmissionFlow,
  type ReaderMeasuredPageAdmissionFacts,
  type ReaderMeasuredPageVisibility,
  type ReaderMeasuredFirstPage,
} from './ReaderReadingMeasurementAdmissionHost';
import { type ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import { type ReaderControlDirectorySession } from './ReaderControlDirectoryHost';
import {
  type ReaderControlDirectoryOperationsHost,
  type ReaderControlDirectoryDataPort,
  type ReaderControlDirectoryScopePort,
  type ReaderControlDirectoryBookmarkPort,
  type ReaderControlDirectoryActionsPort,
  type ReaderControlDirectoryDisplayPort,
} from './ReaderControlDirectoryOperationsHost';
import {
  type ReaderReadingContentMutationHost,
  type ReaderReadingContentScope,
  type ReaderReadingContentLifetime,
  type ReaderReadingConversionView,
  type ReaderReadingContentPosition,
  type ReaderReadingContentProjection,
} from './ReaderReadingContentMutationHost';
import { type ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import {
  type ReaderReadingChapterAcquisitionHost,
  type ReaderChapterAcquisitionScope,
  type ReaderChapterAcquisitionSession,
  type ReaderChapterAcquisitionEntry,
  type ReaderAcquiredChapter,
  type ReaderChapterMaterializedSample,
  type ReaderChapterAcquisitionPresentation,
  type ReaderChapterAcquisitionPages,
  type ReaderChapterAcquisitionRecovery,
  type ReaderChapterSelectionRetirement,
  type ReaderChapterRangeAcquisition,
} from './ReaderReadingChapterAcquisitionHost';
import { type ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import {
  type ReaderReadingSpeechHost,
  type ReaderReadingSpeechSession,
  type ReaderReadingSpeechView,
  type ReaderReadingSpeechProgress,
  type ReaderReadingSpeechChapter,
  type ReaderReadingSpeechAdvanceSelection,
  type ReaderReadingSpeechControls,
  type ReaderReadingSpeechPresentation,
} from './ReaderReadingSpeechHost';
import { type ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import {
  type ReaderReadingPreferencesHost,
  type ReaderReadingPreferenceScope,
  type ReaderReadingPreferencesLifetime,
  type ReaderReadingPreferencesPage,
  type ReaderReadingPreferencesView,
  type ReaderReadingPreferencesWindow,
} from './ReaderReadingPreferencesHost';
import {
  type ReaderReversePagePorts,
  type ReaderMeasuredPagePublication,
  type ReaderFirstPageSurfacePublication,
  type ReaderMeasureView,
  type ReaderMeasureImages,
  type ReaderMeasureEffects,
} from './ReaderMeasuredPagePublication';
import { type ReadingPhase } from '../application/ReadingExperienceRenderSnapshots';
import { CoreReadingAnchor, type CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import {
  type ReaderMaterializedChapterContext,
  type ReaderControlSelectionDisplay,
  type PreparedReaderPageTurn,
} from '../presentation/ReaderPagePresentationModels';
import { ReadingCommit } from '../application/ReadingCommit';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import { type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { type ReaderProgressProducerHost, type ReaderProgressProducerIntent } from '../application/ReaderProgressProducerHost';
import { type ReadingExitProgressCoordinator, type ReadingProgressIdentity } from '../application/ReadingExitProgressCoordinator';
import { type ReadingSourceSwitchOverlayHost } from './ReadingSourceSwitchOverlayHost';
import { type ReadingCapsuleMeasurement } from '../application/ReadingAuxiliaryFlowBridge';
import { type MeasurementParagraph, type PhysicalReadingPage } from './ReadingMeasurementModels';
import { type ReadingEntryNavigation } from '../application/ReadingEntrySnapshot';
import { type ReaderTtsFollowLease, type ReaderTtsFollowTarget } from './ReaderTtsPageFollow';
import { type RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import { type ReaderAutoPageStatus, type ReaderAutoPageState } from './ReaderAutoPageState';
import { type ReaderControlCapsuleSpeechFacts } from './ReaderControlCapsuleVerification';
import { type ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { type ReaderControlCapsuleVerification } from './ReaderControlCapsuleVerification';
import { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import {
  type LocalReadingDownloadState,
  type LocalReadingAnchor,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingTocEntry,
} from '../application/LocalReadingFlowGateway';
import { ReadingSessionFlowGateway, type ReadingSessionCommittedProgress } from '../application/ReadingSessionFlowGateway';
import type { ReadingEntrySnapshot } from '../application/ReadingEntryPreparation';
import { type RemoteReadingFailureKind } from '../application/RemoteContentAdmission';
import { type ReadingSurfacePageFragment } from './ReadingSurface';
import { type ReaderPageTurnDirection } from './ReaderPageGestureState';
import { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReaderControlPage } from './ReaderControlPanel';
import type { ReaderControlLaunchSource } from './ReaderControlPanelNativeContract';
import { type ReaderControlLayoutSnapshot, type ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { type ReaderNavigationMode, type ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import { type ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { type ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { type ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import {
  ReadingChapterWindow,
  type ReadingSessionChapter,
  type ReadingSessionImage,
} from '../application/ReadingChapterWindow';
import { readingParagraphBoundaryMode, type ReadingParagraphBoundaryMode } from '../application/ReadingParagraphProjection';
import { type ReaderControlPlaybackPresentation, type ReaderTtsPauseWitness, type ReaderTtsPlaybackScope, type ReaderTtsStartPage } from '../application/ReaderTtsPlaybackOwner';
import type { ReaderTtsCapsuleTiming } from '../../../app/ReaderStartupTrace';
import { type ReaderTtsState } from '../application/ReaderTtsState';
import { type ReaderControlSelectionStoredProgress, type ReaderControlSelectionTicket } from '../application/ReaderControlSelectionTransaction';
import { type ReaderChapterSelectionScope } from '../presentation/ReaderChapterSelectionOwner';
import { type ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { ReaderPageChromeSnapshot } from '../presentation/ReaderPageChromeModel';
import { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import { ReaderControlReplacePanel } from '../presentation/ReaderControlReplacePanel';
import { type ReaderControlSessionState } from './ReaderControlSessionState';
import { type ReaderControlHostTiming } from './ReaderControlHostSession';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReadingRecordGateway } from '../application/ReadingRecordGateway';
import { admitReaderRestoredAnchor } from './ReaderReadingMountHost';

export interface ReadingExperiencePortHost {
  sourceId: () => string;
  bookId: () => string;
  bookKind: () => string | undefined;
  bookTitle: () => string;
  localSourceId: string;
  chapterSelectionToken: () => number;
  advanceChapterSelectionToken: () => number;
  expandedLayout: () => boolean;
  appForeground: () => boolean;
  windowChromeActive: () => boolean;
  windowChromeOverlayActive: () => boolean;
  interactionBlocked: () => boolean;
  controlObscured: () => boolean;
  reduceMotion: () => boolean;
  readerAppScheme: () => string;
  sharedAppearanceRevision: () => number;
  readerWindowMetricsRevision: () => number;
  sourceSwitchTransactionId: () => string | undefined;
  sourceSwitchFailureMessage: () => string;
  bookmarkLoadMessage: () => string;
  bookmarkRecovery: () => ReadingDirectoryRecovery;
  parentDirectoryEntries: () => LocalReadingTocEntry[];
  chromeState: () => ReadingChromeRenderSnapshot;
  pageTurnProjection: () => ReadingPageTurnRenderSnapshot;
  overlayState: () => ReadingOverlayRenderSnapshot;
  sessionStatus: () => ReadingSessionRenderSnapshot;
  publishChromeState: (update: ReadingChromeRenderUpdate) => void;
  publishPageTurnProjection: (update: ReadingPageTurnRenderUpdate) => void;
  publishOverlayState: (update: ReadingOverlayRenderUpdate) => void;
  publishSessionStatus: (update: ReadingSessionRenderUpdate) => void;
  publishPresentationPhase: (phase: ReadingPhase) => void;
  uiContext: () => UIContext;
  readerPreferenceModule: () => string;
  controlsPresentedForWindow: () => boolean;
  isReaderIdentityCurrent: () => boolean;
  traceInitialReadingPhase: (phase: string, lifecycle: number) => void;
  sessionLaunchSpeechFacts: (launch: ReaderSessionLaunchTransaction) => ReaderControlCapsuleSpeechFacts | undefined;
  admitTocEntries: (entries: LocalReadingTocEntry[]) => void;
  onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]) => void;
  onChapterCommitted: (chapter: number, title: string) => void;
  onLoadControlBookmarks: (sourceId: string, bookId: string, current: () => boolean) => Promise<void>;
  onDownloadBook: () => void;
  onDownloadChapter: (chapter: number) => void;
  onReadingCommitted: (commit: ReadingCommit) => void;
  onExit: () => void;
  lastVisibleScalar: (content: string, map: ReadingSurfaceLayoutMap) => number;
  measurementTextWidth: () => number;
  scaledReadingImageHeight: (image: ReadingSessionImage, capacity: number) => number;
  currentChapterIndex: () => number;
  hasPartialEntryWindow: () => boolean;
  captureControlPlaybackPresentation: () => ReaderControlPlaybackPresentation;
  beginTtsStartCapsule: () => boolean;
  isControlPlaybackPresentationCurrent: (presentation: ReaderControlPlaybackPresentation, module: string) => boolean;
  captureTtsPauseWitness: () => ReaderTtsPauseWitness | undefined;
  showAcknowledgedStaticTtsCapsule: (presentation: ReaderControlPlaybackPresentation) => void;
  ttsStartPage: () => ReaderTtsStartPage | undefined;
  onSessionLaunchTtsState: (state: ReaderTtsState) => void;
  beginReadingRecordClock: (lifecycle: number) => void;
  publishSpeechPresentation: (presentation: ReaderReadingSpeechPresentation) => void;
  mountHost: () => ReaderReadingMountHost;
  turnRuntime: () => ReaderPageTurnRuntimeHost;
  measuredPage: () => ReaderMeasuredPagePublication;
  pageChrome: () => ReaderReadingPageChromeHost;
  surface: () => ReaderReadingSurfaceHost;
  preferences: () => ReaderReadingPreferencesHost;
  controlDirectory: () => ReaderControlDirectorySession;
  controlGeometry: () => ReaderControlGeometryHost;
  controlInteraction: () => ReaderReadingControlInteractionHost;
  controlVerification: () => ReaderControlVerificationSession;
  capsuleVerification: () => ReaderControlCapsuleVerification;
  auxiliarySession: () => ReaderAuxiliarySessionHost;
  replacePanel: () => ReaderControlReplacePanel;
  quickSearchPublication: () => ReaderContentSearchPublication;
  acquisition: () => ReaderReadingChapterAcquisitionHost;
  chapterPresentation: () => ReaderReadingChapterPresentationHost;
  firstPageAdmission: () => ReaderReadingMeasurementAdmissionHost;
  firstPageSurfacePublication: () => ReaderFirstPageSurfacePublication;
  readingProgress: () => ReaderReadingProgressHost;
  readingViewport: () => ReaderReadingViewportHost;
  imageResidency: () => ReaderReadingImageResidencyHost;
  documentIndex: () => ReaderReadingDocumentIndexHost;
  routeSelection: () => ReaderReadingRouteSelectionHost;
  directoryOps: () => ReaderControlDirectoryOperationsHost;
  recovery: () => ReaderReadingRecoveryHost;
  speech: () => ReaderReadingSpeechHost;
  playback: () => ReaderReadingPlaybackFlowHost;
  contentMutation: () => ReaderReadingContentMutationHost;
  sourceSwitchOverlay: () => ReadingSourceSwitchOverlayHost;
  readerBookmark: () => ReaderBookmarkInteractionHost;
  readingRecordHost: () => ReaderReadingRecordHost;
  readingRecordGateway: () => ReadingRecordGateway;
  exitProgress: () => ReadingExitProgressCoordinator;
  progressProducers: () => ReaderProgressProducerHost;
  chapterWindow: () => ReadingChapterWindow;
}

export interface AuxiliarySessionPortsBundle {
  view: ReaderAuxiliarySessionView;
  control: ReaderAuxiliarySessionControlSurface;
  environment: ReaderAuxiliarySessionEnvironment;
  capsule: ReaderAuxiliaryCapsulePorts;
}

export function buildAuxiliarySessionPorts(host: ReadingExperiencePortHost): AuxiliarySessionPortsBundle {
  const view: ReaderAuxiliarySessionView = {
    read: (): ReaderSessionLaunchTransaction | undefined => host.overlayState().sessionLaunch,
    publish: (launch: ReaderSessionLaunchTransaction | undefined): void => {
      host.publishOverlayState(launch === undefined ? { sessionLaunch: { value: undefined },
        sessionLaunchControlSource: { value: undefined } } : { sessionLaunch: { value: launch } });
    },
    publishControlSource: (source: ReaderControlLaunchSource): void =>
      host.publishOverlayState({ sessionLaunchControlSource: { value: source } }),
    stageOpacity: (): number => host.overlayState().sessionLaunchStageOpacity,
    setStageOpacity: (opacity: number): void => { host.publishOverlayState({ sessionLaunchStageOpacity: opacity }); },
    beginFooterExit: (launch: ReaderSessionLaunchTransaction): void => {
      host.publishOverlayState({ sessionLaunchFooterExiting: true });
      host.publishOverlayState({ sessionLaunchFooterOffset: launch.sample.footerTranslateX });
      host.publishOverlayState({ sessionLaunchFooterOpacity: launch.sample.footerOpacity });
      host.publishOverlayState({ sessionLaunchFooterExitProgress: 0 });
    },
    finalizeFooterExit: (): void => {
      if (!host.overlayState().sessionLaunchFooterExiting) return;
      host.publishOverlayState({ sessionLaunchFooterOffset: 0 });
      host.publishOverlayState({ sessionLaunchFooterExitProgress: 1 });
      host.publishOverlayState({ sessionLaunchFooterOpacity: 1 });
    },
    clearFooterExit: (): void => {
      host.publishOverlayState({ sessionLaunchFooterExiting: false });
      host.publishOverlayState({ sessionLaunchFooterExitProgress: 0 });
    },
    renderChanged: (): void => {
      host.publishPageTurnProjection({ pageTurnRenderRevision: host.pageTurnProjection().pageTurnRenderRevision + 1 });
    },
  };
  const control: ReaderAuxiliarySessionControlSurface = {
    layoutKey: (): string => host.auxiliarySession().sessionLaunchLayoutKey(),
    hide: (): void => host.controlInteraction().commitSessionLaunchControlHidden(),
    restore: (duration: number): void => host.auxiliarySession().restoreCapsuleControl(duration),
  };
  const environment: ReaderAuxiliarySessionEnvironment = {
    ready: (): boolean => host.sessionStatus().mounted && host.appForeground() && !host.sessionStatus().exitRequested,
    mounted: (): boolean => host.sessionStatus().mounted,
    exiting: (): boolean => host.sessionStatus().exitRequested,
    uiContext: (): UIContext => host.uiContext(),
    viewportRevision: (): number => host.readerWindowMetricsRevision(),
    reducedMotion: (): boolean => host.reduceMotion(),
    observing: (): boolean => host.controlVerification().observing(),
    drainPageTurn: (): void => host.turnRuntime().preparation.drain(),
    updateWindow: (): void => host.preferences().applyWindowPolicyForChromeOwner(),
    speechFacts: (launch: ReaderSessionLaunchTransaction): ReaderControlCapsuleSpeechFacts | undefined =>
      host.sessionLaunchSpeechFacts(launch),
    automaticStatus: (): ReaderAutoPageStatus => host.playback().automaticState().status,
    retireBusinessStart: (type: ReaderSessionCapsuleType): void => {
      if (type === 'tts') host.speech().cancelPending();
      else host.playback().auto.cancelStart();
    },
  };
  const presentation: ReaderAuxiliaryCapsulePresentation = {
    phase: (): ReadingPhase => host.sessionStatus().phase,
    hasPaintedBody: (): boolean => host.measuredPage().page !== undefined && host.pageTurnProjection().visibleFragments.length > 0,
    obscured: (): boolean => host.controlObscured(),
    blocked: (): boolean => host.interactionBlocked(),
    active: (): boolean => host.mountHost().isSessionActive(host.mountHost().lifecycleToken),
    freeze: (): ReaderAuxiliaryCapsuleFreeze => {
      const frozen = host.pageTurnProjection().pageTurnSessionCapsuleFrozen;
      return { frozen, snapshot: frozen ? host.turnRuntime().input.capsule : undefined };
    },
    pageChromeFrozen: (): boolean => host.pageChrome().frozen(),
    measurement: (): ReadingCapsuleMeasurement | undefined => host.chromeState().sessionCapsuleMeasurement,
    publishMeasurement: (receipt: ReadingCapsuleMeasurement): void =>
      host.publishChromeState({ sessionCapsuleMeasurement: { value: receipt } }),
  };
  const capsuleControl: ReaderAuxiliaryCapsuleControl = {
    visible: (): boolean => host.controlInteraction().controlVisible(),
    closingForCapsule: (): boolean => host.chromeState().sessionControlClosing,
    shellExitArmed: (): boolean => host.controlInteraction().controlShellExitArmed(),
    currentPage: (): ReaderControlPage => host.controlInteraction().controlPage(),
    layout: (revision: number): ReaderControlLayoutSnapshot => host.controlGeometry().layout(revision),
    revisions: (): ReaderAuxiliaryCapsuleControlRevisions => ({
      open: host.chromeState().controlOpenRevision, moduleVisit: host.controlDirectory().visitRevision(),
    }),
    playbackMinimum: (kind: 'tts' | 'autoPage', revision: number): ReaderControlPlaybackSourceMinimum =>
      host.controlGeometry().playbackSourceMinimum(kind, revision),
    visualSession: (): ReaderControlSessionState => host.controlDirectory().visualSession(),
    cancelNavigation: (): void => { host.controlInteraction().cancelControlNavigationIntent(); },
    invalidateBackdrop: (): void => host.controlGeometry().invalidateBackdrop(),
    publishRestoredSession: (session: ReaderControlSessionState): void => {
      host.controlDirectory().request(session);
      host.controlDirectory().copyVisual(session);
    },
  };
  const chrome: ReaderAuxiliaryCapsuleChrome = {
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    continuousProgressText: (): string => host.chromeState().continuousChromeProgressText,
    continuousChrome: (text: string): ReaderPageChromeSnapshot =>
      host.surface().continuousPageChromeSnapshot(host.pageTurnProjection().continuousRenderRevision, text),
    currentTurnPage: (): ReaderPageTurnRenderPage => host.pageChrome().currentPage(),
    presentedAnchor: (): ReaderAuxiliaryCapsuleChromeAnchor => ({
      chapterIndex: host.currentChapterIndex(), pageStart: host.measuredPage().page?.startScalar,
      clockText: host.chromeState().pageChromeClockText, renderRevision: host.pageTurnProjection().pageTurnRenderRevision,
    }),
    presentedPageChrome: (): ReaderPageChromeSnapshot => host.pageChrome().currentBodyChrome(),
  };
  const layout: ReaderAuxiliaryCapsuleLayout = {
    route: (): ReaderAuxiliaryCapsuleRoute => ({
      lifecycle: host.mountHost().lifecycleToken, sourceId: host.sourceId(), bookId: host.bookId(),
    }),
    identity: (): ReaderAuxiliaryCapsuleLayoutIdentity => ({
      width: host.chromeState().viewportWidth, height: host.chromeState().viewportHeight, scheme: host.readerAppScheme(),
      activeTheme: host.chromeState().appearanceSnapshot.activeTheme,
    }),
    paginationSignature: (): string => host.documentIndex().paginationLayoutSignature(),
    readingLayout: (): ReaderReadingLayoutSnapshot => host.readingViewport().readingLayout(),
    epoch: (): number => host.pageTurnProjection().measurementEpoch,
    paletteRevision: (): number => host.sharedAppearanceRevision(),
    appearanceGeneration: (): number => host.preferences().appearanceMutationGeneration,
    suspendAdjacent: (): void => host.turnRuntime().preparation.suspend(),
    invalidateTextures: (): void => host.turnRuntime().presentation.texture.invalidate(),
  };
  const activity: ReaderAuxiliaryCapsuleActivity = {
    automatic: (): Readonly<ReaderAutoPageState> => host.playback().automaticState(),
    speech: (): ReaderTtsState => host.sessionStatus().ttsState,
    inputCurrent: (): boolean => host.controlInteraction().readerInputIsCurrent(),
    pageTurnIdle: (): boolean => host.turnRuntime().inputPhase() === 'idle',
    setSpeechDesiredPlaying: (desired: boolean): void => host.speech().setDesiredPlaying(desired),
    toggleAutoPage: (): void => host.playback().toggleAutoPage(),
    pauseAutoPage: (): void => host.playback().pauseAutoPage('manual'),
    toggleSpeech: (): void => host.speech().toggleTts(),
  };
  return { view, control, environment, capsule: { presentation, control: capsuleControl, chrome, layout, activity } };
}

export interface ReadingPreferencePortsBundle {
  lifetime: ReaderReadingPreferencesLifetime;
  view: ReaderReadingPreferencesView;
  window: ReaderReadingPreferencesWindow;
  page: ReaderReadingPreferencesPage;
}

export function buildReadingPreferencePorts(host: ReadingExperiencePortHost): ReadingPreferencePortsBundle {
  const lifetime: ReaderReadingPreferencesLifetime = {
    scope: (): ReaderReadingPreferenceScope => ({
      lifecycleToken: host.mountHost().lifecycleToken,
      sourceId: host.sourceId(),
      bookId: host.bookId(),
      chapterSelectionToken: host.chapterSelectionToken(),
    }),
    mounted: (): boolean => host.sessionStatus().mounted,
    mountedToken: (lifecycle: number): boolean => host.mountHost().isMountedToken(lifecycle),
    sessionActive: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    readerIdentityCurrent: (): boolean => host.isReaderIdentityCurrent(),
    trace: (phase: 'settings-read' | 'settings-window', lifecycle: number): void =>
      host.traceInitialReadingPhase(phase, lifecycle),
  };
  const view: ReaderReadingPreferencesView = {
    settings: (): ReaderSettingsSnapshot => host.chromeState().readerSettingsSnapshot,
    appearance: (): ReaderAppearanceSnapshot => host.chromeState().appearanceSnapshot,
    publishSettings: (snapshot: ReaderSettingsSnapshot): void => host.publishChromeState({ readerSettingsSnapshot: snapshot }),
    publishEntryAppearance: (snapshot: ReaderAppearanceSnapshot): void => host.publishChromeState({ appearanceSnapshot: snapshot }),
    admitAppearance: (snapshot: ReaderAppearanceSnapshot): void => host.readingViewport().admitAppearanceSnapshot(snapshot),
    settingsRecovery: (): ReaderRecoveryView => host.overlayState().readerSettingsRecovery,
    publishSettingsRecovery: (recovery: ReaderRecoveryView, busy: boolean): void => {
      host.publishOverlayState({ readerSettingsRecovery: recovery });
      host.publishOverlayState({ readerSettingsRecoveryBusy: busy });
    },
    appearanceRecovery: (): ReaderRecoveryView => host.overlayState().appearanceSaveRecovery,
    publishAppearanceRecovery: (recovery: ReaderRecoveryView): void => host.publishOverlayState({ appearanceSaveRecovery: recovery }),
    publishAppearanceRecoveryBusy: (busy: boolean): void => host.publishOverlayState({ appearanceSaveRecoveryBusy: busy }),
    recoveryInputCurrent: (): boolean => host.recovery().inputCurrent(),
    appearanceRecoveryChanged: (): void => { if (!host.recovery().hasContent()) host.recovery().retire(); },
  };
  const windowPort: ReaderReadingPreferencesWindow = {
    uiContext: (): UIContext => host.uiContext(),
    foreground: (): boolean => host.appForeground(),
    chromeActive: (): boolean => host.windowChromeActive(),
    overlayActive: (): boolean => host.windowChromeOverlayActive(),
    expanded: (): boolean => host.expandedLayout(),
    controlsPresented: (): boolean => host.controlsPresentedForWindow(),
    capsuleStageFlying: (): boolean => {
      const launch = host.overlayState().sessionLaunch;
      return launch !== undefined && launch.ownership === 'stage' && !launch.sample.finished;
    },
    controlInputEnabled: (): boolean => host.controlInteraction().isControlInputEnabled(),
    publishControlsPresented: (presented: boolean): void => host.publishChromeState({ windowControlsPresented: presented }),
    publishPolicyPending: (pending: boolean): void => host.publishChromeState({ readerWindowPolicyPending: pending }),
    ttsWindowAwakeRequested: (): boolean => host.speech().ttsWindowAwakeRequested(),
    stopTtsOnScreenOff: (): void => host.speech().stopTtsOnScreenOff(),
    volumePageTurn: (direction: ReaderPageTurnDirection): void => {
      host.playback().manualInteraction();
      host.turnRuntime().input.request(direction);
    },
  };
  const page: ReaderReadingPreferencesPage = {
    expandedLayout: (): boolean => host.readingViewport().readingLayout().widthClass === 'expanded',
    inputCurrent: (): boolean => host.controlInteraction().readerInputIsCurrent(),
    inputIdle: (): boolean => host.turnRuntime().inputPhase() === 'idle',
    deferWindowSettings: (snapshot: ReaderSettingsSnapshot): void => {
      host.turnRuntime().pageTurn.deferWindowSettings(snapshot);
      host.turnRuntime().rollbackForDeferredMutation();
    },
    visibleContinuousScalar: (): number => host.surface().continuousVisibleScalar,
    restoreFromContinuousScalar: (scalar: number): void => { host.measuredPage().desiredChapterOffset = scalar; },
    reflowWindow: (): void => host.readingViewport().reflowAfterWindowGeometryChange(),
    renderChanged: (): void => host.publishPageTurnProjection({ pageTurnRenderRevision: host.pageTurnProjection().pageTurnRenderRevision + 1 }),
    resumePendingAutoPageTurn: (): void => host.playback().auto.resumePendingTurn(),
    sampleAndCommitContinuous: (lifecycle: number): Promise<void> => {
      host.surface().continuousAnchorSampler?.();
      return host.readingProgress().commitContinuousProgress(lifecycle);
    },
    invalidatePageTurnRuntime: (): void => host.turnRuntime().invalidate(true),
    resetBookTurnFailure: (): void => host.publishPageTurnProjection({ bookTurnRuntimeFailed: false }),
    publishNavigationModeChange: (mode: ReaderNavigationMode): void => {
      if (!host.routeSelection().hasCurrentMaterializedChapter()) return;
      if (mode === 'continuous') {
        host.surface().rebuildContinuousFragments(false, host.measuredPage().page?.startScalar ?? host.measuredPage().desiredChapterOffset);
        host.surface().continuousProgressRevision += 1;
      } else host.measuredPage().beginCanonicalModeMeasurement(host.surface().continuousVisibleScalar);
    },
    preparePageTurnIfReady: (): void => { if (host.sessionStatus().phase === 'ready') host.turnRuntime().preparation.schedule(); },
  };
  return { lifetime, view, window: windowPort, page };
}

export interface ReadingMeasurementPortsBundle {
  view: ReaderMeasureView;
  effects: ReaderMeasureEffects;
  images: ReaderMeasureImages;
  reverse: ReaderReversePagePorts;
}

export function buildReadingMeasurementPorts(host: ReadingExperiencePortHost): ReadingMeasurementPortsBundle {
  const view: ReaderMeasureView = {
    lifecycle: (): number => host.mountHost().lifecycleToken,
    sourceId: (): string => host.sourceId(),
    bookId: (): string => host.bookId(),
    bookKind: (): string | undefined => host.bookKind(),
    sessionActive: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => host.mountHost().isSelectionActive(lifecycle, selection),
    selectionCurrent: (selection: number): boolean => host.routeSelection().isSelectionCurrent(selection),
    epoch: (): number => host.pageTurnProjection().measurementEpoch,
    layout: (): ReaderReadingLayoutSnapshot => host.readingViewport().readingLayout(),
    hasMeasuredViewport: (): boolean => host.readingViewport().hasMeasuredViewport(),
    context: (): UIContext => host.uiContext(),
    appearance: (): ReaderAppearanceSnapshot => host.chromeState().appearanceSnapshot,
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    phase: (): ReadingPhase => host.sessionStatus().phase,
    visibleFragments: (): ReadingSurfacePageFragment[] => host.pageTurnProjection().visibleFragments,
    currentPaginationKey: (): ReadingPaginationKey => host.documentIndex().currentPaginationKey(),
    layoutSignature: (): string => host.documentIndex().paginationLayoutSignature(),
    lastVisibleScalar: (content: string, map: ReadingSurfaceLayoutMap): number => host.lastVisibleScalar(content, map),
    preparationPending: (): boolean => host.turnRuntime().preparation.pending !== undefined,
    noPendingSelection: (): boolean => host.turnRuntime().preparation.pending === undefined && host.directoryOps().selection.ticket === undefined,
  };
  const effects: ReaderMeasureEffects = {
    publishPhase: (phase: ReadingPhase): void => host.publishPresentationPhase(phase),
    clearVisibleFragments: (): void => host.publishPageTurnProjection({ visibleFragments: [] }),
    hideChapterTitle: (): void => host.publishChromeState({ showChapterTitle: false }),
    invalidateHiddenMeasurementTree: (): void => host.publishPageTurnProjection({ measurementEpoch: host.pageTurnProjection().measurementEpoch + 1 }),
    ensureReadyDeadline: (lifecycle: number, selection: number): void => host.mountHost().hydration.ensureReadyDeadline(lifecycle, selection),
    armCompletionDeadline: (): void => host.mountHost().hydration.armCompletionDeadline(),
    retainNativeParagraphResources: (): void => host.imageResidency().retainNativeParagraphResources(),
    expandParagraphWindow: (request: ReaderChapterRangeAcquisition): void => host.acquisition().expandParagraphWindow(request),
    admitVisibleChapter: (chapter: ReadingSessionChapter): void => host.mountHost().setCurrentReadingChapter(chapter),
    completePreparedPageTurn: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): void =>
      host.turnRuntime().preparation.complete(page, generation, selection, lifecycle),
    completeFirstPage: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): Promise<void> =>
      host.firstPageAdmission().completeFirstPage(page, generation, selection, lifecycle),
    recordFirstLayout: (lifecycle: number): void => host.traceInitialReadingPhase('first-layout-ready', lifecycle),
    fail: (error: Error, lifecycle: number): void => host.recovery().fail(error, lifecycle),
  };
  const images: ReaderMeasureImages = {
    forParagraph: (paragraph: MeasurementParagraph): ReadingSessionImage | undefined => host.imageResidency().readingImageForParagraph(paragraph),
    scaledHeight: (image: ReadingSessionImage, capacity: number): number => host.scaledReadingImageHeight(image, capacity),
    resolvePending: (image: ReadingSessionImage, generation: number, selection: number, lifecycle: number): void =>
      host.imageResidency().resolvePendingReadingImage(image, generation, selection, lifecycle),
    indexChapter: (chapter: ReadingSessionChapter): void => host.imageResidency().indexChapter(chapter),
  };
  const reverse: ReaderReversePagePorts = {
    window: host.chapterWindow(),
    preparation: (): ReaderPageTurnPreparationHost => host.turnRuntime().preparation,
    settlement: (): ReaderPageTurnSettlementHost => host.turnRuntime().settlement,
    input: (): ReaderPageTurnInputHost => host.turnRuntime().input,
    acquisition: (): ReaderReadingChapterAcquisitionHost => host.acquisition(),
    chapterPresentation: (): ReaderReadingChapterPresentationHost => host.chapterPresentation(),
    firstPage: (): ReaderReadingMeasurementAdmissionHost => host.firstPageAdmission(),
    mounted: (): boolean => host.sessionStatus().mounted,
    selection: (): number => host.chapterSelectionToken(),
    nextSelection: (): number => host.advanceChapterSelectionToken(),
    knownChapter: (chapter: number): boolean => host.documentIndex().isKnownControlChapter(chapter),
    adjacentChapter: (chapter: number, step: number): number | undefined => host.documentIndex().adjacentChapterIndex(chapter, step),
    canTurn: (): boolean => host.turnRuntime().canTurnPage(),
    inputIdle: (): boolean => host.turnRuntime().inputPhase() === 'idle',
    stablePage: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      host.routeSelection().isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    retainWindow: (): void => host.documentIndex().retainCurrentChapterWindow(),
    admitNeighbourVersion: (chapter: number, version: string): void => host.documentIndex().admitChapterContentVersion(chapter, version),
    publishTurnRevision: (): void =>
      host.publishPageTurnProjection({ pageTurnRenderRevision: host.pageTurnProjection().pageTurnRenderRevision + 1 }),
    resolvePageImages: (chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]): void =>
      host.imageResidency().resolvePageImagePixels(chapter, fragments),
    releaseImages: (): void => host.imageResidency().releaseUnretainedReadingImages(),
    resumeAutomatic: (): void => host.playback().auto.resumePendingTurn(),
    resumeSpeech: (): void => host.playback().resumeTtsFollow(),
    scheduleTexture: (): void => host.turnRuntime().presentation.texture.schedule(),
    clearRestoredProgress: (): void => { host.mountHost().recordRestoration(undefined); },
  };
  return { view, effects, images, reverse };
}

export interface ReadingAcquisitionPortsBundle {
  session: ReaderChapterAcquisitionSession;
  entry: ReaderChapterAcquisitionEntry;
  presentation: ReaderChapterAcquisitionPresentation;
  pages: ReaderChapterAcquisitionPages;
  recovery: ReaderChapterAcquisitionRecovery;
  retirement: ReaderChapterSelectionRetirement;
}

export function buildReadingAcquisitionPorts(host: ReadingExperiencePortHost): ReadingAcquisitionPortsBundle {
  const scope = (): ReaderChapterAcquisitionScope => ({
    sourceId: host.sourceId(),
    bookId: host.bookId(),
    lifecycleToken: host.mountHost().lifecycleToken,
    selectionToken: host.chapterSelectionToken(),
  });
  const session: ReaderChapterAcquisitionSession = {
    scope,
    gateway: (): ReadingSessionFlowGateway => host.mountHost().activeGateway(),
    hasGateway: (): boolean => host.mountHost().gateway !== undefined,
    window: (): ReadingChapterWindow => host.chapterWindow(),
    boundaryMode: (): ReadingParagraphBoundaryMode => readingParagraphBoundaryMode(host.sourceId(), host.bookKind()),
    selectionActive: (lifecycle: number, selection: number): boolean => host.mountHost().isSelectionActive(lifecycle, selection),
    active: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    mountedToken: (lifecycle: number): boolean => host.mountHost().isMountedToken(lifecycle),
  };
  const entry: ReaderChapterAcquisitionEntry = {
    toc: (): LocalReadingTocEntry[] => host.chromeState().tocEntries,
    requireKnownChapter: (index: number): void => { host.mountHost().requireKnownChapter(index); },
    catalogPending: (): boolean => host.mountHost().entryCatalogPending,
    downloadState: (index: number, proof: ReaderDirectoryTargetProof | undefined): LocalReadingDownloadState | undefined =>
      host.mountHost().knownChapterDownloadState(index, proof),
    prepared: (): ReadingEntrySnapshot | undefined => host.mountHost().preparedEntry,
    discardPrepared: (): void => host.mountHost().discardPreparedEntry(),
    restartPrepared: (lifecycle: number, selection: number, layout: Promise<void[]>): Promise<void> =>
      host.mountHost().restartPreparedReadingEntry(lifecycle, selection, layout),
    restoredProgress: (): LocalReadingProgressState | undefined => host.mountHost().restoredProgress(),
    updateRestoredProgress: (progress: LocalReadingProgressState): void => { host.mountHost().recordRestoration(progress); },
    markRetainedBodyReady: (lifecycle: number, selection: number): void => host.chapterPresentation().markRetainedChapterBodyReady(lifecycle, selection),
    traceChapterReady: (lifecycle: number): void => host.traceInitialReadingPhase('chapter-ready', lifecycle),
  };
  const presentation: ReaderChapterAcquisitionPresentation = {
    admitVersion: (index: number, version: string): void => host.documentIndex().admitChapterContentVersion(index, version),
    setCurrentWindowChapter: (chapter: ReadingSessionChapter): void => host.mountHost().setCurrentReadingChapter(chapter),
    retainWindow: (): void => host.documentIndex().retainCurrentChapterWindow(),
    present: (admission: ReaderAcquiredChapter): void => {
      host.measuredPage().chapter = admission.chapter;
      host.imageResidency().indexChapter(admission.chapter);
      host.measuredPage().materializedChapterSelectionToken = admission.selectionToken;
      admitReaderRestoredAnchor(host.measuredPage(), host.exitProgress(), admission.chapter, admission.projection.map,
        admission.isInitial ? host.mountHost().restoredProgress() : undefined, admission.requestedOffset, admission.requestedProgress);
      host.measuredPage().nativeMeasurement.chapterRanges = admission.projection.ranges;
      if (host.readingViewport().hasMeasuredViewport()) host.measuredPage().beginMeasurement(admission.lifecycleToken);
    },
    materializedSample: (): ReaderChapterMaterializedSample | undefined => {
      const chapter = host.measuredPage().chapter;
      const map = host.measuredPage().chapterLayoutMap;
      return chapter === undefined || map === undefined ? undefined : { chapter, map };
    },
    publishMetrics: (metrics: LocalReadingContentMetrics | undefined): void =>
      host.publishSessionStatus({ contentMetrics: { value: metrics } }),
  };
  const pages: ReaderChapterAcquisitionPages = {
    visiblePage: (): PhysicalReadingPage | undefined => host.measuredPage().page,
    chapter: (): ReadingSessionChapter | undefined => host.measuredPage().chapter,
    hasFacingChapter: (): boolean => host.readingViewport().readingLayout().facingChapterWidth > 0,
    stableVisibleOwner: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      host.routeSelection().isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    isReadableTarget: (index: number): boolean => host.documentIndex().isKnownControlChapter(index),
    turnGeneration: (): number => host.turnRuntime().preparation.generation,
    stillWantsNeighbour: (direction: ReaderPageTurnDirection): boolean =>
      host.turnRuntime().pageTurn.direction() === direction || host.turnRuntime().input.pointerId >= 0,
    reviseFacingSpread: (): void => {
      if (host.turnRuntime().inputPhase() === 'idle') {
        host.publishPageTurnProjection({ pageTurnRenderRevision: host.pageTurnProjection().pageTurnRenderRevision + 1 });
      }
    },
    prepareAdjacent: (direction: ReaderPageTurnDirection): void => {
      host.turnRuntime().preparation.enqueue(direction);
      host.turnRuntime().preparation.drain();
    },
  };
  const recovery: ReaderChapterAcquisitionRecovery = {
    fail: (error: Error, lifecycle: number): void => host.recovery().fail(error, lifecycle),
    showRecovery: (message: string, label: string, refresh: () => void): void => host.recovery().show(message, label, refresh),
    beginCacheRefresh: (index: number, lifecycle: number, context: RemoteReadingPositionContext | undefined): number => {
      const selection = host.advanceChapterSelectionToken();
      host.chapterPresentation().beginRetainedChapterPresentation(index, lifecycle, selection, true, context);
      host.acquisition().resetForChapterSelection();
      host.publishOverlayState({ failureCode: '' });
      host.mountHost().hydration.armReadyDeadline(lifecycle, selection);
      return selection;
    },
    reloadBookmarks: (chapter: ReadingSessionChapter, lifecycle: number, selection: number): void =>
      host.directoryOps().refreshBookmarks(chapter, lifecycle, selection),
    uiContext: (): UIContext => host.uiContext(),
    feedbackForeground: (): boolean => host.appForeground() && host.windowChromeActive(),
  };
  const retirement: ReaderChapterSelectionRetirement = {
    retireOpeningRun: (): void => {
      host.publishSessionStatus({ loadingChapterIndex: { value: undefined } });
      host.measuredPage().measurementRun.resetSelection();
    },
    retireRecovery: (): void => host.recovery().show(''),
    invalidatePageTurn: (rapid: boolean, tts: boolean): void => {
      host.firstPageAdmission().retireOrdinaryMeasurement();
      host.turnRuntime().invalidate(true, rapid, tts);
    },
    clearWorkingMeasurement: (): void => host.measuredPage().retireWorkingSelection(),
    resetVisibleProjection: (preserveDisplay: boolean): void =>
      host.surface().retireSelection(preserveDisplay || host.chapterPresentation().retainedChapterFrame() !== undefined),
    clearMaterializedContent: (): void => {
      host.imageResidency().resetChapter();
      host.measuredPage().retireMaterializedSelection();
      host.publishPageTurnProjection({ measurementEpoch: host.pageTurnProjection().measurementEpoch + 1 });
      host.publishPresentationPhase('loading');
    },
    cancelSelectionDeadlines: (): void => {
      host.measuredPage().measurementRun.cancelDeadline();
      host.mountHost().hydration.cancelReadyDeadline();
      host.mountHost().hydration.cancelCompletionDeadline();
      host.mountHost().hydration.resetCompletionRetries();
      host.turnRuntime().preparation.cancelRetry();
    },
  };
  return { session, entry, presentation, pages, recovery, retirement };
}

export interface ReadingContentAndSurfacePortsBundle {
  contentLifetime: ReaderReadingContentLifetime;
  conversionView: ReaderReadingConversionView;
  contentPosition: ReaderReadingContentPosition;
  contentProjection: ReaderReadingContentProjection;
  continuousSurfaceView: ReaderContinuousSurfaceView;
  continuousSurfaceEffects: ReaderContinuousSurfaceEffects;
}

export function buildContentAndSurfacePorts(host: ReadingExperiencePortHost): ReadingContentAndSurfacePortsBundle {
  const contentLifetime: ReaderReadingContentLifetime = {
    scope: (): ReaderReadingContentScope => ({
      sourceId: host.sourceId(),
      bookId: host.bookId(),
      lifecycleToken: host.mountHost().lifecycleToken,
      selectionToken: host.chapterSelectionToken(),
    }),
    mounted: (): boolean => host.sessionStatus().mounted,
    active: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => host.mountHost().isSelectionActive(lifecycle, selection),
  };
  const conversionView: ReaderReadingConversionView = {
    mode: (): ReaderChineseConversionMode => host.chromeState().chineseConversionMode,
    publishMode: (mode: ReaderChineseConversionMode): void => host.publishChromeState({ chineseConversionMode: mode }),
    operationId: (): string => host.chromeState().chineseConversionOperationId,
    publishOperationId: (id: string): void => host.publishChromeState({ chineseConversionOperationId: id }),
    uiContext: (): UIContext => host.uiContext(),
    foreground: (): boolean => host.appForeground(),
    windowChromeActive: (): boolean => host.windowChromeActive(),
  };
  const contentPosition: ReaderReadingContentPosition = {
    gateway: (): ReadingSessionFlowGateway => host.mountHost().activeGateway(),
    chapter: (): ReadingSessionChapter | undefined => host.measuredPage().chapter,
    ready: (): boolean => host.sessionStatus().phase === 'ready',
    failed: (): boolean => host.sessionStatus().phase === 'failed',
    navigationMode: (): ReaderNavigationMode => host.chromeState().readerSettingsSnapshot.navigationMode,
    hasVisiblePage: (): boolean => host.measuredPage().page !== undefined,
    visiblePageStart: (): number | undefined => host.measuredPage().page?.startScalar,
    sampleContinuousAnchor: (): void => host.surface().continuousAnchorSampler?.(),
    continuousVisibleScalar: (): number => host.surface().continuousVisibleScalar,
    awaitFirstPagePersistence: (): Promise<void> => host.firstPageAdmission().awaitOrdinaryFirstPagePersistence(),
    commitContinuousProgress: (lifecycle: number): Promise<void> => host.readingProgress().commitContinuousProgress(lifecycle),
    commitVisiblePage: (lifecycle: number): Promise<void> => host.readingProgress().commitVisiblePage(lifecycle),
    committed: (): ReadingCommit | undefined => host.exitProgress().committed,
    selectMappedPosition: (chapterIndex: number, offset: number, context?: RemoteReadingPositionContext): void =>
      host.directoryOps().selectAnchor(chapterIndex, offset, false, true, undefined, -1, false, false, context),
    retryReading: (): void => host.recovery().retryReading(),
    showPositionRecovery: (message: string, label: string, retry: () => void): void => host.recovery().show(message, label, retry),
  };
  const contentProjection: ReaderReadingContentProjection = {
    settlementActive: (): boolean => host.pageTurnProjection().pageTurnSettlementActive,
    preparationActive: (): boolean => host.turnRuntime().preparation.pending !== undefined,
    chapterSelectionPending: (): boolean => host.directoryOps().selection.ticket !== undefined,
    deferContentProjection: (chapterIndex: number): void => host.turnRuntime().pageTurn.deferContentProjection(chapterIndex),
    deferReplaceReload: (): void => host.turnRuntime().pageTurn.deferReplaceReload(),
    invalidatePageTurnRuntime: (): void => host.turnRuntime().invalidate(true),
    clearProcessedChapters: (): void => {
      host.acquisition().clearContentMetrics();
      host.documentIndex().invalidateProcessedContent();
    },
    retireQuickSearch: (): void => {
      host.quickSearchPublication().cancel();
      host.controlInteraction().publishQuickSearchState({ kind: 'idle' });
    },
    admitToc: (entries: LocalReadingTocEntry[]): void => host.admitTocEntries(entries),
    notifyDirectoryChanged: (entries: LocalReadingTocEntry[]): void => host.onDirectoryProjectionChanged(entries),
  };
  const continuousSurfaceView: ReaderContinuousSurfaceView = {
    retainedChrome: (): ReaderPageChromeSnapshot | undefined => host.chapterPresentation().retainedChapterFrame()?.continuousChrome,
    currentChapterIndex: (): number => host.currentChapterIndex(),
    liveChrome: (revision: number, offset: number, count: number): ReaderPageChromeSnapshot =>
      host.pageChrome().continuousSnapshot(revision, offset, count),
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    revision: (): number => host.pageTurnProjection().continuousRenderRevision,
    progressText: (): string => host.chromeState().continuousChromeProgressText,
    hasPartialEntryWindow: (): boolean => host.hasPartialEntryWindow(),
    inFlightDirection: (): ReaderPageTurnDirection | undefined => host.turnRuntime().pageTurn.inFlightDirection,
    lifecycle: (): number => host.mountHost().lifecycleToken,
    selection: (): number => host.chapterSelectionToken(),
    turnSerial: (): number => host.turnRuntime().input.transactionSerial,
    mountedToken: (lifecycle: number): boolean => host.mountHost().isMountedToken(lifecycle),
    exiting: (): boolean => host.sessionStatus().exitRequested,
    adjacentChapterIndex: (chapterIndex: number, delta: number): number | undefined => host.documentIndex().adjacentChapterIndex(chapterIndex, delta),
    appearance: (): ReaderAppearanceSnapshot => host.readingViewport().visibleReadingAppearance(),
    measurementTextWidth: (): number => host.measurementTextWidth(),
    context: (): UIContext => host.uiContext(),
    imageAt: (startScalar: number): ReadingSessionImage | undefined => host.imageResidency().atScalar(startScalar),
    visibleFragments: (): ReadingSurfacePageFragment[] => host.pageTurnProjection().visibleFragments,
    layout: (): ReaderReadingLayoutSnapshot => host.readingViewport().readingLayout(),
    layoutSignature: (): string => host.documentIndex().paginationLayoutSignature(),
    scaledImageHeight: (image: ReadingSessionImage, capacity: number): number => host.scaledReadingImageHeight(image, capacity),
    ttsState: (): ReaderTtsState => host.sessionStatus().ttsState,
    ttsFollowHighlight: (): boolean => host.sessionStatus().ttsFollowHighlight,
    mounted: (): boolean => host.sessionStatus().mounted,
    controlVisible: (): boolean => host.controlInteraction().controlVisible(),
    ready: (): boolean => host.sessionStatus().phase === 'ready',
    progressInFlight: (): boolean => host.progressProducers().continuousInFlight,
    isUnknownCatalogEdge: (chapterIndex: number, direction: ReaderPageTurnDirection): boolean => host.turnRuntime().input.isUnknownCatalogEdge(chapterIndex, direction),
    viewportHeight: (): number => host.chromeState().viewportHeight,
    reducedMotion: (): boolean => host.reduceMotion(),
  };
  const continuousSurfaceEffects: ReaderContinuousSurfaceEffects = {
    publishSelectionActive: (active: boolean): void => host.publishPageTurnProjection({ textSelectionActive: active }),
    retirePagePointer: (): void => host.turnRuntime().input.retirePointer(),
    retireRecovery: (): void => host.recovery().retire(),
    manualInteraction: (): void => host.playback().manualInteraction(),
    publishProgressText: (text: string): void => host.publishChromeState({ continuousChromeProgressText: text }),
    resolveContinuousImage: (startScalar: number): void => host.imageResidency().resolveContinuousImage(startScalar),
    scheduleEntryWindowHydration: (): void => host.mountHost().scheduleEntryWindowHydration(),
    commitProgress: (lifecycle: number): Promise<void> => host.readingProgress().commitContinuousProgress(lifecycle),
    completeRapid: (direction: ReaderPageTurnDirection): void => {
      host.turnRuntime().pageTurn.completeRapid(direction);
      host.turnRuntime().input.drain();
    },
    turnToPreviousChapter: (target: number, from: number, offset: number): boolean => host.turnRuntime().input.turnToPreviousChapter(target, from, offset),
    openPageTurnChapter: (chapterIndex: number, offset: number): boolean => host.routeSelection().openPageTurnChapter(chapterIndex, offset),
    bumpRevision: (): void => host.publishPageTurnProjection({ continuousRenderRevision: host.pageTurnProjection().continuousRenderRevision + 1 }),
    requestCatalogForTurn: (): void => host.turnRuntime().input.requestCatalog(),
  };
  return { contentLifetime, conversionView, contentPosition, contentProjection, continuousSurfaceView, continuousSurfaceEffects };
}

export interface ReadingDirectoryAndFirstPagePortsBundle {
  directoryData: ReaderControlDirectoryDataPort;
  directoryScope: ReaderControlDirectoryScopePort;
  directoryBookmarks: ReaderControlDirectoryBookmarkPort;
  directoryActions: ReaderControlDirectoryActionsPort;
  directoryDisplay: ReaderControlDirectoryDisplayPort;
  firstPageNative: ReaderMeasuredPageAdmissionNative;
  firstPageView: ReaderMeasuredPageAdmissionView;
  firstPageFlow: ReaderMeasuredPageAdmissionFlow;
}

export function buildDirectoryAndFirstPagePorts(host: ReadingExperiencePortHost): ReadingDirectoryAndFirstPagePortsBundle {
  const directoryData: ReaderControlDirectoryDataPort = {
    parentEntries: (): LocalReadingTocEntry[] => host.parentDirectoryEntries(),
    publishEntriesRevision: (revision: number): void => host.publishChromeState({ controlDirectoryEntriesRevision: revision }),
    tocEntries: (): LocalReadingTocEntry[] => host.chromeState().tocEntries,
    catalogPending: (): boolean => host.mountHost().entryCatalogPending,
    catalogNavigation: (): ReadingEntryNavigation | undefined => host.mountHost().entryCatalogNavigation,
    readingToc: (): LocalReadingTocEntry[] => host.documentIndex().readingTocEntries(),
    hydrateCatalog: (): Promise<void> => host.mountHost().hydration.hydrateCatalog(),
    contentMetrics: (): LocalReadingContentMetrics | undefined => host.sessionStatus().contentMetrics,
    chapterWindow: host.chapterWindow(),
    chapter: (): ReadingSessionChapter | undefined => host.measuredPage().chapter,
    chapterMap: (): ReadingSurfaceLayoutMap | undefined => host.measuredPage().chapterLayoutMap,
    currentChapterIndex: (): number => host.currentChapterIndex(),
    adjacentChapter: (chapter: number, delta: number): number | undefined => host.documentIndex().adjacentChapterIndex(chapter, delta),
    isKnownChapter: (chapter: number): boolean => host.documentIndex().isKnownControlChapter(chapter),
  };
  const directoryScope: ReaderControlDirectoryScopePort = {
    scope: (): ReaderChapterSelectionScope => ({
      sourceId: host.sourceId(),
      bookId: host.bookId(),
      lifecycleToken: host.mountHost().lifecycleToken,
      selectionToken: host.chapterSelectionToken(),
    }),
    nextSelection: (): number => host.advanceChapterSelectionToken(),
    mounted: (): boolean => host.sessionStatus().mounted,
    exiting: (): boolean => host.sessionStatus().exitRequested,
    active: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    selectionActive: (lifecycle: number, selection: number): boolean => host.mountHost().isSelectionActive(lifecycle, selection),
    session: (): ReaderControlSessionState => host.chromeState().controlSession,
    visualSession: (): ReaderControlSessionState => host.controlDirectory().visualSession(),
    controlVisible: (): boolean => host.controlInteraction().controlVisible(),
    controlInputEnabled: (): boolean => host.controlInteraction().isControlInputEnabled(),
    controlClosing: (): boolean => host.controlInteraction().controlShellExitArmed(),
    openRevision: (): number => host.chromeState().controlOpenRevision,
    moduleVisit: (): number => host.controlDirectory().visitRevision(),
    foreground: (): boolean => host.appForeground(),
    windowChromeActive: (): boolean => host.windowChromeActive(),
    uiContext: (): UIContext => host.uiContext(),
    verification: (): ReaderControlVerificationSession => host.controlVerification(),
  };
  const directoryBookmarks: ReaderControlDirectoryBookmarkPort = {
    message: (): string => host.bookmarkLoadMessage(),
    read: (sourceId: string, bookId: string, current: () => boolean): Promise<void> =>
      host.onLoadControlBookmarks(sourceId, bookId, current),
    publishFailed: (failed: boolean): void => host.publishChromeState({ controlBookmarkLoadFailed: failed }),
    reconcileChangedMarkers: (): void => {
      host.readerBookmark().onDirectoryChanged();
      if (host.turnRuntime().usesBookTurnSimulation() && host.turnRuntime().inputPhase() === 'idle') {
        host.turnRuntime().presentation.texture.invalidate(true);
        host.turnRuntime().presentation.texture.schedule();
      }
    },
  };
  const directoryActions: ReaderControlDirectoryActionsPort = {
    gateway: (): ReadingSessionFlowGateway => host.mountHost().activeGateway(),
    yieldPrefetchForDownload: (): void => host.playback().reportPrefetch(false, true),
    downloadBook: (): void => host.onDownloadBook(),
    downloadChapter: (chapter: number): void => host.onDownloadChapter(chapter),
    clearChapterEndTimer: (): void => host.speech().clearTtsChapterEndTimer(),
    prepareSelection: (request): boolean => host.routeSelection().prepareChapterSelectionRequest(request),
    queueOnSettlement: (request): boolean => host.routeSelection().queueChapterSelectionOnSettlement(request),
    interruptPlayback: (stopTts: boolean): void => host.speech().interruptForContentChange(stopTts),
    loadSelection: (request, lifecycle: number, selection: number): void =>
      host.routeSelection().loadAdmittedChapterSelection(request, lifecycle, selection),
    closeControl: (): void => host.controlInteraction().hideControl(),
    reopenRefreshed: (ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
      context: RemoteReadingPositionContext): Promise<void> => host.acquisition().openChapter(stored.chapterIndex, false,
      ticket.lifecycleToken, ticket.selectionToken, stored.chapterOffset, undefined, false, context),
  };
  const directoryDisplay: ReaderControlDirectoryDisplayPort = {
    visiblePage: (): PhysicalReadingPage | undefined => host.measuredPage().page,
    committed: (): ReadingCommit | undefined => host.exitProgress().committed,
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    visibleScalar: (): number => host.surface().continuousVisibleScalar,
    pageToken: (): number => host.measuredPage().selection,
    materializedToken: (): number => host.measuredPage().materializedChapterSelectionToken,
    materializedCurrent: (): boolean => host.routeSelection().hasCurrentMaterializedChapter(),
    captureMaterialized: (): ReaderMaterializedChapterContext => host.measuredPage().captureMaterializedChapterContext(),
    preparationOrigin: (): ReaderMaterializedChapterContext | undefined =>
      host.turnRuntime().preparation.pending?.origin ?? host.measuredPage().previousChapterMeasurement?.origin,
    preparedChapter: (): ReadingSessionChapter | undefined => host.turnRuntime().preparation.pending?.origin.chapter,
    layoutSignature: (): string => host.documentIndex().paginationLayoutSignature(),
    ready: (): boolean => host.sessionStatus().phase === 'ready',
    stablePage: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean =>
      host.routeSelection().isStableVisiblePageOwner(page, chapter, selection, lifecycle),
    chapterCommitted: (chapter: number, title: string): void => host.onChapterCommitted(chapter, title),
    presentationReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage, selection: number, lifecycle: number): boolean =>
      host.chapterPresentation().notifyReadingPresentationReady(chapter, page, selection, lifecycle),
    finishTrace: (lifecycle: number): void => host.mountHost().hydration.finishTrace(lifecycle),
    beginRetainedFailure: (ticket: ReaderControlSelectionTicket): void =>
      host.chapterPresentation().beginRetainedChapterPresentation(ticket.targetChapterIndex, ticket.lifecycleToken, ticket.selectionToken, false, undefined, undefined, true),
    resetAfterSelectionFailure: (): void => host.acquisition().resetForChapterSelection(),
    invalidateUnverifiedDisplay: (): void => {
      host.chapterPresentation().clearChapterPresentation();
      host.exitProgress().clearCommitted();
      host.publishPresentationPhase('failed');
    },
    publishFailure: (code: string, hint: (admittedCode: string) => string): void => {
      host.publishOverlayState({ failureCode: code });
      host.publishOverlayState({ failureHint: hint(host.overlayState().failureCode) });
    },
    retireFailedTurn: (): void => host.turnRuntime().finishPerformance('failed'),
    showRecovery: (message: string, label: string, retry: () => void): void => host.recovery().show(message, label, retry),
    restoreVerified: (display: ReaderControlSelectionDisplay, stored: ReaderControlSelectionStoredProgress): void =>
      host.routeSelection().restoreVerifiedControlSelection(display, stored),
    releaseImages: (): void => host.imageResidency().releaseUnretainedReadingImages(),
  };
  const firstPageNative: ReaderMeasuredPageAdmissionNative = {
    measurementCoordinator: host.measuredPage().measurementCoordinator,
    isMeasurementCurrent: (generation: number, selection: number, lifecycle: number): boolean =>
      host.measuredPage().isMeasurementCurrent(generation, selection, lifecycle),
    layoutSignature: (): string => host.documentIndex().paginationLayoutSignature(),
    captureMeasuredPage: (): ReaderMeasuredPageAdmissionFacts => ({
      layout: host.documentIndex().coreLayout(),
      chapter: host.measuredPage().requireChapter(),
      scalarCount: host.measuredPage().requireChapterLayoutMap().scalarCount(),
    }),
    captureMaterializedChapter: (): ReaderMaterializedChapterContext => host.measuredPage().captureMaterializedChapterContext(),
    currentPage: (): ReaderMeasuredPageVisibility => ({
      page: host.measuredPage().page,
      visibleSelection: host.measuredPage().selection,
      chapter: host.measuredPage().chapter,
      preparationOrigin: host.turnRuntime().preparation.pending?.origin.chapter,
    }),
    hasVisibleBody: (): boolean => host.pageTurnProjection().visibleFragments.length > 0,
    publishPhysicalPage: (page: PhysicalReadingPage, chapterIndex: number, lifecycle: number, selection: number): void => {
      host.chapterPresentation().observeRetainedChapterCommit(chapterIndex, lifecycle, selection);
      host.measuredPage().publishFirstPage(page, lifecycle, selection, host.firstPageSurfacePublication());
    },
    setMeasuredPosition: (offset: number, progress: number): void => {
      host.measuredPage().desiredChapterOffset = offset;
      host.measuredPage().desiredChapterProgress = progress;
    },
    finishMeasurement: (): void => host.measuredPage().physicalPagination.index.finishMeasurement(),
    releaseCompleting: (): void => { host.measuredPage().measurementCompleting = false; },
    resumeDeferredMeasurement: (lifecycle: number): void => host.measuredPage().resumeDeferredMeasurement(lifecycle),
  };
  const firstPageView: ReaderMeasuredPageAdmissionView = {
    bookId: (): string => host.bookId(),
    selectionToken: (): number => host.chapterSelectionToken(),
    isReaderIdentityCurrent: (): boolean => host.isReaderIdentityCurrent(),
    sourceSwitchRequested: (): boolean => host.sourceSwitchTransactionId() !== undefined,
    navigationMode: (): ReaderNavigationMode => host.chromeState().readerSettingsSnapshot.navigationMode,
    canRemeasurePresentedPage: (): boolean => host.sessionStatus().phase === 'ready' && !host.sessionStatus().exitRequested,
    publishReadyPhase: (): void => host.publishPresentationPhase('ready'),
    publishTitleVisibility: (start: number): void =>
      host.publishChromeState({ showChapterTitle: host.measuredPage().isChapterFirstPageStart(start) }),
    publishTitle: (title: string): void => host.publishChromeState({ chapterTitle: title }),
    refreshPageProvider: (): void =>
      host.publishPageTurnProjection({ pageTurnRenderRevision: host.pageTurnProjection().pageTurnRenderRevision + 1 }),
    fail: (error: Error, lifecycle: number): void => host.recovery().fail(error, lifecycle),
  };
  const firstPageFlow: ReaderMeasuredPageAdmissionFlow = {
    captureProgressIntent: (chapter: ReadingSessionChapter, anchor: LocalReadingAnchor, layout: CoreReadingLayout,
      owner: () => boolean, current: () => boolean, publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent =>
      host.readingProgress().progressProducerIntent(chapter, anchor, layout, owner, current, publish),
    admitCommittedProgress: (stored: ReadingSessionCommittedProgress): void => host.readingProgress().admitCommittedProgress(stored),
    directoryProof: (chapter: ReadingSessionChapter, selection: number): ReaderDirectoryTargetProof | undefined =>
      host.acquisition().directoryProofForProgress(chapter, selection),
    acknowledgeDirectoryProof: (selection: number, proof: ReaderDirectoryTargetProof, bookId: string, index: number): void =>
      host.acquisition().acknowledgeDirectoryProof(selection, proof, bookId, index),
    admitRetainedSpeechCommit: (): void => host.chapterPresentation().admitTtsCommit(),
    beginReadingRecord: (lifecycle: number): void => host.beginReadingRecordClock(lifecycle),
    finishPageTurnPerf: (outcome: 'presented' | 'committed'): void => host.turnRuntime().finishPerformance(outcome),
    notifyPresentationReady: (first: ReaderMeasuredFirstPage): boolean =>
      host.chapterPresentation().notifyReadingPresentationReady(first.chapter, first.page, first.selectionToken, first.lifecycleToken),
    notifyControlReadingReady: (first: ReaderMeasuredFirstPage): boolean =>
      host.directoryOps().notifyReadingReady(first.chapter.chapterIndex, first.chapter.chapterTitle, first.page, first.selectionToken, first.lifecycleToken),
    completeControlSelection: (stored: ReadingSessionCommittedProgress, first: ReaderMeasuredFirstPage): void =>
      host.directoryOps().completeAfterCommit(stored, first.page, first.selectionToken, first.lifecycleToken),
    prepareNextPageTurn: (): void => host.turnRuntime().preparation.schedule(),
    prefetchNextChapter: (first: ReaderMeasuredFirstPage): void =>
      host.acquisition().prefetchNextChapter(first.chapter, first.lifecycleToken, first.selectionToken),
    completeRapidTurn: (): void => host.turnRuntime().pageTurn.completeRapid(),
    drainRapidTurn: (): void => { host.turnRuntime().input.drain(); },
    notifyAutomaticPageCommit: (): void => host.playback().auto.pageCommitted(),
  };
  return {
    directoryData,
    directoryScope,
    directoryBookmarks,
    directoryActions,
    directoryDisplay,
    firstPageNative,
    firstPageView,
    firstPageFlow,
  };
}

export interface ReadingSpeechAndProgressPortsBundle {
  speechSession: ReaderReadingSpeechSession;
  speechView: ReaderReadingSpeechView;
  speechProgress: ReaderReadingSpeechProgress;
  speechChapter: ReaderReadingSpeechChapter;
  speechControls: ReaderReadingSpeechControls;
  readingProgressOwners: ReaderReadingProgressOwners;
  readingProgressView: ReaderReadingProgressView;
  readingExitEffects: ReaderReadingExitEffects;
  readingBackControls: ReaderReadingBackControls;
}

export function buildSpeechAndProgressPorts(host: ReadingExperiencePortHost): ReadingSpeechAndProgressPortsBundle {
  const speechSession: ReaderReadingSpeechSession = {
    scope: (): ReaderTtsPlaybackScope => ({
      lifecycleToken: host.mountHost().lifecycleToken,
      selectionToken: host.chapterSelectionToken(),
      sourceId: host.sourceId(),
      bookId: host.bookId(),
    }),
    uiContext: (): UIContext => host.uiContext(),
    mounted: (): boolean => host.sessionStatus().mounted,
    mountedToken: (lifecycle: number): boolean => host.mountHost().isMountedToken(lifecycle),
    active: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle),
    ready: (): boolean => host.sessionStatus().phase === 'ready',
    foreground: (): boolean => host.appForeground(),
    progressAllowed: (lifecycle: number): boolean => host.mountHost().isSessionActive(lifecycle) ||
      (host.sessionStatus().exitRequested && host.mountHost().isMountedToken(lifecycle) && host.isReaderIdentityCurrent()),
  };
  const speechView: ReaderReadingSpeechView = {
    publish: (presentation: ReaderReadingSpeechPresentation): void => host.publishSpeechPresentation(presentation),
    applyWindowPolicy: (): Promise<void> =>
      host.preferences().applyReaderWindowPolicy(host.chromeState().readerSettingsSnapshot, host.controlsPresentedForWindow()),
    observePrefetch: (): void => host.playback().reportPrefetch(),
    followPage: (state: ReaderTtsState): void => host.playback().offerTts(state),
    retirePageFollow: (): void => host.playback().invalidateTtsFollow(),
  };
  const speechProgress: ReaderReadingSpeechProgress = {
    chapter: (): ReadingSessionChapter | undefined => host.measuredPage().chapter,
    scalarCount: (): number => host.measuredPage().requireChapterLayoutMap().scalarCount(),
    layout: (): LocalReadingLayout => host.documentIndex().coreLayout(),
    intent: (chapter: ReadingSessionChapter, anchor: CoreReadingAnchor, layout: LocalReadingLayout,
      current: () => boolean, publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent =>
      host.readingProgress().progressProducerIntent(chapter, anchor, layout, current, current, publish),
    commit: (intent: ReaderProgressProducerIntent): Promise<void> => host.progressProducers().commitTts(intent),
    admit: (stored: LocalReadingProgress): void => host.readingProgress().admitCommittedProgress(stored),
    accepted: (): ReadingCommit | undefined => host.exitProgress().committed,
  };
  const speechChapter: ReaderReadingSpeechChapter = {
    startPage: (): ReaderTtsStartPage | undefined => host.ttsStartPage(),
    materializedContentVersion: (): string => host.measuredPage().materializedContentVersion,
    hydrateEntry: (chapter: ReadingSessionChapter): Promise<void> => host.mountHost().hydration.expandWindow(chapter),
    window: (): ReadingChapterWindow => host.chapterWindow(),
    captureAdvanceSelection: (state: ReaderTtsState): ReaderReadingSpeechAdvanceSelection => {
      const owner = host.playback().ttsLease(state);
      return {
        sessionGeneration: owner.sessionGeneration,
        positionGeneration: owner.positionGeneration,
        isCurrent: (): boolean => host.playback().isTtsFollowCurrent(owner),
        select: (target: number, offset: number): void => {
          host.directoryOps().selectAnchor(target, offset, offset === 0, false, undefined, -1, false, false, undefined, owner);
        },
      };
    },
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    hydrateCatalogForNext: (chapterIndex: number): Promise<void> | undefined =>
      host.turnRuntime().input.isUnknownCatalogEdge(chapterIndex, 'next') ? host.mountHost().hydration.hydrateCatalog() : undefined,
    nextChapterIndex: (chapterIndex: number): number | undefined => host.documentIndex().adjacentChapterIndex(chapterIndex, 1),
    load: (target: number, current: () => boolean): Promise<ReadingSessionChapter> =>
      host.mountHost().activeGateway().loadChapter(host.bookId(), target, current),
    admitContentVersion: (chapter: ReadingSessionChapter): void => host.documentIndex().admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion),
  };
  const speechControls: ReaderReadingSpeechControls = {
    capsule: {
      capture: (): ReaderControlPlaybackPresentation => host.captureControlPlaybackPresentation(),
      beginForStart: (): boolean => host.beginTtsStartCapsule(),
      beginForResume: (presentation: ReaderControlPlaybackPresentation): boolean | undefined =>
        host.isControlPlaybackPresentationCurrent(presentation, 'tts') ? !host.auxiliarySession().beginSessionCapsuleMorph('tts') : undefined,
      pauseWitness: (): ReaderTtsPauseWitness | undefined => host.captureTtsPauseWitness(),
      desiredPlaying: (): boolean => {
        const launch = host.overlayState().sessionLaunch;
        return launch !== undefined && launch.geometry.type === 'tts' ? launch.desiredPlaying : true;
      },
      timing: (): ReaderTtsCapsuleTiming | undefined => host.capsuleVerification().ttsTiming(host.overlayState().sessionLaunch?.generation),
      showStatic: (presentation: ReaderControlPlaybackPresentation): void => host.showAcknowledgedStaticTtsCapsule(presentation),
      observeStart: (): void => host.onSessionLaunchTtsState(host.sessionStatus().ttsState),
      fail: (): void => host.auxiliarySession().cancel('failure'),
    },
    inputAllowed: (): boolean => host.controlInteraction().readerInputIsCurrent() && !host.windowChromeOverlayActive(),
    controlVisible: (): boolean => host.controlInteraction().controlVisible(),
    controlInputEnabled: (): boolean => host.controlInteraction().isControlInputEnabled(),
    chromeOverlayActive: (): boolean => host.windowChromeOverlayActive(),
    preferenceModule: (): string => host.readerPreferenceModule(),
    openTtsConfiguration: (): void => {
      host.controlInteraction().openReaderControl();
      host.controlInteraction().setControlPage('moduleTts');
    },
    onSpeechState: (state: ReaderTtsState): void => host.onSessionLaunchTtsState(state),
    retireBlockedStarts: (): void => host.playback().retirePendingStarts(),
    retireSpeechCapsule: (): void => {
      host.auxiliarySession().clearStaticCapsuleOrigin('tts');
      if (host.overlayState().sessionLaunch?.geometry.type === 'tts') host.auxiliarySession().cancel('stop');
    },
    autoPageActive: (): boolean => host.playback().automaticState().status !== 'stopped',
    cancelAutoPageStart: (): void => host.playback().auto.cancelStart(),
    pauseAutoPage: (): void => host.playback().pauseAutoPage('manual'),
    stopAutoPage: (): void => host.playback().stopAutoPage(),
    waitForLaunchMotion: (): Promise<void> => host.auxiliarySession().waitForLaunchMotion(),
  };
  const readingProgressOwners: ReaderReadingProgressOwners = {
    progress: host.exitProgress(),
    mount: host.mountHost(),
    measured: host.measuredPage(),
    surface: host.surface(),
    speech: host.speech(),
    turn: host.turnRuntime().settlement,
    turnInput: host.turnRuntime().input,
    bookmark: host.readerBookmark(),
    autoPage: host.playback().auto,
    auxiliary: host.auxiliarySession(),
    record: host.readingRecordHost(),
    recordGateway: host.readingRecordGateway(),
    recovery: host.recovery(),
    controlVerification: host.controlVerification(),
  };
  const readingProgressView: ReaderReadingProgressView = {
    identity: (): ReadingProgressIdentity => ({ sourceId: host.sourceId(), bookId: host.bookId() }),
    ready: (): boolean => host.sessionStatus().phase === 'ready',
    currentSelection: (): number => host.chapterSelectionToken(),
    continuous: (): boolean => host.chromeState().readerSettingsSnapshot.navigationMode === 'continuous',
    layout: (): LocalReadingLayout => host.documentIndex().coreLayout(),
    mayRenewRetainedVisit: (): boolean => host.appForeground() && host.windowChromeActive() && host.isReaderIdentityCurrent(),
    exitRequested: (): boolean => host.sessionStatus().exitRequested,
    settlementActive: (): boolean => host.pageTurnProjection().pageTurnSettlementActive,
    publishCommit: (commit: ReadingCommit): void => host.onReadingCommitted(commit),
  };
  const readingExitEffects: ReaderReadingExitEffects = {
    markRequested: (): void => { host.publishSessionStatus({ exitRequested: true }); },
    observePrefetch: (): void => host.playback().reportPrefetch(),
    rollbackUncommittedTurn: (): boolean => host.turnRuntime().rollbackUncommittedBookTurnSettlement(),
    releaseTurnRecoveryInput: (): void => host.turnRuntime().releaseRecoveryInput(),
    retireCapsuleOrigin: (): void => { host.auxiliarySession().clearStaticCapsuleOrigin(); },
    exit: (): void => host.onExit(),
  };
  const readingBackControls: ReaderReadingBackControls = {
    visible: (): boolean => host.controlInteraction().controlVisible(),
    cancelPendingNavigation: (): boolean => host.controlInteraction().cancelControlNavigationIntent(),
    invalidateBackdrop: (): void => host.controlGeometry().invalidateBackdrop(),
    consumeKeyboard: (): boolean => host.controlGeometry().consumeKeyboardBack(),
    consumeTemporaryBack: (report: () => void): boolean => host.controlGeometry().consumeTemporaryBack(report),
    visualSession: (): ReaderControlSessionState => host.controlDirectory().visualSession(),
    timing: (): ReaderControlHostTiming => host.controlInteraction().controlTiming(),
    requestBackSession: (session: ReaderControlSessionState): void => host.controlInteraction().requestControlSession(session, 'system-back'),
  };
  return {
    speechSession,
    speechView,
    speechProgress,
    speechChapter,
    speechControls,
    readingProgressOwners,
    readingProgressView,
    readingExitEffects,
    readingBackControls,
  };
}
