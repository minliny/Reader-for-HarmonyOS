import { readerTtsWaveformSnapshot } from './ReaderTtsWaveform';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import { ReaderSessionLaunchStage } from './ReaderSessionLaunchStage';
import type { ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import type { ReaderSessionCapsuleState } from './ReaderSessionCapsuleModel';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderControlMotionFrameCache } from './ReaderControlMotionGeometry';
import { FrameCallback } from '@kit.ArkUI';
import { sampleReaderControlMorphProgress } from './ReaderControlMotionPolicy';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_DISMISS_MS } from '../common/ProductMotionTiming';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderControlRuntime, type ReaderControlRuntimeUpdate } from './ReaderControlRuntime';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import hilog from '@ohos.hilog';
import type { ReaderControlGestureConfig } from './ReaderControlGestureDriver';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderBookIdentity } from './ReaderBookmarkProjection';
import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import type { ReaderChineseConversionMode } from './ReaderChineseConversionGateway';
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
} from './ReaderAppearanceState';
import { ReaderControlSettingsContent } from './ReaderControlSettingsContent';
import {
  createDefaultReaderSettingsSnapshot,
  readerPageTurnStyle,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
} from './ReaderSettingsState';
import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import type { ReaderTtsVoiceOption } from './ReaderTtsPreferencesState';
import {
  ReaderSessionMorphSourceMeasurement,
  readerSessionMorphActorId,
  type ReaderSessionMorphSourceKind,
} from './ReaderSessionMorphState';
import { createReaderTtsState, type ReaderTtsState, type ReaderTtsTimerMode } from './ReaderTtsState';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { ReaderControlSearchContent } from './ReaderControlSearchContent';
import { ReaderControlReplaceContent } from './ReaderControlReplaceContent';
import { readerControlHeaderFrame } from './ReaderControlHeaderGeometry';
import type { ReaderControlActorFrame } from './ReaderControlActorGeometry';
import { sampleReaderControlReplaceHeader, type ReaderControlReplaceHeaderFrame } from './ReaderControlReplaceGeometry';
import type { ReaderReplacePreview } from './ReaderReplaceQuickGateway';
import { createReaderControlReplaceState, type ReaderControlReplaceState,
  type ReaderControlReplaceDraft } from './ReaderControlReplaceState';
import {
  createHiddenReaderReplaceQuickState,
  type ReaderReplaceRule,
  type ReaderReplaceQuickState,
} from './ReaderReplaceQuickState';
import {
  TOK_ACCENT,
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_LINE_STRONG,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_DISABLED_BG,
  TOK_READ_ELEVATED,
  TOK_READ_ICON,
  TOK_READ_HANDLE,
  TOK_LINE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_RADIUS_LG,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_SOLID,
  TOK_SURFACE_SOLID_OPAQUE,
} from '../common/ReaderTokens';
import {
  ReaderControlGeometry,
  READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH,
  READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
  READER_CONTROL_BRIGHTNESS_CONTROL_GAP,
  READER_CONTROL_BRIGHTNESS_ICON_SIZE,
  READER_CONTROL_BRIGHTNESS_ICON_TOP,
  READER_CONTROL_BRIGHTNESS_MAX,
  READER_CONTROL_BRIGHTNESS_MIN,
  READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT,
  READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_BRIGHTNESS_STEP,
  READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH,
  READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT,
  READER_CONTROL_BRIGHTNESS_TRACK_WIDTH,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
  READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP,
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
  READER_CONTROL_PROGRESS_STEP,
} from './ReaderControlGeometry';
import {
  ReaderControlLayoutSnapshot,
  createDefaultReaderControlLayout,
} from './ReaderLayoutGeometry';
import {
  TYPE_READER_CONTROL_BOOK_TITLE,
  TYPE_READER_CONTROL_CHAPTER_SOURCE,
  TYPE_READER_CONTROL_SOURCE_ACTION,
} from '../common/ReaderTypography';

import curves from '@ohos.curves';
import { DEBUG, BUILD_MODE_NAME } from '../../../../../build/default/generated/profile/default/BuildProfile';
import { ReaderControlDirectoryContent } from './ReaderControlDirectoryContent';
import { ReaderControlAppearanceContent } from './ReaderControlAppearanceContent';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import {
  copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation,
  readerControlSessionStateEquals,
  sampleReaderControlSession, setReaderControlDirectoryTab,
  collapseReaderControlSession, expandReaderControlSession, toggleReaderControlSession, type ReaderControlLocation,
  type ReaderControlSessionState,
} from './ReaderControlSessionState';
import {
  readerControlMotionAxis, readerControlMotionBounds, readerControlHasFullContentSurface,
  sampleReaderControlMotionComposition,
  type ReaderControlMotionFrame,
} from './ReaderControlMotionGeometry';
import { readerControlThemeStyle, type ReaderControlThemeStyle } from './ReaderControlThemeStyle';

export type { ReaderControlPage } from './ReaderControlRouting';
type ReaderQuickAction = 'search' | 'autoPage' | 'replace';

class ReaderControlFrameCallback extends FrameCallback {
  private callback: (time: number) => void;
  constructor(callback: (time: number) => void) { super(); this.callback = callback; }
  onFrame(time: number): void { this.callback(time); }
  onIdle(_remaining: number): void {}
}

@Component
export struct ReaderControlPanel {
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @Prop @Watch('onLaunchSampleChanged') launchSample: ReaderSessionLaunchSample | undefined = undefined;
  @Prop @Watch('onLaunchSampleChanged') launchGeneration: number = 0;
  @Prop launchSourceKind: ReaderSessionMorphSourceKind = 'quickAutoPage';
  @Prop launchBusinessStatus: ReaderSessionCapsuleState = 'preparing';
  @Prop launchDesiredPlaying: boolean = true;
  @Prop launchCountdown: number = 8;
  @Prop launchStageOpacity: number = 1;
  @Prop launchOwnsControls: boolean = false;
  @Prop @Watch('onRuntimeEnabledChanged') launchRecovering: boolean = false;
  onLaunchSourceReady: (generation: number) => void = (_generation: number): void => {};
  private launchSourceVisibleGeneration: number = 0;
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
  private launchFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();

  private onLaunchSampleChanged(): void {
    if (this.launchSample === undefined || this.capturedLaunchGeneration === this.launchGeneration) return;
    this.capturedLaunchGeneration = this.launchGeneration;
    this.launchWaveformSample = readerTtsWaveformSnapshot();
    this.launchSourceVisibleGeneration = 0;
    this.launchContentWidth = this.contentMotionWidth;
    this.launchContentHeight = this.contentMotionHeight;
    this.launchMotionProgress = this.contentMotionProgress;
  }

  @Prop controlThemeStyle: ReaderControlThemeStyle = readerControlThemeStyle('day');
  @Link @Watch('onControlSessionChanged') controlSession: ReaderControlSessionState;
  // Keep clock/gesture decisions local. Only the scalars used by an actor
  // invalidate its observers; a MOVE must not invalidate the module branch.
  private visualSession: ReaderControlSessionState = createReaderControlSessionState();
  @State private visualExpansionProgress: number = 0;
  @State private visualVisibilityProgress: number = 0;
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
  private runtimeMounted: boolean = false;
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
  @Prop @Watch('onRuntimeEnabledChanged') controlObscured: boolean = false;
  @Prop controlOpenRevision: number = 0;
  @Prop @Watch('dismissMoreMenu') dismissTemporaryRevision: number = 0;
  @Prop temporaryLayerActive: boolean = false;
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};
  /** Non-reactive telemetry path for system-back/close decisions mid-motion. */
  onVisualSessionChange: (state: ReaderControlSessionState) => void =
    (_state: ReaderControlSessionState): void => {};
  onInputActivity: () => void = (): void => {};
  onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean) => void =
    (_regions: ReaderControlBackdropRect[], _ready: boolean): void => {};
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop progressPercent: number = 0;
  @Prop totalChapters: number = 0;
  @Prop @Watch('onLayoutChanged') layout: ReaderControlLayoutSnapshot = createDefaultReaderControlLayout();
  @Prop tocEntries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop bookmarkLoadFailed: boolean = false;
  @Prop bookmarkLoadMessage: string = '';
  onRetryBookmarkLoad: () => void = (): void => {};
  @Prop searchQuery: string = '';
  @Prop searchState: ReaderQuickSearchState = { kind: 'idle' };
  @Prop brightnessPercent: number = 100;
  @Prop brightnessAutomatic: boolean = true;
  @Prop @Watch('onBrightnessConfirmed') brightnessRevision: number = 0;
  @Prop autoPageStatus: ReaderAutoPageStatus = 'stopped';
  @Prop autoPageSpeedSeconds: number = 8;
  @Prop autoPageTimerMinutes: number = 15;
  @Prop autoPageTimerSeconds: number = 0;
  @Prop autoPageTimerSummaryText: string = '15:00';
  @Prop autoPageFollowHighlight: boolean = true;
  @Prop replaceState: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  @Prop controlReplaceState: ReaderControlReplaceState = createReaderControlReplaceState();
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop settingsSnapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  /** Native simulation capability for this mounted reading session. */
  @Prop pageTurnSimulationAvailable: boolean = true;
  @Prop ttsState: ReaderTtsState = createReaderTtsState(false);
  @Prop ttsTimerMode: ReaderTtsTimerMode = 'duration';
  @Prop ttsTimerMinutes: number = 25;
  @Prop ttsTimerSeconds: number = 0;
  @Prop ttsFollowHighlight: boolean = true;
  @Prop ttsPauseOnInterruption: boolean = true;
  @Prop ttsAllowMixing: boolean = false;
  @Prop ttsBackgroundPlayback: boolean = true;
  @Prop ttsKeepScreenOn: boolean = false;
  @Prop ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @Prop ttsEngine: string = 'system';
  @Prop ttsHttpEngines: ReaderTtsEngineOption[] = [];
  @Prop ttsVoiceOptions: ReaderTtsVoiceOption[] = [];
  @Prop ttsLanguage: string = 'zh-CN';
  @Prop ttsPerson: number = 0;
  @Prop @Watch('onLayoutChanged') reduceMotion: boolean = false;
  onExitReading: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  onSourceSwitch: () => void = (): void => {};
  onMore: () => void = (): void => {};
  onOpenBookInfo: () => void = (): void => {};
  @Prop currentPageBookmarked: boolean = false;
  @Prop currentPageBookmarkReady: boolean = false;
  @State private moreMenuVisible: boolean = false;
  onPageChange: (page: ReaderControlPage) => void = (_page: ReaderControlPage): void => {};
  onModuleSelect: (module: string) => void = (_module: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  // Bookmark tab precise-anchor wiring: undefined keeps the panel's legacy
  // chapter-start fallback, so this stays a zero-regression opt-in.
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number) => void) | undefined =
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
  onExpandDirectory: () => void = (): void => {};
  onSearchQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onSearchLoadMore: () => void = (): void => {};
  onSearchResultSelect: (result: ReadingContentSearchResult) => void =
    (_result: ReadingContentSearchResult): void => {};
  onAutoPageToggle: () => void = (): void => {};
  onAutoPageStop: () => void = (): void => {};
  onAutoPageSlowDown: () => void = (): void => {};
  onAutoPageSpeedUp: () => void = (): void => {};
  onAutoPageFullTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onAutoPageFullSpeedChange: (seconds: number) => void = (_seconds: number): void => {};
  onAutoPageFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onOpenReplace: () => void = (): void => {};
  onPreviewReplace: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onToggleReplaceRule: (ruleId: number, isEnabled: boolean) => void =
    (_ruleId: number, _isEnabled: boolean): void => {};
  onReloadControlReplace: () => Promise<void> = async (): Promise<void> => {};
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
  onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => void =
    (_fontOrder: ReaderAppearanceFontSlot[]): void => {};
  onAppearanceFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onAppearanceMotionActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onAppearanceCustomFontImport: () => void = (): void => {};
  onAppearanceIndentRequest: (indent: ReaderAppearanceIndent) => void =
    (_indent: ReaderAppearanceIndent): void => {};
  onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode) => void =
    (_mode: ReaderChineseConversionMode): void => {};
  onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean) => void =
    (_key: ReaderSettingsToggleKey, _value: boolean): void => {};
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
  onTtsRateChange: (rate: number) => void = (_rate: number): void => {};
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
  onTtsEngineChange: (engine: string) => Promise<void> = (_engine: string): Promise<void> => Promise.resolve();
  onTtsHttpEnginePut: (config: ReaderTtsEngineOption) => Promise<void> =
    (_config: ReaderTtsEngineOption): Promise<void> => Promise.resolve();
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
    if (this.launchOwnsControls) return;
    this.onSessionLaunchShellMeasured(this.layout.topBarTop + 54,
      this.layout.viewportHeight - this.dockTop() - this.frame().shell.y);
    const frame = this.frame();
    const localLeft = left - this.rootScreenX;
    const localTop = top - this.rootScreenY;
    const clipLeft = this.dockLeft() + frame.content.x;
    const clipTop = this.dockTop() + frame.content.y + frame.dock.translateY;
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
      kind === 'quickAutoPage' ? 12 : kind === 'fullTtsPlayback' ? 14 : 8,
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


  @State private progressPreviewPercent: number = -1;
  @State private brightnessPreviewPercent: number = -1;
  @State private appearanceFontReorderActive: boolean = false;
  private brightnessDragStartPercent: number = READER_CONTROL_BRIGHTNESS_MAX;
  private brightnessDragging: boolean = false;
  private brightnessLastEmittedPercent: number = -1;
  private geo: ReaderControlGeometry = new ReaderControlGeometry(false);
  private dockRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };
  private dockMeasured: boolean = false;
  private topBarRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };
  // The host stores these as a non-reactive input snapshot. Keep the array and
  // its two rects stable while the motion clock changes; replacing them every
  // VSync needlessly allocates and makes the host reassign the same geometry.
  private readonly backdropRegions: ReaderControlBackdropRect[] = [
    this.dockRect,
    { x: 0, y: 0, width: 0, height: 0 },
  ];
  private readonly expandCurve = curves.cubicBezierCurve(0, 0, 0.58, 1);
  private readonly collapseCurve = curves.cubicBezierCurve(0.42, 0, 1, 1);
  private readonly controlMotionCurve = curves.cubicBezierCurve(0.2, 0, 0, 1);

  aboutToAppear(): void {
    this.runtimeMounted = true;
    this.runtimeLifecycle += 1;
    this.runtime = new ReaderControlRuntime(this.runtimeConfig(), readerMotionNowMs);
    this.acceptRuntime(this.runtime.start(this.controlSession));
    this.onRuntimeEnabledChanged();
    registerReaderFonts(this.getUIContext().getFont());
    this.geo = new ReaderControlGeometry(this.isExpanded());
  }

  aboutToDisappear(): void {
    this.dismissMoreMenu();
    this.runtimeMounted = false;
    this.runtimeLifecycle += 1;
    this.pendingRuntimeFrame = false;
    this.cancelBrightnessDrag();
    this.runtime?.stop();
    this.onBackdropRegionsChange([], false);
    this.onTemporaryLayerChange(false);
    this.setAppearanceFontReorderActivity(false);
  }

  private runtimeConfig(): ReaderControlGestureConfig {
    return { axis: readerControlMotionAxis(readerControlMotionBounds(this.layout.fullPanelWidth,
      this.controlPanelHeight(), this.layout.dockBottomGap, this.controlQuickHeight()),
      this.rootScreenY + this.dockTop()), tapMaxDurationMs: 500, directionSlopVp: 8,
      settleDurationMs: this.reduceMotion ? 0 : READER_CONTROL_EXPAND_MS,
      showDurationMs: this.reduceMotion ? 0 : READER_CONTROL_OPEN_MS,
      dismissDurationMs: this.reduceMotion ? 0 : READER_CONTROL_DISMISS_MS, coordinatedMotion: true };
  }

  private acceptRuntime(update: ReaderControlRuntimeUpdate): void {
    if (!this.runtimeMounted) return;
    this.rememberVisibleContentLocation(update.session);
    const sessionChanged = !readerControlSessionStateEquals(this.visualSession, update.session);
    if (sessionChanged) {
      this.visualSession = update.session;
    }
    const visual = sampleReaderControlSession(update.session);
    this.visualExpansionProgress = visual.expansionProgress;
    this.visualVisibilityProgress = visual.visibilityProgress;
    this.visualHeldPointerId = update.session.heldPointerId;
    this.visualTransitionKind = update.session.transition?.kind ?? '';
    this.motionOffsetY = update.offsetY;
    if (sessionChanged) this.onVisualSessionChange(update.session);
    if (update.endpoint !== undefined) this.commitVisualSession(update.endpoint);
    const f = this.frame();
    if (this.contentMotionProgress !== f.progress) this.contentMotionProgress = f.progress;
    if (this.contentMotionWidth !== f.content.width) this.contentMotionWidth = f.content.width;
    if (this.contentMotionHeight !== f.content.height) this.contentMotionHeight = f.content.height;
    this.dockRect.x = this.rootScreenX + this.dockLeft();
    this.dockRect.y = this.rootScreenY + this.dockTop() + f.shell.y + f.dock.translateY;
    this.dockRect.width = f.shell.width;
    this.dockRect.height = f.shell.height;
    this.reportBackdropRegions();
    this.confirmLaunchSourceReady();
    this.scheduleRuntimeFrame();
  }

  private scheduleRuntimeFrame(): void {
    const runtime = this.runtime;
    if (!this.runtimeMounted || runtime === undefined || !runtime.needsFrame()) return;
    const ticket = runtime.ticket();
    if (this.pendingRuntimeFrame && this.pendingRuntimeTicket === ticket) return;
    const lifecycle = this.runtimeLifecycle;
    this.pendingRuntimeFrame = true;
    this.pendingRuntimeTicket = ticket;
    this.getUIContext().postFrameCallback(new ReaderControlFrameCallback((_time: number): void => {
      if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || this.pendingRuntimeTicket !== ticket) return;
      this.pendingRuntimeFrame = false;
      const update = runtime.frame(readerMotionNowMs(), ticket, (p: number): number => this.clockSample(p));
      if (update !== undefined) this.acceptRuntime(update);
      else this.scheduleRuntimeFrame();
    }));
  }

  private onLayoutChanged(): void {
    this.geo = new ReaderControlGeometry(this.isExpanded());
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.configure(this.runtimeConfig()));
  }

  private onRuntimeEnabledChanged(): void {
    if (this.runtime !== undefined) {
      this.acceptRuntime(this.runtime.setEnabled((this.inputEnabled || this.launchRecovering) && !this.controlObscured));
    }
  }

  private onControlSessionChanged(): void {
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(this.controlSession));
    if (readerControlContentLocation(this.controlSession).module !== 'appearance' ||
      readerControlContentLocation(this.controlSession).level !== 'secondary') {
      this.setAppearanceFontReorderActivity(false);
    }
  }

  private handleControlTouch(event: TouchEvent): void {
    const runtime = this.runtime;
    if (!this.runtimeMounted || runtime === undefined || !this.inputEnabled || this.controlObscured) return;
    if (event.type === TouchType.Cancel) {
      if (runtime.owner() >= 0) event.stopPropagation();
      this.acceptRuntime(runtime.cancel()); return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      if (pointers.length > 0 && runtime.owner() < 0 && !this.temporaryLayerActive) {
        this.inputClock = new ReaderPageInputClock();
        const time = this.inputClock.sample(event.timestamp, readerMotionNowMs());
        if (DEBUG) {
          this.inputMoveCount = 0;
          this.inputResetCount = 0;
          this.inputDownTime = event.timestamp;
          this.inputLastMoveTime = event.timestamp;
        }
        this.acceptRuntime(runtime.down(pointers[0].id, pointers[0].windowY, time));
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
      if (event.type === TouchType.Move) this.acceptRuntime(runtime.move(pointer.id, pointer.windowY, time));
      if (event.type === TouchType.Up) this.acceptRuntime(runtime.up(pointer.id, pointer.windowY, time));
      return;
    }
    if (runtime.owner() >= 0) event.stopPropagation();
  }

  @Builder
  private accessibleControlActions() {
    Text('关闭控制栏并返回阅读').width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.frame().visibility > 0 && this.inputEnabled)
      .onClick((): void => this.onDismiss());
    if (this.contentLocation().level === 'secondary') {
      Text(this.contentLocation().form === 'full' ? '收回快捷控制栏' : '展开完整控制栏')
        .width(1).height(1).accessibilityRole(AccessibilityRoleType.BUTTON)
        .enabled(this.contentInputEnabled() && !this.temporaryLayerActive)
        .onClick((): void => this.applySemanticSession(toggleReaderControlSession(this.visualSession,
          this.reduceMotion ? 0 : READER_CONTROL_EXPAND_MS)));
    }
  }

  private isExpanded(): boolean { return this.layout.isExpanded(); }

  private motionFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private quickEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private fullEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();

  private onLaunchSourceVisible(kind: ReaderSessionMorphSourceKind): void {
    if (!this.launchRecovering || kind !== this.launchSourceKind) return;
    this.launchSourceVisibleGeneration = this.launchGeneration;
    this.confirmLaunchSourceReady();
  }

  private confirmLaunchSourceReady(): void {
    if (!this.launchRecovering || this.launchSourceVisibleGeneration !== this.launchGeneration ||
      this.launchSourceReadyGeneration === this.launchGeneration || this.visualVisibilityProgress < 1) return;
    this.launchSourceReadyGeneration = this.launchGeneration;
    this.onLaunchSourceReady(this.launchGeneration);
  }

  private frame(): ReaderControlMotionFrame {
    const launch = this.launchSample;
    if (launch !== undefined && (this.launchOwnsControls || this.launchRecovering)) {
      const frame = this.launchFrameCache.sample(1, this.launchMotionProgress,
        this.layout.fullPanelWidth, this.controlPanelHeight(), this.layout.dockBottomGap,
        this.controlQuickHeight(), 0);
      // Recovery shares the existing control Runtime clock. Rebase the actual
      // outgoing offsets rather than flashing at its unrelated hidden endpoint.
      const remainder = this.launchRecovering ? 1 - this.visualVisibilityProgress : 1;
      frame.topBar.translateY = launch.topBarOffsetY * remainder;
      frame.dock.translateY = launch.dockOffsetY * remainder;
      return frame;
    }
    return this.motionFrameCache.sample(this.visualVisibilityProgress, this.visualExpansionProgress,
      this.layout.fullPanelWidth, this.controlPanelHeight(), this.layout.dockBottomGap,
      this.controlQuickHeight(), this.motionOffsetY);
  }


  private quickGeometryMode: boolean | undefined = undefined;
  private quickGeometry: ReaderControlGeometry | undefined = undefined;

  private controlPanelHeight(): number {
    return Math.min(Math.max(0, this.layout.fullPanelHeight), this.isExpanded() ? 852 : 736);
  }

  private controlQuickHeight(): number {
    // Quick sheet height is a stable design endpoint owned by the responsive
    // control geometry (Phone 330vp / Tablet 252vp). Clamp only when a short
    // window leaves less room than the authored endpoint; the Stage, parent
    // frame and embedded Lists all consume this same value.
    const expanded = this.isExpanded();
    if (this.quickGeometry === undefined || this.quickGeometryMode !== expanded) {
      this.quickGeometry = new ReaderControlGeometry(expanded);
      this.quickGeometryMode = expanded;
    }
    const authored = this.quickGeometry.sheetH;
    return Math.min(Math.max(0, this.controlPanelHeight()), authored);
  }

  private contentEndpointHeight(full: boolean): number {
    const cache = full ? this.fullEndpointCache : this.quickEndpointCache;
    return cache.sample(1, full ? 1 : 0, this.layout.fullPanelWidth,
      this.controlPanelHeight(), this.layout.dockBottomGap, this.controlQuickHeight()).content.height;
  }

  private clockSample(fraction: number): number {
    const transition = this.visualSession.transition;
    if (transition === undefined) return fraction;
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
    return this.inputEnabled && !this.controlObscured && visibility > 0 &&
      (this.visualTransitionKind === '' || this.visualTransitionKind === 'open') &&
      this.visualHeldPointerId < 0;
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
  private applySemanticSession(next: ReaderControlSessionState): void {
    if (!readerControlSessionStateEquals(this.controlSession, next)) this.controlSession = next;
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(next));
  }

  private rememberVisibleContentLocation(state: ReaderControlSessionState): void {
    const location = readerControlContentLocation(state);
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
    this.onBackdropRegionsChange(this.backdropRegions, ready);
  }

  private requestPage(page: ReaderControlPage): void {
    this.onInputActivity();
    this.onPageChange(page);
  }

  private collapseControl(): void {
    this.onInputActivity();
    // A collapse button can be tapped while a handle transition is still in
    // flight. Retarget from the exact local visual sample, not the sparse host
    // snapshot, so the shape/visibility path never jumps back to its command
    // origin before the runtime applies the module-specific settle timing.
    this.applySemanticSession(collapseReaderControlSession(this.visualSession, this.reduceMotion ? 0 : READER_CONTROL_EXPAND_MS));
  }

  private activateModule(module: string): void {
    let page: ReaderControlPage;
    if (module === 'directory') page = 'moduleDirectory';
    else if (module === 'tts') page = 'moduleTts';
    else if (module === 'appearance') page = 'moduleAppearance';
    else if (module === 'settings') page = 'moduleSettings';
    else return;
    const destination: ReaderControlPage = this.isActiveModule(module) ? 'home' : page;
    this.requestPage(destination);
    this.onModuleSelect(destination === 'home' ? 'home' : module);
  }

  private promoteSearch(): void { this.requestPage('quickSearch'); }
  private promoteAutoPage(): void { this.requestPage('quickAutoPage'); }
  private setAppearanceFontReorderActivity(active: boolean): void {
    if (this.appearanceFontReorderActive === active) return;
    this.appearanceFontReorderActive = active;
    this.onAppearanceFontReorderActivityChange(active);
  }

  private contentTitle(): string {
    const module = this.contentLocation().module;
    if (module === 'directory') return this.contentLocation().directoryTab === 'bookmarks' ? '书签' : '目录';
    if (module === 'appearance') return '界面';
    if (module === 'tts') return '朗读';
    if (module === 'settings') return '设置';
    if (module === 'search') return '内容搜索';
    if (module === 'autoPage') return '自动翻页';
    return '替换规则';
  }

  private listSessionKey(): string {
    return `${this.sourceId}:${this.bookTitle}:${this.controlOpenRevision}`;
  }

  /** Full-screen Stage placement; dock geometry remains in its local axis. */
  private dockLeft(): number {
    return this.isExpanded() ?
      this.layout.viewportWidth - this.layout.fullPanelRightGap - this.layout.fullPanelWidth :
      (this.layout.viewportWidth - this.layout.fullPanelWidth) / 2;
  }

  private dockTop(): number {
    return this.layout.viewportHeight - this.layout.dockBottomGap - this.controlPanelHeight();
  }

  // The production component owns both the clock and every actor builder.
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Top }) { this.topBar(); }
        .width(this.layout.topBarWidth).height(54)
        .position({ x: (this.layout.viewportWidth - this.layout.topBarWidth) / 2,
          y: this.layout.topBarTop })
        .translate({ y: this.frame().topBar.translateY }).opacity(this.frame().topBar.opacity)
        .enabled(this.inputEnabled && this.frame().topBar.opacity > 0)
        .hitTestBehavior(this.frame().topBar.opacity > 0 ? HitTestMode.Transparent : HitTestMode.None)
        .onAreaChange((_previous: Area, current: Area): void => {
          this.measureTopBar({ x: Number(current.globalPosition.x),
            y: Number(current.globalPosition.y), width: Number(current.width),
            height: Number(current.height) });
        });
      Stack({ alignContent: Alignment.TopStart }) {
        Stack()
          .id('reader-control-motion-shell')
          .width(this.frame().shell.width).height(this.frame().shell.height)
          .position({ x: 0, y: this.frame().shell.y })
          .backgroundColor(readerAppColor('TOK_READ_SURFACE', this.appScheme)).borderRadius(24)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
          .opacity(this.frame().shell.opacity)
          // The shell is a visual actor only.  A full-size Block here steals
          // pointer hit testing from the mounted header/content actors below,
          // so taps such as the collapse action never reach their onClick.
          .hitTestBehavior(HitTestMode.None);
        Stack()
          .id('reader-control-full-content-surface')
          .width(this.frame().contentSurface.width).height(this.frame().contentSurface.height)
          .position({ x: this.frame().contentSurface.x, y: this.frame().contentSurface.y })
          .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appScheme)).borderRadius(12)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appScheme) })
          .opacity(readerControlHasFullContentSurface(this.contentLocation().module) ?
            this.frame().contentSurface.opacity : 0)
          .visibility(Visibility.Visible)
          .enabled(false).hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) {
          Stack({ alignContent: Alignment.TopStart }) { this.controlContent(); }
            .width(this.frame().content.width).height(this.frame().content.height)
            .position({ x: 0, y: 0 });
        }
          .width(this.frame().content.width).height(this.frame().content.height)
          .position({ x: this.frame().content.x, y: this.frame().content.y })
          .clip(true).opacity(this.frame().content.opacity)
          .enabled(this.contentInputEnabled())
          .hitTestBehavior(this.frame().visibility > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.controlHeader(); }
          .width(this.frame().header.width).height(this.frame().header.height)
          .position({ x: this.frame().header.x, y: this.frame().header.y })
          .opacity((this.contentLocation().module === 'replace') ? 1 : this.frame().header.opacity)
          // Header controls must win over the visual shell and content slot
          // at the same coordinates while keeping the authored actor mounted.
          .zIndex(2)
          .hitTestBehavior(HitTestMode.Block)
          .enabled(this.inputEnabled && this.frame().visibility > 0 && this.visualHeldPointerId < 0);
        Stack({ alignContent: Alignment.TopStart }) { this.brightnessRail(); }
          .width(this.frame().brightness.width).height(this.frame().brightness.height)
          .position({ x: this.frame().brightness.x, y: this.frame().brightness.y })
          .opacity(this.frame().brightness.opacity)
          // HitTestMode.None excludes only this container, not its children.
          // Retain the authored actors, but retire the whole faded subtree.
          .enabled(this.contentInputEnabled() && this.frame().brightness.opacity > 0)
          .hitTestBehavior(this.frame().brightness.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.moduleNavBar(); }
          .width(this.frame().navigation.width).height(this.frame().navigation.height)
          .position({ x: this.frame().navigation.x, y: this.frame().navigation.y })
          .opacity(this.frame().navigation.opacity)
          .enabled(this.contentInputEnabled() && this.frame().navigation.opacity > 0)
          .hitTestBehavior(this.frame().navigation.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.Top }) {
          Row().width(42).height(4).borderRadius(2).backgroundColor(readerAppColor('TOK_READ_HANDLE', this.appScheme))
            .margin({ top: 9 }).opacity(this.frame().grabber.opacity);
        }
        .width(72).height(28)
        .id('reader-control-motion-grabber')
        .position({ x: (this.layout.fullPanelWidth - 72) / 2, y: this.frame().shell.y })
        .hitTestBehavior(HitTestMode.Block)
        .accessibilityText(this.contentLocation().level === 'home' ?
          '控制栏拖动区域，向下关闭' : '控制栏展开或收起，向下关闭')
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityLevel('no')
        .accessibilityVirtualNode(this.accessibleControlActions)
        .onTouch((event: TouchEvent): void => {
          this.handleControlTouch(event);
        });
        }
        .width(this.layout.fullPanelWidth).height(this.controlPanelHeight())
        .translate({ y: this.frame().dock.translateY })
        .opacity(this.frame().dock.opacity)
        .position({ x: this.dockLeft(), y: this.dockTop() })
        .enabled(this.inputEnabled && this.frame().visibility > 0)
          .hitTestBehavior(this.inputEnabled && this.frame().visibility > 0 ?
          HitTestMode.Transparent : HitTestMode.None);
      if (this.moreMenuVisible) { this.readerMoreMenu(); }
      if (this.launchSample !== undefined) {
        ReaderSessionLaunchStage({
          sample: this.launchSample, sessionState: this.launchBusinessStatus,
          desiredPlaying: this.launchDesiredPlaying, countdown: this.launchCountdown,
          interactionEnabled: this.launchInteractionEnabled,
          surfaceColor: readerAppColor('TOK_READ_SURFACE', this.appScheme),
          surfaceBorderColor: readerAppColor('TOK_LINE', this.appScheme),
          sourceSurfaceColor: readerAppColor(this.launchSourceKind === 'fullAutoPagePlayback' ?
            'TOK_SURFACE_PANEL_SOFT' : this.launchSourceKind === 'fullTtsPlayback' ? 'TOK_TTS_CARD' :
              this.launchSourceKind === 'quickTts' ? 'TOK_TTS_QUICK_CARD' : 'TOK_SURFACE_PANEL', this.appScheme),
          sourceBorderColor: readerAppColor(this.launchSourceKind === 'quickTts' ?
            'app.control.paint.66B4A697' : this.launchSourceKind === 'fullTtsPlayback' ? 'TOK_TTS_LINE' : 'TOK_LINE', this.appScheme),
          sourceBorderWidth: this.launchSample.type === 'tts' ? 0.5 : TOK_BORDER_W,
          sourceSurfaceTopInset: this.launchSourceKind === 'fullTtsPlayback' ? 27 : 0,
          sourceHighlightColor: this.launchSourceKind === 'fullTtsPlayback' ? readerAppColor('app.control.paint.99FFFFFF', this.appScheme) : '#00000000',
          sourceGradientStart: this.launchSourceKind === 'quickTts' ? readerAppColor('app.control.paint.FFFAF4', this.appScheme) : '',
          sourceGradientEnd: this.launchSourceKind === 'quickTts' ? readerAppColor('app.control.paint.F6ECDD', this.appScheme) : '',
          textColor: readerAppColor('TOK_READ_INK', this.appScheme),
          primaryColor: readerAppColor('TOK_READ_PRIMARY', this.appScheme),
          onPrimaryColor: readerAppColor('app.control.onPrimary', this.appScheme),
          themeScheme: this.appScheme,
          sourceSharpContent: (): void => { this.launchSourceContent(); },
          sourceBlurContent: (): void => { this.launchSourceContent(); },
          onToggle: (): void => this.onLaunchToggle(),
        }).opacity(this.launchStageOpacity).zIndex(9);
      }
    }
    .visibility(this.controlObscured ? Visibility.Hidden : Visibility.Visible)
    .width(this.layout.viewportWidth)
    .height(this.layout.viewportHeight)
    .accessibilityLevel(this.frame().visibility > 0 || this.launchSample !== undefined ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_previous: Area, current: Area): void => {
      this.rootScreenX = Number(current.globalPosition.x);
      this.rootScreenY = Number(current.globalPosition.y);
      this.dockMeasured = true;
      this.onLayoutChanged();
    });
  }

  private setMoreMenuVisible(visible: boolean): void {
    if (visible && (!this.inputEnabled || this.frame().visibility <= 0)) return;
    if (this.moreMenuVisible === visible) return;
    this.moreMenuVisible = visible;
    this.onTemporaryLayerChange(visible);
  }

  private dismissMoreMenu(): void { this.setMoreMenuVisible(false); }

  private performMoreAction(action: 'info' | 'bookmark' | 'directory' | 'source'): void {
    if (!this.moreMenuVisible || !this.inputEnabled) return;
    if (action === 'bookmark' && !this.currentPageBookmarkReady) return;
    if (action === 'source' && this.isLocalBook()) return;
    this.dismissMoreMenu();
    if (action === 'info') this.onOpenBookInfo();
    else if (action === 'bookmark') this.onMore();
    else if (action === 'directory') this.onExpandDirectory();
    else this.onSourceSwitch();
  }

  @Builder
  private readerMoreAction(label: string, action: 'info' | 'bookmark' | 'directory' | 'source', enabled: boolean) {
    Row() {
      Text(label).fontFamily('ReaderNotoSansSC').fontSize(15)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1);
    }.width('100%').height(50).padding({ left: 18, right: 18 })
      .opacity(enabled ? 1 : 0.45).enabled(enabled)
      .accessibilityText(label).onClick((): void => this.performMoreAction(action));
  }

  @Builder
  private readerMoreMenu() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent)
        .accessibilityText('关闭阅读更多').onClick((): void => this.dismissMoreMenu());
      Scroll() {
        Column() {
          this.readerMoreAction('书籍信息', 'info', true);
          this.readerMoreAction(this.currentPageBookmarked ? '移除当前页书签' : '添加当前页书签',
            'bookmark', this.currentPageBookmarkReady);
          this.readerMoreAction('目录', 'directory', true);
          if (!this.isLocalBook()) this.readerMoreAction('换源', 'source', true);
        }.width('100%');
      }.width(Math.min(176, Math.max(0, this.layout.viewportWidth - 24)))
        .height(Math.min(this.isLocalBook() ? 150 : 200,
          Math.max(0, this.layout.viewportHeight - this.layout.topBarTop - 62 - this.layout.dockBottomGap)))
        .scrollBar(BarState.Off).backgroundColor(readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', this.appScheme))
        .border({ width: 1, color: readerAppColor('app.BookshelfMoreMenu.build.color.FFE3DED6', this.appScheme) })
        .borderRadius(16).clip(true)
        .shadow({ radius: 28, color: readerAppColor('app.BookshelfMoreMenu.build.color.292E261F', this.appScheme), offsetY: 10 })
        .position({ x: Math.max(12, (this.layout.viewportWidth + this.layout.topBarWidth) / 2 - 176 - 13),
          y: this.layout.topBarTop + 62 });
    }.width('100%').height('100%').zIndex(12);
  }

  @Builder
  private launchSourceContent() {
    if (this.launchSourceKind === 'quickAutoPage' || this.launchSourceKind === 'fullAutoPagePlayback') {
      ReaderControlAutoPageContent({
        sourceOnly: this.launchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        form: this.launchSourceKind === 'quickAutoPage' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.contentEndpointHeight(true),
        interactionEnabled: false, status: this.launchSourceAutoStatus,
        speedSeconds: this.autoPageSpeedSeconds, timerSummaryText: this.autoPageTimerSummaryText,
        timerMinutes: this.autoPageTimerMinutes, timerSeconds: this.autoPageTimerSeconds,
        followHighlight: this.autoPageFollowHighlight, canPreviousChapter: this.currentChapterIndex > 0,
        canNextChapter: this.currentChapterIndex >= 0 && this.currentChapterIndex < this.totalChapters - 1,
      });
    } else {
      ReaderControlTtsContent({
        sourceOnly: this.launchSourceKind === 'quickTts' ? 'quick' : 'full',
        frozenWaveformSample: this.launchWaveformSample, reduceMotion: this.reduceMotion,
        form: this.launchSourceKind === 'quickTts' ? 'quick' : 'full',
        motionProgress: this.launchMotionProgress, availableWidth: this.launchContentWidth,
        availableHeight: this.launchContentHeight, fullViewportHeight: this.contentEndpointHeight(true),
        interactionEnabled: false, state: this.launchSourceTtsState,
        timerMode: this.ttsTimerMode, timerMinutes: this.ttsTimerMinutes, timerSeconds: this.ttsTimerSeconds,
        engine: this.ttsEngine, language: this.ttsLanguage, person: this.ttsPerson,
        voiceOptions: this.ttsVoiceOptions, followHighlight: this.ttsFollowHighlight,
      });
    }
  }

  private measureTopBar(rect: ReaderControlBackdropRect): void {
    this.topBarRect = rect;
    this.reportBackdropRegions();
  }

  private headerFrame(): ReaderControlActorFrame {
    return readerControlHeaderFrame(this.contentLocation().module,
      this.frame().progress, this.frame().header.width);
  }

  private headerInter(): boolean {
    const module = this.contentLocation().module;
    return module === 'search' || module === 'autoPage';
  }

  private headerIcon(): Resource {
    const location = this.contentLocation();
    if (location.module === 'directory') return location.directoryTab === 'bookmarks' ?
      $r(this.appScheme === 'night' ? 'app.media.reader_directory_marker_bookmark_theme_night' : 'app.media.reader_directory_marker_bookmark') : $r(this.appScheme === 'night' ? 'app.media.reader_directory_directory_theme_night' : 'app.media.reader_directory_directory');
    if (location.module === 'tts') return $r(this.appScheme === 'night' ? 'app.media.reader_tts_header_theme_night' : 'app.media.reader_tts_header');
    if (location.module === 'appearance') return $r(this.appScheme === 'night' ? 'app.media.reader_appearance_header_theme_night' : 'app.media.reader_appearance_header');
    if (location.module === 'settings') return $r(this.appScheme === 'night' ? 'app.media.reader_settings_header_theme_night' : 'app.media.reader_settings_header');
    if (location.module === 'autoPage') return $r(this.appScheme === 'night' ? 'app.media.reader_auto_full_header_theme_night' : 'app.media.reader_auto_full_header');
    return $r(this.appScheme === 'night' ? 'app.media.rc_search_theme_night' : 'app.media.rc_search');
  }

  @Builder
  private controlHeader() {
    if (this.contentLocation().module === 'replace') {
      this.replaceHeader();
    } else {
    Stack({ alignContent: Alignment.TopStart }) {
      Image(this.headerIcon()).width(16).height(16).position({ x: 0, y: 7 })
        .hitTestBehavior(HitTestMode.None);
      Text(this.contentTitle()).fontFamily(this.headerInter() ? 'ReaderInter' : 'ReaderNotoSansSCUIBold')
        .fontWeight(FontWeight.Bold, { enableVariableFontWeight: true }).fontSize(14).lineHeight(this.headerInter() ? 16.8 : 20)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width(Math.max(0, this.headerFrame().width - 74)).height(this.headerInter() ? 17 : 20)
        .position({ x: 24, y: this.headerInter() ? 6.5 : 5 });
      Stack({ alignContent: Alignment.TopStart }) {
        Text('收起').width(20).height(this.headerInter() ? 12 : 14)
          .fontFamily(this.headerInter() ? 'ReaderInter' : 'ReaderNotoSansSCUIBold')
          .fontWeight(FontWeight.Bold, { enableVariableFontWeight: true }).fontSize(10).lineHeight(this.headerInter() ? 12 : 14)
          .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme)).textAlign(TextAlign.Center)
          .position({ x: 10, y: this.headerInter() ? 7 : 6 });
      }.width(40).height(26).position({ x: Math.max(0, this.headerFrame().width - 40), y: 2 })
        .backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme)).borderRadius(8)
        .id('reader-control-collapse')
        .hitTestBehavior(HitTestMode.Block)
        .accessibilityText(`收起${this.contentTitle()}`)
        .onClick((): void => this.collapseControl());
    }.width(this.headerFrame().width).height(this.headerFrame().height)
      .position({ x: this.headerFrame().x, y: this.headerFrame().y });
    }
  }

  private replaceHeaderFrame(): ReaderControlReplaceHeaderFrame {
    return sampleReaderControlReplaceHeader(this.frame().progress, this.frame().header.width);
  }

  @Builder
  private replaceHeader() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('替换规则管理').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
        .fontSize(14).lineHeight(16.8).fontColor(readerAppColor('TOK_READ_INK', this.appScheme)).maxLines(1)
        .width(this.replaceHeaderFrame().title.width).height(this.replaceHeaderFrame().title.height)
        .position({ x: this.replaceHeaderFrame().title.x, y: this.replaceHeaderFrame().title.y })
        .opacity(this.replaceHeaderFrame().title.opacity).hitTestBehavior(HitTestMode.None);
      Image($r(this.appScheme === 'night' ? 'app.media.reader_control_replace_header_theme_night' : 'app.media.reader_control_replace_header'))
        .width(this.replaceHeaderFrame().icon.width).height(this.replaceHeaderFrame().icon.height)
        .position({ x: this.replaceHeaderFrame().icon.x, y: this.replaceHeaderFrame().icon.y })
        .opacity(this.replaceHeaderFrame().icon.opacity).hitTestBehavior(HitTestMode.None);
      Text('完成').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
        .fontSize(10).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme)).textAlign(TextAlign.Center)
        .width(this.replaceHeaderFrame().action.width).height(this.replaceHeaderFrame().action.height)
        .position({ x: this.replaceHeaderFrame().action.x, y: this.replaceHeaderFrame().action.y })
        .opacity(this.replaceHeaderFrame().action.opacity).backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme)).borderRadius(8)
        .enabled(this.frame().progress === 1).accessibilityText('完成替换规则管理，收起到快捷态')
        .accessibilityLevel(this.frame().progress === 1 ? 'auto' : 'no-hide-descendants')
        .onClick((): void => this.collapseControl());
    }.width(this.frame().header.width).height(30).hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private controlContent() {
    // Only a business route change replaces a module. Quick/Full uses one tree.
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.contentLocation().level === 'home') {
        Column({ space: READER_CONTROL_HOME_SECTION_GAP }) { this.chapterProgress(); this.quickActionPanel(); }
          .width(this.frame().content.width).alignItems(HorizontalAlign.Start);
      } else if (this.contentLocation().module === 'directory') {
        ReaderControlDirectoryContent({
          entries: this.tocEntries, currentChapterIndex: this.currentChapterIndex,
          bookmarkLoadFailed: this.bookmarkLoadFailed,
          bookmarkLoadMessage: this.bookmarkLoadMessage,
          onRetryBookmarkLoad: (): void => this.onRetryBookmarkLoad(),
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          progress: this.contentMotionProgress,
          interactionEnabled: this.secondaryModuleInputEnabled('directory'),
          availableWidth: this.contentMotionWidth, availableHeight: this.contentMotionHeight,
          tab: this.contentLocation().directoryTab,
          sessionKey: this.listSessionKey(), bookmarkIdentity: this.bookmarkIdentity,
          onTabChange: (tab: string): void => {
            this.onInputActivity();
            this.applySemanticSession(setReaderControlDirectoryTab(this.controlSession,
              tab === 'bookmarks' ? 'bookmarks' : 'directory'));
          },
          onSelectChapter: (index: number): void => this.onSelectChapter(index),
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
    .id('reader-control-content-host')
    .width(this.frame().content.width).height(this.frame().content.height);
  }

  @Builder
  private appearanceContent() {
    ReaderControlAppearanceContent({
      isTablet: this.isExpanded(),
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentMotionHeight,
      fullContentHeight: this.contentEndpointHeight(true),
      interactionEnabled: this.contentInputEnabled(),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: (active: boolean): void => this.onTemporaryLayerChange(active),
      reduceMotion: this.reduceMotion,
      motionProgress: this.contentMotionProgress,
      snapshot: this.appearanceSnapshot,
      chineseConversionMode: this.chineseConversionMode,
      pageTurnStyle: readerPageTurnStyle(this.settingsSnapshot),
      pageTurnSimulationAvailable: this.pageTurnSimulationAvailable,
      onCollapse: (): void => this.collapseControl(),
      onThemeChange: (theme: ReaderAppearanceTheme): void => this.onAppearanceThemeChange(theme),
      onSetDayTheme: (theme: ReaderAppearanceTheme): void => this.onAppearanceDayThemeChange(theme),
      onSetNightTheme: (theme: ReaderAppearanceTheme): void => this.onAppearanceNightThemeChange(theme),
      onFontChange: (font: ReaderAppearanceFont): void => this.onAppearanceFontChange(font),
      onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): void =>
        this.onAppearanceFontOrderChange(fontOrder),
      onFontReorderActivityChange: (active: boolean): void =>
        this.setAppearanceFontReorderActivity(active),
      onCustomFontImport: (): void => this.onAppearanceCustomFontImport(),
      onIndentRequest: (indent: ReaderAppearanceIndent): void => this.onAppearanceIndentRequest(indent),
      onAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
        this.onAppearanceAlignmentRequest(current),
      onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
        this.onAppearanceMetricStep(metric, direction),
      onChineseConversionChange: (mode: ReaderChineseConversionMode): void =>
        this.onChineseConversionChange(mode),
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        this.onPageTurnStyleChange(style),
    });
  }

  private secondaryModuleInputEnabled(module: string): boolean {
    return this.contentLocation().level === 'secondary' &&
      this.contentLocation().module === module && this.contentInputEnabled();
  }

  @Builder
  private searchModuleContent() {
    ReaderControlSearchContent({
      fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentMotionHeight,
      interactionEnabled: this.secondaryModuleInputEnabled('search'),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: (active: boolean): void => this.onTemporaryLayerChange(active),
      query: this.searchQuery,
      state: this.searchState,
      onBack: (): void => this.requestPage('home'),
      onQueryChange: (query: string): void => this.onSearchQueryChange(query),
      onSearch: (): void => this.onSearch(),
      onLoadMore: (): void => this.onSearchLoadMore(),
      onSelectResult: (result: ReadingContentSearchResult): void => this.onSearchResultSelect(result),
    });
  }

  @Builder
  private settingsModuleContent() {
    ReaderControlSettingsContent({
      fullViewportHeight: this.contentEndpointHeight(true),
      motionProgress: this.contentMotionProgress,
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentMotionHeight,
      interactionEnabled: this.secondaryModuleInputEnabled('settings'),
      snapshot: this.settingsSnapshot,
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
      sourceDetached: this.launchSample !== undefined && this.launchOwnsControls && this.launchSample.type === 'tts',
      reduceMotion: this.reduceMotion,
      waveformActive: this.frame().visibility > 0 && !this.launchOwnsControls && !this.controlObscured,
      onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => this.onLaunchSourceVisible(kind),
      dismissTemporaryRevision: this.dismissTemporaryRevision,
      onTemporaryLayerChange: (active: boolean): void => this.onTemporaryLayerChange(active),
      fullViewportHeight: this.contentEndpointHeight(true),
      motionProgress: this.contentMotionProgress,
      form: this.contentLocation().form,
      isTablet: this.isExpanded(),
      availableWidth: this.contentMotionWidth,
      availableHeight: this.contentMotionHeight,
      interactionEnabled: this.secondaryModuleInputEnabled('tts'),
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
      voiceOptions: this.ttsVoiceOptions,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      onCollapse: (): void => this.collapseControl(),
      onToggle: (): void => this.onTtsToggle(),
      onStop: (): void => this.onTtsStop(),
      onPrevious: (): void => this.onTtsPrevious(),
      onNext: (): void => this.onTtsNext(),
      onSeek: (sliceIndex: number): void => this.onTtsSeek(sliceIndex),
      onRateChange: (rate: number): void => this.onTtsRateChange(rate),
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
      onHttpEnginePut: (config: ReaderTtsEngineOption): Promise<void> => this.onTtsHttpEnginePut(config),
      onHttpEngineDelete: (id: number): Promise<void> => this.onTtsHttpEngineDelete(id),
      onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
        width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
    });
  }

  @Builder
  private autoPageModuleContent() {
        ReaderControlAutoPageContent({
          sourceDetached: this.launchSample !== undefined && this.launchOwnsControls && this.launchSample.type === 'autoPage',
          onMorphActorVisible: (kind: ReaderSessionMorphSourceKind): void => this.onLaunchSourceVisible(kind),
          fullViewportHeight: this.contentEndpointHeight(true),
          isTablet: this.isExpanded(), motionProgress: this.contentMotionProgress,
          form: this.contentLocation().form,
          availableWidth: this.contentMotionWidth,
          availableHeight: this.contentMotionHeight,
          interactionEnabled: this.secondaryModuleInputEnabled('autoPage'),
          canPreviousChapter: this.currentChapterIndex > 0,
          canNextChapter: this.currentChapterIndex >= 0 && this.currentChapterIndex < this.totalChapters - 1,
          status: this.autoPageStatus, speedSeconds: this.autoPageSpeedSeconds,
          timerMinutes: this.autoPageTimerMinutes, timerSeconds: this.autoPageTimerSeconds,
          timerSummaryText: this.autoPageTimerSummaryText, followHighlight: this.autoPageFollowHighlight,
          onBack: (): void => this.requestPage('home'),
          onPreviousChapter: (): void => this.onPreviousChapter(),
          onToggleRunning: (): void => this.onAutoPageToggle(),
          onStop: (): void => this.onAutoPageStop(),
          onNextChapter: (): void => this.onNextChapter(),
          onTimerChange: (minutes: number, seconds: number): void =>
            this.onAutoPageFullTimerChange(minutes, seconds),
          onSpeedChange: (seconds: number): void => this.onAutoPageFullSpeedChange(seconds),
          onFollowHighlightChange: (enabled: boolean): void => this.onAutoPageFollowHighlightChange(enabled),
          onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
            width: number, height: number): void => this.reportSessionMorphSource(kind, left, top, width, height),
        });
  }

  @Builder
  private replaceModuleContent() {
        ReaderControlReplaceContent({
          fullContentHeight: this.contentEndpointHeight(true), quickContentHeight: this.contentEndpointHeight(false),
          state: this.controlReplaceState, motionProgress: this.contentMotionProgress,
          availableWidth: this.contentMotionWidth, availableHeight: this.contentMotionHeight,
          interactionEnabled: this.secondaryModuleInputEnabled('replace'), dismissTemporaryRevision: this.dismissTemporaryRevision,
          onTemporaryLayerChange: (active: boolean): void => this.onTemporaryLayerChange(active),
          onBack: (): void => this.requestPage('home'),
          onExpand: (): void => {
            this.onInputActivity();
            this.applySemanticSession(expandReaderControlSession(this.controlSession,
              this.reduceMotion ? 0 : READER_CONTROL_EXPAND_MS));
          },
          onReload: (): Promise<void> => this.onReloadControlReplace(),
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
    Row({ space: 8 }) {
      // BackHitArea 44×42 (icon 24 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_arrow_left_theme_night' : 'app.media.rc_arrow_left'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(42)
      .accessibilityText('退出阅读，返回上一页')
      .onClick((): void => this.onExitReading());

      // TopBar/Text: 书名思源宋体 Bold 16，章节·书源思源宋体 Regular 12。
      Column({ space: 5 }) {
        Text(this.bookTitle)
          .fontFamily(TYPE_READER_CONTROL_BOOK_TITLE.fontFamily)
          .fontWeight(TYPE_READER_CONTROL_BOOK_TITLE.fontWeight)
          .fontSize(TYPE_READER_CONTROL_BOOK_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(`${this.chapterTitle} · ${this.sourceLabel()}`)
          .fontFamily(TYPE_READER_CONTROL_CHAPTER_SOURCE.fontFamily)
          .fontWeight(TYPE_READER_CONTROL_CHAPTER_SOURCE.fontWeight)
          .fontSize(TYPE_READER_CONTROL_CHAPTER_SOURCE.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .height(45)
      .alignItems(HorizontalAlign.Start);

      // SourceSwitchHitArea 62×42: icon + 换源 居中。
      Column({ space: 3.75 }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_switch_horizontal_theme_night' : 'app.media.rc_switch_horizontal'))
          .width(20)
          .height(20)
          .margin({ top: 1.25   });
        Text('换源')
          .fontFamily(TYPE_READER_CONTROL_SOURCE_ACTION.fontFamily)
          .fontWeight(TYPE_READER_CONTROL_SOURCE_ACTION.fontWeight, { enableVariableFontWeight: true })
          .fontSize(TYPE_READER_CONTROL_SOURCE_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
          .maxLines(1);
      }
      .width(62)
      .height(42)
      .alignItems(HorizontalAlign.Center)
      .opacity(this.isLocalBook() ? 0.4 : 1)
      .enabled(!this.isLocalBook())
      .accessibilityText('换源')
      .onClick((): void => {
        // 本地书籍换源置灰不可点; 仅在线书籍可换源。
        if (!this.isLocalBook()) {
          this.onSourceSwitch();
        }
      });

      // MoreHitArea 34×42 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_dots_theme_night' : 'app.media.rc_dots'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(42)
      .enabled(this.inputEnabled)
      .onClick((): void => this.setMoreMenuVisible(!this.moreMenuVisible))
      .accessibilityText('更多');
    }
    .width(this.layout.topBarWidth)
    .height(54)
    .padding({ left: 13, right: 13 })
    .alignItems(VerticalAlign.Center)
    // The enclosing MotionStage gates the top-bar hit region from its local
    // visual clock.  This inner content stays non-reactive so a VSync sample
    // cannot rebuild the Panel merely to toggle a modifier.
    .enabled(this.inputEnabled)
    .backgroundColor(readerAppColor('TOK_READ_SURFACE', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius(24)
    ;
  }

  @Builder
  private quickActionPanel() {
    Row({ space: 8 }) {
      this.quickAction('rc_search', '搜索', 'search');
      this.quickAction('rc_autopage', '自动翻页', 'autoPage');
      this.quickAction('rc_replace', '替换', 'replace');
    }
    .width('100%')
    .height(READER_CONTROL_HOME_QUICK_ACTION_HEIGHT)
    .padding({ left: 9 })
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius(8);
  }

  @Builder
  private quickAction(icon: string, label: string, action: ReaderQuickAction) {
    Column() {
      Image($r(`app.media.${icon}`))
        .width(24)
        .height(24)
        .margin({ top: 4.72   });
      Text(label)
        .width('100%')
        .height(13)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(11)
        .lineHeight(13)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .margin({ top: 5.78   });
    }
    .layoutWeight(1)
    .height(55.438)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_READ_ELEVATED', this.appScheme))
    .borderRadius(8)
    .accessibilityText(label)
    .onClick((): void => {
      if (action === 'search') {
        this.promoteSearch();
      } else if (action === 'autoPage') {
        this.promoteAutoPage();
      } else if (action === 'replace') {
        this.onInputActivity();
        this.onOpenReplace();
      }
    });
  }

  @Builder
  private chapterProgress() {
    Column({ space: 0 }) {
      this.chapterRow();
      this.progressRow();
    }
    .width('100%')
    .height(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius(8);
  }

  @Builder
  private chapterRow() {
    Row({ space: 8 }) {
      // Step/Previous 34×34 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_chevron_left_theme_night' : 'app.media.rc_chevron_left'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(34)
      .backgroundColor(this.canStepChapter(-1) ? readerAppColor('TOK_READ_ELEVATED', this.appScheme) : readerAppColor('TOK_READ_DISABLED_BG', this.appScheme))
      .borderRadius(999)
      .opacity(this.canStepChapter(-1) ? 1 : 0.4)
      .enabled(this.canStepChapter(-1))
      .accessibilityText('上一章')
      .onClick((): void => {
        if (this.canStepChapter(-1)) {
          this.onPreviousChapter();
        }
      });

      // ChapterTitle Inter Bold 13 居中 (layoutWeight 吃剩余宽)。
      Text(this.chapterTitle)
        .layoutWeight(1)
        .height(34)
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(13)
        .lineHeight(16.25)
        .fontColor(readerAppColor('TOK_READ_INK', this.appScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      // Step/Next 34×34 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.appScheme === 'night' ? 'app.media.rc_chevron_right_theme_night' : 'app.media.rc_chevron_right'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(34)
      .backgroundColor(this.canStepChapter(1) ? readerAppColor('TOK_READ_ELEVATED', this.appScheme) : readerAppColor('TOK_READ_DISABLED_BG', this.appScheme))
      .borderRadius(999)
      .opacity(this.canStepChapter(1) ? 1 : 0.4)
      .enabled(this.canStepChapter(1))
      .accessibilityText('下一章')
      .onClick((): void => {
        if (this.canStepChapter(1)) {
          this.onNextChapter();
        }
      });
    }
    .width('100%')
    .height(52.563)
    .padding({ left: 11, right: 11, top: 10 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private progressRow() {
    Row() {
      // 进度百分比 Inter Regular 9 (固定 26.23 宽容器, 使 slider 起点对齐 Figma)。
      Text(`${Math.round(this.effectiveProgressPercent())}%`)
        .width(26.23)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appScheme))
        .maxLines(1);

      // Native Slider owns pointer/keyboard semantics; its visual parameters
      // retain the Figma 5vp track and 18vp bordered thumb. The owner receives
      // only the final value and resolves it to a real chapter/scalar anchor.
      Slider({
        value: this.effectiveProgressPercent(),
        min: READER_CONTROL_PROGRESS_MIN,
        max: READER_CONTROL_PROGRESS_MAX,
        step: READER_CONTROL_PROGRESS_STEP,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
      .trackThickness(5)
      .blockSize({ width: 18, height: 18 })
      .blockColor(readerAppColor('TOK_SURFACE_SOLID_OPAQUE', this.appScheme))
      .blockBorderColor(readerAppColor('TOK_ACCENT', this.appScheme))
      .blockBorderWidth(2.778)
      .selectedColor(readerAppColor('TOK_ACCENT', this.appScheme))
      .trackColor(readerAppColor('TOK_BORDER', this.appScheme))
      .showSteps(false)
      .showTips(false)
      .accessibilityText('阅读进度')
      .onChange((value: number, mode: SliderChangeMode): void => {
        this.progressPreviewPercent = this.clampPercent(value);
        if (mode === SliderChangeMode.End) {
          const committed = this.progressPreviewPercent;
          this.progressPreviewPercent = -1;
          this.onProgressChange(committed);
        }
      })
      .layoutWeight(1)
      .height(30);

      // 共 N 章 Inter Regular 9 右对齐。
      Text(`共 ${this.totalChapters} 章`)
        .width(39)
        .height(30)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appScheme))
        .textAlign(TextAlign.RIGHT)
        .maxLines(1)
        .margin({ left: 5.5   });
    }
    .width('100%')
    .height(30)
    .padding({ left: 11, right: 11, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  private clampPercent(value: number): number {
    return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX, value));
  }

  private effectiveProgressPercent(): number {
    return this.progressPreviewPercent >= 0 ? this.progressPreviewPercent : this.clampPercent(this.progressPercent);
  }

  @Builder
  private brightnessRail() {
    Column() {
      // Icon/Sun 20×20 (rail 内水平居中, 中心对齐 19)。
      Image($r(this.appScheme === 'night' ? 'app.media.rc_sun_theme_night' : 'app.media.rc_sun'))
        .width(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
        .height(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
        .margin({ top: READER_CONTROL_BRIGHTNESS_ICON_TOP });

      // BrightnessTrack 8×92 with a 24×92 pointer target. Gesture coordinates
      // are mapped to the whole authored track; an invisible OutSet slider
      // would retain an implicit thumb inset and shorten the usable range.
      Stack({ alignContent: Alignment.Bottom }) {
        Row()
          .width(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH)
          .height('100%')
          .backgroundColor(readerAppColor('TOK_BORDER', this.appScheme))
          .borderRadius(999);
        Row()
          .width(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH)
          .height(`${this.effectiveBrightnessPercent()}%`)
          .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme))
          .borderRadius(999);
      }
      .width(READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH)
      .height(READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT)
      .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
      .hitTestBehavior(HitTestMode.Block)
      .accessibilityText('阅读亮度')
      .gesture(
        GestureGroup(
          GestureMode.Exclusive,
          PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
            .onActionStart((): void => this.beginBrightnessDrag())
            .onActionUpdate((event: GestureEvent): void => this.updateBrightnessDrag(event.offsetY))
            .onActionEnd((event: GestureEvent): void => this.finishBrightnessDrag(event.offsetY))
            .onActionCancel((): void => this.cancelBrightnessDrag()),
          TapGesture({ fingers: 1, count: 1 })
            .onAction((event: GestureEvent): void => this.commitBrightnessTap(event)),
        ),
      );

      // AutoBrightnessHitArea 24×20: pill 20×20 居中 + A Inter Medium 13。
      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          Text('A')
            .width(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
            .height(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(13)
            .lineHeight(13)
            .fontColor(this.brightnessAutomatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_INK', this.appScheme))
            .textAlign(TextAlign.Center);
        }
        .width(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .height(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
        .backgroundColor(this.brightnessAutomatic ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme) : readerAppColor('TOK_READ_ELEVATED', this.appScheme))
        .border({ width: TOK_BORDER_W, color: this.brightnessAutomatic ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_LINE_STRONG', this.appScheme) })
        .borderRadius(999);
      }
      .width(READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH)
      .height(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
      .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
      // Preserve the authored palette while exposing the automatic/manual
      // state through the existing control opacity; no unapproved color is
      // introduced for the selected endpoint.
      .opacity(this.brightnessAutomatic ? 1 : 0.72)
      .accessibilityText(this.brightnessAutomatic ? '跟随系统亮度，已开启' : '跟随系统亮度')
      .onClick((): void => {
        this.brightnessDragging = false;
        this.brightnessPreviewPercent = -1;
        this.onBrightnessAuto();
      });
    }
    .width(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH)
    .height(READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius(999);
  }

  private clampBrightness(value: number): number {
    return Math.max(READER_CONTROL_BRIGHTNESS_MIN, Math.min(READER_CONTROL_BRIGHTNESS_MAX, value));
  }

  private effectiveBrightnessPercent(): number {
    return this.brightnessPreviewPercent >= 0 ? this.brightnessPreviewPercent :
      this.clampBrightness(this.brightnessPercent);
  }

  private beginBrightnessDrag(): void {
    this.brightnessDragStartPercent = this.effectiveBrightnessPercent();
    this.brightnessPreviewPercent = this.brightnessDragStartPercent;
    this.brightnessDragging = true;
    this.brightnessLastEmittedPercent = this.brightnessDragStartPercent;
  }

  private updateBrightnessDrag(offsetY: number): void {
    if (!Number.isFinite(offsetY)) {
      return;
    }
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    this.brightnessPreviewPercent = this.roundBrightness(
      this.brightnessDragStartPercent - offsetY / READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT * range,
    );
    // The window writer owns coalescing. Emit every changed sample, including
    // the final MOVE before a held pause; no UP-dependent trailing throttle.
    if (this.brightnessPreviewPercent !== this.brightnessLastEmittedPercent) {
      this.brightnessLastEmittedPercent = this.brightnessPreviewPercent;
      this.onBrightnessChange(this.brightnessPreviewPercent);
    }
  }

  private finishBrightnessDrag(offsetY: number): void {
    this.updateBrightnessDrag(offsetY);
    this.brightnessDragging = false;
    // Keep the optimistic rail until the latest native write is acknowledged.
    this.onBrightnessChange(this.effectiveBrightnessPercent());
    this.brightnessLastEmittedPercent = -1;
  }

  private onBrightnessConfirmed(): void {
    if (!this.brightnessDragging) this.brightnessPreviewPercent = -1;
  }

  private cancelBrightnessDrag(): void {
    if (!this.brightnessDragging) return;
    this.brightnessDragging = false;
    this.onBrightnessCancel();
    // Keep the current preview until the writer settles any already-issued
    // native call. onBrightnessConfirmed then projects that successful ACK.
    this.brightnessLastEmittedPercent = -1;
  }

  private commitBrightnessTap(event: GestureEvent): void {
    if (event.fingerList.length === 0) {
      return;
    }
    const localY = event.fingerList[0].localY;
    if (!Number.isFinite(localY)) {
      return;
    }
    const clampedY = Math.max(0, Math.min(READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT, localY));
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    const value = READER_CONTROL_BRIGHTNESS_MIN +
      (1 - clampedY / READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT) * range;
    this.onBrightnessChange(this.roundBrightness(value));
  }

  private roundBrightness(value: number): number {
    const stepped = Math.round(value / READER_CONTROL_BRIGHTNESS_STEP) * READER_CONTROL_BRIGHTNESS_STEP;
    return this.clampBrightness(stepped);
  }
  @Builder
  private moduleNavBar() {
    Row({ space: 4 }) {
      this.moduleButton('rc_list', '目录', 'directory');
      this.moduleButton('rc_headphones', '朗读', 'tts');
      this.moduleButton('rc_palette', '界面', 'appearance');
      this.moduleButton('rc_settings', '设置', 'settings');
    }
    .width('100%')
    .height(this.geo.moduleNavH)
    .padding({ left: 9, top: 9 })
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID_OPAQUE', this.appScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appScheme) })
    .borderRadius({
      topLeft: this.geo.moduleNavRadiusTop,
      topRight: this.geo.moduleNavRadiusTop,
      bottomLeft: TOK_RADIUS_LG,
      bottomRight: TOK_RADIUS_LG,
    });
  }

  @Builder
  private moduleButton(icon: string, label: string, module: string) {
    Column() {
      // IconCircle 42×42 (icon 24 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(`app.media.${this.moduleIcon(icon, module)}`))
          .width(24)
          .height(24);
      }
      .width(42)
      .height(42)
      .backgroundColor(this.isActiveModule(module) ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_ACTIVE_SOFT', this.appScheme))
      .borderRadius(999);

      // Make v17 imported Quick navigation: Noto Sans SC Bold 10, normal line height.
      Text(label)
        .width('100%')
        .height(15)
        .fontFamily('ReaderNotoSansSCUIBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(15)
        .fontColor(this.isActiveModule(module) ? readerAppColor('TOK_READ_PRIMARY', this.appScheme) : readerAppColor('TOK_READ_ICON', this.appScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .margin({ top: 5   });
    }
    .layoutWeight(1)
    .height(62)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(12)
    .enabled(module === 'directory' || module === 'tts' || module === 'appearance' || module === 'settings')
    .opacity(module === 'tts' && this.ttsState.status === 'unavailable' ? 0.72 : 1)
    .accessibilityText(label)
    .onClick((): void => this.activateModule(module));
  }

  private isActiveModule(module: string): boolean {
    const location = this.contentLocation();
    return location.level === 'secondary' && location.module === module;
  }

  private canStepChapter(delta: number): boolean {
    for (let position = 0; position < this.tocEntries.length; position += 1) {
      if (this.tocEntries[position].index === this.currentChapterIndex) {
        const target = position + delta;
        return target >= 0 && target < this.tocEntries.length;
      }
    }
    return false;
  }

  private moduleIcon(icon: string, module: string): string {
    if (module === 'directory' && this.isActiveModule(module)) return 'reader_directory_list_active';
    if (module === 'tts' && this.isActiveModule(module)) return 'reader_tts_nav_active';
    if (module === 'appearance' && this.isActiveModule(module)) return 'reader_appearance_nav_active';
    if (module === 'settings' && this.isActiveModule(module)) return 'reader_settings_nav_active';
    return icon;
  }
}
