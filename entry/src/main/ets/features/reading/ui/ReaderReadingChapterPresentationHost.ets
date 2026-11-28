import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { findReusableReadingWindowChapter } from '../application/ReadingChapterOpening';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import { READER_CHAPTER_LOADING_DELAY_MS, ReaderChapterPresentationGate, type ReaderChapterLoadSource,
  type ReaderChapterPresentationLease } from '../presentation/ReaderChapterPresentationGate';
import { READER_PAGE_TURN_SLOT_A, READER_PAGE_TURN_SLOT_B } from './ReaderPageTurnStage';
import type { ReaderRetainedChapterFrame } from './ReaderReadingPageChromeHost';
import type { ReaderTtsFollowLease } from './ReaderTtsPageFollow';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';

export interface ReaderReadingChapterPresentationScope {
  readonly lifecycleToken: number;
  readonly selectionToken: number;
}

export interface ReaderReadingChapterPresentationLifetime {
  readonly scope: () => ReaderReadingChapterPresentationScope;
  readonly selectionActive: (lifecycle: number, selection: number) => boolean;
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
}

export interface ReaderReadingChapterPresentationView {
  readonly localSource: () => boolean;
  readonly captureRetained: () => ReaderRetainedChapterFrame | undefined;
  readonly continuous: () => boolean;
  readonly loadingPermitted: () => boolean;
  readonly observeRevision: () => void;
  readonly publishRevision: () => void;
}

export interface ReaderReadingChapterPresentationSpeech {
  readonly offset: () => number | undefined;
  readonly followHighlight: () => boolean;
  readonly owns: (lease: ReaderTtsFollowLease) => boolean;
  readonly matchesMaterializedChapter: () => boolean;
  readonly retireAbandonedSelection: () => void;
  readonly restoreOrigin: (frame: ReaderRetainedChapterFrame) => void;
  readonly prepareTurn: () => void;
}

export interface ReaderReadingChapterPresentationReady {
  readonly current: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number) => boolean;
  readonly resolveImages: (chapter: ReadingSessionChapter, page: PhysicalReadingPage) => void;
  readonly traceReady: (lifecycle: number) => void;
  readonly scheduleCatalog: () => void;
  readonly settlePresentationRecovery: () => void;
  readonly onReadingReady: (chapter: number) => void;
  readonly observePrefetch: () => void;
  readonly prepareCatalogNearEnd: () => void;
  readonly clearTtsPositioning: () => void;
  readonly scheduleTtsFollowResume: () => void;
  readonly scheduleTtsWarmup: () => void;
}

/** Holds the visible source frame until the incoming chapter is admitted.
 * Its gate is separate from first-page persistence and native turn settlement. */
export class ReaderReadingChapterPresentationHost {
  private readonly chapters: ReadingChapterWindow;
  private readonly lifetime: ReaderReadingChapterPresentationLifetime;
  private readonly view: ReaderReadingChapterPresentationView;
  private readonly speech: ReaderReadingChapterPresentationSpeech;
  private readonly ready: ReaderReadingChapterPresentationReady;
  private readonly gate: ReaderChapterPresentationGate<ReaderRetainedChapterFrame> =
    new ReaderChapterPresentationGate<ReaderRetainedChapterFrame>();
  private loadingDelayTimer: number = -1;
  private retainedSpeech: ReaderTtsFollowLease | undefined = undefined;
  private speechCommitAdmitted: boolean = false;
  private lastReadyPage: PhysicalReadingPage | undefined = undefined;
  private lastReadySelection: number = -1;

  constructor(chapters: ReadingChapterWindow, lifetime: ReaderReadingChapterPresentationLifetime,
    view: ReaderReadingChapterPresentationView, speech: ReaderReadingChapterPresentationSpeech,
    ready: ReaderReadingChapterPresentationReady) {
    this.chapters = chapters;
    this.lifetime = lifetime;
    this.view = view;
    this.speech = speech;
    this.ready = ready;
  }

  get readyPage(): PhysicalReadingPage | undefined { return this.lastReadyPage; }

  resetReadyReceipt(): void {
    this.lastReadyPage = undefined;
    this.lastReadySelection = -1;
  }

  shouldShowChapterLoading(): boolean {
    if (!this.view.loadingPermitted()) return false;
    this.view.observeRevision();
    const lease = this.currentLease();
    return lease === undefined || this.gate.shouldShowLoading(lease, readerMotionNowMs());
  }

  retainedChapterFrame(): ReaderRetainedChapterFrame | undefined {
    const lease = this.currentLease();
    return lease === undefined ? undefined : this.gate.visibleOrigin(lease);
  }

  beginRetainedChapterPresentation(chapterIndex: number, lifecycle: number, selection: number,
    refresh: boolean = false, context?: RemoteReadingPositionContext, ttsOwner?: ReaderTtsFollowLease,
    recovery: boolean = false): void {
    this.cancelChapterLoadingDelay();
    const source: ReaderChapterLoadSource = this.view.localSource() ? 'local' :
      recovery || findReusableReadingWindowChapter(this.chapters, chapterIndex, refresh, context) !== undefined ?
        'cache' : 'coldRemote';
    const retained = this.view.captureRetained();
    const lease = this.gate.begin(lifecycle, selection, source, retained, readerMotionNowMs());
    this.retainedSpeech = ttsOwner;
    this.speechCommitAdmitted = false;
    this.view.publishRevision();
    if (source === 'coldRemote') this.armChapterLoadingDelay(lease, lifecycle, selection);
  }

  markRetainedChapterBodyReady(lifecycle: number, selection: number): void {
    const lease = this.gate.current(lifecycle, selection);
    if (lease === undefined || !this.gate.markBodyReady(lease, readerMotionNowMs())) return;
    this.view.publishRevision();
  }

  finishRetainedChapterPresentation(lifecycle: number, selection: number): void {
    const lease = this.gate.current(lifecycle, selection);
    if (lease !== undefined && this.gate.complete(lease)) this.clearChapterPresentation();
  }

  clearChapterPresentation(): void {
    this.cancelChapterLoadingDelay();
    this.gate.clear();
    this.retainedSpeech = undefined;
    this.speechCommitAdmitted = false;
    this.view.publishRevision();
  }

  admitTtsCommit(): void {
    if (this.retainedSpeech !== undefined) this.speechCommitAdmitted = true;
  }

  continuousChapterCommitScalar(page: PhysicalReadingPage): number {
    const owner = this.retainedSpeech;
    const offset = this.speech.offset();
    if (owner === undefined || !this.speech.followHighlight() || offset === undefined ||
      !this.speech.owns(owner) || !this.speech.matchesMaterializedChapter()) return page.startScalar;
    return Number.isSafeInteger(offset) && offset >= page.startScalar && offset < page.endScalar ? offset : page.startScalar;
  }

  cancelUncommittedTtsChapter(): void {
    const owner = this.retainedSpeech;
    if (owner === undefined || this.speechCommitAdmitted || this.lifetime.exiting() || !this.lifetime.mounted() ||
      this.speech.owns(owner)) return;
    const frame = this.retainedChapterFrame();
    if (frame === undefined) return;
    // An abandoned TTS measurement has no admitted progress write. Drop its
    // lease before advancing selection and republishing the retained source.
    this.clearChapterPresentation();
    this.speech.retireAbandonedSelection();
    this.speech.restoreOrigin(frame);
    this.speech.prepareTurn();
  }

  notifyReadingPresentationReady(chapter: ReadingSessionChapter, page: PhysicalReadingPage,
    selection: number, lifecycle: number): boolean {
    const isCurrent = (): boolean => this.ready.current(page, chapter, selection, lifecycle);
    if (!isCurrent()) return false;
    this.ready.resolveImages(chapter, page);
    if (this.lastReadyPage === page && this.lastReadySelection === selection) return true;
    this.lastReadyPage = page;
    this.lastReadySelection = selection;
    this.ready.traceReady(lifecycle);
    // Consumers can request only the next missing original paragraph range.
    this.ready.scheduleCatalog();
    this.ready.settlePresentationRecovery();
    try { this.ready.onReadingReady(chapter.chapterIndex); }
    catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience ready observer failed: ${(error as Error).message}`);
    }
    if (!isCurrent()) return false;
    this.ready.observePrefetch();
    this.ready.prepareCatalogNearEnd();
    this.ready.clearTtsPositioning();
    this.ready.scheduleTtsFollowResume();
    try { this.ready.scheduleTtsWarmup(); }
    catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience TTS warmup scheduling failed: ${(error as Error).message}`);
    }
    return isCurrent();
  }

  private currentLease(): ReaderChapterPresentationLease | undefined {
    const scope = this.lifetime.scope();
    return this.gate.current(scope.lifecycleToken, scope.selectionToken);
  }

  private armChapterLoadingDelay(lease: ReaderChapterPresentationLease, lifecycle: number, selection: number): void {
    this.loadingDelayTimer = setTimeout((): void => {
      this.loadingDelayTimer = -1;
      if (this.lifetime.selectionActive(lifecycle, selection) && this.gate.owns(lease)) this.view.publishRevision();
    }, READER_CHAPTER_LOADING_DELAY_MS);
  }

  private cancelChapterLoadingDelay(): void {
    if (this.loadingDelayTimer < 0) return;
    clearTimeout(this.loadingDelayTimer);
    this.loadingDelayTimer = -1;
  }

  observeRetainedChapterCommit(targetChapterIndex: number, lifecycle: number, selection: number): void {
    if (!readerTransitionsEnabled()) return;
    const lease = this.gate.current(lifecycle, selection);
    if (lease === undefined || lease.source === 'coldRemote') return;
    const origin = this.gate.visibleOrigin(lease)?.context.chapter.chapterIndex;
    if (origin !== undefined && origin !== targetChapterIndex) {
      this.observeChapterTransition(lease.source, targetChapterIndex, origin);
    }
  }

  observeChapterTransition(source: 'local' | 'cache', targetChapterIndex: number, originChapterIndex?: number): void {
    if (!readerTransitionsEnabled()) return;
    const nodes = this.view.continuous() ? ['reader-reading-interaction-host-continuous'] :
      [READER_PAGE_TURN_SLOT_A + ':transition-body', READER_PAGE_TURN_SLOT_B + ':transition-body'];
    const chapterBodyCount = nodes.length;
    nodes.push('reader-chapter-loading-state');
    readerBeginTransition({ kind: 'chapter', action: 'advance', subject: 'reader-chapter-' + source,
      scope: 'reader-chapter', nodes, chapterBodyCount, originChapterIndex, targetChapterIndex });
  }
}
