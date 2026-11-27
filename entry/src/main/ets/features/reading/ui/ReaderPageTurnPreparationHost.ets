import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { lastVisibleReadingScalar } from '../application/ReadingChapterOpening';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import { readingChapterLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { PreparedReaderPageTurn, ReaderMaterializedChapterContext,
  ReaderPageTurnPreparation } from '../presentation/ReaderPagePresentationModels';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';
import { ReaderPagePreparationQueue, type ReaderPagePreparationAttempt } from './ReaderPagePreparationCoordinator';
import type { ReaderPageTurnNativeHost } from './ReaderPageTurnNativeHost';
import type { ReaderPageTurnTarget } from './ReaderPhysicalPaginationOwner';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

export interface ReaderPageTurnPreparationScene {
  readonly mounted: () => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly selection: () => number;
  readonly requiresPrepared: () => boolean;
  readonly renderWorkBlocked: () => boolean;
  readonly turnWorkBlocked: () => boolean;
  readonly canTurn: () => boolean;
  readonly heldPointerCanPrepare: () => boolean;
  readonly releaseProjectionForHeldPreparation: () => void;
  readonly uiContext: () => UIContext;
  readonly texture: () => ReaderPageTurnNativeHost;
}

export interface ReaderPageTurnPreparationDocument {
  readonly visiblePage: () => PhysicalReadingPage | undefined;
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly chapterWindow: ReadingChapterWindow;
  readonly captureOrigin: () => ReaderMaterializedChapterContext;
  readonly adjacentTarget: (direction: ReaderPageTurnDirection, page: PhysicalReadingPage,
    chapter: ReadingSessionChapter) => ReaderPageTurnTarget | undefined;
  readonly isUnknownCatalogEdge: (index: number, direction: ReaderPageTurnDirection) => boolean;
  readonly requestCatalog: () => void;
  readonly requestChapter: (direction: ReaderPageTurnDirection, index: number) => void;
  readonly discoverPrevious: () => boolean;
  readonly admitContentVersion: (index: number, version: string) => void;
}

/** The measurement owner supplies the original hidden lane shared with
 * predecessor discovery. Candidate state remains in the preparation host. */
export interface ReaderPageTurnPreparationMeasurement {
  readonly active: () => boolean;
  readonly begin: (context: ReaderMaterializedChapterContext) => boolean;
  readonly clearContext: () => void;
  readonly finishContext: () => void;
  readonly retirePreviousDiscovery: () => void;
  readonly interrupt: (clearDeferredRequest: boolean) => void;
  readonly current: (generation: number, selection: number, lifecycle: number) => boolean;
  readonly capture: () => ReaderMaterializedChapterContext;
  readonly key: () => ReadingPaginationKey;
  readonly finish: () => void;
}

export interface ReaderPageTurnPreparationPublication {
  readonly prepared: (direction: ReaderPageTurnDirection) => boolean;
  readonly clearNeighbours: () => void;
  readonly setNeighbour: (prepared: PreparedReaderPageTurn) => void;
  readonly phase: (phase: 'loading' | 'ready') => void;
  readonly advanceRevision: () => void;
  readonly releaseImages: () => void;
  readonly complete: (chapter: ReadingSessionChapter, page: PhysicalReadingPage) => void;
}

/** Owns the speculative neighbour queue and its one candidate. Native
 * measurement supplies the exact ticket and pagination key. Accepted work
 * joins the existing turn coordinator as a neighbour of the current page. */
export class ReaderPageTurnPreparationHost {
  private readonly scene: ReaderPageTurnPreparationScene;
  private readonly document: ReaderPageTurnPreparationDocument;
  private readonly measurement: ReaderPageTurnPreparationMeasurement;
  private readonly publication: ReaderPageTurnPreparationPublication;
  private readonly queue: ReaderPagePreparationQueue = new ReaderPagePreparationQueue();
  private candidate: ReaderPageTurnPreparation | undefined = undefined;
  private revision: number = 0;

  constructor(scene: ReaderPageTurnPreparationScene, document: ReaderPageTurnPreparationDocument,
    measurement: ReaderPageTurnPreparationMeasurement, publication: ReaderPageTurnPreparationPublication) {
    this.scene = scene;
    this.document = document;
    this.measurement = measurement;
    this.publication = publication;
  }

  get pending(): ReaderPageTurnPreparation | undefined { return this.candidate; }
  get generation(): number { return this.revision; }

  contains(direction: ReaderPageTurnDirection): boolean { return this.queue.contains(direction); }
  hasQueued(): boolean { return this.queue.hasQueued(); }
  remove(direction: ReaderPageTurnDirection): void { this.queue.remove(direction); }
  promoteQueued(direction: ReaderPageTurnDirection): void { this.queue.promoteQueued(direction); }
  cancelRetry(): void { this.queue.cancelRetry(); }

  /** Scene and reverse-lane retirement run at their existing publication
   * points. The caller uses the retired origin for any materialized restore. */
  invalidate(beforeClear: () => void, afterClear: () => void): ReaderPageTurnPreparation | undefined {
    const preparation = this.candidate;
    this.revision += 1;
    beforeClear();
    this.candidate = undefined;
    afterClear();
    this.queue.reset();
    return preparation;
  }

  schedule(): void {
    this.revision += 1;
    this.publication.clearNeighbours();
    this.queue.reset(this.scene.requiresPrepared() ? this.scene.texture().preferredDirection : undefined);
    this.publication.advanceRevision();
    const generation = this.generation;
    setTimeout((): void => {
      if (generation === this.generation) this.drain();
    }, 0);
  }

  enqueue(direction: ReaderPageTurnDirection): void {
    if (!this.scene.requiresPrepared() || this.queue.contains(direction) || this.publication.prepared(direction)) {
      return;
    }
    this.queue.append(direction);
    this.drain();
  }

  drain(): void {
    this.queue.drain({
      renderWorkBlocked: (): boolean => this.scene.renderWorkBlocked(),
      laneBlocked: (): boolean => this.candidate !== undefined || this.scene.turnWorkBlocked() ||
        !this.scene.requiresPrepared() || !this.scene.canTurn(),
      ready: (direction: ReaderPageTurnDirection): boolean => this.publication.prepared(direction),
      prepare: (direction: ReaderPageTurnDirection): ReaderPagePreparationAttempt => this.prepare(direction),
      idle: (): void => this.scene.texture().schedule(),
      captureCurrent: (): (() => boolean) => {
        const generation = this.generation;
        const selection = this.scene.selection();
        return (): boolean => generation === this.generation && selection === this.scene.selection();
      },
    });
  }

  private prepare(direction: ReaderPageTurnDirection): ReaderPagePreparationAttempt {
    const page = this.document.visiblePage();
    const chapter = this.document.chapter();
    const target = page === undefined || chapter === undefined ? undefined :
      this.document.adjacentTarget(direction, page, chapter);
    if (target !== undefined) return this.begin(direction, target);
    const currentChapter = this.document.chapter();
    if (currentChapter !== undefined && this.document.isUnknownCatalogEdge(currentChapter.chapterIndex, direction)) {
      this.document.requestCatalog();
      return 'wait';
    }
    return direction === 'previous' && this.document.discoverPrevious() ? 'wait' : 'abandon';
  }

  private begin(direction: ReaderPageTurnDirection, target: ReaderPageTurnTarget): ReaderPagePreparationAttempt {
    const visiblePage = this.document.visiblePage();
    const originChapter = this.document.chapter();
    if (visiblePage === undefined || originChapter === undefined || !this.scene.canTurn()) return 'retry';
    const sameChapter = target.chapterIndex === originChapter.chapterIndex;
    const targetChapter = sameChapter ? originChapter : this.document.chapterWindow.get(target.chapterIndex);
    if (targetChapter === undefined) {
      this.document.requestChapter(direction, target.chapterIndex);
      return 'abandon';
    }
    const origin = this.document.captureOrigin();
    const targetMap = sameChapter ? origin.layoutMap : readingChapterLayoutMap(targetChapter);
    if (targetMap.scalarCount() === 0) return 'abandon';
    this.document.admitContentVersion(targetChapter.chapterIndex, targetChapter.contentVersion);
    this.candidate = new ReaderPageTurnPreparation(direction, origin, originChapter.chapterIndex,
      visiblePage.startScalar, this.generation);
    const lastVisible = lastVisibleReadingScalar(targetChapter.content, targetMap);
    const targetOffset = Math.max(0, Math.min(lastVisible, target.chapterOffset));
    const context = new ReaderMaterializedChapterContext(
      targetChapter, targetMap, targetChapter.contentVersion,
      sameChapter ? origin.paragraphRanges : [], sameChapter ? origin.paginationDraft : undefined,
      targetOffset, targetMap.scalarCount() === 0 ? 0 : targetOffset / targetMap.scalarCount(), -1,
    );
    if (!this.measurement.begin(context)) {
      // Layout admission may defer or refuse this attempt. Give the shared
      // lane back with the presented page and canonical position untouched.
      this.measurement.clearContext();
      this.candidate = undefined;
      return 'retry';
    }
    return 'begun';
  }

  complete(page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number): void {
    const preparation = this.candidate;
    if (preparation === undefined || preparation.generation !== this.generation ||
      !this.measurement.current(generation, selection, lifecycle)) return;
    const context = this.measurement.capture();
    const prepared = new PreparedReaderPageTurn(
      preparation.direction, page, context, this.measurement.key(),
      preparation.originChapterIndex, preparation.originPageStartScalar, preparation.generation,
    );
    this.candidate = undefined;
    this.publication.setNeighbour(prepared);
    this.measurement.finishContext();
    this.measurement.finish();
    this.publication.phase('ready');
    this.publication.advanceRevision();
    this.publication.complete(context.chapter, page);
    this.resumeAfterTextureFrame();
  }

  recover(error: Error, lifecycle: number): void {
    if (this.candidate === undefined || !this.scene.active(lifecycle)) return;
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience page-turn preparation failed: ${error.message}`);
    this.candidate = undefined;
    this.measurement.interrupt(true);
    this.measurement.clearContext();
    this.publication.phase('ready');
    this.publication.advanceRevision();
    this.publication.releaseImages();
    this.scene.texture().schedule();
  }

  suspend(): void {
    if (!this.measurement.active()) return;
    const direction = this.candidate?.direction ?? 'previous';
    this.measurement.finishContext();
    this.candidate = undefined;
    this.measurement.retirePreviousDiscovery();
    this.measurement.interrupt(false);
    this.publication.phase(this.document.visiblePage() === undefined ? 'loading' : 'ready');
    this.queue.restoreFront(direction);
  }

  prepareHeld(direction: ReaderPageTurnDirection): void {
    if (!this.scene.heldPointerCanPrepare()) return;
    // The physical pointer lease remains held while its candidate runs.
    this.scene.texture().preferredDirection = direction;
    this.suspend();
    this.scene.releaseProjectionForHeldPreparation();
    this.queue.prioritize(direction);
    this.drain();
    this.scene.texture().schedule();
  }

  resumeAfterTextureFrame(): void {
    this.scene.texture().invalidate();
    const generation = this.generation;
    // Capture the ready current/requested pages before measuring the other direction.
    this.scene.uiContext().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.scene.mounted() || generation !== this.generation) return;
      void this.scene.texture().refresh().finally((): void => {
        if (this.scene.mounted() && generation === this.generation) this.drain();
      });
    }));
  }
}
