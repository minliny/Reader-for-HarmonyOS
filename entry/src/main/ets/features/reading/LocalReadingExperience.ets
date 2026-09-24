import { ReaderNativeTextWindow, readerNativeParagraphHeight } from './ReaderNativeTextWindow';
import { ReaderNativeParagraphResources, ReaderNativeParagraphRecipe, readerNativeParagraphKey } from './ReaderNativeParagraph';
import { ReaderNativeTextMeasurement, type ReaderNativeTextStyle } from './ReaderNativeTextMeasurement';
import { readPreparedReadingEntrySnapshot, type ReadingEntryNavigation, type ReadingEntryNavigationItem } from './ReadingEntrySnapshot';
import { ReaderTtsPageFollow, readerTtsFollowActive, type ReaderTtsFollowScope,
  type ReaderTtsFollowLease, type ReaderTtsFollowTarget, type ReaderPageTurnOrigin } from './ReaderTtsPageFollow';
import type { RemoteReadingPositionContext, RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { ReaderStartupTrace } from '../../app/ReaderStartupTrace';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import { buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch, type ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import { READER_SESSION_LAUNCH_CURVES } from './ReaderSessionLaunchCurves';
import { ReaderSessionLaunchController, type ReaderSessionLaunchTransaction,
  type ReaderSessionLaunchIdentity, type ReaderSessionLaunchCancelReason } from './ReaderSessionLaunchController';
import { ReaderPageChrome } from './ReaderPageChrome';
import { ReaderStatusBarPaper } from './ReaderStatusBarPaper';
import { measureReaderPageChromeText, readerPageChromeTopTextStyle } from './ReaderPageChromeTextMeasurement';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ReaderWindowMetricsSnapshot } from '../common/ReaderWindowMetrics';
import { settings, type BusinessError } from '@kit.BasicServicesKit';
import { readerBrightnessWindowValue, readerBrightnessControlPercent, readerBrightnessSystemValue } from './ReaderBrightnessCurve';
import { readerNativeHighlightValues, type ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import { ReaderPageSettlementTimeline } from './ReaderPageSettlementTimeline';
import { resumeReaderPagePan } from './ReaderPageGestureState';
import { LocalReadingContentMetricIndex } from './LocalReadingWholeBookProgress';
import { errorMessageOf } from '../../app/ErrorMessage';
import curves from '@ohos.curves';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_DISMISS_MS } from '../common/ProductMotionTiming';
import {
  type LocalReadingAnchor,
  type LocalReadingBookmark,
  type LocalReadingContentMetrics,
  type LocalReadingLayout,
  type LocalReadingProgress,
  type LocalReadingProgressState,
  type LocalReadingToc,
  type LocalReadingTocEntry,
} from './LocalReadingFlowGateway';
import { hilog } from '@kit.PerformanceAnalysisKit';
import inputMethod from '@ohos.inputMethod';
import {
  ReadingSessionFlowGateway,
  type ReadingContentSearchResult,
  type ReadingSessionSource,
} from './ReadingSessionFlowGateway';
import { RemoteChapterCacheRefreshError, type RemoteReadingSession, type RemoteReadingBookSeed } from './RemoteReadingFlowGateway';
import type { ReadingEntrySnapshot } from './ReadingEntryPreparation';
import {
  RemoteReadingSourceError,
  remoteReadingFailureKindOf,
  type RemoteReadingFailureKind,
} from './RemoteContentAdmission';
import type { ReaderBookIdentity } from './ReaderBookmarkProjection';
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
  type ReaderPageTurnSlot,
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
  BOOK_TURN_EVENT_FRAME_PRESENTED,
  BOOK_TURN_EVENT_SURFACE_LOST,
  BOOK_TURN_EVENT_SURFACE_READY,
  BOOK_TURN_EVENT_TERMINAL_RELEASED,
  BOOK_TURN_EVENT_TEXTURE_READY,
  BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT,
  BOOK_TURN_PROFILE_MANUAL,
  BOOK_TURN_PROFILE_RAPID,
  BOOK_TURN_PROFILE_AUTOMATIC,
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
import { readerTextSelectionEnabled } from './ReaderTextSelectionPolicy';
import { ReaderControlPanel, type ReaderControlPage } from './ReaderControlPanel';
import { readerControlThemeStyle } from './ReaderControlThemeStyle';
import {
  copyReaderControlSessionState, createReaderControlSessionState, dismissReaderControlSession, openReaderControlSession,
  expandReaderControlSession, readerControlContentLocation, advanceReaderControlSession, resumeReaderControlSessionTarget,
  type ReaderControlSessionState,
} from './ReaderControlSessionState';
import {
  backReaderControlHostSession, readerControlHostCloseCommitted, readerControlHostClosing,
  readerControlHostInputEnabled, readerControlHostPage, readerControlHostVisible,
  setReaderControlHostPage, type ReaderControlHostTiming,
} from './ReaderControlHostSession';
import {
  consumeReaderControlKeyboardBack, hideReaderControlKeyboard, readerControlKeyboardVisible,
  type ReaderControlKeyboardHost,
} from './ReaderControlHostKeyboard';
import {
  createReaderControlBackdropTouchState, reduceReaderControlBackdropTouch,
  type ReaderControlBackdropRect, type ReaderControlBackdropTouchEvent,
  type ReaderControlBackdropTouchState,
} from './ReaderControlBackdropTouch';
import {
  readerControlSelectionMayClose,
  readerControlSelectionOwnsReading,
  readerControlSelectionRecoveryAction,
  reconcileReaderControlSelectionProgress,
  observeReaderProgressOperation,
  type ReaderControlSelectionDisplayAnchor,
  type ReaderControlSelectionOwner,
  type ReaderControlSelectionStoredProgress,
  type ReaderControlSelectionTicket,
} from './ReaderControlSelectionTransaction';
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
  type ReaderSessionCapsuleState,
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
  READER_PAGE_CHROME_BOOKMARK_SIZE,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';
import {
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
} from './ReaderControlGeometry';
import { TOK_LINE } from '../common/ReaderTokens';
import { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAutoPagePauseReason, ReaderAutoPageState } from './ReaderAutoPageState';
import { formatReaderAutoPageFullTimerSummary, type ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import { ReaderContentSearchPublication } from './ReaderContentSearchPublication';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from './ReaderDirectoryMarkerState';
import type { ReaderReplacePreview } from './ReaderReplaceQuickGateway';
import { ReaderControlReplaceGateway, ReaderControlReplaceGatewayError } from './ReaderControlReplaceGateway';
import { createReaderControlReplaceState, beginReaderControlReplaceLoad, admitReaderControlReplaceLoad,
  beginReaderControlReplaceMutation, admitReaderControlReplaceRule, admitReaderControlReplaceDeletion,
  admitReaderControlReplaceImport, failReaderControlReplaceRequest, readerControlReplaceTicket,
  readerControlReplaceTicketCurrent, type ReaderControlReplaceState, type ReaderControlReplaceDraft }
  from './ReaderControlReplaceState';
import {
  createHiddenReaderReplaceQuickState,
  createReaderReplaceQuickState,
  replaceConfirmedReaderReplaceRule,
  type ReaderReplaceQuickState,
  type ReaderReplaceRule,
} from './ReaderReplaceQuickState';
import {
  ReadingSurfaceLayoutMap, readingChapterLayoutMap, prepareReadingChapterLayoutMap,
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
  ReadingChapterWindow, retainReadingEntryImageHandles, hasKnownReadingImageGeometry,
  type ReadingSessionChapter,
  type ReadingSessionImage,
} from './ReadingChapterWindow';
import {
  collectReadingParagraphUtf16Ranges,
  prepareReadingParagraphUtf16Ranges,
  readingParagraphBoundaryMode,
} from './ReadingParagraphProjection';
import { registerReaderFonts, readerRegisteredFontFamily, prepareReaderFontFamily, readerFontFamilyReady } from '../common/ReaderFonts';
import { TYPE_READER_CHAPTER_TITLE } from '../common/ReaderTypography';
import {
  motionAnimateParam,
  motionRemainingDistanceAnimateParam,
  motionSpecGet,
} from '../common/MotionSpec';
import { ComponentContent, FrameCallback, window } from '@kit.ArkUI';
import { image } from '@kit.ImageKit';
import {
  readerSessionMorphSourceKindForPage,
  type ReaderSessionMorphSourceKind,
  ReaderSessionMorphSourceMeasurement,
} from './ReaderSessionMorphState';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReadingEntryHandoff, registerReadingEntryMemoryRelease,
  estimateRetainedRemoteSessionBytes } from './ReadingEntryHandoff';
import { ReaderTtsCredentialStore } from '../../app/ReaderTtsCredentialStore';
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
  readerOnlineTtsProfile,
  type ReaderTtsAudioFormat,
  type ReaderOnlineTtsProfile,
} from './ReaderOnlineTtsProfile';
import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
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
  READER_TTS_TIMER_DEFAULT_MINUTES,
  type ReaderTtsState,
  type ReaderTtsTimerMode,
} from './ReaderTtsState';
import { ReaderTtsPreferencesGateway } from './ReaderTtsPreferencesGateway';
import {
  type ReaderTtsPreferencesSnapshot,
  type ReaderTtsVoiceOption,
} from './ReaderTtsPreferencesState';
import { ReaderAppearanceGateway } from './ReaderAppearanceGateway';
import { ReaderAppearanceCommit, type ReaderAppearanceChange } from './ReaderAppearanceStore';
import {
  ReaderChineseConversionGateway,
  type ReaderChineseConversionMode,
} from './ReaderChineseConversionGateway';
import {
  copyReaderAppearanceSnapshot,
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
  updatedAt: number;

  constructor(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    chapterOffset: number,
    chapterProgress: number,
    locationRevision: string | undefined,
    updatedAt: number = 0,
  ) {
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
    this.updatedAt = updatedAt;
  }
}

/**
 * Chapter-level paragraph boundaries.  These remain deliberately tiny: a
 * long EPUB is indexed once, but no paragraph text, local map, or ArkUI
 * controller is retained until its current first-page batch is measured.
 */
interface ReaderControlReplaceCommit {
  rule?: ReaderReplaceRule;
  deletedId?: number;
  changed: boolean;
  needsReload: boolean;
}

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
 * A bounded paragraph submitted to the native Text measurement owner.
 * It is discarded after the line metrics have been copied into first-page
 * fragments, keeping real long chapters bounded by the batch limits below.
 */
class MeasurementParagraph {
  nativeMeasured: boolean = false;
  id: string;
  rangeIndex: number;
  text: string;
  chapterStartScalar: number;
  layoutMap: ReadingSurfaceLayoutMap;
  controller: TextController;
  isParagraphStart: boolean;
  /** Absolute resume target; shaping always receives the complete paragraph. */
  requestedStartScalar: number;

  constructor(
    id: string,
    rangeIndex: number,
    text: string,
    chapterStartScalar: number,
    layoutMap: ReadingSurfaceLayoutMap,
    controller: TextController,
    isParagraphStart: boolean,
    requestedStartScalar: number,
  ) {
    this.id = id;
    this.rangeIndex = rangeIndex;
    this.text = text;
    this.chapterStartScalar = chapterStartScalar;
    this.layoutMap = layoutMap;
    this.controller = controller;
    this.isParagraphStart = isParagraphStart;
    this.requestedStartScalar = requestedStartScalar;
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
  measuredAppearance: ReaderAppearanceSnapshot | undefined;
  // Written once by the accepted measurement, before publication. Keep the
  // original request even after a complete chapter index replaces its draft.
  paginationKey: ReadingPaginationKey | undefined = undefined;
  paginationObservation: ReadingPaginationPrefixObservation | undefined = undefined;

  constructor(
    fragments: ReadingSurfacePageFragment[],
    startScalar: number,
    endScalar: number,
    contentHeight: number,
    bodyCapacity: number,
    measuredAppearance?: ReaderAppearanceSnapshot,
  ) {
    this.fragments = fragments;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.contentHeight = contentHeight;
    this.bodyCapacity = bodyCapacity;
    this.measuredAppearance = measuredAppearance;
  }
}

interface DeferredReadingImagePixels {
  chapter: ReadingSessionChapter;
  requested: ReadingSessionImage;
  resolved?: ReadingSessionImage;
  isCurrent: () => boolean;
}

/** Immutable display inputs, also used as an isolated adjacent measurement context. */
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

/** Confirmed, text-only presentation retained across one normal exit. Images
 * and custom fonts use normal acquisition until their cross-view leases are
 * proven; this optional handoff is never a navigation prerequisite. */
export class ReaderRetainedPresentation {
  sourceId: string;
  bookId: string;
  gateway: ReadingSessionFlowGateway;
  context: ReaderMaterializedChapterContext;
  page: PhysicalReadingPage;
  toc: LocalReadingTocEntry[];
  progress: LocalReadingProgress;
  appearanceKey: string;
  settingsKey: string;
  layoutKey: string;
  densityPixels: number;
  navigation?: ReadingEntryNavigation;
  catalogPending: boolean;
  isCurrent: () => boolean;

  constructor(sourceId: string, bookId: string, gateway: ReadingSessionFlowGateway,
    context: ReaderMaterializedChapterContext, page: PhysicalReadingPage,
    toc: LocalReadingTocEntry[], progress: LocalReadingProgress, appearanceKey: string,
    settingsKey: string, layoutKey: string, densityPixels: number, isCurrent: () => boolean, navigation?: ReadingEntryNavigation, catalogPending: boolean = navigation !== undefined) {
    this.sourceId = sourceId; this.bookId = bookId; this.gateway = gateway;
    this.context = context; this.page = page; this.toc = toc; this.progress = progress;
    this.appearanceKey = appearanceKey; this.settingsKey = settingsKey;
    this.layoutKey = layoutKey; this.densityPixels = densityPixels; this.isCurrent = isCurrent; this.navigation = navigation; this.catalogPending = catalogPending;
  }
}

const readingEntryHandoffs: WeakMap<ReaderRuntimeOwner, ReadingEntryHandoff<ReaderRetainedPresentation>> = new WeakMap();

function readingEntryHandoff(owner: ReaderRuntimeOwner): ReadingEntryHandoff<ReaderRetainedPresentation> {
  let handoff = readingEntryHandoffs.get(owner);
  if (handoff === undefined) {
    handoff = new ReadingEntryHandoff<ReaderRetainedPresentation>();
    readingEntryHandoffs.set(owner, handoff);
    const retained = handoff;
    registerReadingEntryMemoryRelease(owner, (): void => retained.clear());
  }
  return handoff;
}

export function readerEntryPresentation(sourceId: string, bookId: string): ReaderRetainedPresentation | undefined {
  const owner = ReaderRuntimeOwner.current();
  if (!owner.optionalReadingEntryMemoryEnabled()) return undefined;
  return readingEntryHandoff(owner).current(sourceId, bookId);
}

interface ReaderControlPlaybackPresentation {
  lifecycleToken: number;
  sourceId: string;
  bookId: string;
  openRevision: number;
  moduleVisitRevision: number;
  module: string;
}

interface ReaderTtsPlayIntent {
  generation: number;
  lifecycleToken: number;
  selectionToken: number;
  sourceId: string;
  bookId: string;
  presentation: ReaderControlPlaybackPresentation;
}

interface ReaderControlSelectionDisplay {
  context: ReaderMaterializedChapterContext;
  page: PhysicalReadingPage;
  visibleScalar: number;
  continuous: boolean;
  layoutSignature: string;
}

/** Last actually committed display retained only until a control selection resolves. */
class ReaderControlSelectionOrigin implements ReaderControlSelectionDisplay {
  context: ReaderMaterializedChapterContext;
  page: PhysicalReadingPage;
  committedProgress: ReadingCommit;
  visibleScalar: number;
  continuous: boolean;
  layoutSignature: string;

  constructor(context: ReaderMaterializedChapterContext, page: PhysicalReadingPage,
    committedProgress: ReadingCommit, visibleScalar: number, continuous: boolean, layoutSignature: string) {
    this.context = context;
    this.page = page;
    this.committedProgress = committedProgress;
    this.visibleScalar = visibleScalar;
    this.continuous = continuous;
    this.layoutSignature = layoutSignature;
  }
}

/** Measured target kept until an uncertain Core write has been reconciled. */
class ReaderControlSelectionCandidate implements ReaderControlSelectionDisplay {
  context: ReaderMaterializedChapterContext;
  page: PhysicalReadingPage;
  visibleScalar: number;
  continuous: boolean;
  layoutSignature: string;
  constructor(context: ReaderMaterializedChapterContext, page: PhysicalReadingPage,
    continuous: boolean, layoutSignature: string) {
    this.context = context;
    this.page = page;
    this.visibleScalar = page.startScalar;
    this.continuous = continuous;
    this.layoutSignature = layoutSignature;
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

/**
 * Host-originated bookmark jump (Full Directory bookmark row). The requestId
 * bumps on every click so re-selecting the same bookmark still re-syncs the
 * @Prop and re-fires the anchor seek.
 */
export class ReaderBookmarkAnchorRequest {
  requestId: number;
  chapterIndex: number;
  chapterOffset: number;

  positionScope?: RemoteReadingPositionScope;

  constructor(requestId: number, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) {
    this.positionScope = positionScope;
    this.requestId = requestId;
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
  controlOwnerRevision: number;
  closeControlOnCommit: boolean;
  refreshContent: boolean;
  positionContext?: RemoteReadingPositionContext;
  ttsOwner?: ReaderTtsFollowLease;

  constructor(
    chapterIndex: number,
    chapterOffset: number,
    requireChapterStart: boolean,
    stopTts: boolean,
    requestedProgress: number | undefined,
    controlOwnerRevision: number,
    closeControlOnCommit: boolean = true,
    refreshContent: boolean = false,
    positionContext?: RemoteReadingPositionContext,
    ttsOwner?: ReaderTtsFollowLease,
  ) {
    this.ttsOwner = ttsOwner;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.requireChapterStart = requireChapterStart;
    this.stopTts = stopTts;
    this.requestedProgress = requestedProgress;
    this.controlOwnerRevision = controlOwnerRevision;
    this.closeControlOnCommit = closeControlOnCommit;
    this.refreshContent = refreshContent;
    this.positionContext = positionContext;
  }
}

interface ReaderAutomaticPageStart {
  generation: number;
  lifecycleToken: number;
  origin: ReaderPageTurnOrigin;
  autoGeneration: number;
  ttsOwner?: ReaderTtsFollowLease;
  surfaceToken: number;
  scheduled: boolean;
  started: boolean;
  bufferEventReceivedAtMs: number;
  showRequestedAtMs: number;
  startedAtMs: number;
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
  /** Exclusive original-text boundary; immutable during one reverse page. */
  endScalar: number = -1;
  nextRangeIndex: number = -1;

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

  bodyVersion?: string;
  processingVersion?: string;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number, bodyVersion?: string, processingVersion?: string) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.bodyVersion = bodyVersion; this.processingVersion = processingVersion;
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
const READING_WRITING_MODE = 'horizontal-tb';
const READER_APPEARANCE_FONT_SIZE_STEP = 2;
const READER_APPEARANCE_LINE_HEIGHT_STEP = 0.08;
const READER_APPEARANCE_PARAGRAPH_SPACING_STEP = 2;
const READER_APPEARANCE_LETTER_SPACING_STEP = 0.5;
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
 * Same fail-closed discipline as the probe, for the chapter title gate: a
 * controller/Text binding mismatch (or a title that never lays out) must not
 * silently retry until the 6s deadline. Generous for the same reason: once
 * the title Text is bound to the current epoch's controller, its line count
 * settles within the first didLayout or two.
 */
const CHAPTER_TITLE_GATE_ATTEMPT_LIMIT = 8;
/**
 * The hidden-layout deadline stops at the first Core persistence boundary.
 * Keep a separate, non-visual upper bound for an initial page that still has
 * no visible body while its chapter read, location resolution, or first
 * progress write is pending. A timeout is recoverable within the reader.
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
  @StorageLink('readerAppScheme') private readerAppScheme: string = 'day';
  @StorageLink('readerAppearanceRevision') @Watch('onSharedAppearanceChanged') private sharedAppearanceRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('onAppForegroundChanged') appForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') @Watch('onWindowMetricsRevisionChanged')
  readerWindowMetricsRevision: number = 0;
  @Prop sourceId: string = LOCAL_READING_SOURCE_ID;
  @Prop bookId: string;
  @Prop bookKind: string | undefined = undefined;
  @Prop remoteSession: RemoteReadingSession | undefined = undefined;
  @Prop remoteBookSeed: RemoteReadingBookSeed | undefined = undefined;
  isReaderIdentityCurrent: () => boolean = (): boolean => true;
  @Prop sourceSwitchFailureMessage: string = '';
  onRemoteSessionReady: (session: RemoteReadingSession) => void = (_session: RemoteReadingSession): void => {};
  onRetryFailedSourceSwitch: () => void = (): void => {};
  onDismissSourceSwitchFailure: () => void = (): void => {};
  resolveSourceSwitchTransactionId: (sourceId: string, bookId: string) => Promise<string | undefined> =
    async (_sourceId: string, _bookId: string): Promise<string | undefined> => undefined;
  @Prop sourceSwitchTransactionId: string | undefined = undefined;
  @Prop @Watch('onRequestedChapterChanged') requestedChapterIndex: number | undefined = undefined;
  // Full Directory bookmark row: host-originated precise (chapter, offset)
  // anchor; mirrors the selectSearchResult exact-scalar jump. The requestId
  // bump makes repeated same-bookmark clicks re-fire the seek.
  @Prop @Watch('onRequestedBookmarkAnchorChanged') requestedBookmarkAnchor:
    ReaderBookmarkAnchorRequest | undefined = undefined;
  // Static per-session book identity for stable bookmark ids.
  @Prop bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  @Prop @Watch('onDeviceFormChanged') isTablet: boolean;
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
  onExitRequestHandler: (requestExit: (intent?: 'navigation') => void) => void =
    (_requestExit: (intent?: 'navigation') => void): void => {};
  onExit: () => void = (): void => {};
  onExitCancelled: () => void = (): void => {};
  /**
   * Reports a first real page only after measurement, Core persistence and
   * page/slot publication. The route itself is available immediately; this
   * signal updates its committed chapter and releases optional projections.
  */
  onReadingReady: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onReadingCommitted: (commit: ReadingCommit) => void = (_commit: ReadingCommit): void => {};
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
  onOpenDirectory: () => void = (): void => {};
  onOpenBookInfo: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadBook: () => void = (): void => {};
  @Prop offlineBookOperationActive: boolean = false;
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
  private continuousRenderGeometryKey: string = '';
  private continuousEntryPositionReady: boolean = false;
  private continuousTitleRecipe: ReaderNativeParagraphRecipe | undefined;
  @State private continuousRenderRevision: number = 0;
  @State private continuousChangedFragmentIndex: number = -1;
  @State private continuousInitialFragmentIndex: number = 0;
  @State private continuousInitialFragmentProgress: number = 0;
  @State private continuousInitialAnchorRevision: number = 0;
  private continuousProgrammaticScrollIntent: (() => void) | undefined = undefined;
  // Visible indices are progress cursors, not render inputs. Keeping them
  // non-reactive prevents every List settle callback from rebuilding the
  // entire reading stage and flashing the already rendered rows.
  private continuousVisibleFragmentIndex: number = 0;
  private continuousVisibleEndFragmentIndex: number = 0;
  @State private pageTurnOffsetX: number = 0;
  @State private pageTurnPresentationWidth: number = 0;
  @State private pageTurnDirection: ReaderPageTurnDirection | undefined = undefined;
  /** Stable physical slot that owns the logical current page. */
  @State private pageTurnCurrentSlot: ReaderPageTurnSlot = 'a';
  /** Native/settle protocol phase; no build node consumes this marker. */
  private pageTurnPresentationPhase: ReaderPagePresentationPhase = 'idle';
  private pageTurnPersistenceState: 'idle' | 'queued' | 'writing' | 'unknown' | 'durable' | 'originConfirmed' = 'idle';
  private pageTurnUnknownNotifiedGeneration: number = -1;
  private pageTurnReconciliationPending: boolean = false;
  @State private pageTurnSettlementActive: boolean = false;
  @State private bookmarkPageOffsetY: number = 0;
  private bookmarkRollbackGeneration: number = 0;
  @State private bookmarkPendingTarget: string = '';
  private bookmarkPendingAnchor: string = '';
  private bookmarkMutationGeneration: number = 0;
  private bookmarkMutationConfirmed: boolean = false;
  /** Shared gesture preview directly paints the right-corner feedback. */
  @State private bookmarkPreviewChanged: boolean = false;
  private bookmarkStatusEntries: LocalReadingTocEntry[] | undefined = undefined;
  private bookmarkStatusAnchor: string = '';
  private bookmarkStatusValue: 'unknown' | 'empty' | 'bookmarked' = 'unknown';
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
  private cacheNoticeLifecycle: number = -1;
  @Prop bookTitle: string = '';
  @Prop sourceName: string = '';
  @Prop totalChapters: number = 0;
  @Prop @Watch('onControlDirectoryDataChanged') directoryEntries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onControlBookmarkFailureChanged') bookmarkLoadMessage: string = '';
  @State private controlBookmarkLoadFailed: boolean = false;
  private controlBookmarkLoadGeneration: number = 0;
  private controlBookmarkLoadPending: boolean = false;
  private controlBookmarkFailureNoticeKey: string = '';
  // External overlays may temporarily obscure the reader. In-reader Full
  // Directory is now the same control session, not an external overlay route.
  @Prop @Watch('onControlObscuredChanged') controlObscured: boolean = false;
  /** Directory/source-switch/hidden routes explicitly transfer pointer ownership away from the reader. */
  @Prop @Watch('onControlInputBoundaryChanged') interactionBlocked: boolean = false;
  @State @Watch('onControlSessionChanged') private controlSession: ReaderControlSessionState =
    createReaderControlSessionState();
  /**
   * Latest presentation sample from ReaderControlMotionStage.  This is a
   * plain host field on purpose: it lets Back/close retarget from the image
   * currently under the finger without making every VSync sample reactive in
   * the reading page.
   */
  private latestControlVisualSession: ReaderControlSessionState = createReaderControlSessionState();
  @State private controlOpenRevision: number = 0;
  @State private controlTemporaryLayer: boolean = false;
  @State private dismissControlTemporaryRevision: number = 0;
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
    canResumeTurn: (): boolean => !this.pageTurnSettlementActive && this.pageTurnSettlingPrepared === undefined &&
      this.pageTurnPreparation === undefined && this.canTurnPage(),
    turn: (): ReaderPageTurnOutcome => this.performPageTurn('next', 'autoTimer'),
    changed: (): void => {
      this.autoPageRevision += 1;
      if (this.automaticReadingState().status !== 'running') this.cancelAutomaticPageStart?.('autoTimer');
    },
  });
  private automaticReadingState(): Readonly<ReaderAutoPageState> {
    return this.autoPageCoordinator.snapshot(this.autoPageRevision);
  }
  private automaticReadingConfiguration(): Readonly<ReaderAutoPageFullConfiguration> {
    return this.autoPageCoordinator.configurationAt(this.autoPageRevision);
  }
  @State private replaceState: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  @State private controlReplaceState: ReaderControlReplaceState = createReaderControlReplaceState();
  @State private appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @State private chineseConversionMode: ReaderChineseConversionMode = 'none';
  @State private readerSettingsSnapshot: ReaderSettingsSnapshot = createDefaultReaderSettingsSnapshot();
  @State private ttsState: ReaderTtsState = createReaderTtsState(false);
  // TTS progress callbacks can arrive out of order around an utterance
  // boundary. Keep the follow-page lane monotonic so a late callback cannot
  // enqueue a reverse turn or duplicate the same destination while a turn is
  // still settling.
  private readonly ttsPageFollow: ReaderTtsPageFollow = new ReaderTtsPageFollow();
  private ttsFollowPositioning: ReaderTtsFollowLease | undefined = undefined;
  private ttsFollowResumeScheduled: boolean = false;
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
  /** Latest user-intent generation for transactional TTS preference writes. */
  private ttsPreferenceMutationGeneration: number = 0;
  /** A late initial config must not replace a newer rate/engine choice. */
  private ttsConfigMutationGeneration: number = 0;
  @State private pageChromeClockText: string = formatReaderPageClock(Date.now());
  @State private sessionCapsuleMeasuredWidth: number = 0;
  @State private sessionCapsuleMeasuredHeight: number = READER_SESSION_CAPSULE_HEIGHT;
  // One presentation transaction and immutable sample own every launch actor.
  @State private sessionLaunch: ReaderSessionLaunchTransaction | undefined = undefined;
  @State private sessionLaunchStageOpacity: number = 1;
  @State private sessionLaunchFooterExiting: boolean = false;
  @State private sessionLaunchFooterOffset: number = 0;
  @State private sessionLaunchFooterExitProgress: number = 0;
  @State private sessionLaunchFooterOpacity: number = 1;
  private readonly sessionLaunchController: ReaderSessionLaunchController =
    new ReaderSessionLaunchController(READER_SESSION_LAUNCH_CURVES);
  private sessionLaunchSourceTtsState: ReaderTtsState = createReaderTtsState(false);
  private sessionLaunchSourceAutoStatus: ReaderAutoPageStatus = 'stopped';
  private sessionLaunchSourceControl: ReaderControlSessionState = createReaderControlSessionState();
  private sessionLaunchChromeAnchor: string = '';
  private sessionLaunchSourceLayoutKey: string = '';
  private sessionLaunchChrome: ReaderPageChromeSnapshot = new ReaderPageChromeSnapshot('', '', '', '', true, 96, 24);
  private sessionLaunchSourceContexts: Map<ReaderSessionMorphSourceKind, string> = new Map<ReaderSessionMorphSourceKind, string>();
  private sessionLaunchTopExit: number = 0;
  private sessionLaunchDockExit: number = 0;
  private sessionLaunchFramePending: boolean = false;
  private sessionLaunchHoldTimer: number = -1;
  @State private sessionControlClosing: boolean = false;
  @State private windowControlsPresented: boolean = false;
  private pendingSessionLaunchGeneration: number = 0;
  private sessionLaunchExitGeneration: number = 0;
  private appearanceLoaded: boolean = false;
  private entryAppearanceReady: boolean = false;
  private quickAutoPageMorphSource: ReaderSessionMorphSourceMeasurement | undefined = undefined;
  private quickTtsMorphSource: ReaderSessionMorphSourceMeasurement | undefined = undefined;
  private fullAutoPageMorphSource: ReaderSessionMorphSourceMeasurement | undefined = undefined;
  private fullTtsMorphSource: ReaderSessionMorphSourceMeasurement | undefined = undefined;

  private sessionGateway: ReadingSessionFlowGateway | undefined = undefined;
  private preparedReadingEntry: ReadingEntrySnapshot | undefined = undefined;
  entryPresentationProvider: () => ReaderRetainedPresentation | undefined = (): ReaderRetainedPresentation | undefined => undefined;
  private readonly replaceGateway: ReaderControlReplaceGateway =
    new ReaderControlReplaceGateway(ReaderRuntimeOwner.current());
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
  private chapterTitleMeasurementController: TextController = new TextController();
  private measuredChapterTitleHeightVp: number = 0;
  private measuredNativeTitle: ReaderNativeParagraphRecipe | undefined = undefined;
  private paragraphRanges: ParagraphRange[] = [];
  private readonly measurementBatch: MeasurementParagraph[] = [];
  private readonly paginationIndex: ReadingPaginationIndex = new ReadingPaginationIndex();
  private readonly chapterWindow: ReadingChapterWindow = new ReadingChapterWindow();
  private readonly geometryImageRequests: Map<string, DeferredReadingImagePixels> = new Map();
  private readonly pageTurnChapterLoads: Set<string> = new Set<string>();
  private neighbourPreparationKey: string = '';
  /** Unique Host-created display resources owned by this reader session. */
  private readonly readingImageResources: ReadingSessionImage[] = [];
  private readonly knownContentVersions: KnownReadingContentVersion[] = [];
  private chapterLayoutMap: ReadingSurfaceLayoutMap | undefined = undefined;
  private visiblePage: PhysicalReadingPage | undefined = undefined;
  private continuousScroller: Scroller | undefined = undefined;
  private continuousVisibleScalar: number = 0;
  private continuousProgressRevision: number = 0;
  private continuousCommitInFlight: boolean = false;
  private pageTurnTransactionSerial: number = 0;
  private continuousCommitPending: boolean = false;
  private continuousCommitPromise: Promise<void> | undefined = undefined;
  private continuousUnknownTarget: CoreReadingAnchor | undefined = undefined;
  private continuousUnknownOrigin: LocalReadingProgress | undefined = undefined;
  private continuousAnchorSampler: (() => void) | undefined = undefined;
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
  /** Dynamic net target; every manual page request is retained without allocating a work queue. */
  private rapidPageTurnState: ReaderRapidPageTurnState = createReaderRapidPageTurnState();
  private pendingPointerSegmentReserved: boolean = false;
  private pageTurnGeneration: number = 0;
  private observedControlCloseRevision: number = 0;
  private observedControlPage: ReaderControlPage = 'home';
  private observedControlModule: string = 'home';
  /** Module visits, not Quick/Full frames, own delayed playback UI effects. */
  private controlModuleVisitRevision: number = 0;
  private controlInputRevision: number = 0;
  private controlBackdropRegions: ReaderControlBackdropRect[] = [];
  private controlBackdropGeometryReady: boolean = false;
  private controlBackdropState: ReaderControlBackdropTouchState = createReaderControlBackdropTouchState();
  private pageTurnSlideTimeline: ReaderPageSettlementTimeline | undefined = undefined;
  private pageTurnGestureState: ReaderPageGestureState = createReaderPageGestureState();
  private readonly bookTurnSession: BookTurnPresentationSession =
    new BookTurnPresentationSession(READER_BOOK_TURN_COMPONENT_ID);
  private bookTurnMotion: BookTurnMotionState | undefined = undefined;
  private bookTurnTextureRefreshInFlight: Promise<void> | undefined = undefined;
  private bookTurnTextureContent: ComponentContent<BookTurnTextureBuildInput> | undefined = undefined;
  private bookTurnTextureBuildPage: ReaderPageTurnRenderPage | undefined = undefined;
  private bookTurnTextureCaptureGeneration: number = 0;
  private preferredPageTextureDirection: ReaderPageTurnDirection = 'next';
  private bookTurnTextureCaptureScheduled: boolean = false;
  /** Rare capability state; unlike MOVE geometry it must rebuild settings/stage semantics. */
  @State private bookTurnRuntimeFailed: boolean = false;
  private bookTurnSurfaceRecoveryPending: boolean = false;
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
  /** Explicit direct-page measurement ticket; never inferred from auto/TTS state. */
  private ordinaryPageMeasurementSelection: number = -1;
  private ordinaryPageMeasurementLifecycle: number = -1;
  private ordinaryPageMeasurementChapter: number = -1;
  private ordinaryPageMeasurementLayout: string = '';
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
  private brightnessOwner: number = 0;
  private brightnessAutomaticIntent: boolean | undefined = undefined;
  private systemBrightnessRead: Promise<number | undefined> | undefined = undefined;
  private pageChromeStatusTimer: number = -1;
  private pendingPageChromeClockText: string | undefined = undefined;
  private measuredSessionCapsuleType: ReaderSessionCapsuleType | undefined = undefined;
  private pendingSessionCapsuleType: ReaderSessionCapsuleType | undefined = undefined;
  private pendingSessionCapsuleWidth: number = 0;
  private pendingSessionCapsuleHeight: number = 0;
  // Frozen readers no longer observe live session state; release must itself
  // invalidate their observers so a paused/stopped update cannot be stranded.
  @State private pageTurnSessionCapsuleFrozen: boolean = false;
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
  private consumedBookmarkAnchorRequestId: number = -1;
  @State private tocEntries: LocalReadingTocEntry[] = [];
  private remoteSessionObserverDispose: (() => void) | undefined = undefined;
  private entryCatalogNavigation: ReadingEntryNavigation | undefined = undefined;
  private entryCatalogPending: boolean = false;
  private readingReadyPage: PhysicalReadingPage | undefined = undefined;
  private readingReadySelection: number = -1;
  private entryCatalogHydration: Promise<void> | undefined = undefined;
  private entryCatalogHydrationQueued: boolean = false;
  private entryWindowHydration: Promise<void> | undefined = undefined;
  private entryWindowHydrationChapter: ReadingSessionChapter | undefined = undefined;
  private entryWindowHydrationQueuedFor: ReadingSessionChapter | undefined = undefined;
  private entryCatalogSeekRevision: number = 0;
  private readingTocSource: LocalReadingTocEntry[] | undefined = undefined;
  private readingTocProjection: LocalReadingTocEntry[] = [];
  @State private contentMetrics: LocalReadingContentMetrics | undefined = undefined;
  /** Normalize a continuous viewport to a chapter-head page before publishing paged mode. */
  private canonicalModeAnchor: number = -1;
  private desiredChapterOffset: number = 0;
  private desiredChapterProgress: number = 0;
  private currentMeasurementGeneration(): number { return this.paginationIndex.measurementGeneration(); }
  /** Covers pagination, resolveLocation, and the initial progress write. */
  private measurementCompleting: boolean = false;
  /** Ordinary first-page persistence outlives its completed measurement lease. */
  private ordinaryFirstPagePersistence: Promise<void> | undefined = undefined;
  private ordinaryFirstPagePersistencePage: PhysicalReadingPage | undefined = undefined;
  /** A real Area change arrived while the preceding Core write was in flight. */
  private remeasurePending: boolean = false;
  /** Invalidates an old-style page that completed while a newer appearance reflow was queued. */
  private appearanceReflowInvalidateCurrentLayout: boolean = false;
  private commitInFlight: boolean = false;
  private unicodeProbeVerified: boolean = false;
  /** Consecutive zero-line probe observations within the current generation. */
  private unicodeProbeEmptyAttempts: number = 0;
  /** Regression diagnostics: gate retry counter and per-gate last observation. */
  private measurementGateAttempts: number = 0;
  private measurementTitleLineCount: number = 0;
  private chapterTitleGateAttempts: number = 0;
  private measurementBatchPendingParagraph: number = -1;
  private measurementBatchPendingLineCount: number = -1;
  private readonly nativeParagraphResources: ReaderNativeParagraphResources = new ReaderNativeParagraphResources();
  private readonly nativeTextMeasurement: ReaderNativeTextMeasurement = new ReaderNativeTextMeasurement();
  /** Invalidates every continuation captured by a prior mounted instance. */
  private lifecycleToken: number = 0;
  private initialReadingTraceStartedAt: number = -1;
  private startupTraceEntryId: number = 0;
  private initialReadingTraceLifecycle: number = -1;
  private initialReadingTraceDelivered: boolean = false;
  /** Bumped per directory chapter selection so stale loads cannot win. */
  private chapterSelectionToken: number = 0;
  private pendingControlSelection: ReaderControlSelectionTicket | undefined = undefined;
  private pendingControlSelectionOrigin: ReaderControlSelectionOrigin | undefined = undefined;
  private pendingControlSelectionCandidate: ReaderControlSelectionCandidate | undefined = undefined;
  private pendingControlSelectionRetry: ReaderDeferredChapterSelection | undefined = undefined;
  private controlSelectionReconciliationInFlight: boolean = false;
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
  /** Invalidates unresolved availability/audible callbacks on newer play intent. */
  private ttsPlayIntentGeneration: number = 0;
  /** The selection token that owns `chapter` and its layout map. */
  private materializedChapterSelectionToken: number = -1;
  /** The selection token that owns the currently mounted hidden measurement tree. */
  private currentMeasurementSelection(): number { return this.paginationIndex.measurementSelection(); }
  /** The selection token that owns the visible physical page. */
  private visiblePageSelectionToken: number = -1;
  @State private mounted: boolean = false;
  @State private exitRequested: boolean = false;
  private exitDelivered: boolean = false;
  private exitAttemptGeneration: number = 0;
  private readingRecordActiveSinceMs: number = 0;
  private readingRecordPendingMillis: number = 0;
  private readingRecordTimer: number = -1;
  private readingRecordFlushTail: Promise<void> = Promise.resolve();
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
  private lastCommittedProgress: ReadingCommit | undefined = undefined;
  /** Exact durable TTS receipt; a later page or manual commit replaces ownership. */
  private lastTtsCommittedProgress: ReadingCommit | undefined = undefined;
  private lastTtsCommittedChapter: ReadingSessionChapter | undefined = undefined;
  private lastTtsCommittedSelectionToken: number = -1;
  private ttsInitialization: Promise<boolean> | undefined = undefined;
  private ttsPresentationMetadata: Promise<void> | undefined = undefined;
  private ttsAvailabilityResolved: boolean = false;
  private ttsWarmupScheduled: boolean = false;
  private chineseConversionLoaded: boolean = false;
  private readerSettingsLoaded: boolean = false;
  /** Layout facts admitted for the last window-metrics revision. */
  private lastWindowMetricsLayoutKey: string = '';

  aboutToAppear(): void {
    this.lifecycleToken += 1;
    const lifecycleToken = this.lifecycleToken;
    this.captureStartupEntryTrace?.();
    this.mounted = true;
    this.restoreEntryPresentation();
    this.admitInitialWindowGeometry();
    this.controlSession = createReaderControlSessionState();
    this.controlDirectoryDataRetained = false;
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
    this.autoPageCoordinator.reset();
    this.refreshPageChromeClock(lifecycleToken);
    this.armPageChromeStatusTimer(lifecycleToken);
    // The reader owns acquisition as well as the visible failure boundary.
    // A shelf/search identity can mount before its catalog is available.
    this.sessionGateway = undefined;
    this.entryCatalogNavigation = undefined;
    this.entryCatalogPending = false;
    this.readingReadyPage = undefined;
    this.readingReadySelection = -1;
    this.entryCatalogHydration = undefined;
    this.entryCatalogHydrationQueued = false;
    this.entryWindowHydration = undefined;
    this.entryWindowHydrationChapter = undefined;
    this.entryWindowHydrationQueuedFor = undefined;
    this.entryCatalogSeekRevision += 1;
    this.contentMetrics = undefined;
    this.contentMetricsLoading = false;
    this.lastCommittedProgress = undefined;
    this.pendingControlSelection = undefined;
    this.pendingControlSelectionOrigin = undefined;
    this.pendingControlSelectionCandidate = undefined;
    this.pendingControlSelectionRetry = undefined;
    this.controlSelectionReconciliationInFlight = false;
    this.ttsInitialization = undefined;
    this.ttsPresentationMetadata = undefined;
    this.ttsAvailabilityResolved = false;
    this.ttsWarmupScheduled = false;
    this.chineseConversionLoaded = false;
    // restoreEntryPresentation already supplied the accepted settings when
    // the shelf's optional preparation completed.
    registerReaderFonts(this.getUIContext().getFont());
    this.onExitRequestHandler((intent?: 'navigation'): void =>
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
    // ReaderShell and Index both own the complete edge-to-edge window. These
    // are observed platform facts, never Phone/Tablet fallback dimensions.
    if (!metrics.ready || metrics.windowRect.width <= 0 || metrics.windowRect.height <= 0) return;
    this.viewportWidth = metrics.windowRect.width;
    this.viewportHeight = metrics.windowRect.height;
  }

  /** Cold persisted entry is an initial-build input, not a post-mount task.
   * This path never starts acquisition or waits for settings/window changes. */
  private restorePersistedFirstPresentation(lifecycleToken: number): 'unavailable' | 'ready' | 'deferred' | 'failed' {
    const owner = ReaderRuntimeOwner.current();
    const metrics = ReaderWindowCoordinator.metrics();
    const unavailable = !this.entryAppearanceReady ? 'appearanceNotReady' :
      !this.readerSettingsLoaded ? 'settingsNotReady' :
      !this.hasMeasuredViewport() || !metrics.ready ? 'viewportNotReady' :
      !readerFontFamilyReady(readerAppearanceSnapshotFontFamily(this.appearanceSnapshot)) ||
        !readerFontFamilyReady(TYPE_READER_CHAPTER_TITLE.fontFamily) ? 'fontNotReady' :
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
        context = this.positionContextForScope(bookmark.positionScope, bookmark.chapterIndex, bookmark.chapterOffset);
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
        snapshot.navigation?.current.navigable === false || ReaderWindowCoordinator.metrics().revision !== metrics.revision)
        return 'unavailable';
      const chapter = snapshot.chapter;
      const chapterMap = readingChapterLayoutMap(chapter);
      // Paged admission is decided by the real bounded measurement below.
      // An unknown image outside that page cannot reject already-readable
      // text. Continuous layout still needs its complete window geometry.
      if (chapterMap.scalarCount() === 0 || (this.readerSettingsSnapshot.navigationMode === 'continuous' &&
        chapter.images.some((image: ReadingSessionImage): boolean => !hasKnownReadingImageGeometry(image)))) return 'unavailable';
      const navigation = snapshot.navigation;
      const entries: LocalReadingTocEntry[] = navigation === undefined ?
        [{ index: chapter.chapterIndex, title: chapter.chapterTitle, downloadState: 'unknown', navigable: true }] :
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
      this.chapterWindow.configure(this.sourceId, this.bookId, entries.map((entry: LocalReadingTocEntry): number => entry.index));
      this.restoredProgress = bookmark !== undefined || requested !== undefined ? undefined : pending ?? snapshot.progress;
      if (bookmark !== undefined) this.consumedBookmarkAnchorRequestId = bookmark.requestId;
      this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
      this.chapterWindow.setCurrent(chapter);
      this.retainCurrentChapterWindow();
      this.chapter = chapter;
      this.rebuildChapterImageIndexes(chapter);
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
    this.chapterWindow.configure(this.sourceId, this.bookId,
      this.readingTocEntries().map((entry: LocalReadingTocEntry): number => entry.index));
    this.restoreMaterializedChapterContext(snapshot.context, true);
    // The handoff stays constant-size. Neighbour preparation expands a new
    // run, never the retained snapshot, and always starts with the real page.
    this.paginationDraft = new ReadingPaginationPrefix(retainedKey, observation);
    this.measurementRequestedAnchorScalar = observation.requestScalar;
    this.materializedChapterSelectionToken = selectionToken;
    this.chapterWindow.setCurrent(snapshot.context.chapter);
    this.rebuildChapterImageIndexes(snapshot.context.chapter);
    this.publishMeasuredFirstPage(snapshot.page, snapshot.context.chapter, selectionToken);
    this.desiredChapterOffset = snapshot.page.startScalar;
    this.desiredChapterProgress = snapshot.progress.chapterProgress;
    this.phase = 'ready';
    this.appearanceLoaded = true;
    this.measurementCompleting = false;
    this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
    this.admitCommittedProgress(snapshot.progress);
    if (!isCurrent()) return true;
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
    return true;
  }

  private retainConfirmedEntryPresentation(): void {
    const owner = ReaderRuntimeOwner.current();
    const handoff = readingEntryHandoff(owner);
    handoff.clear();
    if (!owner.optionalReadingEntryMemoryEnabled()) return;
    const page = this.visiblePage;
    const chapter = this.chapter;
    const progress = this.lastCommittedProgress;
    if (this.phase !== 'ready' || page === undefined || chapter === undefined ||
      progress === undefined || this.sessionGateway === undefined || !this.hasMeasuredViewport() ||
      this.readerSettingsSnapshot.navigationMode !== 'paged' || this.appearanceSnapshot.customFont !== undefined ||
      page.measuredAppearance === undefined ||
      JSON.stringify(page.measuredAppearance) !== JSON.stringify(this.appearanceSnapshot) ||
      this.remeasurePending || this.appearanceReflowInvalidateCurrentLayout ||
      this.pageTurnPreparation !== undefined || this.pageTurnSettlingPrepared !== undefined ||
      chapter.images.length > 0 || page.fragments.length === 0 ||
      progress.chapterIndex !== chapter.chapterIndex || progress.chapterOffset !== page.startScalar ||
      this.sessionGateway.hasPendingSourceSwitch() || this.pendingControlSelection !== undefined ||
      this.sourceSwitchTransactionId !== undefined) return;
    // Optional retention cannot first copy/serialize an arbitrarily large
    // catalog and only then discover that it exceeds the resource budget.
    const byteLimit = 16 * 1024 * 1024;
    if (chapter.content.length * 12 > byteLimit || this.paragraphRanges.length > 4096 ||
      this.tocEntries.length > 4096 || page.fragments.length > 1024) return;
    let retainedBytes = chapter.content.length * 12 + this.paragraphRanges.length * 96 + 256;
    for (const entry of this.tocEntries) {
      retainedBytes += entry.title.length * 2 + 128;
      if (retainedBytes > byteLimit) return;
    }
    const nativeRecipeKeys = new Set<string>();
    for (const fragment of page.fragments) {
      for (const recipe of [fragment.nativeParagraph, fragment.nativeTitle]) {
        if (recipe !== undefined && !nativeRecipeKeys.has(recipe.key)) {
          nativeRecipeKeys.add(recipe.key);
          retainedBytes += recipe.text.length * 2 + 256;
        }
      }
      retainedBytes += fragment.text.length * 2 + 128;
      if (retainedBytes > byteLimit) return;
    }
    const remote = this.sessionGateway.remoteSession();
    if (remote !== undefined) {
      const remoteBytes = estimateRetainedRemoteSessionBytes(remote, byteLimit - retainedBytes);
      if (remoteBytes === undefined) return;
      retainedBytes += remoteBytes;
    }
    const context = this.captureMaterializedChapterContext();
    const observation = page.paginationObservation;
    const key = page.paginationKey;
    if (key === undefined || observation === undefined || !this.samePaginationKey(key, this.currentPaginationKey()) ||
      observation.startScalar !== page.startScalar || observation.endScalarExclusive !== page.endScalar) return;
    const retainedContext = new ReaderMaterializedChapterContext(chapter, context.layoutMap,
      context.contentVersion, context.paragraphRanges, new ReadingPaginationPrefix(key, observation), page.startScalar,
      progress.chapterProgress, observation.requestScalar);
    // Bookmark annotations have their own read lifecycle; they are not part of
    // the content/position lease used to keep this real page alive.
    const retainedToc = this.tocEntries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, downloadState: entry.downloadState, navigable: entry.navigable,
      level: entry.level,
    }));
    let retainedGateway = this.sessionGateway;
    if (remote !== undefined) {
      // The consumed acquisition snapshot can still contain a different
      // chapter and images. Retain only its catalog, accounted separately.
      const retainedRemote: RemoteReadingSession = {
        identity: remote.identity, acquisitionMode: remote.acquisitionMode, detailUrl: remote.detailUrl,
        tocUrl: remote.tocUrl, book: remote.book, continuationVariables: remote.continuationVariables,
        entries: remote.entries, hostRequirements: remote.hostRequirements, sourceVersion: remote.sourceVersion,
        catalogAt: remote.catalogAt, catalogVersion: remote.catalogVersion, contextVersion: remote.contextVersion,
        requiresContextRefresh: remote.requiresContextRefresh, refreshRecommended: remote.refreshRecommended,
      };
      retainedGateway = new ReadingSessionFlowGateway(this.sourceId, this.bookId,
        { kind: 'remote', session: retainedRemote }, owner);
    }
    const valid = owner.readingEntryPreparations().captureValidity(this.sourceId, this.bookId);
    const snapshot = new ReaderRetainedPresentation(this.sourceId, this.bookId, retainedGateway,
      retainedContext, page, retainedToc, progress, JSON.stringify(this.appearanceSnapshot),
      JSON.stringify(this.readerSettingsSnapshot), this.paginationLayoutSignature(),
      ReaderWindowCoordinator.metrics().densityPixels, valid, this.entryCatalogNavigation, this.entryCatalogPending);
    handoff.publish(this.sourceId, this.bookId, snapshot, retainedBytes, valid);
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
    this.finishSessionCapsuleMorph();
    this.bookmarkRollbackGeneration += 1;
    this.bookmarkMutationGeneration += 1;
    this.bookmarkPendingTarget = '';
    // Do not begin a second, fire-and-forget write after the host has already
    // unmounted us. Normal exit is serialized through requestExit() instead.
    this.invalidatePageTurnRuntime(true);
    this.bookTurnSession.setEventListener((_event: BookTurnNativeEvent): void => {});
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    this.bookTurnMotion = undefined;
    this.bookTurnSurfaceGeneration += 1;
    this.bookTurnSurfaceOpacity = 0;
    this.clearDeferredPageTurnWork();
    this.restoreInitialWindowBrightness();
    this.screenAwakeLease?.dispose();
    this.screenAwakeLease = undefined;
    this.screenAwakeKeepScreenOn = false;
    this.readingSystemEventHost?.dispose();
    this.readingSystemEventHost = undefined;
    this.mounted = false;
    this.onControlInputBoundaryChanged();
    if (this.isReaderIdentityCurrent?.() !== false) {
      if (this.windowChromeActive) ReaderWindowCoordinator.requestAppChrome();
      void ReaderWindowCoordinator.requestAppWindowPolicy();
    }
    this.lifecycleToken += 1;
    this.quickSearchPublication.cancel();
    this.replacePanelGeneration += 1;
    this.appearanceReflowInvalidateCurrentLayout = false;
    this.invalidateReplaceMutationOwner();
    this.cancelPendingAutoPageStart();
    this.autoPageCoordinator.dispose();
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
    this.ttsPresentationMetadata = undefined;
    this.ttsAvailabilityResolved = false;
    this.ttsWarmupScheduled = false;
    this.previousChapterMeasurement = undefined;
    this.pendingControlSelection = undefined;
    this.pendingControlSelectionOrigin = undefined;
    this.pendingControlSelectionCandidate = undefined;
    this.pendingControlSelectionRetry = undefined;
    this.controlSelectionReconciliationInFlight = false;
    this.releaseAllReadingImages();
    this.nativeParagraphResources.close();
    this.chapterWindow.clear();
    this.remoteSessionObserverDispose?.();
    this.remoteSessionObserverDispose = undefined;
    this.sessionGateway = undefined;
    if (ttsCoordinator !== undefined) void ttsCoordinator.dispose();
    this.resetPaginationDraft();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.cancelPageTurnPreparationRetry();
    this.nativeTextMeasurement.clear();
    // Clear the host-held closure so an old reader instance cannot be asked
    // to exit after it has been removed from the route.
    this.onExitRequestHandler((): void => {});
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

  private async restartPreparedReadingEntry(lifecycleToken: number, selectionToken: number,
    layoutReady: Promise<void[]>): Promise<void> {
    this.preparedReadingEntry = undefined;
    this.sessionGateway = undefined;
    await this.ensureReadingSession(lifecycleToken, selectionToken, true);
    if (this.isSelectionActive(lifecycleToken, selectionToken)) {
      await this.loadInitialChapter(lifecycleToken, layoutReady);
    }
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
      if (this.readerSettingsSnapshot.navigationMode === 'continuous' &&
        this.hasContinuousRenderContent()) {
        ReaderContinuousReadingStage({
          chapterIdentity: this.continuousRenderChapterIdentity,
          chapterTitle: this.continuousRenderChapterTitle,
          geometryKey: this.continuousRenderGeometryKey,
          titleRecipeProvider: (): ReaderNativeParagraphRecipe | undefined => this.continuousTitleRecipe,
          contentRevision: this.continuousRenderRevision,
          changedFragmentIndex: this.continuousChangedFragmentIndex,
          fragmentsProvider: (): ReadingSurfacePageFragment[] => this.continuousFragments,
          initialFragmentIndex: this.continuousInitialFragmentIndex,
          initialFragmentProgress: this.continuousInitialFragmentProgress,
          initialAnchorRevision: this.continuousInitialAnchorRevision,
          onProgrammaticScrollReady: (begin: (() => void) | undefined): void => {
            this.continuousProgrammaticScrollIntent = begin;
          },
          layout: this.readingLayout(),
          appearance: this.visibleReadingAppearance(),
          ttsHighlightStart: this.ttsFollowHighlight ? this.ttsState.charStart : undefined,
          ttsHighlightEnd: this.ttsFollowHighlight ? this.ttsState.charEnd : undefined,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerTextSelectionEnabled(),
          interactionEnabled: this.isReaderPageInteractionEnabled(),
          onVisibleRangeChanged: (start: number, end: number, startProgress: number): void =>
            this.onContinuousVisibleRangeChanged(start, end, startProgress),
          onScrollStopped: (): void => this.onContinuousScrollStopped(),
          onReachStart: (): void => this.onContinuousReachStart(),
          onReachEnd: (): void => this.onContinuousReachEnd(),
          onBoundaryDrag: (direction: 'previous' | 'next'): void =>
            this.onContinuousBoundaryDrag(direction),
          onTurn: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome =>
            this.requestPageTurn(direction),
          onOpenControl: (): void => this.openReaderControl(),
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
      } else {
        ReaderPageTurnStage({
          contentRevision: this.pageTurnRenderRevision,
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
          ttsHighlightStart: this.ttsFollowHighlight ? this.ttsState.charStart : undefined,
          ttsHighlightEnd: this.ttsFollowHighlight ? this.ttsState.charEnd : undefined,
          autoPageHighlightStart: this.autoPageHighlightStart(),
          autoPageHighlightEnd: this.autoPageHighlightEnd(),
          longPressSelectText: this.readerTextSelectionEnabled(),
          translateY: this.bookmarkPageOffsetY,
          onCurrentPagePresented: (revision: number): void => this.onBookTurnArkUIFramePresented(revision),
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
      // Reader Control (RC-READER-CONTROL-01): tapping the center vertical band
      // raises the control layer, which overlays the reading surface.
      // The Panel stays mounted, but only this Host's linked session owns
      // routes, held input, the transition and committed close revision.
      ReaderControlPanel({
        controlThemeStyle: readerControlThemeStyle(this.readerAppScheme),
        launchSample: this.sessionLaunch?.sample,
        launchGeneration: this.sessionLaunch?.generation ?? 0,
        launchSourceKind: this.sessionLaunch?.geometry.kind ?? 'quickAutoPage',
        launchBusinessStatus: this.sessionLaunchBusinessStatus(),
        launchDesiredPlaying: this.sessionLaunch?.desiredPlaying ?? true,
        launchStageOpacity: this.sessionLaunchStageOpacity,
        launchOwnsControls: this.sessionLaunch?.ownership === 'stage',
        launchRecovering: this.sessionLaunch?.ownership === 'handoffPending',
        onLaunchSourceReady: (generation: number): void => this.onSessionLaunchSourceReady(generation),
        launchInteractionEnabled: !this.pageTurnInputOwned && this.sessionLaunch?.ownership === 'stage',
        launchSourceTtsState: this.sessionLaunchSourceTtsState,
        launchSourceAutoStatus: this.sessionLaunchSourceAutoStatus,
        launchCountdown: this.automaticReadingState().remainingSeconds,
        onLaunchToggle: (): void => this.toggleSessionCapsule(),
        onSessionLaunchShellMeasured: (topExit: number, dockExit: number): void => {
          this.sessionLaunchTopExit = topExit; this.sessionLaunchDockExit = dockExit;
        },
        bookTitle: this.bookTitle,
        chapterTitle: this.chapterTitle,
        sourceId: this.sourceId,
        sourceName: this.sourceName,
        progressPercent: this.controlProgress(),
        totalChapters: this.totalChapters,
        layout: this.controlLayout(this.readerWindowMetricsRevision),
        controlSession: $controlSession,
        inputEnabled: this.isControlInputEnabled() && (this.sessionLaunch === undefined || this.sessionLaunch.ownership === 'released'),
        controlObscured: this.controlObscured,
        controlOpenRevision: this.controlOpenRevision,
        dismissTemporaryRevision: this.dismissControlTemporaryRevision,
        temporaryLayerActive: this.controlTemporaryLayer,
        onVisualSessionChange: (state: ReaderControlSessionState): void => {
          // This assignment is deliberately non-reactive.  It is a decision
          // snapshot for Back/close only; the Panel owns the visual @State.
          const wasPresented = this.controlsPresentedForWindow();
          this.latestControlVisualSession = copyReaderControlSessionState(state);
          this.admitSessionControlClosing(readerControlHostClosing(state));
          if (wasPresented !== this.controlsPresentedForWindow()) this.applyWindowPolicyForChromeOwner();
        },
        onTemporaryLayerChange: (active: boolean): void => { this.controlTemporaryLayer = active; },
        onInputActivity: (): void => this.invalidateControlBackdrop(),
        onBackdropRegionsChange: (regions: ReaderControlBackdropRect[], ready: boolean): void => {
          this.controlBackdropRegions = regions;
          this.controlBackdropGeometryReady = ready;
        },
        // ReaderControlPanel deliberately stays mounted for its transitions.
        // Before the first open, avoid projecting a large TOC into the hidden
        // shell; after the first open, retain the exact same array identity
        // through dismiss so Repeat/List never receives an empty replacement
        // during the compositor's closing frames.
        tocEntries: readerControlHostVisible(this.controlSession) || this.controlDirectoryDataRetained ?
          this.controlDirectoryEntries() : EMPTY_CONTROL_DIRECTORY_ENTRIES,
        catalogComplete: !this.entryCatalogPending,
        catalogChapterCount: this.entryCatalogNavigation?.chapterCount ?? this.tocEntries.length,
        catalogCurrentPosition: this.controlDirectoryCatalogPosition(),
        onRequireCompleteCatalog: (): void => this.requestCatalogForTurn(),
        currentChapterIndex: this.currentChapterIndex(),
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        chapterDownloadEnabled: this.sourceId !== LOCAL_READING_SOURCE_ID,
        bookmarkLoadFailed: this.controlBookmarkLoadFailed,
        bookmarkLoadMessage: this.bookmarkLoadMessage,
        onRetryBookmarkLoad: (): void => this.loadControlBookmarks(),
        searchQuery: this.quickSearchQuery,
        searchPublication: this.quickSearchPublication,
        searchRevision: this.quickSearchRevision,
        brightnessPercent: this.brightnessPercent,
        brightnessAutomatic: this.brightnessAutomatic,
        brightnessRevision: this.brightnessRevision,
        autoPageStatus: this.automaticReadingState().status,
        autoPageSpeedSeconds: this.automaticReadingState().speedSeconds,
        autoPageTimerMinutes: this.automaticReadingConfiguration().timerMinutes,
        autoPageTimerSeconds: this.automaticReadingConfiguration().timerSeconds,
        autoPageTimerSummaryText: formatReaderAutoPageFullTimerSummary(this.automaticReadingConfiguration()),
        autoPageFollowHighlight: this.automaticReadingConfiguration().followHighlight,
        replaceState: this.replaceState,
        controlReplaceState: this.controlReplaceState,
        appearanceSnapshot: this.appearanceSnapshot,
        chineseConversionMode: this.chineseConversionMode,
        settingsSnapshot: this.readerSettingsSnapshot,
        pageTurnSimulationAvailable: !this.bookTurnRuntimeFailed,
        ttsState: this.ttsState,
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
        onSourceSwitch: (): void => {
          this.hideControl();
          this.onSwitchSource();
        },
        onRefreshChapter: (): void => this.refreshCurrentChapter(),
        bookDownloadEnabled: this.sourceId !== LOCAL_READING_SOURCE_ID && (this.entryCatalogNavigation?.readableChapterCount ?? this.totalChapters) > 0 && !this.offlineBookOperationActive,
        bookDownloadActive: this.offlineBookOperationActive,
        onDownloadBook: (): void => this.requestReadingDownload(),
        onOpenBookInfo: (): void => this.onOpenBookInfo(),
        chapterRefreshEnabled: this.canRefreshCurrentChapter(),
        onPageChange: (page: ReaderControlPage): void => this.setControlPage(page),
        onModuleSelect: (_module: string): void => {},
        onSelectChapter: (chapterIndex: number): void => this.selectControlChapter(chapterIndex),
        onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void =>
          this.selectBookmarkAnchor(chapterIndex, chapterOffset, positionScope),
        bookmarkIdentity: this.bookmarkIdentity,
        onDownloadChapter: (chapterIndex: number): void => this.requestReadingDownload(chapterIndex),
        onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          this.onCreateChapterStartBookmark(request),
        onPreviousChapter: (): void => this.stepControlChapter(-1),
        onNextChapter: (): void => this.stepControlChapter(1),
        onProgressChange: (percent: number): void => this.seekControlProgress(percent),
        onBrightnessChange: (percent: number): void => this.setReaderBrightness(percent),
        onBrightnessAuto: (): void => this.setReaderAutomaticBrightness(),
        onBrightnessCancel: (): void => this.cancelReaderBrightness(),
        onExpandDirectory: (): void => this.expandControlDirectory(),
        onSearchQueryChange: (query: string): void => this.updateQuickSearchQuery(query),
        onSearch: (): void => this.runQuickSearch(),
        onSearchLoadMore: (): void => this.loadMoreQuickSearch(),
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
        onReloadControlReplace: (): Promise<void> => this.reloadControlReplace(),
        onSaveControlReplace: (draft: ReaderControlReplaceDraft): Promise<void> => this.saveControlReplace(draft),
        onToggleControlReplace: (rule: ReaderReplaceRule, value: boolean): Promise<void> =>
          this.toggleControlReplace(rule, value),
        onDeleteControlReplace: (rule: ReaderReplaceRule): Promise<void> => this.deleteControlReplace(rule),
        onPreviewControlReplace: (): Promise<ReaderReplacePreview> => this.previewControlReplace(),
        onImportControlReplace: (): Promise<void> => this.importControlReplace(),
        onExportControlReplace: (): Promise<void> => this.exportControlReplace(),
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
        onTtsHttpEnginePut: (config: ReaderTtsEngineOption): Promise<void> => this.saveHttpTtsEngine(config),
        onTtsHttpEngineDelete: (id: number): Promise<void> => this.deleteHttpTtsEngine(id),
      })
        // The control overlay, including its transparent outside-tap owner,
        // must sit above selectable reading Text nodes on every control route.
        .zIndex(7)
        .hitTestBehavior(HitTestMode.Transparent);
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
              onRegrab: (width: number, height: number, x: number, y: number, time: number): ReaderPageGestureState | undefined =>
                this.regrabPageTurn(width, height, x, y, time),
              readinessRevision: this.pageTurnReadinessRevision + this.pageTurnRenderRevision,
              onPreparationNeeded: (direction: ReaderPageTurnDirection): void => this.prepareHeldPagePointer(direction),
          interactionEnabled: this.phase !== 'failed' && this.sourceSwitchFailureMessage.length === 0 &&
            (this.readerSettingsSnapshot.navigationMode === 'paged' ||
            !this.hasContinuousRenderContent()) && this.isReaderPageInteractionEnabled(),
          tapOnly: this.pageTurnTapOnlyInput(),
          currentTapOnly: (): boolean => this.pageTurnTapOnlyInput(),
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          allowTextSelection: this.readerTextSelectionEnabled(),
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
      if (this.phase === 'failed' || this.sourceSwitchFailureMessage.length > 0) {
        this.readingFailureContent();
      }
      if (this.sessionLaunch === undefined && this.shouldShowSessionCapsule()) {
        ReaderSessionCapsule({
          type: this.sessionCapsuleType(), sessionState: this.sessionCapsuleState(), countdown: this.sessionCapsuleCountdown(),
          surfaceColor: readerAppColor('TOK_READ_SURFACE', this.readerAppScheme),
          surfaceBorderColor: readerAppColor('TOK_LINE', this.readerAppScheme),
          textColor: readerAppColor('TOK_READ_INK', this.readerAppScheme),
          primaryColor: readerAppColor('TOK_READ_PRIMARY', this.readerAppScheme),
          onPrimaryColor: readerAppColor('app.control.onPrimary', this.readerAppScheme),
          themeScheme: this.readerAppScheme,
          interactionEnabled: !this.pageTurnInputOwned,
          onToggle: (): void => this.toggleSessionCapsule(),
          onMeasured: (width: number, height: number): void => this.onSessionCapsuleMeasured(this.sessionCapsuleType(), width, height),
        }).position({ x: this.sessionCapsuleLayout().sessionX, y: this.sessionCapsuleLayout().sessionY }).zIndex(8);
      }
      if (this.sessionLaunch !== undefined) {
        ReaderPageChrome({
          isSessionOverlay: true, topStartText: this.sessionChromeForPresentation().topStartText,
          topEndText: this.sessionChromeForPresentation().topEndText, bottomStartText: this.sessionChromeForPresentation().bottomStartText,
          bottomEndText: this.sessionChromeForPresentation().bottomEndText, sessionVisible: true,
          sessionWidth: this.sessionLaunch.geometry.capsuleWidth, sessionHeight: 24,
          layout: this.readingLayout(), appearance: this.appearanceSnapshot,
          incomingOpacity: this.sessionLaunch.sample.immersiveOpacity,
          footerOpacity: this.sessionLaunchFooterExiting ? this.sessionLaunchFooterOpacity : this.sessionLaunch.sample.footerOpacity,
          footerTranslateX: this.sessionLaunchFooterExiting ? this.sessionLaunchFooterOffset : this.sessionLaunch.sample.footerTranslateX,
          sessionExitProgress: this.sessionLaunchFooterExitProgress,
        }).opacity(this.sessionLaunchFooterExiting ? 1 : this.sessionLaunchStageOpacity).zIndex(8).hitTestBehavior(HitTestMode.None);
      }
    }
    .width('100%')
    .height('100%')
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
    return this.readerSettingsSnapshot.navigationMode === 'paged' &&
      this.readerSettingsSnapshot.pageTransition === 'simulation' && !this.reduceMotion;
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
      const prepared = this.pageTurnSettlingPrepared;
      if (prepared !== undefined && !this.pageTurnCommitStarted) {
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
        if (this.pageTurnCommitSucceeded) this.finishSuccessfulPageTurnPresentation(event.generation);
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
    this.clearBookTurnCapturedIdentities();
    // Once the visual endpoint has been reported, the Core transaction owns
    // the result. Keep that atomic decision and reveal the static admitted
    // page when it finishes; before the endpoint no progress write has begun.
    if (this.pageTurnAnimationFinished && this.pageTurnCommitStarted) {
      // Once the authoritative page is promoted, lost Native slots have no
      // remaining decision to make. Do not retry their old generation forever.
      if (this.pageTurnCommitFinished && this.pageTurnCommitSucceeded && this.pageTurnSettlingPrepared === undefined) {
        this.requestBookTurn2DFallback(this.pageTurnSettlementGeneration);
      }
      return;
    }
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
    if (!this.mounted || !this.usesBookTurnSimulation() || this.sessionLaunchRenderWorkBlocked()) return;
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
    while (this.bookTurnTextureRefreshInFlight !== undefined) await this.bookTurnTextureRefreshInFlight;
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted) return;
    const operation = this.performBookTurnTextureRefresh(generation);
    this.bookTurnTextureRefreshInFlight = operation;
    try { await operation; } finally {
      if (this.bookTurnTextureRefreshInFlight === operation) this.bookTurnTextureRefreshInFlight = undefined;
    }
  }

  private async performBookTurnTextureRefresh(generation: number): Promise<void> {
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      this.sessionLaunchRenderWorkBlocked() ||
      !this.usesBookTurnSimulation() || this.controlVisible() || this.bookTurnRuntimeFailed || !this.bookTurnSession.isReady() ||
      this.phase !== 'ready' || this.pageTurnPreparation !== undefined ||
      this.pageTurnInputPhase() !== 'idle') {
      return;
    }
    const current = this.currentPageTurnRenderPage();
    // Snapshot.get waits for paint of the node it receives; it does not prove
    // that a pending parent revision has reached that node. The slot callback
    // re-schedules this lane after that exact revision has been delivered.
    if (this.bookTurnArkUIContentRevision !== current.renderRevision) return;
    const previous = this.preparedPageTurnRenderPage('previous');
    const next = this.preparedPageTurnRenderPage('next');
    let capturedThisFrame = this.bookTurnCapturedIdentity(BOOK_TURN_TEXTURE_CURRENT) !== current.textureIdentity;
    if (!await this.captureBookTurnTexture(BOOK_TURN_TEXTURE_CURRENT, current, generation)) return;
    const first = this.preferredPageTextureDirection === 'previous' ? previous : next;
    const second = this.preferredPageTextureDirection === 'previous' ? next : previous;
    const firstSlot = this.preferredPageTextureDirection === 'previous' ? BOOK_TURN_TEXTURE_PREVIOUS : BOOK_TURN_TEXTURE_NEXT;
    const secondSlot = this.preferredPageTextureDirection === 'previous' ? BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS;
    // This yield only spreads expensive snapshot work across UI frames.
    // Cached slots need no work or extra delay; revision, paint and upload
    // admission remain enforced by the capture path for every new texture.
    if (first !== undefined && this.bookTurnCapturedIdentity(firstSlot) !== first.textureIdentity) {
      if (capturedThisFrame) await this.yieldPageTextureFrame();
      if (!await this.captureBookTurnTexture(firstSlot, first, generation)) return;
      capturedThisFrame = true;
    }
    if (second !== undefined && this.bookTurnCapturedIdentity(secondSlot) !== second.textureIdentity) {
      if (capturedThisFrame) await this.yieldPageTextureFrame();
      await this.captureBookTurnTexture(secondSlot, second, generation);
    }
  }

  private yieldPageTextureFrame(): Promise<void> {
    return new Promise<void>((resolve: () => void): void => {
      this.getUIContext().postFrameCallback(new ReaderUIFrameCallback(resolve));
    });
  }

  private async captureBookTurnTexture(
    slot: BookTurnTextureSlot,
    page: ReaderPageTurnRenderPage,
    generation: number,
  ): Promise<boolean> {
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      this.sessionLaunchRenderWorkBlocked() ||
      !this.usesBookTurnSimulation() || this.controlVisible() || this.bookTurnRuntimeFailed || this.phase !== 'ready' ||
      this.pageTurnInputPhase() !== 'idle') {
      return false;
    }
    if (this.bookTurnCapturedIdentity(slot) === page.textureIdentity) return true;
    const pageGeneration = this.pageTurnGeneration;
    let published = false;
    let pixelMap = this.takeBookTurnPendingSnapshot(page.textureIdentity);
    let content: ComponentContent<BookTurnTextureBuildInput> | undefined = undefined;
    try {
      const uiContext = this.getUIContext();
      const snapshot = uiContext.getComponentSnapshot();
      const hasBodyImages = page.fragments.some((fragment: ReadingSurfacePageFragment): boolean =>
        (fragment.fileUri?.length ?? 0) > 0 || fragment.imageSource !== undefined);
      if (pixelMap !== undefined) {
        // A DOWN may have delayed publication after a completed snapshot.
        // Reuse only its exact content/layout identity; all upload gates below
        // still require the current idle generation.
      } else if (slot === BOOK_TURN_TEXTURE_CURRENT && !hasBodyImages) {
        // Text-only current pages can reuse their mounted physical subtree.
        // Image pages require the checked capture lane below: layout/paint
        // readiness alone does not establish completion of image decoding.
        pixelMap = await snapshot.get(`${READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID}-${this.pageTurnCurrentSlot}`, {
          scale: this.bookTurnTextureSnapshotScale(),
          // A new chrome/content revision must be painted before its identity
          // is attached to these pixels. Reuse the mounted image-ready tree.
          waitUntilRenderFinished: true,
        });
      } else {
        const input = new BookTurnTextureBuildInput(
          page,
          this.viewportWidth,
          this.viewportHeight,
          this.readingLayout(),
          page.appearance ?? this.appearanceSnapshot,
          (): ReadingSurfacePageFragment[] => this.bookTurnTextureBuildPage?.fragments ?? [],
        );
        this.bookTurnTextureBuildPage = page;
        content = this.bookTurnTextureContent;
        if (content === undefined) {
          content = new ComponentContent<BookTurnTextureBuildInput>(uiContext, wrapBuilder(BookTurnTextureBuilder), input);
          this.bookTurnTextureContent = content;
        } else {
          content.update(input);
        }
        pixelMap = await this.captureDecodedBookTurnPage(content, generation);
        if (pixelMap === undefined) return false;
      }
      if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
        !this.usesBookTurnSimulation() || this.controlVisible() || this.pageTurnInputPhase() !== 'idle') {
        return false;
      }
      const canPublish = (): boolean => generation === this.bookTurnTextureCaptureGeneration && this.mounted &&
        this.usesBookTurnSimulation() && !this.controlVisible() && this.phase === 'ready' &&
        this.pageTurnInputPhase() === 'idle' && !this.bookTurnRuntimeFailed && !this.sessionLaunchRenderWorkBlocked();
      const uploaded = await this.bookTurnSession.uploadTexture(slot, pixelMap, page.textureIdentity, canPublish);
      if (!canPublish()) return false;
      if (!uploaded) {
        this.failBookTurnTextureCapture(slot, generation, 'Native rejected the PixelMap');
        return false;
      }
      published = true;
      return true;
    } catch (error) {
      const message = errorMessageOf(error);
      this.failBookTurnTextureCapture(slot, generation, message);
      return false;
    } finally {
      if (pixelMap !== undefined) {
        if (!published && pageGeneration === this.pageTurnGeneration && this.mounted && !this.exitRequested &&
          this.usesBookTurnSimulation() && !this.bookTurnRuntimeFailed) {
          // Retain at most one completed bitmap while a newer finger owns
          // input. No upload or page turn is admitted by retaining CPU pixels.
          this.bookTurnSession.retainPendingSnapshot(page.textureIdentity, pageGeneration, pixelMap);
        } else {
          try { pixelMap.release(); } catch (_) {}
        }
      }
    }
  }

  private takeBookTurnPendingSnapshot(identity: string): image.PixelMap | undefined {
    return this.bookTurnSession.takePendingSnapshot(identity, this.pageTurnGeneration);
  }

  private releaseBookTurnPendingSnapshot(): void { this.bookTurnSession.releasePendingSnapshot(); }

  private releaseBookTurnTextureContent(): void {
    const content = this.bookTurnTextureContent;
    this.bookTurnTextureContent = undefined;
    this.bookTurnTextureBuildPage = undefined;
    if (content === undefined) return;
    // Never destroy a tree while the platform still owns its pending snapshot.
    const pending = this.bookTurnTextureRefreshInFlight;
    if (pending === undefined) content.dispose();
    else void pending.then((): void => content.dispose(), (): void => content.dispose());
  }

  private async captureDecodedBookTurnPage(
    content: ComponentContent<BookTurnTextureBuildInput>, generation: number,
  ): Promise<image.PixelMap | undefined> {
    // One bounded offscreen tree is updated between serialized idle captures.
    // Its local Images decode synchronously; the ordinary reading tree stays
    // asynchronous. Checked capture still rejects unready/failed image pixels.
    const delays: number[] = [0, 16, 64, 128];
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
      if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
        !this.usesBookTurnSimulation() || this.controlVisible() || this.phase !== 'ready' ||
        this.pageTurnInputPhase() !== 'idle' || this.bookTurnRuntimeFailed) return undefined;
      try {
        return await this.getUIContext().getComponentSnapshot().createFromComponent(
          content, delays[attempt], true,
          { scale: this.bookTurnTextureSnapshotScale(), waitUntilRenderFinished: true });
      } catch (error) {
        // 160001 means decoding has not completed, not a successful empty
        // picture. Other errors and an exhausted budget follow capability
        // failure handling; stale work is rejected before any further try.
        if ((error as BusinessError).code !== 160001 || attempt === delays.length - 1) throw (error as Error);
      }
    }
    return undefined;
  }

  private failBookTurnTextureCapture(slot: BookTurnTextureSlot, generation: number, message: string): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience book-turn texture failed slot=${slot}: ${message}`);
    if (generation !== this.bookTurnTextureCaptureGeneration || !this.mounted ||
      !this.usesBookTurnSimulation()) return;
    // A missing required texture must not turn the full-screen interaction
    // layer into a permanent wait state. Fail this mounted Native capability
    // and immediately drain any complete user intent through the admitted
    // no-animation path.
    this.failBookTurnRuntime();
    this.drainRapidPageTurn();
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
    return this.bookTurnSession.capturedIdentity(slot);
  }

  private clearBookTurnCapturedIdentities(): void { this.bookTurnSession.clearCapturedTextures(); }

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
    const elapsed = Math.max(0, this.automaticReadingState().speedSeconds - this.automaticReadingState().remainingSeconds);
    const ratio = Math.max(0, Math.min(1, elapsed / this.automaticReadingState().speedSeconds));
    const index = Math.min(textFragments.length - 1, Math.floor(ratio * textFragments.length));
    return textFragments[index];
  }

  private ttsFollowScope(): ReaderTtsFollowScope {
    return { sourceId: this.sourceId, bookId: this.bookId, lifecycleToken: this.lifecycleToken };
  }

  private scheduleTtsPageFollowResume(): void {
    if (this.ttsFollowResumeScheduled) return;
    this.ttsFollowResumeScheduled = true;
    const lifecycle = this.lifecycleToken;
    setTimeout((): void => {
      this.ttsFollowResumeScheduled = false;
      if (this.mounted && lifecycle === this.lifecycleToken) this.resumeTtsPageFollow();
    }, 0);
  }

  private isAutomaticPageStartCurrent(start: ReaderAutomaticPageStart): boolean {
    if (this.pageTurnAutomaticStart !== start || !this.mounted || !this.appForeground || this.exitRequested ||
      start.lifecycleToken !== this.lifecycleToken || start.generation !== this.pageTurnSettlementGeneration ||
      start.generation !== this.bookTurnSurfaceGeneration || !this.pageTurnSettlementActive ||
      this.pageTurnPresentationPhase !== 'settling' || this.pageTurnSettlingPrepared === undefined ||
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
      this.pageTurnCommitStarted) return;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
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
    this.ttsFollowPositioning = undefined;
    // A user directory/bookmark selection has no TTS lease and keeps its owner.
    if (this.pageTurnPendingChapterSelection?.ttsOwner !== undefined) this.pageTurnPendingChapterSelection = undefined;
    this.cancelAutomaticPageStart('ttsFollow');
  }

  /** Audio publishes semantic positions; it never contributes manual rapid steps. */
  private followTtsPage(state: ReaderTtsState): void {
    this.ttsPageFollow.offer(this.ttsFollowScope(), state);
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
      this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.pageTurnPreparation !== undefined || this.commitInFlight || this.continuousCommitInFlight ||
      readerRapidPageTurnHasWork(this.rapidPageTurnState)) return;
    if (this.ttsFollowPositioning !== undefined) return;
    if (target.chapterIndex !== this.currentChapterIndex()) {
      if (this.isKnownControlChapter(target.chapterIndex)) this.positionTtsFollowTarget(target);
      return;
    }
    if (target.contentVersion !== this.materializedContentVersion) return;
    const key = this.currentPaginationKey();
    const current = this.paginationIndex.findContainingPage(key, this.visiblePage.startScalar);
    const destination = this.paginationIndex.findContainingPage(key, target.scalar);
    if (current === undefined) return;
    if (destination?.pageIndex === current.pageIndex) { this.ttsPageFollow.aligned(target); return; }
    if (target.scalar < this.visiblePage.startScalar && !target.allowBackward) {
      this.ttsPageFollow.aligned(target); return;
    }
    const direction: ReaderPageTurnDirection = target.scalar < this.visiblePage.startScalar ? 'previous' : 'next';
    if (destination === undefined) {
      // A prepared immediate neighbour proves whether the semantic target is
      // farther away without guessing a page number or measuring every page.
      const neighbour = this.preparedPageTurn(direction);
      if (neighbour !== undefined && neighbour.context.chapter.chapterIndex === target.chapterIndex) {
        if (target.scalar >= neighbour.page.startScalar && target.scalar < neighbour.page.endScalar && !target.allowBackward) {
          this.performPageTurn(direction, 'ttsFollow', target);
        } else if (target.allowBackward ||
          (direction === 'next' ? target.scalar >= neighbour.page.endScalar : target.scalar < neighbour.page.startScalar)) {
          this.positionTtsFollowTarget(target);
        }
      } else this.queuePageTurnPreparation(direction);
      return;
    }
    if (target.allowBackward || Math.abs(destination.pageIndex - current.pageIndex) > 1) {
      this.positionTtsFollowTarget(target);
      return;
    }
    // Blocked/preparing outcomes leave the one latest target available. Only
    // a later visible-page admission can mark the semantic target aligned.
    this.performPageTurn(direction, 'ttsFollow', target);
  }

  private positionTtsFollowTarget(target: ReaderTtsFollowTarget): void {
    if (!this.isTtsFollowLeaseCurrent(target)) return;
    this.ttsFollowPositioning = target;
    this.selectChapterAnchor(target.chapterIndex, target.scalar, false, false, undefined, -1,
      false, false, undefined, target);
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
    // The persisted unit is a scalar. Choose its nearest viewport fraction:
    // flooring both physical geometry and scalar conversion drifts backwards
    // by one scalar on each reopen and biases long rows by a full scalar cell.
    const scalarWithinFragment = span === 0 ? 0 : Math.min(span - 1,
      Math.round(span * Math.max(0, Math.min(1, startProgress))));
    this.continuousVisibleScalar = first.startScalar + scalarWithinFragment;
    this.desiredChapterOffset = this.continuousVisibleScalar;
    const scalarCount = this.chapterLayoutMap?.scalarCount() ?? 0;
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.continuousVisibleScalar / scalarCount;
    this.continuousProgressRevision += 1;
    this.resolveVisibleContinuousImages(clampedStart, clampedEnd);
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
        if (!this.mounted || this.exitRequested) return;
        this.getUIContext().getPromptAction().showToast({ message: '阅读进度未保存，将在停止滚动或退出时重试' });
      });
  }

  private onContinuousReachStart(): void {
    if (this.hasPartialEntryWindow()) { this.scheduleEntryWindowHydration(); return; }
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
    if (hasKnownReadingImageGeometry(image)) {
      this.resolveGeometryImagePixels(chapter, image);
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
          hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience continuous image failed: ${this.errorMessage(error)}`);
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
    if (this.pageTurnFrozenRevision === this.pageTurnRenderRevision && this.pageTurnFrozenCurrent !== undefined) {
      return this.pageTurnFrozenCurrent;
    }
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
      origin?.chapter.chapterTitle ?? this.chapter?.chapterTitle ?? this.chapterTitle,
      this.showChapterTitle,
      this.visibleFragments,
      bottomJustifyGap,
      chrome,
      this.visibleReadingAppearance(),
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
      this.pageReadingAppearance(prepared.page),
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
      chrome.topEndText,
      chrome.bottomStartText,
      chrome.bottomEndText,
      chrome.sessionVisible.toString(),
      chrome.sessionWidth.toString(),
      chrome.sessionHeight.toString(),
      this.sessionLaunch !== undefined ? 'session-overlay' : 'page-chrome',
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

  /** Synchronous native layout removes the hidden-tree frame/readback gate.
   * Font readiness is established by the application/appearance owner. */
  private measureNativeTextBatch(): void {
    this.nativeTextMeasurement.clear();
    const style: ReaderNativeTextStyle = {
      widthVp: this.measurementTextWidth(), fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
      fontSize: this.appearanceSnapshot.fontSize, fontWeight: FontWeight.Regular,
      lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot), letterSpacing: this.appearanceSnapshot.letterSpacing,
      color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
      alignment: readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
      breakAll: false,
    };
    if (!this.unicodeProbeVerified) this.nativeTextMeasurement.measure(this.getUIContext(), UNICODE_PROBE, this.unicodeProbeController, style);
    this.measureNativeChapterTitle();
    // A batch bounds allocation, not first-page work. Shape a paragraph only
    // when page admission reaches it; an unneeded suffix must not gate paint.
    for (const paragraph of this.measurementBatch) paragraph.nativeMeasured = false;
  }

  /** Title capacity can be queried after a body paragraph is already shaped.
   * Add only the title node; clearing the batch here would dispose the body
   * before its ownership can transfer to the visible native window. */
  private measureNativeChapterTitle(): void {
    if (!this.measurementIncludesChapterTitle() || this.measuredNativeTitle !== undefined) return;
    this.nativeTextMeasurement.measure(this.getUIContext(),
      this.requireMeasurementChapter().chapterTitle, this.chapterTitleMeasurementController, {
        widthVp: this.measurementTextWidth(),
        color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
        fontFamily: TYPE_READER_CHAPTER_TITLE.fontFamily, fontWeight: TYPE_READER_CHAPTER_TITLE.fontWeight,
        fontSize: TYPE_READER_CHAPTER_TITLE.fontSizeFp, lineHeight: this.readingLayout().titleLineHeightFp,
        letterSpacing: 0, alignment: TextAlign.Center, breakAll: true,
      });
  }

  private measureNativeParagraph(paragraph: MeasurementParagraph): void {
    if (paragraph.nativeMeasured) return;
    this.nativeTextMeasurement.measure(this.getUIContext(),
      this.measurementNodeText(paragraph), paragraph.controller, {
        widthVp: this.measurementTextWidth(),
        fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
        fontSize: this.appearanceSnapshot.fontSize, fontWeight: FontWeight.Regular,
        lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot),
        letterSpacing: this.appearanceSnapshot.letterSpacing,
        color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
        alignment: readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
        breakAll: false,
        indentVp: paragraph.isParagraphStart ?
          this.getUIContext().px2vp(this.getUIContext().fp2px(
            readerAppearanceParagraphIndent(this.appearanceSnapshot.fontSize, this.appearanceSnapshot.indent))) : 0,
      });
    // Ownership may subsequently leave the measurement adapter for display.
    // Adapter membership therefore cannot be used as the measured-state flag.
    paragraph.nativeMeasured = true;
  }

  private async loadInitialReading(lifecycleToken: number): Promise<void> {
    const selectionToken = this.chapterSelectionToken;
    this.initialReadingTraceStartedAt = Date.now();
    this.initialReadingTraceLifecycle = lifecycleToken;
    this.initialReadingTraceDelivered = false;
    this.traceInitialReadingPhase?.('start', lifecycleToken);
    // Start layout snapshots and TOC/progress together. Only the final
    // pagination/open barrier waits for appearance so measurement still uses
    // the admitted typography without serializing independent Core reads.
    const layoutReady = Promise.all([
      this.loadAppearanceSnapshot(lifecycleToken),
      this.loadReaderSettingsSnapshot(lifecycleToken),
    ]).then((loaded: void[]): void[] => {
      this.traceInitialReadingPhase?.('layout-ready', lifecycleToken);
      return loaded;
    });
    // Observe layout failure even if source acquisition fails first.
    void layoutReady.catch((): void => {});
    try {
      await this.ensureReadingSession(lifecycleToken, selectionToken);
      if (!this.isSelectionActive(lifecycleToken, selectionToken) || this.phase === 'failed') return;
      await this.loadInitialChapter(lifecycleToken, layoutReady);
    } catch (error) {
      if (this.isSelectionActive(lifecycleToken, selectionToken)) this.fail(error as Error, lifecycleToken);
    }
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

  private async loadInitialChapter(
    lifecycleToken: number,
    layoutReady: Promise<void[]>,
  ): Promise<void> {
    // Layout starts before TOC/progress. Observe failure immediately while
    // keeping the original promise rejected for the chapter admission gate.
    void layoutReady.catch((): void => {});
    // The initial restore is also a chapter-selection transaction. A manual
    // choice made while these two Core reads are pending must win completely:
    // neither an old progress row nor an old error may mutate/fail the newer
    // selection.
    const selectionToken = this.chapterSelectionToken;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
    try {
      if (this.preparedReadingEntry !== undefined && !this.preparedReadingEntry.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady);
        return;
      }
      let prepared = this.preparedReadingEntry?.isCurrent() === true ? this.preparedReadingEntry : undefined;
      if ((prepared === undefined || prepared.catalogPending === true) && this.activeGateway().loadEntrySnapshot !== undefined && await this.tryInitialEntrySnapshot(lifecycleToken, selectionToken, layoutReady)) return;
      if (!isCurrent()) return;
      if (prepared?.catalogPending === true) {
        // A rejected narrow snapshot is not a complete directory fallback.
        prepared = undefined;
        this.preparedReadingEntry = undefined;
      }
      const initialLoad = await Promise.all([
        prepared === undefined ? this.loadInitialToc(isCurrent) : Promise.resolve(prepared.toc),
        (prepared === undefined ? this.activeGateway().loadProgress(this.bookId, isCurrent) : Promise.resolve(prepared.progress))
          .then((progress: LocalReadingProgressState): LocalReadingProgressState => {
            if (isCurrent()) this.traceInitialReadingPhase?.('initial-progress', lifecycleToken);
            return progress;
          }),
      ]);
      if (!isCurrent()) return;
      if (prepared !== undefined && !prepared.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady);
        return;
      }
      const toc = initialLoad[0];
      // A component may be rebuilt while its last displayed position is still
      // being saved. That process-owned intent outranks a previously prepared
      // durable snapshot; the snapshot remains optional and is discarded.
      const pendingPresentation = this.activeGateway().pendingPresentedProgress?.();
      const progress = pendingPresentation ?? initialLoad[1];
      if (pendingPresentation !== undefined) this.preparedReadingEntry = undefined;
      this.admitTocEntries(toc.entries);
      this.onDirectoryProjectionChanged(toc.entries);
      if (!isCurrent()) return;
      this.chapterWindow.configure(
        this.sourceId,
        this.bookId,
        this.readingTocEntries().map((entry: LocalReadingTocEntry): number => entry.index),
      );
      const requested = this.normalizedRequestedChapter();
      const bookmark = this.requestedBookmarkAnchor;
      let bookmarkContext: RemoteReadingPositionContext | undefined = undefined;
      if (bookmark !== undefined) {
        if (!Number.isSafeInteger(bookmark.chapterOffset) || bookmark.chapterOffset < 0 ||
          (requested !== undefined && requested !== bookmark.chapterIndex)) {
          throw new Error('READING_POSITION_SCOPE_MISMATCH');
        }
        if (this.sourceId !== LOCAL_READING_SOURCE_ID && bookmark.chapterOffset > 0 &&
          bookmark.positionScope === undefined) {
          throw new Error('READING_POSITION_SCOPE_UNAVAILABLE');
        }
        bookmarkContext = this.positionContextForScope(bookmark.positionScope,
          bookmark.chapterIndex, bookmark.chapterOffset);
      }
      const restored = progress.kind === 'restored' ? progress.progress : undefined;
      const target = bookmark?.chapterIndex ?? (requested === undefined ? restored?.chapterIndex : requested);
      // Unread remote books retain the existing three-readable-chapter
      // admission rule. It now runs inside the normal reader acquisition so
      // shelf entry does not read progress/body once before mounting us.
      const remoteSession = this.sessionGateway?.remoteSession() ?? this.remoteSession;
      const tryLeadingEmpty = this.sourceId !== LOCAL_READING_SOURCE_ID && remoteSession !== undefined &&
        progress.kind === 'missing' && requested === undefined && bookmark === undefined &&
        this.sourceSwitchTransactionId === undefined && this.sessionGateway?.hasPendingSourceSwitch?.() !== true;
      const unreadCandidates: number[] = [];
      if (tryLeadingEmpty && remoteSession !== undefined) {
        const navigable = new Set<number>(this.readingTocEntries().map((entry: LocalReadingTocEntry): number => entry.index));
        for (const entry of remoteSession.entries) {
          if (!navigable.has(entry.index) || entry.url.trim().length === 0) continue;
          unreadCandidates.push(entry.index);
          if (unreadCandidates.length === 3) break;
        }
        if (unreadCandidates.length === 0) throw new RemoteReadingSourceError('SOURCE_TOC_EMPTY', '目录没有可阅读的章节');
      }
      const chapterIndex = this.requireKnownChapter(tryLeadingEmpty ? unreadCandidates[0] : target);
      // An explicit directory/mark selection never borrows the old resume offset.
      this.restoredProgress = bookmark !== undefined || requested !== undefined ? undefined : progress;
      if (bookmark !== undefined) this.consumedBookmarkAnchorRequestId = bookmark.requestId;
      await this.openChapter(chapterIndex, true, lifecycleToken, selectionToken,
        bookmark?.chapterOffset, undefined, false, bookmarkContext, layoutReady, unreadCandidates.slice(1));
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
  }

  private async tryInitialEntrySnapshot(lifecycleToken: number, selectionToken: number,
    layoutReady: Promise<void[]>): Promise<boolean> {
    const gateway = this.activeGateway();
    if (gateway.loadEntrySnapshot === undefined || gateway.hasPendingSourceSwitch()) return false;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
    const requested = this.normalizedRequestedChapter();
    const bookmark = this.requestedBookmarkAnchor;
    const pending = gateway.pendingPresentedProgress?.();
    const pendingPosition = pending?.kind === 'restored' ? pending.progress : undefined;
    let context: RemoteReadingPositionContext | undefined;
    if (bookmark !== undefined) {
      if (!Number.isSafeInteger(bookmark.chapterOffset) || bookmark.chapterOffset < 0 ||
        (requested !== undefined && requested !== bookmark.chapterIndex)) throw new Error('READING_POSITION_SCOPE_MISMATCH');
      if (this.sourceId !== LOCAL_READING_SOURCE_ID && bookmark.chapterOffset > 0 && bookmark.positionScope === undefined)
        throw new Error('READING_POSITION_SCOPE_UNAVAILABLE');
      context = this.positionContextForScope(bookmark.positionScope, bookmark.chapterIndex, bookmark.chapterOffset);
    } else if (requested === undefined && pendingPosition?.bodyVersion !== undefined && pendingPosition.processingVersion !== undefined) {
      context = { bodyVersion: pendingPosition.bodyVersion, processingVersion: pendingPosition.processingVersion,
        anchors: [{ id: 'presented', offset: pendingPosition.chapterOffset }] };
    }
    const target = bookmark?.chapterIndex ?? requested ?? pendingPosition?.chapterIndex;
    const prepared = this.preparedReadingEntry;
    // Latest in-memory progress and explicit navigation outrank a shelf resume.
    const usePrepared = prepared?.catalogPending === true && prepared.isCurrent() &&
      bookmark === undefined && requested === undefined && pending === undefined;
    this.traceInitialReadingPhase?.(usePrepared ? 'entry-prepared' : 'entry-core-read', lifecycleToken);
    if (!usePrepared) this.preparedReadingEntry = undefined;
    const snapshot = usePrepared ? prepared : await gateway.loadEntrySnapshot(target, isCurrent, context,
      readingParagraphBoundaryMode(this.sourceId, this.bookKind));
    if (!isCurrent()) return true;
    if (snapshot === undefined || !snapshot.isCurrent() || snapshot.navigation?.current.navigable === false) return false;
    // A newer unsaved visible position arriving during the read still wins.
    const latest = gateway.pendingPresentedProgress?.();
    if (JSON.stringify(latest) !== JSON.stringify(pending)) return false;
    this.entryCatalogNavigation = snapshot.navigation;
    this.entryCatalogPending = true;
    const navigation = snapshot.navigation;
    // Core already validated this document and its position. Catalog absence
    // is not evidence that the independently available body is unreadable.
    const entries: LocalReadingTocEntry[] = navigation === undefined ?
      [{ index: snapshot.chapter.chapterIndex, title: snapshot.chapter.chapterTitle, downloadState: 'unknown', navigable: true }] :
      [...navigation.before, navigation.current, ...navigation.after];
    this.admitTocEntries(entries);
    // This is explicitly a window; never publish it as the parent's full TOC.
    this.chapterWindow.configure(this.sourceId, this.bookId,
      this.readingTocEntries().map((entry: LocalReadingTocEntry): number => entry.index));
    this.restoredProgress = bookmark !== undefined || requested !== undefined ? undefined : pending ?? snapshot.progress;
    if (bookmark !== undefined) this.consumedBookmarkAnchorRequestId = bookmark.requestId;
    this.traceInitialReadingPhase?.('entry-snapshot', lifecycleToken);
    await this.openChapter(snapshot.chapter.chapterIndex, true, lifecycleToken, selectionToken,
      bookmark?.chapterOffset ?? (snapshot.chapter.documentRange === undefined ? undefined : snapshot.requestedScalar),
      undefined, false, context, layoutReady);
    return true;
  }

  private hasPartialEntryWindow(): boolean {
    return this.chapter?.documentRange !== undefined;
  }

  private scheduleEntryWindowHydration(): void {
    if (this.readerSettingsSnapshot.navigationMode === 'continuous' && !this.continuousEntryPositionReady) return;
    const chapter = this.chapter;
    if (!this.hasPartialEntryWindow() || this.entryWindowHydrationChapter === chapter || this.entryWindowHydrationQueuedFor === chapter) return;
    this.entryWindowHydrationQueuedFor = chapter;
    const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (this.entryWindowHydrationQueuedFor === chapter) this.entryWindowHydrationQueuedFor = undefined;
      if (!this.isSelectionActive(lifecycle, selection) || this.chapter !== chapter) return;
      void this.hydrateEntryWindow(true).catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Reading entry expansion: %{private}s', errorMessageOf(error));
      });
    }));
  }

  private async hydrateEntryWindow(background: boolean = false): Promise<void> {
    const chapter = this.chapter;
    if (chapter?.documentRange === undefined) return;
    if (this.entryWindowHydration !== undefined && this.entryWindowHydrationChapter === chapter) return this.entryWindowHydration;
    const lifecycle = this.lifecycleToken, selection = this.chapterSelectionToken;
    const measurement = this.measurementEpoch;
    const gateway = this.activeGateway();
    const contentCurrent = gateway.captureEntryContentValidity?.();
    const current = (): boolean => this.isSelectionActive(lifecycle, selection) && this.chapter === chapter &&
      this.measurementEpoch === measurement && contentCurrent?.() !== false;
    const operation = gateway.completeEntryChapter(chapter, current, background ? 'background' : 'foreground').then(async (full: ReadingSessionChapter): Promise<void> => {
      // Let the in-flight first-page save finish against its original immutable
      // owner. It never gates the visible page; expansion must not orphan it.
      await this.ordinaryFirstPagePersistence;
      if (!current()) return;
      const expanded = retainReadingEntryImageHandles(full, chapter);
      const expandedMap = readingChapterLayoutMap(expanded);
      const utf16Ranges = await prepareReadingParagraphUtf16Ranges(expanded.content,
        readingParagraphBoundaryMode(this.sourceId, this.bookKind), current);
      if (utf16Ranges === undefined || !current()) return;
      const preparedRanges: ParagraphRange[] = [];
      for (let index = 0; index < utf16Ranges.length; index += 1) {
        if (index > 0 && index % 512 === 0) {
          await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
          if (!current()) return;
        }
        const range = utf16Ranges[index];
        preparedRanges.push(new ParagraphRange(`paragraph-${index}-${range.startUtf16}`,
          range.startUtf16, range.endUtf16, expandedMap.scalarForUtf16(range.startUtf16),
          expandedMap.scalarForUtf16(range.endUtf16)));
      }
      if (!current()) return;
      this.chapter = expanded;
      this.chapterLayoutMap = readingChapterLayoutMap(expanded);
      this.materializedContentVersion = expanded.contentVersion;
      this.chapterWindow.setCurrent(expanded);
      this.rebuildChapterImageIndexes(expanded);
      this.paragraphRanges = preparedRanges;
      this.retainCurrentChapterWindow();
      if (this.readerSettingsSnapshot.navigationMode === 'continuous') this.rebuildContinuousFragments(true);
      // Existing visible native nodes and absolute page facts stay unchanged.
      if (this.phase === 'ready') {
        this.schedulePageTurnPreparation();
        this.prefetchNextChapter(expanded, lifecycle, selection);
        this.drainRapidPageTurn();
        this.resumePendingAutoPageTurn();
      }
    });
    this.entryWindowHydration = operation;
    this.entryWindowHydrationChapter = chapter;
    try { await operation; }
    finally { if (this.entryWindowHydration === operation) { this.entryWindowHydration = undefined; this.entryWindowHydrationChapter = undefined; } }
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

  private async hydrateEntryCatalog(): Promise<void> {
    if (!this.entryCatalogPending) return;
    if (this.entryCatalogHydration !== undefined) return this.entryCatalogHydration;
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId, bookId = this.bookId;
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) && sourceId === this.sourceId && bookId === this.bookId;
    const operation = this.activeGateway().loadToc(bookId, isCurrent).then((toc: LocalReadingToc): void => {
      if (!isCurrent()) return;
      const current = this.pageTurnPreparation?.origin.chapter ?? this.chapter;
      if (current === undefined || !toc.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === current.chapterIndex && entry.navigable !== false))
        throw new Error('READING_CATALOG_CURRENT_CHAPTER_MISSING');
      const retained = this.chapterWindow.retainedChapterIndexes().map((index: number): ReadingSessionChapter | undefined => this.chapterWindow.get(index));
      this.entryCatalogNavigation = undefined;
      this.entryCatalogPending = false;
      this.admitTocEntries(toc.entries);
      this.chapterWindow.configure(sourceId, bookId, this.readingTocEntries().map((entry: LocalReadingTocEntry): number => entry.index));
      this.chapterWindow.setCurrent(current);
      for (const chapter of retained) {
        if (chapter !== undefined && chapter.chapterIndex !== current.chapterIndex) this.chapterWindow.admitNeighbour(chapter);
      }
      this.releaseUnretainedReadingImages();
      this.onDirectoryProjectionChanged(toc.entries);
    });
    this.entryCatalogHydration = operation;
    try { await operation; }
    catch (error) {
      if (isCurrent() && this.autoPageCoordinator.catalogLoadFailed()) {
        try {
          this.getUIContext().getPromptAction().showToast({ message: '目录加载失败，自动翻页已停止，请重试' });
        } catch (_) { /* The reading session may already be leaving. */ }
      }
      throw error;
    }
    finally { if (this.entryCatalogHydration === operation) this.entryCatalogHydration = undefined; }
    if (isCurrent()) {
      this.schedulePageTurnPreparation();
      this.drainRapidPageTurn();
      this.resumePendingAutoPageTurn();
    }
  }

  private entryChapterPosition(chapterIndex: number): number | undefined {
    const window = this.entryCatalogNavigation;
    if (window === undefined) return undefined;
    return [...window.before, window.current, ...window.after].find((entry): boolean => entry.index === chapterIndex)?.readablePosition;
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
    if (entries.length > 0) this.controlDirectoryDataRetained = true;
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
    if (this.chapter !== undefined && this.chapter.chapterIndex === requested && this.phase !== 'failed') {
      return;
    }
    this.clearTtsChapterEndTimer();
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
      this.resetForChapterSelection();
      this.armFirstPageReadyDeadline(this.lifecycleToken, this.chapterSelectionToken);
      void this.loadInitialReading(this.lifecycleToken);
      return;
    }
    this.consumedBookmarkAnchorRequestId = anchor.requestId;
    this.selectBookmarkAnchor(anchor.chapterIndex, anchor.chapterOffset, anchor.positionScope);
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
  private resetForChapterSelection(preserveRapidPageTarget: boolean = false, preserveTtsFollow: boolean = false): void {
    this.ordinaryPageMeasurementSelection = -1;
    this.invalidatePageTurnRuntime(true, preserveRapidPageTarget, preserveTtsFollow);
    this.previousChapterMeasurement = undefined;
    this.paginationIndex.invalidateMeasurement();
    this.materializedChapterSelectionToken = -1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
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
    try {
      if (!isInitial && this.tocEntries.length > 0) {
        this.requireKnownChapter(chapterIndex);
      }
      const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken);
      if (!contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
      if (isInitial && this.preparedReadingEntry !== undefined && !this.preparedReadingEntry.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([]));
        return;
      }
      const restored = isInitial && this.restoredProgress?.kind === 'restored' &&
        this.restoredProgress.progress.chapterIndex === chapterIndex ? this.restoredProgress.progress : undefined;
      const context = positionContext ?? (restored?.bodyVersion !== undefined && restored.processingVersion !== undefined ?
        { bodyVersion: restored.bodyVersion, processingVersion: restored.processingVersion,
          anchors: [{ id: 'restored', offset: restored.chapterOffset }] } : undefined);
      const prepared = isInitial && !refreshContent && this.preparedReadingEntry?.isCurrent() === true &&
        this.preparedReadingEntry.chapter.chapterIndex === chapterIndex ? this.preparedReadingEntry : undefined;
      // Chapter acquisition does not depend on typography or window policy.
      // Join both here so I/O can overlap while publication and measurement
      // still use the fully admitted initial layout, including custom fonts.
      const loaded = await Promise.all([
        (prepared === undefined ? this.loadSessionChapter(chapterIndex, isCurrent, refreshContent, context) :
          Promise.resolve(prepared.chapter))
          .then((chapter: ReadingSessionChapter): ReadingSessionChapter => {
            if (isInitial && isCurrent()) this.traceInitialReadingPhase?.('chapter-ready', lifecycleToken);
            return chapter;
          }),
        layoutReady,
      ]);
      const chapter = loaded[0];
      if (!isCurrent()) {
        return;
      }
      if (!contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
      if (prepared !== undefined && !prepared.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([]));
        return;
      }
      const migration = chapter.positionMigration;
      if (migration === undefined && context !== undefined &&
        (chapter.bodyVersion !== context.bodyVersion || chapter.processingVersion !== context.processingVersion)) {
        throw new Error('READING_POSITION_CONTEXT_STALE');
      }
      if (migration?.status === 'committed' && context !== undefined) {
        if (migration.previousBodyVersion !== context.bodyVersion || migration.previousProcessingVersion !== context.processingVersion ||
          migration.bodyVersion !== chapter.bodyVersion || migration.processingVersion !== chapter.processingVersion) {
          throw new Error('READING_POSITION_MIGRATION_IDENTITY_MISMATCH');
        }
        for (const anchor of context.anchors) {
          const mapped = migration.anchors.find((item): boolean => item.id === anchor.id && item.previousOffset === anchor.offset);
          if (mapped === undefined) throw new Error('READING_POSITION_MIGRATION_ANCHOR_MISSING');
          if (anchor.id === 'requested') requestedOffset = mapped.offset;
          if (anchor.id === 'restored' && restored !== undefined) this.restoredProgress = {
            kind: 'restored', progress: { bookId: restored.bookId, chapterIndex: restored.chapterIndex,
              chapterOffset: mapped.offset, chapterProgress: restored.chapterProgress, updatedAt: restored.updatedAt,
              locationRevision: restored.locationRevision, bodyVersion: chapter.bodyVersion,
              processingVersion: chapter.processingVersion } };
        }
      }
      const chapterMap = readingChapterLayoutMap(chapter);
      if (chapterMap.scalarCount() === 0) {
        throw new Error('READING_CONTENT_EMPTY');
      }
      if (!await this.ensureCurrentContentMetrics(chapter, chapterMap, isCurrent)) {
        return;
      }
      if (!isCurrent()) return;
      if (!contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
      if (prepared !== undefined && !prepared.isCurrent()) {
        await this.restartPreparedReadingEntry(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([]));
        return;
      }
      this.preparedReadingEntry = undefined;
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
      if (chapter.positionMigration?.status === 'committed') {
        this.reloadBookmarksAfterContentRefresh(chapter, lifecycleToken, selectionToken);
      }
      this.notifyPreservedContentRefresh(chapter, refreshContent, lifecycleToken, selectionToken);
    } catch (error) {
      // A stale selection (or unmounted session) must not fail the current
      // reading flow; only a current request's error is surfaced.
      if (!this.isSelectionActive(lifecycleToken, selectionToken)) {
        return;
      }
      if (!refreshContent && !contentCurrent()) {
        if (contentRetryCount >= 2) {
          this.fail(new Error('阅读内容在加载期间连续变化，请重新打开本书'), lifecycleToken);
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
        const accepted = await this.requestCachedChapterRefresh(error).catch((): boolean => false);
        if (!this.isSelectionActive(lifecycleToken, selectionToken)) return;
        if (accepted) {
          await this.openChapter(chapterIndex, isInitial, lifecycleToken, selectionToken,
            requestedOffset, requestedProgress, true, error.positionContext, layoutReady);
        } else {
          this.beginExit();
        }
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
  }

  private requestCachedChapterRefresh(error: RemoteChapterCacheRefreshError): Promise<boolean> {
    return new Promise<boolean>((resolve): void => {
      this.getUIContext().showAlertDialog({ title: '需要重新验证本章缓存', message: error.message,
        autoCancel: false,
        primaryButton: { value: '刷新本章', action: (): void => resolve(true) },
        secondaryButton: { value: '保留缓存并返回', action: (): void => resolve(false) },
      });
    });
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
      this.getUIContext().getPromptAction().showToast({ message });
    } catch (_) {
      // Presentation failure cannot turn a preserved, readable chapter into a
      // load failure. PromptAction.showToast is synchronous and returns void.
    }
  }

  private reloadBookmarksAfterContentRefresh(chapter: ReadingSessionChapter,
    lifecycleToken: number, selectionToken: number): void {
    // Retire older list reads before reloading Core's versioned records.
    // Bookmark presentation never blocks the newly admitted chapter body.
    const generation = ++this.controlBookmarkLoadGeneration;
    const isCurrent = (): boolean => this.isSelectionActive(lifecycleToken, selectionToken) &&
      this.chapter === chapter && generation === this.controlBookmarkLoadGeneration;
    this.controlBookmarkLoadPending = true;
    this.controlBookmarkLoadFailed = false;
    void Promise.resolve().then((): Promise<void> => {
      if (!isCurrent()) return Promise.resolve();
      return this.onLoadControlBookmarks(chapter.sourceId, chapter.bookId, isCurrent);
    }).catch((): void => {
      if (isCurrent()) this.controlBookmarkLoadFailed = true;
    }).finally((): void => {
      if (generation === this.controlBookmarkLoadGeneration) this.controlBookmarkLoadPending = false;
    });
  }

  private async loadSessionChapter(
    chapterIndex: number,
    isCurrent: () => boolean,
    forceRefresh: boolean = false,
    positionContext?: RemoteReadingPositionContext,
  ): Promise<ReadingSessionChapter> {
    const cached = this.chapterWindow.get(chapterIndex);
    if (cached !== undefined && cached.sourceCorrectionRequired !== true && cached.documentRange === undefined && !forceRefresh && (positionContext === undefined ||
      (cached.bodyVersion === positionContext.bodyVersion && cached.processingVersion === positionContext.processingVersion))) {
      return cached;
    }
    return this.activeGateway().loadChapter(this.bookId, chapterIndex, isCurrent, forceRefresh, positionContext);
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
    if (current.documentRange !== undefined || page === undefined || !this.isStableVisiblePageOwner(page, current, selectionToken, lifecycleToken)) return;
    const key = `${lifecycleToken}:${selectionToken}:${current.chapterIndex}:${page.startScalar}`;
    if (this.neighbourPreparationKey === key) return;
    this.neighbourPreparationKey = key;
    const isCurrent = (): boolean => this.neighbourPreparationKey === key &&
      this.isStableVisiblePageOwner(page, current, selectionToken, lifecycleToken);
    const run = async (): Promise<void> => {
      for (const delta of [1, -1, 2, -2, 3, -3]) {
        // Yield between chapters; optional work must not form a long UI task.
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (!isCurrent()) return;
        const index = this.adjacentChapterIndex(current.chapterIndex, delta);
        if (index === undefined || this.chapterWindow.get(index) !== undefined) continue;
        try {
          const chapter = await this.activeGateway().prefetchChapter(this.bookId, index, isCurrent);
          if (!isCurrent()) return;
          if (chapter.chapterIndex !== index || chapter.sourceId !== this.sourceId || chapter.bookId !== this.bookId) {
            throw new Error('READING_NEIGHBOUR_IDENTITY_MISMATCH');
          }
          const admitted = this.chapterWindow.admitNeighbour(chapter);
          this.retainCurrentChapterWindow();
          if (!admitted) continue;
          this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
          if (Math.abs(delta) === 1) {
            this.queuePageTurnPreparation(delta > 0 ? 'next' : 'previous');
            this.drainPageTurnPreparationQueue();
          }
        } catch (_) {
          // Optional failure preserves the current page; explicit navigation
          // retains its existing retry/error path.
          if (!isCurrent()) return;
        }
      }
    };
    void run().finally((): void => {
      if (this.neighbourPreparationKey === key) this.neighbourPreparationKey = '';
    });
  }

  /** Demand acquisition must refill an evicted neighbour without replacing
   * the committed chapter or losing the user's queued direction. */
  private requestPageTurnChapter(direction: ReaderPageTurnDirection, chapterIndex: number): void {
    const page = this.visiblePage;
    const origin = this.chapter;
    if (page === undefined || origin === undefined || !this.isKnownControlChapter(chapterIndex) ||
      this.chapterWindow.get(chapterIndex) !== undefined) return;
    const generation = this.pageTurnGeneration;
    const lifecycle = this.lifecycleToken;
    const selection = this.chapterSelectionToken;
    const key = `${lifecycle}:${selection}:${generation}:${origin.chapterIndex}:${page.startScalar}:${direction}:${chapterIndex}`;
    if (this.pageTurnChapterLoads.has(key)) return;
    this.pageTurnChapterLoads.add(key);
    const isCurrent = (): boolean => generation === this.pageTurnGeneration &&
      this.isStableVisiblePageOwner(page, origin, selection, lifecycle);
    void this.activeGateway().loadChapter(this.bookId, chapterIndex, isCurrent)
      .then((chapter: ReadingSessionChapter): void => {
        if (!isCurrent()) return;
        if (chapter.chapterIndex !== chapterIndex || chapter.sourceId !== this.sourceId ||
          chapter.bookId !== this.bookId) throw new Error('PAGE_TURN_NEIGHBOUR_IDENTITY_MISMATCH');
        if (!this.chapterWindow.admitNeighbour(chapter)) return;
        this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
        this.retainCurrentChapterWindow();
        this.queuePageTurnPreparation(direction);
        this.drainPageTurnPreparationQueue();
      })
      .catch((_error: Error): void => {
        if (!isCurrent()) return;
        if (readerRapidPageTurnDirection(this.rapidPageTurnState) === direction || this.activePagePointerId >= 0) {
          this.getUIContext().getPromptAction().showToast({
            message: direction === 'previous' ? '上一章加载失败，请重试' : '下一章加载失败，请重试',
          });
        }
        // Preserve the page and pending intent. Only a later explicit request
        // retries acquisition; failure does not recursively drain the queue.
      })
      .finally((): void => { this.pageTurnChapterLoads.delete(key); });
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
    if (map.residentEnd() < scalarCount) return scalarCount - 1;
    for (let scalar = map.residentEnd() - 1; scalar >= map.residentStart(); scalar -= 1) {
      const startUtf16 = map.utf16ForScalar(scalar);
      const endUtf16 = map.utf16ForScalar(scalar + 1);
      if (content.substring(startUtf16, endUtf16).trim().length > 0) {
        return scalar;
      }
    }
    return 0;
  }

  private retainNativeParagraphResources(): void {
    const keys = new Set<string>();
    const fragments = this.visibleFragments.concat(this.continuousFragments, this.preparedPreviousPage?.page.fragments ?? [],
      this.preparedNextPage?.page.fragments ?? [], this.readingReadyPage?.fragments ?? [],
      this.pendingControlSelectionOrigin?.page.fragments ?? [], this.pendingControlSelectionCandidate?.page.fragments ?? []);
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
      this.measurementBatch.length = 0;
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
      const map = this.requireMeasurementLayoutMap();
      const scalarCount = map.scalarCount();
      if (this.measuringOffset() < map.residentStart() ||
        this.measuringOffset() >= map.residentEnd() && map.residentEnd() < scalarCount) {
        this.paginationIndex.beginMeasurement(selectionToken);
        this.phase = 'measuring';
        this.expandMeasurementParagraphWindow(this.measuringOffset() < map.residentStart() ? 'before' : 'after',
          this.currentMeasurementGeneration(), selectionToken, lifecycleToken);
        return;
      }
      // A Core offset at EOF is legal storage data but cannot materialize a
      // visible glyph.  Clamp only the presentation anchor to the final
      // scalar; the next successful commit normalizes Core to that real page
      // start rather than leaving a permanently empty reader surface.
      const firstRange = this.measuringRanges()[0];
      const firstRenderableScalar = firstRange.startScalar;
      // An EOF anchor may point at trailing CR/LF/space content that produces
      // no visible line once the ReadingSurface removes terminal delimiters.
      // Normalize only that upper bound to the last scalar belonging to a
      // measurable paragraph; Core's unmodified chapter text is never edited.
      const lastRenderableScalar = this.lastMeasurableScalar();
      this.setMeasuringOffset(Math.max(firstRenderableScalar, Math.min(
        lastRenderableScalar,
        this.measuringOffset(),
      )));
      this.setMeasuringProgress(scalarCount === 0 ? 0 : this.measuringOffset() / scalarCount);
      this.setMeasuringRequestedAnchor(this.measuringOffset());
      // A controller is bound to one exact title/layout observation. Recreate
      // it before mounting the new hidden tree so an adjacent chapter cannot
      // reuse the previous title's line count.
      this.measuredNativeTitle = undefined;
      this.chapterTitleMeasurementController = new TextController();
      this.measuredChapterTitleHeightVp = 0;
      this.measurementGateAttempts = 0;
      this.measurementTitleLineCount = 0;
      this.chapterTitleGateAttempts = 0;
      this.measurementBatchPendingParagraph = -1;
      this.measurementBatchPendingLineCount = -1;
      const preserveContinuousDisplay = this.visiblePage?.measuredAppearance !== undefined &&
        !this.sameAppearanceLayout(this.visiblePage.measuredAppearance, this.appearanceSnapshot) &&
        this.hasContinuousRenderContent();
      if (this.readerSettingsSnapshot.navigationMode === 'continuous' && !preserveContinuousDisplay) {
        this.rebuildContinuousFragments();
        this.setContinuousInitialAnchor(this.measuringOffset());
      }
      this.nextRangeIndex = this.rangeIndexForOffset(this.measuringOffset());
      this.firstRangeStartScalar = this.measuringOffset();
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
      this.paginationIndex.beginMeasurement(selectionToken);
      if (!this.unicodeProbeVerified) {
        this.unicodeProbeEmptyAttempts = 0;
      }
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
      this.fail(error as Error, lifecycleToken);
    }
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
      this.reportMeasurementGatePending(lifecycleToken, false, true, true);
      return;
    }
    const titleResult = this.captureChapterTitleMeasurementAfterLayout(lifecycleToken);
    if (!titleResult) {
      this.reportMeasurementGatePending(lifecycleToken, true, false, true);
      return;
    }
    if (this.measurementBatch.length === 0) return;
    this.batchProcessing = true;
    this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
  }

  private reportMeasurementGatePending(
    lifecycleToken: number,
    probeOk: boolean,
    titleOk: boolean,
    batchOk: boolean,
  ): void {
    this.measurementGateAttempts += 1;
    if (this.measurementGateAttempts !== 1 && this.measurementGateAttempts !== 3 &&
      this.measurementGateAttempts !== 10 && this.measurementGateAttempts % 30 !== 0) {
      return;
    }
    console.info(`ReadingExperience measurement gate pending: attempt=${this.measurementGateAttempts} ` +
      `probe=${probeOk} title=${titleOk} titleLines=${this.measurementTitleLineCount} ` +
      `batch=${batchOk} batchPendingParagraph=${this.measurementBatchPendingParagraph} ` +
      `batchPendingLines=${this.measurementBatchPendingLineCount}`);
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
      for (let batchIndex = 0; batchIndex < this.measurementBatch.length; batchIndex += 1) {
        const paragraph = this.measurementBatch[batchIndex];
        const knownEnd = this.measuredPageEndLimit();
        if (knownEnd !== undefined && paragraph.chapterStartScalar >= knownEnd) {
          this.pendingPageEndScalar = knownEnd;
          this.beginFirstPageCommit(generation, selectionToken, lifecycleToken); return;
        }
        const bodyImage = this.readingImageForParagraph(paragraph);
        if (bodyImage !== undefined) {
          const lineCapacity = this.pendingPageBodyCapacity();
          if (!Number.isFinite(lineCapacity) || lineCapacity <= 0) {
            throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
          }
          const paragraphSpace = this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          // Even an unknown image has the renderer's existing 1vp minimum
          // (or its failed-block line height). A full text page cannot admit
          // either outcome, so it must not wait for the next page's decode.
          const minimumImageHeight = Math.min(1, readerAppearanceLineHeight(this.appearanceSnapshot));
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + minimumImageHeight > lineCapacity) {
            this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
            return;
          }
          if (bodyImage.state === 'pending' && !hasKnownReadingImageGeometry(bodyImage)) {
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
          let imageHeight = bodyImage.state === 'ready' || hasKnownReadingImageGeometry(bodyImage) ?
            this.scaledReadingImageHeight(bodyImage, lineCapacity) :
            readerAppearanceLineHeight(this.appearanceSnapshot);
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + imageHeight > lineCapacity) {
            this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
            return;
          }
          const admittedParagraphSpace = this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length === 0) {
            this.pendingPageStartScalar = bodyImage.startScalar;
          }
          this.pendingPageHeight += admittedParagraphSpace + imageHeight;
          this.pendingPageEndScalar = bodyImage.endScalar;
          this.pendingPageFragments.push(new ReadingSurfacePageFragment(
            `chapter-${this.requireMeasurementChapter().chapterIndex}:image:${bodyImage.startScalar}-${bodyImage.endScalar}`,
            '',
            true,
            bodyImage.startScalar,
            bodyImage.endScalar,
            bodyImage.state === 'ready' ? bodyImage.pixelMap : undefined,
            imageHeight,
            bodyImage.state === 'ready' ? bodyImage.fileUri : undefined,
            imageHeight,
            bodyImage.imageWidthBasisPoints,
          ));
          continue;
        }
        // Consume the laid-out prefix in reading order. A later paragraph
        // need not delay a complete first page from an earlier paragraph.
        // Keep already admitted fragments when the next controller is pending,
        // but remove their batch entries so a later didLayout cannot repeat them.
        this.measureNativeParagraph(paragraph);
        if (!this.paragraphHasLayout(paragraph, batchIndex)) {
          if (batchIndex > 0) this.measurementBatch.splice(0, batchIndex);
          this.batchProcessing = false;
          this.reportMeasurementGatePending(lifecycleToken, true, true, false);
          return;
        }
        const lines = this.measuredLines(paragraph);
        let nativeRecipe: ReaderNativeParagraphRecipe | undefined;
        let nativeHeight: number = 0;
        let transferred: boolean = false;
        for (const line of lines) {
          if (knownEnd !== undefined && line.startScalar >= knownEnd) {
            this.pendingPageEndScalar = knownEnd;
            this.beginFirstPageCommit(generation, selectionToken, lifecycleToken); return;
          }
          if (knownEnd !== undefined && line.endScalar > knownEnd)
            throw new Error('PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED');
          const lineCapacity = this.pendingPageBodyCapacity();
          if (!Number.isFinite(lineCapacity) || lineCapacity <= 0) {
            throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
          }
          const isParagraphStart = paragraph.isParagraphStart && line.lineIndex === 0;
          let candidateHeight = this.getUIContext().px2vp(readerNativeParagraphHeight(
            paragraph.controller.getLayoutManager(), nativeRecipe?.firstLine ?? line.lineIndex, line.lineIndex));
          let admittedLineHeight = candidateHeight - nativeHeight;
          const paragraphSpace = isParagraphStart && this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + admittedLineHeight > lineCapacity) {
            this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
            return;
          }
          const admittedParagraphSpace = isParagraphStart && this.pendingPageFragments.length > 0 ?
            this.appearanceSnapshot.paragraphSpacing : 0;
          if (this.pendingPageFragments.length === 0) {
            this.pendingPageStartScalar = line.startScalar;
          }
          const firstNativeLine = nativeRecipe === undefined;
          if (nativeRecipe === undefined) {
            nativeRecipe = { key: readerNativeParagraphKey(), text: paragraph.text,
              startScalar: paragraph.chapterStartScalar, firstLine: line.lineIndex, lastLine: line.lineIndex,
              style: { widthVp: this.measurementTextWidth(),
                fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
                fontSize: this.appearanceSnapshot.fontSize, fontWeight: FontWeight.Regular,
                lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot), letterSpacing: this.appearanceSnapshot.letterSpacing,
                color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
                alignment: readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
                breakAll: false, indentVp: paragraph.isParagraphStart ?
                  this.getUIContext().px2vp(this.getUIContext().fp2px(
            readerAppearanceParagraphIndent(this.appearanceSnapshot.fontSize, this.appearanceSnapshot.indent))) : 0 } };
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
          nativeHeight = candidateHeight;
          this.pendingPageHeight += admittedParagraphSpace + admittedLineHeight;
          this.pendingPageEndScalar = line.endScalar;
          // ReadingSurface uses this id as its ArkUI ForEach identity. A
          // paragraph starts at zero in every chapter, so the local paragraph
          // id alone would let a new chapter reuse an old visible Text child.
          // Bind the fragment to the Core-returned chapter identity; this is
          // presentation identity only and never changes the scalar anchor.
          this.pendingPageFragments.push(new ReadingSurfacePageFragment(
            `chapter-${this.requireMeasurementChapter().chapterIndex}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
            this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)),
            isParagraphStart,
            line.startScalar,
            line.endScalar,
            undefined,
            0,
            undefined,
            admittedLineHeight,
          ));
          const fragment = this.pendingPageFragments[this.pendingPageFragments.length - 1];
          fragment.nativeParagraph = nativeRecipe;
          fragment.nativeParagraphFirst = firstNativeLine;
        }

      }
      // All controller-derived data from this batch has now been copied into
      // plain fragments.  Release it before moving to the next bounded batch.
      this.nativeTextMeasurement.clear();
      this.measurementBatch.length = 0;
      const knownEnd = this.measuredPageEndLimit();
      if (knownEnd !== undefined && this.pendingPageEndScalar >= knownEnd) {
        this.pendingPageEndScalar = knownEnd;
        this.beginFirstPageCommit(generation, selectionToken, lifecycleToken); return;
      }
      if (this.prepareNextMeasurementBatch()) {
        this.batchProcessing = false;
        this.measurementEpoch += 1;
        this.measureNativeTextBatch();
        this.captureMeasurementAfterLayout();
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

  private paragraphHasLayout(paragraph: MeasurementParagraph, paragraphIndex: number): boolean {
    this.measurementBatchPendingParagraph = paragraphIndex;
    this.measurementBatchPendingLineCount = -1;
    try {
      const lineCount = paragraph.controller.getLayoutManager().getLineCount();
      this.measurementBatchPendingLineCount = lineCount;
      return lineCount > 0;
    } catch (_) {
      return false;
    }
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
      this.measurementTitleLineCount = 0;
      this.chapterTitleGateAttempts = 0;
      return true;
    }
    if (this.measuredNativeTitle !== undefined) return true;
    let manager: LayoutManager;
    let lineCount: number;
    try {
      manager = this.chapterTitleMeasurementController.getLayoutManager();
      lineCount = manager.getLineCount();
    } catch (_) {
      this.measurementTitleLineCount = -2;
      return this.retryOrFailingTitleGate(lifecycleToken);
    }
    if (lineCount <= 0) {
      this.measurementTitleLineCount = -1;
      return this.retryOrFailingTitleGate(lifecycleToken);
    }
    try {
      const context = this.getUIContext();
      const heightVp = context.px2vp(readerNativeParagraphHeight(manager, 0, lineCount - 1));
      if (!Number.isFinite(heightVp) || heightVp <= 0) throw new Error('PAGINATION_CHAPTER_TITLE_GEOMETRY_INVALID');
      const recipe: ReaderNativeParagraphRecipe = {
        key: readerNativeParagraphKey(), text: this.requireMeasurementChapter().chapterTitle,
        startScalar: 0, firstLine: 0, lastLine: lineCount - 1,
        style: { widthVp: this.measurementTextWidth(),
          color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
          fontFamily: TYPE_READER_CHAPTER_TITLE.fontFamily, fontWeight: TYPE_READER_CHAPTER_TITLE.fontWeight,
          fontSize: TYPE_READER_CHAPTER_TITLE.fontSizeFp, lineHeight: this.readingLayout().titleLineHeightFp,
          letterSpacing: 0, alignment: TextAlign.Center, breakAll: true },
      };
      const window = new ReaderNativeTextWindow(context,
        this.nativeTextMeasurement.take(this.chapterTitleMeasurementController),
        this.chapterTitleMeasurementController, context.vp2px(this.measurementTextWidth()), 0, lineCount - 1);
      this.nativeParagraphResources.set(recipe.key, window);
      this.measuredNativeTitle = recipe;
      this.measuredChapterTitleHeightVp = heightVp;
      this.measurementTitleLineCount = lineCount;
      this.chapterTitleGateAttempts = 0;
      return true;
    } catch (error) {
      this.fail(error instanceof Error ? error :
        new Error('PAGINATION_CHAPTER_TITLE_GEOMETRY_INVALID'), lifecycleToken);
      return false;
    }
  }

  /**
   * A transiently unbound/unlaid-out title Text retries with the next
   * didLayout; a stably failing one must not stall until the 6s deadline.
   */
  private retryOrFailingTitleGate(lifecycleToken: number): boolean {
    this.chapterTitleGateAttempts += 1;
    if (this.chapterTitleGateAttempts < CHAPTER_TITLE_GATE_ATTEMPT_LIMIT) {
      return false;
    }
    this.fail(new Error('PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE'), lifecycleToken);
    return false;
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
    this.pendingPageEndScalar = pending.endScalar;
    this.setMeasuringRequestedAnchor(pending.endScalar);
    this.measuredNativeTitle = undefined;
    this.measuredChapterTitleHeightVp = 0;
    this.chapterTitleMeasurementController = new TextController();
    pending.nextRangeIndex = this.measuringRanges().length - 1;
    while (pending.nextRangeIndex >= 0 &&
      this.measuringRanges()[pending.nextRangeIndex].startScalar >= pending.endScalar) pending.nextRangeIndex -= 1;
    this.paginationIndex.beginMeasurement(selectionToken);
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
    const index = pending.nextRangeIndex--;
    const range = this.measuringRanges()[index];
    const text = this.requireMeasurementChapter().content.substring(range.startUtf16, range.endUtf16);
    this.nativeTextMeasurement.clear();
    this.measurementBatch.splice(0, this.measurementBatch.length,
      new MeasurementParagraph(range.id, index, text, range.startScalar,
        new ReadingSurfaceLayoutMap(text), new TextController(), true, range.startScalar));
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

  private measuredReverseLines(paragraph: MeasurementParagraph, endScalar: number): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const map = paragraph.layoutMap;
    const endUtf16 = map.utf16ForScalar(Math.max(0,
      Math.min(map.scalarCount(), endScalar - paragraph.chapterStartScalar)));
    let low = 0, high = manager.getLineCount();
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (manager.getLineMetrics(middle).endIndex <= endUtf16) low = middle + 1;
      else high = middle;
    }
    const lastLine = low - 1;
    const result: MeasuredReadingLine[] = [];
    for (let index = lastLine; index >= 0; index -= 1) {
      const metric = this.toLineMetric(manager.getLineMetrics(index));
      const line = map.linesFromArkUI([metric])[0];
      if (line.endScalar <= line.startScalar) continue;
      result.push(new MeasuredReadingLine(index, metric.startIndex, metric.endIndex,
        paragraph.chapterStartScalar + line.startScalar, paragraph.chapterStartScalar + line.endScalar, line.height));
      // Read only the real lines needed to prove overflow. The paragraph node
      // remains whole, including giant paragraphs and mixed-direction text.
      if (this.getUIContext().px2vp(readerNativeParagraphHeight(manager, index, lastLine)) >
        this.readingLayout().bodyHeightAfterTitle(0)) break;
    }
    return result;
  }

  private consumeReversePageParagraph(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
      const pending = this.previousChapterMeasurement;
      const paragraph = this.measurementBatch[0];
      if (pending === undefined || paragraph === undefined) return;
      if (!this.hasValidUnicodeProbe(lifecycleToken)) return;
      const image = this.readingImageForParagraph(paragraph);
      const gap = this.pendingPageFragments.length > 0 ? this.appearanceSnapshot.paragraphSpacing : 0;
      let full = false;
      if (image !== undefined) {
        if (image.state === 'pending' && !hasKnownReadingImageGeometry(image)) {
          this.resolvePendingReadingImage(image, generation, selectionToken, lifecycleToken); return;
        }
        if (image.endScalar <= pending.endScalar) {
          const capacity = this.reversePageCapacityAt(image.startScalar);
          const height = image.state === 'ready' || hasKnownReadingImageGeometry(image) ? this.scaledReadingImageHeight(image, capacity) :
            readerAppearanceLineHeight(this.appearanceSnapshot);
          full = this.pendingPageFragments.length > 0 && this.pendingPageHeight + gap + height > capacity;
          if (!full) {
            this.pendingPageFragments.unshift(new ReadingSurfacePageFragment(
              `chapter-${pending.targetChapterIndex}:image:${image.startScalar}-${image.endScalar}`, '', true,
              image.startScalar, image.endScalar, image.state === 'ready' ? image.pixelMap : undefined,
              height, image.state === 'ready' ? image.fileUri : undefined, height, image.imageWidthBasisPoints));
            this.pendingPageStartScalar = image.startScalar;
            this.pendingPageHeight += gap + height;
          }
        }
      } else {
        this.measureNativeParagraph(paragraph);
        const lines = this.measuredReverseLines(paragraph, pending.endScalar);
        const selected: MeasuredReadingLine[] = [];
        let height = 0;
        for (const line of lines) {
          const candidate = this.getUIContext().px2vp(readerNativeParagraphHeight(
            paragraph.controller.getLayoutManager(), line.lineIndex, lines[0].lineIndex));
          const capacity = this.reversePageCapacityAt(line.startScalar);
          if ((this.pendingPageFragments.length > 0 || selected.length > 0) &&
            this.pendingPageHeight + gap + candidate > capacity) { full = true; break; }
          selected.unshift(line); height = candidate;
        }
        if (selected.length > 0) {
          const recipe: ReaderNativeParagraphRecipe = {
            key: readerNativeParagraphKey(), text: paragraph.text, startScalar: paragraph.chapterStartScalar,
            firstLine: selected[0].lineIndex, lastLine: selected[selected.length - 1].lineIndex,
            style: { widthVp: this.measurementTextWidth(),
              fontFamily: readerAppearanceSnapshotFontFamily(this.appearanceSnapshot),
              fontSize: this.appearanceSnapshot.fontSize, fontWeight: FontWeight.Regular,
              lineHeight: readerAppearanceLineHeight(this.appearanceSnapshot), letterSpacing: this.appearanceSnapshot.letterSpacing,
              color: readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink,
              alignment: readerAppearanceUsesJustify(this.appearanceSnapshot.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
              breakAll: false, indentVp: this.getUIContext().px2vp(this.getUIContext().fp2px(
                readerAppearanceParagraphIndent(this.appearanceSnapshot.fontSize, this.appearanceSnapshot.indent))) },
          };
          const fragments: ReadingSurfacePageFragment[] = [];
          let previousHeight = 0;
          for (const line of selected) {
            const currentHeight = this.getUIContext().px2vp(readerNativeParagraphHeight(
              paragraph.controller.getLayoutManager(), recipe.firstLine, line.lineIndex));
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
          this.pendingPageFragments = fragments.concat(this.pendingPageFragments);
          this.pendingPageStartScalar = selected[0].startScalar;
          this.pendingPageHeight += gap + height;
        }
      }
      this.nativeTextMeasurement.clear(); this.measurementBatch.length = 0;
      if (!full && this.preparePreviousMeasurementParagraph()) {
        this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken); return;
      }
      if (!full && this.requireMeasurementLayoutMap().residentStart() > 0) {
        this.expandMeasurementParagraphWindow('before', generation, selectionToken, lifecycleToken); return;
      }
      if (this.pendingPageFragments.length === 0) throw new Error('PAGINATION_NO_PREVIOUS_PAGE');
      this.setMeasuringOffset(this.pendingPageStartScalar);
      this.setMeasuringRequestedAnchor(this.pendingPageStartScalar);
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) this.fail(error as Error, lifecycleToken);
    }
  }

  private measuredLines(paragraph: MeasurementParagraph): MeasuredReadingLine[] {
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
    // Locate the native containing line without copying every preceding line
    // metric across ArkUI. The complete paragraph still owns shaping context.
    let low = 0, high = lineCount;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (manager.getLineMetrics(middle).endIndex <= requestedUtf16) low = middle + 1;
      else high = middle;
    }
    const firstLine = low;
    const result: MeasuredReadingLine[] = [];
    let previousEnd = 0;
    for (let lineIndex = firstLine; lineIndex < lineCount; lineIndex += 1) {
      const metric = this.toLineMetric(manager.getLineMetrics(lineIndex));
      if (metric.startIndex < previousEnd) throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
      previousEnd = metric.endIndex;
      const local = measurementMap.linesFromArkUI([metric])[0];
      if (local.endScalar <= local.startScalar || local.height <= 0) continue;
      result.push(new MeasuredReadingLine(
        lineIndex, measurementMap.utf16ForScalar(local.startScalar), measurementMap.utf16ForScalar(local.endScalar),
        paragraph.chapterStartScalar + local.startScalar,
        paragraph.chapterStartScalar + local.endScalar, local.height,
      ));
      // Include the first overflowing line so page admission can commit. A
      // predecessor's background catalog pass deliberately enumerates all pages.
      if (this.previousChapterMeasurement === undefined &&
        this.getUIContext().px2vp(readerNativeParagraphHeight(manager, firstLine, lineIndex)) > this.pendingPageBodyCapacity()) break;
    }
    if (result.length === 0) {
      throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
    }
    return result;
  }

  private measuredPageEndLimit(): number | undefined {
    const draft = this.measuringDraft();
    const key = this.measurementPaginationKey();
    const request = this.measuringRequestedAnchor();
    if (draft !== undefined && draft.matches(key)) {
      const observed = draft.observationForRequest(request) ?? draft.observationForPageStart(request);
      if (observed !== undefined) return observed.endScalarExclusive;
    }
    const indexed = this.paginationIndex.findContainingPage(key, request);
    return indexed?.startScalar === request ? indexed.endScalarExclusive : undefined;
  }

  /** A partial document retains the page's original paragraphs and one on
   * either side. Page facts contain only scalar boundaries; navigating back
   * can fetch the missing context again. A giant original paragraph remains
   * whole because shaping a cut paragraph would change its line geometry. */
  private retainMeasuredParagraphWindow(page: PhysicalReadingPage): void {
    const chapter = this.requireMeasurementChapter();
    if (chapter.documentRange === undefined || this.canonicalModeAnchor >= 0) return;
    const ranges = this.measuringRanges();
    const first = ranges.findIndex((range: ParagraphRange): boolean => range.endScalar > page.startScalar);
    let last = ranges.length - 1;
    while (last >= 0 && ranges[last].startScalar >= page.endScalar) last -= 1;
    if (first < 0 || last < first) throw new Error('PAGINATION_PAGE_OUTSIDE_PARAGRAPH_WINDOW');
    const keepFirst = first > 0 && ranges[first - 1].endScalar - ranges[first - 1].startScalar <= 8192 ? first - 1 : first;
    const keepLast = last + 1 < ranges.length && ranges[last + 1].endScalar - ranges[last + 1].startScalar <= 8192 ? last + 1 : last;
    if (keepFirst === 0 && keepLast === ranges.length - 1) return;
    const oldMap = this.requireMeasurementLayoutMap();
    const startUtf16 = keepFirst === 0 ? 0 : ranges[keepFirst].startUtf16;
    const endUtf16 = keepLast === ranges.length - 1 ? chapter.content.length : ranges[keepLast].endUtf16;
    const startScalar = oldMap.scalarForUtf16(startUtf16), endScalar = oldMap.scalarForUtf16(endUtf16);
    // The necessary giant paragraph has already been mapped cooperatively.
    // Do not rebuild that unbounded map synchronously just to trim neighbours.
    if (endScalar - startScalar > 32768) return;
    const cropped: ReadingSessionChapter = {
      sourceId: chapter.sourceId, bookId: chapter.bookId, chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle, chapterUrl: chapter.chapterUrl,
      contentVersion: chapter.contentVersion, bodyVersion: chapter.bodyVersion,
      processingVersion: chapter.processingVersion, positionMigration: chapter.positionMigration,
      cacheRefreshRequired: chapter.cacheRefreshRequired, extractionVia: chapter.extractionVia,
      content: chapter.content.substring(startUtf16, endUtf16), textLayoutIdentity: undefined,
      documentRange: { startScalar, endScalar, totalScalars: oldMap.scalarCount() },
      images: chapter.images.filter((image: ReadingSessionImage): boolean =>
        image.startScalar >= startScalar && image.endScalar <= endScalar) };
    const map = readingChapterLayoutMap(cropped);
    const retained = ranges.slice(keepFirst, keepLast + 1).map((range: ParagraphRange): ParagraphRange =>
      new ParagraphRange(range.id, range.startUtf16 - startUtf16, range.endUtf16 - startUtf16,
        range.startScalar, range.endScalar));
    const lane = this.adjacentMeasurementContext;
    if (lane === undefined) {
      this.chapter = cropped; this.chapterLayoutMap = map; this.paragraphRanges = retained;
      this.chapterWindow.setCurrent(cropped); this.rebuildChapterImageIndexes(cropped);
    } else {
      lane.chapter = cropped; lane.layoutMap = map; lane.paragraphRanges = retained;
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
    const current = (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) &&
      this.measuringChapter() === chapter && this.adjacentMeasurementContext === lane &&
      this.previousChapterMeasurement === pending;
    this.cancelMeasurementDeadline();
    this.nativeTextMeasurement.clear(); this.measurementBatch.length = 0;
    this.batchProcessing = false;
    const mode = readingParagraphBoundaryMode(this.sourceId, this.bookKind);
    void this.activeGateway().loadParagraphWindow(chapter,
      direction === 'before' ? range.startScalar : range.endScalar,
      direction, mode, current).then(async (result: ReadingSessionChapter): Promise<void> => {
      if (!current()) return;
      const expanded = retainReadingEntryImageHandles(result, chapter);
      const map: ReadingSurfaceLayoutMap = await prepareReadingChapterLayoutMap(expanded, current);
      const ranges = await prepareReadingParagraphUtf16Ranges(expanded.content, mode, current);
      if (!current() || ranges === undefined) return;
      const paragraphs = ranges.map((item, index): ParagraphRange => new ParagraphRange(
        `paragraph-${index}-${item.startUtf16}`, item.startUtf16, item.endUtf16,
        map.scalarForUtf16(item.startUtf16), map.scalarForUtf16(item.endUtf16)));
      if (lane === undefined) {
        this.chapter = expanded; this.chapterLayoutMap = map; this.paragraphRanges = paragraphs;
        this.chapterWindow.setCurrent(expanded); this.rebuildChapterImageIndexes(expanded);
      } else {
        lane.chapter = expanded; lane.layoutMap = map; lane.paragraphRanges = paragraphs;
      }
      this.measurementCompleting = false;
      this.beginMeasurement(lifecycleToken);
    }).catch((error: Error): void => { if (current()) this.fail(error, lifecycleToken); });
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

  private resolvePendingReadingImage(
    image: ReadingSessionImage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    this.cancelMeasurementDeadline();
    const isCurrent = (): boolean =>
      this.isMeasurementCurrent(generation, selectionToken, lifecycleToken);
    void this.activeGateway().resolveReadingImage(this.requireMeasurementChapter(), image, isCurrent)
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

  /** Pixel availability cannot own pagination once Core has supplied geometry. */
  private resolvePageImagePixels(chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]): void {
    for (const image of chapter.images) {
      if (image.state === 'pending' && hasKnownReadingImageGeometry(image) && fragments.some(
        (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length === 0 &&
          fragment.startScalar === image.startScalar && fragment.endScalar === image.endScalar))
        this.resolveGeometryImagePixels(chapter, image);
    }
  }

  private matchingImageChapter(candidate: ReadingSessionChapter | undefined, chapter: ReadingSessionChapter): boolean {
    return candidate !== undefined && candidate.sourceId === chapter.sourceId && candidate.bookId === chapter.bookId &&
      candidate.chapterIndex === chapter.chapterIndex && candidate.contentVersion === chapter.contentVersion;
  }

  private geometryImageOwners(chapter: ReadingSessionChapter): ReadingSessionChapter[] {
    const candidates = [this.chapter, this.adjacentMeasurementContext?.chapter,
      this.preparedPreviousPage?.context.chapter, this.preparedNextPage?.context.chapter,
      this.pendingControlSelectionOrigin?.context.chapter, this.pendingControlSelectionCandidate?.context.chapter,
      this.chapterWindow.get(chapter.chapterIndex)];
    const owners: ReadingSessionChapter[] = [];
    for (const candidate of candidates) {
      if (candidate !== undefined && this.matchingImageChapter(candidate, chapter) && owners.indexOf(candidate) < 0)
        owners.push(candidate);
    }
    return owners;
  }

  private resolveGeometryImagePixels(chapter: ReadingSessionChapter, image: ReadingSessionImage): void {
    const key = JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex, chapter.contentVersion,
      this.readingImageKey(image)]);
    if (this.geometryImageRequests.has(key) || image.state !== 'pending' || !hasKnownReadingImageGeometry(image)) return;
    const lifecycle = this.lifecycleToken;
    const contentCurrent = ReaderRuntimeOwner.current().captureReadingContentValidity(chapter.sourceId, chapter.bookId);
    const current = (): boolean => this.isSessionActive(lifecycle) && contentCurrent() &&
      chapter.sourceId === this.sourceId && chapter.bookId === this.bookId && this.geometryImageOwners(chapter).some(
        (owner: ReadingSessionChapter): boolean => owner.images.some((candidate: ReadingSessionImage): boolean =>
          this.readingImageKey(candidate) === this.readingImageKey(image) &&
          candidate.intrinsicWidth === image.intrinsicWidth && candidate.intrinsicHeight === image.intrinsicHeight));
    const pending: DeferredReadingImagePixels = { chapter, requested: image, isCurrent: current };
    this.geometryImageRequests.set(key, pending);
    void this.activeGateway().resolveReadingImage(chapter, image, current).then((resolved: ReadingSessionImage): void => {
      if (this.geometryImageRequests.get(key) !== pending || !current()) {
        this.releaseUnadmittedReadingImage(resolved);
        if (this.geometryImageRequests.get(key) === pending) this.geometryImageRequests.delete(key);
        return;
      }
      // This queue owns the acquired Host lease until idle publication or teardown.
      pending.resolved = resolved;
      this.flushDeferredReadingImagePixels();
    }).catch((error: Error): void => {
      if (this.geometryImageRequests.get(key) === pending) this.geometryImageRequests.delete(key);
      if (current()) hilog.error(0x5244, 'Reader', 'Reading image pixels failed: %{private}s', this.errorMessage(error));
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

  private publishGeometryImagePixels(pending: DeferredReadingImagePixels): boolean {
    const image = pending.resolved;
    if (image === undefined) return false;
    const owners = this.geometryImageOwners(pending.chapter);
    const key = this.readingImageKey(pending.requested);
    let adopted = false;
    for (const owner of owners) {
      const index = owner.images.findIndex((candidate: ReadingSessionImage): boolean =>
        this.readingImageKey(candidate) === key && candidate.state === 'pending');
      if (index >= 0) { owner.images[index] = image; adopted = true; }
    }
    if (!adopted) { this.releaseUnadmittedReadingImage(image); return false; }
    this.adoptReadingImage(image);
    const current = this.matchingImageChapter(this.chapter, pending.chapter);
    if (current && this.chapter !== undefined) {
      this.rebuildChapterImageIndexes(this.chapter);
      this.chapterWindow.setCurrent(this.chapter);
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
      if (this.replaceFragmentPixels(this.continuousFragments, image)) {
        this.continuousFragments = this.continuousFragments.slice();
        // ArkUI can coalesce several promises/revisions into one observer
        // delivery. Publish the complete unchanged-geometry projection so an
        // earlier row cannot be lost behind the last changed image index.
        this.continuousChangedFragmentIndex = -1;
        this.continuousRenderRevision += 1; changed = true;
      }
      if (changed) this.visibleFragments = this.visibleFragments.slice();
    }
    for (const prepared of [this.preparedPreviousPage, this.preparedNextPage,
      this.pendingControlSelectionOrigin, this.pendingControlSelectionCandidate]) {
      if (prepared !== undefined && this.matchingImageChapter(prepared.context.chapter, pending.chapter) &&
        this.replaceFragmentPixels(prepared.page.fragments, image)) {
        prepared.page.fragments = prepared.page.fragments.slice(); changed = true;
      }
    }
    if (this.matchingImageChapter(this.adjacentMeasurementContext?.chapter ?? this.chapter, pending.chapter))
      this.replaceFragmentPixels(this.pendingPageFragments, image);
    this.retainCurrentChapterWindow();
    return changed;
  }

  private flushDeferredReadingImagePixels(): void {
    if (this.pageTurnInputPhase() !== 'idle' || this.pageChromeStateFrozen()) return;
    let changed = false;
    this.geometryImageRequests.forEach((pending: DeferredReadingImagePixels, key: string): void => {
      if (pending.resolved === undefined) return;
      this.geometryImageRequests.delete(key);
      if (!pending.isCurrent()) this.releaseUnadmittedReadingImage(pending.resolved);
      else changed = this.publishGeometryImagePixels(pending) || changed;
    });
    if (changed) {
      this.pageTurnRenderRevision += 1;
      this.bookTurnTextureCaptureGeneration += 1;
      this.bookTurnTextureCaptureScheduled = false;
      this.clearBookTurnCapturedIdentities();
      this.scheduleBookTurnTextureRefresh();
    }
  }

  private replaceResolvedReadingImage(
    requested: ReadingSessionImage,
    resolved: ReadingSessionImage,
  ): void {
    const chapter = this.requireMeasurementChapter();
    const key = this.readingImageKey(requested);
    const visibleOwner = chapter === this.chapter;
    const index = visibleOwner ? this.chapterImagePositionByKey.get(key) :
      chapter.images.findIndex((image: ReadingSessionImage): boolean => this.readingImageKey(image) === key);
    if (index === undefined || index < 0 || chapter.images[index].state !== 'pending') return;
    chapter.images[index] = resolved;
    if (visibleOwner) {
      this.chapterImageByStartScalar.set(resolved.startScalar, resolved);
      this.chapterImagePositionByKey.delete(key);
      this.chapterImagePositionByKey.set(this.readingImageKey(resolved), index);
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
    if (this.pendingPageFragments.length === 0 || this.pendingPageStartScalar < 0 ||
      this.pendingPageEndScalar < this.pendingPageStartScalar) {
      this.fail(new Error('PAGINATION_NO_PHYSICAL_PAGE'), lifecycleToken);
      return;
    }
    const resident = this.measuringChapter()?.documentRange;
    const knownEnd = this.previousChapterMeasurement === undefined ? this.measuredPageEndLimit() : undefined;
    if (knownEnd !== undefined && this.pendingPageEndScalar < knownEnd) {
      if (resident !== undefined && resident.endScalar < knownEnd) {
        this.expandMeasurementParagraphWindow('after', generation, selectionToken, lifecycleToken); return;
      }
      const gap = this.requireMeasurementLayoutMap().sliceByScalar(this.pendingPageEndScalar, knownEnd);
      if (gap.trim().length !== 0) throw new Error('PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED');
      this.pendingPageEndScalar = knownEnd;
    }
    if (resident !== undefined && resident.endScalar < resident.totalScalars &&
      this.previousChapterMeasurement === undefined && knownEnd === undefined &&
      this.pendingPageEndScalar > this.lastMeasurableScalar()) {
      this.expandMeasurementParagraphWindow('after', generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.measuredNativeTitle !== undefined && this.measurementIncludesChapterTitle() && this.pendingPageFragments.length > 0) {
      this.pendingPageFragments[0].nativeTitle = this.measuredNativeTitle;
    }
    const page = new PhysicalReadingPage(
      [...this.pendingPageFragments],
      this.pendingPageStartScalar,
      this.pendingPageEndScalar,
      this.pendingPageHeight,
      this.pendingPageBodyCapacity(),
      copyReaderAppearanceSnapshot(this.appearanceSnapshot),
    );
    this.observeMeasuredPhysicalPage(page);
    this.retainMeasuredParagraphWindow(page);
    this.nativeTextMeasurement.clear();
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
    if (this.continueCanonicalModeMeasurement(page, lifecycleToken)) return;
    this.traceInitialReadingPhase?.('first-layout-ready', lifecycleToken);
    this.armFirstPageCompletionDeadline();
    void this.completeFirstPage(page, generation, selectionToken, lifecycleToken);
  }

  private beginCanonicalModeMeasurement(anchor: number): void {
    const key = this.currentPaginationKey();
    const target = Math.max(this.paragraphRanges[0].startScalar, Math.min(this.lastMeasurableScalar(), anchor));
    const known = this.paginationIndex.findContainingPage(key, target);
    const prefix = this.paginationDraft;
    const headPrefix = prefix !== undefined && prefix.matches(key) &&
      prefix.startsAtRequest(this.paragraphRanges[0].startScalar) ? prefix : undefined;
    // A scalar between a page's end request and the next visible glyph can
    // be whitespace. Match complete-index semantics (the preceding page),
    // rather than skipping all the way to the prefix's measured frontier.
    const knownStart = known?.startScalar ?? (headPrefix !== undefined && target < headPrefix.nextRequestScalar() ?
      headPrefix.pageStartScalars()[Math.max(0, headPrefix.pageIndexAtOrBefore(target))] : undefined);
    this.canonicalModeAnchor = knownStart === undefined ? target : -1;
    // Reuse exact layout facts where available. Otherwise advance the existing
    // bounded, frame-driven measurement lane only as far as the containing page.
    this.desiredChapterOffset = knownStart ?? headPrefix?.nextRequestScalar() ?? this.paragraphRanges[0].startScalar;
    this.desiredChapterProgress = this.requireChapterLayoutMap().scalarCount() === 0 ? 0 :
      this.desiredChapterOffset / this.requireChapterLayoutMap().scalarCount();
    this.beginMeasurement(this.lifecycleToken);
  }

  private continueCanonicalModeMeasurement(page: PhysicalReadingPage, lifecycleToken: number): boolean {
    if (this.canonicalModeAnchor < 0) return false;
    if (page.endScalar <= this.canonicalModeAnchor && page.endScalar <= this.lastMeasurableScalar()) {
      this.desiredChapterOffset = page.endScalar;
      this.desiredChapterProgress = page.endScalar / this.requireChapterLayoutMap().scalarCount();
      this.measurementCompleting = false;
      this.beginMeasurement(lifecycleToken);
      return true;
    }
    // Intermediate head-prefix pages never publish or persist progress.
    this.canonicalModeAnchor = -1;
    return false;
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
  ): void {
    const origin = pending.origin;
    const targetChapter = this.chapterWindow.get(previousChapterIndex);
    if (origin !== undefined && targetChapter === undefined &&
      pending.pageTurnGeneration === this.pageTurnGeneration) {
      this.requestPageTurnChapter('previous', previousChapterIndex);
      this.finishPreviousPagePreparationDiscovery(pending);
      return;
    }
    if (origin === undefined || targetChapter === undefined ||
      pending.pageTurnGeneration !== this.pageTurnGeneration) {
      this.recoverPreviousChapterMeasurement(
        new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_UNAVAILABLE'),
        this.lifecycleToken,
      );
      return;
    }
    const targetMap = readingChapterLayoutMap(targetChapter);
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
    this.adjacentMeasurementContext = new ReaderMaterializedChapterContext(
      targetChapter,
      targetMap,
      targetChapter.contentVersion,
      [],
      undefined,
      0,
      0,
      -1,
    );
    this.beginMeasurement(this.lifecycleToken);
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
    this.paginationIndex.finishMeasurement();
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
    this.paginationIndex.finishMeasurement();
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
    this.paginationIndex.finishMeasurement();
    this.phase = 'ready';
    this.pageTurnRenderRevision += 1;
    this.resolvePageImagePixels(targetContext.chapter, page.fragments);
    this.releaseUnretainedReadingImages();
    this.drainRapidPageTurn();
    this.resumePendingAutoPageTurn();
    this.resumeTtsPageFollow?.();
    this.resumePagePreparationAfterTextureFrame();
  }

  private async completeFirstPage(
    visiblePage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): Promise<void> {
    let measuredLayoutSignature = '';
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
      measuredLayoutSignature = this.paginationLayoutSignature();
      const measuredCoreLayout = this.coreLayout();
      const chapter = this.requireChapter();
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      const visibleProgress = scalarCount === 0 ? 0 : visiblePage.startScalar / scalarCount;
      // Ordinary cold presentation has its own completed layout owner. Its
      // initial save cannot retain the measurement lease or lock readable input.
      const coldFirstPaint = this.visiblePage === undefined && this.visibleFragments.length === 0 &&
        this.pendingControlSelection === undefined && this.sourceSwitchTransactionId === undefined &&
        this.sessionGateway?.hasPendingSourceSwitch?.() !== true;
      const ordinaryTurn = !coldFirstPaint && this.isOrdinaryPageMeasurement(chapter, selectionToken, lifecycleToken);
      if (coldFirstPaint || ordinaryTurn) {
        this.ordinaryPageMeasurementSelection = -1;
        this.publishMeasuredFirstPage(visiblePage, chapter, selectionToken);
        this.desiredChapterOffset = visiblePage.startScalar;
        this.desiredChapterProgress = visibleProgress;
        this.paginationIndex.finishMeasurement();
        this.measurementCompleting = false;
        this.cancelFirstPageReadyDeadline();
        this.cancelFirstPageCompletionDeadline();
        this.firstPageCompletionRetryCount = 0;
        this.phase = 'ready';
        this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
        this.beginReadingRecordClock(lifecycleToken);
        this.finishPageTurnPerf('presented');
        const persistence = this.persistOrdinaryFirstPage(visiblePage, chapter, visibleProgress, measuredCoreLayout,
          measuredLayoutSignature, selectionToken, lifecycleToken, ordinaryTurn);
        if (this.notifyReadingPresentationReady(chapter, visiblePage, selectionToken, lifecycleToken))
          this.schedulePageTurnPreparation();
        if (ordinaryTurn) {
          this.notifyControlSelectionReadingReady(chapter.chapterIndex, chapter.chapterTitle,
            visiblePage, selectionToken, lifecycleToken);
          this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
          // Native layout may finish synchronously inside performPageTurn.
          // Let its caller record the in-flight manual/automatic transaction
          // before notifying completion; this does not gate body or input.
          void Promise.resolve().then((): void => {
            if (!this.isOrdinaryFirstPagePresentationCurrent(visiblePage, chapter, selectionToken, lifecycleToken)) return;
            this.completeRapidPageTurnTransaction();
            this.onAutoPagePageCommitted();
            this.drainRapidPageTurn();
            this.resumeDeferredMeasurement(lifecycleToken);
          });
        }
        await persistence;
        return;
      }
      this.ordinaryPageMeasurementSelection = -1;
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
        if (this.resumeSupersededAppearanceMeasurement(generation, selectionToken,
          lifecycleToken, measuredLayoutSignature)) return;
        if (this.pendingControlSelection?.selectionToken === selectionToken) {
          this.pendingControlSelectionCandidate = new ReaderControlSelectionCandidate(
            this.captureMaterializedChapterContext(), visiblePage,
            this.readerSettingsSnapshot.navigationMode === 'continuous', measuredLayoutSignature);
        }
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, visiblePage.startScalar, visibleProgress,
            chapter.bodyVersion, chapter.processingVersion),
          measuredCoreLayout,
          (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken),
        );
        if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
        if (stored.chapterIndex !== chapter.chapterIndex || stored.chapterOffset !== visiblePage.startScalar) {
          throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
        }
        if (measuredLayoutSignature !== this.paginationLayoutSignature()) {
          this.admitCommittedProgress(stored);
          this.resumeSupersededAppearanceMeasurement(generation, selectionToken,
            lifecycleToken, measuredLayoutSignature);
          return;
        }
        this.traceInitialReadingPhase?.('first-persist', lifecycleToken);
        this.desiredChapterOffset = visiblePage.startScalar;
        this.desiredChapterProgress = visibleProgress;
        this.visiblePage = visiblePage;
        this.visiblePageSelectionToken = selectionToken;
        this.visibleFragments = visiblePage.fragments;
        if (this.readerSettingsSnapshot.navigationMode === 'continuous' && !coldFirstPaint) {
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
        this.paginationIndex.finishMeasurement();
        this.traceInitialReadingPhase?.('presentation-submit', lifecycleToken);
        this.traceInitialReadingPhase?.('input-ready', lifecycleToken);
        // Publish the final page-turn owner before durable observers can act.
        this.schedulePageTurnPreparation();
        this.admitCommittedProgress(stored);
        this.completeControlSelectionAfterCommit(stored, visiblePage, selectionToken, lifecycleToken);
        if (!this.notifyControlSelectionReadingReady(chapter.chapterIndex, chapter.chapterTitle,
          visiblePage, selectionToken, lifecycleToken)) return;
        this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
        this.completeRapidPageTurnTransaction();
        this.drainRapidPageTurn();
        this.onAutoPagePageCommitted();
        this.resumeDeferredMeasurement(lifecycleToken);
      });
    } catch (error) {
      // A changed layout makes a rejected old measurement obsolete. A receipt
      // for the wrong anchor remains an integrity failure, even during reflow.
      if (this.errorMessage(error as Error) !== 'READING_INITIAL_PROGRESS_ANCHOR_MISMATCH' &&
        this.resumeSupersededAppearanceMeasurement(generation, selectionToken,
          lifecycleToken, measuredLayoutSignature)) return;
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) ||
        (this.isSelectionActive(lifecycleToken, selectionToken) &&
          this.pendingControlSelection?.selectionToken === selectionToken &&
          this.pendingControlSelectionCandidate !== undefined)) {
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  private async persistOrdinaryFirstPage(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    chapterProgress: number, layout: CoreReadingLayout, layoutSignature: string,
    selectionToken: number, lifecycleToken: number, presentedTurn: boolean = false): Promise<void> {
    const gateway = this.activeGateway();
    // Runtime/book ownership survives a component disappearing. Only receipt
    // delivery below depends on this presentation's mount and selection.
    const operation = gateway.persistPresentedProgress(this.bookId, chapter.chapterTitle,
        new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress,
          chapter.bodyVersion, chapter.processingVersion), layout).then((stored: LocalReadingProgress): void => {
      if (!this.isMountedToken(lifecycleToken) || this.isReaderIdentityCurrent?.() === false) return;
      if (stored.chapterIndex !== chapter.chapterIndex || stored.chapterOffset !== page.startScalar) {
        throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
      }
      this.traceInitialReadingPhase?.('first-persist', lifecycleToken);
      if (!this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken)) return;
      this.admitCommittedProgress(stored);
      // A late receipt confirms durability; it never reinstalls a page, phase,
      // selection or desired offset over a newer presentation/measurement.
      if (!this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken)) return;
      if (presentedTurn) return;
      if (layoutSignature !== this.paginationLayoutSignature()) {
        if (this.phase === 'ready' && !this.exitRequested) {
          this.remeasurePending = true;
          this.appearanceReflowInvalidateCurrentLayout = true;
          this.resumeDeferredMeasurement(lifecycleToken);
        }
        return;
      }
      if (!this.notifyControlSelectionReadingReady(chapter.chapterIndex, chapter.chapterTitle,
        page, selectionToken, lifecycleToken)) return;
      this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);
      this.completeRapidPageTurnTransaction();
      this.drainRapidPageTurn();
      this.onAutoPagePageCommitted();
      this.resumeDeferredMeasurement(lifecycleToken);
    });
    this.ordinaryFirstPagePersistence = operation;
    this.ordinaryFirstPagePersistencePage = page;
    try {
      await operation;
    } catch (error) {
      // Keep measured text and input available. Exit/content mutation can await
      // this same failed promise and use the existing retry/retain-data policy.
      hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience initial progress save failed: ${this.errorMessage(error as Error)}`);
    }
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
    this.ordinaryFirstPagePersistence = undefined;
    this.ordinaryFirstPagePersistencePage = undefined;
  }

  private publishMeasuredFirstPage(
    visiblePage: PhysicalReadingPage,
    chapter: ReadingSessionChapter,
    selectionToken: number,
  ): void {
    this.visiblePage = visiblePage;
    this.visiblePageSelectionToken = selectionToken;
    this.visibleFragments = visiblePage.fragments;
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      this.rebuildContinuousFragments();
      this.setContinuousInitialAnchor(visiblePage.startScalar);
    }
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
    this.invalidateControlBackdrop();
    // Window TYPE_KEYBOARD insets are authoritative. Retained TextInput focus
    // after hiding the IME must not trap subsequent Back events at this layer.
    if (this.isControlInputEnabled() && consumeReaderControlKeyboardBack(
      ReaderWindowCoordinator.metrics(), this.controlKeyboardHost())) return;
    if (this.controlTemporaryLayer && this.controlMotionVisible()) {
      this.dismissControlTemporaryLayers();
      return;
    }
    // Retarget from the frame currently shown by the local control clock. The
    // semantic host session intentionally lags during a drag/settlement.
    const result = backReaderControlHostSession(this.latestControlVisualSession, this.controlTiming());
    if (result.consumed) {
      this.controlSession = result.state;
      return;
    }
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
    this.exitAttemptGeneration += 1;
    this.stopReaderTtsAudition();
    this.captureReadingRecordElapsed(false);
    this.finishSessionCapsuleMorph();
    this.clearReadingRecordTimer();
    this.autoPageCoordinator.dispose();
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelFirstPageReadyDeadline();
    void this.finishExit(lifecycleToken);
  }

  private async finishExit(lifecycleToken: number): Promise<void> {
    const exitAttemptGeneration = this.exitAttemptGeneration;
    try {
      const coordinator = this.ttsCoordinator;
      if (coordinator !== undefined) await coordinator.stop('lifecycle');
      await this.flushReadingRecordForExit();
      await this.awaitOrdinaryFirstPagePersistence();
      // stop() drains the ordered TTS progress tail. If its receipt is still
      // the latest admitted position for this exact selection, saving the
      // page start here would rewind the final spoken scalar. A newer page or
      // manual commit supersedes that receipt and takes the normal exit path.
      const ttsProgressOwnsExit = this.lastTtsCommittedProgress !== undefined &&
        this.lastTtsCommittedProgress === this.lastCommittedProgress &&
        this.lastTtsCommittedChapter === this.chapter &&
        this.lastTtsCommittedSelectionToken === this.chapterSelectionToken &&
        this.lastTtsCommittedProgress.sourceId === this.sourceId &&
        this.lastTtsCommittedProgress.bookId === this.bookId &&
        this.lastTtsCommittedProgress.chapterIndex === this.chapter?.chapterIndex;
      if (!ttsProgressOwnsExit) {
        // A loading/measuring failure has no materialized physical page, so
        // this remains a no-op commit before exit in that case.
        if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
          this.continuousAnchorSampler?.();
          await this.commitContinuousProgress(lifecycleToken);
        } else {
          await this.commitVisiblePage(lifecycleToken);
        }
      }
    } catch (error) {
      if (!this.isMountedToken(lifecycleToken) || exitAttemptGeneration !== this.exitAttemptGeneration) return;
      this.exitRequested = false;
      let decisionTaken = false;
      const claimDecision = (): boolean => {
        if (decisionTaken || !this.isMountedToken(lifecycleToken) ||
          exitAttemptGeneration !== this.exitAttemptGeneration || this.exitRequested || this.exitDelivered) return false;
        decisionTaken = true;
        return true;
      };
      const continueReading = (): void => {
        if (!claimDecision()) return;
        // Cancelling this exit also cancels the Host's one-shot destination.
        // Retry deliberately keeps it until the durable exit is delivered.
        this.onExitCancelled();
        this.beginReadingRecordClock(lifecycleToken);
      };
      this.getUIContext().showAlertDialog({ title: '阅读进度尚未保存',
        message: '请重试保存后退出。当前阅读位置已保留。',
        primaryButton: { value: '重试保存并退出', action: (): void => {
          if (claimDecision()) this.beginExit();
        } },
        secondaryButton: { value: '继续阅读', action: continueReading },
        cancel: continueReading,
      });
      return;
    }
    if (!this.isMountedToken(lifecycleToken) || exitAttemptGeneration !== this.exitAttemptGeneration || this.exitDelivered) return;
    this.exitDelivered = true;
    // Optional in-memory retention must never become another exit condition.
    try {
      this.retainConfirmedEntryPresentation();
    } catch (error) {
      hilog.warn(0x5244, 'Reader', '%{private}s', `Reading entry retention skipped: ${this.errorMessage(error as Error)}`);
    }
    this.onExit();
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
          new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress, chapter.bodyVersion, chapter.processingVersion),
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
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience progress commit failed: ${this.errorMessage(error as Error)}`);
      throw new Error(this.errorMessage(error as Error));
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
    this.continuousCommitPending = true;
    if (this.continuousCommitPromise === undefined) {
      this.continuousCommitInFlight = true;
      const operation = this.drainContinuousProgress(lifecycleToken);
      this.continuousCommitPromise = operation;
      // Retain the one real drain even if a UI observer times out. A delayed
      // writer must never overlap a second drain or be reported saved early.
      const finish = (): void => {
        if (this.continuousCommitPromise === operation) {
          this.continuousCommitPromise = undefined;
          this.continuousCommitInFlight = false;
        }
        if (this.isMountedToken(lifecycleToken)) this.drainRapidPageTurn();
      };
      void operation.then(finish, finish);
    }
    if (await observeReaderProgressOperation(this.continuousCommitPromise) === 'unknown') {
      throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
    }
  }

  private async drainContinuousProgress(lifecycleToken: number): Promise<void> {
    while (this.continuousCommitPending && this.isMountedToken(lifecycleToken)) {
      this.continuousCommitPending = false;
      await this.persistContinuousProgress(lifecycleToken);
    }
  }

  private async persistContinuousProgress(lifecycleToken: number): Promise<void> {
    if (this.chapter === undefined || this.chapterLayoutMap === undefined || this.phase !== 'ready') return;
    const chapter = this.chapter;
    const selectionToken = this.chapterSelectionToken;
    const scalarCount = this.chapterLayoutMap.scalarCount();
    const scalar = Math.max(0, Math.min(scalarCount, this.continuousVisibleScalar));
    const revision = this.continuousProgressRevision;
    const isOwner = (): boolean => this.isMountedToken(lifecycleToken) && this.phase === 'ready' &&
      this.readerSettingsSnapshot.navigationMode === 'continuous' && this.chapter === chapter &&
      this.chapterSelectionToken === selectionToken && this.materializedChapterSelectionToken === selectionToken;
    const isCurrent = (): boolean => isOwner() && this.continuousProgressRevision === revision &&
      this.continuousVisibleScalar === scalar;
    // A retry after an ambiguous result is a read first, even if scrolling has
    // since selected a newer scalar. Never overwrite an unclassified foreign
    // row or repeat the unknown write merely because a new sample arrived.
    if (this.continuousUnknownTarget !== undefined) {
      await this.reconcileContinuousUnknownProgress(isCurrent);
      if (!isCurrent()) return;
    }
    if (this.lastCommittedProgress?.sourceId === this.sourceId &&
      this.lastCommittedProgress.bookId === this.bookId &&
      this.lastCommittedProgress.chapterIndex === chapter.chapterIndex &&
      this.lastCommittedProgress.chapterOffset === scalar) {
      this.onAutoPagePageCommitted();
      return;
    }
    try {
      await this.activeGateway().runProgressCommitSerial(async (): Promise<void> => {
        if (!isCurrent()) {
          return;
        }
        const chapterProgress = scalarCount === 0 ? 0 : scalar / scalarCount;
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, scalar, chapterProgress, chapter.bodyVersion, chapter.processingVersion),
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
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience continuous progress commit failed: ${this.errorMessage(error as Error)}`);
      if (!isOwner()) return;
      this.continuousUnknownTarget = new CoreReadingAnchor(chapter.chapterIndex, scalar,
        scalarCount === 0 ? 0 : scalar / scalarCount);
      this.continuousUnknownOrigin = this.lastCommittedProgress;
      const confirmedTarget = await this.reconcileContinuousUnknownProgress(isOwner);
      if (isCurrent() && confirmedTarget) {
        this.onAutoPagePageCommitted();
      } else if (isCurrent()) {
        throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
      }

    } finally {
      if (this.isMountedToken(lifecycleToken) && this.chapter === chapter &&
        this.continuousProgressRevision !== revision) this.continuousCommitPending = true;
    }
  }

  private async reconcileContinuousUnknownProgress(isCurrent: () => boolean): Promise<boolean> {
    const target = this.continuousUnknownTarget;
    if (target === undefined) return false;
    const gateway = this.activeGateway();
    const result = await reconcileReaderControlSelectionProgress({ isCurrent,
      runSerial: (operation: () => Promise<void>): Promise<void> => gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<LocalReadingProgress | undefined> => {
        const state = await gateway.loadProgress(this.bookId, isCurrent);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    if (!isCurrent()) return false;
    const stored = result.progress;
    if (result.kind !== 'verified' || stored === undefined || stored.bookId !== this.bookId) {
      throw new Error('READING_CONTINUOUS_PROGRESS_UNKNOWN');
    }
    const targetConfirmed = stored.chapterIndex === target.chapterIndex && stored.chapterOffset === target.chapterOffset;
    const origin = this.continuousUnknownOrigin;
    const originConfirmed = origin !== undefined && stored.chapterIndex === origin.chapterIndex &&
      stored.chapterOffset === origin.chapterOffset && stored.updatedAt === origin.updatedAt &&
      stored.locationRevision === origin.locationRevision;
    if (!targetConfirmed && !originConfirmed) throw new Error('READING_CONTINUOUS_PROGRESS_FOREIGN');
    this.continuousUnknownTarget = undefined;
    this.continuousUnknownOrigin = undefined;
    if (targetConfirmed) this.admitCommittedProgress(stored);
    return targetConfirmed;
  }

  private admitCommittedProgress(stored: LocalReadingProgress): void {
    const commit = new ReadingCommit(
      this.sourceId,
      this.bookId,
      stored.chapterIndex,
      stored.chapterOffset,
      stored.chapterProgress,
      stored.locationRevision,
      stored.updatedAt,
    );
    this.lastCommittedProgress = commit;
    try {
      this.onReadingCommitted(commit);
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience committed-progress observer failed: ${this.errorMessage(error as Error)}`);
    }
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
    return 'native-paragraph-v2|' + createReadingPaginationLayoutSignature({
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
    const chapterImages = (this.chapter?.images ?? []).concat(this.adjacentMeasurementContext?.chapter.images ?? []);
    // Recovery owns the whole retained display context, not only the currently
    // visible image fragments. A far chapter jump prunes the old chapter window
    // before it commits; released ready PixelMaps cannot be restored later.
    const originImages = this.pendingControlSelectionOrigin?.context.chapter.images ?? [];
    const candidateImages = this.pendingControlSelectionCandidate?.context.chapter.images ?? [];
    for (const image of chapterImages.concat(this.chapterWindow.retainedImages(), originImages, candidateImages)) {
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
    for (const pending of this.geometryImageRequests.values()) {
      if (pending.resolved !== undefined) this.releaseUnadmittedReadingImage(pending.resolved);
    }
    this.geometryImageRequests.clear();
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
    const key = this.measurementPaginationKey();
    if (this.measuringRanges().length === 0 || this.measuringRequestedAnchor() < 0) {
      this.resetMeasurementPaginationDraft();
      return;
    }

    const chapterStartRequest = this.measuringRanges()[0].startScalar;
    const requestedAnchor = this.measuringRequestedAnchor();
    const observation: ReadingPaginationPrefixObservation = {
      requestScalar: requestedAnchor,
      startScalar: page.startScalar,
      endScalarExclusive: page.endScalar,
    };
    const draft = this.measuringDraft();
    if (draft !== undefined && draft.matches(key) && draft.admit(observation)) {
      // Exact re-observations preserve the known prefix; only the continuous
      // frontier can extend it. This makes an already measured previous page
      // usable without turning the prefix into a navigation-history stack.
    } else {
      if (this.previousChapterMeasurement !== undefined && draft !== undefined && draft.matches(key))
        throw new Error('PAGINATION_PREVIOUS_PAGE_NOT_ADJACENT');
      this.setMeasuringDraft(new ReadingPaginationPrefix(key, observation));
    }

    const activeDraft = this.measuringDraft();
    if (activeDraft === undefined || !this.samePaginationKey(activeDraft.key, key)) {
      return;
    }
    if (page.paginationObservation !== undefined) {
      const original = page.paginationObservation;
      if (page.paginationKey === undefined || !this.samePaginationKey(page.paginationKey, key) ||
        original.requestScalar !== observation.requestScalar || original.startScalar !== observation.startScalar ||
        original.endScalarExclusive !== observation.endScalarExclusive)
        throw new Error('PAGINATION_PAGE_OBSERVATION_CHANGED');
    } else {
      // These are scalar facts only; retaining a page cannot retain a growing
      // chapter run. Subsequent measurements create their own page receipt.
      page.paginationKey = activeDraft.key;
      page.paginationObservation = observation;
    }
    const chapter = this.requireMeasurementChapter();
    const map = this.requireMeasurementLayoutMap();
    if (page.endScalar <= this.lastVisibleScalar(chapter.content, map)) {
      return;
    }
    if (chapter.documentRange !== undefined || !activeDraft.isCanonicalPrefixForChapterStart(chapterStartRequest)) {
      // A continuous suffix remains useful for exact in-session previous-page
      // lookup, but it cannot claim the unmeasured chapter prefix.
      return;
    }
    this.paginationIndex.recordChapter({
      key,
      contentScalarLength: map.scalarCount(),
      pageStartScalars: activeDraft.pageStartScalars(),
    });
    this.resetMeasurementPaginationDraft();
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
    return this.continuousRenderRevision >= 0 && this.continuousFragments.length > 0;
  }

  private rebuildContinuousFragments(preserveExisting: boolean = false): void {
    const chapter = this.chapter;
    const chapterMap = this.chapterLayoutMap;
    if (chapter === undefined || chapterMap === undefined || this.paragraphRanges.length === 0) {
      this.clearContinuousRenderProjection();
      return;
    }
    const fragments: ReadingSurfacePageFragment[] = [];
    const renderedAppearance = this.visibleReadingAppearance();
    const retained = new Map<number, ReadingSurfacePageFragment>();
    if (preserveExisting) {
      for (const fragment of this.continuousFragments) retained.set(fragment.startScalar, fragment);
    }
    for (const range of this.paragraphRanges) {
      const existing = retained.get(range.startScalar);
      if (existing !== undefined && existing.endScalar === range.endScalar) {
        fragments.push(existing);
        continue;
      }
      const bodyImage = this.continuousImageForRange(chapter, range);
      if (bodyImage !== undefined) {
        const capacity = Math.max(readerAppearanceLineHeight(renderedAppearance),
          this.readingLayout().bodyHeight(false));
        const imageHeight = bodyImage.state === 'ready' || hasKnownReadingImageGeometry(bodyImage) ?
          this.scaledReadingImageHeight(bodyImage, capacity) :
          readerAppearanceLineHeight(renderedAppearance);
        fragments.push(new ReadingSurfacePageFragment(
          `continuous:${chapter.chapterIndex}:image:${bodyImage.startScalar}-${bodyImage.endScalar}`,
          '',
          true,
          bodyImage.startScalar,
          bodyImage.endScalar,
          bodyImage.state === 'ready' ? bodyImage.pixelMap : undefined,
          imageHeight,
          bodyImage.state === 'ready' ? bodyImage.fileUri : undefined,
          imageHeight,
          bodyImage.imageWidthBasisPoints,
        ));
        continue;
      }
      const fragment = new ReadingSurfacePageFragment(
        `continuous:${chapter.chapterIndex}:text:${range.startScalar}-${range.endScalar}`,
        chapter.content.substring(range.startUtf16, range.endUtf16), true, range.startScalar, range.endScalar,
      );
      const measured = this.visiblePageSelectionToken === this.chapterSelectionToken ?
        this.visibleFragments.find((visible: ReadingSurfacePageFragment): boolean =>
          visible.nativeParagraph?.startScalar === range.startScalar && visible.nativeParagraph.text === fragment.text)?.nativeParagraph : undefined;
      // Preserve the complete semantic paragraph. ArkUI owns wrapping and
      // exact line coordinates; no fixed-character chunk starts a new shape.
      fragment.nativeParagraph = { key: measured?.key ?? readerNativeParagraphKey(), text: fragment.text,
        startScalar: range.startScalar, firstLine: 0, lastLine: 0, wholeParagraph: true,
        style: { widthVp: this.measurementTextWidth(),
          fontFamily: readerAppearanceSnapshotFontFamily(renderedAppearance),
          fontSize: renderedAppearance.fontSize, fontWeight: FontWeight.Regular,
          lineHeight: readerAppearanceLineHeight(renderedAppearance), letterSpacing: renderedAppearance.letterSpacing,
          color: readerAppearanceThemeStyle(renderedAppearance.activeTheme).ink,
          alignment: readerAppearanceUsesJustify(renderedAppearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
          breakAll: false, indentVp: this.getUIContext().px2vp(this.getUIContext().fp2px(
            readerAppearanceParagraphIndent(renderedAppearance.fontSize, renderedAppearance.indent))) } };
      fragment.nativeParagraphFirst = true;
      fragments.push(fragment);
    }
    this.continuousTitleRecipe = this.measuredNativeTitle?.text === chapter.chapterTitle ? this.measuredNativeTitle : {
      key: readerNativeParagraphKey(), text: chapter.chapterTitle, startScalar: 0,
      firstLine: 0, lastLine: 0, wholeParagraph: true,
      style: { widthVp: this.measurementTextWidth(), color: readerAppearanceThemeStyle(renderedAppearance.activeTheme).ink,
        fontFamily: TYPE_READER_CHAPTER_TITLE.fontFamily, fontWeight: TYPE_READER_CHAPTER_TITLE.fontWeight,
        fontSize: TYPE_READER_CHAPTER_TITLE.fontSizeFp, lineHeight: this.readingLayout().titleLineHeightFp,
        letterSpacing: 0, alignment: TextAlign.Center, breakAll: true },
    };
    this.commitContinuousRenderProjection(chapter, fragments);
  }

  private commitContinuousRenderProjection(
    chapter: ReadingSessionChapter,
    fragments: ReadingSurfacePageFragment[],
  ): void {
    for (let index = 0; index < fragments.length; index += 1) {
      fragments[index].continuousSpaceBefore = index > 0 || (chapter.documentRange?.startScalar ?? 0) > 0;
    }
    this.continuousFragments = fragments;
    this.rebuildContinuousFragmentIndex();
    this.continuousVisibleFragmentIndex = this.continuousFragmentIndexForScalar(this.continuousVisibleScalar);
    this.continuousVisibleEndFragmentIndex = this.continuousVisibleFragmentIndex;
    this.continuousRenderChapterIdentity =
      `continuous:${JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex, chapter.contentVersion])}`;
    this.continuousRenderChapterTitle = (chapter.documentRange?.startScalar ?? 0) === 0 ? chapter.chapterTitle : '';
    this.continuousRenderGeometryKey = this.paginationLayoutSignature();
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
    const capacity = Math.max(readerAppearanceLineHeight(this.visibleReadingAppearance()),
      this.readingLayout().bodyHeight(false));
    const imageHeight = this.scaledReadingImageHeight(image, capacity);
    this.continuousFragments.splice(index, 1, new ReadingSurfacePageFragment(
      `continuous:${chapter.chapterIndex}:image:${image.startScalar}-${image.endScalar}`,
      '',
      true,
      image.startScalar,
      image.endScalar,
      image.pixelMap,
      imageHeight,
      image.fileUri,
      imageHeight,
      image.imageWidthBasisPoints,
    ));
    this.continuousFragments[index].continuousSpaceBefore = index > 0 || (chapter.documentRange?.startScalar ?? 0) > 0;
    this.continuousChangedFragmentIndex = index;
    this.continuousRenderRevision += 1;
    return true;
  }

  private clearContinuousRenderProjection(): void {
    this.continuousEntryPositionReady = false;
    this.continuousFragments = [];
    this.continuousFragmentIndexByStartScalar.clear();
    this.continuousRenderChapterIdentity = 'continuous:empty';
    this.continuousRenderChapterTitle = '';
    this.continuousTitleRecipe = undefined;
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
    this.continuousInitialAnchorRevision += 1;
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
    const chapterMap = this.requireMeasurementLayoutMap();
    this.nativeTextMeasurement.clear();
    this.measurementBatch.length = 0;
    let totalUtf16 = 0;
    while (this.nextRangeIndex < this.measuringRanges().length &&
      this.measurementBatch.length < MAX_MEASUREMENT_BATCH_PARAGRAPHS) {
      const range = this.measuringRanges()[this.nextRangeIndex];
      const startScalar = Math.max(range.startScalar, this.firstRangeStartScalar);
      if (startScalar >= range.endScalar) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      const startUtf16 = range.startUtf16;
      const utf16Length = range.endUtf16 - startUtf16;
      if (utf16Length <= 0) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      if (this.measurementBatch.length > 0 && totalUtf16 + utf16Length > MAX_MEASUREMENT_BATCH_UTF16) {
        break;
      }
      const endUtf16 = range.endUtf16;
      const text = chapter.content.substring(startUtf16, endUtf16);
      this.measurementBatch.push(new MeasurementParagraph(
        `${range.id}:${startScalar}`,
        this.nextRangeIndex,
        text,
        range.startScalar,
        new ReadingSurfaceLayoutMap(text),
        new TextController(),
        true,
        startScalar,
      ));
      totalUtf16 += endUtf16 - startUtf16;
      this.nextRangeIndex += 1;
      this.firstRangeStartScalar = 0;
    }
    return this.measurementBatch.length > 0;
  }


  private rangeIndexForOffset(offset: number): number {
    for (let index = 0; index < this.measuringRanges().length; index += 1) {
      if (offset < this.measuringRanges()[index].endScalar) {
        return index;
      }
    }
    // The call site clamps EOF to a real scalar.  Keep this defensive branch
    // for a malformed paragraph split rather than reading past the array.
    return Math.max(0, this.measuringRanges().length - 1);
  }

  /**
   * Finds the final non-whitespace Unicode scalar among the already admitted
   * paragraph ranges. This is used only to clamp a stale EOF restore anchor;
   * pagination continues to measure the original Core text and offsets.
   */
  private lastMeasurableScalar(): number {
    const chapter = this.requireMeasurementChapter();
    const map = this.requireMeasurementLayoutMap();
    for (let rangeIndex = this.measuringRanges().length - 1; rangeIndex >= 0; rangeIndex -= 1) {
      const range = this.measuringRanges()[rangeIndex];
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
      this.paragraphRanges.length > 0 && startScalar === this.paragraphRanges[0].startScalar;
  }

  private pendingPageBodyCapacity(): number {
    const pageStartScalar = this.pendingPageStartScalar >= 0 ?
      this.pendingPageStartScalar : this.measuringRequestedAnchor();
    if (!this.isMeasurementChapterFirstPageStart(pageStartScalar)) {
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
      this.paginationIndex.invalidateMeasurement();
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
      if (this.pageTurnAutomaticStart !== undefined && !this.pageTurnAutomaticStart.started) {
        this.cancelAutomaticPageStart();
        return;
      }
      hilog.warn(0x5244, 'Reader',
        'Page turn settlement deadline fired; converging generation %{public}d', generation);
      if (this.bookTurnSession.completedTerminalGeneration() === generation) {
        this.onBookTurnNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_TERMINAL_RELEASED, generation, 0));
        return;
      }
      if (this.bookTurnAwaitingSlotCommit) {
        if (this.bookTurnSession.committedSlotsGeneration() === generation) {
          this.onBookTurnNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_SLOTS_COMMITTED, generation, 0));
        } else {
          this.requestBookTurn2DFallback(generation);
          return;
        }
        this.armPageTurnSettlementDeadline(generation);
        return;
      }
      if (this.pageTurnPresentationPhase === 'surfaceHidden') {
        this.bookTurnSession.releaseTerminalFrame(generation);
        this.bookTurnSession.clearSurface(generation);
        this.requestBookTurn2DFallback(generation);
        return;
      }
      if (this.pageTurnPresentationPhase === 'logicalPromoted') {
        this.requestBookTurn2DFallback(generation);
        return;
      }
      if (this.pageTurnSettlingPrepared !== undefined) {
        if (this.pageTurnCommitStarted && !this.pageTurnCommitFinished) {
          this.armPageTurnSettlementDeadline(generation);
          return;
        }
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

  private readingLayoutCache: ReaderReadingLayoutSnapshot | undefined = undefined;
  private readingLayoutCacheWidth: number = -1;
  private readingLayoutCacheHeight: number = -1;
  private readingLayoutCacheRevision: number = -1;
  private readingLayoutCacheTablet: boolean = false;
  private readingLayoutCacheCutout: boolean = false;

  private readingLayout(): ReaderReadingLayoutSnapshot {
    if (this.pageTurnSettlementLayout !== undefined) {
      return this.pageTurnSettlementLayout;
    }
    if (this.pageTurnFrozenRevision === this.pageTurnRenderRevision && this.pageTurnFrozenLayout !== undefined) {
      return this.pageTurnFrozenLayout;
    }
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    const metrics = ReaderWindowCoordinator.metrics();
    const cutout = this.readerSettingsSnapshot.extendIntoCutout;
    if (this.readingLayoutCache !== undefined && this.readingLayoutCacheWidth === width &&
      this.readingLayoutCacheHeight === height && this.readingLayoutCacheRevision === metrics.revision &&
      this.readingLayoutCacheTablet === this.isTablet && this.readingLayoutCacheCutout === cutout) {
      return this.readingLayoutCache;
    }
    let layout = resolveReaderReadingLayout(width, height, this.isTablet, metrics, cutout);
    if (metrics.ready && layout.pageChromeTopRegionHeight > 0) {
      const context = this.getUIContext();
      const topStyle = readerPageChromeTopTextStyle(layout, context);
      const title = measureReaderPageChromeText(this.bookTitle, topStyle, layout, context);
      const clock = measureReaderPageChromeText(this.pageChromeClockText, topStyle, layout, context);
      const informationHeight = Math.max(title.height, clock.height);
      if (informationHeight > layout.pageChromeTopRegionHeight) {
        layout = resolveReaderReadingLayout(width, height, this.isTablet, metrics, cutout,
          undefined, informationHeight);
      }
    }
    this.readingLayoutCache = layout;
    this.readingLayoutCacheWidth = width; this.readingLayoutCacheHeight = height;
    this.readingLayoutCacheRevision = metrics.revision; this.readingLayoutCacheTablet = this.isTablet;
    this.readingLayoutCacheCutout = cutout;
    return layout;
  }

  private controlLayoutCache: ReaderControlLayoutSnapshot | undefined = undefined;
  private controlLayoutCacheWidth: number = -1;
  private controlLayoutCacheHeight: number = -1;
  private controlLayoutCacheRevision: number = -1;
  private controlLayoutCacheTablet: boolean = false;

  private controlLayout(_windowMetricsRevision: number): ReaderControlLayoutSnapshot {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.effectiveViewportWidth();
    const height = this.effectiveViewportHeight();
    if (this.controlLayoutCache !== undefined && this.controlLayoutCacheWidth === width &&
      this.controlLayoutCacheHeight === height && this.controlLayoutCacheRevision === metrics.revision &&
      this.controlLayoutCacheTablet === this.isTablet) return this.controlLayoutCache;
    const layout = resolveReaderControlLayout(width, height, this.isTablet, metrics);
    this.controlLayoutCache = layout;
    this.controlLayoutCacheWidth = width; this.controlLayoutCacheHeight = height;
    this.controlLayoutCacheRevision = metrics.revision; this.controlLayoutCacheTablet = this.isTablet;
    return layout;
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
    const position = this.entryCatalogNavigation === undefined ? this.chapterWindow.position(this.currentChapterIndex()) :
      (this.entryChapterPosition(this.currentChapterIndex()) ?? -1);
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
      this.entryCatalogPending && this.entryCatalogNavigation === undefined && this.contentMetrics === undefined ? '—' : formatReaderPageProgress(this.pageChromeProgress(
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
    if (prefix?.matches(key) === true && prefix.observationForPageStart(pageStartScalar) !== undefined &&
      !prefix.isCanonicalPrefixForChapterStart(0)) return undefined;
    const page = this.paginationIndex.findContainingPage(key, pageStartScalar);
    const last = this.paginationIndex.findLastPage(key);
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
    let position = this.entryCatalogNavigation === undefined ? this.chapterWindow.position(chapterIndex) :
      (this.entryChapterPosition(chapterIndex) ?? -1);
    if (position < 0) {
      for (let index = 0; index < this.readingTocEntries().length; index += 1) {
        if (this.readingTocEntries()[index].index === chapterIndex) {
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
    const entry = entries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === chapter.chapterIndex);
    if (entry?.bookmarks === undefined) return entries;
    let changed = false;
    const bookmarks = entry.bookmarks.map((mark: LocalReadingBookmark): LocalReadingBookmark => {
      if (!this.bookmarkMatchesCurrentChapter(mark)) {
        if (mark.positionScope === undefined) return mark;
        changed = true;
        // A parent projection may still carry the previous body's proof while
        // the canonical list reloads. Retain its original quote, never a newly
        // sliced quote or a current coordinate claimed from the old offset.
        return { time: mark.time, chapterIndex: mark.chapterIndex, chapterOffset: mark.chapterOffset,
          chapterTitle: mark.chapterTitle, content: mark.content, bookText: mark.bookText, positionScope: undefined };
      }
      if ((mark.bookText ?? '').length > 0 || mark.chapterOffset >= map.scalarCount() ||
        !map.containsScalar(mark.chapterOffset) || !map.containsScalar(Math.min(map.scalarCount(), mark.chapterOffset + 160))) return mark;
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
      // Display-only recovery for older records. Never overwrite the user's
      // note or persist guessed original text, and never fetch another chapter.
      changed = true;
      return { time: mark.time, chapterIndex: mark.chapterIndex, chapterOffset: mark.chapterOffset,
        chapterTitle: mark.chapterTitle, content: mark.content, bookText: excerpt, positionScope: mark.positionScope };
    });
    if (!changed) return entries;
    const hydrated: LocalReadingTocEntry = { index: entry.index, title: entry.title, level: entry.level,
      downloadState: entry.downloadState, navigable: entry.navigable, bookmarks };
    this.bookmarkExcerptProjection = entries.map((candidate: LocalReadingTocEntry): LocalReadingTocEntry =>
      candidate === entry ? hydrated : candidate);
    return this.bookmarkExcerptProjection;
  }

  private controlDirectoryCatalogPosition(): number {
    const navigation = this.entryCatalogNavigation;
    if (navigation === undefined) return -1;
    const index = this.currentChapterIndex();
    return [...navigation.before, navigation.current, ...navigation.after]
      .find((entry: ReadingEntryNavigationItem): boolean => entry.index === index)?.position ?? -1;
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
    const projectedByChapter = new Map<number, LocalReadingTocEntry>();
    for (const projected of this.tocEntries) {
      projectedByChapter.set(projected.index, projected);
    }
    const projection = this.directoryEntries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
      const projected = projectedByChapter.get(entry.index);
      return projected === undefined ? entry : {
        index: entry.index,
        title: projected.title,
        level: projected.level ?? entry.level,
        downloadState: entry.downloadState,
        navigable: entry.navigable,
        bookmarks: entry.bookmarks,
      };
    });
    this.controlDirectoryParentSource = this.directoryEntries;
    this.controlDirectoryTocSource = this.tocEntries;
    this.controlDirectoryProjection = projection;
    return projection;
  }

  private scheduleTtsPresentationWarmup(): void {
    if (!this.isSessionActive(this.lifecycleToken) || this.phase !== 'ready' ||
      this.ttsWarmupScheduled || this.ttsInitialization !== undefined || this.ttsCoordinator !== undefined) return;
    const lifecycleToken = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    this.ttsWarmupScheduled = true;
    // First-page admission/observers finish before any optional TTS work.
    // This is one frame callback per reader owner, never a per-frame publisher.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.isMountedToken(lifecycleToken) || sourceId !== this.sourceId || bookId !== this.bookId) return;
      this.ttsWarmupScheduled = false;
      if (!this.isSessionActive(lifecycleToken) || this.phase !== 'ready') return;
      void this.initializeTtsSession(lifecycleToken);
    }));
  }

  private initializeTtsSession(lifecycleToken: number, retry: boolean = false): Promise<boolean> {
    if (this.ttsInitialization !== undefined && (!retry || !this.ttsAvailabilityResolved)) {
      return this.ttsInitialization;
    }
    if (!this.isSessionActive(lifecycleToken)) return Promise.resolve(false);
    const configGeneration = this.ttsConfigMutationGeneration;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const isOwnerCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      sourceId === this.sourceId && bookId === this.bookId;
    const owner = ReaderRuntimeOwner.current();
    const gateway = this.ttsGateway ?? new ReaderTtsGateway(owner);
    const httpGateway = this.ttsHttpGateway ?? new ReaderHttpTtsGateway(owner);
    const coordinator = this.ttsCoordinator ?? new ReaderTtsSessionCoordinator(
      gateway,
      owner.getTtsHost(),
      async (progress: ReaderTtsProgressCommit): Promise<void> => this.commitTtsProgress(progress, lifecycleToken),
      (state: ReaderTtsState): void => {
        if (isOwnerCurrent() && this.ttsCoordinator === coordinator) {
          this.ttsState = state;
          // Keep the TTS state publication usable in lightweight production
          // probes that do not mount the paged presentation owner.
          this.followTtsPage?.(state);
          this.onSessionLaunchTtsState(state);
        }
      },
      async (chapter: ReaderTtsChapterRef): Promise<ReaderTtsChapterAdvanceInput | undefined> =>
        this.loadNextTtsChapter(chapter, lifecycleToken),
    );
    this.ttsGateway = gateway;
    this.ttsHttpGateway = httpGateway;
    this.ttsCoordinator = coordinator;
    this.ttsAvailabilityResolved = false;
    // Voice enumeration and HTTP-engine management populate the full settings
    // surface, but neither is required to start foreground system speech. Load
    // them independently so the first play tap is not held behind slow platform
    // discovery on a physical device.
    if (this.ttsPresentationMetadata === undefined) {
      const metadata = this.loadTtsPresentationMetadata(owner, coordinator, httpGateway, lifecycleToken);
      this.ttsPresentationMetadata = metadata;
      void metadata.then((): void => {
        if (this.ttsPresentationMetadata === metadata) this.ttsPresentationMetadata = undefined;
      });
    }
    const initialization = coordinator.probeAvailability()
      .then(async (available: boolean): Promise<boolean> => {
        if (!isOwnerCurrent() || this.ttsCoordinator !== coordinator) return false;
        const config = coordinator.getProbedConfig();
        if (configGeneration === this.ttsConfigMutationGeneration) {
          this.ttsConfig = config;
          this.ttsEngine = config?.engine ?? 'system';
        }
        if (available && config !== undefined && configGeneration === this.ttsConfigMutationGeneration) {
          try {
            // Prefer the versioned percentage field; legacy rate remains a
            // compatibility fallback and must not turn 0.75 into 0.8.
            await coordinator.setRate(this.multiplierForTtsConfig(config));
          } catch (error) {
            if (isOwnerCurrent() && this.ttsCoordinator === coordinator) {
              this.logTtsFailure('initial-rate', error as Error);
            }
          }
        }
        if (!isOwnerCurrent() || this.ttsCoordinator !== coordinator) return false;
        this.ttsAvailabilityResolved = true;
        return available;
      })
      .catch((error: Error): boolean => {
        if (isOwnerCurrent() && this.ttsCoordinator === coordinator) {
          this.ttsAvailabilityResolved = true;
          this.logTtsFailure('initialization', error);
        }
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
    const preferenceGeneration = this.ttsPreferenceMutationGeneration;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const previousEngines = this.ttsHttpEngines;
    let preferencesLoaded = false;
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) && this.ttsCoordinator === coordinator &&
      sourceId === this.sourceId && bookId === this.bookId;
    // The three sources are independent. A slow provider list/voice enumeration
    // cannot withhold saved UI preferences or another already-loaded result.
    await Promise.all([
      httpGateway.list().then((engines: ReaderHttpTtsConfig[]): void => {
        if (isCurrent() && this.ttsHttpEngines === previousEngines) this.ttsHttpEngines = engines;
      }).catch((error: Error): void => {
        hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS optional HTTP list failed: ${error.message}`);
      }),
      this.ttsPreferencesGateway.load().then((preferences: ReaderTtsPreferencesSnapshot): void => {
        if (!isCurrent() || preferenceGeneration !== this.ttsPreferenceMutationGeneration) return;
        this.admitTtsPreferences(preferences, this.ttsVoiceOptions);
        preferencesLoaded = true;
      }).catch((error: Error): void => {
        hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS optional preferences failed: ${error.message}`);
      }),
      owner.getTtsHost().listSystemVoices().then((voices: ReaderTtsVoiceOption[]): void => {
        if (!isCurrent()) return;
        this.ttsVoiceOptions = voices;
        if (preferencesLoaded && preferenceGeneration === this.ttsPreferenceMutationGeneration) {
          this.admitTtsPreferences(this.ttsPreferencesSnapshot(), voices);
        }
      }).catch((error: Error): void => {
        hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS optional voices failed: ${error.message}`);
      }),
    ]);
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
    this.ttsBackgroundPlayback = preferences.backgroundPlayback;
    this.ttsKeepScreenOn = preferences.keepScreenOn;
    this.ttsFailurePolicy = preferences.failurePolicy;
    this.ttsFollowHighlight = preferences.followHighlight;
    this.ttsCoordinator?.setPauseOnInterruption(preferences.pauseOnInterruption);
    void this.ttsCoordinator?.setAllowMixing(preferences.allowMixing)
      .catch((error: Error): void => this.logTtsFailure('audio-session', error));
    this.ttsCoordinator?.setFailurePolicy(preferences.failurePolicy);
    if (repairedVoice) this.persistTtsPreferences();
  }

  private persistTtsPreferences(): void {
    void this.persistTtsPreferencesSnapshot(this.ttsPreferencesSnapshot())
      .catch((error: Error): void => this.logTtsFailure('preference-persist', error));
  }

  private nextTtsPreferenceMutationGeneration(): number {
    this.ttsPreferenceMutationGeneration = this.ttsPreferenceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.ttsPreferenceMutationGeneration + 1;
    return this.ttsPreferenceMutationGeneration;
  }

  private ttsPreferencesSnapshot(): ReaderTtsPreferencesSnapshot {
    return {
      version: 1,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      failurePolicy: this.ttsFailurePolicy,
      followHighlight: this.ttsFollowHighlight,
      backgroundPlayback: this.ttsBackgroundPlayback,
      keepScreenOn: this.ttsKeepScreenOn,
    };
  }

  /**
   * ArkTS does not accept object spread on imported structural aliases. Keep
   * preference updates explicitly typed so rollback candidates retain the
   * same value semantics without widening to an untyped object.
   */
  private copyTtsPreferencesSnapshot(value: ReaderTtsPreferencesSnapshot): ReaderTtsPreferencesSnapshot {
    return {
      version: 1,
      language: value.language,
      person: value.person,
      pauseOnInterruption: value.pauseOnInterruption,
      allowMixing: value.allowMixing,
      failurePolicy: value.failurePolicy,
      followHighlight: value.followHighlight,
      backgroundPlayback: value.backgroundPlayback,
      keepScreenOn: value.keepScreenOn,
    };
  }

  /** Copy the optional online-TTS fields without relying on object spread. */
  private copyReaderOnlineTtsProfile(value: ReaderOnlineTtsProfile): ReaderOnlineTtsProfile {
    const copy: ReaderOnlineTtsProfile = {
      version: value.version,
      voice: value.voice,
      format: value.format,
    };
    if (value.credentialRef !== undefined) copy.credentialRef = value.credentialRef;
    if (value.protocol !== undefined) copy.protocol = value.protocol;
    if (value.model !== undefined) copy.model = value.model;
    if (value.credentialHeader !== undefined) copy.credentialHeader = value.credentialHeader;
    if (value.credentialPrefix !== undefined) copy.credentialPrefix = value.credentialPrefix;
    if (value.pcmSampleRate !== undefined) copy.pcmSampleRate = value.pcmSampleRate;
    if (value.pcmChannels !== undefined) copy.pcmChannels = value.pcmChannels;
    return copy;
  }

  private async persistTtsPreferencesSnapshot(snapshot: ReaderTtsPreferencesSnapshot): Promise<void> {
    await this.ttsPreferencesGateway.update(snapshot);
  }

  private cancelPendingTtsPlay(): void {
    this.ttsPlayIntentGeneration = this.ttsPlayIntentGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.ttsPlayIntentGeneration + 1;
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

  private createTtsPlayIntent(): ReaderTtsPlayIntent {
    this.cancelPendingTtsPlay();
    return { generation: this.ttsPlayIntentGeneration, lifecycleToken: this.lifecycleToken,
      selectionToken: this.chapterSelectionToken, sourceId: this.sourceId, bookId: this.bookId,
      presentation: this.captureControlPlaybackPresentation() };
  }

  private isTtsPlayIntentCurrent(intent: ReaderTtsPlayIntent): boolean {
    return intent.generation === this.ttsPlayIntentGeneration && this.isSessionActive(intent.lifecycleToken) &&
      intent.selectionToken === this.chapterSelectionToken && intent.sourceId === this.sourceId &&
      intent.bookId === this.bookId;
  }

  private toggleTts(pendingIntent?: ReaderTtsPlayIntent): void {
    const intent = pendingIntent ?? this.createTtsPlayIntent();
    if (!this.isTtsPlayIntentCurrent(intent)) return;
    // A user choosing TTS cancels any auto-page start that is waiting for the
    // preceding TTS stop barrier. Its continuation may still resolve, but its
    // generation can no longer start a second runtime.
    this.cancelPendingAutoPageStart();
    const startingNew = this.ttsState.status !== 'playing' && this.ttsState.status !== 'preparing' &&
      this.ttsState.status !== 'paused' && this.ttsState.status !== 'interrupted' && this.ttsState.status !== 'stopping';
    if (pendingIntent === undefined && startingNew && this.phase === 'ready' && this.chapter !== undefined && this.visiblePage !== undefined) {
      this.beginSessionCapsuleMorph('tts');
    }
    const retryAvailability = this.ttsAvailabilityResolved && this.ttsState.status === 'unavailable';
    if (!this.ttsAvailabilityResolved || retryAvailability) {
      const lifecycleToken = this.lifecycleToken;
      void this.initializeTtsSession(lifecycleToken, retryAvailability).then((available: boolean): void => {
        if (available && this.isTtsPlayIntentCurrent(intent)) {
          this.toggleTts(intent);
        } else if (this.isTtsPlayIntentCurrent(intent)) this.cancelSessionLaunch('failure');
      }).catch((error: Error): void => { this.logTtsFailure('initialize', error); this.cancelSessionLaunch('failure'); });
      return;
    }
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined || this.ttsState.status === 'unavailable') { this.cancelSessionLaunch('failure'); return; }
    // `resuming` is kept in the state union for compatibility but is no
    // longer emitted by the coordinator, so the pause branch excludes it.
    if (this.ttsState.status === 'playing' || this.ttsState.status === 'preparing') {
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
    if (chapter.documentRange !== undefined) {
      void this.hydrateEntryWindow().then((): void => {
        if (this.isTtsPlayIntentCurrent(intent)) this.toggleTts(intent);
      }).catch((error: Error): void => {
        if (this.isTtsPlayIntentCurrent(intent)) { this.logTtsFailure('entry expansion', error); this.cancelSessionLaunch('failure'); }
      });
      return;
    }
    this.stopAutoPage();
    coordinator.setDesiredPlaying(this.sessionLaunch?.geometry.type === 'tts' ? this.sessionLaunch.desiredPlaying : true);
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
      backgroundPlayback: this.ttsBackgroundPlayback,
      failurePolicy: this.ttsFailurePolicy,
      timerDurationMs: this.ttsTimerDurationMs(),
    }, this.sessionLaunch?.geometry.type === 'tts' ? this.sessionLaunch.desiredPlaying : true).then((): void => {
      if (!this.isTtsPlayIntentCurrent(intent) || this.ttsCoordinator !== coordinator) return;
      // Native onStart/paused ACK owns truth. No successful business completion
      // starts, resets or replays a presentation timeline.
      this.onSessionLaunchTtsState(this.ttsState);
    }).catch((error: Error): void => {
      if (!this.isTtsPlayIntentCurrent(intent)) return;
      this.logTtsFailure('start', error); this.cancelSessionLaunch('failure');
    });
  }

  private async loadNextTtsChapter(
    current: ReaderTtsChapterRef,
    lifecycleToken: number,
  ): Promise<ReaderTtsChapterAdvanceInput | undefined> {
    if (!this.isSessionActive(lifecycleToken) || current.sourceId !== this.sourceId ||
      current.bookId !== this.bookId || current.chapterIndex !== this.ttsState.chapterIndex) return undefined;
    // `chapterEnd` is a one-shot boundary bound to the chapter that is
    // currently speaking. Returning no next chapter lets the coordinator
    // complete the session after the final real utterance, without encoding
    // this semantic mode as a fake numeric timeout.
    if (this.ttsTimerMode === 'chapterEnd') return undefined;
    const ttsOwner = this.ttsPageFollow.lease(this.ttsFollowScope(), this.ttsState);
    // Audio may already be in the next chapter while the visible transaction
    // is finishing. Its own session identity, not the lagging UI chapter, owns I/O.
    const isCurrent = (): boolean => this.isSessionActive(lifecycleToken) &&
      current.sourceId === this.sourceId && current.bookId === this.bookId &&
      ttsOwner.sessionGeneration === this.ttsState.sessionGeneration &&
      ttsOwner.positionGeneration === (this.ttsState.positionGeneration ?? 0) &&
      current.chapterIndex === this.ttsState.chapterIndex;
    if (this.isUnknownCatalogEdge(current.chapterIndex, 'next')) {
      await this.hydrateEntryCatalog();
      if (!isCurrent()) return undefined;
    }
    const target = this.adjacentChapterIndex(current.chapterIndex, 1);
    if (target === undefined) return undefined;
    const chapter = await this.loadSessionChapter(target, isCurrent);
    if (!isCurrent()) return undefined;
    this.admitChapterContentVersion(chapter.chapterIndex, chapter.contentVersion);
    this.chapterWindow.admitNeighbour(chapter);
    return {
      chapter: this.ttsChapterRef(chapter),
      content: chapter.content,
      contentVersion: chapter.contentVersion,
      onAdmitted: (): void => this.selectChapterAnchor(target, 0, true, false, undefined, -1,
        false, false, undefined, ttsOwner),
    };
  }

  private async auditionReaderTtsVoice(language: string, person: number): Promise<void> {
    const coordinator = this.ttsCoordinator;
    const lifecycle = this.lifecycleToken;
    if (!this.isSessionActive(lifecycle) || coordinator === undefined || !this.controlVisible()) return;
    this.pauseAutoPage('manual');
    await coordinator.auditionVoice({ engine: this.ttsEngine, language, person, rate: this.ttsState.rate, pitch: 1 });
    if (!this.isSessionActive(lifecycle) && this.ttsCoordinator === coordinator) await coordinator.stopAudition();
  }

  private stopReaderTtsAudition(): void {
    const coordinator = this.ttsCoordinator;
    if (coordinator === undefined) return;
    void coordinator.stopAudition().catch((error: Error): void => {
      hilog.warn(0x0000, 'ReaderTtsAudition', 'stop audition failed: %{public}s', error.message);
    });
  }

  private stopTts(): void {
    this.invalidateTtsPageFollow?.();
    if (this.sessionLaunch?.geometry.type === 'tts') this.cancelSessionLaunch('stop');
    this.cancelPendingTtsPlay();
    const coordinator = this.ttsCoordinator;
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
    if (this.ttsState.chapterKey !== undefined) this.ttsCoordinator?.setTimer(undefined);
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
    this.ttsConfigMutationGeneration += 1;
    const previousRate = this.ttsState.rate;
    void coordinator.setRate(normalized)
      .then((): Promise<void> => this.persistTtsConfig(normalized))
      .catch(async (error: Error): Promise<void> => {
        // Core/Host state may already have accepted the new rate while the
        // durable config write failed. Reconcile both sides to the last
        // committed value instead of leaving a restart-time surprise.
        if (previousRate !== normalized) {
          try {
            await coordinator.setRate(previousRate);
          } catch (_) {
            // The coordinator exposes its own retryable error state.
          }
        }
        this.logTtsFailure('rate', error);
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
      this.ttsCoordinator?.setTimer(this.ttsTimerDurationMs());
    }
  }

  private changeTtsAllowMixing(enabled: boolean): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.allowMixing = enabled;
    const coordinator = this.ttsCoordinator;
    const apply = async (): Promise<void> => {
      if (coordinator !== undefined) await coordinator.setAllowMixing(enabled);
      if (generation !== this.ttsPreferenceMutationGeneration) return;
      this.ttsAllowMixing = enabled;
      try {
        await this.persistTtsPreferencesSnapshot(candidate);
      } catch (error) {
        if (generation === this.ttsPreferenceMutationGeneration) {
          this.ttsAllowMixing = previous.allowMixing;
          try { await coordinator?.setAllowMixing(previous.allowMixing); } catch (_) {}
          this.logTtsFailure('preference-persist', error as Error);
        }
      }
    };
    void apply().catch((error: Error): void => this.logTtsFailure('audio-session', error));
  }

  private changeTtsBackgroundPlayback(enabled: boolean): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.backgroundPlayback = enabled;
    this.ttsBackgroundPlayback = enabled;
    const host = this.ttsCoordinator === undefined ? undefined : ReaderRuntimeOwner.current().getTtsHost();
    host?.setBackgroundPlaybackEnabled?.(enabled);
    void this.persistTtsPreferencesSnapshot(candidate).catch((error: Error): void => {
      if (generation !== this.ttsPreferenceMutationGeneration) return;
      this.ttsBackgroundPlayback = previous.backgroundPlayback;
      host?.setBackgroundPlaybackEnabled?.(previous.backgroundPlayback);
      this.logTtsFailure('preference-persist', error);
    });
  }

  private changeTtsKeepScreenOn(enabled: boolean): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.keepScreenOn = enabled;
    this.ttsKeepScreenOn = enabled;
    void this.applyReaderWindowPolicy(this.readerSettingsSnapshot, this.controlsPresentedForWindow())
      .then((): Promise<void> => this.persistTtsPreferencesSnapshot(candidate))
      .catch((error: Error): void => {
        if (generation !== this.ttsPreferenceMutationGeneration) return;
        this.ttsKeepScreenOn = previous.keepScreenOn;
        this.logTtsFailure('preference-persist', error);
      });
  }

  private changeTtsFailurePolicy(policy: 'skip' | 'stop'): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.failurePolicy = policy;
    this.ttsFailurePolicy = policy;
    this.ttsCoordinator?.setFailurePolicy(policy);
    void this.persistTtsPreferencesSnapshot(candidate).catch((error: Error): void => {
      if (generation !== this.ttsPreferenceMutationGeneration) return;
      this.ttsFailurePolicy = previous.failurePolicy;
      this.ttsCoordinator?.setFailurePolicy(previous.failurePolicy);
      this.logTtsFailure('preference-persist', error);
    });
  }

  private changeTtsFollowHighlight(enabled: boolean): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.followHighlight = enabled;
    this.ttsFollowHighlight = enabled;
    if (!enabled) this.invalidateTtsPageFollow?.();
    else this.followTtsPage?.(this.ttsState);
    void this.persistTtsPreferencesSnapshot(candidate).catch((error: Error): void => {
      if (generation !== this.ttsPreferenceMutationGeneration) return;
      this.ttsFollowHighlight = previous.followHighlight;
      this.logTtsFailure('preference-persist', error);
    });
  }

  private changeTtsPauseOnInterruption(enabled: boolean): void {
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.pauseOnInterruption = enabled;
    this.ttsPauseOnInterruption = enabled;
    this.ttsCoordinator?.setPauseOnInterruption(enabled);
    void this.persistTtsPreferencesSnapshot(candidate).catch((error: Error): void => {
      if (generation !== this.ttsPreferenceMutationGeneration) return;
      this.ttsPauseOnInterruption = previous.pauseOnInterruption;
      this.ttsCoordinator?.setPauseOnInterruption(previous.pauseOnInterruption);
      this.logTtsFailure('preference-persist', error);
    });
  }

  private changeTtsVoice(language: string, person: number): void {
    const option = this.ttsVoiceOptions.find((candidate: ReaderTtsVoiceOption): boolean =>
      candidate.language === language && candidate.person === person);
    if (option === undefined) return;
    const generation = this.nextTtsPreferenceMutationGeneration();
    const previous = this.ttsPreferencesSnapshot();
    const candidate = this.copyTtsPreferencesSnapshot(previous);
    candidate.language = option.language;
    candidate.person = option.person;
    const coordinator = this.ttsCoordinator;
    void (coordinator === undefined ? Promise.resolve() : coordinator.setVoice(option.language, option.person))
      .then(async (): Promise<void> => {
        if (generation !== this.ttsPreferenceMutationGeneration) return;
        this.ttsLanguage = option.language;
        this.ttsPerson = option.person;
        try {
          await this.persistTtsPreferencesSnapshot(candidate);
        } catch (error) {
          if (generation !== this.ttsPreferenceMutationGeneration) return;
          this.ttsLanguage = previous.language;
          this.ttsPerson = previous.person;
          try { await coordinator?.setVoice(previous.language, previous.person); } catch (_) {}
          this.logTtsFailure('preference-persist', error as Error);
        }
      })
      .catch((error: Error): void => this.logTtsFailure('voice', error));
  }

  private async changeTtsEngine(engine: string): Promise<void> {
    if (engine !== 'system' && !this.ttsHttpEngines.some((item: ReaderHttpTtsConfig): boolean =>
      engine === `http-tts:${item.id}`)) throw new Error('该在线 TTS 配置不存在，请重新选择');
    const gateway = this.ttsGateway;
    const coordinator = this.ttsCoordinator;
    if (gateway === undefined || coordinator === undefined) throw new Error('朗读服务正在初始化，请稍后重试');
    if (engine === this.ttsEngine) return;
    this.ttsConfigMutationGeneration += 1;
    try {
      await coordinator.stop('user');
      const prior = this.ttsConfig;
      const config = await gateway.putConfig({
        engine,
        rate: prior?.rate ?? this.coreRateForMultiplier(this.ttsState.rate),
        ratePercent: prior?.ratePercent ?? this.ratePercentForMultiplier(this.ttsState.rate),
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

  private async saveHttpTtsEngine(config: ReaderTtsEngineOption): Promise<void> {
    const gateway = this.ttsHttpGateway;
    if (gateway === undefined) throw new Error('朗读服务正在初始化，请稍后重试');
    const existing = this.ttsHttpEngines.find(
      (engine: ReaderHttpTtsConfig): boolean => engine.id === config.id,
    );
    const existingProfile = existing === undefined ? readerOnlineTtsProfile() :
      readerOnlineTtsProfile(existing.readerProfile);
    const voice = (config.voice ?? existingProfile.voice).trim();
    if (voice.length > 256 || /[\u0000-\u001f\u007f]/.test(voice)) {
      throw new Error('在线 TTS 音色格式无效');
    }
    const format: ReaderTtsAudioFormat = config.format ?? existingProfile.format;
    if (format !== 'mp3' && format !== 'wav' && format !== 'pcm') {
      throw new Error('在线 TTS 音频格式无效');
    }
    const enteredApiKey = (config.apiKey ?? '').trim();
    const oldCredentialRef = existingProfile.credentialRef;
    let credentialRef = oldCredentialRef;
    let createdCredentialRef: string | undefined = undefined;
    if (enteredApiKey.length > 0) {
      createdCredentialRef = await ReaderTtsCredentialStore.instance.create(config.id, enteredApiKey);
      credentialRef = createdCredentialRef;
    } else if (config.clearApiKey === true) {
      credentialRef = undefined;
    }
    const profile = this.copyReaderOnlineTtsProfile(existingProfile);
    profile.version = 1;
    profile.voice = voice;
    profile.format = format;
    profile.protocol = existingProfile.protocol ?? 'auto';
    if (credentialRef !== undefined) profile.credentialRef = credentialRef;
    else profile.credentialRef = undefined;
    const merged: ReaderHttpTtsConfig = {
      id: config.id,
      name: config.name,
      url: config.url,
      lastUpdateTime: config.lastUpdateTime,
      readerProfile: JSON.stringify(profile),
    };
    if (existing?.contentType !== undefined) merged.contentType = existing.contentType;
    if (existing?.concurrentRate !== undefined) merged.concurrentRate = existing.concurrentRate;
    if (existing?.loginUrl !== undefined) merged.loginUrl = existing.loginUrl;
    if (existing?.loginUi !== undefined) merged.loginUi = existing.loginUi;
    if (existing?.header !== undefined) merged.header = existing.header;
    if (existing?.jsLib !== undefined) merged.jsLib = existing.jsLib;
    if (existing?.enabledCookieJar !== undefined) merged.enabledCookieJar = existing.enabledCookieJar;
    if (existing?.loginCheckJs !== undefined) merged.loginCheckJs = existing.loginCheckJs;
    let saved: ReaderHttpTtsConfig;
    try {
      saved = await gateway.put(merged);
    } catch (error) {
      // A timed-out Core request may have committed despite the missing
      // response. Reconcile before deleting the newly-created secret alias;
      // losing it would leave a durable config that can never authenticate.
      if (createdCredentialRef !== undefined) {
        let committed = false;
        try {
          const observed = await gateway.get(config.id);
          committed = observed?.readerProfile === merged.readerProfile;
        } catch (_) {
          // Keep the alias when reconciliation itself is uncertain.
          committed = true;
        }
        if (!committed) {
          await this.removeTtsCredentialBestEffort(createdCredentialRef);
        }
      }
      const failure = error as Error;
      this.logTtsFailure('http-engine-put', failure);
      throw failure;
    }
    if (oldCredentialRef !== undefined && oldCredentialRef !== credentialRef) {
      await this.removeTtsCredentialBestEffort(oldCredentialRef);
    }
    try {
      try {
        this.ttsHttpEngines = await gateway.list();
      } catch (error) {
        // Core already acknowledged the durable write; retain the acknowledged
        // row locally if a follow-up list call is temporarily unavailable.
        this.logTtsFailure('http-engine-list', error as Error);
        this.ttsHttpEngines = this.ttsHttpEngines.filter(
          (item: ReaderHttpTtsConfig): boolean => item.id !== saved.id,
        ).concat([saved]);
      }
      if (this.ttsEngine !== `http-tts:${saved.id}`) {
        try {
          await this.changeTtsEngine(`http-tts:${saved.id}`);
        } catch (error) {
          throw new Error(`配置已保存，但启用失败：${this.errorMessage(error)}`);
        }
      }
    } catch (error) {
      const failure = error as Error;
      this.logTtsFailure('http-engine-activate', failure);
      throw failure;
    }
  }

  private async deleteHttpTtsEngine(id: number): Promise<void> {
    const httpGateway = this.ttsHttpGateway;
    const configGateway = this.ttsGateway;
    const coordinator = this.ttsCoordinator;
    if (httpGateway === undefined || configGateway === undefined || coordinator === undefined)
      throw new Error('朗读服务正在初始化，请稍后重试');
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
    const existing = this.ttsHttpEngines.find(
      (engine: ReaderHttpTtsConfig): boolean => engine.id === id,
    );
    if (this.ttsEngine === `http-tts:${id}`) {
      await coordinator.stop('user');
      const prior = this.ttsConfig;
      const config = await configGateway.putConfig({
        engine: 'system',
        rate: prior?.rate ?? this.coreRateForMultiplier(this.ttsState.rate),
        ratePercent: prior?.ratePercent ?? this.ratePercentForMultiplier(this.ttsState.rate),
        pitch: prior?.pitch ?? 0,
        followSys: prior?.followSys ?? false,
      });
      this.ttsConfig = config;
      this.ttsEngine = 'system';
    }
    const deleted = await httpGateway.delete(id);
    let remaining: ReaderHttpTtsConfig[];
    try {
      remaining = await httpGateway.list();
      this.ttsHttpEngines = remaining;
    } catch (error) {
      this.logTtsFailure('http-engine-list', error as Error);
      remaining = this.ttsHttpEngines.filter((item: ReaderHttpTtsConfig): boolean => item.id !== id);
      this.ttsHttpEngines = remaining;
    }
    if (deleted.deleted && existing?.readerProfile !== undefined) {
      try {
        const oldRef = readerOnlineTtsProfile(existing.readerProfile).credentialRef;
        if (oldRef !== undefined && !remaining.some((item: ReaderHttpTtsConfig): boolean =>
          this.profileCredentialRef(item.readerProfile) === oldRef)) {
          await this.removeTtsCredentialBestEffort(oldRef);
        }
      } catch (error) {
        // A malformed legacy profile must not make a successful Core delete
        // look like a failed user action; the row is already gone.
        this.logTtsFailure('http-engine-credential-cleanup', error as Error);
      }
    }
    await coordinator.probeAvailability();
  }

  private profileCredentialRef(raw: string | undefined): string | undefined {
    if (raw === undefined || raw.length === 0) return undefined;
    try {
      return readerOnlineTtsProfile(raw).credentialRef;
    } catch (_) {
      return undefined;
    }
  }

  private async removeTtsCredentialBestEffort(alias: string): Promise<void> {
    try {
      await ReaderTtsCredentialStore.instance.remove(alias);
    } catch (error) {
      hilog.warn(0x5244, 'Reader', '%{private}s',
        `Reader TTS credential cleanup deferred: ${this.errorMessage(error)}`);
    }
  }

  private async persistTtsConfig(rate: number): Promise<void> {
    const gateway = this.ttsGateway;
    if (gateway === undefined) return;
    const prior = this.ttsConfig;
    const config = await gateway.putConfig({
      engine: this.ttsEngine,
      rate: this.coreRateForMultiplier(rate),
      ratePercent: this.ratePercentForMultiplier(rate),
      pitch: prior?.pitch ?? 0,
      followSys: prior?.followSys ?? false,
    });
    this.ttsConfig = config;
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
    try {
      const gateway = this.activeGateway();
      await gateway.runProgressCommitSerial(async (): Promise<void> => {
        if (!isCurrent()) return;
        const scalarCount = this.requireChapterLayoutMap().scalarCount();
        const offset = Math.max(0, Math.min(scalarCount, progress.charEnd));
        const chapterProgress = scalarCount === 0 ? 0 : offset / scalarCount;
        const stored = await gateway.resolveAndUpdateProgress(
          this.bookId,
          chapter.chapterTitle,
          new CoreReadingAnchor(chapter.chapterIndex, offset, chapterProgress, chapter.bodyVersion, chapter.processingVersion),
          this.coreLayout(),
          isCurrent,
        );
        if (!isCurrent()) return;
        this.admitCommittedProgress(stored);
        this.lastTtsCommittedProgress = this.lastCommittedProgress;
        this.lastTtsCommittedChapter = chapter;
        this.lastTtsCommittedSelectionToken = selectionToken;
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
      bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
    };
  }

  private ttsTimerDurationMs(): number | undefined {
    if (this.ttsTimerMode !== 'duration') return undefined;
    const seconds = this.ttsTimerMinutes * 60 + this.ttsTimerSeconds;
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  private coreRateForMultiplier(rate: number): number {
    return Math.max(1, Math.min(10, Math.round(rate * 5)));
  }

  private ratePercentForMultiplier(rate: number): number {
    return Math.max(50, Math.min(200, Math.round(rate * 20) * 5));
  }

  private multiplierForTtsConfig(config: ReaderTtsConfig): number {
    if (config.ratePercent !== undefined && Number.isSafeInteger(config.ratePercent) &&
      config.ratePercent >= 50 && config.ratePercent <= 200) {
      return config.ratePercent / 100;
    }
    return this.multiplierForCoreRate(config.rate);
  }

  private multiplierForCoreRate(rate: number): number {
    return Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX, rate / 5));
  }

  private logTtsFailure(operation: string, error: Error): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS ${operation} failed: ${error.message}`);
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
    this.cancelPendingTtsPlay();
    const presentation = this.captureControlPlaybackPresentation();
    if (this.automaticReadingState().status === 'running') {
      this.pauseAutoPage('manual');
      return;
    }
    if (this.automaticReadingState().status === 'paused') {
      this.autoPageCoordinator.resume();
      this.hideControl();
      this.armAutoPageTimer(true);
      this.armAutoPageSessionTimer(false);
      return;
    }
    if (this.autoPageCoordinator.pendingStart()) return;
    this.beginSessionCapsuleMorph('autoPage');
    const coordinator = this.ttsCoordinator;
    if (readerTtsSessionBlocksAutoPageStart(this.ttsState.status)) {
      if (coordinator === undefined) return;
      const generation = this.autoPageCoordinator.beginStart();
      const lifecycleToken = this.lifecycleToken;
      void coordinator.stop('user')
        .then((): void => {
          if (!this.isSessionActive(lifecycleToken) || !this.autoPageCoordinator.pendingStart() ||
            !this.autoPageCoordinator.isStartCurrent(generation) || this.ttsCoordinator !== coordinator ||
            this.automaticReadingState().status !== 'stopped') {
            return;
          }
          if (this.autoPageCoordinator.admitStart(generation)) this.startAutoPageSession(presentation);
        })
        .catch((error: Error): void => {
          if (!this.autoPageCoordinator.admitStart(generation)) return;
          this.logTtsFailure('stop before auto-page', error);
          this.cancelSessionLaunch('stopBarrierFailure');
          this.getUIContext().getPromptAction().showToast({ message: '朗读未能停止，自动翻页尚未启动，请重试' });
        });
      return;
    }
    this.startAutoPageSession(presentation);
  }

  private startAutoPageSession(presentation: ReaderControlPlaybackPresentation): void {
    if (!this.mounted || this.exitRequested || this.phase !== 'ready' ||
      this.automaticReadingState().status !== 'stopped') {
      return;
    }
    this.autoPageCoordinator.start();
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
    }
    this.armAutoPageTimer(true);
    this.armAutoPageSessionTimer(true);
  }

  private stopAutoPage(): void {
    if (this.sessionLaunch?.geometry.type === 'autoPage') this.cancelSessionLaunch('stop');
    this.autoPageCoordinator.stop();
    this.cancelAutomaticPageStart?.('autoTimer');
  }

  private cancelPendingAutoPageStart(): void { this.autoPageCoordinator.cancelStart(); }

  private changeAutoPageSpeed(deltaSeconds: number): void {
    this.setAutoPageSpeed(this.automaticReadingState().speedSeconds + deltaSeconds);
  }

  private setAutoPageSpeed(nextSpeed: number): void { this.autoPageCoordinator.setSpeed(nextSpeed); }

  private changeAutoPageSessionTimer(minutes: number, seconds: number): void {
    this.autoPageCoordinator.setSessionTimer(minutes, seconds);
  }

  private setAutoPageFollowHighlight(enabled: boolean): void { this.autoPageCoordinator.setFollowHighlight(enabled); }

  private pauseAutoPageForInteraction(): void {
    this.pauseAutoPage('touch');
  }

  private onReaderManualInteraction(): void {
    this.invalidateTtsPageFollow?.();
    this.screenAwakeLease?.rearm();
    this.pauseAutoPageForInteraction();
  }

  private pauseAutoPage(reason: ReaderAutoPagePauseReason): void {
    this.autoPageCoordinator.pause(reason);
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
    this.onControlInputBoundaryChanged();
    if (!this.appForeground) {
      this.cancelAutomaticPageStart?.();
      this.stopReaderTtsAudition();
      this.finishSessionCapsuleMorph();
      this.finishBookmarkRollback(this.bookmarkRollbackGeneration);
      this.bookmarkRollbackGeneration += 1;
      this.screenAwakeLease?.setForeground(false);
      this.captureReadingRecordElapsed(false);
      this.clearReadingRecordTimer();
      void this.flushReadingRecord();
      this.pauseAutoPage('background');
      const coordinator = this.ttsCoordinator;
      if (coordinator !== undefined) {
        const pause = (): void => {
          if (!this.mounted || this.appForeground || this.ttsCoordinator !== coordinator) return;
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
        hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience read-record flush failed: ${this.errorMessage(error)}`);
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
    this.onControlInputBoundaryChanged();
    if (this.controlObscured) {
      this.pauseAutoPage('touch');
    }
  }

  private onWindowChromeActiveChanged(): void {
    this.onControlInputBoundaryChanged();
    this.applyWindowChrome();
    this.applyWindowPolicyForChromeOwner();
  }

  private controlsPresentedForWindow(): boolean {
    return this.sessionLaunch?.ownership === 'stage' ? this.sessionLaunch.sample.controlsPresented :
      readerControlHostVisible(this.latestControlVisualSession);
  }

  private applyWindowPolicyForChromeOwner(): void {
    if (this.isReaderIdentityCurrent?.() === false) return;
    // This observed edge also owns the painted band. The child's per-frame
    // visual-session cache is intentionally non-reactive and cannot drive If.
    this.windowControlsPresented = this.controlsPresentedForWindow();
    this.syncVolumeKeyPolicy();
    AppStorage.setOrCreate<boolean>('readerTopInfoSuppressed',
      this.windowChromeActive && this.windowControlsPresented);
    if (this.windowChromeActive) {
      // The control surface is an explicit system-chrome affordance. Keep the
      // user's hide-status-bar preference persisted, but expose the status bar
      // while controls are open so the top bar has a live safe-top boundary.
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot, this.controlsPresentedForWindow())
        .catch((_error: Error): void => {});
      return;
    }
    void ReaderWindowCoordinator.requestAppWindowPolicy()
      .catch((_error: Error): void => {});
  }

  private readerStatusBarMetrics(_revision: number): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metrics();
  }

  @Builder
  private readerStatusBarUnderlay() {
    // In ordinary reading the status region belongs to the full-screen page
    // and its native turn texture. Only a presented control panel needs a
    // stationary paper band above its own App-colored surface.
    if (this.windowChromeActive && this.windowControlsPresented) {
      // Read the observed revision inside the child update function: a static
      // metrics getter alone never subscribes this paint node to later measures.
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

  private setControlPage(page: ReaderControlPage): void {
    if (this.sessionLaunch !== undefined) this.cancelSessionLaunch('sourceChanged');
    if (!this.isControlInputEnabled()) return;
    this.invalidateControlBackdrop();
    this.controlSession = setReaderControlHostPage(this.latestControlVisualSession, page, this.controlTiming());
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
    }
  }

  private loadControlBookmarks(): void {
    const location = readerControlContentLocation(this.controlSession);
    if (!this.mounted || this.exitRequested || !this.controlVisible() ||
      location.level !== 'secondary' || location.module !== 'directory') return;
    const lifecycleToken = this.lifecycleToken;
    const generation = ++this.controlBookmarkLoadGeneration;
    const openRevision = this.controlOpenRevision;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const isCurrent = (): boolean => {
      const currentLocation = readerControlContentLocation(this.controlSession);
      return this.isSessionActive(lifecycleToken) && generation === this.controlBookmarkLoadGeneration &&
        openRevision === this.controlOpenRevision && sourceId === this.sourceId && bookId === this.bookId &&
        this.controlVisible() && currentLocation.level === 'secondary' && currentLocation.module === 'directory';
    };
    this.controlBookmarkLoadFailed = false;
    this.controlBookmarkLoadPending = true;
    // Index is the only canonical bookmark writer. A new open or explicit
    // retry owns a new request; morph frames and tab positioning do not.
    void Promise.resolve().then((): Promise<void> => {
      if (!isCurrent()) return Promise.resolve();
      return this.onLoadControlBookmarks(sourceId, bookId, isCurrent);
    })
      .catch((error: Error): void => {
        if (!isCurrent()) return;
        // A newer CRUD refresh may already have supplied every bookmark fact
        // before this older read rejects. Do not replace that ready UI with error.
        if (this.bookmarkLoadMessage.length === 0 && !this.directoryEntries.some((entry: LocalReadingTocEntry): boolean =>
          entry.bookmarks === undefined)) return;
        this.controlBookmarkLoadFailed = true;
        hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark projection failed: ${this.errorMessage(error)}`);
      })
      .finally((): void => {
        if (generation === this.controlBookmarkLoadGeneration) this.controlBookmarkLoadPending = false;
      });
  }

  private onControlBookmarkFailureChanged(): void {
    // Invalidate a queued/older read before admitting mutation uncertainty.
    // Prop delivery order must not cause a hidden retry or erase this message.
    this.controlBookmarkLoadGeneration++;
    this.controlBookmarkLoadPending = false;
    this.controlBookmarkLoadFailed = this.bookmarkLoadMessage.length > 0;
    if (this.bookmarkLoadMessage.length === 0) {
      this.controlBookmarkFailureNoticeKey = '';
      this.onControlDirectoryDataChanged();
      return;
    }
    if (!this.mounted || this.exitRequested || !this.appForeground || !this.windowChromeActive) return;
    const noticeKey = `${this.lifecycleToken}:${this.sourceId}:${this.bookId}:${this.bookmarkLoadMessage}`;
    if (this.controlBookmarkFailureNoticeKey === noticeKey) return;
    this.controlBookmarkFailureNoticeKey = noticeKey;
    try {
      this.getUIContext().getPromptAction().showToast({
        message: `${this.bookmarkLoadMessage}。请打开目录－书签重新载入。`,
      });
    } catch (error) {
      hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience bookmark notice unavailable: ${this.errorMessage(error)}`);
    }
  }

  private onControlDirectoryDataChanged(): void {
    this.reconcilePageBookmarkFeedback();
    // Parent detail admission may arrive before the reader's own TOC promise.
    // Prime the retained presentation as soon as a non-empty validated
    // projection exists, so a later control close cannot replace it with the
    // shared empty sentinel during an in-flight morph.
    if (this.directoryEntries.length > 0) this.controlDirectoryDataRetained = true;
    const location = readerControlContentLocation(this.controlSession);
    if (!this.controlVisible() || location.level !== 'secondary' || location.module !== 'directory') return;
    if (this.bookmarkLoadMessage.length > 0) {
      if (!this.controlBookmarkLoadPending) this.controlBookmarkLoadFailed = true;
      return;
    }
    let unknown = false;
    for (const entry of this.directoryEntries) {
      if (entry.bookmarks === undefined) { unknown = true; break; }
    }
    if (!unknown) {
      // A concurrent, confirmed CRUD refresh can itself provide the facts.
      this.controlBookmarkLoadFailed = false;
    } else if (!this.controlBookmarkLoadPending && !this.controlBookmarkLoadFailed) {
      // A real catalog change can introduce unknown rows after first opening.
      // Attempt once for this data change, never retry a failure on each frame.
      this.loadControlBookmarks();
    }
  }

  private async loadAppearanceSnapshot(lifecycleToken: number): Promise<void> {
    const mutationGeneration = this.appearanceMutationGeneration;
    try {
      await this.appearanceGateway.load();
      while (this.isSessionActive(lifecycleToken) && mutationGeneration === this.appearanceMutationGeneration) {
        const snapshot = this.appearanceGateway.current();
        await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
        if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.appearanceMutationGeneration) return;
        if (!this.sameAppearanceFont(snapshot, this.appearanceGateway.current())) continue;
        if (snapshot.font !== 'custom' || snapshot.customFont === undefined) {
          this.admitAppearanceSnapshot(snapshot);
          this.appearanceLoaded = true;
          this.observeAppearanceSave(this.appearanceGateway.flush(), lifecycleToken);
          return;
        }
        const registered = await this.appearanceGateway.registerCustomFont(
          this.getUIContext().getFont(),
          snapshot,
        );
        // A disposed page must not recover its old font into a newer session.
        if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.appearanceMutationGeneration) return;
        const latest = this.appearanceGateway.current();
        if (!this.sameAppearanceFont(snapshot, latest)) continue;
        if (!registered && snapshot.font === 'custom') {
          const commit = await this.appearanceGateway.update(
            (current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFont(current, 'serif'),
            (current: ReaderAppearanceSnapshot): boolean => this.isSessionActive(lifecycleToken) &&
              mutationGeneration === this.appearanceMutationGeneration && this.sameAppearanceFont(snapshot, current),
          );
          if (commit !== undefined) this.observeAppearanceSave(commit.saved, lifecycleToken);
          continue;
        }
        this.admitAppearanceSnapshot(latest);
        this.appearanceLoaded = true;
        this.observeAppearanceSave(this.appearanceGateway.flush(), lifecycleToken);
        return;
      }
    } catch (error) {
      if (this.isSessionActive(lifecycleToken) && mutationGeneration === this.appearanceMutationGeneration) {
        this.showAppearanceFailure('外观设置读取失败，请重新打开阅读页', error);
        // Initial pagination must never measure with a font that failed to
        // register. A later shared-preference reload keeps its admitted font.
        if (!this.appearanceLoaded) throw error;
      }
    }
  }

  private sameAppearanceFont(first: ReaderAppearanceSnapshot, second: ReaderAppearanceSnapshot): boolean {
    return first.font === second.font && (first.font !== 'custom' ||
      JSON.stringify(first.customFont) === JSON.stringify(second.customFont));
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
    void this.persistBeforeContentMutation().then((positionCurrent): Promise<ReaderChineseConversionMode> => {
      if (!positionCurrent() || !this.isSessionActive(lifecycleToken) ||
        generation !== this.chineseConversionMutationGeneration) throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      return this.chineseConversionGateway.putMode(mode);
    })
      .then((storedMode: ReaderChineseConversionMode): void => {
        if (!this.isSessionActive(lifecycleToken) ||
          generation !== this.chineseConversionMutationGeneration) {
          return;
        }
        this.chineseConversionMode = storedMode;
        this.chineseConversionLoaded = true;
        this.quickSearchPublication.cancel();
        this.publishQuickSearchState({ kind: 'idle' });
        const chapter = this.chapter;
        if (chapter === undefined) {
          if (this.phase === 'failed') this.retryReading();
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
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      this.applyInitialReaderWindowPolicy(this.readerSettingsSnapshot, lifecycleToken, this.readerSettingsMutationGeneration);
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
      this.readerSettingsSnapshot = loadedSnapshot;
      this.readerSettingsLoaded = true;
      this.configureReaderScreenAwakeLease(loadedSnapshot);
      this.applyReaderSystemEventPolicy(loadedSnapshot);
      this.applyInitialReaderWindowPolicy(loadedSnapshot, lifecycleToken, mutationGeneration);
    } catch (_error) {
      // Keep locally-rendered behavior coherent with a failed Host request:
      // supported page-turn state survives, window-backed fields fail closed.
      if (!this.isSessionActive(lifecycleToken) || mutationGeneration !== this.readerSettingsMutationGeneration) return;
      this.readerSettingsSnapshot = this.safeWindowSettingsFallback(loadedSnapshot);
      this.readerSettingsLoaded = true;
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      void ReaderWindowCoordinator.requestReaderWindowPolicy(
        this.windowPolicyFor(this.readerSettingsSnapshot)).catch((): void => {});
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
      this.readerSettingsSnapshot = this.safeWindowSettingsFallback(snapshot);
      this.configureReaderScreenAwakeLease(this.readerSettingsSnapshot);
      this.applyReaderSystemEventPolicy(this.readerSettingsSnapshot);
      this.reflowAfterWindowGeometryChange();
      void this.applyReaderWindowPolicy(this.readerSettingsSnapshot).catch((): void => {});
    });
  }

  private changeReaderSetting(key: ReaderSettingsToggleKey, value: boolean): void {
    const snapshot = setReaderSettingsToggle(this.readerSettingsSnapshot, key, value);
    if (key === 'hideNavigationBar' || key === 'extendIntoCutout') {
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
    const previous = this.readerSettingsSnapshot;
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    this.readerSettingsSnapshot = snapshot;
    this.readerSettingsLoaded = true;
    this.configureReaderScreenAwakeLease(snapshot);
    this.applyReaderSystemEventPolicy(snapshot);
    this.pageTurnRenderRevision += 1;
    void this.readerSettingsGateway.update(snapshot).catch((error: Error): void => {
      if (!this.isSessionActive(lifecycleToken) || generation !== this.readerSettingsMutationGeneration) return;
      this.readerSettingsSnapshot = previous;
      this.configureReaderScreenAwakeLease(previous);
      this.applyReaderSystemEventPolicy(previous);
      this.pageTurnRenderRevision += 1;
      this.showReaderSettingsFailure('阅读设置保存失败，已恢复上次保存值', error);
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
    void this.applyReaderWindowPolicy(snapshot, this.controlsPresentedForWindow())
      .then((): Promise<void> => {
        if (!this.isSessionActive(lifecycleToken) ||
          generation !== this.readerSettingsMutationGeneration) {
          return Promise.resolve();
        }
        const cutoutLayoutChanged = previous.extendIntoCutout !== snapshot.extendIntoCutout;
        if (cutoutLayoutChanged) {
          this.reflowAfterWindowGeometryChange();
        }
        return this.readerSettingsGateway.update(snapshot).then((): void => {});
      })
      .catch((error: Error): void => {
        if (this.isSessionActive(lifecycleToken) &&
          generation === this.readerSettingsMutationGeneration) {
          this.readerSettingsSnapshot = previous;
          this.configureReaderScreenAwakeLease(previous);
          this.applyReaderSystemEventPolicy(previous);
          if (previous.extendIntoCutout !== snapshot.extendIntoCutout) {
            // Controls may keep the same native bar geometry throughout the
            // failed write, so no Window callback will restore the body budget.
            this.reflowAfterWindowGeometryChange();
          }
          void this.applyReaderWindowPolicy(previous, this.controlsPresentedForWindow())
            .catch((_rollbackError: Error): void => {});
          this.showReaderSettingsFailure('阅读设置保存失败，已恢复上次保存值', error);
        }
      });
  }

  private showReaderSettingsFailure(message: string, error: Error): void {
    hilog.warn(0x5244, 'Reader', '%{private}s', `Reader settings persistence failed: ${this.errorMessage(error)}`);
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch (_) {
      // A missing presentation context must not prevent the state rollback.
    }
  }

  private applyReaderWindowPolicy(snapshot: ReaderSettingsSnapshot,
    forceStatusBarVisible: boolean = this.controlsPresentedForWindow()): Promise<void> {
    if (this.isReaderIdentityCurrent?.() === false) return Promise.resolve();
    return ReaderWindowCoordinator.requestReaderWindowPolicy(this.windowPolicyFor(snapshot, forceStatusBarVisible));
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
    const coordinator = this.ttsCoordinator;
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
      this.screenAwakeKeepScreenOn || this.ttsKeepScreenOn,
      forceStatusBarVisible ? false : snapshot.extendIntoCutout,
      snapshot.hideNavigationBar,
      snapshot.extendIntoCutout,
    );
  }

  private safeWindowSettingsFallback(snapshot: ReaderSettingsSnapshot): ReaderSettingsSnapshot {
    return normalizeReaderSettingsSnapshot({
      version: 5,
      screenDirection: 'system',
      navigationMode: snapshot.navigationMode,
      pageTransition: snapshot.pageTransition,
      screenTimeout: 'system',
      hideNavigationBar: false,
      extendIntoCutout: false,
      justifyText: snapshot.justifyText,
      alignPageBottom: snapshot.alignPageBottom,
      volumeKeysTurnPage: snapshot.volumeKeysTurnPage,
      stopTtsOnScreenOff: snapshot.stopTtsOnScreenOff,
      longPressSelectText: snapshot.longPressSelectText,
    });
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
        this.getUIContext().getPromptAction().showToast({ message: '进度保存失败，请重试切换翻页效果' });
      });
      return;
    }
    const previous = this.readerSettingsSnapshot;
    const previousBookTurnRuntimeFailed = this.bookTurnRuntimeFailed;
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
        this.rebuildContinuousFragments();
        this.setContinuousInitialAnchor(this.visiblePage?.startScalar ?? this.desiredChapterOffset);
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
    void this.readerSettingsGateway.update(snapshot).catch((error: Error): void => {
      // Page-turn style changes use a special reflow path, so they must retain
      // the same transactional rollback contract as the other settings. Do
      // not let a failed Preferences flush leave a session-only style that
      // silently disappears on the next reader mount.
      if (!this.isSessionActive(lifecycleToken) ||
        mutationGeneration !== this.readerSettingsMutationGeneration ||
        changeGeneration !== this.pageStyleChangeGeneration) {
        return;
      }
      this.readerSettingsSnapshot = previous;
      this.readerSettingsLoaded = true;
      this.bookTurnRuntimeFailed = previousBookTurnRuntimeFailed;
      if (changed) {
        this.invalidatePageTurnRuntime(true);
      } else {
        this.pageTurnRenderRevision += 1;
      }
      if (navigationChanged && this.hasCurrentMaterializedChapter()) {
        if (previous.navigationMode === 'continuous') {
          this.rebuildContinuousFragments();
          this.setContinuousInitialAnchor(this.visiblePage?.startScalar ?? this.desiredChapterOffset);
          this.continuousProgressRevision += 1;
        } else {
          this.beginCanonicalModeMeasurement(this.continuousVisibleScalar);
        }
      }
      if (readerPageTransitionUsesPreparedPages(previous) && this.phase === 'ready') {
        this.schedulePageTurnPreparation();
      }
      this.showReaderSettingsFailure('阅读设置保存失败，已恢复上次保存值', error);
    });
  }

  private changeAppearanceTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceTheme(current, theme, AppStorage.get<string>('readerSystemScheme') === 'night' ? 'night' : 'day'));
  }

  private changeAppearanceDayTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceDayTheme(current, theme));
  }

  private changeAppearanceNightTheme(theme: ReaderAppearanceTheme): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceNightTheme(current, theme));
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

  private changeAppearanceFontOrder(fontOrder: ReaderAppearanceFontSlot[]): void {
    const requestedOrder = fontOrder.slice();
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFontOrder(current, requestedOrder));
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
        this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceCustomFont(current, descriptor));
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
      this.stepAppearanceSnapshotMetric(current, metric, direction));
  }

  private stepAppearanceSnapshotMetric(
    current: ReaderAppearanceSnapshot,
    metric: ReaderAppearanceMetric,
    direction: ReaderAppearanceStepDirection,
  ): ReaderAppearanceSnapshot {
    let value = 0;
    if (metric === 'fontSize') {
      value = current.fontSize + direction * READER_APPEARANCE_FONT_SIZE_STEP;
    } else if (metric === 'lineHeightMultiplier') {
      value = this.roundAppearanceMetric(
        current.lineHeightMultiplier + direction * READER_APPEARANCE_LINE_HEIGHT_STEP,
      );
    } else if (metric === 'paragraphSpacing') {
      value = current.paragraphSpacing + direction * READER_APPEARANCE_PARAGRAPH_SPACING_STEP;
    } else {
      value = this.roundAppearanceMetric(
        current.letterSpacing + direction * READER_APPEARANCE_LETTER_SPACING_STEP,
      );
    }
    const range = readerAppearanceMetricRange(metric);
    value = Math.min(range.maximum, Math.max(range.minimum, value));
    return setReaderAppearanceMetric(current, metric, value);
  }

  private roundAppearanceMetric(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private commitAppearanceChange(change: ReaderAppearanceChange): void {
    this.appearanceMutationGeneration = this.appearanceMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceMutationGeneration + 1;
    const generation = this.appearanceMutationGeneration;
    const lifecycleToken = this.lifecycleToken;
    void ReaderThemeHost.prepareUserChange().then((): Promise<ReaderAppearanceCommit | undefined> => {
      if (!this.isSessionActive(lifecycleToken)) return Promise.resolve(undefined);
      return this.appearanceGateway.update(change, (): boolean => this.isSessionActive(lifecycleToken));
    }).then(async (commit: ReaderAppearanceCommit | undefined): Promise<void> => {
      if (commit === undefined) return;
      this.observeAppearanceSave(commit.saved, lifecycleToken);
      const snapshot = this.appearanceGateway.current();
      await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
      // Keep every accepted change, but only the current page admits the latest view.
      if (this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration) {
        const latest = this.appearanceGateway.current();
        if (this.sameAppearanceFont(snapshot, latest)) this.admitAppearanceSnapshot(latest);
      }
    }).catch((error: Error): void => {
      if (this.isSessionActive(lifecycleToken) && generation === this.appearanceMutationGeneration) {
        this.showAppearanceFailure('外观设置暂时无法修改，请重试', error);
      }
    });
  }

  private observeAppearanceSave(saved: Promise<void>, lifecycleToken: number): void {
    void saved.catch((error: Error): void => {
      if (this.isSessionActive(lifecycleToken) && this.appearanceGateway.hasUnsavedChanges()) {
        this.showAppearanceFailure('外观设置保存失败，当前效果已保留，请稍后重试', error);
      }
    });
  }

  private showAppearanceFailure(message: string, error: Error): void {
    hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience appearance failed: ${this.errorMessage(error)}`);
    try {
      this.getUIContext().getPromptAction().showToast({ message: message });
    } catch (_) {
      // A missing presentation context must not discard accepted settings.
    }
  }

  private admitAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): void {
    const previous = this.appearanceSnapshot;
    const layoutChanged = !this.sameAppearanceLayout(previous, snapshot);
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
    this.applyWindowChrome();
    if (!layoutChanged) {
      if (themeChanged && this.hasCurrentMaterializedChapter() && this.phase === 'ready') {
        this.schedulePageTurnPreparation();
      }
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

  private visibleReadingAppearance(): ReaderAppearanceSnapshot {
    return this.pageReadingAppearance(this.visiblePage);
  }

  private pageReadingAppearance(page: PhysicalReadingPage | undefined): ReaderAppearanceSnapshot {
    const measured = page?.measuredAppearance;
    const current = this.appearanceSnapshot;
    if (measured === undefined) return current;
    if (measured.activeTheme === current.activeTheme && measured.appThemeMode === current.appThemeMode &&
      measured.dayTheme === current.dayTheme && measured.nightTheme === current.nightTheme) return measured;
    // Theme changes do not alter native line breaks and stay immediate even
    // while a newer font/spacing intent is still being measured off screen.
    const rendered = copyReaderAppearanceSnapshot(measured);
    rendered.activeTheme = current.activeTheme;
    rendered.appThemeMode = current.appThemeMode;
    rendered.dayTheme = current.dayTheme;
    rendered.nightTheme = current.nightTheme;
    return rendered;
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
    if (this.pageTurnInputPhase() !== 'idle') return;
    const launch = this.sessionLaunch;
    if (launch !== undefined) {
      if (launch.ownership !== 'stage') return;
      const desired = launch.businessStatus === 'preparing' ? !launch.desiredPlaying : this.sessionLaunchBusinessStatus() !== 'playing';
      this.sessionLaunchController.setDesiredPlaying(launch.generation, desired);
      this.sessionLaunch = this.sessionLaunchController.snapshot();
      if (launch.geometry.type === 'tts') this.ttsCoordinator?.setDesiredPlaying(desired);
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
    // Morph frames report transient shell widths; they must not overwrite
    // the settled measurement that anchors the capsule layout.
    if (this.sessionLaunch !== undefined) {
      return;
    }
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

  private sessionLaunchLayoutKey(): string {
    return `${this.lifecycleToken}|${this.sourceId}|${this.bookId}|${this.viewportWidth}|${this.viewportHeight}|` +
      `${this.paginationLayoutSignature()}|${this.readerAppScheme}|${this.appearanceSnapshot.activeTheme}`;
  }

  private sessionLaunchMeasurementKey(): string {
    const layout = this.controlLayout(this.readerWindowMetricsRevision);
    return `${this.sessionLaunchLayoutKey()}|${this.controlOpenRevision}|${this.controlModuleVisitRevision}|` +
      `${layout.fullPanelWidth}|${layout.fullPanelHeight}|${layout.topBarTop}|${layout.dockBottomGap}`;
  }

  private admitSessionMorphSourceMeasurement(measurement: ReaderSessionMorphSourceMeasurement): void {
    if (this.sessionLaunch?.ownership === 'stage') return;
    if (measurement.kind === 'quickAutoPage') this.quickAutoPageMorphSource = measurement;
    else if (measurement.kind === 'quickTts') this.quickTtsMorphSource = measurement;
    else if (measurement.kind === 'fullAutoPagePlayback') this.fullAutoPageMorphSource = measurement;
    else this.fullTtsMorphSource = measurement;
    this.sessionLaunchSourceContexts.set(measurement.kind, this.sessionLaunchMeasurementKey());
  }

  private sessionMorphSourceMeasurement(kind: ReaderSessionMorphSourceKind): ReaderSessionMorphSourceMeasurement | undefined {
    if (kind === 'quickAutoPage') return this.quickAutoPageMorphSource;
    if (kind === 'quickTts') return this.quickTtsMorphSource;
    if (kind === 'fullAutoPagePlayback') return this.fullAutoPageMorphSource;
    return this.fullTtsMorphSource;
  }

  /** Synchronous intent feedback; no screenshot or business Promise can gate it. */
  private beginSessionCapsuleMorph(type: ReaderSessionCapsuleType): boolean {
    if (this.sessionLaunch !== undefined) return this.sessionLaunch.geometry.type === type;
    if (!this.mounted || !this.appForeground || this.exitRequested || !this.controlVisible() || this.controlObscured) return false;
    const kind = readerSessionMorphSourceKindForPage(this.controlPage());
    if (kind === undefined || (type === 'tts') !== (kind === 'quickTts' || kind === 'fullTtsPlayback')) return false;
    const source = this.sessionMorphSourceMeasurement(kind);
    if (source === undefined || this.sessionLaunchSourceContexts.get(kind) !== this.sessionLaunchMeasurementKey()) {
      // Retain the visible source. A missing/stale measured actor must never
      // cause a blank capture state or a fabricated flight from a stale rect.
      hilog.warn(0x0000, 'ReaderSessionLaunch', 'session launch retained source: measurement not current');
      return false;
    }
    const width = this.measuredSessionCapsuleType === type && this.sessionCapsuleMeasuredWidth > 0 ?
      this.sessionCapsuleMeasuredWidth : readerSessionCapsuleMinimumWidth(type);
    const target = resolveReaderPageChromeLayout(this.readingLayout(), new ReaderPageChromeMeasurements(
      0, 0, 0, 0, 0, 0, 0, 0, true, width, 24));
    const geometry = buildReaderSessionLaunchGeometry({ source, targetLeft: target.sessionX, targetTop: target.sessionY,
      capsuleWidth: width, topBarExitDistance: this.sessionLaunchTopExit, dockExitDistance: this.sessionLaunchDockExit });
    if (geometry === undefined || this.sessionLaunchTopExit <= 0 || this.sessionLaunchDockExit <= 0) return false;
    const identity: ReaderSessionLaunchIdentity = {
      lifecycle: this.lifecycleToken, bookIdentity: `${this.sourceId}:${this.bookId}`,
      moduleVisit: this.controlModuleVisitRevision, viewportRevision: this.readerWindowMetricsRevision,
      scrollRevision: source.revision, layoutRevision: this.measurementEpoch,
      paletteRevision: this.sharedAppearanceRevision, fontRevision: this.appearanceMutationGeneration,
      sourceRevision: source.revision, sourceActorId: source.actorId,
    };
    const page = this.currentPageTurnRenderPage();
    this.sessionLaunchChrome = new ReaderPageChromeSnapshot(page.chromeTopStartText, page.chromeTopEndText,
      page.chromeBottomStartText, page.chromeBottomEndText, true, width, 24);
    this.sessionLaunchSourceTtsState = this.ttsState;
    this.sessionLaunchSourceAutoStatus = this.automaticReadingState().status;
    this.sessionLaunchSourceControl = copyReaderControlSessionState(this.latestControlVisualSession);
    this.sessionLaunchSourceLayoutKey = this.sessionLaunchLayoutKey();
    this.sessionLaunchStageOpacity = 1;
    this.sessionLaunchExitGeneration += 1;
    this.sessionLaunch = this.sessionLaunchController.begin(identity, geometry, readerMotionNowMs(), this.reduceMotion);
    if (this.sessionLaunch === undefined) return false;
    this.suspendAdjacentMeasurement();
    this.bookTurnTextureCaptureGeneration += 1;
    this.invalidateControlBackdrop();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.pageTurnRenderRevision += 1;
    if (!this.sessionLaunch.sample.controlsPresented) this.commitSessionLaunchControlHidden();
    this.applyWindowPolicyForChromeOwner();
    this.scheduleSessionLaunchFrame(this.sessionLaunch.generation);
    return true;
  }

  private scheduleSessionLaunchFrame(generation: number): void {
    if ((this.sessionLaunchFramePending && this.pendingSessionLaunchGeneration === generation) ||
      !this.sessionLaunchController.isCurrent(generation) || this.sessionLaunch?.sample.finished) return;
    const held = this.sessionLaunch;
    if (held !== undefined && held.sample.settled) {
      // Figma's 2300..3500 tail is a hold, not 1200ms of new visual state.
      // Keep actors and input alive; publish the terminal semantic sample once.
      if (this.sessionLaunchHoldTimer >= 0) return;
      this.sessionLaunchHoldTimer = setTimeout((): void => {
        this.sessionLaunchHoldTimer = -1;
        if (!this.mounted || !this.appForeground || this.exitRequested ||
          !this.sessionLaunchController.isCurrent(generation)) return;
        this.sessionLaunch = this.sessionLaunchController.advance(generation, readerMotionNowMs());
        if (!this.sessionLaunch?.sample.finished) this.scheduleSessionLaunchFrame(generation);
      }, Math.max(1, Math.ceil(this.sessionLaunchController.remainingHoldMs())));
      return;
    }
    this.sessionLaunchFramePending = true;
    this.pendingSessionLaunchGeneration = generation;
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (this.pendingSessionLaunchGeneration !== generation) return;
      this.sessionLaunchFramePending = false;
      if (!this.mounted || !this.appForeground || this.exitRequested || !this.sessionLaunchController.isCurrent(generation)) return;
      if (this.sessionLaunchSourceLayoutKey !== this.sessionLaunchLayoutKey()) {
        this.cancelSessionLaunch('sourceChanged'); return;
      }
      const previous = this.sessionLaunch;
      const next = this.sessionLaunchController.advance(generation, readerMotionNowMs());
      if (next === undefined) return;
      this.sessionLaunch = next;
      if (!previous?.sample.settled && next.sample.settled) this.drainPageTurnPreparationQueue();
      if (previous?.sample.controlsPresented && !next.sample.controlsPresented) {
        this.commitSessionLaunchControlHidden();
        this.applyWindowPolicyForChromeOwner();
      }
      if (!next.sample.finished) this.scheduleSessionLaunchFrame(generation);
    }));
  }

  private sessionLaunchRenderWorkBlocked(): boolean {
    const launch = this.sessionLaunch;
    return launch !== undefined && launch.ownership !== 'released' && !launch.sample.settled && !launch.sample.finished;
  }

  private sessionChromeForPresentation(): ReaderPageChromeSnapshot {
    const anchor = `${this.currentChapterIndex()}|${this.visiblePage?.startScalar}|${this.pageChromeClockText}|${this.pageTurnRenderRevision}`;
    if (anchor !== this.sessionLaunchChromeAnchor && !this.pageChromeStateFrozen()) {
      this.sessionLaunchChromeAnchor = anchor;
      // Do not read a frozen page/texture snapshot at the stage-to-hold boundary.
      const chapter = this.chapter;
      const key = this.pageChromePaginationKey(chapter?.chapterIndex ?? -1, this.materializedContentVersion);
      this.sessionLaunchChrome = this.pageChromeSnapshot(chapter?.chapterIndex ?? -1,
        this.visiblePage?.startScalar ?? -1, this.chapterLayoutMap?.scalarCount() ?? 0, key, this.paginationDraft);
    }
    return this.sessionLaunchChrome;
  }

  private commitSessionLaunchControlHidden(): void {
    // No ordinary 320ms dismiss clock: this is only the semantic 700ms endpoint.
    this.controlSession = dismissReaderControlSession(this.controlSession, 0);
    this.latestControlVisualSession = copyReaderControlSessionState(this.controlSession);
  }

  private onSessionLaunchReduceMotionChanged(): void {
    if (!this.reduceMotion || this.sessionLaunch === undefined) return;
    this.sessionLaunch = this.sessionLaunchController.setReduceMotion(true);
    this.commitSessionLaunchControlHidden();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.pageTurnRenderRevision += 1;
    this.applyWindowPolicyForChromeOwner();
  }

  private onSessionLaunchTtsState(state: ReaderTtsState): void {
    const launch = this.sessionLaunch;
    if (launch === undefined || launch.geometry.type !== 'tts' || launch.ownership !== 'stage') return;
    if (state.status === 'error' || state.status === 'failed' || state.status === 'unavailable') {
      this.cancelSessionLaunch('failure'); return;
    }
    if (state.status === 'playing') this.sessionLaunchController.acknowledgeBusiness(launch.generation, 'playing');
    else if (state.status === 'paused' || state.status === 'interrupted') this.sessionLaunchController.acknowledgeBusiness(launch.generation, 'paused');
    else if (state.status === 'completed' || (state.status === 'idle' && launch.businessStatus !== 'preparing')) { this.cancelSessionLaunch('stop'); return; }
    this.sessionLaunch = this.sessionLaunchController.snapshot();
  }

  private cancelSessionLaunch(reason: ReaderSessionLaunchCancelReason): void {
    if (this.sessionLaunch === undefined || this.sessionLaunch.ownership !== 'stage') return;
    if (this.sessionLaunchHoldTimer >= 0) clearTimeout(this.sessionLaunchHoldTimer);
    this.sessionLaunchHoldTimer = -1;
    const launch = this.sessionLaunchController.cancel(reason);
    if (launch === undefined) return;
    this.sessionLaunch = launch;
    if (reason === 'stop' || reason === 'failure') {
      if (launch.geometry.type === 'tts') this.cancelPendingTtsPlay();
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
      // Source module and its Scroll remained mounted. Restore that exact
      // semantic location; the old proxy holds its current rect until the new
      // owner has presented a frame, then takes the existing exit fade.
      const hidden = dismissReaderControlSession(this.sessionLaunchSourceControl, 0);
      const restored = resumeReaderControlSessionTarget(hidden,
        readerControlContentLocation(this.sessionLaunchSourceControl), this.reduceMotion ? 0 : READER_CONTROL_OPEN_MS);
      // This is an owner return, not Quick→Full expansion. The panel retains
      // the captured module pose and uses the existing OPEN clock for offsets.
      if (restored.transition !== undefined) {
        restored.transition.kind = 'open'; restored.transition.intent = 'forward';
      }
      this.controlSession = restored;
      this.latestControlVisualSession = copyReaderControlSessionState(restored);
      this.applyWindowPolicyForChromeOwner();
    } else this.fadeSessionLaunchExit(launch.generation);
  }

  private onSessionLaunchSourceReady(generation: number): void {
    if (!this.mounted || this.sessionLaunch?.generation !== generation ||
      !this.sessionLaunchController.confirmHandoffReady(generation)) return;
    this.sessionLaunch = this.sessionLaunchController.snapshot();
    this.fadeSessionLaunchExit(generation);
  }

  private fadeSessionLaunchExit(generation: number): void {
    const exit = ++this.sessionLaunchExitGeneration;
    const finish = (): void => {
      if (exit !== this.sessionLaunchExitGeneration || this.sessionLaunch === undefined || this.sessionLaunch.generation !== generation) return;
      this.sessionLaunchController.finishExit(generation);
      this.finishSessionCapsuleMorph();
    };
    if (this.reduceMotion) { finish(); return; }
    this.getUIContext().animateTo({ duration: motionSpecGet('reader.session.capsule.exit')?.durationMs ?? 200,
      curve: Curve.EaseOut, onFinish: finish }, (): void => {
        this.sessionLaunchStageOpacity = 0;
        if (this.sessionLaunchFooterExiting) {
          this.sessionLaunchFooterOffset = 0; this.sessionLaunchFooterExitProgress = 1;
          this.sessionLaunchFooterOpacity = 1;
        }
      });
  }

  private finishSessionCapsuleMorph(): void {
    if (this.sessionLaunchHoldTimer >= 0) clearTimeout(this.sessionLaunchHoldTimer);
    this.sessionLaunchHoldTimer = -1;
    const hadLaunch = this.sessionLaunch !== undefined;
    this.sessionLaunchExitGeneration += 1;
    this.sessionLaunchController.dispose();
    this.sessionLaunch = undefined;
    this.sessionLaunchFramePending = false;
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
    return this.mounted && !this.exitRequested && !this.controlVisible() && !this.controlObscured &&
      !this.interactionBlocked;
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
    return readerTextSelectionEnabled({
      configured: this.readerSettingsSnapshot.longPressSelectText,
      mounted: this.mounted,
      exitRequested: this.exitRequested,
      pageReady: this.phase === 'ready',
      controlVisible: this.controlVisible(),
      controlObscured: this.controlObscured,
      interactionBlocked: this.interactionBlocked,
      pageTurnActive: this.pageTurnOwnsReaderInput() ||
        readerRapidPageTurnHasWork(this.rapidPageTurnState),
      autoPageActive: this.automaticReadingState().status !== 'stopped',
      ttsActive: readerTtsSessionBlocksAutoPageStart(this.ttsState.status),
    });
  }

  private openReaderControl(): void {
    if (this.sessionLaunch !== undefined) { this.cancelSessionLaunch('openControl'); return; }
    if (!this.isControlInputEnabled() || !this.isReaderPageInteractionEnabled() || this.pageTurnOwnsReaderInput()) {
      return;
    }
    this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    // Prime the retained List before the show clock starts. If the TOC is
    // already admitted this prevents its first materialization from landing
    // on an animation frame; if it is still loading the flag is harmless and
    // the later admission supplies the stable projection.
    this.controlDirectoryDataRetained = true;
    this.invalidateControlBackdrop();
    this.controlOpenRevision += 1;
    this.controlSession = openReaderControlSession(this.controlSession, this.controlTiming().showDurationMs);
    void this.loadContentMetricsIfNeeded(this.lifecycleToken);
    this.refreshReaderBrightness();
  }

  private hideControl(): void {
    if (!this.controlVisible()) return;
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
    this.controlSession = dismissReaderControlSession(this.latestControlVisualSession ?? this.controlSession,
      this.controlTiming().dismissDurationMs);
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
      showDurationMs: this.reduceMotion ? 0 : READER_CONTROL_OPEN_MS,
      dismissDurationMs: this.reduceMotion ? 0 : READER_CONTROL_DISMISS_MS,
      morphDurationMs: this.reduceMotion ? 0 : READER_CONTROL_EXPAND_MS,
      // Module navigation has no admitted new visual choreography here.
      navigateDurationMs: 0,
    };
  }

  private isControlInputEnabled(): boolean {
    return readerControlHostInputEnabled({ mounted: this.mounted, exitRequested: this.exitRequested,
      appForeground: this.appForeground, windowChromeActive: this.windowChromeActive,
      interactionBlocked: this.interactionBlocked, controlObscured: this.controlObscured });
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
    if (!this.appForeground || this.interactionBlocked || this.controlObscured) this.cancelAutomaticPageStart?.();
    this.invalidateControlBackdrop();
    this.syncVolumeKeyPolicy();
  }

  private dismissControlTemporaryLayers(): void {
    this.dismissControlTemporaryRevision += 1;
    this.controlTemporaryLayer = false;
  }

  private onControlSessionChanged(): void {
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
        page !== 'quickSearch' && page !== 'fullSearch') this.quickSearchPublication.cancel();
      if (previous === 'quickReplace' && page !== 'quickReplace') this.replacePanelGeneration += 1;
    }
    const location = readerControlContentLocation(this.controlSession);
    const module = location.level === 'secondary' ? location.module : 'home';
    if (module !== this.observedControlModule) {
      this.controlModuleVisitRevision += 1;
      this.observedControlModule = module;
      this.prepareControlPage(page);
    }
    if (!readerControlHostCloseCommitted(this.controlSession, this.observedControlCloseRevision)) return;
    this.observedControlCloseRevision = this.controlSession.closeRevision;
    this.invalidateControlBackdrop();
    // A Stage-owned downward drag may commit without calling hideControl().
    if (readerControlKeyboardVisible(ReaderWindowCoordinator.metrics())) {
      hideReaderControlKeyboard(this.controlKeyboardHost());
    }
    this.dismissControlTemporaryLayers();
    this.quickSearchPublication.cancel();
    this.replacePanelGeneration += 1;
    this.quickSearchQuery = '';
    this.publishQuickSearchState({ kind: 'idle' });
    this.replaceState = createHiddenReaderReplaceQuickState();
    // Reading/TTS/auto-page/selection ownership is not reset by closing UI.
    if (this.mounted && !this.exitRequested) this.drainPageTurnPreparationQueue();
  }

  private admitSessionControlClosing(closing: boolean): void {
    // Drag dismissal is driven inside Panel. Publish only this ownership edge,
    // not every control frame, so an existing capsule can mount at first close.
    if (this.sessionControlClosing === closing) return;
    this.sessionControlClosing = closing;
    this.pageTurnRenderRevision += 1;
  }

  private expandControlDirectory(): void {
    if (!this.isControlInputEnabled() || readerControlContentLocation(this.controlMotionSession()).module !== 'directory') {
      return;
    }
    this.invalidateControlBackdrop();
    this.controlSession = expandReaderControlSession(this.controlMotionSession(), this.controlTiming().morphDurationMs);
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
      }, { tapMaxDurationMs: 500, touchSlopVp: 8 });
      this.controlBackdropState = result.state;
      if (result.shouldDismiss) { this.hideControl(); return; }
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
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
    this.chapterWindow.clear();
    this.knownContentVersions.splice(0, this.knownContentVersions.length);
    this.resetPaginationDraft();
    const page = this.visiblePage;
    if (page !== undefined) {
      void this.reloadMigratedContentPosition(lifecycleToken, this.bookId);
    }
  }

  private openQuickReplace(): void {
    if (!this.mounted || !this.controlVisible() || this.controlPage() !== 'home') {
      return;
    }
    this.replacePanelGeneration += 1;
    const sessionKey = `${this.sourceId}:${this.bookId}:${this.lifecycleToken}`;
    if (this.controlReplaceState.sessionKey !== sessionKey) {
      this.controlReplaceState = createReaderControlReplaceState(sessionKey, this.bookTitle, this.sourceId);
    }
    this.setControlPage('quickReplace');
    // A valid empty collection still opens: Full offers a real Add action.
    // A write already dispatched survives closure/reopen; never release its lock.
    if (!this.controlReplaceState.mutationPending) {
      void this.reloadControlReplace().catch((_error: Error): void => {});
    }
  }

  private controlReplaceCurrent(lifecycle: number, sourceId: string, bookId: string,
    panelGeneration: number): boolean {
    return this.isSessionActive(lifecycle) && this.sourceId === sourceId && this.bookId === bookId &&
      panelGeneration === this.replacePanelGeneration && this.controlVisible() &&
      readerControlContentLocation(this.controlSession).module === 'replace';
  }

  private async reloadControlReplace(): Promise<void> {
    const lifecycle = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    if (!this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration)) throw new Error('规则面板已关闭');
    const wasUncertain = this.controlReplaceState.writeUncertain;
    this.controlReplaceState = beginReaderControlReplaceLoad(this.controlReplaceState);
    const ticket = readerControlReplaceTicket(this.controlReplaceState);
    const isCurrent = (): boolean => this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration) &&
      readerControlReplaceTicketCurrent(this.controlReplaceState, ticket);
    try {
      const rules = await this.replaceGateway.loadRules(isCurrent);
      if (!isCurrent()) return;
      this.controlReplaceState = admitReaderControlReplaceLoad(this.controlReplaceState, ticket, rules);
      this.replaceState = createReaderReplaceQuickState(rules);
      if (wasUncertain) this.reloadCurrentPageAfterReplacePersist(lifecycle, bookId);
    } catch (error) {
      if (isCurrent()) {
        this.controlReplaceState = failReaderControlReplaceRequest(this.controlReplaceState, ticket,
          this.errorMessage(error));
      }
      if (error instanceof Error) throw error;
      throw new Error(this.errorMessage(error));
    }
  }

  /** A UI ticket protects presentation; the existing mutation owner protects
   * the original book even when the control closes after Core accepts a write. */
  private async runControlReplaceMutation(ruleId: number,
    action: (isCurrent: () => boolean) => Promise<ReaderControlReplaceCommit>): Promise<void> {
    const lifecycle = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    if (!this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration)) throw new Error('规则面板已关闭');
    const next = beginReaderControlReplaceMutation(this.controlReplaceState);
    const generation = this.beginReplaceMutation(lifecycle, bookId, ruleId);
    if (generation < 0) throw new Error('另一条规则正在保存，请等待完成');
    this.controlReplaceState = next;
    const ticket = readerControlReplaceTicket(next);
    const ownsWrite = (): boolean => this.sourceId === sourceId &&
      this.isReplaceMutationCurrent(generation, lifecycle, bookId, ruleId);
    const canDispatch = (): boolean => ownsWrite() &&
      this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration) &&
      readerControlReplaceTicketCurrent(this.controlReplaceState, ticket);
    let needsReload = false;
    try {
      const positionCurrent = await this.persistBeforeContentMutation();
      const canMutate = (): boolean => canDispatch() && positionCurrent();
      if (!canMutate()) throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      const commit = await action(canMutate);
      if (!ownsWrite()) return;
      if (commit.rule !== undefined) {
        this.controlReplaceState = admitReaderControlReplaceRule(this.controlReplaceState, ticket, commit.rule);
      } else if (commit.deletedId !== undefined) {
        this.controlReplaceState = admitReaderControlReplaceDeletion(this.controlReplaceState, ticket, commit.deletedId);
      } else {
        this.controlReplaceState = admitReaderControlReplaceImport(this.controlReplaceState, ticket);
      }
      if (this.controlVisible() && this.controlPage() === 'quickReplace') {
        this.replaceState = createReaderReplaceQuickState(this.controlReplaceState.rules);
      }
      needsReload = commit.needsReload;
      if (commit.changed) this.reloadCurrentPageAfterReplacePersist(lifecycle, bookId);
    } catch (error) {
      if (ownsWrite()) {
        const uncertain = error instanceof ReaderControlReplaceGatewayError && error.writeUncertain;
        this.controlReplaceState = failReaderControlReplaceRequest(this.controlReplaceState, ticket,
          this.errorMessage(error), uncertain);
        // An unconfirmed reply is not proof of no write. Re-materialize the
        // original book without retrying the mutation or claiming it succeeded.
        if (uncertain) this.reloadCurrentPageAfterReplacePersist(lifecycle, bookId);
      }
      if (error instanceof Error) throw error;
      throw new Error(this.errorMessage(error));
    } finally {
      this.finishReplaceMutation(generation, lifecycle, bookId, ruleId);
    }
    // A committed import belongs to this book, not the old presentation. The
    // same book's newly reopened panel must receive its own fresh canonical read.
    if (needsReload && this.controlReplaceCurrent(lifecycle, sourceId, bookId, this.replacePanelGeneration)) {
      await this.reloadControlReplace();
    }
  }

  private async saveControlReplace(draft: ReaderControlReplaceDraft): Promise<void> {
    await this.runControlReplaceMutation(draft.original?.id ?? -1,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const result = await this.replaceGateway.save(draft, isCurrent);
        return { rule: result.rule, changed: result.changed, needsReload: false };
      });
  }

  private async toggleControlReplace(rule: ReaderReplaceRule, enabled: boolean): Promise<void> {
    await this.runControlReplaceMutation(rule.id,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const result = await this.replaceGateway.toggle(rule, enabled, isCurrent);
        return { rule: result.rule, changed: result.changed, needsReload: false };
      });
  }

  private async deleteControlReplace(rule: ReaderReplaceRule): Promise<void> {
    await this.runControlReplaceMutation(rule.id,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const id = await this.replaceGateway.deleteRule(rule.id, isCurrent);
        return { deletedId: id, changed: true, needsReload: false };
      });
  }

  private async previewControlReplace(): Promise<ReaderReplacePreview> {
    const chapter = this.chapter;
    const lifecycle = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    const selection = this.chapterSelectionToken;
    if (chapter === undefined || !this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration)) {
      throw new Error('当前阅读章节不可用');
    }
    const preview = await this.replaceGateway.preview(sourceId, bookId, chapter.chapterIndex);
    if (!this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration) ||
      !this.isSelectionActive(lifecycle, selection) || this.chapter !== chapter) throw new Error('替换预览已过期');
    return preview;
  }

  private async importControlReplace(): Promise<void> {
    const lifecycle = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    if (!this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration)) throw new Error('规则面板已关闭');
    const document = await ReaderRuntimeOwner.current().selectRuleBundleJson();
    if (document === undefined) return;
    if (!this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration)) throw new Error('导入选择已过期');
    await this.runControlReplaceMutation(-2,
      async (isCurrent: () => boolean): Promise<ReaderControlReplaceCommit> => {
        const count = await this.replaceGateway.importJson(document.text, isCurrent);
        return { changed: count > 0, needsReload: true };
      });
  }

  private async exportControlReplace(): Promise<void> {
    const lifecycle = this.lifecycleToken;
    const sourceId = this.sourceId;
    const bookId = this.bookId;
    const panelGeneration = this.replacePanelGeneration;
    const isCurrent = (): boolean => this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration);
    if (!isCurrent()) throw new Error('规则面板已关闭');
    const json = await this.replaceGateway.exportJson(isCurrent);
    if (!isCurrent()) return;
    await ReaderRuntimeOwner.current().saveRuleBundleJson(json, 'reader-replace-rules.json');
  }

  private openRulesManagement(): void {
    if (!this.mounted || !this.controlVisible() || this.controlPage() !== 'quickReplace') {
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
          panelGeneration !== this.replacePanelGeneration || this.controlPage() !== 'quickReplace' ||
          this.chapter !== chapter) {
          return;
        }
        this.showReplacePreview(preview);
      })
      .catch((_error: Error): void => {
        if (this.isSelectionActive(lifecycleToken, selectionToken) &&
          panelGeneration === this.replacePanelGeneration && this.controlPage() === 'quickReplace') {
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
    if (!this.mounted || !this.controlVisible() || this.controlPage() !== 'quickReplace' ||
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
    void this.persistBeforeContentMutation().then((positionCurrent): Promise<ReaderReplaceRule> => {
      if (!positionCurrent() || !this.isReplaceMutationCurrent(mutationGeneration, lifecycleToken, bookId, ruleId)) {
        throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      }
      return this.replaceGateway.setRuleEnabled(ruleId, isEnabled);
    })
      .then((confirmed): void => {
        if (!this.isReplaceMutationCurrent(mutationGeneration, lifecycleToken, bookId, ruleId)) {
          return;
        }
        // Panel closure invalidates only presentation work. The already
        // accepted Core mutation must still invalidate processed metrics and
        // pagination for its original mounted book/session.
        if (panelGeneration === this.replacePanelGeneration && this.controlVisible() &&
          this.controlPage() === 'quickReplace') {
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
    this.paginationIndex.invalidateBook(this.sourceId, this.bookId);
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
      this.pageTurnPreparation !== undefined || this.pendingControlSelection !== undefined || gateway.hasPendingSourceSwitch()) {
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
      this.getUIContext().showAlertDialog({ title: '阅读位置恢复失败',
        message: '正文规则已更新，阅读位置尚未确认。请重试恢复。',
        confirm: { value: '重试恢复', action: (): void => { if (isCurrent()) void this.reloadMigratedContentPosition(lifecycleToken, bookId); } },
      });
    }
  }

  private claimReaderBrightness(): number {
    if (this.brightnessOwner === 0) {
      this.brightnessOwner = ReaderWindowCoordinator.brightness().claim();
    }
    return this.brightnessOwner;
  }

  private refreshReaderBrightness(): void {
    // Opening controls observes the window; it must not cancel a pending user intent.
    const generation = this.brightnessRequestGeneration;
    const owner = this.claimReaderBrightness();
    void ReaderWindowCoordinator.brightness().read(owner).then((result): void => {
      if (result.applied && this.mounted && generation === this.brightnessRequestGeneration &&
        this.brightnessAutomaticIntent === undefined) {
        this.admitReaderBrightness(result.value);
        this.brightnessRevision += 1;
        if (result.value < 0) this.refreshSystemBrightness(generation);
      }
    }).catch((error: Error): void => {
      hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness read failed: ${error.message}`);
    });
  }

  private readSystemBrightnessValue(): Promise<number | undefined> {
    if (this.systemBrightnessRead !== undefined) return this.systemBrightnessRead;
    try {
      const context = this.getUIContext().getHostContext();
      if (context === undefined) return Promise.resolve(undefined);
      const observation = settings.getValue(context, settings.display.SCREEN_BRIGHTNESS_STATUS)
        .then((raw: string): number | undefined => readerBrightnessSystemValue(raw))
        .catch((_error: Error): undefined => undefined);
      this.systemBrightnessRead = observation;
      void observation.then((): void => {
        if (this.systemBrightnessRead === observation) this.systemBrightnessRead = undefined;
      });
      return observation;
    } catch (_error) { return Promise.resolve(undefined); }
  }

  private refreshSystemBrightness(generation: number): void {
    void this.readSystemBrightnessValue().then((value: number | undefined): void => {
      if (value !== undefined && this.mounted && generation === this.brightnessRequestGeneration &&
        this.brightnessAutomatic && this.brightnessAutomaticIntent !== false) {
        this.brightnessPercent = readerBrightnessControlPercent(value);
        this.brightnessRevision += 1;
      }
    });
  }

  private setReaderBrightness(percent: number): void {
    if (!Number.isFinite(percent)) return;
    this.enqueueReaderBrightness(readerBrightnessWindowValue(percent), 'manual');
  }

  private setReaderAutomaticBrightness(): void {
    const automatic = this.brightnessAutomaticIntent ?? this.brightnessAutomatic;
    if (!automatic) { this.enqueueReaderBrightness(-1, 'automatic'); return; }
    // Do not jump to the initial/old rail position while the first system read
    // is pending. A second tap or manual drag invalidates this pending intent.
    const generation = ++this.brightnessRequestGeneration;
    this.brightnessAutomaticIntent = false;
    void this.readSystemBrightnessValue().then((value: number | undefined): void => {
      if (this.mounted && generation === this.brightnessRequestGeneration &&
        this.brightnessAutomaticIntent === false) {
        this.enqueueReaderBrightness(value ?? readerBrightnessWindowValue(this.brightnessPercent), 'manual');
      }
    });
  }

  private cancelReaderBrightness(): void {
    const generation = ++this.brightnessRequestGeneration;
    const owner = this.brightnessOwner;
    if (owner === 0) return;
    // Cancel removes only unsent pointer samples. The shared writer must first
    // account for an issued native call before the preview admits its final ACK.
    this.brightnessMutationQueue = ReaderWindowCoordinator.brightness().cancelAndSettle(owner)
      .then((result): void => {
        if (result.applied && this.mounted && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.admitReaderBrightness(result.value);
          this.brightnessRevision += 1;
        }
      }).catch((error: Error): void => {
        if (this.mounted && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness cancel failed: ${error.message}`);
          this.refreshReaderBrightness();
        }
      });
  }

  private enqueueReaderBrightness(target: number, mode: 'manual' | 'automatic'): void {
    this.brightnessAutomaticIntent = mode === 'automatic';
    const generation = ++this.brightnessRequestGeneration;
    const owner = this.claimReaderBrightness();
    // The window-wide writer merges pending samples while retaining an active
    // lookup/write. Request IDs only guard UI acknowledgements, not native work.
    this.brightnessMutationQueue = ReaderWindowCoordinator.brightness().request(owner, target)
      .then((result): void => {
        if (result.applied && this.mounted && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          this.admitReaderBrightness(result.value);
          this.brightnessRevision += 1;
          if (result.value < 0) this.refreshSystemBrightness(generation);
        }
      }).catch((error: Error): void => {
        if (this.mounted && generation === this.brightnessRequestGeneration) {
          this.brightnessAutomaticIntent = undefined;
          hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness ${mode} failed: ${error.message}`);
          this.refreshReaderBrightness();
        }
      });
  }

  private admitReaderBrightness(brightness: number): void {
    if (!Number.isFinite(brightness)) return;
    this.brightnessAutomatic = brightness < 0;
    if (brightness >= 0) {
      this.brightnessPercent = readerBrightnessControlPercent(brightness);
    }
  }

  private restoreInitialWindowBrightness(): void {
    this.brightnessRequestGeneration += 1;
    const owner = this.brightnessOwner;
    this.brightnessOwner = 0;
    if (owner === 0) return;
    this.brightnessMutationQueue = ReaderWindowCoordinator.brightness().release(owner)
      .then((): void => {}).catch((error: Error): void => {
        hilog.error(0x5244, 'Reader', '%{private}s', `Reader brightness exit restore failed: ${error.message}`);
      });
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
    const active = (): boolean => this.isSessionActive(lifecycleToken) && this.controlVisible() &&
      (this.controlPage() === 'quickSearch' || this.controlPage() === 'fullSearch');
    this.quickSearchPublication.run(this.activeGateway(), this.bookId, keyword, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, (): void => { this.quickSearchRevision += 1; });
  }

  private loadMoreQuickSearch(): void {
    const lifecycleToken = this.lifecycleToken;
    const active = (): boolean => this.isSessionActive(lifecycleToken) && this.controlVisible() &&
      (this.controlPage() === 'quickSearch' || this.controlPage() === 'fullSearch');
    this.quickSearchPublication.more(this.bookId, READER_CONTENT_SEARCH_PAGE_SIZE,
      active, (): void => { this.quickSearchRevision += 1; });
  }

  private selectSearchResult(result: ReadingContentSearchResult): void {
    if (result.bookId !== this.bookId || result.sourceId !== this.sourceId) {
      return;
    }
    this.selectBookmarkAnchor(result.chapterIndex, result.chapterOffset, result.positionScope);
  }

  private selectBookmarkAnchor(chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void {
    // A persisted nonzero offset cannot borrow the currently displayed body's
    // proof. Core supplies a scope only when its original owner is provable.
    // Chapter start remains invariant; local positions keep their own contract.
    let context: RemoteReadingPositionContext | undefined = undefined;
    try {
      if (this.sourceId !== LOCAL_READING_SOURCE_ID && chapterOffset > 0 && positionScope === undefined) {
        throw new Error('READING_POSITION_SCOPE_UNAVAILABLE');
      }
      context = this.positionContextForScope(positionScope, chapterIndex, chapterOffset);
    } catch (_) {
      try {
        this.getUIContext().getPromptAction().showToast({
          message: '该位置的正文版本暂时无法确认，已保留原书签和阅读位置，请从目录打开章节',
        });
      } catch (_) {}
      return;
    }
    this.clearTtsChapterEndTimer();
    this.selectChapterAnchor(chapterIndex, chapterOffset, false, true, undefined, -2, true, false, context);
  }

  private requestReadingDownload(chapterIndex?: number): void {
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
    if (this.pendingControlSelection === undefined && origin !== undefined &&
      chapterIndex === origin.committedProgress.chapterIndex) {
      // Only an already committed visible chapter can use this no-load path.
      // A newer chapter object may exist while it is still being measured.
      this.hideControl();
      return;
    }
    this.clearTtsChapterEndTimer();
    this.selectChapterAnchor(chapterIndex, 0, true);
  }

  private stepControlChapter(delta: number): void {
    if (!this.mounted || (delta !== -1 && delta !== 1)) return;
    const revision = ++this.entryCatalogSeekRevision;
    const target = this.adjacentChapterIndex(this.currentChapterIndex(), delta);
    if (target !== undefined) {
      this.clearTtsChapterEndTimer();
      this.selectChapterAnchor(target, 0, true);
    } else if (this.entryCatalogPending) {
      const lifecycleToken = this.lifecycleToken, selectionToken = this.chapterSelectionToken;
      const chapterIndex = this.currentChapterIndex(), controlRevision = this.controlOpenRevision;
      void this.hydrateEntryCatalog().then((): void => {
        if (revision !== this.entryCatalogSeekRevision || !this.isSelectionActive(lifecycleToken, selectionToken) ||
          this.entryCatalogPending || chapterIndex !== this.currentChapterIndex() ||
          controlRevision !== this.controlOpenRevision) return;
        this.stepControlChapter(delta);
      }).catch((error: Error): void => {
        hilog.warn(0x5244, 'Reader', 'Reading chapter step catalog: %{private}s', errorMessageOf(error));
      });
    }
  }

  private seekControlProgress(percent: number): void {
    if (this.entryCatalogPending) {
      const revision = ++this.entryCatalogSeekRevision;
      const lifecycleToken = this.lifecycleToken, selectionToken = this.chapterSelectionToken;
      void this.hydrateEntryCatalog().then((): void => {
        if (revision === this.entryCatalogSeekRevision && this.isSelectionActive(lifecycleToken, selectionToken) && !this.entryCatalogPending)
          this.seekControlProgress(percent);
      }).catch((error: Error): void => { hilog.warn(0x5244, 'Reader', 'Reading seek catalog: %{private}s', errorMessageOf(error)); });
      return;
    }
    const metrics = this.contentMetrics;
    if (!this.mounted) {
      return;
    }
    if (metrics !== undefined) {
      const anchor = wholeBookAnchorForPercent(metrics, percent);
      if (anchor !== undefined) {
        this.clearTtsChapterEndTimer();
        this.selectChapterAnchor(anchor.chapterIndex, anchor.chapterOffset, false, true, undefined, -2, false);
      }
      return;
    }
    if (this.readingTocEntries().length === 0 || !Number.isFinite(percent)) {
      return;
    }
    const normalized = Math.max(0, Math.min(1, percent / 100));
    const scaled = normalized >= 1 ? this.readingTocEntries().length : normalized * this.readingTocEntries().length;
    const position = Math.min(this.readingTocEntries().length - 1, Math.floor(scaled));
    const chapterProgress = normalized >= 1 ? 1 : scaled - position;
    this.clearTtsChapterEndTimer();
    this.selectChapterAnchor(this.readingTocEntries()[position].index, 0, false, true, chapterProgress, -2, false);
  }

  private canRefreshCurrentChapter(): boolean {
    return this.isControlInputEnabled() && this.phase === 'ready' && this.visiblePage !== undefined &&
      this.chapter !== undefined && !this.pageTurnSettlementActive && !this.pageTurnInputOwned;
  }

  private refreshCurrentChapter(): void {
    if (!this.canRefreshCurrentChapter()) return;
    const page = this.visiblePage;
    const chapter = this.chapter;
    if (page === undefined || chapter === undefined) return;
    this.pauseAutoPage('touch');
    // Existing selection keeps the committed display/recovery origin until a
    // new page is admitted. Bypass only the target body read, never clear data.
    this.selectChapterAnchor(chapter.chapterIndex, page.startScalar, false, true, undefined, -2, false, true);
  }

  private positionContextForScope(scope: RemoteReadingPositionScope | undefined,
    chapterIndex: number, offset: number): RemoteReadingPositionContext | undefined {
    if (scope === undefined) return undefined;
    if (scope.sourceId !== this.sourceId || scope.bookId !== this.bookId || scope.chapterIndex !== chapterIndex) {
      throw new Error('READING_POSITION_SCOPE_MISMATCH');
    }
    return { bodyVersion: scope.bodyVersion, processingVersion: scope.processingVersion,
      anchors: [{ id: 'requested', offset }] };
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
    if (ttsOwner !== undefined && !this.isTtsFollowLeaseCurrent(ttsOwner)) return;
    if (ttsOwner === undefined) this.invalidateTtsPageFollow?.();
    if (!this.mounted || !Number.isSafeInteger(chapterIndex) || chapterIndex < 0) return;
    if (!this.isKnownControlChapter(chapterIndex)) {
      if (this.entryCatalogPending) {
        const revision = ++this.entryCatalogSeekRevision;
        const lifecycleToken = this.lifecycleToken, selectionToken = this.chapterSelectionToken;
        const ownerRevision = controlOwnerRevision === -2 ?
          (this.controlVisible() && !this.controlShellExitArmed() ? this.controlOpenRevision : -1) : controlOwnerRevision;
        void this.hydrateEntryCatalog().then((): void => {
          if (revision !== this.entryCatalogSeekRevision || !this.isSelectionActive(lifecycleToken, selectionToken) ||
            this.entryCatalogPending ||
            (ownerRevision >= 0 && ownerRevision !== this.controlOpenRevision)) return;
          this.selectChapterAnchor(chapterIndex, chapterOffset, requireChapterStart, stopTts,
            requestedProgress, ownerRevision, closeControlOnCommit, refreshContent, positionContext, ttsOwner);
        }).catch((error: Error): void => {
          hilog.warn(0x5244, 'Reader', 'Reading selection catalog: %{private}s', errorMessageOf(error));
        });
      }
      return;
    }
    const existing = this.chapterWindow.get(chapterIndex);
    if (positionContext === undefined && requestedProgress === undefined && existing?.bodyVersion !== undefined &&
      existing.processingVersion !== undefined) positionContext = { bodyVersion: existing.bodyVersion,
        processingVersion: existing.processingVersion, anchors: [{ id: 'requested', offset: requireChapterStart ? 0 : chapterOffset }] };
    const selectionControlRevision = controlOwnerRevision === -2 ?
      (this.controlVisible() && !this.controlShellExitArmed() ? this.controlOpenRevision : -1) :
      controlOwnerRevision;
    if (this.pageTurnSettlementActive) {
      this.pageTurnPendingChapterSelection = new ReaderDeferredChapterSelection(
        chapterIndex,
        chapterOffset,
        requireChapterStart,
        stopTts,
        requestedProgress,
        selectionControlRevision,
        closeControlOnCommit,
        refreshContent, positionContext, ttsOwner,
      );
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    const origin = selectionControlRevision >= 0 ? this.captureControlSelectionOrigin() : undefined;
    const coordinator = this.ttsCoordinator;
    if (stopTts && coordinator !== undefined) {
      void coordinator.stop('contentChanged').catch((error: Error): void => this.logTtsFailure('content stop', error));
    }
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    this.pendingControlSelection = selectionControlRevision < 0 ? undefined : {
      sourceId: this.sourceId,
      bookId: this.bookId,
      lifecycleToken,
      selectionToken,
      controlOpenRevision: selectionControlRevision,
      targetChapterIndex: chapterIndex,
      closeOnCommit: closeControlOnCommit,
      refreshContent,
    };
    this.pendingControlSelectionOrigin = origin;
    this.pendingControlSelectionCandidate = undefined;
    this.pendingControlSelectionRetry = new ReaderDeferredChapterSelection(chapterIndex, chapterOffset,
      requireChapterStart, stopTts, requestedProgress, selectionControlRevision, closeControlOnCommit, refreshContent, positionContext, ttsOwner);
    this.controlSelectionReconciliationInFlight = false;
    this.resetForChapterSelection(false, ttsOwner !== undefined);
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(
      chapterIndex,
      false,
      lifecycleToken,
      selectionToken,
      requireChapterStart ? 0 : (requestedProgress === undefined ? chapterOffset : undefined),
      requestedProgress,
      refreshContent, positionContext,
    );
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
    // Several selections may race while the first has already replaced its
    // measurement context. Preserve the original committed display, not an
    // uncommitted intermediate chapter that happens to have loaded sooner.
    const ticket = this.pendingControlSelection;
    if (ticket !== undefined && ticket.sourceId === this.sourceId && ticket.bookId === this.bookId &&
      ticket.lifecycleToken === this.lifecycleToken && ticket.selectionToken === this.chapterSelectionToken) {
      return this.pendingControlSelectionOrigin;
    }
    return undefined;
  }

  private completeControlSelectionAfterCommit(
    stored: LocalReadingProgress,
    page: PhysicalReadingPage,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    const ticket = this.pendingControlSelection;
    if (ticket === undefined || ticket.selectionToken !== selectionToken || ticket.lifecycleToken !== lifecycleToken) return;
    const mayClose = readerControlSelectionMayClose(ticket, this.controlSelectionOwner(), {
      phaseReady: this.phase === 'ready',
      materializedSelectionToken: this.materializedChapterSelectionToken,
      visibleSelectionToken: this.visiblePageSelectionToken,
      visibleChapterIndex: this.chapter?.chapterIndex ?? -1,
      visiblePageStartScalar: page.startScalar,
      storedChapterIndex: stored.chapterIndex,
      storedChapterOffset: stored.chapterOffset,
    });
    this.pendingControlSelection = undefined;
    this.pendingControlSelectionOrigin = undefined;
    this.pendingControlSelectionCandidate = undefined;
    this.pendingControlSelectionRetry = undefined;
    this.controlSelectionReconciliationInFlight = false;
    // List/search selection closes only after commit. Slider scrubbing owns
    // the same recoverable transaction but deliberately keeps its panel open.
    if (mayClose) this.hideControl();
  }

  private recoverControlSelectionFailure(error: Error, lifecycleToken: number): boolean {
    const ticket = this.pendingControlSelection;
    if (ticket === undefined || ticket.lifecycleToken !== lifecycleToken ||
      !readerControlSelectionOwnsReading(ticket, this.controlSelectionOwner())) return false;
    if (this.controlSelectionReconciliationInFlight) return true;
    // Invalidate all failed load/measurement continuations, but retain BOTH
    // display contexts and their resources until the serialized Core read says
    // which location actually committed. A timeout is not a rollback receipt.
    this.chapterSelectionToken += 1;
    const recoveryTicket: ReaderControlSelectionTicket = {
      sourceId: ticket.sourceId, bookId: ticket.bookId, lifecycleToken: ticket.lifecycleToken,
      selectionToken: this.chapterSelectionToken, controlOpenRevision: ticket.controlOpenRevision,
      targetChapterIndex: ticket.targetChapterIndex,
      closeOnCommit: ticket.closeOnCommit,
      refreshContent: ticket.refreshContent,
    };
    this.pendingControlSelection = recoveryTicket;
    this.controlSelectionReconciliationInFlight = true;
    this.resetForChapterSelection();
    this.failureCode = this.errorMessage(error);
    void this.reconcileFailedControlSelection(recoveryTicket, error).catch((recoveryError: Error): void => {
      if (this.pendingControlSelection !== recoveryTicket ||
        !readerControlSelectionOwnsReading(recoveryTicket, this.controlSelectionOwner())) return;
      this.controlSelectionReconciliationInFlight = false;
      this.lastCommittedProgress = undefined;
      this.phase = 'loading';
      this.showControlSelectionFailure(recoveryTicket, error,
        `位置核实或画面恢复未完成：${this.errorMessage(recoveryError)}`);
    });
    return true;
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

  private async reconcileFailedControlSelection(ticket: ReaderControlSelectionTicket, error: Error): Promise<void> {
    const gateway = this.activeGateway();
    const isCurrent = (): boolean => this.pendingControlSelection === ticket &&
      readerControlSelectionOwnsReading(ticket, this.controlSelectionOwner());
    const result = await reconcileReaderControlSelectionProgress({
      isCurrent: isCurrent,
      runSerial: (operation: () => Promise<void>): Promise<void> => gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<ReaderControlSelectionStoredProgress | undefined> => {
        const state = await gateway.loadProgress(ticket.bookId, isCurrent);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    if (!isCurrent() || result.kind === 'obsolete') return;
    this.controlSelectionReconciliationInFlight = false;
    const origin = this.pendingControlSelectionOrigin;
    const target = this.pendingControlSelectionCandidate;
    const action = readerControlSelectionRecoveryAction(result,
      this.selectionDisplayAnchor(origin), this.selectionDisplayAnchor(target));
    const display: ReaderControlSelectionDisplay | undefined = action === 'target' ? target :
      (action === 'origin' ? origin : undefined);
    const stored = result.progress;
    if (display === undefined || stored === undefined ||
      display.layoutSignature !== this.paginationLayoutSignature() ||
      display.continuous !== (this.readerSettingsSnapshot.navigationMode === 'continuous')) {
      if (stored !== undefined && await this.recoverRefreshedChapterDisplay(ticket, stored)) return;
      // Do not mark the stale body/old lastCommittedProgress authoritative.
      // The existing control remains available; explicit retry creates a new
      // selection and may supersede this reconciliation without exiting reader.
      this.lastCommittedProgress = undefined;
      this.phase = 'loading';
      const detail = result.kind === 'verified' ? '已保存位置与当前保留画面不同' :
        `无法核实已保存位置：${result.errorCode}`;
      this.showControlSelectionFailure(ticket, error, detail);
      return;
    }
    this.restoreMaterializedChapterContext(display.context, true);
    this.visiblePage = display.page;
    this.visiblePageSelectionToken = this.chapterSelectionToken;
    this.visibleFragments = display.page.fragments;
    this.chapterTitle = display.context.chapter.chapterTitle;
    this.desiredChapterOffset = stored.chapterOffset;
    this.desiredChapterProgress = stored.chapterProgress;
    this.showChapterTitle = this.isChapterFirstPageStart(stored.chapterOffset);
    if (display.continuous) {
      this.rebuildContinuousFragments();
      this.setContinuousInitialAnchor(stored.chapterOffset);
    }
    this.phase = 'ready';
    this.schedulePageTurnPreparation();
    this.admitCommittedProgress(stored);
    if (action === 'target') {
      this.completeControlSelectionAfterCommit(stored, display.page,
        ticket.selectionToken, ticket.lifecycleToken);
    } else {
      this.pendingControlSelection = undefined;
      this.pendingControlSelectionOrigin = undefined;
      this.pendingControlSelectionCandidate = undefined;
      // Keep the captured retry request for the error dialog only.
      this.showControlSelectionFailure(ticket, error, '已核实并保留原阅读位置');
    }
    if (!this.notifyControlSelectionReadingReady(stored.chapterIndex, display.context.chapter.chapterTitle,
      display.page, ticket.selectionToken, ticket.lifecycleToken)) return;
    this.releaseUnretainedReadingImages();
  }

  private async recoverRefreshedChapterDisplay(ticket: ReaderControlSelectionTicket,
    stored: ReaderControlSelectionStoredProgress): Promise<boolean> {
    const retry = this.pendingControlSelectionRetry;
    const previous = retry?.positionContext;
    if (retry?.refreshContent !== true || previous === undefined ||
      stored.bookId !== ticket.bookId || stored.chapterIndex !== ticket.targetChapterIndex ||
      stored.bodyVersion === undefined || stored.processingVersion === undefined ||
      (stored.bodyVersion === previous.bodyVersion && stored.processingVersion === previous.processingVersion) ||
      !readerControlSelectionOwnsReading(ticket, this.controlSelectionOwner())) return false;
    // The serialized read proves Core already published replacement content.
    // Retrying forceRefresh with the predecessor's scope can only fail again.
    // Re-read that committed body and measure its actual saved position once;
    // the non-refresh retry prevents an automatic recovery loop if layout fails.
    const context: RemoteReadingPositionContext = { bodyVersion: stored.bodyVersion,
      processingVersion: stored.processingVersion,
      anchors: [{ id: 'requested', offset: stored.chapterOffset }] };
    this.pendingControlSelectionRetry = new ReaderDeferredChapterSelection(stored.chapterIndex,
      stored.chapterOffset, false, retry.stopTts, undefined, retry.controlOwnerRevision,
      retry.closeControlOnCommit, false, context);
    await this.openChapter(stored.chapterIndex, false, ticket.lifecycleToken, ticket.selectionToken,
      stored.chapterOffset, undefined, false, context);
    return true;
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
    try { this.onReadingReady(chapter.chapterIndex); }
    catch (error) { hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience ready observer failed: ${this.errorMessage(error as Error)}`); }
    if (!isCurrent()) return false;
    this.ttsFollowPositioning = undefined;
    this.scheduleTtsPageFollowResume?.();
    try { this.scheduleTtsPresentationWarmup(); }
    catch (error) { hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience TTS warmup scheduling failed: ${this.errorMessage(error as Error)}`); }
    return isCurrent();
  }

  private showControlSelectionFailure(ticket: ReaderControlSelectionTicket, error: Error, detail: string): void {
    this.failureCode = this.errorMessage(error);
    this.finishPageTurnPerf('failed');
    const retry = this.pendingControlSelectionRetry;
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience control selection failed: ${this.failureCode}; ${detail}`);
    this.getUIContext().showAlertDialog({
      title: ticket.refreshContent === true ? '刷新本章失败' : '跳转失败',
      message: ticket.refreshContent === true ? `${this.failureCode}\n${detail}。可重试恢复本章，原书签和记录仍保留。` :
        `${this.failureCode}\n${detail}。可重试本次选择，或关闭提示后重新选择章节。`,
      primaryButton: { value: '重试', action: (): void => {
        if (retry === undefined || !readerControlSelectionOwnsReading(ticket, this.controlSelectionOwner())) return;
        this.selectChapterAnchor(retry.chapterIndex, retry.chapterOffset, retry.requireChapterStart,
          retry.stopTts, retry.requestedProgress, retry.controlOwnerRevision, retry.closeControlOnCommit, retry.refreshContent, retry.positionContext, retry.ttsOwner);
      } },
      secondaryButton: { value: '关闭提示', action: (): void => {} },
    });
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
    return this.adjacentMeasurementContext === undefined ? this.paragraphRanges : this.adjacentMeasurementContext.paragraphRanges;
  }
  private measuringDraft(): ReadingPaginationPrefix | undefined {
    return this.adjacentMeasurementContext === undefined ? this.paginationDraft : this.adjacentMeasurementContext.paginationDraft;
  }
  private setMeasuringDraft(value: ReadingPaginationPrefix | undefined): void {
    if (this.adjacentMeasurementContext === undefined) this.paginationDraft = value;
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
    return this.adjacentMeasurementContext === undefined ? this.measurementRequestedAnchorScalar : this.adjacentMeasurementContext.measurementRequestedAnchorScalar;
  }
  private setMeasuringRequestedAnchor(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.measurementRequestedAnchorScalar = value;
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
  private invalidatePageTurnRuntime(
    restorePreparation: boolean,
    preserveRapidPageTarget: boolean = false,
    preserveTtsFollow: boolean = false,
  ): void {
    this.ordinaryPageMeasurementSelection = -1;
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
    this.pageTurnPreparationQueue = [];
    if (!preserveRapidPageTarget) {
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
    }
    this.pendingPointerSegmentReserved = false;
    this.autoPageCoordinator.cancelPendingTurn();
    this.preparedPreviousPage = undefined;
    this.preparedNextPage = undefined;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnAnimationFinished = false;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
    this.pageTurnSettlementLayout = undefined;
    this.pageTurnSettlementActive = false;
    this.pageTurnPresentationPhase = 'idle';
    this.pageTurnPersistenceState = 'idle';
    this.pageTurnUnknownNotifiedGeneration = -1;
    this.bookTurn2DFallbackPending = false;
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
    if (this.bookmarkMutationConfirmed) this.reconcilePageBookmarkFeedback();
    this.bookTurnTextureCaptureGeneration += 1;
    this.bookTurnTextureCaptureScheduled = false;
    this.clearBookTurnCapturedIdentities();
    this.releaseBookTurnTextureContent();
    this.releaseBookTurnPendingSnapshot();
    this.pageTurnRenderRevision += 1;
    if (preparation === undefined && discovery === undefined) {
      this.releaseUnretainedReadingImages();
      return;
    }

    this.paginationIndex.invalidateMeasurement();
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
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
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience page-turn preparation failed: ${this.errorMessage(error)}`);
    this.pageTurnPreparation = undefined;
    this.paginationIndex.invalidateMeasurement();
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.measurementBatch.length = 0;
    this.resetPendingPage();
    this.cancelMeasurementDeadline();
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
    this.pageTurnPreparationQueue = readerPageTransitionUsesPreparedPages(this.readerSettingsSnapshot) ?
      [this.preferredPageTextureDirection, this.preferredPageTextureDirection === 'next' ? 'previous' : 'next'] : [];
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
      lane.paginationDraft.matches(this.currentPaginationKey())) this.paginationDraft = lane.paginationDraft;
    this.adjacentMeasurementContext = undefined;
  }

  private resumePagePreparationAfterTextureFrame(): void {
    this.bookTurnTextureCaptureGeneration += 1;
    const generation = this.pageTurnGeneration;
    // Capture the ready current/requested pages before measuring the other direction.
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.mounted || generation !== this.pageTurnGeneration) return;
      void this.refreshBookTurnTextures(this.bookTurnTextureCaptureGeneration).finally((): void => {
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
    this.paginationIndex.invalidateMeasurement();
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.nativeTextMeasurement.clear();
    this.measurementBatch.length = 0;
    this.resetPendingPage();
    this.cancelMeasurementDeadline();
    this.measurementEpoch += 1;
    this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
    if (this.pageTurnPreparationQueue.indexOf(direction) < 0) this.pageTurnPreparationQueue.unshift(direction);
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
    this.pageTurnPreparationQueue = this.pageTurnPreparationQueue.filter(
      (value: ReaderPageTurnDirection): boolean => value !== direction);
    this.pageTurnPreparationQueue.unshift(direction);
    this.drainPageTurnPreparationQueue();
    this.scheduleBookTurnTextureRefresh();
  }

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
    if (this.sessionLaunchRenderWorkBlocked()) return;
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
      if (target === undefined && this.chapter !== undefined && this.isUnknownCatalogEdge(this.chapter.chapterIndex, direction)) {
        this.requestCatalogForTurn();
        return;
      }
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
      const draft = this.paginationDraft;
      const knownNext = draft?.matches(this.currentPaginationKey()) === true ?
        draft.nextRequestForPageStart(page.startScalar) : undefined;
      if (knownNext !== undefined) return new ReaderPageTurnTarget(chapter.chapterIndex, knownNext);
      const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
      if (page.endScalar <= lastVisible) {
        return new ReaderPageTurnTarget(chapter.chapterIndex, page.endScalar);
      }
      const nextChapter = this.adjacentChapterIndex(chapter.chapterIndex, 1);
      return nextChapter === undefined ? undefined : new ReaderPageTurnTarget(nextChapter, 0);
    }

    const key = this.currentPaginationKey();
    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const observed = this.paginationDraft?.matches(key) === true ?
      this.paginationDraft.observationForPageStart(page.startScalar) : undefined;
    const indexed = this.paginationIndex.findContainingPage(key, page.startScalar);
    const containingPage = indexed?.startScalar === page.startScalar && indexed.endScalarExclusive === page.endScalar ? indexed : undefined;
    if (observed !== undefined) {
      const previousRequest = this.paginationDraft?.previousRequestForPageStart(page.startScalar);
      if (previousRequest !== undefined) return new ReaderPageTurnTarget(chapter.chapterIndex, previousRequest);
    }
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
    const head = this.paragraphRanges[0].startScalar;
    const previousChapter = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    if (this.requireChapterLayoutMap().residentStart() === 0 && page.startScalar <= head) {
      if (previousChapter === undefined) return false;
      if (this.chapterWindow.get(previousChapter) === undefined) {
        this.requestPageTurnChapter('previous', previousChapter); return true;
      }
      const pending = new PreviousChapterMeasurement(chapter.chapterIndex, page.startScalar,
        chapter.chapterIndex, true, this.captureMaterializedChapterContext(), this.pageTurnGeneration);
      this.continuePreviousChapterPreparation(pending, previousChapter);
      return this.phase === 'measuring';
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
      this.bookTurnCapturedIdentity(BOOK_TURN_TEXTURE_CURRENT) === current.textureIdentity &&
      this.bookTurnCapturedIdentity(direction === 'next' ?
        BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS) === adjacent.textureIdentity &&
      this.bookTurnSession.canStart(direction);
    if (ready) this.pageTurnAdmittedPrepared = prepared;
    return ready;
  }

  private canStartReaderBookmarkGesture(): boolean {
    return this.canTurnPage() && this.currentPageBookmarkStatus() !== 'unknown' &&
      !(this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === this.pageBookmarkFeedbackAnchor());
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
    if (this.activePagePointerId >= 0 || !this.isReaderPageInteractionEnabled()) return false;
    this.activePagePointerId = pointerId;
    this.invalidateTtsPageFollow?.();
    this.cancelAutomaticPageStart?.();
    this.pagePointerEpoch += 1;
    return true;
  }

  private regrabPageTurn(width: number, height: number, x: number, y: number, time: number): ReaderPageGestureState | undefined {
    if (!this.pageTurnSettlementActive || this.pageTurnCommitStarted ||
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
    this.cancelPageTurnSettlementDeadline();
    this.pageTurnSettlementGeneration += 1;
    this.pageTurnSettlementActive = false;
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnCommitFinished = false;
    this.pageTurnCommitSucceeded = false;
    // Remove only the replaced release intent. Older queued requests remain
    // blocked by the live physical pointer until its new terminal decision.
    this.completeRapidPageTurnTransaction(direction);
    this.pageTurnPresentationPhase = 'tracking';
    return resumeReaderPagePan(direction, offset, width, height, x, y, time);
  }

  private releasePagePointer(pointerId: number): void {
    if (this.activePagePointerId !== pointerId) return;
    this.activePagePointerId = -1;
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
        const offset = state.verticalPrevious ? Math.max(0, -state.currentOffsetY) : state.currentOffsetX;
        this.pageTurnOffsetX = this.clampedPageTurnOffset(state.direction, offset);
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
      if (state.phase === 'idle' && this.pageTurnPreparationQueue.length > 0) {
        this.drainPageTurnPreparationQueue();
      }
    }
  }

  private onReaderBookmarkGestureStateChanged(state: ReaderPageGestureState): void {
    if (state.owner !== 'bookmark') return;
    if (state.phase !== 'settling') this.bookmarkRollbackGeneration += 1;
    this.bookmarkPageOffsetY = state.bookmarkOffsetY;
    this.bookmarkPreviewChanged = state.bookmarkPreviewChanged;
  }

  private onReaderBookmarkGestureReleased(changed: boolean): void {
    if (changed) this.toggleCurrentPageBookmark();
    const generation = ++this.bookmarkRollbackGeneration;
    if (this.reduceMotion) { this.finishBookmarkRollback(generation); return; }
    this.getUIContext().animateTo(
      motionAnimateParam('reader.bookmark.rollback', (): void => this.finishBookmarkRollback(generation)),
      (): void => {
        this.bookmarkPageOffsetY = 0;
      },
    );
  }

  private finishBookmarkRollback(generation: number): void {
    if (generation !== this.bookmarkRollbackGeneration || !this.mounted) return;
    this.bookmarkPageOffsetY = 0;
    this.bookmarkPreviewChanged = false;
    this.reconcilePageBookmarkFeedback();
    if (this.pageTurnGestureState.owner !== 'bookmark') return;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    this.pageTurnInputOwned = false;
    this.flushDeferredPageChromeState();
    if (this.appForeground && !this.exitRequested) this.drainPageTurnPreparationQueue();
  }

  private currentPageBookmarkStatus(): 'unknown' | 'empty' | 'bookmarked' {
    const page = this.visiblePage;
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

  private pageBookmarkFeedbackAnchor(): string {
    const page = this.visiblePage;
    return page === undefined ? '' : `${this.sourceId}:${this.bookId}:${this.currentChapterIndex()}:${this.chapter?.contentVersion}:${this.chapter?.bodyVersion}:${this.chapter?.processingVersion}:${page.startScalar}:${page.endScalar}`;
  }

  private pageBookmarkFeedbackFilled(): boolean {
    if (this.bookmarkPendingTarget.length > 0 && this.bookmarkPendingAnchor === this.pageBookmarkFeedbackAnchor()) {
      return this.bookmarkPendingTarget === 'bookmarked';
    }
    const bookmarked = this.currentPageBookmarkStatus() === 'bookmarked';
    return this.bookmarkPreviewChanged ? !bookmarked : bookmarked;
  }

  private reconcilePageBookmarkFeedback(): void {
    if (!this.bookmarkMutationConfirmed || this.bookmarkPendingTarget.length === 0) return;
    if (this.bookmarkPendingAnchor !== this.pageBookmarkFeedbackAnchor() ||
      (!this.bookmarkPreviewChanged && this.currentPageBookmarkStatus() === this.bookmarkPendingTarget)) {
      // Keep the released target through rebound. Once the canonical write
      // arrives, applying the still-active drag preview would invert it twice.
      this.bookmarkPendingTarget = '';
      this.bookmarkMutationConfirmed = false;
    }
  }

  private bookmarkCornerLayout(): ReaderPageChromeLayoutSnapshot {
    const layout = this.readingLayout();
    const context = this.getUIContext();
    const topStyle = readerPageChromeTopTextStyle(layout, context);
    const clock = measureReaderPageChromeText(this.pageChromeClockText,
      topStyle, layout, context);
    const title = measureReaderPageChromeText(this.bookTitle,
      topStyle, layout, context);
    return resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(
      title.width, title.height, clock.width, clock.height, 0, 0, 0, 0, false, 0, 0,
      READER_PAGE_CHROME_BOOKMARK_SIZE, READER_PAGE_CHROME_BOOKMARK_SIZE));
  }

  private bookmarkFeedbackLabel(): string {
    if (this.bookmarkPageOffsetY <= 0) return '本页已添加书签';
    return this.bookmarkPreviewChanged ? (this.currentPageBookmarkStatus() === 'bookmarked' ?
      '松手移除书签' : '松手添加书签') : '取消书签操作';
  }

  @Builder
  private bookmarkCornerFeedback() {
    // A dedicated top-info slot shares the page chrome's measured clock,
    // safe/cutout geometry. Never overlay a hint on the title or the clock.
    if (!this.controlVisible() && !this.controlObscured &&
      (this.bookmarkPageOffsetY > 0 || this.pageBookmarkFeedbackFilled())) {
      Image(this.pageBookmarkFeedbackFilled() ? (this.readerAppScheme === 'night' ?
        $r('app.media.reader_page_bookmark_filled_theme_night') : $r('app.media.reader_page_bookmark_filled')) :
        (this.readerAppScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') :
          $r('app.media.reader_directory_marker_bookmark_active')))
        .width(this.bookmarkCornerLayout().topAccessoryWidth)
        .height(this.bookmarkCornerLayout().topAccessoryHeight)
        .position({ x: this.bookmarkCornerLayout().topAccessoryX, y: this.bookmarkCornerLayout().topAccessoryY })
        .opacity(this.bookmarkPageOffsetY > 0 && !this.bookmarkPreviewChanged ? 0.35 : 1)
        .accessibilityText(this.bookmarkFeedbackLabel())
        .zIndex(9).hitTestBehavior(HitTestMode.None);
    }
  }

  private currentPageBookmarkText(): string {
    const page = this.visiblePage;
    const chapter = this.chapter;
    const map = this.chapterLayoutMap;
    if (page === undefined || chapter === undefined || map === undefined) return '';
    return chapter.content.substring(map.utf16ForScalar(page.startScalar),
      map.utf16ForScalar(Math.min(page.endScalar, page.startScalar + 160)));
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
    this.bookmarkPendingAnchor = anchor;
    this.bookmarkMutationConfirmed = false;
    this.bookmarkPendingTarget = bookmarkTimes.length > 0 ? 'empty' : 'bookmarked';
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
        this.bookmarkMutationConfirmed = success;
        if (!success) { this.bookmarkPendingTarget = ''; this.bookmarkPreviewChanged = false; }
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
    if (this.pageTurnSettlingPrepared !== undefined) return;
    if (this.pageTurnSettlementLayout === undefined) {
      this.pageTurnSettlementLayout = this.readingLayout();
    }
    this.pageTurnSettlementActive = true;
    this.pageTurnPresentationPhase = 'rollback';
    this.pageTurnInputOwned = true;
    this.pageTurnCommitStarted = false;
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
    this.cancelPageTurnSettlementDeadline();
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
    this.pageTurnCommitStarted = false;
    this.bookTurnMotion = undefined;
    this.bookTurnAwaitingSlotCommit = false;
    this.bookmarkPageOffsetY = 0;
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
        this.bookTurnSession.endGesture(bookTurnInput(this.bookTurnMotion), true) :
        this.bookTurnSession.startProgrammatic(settlementGeneration, direction, origin !== 'manual' ?
          BOOK_TURN_PROFILE_AUTOMATIC : (Math.abs(this.rapidPageTurnState.pendingDelta) > 1 ?
            BOOK_TURN_PROFILE_RAPID : BOOK_TURN_PROFILE_MANUAL));
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
    }
    return true;
  }

  private beginPreparedPageTurnPersistence(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): void {
    if (this.pageTurnCommitStarted || settlementGeneration !== this.pageTurnSettlementGeneration) return;
    if (this.canPresentOrdinaryPage(prepared.context.chapter) &&
      this.isPreparedPageTurnCommitCurrent(prepared, lifecycleToken, settlementGeneration)) {
      // A qualified ordinary page owns presentation independently of its CAS
      // receipt. Native slots and ArkUI still complete the same handoff before
      // input is released; the shared owner retains any unknown write.
      this.pageTurnCommitStarted = true;
      this.pageTurnCommitFinished = true;
      this.pageTurnCommitSucceeded = true;
      this.pageTurnPersistenceState = 'queued';
      void this.persistPresentedPageTurn(prepared, lifecycleToken);
      this.finishPreparedPageTurnSettlement(settlementGeneration, true);
      return;
    }
    this.pageTurnCommitStarted = true;
    this.pageTurnPersistenceState = 'queued';
    const operation = this.persistPreparedPageTurn(prepared, lifecycleToken, settlementGeneration)
      .then((succeeded: boolean | undefined): void => {
        this.admitPageTurnPersistenceOutcome(prepared, lifecycleToken, settlementGeneration, succeeded);
      });
    // UI observation has a deadline; the actual operation and serialized lane
    // retain ownership until they settle. A late success still admits once.
    void observeReaderProgressOperation(operation).then((result: 'completed' | 'unknown'): void => {
      if (result === 'unknown') this.admitPageTurnPersistenceOutcome(prepared, lifecycleToken, settlementGeneration, undefined);
    }).catch((): void => {
      this.admitPageTurnPersistenceOutcome(prepared, lifecycleToken, settlementGeneration, undefined);
    });
  }

  private canPresentOrdinaryPage(chapter: ReadingSessionChapter): boolean {
    return this.sourceSwitchTransactionId === undefined && this.pendingControlSelection === undefined &&
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
    try {
      const stored = await this.activeGateway().persistPresentedProgress(this.bookId, chapter.chapterTitle,
        new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, scalarCount === 0 ? 0 : page.startScalar / scalarCount,
          chapter.bodyVersion, chapter.processingVersion), this.coreLayout());
      if (stored.chapterIndex !== chapter.chapterIndex || stored.chapterOffset !== page.startScalar)
        throw new Error('READING_PAGE_TURN_PROGRESS_ANCHOR_MISMATCH');
      if (this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selectionToken, lifecycleToken))
        this.admitCommittedProgress(stored);
      // Receipt delivery never promotes, rewinds, completes another turn or
      // changes a texture generation after the display has moved on.
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience presented page save pending: ${this.errorMessage(error as Error)}`);
    }
  }

  private admitPageTurnPersistenceOutcome(prepared: PreparedReaderPageTurn, lifecycle: number,
    generation: number, succeeded: boolean | undefined): void {
    if (!this.isPreparedPageTurnCommitCurrent(prepared, lifecycle, generation)) return;
    if (succeeded === undefined) {
      this.pageTurnPersistenceState = 'unknown';
      this.cancelPageTurnSettlementDeadline();
      if (this.pageTurnUnknownNotifiedGeneration === generation) return;
      this.pageTurnUnknownNotifiedGeneration = generation;
      this.getUIContext().showAlertDialog({ title: '正在确认阅读进度',
        message: '暂时无法确认保存结果。页面已保留，确认完成后继续翻页。',
        autoCancel: false,
        primaryButton: { value: '重新确认', action: (): void => {
          if (this.pageTurnReconciliationPending || !this.isPreparedPageTurnCommitCurrent(prepared, lifecycle, generation)) return;
          this.pageTurnReconciliationPending = true;
          this.pageTurnUnknownNotifiedGeneration = -1;
          void this.reconcilePreparedPageTurn(prepared, lifecycle, generation)
            .then((result: boolean | undefined): void => {
              this.admitPageTurnPersistenceOutcome(prepared, lifecycle, generation, result);
            }).finally((): void => { this.pageTurnReconciliationPending = false; });
        } },
      });
      return;
    }
    this.pageTurnCommitFinished = true;
    this.pageTurnCommitSucceeded = succeeded;
    this.pageTurnPersistenceState = succeeded ? 'durable' : 'originConfirmed';
    this.finishPreparedPageTurnSettlement(generation);
  }

  private async reconcilePreparedPageTurn(prepared: PreparedReaderPageTurn, lifecycle: number,
    generation: number): Promise<boolean | undefined> {
    const gateway = this.activeGateway();
    const isCurrent = (): boolean => this.isPreparedPageTurnCommitCurrent(prepared, lifecycle, generation);
    const result = await reconcileReaderControlSelectionProgress({ isCurrent,
      runSerial: (operation: () => Promise<void>): Promise<void> => gateway.runProgressCommitSerial(operation),
      readProgress: async (): Promise<LocalReadingProgress | undefined> => {
        const state = await gateway.loadProgress(this.bookId, isCurrent);
        return state.kind === 'restored' ? state.progress : undefined;
      },
    });
    if (!isCurrent() || result.kind !== 'verified' || result.progress === undefined ||
      result.progress.bookId !== this.bookId) return undefined;
    const stored = result.progress;
    if (stored.chapterIndex === prepared.context.chapter.chapterIndex &&
      stored.chapterOffset === prepared.page.startScalar) {
      this.pageTurnStoredProgress = stored;
      return true;
    }
    const origin = this.lastCommittedProgress;
    return origin !== undefined && stored.chapterIndex === origin.chapterIndex &&
      stored.chapterOffset === origin.chapterOffset && stored.updatedAt === origin.updatedAt &&
      stored.locationRevision === origin.locationRevision ? false : undefined;
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
      const prepared = this.pageTurnSettlingPrepared;
      if (prepared === undefined) this.finishPageTurnRollback(generation);
      else this.beginPreparedPageTurnPersistence(prepared, this.lifecycleToken, generation);
      return;
    }
    this.getUIContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (this.pageTurnSlideTimeline === timeline) this.advancePageTurnSlideTimeline(generation);
    }));
  }


  private async persistPreparedPageTurn(
    prepared: PreparedReaderPageTurn,
    lifecycleToken: number,
    settlementGeneration: number,
  ): Promise<boolean | undefined> {
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
        this.pageTurnPersistenceState = 'writing';
        const chapterProgress = scalarCount === 0 ? 0 : prepared.page.startScalar / scalarCount;
        const stored = await this.activeGateway().resolveAndUpdateProgress(
          this.bookId,
          prepared.context.chapter.chapterTitle,
          new CoreReadingAnchor(prepared.context.chapter.chapterIndex, prepared.page.startScalar, chapterProgress,
            prepared.context.chapter.bodyVersion, prepared.context.chapter.processingVersion),
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
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience prepared page commit failed: ${this.errorMessage(error as Error)}`);
      return this.reconcilePreparedPageTurn(prepared, lifecycleToken, settlementGeneration);
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

  private finishPreparedPageTurnSettlement(settlementGeneration: number, presentedPersistence: boolean = false): void {
    if (settlementGeneration !== this.pageTurnSettlementGeneration || !this.pageTurnAnimationFinished ||
      !this.pageTurnCommitFinished) {
      return;
    }
    const prepared = this.pageTurnSettlingPrepared;
    // The visual endpoint can join once inside ordinary presentation and once
    // again from the native event dispatcher. An admitted destination has no
    // remaining prepared owner; repeated joins must never roll it back.
    if (prepared === undefined) return;
    const stored = this.pageTurnStoredProgress;
    if (!this.pageTurnCommitSucceeded || (!presentedPersistence && stored === undefined) ||
      !this.isPreparedPageTurnFresh(prepared)) {
      this.pageTurnSettlingPrepared = undefined;
      this.pageTurnStoredProgress = undefined;
      this.pageTurnCommitStarted = false;
      const autoGeneration = this.automaticReadingState().generation;
      this.autoPageCoordinator.retryTurn(autoGeneration);
      this.animatePageTurnRollback();
      return;
    }
    this.promotePreparedPageTurn(prepared, stored);
    this.pageTurnSettlingPrepared = undefined;
    this.pageTurnStoredProgress = undefined;
    this.pageTurnGestureState = completeReaderPageGestureSettlement(this.pageTurnGestureState);
    if (this.usesBookTurnSimulation()) {
      this.bookTurnAwaitingSlotCommit = true;
      // Presentation barrier: Native auto-retains the terminal frame at the
      // visual commit endpoint; restate it defensively here (idempotent,
      // refreshes the retain timestamp).
      this.bookTurnSession.retainTerminalFrame(settlementGeneration);
      if (!this.bookTurnSession.commitSlots(settlementGeneration, prepared.direction)) {
        this.armPageTurnSettlementDeadline(settlementGeneration);
      } else {
        this.armPageTurnSettlementDeadline(settlementGeneration);
      }
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
    if (this.bookTurn2DFallbackPending) this.completeBookTurn2DFallback(this.pageTurnSettlementGeneration);
  }

  private requestBookTurn2DFallback(generation: number): void {
    if (!this.mounted || this.exitRequested || !this.pageTurnSettlementActive ||
      generation !== this.pageTurnSettlementGeneration) return;
    this.bookTurn2DFallbackPending = true;
    if (this.completeBookTurn2DFallback(generation)) return;
    // Re-deliver target content once. Keep the opaque terminal when its target
    // has not reached the resident slot; a disconnected callback cannot cause
    // infinite native retries, nor can it justify exposing an unadmitted page.
    this.pageTurnRenderRevision += 1;
    this.cancelPageTurnSettlementDeadline();
    this.getUIContext().showAlertDialog({ title: '正在恢复页面',
      message: '阅读位置已保留，可以重新显示当前页面。', autoCancel: false,
      primaryButton: { value: '重新显示', action: (): void => {
        if (generation !== this.pageTurnSettlementGeneration || !this.mounted) return;
        if (!this.completeBookTurn2DFallback(generation)) this.pageTurnRenderRevision += 1;
      } },
    });
  }

  private completeBookTurn2DFallback(generation: number): boolean {
    if (!this.mounted || this.exitRequested || !this.pageTurnSettlementActive || !this.bookTurn2DFallbackPending ||
      generation !== this.pageTurnSettlementGeneration ||
      generation !== this.bookTurnSurfaceGeneration ||
      this.bookTurnArkUIReadyRevision !== this.pageTurnRenderRevision ||
      this.pageTurnSettlingPrepared !== undefined) return false;
    this.bookTurn2DFallbackPending = false;
    this.bookTurnRuntimeFailed = true;
    this.bookTurnSurfaceOpacity = 0;
    this.bookTurnAwaitingSlotCommit = false;
    this.clearBookTurnCapturedIdentities();
    // No transparent swap. Best-effort cleanup remains generation/epoch gated;
    // UI ownership no longer depends on a lost native completion notification.
    this.bookTurnSession.releaseTerminalFrame(generation);
    this.bookTurnSession.clearSurface(generation);
    this.pageTurnPresentationPhase = 'released';
    if (this.pageTurnCommitSucceeded) this.finishSuccessfulPageTurnPresentation(generation);
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
    this.pageTurnCommitStarted = false;
    this.pageTurnSettlementActive = false;
    this.cancelPageTurnSettlementDeadline();
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
    if (this.interactionBlocked || this.controlObscured) {
      return { kind: 'blocked', reason: 'overlay' };
    }
    if (this.controlVisible()) {
      return { kind: 'blocked', reason: 'control' };
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
      if (this.pageTurnPreparationQueue.indexOf(preferred) > 0) {
        this.pageTurnPreparationQueue = this.pageTurnPreparationQueue.filter(
          (value: ReaderPageTurnDirection): boolean => value !== preferred);
        this.pageTurnPreparationQueue.unshift(preferred);
      }
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
    if (!this.mounted || this.exitRequested || this.controlVisible() || this.controlObscured ||
      this.interactionBlocked) {
      this.rapidPageTurnState = cancelReaderRapidPageTurn(this.rapidPageTurnState);
      return { kind: 'blocked', reason: !this.mounted || this.exitRequested ? 'lifecycle' :
        (this.controlVisible() ? 'control' : 'overlay') };
    }
    if (this.activePagePointerId >= 0 || this.pendingPointerSegmentReserved) return { kind: 'busy' };
    if (this.rapidPageTurnState.inFlightDirection !== undefined) return { kind: 'busy' };
    if (this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.pageTurnPreparation !== undefined || this.commitInFlight || this.continuousCommitInFlight) {
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
    if (origin !== 'manual' && (!this.mounted || !this.appForeground || this.exitRequested ||
      this.controlVisible() || this.controlObscured || this.interactionBlocked || this.pendingPointerSegmentReserved ||
      this.pageTurnSettlementActive || this.pageTurnSettlingPrepared !== undefined ||
      this.commitInFlight || this.continuousCommitInFlight || readerRapidPageTurnHasWork(this.rapidPageTurnState))) return { kind: 'busy' };
    if (origin === 'ttsFollow' && (ttsOwner === undefined || !this.isTtsFollowLeaseCurrent(ttsOwner))) return { kind: 'blocked', reason: 'lifecycle' };
    if (this.activePagePointerId >= 0) return { kind: 'busy' };
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
    if (direction === 'next') {
      const lastVisible = this.lastVisibleScalar(chapter.content, this.requireChapterLayoutMap());
      return page.endScalar > lastVisible && this.adjacentChapterIndex(chapter.chapterIndex, 1) === undefined ?
        { kind: 'boundary', edge: 'end' } : undefined;
    }

    const previousChapterIndex = this.adjacentChapterIndex(chapter.chapterIndex, -1);
    const containingPage = this.paginationIndex.findContainingPage(this.currentPaginationKey(), page.startScalar);
    if (containingPage !== undefined && containingPage.startScalar === page.startScalar &&
      containingPage.endScalarExclusive === page.endScalar) {
      return containingPage.pageIndex === 0 && previousChapterIndex === undefined ?
        { kind: 'boundary', edge: 'start' } : undefined;
    }
    return previousChapterIndex === undefined && this.paragraphRanges.length > 0 &&
      page.startScalar <= this.paragraphRanges[0].startScalar ?
      { kind: 'boundary', edge: 'start' } : undefined;
  }

  private performContinuousPageTurn(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    if (!this.mounted || this.exitRequested || this.controlVisible() || this.phase !== 'ready' ||
      this.chapter === undefined || this.continuousScroller === undefined ||
      this.continuousFragments.length === 0 || this.continuousCommitInFlight) {
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
      this.continuousScroller.scrollPage({ next: direction === 'next', animation: !this.reduceMotion });
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
    const draft = this.paginationDraft;
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
    const indexed = this.paginationIndex.findContainingPage(key, page.startScalar);
    const containingPage = indexed?.startScalar === page.startScalar && indexed.endScalarExclusive === page.endScalar ? indexed : undefined;
    const measuredPrevious = this.paginationDraft?.matches(key) === true ?
      this.paginationDraft.previousRequestForPageStart(page.startScalar) : undefined;
    if (measuredPrevious !== undefined) {
      this.measureCommittedPageAt(measuredPrevious); return { kind: 'started' };
    }
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
      if (previousChapterIndex !== undefined &&
        this.requireChapterLayoutMap().residentStart() === 0 && this.paragraphRanges.length > 0 &&
        page.startScalar <= this.paragraphRanges[0].startScalar) {
        return this.turnToPreviousChapter(previousChapterIndex, chapter.chapterIndex, page.startScalar) ?
          { kind: 'started' } : { kind: 'busy' };
      }
      if (previousChapterIndex === undefined && this.requireChapterLayoutMap().residentStart() === 0 && this.paragraphRanges.length > 0 &&
        page.startScalar <= this.paragraphRanges[0].startScalar) {
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
    if (this.readerSettingsSnapshot.navigationMode === 'continuous') {
      // List owns the end alignment. Only materialize the tail anchor; do not
      // build every physical page of a chapter to return to its scroll end.
      return this.openPageTurnChapter(previousChapterIndex, Number.MAX_SAFE_INTEGER);
    }
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
      this.paragraphRanges.length === 0) {
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
    return this.mounted && !this.exitRequested && !this.controlVisible() && this.phase === 'ready' &&
      !this.measurementCompleting && this.pageTurnPreparation === undefined &&
      this.pageTurnSettlingPrepared === undefined &&
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
    this.resetForChapterSelection(true);
    this.markOrdinaryPageMeasurement(chapterIndex);
    this.restoredProgress = undefined;
    this.armFirstPageReadyDeadline(lifecycleToken, selectionToken);
    void this.openChapter(chapterIndex, false, lifecycleToken, selectionToken, chapterOffset);
    return true;
  }

  private readingTocEntries(): LocalReadingTocEntry[] {
    if (this.readingTocSource !== this.tocEntries) {
      this.readingTocSource = this.tocEntries;
      this.readingTocProjection = this.tocEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false);
    }
    return this.readingTocProjection;
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
    return this.isSessionActive(lifecycleToken) && this.paginationIndex.isMeasurementCurrent(generation, selectionToken) && this.isSelectionCurrent(selectionToken) &&
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
      this.paginationIndex.invalidateMeasurement();
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.nativeTextMeasurement.clear();
      this.measurementBatch.length = 0;
      this.resetPendingPage();
      this.cancelMeasurementDeadline();
      this.measurementEpoch += 1;
      this.adjacentMeasurementContext = undefined;
      this.phase = this.visiblePage === undefined ? 'loading' : 'ready';
      this.rapidPageTurnState = reachReaderRapidPageBoundary(this.rapidPageTurnState, 'previous');
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
    if (this.recoverControlSelectionFailure(error, lifecycleToken)) return;
    this.failureCode = this.errorMessage(error);
    this.finishPageTurnPerf('failed');
    this.captureReadingRecordElapsed(false);
    this.clearReadingRecordTimer();
    this.autoPageCoordinator.stop('lifecycle');
    this.clearAutoPageTimer();
    this.clearAutoPageSessionTimer();
    this.cancelMeasurementDeadline();
    this.cancelFirstPageReadyDeadline();
    this.cancelFirstPageCompletionDeadline();
    this.firstPageCompletionRetryCount = 0;
    this.cancelPageTurnPreparationRetry();
    this.phase = 'failed';
    // A timeout/error revokes outstanding acquisition and measurement work;
    // remaining mounted must not allow a late reply to resurrect that attempt.
    this.chapterSelectionToken += 1;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.resetPaginationDraft();
    this.paginationIndex.invalidateMeasurement();
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience failed: ${this.failureCode}`);
    // The stable failure taxonomy lets the host separate book-source failures
    // (user-confirmed switch/retry) from local pagination/layout/storage ones.
    const failureKind: RemoteReadingFailureKind = remoteReadingFailureKindOf(error);
    this.onReadingFailure(this.sourceId, this.bookId, this.failureCode, failureKind);
    // Retain the reader, settings and source controls. A body failure does not
    // revoke the user's ability to open an existing book or its saved position.
  }

  private retryReading(): void {
    if (!this.mounted || this.exitRequested || this.phase !== 'failed') return;
    this.chapterSelectionToken += 1;
    this.resetForChapterSelection();
    this.failureCode = '';
    this.armFirstPageReadyDeadline(this.lifecycleToken, this.chapterSelectionToken);
    void this.loadInitialReading(this.lifecycleToken);
  }

  @Builder
  private readingFailureContent() {
    Scroll() {
      Column({ space: 20 }) {
        Text(this.sourceSwitchFailureMessage.length > 0 ? '换源未完成' : '正文暂时无法显示')
          .fontSize(20)
          .fontWeight(FontWeight.Medium)
          .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink);
        Text(this.sourceSwitchFailureMessage.length > 0 ? this.sourceSwitchFailureMessage : this.failureCode)
          .fontSize(16)
          .fontColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).ink)
          .width('100%');
        Button('重试')
          .onClick((): void => {
            if (this.sourceSwitchFailureMessage.length > 0) this.onRetryFailedSourceSwitch();
            else this.retryReading();
          });
        Button('阅读设置')
          .onClick((): void => this.openReaderControl());
        if (this.sourceSwitchFailureMessage.length > 0) {
          Button('继续当前书源')
            .onClick((): void => this.onDismissSourceSwitchFailure());
        }
        if (this.sourceId !== LOCAL_READING_SOURCE_ID) {
          Button('切换书源')
            .onClick((): void => this.onSwitchSource());
        }
      }
      .width('100%')
      .padding(24);
    }
    .width(this.readingLayout().bodyWidth())
    .height(this.readingLayout().bodyHeight(false))
    .position({ x: this.readingLayout().contentLeft, y: this.readingLayout().contentTop })
    .backgroundColor(readerAppearanceThemeStyle(this.appearanceSnapshot.activeTheme).paperStart)
    .zIndex(6);
  }

  private errorMessage(error: Error): string {
    return error.message;
  }
}
