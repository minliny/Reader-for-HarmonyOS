import type { ReaderReadingPageChromeHost } from './ReaderReadingPageChromeHost';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import { ReaderRecoveryOverlay } from './ReaderRecoveryOverlay';
import { ReaderReadingFailureSurface, type ReaderSourceSwitchRecoveryTarget } from './ReaderReadingFailureSurface';
import { SourceSwitchProgress } from '../../source/ui/SourceSwitchProgress';
import { ReaderPageChrome } from './ReaderPageChrome';
import { ReaderStatusBarPaper } from './ReaderStatusBarPaper';
import { ReaderChapterLoadingState } from './ReaderChapterLoadingState';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_READING_PAPER } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { readerVisualSafeTop, readerInteractiveSafeBottom, readerInteractiveSafeLeft,
  type ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import { ReaderSessionCapsule } from './ReaderSessionCapsule';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerRenderStageKind } from './ReaderRenderStageSpec';
import { ReaderControlDirectoryHost, type ReaderNativeControlFrameInput } from './ReaderControlDirectoryHost';
import type { ReaderControlIntentHandler } from './ReaderControlPanelNativeContract';
import { ReaderSourceSwitchOverlay } from './ReadingSourceSwitchOverlayHost';
import { ReaderSmartGestureShortcut } from '../../../platform/interaction/HarmonySmartGestureHost';
import type { ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import { readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderNativeAlertWindow } from '../../../ui/platform/ReaderNativeAlertWindow';
import { readerHardwareKeyboardShortcut } from '../../../platform/interaction/ReaderHardwareKeyboard';
import { HarmonySmartGestureHost } from '../../../platform/interaction/HarmonySmartGestureHost';
import { READER_SMART_GESTURE_VIEWPORT_FRACTION, readerSmartGestureAction, type ReaderSmartGesture,
  type ReaderSmartGestureAction, type ReaderSmartGestureSettings } from '../application/ReaderSmartGesturePolicy';
import type { ReaderTextSelectionActivity } from '../application/ReaderKeyboardShortcuts';
import { readerTextSelectionEnabled } from './ReaderTextSelectionPolicy';
import { readerTtsSessionBlocksAutoPageStart } from './ReaderSessionCapsuleModel';
import { readerControlContentLocation } from './ReaderControlSessionState';
import type { ReaderReadingChapterPresentationHost } from './ReaderReadingChapterPresentationHost';
import type { ReadingSourceSwitchOverlayHost } from './ReadingSourceSwitchOverlayHost';
import type { ReaderControlGeometryHost } from './ReaderControlGeometryHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import type { ReaderReadingProgressHost } from './ReaderReadingProgressHost';
import type { ReaderControlDirectorySession } from './ReaderControlDirectoryHost';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import type { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import { resolveMeasuredReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { sameReaderAppearanceLayout } from './ReaderAppearanceRenderStyle';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readingGestureInset, type ReadingWindowLayoutInput } from '../application/ReadingMeasurementCoordinator';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderReadingPreferencesHost } from './ReaderReadingPreferencesHost';
import { ReaderPageGeometryHost } from './ReaderPageGeometryHost';
import { READER_PHONE_REFERENCE_HEIGHT, READER_PHONE_REFERENCE_WIDTH,
  READER_TABLET_REFERENCE_HEIGHT, READER_TABLET_REFERENCE_WIDTH } from './ReaderLayoutGeometry';
import type { ReaderQuoteCardAction } from '../application/ReaderShareActions';
import type { PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import { readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderBookTurnSurface } from './ReaderBookTurnSurface';
import { READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID } from './ReaderPageTurnNativeHost';
import { ReaderBookmarkPaperWell } from './ReaderBookmarkFeedbackPaint';
import { ReaderFacingChapterColumn } from './ReaderFacingChapter';
import type { ReaderFacingChapter } from './ReaderFacingChapterPreview';
import type { ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import { ReaderPageInteractionLayer } from './ReaderPageInteractionLayer';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderNativeParagraphRecipe } from './ReaderNativeParagraph';
import type { ReaderPageGestureDecision, ReaderPageGestureState, ReaderPageTapIntent, ReaderPageTurnOutcome } from './ReaderPageGestureState';
import { ReaderContinuousReadingStage, type ReaderContinuousRenderFrame } from './ReaderContinuousReadingStage';
import { ReaderContinuousReadingProjection, type ReaderContinuousHighlight } from './ReaderContinuousReadingProjection';
import { materializeReaderContinuousImage, materializeReaderContinuousText, materializeReaderContinuousTitle, ReaderContinuousTextStyleContext } from './ReaderContinuousFragmentMaterializer';
import { ReaderPageChromeSnapshot } from '../presentation/ReaderPageChromeModel';
import { type ReadingSessionImage } from '../application/ReadingChapterWindow';
import { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReaderBookmarkCornerFeedback, type ReaderBookmarkInteractionHost, type ReaderBookmarkRenderProjection } from './ReaderBookmarkInteractionHost';
import { createReaderControlSessionState, type ReaderControlSessionState, type ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { readingFailureHint } from '../presentation/ReadingFailurePresentation';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { type ReadingCapsuleMeasurement } from '../application/ReadingAuxiliaryFlowBridge';
import { type ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { type LocalReadingContentMetrics, type LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { ReadingSurfacePageFragment } from './ReadingSurface';
import { type ReaderPageTurnDirection } from './ReaderPageGestureState';
import { ReaderPageTurnStage, type ReaderPageTurnRenderPage, type ReaderPageTurnSlot } from './ReaderPageTurnStage';
import { ReaderBookmarkRibbonFrame } from '../presentation/ReaderPageBookmarkModel';
import { type ReaderControlNavigationIntent } from './ReaderControlPresentationCoordinator';
import { type ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import { formatReaderPageClock } from '../application/ReaderPageClock';
import { createReaderControlReplaceState, type ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import { createReaderTtsState, READER_TTS_TIMER_DEFAULT_MINUTES, type ReaderTtsState, type ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import { type ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import { createDefaultReaderAppearanceSnapshot, type ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { createDefaultReaderSettingsSnapshot, type ReaderSettingsSnapshot, type ReaderPageTurnStyle } from '../application/ReaderSettingsState';
import type { ReadingPhase, ReadingOptionalRenderValue } from '../application/ReadingExperienceRenderSnapshots';

export interface ReadingChromeRenderUpdate {
  readonly controlSession?: ReaderControlSessionState;
  readonly chapterTitle?: string;
  readonly showChapterTitle?: boolean;
  readonly continuousChromeProgressText?: string;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
  readonly controlBookmarkLoadFailed?: boolean;
  readonly controlOpenRevision?: number;
  readonly controlTemporaryLayerPresented?: ReaderControlTemporaryInputKind;
  readonly dismissControlTemporaryRevision?: number;
  readonly retireControlTemporaryRevision?: number;
  readonly quickSearchQuery?: string;
  readonly quickSearchRevision?: number;
  readonly brightnessPercent?: number;
  readonly brightnessAutomatic?: boolean;
  readonly brightnessRevision?: number;
  readonly controlReplaceState?: ReaderControlReplaceState;
  readonly appearanceSnapshot?: ReaderAppearanceSnapshot;
  readonly chineseConversionMode?: ReaderChineseConversionMode;
  readonly chineseConversionOperationId?: string;
  readonly readerSettingsSnapshot?: ReaderSettingsSnapshot;
  readonly pageChromeClockText?: string;
  readonly sessionCapsuleMeasurement?: ReadingOptionalRenderValue<ReadingCapsuleMeasurement>;
  readonly sessionControlClosing?: boolean;
  readonly windowControlsPresented?: boolean;
  readonly controlMinimumRevision?: number;
  readonly controlMinimumReady?: boolean;
  readonly controlPresentationReceipt?: ReadingOptionalRenderValue<ReaderControlPresentationReceipt>;
  readonly controlNavigationIntent?: ReadingOptionalRenderValue<ReaderControlNavigationIntent>;
  readonly readerWindowPolicyPending?: boolean;
  readonly tocEntries?: LocalReadingTocEntry[];
}

/** Visible chrome geometry and accepted reader preferences. */
@Observed
export class ReadingChromeRenderSnapshot {
  @Track readonly controlSession: ReaderControlSessionState;
  @Track readonly chapterTitle: string;
  @Track readonly showChapterTitle: boolean;
  @Track readonly continuousChromeProgressText: string;
  @Track readonly viewportWidth: number;
  @Track readonly viewportHeight: number;
  @Track readonly controlBookmarkLoadFailed: boolean;
  @Track readonly controlOpenRevision: number;
  @Track readonly controlTemporaryLayerPresented: ReaderControlTemporaryInputKind;
  @Track readonly dismissControlTemporaryRevision: number;
  @Track readonly retireControlTemporaryRevision: number;
  @Track readonly quickSearchQuery: string;
  @Track readonly quickSearchRevision: number;
  @Track readonly brightnessPercent: number;
  @Track readonly brightnessAutomatic: boolean;
  @Track readonly brightnessRevision: number;
  @Track readonly controlReplaceState: ReaderControlReplaceState;
  @Track readonly appearanceSnapshot: ReaderAppearanceSnapshot;
  @Track readonly chineseConversionMode: ReaderChineseConversionMode;
  @Track readonly chineseConversionOperationId: string;
  @Track readonly readerSettingsSnapshot: ReaderSettingsSnapshot;
  @Track readonly pageChromeClockText: string;
  @Track readonly sessionCapsuleMeasurement: ReadingCapsuleMeasurement | undefined;
  @Track readonly sessionControlClosing: boolean;
  @Track readonly windowControlsPresented: boolean;
  @Track readonly controlMinimumRevision: number;
  @Track readonly controlMinimumReady: boolean;
  @Track readonly controlPresentationReceipt: ReaderControlPresentationReceipt | undefined;
  @Track readonly controlNavigationIntent: ReaderControlNavigationIntent | undefined;
  @Track readonly readerWindowPolicyPending: boolean;
  @Track readonly tocEntries: LocalReadingTocEntry[];

  constructor(previous?: ReadingChromeRenderSnapshot, update?: ReadingChromeRenderUpdate) {
    this.controlSession = update?.controlSession ?? previous?.controlSession ?? createReaderControlSessionState();
    this.chapterTitle = update?.chapterTitle ?? previous?.chapterTitle ?? '';
    this.showChapterTitle = update?.showChapterTitle ?? previous?.showChapterTitle ?? false;
    this.continuousChromeProgressText = update?.continuousChromeProgressText ?? previous?.continuousChromeProgressText ?? '';
    this.viewportWidth = update?.viewportWidth ?? previous?.viewportWidth ?? 0;
    this.viewportHeight = update?.viewportHeight ?? previous?.viewportHeight ?? 0;
    this.controlBookmarkLoadFailed = update?.controlBookmarkLoadFailed ?? previous?.controlBookmarkLoadFailed ?? false;
    this.controlOpenRevision = update?.controlOpenRevision ?? previous?.controlOpenRevision ?? 0;
    this.controlTemporaryLayerPresented = update?.controlTemporaryLayerPresented ?? previous?.controlTemporaryLayerPresented ?? '';
    this.dismissControlTemporaryRevision = update?.dismissControlTemporaryRevision ?? previous?.dismissControlTemporaryRevision ?? 0;
    this.retireControlTemporaryRevision = update?.retireControlTemporaryRevision ?? previous?.retireControlTemporaryRevision ?? 0;
    this.quickSearchQuery = update?.quickSearchQuery ?? previous?.quickSearchQuery ?? '';
    this.quickSearchRevision = update?.quickSearchRevision ?? previous?.quickSearchRevision ?? 0;
    this.brightnessPercent = update?.brightnessPercent ?? previous?.brightnessPercent ?? 50;
    this.brightnessAutomatic = update?.brightnessAutomatic ?? previous?.brightnessAutomatic ?? true;
    this.brightnessRevision = update?.brightnessRevision ?? previous?.brightnessRevision ?? 0;
    this.controlReplaceState = update?.controlReplaceState ?? previous?.controlReplaceState ?? createReaderControlReplaceState();
    this.appearanceSnapshot = update?.appearanceSnapshot ?? previous?.appearanceSnapshot ?? createDefaultReaderAppearanceSnapshot();
    this.chineseConversionMode = update?.chineseConversionMode ?? previous?.chineseConversionMode ?? 'none';
    this.chineseConversionOperationId = update?.chineseConversionOperationId ?? previous?.chineseConversionOperationId ?? '';
    this.readerSettingsSnapshot = update?.readerSettingsSnapshot ?? previous?.readerSettingsSnapshot ?? createDefaultReaderSettingsSnapshot();
    this.pageChromeClockText = update?.pageChromeClockText ?? previous?.pageChromeClockText ?? formatReaderPageClock(Date.now());
    this.sessionCapsuleMeasurement = update?.sessionCapsuleMeasurement === undefined ? previous?.sessionCapsuleMeasurement : update.sessionCapsuleMeasurement.value;
    this.sessionControlClosing = update?.sessionControlClosing ?? previous?.sessionControlClosing ?? false;
    this.windowControlsPresented = update?.windowControlsPresented ?? previous?.windowControlsPresented ?? false;
    this.controlMinimumRevision = update?.controlMinimumRevision ?? previous?.controlMinimumRevision ?? 0;
    this.controlMinimumReady = update?.controlMinimumReady ?? previous?.controlMinimumReady ?? false;
    this.controlPresentationReceipt = update?.controlPresentationReceipt === undefined ? previous?.controlPresentationReceipt : update.controlPresentationReceipt.value;
    this.controlNavigationIntent = update?.controlNavigationIntent === undefined ? previous?.controlNavigationIntent : update.controlNavigationIntent.value;
    this.readerWindowPolicyPending = update?.readerWindowPolicyPending ?? previous?.readerWindowPolicyPending ?? false;
    this.tocEntries = update?.tocEntries ?? previous?.tocEntries ?? [];
  }
}

export interface ReadingPageTurnRenderUpdate {
  readonly visibleFragments?: ReadingSurfacePageFragment[];
  readonly continuousRenderRevision?: number;
  readonly pageTurnOffsetX?: number;
  readonly pageTurnPresentationWidth?: number;
  readonly pageTurnDirection?: ReadingOptionalRenderValue<ReaderPageTurnDirection>;
  readonly pageTurnCurrentSlot?: ReaderPageTurnSlot;
  readonly pageTurnSettlementActive?: boolean;
  readonly bookmarkPageOffsetY?: number;
  readonly bookmarkRibbonFrame?: ReadingOptionalRenderValue<ReaderBookmarkRibbonFrame>;
  readonly bookmarkPullHintOpacity?: number;
  readonly bookmarkPendingTarget?: string;
  readonly bookmarkPreviewChanged?: boolean;
  readonly bookmarkPresentationRevision?: number;
  readonly bookTurnSurfaceOpacity?: number;
  readonly pageTurnInputOwned?: boolean;
  readonly pageTurnInputRevision?: number;
  readonly pageTurnReadinessRevision?: number;
  readonly pageTurnRenderRevision?: number;
  readonly measurementEpoch?: number;
  readonly bookTurnRuntimeFailed?: boolean;
  readonly pageTurnSessionCapsuleFrozen?: boolean;
  readonly chapterPresentationRevision?: number;
}

/** Mounted page, document revisions and the in-flight turn surface. */
@Observed
export class ReadingPageTurnRenderSnapshot implements ReaderBookmarkRenderProjection {
  @Track readonly visibleFragments: ReadingSurfacePageFragment[];
  @Track readonly continuousRenderRevision: number;
  @Track readonly pageTurnOffsetX: number;
  @Track readonly pageTurnPresentationWidth: number;
  @Track readonly pageTurnDirection: ReaderPageTurnDirection | undefined;
  @Track readonly pageTurnCurrentSlot: ReaderPageTurnSlot;
  @Track readonly pageTurnSettlementActive: boolean;
  @Track readonly bookmarkPageOffsetY: number;
  @Track readonly bookmarkRibbonFrame: ReaderBookmarkRibbonFrame | undefined;
  @Track readonly bookmarkPullHintOpacity: number;
  @Track readonly bookmarkPendingTarget: string;
  @Track readonly bookmarkPreviewChanged: boolean;
  @Track readonly bookmarkPresentationRevision: number;
  @Track readonly bookTurnSurfaceOpacity: number;
  @Track readonly pageTurnInputOwned: boolean;
  @Track readonly pageTurnInputRevision: number;
  @Track readonly pageTurnReadinessRevision: number;
  @Track readonly pageTurnRenderRevision: number;
  @Track readonly measurementEpoch: number;
  @Track readonly bookTurnRuntimeFailed: boolean;
  @Track readonly pageTurnSessionCapsuleFrozen: boolean;
  @Track readonly chapterPresentationRevision: number;

  constructor(previous?: ReadingPageTurnRenderSnapshot, update?: ReadingPageTurnRenderUpdate) {
    this.visibleFragments = update?.visibleFragments ?? previous?.visibleFragments ?? [];
    this.continuousRenderRevision = update?.continuousRenderRevision ?? previous?.continuousRenderRevision ?? 0;
    this.pageTurnOffsetX = update?.pageTurnOffsetX ?? previous?.pageTurnOffsetX ?? 0;
    this.pageTurnPresentationWidth = update?.pageTurnPresentationWidth ?? previous?.pageTurnPresentationWidth ?? 0;
    this.pageTurnDirection = update?.pageTurnDirection === undefined ? previous?.pageTurnDirection : update.pageTurnDirection.value;
    this.pageTurnCurrentSlot = update?.pageTurnCurrentSlot ?? previous?.pageTurnCurrentSlot ?? 'a';
    this.pageTurnSettlementActive = update?.pageTurnSettlementActive ?? previous?.pageTurnSettlementActive ?? false;
    this.bookmarkPageOffsetY = update?.bookmarkPageOffsetY ?? previous?.bookmarkPageOffsetY ?? 0;
    this.bookmarkRibbonFrame = update?.bookmarkRibbonFrame === undefined ? previous?.bookmarkRibbonFrame : update.bookmarkRibbonFrame.value;
    this.bookmarkPullHintOpacity = update?.bookmarkPullHintOpacity ?? previous?.bookmarkPullHintOpacity ?? 0;
    this.bookmarkPendingTarget = update?.bookmarkPendingTarget ?? previous?.bookmarkPendingTarget ?? '';
    this.bookmarkPreviewChanged = update?.bookmarkPreviewChanged ?? previous?.bookmarkPreviewChanged ?? false;
    this.bookmarkPresentationRevision = update?.bookmarkPresentationRevision ?? previous?.bookmarkPresentationRevision ?? 0;
    this.bookTurnSurfaceOpacity = update?.bookTurnSurfaceOpacity ?? previous?.bookTurnSurfaceOpacity ?? 1;
    this.pageTurnInputOwned = update?.pageTurnInputOwned ?? previous?.pageTurnInputOwned ?? false;
    this.pageTurnInputRevision = update?.pageTurnInputRevision ?? previous?.pageTurnInputRevision ?? 0;
    this.pageTurnReadinessRevision = update?.pageTurnReadinessRevision ?? previous?.pageTurnReadinessRevision ?? 0;
    this.pageTurnRenderRevision = update?.pageTurnRenderRevision ?? previous?.pageTurnRenderRevision ?? 0;
    this.measurementEpoch = update?.measurementEpoch ?? previous?.measurementEpoch ?? 0;
    this.bookTurnRuntimeFailed = update?.bookTurnRuntimeFailed ?? previous?.bookTurnRuntimeFailed ?? false;
    this.pageTurnSessionCapsuleFrozen = update?.pageTurnSessionCapsuleFrozen ?? previous?.pageTurnSessionCapsuleFrozen ?? false;
    this.chapterPresentationRevision = update?.chapterPresentationRevision ?? previous?.chapterPresentationRevision ?? 0;
  }
}

export interface ReadingOverlayRenderUpdate {
  readonly sourceSwitchRevealOpacity?: number;
  readonly sourceSwitchVisualSelectionToken?: number;
  readonly bookmarkUnavailableMessage?: string;
  readonly failureCode?: string;
  readonly failureHint?: string;
  readonly readerRecoveryRequested?: boolean;
  readonly readerRecoveryView?: ReaderRecoveryView;
  readonly readerRecoveryActionLabel?: string;
  readonly readerSettingsRecovery?: ReaderRecoveryView;
  readonly ttsPreferencesRecovery?: ReaderRecoveryView;
  readonly readerSettingsRecoveryBusy?: boolean;
  readonly appearanceSaveRecovery?: ReaderRecoveryView;
  readonly appearanceSaveRecoveryBusy?: boolean;
  readonly ttsPreferencesRecoveryBusy?: boolean;
  readonly ttsConfigurationLoading?: boolean;
  readonly ttsConfigurationLoadFailed?: boolean;
  readonly ttsConfigurationRecovery?: ReaderRecoveryView;
  readonly replaceRecovery?: ReaderRecoveryView;
  readonly sessionLaunch?: ReadingOptionalRenderValue<ReaderSessionLaunchTransaction>;
  readonly sessionLaunchStageOpacity?: number;
  readonly sessionLaunchFooterExiting?: boolean;
  readonly sessionLaunchFooterOffset?: number;
  readonly sessionLaunchFooterExitProgress?: number;
  readonly sessionLaunchFooterOpacity?: number;
}

/** Recovery, source-switch and session-launch effects above the paper. */
@Observed
export class ReadingOverlayRenderSnapshot {
  @Track readonly sourceSwitchRevealOpacity: number;
  @Track readonly sourceSwitchVisualSelectionToken: number;
  @Track readonly bookmarkUnavailableMessage: string;
  @Track readonly failureCode: string;
  @Track readonly failureHint: string;
  @Track readonly readerRecoveryRequested: boolean;
  @Track readonly readerRecoveryView: ReaderRecoveryView;
  @Track readonly readerRecoveryActionLabel: string;
  @Track readonly readerSettingsRecovery: ReaderRecoveryView;
  @Track readonly ttsPreferencesRecovery: ReaderRecoveryView;
  @Track readonly readerSettingsRecoveryBusy: boolean;
  @Track readonly appearanceSaveRecovery: ReaderRecoveryView;
  @Track readonly appearanceSaveRecoveryBusy: boolean;
  @Track readonly ttsPreferencesRecoveryBusy: boolean;
  @Track readonly ttsConfigurationLoading: boolean;
  @Track readonly ttsConfigurationLoadFailed: boolean;
  @Track readonly ttsConfigurationRecovery: ReaderRecoveryView;
  @Track readonly replaceRecovery: ReaderRecoveryView;
  @Track readonly sessionLaunch: ReaderSessionLaunchTransaction | undefined;
  @Track readonly sessionLaunchStageOpacity: number;
  @Track readonly sessionLaunchFooterExiting: boolean;
  @Track readonly sessionLaunchFooterOffset: number;
  @Track readonly sessionLaunchFooterExitProgress: number;
  @Track readonly sessionLaunchFooterOpacity: number;

  constructor(previous?: ReadingOverlayRenderSnapshot, update?: ReadingOverlayRenderUpdate) {
    this.sourceSwitchRevealOpacity = update?.sourceSwitchRevealOpacity ?? previous?.sourceSwitchRevealOpacity ?? 0;
    this.sourceSwitchVisualSelectionToken = update?.sourceSwitchVisualSelectionToken ?? previous?.sourceSwitchVisualSelectionToken ?? -1;
    this.bookmarkUnavailableMessage = update?.bookmarkUnavailableMessage ?? previous?.bookmarkUnavailableMessage ?? '';
    this.failureCode = update?.failureCode ?? previous?.failureCode ?? '';
    this.failureHint = update?.failureHint ?? previous?.failureHint ?? readingFailureHint('');
    this.readerRecoveryRequested = update?.readerRecoveryRequested ?? previous?.readerRecoveryRequested ?? false;
    this.readerRecoveryView = update?.readerRecoveryView ?? previous?.readerRecoveryView ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.readerRecoveryActionLabel = update?.readerRecoveryActionLabel ?? previous?.readerRecoveryActionLabel ?? '重试';
    this.readerSettingsRecovery = update?.readerSettingsRecovery ?? previous?.readerSettingsRecovery ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.ttsPreferencesRecovery = update?.ttsPreferencesRecovery ?? previous?.ttsPreferencesRecovery ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.readerSettingsRecoveryBusy = update?.readerSettingsRecoveryBusy ?? previous?.readerSettingsRecoveryBusy ?? false;
    this.appearanceSaveRecovery = update?.appearanceSaveRecovery ?? previous?.appearanceSaveRecovery ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.appearanceSaveRecoveryBusy = update?.appearanceSaveRecoveryBusy ?? previous?.appearanceSaveRecoveryBusy ?? false;
    this.ttsPreferencesRecoveryBusy = update?.ttsPreferencesRecoveryBusy ?? previous?.ttsPreferencesRecoveryBusy ?? false;
    this.ttsConfigurationLoading = update?.ttsConfigurationLoading ?? previous?.ttsConfigurationLoading ?? false;
    this.ttsConfigurationLoadFailed = update?.ttsConfigurationLoadFailed ?? previous?.ttsConfigurationLoadFailed ?? false;
    this.ttsConfigurationRecovery = update?.ttsConfigurationRecovery ?? previous?.ttsConfigurationRecovery ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.replaceRecovery = update?.replaceRecovery ?? previous?.replaceRecovery ?? { message: '', visible: false, canRetry: false, generation: 0 };
    this.sessionLaunch = update?.sessionLaunch === undefined ? previous?.sessionLaunch : update.sessionLaunch.value;
    this.sessionLaunchStageOpacity = update?.sessionLaunchStageOpacity ?? previous?.sessionLaunchStageOpacity ?? 1;
    this.sessionLaunchFooterExiting = update?.sessionLaunchFooterExiting ?? previous?.sessionLaunchFooterExiting ?? false;
    this.sessionLaunchFooterOffset = update?.sessionLaunchFooterOffset ?? previous?.sessionLaunchFooterOffset ?? 0;
    this.sessionLaunchFooterExitProgress = update?.sessionLaunchFooterExitProgress ?? previous?.sessionLaunchFooterExitProgress ?? 0;
    this.sessionLaunchFooterOpacity = update?.sessionLaunchFooterOpacity ?? previous?.sessionLaunchFooterOpacity ?? 1;
  }
}

export interface ReadingSessionRenderUpdate {
  readonly phase?: ReadingPhase;
  readonly autoPageRevision?: number;
  readonly ttsState?: ReaderTtsState;
  readonly ttsTimerMode?: ReaderTtsTimerMode;
  readonly ttsTimerMinutes?: number;
  readonly ttsTimerSeconds?: number;
  readonly ttsFollowHighlight?: boolean;
  readonly ttsPauseOnInterruption?: boolean;
  readonly ttsAllowMixing?: boolean;
  readonly ttsBackgroundPlayback?: boolean;
  readonly ttsKeepScreenOn?: boolean;
  readonly ttsFailurePolicy?: 'skip' | 'stop';
  readonly ttsEngine?: string;
  readonly ttsHttpEngines?: ReaderHttpTtsConfig[];
  readonly ttsVoiceOptions?: ReaderTtsVoiceOption[];
  readonly ttsLanguage?: string;
  readonly ttsPerson?: number;
  readonly entryCatalogLoading?: boolean;
  readonly entryCatalogLoadFailed?: boolean;
  readonly contentMetrics?: ReadingOptionalRenderValue<LocalReadingContentMetrics>;
  readonly loadingChapterIndex?: ReadingOptionalRenderValue<number>;
  readonly mounted?: boolean;
  readonly exitRequested?: boolean;
}

/** Mounted route, body readiness and playback facts. */
@Observed
export class ReadingSessionRenderSnapshot {
  @Track readonly phase: ReadingPhase;
  @Track readonly autoPageRevision: number;
  @Track readonly ttsState: ReaderTtsState;
  @Track readonly ttsTimerMode: ReaderTtsTimerMode;
  @Track readonly ttsTimerMinutes: number;
  @Track readonly ttsTimerSeconds: number;
  @Track readonly ttsFollowHighlight: boolean;
  @Track readonly ttsPauseOnInterruption: boolean;
  @Track readonly ttsAllowMixing: boolean;
  @Track readonly ttsBackgroundPlayback: boolean;
  @Track readonly ttsKeepScreenOn: boolean;
  @Track readonly ttsFailurePolicy: 'skip' | 'stop';
  @Track readonly ttsEngine: string;
  @Track readonly ttsHttpEngines: ReaderHttpTtsConfig[];
  @Track readonly ttsVoiceOptions: ReaderTtsVoiceOption[];
  @Track readonly ttsLanguage: string;
  @Track readonly ttsPerson: number;
  @Track readonly entryCatalogLoading: boolean;
  @Track readonly entryCatalogLoadFailed: boolean;
  @Track readonly contentMetrics: LocalReadingContentMetrics | undefined;
  @Track readonly loadingChapterIndex: number | undefined;
  @Track readonly mounted: boolean;
  @Track readonly exitRequested: boolean;

  constructor(previous?: ReadingSessionRenderSnapshot, update?: ReadingSessionRenderUpdate) {
    this.phase = update?.phase ?? previous?.phase ?? 'loading';
    this.autoPageRevision = update?.autoPageRevision ?? previous?.autoPageRevision ?? 0;
    this.ttsState = update?.ttsState ?? previous?.ttsState ?? createReaderTtsState(false);
    this.ttsTimerMode = update?.ttsTimerMode ?? previous?.ttsTimerMode ?? 'duration';
    this.ttsTimerMinutes = update?.ttsTimerMinutes ?? previous?.ttsTimerMinutes ?? READER_TTS_TIMER_DEFAULT_MINUTES;
    this.ttsTimerSeconds = update?.ttsTimerSeconds ?? previous?.ttsTimerSeconds ?? 0;
    this.ttsFollowHighlight = update?.ttsFollowHighlight ?? previous?.ttsFollowHighlight ?? true;
    this.ttsPauseOnInterruption = update?.ttsPauseOnInterruption ?? previous?.ttsPauseOnInterruption ?? true;
    this.ttsAllowMixing = update?.ttsAllowMixing ?? previous?.ttsAllowMixing ?? false;
    this.ttsBackgroundPlayback = update?.ttsBackgroundPlayback ?? previous?.ttsBackgroundPlayback ?? true;
    this.ttsKeepScreenOn = update?.ttsKeepScreenOn ?? previous?.ttsKeepScreenOn ?? false;
    this.ttsFailurePolicy = update?.ttsFailurePolicy ?? previous?.ttsFailurePolicy ?? 'stop';
    this.ttsEngine = update?.ttsEngine ?? previous?.ttsEngine ?? 'system';
    this.ttsHttpEngines = update?.ttsHttpEngines ?? previous?.ttsHttpEngines ?? [];
    this.ttsVoiceOptions = update?.ttsVoiceOptions ?? previous?.ttsVoiceOptions ?? [];
    this.ttsLanguage = update?.ttsLanguage ?? previous?.ttsLanguage ?? 'zh-CN';
    this.ttsPerson = update?.ttsPerson ?? previous?.ttsPerson ?? 0;
    this.entryCatalogLoading = update?.entryCatalogLoading ?? previous?.entryCatalogLoading ?? false;
    this.entryCatalogLoadFailed = update?.entryCatalogLoadFailed ?? previous?.entryCatalogLoadFailed ?? false;
    this.contentMetrics = update?.contentMetrics === undefined ? previous?.contentMetrics : update.contentMetrics.value;
    this.loadingChapterIndex = update?.loadingChapterIndex === undefined ? previous?.loadingChapterIndex : update.loadingChapterIndex.value;
    this.mounted = update?.mounted ?? previous?.mounted ?? false;
    this.exitRequested = update?.exitRequested ?? previous?.exitRequested ?? false;
  }
}

export interface ReaderContinuousSurfaceView {
  readonly retainedChrome: () => ReaderPageChromeSnapshot | undefined;
  readonly currentChapterIndex: () => number;
  readonly liveChrome: (chapter: number, offset: number, count: number) => ReaderPageChromeSnapshot;
  readonly continuous: () => boolean;
  readonly revision: () => number;
  readonly progressText: () => string;
  readonly hasPartialEntryWindow: () => boolean;
  readonly inFlightDirection: () => ReaderPageTurnDirection | undefined;
  readonly lifecycle: () => number;
  readonly selection: () => number;
  readonly turnSerial: () => number;
  readonly mountedToken: (lifecycle: number) => boolean;
  readonly exiting: () => boolean;
  readonly adjacentChapterIndex: (chapterIndex: number, delta: number) => number | undefined;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly measurementTextWidth: () => number;
  readonly context: () => UIContext;
  readonly imageAt: (startScalar: number) => ReadingSessionImage | undefined;
  readonly visibleFragments: () => ReadingSurfacePageFragment[];
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly layoutSignature: () => string;
  readonly scaledImageHeight: (image: ReadingSessionImage, capacity: number) => number;
  readonly ttsState: () => ReaderTtsState;
  readonly ttsFollowHighlight: () => boolean;
  readonly mounted: () => boolean;
  readonly controlVisible: () => boolean;
  readonly ready: () => boolean;
  readonly progressInFlight: () => boolean;
  readonly isUnknownCatalogEdge: (chapterIndex: number, direction: ReaderPageTurnDirection) => boolean;
  readonly viewportHeight: () => number;
  readonly reducedMotion: () => boolean;
}

export interface ReaderContinuousSurfaceEffects {
  readonly retireRecovery: () => void;
  readonly manualInteraction: () => void;
  readonly publishProgressText: (text: string) => void;
  readonly resolveContinuousImage: (startScalar: number) => void;
  readonly scheduleEntryWindowHydration: () => void;
  readonly commitProgress: (lifecycle: number) => Promise<void>;
  readonly completeRapid: (direction: ReaderPageTurnDirection) => void;
  readonly turnToPreviousChapter: (target: number, from: number, offset: number) => boolean;
  readonly openPageTurnChapter: (chapterIndex: number, offset: number) => boolean;
  readonly bumpRevision: () => void;
  readonly requestCatalogForTurn: () => void;
}

/** Owns the live continuous List frame and its scalar cursor. Every rebuild
 * publishes a whole frame under one revision; scroll/progress never recreates
 * the resident fragment list merely because the first visible scalar changed. */
export class ReaderReadingSurfaceHost {
  private readonly measuredPage: ReaderMeasuredPagePublication;
  private readonly view: ReaderContinuousSurfaceView;
  private readonly effects: ReaderContinuousSurfaceEffects;

  constructor(measured: ReaderMeasuredPagePublication, view: ReaderContinuousSurfaceView, effects: ReaderContinuousSurfaceEffects) {
    this.measuredPage = measured;
    this.view = view;
    this.effects = effects;
  }

  readonly continuousProjection: ReaderContinuousReadingProjection<ReadingSurfacePageFragment> =
    new ReaderContinuousReadingProjection<ReadingSurfacePageFragment>();
  continuousEntryPositionReady: boolean = false;
  continuousTitleRecipe: ReaderNativeParagraphRecipe | undefined;
  continuousChangedFragmentIndex: number = -1;
  continuousInitialFragmentIndex: number = 0;
  continuousInitialFragmentProgress: number = 0;
  continuousInitialAnchorRevision: number = 0;
  continuousProgrammaticScrollIntent: (() => void) | undefined = undefined;
  continuousScroller: Scroller | undefined = undefined;
  continuousVisibleScalar: number = 0;
  continuousProgressRevision: number = 0;
  continuousAnchorSampler: (() => void) | undefined = undefined;
  continuousUserInteractionActive: boolean = false;

  continuousPageChromeSnapshot(_contentRevision: number,
    _progressText: string): ReaderPageChromeSnapshot {
    const retained = this.view.retainedChrome();
    if (retained !== undefined) return retained;
    return this.view.liveChrome(this.view.currentChapterIndex(), this.continuousVisibleScalar, this.measuredPage.chapterLayoutMap?.scalarCount() ?? 0);
  }

  onContinuousManualInteraction(): void {
    this.effects.retireRecovery();
    this.continuousUserInteractionActive = true;
    this.effects.manualInteraction();
  }

  onContinuousVisibleRangeChanged(start: number, end: number, startProgress: number): void {
    if (!this.view.continuous()) return;
    const visible = this.continuousProjection.admitVisibleRange(start, end, startProgress);
    if (visible === undefined) return;
    this.continuousVisibleScalar = visible.scalar;
    this.measuredPage.desiredChapterOffset = this.continuousVisibleScalar;
    const scalarCount = this.measuredPage.chapterLayoutMap?.scalarCount() ?? 0;
    this.measuredPage.desiredChapterProgress = scalarCount === 0 ? 0 : this.continuousVisibleScalar / scalarCount;
    this.continuousProgressRevision += 1;
    const chromeProgress = this.continuousPageChromeSnapshot(this.view.revision(), '').bottomEndText;
    if (chromeProgress !== this.view.progressText()) this.effects.publishProgressText(chromeProgress);
    this.continuousProjection.resolveVisibleImages(visible.startIndex, visible.endIndex,
      (startScalar: number): void => this.effects.resolveContinuousImage(startScalar));
    this.continuousEntryPositionReady = true;
    if (this.view.hasPartialEntryWindow()) this.effects.scheduleEntryWindowHydration();
  }

  onContinuousScrollStopped(): void {
    this.continuousUserInteractionActive = false;
    const direction = this.view.inFlightDirection();
    const lifecycle = this.view.lifecycle();
    const selection = this.view.selection();
    const serial = this.view.turnSerial();
    void this.effects.commitProgress(lifecycle)
      .then((): void => {
        if (!this.view.mountedToken(lifecycle) || selection !== this.view.selection() ||
          serial !== this.view.turnSerial() || this.view.exiting()) return;
        if (direction !== undefined) {
          this.effects.completeRapid(direction);
        }
      }).catch((): void => {
        // The progress owner retains the failure and logs it through
        // continuousProgressDependencies.failed. Automatic retries stay silent.
      });
  }

  onContinuousReachStart(): void {
    if (this.view.hasPartialEntryWindow()) { this.effects.scheduleEntryWindowHydration(); return; }
    if (!this.continuousUserInteractionActive || this.continuousProjection.visibleStart > 0 ||
      !this.isContinuousScrollerAtStart()) {
      return;
    }
    const chapter = this.measuredPage.chapter;
    if (chapter === undefined) {
      return;
    }
    const previousChapter = this.view.adjacentChapterIndex(chapter.chapterIndex, -1);
    if (previousChapter !== undefined) {
      this.continuousUserInteractionActive = false;
      this.effects.turnToPreviousChapter(previousChapter, chapter.chapterIndex, this.continuousVisibleScalar);
    }
  }

  onContinuousReachEnd(): void {
    if (this.view.hasPartialEntryWindow()) { this.effects.scheduleEntryWindowHydration(); return; }
    if (!this.continuousUserInteractionActive || !this.isContinuousScrollerAtEnd()) {
      return;
    }
    const chapter = this.measuredPage.chapter;
    if (chapter === undefined) {
      return;
    }
    const nextChapter = this.view.adjacentChapterIndex(chapter.chapterIndex, 1);
    if (nextChapter !== undefined) {
      this.continuousUserInteractionActive = false;
      this.effects.openPageTurnChapter(nextChapter, 0);
    }
  }

  onContinuousBoundaryDrag(direction: 'previous' | 'next'): void {
    if (this.view.hasPartialEntryWindow()) { this.effects.scheduleEntryWindowHydration(); return; }
    if (!this.view.continuous() ||
      !this.continuousUserInteractionActive) {
      return;
    }
    if ((direction === 'next' && !this.isContinuousScrollerAtEnd()) ||
      (direction === 'previous' && !this.isContinuousScrollerAtStart())) {
      return;
    }
    const chapter = this.measuredPage.chapter;
    if (chapter === undefined) {
      return;
    }
    const adjacent = this.view.adjacentChapterIndex(chapter.chapterIndex, direction === 'next' ? 1 : -1);
    if (adjacent === undefined) {
      return;
    }
    this.continuousUserInteractionActive = false;
    if (direction === 'next') {
      this.effects.openPageTurnChapter(adjacent, 0);
    } else {
      this.effects.turnToPreviousChapter(adjacent, chapter.chapterIndex, this.continuousVisibleScalar);
    }
  }

  isContinuousScrollerAtStart(): boolean {
    const offset = this.continuousScroller?.currentOffset();
    return offset === undefined || offset.yOffset <= 0.5;
  }

  isContinuousScrollerAtEnd(): boolean {
    try {
      return this.continuousScroller?.isAtEnd() ?? false;
    } catch (_) {
      return false;
    }
  }

  hasContinuousRenderContent(): boolean {
    // Both the mode branch and input overlay must observe the projection's
    // revision even before a continuous child exists. Reading only the plain
    // array length leaves cold restores permanently on the paged fallback.
    return this.view.revision() >= 0 && this.continuousProjection.fragments.length > 0;
  }

  continuousRenderFrame(): ReaderContinuousRenderFrame {
    return { chapterIdentity: this.continuousProjection.chapterIdentity,
      chapterIndex: this.continuousProjection.chapterIndex,
      chapterTitle: this.continuousProjection.chapterTitle, geometryKey: this.continuousProjection.geometryKey,
      titleRecipe: this.continuousTitleRecipe, fragments: this.continuousProjection.fragments,
      changedFragmentIndex: this.continuousChangedFragmentIndex, initialFragmentIndex: this.continuousInitialFragmentIndex,
      initialFragmentProgress: this.continuousInitialFragmentProgress, initialAnchorRevision: this.continuousInitialAnchorRevision };
  }

  rebuildContinuousFragments(preserveExisting: boolean = false, initialScalar?: number): void {
    const chapter = this.measuredPage.chapter;
    const chapterMap = this.measuredPage.chapterLayoutMap;
    if (chapter === undefined || chapterMap === undefined || this.measuredPage.nativeMeasurement.chapterRanges.length === 0) {
      this.clearContinuousRenderProjection();
      return;
    }
    const appearance = this.view.appearance();
    const context = new ReaderContinuousTextStyleContext(
      (): number => this.view.measurementTextWidth(), (): UIContext => this.view.context(), this.measuredPage.nativeMeasurement.punctuationOverflow);
    const fragments = this.continuousProjection.project(chapter, this.measuredPage.nativeMeasurement.chapterRanges, preserveExisting,
      (startScalar: number): ReadingSessionImage | undefined => this.view.imageAt(startScalar),
      (id: string, image: ReadingSessionImage): ReadingSurfacePageFragment =>
        this.materializeContinuousImage(id, image, appearance),
      (id: string, text: string, startScalar: number, endScalar: number): ReadingSurfacePageFragment =>
        materializeReaderContinuousText(id, text, startScalar, endScalar, appearance, context,
          (): ReaderNativeParagraphRecipe | undefined => this.measuredPage.selection === this.view.selection() ?
            this.view.visibleFragments().find((visible: ReadingSurfacePageFragment): boolean =>
              visible.nativeParagraph?.startScalar === startScalar && visible.nativeParagraph.text === text)?.nativeParagraph : undefined));
    this.continuousTitleRecipe = materializeReaderContinuousTitle(chapter.chapterTitle, this.measuredPage.nativeMeasurement.title(),
      appearance, context, (): number => this.view.layout().titleLineHeightFp);
    this.continuousProjection.commit(chapter, fragments, initialScalar ?? this.continuousVisibleScalar,
      (): string => this.view.layoutSignature());
    if (initialScalar !== undefined) {
      this.continuousEntryPositionReady = false;
      this.continuousVisibleScalar = initialScalar;
      const anchor = this.continuousProjection.anchor(initialScalar);
      this.continuousInitialFragmentIndex = anchor.index;
      this.continuousInitialFragmentProgress = anchor.progress;
      this.continuousInitialAnchorRevision += 1;
    }
    this.continuousChangedFragmentIndex = -1;
    this.effects.bumpRevision();
  }

  materializeContinuousImage(id: string, image: ReadingSessionImage,
    appearance: ReaderAppearanceSnapshot): ReadingSurfacePageFragment {
    return materializeReaderContinuousImage(id, image, appearance, (): number => this.view.layout().bodyHeight(false),
      (bodyImage: ReadingSessionImage, capacity: number): number => this.view.scaledImageHeight(bodyImage, capacity));
  }

  refreshContinuousImageFragment(image: ReadingSessionImage): boolean {
    const index = this.continuousProjection.replaceResolvedImage(this.measuredPage.chapter, image,
      (id: string, resolved: ReadingSessionImage): ReadingSurfacePageFragment =>
        this.materializeContinuousImage(id, resolved, this.view.appearance()));
    if (index === undefined) return false;
    this.continuousChangedFragmentIndex = index;
    this.effects.bumpRevision();
    return true;
  }

  retireSelection(retainFrame: boolean): void {
    if (!retainFrame) {
      this.clearContinuousRenderProjection();
      this.continuousInitialFragmentIndex = 0;
      this.continuousInitialFragmentProgress = 0;
      this.continuousProjection.focus(0);
      this.continuousVisibleScalar = 0;
      this.continuousProgressRevision += 1;
    }
    this.continuousUserInteractionActive = false;
  }

  clearContinuousRenderProjection(): void {
    this.continuousEntryPositionReady = false;
    this.continuousProjection.clear();
    this.continuousTitleRecipe = undefined;
    this.continuousChangedFragmentIndex = -1;
    this.effects.bumpRevision();
  }

  continuousTtsHighlight(_renderRevision: number): ReaderContinuousHighlight | undefined {
    return this.continuousProjection.ttsHighlight(this.view.ttsState(), this.view.ttsFollowHighlight());
  }

  performContinuousPageTurn(direction: ReaderPageTurnDirection, viewportFraction: number = 1): ReaderPageTurnOutcome {
    if (!this.view.mounted() || this.view.exiting() || this.view.controlVisible() || !this.view.ready() ||
      this.measuredPage.chapter === undefined || this.continuousScroller === undefined ||
      this.continuousProjection.fragments.length === 0 || this.view.progressInFlight()) {
      return { kind: 'busy' };
    }
    const chapter = this.measuredPage.chapter;
    // A completed pointer can leave the manual-scroll flag set until the
    // List's stop callback. A queued tap/key/Auto Page now owns this scroll;
    // reaching its endpoint must not synthesize another manual chapter turn.
    this.continuousUserInteractionActive = false;
    try {
      if (direction === 'previous' && this.isContinuousScrollerAtStart()) {
        const previousChapter = this.view.adjacentChapterIndex(chapter.chapterIndex, -1);
        if (previousChapter === undefined) {
          if (this.view.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
            this.effects.requestCatalogForTurn(); return { kind: 'preparing' };
          }
          return { kind: 'boundary', edge: 'start' };
        }
        return this.effects.turnToPreviousChapter(previousChapter, chapter.chapterIndex, this.continuousVisibleScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (direction === 'next' && this.isContinuousScrollerAtEnd()) {
        const nextChapter = this.view.adjacentChapterIndex(chapter.chapterIndex, 1);
        if (nextChapter === undefined) {
          if (this.view.isUnknownCatalogEdge(chapter.chapterIndex, 'next')) {
            this.effects.requestCatalogForTurn(); return { kind: 'preparing' };
          }
          return { kind: 'boundary', edge: 'end' };
        }
        return this.effects.openPageTurnChapter(nextChapter, 0) ? { kind: 'started' } : { kind: 'busy' };
      }
      this.continuousProgrammaticScrollIntent?.();
      if (viewportFraction < 1) {
        this.continuousScroller.scrollBy(0, this.view.viewportHeight() * viewportFraction * (direction === 'next' ? 1 : -1));
      } else {
        this.continuousScroller.scrollPage({ next: direction === 'next', animation: !this.view.reducedMotion() });
      }
      return { kind: 'started' };
    } catch (_) {
      return { kind: 'busy' };
    }
  }
}

export interface ReaderReadingStageActors {
  readonly surface: ReaderReadingSurfaceHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly input: ReaderPageTurnInputHost;
  readonly turn: ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly releaseDeferredPointer: () => void;
  readonly framePresented: (revision: number) => void;
  readonly openControl: (origin: 'continuous-tap' | 'paged-tap') => void;
  readonly manualInteraction: () => void;
  readonly gestureDecision: (decision: ReaderPageGestureDecision) => ReaderPageGestureDecision;
  readonly interactionEnabled: () => boolean;
  readonly textSelectionEnabled: () => boolean;
  readonly inputRevision: () => number;
  readonly tapOnly: () => boolean;
  readonly currentPage: () => ReaderPageTurnRenderPage;
  readonly neighbourPage: (direction: ReaderPageTurnDirection) => ReaderPageTurnRenderPage | undefined;
  readonly selectionActivity: (owner: string, active: boolean) => void;
  readonly quoteCard: ReaderQuoteCardAction;
}

interface ReaderReadingBodyPaint {
  readonly projection: ReadingPageTurnRenderSnapshot;
  readonly actors: ReaderReadingStageActors;
  readonly layout: ReaderReadingLayoutSnapshot;
  readonly appearance: ReaderAppearanceSnapshot;
  readonly textSelectionEnabled: boolean;
  readonly autoHighlightStart: number | undefined;
  readonly autoHighlightEnd: number | undefined;
}

export interface ReaderContinuousReadingPaintFacts extends ReaderReadingBodyPaint {
  readonly interactionEnabled: boolean;
  readonly facingChapter: ReaderFacingChapter | undefined;
  readonly rangeObserved: (start: number, end: number, progress: number) => void;
}

export interface ReaderPagedReadingPaintFacts extends ReaderReadingBodyPaint {
  readonly showCornerFeedback: boolean;
  readonly reducedMotion: boolean;
  readonly simulation: boolean;
  readonly pageTurnStyle: ReaderPageTurnStyle;
  readonly pageTurnViewportWidth: number;
  readonly ttsHighlightStart: number | undefined;
  readonly ttsHighlightEnd: number | undefined;
  readonly mountBookTurnSurface: boolean;
  readonly bookTurnSurfaceId: string;
}

export interface ReaderMountedReadingInput {
  readonly projection: ReadingPageTurnRenderSnapshot;
  readonly actors: ReaderReadingStageActors;
  readonly interactionEnabled: boolean;
  readonly textSelectionEnabled: boolean;
  readonly tapOnly: boolean;
  readonly width: number;
  readonly height: number;
  readonly systemLeft: number;
  readonly systemRight: number;
  readonly systemBottom: number;
}

@Builder
export function ReaderContinuousReadingPaint($$: ReaderContinuousReadingPaintFacts) {
  ReaderContinuousReadingStage({
    inputRevision: $$.projection.pageTurnInputRevision,
    inputCurrent: (revision: number): boolean =>
      revision === $$.actors.inputRevision() && $$.actors.interactionEnabled(),
    onInputLost: (revision: number): void => {
      if (revision === $$.actors.inputRevision()) $$.actors.input.retirePointer();
    },
    contentRevision: $$.projection.continuousRenderRevision,
    frameProvider: (): ReaderContinuousRenderFrame => $$.actors.surface.continuousRenderFrame(),
    onProgrammaticScrollReady: (begin: (() => void) | undefined): void => {
      $$.actors.surface.continuousProgrammaticScrollIntent = begin;
    },
    layout: $$.layout,
    appearance: $$.appearance,
    ttsHighlightStart: $$.actors.surface.continuousTtsHighlight($$.projection.continuousRenderRevision)?.start,
    ttsHighlightEnd: $$.actors.surface.continuousTtsHighlight($$.projection.continuousRenderRevision)?.end,
    autoPageHighlightStart: $$.autoHighlightStart,
    autoPageHighlightEnd: $$.autoHighlightEnd,
    longPressSelectText: $$.textSelectionEnabled,
    selectionInputCurrent: $$.actors.textSelectionEnabled,
    quoteCardAction: $$.actors.quoteCard,
    onSelectionActivity: $$.actors.selectionActivity,
    interactionEnabled: $$.interactionEnabled,
    onVisibleRangeChanged: $$.rangeObserved,
    onScrollStopped: (): void => $$.actors.surface.onContinuousScrollStopped(),
    onReachStart: (): void => $$.actors.surface.onContinuousReachStart(),
    onReachEnd: (): void => $$.actors.surface.onContinuousReachEnd(),
    onBoundaryDrag: (direction: ReaderPageTurnDirection): void => $$.actors.surface.onContinuousBoundaryDrag(direction),
    onTurn: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => $$.actors.input.request(direction),
    onOpenControl: (): void => $$.actors.openControl('continuous-tap'),
    onManualInteraction: (): void => $$.actors.surface.onContinuousManualInteraction(),
    onPointerStart: (pointer: number): boolean => $$.actors.input.acquirePointer(pointer),
    onPointerEnd: (pointer: number): void => $$.actors.input.releasePointer(pointer),
    onAnchorSamplerReady: (sample: (() => void) | undefined): void => {
      $$.actors.surface.continuousAnchorSampler = sample;
    },
    onScrollerReady: (scroller: Scroller | undefined): void => {
      $$.actors.surface.continuousScroller = scroller;
    },
  });
  ReaderFacingChapterColumn({ chapter: $$.facingChapter, layout: $$.layout, appearance: $$.appearance });
}

@Builder
export function ReaderPagedReadingPaint($$: ReaderPagedReadingPaintFacts) {
  if ($$.actors.bookmark.pullOffset() > 0) {
    ReaderBookmarkPaperWell({
      paperTop: $$.actors.bookmark.pullPaperTop(), offset: $$.actors.bookmark.pullOffset(),
      paperColor: readerThemeDefinition($$.appearance.activeTheme).paperStart,
      day: readerThemeDefinition($$.appearance.activeTheme).scheme === 'day',
    });
    ReaderBookmarkCornerFeedback({
      host: $$.actors.bookmark, paperWell: true, visible: $$.showCornerFeedback,
      continuous: false, reducedMotion: $$.reducedMotion, revision: $$.projection.pageTurnRenderRevision,
    });
  }
  ReaderPageTurnStage({
    contentRevision: $$.projection.pageTurnRenderRevision,
    bookmarkPresentationRevision: $$.projection.bookmarkPresentationRevision,
    currentPageProvider: $$.actors.currentPage,
    currentPageSlot: $$.projection.pageTurnCurrentSlot,
    currentPageSnapshotId: $$.simulation ? READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID : '',
    previousPageProvider: (): ReaderPageTurnRenderPage | undefined => $$.actors.neighbourPage('previous'),
    nextPageProvider: (): ReaderPageTurnRenderPage | undefined => $$.actors.neighbourPage('next'),
    pageTurnStyle: $$.pageTurnStyle,
    turnDirection: $$.projection.pageTurnDirection,
    offsetX: $$.projection.pageTurnOffsetX,
    viewportWidth: $$.pageTurnViewportWidth,
    layout: $$.layout,
    appearance: $$.appearance,
    topInfoMovesWithPage: true,
    bookmarkMode: $$.actors.bookmark.feedbackMode($$.projection.pageTurnRenderRevision),
    bookmarkOpacity: $$.actors.bookmark.feedbackOpacity(),
    bookmarkRibbon: $$.actors.bookmark.ribbonFrame($$.projection.pageTurnRenderRevision),
    ttsHighlightStart: $$.ttsHighlightStart,
    ttsHighlightEnd: $$.ttsHighlightEnd,
    autoPageHighlightStart: $$.autoHighlightStart,
    autoPageHighlightEnd: $$.autoHighlightEnd,
    longPressSelectText: $$.textSelectionEnabled,
    selectionInputCurrent: $$.actors.textSelectionEnabled,
    quoteCardAction: $$.actors.quoteCard,
    onSelectionActivity: $$.actors.selectionActivity,
    translateY: $$.actors.bookmark.pullOffset(),
    bookmarkPaperTop: $$.actors.bookmark.pullOffset() > 0 ? $$.actors.bookmark.pullPaperTop() : undefined,
    onCurrentPagePresented: $$.actors.framePresented,
    onCurrentPageContentReady: (revision: number): void => $$.actors.turn.onContentReady(revision),
    onDynamicHighlights: (identity: string, rects: ReaderDynamicHighlightRect[]): void =>
      $$.actors.turn.updateHighlights(identity, rects),
  });
  if ($$.mountBookTurnSurface) {
    ReaderBookTurnSurface({
      componentId: $$.bookTurnSurfaceId,
      surfaceOpacity: $$.simulation ? $$.projection.bookTurnSurfaceOpacity : 0,
      onSurfaceLoaded: (): void => $$.actors.turn.surfaceLoaded(),
    });
  }
}

@Builder
export function ReaderMountedReadingGestures($$: ReaderMountedReadingInput) {
  ReaderPageInteractionLayer({
    inputRevision: $$.projection.pageTurnInputRevision,
    inputCurrent: (revision: number): boolean =>
      revision === $$.actors.inputRevision() && $$.actors.interactionEnabled(),
    onInputLost: (revision: number): void => {
      if (revision === $$.actors.inputRevision()) $$.actors.input.retirePointer();
    },
    onRegrab: (width: number, height: number, x: number, y: number, time: number,
      direction: ReaderPageTurnDirection): ReaderPageGestureState | undefined =>
      $$.actors.input.regrab(width, height, x, y, time, direction),
    readinessRevision: $$.projection.pageTurnReadinessRevision + $$.projection.pageTurnRenderRevision,
    onPreparationNeeded: (direction: ReaderPageTurnDirection): void => $$.actors.preparation().prepareHeld(direction),
    interactionEnabled: $$.interactionEnabled,
    tapOnly: $$.tapOnly,
    currentTapOnly: $$.actors.tapOnly,
    viewportWidth: $$.width,
    viewportHeight: $$.height,
    allowTextSelection: $$.textSelectionEnabled,
    systemGestureLeftInset: $$.systemLeft,
    systemGestureRightInset: $$.systemRight,
    systemGestureBottomInset: $$.systemBottom,
    onTurn: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => $$.actors.input.request(direction),
    canStartTurn: (direction: ReaderPageTurnDirection): boolean => $$.actors.input.canStart(direction),
    canStartBookmark: (): boolean => $$.actors.bookmark.canStartGesture(),
    onBookmarkStateChange: (state: ReaderPageGestureState): void => $$.actors.bookmark.updateGesture(state),
    onBookmarkRelease: (changed: boolean): void => $$.actors.bookmark.releaseGesture(changed),
    onBookmarkUnavailable: (reason: 'busy' | 'unavailable'): void => $$.actors.bookmark.gestureUnavailable(reason),
    onOpenControl: (): void => $$.actors.openControl('paged-tap'),
    onManualInteraction: $$.actors.manualInteraction,
    onPointerStart: (pointer: number): boolean => $$.actors.input.acquirePointer(pointer),
    onPointerEnd: (pointer: number): void => $$.actors.input.releasePointer(pointer),
    onDeferredSegmentStart: (): boolean => $$.actors.input.reserveDeferred(),
    onDeferredSegmentResolve: (intent: ReaderPageTapIntent | undefined): void => $$.actors.input.resolveDeferred(intent),
    onDeferredSegmentPromote: $$.actors.releaseDeferredPointer,
    onGestureStateChange: (state: ReaderPageGestureState): void => $$.actors.input.gestureChanged(state),
    onGestureDecision: $$.actors.gestureDecision,
  });
}

export interface ReaderReadingViewportScope {
  readonly sourceId: string;
  readonly bookId: string;
}

export interface ReaderReadingViewportView {
  readonly scope: () => ReaderReadingViewportScope;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly phase: () => ReadingPhase;
  readonly lifecycle: () => number;
  readonly expanded: () => boolean;
  readonly paneWidth: () => number;
  readonly paneHeight: () => number;
  readonly bookTitle: () => string;
  readonly context: () => UIContext;
  readonly observeWindowMetrics: () => void;
  readonly paginationSignature: () => string;
  readonly hasCurrentChapter: () => boolean;
}

export interface ReaderReadingViewportEffects {
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly runtime: () => ReaderPageTurnRuntimeHost;
  readonly surface: () => ReaderReadingSurfaceHost;
  readonly preferences: () => ReaderReadingPreferencesHost;
  readonly auxiliary: () => ReaderAuxiliarySessionHost;
  readonly publishChrome: (update: ReadingChromeRenderUpdate) => void;
  readonly publishTurn: (update: ReadingPageTurnRenderUpdate) => void;
}

/** Owns native window-space geometry and admits a reflow against a complete
 * published viewport. Running turns retain their prior frozen layout. */
export class ReaderReadingViewportHost {
  readonly geometry: ReaderPageGeometryHost = new ReaderPageGeometryHost();
  private readonly view: ReaderReadingViewportView;
  private readonly effects: ReaderReadingViewportEffects;

  constructor(view: ReaderReadingViewportView, effects: ReaderReadingViewportEffects) {
    this.view = view;
    this.effects = effects;
  }

  admitInitialWindowGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    // Use the containing pane when it has already measured. The child Area
    // callback remains authoritative for all later reflow.
    if (!metrics.ready || metrics.windowRect.width <= 0 || metrics.windowRect.height <= 0) return;
    this.effects.publishChrome({ viewportWidth: this.view.paneWidth() > 0 ? this.view.paneWidth() : metrics.windowRect.width });
    this.effects.publishChrome({ viewportHeight: this.view.paneHeight() > 0 ? this.view.paneHeight() : metrics.windowRect.height });
  }

  admitReaderViewportSize(width: number, height: number, lifecycleToken: number): void {
    if (width <= 0 || height <= 0) {
      return;
    }
    if (this.effects.runtime().inputPhase() !== 'idle') {
      this.effects.runtime().settlement.pageTurn.deferViewport(width, height);
      if (this.view.projection().pageTurnSettlementActive) this.admitPageTurnPresentationWidth(width);
      this.effects.runtime().rollbackForDeferredMutation();
      return;
    }
    if (Math.abs(width - this.view.chrome().viewportWidth) < 0.01 &&
      Math.abs(height - this.view.chrome().viewportHeight) < 0.01) {
      return;
    }
    this.effects.runtime().invalidate(true);
    const previousLayoutSignature = this.hasMeasuredViewport() ? this.view.paginationSignature() : undefined;
    this.effects.publishChrome({ viewportWidth: width });
    this.effects.publishChrome({ viewportHeight: height });
    this.effects.auxiliary().reconcileCapsuleLayout();
    if (this.effects.runtime().usesBookTurnSimulation()) {
      this.effects.runtime().presentation.session.configure(width, height);
    }
    this.effects.measured().measurementCoordinator.rememberWindowLayout(this.windowMetricsLayoutInput());
    if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.view.paginationSignature()) {
      // A reflow invalidates both the continuous draft and every complete
      // manifest measured under the predecessor geometry. The new signature
      // can never accidentally address those physical page boundaries.
      this.effects.measured().physicalPagination.index.invalidateLayout(
        this.view.scope().sourceId,
        this.view.scope().bookId,
        previousLayoutSignature,
      );
      this.effects.measured().resetPaginationDraft();
    }
    if (this.view.hasCurrentChapter() && this.view.phase() !== 'failed') {
      // The hidden Text layout and its initial Core write are one atomic
      // generation. Starting another one here would race two writes against
      // the same Core snapshot revision.
      if (this.effects.measured().measurementCompleting) {
        this.effects.measured().measurementCoordinator.deferMeasurement();
        return;
      }
      this.effects.measured().beginMeasurement(lifecycleToken);
    }
  }

  pageTurnStageViewportWidth(): number {
    return this.view.projection().pageTurnPresentationWidth > 0 ? this.view.projection().pageTurnPresentationWidth : this.view.chrome().viewportWidth;
  }

  reflowAfterWindowGeometryChange(): void {
    this.effects.measured().measurementCoordinator.reflowWindow({
      hasTurnInFlight: (): boolean => this.effects.runtime().inputPhase() !== 'idle',
      deferForTurn: (): void => {
        // The turn's layout is frozen until the transaction joins.
        this.effects.runtime().settlement.pageTurn.deferWindowReflow();
        this.effects.runtime().rollbackForDeferredMutation();
      },
      windowLayout: (): ReadingWindowLayoutInput => this.windowMetricsLayoutInput(),
      invalidateTurn: (): void => this.effects.runtime().invalidate(true),
      invalidatePagination: (): void => {
        this.effects.measured().physicalPagination.index.invalidateBook(this.view.scope().sourceId, this.view.scope().bookId);
        this.effects.measured().resetPaginationDraft();
      },
      applyChrome: (): void => this.effects.preferences().applyWindowChrome(),
      hasMaterializedChapter: (): boolean => this.view.hasCurrentChapter() && this.view.phase() !== 'failed',
      isCompleting: (): boolean => this.effects.measured().measurementCompleting,
      deferMeasurement: (): void => { this.effects.measured().measurementCoordinator.deferMeasurement(); },
      beginMeasurement: (): void => this.effects.measured().beginMeasurement(this.view.lifecycle()),
    });
  }

  effectiveViewportWidth(): number {
    return this.view.chrome().viewportWidth > 0 ? this.view.chrome().viewportWidth :
      (this.view.expanded() ? READER_TABLET_REFERENCE_WIDTH : READER_PHONE_REFERENCE_WIDTH);
  }

  hasMeasuredViewport(): boolean {
    return this.view.chrome().viewportWidth > 0 && this.view.chrome().viewportHeight > 0;
  }

  effectiveViewportHeight(): number {
    return this.view.chrome().viewportHeight > 0 ? this.view.chrome().viewportHeight :
      (this.view.expanded() ? READER_TABLET_REFERENCE_HEIGHT : READER_PHONE_REFERENCE_HEIGHT);
  }

  readingLayout(): ReaderReadingLayoutSnapshot {
    this.view.observeWindowMetrics();
    const settlementLayout = this.effects.runtime().settlement.layout;
    if (settlementLayout !== undefined) return settlementLayout;
    const frozen = this.effects.runtime().settlement.pageTurn.frozen(this.view.projection().pageTurnRenderRevision);
    if (frozen !== undefined) return frozen.layout;
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    const metrics = ReaderWindowCoordinator.metrics();
    return this.geometry.readingLayout(width, height, metrics, this.view.expanded(), this.view.chrome().readerSettingsSnapshot,
      this.view.chrome().appearanceSnapshot.pageMarginOffset ?? 0, (): number =>
        Math.max(this.effects.auxiliary().sessionCapsuleMetrics('autoPage').paintHeight, this.effects.auxiliary().sessionCapsuleMetrics('tts').paintHeight),
      (): UIContext => this.view.context(), (): string => this.view.bookTitle(), (): string => this.view.chrome().pageChromeClockText);
  }

  windowMetricsLayoutInput(): ReadingWindowLayoutInput {
    return {
      layout: this.readingLayout(),
      extendIntoCutout: this.view.chrome().readerSettingsSnapshot.extendIntoCutout,
      hideNavigationBar: this.view.chrome().readerSettingsSnapshot.hideNavigationBar,
    };
  }

  readerSystemGestureLeftInset(): number {
    this.view.observeWindowMetrics();
    const metrics = ReaderWindowCoordinator.metrics();
    return readingGestureInset(16, metrics.gestureInsets.left, metrics.navigationInsets.left);
  }

  readerSystemGestureRightInset(): number {
    this.view.observeWindowMetrics();
    const metrics = ReaderWindowCoordinator.metrics();
    return readingGestureInset(16, metrics.gestureInsets.right, metrics.navigationInsets.right);
  }

  readerSystemGestureBottomInset(): number {
    this.view.observeWindowMetrics();
    const metrics = ReaderWindowCoordinator.metrics();
    return readingGestureInset(24, metrics.gestureInsets.bottom, metrics.navigationInsets.bottom);
  }

  numericAreaLength(value: Length): number {
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

  private admitPageTurnPresentationWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    this.effects.publishTurn({ pageTurnPresentationWidth: width });
    if (this.effects.runtime().prepared.prepared !== undefined && this.view.projection().pageTurnDirection !== undefined) {
      // The durable anchor is still measured under the frozen logical width,
      // but the actual ArkUI parent has already resized. Snap the presentation
      // endpoint to the new live width so the moving old page cannot cover a
      // strip of the destination while the Core commit is still in flight.
      this.effects.publishTurn({ pageTurnOffsetX: this.view.projection().pageTurnDirection === 'next' ? -width : width });
    } else if (this.view.projection().pageTurnSettlementActive) {
      // A rollback after a resize may safely finish visually at the admitted
      // page while its existing completion callback closes the state machine.
      this.effects.publishTurn({ pageTurnOffsetX: 0 });
    }
  }

  admitAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): void {
    const previous = this.view.chrome().appearanceSnapshot;
    const layoutChanged = !sameReaderAppearanceLayout(previous, snapshot);
    const themeChanged = previous.activeTheme !== snapshot.activeTheme;
    if ((layoutChanged || themeChanged) && this.effects.runtime().inputPhase() !== 'idle') {
      this.effects.runtime().pageTurn.deferAppearance(snapshot);
      this.effects.runtime().rollbackForDeferredMutation();
      return;
    }
    if (layoutChanged || themeChanged) {
      this.effects.runtime().invalidate(true);
    }
    const previousLayoutSignature = layoutChanged && this.hasMeasuredViewport() ?
      this.view.paginationSignature() : undefined;
    const measured = this.effects.measured();
    const page = measured.page;
    const currentVisibleAnchor = this.view.chrome().readerSettingsSnapshot.navigationMode === 'continuous' ?
      this.effects.surface().continuousVisibleScalar : page !== undefined &&
      measured.selection === measured.materializedChapterSelectionToken ? page.startScalar : measured.desiredChapterOffset;

    this.effects.publishChrome({ appearanceSnapshot: snapshot });
    if (layoutChanged || themeChanged) this.effects.auxiliary().reconcileCapsuleLayout();
    this.effects.preferences().applyWindowChrome();
    if (!layoutChanged) {
      if (themeChanged && this.view.hasCurrentChapter() && this.view.phase() === 'ready') {
        this.effects.runtime().preparation.schedule();
      }
      return;
    }
    if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.view.paginationSignature()) {
      this.effects.measured().physicalPagination.index.invalidateLayout(this.view.scope().sourceId, this.view.scope().bookId, previousLayoutSignature);
    }
    this.effects.measured().resetPaginationDraft();
    if (!this.view.hasCurrentChapter() || this.view.phase() === 'failed') {
      return;
    }
    const scalarCount = this.effects.measured().requireChapterLayoutMap().scalarCount();
    this.effects.measured().desiredChapterOffset = Math.max(0, Math.min(scalarCount, currentVisibleAnchor));
    this.effects.measured().desiredChapterProgress = scalarCount === 0 ? 0 : this.effects.measured().desiredChapterOffset / scalarCount;
    if (this.effects.measured().measurementCompleting) {
      this.effects.measured().measurementCoordinator.deferMeasurement(true);
      return;
    }
    this.effects.measured().beginMeasurement(this.view.lifecycle());
  }

  visibleReadingAppearance(): ReaderAppearanceSnapshot {
    return this.pageReadingAppearance(this.effects.measured().page);
  }

  pageReadingAppearance(page: PhysicalReadingPage | undefined): ReaderAppearanceSnapshot {
    return resolveMeasuredReaderAppearanceSnapshot(page?.measuredAppearance, this.view.chrome().appearanceSnapshot);
  }
}

export interface ReaderReadingInputDeviceActors {
  readonly sourceSwitch: ReadingSourceSwitchOverlayHost;
  readonly chapterPresentation: ReaderReadingChapterPresentationHost;
  readonly geometry: ReaderControlGeometryHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly selection: ReaderTextSelectionActivity;
  readonly progress: ReaderReadingProgressHost;
  readonly turn: ReaderPageTurnRuntimeHost;
  readonly control: ReaderControlDirectorySession;
  readonly directory: ReaderControlDirectoryOperationsHost;
  readonly mount: ReaderReadingMountHost;
  readonly playback: ReaderReadingPlaybackFlowHost;
  readonly surface: ReaderReadingSurfaceHost;
}

export interface ReaderReadingInputDeviceView {
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly overlay: () => ReadingOverlayRenderSnapshot;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly chrome: () => ReadingChromeRenderSnapshot;
  readonly foreground: () => boolean;
  readonly settings: () => ReaderSmartGestureSettings;
  readonly windowActive: () => boolean;
  readonly windowOverlay: () => boolean;
  readonly identityCurrent: () => boolean;
  readonly context: () => UIContext;
  readonly readerInputCurrent: () => boolean;
  readonly pageInputCurrent: () => boolean;
  readonly controlVisible: () => boolean;
  readonly controlObscured: () => boolean;
  readonly interactionBlocked: () => boolean;
  readonly sourceSwitchVisible: () => boolean;
  readonly sourceSwitchFailure: () => string;
  readonly sourceSwitchRollingBack: () => boolean;
  readonly openControl: (shortcut?: 'search' | 'directory') => void;
}

/** Registers the mounted native gesture source and admits hardware shortcuts
 * only while the reader's paper has input authority. */
export class ReaderReadingInputDevices {
  readonly native: HarmonySmartGestureHost = new HarmonySmartGestureHost();
  private readonly actors: ReaderReadingInputDeviceActors;
  private readonly view: ReaderReadingInputDeviceView;

  constructor(actors: ReaderReadingInputDeviceActors, view: ReaderReadingInputDeviceView) {
    this.actors = actors;
    this.view = view;
  }

  key(event: KeyEvent): boolean {
    const action = readerHardwareKeyboardShortcut(event, {
      bodyOwnsInput: this.view.pageInputCurrent() && !this.view.windowOverlay() &&
        !this.view.sourceSwitchVisible() && this.view.sourceSwitchFailure().length === 0 &&
        !this.view.sourceSwitchRollingBack() && !this.actors.sourceSwitch.shouldShowPreparation() && !this.actors.chapterPresentation.shouldShowChapterLoading() &&
        this.actors.geometry.temporaryLayer.length === 0 && !ReaderNativeAlertWindow.isPresented() &&
        this.view.overlay().sessionLaunch === undefined && !this.actors.recovery.requestCurrent() && this.view.session().phase === 'ready',
      inputFocused: readerControlKeyboardVisible(ReaderWindowCoordinator.metrics()),
      selectionActive: this.actors.selection.active(),
    });
    if (action === undefined) return false;
    if (action === 'back') this.actors.progress.requestExit();
    else if (action === 'next' || action === 'previous') this.actors.turn.input.request(action);
    else this.view.openControl(action);
    return true;
  }

  sync(): void {
    if (!this.view.session().mounted || !this.view.foreground() || !this.view.windowActive() || !this.view.settings().enabled ||
      !this.view.identityCurrent()) {
      this.native.detach();
      return;
    }
    try {
      this.native.attach(this.view.context(), {
        decide: (gesture: ReaderSmartGesture): ReaderSmartGestureAction => this.smartGestureDecision(gesture),
        dispatch: (action: ReaderSmartGestureAction): void => this.dispatchSmartGesture(action),
      });
    } catch (_) { this.native.detach(); }
  }

  private smartGestureDecision(gesture: ReaderSmartGesture): ReaderSmartGestureAction {
    const control = readerControlContentLocation(this.actors.control.visualSession());
    return readerSmartGestureAction(gesture, this.view.settings(), {
      foreground: this.view.readerInputCurrent(),
      controlsOpen: this.view.controlVisible() || this.view.overlay().sessionLaunch !== undefined,
      directoryOpen: control.level === 'secondary' && control.module === 'directory',
      sourceSwitchOpen: this.view.sourceSwitchVisible() || this.view.windowOverlay(),
      settingsOpen: control.level === 'secondary' && (control.module === 'settings' || control.module === 'appearance'),
      dialogOpen: this.actors.geometry.temporaryLayer.length > 0 || this.actors.recovery.requestCurrent() ||
        ReaderNativeAlertWindow.isPresented(),
      selectionActive: this.actors.selection.active(),
      zoomed: false,
      chapterLoading: this.view.session().phase !== 'ready' || this.actors.chapterPresentation.shouldShowChapterLoading() ||
        this.actors.directory.selection.ticket !== undefined || this.actors.turn.inputPhase() !== 'idle',
      sourceSwitching: this.view.sourceSwitchRollingBack() || this.view.sourceSwitchFailure().length > 0 ||
        this.actors.mount.gateway?.hasPendingSourceSwitch() === true,
      continuous: this.view.chrome().readerSettingsSnapshot.navigationMode === 'continuous',
    });
  }

  private dispatchSmartGesture(action: ReaderSmartGestureAction): void {
    if (action === 'back') this.actors.progress.requestExit();
    else if (action === 'toggleControls') this.view.openControl();
    else if (action === 'pageNext') this.actors.turn.input.request('next');
    else if (action === 'scrollNext') {
      this.actors.playback.manualInteraction();
      this.actors.surface.performContinuousPageTurn('next', READER_SMART_GESTURE_VIEWPORT_FRACTION);
    }
  }

  textSelectionEnabled(): boolean {
    if (!this.view.readerInputCurrent()) return false;
    return readerTextSelectionEnabled({
      configured: this.view.chrome().readerSettingsSnapshot.longPressSelectText,
      mounted: this.view.session().mounted,
      exitRequested: this.view.session().exitRequested,
      pageReady: this.view.session().phase === 'ready',
      controlVisible: this.view.controlVisible(),
      controlObscured: this.view.controlObscured(),
      interactionBlocked: this.view.interactionBlocked(),
      pageTurnActive: this.view.projection().pageTurnSettlementActive || this.actors.turn.prepared.prepared !== undefined ||
        this.actors.turn.pageTurn.gesture.phase === 'dragging' || this.actors.turn.pageTurn.gesture.phase === 'settling' ||
        this.actors.turn.pageTurn.hasRapidWork(),
      autoPageActive: this.actors.playback.automaticState().status !== 'stopped',
      ttsActive: readerTtsSessionBlocksAutoPageStart(this.view.session().ttsState.status),
    });
  }
}

export interface ReaderMountedReadingSceneActors {
  readonly stage: ReaderReadingStageActors;
  readonly surface: ReaderReadingSurfaceHost;
  readonly viewport: ReaderReadingViewportHost;
  readonly input: ReaderReadingInputDevices;
  readonly controls: ReaderReadingControlInteractionHost;
  readonly controlDirectory: ReaderControlDirectorySession;
  readonly controlGeometry: ReaderControlGeometryHost;
  readonly playback: ReaderReadingPlaybackFlowHost;
  readonly chapterPresentation: ReaderReadingChapterPresentationHost;
  readonly pageChrome: ReaderReadingPageChromeHost;
  readonly sourceSwitch: ReadingSourceSwitchOverlayHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly turn: ReaderPageTurnRuntimeHost;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly capsule: ReaderAuxiliarySessionHost;
  readonly preferences: ReaderReadingPreferencesHost;
  readonly speech: ReaderReadingSpeechHost;
  readonly mount: ReaderReadingMountHost;
  readonly progress: ReaderReadingProgressHost;
  readonly measured: ReaderMeasuredPagePublication;
}

export interface ReaderMountedReadingSceneView {
  readonly bookTurnSurfaceId: string;
  readonly controlFrame: () => ReaderNativeControlFrameInput;
  readonly controlIntent: () => ReaderControlIntentHandler;
  readonly preferenceModule: () => string;
  readonly loadingTitle: () => string;
  readonly scheme: () => string;
  readonly reduceMotion: () => boolean;
  readonly windowChromeActive: () => boolean;
  readonly sourceSwitchFailure: () => string;
  readonly sourceSwitchScope: () => number;
  readonly sourceSwitchVisible: () => boolean;
  readonly sourceSwitchRollingBack: () => boolean;
  readonly sourceSwitchTransaction: () => string | undefined;
  readonly dismissSourceSwitchFailure: (scope: number) => void;
  readonly retrySourceSwitch: (scope: number) => void;
  readonly switchSource: (focus?: string) => void;
  readonly selection: () => number;
  readonly windowMetricsRevision: () => number;
  readonly bookmarkRecovery: () => ReadingDirectoryRecovery;
  readonly smartGesturesEnabled: () => boolean;
  readonly controlObscured: () => boolean;
  readonly expanded: () => boolean;
  readonly foreground: () => boolean;
  readonly sourceName: () => string;
  readonly sourceId: () => string;
  readonly bookId: () => string;
}

export interface ReaderMountedReadingSceneInput {
  readonly actors: ReaderMountedReadingSceneActors;
  readonly view: ReaderMountedReadingSceneView;
  readonly chrome: ReadingChromeRenderSnapshot;
  readonly session: ReadingSessionRenderSnapshot;
  readonly overlay: ReadingOverlayRenderSnapshot;
  readonly projection: ReadingPageTurnRenderSnapshot;
}

function readingStageWindowMetrics(_revision: number): ReaderWindowMetricsSnapshot {
  return ReaderWindowCoordinator.metrics();
}

function readingStageTtsHighlightCurrent(measured: ReaderMeasuredPagePublication, session: ReadingSessionRenderSnapshot,
  view: ReaderMountedReadingSceneView): boolean {
    const page = measured.page;
    if (!session.ttsFollowHighlight || page === undefined) return false;
    const key = page.paginationKey;
    if (key !== undefined) {
      return key.sourceId === view.sourceId() && key.bookId === view.bookId() &&
        session.ttsState.chapterIndex === key.chapterIndex && session.ttsState.contentVersion === key.contentVersion;
    }
    // An unindexed page can use the materialized chapter only while both
    // still belong to the same selection.
    return measured.selection === measured.materializedChapterSelectionToken &&
      measured.chapter !== undefined && session.ttsState.chapterIndex === measured.chapter.chapterIndex &&
      session.ttsState.contentVersion === measured.materializedContentVersion;
  }

/** The mounted reading paper keeps the stage, controls, input overlay, and
 * feedback siblings in their native compositor order. */
@Builder
export function ReaderMountedReadingScene($$: ReaderMountedReadingSceneInput) {
    Stack({ alignContent: Alignment.TopStart }) {
      // The normal paper and controls own loading and recoverable errors too.
      if (readerRenderStageKind($$.chrome.readerSettingsSnapshot.navigationMode, $$.actors.surface.hasContinuousRenderContent()) === 'continuous') {
        ReaderContinuousReadingPaint({
          projection: $$.projection, actors: $$.actors.stage,
          layout: $$.actors.viewport.readingLayout(), appearance: $$.actors.viewport.visibleReadingAppearance(),
          textSelectionEnabled: $$.actors.input.textSelectionEnabled(), interactionEnabled: $$.actors.controls.isReaderPageInteractionEnabled(),
          autoHighlightStart: $$.actors.playback.autoPageHighlightFragment()?.startScalar, autoHighlightEnd: $$.actors.playback.autoPageHighlightFragment()?.endScalar,
          facingChapter: $$.actors.pageChrome.currentFacing($$.projection.pageTurnRenderRevision),
          rangeObserved: $$.actors.sourceSwitch.observeContinuousRange($$.projection.continuousRenderRevision),
        });
        // Session launch already owns one shared chrome overlay. Ordinary
        // continuous chrome remains a stationary sibling of the scrolling List.
        if ($$.overlay.sessionLaunch === undefined) {
          ReaderPageChrome({
            topStartText: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).topStartText,
            topEndText: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).topEndText,
            bottomStartText: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).bottomStartText,
            bottomEndText: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).bottomEndText,
            sessionVisible: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).sessionVisible,
            sessionWidth: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).sessionWidth,
            sessionHeight: $$.actors.surface.continuousPageChromeSnapshot($$.projection.continuousRenderRevision,
              $$.chrome.continuousChromeProgressText).sessionHeight,
            layout: $$.actors.viewport.readingLayout(),
            appearance: $$.actors.viewport.visibleReadingAppearance(),
          }).zIndex(1).hitTestBehavior(HitTestMode.None);
        }
      } else {
        ReaderPagedReadingPaint({
          projection: $$.projection, actors: $$.actors.stage,
          layout: $$.actors.viewport.readingLayout(), appearance: $$.actors.viewport.visibleReadingAppearance(),
          textSelectionEnabled: $$.actors.input.textSelectionEnabled(), autoHighlightStart: $$.actors.playback.autoPageHighlightFragment()?.startScalar,
          autoHighlightEnd: $$.actors.playback.autoPageHighlightFragment()?.endScalar, showCornerFeedback: !$$.actors.controls.controlVisible() && !$$.view.controlObscured(),
          reducedMotion: $$.view.reduceMotion(), simulation: $$.actors.turn.usesBookTurnSimulation(),
          pageTurnStyle: $$.actors.turn.effectivePageTurnStyle(), pageTurnViewportWidth: $$.actors.viewport.pageTurnStageViewportWidth(),
          ttsHighlightStart: readingStageTtsHighlightCurrent($$.actors.measured, $$.session, $$.view) ? $$.session.ttsState.charStart : undefined,
          ttsHighlightEnd: readingStageTtsHighlightCurrent($$.actors.measured, $$.session, $$.view) ? $$.session.ttsState.charEnd : undefined,
          mountBookTurnSurface: $$.actors.turn.shouldMountBookTurnSurface(), bookTurnSurfaceId: $$.view.bookTurnSurfaceId,
        });
      }
      if ($$.overlay.sourceSwitchRevealOpacity > 0 && $$.actors.sourceSwitch.completionDisplayCurrent()) {
        ReaderSourceSwitchOverlay({ opacity: $$.overlay.sourceSwitchRevealOpacity,
          theme: $$.actors.viewport.visibleReadingAppearance().activeTheme, expanded: $$.actors.viewport.readingLayout().widthClass === 'expanded' });
      }
      // Reader Control (RC-READER-CONTROL-01): tapping the center vertical band
      // raises the control layer, which overlays the reading surface.
      // The Panel stays mounted, but only this Host's linked session owns
      // routes, held input, the transition and committed close revision.
      ReaderControlDirectoryHost({
        owner: $$.actors.controlDirectory,
        frame: $$.actors.controlDirectory.panelFrame($$.view.controlFrame()),
        onIntent: $$.view.controlIntent(),
      })
        // The control overlay, including its transparent outside-tap owner,
        // must sit above selectable reading Text nodes on every control route.
        // The persistent launch capsule also needs its parent above the raw
        // page sibling; its own zIndex only orders children inside this host.
        .zIndex($$.overlay.sessionLaunch !== undefined ? 8 : 7)
        // The selected demo replaces controls when the source drawer opens.
        // Retain the real control session/close animation without painting it
        // underneath the drawer's translucent scrim.
        .visibility($$.view.sourceSwitchVisible() ? Visibility.Hidden : Visibility.Visible)
        .hitTestBehavior(HitTestMode.Transparent);
      // Keep the raw page interaction owner mounted while the control session
      // opens/closes. Switching this full-screen node in the same commit as a
      // control dismiss can leave an empty compositor frame. It is inert via
      // hitTestMode.None while controls are visible, and the navigation-mode
      // gate preserves continuous-scroll ownership.
      // Tap and horizontal pan share one pointer owner and one previous/next
      // request path. Slide uses an already measured neighbour; none/cold
      // fallbacks still use the existing committed pagination flow.
      ReaderMountedReadingGestures({
        projection: $$.projection, actors: $$.actors.stage,
        interactionEnabled: $$.session.phase !== 'failed' && $$.view.sourceSwitchFailure().length === 0 &&
          ($$.chrome.readerSettingsSnapshot.navigationMode === 'paged' ||
            !$$.actors.surface.hasContinuousRenderContent()) && $$.actors.controls.isReaderPageInteractionEnabled(),
        tapOnly: $$.actors.turn.tapOnlyInput(), width: $$.chrome.viewportWidth, height: $$.chrome.viewportHeight,
        textSelectionEnabled: $$.actors.input.textSelectionEnabled(), systemLeft: $$.actors.viewport.readerSystemGestureLeftInset(),
        systemRight: $$.actors.viewport.readerSystemGestureRightInset(), systemBottom: $$.actors.viewport.readerSystemGestureBottomInset(),
      });
      ReaderBookmarkCornerFeedback({
          host: $$.actors.bookmark, paperWell: false, visible: !$$.actors.controls.controlVisible() && !$$.view.controlObscured(),
          continuous: readerRenderStageKind($$.chrome.readerSettingsSnapshot.navigationMode, $$.actors.surface.hasContinuousRenderContent()) === 'continuous',
          reducedMotion: $$.view.reduceMotion(), revision: $$.projection.pageTurnRenderRevision,
        });
      // A visible system status bar owns this measured band, both during
      // ordinary reading and while controls are presented. Cover any retained
      // page-owned information text before painting native system chrome.
      if ($$.view.windowChromeActive() &&
        ($$.chrome.windowControlsPresented || $$.chrome.readerSettingsSnapshot.hideStatusBar !== true)) {
        // Read the observed revision inside the child update function: a static
        // metrics getter alone never subscribes this paint node to later measures.
        // Keep the status paper above the page-owned ReaderPageChrome and the
        // control panel's transparent backdrop. The native status bar and this
        // exact measured crop are one visual band, so a stale/transparent page
        // info layer must never bleed through while the system bar is visible.
        ReaderStatusBarPaper({
          theme: $$.chrome.appearanceSnapshot.activeTheme,
          fallbackColor: readerAppearanceThemeStyle($$.chrome.appearanceSnapshot.activeTheme).paperStart,
          viewportWidth: $$.actors.viewport.readingLayout().viewportWidth,
          viewportHeight: $$.actors.viewport.readingLayout().viewportHeight,
          statusRect: readingStageWindowMetrics($$.view.windowMetricsRevision()).statusBarRect,
          expanded: $$.actors.viewport.readingLayout().widthClass === 'expanded',
        }).id('reader-status-bar-underlay').zIndex(10).hitTestBehavior(HitTestMode.None);
      }
      if ($$.actors.chapterPresentation.shouldShowChapterLoading()) {
        ReaderChapterLoadingState({
          theme: $$.chrome.appearanceSnapshot.activeTheme,
          expanded: $$.view.expanded(),
          chapterTitle: $$.view.loadingTitle(),
          active: $$.view.foreground(),
          reduceMotion: $$.view.reduceMotion(),
          topInset: readerVisualSafeTop(readingStageWindowMetrics($$.view.windowMetricsRevision())),
          leftInset: readerInteractiveSafeLeft(readingStageWindowMetrics($$.view.windowMetricsRevision())),
          onBack: (): void => { if ($$.actors.controls.readerInputIsCurrent()) $$.actors.progress.beginExit(); },
        }).zIndex(9);
      }
      if ($$.session.phase === 'failed' || $$.view.sourceSwitchFailure().length > 0) {
        ReaderReadingFailureSurface({
          theme: $$.chrome.appearanceSnapshot.activeTheme,
          layout: { width: $$.actors.viewport.readingLayout().bodyWidth(), height: $$.actors.viewport.readingLayout().bodyHeight(false),
            left: $$.actors.viewport.readingLayout().contentLeft, top: $$.actors.viewport.readingLayout().contentTop },
          sourceSwitchFailureMessage: $$.view.sourceSwitchFailure(),
          failureHint: $$.overlay.failureHint,
          sourceSwitchScopeId: $$.view.sourceSwitchScope(),
          recoveryGeneration: $$.overlay.readerRecoveryView.visible && $$.overlay.readerRecoveryView.canRetry ?
            $$.overlay.readerRecoveryView.generation : undefined,
          recoveryActionLabel: $$.overlay.readerRecoveryActionLabel,
          rollbackInFlight: $$.view.sourceSwitchRollingBack(),
          rollbackTarget: $$.session.phase === 'failed' && $$.view.sourceSwitchTransaction() !== undefined ?
            { transactionId: $$.view.sourceSwitchTransaction(), scopeId: $$.view.sourceSwitchScope(),
              selectionToken: $$.view.selection() } : undefined,
          switchSourceFocusId: $$.view.sourceId() !== 'local' ?
            sourceSwitchTriggerFocusId($$.view.sourceId(), $$.view.bookId(), 'reader-recovery') : undefined,
          onRetryFailedSourceSwitch: (scopeId: number): void => $$.view.retrySourceSwitch(scopeId),
          onRetryRecovery: (generation: number): void => $$.actors.recovery.retryNoticeFromFailureSurface(generation),
          onRetryReading: (): void => $$.actors.recovery.retryReadingFromFailureSurface(),
          onOpenSettings: (): void => $$.actors.controls.openReaderControl(),
          onDismissSourceSwitchFailure: (scopeId: number): void => $$.view.dismissSourceSwitchFailure(scopeId),
          onRollbackSourceSwitch: (target: ReaderSourceSwitchRecoveryTarget): void => $$.actors.recovery.rollbackSourceSwitch(target),
          onSwitchSource: (): void => $$.view.switchSource(sourceSwitchTriggerFocusId($$.view.sourceId(), $$.view.bookId(), 'reader-recovery')),
        });
      }
      if ($$.overlay.sessionLaunch === undefined && $$.actors.capsule.shouldShowSessionCapsule()) {
        ReaderSessionCapsule({
          type: $$.actors.capsule.sessionCapsuleType(), sessionState: $$.actors.capsule.sessionCapsuleState(), countdown: $$.actors.capsule.sessionCapsuleCountdown(),
          themeScheme: $$.view.scheme(),
          fontScale: $$.actors.viewport.readingLayout().systemFontScale,
          measurementIdentity: $$.actors.capsule.sessionCapsuleMeasurementIdentity($$.actors.capsule.sessionCapsuleType()),
          interactionEnabled: !$$.projection.pageTurnInputOwned,
          onToggle: (): void => $$.actors.capsule.toggleSessionCapsule(),
          onMeasured: (width: number, height: number, identity: string, type: ReaderSessionCapsuleType): void =>
            $$.actors.capsule.onSessionCapsuleMeasured(identity, type, width, height),
        }).position({ x: $$.actors.capsule.sessionCapsuleLayout().sessionX, y: $$.actors.capsule.sessionCapsuleLayout().sessionY }).zIndex(8);
      }
      if ($$.overlay.sessionLaunch !== undefined) {
        ReaderPageChrome({
          isSessionOverlay: true,
          topStartText: $$.actors.capsule.sessionChromeForPresentation($$.chrome.continuousChromeProgressText).topStartText,
          topEndText: $$.actors.capsule.sessionChromeForPresentation($$.chrome.continuousChromeProgressText).topEndText,
          bottomStartText: $$.actors.capsule.sessionChromeForPresentation($$.chrome.continuousChromeProgressText).bottomStartText,
          bottomEndText: $$.actors.capsule.sessionChromeForPresentation($$.chrome.continuousChromeProgressText).bottomEndText,
          sessionVisible: true,
          sessionWidth: $$.overlay.sessionLaunch.geometry.capsuleWidth, sessionHeight: $$.actors.capsule.sessionCapsuleMetrics().targetHeight,
          layout: $$.actors.viewport.readingLayout(), appearance: $$.actors.viewport.visibleReadingAppearance(),
          incomingOpacity: $$.overlay.sessionLaunch.sample.immersiveOpacity,
          footerOpacity: $$.overlay.sessionLaunchFooterExiting ? $$.overlay.sessionLaunchFooterOpacity : $$.overlay.sessionLaunch.sample.footerOpacity,
          footerTranslateX: $$.overlay.sessionLaunchFooterExiting ? $$.overlay.sessionLaunchFooterOffset : $$.overlay.sessionLaunch.sample.footerTranslateX,
          sessionExitProgress: $$.overlay.sessionLaunchFooterExitProgress,
        }).opacity($$.overlay.sessionLaunchFooterExiting ? 1 : $$.overlay.sessionLaunchStageOpacity).zIndex(8).hitTestBehavior(HitTestMode.None)
          .transition($$.view.reduceMotion() ? TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()), TransitionEffect.IDENTITY) :
            TransitionEffect.IDENTITY);
      }
      if ($$.actors.sourceSwitch.shouldShowPreparation()) {
        SourceSwitchProgress({
          sourceName: $$.view.sourceName(),
          chapterTitle: $$.actors.measured.chapter?.chapterTitle || $$.chrome.chapterTitle,
          statusText: '正在载入章节…',
          reduceMotion: $$.view.reduceMotion(),
          active: $$.view.windowChromeActive(),
          topInset: readerVisualSafeTop(readingStageWindowMetrics($$.view.windowMetricsRevision())),
          bottomInset: readerInteractiveSafeBottom(readingStageWindowMetrics($$.view.windowMetricsRevision())),
        }).zIndex(9);
      }
      if (!$$.view.sourceSwitchVisible() && $$.actors.recovery.hasContent()) {
        ReaderRecoveryOverlay({
          overlayId: $$.actors.recovery.overlayId(),
          widthVp: $$.actors.controlGeometry.layout($$.view.windowMetricsRevision()).topBarWidth,
          maxHeightVp: $$.actors.recovery.overlayMaxHeight(),
          leftVp: ($$.chrome.viewportWidth - $$.actors.controlGeometry.layout($$.view.windowMetricsRevision()).topBarWidth) / 2,
          topVp: $$.actors.recovery.overlayTop(),
          interactionEnabled: $$.actors.recovery.inputCurrent(),
          bookmarkRecovery: $$.view.bookmarkRecovery(), bookmarkIdentity: $$.actors.recovery.bookmarkIdentity(),
          offlineIdentity: $$.actors.recovery.offlineIdentity(),
          readerNotice: $$.overlay.readerRecoveryView, readerNoticeActionLabel: $$.overlay.readerRecoveryActionLabel,
          settingsNotice: $$.overlay.readerSettingsRecovery, settingsNoticeBusy: $$.overlay.readerSettingsRecoveryBusy,
          appearanceNotice: $$.overlay.appearanceSaveRecovery, appearanceNoticeBusy: $$.overlay.appearanceSaveRecoveryBusy,
          ttsPreferencesNotice: $$.overlay.ttsPreferencesRecovery, ttsPreferencesNoticeBusy: $$.overlay.ttsPreferencesRecoveryBusy,
          ttsConfigurationNotice: $$.overlay.ttsConfigurationRecovery, replaceNotice: $$.overlay.replaceRecovery,
          replaceNoticeVisible: $$.overlay.replaceRecovery.visible && $$.view.preferenceModule() !== 'replace',
          inputCurrent: (): boolean => $$.actors.recovery.inputCurrent(),
          bookmarkCurrent: (identity: string): boolean => identity === $$.actors.recovery.bookmarkIdentity(),
          offlineCurrent: (identity: string): boolean => identity === $$.actors.recovery.offlineIdentity(),
          onBookmarkAction: (identity: string, continuing: boolean): void => $$.actors.recovery.reconcileBookmarks(identity, continuing),
          onOfflineAction: (identity: string, generation: number, presentation: string, continuing: boolean): void =>
            $$.actors.recovery.reconcileOffline(identity, generation, presentation, continuing),
          onReaderNoticeAction: (generation: number): void => $$.actors.recovery.reconcile(generation),
          onPreferenceNoticeAction: (domain: 'settings' | 'tts', generation: number): void => {
            if (domain === 'settings') $$.actors.preferences.retryReaderSettingsRecovery(generation);
            else $$.actors.speech.retryPreferences(generation);
          },
          onAppearanceNoticeAction: (generation: number): void => $$.actors.preferences.retryAppearanceSaveRecovery(generation),
          onTtsConfigurationNoticeAction: (generation: number): void => $$.actors.speech.openTtsConfigurationRecovery(generation),
          onReplaceNoticeAction: (generation: number): void => $$.actors.controls.openReplaceRecovery(generation),
        });
      }
    }
    .width('100%')
    .height('100%')
    .id('reader-reading-stage')
    .customProperty(READER_LAYOUT_READING_PAPER, READER_LAYOUT_DEBUG_BUILD ? $$.actors.viewport.visibleReadingAppearance().activeTheme : undefined)
    .focusable(true)
    .defaultFocus(true)
    .onKeyEvent((event: KeyEvent): boolean => $$.actors.input.key(event))
    .attributeModifier(new ReaderSmartGestureShortcut($$.view.smartGesturesEnabled()))
    .onAppear((): void => $$.actors.input.sync())
    .clip(true)
    .onTouch((event: TouchEvent): void => $$.actors.controlGeometry.onBackdropTouch(event))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const lifecycleToken = $$.actors.mount.lifecycleToken;
      if (!$$.actors.mount.isSessionActive(lifecycleToken)) {
        return;
      }
      const width = $$.actors.viewport.numericAreaLength(newValue.width);
      const height = $$.actors.viewport.numericAreaLength(newValue.height);
      $$.actors.viewport.admitReaderViewportSize(width, height, lifecycleToken);
      $$.actors.controls.publishControlVerificationReady();
    });
  }
