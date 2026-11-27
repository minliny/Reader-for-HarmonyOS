import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
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
import { TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL, TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL, TYPE_READER_CONTROLS_RETAINED_PROGRESS_ROW_LABEL, TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY } from '../../../ui/foundation/ReaderTypography';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerTtsWaveformSnapshot } from './ReaderTtsWaveform';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import { ReaderSessionLaunchStage } from './ReaderSessionLaunchStage';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerControlIsDirectSheet } from './ReaderControlHostSession';
import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { PopupSurfaceSpec, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderControlMotionFrameCache } from './ReaderControlMotionGeometry';
import { readerControlPlaybackProfileMatches, readerControlPlaybackSourceKindMatches, type ReaderControlPlaybackProfileData, type ReaderControlPlaybackProfileReader, type ReaderControlPlaybackProfileReceipt } from './ReaderControlPlaybackProfile';
import { FrameCallback } from '@kit.ArkUI';
import { readerControlMotionMs, sampleReaderControlMorphProgress } from './ReaderControlMotionPolicy';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderControlVerificationMotion, readReaderControlNativeActor, readReaderControlPopupOwner,
  type MotionActor, type ReaderControlPopupOwnerObservation, type ReaderControlVerificationLayoutInputs } from './ReaderControlVerificationMotion';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationRequest } from './ReaderControlVerificationSession';
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
import type { ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import { type ReaderAppearanceAlignment, type ReaderAppearanceFont, type ReaderAppearanceFontSlot, type ReaderAppearanceIndent, type ReaderAppearanceMetric, type ReaderAppearanceStepDirection, type ReaderAppearanceTheme } from '../application/ReaderAppearanceState';
import { ReaderControlSettingsContent } from './ReaderControlSettingsContent';
import { readerPageTurnStyle, type ReaderPageTurnStyle, type ReaderScreenDirection, type ReaderScreenTimeout, type ReaderSettingsToggleKey, type ReaderWidePageLayout } from '../application/ReaderSettingsState';
import type { ReaderTtsConfigurationDraft } from '../application/ReaderTtsConfigurationHost';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import {
  ReaderSessionMorphSourceMeasurement,
  readerSessionMorphActorId,
  type ReaderSessionMorphSourceKind,
} from './ReaderSessionMorphState';
import { type ReaderTtsTimerMode } from '../application/ReaderTtsState';
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
import type { ReaderReplaceRule, ReaderControlReplaceDraft } from '../application/ReaderReplaceQuickState';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { ReaderControlGeometry, READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH, READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE, READER_CONTROL_BRIGHTNESS_CONTROL_GAP, READER_CONTROL_BRIGHTNESS_ICON_SIZE, READER_CONTROL_BRIGHTNESS_ICON_TOP, READER_CONTROL_BRIGHTNESS_MAX, READER_CONTROL_BRIGHTNESS_MIN, READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, READER_CONTROL_BRIGHTNESS_STEP, READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH, READER_CONTROL_BRIGHTNESS_TRACK_WIDTH, READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT, READER_CONTROL_HOME_PROGRESS_ROW_HEIGHT, READER_CONTROL_HOME_QUICK_ACTION_HEIGHT, READER_CONTROL_HOME_SECTION_GAP, READER_CONTROL_HOME_SHORT_ACTION_HEIGHT, READER_CONTROL_TOP_BAR_HEIGHT, READER_CONTROL_PROGRESS_MAX, READER_CONTROL_PROGRESS_MIN, readerControlBrightnessTrackHeight } from './ReaderControlGeometry';
import { ReaderControlLayoutSnapshot, readerControlExtentFits, type ReaderControlCandidateWidths, type ReaderControlCandidateMinimum, type ReaderControlModuleMeasurer, type ReaderControlContentModule } from './ReaderLayoutGeometry';
import { ReaderControlPlacement, readerControlAlignment, readerControlDockLeft,
  type ReaderControlAlignment } from './ReaderControlPlacement';
import { subscribeReaderHoldingHand } from '../../../platform/interaction/HarmonyReaderGrip';
import type { ReaderHoldingHand } from '../../../platform/interaction/ReaderHoldingHand';
import { TYPE_READER_CONTROL_CHAPTER_TITLE, TYPE_READER_CONTROL_SOURCE_ACTION } from '../../../ui/foundation/ReaderTypography';

import curves from '@ohos.curves';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderControlDirectoryContent } from './ReaderControlDirectoryContent';
import { ReaderControlAppearanceContent, type ReaderControlFontOrderPresentation } from './ReaderControlAppearanceContent';
import type { ReaderControlPage } from './ReaderControlRouting';
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

import {
  createReaderControlFactDelivery, defaultReaderControlIntent, type ReaderControlFactWatch,
  type ReaderControlPanelFacts, type ReaderControlIntentHandler, type ReaderControlPanelFrame,
} from './ReaderControlPanelNativeContract';

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
  @ObjectLink @Watch('onPanelFrameChanged') panelFrame!: ReaderControlPanelFrame;
  onIntent: ReaderControlIntentHandler = defaultReaderControlIntent;
  private deliveredFrame: ReaderControlPanelFrame | undefined = undefined;
  private readonly factDelivery = createReaderControlFactDelivery();
  private readonly selectBookmark = (bookmarkId: string, chapterIndex: number, chapterOffset: number,
    positionScope?: RemoteReadingPositionScope): void => {
    this.onIntent({ kind: 'selectBookmark', bookmarkId, chapterIndex, chapterOffset, positionScope });
  };

  private currentFacts(): ReaderControlPanelFacts {
    return this.factDelivery.active() ?? this.panelFrame;
  }

  private onPanelFrameChanged(): void {
    const previous = this.deliveredFrame;
    const next = this.panelFrame;
    this.deliveredFrame = next;
    if (previous === undefined || previous === next) return;
    this.factDelivery.deliver(previous, next, (event: ReaderControlFactWatch): void => {
      switch (event) {
        case 'placement': this.refreshDockPlacement(); break;
        case 'launch': this.onLaunchSampleChanged(); break;
        case 'runtimeInput': this.onRuntimeEnabledChanged(); break;
        case 'openRevision': this.syncProgressInput(); break;
        case 'minimumIdentity': this.onMinimumIdentityChanged(); break;
        case 'minimumCommit': this.onCommittedMinimumIdentityChanged(); break;
        case 'measure': this.publishMinimumMeasurer(); break;
        case 'minimumMetrics': this.onMinimumMetricsChanged(); break;
        case 'receipt': this.onPresentationReceiptChanged(); break;
        case 'playbackMinimum': this.publishSelectedPlaybackProfile(); break;
        case 'minimumAvailability': this.onMinimumAvailabilityChanged(); break;
        case 'temporaryLayer': this.onTemporaryLayerActivityChanged(); break;
        case 'minimumFacts': this.onMinimumFactsPropsChanged(); break;
        case 'layout': this.onLayoutChanged(); break;
        case 'bookmark': this.onPageBookmarkStatusChanged(); break;
        case 'brightness': this.onBrightnessConfirmed(); break;
        case 'recovery': this.onRecoveryIdentityChanged(); break;
      }
    });
  }

  @StorageLink('readerControlAlignment') @Watch('refreshDockPlacement')
  private manualControlAlignment: string = 'center';
  @StorageLink('readerAppForeground') @Watch('refreshDockPlacement')
  private gripForeground: boolean = true;
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
    this.editingHost.mount({ current: (): boolean => this.runtimeMounted && this.currentFacts().geometry.inputEnabled && !this.currentFacts().geometry.obscured &&
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
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private navigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  private launchSourceVisibleGeneration: number = 0;
  private launchSourceVisibleKind: ReaderSessionMorphSourceKind | undefined = undefined;
  private launchSourceReadyGeneration: number = 0;
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
    const sample = this.currentFacts().launch.sample;
    if (sample === undefined) {
      this.launchNaturalMinimum = undefined;
      this.launchMotionBounds = undefined;
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
      return;
    }
    if (this.capturedLaunchGeneration === this.currentFacts().launch.generation) return;
    const bundleRequired = this.currentFacts().geometry.minimum.identity.length > 0;
    const source = this.currentFacts().launch.sourceMinimum;
    if (bundleRequired && (source === undefined || source.generation !== this.currentFacts().launch.generation ||
      !readerControlPlaybackSourceKindMatches(source.kind, sample.type))) return;
    const receipt = bundleRequired ? source?.receipt : undefined;
    const naturalContract = bundleRequired && source?.requiresNaturalProfile === true;
    if (bundleRequired && source?.requiresNaturalProfile === false && receipt !== undefined) return;
    if (naturalContract && (receipt === undefined || receipt.metricsRevision !== this.currentFacts().geometry.minimum.metricsRevision ||
      !readerControlPlaybackProfileMatches(receipt, sample.type,
      receipt.identity, receipt.key, receipt.metricsRevision))) return;
    this.capturedLaunchGeneration = this.currentFacts().launch.generation;
    this.launchWaveformSample = readerTtsWaveformSnapshot();
    if (this.launchSourceVisibleGeneration !== this.currentFacts().launch.generation) {
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
    }
    this.launchNaturalMinimum = naturalContract ? receipt : undefined;
    this.capturedLaunchSourceKind = bundleRequired && source !== undefined ? source.kind : this.currentFacts().launch.sourceKind;
    this.launchMotionProgress = naturalContract && source !== undefined ?
      (source.kind === 'fullTtsPlayback' || source.kind === 'fullAutoPagePlayback' ? 1 : 0) : this.contentMotionProgress;
    const measuredBounds = this.currentFacts().geometry.fixedIsland ? undefined : this.launchNaturalMinimum?.bounds;
    this.launchMotionBounds = measuredBounds ?? readerControlMotionBounds(this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget);
    const endpoint = sampleReaderControlMotionComposition({ visibilityProgress: 1,
      expansionProgress: this.launchMotionProgress }, this.launchMotionBounds);
    this.launchContentWidth = this.currentFacts().geometry.fixedIsland ? sample.sourceWidth :
      this.launchNaturalMinimum === undefined ? this.contentMotionWidth : endpoint.content.width;
    this.launchContentHeight = this.currentFacts().geometry.fixedIsland ? sample.sourceHeight :
      this.launchNaturalMinimum === undefined ? this.contentMotionHeight : endpoint.content.height;
    this.launchFullContentHeight = this.launchNaturalMinimum?.fullContentHeightVp ?? this.contentEndpointHeight(true);
    this.confirmLaunchSourceReady();
  }
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
  private moduleMinimumMeasurer: ReaderControlModuleMeasurer | undefined = undefined;
  private moduleMinimumProfileReader: ReaderControlPlaybackProfileReader | undefined = undefined;
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
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.currentFacts().document.catalog.publication?.entriesAt(this.currentFacts().document.catalog.revision) ?? this.currentFacts().document.catalog.defaultEntries;
  }
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
  @State private moreMenuVisible: boolean = false;
  @State private moreTopAnchor: ReaderRectVp | undefined = undefined;
  @State private moreShortAnchor: ReaderRectVp | undefined = undefined;
  private moreMenuGeneration: number = 0;
  private moreMenuRecoveryIdentity: string = '';
  private previousTopBarVisibility: boolean = true;
  private moreMenuMeasuredWidth: number = 0;
  private moreMenuWidthKey: string = '';
  private moreMenuOwnerScope: string = '';
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
    if (this.currentFacts().launch.ownsControls || this.currentFacts().launch.recovering) return;
    this.onIntent({ kind: 'sessionLaunchShellMeasured', topExit: this.currentLayout().topBarTop + this.currentLayout().topBarHeight, dockExit: this.currentLayout().viewportHeight - this.presentedDockTop() - this.frame().shell.y });
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
    this.onIntent({ kind: 'sessionMorphSourceMeasured', measurement: new ReaderSessionMorphSourceMeasurement(
      kind,
      readerSessionMorphActorId(kind),
      left - this.rootScreenX,
      top - this.rootScreenY,
      width,
      height,
      this.sessionMorphMeasurementRevision, visibleLeft, visibleTop, visibleRight, visibleBottom,
      this.currentFacts().geometry.fixedIsland || kind === 'quickAutoPage' ? 12 : kind === 'fullTtsPlayback' ? 14 : 8,
    ) });
  }

  private isLocalBook(): boolean {
    return this.currentFacts().document.source.id === 'local';
  }

  private sourceLabel(): string {
    const label = this.currentFacts().document.source.name.trim();
    if (this.isLocalBook()) {
      return label.length > 0 && label !== this.currentFacts().document.source.id ? label : '本地书籍';
    }
    return label.length > 0 && label !== this.currentFacts().document.source.id ? label : '在线书源';
  }

  private topBarSubtitle(): string {
    const chapter = this.currentFacts().document.chapterTitle.trim();
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
    this.deliveredFrame = this.panelFrame;
    this.mountEditingHost();
    this.runtimeMounted = true;
    this.pageBookmarkFill = this.currentFacts().document.bookmarks.pageStatus === 'bookmarked' ? 1 : 0;
    this.temporaryInputScope = (this.currentFacts().geometry.temporary.layer !== '') ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.currentFacts().geometry.temporary.layer;
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
    this.onIntent({ kind: 'minimumMeasurerReady', identity: this.currentFacts().geometry.minimum.identity, measurer: undefined });
    this.minimumFontsReady = false;
    this.minimumProfiles.clear();
    this.launchNaturalMinimum = undefined;
    this.launchMotionBounds = undefined;
    this.syncProgressInput();
    this.pendingRuntimeFrame = false;
    this.cancelBrightnessDrag();
    this.runtime?.stop();
    this.onIntent({ kind: 'backdropRegionsChange', regions: [], ready: false });
    this.onIntent({ kind: 'temporaryLayerChange', active: false });
    this.setAppearanceFontReorderActivity(false);
  }

  private runtimeConfig(): ReaderControlGestureConfig {
    return { axis: readerControlMotionAxis(readerControlMotionBounds(this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget),
      this.rootScreenY + this.presentedDockTop()), tapMaxDurationMs: 500, directionSlopVp: 8,
      settleDurationMs: readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.currentFacts().geometry.reduceMotion),
      showDurationMs: readerControlMotionMs(READER_CONTROL_OPEN_MS, this.currentFacts().geometry.reduceMotion),
      dismissDurationMs: readerControlMotionMs(READER_CONTROL_DISMISS_MS, this.currentFacts().geometry.reduceMotion), coordinatedMotion: true };
  }

  private configureRuntime(): void {
    const runtime = this.runtime;
    if (runtime === undefined) return;
    const verification = this.runtimeMounted ? this.currentFacts().geometry.verification : undefined;
    const request = verification?.current(this.visualSession);
    const observe = request !== undefined && request.direction === this.visualSession.transition?.kind;
    const update = runtime.configure(this.runtimeConfig(), observe);
    if (update.layoutRebase !== undefined) verification?.observeLayoutRebase(update.session, update.layoutRebase);
    this.acceptRuntime(update);
  }

  private acceptRuntime(update: ReaderControlRuntimeUpdate): void {
    if (!this.runtimeMounted) return;
    const observed = this.currentFacts().geometry.verification?.current(this.visualSession);
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
    if (sessionChanged) this.onIntent({ kind: 'visualSessionChange', state: update.session });
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
    this.directSheetClosing = this.currentFacts().geometry.directSheet && fromDirect && target.level === 'home';
    if (this.currentFacts().geometry.directSheet && !this.visualDirectSheet) this.directSheetReceipt = undefined;
    const previous = this.modulePaintKey;
    this.modulePaintKey = active;
    if (this.currentFacts().geometry.reduceMotion) {
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
        const verification = this.currentFacts().geometry.verification;
        const request = verification?.current(previous);
        // Use the component snapshot preceding this frame's publication. No
        // probe value is fed back to runtime or used to advance its clock.
        if (request !== undefined && previous.transition?.kind === request.direction) {
          this.recordVerificationFrame(request, previous, frameTimeNs, runtimeTickMs, ticket, false);
        }
        if (previous.epoch !== update.session.epoch && update.session.transition !== undefined) {
          verification?.accept('runtime-resume', previous, update.session, this.currentFacts().geometry.openRevision);
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
    const verification = this.currentFacts().geometry.verification;
    if (origin === 'grabber-down' && update.session.heldPointerId >= 0) this.verificationPointerStartY = this.runtime?.lastPointerY();
    verification?.accept(origin, previous, update.session, this.currentFacts().geometry.openRevision, update.releaseMotion, update.cancelMotion);
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
    const location = this.currentFacts().geometry.minimum.preparedRequired ? this.currentFacts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.controlSession) : this.contentLocation();
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
    const location = this.currentFacts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.controlSession);
    if (module === 'directory') {
      const inputs = JSON.stringify([this.currentFacts().geometry.minimum.identity, location.directoryTab, this.currentFacts().document.chapterIndex,
        this.currentFacts().document.catalog.complete, this.currentFacts().document.catalog.chapterCount, this.currentFacts().document.catalog.loading, this.currentFacts().document.catalog.loadFailed,
        this.currentFacts().document.catalog.position, this.currentFacts().document.totalChapters, this.currentFacts().document.readableChapterPosition, this.currentFacts().document.search.manga,
        this.currentFacts().document.bookmarks.loadFailed, this.currentFacts().document.bookmarks.message]);
      if (this.directoryMinimumFactsCache !== undefined && this.directoryMinimumEntries === this.currentDirectoryEntries() &&
        this.directoryMinimumBook === this.currentFacts().document.bookmarks.book && this.directoryMinimumInputs === inputs) {
        return this.directoryMinimumFactsCache;
      }
      const snapshot = readerControlDirectorySnapshot(this.currentDirectoryEntries(), location.directoryTab, '', true,
        this.currentFacts().document.chapterIndex, this.currentFacts().document.bookmarks.book, { complete: this.currentFacts().document.catalog.complete,
          chapterCount: this.currentFacts().document.catalog.chapterCount, loading: this.currentFacts().document.catalog.loading, loadFailed: this.currentFacts().document.catalog.loadFailed,
          currentPosition: this.currentFacts().document.catalog.position, readableChapterCount: this.currentFacts().document.totalChapters,
          readablePosition: this.currentFacts().document.readableChapterPosition }, this.currentFacts().document.search.manga);
      const facts: ReaderControlModuleFacts = { module: module, directory: readerControlDirectoryMinimumFacts({ snapshot: snapshot,
        tab: location.directoryTab, catalogComplete: this.currentFacts().document.catalog.complete,
        bookmarkLoadFailed: this.currentFacts().document.bookmarks.loadFailed, bookmarkLoadMessage: this.currentFacts().document.bookmarks.message }) };
      this.directoryMinimumEntries = this.currentDirectoryEntries();
      this.directoryMinimumBook = this.currentFacts().document.bookmarks.book;
      this.directoryMinimumInputs = inputs;
      this.directoryMinimumFactsCache = facts;
      return facts;
    }
    if (module === 'search') {
      const state = this.currentFacts().document.search.publication.stateAt(this.currentFacts().document.search.revision);
      return { module: module, search: readerControlSearchMinimumFacts({ query: this.currentFacts().document.search.query, state: state,
        onlineBook: this.currentFacts().document.source.id !== 'local' && (this.currentFacts().document.source.id?.length ?? 0) > 0,
        resultScope: this.currentFacts().document.search.publication.resultScrollScopeFor(state), retainedLoadMoreFailure: false }) };
    }
    if (module === 'settings') return { module: module, settings: readerControlSettingsMinimumFacts() };
    if (module === 'appearance') return { module: module, appearance: readerControlAppearanceMinimumFacts({
      snapshot: this.currentFacts().preferences.appearance, chineseConversionMode: this.currentFacts().preferences.conversion.mode }) };
    if (module === 'tts') return { module: module, tts: readerControlTtsMinimumFacts({ state: this.currentFacts().playback.speech.state,
      timerMode: this.currentFacts().playback.speech.timerMode, timerMinutes: this.currentFacts().playback.speech.timerMinutes, timerSeconds: this.currentFacts().playback.speech.timerSeconds,
      failurePolicy: this.currentFacts().playback.speech.failurePolicy, allowMixing: this.currentFacts().playback.speech.allowMixing, engine: this.currentFacts().playback.speech.engine,
      httpEngines: this.currentFacts().playback.speech.httpEngines, voiceOptions: this.currentFacts().playback.speech.voiceOptions, language: this.currentFacts().playback.speech.language,
      person: this.currentFacts().playback.speech.person, ratePreview: -1, serviceTab: '' }) };
    if (module === 'autoPage') return { module: module, autoPage: readerControlAutoPageMinimumFacts({
      status: this.currentFacts().playback.automatic.status, timerSummary: this.currentFacts().playback.automatic.timerSummary }) };
    if (module === 'replace') return { module: module, replace: readerControlReplaceMinimumFacts({
      state: this.currentFacts().document.replace, localError: '', layer: '', temporaryTitle: '', full: location.form === 'full' }) };
    return { module: 'home', home: { chapterTitle: this.currentFacts().document.chapterTitle, totalChapters: this.currentFacts().document.totalChapters } };
  }

  private presentedHomeChapterTitle(): string {
    return this.currentFacts().geometry.minimum.preparedRequired ? this.currentFacts().geometry.minimum.receipt?.facts?.home?.chapterTitle ?? '' : this.currentFacts().document.chapterTitle;
  }

  private presentedHomeTotalChapters(): number {
    return this.currentFacts().geometry.minimum.preparedRequired ? this.currentFacts().geometry.minimum.receipt?.facts?.home?.totalChapters ?? 0 : this.currentFacts().document.totalChapters;
  }

  private currentLayout(): ReaderControlLayoutSnapshot {
    const receipt = this.paintedPresentationReceipt();
    return this.currentFacts().geometry.minimum.preparedRequired && receipt !== undefined && receipt.ownerKey === this.currentFacts().geometry.minimum.ownerKey ? receipt.layout : this.currentFacts().geometry.layout;
  }

  private paintedPresentationReceipt(): ReaderControlPresentationReceipt | undefined {
    return this.directSheetClosing ? this.directSheetReceipt ?? this.currentFacts().geometry.minimum.receipt : this.currentFacts().geometry.minimum.receipt;
  }

  private currentMinimumKey(): string {
    return this.currentFacts().geometry.minimum.preparedRequired ? this.paintedPresentationReceipt()?.key ?? '' : this.currentFacts().geometry.minimum.key;
  }

  private currentMinimumIdentity(): string {
    return this.currentFacts().geometry.minimum.preparedRequired ? this.paintedPresentationReceipt()?.identity ?? '' : this.currentFacts().geometry.minimum.identity;
  }

  private committedMinimumIdentity(): string {
    return this.currentFacts().geometry.minimum.committedIdentity || this.currentFacts().geometry.minimum.identity;
  }

  private preparedMinimum(): ReaderControlPreparedModuleProfile | undefined {
    const prepared = this.minimumPresentationAvailable() ? this.paintedPresentationReceipt()?.prepared : undefined;
    if (prepared === undefined) return undefined;
    const scope = `${this.currentFacts().geometry.minimum.ownerKey}|${this.currentMinimumIdentity()}|${this.currentMoreMenuOwnerScope()}`;
    if (this.preparedInputSource !== prepared || this.preparedInputScope !== scope || this.preparedInputProfile === undefined) {
      this.preparedInputSource = prepared;
      this.preparedInputScope = scope;
      this.preparedInputProfile = { identity: prepared.identity, key: prepared.key, moduleData: prepared.moduleData,
        facts: prepared.facts, ownerCurrent: this.controlCallbackGuard() };
    }
    return this.preparedInputProfile;
  }

  private minimumPresentationAvailable(): boolean {
    if (!this.currentFacts().geometry.minimum.preparedRequired) return true;
    const receipt = this.paintedPresentationReceipt();
    return receipt !== undefined && receipt.ownerKey === this.currentFacts().geometry.minimum.ownerKey &&
      receipt.key === receipt.layout.minimumKey &&
      receipt.profile.identity === receipt.identity && (receipt.profile.module === 'home' ||
        (receipt.prepared !== undefined && receipt.prepared.identity === receipt.identity && receipt.prepared.key === receipt.key));
  }

  private onPresentationReceiptChanged(): void {
    if (!this.minimumPresentationAvailable()) return;
    const receipt = this.currentFacts().geometry.minimum.receipt;
    if (receipt === undefined || receipt.identity !== this.committedMinimumIdentity() || receipt.environmentKey !== this.currentFacts().geometry.minimum.environmentKey) return;
    const location = receipt.location;
    const previous = this.lastVisibleContentLocation;
    if (this.currentFacts().geometry.directSheet && location.level === 'secondary' && readerControlIsDirectSheet(location.module)) {
      this.directSheetReceipt = receipt;
    }
    if (this.currentFacts().geometry.directSheet && location.level === 'home' && previous.level === 'secondary' &&
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
    if (this.runtimeMounted) this.onIntent({ kind: 'temporaryLayerChange', active: false });
    this.onPresentationReceiptChanged();
  }

  private onModuleMinimumFactsChanged(identity: string, facts: ReaderControlModuleFacts): void {
    if (!this.runtimeMounted || identity !== this.currentFacts().geometry.minimum.identity || facts.module !== this.minimumModule()) return;
    const defaults = this.defaultMinimumFacts();
    this.minimumOwnerFactsSignature = readerControlModuleFactsGeometryKey(defaults);
    this.minimumOwnerFacts = defaults;
    this.localMinimumFacts = facts;
    this.publishMinimumMeasurer();
  }

  private onMinimumIdentityChanged(): void {
    if (this.moduleMinimumIdentity !== this.currentFacts().geometry.minimum.identity) {
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
    if (this.currentFacts().geometry.minimum.preparedRequired) {
      const receipt = this.currentFacts().geometry.minimum.receipt;
      const budget = receipt?.layout.contentBudget;
      const viewport = this.contentMotionProgress === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
      return this.minimumPresentationAvailable() && receipt !== undefined && receipt.identity === this.committedMinimumIdentity() &&
        receipt.environmentKey === this.currentFacts().geometry.minimum.environmentKey &&
        ((this.onIntent({ kind: 'minimumReceiptCurrent', key: receipt.key }) as boolean | undefined) ?? false) && viewport !== undefined && Number.isFinite(viewport) && viewport > 0;
    }
    const ready = this.currentFacts().geometry.minimum.identity.length === 0 ||
      (this.currentFacts().geometry.minimum.ready && this.currentFacts().geometry.minimum.key.startsWith(`${this.currentFacts().geometry.minimum.identity}|`) &&
        ((this.onIntent({ kind: 'minimumReceiptCurrent', key: this.currentFacts().geometry.minimum.key }) as boolean | undefined) ?? true));
    const budget = this.currentLayout().contentBudget;
    const viewport = this.contentMotionProgress === 1 ? budget?.fullContentHeightVp : budget?.quickContentHeightVp;
    return ready && (viewport === undefined || Number.isFinite(viewport) && viewport > 0);
  }

  private onMinimumAvailabilityChanged(): void {
    if (DEBUG && this.diagnosticReadyEvents < 32) {
      this.diagnosticReadyEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=ready-changed ready=%{public}s prefix=%{public}s effective=%{public}s input=%{public}s obscured=%{public}s',
        String(this.currentFacts().geometry.minimum.ready), String(this.currentFacts().geometry.minimum.key.startsWith(`${this.currentFacts().geometry.minimum.identity}|`)),
        String(this.minimumInputReady()), String(this.currentFacts().geometry.inputEnabled), String(this.currentFacts().geometry.obscured));
    }
    if (!this.minimumInputReady() || (this.brightnessDragging && this.brightnessDragCurrent?.() === false)) this.cancelBrightnessDrag();
    this.syncProgressInput();
    this.publishSelectedPlaybackProfile();
  }

  private bindModuleMinimum(module: ReaderControlContentModule, identity: string,
    measurer: ReaderControlModuleMeasurer | undefined, profileReader?: ReaderControlPlaybackProfileReader): void {
    if (this.currentFacts().geometry.minimum.preparedRequired) return;
    if (DEBUG && this.diagnosticBindGeneration < 32 && (identity !== this.diagnosticMinimumIdentity || module !== this.diagnosticMinimumModule ||
      measurer !== this.diagnosticMinimumMeasurer)) {
      this.diagnosticMinimumIdentity = identity;
      this.diagnosticMinimumModule = module;
      this.diagnosticMinimumMeasurer = measurer;
      this.diagnosticBindGeneration += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=module-bind generation=%{public}d mounted=%{public}s identityMatch=%{public}s moduleMatch=%{public}s hasDelegate=%{public}s',
        this.diagnosticBindGeneration, String(this.runtimeMounted), String(identity === this.currentFacts().geometry.minimum.identity),
        String(module === this.minimumModule()), String(measurer !== undefined));
    }
    if (!this.runtimeMounted || identity !== this.currentFacts().geometry.minimum.identity || module !== this.minimumModule()) return;
    this.moduleMinimumMeasurer = measurer;
    this.moduleMinimumProfileReader = profileReader;
    this.moduleMinimumIdentity = identity;
    this.moduleMinimumModule = module;
    this.publishMinimumMeasurer();
  }

  private publishMinimumMeasurer(): void {
    if (!this.runtimeMounted || !this.minimumFontsReady || this.currentFacts().geometry.minimum.identity.length === 0) return;
    const identity = this.currentFacts().geometry.minimum.identity;
    const module = this.minimumModule();
    if (this.currentFacts().geometry.minimum.preparedRequired) {
      const defaults = this.defaultMinimumFacts();
      const ownerSignature = readerControlModuleFactsGeometryKey(defaults);
      if (ownerSignature !== this.minimumOwnerFactsSignature || !readerControlModuleFactsDisplayEqual(defaults, this.minimumOwnerFacts)) {
        this.localMinimumFacts = undefined;
        this.minimumOwnerFactsSignature = ownerSignature;
        this.minimumOwnerFacts = defaults;
      }
      const facts = this.localMinimumFacts ?? defaults;
      const signature = JSON.stringify([identity, this.currentFacts().geometry.minimum.environmentKey, this.currentFacts().document.chapterTitle, this.currentFacts().document.totalChapters,
        readerControlModuleFactsGeometryKey(facts)]);
      if (signature === this.minimumFactsSignature && readerControlModuleFactsDisplayEqual(facts, this.publishedMinimumFacts)) return;
      this.minimumFactsSignature = signature;
      this.publishedMinimumFacts = facts;
      this.moduleMinimumIdentity = identity;
      this.moduleMinimumModule = module;
      this.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
          if (!this.runtimeMounted || identity !== this.currentFacts().geometry.minimum.identity || signature !== this.minimumFactsSignature ||
            facts !== this.publishedMinimumFacts ||
            module !== this.minimumModule()) return undefined;
          return this.measureControlMinimum(module, widths, key, undefined, undefined, facts);
        }, profileReader: this.minimumProfileReader, facts, factsGeometryKey: signature });
      return;
    }
    const delegate = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumMeasurer : undefined;
    const profileReader = this.moduleMinimumIdentity === identity && this.moduleMinimumModule === module ?
      this.moduleMinimumProfileReader : undefined;
    if (module !== 'home' && delegate === undefined) {
      this.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: undefined });
      return;
    }
    this.onIntent({ kind: 'minimumMeasurerReady', identity, measurer: (widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum | undefined => {
        if (!this.runtimeMounted || identity !== this.currentFacts().geometry.minimum.identity || module !== this.minimumModule()) return undefined;
        return this.measureControlMinimum(module, widths, key, delegate, profileReader);
      } });
  }

  private measureHomeForm(width: number): ReaderControlHomeFormProfile | undefined {
    const context = this.getUIContext();
    const title = measureReaderControlText(context, this.currentFacts().document.chapterTitle,
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
    const availableWithTopBar = this.currentFacts().geometry.layout.fullPanelHeight + this.currentFacts().geometry.layout.fullPanelTop -
      Math.max(READER_FULL_PANEL_TOP, this.currentFacts().geometry.layout.topBarTop + topBarHeight + 8);
    const location = this.currentFacts().geometry.minimum.preparedRequired ? this.currentFacts().geometry.minimum.requestLocation ?? readerControlContentLocation(this.controlSession) : this.contentLocation();
    const measured = measureReaderControlMinimum({ context: this.getUIContext(), headerInter: this.minimumHeaderInter(module),
      title: this.minimumTitle(module, location.directoryTab), identity: this.currentFacts().geometry.minimum.identity, metricsRevision: this.currentFacts().geometry.minimum.metricsRevision,
      topBarHeightVp: topBarHeight, availableWithTopBarHeightVp: availableWithTopBar,
      moduleFacts: facts, preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
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
    if (this.currentFacts().geometry.minimum.preparedRequired) return this.minimumPresentationAvailable() ? this.currentFacts().geometry.minimum.receipt?.profile : undefined;
    return this.currentFacts().geometry.minimum.key.length > 0 ? this.minimumProfiles.get(this.currentFacts().geometry.minimum.key) : undefined;
  }

  private publishSelectedPlaybackProfile(): void {
    const profile = this.selectedMinimumProfile();
    const module = this.currentFacts().geometry.minimum.preparedRequired ? profile?.module : this.minimumModule();
    const identity = this.currentFacts().geometry.minimum.preparedRequired ? this.committedMinimumIdentity() : this.currentFacts().geometry.minimum.identity;
    const key = this.currentMinimumKey();
    if (!this.runtimeMounted || !this.currentFacts().geometry.minimum.ready ||
      (module !== 'tts' && module !== 'autoPage') || profile === undefined || profile.playbackData === undefined ||
      profile.module !== module || profile.identity !== identity ||
      (this.currentFacts().geometry.minimum.preparedRequired && (!this.minimumInputReady() || !this.minimumPresentationAvailable())) ||
      (!this.currentFacts().geometry.minimum.preparedRequired && profile.metricsRevision !== this.currentFacts().geometry.minimum.metricsRevision) || this.currentLayout().minimumKey !== key ||
      !key.startsWith(`${identity}|`) ||
      profile.widths.panelWidthVp !== this.currentLayout().fullPanelWidth) return;
    const facts = this.currentFacts().geometry.minimum.receipt?.facts;
    const layout = this.currentLayout();
    const budget = layout.contentBudget;
    if (budget === undefined) return;
    const data: ReaderControlPlaybackProfileData = this.currentFacts().geometry.minimum.preparedRequired ? {
      tts: profile.playbackData.tts, autoPage: profile.playbackData.autoPage,
      ttsPlaybackErrorHeight: profile.playbackData.ttsPlaybackErrorHeight,
      ttsFacts: facts?.tts, autoPageFacts: facts?.autoPage,
    } : profile.playbackData;
    const receipt: ReaderControlPlaybackProfileReceipt = { module: module, identity: profile.identity,
      key: key, metricsRevision: this.currentFacts().geometry.minimum.metricsRevision, widths: profile.widths,
      data: data, layout: layout,
      // The prepared profile describes the measurement candidate. The
      // visible card and fixed island shell are captured separately at launch.
      bounds: readerControlMotionBounds(layout.fullPanelWidth, layout.fullPanelHeight,
        layout.dockBottomGap, layout.quickPanelHeight, budget),
      quickContentHeightVp: budget.quickContentHeightVp, fullContentHeightVp: budget.fullContentHeightVp };
    if (readerControlPlaybackProfileMatches(receipt, module, identity,
      key, this.currentFacts().geometry.minimum.metricsRevision)) this.onIntent({ kind: 'playbackProfileSelected', receipt });
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
    if (this.moreMenuVisible && (!this.currentFacts().geometry.inputEnabled || this.currentFacts().geometry.obscured)) this.dismissMoreMenu();
    if (this.runtime !== undefined) {
      this.acceptRuntime(this.runtime.setEnabled((this.currentFacts().geometry.inputEnabled || this.currentFacts().launch.recovering) && !this.currentFacts().geometry.obscured));
    }
    this.syncProgressInput();
    if (!this.currentFacts().geometry.inputEnabled || this.currentFacts().geometry.obscured) this.placementPointers.clear();
    this.refreshDockPlacement();
  }

  private onTemporaryLayerActivityChanged(): void {
    this.temporaryInputScope = (this.currentFacts().geometry.temporary.layer !== '') ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.currentFacts().geometry.temporary.layer;
    if (DEBUG && this.diagnosticTemporaryEvents < 32) {
      this.diagnosticTemporaryEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=temporary-changed active=%{public}s ready=%{public}s input=%{public}s obscured=%{public}s',
        String((this.currentFacts().geometry.temporary.layer !== '')), String(this.minimumInputReady()),
        String(this.currentFacts().geometry.inputEnabled), String(this.currentFacts().geometry.obscured));
    }
    if ((this.currentFacts().geometry.temporary.layer !== '')) this.cancelBrightnessDrag();
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
    if (this.currentFacts().geometry.fixedIsland) return;
    const runtime = this.runtime;
    if (DEBUG) {
      if (event.type === TouchType.Down) this.diagnosticControlMoveLogged = false;
      if (event.type === TouchType.Down || event.type === TouchType.Up || event.type === TouchType.Cancel ||
        (event.type === TouchType.Move && !this.diagnosticControlMoveLogged)) {
        if (event.type === TouchType.Move) this.diagnosticControlMoveLogged = true;
        hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=control-touch type=%{public}d ready=%{public}s owner=%{public}d input=%{public}s obscured=%{public}s',
          event.type, String(this.minimumInputReady()), runtime?.owner() ?? -1,
          String(this.currentFacts().geometry.inputEnabled), String(this.currentFacts().geometry.obscured));
      }
    }
    if (!this.runtimeMounted || runtime === undefined || !this.currentFacts().geometry.inputEnabled || this.currentFacts().geometry.obscured) return;
    if (event.type === TouchType.Cancel) {
      if (runtime.owner() >= 0) event.stopPropagation();
      this.acceptVerificationGesture(
        runtime.cancel(this.currentFacts().geometry.verification?.observing() === true), 'grabber-cancel'); return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      // A successor measurement fences new gestures, not the original
      // pointer's Move/Up/Cancel while its accepted runtime rebases the axis.
      if ((this.onIntent({ kind: 'inputCurrent' }) as boolean | undefined) === false || !this.minimumInputReady()) return;
      if (pointers.length > 0 && runtime.owner() < 0 && this.currentFacts().geometry.temporary.layer === '') {
        this.onIntent({ kind: 'inputActivity' });
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
        runtime.up(pointer.id, pointer.windowY, time, this.currentFacts().geometry.verification?.observing() === true), 'grabber-release');
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
        if (this.controlActionInputEnabled()) { this.onIntent({ kind: 'inputActivity' }); this.onIntent({ kind: 'dismiss' }); }
      }));
    if (!this.currentFacts().geometry.fixedIsland && this.contentLocation().level === 'secondary') {
      Text(this.contentLocation().form === 'full' ? '收回快捷控制栏' : '展开完整控制栏')
        .width(1).height(1).accessibilityRole(AccessibilityRoleType.BUTTON)
        .enabled(this.controlActionInputEnabled() && this.contentInputEnabled())
        .onClick(this.controlActionHandler((): void => {
          if (!this.controlActionInputEnabled() || !this.contentInputEnabled()) return;
          this.onIntent({ kind: 'inputActivity' });
          this.applySemanticSession(toggleReaderControlSession(this.visualSession,
            readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.currentFacts().geometry.reduceMotion)), 'grabber-accessibility');
        }));
    }
  }

  private isExpanded(): boolean { return this.currentLayout().isExpanded(); }

  private motionFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private quickEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private fullEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();

  private onLaunchSourceVisible(kind: ReaderSessionMorphSourceKind): void {
    if (!this.currentFacts().launch.recovering) return;
    const source = this.currentFacts().launch.sourceMinimum;
    const expected = source?.generation === this.currentFacts().launch.generation ? source.kind :
      this.capturedLaunchGeneration === this.currentFacts().launch.generation ? this.capturedLaunchSourceKind : undefined;
    if (expected !== undefined && kind !== expected) return;
    this.launchSourceVisibleGeneration = this.currentFacts().launch.generation;
    this.launchSourceVisibleKind = kind;
    this.confirmLaunchSourceReady();
  }

  private launchSourceDetached(type: ReaderSessionCapsuleType): boolean {
    return this.currentFacts().launch.sample?.type === type && (this.currentFacts().launch.ownsControls || this.currentFacts().launch.recovering);
  }

  private confirmLaunchSourceReady(): void {
    if (!this.currentFacts().launch.recovering || (this.currentFacts().geometry.fixedIsland && (this.launchSourceVisibleGeneration !== this.currentFacts().launch.generation ||
      this.launchSourceVisibleKind !== this.capturedLaunchSourceKind)) ||
      this.launchSourceReadyGeneration === this.currentFacts().launch.generation || this.visualVisibilityProgress < 1 ||
      !this.launchSourceCurrent()) return;
    this.launchSourceReadyGeneration = this.currentFacts().launch.generation;
    this.onIntent({ kind: 'launchSourceReady', generation: this.currentFacts().launch.generation });
  }

  private frame(): ReaderControlMotionFrame {
    const launch = this.currentFacts().launch.sample;
    if (launch !== undefined && (this.currentFacts().launch.ownsControls || this.currentFacts().launch.recovering)) {
      const heldBounds = this.capturedLaunchGeneration === this.currentFacts().launch.generation ? this.launchMotionBounds : undefined;
      const bounds = heldBounds ?? readerControlMotionBounds(this.currentLayout().fullPanelWidth,
        this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), this.currentLayout().contentBudget);
      const frame = this.launchFrameCache.sample(1, this.launchMotionProgress,
        bounds.width, bounds.fullHeight, bounds.bottomGap, bounds.quickHeight, 0, bounds.contentBudget,
        this.currentFacts().geometry.fixedIsland ? 'module' : 'legacy', this.currentFacts().geometry.reduceMotion);
      // Recovery shares the existing control Runtime clock. Rebase the actual
      // outgoing offsets rather than flashing at its unrelated hidden endpoint.
      const remainder = this.currentFacts().launch.recovering ? 1 - this.visualVisibilityProgress : 1;
      frame.topBar.translateY = this.currentFacts().geometry.reduceMotion ? 0 : launch.topBarOffsetY * remainder;
      frame.dock.translateY = this.currentFacts().geometry.reduceMotion ? 0 : launch.dockOffsetY * remainder;
      return frame;
    }
    if (this.currentFacts().geometry.directSheet && this.visualDirectSheet) {
      const layout = this.currentLayout();
      const height = this.controlPanelHeight();
      return this.motionFrameCache.sample(this.visualVisibilityProgress, 1, layout.fullPanelWidth, height,
        this.directSheetBottom(), this.controlQuickHeight(), 0, this.directSheetBudget(layout, height),
        'legacy', this.currentFacts().geometry.reduceMotion);
    }
    return this.motionFrameCache.sample(this.visualVisibilityProgress, this.visualExpansionProgress,
      this.currentLayout().fullPanelWidth, this.controlPanelHeight(), this.currentLayout().dockBottomGap,
      this.controlQuickHeight(), this.motionOffsetY, this.currentLayout().contentBudget,
      this.currentFacts().geometry.fixedIsland ? (this.contentLocation().level === 'secondary' ? 'module' : 'home') : 'legacy', this.currentFacts().geometry.reduceMotion);
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
    if (this.currentFacts().geometry.directSheet && this.visualDirectSheet) {
      const layout = this.currentLayout();
      const safeTop = readerVisualSafeTop(readerWindowMetrics());
      return layout.isExpanded() ? Math.max(0, layout.viewportHeight - this.directSheetBottom() - Math.max(12, safeTop)) :
        Math.min(layout.viewportHeight * .78, Math.max(0, layout.viewportHeight - safeTop));
    }
    if (this.currentFacts().geometry.fixedIsland) return readerControlIslandHeight(this.currentLayout().fullPanelHeight);
    if (this.currentLayout().quickPanelHeight !== undefined) return this.currentLayout().fullPanelHeight;
    return Math.min(Math.max(0, this.currentLayout().fullPanelHeight), this.isExpanded() ? 852 : 736);
  }

  private controlQuickHeight(): number {
    if (this.currentFacts().geometry.fixedIsland && !this.visualDirectSheet) return this.controlPanelHeight();
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
    if (full && this.currentFacts().geometry.directSheet && this.visualDirectSheet) return this.frame().content.height;
    if (this.currentFacts().geometry.fixedIsland) return this.frame().content.height;
    const cache = full ? this.fullEndpointCache : this.quickEndpointCache;
    return cache.sample(1, full ? 1 : 0, this.currentLayout().fullPanelWidth,
      this.controlPanelHeight(), this.currentLayout().dockBottomGap, this.controlQuickHeight(), 0, this.currentLayout().contentBudget).content.height;
  }

  private clockSample(fraction: number): number {
    const transition = this.visualSession.transition;
    if (transition === undefined) return fraction;
    if (this.currentFacts().geometry.reduceMotion) return this.expandCurve.interpolate(fraction);
    const direct = this.currentFacts().geometry.directSheet && (transition.fromLocation.level === 'secondary' &&
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
    const currentOwner = !this.currentFacts().geometry.minimum.preparedRequired || this.currentMinimumIdentity() === this.committedMinimumIdentity();
    return !this.directSheetClosing && currentOwner && this.currentFacts().geometry.inputEnabled && ((this.onIntent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.currentFacts().geometry.obscured &&
      (this.minimumInputReady() || this.hasCurrentTemporaryInput()) && visibility > 0 &&
      (this.visualTransitionKind === '' || this.visualTransitionKind === 'open') &&
      this.visualHeldPointerId < 0;
  }

  private currentTemporaryInputScope(): string {
    const location = this.contentLocation();
    return JSON.stringify([this.currentFacts().document.source.id, this.currentFacts().document.bookmarks.book?.libraryBookId ?? '',
      this.currentFacts().document.bookmarks.book?.bookId ?? this.currentFacts().document.bookTitle, this.currentFacts().geometry.openRevision,
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
        (this.currentFacts().geometry.minimum.preparedRequired && (identity !== this.committedMinimumIdentity() || identity !== this.currentMinimumIdentity()))) return;
      if (active && !this.minimumInputReady() && !this.hasCurrentTemporaryInput()) return;
      const oldKind = this.temporaryInputKind;
      this.temporaryInputKind = active ? kind : '';
      this.temporaryInputScope = active ? scope : '';
      this.endInlineEditing = active && kind === 'inlineEditor' ? endEditing : undefined;
      this.onIntent({ kind: 'temporaryLayerChange', active, layer: this.temporaryInputKind });
      const verification = this.currentFacts().geometry.verification;
      if (verification?.observing() === true && oldKind !== this.temporaryInputKind) {
        if (active) this.verificationLayerGeneration += 1;
        verification.layer(module, active, this.verificationLayerGeneration, this.visualSession,
          active ? kind : oldKind);
      }
      if (active && module === 'tts' && this.secondaryModuleInputEnabled('tts')) this.onIntent({ kind: 'ttsConfigurationOpen' });
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
    if (this.currentFacts().geometry.minimum.preparedRequired && this.onIntent !== defaultReaderControlIntent) {
      this.onIntent({ kind: 'sessionRequest', next, origin });
      return;
    }
    if (!readerControlSessionStateEquals(this.controlSession, next)) this.controlSession = next;
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(next));
  }

  private rememberVisibleContentLocation(state: ReaderControlSessionState): void {
    const location = readerControlContentLocation(state);
    if (this.currentFacts().geometry.directSheet && location.level === 'home' && state.transition?.fromLocation.level === 'secondary' &&
      readerControlIsDirectSheet(state.transition.fromLocation.module)) return;
    if (this.currentFacts().geometry.minimum.preparedRequired && (!this.minimumPresentationAvailable() ||
      this.currentFacts().geometry.minimum.receipt?.identity !== this.committedMinimumIdentity() ||
      (location.level === 'secondary' ? location.module : 'home') !== this.currentFacts().geometry.minimum.receipt?.profile.module)) return;
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
    const ready = this.dockMeasured && this.topBarRect.width > 0 && !this.currentFacts().geometry.obscured;
    const topBar = this.backdropRegions[1];
    topBar.x = this.topBarRect.x;
    topBar.y = this.topBarRect.y + frame.topBar.translateY;
    topBar.width = this.topBarRect.width;
    topBar.height = this.topBarRect.height;
    topBar.borderRadius = 24;
    this.onIntent({ kind: 'backdropRegionsChange', regions: this.backdropRegions, ready });
  }

  private requestPage(page: ReaderControlPage, origin: ReaderControlVerificationOrigin = 'module-button'): void {
    this.invalidateProgressInput();
    this.onIntent({ kind: 'inputActivity' });
    this.onIntent({ kind: 'pageChange', page, origin });
  }

  private controlActionInputEnabled(allowInlineEditor: boolean = false, forAppearance: boolean = false): boolean {
    const blockedByTemporaryInput = allowInlineEditor ? this.hasCurrentModalInput() : this.hasCurrentTemporaryInput();
    const moreOwnsInput = this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu';
    return this.runtimeMounted && this.currentFacts().geometry.inputEnabled && ((this.onIntent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.currentFacts().geometry.obscured &&
      (!this.currentFacts().geometry.minimum.preparedRequired || this.minimumPresentationAvailable()) &&
      (!blockedByTemporaryInput || (forAppearance && this.temporaryInputKind === 'moreMenu')) &&
      (forAppearance || !moreOwnsInput) && this.visualVisibilityProgress > 0 &&
      this.visualHeldPointerId < 0;
  }

  private collapseControl(): void {
    if (!this.controlActionInputEnabled() || this.contentLocation().level !== 'secondary') return;
    if (this.currentFacts().geometry.fixedIsland || this.currentFacts().geometry.directSheet && readerControlIsDirectSheet(this.contentLocation().module)) {
      this.requestPage('home');
      return;
    }
    this.onIntent({ kind: 'inputActivity' });
    // A collapse button can be tapped while a handle transition is still in
    // flight. Retarget from the exact local visual sample, not the sparse host
    // snapshot, so the shape/visibility path never jumps back to its command
    // origin before the runtime applies the module-specific settle timing.
    this.applySemanticSession(collapseReaderControlSession(this.visualSession,
      readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.currentFacts().geometry.reduceMotion)), 'header-collapse');
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
      this.onIntent({ kind: 'moduleSelect', module: destination === 'home' ? 'home' : module });
    } finally { this.navigationIntentPending = false; }
  }

  private promoteSearch(): void { this.requestPage('fullSearch'); }
  private setAppearanceFontReorderActivity(active: boolean): void {
    if (this.appearanceFontReorderActive === active) return;
    this.appearanceFontReorderActive = active;
    this.onIntent({ kind: 'appearanceFontReorderActivityChange', active });
  }

  private contentTitle(): string {
    return readerControlHeaderTitle(this.contentLocation().module, this.contentLocation().directoryTab);
  }

  private listSessionKey(): string {
    return `${this.currentFacts().document.source.id}:${this.currentFacts().document.bookTitle}:${this.currentFacts().geometry.openRevision}`;
  }

  private refreshDockPlacement(): void {
    if (!this.runtimeMounted) return;
    this.syncGripSubscription();
    if (this.placementTimer >= 0) clearTimeout(this.placementTimer);
    this.placementTimer = -1;
    const locked = this.visualHeldPointerId >= 0 || this.visualTransitionKind.length > 0 ||
      this.placementPointers.size > 0 || this.progressPreviewPercent >= 0 || this.brightnessDragging ||
      this.moreMenuVisible || this.currentFacts().geometry.temporary.layer !== '' || this.currentFacts().geometry.allowsTextSelection || this.currentFacts().geometry.obscured ||
      this.currentFacts().launch.sample !== undefined || !this.currentFacts().geometry.inputEnabled || !this.gripForeground;
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
    const requested = this.gripForeground && this.currentFacts().geometry.inputEnabled && !this.currentFacts().geometry.obscured && this.isExpanded() &&
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
    if (this.currentFacts().geometry.directSheet && this.visualDirectSheet && layout.isExpanded()) {
      return Math.max(0, layout.viewportWidth - layout.fullPanelWidth - Math.max(12, readerVisualSafeRight(readerWindowMetrics())));
    }
    return readerControlDockLeft(layout.viewportWidth, layout.fullPanelWidth, layout.fullPanelLeftGap,
      layout.fullPanelRightGap, this.dockAlignment);
  }

  private dockTop(): number {
    const bottom = this.currentFacts().geometry.directSheet && this.visualDirectSheet ? this.directSheetBottom() : this.currentLayout().dockBottomGap;
    return this.currentLayout().viewportHeight - bottom - this.controlPanelHeight();
  }

  private directSheetBottom(): number {
    return this.currentLayout().isExpanded() ? Math.max(12, readerVisualSafeBottom(readerWindowMetrics())) : 0;
  }

  private directSheetVisible(): boolean {
    return this.currentFacts().geometry.directSheet && this.visualDirectSheet && this.visualVisibilityProgress > 0;
  }

  private directSheetTranslation(): number {
    if (!this.directSheetVisible() || this.currentFacts().geometry.reduceMotion) return 0;
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
      if (this.controlActorsRetained || this.frame().visibility > 0 || this.currentFacts().launch.sample !== undefined) {
      Stack({ alignContent: Alignment.Top }) { this.topBar(); }
        .id('reader-control-motion-topbar')
        .width(this.currentLayout().topBarWidth).height(this.currentLayout().topBarHeight)
        .position({ x: (this.currentLayout().viewportWidth - this.currentLayout().topBarWidth) / 2,
          y: this.currentLayout().topBarTop })
        .translate({ y: this.frame().topBar.translateY }).opacity(this.currentLayout().topBarVisible ? this.frame().topBar.opacity : 0)
        .enabled(!this.directSheetVisible() && this.topBarInputEnabled() && this.frame().topBar.opacity > 0)
        .hitTestBehavior(!this.directSheetVisible() && this.currentLayout().topBarVisible && this.frame().topBar.opacity > 0 ? HitTestMode.Transparent : HitTestMode.None)
        .accessibilityLevel(this.currentLayout().topBarVisible && this.frame().topBar.opacity > 0 && (this.currentFacts().geometry.temporary.layer === '' || this.moreMenuVisible) ?
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
          .hitTestBehavior(this.currentFacts().geometry.temporary.layer === '' && (this.frame().header.opacity > 0 || this.contentLocation().module === 'replace') ?
            HitTestMode.Default : HitTestMode.None)
          .enabled(this.currentFacts().geometry.inputEnabled && this.frame().visibility > 0 && this.visualHeldPointerId < 0 &&
            (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') &&
            (this.frame().header.opacity > 0 || this.contentLocation().module === 'replace'))
          .accessibilityLevel((this.currentFacts().geometry.temporary.layer !== '') ? 'no-hide-descendants' : 'auto');
        this.headerAction();
        Stack({ alignContent: Alignment.TopStart }) { this.brightnessRail(); }
          .width(this.frame().brightness.width).height(this.frame().brightness.height)
          .position({ x: this.frame().brightness.x, y: this.frame().brightness.y })
          .opacity(this.frame().brightness.opacity)
          // HitTestMode.None excludes only this container, not its children.
          // Retain the authored actors, but retire the whole faded subtree.
          .enabled(this.contentInputEnabled() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') &&
            this.frame().brightness.opacity > 0)
          .hitTestBehavior(this.currentFacts().geometry.temporary.layer === '' && this.frame().brightness.opacity > 0 ? HitTestMode.Default : HitTestMode.None)
          .accessibilityLevel(this.contentInputEnabled() && this.currentFacts().geometry.temporary.layer === '' &&
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
        if (!this.currentFacts().geometry.fixedIsland) {
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
            intercepts: this.currentFacts().geometry.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0) } as LayoutInvariantTag : undefined)
        .translate({ x: this.currentLayout().isExpanded() ? this.directSheetTranslation() : 0,
          y: this.frame().dock.translateY + (this.currentLayout().isExpanded() ? 0 : this.directSheetTranslation()) })
        .opacity(this.frame().dock.opacity * (this.directSheetVisible() && this.currentFacts().geometry.reduceMotion ? this.visualExpansionProgress : 1))
        .position({ x: this.dockLeft(), y: this.presentedDockTop() })
        .onTouch((event: TouchEvent): void => this.onDockPlacementTouch(event))
        // A held pointer may reach the hidden endpoint before UP. Retiring
        // its ancestor here loses UP/CANCEL and leaves the runtime held.
        .enabled(this.currentFacts().geometry.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0))
          .hitTestBehavior(this.currentFacts().geometry.inputEnabled && (this.frame().visibility > 0 || this.visualHeldPointerId >= 0) ?
          HitTestMode.Transparent : HitTestMode.None);
      if (this.currentFacts().launch.sample !== undefined) {
        ReaderSessionLaunchStage({
          fontScale: this.currentFacts().geometry.fontScale,
          sample: this.currentFacts().launch.sample, sessionState: this.currentFacts().launch.status,
          desiredPlaying: this.currentFacts().launch.desiredPlaying, countdown: this.currentFacts().launch.countdown,
          interactionEnabled: this.currentFacts().launch.interactionEnabled,
          ownsSourceRegion: this.launchSourceDetached(this.currentFacts().launch.sample?.type ?? 'autoPage'),
          material: this.surfaceMaterial('sessionCapsule'),
          sourceSurfaceColor: readerAppColor(this.currentFacts().geometry.fixedIsland ? 'TOK_READ_CARD_EMPHASIS' : this.currentFacts().launch.sourceKind === 'fullAutoPagePlayback' ?
            'TOK_SURFACE_PANEL_SOFT' : this.currentFacts().launch.sourceKind === 'fullTtsPlayback' ? 'TOK_TTS_CARD' :
              this.currentFacts().launch.sourceKind === 'quickTts' ? 'TOK_TTS_QUICK_CARD' : 'TOK_SURFACE_PANEL', this.appScheme),
          sourceBorderColor: readerAppColor(this.currentFacts().geometry.fixedIsland ? 'TOK_LINE_STRONG' : this.currentFacts().launch.sourceKind === 'quickTts' ?
            'app.control.paint.66B4A697' : this.currentFacts().launch.sourceKind === 'fullTtsPlayback' ? 'TOK_TTS_LINE' : 'TOK_LINE', this.appScheme),
          sourceBorderWidth: this.currentFacts().geometry.fixedIsland || this.currentFacts().launch.sample?.type === 'autoPage' ? TOK_BORDER_W : 0.5,
          sourceSurfaceTopInset: !this.currentFacts().geometry.fixedIsland && this.currentFacts().launch.sourceKind === 'fullTtsPlayback' ? 27 : 0,
          sourceHighlightColor: !this.currentFacts().geometry.fixedIsland && this.currentFacts().launch.sourceKind === 'fullTtsPlayback' ? readerAppColor('app.control.paint.99FFFFFF', this.appScheme) : '#00000000',
          sourceGradientStart: !this.currentFacts().geometry.fixedIsland && this.currentFacts().launch.sourceKind === 'quickTts' ? readerAppColor('app.control.paint.FFFAF4', this.appScheme) : '',
          sourceGradientEnd: !this.currentFacts().geometry.fixedIsland && this.currentFacts().launch.sourceKind === 'quickTts' ? readerAppColor('app.control.paint.F6ECDD', this.appScheme) : '',
          themeScheme: this.appScheme,
          sourceSharpContent: (): void => { this.launchSourceContent(); },
          onToggle: (): void => { this.onIntent({ kind: 'launchToggle' }); },
        }).id('reader-session-launch-fade-owner').opacity(this.currentFacts().launch.opacity).zIndex(9)
          .transition(this.currentFacts().geometry.reduceMotion ? TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()), TransitionEffect.IDENTITY) :
            TransitionEffect.IDENTITY);
      }
      }
    }
    .visibility(this.currentFacts().geometry.obscured ? Visibility.Hidden : Visibility.Visible)
    .width(this.currentLayout().viewportWidth)
    .height(this.currentLayout().viewportHeight)
    .accessibilityLevel(this.frame().visibility > 0 || this.currentFacts().launch.sample !== undefined ? 'auto' : 'no-hide-descendants')
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
    if (visible && (!this.runtimeMounted || !this.currentFacts().geometry.inputEnabled || this.currentFacts().geometry.obscured || (this.currentFacts().geometry.temporary.layer !== '') || this.frame().visibility <= 0)) return;
    if (visible) {
      this.moreMenuGeneration += 1;
      this.moreMenuRecoveryIdentity = this.currentFacts().document.recovery.identity;
      this.moreMenuOwnerScope = this.currentMoreMenuOwnerScope();
      this.moreMenuMeasuredWidth = 0;
      this.moreMenuWidthKey = '';
    }
    this.moreMenuVisible = visible;
    this.currentFacts().geometry.verification?.layer('more', visible, this.moreMenuGeneration, this.visualSession);
    this.observeMoreMenuFrames(visible, this.moreMenuGeneration);
    this.syncProgressInput();
    this.onIntent({ kind: 'temporaryLayerChange', active: visible, layer: 'moreMenu' });
    this.refreshDockPlacement();
  }

  private observeMoreMenuFrames(visible: boolean, generation: number): void {
    const verification = this.currentFacts().geometry.verification;
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
    return JSON.stringify([this.currentFacts().document.source.id, this.currentFacts().document.source.bookId, this.currentFacts().document.bookmarks.book?.libraryBookId ?? '',
      this.currentFacts().geometry.openRevision, this.runtimeLifecycle]);
  }

  private dismissMoreMenu(generation: number = this.moreMenuGeneration): void {
    if (generation === this.moreMenuGeneration) this.setMoreMenuVisible(false);
  }

  private performMoreAction(action: 'info' | 'refresh' | 'download' | 'recovery', generation: number = this.moreMenuGeneration): void {
    if (generation !== this.moreMenuGeneration || !this.moreMenuVisible || !this.runtimeMounted ||
      !this.currentFacts().geometry.inputEnabled || this.currentFacts().geometry.obscured || this.frame().visibility <= 0 ||
      this.moreMenuOwnerScope !== this.currentMoreMenuOwnerScope()) return;
    if (action === 'refresh' && !this.currentFacts().document.allowChapterRefresh) return;
    if (action === 'download' && !this.currentFacts().document.download.bookEnabled) return;
    if (action === 'recovery' && (!this.currentFacts().document.recovery.available || this.moreMenuRecoveryIdentity.length === 0 ||
      this.moreMenuRecoveryIdentity !== this.currentFacts().document.recovery.identity)) return;
    const recoveryIdentity = this.moreMenuRecoveryIdentity;
    this.dismissMoreMenu(generation);
    if (action === 'info') this.onIntent({ kind: 'openBookInfo' });
    else if (action === 'refresh') this.onIntent({ kind: 'refreshChapter' });
    else if (action === 'recovery') this.onIntent({ kind: 'openRecovery', identity: recoveryIdentity });
    else this.onIntent({ kind: 'downloadBook' });
  }

  private readerMoreMenuWidth(): number {
    const surface = this.readerMoreSurfaceSpec();
    const labels = this.readerMoreActions().map((action: ReaderMenuActionView): string => action.label);
    const key = JSON.stringify([labels, this.currentFacts().geometry.minimum.metricsRevision, this.currentFacts().geometry.minimum.key,
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
      transition: this.currentFacts().geometry.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : undefined,
      onStateChange: (event: PopupStateChangeParam): void => {
        const verification = generation === this.moreMenuGeneration ? this.currentFacts().geometry.verification : undefined;
        if (verification?.observing() === true) {
          const facts: ReaderControlMenuNativeState = { visible: event.isVisible, generation: generation };
          verification.effect('more-popup', 'native-state', facts);
        }
        if (!event.isVisible) this.dismissMoreMenu(generation);
      },
    };
    applyReaderPopupMaterial(options, material);
    return options;
  }

  private readerMoreActionEnabled(action: 'info' | 'refresh' | 'download' | 'recovery'): boolean {
    return this.currentFacts().geometry.inputEnabled && !this.currentFacts().geometry.obscured &&
      (!this.moreMenuVisible || this.moreMenuOwnerScope === this.currentMoreMenuOwnerScope()) &&
      (action !== 'refresh' || this.currentFacts().document.allowChapterRefresh) &&
      (action !== 'download' || this.currentFacts().document.download.bookEnabled) &&
      (action !== 'recovery' || this.currentFacts().document.recovery.available);
  }

  private readerMoreActions(): ReaderMenuActionView[] {
    const actions: ReaderMenuActionView[] = [
      new ReaderMenuActionView('info', '书籍信息', this.readerMoreActionEnabled('info')),
      new ReaderMenuActionView('refresh', '刷新本章', this.readerMoreActionEnabled('refresh')),
      new ReaderMenuActionView('download', this.currentFacts().document.download.bookActive ? '正在下载章节…' : '下载全部章节',
        this.readerMoreActionEnabled('download')),
    ];
    if (this.currentFacts().document.recovery.available) actions.push(new ReaderMenuActionView('recovery', '待处理事项', this.readerMoreActionEnabled('recovery')));
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
        fixedIsland: this.currentFacts().geometry.fixedIsland,
        sourceMinimum: this.launchNaturalMinimum,
        sourceMinimumIdentity: this.launchNaturalMinimum?.identity ?? '',
        sourceMinimumKey: this.launchNaturalMinimum?.key ?? '',
        sourceMinimumMetricsRevision: this.launchNaturalMinimum?.metricsRevision ?? -1,
        sourceOnly: this.capturedLaunchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        form: this.capturedLaunchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.launchFullContentHeight,
        interactionEnabled: false, status: this.currentFacts().launch.sourceAutomatic,
        speedSeconds: this.currentFacts().playback.automatic.speedSeconds, timerSummaryText: this.currentFacts().playback.automatic.timerSummary,
        timerMinutes: this.currentFacts().playback.automatic.timerMinutes, timerSeconds: this.currentFacts().playback.automatic.timerSeconds,
        followHighlight: this.currentFacts().playback.automatic.followHighlight, canPreviousChapter: this.canStepChapter(-1),
        canNextChapter: this.canStepChapter(1),
      });
    } else {
      ReaderControlTtsContent({
        fixedIsland: this.currentFacts().geometry.fixedIsland,
        sourceMinimum: this.launchNaturalMinimum,
        sourceMinimumIdentity: this.launchNaturalMinimum?.identity ?? '',
        sourceMinimumKey: this.launchNaturalMinimum?.key ?? '',
        sourceMinimumMetricsRevision: this.launchNaturalMinimum?.metricsRevision ?? -1,
        sourceOnly: this.capturedLaunchSourceKind === 'quickTts' ? 'quick' : 'full',
        frozenWaveformSample: this.launchWaveformSample, reduceMotion: this.currentFacts().geometry.reduceMotion,
        form: this.capturedLaunchSourceKind === 'quickTts' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.launchFullContentHeight,
        interactionEnabled: false, state: this.currentFacts().launch.sourceSpeech,
        timerMode: this.currentFacts().playback.speech.timerMode, timerMinutes: this.currentFacts().playback.speech.timerMinutes, timerSeconds: this.currentFacts().playback.speech.timerSeconds,
        engine: this.currentFacts().playback.speech.engine, language: this.currentFacts().playback.speech.language, person: this.currentFacts().playback.speech.person,
        voiceOptions: this.currentFacts().playback.speech.voiceOptions, followHighlight: this.currentFacts().playback.speech.followHighlight,
      });
    }
    }
  }

  private launchSourceCurrent(): boolean {
    if (!this.runtimeMounted) return false;
    const sample = this.currentFacts().launch.sample;
    if (sample === undefined || this.capturedLaunchGeneration !== this.currentFacts().launch.generation) return false;
    if (this.currentFacts().geometry.minimum.identity.length === 0) return true;
    const source = this.currentFacts().launch.sourceMinimum;
    const receipt = this.launchNaturalMinimum;
    if (source === undefined || source.generation !== this.currentFacts().launch.generation || source.kind !== this.capturedLaunchSourceKind ||
      !readerControlPlaybackSourceKindMatches(source.kind, sample.type)) return false;
    if (!source.requiresNaturalProfile) return receipt === undefined && source.receipt === undefined;
    return receipt !== undefined && source.receipt !== undefined &&
      receipt.module === sample.type && receipt.metricsRevision === this.currentFacts().geometry.minimum.metricsRevision &&
      readerControlPlaybackProfileMatches(receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision) &&
      readerControlPlaybackProfileMatches(source.receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision);
  }

  private measureTopBar(rect: ReaderControlBackdropRect): void {
    this.topBarRect = rect;
    this.reportBackdropRegions();
  }

  private headerPaintLayout(): ReaderControlHeaderLayout {
    return readerControlHeaderLayout(this.contentLocation().module, this.currentFacts().geometry.fixedIsland ? 1 : this.frame().progress,
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
    const owner = this.currentFacts().geometry.minimum.ownerKey;
    const identity = this.currentMinimumIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (): boolean => scope === this.currentMoreMenuOwnerScope() &&
      (!this.currentFacts().geometry.minimum.preparedRequired || (owner === this.currentFacts().geometry.minimum.ownerKey && identity === this.currentMinimumIdentity()));
  }

  private controlActionScope(): string {
    return JSON.stringify([this.currentMoreMenuOwnerScope(), this.currentFacts().geometry.minimum.preparedRequired ? this.currentFacts().geometry.minimum.ownerKey : '',
      this.currentFacts().geometry.minimum.preparedRequired ? this.currentMinimumIdentity() : '']);
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
    const owner = this.currentFacts().geometry.minimum.ownerKey;
    const identity = this.currentMinimumIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (event: TouchEvent): void => {
      if (runtime !== this.runtime || lifecycle !== this.runtimeLifecycle || owner !== this.currentFacts().geometry.minimum.ownerKey ||
        scope !== this.currentMoreMenuOwnerScope()) return;
      if (event.type === TouchType.Down && (this.currentFacts().geometry.directSheet && this.visualDirectSheet ||
        this.currentFacts().geometry.minimum.preparedRequired && identity !== this.currentMinimumIdentity())) return;
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
    } else if (this.currentFacts().geometry.fixedIsland) {
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
        this.currentFacts().geometry.fixedIsland ? '返回阅读主控' :
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
          verificationSession: this.currentFacts().geometry.verification,
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
            this.bindModuleMinimum('directory', identity, measurer),
          directoryPublication: this.currentFacts().document.catalog.publication, directoryEntriesRevision: this.currentFacts().document.catalog.revision, currentChapterIndex: this.currentFacts().document.chapterIndex,
          catalogComplete: this.currentFacts().document.catalog.complete, catalogChapterCount: this.currentFacts().document.catalog.chapterCount,
          catalogLoading: this.currentFacts().document.catalog.loading, catalogLoadFailed: this.currentFacts().document.catalog.loadFailed,
          catalogCurrentPosition: this.currentFacts().document.catalog.position,
          catalogReadableChapterCount: this.currentFacts().document.totalChapters, catalogReadablePosition: this.currentFacts().document.readableChapterPosition,
          onRequireCompleteCatalog: (): void => { this.onIntent({ kind: 'requireCompleteCatalog' }); },
          bookmarkLoadFailed: this.currentFacts().document.bookmarks.loadFailed,
          bookmarkLoadMessage: this.currentFacts().document.bookmarks.message,
          bookmarkRecovery: this.currentFacts().document.bookmarks.recovery,
          onRetryBookmarkLoad: (): void => { this.onIntent({ kind: 'retryBookmarkLoad' }); },
          chapterDownloadEnabled: this.currentFacts().document.download.chapterEnabled,
          mangaSearch: this.currentFacts().document.search.manga,
          chapterStartBookmarkCreationEnabled: this.currentFacts().document.bookmarks.allowChapterStart,
          progress: this.contentMotionProgress,
          interactionEnabled: this.secondaryModuleInputEnabled('directory'),
          inputCurrent: (): boolean => this.secondaryModuleInputEnabled('directory'),
          editorInputCurrent: (): boolean => this.moduleEditorInputEnabled('directory'),
          onTemporaryLayerChange: this.moduleTemporaryLayerHandler('directory'),
          dismissTemporaryRevision: this.currentFacts().geometry.temporary.dismissRevision,
          availableWidth: this.contentMotionWidth, availableHeight: this.contentEditingHeight(),
          tab: this.contentLocation().directoryTab,
          sessionKey: this.listSessionKey(), bookmarkIdentity: this.currentFacts().document.bookmarks.book,
          onTabChange: (tab: string): void => {
            if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
              'stage=panel-directory-tab tab=%{public}d ready=%{public}s owner=%{public}d',
              tab === 'bookmarks' ? 1 : 0, String(this.minimumInputReady()), this.runtime?.owner() ?? -1);
            this.onIntent({ kind: 'inputActivity' });
            this.applySemanticSession(setReaderControlDirectoryTab(this.controlSession,
              tab === 'bookmarks' ? 'bookmarks' : 'directory'), 'directory-tab');
          },
          onSelectChapter: (index: number): void => { this.onIntent({ kind: 'selectChapter', chapterIndex: index }); },
          onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void =>
            { this.onIntent({ kind: 'selectNavigationTarget', chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof }); },
          onSelectBookmark: this.onIntent === defaultReaderControlIntent ? undefined : this.selectBookmark,
          onDownloadChapter: (index: number): void => { this.onIntent({ kind: 'downloadChapter', chapterIndex: index }); },
          onDeleteBookmarks: (times: number[]): void => { this.onIntent({ kind: 'deleteBookmarks', bookmarkTimes: times }); },
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            { this.onIntent({ kind: 'createChapterStartBookmark', request }); },
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
      fixedIsland: this.currentFacts().geometry.fixedIsland,
      verificationSession: this.currentFacts().geometry.verification,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('appearance', identity, measurer),
      expandedLayout: this.isExpanded(),
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      fullContentHeight: this.contentEndpointHeight(true),
      interactionEnabled: this.secondaryModuleInputEnabled('appearance'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('appearance'),
      dismissTemporaryRevision: this.currentFacts().geometry.temporary.dismissRevision,
      onTemporaryLayerChange: this.moduleTemporaryLayerHandler('appearance'),
      reduceMotion: this.currentFacts().geometry.reduceMotion,
      motionProgress: this.contentMotionProgress,
      snapshot: this.currentFacts().preferences.appearance,
      chineseConversionMode: this.currentFacts().preferences.conversion.mode,
      pageTurnStyle: readerPageTurnStyle(this.currentFacts().preferences.settings),
      pageTurnSimulationAvailable: this.currentFacts().preferences.pageTurnSimulationAvailable,
      onThemeChange: (theme: ReaderAppearanceTheme): void => { this.onIntent({ kind: 'appearanceThemeChange', theme }); },
      onSetDayTheme: (theme: ReaderAppearanceTheme): void => { this.onIntent({ kind: 'appearanceDayThemeChange', theme }); },
      onSetNightTheme: (theme: ReaderAppearanceTheme): void => { this.onIntent({ kind: 'appearanceNightThemeChange', theme }); },
      onFontChange: (font: ReaderAppearanceFont): void => { this.onIntent({ kind: 'appearanceFontChange', font }); },
      onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): ReaderControlFontOrderPresentation =>
        (this.onIntent({ kind: 'appearanceFontOrderChange', fontOrder }) as ReaderControlFontOrderPresentation),
      onFontReorderActivityChange: (active: boolean): void =>
        this.setAppearanceFontReorderActivity(active),
      onCustomFontImport: (): void => { this.onIntent({ kind: 'appearanceCustomFontImport' }); },
      onIndentRequest: (indent: ReaderAppearanceIndent): void => { this.onIntent({ kind: 'appearanceIndentRequest', indent }); },
      onAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
        { this.onIntent({ kind: 'appearanceAlignmentRequest', current }); },
      onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
        { this.onIntent({ kind: 'appearanceMetricStep', metric, direction }); },
      chineseConversionIdentity: this.currentFacts().preferences.conversion.identity,
      onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string): void =>
        { this.onIntent({ kind: 'chineseConversionChange', mode, identity }); },
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        { this.onIntent({ kind: 'pageTurnStyleChange', style }); },
    });
  }

  private secondaryModuleInputEnabled(module: string): boolean {
    return this.runtimeMounted && !this.moreMenuVisible && this.contentLocation().level === 'secondary' &&
      this.contentLocation().module === module && this.contentInputEnabled() &&
      (!this.currentFacts().geometry.minimum.preparedRequired || this.minimumInputReady());
  }

  private observeSearchResultList(scope: number, count: number): void {
    const verification = this.currentFacts().geometry.verification;
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
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('search', identity, measurer),
      fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      interactionEnabled: this.secondaryModuleInputEnabled('search'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('search'),
      dismissTemporaryRevision: this.currentFacts().geometry.temporary.dismissRevision,
      onTemporaryLayerChange: this.moduleTemporaryLayerHandler('search'),
      editorInputCurrent: (): boolean => this.moduleEditorInputEnabled('search'),
      query: this.currentFacts().document.search.query,
      onlineBook: this.currentFacts().document.source.id !== 'local' && (this.currentFacts().document.source.id?.length ?? 0) > 0,
      searchPublication: this.currentFacts().document.search.publication,
      searchRevision: this.currentFacts().document.search.revision,
      onBack: (): void => this.requestPage('home', 'module-back'),
      onQueryChange: (query: string): void => { this.onIntent({ kind: 'searchQueryChange', query }); },
      onSearch: (): void => { this.onIntent({ kind: 'search' }); },
      onLoadMore: (): void => { this.onIntent({ kind: 'searchLoadMore' }); },
      onNeedMore: (): void => { this.onIntent({ kind: 'searchNeedMore' }); },
      onResultListPublished: (scope: number, count: number): void => this.observeSearchResultList(scope, count),
      onSelectResult: (result: ReadingContentSearchResult, scope: number, ordinal: number): void =>
        { this.onIntent({ kind: 'searchResultSelect', result, scope, ordinal }); },
    });
  }

  @Builder
  private settingsModuleContent() {
    ReaderControlSettingsContent({
      fixedIsland: this.currentFacts().geometry.fixedIsland,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
        this.bindModuleMinimum('settings', identity, measurer),
      fullViewportHeight: this.contentEndpointHeight(true),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentEditingHeight(),
      interactionEnabled: this.secondaryModuleInputEnabled('settings'),
      inputCurrent: (): boolean => this.secondaryModuleInputEnabled('settings'),
      snapshot: this.currentFacts().preferences.settings,
      widePageLayoutAvailable: this.isExpanded(), widePageLayout: this.currentFacts().preferences.widePageLayout,
      onWidePageLayoutChange: (value: ReaderWidePageLayout): void => {
        if (this.isExpanded() && this.secondaryModuleInputEnabled('settings')) this.onIntent({ kind: 'widePageLayoutChange', value });
      },
      pageTurnSimulationAvailable: this.currentFacts().preferences.pageTurnSimulationAvailable,
      justifyText: this.currentFacts().preferences.appearance.alignment === 'justify',
      onJustifyTextChange: (_value: boolean): void =>
        { this.onIntent({ kind: 'appearanceAlignmentRequest', current: this.currentFacts().preferences.appearance.alignment }); },
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        { this.onIntent({ kind: 'pageTurnStyleChange', style }); },
      onScreenDirectionChange: (direction: ReaderScreenDirection): void =>
        { this.onIntent({ kind: 'screenDirectionChange', direction }); },
      onScreenTimeoutChange: (timeout: ReaderScreenTimeout): void =>
        { this.onIntent({ kind: 'screenTimeoutChange', timeout }); },
      onToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void =>
        { this.onIntent({ kind: 'settingsToggleChange', key, value }); },
    });
  }

  @Builder
  private ttsModuleContent() {
    ReaderControlTtsContent({
      fixedIsland: this.currentFacts().geometry.fixedIsland,
      minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
      onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
        profileReader?: ReaderControlPlaybackProfileReader): void => this.bindModuleMinimum('tts', identity, measurer, profileReader),
      sourceDetached: this.launchSourceDetached('tts'),
      sourceHandoffPending: this.currentFacts().launch.recovering,
      reduceMotion: this.currentFacts().geometry.reduceMotion,
      waveformActive: this.frame().visibility > 0 && !this.launchSourceDetached('tts') && !this.currentFacts().geometry.obscured,
      onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => this.onLaunchSourceVisible(kind),
      dismissTemporaryRevision: this.currentFacts().geometry.temporary.dismissRevision,
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
      state: this.currentFacts().playback.speech.state,
      timerMode: this.currentFacts().playback.speech.timerMode,
      timerMinutes: this.currentFacts().playback.speech.timerMinutes,
      timerSeconds: this.currentFacts().playback.speech.timerSeconds,
      followHighlight: this.currentFacts().playback.speech.followHighlight,
      pauseOnInterruption: this.currentFacts().playback.speech.pauseOnInterruption,
      allowMixing: this.currentFacts().playback.speech.allowMixing,
      backgroundPlayback: this.currentFacts().playback.speech.backgroundPlayback,
      keepScreenOn: this.currentFacts().playback.speech.keepScreenOn,
      failurePolicy: this.currentFacts().playback.speech.failurePolicy,
      engine: this.currentFacts().playback.speech.engine,
      httpEngines: this.currentFacts().playback.speech.httpEngines,
      configurationRecovery: this.currentFacts().playback.speech.configurationRecovery,
      configurationLoading: this.currentFacts().playback.speech.configurationLoading,
      configurationLoadFailed: this.currentFacts().playback.speech.configurationLoadFailed,
      voiceOptions: this.currentFacts().playback.speech.voiceOptions,
      language: this.currentFacts().playback.speech.language,
      person: this.currentFacts().playback.speech.person,
      onToggle: (): void => { this.onIntent({ kind: 'ttsToggle' }); },
      onStop: (): void => { this.onIntent({ kind: 'ttsStop' }); },
      onPrevious: (): void => { this.onIntent({ kind: 'ttsPrevious' }); },
      onNext: (): void => { this.onIntent({ kind: 'ttsNext' }); },
      onSeek: (sliceIndex: number): void => { this.onIntent({ kind: 'ttsSeek', sliceIndex }); },
      onRateChange: (rate: number, onDeclined?: () => void): void => { this.onIntent({ kind: 'ttsRateChange', rate, onDeclined }); },
      onTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode): void =>
        { this.onIntent({ kind: 'ttsTimerChange', minutes, seconds, mode }); },
      onFollowHighlightChange: (enabled: boolean): void => { this.onIntent({ kind: 'ttsFollowHighlightChange', enabled }); },
      onPauseOnInterruptionChange: (enabled: boolean): void =>
        { this.onIntent({ kind: 'ttsPauseOnInterruptionChange', enabled }); },
      onAllowMixingChange: (enabled: boolean): void => { this.onIntent({ kind: 'ttsAllowMixingChange', enabled }); },
      onBackgroundPlaybackChange: (enabled: boolean): void => { this.onIntent({ kind: 'ttsBackgroundPlaybackChange', enabled }); },
      onKeepScreenOnChange: (enabled: boolean): void => { this.onIntent({ kind: 'ttsKeepScreenOnChange', enabled }); },
      onFailurePolicyChange: (policy: 'skip' | 'stop'): void => { this.onIntent({ kind: 'ttsFailurePolicyChange', policy }); },
      onVoiceChange: (language: string, person: number): void => { this.onIntent({ kind: 'ttsVoiceChange', language, person }); },
      onVoiceAudition: (language: string, person: number): Promise<void> => (this.onIntent({ kind: 'ttsVoiceAudition', language, person }) as Promise<void>),
      onAuditionStop: (): void => { this.onIntent({ kind: 'ttsAuditionStop' }); },
      onEngineChange: (engine: string): Promise<void> => (this.onIntent({ kind: 'ttsEngineChange', engine }) as Promise<void>),
      onHttpEnginePut: (config: ReaderTtsConfigurationDraft): Promise<void> => (this.onIntent({ kind: 'ttsHttpEnginePut', config }) as Promise<void>),
      onHttpEngineDelete: (id: number): Promise<void> => (this.onIntent({ kind: 'ttsHttpEngineDelete', id }) as Promise<void>),
      onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
        width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
    });
  }

  @Builder
  private autoPageModuleContent() {
        ReaderControlAutoPageContent({
          fixedIsland: this.currentFacts().geometry.fixedIsland,
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined,
            profileReader?: ReaderControlPlaybackProfileReader): void => this.bindModuleMinimum('autoPage', identity, measurer, profileReader),
          sourceDetached: this.launchSourceDetached('autoPage'),
          sourceHandoffPending: this.currentFacts().launch.recovering,
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
          status: this.currentFacts().playback.automatic.status, speedSeconds: this.currentFacts().playback.automatic.speedSeconds,
          timerMinutes: this.currentFacts().playback.automatic.timerMinutes, timerSeconds: this.currentFacts().playback.automatic.timerSeconds,
          timerSummaryText: this.currentFacts().playback.automatic.timerSummary, followHighlight: this.currentFacts().playback.automatic.followHighlight,
          onBack: (): void => this.requestPage('home', 'module-back'),
          onPreviousChapter: (): void => { this.onIntent({ kind: 'previousChapter' }); },
          onToggleRunning: (): void => { this.onIntent({ kind: 'autoPageToggle' }); },
          onStop: (): void => { this.onIntent({ kind: 'autoPageStop' }); },
          onNextChapter: (): void => { this.onIntent({ kind: 'nextChapter' }); },
          onTimerChange: (minutes: number, seconds: number): void =>
            { this.onIntent({ kind: 'autoPageFullTimerChange', minutes, seconds }); },
          onSpeedChange: (seconds: number, onDeclined?: () => void): void =>
            { this.onIntent({ kind: 'autoPageFullSpeedChange', seconds, onDeclined }); },
          onFollowHighlightChange: (enabled: boolean): void => { this.onIntent({ kind: 'autoPageFollowHighlightChange', enabled }); },
          onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
            width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
        });
  }

  @Builder
  private replaceModuleContent() {
        ReaderControlReplaceContent({
          minimumIdentity: this.currentMinimumIdentity(), minimumKey: this.currentMinimumKey(),
      preparedMinimum: this.preparedMinimum(), preparedMinimumRequired: this.currentFacts().geometry.minimum.preparedRequired,
      onMinimumFactsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.onModuleMinimumFactsChanged(identity, facts),
          onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined): void =>
            this.bindModuleMinimum('replace', identity, measurer),
          fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
          state: this.currentFacts().document.replace, motionProgress: this.contentMotionProgress,
          availableWidth: this.contentMotionWidth, availableHeight: this.contentEditingHeight(),
          interactionEnabled: this.secondaryModuleInputEnabled('replace'),
          inputCurrent: (): boolean => this.secondaryModuleInputEnabled('replace'),
          dismissTemporaryRevision: this.currentFacts().geometry.temporary.dismissRevision, retireTemporaryRevision: this.currentFacts().geometry.temporary.retireRevision,
          onTemporaryLayerChange: this.moduleTemporaryLayerHandler('replace'),
          onBack: (): void => this.requestPage('home', 'module-back'),
          onExpand: (): void => {
            if ((this.currentFacts().geometry.temporary.layer !== '')) return;
            this.onIntent({ kind: 'inputActivity' });
            this.applySemanticSession(expandReaderControlSession(this.controlSession,
              readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.currentFacts().geometry.reduceMotion)), 'replace-expand');
          },
          onReload: (operationId?: string): Promise<void> => (this.onIntent({ kind: 'reloadControlReplace', operationId }) as Promise<void>),
          onSave: (draft: ReaderControlReplaceDraft): Promise<void> => (this.onIntent({ kind: 'saveControlReplace', draft }) as Promise<void>),
          onToggle: (rule: ReaderReplaceRule, value: boolean): Promise<void> => (this.onIntent({ kind: 'toggleControlReplace', rule, value }) as Promise<void>),
          onDelete: (rule: ReaderReplaceRule): Promise<void> => (this.onIntent({ kind: 'deleteControlReplace', rule }) as Promise<void>),
          onPreview: (): Promise<ReaderReplacePreview> => (this.onIntent({ kind: 'previewControlReplace' }) as Promise<ReaderReplacePreview>),
          onImport: (): Promise<void> => (this.onIntent({ kind: 'importControlReplace' }) as Promise<void>),
          onExport: (): Promise<void> => (this.onIntent({ kind: 'exportControlReplace' }) as Promise<void>),
        });
  }

  @Builder
  private appearanceModuleContent() {
    this.appearanceContent();
  }

  @Builder
  private topBar() {
    ReaderReadingTopBar({ variant: 'reading', barWidth: this.currentLayout().topBarWidth, barHeight: this.currentLayout().topBarHeight,
      bookTitle: this.currentFacts().document.bookTitle, subtitle: this.topBarSubtitle(), scheme: this.appScheme,
      inputEnabled: this.currentFacts().geometry.inputEnabled, leading: (): void => { this.topBarBack(); }, trailing: (): void => { this.topBarActions(); },
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
      this.topBarInputEnabled() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu'),
      false, true, new ReaderPressFeedback(Color.Transparent, this.appScheme, 999), 'nativeButton'))
    .accessibilityLevel(this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .onClick(this.controlActionHandler((): void => {
      if (this.topBarInputEnabled() && !this.currentFacts().geometry.obscured && this.currentFacts().geometry.temporary.layer === '' && !this.moreMenuVisible) this.onIntent({ kind: 'exitReading' });
    }));
  }

  private topBarInputEnabled(): boolean {
    return this.runtimeMounted && this.currentFacts().geometry.inputEnabled && ((this.onIntent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.currentFacts().geometry.obscured &&
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
    .id(sourceSwitchTriggerFocusId(this.currentFacts().document.source.id, this.currentFacts().document.source.bookId, 'reader-control'))
    .responseRegion(readerActionTouchRegion(62, this.sourceActionHeight()))
    .attributeModifier(new ReaderActionAccessibility('换源',
      this.topBarInputEnabled() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') && !this.isLocalBook(),
      false, true, new ReaderPressFeedback(Color.Transparent, this.appScheme, 999), 'nativeButton'))
    .accessibilityLevel(this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .onClick(this.controlActionHandler((): void => {
      // 本地书籍换源置灰不可点; 仅在线书籍可换源。
      if (this.topBarInputEnabled() && !this.currentFacts().geometry.obscured && this.currentFacts().geometry.temporary.layer === '' && !this.moreMenuVisible && !this.isLocalBook()) {
        this.onIntent({ kind: 'sourceSwitch', focusId: sourceSwitchTriggerFocusId(this.currentFacts().document.source.id, this.currentFacts().document.source.bookId, 'reader-control') });
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
      this.topBarInputEnabled() && !this.currentFacts().geometry.obscured && (this.currentFacts().geometry.temporary.layer === '' || this.moreMenuVisible), false, true,
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
        .enabled(this.shortWindowActionInput() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu'))
        .accessibilityLevel(this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
        .accessibilityText('退出阅读，返回上一页')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && this.currentFacts().geometry.temporary.layer === '' && !this.moreMenuVisible) this.onIntent({ kind: 'exitReading' });
        }));
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.sourceActionLabel();
      }.width(76).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999))
        .id(sourceSwitchTriggerFocusId(this.currentFacts().document.source.id, this.currentFacts().document.source.bookId, 'reader-control-short'))
        .enabled(this.shortWindowActionInput() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') && !this.isLocalBook())
        .accessibilityLevel(this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
        .accessibilityText('换源')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && this.currentFacts().geometry.temporary.layer === '' && !this.moreMenuVisible && !this.isLocalBook())
            this.onIntent({ kind: 'sourceSwitch', focusId: sourceSwitchTriggerFocusId(this.currentFacts().document.source.id, this.currentFacts().document.source.bookId, 'reader-control-short') });
        }));
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots')).width(20).height(20).accessibilityLevel('no');
      }.width(44).height(READER_CONTROL_HOME_SHORT_ACTION_HEIGHT).padding(0)
        .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 999))
        .enabled(this.shortWindowActionInput() && (this.currentFacts().geometry.temporary.layer === '' || this.moreMenuVisible))
        .id('reader-control-more-short')
        .accessibilityText('更多')
        .onClick(this.controlActionHandler((): void => {
          if (this.shortWindowActionInput() && (this.currentFacts().geometry.temporary.layer === '' || this.moreMenuVisible)) this.setMoreMenuVisible(!this.moreMenuVisible);
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
    readerAnimatePress(this.getUIContext(), this.currentFacts().geometry.reduceMotion, (): void => { this.quickOrModulePress = next < 0 ? '' : key; });
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
          this.quickOrModulePress === action, this.currentFacts().geometry.reduceMotion))
        .borderRadius(8).scale(readerPressScale(this.quickOrModulePress === action, this.currentFacts().geometry.reduceMotion))
        .opacity(readerPressOpacity(this.quickOrModulePress === action, this.currentFacts().geometry.reduceMotion));
    }
    .layoutWeight(1)
    .id('reader-control-entry-' + action)
    .height(55.438 + this.homeMetric('actionLabelHeight', 13) - 13)
    .padding(0)
    .backgroundColor(Color.Transparent)
    .borderRadius(8)
    .enabled(this.progressInputEnabled(true))
    .accessibilityLevel(this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu' ? 'no-hide-descendants' : 'auto')
    .accessibilityText(label)
    .onTouch((event: TouchEvent): void => this.observeQuickOrModulePress(event, action, this.progressInputEnabled(true)))
    .onClick(this.controlActionHandler((): void => {
      if (!this.progressInputEnabled()) return;
      if (action === 'directory') {
        this.requestPage('moduleDirectory');
      } else if (action === 'search') {
        this.promoteSearch();
      } else if (action === 'replace') {
        this.onIntent({ kind: 'inputActivity' });
        this.onIntent({ kind: 'openReplace' });
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
    return 42 + Math.ceil(44 * Math.max(1, this.currentFacts().geometry.fontScale));
  }
  private bookmarkPillHeight(): number {
    return Math.max(28, Math.ceil(15 * Math.max(1, this.currentFacts().geometry.fontScale)) + 10);
  }
  private progressLaneHeight(): number { return Math.max(36, this.homeMetric('progressHeight', 50) - 14); }

  private onPageBookmarkStatusChanged(): void {
    const fill = this.currentFacts().document.bookmarks.pageStatus === 'bookmarked' ? 1 : 0;
    if (fill === this.pageBookmarkFill) return;
    if (!this.runtimeMounted) { this.pageBookmarkFill = fill; return; }
    const lifecycle = this.runtimeLifecycle;
    const finish = (): void => {
      if (!this.currentFacts().geometry.reduceMotion && fill === 1 && this.runtimeMounted && this.runtimeLifecycle === lifecycle &&
        this.pageBookmarkFill === 1) {
        this.getUIContext().animateTo(readerMotionAnimateParam('reader.control.handle.snap', false),
          (): void => { this.pageBookmarkTuck = 1; });
      }
    };
    this.getUIContext().animateTo(this.currentFacts().geometry.reduceMotion ? readerMotionReducedFadeParam() :
      readerMotionAnimateParam(fill === 1 ? 'reader.bookmark.pill.add' : 'reader.bookmark.pill.remove', false, finish), (): void => {
      this.pageBookmarkFill = fill;
      this.pageBookmarkTuck = !this.currentFacts().geometry.reduceMotion && fill === 1 ? 1.025 : 1;
    });
  }

  @Builder
  private chapterProgress() {
    ReaderControlChapterProgressCard({
      appScheme: this.appScheme, chapterTitle: this.presentedHomeChapterTitle(),
      titleHeight: this.homeMetric('chapterTitleHeight', 34), titleLaneHeight: this.chapterTitleLaneHeight(),
      cardHeight: this.homeChapterCardHeight(), totalChapters: this.presentedHomeTotalChapters(),
      readableChapterPosition: this.currentFacts().document.readableChapterPosition, menuOccludesActions: this.moreMenuVisible || this.currentFacts().geometry.temporary.layer === 'moreMenu',
      previousEnabled: this.progressInputEnabled(true) && this.canStepChapter(-1),
      nextEnabled: this.progressInputEnabled(true) && this.canStepChapter(1),
      actionScope: this.controlActionScope(),
      chapterActionsCurrent: (scope: string): boolean => this.controlActionScope() === scope &&
        this.progressInputEnabled(true) && !this.moreMenuVisible && this.currentFacts().geometry.temporary.layer === '',
      bookmarkLaneHeight: this.bookmarkLaneHeight(), bookmarkWidth: this.bookmarkPillWidth(), bookmarkHeight: this.bookmarkPillHeight(),
      pageBookmarkStatus: this.currentFacts().document.bookmarks.pageStatus, pageBookmarkEnabled: this.currentFacts().document.bookmarks.pageEnabled,
      bookmarkInputEnabled: this.currentFacts().document.bookmarks.pageEnabled && this.progressInputEnabled(true),
      quickOrModulePress: $quickOrModulePress, pageBookmarkFill: $pageBookmarkFill, pageBookmarkTuck: $pageBookmarkTuck,
      sessionFontScale: this.currentFacts().geometry.fontScale, reduceMotion: this.currentFacts().geometry.reduceMotion,
      progressPercent: this.effectiveProgressPercent(), progressLabelWidth: this.homeMetric('percentWidth', 26.23),
      progressLaneHeight: this.progressLaneHeight(), progressInputRevision: this.progressInputRevision,
      onPreviousChapter: (): void => { if (this.progressInputEnabled() && this.canStepChapter(-1)) this.onIntent({ kind: 'previousChapter' }); },
      onNextChapter: (): void => { if (this.progressInputEnabled() && this.canStepChapter(1)) this.onIntent({ kind: 'nextChapter' }); },
      onBookmarkPress: (event: TouchEvent): void => this.observeQuickOrModulePress(event, 'bookmark',
        this.currentFacts().document.bookmarks.pageEnabled && this.progressInputEnabled(true)),
      bookmarkClickHandler: (_scope: string): (() => void) => this.controlActionHandler((): void => {
        if (this.currentFacts().document.bookmarks.pageEnabled && this.progressInputEnabled()) this.onIntent({ kind: 'togglePageBookmark' });
      }),
      progressChangeHandler: (revision: number): ((value: number, mode: SliderChangeMode) => void) =>
        this.progressChangeHandler(revision),
    });
  }

  private clampPercent(value: number): number {
    return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX, value));
  }

  private effectiveProgressPercent(): number {
    return this.progressPreviewPercent >= 0 ? this.progressPreviewPercent : this.clampPercent(this.currentFacts().document.progressPercent);
  }

  private progressInputEnabled(forAppearance: boolean = false): boolean {
    return this.runtimeMounted && this.contentLocation().level === 'home' && this.contentInputEnabled() &&
      (this.currentFacts().geometry.temporary.layer === '' || (forAppearance && this.currentFacts().geometry.temporary.layer === 'moreMenu')) &&
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
    const scope = JSON.stringify([this.runtimeLifecycle, this.currentFacts().geometry.openRevision,
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
        this.onIntent({ kind: 'progressChange', percent: committed });
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
    if (this.currentFacts().geometry.minimum.identity.length === 0 || !this.minimumInputReady() ||
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
            .fontColor(this.currentFacts().preferences.brightness.automatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_INK', this.appScheme))
            .textAlign(TextAlign.Center);
        }
        .width(this.currentLayout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .height(this.currentLayout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .backgroundColor(this.currentFacts().preferences.brightness.automatic ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme) : readerAppColor('TOK_READ_ELEVATED', this.appScheme))
        .border({ width: TOK_BORDER_W, color: this.currentFacts().preferences.brightness.automatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_LINE_STRONG', this.appScheme) })
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
      .opacity(this.currentFacts().preferences.brightness.automatic ? 1 : 0.72)
      .accessibilityText(this.currentFacts().preferences.brightness.automatic ? '跟随系统亮度，已开启，点击改为手动' : '手动亮度，点击跟随系统')
      .onClick(this.controlActionHandler((): void => {
        if (!this.brightnessInputEnabled()) return;
        this.brightnessDragging = false;
        this.brightnessDragCurrent = undefined;
        this.brightnessPreviewPercent = -1;
        this.onIntent({ kind: 'brightnessAuto' });
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
      this.clampBrightness(this.currentFacts().preferences.brightness.percent);
  }

  @Builder
  private accessibleBrightnessActions() {
    Text(`降低阅读亮度，当前${Math.round(this.effectiveBrightnessPercent())}%，${this.currentFacts().preferences.brightness.automatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.brightnessInputEnabled() && this.effectiveBrightnessPercent() > READER_CONTROL_BRIGHTNESS_MIN)
      .onClick(this.controlActionHandler((): void => this.stepBrightness(-1)));
    Text(`提高阅读亮度，当前${Math.round(this.effectiveBrightnessPercent())}%，${this.currentFacts().preferences.brightness.automatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.brightnessInputEnabled() && this.effectiveBrightnessPercent() < READER_CONTROL_BRIGHTNESS_MAX)
      .onClick(this.controlActionHandler((): void => this.stepBrightness(1)));
  }

  private stepBrightness(direction: number): void {
    if (!this.brightnessInputEnabled()) return;
    const current = this.effectiveBrightnessPercent();
    const value = this.roundBrightness(current + direction);
    if (value !== current) this.onIntent({ kind: 'brightnessChange', percent: value });
  }

  private brightnessInputEnabled(): boolean {
    return this.runtimeMounted && this.contentInputEnabled() && this.currentFacts().geometry.temporary.layer === '' &&
      !this.moreMenuVisible && this.frame().brightness.opacity > 0;
  }

  private beginBrightnessDrag(): void {
    if (!this.brightnessInputEnabled()) return;
    this.onIntent({ kind: 'inputActivity' });
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
      this.onIntent({ kind: 'brightnessChange', percent: this.brightnessPreviewPercent });
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
    this.onIntent({ kind: 'brightnessChange', percent: this.effectiveBrightnessPercent() });
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
    if (current) this.onIntent({ kind: 'brightnessCancel' });
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
    this.onIntent({ kind: 'brightnessChange', percent: this.roundBrightness(value) });
  }

  private roundBrightness(value: number): number {
    const stepped = Math.round(value / READER_CONTROL_BRIGHTNESS_STEP) * READER_CONTROL_BRIGHTNESS_STEP;
    return this.clampBrightness(stepped);
  }
  private navigationInputEnabled(forAppearance: boolean = false): boolean {
    return this.controlActionInputEnabled(true, forAppearance) && (!this.currentFacts().geometry.minimum.preparedRequired || this.minimumPresentationAvailable()) &&
      (!this.currentFacts().geometry.minimum.preparedRequired || this.currentFacts().geometry.minimum.receipt?.environmentKey === this.currentFacts().geometry.minimum.environmentKey) &&
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
      ttsUnavailable: this.currentFacts().playback.speech.state.status === 'unavailable', quickOrModulePress: $quickOrModulePress,
      reduceMotion: this.currentFacts().geometry.reduceMotion, actionEnabled: this.navigationInputEnabled(true),
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
    if (this.currentFacts().document.readableChapterPosition >= 0) {
      const target = this.currentFacts().document.readableChapterPosition + delta;
      return target >= 0 && target < this.currentFacts().document.totalChapters;
    }
    for (let position = 0; position < this.currentDirectoryEntries().length; position += 1) {
      if (this.currentDirectoryEntries()[position].index !== this.currentFacts().document.chapterIndex) continue;
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
