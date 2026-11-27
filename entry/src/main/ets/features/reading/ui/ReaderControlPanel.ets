import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { readerKeyboardViewport } from '../../../ui/layout/ReaderKeyboardGeometry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { ReaderInsetsVp, ReaderRectVp, readerVisualSafeBottom, readerVisualSafeRight, readerVisualSafeTop } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { READER_FULL_PANEL_TOP, readerControlIslandHeight, type ReaderControlContentBudget } from './ReaderLayoutGeometry';
import { measureReaderControlMinimum, readerControlModuleFactsGeometryKey, readerControlModuleFactsDisplayEqual,
  type ReaderControlHomeFormProfile, type ReaderControlMeasuredProfile,
  type ReaderControlMeasuredProfileReader, type ReaderControlModuleFacts, type ReaderControlPreparedModuleProfile,
  type ReaderControlPresentationReceipt } from './ReaderControlMinimumMeasurement';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision, ReaderSurfaceMaterialRole } from '../../../app/HarmonyCapabilityPolicy';
import { applyReaderPopupMaterial, defaultNavigationPreferences, ReaderModalScrimModifier,
  readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderControlChapterProgressCard } from './ReaderControlChapterProgressCard';
import { ReaderControlModuleNavigation, type ReaderControlNavigationModule } from './ReaderControlModuleNavigation';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderReadingTopBar, readerReadingTopBarHeight } from '../../../ui/chrome/ReaderReadingTopBar';
import { TYPE_READER_CONTROL_BOOK_TITLE, TYPE_READER_CONTROL_CHAPTER_SOURCE, TYPE_READER_CONTROL_COLLAPSE_INTER, TYPE_READER_CONTROL_COLLAPSE_UI, TYPE_READER_CONTROL_COLLAPSE_TTS, TYPE_READER_CONTROL_HEADER_INTER, TYPE_READER_CONTROL_HEADER_UI, type ReaderTextStyle } from '../../../ui/foundation/ReaderTypography';
import { TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL, TYPE_READER_CONTROLS_RETAINED_CONTROL_HEADER_COLLAPSE, TYPE_READER_CONTROLS_RETAINED_CONTROL_HEADER_VALUE, TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL, TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL, TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY } from '../../../ui/foundation/ReaderTypography';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerTtsWaveformSnapshot } from './ReaderTtsWaveform';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import { ReaderSessionLaunchStage } from './ReaderSessionLaunchStage';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerControlIsDirectSheet } from './ReaderControlHostSession';
import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import type { ReaderSessionCapsuleState, ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { PopupSurfaceSpec, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderControlMotionFrameCache } from './ReaderControlMotionGeometry';
import { readerControlPlaybackProfileMatches, readerControlPlaybackSourceKindMatches, type ReaderControlPlaybackProfileData,
  type ReaderControlPlaybackProfileReader, type ReaderControlPlaybackProfileReceipt,
  type ReaderControlPlaybackLaunchProfile } from './ReaderControlPlaybackProfile';
import { FrameCallback } from '@kit.ArkUI';
import { readerControlMotionMs, sampleReaderControlMorphProgress } from './ReaderControlMotionPolicy';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderControlVerificationMotion, readReaderControlNativeActor, readReaderControlPopupOwner,
  type MotionActor, type ReaderControlPopupOwnerObservation, type ReaderControlVerificationLayoutInputs } from './ReaderControlVerificationMotion';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationRequest, ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_DISMISS_MS } from '../../../ui/foundation/ProductMotionTiming';
import { registerReaderFonts, prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { ReaderControlRuntime, type ReaderControlRuntimeUpdate } from './ReaderControlRuntime';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import hilog from '@ohos.hilog';
import type { ReaderControlGestureConfig } from './ReaderControlGestureDriver';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import type { ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from '../application/ReaderAppearanceState';
import { ReaderControlSettingsContent } from './ReaderControlSettingsContent';
import {
  createDefaultReaderSettingsSnapshot,
  readerPageTurnStyle,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
  type ReaderWidePageLayout,
} from '../application/ReaderSettingsState';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import type { ReaderTtsConfigurationDraft } from '../application/ReaderTtsConfigurationHost';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import {
  ReaderSessionMorphSourceMeasurement,
  readerSessionMorphActorId,
  type ReaderSessionMorphSourceKind,
} from './ReaderSessionMorphState';
import { createReaderTtsState, type ReaderTtsState, type ReaderTtsTimerMode } from '../application/ReaderTtsState';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { ReaderControlSearchContent } from './ReaderControlSearchContent';
import { ReaderControlReplaceContent } from './ReaderControlReplaceContent';
import { readerControlDirectorySnapshot } from './ReaderControlDirectoryModel';
import { readerControlDirectoryMinimumFacts } from './ReaderControlDirectoryMinimum';
import { readerControlSearchMinimumFacts } from './ReaderControlSearchMinimum';
import { readerControlSettingsMinimumFacts } from './ReaderControlSettingsMinimum';
import { readerControlAppearanceMinimumFacts } from './ReaderControlAppearanceMinimum';
import { readerControlTtsMinimumFacts } from './ReaderControlTtsMinimum';
import { readerControlAutoPageMinimumFacts } from './ReaderControlAutoPageMinimum';
import { readerControlReplaceMinimumFacts } from './ReaderControlReplaceMinimum';
import { readerControlHeaderRole, readerControlHeaderTitle, readerControlHeaderActionLabel,
  readerControlHeaderLayout, readerControlHeaderTargetFrame, readerControlHeaderGrabRegions,
  type ReaderControlHeaderRole, type ReaderControlHeaderLayout } from './ReaderControlHeaderGeometry';
import type { ReaderControlActorFrame } from './ReaderControlActorGeometry';
import type { ReaderControlReplaceHeaderFrame } from './ReaderControlReplaceGeometry';
import type { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import { createReaderControlReplaceState, type ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import type { ReaderReplaceRule, ReaderControlReplaceDraft } from '../application/ReaderReplaceQuickState';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import {
  ReaderControlGeometry,
  READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH,
  READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
  READER_CONTROL_BRIGHTNESS_CONTROL_GAP,
  READER_CONTROL_BRIGHTNESS_ICON_SIZE,
  READER_CONTROL_BRIGHTNESS_ICON_TOP,
  READER_CONTROL_BRIGHTNESS_MAX,
  READER_CONTROL_BRIGHTNESS_MIN,
  READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_BRIGHTNESS_STEP,
  READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH,
  READER_CONTROL_BRIGHTNESS_TRACK_WIDTH,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
  READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT,
  READER_CONTROL_HOME_PROGRESS_ROW_HEIGHT,
  READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP,
  READER_CONTROL_HOME_SHORT_ACTION_HEIGHT,
  READER_CONTROL_HOME_TOP_ROW_HEIGHT,
  READER_CONTROL_TOP_BAR_HEIGHT,
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
  readerControlBrightnessTrackHeight,
} from './ReaderControlGeometry';
import {
  ReaderControlLayoutSnapshot,
  createDefaultReaderControlLayout,
  readerControlExtentFits,
  type ReaderControlCandidateWidths, type ReaderControlCandidateMinimum,
  type ReaderControlModuleMinimum, type ReaderControlModuleMeasurer,
  type ReaderControlContentMeasurer, type ReaderControlContentModule,
} from './ReaderLayoutGeometry';
import { ReaderControlPlacement, readerControlAlignment, readerControlDockLeft,
  type ReaderControlAlignment } from './ReaderControlPlacement';
import { subscribeReaderHoldingHand } from '../../../platform/interaction/HarmonyReaderGrip';
import type { ReaderHoldingHand } from '../../../platform/interaction/ReaderHoldingHand';
import { TYPE_READER_CONTROL_CHAPTER_TITLE, TYPE_READER_CONTROL_SOURCE_ACTION } from '../../../ui/foundation/ReaderTypography';

import curves from '@ohos.curves';
import { DEBUG, BUILD_MODE_NAME } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderControlDirectoryContent } from './ReaderControlDirectoryContent';
import { ReaderControlAppearanceContent, type ReaderControlFontOrderPresentation } from './ReaderControlAppearanceContent';
import type { ReaderControlPage } from './ReaderControlRouting';
import { ReaderContentSearchPublication } from '../presentation/ReaderContentSearchPublication';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import {
  copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation, readerControlTargetLocation,
  readerControlSessionStateEquals,
  sampleReaderControlSession, setReaderControlDirectoryTab,
  collapseReaderControlSession, expandReaderControlSession, toggleReaderControlSession, type ReaderControlLocation,
  type ReaderControlSessionState,
} from './ReaderControlSessionState';
import {
  readerControlMotionAxis, readerControlMotionBounds, readerControlHasFullContentSurface, readerControlHasQuickContentSurface,
  sampleReaderControlMotionComposition,
  type ReaderControlMotionFrame, type ReaderControlMotionBounds,
} from './ReaderControlMotionGeometry';
import { readerControlThemeStyle, type ReaderControlThemeStyle } from './ReaderControlThemeStyle';

interface ReaderControlMenuVerificationFrame {
  frameTimeNs: number;
  menu: MotionActor;
  popupOwner: ReaderControlPopupOwnerObservation;
  trigger?: MotionActor;
  mountedActions: string[];
}

interface ReaderControlMenuNativeState {
  visible: boolean;
  generation: number;
}

interface ReaderControlMenuNativeTrace extends ReaderControlMenuNativeState {
  layout: string;
  frames: ReaderControlMenuVerificationFrame[];
}

export type { ReaderControlPage } from './ReaderControlRouting';
type ReaderQuickAction = 'directory' | 'search' | 'replace';

class ReaderControlFrameCallback extends FrameCallback {
  private callback: (time: number) => void;
  constructor(callback: (time: number) => void) { super(); this.callback = callback; }
  onFrame(time: number): void { this.callback(time); }
  onIdle(_remaining: number): void {}
}

class ReaderControlHeaderLineHeight implements AttributeModifier<TextAttribute> {
  private readonly height: number | undefined;
  constructor(height: number | undefined) { this.height = height; }
  applyNormalAttribute(instance: TextAttribute): void {
    if (this.height !== undefined) instance.lineHeight(this.height);
  }
}

@Component
export struct ReaderControlPanel {
  @StorageLink('readerControlAlignment') @Watch('refreshDockPlacement')
  private manualControlAlignment: string = 'center';
  @StorageLink('readerAppForeground') @Watch('refreshDockPlacement')
  private gripForeground: boolean = true;
  @Prop @Watch('refreshDockPlacement') bodySelectionPossible: boolean = false;
  @State private dockAlignment: ReaderControlAlignment = 'center';
  private readonly placement: ReaderControlPlacement = new ReaderControlPlacement();
  private readonly placementPointers: Set<number> = new Set();
  private gripRequested: boolean = false;
  private holdingHand: ReaderHoldingHand = undefined;
  private unbindHoldingHand: (() => void) | undefined = undefined;
  private placementTimer: number = -1;
  @StorageLink('readerWindowMetricsRevision') @Watch('onEditingWindowChanged') private editingMetricsRevision: number = 0;
  @State @Watch('onEditingOffsetChanged') private editingOffsetY: number = 0;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private onEditingWindowChanged(): void {
    if (!readerControlKeyboardVisible(readerWindowMetrics())) this.editingOffsetY = 0;
    this.editingHost.refresh();
  }
  private onEditingOffsetChanged(): void {
    if (this.runtimeMounted) this.configureRuntime();
    this.editingHost.refresh();
  }
  private presentedDockTop(): number { return this.dockTop() + this.editingOffsetY; }
  private contentEditingHeight(): number {
    const frame = this.frame();
    const host = new ReaderRectVp(this.rootScreenX + this.dockLeft() + frame.content.x,
      this.rootScreenY + this.presentedDockTop() + frame.dock.translateY + frame.content.y,
      frame.content.width, frame.content.height);
    return readerKeyboardViewport(readerWindowMetrics(), host).rect.height;
  }
  private editingRevealRegion(task: ReaderRectVp): ReaderRectVp {
    const frame = this.frame();
    const shell = new ReaderRectVp(this.rootScreenX + this.dockLeft() + frame.shell.x,
      this.rootScreenY + this.presentedDockTop() + frame.dock.translateY + frame.shell.y,
      frame.shell.width, frame.shell.height);
    const viewport = readerKeyboardViewport(readerWindowMetrics(), new ReaderRectVp(this.rootScreenX, this.rootScreenY,
      this.currentLayout().viewportWidth, this.currentLayout().viewportHeight), shell);
    // Compact surfaces that fit above the IME move as one complete surface.
    // A tall Full surface cannot fit there: preserve its task region and let
    // the module allocate input/results/actions inside its visible viewport.
    return viewport.known && viewport.occluded && shell.height <= viewport.rect.height &&
      task.top >= shell.top - .5 && task.top + task.height <= shell.top + shell.height + .5 ? shell : task;
  }
  private mountEditingHost(): void {
    this.editingHost.mount({ current: (): boolean => this.runtimeMounted && this.inputEnabled && !this.controlObscured &&
        this.frame().visibility > 0,
      metrics: readerWindowMetrics,
      viewport: (): ReaderRectVp => new ReaderRectVp(this.rootScreenX, this.rootScreenY,
        this.currentLayout().viewportWidth, this.currentLayout().viewportHeight),
      scroll: (_delta: number): void => {},
      revealRegion: (task: ReaderRectVp): ReaderRectVp => this.editingRevealRegion(task),
      translate: (delta: number): void => {
        const frame = this.frame();
        const limit = Math.max(0, this.rootScreenY + this.dockTop() + frame.shell.y -
          readerKeyboardViewport(readerWindowMetrics(), new ReaderRectVp(this.rootScreenX, this.rootScreenY,
            this.currentLayout().viewportWidth, this.currentLayout().viewportHeight)).rect.top);
        this.editingOffsetY = Math.min(0, Math.max(-limit, this.editingOffsetY - delta));
        this.reportBackdropRegions();
      } });
  }

  @Prop sessionFontScale: number = 1;
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private navigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @Prop @Watch('onLaunchSampleChanged') launchSample: ReaderSessionLaunchSample | undefined = undefined;
  @Prop @Watch('onLaunchSampleChanged') launchGeneration: number = 0;
  @Prop @Watch('onLaunchSampleChanged') launchSourceMinimum: ReaderControlPlaybackLaunchProfile | undefined = undefined;
  @Prop launchSourceKind: ReaderSessionMorphSourceKind = 'quickAutoPage';
  @Prop launchBusinessStatus: ReaderSessionCapsuleState = 'preparing';
  @Prop launchDesiredPlaying: boolean = true;
  @Prop launchCountdown: number = 8;
  @Prop launchStageOpacity: number = 1;
  @Prop launchOwnsControls: boolean = false;
  @Prop @Watch('onRuntimeEnabledChanged') launchRecovering: boolean = false;
  onLaunchSourceReady: (generation: number) => void = (_generation: number): void => {};
  private launchSourceVisibleGeneration: number = 0;
  private launchSourceVisibleKind: ReaderSessionMorphSourceKind | undefined = undefined;
  private launchSourceReadyGeneration: number = 0;
  @Prop launchInteractionEnabled: boolean = true;
  @Prop launchSourceTtsState: ReaderTtsState = createReaderTtsState(false);
  @Prop launchSourceAutoStatus: ReaderAutoPageStatus = 'stopped';
  onLaunchToggle: () => void = (): void => {};
  onSessionLaunchShellMeasured: (topExit: number, dockExit: number) => void =
    (_topExit: number, _dockExit: number): void => {};
  private capturedLaunchGeneration: number = 0;
  private launchWaveformSample: ReaderTtsWaveformSample | undefined = undefined;
  private launchContentWidth: number = 286;
  private launchContentHeight: number = 190;
  private launchMotionProgress: number = 0;
  private launchNaturalMinimum: ReaderControlPlaybackProfileReceipt | undefined = undefined;
  private launchMotionBounds: ReaderControlMotionBounds | undefined = undefined;
  private launchFullContentHeight: number = 666;
  private capturedLaunchSourceKind: ReaderSessionMorphSourceKind = 'quickAutoPage';
  private launchFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();

  private onLaunchSampleChanged(): void {
    this.refreshDockPlacement();
    if (this.launchSample === undefined) {
      this.launchNaturalMinimum = undefined;
      this.launchMotionBounds = undefined;
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
      return;
    }
    if (this.capturedLaunchGeneration === this.launchGeneration) return;
    const bundleRequired = this.minimumIdentity.length > 0;
    const source = this.launchSourceMinimum;
    if (bundleRequired && (source === undefined || source.generation !== this.launchGeneration ||
      !readerControlPlaybackSourceKindMatches(source.kind, this.launchSample.type))) return;
    const receipt = bundleRequired ? source?.receipt : undefined;
    const naturalContract = bundleRequired && source?.requiresNaturalProfile === true;
    if (bundleRequired && source?.requiresNaturalProfile === false && receipt !== undefined) return;
    if (naturalContract && (receipt === undefined || receipt.metricsRevision !== this.minimumMetricsRevision ||
      !readerControlPlaybackProfileMatches(receipt, this.launchSample.type,
      receipt.identity, receipt.key, receipt.metricsRevision))) return;
    this.capturedLaunchGeneration = this.launchGeneration;
    this.launchWaveformSample = readerTtsWaveformSnapshot();
    if (this.launchSourceVisibleGeneration !== this.launchGeneration) {
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
    }
    this.launchNaturalMinimum = naturalContract ? receipt : undefined;
    this.capturedLaunchSourceKind = bundleRequired && source !== undefined ? source.kind : this.launchSourceKind;
    this.launchMotionProgress = naturalContract && source !== undefined ?
      (source.kind === 'fullTtsPlayback' || source.kind === 'fullAutoPagePlayback' ? 1 : 0) : this.contentMotionProgress;
    const measuredBounds = this.fixedIsland ? undefined : this.launchNaturalMinimum?.bounds;
    this.launchMotionBounds = measuredBounds ?? readerControlMotionBounds(this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget);
    const endpoint = sampleReaderControlMotionComposition({ visibilityProgress: 1,
      expansionProgress: this.launchMotionProgress }, this.launchMotionBounds);
    this.launchContentWidth = this.fixedIsland ? this.launchSample.sourceWidth :
      this.launchNaturalMinimum === undefined ? this.contentMotionWidth : endpoint.content.width;
    this.launchContentHeight = this.fixedIsland ? this.launchSample.sourceHeight :
      this.launchNaturalMinimum === undefined ? this.contentMotionHeight : endpoint.content.height;
    this.launchFullContentHeight = this.launchNaturalMinimum?.fullContentHeightVp ?? this.contentEndpointHeight(true);
    this.confirmLaunchSourceReady();
  }

  @Prop controlThemeStyle: ReaderControlThemeStyle = readerControlThemeStyle('day');
  @Link @Watch('onControlSessionChanged') controlSession: ReaderControlSessionState;
  // Keep clock/gesture decisions local. Only the scalars used by an actor
  // invalidate its observers; a MOVE must not invalidate the module branch.
  private visualSession: ReaderControlSessionState = createReaderControlSessionState();
  @State private visualExpansionProgress: number = 0;
  @State private visualVisibilityProgress: number = 0;
  @State private controlActorsRetained: boolean = false;
  @State private visualHeldPointerId: number = -1;
  @State private visualTransitionKind: string = '';
  @State private motionOffsetY: number = 0;
  // Module arguments observe only their own pose, not shell visibility/offset.
  @State private contentMotionProgress: number = 0;
  @State private contentMotionWidth: number = 286;
  @State private contentMotionHeight: number = 190;
  private runtime: ReaderControlRuntime | undefined = undefined;
  private inputClock: ReaderPageInputClock = new ReaderPageInputClock();
  private inputMoveCount: number = 0;
  private inputResetCount: number = 0;
  private inputDownTime: number = 0;
  private inputLastMoveTime: number = 0;
  private diagnosticControlMoveLogged: boolean = false;
  private diagnosticMinimumIdentity: string = '';
  private diagnosticMinimumModule: string = '';
  private diagnosticMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private diagnosticBindGeneration: number = 0;
  private diagnosticReadyEvents: number = 0;
  private diagnosticTemporaryEvents: number = 0;
  private temporaryInputScope: string = '';
  private temporaryInputKind: ReaderControlTemporaryInputKind = '';
  private endInlineEditing: (() => void | Promise<void>) | undefined = undefined;
  private runtimeMounted: boolean = false;
  verificationSession: ReaderControlVerificationSession | undefined = undefined;
  private verifiedSearchResultScope: number = 0;
  private verifiedSearchResultCount: number = 0;
  private verificationMotion: ReaderControlVerificationMotion | undefined = undefined;
  private verificationPointerFramePending: boolean = false;
  private verificationPointerStartY: number | undefined = undefined;
  private verificationMenuTicket: number = 0;
  private verificationPopupOwnerId: number = -1;
  private verificationLayerGeneration: number = 0;
  private pendingRuntimeFrame: boolean = false;
  private pendingRuntimeTicket: number = -1;
  private runtimeLifecycle: number = 0;
  private rootScreenX: number = 0;
  private rootScreenY: number = 0;
  // Keep the last visible content actor mounted after a dismiss reaches the
  // hidden endpoint. Switching a large module tree to the default hidden
  // directory in that same frame can force List/TextInput reconstruction while
  // the dock opacity reaches zero, which is the black-frame seam seen on fast
  // physical compositors. Update this presentation route only when its four
  // semantic values change, never for a new motion sample.
  @State private lastVisibleContentLocation: ReaderControlLocation = {
    level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick',
  };
  @Prop @Watch('onRuntimeEnabledChanged') inputEnabled: boolean = true;
  inputCurrent: (() => boolean) | undefined = undefined;
  @Prop @Watch('onRuntimeEnabledChanged') controlObscured: boolean = false;
  @Prop @Watch('syncProgressInput') controlOpenRevision: number = 0;
  @Prop @Watch('onMinimumIdentityChanged') minimumIdentity: string = '';
  @Prop @Watch('onCommittedMinimumIdentityChanged') minimumCommittedIdentity: string = '';
  @Prop @Watch('publishMinimumMeasurer') minimumRequestLocation: ReaderControlLocation | undefined = undefined;
  @Prop minimumOwnerKey: string = '';
  @Prop @Watch('onMinimumMetricsChanged') minimumEnvironmentKey: string = '';
  @Prop preparedMinimumRequired: boolean = false;
  @Prop @Watch('onPresentationReceiptChanged') presentationReceipt: ReaderControlPresentationReceipt | undefined = undefined;
  @Prop @Watch('publishSelectedPlaybackProfile') minimumKey: string = '';
  @Prop @Watch('onMinimumMetricsChanged') minimumMetricsRevision: number = -1;
  @Prop @Watch('onMinimumAvailabilityChanged') minimumReady: boolean = true;
  minimumReceiptCurrent?: (key: string) => boolean;
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlContentMeasurer | undefined,
    profileReader?: ReaderControlMeasuredProfileReader, facts?: ReaderControlModuleFacts, factsGeometryKey?: string) => void =
    (_identity: string, _measurer: ReaderControlContentMeasurer | undefined,
      _profileReader?: ReaderControlMeasuredProfileReader, _facts?: ReaderControlModuleFacts, _factsGeometryKey?: string): void => {};
  onSessionRequest: ((next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin) => void) | undefined = undefined;
  private moduleMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private moduleMinimumProfileReader: ReaderControlPlaybackProfileReader | undefined = undefined;
  onPlaybackProfileSelected: (receipt: ReaderControlPlaybackProfileReceipt) => void =
    (_receipt: ReaderControlPlaybackProfileReceipt): void => {};
  private moduleMinimumIdentity: string = '';
  private moduleMinimumModule: string = '';
  private minimumFontsReady: boolean = false;
  private readonly minimumProfiles: Map<string, ReaderControlMeasuredProfile> = new Map();
  private minimumProfileTicket: string = '';
  private minimumFactsSignature: string = '';
  private adoptedPresentationGeometry: string = '';
  private minimumOwnerFactsSignature: string = '';
  private minimumOwnerFacts: ReaderControlModuleFacts | undefined = undefined;
  private publishedMinimumFacts: ReaderControlModuleFacts | undefined = undefined;
  private localMinimumFacts: ReaderControlModuleFacts | undefined = undefined;
  private preparedInputSource: ReaderControlPreparedModuleProfile | undefined = undefined;
  private preparedInputScope: string = '';
  private preparedInputProfile: ReaderControlPreparedModuleProfile | undefined = undefined;
  private directoryMinimumFactsCache: ReaderControlModuleFacts | undefined = undefined;
  private directoryMinimumEntries: LocalReadingTocEntry[] | undefined = undefined;
  private directoryMinimumBook: ReaderBookIdentity | undefined = undefined;
  private directoryMinimumInputs: string = '';
  private readonly minimumProfileReader: ReaderControlMeasuredProfileReader =
    (key: string): ReaderControlMeasuredProfile | undefined => this.minimumProfiles.get(key);
  @Prop @Watch('dismissMoreMenu') dismissTemporaryRevision: number = 0;
  @Prop retireTemporaryRevision: number = 0;
  @Prop @Watch('onTemporaryLayerActivityChanged') temporaryLayerKind: ReaderControlTemporaryInputKind = '';
  onTemporaryLayerChange: (active: boolean, kind?: ReaderControlTemporaryInputKind) => void = (_active: boolean, _kind?: ReaderControlTemporaryInputKind): void => {};
  /** Non-reactive telemetry path for system-back/close decisions mid-motion. */
  onVisualSessionChange: (state: ReaderControlSessionState) => void =
    (_state: ReaderControlSessionState): void => {};
  onInputActivity: () => void = (): void => {};
  onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean) => void =
    (_regions: ReaderControlBackdropRect[], _ready: boolean): void => {};
  @Prop bookTitle: string = '';
  @Prop @Watch('publishMinimumMeasurer') chapterTitle: string = '';
  @Prop @Watch('onMinimumFactsPropsChanged') sourceId: string = '';
  @Prop sourceBookId: string = '';
  @Prop sourceName: string = '';
  @Prop progressPercent: number = 0;
  @Prop @Watch('publishMinimumMeasurer') totalChapters: number = 0;
  @Prop @Watch('onMinimumFactsPropsChanged') readableChapterPosition: number = -1;
  @Prop @Watch('onLayoutChanged') layout: ReaderControlLayoutSnapshot = createDefaultReaderControlLayout();
  tocEntries: LocalReadingTocEntry[] = [];
  directoryPublication: ReaderDirectoryDataPublication | undefined = undefined;
  @Prop @Watch('onMinimumFactsPropsChanged') directoryEntriesRevision: number = 0;
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.directoryPublication?.entriesAt(this.directoryEntriesRevision) ?? this.tocEntries;
  }
  @Prop @Watch('onMinimumFactsPropsChanged') catalogComplete: boolean = true;
  @Prop @Watch('onMinimumFactsPropsChanged') catalogLoading: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') catalogLoadFailed: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') catalogChapterCount: number = 0;
  @Prop @Watch('onMinimumFactsPropsChanged') catalogCurrentPosition: number = -1;
  onRequireCompleteCatalog: () => void = (): void => {};
  @Prop @Watch('onMinimumFactsPropsChanged') currentChapterIndex: number = -1;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop mangaSearch: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') bookmarkLoadFailed: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') bookmarkLoadMessage: string = '';
  @Prop bookmarkRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onRetryBookmarkLoad: () => void = (): void => {};
  @Prop @Watch('onMinimumFactsPropsChanged') searchQuery: string = '';
  searchPublication: ReaderContentSearchPublication = new ReaderContentSearchPublication();
  @Prop @Watch('onMinimumFactsPropsChanged') searchRevision: number = 0;
  @Prop brightnessPercent: number = 100;
  @Prop brightnessAutomatic: boolean = true;
  @Prop directSheetRedesign: boolean = false;
  @Prop fixedIsland: boolean = false;
  @Prop @Watch('onPageBookmarkStatusChanged') pageBookmarkStatus: 'unknown' | 'empty' | 'bookmarked' = 'unknown';
  @Prop pageBookmarkEnabled: boolean = false;
  onTogglePageBookmark: () => void = (): void => {};
  @State private pageBookmarkFill: number = 0;
  @State private pageBookmarkTuck: number = 1;
  @State private moduleMotionX: number = 0;
  @State private moduleMotionY: number = 0;
  @State private moduleMotionOpacity: number = 1;
  @State private visualDirectSheet: boolean = false;
  @State private directSheetClosing: boolean = false;
  private directSheetReceipt: ReaderControlPresentationReceipt | undefined = undefined;
  private directBudgetSource: ReaderControlContentBudget | undefined = undefined;
  private directBudget: ReaderControlContentBudget | undefined = undefined;
  private directBudgetAvailable: number = 0;
  private modulePaintKey: string = '';
  @Prop @Watch('onBrightnessConfirmed') brightnessRevision: number = 0;
  @Prop @Watch('onMinimumFactsPropsChanged') autoPageStatus: ReaderAutoPageStatus = 'stopped';
  @Prop autoPageSpeedSeconds: number = 8;
  @Prop autoPageTimerMinutes: number = 15;
  @Prop autoPageTimerSeconds: number = 0;
  @Prop @Watch('onMinimumFactsPropsChanged') autoPageTimerSummaryText: string = '15:00';
  @Prop autoPageFollowHighlight: boolean = true;
  @Prop @Watch('onMinimumFactsPropsChanged') controlReplaceState: ReaderControlReplaceState = createReaderControlReplaceState();
  @Prop @Watch('onMinimumFactsPropsChanged') appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionIdentity: string = '';
  @Prop @Watch('onMinimumFactsPropsChanged') chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop @Watch('onMinimumFactsPropsChanged') settingsSnapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @Prop widePageLayout: ReaderWidePageLayout = 'spread';
  /** Native simulation capability for this mounted reading session. */
  @Prop pageTurnSimulationAvailable: boolean = true;
  @Prop @Watch('onMinimumFactsPropsChanged') ttsState: ReaderTtsState = createReaderTtsState(false);
  @Prop @Watch('onMinimumFactsPropsChanged') ttsTimerMode: ReaderTtsTimerMode = 'duration';
  @Prop @Watch('onMinimumFactsPropsChanged') ttsTimerMinutes: number = 25;
  @Prop @Watch('onMinimumFactsPropsChanged') ttsTimerSeconds: number = 0;
  @Prop ttsFollowHighlight: boolean = true;
  @Prop ttsPauseOnInterruption: boolean = true;
  @Prop @Watch('onMinimumFactsPropsChanged') ttsAllowMixing: boolean = false;
  @Prop ttsBackgroundPlayback: boolean = true;
  @Prop ttsKeepScreenOn: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @Prop @Watch('onMinimumFactsPropsChanged') ttsEngine: string = 'system';
  @Prop @Watch('onMinimumFactsPropsChanged') ttsHttpEngines: ReaderHttpTtsConfig[] = [];
  @Prop ttsConfigurationRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop ttsConfigurationLoading: boolean = false;
  @Prop ttsConfigurationLoadFailed: boolean = false;
  @Prop @Watch('onMinimumFactsPropsChanged') ttsVoiceOptions: ReaderTtsVoiceOption[] = [];
  @Prop @Watch('onMinimumFactsPropsChanged') ttsLanguage: string = 'zh-CN';
  @Prop @Watch('onMinimumFactsPropsChanged') ttsPerson: number = 0;
  @Prop @Watch('onLayoutChanged') reduceMotion: boolean = false;
  onExitReading: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  onSourceSwitch: (focusId?: string) => void = (): void => {};
  @Prop recoveryAvailable: boolean = false;
  @Prop @Watch('onRecoveryIdentityChanged') recoveryIdentity: string = '';
  onOpenRecovery: (identity: string) => void = (_identity: string): void => {};
  onRefreshChapter: () => void = (): void => {};
  onOpenBookInfo: () => void = (): void => {};
  onDownloadBook: () => void = (): void => {};
  @Prop chapterRefreshEnabled: boolean = false;
  @Prop bookDownloadEnabled: boolean = false;
  @Prop bookDownloadActive: boolean = false;
  @State private moreMenuVisible: boolean = false;
  @State private moreTopAnchor: ReaderRectVp | undefined = undefined;
  @State private moreShortAnchor: ReaderRectVp | undefined = undefined;
  private moreMenuGeneration: number = 0;
  private moreMenuRecoveryIdentity: string = '';
  private previousTopBarVisibility: boolean = true;
  private moreMenuMeasuredWidth: number = 0;
  private moreMenuWidthKey: string = '';
  private moreMenuOwnerScope: string = '';
  onPageChange: (page: ReaderControlPage, origin: ReaderControlVerificationOrigin) => void =
    (_page: ReaderControlPage, _origin: ReaderControlVerificationOrigin): void => {};
  onModuleSelect: (module: string) => void = (_module: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  // Bookmark tab precise-anchor wiring: undefined keeps the panel's legacy
  // chapter-start fallback, so this stays a zero-regression opt-in.
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined =
    undefined;
  // Static per-session book identity for stable bookmark ids; plain member by
  // contract (the identity never changes while the session is mounted).
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onPreviousChapter: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onProgressChange: (percent: number) => void = (_percent: number): void => {};
  onBrightnessCancel: () => void = (): void => {};
  onBrightnessChange: (percent: number) => void = (_percent: number): void => {};
  onBrightnessAuto: () => void = (): void => {};
  onSearchQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onSearchLoadMore: () => void = (): void => {};
  onSearchNeedMore: () => void = (): void => {};
  onSearchResultSelect: (result: ReadingContentSearchResult, scope: number, ordinal: number) => void =
    (_result: ReadingContentSearchResult, _scope: number, _ordinal: number): void => {};
  onAutoPageToggle: () => void = (): void => {};
  onAutoPageStop: () => void = (): void => {};
  onAutoPageSlowDown: () => void = (): void => {};
  onAutoPageSpeedUp: () => void = (): void => {};
  onAutoPageFullTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onAutoPageFullSpeedChange: (seconds: number, onDeclined?: () => void) => void =
    (_seconds: number, onDeclined?: () => void): void => { onDeclined?.(); };
  onAutoPageFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onOpenReplace: () => void = (): void => {};
  onReloadControlReplace: (operationId?: string) => Promise<void> = async (): Promise<void> => {};
  onSaveControlReplace: (draft: ReaderControlReplaceDraft) => Promise<void> =
    async (_draft: ReaderControlReplaceDraft): Promise<void> => {};
  onToggleControlReplace: (rule: ReaderReplaceRule, value: boolean) => Promise<void> =
    async (_rule: ReaderReplaceRule, _value: boolean): Promise<void> => {};
  onDeleteControlReplace: (rule: ReaderReplaceRule) => Promise<void> =
    async (_rule: ReaderReplaceRule): Promise<void> => {};
  onPreviewControlReplace: () => Promise<ReaderReplacePreview> = async (): Promise<ReaderReplacePreview> => {
    throw new Error('当前章节预览尚未就绪');
  };
  onImportControlReplace: () => Promise<void> = async (): Promise<void> => {};
  onExportControlReplace: () => Promise<void> = async (): Promise<void> => {};
  onAppearanceThemeChange: (theme: ReaderAppearanceTheme) => void =
    (_theme: ReaderAppearanceTheme): void => {};
  onAppearanceDayThemeChange: (theme: ReaderAppearanceTheme) => void =
    (_theme: ReaderAppearanceTheme): void => {};
  onAppearanceNightThemeChange: (theme: ReaderAppearanceTheme) => void =
    (_theme: ReaderAppearanceTheme): void => {};
  onAppearanceFontChange: (font: ReaderAppearanceFont) => void =
    (_font: ReaderAppearanceFont): void => {};
  onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => ReaderControlFontOrderPresentation =
    (_fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
      ({ displayed: Promise.resolve(false), retire: (): void => {}, current: (): boolean => false });
  onAppearanceFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onAppearanceMotionActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onAppearanceCustomFontImport: () => void = (): void => {};
  onAppearanceIndentRequest: (indent: ReaderAppearanceIndent) => void =
    (_indent: ReaderAppearanceIndent): void => {};
  onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string) => void =
    (_mode: ReaderChineseConversionMode): void => {};
  onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean) => void =
    (_key: ReaderSettingsToggleKey, _value: boolean): void => {};
  onWidePageLayoutChange: (value: ReaderWidePageLayout) => void = (_value: ReaderWidePageLayout): void => {};
  onScreenDirectionChange: (direction: ReaderScreenDirection) => void =
    (_direction: ReaderScreenDirection): void => {};
  onScreenTimeoutChange: (timeout: ReaderScreenTimeout) => void =
    (_timeout: ReaderScreenTimeout): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};
  onTtsToggle: () => void = (): void => {};
  onTtsStop: () => void = (): void => {};
  onTtsPrevious: () => void = (): void => {};
  onTtsNext: () => void = (): void => {};
  onTtsSeek: (sliceIndex: number) => void = (_sliceIndex: number): void => {};
  onTtsRateChange: (rate: number, onDeclined?: () => void) => void =
    (_rate: number, onDeclined?: () => void): void => { onDeclined?.(); };
  onTtsTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode) => void =
    (_minutes: number, _seconds: number, _mode?: ReaderTtsTimerMode): void => {};
  onTtsFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsPauseOnInterruptionChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsBackgroundPlaybackChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsKeepScreenOnChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsFailurePolicyChange: (policy: 'skip' | 'stop') => void =
    (_policy: 'skip' | 'stop'): void => {};
  onTtsVoiceAudition: (language: string, person: number) => Promise<void> =
    (_language: string, _person: number): Promise<void> => Promise.resolve();
  onTtsAuditionStop: () => void = (): void => {};
  onTtsVoiceChange: (language: string, person: number) => void =
    (_language: string, _person: number): void => {};
  onTtsConfigurationOpen: () => void = (): void => {};
  onTtsEngineChange: (engine: string) => Promise<void> = (_engine: string): Promise<void> => Promise.resolve();
  onTtsHttpEnginePut: (config: ReaderTtsConfigurationDraft) => Promise<void> =
    (_config: ReaderTtsConfigurationDraft): Promise<void> => Promise.resolve();
  onTtsHttpEngineDelete: (id: number) => Promise<void> = (_id: number): Promise<void> => Promise.resolve();
  onSessionMorphSourceMeasured: (measurement: ReaderSessionMorphSourceMeasurement) => void =
    (_measurement: ReaderSessionMorphSourceMeasurement): void => {};
  private sessionMorphMeasurementRevision: number = 0;

  private reportSessionMorphSource(
    kind: ReaderSessionMorphSourceKind,
    left: number,
    top: number,
    width: number,
    height: number,
  ): void {
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) ||
      !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    if (this.launchOwnsControls || this.launchRecovering) return;
    this.onSessionLaunchShellMeasured(this.currentLayout().topBarTop + this.currentLayout().topBarHeight,
      this.currentLayout().viewportHeight - this.presentedDockTop() - this.frame().shell.y);
    const frame = this.frame();
    const localLeft = left - this.rootScreenX;
    const localTop = top - this.rootScreenY;
    const clipLeft = this.dockLeft() + frame.content.x;
    const clipTop = this.presentedDockTop() + frame.content.y + frame.dock.translateY;
    const visibleLeft = Math.max(0, clipLeft - localLeft);
    const visibleTop = Math.max(0, clipTop - localTop);
    const visibleRight = Math.min(width, clipLeft + frame.content.width - localLeft);
    const visibleBottom = Math.min(height, clipTop + frame.content.height - localTop);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return;
    this.sessionMorphMeasurementRevision += 1;
    this.onSessionMorphSourceMeasured(new ReaderSessionMorphSourceMeasurement(
      kind,
      readerSessionMorphActorId(kind),
      left - this.rootScreenX,
      top - this.rootScreenY,
      width,
      height,
      this.sessionMorphMeasurementRevision, visibleLeft, visibleTop, visibleRight, visibleBottom,
      this.fixedIsland || kind === 'quickAutoPage' ? 12 : kind === 'fullTtsPlayback' ? 14 : 8,
    ));
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }

  private sourceLabel(): string {
    const label = this.sourceName.trim();
    if (this.isLocalBook()) {
      return label.length > 0 && label !== this.sourceId ? label : '本地书籍';
    }
    return label.length > 0 && label !== this.sourceId ? label : '在线书源';
  }

  private topBarSubtitle(): string {
    const chapter = this.chapterTitle.trim();
    return chapter.length > 0 ? `${chapter} · ${this.sourceLabel()}` : this.sourceLabel();
  }

  @State private progressPreviewPercent: number = -1;
  @State private progressInputRevision: number = 0;
  private progressInputScope: string = '';
  @State private brightnessPreviewPercent: number = -1;
  private appearanceFontReorderActive: boolean = false;
  private brightnessDragStartPercent: number = READER_CONTROL_BRIGHTNESS_MAX;
  private brightnessDragging: boolean = false;
  private brightnessDragCurrent: (() => boolean) | undefined = undefined;
  private brightnessLastEmittedPercent: number = -1;
  private geo: ReaderControlGeometry = new ReaderControlGeometry(false);
  private dockRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0, borderRadius: 24 };
  private dockMeasured: boolean = false;
  private topBarRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };
  // The host stores these as a non-reactive input snapshot. Keep the array and
  // its two rects stable while the motion clock changes; replacing them every
  // VSync needlessly allocates and makes the host reassign the same geometry.
  private readonly backdropRegions: ReaderControlBackdropRect[] = [
    this.dockRect,
    { x: 0, y: 0, width: 0, height: 0, borderRadius: 24 },
  ];
  private readonly expandCurve = curves.cubicBezierCurve(0, 0, 0.58, 1);
  private readonly collapseCurve = curves.cubicBezierCurve(0.42, 0, 1, 1);
  private readonly controlMotionCurve = curves.cubicBezierCurve(0.2, 0, 0, 1);

  aboutToAppear(): void {
    this.mountEditingHost();
    this.runtimeMounted = true;
    this.pageBookmarkFill = this.pageBookmarkStatus === 'bookmarked' ? 1 : 0;
    this.temporaryInputScope = (this.temporaryLayerKind !== '') ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.temporaryLayerKind;
    this.runtimeLifecycle += 1;
    this.runtime = new ReaderControlRuntime(this.runtimeConfig(), readerMotionNowMs);
    this.acceptRuntime(this.runtime.start(this.controlSession));
    this.onRuntimeEnabledChanged();
    registerReaderFonts(this.getUIContext().getFont());
    this.geo = new ReaderControlGeometry(this.isExpanded());
    const lifecycle = this.runtimeLifecycle;
    const families: string[] = [TYPE_READER_CONTROL_BOOK_TITLE.fontFamily,
      TYPE_READER_CONTROL_CHAPTER_SOURCE.fontFamily, TYPE_READER_CONTROL_SOURCE_ACTION.fontFamily,
      TYPE_READER_CONTROL_CHAPTER_TITLE.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontFamily,
      TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL.fontFamily,
      TYPE_READER_CONTROL_HEADER_UI.fontFamily, TYPE_READER_CONTROL_HEADER_INTER.fontFamily,
      TYPE_READER_CONTROL_COLLAPSE_UI.fontFamily, TYPE_READER_CONTROL_COLLAPSE_INTER.fontFamily];
    void Promise.all(families.map((family: string): Promise<void> => prepareReaderFontFamily(family)))
      .then((): void => {
        if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle) return;
        this.minimumFontsReady = true;
        this.publishMinimumMeasurer();
      }).catch((): void => {});
  }

  aboutToDisappear(): void {
    this.quickOrModulePress = '';
    this.quickOrModulePointer = -1;
    this.verificationMotion?.finish('unmounted');
    this.verificationPointerFramePending = false;
    this.verificationMenuTicket += 1;
    this.editingHost.unmount();
    this.dismissMoreMenu();
    this.runtimeMounted = false;
    this.retireDockPlacement();
    this.runtimeLifecycle += 1;
    this.onMinimumMeasurerReady(this.minimumIdentity, undefined);
    this.minimumFontsReady = false;
    this.minimumProfiles.clear();
    this.launchNaturalMinimum = undefined;
    this.launchMotionBounds = undefined;
    this.syncProgressInput();
    this.pendingRuntimeFrame = false;
    this.cancelBrightnessDrag();
    this.runtime?.stop();
    this.onBackdropRegionsChange([], false);
    this.onTemporaryLayerChange(false);
    this.setAppearanceFontReorderActivity(false);
  }

  private runtimeConfig(): ReaderControlGestureConfig {
    return { axis: readerControlMotionAxis(readerControlMotionBounds(this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget),
      this.rootScreenY + this.presentedDockTop()), tapMaxDurationMs: 500, directionSlopVp: 8,
      settleDurationMs: readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.reduceMotion),
      showDurationMs: readerControlMotionMs(READER_CONTROL_OPEN_MS, this.reduceMotion),
      dismissDurationMs: readerControlMotionMs(READER_CONTROL_DISMISS_MS, this.reduceMotion), coordinatedMotion: true };
  }

  private configureRuntime(): void {
    const runtime = this.runtime;
    if (runtime === undefined) return;
    const verification = this.runtimeMounted ? this.verificationSession : undefined;
    const request = verification?.current(this.visualSession);
    const observe = request !== undefined && request.direction === this.visualSession.transition?.kind;
    const update = runtime.configure(this.runtimeConfig(), observe);
    if (update.layoutRebase !== undefined) verification?.observeLayoutRebase(update.session, update.layoutRebase);
    this.acceptRuntime(update);
  }

  private acceptRuntime(update: ReaderControlRuntimeUpdate): void {
    if (!this.runtimeMounted) return;
    const observed = this.verificationSession?.current(this.visualSession);
    if (this.visualSession.epoch !== update.session.epoch) {
      if (observed !== undefined) this.verificationMotion?.finish('interrupted', observed.transitionId);
      else this.verificationMotion?.finish('interrupted');
    }
    this.rememberVisibleContentLocation(update.session);
    const sessionChanged = !readerControlSessionStateEquals(this.visualSession, update.session);
    if (sessionChanged) {
      this.visualSession = update.session;
    }
    const visual = sampleReaderControlSession(update.session);
    const placementInputChanged = this.visualHeldPointerId !== update.session.heldPointerId ||
      this.visualTransitionKind !== (update.session.transition?.kind ?? '');
    // Keep only the lightweight command owner on reading entry. Once opened,
    // retain the actor tree through every close to preserve compositor/input
    // continuity. The first open command itself admits the tree at progress 0.
    if (visual.visibilityProgress > 0 || (update.session.transition?.to.visibilityProgress ?? 0) > 0 ||
      update.session.heldPointerId >= 0) this.controlActorsRetained = true;
    if (this.moreMenuVisible && visual.visibilityProgress <= 0) this.dismissMoreMenu();
    this.visualExpansionProgress = visual.expansionProgress;
    this.visualVisibilityProgress = visual.visibilityProgress;
    this.visualHeldPointerId = update.session.heldPointerId;
    this.visualTransitionKind = update.session.transition?.kind ?? '';
    this.updateModuleMotion(update.session);
    this.motionOffsetY = update.offsetY;
    this.syncProgressInput();
    if (placementInputChanged) this.refreshDockPlacement();
    if (sessionChanged) this.onVisualSessionChange(update.session);
    if (update.endpoint !== undefined) this.commitVisualSession(update.endpoint);
    const f = this.frame();
    if (this.contentMotionProgress !== f.progress) this.contentMotionProgress = f.progress;
    if (this.contentMotionWidth !== f.content.width) this.contentMotionWidth = f.content.width;
    if (this.contentMotionHeight !== f.content.height) this.contentMotionHeight = f.content.height;
    this.dockRect.x = this.rootScreenX + this.dockLeft();
    this.dockRect.y = this.rootScreenY + this.presentedDockTop() + f.shell.y + f.dock.translateY;
    this.dockRect.width = f.shell.width;
    this.dockRect.height = f.shell.height;
    this.reportBackdropRegions();
    this.confirmLaunchSourceReady();
    this.scheduleRuntimeFrame();
  }

  private updateModuleMotion(session: ReaderControlSessionState): void {
    const location = readerControlContentLocation(session);
    const active = `${location.level}:${location.module}`;
    const transition = session.transition;
    const target = readerControlTargetLocation(session);
    const fromDirect = transition?.fromLocation.level === 'secondary' && readerControlIsDirectSheet(transition.fromLocation.module);
    const toDirect = target.level === 'secondary' && readerControlIsDirectSheet(target.module);
    this.visualDirectSheet = toDirect || fromDirect;
    this.directSheetClosing = this.directSheetRedesign && fromDirect && target.level === 'home';
    if (this.directSheetRedesign && !this.visualDirectSheet) this.directSheetReceipt = undefined;
    const previous = this.modulePaintKey;
    this.modulePaintKey = active;
    if (this.reduceMotion) {
      this.moduleMotionX = 0;
      this.moduleMotionY = 0;
      if (fromDirect || toDirect) { this.moduleMotionOpacity = 1; return; }
      if (previous.length > 0 && previous !== active && location.level !== 'hidden' && !previous.startsWith('hidden:')) {
        this.moduleMotionOpacity = 0;
        this.getUIContext().animateTo(readerMotionReducedFadeParam(), (): void => { this.moduleMotionOpacity = 1; });
      }
      return;
    }
    if (transition === undefined || transition.fromLocation.level === 'hidden' || target.level === 'hidden') {
      this.moduleMotionX = 0;
      this.moduleMotionY = 0;
      this.moduleMotionOpacity = 1;
      return;
    }
    const remainder = Math.max(0, 1 - transition.progress);
    const from = transition.fromLocation;
    const slides = from.level === 'secondary' && target.level === 'secondary' &&
      !fromDirect && !toDirect && from.module !== target.module;
    const fromIndex = this.moduleIndex(from.module);
    const toIndex = this.moduleIndex(target.module);
    this.moduleMotionX = slides ? (toIndex < fromIndex ? -1 : 1) * this.currentLayout().fullPanelWidth * remainder : 0;
    const lift = from.level !== target.level && !fromDirect && !toDirect;
    this.moduleMotionY = lift ? (target.level === 'home' ? -14 : 14) * remainder : 0;
    this.moduleMotionOpacity = lift ? 1 - remainder * .24 : 1;
  }

  private moduleIndex(module: string): number {
    if (module === 'autoPage') return 0;
    if (module === 'tts') return 1;
    return module === 'appearance' ? 2 : 3;
  }

  private scheduleRuntimeFrame(): void {
    const runtime = this.runtime;
    if (!this.runtimeMounted || runtime === undefined || !runtime.needsFrame()) return;
    const ticket = runtime.ticket();
    if (this.pendingRuntimeFrame && this.pendingRuntimeTicket === ticket) return;
    const lifecycle = this.runtimeLifecycle;
    this.pendingRuntimeFrame = true;
    this.pendingRuntimeTicket = ticket;
    this.getUIContext().postFrameCallback(new ReaderControlFrameCallback((frameTimeNs: number): void => {
      if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || this.pendingRuntimeTicket !== ticket) return;
      this.pendingRuntimeFrame = false;
      const runtimeTickMs = readerMotionNowMs();
      const update = runtime.frame(runtimeTickMs, ticket, (p: number): number => this.clockSample(p));
      if (update !== undefined) {
        const previous = this.visualSession;
        const verification = this.verificationSession;
        const request = verification?.current(previous);
        // Use the component snapshot preceding this frame's publication. No
        // probe value is fed back to runtime or used to advance its clock.
        if (request !== undefined && previous.transition?.kind === request.direction) {
          this.recordVerificationFrame(request, previous, frameTimeNs, runtimeTickMs, ticket, false);
        }
        if (previous.epoch !== update.session.epoch && update.session.transition !== undefined) {
          verification?.accept('runtime-resume', previous, update.session, this.controlOpenRevision);
        }
        this.acceptRuntime(update);
        if (request !== undefined && previous.transition?.kind === request.direction && this.verificationMotion !== undefined) {
          verification?.observeVisual(update.session, this.visualVisibilityProgress);
          if (update.endpoint !== undefined) {
            const endpoint = update.endpoint;
            const expectedLocation = request.target;
            const trace = this.verificationMotion;
            // Observe native nodes after the normal endpoint publication has
            // reached a following frame. This callback never advances runtime.
            this.getUIContext().postFrameCallback(new ReaderControlFrameCallback((endpointFrameNs: number): void => {
              if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || runtime.ticket() !== ticket ||
                verification?.current(this.visualSession)?.transitionId !== request.transitionId ||
                this.visualSession.transition !== undefined || this.visualSession.location.level !== expectedLocation.level ||
                this.visualSession.location.module !== expectedLocation.module ||
                this.visualSession.location.form !== expectedLocation.form ||
                this.visualSession.location.directoryTab !== expectedLocation.directoryTab) {
                trace.finish('interrupted', request.transitionId);
                return;
              }
              this.recordVerificationFrame(request, endpoint, endpointFrameNs, runtimeTickMs, ticket, true);
              trace.finish('completed', request.transitionId);
            }));
          }
        }
      } else this.scheduleRuntimeFrame();
    }));
  }

  private recordVerificationFrame(request: ReaderControlVerificationRequest, state: ReaderControlSessionState,
    frameTimeNs: number, runtimeTickMs: number, ticket: number, endpoint: boolean): void {
    if (this.verificationMotion === undefined) this.verificationMotion = new ReaderControlVerificationMotion();
    const layout = this.currentLayout();
    const layoutInputs: ReaderControlVerificationLayoutInputs = {
      dockLeftVp: this.dockLeft(), dockTopVp: this.presentedDockTop(), widthVp: layout.fullPanelWidth,
      fullHeightVp: this.controlPanelHeight(), quickHeightVp: this.controlQuickHeight(),
      quickContentHeightVp: this.contentEndpointHeight(false), fullContentHeightVp: this.contentEndpointHeight(true),
      fullContentTopVp: layout.contentBudget === undefined ? 57 : 19 + layout.contentBudget.headerHeightVp + 8,
    };
    this.verificationMotion.sample(request, this.getUIContext(), state, this.contentLocation(),
      frameTimeNs, runtimeTickMs, ticket, this.motionOffsetY, endpoint, layoutInputs,
      this.runtime?.verificationContinuationSlope(),
      state.heldPointerId >= 0 ? this.runtime?.lastPointerY() : undefined,
      state.heldPointerId >= 0 ? this.verificationPointerStartY : undefined,
      this.minimumPresentationAvailable());
  }

  /** The pointer path uses existing touch/render callbacks and never drives the clock. */
  private acceptVerificationGesture(update: ReaderControlRuntimeUpdate, origin: ReaderControlVerificationOrigin): void {
    const previous = this.visualSession;
    const verification = this.verificationSession;
    if (origin === 'grabber-down' && update.session.heldPointerId >= 0) this.verificationPointerStartY = this.runtime?.lastPointerY();
    verification?.accept(origin, previous, update.session, this.controlOpenRevision, update.releaseMotion, update.cancelMotion);
    this.acceptRuntime(update);
    const request = verification?.current(update.session);
    if (request === undefined || update.session.heldPointerId < 0 || this.verificationPointerFramePending) return;
    const lifecycle = this.runtimeLifecycle;
    this.verificationPointerFramePending = true;
    this.getUIContext().postFrameCallback(new ReaderControlFrameCallback((frameTimeNs: number): void => {
      this.verificationPointerFramePending = false;
      const state = this.visualSession;
      const ticket = this.runtime?.ticket();
      if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || ticket === undefined ||
        verification?.current(state)?.transitionId !== request.transitionId || state.heldPointerId < 0) return;
      this.recordVerificationFrame(request, state, frameTimeNs, readerMotionNowMs(), ticket, false);
    }));
  }

  private onLayoutChanged(): void {
    this.refreshDockPlacement();
    this.geo = new ReaderControlGeometry(this.isExpanded());
    this.configureRuntime();
    if (this.previousTopBarVisibility !== this.currentLayout().topBarVisible && this.moreMenuVisible) this.setMoreMenuVisible(false);
    this.previousTopBarVisibility = this.currentLayout().topBarVisible;
    this.onMinimumAvailabilityChanged();
    this.publishSelectedPlaybackProfile();
  }

  private minimumModule(): ReaderControlContentModule {
    const location = this.preparedMinimumRequired ? this.minimumRequestLocation ?? readerControlContentLocation(this.controlSession) : this.contentLocation();
    return location.level === 'secondary' ? location.module : 'home';
  }

  private minimumHeaderInter(module: ReaderControlContentModule): boolean {
    return readerControlHeaderRole(module) === 'plainInter';
  }

  private minimumTitle(module: ReaderControlContentModule, tab: string): string {
    return readerControlHeaderTitle(module, tab);
  }

  private defaultMinimumFacts(): ReaderControlModuleFacts {
    const module = this.minimumModule();
    const location = this.minimumRequestLocation ?? readerControlContentLocation(this.controlSession);
    if (module === 'directory') {
      const inputs = JSON.stringify([this.minimumIdentity, location.directoryTab, this.currentChapterIndex,
        this.catalogComplete, this.catalogChapterCount, this.catalogLoading, this.catalogLoadFailed,
        this.catalogCurrentPosition, this.totalChapters, this.readableChapterPosition, this.mangaSearch,
        this.bookmarkLoadFailed, this.bookmarkLoadMessage]);
      if (this.directoryMinimumFactsCache !== undefined && this.directoryMinimumEntries === this.currentDirectoryEntries() &&
        this.directoryMinimumBook === this.bookmarkIdentity && this.directoryMinimumInputs === inputs) {
        return this.directoryMinimumFactsCache;
      }
      const snapshot = readerControlDirectorySnapshot(this.currentDirectoryEntries(), location.directoryTab, '', true,
        this.currentChapterIndex, this.bookmarkIdentity, { complete: this.catalogComplete,
          chapterCount: this.catalogChapterCount, loading: this.catalogLoading, loadFailed: this.catalogLoadFailed,
          currentPosition: this.catalogCurrentPosition, readableChapterCount: this.totalChapters,
          readablePosition: this.readableChapterPosition }, this.mangaSearch);
      const facts: ReaderControlModuleFacts = { module: module, directory: readerControlDirectoryMinimumFacts({ snapshot: snapshot,
        tab: location.directoryTab, catalogComplete: this.catalogComplete,
        bookmarkLoadFailed: this.bookmarkLoadFailed, bookmarkLoadMessage: this.bookmarkLoadMessage }) };
      this.directoryMinimumEntries = this.currentDirectoryEntries();
      this.directoryMinimumBook = this.bookmarkIdentity;
      this.directoryMinimumInputs = inputs;
      this.directoryMinimumFactsCache = facts;
      return facts;
    }
    if (module === 'search') {
      const state = this.searchPublication.stateAt(this.searchRevision);
      return { module: module, search: readerControlSearchMinimumFacts({ query: this.searchQuery, state: state,
        onlineBook: this.sourceId !== 'local' && (this.sourceId?.length ?? 0) > 0,
        resultScope: this.searchPublication.resultScrollScopeFor(state), retainedLoadMoreFailure: false }) };
    }
    if (module === 'settings') return { module: module, settings: readerControlSettingsMinimumFacts() };
    if (module === 'appearance') return { module: module, appearance: readerControlAppearanceMinimumFacts({
      snapshot: this.appearanceSnapshot, chineseConversionMode: this.chineseConversionMode }) };
    if (module === 'tts') return { module: module, tts: readerControlTtsMinimumFacts({ state: this.ttsState,
      timerMode: this.ttsTimerMode, timerMinutes: this.ttsTimerMinutes, timerSeconds: this.ttsTimerSeconds,
      failurePolicy: this.ttsFailurePolicy, allowMixing: this.ttsAllowMixing, engine: this.ttsEngine,
      httpEngines: this.ttsHttpEngines, voiceOptions: this.ttsVoiceOptions, language: this.ttsLanguage,
      person: this.ttsPerson, ratePreview: -1, serviceTab: '' }) };
    if (module === 'autoPage') return { module: module, autoPage: readerControlAutoPageMinimumFacts({
      status: this.autoPageStatus, timerSummary: this.autoPageTimerSummaryText }) };
    if (module === 'replace') return { module: module, replace: readerControlReplaceMinimumFacts({
      state: this.controlReplaceState, localError: '', layer: '', temporaryTitle: '', full: location.form === 'full' }) };
    return { module: 'home', home: { chapterTitle: this.chapterTitle, totalChapters: this.totalChapters } };
  }

  private presentedHomeChapterTitle(): string {
    return this.preparedMinimumRequired ? this.presentationReceipt?.facts?.home?.chapterTitle ?? '' : this.chapterTitle;
  }

  private presentedHomeTotalChapters(): number {
    return this.preparedMinimumRequired ? this.presentationReceipt?.facts?.home?.totalChapters ?? 0 : this.totalChapters;
  }

  private currentLayout(): ReaderControlLayoutSnapshot {
    const receipt = this.paintedPresentationReceipt();
    return this.preparedMinimumRequired && receipt !== undefined && receipt.ownerKey === this.minimumOwnerKey ? receipt.layout : this.layout;
  }

  private paintedPresentationReceipt(): ReaderControlPresentationReceipt | undefined {
    return this.directSheetClosing ? this.directSheetReceipt ?? this.presentationReceipt : this.presentationReceipt;
  }

  private currentMinimumKey(): string {
    return this.preparedMinimumRequired ? this.paintedPresentationReceipt()?.key ?? '' : this.minimumKey;
  }

  private currentMinimumIdentity(): string {
    return this.preparedMinimumRequired ? this.paintedPresentationReceipt()?.identity ?? '' : this.minimumIdentity;
  }

  private committedMinimumIdentity(): string {
    return this.minimumCommittedIdentity || this.minimumIdentity;
  }

  private preparedMinimum(): ReaderControlPreparedModuleProfile | undefined {
    const prepared = this.minimumPresentationAvailable() ? this.paintedPresentationReceipt()?.prepared : undefined;
    if (prepared === undefined) return undefined;
    const scope = `${this.minimumOwnerKey}|${this.currentMinimumIdentity()}|${this.currentMoreMenuOwnerScope()}`;
    if (this.preparedInputSource !== prepared || this.preparedInputScope !== scope || this.preparedInputProfile === undefined) {
      this.preparedInputSource = prepared;
      this.preparedInputScope = scope;
      this.preparedInputProfile = { identity: prepared.identity, key: prepared.key, moduleData: prepared.moduleData,
        facts: prepared.facts, ownerCurrent: this.controlCallbackGuard() };
    }
    return this.preparedInputProfile;
  }

  private minimumPresentationAvailable(): boolean {
    if (!this.preparedMinimumRequired) return true;
    const receipt = this.paintedPresentationReceipt();
    return receipt !== undefined && receipt.ownerKey === this.minimumOwnerKey &&
      receipt.key === receipt.layout.minimumKey &&
      receipt.profile.identity === receipt.identity && (receipt.profile.module === 'home' ||
        (receipt.prepared !== undefined && receipt.prepared.identity === receipt.identity && receipt.prepared.key === receipt.key));
  }

  private onPresentationReceiptChanged(): void {
    if (!this.minimumPresentationAvailable()) return;
    const receipt = this.presentationReceipt;
    if (receipt === undefined || receipt.identity !== this.committedMinimumIdentity() || receipt.environmentKey !== this.minimumEnvironmentKey) return;
    const location = receipt.location;
    const previous = this.lastVisibleContentLocation;
    if (this.directSheetRedesign && location.level === 'secondary' && readerControlIsDirectSheet(location.module)) {
      this.directSheetReceipt = receipt;
    }
    if (this.directSheetRedesign && location.level === 'home' && previous.level === 'secondary' &&
      readerControlIsDirectSheet(previous.module) && (this.directSheetClosing ||
        this.controlSession.transition?.fromLocation.level === 'secondary' && this.controlSession.transition.toLocation.level === 'home')) return;
    if (location.level !== 'hidden' && (location.level !== previous.level || location.module !== previous.module ||
      location.directoryTab !== previous.directoryTab)) {
      this.lastVisibleContentLocation = { level: location.level, module: location.module,
        directoryTab: location.directoryTab, form: location.form };
    }
    const geometry = `${receipt.identity}|${receipt.environmentKey}|${receipt.key}`;
    if (geometry !== this.adoptedPresentationGeometry) {
      this.adoptedPresentationGeometry = geometry;
      this.onLayoutChanged();
    } else this.publishSelectedPlaybackProfile();
  }

  private onMinimumFactsPropsChanged(): void {
    this.publishMinimumMeasurer();
  }

  private onCommittedMinimumIdentityChanged(): void {
    this.temporaryInputKind = '';
    this.endInlineEditing = undefined;
    this.temporaryInputScope = '';
    if (this.runtimeMounted) this.onTemporaryLayerChange(false);
    this.onPresentationReceiptChanged();
  }

  private onModuleMinimumFactsChanged(identity: string, facts: ReaderControlModuleFacts): void {
    if (!this.runtimeMounted || identity !== this.minimumIdentity || facts.module !== this.minimumModule()) return;
    const defaults = this.defaultMinimumFacts();
    this.minimumOwnerFactsSignature = readerControlModuleFactsGeometryKey(defaults);
    this.minimumOwnerFacts = defaults;
    this.localMinimumFacts = facts;
    this.publishMinimumMeasurer();
  }

  private onMinimumIdentityChanged(): void {
    if (this.moduleMinimumIdentity !== this.minimumIdentity) {
      this.moduleMinimumMeasurer = undefined;
      this.localMinimumFacts = undefined;
      this.minimumOwnerFactsSignature = '';
      this.minimumOwnerFacts = undefined;
      this.publishedMinimumFacts = undefined;
      this.minimumFactsSignature = '';
    }
    this.publishMinimumMeasurer();
  }

  private onMinimumMetricsChanged(): void {
    this.publishMinimumMeasurer();
    this.publishSelectedPlaybackProfile();
    this.onLaunchSampleChanged();
    this.confirmLaunchSourceReady();
  }

  private minimumInputReady(): boolean {
    if (this.preparedMinimumRequired) {
      const receipt = this.presentationReceipt;
      const budget = receipt?.layout.contentBudget;
      const viewport = this.contentMotionProgress === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
      return this.minimumPresentationAvailable() && receipt !== undefined && receipt.identity === this.committedMinimumIdentity() &&
        receipt.environmentKey === this.minimumEnvironmentKey &&
        (this.minimumReceiptCurrent?.(receipt.key) ?? false) && viewport !== undefined && Number.isFinite(viewport) && viewport > 0;
    }
    const ready = this.minimumIdentity.length === 0 ||
      (this.minimumReady && this.minimumKey.startsWith(`${this.minimumIdentity}|`) &&
        (this.minimumReceiptCurrent?.(this.minimumKey) ?? true));
    const budget = this.currentLayout().contentBudget;
    const viewport = this.contentMotionProgress === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
    return ready && (viewport === undefined || Number.isFinite(viewport) && viewport > 0);
  }

  private onMinimumAvailabilityChanged(): void {
    if (DEBUG && this.diagnosticReadyEvents < 32) {
      this.diagnosticReadyEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=ready-changed ready=%{public}s prefix=%{public}s effective=%{public}s input=%{public}s obscured=%{public}s',
        String(this.minimumReady), String(this.minimumKey.startsWith(`${this.minimumIdentity}|`)),
        String(this.minimumInputReady()), String(this.inputEnabled), String(this.controlObscured));
    }
    if (!this.minimumInputReady() || (this.brightnessDragging && this.brightnessDragCurrent?.() === false)) this.cancelBrightnessDrag();
    this.syncProgressInput();
    this.publishSelectedPlaybackProfile();
  }

  private bindModuleMinimum(module: ReaderControlContentModule, identity: string,
    measurer: ReaderControlModuleMeasurer | undefined, profileReader?: ReaderControlPlaybackProfileReader): void {
    if (this.preparedMinimumRequired) return;
    if (DEBUG && this.diagnosticBindGeneration < 32 && (identity !== this.diagnosticMinimumIdentity || module !== this.diagnosticMinimumModule ||
      measurer !== this.diagnosticMinimumMeasurer)) {
      this.diagnosticMinimumIdentity = identity;
      this.diagnosticMinimumModule = module;
      this.diagnosticMinimumMeasurer = measurer;
      this.diagnosticBindGeneration += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=module-bind generation=%{public}d mounted=%{public}s identityMatch=%{public}s moduleMatch=%{public}s hasDelegate=%{public}s',
        this.diagnosticBindGeneration, String(this.runtimeMounted), String(identity === this.minimumIdentity),
        String(module === this.minimumModule()), String(measurer !== undefined));
    }
    if (!this.runtimeMounted || identity !== this.minimumIdentity || module !== this.minimumModule()) return;
    this.moduleMinimumMeasurer = measurer;
    this.moduleMinimumProfileReader = profileReader;
    this.moduleMinimumIdentity = identity;
    this.moduleMinimumModule = module;
    this.publishMinimumMeasurer();
  }

  private publishMinimumMeasurer(): void {
    if (!this.runtimeMounted || !this.minimumFontsReady || this.minimumIdentity.length === 0) return;
    const identity = this.minimumIdentity;
    const module = this.minimumModule();
    if (this.preparedMinimumRequired) {
      const defaults = this.defaultMinimumFacts();
      const ownerSignature = readerControlModuleFactsGeometryKey(defaults);
      if (ownerSignature !== this.minimumOwnerFactsSignature || !readerControlModuleFactsDisplayEqual(defaults, this.minimumOwnerFacts)) {
        this.localMinimumFacts = undefined;
        this.minimumOwnerFactsSignature = ownerSignature;
        this.minimumOwnerFacts = defaults;
      }
      const facts = this.localMinimumFacts ?? defaults;
      const signature = JSON.stringify([identity, this.minimumEnvironmentKey, this.chapterTitle, this.totalChapters,
        readerControlModuleFactsGeometryKey(facts)]);
      if (signature === this.minimumFactsSignature && readerControlModuleFactsDisplayEqual(facts, this.publishedMinimumFacts)) return;
      this.minimumFactsSignature = signature;
      this.publishedMinimumFacts = facts;
      this.moduleMinimumIdentity = identity;
      this.moduleMinimumModule = module;
      this.onMinimumMeasurerReady(identity,
        (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
          if (!this.runtimeMounted || identity !== this.minimumIdentity || signature !== this.minimumFactsSignature ||
            facts !== this.publishedMinimumFacts ||
            module !== this.minimumModule()) return undefined;
          return this.measureControlMinimum(module, widths, key, undefined, undefined, facts);
        }, this.minimumProfileReader, facts, signature);
      return;
    }
    const delegate = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumMeasurer : undefined;
    const profileReader = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumProfileReader : undefined;
    if (module !== 'home' && delegate === undefined) {
      this.onMinimumMeasurerReady(identity, undefined);
      return;
    }
    this.onMinimumMeasurerReady(identity,
      (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
        if (!this.runtimeMounted || identity !== this.minimumIdentity || module !== this.minimumModule()) return undefined;
        return this.measureControlMinimum(module, widths, key, delegate, profileReader);
      });
  }

  private measureHomeForm(width: number): ReaderControlHomeFormProfile | undefined {
    const context = this.getUIContext();
    const title = measureReaderControlText(context, this.chapterTitle,
      TYPE_READER_CONTROL_CHAPTER_TITLE, Math.max(1, width - 106));
    const percent = measureReaderControlText(context, '100%',
      TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL, Math.max(1, width));
    const actionWidth = Math.max(1, (width - 18 - TOK_BORDER_W * 2 - 16) / 3);
    let actionLabelHeight = 13;
    for (const label of ['目录', '搜索', '替换']) {
      const extent = measureReaderControlText(context, label,
        TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL, actionWidth, 'wrap');
      if (extent === undefined) return undefined;
      actionLabelHeight = Math.max(actionLabelHeight, extent.heightVp);
    }
    if (title === undefined || percent === undefined) return undefined;
    const titleHeight = Math.max(34, title.heightVp);
    const chapterHeight = Math.max(54, READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT, titleHeight + 18.563);
    const progressHeight = Math.max(50, READER_CONTROL_HOME_PROGRESS_ROW_HEIGHT, percent.heightVp + 6);
    const actionHeight = READER_CONTROL_HOME_QUICK_ACTION_HEIGHT + actionLabelHeight - 13;
    const percentWidth = Math.max(26.23, percent.singleLineWidthVp);
    const minWidth = Math.max(106, percentWidth + 22 + 18, 24 * 3 + 16 + 18 + TOK_BORDER_W * 2);
    const profile: ReaderControlHomeFormProfile = { chapterTitleHeight: titleHeight,
      chapterRowHeight: chapterHeight, progressHeight: progressHeight, percentWidth: percentWidth,
      actionLabelHeight: actionLabelHeight, actionHeight: actionHeight,
      minimumHeight: Math.max(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
        Math.max(36, titleHeight) + Math.max(44, this.bookmarkPillHeight() + 4, actionLabelHeight + 16) +
        Math.max(36, progressHeight - 14) + TOK_BORDER_W * 2) +
        actionHeight + READER_CONTROL_HOME_SECTION_GAP,
      minWidth: minWidth, fits: width >= minWidth };
    return profile;
  }

  private measureControlMinimum(module: ReaderControlContentModule, widths: ReaderControlCandidateWidths,
    key: string, delegate: ReaderControlModuleMeasurer | undefined,
    profileReader?: ReaderControlPlaybackProfileReader, facts?: ReaderControlModuleFacts): ReaderControlCandidateMinimum | undefined {
    const topBarHeight = readerReadingTopBarHeight(this.getUIContext(), 'reading', READER_CONTROL_TOP_BAR_HEIGHT);
    const availableWithTopBar = this.layout.fullPanelHeight + this.layout.fullPanelTop -
      Math.max(READER_FULL_PANEL_TOP, this.layout.topBarTop + topBarHeight + 8);
    const location = this.preparedMinimumRequired ? this.minimumRequestLocation ?? readerControlContentLocation(this.controlSession) : this.contentLocation();
    const measured = measureReaderControlMinimum({ context: this.getUIContext(), headerInter: this.minimumHeaderInter(module),
      title: this.minimumTitle(module, location.directoryTab), identity: this.minimumIdentity, metricsRevision: this.minimumMetricsRevision,
      topBarHeightVp: topBarHeight, availableWithTopBarHeightVp: availableWithTopBar,
      moduleFacts: facts, preparedMinimumRequired: this.preparedMinimumRequired,
      measureHomeForm: (width: number): ReaderControlHomeFormProfile | undefined => this.measureHomeForm(width) },
      module, widths, key, delegate, profileReader);
    if (measured === undefined) return undefined;
    const ticket = key.slice(0, key.lastIndexOf('|'));
    if (ticket !== this.minimumProfileTicket) {
      const selectedKey = this.currentMinimumKey();
      const selected = this.minimumProfiles.get(selectedKey);
      this.minimumProfiles.clear();
      if (selected !== undefined) this.minimumProfiles.set(selectedKey, selected);
      this.minimumProfileTicket = ticket;
    }
    this.minimumProfiles.set(key, measured.profile);
    return measured.candidate;
  }

  private selectedMinimumProfile(): ReaderControlMeasuredProfile | undefined {
    if (this.preparedMinimumRequired) return this.minimumPresentationAvailable() ? this.presentationReceipt?.profile : undefined;
    return this.minimumKey.length > 0 ? this.minimumProfiles.get(this.minimumKey) : undefined;
  }

  private publishSelectedPlaybackProfile(): void {
    const profile = this.selectedMinimumProfile();
    const module = this.preparedMinimumRequired ? profile?.module : this.minimumModule();
    const identity = this.preparedMinimumRequired ? this.committedMinimumIdentity() : this.minimumIdentity;
    const key = this.currentMinimumKey();
    if (!this.runtimeMounted || !this.minimumReady ||
      (module !== 'tts' && module !== 'autoPage') || profile === undefined || profile.playbackData === undefined ||
      profile.module !== module || profile.identity !== identity ||
      (this.preparedMinimumRequired && (!this.minimumInputReady() || !this.minimumPresentationAvailable())) ||
      (!this.preparedMinimumRequired && profile.metricsRevision !== this.minimumMetricsRevision) || this.currentLayout().minimumKey !== key ||
      !key.startsWith(`${identity}|`) ||
      profile.widths.panelWidthVp !== this.currentLayout().fullPanelWidth) return;
    const facts = this.presentationReceipt?.facts;
    const layout = this.currentLayout();
    const budget = layout.contentBudget;
    if (budget === undefined) return;
    const data: ReaderControlPlaybackProfileData = this.preparedMinimumRequired ? {
      tts: profile.playbackData.tts, autoPage: profile.playbackData.autoPage,
      ttsPlaybackErrorHeight: profile.playbackData.ttsPlaybackErrorHeight,
      ttsFacts: facts?.tts, autoPageFacts: facts?.autoPage,
    } : profile.playbackData;
    const receipt: ReaderControlPlaybackProfileReceipt = { module: module, identity: profile.identity,
      key: key, metricsRevision: this.minimumMetricsRevision, widths: profile.widths,
      data: data, layout: layout,
      // The prepared profile describes the measurement candidate. The
      // visible card and fixed island shell are captured separately at launch.
      bounds: readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight,
        layout.dockBottomGap, layout.quickPanelHeight, budget),
      quickContentHeightVp: budget.quickContentHeightVp, fullContentHeightVp: budget.fullContentHeightVp };
    if (readerControlPlaybackProfileMatches(receipt, module, identity,
      key, this.minimumMetricsRevision)) this.onPlaybackProfileSelected(receipt);
  }

  private homeMetric(name: 'chapterTitleHeight' | 'chapterRowHeight' | 'progressHeight' | 'percentWidth' |
    'actionLabelHeight' | 'actionHeight' | 'minimumHeight', fallback: number): number {
    const profile = this.selectedMinimumProfile();
    if (profile?.quick === undefined || profile.full === undefined) return fallback;
    const p = this.frame().progress;
    const quick = this.homeProfileMetric(profile.quick, name);
    return quick + (this.homeProfileMetric(profile.full, name) - quick) * p;
  }

  private homeProfileMetric(profile: ReaderControlHomeFormProfile, name: string): number {
    if (name === 'chapterTitleHeight') return profile.chapterTitleHeight;
    if (name === 'chapterRowHeight') return profile.chapterRowHeight;
    if (name === 'progressHeight') return profile.progressHeight;
    if (name === 'percentWidth') return profile.percentWidth;
    if (name === 'actionLabelHeight') return profile.actionLabelHeight;
    if (name === 'actionHeight') return profile.actionHeight;
    return profile.minimumHeight;
  }

  private onRuntimeEnabledChanged(): void {
    if (this.moreMenuVisible && (!this.inputEnabled || this.controlObscured)) this.dismissMoreMenu();
    if (this.runtime !== undefined) {
      this.acceptRuntime(this.runtime.setEnabled((this.inputEnabled || this.launchRecovering) && !this.controlObscured));
    }
    this.syncProgressInput();
    if (!this.inputEnabled || this.controlObscured) this.placementPointers.clear();
    this.refreshDockPlacement();
  }

  private onTemporaryLayerActivityChanged(): void {
    this.temporaryInputScope = (this.temporaryLayerKind !== '') ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.temporaryLayerKind;
    if (DEBUG && this.diagnosticTemporaryEvents < 32) {
      this.diagnosticTemporaryEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=temporary-changed active=%{public}s ready=%{public}s input=%{public}s obscured=%{public}s',
        String((this.temporaryLayerKind !== '')), String(this.minimumInputReady()),
        String(this.inputEnabled), String(this.controlObscured));
    }
    if ((this.temporaryLayerKind !== '')) this.cancelBrightnessDrag();
    this.syncProgressInput();
    this.refreshDockPlacement();
  }

  private onControlSessionChanged(): void {
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(this.controlSession));
    if (readerControlContentLocation(this.controlSession).module !== 'appearance' ||
      readerControlContentLocation(this.controlSession).level !== 'secondary') {
      this.setAppearanceFontReorderActivity(false);
    }
  }

  private handleControlTouch(event: TouchEvent): void {
    if (this.fixedIsland) return;
    const runtime = this.runtime;
    if (DEBUG) {
      if (event.type === TouchType.Down) this.diagnosticControlMoveLogged = false;
      if (event.type === TouchType.Down || event.type === TouchType.Up || event.type === TouchType.Cancel ||
        (event.type === TouchType.Move && !this.diagnosticControlMoveLogged)) {
        if (event.type === TouchType.Move) this.diagnosticControlMoveLogged = true;
        hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=control-touch type=%{public}d ready=%{public}s owner=%{public}d input=%{public}s obscured=%{public}s',
          event.type, String(this.minimumInputReady()), runtime?.owner() ?? -1,
          String(this.inputEnabled), String(this.controlObscured));
      }
    }
    if (!this.runtimeMounted || runtime === undefined || !this.inputEnabled || this.controlObscured) return;
    if (event.type === TouchType.Cancel) {
      if (runtime.owner() >= 0) event.stopPropagation();
      this.acceptVerificationGesture(
        runtime.cancel(this.verificationSession?.observing() === true), 'grabber-cancel'); return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      // A successor measurement fences new gestures, not the original
      // pointer's Move/Up/Cancel while its accepted runtime rebases the axis.
      if (this.inputCurrent?.() === false || !this.minimumInputReady()) return;
      if (pointers.length > 0 && runtime.owner() < 0 && this.temporaryLayerKind === '') {
        this.onInputActivity();
        this.inputClock = new ReaderPageInputClock();
        const time = this.inputClock.sample(event.timestamp, readerMotionNowMs());
        if (DEBUG) {
          this.inputMoveCount = 0;
          this.inputResetCount = 0;
          this.inputDownTime = event.timestamp;
          this.inputLastMoveTime = event.timestamp;
        }
        this.acceptVerificationGesture(runtime.down(pointers[0].id, pointers[0].windowY, time), 'grabber-down');
      }
      event.stopPropagation(); return;
    }
    for (const pointer of pointers) {
      if (pointer.id !== runtime.owner()) continue;
      event.stopPropagation();
      const time = this.inputClock.sample(event.timestamp, readerMotionNowMs());
      if (this.inputClock.resetVelocity) runtime.resetInputVelocity(pointer.id, time);
      if (DEBUG) {
        if (this.inputClock.resetVelocity) this.inputResetCount += 1;
        if (event.type === TouchType.Move) {
          this.inputMoveCount += 1;
          this.inputLastMoveTime = event.timestamp;
        }
        if (event.type === TouchType.Up) hilog.info(0xD004, 'ReaderControlInput',
          'UP id=%{public}d y=%{public}f lastY=%{public}f moves=%{public}d resets=%{public}d downNs=%{public}f moveNs=%{public}f upNs=%{public}f progress=%{public}f',
          pointer.id, pointer.windowY, runtime.lastPointerY(), this.inputMoveCount, this.inputResetCount,
          this.inputDownTime, this.inputLastMoveTime, event.timestamp, this.visualExpansionProgress);
      }
      if (event.type === TouchType.Move) this.acceptVerificationGesture(runtime.move(pointer.id, pointer.windowY, time), 'grabber-move');
      if (event.type === TouchType.Up) this.acceptVerificationGesture(
        runtime.up(pointer.id, pointer.windowY, time, this.verificationSession?.observing() === true), 'grabber-release');
      return;
    }
    if (runtime.owner() >= 0) event.stopPropagation();
  }

  @Builder
  private accessibleControlActions() {
    Text('关闭控制栏并返回阅读').width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.controlActionInputEnabled())
      .onClick(this.controlActionHandler((): void => {
        if (this.controlActionInputEnabled()) { this.onInputActivity(); this.onDismiss(); }
      }));
    if (!this.fixedIsland && this.contentLocation().level === 'secondary') {
      Text(this.contentLocation().form === 'full' ? '收回快捷控制栏' : '展开完整控制栏')
        .width(1).height(1).accessibilityRole(AccessibilityRoleType.BUTTON)
        .enabled(this.controlActionInputEnabled() && this.contentInputEnabled())
        .onClick(this.controlActionHandler((): void => {
          if (!this.controlActionInputEnabled() || !this.contentInputEnabled()) return;
          this.onInputActivity();
          this.applySemanticSession(toggleReaderControlSession(this.visualSession,
            readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.reduceMotion)), 'grabber-accessibility');
        }));
    }
  }

  private isExpanded(): boolean { return this.currentLayout().isExpanded(); }

  private motionFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private quickEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private fullEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();

  private onLaunchSourceVisible(kind: ReaderSessionMorphSourceKind): void {
    if (!this.launchRecovering) return;
    const source = this.launchSourceMinimum;
    const expected = source?.generation === this.launchGeneration ? source.kind :
      this.capturedLaunchGeneration === this.launchGeneration ? this.capturedLaunchSourceKind : undefined;
    if (expected !== undefined && kind !== expected) return;
    this.launchSourceVisibleGeneration = this.launchGeneration;
    this.launchSourceVisibleKind = kind;
    this.confirmLaunchSourceReady();
  }

  private launchSourceDetached(type: ReaderSessionCapsuleType): boolean {
    return this.launchSample?.type === type && (this.launchOwnsControls || this.launchRecovering);
  }

  private confirmLaunchSourceReady(): void {
    if (!this.launchRecovering || (this.fixedIsland && (this.launchSourceVisibleGeneration !== this.launchGeneration ||
      this.launchSourceVisibleKind !== this.capturedLaunchSourceKind)) ||
      this.launchSourceReadyGeneration === this.launchGeneration || this.visualVisibilityProgress < 1 ||
      !this.launchSourceCurrent()) return;
    this.launchSourceReadyGeneration = this.launchGeneration;
    this.onLaunchSourceReady(this.launchGeneration);
  }

  private frame(): ReaderControlMotionFrame {
    const launch = this.launchSample;
    if (launch !== undefined && (this.launchOwnsControls || this.launchRecovering)) {
      const heldBounds = this.capturedLaunchGeneration === this.launchGeneration ? this.launchMotionBounds : undefined;
      const bounds = heldBounds ?? readerControlMotionBounds(this.currentLayout().fullPanelWidth,
        this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget);
      const frame = this.launchFrameCache.sample(1, this.launchMotionProgress,
        bounds.width, bounds.fullHeight, bounds.bottomGap, bounds.quickHeight, 0, bounds.contentBudget,
        this.fixedIsland ? 'module' : 'legacy', this.reduceMotion);
      // Recovery shares the existing control Runtime clock. Rebase the actual
      // outgoing offsets rather than flashing at its unrelated hidden endpoint.
      const remainder = this.launchRecovering ? 1 - this.visualVisibilityProgress : 1;
      frame.topBar.translateY = this.reduceMotion ? 0 : launch.topBarOffsetY * remainder;
      frame.dock.translateY = this.reduceMotion ? 0 : launch.dockOffsetY * remainder;
      return frame;
    }
    if (this.directSheetRedesign && this.visualDirectSheet) {
      const layout = this.currentLayout();
      const height = this.controlPanelHeight();
      return this.motionFrameCache.sample(this.visualVisibilityProgress, 1, layout.fullPanelWidth, height,
        this.directSheetBottom(), this.controlQuickHeight(), 0, this.directSheetBudget(layout, height),
        'legacy', this.reduceMotion);
    }
    return this.motionFrameCache.sample(this.visualVisibilityProgress, this.visualExpansionProgress,
      this.currentLayout().fullPanelWidth, this.controlPanelHeight(), this.currentLayout().dockBottomGap,
      this.controlQuickHeight(), this.motionOffsetY, this.currentLayout().contentBudget,
      this.fixedIsland ? (this.contentLocation().level === 'secondary' ? 'module' : 'home') : 'legacy', this.reduceMotion);
  }

  private directSheetBudget(layout: ReaderControlLayoutSnapshot, height: number): ReaderControlContentBudget | undefined {
    const source = layout.contentBudget;
    if (source === undefined) return undefined;
    const safeBottom = layout.isExpanded() ? 0 : readerVisualSafeBottom(readerWindowMetrics());
    const contentHeight = Math.max(0, source.fullContentHeightVp + height - layout.fullPanelHeight - safeBottom);
    if (this.directBudgetSource !== source || this.directBudgetAvailable !== contentHeight) {
      this.directBudgetSource = source;
      this.directBudgetAvailable = contentHeight;
      this.directBudget = {
        key: source.key,
        quickContentHeightVp: source.quickContentHeightVp,
        fullContentHeightVp: contentHeight,
        brightnessContentHeightVp: source.brightnessContentHeightVp,
        navigationHeightVp: source.navigationHeightVp,
        headerHeightVp: source.headerHeightVp,
        brightnessAutoHeightVp: source.brightnessAutoHeightVp,
        brightnessAutoWidthVp: source.brightnessAutoWidthVp,
      };
    }
    return this.directBudget;
  }


  private quickGeometryMode: boolean | undefined = undefined;
  private quickGeometry: ReaderControlGeometry | undefined = undefined;

  private controlPanelHeight(): number {
    if (this.directSheetRedesign && this.visualDirectSheet) {
      const layout = this.currentLayout();
      const safeTop = readerVisualSafeTop(readerWindowMetrics());
      return layout.isExpanded() ? Math.max(0, layout.viewportHeight - this.directSheetBottom() - Math.max(12, safeTop)) :
        Math.min(layout.viewportHeight * .78, Math.max(0, layout.viewportHeight - safeTop));
    }
    if (this.fixedIsland) return readerControlIslandHeight(this.currentLayout().fullPanelHeight);
    if (this.currentLayout().quickPanelHeight !== undefined) return this.currentLayout().fullPanelHeight;
    return Math.min(Math.max(0, this.currentLayout().fullPanelHeight), this.isExpanded() ? 852 : 736);
  }

  private controlQuickHeight(): number {
    if (this.fixedIsland && !this.visualDirectSheet) return this.controlPanelHeight();
    const currentQuickHeight = this.currentLayout().quickPanelHeight;
    if (currentQuickHeight !== undefined) return currentQuickHeight;
    // Both device layouts retain the full 190vp Quick content above the
    // navigation row. Only a genuinely short window limits that endpoint.
    const expanded = this.isExpanded();
    if (this.quickGeometry === undefined || this.quickGeometryMode !== expanded) {
      this.quickGeometry = new ReaderControlGeometry(expanded);
      this.quickGeometryMode = expanded;
    }
    const authored = this.quickGeometry.sheetH;
    return Math.min(Math.max(0, this.controlPanelHeight()), authored);
  }

  private contentEndpointHeight(full: boolean): number {
    if (full && this.directSheetRedesign && this.visualDirectSheet) return this.frame().content.height;
    if (this.fixedIsland) return this.frame().content.height;
    const cache = full ? this.fullEndpointCache : this.quickEndpointCache;
    return cache.sample(1, full ? 1 : 0, this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), 0, this.currentLayout().contentBudget).content.height;
  }

  private clockSample(fraction: number): number {
    const transition = this.visualSession.transition;
    if (transition === undefined) return fraction;
    if (this.reduceMotion) return this.expandCurve.interpolate(fraction);
    const direct = this.directSheetRedesign && (transition.fromLocation.level === 'secondary' &&
      readerControlIsDirectSheet(transition.fromLocation.module) || transition.toLocation.level === 'secondary' &&
      readerControlIsDirectSheet(transition.toLocation.module));
    if (direct || transition.kind === 'navigate') return this.controlMotionCurve.interpolate(fraction);
    if (transition.kind === 'morph') return sampleReaderControlMorphProgress(fraction);
    if (transition.kind === 'dismiss' || transition.kind === 'open') {
      return this.controlMotionCurve.interpolate(fraction);
    }
    const direction = transition.targetProgress - transition.startProgress;
    const visibilityDelta = (transition.to.visibilityProgress - transition.from.visibilityProgress) * direction;
    const expansionDelta = (transition.to.expansionProgress - transition.from.expansionProgress) * direction;
    return (visibilityDelta < 0 || (visibilityDelta === 0 && expansionDelta < 0)) ?
      this.collapseCurve.interpolate(fraction) : this.expandCurve.interpolate(fraction);
  }

  private contentInputEnabled(): boolean {
    // A dismissed Stage intentionally keeps its actor tree mounted for the
    // compositor's retained hidden frame.  Do not leave the cached content
    // slots interactive at that endpoint: requiring the same local visibility
    // sample used by the Stage prevents hidden Lists/TextInputs from receiving
    // events or doing avoidable work while their parent opacity is zero.
    const visibility = this.visualVisibilityProgress;
    const currentOwner = !this.preparedMinimumRequired || this.currentMinimumIdentity() === this.committedMinimumIdentity();
    return !this.directSheetClosing && currentOwner && this.inputEnabled && (this.inputCurrent?.() ?? true) && !this.controlObscured &&
      (this.minimumInputReady() || this.hasCurrentTemporaryInput()) && visibility > 0 &&
      (this.visualTransitionKind === '' || this.visualTransitionKind === 'open') &&
      this.visualHeldPointerId < 0;
  }

  private currentTemporaryInputScope(): string {
    const location = this.contentLocation();
    return JSON.stringify([this.sourceId, this.bookmarkIdentity?.libraryBookId ?? '',
      this.bookmarkIdentity?.bookId ?? this.bookTitle, this.controlOpenRevision,
      location.level, location.module, location.directoryTab]);
  }

  private hasCurrentTemporaryInput(): boolean {
    // Keep an accepted native editor/modal through its own measurement reflow.
    // Metrics, selected key and p are outputs; a successor opening/module is not.
    return (this.temporaryInputKind !== '') && this.temporaryInputScope.length > 0 &&
      this.temporaryInputScope === this.currentTemporaryInputScope();
  }

  private moduleTemporaryLayerHandler(module: string): (active: boolean, kind?: ReaderControlTemporaryInputKind, endEditing?: () => void | Promise<void>) => void {
    const identity = this.currentMinimumIdentity();
    const scope = this.currentTemporaryInputScope();
    return (active: boolean, kind: ReaderControlTemporaryInputKind = 'modal', endEditing?: () => void | Promise<void>): void => {
      if (!this.runtimeMounted || scope !== this.currentTemporaryInputScope() || this.contentLocation().module !== module ||
        (this.preparedMinimumRequired && (identity !== this.committedMinimumIdentity() || identity !== this.currentMinimumIdentity()))) return;
      if (active && !this.minimumInputReady() && !this.hasCurrentTemporaryInput()) return;
      const oldKind = this.temporaryInputKind;
      this.temporaryInputKind = active ? kind : '';
      this.temporaryInputScope = active ? scope : '';
      this.endInlineEditing = active && kind === 'inlineEditor' ? endEditing : undefined;
      this.onTemporaryLayerChange(active, this.temporaryInputKind);
      if (this.verificationSession?.observing() === true && oldKind !== this.temporaryInputKind) {
        if (active) this.verificationLayerGeneration += 1;
        this.verificationSession.layer(module, active, this.verificationLayerGeneration, this.visualSession,
          active ? kind : oldKind);
      }
      if (active && module === 'tts' && this.secondaryModuleInputEnabled('tts')) this.onTtsConfigurationOpen();
    };
  }

  private hasCurrentModalInput(): boolean {
    return this.hasCurrentTemporaryInput() && this.temporaryInputKind !== 'inlineEditor';
  }

  private moduleEditorInputEnabled(module: 'search' | 'directory' | 'tts'): boolean {
    return this.contentLocation().module === module && this.contentInputEnabled() &&
      (this.minimumInputReady() || this.hasCurrentTemporaryInput());
  }


  /**
   * A stable endpoint is the only point at which a gesture-owned visual route
   * is committed back to the semantic host.  Programmatic commands have
   * already updated controlSession before the stage starts, so this callback
   * is mostly for direct handle/accessibility gestures.
   */
  private commitVisualSession(state: ReaderControlSessionState): void {
    if (readerControlSessionStateEquals(this.controlSession, state)) return;
    this.controlSession = copyReaderControlSessionState(state);
  }

  /** Commands and pointer input enter the same runtime before rendering. */
  private applySemanticSession(next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void {
    if (this.preparedMinimumRequired && this.onSessionRequest !== undefined) {
      this.onSessionRequest(next, origin);
      return;
    }
    if (!readerControlSessionStateEquals(this.controlSession, next)) this.controlSession = next;
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(next));
  }

  private rememberVisibleContentLocation(state: ReaderControlSessionState): void {
    const location = readerControlContentLocation(state);
    if (this.directSheetRedesign && location.level === 'home' && state.transition?.fromLocation.level === 'secondary' &&
      readerControlIsDirectSheet(state.transition.fromLocation.module)) return;
    if (this.preparedMinimumRequired && (!this.minimumPresentationAvailable() ||
      this.presentationReceipt?.identity !== this.committedMinimumIdentity() ||
      (location.level === 'secondary' ? location.module : 'home') !== this.presentationReceipt?.profile.module)) return;
    const previous = this.lastVisibleContentLocation;
    if (location.level !== 'hidden' && (location.level !== previous.level ||
      location.module !== previous.module || location.directoryTab !== previous.directoryTab ||
      location.form !== previous.form)) {
      this.lastVisibleContentLocation = location;
    }
  }

  /** Content actor identity retained through the final hidden frame. */
  private contentLocation(): ReaderControlLocation {
    return this.lastVisibleContentLocation;
  }


  private reportBackdropRegions(): void {
    const frame = this.frame();
    const ready = this.dockMeasured && this.topBarRect.width > 0 && !this.controlObscured;
    const topBar = this.backdropRegions[1];
    topBar.x = this.topBarRect.x;
    topBar.y = this.topBarRect.y + frame.topBar.translateY;
    topBar.width = this.topBarRect.width;
    topBar.height = this.topBarRect.height;
    topBar.borderRadius = 24;
    this.onBackdropRegionsChange(this.backdropRegions, ready);
  }

  private requestPage(page: ReaderControlPage, origin: ReaderControlVerificationOrigin = 'module-button'): void {
    this.invalidateProgressInput();
    this.onInputActivity();
    this.onPageChange(page, origin);
  }

  private controlActionInputEnabled(allowInlineEditor: boolean = false, forAppearance: boolean = false): boolean {
    const blockedByTemporaryInput = allowInlineEditor ? this.hasCurrentModalInput() : this.hasCurrentTemporaryInput();
    const moreOwnsInput = this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu';
    return this.runtimeMounted && this.inputEnabled && (this.inputCurrent?.() ?? true) && !this.controlObscured &&
      (!this.preparedMinimumRequired || this.minimumPresentationAvailable()) &&
      (!blockedByTemporaryInput || (forAppearance && this.temporaryInputKind === 'moreMenu')) &&
      (forAppearance || !moreOwnsInput) && this.visualVisibilityProgress > 0 &&
      this.visualHeldPointerId < 0;
  }

  private collapseControl(): void {
    if (!this.controlActionInputEnabled() || this.contentLocation().level !== 'secondary') return;
    if (this.fixedIsland || this.directSheetRedesign && readerControlIsDirectSheet(this.contentLocation().module)) {
      this.requestPage('home');
      return;
    }
    this.onInputActivity();
    // A collapse button can be tapped while a handle transition is still in
    // flight. Retarget from the exact local visual sample, not the sparse host
    // snapshot, so the shape/visibility path never jumps back to its command
    // origin before the runtime applies the module-specific settle timing.
    this.applySemanticSession(collapseReaderControlSession(this.visualSession,
      readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.reduceMotion)), 'header-collapse');
  }

  private navigationIntentPending: boolean = false;
  private async activateModule(module: string): Promise<void> {
    if (this.navigationIntentPending) return;
    let page: ReaderControlPage;
    if (module === 'autoPage') page = 'quickAutoPage';
    else if (module === 'tts') page = 'moduleTts';
    else if (module === 'appearance') page = 'moduleAppearance';
    else if (module === 'settings') page = 'moduleSettings';
    else return;
    const destination: ReaderControlPage = this.isActiveModule(module) ? 'home' : page;
    if (!this.navigationInputEnabled()) return;
    const scope = this.currentTemporaryInputScope();
    this.navigationIntentPending = true;
    try {
      if (this.hasCurrentTemporaryInput() && this.temporaryInputKind === 'inlineEditor') {
        const end = this.endInlineEditing;
        if (end === undefined) return;
        await end();
        if (!this.runtimeMounted || scope !== this.currentTemporaryInputScope() || !this.navigationInputEnabled()) return;
      }
      this.requestPage(destination);
      this.onModuleSelect(destination === 'home' ? 'home' : module);
    } finally { this.navigationIntentPending = false; }
  }

  private promoteSearch(): void { this.requestPage('fullSearch'); }
  private setAppearanceFontReorderActivity(active: boolean): void {
    if (this.appearanceFontReorderActive === active) return;
    this.appearanceFontReorderActive = active;
    this.onAppearanceFontReorderActivityChange(active);
  }

  private contentTitle(): string {
    return readerControlHeaderTitle(this.contentLocation().module, this.contentLocation().directoryTab);
  }

  private listSessionKey(): string {
    return `${this.sourceId}:${this.bookTitle}:${this.controlOpenRevision}`;
  }

  private refreshDockPlacement(): void {
    if (!this.runtimeMounted) return;
    this.syncGripSubscription();
    if (this.placementTimer >= 0) clearTimeout(this.placementTimer);
    this.placementTimer = -1;
    const locked = this.visualHeldPointerId >= 0 || this.visualTransitionKind.length > 0 ||
      this.placementPointers.size > 0 || this.progressPreviewPercent >= 0 || this.brightnessDragging ||
      this.moreMenuVisible || this.temporaryLayerKind !== '' || this.bodySelectionPossible || this.controlObscured ||
      this.launchSample !== undefined || !this.inputEnabled || !this.gripForeground;
    const result = this.placement.update(readerControlAlignment(this.manualControlAlignment),
      this.holdingHand, locked, readerMotionNowMs());
    if (result.alignment !== this.dockAlignment) {
      this.dockAlignment = result.alignment;
      this.dockRect.x = this.rootScreenX + this.dockLeft();
      this.reportBackdropRegions();
      this.editingHost.refresh();
    }
    if (result.settleInMs > 0) {
      this.placementTimer = setTimeout((): void => this.refreshDockPlacement(), Math.ceil(result.settleInMs));
    }
  }

  private syncGripSubscription(): void {
    const layout = this.currentLayout();
    const requested = this.gripForeground && this.inputEnabled && !this.controlObscured && this.isExpanded() &&
      layout.viewportWidth - layout.fullPanelWidth > layout.fullPanelLeftGap + layout.fullPanelRightGap;
    if (requested === this.gripRequested) return;
    this.gripRequested = requested;
    if (requested) {
      this.unbindHoldingHand = subscribeReaderHoldingHand((hand: ReaderHoldingHand): void => {
        this.holdingHand = hand;
        this.refreshDockPlacement();
      });
    } else {
      this.unbindHoldingHand?.();
      this.unbindHoldingHand = undefined;
      this.holdingHand = undefined;
      this.placement.retireGrip();
    }
  }

  private retireDockPlacement(): void {
    this.unbindHoldingHand?.();
    this.unbindHoldingHand = undefined;
    this.gripRequested = false;
    this.holdingHand = undefined;
    this.placement.retireGrip();
    this.placementPointers.clear();
    if (this.placementTimer >= 0) clearTimeout(this.placementTimer);
    this.placementTimer = -1;
  }

  private onDockPlacementTouch(event: TouchEvent): void {
    if (event.type === TouchType.Move) return;
    if (event.type === TouchType.Cancel) {
      this.placementPointers.clear();
    } else {
      for (const touch of event.changedTouches) {
        if (event.type === TouchType.Down) this.placementPointers.add(touch.id);
        else if (event.type === TouchType.Up) this.placementPointers.delete(touch.id);
      }
    }
    this.refreshDockPlacement();
  }

  /** The dock's visual and input geometry share this pane-local origin. */
  private dockLeft(): number {
    const layout = this.currentLayout();
    if (this.directSheetRedesign && this.visualDirectSheet && layout.isExpanded()) {
      return Math.max(0, layout.viewportWidth - layout.fullPanelWidth - Math.max(12, readerVisualSafeRight(readerWindowMetrics())));
    }
    return readerControlDockLeft(layout.viewportWidth, layout.fullPanelWidth, layout.fullPanelLeftGap,
      layout.fullPanelRightGap, this.dockAlignment);
  }

  private dockTop(): number {
    const bottom = this.directSheetRedesign && this.visualDirectSheet ? this.directSheetBottom() : this.currentLayout().dockBottomGap;
    return this.currentLayout().viewportHeight - bottom - this.controlPanelHeight();
  }

  private directSheetBottom(): number {
    return this.currentLayout().isExpanded() ? Math.max(12, readerVisualSafeBottom(readerWindowMetrics())) : 0;
  }

  private directSheetVisible(): boolean {
    return this.directSheetRedesign && this.visualDirectSheet && this.visualVisibilityProgress > 0;
  }

  private directSheetTranslation(): number {
    if (!this.directSheetVisible() || this.reduceMotion) return 0;
    const layout = this.currentLayout();
    return (1 - this.visualExpansionProgress) * (layout.isExpanded() ? layout.viewportWidth - this.dockLeft() :
      this.controlPanelHeight() + this.directSheetBottom());
  }

  private closeDirectSheet(): void {
    if (this.directSheetVisible() && !this.directSheetClosing && this.controlActionInputEnabled()) this.requestPage('home');
  }

  private surfaceMaterial(role: ReaderSurfaceMaterialRole): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision(role, this.navigationPreferences, this.appScheme, this.systemScheme);
  }

  // The production component owns both the clock and every actor builder.
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.controlActorsRetained || this.frame().visibility > 0 || this.launchSample !== undefined) {
      Stack({ alignContent: Alignment.Top }) { this.topBar(); }
        .id('reader-control-motion-topbar')
        .width(this.currentLayout().topBarWidth).height(this.currentLayout().topBarHeight)
        .position({ x: (this.currentLayout().viewportWidth - this.currentLayout().topBarWidth) / 2,
          y: this.currentLayout().topBarTop })
        .translate({ y: this.frame().topBar.translateY }).opacity(this.currentLayout().topBarVisible ? this.frame().topBar.opacity : 0)
        .enabled(!this.directSheetVisible() && this.topBarInputEnabled() && this.frame().topBar.opacity > 0)
        .hitTestBehavior(!this.directSheetVisible() && this.currentLayout().topBarVisible && this.frame().topBar.opacity > 0 ? HitTestMode.Transparent : HitTestMode.None)
        .accessibilityLevel(this.currentLayout().topBarVisible && this.frame().topBar.opacity > 0 && (this.temporaryLayerKind === '' || this.moreMenuVisible) ?
          'auto' : 'no-hide-descendants')
        .onAreaChange((_previous: Area, current: Area): void => {
          this.measureTopBar({ x: Number(current.globalPosition.x),
            y: Number(current.globalPosition.y), width: Number(current.width),
            height: Number(current.height) });
        });
      if (this.directSheetVisible()) {
        Stack().width('100%').height('100%').id('reader-control-direct-sheet-scrim')
          .attributeModifier(new ReaderModalScrimModifier(this.navigationPreferences, this.appScheme,
            readerAppColor('app.scrim.warmModal', this.appScheme), this.surfaceMaterial('controlPanel').native))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
          .opacity(this.visualExpansionProgress)
          .accessibilityLevel('no').onClick((): void => this.closeDirectSheet());
      }
      Stack({ alignContent: Alignment.TopStart }) {
        Stack()
          .id('reader-control-motion-shell')
          .width(this.frame().shell.width).height(this.frame().shell.height)
          .position({ x: 0, y: this.frame().shell.y })
          .attributeModifier(new ReaderPanelFrame('reader', this.appScheme, false, undefined,
            this.frame().visibility > 0 ? this.surfaceMaterial('controlPanel') : undefined))
          .opacity(this.frame().shell.opacity)
          // The shell is a visual actor only.  A full-size Block here steals
          // pointer hit testing from the mounted header/content actors below,
          // so taps such as the collapse action never reach their onClick.
          .hitTestBehavior(HitTestMode.None);
        Stack()
          .id('reader-control-full-content-surface')
          .width(this.frame().contentSurface.width).height(this.frame().contentSurface.height)
          .position({ x: this.frame().contentSurface.x, y: this.frame().contentSurface.y })
          .attributeModifier(new ReaderPanelFrame('reader-full-fill', this.appScheme))
          .opacity(readerControlHasFullContentSurface(this.contentLocation().module) ?
            this.frame().contentSurface.opacity : 0)
          .visibility(Visibility.Visible)
          .enabled(false).hitTestBehavior(HitTestMode.None);
        // Original Quick card (e.g. 924:69) is distinct from FullContentSurface.
        // TTS and Home own their own painted cards, so they are not doubled.
        Stack()
          .id('reader-control-quick-content-surface')
          .width(this.frame().content.width).height(this.frame().content.height)
          .position({ x: this.frame().content.x, y: this.frame().content.y })
          .attributeModifier(new ReaderPanelFrame('reader-quick-fill', this.appScheme))
          .opacity(this.contentLocation().level !== 'home' && readerControlHasQuickContentSurface(this.contentLocation().module) ?
            this.frame().content.opacity * (1 - this.frame().progress) : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) {
          Stack({ alignContent: Alignment.TopStart }) { this.controlContent(); }
            .translate({ x: this.moduleMotionX, y: this.moduleMotionY }).opacity(this.moduleMotionOpacity)
            .width(this.frame().content.width).height(this.frame().content.height)
            .position({ x: 0, y: 0 });
        }
          .width(this.frame().content.width).height(this.frame().content.height)
          .position({ x: this.frame().content.x, y: this.frame().content.y })
          .id('reader-control-motion-content-clip')
          .borderRadius(8 + 4 * this.frame().progress)
          .clip(true).opacity(this.frame().content.opacity)
          .enabled(this.contentInputEnabled())
          .hitTestBehavior(this.frame().visibility > 0 ? HitTestMode.Default : HitTestMode.None);
        // Strokes stay above opaque scrolling rows. Each remains paired with
        // its own source surface rather than borrowing the other actor's rect.
        Stack()
          .id('reader-control-content-outline')
          .width(this.frame().content.width).height(this.frame().content.height)
          .position({ x: this.frame().content.x, y: this.frame().content.y })
          .borderRadius(8 + 4 * this.frame().progress)
          .border({ width: TOK_BORDER_W, color: readerAppColor(this.contentLocation().module === 'settings' &&
            this.frame().progress === 0 ? 'TOK_LINE_STRONG' : 'TOK_LINE', this.appScheme) })
          .opacity(this.contentLocation().level !== 'home' && readerControlHasQuickContentSurface(this.contentLocation().module) ?
            this.frame().content.opacity * (1 - this.frame().progress) : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack()
          .id('reader-control-full-content-outline')
          .width(this.frame().contentSurface.width).height(this.frame().contentSurface.height)
          .position({ x: this.frame().contentSurface.x, y: this.frame().contentSurface.y })
          .borderRadius(12)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appScheme) })
          .opacity(readerControlHasFullContentSurface(this.contentLocation().module) ?
            this.frame().contentSurface.opacity : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.controlHeader(); }
          .width(this.frame().header.width).height(this.frame().header.height)
          .position({ x: this.frame().header.x, y: this.frame().header.y })
          .opacity((this.contentLocation().module === 'replace') ? 1 : this.frame().header.opacity)
          // Default admits the child collapse action and masks lower siblings.
          // Block here would skip every child, leaving a visible but dead button.
          .zIndex(2)
          .hitTestBehavior(this.temporaryLayerKind === '' && (this.frame().header.opacity > 0 || this.contentLocation().module === 'replace') ?
            HitTestMode.Default : HitTestMode.None)
          .enabled(this.inputEnabled && this.frame().visibility > 0 && this.visualHeldPointerId < 0 &&
            (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu') &&
            (this.frame().header.opacity > 0 || this.contentLocation().module === 'replace'))
          .accessibilityLevel((this.temporaryLayerKind !== '') ? 'no-hide-descendants' : 'auto');
        this.headerAction();
        Stack({ alignContent: Alignment.TopStart }) { this.brightnessRail(); }
          .width(this.frame().brightness.width).height(this.frame().brightness.height)
          .position({ x: this.frame().brightness.x, y: this.frame().brightness.y })
          .opacity(this.frame().brightness.opacity)
          // HitTestMode.None excludes only this container, not its children.
          // Retain the authored actors, but retire the whole faded subtree.
          .enabled(this.contentInputEnabled() && (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu') &&
            this.frame().brightness.opacity > 0)
          .hitTestBehavior(this.temporaryLayerKind === '' && this.frame().brightness.opacity > 0 ? HitTestMode.Default : HitTestMode.None)
          .accessibilityLevel(this.contentInputEnabled() && this.temporaryLayerKind === '' &&
            this.frame().brightness.opacity > 0 ? 'auto' : 'no-hide-descendants');
        Stack({ alignContent: Alignment.TopStart }) { this.moduleNavBar(); }
          .width(this.frame().navigation.width).height(this.frame().navigation.height)
          .position({ x: this.frame().navigation.x, y: this.frame().navigation.y })
          .opacity(this.frame().navigation.opacity)
          // The modal Popup owns background input. Keep the native Button
          // paint stable while dispatch and accessibility are suspended.
          .enabled(this.navigationInputEnabled(true))
          .accessibilityLevel(!this.moreMenuVisible && !this.hasCurrentModalInput() &&
            this.frame().navigation.opacity > 0 ? 'auto' : 'no-hide-descendants')
          .hitTestBehavior(this.frame().navigation.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        // The cap and central grabber retain their one gesture owner.
        if (!this.fixedIsland) {
        this.headerGrabCap();

        Stack({ alignContent: Alignment.TopStart }) {
          // Paint from the same actor used by the spatial axis. Stack margin
          // alignment must not become a second source of vertical placement.
          Row().width(this.frame().grabber.width).height(this.frame().grabber.height).borderRadius(2)
            .backgroundColor(readerAppColor('TOK_READ_HANDLE', this.appScheme))
            .position({ x: this.frame().grabber.x - (this.currentLayout().fullPanelWidth - 72) / 2,
              y: this.frame().grabber.y - this.frame().shell.y })
            .id('reader-control-motion-grabber-bar').opacity(this.frame().grabber.opacity);
        }
        .width(72).height(28)
        .id('reader-control-motion-grabber')
        .zIndex(3)
        .position({ x: (this.currentLayout().fullPanelWidth - 72) / 2, y: this.frame().shell.y })
        .hitTestBehavior(HitTestMode.Block)
        .accessibilityText(this.contentLocation().level === 'home' ?
          '控制栏拖动区域，向下关闭' : this.contentLocation().form === 'full' ?
            '完整控制栏，向下收回快捷控制栏' : '快捷控制栏，向上展开，向下关闭')
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityLevel('no')
        .accessibilityVirtualNode(this.accessibleControlActions)
        .onTouch(this.controlTouchHandler());
        }
        }
        .width(this.currentLayout().fullPanelWidth).height(this.controlPanelHeight())
        .id('reader-control-motion-dock')
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
          ? { role: 'modal-overlay', id: 'reading-controls', active: this.frame().visibility > 0,
            intercepts: this.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0) } as LayoutInvariantTag : undefined)
        .translate({ x: this.currentLayout().isExpanded() ? this.directSheetTranslation() : 0,
          y: this.frame().dock.translateY + (this.currentLayout().isExpanded() ? 0 : this.directSheetTranslation()) })
        .opacity(this.frame().dock.opacity * (this.directSheetVisible() && this.reduceMotion ? this.visualExpansionProgress : 1))
        .position({ x: this.dockLeft(), y: this.presentedDockTop() })
        .onTouch((event: TouchEvent): void => this.onDockPlacementTouch(event))
        // A held pointer may reach the hidden endpoint before UP. Retiring
        // its ancestor here loses UP/CANCEL and leaves the runtime held.
        .enabled(this.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0))
          .hitTestBehavior(this.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0) ?
          HitTestMode.Transparent : HitTestMode.None);
      if (this.launchSample !== undefined) {
        ReaderSessionLaunchStage({
          fontScale: this.sessionFontScale,
          sample: this.launchSample, sessionState: this.launchBusinessStatus,
          desiredPlaying: this.launchDesiredPlaying, countdown: this.launchCountdown,
          interactionEnabled: this.launchInteractionEnabled,
          ownsSourceRegion: this.launchSourceDetached(this.launchSample.type),
          material: this.surfaceMaterial('sessionCapsule'),
          sourceSurfaceColor: readerAppColor(this.fixedIsland ? 'TOK_READ_CARD_EMPHASIS' : this.launchSourceKind === 'fullAutoPagePlayback' ?
            'TOK_SURFACE_PANEL_SOFT' : this.launchSourceKind === 'fullTtsPlayback' ? 'TOK_TTS_CARD' :
              this.launchSourceKind === 'quickTts' ? 'TOK_TTS_QUICK_CARD' : 'TOK_SURFACE_PANEL', this.appScheme),
          sourceBorderColor: readerAppColor(this.fixedIsland ? 'TOK_LINE_STRONG' : this.launchSourceKind === 'quickTts' ?
            'app.control.paint.66B4A697' : this.launchSourceKind === 'fullTtsPlayback' ? 'TOK_TTS_LINE' : 'TOK_LINE', this.appScheme),
          sourceBorderWidth: this.fixedIsland || this.launchSample.type === 'autoPage' ? TOK_BORDER_W : 0.5,
          sourceSurfaceTopInset: !this.fixedIsland && this.launchSourceKind === 'fullTtsPlayback' ? 27 : 0,
          sourceHighlightColor: !this.fixedIsland && this.launchSourceKind === 'fullTtsPlayback' ? readerAppColor('app.control.paint.99FFFFFF', this.appScheme) : '#00000000',
          sourceGradientStart: !this.fixedIsland && this.launchSourceKind === 'quickTts' ? readerAppColor('app.control.paint.FFFAF4', this.appScheme) : '',
          sourceGradientEnd: !this.fixedIsland && this.launchSourceKind === 'quickTts' ? readerAppColor('app.control.paint.F6ECDD', this.appScheme) : '',
          themeScheme: this.appScheme,
          sourceSharpContent: (): void => { this.launchSourceContent(); },
          onToggle: (): void => this.onLaunchToggle(),
        }).id('reader-session-launch-fade-owner').opacity(this.launchStageOpacity).zIndex(9)
          .transition(this.reduceMotion ? TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()), TransitionEffect.IDENTITY) :
            TransitionEffect.IDENTITY);
      }
      }
    }
    .visibility(this.controlObscured ? Visibility.Hidden : Visibility.Visible)
    .width(this.currentLayout().viewportWidth)
    .height(this.currentLayout().viewportHeight)
    .accessibilityLevel(this.frame().visibility > 0 || this.launchSample !== undefined ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_previous: Area, current: Area): void => {
      this.rootScreenX = Number(current.globalPosition.x);
      this.rootScreenY = Number(current.globalPosition.y);
      this.dockMeasured = true;
      this.onLayoutChanged();
    });
  }

  private onRecoveryIdentityChanged(): void {
    if (this.moreMenuVisible) this.setMoreMenuVisible(false);
    this.moreMenuRecoveryIdentity = '';
  }

  private setMoreMenuVisible(visible: boolean): void {
    if (this.moreMenuVisible === visible) return;
    if (visible && (!this.runtimeMounted || !this.inputEnabled || this.controlObscured || (this.temporaryLayerKind !== '') || this.frame().visibility <= 0)) return;
    if (visible) {
      this.moreMenuGeneration += 1;
      this.moreMenuRecoveryIdentity = this.recoveryIdentity;
      this.moreMenuOwnerScope = this.currentMoreMenuOwnerScope();
      this.moreMenuMeasuredWidth = 0;
      this.moreMenuWidthKey = '';
    }
    this.moreMenuVisible = visible;
    this.verificationSession?.layer('more', visible, this.moreMenuGeneration, this.visualSession);
    this.observeMoreMenuFrames(visible, this.moreMenuGeneration);
    this.syncProgressInput();
    this.onTemporaryLayerChange(visible, 'moreMenu');
    this.refreshDockPlacement();
  }

  private observeMoreMenuFrames(visible: boolean, generation: number): void {
    const verification = this.verificationSession;
    if (verification?.observing() !== true) return;
    const ticket = ++this.verificationMenuTicket;
    if (visible) this.verificationPopupOwnerId = -1;
    const frames: ReaderControlMenuVerificationFrame[] = [];
    const context = this.getUIContext();
    const target = this.currentLayout().topBarVisible ? 'reader-control-more' : 'reader-control-more-short';
    const trigger = readReaderControlNativeActor(context, target);
    const menuId = 'reader-control-more-menu';
    const collect = (frameTimeNs: number): void => {
      if (!this.runtimeMounted || ticket !== this.verificationMenuTicket || verification.observing() !== true) return;
      const menu = readReaderControlNativeActor(context, menuId);
      const actions: string[] = [];
      if (menu.mounted) {
        for (const action of ['info','refresh','download','recovery']) {
          const node = context.getAttachedFrameNodeById(menuId + '-item-' + action);
          if (node !== null && !node.isDisposed() && node.isAttached() && node.isVisible()) actions.push(action);
        }
      }
      const popupOwner = readReaderControlPopupOwner(context, menu, this.verificationPopupOwnerId);
      if (visible && popupOwner.status === 'measured' && popupOwner.relation === 'scroll-ancestor' &&
        popupOwner.uniqueId !== undefined) this.verificationPopupOwnerId = popupOwner.uniqueId;
      const frame: ReaderControlMenuVerificationFrame = { frameTimeNs: frameTimeNs, menu: menu, popupOwner: popupOwner,
        trigger: frames.length === 0 ? trigger : undefined, mountedActions: actions };
      frames.push(frame);
      // The system owns Popup animation. Read a bounded normal frame window;
      // a static/unavailable native stream is classified as an evidence gap.
      if (frames.length < 35) {
        context.postFrameCallback(new ReaderControlFrameCallback(collect));
      } else {
        const trace: ReaderControlMenuNativeTrace = {
          visible: visible, generation: generation, layout: target, frames: frames,
        };
        verification.effect('more-popup', 'trace', trace, 'motion');
      }
    };
    context.postFrameCallback(new ReaderControlFrameCallback(collect));
  }

  private currentMoreMenuOwnerScope(): string {
    return JSON.stringify([this.sourceId, this.sourceBookId, this.bookmarkIdentity?.libraryBookId ?? '',
      this.controlOpenRevision, this.runtimeLifecycle]);
  }

  private dismissMoreMenu(generation: number = this.moreMenuGeneration): void {
    if (generation === this.moreMenuGeneration) this.setMoreMenuVisible(false);
  }

  private performMoreAction(action: 'info' | 'refresh' | 'download' | 'recovery', generation: number = this.moreMenuGeneration): void {
    if (generation !== this.moreMenuGeneration || !this.moreMenuVisible || !this.runtimeMounted ||
      !this.inputEnabled || this.controlObscured || this.frame().visibility <= 0 ||
      this.moreMenuOwnerScope !== this.currentMoreMenuOwnerScope()) return;
    if (action === 'refresh' && !this.chapterRefreshEnabled) return;
    if (action === 'download' && !this.bookDownloadEnabled) return;
    if (action === 'recovery' && (!this.recoveryAvailable || this.moreMenuRecoveryIdentity.length === 0 ||
      this.moreMenuRecoveryIdentity !== this.recoveryIdentity)) return;
    const recoveryIdentity = this.moreMenuRecoveryIdentity;
    this.dismissMoreMenu(generation);
    if (action === 'info') this.onOpenBookInfo();
    else if (action === 'refresh') this.onRefreshChapter();
    else if (action === 'recovery') this.onOpenRecovery(recoveryIdentity);
    else this.onDownloadBook();
  }

  private readerMoreMenuWidth(): number {
    const surface = this.readerMoreSurfaceSpec();
    const labels = this.readerMoreActions().map((action: ReaderMenuActionView): string => action.label);
    const key = JSON.stringify([labels, this.minimumMetricsRevision, this.minimumKey,
      surface.actionFontFamily, surface.actionFontSize, surface.actionFontWeight]);
    // Reuse ordinary motion publications. A live label/font publication owns
    // a new measurement even while the same native popup remains open.
    if (this.moreMenuVisible && key !== this.moreMenuWidthKey) {
      this.moreMenuWidthKey = key;
      this.moreMenuMeasuredWidth = 0;
      try {
        const context = this.getUIContext();
        let width: number = 0;
        labels.forEach((label: string): void => {
          const measured = context.getMeasureUtils().measureTextSize({
            textContent: label, fontFamily: surface.actionFontFamily,
            fontSize: `${surface.actionFontSize}fp`, fontWeight: `${surface.actionFontWeight}`,
          });
          const measuredWidth = context.px2vp(Number(measured.width));
          if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) throw new Error('Invalid More label width');
          width = Math.max(width, measuredWidth);
        });
        this.moreMenuMeasuredWidth = Math.ceil(width) + surface.actionPaddingLeft + surface.actionPaddingRight;
      } catch (_) {
        // Native text measurement can be unavailable during window changes.
        // Keep the authored bounded menu until the next font/input revision.
        this.moreMenuMeasuredWidth = surface.width;
      }
    }
    return Math.max(surface.width, this.moreMenuMeasuredWidth);
  }

  private recordMoreAnchor(area: Area, shortWindow: boolean): void {
    const left = Number(area.globalPosition.x);
    const top = Number(area.globalPosition.y);
    const width = Number(area.width);
    const height = Number(area.height);
    if (!Number.isFinite(left) || !Number.isFinite(top) || width <= 0 || height <= 0) return;
    const current = shortWindow ? this.moreShortAnchor : this.moreTopAnchor;
    if (current !== undefined && current.left === left && current.top === top &&
      current.width === width && current.height === height) return;
    const anchor = new ReaderRectVp(left, top, width, height);
    if (shortWindow) this.moreShortAnchor = anchor;
    else this.moreTopAnchor = anchor;
  }

  private readerMoreAnchor(): ReaderRectVp | undefined {
    return this.currentLayout().topBarVisible ? this.moreTopAnchor : this.moreShortAnchor;
  }

  private readerMorePopupRect(): ReaderRectVp {
    this.editingMetricsRevision;
    const metrics = readerWindowMetrics();
    const layout = this.currentLayout();
    const host = new ReaderRectVp(this.rootScreenX, this.rootScreenY, layout.viewportWidth, layout.viewportHeight);
    const anchor = this.readerMoreAnchor();
    const viewport = readerOverlayViewport(metrics, host, new ReaderInsetsVp(12, 8, 12, 8), anchor);
    const surface = this.readerMoreSurfaceSpec();
    const actionHeight = readerScaledControlHeight(surface.actionHeight, surface.actionLineHeight, metrics.systemFontScale);
    const height = readerOverlayListHeight(0, actionHeight, this.readerMoreActions().length, 0,
      0, 0, surface.borderWidth, surface.pointerHeight);
    return readerOverlayPanel(viewport, this.readerMoreMenuWidth(), height, 'anchor-end', anchor, 8);
  }

  private readerMoreSurfaceSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('reader-more-menu');
  }

  private readerMorePopupOptions(generation: number): CustomPopupOptions {
    const surface = this.readerMoreSurfaceSpec();
    const density = readerWindowMetrics().densityPixels;
    const material = this.surfaceMaterial('popoverMenu');
    const anchor = this.readerMoreAnchor();
    const rect = this.readerMorePopupRect();
    const options: CustomPopupOptions = {
      builder: (): void => { this.readerMoreMenu(generation); },
      placement: anchor !== undefined && rect.top < anchor.top ? Placement.TopRight : Placement.BottomRight,
      width: rect.width,
      offset: anchor === undefined ? undefined : { x: rect.left - (anchor.left + anchor.width - rect.width), y: 0 },
      enableArrow: true, arrowWidth: surface.pointerWidth, arrowHeight: surface.pointerHeight,
      radius: surface.borderRadius,
      arrowPointPosition: ArrowPointPosition.CENTER,
      targetSpace: 8,
      popupColor: material.native ? Color.Transparent : readerAppColor(surface.surfaceBackgroundRole, this.appScheme),
      backgroundBlurStyle: BlurStyle.NONE,
      borderWidth: material.native ? 0 : surface.borderWidth,
      borderLinearGradient: material.native ? undefined : { colors: [
        [readerAppColor(surface.surfaceBorderRole, this.appScheme), 0],
        [readerAppColor(surface.surfaceBorderRole, this.appScheme), 1],
      ] },
      shadow: material.native ? undefined : { radius: surface.shadowRadius * density,
        color: readerAppColor(surface.surfaceShadowRole, this.appScheme),
        offsetY: surface.shadowOffsetY * density },
      autoCancel: true, mask: true, focusable: true, followTransformOfTarget: true,
      transition: this.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : undefined,
      onStateChange: (event: PopupStateChangeParam): void => {
        if (generation === this.moreMenuGeneration && this.verificationSession?.observing() === true) {
          const facts: ReaderControlMenuNativeState = { visible: event.isVisible, generation: generation };
          this.verificationSession.effect('more-popup', 'native-state', facts);
        }
        if (!event.isVisible) this.dismissMoreMenu(generation);
      },
    };
    applyReaderPopupMaterial(options, material);
    return options;
  }

  private readerMoreActionEnabled(action: 'info' | 'refresh' | 'download' | 'recovery'): boolean {
    return this.inputEnabled && !this.controlObscured &&
      (!this.moreMenuVisible || this.moreMenuOwnerScope === this.currentMoreMenuOwnerScope()) &&
      (action !== 'refresh' || this.chapterRefreshEnabled) &&
      (action !== 'download' || this.bookDownloadEnabled) &&
      (action !== 'recovery' || this.recoveryAvailable);
  }

  private readerMoreActions(): ReaderMenuActionView[] {
    const actions: ReaderMenuActionView[] = [
      new ReaderMenuActionView('info', '书籍信息', this.readerMoreActionEnabled('info')),
      new ReaderMenuActionView('refresh', '刷新本章', this.readerMoreActionEnabled('refresh')),
      new ReaderMenuActionView('download', this.bookDownloadActive ? '正在下载章节…' : '下载全部章节',
        this.readerMoreActionEnabled('download')),
    ];
    if (this.recoveryAvailable) actions.push(new ReaderMenuActionView('recovery', '待处理事项', this.readerMoreActionEnabled('recovery')));
    return actions;
  }

  @Builder
  private readerMoreMenu(generation: number = this.moreMenuGeneration) {
    ReaderActionMenuSurface({
      specId: 'reader-more-menu', nativeId: 'reader-control-more-menu',
      auditAnchoredPopup: true, auditPopupAnchor: this.readerMoreAnchor(),
      nativePopupMaterial: this.surfaceMaterial('popoverMenu').native,
      scheme: this.appScheme, actions: this.readerMoreActions(),
      viewportHeight: Math.max(0, this.readerMorePopupRect().height - this.readerMoreSurfaceSpec().pointerHeight -
        2 * this.readerMoreSurfaceSpec().borderWidth),
      onAction: (id: string): void => {
        if (id === 'info' || id === 'refresh' || id === 'download' || id === 'recovery') this.performMoreAction(id, generation);
      },
    });
  }

  @Builder
  private launchSourceContent() {
    if (this.launchSourceCurrent()) {
    if (this.capturedLaunchSourceKind === 'quickAutoPage' || this.capturedLaunchSourceKind === 'fullAutoPagePlayback') {
      ReaderControlAutoPageContent({
        fixedIsland: this.fixedIsland,
        sourceMinimum: this.launchNaturalMinimum,
        sourceMinimumIdentity: this.launchNaturalMinimum?.identity ?? '',
        sourceMinimumKey: this.launchNaturalMinimum?.key ?? '',
        sourceMinimumMetricsRevision: this.launchNaturalMinimum?.metricsRevision ?? -1,
        sourceOnly: this.capturedLaunchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        form: this.capturedLaunchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.launchFullContentHeight,
        interactionEnabled: false, status: this.launchSourceAutoStatus,
        speedSeconds: this.autoPageSpeedSeconds, timerSummaryText: this.autoPageTimerSummaryText,
        timerMinutes: this.autoPageTimerMinutes, timerSeconds: this.autoPageTimerSeconds,
        followHighlight: this.autoPageFollowHighlight, canPreviousChapter: this.canStepChapter(-1),
        canNextChapter: this.canStepChapter(1),
      });
    } else {
      ReaderControlTtsContent({
        fixedIsland: this.fixedIsland,
        sourceMinimum: this.launchNaturalMinimum,
        sourceMinimumIdentity: this.launchNaturalMinimum?.identity ?? '',
        sourceMinimumKey: this.launchNaturalMinimum?.key ?? '',
        sourceMinimumMetricsRevision: this.launchNaturalMinimum?.metricsRevision ?? -1,
        sourceOnly: this.capturedLaunchSourceKind === 'quickTts' ? 'quick' : 'full',
        frozenWaveformSample: this.launchWaveformSample, reduceMotion: this.reduceMotion,
        form: this.capturedLaunchSourceKind === 'quickTts' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.launchFullContentHeight,
        interactionEnabled: false, state: this.launchSourceTtsState,
        timerMode: this.ttsTimerMode, timerMinutes: this.ttsTimerMinutes, timerSeconds: this.ttsTimerSeconds,
        engine: this.ttsEngine, language: this.ttsLanguage, person: this.ttsPerson,
        voiceOptions: this.ttsVoiceOptions, followHighlight: this.ttsFollowHighlight,
      });
    }
    }
  }

  private launchSourceCurrent(): boolean {
    if (!this.runtimeMounted || this.launchSample === undefined || this.capturedLaunchGeneration !== this.launchGeneration) return false;
    if (this.minimumIdentity.length === 0) return true;
    const source = this.launchSourceMinimum;
    const receipt = this.launchNaturalMinimum;
    if (source === undefined || source.generation !== this.launchGeneration || source.kind !== this.capturedLaunchSourceKind ||
      !readerControlPlaybackSourceKindMatches(source.kind, this.launchSample.type)) return false;
    if (!source.requiresNaturalProfile) return receipt === undefined && source.receipt === undefined;
    return receipt !== undefined && source.receipt !== undefined &&
      receipt.module === this.launchSample.type && receipt.metricsRevision === this.minimumMetricsRevision &&
      readerControlPlaybackProfileMatches(receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision) &&
      readerControlPlaybackProfileMatches(source.receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision);
  }

  private measureTopBar(rect: ReaderControlBackdropRect): void {
    this.topBarRect = rect;
    this.reportBackdropRegions();
  }

  private headerPaintLayout(): ReaderControlHeaderLayout {
    return readerControlHeaderLayout(this.contentLocation().module, this.fixedIsland ? 1 : this.frame().progress,
      this.frame().header.width, this.selectedMinimumProfile()?.headerPaint);
  }

  private headerFrame(): ReaderControlActorFrame {
    return this.headerPaintLayout().frame;
  }

  private headerRole(): ReaderControlHeaderRole {
    return readerControlHeaderRole(this.contentLocation().module);
  }

  private headerInter(): boolean {
    return this.headerRole() === 'plainInter';
  }

  private headerTitleStyle(): ReaderTextStyle {
    return this.headerInter() ? TYPE_READER_CONTROL_HEADER_INTER : TYPE_READER_CONTROL_HEADER_UI;
  }

  private headerActionStyle(): ReaderTextStyle {
    if (this.headerRole() === 'replace') return TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY;
    if (this.headerRole() === 'ttsMake') return TYPE_READER_CONTROL_COLLAPSE_TTS;
    return this.headerInter() ? TYPE_READER_CONTROL_COLLAPSE_INTER : TYPE_READER_CONTROL_COLLAPSE_UI;
  }

  private headerActionFrame(): ReaderControlActorFrame {
    return readerControlHeaderTargetFrame(this.headerPaintLayout().actionTarget, this.frame().header,
      this.currentLayout().fullPanelWidth, this.controlPanelHeight());
  }

  private headerActionInputEnabled(): boolean {
    if (this.directSheetClosing) return false;
    if (!this.controlActionInputEnabled() || this.contentLocation().level !== 'secondary') return false;
    const target = this.headerActionFrame();
    if (target.width <= 0 || target.height <= 0) return false;
    return this.headerRole() === 'replace' ? this.frame().progress === 1 : this.frame().header.opacity > 0;
  }

  private activateHeaderAction(): void {
    if (this.headerActionInputEnabled()) this.collapseControl();
  }

  private controlCallbackGuard(): () => boolean {
    const owner = this.minimumOwnerKey;
    const identity = this.currentMinimumIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (): boolean => scope === this.currentMoreMenuOwnerScope() &&
      (!this.preparedMinimumRequired || (owner === this.minimumOwnerKey && identity === this.currentMinimumIdentity()));
  }

  private controlActionScope(): string {
    return JSON.stringify([this.currentMoreMenuOwnerScope(), this.preparedMinimumRequired ? this.minimumOwnerKey : '',
      this.preparedMinimumRequired ? this.currentMinimumIdentity() : '']);
  }

  private controlActionHandler(action: () => void): () => void {
    const current = this.controlCallbackGuard();
    return (): void => { if (current()) action(); };
  }

  private brightnessGestureHandler(action: (event: GestureEvent) => void): (event: GestureEvent) => void {
    const current = this.controlCallbackGuard();
    return (event: GestureEvent): void => { if (current()) action(event); };
  }

  private controlTouchHandler(): (event: TouchEvent) => void {
    const runtime = this.runtime;
    const lifecycle = this.runtimeLifecycle;
    const owner = this.minimumOwnerKey;
    const identity = this.currentMinimumIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (event: TouchEvent): void => {
      if (runtime !== this.runtime || lifecycle !== this.runtimeLifecycle || owner !== this.minimumOwnerKey ||
        scope !== this.currentMoreMenuOwnerScope()) return;
      if (event.type === TouchType.Down && (this.directSheetRedesign && this.visualDirectSheet ||
        this.preparedMinimumRequired && identity !== this.currentMinimumIdentity())) return;
      this.handleControlTouch(event);
    };
  }

  @Builder
  private headerGrabCap() {
    Stack()
      .id('reader-control-motion-grab-cap')
      .width(this.headerGrabCapFrame().width).height(this.headerGrabCapFrame().height)
      .position({ x: this.headerGrabCapFrame().x, y: this.headerGrabCapFrame().y })
      .responseRegion(this.headerGrabResponseRegions())
      .zIndex(3).hitTestBehavior(HitTestMode.Block).accessibilityLevel('no')
      .onTouch(this.controlTouchHandler());
  }

  private headerGrabCapFrame(): ReaderControlActorFrame {
    return { x: 0, y: this.frame().shell.y, width: this.currentLayout().fullPanelWidth,
      height: Math.max(0, Math.min(19, this.frame().shell.height,
        this.frame().header.y - this.frame().shell.y, this.frame().content.y - this.frame().shell.y)), opacity: 1 };
  }

  private headerGrabRegions(): ReaderControlActorFrame[] {
    const cap = this.headerGrabCapFrame();
    return readerControlHeaderGrabRegions(cap, this.headerActionInputEnabled() ? this.headerActionFrame() : undefined);
  }

  private headerGrabResponseRegions(): Rectangle[] {
    const cap = this.headerGrabCapFrame();
    return this.headerGrabRegions().map((region: ReaderControlActorFrame): Rectangle => ({
      x: region.x - cap.x, y: region.y - cap.y, width: region.width, height: region.height,
    }));
  }

  private headerIcon(): Resource {
    const location = this.contentLocation();
    if (location.module === 'directory') return location.directoryTab === 'bookmarks' ?
      $r(this.appScheme === 'night' ? 'app.media.reader_directory_marker_bookmark_theme_night' : 'app.media.reader_directory_marker_bookmark') : $r(this.appScheme === 'night' ? 'app.media.reader_directory_directory_theme_night' : 'app.media.reader_directory_directory');
    if (location.module === 'tts') return $r(this.appScheme === 'night' ? 'app.media.reader_tts_header_theme_night' : 'app.media.reader_tts_header');
    if (location.module === 'appearance') return $r(this.appScheme === 'night' ? 'app.media.reader_appearance_header_theme_night' : 'app.media.reader_appearance_header');
    if (location.module === 'settings') return $r(this.appScheme === 'night' ? 'app.media.reader_settings_header_theme_night' : 'app.media.reader_settings_header');
    if (location.module === 'autoPage') return $r(this.appScheme === 'night' ? 'app.media.rc_autopage_theme_night' : 'app.media.rc_autopage');
    return $r(this.appScheme === 'night' ? 'app.media.rc_search_theme_night' : 'app.media.rc_search');
  }

  @Builder
  private controlHeader() {
    if (this.headerRole() === 'replace') {
      this.replaceHeader();
    } else {
      Stack({ alignContent: Alignment.TopStart }) {
        Image(this.headerIcon())
          .width(this.headerPaintLayout().icon.width).height(this.headerPaintLayout().icon.height)
          .position({ x: this.headerPaintLayout().icon.x, y: this.headerPaintLayout().icon.y })
          .hitTestBehavior(HitTestMode.None);
        Text(this.contentTitle()).fontFamily(this.headerTitleStyle().fontFamily)
          .fontWeight(this.headerTitleStyle().fontWeight, { enableVariableFontWeight: true })
          .fontSize(this.headerTitleStyle().fontSizeFp).lineHeight(this.headerTitleStyle().lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .width(this.headerPaintLayout().title.width).height(this.headerPaintLayout().title.height)
          .position({ x: this.headerPaintLayout().title.x, y: this.headerPaintLayout().title.y });
        this.headerActionPaint();
      }.width(this.frame().header.width).height(this.headerFrame().height);
    }
  }

  @Builder
  private headerActionPaint() {
    if (this.directSheetVisible()) {
      Stack({ alignContent: Alignment.Center }) {
        Image(readerPaperActionIcon('close', this.appScheme)).width(16).height(16);
      }.width(32).height(32).borderRadius(16).backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appScheme))
        .position({ x: this.headerPaintLayout().actionPaint.x + Math.max(0, (this.headerPaintLayout().actionPaint.width - 32) / 2),
          y: this.headerPaintLayout().actionPaint.y }).hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    } else if (this.fixedIsland) {
      Stack({ alignContent: Alignment.Center }) {
        Text('返回').fontFamily(this.headerActionStyle().fontFamily).fontWeight(this.headerActionStyle().fontWeight)
          .fontSize(this.headerActionStyle().fontSizeFp).maxLines(1)
          .fontColor(readerAppColor('app.readerIsland.controlInk', this.appScheme));
      }.width(this.headerPaintLayout().actionPaint.width).height(this.headerPaintLayout().actionPaint.height)
        .position({ x: this.headerPaintLayout().actionPaint.x, y: this.headerPaintLayout().actionPaint.y })
        .backgroundColor(readerAppColor('app.readerIsland.controlSurface', this.appScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('app.readerIsland.controlBorder', this.appScheme) }).borderRadius(8)
        .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    } else {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(readerControlHeaderActionLabel(this.contentLocation().module))
        .width(this.headerPaintLayout().actionLabel.width).height(this.headerPaintLayout().actionLabel.height)
        .position({ x: this.headerPaintLayout().actionLabel.x - this.headerPaintLayout().actionPaint.x,
          y: this.headerPaintLayout().actionLabel.y - this.headerPaintLayout().actionPaint.y })
        .fontFamily(this.headerActionStyle().fontFamily)
        .fontWeight(this.headerActionStyle().fontWeight, { enableVariableFontWeight: this.headerRole() !== 'replace' })
        .fontSize(this.headerActionStyle().fontSizeFp)
        .attributeModifier(new ReaderControlHeaderLineHeight(this.headerActionStyle().lineHeightFp))
        .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme)).textAlign(TextAlign.Center);
      if (this.headerRole() === 'ttsMake') {
        Image($r(this.appScheme === 'night' ? 'app.media.reader_control_header_chevron_theme_night' : 'app.media.reader_control_header_chevron'))
          .width(this.headerPaintLayout().chevron.width).height(this.headerPaintLayout().chevron.height)
          .position({ x: this.headerPaintLayout().chevron.x - this.headerPaintLayout().actionPaint.x,
            y: this.headerPaintLayout().chevron.y - this.headerPaintLayout().actionPaint.y });
      }
    }.width(this.headerPaintLayout().actionPaint.width).height(this.headerPaintLayout().actionPaint.height)
      .position({ x: this.headerPaintLayout().actionPaint.x, y: this.headerPaintLayout().actionPaint.y })
      .opacity(this.headerPaintLayout().actionPaint.opacity)
      .backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme)).borderRadius(8)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
    }
  }

  @Builder
  private headerAction() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack().width('100%').height('100%').hitTestBehavior(HitTestMode.None);
    }.width(this.headerActionFrame().width).height(this.headerActionFrame().height).padding(0)
      .position({ x: this.headerActionFrame().x, y: this.headerActionFrame().y })
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 8, 8, this.headerActionInputEnabled())).zIndex(2)
      .id('reader-control-collapse')
      .enabled(this.headerActionInputEnabled())
      .hitTestBehavior(this.headerActionInputEnabled() ? HitTestMode.Block : HitTestMode.None)
      .accessibilityText(this.directSheetVisible() ? `关闭${this.contentTitle()}` :
        this.fixedIsland ? '返回阅读主控' :
          this.headerRole() === 'replace' ? '完成替换规则管理，收起到快捷态' : `收起${this.contentTitle()}`)
      .accessibilityLevel(this.headerActionInputEnabled() ? 'auto' : 'no-hide-descendants')
      .onClick(this.controlActionHandler((): void => this.activateHeaderAction()));
  }

  private replaceHeaderFrame(): ReaderControlReplaceHeaderFrame {
    const layout = this.headerPaintLayout();
    return { title: layout.title, icon: layout.icon, action: layout.actionPaint };
  }

  @Builder
  private replaceHeader() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('替换规则管理').fontFamily(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontFamily)
        .fontWeight(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontWeight)
        .fontSize(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width(this.replaceHeaderFrame().title.width).height(this.replaceHeaderFrame().title.height)
        .position({ x: this.replaceHeaderFrame().title.x, y: this.replaceHeaderFrame().title.y })
        .opacity(this.replaceHeaderFrame().title.opacity).hitTestBehavior(HitTestMode.None);
      Image($r(this.appScheme === 'night' ? 'app.media.reader_control_replace_header_theme_night' : 'app.media.reader_control_replace_header'))
        .width(this.replaceHeaderFrame().icon.width).height(this.replaceHeaderFrame().icon.height)
        .position({ x: this.replaceHeaderFrame().icon.x, y: this.replaceHeaderFrame().icon.y })
        .opacity(this.replaceHeaderFrame().icon.opacity).hitTestBehavior(HitTestMode.None);
      this.headerActionPaint();
    }.width(this.frame().header.width).height(this.headerFrame().height).hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private controlContent() {
    // Only a business route change replaces a module. Quick/Full uses one tree.
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.minimumPresentationAvailable()) {
      if (this.contentLocation().level === 'home') {
        Scroll() { this.homeContent(); }
          .id('reader-control-module-home')
          .width(this.frame().content.width).height(this.frame().content.height).edgeEffect(EdgeEffect.None)
          .enableScrollInteraction(!readerControlExtentFits(this.homeContentMinimumHeight(), this.frame().content.height));
      } else if (this.contentLocation().module === 'directory') {
        ReaderControlDirectoryContent({
          verificationSession: this.verificationSession,
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
            this.bindModuleMinimum('directory', identity, measurer),
          directoryPublication: this.directoryPublication, directoryEntriesRevision: this.directoryEntriesRevision, currentChapterIndex: this.currentChapterIndex,
          catalogComplete: this.catalogComplete, catalogChapterCount: this.catalogChapterCount,
          catalogLoading: this.catalogLoading, catalogLoadFailed: this.catalogLoadFailed,
          catalogCurrentPosition: this.catalogCurrentPosition,
          catalogReadableChapterCount: this.totalChapters, catalogReadablePosition: this.readableChapterPosition,
          onRequireCompleteCatalog: (): void => this.onRequireCompleteCatalog(),
          bookmarkLoadFailed: this.bookmarkLoadFailed,
          bookmarkLoadMessage: this.bookmarkLoadMessage,
          bookmarkRecovery: this.bookmarkRecovery,
          onRetryBookmarkLoad: (): void => this.onRetryBookmarkLoad(),
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          mangaSearch: this.mangaSearch,
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          progress: this.contentMotionProgress,
          interactionEnabled: this.secondaryModuleInputEnabled('directory'),
          inputCurrent: (): boolean => this.secondaryModuleInputEnabled('directory'),
          editorInputCurrent: (): boolean => this.moduleEditorInputEnabled('directory'),
          onTemporaryLayerChange: this.moduleTemporaryLayerHandler('directory'),
          dismissTemporaryRevision: this.dismissTemporaryRevision,
          availableWidth: this.contentMotionWidth, availableHeight: this.contentEditingHeight(),
          tab: this.contentLocation().directoryTab,
          sessionKey: this.listSessionKey(), bookmarkIdentity: this.bookmarkIdentity,
          onTabChange: (tab: string): void => {
            if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
              'stage=panel-directory-tab tab=%{public}d ready=%{public}s owner=%{public}d',
              tab === 'bookmarks' ? 1 : 0, String(this.minimumInputReady()), this.runtime?.owner() ?? -1);
            this.onInputActivity();
            this.applySemanticSession(setReaderControlDirectoryTab(this.controlSession,
              tab === 'bookmarks' ? 'bookmarks' : 'directory'), 'directory-tab');
          },
          onSelectChapter: (index: number): void => this.onSelectChapter(index),
          onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void =>
            this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
          onSelectBookmark: this.onSelectBookmark,
          onDownloadChapter: (index: number): void => this.onDownloadChapter(index),
          onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
        });
      } else if (this.contentLocation().module === 'search') {
        this.searchModuleContent();
      } else if (this.contentLocation().module === 'settings') {
        this.settingsModuleContent();
      } else if (this.contentLocation().module === 'tts') {
        this.ttsModuleContent();
      } else if (this.contentLocation().module === 'autoPage') {
        this.autoPageModuleContent();
      } else if (this.contentLocation().module === 'replace') {
        this.replaceModuleContent();
      } else if (this.contentLocation().module === 'appearance') {
        this.appearanceModuleContent();
      }
      }
    }
    .id('reader-control-content-host')
    .width(this.frame().content.width).height(this.frame().content.height);
  }

  @Builder
  private appearanceContent() {
    ReaderControlAppearanceContent({
      fixedIsland: this.fixedIsland,
      verificationSession: this.verificationSession,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('appearance', identity, measurer),
      expandedLayout: this.isExpanded(),
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      fullContentHeight: this.contentEndpointHeight(true),
      interactionEnabled: this.secondaryModuleInputEnabled('appearance'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('appearance'),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: this.moduleTemporaryLayerHandler('appearance'),
      reduceMotion: this.reduceMotion,
      motionProgress: this.contentMotionProgress,
      snapshot: this.appearanceSnapshot,
      chineseConversionMode: this.chineseConversionMode,
      pageTurnStyle: readerPageTurnStyle(this.settingsSnapshot),
      pageTurnSimulationAvailable: this.pageTurnSimulationAvailable,
      onThemeChange: (theme: ReaderAppearanceTheme): void => this.onAppearanceThemeChange(theme),
      onSetDayTheme: (theme: ReaderAppearanceTheme): void => this.onAppearanceDayThemeChange(theme),
      onSetNightTheme: (theme: ReaderAppearanceTheme): void => this.onAppearanceNightThemeChange(theme),
      onFontChange: (font: ReaderAppearanceFont): void => this.onAppearanceFontChange(font),
      onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
        this.onAppearanceFontOrderChange(fontOrder),
      onFontReorderActivityChange: (active: boolean): void =>
        this.setAppearanceFontReorderActivity(active),
      onCustomFontImport: (): void => this.onAppearanceCustomFontImport(),
      onIndentRequest: (indent: ReaderAppearanceIndent): void => this.onAppearanceIndentRequest(indent),
      onAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
        this.onAppearanceAlignmentRequest(current),
      onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
        this.onAppearanceMetricStep(metric, direction),
      chineseConversionIdentity: this.chineseConversionIdentity,
      onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string): void =>
        this.onChineseConversionChange(mode, identity),
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        this.onPageTurnStyleChange(style),
    });
  }

  private secondaryModuleInputEnabled(module: string): boolean {
    return this.runtimeMounted && !this.moreMenuVisible && this.contentLocation().level === 'secondary' &&
      this.contentLocation().module === module && this.contentInputEnabled() &&
      (!this.preparedMinimumRequired || this.minimumInputReady());
  }

  private observeSearchResultList(scope: number, count: number): void {
    const verification = this.verificationSession;
    const location = this.contentLocation();
    if (!this.runtimeMounted || verification?.observing() !== true ||
      location.level !== 'secondary' || location.module !== 'search' || location.form !== 'quick' ||
      (scope === this.verifiedSearchResultScope && count === this.verifiedSearchResultCount)) return;
    this.verifiedSearchResultScope = scope;
    this.verifiedSearchResultCount = count;
    verification.effect('search-results', 'published', { scope, rowCount: count, form: 'quick', epoch: this.visualSession.epoch });
  }

  @Builder
  private searchModuleContent() {
    ReaderControlSearchContent({ editingHost: this.editingHost,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('search', identity, measurer),
      fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      interactionEnabled: this.secondaryModuleInputEnabled('search'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('search'),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: this.moduleTemporaryLayerHandler('search'),
      editorInputCurrent: (): boolean => this.moduleEditorInputEnabled('search'),
      query: this.searchQuery,
      onlineBook: this.sourceId !== 'local' && (this.sourceId?.length ?? 0) > 0,
      searchPublication: this.searchPublication,
      searchRevision: this.searchRevision,
      onBack: (): void => this.requestPage('home', 'module-back'),
      onQueryChange: (query: string): void => this.onSearchQueryChange(query),
      onSearch: (): void => this.onSearch(),
      onLoadMore: (): void => this.onSearchLoadMore(),
      onNeedMore: (): void => this.onSearchNeedMore(),
      onResultListPublished: (scope: number, count: number): void => this.observeSearchResultList(scope, count),
      onSelectResult: (result: ReadingContentSearchResult, scope: number, ordinal: number): void =>
        this.onSearchResultSelect(result, scope, ordinal),
    });
  }

  @Builder
  private settingsModuleContent() {
    ReaderControlSettingsContent({
      fixedIsland: this.fixedIsland,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('settings', identity, measurer),
      fullViewportHeight: this.contentEndpointHeight(true),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      interactionEnabled: this.secondaryModuleInputEnabled('settings'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('settings'),
      snapshot: this.settingsSnapshot,
      widePageLayoutAvailable: this.isExpanded(), widePageLayout: this.widePageLayout,
      onWidePageLayoutChange: (value: ReaderWidePageLayout): void => {
        if (this.isExpanded() && this.secondaryModuleInputEnabled('settings')) this.onWidePageLayoutChange(value);
      },
      pageTurnSimulationAvailable: this.pageTurnSimulationAvailable,
      justifyText: this.appearanceSnapshot.alignment === 'justify',
      onJustifyTextChange: (_value: boolean): void =>
        this.onAppearanceAlignmentRequest(this.appearanceSnapshot.alignment),
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        this.onPageTurnStyleChange(style),
      onScreenDirectionChange: (direction: ReaderScreenDirection): void =>
        this.onScreenDirectionChange(direction),
      onScreenTimeoutChange: (timeout: ReaderScreenTimeout): void =>
        this.onScreenTimeoutChange(timeout),
      onToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void =>
        this.onSettingsToggleChange(key, value),
    });
  }

  @Builder
  private ttsModuleContent() {
    ReaderControlTtsContent({
      fixedIsland: this.fixedIsland,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
        profileReader?: ReaderControlPlaybackProfileReader): void => this.bindModuleMinimum('tts', identity, measurer, profileReader),
      sourceDetached: this.launchSourceDetached('tts'),
      sourceHandoffPending: this.launchRecovering,
      reduceMotion: this.reduceMotion,
      waveformActive: this.frame().visibility > 0 && !this.launchSourceDetached('tts') && !this.controlObscured,
      onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => this.onLaunchSourceVisible(kind),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: this.moduleTemporaryLayerHandler('tts'),
      fullViewportHeight: this.contentEndpointHeight(true),
      motionProgress: this.contentMotionProgress,
      form: this.contentLocation().form,
      expandedLayout: this.isExpanded(),
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      interactionEnabled: this.secondaryModuleInputEnabled('tts'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('tts'),
      editorInputCurrent: (): boolean => this.moduleEditorInputEnabled('tts'),
      state: this.ttsState,
      timerMode: this.ttsTimerMode,
      timerMinutes: this.ttsTimerMinutes,
      timerSeconds: this.ttsTimerSeconds,
      followHighlight: this.ttsFollowHighlight,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      backgroundPlayback: this.ttsBackgroundPlayback,
      keepScreenOn: this.ttsKeepScreenOn,
      failurePolicy: this.ttsFailurePolicy,
      engine: this.ttsEngine,
      httpEngines: this.ttsHttpEngines,
      configurationRecovery: this.ttsConfigurationRecovery,
      configurationLoading: this.ttsConfigurationLoading,
      configurationLoadFailed: this.ttsConfigurationLoadFailed,
      voiceOptions: this.ttsVoiceOptions,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      onToggle: (): void => this.onTtsToggle(),
      onStop: (): void => this.onTtsStop(),
      onPrevious: (): void => this.onTtsPrevious(),
      onNext: (): void => this.onTtsNext(),
      onSeek: (sliceIndex: number): void => this.onTtsSeek(sliceIndex),
      onRateChange: (rate: number, onDeclined?: () => void): void => this.onTtsRateChange(rate, onDeclined),
      onTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode): void =>
        this.onTtsTimerChange(minutes, seconds, mode),
      onFollowHighlightChange: (enabled: boolean): void => this.onTtsFollowHighlightChange(enabled),
      onPauseOnInterruptionChange: (enabled: boolean): void =>
        this.onTtsPauseOnInterruptionChange(enabled),
      onAllowMixingChange: (enabled: boolean): void => this.onTtsAllowMixingChange(enabled),
      onBackgroundPlaybackChange: (enabled: boolean): void => this.onTtsBackgroundPlaybackChange(enabled),
      onKeepScreenOnChange: (enabled: boolean): void => this.onTtsKeepScreenOnChange(enabled),
      onFailurePolicyChange: (policy: 'skip' | 'stop'): void => this.onTtsFailurePolicyChange(policy),
      onVoiceChange: (language: string, person: number): void => this.onTtsVoiceChange(language, person),
      onVoiceAudition: (language: string, person: number): Promise<void> => this.onTtsVoiceAudition(language, person),
      onAuditionStop: (): void => this.onTtsAuditionStop(),
      onEngineChange: (engine: string): Promise<void> => this.onTtsEngineChange(engine),
      onHttpEnginePut: (config: ReaderTtsConfigurationDraft): Promise<void> => this.onTtsHttpEnginePut(config),
      onHttpEngineDelete: (id: number): Promise<void> => this.onTtsHttpEngineDelete(id),
      onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
        width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
    });
  }

  @Builder
  private autoPageModuleContent() {
        ReaderControlAutoPageContent({
          fixedIsland: this.fixedIsland,
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
            profileReader?: ReaderControlPlaybackProfileReader): void => this.bindModuleMinimum('autoPage', identity, measurer, profileReader),
          sourceDetached: this.launchSourceDetached('autoPage'),
          sourceHandoffPending: this.launchRecovering,
          onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => this.onLaunchSourceVisible(kind),
          fullViewportHeight: this.contentEndpointHeight(true),
          expandedLayout: this.isExpanded(), motionProgress: this.contentMotionProgress,
          form: this.contentLocation().form,
          availableWidth: this.contentMotionWidth,
          availableHeight: this.contentEditingHeight(),
          interactionEnabled: this.secondaryModuleInputEnabled('autoPage'),
          inputCurrent: (): boolean => this.secondaryModuleInputEnabled('autoPage'),
          canPreviousChapter: this.canStepChapter(-1),
          canNextChapter: this.canStepChapter(1),
          status: this.autoPageStatus, speedSeconds: this.autoPageSpeedSeconds,
          timerMinutes: this.autoPageTimerMinutes, timerSeconds: this.autoPageTimerSeconds,
          timerSummaryText: this.autoPageTimerSummaryText, followHighlight: this.autoPageFollowHighlight,
          onBack: (): void => this.requestPage('home', 'module-back'),
          onPreviousChapter: (): void => this.onPreviousChapter(),
          onToggleRunning: (): void => this.onAutoPageToggle(),
          onStop: (): void => this.onAutoPageStop(),
          onNextChapter: (): void => this.onNextChapter(),
          onTimerChange: (minutes: number, seconds: number): void =>
            this.onAutoPageFullTimerChange(minutes, seconds),
          onSpeedChange: (seconds: number, onDeclined?: () => void): void =>
            this.onAutoPageFullSpeedChange(seconds, onDeclined),
          onFollowHighlightChange: (enabled: boolean): void => this.onAutoPageFollowHighlightChange(enabled),
          onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
            width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
        });
  }

  @Builder
  private replaceModuleContent() {
        ReaderControlReplaceContent({
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.preparedMinimumRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
            this.bindModuleMinimum('replace', identity, measurer),
          fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
          state: this.controlReplaceState, motionProgress: this.contentMotionProgress,
          availableWidth: this.contentMotionWidth, availableHeight: this.contentEditingHeight(),
          interactionEnabled: this.secondaryModuleInputEnabled('replace'),
          inputCurrent: (): boolean => this.secondaryModuleInputEnabled('replace'),
          dismissTemporaryRevision: this.dismissTemporaryRevision, retireTemporaryRevision: this.retireTemporaryRevision,
          onTemporaryLayerChange: this.moduleTemporaryLayerHandler('replace'),
          onBack: (): void => this.requestPage('home', 'module-back'),
          onExpand: (): void => {
            if ((this.temporaryLayerKind !== '')) return;
            this.onInputActivity();
            this.applySemanticSession(expandReaderControlSession(this.controlSession,
              readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.reduceMotion)), 'replace-expand');
          },
          onReload: (operationId?: string): Promise<void> => this.onReloadControlReplace(operationId),
          onSave: (draft: ReaderControlReplaceDraft): Promise<void> => this.onSaveControlReplace(draft),
          onToggle: (rule: ReaderReplaceRule, value: boolean): Promise<void> => this.onToggleControlReplace(rule, value),
          onDelete: (rule: ReaderReplaceRule): Promise<void> => this.onDeleteControlReplace(rule),
          onPreview: (): Promise<ReaderReplacePreview> => this.onPreviewControlReplace(),
          onImport: (): Promise<void> => this.onImportControlReplace(),
          onExport: (): Promise<void> => this.onExportControlReplace(),
        });
  }

  @Builder
  private appearanceModuleContent() {
    this.appearanceContent();
  }

  @Builder
  private topBar() {
    ReaderReadingTopBar({ variant: 'reading', barWidth: this.currentLayout().topBarWidth, barHeight: this.currentLayout().topBarHeight,
      bookTitle: this.bookTitle, subtitle: this.topBarSubtitle(), scheme: this.appScheme,
      inputEnabled: this.inputEnabled, leading: (): void => { this.topBarBack(); }, trailing: (): void => { this.topBarActions(); },
    });
  }

  @Builder
  private topBarBack() {
    // The 24vp Back glyph retains its alignment inside a 44vp action target.
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image($r(this.appScheme === 'night' ? 'app.media.book_detail_back_theme_night' : 'app.media.book_detail_back'))
        .width(24)
        .height(24).accessibilityLevel('no');
    }
    .width(44)
    .height(44)
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .responseRegion(readerActionTouchRegion(44, 44))
    .attributeModifier(new ReaderActionAccessibility('退出阅读，返回上一页',
      this.topBarInputEnabled() && (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu'),
      false, true, new ReaderPressFeedback(Color.Transparent, this.appScheme, 999), 'nativeButton'))
    .accessibilityLevel(this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .onClick(this.controlActionHandler((): void => {
      if (this.topBarInputEnabled() && !this.controlObscured && this.temporaryLayerKind === '' && !this.moreMenuVisible) this.onExitReading();
    }));
  }

  private topBarInputEnabled(): boolean {
    return this.runtimeMounted && this.inputEnabled && (this.inputCurrent?.() ?? true) && !this.controlObscured &&
      this.currentLayout().topBarVisible && this.frame().topBar.opacity > 0;
  }

  private sourceActionHeight(): number {
    return Math.max(44, this.currentLayout().topBarHeight - 10);
  }

  @Builder
  private sourceActionLabel() {
    Row({ space: 4 }) {
      Image($r(this.appScheme === 'night' ? 'app.media.rc_switch_horizontal_theme_night' : 'app.media.rc_switch_horizontal'))
        .width(14).height(14).accessibilityLevel('no');
      Text('换源').fontFamily(TYPE_READER_CONTROL_SOURCE_ACTION.fontFamily)
        .fontWeight(TYPE_READER_CONTROL_SOURCE_ACTION.fontWeight, { enableVariableFontWeight: true })
        .fontSize(TYPE_READER_CONTROL_SOURCE_ACTION.fontSizeFp).lineHeight(TYPE_READER_CONTROL_SOURCE_ACTION.lineHeightFp)
        .halfLeading(true).fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1);
    }.justifyContent(FlexAlign.Center).opacity(this.isLocalBook() ? 0.45 : 1).accessibilityLevel('no-hide-descendants');
  }

  @Builder
  private topBarActions() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      this.sourceActionLabel();
    }.width(62).height(this.sourceActionHeight()).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .id(sourceSwitchTriggerFocusId(this.sourceId, this.sourceBookId, 'reader-control'))
    .responseRegion(readerActionTouchRegion(62, this.sourceActionHeight()))
    .attributeModifier(new ReaderActionAccessibility('换源',
      this.topBarInputEnabled() && (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu') && !this.isLocalBook(),
      false, true, new ReaderPressFeedback(Color.Transparent, this.appScheme, 999), 'nativeButton'))
    .accessibilityLevel(this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .onClick(this.controlActionHandler((): void => {
      // 本地书籍换源置灰不可点; 仅在线书籍可换源。
      if (this.topBarInputEnabled() && !this.controlObscured && this.temporaryLayerKind === '' && !this.moreMenuVisible && !this.isLocalBook()) {
        this.onSourceSwitch(sourceSwitchTriggerFocusId(this.sourceId, this.sourceBookId, 'reader-control'));
      }
    }));

    // 20vp 图标在独立的 44vp 响应区内居中。
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image($r(this.appScheme === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots'))
        .width(20)
        .height(20).accessibilityLevel('no');
    }
    .width(44)
    .height(44)
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .responseRegion(readerActionTouchRegion(44, 44))
    .id('reader-control-more')
    .attributeModifier(new ReaderActionAccessibility('更多',
      this.topBarInputEnabled() && !this.controlObscured && (this.temporaryLayerKind === '' || this.moreMenuVisible), false, true,
      new ReaderPressFeedback(Color.Transparent, this.appScheme, 999), 'nativeButton'))
    .onClick(this.controlActionHandler((): void => { if (this.topBarInputEnabled()) this.setMoreMenuVisible(!this.moreMenuVisible); }))
    .onAreaChange((_previous: Area, area: Area): void => this.recordMoreAnchor(area, false))
    .bindPopup(this.moreMenuVisible && this.currentLayout().topBarVisible, this.readerMorePopupOptions(this.moreMenuGeneration));
  }

  private shortWindowActionInput(): boolean {
    return this.runtimeMounted && !this.currentLayout().topBarVisible && this.contentLocation().level === 'home' && this.contentInputEnabled();
  }

  @Builder
  private shortWindowActions() {
    Scroll() {
    Row({ space: 8 }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image($r(this.appScheme === 'night' ? 'app.media.book_detail_back_theme_night' : 'app.media.book_detail_back'))
          .width(24).height(24).accessibilityLevel('no');
      }.width(44).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999))
        .enabled(this.shortWindowActionInput() && (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu'))
        .accessibilityLevel(this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu' ? 'no-hide-descendants' : 'auto')
        .accessibilityText('退出阅读，返回上一页')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && this.temporaryLayerKind === '' && !this.moreMenuVisible) this.onExitReading();
        }));
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.sourceActionLabel();
      }.width(76).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999))
        .id(sourceSwitchTriggerFocusId(this.sourceId, this.sourceBookId, 'reader-control-short'))
        .enabled(this.shortWindowActionInput() && (this.temporaryLayerKind === '' || this.temporaryLayerKind === 'moreMenu') && !this.isLocalBook())
        .accessibilityLevel(this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu' ? 'no-hide-descendants' : 'auto')
        .accessibilityText('换源')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && this.temporaryLayerKind === '' && !this.moreMenuVisible && !this.isLocalBook())
            this.onSourceSwitch(sourceSwitchTriggerFocusId(this.sourceId, this.sourceBookId, 'reader-control-short'));
        }));
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots')).width(20).height(20).accessibilityLevel('no');
      }.width(44).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999))
        .enabled(this.shortWindowActionInput() && (this.temporaryLayerKind === '' || this.moreMenuVisible))
        .id('reader-control-more-short')
        .accessibilityText('更多')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && (this.temporaryLayerKind === '' || this.moreMenuVisible)) this.setMoreMenuVisible(!this.moreMenuVisible);
        }))
        .onAreaChange((_previous: Area, area: Area): void => this.recordMoreAnchor(area, true))
        .bindPopup(this.moreMenuVisible && !this.currentLayout().topBarVisible, this.readerMorePopupOptions(this.moreMenuGeneration));
    }.width(Math.max(180, this.frame().content.width)).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).justifyContent(FlexAlign.End);
    }.width(this.frame().content.width).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None).enableScrollInteraction(this.frame().content.width < 180).clip(true);
  }

  @State private quickOrModulePress: string = '';
  private quickOrModulePointer: number = -1;

  private observeQuickOrModulePress(event: TouchEvent, key: string, enabled: boolean): void {
    if (this.quickOrModulePress.length > 0 && this.quickOrModulePress !== key) return;
    const next = readerPressPointer(event, this.quickOrModulePointer, enabled);
    if (next === this.quickOrModulePointer) return;
    this.quickOrModulePointer = next;
    readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.quickOrModulePress = next < 0 ? '' : key; });
  }

  @Builder
  private quickActionPanel() {
    Row({ space: 8 }) {
      this.quickAction('rc_list', '目录', 'directory');
      this.quickAction('rc_search', '搜索', 'search');
      this.quickAction('rc_replace', '替换', 'replace');
    }
    .width('100%')
    .height(this.homeMetric('actionHeight', READER_CONTROL_HOME_QUICK_ACTION_HEIGHT))
    .padding({ left: 9, right: 9 })
    .attributeModifier(new ReaderPanelFrame('reader-card', this.appScheme));
  }

  @Builder
  private quickAction(icon: string, label: string, action: ReaderQuickAction) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column() {
        Image($r(`app.media.${this.quickActionIcon(icon)}`))
          .width(24)
          .height(24)
          .margin({ top: 4.72 });
        Text(label)
          .width('100%')
          .height(this.homeMetric('actionLabelHeight', 13))
          .fontFamily(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontFamily)
          .fontWeight(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontWeight)
          .fontSize(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontSizeFp)
          .lineHeight(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
          .textAlign(TextAlign.Center)
          .maxLines(this.selectedMinimumProfile() === undefined ? 1 : undefined)
          .margin({ top: 5.78 });
      }.width('100%').height('100%').alignItems(HorizontalAlign.Center).accessibilityLevel('no-hide-descendants')
        .backgroundColor(readerPressSurface(readerAppColor('TOK_READ_ELEVATED', this.appScheme), this.appScheme,
          this.quickOrModulePress === action, this.reduceMotion))
        .borderRadius(8).scale(readerPressScale(this.quickOrModulePress === action, this.reduceMotion))
        .opacity(readerPressOpacity(this.quickOrModulePress === action, this.reduceMotion));
    }
    .layoutWeight(1)
    .id('reader-control-entry-' + action)
    .height(55.438 + this.homeMetric('actionLabelHeight', 13) - 13)
    .padding(0)
    .backgroundColor(Color.Transparent)
    .borderRadius(8)
    .enabled(this.progressInputEnabled(true))
    .accessibilityLevel(this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .accessibilityText(label)
    .onTouch((event: TouchEvent): void => this.observeQuickOrModulePress(event, action, this.progressInputEnabled(true)))
    .onClick(this.controlActionHandler((): void => {
      if (!this.progressInputEnabled()) return;
      if (action === 'directory') {
        this.requestPage('moduleDirectory');
      } else if (action === 'search') {
        this.promoteSearch();
      } else if (action === 'replace') {
        this.onInputActivity();
        this.onOpenReplace();
      }
    }));
  }

  @Builder
  private homeContent() {
    Column({ space: READER_CONTROL_HOME_SECTION_GAP }) {
      this.quickActionPanel(); this.chapterProgress();
      if (!this.currentLayout().topBarVisible) this.shortWindowActions();
    }
      .width(this.frame().content.width).alignItems(HorizontalAlign.Start);
  }

  private homeContentMinimumHeight(): number {
    return this.homeChapterCardHeight() + this.homeMetric('actionHeight', READER_CONTROL_HOME_QUICK_ACTION_HEIGHT) +
      READER_CONTROL_HOME_SECTION_GAP +
      (this.currentLayout().topBarVisible ? 0 : READER_CONTROL_HOME_SHORT_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP);
  }

  private homeChapterCardHeight(): number {
    return Math.max(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, this.chapterTitleLaneHeight() +
      this.bookmarkLaneHeight() + this.progressLaneHeight() + TOK_BORDER_W * 2);
  }

  private chapterTitleLaneHeight(): number { return Math.max(36, this.homeMetric('chapterTitleHeight', 34)); }
  private bookmarkLaneHeight(): number {
    return Math.max(44, this.bookmarkPillHeight() + 4, this.homeMetric('actionLabelHeight', 13) + 16);
  }
  private bookmarkPillWidth(): number {
    // Four full-width glyphs at 11fp, plus the icon, gap, and side space.
    return 42 + Math.ceil(44 * Math.max(1, this.sessionFontScale));
  }
  private bookmarkPillHeight(): number {
    return Math.max(28, Math.ceil(15 * Math.max(1, this.sessionFontScale)) + 10);
  }
  private progressLaneHeight(): number { return Math.max(36, this.homeMetric('progressHeight', 50) - 14); }

  private onPageBookmarkStatusChanged(): void {
    const fill = this.pageBookmarkStatus === 'bookmarked' ? 1 : 0;
    if (fill === this.pageBookmarkFill) return;
    if (!this.runtimeMounted) { this.pageBookmarkFill = fill; return; }
    const lifecycle = this.runtimeLifecycle;
    const finish = (): void => {
      if (!this.reduceMotion && fill === 1 && this.runtimeMounted && this.runtimeLifecycle === lifecycle &&
        this.pageBookmarkFill === 1) {
        this.getUIContext().animateTo(readerMotionAnimateParam('reader.control.handle.snap', false),
          (): void => { this.pageBookmarkTuck = 1; });
      }
    };
    this.getUIContext().animateTo(this.reduceMotion ? readerMotionReducedFadeParam() :
      readerMotionAnimateParam(fill === 1 ? 'reader.bookmark.pill.add' : 'reader.bookmark.pill.remove', false, finish), (): void => {
      this.pageBookmarkFill = fill;
      this.pageBookmarkTuck = !this.reduceMotion && fill === 1 ? 1.025 : 1;
    });
  }

  @Builder
  private chapterProgress() {
    ReaderControlChapterProgressCard({
      appScheme: this.appScheme, chapterTitle: this.presentedHomeChapterTitle(),
      titleHeight: this.homeMetric('chapterTitleHeight', 34), titleLaneHeight: this.chapterTitleLaneHeight(),
      cardHeight: this.homeChapterCardHeight(), totalChapters: this.presentedHomeTotalChapters(),
      readableChapterPosition: this.readableChapterPosition, menuOccludesActions: this.moreMenuVisible || this.temporaryLayerKind === 'moreMenu',
      previousEnabled: this.progressInputEnabled(true) && this.canStepChapter(-1),
      nextEnabled: this.progressInputEnabled(true) && this.canStepChapter(1),
      actionScope: this.controlActionScope(),
      chapterActionsCurrent: (scope: string): boolean => this.controlActionScope() === scope &&
        this.progressInputEnabled(true) && !this.moreMenuVisible && this.temporaryLayerKind === '',
      bookmarkLaneHeight: this.bookmarkLaneHeight(), bookmarkWidth: this.bookmarkPillWidth(), bookmarkHeight: this.bookmarkPillHeight(),
      pageBookmarkStatus: this.pageBookmarkStatus, pageBookmarkEnabled: this.pageBookmarkEnabled,
      bookmarkInputEnabled: this.pageBookmarkEnabled && this.progressInputEnabled(true),
      quickOrModulePress: $quickOrModulePress, pageBookmarkFill: $pageBookmarkFill, pageBookmarkTuck: $pageBookmarkTuck,
      sessionFontScale: this.sessionFontScale, reduceMotion: this.reduceMotion,
      progressPercent: this.effectiveProgressPercent(), progressLabelWidth: this.homeMetric('percentWidth', 26.23),
      progressLaneHeight: this.progressLaneHeight(), progressInputRevision: this.progressInputRevision,
      onPreviousChapter: (): void => { if (this.progressInputEnabled() && this.canStepChapter(-1)) this.onPreviousChapter(); },
      onNextChapter: (): void => { if (this.progressInputEnabled() && this.canStepChapter(1)) this.onNextChapter(); },
      onBookmarkPress: (event: TouchEvent): void => this.observeQuickOrModulePress(event, 'bookmark',
        this.pageBookmarkEnabled && this.progressInputEnabled(true)),
      bookmarkClickHandler: (_scope: string): (() => void) => this.controlActionHandler((): void => {
        if (this.pageBookmarkEnabled && this.progressInputEnabled()) this.onTogglePageBookmark();
      }),
      progressChangeHandler: (revision: number): ((value: number, mode: SliderChangeMode) => void) =>
        this.progressChangeHandler(revision),
    });
  }

  private clampPercent(value: number): number {
    return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX, value));
  }

  private effectiveProgressPercent(): number {
    return this.progressPreviewPercent >= 0 ? this.progressPreviewPercent : this.clampPercent(this.progressPercent);
  }

  private progressInputEnabled(forAppearance: boolean = false): boolean {
    return this.runtimeMounted && this.contentLocation().level === 'home' && this.contentInputEnabled() &&
      (this.temporaryLayerKind === '' || (forAppearance && this.temporaryLayerKind === 'moreMenu')) &&
      (forAppearance || !this.moreMenuVisible);
  }

  private invalidateProgressInput(): void {
    this.progressInputRevision += 1;
    if (this.progressPreviewPercent >= 0) {
      this.progressPreviewPercent = -1;
      this.refreshDockPlacement();
    }
  }

  private syncProgressInput(): void {
    const scope = JSON.stringify([this.runtimeLifecycle, this.controlOpenRevision,
      this.runtime?.ticket() ?? -1, this.progressInputEnabled()]);
    if (scope === this.progressInputScope) return;
    this.progressInputScope = scope;
    this.invalidateProgressInput();
  }

  private progressChangeHandler(presentedRevision: number): (value: number, mode: SliderChangeMode) => void {
    return (value: number, mode: SliderChangeMode): void => {
      if (presentedRevision !== this.progressInputRevision || !this.progressInputEnabled() || !Number.isFinite(value)) return;
      this.progressPreviewPercent = this.clampPercent(value);
      if (mode === SliderChangeMode.End) {
        const committed = this.progressPreviewPercent;
        this.progressPreviewPercent = -1;
        this.onProgressChange(committed);
      }
      this.refreshDockPlacement();
    };
  }

  @Builder
  private brightnessRail() {
    Scroll() { this.brightnessRailContent(); }
      .width(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH).height(this.frame().brightness.height)
      .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
      .enableScrollInteraction(this.brightnessContentHeight() > this.frame().brightness.height)
      .clip(true);
  }

  private brightnessContentHeight(): number {
    const automatic = Math.max(44, this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE);
    const minimum = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH + READER_CONTROL_BRIGHTNESS_ICON_SIZE / 2 +
      READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE / 2 + 2 * READER_CONTROL_BRIGHTNESS_CONTROL_GAP + 44 +
      (automatic - READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE) / 2;
    return Math.max(this.frame().brightness.height, minimum);
  }

  private brightnessRequiresChildClip(): boolean {
    const budget = this.currentLayout().contentBudget;
    if (this.minimumIdentity.length === 0 || !this.minimumInputReady() ||
      budget?.brightnessAutoWidthVp === undefined || budget.brightnessAutoHeightVp === undefined) return true;
    const width = budget.brightnessAutoWidthVp;
    const height = budget.brightnessAutoHeightVp;
    const frame = this.frame().brightness;
    const contentHeight = this.brightnessContentHeight();
    const trackHeight = this.brightnessTrackHeight();
    const innerWidth = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2;
    // The measured A box, including its glyph, fits the bottom cap. The sun
    // shares the top cap center and the fill track stays in the straight span.
    return !Number.isFinite(width) || !Number.isFinite(height) ||
      width < READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE || height < READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE ||
      width > innerWidth || height > innerWidth ||
      width * width + height * height > READER_CONTROL_BRIGHTNESS_RAIL_WIDTH * READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(frame.width) || frame.width < READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(frame.height) || frame.height < 44 ||
      !Number.isFinite(contentHeight) || contentHeight < READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(trackHeight) || trackHeight < 44;
  }

  @Builder
  private brightnessRailContent() {
    Column() {
      // Icon/Sun 20×20 (rail 内水平居中, 中心对齐 19)。
      Image($r(this.appScheme === 'night' ? 'app.media.rc_sun_theme_night' : 'app.media.rc_sun'))
        .width(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
        .height(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
        // Column content starts inside its 1vp border; endpoint geometry is
        // measured from the outside of the rounded rail.
        .margin({ top: READER_CONTROL_BRIGHTNESS_ICON_TOP - TOK_BORDER_W });

      // The 8vp track fills the gap between the cap-centred endpoint icons;
      // its 44vp pointer target uses that same height. Gesture coordinates
      // are mapped to the whole authored track; an invisible OutSet slider
      // would retain an implicit thumb inset and shorten the usable range.
      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Bottom }) {
          Row()
            .width('100%').height(`${this.effectiveBrightnessPercent()}%`)
            .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme));
        }
        .width(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH).height('100%')
        .backgroundColor(readerAppColor('TOK_BORDER', this.appScheme))
        .borderRadius(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH / 2).clip(true)
        .hitTestBehavior(HitTestMode.None);
      }
      .width(READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH)
      .height(this.brightnessTrackHeight())
      .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
      .hitTestBehavior(HitTestMode.Block)
      .accessibilityText('阅读亮度').accessibilityLevel('no')
      .accessibilityVirtualNode(this.accessibleBrightnessActions)
      .gesture(
        GestureGroup(
          GestureMode.Exclusive,
          PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
            .onActionStart(this.controlActionHandler((): void => this.beginBrightnessDrag()))
            .onActionUpdate(this.brightnessGestureHandler((event: GestureEvent): void => {
              if (this.brightnessDragging) this.updateBrightnessDrag(event.offsetY);
            }))
            .onActionEnd(this.brightnessGestureHandler((event: GestureEvent): void => this.finishBrightnessDrag(event.offsetY)))
            .onActionCancel(this.controlActionHandler((): void => this.cancelBrightnessDrag())),
          TapGesture({ fingers: 1, count: 1 })
            .onAction(this.brightnessGestureHandler((event: GestureEvent): void => this.commitBrightnessTap(event))),
        ),
      );

      // Keep the measured circular A marker centred in its paid 44vp carrier.
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Stack({ alignContent: Alignment.Center }) {
          Text('A')
            .fontFamily(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontFamily)
            .fontWeight(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontWeight)
            .fontSize(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontSizeFp)
            .lineHeight(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.lineHeightFp as number)
            .fontColor(this.brightnessAutomatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_INK', this.appScheme))
            .textAlign(TextAlign.Center);
        }
        .width(this.currentLayout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .height(this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .backgroundColor(this.brightnessAutomatic ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme) : readerAppColor('TOK_READ_ELEVATED', this.appScheme))
        .border({ width: TOK_BORDER_W, color: this.brightnessAutomatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_LINE_STRONG', this.appScheme) })
        .borderRadius(Math.min(
          this.currentLayout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
          this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE) / 2).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }
      .width(Math.max(READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH,
        this.currentLayout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE))
      .height(Math.max(44, this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE))
      .padding(0).attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999, 999, this.brightnessInputEnabled()))
      .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
      // Preserve the authored palette while exposing the automatic/manual
      // state through the existing control opacity; no unapproved color is
      // introduced for the selected endpoint.
      .opacity(this.brightnessAutomatic ? 1 : 0.72)
      .accessibilityText(this.brightnessAutomatic ? '跟随系统亮度，已开启，点击改为手动' : '手动亮度，点击跟随系统')
      .onClick(this.controlActionHandler((): void => {
        if (!this.brightnessInputEnabled()) return;
        this.brightnessDragging = false;
        this.brightnessDragCurrent = undefined;
        this.brightnessPreviewPercent = -1;
        this.onBrightnessAuto();
      }));
    }
    .width(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH)
    .height(this.brightnessContentHeight())
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius(Math.min(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, this.brightnessContentHeight()) / 2)
    .clip(this.brightnessRequiresChildClip());
  }

  private brightnessTrackHeight(): number {
    return readerControlBrightnessTrackHeight(this.brightnessContentHeight(),
      Math.max(44, this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE));
  }

  private clampBrightness(value: number): number {
    return Math.max(READER_CONTROL_BRIGHTNESS_MIN, Math.min(READER_CONTROL_BRIGHTNESS_MAX, value));
  }

  private effectiveBrightnessPercent(): number {
    return this.brightnessPreviewPercent >= 0 ? this.brightnessPreviewPercent :
      this.clampBrightness(this.brightnessPercent);
  }

  @Builder
  private accessibleBrightnessActions() {
    Text(`降低阅读亮度，当前${Math.round(this.effectiveBrightnessPercent())}%，${this.brightnessAutomatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.brightnessInputEnabled() && this.effectiveBrightnessPercent() > READER_CONTROL_BRIGHTNESS_MIN)
      .onClick(this.controlActionHandler((): void => this.stepBrightness(-1)));
    Text(`提高阅读亮度，当前${Math.round(this.effectiveBrightnessPercent())}%，${this.brightnessAutomatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.brightnessInputEnabled() && this.effectiveBrightnessPercent() < READER_CONTROL_BRIGHTNESS_MAX)
      .onClick(this.controlActionHandler((): void => this.stepBrightness(1)));
  }

  private stepBrightness(direction: number): void {
    if (!this.brightnessInputEnabled()) return;
    const current = this.effectiveBrightnessPercent();
    const value = this.roundBrightness(current + direction);
    if (value !== current) this.onBrightnessChange(value);
  }

  private brightnessInputEnabled(): boolean {
    return this.runtimeMounted && this.contentInputEnabled() && this.temporaryLayerKind === '' &&
      !this.moreMenuVisible && this.frame().brightness.opacity > 0;
  }

  private beginBrightnessDrag(): void {
    if (!this.brightnessInputEnabled()) return;
    this.onInputActivity();
    this.brightnessDragCurrent = this.controlCallbackGuard();
    this.brightnessDragStartPercent = this.effectiveBrightnessPercent();
    this.brightnessPreviewPercent = this.brightnessDragStartPercent;
    this.brightnessDragging = true;
    this.brightnessLastEmittedPercent = this.brightnessDragStartPercent;
    this.refreshDockPlacement();
  }

  private updateBrightnessDrag(offsetY: number): void {
    if (!this.brightnessDragging) return;
    if (this.brightnessDragCurrent?.() === false) { this.cancelBrightnessDrag(); return; }
    if (!this.brightnessInputEnabled()) {
      this.cancelBrightnessDrag();
      return;
    }
    const trackHeight = this.brightnessTrackHeight();
    if (!Number.isFinite(offsetY) || trackHeight <= 0) {
      return;
    }
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    this.brightnessPreviewPercent = this.roundBrightness(
      this.brightnessDragStartPercent - offsetY / trackHeight * range,
    );
    // The window writer owns coalescing. Emit every changed sample, including
    // the final MOVE before a held pause; no UP-dependent trailing throttle.
    if (this.brightnessPreviewPercent !== this.brightnessLastEmittedPercent) {
      this.brightnessLastEmittedPercent = this.brightnessPreviewPercent;
      this.onBrightnessChange(this.brightnessPreviewPercent);
    }
  }

  private finishBrightnessDrag(offsetY: number): void {
    if (!this.brightnessDragging) return;
    if (this.brightnessDragCurrent?.() === false) { this.cancelBrightnessDrag(); return; }
    if (!this.brightnessInputEnabled()) {
      this.cancelBrightnessDrag();
      return;
    }
    this.updateBrightnessDrag(offsetY);
    this.brightnessDragging = false;
    this.brightnessDragCurrent = undefined;
    // Keep the optimistic rail until the latest native write is acknowledged.
    this.onBrightnessChange(this.effectiveBrightnessPercent());
    this.brightnessLastEmittedPercent = -1;
    this.refreshDockPlacement();
  }

  private onBrightnessConfirmed(): void {
    if (!this.brightnessDragging) this.brightnessPreviewPercent = -1;
  }

  private cancelBrightnessDrag(): void {
    if (!this.brightnessDragging) return;
    const current = this.brightnessDragCurrent?.() ?? true;
    this.brightnessDragging = false;
    this.brightnessDragCurrent = undefined;
    if (current) this.onBrightnessCancel();
    else this.brightnessPreviewPercent = -1;
    // Keep the current preview until the writer settles any already-issued
    // native call. onBrightnessConfirmed then projects that successful ACK.
    this.brightnessLastEmittedPercent = -1;
    this.refreshDockPlacement();
  }

  private commitBrightnessTap(event: GestureEvent): void {
    if (!this.brightnessInputEnabled() || event.fingerList.length === 0) {
      return;
    }
    const localY = event.fingerList[0].localY;
    const trackHeight = this.brightnessTrackHeight();
    if (!Number.isFinite(localY) || trackHeight <= 0) {
      return;
    }
    const clampedY = Math.max(0, Math.min(trackHeight, localY));
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    const value = READER_CONTROL_BRIGHTNESS_MIN +
      (1 - clampedY / trackHeight) * range;
    this.onBrightnessChange(this.roundBrightness(value));
  }

  private roundBrightness(value: number): number {
    const stepped = Math.round(value / READER_CONTROL_BRIGHTNESS_STEP) * READER_CONTROL_BRIGHTNESS_STEP;
    return this.clampBrightness(stepped);
  }
  private navigationInputEnabled(forAppearance: boolean = false): boolean {
    return this.controlActionInputEnabled(true, forAppearance) && (!this.preparedMinimumRequired || this.minimumPresentationAvailable()) &&
      (!this.preparedMinimumRequired || this.presentationReceipt?.environmentKey === this.minimumEnvironmentKey) &&
      this.frame().navigation.opacity > 0 && this.frame().navigation.height > 0;
  }

  @Builder
  private moduleNavBar() {
    ReaderControlModuleNavigation({
      appScheme: this.appScheme, activeModule: this.activeNavigationModule(),
      navHeight: this.currentLayout().contentBudget?.navigationHeightVp ?? this.geo.moduleNavH,
      topRadius: this.geo.moduleNavRadiusTop,
      labelHeight: this.selectedMinimumProfile()?.navigationLabelHeight ?? 13.889,
      hasMeasuredProfile: this.selectedMinimumProfile() !== undefined,
      ttsUnavailable: this.ttsState.status === 'unavailable', quickOrModulePress: $quickOrModulePress,
      reduceMotion: this.reduceMotion, actionEnabled: this.navigationInputEnabled(true),
      actionScope: this.controlActionScope(),
      onModulePress: (event: TouchEvent, module: ReaderControlNavigationModule): void =>
        this.observeQuickOrModulePress(event, module, this.navigationInputEnabled(true)),
      moduleClickHandler: (module: ReaderControlNavigationModule, _scope: string): (() => void) =>
        this.controlActionHandler((): void => { if (this.navigationInputEnabled()) void this.activateModule(module); }),
    });
  }

  private activeNavigationModule(): string {
    const location = this.contentLocation();
    return location.level === 'secondary' ? location.module : '';
  }

  private isActiveModule(module: string): boolean {
    const location = this.contentLocation();
    return location.level === 'secondary' && location.module === module;
  }

  private canStepChapter(delta: number): boolean {
    if (this.readableChapterPosition >= 0) {
      const target = this.readableChapterPosition + delta;
      return target >= 0 && target < this.totalChapters;
    }
    for (let position = 0; position < this.currentDirectoryEntries().length; position += 1) {
      if (this.currentDirectoryEntries()[position].index !== this.currentChapterIndex) continue;
      for (let target = position + delta; target >= 0 && target < this.currentDirectoryEntries().length; target += delta) {
        if (this.currentDirectoryEntries()[target].navigable !== false) return true;
      }
      return false;
    }
    return false;
  }

  private quickActionIcon(icon: string): string {
    if (this.appScheme === 'night') {
      if (icon === 'rc_search') return 'rc_search_theme_night';
      if (icon === 'rc_list') return 'rc_list_theme_night';
      if (icon === 'rc_replace') return 'rc_replace_theme_night';
    }
    return icon;
  }
}
