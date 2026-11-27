import type { ReaderControlSelectionStoredProgress } from '../application/ReaderControlSelectionTransaction';
import { lastVisibleReadingScalar } from '../application/ReadingChapterOpening';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReaderBookmarkAnchorRequest } from '../presentation/ReaderBookmarkAnchorRequest';
import type { ReaderDeferredChapterSelection } from '../presentation/ReaderChapterSelectionOwner';
import type { ReaderControlSelectionDisplay } from '../presentation/ReaderPagePresentationModels';
import type { ReaderControlDirectoryOperationsHost } from './ReaderControlDirectoryOperationsHost';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import type { ReaderReadingChapterAcquisitionHost } from './ReaderReadingChapterAcquisitionHost';
import type { ReaderReadingChapterPresentationHost } from './ReaderReadingChapterPresentationHost';
import type { ReaderReadingControlInteractionHost } from './ReaderReadingControlInteractionHost';
import type { ReaderReadingMeasurementAdmissionHost } from './ReaderReadingMeasurementAdmissionHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingPlaybackFlowHost } from './ReaderReadingPlaybackFlowHost';
import type { ReaderReadingProgressHost } from './ReaderReadingProgressHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import type { ReadingSurfacePageFragment } from './ReadingSurface';

export interface ReaderReadingRouteSelectionActors {
  readonly mount: () => ReaderReadingMountHost;
  readonly directory: () => ReaderControlDirectoryOperationsHost;
  readonly chapter: () => ReaderReadingChapterPresentationHost;
  readonly acquisition: () => ReaderReadingChapterAcquisitionHost;
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly firstPage: () => ReaderReadingMeasurementAdmissionHost;
  readonly turn: () => ReaderPageTurnRuntimeHost;
  readonly control: () => ReaderReadingControlInteractionHost;
  readonly speech: () => ReaderReadingSpeechHost;
  readonly playback: () => ReaderReadingPlaybackFlowHost;
  readonly surface: () => ReaderReadingSurfaceHost;
  readonly progress: () => ReaderReadingProgressHost;
}

export interface ReaderReadingRouteSelectionView {
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly failed: () => boolean;
  readonly selection: () => number;
  readonly advanceSelection: () => void;
  readonly settlementActive: () => boolean;
  readonly controlOpenRevision: () => number;
  readonly publishLoadingChapter: (chapter: number) => void;
  readonly publishVisibleFragments: (fragments: ReadingSurfacePageFragment[]) => void;
  readonly publishChapterTitle: (title: string) => void;
  readonly publishShowChapterTitle: (show: boolean) => void;
  readonly publishReady: () => void;
}

/** Applies mounted route requests and accepted directory selections to the
 * existing chapter and page owners. The selection actor keeps its receipts. */
export class ReaderReadingRouteSelectionHost {
  private readonly chapters: ReadingChapterWindow;
  private readonly actors: ReaderReadingRouteSelectionActors;
  private readonly view: ReaderReadingRouteSelectionView;

  constructor(chapters: ReadingChapterWindow, actors: ReaderReadingRouteSelectionActors,
    view: ReaderReadingRouteSelectionView) {
    this.chapters = chapters;
    this.actors = actors;
    this.view = view;
  }

  requestedChapterChanged(chapterIndex: number | undefined): void {
    if (chapterIndex === undefined || !this.view.mounted()) return;
    if (this.view.settlementActive()) {
      this.actors.turn().pageTurn.deferRequestedChapter();
      return;
    }
    if (this.actors.measured().chapter?.chapterIndex === chapterIndex && !this.view.failed()) return;
    this.actors.speech().clearTtsChapterEndTimer();
    const mount = this.actors.mount();
    const lifecycle = mount.lifecycleToken;
    // A slower chapter fetch cannot replace the newly selected chapter.
    this.view.advanceSelection();
    const selection = this.view.selection();
    this.actors.chapter().beginRetainedChapterPresentation(chapterIndex, lifecycle, selection);
    this.actors.acquisition().resetForChapterSelection();
    this.view.publishLoadingChapter(chapterIndex);
    // A directory selection starts at the chapter's natural first scalar.
    mount.recordRestoration(undefined);
    mount.hydration.armReadyDeadline(lifecycle, selection);
    if (mount.gateway === undefined) {
      void mount.loadInitialReading(lifecycle);
      return;
    }
    void this.actors.acquisition().openChapter(chapterIndex, false, lifecycle, selection);
  }

  requestedBookmarkAnchorChanged(anchor: ReaderBookmarkAnchorRequest | undefined): void {
    if (anchor === undefined || !this.view.mounted()) return;
    const mount = this.actors.mount();
    if (Number.isSafeInteger(anchor.requestId) && mount.hasConsumedBookmarkAnchor(anchor.requestId)) return;
    if (mount.gateway === undefined) {
      this.view.advanceSelection();
      this.actors.chapter().beginRetainedChapterPresentation(anchor.chapterIndex, mount.lifecycleToken, this.view.selection());
      this.actors.acquisition().resetForChapterSelection();
      mount.hydration.armReadyDeadline(mount.lifecycleToken, this.view.selection());
      void mount.loadInitialReading(mount.lifecycleToken);
      return;
    }
    mount.consumeBookmarkAnchor(anchor.requestId);
    this.actors.directory().selectBookmarkAnchor(anchor.chapterIndex, anchor.chapterOffset, anchor.positionScope, anchor.directoryTargetProof);
  }

  prepareChapterSelectionRequest(request: ReaderDeferredChapterSelection): boolean {
    const proof = request.positionContext?.directoryTargetProof;
    if (proof !== undefined && !this.actors.acquisition().matchesDirectoryTarget(request.chapterIndex, proof)) return false;
    const owner = request.ttsOwner;
    const playback = this.actors.playback();
    if (owner !== undefined && !playback.isTtsFollowCurrent(owner)) return false;
    if (owner === undefined) playback.invalidateTtsFollow();
    if (!this.view.mounted() || !Number.isSafeInteger(request.chapterIndex) || request.chapterIndex < 0) return false;
    playback.reportPrefetch(owner === undefined, true);
    if (request.stopTts) playback.retirePendingStarts();
    return true;
  }

  queueChapterSelectionOnSettlement(request: ReaderDeferredChapterSelection): boolean {
    if (!this.view.settlementActive()) return false;
    this.actors.turn().pageTurn.deferChapterSelection(request);
    return true;
  }

  loadAdmittedChapterSelection(request: ReaderDeferredChapterSelection, lifecycle: number, selection: number): void {
    this.actors.chapter().beginRetainedChapterPresentation(request.chapterIndex, lifecycle, selection,
      request.refreshContent, request.positionContext, request.ttsOwner);
    const acquisition = this.actors.acquisition();
    acquisition.resetForChapterSelection(false, request.ttsOwner !== undefined);
    this.view.publishLoadingChapter(request.chapterIndex);
    const mount = this.actors.mount();
    mount.recordRestoration(undefined);
    mount.hydration.armReadyDeadline(lifecycle, selection);
    if (request.closeControlOnCommit && request.controlOwnerRevision === this.view.controlOpenRevision()) {
      const control = this.actors.control();
      if (control.controlVisible() && !control.controlShellExitArmed()) control.hideControl();
    }
    void acquisition.openChapter(request.chapterIndex, false, lifecycle, selection,
      request.requireChapterStart ? 0 : (request.requestedProgress === undefined ? request.chapterOffset : undefined),
      request.requestedProgress, request.refreshContent, request.positionContext);
  }

  restoreVerifiedControlSelection(display: ReaderControlSelectionDisplay,
    stored: ReaderControlSelectionStoredProgress): void {
    const measured = this.actors.measured();
    measured.restoreMaterializedChapterContext(display.context, true);
    measured.admit(display.page, this.view.selection());
    this.view.publishVisibleFragments(display.page.fragments);
    this.view.publishChapterTitle(display.context.chapter.chapterTitle);
    measured.desiredChapterOffset = stored.chapterOffset;
    measured.desiredChapterProgress = stored.chapterProgress;
    this.view.publishShowChapterTitle(measured.isChapterFirstPageStart(stored.chapterOffset));
    if (display.continuous) this.actors.surface().rebuildContinuousFragments(false, stored.chapterOffset);
    this.actors.chapter().finishRetainedChapterPresentation(this.actors.mount().lifecycleToken, this.view.selection());
    this.view.publishReady();
    this.actors.turn().preparation.schedule();
    this.actors.progress().admitCommittedProgress(stored);
  }

  measureCommittedPageAt(chapterOffset: number): void {
    const measured = this.actors.measured();
    const chapterMap = measured.requireChapterLayoutMap();
    const chapter = measured.requireChapter();
    const mount = this.actors.mount();
    this.actors.firstPage().markOrdinaryPageMeasurement(chapter.chapterIndex, this.view.selection(), mount.lifecycleToken);
    const lastVisible = lastVisibleReadingScalar(chapter.content, chapterMap);
    measured.desiredChapterOffset = Math.max(0, Math.min(lastVisible, chapterOffset));
    measured.desiredChapterProgress = chapterMap.scalarCount() === 0 ? 0 : measured.desiredChapterOffset / chapterMap.scalarCount();
    measured.beginMeasurement(mount.lifecycleToken);
  }

  openPageTurnChapter(chapterIndex: number, chapterOffset: number): boolean {
    if (!this.view.mounted() || !this.chapters.contains(chapterIndex)) return false;
    const mount = this.actors.mount();
    const lifecycle = mount.lifecycleToken;
    this.view.advanceSelection();
    const selection = this.view.selection();
    this.actors.chapter().beginRetainedChapterPresentation(chapterIndex, lifecycle, selection);
    const acquisition = this.actors.acquisition();
    acquisition.resetForChapterSelection(true);
    this.actors.firstPage().markOrdinaryPageMeasurement(chapterIndex, this.view.selection(), mount.lifecycleToken);
    mount.recordRestoration(undefined);
    mount.hydration.armReadyDeadline(lifecycle, selection);
    void acquisition.openChapter(chapterIndex, false, lifecycle, selection, chapterOffset);
    return true;
  }

  isSelectionCurrent(selection: number): boolean {
    return selection === this.view.selection();
  }

  hasCurrentMaterializedChapter(): boolean {
    const measured = this.actors.measured();
    return measured.chapter !== undefined && measured.chapterLayoutMap !== undefined &&
      this.isSelectionCurrent(measured.materializedChapterSelectionToken);
  }

  isStableVisiblePageOwner(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    selection: number, lifecycle: number): boolean {
    const preparationOrigin = this.actors.turn().preparation.pending?.origin.chapter;
    const measured = this.actors.measured();
    return this.actors.mount().isMountedToken(lifecycle) && !this.view.exiting() && measured.owns(page, selection) &&
      this.isSelectionCurrent(selection) && (measured.chapter === chapter || preparationOrigin === chapter);
  }
}
