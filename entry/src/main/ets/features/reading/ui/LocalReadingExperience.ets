import type { UIContext } from '@ohos.arkui.UIContext';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import { projectReaderControlDirectoryTitles, readableReaderDirectoryEntries, readerDirectoryEntryRanks,
  readerEntryNavigationItem }
  from '../presentation/ReaderDirectoryProjection';
import { readerControlStructureKey } from '../../../ui/layout/ReaderKeyboardGeometry';
import { ReaderTextSelectionActivity } from '../application/ReaderKeyboardShortcuts';
import { readerHardwareKeyboardShortcut } from '../../../platform/interaction/ReaderHardwareKeyboard';
import { HarmonySmartGestureHost, ReaderSmartGestureShortcut } from '../../../platform/interaction/HarmonySmartGestureHost';
import { ReaderNativeAlertWindow } from '../../../ui/platform/ReaderNativeAlertWindow';
import { readerHarmonyCapabilities } from '../../../app/HarmonyCapabilityProbe';
import { i18n } from '@kit.LocalizationKit';
import { DEFAULT_READER_SMART_GESTURES, READER_SMART_GESTURE_VIEWPORT_FRACTION, readerSmartGestureAction,
  type ReaderSmartGesture, type ReaderSmartGestureAction, type ReaderSmartGestureSettings } from '../application/ReaderSmartGesturePolicy';
import { ReaderPagePreparationQueue, type ReaderPagePreparationAttempt } from './ReaderPagePreparationCoordinator';
import { ReaderControlMinimumState,
  type ReaderControlMinimumWindow } from './ReaderControlMinimumState';
import { admitReaderControlVisualSnapshot } from './ReaderControlVisualHostPort';
import { CoreReadingAnchor, InitialReadingToc, ParagraphRange, createCoreReadingLayout,
  type CoreReadingLayout, type MeasuredReadingLine } from '../application/ReadingMeasurementFacts';
import { ArkUILineMetric } from './ReaderArkUILineMetric';
import { ReaderMaterializedChapterContext, ReaderRetainedPresentation, ReaderControlSelectionDisplay, ReaderControlSelectionOrigin, ReaderControlSelectionCandidate, PreparedReaderPageTurn, ReaderPageTurnPreparation, ReaderAutomaticPageStart, KnownReadingContentVersion, PreviousChapterMeasurement } from '../presentation/ReaderPagePresentationModels';
import { readingEntryHandoff, retainConfirmedReadingPage, ReaderRetainedPageInput }
  from '../presentation/ReaderRetainedPresentationHost';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderExitRequest } from '../presentation/ReadingEntryPresentation';
import { ReadingCommit } from '../application/ReadingCommit';
import { ReaderDirectoryJumpProof } from '../application/ReaderDirectoryJumpProof';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { readingFailureHint } from '../presentation/ReadingFailurePresentation';
import { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import { completeReaderFirstPage, persistReaderMeasuredProgress, ReaderOrdinaryFirstPagePersistence,
  type ReaderFirstPagePlan } from '../application/ReaderFirstPageAdmission';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderRecoveryOverlay } from './ReaderRecoveryOverlay';
import { ReaderReadingFailureSurface, type ReaderSourceSwitchRecoveryTarget } from './ReaderReadingFailureSurface';
import vibrator from '@ohos.vibrator';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError } from '../../../app/BookRequestScheduler';
import { ReaderReadingImageResources, sameReaderReadingImageResource, sameReadingImageChapter } from '../application/ReaderReadingImageResources';
import { ReaderPreparedPageSettlement, type ReaderPageTurnOriginReceipt,
  type ReaderPageTurnProgressGateway, type ReaderPageTurnProgressTarget } from '../application/ReaderPreparedPageSettlement';
import { ReaderProgressProducerHost, type ReaderProgressProducerIntent, type ReaderContinuousProgressDependencies } from '../application/ReaderProgressProducerHost';
import { TYPE_READER_IMMERSIVE_PROGRESS } from '../../../ui/foundation/ReaderTypography';
import { SourceSwitchProgress } from '../../source/ui/SourceSwitchProgress';
import { ReaderSourceSwitchReveal } from '../presentation/ReaderSourceSwitchReveal';
import { createReaderSourceSwitchWash } from './ReaderSourceSwitchWash';
import type { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';
import type { AnimatorResult } from '@ohos.animator';
import { SourceSwitchCompletionOverlay } from '../../source/ui/SourceSwitchCompletionOverlay';
import { ReaderParagraphLayoutOwner } from './ReaderParagraphLayoutOwner';
import {
  admitForwardMeasuredLines, admitMeasuredPageEnd, advanceMeasuredReadingBatch, planForwardMeasuredImage, planReverseMeasuredImage,
  canonicalMeasuredPageRequest, selectReverseMeasuredLines, type ReaderMeasuredParagraphResult,
} from './ReaderMeasuredPagePipeline';
import { ReaderPhysicalPaginationOwner, ReaderPageTurnTarget, type ReaderAdjacentPageEvidence } from './ReaderPhysicalPaginationOwner';
import { ReadingInteractiveChapterPreparation, type ReadingNearEndCatalogRequest, type ReadingNeighbourPublication } from '../application/ReadingInteractiveChapterPreparation';
import { drawing } from '@kit.ArkGraphics2D';
import { MeasurementParagraph, PhysicalReadingPage } from './ReadingMeasurementModels';
import { collectForwardMeasuredLines, collectReverseMeasuredLines } from '../application/ReadingMeasuredLineTraversal';
import { ReaderNativeTextWindow, readerNativeParagraphHeight, readerNativeParagraphLineExtents } from './ReaderNativeTextWindow';
import type { ReaderNativeLineExtents } from './ReaderNativeLineExtents';
import { ReaderNativeParagraphResources, ReaderNativeParagraphRecipe, readerNativeParagraphKey } from './ReaderNativeParagraph';
import { exportReaderQuoteCard } from './ReaderQuoteCardExporter';
import { readerSystemShareActions } from './ReaderSharePresentation';
import type { ReaderQuoteCardAction, ReaderQuoteCardCopy } from '../application/ReaderShareActions';
import { ReaderNativeTextMeasurement, READER_CHAPTER_TITLE_FONT_SIZE_FP, type ReaderNativeTextStyle } from './ReaderNativeTextMeasurement';
import { READER_MEASUREMENT_UNICODE_PROBE, ReaderMeasurementRun,
  type ReaderTitleMeasurement, type ReaderUnicodeMeasurement } from './ReaderMeasurementRun';
import { ReaderMeasurementContinuation } from '../application/ReaderMeasurementContinuation';
import { readPreparedReadingEntrySnapshot, type ReadingEntryNavigation, type ReadingEntrySnapshot as CoreReadingEntrySnapshot } from '../application/ReadingEntrySnapshot';
import { ReaderTtsPageFollow, planReaderTtsFollowPage, readerTtsFollowActive, type ReaderTtsFollowScope, type ReaderTtsPreparedPage,
  type ReaderTtsFollowLease, type ReaderTtsFollowTarget, type ReaderPageTurnOrigin } from './ReaderTtsPageFollow';
import { createRequestedRemoteReadingPositionContext,
  type RemoteReadingPositionContext, type RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import { ReaderStartupTrace } from '../../../app/ReaderStartupTrace';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import { buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch, type ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import { ReaderSessionLaunchEffects } from './ReaderSessionLaunchEffects';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';
import { ReaderControlCapsuleVerification, type ReaderControlCapsuleSpeechFacts } from './ReaderControlCapsuleVerification';
import { READER_SESSION_LAUNCH_CURVES } from './ReaderSessionLaunchCurves';
import { ReaderSessionLaunchController, type ReaderSessionLaunchTransaction,
  type ReaderSessionLaunchIdentity, type ReaderSessionLaunchCancelReason } from './ReaderSessionLaunchController';
import { ReaderPageChrome } from './ReaderPageChrome';
import { ReaderStatusBarPaper } from './ReaderStatusBarPaper';
import { ReaderChapterLoadingState } from './ReaderChapterLoadingState';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_READING_PAPER } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { readerTransitionLaunchNodes } from '../../../ui/layout/TransitionInvariantEvaluator';
import { ReaderPageGeometryHost } from './ReaderPageGeometryHost';
import { readerAppColor, readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerVisualSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  type ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { settings, type BusinessError } from '@kit.BasicServicesKit';
import { ReaderBrightnessSession } from './ReaderBrightnessSession';
import { readerNativeHighlightValues, type ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import { ReaderPageSettlementTimeline } from './ReaderPageSettlementTimeline';
import { resumeReaderPagePan } from './ReaderPageGestureState';
import { LocalReadingContentMetricIndex } from '../application/LocalReadingWholeBookProgress';
import { errorMessageOf } from '../../../app/ErrorMessage';
import curves from '@ohos.curves';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderControlVerificationSession, type ReaderControlVerificationOrigin } from './ReaderControlVerificationSession';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_DISMISS_MS,
  READER_CONTROL_LAYER_SWITCH_MS, READER_CONTROL_MODULE_SWITCH_MS, READER_SHEET_OPEN_MS,
  READER_SHEET_CLOSE_MS, READER_REDUCED_FADE_MS } from '../../../ui/foundation/ProductMotionTiming';
import { readerControlMotionMs } from './ReaderControlMotionPolicy';
import {
  type LocalReadingAnchor,
  type LocalReadingRetainedProgressReceipt,
  type LocalReadingBookmark,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingToc,
  type LocalReadingTocEntry,
} from '../application/LocalReadingFlowGateway';
import { hilog } from '@kit.PerformanceAnalysisKit';
import inputMethod from '@ohos.inputMethod';
import {
  ReadingSessionFlowGateway,
  type ReadingSessionCommittedProgress,
  type ReadingContentSearchResult,
  type ReadingSessionSource,
} from '../application/ReadingSessionFlowGateway';
import { RemoteChapterCacheRefreshError, type RemoteReadingSession, type RemoteReadingBookSeed } from '../application/RemoteReadingFlowGateway';
import { RemoteReadingGatewayError } from '../application/RemoteReadingContract';
import type { ReadingEntrySnapshot } from '../application/ReadingEntryPreparation';
import {
  loadInitialReading as runInitialReadingEntry,
  restartPreparedReadingEntry as restartInitialReadingEntry,
  type InitialReadingOpenRequest,
  type InitialReadingSelection,
  type InitialReadingSnapshot,
  type ReadingInitialChapterHost,
} from '../application/ReadingInitialChapter';
import {
  remoteReadingFailureKindOf,
  type RemoteReadingFailureKind,
} from '../application/RemoteContentAdmission';
import { projectReaderChapterBookmarkExcerpts, ReaderControlBookmarkRead, readerBookmarkReadFailureSuperseded,
  type ReaderBookIdentity, type ReaderControlBookmarkReadIntent } from '../presentation/ReaderBookmarkProjection';
import {
  contentMetricForChapter,
  validateContentMetricsAgainstToc,
  wholeBookProgressPercent,
} from '../application/LocalReadingWholeBookProgress';
import { ReadingSurfacePageFragment } from './ReadingSurface';
import { ReaderFacingChapterColumn } from './ReaderFacingChapter';
import { ReaderFacingChapterPreview, type ReaderFacingChapter } from './ReaderFacingChapterPreview';
import { readerPageSurfaceIdentity, readerPageTextureIdentity } from './ReaderPageTurnIdentities';
import { ReaderPageInteractionLayer } from './ReaderPageInteractionLayer';
import { readerBookTurnRuntimeSpec, readerRenderStageKind } from './ReaderRenderStageSpec';
import {
  abandonReaderPageGestureTracking,
  cancelReaderPagePan,
  completeReaderPageGestureSettlement,
  createReaderPageGestureState,
  type ReaderPageGestureDecision,
  type ReaderPageGestureState,
  type ReaderPageTapIntent,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';
import {
  beginReaderRapidPageTurn,
  cancelReaderRapidPageTurn,
  completeReaderRapidPageTurn,
  createReaderRapidPageTurnState,
  enqueueReaderRapidPageTurn,
  reachReaderRapidPageBoundary,
  readerRapidPageTurnDirection,
  readerRapidPageTurnHasWork,
  readerRapidPageTurnRetryExhausted,
  requestReaderRapidPageControl,
  retryReaderRapidPageTurn,
  type ReaderRapidPageTurnState,
} from './ReaderRapidPageTurnState';
import {
  ReaderPageTurnRenderPage,
  ReaderPageTurnStage,
  READER_PAGE_TURN_SLOT_A,
  READER_PAGE_TURN_SLOT_B,
  type ReaderPageTurnSlot,
} from './ReaderPageTurnStage';
import { READER_BOOKMARK_RIBBON_HEIGHT, READER_BOOKMARK_RIBBON_WIDTH,
  ReaderBookmarkRibbonFrame, ReaderPageBookmarkSnapshot, readerBookmarkHintAlpha, readerBookmarkRibbonPull,
  readerBookmarkRibbonRest } from '../presentation/ReaderPageBookmarkModel';
import { ReaderPageBookmarkRibbon } from './ReaderPageBookmarkRibbon';
import { ReaderBookmarkPaperWell, ReaderBookmarkPullFeedback, ReaderBookmarkQuietFeedback } from './ReaderBookmarkFeedbackPaint';
import {
  BookTurnTextureBuildInput,
  BookTurnTextureBuilder,
} from './BookTurnTextureBuilder';
import { ReaderBookTurnSurface } from './ReaderBookTurnSurface';
import {
  BOOK_TURN_EVENT_RENDER_FAILURE,
  BOOK_TURN_EVENT_ROLLBACK_COMPLETE,
  BOOK_TURN_EVENT_SLOTS_COMMITTED,
  BOOK_TURN_EVENT_FRAME_PRESENTED,
  BOOK_TURN_EVENT_SURFACE_LOST,
  BOOK_TURN_EVENT_SURFACE_READY,
  BOOK_TURN_EVENT_TERMINAL_RELEASED,
  BOOK_TURN_EVENT_TEXTURE_READY,
  BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT,
  BOOK_TURN_PROFILE_MANUAL,
  BOOK_TURN_PROFILE_RAPID,
  BOOK_TURN_PROFILE_AUTOMATIC,
  BookTurnNativeEvent,
  BookTurnPresentationSession,
} from './BookTurnPresentationSession';
import {
  BOOK_TURN_TEXTURE_CURRENT, BOOK_TURN_TEXTURE_NEXT, BOOK_TURN_TEXTURE_PREVIOUS,
  BookTurnTextureCapture, bookTurnTextureSnapshotScale, captureDecodedBookTurnBitmap,
  type BookTurnTexturePlan, type BookTurnTextureSlot, type BookTurnTextureStep,
} from './BookTurnTextureCapture';
import {
  beginBookTurnMotion,
  bookTurnInput,
  stopBookTurnMotion,
  updateBookTurnMotionInPlace,
  type BookTurnMotionState,
} from './BookTurnMotionState';
import { ReaderContinuousReadingStage, type ReaderContinuousRenderFrame } from './ReaderContinuousReadingStage';
import { ReaderContinuousReadingProjection, type ReaderContinuousHighlight } from './ReaderContinuousReadingProjection';
import { materializeReaderContinuousImage, materializeReaderContinuousText, materializeReaderContinuousTitle,
  ReaderContinuousTextStyleContext } from './ReaderContinuousFragmentMaterializer';
import { readerTextSelectionEnabled } from './ReaderTextSelectionPolicy';
import { readerReadingTopBarHeight, readerReadingTopBarFontsReady } from '../../../ui/chrome/ReaderReadingTopBar';
import { ReaderControlPanel, type ReaderControlPage, type ReaderControlLaunchSource } from './ReaderControlPanel';
import { ReaderSessionLaunchStage } from './ReaderSessionLaunchStage';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { defaultNavigationPreferences, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderControlFontOrder, ReaderControlNavigation, type ReaderControlFontOrderFacts,
  type ReaderControlFontOrderPresentation, type ReaderControlFontOrderReadback,
  type ReaderControlNavigationIntent, type ReaderControlNavigationScope } from './ReaderControlPresentationCoordinator';
import { readerControlPlaybackProfileMatches, type ReaderControlPlaybackProfileReceipt,
  type ReaderControlPlaybackLaunchProfile } from './ReaderControlPlaybackProfile';
import { adoptReaderControlPresentationFacts, readerControlModuleFactsMatch, readerControlPresentationGeometryMatches,
  readerControlPresentationProfileMatches, readerControlPresentationReceipt, refreshReaderControlPresentationEnvironment,
  type ReaderControlMeasuredProfile,
  type ReaderControlMeasuredProfileReader, type ReaderControlPresentationReceipt,
  type ReaderControlModuleFacts } from './ReaderControlMinimumMeasurement';
import { readerControlThemeStyle, type ReaderControlThemeStyle } from './ReaderControlThemeStyle';
import {
  copyReaderControlSessionState, createReaderControlSessionState, dismissReaderControlSession, openReaderControlSession,
  readerControlContentLocation, readerControlTargetLocation, advanceReaderControlSession, resumeReaderControlSessionTarget,
  type ReaderControlSessionState, type ReaderControlLocation,
} from './ReaderControlSessionState';
import {
  backReaderControlHostSession, readerControlHostCloseCommitted, readerControlHostClosing,
  readerControlHostInputEnabled, readerControlHostPage, readerControlHostVisible,
  setReaderControlHostPage, type ReaderControlHostTiming,
} from './ReaderControlHostSession';
import {
  consumeReaderControlKeyboardBack, hideReaderControlKeyboard, readerControlKeyboardVisible,
  type ReaderControlKeyboardHost,
} from '../../../ui/foundation/ReaderKeyboardBack';
import {
  createReaderControlBackdropTouchState, reduceReaderControlBackdropTouch,
  type ReaderControlBackdropRect, type ReaderControlBackdropTouchEvent,
  type ReaderControlBackdropTouchState,
} from './ReaderControlBackdropTouch';
import {
  reconcileReaderControlSelectionProgress,
  type ReaderControlSelectionCommit,
  type ReaderControlSelectionDisplayAnchor,
  type ReaderControlSelectionOwner,
  type ReaderControlSelectionStoredProgress,
  type ReaderControlSelectionTicket,
} from '../application/ReaderControlSelectionTransaction';
import { ReaderChapterSelectionOwner, ReaderDeferredChapterSelection, type ReaderChapterSelectionScope,
  type ReaderChapterSelectionProgressGateway } from '../presentation/ReaderChapterSelectionOwner';
import { ReaderChapterPresentationGate, READER_CHAPTER_LOADING_DELAY_MS,
  type ReaderChapterLoadSource, type ReaderChapterPresentationLease } from '../presentation/ReaderChapterPresentationGate';
import {
  ReaderControlCatalogRouting, ReaderControlSelectionObservations, readerControlBookmarkPosition,
  type ReaderControlCatalogTarget, type ReaderControlDeferredCatalogSelection, type ReaderControlObservedCommit,
  type ReaderDirectorySelectionFacts, type ReaderQuickSearchSelectionFacts,
} from '../presentation/ReaderControlSelectionRouting';
import {
  READER_SESSION_CAPSULE_HEIGHT,
  ReaderSessionCapsule,
  measureReaderSessionCapsule,
  type ReaderSessionCapsuleMetrics,
} from './ReaderSessionCapsule';
import {
  deriveReaderSessionCapsule,
  readerTtsSessionBlocksAutoPageStart,
  type ReaderSessionCapsuleSnapshot,
  type ReaderSessionCapsuleType,
  type ReaderSessionCapsuleState,
  ReaderSessionCapsuleMeasurement,
} from './ReaderSessionCapsuleModel';
import {
  ReaderPageChromeSnapshot,
  ReaderPageOrdinal,
  formatReaderPageOrdinal,
  formatReaderPageProgress,
} from '../presentation/ReaderPageChromeModel';
import { formatReaderPageClock } from '../application/ReaderPageClock';
import {
  ReaderPageChromeMeasurements,
  READER_PAGE_CHROME_FOOTER_GAP,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';
import {
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
  READER_CONTROL_TOP_BAR_HEIGHT,
} from './ReaderControlGeometry';
import { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAutoPagePauseReason, ReaderAutoPageState } from './ReaderAutoPageState';
import { formatReaderAutoPageFullTimerSummary, type ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import { ReaderContentSearchPublication, type ReaderQuickSearchState } from '../presentation/ReaderContentSearchPublication';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from '../presentation/ReaderDirectoryMarkerState';
import type { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import { RulesMutationOwner } from '../../settings/application/RulesMutationOwner';
import { ReaderControlReplaceGateway, ReaderControlReplaceGatewayError } from '../application/ReaderControlReplaceGateway';
import { createReaderControlReplaceState, type ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import { ReaderControlReplacePanel, type ReaderControlReplaceSession } from '../presentation/ReaderControlReplacePanel';
import type { BookSourceJsonSelection } from '../../../app/ReaderHostRegistry';
import type { ReaderReplaceRule, ReaderControlReplaceDraft } from '../application/ReaderReplaceQuickState';
import {
  ReadingSurfaceLayoutMap, prepareReadingChapterLayoutMap, readingChapterLayoutMap, type ReadingDocumentRange,
  type ReadingSurfaceLineMetric,
} from '../application/ReadingSurfaceLayoutMap';
import {
  ReadingPaginationPrefix,
  type ReadingPaginationKey,
} from '../application/ReadingPaginationIndex';
import {
  ReadingChapterWindow, hasKnownReadingImageGeometry, readingChapterWindowOrder,
  type ReadingSessionChapter,
  type ReadingSessionImage,
} from '../application/ReadingChapterWindow';
import {
  admitObservedReadingCatalog, hydrateReadingEntryCatalog,
  type ReadingCatalogProtectedWindow, type ReadingCatalogRequest,
} from '../application/ReadingChapterCatalogAdmission';
import {
  collectReadingParagraphUtf16Ranges,
  readingParagraphBoundaryMode,
  type ReadingParagraphBoundaryMode,
} from '../application/ReadingParagraphProjection';
import { ReadingEntryWindowExpansion, type ReadingEntryWindowLane,
  type ReadingEntryWindowRequest } from '../application/ReadingEntryWindowExpansion';
import { lastMeasurableParagraphScalar, planForwardReadingMeasurement, readMeasuredParagraphWindow,
  projectRetainedReadingParagraphWindow, type ReadingChapterMeasurementProjection } from '../application/ReadingChapterMeasurementPreparation';
import {
  findReusableReadingWindowChapter, lastVisibleReadingScalar, normalizeReadingProgressRatio, prepareReadingChapterOpening,
  resolveReadingChapterOpeningAnchor, type ReadingChapterPositionUpdate,
} from '../application/ReadingChapterOpening';
import { registerReaderFonts, readerRegisteredFontFamily, prepareReaderFontFamily, readerFontFamilyReady } from '../../../ui/foundation/ReaderFonts';
import { motionAnimateParam, readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ComponentContent, window } from '@kit.ArkUI';
import { image } from '@kit.ImageKit';
import {
  readerSessionMorphSourceKindForPage,
  ReaderSessionMorphMeasurements,
  ReaderSessionMorphSourceMeasurement,
} from './ReaderSessionMorphState';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderTtsCredentialStore } from '../../../platform/tts/ReaderTtsCredentialStore';
import { ReaderReadingSystemEventHost } from '../../../app/ReaderReadingSystemEventHost';
import type { ReadingPrefetchActivity } from '../application/ReadingPrefetchHost';
import {
  ReaderWindowChromeStyle,
  ReaderWindowCoordinator,
  ReaderWindowPolicy,
  ReaderWindowPolicyOwner,
} from '../../../app/ReaderWindowCoordinator';
import type { ReaderTtsChapterRef, ReaderTtsConfig } from '../application/ReaderTtsGateway';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import { ReaderTtsTransportOwner, loadNextReaderTtsChapter,
  type ReaderTtsChapterAdvanceLease } from '../application/ReaderTtsTransportOwner';
import { admitReaderTtsRate, ReaderTtsPreparation, type ReaderTtsPreparationIntent,
  type ReaderTtsWarmupOwner } from '../application/ReaderTtsConfigAdmission';
import { ReaderTtsConfigurationHost, type ReaderTtsConfigurationDraft, type ReaderTtsConfigurationSnapshot } from '../application/ReaderTtsConfigurationHost';
import {
  type ReaderTtsSessionCoordinator,
  type ReaderTtsChapterAdvanceInput,
  type ReaderTtsChapterAdvanceRange,
  type ReaderTtsProgressCommit,
  type ReaderTtsStartInput,
} from '../application/ReaderTtsSessionCoordinator';
import { ReaderTtsPlaybackOwner, type ReaderControlPlaybackPresentation, type ReaderTtsPauseWitness,
  type ReaderTtsPlaybackCoordinator, type ReaderTtsPlaybackScope, type ReaderTtsStartPage } from '../application/ReaderTtsPlaybackOwner';
import type { ReaderTtsCapsuleTiming } from '../../../app/ReaderStartupTrace';
import {
  createReaderTtsState,
  readerTtsCoreRateForMultiplier,
  readerTtsRatePercentForMultiplier,
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
  READER_TTS_TIMER_DEFAULT_MINUTES,
  type ReaderTtsState,
  type ReaderTtsTimerMode,
} from '../application/ReaderTtsState';
import { ReaderTtsPreferencesGateway } from '../application/ReaderTtsPreferencesGateway';
import { ReaderTtsPreferenceHost, type ReaderTtsPreferenceAdmission } from '../application/ReaderTtsPreferenceHost';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import { ReaderAppearanceGateway } from '../application/ReaderAppearanceGateway';
import { commitReadingAppearance, loadReadingAppearance } from '../application/ReadingAppearanceAdmission';
import { ReaderAppearanceCommit, type ReaderAppearanceChange, type ReaderAppearanceSaveState } from '../application/ReaderAppearanceStore';
import {
  ReaderChineseConversionGateway,
  type ReaderChineseConversionMode,
} from '../application/ReaderChineseConversionGateway';
import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  resolveMeasuredReaderAppearanceSnapshot,
  sameReaderAppearanceFont,
  setReaderAppearanceAlignment,
  setReaderAppearanceFont,
  setReaderAppearanceFontOrder,
  setReaderAppearanceIndent,
  stepReaderAppearanceMetric,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from '../application/ReaderAppearanceState';
import {
  createNativeReadingPaginationLayoutSignature,
  readerAppearanceChromeTone,
  readerAppearanceSnapshotFontFamily,
  readerAppearanceFontScale,
  readerAppearanceLineHeight,
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
  sameReaderAppearanceLayout,
} from './ReaderAppearanceRenderStyle';
import {
  READER_PHONE_REFERENCE_HEIGHT,
  READER_PHONE_REFERENCE_WIDTH,
  READER_CONTROL_SAFE_TOP_GAP,
  READER_TABLET_REFERENCE_HEIGHT,
  READER_TABLET_REFERENCE_WIDTH,
  ReaderControlLayoutSnapshot,
  ReaderReadingLayoutSnapshot,
  createReaderWindowMetricsLayoutKey,
  resolveReaderControlLayout,
  type ReaderControlCandidateMinimum, type ReaderControlContentMeasurer,
} from './ReaderLayoutGeometry';
import { ReaderSettingsGateway } from '../application/ReaderSettingsGateway';
import { completeReaderWindowSettingsCommit } from '../application/ReaderWindowSettingsCommit';
import { ReaderScreenAwakeLease } from './ReaderScreenAwakeLease';
import { readerPageBottomJustifyGap } from './ReaderPageBottomJustify';
import { ReadingRecordGateway } from '../application/ReadingRecordGateway';
import {
  createDefaultReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  safeReaderWindowSettingsFallback,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
  setReaderWidePageLayout,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
  type ReaderWidePageLayout,
} from '../application/ReaderSettingsState';
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

interface ReaderRetainedChapterFrame {
  readonly renderPage: ReaderPageTurnRenderPage;
  readonly page: PhysicalReadingPage;
  readonly context: ReaderMaterializedChapterContext;
  readonly continuousChrome?: ReaderPageChromeSnapshot;
}

type ReadingPhase = 'loading' | 'measuring' | 'ready' | 'failed';
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

interface ReaderStaticSessionCapsuleOrigin {
  lifecycleToken: number;
  sourceId: string;
  bookId: string;
  location: ReaderControlLocation;
}

const LOCAL_READING_SOURCE_ID = 'local';
const READER_BOOK_TURN_COMPONENT_ID = 'reader-book-turn-surface';
const READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID = 'reader-book-turn-current-page';
/** Contract ceiling for one prepared page texture before RGB8 upload. */
/** Stable empty input for the mounted-but-hidden Reader Control shell. */
const EMPTY_CONTROL_DIRECTORY_ENTRIES: LocalReadingTocEntry[] = [];
/** Engineering ceiling only; it has no visual meaning or design authority. */
const MAX_MEASUREMENT_BATCH_PARAGRAPHS = 8;
const MAX_MEASUREMENT_BATCH_UTF16 = 12 * 1024;
// Keep one lazy row close to one phone viewport. This bounds the error of the
// scalar-to-height interpolation used to restore an intra-row reading anchor.
/**
 * The hidden-layout deadline stops at the first Core persistence boundary.
 * Keep a separate, non-visual upper bound for an initial page that still has
 * no visible body while its chapter read, location resolution, or first
 * progress write is pending. A timeout is recoverable within the reader.
 */
const FIRST_PAGE_READY_TIMEOUT_MS = 30000;
/**
 * consumeMeasuredBatch cancels the layout deadline before completeFirstPage
 * resolves the location anchor (an online-source RPC that can suspend
 * indefinitely). Without a watchdog a suspended anchor leaves
 * measurementCompleting stuck true, canTurnPage false forever, and every
 * tap/drag silently dropped. Normal completion is well under 1s.
 */
const FIRST_PAGE_COMPLETION_DEADLINE_MS = 10000;
const FIRST_PAGE_COMPLETION_MAX_RETRIES = 3;
/** Persist real foreground reading time in bounded atomic deltas. */
/** One visible search page; Core returns an explicit hasMore bit for the rest. */
const READER_CONTENT_SEARCH_PAGE_SIZE = 50;

interface ReaderBookmarkViewport {
  startScalar: number;
  endScalar: number;
}

interface ReaderContinuousChromeCache {
  revision: number;
  chapter: ReadingSessionChapter | undefined;
  chapterTitle: string;
  bookTitle: string;
  clock: string;
  scalar: number;
  scalarCount: number;
  toc: LocalReadingTocEntry[];
  catalogRevision: number;
  catalogPending: boolean;
  navigation: ReadingEntryNavigation | undefined;
  metrics: LocalReadingContentMetrics | undefined;
  snapshot: ReaderPageChromeSnapshot;
}

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
  private readonly sourceSwitchFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') @Watch('reconcileSessionLaunchLayout') private readerAppScheme: string = 'day';
  @StorageProp('readerSystemScheme') private readerSystemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private launchNavigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @StorageLink('readerAppearanceRevision') @Watch('onSharedAppearanceChanged') private sharedAppearanceRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('onAppForegroundChanged') appForeground: boolean = true;
  private appForegroundGeneration: number = 0;
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
  private withdrawExitRequest: (() => void) | undefined;
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

  @State @Watch('sourceSwitchCompletionChanged') private phase: ReadingPhase = 'loading';
  @State private sourceSwitchRevealOpacity: number = 0;
  @State private sourceSwitchVisualSelectionToken: number = -1;
  private readonly sourceSwitchReveal: ReaderSourceSwitchReveal = new ReaderSourceSwitchReveal();
  private sourceSwitchRevealAnimator: AnimatorResult | undefined = undefined;
  @State private chapterTitle: string = '';
  @State private showChapterTitle: boolean = false;
  @State private visibleFragments: ReadingSurfacePageFragment[] = [];
  /**
   * Continuous content is a non-reactive, atomically replaced render
   * projection. `continuousRenderRevision` is its only ArkUI invalidation
   * signal, preventing a new chapter title from rendering with the previous
   * chapter's complex fragment array.
   */
  private readonly continuousProjection: ReaderContinuousReadingProjection<ReadingSurfacePageFragment> =
    new ReaderContinuousReadingProjection<ReadingSurfacePageFragment>();
  private continuousEntryPositionReady: boolean = false;
  private continuousTitleRecipe: ReaderNativeParagraphRecipe | undefined;
  @State private continuousRenderRevision: number = 0;
  // Only the stationary chrome consumes this display value. Scalar/viewport
  // cursor updates must not invalidate the List or its paragraph projection.
  @State private continuousChromeProgressText: string = '';
  private continuousChromeCache: ReaderContinuousChromeCache | undefined = undefined;
  private continuousChangedFragmentIndex: number = -1;
  private continuousInitialFragmentIndex: number = 0;
  private continuousInitialFragmentProgress: number = 0;
  private continuousInitialAnchorRevision: number = 0;
  private continuousProgrammaticScrollIntent: (() => void) | undefined = undefined;
  // Visible indices are progress cursors, not render inputs. Keeping them
  // non-reactive prevents every List settle callback from rebuilding the
  // entire reading stage and flashing the already rendered rows.
  @State private pageTurnOffsetX: number = 0;
  @State private pageTurnPresentationWidth: number = 0;
  @State private pageTurnDirection: ReaderPageTurnDirection | undefined = undefined;
  /** Stable physical slot that owns the logical current page. */
  @State private pageTurnCurrentSlot: ReaderPageTurnSlot = 'a';
  /** Native/settle protocol phase; no build node consumes this marker. */
  private pageTurnPresentationPhase: ReaderPagePresentationPhase = 'idle';
  private pageTurnUnknownNotifiedGeneration: number = -1;
  private pageTurnReconciliationPending: boolean = false;
  @State private pageTurnSettlementActive: boolean = false;
  @State private bookmarkPageOffsetY: number = 0;
  @State private bookmarkRibbonFrame: ReaderBookmarkRibbonFrame | undefined = undefined;
  @State private bookmarkPullHintOpacity: number = 0;
  private bookmarkRollbackGeneration: number = 0;
  private bookmarkRollbackAnimator: AnimatorResult | undefined = undefined;
  @State private bookmarkPendingTarget: string = '';
  private bookmarkPendingAnchor: string = '';
  private bookmarkPendingOwner: string = '';
  private bookmarkMutationGeneration: number = 0;
  private bookmarkMutationConfirmed: boolean = false;
  /** Shared gesture preview directly paints the right-corner feedback. */
  @State private bookmarkPreviewChanged: boolean = false;
  // The raw arena releases its pointer before delivering the terminal
  // bookmark callback. Keep the admitted page/segment identity, not a live
  // pointer-id requirement, until that callback consumes it exactly once.
  private bookmarkGestureAnchor: string = '';
  private bookmarkGestureLifecycle: number = -1;
  private bookmarkGestureSelection: number = -1;
  private bookmarkGesturePointerEpoch: number = -1;
  private bookmarkGestureInputRevision: number = -1;
  private bookmarkPreviewStatus: 'unknown' | 'empty' | 'bookmarked' = 'unknown';
  private bookmarkPreviewOwner: string = '';
  @State private bookmarkUnavailableMessage: string = '';
  private bookmarkUnavailableOwner: string = '';
  private bookmarkUnavailableGeneration: number = 0;
  private bookmarkUnavailableTimer: number = -1;
  private bookmarkStatusEntries: LocalReadingTocEntry[] | undefined = undefined;
  private bookmarkStatusAnchor: string = '';
  private bookmarkStatusValue: 'unknown' | 'empty' | 'bookmarked' = 'unknown';
  /** Visual-only revision for canonical bookmark changes; MOVE does not bump it. */
  @State private bookmarkPresentationRevision: number = 0;
  /** Native simulation surface remains mounted; this immediate opacity gate
   *  hands final composition to ArkUI without submitting a transparent EGL
   *  frame. The generation rejects delayed hides/clears from older turns. */
  @State private bookTurnSurfaceOpacity: number = 1;
  /** Surface callback epoch used only by native/ArkUI barrier guards. */
  private bookTurnSurfaceGeneration: number = 0;
  /** Revision delivered to the mounted current slot before a snapshot request. */
  private bookTurnArkUIContentRevision: number = -1;
  private bookTurnArkUIReadyRevision: number = -1;
  private bookTurn2DFallbackPending: boolean = false;
  /** One reactive ownership bit; MOVE geometry itself remains non-reactive. */
  @State private pageTurnInputOwned: boolean = false;
  @State private pageTurnInputRevision: number = 0;
  @State private pageTurnReadinessRevision: number = 0;
  private activePagePointerId: number = -1;
  private pagePointerEpoch: number = 0;
  private pageTurnFrozenRevision: number = -1;
  private pageTurnFrozenCurrent: ReaderPageTurnRenderPage | undefined = undefined;
  private pageTurnFrozenPrevious: ReaderPageTurnRenderPage | undefined = undefined;
  private pageTurnFrozenNext: ReaderPageTurnRenderPage | undefined = undefined;
  private pageTurnFrozenLayout: ReaderReadingLayoutSnapshot | undefined = undefined;
  private pageTurnAdmittedPrepared: PreparedReaderPageTurn | undefined = undefined;
  /** Assignment-only revision exposing non-reactive prepared page models to build(). */
  @State private pageTurnRenderRevision: number = 0;
  @State private viewportWidth: number = 0;
  @State private viewportHeight: number = 0;
  /** Forces a fresh hidden measurement tree without recreating controllers in build. */
  @State private measurementEpoch: number = 0;
  /** Logged/returned synchronously; there is no rendered failure surface. */
  @State private failureCode: string = '';
  @State private failureHint: string = readingFailureHint('');
  private cacheNoticeLifecycle: number = -1;
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
  @State private controlBookmarkLoadFailed: boolean = false;
  private readonly controlBookmarkRead: ReaderControlBookmarkRead = new ReaderControlBookmarkRead();
  // External overlays may temporarily obscure the reader. In-reader Full
  // Directory is now the same control session, not an external overlay route.
  @Prop @Watch('onControlObscuredChanged') controlObscured: boolean = false;
  /** Directory/source-switch/hidden routes explicitly transfer pointer ownership away from the reader. */
  @Prop @Watch('onControlInputBoundaryChanged') interactionBlocked: boolean = false;
  @State @Watch('onControlSessionChanged') private controlSession: ReaderControlSessionState =
    createReaderControlSessionState();
  /**
   * Latest presentation sample from the production ReaderControlPanel.  This is a
   * plain host field on purpose: it lets Back/close retarget from the image
   * currently under the finger without making every VSync sample reactive in
   * the reading page.
   */
  private latestControlVisualSession: ReaderControlSessionState = createReaderControlSessionState();
  private readonly controlVerification: ReaderControlVerificationSession = new ReaderControlVerificationSession();
  private readonly capsuleVerification: ReaderControlCapsuleVerification = new ReaderControlCapsuleVerification(this.controlVerification);
  @State private controlOpenRevision: number = 0;
  private controlTemporaryLayer: ReaderControlTemporaryInputKind = '';
  @State private controlTemporaryLayerPresented: ReaderControlTemporaryInputKind = '';
  @State private dismissControlTemporaryRevision: number = 0;
  @State private retireControlTemporaryRevision: number = 0;
  @State private quickSearchQuery: string = '';
  private readonly quickSearchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  @State private quickSearchRevision: number = 0;
  @State private brightnessPercent: number = 50;
  @State private brightnessAutomatic: boolean = true;
  @State private brightnessRevision: number = 0;
  @State private autoPageRevision: number = 0;
  private readonly autoPageCoordinator: ReaderAutoPageCoordinator = new ReaderAutoPageCoordinator({
    now: (): number => readerMotionNowMs(),
    schedule: (callback: () => void, delayMs: number): number => setTimeout(callback, delayMs),
    cancel: (handle: number): void => clearTimeout(handle),
    active: (): boolean => this.mounted && this.appForeground && !this.exitRequested,
    ready: (): boolean => this.phase === 'ready',
    canResumeTurn: (): boolean => !this.pageTurnSettlementActive && this.preparedSettlement.prepared === undefined &&
      this.pageTurnPreparation === undefined && this.canTurnPage(),
    turn: (): ReaderPageTurnOutcome => this.performPageTurn('next', 'autoTimer'),
    changed: (): void => {
      this.autoPageRevision += 1;
      const status = this.automaticReadingState().status;
      if (status !== 'running') this.cancelAutomaticPageStart?.('autoTimer');
      if (status === 'stopped' && this.staticSessionCapsuleOrigin?.location.module === 'autoPage') {
        this.staticSessionCapsuleOrigin = undefined;
      }
      this.observeReadingPrefetch();
    },
  });
  private automaticReadingState(): Readonly<ReaderAutoPageState> {
    return this.autoPageCoordinator.snapshot(this.autoPageRevision);
  }
  private automaticReadingConfiguration(): Readonly<ReaderAutoPageFullConfiguration> {
    return this.autoPageCoordinator.configurationAt(this.autoPageRevision);
  }
  @State private controlReplaceState: ReaderControlReplaceState = createReaderControlReplaceState();
  @State private appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @State private chineseConversionMode: ReaderChineseConversionMode = 'none';
  @State private chineseConversionOperationId: string = '';
  private chineseConversionActorKey: string = '';
  private chineseConversionActor: ((mode: ReaderChineseConversionMode) => void) | undefined;
  @State private readerSettingsSnapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @State private readerRecoveryRequested: boolean = false;
  @State private readerRecoveryRequestIdentity: string = '';
  @State private readerRecoveryView: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private readerRecoveryActionLabel: string = '重试';
  private readerRecoveryAction: (() => void) | undefined = undefined;
  private readerRecoveryKind: 'general' | 'progress' | 'presentation' = 'general';
  private readerRecoveryIdentity: string = '';
  private readerRecoveryProgressRevision: string | undefined = undefined;
  @State private readerSettingsRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private ttsPreferencesRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private readerSettingsRecoveryBusy: boolean = false;
  @State private appearanceSaveRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private appearanceSaveRecoveryBusy: boolean = false;
  private appearanceSaveRecoveryIdentity: string = '';
  private appearanceSaveRevision: number = 0;
  private appearanceSaveUnsubscribe: (() => void) | undefined = undefined;
  @State private ttsPreferencesRecoveryBusy: boolean = false;
  @State private ttsConfigurationLoading: boolean = false;
  @State private ttsConfigurationLoadFailed: boolean = false;
  private ttsConfigurationMetadataFailed: boolean = false;
  @State private ttsConfigurationRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private replaceRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };

  @State private ttsState: ReaderTtsState = createReaderTtsState(false);
  // TTS progress callbacks can arrive out of order around an utterance
  // boundary. Keep the follow-page lane monotonic so a late callback cannot
  // enqueue a reverse turn or duplicate the same destination while a turn is
  // still settling.
  private readonly ttsPageFollow: ReaderTtsPageFollow = new ReaderTtsPageFollow();
  private pageTurnSettlementOrigin: ReaderPageTurnOrigin = 'manual';
  private pageTurnSettlementTtsOwner: ReaderTtsFollowLease | undefined = undefined;
  private pageTurnAutomaticStart: ReaderAutomaticPageStart | undefined = undefined;
  @State private ttsTimerMode: ReaderTtsTimerMode = 'duration';
  @State private ttsTimerMinutes: number = READER_TTS_TIMER_DEFAULT_MINUTES;
  @State private ttsTimerSeconds: number = 0;
  @State private ttsFollowHighlight: boolean = true;
  @State private ttsPauseOnInterruption: boolean = true;
  @State private ttsAllowMixing: boolean = false;
  @State private ttsBackgroundPlayback: boolean = true;
  @State private ttsKeepScreenOn: boolean = false;
  @State private ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @State private ttsEngine: string = 'system';
  @State private ttsHttpEngines: ReaderHttpTtsConfig[] = [];
  @State private ttsVoiceOptions: ReaderTtsVoiceOption[] = [];
  @State private ttsLanguage: string = 'zh-CN';
  @State private ttsPerson: number = 0;
  /** Only an accepted field advances the persistence revision. */
  @State private pageChromeClockText: string = formatReaderPageClock(Date.now());
  @State private sessionCapsuleMeasuredWidth: number = 0;
  @State private sessionCapsuleMeasuredHeight: number = READER_SESSION_CAPSULE_HEIGHT;
  // One presentation transaction and immutable sample own every launch actor.
  @State private sessionLaunch: ReaderSessionLaunchTransaction | undefined = undefined;
  @State private sessionLaunchControlSource: ReaderControlLaunchSource | undefined = undefined;
  private sessionLaunchSourceSample: ReaderSessionLaunchSample | undefined = undefined;
  @State private sessionLaunchStageOpacity: number = 1;
  @State private sessionLaunchFooterExiting: boolean = false;
  @State private sessionLaunchFooterOffset: number = 0;
  @State private sessionLaunchFooterExitProgress: number = 0;
  @State private sessionLaunchFooterOpacity: number = 1;
  private readonly sessionLaunchController: ReaderSessionLaunchController =
    new ReaderSessionLaunchController(READER_SESSION_LAUNCH_CURVES);
  private readonly sessionLaunchEffects: ReaderSessionLaunchEffects =
    new ReaderSessionLaunchEffects(this.sessionLaunchController, this.capsuleVerification, {
      read: (): ReaderSessionLaunchTransaction | undefined => this.sessionLaunch,
      publish: (launch: ReaderSessionLaunchTransaction): void => { this.sessionLaunch = launch; },
      ready: (): boolean => this.mounted && this.appForeground && !this.exitRequested,
      layoutCurrent: (): boolean => this.sessionLaunchSourceLayoutKey === this.sessionLaunchLayoutKey(),
      retireForLayout: (): void => this.cancelSessionLaunch('sourceChanged'),
      context: (): UIContext => this.getUIContext(),
      observing: (): boolean => this.controlVerification.observing(),
      drainPageTurn: (): void => this.drainPageTurnPreparationQueue(),
      hideControl: (): void => this.commitSessionLaunchControlHidden(),
      updateWindow: (): void => this.applyWindowPolicyForChromeOwner(),
      viewportRevision: (): number => this.readerWindowMetricsRevision,
      reducedMotion: (): boolean => this.reduceMotion,
      stageOpacity: (): number => this.sessionLaunchStageOpacity,
      setStageOpacity: (opacity: number): void => { this.sessionLaunchStageOpacity = opacity; },
      finalizeFooter: (): void => {
        if (!this.sessionLaunchFooterExiting) return;
        this.sessionLaunchFooterOffset = 0;
        this.sessionLaunchFooterExitProgress = 1;
        this.sessionLaunchFooterOpacity = 1;
      },
      finish: (released?: ReaderSessionLaunchTransaction): void => this.finishSessionCapsuleMorph(released),
    });
  private sessionLaunchSourceTtsState: ReaderTtsState = createReaderTtsState(false);
  private sessionLaunchSourceAutoStatus: ReaderAutoPageStatus = 'stopped';
  private sessionLaunchSourceControl: ReaderControlSessionState = createReaderControlSessionState();
  private staticSessionCapsuleOrigin: ReaderStaticSessionCapsuleOrigin | undefined = undefined;
  private sessionLaunchChromeAnchor: string = '';
  private sessionLaunchSourceLayoutKey: string = '';
  private sessionLaunchSourceMinimum: ReaderControlPlaybackLaunchProfile | undefined = undefined;
  private sessionLaunchChrome: ReaderPageChromeSnapshot = new ReaderPageChromeSnapshot('', '', '', '', true, 96, 24);
  private readonly sessionMorphMeasurements: ReaderSessionMorphMeasurements = new ReaderSessionMorphMeasurements();
  private sessionLaunchTopExit: number = 0;
  private sessionLaunchDockExit: number = 0;
  @State private sessionControlClosing: boolean = false;
  @State private windowControlsPresented: boolean = false;
  private appearanceLoaded: boolean = false;
  private entryAppearanceReady: boolean = false;

  private sessionGateway: ReadingSessionFlowGateway | undefined = undefined;
  private remoteCatalogAdmissionRevision: number = 0;
  private preparedReadingEntry: ReadingEntrySnapshot | undefined = undefined;
  entryPresentationProvider: () => ReaderRetainedPresentation | undefined = (): ReaderRetainedPresentation | undefined => undefined;
  private readonly replaceRuntime: ReaderRuntimeOwner = ReaderRuntimeOwner.current();
  private readonly replacePanel: ReaderControlReplacePanel = new ReaderControlReplacePanel(
    RulesMutationOwner.forRuntime(this.replaceRuntime), new ReaderControlReplaceGateway(this.replaceRuntime), {
      readState: (): ReaderControlReplaceState => this.controlReplaceState,
      publishState: (state: ReaderControlReplaceState): void => { this.controlReplaceState = state; },
      recovery: (): ReaderRecoveryView => this.replaceRecovery,
      publishRecovery: (recovery: ReaderRecoveryView): void => { this.replaceRecovery = recovery; },
      panelOpen: (): boolean => this.controlVisible() && readerControlContentLocation(this.controlSession).module === 'replace',
      committedPresentationIdentity: (): string => this.controlMinimumCommittedIdentity(),
      controlInputEnabled: (): boolean => this.isControlInputEnabled(),
    }, {
      session: (): ReaderControlReplaceSession => ({ lifecycleToken: this.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId }),
      runtimeCurrent: (): boolean => this.readerReplaceRuntimeCurrent(),
      sessionActive: (lifecycle: number): boolean => this.isSessionActive(lifecycle),
      chapter: (): ReadingSessionChapter | undefined => this.chapter,
      selectionToken: (): number => this.chapterSelectionToken,
      selectionActive: (lifecycle: number, selection: number): boolean => this.isSelectionActive(lifecycle, selection),
      persistPosition: (): Promise<() => boolean> => this.persistBeforeContentMutation(),
      reloadContent: (lifecycle: number, book: string): void => this.reloadCurrentPageAfterReplacePersist(lifecycle, book),
    }, (error: Error): boolean => error instanceof ReaderControlReplaceGatewayError && error.writeUncertain);
  private readonly appearanceGateway: ReaderAppearanceGateway =
    new ReaderAppearanceGateway(ReaderRuntimeOwner.current());
  private readonly chineseConversionGateway: ReaderChineseConversionGateway =
    new ReaderChineseConversionGateway(ReaderRuntimeOwner.current());
  private readonly readerSettingsGateway: ReaderSettingsGateway =
    new ReaderSettingsGateway(ReaderRuntimeOwner.current());
  private readonly ttsPreferences: ReaderTtsPreferenceHost = new ReaderTtsPreferenceHost(
    new ReaderTtsPreferencesGateway(ReaderRuntimeOwner.current()), {
      captureOwner: (): (() => boolean) => this.captureTtsPreferenceOwner(),
      voices: (): ReaderTtsVoiceOption[] => this.ttsVoiceOptions,
      publishVoices: (voices: ReaderTtsVoiceOption[]): void => { this.ttsVoiceOptions = voices; },
      admit: (input: ReaderTtsPreferenceAdmission, current: () => boolean): void => this.admitTtsPreferences(input, current),
      notice: (message: string, canRetry: boolean, busy?: boolean): void => this.setReaderPreferenceNotice('tts', message, canRetry, busy),
      log: (stage: string, error: Error): void => this.logTtsFailure(stage, error),
    });
  private screenAwakeLease: ReaderScreenAwakeLease | undefined = undefined;
  private screenAwakeKeepScreenOn: boolean = false;
  private readingSystemEventHost: ReaderReadingSystemEventHost | undefined = undefined;
  private readingPrefetchScreenLocked: boolean = false;
  private readonly readingRecordGateway: ReadingRecordGateway =
    ReaderRuntimeOwner.current().getReadingRecordGateway();
  private readonly ttsTransport: ReaderTtsTransportOwner = new ReaderTtsTransportOwner();
  private ttsConfig: ReaderTtsConfig | undefined = undefined;
  private ttsConfigurationHost: ReaderTtsConfigurationHost | undefined = undefined;
  private ttsConfigurationNotice: string | undefined = undefined;
  private readonly unicodeProbeController: TextController = new TextController();
  private chapterTitleMeasurementController: TextController = new TextController();
  private measuredChapterTitleHeightVp: number = 0;
  private measuredNativeTitle: ReaderNativeParagraphRecipe | undefined = undefined;
  private readonly progressProducers: ReaderProgressProducerHost = new ReaderProgressProducerHost();
  private readonly paragraphLayout: ReaderParagraphLayoutOwner<ParagraphRange, MeasurementParagraph> =
    new ReaderParagraphLayoutOwner<ParagraphRange, MeasurementParagraph>();
  private readonly physicalPagination: ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment> =
    new ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment>();
  private readonly chapterWindow: ReadingChapterWindow = new ReadingChapterWindow();
  private readonly interactiveChapterPreparation: ReadingInteractiveChapterPreparation = new ReadingInteractiveChapterPreparation();
  /** Unique Host-created display resources owned by this reader session. */
  private readonly readingImageResources: ReaderReadingImageResources =
    new ReaderReadingImageResources(ReaderRuntimeOwner.current(), (error: Error): void => {
      hilog.error(0x5244, 'Reader', '%{private}s', `Reading image release failed: ${this.errorMessage(error)}`);
    });
  private readonly knownContentVersions: KnownReadingContentVersion[] = [];
  private chapterLayoutMap: ReadingSurfaceLayoutMap | undefined = undefined;
  private visiblePage: PhysicalReadingPage | undefined = undefined;
  private continuousScroller: Scroller | undefined = undefined;
  private continuousVisibleScalar: number = 0;
  private continuousProgressRevision: number = 0;
  private pageTurnTransactionSerial: number = 0;
  private continuousAnchorSampler: (() => void) | undefined = undefined;
  private continuousUserInteractionActive: boolean = false;
  private preparedPreviousPage: PreparedReaderPageTurn | undefined = undefined;
  private preparedNextPage: PreparedReaderPageTurn | undefined = undefined;
  private pageTurnPreparation: ReaderPageTurnPreparation | undefined = undefined;
  private readonly pageTurnPreparationQueue: ReaderPagePreparationQueue = new ReaderPagePreparationQueue();
  /** Dynamic net target; every manual page request is retained without allocating a work queue. */
  private rapidPageTurnState: ReaderRapidPageTurnState = createReaderRapidPageTurnState();
  private pendingPointerSegmentReserved: boolean = false;
  private pageTurnGeneration: number = 0;
  private observedControlCloseRevision: number = 0;
  private observedControlPage: ReaderControlPage = 'home';
  private observedControlModule: string = 'home';
  /** Module visits, not Quick/Full frames, own delayed playback UI effects. */
  private controlModuleVisitRevision: number = 0;
  @State private controlMinimumRevision: number = 0;
  @State private controlMinimumReady: boolean = false;
  private readonly controlMinimum: ReaderControlMinimumState<ReaderControlMeasuredProfile, ReaderControlModuleFacts> =
    new ReaderControlMinimumState<ReaderControlMeasuredProfile, ReaderControlModuleFacts>({
      sourceId: (): string => this.sourceId,
      bookId: (): string => this.bookId,
      lifecycleToken: (): number => this.lifecycleToken,
      openRevision: (): number => this.controlOpenRevision,
      visitRevision: (): number => this.controlModuleVisitRevision,
      expandedLayout: (): boolean => this.expandedLayout,
      minimumRevision: (): number => this.controlMinimumRevision,
    });
  @State private controlPresentationReceipt: ReaderControlPresentationReceipt | undefined = undefined;
  @State private controlNavigationIntent: ReaderControlNavigationIntent | undefined = undefined;
  private readonly controlNavigation: ReaderControlNavigation = new ReaderControlNavigation({
    scope: (): ReaderControlNavigationScope => ({ sourceId: this.sourceId, bookId: this.bookId,
      lifecycleToken: this.lifecycleToken, openRevision: this.controlOpenRevision, visitRevision: this.controlModuleVisitRevision }),
    session: (): ReaderControlSessionState => this.controlSession,
    visualSession: (): ReaderControlSessionState => this.latestControlVisualSession,
    readIntent: (): ReaderControlNavigationIntent | undefined => this.controlNavigationIntent,
    publishIntent: (intent: ReaderControlNavigationIntent | undefined): void => { this.controlNavigationIntent = intent; },
    publishSession: (session: ReaderControlSessionState): void => { this.controlSession = session; },
    hasCommittedReceipt: (): boolean => this.controlPresentationReceipt !== undefined,
    invalidateMinimumRequest: (): void => this.controlMinimum.invalidateRequest(),
    accept: (origin: ReaderControlVerificationOrigin, source: ReaderControlSessionState, next: ReaderControlSessionState): void =>
      this.controlVerification.accept(origin, source, next, this.controlOpenRevision),
  });
  private controlPlaybackProfile: ReaderControlPlaybackProfileReceipt | undefined = undefined;
  private controlInputRevision: number = 0;
  private controlBackdropRegions: ReaderControlBackdropRect[] = [];
  private controlBackdropGeometryReady: boolean = false;
  private controlBackdropState: ReaderControlBackdropTouchState = createReaderControlBackdropTouchState();
  private controlBackdropPath: drawing.Path | undefined = undefined;
  private controlBackdropPathWidth: number = -1;
  private controlBackdropPathHeight: number = -1;
  private controlBackdropPathRadius: number = -1;
  private pageTurnSlideTimeline: ReaderPageSettlementTimeline | undefined = undefined;
  private pageTurnGestureState: ReaderPageGestureState = createReaderPageGestureState();
  private readonly bookTurnSession: BookTurnPresentationSession =
    new BookTurnPresentationSession(READER_BOOK_TURN_COMPONENT_ID);
  private bookTurnMotion: BookTurnMotionState | undefined = undefined;
  private readonly bookTurnTexture: BookTurnTextureCapture<ReaderPageTurnRenderPage, image.PixelMap> =
    new BookTurnTextureCapture<ReaderPageTurnRenderPage, image.PixelMap>({
      postFrame: (callback: () => void): void => this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(callback)),
      mounted: (): boolean => this.mounted,
      plan: (): BookTurnTexturePlan<ReaderPageTurnRenderPage> | undefined => this.bookTurnTexturePlan(),
      preferredDirection: (): ReaderPageTurnDirection => this.preferredPageTextureDirection,
      pageGeneration: (): number => this.pageTurnGeneration,
      allows: (step: BookTurnTextureStep): boolean => this.allowsBookTurnTextureStep(step),
      snapshot: (slot: BookTurnTextureSlot, page: ReaderPageTurnRenderPage, retained: boolean, mayDecode: () => boolean):
        Promise<image.PixelMap | undefined> | undefined => this.bookTurnTextureSnapshot(slot, page, retained, mayDecode),
      captureFailed: (slot: BookTurnTextureSlot, generation: number, message: string): void =>
        this.failBookTurnTextureCapture(slot, generation, message),
      release: (bitmap: image.PixelMap): void => { bitmap.release(); },
    }, this.bookTurnSession);
  private bookTurnTextureContent: ComponentContent<BookTurnTextureBuildInput> | undefined = undefined;
  private bookTurnTextureBuildPage: ReaderPageTurnRenderPage | undefined = undefined;
  private preferredPageTextureDirection: ReaderPageTurnDirection = 'next';
  /** Rare capability state; unlike MOVE geometry it must rebuild settings/stage semantics. */
  @State private bookTurnRuntimeFailed: boolean = false;
  private bookTurnSurfaceRecoveryPending: boolean = false;
  private bookTurnAwaitingSlotCommit: boolean = false;
  private pageTurnPerfStartedAtMs: number = 0;
  private pageTurnPerfStyle: string = '';
  private pageTurnPerfPath: string = '';
  private pageTurnPerfDirection: string = '';
  private pageTurnSettlementGeneration: number = 0;
  /** Immutable geometry shared by animation, freshness, and the Core commit join. */
  private pageTurnSettlementLayout: ReaderReadingLayoutSnapshot | undefined = undefined;
  private pageTurnAnimationFinished: boolean = false;
  private readonly preparedSettlement: ReaderPreparedPageSettlement<PreparedReaderPageTurn> =
    new ReaderPreparedPageSettlement<PreparedReaderPageTurn>({
      current: (prepared: PreparedReaderPageTurn, lifecycle: number, generation: number): boolean =>
        this.isPreparedPageTurnCommitCurrent(prepared, lifecycle, generation),
      canPresent: (prepared: PreparedReaderPageTurn): boolean => this.canPresentOrdinaryPage(prepared.context.chapter),
      persistPresented: (prepared: PreparedReaderPageTurn, lifecycle: number): Promise<void> =>
        this.persistPresentedPageTurn(prepared, lifecycle),
      write: (prepared: PreparedReaderPageTurn, current: () => boolean): Promise<LocalReadingProgress> =>
        this.writePreparedPageTurn(prepared, current),
      acquireWrite: (lifecycle: number): (() => void) => this.acquirePreparedPageWrite(lifecycle),
      gateway: (): ReaderPageTurnProgressGateway => this.activeGateway(),
      bookId: (): string => this.bookId,
      position: (prepared: PreparedReaderPageTurn): ReaderPageTurnProgressTarget => ({
        chapterIndex: prepared.context.chapter.chapterIndex, chapterOffset: prepared.page.startScalar,
        bodyVersion: prepared.context.chapter.bodyVersion, processingVersion: prepared.context.chapter.processingVersion,
      }),
      origin: (): ReaderPageTurnOriginReceipt | undefined => this.lastCommittedProgress,
      releaseUnknownInput: (): void => this.releasePageTurnRecoveryInput(),
      finish: (generation: number, presented?: boolean): void => this.finishPreparedPageTurnSettlement(generation, presented),
      reportFailure: (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience prepared page commit failed: ${this.errorMessage(error)}`),
    }, {
      set: (delay: number, callback: () => void): number => setTimeout(callback, delay),
      clear: (handle: number): void => clearTimeout(handle),
    });
  /** Explicit direct-page measurement ticket; never inferred from auto/TTS state. */
  private ordinaryPageMeasurementSelection: number = -1;
  private ordinaryPageMeasurementLifecycle: number = -1;
  private ordinaryPageMeasurementChapter: number = -1;
  private ordinaryPageMeasurementLayout: string = '';
  private pageTurnPendingExit: boolean = false;
  private pageTurnPendingViewportWidth: number = 0;
  private pageTurnPendingViewportHeight: number = 0;
  private pageTurnPendingWindowReflow: boolean = false;
  private pageTurnPendingWindowSettings: ReaderSettingsSnapshot | undefined = undefined;
  @State private readerWindowPolicyPending: boolean = false;
  private readerWindowPolicyGeneration: number = 0;
  private pageTurnPendingAppearanceSnapshot: ReaderAppearanceSnapshot | undefined = undefined;
  private pageTurnPendingReplaceReload: boolean = false;
  private pageTurnPendingProjectionChapterIndex: number = -1;
  private pageTurnPendingRequestedChapterChange: boolean = false;
  private pageTurnPendingChapterSelection: ReaderDeferredChapterSelection | undefined = undefined;
  private materializedContentVersion: string = '';
  private readonly brightnessSession: ReaderBrightnessSession = new ReaderBrightnessSession({
    writer: () => ReaderWindowCoordinator.brightness(),
    isMounted: (): boolean => this.mounted,
    observeSystemBrightness: (): Promise<string> | undefined => {
      const context = this.getUIContext().getHostContext();
      return context === undefined ? undefined :
        settings.getValue(context, settings.display.SCREEN_BRIGHTNESS_STATUS);
    },
    readAutomatic: (): boolean => this.brightnessAutomatic,
    readPercent: (): number => this.brightnessPercent,
    publishAutomatic: (automatic: boolean): void => { this.brightnessAutomatic = automatic; },
    publishPercent: (percent: number): void => { this.brightnessPercent = percent; },
    publishRevision: (): void => { this.brightnessRevision += 1; },
    reportFailure: (operation: string, error: Error): void => {
      hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness ${operation} failed: ${error.message}`);
    },
  });
  private pageChromeStatusTimer: number = -1;
  private pendingPageChromeClockText: string | undefined = undefined;
  private measuredSessionCapsuleType: ReaderSessionCapsuleType | undefined = undefined;
  private sessionCapsuleMeasuredIdentity: string = '';
  private pendingSessionCapsuleMeasurement: ReaderSessionCapsuleMeasurement | undefined = undefined;
  // Frozen readers no longer observe live session state; release must itself
  // invalidate their observers so a paused/stopped update cannot be stranded.
  @State private pageTurnSessionCapsuleFrozen: boolean = false;
  private pageTurnSessionCapsuleSnapshot: ReaderSessionCapsuleSnapshot | undefined = undefined;
  private batchProcessing: boolean = false;
  /** Bounds a first entry that has no previously committed visible body. */
  private firstPageReadyDeadlineTimer: number = -1;
  private readonly chapterPresentation: ReaderChapterPresentationGate<ReaderRetainedChapterFrame> =
    new ReaderChapterPresentationGate<ReaderRetainedChapterFrame>();
  private chapterLoadingDelayTimer: number = -1;
  private retainedTtsOwner: ReaderTtsFollowLease | undefined = undefined;
  private retainedTtsCommitAdmitted: boolean = false;
  /** Makes a cleared first-page deadline unable to fail a later selection. */
  private firstPageReadyDeadlineGeneration: number = 0;
  /** Watchdog timer bounding a rollback animation whose finish callback may be lost. */
  /** Bounds completeFirstPage once the layout deadline has been cancelled. */
  private firstPageCompletionDeadlineTimer: number = -1;
  /** Bounded re-measurement attempts after a suspended first-page anchor. */
  private firstPageCompletionRetryCount: number = 0;
  /** Snapshot that stale watchdog fires cannot act on a newer selection. */
  private firstPageCompletionGeneration: number = 0;
  /** Backoff timer re-draining a preparation attempt rejected while busy. */
  private chapter: ReadingSessionChapter | undefined = undefined;
  /** Cold cross-chapter previous-page measurement; the old visible page stays mounted. */
  private previousChapterMeasurement: PreviousChapterMeasurement | undefined = undefined;
  private previousChapterLayoutPreparation: PreviousChapterMeasurement | undefined = undefined;
  private restoredProgress: LocalReadingProgressState | undefined = undefined;
  private consumedBookmarkAnchorRequestId: number = -1;
  @State private tocEntries: LocalReadingTocEntry[] = [];
  private remoteSessionObserverDispose: (() => void) | undefined = undefined;
  private entryCatalogNavigation: ReadingEntryNavigation | undefined = undefined;
  private resumeOnlyChapterIndex: number | undefined = undefined;
  private entryCatalogPending: boolean = false;
  @State private entryCatalogLoading: boolean = false;
  @State private entryCatalogLoadFailed: boolean = false;
  private readingReadyPage: PhysicalReadingPage | undefined = undefined;
  private readingReadySelection: number = -1;
  private entryCatalogHydration: Promise<void> | undefined = undefined;
  private entryCatalogHydrationQueued: boolean = false;
  private readonly entryWindowExpansion: ReadingEntryWindowExpansion = new ReadingEntryWindowExpansion({
    captureSelection: (chapter: ReadingSessionChapter): (() => boolean) => {
      const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
      return (): boolean => this.isSelectionActive(lifecycle, selection) && this.chapter === chapter;
    },
    captureRequest: (chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowRequest =>
      this.captureEntryWindowExpansion(chapter, lane),
    postFrame: (run: () => void): void => this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(run)),
    reportBackgroundFailure: (error: Error): void =>
      hilog.warn(0x5244, 'Reader', 'Reading entry expansion: %{private}s', errorMessageOf(error)),
  });
  private readonly controlCatalogRouting: ReaderControlCatalogRouting = new ReaderControlCatalogRouting({
    canDispatch: (): boolean => this.canDispatchControlChapterIntent(),
    isCatalogPending: (): boolean => this.entryCatalogPending,
    captureControlOwner: (): (() => boolean) => this.captureControlCatalogOwner(),
    hydrate: (): Promise<void> => this.hydrateEntryCatalog(),
    findAdjacent: (delta: number): number | undefined => this.adjacentChapterIndex(this.currentChapterIndex(), delta),
    metrics: (): LocalReadingContentMetrics | undefined => this.contentMetrics,
    catalogLength: (): number => this.readingTocEntries().length,
    dispatch: (target: ReaderControlCatalogTarget): void => this.dispatchControlCatalogTarget(target),
    warn: (action: string, error: Error): void => {
      hilog.warn(0x5244, 'Reader', `Reading ${action} catalog: %{private}s`, errorMessageOf(error));
    },
  });
  private readingTocSource: LocalReadingTocEntry[] | undefined = undefined;
  private readingTocProjection: LocalReadingTocEntry[] = [];
  private readingTocRanks: Map<number, number> = new Map<number, number>();
  @State private contentMetrics: LocalReadingContentMetrics | undefined = undefined;
  /** Normalize a continuous viewport to a chapter-head page before publishing paged mode. */
  private canonicalModeAnchor: number = -1;
  private desiredChapterOffset: number = 0;
  private desiredChapterProgress: number = 0;
  private currentMeasurementGeneration(): number { return this.physicalPagination.index.measurementGeneration(); }
  /** Covers pagination, resolveLocation, and the initial progress write. */
  private measurementCompleting: boolean = false;
  /** Ordinary first-page persistence outlives its completed measurement lease. */
  private readonly ordinaryFirstPagePersistence: ReaderOrdinaryFirstPagePersistence =
    new ReaderOrdinaryFirstPagePersistence();
  /** A real Area change arrived while the preceding Core write was in flight. */
  private remeasurePending: boolean = false;
  /** Invalidates an old-style page that completed while a newer appearance reflow was queued. */
  private appearanceReflowInvalidateCurrentLayout: boolean = false;
  private commitInFlight: boolean = false;
  private progressCommitGeneration: number = 0;
  private readonly measurementRun: ReaderMeasurementRun = new ReaderMeasurementRun({
    set: (delay: number, callback: () => void): number => setTimeout(callback, delay),
    clear: (handle: number): void => clearTimeout(handle),
  });
  private readonly canonicalMeasurementContinuation: ReaderMeasurementContinuation = new ReaderMeasurementContinuation(
    (): number => readerMotionNowMs(),
    (callback: () => void): void => this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(callback)));
  private readonly nativeParagraphResources: ReaderNativeParagraphResources = new ReaderNativeParagraphResources();
  private readonly nativeTextMeasurement: ReaderNativeTextMeasurement = new ReaderNativeTextMeasurement();
  private readonly nativeBodyPunctuationOverflow: boolean = this.resolveNativeBodyPunctuationOverflow();
  /** Invalidates every continuation captured by a prior mounted instance. */
  private lifecycleToken: number = 0;
  private initialReadingTraceStartedAt: number = -1;
  private startupTraceEntryId: number = 0;
  private initialReadingTraceLifecycle: number = -1;
  private initialReadingTraceDelivered: boolean = false;
  /** Bumped per directory chapter selection so stale loads cannot win. */
  private chapterSelectionToken: number = 0;
  private readonly directoryJumpProof: ReaderDirectoryJumpProof = new ReaderDirectoryJumpProof();
  private readonly chapterSelection: ReaderChapterSelectionOwner<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin, ReaderControlSelectionCandidate> =
    new ReaderChapterSelectionOwner<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin, ReaderControlSelectionCandidate>({
      prepare: (request: ReaderDeferredChapterSelection): boolean => this.prepareChapterSelectionRequest(request),
      scope: (): ReaderChapterSelectionScope => ({ sourceId: this.sourceId, bookId: this.bookId,
        lifecycleToken: this.lifecycleToken, selectionToken: this.chapterSelectionToken }),
      owner: (): ReaderControlSelectionOwner => this.controlSelectionOwner(),
      nextSelection: (): number => { this.chapterSelectionToken += 1; return this.chapterSelectionToken; },
      adoptControlRevision: (): number => this.controlVisible() && !this.controlShellExitArmed() ? this.controlOpenRevision : -1,
      openRevision: (): number => this.controlOpenRevision,
      selectionActive: (lifecycle: number, selection: number): boolean => this.isSelectionActive(lifecycle, selection),
      isKnown: (chapterIndex: number): boolean => this.isKnownControlChapter(chapterIndex),
      catalogPending: (): boolean => this.entryCatalogPending,
      deferCatalog: (capture: () => ReaderControlDeferredCatalogSelection): void => this.controlCatalogRouting.deferSelection(capture),
      chapterAt: (chapterIndex: number): ReadingSessionChapter | undefined => this.chapterWindow.get(chapterIndex),
      queueOnSettlement: (request: ReaderDeferredChapterSelection): boolean => this.queueChapterSelectionOnSettlement(request),
      interruptPlayback: (stopTts: boolean): void => {
        const coordinator = this.ttsTransport.coordinator;
        if (stopTts && coordinator !== undefined) {
          void coordinator.stop('contentChanged').catch((error: Error): void => this.logTtsFailure('content stop', error));
        }
      },
      resetObservations: (): void => this.controlSelectionObservations.reset(),
      load: (request: ReaderDeferredChapterSelection, lifecycle: number, selection: number): void =>
        this.loadAdmittedChapterSelection(request, lifecycle, selection),
      closeControl: (): void => this.hideControl(),
    }, {
      captureVisibleOrigin: (): ReaderControlSelectionOrigin | undefined => this.captureVisibleControlSelectionOrigin(),
      anchor: (display: ReaderControlSelectionDisplay | undefined): ReaderControlSelectionDisplayAnchor | undefined =>
        this.selectionDisplayAnchor(display),
      matchesLayout: (display: ReaderControlSelectionDisplay): boolean =>
        display.layoutSignature === this.paginationLayoutSignature() &&
        display.continuous === (this.readerSettingsSnapshot.navigationMode === 'continuous'),
      beginFailure: (error: Error): void => this.beginControlSelectionFailure(error),
      invalidateUnverifiedDisplay: (): void => {
        this.clearChapterPresentation();
        this.lastCommittedProgress = undefined;
        this.phase = 'failed';
      },
      showFailure: (ticket: ReaderControlSelectionTicket, error: Error, detail: string): void =>
        this.showControlSelectionFailure(ticket, error, detail),
      restore: (display: ReaderControlSelectionDisplay, stored: ReaderControlSelectionStoredProgress): void =>
        this.restoreVerifiedControlSelection(display, stored),
      completeRestoredTarget: (ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
        stored: ReaderControlSelectionStoredProgress): void => this.completeControlSelectionAfterCommit(stored, display.page,
        ticket.selectionToken, ticket.lifecycleToken),
      notifyRestored: (ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
        stored: ReaderControlSelectionStoredProgress): void => this.notifyRestoredControlSelection(ticket, display, stored),
      reopenRefreshed: (ticket: ReaderControlSelectionTicket, stored: ReaderControlSelectionStoredProgress,
        context: RemoteReadingPositionContext): Promise<void> => this.openChapter(stored.chapterIndex, false, ticket.lifecycleToken,
        ticket.selectionToken, stored.chapterOffset, undefined, false, context),
    }, (): ReaderChapterSelectionProgressGateway => this.activeGateway());
  private readonly controlSelectionObservations: ReaderControlSelectionObservations = new ReaderControlSelectionObservations({
    selectionToken: (): number => this.chapterSelectionToken,
    ticket: (): ReaderControlSelectionTicket | undefined => this.chapterSelection.ticket,
    owner: (): ReaderControlSelectionOwner => this.controlSelectionOwner(),
    readingIdentity: (): string => this.controlVerification.observationIdentity(),
    publishQuick: (stage: 'selection-admitted' | 'selection-committed', facts: ReaderQuickSearchSelectionFacts): void =>
      this.controlVerification.effect('search-results', stage, facts),
    publishDirectory: (stage: 'selection-admitted' | 'selection-committed', facts: ReaderDirectorySelectionFacts): void =>
      this.controlVerification.effect('directory-selection', stage, facts),
  });
  @State private loadingChapterIndex: number | undefined = undefined;
  @State private chapterPresentationRevision: number = 0;
  /** Prevents a late startup load from replacing a newer in-session choice. */
  private appearanceMutationGeneration: number = 0;
  private readonly controlFontOrder: ReaderControlFontOrder = new ReaderControlFontOrder({
    committedIdentity: (): string => this.controlMinimumCommittedIdentity(),
    openRevision: (): number => this.controlOpenRevision,
    current: (identity: string): boolean => this.controlFontOrderPresentationCurrent(identity),
    order: (): ReaderAppearanceFontSlot[] => this.appearanceGateway.current().fontOrder,
    providerReadback: (): ReaderControlFontOrderReadback | undefined => {
      const facts = this.controlMinimum.providerFacts;
      return facts?.module === 'appearance' ? facts.appearance : undefined;
    },
    preparedReadback: (identity: string): ReaderControlFontOrderReadback | undefined => {
      const receipt = this.controlPresentationReceipt;
      const prepared = receipt?.prepared;
      if (receipt === undefined || receipt.ownerKey !== this.controlMinimumOwnerKey() ||
        receipt.profile.module !== 'appearance' || !this.controlMinimumReceiptCurrent(receipt.key) ||
        prepared === undefined || prepared.identity !== identity || prepared.key !== receipt.key) return undefined;
      return prepared.facts?.module === 'appearance' ? prepared.facts.appearance : undefined;
    },
    generation: (): number => this.controlMinimum.generation,
    environment: (): string => this.controlMinimumEnvironmentKey(),
    commit: (order: ReaderAppearanceFontSlot[]): Promise<ReaderAppearanceSnapshot | undefined> =>
      this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFontOrder(current, order)),
    displayed: (facts: ReaderControlFontOrderFacts): void => this.controlVerification.effect('font-reorder', 'order-admitted', facts),
  });
  /** Prevents a late Settings load from replacing a newer in-session choice. */
  private readerSettingsMutationGeneration: number = 0;
  /** The selection token that owns `chapter` and its layout map. */
  private materializedChapterSelectionToken: number = -1;
  /** The selection token that owns the currently mounted hidden measurement tree. */
  private currentMeasurementSelection(): number { return this.physicalPagination.index.measurementSelection(); }
  /** The selection token that owns the visible physical page. */
  private visiblePageSelectionToken: number = -1;
  @State private mounted: boolean = false;
  @State private exitRequested: boolean = false;
  private readonly textSelectionActivity: ReaderTextSelectionActivity = new ReaderTextSelectionActivity();
  @State private readerTextSelectionActive: boolean = false;
  private readonly smartGestureHost: HarmonySmartGestureHost = new HarmonySmartGestureHost();
  private quoteShareGeneration: number = 0;
  private readonly quoteCardAction: ReaderQuoteCardAction = (text: string, anchor: string, selectionCurrent: () => boolean) => {
    const generation = ++this.quoteShareGeneration;
    const selection = this.chapterSelectionToken;
    const current = (): boolean => generation === this.quoteShareGeneration &&
      selection === this.chapterSelectionToken && this.readerTextSelectionEnabled() && selectionCurrent();
    const title = this.bookTitle;
    const author = this.bookAuthor;
    const appearance = this.visibleReadingAppearance();
    const actions = readerSystemShareActions(() => this.getUIContext(), anchor);
    return actions.shareQuoteCard(text, title,
      (): Promise<ReaderQuoteCardCopy | undefined> => exportReaderQuoteCard(this.getUIContext(), text, title, author, appearance, current),
      current);
  };
  private exitDelivered: boolean = false;
  private exitAttemptGeneration: number = 0;
  private readonly readingRecordHost: ReaderReadingRecordHost = new ReaderReadingRecordHost(
    this.readingRecordGateway, (): string => this.bookTitle.trim().length > 0 ? this.bookTitle.trim() : this.bookId,
    (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s', `Reading duration: ${this.errorMessage(error)}`));
  private chineseConversionMutationGeneration: number = 0;
  private contentMetricsLoading: boolean = false;
  private contentMetricIndex: LocalReadingContentMetricIndex = new LocalReadingContentMetricIndex();
  private controlDirectoryParentSource: LocalReadingTocEntry[] | undefined = undefined;
  private bookmarkExcerptSource: LocalReadingTocEntry[] | undefined = undefined;
  private bookmarkExcerptChapter: ReadingSessionChapter | undefined = undefined;
  private bookmarkExcerptProjection: LocalReadingTocEntry[] = [];
  private bookmarkExcerptCache: Map<string, string> = new Map<string, string>();
  private controlDirectoryTocSource: LocalReadingTocEntry[] | undefined = undefined;
  private controlDirectoryProjection: LocalReadingTocEntry[] = [];
  /**
   * Once the control has been opened, keep the admitted directory projection
   * attached to the retained control tree until this reader instance ends.
   * Swapping a populated List to a shared empty array in the same semantic
   * commit as the dismiss animation makes ArkUI deliver an `entries` prop
   * change while Repeat is rendering; on hardware that can invalidate the
   * list buffer and expose a black frame.  This is presentation retention
   * only: it never keeps the control visible or changes routing.
   */
  private controlDirectoryDataRetained: boolean = false;
  private readonly controlDirectoryPublication: ReaderDirectoryDataPublication = new ReaderDirectoryDataPublication();
  @State private controlDirectoryEntriesRevision: number = 0;
  private controlDirectorySourceRevision: number = 0;
  private tocDownloadFactsCurrent: (() => boolean) | undefined = undefined;
  private readonly hiddenControlTtsState: ReaderTtsState = createReaderTtsState(false);
  private controlThemeScheme: string = 'day';
  private controlThemeSnapshot: ReaderControlThemeStyle = readerControlThemeStyle('day');
  private controlRequestLocation: ReaderControlLocation | undefined = undefined;
  private controlEnvironmentMetrics: ReaderWindowMetricsSnapshot | undefined = undefined;
  private controlEnvironmentWidth: number = 0;
  private controlEnvironmentHeight: number = 0;
  private controlEnvironmentExpanded: boolean = false;
  private controlEnvironmentKey: string = '';
  private lastCommittedProgress: ReadingCommit | undefined = undefined;
  /** A retained receipt supplies the page, but only this actual foreground
   * visit can admit one same-position renewal through the existing writer. */
  private retainedReadingRecencyReceipt: ReadingCommit | undefined = undefined;
  private retainedReadingRecencyVisible: boolean = false;
  private retainedReadingRecencySkipped: boolean = false;
  /** Exact durable TTS receipt; a later page or manual commit replaces ownership. */
  private lastTtsCommittedProgress: ReadingCommit | undefined = undefined;
  private lastTtsCommittedChapter: ReadingSessionChapter | undefined = undefined;
  private lastTtsCommittedSelectionToken: number = -1;
  private readonly ttsPreparation: ReaderTtsPreparation = new ReaderTtsPreparation();
  private readonly ttsPlayback: ReaderTtsPlaybackOwner = new ReaderTtsPlaybackOwner({
    scope: (): ReaderTtsPlaybackScope => ({ lifecycleToken: this.lifecycleToken, selectionToken: this.chapterSelectionToken,
      sourceId: this.sourceId, bookId: this.bookId }),
    scopeCurrent: (scope: ReaderTtsPlaybackScope): boolean => this.isSessionActive(scope.lifecycleToken) &&
      scope.selectionToken === this.chapterSelectionToken && scope.sourceId === this.sourceId && scope.bookId === this.bookId,
    state: (): ReaderTtsState => this.ttsState,
    coordinator: (): ReaderTtsPlaybackCoordinator | undefined => this.ttsTransport.coordinator,
    inputAllowed: (): boolean => this.readerInputIsCurrent() && !this.windowChromeOverlayActive,
    retireBlockedStarts: (): void => this.retirePendingPlaybackStarts(),
    cancelAutoPageStart: (): void => this.cancelPendingAutoPageStart(),
    stopAutoPage: (): void => this.stopAutoPage(),
    initialize: (lifecycle: number, retry: boolean): Promise<boolean> => this.initializeTtsSession(lifecycle, retry),
    startPage: (): ReaderTtsStartPage | undefined => this.ttsStartPage(),
    hydrateEntry: (chapter: ReadingSessionChapter): Promise<void> => this.entryWindowExpansion.expand(chapter, 'foreground'),
    startInput: (page: ReaderTtsStartPage): ReaderTtsStartInput => this.ttsStartInput(page),
    logFailure: (operation: string, error: Error): void => this.logTtsFailure(operation, error),
  }, {
    capture: (): ReaderControlPlaybackPresentation => this.captureControlPlaybackPresentation(),
    beginForStart: (): boolean => this.beginTtsStartCapsule(),
    beginForResume: (presentation: ReaderControlPlaybackPresentation): boolean | undefined =>
      this.isControlPlaybackPresentationCurrent(presentation, 'tts') ? !this.beginSessionCapsuleMorph('tts') : undefined,
    pauseWitness: (): ReaderTtsPauseWitness | undefined => this.captureTtsPauseWitness(),
    desiredPlaying: (): boolean => this.sessionLaunch?.geometry.type === 'tts' ? this.sessionLaunch.desiredPlaying : true,
    timing: (): ReaderTtsCapsuleTiming | undefined => this.capsuleVerification.ttsTiming(this.sessionLaunch?.generation),
    showStatic: (presentation: ReaderControlPlaybackPresentation): void => this.showAcknowledgedStaticTtsCapsule(presentation),
    observeStart: (): void => this.onSessionLaunchTtsState(this.ttsState),
    fail: (): void => this.cancelSessionLaunch('failure'),
  }, this.ttsPreparation);

  private chineseConversionLoaded: boolean = false;
  private readerSettingsLoaded: boolean = false;
  /** Layout facts admitted for the last window-metrics revision. */
  private lastWindowMetricsLayoutKey: string = '';
  private windowPolicyOwner: ReaderWindowPolicyOwner | undefined = undefined;

  aboutToAppear(): void {
    this.retireReaderRecovery();
    this.lifecycleToken += 1;
    const lifecycleToken = this.lifecycleToken;
    this.ttsPreferences.retireChoiceObservations();
    this.ttsState = createReaderTtsState(false);
    this.captureStartupEntryTrace?.();
    this.mounted = true;
    this.windowPolicyOwner = new ReaderWindowPolicyOwner((): boolean => this.isMountedToken(lifecycleToken) &&
      this.isReaderIdentityCurrent?.() !== false && this.windowChromeActive && this.appForeground);
    this.restoreEntryPresentation();
    this.admitInitialWindowGeometry();
    this.controlSession = createReaderControlSessionState();
    this.controlVerification.start();
    this.controlDirectoryDataRetained = false;
    this.tocDownloadFactsCurrent = undefined;
    this.controlDirectoryEntriesRevision = this.controlDirectoryPublication.publish(EMPTY_CONTROL_DIRECTORY_ENTRIES);
    this.latestControlVisualSession = copyReaderControlSessionState(this.controlSession);
    this.observedControlCloseRevision = 0;
    this.observedControlPage = 'home';
    this.observedControlModule = 'home';
    this.controlBackdropGeometryReady = false;
    this.onControlInputBoundaryChanged();
    this.bookTurnRuntimeFailed = false;
    this.bookTurnSurfaceRecoveryPending = false;
    this.bookTurnAwaitingSlotCommit = false;
    // Keep the mounted XComponent out of composition until Native has drawn
    // the first valid frame for a gesture generation. Its front buffer may be
    // undefined or belong to a prior session during cold entry.
    this.bookTurnSurfaceOpacity = 0;
    this.bookTurnSurfaceGeneration = 0;
    this.bookTurnTexture.invalidate(true);
    this.bookTurnSession.clearCapturedTextures();
    this.bookTurnSession.setEventListener((event: BookTurnNativeEvent): void =>
      this.onBookTurnNativeEvent(event));
    this.screenAwakeKeepScreenOn = false;
    this.screenAwakeLease = new ReaderScreenAwakeLease((keepScreenOn: boolean): void =>
      this.onScreenAwakeKeepScreenOnChanged(keepScreenOn));
    this.readingSystemEventHost = new ReaderReadingSystemEventHost();
    this.readingPrefetchScreenLocked = false;
    if (this.sourceId !== LOCAL_READING_SOURCE_ID && this.onReadingPrefetchActivity !== undefined) {
      this.readingSystemEventHost.setScreenLockHandler((locked: boolean): void => {
        this.readingPrefetchScreenLocked = locked;
        this.observeReadingPrefetch();
      });
    }
    this.clearDeferredPageTurnWork();
    this.invalidatePageTurnRuntime(false);
    this.lastWindowMetricsLayoutKey = this.windowMetricsLayoutKey();
    this.applyWindowChrome();
    // A reader may mount invisibly behind Book Detail while its first page is
    // prepared. Mounting is not visual ownership: only the visible reader is
    // allowed to hide system bars or change orientation. The @Watch below
    // applies the immersive snapshot in the same frame that visibility is
    // admitted, so Detail keeps the authored app status bar during warm-up.
    this.applyWindowPolicyForChromeOwner();
    this.exitRequested = false;
    this.bindAppearanceSaveRecovery(lifecycleToken);
    this.exitDelivered = false;
    this.readingRecordHost.retire();
    this.commitInFlight = false;
    this.progressProducers.retireContinuous();
    this.continuousUserInteractionActive = false;
    this.readingImageResources.resetChapter();
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.cancelPendingAutoPageStart();
    this.autoPageCoordinator.reset();
    this.refreshPageChromeClock(lifecycleToken);
    this.armPageChromeStatusTimer(lifecycleToken);
    // The reader owns acquisition as well as the visible failure boundary.
    // A shelf/search identity can mount before its catalog is available.
    this.sessionGateway = undefined;
    this.resumeOnlyChapterIndex = undefined;
    this.entryCatalogNavigation = undefined;
    this.entryCatalogPending = false;
    this.entryCatalogLoading = false;
    this.entryCatalogLoadFailed = false;
    this.readingReadyPage = undefined;
    this.readingReadySelection = -1;
    this.entryCatalogHydration = undefined;
    this.entryCatalogHydrationQueued = false;
    this.entryWindowExpansion.reset();
    this.controlCatalogRouting.invalidate();
    this.contentMetrics = undefined;
    this.contentMetricsLoading = false;
    this.lastCommittedProgress = undefined;
    this.retainedReadingRecencyReceipt = undefined;
    this.retainedReadingRecencyVisible = false;
    this.retainedReadingRecencySkipped = false;
    this.chapterSelection.reset();
    this.clearChapterPresentation();
    this.ttsPreparation.reset();
    this.chineseConversionLoaded = false;
    // restoreEntryPresentation already supplied the accepted settings when
    // the shelf's optional preparation completed.
    registerReaderFonts(this.getUIContext().getFont());
    this.withdrawExitRequest = this.onExitRequestHandler((intent?: 'navigation'): void =>
      intent === 'navigation' ? this.beginExit() : this.requestExit());
    // Bound body acquisition and the first Core commit even while the visible
    // reader still has no measured page; its error surface keeps recovery open.
    if (!this.restoreRetainedReadingPresentation(lifecycleToken)) {
      const firstBuild = this.restorePersistedFirstPresentation(lifecycleToken);
      if (firstBuild === 'unavailable') {
        this.armFirstPageReadyDeadline(lifecycleToken, this.chapterSelectionToken);
        void this.loadInitialReading(lifecycleToken);
      }
    }
  }

  private admitInitialWindowGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    // Use the containing pane when it has already measured. The child Area
    // callback remains authoritative for all later reflow.
    if (!metrics.ready || metrics.windowRect.width <= 0 || metrics.windowRect.height <= 0) return;
    this.viewportWidth = this.paneWidthHint > 0 ? this.paneWidthHint : metrics.windowRect.width;
    this.viewportHeight = this.paneHeightHint > 0 ? this.paneHeightHint : metrics.windowRect.height;
  }

  /** Cold persisted entry is an initial-build input, not a post-mount task.
   * This path never starts acquisition or waits for settings/window changes. */
  private restorePersistedFirstPresentation(lifecycleToken: number): 'unavailable' | 'ready' | 'deferred' | 'failed' {
    const owner = ReaderRuntimeOwner.current();
    const metrics = ReaderWindowCoordinator.metrics();
    const unavailable = !this.entryAppearanceReady ? 'appearanceNotReady' :
      !this.readerSettingsLoaded ? 'settingsNotReady' :
      !this.hasMeasuredViewport() || !metrics.ready ? 'viewportNotReady' :
      !readerFontFamilyReady(readerAppearanceSnapshotFontFamily(this.appearanceSnapshot)) ? 'fontNotReady' :
      this.sourceSwitchTransactionId !== undefined ? 'sourceSwitchPending' :
      !owner.supportsCoreCapability('reading.entry.firstFrame.v1') ? 'capabilityUnavailable' : '';
    if (unavailable.length > 0) {
      this.traceStartupReadingPhase?.('prepared-admission', unavailable);
      return 'unavailable';
    }
    const direction = this.readerSettingsSnapshot.screenDirection;
    if ((direction === 'portrait' && metrics.windowRect.width > metrics.windowRect.height) ||
      (direction === 'landscape' && metrics.windowRect.height > metrics.windowRect.width)) {
      this.traceStartupReadingPhase?.('prepared-admission', 'orientationNotReady');
      return 'unavailable';
    }
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
    let accepted = false;
    try {
      const source: ReadingSessionSource = this.sourceId === LOCAL_READING_SOURCE_ID ? { kind: 'local' } :
        { kind: 'remote', session: this.remoteSession, seed: this.remoteBookSeed,
          onSessionReady: (session: RemoteReadingSession): void => {
            if (isCurrent()) this.onRemoteSessionReady(session);
          } };
      const gateway = new ReadingSessionFlowGateway(this.sourceId, this.bookId, source, owner);
      const requested = this.normalizedRequestedChapter();
      const bookmark = this.requestedBookmarkAnchor;
      const pending = gateway.pendingPresentedProgress();
      const position = pending?.kind === 'restored' ? pending.progress : undefined;
      let context: RemoteReadingPositionContext | undefined;
      if (bookmark !== undefined) {
        if (!Number.isSafeInteger(bookmark.chapterOffset) || bookmark.chapterOffset < 0 ||
          (requested !== undefined && requested !== bookmark.chapterIndex)) return 'unavailable';
        if (bookmark.chapterOffset > 0 && bookmark.positionScope === undefined)
          return 'unavailable';
        context = this.positionContextForScope(bookmark.positionScope, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.directoryTargetProof);
      } else if (requested === undefined && position?.bodyVersion !== undefined && position.processingVersion !== undefined) {
        context = { bodyVersion: position.bodyVersion, processingVersion: position.processingVersion,
          anchors: [{ id: 'presented', offset: position.chapterOffset }] };
      }
      if (bookmark === undefined && requested === undefined && position !== undefined && context === undefined)
        return 'unavailable';
      this.initialReadingTraceStartedAt = Date.now();
      this.initialReadingTraceLifecycle = lifecycleToken;
      this.initialReadingTraceDelivered = false;
      this.traceInitialReadingPhase('persisted-entry-read', lifecycleToken);
      const snapshot = readPreparedReadingEntrySnapshot(owner, this.sourceId, this.bookId,
        bookmark?.chapterIndex ?? requested ?? position?.chapterIndex, isCurrent,
        readingParagraphBoundaryMode(this.sourceId, this.bookKind), context);
      if (snapshot === undefined || !snapshot.isCurrent() || !isCurrent() ||
        ReaderWindowCoordinator.metrics().revision !== metrics.revision)
        return 'unavailable';
      const chapter = snapshot.chapter;
      const chapterMap = readingChapterLayoutMap(chapter);
      // Paged admission is decided by the real bounded measurement below.
      // An unknown image outside that page cannot reject already-readable
      // text. Continuous layout still needs its complete window geometry.
      if (chapterMap.scalarCount() === 0 || (this.readerSettingsSnapshot.navigationMode === 'continuous' &&
        chapter.images.some((image: ReadingSessionImage): boolean => !hasKnownReadingImageGeometry(image)))) return 'unavailable';
      if (!this.admitEntryResume(snapshot)) return 'unavailable';
      const navigation = snapshot.navigation;
      const entries: LocalReadingTocEntry[] = navigation === undefined ?
        [{ index: chapter.chapterIndex, title: chapter.chapterTitle, downloadState: 'unknown', navigable: snapshot.resumeOnly !== true }] :
        [...navigation.before, navigation.current, ...navigation.after];
      gateway.admitPreparedEntry(snapshot);
      this.sessionGateway = gateway;
      accepted = true;
      this.remoteSessionObserverDispose?.();
      this.remoteSessionObserverDispose = gateway.observeRemoteSession((session: RemoteReadingSession): void => {
        if (this.isSessionActive(lifecycleToken)) this.onRemoteSessionReady(session);
      });
      this.preparedReadingEntry = undefined;
      this.entryCatalogNavigation = navigation;
      this.entryCatalogPending = true;
      this.admitTocEntries(entries);
      this.configureReadingChapterWindow(entries);
      this.restoredProgress = bookmark !== undefined || requested !== undefined ? undefined : pending ?? snapshot.progress;
      if (bookmark !== undefined) this.consumedBookmarkAnchorRequestId = bookmark.requestId;
      this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
      this.setCurrentReadingChapter(chapter);
      this.retainCurrentChapterWindow();
      this.chapter = chapter;
      this.readingImageResources.indexChapter(chapter);
      this.materializedChapterSelectionToken = selectionToken;
      this.appearanceLoaded = true;
      this.configureRestoredAnchor(chapter, chapterMap, true,
        bookmark?.chapterOffset ?? snapshot.requestedScalar);
      owner.readingEntryPreparations().setPaused(true);
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      this.traceInitialReadingPhase('persisted-entry-decoded', lifecycleToken);
      // Same measured Text/page objects used by ordinary reading. A returned
      // DTO alone is not success: the first build must observe the page below.
      this.beginMeasurement(lifecycleToken);
      const outcome = this.phase === 'failed' ? 'failed' :
        this.phase === 'ready' && this.visiblePage !== undefined && this.visibleFragments.length > 0 ? 'ready' : 'deferred';
      this.traceStartupReadingPhase?.('first-build', outcome);
      hilog.info(0x5244, 'Reader', 'PERF reader-entry first-build=%{public}s elapsedMs=%{public}d',
        outcome, Math.max(0, Date.now() - this.initialReadingTraceStartedAt));
      return outcome;
    } catch (error) {
      if (accepted) {
        this.fail(error as Error, lifecycleToken);
        return 'failed';
      }
      // Known unprepared data keeps the original repair flow. It is recorded
      // as outside fast admission, never counted as instant reading success.
      this.traceInitialReadingPhase('persisted-entry-rejected', lifecycleToken);
      return 'unavailable';
    }
  }

  private restoreRetainedReadingPresentation(lifecycleToken: number): boolean {
    if (!ReaderRuntimeOwner.current().optionalReadingEntryMemoryEnabled()) return false;
    const snapshot = this.entryPresentationProvider();
    if (snapshot === undefined || !snapshot.isCurrent() || !this.hasMeasuredViewport() ||
      !this.readerSettingsLoaded || this.requestedChapterIndex !== undefined ||
      this.requestedBookmarkAnchor !== undefined || this.sourceSwitchTransactionId !== undefined ||
      snapshot.sourceId !== this.sourceId || snapshot.bookId !== this.bookId ||
      snapshot.gateway.hasPendingSourceSwitch() || this.appearanceSnapshot.customFont !== undefined ||
      snapshot.appearanceKey !== JSON.stringify(this.appearanceSnapshot) ||
      snapshot.settingsKey !== JSON.stringify(this.readerSettingsSnapshot) ||
      snapshot.densityPixels !== ReaderWindowCoordinator.metrics().densityPixels ||
      snapshot.layoutKey !== this.paginationLayoutSignature()) return false;
    const retainedDraft = snapshot.context.paginationDraft;
    const retainedKey: ReadingPaginationKey = {
      sourceId: this.sourceId, bookId: this.bookId, chapterIndex: snapshot.context.chapter.chapterIndex,
      contentVersion: snapshot.context.contentVersion, layoutSignature: snapshot.layoutKey,
    };
    const observation = retainedDraft?.matches(retainedKey) === true ?
      retainedDraft.observationForPageStart(snapshot.page.startScalar) : undefined;
    if (observation === undefined || observation.endScalarExclusive !== snapshot.page.endScalar) return false;
    this.initialReadingTraceStartedAt = Date.now();
    this.initialReadingTraceLifecycle = lifecycleToken;
    this.initialReadingTraceDelivered = false;
    this.traceInitialReadingPhase?.('retained-layout-ready', lifecycleToken);
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) &&
      this.phase === 'ready' && this.visiblePage === snapshot.page && this.chapter === snapshot.context.chapter;
    this.sessionGateway = snapshot.gateway;
    this.remoteSessionObserverDispose?.();
    this.remoteSessionObserverDispose = snapshot.gateway.observeRemoteSession?.((session: RemoteReadingSession): void => {
      if (this.isSessionActive(lifecycleToken)) this.onRemoteSessionReady(session);
    });
    this.preparedReadingEntry = undefined;
    this.entryCatalogNavigation = snapshot.navigation;
    this.entryCatalogPending = snapshot.catalogPending;
    this.admitTocEntries(snapshot.toc);
    this.configureReadingChapterWindow();
    this.restoreMaterializedChapterContext(snapshot.context, true);
    // The handoff stays constant-size. Neighbour preparation expands a new
    // run, never the retained snapshot, and always starts with the real page.
    this.physicalPagination.draft = new ReadingPaginationPrefix(retainedKey, observation);
    this.physicalPagination.requestedAnchor = observation.requestScalar;
    this.materializedChapterSelectionToken = selectionToken;
    this.setCurrentReadingChapter(snapshot.context.chapter);
    this.readingImageResources.indexChapter(snapshot.context.chapter);
    this.publishMeasuredFirstPage(snapshot.page, snapshot.context.chapter, selectionToken);
    this.desiredChapterOffset = snapshot.page.startScalar;
    this.desiredChapterProgress = snapshot.progress.chapterProgress;
    this.phase = 'ready';
    this.appearanceLoaded = true;
    this.measurementCompleting = false;
    this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
    this.admitCommittedProgress(snapshot.progress);
    if (!isCurrent()) return true;
    this.retainedReadingRecencyReceipt = this.lastCommittedProgress;
    this.admitRetainedReadingRecency();
    ReaderRuntimeOwner.current().readingEntryPreparations().setPaused(true);
    this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
    this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
    this.beginReadingRecordClock(lifecycleToken);
    if (!this.entryCatalogPending) this.onDirectoryProjectionChanged(snapshot.toc);
    if (!isCurrent()) return true;
    const remote = snapshot.gateway.remoteSession();
    if (remote !== undefined) this.onRemoteSessionReady(remote);
    if (!isCurrent()) return true;
    this.schedulePageTurnPreparation();
    this.notifyControlSelectionReadingReady(snapshot.context.chapter.chapterIndex,
      snapshot.context.chapter.chapterTitle, snapshot.page, selectionToken, lifecycleToken);
    if (isCurrent()) this.admitRetainedReadingRecency();
    return true;
  }

  private admitRetainedReadingRecency(): void {
    const receipt = this.retainedReadingRecencyReceipt;
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (receipt === undefined || this.retainedReadingRecencyVisible || !this.mounted ||
      !this.appForeground || !this.windowChromeActive || this.exitRequested ||
      this.isReaderIdentityCurrent?.() === false || receipt !== this.lastCommittedProgress ||
      page === undefined || chapter === undefined || receipt.sourceId !== this.sourceId ||
      receipt.bookId !== this.bookId || receipt.chapterIndex !== chapter.chapterIndex ||
      receipt.chapterOffset !== page.startScalar ||
      !this.isVisiblePageCurrent(page, chapter, this.visiblePageSelectionToken, this.lifecycleToken)) return;
    this.retainedReadingRecencyVisible = true;
  }

  private retainConfirmedEntryPresentation(): void {
    const owner = ReaderRuntimeOwner.current();
    const handoff = readingEntryHandoff(owner);
    handoff.clear();
    if (!owner.optionalReadingEntryMemoryEnabled() || this.resumeOnlyChapterIndex !== undefined || this.retainedReadingRecencySkipped) return;
    const page = this.visiblePage;
    const chapter = this.chapter;
    const progress = this.lastCommittedProgress;
    if (this.phase !== 'ready' || page === undefined || chapter === undefined ||
      progress === undefined || this.sessionGateway === undefined || !this.hasMeasuredViewport() ||
      this.readerSettingsSnapshot.navigationMode !== 'paged' || this.appearanceSnapshot.customFont !== undefined ||
      page.measuredAppearance === undefined ||
      JSON.stringify(page.measuredAppearance) !== JSON.stringify(this.appearanceSnapshot) ||
      this.remeasurePending || this.appearanceReflowInvalidateCurrentLayout ||
      this.pageTurnPreparation !== undefined || this.preparedSettlement.prepared !== undefined ||
      chapter.images.length > 0 || page.fragments.length === 0 ||
      progress.chapterIndex !== chapter.chapterIndex || progress.chapterOffset !== page.startScalar ||
      this.sessionGateway.hasPendingSourceSwitch() || this.chapterSelection.ticket !== undefined ||
      this.sourceSwitchTransactionId !== undefined) return;
    retainConfirmedReadingPage(new ReaderRetainedPageInput(
      owner, handoff, page, chapter, progress, this.sessionGateway,
      this.sourceId, this.bookId, this.tocEntries, this.paragraphLayout.ranges.length,
      (): ReaderMaterializedChapterContext => this.captureMaterializedChapterContext(),
      (key: ReadingPaginationKey): boolean => this.physicalPagination.sameKey(key, this.currentPaginationKey()),
      (): string => JSON.stringify(this.appearanceSnapshot),
      (): string => JSON.stringify(this.readerSettingsSnapshot),
      (): string => this.paginationLayoutSignature(),
      (): number => ReaderWindowCoordinator.metrics().densityPixels,
      this.entryCatalogNavigation, this.entryCatalogPending,
    ));
  }

  private restoreEntryPresentation(): void {
    // ThemeHost restores this store before Index is mounted. Never flash the
    // component's default paper while re-reading the same application state.
    this.entryAppearanceReady = false;
    try {
      this.appearanceSnapshot = this.appearanceGateway.current();
      this.entryAppearanceReady = true;
    } catch (_) {}
    const settings = this.readerSettingsGateway.current();
    this.readerSettingsLoaded = settings !== undefined;
    if (settings !== undefined) this.readerSettingsSnapshot = settings;
  }

  aboutToDisappear(): void {
    this.continuousChromeCache = undefined;
    this.smartGestureHost.detach();
    this.observeReadingPrefetch?.(false, false, true);
    this.controlFontOrder.retire();
    this.controlVerification.stop();
    this.retireReaderRecovery();
    this.appearanceSaveUnsubscribe?.();
    this.appearanceSaveUnsubscribe = undefined;
    this.appearanceSaveRecoveryIdentity = '';
    this.appearanceSaveRecovery = { message: '', visible: false, canRetry: false,
      generation: this.appearanceSaveRecovery.generation + 1 };
    this.appearanceSaveRecoveryBusy = false;
    this.controlMinimum.retireProvider();
    this.controlPresentationReceipt = undefined;
    this.controlNavigation.retire();
    this.controlPlaybackProfile = undefined;
    this.controlMinimum.clearCandidates();
    this.controlMinimumReady = false;
    this.transientFeedback.reset();
    this.retainedReadingRecencyReceipt = undefined;
    this.retainedReadingRecencyVisible = false;
    this.cancelSourceSwitchCompletion();
    this.progressProducers.retireContinuous();
    this.directoryJumpProof.clear();
    this.staticSessionCapsuleOrigin = undefined;
    this.finishSessionCapsuleMorph();
    this.bookmarkRollbackGeneration += 1;
    this.bookmarkMutationGeneration += 1;
    this.bookmarkGestureAnchor = '';
    this.bookmarkUnavailableGeneration += 1;
    if (this.bookmarkUnavailableTimer >= 0) clearTimeout(this.bookmarkUnavailableTimer);
    this.bookmarkUnavailableTimer = -1;
    this.bookmarkUnavailableMessage = '';
    this.bookmarkPendingTarget = '';
    // Do not begin a second, fire-and-forget write after the host has already
    // unmounted us. Normal exit is serialized through requestExit() instead.
    this.invalidatePageTurnRuntime(true);
    this.bookTurnSession.setEventListener((_event: BookTurnNativeEvent): void => {});
    this.bookTurnTexture.invalidate(true);
    this.bookTurnMotion = undefined;
    this.bookTurnSurfaceGeneration += 1;
    this.bookTurnSurfaceOpacity = 0;
    this.clearDeferredPageTurnWork();
    this.brightnessSession.restore();
    this.screenAwakeLease?.dispose();
    this.screenAwakeLease = undefined;
    this.screenAwakeKeepScreenOn = false;
    this.readingSystemEventHost?.dispose();
    this.readingSystemEventHost = undefined;
    this.mounted = false;
    this.loadingChapterIndex = undefined;
    this.onControlInputBoundaryChanged();
    if (this.isReaderIdentityCurrent?.() !== false && this.windowChromeActive)
      ReaderWindowCoordinator.requestAppChrome();
    if (this.windowPolicyOwner !== undefined) {
      void ReaderWindowCoordinator.requestAppWindowPolicy(this.windowPolicyOwner).catch((_error: Error): void => {});
      this.windowPolicyOwner = undefined;
    }
    this.lifecycleToken += 1;
    this.quickSearchPublication.cancel();
    this.replacePanel.advancePanel();
    this.appearanceReflowInvalidateCurrentLayout = false;
    this.replacePanel.invalidateMutation();
    this.cancelPendingAutoPageStart();
    this.autoPageCoordinator.dispose();
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.clearPageChromeStatusTimer();
    this.pendingPageChromeClockText = undefined;
    this.pendingSessionCapsuleMeasurement = undefined;
    this.readingRecordHost.retire();
    const ttsCoordinator = this.ttsTransport.coordinator;
    this.ttsConfigurationHost?.retire();
    this.ttsConfigurationHost = undefined;
    this.ttsConfigurationNotice = undefined;
    this.ttsTransport.detach();
    this.ttsPreparation.reset();
    this.previousChapterMeasurement = undefined;
    this.chapterSelection.reset();
    this.clearChapterPresentation();
    this.readingImageResources.close();
    this.nativeParagraphResources.close();
    this.chapterWindow.clear();
    this.remoteSessionObserverDispose?.();
    this.remoteSessionObserverDispose = undefined;
    this.sessionGateway = undefined;
    if (ttsCoordinator !== undefined) void ttsCoordinator.dispose();
    this.resetPaginationDraft();
    this.measurementRun.cancelDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.pageTurnPreparationQueue.cancelRetry();
    this.nativeTextMeasurement.clear();
    this.withdrawExitRequest?.();
    this.withdrawExitRequest = undefined;
  }

  private async ensureReadingSession(lifecycleToken: number, selectionToken: number,
    discardPreparedSession: boolean = false): Promise<void> {
    if (this.sessionGateway !== undefined) return;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) && this.phase !== 'failed';
    const owner = ReaderRuntimeOwner.current();
    const preparation = owner.readingEntryPreparations();
    const prepared = !discardPreparedSession && this.requestedChapterIndex === undefined && this.requestedBookmarkAnchor === undefined &&
      this.sourceSwitchTransactionId === undefined ? preparation.take(this.sourceId, this.bookId) : undefined;
    preparation.setPaused(true);
    let transactionPending = this.sourceSwitchTransactionId !== undefined;
    let preparedSession: RemoteReadingSession | undefined = undefined;
    const gateway = await ReadingSessionFlowGateway.open({
      sourceId: this.sourceId, bookId: this.bookId,
      hasPreparedEntry: prepared !== undefined,
      remoteSession: discardPreparedSession ? undefined :
        (prepared?.isCurrent() === true ? prepared.gateway.remoteSession() : this.remoteSession),
      remoteBookSeed: this.remoteBookSeed, sourceSwitchTransactionId: this.sourceSwitchTransactionId,
      isCurrent,
      resolveSourceSwitchTransactionId: async (sourceId: string, bookId: string): Promise<string | undefined> => {
        const transaction = await this.resolveSourceSwitchTransactionId(sourceId, bookId);
        transactionPending = transaction !== undefined;
        return transaction;
      },
      onRemoteSessionReady: (session: RemoteReadingSession): void => {
        if (prepared === undefined) this.onRemoteSessionReady(session);
        else preparedSession = session;
      },
    }, owner);
    if (isCurrent() && gateway !== undefined) {
      if (prepared !== undefined && (!prepared.isCurrent() || transactionPending)) {
        await this.ensureReadingSession(lifecycleToken, selectionToken, true);
        return;
      }
      this.sessionGateway = gateway;
      this.remoteSessionObserverDispose?.();
      this.remoteSessionObserverDispose = gateway.observeRemoteSession?.((session: RemoteReadingSession): void => {
        if (this.isSessionActive(lifecycleToken)) this.onRemoteSessionReady(session);
      });
      this.preparedReadingEntry = !transactionPending && prepared?.isCurrent() === true ? prepared : undefined;
      if (preparedSession !== undefined) this.onRemoteSessionReady(preparedSession);
    }
  }

  private restartPreparedReadingEntry(lifecycleToken: number, selectionToken: number,
    layoutReady: Promise<void[]>): Promise<void> {
    return restartInitialReadingEntry(lifecycleToken, selectionToken, layoutReady, this.initialChapterHost());
  }

  private activeGateway(): ReadingSessionFlowGateway {
    if (this.sessionGateway === undefined) {
      throw new Error('reading session gateway is not initialized');
    }
    return this.sessionGateway;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The normal paper and controls own loading and recoverable errors too.
      if (readerRenderStageKind(this.readerSettingsSnapshot.navigationMode, this.hasContinuousRenderContent()) === 'continuous') {
        ReaderContinuousReadingStage({
          inputRevision: this.pageTurnInputRevision,
          inputCurrent: (revision: number): boolean => revision === this.pageTurnInputRevision && this.isReaderPageInteractionEnabled(),
          onInputLost: (revision: number): void => {
            if (revision === this.pageTurnInputRevision) this.retirePagePointer();
          },
          contentRevision: this.continuousRenderRevision,
          frameProvider: (): ReaderContinuousRenderFrame => this.continuousRenderFrame(),
          onProgrammaticScrollReady: (begin: (() => void) | undefined): void => {
            this.continuousProgrammaticScrollIntent = begin;
          },
          layout: this.readingLayout(),
          appearance: this.visibleReadingAppearance(),
          ttsHighlightStart: this.continuousTtsHighlight(this.continuousRenderRevision)?.start,
          ttsHighlightEnd: this.continuousTtsHighlight(this.continuousRenderRevision)?.end,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerTextSelectionEnabled(),
          selectionInputCurrent: (): boolean => this.readerTextSelectionEnabled(),
          quoteCardAction: this.quoteCardAction,
          onSelectionActivity: (owner: string, active: boolean): void => this.admitReaderTextSelectionActivity(owner, active),
          interactionEnabled: this.isReaderPageInteractionEnabled(),
          onVisibleRangeChanged: this.sourceSwitchContinuousRangeObserver(this.continuousRenderRevision),
          onScrollStopped: (): void => this.onContinuousScrollStopped(),
          onReachStart: (): void => this.onContinuousReachStart(),
          onReachEnd: (): void => this.onContinuousReachEnd(),
          onBoundaryDrag: (direction: 'previous' | 'next'): void =>
            this.onContinuousBoundaryDrag(direction),
          onTurn: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome =>
            this.requestPageTurn(direction),
          onOpenControl: (): void => this.openReaderControl('continuous-tap'),
          onManualInteraction: (): void => this.onContinuousManualInteraction(),
          onPointerStart: (pointerId: number): boolean => this.acquirePagePointer(pointerId),
          onPointerEnd: (pointerId: number): void => this.releasePagePointer(pointerId),
          onAnchorSamplerReady: (sample: (() => void) | undefined): void => {
            this.continuousAnchorSampler = sample;
          },
          onScrollerReady: (scroller: Scroller | undefined): void => {
            this.continuousScroller = scroller;
          },
        });
        ReaderFacingChapterColumn({
          chapter: this.currentFacingChapter(this.pageTurnRenderRevision),
          layout: this.readingLayout(),
          appearance: this.visibleReadingAppearance(),
        });
        this.continuousPageChromeContent();
      } else {
        if (this.bookmarkPullOffset() > 0) {
          ReaderBookmarkPaperWell({
            paperTop: this.bookmarkPullPaperTop(this.readingLayout()), offset: this.bookmarkPullOffset(),
            paperColor: readerThemeDefinition(this.visibleReadingAppearance().activeTheme).paperStart,
            day: readerThemeDefinition(this.visibleReadingAppearance().activeTheme).scheme === 'day',
          });
          this.bookmarkCornerFeedback(true);
        }
        ReaderPageTurnStage({
          contentRevision: this.pageTurnRenderRevision,
          bookmarkPresentationRevision: this.bookmarkPresentationRevision,
          currentPageProvider: (): ReaderPageTurnRenderPage => this.currentPageTurnRenderPage(),
          currentPageSlot: this.pageTurnCurrentSlot,
          currentPageSnapshotId: this.usesBookTurnSimulation() ?
            READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID : '',
          previousPageProvider: (): ReaderPageTurnRenderPage | undefined => this.preparedPageTurnRenderPage('previous'),
          nextPageProvider: (): ReaderPageTurnRenderPage | undefined => this.preparedPageTurnRenderPage('next'),
          pageTurnStyle: this.effectivePageTurnStyle(),
          turnDirection: this.pageTurnDirection,
          offsetX: this.pageTurnOffsetX,
          viewportWidth: this.pageTurnStageViewportWidth(),
          layout: this.readingLayout(),
          appearance: this.visibleReadingAppearance(),
          topInfoMovesWithPage: true,
          bookmarkMode: this.pageBookmarkFeedbackMode(this.pageTurnRenderRevision),
          bookmarkOpacity: this.pageBookmarkFeedbackOpacity(),
          bookmarkRibbon: this.currentBookmarkRibbonFrame(this.pageTurnRenderRevision),
          ttsHighlightStart: this.pageTtsHighlightCurrent() ? this.ttsState.charStart : undefined,
          ttsHighlightEnd: this.pageTtsHighlightCurrent() ? this.ttsState.charEnd : undefined,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerTextSelectionEnabled(),
          selectionInputCurrent: (): boolean => this.readerTextSelectionEnabled(),
          quoteCardAction: this.quoteCardAction,
          onSelectionActivity: (owner: string, active: boolean): void => this.admitReaderTextSelectionActivity(owner, active),
          translateY: this.bookmarkPullOffset(),
          bookmarkPaperTop: this.bookmarkPullOffset() > 0 ? this.bookmarkPullPaperTop(this.readingLayout()) : undefined,
          onCurrentPagePresented: (revision: number): void => {
            this.onBookTurnArkUIFramePresented(revision);
            this.onSourceSwitchPagePresented(revision);
          },
          onCurrentPageContentReady: (revision: number): void => this.onBookTurnArkUIContentReady(revision),
          onDynamicHighlights: (identity: string, rects: ReaderDynamicHighlightRect[]): void =>
            this.onPageDynamicHighlights(identity, rects),
        });
        if (this.shouldMountBookTurnSurface()) {
          ReaderBookTurnSurface({
            componentId: READER_BOOK_TURN_COMPONENT_ID,
            surfaceOpacity: this.usesBookTurnSimulation() ? this.bookTurnSurfaceOpacity : 0,
            onSurfaceLoaded: (): void => this.onBookTurnSurfaceLoaded(),
          });
        }
      }
      this.sourceSwitchCompletionWash();
      // Reader Control (RC-READER-CONTROL-01): tapping the center vertical band
      // raises the control layer, which overlays the reading surface.
      // The Panel stays mounted, but only this Host's linked session owns
      // routes, held input, the transition and committed close revision.
      ReaderControlPanel({
        directSheetRedesign: true,
        fixedIsland: true,
        bodySelectionPossible: this.readerTextSelectionEnabled(),
        sessionFontScale: this.readingLayout().systemFontScale,
        controlThemeStyle: this.controlPanelTheme(this.readerAppScheme),
        launchSample: this.sessionLaunch !== undefined ? this.sessionLaunchSourceSample : undefined,
        launchTopBarOffsetY: this.sessionLaunch?.sample.topBarOffsetY ?? 0,
        launchDockOffsetY: this.sessionLaunch?.sample.dockOffsetY ?? 0,
        onLaunchSource: (source: ReaderControlLaunchSource): void => {
          if (source.generation === this.sessionLaunch?.generation) this.sessionLaunchControlSource = source;
        },
        launchGeneration: this.sessionLaunch?.generation ?? 0,
        launchSourceMinimum: this.sessionLaunchSourceMinimum,
        launchSourceKind: this.sessionLaunch?.geometry.kind ?? 'quickAutoPage',
        launchOwnsControls: this.sessionLaunch?.ownership === 'stage',
        launchRecovering: this.sessionLaunch?.ownership === 'handoffPending',
        onLaunchSourceReady: (generation: number): void => this.onSessionLaunchSourceReady(generation),
        onSessionLaunchShellMeasured: (topExit: number, dockExit: number): void => {
          this.sessionLaunchTopExit = topExit; this.sessionLaunchDockExit = dockExit;
        },
        recoveryAvailable: this.hasReaderRecoveryContent(),
        recoveryIdentity: this.readerRecoveryOverlayId(),
        onOpenRecovery: (identity: string): void => this.openReaderRecovery(identity),
        bookTitle: this.bookTitle,
        chapterTitle: this.chapterTitle,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        progressPercent: this.controlProgress(),
        totalChapters: this.entryCatalogNavigation?.readableChapterCount ?? this.readingTocEntries().length,
        readableChapterPosition: this.readableChapterPosition(this.currentChapterIndex()),
        pageBookmarkStatus: this.controlVisible() ?
          this.controlPageBookmarkStatus(this.bookmarkPresentationRevision + this.pageTurnRenderRevision) : 'unknown',
        pageBookmarkEnabled: this.controlVisible() &&
          this.controlPageBookmarkEnabled(this.bookmarkPresentationRevision + this.pageTurnRenderRevision),
        onTogglePageBookmark: (): void => {
          if (this.isControlInputEnabled() && this.controlMotionPage() === 'home' &&
            this.controlPageBookmarkEnabled(this.bookmarkPresentationRevision + this.pageTurnRenderRevision)) {
            this.toggleCurrentPageBookmark();
          }
        },
        layout: this.controlLayout(this.readerWindowMetricsRevision),
        presentationReceipt: this.controlPresentationReceipt,
        preparedMinimumRequired: true,
        minimumIdentity: this.controlMinimumIdentity(),
        minimumCommittedIdentity: this.controlMinimumCommittedIdentity(),
        minimumRequestLocation: this.controlMinimumRequestLocation(),
        minimumOwnerKey: this.controlMinimumOwnerKey(),
        minimumEnvironmentKey: this.controlMinimumEnvironmentKey(),
        minimumKey: this.controlLayout(this.readerWindowMetricsRevision).minimumKey,
        minimumReady: this.controlMinimumReady,
        minimumReceiptCurrent: (key: string): boolean => this.controlMinimumReceiptCurrent(key),
        minimumMetricsRevision: ReaderWindowCoordinator.metrics().revision,
        onPlaybackProfileSelected: (receipt: ReaderControlPlaybackProfileReceipt): void =>
          this.acceptControlPlaybackProfile(receipt),
        onMinimumMeasurerReady: (identity: string, measurer: ReaderControlContentMeasurer | undefined,
          profileReader?: ReaderControlMeasuredProfileReader, facts?: ReaderControlModuleFacts, factsGeometryKey?: string): void =>
          this.bindControlMinimum(identity, measurer, profileReader, facts, factsGeometryKey),
        controlSession: $controlSession,
        verificationSession: this.controlVerification,
        onSessionRequest: (next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void =>
          this.requestControlSession(next, origin),
        inputEnabled: this.isControlInputEnabled() && this.sessionLaunchAllowsControlInput(),
        inputCurrent: (): boolean => this.isControlInputEnabled() && this.sessionLaunchAllowsControlInput(),
        controlObscured: this.controlObscured,
        controlOpenRevision: this.controlOpenRevision,
        dismissTemporaryRevision: this.dismissControlTemporaryRevision,
        retireTemporaryRevision: this.retireControlTemporaryRevision,
        temporaryLayerKind: this.controlTemporaryLayerPresented,
        onVisualSessionChange: (state: ReaderControlSessionState): void => {
          // This assignment is deliberately non-reactive.  It is a decision
          // snapshot for Back/close only; the Panel owns the visual @State.
          admitReaderControlVisualSnapshot(state, {
            presentedForWindow: (): boolean => this.controlsPresentedForWindow(),
            capture: (snapshot: ReaderControlSessionState): void => { this.latestControlVisualSession = snapshot; },
            closing: (closing: boolean): void => this.admitSessionControlClosing(closing),
            chromeOwnerChanged: (): void => this.applyWindowPolicyForChromeOwner(),
          });
        },
        onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind): void => this.onControlTemporaryLayerChanged(active, kind),
        onTtsConfigurationOpen: (): void => this.retryTtsConfigurationMetadataOnOpen(),
        onInputActivity: (): void => this.onControlInputActivity(),
        onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean): void => {
          this.controlBackdropRegions = regions;
          this.controlBackdropGeometryReady = ready;
        },
        // ReaderControlPanel deliberately stays mounted for its transitions.
        // Before the first open, avoid projecting a large TOC into the hidden
        // shell; after the first open, retain the exact same array identity
        // through dismiss so Repeat/List never receives an empty replacement
        // during the compositor's closing frames.
        directoryPublication: this.controlDirectoryPublication,
        directoryEntriesRevision: this.controlDirectoryEntriesRevision,
        catalogComplete: !this.entryCatalogPending,
        catalogLoading: this.entryCatalogLoading,
        catalogLoadFailed: this.entryCatalogLoadFailed,
        catalogChapterCount: this.entryCatalogNavigation?.chapterCount ?? this.tocEntries.length,
        catalogCurrentPosition: this.controlDirectoryCatalogPosition(),
        onRequireCompleteCatalog: (): void => this.requestCatalogForTurn(),
        currentChapterIndex: this.currentChapterIndex(),
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        chapterDownloadEnabled: this.sourceId !== LOCAL_READING_SOURCE_ID,
        bookmarkLoadFailed: this.controlBookmarkLoadFailed,
        bookmarkLoadMessage: this.bookmarkLoadMessage,
        bookmarkRecovery: this.bookmarkRecovery,
        onRetryBookmarkLoad: (): void => this.loadControlBookmarks(),
        searchQuery: this.quickSearchQuery,
        searchPublication: this.quickSearchPublication,
        searchRevision: this.quickSearchRevision,
        brightnessPercent: this.brightnessPercent,
        brightnessAutomatic: this.brightnessSession.automatic(),
        brightnessRevision: this.brightnessRevision,
        autoPageStatus: this.automaticReadingState().status,
        autoPageSpeedSeconds: this.automaticReadingState().speedSeconds,
        autoPageTimerMinutes: this.automaticReadingConfiguration().timerMinutes,
        autoPageTimerSeconds: this.automaticReadingConfiguration().timerSeconds,
        autoPageTimerSummaryText: formatReaderAutoPageFullTimerSummary(this.automaticReadingConfiguration()),
        autoPageFollowHighlight: this.automaticReadingConfiguration().followHighlight,
        controlReplaceState: this.controlReplaceState,
        ttsConfigurationRecovery: this.ttsConfigurationRecovery,
        ttsConfigurationLoading: this.ttsConfigurationLoading,
        ttsConfigurationLoadFailed: this.ttsConfigurationLoadFailed,
        appearanceSnapshot: this.appearanceSnapshot,
        chineseConversionMode: this.chineseConversionMode,
        settingsSnapshot: this.readerSettingsSnapshot,
        widePageLayout: this.readerSettingsSnapshot.widePageLayout ?? 'spread',
        pageTurnSimulationAvailable: !this.bookTurnRuntimeFailed,
        ttsState: this.controlVisible() ? this.ttsState :
          this.sessionLaunch !== undefined ? this.sessionLaunchSourceTtsState : this.hiddenControlTtsState,
        ttsTimerMode: this.ttsTimerMode,
        ttsTimerMinutes: this.ttsTimerMinutes,
        ttsTimerSeconds: this.ttsTimerSeconds,
        ttsFollowHighlight: this.ttsFollowHighlight,
        ttsPauseOnInterruption: this.ttsPauseOnInterruption,
        ttsAllowMixing: this.ttsAllowMixing,
        ttsBackgroundPlayback: this.ttsBackgroundPlayback,
        ttsKeepScreenOn: this.ttsKeepScreenOn,
        ttsFailurePolicy: this.ttsFailurePolicy,
        ttsEngine: this.ttsEngine,
        ttsHttpEngines: this.ttsHttpEngines,
        ttsVoiceOptions: this.ttsVoiceOptions,
        ttsLanguage: this.ttsLanguage,
        ttsPerson: this.ttsPerson,
        reduceMotion: this.reduceMotion,
        onSessionMorphSourceMeasured: (measurement: ReaderSessionMorphSourceMeasurement): void =>
          this.admitSessionMorphSourceMeasurement(measurement),
        // The top arrow exits the book; only system Back unwinds control layers.
        onExitReading: (): void => this.beginExit(),
        onDismiss: (): void => this.hideControl(),
        sourceBookId: this.bookId,
        onSourceSwitch: (focusId?: string): void => {
          this.hideControl();
          this.onSwitchSource(focusId);
        },
        onRefreshChapter: (): void => this.refreshCurrentChapter(),
        bookDownloadEnabled: this.sourceId !== LOCAL_READING_SOURCE_ID && (this.entryCatalogNavigation?.readableChapterCount ?? this.totalChapters) > 0 && !this.offlineBookOperationActive,
        bookDownloadActive: this.offlineBookOperationActive,
        onDownloadBook: (): void => this.requestReadingDownload(),
        onOpenBookInfo: (): void => this.onOpenBookInfo(),
        chapterRefreshEnabled: this.canRefreshCurrentChapter(),
        onPageChange: (page: ReaderControlPage, origin: ReaderControlVerificationOrigin): void => this.setControlPage(page, origin),
        onModuleSelect: (_module: string): void => {},
        onSelectChapter: (chapterIndex: number): void => this.selectControlChapter(chapterIndex),
        onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
          positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void =>
          this.selectControlNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
        onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void =>
          this.selectBookmarkAnchor(chapterIndex, chapterOffset, positionScope),
        bookmarkIdentity: this.bookmarkIdentity,
        onDownloadChapter: (chapterIndex: number): void => this.requestReadingDownload(chapterIndex),
        onDeleteBookmarks: (bookmarkTimes: number[]): void => { if (this.bookmarkWriteEnabled()) this.onDeleteBookmarks(bookmarkTimes); },
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          { if (this.bookmarkWriteEnabled()) this.onCreateChapterStartBookmark(request); },
        onPreviousChapter: (): void => this.stepControlChapter(-1),
        onNextChapter: (): void => this.stepControlChapter(1),
        onProgressChange: (percent: number): void => this.seekControlProgress(percent),
        onBrightnessChange: (percent: number): void => this.brightnessSession.setManual(percent),
        onBrightnessAuto: (): void => this.brightnessSession.toggleAutomatic(),
        onBrightnessCancel: (): void => this.brightnessSession.cancel(),
        onSearchQueryChange: (query: string): void => this.updateQuickSearchQuery(query),
        onSearch: (): void => this.runQuickSearch(),
        onSearchLoadMore: (): void => this.loadMoreQuickSearch(),
        onSearchNeedMore: (): void => this.loadMoreQuickSearch(true),
        onSearchResultSelect: (result: ReadingContentSearchResult, scope: number, ordinal: number): void =>
          this.selectSearchResult(result, scope, ordinal),
        onAutoPageToggle: (): void => this.toggleAutoPage(),
        onAutoPageStop: (): void => this.stopAutoPage(),
        onAutoPageSlowDown: (): void => this.changeAutoPageSpeed(2),
        onAutoPageSpeedUp: (): void => this.changeAutoPageSpeed(-2),
        onAutoPageFullTimerChange: (minutes: number, seconds: number): void =>
          this.changeAutoPageSessionTimer(minutes, seconds),
        onAutoPageFullSpeedChange: (seconds: number, onDeclined?: () => void): void =>
          this.setAutoPageSpeed(seconds, onDeclined),
        onAutoPageFollowHighlightChange: (enabled: boolean): void =>
          this.setAutoPageFollowHighlight(enabled),
        onOpenReplace: (): void => this.openQuickReplace(),
        onReloadControlReplace: (operationId?: string): Promise<void> => this.reloadControlReplace(true, operationId),
        onSaveControlReplace: (draft: ReaderControlReplaceDraft): Promise<void> => this.saveControlReplace(draft),
        onToggleControlReplace: (rule: ReaderReplaceRule, value: boolean): Promise<void> =>
          this.toggleControlReplace(rule, value),
        onDeleteControlReplace: (rule: ReaderReplaceRule): Promise<void> => this.deleteControlReplace(rule),
        onPreviewControlReplace: (): Promise<ReaderReplacePreview> => this.previewControlReplace(),
        onImportControlReplace: (): Promise<void> => this.importControlReplace(),
        onExportControlReplace: (): Promise<void> => this.exportControlReplace(),
        onAppearanceThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceTheme(theme),
        onAppearanceDayThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceDayTheme(theme),
        onAppearanceNightThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceNightTheme(theme),
        onAppearanceFontChange: (font: ReaderAppearanceFont): void => this.changeAppearanceFont(font),
        onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
          this.changeAppearanceFontOrder(fontOrder),
        onAppearanceFontReorderActivityChange: (active: boolean): void => {
          if (active && !this.reduceMotion) {
            try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
            catch (_) {}
          }
        },
        onAppearanceCustomFontImport: (): void => this.importReaderCustomFont(),
        onAppearanceIndentRequest: (indent: ReaderAppearanceIndent): void =>
          this.changeAppearanceIndent(indent),
        onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
          this.toggleAppearanceAlignment(current),
        onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
          this.stepAppearanceMetric(metric, direction),
        chineseConversionIdentity: this.chineseConversionIdentity(),
        onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string): void =>
          this.dispatchChineseConversionAction(mode, identity),
        onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void =>
          this.changeReaderSetting(key, value),
        onWidePageLayoutChange: (value: ReaderWidePageLayout): void => this.changeWidePageLayout(value),
        onScreenDirectionChange: (direction: ReaderScreenDirection): void =>
          this.changeReaderScreenDirection(direction),
        onScreenTimeoutChange: (timeout: ReaderScreenTimeout): void =>
          this.changeReaderScreenTimeout(timeout),
        onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
          this.changeReaderPageTurnStyle(style),
        onTtsToggle: (): void => this.toggleTts(),
        onTtsStop: (): void => this.stopTts(),
        onTtsPrevious: (): void => this.previousTtsUtterance(),
        onTtsNext: (): void => this.nextTtsUtterance(),
        onTtsSeek: (sliceIndex: number): void => this.seekTtsUtterance(sliceIndex),
        onTtsRateChange: (rate: number, onDeclined?: () => void): void => this.changeTtsRate(rate, onDeclined),
        onTtsTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode): void =>
          this.changeTtsTimer(minutes, seconds, mode),
        onTtsFollowHighlightChange: (enabled: boolean): void => this.changeTtsFollowHighlight(enabled),
        onTtsPauseOnInterruptionChange: (enabled: boolean): void =>
          this.changeTtsPauseOnInterruption(enabled),
        onTtsAllowMixingChange: (enabled: boolean): void => this.changeTtsAllowMixing(enabled),
        onTtsBackgroundPlaybackChange: (enabled: boolean): void => this.changeTtsBackgroundPlayback(enabled),
        onTtsKeepScreenOnChange: (enabled: boolean): void => this.changeTtsKeepScreenOn(enabled),
        onTtsFailurePolicyChange: (policy: 'skip' | 'stop'): void => this.changeTtsFailurePolicy(policy),
        onTtsVoiceChange: (language: string, person: number): void => this.changeTtsVoice(language, person),
        onTtsVoiceAudition: (language: string, person: number): Promise<void> => this.auditionReaderTtsVoice(language, person),
        onTtsAuditionStop: (): void => this.stopReaderTtsAudition(),
        onTtsEngineChange: (engine: string): Promise<void> => this.changeTtsEngine(engine),
        onTtsHttpEnginePut: (config: ReaderTtsConfigurationDraft): Promise<void> => this.saveHttpTtsEngine(config),
        onTtsHttpEngineDelete: (id: number): Promise<void> => this.deleteHttpTtsEngine(id),
      })
        // The control overlay, including its transparent outside-tap owner,
        // must sit above selectable reading Text nodes on every control route.
        // The persistent launch capsule also needs its parent above the raw
        // page sibling; its own zIndex only orders children inside this host.
        .zIndex(this.sessionLaunch !== undefined ? 8 : 7)
        // The selected demo replaces controls when the source drawer opens.
        // Retain the real control session/close animation without painting it
        // underneath the drawer's translucent scrim.
        .visibility(this.sourceSwitchPresentationVisible ? Visibility.Hidden : Visibility.Visible)
        .hitTestBehavior(HitTestMode.Transparent);
      if (this.sessionLaunch !== undefined) {
        ReaderSessionLaunchStage({
          fontScale: this.readingLayout().systemFontScale,
          sample: this.sessionLaunch.sample, sessionState: this.sessionLaunchBusinessStatus(),
          desiredPlaying: this.sessionLaunch.desiredPlaying, countdown: this.automaticReadingState().remainingSeconds,
          interactionEnabled: !this.pageTurnInputOwned && this.sessionLaunch.ownership === 'stage',
          ownsSourceRegion: this.sessionLaunch.ownership === 'stage' || this.sessionLaunch.ownership === 'handoffPending',
          material: readerSurfaceMaterialDecision('sessionCapsule', this.launchNavigationPreferences,
            this.readerAppScheme, this.readerSystemScheme),
          sourceSurfaceColor: readerAppColor('TOK_READ_CARD_EMPHASIS', this.readerAppScheme),
          sourceBorderColor: readerAppColor('TOK_LINE_STRONG', this.readerAppScheme),
          sourceBorderWidth: TOK_BORDER_W,
          themeScheme: this.readerAppScheme,
          sourceSharpContent: (): void => { this.sessionLaunchSourceContent(); },
          onToggle: (): void => this.toggleSessionCapsule(),
        }).id('reader-session-launch-fade-owner').opacity(this.sessionLaunchStageOpacity).zIndex(8)
          .visibility(this.sourceSwitchPresentationVisible || this.controlObscured ? Visibility.Hidden : Visibility.Visible)
          .transition(this.reduceMotion ? TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()), TransitionEffect.IDENTITY) :
            TransitionEffect.IDENTITY);
      }
      // Keep the raw page interaction owner mounted while the control session
      // opens/closes. Switching this full-screen node in the same commit as a
      // control dismiss can leave an empty compositor frame. It is inert via
      // hitTestMode.None while controls are visible, and the navigation-mode
      // gate preserves continuous-scroll ownership.
      // Tap and horizontal pan share one pointer owner and one previous/next
      // request path. Slide uses an already measured neighbour; none/cold
      // fallbacks still use the existing committed pagination flow.
      ReaderPageInteractionLayer({
              inputRevision: this.pageTurnInputRevision,
              inputCurrent: (revision: number): boolean => revision === this.pageTurnInputRevision && this.isReaderPageArbitrationEnabled(),
              onInputLost: (revision: number): void => {
                if (revision === this.pageTurnInputRevision) this.retirePagePointer();
              },
              onRegrab: (width: number, height: number, x: number, y: number, time: number,
                direction: ReaderPageTurnDirection): ReaderPageGestureState | undefined =>
                this.regrabReaderPageGesture(width, height, x, y, time, direction),
              readinessRevision: this.pageTurnReadinessRevision + this.pageTurnRenderRevision,
              onPreparationNeeded: (direction: ReaderPageTurnDirection): void => this.prepareHeldPagePointer(direction),
          interactionEnabled: this.phase !== 'failed' && this.sourceSwitchFailureMessage.length === 0 &&
            (this.readerSettingsSnapshot.navigationMode === 'paged' ||
            !this.hasContinuousRenderContent()) && this.isReaderPageArbitrationEnabled(),
          tapOnly: this.pageTurnTapOnlyInput(),
          currentTapOnly: (): boolean => this.pageTurnTapOnlyInput(),
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          allowTextSelection: this.readerTextSelectionEnabled(),
          // Pass the full avoid areas. The input layer caps side DOWN exclusion
          // and uses the bottom inset for tap suppression after recognition.
          systemGestureLeftInset: this.readerSystemGestureLeftInset(),
          systemGestureRightInset: this.readerSystemGestureRightInset(),
          systemGestureBottomInset: this.readerSystemGestureBottomInset(),
          onTurn: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome =>
            this.requestPageTurn(direction),
          canStartTurn: (direction: ReaderPageTurnDirection): boolean =>
            this.canStartReaderPageTurn(direction),
          canStartBookmark: (): boolean => this.canStartReaderBookmarkGesture(),
          onBookmarkStateChange: (state: ReaderPageGestureState): void =>
            this.onReaderBookmarkGestureStateChanged(state),
          onBookmarkRelease: (changed: boolean): void => this.onReaderBookmarkGestureReleased(changed),
          onBookmarkUnavailable: (reason: 'busy' | 'unavailable'): void =>
            this.onReaderBookmarkGestureUnavailable(reason),
          onOpenControl: (): void => this.openReaderControl('paged-tap'),
          onManualInteraction: (): void => this.onReaderManualInteraction(),
          onPointerStart: (pointerId: number): boolean => this.acquirePagePointer(pointerId),
          onPointerEnd: (pointerId: number): void => this.releasePagePointer(pointerId),
          onDeferredSegmentStart: (): boolean => this.reserveDeferredPointerSegment(),
          onDeferredSegmentResolve: (intent: ReaderPageTapIntent | undefined): void =>
            this.resolveDeferredPointerSegment(intent),
          onDeferredSegmentPromote: (): void => this.promoteDeferredPointerSegment(),
          onGestureStateChange: (state: ReaderPageGestureState): void =>
            this.onReaderPageGestureStateChanged(state),
          onGestureDecision: (decision: ReaderPageGestureDecision): ReaderPageGestureDecision =>
            this.onReaderPageGestureDecision(decision),
      });
      this.bookmarkCornerFeedback();
      this.readerStatusBarUnderlay();
      this.chapterLoadingContent();
      if (this.phase === 'failed' || this.sourceSwitchFailureMessage.length > 0) {
        ReaderReadingFailureSurface({
          theme: this.appearanceSnapshot.activeTheme,
          layout: { width: this.readingLayout().bodyWidth(), height: this.readingLayout().bodyHeight(false),
            left: this.readingLayout().contentLeft, top: this.readingLayout().contentTop },
          sourceSwitchFailureMessage: this.sourceSwitchFailureMessage,
          failureHint: this.failureHint,
          sourceSwitchScopeId: this.sourceSwitchScopeId,
          recoveryGeneration: this.readerRecoveryView.visible && this.readerRecoveryView.canRetry ?
            this.readerRecoveryView.generation : undefined,
          recoveryActionLabel: this.readerRecoveryActionLabel,
          rollbackInFlight: this.sourceSwitchRollbackInFlight,
          rollbackTarget: this.phase === 'failed' && this.sourceSwitchTransactionId !== undefined ?
            { transactionId: this.sourceSwitchTransactionId, scopeId: this.sourceSwitchScopeId,
              selectionToken: this.chapterSelectionToken } : undefined,
          switchSourceFocusId: this.sourceId !== LOCAL_READING_SOURCE_ID ?
            sourceSwitchTriggerFocusId(this.sourceId, this.bookId, 'reader-recovery') : undefined,
          onRetryFailedSourceSwitch: (scopeId: number): void => this.onRetryFailedSourceSwitch(scopeId),
          onRetryRecovery: (generation: number): void => {
            if (this.readerInputIsCurrent()) this.reconcileReaderRecovery(generation);
          },
          onRetryReading: (): void => {
            if (!this.sourceSwitchRollbackInFlight && this.readerInputIsCurrent()) this.retryReading();
          },
          onOpenSettings: (): void => this.openReaderControl(),
          onDismissSourceSwitchFailure: (scopeId: number): void => this.onDismissSourceSwitchFailure(scopeId),
          onRollbackSourceSwitch: (target: ReaderSourceSwitchRecoveryTarget): void => {
            if (!this.readerInputIsCurrent() || this.phase !== 'failed' || this.sourceSwitchRollbackInFlight ||
              target.scopeId !== this.sourceSwitchScopeId || target.selectionToken !== this.chapterSelectionToken ||
              target.transactionId === undefined || target.transactionId !== this.sourceSwitchTransactionId) return;
            this.onRollbackReaderTarget(target.transactionId, target.scopeId);
          },
          onSwitchSource: (): void => this.onSwitchSource(sourceSwitchTriggerFocusId(this.sourceId, this.bookId, 'reader-recovery')),
        });
      }
      if (this.sessionLaunch === undefined && this.shouldShowSessionCapsule()) {
        ReaderSessionCapsule({
          type: this.sessionCapsuleType(), sessionState: this.sessionCapsuleState(), countdown: this.sessionCapsuleCountdown(),
          themeScheme: this.readerAppScheme,
          fontScale: this.readingLayout().systemFontScale,
          measurementIdentity: this.sessionCapsuleMeasurementIdentity(this.sessionCapsuleType()),
          interactionEnabled: !this.pageTurnInputOwned,
          onToggle: (): void => this.toggleSessionCapsule(),
          onMeasured: (width: number, height: number, identity: string, type: ReaderSessionCapsuleType): void =>
            this.onSessionCapsuleMeasured(identity, type, width, height),
        }).position({ x: this.sessionCapsuleLayout().sessionX, y: this.sessionCapsuleLayout().sessionY }).zIndex(8);
      }
      if (this.sessionLaunch !== undefined) {
        ReaderPageChrome({
          isSessionOverlay: true,
          topStartText: this.sessionChromeForPresentation(this.continuousChromeProgressText).topStartText,
          topEndText: this.sessionChromeForPresentation(this.continuousChromeProgressText).topEndText,
          bottomStartText: this.sessionChromeForPresentation(this.continuousChromeProgressText).bottomStartText,
          bottomEndText: this.sessionChromeForPresentation(this.continuousChromeProgressText).bottomEndText,
          sessionVisible: true,
          sessionWidth: this.sessionLaunch.geometry.capsuleWidth, sessionHeight: this.sessionCapsuleMetrics().targetHeight,
          layout: this.readingLayout(), appearance: this.visibleReadingAppearance(),
          incomingOpacity: this.sessionLaunch.sample.immersiveOpacity,
          footerOpacity: this.sessionLaunchFooterExiting ? this.sessionLaunchFooterOpacity : this.sessionLaunch.sample.footerOpacity,
          footerTranslateX: this.sessionLaunchFooterExiting ? this.sessionLaunchFooterOffset : this.sessionLaunch.sample.footerTranslateX,
          sessionExitProgress: this.sessionLaunchFooterExitProgress,
        }).opacity(this.sessionLaunchFooterExiting ? 1 : this.sessionLaunchStageOpacity).zIndex(8).hitTestBehavior(HitTestMode.None)
          .transition(this.reduceMotion ? TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()), TransitionEffect.IDENTITY) :
            TransitionEffect.IDENTITY);
      }
      this.sourceSwitchPreparationContent();
      if (!this.sourceSwitchPresentationVisible && this.hasReaderRecoveryContent()) {
        ReaderRecoveryOverlay({
          overlayId: this.readerRecoveryOverlayId(),
          widthVp: this.controlLayout(this.readerWindowMetricsRevision).topBarWidth,
          maxHeightVp: this.readerRecoveryViewportHeight(),
          leftVp: (this.viewportWidth - this.controlLayout(this.readerWindowMetricsRevision).topBarWidth) / 2,
          topVp: this.readerRecoveryTop(),
          interactionEnabled: this.readerRecoveryInputCurrent(),
          bookmarkRecovery: this.bookmarkRecovery, bookmarkIdentity: this.bookmarkRecoveryIdentity(),
          offlineIdentity: `${this.lifecycleToken}:${this.bookmarkRecovery.presentationId}`,
          readerNotice: this.readerRecoveryView, readerNoticeActionLabel: this.readerRecoveryActionLabel,
          settingsNotice: this.readerSettingsRecovery, settingsNoticeBusy: this.readerSettingsRecoveryBusy,
          appearanceNotice: this.appearanceSaveRecovery, appearanceNoticeBusy: this.appearanceSaveRecoveryBusy,
          ttsPreferencesNotice: this.ttsPreferencesRecovery, ttsPreferencesNoticeBusy: this.ttsPreferencesRecoveryBusy,
          ttsConfigurationNotice: this.ttsConfigurationRecovery, replaceNotice: this.replaceRecovery,
          replaceNoticeVisible: this.replaceRecovery.visible && this.readerPreferenceModule() !== 'replace',
          inputCurrent: (): boolean => this.readerRecoveryInputCurrent(),
          bookmarkCurrent: (identity: string): boolean => identity === this.bookmarkRecoveryIdentity(),
          offlineCurrent: (identity: string): boolean => identity === `${this.lifecycleToken}:${this.bookmarkRecovery.presentationId}`,
          onBookmarkAction: (identity: string, continuing: boolean): void => this.reconcileBookmarkRecovery(identity, continuing),
          onOfflineAction: (identity: string, generation: number, presentation: string, continuing: boolean): void =>
            this.reconcileOfflineRecovery(identity, generation, presentation, continuing),
          onReaderNoticeAction: (generation: number): void => this.reconcileReaderRecovery(generation),
          onPreferenceNoticeAction: (domain: 'settings' | 'tts', generation: number): void =>
            this.retryReaderPreferenceNotice(domain, generation),
          onAppearanceNoticeAction: (generation: number): void => this.retryAppearanceSaveRecovery(generation),
          onTtsConfigurationNoticeAction: (generation: number): void => this.openTtsConfigurationRecovery(generation),
          onReplaceNoticeAction: (generation: number): void => this.openReplaceRecovery(generation),
        });
      }
    }
    .width('100%')
    .height('100%')
    .id('reader-reading-stage')
    .customProperty(READER_LAYOUT_READING_PAPER, READER_LAYOUT_DEBUG_BUILD ? this.visibleReadingAppearance().activeTheme : undefined)
    .focusable(true)
    .defaultFocus(true)
    .onKeyEvent((event: KeyEvent): boolean => this.onReaderKeyEvent(event))
    .attributeModifier(new ReaderSmartGestureShortcut(this.smartGestureSettings.enabled))
    .onAppear((): void => this.syncSmartGestureMonitor())
    .clip(true)
    .onTouch((event: TouchEvent): void => this.onControlBackdropTouch(event))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const lifecycleToken = this.lifecycleToken;
      if (!this.isSessionActive(lifecycleToken)) {
        return;
      }
      const width = this.numericAreaLength(newValue.width);
      const height = this.numericAreaLength(newValue.height);
      this.admitReaderViewportSize(width, height, lifecycleToken);
      this.publishControlVerificationReady();
    });
  }

  private readerRecoveryOwnerKey(): string {
    return JSON.stringify([this.sourceId, this.bookId, this.lifecycleToken, this.chapterSelectionToken]);
  }

  private showReaderRecovery(message: string, actionLabel: string = '', action?: () => void,
    kind: 'general' | 'progress' | 'presentation' = 'general'): void {
    this.readerRecoveryKind = kind;
    this.readerRecoveryIdentity = this.readerRecoveryOwnerKey();
    this.readerRecoveryProgressRevision = this.lastCommittedProgress?.progressRevision;
    this.readerRecoveryAction = action;
    this.readerRecoveryActionLabel = actionLabel;
    this.readerRecoveryView = { message, visible: message.length > 0, canRetry: action !== undefined,
      generation: (this.readerRecoveryView?.generation ?? 0) + 1 };
  }

  private settleReaderRecovery(kind: 'progress' | 'presentation', progressRevision: string | undefined = undefined): void {
    if (this.readerRecoveryKind !== kind || this.readerRecoveryIdentity !== this.readerRecoveryOwnerKey() ||
      !this.mounted || this.exitRequested ||
      (kind === 'progress' && (progressRevision === undefined || progressRevision === this.readerRecoveryProgressRevision))) return;
    this.showReaderRecovery('');
  }

  private bindAppearanceSaveRecovery(lifecycleToken: number): void {
    this.appearanceSaveUnsubscribe?.();
    this.appearanceSaveRecoveryIdentity = '';
    this.appearanceSaveUnsubscribe = this.appearanceGateway.subscribeSaveState((state: ReaderAppearanceSaveState): void => {
      this.updateAppearanceSaveRecovery(state, lifecycleToken);
    });
  }

  private refreshAppearanceSaveRecovery(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) return;
    this.updateAppearanceSaveRecovery(this.appearanceGateway.saveState(), lifecycleToken);
  }

  private updateAppearanceSaveRecovery(state: ReaderAppearanceSaveState, lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken) || !ReaderRuntimeOwner.isCurrent(this.replaceRuntime)) return;
    const identity = JSON.stringify([lifecycleToken, this.sourceId, this.bookId, this.chapterSelectionToken, state.revision]);
    const generation = this.appearanceSaveRecoveryIdentity === identity ? this.appearanceSaveRecovery.generation :
      this.appearanceSaveRecovery.generation + 1;
    this.appearanceSaveRecoveryIdentity = identity;
    this.appearanceSaveRevision = state.revision;
    this.appearanceSaveRecoveryBusy = state.retrying;
    this.appearanceSaveRecovery = { visible: state.unconfirmed,
      message: state.unconfirmed ? '外观设置保存尚未确认，当前选择已保留。' : '',
      canRetry: state.canRetry, generation };
    if (!this.hasReaderRecoveryContent()) this.retireReaderRecovery();
  }

  private retryAppearanceSaveRecovery(generation: number): void {
    if (!this.readerRecoveryInputCurrent() || generation !== this.appearanceSaveRecovery.generation ||
      !this.appearanceSaveRecovery.visible) return;
    const state = this.appearanceGateway.saveState();
    if (!state.canRetry || state.revision !== this.appearanceSaveRevision || this.appearanceSaveRecoveryIdentity !==
      JSON.stringify([this.lifecycleToken, this.sourceId, this.bookId, this.chapterSelectionToken, state.revision])) return;
    void this.appearanceGateway.retrySave(state.revision).catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', '%{private}s', `Appearance save retry pending: ${this.errorMessage(error)}`);
    });
  }

  private setReaderPreferenceNotice(domain: 'settings' | 'tts', message: string, canRetry: boolean, busy: boolean = false): void {
    const previous = domain === 'settings' ? this.readerSettingsRecovery : this.ttsPreferencesRecovery;
    const view: ReaderRecoveryView = { message, visible: message.length > 0, canRetry,
      generation: (previous?.generation ?? 0) + 1 };
    if (domain === 'settings') {
      this.readerSettingsRecovery = view;
      this.readerSettingsRecoveryBusy = busy;
    } else {
      this.ttsPreferencesRecovery = view;
      this.ttsPreferencesRecoveryBusy = busy;
    }
  }

  private settleReaderPreferenceNotice(domain: 'settings', current: () => boolean): void {
    if (!current()) return;
    const pending = this.readerSettingsGateway.writeFacts().pendingReconciliation;
    this.setReaderPreferenceNotice(domain, pending ? '阅读设置保存尚未确认，当前效果已保留。' : '', pending);
  }

  private retryReaderPreferenceNotice(domain: 'settings' | 'tts', generation: number): void {
    const view = domain === 'settings' ? this.readerSettingsRecovery : this.ttsPreferencesRecovery;
    if (!view.canRetry || view.generation !== generation || !this.isSessionActive(this.lifecycleToken)) return;
    this.setReaderPreferenceNotice(domain, domain === 'settings' ?
      '正在核对并保存阅读设置…' : '正在核对并保存朗读设置…', false, true);
    if (domain === 'settings') {
      const current = this.captureReaderSettingsAdmission(this.lifecycleToken, this.readerSettingsMutationGeneration);
      if (this.readerSettingsGateway.writeFacts().pendingReconciliation) this.retryPendingReaderSettings(current);
      else void this.persistReaderSettingsSnapshot(this.readerSettingsSnapshot, current)
        .catch((error: Error): void => this.notifyReaderSettingsSavePending(error, current));
    } else {
      this.ttsPreferences.retryPending();
    }
  }

  private reconcileReaderRecovery(generation: number): void {
    if (!this.mounted || this.exitRequested || !this.readerRecoveryView.visible || !this.readerRecoveryView.canRetry ||
      generation !== this.readerRecoveryView.generation || this.readerRecoveryIdentity !== this.readerRecoveryOwnerKey()) return;
    const action = this.readerRecoveryAction;
    this.showReaderRecovery('');
    action?.();
  }

  private bookmarkRecoveryIdentity(): string {
    return `${this.lifecycleToken}:${this.bookmarkRecovery.presentationId}:${this.bookmarkRecovery.bookmarks.generation}:${this.bookmarkRecovery.originalBookmarks?.identity ?? ''}`;
  }

  private bookmarkWriteEnabled(): boolean {
    return this.bookmarkRecovery.bookmarkWriteEnabled === true;
  }

  private reconcileBookmarkRecovery(identity: string, continuing: boolean): void {
    const recovery = this.bookmarkRecovery;
    const original = recovery.originalBookmarks;
    if (!this.isSessionActive(this.lifecycleToken) || !this.isControlInputEnabled() ||
      identity !== this.bookmarkRecoveryIdentity()) return;
    if (original !== undefined) {
      if (!continuing && !original.busy) this.onReconcileBookmarks(original.generation, recovery.presentationId);
      return;
    }
    if (!recovery.bookmarks.visible || recovery.bookmarksBusy === true ||
      (continuing ? !recovery.canContinueBookmarks : !recovery.bookmarks.canRetry)) return;
    if (continuing) this.onContinueBookmarks(recovery.bookmarks.generation, recovery.presentationId);
    else this.onReconcileBookmarks(recovery.bookmarks.generation, recovery.presentationId);
  }

  private readerPreferenceModule(): string {
    const location = readerControlContentLocation(this.controlSession);
    return location.level === 'secondary' ? location.module : '';
  }

  private hasReaderRecoveryContent(): boolean {
    return this.readerRecoveryView.visible || this.readerSettingsRecovery.visible || this.appearanceSaveRecovery.visible || this.ttsPreferencesRecovery.visible ||
      this.ttsConfigurationRecovery.visible || (this.replaceRecovery.visible && this.readerPreferenceModule() !== 'replace') ||
      this.bookmarkRecovery.bookmarks.visible || this.bookmarkRecovery.originalBookmarks !== undefined ||
      this.readerOfflineRecoveryVisible();
  }

  private readerOfflineRecoveryVisible(): boolean {
    return this.bookmarkRecovery.offline.visible && this.bookmarkRecovery.offlineKind !== 'result';
  }

  private reconcileOfflineRecovery(identity: string, generation: number, presentation: string, continuing: boolean): void {
    const recovery = this.bookmarkRecovery;
    if (!this.readerRecoveryInputCurrent() || identity !== `${this.lifecycleToken}:${recovery.presentationId}` ||
      presentation !== recovery.presentationId || !this.readerOfflineRecoveryVisible() || recovery.offlineBusy === true ||
      generation !== recovery.offline.generation ||
      (continuing ? !recovery.canContinueOffline : !recovery.offline.canRetry)) return;
    if (continuing) this.onContinueOffline(generation, presentation);
    else this.onReconcileOffline(generation, presentation);
  }

  private openReaderRecovery(identity: string): void {
    this.refreshAppearanceSaveRecovery(this.lifecycleToken);
    if (!this.mounted || this.exitRequested || identity !== this.readerRecoveryOverlayId() ||
      !this.hasReaderRecoveryContent() || !this.isControlInputEnabled()) return;
    this.hideControl();
    this.readerRecoveryRequestIdentity = identity;
    this.readerRecoveryRequested = true;
  }

  private readerRecoveryRequestCurrent(): boolean {
    return this.readerRecoveryRequested && this.readerRecoveryRequestIdentity === this.readerRecoveryOverlayId();
  }

  private onReaderIdentityChanged(): void {
    this.staticSessionCapsuleOrigin = undefined;
    this.ttsPlayback.clearResumePresentation();
    this.retireReaderRecovery();
  }

  private retireReaderRecovery(): void {
    this.readerRecoveryRequested = false;
    this.readerRecoveryRequestIdentity = '';
  }

  private readerRecoveryBaseLayout(): ReaderControlLayoutSnapshot {
    // The floating notice uses the ordinary top-bar anchor independently of
    // the body and control layouts underneath it.
    return resolveReaderControlLayout(this.effectiveViewportWidth(), this.effectiveViewportHeight(),
      this.expandedLayout, ReaderWindowCoordinator.metrics());
  }

  private recoveryTopBarRevision: number = -1;
  private recoveryTopBarHeight: number = READER_CONTROL_TOP_BAR_HEIGHT;
  private readerRecoveryTopBarHeight(): number {
    const revision = ReaderWindowCoordinator.metrics().revision;
    const ready = readerReadingTopBarFontsReady('reading');
    if (!ready || this.recoveryTopBarRevision !== revision) {
      this.recoveryTopBarHeight = readerReadingTopBarHeight(this.getUIContext(), 'reading', READER_CONTROL_TOP_BAR_HEIGHT);
      this.recoveryTopBarRevision = ready ? revision : -1;
    }
    return this.recoveryTopBarHeight;
  }

  private readerRecoveryTop(): number {
    const base = this.readerRecoveryBaseLayout();
    const layout = this.controlLayout(this.readerWindowMetricsRevision);
    const headerHeight = layout.topBarVisible ? Math.max(this.readerRecoveryTopBarHeight(), layout.topBarHeight) : 0;
    return base.topBarTop + (this.controlVisible() ? headerHeight + READER_CONTROL_SAFE_TOP_GAP : 10);
  }

  private readerRecoveryViewportHeight(): number {
    const remaining = this.effectiveViewportHeight() - this.readerRecoveryTop() -
      readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics(), false);
    const cap = this.effectiveViewportHeight() / 3;
    return Math.max(0, Math.min(cap, remaining));
  }

  private readerRecoveryOverlayId(): string {
    return `reader-recovery-overlay:${JSON.stringify([this.sourceId, this.bookId, this.lifecycleToken])}`;
  }

  private readerRecoveryInputCurrent(): boolean {
    return this.mounted && !this.exitRequested && this.readerRecoveryRequestCurrent() && !this.controlVisible() && !this.controlMotionVisible() && this.isControlInputEnabled() && !this.sourceSwitchPresentationVisible;
  }

  @Builder
  private continuousPageChromeContent() {
    // Session launch already owns one shared chrome overlay. Ordinary
    // continuous chrome remains a stationary sibling of the scrolling List.
    if (this.sessionLaunch === undefined) {
      ReaderPageChrome({
        topStartText: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).topStartText,
        topEndText: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).topEndText,
        bottomStartText: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).bottomStartText,
        bottomEndText: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).bottomEndText,
        sessionVisible: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).sessionVisible,
        sessionWidth: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).sessionWidth,
        sessionHeight: this.continuousPageChromeSnapshot(this.continuousRenderRevision,
          this.continuousChromeProgressText).sessionHeight,
        layout: this.readingLayout(),
        appearance: this.visibleReadingAppearance(),
      }).zIndex(1).hitTestBehavior(HitTestMode.None);
    }
  }

  private continuousPageChromeSnapshot(contentRevision: number,
    _progressText: string): ReaderPageChromeSnapshot {
    const retained = this.retainedChapterFrame()?.continuousChrome;
    if (retained !== undefined) return retained;
    const chapter = this.chapter;
    const scalar = this.continuousVisibleScalar;
    const scalarCount = this.chapterLayoutMap?.scalarCount() ?? 0;
    const visible = this.shouldShowSessionCapsule();
    const width = visible ? this.activeSessionCapsuleWidth() : 0;
    const height = visible ? this.activeSessionCapsuleHeight() : 0;
    const previous = this.continuousChromeCache;
    if (previous !== undefined && previous.revision === contentRevision && previous.chapter === chapter &&
      previous.chapterTitle === this.chapterTitle && previous.bookTitle === this.bookTitle &&
      previous.clock === this.pageChromeClockText && previous.scalar === scalar && previous.scalarCount === scalarCount &&
      previous.toc === this.tocEntries &&
      previous.catalogRevision === this.controlDirectorySourceRevision && previous.catalogPending === this.entryCatalogPending &&
      previous.navigation === this.entryCatalogNavigation && previous.metrics === this.contentMetrics &&
      previous.snapshot.sessionVisible === visible && previous.snapshot.sessionWidth === width &&
      previous.snapshot.sessionHeight === height) return previous.snapshot;
    const chapterIndex = chapter?.chapterIndex ?? -1;
    const title = this.pageChromeChapterTitle(chapterIndex);
    const progress = this.entryCatalogPending && this.entryCatalogNavigation === undefined && this.contentMetrics === undefined ?
      '—' : formatReaderPageProgress(this.pageChromeProgress(chapterIndex, scalar, scalarCount));
    const snapshot = new ReaderPageChromeSnapshot(this.bookTitle, this.pageChromeClockText, title.length > 0 ? title : '—',
      progress, visible, width, height);
    this.continuousChromeCache = { revision: contentRevision, chapter, chapterTitle: this.chapterTitle,
      bookTitle: this.bookTitle, clock: this.pageChromeClockText, scalar, scalarCount,
      toc: this.tocEntries,
      catalogRevision: this.controlDirectorySourceRevision, catalogPending: this.entryCatalogPending,
      navigation: this.entryCatalogNavigation, metrics: this.contentMetrics, snapshot };
    return snapshot;
  }

  /** Core acceptance precedes target body/layout/first canonical persistence.
   * Keep preparation visible across that real seam without changing any
   * readiness, progress or interaction owner. A ready page must belong to the
   * current selection; a predecessor page cannot dismiss this surface. */
  private shouldShowSourceSwitchPreparation(): boolean {
    const pending = this.sessionGateway === undefined ? this.sourceSwitchTransactionId !== undefined :
      this.sessionGateway.hasPendingSourceSwitch();
    return pending && this.isReaderIdentityCurrent() && this.phase !== 'failed' && this.sourceSwitchFailureMessage.length === 0 &&
      !(this.phase === 'ready' && this.visiblePage !== undefined && this.visibleFragments.length > 0 &&
        this.visiblePageSelectionToken === this.chapterSelectionToken);
  }

  private shouldShowChapterLoading(): boolean {
    if (!this.windowChromeActive || this.phase === 'failed' || this.sourceSwitchFailureMessage.length > 0 ||
      this.shouldShowSourceSwitchPreparation() ||
      (this.chapterSelection.ticket?.closeOnCommit === false && this.controlVisible()) ||
      (this.visiblePage !== undefined && this.visiblePageSelectionToken === this.chapterSelectionToken)) return false;
    this.chapterPresentationRevision;
    const lease = this.currentChapterPresentation();
    return lease === undefined || this.chapterPresentation.shouldShowLoading(lease, readerMotionNowMs());
  }

  private currentChapterPresentation(): ReaderChapterPresentationLease | undefined {
    return this.chapterPresentation.current(this.lifecycleToken, this.chapterSelectionToken);
  }

  private retainedChapterFrame(): ReaderRetainedChapterFrame | undefined {
    const lease = this.currentChapterPresentation();
    return lease === undefined ? undefined : this.chapterPresentation.visibleOrigin(lease);
  }

  private captureRetainedChapterFrame(): ReaderRetainedChapterFrame | undefined {
    const page = this.visiblePage;
    if (page === undefined || this.visibleFragments.length === 0) return undefined;
    const preparedOrigin = this.pageTurnPreparation?.origin ?? this.previousChapterMeasurement?.origin;
    const materialized = this.chapter !== undefined && this.chapterLayoutMap !== undefined &&
      this.materializedChapterSelectionToken === this.visiblePageSelectionToken;
    const context = preparedOrigin ?? (materialized ? this.captureMaterializedChapterContext() : undefined);
    if (context === undefined) return undefined;
    const continuousChrome = this.hasContinuousRenderContent() ?
      this.continuousPageChromeSnapshot(this.continuousRenderRevision, this.continuousChromeProgressText) : undefined;
    return { renderPage: this.currentPageTurnRenderPage(), page, context, continuousChrome };
  }

  private beginRetainedChapterPresentation(chapterIndex: number, lifecycle: number, selection: number,
    refresh: boolean = false, context?: RemoteReadingPositionContext, ttsOwner?: ReaderTtsFollowLease,
    recovery: boolean = false): void {
    this.cancelChapterLoadingDelay();
    const source: ReaderChapterLoadSource = this.sourceId === LOCAL_READING_SOURCE_ID ? 'local' :
      recovery || findReusableReadingWindowChapter(this.chapterWindow, chapterIndex, refresh, context) !== undefined ?
        'cache' : 'coldRemote';
    const retained = this.captureRetainedChapterFrame();
    const lease = this.chapterPresentation.begin(lifecycle, selection, source, retained, readerMotionNowMs());
    this.retainedTtsOwner = ttsOwner;
    this.retainedTtsCommitAdmitted = false;
    this.chapterPresentationRevision += 1;
    if (source !== 'coldRemote') {
      if (retained !== undefined && this.currentChapterIndex() !== chapterIndex)
        this.observeChapterTransition(source, chapterIndex);
      return;
    }
    this.chapterLoadingDelayTimer = setTimeout((): void => {
      this.chapterLoadingDelayTimer = -1;
      if (this.isSelectionActive(lifecycle, selection) && this.chapterPresentation.owns(lease)) {
        this.chapterPresentationRevision += 1;
      }
    }, READER_CHAPTER_LOADING_DELAY_MS);
  }

  private observeChapterTransition(source: 'local' | 'cache', targetChapterIndex: number): void {
    if (!readerTransitionsEnabled()) return;
    const continuous = this.readerSettingsSnapshot.navigationMode === 'continuous';
    const nodes = continuous ? ['reader-reading-interaction-host-continuous'] :
      [READER_PAGE_TURN_SLOT_A + ':transition-body', READER_PAGE_TURN_SLOT_B + ':transition-body'];
    const chapterBodyCount = nodes.length;
    nodes.push('reader-chapter-loading-state');
    readerBeginTransition({ kind: 'chapter', action: 'advance', subject: 'reader-chapter-' + source,
      scope: 'reader-chapter', nodes, chapterBodyCount, targetChapterIndex });
  }

  private markRetainedChapterBodyReady(lifecycle: number, selection: number): void {
    const lease = this.chapterPresentation.current(lifecycle, selection);
    if (lease === undefined || !this.chapterPresentation.markBodyReady(lease, readerMotionNowMs())) return;
    this.chapterPresentationRevision += 1;
  }

  private finishRetainedChapterPresentation(lifecycle: number, selection: number): void {
    const lease = this.chapterPresentation.current(lifecycle, selection);
    if (lease !== undefined && this.chapterPresentation.complete(lease)) this.clearChapterPresentation();
  }

  private continuousChapterCommitScalar(page: PhysicalReadingPage): number {
    const owner = this.retainedTtsOwner;
    const offset = this.ttsState.charStart;
    if (owner === undefined || !this.ttsFollowHighlight || offset === undefined ||
      !this.ttsPageFollow.owns(owner, this.ttsFollowScope(), this.ttsState) ||
      this.ttsState.chapterIndex !== this.chapter?.chapterIndex ||
      this.ttsState.contentVersion !== this.materializedContentVersion) return page.startScalar;
    return Number.isSafeInteger(offset) && offset >= page.startScalar && offset < page.endScalar ? offset : page.startScalar;
  }

  private cancelChapterLoadingDelay(): void {
    if (this.chapterLoadingDelayTimer < 0) return;
    clearTimeout(this.chapterLoadingDelayTimer);
    this.chapterLoadingDelayTimer = -1;
  }

  private clearChapterPresentation(): void {
    this.cancelChapterLoadingDelay();
    this.chapterPresentation.clear();
    this.retainedTtsOwner = undefined;
    this.retainedTtsCommitAdmitted = false;
    this.chapterPresentationRevision += 1;
  }

  private cancelUncommittedTtsChapter(): void {
    const owner = this.retainedTtsOwner;
    if (owner === undefined || this.retainedTtsCommitAdmitted || this.exitRequested || !this.mounted ||
      this.ttsPageFollow.owns(owner, this.ttsFollowScope(), this.ttsState)) return;
    const frame = this.retainedChapterFrame();
    if (frame === undefined) return;
    // No target progress write was admitted. Restore the exact visible chapter
    // context and revoke its abandoned measurement by advancing the selection.
    this.clearChapterPresentation();
    this.chapterSelectionToken += 1;
    this.chapterSelection.reset();
    this.resetForChapterSelection(false, true, true);
    this.restoreMaterializedChapterContext(frame.context, true);
    this.visiblePage = frame.page;
    this.visiblePageSelectionToken = this.chapterSelectionToken;
    this.visibleFragments = frame.page.fragments;
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.schedulePageTurnPreparation();
  }

  private loadingChapterTitle(): string {
    const index = this.chapterSelection.ticket?.targetChapterIndex ?? this.loadingChapterIndex ??
      this.requestedBookmarkAnchor?.chapterIndex ?? this.requestedChapterIndex;
    return index === undefined ? '' :
      this.readingTocEntries().find((entry: LocalReadingTocEntry): boolean => entry.index === index)?.title ?? '';
  }

  @Builder
  private chapterLoadingContent() {
    if (this.shouldShowChapterLoading()) {
      ReaderChapterLoadingState({
        theme: this.appearanceSnapshot.activeTheme,
        expanded: this.expandedLayout,
        chapterTitle: this.loadingChapterTitle(),
        active: this.appForeground,
        reduceMotion: this.reduceMotion,
        topInset: readerVisualSafeTop(this.readerStatusBarMetrics(this.readerWindowMetricsRevision)),
        leftInset: readerInteractiveSafeLeft(this.readerStatusBarMetrics(this.readerWindowMetricsRevision)),
        onBack: (): void => { if (this.readerInputIsCurrent()) this.beginExit(); },
      }).zIndex(9);
    }
  }

  @Builder
  private sourceSwitchPreparationContent() {
    if (this.shouldShowSourceSwitchPreparation()) {
      SourceSwitchProgress({
        sourceName: this.sourceName,
        chapterTitle: this.chapter?.chapterTitle || this.chapterTitle,
        statusText: '正在载入章节…',
        reduceMotion: this.reduceMotion,
        active: this.windowChromeActive,
        topInset: readerVisualSafeTop(this.readerStatusBarMetrics(this.readerWindowMetricsRevision)),
        bottomInset: readerInteractiveSafeBottom(this.readerStatusBarMetrics(this.readerWindowMetricsRevision)),
      }).zIndex(9);
    }
  }

  private sourceSwitchCanonicalPageCurrent(): boolean {
    const chapter = this.chapter;
    return chapter !== undefined && chapter.sourceId === this.sourceId && chapter.bookId === this.bookId &&
      chapter.cacheRefreshRequired !== true && chapter.sourceCorrectionRequired !== true && chapter.content.trim().length > 0 &&
      this.materializedChapterSelectionToken === this.chapterSelectionToken &&
      this.visiblePage !== undefined && this.visiblePageSelectionToken === this.chapterSelectionToken &&
      this.visibleFragments.some((fragment: ReadingSurfacePageFragment): boolean => fragment.text.trim().length > 0 &&
        fragment.imageHeight <= 0 && (fragment.nativeParagraph === undefined || fragment.nativeParagraphFirst));
  }

  private sourceSwitchContinuousRangeObserver(revision: number): (start: number, end: number, progress: number) => void {
    return (start: number, end: number, progress: number): void => {
      if (revision !== this.continuousRenderRevision || this.visiblePageSelectionToken !== this.chapterSelectionToken) return;
      this.onContinuousVisibleRangeChanged(start, end, progress);
      this.onSourceSwitchPagePresented(revision, true);
    };
  }

  private onSourceSwitchPagePresented(revision: number, continuous: boolean = false): void {
    const continuousStage = this.readerSettingsSnapshot.navigationMode === 'continuous' && this.hasContinuousRenderContent();
    if (!this.mounted || this.exitRequested || this.phase !== 'ready' || continuous !== continuousStage ||
      revision !== (continuous ? this.continuousRenderRevision : this.pageTurnRenderRevision) ||
      !this.sourceSwitchCanonicalPageCurrent()) return;
    // Exact resident content revision + native scheduling/list-layout callback.
    // This admits view effects, never Core ACKs or physical display fences.
    this.sourceSwitchReveal.present(revision, this.chapterSelectionToken, continuous);
    this.sourceSwitchCompletionChanged();
  }

  private sourceSwitchCompletionCurrent(completion: SourceSwitchCompletionPresentation): boolean {
    const continuousStage = this.readerSettingsSnapshot.navigationMode === 'continuous' && this.hasContinuousRenderContent();
    return this.mounted && !this.exitRequested && this.appForeground && this.sourceSwitchCompletionVisible &&
      this.isReaderIdentityCurrent() && completion.sourceId === this.sourceId && completion.bookId === this.bookId &&
      completion.readingReadyGeneration === this.readingReadyGeneration && this.phase === 'ready' &&
      this.sourceSwitchFailureMessage.length === 0 && this.sourceSwitchCanonicalPageCurrent() &&
      this.sourceSwitchReveal.matches(completion, this.chapterSelectionToken, this.lifecycleToken,
        continuousStage ? this.continuousRenderRevision : this.pageTurnRenderRevision, continuousStage) &&
      this.chapter?.chapterIndex === completion.chapterIndex && this.visiblePage?.startScalar === completion.chapterOffset;
  }

  private sourceSwitchCompletionDisplayCurrent(): boolean {
    return this.sourceSwitchCompletion !== undefined &&
      this.sourceSwitchVisualSelectionToken === this.chapterSelectionToken &&
      this.sourceSwitchCompletionCurrent(this.sourceSwitchCompletion);
  }

  private finishSourceSwitchReveal(): void {
    const animator = this.sourceSwitchRevealAnimator;
    this.sourceSwitchRevealAnimator = undefined;
    if (animator !== undefined) {
      // Native cancellation emits an end sample. It cannot mutate a successor
      // completion, including one started in the same ArkUI property commit.
      animator.onFrame = (_value: number): void => {};
      animator.onFinish = (): void => {};
      animator.cancel();
    }
    this.sourceSwitchRevealOpacity = 0;
  }

  private cancelSourceSwitchCompletion(consume: boolean = true): void {
    this.sourceSwitchReveal.retire(consume ? this.sourceSwitchCompletion : undefined);
    this.finishSourceSwitchReveal();
    this.sourceSwitchFeedback.reset();
    this.sourceSwitchVisualSelectionToken = -1;
  }

  private sourceSwitchCompletionVisibleChanged(): void {
    if (!this.sourceSwitchCompletionVisible) this.cancelSourceSwitchCompletion();
    else this.sourceSwitchCompletionChanged();
  }

  private sourceSwitchCompletionChanged(): void {
    this.publishControlVerificationReady();
    const completion = this.sourceSwitchCompletion;
    if (completion === undefined) {
      this.sourceSwitchReveal.clearPending();
      this.cancelSourceSwitchCompletion(false);
      return;
    }
    if (!this.mounted) return;
    const key = this.sourceSwitchReveal.bind(completion, this.chapterSelectionToken, this.lifecycleToken);
    // A same-selection reflow can admit once. Successor selections cannot
    // reuse that receipt, even when chapter, anchor and ready generation match.
    if (!this.sourceSwitchReveal.pendingAt(this.chapterSelectionToken, this.lifecycleToken)) {
      this.cancelSourceSwitchCompletion();
      return;
    }
    if (!this.appForeground || !this.sourceSwitchCompletionVisible || this.exitRequested || !this.isReaderIdentityCurrent() ||
      completion.sourceId !== this.sourceId || completion.bookId !== this.bookId ||
      completion.readingReadyGeneration !== this.readingReadyGeneration || this.phase === 'failed') {
      this.cancelSourceSwitchCompletion();
      return;
    }
    const chapter = this.chapter;
    if (chapter?.sourceId === completion.sourceId && chapter.bookId === completion.bookId &&
      (chapter.cacheRefreshRequired === true || chapter.sourceCorrectionRequired === true)) {
      // A retained, unverified body is a degraded reading state, not a
      // pending successful reveal. Later validation cannot revive this ACK.
      this.cancelSourceSwitchCompletion();
      return;
    }
    if (!this.sourceSwitchCompletionCurrent(completion)) {
      // A same-selection reflow can finish after its real canonical ACK. It
      // may admit the receipt once ready; an already-visible notice retires.
      this.sourceSwitchFeedback.reset();
      if (this.sourceSwitchRevealOpacity > 0) this.cancelSourceSwitchCompletion();
      return;
    }
    if (this.sourceSwitchReveal.consumed(key)) return;
    this.cancelSourceSwitchCompletion(false);
    const epoch = this.sourceSwitchReveal.consume(key);
    const lifecycle = this.lifecycleToken;
    const selection = this.chapterSelectionToken;
    this.sourceSwitchVisualSelectionToken = selection;
    const current = (): boolean => this.sourceSwitchReveal.isEpoch(epoch) && lifecycle === this.lifecycleToken &&
      selection === this.chapterSelectionToken && this.sourceSwitchCompletion !== undefined &&
      this.sourceSwitchReveal.key(this.sourceSwitchCompletion) === key &&
      this.sourceSwitchCompletionCurrent(completion);
    // Source switching keeps its reader reveal wash, but its completion
    // message uses the global short-feedback surface. The reader-specific
    // capsule remains reserved for auto-page/page-turn session controls.
    this.sourceSwitchFeedback.show(() => this.getUIContext(), {
      title: '书源已切换',
      tone: 'success',
      message: `已切换至 ${completion.sourceName || completion.sourceId}`,
      key: `source-switch:${key}`,
      duration: READER_FEEDBACK_EXTENDED_MS,
    }, current);
    if (this.reduceMotion) return;
    const animator = createReaderSourceSwitchWash((): UIContext => this.getUIContext(),
      (opacity: number): void => { this.sourceSwitchRevealOpacity = opacity; });
    this.sourceSwitchRevealAnimator = animator;
    animator.onFrame = (value: number): void => {
      if (this.sourceSwitchRevealAnimator !== animator) return;
      if (!current()) { this.cancelSourceSwitchCompletion(); return; }
      this.sourceSwitchRevealOpacity = value;
    };
    animator.onFinish = (): void => {
      if (this.sourceSwitchRevealAnimator !== animator) return;
      if (!current()) { this.cancelSourceSwitchCompletion(); return; }
      this.sourceSwitchRevealAnimator = undefined;
      this.sourceSwitchRevealOpacity = 0;
    };
    animator.play();
  }

  @Builder
  private sourceSwitchCompletionWash() {
    if (this.sourceSwitchRevealOpacity > 0 && this.sourceSwitchCompletionDisplayCurrent()) {
      SourceSwitchCompletionOverlay({ washOpacity: this.sourceSwitchRevealOpacity,
        paperTheme: this.visibleReadingAppearance().activeTheme, expanded: this.readingLayout().widthClass === 'expanded' })
        .zIndex(1).hitTestBehavior(HitTestMode.None);
    }
  }


  private admitReaderViewportSize(width: number, height: number, lifecycleToken: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    if (this.pageTurnInputPhase() !== 'idle') {
      this.pageTurnPendingViewportWidth = width;
      this.pageTurnPendingViewportHeight = height;
      if (this.pageTurnSettlementActive) this.admitPageTurnPresentationWidth(width);
      this.rollbackPageTurnForDeferredMutation();
      return;
    }
    if (Math.abs(width - this.viewportWidth) < 0.01 &&
      Math.abs(height - this.viewportHeight) < 0.01) {
      return;
    }
    this.invalidatePageTurnRuntime(true);
    const previousLayoutSignature = this.hasMeasuredViewport() ? this.paginationLayoutSignature() : undefined;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.reconcileSessionLaunchLayout();
    if (this.usesBookTurnSimulation()) {
      this.bookTurnSession.configure(width, height);
    }
    this.lastWindowMetricsLayoutKey = this.windowMetricsLayoutKey();
    if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.paginationLayoutSignature()) {
      // A reflow invalidates both the continuous draft and every complete
      // manifest measured under the predecessor geometry. The new signature
      // can never accidentally address those physical page boundaries.
      this.physicalPagination.index.invalidateLayout(
        this.sourceId,
        this.bookId,
        previousLayoutSignature,
      );
      this.resetPaginationDraft();
    }
    if (this.hasCurrentMaterializedChapter() && this.phase !== 'failed') {
      // The hidden Text layout and its initial Core write are one atomic
      // generation. Starting another one here would race two writes against
      // the same Core snapshot revision.
      if (this.measurementCompleting) {
        this.remeasurePending = true;
        return;
      }
      this.beginMeasurement(lifecycleToken);
    }
  }

  private pageTurnStageViewportWidth(): number {
    return this.pageTurnPresentationWidth > 0 ? this.pageTurnPresentationWidth : this.viewportWidth;
  }

  private usesBookTurnSimulation(): boolean {
    return readerBookTurnRuntimeSpec(
      this.readerSettingsSnapshot.navigationMode,
      this.readerSettingsSnapshot.pageTransition,
      this.reduceMotion,
      this.bookTurnRuntimeFailed,
    ).simulationActive;
  }

  /**
   * Keep the native XComponent mounted for the whole selected simulation
   * session, even after a transient capability failure. Removing it from
   * build() in response to a late LOST/FAILURE event makes ArkUI destroy and
   * recreate the surface while an unrelated control-bar transition may be in
   * flight; on physical compositors that detach/attach boundary can present a
   * black buffer. The runtime failure still selects the static page path and
   * the surface is held at opacity 0, so this is a lifecycle-stability guard,
   * not a fallback to a partially working native renderer.
   */
  private shouldMountBookTurnSurface(): boolean {
    return readerBookTurnRuntimeSpec(
      this.readerSettingsSnapshot.navigationMode,
      this.readerSettingsSnapshot.pageTransition,
      this.reduceMotion,
      this.bookTurnRuntimeFailed,
    ).mountSurface;
  }

  /**
   * A persisted selection is not proof that this mounted session can render
   * it. Reduce Motion and a failed Native capability probe are both explicit
   * DOWN-before fallbacks to `none`; they must never select a flat renderer.
   */
  private effectivePageTurnStyle(): ReaderPageTurnStyle {
    const selected = readerPageTurnStyle(this.readerSettingsSnapshot);
    if (this.reduceMotion || (selected === 'simulation' && this.bookTurnRuntimeFailed)) {
      return 'none';
    }
    return selected;
  }

  private usesNoAnimationPageTurnRuntime(): boolean {
    return this.effectivePageTurnStyle() === 'none';
  }

  private bookTurnHighlightIdentity: string = '';
  private bookTurnHighlightValues: number[] = [];

  private onPageDynamicHighlights(identity: string, rects: ReaderDynamicHighlightRect[]): void {
    if (!this.mounted || !this.usesBookTurnSimulation() || identity !== this.currentPageTurnRenderPage().textureIdentity) return;
    try {
      this.bookTurnHighlightIdentity = identity;
      this.bookTurnHighlightValues = readerNativeHighlightValues(rects, this.viewportWidth, this.viewportHeight);
      this.bookTurnSession.setDynamicHighlights(identity, this.bookTurnHighlightValues);
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', this.errorMessage(error as Error));
      this.failBookTurnRuntime();
    }
  }

  private onBookTurnSurfaceLoaded(): void {
    if (!this.mounted || !this.usesBookTurnSimulation()) return;
    this.bookTurnSession.configure(this.viewportWidth, this.viewportHeight);
    this.scheduleBookTurnTextureRefresh();
  }

  private onBookTurnNativeEvent(event: BookTurnNativeEvent): void {
    if (!this.mounted) return;
    if (event.event === BOOK_TURN_EVENT_SURFACE_READY) {
      if (!this.shouldMountBookTurnSurface()) return;
      this.bookTurnTexture.replaceSurface();
      this.bookTurnSurfaceRecoveryPending = true;
      // A replacement EGL surface cannot inherit the previous generation's
      // input owner or retained slots. An old LOST may already be discarded
      // at the JS queue boundary; READY must converge the old transaction too.
      if (this.pageTurnSettlementActive || this.bookTurnMotion !== undefined) this.failBookTurnRuntime(true);
      this.recoverBookTurnSurfaceIfIdle();
      return;
    }
    if (event.event === BOOK_TURN_EVENT_TEXTURE_READY) {
      if (this.bookTurnHighlightIdentity.length > 0) {
        this.bookTurnSession.setDynamicHighlights(this.bookTurnHighlightIdentity, this.bookTurnHighlightValues);
      }
      this.pageTurnReadinessRevision += 1;
      this.drainRapidPageTurn();
      this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
      return;
    }
    if (event.event === BOOK_TURN_EVENT_FRAME_PRESENTED) {
      // Keep the XComponent hidden while a new generation is still drawing.
      // Its EGL buffer can otherwise still contain the previous terminal frame
      // for one compositor interval, which appears as a brief brightness flash
      // at gesture start. Reveal only after native confirms a successful draw.
      if (this.usesBookTurnSimulation() && event.generation === this.bookTurnSurfaceGeneration &&
        (this.pageTurnPresentationPhase === 'tracking' ||
          this.pageTurnPresentationPhase === 'settling' ||
          this.pageTurnPresentationPhase === 'rollback')) {
        this.bookTurnSurfaceOpacity = 1;
        this.admitAutomaticPageStart?.(event);
      }
      return;
    }
    if (event.event === BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT) {
      if (!this.pageTurnSettlementActive || event.generation !== this.pageTurnSettlementGeneration ||
        event.generation !== this.bookTurnSurfaceGeneration) return;
      if (this.pageTurnAutomaticStart !== undefined && !this.pageTurnAutomaticStart.started) return;
      this.pageTurnAnimationFinished = true;
      const prepared = this.preparedSettlement.prepared;
      if (prepared !== undefined && !this.preparedSettlement.commitStarted) {
        this.beginPreparedPageTurnPersistence(prepared, this.lifecycleToken, event.generation);
      }
      this.finishPreparedPageTurnSettlement(event.generation);
      return;
    }
    if (event.event === BOOK_TURN_EVENT_ROLLBACK_COMPLETE) {
      if (!this.pageTurnSettlementActive || event.generation !== this.bookTurnSurfaceGeneration) return;
      this.finishPageTurnRollback(event.generation);
      return;
    }
    if (event.event === BOOK_TURN_EVENT_SLOTS_COMMITTED) {
      if (!this.bookTurnAwaitingSlotCommit || event.generation !== this.pageTurnSettlementGeneration) return;
      this.bookTurnAwaitingSlotCommit = false;
      // Re-announce the committed owner after the Native barrier closes. The
      // logical promotion already bumped this revision, but its first watch
      // callback can arrive while slot commit is still pending; a fresh
      // revision guarantees the ArkUI acknowledgement is observed in the
      // post-SLOTS_COMMITTED phase.
      this.pageTurnRenderRevision += 1;
      // Keep the Native terminal buffer until the promoted ArkUI revision
      // and scheduled frame callbacks agree, then schedule hide and release.
      // These callbacks establish ordering, not an actual display fence.
      this.scheduleBookTurnSurfaceRelease(event.generation);
      // Do not refresh snapshots while the promoted ArkUI tree is still
      // entering composition.  The stable current node can legally return
      // the previous or transparent frame with waitUntilRenderFinished:false;
      // upload only after TERMINAL_RELEASED closes the hide/clear barrier.
      return;
    }
    if (event.event === BOOK_TURN_EVENT_TERMINAL_RELEASED) {
      if (this.pageTurnSettlementActive && event.generation === this.pageTurnSettlementGeneration &&
        event.generation === this.bookTurnSurfaceGeneration) {
        this.pageTurnPresentationPhase = 'released';
        if (this.preparedSettlement.commitSucceeded) this.finishSuccessfulPageTurnPresentation(event.generation);
        else this.finishPageTurnRollback(event.generation);
        this.pageTurnPresentationPhase = 'idle';
        this.scheduleBookTurnTextureRefresh();
      }
      return;
    }
    if (event.event === BOOK_TURN_EVENT_SURFACE_LOST || event.event === BOOK_TURN_EVENT_RENDER_FAILURE) {
      // Leaving simulation (including Reduce Motion) intentionally destroys
      // the XComponent. Its asynchronous teardown is not a capability failure
      // and must not disable simulation in the settings for this session.
      if (!this.shouldMountBookTurnSurface()) return;
      this.failBookTurnRuntime();
    }
  }

  private recoverBookTurnSurfaceIfIdle(): void {
    if (!this.bookTurnSurfaceRecoveryPending || !this.mounted || this.exitRequested ||
      !this.shouldMountBookTurnSurface() || this.pageTurnSettlementActive || this.bookTurnMotion !== undefined) return;
    this.bookTurnSurfaceRecoveryPending = false;
    this.bookTurnRuntimeFailed = false;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookTurnSurfaceOpacity = 0;
    this.pageTurnPresentationPhase = 'idle';
    this.bookTurnSession.configure(this.viewportWidth, this.viewportHeight);
    this.scheduleBookTurnTextureRefresh();
  }

  private failBookTurnRuntime(recoverWhenIdle: boolean = false): void {
    this.pageTurnAutomaticStart = undefined;
    this.bookTurnSurfaceRecoveryPending = recoverWhenIdle;
    this.bookTurnRuntimeFailed = true;
    this.bookTurnSurfaceOpacity = 0;
    this.bookTurnSession.clearCapturedTextures();
    // Once the visual endpoint has been reported, the Core transaction owns
    // the result. Keep that atomic decision and reveal the static admitted
    // page when it finishes; before the endpoint no progress write has begun.
    if (this.pageTurnAnimationFinished && this.preparedSettlement.commitStarted) {
      // Once the authoritative page is promoted, lost Native slots have no
      // remaining decision to make. Do not retry their old generation forever.
      if (this.preparedSettlement.commitFinished && this.preparedSettlement.commitSucceeded && this.preparedSettlement.prepared === undefined) {
        this.requestBookTurn2DFallback(this.pageTurnSettlementGeneration);
      }
      return;
    }
    this.preparedSettlement.discardDestination();
    this.preparedSettlement.releaseCommit();
    this.preparedSettlement.clearResult();
    if (!this.pageTurnSettlementActive && this.bookTurnMotion === undefined &&
      this.pageTurnGestureState.phase !== 'dragging' && this.pageTurnGestureState.phase !== 'settling') return;
    const generation = this.bookTurnMotion?.generation ?? this.pageTurnSettlementGeneration;
    this.pageTurnSettlementGeneration = generation;
    if (this.pageTurnGestureState.phase === 'tracking' || this.pageTurnGestureState.phase === 'dragging') {
      this.pageTurnGestureState = cancelReaderPagePan(this.pageTurnGestureState);
    }
    this.finishPageTurnRollback(generation);
  }

  private scheduleBookTurnTextureRefresh(): void {
    if (!this.mounted || !this.usesBookTurnSimulation() || this.sessionLaunchRenderWorkBlocked()) return;
    this.bookTurnTexture.schedule();
  }

  private bookTurnTexturePlan(): BookTurnTexturePlan<ReaderPageTurnRenderPage> | undefined {
    if (!this.mounted || this.sessionLaunchRenderWorkBlocked() || !this.usesBookTurnSimulation() ||
      this.controlVisible() || this.bookTurnRuntimeFailed || !this.bookTurnSession.isReady() || this.phase !== 'ready' ||
      this.pageTurnPreparation !== undefined || this.pageTurnInputPhase() !== 'idle') return undefined;
    const current = this.currentPageTurnRenderPage();
    // Snapshot paint readiness cannot acknowledge a pending parent revision.
    if (this.bookTurnArkUIContentRevision !== current.renderRevision) return undefined;
    return { current, previous: this.preparedPageTurnRenderPage('previous'), next: this.preparedPageTurnRenderPage('next') };
  }

  private allowsBookTurnTextureStep(step: BookTurnTextureStep): boolean {
    if (!this.mounted) return false;
    switch (step) {
      case 'snapshot':
        return !this.sessionLaunchRenderWorkBlocked() && this.usesBookTurnSimulation() && !this.controlVisible() &&
          !this.bookTurnRuntimeFailed && this.phase === 'ready' && this.pageTurnInputPhase() === 'idle';
      case 'decode':
        return this.usesBookTurnSimulation() && !this.controlVisible() && this.phase === 'ready' &&
          this.pageTurnInputPhase() === 'idle' && !this.bookTurnRuntimeFailed;
      case 'before-upload':
        return this.usesBookTurnSimulation() && !this.controlVisible() && this.pageTurnInputPhase() === 'idle';
      case 'upload':
        return this.usesBookTurnSimulation() && !this.controlVisible() && this.phase === 'ready' &&
          this.pageTurnInputPhase() === 'idle' && !this.bookTurnRuntimeFailed && !this.sessionLaunchRenderWorkBlocked();
      case 'retain':
        return !this.exitRequested && this.usesBookTurnSimulation() && !this.bookTurnRuntimeFailed;
    }
  }

  private bookTurnTextureSnapshot(slot: BookTurnTextureSlot, page: ReaderPageTurnRenderPage,
    retained: boolean, mayDecode: () => boolean): Promise<image.PixelMap | undefined> | undefined {
    const uiContext = this.getUIContext();
    const snapshot = uiContext.getComponentSnapshot();
    const hasBodyImages = page.fragments.some((fragment: ReadingSurfacePageFragment): boolean =>
      (fragment.fileUri?.length ?? 0) > 0 || fragment.imageSource !== undefined);
    if (retained) return undefined;
    if (slot === BOOK_TURN_TEXTURE_CURRENT && !hasBodyImages) {
      // The mounted physical slot may supply only the current text-only page.
      return snapshot.get(`${READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID}-${this.pageTurnCurrentSlot}`, {
        scale: this.bookTurnTextureScale(), waitUntilRenderFinished: true,
      });
    }
    // Keep one offscreen tree. Checked capture verifies its decoded images.
    const input = new BookTurnTextureBuildInput(page, this.viewportWidth, this.viewportHeight, this.readingLayout(),
      page.appearance ?? this.appearanceSnapshot, (): ReadingSurfacePageFragment[] => this.bookTurnTextureBuildPage?.fragments ?? []);
    this.bookTurnTextureBuildPage = page;
    let content = this.bookTurnTextureContent;
    if (content === undefined) {
      content = new ComponentContent<BookTurnTextureBuildInput>(uiContext, wrapBuilder(BookTurnTextureBuilder), input);
      this.bookTurnTextureContent = content;
    } else content.update(input);
    const captureContent = content;
    return captureDecodedBookTurnBitmap<image.PixelMap>(
      (delay: number): Promise<image.PixelMap> => this.getUIContext().getComponentSnapshot().createFromComponent(
        captureContent, delay, true, { scale: this.bookTurnTextureScale(), waitUntilRenderFinished: true }),
      mayDecode, (error: Error): boolean => (error as BusinessError).code === 160001);
  }

  private releaseBookTurnTextureContent(): void {
    const content = this.bookTurnTextureContent;
    this.bookTurnTextureContent = undefined;
    this.bookTurnTextureBuildPage = undefined;
    if (content !== undefined) this.bookTurnTexture.disposeAfterRefresh((): void => content.dispose());
  }

  private failBookTurnTextureCapture(slot: BookTurnTextureSlot, generation: number, message: string): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience book-turn texture failed slot=${slot}: ${message}`);
    if (!this.bookTurnTexture.isCurrent(generation) || !this.mounted || !this.usesBookTurnSimulation()) return;
    // Drain any complete user intent through the admitted no-animation path.
    this.failBookTurnRuntime();
    this.drainRapidPageTurn();
  }

  private bookTurnTextureScale(): number {
    const context = this.getUIContext();
    return bookTurnTextureSnapshotScale(context.vp2px(this.viewportWidth), context.vp2px(this.viewportHeight));
  }

  private pageTtsHighlightCurrent(): boolean {
    const page = this.visiblePage;
    if (!this.ttsFollowHighlight || page === undefined) return false;
    const key = page.paginationKey;
    if (key !== undefined) {
      return key.sourceId === this.sourceId && key.bookId === this.bookId &&
        this.ttsState.chapterIndex === key.chapterIndex && this.ttsState.contentVersion === key.contentVersion;
    }
    // An unindexed page can use the materialized chapter only while both
    // still belong to the same selection.
    return this.visiblePageSelectionToken === this.materializedChapterSelectionToken &&
      this.chapter !== undefined && this.ttsState.chapterIndex === this.chapter.chapterIndex &&
      this.ttsState.contentVersion === this.materializedContentVersion;
  }

  private autoPageHighlightStart(): number | undefined {
    return this.autoPageHighlightFragment()?.startScalar;
  }

  private autoPageHighlightEnd(): number | undefined {
    return this.autoPageHighlightFragment()?.endScalar;
  }

  private autoPageHighlightFragment(): ReadingSurfacePageFragment | undefined {
    if (!this.automaticReadingConfiguration().followHighlight || this.automaticReadingState().status !== 'running') {
      return undefined;
    }
    const visible = this.readerSettingsSnapshot.navigationMode === 'continuous' ?
      this.continuousProjection.fragments.slice(
        this.continuousProjection.visibleStart,
        this.continuousProjection.visibleEnd + 1,
      ) : this.visibleFragments;
    return this.autoPageCoordinator.highlightVisibleFragment(visible,
      (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length > 0);
  }

  private ttsFollowScope(): ReaderTtsFollowScope {
    return { sourceId: this.sourceId, bookId: this.bookId, lifecycleToken: this.lifecycleToken };
  }

  private scheduleTtsPageFollowResume(): void {
    this.ttsPageFollow.scheduleResume((callback: () => void): void => { setTimeout(callback, 0); }, (): (() => void) => {
      const lifecycle = this.lifecycleToken;
      return (): void => { if (this.mounted && lifecycle === this.lifecycleToken) this.resumeTtsPageFollow(); };
    });
  }

  private isAutomaticPageStartCurrent(start: ReaderAutomaticPageStart): boolean {
    if (this.pageTurnAutomaticStart !== start || !this.mounted || !this.appForeground || this.exitRequested ||
      start.lifecycleToken !== this.lifecycleToken || start.generation !== this.pageTurnSettlementGeneration ||
      start.generation !== this.bookTurnSurfaceGeneration || !this.pageTurnSettlementActive ||
      this.pageTurnPresentationPhase !== 'settling' || this.preparedSettlement.prepared === undefined ||
      this.controlVisible() || this.controlObscured || this.interactionBlocked || this.activePagePointerId >= 0) return false;
    if (start.origin === 'ttsFollow') return start.ttsOwner !== undefined && this.isTtsFollowLeaseCurrent(start.ttsOwner);
    const automatic = this.automaticReadingState();
    return automatic.status === 'running' && automatic.generation === start.autoGeneration;
  }

  private admitAutomaticPageStart(event: BookTurnNativeEvent): void {
    const start = this.pageTurnAutomaticStart;
    if (start === undefined || start.started || start.scheduled || event.generation !== start.generation) return;
    if (!this.isAutomaticPageStartCurrent(start) || !Number.isSafeInteger(event.detail) || event.detail <= 0) {
      this.cancelAutomaticPageStart();
      return;
    }
    start.surfaceToken = event.detail;
    start.bufferEventReceivedAtMs = readerMotionNowMs();
    // FRAME_PRESENTED means an EGL buffer was submitted, not a display fence.
    // opacity was requested by the caller; one ArkUI frame orders the ACK.
    start.showRequestedAtMs = readerMotionNowMs();
    start.scheduled = true;
    try {
      this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
        if (this.pageTurnAutomaticStart !== start || start.started) return;
        if (!this.isAutomaticPageStartCurrent(start)) { this.cancelAutomaticPageStart(); return; }
        if (!this.bookTurnSession.startAutomaticTimeline(start.generation, start.surfaceToken)) {
          this.cancelAutomaticPageStart();
          return;
        }
        start.started = true;
        start.startedAtMs = readerMotionNowMs();
      }));
    } catch (_) { this.cancelAutomaticPageStart(); }
  }

  /** An undisplayed automatic turn has not written progress and can safely cancel now. */
  private cancelAutomaticPageStart(origin?: ReaderPageTurnOrigin): void {
    const start = this.pageTurnAutomaticStart;
    if (start === undefined || start.started || (origin !== undefined && start.origin !== origin)) return;
    this.pageTurnAutomaticStart = undefined;
    if (!this.pageTurnSettlementActive || start.generation !== this.pageTurnSettlementGeneration ||
      this.preparedSettlement.commitStarted) return;
    this.preparedSettlement.discardDestination();
    if (start.origin === 'autoTimer') this.autoPageCoordinator.retryTurn(start.autoGeneration);
    // Native still owns this generation while it waits for the first-frame ACK.
    this.animatePageTurnRollback(true);
  }

  private isTtsFollowLeaseCurrent(owner: ReaderTtsFollowLease): boolean {
    return this.mounted && !this.exitRequested && readerTtsFollowActive(this.ttsState) &&
      this.ttsPageFollow.owns(owner, this.ttsFollowScope(), this.ttsState);
  }

  private invalidateTtsPageFollow(): void {
    this.ttsPageFollow.invalidate(this.ttsFollowScope(), this.ttsState);
    this.ttsPageFollow.positioning = undefined;
    this.cancelUncommittedTtsChapter();
    // A user directory/bookmark selection has no TTS lease and keeps its owner.
    if (this.pageTurnPendingChapterSelection?.ttsOwner !== undefined) this.pageTurnPendingChapterSelection = undefined;
    this.cancelAutomaticPageStart('ttsFollow');
  }

  /** Audio publishes semantic positions; it never contributes manual rapid steps. */
  private followTtsPage(state: ReaderTtsState): void {
    this.ttsPageFollow.offer(this.ttsFollowScope(), state);
    this.cancelUncommittedTtsChapter();
    const start = this.pageTurnAutomaticStart;
    if (start?.origin === 'ttsFollow' && start.ttsOwner !== undefined &&
      !this.isTtsFollowLeaseCurrent(start.ttsOwner)) this.cancelAutomaticPageStart('ttsFollow');
    if (!readerTtsFollowActive(state)) {
      if (this.pageTurnPendingChapterSelection?.ttsOwner !== undefined) this.pageTurnPendingChapterSelection = undefined;
      this.cancelAutomaticPageStart('ttsFollow');
      return;
    }
    this.resumeTtsPageFollow();
  }

  private resumeTtsPageFollow(): void {
    const target = this.ttsPageFollow.pending();
    if (target === undefined || !this.isTtsFollowLeaseCurrent(target) || !this.ttsPageFollow.canAttempt() || !this.ttsFollowHighlight ||
      !this.appForeground || this.readerSettingsSnapshot.navigationMode === 'continuous' ||
      this.phase !== 'ready' || this.visiblePage === undefined || this.chapter === undefined ||
      this.controlVisible() || this.controlObscured || this.interactionBlocked ||
      this.activePagePointerId >= 0 || this.pendingPointerSegmentReserved ||
      this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined ||
      this.pageTurnPreparation !== undefined || this.commitInFlight || this.progressProducers.continuousInFlight ||
      readerRapidPageTurnHasWork(this.rapidPageTurnState)) return;
    if (this.ttsPageFollow.positioning !== undefined) return;
    if (target.chapterIndex !== this.currentChapterIndex()) {
      if (this.isKnownControlChapter(target.chapterIndex)) this.positionTtsFollowTarget(target);
      return;
    }
    if (target.contentVersion !== this.materializedContentVersion) return;
    const key = this.currentPaginationKey();
    const current = this.physicalPagination.index.findContainingPage(key, this.visiblePage.startScalar);
    const destination = this.physicalPagination.index.findContainingPage(key, target.scalar);
    const plan = planReaderTtsFollowPage(target, this.visiblePage.startScalar, current, destination,
      (direction: ReaderPageTurnDirection): ReaderTtsPreparedPage | undefined => {
        const page = this.preparedPageTurn(direction);
        return page === undefined ? undefined : { chapterIndex: page.context.chapter.chapterIndex,
          startScalar: page.page.startScalar, endScalar: page.page.endScalar };
      });
    switch (plan.action) {
      case 'aligned': this.ttsPageFollow.aligned(target); break;
      case 'position': this.positionTtsFollowTarget(target); break;
      case 'prepare': this.queuePageTurnPreparation(plan.direction); break;
      case 'turn': this.performPageTurn(plan.direction, 'ttsFollow', target); break;
      case 'wait': break;
    }
  }

  private positionTtsFollowTarget(target: ReaderTtsFollowTarget): void {
    if (!this.isTtsFollowLeaseCurrent(target)) return;
    this.ttsPageFollow.positioning = target;
    this.selectChapterAnchor(target.chapterIndex, target.scalar, false, false, undefined, -1,
      false, false, undefined, target);
  }

  private onContinuousManualInteraction(): void {
    this.retireReaderRecovery();
    this.continuousUserInteractionActive = true;
    this.onReaderManualInteraction();
  }

  private onContinuousVisibleRangeChanged(start: number, end: number, startProgress: number): void {
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous') return;
    const visible = this.continuousProjection.admitVisibleRange(start, end, startProgress);
    if (visible === undefined) return;
    this.continuousVisibleScalar = visible.scalar;
    this.desiredChapterOffset = this.continuousVisibleScalar;
    const scalarCount = this.chapterLayoutMap?.scalarCount() ?? 0;
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.continuousVisibleScalar / scalarCount;
    this.continuousProgressRevision += 1;
    const chromeProgress = this.continuousPageChromeSnapshot(this.continuousRenderRevision, '').bottomEndText;
    if (chromeProgress !== this.continuousChromeProgressText) this.continuousChromeProgressText = chromeProgress;
    this.continuousProjection.resolveVisibleImages(visible.startIndex, visible.endIndex,
      (startScalar: number): void => this.resolveContinuousImage(startScalar));
    this.continuousEntryPositionReady = true;
    if (this.hasPartialEntryWindow()) this.scheduleEntryWindowHydration();
  }

  private onContinuousScrollStopped(): void {
    this.continuousUserInteractionActive = false;
    const direction = this.rapidPageTurnState.inFlightDirection;
    const lifecycle = this.lifecycleToken;
    const selection = this.chapterSelectionToken;
    const serial = this.pageTurnTransactionSerial;
    void this.commitContinuousProgress(lifecycle)
      .then((): void => {
        if (!this.isMountedToken(lifecycle) || selection !== this.chapterSelectionToken ||
          serial !== this.pageTurnTransactionSerial || this.exitRequested) return;
        if (direction !== undefined) {
          this.completeRapidPageTurnTransaction(direction);
          this.drainRapidPageTurn();
        }
      }).catch((): void => {
        // The progress owner retains the failure and logs it through
        // continuousProgressDependencies.failed. Automatic retries stay silent.
      });
  }

  private onContinuousReachStart(): void {
    if (this.hasPartialEntryWindow()) { this.scheduleEntryWindowHydration(); return; }
    if (!this.continuousUserInteractionActive || this.continuousProjection.visibleStart > 0 ||
      !this.isContinuousScrollerAtStart()) {
      return;
    }
    const chapter = this.chapter;
    if (chapter === undefined) {
      return;
    }
    const previousChapter = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    if (previousChapter !== undefined) {
      this.continuousUserInteractionActive = false;
      this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, this.continuousVisibleScalar);
    }
  }

  private onContinuousReachEnd(): void {
    if (this.hasPartialEntryWindow()) { this.scheduleEntryWindowHydration(); return; }
    if (!this.continuousUserInteractionActive || !this.isContinuousScrollerAtEnd()) {
      return;
    }
    const chapter = this.chapter;
    if (chapter === undefined) {
      return;
    }
    const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
    if (nextChapter !== undefined) {
      this.continuousUserInteractionActive = false;
      this.openPageTurnChapter(nextChapter, 0);
    }
  }

  private onContinuousBoundaryDrag(direction: 'previous' | 'next'): void {
    if (this.hasPartialEntryWindow()) { this.scheduleEntryWindowHydration(); return; }
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous' ||
      !this.continuousUserInteractionActive) {
      return;
    }
    if ((direction === 'next' && !this.isContinuousScrollerAtEnd()) ||
      (direction === 'previous' && !this.isContinuousScrollerAtStart())) {
      return;
    }
    const chapter = this.chapter;
    if (chapter === undefined) {
      return;
    }
    const adjacent = this.adjacentChapterIndex(chapter.chapterIndex, direction === 'next' ? 1 : -1);
    if (adjacent === undefined) {
      return;
    }
    this.continuousUserInteractionActive = false;
    if (direction === 'next') {
      this.openPageTurnChapter(adjacent, 0);
    } else {
      this.turnToPreviousChapter(adjacent, chapter.chapterIndex, this.continuousVisibleScalar);
    }
  }

  private isContinuousScrollerAtStart(): boolean {
    const offset = this.continuousScroller?.currentOffset();
    return offset === undefined || offset.yOffset <= 0.5;
  }

  private isContinuousScrollerAtEnd(): boolean {
    try {
      return this.continuousScroller?.isAtEnd() ?? false;
    } catch (_) {
      return false;
    }
  }

  private resolveContinuousImage(startScalar: number): void {
    this.readingImageResources.resolveContinuous(this.chapter, startScalar, {
      captureCurrent: (chapter: ReadingSessionChapter): (() => boolean) => {
        const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
        return (): boolean => this.isSelectionActive(lifecycle, selection) && this.chapter === chapter &&
          this.readerSettingsSnapshot.navigationMode === 'continuous';
      },
      resolveGeometry: (chapter: ReadingSessionChapter, image: ReadingSessionImage): void =>
        this.resolveGeometryImagePixels(chapter, image),
      load: (chapter: ReadingSessionChapter, image: ReadingSessionImage, current: () => boolean): Promise<ReadingSessionImage> =>
        this.activeGateway().resolveReadingImage(chapter, image, current),
      admit: (requested: ReadingSessionImage, resolved: ReadingSessionImage): void => {
        this.replaceResolvedReadingImage(requested, resolved);
        if (!this.refreshContinuousImageFragment(resolved)) this.rebuildContinuousFragments();
      },
      fail: (error: Error): void =>
        hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience continuous image failed: ${this.errorMessage(error)}`),
    });
  }

  private admitPageTurnPresentationWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    this.pageTurnPresentationWidth = width;
    if (this.preparedSettlement.prepared !== undefined && this.pageTurnDirection !== undefined) {
      // The durable anchor is still measured under the frozen logical width,
      // but the actual ArkUI parent has already resized. Snap the presentation
      // endpoint to the new live width so the moving old page cannot cover a
      // strip of the destination while the Core commit is still in flight.
      this.pageTurnOffsetX = this.pageTurnDirection === 'next' ? -width : width;
    } else if (this.pageTurnSettlementActive) {
      // A rollback after a resize may safely finish visually at the admitted
      // page while its existing completion callback closes the state machine.
      this.pageTurnOffsetX = 0;
    }
  }

  private currentPageTurnRenderPage(): ReaderPageTurnRenderPage {
    const retained = this.retainedChapterFrame();
    if (retained !== undefined) return retained.renderPage;
    if (this.pageTurnFrozenRevision === this.pageTurnRenderRevision && this.pageTurnFrozenCurrent !== undefined) {
      return this.pageTurnFrozenCurrent;
    }
    const revision = this.pageTurnRenderRevision;
    const origin = this.pageTurnPreparation?.origin;
    const chapterIndex = origin?.chapter.chapterIndex ?? this.chapter?.chapterIndex ?? -1;
    const pageStart = this.visiblePage?.startScalar ?? -1;
    const contentVersion = origin?.contentVersion ?? this.materializedContentVersion;
    const paginationDraft = origin?.paginationDraft ?? this.physicalPagination.draft;
    const scalarCount = origin?.layoutMap.scalarCount() ?? this.chapterLayoutMap?.scalarCount() ?? 0;
    const key = this.pageChromePaginationKey(chapterIndex, contentVersion);
    const chrome = this.pageChromeSnapshot(chapterIndex, pageStart, scalarCount, key, paginationDraft);
    const bottomJustifyGap = this.visiblePage === undefined ? 0 : this.pageBottomJustifyGap(this.visiblePage);
    const bookmark = this.bookmarkSnapshotForCurrentPage();
    const facingChapter = this.facingChapter(chapterIndex);
    const textureIdentity = readerPageTextureIdentity(
        this.sourceId, this.bookId, this.appearanceSnapshot.activeTheme,
        this.readerSettingsSnapshot.hideStatusBar === true, this.sessionLaunch !== undefined,
        chapterIndex,
        pageStart,
        contentVersion,
        key?.layoutSignature ?? '',
        bottomJustifyGap,
        chrome,
        bookmark.mode,
        facingChapter?.identity,
      );
    return new ReaderPageTurnRenderPage(
      readerPageSurfaceIdentity(this.sourceId, this.bookId, this.appearanceSnapshot.activeTheme,
        'current', chapterIndex, pageStart, contentVersion,
        key?.layoutSignature ?? ''),
      textureIdentity,
      revision,
      origin?.chapter.chapterTitle ?? this.chapter?.chapterTitle ?? this.chapterTitle,
      this.showChapterTitle,
      this.visibleFragments,
      bottomJustifyGap,
      chrome,
      this.visibleReadingAppearance(),
      bookmark,
      facingChapter,
      chapterIndex,
    );
  }

  private preparedPageTurnRenderPage(
    direction: ReaderPageTurnDirection,
  ): ReaderPageTurnRenderPage | undefined {
    if (this.pageTurnFrozenRevision === this.pageTurnRenderRevision && this.pageTurnFrozenCurrent !== undefined) {
      return direction === 'previous' ? this.pageTurnFrozenPrevious : this.pageTurnFrozenNext;
    }
    const revision = this.pageTurnRenderRevision;
    const prepared = direction === 'previous' ? this.preparedPreviousPage : this.preparedNextPage;
    if (prepared === undefined || !this.isPreparedPageTurnFresh(prepared)) {
      return undefined;
    }
    const ranges = prepared.context.paragraphRanges;
    const showTitle = (prepared.context.chapter.documentRange?.startScalar ?? 0) === 0 &&
      ranges.length > 0 && prepared.page.startScalar === ranges[0].startScalar;
    const bottomJustifyGap = this.pageBottomJustifyGap(prepared.page);
    const chrome = this.pageChromeSnapshot(
      prepared.key.chapterIndex,
      prepared.page.startScalar,
      prepared.context.layoutMap.scalarCount(),
      prepared.key,
      prepared.context.paginationDraft,
    );
    const bookmark = this.bookmarkSnapshotForPreparedPage(prepared.key.chapterIndex, prepared.context.chapter.sourceId,
      prepared.context.chapter.bookId, prepared.context.chapter.bodyVersion, prepared.context.chapter.processingVersion,
      prepared.page.startScalar, prepared.page.endScalar);
    const facingChapter = this.facingChapter(prepared.key.chapterIndex);
    const textureIdentity = readerPageTextureIdentity(
        this.sourceId, this.bookId, this.appearanceSnapshot.activeTheme,
        this.readerSettingsSnapshot.hideStatusBar === true, this.sessionLaunch !== undefined,
        prepared.key.chapterIndex,
        prepared.page.startScalar,
        prepared.key.contentVersion,
        prepared.key.layoutSignature,
        bottomJustifyGap,
        chrome,
        bookmark.mode,
        facingChapter?.identity,
      );
    return new ReaderPageTurnRenderPage(
      readerPageSurfaceIdentity(this.sourceId, this.bookId, this.appearanceSnapshot.activeTheme,
        direction, prepared.key.chapterIndex, prepared.page.startScalar,
        prepared.key.contentVersion, prepared.key.layoutSignature),
      textureIdentity,
      revision,
      prepared.context.chapter.chapterTitle,
      showTitle,
      prepared.page.fragments,
      bottomJustifyGap,
      chrome,
      this.pageReadingAppearance(prepared.page),
      bookmark,
      facingChapter,
      prepared.key.chapterIndex,
    );
  }

  private readonly facingChapterPreview: ReaderFacingChapterPreview = new ReaderFacingChapterPreview();

  private currentFacingChapter(_renderRevision: number): ReaderFacingChapter | undefined {
    const retained = this.retainedChapterFrame();
    if (retained !== undefined) return retained.renderPage.facingChapter;
    return this.facingChapter(this.chapter?.chapterIndex ?? -1);
  }

  private facingChapter(chapterIndex: number): ReaderFacingChapter | undefined {
    if (this.readingLayout().facingChapterWidth <= 0 || chapterIndex < 0) return undefined;
    const nextIndex = this.adjacentChapterIndex(chapterIndex, 1);
    if (nextIndex === undefined) return undefined;
    return this.facingChapterPreview.current(this.sourceId, this.bookId, nextIndex,
      this.chapterWindow.get(nextIndex), (): LocalReadingTocEntry | undefined =>
        this.readingTocEntries()[this.readingTocRanks.get(nextIndex) ?? -1]);
  }

  private pageBottomJustifyGap(page: PhysicalReadingPage): number {
    const last = page.fragments[page.fragments.length - 1];
    return readerPageBottomJustifyGap(
      this.readerSettingsSnapshot.alignPageBottom,
      page.fragments.length,
      page.contentHeight,
      page.bodyCapacity,
      last?.layoutHeight ?? 0,
      (last?.imageHeight ?? 0) > 0,
    );
  }

  /** Synchronous native layout removes the hidden-tree frame/readback gate.
   * Font readiness is established by the application/appearance owner. */
  private measureNativeTextBatch(): void {
    this.nativeTextMeasurement.clear();
    const style = this.bodyMeasurementStyle();
    if (this.measurementRun.requiresUnicodeProbe()) {
      this.nativeTextMeasurement.measure(this.getUIContext(), READER_MEASUREMENT_UNICODE_PROBE, this.unicodeProbeController, style);
    }
    this.measureNativeChapterTitle();
    // A batch bounds allocation, not first-page work. Shape a paragraph only
    // when page admission reaches it; an unneeded suffix must not gate paint.
    for (const paragraph of this.paragraphLayout.batch) paragraph.nativeMeasured = false;
  }

  private resolveNativeBodyPunctuationOverflow(): boolean {
    if (!readerHarmonyCapabilities().api26) return false;
    try {
      const preferred = i18n.System.getAppPreferredLanguage();
      const language = preferred.length === 0 || preferred === 'default' ? i18n.System.getSystemLanguage() : preferred;
      const locale = new Intl.Locale(language).maximize();
      return locale.language === 'zh' && locale.script === 'Hans';
    } catch (_) {
      return false;
    }
  }

  /** Title capacity can be queried after a body paragraph is already shaped.
   * Add only the title node; clearing the batch here would dispose the body
   * before its ownership can transfer to the visible native window. */
  private measureNativeChapterTitle(): void {
    if (!this.measurementIncludesChapterTitle() || this.measuredNativeTitle !== undefined) return;
    this.nativeTextMeasurement.measure(this.getUIContext(), this.requireMeasurementChapter().chapterTitle,
      this.chapterTitleMeasurementController, this.titleMeasurementStyle());
  }

  private titleMeasurementStyle(): ReaderNativeTextStyle {
    return {
      widthVp: this.measurementTextWidth(),
      color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
      fontFamily: readerRegisteredFontFamily(this.getUIContext().getFont(),
        readerAppearanceSnapshotFontFamily(this.appearanceSnapshot)), fontWeight: FontWeight.Bold,
      fontSize: READER_CHAPTER_TITLE_FONT_SIZE_FP, lineHeight: this.readingLayout().titleLineHeightFp,
      letterSpacing: 0, alignment: TextAlign.Center, breakAll: true,
    };
  }

  private bodyMeasurementStyle(paragraphStart?: boolean): ReaderNativeTextStyle {
    const style: ReaderNativeTextStyle = {
      widthVp: this.measurementTextWidth(), fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
      fontSize: this.appearanceSnapshot.fontSize, fontWeight: FontWeight.Regular,
      lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot), letterSpacing: this.appearanceSnapshot.letterSpacing,
      color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
      alignment: readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
      breakAll: false, bookBody: true, punctuationOverflow: this.nativeBodyPunctuationOverflow,
    };
    if (paragraphStart !== undefined) {
      style.indentVp = paragraphStart ? this.getUIContext().px2vp(this.getUIContext().fp2px(
        readerAppearanceParagraphIndent(this.appearanceSnapshot.fontSize, this.appearanceSnapshot.indent))) : 0;
    }
    return style;
  }

  private measureNativeParagraph(paragraph: MeasurementParagraph): void {
    if (paragraph.nativeMeasured) return;
    this.nativeTextMeasurement.measure(this.getUIContext(),
      this.measurementNodeText(paragraph), paragraph.controller, this.bodyMeasurementStyle(paragraph.isParagraphStart));
    // Ownership may subsequently leave the measurement adapter for display.
    // Adapter membership therefore cannot be used as the measured-state flag.
    paragraph.nativeMeasured = true;
  }

  private loadInitialReading(lifecycleToken: number): Promise<void> {
    return runInitialReadingEntry(lifecycleToken, this.initialChapterHost());
  }

  private initialChapterHost(): ReadingInitialChapterHost {
    return {
      selectionToken: (): number => this.chapterSelectionToken,
      isSelectionActive: (lifecycle: number, selection: number): boolean => this.isSelectionActive(lifecycle, selection),
      hasFailed: (): boolean => this.phase === 'failed',
      ensureSession: (lifecycle: number, selection: number, discard?: boolean): Promise<void> =>
        this.ensureReadingSession(lifecycle, selection, discard),
      startTrace: (lifecycle: number): void => {
        this.initialReadingTraceStartedAt = Date.now();
        this.initialReadingTraceLifecycle = lifecycle;
        this.initialReadingTraceDelivered = false;
        this.traceInitialReadingPhase?.('start', lifecycle);
      },
      trace: (phase: string, lifecycle: number): void => this.traceInitialReadingPhase?.(phase, lifecycle),
      loadAppearance: (lifecycle: number): Promise<void> => this.loadAppearanceSnapshot(lifecycle),
      loadSettings: (lifecycle: number): Promise<void> => this.loadReaderSettingsSnapshot(lifecycle),
      activeGateway: (): ReadingSessionFlowGateway => this.activeGateway(),
      bookId: (): string => this.bookId,
      isLocal: (): boolean => this.sourceId === LOCAL_READING_SOURCE_ID,
      sourceSwitchRequested: (): boolean => this.sourceSwitchTransactionId !== undefined,
      hasPendingSourceSwitch: (): boolean => this.sessionGateway?.hasPendingSourceSwitch?.() === true,
      remoteSession: (): RemoteReadingSession | undefined => this.sessionGateway?.remoteSession() ?? this.remoteSession,
      paragraphBoundaryMode: (): ReadingParagraphBoundaryMode => readingParagraphBoundaryMode(this.sourceId, this.bookKind),
      preparedEntry: (): ReadingEntrySnapshot | undefined => this.preparedReadingEntry,
      discardPreparedEntry: (): void => { this.preparedReadingEntry = undefined; },
      retirePreparedSession: (): void => {
        this.preparedReadingEntry = undefined;
        this.sessionGateway = undefined;
      },
      waitForContentIdle: (): Promise<void> => ReaderRuntimeOwner.current().waitForReadingContentIdle(this.sourceId, this.bookId),
      clearChapterWindow: (): void => this.chapterWindow.clear(),
      loadToc: (current: () => boolean): Promise<LocalReadingToc> => this.loadInitialToc(current),
      admitFullToc: (entries: LocalReadingTocEntry[]): void => {
        this.admitTocEntries(entries);
        this.onDirectoryProjectionChanged(entries);
      },
      admitSnapshotToc: (snapshot: InitialReadingSnapshot): boolean => this.admitInitialSnapshotToc(snapshot),
      configureChapterWindow: (): void => this.configureReadingChapterWindow(),
      readableToc: (): LocalReadingTocEntry[] => this.readingTocEntries(),
      selection: (): InitialReadingSelection =>
        ({ chapterIndex: this.normalizedRequestedChapter(), bookmark: this.requestedBookmarkAnchor }),
      positionContext: (bookmark: ReaderBookmarkAnchorRequest): RemoteReadingPositionContext | undefined =>
        this.positionContextForScope(bookmark.positionScope, bookmark.chapterIndex, bookmark.chapterOffset, bookmark.directoryTargetProof),
      requireKnownChapter: (index: number | undefined): number => this.requireKnownChapter(index),
      restoreProgress: (progress: LocalReadingProgressState | undefined, bookmark: ReaderBookmarkAnchorRequest | undefined): void => {
        this.restoredProgress = progress;
        if (bookmark !== undefined) this.consumedBookmarkAnchorRequestId = bookmark.requestId;
      },
      openInitialChapter: (request: InitialReadingOpenRequest): Promise<void> =>
        this.openChapter(request.chapterIndex, true, request.lifecycleToken, request.selectionToken, request.offset,
          undefined, false, request.positionContext, request.layoutReady, request.unreadCandidates),
      fail: (error: Error, lifecycle: number): void => this.fail(error, lifecycle),
    };
  }

  private admitInitialSnapshotToc(snapshot: InitialReadingSnapshot): boolean {
    if (!this.admitEntryResume(snapshot)) return false;
    this.entryCatalogNavigation = snapshot.navigation;
    this.entryCatalogPending = true;
    const navigation = snapshot.navigation;
    // A validated window is readable without a complete catalog. Never publish it as the parent's full TOC.
    const entries: LocalReadingTocEntry[] = navigation === undefined ?
      [{ index: snapshot.chapter.chapterIndex, title: snapshot.chapter.chapterTitle, downloadState: 'unknown', navigable: snapshot.resumeOnly !== true }] :
      [...navigation.before, navigation.current, ...navigation.after];
    this.admitTocEntries(entries);
    return true;
  }

  /** First-page milestones only, relative to this mount; branches overlap. */
  private captureStartupEntryTrace(): void {
    this.startupTraceEntryId = ReaderStartupTrace.current()?.currentEntryId() ?? 0;
  }

  private traceStartupReadingPhase(phase: string, status: string = 'event'): void {
    if (this.startupTraceEntryId > 0)
      ReaderStartupTrace.current()?.mark(`reader.${phase}`, status, this.startupTraceEntryId);
  }

  private traceInitialReadingPhase(phase: string, lifecycleToken: number): void {
    try {
      if (this.initialReadingTraceStartedAt < 0 || this.initialReadingTraceDelivered ||
          lifecycleToken !== this.initialReadingTraceLifecycle || lifecycleToken !== this.lifecycleToken) return;
      this.traceStartupReadingPhase?.(phase);
      hilog.info(0x5244, 'Reader',
        'PERF reader-entry phase=%{public}s lifecycle=%{public}d elapsedMs=%{public}d',
        phase, lifecycleToken, Math.max(0, Date.now() - this.initialReadingTraceStartedAt));
    } catch (_) { /* Diagnostics never release a first-page admission barrier. */ }
  }

  private hasPartialEntryWindow(): boolean {
    return this.chapter?.documentRange !== undefined;
  }

  private scheduleEntryWindowHydration(): void {
    if (this.readerSettingsSnapshot.navigationMode === 'continuous' && !this.continuousEntryPositionReady) return;
    this.entryWindowExpansion.schedule(this.chapter);
  }

  private captureEntryWindowExpansion(chapter: ReadingSessionChapter, lane: ReadingEntryWindowLane): ReadingEntryWindowRequest {
    const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
    const measurement = this.measurementEpoch;
    const gateway = this.activeGateway();
    const contentCurrent = gateway.captureEntryContentValidity?.();
    return {
      isCurrent: (): boolean => this.isSelectionActive(lifecycle, selection) && this.chapter === chapter &&
        this.measurementEpoch === measurement && contentCurrent?.() !== false,
      complete: (current: () => boolean): Promise<ReadingSessionChapter> => gateway.completeEntryChapter(chapter, current, lane),
      firstPagePersistence: (): Promise<void> | undefined => this.ordinaryFirstPagePersistence.pending(),
      boundaryMode: (): ReadingParagraphBoundaryMode => readingParagraphBoundaryMode(this.sourceId, this.bookKind),
      admit: (expanded: ReadingSessionChapter, ranges: ParagraphRange[], map: ReadingSurfaceLayoutMap): void => {
        this.chapter = expanded;
        this.chapterLayoutMap = map;
        this.materializedContentVersion = expanded.contentVersion;
        this.setCurrentReadingChapter(expanded);
        this.readingImageResources.indexChapter(expanded);
        this.paragraphLayout.ranges = ranges;
        this.retainCurrentChapterWindow();
        if (this.readerSettingsSnapshot.navigationMode === 'continuous') this.rebuildContinuousFragments(true);
        // Existing visible native nodes and absolute page facts stay unchanged.
        if (this.phase === 'ready') {
          this.schedulePageTurnPreparation();
          this.prefetchNextChapter(expanded, lifecycle, selection);
          this.drainRapidPageTurn();
          this.resumePendingAutoPageTurn();
        }
      },
    };
  }

  private scheduleEntryCatalogHydration(): void {
    if (!this.entryCatalogPending || this.entryCatalogHydration !== undefined || this.entryCatalogHydrationQueued) return;
    this.entryCatalogHydrationQueued = true;
    const lifecycleToken = this.lifecycleToken;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.entryCatalogHydrationQueued = false;
      if (!this.isSessionActive(lifecycleToken)) return;
      void this.hydrateEntryCatalog().catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Deferred reader catalog: %{private}s', errorMessageOf(error));
      });
    }));
  }

  private hydrateEntryCatalog(): Promise<void> {
    return hydrateReadingEntryCatalog(this.chapterWindow, {
      pending: (): boolean => this.entryCatalogPending,
      task: (): Promise<void> | undefined => this.entryCatalogHydration,
      startRequest: (): ReadingCatalogRequest => {
        const lifecycle = this.lifecycleToken, sourceId = this.sourceId, bookId = this.bookId;
        const admissionRevision = this.remoteCatalogAdmissionRevision;
        const isCurrent = (): boolean => this.isSessionActive(lifecycle) && sourceId === this.sourceId && bookId === this.bookId &&
          admissionRevision === this.remoteCatalogAdmissionRevision;
        this.entryCatalogLoading = true;
        this.entryCatalogLoadFailed = false;
        return { isCurrent, load: (): Promise<LocalReadingToc> => this.activeGateway().loadToc(bookId, isCurrent) };
      },
      currentChapter: (): ReadingSessionChapter | undefined => this.pageTurnPreparation?.origin.chapter ?? this.chapter,
      resumeOnlyChapterIndex: (): number | undefined => this.resumeOnlyChapterIndex,
      installCatalog: (entries: LocalReadingTocEntry[], current: ReadingSessionChapter): void => {
        this.entryCatalogNavigation = undefined;
        this.entryCatalogPending = false;
        this.entryCatalogLoadFailed = false;
        this.admitTocEntries(entries);
        this.configureReadingChapterWindow();
        this.setCurrentReadingChapter(current);
      },
      afterAdmitted: (entries: LocalReadingTocEntry[]): void => {
        this.releaseUnretainedReadingImages();
        this.onDirectoryProjectionChanged(entries);
        this.prepareRemoteCatalogNearEnd();
      },
      track: (operation: Promise<void>): void => { this.entryCatalogHydration = operation; },
      fail: (isCurrent: () => boolean): void => {
        if (isCurrent()) this.entryCatalogLoadFailed = true;
        if (isCurrent() && this.autoPageCoordinator.catalogLoadFailed()) {
          try {
            this.transientFeedback.show(() => this.getUIContext(), { message: '目录加载失败，自动翻页已停止，请重试' }, (): boolean => isCurrent() && this.appForeground && this.windowChromeActive);
          } catch (_) { /* The reading session may already be leaving. */ }
        }
      },
      finish: (operation: Promise<void>): void => {
        if (this.entryCatalogHydration === operation) {
          this.entryCatalogHydration = undefined;
          this.entryCatalogLoading = false;
        }
      },
      resumePaging: (): void => this.resumeAfterCatalogChange(),
    });
  }

  private onRemoteCatalogChanged(): void {
    const session = this.remoteSession;
    const gateway = this.sessionGateway;
    const current = this.pageTurnPreparation?.origin.chapter ?? this.chapter;
    if (!this.isSessionActive(this.lifecycleToken) || session === undefined || gateway === undefined ||
      current === undefined || session.identity.sourceId !== this.sourceId || session.identity.bookId !== this.bookId) return;
    admitObservedReadingCatalog(session, gateway.remoteSession(), current, this.sourceId, this.bookId, this.chapterWindow, {
      catalogPending: (): boolean => this.entryCatalogPending,
      currentToc: (): LocalReadingTocEntry[] => this.tocEntries,
      protectedWindow: (): ReadingCatalogProtectedWindow => {
        const gesture = this.activePagePointerId >= 0 ? this.pageTurnAdmittedPrepared : undefined;
        return {
          bodies: [current, this.chapter, this.adjacentMeasurementContext?.chapter, gesture?.context.chapter,
            this.preparedSettlement.prepared?.context.chapter, this.chapterSelection.origin?.context.chapter,
            this.chapterSelection.candidate?.context.chapter],
          discardUnprotectedPreparations: (): void => {
            if (this.preparedPreviousPage !== this.preparedSettlement.prepared && this.preparedPreviousPage !== gesture)
              this.preparedPreviousPage = undefined;
            if (this.preparedNextPage !== this.preparedSettlement.prepared && this.preparedNextPage !== gesture)
              this.preparedNextPage = undefined;
          },
        };
      },
      admitSession: (): boolean => gateway.admitRemoteCatalog(session),
      beginCatalogUpdate: (): void => {
        this.remoteCatalogAdmissionRevision += 1;
        this.observeReadingPrefetch?.();
        this.entryCatalogNavigation = undefined;
        this.entryCatalogPending = false;
      },
      installCatalog: (entries: LocalReadingTocEntry[], currentChapter: ReadingSessionChapter): void => {
        this.admitTocEntries(entries);
        this.chapterWindow.configure(this.sourceId, this.bookId, this.readingTocEntries().map((item): number => item.index));
        this.chapterWindow.setCurrent(currentChapter);
      },
      afterAdmitted: (): void => {
        this.releaseUnretainedReadingImages();
        this.resumeAfterCatalogChange();
      },
    });
  }

  private resumeAfterCatalogChange(): void {
    // Appending does not retire an in-flight neighbouring-page measure.
    this.queuePageTurnPreparation('next');
    this.queuePageTurnPreparation('previous');
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
  }

  /** A cached cold entry can reach the old catalog end without ever needing
   * a network-capable session. Acquire it only after its visible full-catalog
   * admission; the parent's existing near-end refresh owns the HTTP retry. */
  private prepareRemoteCatalogNearEnd(): void {
    const gateway = this.sessionGateway;
    const current = this.pageTurnPreparation?.origin.chapter ?? this.chapter;
    if (this.sourceId === LOCAL_READING_SOURCE_ID || this.phase !== 'ready' || this.entryCatalogPending ||
      gateway === undefined || gateway.remoteSession() !== undefined || current === undefined) return;
    this.interactiveChapterPreparation.prepareNearEndCatalog((): number | undefined => {
      const entries = this.readingTocEntries();
      const position = this.chapterWindow.position(current.chapterIndex);
      return position < 0 ? undefined : entries.length - position - 1;
    }, (): ReadingNearEndCatalogRequest => {
      const lifecycle = this.lifecycleToken, sourceId = this.sourceId, bookId = this.bookId;
      return {
        key: JSON.stringify([sourceId, bookId, lifecycle]),
        isCurrent: (): boolean => this.isSessionActive(lifecycle) && this.sessionGateway === gateway &&
          this.sourceId === sourceId && this.bookId === bookId,
        load: (isCurrent: () => boolean): Promise<RemoteReadingSession> => gateway.ensureRemoteSession(isCurrent, 'background'),
        reportFailure: (error: Error): void => {
          hilog.warn(0x5244, 'Reader', 'Near-end session preparation: %{private}s', errorMessageOf(error));
        },
      };
    });
  }

  private entryChapterPosition(chapterIndex: number): number | undefined {
    return readerEntryNavigationItem(this.entryCatalogNavigation, chapterIndex)?.readablePosition;
  }

  private loadInitialToc(isCurrent: () => boolean): Promise<LocalReadingToc> {
    if (this.directoryEntries.length === 0) {
      return this.activeGateway().loadToc(this.bookId, isCurrent);
    }
    // Reuse an exact catalog when the parent already has it. A cold entry
    // otherwise asks the one session gateway above; no catalog gates navigation.
    return Promise.resolve(new InitialReadingToc(this.bookId, this.directoryEntries));
  }

  private admitTocEntries(entries: LocalReadingTocEntry[]): void {
    this.tocEntries = entries;
    this.tocDownloadFactsCurrent = ReaderRuntimeOwner.current().captureReadingContentValidity(this.sourceId, this.bookId);
    this.controlDirectoryTocSource = undefined;
    this.controlDirectoryProjection = [];
    this.publishControlDirectoryData(true);
  }

  /**
   * R-LOCAL-TOC-01: Full Directory emits a chapter selection while this same
   * reader instance stays mounted behind the overlay. The prop changes here,
   * so reload that chapter instead of only ever honoring the first mount.
   */
  private onRequestedChapterChanged(): void {
    const requested = this.requestedChapterIndex;
    if (requested === undefined || !this.mounted) {
      return;
    }
    if (this.pageTurnSettlementActive) {
      this.pageTurnPendingRequestedChapterChange = true;
      return;
    }
    if (this.chapter !== undefined && this.chapter.chapterIndex === requested && this.phase !== 'failed') {
      return;
    }
    this.clearTtsChapterEndTimer();
    const lifecycleToken = this.lifecycleToken;
    // Bump the selection token so a slower, earlier chapter load can never
    // overwrite a later selection when several rows are tapped in a row.
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.beginRetainedChapterPresentation(requested, lifecycleToken, selectionToken);
    this.resetForChapterSelection();
    this.loadingChapterIndex = requested;
    // A manual directory selection is not a restore; start the chapter at its
    // natural first scalar.
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    if (this.sessionGateway === undefined) {
      void this.loadInitialReading(lifecycleToken);
      return;
    }
    void this.openChapter(requested, false, lifecycleToken, selectionToken);
  }

  private onRequestedBookmarkAnchorChanged(): void {
    const anchor = this.requestedBookmarkAnchor;
    if (anchor === undefined || !this.mounted) {
      return;
    }
    if (Number.isSafeInteger(anchor.requestId) && anchor.requestId === this.consumedBookmarkAnchorRequestId) {
      return;
    }
    if (this.sessionGateway === undefined) {
      this.chapterSelectionToken += 1;
      this.beginRetainedChapterPresentation(anchor.chapterIndex, this.lifecycleToken, this.chapterSelectionToken);
      this.resetForChapterSelection();
      this.armFirstPageReadyDeadline(this.lifecycleToken, this.chapterSelectionToken);
      void this.loadInitialReading(this.lifecycleToken);
      return;
    }
    this.consumedBookmarkAnchorRequestId = anchor.requestId;
    this.selectBookmarkAnchor(anchor.chapterIndex, anchor.chapterOffset, anchor.positionScope, anchor.directoryTargetProof);
  }

  private onExpandedLayoutChanged(): void {
    if (!this.mounted) {
      return;
    }
    this.reflowAfterWindowGeometryChange();
    this.applyWindowPolicyForChromeOwner();
  }

  private lastControlStructureKey: string = '';
  private currentControlStructureKey(): string {
    return readerControlStructureKey(ReaderWindowCoordinator.metrics(), this.effectiveViewportWidth(),
      this.effectiveViewportHeight(), this.expandedLayout);
  }
  private refreshControlEditingEnvironment(): boolean {
    const previous = this.controlPresentationReceipt;
    const key = this.currentControlStructureKey();
    const facts = this.controlMinimum.providerFacts;
    if (previous === undefined || key !== this.lastControlStructureKey ||
      previous.identity !== this.controlMinimumCommittedIdentity() || this.activeControlNavigationIntent() !== undefined ||
      previous.ownerKey !== this.controlMinimumOwnerKey() || !this.controlMinimumCurrent(previous.identity) ||
      facts === undefined || !readerControlModuleFactsMatch(facts, previous.profile.module) ||
      !this.controlMinimum.factsMatchCommitted()) return false;
    const metrics = ReaderWindowCoordinator.metrics();
    const environment = this.controlMinimumEnvironmentKey();
    this.controlMinimum.revalidateEnvironment(environment);
    this.controlPresentationReceipt = refreshReaderControlPresentationEnvironment(previous, environment, metrics.revision);
    this.controlMinimum.revalidateCandidateMetrics(metrics.revision);
    this.controlFontOrder.reconcile();
    return true;
  }

  private onWindowMetricsRevisionChanged(): void {
    if (!this.mounted) {
      return;
    }
    if (!this.refreshControlEditingEnvironment()) {
      this.controlMinimum.invalidateRequest();
      this.scheduleControlMinimum();
    }
    this.reconcileSessionLaunchLayout();
    this.reflowAfterWindowGeometryChange();
  }

  private reflowAfterWindowGeometryChange(): void {
    if (this.pageTurnInputPhase() !== 'idle') {
      // readingLayout() is intentionally frozen for the transaction, so a
      // live metrics callback cannot be compared meaningfully until the join.
      this.pageTurnPendingWindowReflow = true;
      this.rollbackPageTurnForDeferredMutation();
      return;
    }
    const nextLayoutKey = this.windowMetricsLayoutKey();
    if (nextLayoutKey === this.lastWindowMetricsLayoutKey) {
      this.applyWindowChrome();
      return;
    }
    this.invalidatePageTurnRuntime(true);
    this.lastWindowMetricsLayoutKey = nextLayoutKey;
    // The callback arrives after the metrics/form changed, so the predecessor
    // signature is no longer reconstructible. Invalidate this book's local
    // manifests and remeasure the committed anchor under the new snapshot.
    this.physicalPagination.index.invalidateBook(this.sourceId, this.bookId);
    this.resetPaginationDraft();
    this.applyWindowChrome();
    if (this.hasCurrentMaterializedChapter() && this.phase !== 'failed') {
      if (this.measurementCompleting) {
        this.remeasurePending = true;
        return;
      }
      this.beginMeasurement(this.lifecycleToken);
    }
  }

  /**
   * A directory pick is a new reader transaction, not a reflow of the old
   * chapter.  Invalidate every old continuation before awaiting its successor.
   * The parent keeps the already-admitted Directory panel visible until this
   * transaction emits a persisted first page, so this creates no new loading
   * screen or title-only PaperLayer.
   */
  private resetForChapterSelection(preserveRapidPageTarget: boolean = false, preserveTtsFollow: boolean = false,
    preserveDisplay: boolean = false): void {
    this.directoryJumpProof.clear();
    this.loadingChapterIndex = undefined;
    this.measurementRun.resetSelection();
    this.transientFeedback.reset();
    this.showReaderRecovery('');
    this.ordinaryPageMeasurementSelection = -1;
    this.invalidatePageTurnRuntime(true, preserveRapidPageTarget, preserveTtsFollow);
    this.previousChapterMeasurement = undefined;
    this.physicalPagination.index.invalidateMeasurement();
    this.materializedChapterSelectionToken = -1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.paragraphLayout.batch.length = 0;
    this.paragraphLayout.ranges.length = 0;
    if (!preserveDisplay && this.retainedChapterFrame() === undefined) {
      this.clearContinuousRenderProjection();
      this.continuousInitialFragmentIndex = 0;
      this.continuousInitialFragmentProgress = 0;
      this.continuousProjection.focus(0);
      this.continuousVisibleScalar = 0;
      this.continuousProgressRevision += 1;
    }
    this.continuousUserInteractionActive = false;
    this.readingImageResources.resetChapter();
    this.resetPendingPage();
    this.paragraphLayout.nextRangeIndex = 0;
    this.paragraphLayout.firstRangeStartScalar = 0;
    this.chapter = undefined;
    this.chapterLayoutMap = undefined;
    this.materializedContentVersion = '';
    this.desiredChapterOffset = 0;
    this.desiredChapterProgress = 0;
    this.resetPaginationDraft();
    // The last committed page remains paintable under the presentation lease.
    // Its old selection token no longer authorizes a Core progress write.
    this.measurementEpoch += 1;
    this.phase = 'loading';
    this.measurementRun.cancelDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.pageTurnPreparationQueue.cancelRetry();
  }

  private async openChapter(
    chapterIndex: number,
    isInitial: boolean,
    lifecycleToken: number,
    selectionToken: number,
    requestedOffset?: number,
    requestedProgress?: number,
    refreshContent: boolean = false,
    positionContext?: RemoteReadingPositionContext,
    layoutReady?: Promise<void[]>,
    unreadChapterCandidates: number[] = [],
    contentRetryCount: number = 0,
  ): Promise<void> {
    // A forced refresh is itself a content mutation and owns its Core
    // transaction. Ordinary reads must fence unrelated cache/rule changes.
    const contentOwner = ReaderRuntimeOwner.current();
    const contentCurrent = refreshContent ? ((): boolean => true) :
      contentOwner.captureReadingContentValidity(this.sourceId, this.bookId);
    const recover = async (error: Error): Promise<void> => {
      // A stale selection (or unmounted session) must not fail the current
      // reading flow; only a current request's error is surfaced.
      if (!this.isSelectionActive(lifecycleToken, selectionToken)) {
        return;
      }
      if (!refreshContent && !contentCurrent()) {
        if (positionContext?.directoryTargetProof !== undefined) {
          // An old selection proof cannot authorize a retry across a content
          // change. Keep the original position so the user can select again.
          this.fail(new RemoteReadingGatewayError('positionContextStale', 'READING_DIRECTORY_TARGET_STALE') as Error,
            lifecycleToken);
          return;
        }
        if (contentRetryCount >= 2) {
          this.fail(new RemoteReadingGatewayError('sourceVersionChanged', 'READING_CONTENT_EPOCH_CHANGED') as Error, lifecycleToken);
          return;
        }
        await contentOwner.waitForReadingContentIdle(this.sourceId, this.bookId);
        if (!this.isSelectionActive(lifecycleToken, selectionToken)) return;
        // The page may still hold its previous visible frame; clear only its
        // speculative chapter window before obtaining fresh Core evidence.
        this.chapterWindow.clear();
        this.preparedReadingEntry = undefined;
        await this.openChapter(chapterIndex, isInitial, lifecycleToken, selectionToken,
          requestedOffset, requestedProgress, false, positionContext, layoutReady,
          unreadChapterCandidates, contentRetryCount + 1);
        return;
      }
      if (isInitial && !refreshContent && unreadChapterCandidates.length > 0 &&
        remoteReadingFailureKindOf(error) === 'SOURCE_CONTENT_EMPTY') {
        await this.openChapter(unreadChapterCandidates[0], true, lifecycleToken, selectionToken,
          undefined, undefined, false, undefined, layoutReady, unreadChapterCandidates.slice(1));
        return;
      }
      if (error instanceof RemoteChapterCacheRefreshError && !error.refreshPreserved && !refreshContent) {
        this.fail(error as Error, lifecycleToken);
        const failedSelection = this.chapterSelectionToken;
        this.requestCachedChapterRefresh(error, (): void => {
          if (!this.isSelectionActive(lifecycleToken, failedSelection)) return;
          this.chapterSelectionToken += 1;
          this.beginRetainedChapterPresentation(chapterIndex, lifecycleToken, this.chapterSelectionToken, true,
            error.positionContext);
          this.resetForChapterSelection();
          this.failureCode = '';
          this.armFirstPageReadyDeadline(lifecycleToken, this.chapterSelectionToken);
          void this.openChapter(chapterIndex, isInitial, lifecycleToken, this.chapterSelectionToken,
            requestedOffset, requestedProgress, true, error.positionContext, layoutReady);
        });
        return;
      }
      this.fail(error as Error, lifecycleToken);
    };

    let operation: Promise<void>;
    try {
      const proof = positionContext?.directoryTargetProof;
      if (proof !== undefined && !this.matchesDirectoryTargetProof(chapterIndex, proof))
        throw new RemoteReadingGatewayError('identityMismatch', 'READING_DIRECTORY_TARGET_SCOPE_CHANGED') as Error;
      if (!isInitial && this.tocEntries.length > 0 && !(this.entryCatalogPending && proof !== undefined)) {
        this.requireKnownChapter(chapterIndex);
      }
      const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
      if (!contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
      const existingNavigation = this.entryCatalogNavigation;
      const downloadFactsCurrent = this.tocDownloadFactsCurrent;
      const knownDownloadState = downloadFactsCurrent?.() !== true ? undefined :
        (this.entryCatalogPending ?
          (proof === undefined || proof.catalogRevision === existingNavigation?.revision ?
            readerEntryNavigationItem(existingNavigation, chapterIndex)?.downloadState : undefined) :
          this.readingTocEntries()[this.readableChapterPosition(chapterIndex)]?.downloadState);
      if (isInitial && this.preparedReadingEntry !== undefined && !this.preparedReadingEntry.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([]));
        return;
      }
      const restored = isInitial && this.restoredProgress?.kind === 'restored' &&
        this.restoredProgress.progress.chapterIndex === chapterIndex ? this.restoredProgress.progress : undefined;
      const prepared = positionContext?.directoryTargetProof === undefined && isInitial && !refreshContent &&
        this.preparedReadingEntry?.isCurrent() === true &&
        this.preparedReadingEntry.chapter.chapterIndex === chapterIndex ? this.preparedReadingEntry : undefined;
      operation = prepareReadingChapterOpening({
        chapterIndex, refreshContent, restored, explicitContext: positionContext, layoutReady,
        prepared: prepared === undefined ? undefined :
          { chapter: prepared.chapter, isCurrent: (): boolean => prepared.isCurrent() },
      }, this.chapterWindow, {
        isCurrent, contentCurrent,
        restartPreparedEntry: (): Promise<void> =>
          this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([])),
      }, {
        loadChapter: (context: RemoteReadingPositionContext | undefined): Promise<ReadingSessionChapter> =>
          this.activeGateway().loadChapter(this.bookId, chapterIndex, isCurrent, refreshContent, context,
            downloadFactsCurrent === this.tocDownloadFactsCurrent && downloadFactsCurrent?.() === true ?
              knownDownloadState : undefined),
        chapterReady: (): void => {
          this.markRetainedChapterBodyReady(lifecycleToken, selectionToken);
          if (isInitial) this.traceInitialReadingPhase?.('chapter-ready', lifecycleToken);
        },
        boundaryMode: (): ReadingParagraphBoundaryMode => readingParagraphBoundaryMode(this.sourceId, this.bookKind),
        confirmContentMetrics: (chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap, current: () => boolean): Promise<boolean> =>
          this.ensureCurrentContentMetrics(chapter, map, current),
        applyPosition: (update: ReadingChapterPositionUpdate): void => {
          if (update.kind === 'requested') requestedOffset = update.offset;
          else this.restoredProgress = update.progress;
        },
        admit: (loaded: ReadingSessionChapter, measurementProjection: ReadingChapterMeasurementProjection): void => {
          const chapter = this.directoryJumpProof.admit(loaded, selectionToken, positionContext?.directoryTargetProof);
          const chapterMap = measurementProjection.map;
          this.preparedReadingEntry = undefined;
          this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
          this.setCurrentReadingChapter(chapter);
          this.retainCurrentChapterWindow();
          this.chapter = chapter;
          this.readingImageResources.indexChapter(chapter);
          this.materializedChapterSelectionToken = selectionToken;
          this.configureRestoredAnchor(chapter, chapterMap, isInitial, requestedOffset, requestedProgress);
          this.paragraphLayout.ranges = measurementProjection.ranges;
          // Never lay out against the Phone/Tablet fallback constants. If Area
          // has already arrived, start once now; otherwise the first real Area
          // callback below owns the initial measurement generation.
          if (this.hasMeasuredViewport()) {
            this.beginMeasurement(lifecycleToken);
          }
          if (chapter.positionMigration?.status === 'committed') {
            this.reloadBookmarksAfterContentRefresh(chapter, lifecycleToken, selectionToken);
          }
          this.notifyPreservedContentRefresh(chapter, refreshContent, lifecycleToken, selectionToken);
        },
        fail: recover,
      });
    } catch (error) {
      await recover(error as Error);
      return;
    }
    await operation;
  }

  private requestCachedChapterRefresh(error: RemoteChapterCacheRefreshError, refresh: () => void): void {
    this.showReaderRecovery(error.message, '刷新本章', refresh);
  }

  private notifyPreservedContentRefresh(chapter: ReadingSessionChapter, refreshContent: boolean,
    lifecycleToken: number, selectionToken: number): void {
    const preserved = refreshContent && chapter.positionMigration?.status === 'preserved';
    const refreshed = refreshContent && (chapter.positionMigration?.status === 'committed' ||
      chapter.positionMigration?.status === 'unchanged');
    if ((!preserved && !refreshed && chapter.cacheRefreshRequired !== true) ||
      !this.isSelectionActive(lifecycleToken, selectionToken)) {
      return;
    }
    if (!preserved && !refreshed && this.cacheNoticeLifecycle === lifecycleToken) return;
    if (!preserved && !refreshed) this.cacheNoticeLifecycle = lifecycleToken;
    let message = '正在使用旧版缓存，正文待验证。可在顶部更多中刷新本章；离线阅读和原位置不受影响。';
    if (preserved) {
      message = '刷新未完成，本次未更新正文。原正文和阅读位置已保留。';
    } else if (refreshed) {
      message = chapter.positionMigration?.status === 'unchanged' ? '本章已刷新，书源正文没有变化。' :
        chapter.positionMigration?.reason === 'positions_partially_restored' ?
          '本章正文已更新；无法恢复的阅读位置从章首继续，旧书签和划线记录仍保留。' : '本章正文已更新。';
    }
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) && this.appForeground && this.windowChromeActive);
    } catch (_) {
      // Presentation failure cannot turn a preserved, readable chapter into a
      // load failure. The common short-feedback adapter owns native failures.
    }
  }

  private reloadBookmarksAfterContentRefresh(chapter: ReadingSessionChapter,
    lifecycleToken: number, selectionToken: number): void {
    // Retire older list reads before reloading Core's versioned records.
    // Bookmark presentation never blocks the newly admitted chapter body.
    this.controlBookmarkRead.refresh((ownsGeneration: () => boolean): ReaderControlBookmarkReadIntent => ({
      isCurrent: (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) &&
        this.chapter === chapter && ownsGeneration(),
      load: (current: () => boolean): Promise<void> => this.onLoadControlBookmarks(chapter.sourceId, chapter.bookId, current),
      failed: (_error: Error): void => { this.controlBookmarkLoadFailed = true; },
    }), (): void => { this.controlBookmarkLoadFailed = false; });
  }

  /**
   * After current-page admission, expand the body window nearest-first.
   * One optional request at a time; the shared background lane leaves room
   * for explicit reading. Distant bodies do not create pages or textures.
   */
  private prefetchNextChapter(
    current: ReadingSessionChapter,
    lifecycleToken: number,
    selectionToken: number,
  ): void {
    const page = this.visiblePage;
    const facing = this.readingLayout().facingChapterWidth > 0;
    if ((!facing && current.documentRange !== undefined) || page === undefined ||
      !this.isStableVisiblePageOwner(page, current, selectionToken, lifecycleToken)) return;
    this.interactiveChapterPreparation.prefetch(this.chapterWindow, current, facing, {
      key: `${lifecycleToken}:${selectionToken}:${current.chapterIndex}:${page.startScalar}`,
      isCurrent: (): boolean => this.isStableVisiblePageOwner(page, current, selectionToken, lifecycleToken),
      load: (index: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> =>
        this.activeGateway().prefetchChapter(this.bookId, index, isCurrent),
      publication: this.neighbourPublication(),
    }, (): void => {
      if (this.pageTurnInputPhase() === 'idle') this.pageTurnRenderRevision += 1;
    });
  }

  /** Demand acquisition refills an evicted neighbour while its queued direction survives. */
  private requestPageTurnChapter(direction: ReaderPageTurnDirection, chapterIndex: number): void {
    const page = this.visiblePage;
    const origin = this.chapter;
    if (page === undefined || origin === undefined || !this.isKnownControlChapter(chapterIndex) ||
      this.chapterWindow.get(chapterIndex) !== undefined) return;
    const generation = this.pageTurnGeneration;
    const lifecycle = this.lifecycleToken;
    const selection = this.chapterSelectionToken;
    this.interactiveChapterPreparation.requestTurn(this.chapterWindow, chapterIndex, direction === 'next', {
      key: `${lifecycle}:${selection}:${generation}:${origin.chapterIndex}:${page.startScalar}:${direction}:${chapterIndex}`,
      isCurrent: (): boolean => generation === this.pageTurnGeneration &&
        this.isStableVisiblePageOwner(page, origin, selection, lifecycle),
      load: (index: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> =>
        this.activeGateway().loadChapter(this.bookId, index, isCurrent),
      publication: this.neighbourPublication(),
    }, (isCurrent: () => boolean): void => {
      if (readerRapidPageTurnDirection(this.rapidPageTurnState) === direction || this.activePagePointerId >= 0) {
        this.transientFeedback.show(() => this.getUIContext(), {
          message: direction === 'previous' ? '上一章加载失败，请重试' : '下一章加载失败，请重试',
        }, (): boolean => isCurrent() && this.appForeground && this.windowChromeActive);
      }
    });
  }

  private neighbourPublication(): ReadingNeighbourPublication {
    return {
      matchesIdentity: (chapter: ReadingSessionChapter): boolean =>
        chapter.sourceId === this.sourceId && chapter.bookId === this.bookId,
      admitVersion: (index: number, version: string): void => this.admitChapterContentVersion(index, version),
      retain: (): void => this.retainCurrentChapterWindow(),
      prepareAdjacent: (forward: boolean): void => {
        this.queuePageTurnPreparation(forward ? 'next' : 'previous');
        this.drainPageTurnPreparationQueue();
      },
    };
  }

  /**
   * The metrics command and the chapter command are intentionally separate,
   * backward-compatible protocol reads. If an edit or replace rule changed
   * the processed text between them, refresh the Core-owned aggregate once
   * and fail closed unless the active chapter's scalar count now agrees.
   */
  private async ensureCurrentContentMetrics(
    chapter: ReadingSessionChapter,
    chapterMap: ReadingSurfaceLayoutMap,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (!this.activeGateway().supportsExactContentMetrics()) {
      return true;
    }
    let metrics = this.contentMetrics;
    if (metrics === undefined) {
      return true;
    }
    const scalarCount = chapterMap.scalarCount();
    let metric = this.contentMetricIndex.forChapter(metrics, chapter.chapterIndex);
    if (metric !== undefined && metric.scalarLength === scalarCount) {
      return true;
    }
    metrics = await this.activeGateway().loadContentMetrics(this.bookId, isCurrent);
    if (!isCurrent()) {
      return false;
    }
    if (metrics === undefined) {
      throw new Error('READING_CONTENT_METRICS_MISSING');
    }
    validateContentMetricsAgainstToc(metrics, this.tocEntries);
    metric = this.contentMetricIndex.forChapter(metrics, chapter.chapterIndex);
    if (metric === undefined || metric.scalarLength !== scalarCount) {
      throw new Error('READING_CONTENT_METRICS_STALE');
    }
    this.contentMetrics = metrics;
    return true;
  }

  private async loadContentMetricsIfNeeded(lifecycleToken: number): Promise<void> {
    if (!this.isSessionActive(lifecycleToken) || this.contentMetrics !== undefined ||
      this.contentMetricsLoading || this.sessionGateway === undefined || !this.activeGateway().supportsExactContentMetrics()) {
      return;
    }
    this.contentMetricsLoading = true;
    try {
      const isCurrent = (): boolean => this.isSessionActive(lifecycleToken);
      const metrics = await this.activeGateway().loadContentMetrics(this.bookId, isCurrent);
      if (!isCurrent() || metrics === undefined) {
        return;
      }
      validateContentMetricsAgainstToc(metrics, this.tocEntries);
      const chapter = this.chapter;
      const chapterMap = this.chapterLayoutMap;
      if (chapter !== undefined && chapterMap !== undefined) {
        const metric = this.contentMetricIndex.forChapter(metrics, chapter.chapterIndex);
        if (metric === undefined || metric.scalarLength !== chapterMap.scalarCount()) {
          return;
        }
      }
      this.contentMetrics = metrics;
    } catch (_error) {
      // Exact local metrics improve whole-book controls but are not required
      // to render or navigate the already materialized current chapter.
    } finally {
      if (this.isMountedToken(lifecycleToken)) {
        this.contentMetricsLoading = false;
      }
    }
  }

  private configureRestoredAnchor(
    chapter: ReadingSessionChapter,
    chapterMap: ReadingSurfaceLayoutMap,
    isInitial: boolean,
    requestedOffset?: number,
    requestedProgress?: number,
  ): void {
    // A newly admitted chapter body owns a fresh location revision. Even when
    // its visible scalar offset matches the prior body, the next ready-page
    // commit must cross Core once before exit deduplication is allowed again.
    this.lastCommittedProgress = undefined;
    this.chapterLayoutMap = chapterMap;
    this.materializedContentVersion = chapter.contentVersion;
    const target = resolveReadingChapterOpeningAnchor(chapter, chapterMap,
      isInitial ? this.restoredProgress : undefined, requestedOffset, requestedProgress);
    this.desiredChapterOffset = target.offset;
    this.desiredChapterProgress = target.progress;
  }

  /**
   * Last non-whitespace scalar of the chapter content. Used to pull a stale
   * EOF/blank-line restore anchor back to a visible glyph; the paragraph-range
   * clamp inside beginMeasurement applies the same upper bound later.
   */
  private lastVisibleScalar(content: string, map: ReadingSurfaceLayoutMap): number {
    return lastVisibleReadingScalar(content, map);
  }

  private retainNativeParagraphResources(): void {
    const keys = new Set<string>();
    const fragments = this.visibleFragments.concat(this.continuousProjection.fragments, this.preparedPreviousPage?.page.fragments ?? [],
      this.preparedNextPage?.page.fragments ?? [], this.readingReadyPage?.fragments ?? [],
      this.chapterSelection.origin?.page.fragments ?? [], this.chapterSelection.candidate?.page.fragments ?? []);
    for (const fragment of fragments) {
      if (fragment.nativeParagraph !== undefined) keys.add(fragment.nativeParagraph.key);
      if (fragment.nativeTitle !== undefined) keys.add(fragment.nativeTitle.key);
    }
    if (this.continuousTitleRecipe !== undefined) keys.add(this.continuousTitleRecipe.key);
    this.nativeParagraphResources.retain(keys);
  }

  private beginMeasurement(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    if (!this.hasMeasuredViewport()) {
      return;
    }
    if (this.measurementCompleting) {
      this.remeasurePending = true;
      return;
    }
    const chapter = this.measuringChapter();
    const selectionToken = this.materializedChapterSelectionToken;
    if (chapter === undefined || !this.isSelectionCurrent(selectionToken)) {
      return;
    }
    try {
      this.retainNativeParagraphResources();
      this.nativeTextMeasurement.clear();
      this.paragraphLayout.batch.length = 0;
      if (this.measuringRanges().length === 0) {
        this.collectParagraphRanges(chapter.content);
      }
      if (this.measuringRanges().length === 0) {
        throw new Error('READING_CONTENT_EMPTY');
      }
      if (this.previousChapterMeasurement !== undefined) {
        this.beginReversePageMeasurement(lifecycleToken, selectionToken);
        return;
      }
      const start = planForwardReadingMeasurement(this.measuringOffset(), chapter.content,
        this.requireMeasurementLayoutMap(), this.measuringRanges());
      if (start.expand !== undefined) {
        this.physicalPagination.index.beginMeasurement(selectionToken);
        this.phase = 'measuring';
        this.expandMeasurementParagraphWindow(start.expand, this.currentMeasurementGeneration(), selectionToken, lifecycleToken);
        return;
      }
      this.setMeasuringOffset(start.offset);
      this.setMeasuringProgress(start.progress);
      this.setMeasuringRequestedAnchor(start.offset);
      // A controller is bound to one exact title/layout observation. Recreate
      // it before mounting the new hidden tree so an adjacent chapter cannot
      // reuse the previous title's line count.
      this.measuredNativeTitle = undefined;
      this.chapterTitleMeasurementController = new TextController();
      this.measuredChapterTitleHeightVp = 0;
      this.measurementRun.beginForwardGates();
      this.paragraphLayout.nextRangeIndex = this.rangeIndexForOffset(this.measuringOffset());
      this.paragraphLayout.firstRangeStartScalar = this.measuringOffset();
      this.resetPendingPage();
      // A chapter selection may be in progress behind the non-opaque Full
      // Directory panel. Preserve an already committed display snapshot until
      // its replacement is persisted; do not expose an empty PaperLayer or a
      // new title with an old body.
      const hasDisplayPage = this.visiblePage !== undefined && this.visibleFragments.length > 0;
      if (!hasDisplayPage) {
        this.visiblePage = undefined;
        this.visibleFragments = [];
        this.showChapterTitle = false;
        this.ensureFirstPageReadyDeadline(lifecycleToken, selectionToken);
      }
      this.physicalPagination.index.beginMeasurement(selectionToken);
      this.measurementRun.beginNativeLayout();
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.phase = 'measuring';
      if (!this.prepareNextMeasurementBatch()) {
        throw new Error('PAGINATION_NO_MEASUREMENT_BATCH');
      }
      // Native Text is measured immediately with the admitted font/viewport;
      // no hidden component tree or unrelated UIObserver callback is needed.
      this.measurementEpoch += 1;
      this.armMeasurementDeadline(this.currentMeasurementGeneration(), selectionToken, lifecycleToken);
      this.measureNativeTextBatch();
      this.captureMeasurementAfterLayout();
    } catch (error) {
      if (this.retryNativeTextLayout(error as Error, lifecycleToken)) return;
      this.fail(error as Error, lifecycleToken);
    }
  }

  private retryNativeTextLayout(error: Error, lifecycleToken: number): boolean {
    return this.measurementRun.retryLayout(error, (): boolean => this.isSessionActive(lifecycleToken),
      (): (() => boolean) => {
        const generation = this.currentMeasurementGeneration();
        const selection = this.currentMeasurementSelection();
        return (): boolean => this.isMeasurementCurrent(generation, selection, lifecycleToken);
      }, (): void => this.beginMeasurement(lifecycleToken));
  }

  private captureMeasurementAfterLayout(): void {
    const lifecycleToken = this.lifecycleToken;
    const generation = this.currentMeasurementGeneration();
    const selectionToken = this.currentMeasurementSelection();
    if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) ||
      this.measurementCompleting || this.batchProcessing) {
      return;
    }
    if (!this.hasValidUnicodeProbe(lifecycleToken)) {
      this.reportMeasurementGatePending(false, true, true);
      return;
    }
    const titleResult = this.captureChapterTitleMeasurementAfterLayout(lifecycleToken);
    if (!titleResult) {
      this.reportMeasurementGatePending(true, false, true);
      return;
    }
    if (this.paragraphLayout.batch.length === 0) return;
    this.batchProcessing = true;
    this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
  }

  private reportMeasurementGatePending(probeOk: boolean, titleOk: boolean, batchOk: boolean): void {
    const message = this.measurementRun.pendingDiagnostic(probeOk, titleOk, batchOk);
    if (message !== undefined) console.info(message);
  }

  private consumeMeasuredBatch(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        return;
      }
      if (this.previousChapterMeasurement !== undefined) {
        this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken);
        return;
      }
      const result = advanceMeasuredReadingBatch(this.paragraphLayout.batch, this.physicalPagination, {
        paragraphStart: (paragraph: MeasurementParagraph): number => paragraph.chapterStartScalar,
        knownEnd: (): number | undefined => this.measuredPageEndLimit(),
        consumeParagraph: (paragraph: MeasurementParagraph, batchIndex: number, knownEnd: number | undefined): ReaderMeasuredParagraphResult => {
          const image = this.readingImageForParagraph(paragraph);
          return image === undefined ? this.consumeForwardMeasuredText(paragraph, batchIndex, knownEnd) :
            this.consumeForwardMeasuredImage(image, batchIndex, generation, selectionToken, lifecycleToken);
        },
        releaseMeasurement: (): void => this.nativeTextMeasurement.clear(),
        prepareNextBatch: (): boolean => this.prepareNextMeasurementBatch(),
      });
      if (result === 'waiting') return;
      if (result === 'next-batch') {
        this.batchProcessing = false;
        this.measurementEpoch += 1;
        this.measureNativeTextBatch();
        this.captureMeasurementAfterLayout();
        return;
      }
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        if (this.retryNativeTextLayout(error as Error, lifecycleToken)) return;
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  private consumeForwardMeasuredImage(bodyImage: ReadingSessionImage, batchIndex: number,
    generation: number, selectionToken: number, lifecycleToken: number): ReaderMeasuredParagraphResult {
    const plan = planForwardMeasuredImage(bodyImage, this.physicalPagination, {
      capacity: (_: number): number => this.pendingPageBodyCapacity(),
      lineHeight: (): number => readerAppearanceLineHeight(this.appearanceSnapshot),
      paragraphSpacing: (): number => this.appearanceSnapshot.paragraphSpacing,
      scaledHeight: (capacity: number): number => this.scaledReadingImageHeight(bodyImage, capacity),
    });
    if (plan.result === 'page-ready') return 'page-ready';
    if (plan.result === 'waiting') {
      // Leave only the image and unconsumed suffix for the decode resume.
      if (batchIndex > 0) this.paragraphLayout.batch.splice(0, batchIndex);
      this.resolvePendingReadingImage(bodyImage, generation, selectionToken, lifecycleToken);
      return 'waiting';
    }
    this.physicalPagination.appendFragment(
      this.measuredImageFragment(this.requireMeasurementChapter().chapterIndex, bodyImage, plan.height),
      bodyImage.startScalar, bodyImage.endScalar, plan.height, true, this.appearanceSnapshot.paragraphSpacing);
    return 'continue';
  }

  private measuredImageFragment(chapterIndex: number, image: ReadingSessionImage, height: number): ReadingSurfacePageFragment {
    return new ReadingSurfacePageFragment(
      `chapter-${chapterIndex}:image:${image.startScalar}-${image.endScalar}`, '', true, image.startScalar, image.endScalar,
      image.state === 'ready' ? image.pixelMap : undefined, height,
      image.state === 'ready' ? image.fileUri : undefined, height, image.imageWidthBasisPoints);
  }

  private consumeForwardMeasuredText(paragraph: MeasurementParagraph, batchIndex: number,
    knownEnd: number | undefined): ReaderMeasuredParagraphResult {
    this.measureNativeParagraph(paragraph);
    if (!this.paragraphHasLayout(paragraph, batchIndex)) {
      // Preserve admitted fragments while the next controller becomes ready.
      if (batchIndex > 0) this.paragraphLayout.batch.splice(0, batchIndex);
      this.batchProcessing = false;
      this.reportMeasurementGatePending(true, true, false);
      return 'waiting';
    }
    const extents = readerNativeParagraphLineExtents(paragraph.controller.getLayoutManager());
    const lines = this.measuredLines(paragraph, extents);
    let nativeRecipe: ReaderNativeParagraphRecipe | undefined;
    let transferred: boolean = false;
    return admitForwardMeasuredLines(lines, this.physicalPagination, {
      knownEnd,
      isParagraphStart: paragraph.isParagraphStart,
      capacity: (): number => this.pendingPageBodyCapacity(),
      paragraphSpacing: (): number => this.appearanceSnapshot.paragraphSpacing,
      spanHeight: (firstLine: number, lastLine: number): number => this.getUIContext().px2vp(
        extents.height(firstLine, lastLine)),
      appendLine: (line: MeasuredReadingLine, admittedLineHeight: number, isParagraphStart: boolean, firstNativeLine: boolean): void => {
        if (nativeRecipe === undefined) {
          nativeRecipe = { key: readerNativeParagraphKey(), text: paragraph.text,
            startScalar: paragraph.chapterStartScalar, firstLine: line.lineIndex, lastLine: line.lineIndex,
            style: this.bodyMeasurementStyle(paragraph.isParagraphStart) };
          if (!transferred) {
            const window = new ReaderNativeTextWindow(this.getUIContext(), this.nativeTextMeasurement.take(paragraph.controller),
              paragraph.controller, this.getUIContext().vp2px(this.measurementTextWidth()),
              this.readerSettingsSnapshot.navigationMode === 'continuous' ? 0 : line.lineIndex,
              this.readerSettingsSnapshot.navigationMode === 'continuous' ? undefined : lines[lines.length - 1].lineIndex);
            this.nativeParagraphResources.set(nativeRecipe.key, window, paragraph.layoutMap);
            transferred = true;
          }
        }
        nativeRecipe.lastLine = line.lineIndex;
        // ReadingSurface uses this id as its ArkUI ForEach identity. A
        // paragraph starts at zero in every chapter, so the local paragraph
        // id alone would let a new chapter reuse an old visible Text child.
        // Bind the fragment to the Core-returned chapter identity; this is
        // presentation identity only and never changes the scalar anchor.
        const fragment = new ReadingSurfacePageFragment(
          `chapter-${this.requireMeasurementChapter().chapterIndex}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
          this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)),
          isParagraphStart,
          line.startScalar,
          line.endScalar,
          undefined,
          0,
          undefined,
          admittedLineHeight,
        );
        fragment.nativeParagraph = nativeRecipe;
        fragment.nativeParagraphFirst = firstNativeLine;
        this.physicalPagination.appendFragment(fragment, line.startScalar, line.endScalar,
          admittedLineHeight, isParagraphStart, this.appearanceSnapshot.paragraphSpacing);
      },
    });
  }

  private hasValidUnicodeProbe(lifecycleToken: number): boolean {
    return this.measurementRun.validateUnicode((): ReaderUnicodeMeasurement => {
      const manager = this.unicodeProbeController.getLayoutManager();
      return { count: manager.getLineCount(), readLine: (): ArkUILineMetric => this.toLineMetric(manager.getLineMetrics(0)) };
    }, (error: Error): void => this.fail(error, lifecycleToken), (message: string): void => console.info(message));
  }

  private paragraphHasLayout(paragraph: MeasurementParagraph, paragraphIndex: number): boolean {
    return this.measurementRun.paragraphHasLayout(paragraphIndex,
      (): number => paragraph.controller.getLayoutManager().getLineCount());
  }

  private measurementIncludesChapterTitle(): boolean {
    const chapter = this.measuringChapter();
    return chapter !== undefined && chapter.chapterTitle.length > 0 &&
      this.isMeasurementChapterFirstPageStart(this.measuringRequestedAnchor());
  }

  /** Captures the wrapped title before any body line is admitted to page one. */
  private captureChapterTitleMeasurementAfterLayout(lifecycleToken: number): boolean {
    if (!this.measurementIncludesChapterTitle()) {
      this.measuredChapterTitleHeightVp = 0;
      this.measurementRun.clearTitle();
      return true;
    }
    if (this.measuredNativeTitle !== undefined) return true;
    return this.measurementRun.captureTitle((): ReaderTitleMeasurement => {
      const manager = this.chapterTitleMeasurementController.getLayoutManager();
      const count = manager.getLineCount();
      return { count, admit: (): void => this.admitMeasuredTitle(manager, count) };
    }, (error: Error): void => this.fail(error, lifecycleToken));
  }

  private admitMeasuredTitle(manager: LayoutManager, lineCount: number): void {
    const context = this.getUIContext();
    const heightVp = context.px2vp(readerNativeParagraphHeight(manager, 0, lineCount - 1));
    if (!Number.isFinite(heightVp) || heightVp <= 0) throw new Error('PAGINATION_CHAPTER_TITLE_GEOMETRY_INVALID');
    const recipe: ReaderNativeParagraphRecipe = {
      key: readerNativeParagraphKey(), text: this.requireMeasurementChapter().chapterTitle,
      startScalar: 0, firstLine: 0, lastLine: lineCount - 1, style: this.titleMeasurementStyle(),
    };
    const window = new ReaderNativeTextWindow(context,
      this.nativeTextMeasurement.take(this.chapterTitleMeasurementController),
      this.chapterTitleMeasurementController, context.vp2px(this.measurementTextWidth()), 0, lineCount - 1);
    this.nativeParagraphResources.set(recipe.key, window);
    this.measuredNativeTitle = recipe;
    this.measuredChapterTitleHeightVp = heightVp;
  }

  /** Assemble only the page immediately before an exact observed boundary.
   * Text still shapes each complete original paragraph. Direction changes page
   * admission, never Unicode/bidi context or the platform's line boundaries. */
  private beginReversePageMeasurement(lifecycleToken: number, selectionToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined) return;
    const map = this.requireMeasurementLayoutMap();
    if (pending.endScalar < 0) {
      const draft = this.measuringDraft();
      const known = draft?.matches(this.measurementPaginationKey()) === true ?
        draft.observationForPageStart(pending.originalChapterOffset) : undefined;
      pending.endScalar = pending.targetChapterIndex === pending.originalChapterIndex ?
        Math.min(pending.originalChapterOffset, known?.requestScalar ?? pending.originalChapterOffset) : map.scalarCount();
    }
    this.resetPendingPage();
    this.physicalPagination.endScalar = pending.endScalar;
    this.setMeasuringRequestedAnchor(pending.endScalar);
    this.measuredNativeTitle = undefined;
    this.measuredChapterTitleHeightVp = 0;
    this.chapterTitleMeasurementController = new TextController();
    pending.nextRangeIndex = this.paragraphLayout.previousRangeIndex(this.measuringRanges(), pending.endScalar);
    this.physicalPagination.index.beginMeasurement(selectionToken);
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.phase = 'measuring';
    this.measurementEpoch += 1;
    const generation = this.currentMeasurementGeneration();
    this.armMeasurementDeadline(generation, selectionToken, lifecycleToken);
    if (pending.endScalar > map.residentEnd() || pending.nextRangeIndex < 0 && map.residentStart() > 0) {
      this.expandMeasurementParagraphWindow(pending.endScalar > map.residentEnd() ? 'after' : 'before',
        generation, selectionToken, lifecycleToken);
      return;
    }
    if (!this.preparePreviousMeasurementParagraph()) throw new Error('PAGINATION_NO_PREVIOUS_PAGE');
    this.measureNativeTextBatch();
    this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken);
  }

  private preparePreviousMeasurementParagraph(): boolean {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || pending.nextRangeIndex < 0) return false;
    const next = this.paragraphLayout.preparePrevious(this.requireMeasurementChapter().content,
      this.measuringRanges(), pending.nextRangeIndex, (): void => this.nativeTextMeasurement.clear(),
      (range: ParagraphRange, index: number, text: string, requested: number): MeasurementParagraph =>
        new MeasurementParagraph(range.id, index, text, range.startScalar,
          new ReadingSurfaceLayoutMap(text), new TextController(), true, requested));
    if (next === undefined) return false;
    pending.nextRangeIndex = next;
    return true;
  }

  private reversePageCapacityAt(startScalar: number): number {
    if (!this.isMeasurementChapterFirstPageStart(startScalar)) return this.readingLayout().bodyHeightAfterTitle(0);
    const requested = this.measuringRequestedAnchor();
    this.setMeasuringRequestedAnchor(startScalar);
    try {
      this.measureNativeChapterTitle();
      if (!this.captureChapterTitleMeasurementAfterLayout(this.lifecycleToken))
        throw new Error('PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE');
      return this.readingLayout().bodyHeightAfterTitle(this.measuredChapterTitleHeightVp);
    } finally { this.setMeasuringRequestedAnchor(requested); }
  }

  private measuredReverseLines(paragraph: MeasurementParagraph, endScalar: number,
    extents: ReaderNativeLineExtents): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const map = paragraph.layoutMap;
    const endUtf16 = map.utf16ForScalar(Math.max(0,
      Math.min(map.scalarCount(), endScalar - paragraph.chapterStartScalar)));
    return collectReverseMeasuredLines(map, paragraph.chapterStartScalar, manager.getLineCount(), endUtf16, {
      lineEndUtf16: (index: number): number => manager.getLineMetrics(index).endIndex,
      readLine: (index: number): ArkUILineMetric => this.toLineMetric(manager.getLineMetrics(index)),
      exceedsCapacity: (first: number, last: number): boolean =>
        this.getUIContext().px2vp(extents.height(first, last)) >
        this.readingLayout().bodyHeightAfterTitle(0),
    });
  }

  private consumeReversePageParagraph(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
      const pending = this.previousChapterMeasurement;
      const paragraph = this.paragraphLayout.batch[0];
      if (pending === undefined || paragraph === undefined) return;
      if (!this.hasValidUnicodeProbe(lifecycleToken)) return;
      const image = this.readingImageForParagraph(paragraph);
      let full = false;
      if (image !== undefined) {
        const plan = planReverseMeasuredImage(image, pending.endScalar, this.physicalPagination, {
          capacity: (start: number): number => this.reversePageCapacityAt(start),
          lineHeight: (): number => readerAppearanceLineHeight(this.appearanceSnapshot),
          paragraphSpacing: (): number => this.appearanceSnapshot.paragraphSpacing,
          scaledHeight: (capacity: number): number => this.scaledReadingImageHeight(image, capacity),
        });
        if (plan.result === 'waiting') {
          this.resolvePendingReadingImage(image, generation, selectionToken, lifecycleToken); return;
        }
        full = plan.result === 'page-ready';
        if (plan.result === 'admitted') {
          this.physicalPagination.prependFragments([this.measuredImageFragment(pending.targetChapterIndex, image, plan.height)],
            image.startScalar, plan.height, this.appearanceSnapshot.paragraphSpacing);
        }
      } else {
        this.measureNativeParagraph(paragraph);
        const extents = readerNativeParagraphLineExtents(paragraph.controller.getLayoutManager());
        const lines = this.measuredReverseLines(paragraph, pending.endScalar, extents);
        const result = selectReverseMeasuredLines(lines, this.physicalPagination,
          (firstLine: number, lastLine: number): number => this.getUIContext().px2vp(extents.height(firstLine, lastLine)),
          (startScalar: number): number => this.reversePageCapacityAt(startScalar),
          (): number => this.appearanceSnapshot.paragraphSpacing);
        const selected = result.lines;
        const height = result.height;
        full = result.full;
        if (selected.length > 0) {
          const recipe: ReaderNativeParagraphRecipe = {
            key: readerNativeParagraphKey(), text: paragraph.text, startScalar: paragraph.chapterStartScalar,
            firstLine: selected[0].lineIndex, lastLine: selected[selected.length - 1].lineIndex,
            style: this.bodyMeasurementStyle(true),
          };
          const fragments: ReadingSurfacePageFragment[] = [];
          let previousHeight = 0;
          for (const line of selected) {
            const currentHeight = this.getUIContext().px2vp(extents.height(recipe.firstLine, line.lineIndex));
            const fragment = new ReadingSurfacePageFragment(
              `chapter-${pending.targetChapterIndex}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
              this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)), line.lineIndex === 0,
              line.startScalar, line.endScalar, undefined, 0, undefined, currentHeight - previousHeight);
            fragment.nativeParagraph = recipe; fragment.nativeParagraphFirst = fragments.length === 0;
            fragments.push(fragment); previousHeight = currentHeight;
          }
          const window = new ReaderNativeTextWindow(this.getUIContext(), this.nativeTextMeasurement.take(paragraph.controller),
            paragraph.controller, this.getUIContext().vp2px(this.measurementTextWidth()), recipe.firstLine, recipe.lastLine);
          this.nativeParagraphResources.set(recipe.key, window, paragraph.layoutMap);
          this.physicalPagination.prependFragments(fragments, selected[0].startScalar,
            height, this.appearanceSnapshot.paragraphSpacing);
        }
      }
      this.nativeTextMeasurement.clear(); this.paragraphLayout.batch.length = 0;
      if (!full && this.preparePreviousMeasurementParagraph()) {
        this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken); return;
      }
      if (!full && this.requireMeasurementLayoutMap().residentStart() > 0) {
        this.expandMeasurementParagraphWindow('before', generation, selectionToken, lifecycleToken); return;
      }
      if (this.physicalPagination.fragments.length === 0) throw new Error('PAGINATION_NO_PREVIOUS_PAGE');
      this.setMeasuringOffset(this.physicalPagination.startScalar);
      this.setMeasuringRequestedAnchor(this.physicalPagination.startScalar);
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) this.fail(error as Error, lifecycleToken);
    }
  }

  private measuredLines(paragraph: MeasurementParagraph, extents: ReaderNativeLineExtents): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const lineCount = manager.getLineCount();
    if (lineCount <= 0) {
      throw new Error('PAGINATION_MEASUREMENT_PENDING');
    }
    const measurementText = this.measurementNodeText(paragraph);
    const measurementMap = measurementText === paragraph.text ? paragraph.layoutMap :
      new ReadingSurfaceLayoutMap(measurementText);
    const requestedLocal = Math.max(0, (paragraph.requestedStartScalar ?? paragraph.chapterStartScalar) - paragraph.chapterStartScalar);
    const requestedUtf16 = measurementMap.utf16ForScalar(requestedLocal);
    return collectForwardMeasuredLines(measurementMap, paragraph.chapterStartScalar, lineCount, requestedUtf16, {
      lineEndUtf16: (index: number): number => manager.getLineMetrics(index).endIndex,
      readLine: (index: number): ArkUILineMetric => this.toLineMetric(manager.getLineMetrics(index)),
      // The predecessor's background catalog pass deliberately enumerates all pages.
      exceedsCapacity: (first: number, last: number): boolean => this.previousChapterMeasurement === undefined &&
        this.getUIContext().px2vp(extents.height(first, last)) > this.pendingPageBodyCapacity(),
      reportOverlap: (index: number, metric: ReadingSurfaceLineMetric, previousEnd: number): void => {
        hilog.error(0x5244, 'Reader',
          'Pagination overlap line=%{public}d start=%{public}d end=%{public}d previousEnd=%{public}d',
          index, metric.startIndex, metric.endIndex, previousEnd);
      },
      reportEmpty: (firstLine: number): void => {
        const last = manager.getLineMetrics(lineCount - 1);
        hilog.error(0x5244, 'Reader',
          'Pagination empty lines=%{public}d first=%{public}d request=%{public}d length=%{public}d lastStart=%{public}d lastEnd=%{public}d lastHeight=%{public}f',
          lineCount, firstLine, requestedUtf16, measurementText.length, last.startIndex, last.endIndex, last.height);
      },
    });
  }

  private measuredPageEndLimit(): number | undefined {
    const draft = this.measuringDraft();
    const key = this.measurementPaginationKey();
    const request = this.measuringRequestedAnchor();
    if (draft !== undefined && draft.matches(key)) {
      const observed = draft.observationForRequest(request) ?? draft.observationForPageStart(request);
      if (observed !== undefined) return observed.endScalarExclusive;
    }
    const indexed = this.physicalPagination.index.findContainingPage(key, request);
    return indexed?.startScalar === request ? indexed.endScalarExclusive : undefined;
  }

  /** A partial document retains the page's original paragraphs and one on
   * either side. Page facts contain only scalar boundaries; navigating back
   * can fetch the missing context again. A giant original paragraph remains
   * whole because shaping a cut paragraph would change its line geometry. */
  private retainMeasuredParagraphWindow(page: PhysicalReadingPage): void {
    const chapter = this.requireMeasurementChapter();
    if (chapter.documentRange === undefined || this.canonicalModeAnchor >= 0) return;
    const retained = projectRetainedReadingParagraphWindow(chapter, this.measuringRanges(),
      page.startScalar, page.endScalar, (): ReadingSurfaceLayoutMap => this.requireMeasurementLayoutMap());
    if (retained !== undefined) {
      this.admitMeasurementParagraphWindow(retained.chapter, retained, this.adjacentMeasurementContext);
    }
  }

  private admitMeasurementParagraphWindow(chapter: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection,
    lane: ReaderMaterializedChapterContext | undefined): void {
    if (lane === undefined) {
      this.chapter = chapter; this.chapterLayoutMap = projection.map; this.paragraphLayout.ranges = projection.ranges;
      this.setCurrentReadingChapter(chapter); this.readingImageResources.indexChapter(chapter);
    } else {
      lane.chapter = chapter; lane.layoutMap = projection.map; lane.paragraphRanges = projection.ranges;
    }
  }

  /** Only missing original-paragraph context may extend a page measurement.
   * The old visible context remains mounted; late expansions own no new view. */
  private expandMeasurementParagraphWindow(direction: 'before' | 'after',
    generation: number, selectionToken: number, lifecycleToken: number): void {
    const chapter = this.requireMeasurementChapter();
    const range = chapter.documentRange;
    if (range === undefined) throw new Error('READING_PARAGRAPH_WINDOW_NOT_PARTIAL');
    const lane = this.adjacentMeasurementContext;
    const pending = this.previousChapterMeasurement;
    const contentOwner = ReaderRuntimeOwner.current();
    const contentCurrent = contentOwner.captureReadingContentValidity(this.sourceId, this.bookId);
    const current = (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) &&
      this.measuringChapter() === chapter && this.adjacentMeasurementContext === lane &&
      this.previousChapterMeasurement === pending;
    this.measurementRun.cancelDeadline();
    this.nativeTextMeasurement.clear(); this.paragraphLayout.batch.length = 0;
    this.batchProcessing = false;
    const mode = readingParagraphBoundaryMode(this.sourceId, this.bookKind);
    void readMeasuredParagraphWindow(this.activeGateway(), chapter, direction === 'before' ? range.startScalar : range.endScalar,
      direction, mode, current, (expanded: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection): void => {
        this.admitMeasurementParagraphWindow(expanded, projection, lane);
        this.measurementCompleting = false;
        this.beginMeasurement(lifecycleToken);
      }, (error: Error): Promise<void> => this.measurementRun.recoverWindow(error, chapter, current, {
        // Adjacent/control preparations retain their original rollback owner.
        mayReload: (): boolean => !contentCurrent() && lane === undefined && pending === undefined &&
          this.pageTurnPreparation === undefined && this.chapterSelection.ticket === undefined,
        offset: (): number => this.measuringOffset(),
        waitForContentIdle: (): Promise<void> => contentOwner.waitForReadingContentIdle(this.sourceId, this.bookId),
        reopen: (offset: number, context: RemoteReadingPositionContext | undefined): Promise<void> => {
          this.chapterWindow.clear();
          this.preparedReadingEntry = undefined;
          return this.openChapter(chapter.chapterIndex, false, lifecycleToken, selectionToken, offset, undefined, false, context);
        },
        selectionActive: (): boolean => this.isSelectionActive(lifecycleToken, selectionToken),
        fail: (failure: Error): void => this.fail(failure, lifecycleToken),
      }));
  }

  /**
   * Core isolates every image as one U+FFFC paragraph. Match that exact
   * scalar interval before consulting ArkUI text metrics; mixed text/image
   * paragraphs are rejected by the projection boundary rather than guessed.
   */
  private readingImageForParagraph(paragraph: MeasurementParagraph): ReadingSessionImage | undefined {
    if (paragraph.text !== '\uFFFC' || paragraph.layoutMap.scalarCount() !== 1) {
      return undefined;
    }
    for (const image of this.requireMeasurementChapter().images) {
      if (image.startScalar === paragraph.chapterStartScalar && image.endScalar === paragraph.chapterStartScalar + 1) {
        return image;
      }
    }
    throw new Error('READING_IMAGE_BLOCK_MISSING');
  }

  private resolvePendingReadingImage(image: ReadingSessionImage, generation: number,
    selectionToken: number, lifecycleToken: number): void {
    this.measurementRun.cancelDeadline();
    const current = (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken);
    const gateway = this.activeGateway();
    void this.readingImageResources.resolvePending(this.requireMeasurementChapter(), image, current, {
      load: (chapter: ReadingSessionChapter, requested: ReadingSessionImage, isCurrent: () => boolean): Promise<ReadingSessionImage> =>
        gateway.resolveReadingImage(chapter, requested, isCurrent),
      admit: (requested: ReadingSessionImage, resolved: ReadingSessionImage): void => {
        this.replaceResolvedReadingImage(requested, resolved);
        this.armMeasurementDeadline(generation, selectionToken, lifecycleToken);
        this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
      },
      fail: (error: Error): void => this.fail(error, lifecycleToken),
    });
  }

  /** Pixel availability cannot own pagination once Core has supplied geometry. */
  private resolvePageImagePixels(chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]): void {
    for (const image of chapter.images) {
      if (image.state === 'pending' && hasKnownReadingImageGeometry(image) && fragments.some(
        (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length === 0 &&
          fragment.startScalar === image.startScalar && fragment.endScalar === image.endScalar))
        this.resolveGeometryImagePixels(chapter, image);
    }
  }

  private imageOwnerCandidates(chapter: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] {
    return [this.chapter, this.adjacentMeasurementContext?.chapter,
      this.preparedPreviousPage?.context.chapter, this.preparedNextPage?.context.chapter,
      this.chapterSelection.origin?.context.chapter, this.chapterSelection.candidate?.context.chapter,
      this.chapterWindow.get(chapter.chapterIndex)];
  }

  private resolveGeometryImagePixels(chapter: ReadingSessionChapter, image: ReadingSessionImage): void {
    this.readingImageResources.resolveGeometry(chapter, image, {
      captureCurrent: (): (() => boolean) => {
        const lifecycle = this.lifecycleToken;
        const contentCurrent = ReaderRuntimeOwner.current().captureReadingContentValidity(chapter.sourceId, chapter.bookId);
        return (): boolean => this.isSessionActive(lifecycle) && contentCurrent() &&
          chapter.sourceId === this.sourceId && chapter.bookId === this.bookId;
      },
      ownerCandidates: (owner: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] => this.imageOwnerCandidates(owner),
      load: (owner: ReadingSessionChapter, requested: ReadingSessionImage, current: () => boolean): Promise<ReadingSessionImage> =>
        this.activeGateway().resolveReadingImage(owner, requested, current),
      ready: (): void => this.flushDeferredReadingImagePixels(),
      fail: (error: Error): void => hilog.error(0x5244, 'Reader', 'Reading image pixels failed: %{private}s', this.errorMessage(error)),
    });
  }

  private replaceFragmentPixels(fragments: ReadingSurfacePageFragment[], image: ReadingSessionImage): boolean {
    if (image.state !== 'ready') return false;
    let changed = false;
    for (let index = 0; index < fragments.length; index += 1) {
      const fragment = fragments[index];
      if (fragment.text.length === 0 && fragment.startScalar === image.startScalar && fragment.endScalar === image.endScalar &&
        (fragment.fileUri !== image.fileUri || fragment.imageSource !== image.pixelMap)) {
        const replacement = new ReadingSurfacePageFragment(fragment.id, fragment.text, fragment.isParagraphStart,
          fragment.startScalar, fragment.endScalar, image.pixelMap, fragment.imageHeight, image.fileUri,
          fragment.layoutHeight, fragment.imageWidthBasisPoints);
        replacement.nativeParagraph = fragment.nativeParagraph;
        replacement.nativeTitle = fragment.nativeTitle;
        replacement.nativeParagraphFirst = fragment.nativeParagraphFirst;
        replacement.continuousSpaceBefore = fragment.continuousSpaceBefore;
        fragments[index] = replacement;
        changed = true;
      }
    }
    return changed;
  }

  private publishGeometryImagePixels(chapter: ReadingSessionChapter,
    owners: ReadingSessionChapter[], image: ReadingSessionImage): boolean {
    const current = sameReadingImageChapter(this.chapter, chapter);
    if (current && this.chapter !== undefined) {
      this.readingImageResources.indexChapter(this.chapter);
      this.setCurrentReadingChapter(this.chapter);
    } else if (owners.length > 0) this.chapterWindow.admitNeighbour(owners[0]);
    let changed = false;
    if (current) {
      const visibleChanged = this.replaceFragmentPixels(this.visibleFragments, image);
      changed = visibleChanged || changed;
      if (this.visiblePage !== undefined) {
        const pageChanged = this.replaceFragmentPixels(this.visiblePage.fragments, image);
        if (visibleChanged || pageChanged) this.visiblePage.fragments = this.visiblePage.fragments.slice();
        changed = pageChanged || changed;
      }
      if (this.readingReadyPage !== undefined && this.replaceFragmentPixels(this.readingReadyPage.fragments, image))
        this.readingReadyPage.fragments = this.readingReadyPage.fragments.slice();
      if (this.replaceFragmentPixels(this.continuousProjection.fragments, image)) {
        this.continuousProjection.republishFragments();
        // ArkUI can coalesce several promises/revisions into one observer
        // delivery. Publish the complete unchanged-geometry projection so an
        // earlier row cannot be lost behind the last changed image index.
        this.continuousChangedFragmentIndex = -1;
        this.continuousRenderRevision += 1; changed = true;
      }
      if (changed) this.visibleFragments = this.visibleFragments.slice();
    }
    for (const prepared of [this.preparedPreviousPage, this.preparedNextPage,
      this.chapterSelection.origin, this.chapterSelection.candidate]) {
      if (prepared !== undefined && sameReadingImageChapter(prepared.context.chapter, chapter) &&
        this.replaceFragmentPixels(prepared.page.fragments, image)) {
        prepared.page.fragments = prepared.page.fragments.slice(); changed = true;
      }
    }
    if (sameReadingImageChapter(this.adjacentMeasurementContext?.chapter ?? this.chapter, chapter))
      this.replaceFragmentPixels(this.physicalPagination.fragments, image);
    this.retainCurrentChapterWindow();
    return changed;
  }

  private flushDeferredReadingImagePixels(): void {
    if (this.pageTurnInputPhase() !== 'idle' || this.pageChromeStateFrozen()) return;
    const changed = this.readingImageResources.flushGeometry(
      (chapter: ReadingSessionChapter): (ReadingSessionChapter | undefined)[] => this.imageOwnerCandidates(chapter),
      (chapter: ReadingSessionChapter, owners: ReadingSessionChapter[], resolved: ReadingSessionImage): boolean =>
        this.publishGeometryImagePixels(chapter, owners, resolved));
    if (changed) {
      this.pageTurnRenderRevision += 1;
      this.bookTurnTexture.invalidate(true);
      this.bookTurnSession.clearCapturedTextures();
      this.scheduleBookTurnTextureRefresh();
    }
  }

  private replaceResolvedReadingImage(requested: ReadingSessionImage, resolved: ReadingSessionImage): void {
    const chapter = this.requireMeasurementChapter();
    const visibleOwner = chapter === this.chapter;
    if (!this.readingImageResources.replacePending(chapter, visibleOwner, requested, resolved)) return;
    if (visibleOwner) this.setCurrentReadingChapter(chapter);
    else this.chapterWindow.admitNeighbour(chapter);
    this.retainCurrentChapterWindow();
  }

  private measurementNodeText(paragraph: MeasurementParagraph): string {
    // The image height is owned by its intrinsic Host measurement. Mount one
    // ordinary glyph only to make the bounded ArkUI controller tree settle;
    // its line geometry is never used for the image block.
    return paragraph.text === '\uFFFC' ? 'A' : paragraph.text;
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

  private toLineMetric(metric: LineMetrics): ArkUILineMetric {
    const context = this.getUIContext();
    // TextController LineMetrics geometry is reported in physical px, while
    // Area, padding, lineHeight and the page capacity in this component are
    // vp. Keeping px here made a 3x-density phone accept only a small fraction
    // of the visible body before declaring the page full.
    return new ArkUILineMetric(
      metric,
      context.px2vp(metric.height),
      context.px2vp(metric.topHeight),
      context.px2vp(metric.width),
      context.px2vp(metric.baseline),
    );
  }

  private beginFirstPageCommit(generation: number, selectionToken: number, lifecycleToken: number): void {
    if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
      return;
    }
    const admission = admitMeasuredPageEnd(this.physicalPagination, {
      residentRange: (): ReadingDocumentRange | undefined => this.measuringChapter()?.documentRange,
      isReverse: (): boolean => this.previousChapterMeasurement !== undefined,
      knownEnd: (): number | undefined => this.measuredPageEndLimit(),
      gapText: (start: number, end: number): string => this.requireMeasurementLayoutMap().sliceByScalar(start, end),
      lastMeasurable: (): number => this.lastMeasurableScalar(),
    });
    if (admission === 'empty') {
      this.fail(new Error('PAGINATION_NO_PHYSICAL_PAGE'), lifecycleToken);
      return;
    }
    if (admission === 'expand-after') {
      this.expandMeasurementParagraphWindow('after', generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.measuredNativeTitle !== undefined && this.measurementIncludesChapterTitle() && this.physicalPagination.fragments.length > 0) {
      this.physicalPagination.fragments[0].nativeTitle = this.measuredNativeTitle;
    }
    const page = new PhysicalReadingPage(
      [...this.physicalPagination.fragments],
      this.physicalPagination.startScalar,
      this.physicalPagination.endScalar,
      this.physicalPagination.height,
      this.pendingPageBodyCapacity(),
      copyReaderAppearanceSnapshot(this.appearanceSnapshot),
    );
    this.observeMeasuredPhysicalPage(page);
    this.retainMeasuredParagraphWindow(page);
    this.nativeTextMeasurement.clear();
    this.paragraphLayout.batch.length = 0;
    this.batchProcessing = false;
    this.measurementCompleting = true;
    this.measurementRun.cancelDeadline();
    // Unmount the hidden controller tree while Core resolves and stores the
    // actual visible scalar anchor.  No subsequent batch exists in memory.
    this.measurementEpoch += 1;
    if (this.pageTurnPreparation !== undefined) {
      this.completePreparedPageTurn(page, generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.previousChapterMeasurement !== undefined) {
      this.continuePreviousChapterMeasurement(page, generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.continueCanonicalModeMeasurement(page, lifecycleToken)) return;
    this.traceInitialReadingPhase?.('first-layout-ready', lifecycleToken);
    this.armFirstPageCompletionDeadline();
    void this.completeFirstPage(page, generation, selectionToken, lifecycleToken);
  }

  private beginCanonicalModeMeasurement(anchor: number): void {
    const key = this.currentPaginationKey();
    const target = Math.max(this.paragraphLayout.ranges[0].startScalar, Math.min(this.lastMeasurableScalar(), anchor));
    const request = canonicalMeasuredPageRequest(this.physicalPagination.index, key,
      (): ReadingPaginationPrefix | undefined => this.physicalPagination.draft,
      (): number => this.paragraphLayout.ranges[0].startScalar, target);
    this.canonicalModeAnchor = request.unresolvedAnchor;
    this.desiredChapterOffset = request.offset;
    this.desiredChapterProgress = this.requireChapterLayoutMap().scalarCount() === 0 ? 0 :
      this.desiredChapterOffset / this.requireChapterLayoutMap().scalarCount();
    this.scheduleCanonicalMeasurement(this.lifecycleToken);
  }

  private continueCanonicalModeMeasurement(page: PhysicalReadingPage, lifecycleToken: number): boolean {
    if (this.canonicalModeAnchor < 0) return false;
    if (page.endScalar <= this.canonicalModeAnchor && page.endScalar <= this.lastMeasurableScalar()) {
      this.desiredChapterOffset = page.endScalar;
      this.desiredChapterProgress = page.endScalar / this.requireChapterLayoutMap().scalarCount();
      this.measurementCompleting = false;
      this.scheduleCanonicalMeasurement(lifecycleToken);
      return true;
    }
    // Intermediate head-prefix pages never publish or persist progress.
    this.canonicalModeAnchor = -1;
    return false;
  }

  private scheduleCanonicalMeasurement(lifecycleToken: number): void {
    const selection = this.chapterSelectionToken;
    const epoch = this.measurementEpoch;
    const generation = this.currentMeasurementGeneration();
    this.canonicalMeasurementContinuation.advance(
      (): boolean => this.isSelectionActive(lifecycleToken, selection) &&
        epoch === this.measurementEpoch && generation === this.currentMeasurementGeneration(),
      (): void => this.beginMeasurement(lifecycleToken));
  }

  /** A reverse measurement has already produced the one exact predecessor.
   * It never promotes a local suffix to a chapter-head manifest. */
  private continuePreviousChapterMeasurement(
    measuredPage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
    if (this.requireMeasurementChapter().chapterIndex !== pending.targetChapterIndex ||
      measuredPage.endScalar !== pending.endScalar) {
      this.recoverPreviousChapterMeasurement(new Error('PREVIOUS_PAGE_BOUNDARY_MISMATCH'), lifecycleToken); return;
    }
    if (pending.prepareOnly) {
      this.completePreviousChapterPreparation(pending, measuredPage); return;
    }
    this.previousChapterMeasurement = undefined;
    this.armFirstPageCompletionDeadline();
    void this.completeFirstPage(measuredPage, generation, selectionToken, lifecycleToken);
  }

  private continuePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    previousChapterIndex: number,
  ): boolean {
    const origin = pending.origin;
    const targetChapter = this.chapterWindow.get(previousChapterIndex);
    if (origin !== undefined && targetChapter === undefined &&
      pending.pageTurnGeneration === this.pageTurnGeneration) {
      this.requestPageTurnChapter('previous', previousChapterIndex);
      this.finishPreviousPagePreparationDiscovery(pending);
      return true;
    }
    const page = this.visiblePage;
    if (origin === undefined || targetChapter === undefined ||
      page === undefined || pending.pageTurnGeneration !== this.pageTurnGeneration) {
      return false;
    }
    this.previousChapterLayoutPreparation = pending;
    const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
    const measurement = this.measurementEpoch, pointer = this.pagePointerEpoch;
    const layoutCurrent = ReaderRuntimeOwner.current().captureReadingContentValidity(this.sourceId, this.bookId);
    const ownerCurrent = (): boolean => pending.pageTurnGeneration === this.pageTurnGeneration &&
      this.isStableVisiblePageOwner(page, origin.chapter, selection, lifecycle) && layoutCurrent();
    const current = (): boolean => this.previousChapterLayoutPreparation === pending && ownerCurrent() &&
      this.measurementEpoch === measurement && this.pagePointerEpoch === pointer &&
      this.canTurnPage() && this.pageTurnInputPhase() === 'idle';
    void prepareReadingChapterLayoutMap(targetChapter, current).then((targetMap: ReadingSurfaceLayoutMap): void => {
      if (!current()) return;
      const latestChapter = this.chapterWindow.get(previousChapterIndex);
      if (latestChapter?.contentVersion !== targetChapter.contentVersion) return;
      if (targetMap.scalarCount() === 0) throw new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_EMPTY');
      this.previousChapterLayoutPreparation = undefined;
      this.admitChapterContentVersion(targetChapter.chapterIndex, targetChapter.contentVersion);
      this.previousChapterMeasurement = new PreviousChapterMeasurement(pending.originalChapterIndex,
        pending.originalChapterOffset, previousChapterIndex, true, origin, pending.pageTurnGeneration);
      this.measurementCompleting = false;
      this.adjacentMeasurementContext = new ReaderMaterializedChapterContext(
        targetChapter, targetMap, targetChapter.contentVersion, [], undefined, 0, 0, -1);
      this.beginMeasurement(lifecycle);
    }).catch((error: Error): void => {
      if (!current()) return;
      this.previousChapterLayoutPreparation = undefined;
      this.previousChapterMeasurement = pending;
      this.recoverPreviousChapterMeasurement(error, lifecycle);
      this.drainPageTurnPreparationQueue();
    }).finally((): void => {
      if (this.previousChapterLayoutPreparation !== pending) return;
      this.previousChapterLayoutPreparation = undefined;
      if (ownerCurrent()) {
        this.pageTurnPreparationQueue.restoreFront('previous');
        this.drainPageTurnPreparationQueue();
      }
    });
    return true;
  }

  private completePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    measuredPage: PhysicalReadingPage,
  ): void {
    const origin = pending.origin;
    if (origin === undefined) return;
    const targetContext = this.captureMeasurementChapterContext();
    const key = this.measurementPaginationKey();
    const prepared = new PreparedReaderPageTurn(
      'previous',
      measuredPage,
      targetContext,
      key,
      pending.originalChapterIndex,
      pending.originalChapterOffset,
      pending.pageTurnGeneration,
    );
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.physicalPagination.index.finishMeasurement();
    this.finishAdjacentMeasurementContext();
    this.phase = 'ready';
    if (pending.pageTurnGeneration === this.pageTurnGeneration) {
      this.preparedPreviousPage = prepared;
      this.pageTurnRenderRevision += 1;
      this.resolvePageImagePixels(targetContext.chapter, measuredPage.fragments);
    }
    this.releaseUnretainedReadingImages();
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
    this.resumePagePreparationAfterTextureFrame();
  }

  private finishPreviousPagePreparationDiscovery(pending: PreviousChapterMeasurement): void {
    const origin = pending.origin;
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.physicalPagination.index.finishMeasurement();
    this.finishAdjacentMeasurementContext();
    this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    this.releaseUnretainedReadingImages();
    this.drainRapidPageTurn();
    this.resumePagePreparationAfterTextureFrame();
  }

  private completePreparedPageTurn(
    page: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    const preparation = this.pageTurnPreparation;
    if (preparation === undefined || preparation.generation !== this.pageTurnGeneration ||
      !this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
      return;
    }
    const targetContext = this.captureMeasurementChapterContext();
    const key = this.measurementPaginationKey();
    const prepared = new PreparedReaderPageTurn(
      preparation.direction,
      page,
      targetContext,
      key,
      preparation.originChapterIndex,
      preparation.originPageStartScalar,
      preparation.generation,
    );
    this.pageTurnPreparation = undefined;
    if (preparation.direction === 'previous') {
      this.preparedPreviousPage = prepared;
    } else {
      this.preparedNextPage = prepared;
    }
    this.finishAdjacentMeasurementContext();
    this.measurementCompleting = false;
    this.physicalPagination.index.finishMeasurement();
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.resolvePageImagePixels(targetContext.chapter, page.fragments);
    this.releaseUnretainedReadingImages();
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
    this.resumePagePreparationAfterTextureFrame();
  }

  private completeFirstPage(
    visiblePage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): Promise<void> {
    return completeReaderFirstPage({
      isCurrent: (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken),
      liveLayoutSignature: (): string => this.paginationLayoutSignature(),
      resumeSuperseded: (signature: string): boolean => this.resumeSupersededAppearanceMeasurement(
        generation, selectionToken, lifecycleToken, signature),
      hasCurrentControlCandidate: (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) &&
        this.chapterSelection.ticket?.selectionToken === selectionToken && this.chapterSelection.candidate !== undefined,
      fail: (error: Error): void => this.fail(error, lifecycleToken),
    }, (layoutSignature: string): ReaderFirstPagePlan => {
      const coreLayout = this.coreLayout();
      const chapter = this.requireChapter();
      const directoryProof = this.directoryJumpProof.forProgress(chapter, selectionToken);
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      const presentation: ReaderMeasuredFirstPagePresentation = {
        page: visiblePage, chapter, progress: scalarCount === 0 ? 0 : visiblePage.startScalar / scalarCount,
        selectionToken, lifecycleToken,
      };
      // An ordinary cold entry already has a completed layout owner and can
      // release input before saving. An explicit directory target must first
      // consume its one-shot proof on the durable path.
      const coldFirstPaint = this.visiblePage === undefined && this.visibleFragments.length === 0 &&
        this.chapterSelection.ticket === undefined && this.sourceSwitchTransactionId === undefined &&
        this.sessionGateway?.hasPendingSourceSwitch?.() !== true;
      const ordinaryTurn = !coldFirstPaint && this.isOrdinaryPageMeasurement(chapter, selectionToken, lifecycleToken);
      this.ordinaryPageMeasurementSelection = -1;
      if (directoryProof === undefined && (coldFirstPaint || ordinaryTurn)) {
        return { kind: 'ordinary', present: (): Promise<void> =>
          this.presentOrdinaryMeasuredFirstPage(presentation, coreLayout, layoutSignature, ordinaryTurn) };
      }
      return {
        kind: 'durable',
        persist: (isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress> => {
          this.chapterSelection.captureCandidate(selectionToken, (): ReaderControlSelectionCandidate =>
            new ReaderControlSelectionCandidate(this.captureMaterializedChapterContext(), visiblePage,
              this.readerSettingsSnapshot.navigationMode === 'continuous', layoutSignature));
          if (this.retainedTtsOwner !== undefined) this.retainedTtsCommitAdmitted = true;
          return this.persistMeasuredCanonicalProgress(this.bookId, chapter.chapterTitle,
            new CoreReadingAnchor(chapter.chapterIndex, visiblePage.startScalar, presentation.progress,
              chapter.bodyVersion, chapter.processingVersion, directoryProof), coreLayout, isAdmitted);
        },
        matchesAnchor: (stored: ReadingSessionCommittedProgress): boolean =>
          stored.bookId === chapter.bookId && stored.chapterIndex === chapter.chapterIndex &&
          stored.chapterOffset === visiblePage.startScalar,
        admitSavedProgress: (stored: ReadingSessionCommittedProgress): void =>
          this.admitCommittedProgress(stored, directoryProof, selectionToken),
        present: (stored: ReadingSessionCommittedProgress): void =>
          this.presentDurableMeasuredFirstPage(presentation, stored, directoryProof),
      };
    });
  }

  private presentOrdinaryMeasuredFirstPage(presentation: ReaderMeasuredFirstPagePresentation,
    coreLayout: CoreReadingLayout, layoutSignature: string, ordinaryTurn: boolean): Promise<void> {
    const page = presentation.page;
    const chapter = presentation.chapter;
    const selectionToken = presentation.selectionToken;
    const lifecycleToken = presentation.lifecycleToken;
    this.publishMeasuredFirstPage(page, chapter, selectionToken);
    this.desiredChapterOffset = page.startScalar;
    this.desiredChapterProgress = presentation.progress;
    this.physicalPagination.index.finishMeasurement();
    this.measurementCompleting = false;
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.phase = 'ready';
    this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
    this.beginReadingRecordClock(lifecycleToken);
    this.finishPageTurnPerf('presented');
    const persistence = this.persistOrdinaryFirstPage(page, chapter, presentation.progress, coreLayout,
      layoutSignature, selectionToken, lifecycleToken, ordinaryTurn);
    if (this.notifyReadingPresentationReady(chapter, page, selectionToken, lifecycleToken))
      this.schedulePageTurnPreparation();
    if (ordinaryTurn) {
      this.notifyControlSelectionReadingReady(chapter.chapterIndex, chapter.chapterTitle,
        page, selectionToken, lifecycleToken);
      this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
      // Native layout can finish inside performPageTurn. Let its caller record the
      // manual/automatic in-flight transaction before notifying completion.
      void Promise.resolve().then((): void => {
        if (!this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken)) return;
        this.completeRapidPageTurnTransaction();
        this.onAutoPagePageCommitted();
        this.drainRapidPageTurn();
        this.resumeDeferredMeasurement(lifecycleToken);
      });
    }
    return persistence;
  }

  private presentDurableMeasuredFirstPage(presentation: ReaderMeasuredFirstPagePresentation,
    stored: ReadingSessionCommittedProgress, directoryProof: ReaderDirectoryTargetProof | undefined): void {
    const page = presentation.page;
    const chapter = presentation.chapter;
    const selectionToken = presentation.selectionToken;
    const lifecycleToken = presentation.lifecycleToken;
    this.traceInitialReadingPhase?.('first-persist', lifecycleToken);
    this.desiredChapterOffset = page.startScalar;
    this.desiredChapterProgress = presentation.progress;
    this.visiblePage = page;
    this.visiblePageSelectionToken = selectionToken;
    this.visibleFragments = page.fragments;
    this.loadingChapterIndex = undefined;
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      this.rebuildContinuousFragments(false, this.continuousChapterCommitScalar(page));
    }
    this.finishRetainedChapterPresentation(lifecycleToken, selectionToken);
    this.releaseUnretainedReadingImages();
    this.showChapterTitle = this.isChapterFirstPageStart(page.startScalar);
    this.phase = 'ready';
    this.beginReadingRecordClock(lifecycleToken);
    this.finishPageTurnPerf('committed');
    this.measurementCompleting = false;
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.chapterTitle = chapter.chapterTitle;
    this.physicalPagination.index.finishMeasurement();
    // The provider's revision must change to replace its initial empty page.
    this.pageTurnRenderRevision += 1;
    this.traceInitialReadingPhase?.('presentation-submit', lifecycleToken);
    this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
    // Publish the final page-turn owner before durable observers can act.
    this.schedulePageTurnPreparation();
    this.admitCommittedProgress(stored, directoryProof, selectionToken);
    this.completeControlSelectionAfterCommit(stored, page, selectionToken, lifecycleToken);
    this.finishFirstPageProgressReady(chapter, page, selectionToken, lifecycleToken);
  }

  private persistMeasuredCanonicalProgress(bookId: string, title: string | undefined,
    anchor: LocalReadingAnchor, layout: CoreReadingLayout,
    isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress> {
    return persistReaderMeasuredProgress(() => this.activeGateway(), bookId, title, anchor, layout, isAdmitted);
  }

  private persistOrdinaryFirstPage(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    chapterProgress: number, layout: CoreReadingLayout, layoutSignature: string,
    selectionToken: number, lifecycleToken: number, presentedTurn: boolean): Promise<void> {
    // The durable owner outlives the component, while the receipt still needs the exact visible owner.
    const current = (): boolean => this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken);
    return this.ordinaryFirstPagePersistence.persist(this.progressProducers,
      (): ReaderProgressProducerIntent => this.progressProducerIntent(chapter,
        new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress,
          chapter.bodyVersion, chapter.processingVersion), layout,
        current, current, (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored)),
      presentedTurn, {
        traceIfReaderCurrent: (): boolean => {
          if (!this.isMountedToken(lifecycleToken) || this.isReaderIdentityCurrent?.() === false) return false;
          this.traceInitialReadingPhase?.('first-persist', lifecycleToken);
          return true;
        },
        isPresentationCurrent: current,
        layoutIsCurrent: (): boolean => layoutSignature === this.paginationLayoutSignature(),
        requestRemeasurement: (): void => {
          if (this.phase !== 'ready' || this.exitRequested) return;
          this.remeasurePending = true;
          this.appearanceReflowInvalidateCurrentLayout = true;
          this.resumeDeferredMeasurement(lifecycleToken);
        },
        ready: (): void => this.finishFirstPageProgressReady(chapter, page, selectionToken, lifecycleToken),
        failed: (error: Error): void => {
          // Keep input available and let exit/content mutation observe the original failed promise.
          hilog.error(0x5244, 'Reader', '%{private}s',
            `ReadingExperience initial progress save failed: ${this.errorMessage(error)}`);
        },
      });
  }

  private finishFirstPageProgressReady(chapter: ReadingSessionChapter, page: PhysicalReadingPage,
    selectionToken: number, lifecycleToken: number): void {
    if (!this.notifyControlSelectionReadingReady(chapter.chapterIndex, chapter.chapterTitle,
      page, selectionToken, lifecycleToken)) return;
    this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
    this.completeRapidPageTurnTransaction();
    this.drainRapidPageTurn();
    this.onAutoPagePageCommitted();
    this.resumeDeferredMeasurement(lifecycleToken);
  }

  private isOrdinaryFirstPagePresentationCurrent(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    selectionToken: number, lifecycleToken: number): boolean {
    return this.isMountedToken(lifecycleToken) && this.isReaderIdentityCurrent?.() !== false &&
      this.visiblePage === page && this.visiblePageSelectionToken === selectionToken &&
      this.chapterSelectionToken === selectionToken &&
      (this.chapter === chapter || this.pageTurnPreparation?.origin.chapter === chapter);
  }

  private async awaitOrdinaryFirstPagePersistence(): Promise<void> {
    // The shared owner reads Core before retrying an unknown/failed write; it
    // may confirm a lost receipt but never blindly overwrites a newer position.
    const lifecycleToken = this.lifecycleToken;
    const selectionToken = this.chapterSelectionToken;
    const page = this.visiblePage;
    const chapter = this.chapter;
    const stored = await this.sessionGateway?.awaitPresentedProgressPersistence();
    if (stored !== undefined && page !== undefined && chapter !== undefined &&
      stored.chapterIndex === chapter.chapterIndex && stored.chapterOffset === page.startScalar &&
      this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken)) {
      this.admitCommittedProgress(stored);
    }
    this.ordinaryFirstPagePersistence.release();
  }

  private publishMeasuredFirstPage(
    visiblePage: PhysicalReadingPage,
    chapter: ReadingSessionChapter,
    selectionToken: number,
  ): void {
    this.visiblePage = visiblePage;
    this.visiblePageSelectionToken = selectionToken;
    this.visibleFragments = visiblePage.fragments;
    this.loadingChapterIndex = undefined;
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      this.rebuildContinuousFragments(false, this.continuousChapterCommitScalar(visiblePage));
    }
    this.finishRetainedChapterPresentation(this.lifecycleToken, selectionToken);
    this.releaseUnretainedReadingImages();
    this.showChapterTitle = this.isChapterFirstPageStart(visiblePage.startScalar);
    this.chapterTitle = chapter.chapterTitle;
    this.pageTurnRenderRevision += 1;
    // This is a model submission, not proof of a compositor-presented frame.
    this.traceInitialReadingPhase?.('presentation-submit', this.lifecycleToken);
  }

  private resumeSupersededAppearanceMeasurement(generation: number, selectionToken: number,
    lifecycleToken: number, measuredLayoutSignature: string): boolean {
    if (!this.isSelectionActive(lifecycleToken, selectionToken) ||
      measuredLayoutSignature === this.paginationLayoutSignature()) return false;
    // Only this exact owner may restart the shared measurement lane. An older
    // rejection after a newer generation started is obsolete, not a new failure.
    if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
      this.cancelFirstPageCompletionDeadline();
      this.firstPageCompletionRetryCount = 0;
      this.measurementCompleting = false;
      this.phase = 'ready';
      this.remeasurePending = true;
      this.appearanceReflowInvalidateCurrentLayout = true;
      this.resumeDeferredMeasurement(lifecycleToken);
    }
    return true;
  }

  /**
   * The only normal exit path. The host invokes the registered request
   * closure; this component serializes Core persistence before it gives route
   * ownership back through `onExit`.
   */
  private requestExit(): void {
    if (this.readerRecoveryRequestCurrent() && !this.controlVisible()) {
      this.retireReaderRecovery();
      return;
    }
    if (this.cancelControlNavigationIntent()) {
      this.controlVerification.backConsumer('pending-navigation', this.latestControlVisualSession);
      return;
    }
    this.invalidateControlBackdrop();
    // Window TYPE_KEYBOARD insets are authoritative. Retained TextInput focus
    // after hiding the IME must not trap subsequent Back events at this layer.
    if (this.isControlInputEnabled() && consumeReaderControlKeyboardBack(
      ReaderWindowCoordinator.metrics(), this.controlKeyboardHost())) {
      this.controlVerification.backConsumer('keyboard', this.latestControlVisualSession);
      return;
    }
    if (this.controlTemporaryLayer.length > 0 && this.controlMotionVisible()) {
      // A temporary child retains Back until its own dismissal callback.
      // In particular an animated selector can still be foreground here.
      this.controlVerification.backConsumer('temporary-layer', this.latestControlVisualSession);
      this.dismissControlTemporaryRevision += 1;
      return;
    }
    // Retarget from the frame currently shown by the local control clock. The
    // semantic host session intentionally lags during a drag/settlement.
    const result = backReaderControlHostSession(this.latestControlVisualSession, this.controlTiming());
    if (result.consumed) {
      this.controlVerification.backConsumer('panel-session', this.latestControlVisualSession);
      this.requestControlSession(result.state, 'system-back');
      return;
    }
    this.controlVerification.backConsumer('reading-route', this.latestControlVisualSession);
    this.beginExit();
  }

  private beginExit(): void {
    const lifecycleToken = this.lifecycleToken;
    if (!this.isSessionActive(lifecycleToken) || this.exitRequested) {
      return;
    }
    this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    this.pendingPointerSegmentReserved = false;
    this.autoPageCoordinator.cancelPendingTurn();
    if (this.pageTurnSettlementActive && this.preparedSettlement.commitStarted && !this.preparedSettlement.commitFinished) {
      this.activeGateway().handoffPendingProgress();
      this.pageTurnPendingExit = false;
      this.releasePageTurnRecoveryInput();
    }
    if (this.pageTurnGestureState.owner === 'bookmark') {
      this.pageTurnPendingExit = true;
      this.retirePagePointer();
      return;
    }
    const inputPhase = this.pageTurnInputPhase();
    if (inputPhase === 'tracking' || inputPhase === 'dragging') {
      // Back wins over an uncommitted page turn, but it must first return the
      // visible sheet to rest. The deferred exit resumes from the rollback
      // completion, so the visible page cannot disappear mid-frame.
      this.pageTurnPendingExit = true;
      const cancelled = cancelReaderPagePan(this.pageTurnGestureState);
      if (cancelled !== this.pageTurnGestureState) {
        this.onReaderPageGestureStateChanged(cancelled);
        // The no-animation actor can finish the rollback synchronously. In
        // that case there is no completion callback to resume this exit.
        if (!this.isSessionActive(lifecycleToken) || this.pageTurnInputPhase() !== 'idle') return;
      }
      this.pageTurnPendingExit = false;
    }
    if (this.pageTurnInputPhase() === 'settling') {
      this.pageTurnPendingExit = true;
      if (this.rollbackUncommittedBookTurnSettlement()) return;
    }
    if (this.pageTurnInputPhase() !== 'idle') {
      this.pageTurnPendingExit = true;
      return;
    }
    this.exitRequested = true;
    this.observeReadingPrefetch?.();
    this.exitAttemptGeneration += 1;
    this.stopReaderTtsAudition();
    this.captureReadingRecordElapsed(false);
    this.staticSessionCapsuleOrigin = undefined;
    this.finishSessionCapsuleMorph();
    this.clearReadingRecordTimer();
    this.autoPageCoordinator.dispose();
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelFirstPageReadyDeadline();
    void this.finishExit(lifecycleToken);
  }

  private async finishExit(lifecycleToken: number): Promise<void> {
    if (!this.isMountedToken(lifecycleToken) || this.exitDelivered) return;
    const exitAttemptGeneration = this.exitAttemptGeneration;
    // Runtime owns every accepted tail before the page can retire. Disk and
    // Native receipts have no place in the navigation dependency chain.
    try { this.readingRecordHost.handoff(); }
    catch (error) { try { hilog.error(0x5244, 'Reader', '%{private}s', `Reading duration handoff: ${this.errorMessage(error as Error)}`); } catch (_) {} }
    const coordinator = this.ttsTransport.coordinator;
    const spoken = coordinator?.captureCompletedProgress();
    try { this.handoffExitProgress(lifecycleToken, spoken); }
    catch (error) { try { hilog.error(0x5244, 'Reader', '%{private}s', `Reading progress handoff: ${this.errorMessage(error as Error)}`); } catch (_) {} }
    if (coordinator !== undefined) {
      // stop() invalidates the transport synchronously; its ordered storage
      // tail remains independent of the mounted page and its route.
      void coordinator.stop('lifecycle').catch((error: Error): void => {
        try { hilog.error(0x5244, 'Reader', '%{private}s', `Reading TTS stop: ${this.errorMessage(error)}`); } catch (_) {}
      });
    }
    if (!this.isMountedToken(lifecycleToken) || exitAttemptGeneration !== this.exitAttemptGeneration || this.exitDelivered) return;
    this.exitDelivered = true;
    // Optional in-memory retention must never become another exit condition.
    try {
      this.retainConfirmedEntryPresentation();
    } catch (error) {
      try { hilog.warn(0x5244, 'Reader', '%{private}s', `Reading entry retention skipped: ${this.errorMessage(error as Error)}`); } catch (_) {}
    }
    this.onExit();
  }

  private handoffExitProgress(lifecycleToken: number, spoken?: ReaderTtsProgressCommit): void {
    const gateway = this.activeGateway();
    gateway.handoffPendingProgress();
    const chapter = this.chapter;
    if (!this.isMountedToken(lifecycleToken) || this.phase !== 'ready' || chapter === undefined) return;
    const continuous = this.readerSettingsSnapshot.navigationMode === 'continuous';
    if (continuous) this.continuousAnchorSampler?.();
    const spokenCurrent = spoken !== undefined && spoken.chapter.sourceId === this.sourceId &&
      spoken.chapter.bookId === this.bookId && spoken.chapter.chapterIndex === chapter.chapterIndex &&
      spoken.chapter.bodyVersion === chapter.bodyVersion && spoken.chapter.processingVersion === chapter.processingVersion;
    const ttsOwnsPosition = this.lastTtsCommittedProgress !== undefined &&
      this.lastTtsCommittedProgress === this.lastCommittedProgress && this.lastTtsCommittedChapter === chapter &&
      this.lastTtsCommittedSelectionToken === this.chapterSelectionToken;
    if (!spokenCurrent && ttsOwnsPosition) return;
    const scalar = spokenCurrent ? spoken.charEnd : continuous ? this.continuousVisibleScalar : this.visiblePage?.startScalar;
    if (scalar === undefined || (!continuous && !spokenCurrent && (this.visiblePage === undefined ||
      !this.isVisiblePageCurrent(this.visiblePage, chapter, this.visiblePageSelectionToken, lifecycleToken)))) return;
    const count = this.requireChapterLayoutMap().scalarCount();
    const offset = Math.max(0, Math.min(count, scalar));
    const committed = this.lastCommittedProgress;
    const samePosition = committed?.sourceId === this.sourceId && committed.bookId === this.bookId &&
      committed.chapterIndex === chapter.chapterIndex && committed.chapterOffset === offset;
    const renewal = samePosition && this.retainedReadingRecencyVisible && this.retainedReadingRecencyReceipt === committed;
    if (samePosition && !renewal) return;
    const anchor = new CoreReadingAnchor(chapter.chapterIndex, offset,
      renewal && committed !== undefined ? committed.chapterProgress : count === 0 ? 0 : offset / count,
      chapter.bodyVersion, chapter.processingVersion);
    if (renewal && committed !== undefined) anchor.retainedProgressReceipt = {
      progressRevision: committed.progressRevision, updatedAt: committed.updatedAt, locationRevision: committed.locationRevision };
    gateway.handoffPresentedProgress(this.bookId, chapter.chapterTitle, anchor, this.coreLayout(),
      committed?.progressRevision === undefined || committed.sourceId !== this.sourceId || committed.bookId !== this.bookId ? undefined :
        { kind: 'restored', progress: committed, progressRevision: committed.progressRevision });
    if (renewal) {
      this.retainedReadingRecencyVisible = false;
      this.retainedReadingRecencyReceipt = undefined;
    }
  }

  private async commitVisiblePage(lifecycleToken: number): Promise<void> {
    if (!this.isMountedToken(lifecycleToken) || this.phase !== 'ready' || this.commitInFlight ||
      this.chapter === undefined || this.visiblePage === undefined) {
      return;
    }
    const page = this.visiblePage;
    const chapter = this.chapter;
    const selectionToken = this.visiblePageSelectionToken;
    if (!this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken)) {
      return;
    }
    const committed = this.lastCommittedProgress;
    const sameCommittedPosition = committed?.sourceId === this.sourceId && committed.bookId === this.bookId &&
      committed.chapterIndex === chapter.chapterIndex && committed.chapterOffset === page.startScalar;
    const renewRetainedReading = sameCommittedPosition && this.retainedReadingRecencyVisible &&
      this.retainedReadingRecencyReceipt === committed;
    if (sameCommittedPosition && !renewRetainedReading) return;
    const commitGeneration = (this.progressCommitGeneration ?? 0) + 1;
    this.progressCommitGeneration = commitGeneration;
    this.commitInFlight = true;
    let progressRequested = false;
    try {
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      const current = (): boolean => this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken) &&
        (!renewRetainedReading || (this.appForeground && this.windowChromeActive && this.isReaderIdentityCurrent?.() !== false &&
          this.retainedReadingRecencyReceipt === committed && this.lastCommittedProgress === committed));
      const anchor = new CoreReadingAnchor(chapter.chapterIndex, page.startScalar,
        renewRetainedReading && committed !== undefined ? committed.chapterProgress : scalarCount === 0 ? 0 : page.startScalar / scalarCount,
        chapter.bodyVersion, chapter.processingVersion);
      if (renewRetainedReading && committed !== undefined) {
        anchor.retainedProgressReceipt = { progressRevision: committed.progressRevision,
          updatedAt: committed.updatedAt, locationRevision: committed.locationRevision };
        anchor.deviceId = await this.readingRecordGateway.currentDeviceId();
      }
      const intent = this.progressProducerIntent(chapter, anchor, this.coreLayout(),
        current, current, (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored));
      progressRequested = true;
      await this.progressProducers.commitVisible(intent);
    } catch (error) {
      if (renewRetainedReading && (!progressRequested || (error instanceof ReaderCoreNotDispatchedError &&
        error.message === 'READING_RETAINED_RECENCY_NOT_DISPATCHED'))) {
        if (this.retainedReadingRecencyReceipt === committed) {
          this.retainedReadingRecencyReceipt = undefined;
          this.retainedReadingRecencyVisible = false;
          this.retainedReadingRecencySkipped = true;
        }
        return;
      }
      // The visible static reading page remains valid. Persistence failures are
      // logged rather than replaced by an unapproved visual state.
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience progress commit failed: ${this.errorMessage(error as Error)}`);
      throw new Error(this.errorMessage(error as Error));
    } finally {
      if (this.isMountedToken(lifecycleToken) && this.progressCommitGeneration === commitGeneration) {
        this.commitInFlight = false;
      }
    }
  }

  /**
   * Persists the first visible continuous fragment as the same canonical
   * Unicode-scalar anchor used by paged reading. Scroll notifications can
   * arrive while Core is writing, so one trailing commit coalesces every
   * intermediate offset without allowing an older position to win.
   */
  private async commitContinuousProgress(lifecycleToken: number): Promise<void> {
    await this.progressProducers.commitContinuous(this.continuousProgressDependencies(lifecycleToken));
  }

  private continuousProgressDependencies(lifecycleToken: number): ReaderContinuousProgressDependencies {
    let capturedIntent: ReaderProgressProducerIntent | undefined = undefined;
    let capturedChapter: ReadingSessionChapter | undefined = undefined;
    let capturedRevision = -1;
    const active = (): boolean => this.isMountedToken(lifecycleToken) && this.phase === 'ready' &&
      this.readerSettingsSnapshot.navigationMode === 'continuous' && this.chapter !== undefined &&
      this.chapterLayoutMap !== undefined && this.continuousProjection.fragments.length > 0;
    return {
      active,
      capture: (): ReaderProgressProducerIntent | undefined => {
        if (!active() || this.chapter === undefined || this.chapterLayoutMap === undefined) return undefined;
        const chapter = this.chapter;
        const selection = this.chapterSelectionToken;
        const scalarCount = this.chapterLayoutMap.scalarCount();
        const scalar = Math.max(0, Math.min(scalarCount, this.continuousVisibleScalar));
        const revision = this.continuousProgressRevision;
        const isOwner = (): boolean => active() && this.chapter === chapter &&
          this.chapterSelectionToken === selection && this.materializedChapterSelectionToken === selection;
        const isCurrent = (): boolean => isOwner() && this.continuousProgressRevision === revision &&
          this.continuousVisibleScalar === scalar;
        capturedChapter = chapter;
        capturedRevision = revision;
        capturedIntent = this.progressProducerIntent(chapter,
          new CoreReadingAnchor(chapter.chapterIndex, scalar, scalarCount === 0 ? 0 : scalar / scalarCount,
            chapter.bodyVersion, chapter.processingVersion),
          this.coreLayout(), isOwner, isCurrent, (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored));
        return capturedIntent;
      },
      newerSample: (intent: ReaderProgressProducerIntent): boolean => capturedIntent === intent &&
        this.chapter === capturedChapter && this.continuousProgressRevision !== capturedRevision,
      completed: (): void => this.onAutoPagePageCommitted(),
      settled: (): void => { this.drainRapidPageTurn(); },
      failed: (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience continuous progress commit failed: ${this.errorMessage(error)}`),
    };
  }

  private progressProducerIntent(chapter: ReadingSessionChapter, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, isOwner: () => boolean, isCurrent: () => boolean,
    publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent {
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const owner = (): boolean => this.sourceId === sourceId && this.bookId === bookId && isOwner();
    const current = (): boolean => owner() && isCurrent();
    return { sourceId, bookId, title: chapter.chapterTitle, anchor, layout, gateway: this.activeGateway(),
      isOwner: owner, isCurrent: current, committed: (): ReadingCommit | undefined => this.lastCommittedProgress,
      publish: (stored: LocalReadingProgress): void => { if (owner()) publish(stored); } };
  }

  private admitCommittedProgress(stored: ReadingSessionCommittedProgress, directoryProof?: ReaderDirectoryTargetProof,
    proofSelection?: number): void {
    if (directoryProof !== undefined && proofSelection !== undefined && this.isSelectionCurrent(proofSelection))
      this.directoryJumpProof.acknowledge(proofSelection, directoryProof, stored.bookId, stored.chapterIndex);
    const commit = new ReadingCommit(
      this.sourceId,
      this.bookId,
      stored.chapterIndex,
      stored.chapterOffset,
      stored.chapterProgress,
      stored.locationRevision,
      stored.updatedAt,
      stored.sourceSwitchTransactionId,
      stored.bodyVersion,
      stored.processingVersion,
      stored.progressRevision,
    );
    this.lastCommittedProgress = commit;
    this.settleReaderRecovery('progress', stored.progressRevision);
    // An acknowledged page/manual/TTS write already renewed this visit.
    this.retainedReadingRecencyReceipt = undefined;
    this.retainedReadingRecencyVisible = false;
    this.retainedReadingRecencySkipped = false;
    try {
      this.onReadingCommitted(commit);
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience committed-progress observer failed: ${this.errorMessage(error as Error)}`);
    }
  }

  private coreLayout(): CoreReadingLayout {
    const layout = this.readingLayout();
    return createCoreReadingLayout(
      layout.viewportWidth,
      layout.viewportHeight,
      readerAppearanceFontScale(this.appearanceSnapshot) * layout.systemFontScale,
      readerAppearanceLineHeight(this.appearanceSnapshot),
    );
  }

  private paginationLayoutSignature(): string {
    const layout = this.readingLayout();
    return createNativeReadingPaginationLayoutSignature(layout, this.appearanceSnapshot, this.nativeBodyPunctuationOverflow);
  }

  private currentPaginationKey(): ReadingPaginationKey {
    const chapter = this.requireChapter();
    if (this.materializedContentVersion.length === 0) {
      throw new Error('READING_CONTENT_VERSION_NOT_READY');
    }
    return {
      sourceId: this.sourceId,
      bookId: this.bookId,
      chapterIndex: chapter.chapterIndex,
      layoutSignature: this.paginationLayoutSignature(),
      contentVersion: this.materializedContentVersion,
    };
  }

  private paginationKeyForChapter(chapterIndex: number): ReadingPaginationKey | undefined {
    const chapter = this.chapterWindow.get(chapterIndex);
    const contentVersion = chapter?.contentVersion ?? this.knownContentVersion(chapterIndex);
    if (contentVersion === undefined) {
      return undefined;
    }
    return {
      sourceId: this.sourceId,
      bookId: this.bookId,
      chapterIndex,
      layoutSignature: this.paginationLayoutSignature(),
      contentVersion,
    };
  }

  private admitChapterContentVersion(chapterIndex: number, contentVersion: string): void {
    for (const known of this.knownContentVersions) {
      if (known.chapterIndex !== chapterIndex) {
        continue;
      }
      if (known.contentVersion !== contentVersion) {
        // A body replacement invalidates every physical layout for that
        // chapter; retaining a versioned but unreachable manifest would hide
        // the fact that the current body has never been measured.
        this.physicalPagination.index.invalidateChapter(this.sourceId, this.bookId, chapterIndex);
        known.contentVersion = contentVersion;
        this.resetPaginationDraft();
      }
      return;
    }
    this.knownContentVersions.push(new KnownReadingContentVersion(chapterIndex, contentVersion));
  }

  private knownContentVersion(chapterIndex: number): string | undefined {
    for (const known of this.knownContentVersions) {
      if (known.chapterIndex === chapterIndex) {
        return known.contentVersion;
      }
    }
    return undefined;
  }

  private retainCurrentChapterWindow(): void {
    const retained = this.chapterWindow.retainedChapterIndexes();
    this.physicalPagination.index.retainChapterWindow(this.sourceId, this.bookId, retained);
    for (let index = this.knownContentVersions.length - 1; index >= 0; index -= 1) {
      if (retained.indexOf(this.knownContentVersions[index].chapterIndex) < 0) {
        this.knownContentVersions.splice(index, 1);
      }
    }
    this.releaseUnretainedReadingImages();
  }

  private releaseUnretainedReadingImages(): void {
    // Retention depends on the current presented/prepared transactions. The
    // lease owner delegates disposal to the original allocator.
    this.readingImageResources.prune((resource: ReadingSessionImage): boolean => this.isReadingImageRetained(resource));
  }

  private isReadingImageRetained(resource: ReadingSessionImage): boolean {
    if (resource.fileUri.length === 0 && resource.pixelMap === undefined) {
      return false;
    }
    const chapterImages = (this.chapter?.images ?? []).concat(this.adjacentMeasurementContext?.chapter.images ?? []);
    // Recovery owns the whole retained display context, not only the currently
    // visible image fragments. A far chapter jump prunes the old chapter window
    // before it commits; released ready PixelMaps cannot be restored later.
    const originImages = (this.chapterSelection.origin?.context.chapter.images ?? [])
      .concat(this.retainedChapterFrame()?.context.chapter.images ?? []);
    const candidateImages = this.chapterSelection.candidate?.context.chapter.images ?? [];
    for (const image of chapterImages.concat(this.chapterWindow.retainedImages(), originImages, candidateImages)) {
      if (sameReaderReadingImageResource(resource, image)) {
        return true;
      }
    }
    const preparedFragments = (this.preparedPreviousPage?.page.fragments ?? [])
      .concat(this.preparedNextPage?.page.fragments ?? []);
    for (const fragment of this.visibleFragments.concat(this.physicalPagination.fragments, preparedFragments)) {
      if ((resource.fileUri.length > 0 && fragment.fileUri === resource.fileUri) ||
        (resource.pixelMap !== undefined && fragment.imageSource === resource.pixelMap)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Admits one exact, continuous sequence of measured physical pages. A run
   * may begin at restore/search/seek so pages measured after that anchor have
   * a real predecessor; only a chapter-head run can become a full manifest.
   * No page boundary before the first observation is inferred.
   */
  private observeMeasuredPhysicalPage(page: PhysicalReadingPage): void {
    if (this.measuringRanges().length === 0 || this.measuringRequestedAnchor() < 0) {
      this.resetMeasurementPaginationDraft();
      return;
    }
    const chapter = this.requireMeasurementChapter();
    const map = this.requireMeasurementLayoutMap();
    const ranges = this.measuringRanges();
    const result = this.physicalPagination.observe(page, {
      key: this.measurementPaginationKey(), requestedAnchor: this.measuringRequestedAnchor(),
      chapterStartRequest: ranges.length === 0 ? undefined : ranges[0].startScalar,
      draft: this.measuringDraft(), previousChapterMeasurement: this.previousChapterMeasurement !== undefined,
      lastVisibleScalar: this.lastVisibleScalar(chapter.content, map), contentScalarLength: map.scalarCount(),
      partialDocument: chapter.documentRange !== undefined,
    });
    this.setMeasuringDraft(result.draft);
    if (result.completed) this.setMeasuringRequestedAnchor(-1);
  }

  private resetPaginationDraft(): void {
    this.physicalPagination.resetDraft();
  }

  private collectParagraphRanges(content: string): void {
    const chapterMap = this.requireMeasurementLayoutMap();
    const ranges = collectReadingParagraphUtf16Ranges(
      content,
      readingParagraphBoundaryMode(this.sourceId, this.bookKind),
    );
    for (const range of ranges) {
      this.appendParagraphRange(range.startUtf16, range.endUtf16, chapterMap);
    }
  }

  private hasContinuousRenderContent(): boolean {
    // Both the mode branch and input overlay must observe the projection's
    // revision even before a continuous child exists. Reading only the plain
    // array length leaves cold restores permanently on the paged fallback.
    return this.continuousRenderRevision >= 0 && this.continuousProjection.fragments.length > 0;
  }

  private continuousRenderFrame(): ReaderContinuousRenderFrame {
    return { chapterIdentity: this.continuousProjection.chapterIdentity,
      chapterIndex: this.continuousProjection.chapterIndex,
      chapterTitle: this.continuousProjection.chapterTitle, geometryKey: this.continuousProjection.geometryKey,
      titleRecipe: this.continuousTitleRecipe, fragments: this.continuousProjection.fragments,
      changedFragmentIndex: this.continuousChangedFragmentIndex, initialFragmentIndex: this.continuousInitialFragmentIndex,
      initialFragmentProgress: this.continuousInitialFragmentProgress, initialAnchorRevision: this.continuousInitialAnchorRevision };
  }

  private rebuildContinuousFragments(preserveExisting: boolean = false, initialScalar?: number): void {
    const chapter = this.chapter;
    const chapterMap = this.chapterLayoutMap;
    if (chapter === undefined || chapterMap === undefined || this.paragraphLayout.ranges.length === 0) {
      this.clearContinuousRenderProjection();
      return;
    }
    const appearance = this.visibleReadingAppearance();
    const context = new ReaderContinuousTextStyleContext(
      (): number => this.measurementTextWidth(), (): UIContext => this.getUIContext(), this.nativeBodyPunctuationOverflow);
    const fragments = this.continuousProjection.project(chapter, this.paragraphLayout.ranges, preserveExisting,
      (startScalar: number): ReadingSessionImage | undefined => this.readingImageResources.atScalar(startScalar),
      (id: string, image: ReadingSessionImage): ReadingSurfacePageFragment =>
        this.materializeContinuousImage(id, image, appearance),
      (id: string, text: string, startScalar: number, endScalar: number): ReadingSurfacePageFragment =>
        materializeReaderContinuousText(id, text, startScalar, endScalar, appearance, context,
          (): ReaderNativeParagraphRecipe | undefined => this.visiblePageSelectionToken === this.chapterSelectionToken ?
            this.visibleFragments.find((visible: ReadingSurfacePageFragment): boolean =>
              visible.nativeParagraph?.startScalar === startScalar && visible.nativeParagraph.text === text)?.nativeParagraph : undefined));
    this.continuousTitleRecipe = materializeReaderContinuousTitle(chapter.chapterTitle, this.measuredNativeTitle,
      appearance, context, (): number => this.readingLayout().titleLineHeightFp);
    this.continuousProjection.commit(chapter, fragments, initialScalar ?? this.continuousVisibleScalar,
      (): string => this.paginationLayoutSignature());
    if (initialScalar !== undefined) {
      this.continuousEntryPositionReady = false;
      this.continuousVisibleScalar = initialScalar;
      const anchor = this.continuousProjection.anchor(initialScalar);
      this.continuousInitialFragmentIndex = anchor.index;
      this.continuousInitialFragmentProgress = anchor.progress;
      this.continuousInitialAnchorRevision += 1;
    }
    this.continuousChangedFragmentIndex = -1;
    this.continuousRenderRevision += 1;
  }

  private materializeContinuousImage(id: string, image: ReadingSessionImage,
    appearance: ReaderAppearanceSnapshot): ReadingSurfacePageFragment {
    return materializeReaderContinuousImage(id, image, appearance, (): number => this.readingLayout().bodyHeight(false),
      (bodyImage: ReadingSessionImage, capacity: number): number => this.scaledReadingImageHeight(bodyImage, capacity));
  }

  private refreshContinuousImageFragment(image: ReadingSessionImage): boolean {
    const index = this.continuousProjection.replaceResolvedImage(this.chapter, image,
      (id: string, resolved: ReadingSessionImage): ReadingSurfacePageFragment =>
        this.materializeContinuousImage(id, resolved, this.visibleReadingAppearance()));
    if (index === undefined) return false;
    this.continuousChangedFragmentIndex = index;
    this.continuousRenderRevision += 1;
    return true;
  }

  private clearContinuousRenderProjection(): void {
    this.continuousEntryPositionReady = false;
    this.continuousProjection.clear();
    this.continuousTitleRecipe = undefined;
    this.continuousChangedFragmentIndex = -1;
    this.continuousRenderRevision += 1;
  }

  private continuousTtsHighlight(_renderRevision: number): ReaderContinuousHighlight | undefined {
    return this.continuousProjection.ttsHighlight(this.ttsState, this.ttsFollowHighlight);
  }

  private appendParagraphRange(
    startUtf16: number,
    endUtf16: number,
    chapterMap: ReadingSurfaceLayoutMap,
  ): void {
    if (endUtf16 <= startUtf16) {
      return;
    }
    // A separator followed only by trailing whitespace is not a measurable
    // paragraph. Keeping it would allow an EOF restore to start a physical
    // page from an empty line.
    const content = this.requireMeasurementChapter().content;
    if (content.substring(startUtf16, endUtf16).trim().length === 0) {
      return;
    }
    const index = this.measuringRanges().length;
    this.measuringRanges().push(new ParagraphRange(
      `paragraph-${index}-${startUtf16}`,
      startUtf16,
      endUtf16,
      chapterMap.scalarForUtf16(startUtf16),
      chapterMap.scalarForUtf16(endUtf16),
    ));
  }

  /** Materialize a bounded group, preserving whole semantic paragraphs.
   * Native shaping owns bidi and grapheme context. A deep anchor selects its
   * containing native line; it must never become a new paragraph start.
   * A giant single paragraph may exceed the batch target: without a qualified
   * platform checkpoint, cutting that text would change its shaping. */
  private prepareNextMeasurementBatch(): boolean {
    const chapter = this.requireMeasurementChapter();
    this.requireMeasurementLayoutMap();
    return this.paragraphLayout.prepareBatch(chapter.content, this.measuringRanges(),
      MAX_MEASUREMENT_BATCH_PARAGRAPHS, MAX_MEASUREMENT_BATCH_UTF16,
      (): void => this.nativeTextMeasurement.clear(),
      (range: ParagraphRange, index: number, text: string, requestedStart: number): MeasurementParagraph =>
        new MeasurementParagraph(`${range.id}:${requestedStart}`, index, text, range.startScalar,
          new ReadingSurfaceLayoutMap(text), new TextController(), true, requestedStart));
  }

  private rangeIndexForOffset(offset: number): number {
    return this.paragraphLayout.rangeIndexForOffset(this.measuringRanges(), offset);
  }

  /**
   * Finds the final non-whitespace Unicode scalar among the already admitted
   * paragraph ranges. This is used only to clamp a stale EOF restore anchor;
   * pagination continues to measure the original Core text and offsets.
   */
  private lastMeasurableScalar(): number {
    return lastMeasurableParagraphScalar(this.requireMeasurementChapter().content,
      this.requireMeasurementLayoutMap(), this.measuringRanges());
  }

  private resetPendingPage(): void {
    this.physicalPagination.resetPage();
  }

  private requireChapterLayoutMap(): ReadingSurfaceLayoutMap {
    if (this.chapterLayoutMap === undefined) {
      throw new Error('READING_LAYOUT_MAP_NOT_READY');
    }
    return this.chapterLayoutMap;
  }

  /**
   * A TextController line range can include the hard newline that ended that
   * line. The visible surface renders every already-measured line as its own
   * Text node, so retaining that terminal delimiter would create an extra
   * blank line. The Core string and scalar map remain untouched.
   */
  private presentationLineText(text: string): string {
    if (text.endsWith('\r\n')) {
      return text.substring(0, text.length - 2);
    }
    if (text.endsWith('\n') || text.endsWith('\r')) {
      return text.substring(0, text.length - 1);
    }
    return text;
  }

  private requireKnownChapter(requested: number | undefined): number {
    if (this.readingTocEntries().length === 0) {
      throw new Error('LOCAL_TOC_EMPTY');
    }
    if (requested === undefined) {
      return this.readingTocEntries()[0].index;
    }
    if (this.chapterWindow.contains(requested)) {
      return requested;
    }
    throw new Error('LOCAL_TOC_CHAPTER_NOT_FOUND');
  }

  private normalizedRequestedChapter(): number | undefined {
    const value = this.requestedChapterIndex;
    if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
      return undefined;
    }
    return value;
  }

  private requireChapter(): ReadingSessionChapter {
    if (this.chapter === undefined) {
      throw new Error('READING_CHAPTER_NOT_LOADED');
    }
    return this.chapter;
  }

  private isChapterFirstPageStart(startScalar: number): boolean {
    return (this.chapter?.documentRange?.startScalar ?? 0) === 0 &&
      this.paragraphLayout.ranges.length > 0 && startScalar === this.paragraphLayout.ranges[0].startScalar;
  }

  private pendingPageBodyCapacity(): number {
    const pageStartScalar = this.physicalPagination.startScalar >= 0 ?
      this.physicalPagination.startScalar : this.measuringRequestedAnchor();
    if (!this.measurementIncludesChapterTitle() || !this.isMeasurementChapterFirstPageStart(pageStartScalar)) {
      return this.readingLayout().bodyHeightAfterTitle(0);
    }
    if (!Number.isFinite(this.measuredChapterTitleHeightVp) || this.measuredChapterTitleHeightVp <= 0) {
      throw new Error('PAGINATION_CHAPTER_TITLE_MEASUREMENT_INVALID');
    }
    return this.readingLayout().bodyHeightAfterTitle(this.measuredChapterTitleHeightVp);
  }

  private measurementTextWidth(): number {
    return this.readingLayout().bodyWidth();
  }

  private effectiveViewportWidth(): number {
    return this.viewportWidth > 0 ? this.viewportWidth :
      (this.expandedLayout ? READER_TABLET_REFERENCE_WIDTH : READER_PHONE_REFERENCE_WIDTH);
  }

  private hasMeasuredViewport(): boolean {
    return this.viewportWidth > 0 && this.viewportHeight > 0;
  }

  private resumeDeferredMeasurement(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken) || !this.remeasurePending) {
      return;
    }
    this.remeasurePending = false;
    if (this.appearanceReflowInvalidateCurrentLayout) {
      // The page that just committed was measured before the Appearance
      // mutation. It may remain visible as a continuity snapshot, but none of
      // its old geometry may seed the new layout's pagination prefix.
      this.resetPaginationDraft();
      this.appearanceReflowInvalidateCurrentLayout = false;
    }
    this.beginMeasurement(lifecycleToken);
  }

  private armMeasurementDeadline(generation: number, selectionToken: number, lifecycleToken: number): void {
    this.measurementRun.armDeadline(
      (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) && !this.measurementCompleting,
      (error: Error): void => this.fail(error, lifecycleToken));
  }

  private ensureFirstPageReadyDeadline(lifecycleToken: number, selectionToken: number): void {
    if (this.visibleFragments.length > 0 || this.phase === 'ready' || this.firstPageReadyDeadlineTimer >= 0) {
      return;
    }
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
  }

  private armFirstPageReadyDeadline(lifecycleToken: number, selectionToken: number): void {
    if (this.visibleFragments.length > 0) {
      return;
    }
    this.cancelFirstPageReadyDeadline();
    const deadlineGeneration = this.firstPageReadyDeadlineGeneration;
    this.firstPageReadyDeadlineTimer = setTimeout((): void => {
      if (deadlineGeneration !== this.firstPageReadyDeadlineGeneration) {
        return;
      }
      this.firstPageReadyDeadlineTimer = -1;
      if (!this.isSelectionActive(lifecycleToken, selectionToken) || this.phase === 'ready' ||
        this.visibleFragments.length > 0) {
        return;
      }
      this.fail(new Error('PAGINATION_FIRST_PAGE_READY_TIMEOUT'), lifecycleToken);
    }, FIRST_PAGE_READY_TIMEOUT_MS);
  }

  private cancelFirstPageReadyDeadline(): void {
    this.firstPageReadyDeadlineGeneration += 1;
    if (this.firstPageReadyDeadlineTimer >= 0) {
      clearTimeout(this.firstPageReadyDeadlineTimer);
      this.firstPageReadyDeadlineTimer = -1;
    }
  }

  private armFirstPageCompletionDeadline(): void {
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionGeneration += 1;
    const generation = this.firstPageCompletionGeneration;
    this.firstPageCompletionDeadlineTimer = setTimeout((): void => {
      this.firstPageCompletionDeadlineTimer = -1;
      if (generation !== this.firstPageCompletionGeneration) return;
      if (!this.mounted || this.exitRequested) return;
      if (this.phase !== 'measuring' || !this.measurementCompleting) return;
      if (this.firstPageCompletionRetryCount >= FIRST_PAGE_COMPLETION_MAX_RETRIES) {
        this.firstPageCompletionRetryCount = 0;
        this.fail(new Error('READING_FIRST_PAGE_COMPLETION_TIMEOUT'), this.lifecycleToken);
        return;
      }
      this.firstPageCompletionRetryCount += 1;
      // Break the suspended completion chain: its isMeasurementCurrent checks
      // compare against the pre-bump generation, so the pending promise
      // becomes inert whenever it eventually returns, and re-measure.
      this.physicalPagination.index.invalidateMeasurement();
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.beginMeasurement(this.lifecycleToken);
      this.armFirstPageCompletionDeadline();
    }, FIRST_PAGE_COMPLETION_DEADLINE_MS);
  }

  private cancelFirstPageCompletionDeadline(): void {
    this.firstPageCompletionGeneration += 1;
    if (this.firstPageCompletionDeadlineTimer >= 0) {
      clearTimeout(this.firstPageCompletionDeadlineTimer);
      this.firstPageCompletionDeadlineTimer = -1;
    }
  }

  private armPageTurnSettlementDeadline(generation: number): void {
    this.preparedSettlement.armDeadline((): void => this.recoverPageTurnSettlementDeadline(generation));
  }

  private recoverPageTurnSettlementDeadline(generation: number): void {
    if (!this.pageTurnSettlementActive || this.pageTurnSettlementGeneration !== generation) return;
    if (this.pageTurnAutomaticStart !== undefined && !this.pageTurnAutomaticStart.started) {
      this.cancelAutomaticPageStart();
      return;
    }
    hilog.warn(0x5244, 'Reader', 'Page turn settlement deadline fired; converging generation %{public}d', generation);
    const action = this.preparedSettlement.deadlineAction({
      terminalReleased: (): boolean => this.bookTurnSession.completedTerminalGeneration() === generation,
      awaitingSlots: (): boolean => this.bookTurnAwaitingSlotCommit,
      slotsCommitted: (): boolean => this.bookTurnSession.committedSlotsGeneration() === generation,
      phase: (): string => this.pageTurnPresentationPhase,
    });
    switch (action) {
      case 'terminal-ack':
        this.onBookTurnNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_TERMINAL_RELEASED, generation, 0));
        return;
      case 'slots-ack':
        this.onBookTurnNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_SLOTS_COMMITTED, generation, 0));
        this.armPageTurnSettlementDeadline(generation);
        return;
      case 'cleanup-surface':
        this.bookTurnSession.releaseTerminalFrame(generation);
        this.bookTurnSession.clearSurface(generation);
        this.requestBookTurn2DFallback(generation);
        return;
      case 'fallback':
        this.requestBookTurn2DFallback(generation);
        return;
      case 'handoff-unknown': {
        const prepared = this.preparedSettlement.prepared;
        if (prepared !== undefined) this.preparedSettlement.handoffUnknown(prepared, this.lifecycleToken, generation);
        return;
      }
      case 'finish-receipt':
        this.pageTurnAnimationFinished = true;
        this.finishPreparedPageTurnSettlement(generation);
        return;
      case 'rollback':
        this.preparedSettlement.discardDestination();
        this.preparedSettlement.releaseCommit();
        this.animatePageTurnRollback();
        return;
      case 'finish-rollback':
        this.finishPageTurnRollback(generation);
        return;
    }
  }

  private effectiveViewportHeight(): number {
    return this.viewportHeight > 0 ? this.viewportHeight :
      (this.expandedLayout ? READER_TABLET_REFERENCE_HEIGHT : READER_PHONE_REFERENCE_HEIGHT);
  }

  private readonly pageGeometry: ReaderPageGeometryHost = new ReaderPageGeometryHost();

  private readingLayout(): ReaderReadingLayoutSnapshot {
    this.readerWindowMetricsRevision;
    if (this.pageTurnSettlementLayout !== undefined) {
      return this.pageTurnSettlementLayout;
    }
    if (this.pageTurnFrozenRevision === this.pageTurnRenderRevision && this.pageTurnFrozenLayout !== undefined) {
      return this.pageTurnFrozenLayout;
    }
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    const metrics = ReaderWindowCoordinator.metrics();
    return this.pageGeometry.readingLayout(width, height, metrics, this.expandedLayout, this.readerSettingsSnapshot,
      this.appearanceSnapshot.pageMarginOffset ?? 0, (): number =>
        Math.max(this.sessionCapsuleMetrics('autoPage').paintHeight, this.sessionCapsuleMetrics('tts').paintHeight),
      (): UIContext => this.getUIContext(), (): string => this.bookTitle, (): string => this.pageChromeClockText);
  }

  private controlLayout(_windowMetricsRevision: number): ReaderControlLayoutSnapshot {
    const metrics = ReaderWindowCoordinator.metrics();
    const held = this.sessionLaunchSourceMinimum;
    if (held?.receipt !== undefined && this.sessionLaunch !== undefined && this.sessionLaunch.ownership !== 'released' &&
      held.generation === this.sessionLaunch.generation && held.receipt.metricsRevision === metrics.revision &&
      this.sessionLaunchSourceLayoutKey === this.sessionLaunchLayoutKey())
      return held.receipt.layout;
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    const committed = this.controlPresentationReceipt;
    if (committed !== undefined && committed.environmentKey === this.controlMinimumEnvironmentKey() &&
      this.controlMinimum.matchesOpen()) return committed.layout;
    return this.controlMinimum.layout(width, height, metrics);
  }

  private controlMinimumIdentity(): string {
    return this.activeControlNavigationIntent()?.identity ?? this.controlMinimumCommittedIdentity();
  }

  private controlMinimumCommittedIdentity(): string { return this.controlNavigation.committedIdentity(); }

  private activeControlNavigationIntent(): ReaderControlNavigationIntent | undefined { return this.controlNavigation.active(); }

  private controlMinimumRequestLocation(): ReaderControlLocation {
    const target = this.activeControlNavigationIntent()?.target;
    if (target !== undefined) return target;
    const location = readerControlContentLocation(this.controlSession);
    const previous = this.controlRequestLocation;
    if (previous !== undefined && previous.level === location.level && previous.module === location.module &&
      previous.form === location.form && previous.directoryTab === location.directoryTab) return previous;
    this.controlRequestLocation = location;
    return location;
  }

  private controlPanelTheme(scheme: string): ReaderControlThemeStyle {
    if (scheme !== this.controlThemeScheme) {
      this.controlThemeScheme = scheme;
      this.controlThemeSnapshot = readerControlThemeStyle(scheme);
    }
    return this.controlThemeSnapshot;
  }

  private controlMinimumOwnerKey(): string { return this.controlNavigation.ownerKey(); }

  private controlMinimumEnvironmentKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    if (this.controlEnvironmentMetrics === metrics && this.controlEnvironmentWidth === width &&
      this.controlEnvironmentHeight === height && this.controlEnvironmentExpanded === this.expandedLayout)
      return this.controlEnvironmentKey;
    this.controlEnvironmentMetrics = metrics;
    this.controlEnvironmentWidth = width;
    this.controlEnvironmentHeight = height;
    this.controlEnvironmentExpanded = this.expandedLayout;
    this.controlEnvironmentKey = JSON.stringify([width, height, this.expandedLayout,
      metrics.densityPixels, metrics.systemFontScale, metrics.windowRect,
      metrics.systemInsets, metrics.cutoutInsets, metrics.gestureInsets, metrics.navigationInsets,
      metrics.keyboardInsets, metrics.keyboardArea, metrics.statusBarRect, metrics.statusBarHeight, metrics.statusBarCutoutRect]);
    return this.controlEnvironmentKey;
  }

  private acceptControlPlaybackProfile(receipt: ReaderControlPlaybackProfileReceipt): void {
    const location = readerControlContentLocation(this.controlSession);
    const module = location.module;
    const metrics = ReaderWindowCoordinator.metrics();
    if ((module !== 'tts' && module !== 'autoPage') || location.level !== 'secondary' ||
      !this.controlMinimumCurrent(this.controlMinimumIdentity()) || !this.controlMinimumReady ||
      !readerControlPlaybackProfileMatches(receipt, module, this.controlMinimumCommittedIdentity(),
        this.controlLayout(this.readerWindowMetricsRevision).minimumKey, metrics.revision)) return;
    const layout = this.controlLayout(this.readerWindowMetricsRevision);
    if (receipt.layout.fullPanelWidth !== layout.fullPanelWidth || receipt.layout.fullPanelHeight !== layout.fullPanelHeight ||
      receipt.layout.quickPanelHeight !== layout.quickPanelHeight || receipt.bounds.fullHeight !== layout.fullPanelHeight ||
      (layout.quickPanelHeight !== undefined && receipt.bounds.quickHeight !== layout.quickPanelHeight) ||
      receipt.bounds.bottomGap !== layout.dockBottomGap) return;
    const previous = this.controlPlaybackProfile;
    if (previous !== undefined && previous.identity === receipt.identity && previous.key === receipt.key &&
      previous.metricsRevision === receipt.metricsRevision && previous.module === receipt.module &&
      previous.data === receipt.data && previous.layout === receipt.layout) return;
    // Non-reactive display receipt only; never feed this back to the provider.
    this.controlPlaybackProfile = receipt;
  }

  private controlMinimumCurrent(identity: string): boolean {
    return this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive &&
      !this.windowChromeOverlayActive && !this.interactionBlocked && !this.controlObscured &&
      this.effectiveViewportWidth() > 0 && this.effectiveViewportHeight() > 0 &&
      identity === this.controlMinimumIdentity();
  }

  private bindControlMinimum(identity: string, measurer: ReaderControlContentMeasurer | undefined,
    profileReader?: ReaderControlMeasuredProfileReader, facts?: ReaderControlModuleFacts, factsGeometryKey?: string): void {
    if (identity !== this.controlMinimumIdentity() || !this.mounted) return;
    this.controlMinimum.bind(identity, measurer, profileReader, (): string => this.controlMinimumEnvironmentKey(),
      facts, factsGeometryKey ?? '');
    this.scheduleControlMinimum();
  }

  private controlMinimumReceiptCurrent(key: string): boolean {
    const committed = this.controlPresentationReceipt;
    if (committed !== undefined) return committed.key === key && committed.identity === this.controlMinimumCommittedIdentity() &&
      committed.environmentKey === this.controlMinimumEnvironmentKey();
    return this.controlMinimum.unprofiledReceiptCurrent(key, (): string => this.controlMinimumIdentity());
  }

  private controlMinimumWindow(): ReaderControlMinimumWindow {
    return { width: this.effectiveViewportWidth(), height: this.effectiveViewportHeight(),
      expanded: this.expandedLayout, metrics: ReaderWindowCoordinator.metrics() };
  }

  private scheduleControlMinimum(): void {
    this.controlMinimum.schedule({
      current: (identity: string): boolean => this.controlMinimumCurrent(identity),
      environment: (): string => this.controlMinimumEnvironmentKey(),
      navigationGeneration: (): number | undefined => this.activeControlNavigationIntent()?.generation,
      location: (): ReaderControlLocation => this.controlMinimumRequestLocation(),
      window: (): ReaderControlMinimumWindow => this.controlMinimumWindow(),
      postFrame: (run: () => void): void => this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(run)),
      onPending: (): void => {
        // A committed current geometry remains usable until an owner/environment change or a new commit.
        if (this.controlPresentationReceipt === undefined) this.controlMinimumReady = false;
      },
      onUnavailable: (identity: string): void => {
        this.controlFontOrder.unavailable(identity);
      },
      canAdoptFacts: (facts: ReaderControlModuleFacts, identity: string, environment: string): boolean => {
        const previous = this.controlPresentationReceipt;
        return previous !== undefined && previous.identity === identity && previous.environmentKey === environment &&
          readerControlModuleFactsMatch(facts, previous.profile.module);
      },
      adoptFacts: (facts: ReaderControlModuleFacts): void => this.adoptControlDisplayFacts(facts),
      admit: (candidates: ReaderControlCandidateMinimum[], identity: string): void => this.admitControlMinimum(candidates, identity),
    });
  }

  private adoptControlDisplayFacts(facts: ReaderControlModuleFacts | undefined): void {
    const previous = this.controlPresentationReceipt;
    if (previous === undefined) return;
    const updated = adoptReaderControlPresentationFacts(previous, facts);
    if (updated !== previous) this.controlPresentationReceipt = updated;
    this.controlFontOrder.reconcile();
    if (this.controlPage() === 'quickReplace') this.prepareControlReplacePage();
  }

  private admitControlMinimum(candidates: ReaderControlCandidateMinimum[], identity: string): void {
    const admission = this.controlMinimum.prepareAdmission<ReaderControlPresentationReceipt>(candidates, identity, {
      current: (target: string): boolean => this.controlMinimumCurrent(target),
      environment: (): string => this.controlMinimumEnvironmentKey(),
      inputIdle: (): boolean => this.pageTurnInputPhase() === 'idle',
      location: (): ReaderControlLocation => this.controlMinimumRequestLocation(),
      window: (): ReaderControlMinimumWindow => this.controlMinimumWindow(),
      matchesProfile: readerControlPresentationProfileMatches,
      previousReceipt: (): ReaderControlPresentationReceipt | undefined => this.controlPresentationReceipt,
      sameGeometry: (previous: ReaderControlPresentationReceipt, target: string, environment: string,
        layout: ReaderControlLayoutSnapshot, profile: ReaderControlMeasuredProfile): boolean =>
        previous.identity === target && previous.environmentKey === environment &&
        readerControlPresentationGeometryMatches(previous, layout, profile),
    });
    if (admission.kind === 'ignored') return;
    if (admission.kind === 'unavailable') {
      this.controlFontOrder.unavailable(identity);
      return;
    }
    if (admission.kind === 'reuse') {
      this.controlMinimumReady = true;
      this.controlMinimum.commitFacts();
      this.adoptControlDisplayFacts(admission.profile.moduleFacts);
      return;
    }
    let preparedPage: ReaderControlPage | undefined = undefined;
    let nextReceipt: ReaderControlPresentationReceipt | undefined = undefined;
    if (admission.kind === 'new-profile') {
      const location = admission.location;
      nextReceipt = readerControlPresentationReceipt(identity, this.controlMinimumOwnerKey(), admission.environment,
        location, admission.layout, admission.profile);
      const navigation = this.controlNavigation.prepareCommit();
      if (navigation !== undefined) {
        const previousModule = this.observedControlModule;
        this.controlModuleVisitRevision = navigation.intent.moduleVisitRevision;
        this.observedControlModule = location.level === 'secondary' ? location.module : 'home';
        this.controlNavigationIntent = undefined;
        this.controlVerification.accept(navigation.intent.verificationOrigin, navigation.source, navigation.session, this.controlOpenRevision);
        this.controlSession = navigation.session;
        if (previousModule !== this.observedControlModule) preparedPage = this.controlPage();
      }
      this.controlMinimum.commitFacts();
    }
    this.lastControlStructureKey = this.currentControlStructureKey();
    this.controlMinimum.commitCandidates(candidates, (): number => this.effectiveViewportWidth(),
      (): number => this.effectiveViewportHeight(), (): number => ReaderWindowCoordinator.metrics().revision);
    this.controlMinimumRevision += 1;
    this.controlMinimumReady = candidates.length > 0;
    // Receipt observers can synchronously read the accepted layout and publish the launch source.
    if (nextReceipt !== undefined) this.controlPresentationReceipt = nextReceipt;
    this.controlFontOrder.reconcile();
    this.invalidateControlBackdrop();
    if (preparedPage !== undefined) this.prepareControlPage(preparedPage);
    else if (this.controlPage() === 'quickReplace') this.prepareControlReplacePage();
  }

  private windowMetricsLayoutKey(): string {
    const layout = this.readingLayout();
    return createReaderWindowMetricsLayoutKey(
      layout,
      this.readerSettingsSnapshot.extendIntoCutout,
      this.readerSettingsSnapshot.hideNavigationBar,
    );
  }

  private readerSystemGestureLeftInset(): number {
    this.readerWindowMetricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(16, this.finiteWindowInset(metrics.gestureInsets.left),
      this.finiteWindowInset(metrics.navigationInsets.left));
  }

  private readerSystemGestureRightInset(): number {
    this.readerWindowMetricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(16, this.finiteWindowInset(metrics.gestureInsets.right),
      this.finiteWindowInset(metrics.navigationInsets.right));
  }

  private readerSystemGestureBottomInset(): number {
    this.readerWindowMetricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(24, this.finiteWindowInset(metrics.gestureInsets.bottom),
      this.finiteWindowInset(metrics.navigationInsets.bottom));
  }

  private finiteWindowInset(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private normalizedProgress(value: number): number {
    return normalizeReadingProgressRatio(value);
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      // Physical-device Area callbacks may expose a concrete vp length as a
      // string (for example `365.71vp`). Dropping that value leaves pagination
      // on the 390x844 Figma fallback and produces page boundaries that do not
      // match the actual touch surface.
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  // Local books use Core's exact processed-scalar aggregate. Remote sessions
  // deliberately use TOC position + current chapter progress: exact unopened
  // body lengths do not exist yet, and the reader must not download the whole
  // book merely to paint a control percentage.
  private controlProgress(): number {
    const metrics = this.contentMetrics;
    if (metrics !== undefined) {
      return this.contentMetricIndex.percent(
        metrics,
        this.currentChapterIndex(),
        this.desiredChapterOffset,
      );
    }
    if (this.entryCatalogPending && this.entryCatalogNavigation === undefined) return 0;
    const count = this.entryCatalogNavigation?.readableChapterCount ?? this.readingTocEntries().length;
    if (count === 0) {
      return 0;
    }
    const position = this.readableChapterPosition(this.currentChapterIndex());
    if (position >= 0) {
      return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX,
        ((position + this.normalizedProgress(this.desiredChapterProgress)) / count) *
        READER_CONTROL_PROGRESS_MAX));
    }
    return 0;
  }

  /** Build page-owned chrome from the exact page anchor, never from mutable desired progress. */
  private pageChromeSnapshot(
    chapterIndex: number,
    pageStartScalar: number,
    chapterScalarCount: number,
    key: ReadingPaginationKey | undefined,
    prefix: ReadingPaginationPrefix | undefined,
  ): ReaderPageChromeSnapshot {
    const sessionVisible = this.shouldShowSessionCapsule();
    const chapterTitle = this.pageChromeChapterTitle(chapterIndex);
    return new ReaderPageChromeSnapshot(
      this.bookTitle,
      this.pageChromeClockText,
      chapterTitle.length > 0 ? chapterTitle : '—',
      this.entryCatalogPending && this.entryCatalogNavigation === undefined && this.contentMetrics === undefined ? '—' : formatReaderPageProgress(this.pageChromeProgress(
        chapterIndex,
        pageStartScalar,
        chapterScalarCount,
      )),
      sessionVisible,
      sessionVisible ? this.activeSessionCapsuleWidth() : 0,
      sessionVisible ? this.activeSessionCapsuleHeight() : 0,
    );
  }

  /** Resolve the chapter title from the page-owned anchor, not mutable desired state. */
  private pageChromeChapterTitle(chapterIndex: number): string {
    if (this.chapter !== undefined && this.chapter.chapterIndex === chapterIndex &&
      this.chapter.chapterTitle.length > 0) {
      return this.chapter.chapterTitle;
    }
    const entry = this.readingTocEntries().find((candidate: LocalReadingTocEntry): boolean =>
      candidate.index === chapterIndex);
    if (entry?.title !== undefined && entry.title.length > 0) return entry.title;
    return this.chapter !== undefined && this.chapter.chapterIndex === chapterIndex ? this.chapterTitle : '';
  }

  private pageChromePaginationKey(
    chapterIndex: number,
    contentVersion: string,
  ): ReadingPaginationKey | undefined {
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0 || contentVersion.length === 0) {
      return undefined;
    }
    return {
      sourceId: this.sourceId,
      bookId: this.bookId,
      chapterIndex,
      layoutSignature: this.paginationLayoutSignature(),
      contentVersion,
    };
  }

  private pageChromeOrdinal(
    key: ReadingPaginationKey | undefined,
    pageStartScalar: number,
    prefix: ReadingPaginationPrefix | undefined,
  ): ReaderPageOrdinal | undefined {
    if (key === undefined || !Number.isSafeInteger(pageStartScalar) || pageStartScalar < 0) {
      return undefined;
    }
    if (prefix?.matches(key) === true && prefix.observationForPageStart(pageStartScalar) !== undefined &&
      !prefix.isCanonicalPrefixForChapterStart(0)) return undefined;
    const page = this.physicalPagination.index.findContainingPage(key, pageStartScalar);
    const last = this.physicalPagination.index.findLastPage(key);
    if (page !== undefined && last !== undefined) {
      return new ReaderPageOrdinal(page.pageIndex, last.pageIndex + 1);
    }
    if (prefix === undefined || !prefix.matches(key) || !prefix.isCanonicalPrefixForChapterStart(0)) {
      return undefined;
    }
    const pageIndex = prefix.pageIndexAtOrBefore(pageStartScalar);
    return pageIndex >= 0 ? new ReaderPageOrdinal(pageIndex) : undefined;
  }

  private pageChromeProgress(
    chapterIndex: number,
    pageStartScalar: number,
    chapterScalarCount: number,
  ): number {
    if (chapterIndex < 0 || pageStartScalar < 0) {
      return 0;
    }
    if (this.contentMetrics !== undefined) {
      return this.contentMetricIndex.percent(this.contentMetrics, chapterIndex, pageStartScalar);
    }
    if (this.entryCatalogPending && this.entryCatalogNavigation === undefined) return 0;
    const count = this.entryCatalogNavigation?.readableChapterCount ?? this.readingTocEntries().length;
    if (count === 0) {
      return 0;
    }
    const position = this.readableChapterPosition(chapterIndex);
    if (position < 0) {
      return 0;
    }
    const chapterProgress = chapterScalarCount > 0 ?
      this.normalizedProgress(pageStartScalar / chapterScalarCount) : 0;
    return ((position + chapterProgress) / count) * READER_CONTROL_PROGRESS_MAX;
  }

  private currentChapterIndex(): number {
    return this.chapter === undefined ? -1 : this.chapter.chapterIndex;
  }

  private controlDirectoryEntries(): LocalReadingTocEntry[] {
    const entries = this.controlDirectorySourceEntries();
    const chapter = this.chapter;
    const map = this.chapterLayoutMap;
    if (chapter === undefined || map === undefined) return entries;
    if (this.bookmarkExcerptSource === entries && this.bookmarkExcerptChapter === chapter) {
      return this.bookmarkExcerptProjection;
    }
    this.bookmarkExcerptSource = entries;
    this.bookmarkExcerptChapter = chapter;
    this.bookmarkExcerptProjection = entries;
    const projection = projectReaderChapterBookmarkExcerpts(entries, chapter.chapterIndex,
      (mark: LocalReadingBookmark): boolean => this.bookmarkMatchesCurrentChapter(mark),
      (mark: LocalReadingBookmark): string | undefined => this.controlDirectoryBookmarkExcerpt(chapter, map, mark));
    if (projection !== entries) this.bookmarkExcerptProjection = projection;
    return projection;
  }

  private publishControlDirectoryData(sourceChanged: boolean = false): void {
    if (sourceChanged) {
      this.controlDirectorySourceRevision += 1;
      this.controlDirectoryParentSource = undefined;
      this.bookmarkExcerptSource = undefined;
    }
    if (!this.controlDirectoryDataRetained) return;
    this.controlDirectoryEntriesRevision = this.controlDirectoryPublication.publish(
      this.controlDirectoryEntries(), this.controlDirectorySourceRevision);
  }

  private controlDirectoryBookmarkExcerpt(chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap,
    mark: LocalReadingBookmark): string | undefined {
    if (mark.chapterOffset >= map.scalarCount() || !map.containsScalar(mark.chapterOffset) ||
      !map.containsScalar(Math.min(map.scalarCount(), mark.chapterOffset + 160))) return undefined;
    const key = JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex,
      chapter.contentVersion, mark.time, mark.chapterOffset]);
    let excerpt = this.bookmarkExcerptCache.get(key);
    if (excerpt === undefined) {
      excerpt = chapter.content.substring(map.utf16ForScalar(mark.chapterOffset),
        map.utf16ForScalar(Math.min(map.scalarCount(), mark.chapterOffset + 160)));
      if (this.bookmarkExcerptCache.size >= 128) {
        for (const oldest of this.bookmarkExcerptCache.keys()) { this.bookmarkExcerptCache.delete(oldest); break; }
      }
      this.bookmarkExcerptCache.set(key, excerpt);
    }
    return excerpt;
  }

  private controlDirectoryCatalogPosition(): number {
    const navigation = this.entryCatalogNavigation;
    if (navigation === undefined) return -1;
    return readerEntryNavigationItem(navigation, this.currentChapterIndex())?.position ?? -1;
  }

  private bookmarkMatchesCurrentChapter(mark: LocalReadingBookmark): boolean {
    if (this.sourceId === LOCAL_READING_SOURCE_ID) return true;
    const chapter = this.chapter;
    const scope = mark.positionScope;
    return chapter !== undefined && scope !== undefined &&
      scope.sourceId === chapter.sourceId && scope.bookId === chapter.bookId &&
      scope.chapterIndex === chapter.chapterIndex && mark.chapterIndex === chapter.chapterIndex &&
      scope.bodyVersion === chapter.bodyVersion && scope.processingVersion === chapter.processingVersion;
  }

  private controlDirectorySourceEntries(): LocalReadingTocEntry[] {
    if (this.entryCatalogPending) return this.tocEntries;
    // Parent-owned bookmark/download projections can lag after a runtime
    // conversion switch. Prefer the current session's Core-projected title
    // while retaining the parent's marker and offline state.
    if (this.directoryEntries.length === 0) {
      return this.tocEntries;
    }
    // Detail admission and the initial reader share the exact validated TOC.
    // Preserve that identity so the common path does not rebuild an equal
    // Map plus one projected object per chapter merely for Reader Control.
    if (this.tocEntries === this.directoryEntries) {
      return this.directoryEntries;
    }
    if (this.controlDirectoryParentSource === this.directoryEntries &&
      this.controlDirectoryTocSource === this.tocEntries) {
      return this.controlDirectoryProjection;
    }
    const projection = projectReaderControlDirectoryTitles(this.directoryEntries, this.tocEntries);
    this.controlDirectoryParentSource = this.directoryEntries;
    this.controlDirectoryTocSource = this.tocEntries;
    this.controlDirectoryProjection = projection;
    return projection;
  }

  private scheduleTtsPresentationWarmup(): void {
    if (!this.isSessionActive(this.lifecycleToken) || this.phase !== 'ready') return;
    this.ttsPreparation.scheduleWarmup(this.ttsTransport.coordinator !== undefined, (): ReaderTtsWarmupOwner => {
      const lifecycleToken = this.lifecycleToken;
      const sourceId = this.sourceId;
      const bookId = this.bookId;
      return {
        postFrame: (callback: () => void): void => this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(callback)),
        isMounted: (): boolean => this.isMountedToken(lifecycleToken) && sourceId === this.sourceId && bookId === this.bookId,
        isReady: (): boolean => this.isSessionActive(lifecycleToken) && this.phase === 'ready',
        initialize: (): Promise<boolean> => this.initializeTtsSession(lifecycleToken),
      };
    });
  }

  private initializeTtsSession(lifecycleToken: number, retry: boolean = false): Promise<boolean> {
    return this.ttsPreparation.initialize(retry, (): boolean => this.isSessionActive(lifecycleToken),
      (): ReaderTtsPreparationIntent => this.bindTtsPreparation(lifecycleToken));
  }

  private bindTtsPreparation(lifecycleToken: number): ReaderTtsPreparationIntent {
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const isOwnerCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId;
    const owner = ReaderRuntimeOwner.current();
    const coordinator = this.ttsTransport.attach(owner, {
      current: isOwnerCurrent,
      commitProgress: async (progress: ReaderTtsProgressCommit): Promise<void> => this.commitTtsProgress(progress, lifecycleToken),
      publishState: (state: ReaderTtsState): void => this.publishTtsState(state),
      advanceChapter: async (chapter: ReaderTtsChapterRef): Promise<ReaderTtsChapterAdvanceInput | undefined> =>
        this.loadNextTtsChapter(chapter, lifecycleToken),
      changeRate: (rate: number): void => this.changeTtsRate(rate),
      autoPageActive: (): boolean => this.automaticReadingState().status !== 'stopped',
      userPaused: (): boolean => this.ttsState.pauseReason === 'user',
      stopAutoPage: (): void => this.stopAutoPage(),
    });
    this.requireTtsConfigurationHost();
    return {
      probe: coordinator,
      isCurrent: (): boolean => isOwnerCurrent() && this.ttsTransport.coordinator === coordinator,
      loadMetadata: (): Promise<void> => this.loadTtsPresentationMetadata(owner, coordinator, lifecycleToken),
      admitConfig: (config: ReaderTtsConfig | undefined): void => {
        this.ttsConfig = config;
        this.ttsEngine = config?.engine ?? 'system';
        this.ttsConfigurationHost?.admitInitialConfig(config);
      },
      reportFailure: (stage: 'initial-rate' | 'initialization', error: Error): void => this.logTtsFailure(stage, error),
    };
  }

  private publishTtsState(state: ReaderTtsState): void {
    const wasAwake = this.ttsWindowAwakeRequested();
    this.ttsState = state;
    this.observeReadingPrefetch?.();
    this.reconcileTtsWindowAwake(wasAwake);
    this.followTtsPage?.(state);
    this.onSessionLaunchTtsState(state);
  }

  private loadTtsPresentationMetadata(owner: ReaderRuntimeOwner, coordinator: ReaderTtsSessionCoordinator,
    lifecycleToken: number): Promise<void> {
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) && this.ttsTransport.coordinator === coordinator &&
      sourceId === this.sourceId && bookId === this.bookId;
    return this.ttsPreferences.refreshMetadata(isCurrent,
      (): Promise<void> => this.requireTtsConfigurationHost().refreshMetadata(),
      (): Promise<ReaderTtsVoiceOption[]> => owner.getTtsHost().listSystemVoices(),
      (message: string): void => hilog.error(0x5244, 'Reader', '%{private}s', message));
  }

  private admitTtsPreferences(input: ReaderTtsPreferenceAdmission, current: () => boolean): void {
    const preferences = input.preferences;
    const wasAwake = this.ttsWindowAwakeRequested();
    const followedHighlight = this.ttsFollowHighlight;
    const language = input.language;
    const person = input.person;
    this.ttsVoiceOptions = input.voices;
    if (!this.ttsPreferences.voiceChangePending()) {
      this.ttsLanguage = language;
      this.ttsPerson = person;
    }
    this.ttsPauseOnInterruption = preferences.pauseOnInterruption;
    if (!this.ttsPreferences.mixingChangePending()) this.ttsAllowMixing = preferences.allowMixing;
    this.ttsBackgroundPlayback = preferences.backgroundPlayback;
    this.ttsKeepScreenOn = preferences.keepScreenOn;
    this.ttsFailurePolicy = preferences.failurePolicy;
    this.ttsFollowHighlight = preferences.followHighlight;
    if (followedHighlight !== preferences.followHighlight) {
      if (!preferences.followHighlight) this.invalidateTtsPageFollow?.();
      else this.followTtsPage?.(this.ttsState);
    }
    this.ttsTransport.coordinator?.setPauseOnInterruption(preferences.pauseOnInterruption);
    this.ttsTransport.coordinator?.setBackgroundPlayback(preferences.backgroundPlayback);
    if (!preferences.backgroundPlayback && !this.appForeground) void this.ttsTransport.coordinator?.pauseForBackground()
      .catch((error: Error): void => { if (current()) this.logTtsFailure('background pause', error); });
    if (!this.ttsPreferences.mixingChangePending()) void this.ttsTransport.coordinator?.setAllowMixing(preferences.allowMixing)
      .catch((error: Error): void => { if (current()) this.logTtsFailure('audio-session', error); });
    this.ttsTransport.coordinator?.setFailurePolicy(preferences.failurePolicy);
    if (!this.ttsPreferences.voiceChangePending()) {
      this.ttsTransport.coordinator?.setVoiceForNextSpeech(language, person,
        (): boolean => current() && this.ttsLanguage === language && this.ttsPerson === person);
      if (input.repairedVoice) this.ttsPreferences.accept({ voice: { language, person } });
    }
    this.reconcileTtsWindowAwake(wasAwake);
  }

  private captureTtsPreferenceOwner(): () => boolean {
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const coordinator = this.ttsTransport.coordinator;
    return (): boolean => this.isSessionActive(lifecycleToken) && sourceId === this.sourceId && bookId === this.bookId &&
      coordinator === this.ttsTransport.coordinator;
  }

  /** Retire only starts that have not crossed the coordinator dispatch boundary.
   * An accepted stop/start ACK and intentional background playback keep their owner. */
  private retirePendingPlaybackStarts(): void {
    const ttsPending = this.ttsPlayback.startPending();
    const autoPagePending = this.autoPageCoordinator.pendingStart();
    if (ttsPending) this.ttsPlayback.cancelPending();
    if (autoPagePending) this.cancelPendingAutoPageStart();
    const launch = this.sessionLaunch;
    if (launch?.ownership === 'stage' && launch.businessStatus === 'preparing' &&
      ((launch.geometry.type === 'tts' && ttsPending) || (launch.geometry.type === 'autoPage' && autoPagePending))) {
      // The input owner has left; it cannot receive a failed-start handoff.
      this.cancelSessionLaunch('leave');
    }
  }

  private captureControlPlaybackPresentation(): ReaderControlPlaybackPresentation {
    const location = readerControlContentLocation(this.controlSession);
    return { lifecycleToken: this.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId,
      openRevision: this.controlOpenRevision, moduleVisitRevision: this.controlModuleVisitRevision,
      module: location.level === 'secondary' ? location.module : 'home' };
  }

  private isControlPlaybackPresentationCurrent(presentation: ReaderControlPlaybackPresentation,
    module: string): boolean {
    const location = readerControlContentLocation(this.controlSession);
    return this.isSessionActive(presentation.lifecycleToken) &&
      presentation.sourceId === this.sourceId && presentation.bookId === this.bookId &&
      // During a capsule morph the control host is intentionally hidden at
      // capture start; the morph generation itself owns presentation validity.
      (this.controlVisible() || this.sessionLaunch !== undefined) &&
      !(this.controlShellExitArmed() && this.sessionLaunch === undefined) &&
      presentation.openRevision === this.controlOpenRevision &&
      presentation.moduleVisitRevision === this.controlModuleVisitRevision &&
      presentation.module === module && location.level === 'secondary' && location.module === module;
  }

  private toggleTts(): void { this.ttsPlayback.toggle(); }

  private beginTtsStartCapsule(): boolean {
    if (this.phase !== 'ready' || this.chapter === undefined || this.visiblePage === undefined) return false;
    if (this.controlVerification.observing()) {
      const facts: ReaderControlSpeechAvailability = {
        resolved: this.ttsPreparation.resolved(), engine: this.ttsEngine, status: this.ttsState.status,
      };
      this.controlVerification.effect('capsule-launch', 'tts-availability', facts);
    }
    return !this.beginSessionCapsuleMorph('tts');
  }

  private captureTtsPauseWitness(): ReaderTtsPauseWitness | undefined {
    const launch = this.sessionLaunch;
    const speechGeneration = this.ttsState.sessionGeneration;
    if (launch?.geometry.type !== 'tts' || !this.controlVerification.observing()) return undefined;
    return {
      speechGeneration,
      confirm: (): void => {
        const current = this.sessionLaunch;
        if (current?.generation !== launch.generation || current.ownership !== 'stage' || current.desiredPlaying) return;
        this.capsuleVerification.ownerState('tts-pause-confirmed', current, this.sessionLaunchSpeechFacts(current));
      },
    };
  }

  private showAcknowledgedStaticTtsCapsule(presentation: ReaderControlPlaybackPresentation): void {
    if (this.sessionLaunch === undefined && this.readerInputIsCurrent() && !this.windowChromeOverlayActive &&
      this.isControlPlaybackPresentationCurrent(presentation, 'tts')) this.hideControlForStaticSessionCapsule('tts');
  }

  private ttsStartPage(): ReaderTtsStartPage | undefined {
    const chapter = this.chapter;
    const page = this.visiblePage;
    if (!this.mounted || this.phase !== 'ready' || chapter === undefined || page === undefined ||
      this.materializedContentVersion.length === 0) return undefined;
    return { chapter, startScalar: page.startScalar };
  }

  private ttsStartInput(page: ReaderTtsStartPage): ReaderTtsStartInput {
    return {
      chapter: this.ttsChapterRef(page.chapter),
      content: page.chapter.content,
      contentVersion: this.materializedContentVersion,
      scalarPosition: page.startScalar,
      rate: this.ttsState.rate,
      pitch: 1,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      backgroundPlayback: this.ttsBackgroundPlayback,
      failurePolicy: this.ttsFailurePolicy,
      timerDurationMs: this.ttsTimerDurationMs(),
    };
  }

  private loadNextTtsChapter(
    current: ReaderTtsChapterRef,
    lifecycleToken: number,
  ): Promise<ReaderTtsChapterAdvanceInput | undefined> {
    if (!this.isSessionActive(lifecycleToken) || current.sourceId !== this.sourceId ||
      current.bookId !== this.bookId || current.chapterIndex !== this.ttsState.chapterIndex) return Promise.resolve(undefined);
    if (this.ttsTimerMode === 'chapterEnd') return Promise.resolve(undefined);
    return loadNextReaderTtsChapter(this.chapterWindow, {
      capture: (): ReaderTtsChapterAdvanceLease => {
        const owner = this.ttsPageFollow.lease(this.ttsFollowScope(), this.ttsState);
        return {
          current: (): boolean => this.isSessionActive(lifecycleToken) && current.sourceId === this.sourceId &&
            current.bookId === this.bookId && owner.sessionGeneration === this.ttsState.sessionGeneration &&
            owner.positionGeneration === (this.ttsState.positionGeneration ?? 0) && current.chapterIndex === this.ttsState.chapterIndex,
          select: (target: number, firstRange?: ReaderTtsChapterAdvanceRange): boolean => {
            if (!this.isTtsFollowLeaseCurrent(owner)) return false;
            const alignContinuous = firstRange !== undefined && this.ttsFollowHighlight &&
              this.readerSettingsSnapshot.navigationMode === 'continuous';
            const offset = alignContinuous ? firstRange?.charStart ?? 0 : 0;
            this.selectChapterAnchor(target, offset, offset === 0, false, undefined, -1, false, false, undefined, owner);
            return alignContinuous;
          },
        };
      },
      hydrateCatalogIfNeeded: (): Promise<void> | undefined => this.isUnknownCatalogEdge(current.chapterIndex, 'next') ?
        this.hydrateEntryCatalog() : undefined,
      nextChapterIndex: (): number | undefined => this.adjacentChapterIndex(current.chapterIndex, 1),
      load: (target: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> =>
        this.activeGateway().loadChapter(this.bookId, target, isCurrent),
      admit: (chapter: ReadingSessionChapter): void => this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion),
      chapterRef: (chapter: ReadingSessionChapter): ReaderTtsChapterRef => this.ttsChapterRef(chapter),
    });
  }

  private async auditionReaderTtsVoice(language: string, person: number): Promise<void> {
    const coordinator = this.ttsTransport.coordinator;
    const lifecycle = this.lifecycleToken;
    if (!this.isSessionActive(lifecycle) || coordinator === undefined || !this.controlVisible() ||
      !this.isControlInputEnabled() || this.windowChromeOverlayActive) return;
    this.pauseAutoPage('manual');
    await coordinator.auditionVoice({ engine: this.ttsEngine, language, person, rate: this.ttsState.rate, pitch: 1 });
    if (!this.isSessionActive(lifecycle) && this.ttsTransport.coordinator === coordinator) await coordinator.stopAudition();
  }

  private stopReaderTtsAudition(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) return;
    void coordinator.stopAudition().catch((error: Error): void => {
      hilog.warn(0x0000, 'ReaderTtsAudition', 'stop audition failed: %{private}s', error.message);
    });
  }

  private stopTts(): void {
    this.invalidateTtsPageFollow?.();
    if (this.staticSessionCapsuleOrigin?.location.module === 'tts') this.staticSessionCapsuleOrigin = undefined;
    if (this.sessionLaunch?.geometry.type === 'tts') this.cancelSessionLaunch('stop');
    this.ttsPlayback.cancelPending();
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.stop('user').catch((error: Error): void => this.logTtsFailure('stop', error));
    }
  }

  /** Manual navigation invalidates the chapter-bound one-shot stop target. */
  private clearTtsChapterEndTimer(): void {
    if (this.ttsTimerMode !== 'chapterEnd') return;
    this.ttsTimerMode = 'off';
    this.ttsTimerMinutes = 0;
    this.ttsTimerSeconds = 0;
    if (this.ttsState.chapterKey !== undefined) this.ttsTransport.coordinator?.setTimer(undefined);
  }

  private previousTtsUtterance(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.previous().catch((error: Error): void => this.logTtsFailure('previous', error));
    }
  }

  private nextTtsUtterance(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.next().catch((error: Error): void => this.logTtsFailure('next', error));
    }
  }

  private seekTtsUtterance(sliceIndex: number): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.seek(sliceIndex).catch((error: Error): void => this.logTtsFailure('seek', error));
    }
  }

  private changeTtsRate(rate: number, onDeclined?: () => void): void {
    const normalized = Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX,
      Math.round(rate * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE));
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) { onDeclined?.(); return; }
    const isConfigCurrent = this.ttsPreparation.beginConfiguration();
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const current = (): boolean => this.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId && this.ttsTransport.coordinator === coordinator &&
      isConfigCurrent();
    void admitReaderTtsRate((rate: number): Promise<void> => coordinator.setRate(rate), normalized, this.ttsState.rate, {
      isCurrent: current,
      persistRate: (rate: number): Promise<void> => this.persistTtsConfig(rate),
      presentPendingReconciliation: (): boolean => {
        if (this.ttsConfigurationHost?.snapshot().selection.receipt.fact !== 'pendingReconciliation') return false;
        // A missing config reply may have committed. Retain the live rate
        // while the configuration owner reconciles the durable receipt.
        const snapshot = this.ttsConfigurationHost?.snapshot();
        if (snapshot !== undefined) this.projectTtsConfigurationRecovery(snapshot);
        return true;
      },
      declineRate: (): void => {
        onDeclined?.();
        this.notifyTtsConfigurationFailure('语速未能保存，请重试');
      },
      reportFailure: (error: Error): void => this.logTtsFailure('rate', error),
    });
  }

  private changeTtsTimer(minutes: number, seconds: number, mode: ReaderTtsTimerMode = 'duration'): void {
    const safeMode: ReaderTtsTimerMode = mode === 'off' || mode === 'chapterEnd' ? mode : 'duration';
    if (safeMode === 'off' || safeMode === 'chapterEnd') {
      this.ttsTimerMode = safeMode;
      this.ttsTimerMinutes = 0;
      this.ttsTimerSeconds = 0;
    } else {
      const normalizedMinutes = Math.max(READER_TTS_TIMER_MIN,
        Math.min(READER_TTS_TIMER_MAX_MINUTES, Number.isFinite(minutes) ? Math.trunc(minutes) : 0));
      const normalizedSeconds = Math.max(READER_TTS_TIMER_MIN,
        Math.min(READER_TTS_TIMER_MAX_SECONDS, Number.isFinite(seconds) ? Math.trunc(seconds) : 0));
      this.ttsTimerMinutes = normalizedMinutes;
      this.ttsTimerSeconds = normalizedSeconds;
      this.ttsTimerMode = normalizedMinutes === 0 && normalizedSeconds === 0 ? 'off' : 'duration';
    }
    if (this.ttsState.chapterKey !== undefined) {
      this.ttsTransport.coordinator?.setTimer(this.ttsTimerDurationMs());
    }
  }

  private changeTtsAllowMixing(enabled: boolean): void {
    this.ttsPreferences.changeMixing(enabled, (accepted: boolean): Promise<boolean> => {
      const coordinator = this.ttsTransport.coordinator;
      return coordinator === undefined ? Promise.resolve(true) : coordinator.setAllowMixing(accepted);
    }, (accepted: boolean): void => { this.ttsAllowMixing = accepted; });
  }

  private changeTtsBackgroundPlayback(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    this.ttsBackgroundPlayback = enabled;
    this.ttsTransport.coordinator?.setBackgroundPlayback(enabled);
    this.ttsPreferences.accept({ backgroundPlayback: enabled });
  }

  private changeTtsKeepScreenOn(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const wasAwake = this.ttsWindowAwakeRequested();
    this.ttsKeepScreenOn = enabled;
    this.ttsPreferences.accept({ keepScreenOn: enabled });
    this.reconcileTtsWindowAwake(wasAwake);
  }

  private changeTtsFailurePolicy(policy: 'skip' | 'stop'): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const coordinator = this.ttsTransport.coordinator;
    this.ttsFailurePolicy = policy;
    coordinator?.setFailurePolicy(policy);
    this.ttsPreferences.accept({ failurePolicy: policy });
  }

  private changeTtsFollowHighlight(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    this.ttsFollowHighlight = enabled;
    if (!enabled) this.invalidateTtsPageFollow?.();
    else this.followTtsPage?.(this.ttsState);
    this.ttsPreferences.accept({ followHighlight: enabled });
  }

  private changeTtsPauseOnInterruption(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const coordinator = this.ttsTransport.coordinator;
    this.ttsPauseOnInterruption = enabled;
    coordinator?.setPauseOnInterruption(enabled);
    this.ttsPreferences.accept({ pauseOnInterruption: enabled });
  }

  private changeTtsVoice(language: string, person: number): void {
    this.ttsPreferences.changeVoice(language, person, (option: ReaderTtsVoiceOption): Promise<boolean> => {
      const coordinator = this.ttsTransport.coordinator;
      return coordinator === undefined ? Promise.resolve(true) : coordinator.setVoice(option.language, option.person);
    }, (option: ReaderTtsVoiceOption): void => {
      this.ttsLanguage = option.language;
      this.ttsPerson = option.person;
    });
  }

  private requireTtsConfigurationHost(): ReaderTtsConfigurationHost {
    if (this.ttsConfigurationHost !== undefined) return this.ttsConfigurationHost;
    const http = this.ttsTransport.httpGateway;
    const config = this.ttsTransport.gateway;
    const coordinator = this.ttsTransport.coordinator;
    if (http === undefined || config === undefined || coordinator === undefined) {
      throw new Error('朗读服务正在初始化，请稍后重试');
    }
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const current = (): boolean => this.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId && this.ttsTransport.coordinator === coordinator;
    const host = new ReaderTtsConfigurationHost({
      http, config, credentials: ReaderTtsCredentialStore.instance,
      coordinator: {
        stop: (reason: 'user'): Promise<void> => coordinator.stop(reason),
        probeAvailability: (isAdmitted: () => boolean): Promise<boolean> =>
          coordinator.probeConfigurationAvailability(isAdmitted),
      },
      isCurrent: current,
      fallbackConfig: (): ReaderTtsConfig => ({ engine: this.ttsEngine,
        rate: readerTtsCoreRateForMultiplier(this.ttsState.rate),
        ratePercent: readerTtsRatePercentForMultiplier(this.ttsState.rate),
        pitch: this.ttsConfig?.pitch ?? 0, followSys: this.ttsConfig?.followSys ?? false }),
      publish: (snapshot: ReaderTtsConfigurationSnapshot): void => {
        if (!current() || this.ttsConfigurationHost !== host) return;
        this.ttsConfig = snapshot.config;
        this.ttsEngine = snapshot.config?.engine ?? 'system';
        this.ttsHttpEngines = snapshot.engines;
        // Configuration receipts are independent from formal speech state.
        this.projectTtsConfigurationRecovery(snapshot);
      },
      log: (message: string): void => hilog.error(0x5244, 'Reader', '%{private}s', message),
    }, this.ttsConfig, this.ttsHttpEngines);
    this.ttsConfigurationHost = host;
    return host;
  }

  private retryTtsConfigurationMetadataOnOpen(): void {
    const host = this.ttsConfigurationHost;
    if (host === undefined) return;
    const metadata = host.snapshot().metadata;
    if (metadata.canRetry && (metadata.fact === 'failed' || metadata.fact === 'refreshFailed')) {
      // Reopening the existing configuration layer retries only its read.
      // It never replays a durable save or restarts formal playback.
      void host.refreshMetadata();
    }
  }

  private projectTtsConfigurationRecovery(snapshot: ReaderTtsConfigurationSnapshot): void {
    const lifecycleToken = this.lifecycleToken;
    const feedbackCurrent = (): boolean => this.isSessionActive(lifecycleToken) && this.isControlInputEnabled();
    const metadataFailed = snapshot.metadata.fact === 'failed' || snapshot.metadata.fact === 'refreshFailed';
    this.ttsConfigurationLoading = !snapshot.metadata.hasValue && snapshot.metadata.fact === 'loading';
    this.ttsConfigurationLoadFailed = !snapshot.metadata.hasValue && metadataFailed;
    if (metadataFailed && snapshot.metadata.hasValue && !this.ttsConfigurationMetadataFailed &&
      snapshot.notice === undefined && snapshot.durable.receipt.fact !== 'pendingReconciliation' &&
      snapshot.selection.receipt.fact !== 'pendingReconciliation' && this.readerPreferenceModule() === 'tts') {
      this.transientFeedback.show(() => this.getUIContext(), { message: '朗读配置刷新失败，当前配置已保留' },
        feedbackCurrent);
    }
    this.ttsConfigurationMetadataFailed = metadataFailed;
    const pending = snapshot.durable.receipt.fact === 'pendingReconciliation' ||
      snapshot.selection.receipt.fact === 'pendingReconciliation';
    const message = pending ? '配置操作结果尚未确认，请核对当前配置；确认前不会重复提交。' : '';
    if (message !== this.ttsConfigurationRecovery.message) {
      this.ttsConfigurationRecovery = { message, visible: pending, canRetry: pending,
        generation: this.ttsConfigurationRecovery.generation + 1 };
    }
    if (!pending && snapshot.notice !== undefined && snapshot.notice !== this.ttsConfigurationNotice) {
      const message = snapshot.durable.receipt.fact === 'confirmedRefreshFailed' ?
        (snapshot.durable.value?.kind === 'http-delete' ? '配置已删除，列表刷新失败，请重新打开设置刷新列表' :
          '配置已保存，列表刷新失败，请重新打开设置刷新列表') : '配置已保存，当前引擎暂不可用，请检查朗读设置';
      this.transientFeedback.show(() => this.getUIContext(), { message }, feedbackCurrent);
    }
    this.ttsConfigurationNotice = snapshot.notice;
  }

  private openTtsConfigurationRecovery(generation: number): void {
    if (!this.isSessionActive(this.lifecycleToken) || !this.isControlInputEnabled() ||
      generation !== this.ttsConfigurationRecovery.generation || !this.ttsConfigurationRecovery.visible) return;
    this.openReaderControl();
    this.setControlPage('moduleTts');
    // Viewing the original configuration never repeats or confirms its write.
  }

  private notifyTtsConfigurationFailure(message: string): void {
    const lifecycleToken = this.lifecycleToken;
    const snapshot = this.ttsConfigurationHost?.snapshot();
    if (snapshot !== undefined) {
      this.projectTtsConfigurationRecovery(snapshot);
      if (this.ttsConfigurationRecovery.visible || snapshot.notice !== undefined) return;
    }
    this.transientFeedback.show(() => this.getUIContext(), { message, tone: 'error' }, (): boolean =>
      this.isSessionActive(lifecycleToken) && this.isControlInputEnabled());
  }

  private changeTtsEngine(engine: string): Promise<void> {
    const lifecycle = this.lifecycleToken;
    return this.ttsPreparation.configure(engine,
      (value: string): Promise<void> => this.requireTtsConfigurationHost().changeEngine(value),
      (): boolean => this.isSessionActive(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('朗读引擎未能切换，请检查配置后重试'));
  }

  private saveHttpTtsEngine(config: ReaderTtsConfigurationDraft): Promise<void> {
    const lifecycle = this.lifecycleToken;
    return this.ttsPreparation.configure(config,
      (value: ReaderTtsConfigurationDraft): Promise<void> => this.requireTtsConfigurationHost().save(value),
      (): boolean => this.isSessionActive(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('在线朗读配置未能保存，请检查输入后重试'));
  }

  private deleteHttpTtsEngine(id: number): Promise<void> {
    const lifecycle = this.lifecycleToken;
    return this.ttsPreparation.configure(id,
      (value: number): Promise<void> => this.requireTtsConfigurationHost().delete(value),
      (): boolean => this.isSessionActive(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('在线朗读配置未能删除，请重试'));
  }

  private async persistTtsConfig(rate: number): Promise<void> {
    await this.requireTtsConfigurationHost().persistRate(
      readerTtsCoreRateForMultiplier(rate), readerTtsRatePercentForMultiplier(rate));
  }

  private async commitTtsProgress(progress: ReaderTtsProgressCommit, lifecycleToken: number): Promise<void> {
    const chapter = this.chapter;
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean =>
      (this.isSessionActive(lifecycleToken) ||
        (this.exitRequested && this.isMountedToken(lifecycleToken) && this.isReaderIdentityCurrent?.() !== false)) &&
      this.sourceId === progress.chapter.sourceId && this.bookId === progress.chapter.bookId &&
      this.chapter === chapter && this.chapterSelectionToken === selectionToken;
    if (chapter === undefined || !isCurrent() ||
      progress.chapter.chapterIndex !== chapter.chapterIndex || progress.chapter.bodyVersion !== chapter.bodyVersion ||
      progress.chapter.processingVersion !== chapter.processingVersion) return;
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    const offset = Math.max(0, Math.min(scalarCount, progress.charEnd));
    const intent = this.progressProducerIntent(chapter,
      new CoreReadingAnchor(chapter.chapterIndex, offset, scalarCount === 0 ? 0 : offset / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.coreLayout(),
      isCurrent, isCurrent, (stored: LocalReadingProgress): void => {
        this.admitCommittedProgress(stored);
        if (!isCurrent()) return;
        this.lastTtsCommittedProgress = this.lastCommittedProgress;
        this.lastTtsCommittedChapter = chapter;
        this.lastTtsCommittedSelectionToken = selectionToken;
      });
    try {
      await this.progressProducers.commitTts(intent);
    } catch (error) {
      if (!isCurrent()) return;
      this.logTtsFailure('progress', error as Error);
    }
  }

  private ttsChapterRef(chapter: ReadingSessionChapter): ReaderTtsChapterRef {
    return {
      sourceId: this.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle,
      bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
    };
  }

  private ttsTimerDurationMs(): number | undefined {
    if (this.ttsTimerMode !== 'duration') return undefined;
    const seconds = this.ttsTimerMinutes * 60 + this.ttsTimerSeconds;
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  private logTtsFailure(operation: string, error: Error): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS ${operation} failed: ${error.message}`);
    const current = this.ttsState;
    this.ttsState = {
      status: current.status,
      sessionGeneration: current.sessionGeneration,
      utteranceGeneration: current.utteranceGeneration,
      positionGeneration: current.positionGeneration,
      audioStarted: current.audioStarted,
      contentVersion: current.contentVersion,
      chapterKey: current.chapterKey,
      chapterIndex: current.chapterIndex,
      sliceIndex: current.sliceIndex,
      totalSlices: current.totalSlices,
      charStart: current.charStart,
      charEnd: current.charEnd,
      requestId: current.requestId,
      rate: current.rate,
      consecutiveFailures: current.consecutiveFailures,
      timerDeadlineMs: current.timerDeadlineMs,
      pauseReason: current.pauseReason,
      stopReason: current.stopReason,
      errorMessage: error.message.length > 0 ? error.message : `TTS ${operation} failed`,
    };
  }

  private toggleAutoPage(): void {
    if (!this.readerInputIsCurrent() || this.windowChromeOverlayActive) {
      this.retirePendingPlaybackStarts(); return;
    }
    this.ttsPlayback.cancelPending();
    const status = this.automaticReadingState().status;
    if (status === 'running') {
      this.pauseAutoPage('manual');
      return;
    }
    if (this.phase !== 'ready' || this.autoPageCoordinator.pendingStart()) return;

    const coordinator = this.ttsTransport.coordinator;
    const generation = this.autoPageCoordinator.beginStart();
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const speechGeneration = this.ttsState.sessionGeneration;
    const pauseIsCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      this.sourceId === sourceId && this.bookId === bookId && this.ttsTransport.coordinator === coordinator &&
      this.ttsState.sessionGeneration === speechGeneration &&
      this.autoPageCoordinator.isStartCurrent(generation) && this.automaticReadingState().status !== 'stopped';
    if (coordinator !== undefined && readerTtsSessionBlocksAutoPageStart(this.ttsState.status)) {
      // Pause retires the speech request and dispatches the platform stop in
      // this turn. Its queue and platform acknowledgements settle separately.
      void coordinator.pause().catch((error: Error): void => {
        if (!pauseIsCurrent()) return;
        this.pauseAutoPage('manual');
        this.logTtsFailure('pause for auto-page', error);
        this.transientFeedback.show(() => this.getUIContext(), { message: '朗读暂停失败，自动翻页已暂停，请重试' },
          (): boolean => pauseIsCurrent() && this.appForeground && this.windowChromeActive);
      });
    }
    if (!this.autoPageCoordinator.admitStart(generation)) return;
    this.startAutoPageSession(status === 'paused');
  }

  private startAutoPageSession(resuming: boolean): void {
    if (!this.readerInputIsCurrent() || this.windowChromeOverlayActive || this.phase !== 'ready' ||
      this.automaticReadingState().status !== (resuming ? 'paused' : 'stopped')) {
      return;
    }
    const morphing = this.beginSessionCapsuleMorph('autoPage');
    if (resuming) this.autoPageCoordinator.resume();
    else this.autoPageCoordinator.start();
    const launch = this.sessionLaunch;
    if (launch !== undefined && launch.geometry.type === 'autoPage' && launch.ownership === 'stage') {
      if (!this.sessionLaunchController.mayStartBusiness(launch.generation)) {
        this.pauseAutoPage('manual');
        this.sessionLaunchController.acknowledgeBusiness(launch.generation, 'paused');
        this.sessionLaunch = this.sessionLaunchController.snapshot();
        return;
      }
      this.sessionLaunchController.acknowledgeBusiness(launch.generation, 'playing');
      this.sessionLaunch = this.sessionLaunchController.snapshot();
      if (this.sessionLaunch !== undefined) this.capsuleVerification.ownerState('business-ack', this.sessionLaunch);
    }
    if (!morphing && launch === undefined && this.automaticReadingState().status === 'running') {
      this.hideControlForStaticSessionCapsule('autoPage');
    }
    this.armAutoPageTimer(true);
    this.armAutoPageSessionTimer(!resuming);
  }

  private stopAutoPage(): void {
    if (this.staticSessionCapsuleOrigin?.location.module === 'autoPage') this.staticSessionCapsuleOrigin = undefined;
    if (this.sessionLaunch?.geometry.type === 'autoPage') this.cancelSessionLaunch('stop');
    this.autoPageCoordinator.stop();
    this.cancelAutomaticPageStart?.('autoTimer');
  }

  private cancelPendingAutoPageStart(): void { this.autoPageCoordinator.cancelStart(); }

  private changeAutoPageSpeed(deltaSeconds: number): void {
    this.setAutoPageSpeed(this.automaticReadingState().speedSeconds + deltaSeconds);
  }

  private setAutoPageSpeed(nextSpeed: number, onDeclined?: () => void): void {
    if (!Number.isFinite(nextSpeed) || !this.mounted || !this.appForeground || this.exitRequested) {
      onDeclined?.();
      return;
    }
    if (!this.autoPageCoordinator.setSpeed(nextSpeed)) onDeclined?.();
  }

  private changeAutoPageSessionTimer(minutes: number, seconds: number): void {
    this.autoPageCoordinator.setSessionTimer(minutes, seconds);
  }

  private setAutoPageFollowHighlight(enabled: boolean): void { this.autoPageCoordinator.setFollowHighlight(enabled); }

  private pauseAutoPageForInteraction(): void {
    this.pauseAutoPage('touch');
  }

  private observeReadingPrefetch(interacted: boolean = false, yieldToReading: boolean = false,
    retiring: boolean = false): void {
    if (this.onReadingPrefetchActivity === undefined || this.sourceId === LOCAL_READING_SOURCE_ID ||
      this.isReaderIdentityCurrent() === false) return;
    const chapter = this.pageTurnPreparation?.origin.chapter ?? this.chapter;
    if (chapter === undefined) return;
    const active = !retiring && this.mounted && !this.exitRequested && this.appForeground &&
      this.windowChromeActive && !this.windowChromeOverlayActive && !this.interactionBlocked && !this.controlObscured &&
      !this.readingPrefetchScreenLocked && this.phase === 'ready';
    this.onReadingPrefetchActivity({ chapterIndex: chapter.chapterIndex,
      chapterOffset: this.lastCommittedProgress?.chapterIndex === chapter.chapterIndex ?
        this.lastCommittedProgress.chapterOffset : this.visiblePage?.startScalar ?? 0,
      active, playing: this.ttsState.status === 'playing' || this.automaticReadingState().status === 'running',
      interacted, yieldToReading });
  }

  private onPrefetchDownloadActivityChanged(): void { this.observeReadingPrefetch(); }

  private onReaderManualInteraction(): void {
    this.observeReadingPrefetch?.(true, true);
    this.retirePendingPlaybackStarts();
    this.retireReaderRecovery();
    this.invalidateTtsPageFollow?.();
    this.screenAwakeLease?.rearm();
    this.pauseAutoPageForInteraction();
  }

  private pauseAutoPage(reason: ReaderAutoPagePauseReason): void {
    this.autoPageCoordinator.pause(reason);
    const launch = this.sessionLaunch;
    if (launch?.geometry.type === 'autoPage' && this.controlVerification.observing()) {
      const facts: ReaderControlCapsulePauseFacts = { generation: launch.generation, type: 'autoPage',
        status: this.automaticReadingState().status, kind: launch.geometry.kind, reason: reason,
        desiredPlaying: launch.desiredPlaying };
      this.controlVerification.effect('capsule-launch', 'business-paused', facts);
    }
    this.cancelAutomaticPageStart?.('autoTimer');
  }

  private armAutoPageTimer(resetDeadline: boolean): void { this.autoPageCoordinator.armPageTimer(resetDeadline); }

  private resumePendingAutoPageTurn(): void { this.autoPageCoordinator.resumePendingTurn(); }

  private onAutoPagePageCommitted(): void { this.autoPageCoordinator.pageCommitted(); }

  private clearAutoPageTimer(resetDeadline: boolean = true): void { this.autoPageCoordinator.clearPageTimer(resetDeadline); }

  private armAutoPageSessionTimer(resetDeadline: boolean): void { this.autoPageCoordinator.armSessionTimer(resetDeadline); }

  private clearAutoPageSessionTimer(resetDeadline: boolean = true): void {
    this.autoPageCoordinator.clearSessionTimer(resetDeadline);
  }

  private onAppForegroundChanged(): void {
    const generation = ++this.appForegroundGeneration;
    const lifecycle = this.lifecycleToken;
    this.syncSmartGestureMonitor();
    this.applyWindowPolicyForChromeOwner();
    if (!this.appForeground) this.cancelSourceSwitchCompletion();
    this.onControlInputBoundaryChanged();
    if (!this.appForeground) {
      this.cancelAutomaticPageStart?.();
      this.stopReaderTtsAudition();
      this.ttsPlayback.clearResumePresentation();
      const launch = this.sessionLaunch;
      if (launch?.ownership === 'stage' && this.liveSessionCapsuleSnapshot(true)?.type === launch.geometry.type) {
        this.rememberStaticSessionCapsuleOrigin(launch.geometry.type, this.sessionLaunchSourceControl);
      }
      this.finishSessionCapsuleMorph();
      this.finishBookmarkRollback(this.bookmarkRollbackGeneration);
      this.bookmarkRollbackGeneration += 1;
      this.screenAwakeLease?.setForeground(false);
      this.captureReadingRecordElapsed(false);
      this.clearReadingRecordTimer();
      void this.flushReadingRecord().catch((error: Error): void => {
        try { hilog.error(0x5244, 'Reader', '%{private}s', `Reading duration: ${this.errorMessage(error)}`); } catch (_diagnosticError) {}
      });
      this.pauseAutoPage('background');
      const coordinator = this.ttsTransport.coordinator;
      if (coordinator !== undefined) {
        const pause = (): void => {
          if (generation !== this.appForegroundGeneration || !this.isMountedToken(lifecycle) ||
            this.appForeground || this.ttsTransport.coordinator !== coordinator) return;
          void coordinator.pauseForBackground()
            .catch((error: Error): void => this.logTtsFailure('background pause', error));
        };
        const host = ReaderRuntimeOwner.current().getTtsHost();
        if (!this.ttsBackgroundPlayback) pause();
        else if (!host.isBackgroundPlaybackActive()) {
          // Optional platform admission is off the speech-critical path. A
          // quick lock-screen transition must observe its bounded result.
          void host.waitForBackgroundPlaybackAdmission().then((admitted: boolean): void => {
            if (!this.ttsBackgroundPlayback || !admitted) pause();
          }).catch((error: Error): void => {
            this.logTtsFailure('background admission', error);
            pause();
          });
        }
      }
      return;
    }
    this.screenAwakeLease?.setForeground(true);
    this.resumeTtsPageFollow?.();
    this.admitRetainedReadingRecency();
    if (this.phase === 'ready') {
      this.beginReadingRecordClock(this.lifecycleToken);
    }
  }

  private beginReadingRecordClock(lifecycleToken: number): void {
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    this.readingRecordHost.begin((): boolean => this.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId && this.appForeground && !this.exitRequested);
  }

  private clearReadingRecordTimer(): void { this.readingRecordHost.clearTimer(); }

  private captureReadingRecordElapsed(continueClock: boolean): void { this.readingRecordHost.capture(continueClock); }

  private flushReadingRecord(): Promise<void> { return this.readingRecordHost.flush(); }

  private flushReadingRecordForExit(): Promise<void> { return this.readingRecordHost.flushForExit(); }

  private onControlObscuredChanged(): void {
    this.onControlInputBoundaryChanged();
    if (this.controlObscured) {
      this.pauseAutoPage('touch');
    }
  }

  private onWindowChromeActiveChanged(): void {
    this.syncSmartGestureMonitor();
    if (!this.windowChromeActive) this.transientFeedback.reset();
    this.admitRetainedReadingRecency();
    this.onControlInputBoundaryChanged();
    this.applyWindowChrome();
    this.applyWindowPolicyForChromeOwner();
  }

  private controlsPresentedForWindow(): boolean {
    return this.sessionLaunch?.ownership === 'stage' ? this.sessionLaunch.sample.controlsPresented :
      readerControlHostVisible(this.latestControlVisualSession);
  }

  private applyWindowPolicyForChromeOwner(): void {
    if (!this.mounted || this.isReaderIdentityCurrent?.() === false) return;
    // Take one semantic chrome snapshot at the ownership edge.  The control
    // panel reports its visual session and the native Window policy is
    // asynchronous; reading the session again after assigning @State could
    // otherwise let the painted band, top-info suppression and native bar
    // policy observe different frames during the first open/close frame.
    const controlsPresented = this.controlsPresentedForWindow();
    this.windowControlsPresented = controlsPresented;
    this.syncVolumeKeyPolicy();
    AppStorage.setOrCreate<boolean>('readerTopInfoSuppressed',
      this.windowChromeActive && controlsPresented);
    if (this.windowChromeActive && this.appForeground) {
      // The control surface is an explicit system-chrome affordance. Keep the
      // user's hide-status-bar preference persisted, but expose the status bar
      // while controls are open so the top bar has a live safe-top boundary.
      // Keep native safe-area inputs stable through the flight. Control paint
      // still leaves on its authored cue; the system bar follows settlement.
      const stageFlying = this.sessionLaunch?.ownership === 'stage' && !this.sessionLaunch.sample.finished;
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot, controlsPresented || stageFlying)
        .catch((_error: Error): void => {});
      return;
    }
    if (this.windowPolicyOwner !== undefined) void ReaderWindowCoordinator.requestAppWindowPolicy(this.windowPolicyOwner)
      .catch((_error: Error): void => {});
  }

  private readerStatusBarMetrics(_revision: number): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metrics();
  }

  @Builder
  private readerStatusBarUnderlay() {
    // A visible system status bar owns this measured band, both during
    // ordinary reading and while controls are presented. Cover any retained
    // page-owned information text before painting native system chrome.
    if (this.windowChromeActive &&
      (this.windowControlsPresented || this.readerSettingsSnapshot.hideStatusBar !== true)) {
      // Read the observed revision inside the child update function: a static
      // metrics getter alone never subscribes this paint node to later measures.
      // Keep the status paper above the page-owned ReaderPageChrome and the
      // control panel's transparent backdrop. The native status bar and this
      // exact measured crop are one visual band, so a stale/transparent page
      // info layer must never bleed through while the system bar is visible.
      ReaderStatusBarPaper({
        theme: this.appearanceSnapshot.activeTheme,
        fallbackColor: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).paperStart,
        viewportWidth: this.readingLayout().viewportWidth,
        viewportHeight: this.readingLayout().viewportHeight,
        statusRect: this.readerStatusBarMetrics(this.readerWindowMetricsRevision).statusBarRect,
        expanded: this.readingLayout().widthClass === 'expanded',
      }).id('reader-status-bar-underlay').zIndex(10).hitTestBehavior(HitTestMode.None);
    }
  }

  private applyWindowChrome(): void {
    if (this.isReaderIdentityCurrent?.() === false) return;
    if (!this.windowChromeActive) {
      ReaderWindowCoordinator.requestAppChrome();
      return;
    }
    const themeStyle = readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme);
    const chromeStyle = new ReaderWindowChromeStyle(
      themeStyle.paperStart,
      readerAppearanceChromeTone(this.appearanceSnapshot.activeTheme),
      themeStyle.ink,
      this.appearanceSnapshot.activeTheme,
    );
    if (this.windowChromeOverlayActive) {
      ReaderWindowCoordinator.requestOverlayChrome(chromeStyle);
      return;
    }
    ReaderWindowCoordinator.requestReaderChrome(chromeStyle);
  }

  private setControlPage(page: ReaderControlPage, origin: ReaderControlVerificationOrigin = 'module-button'): void {
    if (this.sessionLaunch !== undefined) this.cancelSessionLaunch('sourceChanged');
    if (!this.isControlInputEnabled()) return;
    this.invalidateControlBackdrop();
    this.requestControlSession(setReaderControlHostPage(this.latestControlVisualSession, page, this.controlTiming()), origin);
  }

  private cancelControlNavigationIntent(): boolean { return this.controlNavigation.cancel(); }

  private onControlInputActivity(): void {
    this.cancelControlNavigationIntent();
    this.invalidateControlBackdrop();
  }

  private requestControlSession(next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void {
    if (this.controlNavigation.request(next, origin)) this.controlFontOrder.reconcile();
  }

  /** Called only when the derived business page changes, never on every frame. */
  private prepareControlPage(page: ReaderControlPage): void {
    const lifecycleToken = this.lifecycleToken;
    if (page === 'moduleDirectory') {
      if (this.entryCatalogPending) this.scheduleEntryCatalogHydration();
      this.loadControlBookmarks();
    } else if (page === 'moduleTts' || page === 'fullTts') {
      void this.initializeTtsSession(lifecycleToken);
    } else if (page === 'moduleAppearance' || page === 'fullAppearance') {
      void this.loadChineseConversionMode(lifecycleToken);
    } else if (page === 'moduleSettings' || page === 'fullSettings') {
      void this.loadReaderSettingsSnapshot(lifecycleToken);
    } else if (page === 'quickReplace') {
      this.prepareControlReplacePage();
    }
  }

  private prepareControlReplacePage(): void {
    if (!this.controlMinimumReady || this.controlPage() !== 'quickReplace' || !this.controlVisible() ||
      this.controlReplaceState.mutationPending) return;
    const identity = this.controlMinimumCommittedIdentity();
    const receipt = this.controlPresentationReceipt;
    if (receipt !== undefined) {
      if (receipt.identity !== identity || receipt.ownerKey !== this.controlMinimumOwnerKey() ||
        receipt.environmentKey !== this.controlMinimumEnvironmentKey() || receipt.location.module !== 'replace') return;
    } else if (this.controlMinimum.profileReader !== undefined) return;
    this.replacePanel.prepare(identity);
  }

  private loadControlBookmarks(): void {
    const location = readerControlContentLocation(this.controlSession);
    if (!this.mounted || this.exitRequested || !this.controlVisible() ||
      location.level !== 'secondary' || location.module !== 'directory') return;
    const lifecycleToken = this.lifecycleToken;
    // An open or explicit retry owns a new request. Morph frames and tab positioning do not.
    this.controlBookmarkRead.open((ownsGeneration: () => boolean): ReaderControlBookmarkReadIntent => {
      const openRevision = this.controlOpenRevision;
      const sourceId = this.sourceId;
      const bookId = this.bookId;
      const entriesAtStart = this.directoryEntries;
      return {
        isCurrent: (): boolean => {
          const currentLocation = readerControlContentLocation(this.controlSession);
          return this.isSessionActive(lifecycleToken) && ownsGeneration() &&
            openRevision === this.controlOpenRevision && sourceId === this.sourceId && bookId === this.bookId &&
            this.controlVisible() && currentLocation.level === 'secondary' && currentLocation.module === 'directory';
        },
        load: (current: () => boolean): Promise<void> => this.onLoadControlBookmarks(sourceId, bookId, current),
        failed: (error: Error): void => {
          if (readerBookmarkReadFailureSuperseded(this.bookmarkLoadMessage, entriesAtStart, this.directoryEntries)) return;
          this.controlBookmarkLoadFailed = true;
          hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark projection failed: ${this.errorMessage(error)}`);
        },
      };
    }, (): void => { this.controlBookmarkLoadFailed = false; });
  }

  private onControlBookmarkFailureChanged(): void {
    // This prop describes a failed canonical refresh, never the original
    // write's confirmation. A message delivery cannot retire a list request.
    if (this.bookmarkLoadMessage.length === 0) {
      this.controlBookmarkRead.clearNotice();
      this.onControlDirectoryDataChanged();
      return;
    }
    this.controlBookmarkLoadFailed = true;
    if (!this.mounted || this.exitRequested || !this.appForeground || !this.windowChromeActive) return;
    const noticeKey = `${this.lifecycleToken}:${this.sourceId}:${this.bookId}:${this.bookmarkLoadMessage}`;
    if (!this.controlBookmarkRead.admitNotice(noticeKey)) return;
    try {
      this.transientFeedback.show(() => this.getUIContext(), {
        message: `${this.bookmarkLoadMessage}。请打开目录－书签重新载入。`,
      }, (): boolean => this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive);
    } catch (error) {
      hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark notice unavailable: ${this.errorMessage(error)}`);
    }
  }

  private onControlDirectoryDataChanged(): void {
    this.publishControlDirectoryData(true);
    this.reconcilePageBookmarkFeedback();
    this.bookmarkPresentationRevision += 1;
    if (this.usesBookTurnSimulation() && this.pageTurnInputPhase() === 'idle') {
      this.bookTurnTexture.invalidate(true);
      this.scheduleBookTurnTextureRefresh();
    }
    const location = readerControlContentLocation(this.controlSession);
    if (!this.controlVisible() || location.level !== 'secondary' || location.module !== 'directory') return;
    if (this.bookmarkLoadMessage.length > 0) {
      if (!this.controlBookmarkRead.isPending()) this.controlBookmarkLoadFailed = true;
      return;
    }
    let unknown = false;
    for (const entry of this.directoryEntries) {
      if (entry.bookmarks === undefined) { unknown = true; break; }
    }
    if (!unknown) {
      // A concurrent, confirmed CRUD refresh can itself provide the facts.
      this.controlBookmarkLoadFailed = false;
    } else if (!this.controlBookmarkRead.isPending() && !this.controlBookmarkLoadFailed) {
      // A real catalog change can introduce unknown rows after first opening.
      // Attempt once for this data change, never retry a failure on each frame.
      this.loadControlBookmarks();
    }
  }

  private loadAppearanceSnapshot(lifecycleToken: number): Promise<void> {
    const generation = this.appearanceMutationGeneration;
    return loadReadingAppearance(this.appearanceGateway, (): void => this.refreshAppearanceSaveRecovery(lifecycleToken), {
      current: (): boolean => this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration,
      prepareFont: (snapshot: ReaderAppearanceSnapshot): Promise<void> =>
        prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot)),
      registerCustomFont: (snapshot: ReaderAppearanceSnapshot): Promise<boolean> =>
        this.appearanceGateway.registerCustomFont(this.getUIContext().getFont(), snapshot),
      admit: (snapshot: ReaderAppearanceSnapshot): void => {
        this.admitAppearanceSnapshot(snapshot);
        this.appearanceLoaded = true;
      },
      observeSave: (saved: Promise<void>): void => this.observeAppearanceSave(saved, lifecycleToken),
      loadFailed: (error: Error): void => {
        this.showAppearanceFailure('外观设置读取失败，请重新打开阅读页', error);
        // Keep a readable chapter available with the bundled system font.
        if (!this.appearanceLoaded) {
          this.admitAppearanceSnapshot(setReaderAppearanceFont(this.appearanceSnapshot, 'serif'));
          this.appearanceLoaded = true;
          hilog.warn(0x5244, 'Reader', '%{private}s',
            'ReadingExperience appearance fallback admitted: ' + errorMessageOf(error));
        }
      },
    });
  }

  private chineseConversionIdentity(): string {
    return JSON.stringify([this.lifecycleToken,this.sourceId,this.bookId,this.chineseConversionOperationId]);
  }
  private dispatchChineseConversionAction(mode: ReaderChineseConversionMode, identity?: string): void {
    if (identity!==this.chineseConversionIdentity()) return;
    this.chineseConversionAction()(mode);
  }
  private chineseConversionAction(): (mode: ReaderChineseConversionMode) => void {
    const lifecycleToken=this.lifecycleToken, bookId=this.bookId, sourceId=this.sourceId;
    const operationId=this.chineseConversionOperationId;
    const key=JSON.stringify([lifecycleToken,sourceId,bookId,operationId]);
    if (this.chineseConversionActorKey===key && this.chineseConversionActor!==undefined) return this.chineseConversionActor;
    this.chineseConversionActorKey=key;
    this.chineseConversionActor=(mode: ReaderChineseConversionMode): void => {
      if (this.isSessionActive(lifecycleToken) && this.bookId === bookId && this.sourceId === sourceId)
        this.changeChineseConversionMode(mode,operationId);
    };
    return this.chineseConversionActor;
  }
  private async loadChineseConversionMode(lifecycleToken: number): Promise<void> {
    if (this.chineseConversionLoaded) return;
    const mutationGeneration=this.chineseConversionMutationGeneration, bookId=this.bookId, sourceId=this.sourceId;
    const current=(): boolean=>this.bookId===bookId && this.sourceId===sourceId && this.isSessionActive(lifecycleToken) && mutationGeneration===this.chineseConversionMutationGeneration;
    try {
      // Pure exact recovery never replays an unknown original on startup.
      const original=await this.chineseConversionGateway.recoverOriginal(current);
      if (!current()) return;
      this.chineseConversionOperationId=original.blocked && original.method==='reader.chinese-conversion.put' ? original.operationId ?? '' : '';
      const mode=await this.chineseConversionGateway.getMode(current);
      if (!current()) return;
      this.chineseConversionMode=mode; this.chineseConversionLoaded=true;
    } catch (_) {
      if (!current()) return;
      const original=this.chineseConversionGateway.snapshot();
      this.chineseConversionOperationId=original.blocked && original.method==='reader.chinese-conversion.put' ? original.operationId ?? '' : '';
    }
  }

  private changeChineseConversionMode(mode: ReaderChineseConversionMode, capturedOperationId: string = this.chineseConversionOperationId): void {
    if (!this.mounted || capturedOperationId!==this.chineseConversionOperationId) return;
    const original=this.chineseConversionGateway.snapshot();
    if (original.busy) return;
    const recovering=original.blocked && original.method==='reader.chinese-conversion.put';
    if (mode===this.chineseConversionMode && !recovering) return;
    this.chineseConversionMutationGeneration = this.chineseConversionMutationGeneration >=
      Number.MAX_SAFE_INTEGER ? 1 : this.chineseConversionMutationGeneration + 1;
    const generation = this.chineseConversionMutationGeneration;
    const lifecycleToken = this.lifecycleToken, bookId=this.bookId, sourceId=this.sourceId;
    const presentationCurrent=(): boolean=>this.bookId===bookId && this.sourceId===sourceId && this.isSessionActive(lifecycleToken);
    const barrier=recovering ? Promise.resolve((): boolean=>presentationCurrent() && generation===this.chineseConversionMutationGeneration) : this.persistBeforeContentMutation();
    void barrier.then((positionCurrent): Promise<ReaderChineseConversionMode> => {
      if (!positionCurrent() || !presentationCurrent() ||
        generation !== this.chineseConversionMutationGeneration) throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      const current=(): boolean=>positionCurrent() && presentationCurrent() && generation===this.chineseConversionMutationGeneration;
      if (recovering) {
        // This click only resumes its preserved original; it cannot substitute
        // the new selector value for the accepted conversion tuple.
        return this.chineseConversionGateway.recoverOriginal(current,true).then((settled): Promise<ReaderChineseConversionMode> => {
          if (settled.blocked) throw new Error(settled.message);
          return this.chineseConversionGateway.getMode(current);
        });
      }
      return this.chineseConversionGateway.putMode(mode,current);
    })
      .then((storedMode: ReaderChineseConversionMode): void => {
        if (!presentationCurrent() ||
          generation !== this.chineseConversionMutationGeneration) {
          return;
        }
        this.chineseConversionMode = storedMode;
        this.chineseConversionLoaded = true;
        const settled=this.chineseConversionGateway.snapshot();
        this.chineseConversionOperationId=settled.blocked ? settled.operationId ?? '' : '';
        this.quickSearchPublication.cancel();
        this.publishQuickSearchState({ kind: 'idle' });
        const chapter = this.chapter;
        if (chapter === undefined) {
          if (this.phase === 'failed') this.retryReading();
          return;
        }
        const chapterIndex = chapter.chapterIndex;
        const isCurrent = (): boolean => presentationCurrent() &&
          generation === this.chineseConversionMutationGeneration;
        void this.activeGateway().loadToc(this.bookId, isCurrent)
          .then((toc: LocalReadingToc): void => {
            if (!isCurrent()) {
              return;
            }
            this.admitTocEntries(toc.entries);
            this.onDirectoryProjectionChanged(toc.entries);
            this.reloadCurrentChapterAfterContentProjectionChange(lifecycleToken, chapterIndex);
          })
          .catch((_error: Error): void => {
            if (isCurrent()) {
              this.reloadCurrentChapterAfterContentProjectionChange(lifecycleToken, chapterIndex);
            }
          });
      })
      .catch((error: Error): void => {
        if (!presentationCurrent() || generation!==this.chineseConversionMutationGeneration) return;
        const fact=this.chineseConversionGateway.snapshot();
        this.chineseConversionOperationId=fact.blocked && fact.method==='reader.chinese-conversion.put' ? fact.operationId ?? '' : '';
        const message=fact.confirmation==='unknown' || fact.blocked ?
          '转换原操作尚未确认，已保留原内容；再次选择只会核对/继续原操作' :
          fact.confirmation==='confirmed' ? '转换已保存，当前内容刷新尚未完成，请重试阅读' : '转换未能执行，请稍后重试；原内容已保留';
        try { this.transientFeedback.show(() => this.getUIContext(), {message}, (): boolean => presentationCurrent() && generation === this.chineseConversionMutationGeneration && this.appForeground && this.windowChromeActive); } catch (_) {}
      });
  }

  private async loadReaderSettingsSnapshot(lifecycleToken: number): Promise<void> {
    if (this.readerSettingsLoaded) {
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      this.applyInitialReaderWindowPolicy(this.readerSettingsSnapshot, lifecycleToken, this.readerSettingsMutationGeneration);
      this.retryPendingReaderSettings(this.captureReaderSettingsAdmission(lifecycleToken, this.readerSettingsMutationGeneration));
      return;
    }
    const mutationGeneration = this.readerSettingsMutationGeneration;
    let loadedSnapshot = this.readerSettingsSnapshot;
    try {
      loadedSnapshot = await this.readerSettingsGateway.load();
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.readerSettingsMutationGeneration) {
        return;
      }
      this.traceInitialReadingPhase?.('settings-read', lifecycleToken);
      this.publishLoadedReaderSettings(loadedSnapshot);
      this.applyInitialReaderWindowPolicy(loadedSnapshot, lifecycleToken, mutationGeneration);
      this.retryPendingReaderSettings(this.captureReaderSettingsAdmission(lifecycleToken, mutationGeneration));
    } catch (_error) {
      // Keep locally-rendered behavior coherent with a failed Host request:
      // supported page-turn state survives, window-backed fields fail closed.
      if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.readerSettingsMutationGeneration) return;
      this.readerSettingsSnapshot = safeReaderWindowSettingsFallback(loadedSnapshot);
      this.readerSettingsLoaded = true;
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot).catch((): void => {});
    }
  }

  private applyInitialReaderWindowPolicy(snapshot: ReaderSettingsSnapshot,
    lifecycleToken: number, mutationGeneration: number): void {
    // Native bar/orientation calls must not withhold an already available
    // chapter. Real window geometry changes use the existing reflow path.
    void this.applyReaderWindowPolicy(snapshot).then((): void => {
      if (this.isSessionActive(lifecycleToken) && mutationGeneration === this.readerSettingsMutationGeneration)
        this.traceInitialReadingPhase?.('settings-window', lifecycleToken);
    }).catch((_error: Error): void => {
      if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.readerSettingsMutationGeneration) return;
      this.readerSettingsSnapshot = safeReaderWindowSettingsFallback(snapshot);
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      this.reflowAfterWindowGeometryChange();
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot).catch((): void => {});
    });
  }

  private changeReaderSetting(key: ReaderSettingsToggleKey, value: boolean): void {
    const snapshot = setReaderSettingsToggle(this.readerSettingsSnapshot, key, value);
    if (key === 'hideStatusBar' || key === 'hideNavigationBar' || key === 'extendIntoCutout') {
      this.commitReaderWindowSettings(snapshot);
      return;
    }
    this.commitReaderSessionSettings(snapshot);
  }

  private changeReaderScreenDirection(direction: ReaderScreenDirection): void {
    this.commitReaderWindowSettings(setReaderScreenDirection(this.readerSettingsSnapshot, direction));
  }

  private changeWidePageLayout(value: ReaderWidePageLayout): void {
    if (this.readingLayout().widthClass !== 'expanded' || !this.readerInputIsCurrent() ||
      this.pageTurnInputPhase() !== 'idle' || value === (this.readerSettingsSnapshot.widePageLayout ?? 'spread')) return;
    if (this.readerSettingsSnapshot.navigationMode === 'continuous' && this.continuousVisibleScalar >= 0) {
      // Reflow keeps the current chapter/scalar from the existing List owner.
      this.desiredChapterOffset = this.continuousVisibleScalar;
    }
    this.commitReaderSessionSettings(setReaderWidePageLayout(this.readerSettingsSnapshot, value));
    this.reflowAfterWindowGeometryChange();
  }

  private changeReaderScreenTimeout(timeout: ReaderScreenTimeout): void {
    this.commitReaderWindowSettings(setReaderScreenTimeout(this.readerSettingsSnapshot, timeout));
  }

  private commitReaderSessionSettings(snapshot: ReaderSettingsSnapshot): void {
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    this.publishLoadedReaderSettings(snapshot);
    this.pageTurnRenderRevision += 1;
    const current = this.captureReaderSettingsAdmission(lifecycleToken, generation);
    void this.persistReaderSettingsSnapshot(snapshot, current).catch((error: Error): void =>
      this.notifyReaderSettingsSavePending(error, current));
  }

  private commitReaderWindowSettings(snapshot: ReaderSettingsSnapshot): void {
    // Keep the old geometry and top-row ownership through drag/rebound. The
    // deferred-work join applies the latest choice after the sheet is idle.
    if (this.pageTurnInputPhase() !== 'idle') {
      this.pageTurnPendingWindowSettings = snapshot;
      this.rollbackPageTurnForDeferredMutation();
      return;
    }
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    const current = this.captureReaderSettingsAdmission(lifecycleToken, generation);
    const previous = this.readerSettingsSnapshot;
    const bodyLayoutChanged = previous.extendIntoCutout !== snapshot.extendIntoCutout ||
      previous.hideStatusBar !== snapshot.hideStatusBar || previous.hideNavigationBar !== snapshot.hideNavigationBar;
    this.readerWindowPolicyGeneration = generation;
    this.readerWindowPolicyPending = true;
    this.publishLoadedReaderSettings(snapshot);
    void completeReaderWindowSettingsCommit(previous, snapshot, {
      current,
      applyPolicy: (settings: ReaderSettingsSnapshot): Promise<void> =>
        this.applyReaderWindowPolicy(settings, this.controlsPresentedForWindow()),
      acceptAppliedPolicy: (): void => {
        this.refreshReaderWindowLayout(bodyLayoutChanged, previous, snapshot);
        this.readerWindowPolicyPending = false;
        this.resumePendingAutoPageTurn();
      },
      restorePreviousSettings: (): void => {
        this.readerSettingsSnapshot = previous;
        this.configureReaderScreenAwakeLease(previous);
        this.applyReaderSystemEventPolicy(previous);
        // Without a Window geometry callback, this restores the old body budget.
        this.refreshReaderWindowLayout(bodyLayoutChanged, previous, snapshot);
      },
      save: (settings: ReaderSettingsSnapshot): Promise<void> => this.persistReaderSettingsSnapshot(settings, current),
      notifySavePending: (error: Error): void => this.notifyReaderSettingsSavePending(error, current),
      notifyPolicyRestored: (error: Error): void =>
        this.showReaderSettingsFailure('窗口设置未能应用，已恢复当前窗口设置', error),
      finishPolicyRequest: (): void => {
        // Another preference can retire the settings admission while this
        // native request is pending. Only a newer window request owns the lock.
        if (this.readerWindowPolicyGeneration === generation) {
          this.readerWindowPolicyPending = false;
          if (this.isSessionActive(lifecycleToken)) this.resumePendingAutoPageTurn();
        }
      },
    });
  }

  private publishLoadedReaderSettings(snapshot: ReaderSettingsSnapshot): void {
    this.readerSettingsSnapshot = snapshot;
    this.readerSettingsLoaded = true;
    this.configureReaderScreenAwakeLease(snapshot);
    this.applyReaderSystemEventPolicy(snapshot);
  }

  private refreshReaderWindowLayout(bodyLayoutChanged: boolean, before: ReaderSettingsSnapshot,
    requested: ReaderSettingsSnapshot): void {
    if (bodyLayoutChanged) this.reflowAfterWindowGeometryChange();
    // Native turn textures include the page-owned information row.
    if (before.hideStatusBar !== requested.hideStatusBar) this.pageTurnRenderRevision += 1;
  }

  private showReaderSettingsFailure(message: string, error: Error): void {
    try { hilog.warn(0x5244, 'Reader', '%{private}s', `Reader settings operation: ${this.errorMessage(error)}`); } catch (_) {}
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive);
    } catch (_) {
      // A retired notice/diagnostic cannot change accepted settings or policy.
    }
  }

  private captureReaderSettingsAdmission(lifecycle: number, generation: number): () => boolean {
    const sourceId = this.sourceId, bookId = this.bookId;
    return (): boolean => this.isSessionActive(lifecycle) && generation === this.readerSettingsMutationGeneration &&
      sourceId === this.sourceId && bookId === this.bookId;
  }

  private notifyReaderSettingsSavePending(error: Error, current: () => boolean): void {
    if (!current() || error.message === 'READER_SETTINGS_OWNER_SUPERSEDED') return;
    this.setReaderPreferenceNotice('settings', this.readerSettingsGateway.writeFacts().pendingReconciliation ?
      '阅读设置保存尚未确认，当前效果已保留。' : '阅读设置未能保存，当前效果已保留，请重试保存。', true);
    try { hilog.warn(0x5244, 'Reader', '%{private}s', this.errorMessage(error)); } catch (_) {}
  }

  private async persistReaderSettingsSnapshot(snapshot: ReaderSettingsSnapshot, current: () => boolean): Promise<void> {
    if (!current()) return;
    await this.readerSettingsGateway.update(snapshot, false, current);
    this.settleReaderPreferenceNotice('settings', current);
  }

  private retryPendingReaderSettings(current: () => boolean): void {
    if (!current()) return;
    if (!this.readerSettingsGateway.writeFacts().pendingReconciliation) {
      this.setReaderPreferenceNotice('settings', '', false);
      return;
    }
    this.setReaderPreferenceNotice('settings', '正在核对并保存阅读设置…', false, true);
    void this.readerSettingsGateway.retryAccepted(current)
      .then((): void => this.settleReaderPreferenceNotice('settings', current))
      .catch((error: Error): void => this.notifyReaderSettingsSavePending(error, current));
  }

  private applyReaderWindowPolicy(snapshot: ReaderSettingsSnapshot,
    forceStatusBarVisible: boolean = this.controlsPresentedForWindow()): Promise<void> {
    if (!this.mounted || !this.appForeground || this.isReaderIdentityCurrent?.() === false) return Promise.resolve();
    // Settings/awake callbacks may settle while this retained reader is hidden.
    // They cannot replace either the App or another visible reader's policy;
    // the explicit visibility transition owns restoration of the App policy.
    if (!this.windowChromeActive) return Promise.resolve();
    AppStorage.setOrCreate<boolean>('readerTopInfoSuppressed',
      forceStatusBarVisible);
    return ReaderWindowCoordinator.requestReaderWindowPolicy(this.windowPolicyFor(snapshot, forceStatusBarVisible),
      this.windowPolicyOwner);
  }

  private configureReaderScreenAwakeLease(snapshot: ReaderSettingsSnapshot): void {
    this.screenAwakeLease?.configure(snapshot.screenTimeout, this.appForeground);
    this.screenAwakeKeepScreenOn = this.screenAwakeLease?.currentKeepScreenOn() ?? false;
  }

  private onScreenAwakeKeepScreenOnChanged(keepScreenOn: boolean): void {
    this.screenAwakeKeepScreenOn = keepScreenOn;
    if (!this.mounted) {
      return;
    }
    void this.applyReaderWindowPolicy(this.readerSettingsSnapshot, this.controlsPresentedForWindow())
      .catch((_error: Error): void => {
        // A later foreground/settings application retries the same semantic
        // lease state through the serialized Window coordinator.
      });
  }

  private applyReaderSystemEventPolicy(snapshot: ReaderSettingsSnapshot): void {
    this.syncVolumeKeyPolicy(snapshot);
    this.readingSystemEventHost?.setScreenOffHandler(snapshot.stopTtsOnScreenOff ?
      (): void => this.stopTtsOnScreenOff() : undefined);
  }

  private syncVolumeKeyPolicy(snapshot: ReaderSettingsSnapshot = this.readerSettingsSnapshot): void {
    // inputConsumer consumes the event before the callback; a no-op callback
    // cannot return it to system volume. Release the native subscription.
    this.readingSystemEventHost?.setVolumeKeyHandler(snapshot.volumeKeysTurnPage &&
      this.isControlInputEnabled() && !this.controlsPresentedForWindow() && !this.windowChromeOverlayActive ?
      (direction: ReaderPageTurnDirection): void => this.onVolumeKeyPageTurn(direction) : undefined);
  }

  private onVolumeKeyPageTurn(direction: ReaderPageTurnDirection): void {
    if (!this.isControlInputEnabled() || this.controlsPresentedForWindow() || this.windowChromeOverlayActive) return;
    this.onReaderManualInteraction();
    this.requestPageTurn(direction);
  }

  private stopTtsOnScreenOff(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) {
      return;
    }
    void coordinator.stop('screenOff')
      .catch((error: Error): void => this.logTtsFailure('screen-off stop', error));
  }

  private windowPolicyFor(snapshot: ReaderSettingsSnapshot,
    forceStatusBarVisible: boolean = false): ReaderWindowPolicy {
    return new ReaderWindowPolicy(
      snapshot.screenDirection,
      this.screenAwakeKeepScreenOn || this.ttsWindowAwakeRequested(),
      // Only the explicit status preference enables immersive hiding.
      // Controls always expose system chrome; cutout owns content geometry.
      snapshot.hideStatusBar === true && !forceStatusBarVisible,
      snapshot.hideNavigationBar,
      snapshot.extendIntoCutout,
      // Phone controls own an independent editing viewport;
      // keep the reading viewport stable instead of offsetting/resizing the root.
      !this.expandedLayout && !ReaderWindowCoordinator.isTabletDevice() ? 'local' : 'system',
    );
  }

  private ttsWindowAwakeRequested(): boolean {
    return this.ttsKeepScreenOn && (this.ttsState.status === 'preparing' ||
      this.ttsState.status === 'playing' || this.ttsState.status === 'resuming');
  }

  private reconcileTtsWindowAwake(previous: boolean): void {
    if (previous === this.ttsWindowAwakeRequested()) return;
    const current = this.captureTtsPreferenceOwner();
    void this.applyReaderWindowPolicy(this.readerSettingsSnapshot, this.controlsPresentedForWindow())
      .catch((error: Error): void => { if (current()) this.logTtsFailure('window-policy', error); });
  }

  private pageStyleChangeGeneration: number = 0;

  private changeReaderPageTurnStyle(style: ReaderPageTurnStyle, continuousSaved: boolean = false): void {
    const changeGeneration = ++this.pageStyleChangeGeneration;
    if (!continuousSaved && this.readerSettingsSnapshot.navigationMode === 'continuous' && style !== 'scroll') {
      const lifecycle = this.lifecycleToken;
      this.continuousAnchorSampler?.();
      void this.commitContinuousProgress(lifecycle).then((): void => {
        if (changeGeneration !== this.pageStyleChangeGeneration || !this.isSessionActive(lifecycle)) return;
        this.changeReaderPageTurnStyle(style, true);
      }).catch((): void => {
        if (changeGeneration !== this.pageStyleChangeGeneration || !this.isSessionActive(lifecycle)) return;
        this.transientFeedback.show(() => this.getUIContext(), { message: '进度保存失败，请重试切换翻页效果' }, (): boolean => changeGeneration === this.pageStyleChangeGeneration && this.isSessionActive(lifecycle) && this.appForeground && this.windowChromeActive);
      });
      return;
    }
    const previous = this.readerSettingsSnapshot;
    const snapshot = setReaderPageTurnStyle(this.readerSettingsSnapshot, style);
    const changed = readerPageTurnStyle(snapshot) !== readerPageTurnStyle(previous);
    const navigationChanged = snapshot.navigationMode !== previous.navigationMode;
    if (changed) {
      this.invalidatePageTurnRuntime(true);
    }
    if (changed && style === 'simulation') {
      // A deliberate settings re-entry performs a fresh native capability
      // probe; an in-flight failed stream never changes renderer mid-gesture.
      this.bookTurnRuntimeFailed = false;
    }
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    this.readerSettingsSnapshot = snapshot;
    this.readerSettingsLoaded = true;
    if (navigationChanged && this.hasCurrentMaterializedChapter()) {
      if (snapshot.navigationMode === 'continuous') {
        this.rebuildContinuousFragments(false, this.visiblePage?.startScalar ?? this.desiredChapterOffset);
        this.continuousProgressRevision += 1;
      } else {
        this.beginCanonicalModeMeasurement(this.continuousVisibleScalar);
      }
    }
    if (changed && readerPageTransitionUsesPreparedPages(snapshot) && this.phase === 'ready') {
      this.schedulePageTurnPreparation();
    }
    const mutationGeneration = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    const admission = this.captureReaderSettingsAdmission(lifecycleToken, mutationGeneration);
    const current = (): boolean => admission() && changeGeneration === this.pageStyleChangeGeneration;
    void this.persistReaderSettingsSnapshot(snapshot, current).catch((error: Error): void =>
      this.notifyReaderSettingsSavePending(error, current));
  }

  private changeAppearanceTheme(theme: ReaderAppearanceTheme): void {
    void this.commitAppearanceMutation((current: () => boolean): Promise<ReaderAppearanceCommit> =>
      ReaderThemeHost.selectReader(theme, current));
  }

  private changeAppearanceDayTheme(theme: ReaderAppearanceTheme): void {
    if (readerThemeDefinition(theme).scheme === 'day') this.changeAppearanceDefaultTheme(theme);
  }

  private changeAppearanceNightTheme(theme: ReaderAppearanceTheme): void {
    if (readerThemeDefinition(theme).scheme === 'night') this.changeAppearanceDefaultTheme(theme);
  }

  private changeAppearanceDefaultTheme(theme: ReaderAppearanceTheme): void {
    void this.commitAppearanceMutation((current: () => boolean): Promise<ReaderAppearanceCommit> =>
      ReaderThemeHost.selectReaderDefault(theme, current));
  }

  private changeAppearanceFont(font: ReaderAppearanceFont): void {
    if (font === 'custom') {
      const lifecycle = this.lifecycleToken;
      const generation = ++this.appearanceMutationGeneration;
      const snapshot = this.appearanceGateway.current();
      void this.appearanceGateway.registerCustomFont(this.getUIContext().getFont(), snapshot)
        .then((registered: boolean): void => {
          if (!this.isSessionActive(lifecycle) || generation !== this.appearanceMutationGeneration) return;
          if (!registered || snapshot.customFont === undefined) {
            this.showAppearanceFailure('字体文件不可用，请重新导入', new Error('CUSTOM_FONT_UNAVAILABLE'));
            return;
          }
          this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
            setReaderAppearanceFont(current, 'custom'));
        }).catch((error: Error): void => {
          if (this.isSessionActive(lifecycle) && generation === this.appearanceMutationGeneration) {
            this.showAppearanceFailure('字体加载失败，请重新导入', error);
          }
        });
      return;
    }
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFont(current, font));
  }

  private changeAppearanceFontOrder(fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation {
    return this.controlFontOrder.request(fontOrder);
  }

  private controlFontOrderPresentationCurrent(identity: string): boolean {
    const page = this.controlPage();
    return this.isControlInputEnabled() && !this.windowChromeOverlayActive && !this.controlShellExitArmed() &&
      (page === 'moduleAppearance' || page === 'fullAppearance') && identity === this.controlMinimumCommittedIdentity() &&
      identity === this.controlMinimumIdentity();
  }

  private importReaderCustomFont(): void {
    const lifecycleToken = this.lifecycleToken;
    const generation = this.appearanceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceMutationGeneration + 1;
    this.appearanceMutationGeneration = generation;
    void this.appearanceGateway.importCustomFont(this.getUIContext().getFont(), (): boolean =>
      this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration)
      .then(async (commit: ReaderAppearanceCommit | undefined): Promise<void> => {
        if (commit === undefined) return;
        this.observeAppearanceSave(commit.saved, lifecycleToken);
        const snapshot = this.appearanceGateway.current();
        await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
        if (this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration) {
          const latest = this.appearanceGateway.current();
          if (sameReaderAppearanceFont(snapshot, latest)) this.admitAppearanceSnapshot(latest);
        }
      })
      .catch((error: Error): void => {
        if (this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration) {
          this.showAppearanceFailure('字体导入失败，请选择有效的 TTF 或 OTF 字体文件', error);
        }
      });
  }

  private changeAppearanceIndent(indent: ReaderAppearanceIndent): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceIndent(current, indent));
  }

  private toggleAppearanceAlignment(current: ReaderAppearanceAlignment): void {
    this.commitAppearanceChange((latest: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      setReaderAppearanceAlignment(latest, latest.alignment === 'start' ? 'justify' : 'start'));
  }

  private stepAppearanceMetric(
    metric: ReaderAppearanceMetric,
    direction: ReaderAppearanceStepDirection,
  ): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      stepReaderAppearanceMetric(current, metric, direction));
  }

  private async commitAppearanceChange(change: ReaderAppearanceChange): Promise<ReaderAppearanceSnapshot | undefined> {
    return this.commitAppearanceMutation(async (current: () => boolean): Promise<ReaderAppearanceCommit | undefined> => {
      await ReaderThemeHost.prepareUserChange();
      return current() ? this.appearanceGateway.update(change, current) : undefined;
    });
  }

  private commitAppearanceMutation(
    commitChange: (current: () => boolean) => Promise<ReaderAppearanceCommit | undefined>,
  ): Promise<ReaderAppearanceSnapshot | undefined> {
    this.appearanceMutationGeneration = this.appearanceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceMutationGeneration + 1;
    const generation = this.appearanceMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    return commitReadingAppearance(this.appearanceGateway, commitChange, {
      sessionCurrent: (): boolean => this.isSessionActive(lifecycleToken),
      mutationCurrent: (): boolean => this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration,
      prepareFont: (snapshot: ReaderAppearanceSnapshot): Promise<void> =>
        prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot)),
      admit: (snapshot: ReaderAppearanceSnapshot): void => this.admitAppearanceSnapshot(snapshot),
      observeSave: (saved: Promise<void>): void => this.observeAppearanceSave(saved, lifecycleToken),
      mutationFailed: (error: Error): void => this.showAppearanceFailure('外观设置暂时无法修改，请重试', error),
    });
  }

  private observeAppearanceSave(saved: Promise<void>, lifecycleToken: number): void {
    void saved.catch((error: Error): void => {
      // The original Store publishes persistent recovery facts, including when this view retires.
      this.refreshAppearanceSaveRecovery(lifecycleToken);
      hilog.warn(0x5244, 'Reader', '%{private}s', `Appearance save pending: ${this.errorMessage(error)}`);
    });
  }

  private showAppearanceFailure(message: string, error: Error): void {
    hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience appearance failed: ${this.errorMessage(error)}`);
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message: message }, (): boolean => this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive);
    } catch (_) {
      // A missing presentation context must not discard accepted settings.
    }
  }

  private admitAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): void {
    const previous = this.appearanceSnapshot;
    const layoutChanged = !sameReaderAppearanceLayout(previous, snapshot);
    const themeChanged = previous.activeTheme !== snapshot.activeTheme;
    if ((layoutChanged || themeChanged) && this.pageTurnInputPhase() !== 'idle') {
      this.pageTurnPendingAppearanceSnapshot = snapshot;
      this.rollbackPageTurnForDeferredMutation();
      return;
    }
    if (layoutChanged || themeChanged) {
      this.invalidatePageTurnRuntime(true);
    }
    const previousLayoutSignature = layoutChanged && this.hasMeasuredViewport() ?
      this.paginationLayoutSignature() : undefined;
    const currentVisibleAnchor = this.readerSettingsSnapshot.navigationMode === 'continuous' ?
      this.continuousVisibleScalar : this.visiblePage !== undefined &&
      this.visiblePageSelectionToken === this.materializedChapterSelectionToken ?
      this.visiblePage.startScalar : this.desiredChapterOffset;

    this.appearanceSnapshot = snapshot;
    if (layoutChanged || themeChanged) this.reconcileSessionLaunchLayout();
    this.applyWindowChrome();
    if (!layoutChanged) {
      if (themeChanged && this.hasCurrentMaterializedChapter() && this.phase === 'ready') {
        this.schedulePageTurnPreparation();
      }
      return;
    }
    if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.paginationLayoutSignature()) {
      this.physicalPagination.index.invalidateLayout(this.sourceId, this.bookId, previousLayoutSignature);
    }
    this.resetPaginationDraft();
    if (!this.hasCurrentMaterializedChapter() || this.phase === 'failed') {
      return;
    }
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.desiredChapterOffset = Math.max(0, Math.min(scalarCount, currentVisibleAnchor));
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
    if (this.measurementCompleting) {
      this.remeasurePending = true;
      this.appearanceReflowInvalidateCurrentLayout = true;
      return;
    }
    this.beginMeasurement(this.lifecycleToken);
  }

  private visibleReadingAppearance(): ReaderAppearanceSnapshot {
    return this.pageReadingAppearance(this.visiblePage);
  }

  private pageReadingAppearance(page: PhysicalReadingPage | undefined): ReaderAppearanceSnapshot {
    return resolveMeasuredReaderAppearanceSnapshot(page?.measuredAppearance, this.appearanceSnapshot);
  }

  private shouldShowSessionCapsule(): boolean {
    return this.sessionLaunch !== undefined || this.sessionCapsuleSnapshot() !== undefined;
  }

  private sessionCapsuleType(): ReaderSessionCapsuleType {
    return this.sessionLaunch?.geometry.type ?? this.sessionCapsuleSnapshot()?.type ?? 'autoPage';
  }

  private sessionCapsuleState(): ReaderSessionCapsuleState {
    return this.sessionLaunch !== undefined ? this.sessionLaunchBusinessStatus() :
      this.sessionCapsuleSnapshot()?.sessionState ?? 'paused';
  }

  private sessionLaunchBusinessStatus(): ReaderSessionCapsuleState {
    const launch = this.sessionLaunch;
    if (launch === undefined) return 'paused';
    if (launch.businessStatus === 'preparing') return 'preparing';
    if (launch.geometry.type === 'autoPage') return this.automaticReadingState().status === 'running' ? 'playing' : 'paused';
    return this.ttsState.status === 'playing' ? 'playing' :
      this.ttsState.status === 'preparing' || this.ttsState.status === 'resuming' ? 'preparing' : 'paused';
  }

  private sessionCapsuleCountdown(): number {
    return this.sessionCapsuleSnapshot()?.countdown ?? 0;
  }

  private sessionCapsuleSnapshot(): ReaderSessionCapsuleSnapshot | undefined {
    if (this.pageTurnSessionCapsuleFrozen) {
      return this.pageTurnSessionCapsuleSnapshot;
    }
    return this.liveSessionCapsuleSnapshot();
  }

  private liveSessionCapsuleSnapshot(ignoreClosingControl: boolean = false): ReaderSessionCapsuleSnapshot | undefined {
    return deriveReaderSessionCapsule({
      mounted: this.mounted,
      exitRequested: this.exitRequested,
      // Hidden neighbour measurement keeps the committed reading page on
      // screen. Its busy phase must not unmount the independent capsule.
      pageReady: this.phase === 'ready' || (this.phase !== 'failed' &&
        this.visiblePage !== undefined && this.visibleFragments.length > 0),
      controlObscured: this.controlObscured,
      interactionBlocked: this.interactionBlocked,
      controlVisible: !ignoreClosingControl && this.controlVisible() &&
        !this.sessionControlClosing && !this.controlShellExitArmed(),
      autoPageStatus: this.automaticReadingState().status,
      autoPageRemainingSeconds: this.automaticReadingState().remainingSeconds,
      ttsStatus: this.ttsState.status,
    });
  }

  private toggleSessionCapsule(): void {
    if (!this.readerInputIsCurrent() || this.pageTurnInputPhase() !== 'idle') return;
    const launch = this.sessionLaunch;
    if (launch !== undefined) {
      if (launch.ownership !== 'stage') return;
      const desired = launch.businessStatus === 'preparing' ? !launch.desiredPlaying : this.sessionLaunchBusinessStatus() !== 'playing';
      this.sessionLaunchController.setDesiredPlaying(launch.generation, desired);
      this.sessionLaunch = this.sessionLaunchController.snapshot();
      if (launch.geometry.type === 'tts') this.ttsTransport.coordinator?.setDesiredPlaying(desired);
      if (launch.businessStatus === 'preparing') return;
      if (launch.geometry.type === 'autoPage') {
        if (desired && this.automaticReadingState().status === 'paused') this.toggleAutoPage();
        else if (!desired && this.automaticReadingState().status === 'running') this.pauseAutoPage('manual');
      } else {
        if (desired && (this.ttsState.status === 'paused' || this.ttsState.status === 'interrupted')) this.toggleTts();
        else if (!desired && this.ttsState.status === 'playing') this.toggleTts();
      }
      return;
    }
    const snapshot = this.sessionCapsuleSnapshot();
    if (snapshot?.type === 'autoPage') this.toggleAutoPage();
    else if (snapshot?.type === 'tts') this.toggleTts();
  }

  private activeSessionCapsuleWidth(): number {
    const type = this.sessionCapsuleType();
    return this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredIdentity === this.sessionCapsuleMeasurementIdentity(type) &&
      this.sessionCapsuleMeasuredWidth > 0 ?
      Math.max(this.sessionCapsuleMeasuredWidth, this.sessionCapsuleMetrics(type).width) : this.sessionCapsuleMetrics(type).width;
  }

  private activeSessionCapsuleHeight(): number {
    const type = this.sessionCapsuleType(), minimum = this.sessionCapsuleMetrics(type).targetHeight;
    return this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredIdentity === this.sessionCapsuleMeasurementIdentity(type) ?
      Math.max(this.sessionCapsuleMeasuredHeight, minimum) : minimum;
  }

  private sessionCapsuleMetrics(type: ReaderSessionCapsuleType = 'autoPage'): ReaderSessionCapsuleMetrics {
    this.readerWindowMetricsRevision;
    return measureReaderSessionCapsule(this.getUIContext(), type, ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private sessionCapsuleLayout(): ReaderPageChromeLayoutSnapshot {
    return resolveReaderPageChromeLayout(this.readingLayout(), new ReaderPageChromeMeasurements(
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      true,
      this.activeSessionCapsuleWidth(),
      this.activeSessionCapsuleHeight(),
    ));
  }

  private sessionCapsuleMeasurementIdentity(type: ReaderSessionCapsuleType): string {
    const generation = type === 'tts' ? this.ttsState.sessionGeneration : this.automaticReadingState().generation;
    return JSON.stringify([type, generation, this.sessionLaunchLayoutKey(), this.appearanceMutationGeneration]);
  }

  private sessionCapsuleMeasurementCurrent(identity: string, type: ReaderSessionCapsuleType): boolean {
    return this.isSessionActive(this.lifecycleToken) && this.sessionLaunch === undefined &&
      this.sessionCapsuleSnapshot()?.type === type && identity === this.sessionCapsuleMeasurementIdentity(type);
  }

  private onSessionCapsuleMeasured(
    identity: string,
    type: ReaderSessionCapsuleType,
    width: number,
    height: number,
  ): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      !this.sessionCapsuleMeasurementCurrent(identity, type)) {
      return;
    }
    if (this.pageChromeStateFrozen()) {
      this.pendingSessionCapsuleMeasurement = new ReaderSessionCapsuleMeasurement(type, identity, width, height);
      return;
    }
    this.admitSessionCapsuleMeasurement(identity, type, width, height);
  }

  private admitSessionCapsuleMeasurement(
    identity: string,
    type: ReaderSessionCapsuleType,
    width: number,
    height: number,
  ): void {
    // Morph frames report transient shell widths; they must not overwrite
    // the settled measurement that anchors the capsule layout.
    if (!this.sessionCapsuleMeasurementCurrent(identity, type)) {
      return;
    }
    if (this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredIdentity === identity &&
      Math.abs(this.sessionCapsuleMeasuredWidth - width) < 0.01 &&
      Math.abs(this.sessionCapsuleMeasuredHeight - height) < 0.01) {
      return;
    }
    this.measuredSessionCapsuleType = type;
    this.sessionCapsuleMeasuredIdentity = identity;
    this.sessionCapsuleMeasuredWidth = width;
    this.sessionCapsuleMeasuredHeight = height;
    this.pageTurnRenderRevision += 1;
  }

  private sessionLaunchLayoutKey(): string {
    this.readerWindowMetricsRevision;
    return `${this.lifecycleToken}|${this.sourceId}|${this.bookId}|${this.viewportWidth}|${this.viewportHeight}|` +
      `${this.paginationLayoutSignature()}|${this.readerAppScheme}|${this.appearanceSnapshot.activeTheme}|` +
      `${ReaderWindowCoordinator.metrics().revision}`;
  }

  @Builder
  private sessionLaunchSourceContent() {
    if (this.sessionLaunchControlSource !== undefined &&
      this.sessionLaunchControlSource.generation === this.sessionLaunch?.generation &&
      this.sessionLaunchControlSource.current()) {
      if (this.sessionLaunchControlSource.kind === 'quickAutoPage' ||
        this.sessionLaunchControlSource.kind === 'fullAutoPagePlayback') {
        ReaderControlAutoPageContent({
          fixedIsland: true,
          sourceMinimum: this.sessionLaunchControlSource.minimum,
          sourceMinimumIdentity: this.sessionLaunchControlSource.minimum?.identity ?? '',
          sourceMinimumKey: this.sessionLaunchControlSource.minimum?.key ?? '',
          sourceMinimumMetricsRevision: this.sessionLaunchControlSource.minimum?.metricsRevision ?? -1,
          sourceOnly: this.sessionLaunchControlSource.kind === 'quickAutoPage' ? 'quick' : 'full',
          form: this.sessionLaunchControlSource.kind === 'quickAutoPage' ? 'quick' : 'full',
          motionProgress: this.sessionLaunchControlSource.motionProgress,
          availableWidth: this.sessionLaunchControlSource.width, availableHeight: this.sessionLaunchControlSource.height,
          fullViewportHeight: this.sessionLaunchControlSource.fullHeight,
          interactionEnabled: false, status: this.sessionLaunchSourceAutoStatus,
          speedSeconds: this.automaticReadingState().speedSeconds,
          timerSummaryText: formatReaderAutoPageFullTimerSummary(this.automaticReadingConfiguration()),
          timerMinutes: this.automaticReadingConfiguration().timerMinutes,
          timerSeconds: this.automaticReadingConfiguration().timerSeconds,
          followHighlight: this.automaticReadingConfiguration().followHighlight,
          canPreviousChapter: this.sessionLaunchControlSource.canPrevious, canNextChapter: this.sessionLaunchControlSource.canNext,
        });
      } else {
        ReaderControlTtsContent({
          fixedIsland: true,
          sourceMinimum: this.sessionLaunchControlSource.minimum,
          sourceMinimumIdentity: this.sessionLaunchControlSource.minimum?.identity ?? '',
          sourceMinimumKey: this.sessionLaunchControlSource.minimum?.key ?? '',
          sourceMinimumMetricsRevision: this.sessionLaunchControlSource.minimum?.metricsRevision ?? -1,
          sourceOnly: this.sessionLaunchControlSource.kind === 'quickTts' ? 'quick' : 'full',
          frozenWaveformSample: this.sessionLaunchControlSource.waveform, reduceMotion: this.reduceMotion,
          form: this.sessionLaunchControlSource.kind === 'quickTts' ? 'quick' : 'full',
          motionProgress: this.sessionLaunchControlSource.motionProgress,
          availableWidth: this.sessionLaunchControlSource.width, availableHeight: this.sessionLaunchControlSource.height,
          fullViewportHeight: this.sessionLaunchControlSource.fullHeight,
          interactionEnabled: false, state: this.sessionLaunchSourceTtsState,
          timerMode: this.ttsTimerMode, timerMinutes: this.ttsTimerMinutes, timerSeconds: this.ttsTimerSeconds,
          engine: this.ttsEngine, language: this.ttsLanguage, person: this.ttsPerson,
          voiceOptions: this.ttsVoiceOptions, followHighlight: this.ttsFollowHighlight,
        });
      }
    }
  }

  private sessionLaunchMeasurementKey(): string {
    const layout = this.controlLayout(this.readerWindowMetricsRevision);
    return `${this.sessionLaunchLayoutKey()}|${this.controlOpenRevision}|${this.controlModuleVisitRevision}|` +
      `${layout.fullPanelWidth}|${layout.fullPanelHeight}|${layout.topBarTop}|${layout.dockBottomGap}|${layout.minimumKey}`;
  }

  private admitSessionMorphSourceMeasurement(measurement: ReaderSessionMorphSourceMeasurement): void {
    if (this.sessionLaunch?.ownership === 'stage') return;
    this.sessionMorphMeasurements.admit(measurement, (): string => this.sessionLaunchMeasurementKey());
  }

  /** Synchronous intent feedback; no screenshot or business Promise can gate it. */
  private beginSessionCapsuleMorph(type: ReaderSessionCapsuleType): boolean {
    if (this.sessionLaunch?.ownership === 'stage') return this.sessionLaunch.geometry.type === type;
    if (this.sessionLaunch?.ownership === 'handoffPending') return false;
    if (this.sessionLaunch !== undefined) this.finishSessionCapsuleMorph();
    if (!this.mounted || !this.appForeground || this.exitRequested || !this.controlVisible() || this.controlObscured) return false;
    this.cancelControlNavigationIntent();
    const kind = readerSessionMorphSourceKindForPage(this.controlPage());
    if (kind === undefined || (type === 'tts') !== (kind === 'quickTts' || kind === 'fullTtsPlayback')) return false;
    let sourceMinimum: ReaderControlPlaybackProfileReceipt | undefined = undefined;
    const nativeMinimumContract = this.effectiveViewportWidth() > 0 && this.effectiveViewportHeight() > 0 &&
      typeof this.controlMinimum.providerIdentity === 'string' && this.controlMinimum.providerIdentity.length > 0;
    if (nativeMinimumContract) {
      const receipt = this.controlPlaybackProfile;
      const module = type === 'tts' ? 'tts' : 'autoPage';
      const layout = this.controlLayout(this.readerWindowMetricsRevision);
      if (receipt === undefined || !readerControlPlaybackProfileMatches(receipt, module,
        this.controlMinimumCommittedIdentity(), layout.minimumKey, ReaderWindowCoordinator.metrics().revision) ||
        receipt.layout.fullPanelWidth !== layout.fullPanelWidth || receipt.layout.fullPanelHeight !== layout.fullPanelHeight ||
        receipt.layout.quickPanelHeight !== layout.quickPanelHeight) return false;
      sourceMinimum = receipt;
    }
    const source = this.sessionMorphMeasurements.current(kind, (): string => this.sessionLaunchMeasurementKey());
    if (source === undefined) {
      // Retain the visible source. A missing/stale measured actor must never
      // cause a blank capture state or a fabricated flight from a stale rect.
      hilog.warn(0x0000, 'ReaderSessionLaunch', 'session launch retained source: measurement not current');
      return false;
    }
    const capsule = this.sessionCapsuleMetrics(type);
    const width = this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredIdentity === this.sessionCapsuleMeasurementIdentity(type) &&
      this.sessionCapsuleMeasuredWidth > 0 ?
      Math.max(this.sessionCapsuleMeasuredWidth, capsule.width) : capsule.width;
    const target = resolveReaderPageChromeLayout(this.readingLayout(), new ReaderPageChromeMeasurements(
      0, 0, 0, 0, 0, 0, 0, 0, true, width, capsule.targetHeight));
    const geometry = buildReaderSessionLaunchGeometry({ source, fixedIsland: true, targetLeft: target.sessionX,
      targetTop: target.sessionY + (capsule.targetHeight - capsule.paintHeight) / 2,
      capsuleWidth: width, capsuleHeight: capsule.paintHeight,
      topBarExitDistance: this.sessionLaunchTopExit, dockExitDistance: this.sessionLaunchDockExit });
    if (geometry === undefined || this.sessionLaunchTopExit <= 0 || this.sessionLaunchDockExit <= 0) return false;
    const identity: ReaderSessionLaunchIdentity = {
      lifecycle: this.lifecycleToken, bookIdentity: `${this.sourceId}:${this.bookId}`,
      moduleVisit: this.controlModuleVisitRevision, viewportRevision: this.readerWindowMetricsRevision,
      scrollRevision: source.revision, layoutRevision: this.measurementEpoch,
      paletteRevision: this.sharedAppearanceRevision, fontRevision: this.appearanceMutationGeneration,
      sourceRevision: source.revision, sourceActorId: source.actorId,
    };
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      const chrome = this.continuousPageChromeSnapshot(this.continuousRenderRevision, this.continuousChromeProgressText);
      this.sessionLaunchChrome = new ReaderPageChromeSnapshot(chrome.topStartText, chrome.topEndText,
        chrome.bottomStartText, chrome.bottomEndText, true, width, capsule.targetHeight);
    } else {
      const page = this.currentPageTurnRenderPage();
      this.sessionLaunchChrome = new ReaderPageChromeSnapshot(page.chromeTopStartText, page.chromeTopEndText,
        page.chromeBottomStartText, page.chromeBottomEndText, true, width, capsule.targetHeight);
    }
    this.sessionLaunchSourceTtsState = this.ttsState;
    this.sessionLaunchSourceAutoStatus = this.automaticReadingState().status;
    this.sessionLaunchSourceControl = copyReaderControlSessionState(this.latestControlVisualSession);
    this.sessionLaunchSourceLayoutKey = this.sessionLaunchLayoutKey();
    this.sessionLaunchStageOpacity = 1;
    this.sessionLaunchEffects.invalidateExit();
    const launch = this.sessionLaunchController.begin(identity, geometry, readerMotionNowMs(), this.reduceMotion);
    this.sessionLaunchSourceSample = launch?.sample;
    this.sessionLaunch = launch;
    if (this.sessionLaunch === undefined) return false;
    if (readerTransitionsEnabled()) readerBeginTransition({ kind: 'launch', action: type,
      subject: 'reader-session-launch', scope: 'reader-session-launch',
      nodes: readerTransitionLaunchNodes(identity.sourceActorId), staticMotion: this.reduceMotion });
    this.capsuleVerification.begin(this.sessionLaunch, readerControlContentLocation(this.sessionLaunchSourceControl), this.reduceMotion);
    this.sessionLaunchSourceMinimum = { generation: this.sessionLaunch.generation, kind: kind,
      requiresNaturalProfile: nativeMinimumContract, receipt: sourceMinimum };
    this.suspendAdjacentMeasurement();
    this.bookTurnTexture.invalidate();
    this.invalidateControlBackdrop();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.pageTurnRenderRevision += 1;
    if (!this.sessionLaunch.sample.controlsPresented) this.commitSessionLaunchControlHidden();
    this.applyWindowPolicyForChromeOwner();
    this.sessionLaunchEffects.scheduleFrame(this.sessionLaunch.generation);
    return true;
  }

  private sessionLaunchRenderWorkBlocked(): boolean {
    const launch = this.sessionLaunch;
    return launch !== undefined && launch.ownership !== 'released' && !launch.sample.settled && !launch.sample.finished;
  }

  private sessionChromeForPresentation(continuousProgressText: string): ReaderPageChromeSnapshot {
    if (this.readerSettingsSnapshot.navigationMode === 'continuous' && !this.pageChromeStateFrozen()) {
      return this.continuousPageChromeSnapshot(this.continuousRenderRevision, continuousProgressText);
    }
    const anchor = `${this.currentChapterIndex()}|${this.visiblePage?.startScalar}|${this.pageChromeClockText}|${this.pageTurnRenderRevision}`;
    if (anchor !== this.sessionLaunchChromeAnchor && !this.pageChromeStateFrozen()) {
      this.sessionLaunchChromeAnchor = anchor;
      // After settlement, follow the live footer and page revisions.
      const chapter = this.chapter;
      const key = this.pageChromePaginationKey(chapter?.chapterIndex ?? -1, this.materializedContentVersion);
      this.sessionLaunchChrome = this.pageChromeSnapshot(chapter?.chapterIndex ?? -1,
        this.visiblePage?.startScalar ?? -1, this.chapterLayoutMap?.scalarCount() ?? 0, key, this.physicalPagination.draft);
    }
    return this.sessionLaunchChrome;
  }

  private commitSessionLaunchControlHidden(): void {
    // The launch sampler already moves the controls offscreen on its own clock.
    this.controlSession = dismissReaderControlSession(this.controlSession, 0);
    this.latestControlVisualSession = copyReaderControlSessionState(this.controlSession);
  }

  private onSessionLaunchReduceMotionChanged(): void {
    if (this.reduceMotion) this.finishSourceSwitchReveal();
    if (this.reduceMotion) this.retirePageTurnForReduceMotion();
    if (!this.reduceMotion || this.sessionLaunch === undefined) return;
    if (this.sessionLaunch.ownership === 'handoffPending') {
      this.finishSessionLaunchHandoff(this.sessionLaunch.generation);
      return;
    }
    if (this.sessionLaunch.ownership !== 'stage') {
      this.finishSessionCapsuleMorph();
      return;
    }
    if (!this.sessionLaunch.sample.finished) this.capsuleVerification.finish(this.sessionLaunch.generation, 'reduce-motion');
    this.sessionLaunch = this.sessionLaunchController.setReduceMotion(true);
    this.commitSessionLaunchControlHidden();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.pageTurnRenderRevision += 1;
    this.applyWindowPolicyForChromeOwner();
  }

  /** A preference change is an explicit motion retirement, not a native
   * capability failure. Before the visual endpoint retain the origin; after
   * it, preserve the dispatched durable decision and join via the static tree. */
  private retirePageTurnForReduceMotion(): void {
    if (!this.mounted || (!this.pageTurnSettlementActive && this.bookTurnMotion === undefined &&
      this.pageTurnSlideTimeline === undefined)) return;
    const generation = this.bookTurnMotion?.generation ?? this.pageTurnSettlementGeneration;
    this.pageTurnSettlementGeneration = generation;
    this.bookTurnSurfaceGeneration = generation;
    this.pageTurnSlideTimeline = undefined;
    this.pageTurnAutomaticStart = undefined;
    this.bookTurnTexture.invalidate(true);
    this.bookTurnSurfaceOpacity = 0;
    if (this.bookTurnMotion !== undefined) stopBookTurnMotion(this.bookTurnMotion);
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookTurnSession.clearCapturedTextures();
    this.bookTurnSession.releaseTerminalFrame(generation);
    this.bookTurnSession.clearSurface(generation);
    if (this.pageTurnAnimationFinished && this.preparedSettlement.commitStarted) {
      // Never revoke a Core write whose reply is pending. Its original
      // prepared owner and generation still classify/promote that receipt.
      if (this.preparedSettlement.prepared !== undefined) {
        if (this.preparedSettlement.commitFinished) this.finishPreparedPageTurnSettlement(generation);
      } else if (this.preparedSettlement.commitFinished && this.preparedSettlement.commitSucceeded) {
        // The destination already owns a resident slot. Await its actual
        // content revision instead of waiting on retired native slot ACKs.
        this.bookTurn2DFallbackPending = true;
        this.pageTurnRenderRevision += 1;
        if (!this.completeBookTurn2DFallback(generation)) this.armPageTurnSettlementDeadline(generation);
      }
      return;
    }
    this.preparedSettlement.discardDestination();
    this.preparedSettlement.releaseCommit();
    this.preparedSettlement.clearResult();
    this.finishPageTurnRollback(generation);
  }

  private onSessionLaunchTtsState(state: ReaderTtsState): void {
    const resume = this.ttsPlayback.acknowledgeResume(state, (): boolean => this.sessionLaunch === undefined);
    if (resume !== undefined) this.showAcknowledgedStaticTtsCapsule(resume);
    if (!readerTtsSessionBlocksAutoPageStart(state.status) &&
      this.staticSessionCapsuleOrigin?.location.module === 'tts') this.staticSessionCapsuleOrigin = undefined;
    const launch = this.sessionLaunch;
    if (launch === undefined || launch.geometry.type !== 'tts' || launch.ownership !== 'stage') return;
    if (state.status === 'error' || state.status === 'failed' || state.status === 'unavailable') {
      this.cancelSessionLaunch('failure'); return;
    }
    if (state.status === 'completed' || (state.status === 'idle' && launch.businessStatus !== 'preparing')) {
      this.cancelSessionLaunch('stop'); return;
    }
    const status = state.status === 'playing' ? 'playing' :
      state.status === 'paused' || state.status === 'interrupted' ? 'paused' : undefined;
    if (status === undefined || !this.sessionLaunchController.acknowledgeBusiness(launch.generation, status)) return;
    const acknowledged = this.sessionLaunchController.snapshot();
    if (acknowledged === undefined) return;
    if (acknowledged !== launch) this.sessionLaunch = acknowledged;
    this.capsuleVerification.ownerState('business-ack', acknowledged, this.sessionLaunchSpeechFacts(acknowledged, state));
  }

  private sessionLaunchSpeechFacts(launch: ReaderSessionLaunchTransaction,
    state: ReaderTtsState = this.ttsState): ReaderControlCapsuleSpeechFacts | undefined {
    if (launch.geometry.type !== 'tts' || !this.controlVerification.observing()) return undefined;
    const transport = this.ttsTransport.coordinator?.getTransportState();
    if (transport === undefined || transport.sessionGeneration !== state.sessionGeneration) return undefined;
    return { engine: transport.engine, sessionGeneration: state.sessionGeneration, status: state.status,
      audioStarted: state.audioStarted === true, audioSession: transport.audioSession, pauseReason: state.pauseReason };
  }

  private sessionLaunchAllowsControlInput(): boolean {
    const ownership = this.sessionLaunch?.ownership;
    return ownership !== 'stage' && ownership !== 'handoffPending';
  }

  private reconcileSessionLaunchLayout(): void {
    const launch = this.sessionLaunch;
    if (launch === undefined || this.sessionLaunchSourceLayoutKey === this.sessionLaunchLayoutKey()) return;
    if (launch.ownership === 'handoffPending') {
      this.finishSessionLaunchHandoff(launch.generation);
    } else if (launch.ownership === 'stage' && !launch.sample.finished) {
      this.cancelSessionLaunch('sourceChanged');
    } else {
      // A settled capsule can be projected from the live footer immediately.
      this.finishSessionCapsuleMorph();
      if (launch.ownership === 'stage') this.rememberStaticSessionCapsuleOrigin(launch.geometry.type, this.sessionLaunchSourceControl);
    }
  }

  private rememberStaticSessionCapsuleOrigin(type: ReaderSessionCapsuleType, controls: ReaderControlSessionState): void {
    const location = readerControlContentLocation(controls);
    if (location.level !== 'secondary' || location.module !== type) return;
    this.staticSessionCapsuleOrigin = { lifecycleToken: this.lifecycleToken, sourceId: this.sourceId, bookId: this.bookId, location };
  }

  private hideControlForStaticSessionCapsule(type: ReaderSessionCapsuleType): void {
    this.hideControl('host-dismiss', type);
  }

  private restoreSessionLaunchControl(durationMs: number): void {
    const hidden = dismissReaderControlSession(this.sessionLaunchSourceControl, 0);
    const restored = resumeReaderControlSessionTarget(hidden,
      readerControlContentLocation(this.sessionLaunchSourceControl), durationMs);
    if (restored.transition !== undefined) {
      // Module pose is retained and uses the existing OPEN clock for offsets.
      restored.transition.kind = 'open';
      restored.transition.intent = 'forward';
    }
    this.controlSession = restored;
    this.latestControlVisualSession = copyReaderControlSessionState(restored);
  }

  private finishSessionLaunchHandoff(generation: number): void {
    if (this.sessionLaunch?.generation !== generation || this.sessionLaunch.ownership !== 'handoffPending') return;
    // Restore the live control at its endpoint. The obsolete rectangle never
    // becomes a readiness ACK, and cannot hold ownership across revisions.
    this.restoreSessionLaunchControl(0);
    this.finishSessionCapsuleMorph();
  }

  private cancelSessionLaunch(reason: ReaderSessionLaunchCancelReason): void {
    if (this.sessionLaunch === undefined || this.sessionLaunch.ownership !== 'stage') return;
    const launch = this.sessionLaunchController.cancel(reason);
    if (launch === undefined) return;
    this.sessionLaunch = launch;
    this.capsuleVerification.ownerState('cancel-request', launch, this.sessionLaunchSpeechFacts(launch),
      launch.geometry.type === 'autoPage' ? this.automaticReadingState().status : undefined);
    this.capsuleVerification.finish(launch.generation, reason);
    if (reason === 'stop' || reason === 'failure') {
      if (launch.geometry.type === 'tts') this.ttsPlayback.cancelPending();
      else this.cancelPendingAutoPageStart();
    }
    if (launch.ownership === 'released') { this.finishSessionCapsuleMorph(); return; }
    if (reason === 'stop') {
      this.sessionLaunchFooterExiting = true;
      this.sessionLaunchFooterOffset = launch.sample.footerTranslateX;
      this.sessionLaunchFooterOpacity = launch.sample.footerOpacity;
      this.sessionLaunchFooterExitProgress = 0;
      if (launch.sample.finished) {
        AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
        this.pageTurnRenderRevision += 1;
      }
    }
    if (launch.ownership === 'handoffPending') {
      if (readerTransitionsEnabled()) readerBeginTransition({ kind: 'launch', action: launch.geometry.type,
        subject: 'reader-session-launch-handoff', scope: 'reader-session-launch-handoff',
        nodes: readerTransitionLaunchNodes(launch.identity.sourceActorId), launchHandoff: true });
      if (this.sessionLaunchSourceLayoutKey !== this.sessionLaunchLayoutKey()) {
        this.finishSessionLaunchHandoff(launch.generation);
        return;
      }
      const duration = readerControlMotionMs(READER_CONTROL_OPEN_MS, this.reduceMotion);
      this.sessionLaunchEffects.armDeadline(duration, (): void => this.finishSessionLaunchHandoff(launch.generation));
      this.restoreSessionLaunchControl(duration);
      this.applyWindowPolicyForChromeOwner();
    } else this.sessionLaunchEffects.fadeExit(launch.generation);
  }

  private onSessionLaunchSourceReady(generation: number): void {
    if (!this.mounted || this.sessionLaunch?.generation !== generation || this.sessionLaunch.ownership !== 'handoffPending') return;
    if (this.sessionLaunchSourceLayoutKey !== this.sessionLaunchLayoutKey()) {
      this.finishSessionLaunchHandoff(generation);
      return;
    }
    if (!this.sessionLaunchController.confirmHandoffReady(generation)) return;
    this.sessionLaunch = this.sessionLaunchController.snapshot();
    const launch = this.sessionLaunch;
    if (launch !== undefined) this.capsuleVerification.ownerState('handoff-ready', launch, this.sessionLaunchSpeechFacts(launch),
      launch.geometry.type === 'autoPage' ? this.automaticReadingState().status : undefined);
    this.sessionLaunchEffects.fadeExit(generation);
  }

  private finishSessionCapsuleMorph(releasedLaunch?: ReaderSessionLaunchTransaction): void {
    this.sessionLaunchEffects.clearDeadline();
    this.capsuleVerification.discardHandoffFade();
    this.sessionLaunchEffects.cancelExitAnimator();
    const launch = releasedLaunch ?? this.sessionLaunch;
    const hadLaunch = launch !== undefined;
    if (launch !== undefined) {
      this.capsuleVerification.ownerState('retired', launch, this.sessionLaunchSpeechFacts(launch),
        launch.geometry.type === 'autoPage' ? this.automaticReadingState().status : undefined);
      this.capsuleVerification.finish(launch.generation, launch.cancelReason ?? 'retired');
    }
    this.sessionLaunchEffects.invalidateExit();
    this.sessionLaunchController.dispose();
    this.sessionLaunch = undefined;
    this.sessionLaunchSourceSample = undefined;
    this.sessionLaunchControlSource = undefined;
    this.sessionLaunchSourceMinimum = undefined;
    this.sessionLaunchEffects.retireFrame();
    this.sessionLaunchStageOpacity = 1;
    this.sessionLaunchFooterExiting = false;
    this.sessionLaunchFooterExitProgress = 0;
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', false);
    if (hadLaunch) this.pageTurnRenderRevision += 1;
    if (this.mounted && !this.exitRequested) {
      this.applyWindowPolicyForChromeOwner();
      this.drainPageTurnPreparationQueue();
    }
  }

  private onSharedAppearanceChanged(): void {
    if (this.mounted && !this.exitRequested && this.appearanceLoaded) {
      this.controlFontOrder.reconcile();
      // Shared preference notifications may arrive before the initiating
      // control's font receipt. Use the same readiness and stale-owner guards.
      void this.loadAppearanceSnapshot(this.lifecycleToken);
    }
  }


  private refreshPageChromeClock(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    const clockText = formatReaderPageClock(Date.now());
    if (this.pageChromeStateFrozen()) {
      this.pendingPageChromeClockText = clockText;
      return;
    }
    this.admitPageChromeClock(clockText);
  }

  private admitPageChromeClock(clockText: string): void {
    if (this.pageChromeClockText === clockText) {
      return;
    }
    this.pageChromeClockText = clockText;
    this.pageTurnRenderRevision += 1;
    this.scheduleBookTurnTextureRefresh();
  }

  private armPageChromeStatusTimer(lifecycleToken: number): void {
    this.clearPageChromeStatusTimer();
    const now = Date.now();
    const nextMinuteDelay = 60050 - (now % 60000);
    this.pageChromeStatusTimer = setTimeout((): void => {
      this.pageChromeStatusTimer = -1;
      if (!this.isSessionActive(lifecycleToken)) {
        return;
      }
      this.refreshPageChromeClock(lifecycleToken);
      this.armPageChromeStatusTimer(lifecycleToken);
    }, nextMinuteDelay);
  }

  private clearPageChromeStatusTimer(): void {
    if (this.pageChromeStatusTimer >= 0) {
      clearTimeout(this.pageChromeStatusTimer);
      this.pageChromeStatusTimer = -1;
    }
  }

  private pageChromeStateFrozen(): boolean {
    return this.pageTurnSettlementActive || this.pageTurnGestureState.phase === 'tracking' ||
      this.pageTurnGestureState.phase === 'dragging' ||
      this.pageTurnGestureState.phase === 'settling';
  }

  private flushDeferredPageChromeState(): void {
    if (this.pageChromeStateFrozen()) {
      return;
    }
    this.flushDeferredReadingImagePixels();
    this.pageTurnSessionCapsuleFrozen = false;
    this.pageTurnSessionCapsuleSnapshot = undefined;
    const clockText = this.pendingPageChromeClockText;
    this.pendingPageChromeClockText = undefined;
    if (clockText !== undefined) {
      this.admitPageChromeClock(clockText);
    }
    const pending = this.pendingSessionCapsuleMeasurement;
    this.pendingSessionCapsuleMeasurement = undefined;
    if (pending !== undefined && pending.width > 0 && pending.height > 0) {
      this.admitSessionCapsuleMeasurement(pending.identity, pending.type, pending.width, pending.height);
    }
  }

  private isReaderPageInteractionEnabled(): boolean {
    // Once a committed page is visible, speculative neighbour preparation
    // must never disable the full-screen arena or the centre control tap.
    // Page/bookmark motion is gated separately by canStartReaderPageTurn and
    // canStartReaderBookmarkGesture while the background lane is busy.
    return this.readerInputIsCurrent() && !this.controlVisible();
  }

  private isReaderPageArbitrationEnabled(): boolean {
    return !this.readerTextSelectionActive && this.isReaderPageInteractionEnabled();
  }

  private admitReaderTextSelectionActivity(owner: string, active: boolean): void {
    this.textSelectionActivity.change(owner, active);
    const selected = this.textSelectionActivity.active();
    if (selected === this.readerTextSelectionActive) return;
    this.readerTextSelectionActive = selected;
    if (!selected) return;
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') this.retireReaderRecovery();
    else this.retirePagePointer();
  }

  private onReaderKeyEvent(event: KeyEvent): boolean {
    const action = readerHardwareKeyboardShortcut(event, {
      bodyOwnsInput: this.isReaderPageInteractionEnabled() && !this.windowChromeOverlayActive &&
        !this.sourceSwitchPresentationVisible && this.sourceSwitchFailureMessage.length === 0 &&
        !this.sourceSwitchRollbackInFlight && !this.shouldShowSourceSwitchPreparation() && !this.shouldShowChapterLoading() &&
        this.controlTemporaryLayer.length === 0 && !ReaderNativeAlertWindow.isPresented() &&
        this.sessionLaunch === undefined && !this.readerRecoveryRequestCurrent() && this.phase === 'ready',
      inputFocused: readerControlKeyboardVisible(ReaderWindowCoordinator.metrics()),
      selectionActive: this.textSelectionActivity.active(),
    });
    if (action === undefined) return false;
    if (action === 'back') this.requestExit();
    else if (action === 'next' || action === 'previous') this.requestPageTurn(action);
    else this.openReaderControl(undefined, action);
    return true;
  }

  private syncSmartGestureMonitor(): void {
    if (!this.mounted || !this.appForeground || !this.windowChromeActive || !this.smartGestureSettings.enabled ||
      this.isReaderIdentityCurrent?.() === false) {
      this.smartGestureHost.detach();
      return;
    }
    try {
      this.smartGestureHost.attach(this.getUIContext(), {
        decide: (gesture: ReaderSmartGesture): ReaderSmartGestureAction => this.smartGestureDecision(gesture),
        dispatch: (action: ReaderSmartGestureAction): void => this.dispatchSmartGesture(action),
      });
    } catch (_) { this.smartGestureHost.detach(); }
  }

  private smartGestureDecision(gesture: ReaderSmartGesture): ReaderSmartGestureAction {
    const control = readerControlContentLocation(this.latestControlVisualSession);
    return readerSmartGestureAction(gesture, this.smartGestureSettings, {
      foreground: this.readerInputIsCurrent(),
      controlsOpen: this.controlVisible() || this.sessionLaunch !== undefined,
      directoryOpen: control.level === 'secondary' && control.module === 'directory',
      sourceSwitchOpen: this.sourceSwitchPresentationVisible || this.windowChromeOverlayActive,
      settingsOpen: control.level === 'secondary' && (control.module === 'settings' || control.module === 'appearance'),
      dialogOpen: this.controlTemporaryLayer.length > 0 || this.readerRecoveryRequestCurrent() ||
        ReaderNativeAlertWindow.isPresented(),
      selectionActive: this.textSelectionActivity.active(),
      zoomed: false,
      chapterLoading: this.phase !== 'ready' || this.shouldShowChapterLoading() ||
        this.chapterSelection.ticket !== undefined || this.pageTurnOwnsReaderInput(),
      sourceSwitching: this.sourceSwitchRollbackInFlight || this.sourceSwitchFailureMessage.length > 0 ||
        this.sessionGateway?.hasPendingSourceSwitch() === true,
      continuous: this.readerSettingsSnapshot.navigationMode === 'continuous',
    });
  }

  private dispatchSmartGesture(action: ReaderSmartGestureAction): void {
    if (action === 'back') this.requestExit();
    else if (action === 'toggleControls') this.openReaderControl();
    else if (action === 'pageNext') this.requestPageTurn('next');
    else if (action === 'scrollNext') {
      this.onReaderManualInteraction();
      this.performContinuousPageTurn('next', READER_SMART_GESTURE_VIEWPORT_FRACTION);
    }
  }

  /**
   * Only a visual/Core settlement is non-interruptible. Speculative neighbour
   * measurement has its own readiness gate and must leave controls responsive.
   */
  private pageTurnTapOnlyInput(): boolean {
    return this.readerWindowPolicyPending || this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined;
  }

  /** One derived phase is the only control/page-turn ownership decision. */
  private pageTurnInputPhase(): ReaderPageTurnInputPhase {
    if (this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined ||
      this.pageTurnGestureState.phase === 'settling') return 'settling';
    if (this.pageTurnGestureState.phase === 'dragging') return 'dragging';
    if (this.pageTurnGestureState.phase === 'tracking') return 'tracking';
    return 'idle';
  }

  /** Geometry/layout mutations wait for an active sheet to roll back first. */
  private rollbackPageTurnForDeferredMutation(): void {
    if (this.pageTurnGestureState.owner === 'bookmark') {
      this.retirePagePointer();
      return;
    }
    const phase = this.pageTurnInputPhase();
    if (phase === 'settling') {
      this.rollbackUncommittedBookTurnSettlement();
      return;
    }
    if (phase !== 'tracking' && phase !== 'dragging') return;
    const cancelled = cancelReaderPagePan(this.pageTurnGestureState);
    if (cancelled !== this.pageTurnGestureState) this.onReaderPageGestureStateChanged(cancelled);
  }

  private rollbackUncommittedBookTurnSettlement(): boolean {
    if (!this.usesBookTurnSimulation() || this.preparedSettlement.prepared === undefined ||
      this.pageTurnAnimationFinished || this.preparedSettlement.commitStarted) return false;
    const generation = this.pageTurnSettlementGeneration;
    this.preparedSettlement.discardDestination();
    this.preparedSettlement.clearResult();
    this.autoPageCoordinator.retryTurn(this.automaticReadingState().generation);
    if (!this.bookTurnSession.settle(generation, false)) {
      this.failBookTurnRuntime();
    }
    return true;
  }

  /** Page-turn and control surfaces are mutually exclusive input owners. */
  private pageTurnOwnsReaderInput(): boolean {
    return this.pageTurnInputPhase() !== 'idle';
  }

  /**
   * Native Text selection is valid only while the body is the sole stable
   * interaction owner. Control/full-screen overlays, page movement and
   * automatic sessions invalidate the system overlay instead of letting its
   * handles leak above a different reader mode.
   */
  private readerTextSelectionEnabled(): boolean {
    if (!this.readerInputIsCurrent()) return false;
    return readerTextSelectionEnabled({
      configured: this.readerSettingsSnapshot.longPressSelectText,
      mounted: this.mounted,
      exitRequested: this.exitRequested,
      pageReady: this.phase === 'ready',
      controlVisible: this.controlVisible(),
      controlObscured: this.controlObscured,
      interactionBlocked: this.interactionBlocked,
      pageTurnActive: this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined ||
        this.pageTurnGestureState.phase === 'dragging' || this.pageTurnGestureState.phase === 'settling' ||
        readerRapidPageTurnHasWork(this.rapidPageTurnState),
      autoPageActive: this.automaticReadingState().status !== 'stopped',
      ttsActive: readerTtsSessionBlocksAutoPageStart(this.ttsState.status),
    });
  }

  private publishControlVerificationReady(): void {
    if (this.phase !== 'ready' || this.viewportWidth <= 0 || this.viewportHeight <= 0 ||
      !this.isReaderPageInteractionEnabled() || this.pageTurnOwnsReaderInput() ||
      this.sessionLaunch !== undefined || this.controlTemporaryLayer.length > 0) return;
    const mode = readerRenderStageKind(this.readerSettingsSnapshot.navigationMode, this.hasContinuousRenderContent());
    this.controlVerification.ready(mode === 'continuous' ? 'continuous' : 'paged', this.controlSession,
      this.controlOpenRevision, this.sourceId === 'local', this.reduceMotion, this.chapter?.chapterIndex ?? -1);
  }

  private openReaderControl(verificationOrigin?: ReaderControlVerificationOrigin,
    shortcutModule?: 'search' | 'directory'): void {
    this.retireReaderRecovery();
    if (this.sessionLaunch !== undefined) { this.cancelSessionLaunch('openControl'); return; }
    if (this.pageTurnSettlementActive && this.preparedSettlement.commitStarted && !this.preparedSettlement.commitFinished) {
      this.activeGateway().handoffPendingProgress();
      this.releasePageTurnRecoveryInput();
    }
    if (!this.isControlInputEnabled() || !this.isReaderPageInteractionEnabled() || this.pageTurnOwnsReaderInput()) {
      return;
    }
    this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    // Prime the retained List before the show clock starts. If the TOC is
    // already admitted this prevents its first materialization from landing
    // on an animation frame; if it is still loading the flag is harmless and
    // the later admission supplies the stable projection.
    this.controlDirectoryDataRetained = true;
    this.publishControlDirectoryData();
    this.invalidateControlBackdrop();
    this.controlOpenRevision += 1;
    const duration = this.controlTiming().showDurationMs;
    const origin = this.staticSessionCapsuleOrigin;
    this.staticSessionCapsuleOrigin = undefined;
    const playbackOrigin = origin !== undefined && origin.lifecycleToken === this.lifecycleToken &&
      origin.sourceId === this.sourceId && origin.bookId === this.bookId &&
      this.liveSessionCapsuleSnapshot()?.type === origin.location.module ? origin.location : undefined;
    const opened = openReaderControlSession(this.controlSession, duration);
    const shortcutTarget = shortcutModule === undefined ? undefined : readerControlTargetLocation(
      setReaderControlHostPage(opened, shortcutModule === 'search' ? 'quickSearch' : 'moduleDirectory', this.controlTiming()));
    const target = shortcutTarget ?? playbackOrigin;
    const nextControl = target === undefined ? opened :
      resumeReaderControlSessionTarget(this.controlSession, target, duration);
    if (target !== undefined && nextControl.transition !== undefined) {
      nextControl.transition.kind = 'open';
      nextControl.transition.intent = 'forward';
    }
    if (verificationOrigin !== undefined) {
      this.controlVerification.accept(verificationOrigin, this.controlSession, nextControl, this.controlOpenRevision);
    }
    this.controlSession = nextControl;
    void this.loadContentMetricsIfNeeded(this.lifecycleToken);
    this.brightnessSession.refresh();
  }

  private hideControl(origin: ReaderControlVerificationOrigin = 'host-dismiss', capsuleType?: ReaderSessionCapsuleType): void {
    if (!this.controlVisible()) return;
    this.staticSessionCapsuleOrigin = undefined;
    const activeType = capsuleType ?? this.liveSessionCapsuleSnapshot(true)?.type;
    if (activeType !== undefined) this.rememberStaticSessionCapsuleOrigin(activeType, this.controlSession);
    this.invalidateControlBackdrop();
    // A complete close also ends text input, including a stale/zero inset
    // snapshot. This is a UI request only and cannot clear a failed selection.
    // Do not issue an asynchronous IME hide for every ordinary directory
    // close. On HarmonyOS the controller may already be detached; the failed
    // hide callback forces extra main-thread work exactly while the dismiss
    // compositor is settling. A current, visible keyboard inset is the only
    // proof that this close owns an IME surface.
    if (readerControlKeyboardVisible(ReaderWindowCoordinator.metrics())) {
      hideReaderControlKeyboard(this.controlKeyboardHost());
    }
    this.dismissControlTemporaryLayers();
    const previous = this.latestControlVisualSession ?? this.controlSession;
    const next = dismissReaderControlSession(previous, this.controlTiming().dismissDurationMs);
    this.controlVerification.accept(origin, previous, next, this.controlOpenRevision);
    this.controlSession = next;
    this.pageTurnRenderRevision += 1;
  }

  /** The current visual sample, kept outside the reading @State tree. */
  private controlMotionSession(): ReaderControlSessionState {
    return this.latestControlVisualSession;
  }

  // Keep these projections as ordinary methods. The current ArkUI V1 struct
  // member transform drops hand-written get accessors, yielding undefined at
  // runtime even though TS-only tests can execute them. Never mirror @State.
  private controlVisible(): boolean {
    return readerControlHostVisible(this.controlSession);
  }

  private controlShellExitArmed(): boolean {
    return readerControlHostClosing(this.controlSession);
  }

  private controlPage(): ReaderControlPage {
    return readerControlHostPage(this.controlSession);
  }

  /** Presentation-only visibility used by touch/back decisions mid-frame. */
  private controlMotionVisible(): boolean {
    return readerControlHostVisible(this.controlMotionSession());
  }

  /** Presentation-only page projection; never used for async business guards. */
  private controlMotionPage(): ReaderControlPage {
    return readerControlHostPage(this.controlMotionSession());
  }

  private controlTiming(): ReaderControlHostTiming {
    return {
      showDurationMs: readerControlMotionMs(READER_CONTROL_OPEN_MS, this.reduceMotion),
      dismissDurationMs: readerControlMotionMs(READER_CONTROL_DISMISS_MS, this.reduceMotion),
      morphDurationMs: readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.reduceMotion),
      layerDurationMs: readerControlMotionMs(READER_CONTROL_LAYER_SWITCH_MS, this.reduceMotion),
      navigateDurationMs: readerControlMotionMs(READER_CONTROL_MODULE_SWITCH_MS, this.reduceMotion),
      directSheetDurationMs: this.reduceMotion ? READER_REDUCED_FADE_MS : READER_SHEET_OPEN_MS,
      directSheetCloseDurationMs: this.reduceMotion ? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS,
      fixedIsland: true,
    };
  }

  private isControlInputEnabled(): boolean {
    return this.readerInputIsCurrent();
  }

  private readerInputIsCurrent(): boolean {
    return readerControlHostInputEnabled({ mounted: this.mounted, exitRequested: this.exitRequested,
      appForeground: this.appForeground, windowChromeActive: this.windowChromeActive,
      interactionBlocked: this.interactionBlocked, controlObscured: this.controlObscured }) &&
      this.isReaderIdentityCurrent?.() !== false && (this.inputCurrent?.() ?? true);
  }

  private controlKeyboardHost(): ReaderControlKeyboardHost {
    const lifecycleToken = this.lifecycleToken;
    return {
      // Public app API, since 10. hideSoftKeyboard is a different, system-only
      // API requiring CONNECT_IME_ABILITY and must not be used here.
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (!this.isMountedToken(lifecycleToken)) return;
        hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience keyboard hide failed: ${this.errorMessage(error)}`);
      },
    };
  }

  private invalidateControlBackdrop(): void {
    this.controlInputRevision += 1;
    this.controlBackdropState = createReaderControlBackdropTouchState();
  }

  private onControlInputBoundaryChanged(): void {
    this.observeReadingPrefetch?.();
    this.controlFontOrder.reconcile();
    this.refreshAppearanceSaveRecovery(this.lifecycleToken);
    if (!this.readerInputIsCurrent() || this.windowChromeOverlayActive) this.retirePendingPlaybackStarts();
    if (!this.isControlInputEnabled()) this.retirePagePointer();
    this.controlMinimum.invalidateRequest();
    this.scheduleControlMinimum();
    if (!this.appForeground || this.interactionBlocked || this.controlObscured) this.cancelAutomaticPageStart?.();
    if (this.mounted && this.appForeground && this.ttsTransport.coordinator !== undefined &&
      this.isReaderIdentityCurrent?.() !== false && (!this.isControlInputEnabled() || this.windowChromeOverlayActive)) {
      // Audition belongs to the temporary control surface. Its child may
      // receive the new Props after the retained reader has lost foreground.
      this.stopReaderTtsAudition();
    }
    this.invalidateControlBackdrop();
    this.syncVolumeKeyPolicy();
    this.publishControlVerificationReady();
  }

  private retirePagePointer(): void {
    const phase = this.pageTurnInputPhase();
    const bookmark = this.pageTurnGestureState.owner === 'bookmark';
    if (this.activePagePointerId < 0 && !this.pendingPointerSegmentReserved &&
      !bookmark && phase !== 'tracking' && phase !== 'dragging') return;
    this.pageTurnInputRevision += 1;
    this.activePagePointerId = -1;
    this.pagePointerEpoch += 1;
    this.pendingPointerSegmentReserved = false;
    if (bookmark) {
      this.finishInterruptedBookmarkGesture();
      this.resumeDeferredPageTurnWork();
      if (this.appForeground && !this.exitRequested) this.schedulePagePointerCompletion();
    } else if (phase === 'tracking' && this.readerTextSelectionActive) {
      this.onReaderPageGestureStateChanged(abandonReaderPageGestureTracking(this.pageTurnGestureState));
    } else if (phase === 'tracking' || phase === 'dragging') {
      this.rollbackPageTurnForDeferredMutation();
    }
  }

  private dismissControlTemporaryLayers(): void {
    this.retireControlTemporaryRevision += 1;
    this.dismissControlTemporaryRevision += 1;
    this.controlTemporaryLayer = '';
    this.controlTemporaryLayerPresented = '';
  }

  private onControlTemporaryLayerChanged(active: boolean, kind: ReaderControlTemporaryInputKind = 'modal'): void {
    const next = active ? kind : '';
    if (this.controlTemporaryLayer === next) return;
    this.controlTemporaryLayer = next;
    const lifecycle = this.lifecycleToken;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.isSessionActive(lifecycle)) return;
      this.controlTemporaryLayerPresented = this.controlTemporaryLayer;
      this.invalidateControlBackdrop();
    }));
  }

  private onControlSessionChanged(): void {
    this.controlFontOrder.reconcile();
    this.controlVerification.observeHostState(this.controlSession, this.controlOpenRevision);
    if (this.controlVisible()) this.cancelAutomaticPageStart?.();
    else this.scheduleTtsPageFollowResume?.();
    // Keep the non-reactive decision snapshot aligned even before the child
    // Panel's sparse watcher runs.  This assignment does not participate in
    // build invalidation.
    this.latestControlVisualSession = copyReaderControlSessionState(this.controlSession);
    this.admitSessionControlClosing(readerControlHostClosing(this.controlSession));
    // Status-bar visibility follows the control session rather than the
    // mounted reader route, including the first collapse/open frame.
    this.applyWindowPolicyForChromeOwner();
    if (this.controlVisible()) this.suspendAdjacentMeasurement();
    const page = this.controlPage();
    const previous = this.observedControlPage;
    if (page !== previous) {
      this.observedControlPage = page;
      if ((previous === 'quickSearch' || previous === 'fullSearch') &&
        page !== 'quickSearch' && page !== 'fullSearch' &&
        this.quickSearchPublication.retirePresentation()) this.quickSearchRevision += 1;
      if (previous === 'quickReplace' && page !== 'quickReplace') this.replacePanel.advancePanel();
    }
    const location = readerControlContentLocation(this.controlSession);
    const module = location.level === 'secondary' ? location.module : 'home';
    if (module !== this.observedControlModule) {
      this.controlModuleVisitRevision += 1;
      this.observedControlModule = module;
      this.prepareControlPage(page);
    }
    // The module/opening identity changes only at semantic edges, never p.
    this.controlMinimum.invalidateLayout();
    if (!readerControlHostCloseCommitted(this.controlSession, this.observedControlCloseRevision)) return;
    this.observedControlCloseRevision = this.controlSession.closeRevision;
    this.invalidateControlBackdrop();
    // A Stage-owned downward drag may commit without calling hideControl().
    if (readerControlKeyboardVisible(ReaderWindowCoordinator.metrics())) {
      hideReaderControlKeyboard(this.controlKeyboardHost());
    }
    this.dismissControlTemporaryLayers();
    this.quickSearchPublication.cancel();
    this.replacePanel.advancePanel();
    this.quickSearchQuery = '';
    this.publishQuickSearchState({ kind: 'idle' });
    // Reading/TTS/auto-page/selection ownership is not reset by closing UI.
    if (this.mounted && !this.exitRequested) {
      this.drainPageTurnPreparationQueue();
      this.resumePendingAutoPageTurn();
    }
  }

  private admitSessionControlClosing(closing: boolean): void {
    // Drag dismissal is driven inside Panel. Publish only this ownership edge,
    // not every control frame, so an existing capsule can mount at first close.
    if (this.sessionControlClosing === closing) return;
    this.sessionControlClosing = closing;
    this.pageTurnRenderRevision += 1;
  }

  /** Native rounded-rectangle containment; translation does not rebuild the local path. */
  private controlBackdropContainsRoundedRect(rect: ReaderControlBackdropRect, x: number, y: number): boolean {
    const radius = rect.borderRadius ?? 0;
    if (this.controlBackdropPath === undefined || this.controlBackdropPathWidth !== rect.width ||
      this.controlBackdropPathHeight !== rect.height || this.controlBackdropPathRadius !== radius) {
      const path = new drawing.Path();
      path.addRoundRect(new drawing.RoundRect({ left: 0, top: 0, right: rect.width, bottom: rect.height },
        radius, radius));
      this.controlBackdropPath = path;
      this.controlBackdropPathWidth = rect.width;
      this.controlBackdropPathHeight = rect.height;
      this.controlBackdropPathRadius = radius;
    }
    return this.controlBackdropPath.contains(x - rect.x, y - rect.y);
  }

  private onControlBackdropTouch(event: TouchEvent): void {
    if (!this.isControlInputEnabled() || event.type === TouchType.Cancel) {
      this.controlBackdropState = createReaderControlBackdropTouchState();
      return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (let i = 0; i < pointers.length; i += 1) {
      const pointer = pointers[i];
      const touch: ReaderControlBackdropTouchEvent = {
        kind: event.type === TouchType.Down ? 'down' : event.type === TouchType.Up ? 'up' : 'move',
        pointerId: pointer.id, windowX: pointer.windowX, windowY: pointer.windowY, timeMs: readerMotionNowMs(),
      };
      const result = reduceReaderControlBackdropTouch(this.controlBackdropState, touch, {
        visible: this.controlMotionVisible(), geometryReady: this.controlBackdropGeometryReady,
        heldPointerId: this.controlMotionSession().heldPointerId,
        closeRevision: this.controlMotionSession().closeRevision,
        invalidationRevision: this.controlInputRevision, excludedRects: this.controlBackdropRegions,
        containsRoundedRect: (rect: ReaderControlBackdropRect, x: number, y: number): boolean =>
          this.controlBackdropContainsRoundedRect(rect, x, y),
      }, { tapMaxDurationMs: 500, touchSlopVp: 8 });
      this.controlBackdropState = result.state;
      if (result.shouldDismiss) { this.hideControl('backdrop'); return; }
    }
  }

  private reloadCurrentChapterAfterContentProjectionChange(
    lifecycleToken: number,
    chapterIndex: number,
  ): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    if (this.pageTurnSettlementActive) {
      this.pageTurnPendingProjectionChapterIndex = chapterIndex;
      return;
    }
    this.invalidatePageTurnRuntime(true);
    if (this.chapter?.chapterIndex !== chapterIndex) {
      return;
    }
    this.contentMetrics = undefined;
    this.physicalPagination.index.invalidateBook(this.sourceId, this.bookId);
    this.chapterWindow.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.resetPaginationDraft();
    const page = this.visiblePage;
    if (page !== undefined) {
      void this.reloadMigratedContentPosition(lifecycleToken, this.bookId);
    }
  }

  private readerReplaceRuntimeCurrent(): boolean {
    try { return ReaderRuntimeOwner.current() === this.replaceRuntime; } catch (_) { return false; }
  }

  private openReplaceRecovery(generation: number): void {
    if (!this.isSessionActive(this.lifecycleToken) || !this.isControlInputEnabled() ||
      !this.replacePanel.recoveryCurrent(generation)) return;
    this.openReaderControl();
    if (this.controlVisible()) this.requestControlReplacePage();
  }

  private openQuickReplace(): void {
    if (!this.mounted || !this.controlVisible() || this.controlPage() !== 'home') {
      return;
    }
    this.requestControlReplacePage();
  }

  private requestControlReplacePage(): void {
    const alreadyReplace = this.controlPage() === 'quickReplace';
    this.replacePanel.open((): string => this.bookTitle);
    this.setControlPage('quickReplace');
    // A same-module recovery already has a committed presentation. Other requests
    // start reading only from the successful minimum commit hook.
    if (alreadyReplace) this.prepareControlReplacePage();
  }

  private reloadControlReplace(explicitRecovery: boolean = false, expectedOperationId?: string): Promise<void> {
    return this.replacePanel.reload(explicitRecovery, expectedOperationId);
  }

  private saveControlReplace(draft: ReaderControlReplaceDraft): Promise<void> { return this.replacePanel.save(draft); }

  private toggleControlReplace(rule: ReaderReplaceRule, enabled: boolean): Promise<void> { return this.replacePanel.toggle(rule, enabled); }

  private deleteControlReplace(rule: ReaderReplaceRule): Promise<void> { return this.replacePanel.delete(rule); }

  private previewControlReplace(): Promise<ReaderReplacePreview> { return this.replacePanel.preview(); }

  private importControlReplace(): Promise<void> {
    return this.replacePanel.importBundle((): Promise<BookSourceJsonSelection | undefined> =>
      ReaderRuntimeOwner.current().selectRuleBundleJson());
  }

  private exportControlReplace(): Promise<void> {
    return this.replacePanel.exportBundle((json: string): Promise<string | undefined> =>
      ReaderRuntimeOwner.current().saveRuleBundleJson(json, 'reader-replace-rules.json'));
  }

  private reloadCurrentPageAfterReplacePersist(lifecycleToken: number, bookId: string): void {
    if (!this.isSessionActive(lifecycleToken) || this.bookId !== bookId) {
      return;
    }
    this.quickSearchPublication.cancel();
    this.publishQuickSearchState({ kind: 'idle' });
    if (this.pageTurnSettlementActive) {
      this.pageTurnPendingReplaceReload = true;
      return;
    }
    this.invalidatePageTurnRuntime(true);
    // A rule update may change any chapter's processed scalar length even if
    // the currently visible chapter happens to retain the same count. Drop
    // the whole-book metrics and every physical-page manifest immediately.
    // This must happen even when the user closed the panel and started a page
    // turn before replace.persist returned.
    this.contentMetrics = undefined;
    this.physicalPagination.index.invalidateBook(this.sourceId, this.bookId);
    this.chapterWindow.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.resetPaginationDraft();
    const chapter = this.chapter;
    const page = this.visiblePage;
    if (chapter === undefined || page === undefined) {
      if (this.phase === 'failed') this.retryReading();
      // An already-running chapter selection will observe the cleared metrics
      // and revalidate its materialized body before it can become visible.
      return;
    }
    // Reuse the chapter-selection token boundary even when a page measurement
    // is underway; that makes every predecessor measurement unable to commit
    // content produced under the old replacement rule.
    // Re-materializing content after a rule edit is not a user chapter/list
    // selection and must not close this or a newly reopened control session.
    void this.reloadMigratedContentPosition(lifecycleToken, bookId);
  }

  /** Core migrates durable positions together with processing rules. Confirm
   * the visible position before a mutation so it never migrates an older page. */
  private async persistBeforeContentMutation(): Promise<() => boolean> {
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    await this.awaitOrdinaryFirstPagePersistence();
    const gateway = this.activeGateway();
    await gateway.runProgressCommitSerial(async (): Promise<void> => {});
    if (!this.isSessionActive(lifecycleToken) || this.sourceId !== sourceId || this.bookId !== bookId ||
      this.phase !== 'ready' || this.chapter === undefined || this.pageTurnSettlementActive ||
      this.pageTurnPreparation !== undefined || this.chapterSelection.ticket !== undefined || gateway.hasPendingSourceSwitch()) {
      throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
    }
    const chapter = this.chapter;
    const selection = this.chapterSelectionToken;
    const continuous = this.readerSettingsSnapshot.navigationMode === 'continuous';
    if (continuous) this.continuousAnchorSampler?.();
    const offset = continuous ? this.continuousVisibleScalar : this.visiblePage?.startScalar;
    if (offset === undefined) throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) && this.sourceId === sourceId &&
      this.bookId === bookId && this.chapter === chapter && this.chapterSelectionToken === selection &&
      this.phase === 'ready' && this.readerSettingsSnapshot.navigationMode === (continuous ? 'continuous' : 'paged') &&
      (continuous ? this.continuousVisibleScalar : this.visiblePage?.startScalar) === offset;
    if (continuous) await this.commitContinuousProgress(lifecycleToken);
    else await this.commitVisiblePage(lifecycleToken);
    const confirmed = this.lastCommittedProgress;
    if (!isCurrent() || confirmed?.sourceId !== sourceId || confirmed.bookId !== bookId ||
      confirmed.chapterIndex !== chapter.chapterIndex || confirmed.chapterOffset !== offset) {
      throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
    }
    return isCurrent;
  }

  private async reloadMigratedContentPosition(lifecycleToken: number, bookId: string): Promise<void> {
    const sourceId = this.sourceId;
    const selection = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selection) &&
      this.sourceId === sourceId && this.bookId === bookId;
    try {
      const restored = await this.activeGateway().loadProgress(bookId, isCurrent);
      if (!isCurrent()) return;
      if (restored.kind !== 'restored') throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
      const progress = restored.progress;
      const context: RemoteReadingPositionContext | undefined = progress.bodyVersion === undefined ||
        progress.processingVersion === undefined ? undefined : { bodyVersion: progress.bodyVersion,
          processingVersion: progress.processingVersion, anchors: [{ id: 'requested', offset: progress.chapterOffset }] };
      // Old numeric offsets are never attached to a new processed body. Core
      // supplies the mapped anchor and its exact version, including local books.
      this.selectChapterAnchor(progress.chapterIndex, progress.chapterOffset, false, true, undefined, -1,
        false, false, context);
    } catch (error) {
      if (!isCurrent()) return;
      hilog.error(0x5244, 'Reader', '%{private}s', `Reading content position reload failed: ${this.errorMessage(error as Error)}`);
      this.showReaderRecovery('正文规则已更新，阅读位置暂未恢复。', '重试恢复',
        (): void => { if (isCurrent()) void this.reloadMigratedContentPosition(lifecycleToken, bookId); });
    }
  }

  private publishQuickSearchState(state: ReaderQuickSearchState): void {
    this.quickSearchPublication.publish(state);
    this.quickSearchRevision += 1;
  }

  private updateQuickSearchQuery(query: string): void {
    if (query === this.quickSearchQuery) {
      return;
    }
    this.quickSearchPublication.cancel();
    this.quickSearchQuery = query;
    this.publishQuickSearchState({ kind: 'idle' });
  }

  private runQuickSearch(): void {
    const keyword = this.quickSearchQuery.trim();
    if (keyword.length === 0 || !this.controlVisible() ||
      (this.controlPage() !== 'quickSearch' && this.controlPage() !== 'fullSearch')) {
      return;
    }
    if (this.sessionGateway === undefined) {
      this.publishQuickSearchState({ kind: 'error', message: '书籍尚未载入，请先重试正文或切换书源。' });
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const book = this.bookId, source = this.sourceId;
    const active = (): boolean => this.isSessionActive(lifecycleToken) && book === this.bookId && source === this.sourceId && this.controlVisible() &&
      (this.controlPage() === 'quickSearch' || this.controlPage() === 'fullSearch');
    this.quickSearchPublication.run(this.activeGateway(), this.bookId, keyword, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, (): void => { this.quickSearchRevision += 1; });
  }

  private loadMoreQuickSearch(automatic: boolean = false): void {
    const lifecycleToken = this.lifecycleToken;
    const book = this.bookId, source = this.sourceId;
    const active = (): boolean => this.isSessionActive(lifecycleToken) && book === this.bookId && source === this.sourceId && this.controlVisible() &&
      (this.controlPage() === 'quickSearch' || this.controlPage() === 'fullSearch');
    if (automatic) this.quickSearchPublication.needMore(this.bookId, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, (): void => { this.quickSearchRevision += 1; });
    else this.quickSearchPublication.more(this.bookId, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, (): void => { this.quickSearchRevision += 1; });
  }

  private selectSearchResult(result: ReadingContentSearchResult, scope: number, ordinal: number): void {
    if (result.bookId !== this.bookId || result.sourceId !== this.sourceId) {
      return;
    }
    const visual = this.latestControlVisualSession;
    const location = readerControlContentLocation(visual);
    const epoch = visual.epoch;
    const state = this.controlVerification.observing() && location.level === 'secondary' &&
      location.module === 'search' && location.form === 'quick' ? this.quickSearchPublication.stateAt(this.quickSearchRevision) : undefined;
    const readingId = state?.kind === 'results' && state.results[ordinal] === result && scope > 0 &&
      this.quickSearchPublication.resultScrollScopeFor(state) === scope ? this.controlVerification.observationIdentity() : '';
    this.controlSelectionObservations.observeQuick({ readingId, scope, ordinal, epoch, target: result },
      (): void => this.selectBookmarkAnchor(result.chapterIndex, result.chapterOffset, result.positionScope));
  }

  private selectBookmarkAnchor(chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void {
    let context: RemoteReadingPositionContext | undefined;
    try {
      context = readerControlBookmarkPosition({ sourceId: this.sourceId, bookId: this.bookId,
        local: this.sourceId === LOCAL_READING_SOURCE_ID, chapterIndex, chapterOffset, positionScope, directoryTargetProof });
    } catch (_) {
      try {
        this.transientFeedback.show(() => this.getUIContext(), {
          message: '该位置的正文版本暂时无法确认，已保留原书签和阅读位置，请从目录打开章节',
        }, (): boolean => this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive);
      } catch (_) {}
      return;
    }
    this.clearTtsChapterEndTimer();
    this.selectChapterAnchor(chapterIndex, chapterOffset, false, true, undefined, -2, true, false, context);
  }

  private requestReadingDownload(chapterIndex?: number): void {
    this.observeReadingPrefetch?.(false, true);
    const lifecycleToken = this.lifecycleToken;
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken);
    void this.activeGateway().ensureRemoteSession(isCurrent).then((): void => {
      if (!isCurrent()) return;
      if (chapterIndex === undefined) this.onDownloadBook();
      else this.onDownloadChapter(chapterIndex);
    }).catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', 'Reading download admission: %{private}s', errorMessageOf(error));
    });
  }

  private selectControlChapter(chapterIndex: number): void {
    if (!this.isKnownControlChapter(chapterIndex)) {
      if (this.entryCatalogPending) this.selectChapterAnchor(chapterIndex, 0, true);
      return;
    }
    const origin = this.captureControlSelectionOrigin();
    if (this.chapterSelection.ticket === undefined && origin !== undefined &&
      chapterIndex === origin.committedProgress.chapterIndex) {
      // Only an already committed visible chapter can use this no-load path.
      // A newer chapter object may exist while it is still being measured.
      this.hideControl();
      return;
    }
    this.clearTtsChapterEndTimer();
    this.observeDirectoryChapterSelection(chapterIndex, origin?.committedProgress.chapterIndex ?? -1,
      (): void => this.selectChapterAnchor(chapterIndex, 0, true));
  }

  private selectControlNavigationTarget(chapterIndex: number, chapterOffset: number,
    positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void {
    if (directoryTargetProof !== undefined && !this.matchesDirectoryTargetProof(chapterIndex, directoryTargetProof)) return;
    const origin = chapterOffset === 0 && positionScope === undefined ?
      this.captureVisibleControlSelectionOrigin() : undefined;
    if (this.chapterSelection.ticket === undefined && origin?.committedProgress.chapterIndex === chapterIndex) {
      this.hideControl();
      return;
    }
    const fromChapterIndex = chapterOffset === 0 && this.controlVerification.observing() ?
      this.captureControlSelectionOrigin()?.committedProgress.chapterIndex ?? -1 : -1;
    this.observeDirectoryChapterSelection(chapterIndex, fromChapterIndex,
      (): void => this.selectBookmarkAnchor(chapterIndex, chapterOffset, positionScope, directoryTargetProof));
  }

  private observeDirectoryChapterSelection(chapterIndex: number, fromChapterIndex: number, dispatch: () => void): void {
    const visual = this.latestControlVisualSession;
    const location = readerControlContentLocation(visual);
    const readingId = this.controlVerification.observing() && this.sourceId === LOCAL_READING_SOURCE_ID &&
      location.level === 'secondary' && location.module === 'directory' && location.directoryTab === 'directory' &&
      location.form === 'full' ? this.controlVerification.observationIdentity() : '';
    this.controlSelectionObservations.observeDirectory({ readingId, fromChapterIndex, chapterIndex,
      readEpoch: (): number => visual.epoch }, dispatch);
  }

  private canDispatchControlChapterIntent(): boolean {
    return this.isControlInputEnabled() && this.controlVisible() && !this.controlShellExitArmed();
  }

  private captureControlCatalogOwner(): () => boolean {
    const lifecycleToken = this.lifecycleToken, selectionToken = this.chapterSelectionToken;
    const sourceId = this.sourceId, bookId = this.bookId, chapterIndex = this.currentChapterIndex();
    const openRevision = this.controlOpenRevision, moduleVisit = this.controlModuleVisitRevision;
    return (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) && this.canDispatchControlChapterIntent() &&
      sourceId === this.sourceId && bookId === this.bookId && chapterIndex === this.currentChapterIndex() &&
      openRevision === this.controlOpenRevision && moduleVisit === this.controlModuleVisitRevision;
  }

  private stepControlChapter(delta: number): void { this.controlCatalogRouting.step(delta); }

  private seekControlProgress(percent: number): void { this.controlCatalogRouting.seek(percent); }

  private dispatchControlCatalogTarget(target: ReaderControlCatalogTarget): void {
    this.clearTtsChapterEndTimer();
    if (target.kind === 'head') this.selectChapterAnchor(target.chapterIndex, 0, true);
    else if (target.kind === 'exact')
      this.selectChapterAnchor(target.chapterIndex, target.chapterOffset, false, true, undefined, -2, false);
    else this.selectChapterAnchor(this.readingTocEntries()[target.position].index, 0, false, true, target.chapterProgress, -2, false);
  }

  private canRefreshCurrentChapter(): boolean {
    return this.isControlInputEnabled() && this.phase === 'ready' && this.currentReadingViewportStart() !== undefined &&
      this.chapter !== undefined && !this.pageTurnSettlementActive && !this.pageTurnInputOwned;
  }

  private refreshCurrentChapter(): void {
    if (!this.canRefreshCurrentChapter()) return;
    const offset = this.currentReadingViewportStart();
    const chapter = this.chapter;
    if (offset === undefined || chapter === undefined) return;
    this.pauseAutoPage('touch');
    // Existing selection keeps the committed display/recovery origin until a
    // new page is admitted. Bypass only the target body read, never clear data.
    this.selectChapterAnchor(chapter.chapterIndex, offset, false, true, undefined, -2, false, true);
  }

  private positionContextForScope(scope: RemoteReadingPositionScope | undefined,
    chapterIndex: number, offset: number, directoryTargetProof?: ReaderDirectoryTargetProof): RemoteReadingPositionContext | undefined {
    return createRequestedRemoteReadingPositionContext(
      this.sourceId, this.bookId, chapterIndex, offset, scope, directoryTargetProof);
  }

  private selectChapterAnchor(
    chapterIndex: number,
    chapterOffset: number,
    requireChapterStart: boolean,
    stopTts: boolean = true,
    requestedProgress?: number,
    controlOwnerRevision: number = -2,
    closeControlOnCommit: boolean = true,
    refreshContent: boolean = false,
    positionContext?: RemoteReadingPositionContext,
    ttsOwner?: ReaderTtsFollowLease,
  ): void {
    this.chapterSelection.select(new ReaderDeferredChapterSelection(chapterIndex, chapterOffset, requireChapterStart,
      stopTts, requestedProgress, controlOwnerRevision, closeControlOnCommit, refreshContent, positionContext, ttsOwner));
  }

  private prepareChapterSelectionRequest(request: ReaderDeferredChapterSelection): boolean {
    const proof = request.positionContext?.directoryTargetProof;
    if (proof !== undefined && !this.matchesDirectoryTargetProof(request.chapterIndex, proof)) return false;
    const ttsOwner = request.ttsOwner;
    if (ttsOwner !== undefined && !this.isTtsFollowLeaseCurrent(ttsOwner)) return false;
    if (ttsOwner === undefined) this.invalidateTtsPageFollow?.();
    if (!this.mounted || !Number.isSafeInteger(request.chapterIndex) || request.chapterIndex < 0) return false;
    this.observeReadingPrefetch?.(ttsOwner === undefined, true);
    if (request.stopTts) this.retirePendingPlaybackStarts();
    return true;
  }

  private queueChapterSelectionOnSettlement(request: ReaderDeferredChapterSelection): boolean {
    if (!this.pageTurnSettlementActive) return false;
    this.pageTurnPendingChapterSelection = request;
    return true;
  }

  private loadAdmittedChapterSelection(request: ReaderDeferredChapterSelection,
    lifecycleToken: number, selectionToken: number): void {
    this.beginRetainedChapterPresentation(request.chapterIndex, lifecycleToken, selectionToken,
      request.refreshContent, request.positionContext, request.ttsOwner);
    this.resetForChapterSelection(false, request.ttsOwner !== undefined);
    this.loadingChapterIndex = request.chapterIndex;
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    if (request.closeControlOnCommit && request.controlOwnerRevision === this.controlOpenRevision &&
      this.controlVisible() && !this.controlShellExitArmed()) this.hideControl();
    void this.openChapter(request.chapterIndex, false, lifecycleToken, selectionToken,
      request.requireChapterStart ? 0 : (request.requestedProgress === undefined ? request.chapterOffset : undefined),
      request.requestedProgress, request.refreshContent, request.positionContext);
  }

  private controlSelectionOwner(): ReaderControlSelectionOwner {
    return {
      sourceId: this.sourceId,
      bookId: this.bookId,
      lifecycleToken: this.lifecycleToken,
      selectionToken: this.chapterSelectionToken,
      controlOpenRevision: this.controlOpenRevision,
      mounted: this.mounted,
      exitRequested: this.exitRequested,
      controlVisible: this.controlVisible(),
      controlClosing: this.controlShellExitArmed(),
    };
  }

  private captureControlSelectionOrigin(): ReaderControlSelectionOrigin | undefined {
    return this.chapterSelection.captureOrigin();
  }

  private captureVisibleControlSelectionOrigin(): ReaderControlSelectionOrigin | undefined {
    const page = this.visiblePage;
    const committed = this.lastCommittedProgress;
    const continuous = this.readerSettingsSnapshot.navigationMode === 'continuous';
    const visibleScalar = continuous ? this.continuousVisibleScalar : (page?.startScalar ?? 0);
    if (this.hasCurrentMaterializedChapter() && page !== undefined && committed !== undefined &&
      this.visiblePageSelectionToken === this.chapterSelectionToken &&
      committed.sourceId === this.sourceId && committed.bookId === this.bookId &&
      committed.chapterIndex === this.chapter?.chapterIndex &&
      (continuous || committed.chapterOffset === page.startScalar)) {
      return new ReaderControlSelectionOrigin(this.captureMaterializedChapterContext(), page, committed,
        visibleScalar, continuous, this.paginationLayoutSignature());
    }
    const preparationOrigin = this.pageTurnPreparation?.origin ?? this.previousChapterMeasurement?.origin;
    if (preparationOrigin !== undefined && page !== undefined && committed !== undefined &&
      this.visiblePageSelectionToken === this.chapterSelectionToken &&
      committed.sourceId === this.sourceId && committed.bookId === this.bookId &&
      committed.chapterIndex === preparationOrigin.chapter.chapterIndex &&
      (continuous || committed.chapterOffset === page.startScalar)) {
      return new ReaderControlSelectionOrigin(preparationOrigin, page, committed,
        visibleScalar, continuous, this.paginationLayoutSignature());
    }
    return undefined;
  }

  private completeControlSelectionAfterCommit(
    stored: LocalReadingProgress,
    page: PhysicalReadingPage,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    this.chapterSelection.complete(selectionToken, lifecycleToken, (): ReaderControlSelectionCommit => ({
      phaseReady: this.phase === 'ready',
      materializedSelectionToken: this.materializedChapterSelectionToken,
      visibleSelectionToken: this.visiblePageSelectionToken,
      visibleChapterIndex: this.chapter?.chapterIndex ?? -1,
      visiblePageStartScalar: page.startScalar,
      storedChapterIndex: stored.chapterIndex,
      storedChapterOffset: stored.chapterOffset,
    }), (ticket: ReaderControlSelectionTicket, owner: ReaderControlSelectionOwner): void => {
      this.controlSelectionObservations.complete(ticket, owner, (): ReaderControlObservedCommit => ({
        phaseReady: this.phase === 'ready', materializedSelectionToken: this.materializedChapterSelectionToken,
        visibleSelectionToken: this.visiblePageSelectionToken, visibleChapterIndex: this.chapter?.chapterIndex,
        storedChapterIndex: stored.chapterIndex, storedChapterOffset: stored.chapterOffset,
        pageStartScalar: page.startScalar, pageEndScalar: page.endScalar,
      }));
    });
  }

  private beginControlSelectionFailure(error: Error): void {
    const ticket = this.chapterSelection.ticket;
    if (ticket !== undefined) this.beginRetainedChapterPresentation(ticket.targetChapterIndex, ticket.lifecycleToken,
      ticket.selectionToken, false, undefined, undefined, true);
    this.resetForChapterSelection();
    this.failureCode = this.errorMessage(error);
    this.failureHint = readingFailureHint(this.failureCode, remoteReadingFailureKindOf(error));
  }

  private selectionDisplayAnchor(display: ReaderControlSelectionDisplay | undefined):
    ReaderControlSelectionDisplayAnchor | undefined {
    if (display === undefined) return undefined;
    return {
      chapterIndex: display.context.chapter.chapterIndex, pageStartScalar: display.page.startScalar,
      visibleScalar: display.visibleScalar, scalarCount: display.context.layoutMap.scalarCount(),
      continuous: display.continuous,
      bodyVersion: display.context.chapter.bodyVersion,
      processingVersion: display.context.chapter.processingVersion,
    };
  }

  private restoreVerifiedControlSelection(display: ReaderControlSelectionDisplay,
    stored: ReaderControlSelectionStoredProgress): void {
    this.restoreMaterializedChapterContext(display.context, true);
    this.visiblePage = display.page;
    this.visiblePageSelectionToken = this.chapterSelectionToken;
    this.visibleFragments = display.page.fragments;
    this.chapterTitle = display.context.chapter.chapterTitle;
    this.desiredChapterOffset = stored.chapterOffset;
    this.desiredChapterProgress = stored.chapterProgress;
    this.showChapterTitle = this.isChapterFirstPageStart(stored.chapterOffset);
    if (display.continuous) {
      this.rebuildContinuousFragments(false, stored.chapterOffset);
    }
    this.finishRetainedChapterPresentation(this.lifecycleToken, this.chapterSelectionToken);
    this.phase = 'ready';
    this.schedulePageTurnPreparation();
    this.admitCommittedProgress(stored);
  }

  private notifyRestoredControlSelection(ticket: ReaderControlSelectionTicket, display: ReaderControlSelectionDisplay,
    stored: ReaderControlSelectionStoredProgress): void {
    if (!this.notifyControlSelectionReadingReady(stored.chapterIndex, display.context.chapter.chapterTitle,
      display.page, ticket.selectionToken, ticket.lifecycleToken)) return;
    this.releaseUnretainedReadingImages();
  }

  private notifyControlSelectionReadingReady(chapterIndex: number, chapterTitle: string,
    page: PhysicalReadingPage | undefined = this.visiblePage,
    selectionToken: number = this.chapterSelectionToken,
    lifecycleToken: number = this.lifecycleToken): boolean {
    const chapter = this.chapter?.chapterIndex === chapterIndex ? this.chapter : this.pageTurnPreparation?.origin.chapter;
    const isCurrent = (): boolean => page !== undefined && chapter !== undefined &&
      chapter.chapterIndex === chapterIndex && this.phase === 'ready' &&
      this.isStableVisiblePageOwner(page, chapter, selectionToken, lifecycleToken);
    if (!isCurrent()) return false;
    this.publishControlDirectoryData();
    try { this.onChapterCommitted(chapterIndex, chapterTitle); }
    catch (error) { hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience chapter observer failed: ${this.errorMessage(error as Error)}`); }
    if (!isCurrent()) return false;
    const delivered = this.notifyReadingPresentationReady(chapter as ReadingSessionChapter, page as PhysicalReadingPage,
      selectionToken, lifecycleToken);
    if (delivered) this.initialReadingTraceDelivered = true;
    return delivered;
  }

  private notifyReadingPresentationReady(chapter: ReadingSessionChapter, page: PhysicalReadingPage,
    selectionToken: number, lifecycleToken: number): boolean {
    const isCurrent = (): boolean => this.phase === 'ready' &&
      this.isStableVisiblePageOwner(page, chapter, selectionToken, lifecycleToken);
    if (!isCurrent()) return false;
    this.resolvePageImagePixels(chapter, page.fragments);
    if (this.readingReadyPage === page && this.readingReadySelection === selectionToken) return true;
    this.readingReadyPage = page;
    this.readingReadySelection = selectionToken;
    this.traceInitialReadingPhase?.('ready-deliver', lifecycleToken);
    // Page consumers request only their missing original-paragraph range.
    this.scheduleEntryCatalogHydration?.();
    this.settleReaderRecovery('presentation');
    try { this.onReadingReady(chapter.chapterIndex); }
    catch (error) { hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience ready observer failed: ${this.errorMessage(error as Error)}`); }
    if (!isCurrent()) return false;
    this.observeReadingPrefetch?.();
    this.prepareRemoteCatalogNearEnd?.();
    this.ttsPageFollow.positioning = undefined;
    this.scheduleTtsPageFollowResume?.();
    try { this.scheduleTtsPresentationWarmup(); }
    catch (error) { hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience TTS warmup scheduling failed: ${this.errorMessage(error as Error)}`); }
    return isCurrent();
  }

  private showControlSelectionFailure(ticket: ReaderControlSelectionTicket, error: Error, detail: string): void {
    this.failureCode = this.errorMessage(error);
    this.failureHint = readingFailureHint(this.failureCode, remoteReadingFailureKindOf(error));
    this.finishPageTurnPerf('failed');
    const retry = this.chapterSelection.retryAction(ticket);
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience control selection failed: ${this.failureCode}; ${detail}`);
    this.showReaderRecovery(ticket.refreshContent === true ? '本章暂未刷新，原书签和记录已保留。' :
      '暂未跳转，原阅读位置已保留。', '重试', retry);
  }

  // ArkUI V1 drops handwritten accessors when lowering @Component structs.
  // Ordinary methods keep the visible and speculative measurement contexts
  // available in the emitted component as well as in TypeScript tests.
  // The hidden measurement lane owns its chapter, ranges and anchor independently.
  private adjacentMeasurementContext: ReaderMaterializedChapterContext | undefined = undefined;
  private measuringChapter(): ReadingSessionChapter | undefined {
    return this.adjacentMeasurementContext === undefined ? this.chapter : this.adjacentMeasurementContext.chapter;
  }
  private measuringLayoutMap(): ReadingSurfaceLayoutMap | undefined {
    return this.adjacentMeasurementContext === undefined ? this.chapterLayoutMap : this.adjacentMeasurementContext.layoutMap;
  }
  private measuringRanges(): ParagraphRange[] {
    return this.adjacentMeasurementContext === undefined ? this.paragraphLayout.ranges : this.adjacentMeasurementContext.paragraphRanges;
  }
  private measuringDraft(): ReadingPaginationPrefix | undefined {
    return this.adjacentMeasurementContext === undefined ? this.physicalPagination.draft : this.adjacentMeasurementContext.paginationDraft;
  }
  private setMeasuringDraft(value: ReadingPaginationPrefix | undefined): void {
    if (this.adjacentMeasurementContext === undefined) this.physicalPagination.draft = value;
    else this.adjacentMeasurementContext.paginationDraft = value;
  }
  private measuringOffset(): number {
    return this.adjacentMeasurementContext === undefined ? this.desiredChapterOffset : this.adjacentMeasurementContext.desiredChapterOffset;
  }
  private setMeasuringOffset(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.desiredChapterOffset = value;
    else this.adjacentMeasurementContext.desiredChapterOffset = value;
  }
  private measuringProgress(): number {
    return this.adjacentMeasurementContext === undefined ? this.desiredChapterProgress : this.adjacentMeasurementContext.desiredChapterProgress;
  }
  private setMeasuringProgress(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.desiredChapterProgress = value;
    else this.adjacentMeasurementContext.desiredChapterProgress = value;
  }
  private measuringRequestedAnchor(): number {
    return this.adjacentMeasurementContext === undefined ? this.physicalPagination.requestedAnchor : this.adjacentMeasurementContext.measurementRequestedAnchorScalar;
  }
  private setMeasuringRequestedAnchor(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.physicalPagination.requestedAnchor = value;
    else this.adjacentMeasurementContext.measurementRequestedAnchorScalar = value;
  }
  private requireMeasurementChapter(): ReadingSessionChapter {
    const chapter = this.measuringChapter();
    if (chapter === undefined) throw new Error('READING_CHAPTER_NOT_LOADED');
    return chapter;
  }
  private requireMeasurementLayoutMap(): ReadingSurfaceLayoutMap {
    const map = this.measuringLayoutMap();
    if (map === undefined) throw new Error('READING_LAYOUT_MAP_NOT_READY');
    return map;
  }
  private measurementPaginationKey(): ReadingPaginationKey {
    const lane = this.adjacentMeasurementContext;
    if (lane === undefined) return this.currentPaginationKey();
    return { sourceId: this.sourceId, bookId: this.bookId, chapterIndex: lane.chapter.chapterIndex,
      contentVersion: lane.contentVersion, layoutSignature: this.paginationLayoutSignature() };
  }
  private resetMeasurementPaginationDraft(): void {
    this.setMeasuringDraft(undefined);
    this.setMeasuringRequestedAnchor(-1);
  }
  private isMeasurementChapterFirstPageStart(start: number): boolean {
    return (this.measuringChapter?.()?.documentRange?.startScalar ?? 0) === 0 &&
      this.measuringRanges().length > 0 && start === this.measuringRanges()[0].startScalar;
  }
  private captureMeasurementChapterContext(): ReaderMaterializedChapterContext {
    return this.adjacentMeasurementContext ?? this.captureMaterializedChapterContext();
  }

  private captureMaterializedChapterContext(): ReaderMaterializedChapterContext {
    const chapter = this.requireChapter();
    return new ReaderMaterializedChapterContext(
      chapter,
      this.requireChapterLayoutMap(),
      this.materializedContentVersion,
      this.copyParagraphRanges(this.paragraphLayout.ranges),
      this.physicalPagination.draft,
      this.desiredChapterOffset,
      this.desiredChapterProgress,
      this.physicalPagination.requestedAnchor,
    );
  }

  private restoreMaterializedChapterContext(
    context: ReaderMaterializedChapterContext,
    admitWindowCurrent: boolean,
  ): void {
    this.chapter = context.chapter;
    this.readingImageResources.indexChapter(context.chapter);
    this.chapterLayoutMap = context.layoutMap;
    this.materializedContentVersion = context.contentVersion;
    this.paragraphLayout.ranges.splice(0, this.paragraphLayout.ranges.length, ...this.copyParagraphRanges(context.paragraphRanges));
    this.physicalPagination.draft = context.paginationDraft;
    this.desiredChapterOffset = context.desiredChapterOffset;
    this.desiredChapterProgress = context.desiredChapterProgress;
    this.physicalPagination.requestedAnchor = context.measurementRequestedAnchorScalar;
    this.materializedChapterSelectionToken = this.chapterSelectionToken;
    if (admitWindowCurrent) {
      this.setCurrentReadingChapter(context.chapter);
    } else {
      this.chapterWindow.admitNeighbour(context.chapter);
    }
    this.retainCurrentChapterWindow();
  }

  private copyParagraphRanges(ranges: ParagraphRange[]): ParagraphRange[] {
    return ranges.map((range: ParagraphRange): ParagraphRange => new ParagraphRange(
      range.id,
      range.startUtf16,
      range.endUtf16,
      range.startScalar,
      range.endScalar,
    ));
  }

  /**
   * Invalidates presentation-only page-turn work without changing the admitted
   * visible Core anchor. If an adjacent page currently owns the shared hidden
   * measurement lane, restore its captured origin before the caller reflows or
   * selects another chapter.
   */
  private invalidatePageTurnRuntime(
    restorePreparation: boolean,
    preserveRapidPageTarget: boolean = false,
    preserveTtsFollow: boolean = false,
  ): void {
    this.ordinaryPageMeasurementSelection = -1;
    this.previousChapterLayoutPreparation = undefined;
    if (!preserveTtsFollow) this.invalidateTtsPageFollow?.();
    this.pageTurnAutomaticStart = undefined;
    this.pageTurnSettlementOrigin = 'manual';
    this.pageTurnSettlementTtsOwner = undefined;
    this.canonicalModeAnchor = -1;
    this.pageTurnSlideTimeline = undefined;
    this.adjacentMeasurementContext = undefined;
    this.pageTurnInputRevision += 1;
    this.clearPageTurnProjection();
    this.finishPageTurnPerf('invalidated');
    this.bookmarkRollbackGeneration += 1;
    this.bookmarkGestureAnchor = '';
    this.bookmarkUnavailableMessage = '';
    this.bookmarkUnavailableGeneration += 1;
    const preparation = this.pageTurnPreparation;
    const discovery = this.previousChapterMeasurement?.prepareOnly ?
      this.previousChapterMeasurement : undefined;
    this.pageTurnGeneration += 1;
    this.pageTurnSettlementGeneration += 1;
    // Invalidate delayed hide/release callbacks from the superseded turn and
    // keep the native surface out of composition until a fresh gesture owns
    // it again.
    this.bookTurnSurfaceGeneration += 1;
    this.bookTurnSurfaceOpacity = 0;
    this.pageTurnPreparation = undefined;
    if (discovery !== undefined) this.previousChapterMeasurement = undefined;
    this.pageTurnPreparationQueue.reset();
    if (!preserveRapidPageTarget) {
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    }
    this.pendingPointerSegmentReserved = false;
    this.autoPageCoordinator.cancelPendingTurn();
    this.preparedPreviousPage = undefined;
    this.preparedNextPage = undefined;
    this.preparedSettlement.discardDestination();
    this.pageTurnAnimationFinished = false;
    this.preparedSettlement.clearResult();
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnSettlementActive = false;
    this.pageTurnPresentationPhase = 'idle';
    this.pageTurnUnknownNotifiedGeneration = -1;
    this.bookTurn2DFallbackPending = false;
    this.preparedSettlement.cancelDeadline();
    this.pageTurnPresentationWidth = 0;
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.pageTurnGestureState = createReaderPageGestureState();
    this.pageTurnInputOwned = false;
    this.pageTurnSessionCapsuleFrozen = false;
    this.pageTurnSessionCapsuleSnapshot = undefined;
    this.preparedSettlement.releaseCommit();
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookmarkPageOffsetY = 0;
    this.bookmarkRibbonFrame = undefined;
    this.bookmarkPullHintOpacity = 0;
    this.bookmarkPreviewChanged = false;
    if (this.bookmarkMutationConfirmed) this.reconcilePageBookmarkFeedback();
    this.bookTurnTexture.invalidate(true);
    this.bookTurnSession.clearCapturedTextures();
    this.releaseBookTurnTextureContent();
    this.bookTurnSession.releasePendingSnapshot();
    this.pageTurnRenderRevision += 1;
    if (preparation === undefined && discovery === undefined) {
      this.releaseUnretainedReadingImages();
      return;
    }

    this.physicalPagination.index.invalidateMeasurement();
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.paragraphLayout.batch.length = 0;
    this.resetPendingPage();
    this.measurementRun.cancelDeadline();
    this.measurementEpoch += 1;
    const origin = preparation?.origin ?? discovery?.origin;
    if (restorePreparation && this.mounted && origin !== undefined) {
      this.restoreMaterializedChapterContext(origin, false);
      this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    }
    this.releaseUnretainedReadingImages();
  }

  /** A speculative adjacent-page failure must never fail or exit the reader. */
  private recoverPageTurnPreparation(error: Error, lifecycleToken: number): void {
    const preparation = this.pageTurnPreparation;
    if (preparation === undefined || !this.isSessionActive(lifecycleToken)) {
      return;
    }
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience page-turn preparation failed: ${this.errorMessage(error)}`);
    this.pageTurnPreparation = undefined;
    this.physicalPagination.index.invalidateMeasurement();
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.paragraphLayout.batch.length = 0;
    this.resetPendingPage();
    this.measurementRun.cancelDeadline();
    this.measurementEpoch += 1;
    this.adjacentMeasurementContext = undefined;
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.releaseUnretainedReadingImages();
    this.scheduleBookTurnTextureRefresh();
  }

  private schedulePageTurnPreparation(): void {
    this.pageTurnGeneration += 1;
    this.preparedPreviousPage = undefined;
    this.preparedNextPage = undefined;
    this.pageTurnPreparationQueue.reset(readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ?
      this.preferredPageTextureDirection : undefined);
    this.pageTurnRenderRevision += 1;
    const generation = this.pageTurnGeneration;
    setTimeout((): void => {
      if (generation === this.pageTurnGeneration) {
        this.drainPageTurnPreparationQueue();
      }
    }, 0);
  }

  /** Queue work only from lifecycle/prefetch completion, never from an active Pan. */
  private finishAdjacentMeasurementContext(): void {
    const lane = this.adjacentMeasurementContext;
    if (lane !== undefined && lane.chapter.chapterIndex === this.chapter?.chapterIndex && lane.paginationDraft !== undefined &&
      lane.paginationDraft.matches(this.currentPaginationKey())) this.physicalPagination.draft = lane.paginationDraft;
    this.adjacentMeasurementContext = undefined;
  }

  private resumePagePreparationAfterTextureFrame(): void {
    this.bookTurnTexture.invalidate();
    const generation = this.pageTurnGeneration;
    // Capture the ready current/requested pages before measuring the other direction.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.mounted || generation !== this.pageTurnGeneration) return;
      void this.bookTurnTexture.refresh().finally((): void => {
        if (this.mounted && generation === this.pageTurnGeneration) this.drainPageTurnPreparationQueue();
      });
    }));
  }

  private suspendAdjacentMeasurement(): void {
    const lane = this.adjacentMeasurementContext;
    if (lane === undefined) return;
    const direction = this.pageTurnPreparation?.direction ?? 'previous';
    this.finishAdjacentMeasurementContext();
    this.pageTurnPreparation = undefined;
    if (this.previousChapterMeasurement?.prepareOnly) this.previousChapterMeasurement = undefined;
    this.physicalPagination.index.invalidateMeasurement();
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.paragraphLayout.batch.length = 0;
    this.resetPendingPage();
    this.measurementRun.cancelDeadline();
    this.measurementEpoch += 1;
    this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    this.pageTurnPreparationQueue.restoreFront(direction);
  }

  private prepareHeldPagePointer(direction: ReaderPageTurnDirection): void {
    if (this.activePagePointerId < 0 || this.pageTurnSettlementActive) return;
    // The physical lease stays held while the speculative lane runs. All
    // older producers remain blocked until this pointer ends.
    this.preferredPageTextureDirection = direction;
    this.suspendAdjacentMeasurement();
    this.pageTurnGestureState = createReaderPageGestureState();
    this.pageTurnInputOwned = false;
    this.clearPageTurnProjection();
    this.pageTurnPreparationQueue.prioritize(direction);
    this.drainPageTurnPreparationQueue();
    this.scheduleBookTurnTextureRefresh();
  }

  private queuePageTurnPreparation(direction: ReaderPageTurnDirection): void {
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.pageTurnPreparationQueue.contains(direction) ||
      this.preparedPageTurn(direction) !== undefined) {
      return;
    }
    this.pageTurnPreparationQueue.append(direction);
    this.drainPageTurnPreparationQueue();
  }

  private drainPageTurnPreparationQueue(): void {
    this.pageTurnPreparationQueue.drain({
      renderWorkBlocked: (): boolean => this.sessionLaunchRenderWorkBlocked(),
      laneBlocked: (): boolean => this.pageTurnPreparation !== undefined || this.previousChapterLayoutPreparation !== undefined ||
        this.preparedSettlement.prepared !== undefined ||
        this.pageTurnGestureState.phase !== 'idle' ||
        !readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) || !this.canTurnPage(),
      ready: (direction: ReaderPageTurnDirection): boolean => this.preparedPageTurn(direction) !== undefined,
      prepare: (direction: ReaderPageTurnDirection): ReaderPagePreparationAttempt => {
        const target = this.adjacentPageTurnTarget(direction);
        if (target === undefined && this.chapter !== undefined && this.isUnknownCatalogEdge(this.chapter.chapterIndex, direction)) {
          this.requestCatalogForTurn(); return 'wait';
        }
        if (target === undefined && direction === 'previous' &&
          this.knownPageTurnBoundary(direction) === undefined && this.startPreviousPagePreparationDiscovery()) return 'wait';
        return target === undefined ? 'abandon' : this.beginPageTurnPreparation(direction, target);
      },
      idle: (): void => this.scheduleBookTurnTextureRefresh(),
      captureCurrent: (): (() => boolean) => {
        const generation = this.pageTurnGeneration, selection = this.chapterSelectionToken;
        return (): boolean => generation === this.pageTurnGeneration && selection === this.chapterSelectionToken;
      },
    });
  }

  private adjacentPageTurnTarget(direction: ReaderPageTurnDirection): ReaderPageTurnTarget | undefined {
    const page = this.visiblePage;
    const chapter = this.chapter;
    return page === undefined || chapter === undefined ? undefined :
      this.physicalPagination.adjacentTarget(direction, this.adjacentPageEvidence(page, chapter));
  }

  private adjacentPageEvidence(page: PhysicalReadingPage, chapter: ReadingSessionChapter): ReaderAdjacentPageEvidence {
    return {
      chapterIndex: chapter.chapterIndex, startScalar: page.startScalar, endScalar: page.endScalar,
      window: this.chapterWindow,
      currentKey: (): ReadingPaginationKey => this.currentPaginationKey(),
      chapterKey: (index: number): ReadingPaginationKey | undefined => this.paginationKeyForChapter(index),
      lastVisibleScalar: (): number => this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap()),
    };
  }

  /**
   * A restore/search anchor may not yet have a measured physical predecessor.
   * Discover it behind the unchanged visible page, then feed the result back
   * into the normal adjacent-page preparation path. No Core progress is
   * written and no flat fallback is shown while this lane is active.
   */
  private startPreviousPagePreparationDiscovery(): boolean {
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (!this.mounted || page === undefined || chapter === undefined ||
      this.previousChapterMeasurement !== undefined || this.pageTurnPreparation !== undefined ||
      this.paragraphLayout.ranges.length === 0 || !this.canTurnPage()) {
      return false;
    }
    const head = this.paragraphLayout.ranges[0].startScalar;
    const previousChapter = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    if (this.requireChapterLayoutMap().residentStart() === 0 && page.startScalar <= head) {
      if (previousChapter === undefined) return false;
      if (this.chapterWindow.get(previousChapter) === undefined) {
        this.requestPageTurnChapter('previous', previousChapter); return true;
      }
      const pending = new PreviousChapterMeasurement(chapter.chapterIndex, page.startScalar,
        chapter.chapterIndex, true, this.captureMaterializedChapterContext(), this.pageTurnGeneration);
      return this.continuePreviousChapterPreparation(pending, previousChapter);
    }
    const origin = this.captureMaterializedChapterContext();
    this.adjacentMeasurementContext = this.captureMaterializedChapterContext();
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapter.chapterIndex,
      page.startScalar,
      chapter.chapterIndex,
      true,
      origin,
      this.pageTurnGeneration,
    );
    this.setMeasuringOffset(page.startScalar);
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.setMeasuringProgress(scalarCount === 0 ? 0 : this.measuringOffset() / scalarCount);
    this.beginMeasurement(this.lifecycleToken);
    return this.phase === 'measuring';
  }

  private beginPageTurnPreparation(
    direction: ReaderPageTurnDirection,
    target: ReaderPageTurnTarget,
  ): ReaderPageTurnPreparationOutcome {
    const visiblePage = this.visiblePage;
    const originChapter = this.chapter;
    if (visiblePage === undefined || originChapter === undefined || !this.canTurnPage()) {
      return 'retry';
    }
    const targetChapter = target.chapterIndex === originChapter.chapterIndex ?
      originChapter : this.chapterWindow.get(target.chapterIndex);
    if (targetChapter === undefined) {
      this.requestPageTurnChapter(direction, target.chapterIndex);
      return 'abandon';
    }
    const origin = this.captureMaterializedChapterContext();
    const targetMap = target.chapterIndex === originChapter.chapterIndex ?
      origin.layoutMap : readingChapterLayoutMap(targetChapter);
    if (targetMap.scalarCount() === 0) {
      return 'abandon';
    }
    this.admitChapterContentVersion(targetChapter.chapterIndex, targetChapter.contentVersion);
    this.pageTurnPreparation = new ReaderPageTurnPreparation(
      direction,
      origin,
      originChapter.chapterIndex,
      visiblePage.startScalar,
      this.pageTurnGeneration,
    );
    const lastVisible = this.lastVisibleScalar(targetChapter.content, targetMap);
    const targetOffset = Math.max(0, Math.min(lastVisible, target.chapterOffset));
    const targetContext = new ReaderMaterializedChapterContext(
      targetChapter,
      targetMap,
      targetChapter.contentVersion,
      target.chapterIndex === originChapter.chapterIndex ? origin.paragraphRanges : [],
      target.chapterIndex === originChapter.chapterIndex ? origin.paginationDraft : undefined,
      targetOffset,
      targetMap.scalarCount() === 0 ? 0 : targetOffset / targetMap.scalarCount(),
      -1,
    );
    this.adjacentMeasurementContext = targetContext;
    this.beginMeasurement(this.lifecycleToken);
    if (this.phase !== 'measuring') {
      // The lane rejected the measurement (remasurePending, viewport lost,
      // superseded selection). The materialized context above is now the
      // target's, not the visible page's — restoring the origin context keeps
      // later turns from acting on a swapped context the user never saw.
      this.adjacentMeasurementContext = undefined;
      this.pageTurnPreparation = undefined;
      return 'retry';
    }
    return 'begun';
  }

  private isPreparedPageTurnFresh(prepared: PreparedReaderPageTurn): boolean {
    const page = this.visiblePage;
    const chapter = this.chapter;
    const knownVersion = this.knownContentVersion(prepared.key.chapterIndex);
    return this.mounted && prepared.generation === this.pageTurnGeneration && page !== undefined &&
      chapter !== undefined && chapter.chapterIndex === prepared.originChapterIndex &&
      page.startScalar === prepared.originPageStartScalar && prepared.key.sourceId === this.sourceId &&
      prepared.key.bookId === this.bookId && prepared.key.layoutSignature === this.paginationLayoutSignature() &&
      prepared.key.contentVersion === prepared.context.contentVersion &&
      (knownVersion === undefined || knownVersion === prepared.key.contentVersion);
  }

  private preparedPageTurn(direction: ReaderPageTurnDirection): PreparedReaderPageTurn | undefined {
    const prepared = direction === 'previous' ? this.preparedPreviousPage : this.preparedNextPage;
    if (this.activePagePointerId >= 0 && prepared !== undefined && prepared === this.pageTurnAdmittedPrepared &&
      prepared.generation === this.pageTurnGeneration && prepared.originPageStartScalar === this.visiblePage?.startScalar &&
      prepared.originChapterIndex === this.chapter?.chapterIndex &&
      prepared.key.contentVersion === this.knownContentVersion(prepared.key.chapterIndex)) return prepared;
    return prepared !== undefined && this.isPreparedPageTurnFresh(prepared) ? prepared : undefined;
  }

  private canStartReaderPageTurn(direction: ReaderPageTurnDirection): boolean {
    // A ready neighbour wins over unrelated speculative layout immediately.
    if (this.adjacentMeasurementContext !== undefined && this.preparedPageTurn(direction) !== undefined) {
      this.suspendAdjacentMeasurement();
    }
    if (!this.canTurnPage()) return false;
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.usesNoAnimationPageTurnRuntime()) return true;
    const prepared = this.preparedPageTurn(direction);
    if (prepared === undefined) return false;
    if (!this.usesBookTurnSimulation()) {
      this.pageTurnAdmittedPrepared = prepared;
      return true;
    }
    if (this.bookTurnRuntimeFailed ||
      (this.bookTurnMotion !== undefined && this.bookTurnMotion.direction !== direction)) return false;
    const current = this.currentPageTurnRenderPage();
    const adjacent = this.preparedPageTurnRenderPage(direction);
    const ready = adjacent !== undefined &&
      this.bookTurnSession.capturedIdentity(BOOK_TURN_TEXTURE_CURRENT) === current.textureIdentity &&
      this.bookTurnSession.capturedIdentity(direction === 'next' ?
        BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS) === adjacent.textureIdentity &&
      this.bookTurnSession.canStart(direction);
    if (ready) this.pageTurnAdmittedPrepared = prepared;
    return ready;
  }

  private canStartReaderBookmarkGesture(): boolean {
    if (!this.bookmarkWriteEnabled()) return false;
    // Speculative neighbour layout can yield to an operation on the stable
    // visible page, just as it yields to an already prepared page turn. Real
    // page/commit/window barriers remain checked below after the lane retires.
    if (this.adjacentMeasurementContext !== undefined && this.isReaderPageInteractionEnabled() &&
      !this.pageTurnTapOnlyInput()) this.suspendAdjacentMeasurement();
    this.reconcilePageBookmarkFeedback();
    const anchor = this.pageBookmarkFeedbackAnchor();
    if (!this.canTurnPage() || !this.isReaderPageInteractionEnabled() || this.pageTurnTapOnlyInput() ||
      anchor.length === 0 || (this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === anchor)) return false;
    const status = this.currentPageBookmarkStatus();
    if (status === 'unknown') return false;
    this.bookmarkGestureAnchor = anchor;
    this.bookmarkGestureLifecycle = this.lifecycleToken;
    this.bookmarkGestureSelection = this.chapterSelectionToken;
    this.bookmarkGesturePointerEpoch = this.pagePointerEpoch;
    this.bookmarkGestureInputRevision = this.pageTurnInputRevision;
    this.bookmarkPreviewStatus = status;
    this.bookmarkPreviewOwner = this.bookmarkFeedbackOwnerKey();
    this.bookmarkUnavailableMessage = '';
    this.bookmarkUnavailableGeneration += 1;
    return true;
  }

  private onReaderPageGestureDecision(decision: ReaderPageGestureDecision): ReaderPageGestureDecision {
    return decision;
  }

  private freezePageTurnProjection(): void {
    const admitted = this.pageTurnAdmittedPrepared;
    this.clearPageTurnProjection();
    this.pageTurnAdmittedPrepared = admitted;
    const layout = this.readingLayout();
    const current = this.currentPageTurnRenderPage();
    const previous = this.preparedPageTurnRenderPage('previous');
    const next = this.preparedPageTurnRenderPage('next');
    this.pageTurnFrozenLayout = layout;
    this.pageTurnFrozenCurrent = current;
    this.pageTurnFrozenPrevious = previous;
    this.pageTurnFrozenNext = next;
    this.pageTurnFrozenRevision = this.pageTurnRenderRevision;
  }

  private clearPageTurnProjection(): void {
    this.pageTurnFrozenRevision = -1;
    this.pageTurnFrozenCurrent = undefined;
    this.pageTurnFrozenPrevious = undefined;
    this.pageTurnFrozenNext = undefined;
    this.pageTurnFrozenLayout = undefined;
    this.pageTurnAdmittedPrepared = undefined;
  }

  private acquirePagePointer(pointerId: number): boolean {
    if (this.activePagePointerId >= 0 || !this.isReaderPageInteractionEnabled() ||
      (this.pageTurnGestureState.owner === 'bookmark' && this.pageTurnGestureState.phase === 'settling')) return false;
    this.activePagePointerId = pointerId;
    this.invalidateTtsPageFollow?.();
    this.cancelAutomaticPageStart?.();
    this.pagePointerEpoch += 1;
    return true;
  }

  private regrabReaderPageGesture(width: number, height: number, x: number, y: number, time: number,
    requestedDirection: ReaderPageTurnDirection): ReaderPageGestureState | undefined {
    // Continuing in the same direction asks for another page. Only a reverse
    // drag catches the current sheet; the shared settlement handoff stays intact.
    return requestedDirection === this.pageTurnDirection ? undefined :
      this.regrabPageTurn(width, height, x, y, time);
  }

  private regrabPageTurn(width: number, height: number, x: number, y: number, time: number): ReaderPageGestureState | undefined {
    if (!this.pageTurnSettlementActive || this.preparedSettlement.commitStarted ||
      this.pageTurnAnimationFinished || this.pageTurnDirection === undefined) return undefined;
    const direction = this.pageTurnDirection;
    let offset = this.pageTurnOffsetX;
    if (this.usesBookTurnSimulation()) {
      const motion = beginBookTurnMotion(this.pageTurnSettlementGeneration + 1,
        direction, false, width, height, x, y, x, y, time);
      const frame = this.bookTurnSession.regrab(bookTurnInput(motion), this.pageTurnSettlementGeneration);
      if (frame === undefined) return undefined;
      offset = frame.edgeX - (direction === 'next' ? width : 0);
      this.bookTurnMotion = motion;
      this.bookTurnSurfaceGeneration = motion.generation;
    } else if (this.pageTurnSlideTimeline === undefined) {
      return undefined;
    }
    this.pageTurnSlideTimeline = undefined;
    this.preparedSettlement.cancelDeadline();
    this.pageTurnSettlementGeneration += 1;
    this.pageTurnSettlementActive = false;
    this.preparedSettlement.discardDestination();
    this.preparedSettlement.clearResult();
    // Remove only the replaced release intent. Older queued requests remain
    // blocked by the live physical pointer until its new terminal decision.
    this.completeRapidPageTurnTransaction(direction);
    this.pageTurnPresentationPhase = 'tracking';
    return resumeReaderPagePan(direction, offset, width, height, x, y, time);
  }

  private releasePagePointer(pointerId: number): void {
    if (this.activePagePointerId !== pointerId) return;
    this.activePagePointerId = -1;
    this.schedulePagePointerCompletion();
  }

  private schedulePagePointerCompletion(): void {
    const epoch = this.pagePointerEpoch;
    const lifecycle = this.lifecycleToken;
    // Finish the entire UP/CANCEL callback (including its new intent) before
    // admitting any older queued work. A newer DOWN always wins this callback.
    setTimeout((): void => {
      if (!this.mounted || lifecycle !== this.lifecycleToken || epoch !== this.pagePointerEpoch ||
        this.activePagePointerId >= 0) return;
      this.drainRapidPageTurn();
      this.resumePendingAutoPageTurn();
      this.resumeTtsPageFollow?.();
      this.drainPageTurnPreparationQueue();
    }, 0);
  }

  private onReaderPageGestureStateChanged(state: ReaderPageGestureState): void {
    const previousPhase = this.pageTurnGestureState.phase;
    if ((state.phase === 'tracking' || state.phase === 'dragging') &&
      this.pageTurnFrozenRevision !== this.pageTurnRenderRevision) this.freezePageTurnProjection();
    if (state.phase === 'idle') this.clearPageTurnProjection();
    if (!this.pageTurnSessionCapsuleFrozen &&
      (state.phase === 'tracking' || state.phase === 'dragging')) {
      this.pageTurnSessionCapsuleSnapshot = this.liveSessionCapsuleSnapshot();
      this.pageTurnSessionCapsuleFrozen = true;
    }
    this.pageTurnGestureState = state;
    if (state.phase === 'tracking' || state.phase === 'dragging') {
      this.pageTurnPresentationPhase = 'tracking';
    } else if (state.phase === 'settling') {
      this.pageTurnPresentationPhase = state.settleTarget === 'rollback' ? 'rollback' : 'settling';
    } else if (state.phase === 'idle' && !this.pageTurnSettlementActive) {
      this.pageTurnPresentationPhase = 'idle';
    }
    if (state.phase === 'dragging' && state.direction !== undefined) {
      this.beginPageTurnPerf(state.direction, 'gesture');
    }
    const ownsInput = state.phase !== 'idle';
    if (this.pageTurnInputOwned !== ownsInput) this.pageTurnInputOwned = ownsInput;
    // Bookmark cancellation/rebound belongs to the vertical page actor. A
    // bookmark rollback must never enter the native horizontal turn runtime.
    if (state.owner === 'bookmark') return;
    if (this.usesBookTurnSimulation()) {
      if (previousPhase === 'idle' && state.phase !== 'idle') {
        // ComponentSnapshot cannot be cancelled after dispatch, but changing
        // this generation prevents an idle capture from uploading after the
        // first gesture-owned frame.
        this.bookTurnTexture.invalidate(true);
      }
      this.updateBookTurnGesturePresentation(state);
      return;
    }
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.usesNoAnimationPageTurnRuntime()) {
      this.pageTurnDirection = undefined;
      this.pageTurnOffsetX = 0;
      if (state.phase === 'settling' && state.settleTarget === 'rollback') {
        this.pageTurnGestureState = completeReaderPageGestureSettlement(state);
        this.pageTurnInputOwned = false;
        this.pageTurnPresentationPhase = 'idle';
      }
      if (this.pageTurnGestureState.phase === 'idle') this.flushDeferredPageChromeState();
      return;
    }
    if (state.phase === 'dragging' && state.direction !== undefined) {
      if (this.preparedPageTurn(state.direction) !== undefined) {
        this.pageTurnDirection = state.direction;
        this.pageTurnOffsetX = this.clampedPageTurnOffset(state.direction, state.currentOffsetX);
      } else {
        // Symmetric with the tap path: a drag that arrives without a prepared
        // page must enqueue the preparation instead of being dropped, so the
        // next gesture can follow. The drain's own gesture guard keeps the
        // actual measurement work out of the active gesture.
        if (!this.pageTurnPreparationQueue.contains(state.direction)) {
          hilog.info(0x5244, 'Reader',
            `DRAGFOLLOW gate-miss dir=%{public}s queued=true`, state.direction);
        }
        this.queuePageTurnPreparation(state.direction);
        this.pageTurnDirection = undefined;
        this.pageTurnOffsetX = 0;
      }
      return;
    }
    if (state.phase === 'settling' && state.settleTarget === 'rollback') {
      this.animatePageTurnRollback();
      return;
    }
    if (state.phase === 'tracking' || state.phase === 'idle') {
      this.pageTurnDirection = undefined;
      this.pageTurnOffsetX = 0;
      this.flushDeferredPageChromeState();
      if (state.phase === 'idle' && this.pageTurnPreparationQueue.hasQueued()) {
        this.drainPageTurnPreparationQueue();
      }
    }
  }

  private updateBookTurnGesturePresentation(state: ReaderPageGestureState): void {
    this.pageTurnOffsetX = 0;
    if (state.phase === 'dragging' && state.direction !== undefined && state.owner === 'horizontalPage') {
      if (this.preparedPageTurn(state.direction) === undefined) {
        // Symmetric with the tap path (performPageTurn preparing branch): queue
        // the missing preparation instead of a silent drop. The drain's own
        // gesture guard defers the work until the gesture returns to idle.
        if (!this.pageTurnPreparationQueue.contains(state.direction)) {
          hilog.info(0x5244, 'Reader',
            `DRAGFOLLOW gate-miss dir=%{public}s queued=true`, state.direction);
        }
        this.queuePageTurnPreparation(state.direction);
        return;
      }
      this.pageTurnDirection = state.direction;
      if (this.bookTurnMotion === undefined) {
        this.bookTurnMotion = beginBookTurnMotion(
          this.pageTurnSettlementGeneration + 1,
          state.direction,
          false,
          state.viewportWidth,
          state.viewportHeight,
          state.startLocalX,
          state.startLocalY,
          state.currentLocalX,
          state.currentLocalY,
          state.eventTimeMs,
        );
        this.bookTurnSurfaceGeneration = this.bookTurnMotion.generation;
        // Native will reveal the surface after its first successful frame.
        this.bookTurnSurfaceOpacity = 0;
      } else {
        updateBookTurnMotionInPlace(
          this.bookTurnMotion,
          state.currentLocalX,
          state.currentLocalY,
          state.eventTimeMs,
        );
      }
      if (!this.bookTurnSession.updateInput(bookTurnInput(this.bookTurnMotion))) {
        this.failBookTurnRuntime();
      }
      return;
    }
    if (state.phase === 'settling' && state.settleTarget === 'rollback') {
      this.animatePageTurnRollback();
      return;
    }
    if (state.phase === 'tracking' || state.phase === 'idle') {
      this.pageTurnDirection = undefined;
      this.bookTurnMotion = undefined;
      this.flushDeferredPageChromeState();
      if (state.phase === 'idle' && this.pageTurnPreparationQueue.hasQueued()) {
        this.drainPageTurnPreparationQueue();
      }
    }
  }

  private onReaderBookmarkGestureStateChanged(state: ReaderPageGestureState): void {
    if (state.owner !== 'bookmark') return;
    if (!this.isReaderBookmarkGestureCurrent()) return;
    if (state.phase !== 'settling') this.bookmarkRollbackGeneration += 1;
    const justArmed = state.bookmarkPreviewChanged && !this.bookmarkPreviewChanged;
    this.bookmarkPageOffsetY = this.reduceMotion ? 0 : state.bookmarkOffsetY;
    this.bookmarkRibbonFrame = readerBookmarkRibbonPull(state.bookmarkOffsetY,
      this.bookmarkPreviewStatus === 'bookmarked', this.reduceMotion);
    this.bookmarkPullHintOpacity = readerBookmarkHintAlpha(state.bookmarkOffsetY);
    this.bookmarkPreviewChanged = state.bookmarkPreviewChanged;
    if (justArmed && !this.reduceMotion) {
      try { void vibrator.startVibration({ type: 'time', duration: 10 }, { usage: 'touch' }).catch((): void => {}); }
      catch (_) {}
    }
  }

  private isReaderBookmarkGestureCurrent(): boolean {
    return this.mounted && !this.exitRequested && this.bookmarkGestureAnchor.length > 0 &&
      this.bookmarkGestureAnchor === this.pageBookmarkFeedbackAnchor() &&
      this.bookmarkGestureLifecycle === this.lifecycleToken &&
      this.bookmarkGestureSelection === this.chapterSelectionToken &&
      this.bookmarkGesturePointerEpoch === this.pagePointerEpoch &&
      this.bookmarkGestureInputRevision === this.pageTurnInputRevision &&
      this.isReaderPageInteractionEnabled() && !this.pageTurnTapOnlyInput() && this.canTurnPage();
  }

  private finishInterruptedBookmarkGesture(): void {
    // Pointer retirement invalidates the epoch before the visual reset. Late
    // callbacks can neither keep this owner alive nor toggle its bookmark.
    this.bookmarkRollbackGeneration += 1;
    const animator = this.bookmarkRollbackAnimator;
    this.bookmarkRollbackAnimator = undefined;
    if (animator !== undefined) {
      try {
        animator.onFrame = (_value: number): void => {};
        animator.cancel();
      } catch (_) {}
    }
    this.bookmarkGestureAnchor = '';
    this.bookmarkPageOffsetY = 0;
    this.bookmarkRibbonFrame = undefined;
    this.bookmarkPullHintOpacity = 0;
    this.bookmarkPreviewChanged = false;
    this.clearPageTurnProjection();
    this.pageTurnGestureState = createReaderPageGestureState();
    this.pageTurnInputOwned = false;
    this.pageTurnPresentationPhase = 'idle';
    this.flushDeferredPageChromeState();
  }

  private onReaderBookmarkGestureReleased(changed: boolean): void {
    if (this.bookmarkGestureAnchor.length === 0) return;
    // Revalidate the previewed target once at UP. A canonical projection may
    // change during the drag; toggling its newer status would reverse the
    // user's preview. MOVE keeps using the admitted status without scanning.
    const current = this.isReaderBookmarkGestureCurrent() &&
      this.currentPageBookmarkStatus() === this.bookmarkPreviewStatus;
    const ownsPointerEpoch = this.bookmarkGesturePointerEpoch === this.pagePointerEpoch &&
      this.bookmarkGestureInputRevision === this.pageTurnInputRevision;
    this.bookmarkGestureAnchor = '';
    if (!current) {
      if (!ownsPointerEpoch) return;
      this.bookmarkRollbackGeneration += 1;
      this.bookmarkPageOffsetY = 0;
      this.bookmarkRibbonFrame = undefined;
      this.bookmarkPullHintOpacity = 0;
      this.bookmarkPreviewChanged = false;
      if (this.mounted && this.pageTurnGestureState.owner === 'bookmark') {
        this.pageTurnGestureState = createReaderPageGestureState();
        this.pageTurnInputOwned = false;
        this.pageTurnPresentationPhase = 'idle';
        this.flushDeferredPageChromeState();
        if (this.pageTurnPendingExit) this.resumeDeferredPageTurnWork();
      }
      return;
    }
    if (changed) this.toggleCurrentPageBookmark();
    else this.bookmarkPreviewChanged = false;
    const generation = ++this.bookmarkRollbackGeneration;
    const owner = this.bookmarkFeedbackOwnerKey();
    const target = readerBookmarkRibbonRest(this.pageBookmarkFeedbackFilled(), this.reduceMotion);
    if (this.reduceMotion && changed) {
      // A reduced transition changes only alpha. Keep the filled ribbon's
      // silhouette static during both insertion and removal.
      this.bookmarkRibbonFrame = new ReaderBookmarkRibbonFrame(target.y, READER_BOOKMARK_RIBBON_HEIGHT,
        this.bookmarkPreviewStatus === 'bookmarked' ? this.bookmarkRibbonFrame?.opacity ?? 1 : 0);
      target.fillHeight = READER_BOOKMARK_RIBBON_HEIGHT;
    }
    const finish = (): void => {
      if (owner === this.bookmarkFeedbackOwnerKey()) this.finishBookmarkRollback(generation);
    };
    if (this.reduceMotion) {
      this.getUIContext().animateTo(readerMotionReducedFadeParam(finish), (): void => {
        this.bookmarkPageOffsetY = 0;
        this.bookmarkRibbonFrame = target;
        this.bookmarkPullHintOpacity = 0;
      });
    } else {
      this.animateBookmarkRollback(generation, finish, target);
    }
  }

  private animateBookmarkRollback(generation: number, finish: () => void, target: ReaderBookmarkRibbonFrame): void {
    const offset = this.bookmarkPageOffsetY;
    const ribbon = this.bookmarkRibbonFrame ?? target;
    const curve = readerMotionStandardCurve();
    const hintOpacity = this.bookmarkPullHintOpacity;
    // Sample the shared curve so the transient clip and paint use the same
    // offset as the returning paper for every frame, including the last one.
    try {
      const animator = this.getUIContext().createAnimator({
        duration: motionAnimateParam('reader.bookmark.rollback').duration ?? 0,
        easing: 'linear', delay: 0, fill: 'forwards', direction: 'normal', iterations: 1, begin: 0, end: 1,
      });
      this.bookmarkRollbackAnimator = animator;
      animator.onFrame = (fraction: number): void => {
        if (!this.mounted || this.bookmarkRollbackAnimator !== animator ||
          generation !== this.bookmarkRollbackGeneration || this.reduceMotion) {
          // ArkUI cancellation can deliver a terminal frame synchronously.
          animator.onFrame = (_value: number): void => {};
          animator.cancel();
          return;
        }
        const remaining = 1 - curve.interpolate(Math.max(0, Math.min(1, fraction)));
        this.bookmarkPageOffsetY = offset * remaining;
        this.bookmarkRibbonFrame = new ReaderBookmarkRibbonFrame(
          target.y + (ribbon.y - target.y) * remaining,
          target.fillHeight + (ribbon.fillHeight - target.fillHeight) * remaining,
          target.opacity + (ribbon.opacity - target.opacity) * remaining);
        this.bookmarkPullHintOpacity = hintOpacity * remaining;
      };
      const complete = (): void => {
        if (this.bookmarkRollbackAnimator !== animator) return;
        this.bookmarkRollbackAnimator = undefined;
        finish();
      };
      animator.onFinish = complete;
      animator.onCancel = complete;
      animator.play();
    } catch (_) {
      this.bookmarkRollbackAnimator = undefined;
      finish();
    }
  }

  private finishBookmarkRollback(generation: number): void {
    if (generation !== this.bookmarkRollbackGeneration || !this.mounted) return;
    this.bookmarkGestureAnchor = '';
    this.bookmarkPageOffsetY = 0;
    this.bookmarkRibbonFrame = undefined;
    this.bookmarkPullHintOpacity = 0;
    this.bookmarkPreviewChanged = false;
    this.reconcilePageBookmarkFeedback();
    if (this.usesBookTurnSimulation() && this.pageTurnInputPhase() === 'idle') {
      this.bookTurnTexture.invalidate(true);
      this.scheduleBookTurnTextureRefresh();
    }
    if (this.pageTurnGestureState.owner !== 'bookmark') return;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    this.pageTurnInputOwned = false;
    this.pageTurnPresentationPhase = 'idle';
    this.flushDeferredPageChromeState();
    if (this.pageTurnPendingExit) {
      this.resumeDeferredPageTurnWork();
      return;
    }
    if (this.appForeground && !this.exitRequested) this.drainPageTurnPreparationQueue();
  }

  private currentReadingViewportStart(): number | undefined {
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous') return this.visiblePage?.startScalar;
    return this.hasCurrentMaterializedChapter() && this.continuousProjection.fragments.length > 0 ?
      this.continuousVisibleScalar : undefined;
  }

  private currentBookmarkViewport(): ReaderBookmarkViewport | undefined {
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous') {
      const page = this.visiblePage;
      return page === undefined ? undefined : { startScalar: page.startScalar, endScalar: page.endScalar };
    }
    const startScalar = this.currentReadingViewportStart();
    const last = this.continuousProjection.fragments[this.continuousProjection.visibleEnd];
    if (startScalar === undefined || last === undefined) return undefined;
    return { startScalar: startScalar, endScalar: Math.max(startScalar, last.endScalar) };
  }

  private currentPageBookmarkStatus(): 'unknown' | 'empty' | 'bookmarked' {
    const page = this.currentBookmarkViewport();
    if (page === undefined) return 'unknown';
    const entries = this.controlDirectoryEntries();
    const anchor = `${this.currentChapterIndex()}:${this.chapter?.contentVersion}:${this.chapter?.bodyVersion}:${this.chapter?.processingVersion}:${page.startScalar}:${page.endScalar}`;
    if (entries === this.bookmarkStatusEntries && anchor === this.bookmarkStatusAnchor) return this.bookmarkStatusValue;
    this.bookmarkStatusEntries = entries;
    this.bookmarkStatusAnchor = anchor;
    const entry = entries.find((candidate: LocalReadingTocEntry): boolean =>
      candidate.index === this.currentChapterIndex());
    this.bookmarkStatusValue = entry?.bookmarks === undefined ? 'unknown' : 'empty';
    if (entry?.bookmarks === undefined) return this.bookmarkStatusValue;
    for (const bookmark of entry.bookmarks) {
      if (!this.bookmarkMatchesCurrentChapter(bookmark)) continue;
      if (page.endScalar > page.startScalar ?
        bookmark.chapterOffset >= page.startScalar && bookmark.chapterOffset < page.endScalar :
        bookmark.chapterOffset === page.startScalar) { this.bookmarkStatusValue = 'bookmarked'; break; }
    }
    return this.bookmarkStatusValue;
  }

  private controlPageBookmarkStatus(_revision: number): 'unknown' | 'empty' | 'bookmarked' {
    return this.currentPageBookmarkStatus();
  }

  private controlPageBookmarkEnabled(revision: number): boolean {
    const anchor = this.pageBookmarkFeedbackAnchor();
    return anchor.length > 0 && this.bookmarkWriteEnabled() && this.controlPageBookmarkStatus(revision) !== 'unknown' &&
      !(this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === anchor);
  }

  private pageBookmarkFeedbackAnchor(): string {
    const page = this.currentBookmarkViewport();
    return page === undefined ? '' : `${this.sourceId}:${this.bookId}:${this.currentChapterIndex()}:${this.chapter?.contentVersion}:${this.chapter?.bodyVersion}:${this.chapter?.processingVersion}:${page.startScalar}:${page.endScalar}`;
  }

  private pageBookmarkFeedbackFilled(): boolean {
    if (this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === this.pageBookmarkFeedbackAnchor() &&
      this.bookmarkPendingOwner === this.bookmarkFeedbackOwnerKey()) {
      return this.bookmarkPendingTarget === 'bookmarked';
    }
    if (this.bookmarkGestureAnchor.length > 0 && this.bookmarkPreviewOwner === this.bookmarkFeedbackOwnerKey()) {
      const bookmarked = this.bookmarkPreviewStatus === 'bookmarked';
      return this.bookmarkPreviewChanged ? !bookmarked : bookmarked;
    }
    return this.currentPageBookmarkStatus() === 'bookmarked';
  }

  private pageBookmarkFeedbackMode(_renderRevision: number): 'hidden' | 'filled' | 'outline' {
    // visiblePage is atomically published; render callers consume its revision.
    if (this.pageBookmarkFeedbackFilled()) return 'filled';
    return 'hidden';
  }

  private pageBookmarkFeedbackOpacity(): number {
    return this.pageBookmarkFeedbackFilled() ? 1 : 0;
  }

  private currentBookmarkRibbonFrame(_renderRevision: number): ReaderBookmarkRibbonFrame | undefined {
    const frame = this.bookmarkRibbonFrame;
    if (frame === undefined || this.bookmarkPreviewOwner !== this.bookmarkFeedbackOwnerKey()) return undefined;
    return this.reduceMotion && this.bookmarkPageOffsetY > 0 ?
      readerBookmarkRibbonPull(this.bookmarkPageOffsetY, this.bookmarkPreviewStatus === 'bookmarked', true) : frame;
  }

  private pageBookmarkStatusFor(
    chapterIndex: number,
    sourceId: string,
    bookId: string,
    bodyVersion: string | undefined,
    processingVersion: string | undefined,
    startScalar: number,
    endScalar: number,
  ): 'unknown' | 'empty' | 'bookmarked' {
    const entry = this.controlDirectoryEntries().find((candidate: LocalReadingTocEntry): boolean =>
      candidate.index === chapterIndex);
    if (entry?.bookmarks === undefined) return 'unknown';
    for (const mark of entry.bookmarks) {
      if (mark.chapterIndex !== chapterIndex) continue;
      if (sourceId !== LOCAL_READING_SOURCE_ID &&
        (mark.positionScope === undefined || mark.positionScope.sourceId !== sourceId ||
          mark.positionScope.bookId !== bookId || mark.positionScope.chapterIndex !== chapterIndex ||
          mark.positionScope.bodyVersion !== bodyVersion || mark.positionScope.processingVersion !== processingVersion)) continue;
      const inside = endScalar > startScalar ?
        mark.chapterOffset >= startScalar && mark.chapterOffset < endScalar : mark.chapterOffset === startScalar;
      if (inside) return 'bookmarked';
    }
    return 'empty';
  }

  private bookmarkSnapshotForCurrentPage(): ReaderPageBookmarkSnapshot {
    const layout = this.bookmarkCornerLayout();
    return new ReaderPageBookmarkSnapshot(this.pageBookmarkFeedbackMode(this.pageTurnRenderRevision),
      this.pageBookmarkFeedbackOpacity(), this.pageGeometry.bookmarkRibbonX(layout), this.bookmarkRibbonPaperTop(this.readingLayout()),
      READER_BOOKMARK_RIBBON_WIDTH, READER_BOOKMARK_RIBBON_HEIGHT);
  }

  private bookmarkSnapshotForPreparedPage(
    chapterIndex: number,
    sourceId: string,
    bookId: string,
    bodyVersion: string | undefined,
    processingVersion: string | undefined,
    startScalar: number,
    endScalar: number,
  ): ReaderPageBookmarkSnapshot {
    const layout = this.bookmarkCornerLayout();
    const status = this.pageBookmarkStatusFor(chapterIndex, sourceId, bookId, bodyVersion, processingVersion,
      startScalar, endScalar);
    return new ReaderPageBookmarkSnapshot(status === 'bookmarked' ? 'filled' : 'hidden', status === 'bookmarked' ? 1 : 0,
      this.pageGeometry.bookmarkRibbonX(layout), this.bookmarkRibbonPaperTop(this.readingLayout()),
      READER_BOOKMARK_RIBBON_WIDTH, READER_BOOKMARK_RIBBON_HEIGHT);
  }

  private reconcilePageBookmarkFeedback(): void {
    if (this.bookmarkPendingTarget.length === 0) return;
    if (this.bookmarkPendingAnchor !== this.pageBookmarkFeedbackAnchor() ||
      this.bookmarkPendingOwner !== this.bookmarkFeedbackOwnerKey()) {
      this.bookmarkMutationGeneration += 1;
      this.bookmarkPendingTarget = '';
      this.bookmarkMutationConfirmed = false;
      return;
    }
    if (this.bookmarkMutationConfirmed &&
      !this.bookmarkPreviewChanged && this.currentPageBookmarkStatus() === this.bookmarkPendingTarget) {
      // Keep the released target through rebound. Once the canonical write
      // arrives, applying the still-active drag preview would invert it twice.
      this.bookmarkPendingTarget = '';
      this.bookmarkMutationConfirmed = false;
    }
  }

  private bookmarkRibbonPaperTop(layout: ReaderReadingLayoutSnapshot): number {
    return this.pageGeometry.bookmarkRibbonPaperTop(layout, this.readerSettingsSnapshot.hideStatusBar === true);
  }

  private bookmarkCornerLayout(): ReaderPageChromeLayoutSnapshot {
    return this.pageGeometry.bookmarkCornerLayout(this.readingLayout(), this.getUIContext(),
      this.bookTitle, this.pageChromeClockText, this.readerSettingsSnapshot);
  }

  private bookmarkUnavailableHintFits(): boolean {
    this.bookmarkCornerLayout();
    return this.pageGeometry.bookmarkUnavailableHintFits();
  }

  private bookmarkFeedbackOwnerKey(): string {
    return JSON.stringify([this.lifecycleToken, this.chapterSelectionToken, this.pageBookmarkFeedbackAnchor()]);
  }

  private onReaderBookmarkGestureUnavailable(reason: 'busy' | 'unavailable'): void {
    if (!this.isReaderPageInteractionEnabled()) return;
    const anchor = this.pageBookmarkFeedbackAnchor();
    const message = reason === 'busy' ? '页面切换中，请稍后下拉' :
      this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === anchor ?
        '书签正在保存，请稍后再试' : !this.bookmarkWriteEnabled() ? (this.bookmarkRecovery.bookmarkWriteBlockReason ??
          (this.bookmarkRecovery.bookmarks.visible ? '原书签操作待核对，请在“更多 → 待处理事项”中核对原记录' : '书签状态尚未就绪，请稍后重试')) : this.currentPageBookmarkStatus() === 'unknown' ?
        '书签尚未加载，请稍后下拉' : '页面尚未就绪，请稍后下拉';
    const generation = ++this.bookmarkUnavailableGeneration;
    if (this.bookmarkUnavailableTimer >= 0) clearTimeout(this.bookmarkUnavailableTimer);
    this.bookmarkUnavailableTimer = -1;
    const owner = this.bookmarkFeedbackOwnerKey();
    this.bookmarkUnavailableOwner = owner;
    // A rejected gesture does not translate the page. Use the same quiet
    // whitespace slot when it fits; otherwise retain the existing platform
    // short feedback. The arena invokes this only once per physical segment.
    if (!this.bookmarkUnavailableHintFits()) {
      this.bookmarkUnavailableMessage = '';
      try { this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.isSessionActive(this.lifecycleToken) && this.appForeground && this.windowChromeActive && generation === this.bookmarkUnavailableGeneration && owner === this.bookmarkFeedbackOwnerKey()); } catch (_) {}
      return;
    }
    this.bookmarkUnavailableMessage = message;
    this.bookmarkUnavailableTimer = setTimeout((): void => {
      if (generation !== this.bookmarkUnavailableGeneration || !this.mounted) return;
      this.bookmarkUnavailableTimer = -1;
      // Expire this generation even after navigating away. Keeping an old
      // page's expired text would reveal it again when that page is revisited.
      if (owner === this.bookmarkUnavailableOwner) this.bookmarkUnavailableMessage = '';
    }, 1600);
  }

  private bookmarkFeedbackLabel(): string {
    return this.bookmarkPreviewChanged ? (this.bookmarkPreviewStatus === 'bookmarked' ?
      '松手移除本页书签' : '松手添加书签') :
        this.bookmarkPreviewStatus === 'bookmarked' ? '下拉移除本页书签' : '下拉添加书签';
  }

  private bookmarkUnavailableHintCurrent(_renderRevision: number): boolean {
    return this.bookmarkUnavailableMessage.length > 0 && this.bookmarkUnavailableOwner === this.bookmarkFeedbackOwnerKey();
  }

  private continuousBookmarkRibbonFrame(_renderRevision: number): ReaderBookmarkRibbonFrame {
    return this.currentBookmarkRibbonFrame(_renderRevision) ?? readerBookmarkRibbonRest(this.pageBookmarkFeedbackFilled());
  }

  private bookmarkHintVisibleAlpha(_renderRevision: number): number {
    const alpha = this.bookmarkPullHintOpacity;
    if (this.bookmarkUnavailableHintCurrent(_renderRevision)) return 1;
    return this.bookmarkPreviewOwner === this.bookmarkFeedbackOwnerKey() ? alpha : 0;
  }

  private bookmarkPullOffset(): number {
    return !this.reduceMotion && this.bookmarkPageOffsetY > 0.5 && this.pageTurnOffsetX === 0 &&
      this.pageTurnDirection === undefined ? this.bookmarkPageOffsetY : 0;
  }

  private bookmarkPullPaperTop(layout: ReaderReadingLayoutSnapshot): number {
    const metrics = layout.pageChromeStatusMetrics;
    const cutout = metrics?.statusBarCutoutRect;
    // The resting ribbon can use a side lane beside the cutout. A full-width
    // edge needs to clear its lower boundary even with the status bar hidden.
    return Math.max(this.bookmarkRibbonPaperTop(layout), metrics?.cutoutInsets.top ?? 0,
      cutout !== undefined && cutout.height > 0 ? cutout.top + cutout.height : 0);
  }

  private bookmarkPullFeedbackColor(): string {
    const theme = readerThemeDefinition(this.visibleReadingAppearance().activeTheme);
    if (!this.bookmarkPreviewChanged) return theme.chromeMeta;
    return readerAppColor(this.bookmarkPreviewStatus === 'bookmarked' ? 'TOK_ACCENT' : 'TOK_READ_PRIMARY', theme.scheme);
  }

  @Builder
  private bookmarkCornerFeedback(paperWell: boolean = false) {
    if (!paperWell && !this.controlVisible() && !this.controlObscured &&
      readerRenderStageKind(this.readerSettingsSnapshot.navigationMode, this.hasContinuousRenderContent()) === 'continuous') {
      // The paged actor belongs to its physical slot. Only the List needs a host marker.
      ReaderPageBookmarkRibbon({
        x: this.pageGeometry.bookmarkRibbonX(this.bookmarkCornerLayout()),
        paperTop: this.bookmarkRibbonPaperTop(this.readingLayout()),
        offsetY: this.continuousBookmarkRibbonFrame(this.pageTurnRenderRevision).y,
        fillHeight: this.continuousBookmarkRibbonFrame(this.pageTurnRenderRevision).fillHeight,
        alpha: this.continuousBookmarkRibbonFrame(this.pageTurnRenderRevision).opacity,
        bookmarked: this.pageBookmarkFeedbackFilled(),
        night: readerAppearanceChromeTone(this.visibleReadingAppearance().activeTheme) === 'light',
      });
    }
    if (paperWell && !this.controlVisible() && !this.controlObscured &&
      !this.bookmarkUnavailableHintCurrent(this.pageTurnRenderRevision)) {
      ReaderBookmarkPullFeedback({
        alpha: this.bookmarkHintVisibleAlpha(this.pageTurnRenderRevision),
        text: this.bookmarkFeedbackLabel(), ink: this.bookmarkPullFeedbackColor(), offset: this.bookmarkPullOffset(),
        paperTop: this.bookmarkPullPaperTop(this.readingLayout()),
        day: readerThemeDefinition(this.visibleReadingAppearance().activeTheme).scheme === 'day',
      });
    }
    // Keep the quiet node mounted for reduced-motion alpha interpolation.
    if (!paperWell && !this.controlVisible() && !this.controlObscured &&
      (this.reduceMotion || this.bookmarkUnavailableHintCurrent(this.pageTurnRenderRevision))) {
      ReaderBookmarkQuietFeedback({
        text: this.bookmarkUnavailableHintCurrent(this.pageTurnRenderRevision) ?
          this.bookmarkUnavailableMessage : this.bookmarkFeedbackLabel(),
        ink: readerThemeDefinition(this.visibleReadingAppearance().activeTheme).chromeMeta,
        width: this.pageGeometry.bookmarkHintWidth, height: this.pageGeometry.bookmarkHintHeight,
        x: this.pageGeometry.bookmarkHintX, y: this.pageGeometry.bookmarkHintY,
        alpha: this.bookmarkHintVisibleAlpha(this.pageTurnRenderRevision),
      });
    }
  }

  private currentPageBookmarkText(): string {
    const page = this.currentBookmarkViewport();
    const chapter = this.chapter;
    const map = this.chapterLayoutMap;
    if (page === undefined || chapter === undefined || map === undefined) return '';
    return chapter.content.substring(map.utf16ForScalar(page.startScalar),
      map.utf16ForScalar(Math.min(page.endScalar, page.startScalar + 160)));
  }

  private toggleCurrentPageBookmark(): void {
    if (!this.bookmarkWriteEnabled()) { this.onReaderBookmarkGestureUnavailable('unavailable'); return; }
    const page = this.currentBookmarkViewport();
    const chapterIndex = this.currentChapterIndex();
    if (page === undefined || chapterIndex < 0) return;
    const entries = this.controlDirectoryEntries();
    let currentEntry: LocalReadingTocEntry | undefined = undefined;
    for (const entry of entries) {
      if (entry.index === chapterIndex) {
        currentEntry = entry;
        break;
      }
    }
    // `undefined` is an unadmitted Core projection, never evidence that the
    // page is currently unbookmarked.
    if (currentEntry === undefined || currentEntry.bookmarks === undefined) return;
    const bookmarkTimes: number[] = [];
    for (const bookmark of currentEntry.bookmarks) {
      if (!this.bookmarkMatchesCurrentChapter(bookmark)) continue;
      const insidePage = page.endScalar > page.startScalar ?
        bookmark.chapterOffset >= page.startScalar && bookmark.chapterOffset < page.endScalar :
        bookmark.chapterOffset === page.startScalar;
      if (insidePage && Number.isSafeInteger(bookmark.time)) {
        bookmarkTimes.push(bookmark.time);
      }
    }
    const anchor = this.pageBookmarkFeedbackAnchor();
    if (this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === anchor) return;
    const generation = ++this.bookmarkMutationGeneration;
    const lifecycle = this.lifecycleToken;
    const selection = this.chapterSelectionToken;
    this.bookmarkPendingAnchor = anchor;
    this.bookmarkPendingOwner = this.bookmarkFeedbackOwnerKey();
    this.bookmarkMutationConfirmed = false;
    this.bookmarkPendingTarget = bookmarkTimes.length > 0 ? 'empty' : 'bookmarked';
    this.bookmarkPresentationRevision += 1;
    this.onTogglePageBookmark({
      chapterIndex,
      chapterOffset: page.startScalar,
      chapterTitle: currentEntry.title,
      bookmarkTimes,
      bookText: this.currentPageBookmarkText(),
      positionScope: this.chapter?.bodyVersion !== undefined && this.chapter.processingVersion !== undefined ?
        { sourceId: this.sourceId, bookId: this.bookId, chapterIndex,
          bodyVersion: this.chapter.bodyVersion, processingVersion: this.chapter.processingVersion } : undefined,
      onSettled: (success: boolean): void => {
        if (generation !== this.bookmarkMutationGeneration || !this.mounted) return;
        if (lifecycle !== this.lifecycleToken || selection !== this.chapterSelectionToken ||
          anchor !== this.pageBookmarkFeedbackAnchor()) {
          // Retire only this still-owned request. An ACK arriving on another
          // page must not paint it, or leave the origin locked on a revisit.
          if (this.bookmarkPendingAnchor === anchor) {
            this.bookmarkPendingTarget = '';
            this.bookmarkMutationConfirmed = false;
          }
          return;
        }
        this.bookmarkMutationConfirmed = success;
        if (!success) { this.bookmarkPendingTarget = ''; this.bookmarkPreviewChanged = false; }
        this.bookmarkPresentationRevision += 1;
        this.reconcilePageBookmarkFeedback();
      },
    });
  }

  private clampedPageTurnOffset(direction: ReaderPageTurnDirection, offsetX: number): number {
    const width = Math.max(0, this.viewportWidth);
    if (direction === 'next') {
      return Math.max(-width, Math.min(0, offsetX));
    }
    return Math.min(width, Math.max(0, offsetX));
  }

  private beginPageTurnPerf(direction: ReaderPageTurnDirection, path: string): void {
    if (this.pageTurnPerfStartedAtMs > 0) return;
    this.pageTurnPerfStartedAtMs = readerMotionNowMs();
    this.pageTurnPerfStyle = this.effectivePageTurnStyle();
    this.pageTurnPerfPath = path;
    this.pageTurnPerfDirection = direction;
  }

  private finishPageTurnPerf(outcome: string): void {
    if (this.pageTurnPerfStartedAtMs <= 0) return;
    const completedAtMs = readerMotionNowMs();
    const totalMs = Math.max(0, completedAtMs - this.pageTurnPerfStartedAtMs);
    const automatic = this.pageTurnAutomaticStart;
    hilog.info(0x5244, 'Reader',
      'PAGETURN_PERF style=%{public}s path=%{public}s dir=%{public}s outcome=%{public}s totalMs=%{public}d startedAtMs=%{public}d completedAtMs=%{public}d',
      this.pageTurnPerfStyle, this.pageTurnPerfPath, this.pageTurnPerfDirection, outcome, totalMs,
      this.pageTurnPerfStartedAtMs, completedAtMs);
    if (automatic !== undefined) hilog.info(0x5244, 'Reader',
      'PAGETURN_AUTO generation=%{public}d origin=%{public}s bufferEventAtMs=%{public}d showRequestedAtMs=%{public}d startAckAtMs=%{public}d completedAtMs=%{public}d',
      automatic.generation, automatic.origin, automatic.bufferEventReceivedAtMs, automatic.showRequestedAtMs,
      automatic.startedAtMs, completedAtMs);
    this.pageTurnPerfStartedAtMs = 0;
    this.pageTurnPerfStyle = '';
    this.pageTurnPerfPath = '';
    this.pageTurnPerfDirection = '';
  }

  private animatePageTurnRollback(preserveGeneration: boolean = false): void {
    if (this.preparedSettlement.prepared !== undefined) return;
    if (this.pageTurnSettlementLayout === undefined) {
      this.pageTurnSettlementLayout = this.readingLayout();
    }
    this.pageTurnSettlementActive = true;
    this.pageTurnPresentationPhase = 'rollback';
    this.pageTurnInputOwned = true;
    this.preparedSettlement.releaseCommit();
    if (this.pageTurnPresentationWidth <= 0) this.pageTurnPresentationWidth = this.viewportWidth;
    const simulation = this.usesBookTurnSimulation();
    const generation = preserveGeneration ? this.pageTurnSettlementGeneration :
      (simulation && this.bookTurnMotion !== undefined ? this.bookTurnMotion.generation : this.pageTurnSettlementGeneration + 1);
    this.pageTurnAutomaticStart = undefined;
    this.pageTurnSettlementGeneration = generation;
    this.bookTurnSurfaceGeneration = generation;
    // Hold the stale/terminal EGL buffer until the new settlement generation
    // has produced its first valid frame (FRAME_PRESENTED).
    this.bookTurnSurfaceOpacity = simulation ?
      (this.bookTurnMotion !== undefined ? this.bookTurnSurfaceOpacity : 0) : 1;
    this.pageTurnAnimationFinished = false;
    this.armPageTurnSettlementDeadline(generation);
    if (simulation) {
      const inputActive = this.bookTurnMotion?.active === true;
      if (this.bookTurnMotion !== undefined) stopBookTurnMotion(this.bookTurnMotion);
      if (!(this.bookTurnMotion !== undefined && inputActive ?
        this.bookTurnSession.endGesture(bookTurnInput(this.bookTurnMotion), false) :
        this.bookTurnSession.settle(generation, false))) {
        this.bookTurnRuntimeFailed = true;
        this.finishPageTurnRollback(generation);
      }
      return;
    }
    if (this.pageTurnOffsetX === 0 || this.usesNoAnimationPageTurnRuntime()) {
      this.finishPageTurnRollback(generation);
      return;
    }
    this.startPageTurnSlideTimeline(0, generation);

  }

  private finishPageTurnRollback(generation: number): void {
    if (generation !== this.pageTurnSettlementGeneration) return;
    if (this.pageTurnSettlementOrigin === 'ttsFollow' && this.pageTurnSettlementTtsOwner !== undefined) {
      this.ttsPageFollow.failed(this.pageTurnSettlementTtsOwner);
    }
    this.clearPageTurnProjection();
    this.finishPageTurnPerf('rollback');
    this.pageTurnAutomaticStart = undefined;
    this.pageTurnSettlementOrigin = 'manual';
    this.pageTurnSettlementTtsOwner = undefined;
    this.preparedSettlement.cancelDeadline();
    this.pageTurnAnimationFinished = true;
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    if (this.usesBookTurnSimulation() && this.pageTurnPresentationPhase !== 'released' &&
      this.bookTurnSession.retainedTerminalGeneration() === generation) {
      this.scheduleBookTurnRollbackSurfaceClear(generation);
      return;
    }
    this.pageTurnInputOwned = false;
    this.pageTurnSettlementActive = false;
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnPresentationWidth = 0;
    this.preparedSettlement.releaseCommit();
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookmarkPageOffsetY = 0;
    this.bookmarkRibbonFrame = undefined;
    this.bookmarkPullHintOpacity = 0;
    this.bookmarkPreviewChanged = false;
    if (this.bookmarkMutationConfirmed) this.reconcilePageBookmarkFeedback();
    this.recoverBookTurnSurfaceIfIdle();
    this.flushDeferredPageChromeState();
    this.retryRapidPageTurnTransaction();
    this.resumeDeferredPageTurnWork();
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
    this.drainPageTurnPreparationQueue();
    if (this.isSessionActive(this.lifecycleToken) && this.automaticReadingState().status === 'running' &&
      !this.automaticReadingState().awaitingPageCommit) {
      this.armAutoPageTimer(true);
    }
    if (!this.usesBookTurnSimulation()) this.pageTurnPresentationPhase = 'idle';
    // Snapshot refresh is triggered by TERMINAL_RELEASED after the restored
    // ArkUI page has been confirmed and the native surface has been cleared.
    // Capturing here races the rollback page's first composition frame.
  }

  private scheduleBookTurnRollbackSurfaceClear(generation: number): void {
    if (!this.mounted || this.exitRequested || !this.usesBookTurnSimulation() ||
      generation !== this.pageTurnSettlementGeneration || generation !== this.bookTurnSurfaceGeneration) return;
    this.armPageTurnSettlementDeadline(generation);
    this.scheduleBookTurnSurfaceRelease(generation);
  }

  private startPreparedPageTurnSettlement(
    direction: ReaderPageTurnDirection,
    prepared: PreparedReaderPageTurn,
    origin: ReaderPageTurnOrigin = 'manual',
    ttsOwner?: ReaderTtsFollowLease,
  ): boolean {
    if (!this.isPreparedPageTurnFresh(prepared) || this.preparedSettlement.prepared !== undefined ||
      this.viewportWidth <= 0) {
      return false;
    }
    if (prepared.context.chapter.chapterIndex !== this.currentChapterIndex()) {
      this.observeChapterTransition(this.sourceId === LOCAL_READING_SOURCE_ID ? 'local' : 'cache', prepared.context.chapter.chapterIndex);
    }
    this.bookTurnTexture.invalidate(true);
    const lifecycleToken = this.lifecycleToken;
    const simulation = this.usesBookTurnSimulation();
    const noAnimation = this.usesNoAnimationPageTurnRuntime();
    const settlementGeneration = simulation && this.bookTurnMotion !== undefined ?
      this.bookTurnMotion.generation : this.pageTurnSettlementGeneration + 1;
    this.beginPageTurnPerf(direction, 'prepared');
    this.pageTurnSettlementLayout = this.readingLayout();
    this.pageTurnSettlementGeneration = settlementGeneration;
    this.bookTurnSurfaceGeneration = settlementGeneration;
    // Do not expose the previous EGL buffer while a programmatic settlement
    // is waiting for its first native frame.
    this.bookTurnSurfaceOpacity = simulation ?
      (this.bookTurnMotion !== undefined ? this.bookTurnSurfaceOpacity : 0) : 1;
    this.pageTurnSettlementActive = true;
    this.pageTurnSettlementOrigin = origin;
    this.pageTurnSettlementTtsOwner = ttsOwner;
    this.pageTurnAutomaticStart = simulation && this.bookTurnMotion === undefined && origin !== 'manual' ? {
      generation: settlementGeneration, lifecycleToken, origin, autoGeneration: this.automaticReadingState().generation,
      ttsOwner, surfaceToken: 0, scheduled: false, started: false,
      bufferEventReceivedAtMs: 0, showRequestedAtMs: 0, startedAtMs: 0,
    } : undefined;
    this.pageTurnPresentationPhase = 'settling';
    this.pageTurnPresentationWidth = this.viewportWidth;
    this.preparedSettlement.stage(prepared);
    this.pageTurnAnimationFinished = noAnimation && !simulation;
    this.pageTurnDirection = direction;
    this.pageTurnInputOwned = true;
    this.armPageTurnSettlementDeadline(settlementGeneration);

    const targetOffset = direction === 'next' ? -this.viewportWidth : this.viewportWidth;
    if (simulation) {
      const started = this.bookTurnMotion !== undefined ?
        this.bookTurnSession.endGesture(bookTurnInput(this.bookTurnMotion), true) :
        this.bookTurnSession.startProgrammatic(settlementGeneration, direction, origin !== 'manual' ?
          BOOK_TURN_PROFILE_AUTOMATIC : (Math.abs(this.rapidPageTurnState.pendingDelta) > 1 ?
            BOOK_TURN_PROFILE_RAPID : BOOK_TURN_PROFILE_MANUAL));
      if (this.bookTurnMotion !== undefined) stopBookTurnMotion(this.bookTurnMotion);
      if (!started) {
        this.bookTurnRuntimeFailed = true;
        this.preparedSettlement.discardDestination();
        this.animatePageTurnRollback();
        return true;
      }
    } else if (noAnimation) {
      this.pageTurnOffsetX = targetOffset;
      this.beginPreparedPageTurnPersistence(prepared, lifecycleToken, settlementGeneration);
    } else {
      this.animatePreparedPageTurnSlide(targetOffset, settlementGeneration);
    }
    return true;
  }

  private beginPreparedPageTurnPersistence(prepared: PreparedReaderPageTurn, lifecycleToken: number,
    settlementGeneration: number): void {
    if (settlementGeneration === this.pageTurnSettlementGeneration) {
      this.preparedSettlement.begin(prepared, lifecycleToken, settlementGeneration);
    }
  }

  private canPresentOrdinaryPage(chapter: ReadingSessionChapter): boolean {
    return this.sourceSwitchTransactionId === undefined && this.chapterSelection.ticket === undefined &&
      this.activeGateway().canPersistPresentedProgress() &&
      (chapter.positionMigration === undefined || chapter.positionMigration.status === 'unchanged');
  }

  private markOrdinaryPageMeasurement(chapterIndex: number): void {
    this.ordinaryPageMeasurementSelection = this.chapterSelectionToken;
    this.ordinaryPageMeasurementLifecycle = this.lifecycleToken;
    this.ordinaryPageMeasurementChapter = chapterIndex;
    this.ordinaryPageMeasurementLayout = this.paginationLayoutSignature();
  }

  private isOrdinaryPageMeasurement(chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean {
    return this.readerSettingsSnapshot.navigationMode === 'paged' &&
      this.ordinaryPageMeasurementSelection === selection && this.ordinaryPageMeasurementLifecycle === lifecycle &&
      this.ordinaryPageMeasurementChapter === chapter.chapterIndex &&
      this.ordinaryPageMeasurementLayout === this.paginationLayoutSignature() && this.canPresentOrdinaryPage(chapter);
  }

  private async persistPresentedPageTurn(prepared: PreparedReaderPageTurn, lifecycleToken: number): Promise<void> {
    const chapter = prepared.context.chapter;
    const page = prepared.page;
    const selectionToken = this.chapterSelectionToken;
    const scalarCount = prepared.context.layoutMap.scalarCount();
    const current = (): boolean => this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken);
    const intent = this.progressProducerIntent(chapter,
      new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, scalarCount === 0 ? 0 : page.startScalar / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.coreLayout(),
      current, current, (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored));
    try {
      await this.progressProducers.persistPresented(intent, 'READING_PAGE_TURN_PROGRESS_ANCHOR_MISMATCH');
      // Receipt delivery cannot promote/rewind a page or change a texture generation.
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience presented page save pending: ${this.errorMessage(error as Error)}`);
    }
  }

  private animatePreparedPageTurnSlide(targetOffset: number, settlementGeneration: number): void {
    this.startPageTurnSlideTimeline(targetOffset, settlementGeneration);
  }

  private startPageTurnSlideTimeline(targetOffset: number, generation: number): void {
    this.pageTurnSlideTimeline = new ReaderPageSettlementTimeline(this.pageTurnOffsetX, targetOffset,
      this.pageTurnPresentationWidth, this.pageTurnGestureState.velocityX, readerMotionNowMs(),
      Math.abs(this.rapidPageTurnState.pendingDelta) > 1 && this.pageTurnGestureState.owner === 'undecided');
    this.advancePageTurnSlideTimeline(generation);
  }

  private advancePageTurnSlideTimeline(generation: number): void {
    const timeline = this.pageTurnSlideTimeline;
    if (!this.mounted || timeline === undefined || generation !== this.pageTurnSettlementGeneration) return;
    const now = readerMotionNowMs();
    this.pageTurnOffsetX = timeline.position(now);
    if (timeline.finished(now)) {
      this.pageTurnSlideTimeline = undefined;
      this.pageTurnAnimationFinished = true;
      const prepared = this.preparedSettlement.prepared;
      if (prepared === undefined) this.finishPageTurnRollback(generation);
      else this.beginPreparedPageTurnPersistence(prepared, this.lifecycleToken, generation);
      return;
    }
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (this.pageTurnSlideTimeline === timeline) this.advancePageTurnSlideTimeline(generation);
    }));
  }


  private acquirePreparedPageWrite(lifecycleToken: number): () => void {
    const commitGeneration = (this.progressCommitGeneration ?? 0) + 1;
    this.progressCommitGeneration = commitGeneration;
    this.commitInFlight = true;
    return (): void => {
      if (this.isMountedToken(lifecycleToken) && this.progressCommitGeneration === commitGeneration) {
        this.commitInFlight = false;
      }
    };
  }

  private writePreparedPageTurn(prepared: PreparedReaderPageTurn, current: () => boolean): Promise<LocalReadingProgress> {
    const chapter = prepared.context.chapter;
    const scalarCount = prepared.context.layoutMap.scalarCount();
    const offset = prepared.page.startScalar;
    return this.persistMeasuredCanonicalProgress(this.bookId, chapter.chapterTitle,
      new CoreReadingAnchor(chapter.chapterIndex, offset, scalarCount === 0 ? 0 : offset / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.coreLayout(), current);
  }

  private isPreparedPageTurnCommitCurrent(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): boolean {
    return this.isMountedToken(lifecycleToken) && !this.exitRequested &&
      settlementGeneration === this.pageTurnSettlementGeneration &&
      this.preparedSettlement.prepared === prepared && this.isPreparedPageTurnFresh(prepared);
  }

  private finishPreparedPageTurnSettlement(settlementGeneration: number, presentedPersistence: boolean = false): void {
    if (settlementGeneration !== this.pageTurnSettlementGeneration) return;
    const join = this.preparedSettlement.join(this.pageTurnAnimationFinished, presentedPersistence,
      (prepared: PreparedReaderPageTurn): boolean => this.isPreparedPageTurnFresh(prepared));
    if (join.action === 'rollback') {
      this.autoPageCoordinator.retryTurn(this.automaticReadingState().generation);
      this.animatePageTurnRollback();
      return;
    }
    if (join.action !== 'promote') return;
    const prepared = join.prepared;
    this.promotePreparedPageTurn(prepared, join.stored);
    this.preparedSettlement.discardDestination();
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    if (this.usesBookTurnSimulation()) {
      this.bookTurnAwaitingSlotCommit = true;
      // Presentation barrier: Native auto-retains the terminal frame at the
      // visual commit endpoint; restate it defensively here (idempotent,
      // refreshes the retain timestamp).
      this.bookTurnSession.retainTerminalFrame(settlementGeneration);
      this.bookTurnSession.commitSlots(settlementGeneration, prepared.direction);
      this.armPageTurnSettlementDeadline(settlementGeneration);
      return;
    }
    this.pageTurnInputOwned = false;

    // Keep the translated endpoint until the scheduled ArkUI callback.
    // This orders promotion; it does not acknowledge physical presentation.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.finishSuccessfulPageTurnPresentation(settlementGeneration);
    }));
  }

  private confirmBookTurnPresented(settlementGeneration: number): void {
    if (!this.mounted || this.exitRequested) return;
    if (settlementGeneration !== this.pageTurnSettlementGeneration ||
      settlementGeneration !== this.bookTurnSurfaceGeneration || this.bookTurnAwaitingSlotCommit ||
      this.bookTurnArkUIReadyRevision !== this.pageTurnRenderRevision ||
      this.bookTurnArkUIContentRevision !== this.pageTurnRenderRevision ||
      (this.pageTurnPresentationPhase !== 'logicalPromoted' && this.pageTurnPresentationPhase !== 'rollback')) return;
    this.pageTurnPresentationPhase = 'arkuiPresented';
    // Hide through opacity without rebuilding the XComponent or submitting
    // a transparent Native buffer. Release follows a scheduled frame callback;
    // an actual display acknowledgement is not available here.
    this.bookTurnSurfaceOpacity = 0;
    this.pageTurnPresentationPhase = 'surfaceHidden';
    const generation = this.bookTurnSurfaceGeneration;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.mounted || this.exitRequested || generation !== this.bookTurnSurfaceGeneration ||
        this.bookTurnSurfaceOpacity !== 0) return;
      // Queue release and clear together; the native render thread processes
      // them in order, and its generation gate accepts clear while release is
      // still queued. No visible transparent swap is submitted.
      if (this.bookTurnSession.releaseTerminalFrame(settlementGeneration)) {
        this.bookTurnSession.clearSurface(settlementGeneration);
      }
    }));
  }

  /**
   * ReaderPageTurnStage acknowledges a revision after its update callback.
   * This is an ArkUI scheduling acknowledgement, not a display presentation fence.
   * Device traces must independently verify the final composition.
   */
  private onBookTurnArkUIFramePresented(revision: number): void {
    if (!this.mounted || this.exitRequested || !this.usesBookTurnSimulation() ||
      revision !== this.pageTurnRenderRevision) return;
    if (this.bookTurnArkUIContentRevision !== revision) {
      this.bookTurnArkUIContentRevision = revision;
      if (this.pageTurnInputPhase() === 'idle') this.scheduleBookTurnTextureRefresh();
    }
    if (this.bookTurnAwaitingSlotCommit || (this.pageTurnPresentationPhase !== 'logicalPromoted' &&
      this.pageTurnPresentationPhase !== 'rollback')) return;
    this.confirmBookTurnPresented(this.pageTurnSettlementGeneration);
  }

  private scheduleBookTurnSurfaceRelease(settlementGeneration: number): void {
    if (!this.mounted || this.exitRequested || !this.usesBookTurnSimulation() ||
      settlementGeneration !== this.pageTurnSettlementGeneration ||
      settlementGeneration !== this.bookTurnSurfaceGeneration) return;
    // The resident target's exact revision and its scheduling acknowledgement
    // are both required. Elapsed frames never stand in for content admission.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.confirmBookTurnPresented(settlementGeneration);
    }));
  }

  private onBookTurnArkUIContentReady(revision: number): void {
    if (!this.mounted || this.exitRequested || revision !== this.pageTurnRenderRevision) return;
    this.bookTurnArkUIReadyRevision = revision;
    const lifecycle = this.lifecycleToken;
    void Promise.resolve().then((): void => {
      if (!this.mounted || this.exitRequested || lifecycle !== this.lifecycleToken || revision !== this.pageTurnRenderRevision) return;
      this.settleReaderRecovery('presentation');
      if (this.bookTurn2DFallbackPending) this.completeBookTurn2DFallback(this.pageTurnSettlementGeneration);
    });
  }

  private requestBookTurn2DFallback(generation: number): void {
    if (!this.mounted || this.exitRequested || !this.pageTurnSettlementActive ||
      generation !== this.pageTurnSettlementGeneration) return;
    this.bookTurn2DFallbackPending = true;
    if (this.completeBookTurn2DFallback(generation)) return;
    // Rebuild the existing admitted page using the ordinary 2D stage. An
    // absent native/ArkUI callback must not retain the whole input owner.
    this.activeGateway().handoffPendingProgress();
    this.releasePageTurnRecoveryInput();
  }

  private releasePageTurnRecoveryInput(): void {
    this.bookTurnRuntimeFailed = true;
    this.progressCommitGeneration = (this.progressCommitGeneration ?? 0) + 1;
    this.commitInFlight = false;
    // Invalidates every old completion before releasing the pointer. This
    // keeps the current materialized page; it never promotes the candidate
    // whose persistence outcome is still unknown.
    this.invalidatePageTurnRuntime(true);
    this.resumeDeferredPageTurnWork();
  }

  private completeBookTurn2DFallback(generation: number): boolean {
    if (!this.mounted || this.exitRequested || !this.pageTurnSettlementActive || !this.bookTurn2DFallbackPending ||
      generation !== this.pageTurnSettlementGeneration ||
      generation !== this.bookTurnSurfaceGeneration ||
      this.bookTurnArkUIReadyRevision !== this.pageTurnRenderRevision ||
      this.preparedSettlement.prepared !== undefined) return false;
    this.bookTurn2DFallbackPending = false;
    if (!this.reduceMotion) this.bookTurnRuntimeFailed = true;
    this.bookTurnSurfaceOpacity = 0;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookTurnSession.clearCapturedTextures();
    // No transparent swap. Best-effort cleanup remains generation/epoch gated;
    // UI ownership no longer depends on a lost native completion notification.
    this.bookTurnSession.releaseTerminalFrame(generation);
    this.bookTurnSession.clearSurface(generation);
    this.pageTurnPresentationPhase = 'released';
    if (this.preparedSettlement.commitSucceeded) this.finishSuccessfulPageTurnPresentation(generation);
    else this.finishPageTurnRollback(generation);
    this.pageTurnPresentationPhase = 'idle';
    return true;
  }

  private finishSuccessfulPageTurnPresentation(settlementGeneration: number): void {
    if (settlementGeneration !== this.pageTurnSettlementGeneration) return;
    this.finishPageTurnPerf('committed');
    this.pageTurnAutomaticStart = undefined;
    this.pageTurnSettlementOrigin = 'manual';
    this.pageTurnSettlementTtsOwner = undefined;
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.preparedSettlement.releaseCommit();
    this.pageTurnSettlementActive = false;
    this.preparedSettlement.cancelDeadline();
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnPresentationWidth = 0;
    this.bookTurnMotion = undefined;
    this.pageTurnInputOwned = false;
    this.bookTurnAwaitingSlotCommit = false;
    this.recoverBookTurnSurfaceIfIdle();
    this.flushDeferredPageChromeState();
    this.completeRapidPageTurnTransaction();
    this.resumeDeferredPageTurnWork();
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
    this.drainPageTurnPreparationQueue();
    if (!this.usesBookTurnSimulation()) {
      this.pageTurnPresentationPhase = 'idle';
    }
  }

  private resumeDeferredPageTurnWork(): void {
    if (this.pageTurnSettlementActive || !this.mounted) {
      return;
    }
    const pendingExit = this.pageTurnPendingExit;
    const pendingReplaceReload = this.pageTurnPendingReplaceReload;
    const pendingProjectionChapterIndex = this.pageTurnPendingProjectionChapterIndex;
    const pendingRequestedChapterChange = this.pageTurnPendingRequestedChapterChange;
    const pendingChapterSelection = this.pageTurnPendingChapterSelection;
    const pendingAppearance = this.pageTurnPendingAppearanceSnapshot;
    const pendingViewportWidth = this.pageTurnPendingViewportWidth;
    const pendingViewportHeight = this.pageTurnPendingViewportHeight;
    const pendingWindowReflow = this.pageTurnPendingWindowReflow;
    const pendingWindowSettings = this.pageTurnPendingWindowSettings;
    const pendingControlMinimum = this.controlMinimum.deferred;
    this.clearDeferredPageTurnWork();

    if (pendingExit) {
      this.beginExit();
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    if (pendingRequestedChapterChange) {
      this.onRequestedChapterChanged();
    } else if (pendingChapterSelection !== undefined) {
      this.selectChapterAnchor(
        pendingChapterSelection.chapterIndex,
        pendingChapterSelection.chapterOffset,
        pendingChapterSelection.requireChapterStart,
        pendingChapterSelection.stopTts,
        pendingChapterSelection.requestedProgress,
        pendingChapterSelection.controlOwnerRevision,
        pendingChapterSelection.closeControlOnCommit,
        pendingChapterSelection.refreshContent, pendingChapterSelection.positionContext, pendingChapterSelection.ttsOwner,
      );
    } else if (pendingReplaceReload) {
      this.reloadCurrentPageAfterReplacePersist(lifecycleToken, this.bookId);
    } else if (pendingProjectionChapterIndex >= 0) {
      this.reloadCurrentChapterAfterContentProjectionChange(lifecycleToken, pendingProjectionChapterIndex);
    }
    if (pendingAppearance !== undefined) {
      this.admitAppearanceSnapshot(pendingAppearance);
    }
    if (pendingViewportWidth > 0 && pendingViewportHeight > 0) {
      this.admitReaderViewportSize(pendingViewportWidth, pendingViewportHeight, lifecycleToken);
    }
    if (pendingWindowReflow) {
      this.reflowAfterWindowGeometryChange();
    }
    if (pendingWindowSettings !== undefined) {
      this.commitReaderWindowSettings(pendingWindowSettings);
    }
    if (pendingControlMinimum !== undefined) {
      this.admitControlMinimum(pendingControlMinimum.candidates, pendingControlMinimum.identity);
    }
  }

  private clearDeferredPageTurnWork(): void {
    this.pageTurnPendingExit = false;
    this.pageTurnPendingReplaceReload = false;
    this.pageTurnPendingProjectionChapterIndex = -1;
    this.pageTurnPendingRequestedChapterChange = false;
    this.pageTurnPendingChapterSelection = undefined;
    this.pageTurnPendingAppearanceSnapshot = undefined;
    this.pageTurnPendingViewportWidth = 0;
    this.pageTurnPendingViewportHeight = 0;
    this.pageTurnPendingWindowReflow = false;
    this.pageTurnPendingWindowSettings = undefined;
    this.controlMinimum.clearDeferred();
  }

  private promotePreparedPageTurn(prepared: PreparedReaderPageTurn, stored?: LocalReadingProgress): void {
    const lifecycleToken = this.lifecycleToken;
    const selectionToken = this.chapterSelectionToken;
    this.clearPageTurnProjection();
    const originContext = this.captureMaterializedChapterContext();
    const originPage = this.visiblePage as PhysicalReadingPage;
    const originKey = this.currentPaginationKey();
    const context = prepared.context;
    this.restoreMaterializedChapterContext(context, true);
    this.visiblePage = prepared.page;
    this.visiblePageSelectionToken = this.chapterSelectionToken;
    this.visibleFragments = prepared.page.fragments;
    this.desiredChapterOffset = prepared.page.startScalar;
    this.desiredChapterProgress = context.layoutMap.scalarCount() === 0 ? 0 :
      prepared.page.startScalar / context.layoutMap.scalarCount();
    this.showChapterTitle = this.isChapterFirstPageStart(prepared.page.startScalar);
    this.chapterTitle = context.chapter.chapterTitle;
    this.phase = 'ready';
    this.releaseUnretainedReadingImages();
    this.schedulePageTurnPreparation();
    const reverseDirection: ReaderPageTurnDirection = prepared.direction === 'next' ? 'previous' : 'next';
    const reverse = new PreparedReaderPageTurn(
      reverseDirection,
      originPage,
      originContext,
      originKey,
      context.chapter.chapterIndex,
      prepared.page.startScalar,
      this.pageTurnGeneration,
    );
    if (reverseDirection === 'previous') {
      this.preparedPreviousPage = reverse;
    } else {
      this.preparedNextPage = reverse;
    }
    this.pageTurnPresentationPhase = 'logicalPromoted';
    // The destination page has now become logical current. Keep the physical
    // subtree identity stable by handing ownership to the adjacent slot; the
    // stage continues to render both slots until the presentation barrier
    // completes, so this toggle never causes a role-keyed remount.
    this.pageTurnCurrentSlot = this.pageTurnCurrentSlot === 'a' ? 'b' : 'a';
    this.pageTurnRenderRevision += 1;
    if (stored !== undefined) this.admitCommittedProgress(stored);
    if (!this.notifyControlSelectionReadingReady(context.chapter.chapterIndex, context.chapter.chapterTitle,
      prepared.page, selectionToken, lifecycleToken)) return;
    this.prefetchNextChapter(context.chapter, lifecycleToken, selectionToken);
    this.onAutoPagePageCommitted();
  }

  private requestPageTurn(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    this.invalidateTtsPageFollow?.();
    if (!this.mounted || this.exitRequested) {
      return { kind: 'blocked', reason: 'lifecycle' };
    }
    if (!this.isReaderPageInteractionEnabled()) {
      return { kind: 'blocked', reason: this.controlVisible() ? 'control' : 'overlay' };
    }
    const boundary = this.readerSettingsSnapshot.navigationMode === 'continuous' || !this.canTurnPage() ?
      undefined : this.knownPageTurnBoundary(direction);
    if (boundary !== undefined && this.rapidPageTurnState.inFlightDirection === undefined) {
      this.rapidPageTurnState = reachReaderRapidPageBoundary(this.rapidPageTurnState, direction);
      this.completeDirectPageTurnGesture();
      return boundary;
    }
    this.rapidPageTurnState = enqueueReaderRapidPageTurn(this.rapidPageTurnState, direction);
    if (this.activePagePointerId < 0 && !this.pendingPointerSegmentReserved) {
      // Programmatic/queued taps receive the same directional preparation
      // priority as a held pan, without taking ownership from a live finger.
      const preferred = readerRapidPageTurnDirection(this.rapidPageTurnState) ?? direction;
      this.preferredPageTextureDirection = preferred;
      this.pageTurnPreparationQueue.promoteQueued(preferred);
    }
    return this.drainRapidPageTurn();
  }

  private completeRapidPageTurnTransaction(
    expectedDirection?: ReaderPageTurnDirection,
  ): void {
    const direction = this.rapidPageTurnState.inFlightDirection;
    if (direction === undefined || (expectedDirection !== undefined && expectedDirection !== direction)) return;
    this.rapidPageTurnState = completeReaderRapidPageTurn(this.rapidPageTurnState, direction);
  }

  private retryRapidPageTurnTransaction(): void {
    const direction = this.rapidPageTurnState.inFlightDirection;
    if (direction === undefined) return;
    this.rapidPageTurnState = retryReaderRapidPageTurn(this.rapidPageTurnState, direction);
    if (readerRapidPageTurnRetryExhausted(this.rapidPageTurnState)) {
      console.error('ReadingExperience rapid page turn stopped after repeated single-page failures');
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    }
  }

  private drainRapidPageTurn(): ReaderPageTurnOutcome {
    if (!this.isReaderPageInteractionEnabled()) {
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
      return { kind: 'blocked', reason: !this.mounted || this.exitRequested ? 'lifecycle' :
        (this.controlVisible() ? 'control' : 'overlay') };
    }
    if (this.activePagePointerId >= 0 || this.pendingPointerSegmentReserved) return { kind: 'busy' };
    if (this.rapidPageTurnState.inFlightDirection !== undefined) return { kind: 'busy' };
    if (this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined ||
      this.pageTurnPreparation !== undefined || this.commitInFlight || this.progressProducers.continuousInFlight) {
      return { kind: 'busy' };
    }
    if (this.rapidPageTurnState.controlRequested) {
      // Control must not be held hostage by page-turn readiness (commit
      // backlogs, stale selection tokens); openReaderControl re-checks its
      // own interaction and gesture-ownership gates.
      this.openReaderControl();
      return { kind: 'blocked', reason: 'control' };
    }
    const direction = readerRapidPageTurnDirection(this.rapidPageTurnState);
    if (direction === undefined) return { kind: 'busy' };
    if (!this.canTurnPage() && this.readerSettingsSnapshot.navigationMode !== 'continuous') {
      return { kind: 'busy' };
    }
    // Continuous navigation owns a live List/Scroller and never consumes the
    // adjacent-page snapshots used by paged animations. Keep it out of the
    // preparation gate so its shared rapid target can reach scrollPage().
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous' &&
      readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) &&
      !this.usesNoAnimationPageTurnRuntime() &&
      this.preparedPageTurn(direction) === undefined) {
      this.queuePageTurnPreparation(direction);
      return { kind: 'preparing' };
    }
    const result = this.performPageTurn(direction);
    if (result.kind === 'started') {
      this.pageTurnTransactionSerial += 1;
      this.rapidPageTurnState = beginReaderRapidPageTurn(this.rapidPageTurnState, direction);
    } else if (result.kind === 'boundary') {
      this.rapidPageTurnState = reachReaderRapidPageBoundary(this.rapidPageTurnState, direction);
    } else if (result.kind === 'blocked') {
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    }
    return result;
  }

  private reserveDeferredPointerSegment(): boolean {
    this.autoPageCoordinator.cancelPendingTurn();
    if (this.pendingPointerSegmentReserved) return false;
    this.pendingPointerSegmentReserved = true;
    return true;
  }

  private resolveDeferredPointerSegment(intent: ReaderPageTapIntent | undefined): void {
    if (!this.pendingPointerSegmentReserved) return;
    this.pendingPointerSegmentReserved = false;
    if (intent === 'control') {
      this.rapidPageTurnState = requestReaderRapidPageControl(this.rapidPageTurnState);
      this.drainRapidPageTurn();
      return;
    }
    if (intent !== undefined) {
      this.requestPageTurn(intent);
      return;
    }
    this.drainRapidPageTurn();
  }

  private promoteDeferredPointerSegment(): void {
    this.pendingPointerSegmentReserved = false;
  }

  /** Manual tap, pan release, and Auto Page all converge on this one gate. */
  private performPageTurn(direction: ReaderPageTurnDirection, origin: ReaderPageTurnOrigin = 'manual',
    ttsOwner?: ReaderTtsFollowLease): ReaderPageTurnOutcome {
    if (origin === 'manual' && !this.isReaderPageInteractionEnabled()) return { kind: 'blocked', reason: 'overlay' };
    if (origin !== 'manual' && (!this.mounted || !this.appForeground || this.exitRequested ||
      this.controlVisible() || this.controlObscured || this.interactionBlocked || this.pendingPointerSegmentReserved ||
      this.pageTurnSettlementActive || this.preparedSettlement.prepared !== undefined ||
      this.commitInFlight || this.progressProducers.continuousInFlight || readerRapidPageTurnHasWork(this.rapidPageTurnState))) return { kind: 'busy' };
    if (origin === 'ttsFollow' && (ttsOwner === undefined || !this.isTtsFollowLeaseCurrent(ttsOwner))) return { kind: 'blocked', reason: 'lifecycle' };
    if (this.activePagePointerId >= 0) return { kind: 'busy' };
    this.observeReadingPrefetch?.(origin === 'manual', true);
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      return this.performContinuousPageTurn(direction);
    }
    if (!this.canTurnPage()) {
      this.finishPageTurnPerf('busy');
      this.completeDirectPageTurnGesture();
      return { kind: 'busy' };
    }
    const prepared = readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ?
      this.preparedPageTurn(direction) : undefined;
    if (this.usesBookTurnSimulation() && prepared === undefined) {
      const boundary = this.knownPageTurnBoundary(direction);
      if (boundary !== undefined) {
        // A first/last-page gesture must not arm Native or retain an intent
        // that can never acquire an adjacent texture.
        this.finishPageTurnPerf('boundary');
        this.completeDirectPageTurnGesture();
        return boundary;
      }
    }
    if (this.usesBookTurnSimulation() &&
      (prepared === undefined || !this.canStartReaderPageTurn(direction))) {
      this.queuePageTurnPreparation(direction);
      this.scheduleBookTurnTextureRefresh();
      return { kind: 'preparing' };
    }
    if (prepared !== undefined && this.startPreparedPageTurnSettlement(direction, prepared, origin, ttsOwner)) {
      return { kind: 'started' };
    }
    const result = direction === 'previous' ? this.turnPreviousPage() : this.turnNextPage();
    if (result.kind === 'started') {
      this.beginPageTurnPerf(direction, 'direct');
    } else {
      this.finishPageTurnPerf(result.kind);
    }
    this.completeDirectPageTurnGesture();
    return result;
  }

  private isUnknownCatalogEdge(chapterIndex: number, direction: ReaderPageTurnDirection): boolean {
    if (!this.entryCatalogPending || this.adjacentChapterIndex(chapterIndex, direction === 'next' ? 1 : -1) !== undefined)
      return false;
    const position = this.entryChapterPosition(chapterIndex);
    const count = this.entryCatalogNavigation?.readableChapterCount;
    return position === undefined || count === undefined ||
      (direction === 'next' ? position + 1 < count : position > 0);
  }

  private requestCatalogForTurn(): void {
    if (this.entryCatalogHydration !== undefined) return;
    void this.hydrateEntryCatalog().catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', 'Reading turn catalog: %{private}s', errorMessageOf(error));
    });
  }

  /** Returns only boundaries proven by the admitted pagination facts. */
  private knownPageTurnBoundary(
    direction: ReaderPageTurnDirection,
  ): ReaderPageTurnOutcome | undefined {
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (page === undefined || chapter === undefined || chapter.documentRange !== undefined) return undefined;
    if (this.isUnknownCatalogEdge(chapter.chapterIndex, direction)) return undefined;
    const edge = this.physicalPagination.knownBoundary(direction, this.adjacentPageEvidence(page, chapter),
      (): number | undefined => this.paragraphLayout.ranges[0]?.startScalar);
    return edge === undefined ? undefined : { kind: 'boundary', edge };
  }

  private performContinuousPageTurn(direction: ReaderPageTurnDirection, viewportFraction: number = 1): ReaderPageTurnOutcome {
    if (!this.mounted || this.exitRequested || this.controlVisible() || this.phase !== 'ready' ||
      this.chapter === undefined || this.continuousScroller === undefined ||
      this.continuousProjection.fragments.length === 0 || this.progressProducers.continuousInFlight) {
      return { kind: 'busy' };
    }
    const chapter = this.chapter;
    // A completed pointer can leave the manual-scroll flag set until the
    // List's stop callback. A queued tap/key/Auto Page now owns this scroll;
    // reaching its endpoint must not synthesize another manual chapter turn.
    this.continuousUserInteractionActive = false;
    try {
      if (direction === 'previous' && this.isContinuousScrollerAtStart()) {
        const previousChapter = this.adjacentChapterIndex(chapter.chapterIndex, -1);
        if (previousChapter === undefined) {
          if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
            this.requestCatalogForTurn(); return { kind: 'preparing' };
          }
          return { kind: 'boundary', edge: 'start' };
        }
        return this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, this.continuousVisibleScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (direction === 'next' && this.isContinuousScrollerAtEnd()) {
        const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
        if (nextChapter === undefined) {
          if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'next')) {
            this.requestCatalogForTurn(); return { kind: 'preparing' };
          }
          return { kind: 'boundary', edge: 'end' };
        }
        return this.openPageTurnChapter(nextChapter, 0) ? { kind: 'started' } : { kind: 'busy' };
      }
      this.continuousProgrammaticScrollIntent?.();
      if (viewportFraction < 1) {
        this.continuousScroller.scrollBy(0, this.viewportHeight * viewportFraction * (direction === 'next' ? 1 : -1));
      } else {
        this.continuousScroller.scrollPage({ next: direction === 'next', animation: !this.reduceMotion });
      }
      return { kind: 'started' };
    } catch (_) {
      return { kind: 'busy' };
    }
  }

  private completeDirectPageTurnGesture(): void {
    if (this.pageTurnGestureState.phase !== 'settling') {
      return;
    }
    if (this.pageTurnOffsetX !== 0) {
      this.animatePageTurnRollback();
      return;
    }
    this.pageTurnDirection = undefined;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    this.pageTurnInputOwned = false;
    this.clearPageTurnProjection();
    this.flushDeferredPageChromeState();
    this.drainPageTurnPreparationQueue();
  }

  private turnNextPage(): ReaderPageTurnOutcome {
    if (!this.canTurnPage()) {
      return { kind: 'busy' };
    }
    const page = this.visiblePage as PhysicalReadingPage;
    const chapter = this.chapter as ReadingSessionChapter;
    const draft = this.physicalPagination.draft;
    const nextOffset = draft?.matches(this.currentPaginationKey()) === true ?
      draft.nextRequestForPageStart(page.startScalar) ?? page.endScalar : page.endScalar;
    const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
    if (nextOffset <= lastVisible) {
      this.measureCommittedPageAt(nextOffset);
      return { kind: 'started' };
    }
    const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
    if (nextChapter === undefined) {
      if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'next')) {
        this.requestCatalogForTurn(); return { kind: 'preparing' };
      }
      return { kind: 'boundary', edge: 'end' };
    }
    return this.openPageTurnChapter(nextChapter, 0) ? { kind: 'started' } : { kind: 'busy' };
  }

  private turnPreviousPage(): ReaderPageTurnOutcome {
    if (!this.canTurnPage()) {
      return { kind: 'busy' };
    }
    const page = this.visiblePage as PhysicalReadingPage;
    const chapter = this.chapter as ReadingSessionChapter;
    const key = this.currentPaginationKey();
    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const indexed = this.physicalPagination.index.findContainingPage(key, page.startScalar);
    const containingPage = indexed?.startScalar === page.startScalar && indexed.endScalarExclusive === page.endScalar ? indexed : undefined;
    const measuredPrevious = this.physicalPagination.draft?.matches(key) === true ?
      this.physicalPagination.draft.previousRequestForPageStart(page.startScalar) : undefined;
    if (measuredPrevious !== undefined) {
      this.measureCommittedPageAt(measuredPrevious); return { kind: 'started' };
    }
    if (containingPage === undefined) {
      const prefix = this.physicalPagination.draft;
      const previousRequest = prefix !== undefined && prefix.matches(key) ?
        prefix.previousRequestForPageStart(page.startScalar) : undefined;
      if (previousRequest !== undefined) {
        // The prefix was measured continuously from chapter start under this
        // exact layout/content key. Reuse the original request that produced
        // the preceding physical page; never infer an unseen boundary.
        this.measureCommittedPageAt(previousRequest);
        return { kind: 'started' };
      }
      if (previousChapterIndex !== undefined &&
        this.requireChapterLayoutMap().residentStart() === 0 && this.paragraphLayout.ranges.length > 0 &&
        page.startScalar <= this.paragraphLayout.ranges[0].startScalar) {
        return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (previousChapterIndex === undefined && this.requireChapterLayoutMap().residentStart() === 0 && this.paragraphLayout.ranges.length > 0 &&
        page.startScalar <= this.paragraphLayout.ranges[0].startScalar) {
        if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
          this.requestCatalogForTurn(); return { kind: 'preparing' };
        }
        return { kind: 'boundary', edge: 'start' };
      }
      // A deep restore need not have a canonical chapter-head manifest.
      // Shape the necessary original paragraphs backwards from this exact
      // page boundary, while the committed page remains visible.
      return this.startCurrentChapterPredecessorMeasurement(chapter.chapterIndex, page.startScalar) ?
        { kind: 'started' } : { kind: 'busy' };
    }
    if (containingPage.pageIndex === 0 && previousChapterIndex !== undefined &&
      this.paginationKeyForChapter(previousChapterIndex) === undefined) {
      return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
        { kind: 'started' } : { kind: 'busy' };
    }
    if (containingPage.pageIndex === 0 && previousChapterIndex === undefined) {
      if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
        this.requestCatalogForTurn(); return { kind: 'preparing' };
      }
      return { kind: 'boundary', edge: 'start' };
    }
    const previousChapterKey = containingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
      this.paginationKeyForChapter(previousChapterIndex) as ReadingPaginationKey : null;
    const previous = this.physicalPagination.index.findPreviousPage(key, page.startScalar, previousChapterKey);
    if (previous.kind === 'manifestRequired' && previousChapterIndex !== undefined &&
      previous.key.chapterIndex === previousChapterIndex) {
      return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
        { kind: 'started' } : { kind: 'busy' };
    }
    if (previous.kind !== 'page') {
      return previousChapterIndex === undefined ?
        { kind: 'boundary', edge: 'start' } : { kind: 'busy' };
    }
    if (previous.page.key.chapterIndex === chapter.chapterIndex) {
      this.measureCommittedPageAt(previous.page.startScalar);
      return { kind: 'started' };
    }
    return this.openPageTurnChapter(previous.page.key.chapterIndex, previous.page.startScalar) ?
      { kind: 'started' } : { kind: 'busy' };
  }

  private turnToPreviousChapter(
    previousChapterIndex: number,
    originalChapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      // List owns the end alignment. Only materialize the tail anchor; do not
      // build every physical page of a chapter to return to its scroll end.
      return this.openPageTurnChapter(previousChapterIndex, Number.MAX_SAFE_INTEGER);
    }
    const previousKey = this.paginationKeyForChapter(previousChapterIndex);
    if (previousKey !== undefined) {
      const lastPage = this.physicalPagination.index.findLastPage(previousKey);
      if (lastPage !== undefined) {
        return this.openPageTurnChapter(previousChapterIndex, lastPage.startScalar);
      }
    }
    return this.startPreviousChapterMeasurement(
      previousChapterIndex,
      originalChapterIndex,
      originalChapterOffset,
    );
  }

  private startPreviousChapterMeasurement(
    previousChapterIndex: number,
    originalChapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (!this.mounted || this.previousChapterMeasurement !== undefined ||
      !this.isKnownControlChapter(previousChapterIndex)) {
      return false;
    }
    const lifecycleToken = this.lifecycleToken;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.beginRetainedChapterPresentation(previousChapterIndex, lifecycleToken, selectionToken);
    this.resetForChapterSelection(true);
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      originalChapterIndex,
      originalChapterOffset,
      previousChapterIndex,
    );
    this.markOrdinaryPageMeasurement(previousChapterIndex);
    this.restoredProgress = undefined;
    // The current committed page remains visible, so the per-page measurement
    // deadline is sufficient; do not arm the first-entry blank-screen deadline.
    void this.openChapter(previousChapterIndex, false, lifecycleToken, selectionToken, Number.MAX_SAFE_INTEGER);
    return true;
  }

  private startCurrentChapterPredecessorMeasurement(
    chapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (!this.mounted || this.previousChapterMeasurement !== undefined ||
      this.chapter === undefined || this.chapter.chapterIndex !== chapterIndex ||
      this.paragraphLayout.ranges.length === 0) {
      return false;
    }
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapterIndex,
      originalChapterOffset,
      chapterIndex,
    );
    this.markOrdinaryPageMeasurement(chapterIndex);
    this.desiredChapterOffset = originalChapterOffset;
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
    this.beginMeasurement(this.lifecycleToken);
    return true;
  }

  private canTurnPage(): boolean {
    return this.mounted && !this.exitRequested && !this.readerWindowPolicyPending &&
      !this.controlVisible() && this.phase === 'ready' &&
      !this.measurementCompleting && this.pageTurnPreparation === undefined &&
      this.preparedSettlement.prepared === undefined &&
      !this.commitInFlight && this.visiblePage !== undefined && this.chapter !== undefined &&
      this.visiblePageSelectionToken === this.chapterSelectionToken &&
      this.materializedChapterSelectionToken === this.chapterSelectionToken;
  }

  private measureCommittedPageAt(chapterOffset: number): void {
    const chapterMap = this.requireChapterLayoutMap();
    const chapter = this.requireChapter();
    this.markOrdinaryPageMeasurement(chapter.chapterIndex);
    const lastVisible = this.lastVisibleScalar(chapter.content, chapterMap);
    this.desiredChapterOffset = Math.max(0, Math.min(lastVisible, chapterOffset));
    this.desiredChapterProgress = chapterMap.scalarCount() === 0 ? 0 :
      this.desiredChapterOffset / chapterMap.scalarCount();
    this.beginMeasurement(this.lifecycleToken);
  }

  private openPageTurnChapter(chapterIndex: number, chapterOffset: number): boolean {
    if (!this.mounted || !this.isKnownControlChapter(chapterIndex)) {
      return false;
    }
    const lifecycleToken = this.lifecycleToken;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.beginRetainedChapterPresentation(chapterIndex, lifecycleToken, selectionToken);
    this.resetForChapterSelection(true);
    this.markOrdinaryPageMeasurement(chapterIndex);
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(chapterIndex, false, lifecycleToken, selectionToken, chapterOffset);
    return true;
  }

  private admitEntryResume(snapshot: CoreReadingEntrySnapshot | ReadingEntrySnapshot): boolean {
    if (snapshot.resumeOnly === true) {
      if (this.normalizedRequestedChapter() !== undefined || this.requestedBookmarkAnchor !== undefined ||
        this.sourceSwitchTransactionId !== undefined || !snapshot.isCurrent() ||
        snapshot.chapter.sourceId !== this.sourceId || snapshot.chapter.bookId !== this.bookId ||
        snapshot.progress.kind !== 'restored' || snapshot.progress.progress.chapterIndex !== snapshot.chapter.chapterIndex)
        return false;
      this.resumeOnlyChapterIndex = snapshot.chapter.chapterIndex;
    } else {
      if (snapshot.navigation?.current.navigable === false) return false;
      this.resumeOnlyChapterIndex = undefined;
    }
    return true;
  }

  private configureReadingChapterWindow(entries: LocalReadingTocEntry[] = this.tocEntries): void {
    const order = readingChapterWindowOrder(entries, this.resumeOnlyChapterIndex);
    this.chapterWindow.configure(this.sourceId, this.bookId, order, this.resumeOnlyChapterIndex);
  }

  private setCurrentReadingChapter(chapter: ReadingSessionChapter): void {
    if (this.entryCatalogPending && this.resumeOnlyChapterIndex !== chapter.chapterIndex &&
      !this.chapterWindow.contains(chapter.chapterIndex)) {
      // A resolved Core target may be beyond the reader's narrow TOC window.
      // Its body is current, but only full catalog admission can supply order.
      this.chapterWindow.clear();
      this.scheduleEntryCatalogHydration();
    } else this.chapterWindow.setCurrent(chapter);
    if (this.resumeOnlyChapterIndex !== undefined && chapter.chapterIndex !== this.resumeOnlyChapterIndex) {
      this.resumeOnlyChapterIndex = undefined;
      this.activeGateway().clearEntryResume();
    }
  }

  private matchesDirectoryTargetProof(chapterIndex: number, proof: ReaderDirectoryTargetProof): boolean {
    return proof.sourceId === this.sourceId && proof.bookId === this.bookId && proof.chapterIndex === chapterIndex;
  }

  private readingTocEntries(): LocalReadingTocEntry[] {
    if (this.readingTocSource !== this.tocEntries) {
      this.readingTocSource = this.tocEntries;
      this.readingTocProjection = readableReaderDirectoryEntries(this.tocEntries);
      this.readingTocRanks = readerDirectoryEntryRanks(this.readingTocProjection);
    }
    return this.readingTocProjection;
  }

  private readableChapterPosition(chapterIndex: number): number {
    const admitted = this.entryChapterPosition(chapterIndex);
    if (admitted !== undefined) return admitted;
    if (this.entryCatalogPending) return -1;
    this.readingTocEntries();
    return this.readingTocRanks.get(chapterIndex) ?? -1;
  }

  private adjacentChapterIndex(chapterIndex: number, delta: number): number | undefined {
    return this.chapterWindow.adjacentChapterIndex(chapterIndex, delta);
  }

  private isKnownControlChapter(chapterIndex: number): boolean {
    return this.chapterWindow.contains(chapterIndex);
  }

  private isSelectionCurrent(selectionToken: number): boolean {
    return selectionToken === this.chapterSelectionToken;
  }

  private hasCurrentMaterializedChapter(): boolean {
    return this.chapter !== undefined && this.chapterLayoutMap !== undefined &&
      this.isSelectionCurrent(this.materializedChapterSelectionToken);
  }

  private isSelectionActive(lifecycleToken: number, selectionToken: number): boolean {
    return this.isSessionActive(lifecycleToken) && this.isSelectionCurrent(selectionToken);
  }

  private isMeasurementCurrent(generation: number, selectionToken: number, lifecycleToken: number): boolean {
    return this.isSessionActive(lifecycleToken) && this.physicalPagination.index.isMeasurementCurrent(generation, selectionToken) && this.isSelectionCurrent(selectionToken) &&
      this.materializedChapterSelectionToken === selectionToken && this.phase === 'measuring';
  }

  private isVisiblePageCurrent(
    page: PhysicalReadingPage,
    chapter: ReadingSessionChapter,
    selectionToken: number,
    lifecycleToken: number,
  ): boolean {
    return this.isMountedToken(lifecycleToken) && this.phase === 'ready' &&
      this.visiblePage === page && this.chapter === chapter &&
      this.visiblePageSelectionToken === selectionToken &&
      this.materializedChapterSelectionToken === selectionToken && this.isSelectionCurrent(selectionToken);
  }

  private isStableVisiblePageOwner(
    page: PhysicalReadingPage,
    chapter: ReadingSessionChapter,
    selectionToken: number,
    lifecycleToken: number,
  ): boolean {
    const preparationOrigin = this.pageTurnPreparation?.origin.chapter;
    return this.isMountedToken(lifecycleToken) && !this.exitRequested && this.visiblePage === page &&
      this.visiblePageSelectionToken === selectionToken && this.isSelectionCurrent(selectionToken) &&
      (this.chapter === chapter || preparationOrigin === chapter);
  }

  private isMountedToken(lifecycleToken: number): boolean {
    return this.mounted && lifecycleToken === this.lifecycleToken;
  }

  private isSessionActive(lifecycleToken: number): boolean {
    return this.isMountedToken(lifecycleToken) && !this.exitRequested && this.isReaderIdentityCurrent?.() !== false;
  }

  private recoverPreviousChapterMeasurement(error: Error, lifecycleToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isSessionActive(lifecycleToken)) {
      return;
    }
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience previous chapter measurement failed: ${this.errorMessage(error)}`);
    if (pending.prepareOnly) {
      this.previousChapterMeasurement = undefined;
      this.physicalPagination.index.invalidateMeasurement();
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.nativeTextMeasurement.clear();
      this.paragraphLayout.batch.length = 0;
      this.resetPendingPage();
      this.measurementRun.cancelDeadline();
      this.measurementEpoch += 1;
      this.adjacentMeasurementContext = undefined;
      this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
      this.rapidPageTurnState = reachReaderRapidPageBoundary(this.rapidPageTurnState, 'previous');
      this.pageTurnPreparationQueue.remove('previous');
      this.pageTurnRenderRevision += 1;
      this.releaseUnretainedReadingImages();
      this.scheduleBookTurnTextureRefresh();
      return;
    }
    this.previousChapterMeasurement = undefined;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.beginRetainedChapterPresentation(pending.originalChapterIndex, lifecycleToken, selectionToken);
    this.resetForChapterSelection(true);
    this.restoredProgress = undefined;
    // Re-establish the materialized owner behind the unchanged visible page.
    // Its previously committed Core anchor remains valid throughout recovery.
    void this.openChapter(
      pending.originalChapterIndex,
      false,
      lifecycleToken,
      selectionToken,
      pending.originalChapterOffset,
    );
  }

  private fail(error: Error, lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    if (this.pageTurnPreparation !== undefined) {
      this.recoverPageTurnPreparation(error, lifecycleToken);
      return;
    }
    if (this.previousChapterMeasurement !== undefined) {
      this.recoverPreviousChapterMeasurement(error, lifecycleToken);
      return;
    }
    if (this.chapterSelection.recover(error, lifecycleToken)) return;
    this.clearChapterPresentation();
    const failedPhase = this.phase;
    this.failureCode = this.errorMessage(error);
    const failureKind: RemoteReadingFailureKind = remoteReadingFailureKindOf(error);
    const publicationFailure = error instanceof RemoteReadingGatewayError ?
      error.diagnostic?.chapterPublicationFailure : undefined;
    this.failureHint = readingFailureHint(this.failureCode, failureKind, publicationFailure);
    this.finishPageTurnPerf('failed');
    this.captureReadingRecordElapsed(false);
    this.clearReadingRecordTimer();
    this.autoPageCoordinator.stop('lifecycle');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.measurementRun.cancelDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.pageTurnPreparationQueue.cancelRetry();
    this.phase = 'failed';
    // A timeout/error revokes outstanding acquisition and measurement work;
    // remaining mounted must not allow a late reply to resurrect that attempt.
    this.chapterSelectionToken += 1;
    this.loadingChapterIndex = undefined;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.resetPaginationDraft();
    this.physicalPagination.index.invalidateMeasurement();
    // The stable failure taxonomy lets the host separate book-source failures
    // (user-confirmed switch/retry) from local pagination/layout/storage ones.
    const gatewayFacts = error instanceof RemoteReadingGatewayError ?
      ` code=${error.code} command=${error.command ?? ''} category=${error.category}` : '';
    const publicationFact = publicationFailure === undefined ? '' : ` chapterPublicationFailure=${publicationFailure}`;
    const stableCode = /^[A-Z][A-Z0-9_]{0,95}$/.test(this.failureCode) ? this.failureCode : 'UNCLASSIFIED';
    // Public diagnostics contain only bounded internal codes, never book
    // identity, URLs, body text or the potentially sensitive raw message.
    hilog.error(0x5244, 'Reader', '%{public}s',
      `reader-failure phase=${failedPhase} kind=${failureKind} guard=${stableCode}${gatewayFacts}${publicationFact}`);
    hilog.error(0x5244, 'Reader', '%{private}s',
      `ReadingExperience failed: kind=${failureKind}${gatewayFacts} message=${this.failureCode}`);
    this.onReadingFailure(this.sourceId, this.bookId, this.failureCode, failureKind);
    // Retain the reader, settings and source controls. A body failure does not
    // revoke the user's ability to open an existing book or its saved position.
  }

  private retryReading(): void {
    if (!this.mounted || this.exitRequested || this.phase !== 'failed') return;
    if (this.chapterSelection.retryCurrent()) return;
    this.chapterSelectionToken += 1;
    this.resetForChapterSelection();
    this.failureCode = '';
    this.armFirstPageReadyDeadline(this.lifecycleToken, this.chapterSelectionToken);
    void this.loadInitialReading(this.lifecycleToken);
  }

  private errorMessage(error: Error): string {
    return error.message;
  }
}
