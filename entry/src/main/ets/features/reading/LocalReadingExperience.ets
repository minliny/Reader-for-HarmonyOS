import { errorMessageOf } from '../../app/ErrorMessage';
import {
  type LocalReadingAnchor,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingToc,
  type LocalReadingTocEntry,
} from './LocalReadingFlowGateway';
import { hilog } from '@kit.PerformanceAnalysisKit';
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
import { ReadingSurfacePageFragment } from './ReadingSurface';
import { ReaderPageInteractionLayer } from './ReaderPageInteractionLayer';
import {
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
  ReaderPageTurnRenderPage,
  ReaderPageTurnStage,
} from './ReaderPageTurnStage';
import {
  BookTurnTextureBuildInput,
  BookTurnTextureBuilder,
} from './BookTurnTextureBuilder';
import { ReaderBookTurnSurface } from './ReaderBookTurnSurface';
import {
  BOOK_TURN_EVENT_RENDER_FAILURE,
  BOOK_TURN_EVENT_ROLLBACK_COMPLETE,
  BOOK_TURN_EVENT_SLOTS_COMMITTED,
  BOOK_TURN_EVENT_SURFACE_LOST,
  BOOK_TURN_EVENT_SURFACE_READY,
  BOOK_TURN_EVENT_TEXTURE_READY,
  BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT,
  BOOK_TURN_TEXTURE_CURRENT,
  BOOK_TURN_TEXTURE_NEXT,
  BOOK_TURN_TEXTURE_PREVIOUS,
  BookTurnNativeEvent,
  BookTurnPresentationSession,
  type BookTurnTextureSlot,
} from './BookTurnPresentationSession';
import {
  beginBookTurnMotion,
  bookTurnInput,
  stopBookTurnMotion,
  updateBookTurnMotionInPlace,
  type BookTurnMotionState,
} from './BookTurnMotionState';
import { ReaderContinuousReadingStage } from './ReaderContinuousReadingStage';
import { ReaderControlPanel, type ReaderControlPage } from './ReaderControlPanel';
import {
  READER_SESSION_CAPSULE_HEIGHT,
  ReaderSessionCapsule,
  readerSessionCapsuleMinimumWidth,
} from './ReaderSessionCapsule';
import {
  deriveReaderSessionCapsule,
  readerTtsSessionBlocksAutoPageStart,
  type ReaderSessionCapsuleSnapshot,
  type ReaderSessionCapsuleType,
} from './ReaderSessionCapsuleModel';
import {
  ReaderPageChromeSnapshot,
  ReaderPageOrdinal,
  formatReaderPageClock,
  formatReaderPageOrdinal,
  formatReaderPageProgress,
} from './ReaderPageChromeModel';
import {
  ReaderPageChromeMeasurements,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';
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
  retryReaderAutoPageTurn,
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
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from './ReaderDirectoryMarkerState';
import { ReaderReplaceQuickGateway, type ReaderReplacePreview } from './ReaderReplaceQuickGateway';
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
import {
  collectReadingParagraphUtf16Ranges,
  readingParagraphBoundaryMode,
} from './ReadingParagraphProjection';
import { registerReaderFonts } from '../common/ReaderFonts';
import { motionAnimateParam, motionRemainingDistanceAnimateParam } from '../common/MotionSpec';
import { ComponentContent, FrameCallback, window } from '@kit.ArkUI';
import { image } from '@kit.ImageKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderReadingSystemEventHost } from '../../app/ReaderReadingSystemEventHost';
import {
  ReaderWindowChromeStyle,
  ReaderWindowCoordinator,
  ReaderWindowPolicy,
} from '../../app/ReaderWindowCoordinator';
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
import { ReaderTtsPreferencesGateway } from './ReaderTtsPreferencesGateway';
import {
  type ReaderTtsPreferencesSnapshot,
  type ReaderTtsVoiceOption,
} from './ReaderTtsPreferencesState';
import { ReaderAppearanceGateway } from './ReaderAppearanceGateway';
import {
  ReaderChineseConversionGateway,
  type ReaderChineseConversionMode,
} from './ReaderChineseConversionGateway';
import {
  createDefaultReaderAppearanceSnapshot,
  readerAppearanceMetricRange,
  setReaderAppearanceAlignment,
  setReaderAppearanceCustomFont,
  setReaderAppearanceDayTheme,
  setReaderAppearanceFont,
  setReaderAppearanceFontOrder,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import {
  readerAppearanceChromeTone,
  readerAppearanceSnapshotFontFamily,
  readerAppearanceFontScale,
  readerAppearanceLineHeight,
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
} from './ReaderAppearanceRenderStyle';
import {
  READER_PHONE_REFERENCE_HEIGHT,
  READER_PHONE_REFERENCE_WIDTH,
  READER_TABLET_REFERENCE_HEIGHT,
  READER_TABLET_REFERENCE_WIDTH,
  ReaderControlLayoutSnapshot,
  ReaderReadingLayoutSnapshot,
  resolveReaderControlLayout,
  resolveReaderReadingLayout,
} from './ReaderLayoutGeometry';
import { ReaderSettingsGateway } from './ReaderSettingsGateway';
import { ReaderScreenAwakeLease } from './ReaderScreenAwakeLease';
import { readerPageBottomJustifyGap } from './ReaderPageBottomJustify';
import { ReadingRecordGateway } from './ReadingRecordGateway';
import {
  createDefaultReaderSettingsSnapshot,
  normalizeReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
  type ReaderPageTurnStyle,
  type ReaderScreenDirection,
  type ReaderScreenTimeout,
  type ReaderSettingsSnapshot,
  type ReaderSettingsToggleKey,
} from './ReaderSettingsState';

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
  contentHeight: number;
  bodyCapacity: number;

  constructor(
    fragments: ReadingSurfacePageFragment[],
    startScalar: number,
    endScalar: number,
    contentHeight: number,
    bodyCapacity: number,
  ) {
    this.fragments = fragments;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.contentHeight = contentHeight;
    this.bodyCapacity = bodyCapacity;
  }
}

/** Materialized chapter state temporarily swapped while an adjacent page is measured. */
class ReaderMaterializedChapterContext {
  chapter: ReadingSessionChapter;
  layoutMap: ReadingSurfaceLayoutMap;
  contentVersion: string;
  paragraphRanges: ParagraphRange[];
  paginationDraft: ReadingPaginationPrefix | undefined;
  desiredChapterOffset: number;
  desiredChapterProgress: number;
  measurementRequestedAnchorScalar: number;

  constructor(
    chapter: ReadingSessionChapter,
    layoutMap: ReadingSurfaceLayoutMap,
    contentVersion: string,
    paragraphRanges: ParagraphRange[],
    paginationDraft: ReadingPaginationPrefix | undefined,
    desiredChapterOffset: number,
    desiredChapterProgress: number,
    measurementRequestedAnchorScalar: number,
  ) {
    this.chapter = chapter;
    this.layoutMap = layoutMap;
    this.contentVersion = contentVersion;
    this.paragraphRanges = paragraphRanges;
    this.paginationDraft = paginationDraft;
    this.desiredChapterOffset = desiredChapterOffset;
    this.desiredChapterProgress = desiredChapterProgress;
    this.measurementRequestedAnchorScalar = measurementRequestedAnchorScalar;
  }
}

/** One measured adjacent page whose Core progress has not been changed yet. */
class PreparedReaderPageTurn {
  direction: ReaderPageTurnDirection;
  page: PhysicalReadingPage;
  context: ReaderMaterializedChapterContext;
  key: ReadingPaginationKey;
  originChapterIndex: number;
  originPageStartScalar: number;
  generation: number;

  constructor(
    direction: ReaderPageTurnDirection,
    page: PhysicalReadingPage,
    context: ReaderMaterializedChapterContext,
    key: ReadingPaginationKey,
    originChapterIndex: number,
    originPageStartScalar: number,
    generation: number,
  ) {
    this.direction = direction;
    this.page = page;
    this.context = context;
    this.key = key;
    this.originChapterIndex = originChapterIndex;
    this.originPageStartScalar = originPageStartScalar;
    this.generation = generation;
  }
}

class ReaderPageTurnPreparation {
  direction: ReaderPageTurnDirection;
  origin: ReaderMaterializedChapterContext;
  originChapterIndex: number;
  originPageStartScalar: number;
  generation: number;

  constructor(
    direction: ReaderPageTurnDirection,
    origin: ReaderMaterializedChapterContext,
    originChapterIndex: number,
    originPageStartScalar: number,
    generation: number,
  ) {
    this.direction = direction;
    this.origin = origin;
    this.originChapterIndex = originChapterIndex;
    this.originPageStartScalar = originPageStartScalar;
    this.generation = generation;
  }
}

class ReaderPageTurnTarget {
  chapterIndex: number;
  chapterOffset: number;

  constructor(chapterIndex: number, chapterOffset: number) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
  }
}

class ReaderDeferredChapterSelection {
  chapterIndex: number;
  chapterOffset: number;
  requireChapterStart: boolean;
  stopTts: boolean;
  requestedProgress: number | undefined;

  constructor(
    chapterIndex: number,
    chapterOffset: number,
    requireChapterStart: boolean,
    stopTts: boolean,
    requestedProgress: number | undefined,
  ) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.requireChapterStart = requireChapterStart;
    this.stopTts = stopTts;
    this.requestedProgress = requestedProgress;
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
  /** True when discovering a texture-ready predecessor without turning yet. */
  prepareOnly: boolean;
  origin: ReaderMaterializedChapterContext | undefined;
  pageTurnGeneration: number;

  constructor(
    originalChapterIndex: number,
    originalChapterOffset: number,
    targetChapterIndex: number,
    prepareOnly: boolean = false,
    origin?: ReaderMaterializedChapterContext,
    pageTurnGeneration: number = 0,
  ) {
    this.originalChapterIndex = originalChapterIndex;
    this.originalChapterOffset = originalChapterOffset;
    this.targetChapterIndex = targetChapterIndex;
    this.prepareOnly = prepareOnly;
    this.origin = origin;
    this.pageTurnGeneration = pageTurnGeneration;
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

class InitialReadingToc implements LocalReadingToc {
  bookId: string;
  entries: LocalReadingTocEntry[];

  constructor(bookId: string, entries: LocalReadingTocEntry[]) {
    this.bookId = bookId;
    this.entries = entries;
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
type ReaderPageTurnInputPhase = 'idle' | 'tracking' | 'dragging' | 'settling';
/**
 * Outcome of one preparation attempt: begun (measuring the target),
 * retry (transiently busy, re-drain with backoff), abandon (target does not
 * exist and no discovery lane exists for it).
 */
type ReaderPageTurnPreparationOutcome = 'begun' | 'retry' | 'abandon';

class ReaderUIFrameCallback extends FrameCallback {
  private readonly callback: () => void;

  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }

  onFrame(_frameTimeInNano: number): void {
    this.callback();
  }

  onIdle(_timeLeftInNano: number): void {}
}

const FIGMA_BODY_FONT_WEIGHT = 'regular';
const READER_APPEARANCE_FONT_SIZE_STEP = 2;
const READER_APPEARANCE_LINE_HEIGHT_STEP = 0.08;
const READER_APPEARANCE_PARAGRAPH_SPACING_STEP = 2;
const READER_APPEARANCE_LETTER_SPACING_STEP = 0.5;
const READING_WRITING_MODE = 'horizontal-tb';
const LOCAL_READING_SOURCE_ID = 'local';
const READER_BOOK_TURN_COMPONENT_ID = 'reader-book-turn-surface';
const READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID = 'reader-book-turn-current-page';
/** Contract ceiling for one prepared page texture before RGB8 upload. */
const READER_BOOK_TURN_TEXTURE_MAX_PIXELS = 3_000_000;
const UNICODE_PROBE = 'A😀B';
/** Stable empty input for the mounted-but-hidden Reader Control shell. */
const EMPTY_CONTROL_DIRECTORY_ENTRIES: LocalReadingTocEntry[] = [];
/** Engineering ceiling only; it has no visual meaning or design authority. */
const MAX_MEASUREMENT_BATCH_PARAGRAPHS = 8;
const MAX_MEASUREMENT_BATCH_UTF16 = 12 * 1024;
// Keep one lazy row close to one phone viewport. This bounds the error of the
// scalar-to-height interpolation used to restore an intra-row reading anchor.
const CONTINUOUS_FRAGMENT_MAX_UTF16 = 512;
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
/**
 * A settlement whose completing signal is lost (native visual endpoint,
 * slot-commit event, component swap, suspended frame, missing motion entry)
 * would otherwise leave pageTurnSettlementActive stuck true and brick reader
 * input. Both rollback and commit settlements, including the slot-commit wait,
 * complete well under 1s.
 */
const PAGE_TURN_SETTLEMENT_DEADLINE_MS = 2000;
/**
 * consumeMeasuredBatch cancels the layout deadline before completeFirstPage
 * resolves the location anchor (an online-source RPC that can suspend
 * indefinitely). Without a watchdog a suspended anchor leaves
 * measurementCompleting stuck true, canTurnPage false forever, and every
 * tap/drag silently dropped. Normal completion is well under 1s.
 */
const FIRST_PAGE_COMPLETION_DEADLINE_MS = 10000;
const FIRST_PAGE_COMPLETION_MAX_RETRIES = 3;
const PAGE_TURN_PREPARATION_RETRY_BASE_MS = 250;
const PAGE_TURN_PREPARATION_RETRY_MAX_MS = 2000;
const PAGE_TURN_PREPARATION_RETRY_LIMIT = 16;
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
  @StorageLink('readerWindowMetricsRevision') @Watch('onWindowMetricsRevisionChanged')
  readerWindowMetricsRevision: number = 0;
  @Prop sourceId: string = LOCAL_READING_SOURCE_ID;
  @Prop bookId: string;
  @Prop bookKind: string | undefined = undefined;
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop sourceSwitchTransactionId: string | undefined = undefined;
  @Prop @Watch('onRequestedChapterChanged') requestedChapterIndex: number | undefined = undefined;
  @Prop @Watch('onDeviceFormChanged') isTablet: boolean;
  @Prop @Watch('onWindowChromeActiveChanged') windowChromeActive: boolean = false;
  @Prop @Watch('onWindowChromeActiveChanged') windowChromeOverlayActive: boolean = false;
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
  onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest) => void =
    (_request: ReaderPageBookmarkToggleRequest): void => {};

  @State private phase: ReadingPhase = 'loading';
  @State private chapterTitle: string = '';
  @State private showChapterTitle: boolean = false;
  @State private visibleFragments: ReadingSurfacePageFragment[] = [];
  /**
   * Continuous content is a non-reactive, atomically replaced render
   * projection. `continuousRenderRevision` is its only ArkUI invalidation
   * signal, preventing a new chapter title from rendering with the previous
   * chapter's complex fragment array.
   */
  private continuousFragments: ReadingSurfacePageFragment[] = [];
  private continuousRenderChapterIdentity: string = 'continuous:empty';
  private continuousRenderChapterTitle: string = '';
  @State private continuousRenderRevision: number = 0;
  @State private continuousChangedFragmentIndex: number = -1;
  @State private continuousInitialFragmentIndex: number = 0;
  @State private continuousInitialFragmentProgress: number = 0;
  // Visible indices are progress cursors, not render inputs. Keeping them
  // non-reactive prevents every List settle callback from rebuilding the
  // entire reading stage and flashing the already rendered rows.
  private continuousVisibleFragmentIndex: number = 0;
  private continuousVisibleEndFragmentIndex: number = 0;
  @State private pageTurnOffsetX: number = 0;
  @State private pageTurnPresentationWidth: number = 0;
  @State private pageTurnDirection: ReaderPageTurnDirection | undefined = undefined;
  @State private pageTurnSettlementActive: boolean = false;
  @State private bookmarkPageOffsetY: number = 0;
  @State private bookmarkPreviewChanged: boolean = false;
  @State private bookTurnNativeRevision: number = 0;
  /** One reactive ownership bit; MOVE geometry itself remains non-reactive. */
  @State private pageTurnInputOwned: boolean = false;
  /** Assignment-only revision exposing non-reactive prepared page models to build(). */
  @State private pageTurnRenderRevision: number = 0;
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
  /** Directory/source-switch/hidden routes explicitly transfer pointer ownership away from the reader. */
  @Prop interactionBlocked: boolean = false;
  @State private controlVisible: boolean = false;
  @State private controlShellExitArmed: boolean = false;
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
  @State private ttsPauseOnInterruption: boolean = true;
  @State private ttsAllowMixing: boolean = false;
  @State private ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @State private ttsEngine: string = 'system';
  @State private ttsHttpEngines: ReaderHttpTtsConfig[] = [];
  @State private ttsVoiceOptions: ReaderTtsVoiceOption[] = [];
  @State private ttsLanguage: string = 'zh-CN';
  @State private ttsPerson: number = 0;
  @State private pageChromeClockText: string = formatReaderPageClock(Date.now());
  @State private sessionCapsuleMeasuredWidth: number = 0;
  @State private sessionCapsuleMeasuredHeight: number = READER_SESSION_CAPSULE_HEIGHT;

  private sessionGateway: ReadingSessionFlowGateway | undefined = undefined;
  private readonly replaceGateway: ReaderReplaceQuickGateway =
    new ReaderReplaceQuickGateway(ReaderRuntimeOwner.current());
  private readonly appearanceGateway: ReaderAppearanceGateway =
    new ReaderAppearanceGateway(ReaderRuntimeOwner.current());
  private readonly chineseConversionGateway: ReaderChineseConversionGateway =
    new ReaderChineseConversionGateway(ReaderRuntimeOwner.current());
  private readonly readerSettingsGateway: ReaderSettingsGateway =
    new ReaderSettingsGateway(ReaderRuntimeOwner.current());
  private readonly ttsPreferencesGateway: ReaderTtsPreferencesGateway =
    new ReaderTtsPreferencesGateway(ReaderRuntimeOwner.current());
  private screenAwakeLease: ReaderScreenAwakeLease | undefined = undefined;
  private screenAwakeKeepScreenOn: boolean = false;
  private readingSystemEventHost: ReaderReadingSystemEventHost | undefined = undefined;
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
  private continuousScroller: Scroller | undefined = undefined;
  private continuousVisibleScalar: number = 0;
  private continuousProgressRevision: number = 0;
  private continuousCommitInFlight: boolean = false;
  private continuousCommitPending: boolean = false;
  private continuousUserInteractionActive: boolean = false;
  private readonly continuousImageResolutions: Set<number> = new Set<number>();
  private readonly chapterImageByStartScalar: Map<number, ReadingSessionImage> =
    new Map<number, ReadingSessionImage>();
  private readonly chapterImagePositionByKey: Map<string, number> = new Map<string, number>();
  private readonly continuousFragmentIndexByStartScalar: Map<number, number> = new Map<number, number>();
  private preparedPreviousPage: PreparedReaderPageTurn | undefined = undefined;
  private preparedNextPage: PreparedReaderPageTurn | undefined = undefined;
  private pageTurnPreparation: ReaderPageTurnPreparation | undefined = undefined;
  private pageTurnPreparationQueue: ReaderPageTurnDirection[] = [];
  /** Latest manual request only; bounds rapid input without growing a work queue. */
  private pendingManualPageTurnIntent: ReaderPageTapIntent | undefined = undefined;
  private pendingPointerSegmentReserved: boolean = false;
  private pageTurnGeneration: number = 0;
  private controlShellExitGeneration: number = 0;
  private pageTurnGestureState: ReaderPageGestureState = createReaderPageGestureState();
  private readonly bookTurnSession: BookTurnPresentationSession =
    new BookTurnPresentationSession(READER_BOOK_TURN_COMPONENT_ID);
  private bookTurnMotion: BookTurnMotionState | undefined = undefined;
  private bookTurnTextureCaptureGeneration: number = 0;
  private bookTurnTextureCaptureScheduled: boolean = false;
  private bookTurnCapturedPreviousIdentity: string = '';
  private bookTurnCapturedCurrentIdentity: string = '';
  private bookTurnCapturedNextIdentity: string = '';
  /** Rare capability state; unlike MOVE geometry it must rebuild settings/stage semantics. */
  @State private bookTurnRuntimeFailed: boolean = false;
  private bookTurnAwaitingSlotCommit: boolean = false;
  private pageTurnCommitStarted: boolean = false;
  private pageTurnPerfStartedAtMs: number = 0;
  private pageTurnPerfStyle: string = '';
  private pageTurnPerfPath: string = '';
  private pageTurnPerfDirection: string = '';
  private pageTurnSettlementGeneration: number = 0;
  /** Immutable geometry shared by animation, freshness, and the Core commit join. */
  private pageTurnSettlementLayout: ReaderReadingLayoutSnapshot | undefined = undefined;
  private pageTurnAnimationFinished: boolean = false;
  private pageTurnCommitFinished: boolean = false;
  private pageTurnCommitSucceeded: boolean = false;
  private pageTurnSettlingPrepared: PreparedReaderPageTurn | undefined = undefined;
  private pageTurnStoredProgress: LocalReadingProgress | undefined = undefined;
  private pageTurnPendingExit: boolean = false;
  private pageTurnPendingViewportWidth: number = 0;
  private pageTurnPendingViewportHeight: number = 0;
  private pageTurnPendingWindowReflow: boolean = false;
  private pageTurnPendingAppearanceSnapshot: ReaderAppearanceSnapshot | undefined = undefined;
  private pageTurnPendingReplaceReload: boolean = false;
  private pageTurnPendingProjectionChapterIndex: number = -1;
  private pageTurnPendingRequestedChapterChange: boolean = false;
  private pageTurnPendingChapterSelection: ReaderDeferredChapterSelection | undefined = undefined;
  private paginationDraft: ReadingPaginationPrefix | undefined = undefined;
  private measurementRequestedAnchorScalar: number = -1;
  private materializedContentVersion: string = '';
  private brightnessRequestGeneration: number = 0;
  private brightnessMutationQueue: Promise<void> = Promise.resolve();
  private initialWindowBrightness: number | undefined = undefined;
  private brightnessPolicyTouched: boolean = false;
  private autoPageTimer: number = -1;
  private autoPageDeadlineMs: number = 0;
  private autoPageTimerGeneration: number = -1;
  /** Busy Auto Page retries are resumed by state completion, never by polling. */
  private autoPageTurnPending: boolean = false;
  private autoPageSessionTimer: number = -1;
  private autoPageSessionDeadlineMs: number = 0;
  private autoPageSessionTimerGeneration: number = -1;
  private pageChromeStatusTimer: number = -1;
  private pendingPageChromeClockText: string | undefined = undefined;
  private measuredSessionCapsuleType: ReaderSessionCapsuleType | undefined = undefined;
  private pendingSessionCapsuleType: ReaderSessionCapsuleType | undefined = undefined;
  private pendingSessionCapsuleWidth: number = 0;
  private pendingSessionCapsuleHeight: number = 0;
  private pageTurnSessionCapsuleFrozen: boolean = false;
  private pageTurnSessionCapsuleSnapshot: ReaderSessionCapsuleSnapshot | undefined = undefined;
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
  /** Watchdog timer bounding a rollback animation whose finish callback may be lost. */
  private pageTurnSettlementDeadlineTimer: number = -1;
  /** Bounds completeFirstPage once the layout deadline has been cancelled. */
  private firstPageCompletionDeadlineTimer: number = -1;
  /** Bounded re-measurement attempts after a suspended first-page anchor. */
  private firstPageCompletionRetryCount: number = 0;
  /** Snapshot that stale watchdog fires cannot act on a newer selection. */
  private firstPageCompletionGeneration: number = 0;
  /** Backoff timer re-draining a preparation attempt rejected while busy. */
  private pageTurnPreparationRetryTimer: number = -1;
  private pageTurnPreparationRetryCount: number = 0;
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
  private unicodeProbeVerified: boolean = false;
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
  /** Serializes the only cross-runtime transition: TTS teardown before auto-page starts. */
  private autoPageStartGeneration: number = 0;
  private autoPageStartPending: boolean = false;
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
  private contentMetricsLoading: boolean = false;
  private controlDirectoryParentSource: LocalReadingTocEntry[] | undefined = undefined;
  private controlDirectoryTocSource: LocalReadingTocEntry[] | undefined = undefined;
  private controlDirectoryProjection: LocalReadingTocEntry[] = [];
  private lastCommittedProgress: ReadingCommit | undefined = undefined;
  private ttsInitialization: Promise<boolean> | undefined = undefined;
  private ttsAvailabilityResolved: boolean = false;
  private chineseConversionLoaded: boolean = false;
  private readerSettingsLoaded: boolean = false;
  /** Layout facts admitted for the last window-metrics revision. */
  private lastWindowMetricsLayoutKey: string = '';

  aboutToAppear(): void {
    this.lifecycleToken += 1;
    const lifecycleToken = this.lifecycleToken;
    this.mounted = true;
    this.bookTurnRuntimeFailed = false;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    this.clearBookTurnCapturedIdentities();
    this.bookTurnSession.setEventListener((event: BookTurnNativeEvent): void =>
      this.onBookTurnNativeEvent(event));
    this.screenAwakeKeepScreenOn = false;
    this.screenAwakeLease = new ReaderScreenAwakeLease((keepScreenOn: boolean): void =>
      this.onScreenAwakeKeepScreenOnChanged(keepScreenOn));
    this.readingSystemEventHost = new ReaderReadingSystemEventHost();
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
    this.exitDelivered = false;
    this.readingRecordActiveSinceMs = 0;
    this.readingRecordPendingMillis = 0;
    this.clearReadingRecordTimer();
    this.commitInFlight = false;
    this.continuousCommitInFlight = false;
    this.continuousCommitPending = false;
    this.continuousUserInteractionActive = false;
    this.continuousImageResolutions.clear();
    this.chapterImageByStartScalar.clear();
    this.chapterImagePositionByKey.clear();
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.cancelPendingAutoPageStart();
    this.autoPageState = createReaderAutoPageState(this.autoPageState.speedSeconds);
    this.autoPageFullConfiguration = setReaderAutoPageFullSpeed(
      this.autoPageFullConfiguration,
      this.autoPageState.speedSeconds,
    );
    this.resetAutoPageSessionDuration();
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.refreshPageChromeClock(lifecycleToken);
    this.armPageChromeStatusTimer(lifecycleToken);
    this.sessionGateway = new ReadingSessionFlowGateway(
      this.sourceId,
      this.bookId,
      this.readingSessionSource(),
      ReaderRuntimeOwner.current(),
      this.sourceSwitchTransactionId,
    );
    this.contentMetrics = undefined;
    this.contentMetricsLoading = false;
    this.lastCommittedProgress = undefined;
    this.ttsInitialization = undefined;
    this.ttsAvailabilityResolved = false;
    this.chineseConversionLoaded = false;
    this.readerSettingsLoaded = false;
    registerReaderFonts(this.getUIContext().getFont());
    this.didLayoutListener = (): void => this.captureMeasurementAfterLayout();
    this.getUIContext().getUIObserver().on('didLayout', this.didLayoutListener);
    this.onExitRequestHandler((): void => this.requestExit());
    // The Detail/Directory parent keeps this first entry visually hidden until
    // `onReadingReady`, but its body work must still be bounded so a failed
    // chapter read or first Core commit cannot leave the reader session alive
    // forever with no recoverable path back.
    this.armFirstPageReadyDeadline(lifecycleToken, this.chapterSelectionToken);
    void this.loadInitialReading(lifecycleToken);
  }

  aboutToDisappear(): void {
    // Do not begin a second, fire-and-forget write after the host has already
    // unmounted us. Normal exit is serialized through requestExit() instead.
    this.invalidatePageTurnRuntime(true);
    this.bookTurnSession.setEventListener((_event: BookTurnNativeEvent): void => {});
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    this.bookTurnMotion = undefined;
    this.clearDeferredPageTurnWork();
    this.restoreInitialWindowBrightness();
    this.screenAwakeLease?.dispose();
    this.screenAwakeLease = undefined;
    this.screenAwakeKeepScreenOn = false;
    this.readingSystemEventHost?.dispose();
    this.readingSystemEventHost = undefined;
    this.mounted = false;
    if (this.windowChromeActive) {
      ReaderWindowCoordinator.requestAppChrome();
    }
    void ReaderWindowCoordinator.requestAppWindowPolicy();
    this.lifecycleToken += 1;
    this.searchGeneration += 1;
    this.replacePanelGeneration += 1;
    this.appearanceReflowInvalidateCurrentLayout = false;
    this.invalidateReplaceMutationOwner();
    this.cancelPendingAutoPageStart();
    this.autoPageState = invalidateReaderAutoPageState(this.autoPageState);
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.clearPageChromeStatusTimer();
    this.pendingPageChromeClockText = undefined;
    this.pendingSessionCapsuleType = undefined;
    this.clearReadingRecordTimer();
    this.readingRecordActiveSinceMs = 0;
    this.readingRecordPendingMillis = 0;
    const ttsCoordinator = this.ttsCoordinator;
    this.ttsCoordinator = undefined;
    this.ttsGateway = undefined;
    this.ttsHttpGateway = undefined;
    this.ttsInitialization = undefined;
    this.ttsAvailabilityResolved = false;
    this.previousChapterMeasurement = undefined;
    this.releaseAllReadingImages();
    this.chapterWindow.clear();
    this.sessionGateway = undefined;
    if (ttsCoordinator !== undefined) void ttsCoordinator.dispose();
    this.resetPaginationDraft();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.cancelPageTurnPreparationRetry();
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
      if (this.readerSettingsSnapshot.navigationMode === 'continuous' &&
        this.continuousFragments.length > 0) {
        ReaderContinuousReadingStage({
          chapterIdentity: this.continuousRenderChapterIdentity,
          chapterTitle: this.continuousRenderChapterTitle,
          contentRevision: this.continuousRenderRevision,
          changedFragmentIndex: this.continuousChangedFragmentIndex,
          fragmentsProvider: (): ReadingSurfacePageFragment[] => this.continuousFragments,
          initialFragmentIndex: this.continuousInitialFragmentIndex,
          initialFragmentProgress: this.continuousInitialFragmentProgress,
          layout: this.readingLayout(),
          appearance: this.appearanceSnapshot,
          ttsHighlightStart: this.ttsFollowHighlight ? this.ttsState.charStart : undefined,
          ttsHighlightEnd: this.ttsFollowHighlight ? this.ttsState.charEnd : undefined,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerSettingsSnapshot.longPressSelectText,
          interactionEnabled: this.isReaderPageInteractionEnabled(),
          onVisibleRangeChanged: (start: number, end: number, startProgress: number): void =>
            this.onContinuousVisibleRangeChanged(start, end, startProgress),
          onScrollStopped: (): void => this.onContinuousScrollStopped(),
          onReachStart: (): void => this.onContinuousReachStart(),
          onReachEnd: (): void => this.onContinuousReachEnd(),
          onBoundaryDrag: (direction: 'previous' | 'next'): void =>
            this.onContinuousBoundaryDrag(direction),
          onOpenControl: (): void => this.openReaderControl(),
          onManualInteraction: (): void => this.onContinuousManualInteraction(),
          onScrollerReady: (scroller: Scroller | undefined): void => {
            this.continuousScroller = scroller;
          },
        });
      } else {
        ReaderPageTurnStage({
          currentPage: this.currentPageTurnRenderPage(),
          currentPageSnapshotId: this.usesBookTurnSimulation() ?
            READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID : '',
          previousPage: this.preparedPageTurnRenderPage('previous'),
          nextPage: this.preparedPageTurnRenderPage('next'),
          pageTurnStyle: this.effectivePageTurnStyle(),
          turnDirection: this.pageTurnDirection,
          offsetX: this.pageTurnOffsetX,
          viewportWidth: this.pageTurnStageViewportWidth(),
          layout: this.readingLayout(),
          appearance: this.appearanceSnapshot,
          ttsHighlightStart: this.ttsFollowHighlight ? this.ttsState.charStart : undefined,
          ttsHighlightEnd: this.ttsFollowHighlight ? this.ttsState.charEnd : undefined,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerSettingsSnapshot.longPressSelectText,
          translateY: this.bookmarkPageOffsetY,
        });
        if (this.usesBookTurnSimulation()) {
          ReaderBookTurnSurface({
            componentId: READER_BOOK_TURN_COMPONENT_ID,
            onSurfaceLoaded: (): void => this.onBookTurnSurfaceLoaded(),
          });
        }
      }
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
        layout: this.controlLayout(),
        visible: this.controlVisible && !this.controlObscured,
        shellExitArmed: this.controlShellExitArmed,
        activePage: this.controlPage,
        // ReaderControlPanel deliberately stays mounted for its transitions,
        // but its directory subtree is not visible before the control opens.
        // Do not build a thousands-row marker/title projection for that hidden
        // shell on the first reading frame.
        tocEntries: this.controlVisible ?
          this.controlDirectoryEntries() : EMPTY_CONTROL_DIRECTORY_ENTRIES,
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
        pageTurnSimulationAvailable: !this.bookTurnRuntimeFailed,
        ttsState: this.ttsState,
        ttsTimerMinutes: this.ttsTimerMinutes,
        ttsTimerSeconds: this.ttsTimerSeconds,
        ttsFollowHighlight: this.ttsFollowHighlight,
        ttsPauseOnInterruption: this.ttsPauseOnInterruption,
        ttsAllowMixing: this.ttsAllowMixing,
        ttsFailurePolicy: this.ttsFailurePolicy,
        ttsEngine: this.ttsEngine,
        ttsHttpEngines: this.ttsHttpEngines,
        ttsVoiceOptions: this.ttsVoiceOptions,
        ttsLanguage: this.ttsLanguage,
        ttsPerson: this.ttsPerson,
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
        onPreviewReplace: (): void => this.previewQuickReplace(),
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
        onAppearanceFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): void =>
          this.changeAppearanceFontOrder(fontOrder),
        onAppearanceCustomFontImport: (): void => this.importReaderCustomFont(),
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
        onTtsRateChange: (rate: number): void => this.changeTtsRate(rate),
        onTtsTimerChange: (minutes: number, seconds: number): void => this.changeTtsTimer(minutes, seconds),
        onTtsFollowHighlightChange: (enabled: boolean): void => this.changeTtsFollowHighlight(enabled),
        onTtsPauseOnInterruptionChange: (enabled: boolean): void =>
          this.changeTtsPauseOnInterruption(enabled),
        onTtsAllowMixingChange: (enabled: boolean): void => this.changeTtsAllowMixing(enabled),
        onTtsFailurePolicyChange: (policy: 'skip' | 'stop'): void => this.changeTtsFailurePolicy(policy),
        onTtsVoiceChange: (language: string, person: number): void => this.changeTtsVoice(language, person),
        onTtsEngineChange: (engine: string): Promise<void> => this.changeTtsEngine(engine),
        onTtsHttpEnginePut: (config: ReaderHttpTtsConfig): Promise<void> => this.saveHttpTtsEngine(config),
        onTtsHttpEngineDelete: (id: number): Promise<void> => this.deleteHttpTtsEngine(id),
      });
      if (!this.controlVisible && (this.readerSettingsSnapshot.navigationMode === 'paged' ||
        this.continuousFragments.length === 0)) {
        // Tap and horizontal pan share one pointer owner and one previous/next
        // request path. Slide uses an already measured neighbour; none/cold
        // fallbacks still use the existing committed pagination flow.
        ReaderPageInteractionLayer({
          interactionEnabled: this.isReaderPageInteractionEnabled(),
          tapOnly: this.pageTurnTapOnlyInput(),
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          allowTextSelection: this.readerSettingsSnapshot.longPressSelectText,
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
          onOpenControl: (): void => this.openReaderControl(),
          onManualInteraction: (): void => this.onReaderManualInteraction(),
          onDeferredSegmentStart: (): boolean => this.reserveDeferredPointerSegment(),
          onDeferredSegmentResolve: (intent: ReaderPageTapIntent | undefined): void =>
            this.resolveDeferredPointerSegment(intent),
          onDeferredSegmentPromote: (): void => this.promoteDeferredPointerSegment(),
          onGestureStateChange: (state: ReaderPageGestureState): void =>
            this.onReaderPageGestureStateChanged(state),
          onGestureDecision: (decision: ReaderPageGestureDecision): ReaderPageGestureDecision =>
            this.onReaderPageGestureDecision(decision),
        });
      }
      if (this.shouldShowSessionCapsule()) {
        ReaderSessionCapsule({
          type: this.sessionCapsuleType(),
          sessionState: this.sessionCapsuleState(),
          countdown: this.sessionCapsuleCountdown(),
          surfaceColor: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).paperStart,
          textColor: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
          interactionEnabled: !this.pageTurnInputOwned,
          onToggle: (): void => this.toggleSessionCapsule(),
          onMeasured: (width: number, height: number): void =>
            this.onSessionCapsuleMeasured(this.sessionCapsuleType(), width, height),
        })
          .position({
            x: this.sessionCapsuleLayout().sessionX,
            y: this.sessionCapsuleLayout().sessionY,
          })
          .zIndex(8)
          // Reader-UI tokens: capsuleEnter 160ms / sessionReturn 200ms. Fade
          // only — countdown and state updates mutate the mounted node and
          // must never replay this transition.
          .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
          TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(motionAnimateParam('reader.session.capsule.enter')),
            TransitionEffect.OPACITY.animation(motionAnimateParam('reader.session.capsule.exit')),
          ));
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
      this.admitReaderViewportSize(width, height, lifecycleToken);
    });
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
    if (this.usesBookTurnSimulation()) {
      this.bookTurnSession.configure(width, height);
    }
    this.lastWindowMetricsLayoutKey = this.windowMetricsLayoutKey();
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
  }

  private pageTurnStageViewportWidth(): number {
    return this.pageTurnPresentationWidth > 0 ? this.pageTurnPresentationWidth : this.viewportWidth;
  }

  private usesBookTurnSimulation(): boolean {
    return this.readerSettingsSnapshot.navigationMode === 'paged' &&
      this.readerSettingsSnapshot.pageTransition === 'simulation' && !this.reduceMotion &&
      !this.bookTurnRuntimeFailed;
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

  private onBookTurnSurfaceLoaded(): void {
    if (!this.mounted || !this.usesBookTurnSimulation()) return;
    this.bookTurnSession.configure(this.viewportWidth, this.viewportHeight);
    this.scheduleBookTurnTextureRefresh();
  }

  private onBookTurnNativeEvent(event: BookTurnNativeEvent): void {
    if (!this.mounted) return;
    this.bookTurnNativeRevision = this.bookTurnNativeRevision >= Number.MAX_SAFE_INTEGER ?
      1 : this.bookTurnNativeRevision + 1;
    if (event.event === BOOK_TURN_EVENT_SURFACE_READY) {
      this.bookTurnRuntimeFailed = false;
      this.bookTurnSession.configure(this.viewportWidth, this.viewportHeight);
      this.scheduleBookTurnTextureRefresh();
      return;
    }
    if (event.event === BOOK_TURN_EVENT_TEXTURE_READY) {
      this.drainPendingManualPageTurn();
      this.resumePendingAutoPageTurn();
      return;
    }
    if (event.event === BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT) {
      if (event.generation !== this.pageTurnSettlementGeneration) return;
      this.pageTurnAnimationFinished = true;
      const prepared = this.pageTurnSettlingPrepared;
      if (prepared !== undefined && !this.pageTurnCommitStarted) {
        this.beginPreparedPageTurnPersistence(prepared, this.lifecycleToken, event.generation);
      }
      this.finishPreparedPageTurnSettlement(event.generation);
      return;
    }
    if (event.event === BOOK_TURN_EVENT_ROLLBACK_COMPLETE) {
      this.finishPageTurnRollback(event.generation);
      return;
    }
    if (event.event === BOOK_TURN_EVENT_SLOTS_COMMITTED) {
      if (!this.bookTurnAwaitingSlotCommit || event.generation !== this.pageTurnSettlementGeneration) return;
      this.bookTurnAwaitingSlotCommit = false;
      this.promoteBookTurnCapturedIdentities(this.pageTurnDirection);
      this.finishSuccessfulPageTurnPresentation(event.generation);
      this.scheduleBookTurnTextureRefresh();
      return;
    }
    if (event.event === BOOK_TURN_EVENT_SURFACE_LOST || event.event === BOOK_TURN_EVENT_RENDER_FAILURE) {
      this.failBookTurnRuntime();
    }
  }

  private failBookTurnRuntime(): void {
    this.bookTurnRuntimeFailed = true;
    this.clearBookTurnCapturedIdentities();
    // Once the visual endpoint has been reported, the Core transaction owns
    // the result. Keep that atomic decision and reveal the static admitted
    // page when it finishes; before the endpoint no progress write has begun.
    if (this.pageTurnAnimationFinished && this.pageTurnCommitStarted) return;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnCommitStarted = false;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
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
    if (!this.mounted || !this.usesBookTurnSimulation()) return;
    this.bookTurnTextureCaptureGeneration += 1;
    if (this.bookTurnTextureCaptureScheduled) return;
    this.bookTurnTextureCaptureScheduled = true;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.bookTurnTextureCaptureScheduled = false;
      const generation = this.bookTurnTextureCaptureGeneration;
      void this.refreshBookTurnTextures(generation);
    }));
  }

  private async refreshBookTurnTextures(generation: number): Promise<void> {
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      !this.usesBookTurnSimulation() || this.bookTurnRuntimeFailed || !this.bookTurnSession.isReady() ||
      this.phase !== 'ready' || this.pageTurnPreparation !== undefined ||
      this.pageTurnInputPhase() !== 'idle') {
      return;
    }
    const current = this.currentPageTurnRenderPage();
    const previous = this.preparedPageTurnRenderPage('previous');
    const next = this.preparedPageTurnRenderPage('next');
    if (!await this.captureBookTurnTexture(BOOK_TURN_TEXTURE_CURRENT, current, generation)) return;
    if (previous !== undefined &&
      !await this.captureBookTurnTexture(BOOK_TURN_TEXTURE_PREVIOUS, previous, generation)) return;
    if (next !== undefined) {
      await this.captureBookTurnTexture(BOOK_TURN_TEXTURE_NEXT, next, generation);
    }
  }

  private async captureBookTurnTexture(
    slot: BookTurnTextureSlot,
    page: ReaderPageTurnRenderPage,
    generation: number,
  ): Promise<boolean> {
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      !this.usesBookTurnSimulation() || this.bookTurnRuntimeFailed || this.phase !== 'ready' ||
      this.pageTurnInputPhase() !== 'idle') {
      return false;
    }
    if (this.bookTurnCapturedIdentity(slot) === page.textureIdentity) return true;
    let pixelMap: image.PixelMap | undefined = undefined;
    let content: ComponentContent<BookTurnTextureBuildInput> | undefined = undefined;
    try {
      const uiContext = this.getUIContext();
      const snapshot = uiContext.getComponentSnapshot();
      if (slot === BOOK_TURN_TEXTURE_CURRENT) {
        // The committed page is already mounted with every body image decoded.
        // Capturing that exact node avoids rebuilding a second image tree and
        // avoids the offscreen 160001 readiness trap on image-bearing pages.
        pixelMap = await snapshot.get(READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID, {
          scale: this.bookTurnTextureSnapshotScale(),
          waitUntilRenderFinished: false,
        });
      } else {
        const input = new BookTurnTextureBuildInput(
          page,
          this.viewportWidth,
          this.viewportHeight,
          this.readingLayout(),
          this.appearanceSnapshot,
          this.readerSettingsSnapshot.longPressSelectText,
        );
        content = new ComponentContent<BookTurnTextureBuildInput>(
          uiContext,
          wrapBuilder(BookTurnTextureBuilder),
          input,
        );
        pixelMap = await snapshot.createFromComponent(
          content,
          0,
          false,
          {
            scale: this.bookTurnTextureSnapshotScale(),
            waitUntilRenderFinished: false,
          },
        );
      }
      if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
        !this.usesBookTurnSimulation() || this.pageTurnInputPhase() !== 'idle') {
        return false;
      }
      const uploaded = this.bookTurnSession.uploadTexture(slot, pixelMap, page.textureIdentity);
      if (!uploaded) {
        this.failBookTurnTextureCapture(slot, generation, 'Native rejected the PixelMap');
        return false;
      }
      this.setBookTurnCapturedIdentity(slot, page.textureIdentity);
      return true;
    } catch (error) {
      const message = errorMessageOf(error);
      this.failBookTurnTextureCapture(slot, generation, message);
      return false;
    } finally {
      if (pixelMap !== undefined) {
        try {
          pixelMap.release();
        } catch (_) {}
      }
      content?.dispose();
    }
  }

  private failBookTurnTextureCapture(slot: BookTurnTextureSlot, generation: number, message: string): void {
    console.error(`ReadingExperience book-turn texture failed slot=${slot}: ${message}`);
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      !this.usesBookTurnSimulation()) return;
    // A missing required texture must not turn the full-screen interaction
    // layer into a permanent wait state. Fail this mounted Native capability
    // and immediately drain any complete user intent through the admitted
    // no-animation path.
    this.failBookTurnRuntime();
    this.drainPendingManualPageTurn();
  }

  private bookTurnTextureSnapshotScale(): number {
    const context = this.getUIContext();
    const widthPx = Math.max(1, context.vp2px(this.viewportWidth));
    const heightPx = Math.max(1, context.vp2px(this.viewportHeight));
    const pixelCount = widthPx * heightPx;
    // ComponentSnapshot rounds each scaled edge to a whole pixel. Without a
    // small area margin both edges can round up and cross the Native ceiling
    // (1178 x 2548 = 3,001,544 on the VM), causing every turn to wait forever.
    return pixelCount <= READER_BOOK_TURN_TEXTURE_MAX_PIXELS ? 1 :
      Math.sqrt(READER_BOOK_TURN_TEXTURE_MAX_PIXELS / pixelCount) * 0.99;
  }

  private bookTurnCapturedIdentity(slot: BookTurnTextureSlot): string {
    if (slot === BOOK_TURN_TEXTURE_PREVIOUS) return this.bookTurnCapturedPreviousIdentity;
    if (slot === BOOK_TURN_TEXTURE_CURRENT) return this.bookTurnCapturedCurrentIdentity;
    return this.bookTurnCapturedNextIdentity;
  }

  private setBookTurnCapturedIdentity(slot: BookTurnTextureSlot, identity: string): void {
    if (slot === BOOK_TURN_TEXTURE_PREVIOUS) {
      this.bookTurnCapturedPreviousIdentity = identity;
    } else if (slot === BOOK_TURN_TEXTURE_CURRENT) {
      this.bookTurnCapturedCurrentIdentity = identity;
    } else {
      this.bookTurnCapturedNextIdentity = identity;
    }
  }

  private clearBookTurnCapturedIdentities(): void {
    this.bookTurnCapturedPreviousIdentity = '';
    this.bookTurnCapturedCurrentIdentity = '';
    this.bookTurnCapturedNextIdentity = '';
  }

  private promoteBookTurnCapturedIdentities(direction: ReaderPageTurnDirection | undefined): void {
    if (direction === 'next') {
      this.bookTurnCapturedPreviousIdentity = this.bookTurnCapturedCurrentIdentity;
      this.bookTurnCapturedCurrentIdentity = this.bookTurnCapturedNextIdentity;
      this.bookTurnCapturedNextIdentity = '';
    } else if (direction === 'previous') {
      this.bookTurnCapturedNextIdentity = this.bookTurnCapturedCurrentIdentity;
      this.bookTurnCapturedCurrentIdentity = this.bookTurnCapturedPreviousIdentity;
      this.bookTurnCapturedPreviousIdentity = '';
    }
  }

  private autoPageHighlightStart(): number | undefined {
    return this.autoPageHighlightFragment()?.startScalar;
  }

  private autoPageHighlightEnd(): number | undefined {
    return this.autoPageHighlightFragment()?.endScalar;
  }

  private autoPageHighlightFragment(): ReadingSurfacePageFragment | undefined {
    if (!this.autoPageFullConfiguration.followHighlight || this.autoPageState.status !== 'running') {
      return undefined;
    }
    const visible = this.readerSettingsSnapshot.navigationMode === 'continuous' ?
      this.continuousFragments.slice(
        this.continuousVisibleFragmentIndex,
        this.continuousVisibleEndFragmentIndex + 1,
      ) : this.visibleFragments;
    const textFragments = visible.filter(
      (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length > 0,
    );
    if (textFragments.length === 0) {
      return undefined;
    }
    const elapsed = Math.max(0, this.autoPageState.speedSeconds - this.autoPageState.remainingSeconds);
    const ratio = Math.max(0, Math.min(1, elapsed / this.autoPageState.speedSeconds));
    const index = Math.min(textFragments.length - 1, Math.floor(ratio * textFragments.length));
    return textFragments[index];
  }

  private onContinuousManualInteraction(): void {
    this.continuousUserInteractionActive = true;
    this.onReaderManualInteraction();
  }

  private onContinuousVisibleRangeChanged(start: number, end: number, startProgress: number): void {
    if (this.readerSettingsSnapshot.navigationMode !== 'continuous' ||
      this.continuousFragments.length === 0) {
      return;
    }
    const clampedStart = Math.max(0, Math.min(this.continuousFragments.length - 1, start));
    const clampedEnd = Math.max(clampedStart, Math.min(this.continuousFragments.length - 1, end));
    this.continuousVisibleFragmentIndex = clampedStart;
    this.continuousVisibleEndFragmentIndex = clampedEnd;
    const first = this.continuousFragments[clampedStart];
    const span = Math.max(0, first.endScalar - first.startScalar);
    const scalarWithinFragment = span === 0 ? 0 : Math.min(span - 1,
      Math.floor(span * Math.max(0, Math.min(1, startProgress))));
    this.continuousVisibleScalar = first.startScalar + scalarWithinFragment;
    this.desiredChapterOffset = this.continuousVisibleScalar;
    const scalarCount = this.chapterLayoutMap?.scalarCount() ?? 0;
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.continuousVisibleScalar / scalarCount;
    this.continuousProgressRevision += 1;
    this.resolveVisibleContinuousImages(clampedStart, clampedEnd);
  }

  private onContinuousScrollStopped(): void {
    this.continuousUserInteractionActive = false;
    void this.commitContinuousProgress(this.lifecycleToken);
  }

  private onContinuousReachStart(): void {
    if (!this.continuousUserInteractionActive || this.continuousVisibleFragmentIndex > 0 ||
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

  private resolveVisibleContinuousImages(start: number, end: number): void {
    for (let index = start; index <= end; index += 1) {
      const fragment = this.continuousFragments[index];
      if (fragment !== undefined && fragment.text.length === 0) {
        this.resolveContinuousImage(fragment.startScalar);
      }
    }
  }

  private resolveContinuousImage(startScalar: number): void {
    const chapter = this.chapter;
    if (chapter === undefined || this.continuousImageResolutions.has(startScalar)) {
      return;
    }
    const image = this.chapterImageByStartScalar.get(startScalar);
    if (image === undefined || image.state !== 'pending') {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) &&
      this.chapter === chapter && this.readerSettingsSnapshot.navigationMode === 'continuous';
    this.continuousImageResolutions.add(startScalar);
    void this.activeGateway().resolveReadingImage(chapter, image, isCurrent)
      .then((resolved: ReadingSessionImage): void => {
        if (!isCurrent()) {
          this.releaseUnadmittedReadingImage(resolved);
          return;
        }
        this.adoptReadingImage(resolved);
        this.replaceResolvedReadingImage(image, resolved);
        if (!this.refreshContinuousImageFragment(resolved)) {
          this.rebuildContinuousFragments();
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          console.error(`ReadingExperience continuous image failed: ${this.errorMessage(error)}`);
        }
      })
      .finally((): void => {
        this.continuousImageResolutions.delete(startScalar);
      });
  }

  private admitPageTurnPresentationWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    this.pageTurnPresentationWidth = width;
    if (this.pageTurnSettlingPrepared !== undefined && this.pageTurnDirection !== undefined) {
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
    const revision = this.pageTurnRenderRevision;
    const origin = this.pageTurnPreparation?.origin;
    const chapterIndex = origin?.chapter.chapterIndex ?? this.chapter?.chapterIndex ?? -1;
    const pageStart = this.visiblePage?.startScalar ?? -1;
    const contentVersion = origin?.contentVersion ?? this.materializedContentVersion;
    const paginationDraft = origin?.paginationDraft ?? this.paginationDraft;
    const scalarCount = origin?.layoutMap.scalarCount() ?? this.chapterLayoutMap?.scalarCount() ?? 0;
    const key = this.pageChromePaginationKey(chapterIndex, contentVersion);
    const chrome = this.pageChromeSnapshot(chapterIndex, pageStart, scalarCount, key, paginationDraft);
    const bottomJustifyGap = this.visiblePage === undefined ? 0 : this.pageBottomJustifyGap(this.visiblePage);
    const textureIdentity = this.bookTurnTextureIdentity(
        chapterIndex,
        pageStart,
        contentVersion,
        key?.layoutSignature ?? '',
        bottomJustifyGap,
        chrome,
      );
    return new ReaderPageTurnRenderPage(
      this.bookTurnSurfaceIdentity('current', chapterIndex, pageStart, contentVersion,
        key?.layoutSignature ?? ''),
      textureIdentity,
      revision,
      origin?.chapter.chapterTitle ?? this.chapterTitle,
      this.showChapterTitle,
      this.visibleFragments,
      bottomJustifyGap,
      chrome,
    );
  }

  private preparedPageTurnRenderPage(
    direction: ReaderPageTurnDirection,
  ): ReaderPageTurnRenderPage | undefined {
    const revision = this.pageTurnRenderRevision;
    const prepared = direction === 'previous' ? this.preparedPreviousPage : this.preparedNextPage;
    if (prepared === undefined || !this.isPreparedPageTurnFresh(prepared)) {
      return undefined;
    }
    const ranges = prepared.context.paragraphRanges;
    const showTitle = ranges.length > 0 && prepared.page.startScalar === ranges[0].startScalar;
    const bottomJustifyGap = this.pageBottomJustifyGap(prepared.page);
    const chrome = this.pageChromeSnapshot(
      prepared.key.chapterIndex,
      prepared.page.startScalar,
      prepared.context.layoutMap.scalarCount(),
      prepared.key,
      prepared.context.paginationDraft,
    );
    const textureIdentity = this.bookTurnTextureIdentity(
        prepared.key.chapterIndex,
        prepared.page.startScalar,
        prepared.key.contentVersion,
        prepared.key.layoutSignature,
        bottomJustifyGap,
        chrome,
      );
    return new ReaderPageTurnRenderPage(
      this.bookTurnSurfaceIdentity(direction, prepared.key.chapterIndex, prepared.page.startScalar,
        prepared.key.contentVersion, prepared.key.layoutSignature),
      textureIdentity,
      revision,
      prepared.context.chapter.chapterTitle,
      showTitle,
      prepared.page.fragments,
      bottomJustifyGap,
      chrome,
    );
  }

  private bookTurnSurfaceIdentity(
    role: 'current' | ReaderPageTurnDirection,
    chapterIndex: number,
    pageStart: number,
    contentVersion: string,
    layoutSignature: string,
  ): string {
    // Role changes only when a physical page becomes current/adjacent. Normal
    // preparation epochs update props without forcing all mounted page trees
    // to acquire new ComponentSnapshot IDs.
    return [
      'reader-page',
      this.sourceId,
      this.bookId,
      chapterIndex.toString(),
      pageStart.toString(),
      contentVersion,
      layoutSignature,
      this.appearanceSnapshot.activeTheme,
      role,
    ].join(':');
  }

  private bookTurnTextureIdentity(
    chapterIndex: number,
    pageStart: number,
    contentVersion: string,
    layoutSignature: string,
    bottomJustifyGap: number,
    chrome: ReaderPageChromeSnapshot,
  ): string {
    return [
      'reader-bookturn-texture-v1',
      this.sourceId,
      this.bookId,
      chapterIndex.toString(),
      pageStart.toString(),
      contentVersion,
      layoutSignature,
      this.appearanceSnapshot.activeTheme,
      bottomJustifyGap.toFixed(3),
      chrome.topStartText,
      chrome.bottomStartText,
      chrome.bottomEndText,
    ].join('|');
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

  @Builder
  private hiddenMeasurementTree() {
    // Opacity keeps the actual Text nodes in the layout pass. `Visibility.None`
    // would make TextController's LayoutManager unavailable and a timer would
    // race layout; UIObserver.didLayout below is therefore the only read point.
    Column() {
      if (!this.unicodeProbeVerified) {
        Text(UNICODE_PROBE, { controller: this.unicodeProbeController })
          .width(this.measurementTextWidth())
          .fontFamily(readerAppearanceSnapshotFontFamily(this.appearanceSnapshot))
          .fontWeight(FontWeight.Regular)
          .fontSize(this.appearanceSnapshot.fontSize)
          .lineHeight(readerAppearanceLineHeight(this.appearanceSnapshot))
          .letterSpacing(this.appearanceSnapshot.letterSpacing)
          .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink)
          .textAlign(readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ?
            TextAlign.JUSTIFY : TextAlign.Start);
      }

      ForEach(this.measurementBatch, (paragraph: MeasurementParagraph) => {
        Text(this.measurementNodeText(paragraph), { controller: paragraph.controller })
          .width(this.measurementTextWidth())
          .fontFamily(readerAppearanceSnapshotFontFamily(this.appearanceSnapshot))
          .fontWeight(FontWeight.Regular)
          .fontSize(this.appearanceSnapshot.fontSize)
          .lineHeight(readerAppearanceLineHeight(this.appearanceSnapshot))
          .letterSpacing(this.appearanceSnapshot.letterSpacing)
          .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink)
          .textAlign(readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ?
            TextAlign.JUSTIFY : TextAlign.Start);
      }, (paragraph: MeasurementParagraph): string => `${this.measurementEpoch}:${paragraph.id}`);
    }
    .width(this.measurementTextWidth())
    .opacity(0)
    .position({ x: this.readingLayout().contentLeft, y: this.readingLayout().contentTop });
  }

  private async loadInitialReading(lifecycleToken: number): Promise<void> {
    // Start layout snapshots and TOC/progress together. Only the final
    // pagination/open barrier waits for appearance so measurement still uses
    // the admitted typography without serializing independent Core reads.
    const layoutReady = Promise.all([
      this.loadAppearanceSnapshot(lifecycleToken),
      this.loadReaderSettingsSnapshot(lifecycleToken),
    ]);
    await this.loadInitialChapter(lifecycleToken, layoutReady);
  }

  private async loadInitialChapter(
    lifecycleToken: number,
    layoutReady: Promise<void[]>,
  ): Promise<void> {
    // The initial restore is also a chapter-selection transaction. A manual
    // choice made while these two Core reads are pending must win completely:
    // neither an old progress row nor an old error may mutate/fail the newer
    // selection.
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
    try {
      const initialLoad = await Promise.all([
        this.loadInitialToc(isCurrent),
        this.activeGateway().loadProgress(this.bookId, isCurrent),
      ]);
      if (!isCurrent()) {
        return;
      }
      const toc = initialLoad[0];
      const progress = initialLoad[1];
      this.admitTocEntries(toc.entries);
      this.chapterWindow.configure(
        this.sourceId,
        this.bookId,
        toc.entries.map((entry: LocalReadingTocEntry): number => entry.index),
      );
      const requested = this.normalizedRequestedChapter();
      const restored = progress.kind === 'restored' ? progress.progress : undefined;
      const target = requested === undefined ? restored?.chapterIndex : requested;
      const chapterIndex = this.requireKnownChapter(target);
      this.restoredProgress = progress;
      await layoutReady;
      if (!isCurrent()) {
        return;
      }
      await this.openChapter(chapterIndex, true, lifecycleToken, selectionToken);
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
  }

  private loadInitialToc(isCurrent: () => boolean): Promise<LocalReadingToc> {
    if (this.directoryEntries.length === 0) {
      return this.activeGateway().loadToc(this.bookId, isCurrent);
    }
    // Detail admission already validated this exact TOC before the reader can
    // be opened. Reuse the parent projection instead of asking the single Core
    // worker to decode the same local/cache TOC once more on every entry.
    return Promise.resolve(new InitialReadingToc(this.bookId, this.directoryEntries));
  }

  private admitTocEntries(entries: LocalReadingTocEntry[]): void {
    this.tocEntries = entries;
    this.controlDirectoryTocSource = undefined;
    this.controlDirectoryProjection = [];
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
    this.reflowAfterWindowGeometryChange();
  }

  private onWindowMetricsRevisionChanged(): void {
    if (!this.mounted) {
      return;
    }
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
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
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
  private resetForChapterSelection(): void {
    this.invalidatePageTurnRuntime(true);
    this.previousChapterMeasurement = undefined;
    this.measurementGeneration += 1;
    this.measurementSelectionToken = -1;
    this.materializedChapterSelectionToken = -1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.measurementBatch.length = 0;
    this.paragraphRanges.length = 0;
    this.clearContinuousRenderProjection();
    this.continuousInitialFragmentIndex = 0;
    this.continuousInitialFragmentProgress = 0;
    this.continuousVisibleFragmentIndex = 0;
    this.continuousVisibleEndFragmentIndex = 0;
    this.continuousVisibleScalar = 0;
    this.continuousProgressRevision += 1;
    this.continuousUserInteractionActive = false;
    this.continuousImageResolutions.clear();
    this.chapterImageByStartScalar.clear();
    this.chapterImagePositionByKey.clear();
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
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.cancelPageTurnPreparationRetry();
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
      const chapterMap = new ReadingSurfaceLayoutMap(chapter.content);
      if (chapterMap.scalarCount() === 0) {
        throw new Error('READING_CONTENT_EMPTY');
      }
      if (!await this.ensureCurrentContentMetrics(chapter, chapterMap, isCurrent)) {
        return;
      }
      this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
      this.chapterWindow.setCurrent(chapter);
      this.retainCurrentChapterWindow();
      this.chapter = chapter;
      this.rebuildChapterImageIndexes(chapter);
      this.materializedChapterSelectionToken = selectionToken;
      this.configureRestoredAnchor(chapter, chapterMap, isInitial, requestedOffset, requestedProgress);
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
   * Prefetch only the forward neighbour after the visible page is committed.
   * Backward acquisition remains demand-driven so optional work cannot queue
   * ahead of the next user intent on Core's single stateful worker.
   */
  private prefetchNextChapter(
    current: ReadingSessionChapter,
    lifecycleToken: number,
    selectionToken: number,
  ): void {
    const next = this.adjacentChapterIndex(current.chapterIndex, 1);
    if (next === undefined || this.chapterWindow.get(next) !== undefined) {
      return;
    }
    const isCurrent = (): boolean => this.isStableVisiblePageOwner(
      this.visiblePage as PhysicalReadingPage,
      current,
      selectionToken,
      lifecycleToken,
    );
    void this.activeGateway().loadChapter(this.bookId, next, isCurrent)
      .then((chapter: ReadingSessionChapter): void => {
        if (!isCurrent()) {
          return;
        }
        this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
        this.chapterWindow.admitNeighbour(chapter);
        this.retainCurrentChapterWindow();
        this.queuePageTurnPreparation('next');
      })
      .catch((_error: Error): void => {
        // The explicit next request remains the retry boundary.
      });
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
    let metric = contentMetricForChapter(metrics, chapter.chapterIndex);
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

  private async loadContentMetricsIfNeeded(lifecycleToken: number): Promise<void> {
    if (!this.isSessionActive(lifecycleToken) || this.contentMetrics !== undefined ||
      this.contentMetricsLoading || !this.activeGateway().supportsExactContentMetrics()) {
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
        const metric = contentMetricForChapter(metrics, chapter.chapterIndex);
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
      if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
        this.rebuildContinuousFragments();
        this.setContinuousInitialAnchor(this.desiredChapterOffset);
      }
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
      if (!this.unicodeProbeVerified) {
        this.unicodeProbeEmptyAttempts = 0;
      }
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
            imageHeight,
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
            undefined,
            0,
            undefined,
            line.height,
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
    if (this.unicodeProbeVerified) {
      return true;
    }
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
      this.unicodeProbeVerified = true;
      console.info('ReadingExperience UTF-16 probe passed: A😀B = 4 UTF-16 / 3 Unicode scalars');
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
    const measurementText = this.measurementNodeText(paragraph);
    const measurementMap = measurementText === paragraph.text ? paragraph.layoutMap :
      new ReadingSurfaceLayoutMap(measurementText);
    const scalarLines = measurementMap.linesFromArkUI(metrics);
    const contentScalarCount = paragraph.layoutMap.scalarCount();
    const result: MeasuredReadingLine[] = [];
    for (let lineIndex = 0; lineIndex < scalarLines.length; lineIndex += 1) {
      const local = scalarLines[lineIndex];
      const startScalar = readerAppearanceParagraphContentScalarOffset(
        local.startScalar,
        contentScalarCount,
        paragraph.isParagraphStart,
        this.appearanceSnapshot.indent,
      );
      const endScalar = readerAppearanceParagraphContentScalarOffset(
        local.endScalar,
        contentScalarCount,
        paragraph.isParagraphStart,
        this.appearanceSnapshot.indent,
      );
      if (endScalar <= startScalar || local.height <= 0) {
        continue;
      }
      result.push(new MeasuredReadingLine(
        lineIndex,
        paragraph.layoutMap.utf16ForScalar(startScalar),
        paragraph.layoutMap.utf16ForScalar(endScalar),
        paragraph.chapterStartScalar + startScalar,
        paragraph.chapterStartScalar + endScalar,
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
    const key = this.readingImageKey(requested);
    let index = this.chapterImagePositionByKey.get(key);
    if (index === undefined) {
      this.rebuildChapterImageIndexes(chapter);
      index = this.chapterImagePositionByKey.get(key);
    }
    if (index === undefined || chapter.images[index].state !== 'pending') {
      return;
    }
    chapter.images[index] = resolved;
    this.chapterImageByStartScalar.set(resolved.startScalar, resolved);
    this.chapterImagePositionByKey.delete(key);
    this.chapterImagePositionByKey.set(this.readingImageKey(resolved), index);
    if (this.pageTurnPreparation === undefined) {
      this.chapterWindow.setCurrent(chapter);
    } else {
      this.chapterWindow.admitNeighbour(chapter);
    }
    this.retainCurrentChapterWindow();
  }

  private rebuildChapterImageIndexes(chapter: ReadingSessionChapter): void {
    this.chapterImageByStartScalar.clear();
    this.chapterImagePositionByKey.clear();
    for (let index = 0; index < chapter.images.length; index += 1) {
      const image = chapter.images[index];
      this.chapterImageByStartScalar.set(image.startScalar, image);
      this.chapterImagePositionByKey.set(this.readingImageKey(image), index);
    }
  }

  private readingImageKey(image: ReadingSessionImage): string {
    return `${image.source}\u0000${image.baseUrl ?? ''}\u0000${image.startScalar}\u0000${image.endScalar}`;
  }

  private measurementNodeText(paragraph: MeasurementParagraph): string {
    // The image height is owned by its intrinsic Host measurement. Mount one
    // ordinary glyph only to make the bounded ArkUI controller tree settle;
    // its line geometry is never used for the image block.
    return paragraph.text === '\uFFFC' ? 'A' : readerAppearanceParagraphDisplayText(
      paragraph.text,
      paragraph.isParagraphStart,
      this.appearanceSnapshot.indent,
    );
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
      this.pendingPageHeight,
      this.pendingPageBodyCapacity(),
    );
    this.observeMeasuredPhysicalPage(page);
    this.measurementBatch.length = 0;
    this.batchProcessing = false;
    this.measurementCompleting = true;
    this.cancelMeasurementDeadline();
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
    this.armFirstPageCompletionDeadline();
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
        const previousChapterIndex = this.adjacentChapterIndex(pending.originalChapterIndex, -1);
        const previousChapterKey = completedContainingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
          this.paginationKeyForChapter(previousChapterIndex) ?? null : null;
        const previous = this.paginationIndex.findPreviousPage(
          this.currentPaginationKey(),
          pending.originalChapterOffset,
          previousChapterKey,
        );
        if (pending.prepareOnly) {
          if (previous.kind === 'page') {
            this.beginDiscoveredPreviousPagePreparation(pending,
              new ReaderPageTurnTarget(previous.page.key.chapterIndex, previous.page.startScalar));
          } else if (previousChapterIndex !== undefined) {
            this.continuePreviousChapterPreparation(pending, previousChapterIndex);
          } else {
            this.finishPreviousPagePreparationDiscovery(pending);
          }
          return;
        }
        this.previousChapterMeasurement = undefined;
        this.measurementCompleting = false;
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
        const previousChapterIndex = this.adjacentChapterIndex(pending.originalChapterIndex, -1);
        if (pending.prepareOnly) {
          if (previousRequest !== undefined) {
            this.beginDiscoveredPreviousPagePreparation(pending,
              new ReaderPageTurnTarget(pending.originalChapterIndex, previousRequest));
          } else if (previousChapterIndex !== undefined) {
            this.continuePreviousChapterPreparation(pending, previousChapterIndex);
          } else {
            this.finishPreviousPagePreparationDiscovery(pending);
          }
          return;
        }
        this.previousChapterMeasurement = undefined;
        this.measurementCompleting = false;
        if (previousRequest !== undefined) {
          this.measureCommittedPageAt(previousRequest);
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
    if (pending.prepareOnly) {
      this.completePreviousChapterPreparation(pending, measuredPage);
      return;
    }
    this.previousChapterMeasurement = undefined;
    this.armFirstPageCompletionDeadline();
    void this.completeFirstPage(measuredPage, generation, selectionToken, lifecycleToken);
  }

  private beginDiscoveredPreviousPagePreparation(
    pending: PreviousChapterMeasurement,
    target: ReaderPageTurnTarget,
  ): void {
    const origin = pending.origin;
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.measurementSelectionToken = -1;
    if (origin === undefined) return;
    this.restoreMaterializedChapterContext(origin, false);
    this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    if (pending.pageTurnGeneration !== this.pageTurnGeneration || this.phase !== 'ready' ||
      this.beginPageTurnPreparation('previous', target) !== 'begun') {
      this.drainPendingManualPageTurn();
      this.drainPageTurnPreparationQueue();
    }
  }

  private continuePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    previousChapterIndex: number,
  ): void {
    const origin = pending.origin;
    const targetChapter = this.chapterWindow.get(previousChapterIndex);
    if (origin === undefined || targetChapter === undefined ||
      pending.pageTurnGeneration !== this.pageTurnGeneration) {
      this.recoverPreviousChapterMeasurement(
        new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_UNAVAILABLE'),
        this.lifecycleToken,
      );
      return;
    }
    const targetMap = new ReadingSurfaceLayoutMap(targetChapter.content);
    if (targetMap.scalarCount() === 0) {
      this.recoverPreviousChapterMeasurement(
        new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_EMPTY'),
        this.lifecycleToken,
      );
      return;
    }
    this.admitChapterContentVersion(targetChapter.chapterIndex, targetChapter.contentVersion);
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      pending.originalChapterIndex,
      pending.originalChapterOffset,
      previousChapterIndex,
      true,
      origin,
      pending.pageTurnGeneration,
    );
    this.measurementCompleting = false;
    this.restoreMaterializedChapterContext(new ReaderMaterializedChapterContext(
      targetChapter,
      targetMap,
      targetChapter.contentVersion,
      [],
      undefined,
      0,
      0,
      -1,
    ), false);
    this.beginMeasurement(this.lifecycleToken);
  }

  private completePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    measuredPage: PhysicalReadingPage,
  ): void {
    const origin = pending.origin;
    if (origin === undefined) return;
    const targetContext = this.captureMaterializedChapterContext();
    const key = this.currentPaginationKey();
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
    this.measurementSelectionToken = -1;
    this.restoreMaterializedChapterContext(origin, false);
    this.phase = 'ready';
    if (pending.pageTurnGeneration === this.pageTurnGeneration) {
      this.preparedPreviousPage = prepared;
      this.pageTurnRenderRevision += 1;
    }
    this.releaseUnretainedReadingImages();
    this.drainPendingManualPageTurn();
    this.resumePendingAutoPageTurn();
    this.drainPageTurnPreparationQueue();
    this.scheduleBookTurnTextureRefresh();
  }

  private finishPreviousPagePreparationDiscovery(pending: PreviousChapterMeasurement): void {
    const origin = pending.origin;
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.measurementSelectionToken = -1;
    if (origin !== undefined) this.restoreMaterializedChapterContext(origin, false);
    this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    this.releaseUnretainedReadingImages();
    this.drainPendingManualPageTurn();
    this.drainPageTurnPreparationQueue();
    this.scheduleBookTurnTextureRefresh();
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
    const targetContext = this.captureMaterializedChapterContext();
    const key = this.currentPaginationKey();
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
    this.restoreMaterializedChapterContext(preparation.origin, false);
    this.measurementCompleting = false;
    this.measurementSelectionToken = -1;
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.releaseUnretainedReadingImages();
    this.drainPendingManualPageTurn();
    this.resumePendingAutoPageTurn();
    this.drainPageTurnPreparationQueue();
    this.scheduleBookTurnTextureRefresh();
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
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, visiblePage.startScalar, visibleProgress),
          this.coreLayout(),
          (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken),
        );
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
        if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
          this.rebuildContinuousFragments();
          this.setContinuousInitialAnchor(visiblePage.startScalar);
        }
        this.releaseUnretainedReadingImages();
        this.showChapterTitle = this.isChapterFirstPageStart(visiblePage.startScalar);
        this.phase = 'ready';
        this.beginReadingRecordClock(lifecycleToken);
        this.finishPageTurnPerf('committed');
        this.measurementCompleting = false;
        this.cancelFirstPageReadyDeadline();
        this.cancelFirstPageCompletionDeadline();
        this.firstPageCompletionRetryCount = 0;
        this.chapterTitle = chapter.chapterTitle;
        this.onChapterCommitted(chapter.chapterIndex, chapter.chapterTitle);
        this.onReadingReady(chapter.chapterIndex);
        this.admitCommittedProgress(stored);
        this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
        this.schedulePageTurnPreparation();
        this.drainPendingManualPageTurn();
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
    this.pendingManualPageTurnIntent = undefined;
    this.pendingPointerSegmentReserved = false;
    this.autoPageTurnPending = false;
    const inputPhase = this.pageTurnInputPhase();
    if (inputPhase === 'tracking' || inputPhase === 'dragging') {
      // Back wins over an uncommitted page turn, but it must first return the
      // visible sheet to rest. The deferred exit resumes from the rollback
      // completion, so the visible page cannot disappear mid-frame.
      this.pageTurnPendingExit = true;
      const cancelled = cancelReaderPagePan(this.pageTurnGestureState);
      if (cancelled !== this.pageTurnGestureState) {
        this.onReaderPageGestureStateChanged(cancelled);
        return;
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
      if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
        await this.commitContinuousProgress(lifecycleToken);
      } else {
        await this.commitVisiblePage(lifecycleToken);
      }
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
    if (this.lastCommittedProgress?.sourceId === this.sourceId &&
      this.lastCommittedProgress.bookId === this.bookId &&
      this.lastCommittedProgress.chapterIndex === chapter.chapterIndex &&
      this.lastCommittedProgress.chapterOffset === page.startScalar) {
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
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress),
          this.coreLayout(),
          (): boolean => this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken),
        );
        if (!this.isVisiblePageCurrent(page, chapter, selectionToken, lifecycleToken)) {
          return;
        }
        this.admitCommittedProgress(stored);
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

  /**
   * Persists the first visible continuous fragment as the same canonical
   * Unicode-scalar anchor used by paged reading. Scroll notifications can
   * arrive while Core is writing, so one trailing commit coalesces every
   * intermediate offset without allowing an older position to win.
   */
  private async commitContinuousProgress(lifecycleToken: number): Promise<void> {
    if (!this.isMountedToken(lifecycleToken) || this.phase !== 'ready' ||
      this.readerSettingsSnapshot.navigationMode !== 'continuous' || this.chapter === undefined ||
      this.chapterLayoutMap === undefined || this.continuousFragments.length === 0) {
      return;
    }
    if (this.continuousCommitInFlight) {
      this.continuousCommitPending = true;
      return;
    }
    const chapter = this.chapter;
    const selectionToken = this.chapterSelectionToken;
    const scalarCount = this.chapterLayoutMap.scalarCount();
    const scalar = Math.max(0, Math.min(scalarCount, this.continuousVisibleScalar));
    const revision = this.continuousProgressRevision;
    const isCurrent = (): boolean => this.isMountedToken(lifecycleToken) && this.phase === 'ready' &&
      this.readerSettingsSnapshot.navigationMode === 'continuous' && this.chapter === chapter &&
      this.chapterSelectionToken === selectionToken && this.materializedChapterSelectionToken === selectionToken &&
      this.continuousProgressRevision === revision && this.continuousVisibleScalar === scalar;
    if (this.lastCommittedProgress?.sourceId === this.sourceId &&
      this.lastCommittedProgress.bookId === this.bookId &&
      this.lastCommittedProgress.chapterIndex === chapter.chapterIndex &&
      this.lastCommittedProgress.chapterOffset === scalar) {
      this.onAutoPagePageCommitted();
      return;
    }
    this.continuousCommitInFlight = true;
    try {
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!isCurrent()) {
          return;
        }
        const chapterProgress = scalarCount === 0 ? 0 : scalar / scalarCount;
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, scalar, chapterProgress),
          this.coreLayout(),
          isCurrent,
        );
        if (!isCurrent()) {
          return;
        }
        this.admitCommittedProgress(stored);
        this.onAutoPagePageCommitted();
      });
    } catch (error) {
      console.error(`ReadingExperience continuous progress commit failed: ${this.errorMessage(error as Error)}`);
    } finally {
      this.continuousCommitInFlight = false;
      if (this.continuousCommitPending && this.isMountedToken(lifecycleToken)) {
        this.continuousCommitPending = false;
        void this.commitContinuousProgress(lifecycleToken);
      }
    }
  }

  private admitCommittedProgress(stored: LocalReadingProgress): void {
    const commit = new ReadingCommit(
      this.sourceId,
      this.bookId,
      stored.chapterIndex,
      stored.chapterOffset,
      stored.chapterProgress,
      stored.locationRevision,
    );
    this.lastCommittedProgress = commit;
    this.onReadingCommitted(commit);
  }

  private coreLayout(): CoreReadingLayout {
    // Core's contract is a uint32 viewport snapshot. ArkUI areas may be
    // fractional vp values, so retain the fractional value for measurement
    // and round only at this Core protocol boundary.
    const layout = this.readingLayout();
    return new CoreReadingLayout(
      Math.max(1, Math.round(layout.viewportWidth)),
      Math.max(1, Math.round(layout.viewportHeight)),
      readerAppearanceFontScale(this.appearanceSnapshot) * layout.systemFontScale,
      readerAppearanceLineHeight(this.appearanceSnapshot),
    );
  }

  private paginationLayoutSignature(): string {
    const layout = this.readingLayout();
    return createReadingPaginationLayoutSignature({
      deviceForm: layout.widthClass === 'expanded' ? 'tablet' : 'phone',
      viewportWidth: layout.viewportWidth,
      viewportHeight: layout.viewportHeight,
      fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
      fontWeight: FIGMA_BODY_FONT_WEIGHT,
      fontSize: this.appearanceSnapshot.fontSize,
      fontScale: readerAppearanceFontScale(this.appearanceSnapshot) * layout.systemFontScale,
      lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot),
      topInset: layout.contentTop,
      bottomInset: layout.contentBottom,
      leftInset: layout.contentLeft,
      rightInset: layout.contentRight,
      titleLineHeight: layout.titleLineHeightFp,
      titleToBodySpacing: layout.titleToBodySpacingVp,
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
    const preparedFragments = (this.preparedPreviousPage?.page.fragments ?? [])
      .concat(this.preparedNextPage?.page.fragments ?? []);
    for (const fragment of this.visibleFragments.concat(this.pendingPageFragments, preparedFragments)) {
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
    const ranges = collectReadingParagraphUtf16Ranges(
      content,
      readingParagraphBoundaryMode(this.sourceId, this.bookKind),
    );
    for (const range of ranges) {
      this.appendParagraphRange(range.startUtf16, range.endUtf16, chapterMap);
    }
  }

  private rebuildContinuousFragments(): void {
    const chapter = this.chapter;
    const chapterMap = this.chapterLayoutMap;
    if (chapter === undefined || chapterMap === undefined || this.paragraphRanges.length === 0) {
      this.clearContinuousRenderProjection();
      return;
    }
    const fragments: ReadingSurfacePageFragment[] = [];
    for (const range of this.paragraphRanges) {
      const bodyImage = this.continuousImageForRange(chapter, range);
      if (bodyImage !== undefined) {
        const capacity = Math.max(readerAppearanceLineHeight(this.appearanceSnapshot),
          this.readingLayout().bodyHeight(false));
        const imageHeight = bodyImage.state === 'ready' ?
          this.scaledReadingImageHeight(bodyImage, capacity) :
          readerAppearanceLineHeight(this.appearanceSnapshot);
        fragments.push(new ReadingSurfacePageFragment(
          `continuous:${chapter.chapterIndex}:image:${bodyImage.startScalar}-${bodyImage.endScalar}:${bodyImage.revision}`,
          '',
          true,
          bodyImage.startScalar,
          bodyImage.endScalar,
          bodyImage.state === 'ready' ? bodyImage.pixelMap : undefined,
          imageHeight,
          bodyImage.state === 'ready' ? bodyImage.fileUri : undefined,
          imageHeight,
        ));
        continue;
      }
      let startUtf16 = range.startUtf16;
      let chunkIndex = 0;
      while (startUtf16 < range.endUtf16) {
        let endUtf16 = Math.min(range.endUtf16, startUtf16 + CONTINUOUS_FRAGMENT_MAX_UTF16);
        if (endUtf16 < range.endUtf16 && endUtf16 > startUtf16) {
          const trailing = chapter.content.charCodeAt(endUtf16 - 1);
          if (trailing >= 0xD800 && trailing <= 0xDBFF) {
            endUtf16 -= 1;
          }
        }
        if (endUtf16 <= startUtf16) {
          endUtf16 = range.endUtf16;
        }
        const startScalar = chapterMap.scalarForUtf16(startUtf16);
        const endScalar = chapterMap.scalarForUtf16(endUtf16);
        fragments.push(new ReadingSurfacePageFragment(
          `continuous:${chapter.chapterIndex}:${range.id}:${chunkIndex}:${startScalar}-${endScalar}`,
          chapter.content.substring(startUtf16, endUtf16),
          chunkIndex === 0,
          startScalar,
          endScalar,
        ));
        startUtf16 = endUtf16;
        chunkIndex += 1;
      }
    }
    this.commitContinuousRenderProjection(chapter, fragments);
  }

  private commitContinuousRenderProjection(
    chapter: ReadingSessionChapter,
    fragments: ReadingSurfacePageFragment[],
  ): void {
    this.continuousFragments = fragments;
    this.rebuildContinuousFragmentIndex();
    this.continuousRenderChapterIdentity =
      `continuous:${chapter.chapterIndex}:${chapter.contentVersion}`;
    this.continuousRenderChapterTitle = chapter.chapterTitle;
    this.continuousChangedFragmentIndex = -1;
    this.continuousRenderRevision += 1;
  }

  private rebuildContinuousFragmentIndex(): void {
    this.continuousFragmentIndexByStartScalar.clear();
    for (let index = 0; index < this.continuousFragments.length; index += 1) {
      this.continuousFragmentIndexByStartScalar.set(this.continuousFragments[index].startScalar, index);
    }
  }

  private refreshContinuousImageFragment(image: ReadingSessionImage): boolean {
    const chapter = this.chapter;
    if (chapter === undefined || image.state !== 'ready') return false;
    const index = this.continuousFragmentIndexByStartScalar.get(image.startScalar) ?? -1;
    if (index < 0) return false;
    const capacity = Math.max(readerAppearanceLineHeight(this.appearanceSnapshot),
      this.readingLayout().bodyHeight(false));
    const imageHeight = this.scaledReadingImageHeight(image, capacity);
    this.continuousFragments.splice(index, 1, new ReadingSurfacePageFragment(
      `continuous:${chapter.chapterIndex}:image:${image.startScalar}-${image.endScalar}:${image.revision}`,
      '',
      true,
      image.startScalar,
      image.endScalar,
      image.pixelMap,
      imageHeight,
      image.fileUri,
      imageHeight,
    ));
    this.continuousChangedFragmentIndex = index;
    this.continuousRenderRevision += 1;
    return true;
  }

  private clearContinuousRenderProjection(): void {
    this.continuousFragments = [];
    this.continuousFragmentIndexByStartScalar.clear();
    this.continuousRenderChapterIdentity = 'continuous:empty';
    this.continuousRenderChapterTitle = '';
    this.continuousChangedFragmentIndex = -1;
    this.continuousRenderRevision += 1;
  }

  private continuousImageForRange(
    chapter: ReadingSessionChapter,
    range: ParagraphRange,
  ): ReadingSessionImage | undefined {
    if (range.endScalar !== range.startScalar + 1 ||
      chapter.content.substring(range.startUtf16, range.endUtf16) !== '\uFFFC') {
      return undefined;
    }
    const image = this.chapterImageByStartScalar.get(range.startScalar);
    return image?.endScalar === range.endScalar ? image : undefined;
  }

  private continuousFragmentIndexForScalar(scalar: number): number {
    if (this.continuousFragments.length === 0) {
      return 0;
    }
    let lower = 0;
    let upper = this.continuousFragments.length - 1;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (scalar < this.continuousFragments[middle].endScalar) {
        upper = middle;
      } else {
        lower = middle + 1;
      }
    }
    return lower;
  }

  private setContinuousInitialAnchor(scalar: number): void {
    this.continuousVisibleScalar = scalar;
    const index = this.continuousFragmentIndexForScalar(scalar);
    const fragment = this.continuousFragments[index];
    const span = fragment === undefined ? 0 : Math.max(0, fragment.endScalar - fragment.startScalar);
    this.continuousInitialFragmentIndex = index;
    this.continuousInitialFragmentProgress = span === 0 ? 0 : Math.max(0, Math.min(1,
      (scalar - fragment.startScalar) / span));
    this.continuousVisibleFragmentIndex = index;
    this.continuousVisibleEndFragmentIndex = index;
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
      this.pendingPageHeight,
      this.pendingPageBodyCapacity(),
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
    return this.paragraphRanges.length > 0 && startScalar === this.paragraphRanges[0].startScalar;
  }

  private pendingPageBodyCapacity(): number {
    const pageStartScalar = this.pendingPageStartScalar >= 0 ?
      this.pendingPageStartScalar : this.measurementRequestedAnchorScalar;
    return this.readingLayout().bodyHeight(this.isChapterFirstPageStart(pageStartScalar));
  }

  private measurementTextWidth(): number {
    return this.readingLayout().bodyWidth();
  }

  private effectiveViewportWidth(): number {
    return this.viewportWidth > 0 ? this.viewportWidth :
      (this.isTablet ? READER_TABLET_REFERENCE_WIDTH : READER_PHONE_REFERENCE_WIDTH);
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
      this.measurementGeneration += 1;
      this.measurementSelectionToken = -1;
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
    this.cancelPageTurnSettlementDeadline();
    this.pageTurnSettlementDeadlineTimer = setTimeout((): void => {
      this.pageTurnSettlementDeadlineTimer = -1;
      if (!this.pageTurnSettlementActive || this.pageTurnSettlementGeneration !== generation) {
        return;
      }
      hilog.warn(0x5244, 'Reader',
        'Page turn settlement deadline fired; converging generation %{public}d', generation);
      if (this.bookTurnAwaitingSlotCommit) {
        // The visual endpoint and the durable transaction both finished; only
        // the native slot promotion event went missing.
        this.bookTurnAwaitingSlotCommit = false;
        this.finishSuccessfulPageTurnPresentation(generation);
        return;
      }
      if (this.pageTurnSettlingPrepared !== undefined) {
        if (this.pageTurnCommitFinished) {
          // The Core transaction settled but the native visual endpoint never
          // arrived; complete the promotion so UI and progress agree.
          this.pageTurnAnimationFinished = true;
          this.finishPreparedPageTurnSettlement(generation);
        } else {
          // Persistence never started writing (every step re-validates the
          // prepared turn); hand the rollback path its own armed deadline.
          this.pageTurnSettlingPrepared = undefined;
          this.pageTurnStoredProgress = undefined;
          this.pageTurnCommitStarted = false;
          this.animatePageTurnRollback();
        }
        return;
      }
      this.finishPageTurnRollback(generation);
    }, PAGE_TURN_SETTLEMENT_DEADLINE_MS);
  }

  private cancelPageTurnSettlementDeadline(): void {
    if (this.pageTurnSettlementDeadlineTimer >= 0) {
      clearTimeout(this.pageTurnSettlementDeadlineTimer);
      this.pageTurnSettlementDeadlineTimer = -1;
    }
  }

  private effectiveViewportHeight(): number {
    return this.viewportHeight > 0 ? this.viewportHeight :
      (this.isTablet ? READER_TABLET_REFERENCE_HEIGHT : READER_PHONE_REFERENCE_HEIGHT);
  }

  private readingLayout(): ReaderReadingLayoutSnapshot {
    if (this.pageTurnSettlementLayout !== undefined) {
      return this.pageTurnSettlementLayout;
    }
    return resolveReaderReadingLayout(
      this.effectiveViewportWidth(),
      this.effectiveViewportHeight(),
      this.isTablet,
      ReaderWindowCoordinator.metrics(),
      this.readerSettingsSnapshot.extendIntoCutout,
    );
  }

  private controlLayout(): ReaderControlLayoutSnapshot {
    return resolveReaderControlLayout(
      this.effectiveViewportWidth(),
      this.effectiveViewportHeight(),
      this.isTablet,
      ReaderWindowCoordinator.metrics(),
    );
  }

  private windowMetricsLayoutKey(): string {
    const layout = this.readingLayout();
    return [
      layout.widthClass,
      layout.viewportWidth,
      layout.viewportHeight,
      layout.contentTop,
      layout.contentRight,
      layout.contentBottom,
      layout.contentLeft,
      layout.titleTrackHeightVp,
      layout.systemFontScale,
      this.readerSettingsSnapshot.extendIntoCutout,
    ].join('|');
  }

  private readerSystemGestureLeftInset(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(16, this.finiteWindowInset(metrics.gestureInsets.left),
      this.finiteWindowInset(metrics.navigationInsets.left));
  }

  private readerSystemGestureRightInset(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(16, this.finiteWindowInset(metrics.gestureInsets.right),
      this.finiteWindowInset(metrics.navigationInsets.right));
  }

  private readerSystemGestureBottomInset(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(24, this.finiteWindowInset(metrics.gestureInsets.bottom),
      this.finiteWindowInset(metrics.navigationInsets.bottom));
  }

  private finiteWindowInset(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private normalizedProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
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
    const position = this.chapterWindow.position(this.currentChapterIndex());
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
    return new ReaderPageChromeSnapshot(
      this.bookTitle,
      this.pageChromeClockText,
      formatReaderPageProgress(this.pageChromeProgress(
        chapterIndex,
        pageStartScalar,
        chapterScalarCount,
      )),
      formatReaderPageOrdinal(this.pageChromeOrdinal(key, pageStartScalar, prefix)),
      sessionVisible,
      sessionVisible ? this.activeSessionCapsuleWidth() : 0,
      sessionVisible ? this.activeSessionCapsuleHeight() : 0,
    );
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
    const page = this.paginationIndex.findContainingPage(key, pageStartScalar);
    const last = this.paginationIndex.findLastPage(key);
    if (page !== undefined && last !== undefined) {
      return new ReaderPageOrdinal(page.pageIndex, last.pageIndex + 1);
    }
    if (prefix === undefined || !prefix.matches(key) || !prefix.startsAtRequest(0)) {
      return undefined;
    }
    const starts = prefix.pageStartScalars();
    let pageIndex = -1;
    for (let index = 0; index < starts.length; index += 1) {
      if (starts[index] <= pageStartScalar) {
        pageIndex = index;
      } else {
        break;
      }
    }
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
      return wholeBookProgressPercent(this.contentMetrics, chapterIndex, pageStartScalar);
    }
    const count = this.tocEntries.length;
    if (count === 0) {
      return 0;
    }
    let position = this.chapterWindow.position(chapterIndex);
    if (position < 0) {
      for (let index = 0; index < this.tocEntries.length; index += 1) {
        if (this.tocEntries[index].index === chapterIndex) {
          position = index;
          break;
        }
      }
    }
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
    const projectedByChapter = new Map<number, LocalReadingTocEntry>();
    for (const projected of this.tocEntries) {
      projectedByChapter.set(projected.index, projected);
    }
    const projection = this.directoryEntries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
      const projected = projectedByChapter.get(entry.index);
      return projected === undefined ? entry : {
        index: entry.index,
        title: projected.title,
        downloadState: entry.downloadState,
        bookmarks: entry.bookmarks,
      };
    });
    this.controlDirectoryParentSource = this.directoryEntries;
    this.controlDirectoryTocSource = this.tocEntries;
    this.controlDirectoryProjection = projection;
    return projection;
  }

  private initializeTtsSession(lifecycleToken: number): Promise<boolean> {
    if (this.ttsInitialization !== undefined) {
      return this.ttsInitialization;
    }
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
    // Voice enumeration and HTTP-engine management populate the full settings
    // surface, but neither is required to start foreground system speech. Load
    // them independently so the first play tap is not held behind slow platform
    // discovery on a physical device.
    void this.loadTtsPresentationMetadata(owner, coordinator, httpGateway, lifecycleToken);
    const initialization = coordinator.probeAvailability()
      .then((available: boolean): boolean => {
        if (!this.isMountedToken(lifecycleToken) || this.ttsCoordinator !== coordinator) return false;
        const config = coordinator.getProbedConfig();
        this.ttsConfig = config;
        this.ttsEngine = config?.engine ?? 'system';
        if (available && config !== undefined) {
          void coordinator.setRate(this.multiplierForCoreRate(config.rate))
            .catch((error: Error): void => this.logTtsFailure('initial-rate', error));
        }
        this.ttsAvailabilityResolved = true;
        return available;
      })
      .catch((error: Error): boolean => {
        if (this.isMountedToken(lifecycleToken) && this.ttsCoordinator === coordinator) {
          this.ttsAvailabilityResolved = true;
        }
        this.logTtsFailure('initialization', error);
        return false;
      });
    this.ttsInitialization = initialization;
    return initialization;
  }

  private async loadTtsPresentationMetadata(
    owner: ReaderRuntimeOwner,
    coordinator: ReaderTtsSessionCoordinator,
    httpGateway: ReaderHttpTtsGateway,
    lifecycleToken: number,
  ): Promise<void> {
    let httpEngines: ReaderHttpTtsConfig[] = [];
    let preferences: ReaderTtsPreferencesSnapshot | undefined = undefined;
    let voiceOptions: ReaderTtsVoiceOption[] = [];
    try {
      httpEngines = await httpGateway.list();
    } catch (error) {
      console.error(`Reader TTS optional HTTP engine list failed: ${this.errorMessage(error)}`);
    }
    try {
      preferences = await this.ttsPreferencesGateway.load();
    } catch (error) {
      console.error(`Reader TTS optional preferences failed: ${this.errorMessage(error)}`);
    }
    try {
      voiceOptions = await owner.getTtsHost().listSystemVoices();
    } catch (error) {
      console.error(`Reader TTS optional voice list failed: ${this.errorMessage(error)}`);
    }
    if (!this.isMountedToken(lifecycleToken) || this.ttsCoordinator !== coordinator) return;
    this.ttsHttpEngines = httpEngines;
    if (preferences !== undefined) {
      this.admitTtsPreferences(preferences, voiceOptions);
    } else {
      this.ttsVoiceOptions = voiceOptions;
    }
  }

  private admitTtsPreferences(
    preferences: ReaderTtsPreferencesSnapshot,
    voiceOptions: ReaderTtsVoiceOption[],
  ): void {
    let language = preferences.language;
    let person = preferences.person;
    let repairedVoice = false;
    if (voiceOptions.length > 0 && !voiceOptions.some((option: ReaderTtsVoiceOption): boolean =>
      option.language === language && option.person === person)) {
      const sameLanguage = voiceOptions.find(
        (option: ReaderTtsVoiceOption): boolean => option.language === language,
      );
      const fallback = sameLanguage ?? voiceOptions[0];
      language = fallback.language;
      person = fallback.person;
      repairedVoice = true;
    }
    this.ttsVoiceOptions = voiceOptions;
    this.ttsLanguage = language;
    this.ttsPerson = person;
    this.ttsPauseOnInterruption = preferences.pauseOnInterruption;
    this.ttsAllowMixing = preferences.allowMixing;
    this.ttsFailurePolicy = preferences.failurePolicy;
    this.ttsFollowHighlight = preferences.followHighlight;
    this.ttsCoordinator?.setPauseOnInterruption(preferences.pauseOnInterruption);
    this.ttsCoordinator?.setAllowMixing(preferences.allowMixing);
    this.ttsCoordinator?.setFailurePolicy(preferences.failurePolicy);
    if (repairedVoice) this.persistTtsPreferences();
  }

  private persistTtsPreferences(): void {
    const snapshot: ReaderTtsPreferencesSnapshot = {
      version: 1,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      failurePolicy: this.ttsFailurePolicy,
      followHighlight: this.ttsFollowHighlight,
    };
    void this.ttsPreferencesGateway.update(snapshot)
      .catch((error: Error): void => this.logTtsFailure('preference-persist', error));
  }

  private toggleTts(): void {
    // A user choosing TTS cancels any auto-page start that is waiting for the
    // preceding TTS stop barrier. Its continuation may still resolve, but its
    // generation can no longer start a second runtime.
    this.cancelPendingAutoPageStart();
    if (!this.ttsAvailabilityResolved) {
      const lifecycleToken = this.lifecycleToken;
      void this.initializeTtsSession(lifecycleToken).then((available: boolean): void => {
        if (available && this.isSessionActive(lifecycleToken)) {
          this.toggleTts();
        }
      });
      return;
    }
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined || this.ttsState.status === 'unavailable') return;
    if (this.ttsState.status === 'playing' || this.ttsState.status === 'preparing' ||
      this.ttsState.status === 'resuming') {
      void coordinator.pause().catch((error: Error): void => this.logTtsFailure('pause', error));
      return;
    }
    if (this.ttsState.status === 'paused' || this.ttsState.status === 'interrupted') {
      this.stopAutoPage();
      void coordinator.resume().catch((error: Error): void => this.logTtsFailure('resume', error));
      return;
    }
    if (this.ttsState.status === 'stopping') return;
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
      language: this.ttsLanguage,
      person: this.ttsPerson,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      failurePolicy: this.ttsFailurePolicy,
      timerDurationMs: this.ttsTimerDurationMs(),
    }).then((): void => {
      if (this.mounted && !this.exitRequested && this.ttsCoordinator === coordinator) {
        this.hideControl();
      }
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
    this.persistTtsPreferences();
  }

  private changeTtsFailurePolicy(policy: 'skip' | 'stop'): void {
    this.ttsFailurePolicy = policy;
    this.ttsCoordinator?.setFailurePolicy(policy);
    this.persistTtsPreferences();
  }

  private changeTtsFollowHighlight(enabled: boolean): void {
    this.ttsFollowHighlight = enabled;
    this.persistTtsPreferences();
  }

  private changeTtsPauseOnInterruption(enabled: boolean): void {
    this.ttsPauseOnInterruption = enabled;
    this.ttsCoordinator?.setPauseOnInterruption(enabled);
    this.persistTtsPreferences();
  }

  private changeTtsVoice(language: string, person: number): void {
    const option = this.ttsVoiceOptions.find((candidate: ReaderTtsVoiceOption): boolean =>
      candidate.language === language && candidate.person === person);
    if (option === undefined) return;
    this.ttsLanguage = option.language;
    this.ttsPerson = option.person;
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined) {
      this.persistTtsPreferences();
      return;
    }
    void coordinator.setVoice(option.language, option.person)
      .then((): void => this.persistTtsPreferences())
      .catch((error: Error): void => this.logTtsFailure('voice', error));
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
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, offset, chapterProgress),
          this.coreLayout(),
          isCurrent,
        );
        if (!isCurrent()) return;
        this.admitCommittedProgress(stored);
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
    if (this.autoPageState.status === 'paused') {
      this.autoPageState = resumeReaderAutoPage(this.autoPageState);
      this.hideControl();
      this.armAutoPageTimer(true);
      this.armAutoPageSessionTimer(false);
      return;
    }
    if (this.autoPageStartPending) return;
    const coordinator = this.ttsCoordinator;
    if (readerTtsSessionBlocksAutoPageStart(this.ttsState.status)) {
      if (coordinator === undefined) return;
      const generation = this.nextAutoPageStartGeneration();
      const lifecycleToken = this.lifecycleToken;
      this.autoPageStartPending = true;
      void coordinator.stop('user')
        .then((): void => {
          if (!this.isSessionActive(lifecycleToken) || !this.autoPageStartPending ||
            generation !== this.autoPageStartGeneration || this.ttsCoordinator !== coordinator ||
            this.autoPageState.status !== 'stopped') {
            return;
          }
          this.autoPageStartPending = false;
          this.startAutoPageSession();
        })
        .catch((error: Error): void => {
          if (generation !== this.autoPageStartGeneration) return;
          this.autoPageStartPending = false;
          this.logTtsFailure('stop before auto-page', error);
        });
      return;
    }
    this.startAutoPageSession();
  }

  private startAutoPageSession(): void {
    if (!this.mounted || this.exitRequested || this.phase !== 'ready' ||
      this.autoPageState.status !== 'stopped') {
      return;
    }
    this.autoPageState = startReaderAutoPage(this.autoPageState);
    this.hideControl();
    this.armAutoPageTimer(true);
    this.armAutoPageSessionTimer(true);
  }

  private stopAutoPage(): void {
    this.cancelPendingAutoPageStart();
    this.autoPageTurnPending = false;
    this.autoPageState = stopReaderAutoPage(this.autoPageState, 'manual');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.resetAutoPageSessionDuration();
  }

  private cancelPendingAutoPageStart(): void {
    this.nextAutoPageStartGeneration();
    this.autoPageStartPending = false;
  }

  private nextAutoPageStartGeneration(): number {
    this.autoPageStartGeneration = this.autoPageStartGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.autoPageStartGeneration + 1;
    return this.autoPageStartGeneration;
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

  private onReaderManualInteraction(): void {
    this.screenAwakeLease?.rearm();
    this.pauseAutoPageForInteraction();
  }

  private pauseAutoPage(reason: ReaderAutoPagePauseReason): void {
    if (this.autoPageState.status !== 'running') {
      return;
    }
    this.autoPageTurnPending = false;
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
      this.autoPageTurnPending = false;
      return;
    }
    const result = this.performPageTurn('next');
    if (result.kind === 'boundary' && result.edge === 'end') {
      this.autoPageTurnPending = false;
      this.autoPageState = endReaderAutoPageAtBookEnd(this.autoPageState, generation);
      this.clearAutoPageTimer();
      this.clearAutoPageSessionTimer();
      return;
    }
    if (result.kind === 'busy' || result.kind === 'preparing') {
      this.autoPageTurnPending = true;
      return;
    }
    this.autoPageTurnPending = false;
  }

  private resumePendingAutoPageTurn(): void {
    if (!this.autoPageTurnPending) return;
    if (this.autoPageState.status !== 'running' || !isReaderAutoPageTurnDue(this.autoPageState)) {
      this.autoPageTurnPending = false;
      return;
    }
    if (this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.pageTurnPreparation !== undefined || !this.canTurnPage()) return;
    const generation = this.autoPageState.generation;
    this.autoPageTurnPending = false;
    this.requestAutoPageTurn(generation);
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
      this.screenAwakeLease?.setForeground(false);
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
    this.screenAwakeLease?.setForeground(true);
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

  private onWindowChromeActiveChanged(): void {
    this.applyWindowChrome();
    this.applyWindowPolicyForChromeOwner();
  }

  private applyWindowPolicyForChromeOwner(): void {
    if (this.windowChromeActive) {
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot)
        .catch((_error: Error): void => {});
      return;
    }
    void ReaderWindowCoordinator.requestAppWindowPolicy()
      .catch((_error: Error): void => {});
  }

  private applyWindowChrome(): void {
    if (!this.windowChromeActive) {
      ReaderWindowCoordinator.requestAppChrome();
      return;
    }
    const themeStyle = readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme);
    const chromeStyle = new ReaderWindowChromeStyle(
      themeStyle.paperStart,
      readerAppearanceChromeTone(this.appearanceSnapshot.activeTheme),
    );
    if (this.windowChromeOverlayActive) {
      ReaderWindowCoordinator.requestOverlayChrome(chromeStyle);
      return;
    }
    ReaderWindowCoordinator.requestReaderChrome(chromeStyle);
  }

  private setControlPage(page: ReaderControlPage): void {
    if (page !== 'quickSearch' && page !== 'fullSearch') {
      this.searchGeneration += 1;
    }
    if (page !== 'quickReplace') {
      this.replacePanelGeneration += 1;
    }
    this.controlPage = page;
    const lifecycleToken = this.lifecycleToken;
    if (page === 'moduleTts' || page === 'fullTts') {
      void this.initializeTtsSession(lifecycleToken);
    } else if (page === 'moduleAppearance' || page === 'fullAppearance') {
      void this.loadChineseConversionMode(lifecycleToken);
    } else if (page === 'moduleSettings' || page === 'fullSettings') {
      void this.loadReaderSettingsSnapshot(lifecycleToken);
    }
  }

  private async loadAppearanceSnapshot(lifecycleToken: number): Promise<void> {
    const mutationGeneration = this.appearanceMutationGeneration;
    try {
      let snapshot = await this.appearanceGateway.load();
      if (snapshot.font === 'custom') {
        const registered = await this.appearanceGateway.registerCustomFont(
          this.getUIContext().getFont(),
          snapshot,
        );
        if (!registered) {
          snapshot = setReaderAppearanceFont(snapshot, 'serif');
          void this.appearanceGateway.update(snapshot);
        }
      }
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
    if (this.chineseConversionLoaded) {
      return;
    }
    const mutationGeneration = this.chineseConversionMutationGeneration;
    try {
      const mode = await this.chineseConversionGateway.getMode();
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.chineseConversionMutationGeneration) {
        return;
      }
      this.chineseConversionMode = mode;
      this.chineseConversionLoaded = true;
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
        this.chineseConversionLoaded = true;
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
      .catch((_error: Error): void => {
        // Do not admit an unpersisted mode. The selector stays on Core's last
        // confirmed setting and can be retried without creating a second store.
      });
  }

  private async loadReaderSettingsSnapshot(lifecycleToken: number): Promise<void> {
    if (this.readerSettingsLoaded) {
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
      this.configureReaderScreenAwakeLease(loadedSnapshot);
      this.applyReaderSystemEventPolicy(loadedSnapshot);
      await this.applyReaderWindowPolicy(loadedSnapshot);
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.readerSettingsMutationGeneration) {
        return;
      }
      this.readerSettingsSnapshot = loadedSnapshot;
      this.readerSettingsLoaded = true;
    } catch (_error) {
      // Keep locally-rendered behavior coherent with a failed Host request:
      // supported page-turn state survives, window-backed fields fail closed.
      this.readerSettingsSnapshot = this.safeWindowSettingsFallback(loadedSnapshot);
      this.readerSettingsLoaded = true;
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      void ReaderWindowCoordinator.requestReaderWindowPolicy(
        this.windowPolicyFor(this.readerSettingsSnapshot));
    }
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

  private changeReaderScreenTimeout(timeout: ReaderScreenTimeout): void {
    this.commitReaderWindowSettings(setReaderScreenTimeout(this.readerSettingsSnapshot, timeout));
  }

  private commitReaderSessionSettings(snapshot: ReaderSettingsSnapshot): void {
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    this.readerSettingsSnapshot = snapshot;
    this.readerSettingsLoaded = true;
    this.configureReaderScreenAwakeLease(snapshot);
    this.applyReaderSystemEventPolicy(snapshot);
    this.pageTurnRenderRevision += 1;
    void this.readerSettingsGateway.update(snapshot).catch((_error: Error): void => {
      // The mounted session continues with one coherent snapshot; the next
      // successful serialized update reconciles persistence.
    });
  }

  private commitReaderWindowSettings(snapshot: ReaderSettingsSnapshot): void {
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    const previous = this.readerSettingsSnapshot;
    this.readerSettingsSnapshot = snapshot;
    this.readerSettingsLoaded = true;
    this.configureReaderScreenAwakeLease(snapshot);
    this.applyReaderSystemEventPolicy(snapshot);
    void this.applyReaderWindowPolicy(snapshot)
      .then((): void => {
        if (!this.isSessionActive(lifecycleToken) ||
          generation !== this.readerSettingsMutationGeneration) {
          return;
        }
        const cutoutLayoutChanged = previous.extendIntoCutout !== snapshot.extendIntoCutout;
        if (cutoutLayoutChanged) {
          this.reflowAfterWindowGeometryChange();
        }
        void this.readerSettingsGateway.update(snapshot).catch((_error: Error): void => {
          // The applied Host state remains coherent for this session. A later
          // successful write serializes the same complete snapshot.
        });
      })
      .catch((_error: Error): void => {
        if (this.isSessionActive(lifecycleToken) &&
          generation === this.readerSettingsMutationGeneration) {
          this.readerSettingsSnapshot = previous;
          this.configureReaderScreenAwakeLease(previous);
          this.applyReaderSystemEventPolicy(previous);
          void this.applyReaderWindowPolicy(previous).catch((_rollbackError: Error): void => {});
        }
      });
  }

  private applyReaderWindowPolicy(snapshot: ReaderSettingsSnapshot): Promise<void> {
    return ReaderWindowCoordinator.requestReaderWindowPolicy(this.windowPolicyFor(snapshot));
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
    void ReaderWindowCoordinator.requestReaderWindowPolicy(this.windowPolicyFor(this.readerSettingsSnapshot))
      .catch((_error: Error): void => {
        // A later foreground/settings application retries the same semantic
        // lease state through the serialized Window coordinator.
      });
  }

  private applyReaderSystemEventPolicy(snapshot: ReaderSettingsSnapshot): void {
    this.readingSystemEventHost?.setVolumeKeyHandler(snapshot.volumeKeysTurnPage ?
      (direction: ReaderPageTurnDirection): void => this.onVolumeKeyPageTurn(direction) : undefined);
    this.readingSystemEventHost?.setScreenOffHandler(snapshot.stopTtsOnScreenOff ?
      (): void => this.stopTtsOnScreenOff() : undefined);
  }

  private onVolumeKeyPageTurn(direction: ReaderPageTurnDirection): void {
    this.onReaderManualInteraction();
    this.requestPageTurn(direction);
  }

  private stopTtsOnScreenOff(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined) {
      return;
    }
    void coordinator.stop('screenOff')
      .catch((error: Error): void => this.logTtsFailure('screen-off stop', error));
  }

  private windowPolicyFor(snapshot: ReaderSettingsSnapshot): ReaderWindowPolicy {
    return new ReaderWindowPolicy(
      snapshot.screenDirection,
      this.screenAwakeKeepScreenOn,
      snapshot.hideStatusBar,
      snapshot.hideNavigationBar,
      snapshot.extendIntoCutout,
    );
  }

  private safeWindowSettingsFallback(snapshot: ReaderSettingsSnapshot): ReaderSettingsSnapshot {
    return normalizeReaderSettingsSnapshot({
      version: 3,
      screenDirection: 'system',
      navigationMode: snapshot.navigationMode,
      pageTransition: snapshot.pageTransition,
      screenTimeout: 'system',
      hideStatusBar: true,
      hideNavigationBar: false,
      extendIntoCutout: false,
      justifyText: snapshot.justifyText,
      alignPageBottom: snapshot.alignPageBottom,
      volumeKeysTurnPage: snapshot.volumeKeysTurnPage,
      stopTtsOnScreenOff: snapshot.stopTtsOnScreenOff,
      longPressSelectText: snapshot.longPressSelectText,
    });
  }

  private changeReaderPageTurnStyle(style: ReaderPageTurnStyle): void {
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
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      if (snapshot.navigationMode === 'continuous') {
        this.rebuildContinuousFragments();
        this.setContinuousInitialAnchor(this.visiblePage?.startScalar ?? this.desiredChapterOffset);
        this.continuousProgressRevision += 1;
      } else {
        this.desiredChapterOffset = Math.max(0, Math.min(scalarCount, this.continuousVisibleScalar));
        this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
        this.beginMeasurement(this.lifecycleToken);
      }
    }
    if (changed && readerPageTransitionUsesPreparedPages(snapshot) && this.phase === 'ready') {
      this.schedulePageTurnPreparation();
    }
    void this.readerSettingsGateway.update(snapshot).catch((_error: Error): void => {
      // The selected runtime remains usable for this mounted session. The next
      // successful write reconciles the same single settings snapshot.
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

  private changeAppearanceFontOrder(fontOrder: ReaderAppearanceFontSlot[]): void {
    this.commitAppearanceSnapshot(setReaderAppearanceFontOrder(this.appearanceSnapshot, fontOrder));
  }

  private importReaderCustomFont(): void {
    const lifecycleToken = this.lifecycleToken;
    const generation = this.appearanceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceMutationGeneration + 1;
    this.appearanceMutationGeneration = generation;
    void this.appearanceGateway.importCustomFont(this.getUIContext().getFont())
      .then((descriptor): void => {
        if (!this.isSessionActive(lifecycleToken) || generation !== this.appearanceMutationGeneration ||
          descriptor === undefined) {
          return;
        }
        this.commitAppearanceSnapshot(setReaderAppearanceCustomFont(this.appearanceSnapshot, descriptor));
      })
      .catch((error: Error): void => {
        if (this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration) {
          console.error(`ReadingExperience custom font import failed: ${this.errorMessage(error)}`);
        }
      });
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
      value = this.appearanceSnapshot.fontSize + direction * READER_APPEARANCE_FONT_SIZE_STEP;
    } else if (metric === 'lineHeightMultiplier') {
      value = this.roundAppearanceMetric(
        this.appearanceSnapshot.lineHeightMultiplier + direction * READER_APPEARANCE_LINE_HEIGHT_STEP,
      );
    } else if (metric === 'paragraphSpacing') {
      value = this.appearanceSnapshot.paragraphSpacing + direction * READER_APPEARANCE_PARAGRAPH_SPACING_STEP;
    } else {
      value = this.roundAppearanceMetric(
        this.appearanceSnapshot.letterSpacing + direction * READER_APPEARANCE_LETTER_SPACING_STEP,
      );
    }
    const range = readerAppearanceMetricRange(metric);
    value = Math.min(range.maximum, Math.max(range.minimum, value));
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
    if (layoutChanged && this.pageTurnInputPhase() !== 'idle') {
      this.pageTurnPendingAppearanceSnapshot = snapshot;
      this.rollbackPageTurnForDeferredMutation();
      return;
    }
    if (layoutChanged) {
      this.invalidatePageTurnRuntime(true);
    }
    const previousLayoutSignature = layoutChanged && this.hasMeasuredViewport() ?
      this.paginationLayoutSignature() : undefined;
    const currentVisibleAnchor = this.readerSettingsSnapshot.navigationMode === 'continuous' ?
      this.continuousVisibleScalar : this.visiblePage !== undefined &&
      this.visiblePageSelectionToken === this.materializedChapterSelectionToken ?
      this.visiblePage.startScalar : this.desiredChapterOffset;

    this.appearanceSnapshot = snapshot;
    this.applyWindowChrome();
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
    return readerAppearanceSnapshotFontFamily(left) === readerAppearanceSnapshotFontFamily(right) &&
      left.fontSize === right.fontSize &&
      left.lineHeightMultiplier === right.lineHeightMultiplier &&
      left.paragraphSpacing === right.paragraphSpacing && left.letterSpacing === right.letterSpacing &&
      left.indent === right.indent && left.alignment === right.alignment;
  }

  private shouldShowSessionCapsule(): boolean {
    return this.sessionCapsuleSnapshot() !== undefined;
  }

  private sessionCapsuleType(): ReaderSessionCapsuleType {
    return this.sessionCapsuleSnapshot()?.type ?? 'autoPage';
  }

  private sessionCapsuleState(): 'playing' | 'paused' {
    return this.sessionCapsuleSnapshot()?.sessionState ?? 'paused';
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

  private liveSessionCapsuleSnapshot(): ReaderSessionCapsuleSnapshot | undefined {
    return deriveReaderSessionCapsule({
      mounted: this.mounted,
      exitRequested: this.exitRequested,
      pageReady: this.phase === 'ready',
      controlObscured: this.controlObscured,
      interactionBlocked: this.interactionBlocked,
      controlVisible: this.controlVisible,
      autoPageStatus: this.autoPageState.status,
      autoPageRemainingSeconds: this.autoPageState.remainingSeconds,
      ttsStatus: this.ttsState.status,
    });
  }

  private toggleSessionCapsule(): void {
    if (this.pageTurnInputPhase() !== 'idle') return;
    const snapshot = this.sessionCapsuleSnapshot();
    if (snapshot === undefined) return;
    if (snapshot.type === 'autoPage') {
      this.toggleAutoPage();
      return;
    }
    this.toggleTts();
  }

  private activeSessionCapsuleWidth(): number {
    const type = this.sessionCapsuleType();
    return this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredWidth > 0 ?
      this.sessionCapsuleMeasuredWidth : readerSessionCapsuleMinimumWidth(type);
  }

  private activeSessionCapsuleHeight(): number {
    return this.sessionCapsuleMeasuredHeight > 0 ?
      this.sessionCapsuleMeasuredHeight : READER_SESSION_CAPSULE_HEIGHT;
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

  private onSessionCapsuleMeasured(
    type: ReaderSessionCapsuleType,
    width: number,
    height: number,
  ): void {
    const snapshot = this.sessionCapsuleSnapshot();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      snapshot === undefined || type !== snapshot.type) {
      return;
    }
    if (this.pageChromeStateFrozen()) {
      this.pendingSessionCapsuleType = type;
      this.pendingSessionCapsuleWidth = width;
      this.pendingSessionCapsuleHeight = height;
      return;
    }
    this.admitSessionCapsuleMeasurement(type, width, height);
  }

  private admitSessionCapsuleMeasurement(
    type: ReaderSessionCapsuleType,
    width: number,
    height: number,
  ): void {
    if (this.measuredSessionCapsuleType === type &&
      Math.abs(this.sessionCapsuleMeasuredWidth - width) < 0.01 &&
      Math.abs(this.sessionCapsuleMeasuredHeight - height) < 0.01) {
      return;
    }
    this.measuredSessionCapsuleType = type;
    this.sessionCapsuleMeasuredWidth = width;
    this.sessionCapsuleMeasuredHeight = height;
    this.pageTurnRenderRevision += 1;
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
    this.pageTurnSessionCapsuleFrozen = false;
    this.pageTurnSessionCapsuleSnapshot = undefined;
    const clockText = this.pendingPageChromeClockText;
    this.pendingPageChromeClockText = undefined;
    if (clockText !== undefined) {
      this.admitPageChromeClock(clockText);
    }
    const type = this.pendingSessionCapsuleType;
    const width = this.pendingSessionCapsuleWidth;
    const height = this.pendingSessionCapsuleHeight;
    this.pendingSessionCapsuleType = undefined;
    this.pendingSessionCapsuleWidth = 0;
    this.pendingSessionCapsuleHeight = 0;
    const snapshot = this.sessionCapsuleSnapshot();
    if (type !== undefined && snapshot !== undefined && type === snapshot.type && width > 0 && height > 0) {
      this.admitSessionCapsuleMeasurement(type, width, height);
    }
  }

  private isReaderPageInteractionEnabled(): boolean {
    // Once a committed page is visible, speculative neighbour preparation
    // must never disable the full-screen arena or the centre control tap.
    // Page/bookmark motion is gated separately by canStartReaderPageTurn and
    // canStartReaderBookmarkGesture while the background lane is busy.
    const pageCanReceiveInput = this.phase === 'ready' || this.visiblePage !== undefined;
    return this.mounted && !this.exitRequested && !this.controlVisible && !this.controlObscured &&
      !this.interactionBlocked && pageCanReceiveInput;
  }

  /**
   * Only a visual/Core settlement is non-interruptible. Speculative neighbour
   * measurement has its own readiness gate and must leave controls responsive.
   */
  private pageTurnTapOnlyInput(): boolean {
    return this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined;
  }

  /** One derived phase is the only control/page-turn ownership decision. */
  private pageTurnInputPhase(): ReaderPageTurnInputPhase {
    if (this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.pageTurnGestureState.phase === 'settling') return 'settling';
    if (this.pageTurnGestureState.phase === 'dragging') return 'dragging';
    if (this.pageTurnGestureState.phase === 'tracking') return 'tracking';
    return 'idle';
  }

  /** Geometry/layout mutations wait for an active sheet to roll back first. */
  private rollbackPageTurnForDeferredMutation(): void {
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
    if (!this.usesBookTurnSimulation() || this.pageTurnSettlingPrepared === undefined ||
      this.pageTurnAnimationFinished || this.pageTurnCommitStarted) return false;
    const generation = this.pageTurnSettlementGeneration;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
    this.autoPageState = retryReaderAutoPageTurn(this.autoPageState, this.autoPageState.generation);
    if (!this.bookTurnSession.settle(generation, false)) {
      this.failBookTurnRuntime();
    }
    return true;
  }

  /** Page-turn and control surfaces are mutually exclusive input owners. */
  private pageTurnOwnsReaderInput(): boolean {
    return this.pageTurnInputPhase() !== 'idle';
  }

  private openReaderControl(): void {
    if (!this.isReaderPageInteractionEnabled() || this.pageTurnOwnsReaderInput()) {
      return;
    }
    this.controlShellExitGeneration += 1;
    this.controlShellExitArmed = false;
    this.controlPage = 'home';
    this.controlVisible = true;
    void this.loadContentMetricsIfNeeded(this.lifecycleToken);
    this.refreshReaderBrightness();
  }

  private hideControl(): void {
    if (!this.controlVisible || this.controlShellExitArmed) {
      return;
    }
    this.searchGeneration += 1;
    this.replacePanelGeneration += 1;
    // First present one frame with every nested page/content transition
    // disabled. The next frame removes the shell, so only TopBar/ControlDock's
    // Figma reader.control.hide transition runs; text, icons, background and
    // border remain one visual actor for the complete 360 ms exit.
    const exitGeneration = this.controlShellExitGeneration + 1;
    this.controlShellExitGeneration = exitGeneration;
    this.controlShellExitArmed = true;
    const pageTurnGeneration = this.pageTurnGeneration;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (exitGeneration !== this.controlShellExitGeneration || !this.controlVisible) {
        return;
      }
      this.controlVisible = false;
      if (pageTurnGeneration === this.pageTurnGeneration) {
        this.drainPageTurnPreparationQueue();
      }
    }));
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

  private previewQuickReplace(): void {
    const chapter = this.chapter;
    if (chapter === undefined || this.replaceState.kind !== 'ready') {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const selectionToken = this.chapterSelectionToken;
    const panelGeneration = this.replacePanelGeneration;
    void this.replaceGateway.preview(this.sourceId, this.bookId, chapter.chapterIndex)
      .then((preview: ReaderReplacePreview): void => {
        if (!this.isSelectionActive(lifecycleToken, selectionToken) ||
          panelGeneration !== this.replacePanelGeneration || this.controlPage !== 'quickReplace' ||
          this.chapter !== chapter) {
          return;
        }
        this.showReplacePreview(preview);
      })
      .catch((_error: Error): void => {
        if (this.isSelectionActive(lifecycleToken, selectionToken) &&
          panelGeneration === this.replacePanelGeneration && this.controlPage === 'quickReplace') {
          this.getUIContext().showAlertDialog({
            title: '替换预览',
            message: '当前章节原文缓存不可用，无法生成预览。',
            confirm: { value: '关闭', action: (): void => {} },
          });
        }
      });
  }

  private showReplacePreview(preview: ReaderReplacePreview): void {
    const summary = preview.changed ?
      `已启用 ${preview.enabledRuleCount}/${preview.storedRuleCount} 条规则` :
      `已启用 ${preview.enabledRuleCount}/${preview.storedRuleCount} 条规则，本章正文无变化`;
    const suffix = preview.truncated ? '\n\n（内容已截取）' : '';
    this.getUIContext().showAlertDialog({
      title: `替换预览 · ${preview.chapterTitle}`,
      message: `${summary}\n\n替换前\n${preview.before}\n\n替换后\n${preview.after}${suffix}`,
      confirm: { value: '关闭', action: (): void => {} },
    });
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
        this.rememberInitialWindowBrightness(brightness);
        this.admitReaderBrightness(brightness);
      })
      .catch((error: Error): void => {
        console.error(`Reader brightness read failed: ${error.message}`);
      });
  }

  private setReaderBrightness(percent: number): void {
    const normalized = Math.max(READER_CONTROL_BRIGHTNESS_MIN / READER_CONTROL_BRIGHTNESS_MAX,
      Math.min(1, percent / READER_CONTROL_BRIGHTNESS_MAX));
    this.enqueueReaderBrightness(normalized, 'manual');
  }

  private setReaderAutomaticBrightness(): void {
    this.enqueueReaderBrightness(-1, 'automatic');
  }

  /**
   * Window brightness writes are serialized. Generation checks suppress work
   * that has not started; a write already in flight is always followed by the
   * newest queued intent, so an older Promise cannot become the final device
   * state after a rapid manual/automatic switch.
   */
  private enqueueReaderBrightness(target: number, mode: 'manual' | 'automatic'): void {
    const hostContext = this.getUIContext().getHostContext();
    if (hostContext === undefined) {
      return;
    }
    const generation = this.brightnessRequestGeneration + 1;
    this.brightnessRequestGeneration = generation;
    this.brightnessPolicyTouched = true;
    this.brightnessMutationQueue = this.brightnessMutationQueue
      .catch((_error: Error): void => {})
      .then((): Promise<void> => {
        if (!this.mounted || generation !== this.brightnessRequestGeneration) {
          return Promise.resolve();
        }
        return window.getLastWindow(hostContext)
          .then((readerWindow: window.Window): Promise<void> => {
            if (!this.mounted || generation !== this.brightnessRequestGeneration) {
              return Promise.resolve();
            }
            this.rememberInitialWindowBrightness(readerWindow.getWindowProperties().brightness);
            return readerWindow.setWindowBrightness(target)
              .then((): void => {
                if (!this.mounted || generation !== this.brightnessRequestGeneration) {
                  return;
                }
                this.admitReaderBrightness(readerWindow.getWindowProperties().brightness);
                console.info(mode === 'automatic' ?
                  'Reader brightness restored to system automatic' :
                  `Reader brightness applied: ${target.toFixed(2)}`);
              });
          });
      })
      .catch((error: Error): void => {
        if (this.mounted && generation === this.brightnessRequestGeneration) {
          console.error(`Reader brightness ${mode} failed: ${error.message}`);
          this.refreshReaderBrightness();
        }
      });
  }

  private rememberInitialWindowBrightness(brightness: number): void {
    if (this.initialWindowBrightness === undefined && Number.isFinite(brightness)) {
      this.initialWindowBrightness = brightness;
    }
  }

  private admitReaderBrightness(brightness: number): void {
    if (!Number.isFinite(brightness)) {
      return;
    }
    this.brightnessAutomatic = brightness < 0;
    if (brightness >= 0) {
      this.brightnessPercent = Math.max(READER_CONTROL_BRIGHTNESS_MIN,
        Math.min(READER_CONTROL_BRIGHTNESS_MAX,
          Math.round(brightness * READER_CONTROL_BRIGHTNESS_MAX)));
    }
  }

  /** Restore the window policy that existed before this reader owned it. */
  private restoreInitialWindowBrightness(): void {
    const generation = this.brightnessRequestGeneration + 1;
    this.brightnessRequestGeneration = generation;
    if (!this.brightnessPolicyTouched) {
      return;
    }
    const hostContext = this.getUIContext().getHostContext();
    if (hostContext === undefined) {
      return;
    }
    this.brightnessMutationQueue = this.brightnessMutationQueue
      .catch((_error: Error): void => {})
      .then((): Promise<void> => window.getLastWindow(hostContext)
        .then((readerWindow: window.Window): Promise<void> => {
          if (generation !== this.brightnessRequestGeneration) {
            return Promise.resolve();
          }
          const restoreTarget = this.initialWindowBrightness === undefined ? -1 : this.initialWindowBrightness;
          return readerWindow.setWindowBrightness(restoreTarget);
        }))
      .catch((error: Error): void => {
        console.error(`Reader brightness exit restore failed: ${error.message}`);
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
    if (keyword.length === 0 || !this.controlVisible ||
      (this.controlPage !== 'quickSearch' && this.controlPage !== 'fullSearch')) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const searchGeneration = this.searchGeneration + 1;
    this.searchGeneration = searchGeneration;
    this.quickSearchState = { kind: 'loading', keyword };
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      searchGeneration === this.searchGeneration && this.controlVisible &&
      (this.controlPage === 'quickSearch' || this.controlPage === 'fullSearch');
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
    if (this.pageTurnSettlementActive) {
      this.pageTurnPendingChapterSelection = new ReaderDeferredChapterSelection(
        chapterIndex,
        chapterOffset,
        requireChapterStart,
        stopTts,
        requestedProgress,
      );
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

  private captureMaterializedChapterContext(): ReaderMaterializedChapterContext {
    const chapter = this.requireChapter();
    return new ReaderMaterializedChapterContext(
      chapter,
      this.requireChapterLayoutMap(),
      this.materializedContentVersion,
      this.copyParagraphRanges(this.paragraphRanges),
      this.paginationDraft,
      this.desiredChapterOffset,
      this.desiredChapterProgress,
      this.measurementRequestedAnchorScalar,
    );
  }

  private restoreMaterializedChapterContext(
    context: ReaderMaterializedChapterContext,
    admitWindowCurrent: boolean,
  ): void {
    this.chapter = context.chapter;
    this.rebuildChapterImageIndexes(context.chapter);
    this.chapterLayoutMap = context.layoutMap;
    this.materializedContentVersion = context.contentVersion;
    this.paragraphRanges.splice(0, this.paragraphRanges.length, ...this.copyParagraphRanges(context.paragraphRanges));
    this.paginationDraft = context.paginationDraft;
    this.desiredChapterOffset = context.desiredChapterOffset;
    this.desiredChapterProgress = context.desiredChapterProgress;
    this.measurementRequestedAnchorScalar = context.measurementRequestedAnchorScalar;
    this.materializedChapterSelectionToken = this.chapterSelectionToken;
    if (admitWindowCurrent) {
      this.chapterWindow.setCurrent(context.chapter);
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
  private invalidatePageTurnRuntime(restorePreparation: boolean): void {
    this.finishPageTurnPerf('invalidated');
    const preparation = this.pageTurnPreparation;
    const discovery = this.previousChapterMeasurement?.prepareOnly ?
      this.previousChapterMeasurement : undefined;
    this.pageTurnGeneration += 1;
    this.pageTurnSettlementGeneration += 1;
    this.pageTurnPreparation = undefined;
    if (discovery !== undefined) this.previousChapterMeasurement = undefined;
    this.pageTurnPreparationQueue = [];
    this.pendingManualPageTurnIntent = undefined;
    this.pendingPointerSegmentReserved = false;
    this.autoPageTurnPending = false;
    this.preparedPreviousPage = undefined;
    this.preparedNextPage = undefined;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnAnimationFinished = false;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnSettlementActive = false;
    this.cancelPageTurnSettlementDeadline();
    this.pageTurnPresentationWidth = 0;
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.pageTurnGestureState = createReaderPageGestureState();
    this.pageTurnInputOwned = false;
    this.pageTurnSessionCapsuleFrozen = false;
    this.pageTurnSessionCapsuleSnapshot = undefined;
    this.pageTurnCommitStarted = false;
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookmarkPageOffsetY = 0;
    this.bookmarkPreviewChanged = false;
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    this.clearBookTurnCapturedIdentities();
    this.pageTurnRenderRevision += 1;
    if (preparation === undefined && discovery === undefined) {
      this.releaseUnretainedReadingImages();
      return;
    }

    this.measurementGeneration += 1;
    this.measurementSelectionToken = -1;
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.measurementBatch.length = 0;
    this.resetPendingPage();
    this.cancelMeasurementDeadline();
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
    console.error(`ReadingExperience page-turn preparation failed: ${this.errorMessage(error)}`);
    this.pageTurnPreparation = undefined;
    this.measurementGeneration += 1;
    this.measurementSelectionToken = -1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.measurementBatch.length = 0;
    this.resetPendingPage();
    this.cancelMeasurementDeadline();
    this.measurementEpoch += 1;
    this.restoreMaterializedChapterContext(preparation.origin, false);
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.releaseUnretainedReadingImages();
    this.scheduleBookTurnTextureRefresh();
  }

  private schedulePageTurnPreparation(): void {
    this.pageTurnGeneration += 1;
    this.preparedPreviousPage = undefined;
    this.preparedNextPage = undefined;
    this.pageTurnPreparationQueue = readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ?
      ['next', 'previous'] : [];
    this.pageTurnRenderRevision += 1;
    const generation = this.pageTurnGeneration;
    setTimeout((): void => {
      if (generation === this.pageTurnGeneration) {
        this.drainPageTurnPreparationQueue();
      }
    }, 0);
  }

  /** Queue work only from lifecycle/prefetch completion, never from an active Pan. */
  private queuePageTurnPreparation(direction: ReaderPageTurnDirection): void {
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.pageTurnPreparationQueue.indexOf(direction) >= 0 ||
      this.preparedPageTurn(direction) !== undefined) {
      return;
    }
    this.pageTurnPreparationQueue.push(direction);
    this.drainPageTurnPreparationQueue();
  }

  private drainPageTurnPreparationQueue(): void {
    for (;;) {
      if (this.pageTurnPreparation !== undefined || this.pageTurnSettlingPrepared !== undefined ||
        this.pageTurnGestureState.phase !== 'idle' ||
        !readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) || !this.canTurnPage()) {
        return;
      }
      const direction = this.pageTurnPreparationQueue.shift();
      if (direction === undefined) {
        this.scheduleBookTurnTextureRefresh();
        return;
      }
      if (this.preparedPageTurn(direction) !== undefined) {
        continue;
      }
      const target = this.adjacentPageTurnTarget(direction);
      if (target === undefined && direction === 'previous' &&
        this.knownPageTurnBoundary(direction) === undefined &&
        this.startPreviousPagePreparationDiscovery()) {
        return;
      }
      if (target === undefined) {
        continue;
      }
      const outcome = this.beginPageTurnPreparation(direction, target);
      if (outcome === 'begun') {
        this.cancelPageTurnPreparationRetry();
        return;
      }
      if (outcome === 'abandon') {
        continue;
      }
      // Transiently rejected (measurement lane busy or lane not ready yet).
      // Re-queue at the head so this direction is retried on a backoff timer
      // instead of being silently dropped — cold entry can pop a direction
      // while the initial restore still owns the measurement lane.
      this.pageTurnPreparationQueue.unshift(direction);
      if (this.pageTurnPreparationRetryTimer >= 0) {
        return;
      }
      const count = this.pageTurnPreparationRetryCount;
      if (count >= PAGE_TURN_PREPARATION_RETRY_LIMIT) {
        this.pageTurnPreparationQueue = [];
        this.pageTurnPreparationRetryCount = 0;
        return;
      }
      const delay = Math.min(
        PAGE_TURN_PREPARATION_RETRY_MAX_MS,
        PAGE_TURN_PREPARATION_RETRY_BASE_MS * Math.pow(2, count),
      );
      this.pageTurnPreparationRetryCount = count + 1;
      const generation = this.pageTurnGeneration;
      const token = this.chapterSelectionToken;
      this.pageTurnPreparationRetryTimer = setTimeout((): void => {
        this.pageTurnPreparationRetryTimer = -1;
        if (this.pageTurnGeneration !== generation || this.chapterSelectionToken !== token) {
          this.pageTurnPreparationQueue = [];
          this.pageTurnPreparationRetryCount = 0;
          return;
        }
        this.drainPageTurnPreparationQueue();
      }, delay);
      return;
    }
  }

  private cancelPageTurnPreparationRetry(): void {
    if (this.pageTurnPreparationRetryTimer < 0) {
      return;
    }
    clearTimeout(this.pageTurnPreparationRetryTimer);
    this.pageTurnPreparationRetryTimer = -1;
    this.pageTurnPreparationRetryCount = 0;
  }

  private adjacentPageTurnTarget(direction: ReaderPageTurnDirection): ReaderPageTurnTarget | undefined {
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (page === undefined || chapter === undefined) {
      return undefined;
    }
    if (direction === 'next') {
      const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
      if (page.endScalar <= lastVisible) {
        return new ReaderPageTurnTarget(chapter.chapterIndex, page.endScalar);
      }
      const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
      return nextChapter === undefined ? undefined : new ReaderPageTurnTarget(nextChapter, 0);
    }

    const key = this.currentPaginationKey();
    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const containingPage = this.paginationIndex.findContainingPage(key, page.startScalar);
    if (containingPage === undefined) {
      const prefix = this.paginationDraft;
      const previousRequest = prefix !== undefined && prefix.matches(key) ?
        prefix.previousRequestForPageStart(page.startScalar) : undefined;
      if (previousRequest !== undefined) {
        return new ReaderPageTurnTarget(chapter.chapterIndex, previousRequest);
      }
      return undefined;
    }
    const previousChapterKey = containingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
      this.paginationKeyForChapter(previousChapterIndex) ?? null : null;
    const previous = this.paginationIndex.findPreviousPage(key, page.startScalar, previousChapterKey);
    return previous.kind === 'page' ?
      new ReaderPageTurnTarget(previous.page.key.chapterIndex, previous.page.startScalar) : undefined;
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
      this.paragraphRanges.length === 0 || !this.canTurnPage()) {
      return false;
    }
    const origin = this.captureMaterializedChapterContext();
    this.resetPaginationDraft();
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapter.chapterIndex,
      page.startScalar,
      chapter.chapterIndex,
      true,
      origin,
      this.pageTurnGeneration,
    );
    this.desiredChapterOffset = this.paragraphRanges[0].startScalar;
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
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
      return 'abandon';
    }
    const origin = this.captureMaterializedChapterContext();
    const targetMap = target.chapterIndex === originChapter.chapterIndex ?
      origin.layoutMap : new ReadingSurfaceLayoutMap(targetChapter.content);
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
    this.restoreMaterializedChapterContext(targetContext, false);
    this.beginMeasurement(this.lifecycleToken);
    if (this.phase !== 'measuring') {
      // The lane rejected the measurement (remasurePending, viewport lost,
      // superseded selection). The materialized context above is now the
      // target's, not the visible page's — restoring the origin context keeps
      // later turns from acting on a swapped context the user never saw.
      this.restoreMaterializedChapterContext(origin, false);
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
    return prepared !== undefined && this.isPreparedPageTurnFresh(prepared) ? prepared : undefined;
  }

  private canStartReaderPageTurn(direction: ReaderPageTurnDirection): boolean {
    // A visible page remains touchable while its neighbours are prepared, but
    // it cannot start motion against a temporarily swapped measurement context.
    if (!this.canTurnPage()) return false;
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.usesNoAnimationPageTurnRuntime()) return true;
    const prepared = this.preparedPageTurn(direction);
    if (prepared === undefined) return false;
    if (!this.usesBookTurnSimulation()) return true;
    if (this.bookTurnRuntimeFailed ||
      (this.bookTurnMotion !== undefined && this.bookTurnMotion.direction !== direction)) return false;
    const current = this.currentPageTurnRenderPage();
    const adjacent = this.preparedPageTurnRenderPage(direction);
    return adjacent !== undefined &&
      this.bookTurnCapturedCurrentIdentity === current.textureIdentity &&
      this.bookTurnCapturedIdentity(direction === 'next' ?
        BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS) === adjacent.textureIdentity &&
      this.bookTurnSession.canStart(direction);
  }

  private canStartReaderBookmarkGesture(): boolean {
    return this.canTurnPage();
  }

  private onReaderPageGestureDecision(decision: ReaderPageGestureDecision): ReaderPageGestureDecision {
    return decision;
  }

  private onReaderPageGestureStateChanged(state: ReaderPageGestureState): void {
    const previousPhase = this.pageTurnGestureState.phase;
    if (!this.pageTurnSessionCapsuleFrozen &&
      (state.phase === 'tracking' || state.phase === 'dragging')) {
      this.pageTurnSessionCapsuleSnapshot = this.liveSessionCapsuleSnapshot();
      this.pageTurnSessionCapsuleFrozen = true;
    }
    this.pageTurnGestureState = state;
    if (state.phase === 'dragging' && state.direction !== undefined) {
      this.beginPageTurnPerf(state.direction, 'gesture');
    }
    const ownsInput = state.phase !== 'idle';
    if (this.pageTurnInputOwned !== ownsInput) this.pageTurnInputOwned = ownsInput;
    if (this.usesBookTurnSimulation()) {
      if (previousPhase === 'idle' && state.phase !== 'idle') {
        // ComponentSnapshot cannot be cancelled after dispatch, but changing
        // this generation prevents an idle capture from uploading after the
        // first gesture-owned frame.
        this.bookTurnTextureCaptureGeneration += 1;
        this.bookTurnTextureCaptureScheduled = false;
      }
      this.updateBookTurnGesturePresentation(state);
      return;
    }
    if (!readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ||
      this.usesNoAnimationPageTurnRuntime()) {
      this.pageTurnDirection = undefined;
      this.pageTurnOffsetX = 0;
      if (state.phase === 'idle') this.flushDeferredPageChromeState();
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
        if (this.pageTurnPreparationQueue.indexOf(state.direction) < 0) {
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
      if (state.phase === 'idle' && this.pageTurnPreparationQueue.length > 0) {
        this.drainPageTurnPreparationQueue();
      }
    }
  }

  private updateBookTurnGesturePresentation(state: ReaderPageGestureState): void {
    this.pageTurnOffsetX = 0;
    if (state.phase === 'dragging' && state.direction !== undefined &&
      (state.owner === 'horizontalPage' || state.owner === 'verticalPrevious')) {
      if (this.preparedPageTurn(state.direction) === undefined) {
        // Symmetric with the tap path (performPageTurn preparing branch): queue
        // the missing preparation instead of a silent drop. The drain's own
        // gesture guard defers the work until the gesture returns to idle.
        if (this.pageTurnPreparationQueue.indexOf(state.direction) < 0) {
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
          state.verticalPrevious,
          state.viewportWidth,
          state.viewportHeight,
          state.startLocalX,
          state.startLocalY,
          state.currentLocalX,
          state.currentLocalY,
          state.eventTimeMs,
        );
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
      if (state.phase === 'idle' && this.pageTurnPreparationQueue.length > 0) {
        this.drainPageTurnPreparationQueue();
      }
    }
  }

  private onReaderBookmarkGestureStateChanged(state: ReaderPageGestureState): void {
    if (state.owner !== 'bookmark') return;
    this.bookmarkPageOffsetY = state.bookmarkOffsetY;
    this.bookmarkPreviewChanged = state.bookmarkPreviewChanged;
  }

  private onReaderBookmarkGestureReleased(changed: boolean): void {
    if (changed) this.toggleCurrentPageBookmark();
    this.getUIContext().animateTo(
      motionAnimateParam('reader.bookmark.rollback', (): void => {
        this.bookmarkPageOffsetY = 0;
        this.bookmarkPreviewChanged = false;
        this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
        this.pageTurnInputOwned = false;
        this.flushDeferredPageChromeState();
        this.drainPageTurnPreparationQueue();
      }),
      (): void => {
        this.bookmarkPageOffsetY = 0;
      },
    );
  }

  private toggleCurrentPageBookmark(): void {
    const page = this.visiblePage;
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
      const insidePage = page.endScalar > page.startScalar ?
        bookmark.chapterOffset >= page.startScalar && bookmark.chapterOffset < page.endScalar :
        bookmark.chapterOffset === page.startScalar;
      if (insidePage && Number.isSafeInteger(bookmark.time)) {
        bookmarkTimes.push(bookmark.time);
      }
    }
    this.onTogglePageBookmark({
      chapterIndex,
      chapterOffset: page.startScalar,
      chapterTitle: currentEntry.title,
      bookmarkTimes,
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
    this.pageTurnPerfStartedAtMs = Date.now();
    this.pageTurnPerfStyle = this.effectivePageTurnStyle();
    this.pageTurnPerfPath = path;
    this.pageTurnPerfDirection = direction;
  }

  private finishPageTurnPerf(outcome: string): void {
    if (this.pageTurnPerfStartedAtMs <= 0) return;
    const totalMs = Math.max(0, Date.now() - this.pageTurnPerfStartedAtMs);
    hilog.info(0x5244, 'Reader',
      'PAGETURN_PERF style=%{public}s path=%{public}s dir=%{public}s outcome=%{public}s totalMs=%{public}d',
      this.pageTurnPerfStyle, this.pageTurnPerfPath, this.pageTurnPerfDirection, outcome, totalMs);
    this.pageTurnPerfStartedAtMs = 0;
    this.pageTurnPerfStyle = '';
    this.pageTurnPerfPath = '';
    this.pageTurnPerfDirection = '';
  }

  private animatePageTurnRollback(): void {
    if (this.pageTurnSettlingPrepared !== undefined) return;
    if (this.pageTurnSettlementLayout === undefined) {
      this.pageTurnSettlementLayout = this.readingLayout();
    }
    this.pageTurnSettlementActive = true;
    this.pageTurnInputOwned = true;
    this.pageTurnCommitStarted = false;
    if (this.pageTurnPresentationWidth <= 0) this.pageTurnPresentationWidth = this.viewportWidth;
    const simulation = this.usesBookTurnSimulation();
    const generation = simulation && this.bookTurnMotion !== undefined ?
      this.bookTurnMotion.generation : this.pageTurnSettlementGeneration + 1;
    this.pageTurnSettlementGeneration = generation;
    this.pageTurnAnimationFinished = false;
    this.armPageTurnSettlementDeadline(generation);
    if (simulation) {
      if (this.bookTurnMotion !== undefined) stopBookTurnMotion(this.bookTurnMotion);
      if (!this.bookTurnSession.settle(generation, false)) {
        this.bookTurnRuntimeFailed = true;
        this.finishPageTurnRollback(generation);
      }
      return;
    }
    if (this.pageTurnOffsetX === 0 || this.usesNoAnimationPageTurnRuntime()) {
      this.finishPageTurnRollback(generation);
      return;
    }
    this.getUIContext().animateTo(
      motionRemainingDistanceAnimateParam(
        'reader.page.slide.rollback',
        this.pageTurnRemainingDistanceRatio(0),
        (): void => this.finishPageTurnRollback(generation),
      ),
      (): void => {
        this.pageTurnOffsetX = 0;
      },
    );
  }

  private finishPageTurnRollback(generation: number): void {
    if (generation !== this.pageTurnSettlementGeneration) return;
    this.finishPageTurnPerf('rollback');
    this.cancelPageTurnSettlementDeadline();
    this.pageTurnAnimationFinished = true;
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    this.pageTurnInputOwned = false;
    this.pageTurnSettlementActive = false;
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnPresentationWidth = 0;
    this.pageTurnCommitStarted = false;
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookmarkPageOffsetY = 0;
    this.bookmarkPreviewChanged = false;
    this.flushDeferredPageChromeState();
    this.resumeDeferredPageTurnWork();
    this.drainPendingManualPageTurn();
    this.resumePendingAutoPageTurn();
    this.drainPageTurnPreparationQueue();
    if (this.isSessionActive(this.lifecycleToken) && this.autoPageState.status === 'running' &&
      !this.autoPageState.awaitingPageCommit) {
      this.armAutoPageTimer(true);
    }
    this.scheduleBookTurnTextureRefresh();
  }

  private startPreparedPageTurnSettlement(
    direction: ReaderPageTurnDirection,
    prepared: PreparedReaderPageTurn,
  ): boolean {
    if (!this.isPreparedPageTurnFresh(prepared) || this.pageTurnSettlingPrepared !== undefined ||
      this.viewportWidth <= 0) {
      return false;
    }
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    const lifecycleToken = this.lifecycleToken;
    const simulation = this.usesBookTurnSimulation();
    const noAnimation = this.usesNoAnimationPageTurnRuntime();
    const settlementGeneration = simulation && this.bookTurnMotion !== undefined ?
      this.bookTurnMotion.generation : this.pageTurnSettlementGeneration + 1;
    this.beginPageTurnPerf(direction, 'prepared');
    this.pageTurnSettlementLayout = this.readingLayout();
    this.pageTurnSettlementGeneration = settlementGeneration;
    this.pageTurnSettlementActive = true;
    this.pageTurnPresentationWidth = this.viewportWidth;
    this.pageTurnSettlingPrepared = prepared;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
    this.pageTurnCommitStarted = false;
    this.pageTurnAnimationFinished = noAnimation && !simulation;
    this.pageTurnDirection = direction;
    this.pageTurnInputOwned = true;
    this.armPageTurnSettlementDeadline(settlementGeneration);

    const targetOffset = direction === 'next' ? -this.viewportWidth : this.viewportWidth;
    if (simulation) {
      const started = this.bookTurnMotion !== undefined ?
        this.bookTurnSession.settle(settlementGeneration, true) :
        this.bookTurnSession.startProgrammatic(settlementGeneration, direction);
      if (this.bookTurnMotion !== undefined) stopBookTurnMotion(this.bookTurnMotion);
      if (!started) {
        this.bookTurnRuntimeFailed = true;
        this.pageTurnSettlingPrepared = undefined;
        this.pageTurnStoredProgress = undefined;
        this.animatePageTurnRollback();
        return true;
      }
    } else if (noAnimation) {
      this.pageTurnOffsetX = targetOffset;
      this.beginPreparedPageTurnPersistence(prepared, lifecycleToken, settlementGeneration);
    } else {
      this.animatePreparedPageTurnSlide(targetOffset, settlementGeneration);
      this.beginPreparedPageTurnPersistence(prepared, lifecycleToken, settlementGeneration);
    }
    return true;
  }

  private beginPreparedPageTurnPersistence(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): void {
    if (this.pageTurnCommitStarted || settlementGeneration !== this.pageTurnSettlementGeneration) return;
    this.pageTurnCommitStarted = true;
    void this.persistPreparedPageTurn(prepared, lifecycleToken, settlementGeneration)
      .then((succeeded: boolean): void => {
        if (settlementGeneration !== this.pageTurnSettlementGeneration) return;
        this.pageTurnCommitFinished = true;
        this.pageTurnCommitSucceeded = succeeded;
        this.finishPreparedPageTurnSettlement(settlementGeneration);
      });
  }

  private animatePreparedPageTurnSlide(targetOffset: number, settlementGeneration: number): void {
    this.getUIContext().animateTo(
      motionRemainingDistanceAnimateParam('reader.page.slide.commit',
        this.pageTurnRemainingDistanceRatio(targetOffset), (): void => {
        if (settlementGeneration !== this.pageTurnSettlementGeneration) return;
        this.pageTurnAnimationFinished = true;
        this.finishPreparedPageTurnSettlement(settlementGeneration);
      }),
      (): void => {
        this.pageTurnOffsetX = targetOffset;
      },
    );
  }

  private pageTurnRemainingDistanceRatio(targetOffset: number): number {
    const width = Math.max(1, this.pageTurnPresentationWidth > 0 ?
      this.pageTurnPresentationWidth : this.viewportWidth);
    return Math.max(0, Math.min(1, Math.abs(targetOffset - this.pageTurnOffsetX) / width));
  }

  private async persistPreparedPageTurn(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): Promise<boolean> {
    if (!this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration)) {
      return false;
    }
    this.commitInFlight = true;
    try {
      let storedProgressAccepted = false;
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration)) {
          return;
        }
        const scalarCount = prepared.context.layoutMap.scalarCount();
        const chapterProgress = scalarCount === 0 ? 0 : prepared.page.startScalar / scalarCount;
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          prepared.context.chapter.chapterTitle,
          new CoreReadingAnchor(prepared.context.chapter.chapterIndex, prepared.page.startScalar, chapterProgress),
          this.coreLayout(),
          (): boolean => this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration),
        );
        if (!this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration)) {
          return;
        }
        if (stored.chapterIndex !== prepared.context.chapter.chapterIndex ||
          stored.chapterOffset !== prepared.page.startScalar) {
          throw new Error('READING_PAGE_TURN_PROGRESS_ANCHOR_MISMATCH');
        }
        this.pageTurnStoredProgress = stored;
        storedProgressAccepted = true;
      });
      return storedProgressAccepted &&
        this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration);
    } catch (error) {
      console.error(`ReadingExperience prepared page commit failed: ${this.errorMessage(error as Error)}`);
      return false;
    } finally {
      if (this.isMountedToken(lifecycleToken)) {
        this.commitInFlight = false;
      }
    }
  }

  private isPreparedPageTurnCommitCurrent(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): boolean {
    return this.isMountedToken(lifecycleToken) && !this.exitRequested &&
      settlementGeneration === this.pageTurnSettlementGeneration &&
      this.pageTurnSettlingPrepared === prepared && this.isPreparedPageTurnFresh(prepared);
  }

  private finishPreparedPageTurnSettlement(settlementGeneration: number): void {
    if (settlementGeneration !== this.pageTurnSettlementGeneration || !this.pageTurnAnimationFinished ||
      !this.pageTurnCommitFinished) {
      return;
    }
    const prepared = this.pageTurnSettlingPrepared;
    const stored = this.pageTurnStoredProgress;
    if (!this.pageTurnCommitSucceeded || prepared === undefined || stored === undefined ||
      !this.isPreparedPageTurnFresh(prepared)) {
      this.pageTurnSettlingPrepared = undefined;
      this.pageTurnStoredProgress = undefined;
      this.pageTurnCommitStarted = false;
      const autoGeneration = this.autoPageState.generation;
      this.autoPageState = retryReaderAutoPageTurn(this.autoPageState, autoGeneration);
      this.animatePageTurnRollback();
      return;
    }
    this.promotePreparedPageTurn(prepared, stored);
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    if (this.usesBookTurnSimulation()) {
      this.bookTurnAwaitingSlotCommit = true;
      if (!this.bookTurnSession.commitSlots(settlementGeneration, prepared.direction)) {
        this.bookTurnRuntimeFailed = true;
        this.bookTurnAwaitingSlotCommit = false;
        this.finishSuccessfulPageTurnPresentation(settlementGeneration);
      } else {
        this.armPageTurnSettlementDeadline(settlementGeneration);
      }
      return;
    }
    this.pageTurnInputOwned = false;

    // Keep the translated page for one ArkUI presentation frame so promotion
    // cannot expose the new current page before the transition endpoint lands.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.finishSuccessfulPageTurnPresentation(settlementGeneration);
    }));
  }

  private finishSuccessfulPageTurnPresentation(settlementGeneration: number): void {
    if (settlementGeneration !== this.pageTurnSettlementGeneration) return;
    this.finishPageTurnPerf('committed');
    this.pageTurnOffsetX = 0;
    this.pageTurnDirection = undefined;
    this.pageTurnCommitStarted = false;
    this.pageTurnSettlementActive = false;
    this.cancelPageTurnSettlementDeadline();
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnPresentationWidth = 0;
    this.bookTurnMotion = undefined;
    this.pageTurnInputOwned = false;
    this.flushDeferredPageChromeState();
    this.resumeDeferredPageTurnWork();
    this.drainPendingManualPageTurn();
    this.resumePendingAutoPageTurn();
    this.drainPageTurnPreparationQueue();
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
  }

  private promotePreparedPageTurn(prepared: PreparedReaderPageTurn, stored: LocalReadingProgress): void {
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
    this.showChapterTitle = context.paragraphRanges.length > 0 &&
      prepared.page.startScalar === context.paragraphRanges[0].startScalar;
    this.chapterTitle = context.chapter.chapterTitle;
    this.phase = 'ready';
    this.releaseUnretainedReadingImages();
    this.onChapterCommitted(context.chapter.chapterIndex, context.chapter.chapterTitle);
    this.onReadingReady(context.chapter.chapterIndex);
    this.admitCommittedProgress(stored);
    this.prefetchNextChapter(context.chapter, this.lifecycleToken, this.chapterSelectionToken);
    this.onAutoPagePageCommitted();
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
    this.pageTurnRenderRevision += 1;
  }

  private requestPageTurn(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    if (!this.mounted || this.exitRequested) {
      return { kind: 'blocked', reason: 'lifecycle' };
    }
    if (this.interactionBlocked || this.controlObscured) {
      return { kind: 'blocked', reason: 'overlay' };
    }
    if (this.controlVisible) {
      return { kind: 'blocked', reason: 'control' };
    }
    const result = this.performPageTurn(direction);
    if ((result.kind === 'busy' || result.kind === 'preparing') && this.canRetainManualPageTurnIntent() &&
      this.pendingManualPageTurnIntent === undefined && !this.pendingPointerSegmentReserved) {
      // The first complete pending intent owns the bounded slot; later taps,
      // keys and session events cannot overwrite it.
      this.pendingManualPageTurnIntent = direction;
    }
    return result;
  }

  private canRetainManualPageTurnIntent(): boolean {
    return this.readerSettingsSnapshot.navigationMode === 'paged' && this.visiblePage !== undefined &&
      (this.pageTurnPreparation !== undefined || this.pageTurnSettlementActive ||
        this.pageTurnSettlingPrepared !== undefined || this.commitInFlight || this.usesBookTurnSimulation());
  }

  private drainPendingManualPageTurn(): void {
    const intent = this.pendingManualPageTurnIntent;
    if (intent === undefined || this.pendingPointerSegmentReserved) return;
    if (!this.mounted || this.exitRequested || this.controlVisible || this.controlObscured ||
      this.interactionBlocked) {
      this.pendingManualPageTurnIntent = undefined;
      return;
    }
    if (this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.pageTurnPreparation !== undefined) return;
    if (intent === 'control') {
      // Control must not be held hostage by page-turn readiness (commit
      // backlogs, stale selection tokens); openReaderControl re-checks its
      // own interaction and gesture-ownership gates.
      this.pendingManualPageTurnIntent = undefined;
      this.openReaderControl();
      return;
    }
    if (!this.canTurnPage()) return;
    const direction = intent;
    if (readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) &&
      !this.usesNoAnimationPageTurnRuntime() &&
      this.preparedPageTurn(direction) === undefined) {
      this.queuePageTurnPreparation(direction);
      return;
    }
    this.pendingManualPageTurnIntent = undefined;
    const result = this.performPageTurn(direction);
    if ((result.kind === 'busy' || result.kind === 'preparing') && this.canRetainManualPageTurnIntent() &&
      this.pendingManualPageTurnIntent === undefined && !this.pendingPointerSegmentReserved) {
      this.pendingManualPageTurnIntent = direction;
    }
  }

  private reserveDeferredPointerSegment(): boolean {
    this.autoPageTurnPending = false;
    if (this.pendingPointerSegmentReserved) return false;
    if (this.pendingManualPageTurnIntent !== undefined &&
      (this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
        this.pageTurnPreparation !== undefined)) {
      return false;
    }
    // A retained intent with no settlement in flight is stale; the newest
    // pointer segment supersedes it so a degraded canTurnPage state cannot
    // brick reader input behind an intent that can never drain.
    this.pendingManualPageTurnIntent = undefined;
    this.pendingPointerSegmentReserved = true;
    return true;
  }

  private resolveDeferredPointerSegment(intent: ReaderPageTapIntent | undefined): void {
    if (!this.pendingPointerSegmentReserved) return;
    this.pendingPointerSegmentReserved = false;
    if (intent !== undefined && this.pendingManualPageTurnIntent === undefined) {
      this.pendingManualPageTurnIntent = intent;
    }
    this.drainPendingManualPageTurn();
  }

  private promoteDeferredPointerSegment(): void {
    this.pendingPointerSegmentReserved = false;
  }

  /** Manual tap, pan release, and Auto Page all converge on this one gate. */
  private performPageTurn(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      return this.performContinuousPageTurn(direction);
    }
    if (!this.canTurnPage()) {
      this.finishPageTurnPerf('busy');
      this.completeDirectPageTurnGesture();
      return { kind: 'busy' };
    }
    const prepared = readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) &&
      !this.usesNoAnimationPageTurnRuntime() ?
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
    if (prepared !== undefined && this.startPreparedPageTurnSettlement(direction, prepared)) {
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

  /** Returns only boundaries proven by the admitted pagination facts. */
  private knownPageTurnBoundary(
    direction: ReaderPageTurnDirection,
  ): ReaderPageTurnOutcome | undefined {
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (page === undefined || chapter === undefined) return undefined;
    if (direction === 'next') {
      const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
      return page.endScalar > lastVisible && this.adjacentChapterIndex(chapter.chapterIndex, 1) === undefined ?
        { kind: 'boundary', edge: 'end' } : undefined;
    }

    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const containingPage = this.paginationIndex.findContainingPage(this.currentPaginationKey(), page.startScalar);
    if (containingPage !== undefined) {
      return containingPage.pageIndex === 0 && previousChapterIndex === undefined ?
        { kind: 'boundary', edge: 'start' } : undefined;
    }
    return previousChapterIndex === undefined && this.paragraphRanges.length > 0 &&
      page.startScalar <= this.paragraphRanges[0].startScalar ?
      { kind: 'boundary', edge: 'start' } : undefined;
  }

  private performContinuousPageTurn(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    if (!this.mounted || this.exitRequested || this.controlVisible || this.phase !== 'ready' ||
      this.chapter === undefined || this.continuousScroller === undefined ||
      this.continuousFragments.length === 0 || this.continuousCommitInFlight) {
      return { kind: 'busy' };
    }
    const chapter = this.chapter;
    try {
      if (direction === 'previous' && this.isContinuousScrollerAtStart()) {
        const previousChapter = this.adjacentChapterIndex(chapter.chapterIndex, -1);
        if (previousChapter === undefined) {
          return { kind: 'boundary', edge: 'start' };
        }
        return this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, this.continuousVisibleScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (direction === 'next' && this.isContinuousScrollerAtEnd()) {
        const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
        if (nextChapter === undefined) {
          return { kind: 'boundary', edge: 'end' };
        }
        return this.openPageTurnChapter(nextChapter, 0) ? { kind: 'started' } : { kind: 'busy' };
      }
      this.continuousScroller.scrollPage({ next: direction === 'next', animation: true });
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
    this.drainPageTurnPreparationQueue();
  }

  private turnNextPage(): ReaderPageTurnOutcome {
    if (!this.canTurnPage()) {
      return { kind: 'busy' };
    }
    const page = this.visiblePage as PhysicalReadingPage;
    const chapter = this.chapter as ReadingSessionChapter;
    const nextOffset = page.endScalar;
    const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
    if (nextOffset <= lastVisible) {
      this.measureCommittedPageAt(nextOffset);
      return { kind: 'started' };
    }
    const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
    if (nextChapter === undefined) {
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
        return { kind: 'started' };
      }
      if (previousChapterIndex !== undefined && prefix !== undefined && prefix.matches(key) &&
        this.paragraphRanges.length > 0 &&
        prefix.startsAtRequest(this.paragraphRanges[0].startScalar) &&
        prefix.pageStartScalars()[0] === page.startScalar) {
        return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (previousChapterIndex === undefined && this.paragraphRanges.length > 0 &&
        page.startScalar <= this.paragraphRanges[0].startScalar) {
        return { kind: 'boundary', edge: 'start' };
      }
      // Restore/search/directory jumps deliberately have no chapter-head
      // prefix. Re-measure from the real chapter head behind the unchanged
      // committed page; the continuous prefix then yields an exact physical
      // predecessor without inventing a history stack or durable manifest.
      return this.startCurrentChapterPredecessorMeasurement(chapter.chapterIndex, page.startScalar) ?
        { kind: 'started' } : { kind: 'busy' };
    }
    if (containingPage.pageIndex === 0 && previousChapterIndex !== undefined &&
      this.paginationKeyForChapter(previousChapterIndex) === undefined) {
      return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
        { kind: 'started' } : { kind: 'busy' };
    }
    if (containingPage.pageIndex === 0 && previousChapterIndex === undefined) {
      return { kind: 'boundary', edge: 'start' };
    }
    const previousChapterKey = containingPage.pageIndex === 0 && previousChapterIndex !== undefined ?
      this.paginationKeyForChapter(previousChapterIndex) as ReadingPaginationKey : null;
    const previous = this.paginationIndex.findPreviousPage(key, page.startScalar, previousChapterKey);
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
    const previousKey = this.paginationKeyForChapter(previousChapterIndex);
    if (previousKey !== undefined) {
      const lastPage = this.paginationIndex.findLastPage(previousKey);
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
    return true;
  }

  private startCurrentChapterPredecessorMeasurement(
    chapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (!this.mounted || this.previousChapterMeasurement !== undefined ||
      this.chapter === undefined || this.chapter.chapterIndex !== chapterIndex ||
      this.paragraphRanges.length === 0) {
      return false;
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
    return true;
  }

  private canTurnPage(): boolean {
    return this.mounted && !this.exitRequested && !this.controlVisible && this.phase === 'ready' &&
      !this.measurementCompleting && this.pageTurnPreparation === undefined &&
      this.pageTurnSettlingPrepared === undefined &&
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

  private openPageTurnChapter(chapterIndex: number, chapterOffset: number): boolean {
    if (!this.mounted || !this.isKnownControlChapter(chapterIndex)) {
      return false;
    }
    const lifecycleToken = this.lifecycleToken;
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.resetForChapterSelection();
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(chapterIndex, false, lifecycleToken, selectionToken, chapterOffset);
    return true;
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
    return this.isMountedToken(lifecycleToken) && !this.exitRequested;
  }

  private recoverPreviousChapterMeasurement(error: Error, lifecycleToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isSessionActive(lifecycleToken)) {
      return;
    }
    console.error(`ReadingExperience previous chapter measurement failed: ${this.errorMessage(error)}`);
    if (pending.prepareOnly) {
      this.previousChapterMeasurement = undefined;
      this.measurementGeneration += 1;
      this.measurementSelectionToken = -1;
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.measurementBatch.length = 0;
      this.resetPendingPage();
      this.cancelMeasurementDeadline();
      this.measurementEpoch += 1;
      if (pending.origin !== undefined) this.restoreMaterializedChapterContext(pending.origin, false);
      this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
      if (this.pendingManualPageTurnIntent === 'previous') this.pendingManualPageTurnIntent = undefined;
      this.pageTurnPreparationQueue = this.pageTurnPreparationQueue.filter(
        (direction: ReaderPageTurnDirection): boolean => direction !== 'previous',
      );
      this.pageTurnRenderRevision += 1;
      this.releaseUnretainedReadingImages();
      this.scheduleBookTurnTextureRefresh();
      return;
    }
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
    if (this.pageTurnPreparation !== undefined) {
      this.recoverPageTurnPreparation(error, lifecycleToken);
      return;
    }
    if (this.previousChapterMeasurement !== undefined) {
      this.recoverPreviousChapterMeasurement(error, lifecycleToken);
      return;
    }
    this.failureCode = this.errorMessage(error);
    this.finishPageTurnPerf('failed');
    this.autoPageState = stopReaderAutoPage(this.autoPageState, 'lifecycle');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.cancelPageTurnPreparationRetry();
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
