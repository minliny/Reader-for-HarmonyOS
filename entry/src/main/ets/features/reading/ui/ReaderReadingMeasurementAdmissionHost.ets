import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { LocalReadingAnchor, LocalReadingProgress } from '../application/LocalReadingFlowGateway';
import { CoreReadingAnchor, type CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import type { ReadingMeasurementCoordinator } from '../application/ReadingMeasurementCoordinator';
import type { ReaderProgressProducerHost, ReaderProgressProducerIntent } from '../application/ReaderProgressProducerHost';
import type { ReaderNavigationMode } from '../application/ReaderSettingsState';
import { persistReaderMeasuredProgress, type ReaderFirstPagePlan } from '../application/ReaderFirstPageAdmission';
import type { ReadingSessionCommittedProgress } from '../application/ReadingSessionFlowGateway';
import type { ReaderChapterSelectionOwner } from '../presentation/ReaderChapterSelectionOwner';
import {
  ReaderControlSelectionCandidate, type ReaderControlSelectionDisplay, type ReaderControlSelectionOrigin,
  type ReaderMaterializedChapterContext,
} from '../presentation/ReaderPagePresentationModels';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';

export interface ReaderMeasuredPageAdmissionFacts {
  readonly layout: CoreReadingLayout;
  readonly chapter: ReadingSessionChapter;
  readonly scalarCount: number;
}

export interface ReaderMeasuredPageVisibility {
  readonly page: PhysicalReadingPage | undefined;
  readonly visibleSelection: number;
  readonly chapter: ReadingSessionChapter | undefined;
  readonly preparationOrigin: ReadingSessionChapter | undefined;
}

export interface ReaderMeasuredFirstPage {
  readonly page: PhysicalReadingPage;
  readonly chapter: ReadingSessionChapter;
  readonly progress: number;
  readonly selectionToken: number;
  readonly lifecycleToken: number;
}

export interface ReaderMeasuredPageAdmissionNative {
  readonly measurementCoordinator: ReadingMeasurementCoordinator;
  readonly isMeasurementCurrent: (generation: number, selection: number, lifecycle: number) => boolean;
  readonly layoutSignature: () => string;
  readonly captureMeasuredPage: () => ReaderMeasuredPageAdmissionFacts;
  readonly captureMaterializedChapter: () => ReaderMaterializedChapterContext;
  readonly currentPage: () => ReaderMeasuredPageVisibility;
  readonly hasVisibleBody: () => boolean;
  readonly publishPhysicalPage: (page: PhysicalReadingPage, chapterIndex: number, lifecycle: number, selection: number) => void;
  readonly setMeasuredPosition: (offset: number, progress: number) => void;
  readonly finishMeasurement: () => void;
  readonly releaseCompleting: () => void;
  readonly resumeDeferredMeasurement: (lifecycle: number) => void;
}

export interface ReaderMeasuredPageAdmissionView {
  readonly bookId: () => string;
  readonly selectionToken: () => number;
  readonly isReaderIdentityCurrent: () => boolean;
  readonly sourceSwitchRequested: () => boolean;
  readonly navigationMode: () => ReaderNavigationMode;
  readonly canRemeasurePresentedPage: () => boolean;
  readonly publishReadyPhase: () => void;
  readonly publishTitleVisibility: (pageStart: number) => void;
  readonly publishTitle: (chapterTitle: string) => void;
  readonly refreshPageProvider: () => void;
  readonly fail: (error: Error, lifecycle: number) => void;
}

export interface ReaderMeasuredPageAdmissionFlow {
  readonly captureProgressIntent: (chapter: ReadingSessionChapter, anchor: LocalReadingAnchor, layout: CoreReadingLayout, owner: () => boolean, current: () => boolean, publish: (stored: LocalReadingProgress) => void) => ReaderProgressProducerIntent;
  readonly admitCommittedProgress: (stored: ReadingSessionCommittedProgress) => void;
  readonly directoryProof: (chapter: ReadingSessionChapter, selection: number) => ReaderDirectoryTargetProof | undefined;
  readonly acknowledgeDirectoryProof: (selection: number, proof: ReaderDirectoryTargetProof, bookId: string, chapterIndex: number) => void;
  readonly admitRetainedSpeechCommit: () => void;
  readonly beginReadingRecord: (lifecycle: number) => void;
  readonly finishPageTurnPerf: (outcome: 'presented' | 'committed') => void;
  readonly notifyPresentationReady: (first: ReaderMeasuredFirstPage) => boolean;
  readonly notifyControlReadingReady: (first: ReaderMeasuredFirstPage) => boolean;
  readonly completeControlSelection: (stored: ReadingSessionCommittedProgress, first: ReaderMeasuredFirstPage) => void;
  readonly prepareNextPageTurn: () => void;
  readonly prefetchNextChapter: (first: ReaderMeasuredFirstPage) => void;
  readonly completeRapidTurn: () => void;
  readonly drainRapidTurn: () => void;
  readonly notifyAutomaticPageCommit: () => void;
}

/** Owns admission at the end of an interactive measurement. A cold page may
 * publish before its write. Control or source-switch positions require the
 * canonical receipt before publishing the native page. */
export class ReaderReadingMeasurementAdmissionHost {
  private readonly mount: ReaderReadingMountHost;
  private readonly native: ReaderMeasuredPageAdmissionNative;
  private readonly view: ReaderMeasuredPageAdmissionView;
  private readonly flow: ReaderMeasuredPageAdmissionFlow;
  private readonly chapterSelection: ReaderChapterSelectionOwner<ReaderControlSelectionDisplay,
    ReaderControlSelectionOrigin, ReaderControlSelectionCandidate>;
  private readonly progress: ReaderProgressProducerHost;
  private ordinarySelection: number = -1;
  private ordinaryLifecycle: number = -1;
  private ordinaryChapter: number = -1;
  private ordinaryLayout: string = '';

  constructor(mount: ReaderReadingMountHost, native: ReaderMeasuredPageAdmissionNative,
    view: ReaderMeasuredPageAdmissionView, flow: ReaderMeasuredPageAdmissionFlow,
    chapterSelection: ReaderChapterSelectionOwner<ReaderControlSelectionDisplay, ReaderControlSelectionOrigin,
      ReaderControlSelectionCandidate>, progress: ReaderProgressProducerHost) {
    this.mount = mount;
    this.native = native;
    this.view = view;
    this.flow = flow;
    this.chapterSelection = chapterSelection;
    this.progress = progress;
  }

  markOrdinaryPageMeasurement(chapterIndex: number, selection: number, lifecycle: number): void {
    this.ordinarySelection = selection;
    this.ordinaryLifecycle = lifecycle;
    this.ordinaryChapter = chapterIndex;
    this.ordinaryLayout = this.native.layoutSignature();
  }

  retireOrdinaryMeasurement(): void { this.ordinarySelection = -1; }

  canPresentOrdinaryPage(chapter: ReadingSessionChapter): boolean {
    return !this.view.sourceSwitchRequested() && this.chapterSelection.ticket === undefined &&
      this.mount.activeGateway().canPersistPresentedProgress() &&
      (chapter.positionMigration === undefined || chapter.positionMigration.status === 'unchanged');
  }

  private isOrdinaryPageMeasurement(chapter: ReadingSessionChapter, selection: number, lifecycle: number): boolean {
    return this.view.navigationMode() === 'paged' && this.ordinarySelection === selection &&
      this.ordinaryLifecycle === lifecycle && this.ordinaryChapter === chapter.chapterIndex &&
      this.ordinaryLayout === this.native.layoutSignature() && this.canPresentOrdinaryPage(chapter);
  }

  completeFirstPage(page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): Promise<void> {
    const current = (): boolean => this.native.isMeasurementCurrent(generation, selection, lifecycle);
    const layoutSignature = (): string => this.native.layoutSignature();
    return this.mount.hydration.completeFirstPage(lifecycle, {
      isCurrent: current,
      liveLayoutSignature: layoutSignature,
      resumeSuperseded: (signature: string): boolean =>
        this.resumeSupersededAppearanceMeasurement(selection, lifecycle, signature, current, layoutSignature),
      hasCurrentControlCandidate: (): boolean => this.mount.isSelectionActive(lifecycle, selection) &&
        this.chapterSelection.ticket?.selectionToken === selection && this.chapterSelection.candidate !== undefined,
      fail: (error: Error): void => this.view.fail(error, lifecycle),
    }, (measuredLayout: string): ReaderFirstPagePlan => {
      const facts = this.native.captureMeasuredPage();
      const chapter = facts.chapter;
      const directoryProof = this.flow.directoryProof(chapter, selection);
      const first: ReaderMeasuredFirstPage = {
        page, chapter, progress: facts.scalarCount === 0 ? 0 : page.startScalar / facts.scalarCount,
        selectionToken: selection, lifecycleToken: lifecycle,
      };
      const route = this.mount.hydration.firstPageRoute(
        this.native.currentPage().page !== undefined || this.native.hasVisibleBody(),
        this.chapterSelection.ticket !== undefined,
        this.view.sourceSwitchRequested(),
        (): boolean => this.mount.gateway?.hasPendingSourceSwitch?.() === true,
        (): boolean => this.isOrdinaryPageMeasurement(chapter, selection, lifecycle),
      );
      this.retireOrdinaryMeasurement();
      if (directoryProof === undefined && route !== 'durable') {
        return { kind: 'ordinary', present: (): Promise<void> =>
          this.presentOrdinaryMeasuredFirstPage(first, facts.layout, measuredLayout, route === 'ordinaryTurn') };
      }
      return {
        kind: 'durable',
        persist: (isAdmitted: () => boolean): Promise<ReadingSessionCommittedProgress> => {
          this.chapterSelection.captureCandidate(selection, (): ReaderControlSelectionCandidate =>
            new ReaderControlSelectionCandidate(this.native.captureMaterializedChapter(), page,
              this.view.navigationMode() === 'continuous', measuredLayout));
          this.flow.admitRetainedSpeechCommit();
          return persistReaderMeasuredProgress(() => this.mount.activeGateway(), this.view.bookId(), chapter.chapterTitle,
            this.anchor(first, directoryProof), facts.layout, isAdmitted);
        },
        matchesAnchor: (stored: ReadingSessionCommittedProgress): boolean =>
          stored.bookId === chapter.bookId && stored.chapterIndex === chapter.chapterIndex && stored.chapterOffset === page.startScalar,
        admitSavedProgress: (stored: ReadingSessionCommittedProgress): void => this.admitDirectoryProgress(first, stored, directoryProof),
        present: (stored: ReadingSessionCommittedProgress): void => this.presentDurableMeasuredFirstPage(first, stored, directoryProof),
      };
    });
  }

  private presentOrdinaryMeasuredFirstPage(first: ReaderMeasuredFirstPage,
    layout: CoreReadingLayout, layoutSignature: string, ordinaryTurn: boolean): Promise<void> {
    const lifecycle = first.lifecycleToken;
    this.publishMeasuredFirstPage(first.page, first.chapter, first.selectionToken);
    this.native.setMeasuredPosition(first.page.startScalar, first.progress);
    this.native.finishMeasurement();
    this.native.releaseCompleting();
    this.retireFirstPageDeadlines();
    this.view.publishReadyPhase();
    this.mount.hydration.trace(lifecycle, 'input-ready');
    this.flow.beginReadingRecord(lifecycle);
    this.flow.finishPageTurnPerf('presented');
    const persistence = this.persistOrdinaryFirstPage(first, layout, layoutSignature, ordinaryTurn);
    if (this.flow.notifyPresentationReady(first)) this.flow.prepareNextPageTurn();
    if (ordinaryTurn) {
      this.flow.notifyControlReadingReady(first);
      this.flow.prefetchNextChapter(first);
      // Native layout can finish inside the caller's turn. Its existing
      // microtask boundary lets the caller register the in-flight turn first.
      void Promise.resolve().then((): void => {
        if (!this.isOrdinaryFirstPagePresentationCurrent(first.page, first.chapter, first.selectionToken, lifecycle)) return;
        this.flow.completeRapidTurn();
        this.flow.notifyAutomaticPageCommit();
        this.flow.drainRapidTurn();
        this.native.resumeDeferredMeasurement(lifecycle);
      });
    }
    return persistence;
  }

  private admitDirectoryProgress(first: ReaderMeasuredFirstPage, stored: ReadingSessionCommittedProgress,
    proof: ReaderDirectoryTargetProof | undefined): void {
    if (proof !== undefined) this.flow.acknowledgeDirectoryProof(first.selectionToken, proof, stored.bookId, stored.chapterIndex);
    this.flow.admitCommittedProgress(stored);
  }

  private presentDurableMeasuredFirstPage(first: ReaderMeasuredFirstPage, stored: ReadingSessionCommittedProgress,
    proof: ReaderDirectoryTargetProof | undefined): void {
    const lifecycle = first.lifecycleToken;
    this.mount.hydration.trace(lifecycle, 'first-persist');
    this.native.setMeasuredPosition(first.page.startScalar, first.progress);
    this.native.publishPhysicalPage(first.page, first.chapter.chapterIndex, lifecycle, first.selectionToken);
    this.view.publishTitleVisibility(first.page.startScalar);
    this.view.publishReadyPhase();
    this.flow.beginReadingRecord(lifecycle);
    this.flow.finishPageTurnPerf('committed');
    this.native.releaseCompleting();
    this.retireFirstPageDeadlines();
    this.view.publishTitle(first.chapter.chapterTitle);
    this.native.finishMeasurement();
    // The provider's revision must change to replace its initial empty page.
    this.view.refreshPageProvider();
    this.mount.hydration.trace(lifecycle, 'presentation-submit');
    this.mount.hydration.trace(lifecycle, 'input-ready');
    this.flow.prepareNextPageTurn();
    this.admitDirectoryProgress(first, stored, proof);
    this.flow.completeControlSelection(stored, first);
    this.finishFirstPageProgressReady(first);
  }

  publishMeasuredFirstPage(page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number): void {
    this.native.publishPhysicalPage(page, chapter.chapterIndex, this.mount.lifecycleToken, selection);
    this.view.publishTitleVisibility(page.startScalar);
    this.view.publishTitle(chapter.chapterTitle);
    this.view.refreshPageProvider();
    // This is a model submission. The native frame's receipt is separate.
    this.mount.hydration.trace(this.mount.lifecycleToken, 'presentation-submit');
  }

  private anchor(first: ReaderMeasuredFirstPage, proof?: ReaderDirectoryTargetProof): CoreReadingAnchor {
    const chapter = first.chapter;
    return new CoreReadingAnchor(chapter.chapterIndex, first.page.startScalar, first.progress,
      chapter.bodyVersion, chapter.processingVersion, proof);
  }

  private persistOrdinaryFirstPage(first: ReaderMeasuredFirstPage,
    layout: CoreReadingLayout, layoutSignature: string, presentedTurn: boolean): Promise<void> {
    const lifecycle = first.lifecycleToken;
    const current = (): boolean =>
      this.isOrdinaryFirstPagePresentationCurrent(first.page, first.chapter, first.selectionToken, lifecycle);
    return this.mount.hydration.persistFirstPage(lifecycle, this.progress,
      (): ReaderProgressProducerIntent => this.flow.captureProgressIntent(
        first.chapter, this.anchor(first), layout, current, current,
        (stored: LocalReadingProgress): void => this.flow.admitCommittedProgress(stored)),
      presentedTurn, {
        traceIfReaderCurrent: (): boolean => this.readerIsMounted(lifecycle),
        isPresentationCurrent: current,
        layoutIsCurrent: (): boolean => layoutSignature === this.native.layoutSignature(),
        requestRemeasurement: (): void => {
          if (!this.view.canRemeasurePresentedPage()) return;
          this.native.measurementCoordinator.deferMeasurement(true);
          this.native.resumeDeferredMeasurement(lifecycle);
        },
        ready: (): void => this.finishFirstPageProgressReady(first),
        failed: (error: Error): void => {
          // Leave input available. The durable actor retains the failed write.
          hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience initial progress save failed: ${error.message}`);
        },
      });
  }

  private finishFirstPageProgressReady(first: ReaderMeasuredFirstPage): void {
    if (!this.flow.notifyControlReadingReady(first)) return;
    this.flow.prefetchNextChapter(first);
    this.flow.completeRapidTurn();
    this.flow.drainRapidTurn();
    this.flow.notifyAutomaticPageCommit();
    this.native.resumeDeferredMeasurement(first.lifecycleToken);
  }

  isOrdinaryFirstPagePresentationCurrent(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    selection: number, lifecycle: number): boolean {
    if (!this.readerIsMounted(lifecycle)) return false;
    const visible = this.native.currentPage();
    return visible.page === page && visible.visibleSelection === selection &&
      this.view.selectionToken() === selection &&
      (visible.chapter === chapter || visible.preparationOrigin === chapter);
  }

  async awaitOrdinaryFirstPagePersistence(): Promise<void> {
    // The session can recover a lost receipt from a read. It retains the
    // original intent and cannot overwrite a newer position.
    const lifecycle = this.mount.lifecycleToken;
    const selection = this.view.selectionToken();
    const current = this.native.currentPage();
    const page = current.page, chapter = current.chapter;
    const stored = await this.mount.gateway?.awaitPresentedProgressPersistence();
    if (stored !== undefined && page !== undefined && chapter !== undefined &&
      stored.chapterIndex === chapter.chapterIndex && stored.chapterOffset === page.startScalar &&
      this.isOrdinaryFirstPagePresentationCurrent(page, chapter, selection, lifecycle)) {
      this.flow.admitCommittedProgress(stored);
    }
    this.mount.hydration.releaseFirstPagePersistence();
  }

  private readerIsMounted(lifecycle: number): boolean {
    return this.mount.isMountedToken(lifecycle) && this.view.isReaderIdentityCurrent();
  }

  private retireFirstPageDeadlines(): void {
    this.mount.hydration.cancelReadyDeadline();
    this.mount.hydration.cancelCompletionDeadline();
    this.mount.hydration.resetCompletionRetries();
  }

  private resumeSupersededAppearanceMeasurement(selection: number, lifecycle: number, measuredLayout: string,
    current: () => boolean, layoutSignature: () => string): boolean {
    return this.native.measurementCoordinator.restoreAfterAppearanceChange(measuredLayout, {
      isSelectionActive: (): boolean => this.mount.isSelectionActive(lifecycle, selection),
      layoutSignature,
      isMeasurementCurrent: current,
      resume: (): void => {
        this.mount.hydration.cancelCompletionDeadline();
        this.mount.hydration.resetCompletionRetries();
        this.native.releaseCompleting();
        this.view.publishReadyPhase();
        this.native.measurementCoordinator.deferMeasurement(true);
        this.native.resumeDeferredMeasurement(lifecycle);
      },
    });
  }
}
