import {
  type LocalReadingAnchor,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgressUpdate,
  type LocalReadingProgressState,
  type LocalReadingToc,
  type LocalReadingTocEntry,
} from './LocalReadingFlowGateway';
import {
  ReadingSessionFlowGateway,
  type ReadingContentSearchResult,
  type ReadingSessionSource,
} from './ReadingSessionFlowGateway';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import {
  contentMetricForChapter,
  validateContentMetricsAgainstToc,
  wholeBookAnchorForPercent,
  wholeBookProgressPercent,
} from './LocalReadingWholeBookProgress';
import { ReadingSurface, ReadingSurfacePageFragment } from './ReadingSurface';
import { ReaderControlPanel, type ReaderControlPage } from './ReaderControlPanel';
import {
  READER_CONTROL_BRIGHTNESS_MAX,
  READER_CONTROL_BRIGHTNESS_MIN,
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
} from './ReaderControlGeometry';
import {
  commitReaderAutoPageTurn,
  createReaderAutoPageState,
  endReaderAutoPageAtBookEnd,
  invalidateReaderAutoPageState,
  isReaderAutoPageTurnDue,
  pauseReaderAutoPage,
  resumeReaderAutoPage,
  setReaderAutoPageSpeed,
  startReaderAutoPage,
  stopReaderAutoPage,
  tickReaderAutoPage,
  type ReaderAutoPagePauseReason,
  type ReaderAutoPageState,
} from './ReaderAutoPageState';
import {
  createDefaultReaderAutoPageFullConfiguration,
  formatReaderAutoPageFullTimerSummary,
  normalizeReaderAutoPageFullConfiguration,
  readerAutoPageFullTimerDurationSeconds,
  setReaderAutoPageFullFollowHighlight,
  setReaderAutoPageFullSpeed,
  type ReaderAutoPageFullConfiguration,
} from './ReaderAutoPageFullState';
import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { ReaderReplaceQuickGateway } from './ReaderReplaceQuickGateway';
import {
  createHiddenReaderReplaceQuickState,
  replaceConfirmedReaderReplaceRule,
  type ReaderReplaceQuickState,
} from './ReaderReplaceQuickState';
import {
  ReadingSurfaceLayoutMap,
  type ReadingSurfaceLineMetric,
} from './ReadingSurfaceLayoutMap';
import {
  ReadingPaginationIndex,
  ReadingPaginationPrefix,
  createReadingPaginationLayoutSignature,
  type ReadingPaginationKey,
  type ReadingPaginationPrefixObservation,
} from './ReadingPaginationIndex';
import {
  ReadingChapterWindow,
  type ReadingSessionChapter,
  type ReadingSessionImage,
} from './ReadingChapterWindow';
import { registerReaderFonts } from '../common/ReaderFonts';
import { motionAnimateParam } from '../common/MotionSpec';
import { window } from '@kit.ArkUI';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderTtsGateway, type ReaderTtsChapterRef, type ReaderTtsConfig } from './ReaderTtsGateway';
import {
  ReaderHttpTtsGateway,
  type ReaderHttpTtsConfig,
} from './ReaderHttpTtsGateway';
import {
  ReaderTtsSessionCoordinator,
  type ReaderTtsChapterAdvanceInput,
  type ReaderTtsProgressCommit,
} from './ReaderTtsSessionCoordinator';
import {
  createReaderTtsState,
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
  type ReaderTtsState,
} from './ReaderTtsState';
import { ReaderAppearanceGateway } from './ReaderAppearanceGateway';
import {
  ReaderChineseConversionGateway,
  type ReaderChineseConversionMode,
} from './ReaderChineseConversionGateway';
import {
  createDefaultReaderAppearanceSnapshot,
  setReaderAppearanceAlignment,
  setReaderAppearanceDayTheme,
  setReaderAppearanceFont,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import {
  readerAppearanceFontFamily,
  readerAppearanceFontScale,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
} from './ReaderAppearanceRenderStyle';
import { ReaderSettingsGateway } from './ReaderSettingsGateway';
import { ReadingRecordGateway } from './ReadingRecordGateway';
import {
  createDefaultReaderSettingsSnapshot,
  setReaderSettingsToggle,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
} from './ReaderSettingsState';

type ReaderPageTurnResult = 'started' | 'busy' | 'bookEnd';

/**
 * The only progress datum emitted by the immersive reader. Its offset is a
 * Unicode-scalar index accepted by Reader Core, never an ArkUI UTF-16 index.
 */
export class ReadingCommit {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string | undefined;

  constructor(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    chapterOffset: number,
    chapterProgress: number,
    locationRevision: string | undefined,
  ) {
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
  }
}

/**
 * Chapter-level paragraph boundaries.  These remain deliberately tiny: a
 * long EPUB is indexed once, but no paragraph text, local map, or ArkUI
 * controller is retained until its current first-page batch is measured.
 */
class ParagraphRange {
  id: string;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;

  constructor(
    id: string,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
  ) {
    this.id = id;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
  }
}

/**
 * The only paragraph representation ever mounted in the hidden ArkUI tree.
 * It is discarded after the line metrics have been copied into first-page
 * fragments, keeping real long chapters bounded by the batch limits below.
 */
class MeasurementParagraph {
  id: string;
  rangeIndex: number;
  text: string;
  chapterStartScalar: number;
  layoutMap: ReadingSurfaceLayoutMap;
  controller: TextController;
  isParagraphStart: boolean;
  /** True only when this bounded text ends before its semantic paragraph. */
  isRangeTruncated: boolean;

  constructor(
    id: string,
    rangeIndex: number,
    text: string,
    chapterStartScalar: number,
    layoutMap: ReadingSurfaceLayoutMap,
    controller: TextController,
    isParagraphStart: boolean,
    isRangeTruncated: boolean,
  ) {
    this.id = id;
    this.rangeIndex = rangeIndex;
    this.text = text;
    this.chapterStartScalar = chapterStartScalar;
    this.layoutMap = layoutMap;
    this.controller = controller;
    this.isParagraphStart = isParagraphStart;
    this.isRangeTruncated = isRangeTruncated;
  }
}

class MeasuredReadingLine {
  lineIndex: number;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;
  height: number;

  constructor(
    lineIndex: number,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
    height: number,
  ) {
    this.lineIndex = lineIndex;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.height = height;
  }
}

class PhysicalReadingPage {
  fragments: ReadingSurfacePageFragment[];
  startScalar: number;
  endScalar: number;

  constructor(fragments: ReadingSurfacePageFragment[], startScalar: number, endScalar: number) {
    this.fragments = fragments;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
  }
}

class KnownReadingContentVersion {
  chapterIndex: number;
  contentVersion: string;

  constructor(chapterIndex: number, contentVersion: string) {
    this.chapterIndex = chapterIndex;
    this.contentVersion = contentVersion;
  }
}

class PreviousChapterMeasurement {
  originalChapterIndex: number;
  originalChapterOffset: number;
  targetChapterIndex: number;

  constructor(originalChapterIndex: number, originalChapterOffset: number, targetChapterIndex: number) {
    this.originalChapterIndex = originalChapterIndex;
    this.originalChapterOffset = originalChapterOffset;
    this.targetChapterIndex = targetChapterIndex;
  }
}

class CoreReadingAnchor implements LocalReadingAnchor {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
  }
}

class CoreReadingProgressUpdate implements LocalReadingProgressUpdate {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string | undefined;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number, locationRevision: string) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
  }
}

class CoreReadingLayout implements LocalReadingLayout {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight: number;

  constructor(
    viewportWidth: number,
    viewportHeight: number,
    fontScale: number,
    lineHeight: number,
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.fontScale = fontScale;
    this.lineHeight = lineHeight;
  }
}

class ArkUILineMetric implements ReadingSurfaceLineMetric {
  startIndex: number;
  endIndex: number;
  height: number;
  topHeight: number;
  width: number;
  baseline: number;

  constructor(
    metric: LineMetrics,
    heightVp: number,
    topHeightVp: number,
    widthVp: number,
    baselineVp: number,
  ) {
    this.startIndex = metric.startIndex;
    this.endIndex = metric.endIndex;
    this.height = heightVp;
    this.topHeight = topHeightVp;
    this.width = widthVp;
    this.baseline = baselineVp;
  }
}

type ReadingPhase = 'loading' | 'measuring' | 'ready' | 'failed';

const FIGMA_PHONE_WIDTH = 390;
const FIGMA_PHONE_HEIGHT = 844;
const FIGMA_TABLET_WIDTH = 760;
const FIGMA_TABLET_HEIGHT = 960;
const FIGMA_PHONE_TOP_INSET = 72;
const FIGMA_PHONE_BOTTOM_INSET = 47.99;
const FIGMA_TABLET_TOP_INSET = 92.44;
const FIGMA_TABLET_BOTTOM_INSET = 56.44;
const FIGMA_PHONE_HORIZONTAL_INSET = 32;
const FIGMA_TABLET_HORIZONTAL_INSET = 44.44;
const FIGMA_TITLE_LINE_HEIGHT = 28.75;
const FIGMA_TITLE_TO_BODY_SPACE = 18;
const FIGMA_BODY_FONT_WEIGHT = 'regular';
const READER_APPEARANCE_FONT_SIZE_STEP = 2;
const READER_APPEARANCE_LINE_HEIGHT_STEP = 0.08;
const READER_APPEARANCE_PARAGRAPH_SPACING_STEP = 2;
const READER_APPEARANCE_LETTER_SPACING_STEP = 0.5;
const READING_WRITING_MODE = 'horizontal-tb';
const LOCAL_READING_SOURCE_ID = 'local';
const UNICODE_PROBE = 'A😀B';
/** Engineering ceiling only; it has no visual meaning or design authority. */
const MAX_MEASUREMENT_BATCH_PARAGRAPHS = 8;
const MAX_MEASUREMENT_BATCH_UTF16 = 12 * 1024;
/** No source-approved loading state exists, so a missing layout must fail closed. */
const MEASUREMENT_LAYOUT_TIMEOUT_MS = 6000;
/**
 * The UTF-16 probe branch can transiently report zero lines while the hidden
 * Text settles, but a stably empty probe must not stall the measurement until
 * the 6s deadline. After this many consecutive zero-line observations within
 * one generation, fail closed with a specific reason instead of retrying.
 * The threshold is intentionally generous: the probe's own line settles within
 * the first didLayout after the hidden tree mounts, so a handful of unrelated
 * didLayouts during that window must not false-fail a normal layout.
 */
const UNICODE_PROBE_EMPTY_ATTEMPT_LIMIT = 5;
/**
 * The hidden-layout deadline stops at the first Core persistence boundary.
 * Keep a separate, non-visual upper bound for an initial page that still has
 * no visible body while its chapter read, location resolution, or first
 * progress write is pending. This is an engineering recovery guard, not a
 * Figma loading/error state.
 */
const FIRST_PAGE_READY_TIMEOUT_MS = 30000;
/** Persist real foreground reading time in bounded atomic deltas. */
const READING_RECORD_FLUSH_INTERVAL_MS = 30000;

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
  @StorageLink('readerAppForeground') @Watch('onAppForegroundChanged') appForeground: boolean = true;
  @Prop sourceId: string = LOCAL_READING_SOURCE_ID;
  @Prop bookId: string;
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop sourceSwitchTransactionId: string | undefined = undefined;
  @Prop @Watch('onRequestedChapterChanged') requestedChapterIndex: number | undefined = undefined;
  @Prop @Watch('onDeviceFormChanged') isTablet: boolean;
  @Prop reduceMotion: boolean = false;
  /**
   * The host owns the system Back event. It receives this guarded request
   * function and must invoke it instead of changing the route directly.
   * `onExit` below is then called only after the current anchor commit has
   * settled (or there was no materialized page to commit).
   */
  onExitRequestHandler: (requestExit: () => void) => void =
    (_requestExit: () => void): void => {};
  onExit: () => void = (): void => {};
  /**
   * The parent may expose the static Figma ReadingSurface only after this
   * first real page has been measured and written to Core.  This is a route
   * readiness signal, not a new visual loading/error state.
  */
  onReadingReady: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onReadingCommitted: (commit: ReadingCommit) => void = (_commit: ReadingCommit): void => {};
  onReadingFailure: (sourceId: string, bookId: string, message: string) => void =
    (_sourceId: string, _bookId: string, _message: string): void => {};
  /**
   * Reports a chapter only after its first physical page has been measured and
   * its Unicode-scalar anchor has been accepted by Core.  Full Directory may
   * use this as its selected-row state; it must never treat a merely loaded
   * chapter as safe to reveal on the ReadingSurface.
   */
  onChapterCommitted: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]) => void =
    (_entries: LocalReadingTocEntry[]): void => {};
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};

  @State private phase: ReadingPhase = 'loading';
  @State private chapterTitle: string = '';
  @State private showChapterTitle: boolean = false;
  @State private visibleFragments: ReadingSurfacePageFragment[] = [];
  @State private viewportWidth: number = 0;
  @State private viewportHeight: number = 0;
  /** Forces a fresh hidden measurement tree without recreating controllers in build. */
  @State private measurementEpoch: number = 0;
  /** Logged for diagnostics only; there is no Figma error surface to invent here. */
  @State private failureCode: string = '';
  @Prop bookTitle: string = '';
  @Prop sourceName: string = '';
  @Prop totalChapters: number = 0;
  @Prop directoryEntries: LocalReadingTocEntry[] = [];
  // ReaderFullDirectory owns the visible TopBar and full sheet while its
  // route is active. Keep the control state mounted for the collapse return,
  // but suppress its pixels and hit targets so the two layers never stack.
  @Prop @Watch('onControlObscuredChanged') controlObscured: boolean = false;
  @State private controlVisible: boolean = false;
  @State private controlPage: ReaderControlPage = 'home';
  @State private quickSearchQuery: string = '';
  @State private quickSearchState: ReaderQuickSearchState = { kind: 'idle' };
  @State private brightnessPercent: number = 100;
  @State private brightnessAutomatic: boolean = true;
  @State private autoPageState: ReaderAutoPageState = createReaderAutoPageState(8);
  @State private autoPageFullConfiguration: ReaderAutoPageFullConfiguration =
    createDefaultReaderAutoPageFullConfiguration();
  @State private autoPageSessionRemainingSeconds: number = 15 * 60;
  @State private replaceState: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  @State private appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @State private chineseConversionMode: ReaderChineseConversionMode = 'none';
  @State private readerSettingsSnapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @State private ttsState: ReaderTtsState = createReaderTtsState(false);
  @State private ttsTimerMinutes: number = 15;
  @State private ttsTimerSeconds: number = 0;
  @State private ttsFollowHighlight: boolean = true;
  @State private ttsAllowMixing: boolean = false;
  @State private ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @State private ttsEngine: string = 'system';
  @State private ttsHttpEngines: ReaderHttpTtsConfig[] = [];

  private sessionGateway: ReadingSessionFlowGateway | undefined = undefined;
  private readonly replaceGateway: ReaderReplaceQuickGateway =
    new ReaderReplaceQuickGateway(ReaderRuntimeOwner.current());
  private readonly appearanceGateway: ReaderAppearanceGateway =
    new ReaderAppearanceGateway(ReaderRuntimeOwner.current());
  private readonly chineseConversionGateway: ReaderChineseConversionGateway =
    new ReaderChineseConversionGateway(ReaderRuntimeOwner.current());
  private readonly readerSettingsGateway: ReaderSettingsGateway =
    new ReaderSettingsGateway(ReaderRuntimeOwner.current());
  private readonly readingRecordGateway: ReadingRecordGateway =
    new ReadingRecordGateway(ReaderRuntimeOwner.current());
  private ttsGateway: ReaderTtsGateway | undefined = undefined;
  private ttsHttpGateway: ReaderHttpTtsGateway | undefined = undefined;
  private ttsCoordinator: ReaderTtsSessionCoordinator | undefined = undefined;
  private ttsConfig: ReaderTtsConfig | undefined = undefined;
  private readonly unicodeProbeController: TextController = new TextController();
  private readonly paragraphRanges: ParagraphRange[] = [];
  private readonly measurementBatch: MeasurementParagraph[] = [];
  private readonly paginationIndex: ReadingPaginationIndex = new ReadingPaginationIndex();
  private readonly chapterWindow: ReadingChapterWindow = new ReadingChapterWindow();
  /** Unique Host-created display resources owned by this reader session. */
  private readonly readingImageResources: ReadingSessionImage[] = [];
  private readonly knownContentVersions: KnownReadingContentVersion[] = [];
  private chapterLayoutMap: ReadingSurfaceLayoutMap | undefined = undefined;
  private visiblePage: PhysicalReadingPage | undefined = undefined;
  private paginationDraft: ReadingPaginationPrefix | undefined = undefined;
  private measurementRequestedAnchorScalar: number = -1;
  private materializedContentVersion: string = '';
  private brightnessRequestGeneration: number = 0;
  private autoPageTimer: number = -1;
  private autoPageDeadlineMs: number = 0;
  private autoPageTimerGeneration: number = -1;
  private autoPageSessionTimer: number = -1;
  private autoPageSessionDeadlineMs: number = 0;
  private autoPageSessionTimerGeneration: number = -1;
  private pendingPageFragments: ReadingSurfacePageFragment[] = [];
  private pendingPageStartScalar: number = -1;
  private pendingPageEndScalar: number = -1;
  private pendingPageHeight: number = 0;
  private nextRangeIndex: number = 0;
  private firstRangeStartScalar: number = 0;
  private batchProcessing: boolean = false;
  private measurementDeadlineTimer: number = -1;
  /** Bounds a first entry that has no previously committed visible body. */
  private firstPageReadyDeadlineTimer: number = -1;
  /** Makes a cleared first-page deadline unable to fail a later selection. */
  private firstPageReadyDeadlineGeneration: number = 0;
  private chapter: ReadingSessionChapter | undefined = undefined;
  /** Cold cross-chapter previous-page measurement; the old visible page stays mounted. */
  private previousChapterMeasurement: PreviousChapterMeasurement | undefined = undefined;
  private restoredProgress: LocalReadingProgressState | undefined = undefined;
  @State private tocEntries: LocalReadingTocEntry[] = [];
  @State private contentMetrics: LocalReadingContentMetrics | undefined = undefined;
  private desiredChapterOffset: number = 0;
  private desiredChapterProgress: number = 0;
  private measurementGeneration: number = 0;
  /** Covers pagination, resolveLocation, and the initial progress write. */
  private measurementCompleting: boolean = false;
  /** A real Area change arrived while the preceding Core write was in flight. */
  private remeasurePending: boolean = false;
  /** Invalidates an old-style page that completed while a newer appearance reflow was queued. */
  private appearanceReflowInvalidateCurrentLayout: boolean = false;
  private commitInFlight: boolean = false;
  private unicodeProbeVerifiedGeneration: number = -1;
  /** Consecutive zero-line probe observations within the current generation. */
  private unicodeProbeEmptyAttempts: number = 0;
  private didLayoutListener: (() => void) | undefined = undefined;
  /** Invalidates every continuation captured by a prior mounted instance. */
  private lifecycleToken: number = 0;
  /** Bumped per directory chapter selection so stale loads cannot win. */
  private chapterSelectionToken: number = 0;
  private searchGeneration: number = 0;
  /** Owns only Quick Replace panel loading/visibility continuations. */
  private replacePanelGeneration: number = 0;
  /** Owns a Core mutation independently from panel open/close generations. */
  private replaceMutationGeneration: number = 0;
  private replaceMutationActiveGeneration: number = -1;
  private replaceMutationActiveLifecycleToken: number = -1;
  private replaceMutationActiveBookId: string = '';
  private replaceMutationActiveRuleId: number = -1;
  /** Prevents a late startup load from replacing a newer in-session choice. */
  private appearanceMutationGeneration: number = 0;
  /** Prevents a late Settings load from replacing a newer in-session choice. */
  private readerSettingsMutationGeneration: number = 0;
  /** The selection token that owns `chapter` and its layout map. */
  private materializedChapterSelectionToken: number = -1;
  /** The selection token that owns the currently mounted hidden measurement tree. */
  private measurementSelectionToken: number = -1;
  /** The selection token that owns the visible physical page. */
  private visiblePageSelectionToken: number = -1;
  private mounted: boolean = false;
  private exitRequested: boolean = false;
  private exitDelivered: boolean = false;
  private readingRecordActiveSinceMs: number = 0;
  private readingRecordPendingMillis: number = 0;
  private readingRecordTimer: number = -1;
  private readingRecordFlushTail: Promise<void> = Promise.resolve();
  private chineseConversionMutationGeneration: number = 0;

  aboutToAppear(): void {
    this.lifecycleToken += 1;
    const lifecycleToken = this.lifecycleToken;
    this.mounted = true;
    this.exitRequested = false;
    this.exitDelivered = false;
    this.readingRecordActiveSinceMs = 0;
    this.readingRecordPendingMillis = 0;
    this.clearReadingRecordTimer();
    this.commitInFlight = false;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.autoPageState = createReaderAutoPageState(this.autoPageState.speedSeconds);
    this.autoPageFullConfiguration = setReaderAutoPageFullSpeed(
      this.autoPageFullConfiguration,
      this.autoPageState.speedSeconds,
    );
    this.resetAutoPageSessionDuration();
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.sessionGateway = new ReadingSessionFlowGateway(
      this.sourceId,
      this.bookId,
      this.readingSessionSource(),
      ReaderRuntimeOwner.current(),
      this.sourceSwitchTransactionId,
    );
    this.initializeTtsSession(lifecycleToken);
    void this.loadAppearanceSnapshot(lifecycleToken);
    void this.loadChineseConversionMode(lifecycleToken);
    void this.loadReaderSettingsSnapshot(lifecycleToken);
    registerReaderFonts(this.getUIContext().getFont());
    this.didLayoutListener = (): void => this.captureMeasurementAfterLayout();
    this.getUIContext().getUIObserver().on('didLayout', this.didLayoutListener);
    this.onExitRequestHandler((): void => this.requestExit());
    // The Detail/Directory parent keeps this first entry visually hidden until
    // `onReadingReady`, but its body work must still be bounded so a failed
    // chapter read or first Core commit cannot leave the reader session alive
    // forever with no recoverable path back.
    this.armFirstPageReadyDeadline(lifecycleToken, this.chapterSelectionToken);
    void this.loadInitialChapter(lifecycleToken);
  }

  aboutToDisappear(): void {
    // Do not begin a second, fire-and-forget write after the host has already
    // unmounted us. Normal exit is serialized through requestExit() instead.
    this.mounted = false;
    this.lifecycleToken += 1;
    this.searchGeneration += 1;
    this.replacePanelGeneration += 1;
    this.appearanceReflowInvalidateCurrentLayout = false;
    this.invalidateReplaceMutationOwner();
    this.brightnessRequestGeneration += 1;
    this.autoPageState = invalidateReaderAutoPageState(this.autoPageState);
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.clearReadingRecordTimer();
    this.readingRecordActiveSinceMs = 0;
    this.readingRecordPendingMillis = 0;
    const ttsCoordinator = this.ttsCoordinator;
    this.ttsCoordinator = undefined;
    this.ttsGateway = undefined;
    this.ttsHttpGateway = undefined;
    this.previousChapterMeasurement = undefined;
    this.releaseAllReadingImages();
    this.chapterWindow.clear();
    this.sessionGateway = undefined;
    if (ttsCoordinator !== undefined) void ttsCoordinator.dispose();
    this.resetPaginationDraft();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    if (this.didLayoutListener !== undefined) {
      this.getUIContext().getUIObserver().off('didLayout', this.didLayoutListener);
      this.didLayoutListener = undefined;
    }
    // Clear the host-held closure so an old reader instance cannot be asked
    // to exit after it has been removed from the route.
    this.onExitRequestHandler((): void => {});
  }

  private readingSessionSource(): ReadingSessionSource {
    if (this.sourceId === LOCAL_READING_SOURCE_ID) {
      if (this.remoteSession !== undefined) {
        throw new Error('local reading session must not carry remote acquisition state');
      }
      return { kind: 'local' };
    }
    if (this.remoteSession === undefined) {
      throw new Error('remote reading session is required for a non-local source');
    }
    return { kind: 'remote', session: this.remoteSession };
  }

  private activeGateway(): ReadingSessionFlowGateway {
    if (this.sessionGateway === undefined) {
      throw new Error('reading session gateway is not initialized');
    }
    return this.sessionGateway;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The Figma-derived PaperLayer is intentionally present for every
      // lifecycle phase. There is no source-approved loading/error state to
      // invent, but an empty Stack must never become a white reading page.
      ReadingSurface({
        chapterTitle: this.chapterTitle,
        showChapterTitle: this.showChapterTitle,
        // On a real viewport reflow keep the previously committed page
        // visible until its replacement has been measured and stored.  The
        // initial entry is held behind Detail by Index, so this never invents
        // a Figma loading screen or exposes a title-only paper surface.
        pageFragments: this.visibleFragments,
        isTablet: this.isTablet,
        appearance: this.appearanceSnapshot,
        ttsHighlightStart: this.ttsFollowHighlight ? this.ttsState.charStart : undefined,
        ttsHighlightEnd: this.ttsFollowHighlight ? this.ttsState.charEnd : undefined,
      });
      if (this.phase === 'measuring' && this.measurementEpoch > 0) {
        this.hiddenMeasurementTree();
      }
      // Reader Control (RC-READER-CONTROL-01): tapping the center vertical band
      // raises the control layer, which overlays the reading surface.
      // 面板常驻挂载(过渡在面板内部按 visible 门控), 保证 show/hide 非对称转场能触发。
      ReaderControlPanel({
        bookTitle: this.bookTitle,
        chapterTitle: this.chapterTitle,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        progressPercent: this.controlProgress(),
        totalChapters: this.totalChapters,
        isTablet: this.isTablet,
        visible: this.controlVisible && !this.controlObscured,
        activePage: this.controlPage,
        tocEntries: this.controlDirectoryEntries(),
        currentChapterIndex: this.currentChapterIndex(),
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        chapterDownloadEnabled: this.remoteSession !== undefined,
        searchQuery: this.quickSearchQuery,
        searchState: this.quickSearchState,
        brightnessPercent: this.brightnessPercent,
        brightnessAutomatic: this.brightnessAutomatic,
        autoPageStatus: this.autoPageState.status,
        autoPageSpeedSeconds: this.autoPageState.speedSeconds,
        autoPageTimerMinutes: this.autoPageFullConfiguration.timerMinutes,
        autoPageTimerSeconds: this.autoPageFullConfiguration.timerSeconds,
        autoPageTimerSummaryText: formatReaderAutoPageFullTimerSummary(this.autoPageFullConfiguration),
        autoPageFollowHighlight: this.autoPageFullConfiguration.followHighlight,
        replaceState: this.replaceState,
        appearanceSnapshot: this.appearanceSnapshot,
        chineseConversionMode: this.chineseConversionMode,
        settingsSnapshot: this.readerSettingsSnapshot,
        ttsState: this.ttsState,
        ttsTimerMinutes: this.ttsTimerMinutes,
        ttsTimerSeconds: this.ttsTimerSeconds,
        ttsFollowHighlight: this.ttsFollowHighlight,
        ttsAllowMixing: this.ttsAllowMixing,
        ttsFailurePolicy: this.ttsFailurePolicy,
        ttsEngine: this.ttsEngine,
        ttsHttpEngines: this.ttsHttpEngines,
        reduceMotion: this.reduceMotion,
        onBack: (): void => {
          this.hideControl();
          this.beginExit();
        },
        onDismiss: (): void => this.hideControl(),
        onSourceSwitch: (): void => {
          this.hideControl();
          this.onSwitchSource();
        },
        // Generic future entry: no product capability is admitted here yet.
        onMore: (): void => {},
        onPageChange: (page: ReaderControlPage): void => this.setControlPage(page),
        onModuleSelect: (_module: string): void => {},
        onSelectChapter: (chapterIndex: number): void => this.selectControlChapter(chapterIndex),
        onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
        onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          this.onCreateChapterStartBookmark(request),
        onPreviousChapter: (): void => this.stepControlChapter(-1),
        onNextChapter: (): void => this.stepControlChapter(1),
        onProgressChange: (percent: number): void => this.seekControlProgress(percent),
        onBrightnessChange: (percent: number): void => this.setReaderBrightness(percent),
        onBrightnessAuto: (): void => this.setReaderAutomaticBrightness(),
        onExpandDirectory: (): void => this.onOpenDirectory(),
        onSearchQueryChange: (query: string): void => this.updateQuickSearchQuery(query),
        onSearch: (): void => this.runQuickSearch(),
        onSearchResultSelect: (result: ReadingContentSearchResult): void => this.selectSearchResult(result),
        onAutoPageToggle: (): void => this.toggleAutoPage(),
        onAutoPageStop: (): void => this.stopAutoPage(),
        onAutoPageSlowDown: (): void => this.changeAutoPageSpeed(2),
        onAutoPageSpeedUp: (): void => this.changeAutoPageSpeed(-2),
        onAutoPageFullTimerChange: (minutes: number, seconds: number): void =>
          this.changeAutoPageSessionTimer(minutes, seconds),
        onAutoPageFullSpeedChange: (seconds: number): void => this.setAutoPageSpeed(seconds),
        onAutoPageFollowHighlightChange: (enabled: boolean): void =>
          this.setAutoPageFollowHighlight(enabled),
        onOpenReplace: (): void => this.openQuickReplace(),
        onOpenRulesManagement: (): void => this.openRulesManagement(),
        onToggleReplaceRule: (ruleId: number, isEnabled: boolean): void =>
          this.toggleQuickReplaceRule(ruleId, isEnabled),
        onAppearanceThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceTheme(theme),
        onAppearanceDayThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceDayTheme(theme),
        onAppearanceNightThemeChange: (theme: ReaderAppearanceTheme): void =>
          this.changeAppearanceNightTheme(theme),
        onAppearanceFontChange: (font: ReaderAppearanceFont): void => this.changeAppearanceFont(font),
        onAppearanceIndentRequest: (indent: ReaderAppearanceIndent): void =>
          this.changeAppearanceIndent(indent),
        onAppearanceAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
          this.toggleAppearanceAlignment(current),
        onAppearanceMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
          this.stepAppearanceMetric(metric, direction),
        onChineseConversionChange: (mode: ReaderChineseConversionMode): void =>
          this.changeChineseConversionMode(mode),
        onSettingsToggleChange: (key: ReaderSettingsToggleKey, value: boolean): void =>
          this.changeReaderSetting(key, value),
        onTtsToggle: (): void => this.toggleTts(),
        onTtsStop: (): void => this.stopTts(),
        onTtsPrevious: (): void => this.previousTtsUtterance(),
        onTtsNext: (): void => this.nextTtsUtterance(),
        onTtsSeek: (sliceIndex: number): void => this.seekTtsUtterance(sliceIndex),
        onTtsRateChange: (rate: number): void => this.changeTtsRate(rate),
        onTtsTimerChange: (minutes: number, seconds: number): void => this.changeTtsTimer(minutes, seconds),
        onTtsFollowHighlightChange: (enabled: boolean): void => {
          this.ttsFollowHighlight = enabled;
        },
        onTtsAllowMixingChange: (enabled: boolean): void => this.changeTtsAllowMixing(enabled),
        onTtsFailurePolicyChange: (policy: 'skip' | 'stop'): void => this.changeTtsFailurePolicy(policy),
        onTtsEngineChange: (engine: string): Promise<void> => this.changeTtsEngine(engine),
        onTtsHttpEnginePut: (config: ReaderHttpTtsConfig): Promise<void> => this.saveHttpTtsEngine(config),
        onTtsHttpEngineDelete: (id: number): Promise<void> => this.deleteHttpTtsEngine(id),
      });
      if (!this.controlVisible) {
        // Figma reader.page.turn.none: left/right bands request the adjacent
        // real page while the center band retains Reader Control entry. The
        // page swap itself has no animation and occurs only after Core stores
        // the new scalar anchor.
        Row() {
          Row()
            .width('33%')
            .height('100%')
            .backgroundColor('#00000000')
            .accessibilityText('上一页')
            .onClick((): void => {
              this.pauseAutoPageForInteraction();
              this.turnPreviousPage();
            });
          Row()
            .width('34%')
            .height('100%')
            .backgroundColor('#00000000')
            .accessibilityText('打开阅读控制')
            .onClick((): void => {
              this.pauseAutoPageForInteraction();
              this.controlPage = 'home';
              this.controlVisible = true;
              this.refreshReaderBrightness();
            });
          Row()
            .width('33%')
            .height('100%')
            .backgroundColor('#00000000')
            .accessibilityText('下一页')
            .onClick((): void => {
              this.pauseAutoPageForInteraction();
              this.turnNextPage();
            });
        }
        .width('100%')
        .height('100%');
      }
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const lifecycleToken = this.lifecycleToken;
      if (!this.isSessionActive(lifecycleToken)) {
        return;
      }
      const width = this.numericAreaLength(newValue.width);
      const height = this.numericAreaLength(newValue.height);
      if (width <= 0 || height <= 0 ||
        (Math.abs(width - this.viewportWidth) < 0.01 && Math.abs(height - this.viewportHeight) < 0.01)) {
        return;
      }
      const previousLayoutSignature = this.hasMeasuredViewport() ? this.paginationLayoutSignature() : undefined;
      this.viewportWidth = width;
      this.viewportHeight = height;
      if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.paginationLayoutSignature()) {
        // A reflow invalidates both the continuous draft and every complete
        // manifest measured under the predecessor geometry. The new signature
        // can never accidentally address those physical page boundaries.
        this.paginationIndex.invalidateLayout(
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
    });
  }

  @Builder
  private hiddenMeasurementTree() {
    // Opacity keeps the actual Text nodes in the layout pass. `Visibility.None`
    // would make TextController's LayoutManager unavailable and a timer would
    // race layout; UIObserver.didLayout below is therefore the only read point.
    Column() {
      Text(UNICODE_PROBE, { controller: this.unicodeProbeController })
        .width(this.measurementTextWidth())
        .fontFamily(readerAppearanceFontFamily(this.appearanceSnapshot.font))
        .fontWeight(FontWeight.Regular)
        .fontSize(this.appearanceSnapshot.fontSize)
        .lineHeight(readerAppearanceLineHeight(this.appearanceSnapshot))
        .letterSpacing(this.appearanceSnapshot.letterSpacing)
        .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink)
        .textAlign(readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ?
          TextAlign.JUSTIFY : TextAlign.Start);

      ForEach(this.measurementBatch, (paragraph: MeasurementParagraph) => {
        Text(this.measurementNodeText(paragraph), { controller: paragraph.controller })
          .width(this.measurementTextWidth())
          .fontFamily(readerAppearanceFontFamily(this.appearanceSnapshot.font))
          .fontWeight(FontWeight.Regular)
          .fontSize(this.appearanceSnapshot.fontSize)
          .lineHeight(readerAppearanceLineHeight(this.appearanceSnapshot))
          .letterSpacing(this.appearanceSnapshot.letterSpacing)
          .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink)
          .textAlign(readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ?
            TextAlign.JUSTIFY : TextAlign.Start)
          .textIndent(paragraph.isParagraphStart ?
            readerAppearanceParagraphIndent(this.appearanceSnapshot.fontSize, this.appearanceSnapshot.indent) : 0);
      }, (paragraph: MeasurementParagraph): string => `${this.measurementEpoch}:${paragraph.id}`);
    }
    .width(this.measurementTextWidth())
    .opacity(0)
    .position({ x: this.horizontalInset(), y: this.topInset() });
  }

  private async loadInitialChapter(lifecycleToken: number): Promise<void> {
    // The initial restore is also a chapter-selection transaction. A manual
    // choice made while these two Core reads are pending must win completely:
    // neither an old progress row nor an old error may mutate/fail the newer
    // selection.
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
    try {
      const initialLoad = await Promise.all([
        this.activeGateway().loadToc(this.bookId, isCurrent),
        this.activeGateway().loadProgress(this.bookId, isCurrent),
        this.activeGateway().loadContentMetrics(this.bookId, isCurrent),
      ]);
      if (!isCurrent()) {
        return;
      }
      const toc = initialLoad[0];
      const progress = initialLoad[1];
      const contentMetrics = initialLoad[2];
      if (contentMetrics !== undefined) {
        validateContentMetricsAgainstToc(contentMetrics, toc.entries);
      }
      this.tocEntries = toc.entries;
      this.chapterWindow.configure(
        this.sourceId,
        this.bookId,
        toc.entries.map((entry: LocalReadingTocEntry): number => entry.index),
      );
      this.contentMetrics = contentMetrics;
      const requested = this.normalizedRequestedChapter();
      const restored = progress.kind === 'restored' ? progress.progress : undefined;
      const target = requested === undefined ? restored?.chapterIndex : requested;
      const chapterIndex = this.requireKnownChapter(target);
      this.restoredProgress = progress;
      await this.openChapter(chapterIndex, true, lifecycleToken, selectionToken);
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
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
    if (this.chapter !== undefined && this.chapter.chapterIndex === requested) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    // Bump the selection token so a slower, earlier chapter load can never
    // overwrite a later selection when several rows are tapped in a row.
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
    // A manual directory selection is not a restore; start the chapter at its
    // natural first scalar.
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(requested, false, lifecycleToken, selectionToken);
  }

  private onDeviceFormChanged(): void {
    if (!this.mounted) {
      return;
    }
    // The watcher runs after the form prop changed, so the predecessor form's
    // exact signature is no longer reconstructible. Drop this book's local
    // manifests and let the real Area callback establish the new geometry.
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
    this.resetPaginationDraft();
    if (this.hasCurrentMaterializedChapter() && this.phase !== 'failed') {
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
  private resetForChapterSelection(): void {
    this.previousChapterMeasurement = undefined;
    this.measurementGeneration += 1;
    this.measurementSelectionToken = -1;
    this.materializedChapterSelectionToken = -1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.measurementBatch.length = 0;
    this.paragraphRanges.length = 0;
    this.resetPendingPage();
    this.nextRangeIndex = 0;
    this.firstRangeStartScalar = 0;
    this.chapter = undefined;
    this.chapterLayoutMap = undefined;
    this.materializedContentVersion = '';
    this.desiredChapterOffset = 0;
    this.desiredChapterProgress = 0;
    this.resetPaginationDraft();
    // Full Directory is not an opaque loading shell. Keep the previously
    // committed title/body snapshot behind it until the new chapter has a
    // committed physical page. Its old selection token no longer authorizes
    // any Core write because `chapterSelectionToken` has already advanced.
    this.measurementEpoch += 1;
    this.phase = 'loading';
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
  }

  private async openChapter(
    chapterIndex: number,
    isInitial: boolean,
    lifecycleToken: number,
    selectionToken: number,
    requestedOffset?: number,
    requestedProgress?: number,
  ): Promise<void> {
    try {
      if (!isInitial && this.tocEntries.length > 0) {
        this.requireKnownChapter(chapterIndex);
      }
      const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
      const chapter = await this.loadSessionChapter(chapterIndex, isCurrent);
      if (!isCurrent()) {
        return;
      }
      if (!await this.ensureCurrentContentMetrics(chapter, isCurrent)) {
        return;
      }
      this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
      this.chapterWindow.setCurrent(chapter);
      this.retainCurrentChapterWindow();
      this.chapter = chapter;
      this.materializedChapterSelectionToken = selectionToken;
      this.configureRestoredAnchor(chapter, isInitial, requestedOffset, requestedProgress);
      // Never lay out against the Phone/Tablet fallback constants. If Area
      // has already arrived, start once now; otherwise the first real Area
      // callback below owns the initial measurement generation.
      if (this.hasMeasuredViewport()) {
        this.beginMeasurement(lifecycleToken);
      }
    } catch (error) {
      // A stale selection (or unmounted session) must not fail the current
      // reading flow; only a current request's error is surfaced.
      if (!this.isSelectionActive(lifecycleToken, selectionToken)) {
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
  }

  private async loadSessionChapter(
    chapterIndex: number,
    isCurrent: () => boolean,
  ): Promise<ReadingSessionChapter> {
    const cached = this.chapterWindow.get(chapterIndex);
    if (cached !== undefined) {
      return cached;
    }
    return this.activeGateway().loadChapter(this.bookId, chapterIndex, isCurrent);
  }

  /**
   * Loads only the two TOC neighbours into the active session window.
   * Failures are non-fatal because the visible current chapter is already
   * committed; an explicit turn retries through the same guarded loader.
   */
  private prefetchAdjacentChapters(
    current: ReadingSessionChapter,
    lifecycleToken: number,
    selectionToken: number,
  ): void {
    const targets: number[] = [];
    const previous = this.adjacentChapterIndex(current.chapterIndex, -1);
    const next = this.adjacentChapterIndex(current.chapterIndex, 1);
    if (previous !== undefined && this.chapterWindow.get(previous) === undefined) {
      targets.push(previous);
    }
    if (next !== undefined && this.chapterWindow.get(next) === undefined) {
      targets.push(next);
    }
    for (const target of targets) {
      const isCurrent = (): boolean => this.isVisiblePageCurrent(
        this.visiblePage as PhysicalReadingPage,
        current,
        selectionToken,
        lifecycleToken,
      );
      void this.activeGateway().loadChapter(this.bookId, target, isCurrent)
        .then((chapter: ReadingSessionChapter): void => {
          if (!isCurrent()) {
            return;
          }
          this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
          this.chapterWindow.admitNeighbour(chapter);
          this.retainCurrentChapterWindow();
        })
        .catch((_error: Error): void => {
          // The explicit previous/next request remains the retry boundary.
        });
    }
  }

  /**
   * The metrics command and the chapter command are intentionally separate,
   * backward-compatible protocol reads. If an edit or replace rule changed
   * the processed text between them, refresh the Core-owned aggregate once
   * and fail closed unless the active chapter's scalar count now agrees.
   */
  private async ensureCurrentContentMetrics(
    chapter: ReadingSessionChapter,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    const scalarCount = new ReadingSurfaceLayoutMap(chapter.content).scalarCount();
    if (!this.activeGateway().supportsExactContentMetrics()) {
      return true;
    }
    let metrics = this.contentMetrics;
    let metric = metrics === undefined ? undefined :
      contentMetricForChapter(metrics, chapter.chapterIndex);
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
    metric = contentMetricForChapter(metrics, chapter.chapterIndex);
    if (metric === undefined || metric.scalarLength !== scalarCount) {
      throw new Error('READING_CONTENT_METRICS_STALE');
    }
    this.contentMetrics = metrics;
    return true;
  }

  private configureRestoredAnchor(
    chapter: ReadingSessionChapter,
    isInitial: boolean,
    requestedOffset?: number,
    requestedProgress?: number,
  ): void {
    const chapterMap = new ReadingSurfaceLayoutMap(chapter.content);
    if (chapterMap.scalarCount() === 0) {
      throw new Error('READING_CONTENT_EMPTY');
    }
    this.chapterLayoutMap = chapterMap;
    this.materializedContentVersion = chapter.contentVersion;
    if (requestedOffset !== undefined) {
      const scalarCount = chapterMap.scalarCount();
      const lastVisible = this.lastVisibleScalar(chapter.content, chapterMap);
      this.desiredChapterOffset = Math.max(0, Math.min(lastVisible, requestedOffset));
      this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
      return;
    }
    if (requestedProgress !== undefined) {
      const scalarCount = chapterMap.scalarCount();
      const lastVisible = this.lastVisibleScalar(chapter.content, chapterMap);
      this.desiredChapterOffset = Math.max(0, Math.min(
        lastVisible,
        Math.round(this.normalizedProgress(requestedProgress) * scalarCount),
      ));
      this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
      return;
    }
    const restored = isInitial && this.restoredProgress?.kind === 'restored' &&
      this.restoredProgress.progress.chapterIndex === chapter.chapterIndex ? this.restoredProgress.progress : undefined;
    if (restored === undefined) {
      this.desiredChapterOffset = 0;
      this.desiredChapterProgress = 0;
      return;
    }
    const scalarCount = chapterMap.scalarCount();
    const offset = restored.chapterOffset <= scalarCount ? restored.chapterOffset :
      Math.round(restored.chapterProgress * scalarCount);
    // Normalize the restored anchor to a visible glyph now, not only when
    // beginMeasurement clamps it. A chapter ending in blank lines makes
    // scalarCount - 1 point at invisible CR/LF/space, so a stale EOF anchor
    // must not wait for the later pagination pass to be pulled back to real
    // content.
    const lastVisible = this.lastVisibleScalar(chapter.content, chapterMap);
    this.desiredChapterOffset = Math.max(0, Math.min(lastVisible, offset));
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
  }

  /**
   * Last non-whitespace scalar of the chapter content. Used to pull a stale
   * EOF/blank-line restore anchor back to a visible glyph; the paragraph-range
   * clamp inside beginMeasurement applies the same upper bound later.
   */
  private lastVisibleScalar(content: string, map: ReadingSurfaceLayoutMap): number {
    const scalarCount = map.scalarCount();
    for (let scalar = scalarCount - 1; scalar >= 0; scalar -= 1) {
      const startUtf16 = map.utf16ForScalar(scalar);
      const endUtf16 = map.utf16ForScalar(scalar + 1);
      if (content.substring(startUtf16, endUtf16).trim().length > 0) {
        return scalar;
      }
    }
    return 0;
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
    const chapter = this.chapter;
    const selectionToken = this.materializedChapterSelectionToken;
    if (chapter === undefined || !this.isSelectionCurrent(selectionToken)) {
      return;
    }
    try {
      this.measurementBatch.length = 0;
      if (this.paragraphRanges.length === 0) {
        this.collectParagraphRanges(chapter.content);
      }
      if (this.paragraphRanges.length === 0) {
        throw new Error('READING_CONTENT_EMPTY');
      }
      const map = this.requireChapterLayoutMap();
      const scalarCount = map.scalarCount();
      // A Core offset at EOF is legal storage data but cannot materialize a
      // visible glyph.  Clamp only the presentation anchor to the final
      // scalar; the next successful commit normalizes Core to that real page
      // start rather than leaving a permanently empty reader surface.
      const firstRange = this.paragraphRanges[0];
      const firstRenderableScalar = firstRange.startScalar;
      // An EOF anchor may point at trailing CR/LF/space content that produces
      // no visible line once the ReadingSurface removes terminal delimiters.
      // Normalize only that upper bound to the last scalar belonging to a
      // measurable paragraph; Core's unmodified chapter text is never edited.
      const lastRenderableScalar = this.lastMeasurableScalar();
      this.desiredChapterOffset = Math.max(firstRenderableScalar, Math.min(
        lastRenderableScalar,
        this.desiredChapterOffset,
      ));
      this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
      this.measurementRequestedAnchorScalar = this.desiredChapterOffset;
      this.nextRangeIndex = this.rangeIndexForOffset(this.desiredChapterOffset);
      this.firstRangeStartScalar = this.desiredChapterOffset;
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
      this.measurementGeneration += 1;
      this.unicodeProbeEmptyAttempts = 0;
      this.measurementSelectionToken = selectionToken;
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.phase = 'measuring';
      if (!this.prepareNextMeasurementBatch()) {
        throw new Error('PAGINATION_NO_MEASUREMENT_BATCH');
      }
      // Controllers are intentionally recreated only for the bounded batch.
      // Bumping the epoch unmounts any predecessor before this new batch
      // becomes the sole hidden layout tree.
      this.measurementEpoch += 1;
      this.armMeasurementDeadline(this.measurementGeneration, selectionToken, lifecycleToken);
    } catch (error) {
      this.fail(error as Error, lifecycleToken);
    }
  }

  private captureMeasurementAfterLayout(): void {
    const lifecycleToken = this.lifecycleToken;
    const generation = this.measurementGeneration;
    const selectionToken = this.measurementSelectionToken;
    if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) ||
      this.measurementCompleting || this.batchProcessing) {
      return;
    }
    if (!this.hasValidUnicodeProbe(lifecycleToken) || !this.allBatchParagraphsHaveLayout()) {
      return;
    }
    this.batchProcessing = true;
    this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
  }

  private consumeMeasuredBatch(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        return;
      }
      for (let batchIndex = 0; batchIndex < this.measurementBatch.length; batchIndex += 1) {
        const paragraph = this.measurementBatch[batchIndex];
        const bodyImage = this.readingImageForParagraph(paragraph);
        if (bodyImage !== undefined) {
          if (bodyImage.state === 'pending') {
            // Completed paragraphs already live in pendingPageFragments. Keep
            // only this image and the unconsumed suffix so the async resume
            // cannot duplicate earlier layout observations.
            if (batchIndex > 0) {
              this.measurementBatch.splice(0, batchIndex);
            }
            this.resolvePendingReadingImage(
              bodyImage,
              generation,
              selectionToken,
              lifecycleToken,
            );
            return;
          }
          let lineCapacity = this.pendingPageBodyCapacity();
          if (!Number.isFinite(lineCapacity) || lineCapacity <= 0) {
            throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
          }
          const paragraphSpace = this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          let imageHeight = bodyImage.state === 'ready' ?
            this.scaledReadingImageHeight(bodyImage, lineCapacity) :
            readerAppearanceLineHeight(this.appearanceSnapshot);
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + imageHeight > lineCapacity) {
            if (this.previousChapterMeasurement === undefined) {
              this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
              return;
            }
            this.recordPendingPreviousChapterPage();
            lineCapacity = this.pendingPageBodyCapacity();
            imageHeight = bodyImage.state === 'ready' ?
              this.scaledReadingImageHeight(bodyImage, lineCapacity) :
              readerAppearanceLineHeight(this.appearanceSnapshot);
          }
          const admittedParagraphSpace = this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length === 0) {
            this.pendingPageStartScalar = bodyImage.startScalar;
          }
          this.pendingPageHeight += admittedParagraphSpace + imageHeight;
          this.pendingPageEndScalar = bodyImage.endScalar;
          this.pendingPageFragments.push(new ReadingSurfacePageFragment(
            `chapter-${this.requireChapter().chapterIndex}:image:${bodyImage.startScalar}-${bodyImage.endScalar}`,
            '',
            true,
            bodyImage.startScalar,
            bodyImage.endScalar,
            bodyImage.state === 'ready' ? bodyImage.pixelMap : undefined,
            imageHeight,
            bodyImage.state === 'ready' ? bodyImage.fileUri : undefined,
          ));
          continue;
        }
        const lines = this.measuredLines(paragraph);
        for (const line of lines) {
          const lineCapacity = this.pendingPageBodyCapacity();
          if (!Number.isFinite(lineCapacity) || lineCapacity <= 0) {
            throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
          }
          const isParagraphStart = paragraph.isParagraphStart && line.lineIndex === 0;
          const paragraphSpace = isParagraphStart && this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + line.height > lineCapacity) {
            // A normal predecessor chapter can consume every already-laid-out
            // line in this bounded batch and record several exact pages in one
            // pass. Keep the former one-page restart only for a deliberately
            // truncated giant paragraph, whose last wrapped line cannot be
            // joined safely to a separately mounted suffix.
            if (this.previousChapterMeasurement === undefined || paragraph.isRangeTruncated) {
              this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
              return;
            }
            this.recordPendingPreviousChapterPage();
          }
          const admittedParagraphSpace = isParagraphStart && this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length === 0) {
            this.pendingPageStartScalar = line.startScalar;
          }
          this.pendingPageHeight += admittedParagraphSpace + line.height;
          this.pendingPageEndScalar = line.endScalar;
          // ReadingSurface uses this id as its ArkUI ForEach identity. A
          // paragraph starts at zero in every chapter, so the local paragraph
          // id alone would let a new chapter reuse an old visible Text child.
          // Bind the fragment to the Core-returned chapter identity; this is
          // presentation identity only and never changes the scalar anchor.
          this.pendingPageFragments.push(new ReadingSurfacePageFragment(
            `chapter-${this.requireChapter().chapterIndex}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
            this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)),
            isParagraphStart,
            line.startScalar,
            line.endScalar,
          ));
        }
        if (paragraph.isRangeTruncated) {
          // We reached the arbitrary, invisible prefix boundary before a
          // physical page was full. Joining the remaining text in a separate
          // node can alter this last line's wrapping, so do not claim a
          // correct first-page anchor from it.
          throw new Error('READING_LONG_PARAGRAPH_BATCH_UNVERIFIED');
        }
      }
      // All controller-derived data from this batch has now been copied into
      // plain fragments.  Release it before moving to the next bounded batch.
      this.measurementBatch.length = 0;
      if (this.prepareNextMeasurementBatch()) {
        this.batchProcessing = false;
        this.measurementEpoch += 1;
        return;
      }
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  private hasValidUnicodeProbe(lifecycleToken: number): boolean {
    let manager: LayoutManager;
    let lineCount: number;
    try {
      manager = this.unicodeProbeController.getLayoutManager();
      lineCount = manager.getLineCount();
    } catch (_) {
      // Layout can still be pending when the global didLayout fires for another
      // branch. The deadline turns a permanently unavailable manager into a
      // logged fail-closed exit rather than a title-only reading surface.
      return false;
    }
    if (lineCount === 0) {
      // A pending probe branch can report zero lines for a layout pass or
      // two, but a stably empty probe (broken ArkUI line layout for the probe
      // string) must not stall measurement until the 6s deadline. Fail closed
      // with a specific reason after a bounded number of retries.
      this.unicodeProbeEmptyAttempts += 1;
      if (this.unicodeProbeEmptyAttempts >= UNICODE_PROBE_EMPTY_ATTEMPT_LIMIT) {
        this.fail(new Error('PAGINATION_UNICODE_PROBE_NO_LINES'), lifecycleToken);
        return false;
      }
      return false;
    }
    if (lineCount !== 1) {
      this.fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'), lifecycleToken);
      return false;
    }
    try {
      const metric = manager.getLineMetrics(0);
      const map = new ReadingSurfaceLayoutMap(UNICODE_PROBE);
      const lines = map.linesFromArkUI([this.toLineMetric(metric)]);
      if (lines.length !== 1) {
        this.fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'), lifecycleToken);
        return false;
      }
      const line = lines[0];
      if (metric.startIndex !== 0 || metric.endIndex !== map.utf16Length() ||
        map.utf16Length() !== 4 || map.scalarCount() !== 3 ||
        line.startScalar !== 0 || line.endScalar !== 3) {
        this.fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'), lifecycleToken);
        return false;
      }
      if (this.unicodeProbeVerifiedGeneration !== this.measurementGeneration) {
        this.unicodeProbeVerifiedGeneration = this.measurementGeneration;
        console.info('ReadingExperience UTF-16 probe passed: A😀B = 4 UTF-16 / 3 Unicode scalars');
      }
      this.unicodeProbeEmptyAttempts = 0;
      return true;
    } catch (error) {
      // Metrics exist, so this is not a layout-pending signal. Preserve the
      // conversion error (for example, a UTF-16 boundary splitting a
      // surrogate) instead of collapsing it into a retryable/pending state or
      // hiding the actual reason behind a generic probe failure.
      this.fail(error instanceof Error ? error : new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'), lifecycleToken);
      return false;
    }
  }

  private allBatchParagraphsHaveLayout(): boolean {
    try {
      if (this.measurementBatch.length === 0) {
        return false;
      }
      for (const paragraph of this.measurementBatch) {
        if (paragraph.controller.getLayoutManager().getLineCount() <= 0) {
          return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  private measuredLines(paragraph: MeasurementParagraph): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const lineCount = manager.getLineCount();
    if (lineCount <= 0) {
      throw new Error('PAGINATION_MEASUREMENT_PENDING');
    }
    const metrics: ReadingSurfaceLineMetric[] = [];
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      metrics.push(this.toLineMetric(manager.getLineMetrics(lineIndex)));
    }
    const scalarLines = paragraph.layoutMap.linesFromArkUI(metrics);
    const result: MeasuredReadingLine[] = [];
    for (let lineIndex = 0; lineIndex < scalarLines.length; lineIndex += 1) {
      const local = scalarLines[lineIndex];
      if (local.endScalar <= local.startScalar || local.height <= 0) {
        continue;
      }
      result.push(new MeasuredReadingLine(
        lineIndex,
        paragraph.layoutMap.utf16ForScalar(local.startScalar),
        paragraph.layoutMap.utf16ForScalar(local.endScalar),
        paragraph.chapterStartScalar + local.startScalar,
        paragraph.chapterStartScalar + local.endScalar,
        local.height,
      ));
    }
    if (result.length === 0) {
      throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
    }
    return result;
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
    for (const image of this.requireChapter().images) {
      if (image.startScalar === paragraph.chapterStartScalar && image.endScalar === paragraph.chapterStartScalar + 1) {
        return image;
      }
    }
    throw new Error('READING_IMAGE_BLOCK_MISSING');
  }

  private resolvePendingReadingImage(
    image: ReadingSessionImage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    this.cancelMeasurementDeadline();
    const isCurrent = (): boolean =>
      this.isMeasurementCurrent(generation, selectionToken, lifecycleToken);
    void this.activeGateway().resolveReadingImage(this.requireChapter(), image, isCurrent)
      .then((resolved: ReadingSessionImage): void => {
        if (!isCurrent()) {
          this.releaseUnadmittedReadingImage(resolved);
          return;
        }
        this.adoptReadingImage(resolved);
        this.replaceResolvedReadingImage(image, resolved);
        this.armMeasurementDeadline(generation, selectionToken, lifecycleToken);
        this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          this.fail(error, lifecycleToken);
        }
      });
  }

  private replaceResolvedReadingImage(
    requested: ReadingSessionImage,
    resolved: ReadingSessionImage,
  ): void {
    const chapter = this.requireChapter();
    const images = chapter.images.map((image: ReadingSessionImage): ReadingSessionImage => {
      if (image.source !== requested.source || image.baseUrl !== requested.baseUrl || image.state !== 'pending') {
        return image;
      }
      return {
        source: image.source,
        baseUrl: image.baseUrl,
        startScalar: image.startScalar,
        endScalar: image.endScalar,
        state: resolved.state,
        pixelMap: resolved.pixelMap,
        fileUri: resolved.fileUri,
        intrinsicWidth: resolved.intrinsicWidth,
        intrinsicHeight: resolved.intrinsicHeight,
        revision: resolved.revision,
      };
    });
    const updated: ReadingSessionChapter = {
      sourceId: chapter.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle,
      chapterUrl: chapter.chapterUrl,
      content: chapter.content,
      images,
      contentVersion: chapter.contentVersion,
      extractionVia: chapter.extractionVia,
    };
    this.chapter = updated;
    this.chapterWindow.setCurrent(updated);
    this.retainCurrentChapterWindow();
  }

  private measurementNodeText(paragraph: MeasurementParagraph): string {
    // The image height is owned by its intrinsic Host measurement. Mount one
    // ordinary glyph only to make the bounded ArkUI controller tree settle;
    // its line geometry is never used for the image block.
    return paragraph.text === '\uFFFC' ? 'A' : paragraph.text;
  }

  private scaledReadingImageHeight(image: ReadingSessionImage, pageCapacity: number): number {
    if (image.state !== 'ready') {
      throw new Error('READING_IMAGE_NOT_READY');
    }
    if (image.intrinsicWidth <= 0 || image.intrinsicHeight <= 0) {
      throw new Error('READING_IMAGE_DIMENSIONS_INVALID');
    }
    const fitted = this.measurementTextWidth() * image.intrinsicHeight / image.intrinsicWidth;
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
    if (this.pendingPageFragments.length === 0 || this.pendingPageStartScalar < 0 ||
      this.pendingPageEndScalar < this.pendingPageStartScalar) {
      this.fail(new Error('PAGINATION_NO_PHYSICAL_PAGE'), lifecycleToken);
      return;
    }
    const page = new PhysicalReadingPage(
      [...this.pendingPageFragments],
      this.pendingPageStartScalar,
      this.pendingPageEndScalar,
    );
    this.observeMeasuredPhysicalPage(page);
    this.measurementBatch.length = 0;
    this.batchProcessing = false;
    this.measurementCompleting = true;
    this.cancelMeasurementDeadline();
    // Unmount the hidden controller tree while Core resolves and stores the
    // actual visible scalar anchor.  No subsequent batch exists in memory.
    this.measurementEpoch += 1;
    if (this.previousChapterMeasurement !== undefined) {
      this.continuePreviousChapterMeasurement(page, generation, selectionToken, lifecycleToken);
      return;
    }
    void this.completeFirstPage(page, generation, selectionToken, lifecycleToken);
  }

  /**
   * Measures the TOC-previous chapter from its real head through EOF while the
   * old visible page remains mounted. Intermediate pages are pagination facts
   * only: they never become visible and never write transient progress.
   */
  private continuePreviousChapterMeasurement(
    measuredPage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
      return;
    }
    const chapter = this.requireChapter();
    if (chapter.chapterIndex !== pending.targetChapterIndex) {
      this.recoverPreviousChapterMeasurement(new Error('PREVIOUS_CHAPTER_IDENTITY_MISMATCH'), lifecycleToken);
      return;
    }
    const map = this.requireChapterLayoutMap();
    if (pending.targetChapterIndex === pending.originalChapterIndex) {
      const completedContainingPage = this.paginationIndex.findContainingPage(
        this.currentPaginationKey(),
        pending.originalChapterOffset,
      );
      if (completedContainingPage !== undefined) {
        this.previousChapterMeasurement = undefined;
        this.measurementCompleting = false;
        const previousChapterIndex = this.adjacentChapterIndex(pending.originalChapterIndex, -1);
        const previousChapterKey = completedContainingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
          this.paginationKeyForChapter(previousChapterIndex) ?? null : null;
        const previous = this.paginationIndex.findPreviousPage(
          this.currentPaginationKey(),
          pending.originalChapterOffset,
          previousChapterKey,
        );
        if (previous.kind === 'page') {
          if (previous.page.key.chapterIndex === pending.originalChapterIndex) {
            this.measureCommittedPageAt(previous.page.startScalar);
          } else {
            this.openPageTurnChapter(previous.page.key.chapterIndex, previous.page.startScalar);
          }
          return;
        }
        if (previousChapterIndex !== undefined) {
          this.startPreviousChapterMeasurement(
            previousChapterIndex,
            pending.originalChapterIndex,
            pending.originalChapterOffset,
          );
          return;
        }
        this.measureCommittedPageAt(pending.originalChapterOffset);
        return;
      }
      const draft = this.paginationDraft;
      if (draft !== undefined && draft.matches(this.currentPaginationKey()) &&
        draft.containsAnchor(pending.originalChapterOffset)) {
        const previousRequest = draft.previousRequestForAnchor(pending.originalChapterOffset);
        this.previousChapterMeasurement = undefined;
        this.measurementCompleting = false;
        if (previousRequest !== undefined) {
          this.measureCommittedPageAt(previousRequest);
          return;
        }
        const previousChapterIndex = this.adjacentChapterIndex(pending.originalChapterIndex, -1);
        if (previousChapterIndex !== undefined) {
          this.startPreviousChapterMeasurement(
            previousChapterIndex,
            pending.originalChapterIndex,
            pending.originalChapterOffset,
          );
          return;
        }
        // The requested anchor belongs to the first physical page of the
        // first chapter. Re-materialize the already committed page so the
        // temporary hidden measurement cannot leave the reader in measuring.
        this.measureCommittedPageAt(pending.originalChapterOffset);
        return;
      }
    }
    if (measuredPage.endScalar <= this.lastVisibleScalar(chapter.content, map)) {
      this.desiredChapterOffset = measuredPage.endScalar;
      this.desiredChapterProgress = map.scalarCount() === 0 ? 0 : measuredPage.endScalar / map.scalarCount();
      this.measurementCompleting = false;
      this.beginMeasurement(lifecycleToken);
      return;
    }
    const lastPage = this.paginationIndex.findLastPage(this.currentPaginationKey());
    if (lastPage === undefined || lastPage.startScalar !== measuredPage.startScalar) {
      this.recoverPreviousChapterMeasurement(new Error('PREVIOUS_CHAPTER_MANIFEST_NOT_RECORDED'), lifecycleToken);
      return;
    }
    this.previousChapterMeasurement = undefined;
    void this.completeFirstPage(measuredPage, generation, selectionToken, lifecycleToken);
  }

  private async completeFirstPage(
    visiblePage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): Promise<void> {
    try {
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
          return;
        }
        const chapter = this.requireChapter();
        const scalarCount = this.requireChapterLayoutMap().scalarCount();
        const visibleProgress = scalarCount === 0 ? 0 : visiblePage.startScalar / scalarCount;
        const resolved = await this.activeGateway().resolveLocation(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, visiblePage.startScalar, visibleProgress),
          this.coreLayout(),
          (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken),
        );
        if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
          return;
        }
        // Persistence precedes visibility: a process stop once the static page
        // is shown always has a Core-owned scalar anchor to restore from.
        const stored = await this.activeGateway().updateProgress(this.bookId, new CoreReadingProgressUpdate(
          resolved.chapterIndex,
          resolved.chapterOffset,
          resolved.chapterProgress,
          resolved.locationRevision,
        ), (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken));
        if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
          return;
        }
        if (stored.chapterIndex !== chapter.chapterIndex || stored.chapterOffset !== visiblePage.startScalar) {
          throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
        }
        this.desiredChapterOffset = visiblePage.startScalar;
        this.desiredChapterProgress = visibleProgress;
        this.visiblePage = visiblePage;
        this.visiblePageSelectionToken = selectionToken;
        this.visibleFragments = visiblePage.fragments;
        this.releaseUnretainedReadingImages();
        this.showChapterTitle = this.isChapterFirstPageStart(visiblePage.startScalar);
        this.phase = 'ready';
        this.beginReadingRecordClock(lifecycleToken);
        this.measurementCompleting = false;
        this.cancelFirstPageReadyDeadline();
        this.chapterTitle = chapter.chapterTitle;
        this.onChapterCommitted(chapter.chapterIndex, chapter.chapterTitle);
        this.onReadingReady(chapter.chapterIndex);
        this.onReadingCommitted(new ReadingCommit(
          this.sourceId,
          this.bookId,
          stored.chapterIndex,
          stored.chapterOffset,
          stored.chapterProgress,
          stored.locationRevision,
        ));
        this.prefetchAdjacentChapters(chapter, lifecycleToken, selectionToken);
        this.onAutoPagePageCommitted();
        this.resumeDeferredMeasurement(lifecycleToken);
      });
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  /**
   * The only normal exit path. The host invokes the registered request
   * closure; this component serializes Core persistence before it gives route
   * ownership back through `onExit`.
   */
  private requestExit(): void {
    if (this.controlVisible) {
      if (this.controlPage !== 'home') {
        this.setControlPage('home');
      } else {
        this.hideControl();
      }
      return;
    }
    this.beginExit();
  }

  private beginExit(): void {
    const lifecycleToken = this.lifecycleToken;
    if (!this.isSessionActive(lifecycleToken) || this.exitRequested) {
      return;
    }
    this.exitRequested = true;
    this.captureReadingRecordElapsed(false);
    this.clearReadingRecordTimer();
    this.autoPageState = invalidateReaderAutoPageState(this.autoPageState);
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelFirstPageReadyDeadline();
    void this.finishExit(lifecycleToken);
  }

  private async finishExit(lifecycleToken: number): Promise<void> {
    try {
      const coordinator = this.ttsCoordinator;
      if (coordinator !== undefined) await coordinator.stop('lifecycle');
      await this.flushReadingRecordForExit();
      // A loading/measuring failure has no materialized physical page, so this
      // is deliberately a no-op commit that still completes before exit.
      await this.commitVisiblePage(lifecycleToken);
    } finally {
      if (!this.isMountedToken(lifecycleToken) || this.exitDelivered) {
        return;
      }
      this.exitDelivered = true;
      this.onExit();
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
    this.commitInFlight = true;
    try {
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken)) {
          return;
        }
        const scalarCount = this.requireChapterLayoutMap().scalarCount();
        const chapterProgress = scalarCount === 0 ? 0 : page.startScalar / scalarCount;
        const resolved = await this.activeGateway().resolveLocation(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress),
          this.coreLayout(),
          (): boolean => this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken),
        );
        if (!this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken)) {
          return;
        }
        const stored = await this.activeGateway().updateProgress(this.bookId, new CoreReadingProgressUpdate(
          resolved.chapterIndex,
          resolved.chapterOffset,
          resolved.chapterProgress,
          resolved.locationRevision,
        ), (): boolean => this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken));
        if (!this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken)) {
          return;
        }
        this.onReadingCommitted(new ReadingCommit(
          this.sourceId,
          this.bookId,
          stored.chapterIndex,
          stored.chapterOffset,
          stored.chapterProgress,
          stored.locationRevision,
        ));
      });
    } catch (error) {
      // The visible static reading page remains valid. Persistence failures are
      // logged rather than replaced by an unapproved visual state.
      console.error(`ReadingExperience progress commit failed: ${this.errorMessage(error as Error)}`);
    } finally {
      if (this.isMountedToken(lifecycleToken)) {
        this.commitInFlight = false;
      }
    }
  }

  private coreLayout(): CoreReadingLayout {
    // Core's contract is a uint32 viewport snapshot. ArkUI areas may be
    // fractional vp values, so retain the fractional value for measurement
    // and round only at this Core protocol boundary.
    return new CoreReadingLayout(
      Math.max(1, Math.round(this.effectiveViewportWidth())),
      Math.max(1, Math.round(this.effectiveViewportHeight())),
      readerAppearanceFontScale(this.appearanceSnapshot),
      readerAppearanceLineHeight(this.appearanceSnapshot),
    );
  }

  private paginationLayoutSignature(): string {
    const horizontalInset = this.horizontalInset();
    return createReadingPaginationLayoutSignature({
      deviceForm: this.isTablet ? 'tablet' : 'phone',
      viewportWidth: this.effectiveViewportWidth(),
      viewportHeight: this.effectiveViewportHeight(),
      fontFamily: readerAppearanceFontFamily(this.appearanceSnapshot.font),
      fontWeight: FIGMA_BODY_FONT_WEIGHT,
      fontSize: this.appearanceSnapshot.fontSize,
      fontScale: readerAppearanceFontScale(this.appearanceSnapshot),
      lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot),
      topInset: this.topInset(),
      bottomInset: this.bottomInset(),
      leftInset: horizontalInset,
      rightInset: horizontalInset,
      titleLineHeight: FIGMA_TITLE_LINE_HEIGHT,
      titleToBodySpacing: FIGMA_TITLE_TO_BODY_SPACE,
      paragraphSpacing: this.appearanceSnapshot.paragraphSpacing,
      paragraphIndent: readerAppearanceParagraphIndent(
        this.appearanceSnapshot.fontSize,
        this.appearanceSnapshot.indent,
      ),
      letterSpacing: this.appearanceSnapshot.letterSpacing,
      textAlignment: this.appearanceSnapshot.alignment,
      writingMode: READING_WRITING_MODE,
    });
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
        this.paginationIndex.invalidateChapter(this.sourceId, this.bookId, chapterIndex);
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
    this.paginationIndex.retainChapterWindow(this.sourceId, this.bookId, retained);
    for (let index = this.knownContentVersions.length - 1; index >= 0; index -= 1) {
      if (retained.indexOf(this.knownContentVersions[index].chapterIndex) < 0) {
        this.knownContentVersions.splice(index, 1);
      }
    }
    this.releaseUnretainedReadingImages();
  }

  private adoptReadingImage(image: ReadingSessionImage): void {
    if (image.state !== 'ready' || (image.fileUri.length === 0 && image.pixelMap === undefined)) {
      return;
    }
    for (const retained of this.readingImageResources) {
      if (this.sameReadingImageResource(retained, image)) {
        // Each Host load acquires one file reference. The session retains one
        // owner for identical bytes even when several anchors share them.
        ReaderRuntimeOwner.current().releaseReadingImage(image.fileUri, image.pixelMap);
        return;
      }
    }
    this.readingImageResources.push(image);
  }

  private releaseUnadmittedReadingImage(image: ReadingSessionImage): void {
    if (image.fileUri.length > 0 || image.pixelMap !== undefined) {
      ReaderRuntimeOwner.current().releaseReadingImage(image.fileUri, image.pixelMap);
    }
  }

  private releaseUnretainedReadingImages(): void {
    for (let index = this.readingImageResources.length - 1; index >= 0; index -= 1) {
      const resource = this.readingImageResources[index];
      if (this.isReadingImageRetained(resource)) {
        continue;
      }
      if (resource.fileUri.length > 0 || resource.pixelMap !== undefined) {
        ReaderRuntimeOwner.current().releaseReadingImage(resource.fileUri, resource.pixelMap);
      }
      this.readingImageResources.splice(index, 1);
    }
  }

  private isReadingImageRetained(resource: ReadingSessionImage): boolean {
    if (resource.fileUri.length === 0 && resource.pixelMap === undefined) {
      return false;
    }
    const chapterImages = this.chapter?.images ?? [];
    for (const image of chapterImages.concat(this.chapterWindow.retainedImages())) {
      if (this.sameReadingImageResource(resource, image)) {
        return true;
      }
    }
    for (const fragment of this.visibleFragments.concat(this.pendingPageFragments)) {
      if ((resource.fileUri.length > 0 && fragment.fileUri === resource.fileUri) ||
        (resource.pixelMap !== undefined && fragment.imageSource === resource.pixelMap)) {
        return true;
      }
    }
    return false;
  }

  private releaseAllReadingImages(): void {
    for (const resource of this.readingImageResources) {
      if (resource.fileUri.length > 0 || resource.pixelMap !== undefined) {
        ReaderRuntimeOwner.current().releaseReadingImage(resource.fileUri, resource.pixelMap);
      }
    }
    this.readingImageResources.splice(0, this.readingImageResources.length);
  }

  private sameReadingImageResource(left: ReadingSessionImage, right: ReadingSessionImage): boolean {
    if (left.fileUri.length > 0 || right.fileUri.length > 0) {
      return left.fileUri.length > 0 && left.fileUri === right.fileUri;
    }
    return left.pixelMap !== undefined && left.pixelMap === right.pixelMap;
  }

  /**
   * Admits one exact, continuous sequence of measured physical pages. A run
   * may begin at restore/search/seek so pages measured after that anchor have
   * a real predecessor; only a chapter-head run can become a full manifest.
   * No page boundary before the first observation is inferred.
   */
  private observeMeasuredPhysicalPage(page: PhysicalReadingPage): void {
    const key = this.currentPaginationKey();
    if (this.paginationIndex.has(key)) {
      return;
    }
    if (this.paragraphRanges.length === 0 || this.measurementRequestedAnchorScalar < 0) {
      this.resetPaginationDraft();
      return;
    }

    const chapterStartRequest = this.paragraphRanges[0].startScalar;
    const requestedAnchor = this.measurementRequestedAnchorScalar;
    const observation: ReadingPaginationPrefixObservation = {
      requestScalar: requestedAnchor,
      startScalar: page.startScalar,
      endScalarExclusive: page.endScalar,
    };
    const draft = this.paginationDraft;
    if (draft !== undefined && draft.matches(key) && draft.admit(observation)) {
      // Exact re-observations preserve the known prefix; only the continuous
      // frontier can extend it. This makes an already measured previous page
      // usable without turning the prefix into a navigation-history stack.
    } else {
      this.paginationDraft = new ReadingPaginationPrefix(key, observation);
    }

    const activeDraft = this.paginationDraft;
    if (activeDraft === undefined || !this.samePaginationKey(activeDraft.key, key)) {
      return;
    }
    const chapter = this.requireChapter();
    const map = this.requireChapterLayoutMap();
    if (page.endScalar <= this.lastVisibleScalar(chapter.content, map)) {
      return;
    }
    if (!activeDraft.startsAtRequest(chapterStartRequest)) {
      // A continuous suffix remains useful for exact in-session previous-page
      // lookup, but it cannot claim the unmeasured chapter prefix.
      return;
    }
    this.paginationIndex.recordChapter({
      key,
      contentScalarLength: map.scalarCount(),
      pageStartScalars: activeDraft.pageStartScalars(),
    });
    this.resetPaginationDraft();
  }

  private resetPaginationDraft(): void {
    this.paginationDraft = undefined;
    this.measurementRequestedAnchorScalar = -1;
  }

  private samePaginationKey(left: ReadingPaginationKey, right: ReadingPaginationKey): boolean {
    return left.sourceId === right.sourceId && left.bookId === right.bookId &&
      left.chapterIndex === right.chapterIndex && left.layoutSignature === right.layoutSignature &&
      left.contentVersion === right.contentVersion;
  }

  private collectParagraphRanges(content: string): void {
    const chapterMap = this.requireChapterLayoutMap();
    let start = 0;
    const paragraphDivider = /(?:\r\n|\n|\r)[\t ]*(?:\r\n|\n|\r)(?:[\t ]*(?:\r\n|\n|\r))*/g;
    let match = paragraphDivider.exec(content);
    while (match !== null) {
      this.appendParagraphRange(start, match.index, chapterMap);
      start = match.index + match[0].length;
      match = paragraphDivider.exec(content);
    }
    this.appendParagraphRange(start, content.length, chapterMap);
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
    const content = this.requireChapter().content;
    if (content.substring(startUtf16, endUtf16).trim().length === 0) {
      return;
    }
    const index = this.paragraphRanges.length;
    this.paragraphRanges.push(new ParagraphRange(
      `paragraph-${index}-${startUtf16}`,
      startUtf16,
      endUtf16,
      chapterMap.scalarForUtf16(startUtf16),
      chapterMap.scalarForUtf16(endUtf16),
    ));
  }

  /**
   * Materialize no more than one bounded group of paragraphs.  A large single
   * paragraph receives a bounded prefix, never a hidden whole-paragraph
   * controller.  It is accepted only if that prefix itself determines the
   * first physical page before its last line; otherwise we fail closed rather
   * than assuming that a separately wrapped suffix would join correctly.
   */
  private prepareNextMeasurementBatch(): boolean {
    const chapter = this.requireChapter();
    const chapterMap = this.requireChapterLayoutMap();
    this.measurementBatch.length = 0;
    let totalUtf16 = 0;
    while (this.nextRangeIndex < this.paragraphRanges.length &&
      this.measurementBatch.length < MAX_MEASUREMENT_BATCH_PARAGRAPHS) {
      const range = this.paragraphRanges[this.nextRangeIndex];
      const startScalar = Math.max(range.startScalar, this.firstRangeStartScalar);
      if (startScalar >= range.endScalar) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      const startUtf16 = chapterMap.utf16ForScalar(startScalar);
      const utf16Length = range.endUtf16 - startUtf16;
      if (utf16Length <= 0) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      if (this.measurementBatch.length > 0 && totalUtf16 + utf16Length > MAX_MEASUREMENT_BATCH_UTF16) {
        break;
      }
      const endUtf16 = utf16Length > MAX_MEASUREMENT_BATCH_UTF16 ?
        this.boundedUtf16End(startUtf16, range.endUtf16, chapterMap) : range.endUtf16;
      const endScalar = chapterMap.scalarForUtf16(endUtf16);
      const isRangeTruncated = endScalar < range.endScalar;
      const text = chapter.content.substring(startUtf16, endUtf16);
      this.measurementBatch.push(new MeasurementParagraph(
        `${range.id}:${startScalar}`,
        this.nextRangeIndex,
        text,
        startScalar,
        new ReadingSurfaceLayoutMap(text),
        new TextController(),
        startScalar === range.startScalar,
        isRangeTruncated,
      ));
      totalUtf16 += endUtf16 - startUtf16;
      if (isRangeTruncated) {
        // Do not put a suffix in a second Text node: if the prefix cannot
        // settle this first page, its final wrapped line is not proven to be
        // equivalent to a continuous ArkUI paragraph.
        this.firstRangeStartScalar = endScalar;
        break;
      }
      this.nextRangeIndex += 1;
      this.firstRangeStartScalar = 0;
    }
    return this.measurementBatch.length > 0;
  }

  private boundedUtf16End(
    startUtf16: number,
    rangeEndUtf16: number,
    chapterMap: ReadingSurfaceLayoutMap,
  ): number {
    let candidate = Math.min(rangeEndUtf16, startUtf16 + MAX_MEASUREMENT_BATCH_UTF16);
    while (candidate > startUtf16) {
      try {
        chapterMap.scalarForUtf16(candidate);
        return candidate;
      } catch (_) {
        // The cap may fall between a surrogate pair. Back up to the nearest
        // true Unicode scalar boundary; this loop is normally one step.
        candidate -= 1;
      }
    }
    throw new Error('READING_LONG_PARAGRAPH_BATCH_UNVERIFIED');
  }

  private rangeIndexForOffset(offset: number): number {
    for (let index = 0; index < this.paragraphRanges.length; index += 1) {
      if (offset < this.paragraphRanges[index].endScalar) {
        return index;
      }
    }
    // The call site clamps EOF to a real scalar.  Keep this defensive branch
    // for a malformed paragraph split rather than reading past the array.
    return Math.max(0, this.paragraphRanges.length - 1);
  }

  /**
   * Finds the final non-whitespace Unicode scalar among the already admitted
   * paragraph ranges. This is used only to clamp a stale EOF restore anchor;
   * pagination continues to measure the original Core text and offsets.
   */
  private lastMeasurableScalar(): number {
    const chapter = this.requireChapter();
    const map = this.requireChapterLayoutMap();
    for (let rangeIndex = this.paragraphRanges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
      const range = this.paragraphRanges[rangeIndex];
      for (let scalar = range.endScalar - 1; scalar >= range.startScalar; scalar -= 1) {
        const startUtf16 = map.utf16ForScalar(scalar);
        const endUtf16 = map.utf16ForScalar(scalar + 1);
        if (chapter.content.substring(startUtf16, endUtf16).trim().length > 0) {
          return scalar;
        }
      }
    }
    throw new Error('READING_CONTENT_EMPTY');
  }

  private resetPendingPage(): void {
    this.pendingPageFragments = [];
    this.pendingPageStartScalar = -1;
    this.pendingPageEndScalar = -1;
    this.pendingPageHeight = 0;
  }

  /**
   * Record one exact non-final predecessor page without remounting the hidden
   * Text tree. The next observation is keyed by this real page end, preserving
   * the same continuous-prefix proof used by ordinary one-page measurement.
   */
  private recordPendingPreviousChapterPage(): void {
    if (this.previousChapterMeasurement === undefined || this.pendingPageFragments.length === 0 ||
      this.pendingPageStartScalar < 0 || this.pendingPageEndScalar < this.pendingPageStartScalar) {
      throw new Error('PREVIOUS_CHAPTER_PAGE_BATCH_INVALID');
    }
    const page = new PhysicalReadingPage(
      [...this.pendingPageFragments],
      this.pendingPageStartScalar,
      this.pendingPageEndScalar,
    );
    this.observeMeasuredPhysicalPage(page);
    this.measurementRequestedAnchorScalar = page.endScalar;
    this.resetPendingPage();
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
    if (this.tocEntries.length === 0) {
      throw new Error('LOCAL_TOC_EMPTY');
    }
    if (requested === undefined) {
      return this.tocEntries[0].index;
    }
    for (const entry of this.tocEntries) {
      if (entry.index === requested) {
        return requested;
      }
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
    return this.paragraphRanges.length > 0 && startScalar === this.paragraphRanges[0].startScalar;
  }

  private pendingPageBodyCapacity(): number {
    const pageStartScalar = this.pendingPageStartScalar >= 0 ?
      this.pendingPageStartScalar : this.measurementRequestedAnchorScalar;
    const titleTrackHeight = this.isChapterFirstPageStart(pageStartScalar) ?
      FIGMA_TITLE_LINE_HEIGHT + FIGMA_TITLE_TO_BODY_SPACE : 0;
    return this.effectiveViewportHeight() - this.topInset() - this.bottomInset() - titleTrackHeight;
  }

  private measurementTextWidth(): number {
    return Math.max(1, this.effectiveViewportWidth() - this.horizontalInset() * 2);
  }

  private effectiveViewportWidth(): number {
    return this.viewportWidth > 0 ? this.viewportWidth :
      (this.isTablet ? FIGMA_TABLET_WIDTH : FIGMA_PHONE_WIDTH);
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
    this.cancelMeasurementDeadline();
    this.measurementDeadlineTimer = setTimeout((): void => {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) ||
        this.measurementCompleting) {
        return;
      }
      this.fail(new Error('PAGINATION_LAYOUT_METRICS_UNAVAILABLE'), lifecycleToken);
    }, MEASUREMENT_LAYOUT_TIMEOUT_MS);
  }

  private cancelMeasurementDeadline(): void {
    if (this.measurementDeadlineTimer < 0) {
      return;
    }
    clearTimeout(this.measurementDeadlineTimer);
    this.measurementDeadlineTimer = -1;
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

  private effectiveViewportHeight(): number {
    return this.viewportHeight > 0 ? this.viewportHeight :
      (this.isTablet ? FIGMA_TABLET_HEIGHT : FIGMA_PHONE_HEIGHT);
  }

  private topInset(): number {
    return this.isTablet ? FIGMA_TABLET_TOP_INSET : FIGMA_PHONE_TOP_INSET;
  }

  private bottomInset(): number {
    return this.isTablet ? FIGMA_TABLET_BOTTOM_INSET : FIGMA_PHONE_BOTTOM_INSET;
  }

  private horizontalInset(): number {
    return this.isTablet ? FIGMA_TABLET_HORIZONTAL_INSET : FIGMA_PHONE_HORIZONTAL_INSET;
  }

  private normalizedProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private numericAreaLength(value: Length): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  // Local books use Core's exact processed-scalar aggregate. Remote sessions
  // deliberately use TOC position + current chapter progress: exact unopened
  // body lengths do not exist yet, and the reader must not download the whole
  // book merely to paint a control percentage.
  private controlProgress(): number {
    const metrics = this.contentMetrics;
    if (metrics !== undefined) {
      return wholeBookProgressPercent(
        metrics,
        this.currentChapterIndex(),
        this.desiredChapterOffset,
      );
    }
    const count = this.tocEntries.length;
    if (count === 0) {
      return 0;
    }
    for (let position = 0; position < count; position += 1) {
      if (this.tocEntries[position].index === this.currentChapterIndex()) {
        return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX,
          ((position + this.normalizedProgress(this.desiredChapterProgress)) / count) *
          READER_CONTROL_PROGRESS_MAX));
      }
    }
    return 0;
  }

  private currentChapterIndex(): number {
    return this.chapter === undefined ? -1 : this.chapter.chapterIndex;
  }

  private controlDirectoryEntries(): LocalReadingTocEntry[] {
    // Parent-owned bookmark/download projections can lag after a runtime
    // conversion switch. Prefer the current session's Core-projected title
    // while retaining the parent's marker and offline state.
    if (this.directoryEntries.length === 0) {
      return this.tocEntries;
    }
    const projectedByChapter = new Map<number, LocalReadingTocEntry>();
    for (const projected of this.tocEntries) {
      projectedByChapter.set(projected.index, projected);
    }
    return this.directoryEntries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
      const projected = projectedByChapter.get(entry.index);
      return projected === undefined ? entry : {
        index: entry.index,
        title: projected.title,
        downloadState: entry.downloadState,
        bookmarks: entry.bookmarks,
      };
    });
  }

  private initializeTtsSession(lifecycleToken: number): void {
    const owner = ReaderRuntimeOwner.current();
    const gateway = new ReaderTtsGateway(owner);
    const httpGateway = new ReaderHttpTtsGateway(owner);
    const coordinator = new ReaderTtsSessionCoordinator(
      gateway,
      owner.getTtsHost(),
      async (progress: ReaderTtsProgressCommit): Promise<void> => this.commitTtsProgress(progress, lifecycleToken),
      (state: ReaderTtsState): void => {
        if (this.isMountedToken(lifecycleToken) && this.ttsCoordinator === coordinator) {
          this.ttsState = state;
        }
      },
      async (chapter: ReaderTtsChapterRef): Promise<ReaderTtsChapterAdvanceInput | undefined> =>
        this.loadNextTtsChapter(chapter, lifecycleToken),
    );
    this.ttsGateway = gateway;
    this.ttsHttpGateway = httpGateway;
    this.ttsCoordinator = coordinator;
    void coordinator.probeAvailability()
      .then(async (available: boolean): Promise<void> => {
        if (!this.isMountedToken(lifecycleToken) || this.ttsCoordinator !== coordinator) return;
        const config = await gateway.getConfig();
        const httpEngines = await httpGateway.list();
        if (!this.isMountedToken(lifecycleToken) || this.ttsCoordinator !== coordinator) return;
        this.ttsConfig = config;
        this.ttsEngine = config?.engine ?? 'system';
        this.ttsHttpEngines = httpEngines;
        if (available && config !== undefined) await coordinator.setRate(this.multiplierForCoreRate(config.rate));
      })
      .catch((error: Error): void => {
        this.logTtsFailure('initialization', error);
      });
  }

  private toggleTts(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined || this.ttsState.status === 'unavailable') return;
    if (this.ttsState.status === 'playing' || this.ttsState.status === 'preparing' ||
      this.ttsState.status === 'resuming') {
      void coordinator.pause().catch((error: Error): void => this.logTtsFailure('pause', error));
      return;
    }
    if (this.ttsState.status === 'paused' || this.ttsState.status === 'interrupted') {
      void coordinator.resume().catch((error: Error): void => this.logTtsFailure('resume', error));
      return;
    }
    const chapter = this.chapter;
    const page = this.visiblePage;
    if (!this.mounted || this.phase !== 'ready' || chapter === undefined || page === undefined ||
      this.materializedContentVersion.length === 0) return;
    this.stopAutoPage();
    void coordinator.start({
      chapter: this.ttsChapterRef(chapter),
      content: chapter.content,
      contentVersion: this.materializedContentVersion,
      scalarPosition: page.startScalar,
      rate: this.ttsState.rate,
      pitch: 1,
      language: 'zh-CN',
      allowMixing: this.ttsAllowMixing,
      failurePolicy: this.ttsFailurePolicy,
      timerDurationMs: this.ttsTimerDurationMs(),
    }).catch((error: Error): void => this.logTtsFailure('start', error));
  }

  private async loadNextTtsChapter(
    current: ReaderTtsChapterRef,
    lifecycleToken: number,
  ): Promise<ReaderTtsChapterAdvanceInput | undefined> {
    if (!this.isSessionActive(lifecycleToken) || current.sourceId !== this.sourceId ||
      current.bookId !== this.bookId || current.chapterIndex !== this.currentChapterIndex()) return undefined;
    const target = this.adjacentChapterIndex(current.chapterIndex, 1);
    if (target === undefined) return undefined;
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      current.chapterIndex === this.currentChapterIndex();
    const chapter = await this.loadSessionChapter(target, isCurrent);
    if (!isCurrent()) return undefined;
    this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
    this.chapterWindow.admitNeighbour(chapter);
    return {
      chapter: this.ttsChapterRef(chapter),
      content: chapter.content,
      contentVersion: chapter.contentVersion,
      onAdmitted: (): void => this.selectChapterAnchor(target, 0, true, false),
    };
  }

  private stopTts(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator !== undefined) {
      void coordinator.stop('user').catch((error: Error): void => this.logTtsFailure('stop', error));
    }
  }

  private previousTtsUtterance(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator !== undefined) {
      void coordinator.previous().catch((error: Error): void => this.logTtsFailure('previous', error));
    }
  }

  private nextTtsUtterance(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator !== undefined) {
      void coordinator.next().catch((error: Error): void => this.logTtsFailure('next', error));
    }
  }

  private seekTtsUtterance(sliceIndex: number): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator !== undefined) {
      void coordinator.seek(sliceIndex).catch((error: Error): void => this.logTtsFailure('seek', error));
    }
  }

  private changeTtsRate(rate: number): void {
    const normalized = Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX,
      Math.round(rate * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE));
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined) return;
    void coordinator.setRate(normalized)
      .then((): Promise<void> => this.persistTtsConfig(normalized))
      .catch((error: Error): void => this.logTtsFailure('rate', error));
  }

  private changeTtsTimer(minutes: number, seconds: number): void {
    this.ttsTimerMinutes = Math.max(READER_TTS_TIMER_MIN,
      Math.min(READER_TTS_TIMER_MAX_MINUTES, Math.trunc(minutes)));
    this.ttsTimerSeconds = Math.max(READER_TTS_TIMER_MIN,
      Math.min(READER_TTS_TIMER_MAX_SECONDS, Math.trunc(seconds)));
    if (this.ttsState.chapterKey !== undefined) {
      this.ttsCoordinator?.setTimer(this.ttsTimerDurationMs());
    }
  }

  private changeTtsAllowMixing(enabled: boolean): void {
    this.ttsAllowMixing = enabled;
    this.ttsCoordinator?.setAllowMixing(enabled);
  }

  private changeTtsFailurePolicy(policy: 'skip' | 'stop'): void {
    this.ttsFailurePolicy = policy;
    this.ttsCoordinator?.setFailurePolicy(policy);
  }

  private async changeTtsEngine(engine: string): Promise<void> {
    if (engine !== 'system' && !/^http-tts:\d+$/.test(engine)) return;
    const gateway = this.ttsGateway;
    const coordinator = this.ttsCoordinator;
    if (gateway === undefined || coordinator === undefined || engine === this.ttsEngine) return;
    try {
      await coordinator.stop('user');
      const prior = this.ttsConfig;
      const config = await gateway.putConfig({
        engine,
        rate: prior?.rate ?? this.coreRateForMultiplier(this.ttsState.rate),
        pitch: prior?.pitch ?? 0,
        followSys: prior?.followSys ?? false,
      });
      this.ttsConfig = config;
      this.ttsEngine = config.engine ?? 'system';
      await coordinator.probeAvailability();
    } catch (error) {
      const failure = error as Error;
      this.logTtsFailure('engine', failure);
      throw failure;
    }
  }

  private async saveHttpTtsEngine(config: ReaderHttpTtsConfig): Promise<void> {
    const gateway = this.ttsHttpGateway;
    if (gateway === undefined) return;
    const existing = this.ttsHttpEngines.find(
      (engine: ReaderHttpTtsConfig): boolean => engine.id === config.id,
    );
    const merged: ReaderHttpTtsConfig = {
      id: config.id,
      name: config.name,
      url: config.url,
      lastUpdateTime: config.lastUpdateTime,
    };
    if (existing?.contentType !== undefined) merged.contentType = existing.contentType;
    if (existing?.concurrentRate !== undefined) merged.concurrentRate = existing.concurrentRate;
    if (existing?.loginUrl !== undefined) merged.loginUrl = existing.loginUrl;
    if (existing?.loginUi !== undefined) merged.loginUi = existing.loginUi;
    if (existing?.header !== undefined) merged.header = existing.header;
    if (existing?.jsLib !== undefined) merged.jsLib = existing.jsLib;
    if (existing?.enabledCookieJar !== undefined) merged.enabledCookieJar = existing.enabledCookieJar;
    if (existing?.loginCheckJs !== undefined) merged.loginCheckJs = existing.loginCheckJs;
    try {
      const saved = await gateway.put(merged);
      this.ttsHttpEngines = await gateway.list();
      if (this.ttsEngine !== `http-tts:${saved.id}`) {
        await this.changeTtsEngine(`http-tts:${saved.id}`);
      }
    } catch (error) {
      const failure = error as Error;
      this.logTtsFailure('http-engine-put', failure);
      throw failure;
    }
  }

  private async deleteHttpTtsEngine(id: number): Promise<void> {
    const httpGateway = this.ttsHttpGateway;
    const configGateway = this.ttsGateway;
    const coordinator = this.ttsCoordinator;
    if (httpGateway === undefined || configGateway === undefined || coordinator === undefined) return;
    try {
      await this.deleteHttpTtsEngineCoreFirst(id, httpGateway, configGateway, coordinator);
    } catch (error) {
      const failure = error as Error;
      this.logTtsFailure('http-engine-delete', failure);
      throw failure;
    }
  }

  private async deleteHttpTtsEngineCoreFirst(
    id: number,
    httpGateway: ReaderHttpTtsGateway,
    configGateway: ReaderTtsGateway,
    coordinator: ReaderTtsSessionCoordinator,
  ): Promise<void> {
    if (this.ttsEngine === `http-tts:${id}`) {
      await coordinator.stop('user');
      const prior = this.ttsConfig;
      const config = await configGateway.putConfig({
        engine: 'system',
        rate: prior?.rate ?? this.coreRateForMultiplier(this.ttsState.rate),
        pitch: prior?.pitch ?? 0,
        followSys: prior?.followSys ?? false,
      });
      this.ttsConfig = config;
      this.ttsEngine = 'system';
    }
    await httpGateway.delete(id);
    this.ttsHttpEngines = await httpGateway.list();
    await coordinator.probeAvailability();
  }

  private async persistTtsConfig(rate: number): Promise<void> {
    const gateway = this.ttsGateway;
    if (gateway === undefined) return;
    const prior = this.ttsConfig;
    const config = await gateway.putConfig({
      engine: this.ttsEngine,
      rate: this.coreRateForMultiplier(rate),
      pitch: prior?.pitch ?? 0,
      followSys: prior?.followSys ?? false,
    });
    this.ttsConfig = config;
  }

  private async commitTtsProgress(progress: ReaderTtsProgressCommit, lifecycleToken: number): Promise<void> {
    const chapter = this.chapter;
    if (!this.isSessionActive(lifecycleToken) || chapter === undefined ||
      progress.chapter.sourceId !== this.sourceId || progress.chapter.bookId !== this.bookId ||
      progress.chapter.chapterIndex !== chapter.chapterIndex) return;
    try {
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!this.isSessionActive(lifecycleToken) || this.chapter !== chapter) return;
        const scalarCount = this.requireChapterLayoutMap().scalarCount();
        const offset = Math.max(0, Math.min(scalarCount, progress.charEnd));
        const chapterProgress = scalarCount === 0 ? 0 : offset / scalarCount;
        const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) && this.chapter === chapter;
        const resolved = await this.activeGateway().resolveLocation(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, offset, chapterProgress),
          this.coreLayout(),
          isCurrent,
        );
        if (!isCurrent()) return;
        const stored = await this.activeGateway().updateProgress(this.bookId, new CoreReadingProgressUpdate(
          resolved.chapterIndex,
          resolved.chapterOffset,
          resolved.chapterProgress,
          resolved.locationRevision,
        ), isCurrent);
        if (!isCurrent()) return;
        this.onReadingCommitted(new ReadingCommit(
          this.sourceId,
          this.bookId,
          stored.chapterIndex,
          stored.chapterOffset,
          stored.chapterProgress,
          stored.locationRevision,
        ));
      });
    } catch (error) {
      this.logTtsFailure('progress', error as Error);
    }
  }

  private ttsChapterRef(chapter: ReadingSessionChapter): ReaderTtsChapterRef {
    return {
      sourceId: this.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle,
    };
  }

  private ttsTimerDurationMs(): number | undefined {
    const seconds = this.ttsTimerMinutes * 60 + this.ttsTimerSeconds;
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  private coreRateForMultiplier(rate: number): number {
    return Math.max(1, Math.min(10, Math.round(rate * 5)));
  }

  private multiplierForCoreRate(rate: number): number {
    return Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX, rate / 5));
  }

  private logTtsFailure(operation: string, error: Error): void {
    console.error(`Reader TTS ${operation} failed: ${error.message}`);
    const current = this.ttsState;
    this.ttsState = {
      status: current.status,
      sessionGeneration: current.sessionGeneration,
      utteranceGeneration: current.utteranceGeneration,
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
    if (this.autoPageState.status === 'running') {
      this.pauseAutoPage('manual');
      return;
    }
    const startingNewSession = this.autoPageState.status === 'stopped';
    if (startingNewSession && this.ttsCoordinator !== undefined) {
      void this.ttsCoordinator.stop('user').catch((error: Error): void => this.logTtsFailure('stop', error));
    }
    this.autoPageState = this.autoPageState.status === 'paused' ?
      resumeReaderAutoPage(this.autoPageState) : startReaderAutoPage(this.autoPageState);
    this.hideControl();
    this.armAutoPageTimer(true);
    this.armAutoPageSessionTimer(startingNewSession);
  }

  private stopAutoPage(): void {
    this.autoPageState = stopReaderAutoPage(this.autoPageState, 'manual');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.resetAutoPageSessionDuration();
  }

  private changeAutoPageSpeed(deltaSeconds: number): void {
    const nextSpeed = Math.max(2, Math.min(30, this.autoPageState.speedSeconds + deltaSeconds));
    this.setAutoPageSpeed(nextSpeed);
  }

  private setAutoPageSpeed(nextSpeed: number): void {
    const normalized = Math.max(2, Math.min(20, Math.round(nextSpeed)));
    if (normalized === this.autoPageState.speedSeconds) {
      return;
    }
    this.autoPageState = setReaderAutoPageSpeed(this.autoPageState, normalized);
    this.autoPageFullConfiguration = setReaderAutoPageFullSpeed(
      this.autoPageFullConfiguration,
      normalized,
    );
    if (this.autoPageState.status === 'running' && !this.autoPageState.awaitingPageCommit) {
      this.armAutoPageTimer(true);
    }
  }

  private changeAutoPageSessionTimer(minutes: number, seconds: number): void {
    if (this.autoPageState.status !== 'stopped') {
      return;
    }
    this.autoPageFullConfiguration = normalizeReaderAutoPageFullConfiguration({
      timerMinutes: minutes,
      timerSeconds: seconds,
      speedSeconds: this.autoPageState.speedSeconds,
      followHighlight: this.autoPageFullConfiguration.followHighlight,
    });
    this.resetAutoPageSessionDuration();
  }

  private setAutoPageFollowHighlight(enabled: boolean): void {
    if (this.autoPageState.status !== 'stopped') {
      return;
    }
    this.autoPageFullConfiguration = setReaderAutoPageFullFollowHighlight(
      this.autoPageFullConfiguration,
      enabled,
    );
  }

  private pauseAutoPageForInteraction(): void {
    this.pauseAutoPage('touch');
  }

  private pauseAutoPage(reason: ReaderAutoPagePauseReason): void {
    if (this.autoPageState.status !== 'running') {
      return;
    }
    this.captureAutoPageRemaining();
    this.captureAutoPageSessionRemaining();
    const configuredSessionSeconds = readerAutoPageFullTimerDurationSeconds(
      this.autoPageFullConfiguration,
    );
    if (configuredSessionSeconds > 0 && this.autoPageSessionRemainingSeconds <= 0) {
      // The session deadline owns the terminal transition. A background or
      // touch event delivered at the same instant must not turn an expired
      // session into a resumable paused session.
      this.autoPageState = stopReaderAutoPage(this.autoPageState, 'manual');
      this.clearAutoPageTimer();
      this.clearAutoPageSessionTimer();
      return;
    }
    this.autoPageState = pauseReaderAutoPage(this.autoPageState, reason);
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer(false);
  }

  private captureAutoPageRemaining(): void {
    if (this.autoPageDeadlineMs <= 0 || this.autoPageState.awaitingPageCommit) {
      return;
    }
    const remaining = Math.max(0, Math.ceil((this.autoPageDeadlineMs - Date.now()) / 1000));
    const elapsed = this.autoPageState.remainingSeconds - remaining;
    if (elapsed > 0) {
      this.autoPageState = tickReaderAutoPage(
        this.autoPageState,
        this.autoPageState.generation,
        elapsed,
      );
    }
  }

  private armAutoPageTimer(resetDeadline: boolean): void {
    this.clearAutoPageTimer(false);
    if (!this.mounted || !this.appForeground || this.exitRequested ||
      this.autoPageState.status !== 'running' || this.autoPageState.awaitingPageCommit ||
      this.phase !== 'ready') {
      return;
    }
    const now = Date.now();
    if (resetDeadline || this.autoPageDeadlineMs <= now) {
      this.autoPageDeadlineMs = now + (this.autoPageState.remainingSeconds * 1000);
    }
    const generation = this.autoPageState.generation;
    this.autoPageTimerGeneration = generation;
    const delay = Math.max(1, Math.min(1000, this.autoPageDeadlineMs - now));
    this.autoPageTimer = setTimeout((): void => this.onAutoPageTimer(generation), delay);
  }

  private onAutoPageTimer(generation: number): void {
    this.autoPageTimer = -1;
    if (generation !== this.autoPageTimerGeneration || generation !== this.autoPageState.generation ||
      !this.mounted || !this.appForeground || this.autoPageState.status !== 'running') {
      return;
    }
    const remaining = Math.max(0, Math.ceil((this.autoPageDeadlineMs - Date.now()) / 1000));
    const elapsed = this.autoPageState.remainingSeconds - remaining;
    if (elapsed > 0) {
      this.autoPageState = tickReaderAutoPage(this.autoPageState, generation, elapsed);
    }
    if (isReaderAutoPageTurnDue(this.autoPageState)) {
      this.requestAutoPageTurn(generation);
      return;
    }
    this.armAutoPageTimer(false);
  }

  private requestAutoPageTurn(generation: number): void {
    if (generation !== this.autoPageState.generation || !isReaderAutoPageTurnDue(this.autoPageState)) {
      return;
    }
    const result = this.turnNextPage();
    if (result === 'bookEnd') {
      this.autoPageState = endReaderAutoPageAtBookEnd(this.autoPageState, generation);
      this.clearAutoPageTimer();
      this.clearAutoPageSessionTimer();
      return;
    }
    if (result === 'busy') {
      this.autoPageTimerGeneration = generation;
      this.autoPageTimer = setTimeout((): void => this.requestAutoPageTurn(generation), 250);
    }
  }

  private onAutoPagePageCommitted(): void {
    if (this.autoPageState.awaitingPageCommit) {
      const generation = this.autoPageState.generation;
      this.autoPageState = commitReaderAutoPageTurn(this.autoPageState, generation);
    }
    if (this.autoPageState.status === 'running') {
      this.armAutoPageTimer(true);
    }
  }

  private clearAutoPageTimer(resetDeadline: boolean = true): void {
    if (this.autoPageTimer >= 0) {
      clearTimeout(this.autoPageTimer);
      this.autoPageTimer = -1;
    }
    this.autoPageTimerGeneration = -1;
    if (resetDeadline) {
      this.autoPageDeadlineMs = 0;
    }
  }

  private resetAutoPageSessionDuration(): void {
    this.autoPageSessionRemainingSeconds = readerAutoPageFullTimerDurationSeconds(
      this.autoPageFullConfiguration,
    );
  }

  private captureAutoPageSessionRemaining(): void {
    if (this.autoPageSessionDeadlineMs <= 0 || this.autoPageSessionRemainingSeconds <= 0) {
      return;
    }
    this.autoPageSessionRemainingSeconds = Math.max(
      0,
      Math.ceil((this.autoPageSessionDeadlineMs - Date.now()) / 1000),
    );
  }

  private armAutoPageSessionTimer(resetDeadline: boolean): void {
    this.clearAutoPageSessionTimer(false);
    const configuredSeconds = readerAutoPageFullTimerDurationSeconds(this.autoPageFullConfiguration);
    if (configuredSeconds <= 0 || !this.mounted || !this.appForeground || this.exitRequested ||
      this.autoPageState.status !== 'running') {
      return;
    }
    if (resetDeadline) {
      this.autoPageSessionRemainingSeconds = configuredSeconds;
    } else if (this.autoPageSessionRemainingSeconds <= 0) {
      // Only a stopped -> running transition may reset the configured
      // duration. Resuming an expired pause is terminal, never a new session.
      this.autoPageState = stopReaderAutoPage(this.autoPageState, 'manual');
      this.clearAutoPageTimer();
      this.clearAutoPageSessionTimer();
      return;
    }
    const now = Date.now();
    if (resetDeadline || this.autoPageSessionDeadlineMs <= now) {
      this.autoPageSessionDeadlineMs = now + (this.autoPageSessionRemainingSeconds * 1000);
    }
    const generation = this.autoPageSessionTimerGeneration;
    const delay = Math.max(1, Math.min(1000, this.autoPageSessionDeadlineMs - now));
    this.autoPageSessionTimer = setTimeout(
      (): void => this.onAutoPageSessionTimer(generation),
      delay,
    );
  }

  private onAutoPageSessionTimer(generation: number): void {
    this.autoPageSessionTimer = -1;
    if (generation !== this.autoPageSessionTimerGeneration || !this.mounted || !this.appForeground ||
      this.autoPageState.status !== 'running') {
      return;
    }
    this.captureAutoPageSessionRemaining();
    if (this.autoPageSessionRemainingSeconds <= 0) {
      // ReaderAutoPageState intentionally exposes no timer-specific stop
      // enum. The session owner still performs a real deterministic stop;
      // only the diagnostic reason shares the existing manual terminal.
      this.autoPageState = stopReaderAutoPage(this.autoPageState, 'manual');
      this.clearAutoPageTimer();
      this.clearAutoPageSessionTimer();
      return;
    }
    this.armAutoPageSessionTimer(false);
  }

  private clearAutoPageSessionTimer(resetDeadline: boolean = true): void {
    if (this.autoPageSessionTimer >= 0) {
      clearTimeout(this.autoPageSessionTimer);
      this.autoPageSessionTimer = -1;
    }
    this.autoPageSessionTimerGeneration += 1;
    if (this.autoPageSessionTimerGeneration >= Number.MAX_SAFE_INTEGER) {
      this.autoPageSessionTimerGeneration = 1;
    }
    if (resetDeadline) {
      this.autoPageSessionDeadlineMs = 0;
    }
  }

  private onAppForegroundChanged(): void {
    if (!this.appForeground) {
      this.captureReadingRecordElapsed(false);
      this.clearReadingRecordTimer();
      void this.flushReadingRecord();
      this.pauseAutoPage('background');
      const coordinator = this.ttsCoordinator;
      if (coordinator !== undefined &&
        !ReaderRuntimeOwner.current().getTtsHost().isBackgroundPlaybackActive()) {
        void coordinator.pauseForBackground()
          .catch((error: Error): void => this.logTtsFailure('background pause', error));
      }
      return;
    }
    if (this.phase === 'ready') {
      this.beginReadingRecordClock(this.lifecycleToken);
    }
  }

  private beginReadingRecordClock(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken) || !this.appForeground || this.exitRequested) {
      return;
    }
    if (this.readingRecordActiveSinceMs <= 0) {
      this.readingRecordActiveSinceMs = Date.now();
    }
    this.armReadingRecordTimer(lifecycleToken);
  }

  private armReadingRecordTimer(lifecycleToken: number): void {
    this.clearReadingRecordTimer();
    if (!this.isSessionActive(lifecycleToken) || this.readingRecordActiveSinceMs <= 0) {
      return;
    }
    this.readingRecordTimer = setTimeout((): void => {
      this.readingRecordTimer = -1;
      if (!this.isSessionActive(lifecycleToken) || !this.appForeground || this.exitRequested) {
        return;
      }
      this.captureReadingRecordElapsed(true);
      void this.flushReadingRecord();
      this.armReadingRecordTimer(lifecycleToken);
    }, READING_RECORD_FLUSH_INTERVAL_MS);
  }

  private clearReadingRecordTimer(): void {
    if (this.readingRecordTimer >= 0) {
      clearTimeout(this.readingRecordTimer);
      this.readingRecordTimer = -1;
    }
  }

  private captureReadingRecordElapsed(continueClock: boolean): void {
    if (this.readingRecordActiveSinceMs <= 0) {
      return;
    }
    const now = Date.now();
    const elapsed = Math.max(0, now - this.readingRecordActiveSinceMs);
    this.readingRecordActiveSinceMs = continueClock ? now : 0;
    if (elapsed <= 0) {
      return;
    }
    const accumulated = this.readingRecordPendingMillis + elapsed;
    this.readingRecordPendingMillis = Number.isSafeInteger(accumulated) ? accumulated : Number.MAX_SAFE_INTEGER;
  }

  private flushReadingRecord(): Promise<void> {
    if (this.readingRecordPendingMillis <= 0) {
      return this.readingRecordFlushTail;
    }
    const elapsedMillis = this.readingRecordPendingMillis;
    const readAt = Date.now();
    const bookName = this.bookTitle.trim().length > 0 ? this.bookTitle.trim() : this.bookId;
    const lifecycleToken = this.lifecycleToken;
    this.readingRecordPendingMillis = 0;
    this.readingRecordFlushTail = this.readingRecordFlushTail
      .then(async (): Promise<void> => {
        await this.readingRecordGateway.accumulate(bookName, elapsedMillis, readAt);
      })
      .catch((error: Error): void => {
        if (this.isMountedToken(lifecycleToken) && !this.exitDelivered) {
          const restored = this.readingRecordPendingMillis + elapsedMillis;
          this.readingRecordPendingMillis = Number.isSafeInteger(restored) ? restored : Number.MAX_SAFE_INTEGER;
        }
        console.error(`ReadingExperience read-record flush failed: ${this.errorMessage(error)}`);
      });
    return this.readingRecordFlushTail;
  }

  private async flushReadingRecordForExit(): Promise<void> {
    await this.flushReadingRecord();
    // One bounded retry covers a transient Core transaction boundary while
    // preserving the exit guarantee that no new write starts after unmount.
    if (this.readingRecordPendingMillis > 0) {
      await this.flushReadingRecord();
    }
  }

  private onControlObscuredChanged(): void {
    if (this.controlObscured) {
      this.pauseAutoPage('touch');
    }
  }

  private setControlPage(page: ReaderControlPage): void {
    if (page !== 'quickSearch') {
      this.searchGeneration += 1;
    }
    if (page !== 'quickReplace') {
      this.replacePanelGeneration += 1;
    }
    this.controlPage = page;
  }

  private async loadAppearanceSnapshot(lifecycleToken: number): Promise<void> {
    const mutationGeneration = this.appearanceMutationGeneration;
    try {
      const snapshot = await this.appearanceGateway.load();
      if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.appearanceMutationGeneration) {
        return;
      }
      this.admitAppearanceSnapshot(snapshot);
    } catch (_error) {
      // Figma defines no Appearance loading/error surface. Keep the exact
      // default state already rendered by the approved component.
    }
  }

  private async loadChineseConversionMode(lifecycleToken: number): Promise<void> {
    const mutationGeneration = this.chineseConversionMutationGeneration;
    try {
      const mode = await this.chineseConversionGateway.getMode();
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.chineseConversionMutationGeneration) {
        return;
      }
      this.chineseConversionMode = mode;
    } catch (_error) {
      // Core defaults to no conversion. Keep the already-rendered mode when
      // startup is unavailable; the reading error boundary remains unchanged.
    }
  }

  private changeChineseConversionMode(mode: ReaderChineseConversionMode): void {
    if (mode === this.chineseConversionMode || !this.mounted) {
      return;
    }
    this.chineseConversionMutationGeneration = this.chineseConversionMutationGeneration >=
      Number.MAX_SAFE_INTEGER ? 1 : this.chineseConversionMutationGeneration + 1;
    const generation = this.chineseConversionMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    void this.chineseConversionGateway.putMode(mode)
      .then((storedMode: ReaderChineseConversionMode): void => {
        if (!this.isSessionActive(lifecycleToken) ||
          generation !== this.chineseConversionMutationGeneration) {
          return;
        }
        this.chineseConversionMode = storedMode;
        this.searchGeneration += 1;
        const chapter = this.chapter;
        if (chapter === undefined) {
          return;
        }
        const chapterIndex = chapter.chapterIndex;
        const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
          generation === this.chineseConversionMutationGeneration;
        void this.activeGateway().loadToc(this.bookId, isCurrent)
          .then((toc: LocalReadingToc): void => {
            if (!isCurrent()) {
              return;
            }
            this.tocEntries = toc.entries;
            this.onDirectoryProjectionChanged(toc.entries);
            this.reloadCurrentChapterAfterContentProjectionChange(lifecycleToken, chapterIndex);
          })
          .catch((_error: Error): void => {
            if (isCurrent()) {
              this.reloadCurrentChapterAfterContentProjectionChange(lifecycleToken, chapterIndex);
            }
          });
      })
      .catch((_error: Error): void => {
        // Do not admit an unpersisted mode. The selector stays on Core's last
        // confirmed setting and can be retried without creating a second store.
      });
  }

  private async loadReaderSettingsSnapshot(lifecycleToken: number): Promise<void> {
    const mutationGeneration = this.readerSettingsMutationGeneration;
    try {
      const snapshot = await this.readerSettingsGateway.load();
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.readerSettingsMutationGeneration) {
        return;
      }
      this.readerSettingsSnapshot = snapshot;
    } catch (_error) {
      // Figma defines no Settings loading/error surface. Keep the exact
      // default state already rendered by the approved component.
    }
  }

  private changeReaderSetting(key: ReaderSettingsToggleKey, value: boolean): void {
    const snapshot = setReaderSettingsToggle(this.readerSettingsSnapshot, key, value);
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    this.readerSettingsSnapshot = snapshot;
    void this.readerSettingsGateway.update(snapshot).catch((_error: Error): void => {
      // The admitted local state remains usable; Figma provides no inline
      // persistence-failure state to add to the Settings sheet.
    });
  }

  private changeAppearanceTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceSnapshot(setReaderAppearanceTheme(this.appearanceSnapshot, theme));
  }

  private changeAppearanceDayTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceSnapshot(setReaderAppearanceDayTheme(this.appearanceSnapshot, theme));
  }

  private changeAppearanceNightTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceSnapshot(setReaderAppearanceNightTheme(this.appearanceSnapshot, theme));
  }

  private changeAppearanceFont(font: ReaderAppearanceFont): void {
    this.commitAppearanceSnapshot(setReaderAppearanceFont(this.appearanceSnapshot, font));
  }

  private changeAppearanceIndent(indent: ReaderAppearanceIndent): void {
    this.commitAppearanceSnapshot(setReaderAppearanceIndent(this.appearanceSnapshot, indent));
  }

  private toggleAppearanceAlignment(current: ReaderAppearanceAlignment): void {
    const next: ReaderAppearanceAlignment = current === 'start' ? 'justify' : 'start';
    this.commitAppearanceSnapshot(setReaderAppearanceAlignment(this.appearanceSnapshot, next));
  }

  private stepAppearanceMetric(
    metric: ReaderAppearanceMetric,
    direction: ReaderAppearanceStepDirection,
  ): void {
    let value = 0;
    if (metric === 'fontSize') {
      value = Math.max(READER_APPEARANCE_FONT_SIZE_STEP,
        this.appearanceSnapshot.fontSize + direction * READER_APPEARANCE_FONT_SIZE_STEP);
    } else if (metric === 'lineHeightMultiplier') {
      value = Math.max(READER_APPEARANCE_LINE_HEIGHT_STEP, this.roundAppearanceMetric(
        this.appearanceSnapshot.lineHeightMultiplier + direction * READER_APPEARANCE_LINE_HEIGHT_STEP,
      ));
    } else if (metric === 'paragraphSpacing') {
      value = Math.max(0,
        this.appearanceSnapshot.paragraphSpacing + direction * READER_APPEARANCE_PARAGRAPH_SPACING_STEP);
    } else {
      value = this.roundAppearanceMetric(
        this.appearanceSnapshot.letterSpacing + direction * READER_APPEARANCE_LETTER_SPACING_STEP,
      );
    }
    this.commitAppearanceSnapshot(setReaderAppearanceMetric(this.appearanceSnapshot, metric, value));
  }

  private roundAppearanceMetric(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private commitAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): void {
    this.appearanceMutationGeneration = this.appearanceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceMutationGeneration + 1;
    this.admitAppearanceSnapshot(snapshot);
    void this.appearanceGateway.update(snapshot).catch((_error: Error): void => {
      // The admitted visual state remains usable. Figma provides no inline
      // persistence-failure state to invent inside either Appearance panel.
    });
  }

  private admitAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): void {
    const previous = this.appearanceSnapshot;
    const layoutChanged = !this.sameAppearanceLayout(previous, snapshot);
    const previousLayoutSignature = layoutChanged && this.hasMeasuredViewport() ?
      this.paginationLayoutSignature() : undefined;
    const currentVisibleAnchor = this.visiblePage !== undefined &&
      this.visiblePageSelectionToken === this.materializedChapterSelectionToken ?
      this.visiblePage.startScalar : this.desiredChapterOffset;

    this.appearanceSnapshot = snapshot;
    if (!layoutChanged) {
      return;
    }
    if (previousLayoutSignature !== undefined && previousLayoutSignature !== this.paginationLayoutSignature()) {
      this.paginationIndex.invalidateLayout(this.sourceId, this.bookId, previousLayoutSignature);
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

  private sameAppearanceLayout(
    left: ReaderAppearanceSnapshot,
    right: ReaderAppearanceSnapshot,
  ): boolean {
    return left.font === right.font && left.fontSize === right.fontSize &&
      left.lineHeightMultiplier === right.lineHeightMultiplier &&
      left.paragraphSpacing === right.paragraphSpacing && left.letterSpacing === right.letterSpacing &&
      left.indent === right.indent && left.alignment === right.alignment;
  }

  private hideControl(): void {
    this.searchGeneration += 1;
    this.replacePanelGeneration += 1;
    this.controlPage = 'home';
    this.controlVisible = false;
  }

  private reloadCurrentChapterAfterContentProjectionChange(
    lifecycleToken: number,
    chapterIndex: number,
  ): void {
    if (!this.isSessionActive(lifecycleToken) || this.chapter?.chapterIndex !== chapterIndex) {
      return;
    }
    this.contentMetrics = undefined;
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
    this.chapterWindow.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.resetPaginationDraft();
    const page = this.visiblePage;
    if (page !== undefined) {
      this.selectChapterAnchor(chapterIndex, page.startScalar, false);
    }
  }

  private openQuickReplace(): void {
    if (!this.mounted || !this.controlVisible || this.controlPage !== 'home') {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const panelGeneration = this.replacePanelGeneration + 1;
    this.replacePanelGeneration = panelGeneration;
    void this.replaceGateway.load()
      .then((state: ReaderReplaceQuickState): void => {
        if (!this.isSessionActive(lifecycleToken) || panelGeneration !== this.replacePanelGeneration ||
          !this.controlVisible || this.controlPage !== 'home' || state.kind !== 'ready') {
          return;
        }
        this.replaceState = state;
        if (this.reduceMotion) {
          this.controlPage = 'quickReplace';
          return;
        }
        this.getUIContext().animateTo(motionAnimateParam('reader.quick.promote'), (): void => {
          this.controlPage = 'quickReplace';
        });
      })
      .catch((_error: Error): void => {
        // Quick Replace has no Figma loading/empty/error state. Keep Control
        // Home visible and retain the last admitted panel state.
      });
  }

  private openRulesManagement(): void {
    if (!this.mounted || !this.controlVisible || this.controlPage !== 'quickReplace') {
      return;
    }
    this.hideControl();
    this.onOpenRulesManagement();
  }

  private toggleQuickReplaceRule(ruleId: number, isEnabled: boolean): void {
    if (!this.mounted || !this.controlVisible || this.controlPage !== 'quickReplace' ||
      this.replaceState.kind !== 'ready') {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    const mutationGeneration = this.beginReplaceMutation(lifecycleToken, bookId, ruleId);
    if (mutationGeneration < 0) {
      return;
    }
    void this.replaceGateway.setRuleEnabled(ruleId, isEnabled)
      .then((confirmed): void => {
        if (!this.isReplaceMutationCurrent(mutationGeneration, lifecycleToken, bookId, ruleId)) {
          return;
        }
        // Panel closure invalidates only presentation work. The already
        // accepted Core mutation must still invalidate processed metrics and
        // pagination for its original mounted book/session.
        if (panelGeneration === this.replacePanelGeneration && this.controlVisible &&
          this.controlPage === 'quickReplace') {
          this.replaceState = replaceConfirmedReaderReplaceRule(this.replaceState, confirmed);
        }
        this.finishReplaceMutation(mutationGeneration, lifecycleToken, bookId, ruleId);
        this.reloadCurrentPageAfterReplacePersist(lifecycleToken, bookId);
      })
      .catch((_error: Error): void => {
        // Preserve the Core-confirmed visible switch state. Figma does not
        // define an inline failure variant. A failed persist releases only its
        // exact mutation owner and must never trigger a content reload.
        this.finishReplaceMutation(mutationGeneration, lifecycleToken, bookId, ruleId);
      });
  }

  private beginReplaceMutation(lifecycleToken: number, bookId: string, ruleId: number): number {
    if (this.replaceMutationActiveGeneration >= 0 &&
      this.replaceMutationActiveLifecycleToken === lifecycleToken &&
      this.replaceMutationActiveBookId === bookId) {
      // Keep one Core replace.persist transaction per book/session. Closing
      // and reopening the panel cannot release this owner or submit the same
      // rule again while its result is unresolved.
      return -1;
    }
    this.replaceMutationGeneration = this.replaceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.replaceMutationGeneration + 1;
    this.replaceMutationActiveGeneration = this.replaceMutationGeneration;
    this.replaceMutationActiveLifecycleToken = lifecycleToken;
    this.replaceMutationActiveBookId = bookId;
    this.replaceMutationActiveRuleId = ruleId;
    return this.replaceMutationActiveGeneration;
  }

  private isReplaceMutationCurrent(
    generation: number,
    lifecycleToken: number,
    bookId: string,
    ruleId: number,
  ): boolean {
    return this.isSessionActive(lifecycleToken) && this.bookId === bookId &&
      generation === this.replaceMutationActiveGeneration &&
      lifecycleToken === this.replaceMutationActiveLifecycleToken &&
      bookId === this.replaceMutationActiveBookId && ruleId === this.replaceMutationActiveRuleId;
  }

  private finishReplaceMutation(
    generation: number,
    lifecycleToken: number,
    bookId: string,
    ruleId: number,
  ): void {
    if (generation !== this.replaceMutationActiveGeneration ||
      lifecycleToken !== this.replaceMutationActiveLifecycleToken ||
      bookId !== this.replaceMutationActiveBookId || ruleId !== this.replaceMutationActiveRuleId) {
      return;
    }
    this.replaceMutationActiveGeneration = -1;
    this.replaceMutationActiveLifecycleToken = -1;
    this.replaceMutationActiveBookId = '';
    this.replaceMutationActiveRuleId = -1;
  }

  private invalidateReplaceMutationOwner(): void {
    this.replaceMutationGeneration = this.replaceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.replaceMutationGeneration + 1;
    this.replaceMutationActiveGeneration = -1;
    this.replaceMutationActiveLifecycleToken = -1;
    this.replaceMutationActiveBookId = '';
    this.replaceMutationActiveRuleId = -1;
  }

  private reloadCurrentPageAfterReplacePersist(lifecycleToken: number, bookId: string): void {
    if (!this.isSessionActive(lifecycleToken) || this.bookId !== bookId) {
      return;
    }
    // A rule update may change any chapter's processed scalar length even if
    // the currently visible chapter happens to retain the same count. Drop
    // the whole-book metrics and every physical-page manifest immediately.
    // This must happen even when the user closed the panel and started a page
    // turn before replace.persist returned.
    this.contentMetrics = undefined;
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
    this.chapterWindow.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.resetPaginationDraft();
    const chapter = this.chapter;
    const page = this.visiblePage;
    if (chapter === undefined || page === undefined) {
      // An already-running chapter selection will observe the cleared metrics
      // and revalidate its materialized body before it can become visible.
      return;
    }
    // Reuse the chapter-selection token boundary even when a page measurement
    // is underway; that makes every predecessor measurement unable to commit
    // content produced under the old replacement rule.
    this.selectChapterAnchor(chapter.chapterIndex, page.startScalar, false);
  }

  private refreshReaderBrightness(): void {
    const hostContext = this.getUIContext().getHostContext();
    if (hostContext === undefined) {
      return;
    }
    const generation = this.brightnessRequestGeneration + 1;
    this.brightnessRequestGeneration = generation;
    void window.getLastWindow(hostContext)
      .then((readerWindow: window.Window): void => {
        if (!this.mounted || generation !== this.brightnessRequestGeneration) {
          return;
        }
        const brightness = readerWindow.getWindowProperties().brightness;
        this.brightnessAutomatic = brightness < 0;
        if (brightness >= 0) {
          this.brightnessPercent = Math.max(READER_CONTROL_BRIGHTNESS_MIN,
            Math.min(READER_CONTROL_BRIGHTNESS_MAX,
              Math.round(brightness * READER_CONTROL_BRIGHTNESS_MAX)));
        }
      })
      .catch((error: Error): void => {
        console.error(`Reader brightness read failed: ${error.message}`);
      });
  }

  private setReaderBrightness(percent: number): void {
    const hostContext = this.getUIContext().getHostContext();
    if (hostContext === undefined) {
      return;
    }
    const normalized = Math.max(READER_CONTROL_BRIGHTNESS_MIN / READER_CONTROL_BRIGHTNESS_MAX,
      Math.min(1, percent / READER_CONTROL_BRIGHTNESS_MAX));
    const generation = this.brightnessRequestGeneration + 1;
    this.brightnessRequestGeneration = generation;
    void window.getLastWindow(hostContext)
      .then((readerWindow: window.Window): Promise<void> => readerWindow.setWindowBrightness(normalized))
      .then((): void => {
        if (!this.mounted || generation !== this.brightnessRequestGeneration) {
          return;
        }
        this.brightnessPercent = Math.round(normalized * 100);
        this.brightnessAutomatic = false;
        console.info(`Reader brightness applied: ${normalized.toFixed(2)}`);
      })
      .catch((error: Error): void => {
        console.error(`Reader brightness apply failed: ${error.message}`);
        this.refreshReaderBrightness();
      });
  }

  private setReaderAutomaticBrightness(): void {
    const hostContext = this.getUIContext().getHostContext();
    if (hostContext === undefined) {
      return;
    }
    const generation = this.brightnessRequestGeneration + 1;
    this.brightnessRequestGeneration = generation;
    void window.getLastWindow(hostContext)
      .then((readerWindow: window.Window): Promise<void> => readerWindow.setWindowBrightness(-1))
      .then((): void => {
        if (!this.mounted || generation !== this.brightnessRequestGeneration) {
          return;
        }
        this.brightnessAutomatic = true;
        console.info('Reader brightness restored to system automatic');
      })
      .catch((error: Error): void => {
        console.error(`Reader automatic brightness failed: ${error.message}`);
        this.refreshReaderBrightness();
      });
  }

  private updateQuickSearchQuery(query: string): void {
    if (query === this.quickSearchQuery) {
      return;
    }
    this.searchGeneration += 1;
    this.quickSearchQuery = query;
    this.quickSearchState = { kind: 'idle' };
  }

  private runQuickSearch(): void {
    const keyword = this.quickSearchQuery.trim();
    if (keyword.length === 0 || !this.controlVisible || this.controlPage !== 'quickSearch') {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const searchGeneration = this.searchGeneration + 1;
    this.searchGeneration = searchGeneration;
    this.quickSearchState = { kind: 'loading', keyword };
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      searchGeneration === this.searchGeneration && this.controlVisible && this.controlPage === 'quickSearch';
    void this.activeGateway().searchContent(this.bookId, keyword, 50, isCurrent)
      .then((results: ReadingContentSearchResult[]): void => {
        if (!isCurrent()) {
          return;
        }
        this.quickSearchState = results.length === 0 ?
          { kind: 'empty', keyword } : { kind: 'results', keyword, results };
      })
      .catch((error: Error): void => {
        if (!isCurrent()) {
          return;
        }
        this.quickSearchState = { kind: 'error', message: error.message };
      });
  }

  private selectSearchResult(result: ReadingContentSearchResult): void {
    if (result.bookId !== this.bookId || result.sourceId !== this.sourceId) {
      return;
    }
    this.selectChapterAnchor(result.chapterIndex, result.chapterOffset, false);
  }

  private selectControlChapter(chapterIndex: number): void {
    if (chapterIndex === this.currentChapterIndex()) {
      this.hideControl();
      return;
    }
    this.selectChapterAnchor(chapterIndex, 0, true);
  }

  private stepControlChapter(delta: number): void {
    const target = this.adjacentChapterIndex(this.currentChapterIndex(), delta);
    if (target !== undefined) {
      this.selectChapterAnchor(target, 0, true);
    }
  }

  private seekControlProgress(percent: number): void {
    const metrics = this.contentMetrics;
    if (!this.mounted) {
      return;
    }
    if (metrics !== undefined) {
      const anchor = wholeBookAnchorForPercent(metrics, percent);
      if (anchor !== undefined) {
        this.selectChapterAnchor(anchor.chapterIndex, anchor.chapterOffset, false);
      }
      return;
    }
    if (this.tocEntries.length === 0 || !Number.isFinite(percent)) {
      return;
    }
    const normalized = Math.max(0, Math.min(1, percent / 100));
    const scaled = normalized >= 1 ? this.tocEntries.length : normalized * this.tocEntries.length;
    const position = Math.min(this.tocEntries.length - 1, Math.floor(scaled));
    const chapterProgress = normalized >= 1 ? 1 : scaled - position;
    this.selectChapterAnchor(this.tocEntries[position].index, 0, false, true, chapterProgress);
  }

  private selectChapterAnchor(
    chapterIndex: number,
    chapterOffset: number,
    requireChapterStart: boolean,
    stopTts: boolean = true,
    requestedProgress?: number,
  ): void {
    if (!this.mounted || !this.isKnownControlChapter(chapterIndex)) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const coordinator = this.ttsCoordinator;
    if (stopTts && coordinator !== undefined) {
      void coordinator.stop('contentChanged').catch((error: Error): void => this.logTtsFailure('content stop', error));
    }
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    this.hideControl();
    void this.openChapter(
      chapterIndex,
      false,
      lifecycleToken,
      selectionToken,
      requireChapterStart ? 0 : (requestedProgress === undefined ? chapterOffset : undefined),
      requestedProgress,
    );
  }

  private turnNextPage(): ReaderPageTurnResult {
    if (!this.canTurnPage()) {
      return 'busy';
    }
    const page = this.visiblePage as PhysicalReadingPage;
    const chapter = this.chapter as ReadingSessionChapter;
    const nextOffset = page.endScalar;
    const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
    if (nextOffset <= lastVisible) {
      this.measureCommittedPageAt(nextOffset);
      return 'started';
    }
    const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
    if (nextChapter === undefined) {
      return 'bookEnd';
    }
    this.openPageTurnChapter(nextChapter, 0);
    return 'started';
  }

  private turnPreviousPage(): void {
    if (!this.canTurnPage()) {
      return;
    }
    const page = this.visiblePage as PhysicalReadingPage;
    const chapter = this.chapter as ReadingSessionChapter;
    const key = this.currentPaginationKey();
    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const containingPage = this.paginationIndex.findContainingPage(key, page.startScalar);
    if (containingPage === undefined) {
      const prefix = this.paginationDraft;
      const previousRequest = prefix !== undefined && prefix.matches(key) ?
        prefix.previousRequestForPageStart(page.startScalar) : undefined;
      if (previousRequest !== undefined) {
        // The prefix was measured continuously from chapter start under this
        // exact layout/content key. Reuse the original request that produced
        // the preceding physical page; never infer an unseen boundary.
        this.measureCommittedPageAt(previousRequest);
        return;
      }
      if (previousChapterIndex !== undefined && prefix !== undefined && prefix.matches(key) &&
        this.paragraphRanges.length > 0 &&
        prefix.startsAtRequest(this.paragraphRanges[0].startScalar) &&
        prefix.pageStartScalars()[0] === page.startScalar) {
        this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar);
        return;
      }
      // Restore/search/directory jumps deliberately have no chapter-head
      // prefix. Re-measure from the real chapter head behind the unchanged
      // committed page; the continuous prefix then yields an exact physical
      // predecessor without inventing a history stack or durable manifest.
      this.startCurrentChapterPredecessorMeasurement(chapter.chapterIndex, page.startScalar);
      return;
    }
    if (containingPage.pageIndex === 0 && previousChapterIndex !== undefined &&
      this.paginationKeyForChapter(previousChapterIndex) === undefined) {
      this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar);
      return;
    }
    const previousChapterKey = containingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
      this.paginationKeyForChapter(previousChapterIndex) as ReadingPaginationKey : null;
    const previous = this.paginationIndex.findPreviousPage(key, page.startScalar, previousChapterKey);
    if (previous.kind === 'manifestRequired' && previousChapterIndex !== undefined &&
      previous.key.chapterIndex === previousChapterIndex) {
      this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar);
      return;
    }
    if (previous.kind !== 'page') {
      return;
    }
    if (previous.page.key.chapterIndex === chapter.chapterIndex) {
      this.measureCommittedPageAt(previous.page.startScalar);
      return;
    }
    this.openPageTurnChapter(previous.page.key.chapterIndex, previous.page.startScalar);
  }

  private turnToPreviousChapter(
    previousChapterIndex: number,
    originalChapterIndex: number,
    originalChapterOffset: number,
  ): void {
    const previousKey = this.paginationKeyForChapter(previousChapterIndex);
    if (previousKey !== undefined) {
      const lastPage = this.paginationIndex.findLastPage(previousKey);
      if (lastPage !== undefined) {
        this.openPageTurnChapter(previousChapterIndex, lastPage.startScalar);
        return;
      }
    }
    this.startPreviousChapterMeasurement(
      previousChapterIndex,
      originalChapterIndex,
      originalChapterOffset,
    );
  }

  private startPreviousChapterMeasurement(
    previousChapterIndex: number,
    originalChapterIndex: number,
    originalChapterOffset: number,
  ): void {
    if (!this.mounted || this.previousChapterMeasurement !== undefined ||
      !this.isKnownControlChapter(previousChapterIndex)) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      originalChapterIndex,
      originalChapterOffset,
      previousChapterIndex,
    );
    this.restoredProgress = undefined;
    // The current committed page remains visible, so the per-page measurement
    // deadline is sufficient; do not arm the first-entry blank-screen deadline.
    void this.openChapter(previousChapterIndex, false, lifecycleToken, selectionToken, 0);
  }

  private startCurrentChapterPredecessorMeasurement(
    chapterIndex: number,
    originalChapterOffset: number,
  ): void {
    if (!this.mounted || this.previousChapterMeasurement !== undefined ||
      this.chapter === undefined || this.chapter.chapterIndex !== chapterIndex ||
      this.paragraphRanges.length === 0) {
      return;
    }
    this.resetPaginationDraft();
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapterIndex,
      originalChapterOffset,
      chapterIndex,
    );
    this.desiredChapterOffset = this.paragraphRanges[0].startScalar;
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
    this.beginMeasurement(this.lifecycleToken);
  }

  private canTurnPage(): boolean {
    return this.mounted && !this.controlVisible && this.phase === 'ready' && !this.measurementCompleting &&
      !this.commitInFlight && this.visiblePage !== undefined && this.chapter !== undefined &&
      this.visiblePageSelectionToken === this.chapterSelectionToken &&
      this.materializedChapterSelectionToken === this.chapterSelectionToken;
  }

  private measureCommittedPageAt(chapterOffset: number): void {
    const chapterMap = this.requireChapterLayoutMap();
    const chapter = this.requireChapter();
    const lastVisible = this.lastVisibleScalar(chapter.content, chapterMap);
    this.desiredChapterOffset = Math.max(0, Math.min(lastVisible, chapterOffset));
    this.desiredChapterProgress = chapterMap.scalarCount() === 0 ? 0 :
      this.desiredChapterOffset / chapterMap.scalarCount();
    this.beginMeasurement(this.lifecycleToken);
  }

  private openPageTurnChapter(chapterIndex: number, chapterOffset: number): void {
    if (!this.mounted || !this.isKnownControlChapter(chapterIndex)) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(chapterIndex, false, lifecycleToken, selectionToken, chapterOffset);
  }

  private adjacentChapterIndex(chapterIndex: number, delta: number): number | undefined {
    for (let position = 0; position < this.tocEntries.length; position += 1) {
      if (this.tocEntries[position].index !== chapterIndex) {
        continue;
      }
      const target = position + delta;
      return target >= 0 && target < this.tocEntries.length ? this.tocEntries[target].index : undefined;
    }
    return undefined;
  }

  private isKnownControlChapter(chapterIndex: number): boolean {
    for (const entry of this.tocEntries) {
      if (entry.index === chapterIndex) {
        return true;
      }
    }
    return false;
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
    return this.isSessionActive(lifecycleToken) && generation === this.measurementGeneration &&
      selectionToken === this.measurementSelectionToken && this.isSelectionCurrent(selectionToken) &&
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

  private isMountedToken(lifecycleToken: number): boolean {
    return this.mounted && lifecycleToken === this.lifecycleToken;
  }

  private isSessionActive(lifecycleToken: number): boolean {
    return this.isMountedToken(lifecycleToken) && !this.exitRequested;
  }

  private recoverPreviousChapterMeasurement(error: Error, lifecycleToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isSessionActive(lifecycleToken)) {
      return;
    }
    console.error(`ReadingExperience previous chapter measurement failed: ${this.errorMessage(error)}`);
    this.previousChapterMeasurement = undefined;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
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
    if (this.previousChapterMeasurement !== undefined) {
      this.recoverPreviousChapterMeasurement(error, lifecycleToken);
      return;
    }
    this.failureCode = this.errorMessage(error);
    this.autoPageState = stopReaderAutoPage(this.autoPageState, 'lifecycle');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    this.phase = 'failed';
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.resetPaginationDraft();
    this.measurementGeneration += 1;
    this.measurementSelectionToken = -1;
    console.error(`ReadingExperience failed: ${this.failureCode}`);
    this.onReadingFailure(this.sourceId, this.bookId, this.failureCode);
    // Figma has no admitted error surface. Leave via the same serialized exit
    // path instead of retaining a blank/failed page.
    this.beginExit();
  }

  private errorMessage(error: Error): string {
    return error.message;
  }
}
