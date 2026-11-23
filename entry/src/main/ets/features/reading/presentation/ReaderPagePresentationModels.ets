import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { ReadingPaginationKey, ReadingPaginationPrefix } from '../application/ReadingPaginationIndex';
import type { ReadingEntryNavigation } from '../application/ReadingEntrySnapshot';
import type { LocalReadingTocEntry, LocalReadingProgress } from '../application/LocalReadingFlowGateway';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { ParagraphRange, PhysicalReadingPage } from '../ui/ReadingMeasurementModels';
import type { ReaderPageTurnDirection } from '../ui/ReaderPageGestureState';
import type { ReaderTtsFollowLease, ReaderPageTurnOrigin } from '../ui/ReaderTtsPageFollow';

/** UI presentation references, not application DTOs. No state, clone, IO or lease acquisition. */
/** Immutable display inputs, also used as an isolated adjacent measurement context. */
export class ReaderMaterializedChapterContext {
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

export interface ReaderControlPlaybackPresentation {
  lifecycleToken: number;
  sourceId: string;
  bookId: string;
  openRevision: number;
  moduleVisitRevision: number;
  module: string;
}

export interface ReaderTtsPlayIntent {
  generation: number;
  lifecycleToken: number;
  selectionToken: number;
  sourceId: string;
  bookId: string;
  presentation: ReaderControlPlaybackPresentation;
}

export interface ReaderControlSelectionDisplay {
  context: ReaderMaterializedChapterContext;
  page: PhysicalReadingPage;
  visibleScalar: number;
  continuous: boolean;
  layoutSignature: string;
}

/** Last actually committed display retained only until a control selection resolves. */
export class ReaderControlSelectionOrigin implements ReaderControlSelectionDisplay {
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
export class ReaderControlSelectionCandidate implements ReaderControlSelectionDisplay {
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
export class PreparedReaderPageTurn {
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

export class ReaderPageTurnPreparation {
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

export class ReaderPageTurnTarget {
  chapterIndex: number;
  chapterOffset: number;

  constructor(chapterIndex: number, chapterOffset: number) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
  }
}

export class ReaderDeferredChapterSelection {
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

export interface ReaderAutomaticPageStart {
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

export class KnownReadingContentVersion {
  chapterIndex: number;
  contentVersion: string;

  constructor(chapterIndex: number, contentVersion: string) {
    this.chapterIndex = chapterIndex;
    this.contentVersion = contentVersion;
  }
}

export class PreviousChapterMeasurement {
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

