import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import type { LocalReadingContentMetrics, LocalReadingProgressState, LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { LocalReadingContentMetricIndex, validateContentMetricsAgainstToc } from '../application/LocalReadingWholeBookProgress';
import { readMeasuredParagraphWindow, type ReadingChapterMeasurementProjection } from '../application/ReadingChapterMeasurementPreparation';
import { prepareReadingChapterOpening, type ReadingChapterPositionUpdate } from '../application/ReadingChapterOpening';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingEntrySnapshot } from '../application/ReadingEntryPreparation';
import { ReadingInteractiveChapterPreparation, type ReadingNeighbourPublication } from '../application/ReadingInteractiveChapterPreparation';
import type { ReaderMeasurementWindowRecovery } from '../application/ReaderMeasurementRun';
import type { ReadingParagraphBoundaryMode } from '../application/ReadingParagraphProjection';
import type { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { remoteReadingFailureKindOf } from '../application/RemoteContentAdmission';
import { RemoteReadingGatewayError } from '../application/RemoteReadingContract';
import { RemoteChapterCacheRefreshError } from '../application/RemoteReadingFlowGateway';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export interface ReaderChapterAcquisitionScope {
  readonly sourceId: string;
  readonly bookId: string;
  readonly lifecycleToken: number;
  readonly selectionToken: number;
}

export interface ReaderChapterAcquisitionSession {
  readonly scope: () => ReaderChapterAcquisitionScope;
  readonly gateway: () => ReadingSessionFlowGateway;
  readonly hasGateway: () => boolean;
  readonly window: () => ReadingChapterWindow;
  readonly boundaryMode: () => ReadingParagraphBoundaryMode;
  readonly selectionActive: (lifecycleToken: number, selectionToken: number) => boolean;
  readonly active: (lifecycleToken: number) => boolean;
  readonly mountedToken: (lifecycleToken: number) => boolean;
}

export interface ReaderChapterAcquisitionEntry {
  readonly toc: () => LocalReadingTocEntry[];
  readonly requireKnownChapter: (index: number) => void;
  readonly prepared: () => ReadingEntrySnapshot | undefined;
  readonly discardPrepared: () => void;
  readonly restartPrepared: (lifecycleToken: number, selectionToken: number, layoutReady: Promise<void[]>) => Promise<void>;
  readonly restoredProgress: () => LocalReadingProgressState | undefined;
  readonly updateRestoredProgress: (progress: LocalReadingProgressState) => void;
  readonly markRetainedBodyReady: (lifecycleToken: number, selectionToken: number) => void;
  readonly traceChapterReady: (lifecycleToken: number) => void;
}

/** Presentation facts from the admitted body and the original opening request.
 * Measurement continues to own conversion into a visible physical page. */
export interface ReaderAcquiredChapter {
  readonly chapter: ReadingSessionChapter;
  readonly projection: ReadingChapterMeasurementProjection;
  readonly isInitial: boolean;
  readonly lifecycleToken: number;
  readonly selectionToken: number;
  readonly requestedOffset: number | undefined;
  readonly requestedProgress: number | undefined;
}

export interface ReaderChapterMaterializedSample {
  readonly chapter: ReadingSessionChapter;
  readonly map: ReadingSurfaceLayoutMap;
}

export interface ReaderChapterAcquisitionPresentation {
  readonly admitVersion: (index: number, version: string) => void;
  readonly setCurrentWindowChapter: (chapter: ReadingSessionChapter) => void;
  readonly retainWindow: () => void;
  readonly present: (admission: ReaderAcquiredChapter) => void;
  readonly materializedSample: () => ReaderChapterMaterializedSample | undefined;
  readonly publishMetrics: (metrics: LocalReadingContentMetrics | undefined) => void;
}

export interface ReaderChapterAcquisitionPages {
  readonly visiblePage: () => PhysicalReadingPage | undefined;
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly hasFacingChapter: () => boolean;
  readonly stableVisibleOwner: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selectionToken: number, lifecycleToken: number) => boolean;
  readonly isReadableTarget: (chapterIndex: number) => boolean;
  readonly turnGeneration: () => number;
  readonly stillWantsNeighbour: (direction: ReaderPageTurnDirection) => boolean;
  readonly reviseFacingSpread: () => void;
  readonly prepareAdjacent: (direction: ReaderPageTurnDirection) => void;
}

export interface ReaderChapterAcquisitionRecovery {
  readonly fail: (error: Error, lifecycleToken: number) => void;
  readonly showRecovery: (message: string, actionLabel: string, refresh: () => void) => void;
  readonly beginCacheRefresh: (chapterIndex: number, lifecycleToken: number, context: RemoteReadingPositionContext | undefined) => number;
  readonly reloadBookmarks: (chapter: ReadingSessionChapter, lifecycleToken: number, selectionToken: number) => void;
  readonly uiContext: () => UIContext;
  readonly feedbackForeground: () => boolean;
}

/** These phases run with no intervening await. The native measurement and
 * presentation owners retain their own working lanes and displayed frame. */
export interface ReaderChapterSelectionRetirement {
  readonly retireOpeningRun: () => void;
  readonly retireRecovery: () => void;
  readonly invalidatePageTurn: (preserveRapidPageTarget: boolean, preserveTtsFollow: boolean) => void;
  readonly clearWorkingMeasurement: () => void;
  readonly resetVisibleProjection: (preserveDisplay: boolean) => void;
  readonly clearMaterializedContent: () => void;
  readonly cancelSelectionDeadlines: () => void;
}

export interface ReaderChapterRangeAcquisition {
  readonly chapter: ReadingSessionChapter;
  readonly lifecycleToken: number;
  readonly selectionToken: number;
  readonly direction: 'before' | 'after';
  readonly current: () => boolean;
  readonly retireWorkingMeasurement: () => void;
  readonly admit: (chapter: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection) => void;
  readonly mayReopenVisibleChapter: () => boolean;
  readonly offset: () => number;
  readonly recover: (error: Error, chapter: ReadingSessionChapter, current: () => boolean, recovery: ReaderMeasurementWindowRecovery) => Promise<void>;
}

/** Owns the reading body's acquisition, the read-side cache retry and
 * optional metrics admission. The session gateway remains owned by Mount. */
export class ReaderReadingChapterAcquisitionHost {
  private readonly contentMetricIndex: LocalReadingContentMetricIndex = new LocalReadingContentMetricIndex();
  private contentMetrics: LocalReadingContentMetrics | undefined = undefined;
  private contentMetricsLoading: boolean = false;
  private cacheNoticeLifecycle: number = -1;

  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly interactive: ReadingInteractiveChapterPreparation;
  private readonly session: ReaderChapterAcquisitionSession;
  private readonly entry: ReaderChapterAcquisitionEntry;
  private readonly presentation: ReaderChapterAcquisitionPresentation;
  private readonly pages: ReaderChapterAcquisitionPages;
  private readonly recovery: ReaderChapterAcquisitionRecovery;
  private readonly retirement: ReaderChapterSelectionRetirement;

  constructor(transientFeedback: ReaderTransientFeedback, interactive: ReadingInteractiveChapterPreparation,
    session: ReaderChapterAcquisitionSession, entry: ReaderChapterAcquisitionEntry,
    presentation: ReaderChapterAcquisitionPresentation, pages: ReaderChapterAcquisitionPages,
    recovery: ReaderChapterAcquisitionRecovery, retirement: ReaderChapterSelectionRetirement) {
    this.transientFeedback = transientFeedback;
    this.interactive = interactive;
    this.session = session;
    this.entry = entry;
    this.presentation = presentation;
    this.pages = pages;
    this.recovery = recovery;
    this.retirement = retirement;
  }

  beginMount(): void {
    this.clearContentMetrics();
    this.contentMetricsLoading = false;
  }

  metrics(): LocalReadingContentMetrics | undefined { return this.contentMetrics; }

  metricsPercent(metrics: LocalReadingContentMetrics, chapterIndex: number, scalar: number): number {
    return this.contentMetricIndex.percent(metrics, chapterIndex, scalar);
  }

  clearContentMetrics(): void {
    this.publishContentMetrics(undefined);
  }

  private publishContentMetrics(metrics: LocalReadingContentMetrics | undefined): void {
    this.contentMetrics = metrics;
    this.presentation.publishMetrics(metrics);
  }

  resetForChapterSelection(preserveRapidPageTarget: boolean = false, preserveTtsFollow: boolean = false,
    preserveDisplay: boolean = false): void {
    this.retirement.retireOpeningRun();
    this.transientFeedback.reset();
    this.retirement.retireRecovery();
    this.retirement.invalidatePageTurn(preserveRapidPageTarget, preserveTtsFollow);
    this.retirement.clearWorkingMeasurement();
    this.retirement.resetVisibleProjection(preserveDisplay);
    this.retirement.clearMaterializedContent();
    this.retirement.cancelSelectionDeadlines();
  }

  expandParagraphWindow(request: ReaderChapterRangeAcquisition): void {
    const chapter = request.chapter;
    const range = chapter.documentRange;
    if (range === undefined) throw new Error('READING_PARAGRAPH_WINDOW_NOT_PARTIAL');
    const contentOwner = ReaderRuntimeOwner.current();
    const contentCurrent = this.captureContentValidity(contentOwner);
    const current = (): boolean => request.current();
    request.retireWorkingMeasurement();
    const mode = this.session.boundaryMode();
    const anchor = request.direction === 'before' ? range.startScalar : range.endScalar;
    void readMeasuredParagraphWindow(this.session.gateway(), chapter, anchor, request.direction, mode, current,
      (expanded: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection): void => {
        request.admit(expanded, projection);
      }, (error: Error): Promise<void> => request.recover(error, chapter, current, {
        // Adjacent/control preparations keep their original rollback owner.
        mayReload: (): boolean => !contentCurrent() && request.mayReopenVisibleChapter(),
        offset: (): number => request.offset(),
        waitForContentIdle: (): Promise<void> => this.waitForContentIdle(contentOwner),
        reopen: (offset: number, context: RemoteReadingPositionContext | undefined): Promise<void> => {
          this.session.window().clear();
          this.entry.discardPrepared();
          return this.openChapter(chapter.chapterIndex, false, request.lifecycleToken, request.selectionToken,
            offset, undefined, false, context);
        },
        selectionActive: (): boolean => this.session.selectionActive(request.lifecycleToken, request.selectionToken),
        fail: (failure: Error): void => this.recovery.fail(failure, request.lifecycleToken),
      }));
  }

  private waitForContentIdle(owner: ReaderRuntimeOwner): Promise<void> {
    const live = this.session.scope();
    return owner.waitForReadingContentIdle(live.sourceId, live.bookId);
  }

  private captureContentValidity(owner: ReaderRuntimeOwner): () => boolean {
    const scope = this.session.scope();
    return owner.captureReadingContentValidity(scope.sourceId, scope.bookId);
  }

  async openChapter(
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
      this.captureContentValidity(contentOwner);
    const recover = async (error: Error): Promise<void> => {
      // A stale selection (or unmounted session) must not fail the current
      // reading flow; only a current request's error is surfaced.
      if (!this.session.selectionActive(lifecycleToken, selectionToken)) {
        return;
      }
      if (!refreshContent && !contentCurrent()) {
        if (contentRetryCount >= 2) {
          this.recovery.fail(new RemoteReadingGatewayError('sourceVersionChanged', 'READING_CONTENT_EPOCH_CHANGED') as Error, lifecycleToken);
          return;
        }
        await this.waitForContentIdle(contentOwner);
        if (!this.session.selectionActive(lifecycleToken, selectionToken)) return;
        // The page may still hold its previous visible frame; clear only its
        // speculative chapter window before obtaining fresh Core evidence.
        this.session.window().clear();
        this.entry.discardPrepared();
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
        this.recovery.fail(error as Error, lifecycleToken);
        const failedSelection = this.session.scope().selectionToken;
        this.recovery.showRecovery(error.message, '刷新本章', (): void => {
          if (!this.session.selectionActive(lifecycleToken, failedSelection)) return;
          const refreshedSelection = this.recovery.beginCacheRefresh(chapterIndex, lifecycleToken, error.positionContext);
          void this.openChapter(chapterIndex, isInitial, lifecycleToken, refreshedSelection,
            requestedOffset, requestedProgress, true, error.positionContext, layoutReady);
        });
        return;
      }
      this.recovery.fail(error as Error, lifecycleToken);
    };

    let operation: Promise<void>;
    try {
      if (!isInitial && this.entry.toc().length > 0) {
        this.entry.requireKnownChapter(chapterIndex);
      }
      const isCurrent = (): boolean => this.session.selectionActive(lifecycleToken, selectionToken);
      if (!contentCurrent()) throw new Error('READING_CONTENT_EPOCH_CHANGED');
      const entry = isInitial ? this.entry.prepared() : undefined;
      if (isInitial && entry !== undefined && !entry.isCurrent()) {
        await this.entry.restartPrepared(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([]));
        return;
      }
      const restoredProgress = isInitial ? this.entry.restoredProgress() : undefined;
      const restored = restoredProgress?.kind === 'restored' &&
        restoredProgress.progress.chapterIndex === chapterIndex ? restoredProgress.progress : undefined;
      const currentEntry = isInitial && !refreshContent ? this.entry.prepared() : undefined;
      const prepared = currentEntry?.isCurrent() === true &&
        currentEntry.chapter.chapterIndex === chapterIndex ? currentEntry : undefined;
      operation = prepareReadingChapterOpening({
        chapterIndex, refreshContent, restored, explicitContext: positionContext, layoutReady,
        prepared: prepared === undefined ? undefined :
          { chapter: prepared.chapter, isCurrent: (): boolean => prepared.isCurrent() },
      }, this.session.window(), {
        isCurrent, contentCurrent,
        restartPreparedEntry: (): Promise<void> =>
          this.entry.restartPrepared(lifecycleToken, selectionToken, layoutReady ?? Promise.resolve([])),
      }, {
        loadChapter: (context: RemoteReadingPositionContext | undefined): Promise<ReadingSessionChapter> =>
          this.session.gateway().loadChapter(this.session.scope().bookId, chapterIndex, isCurrent, refreshContent, context),
        chapterReady: (): void => {
          this.entry.markRetainedBodyReady(lifecycleToken, selectionToken);
          if (isInitial) this.entry.traceChapterReady(lifecycleToken);
        },
        boundaryMode: (): ReadingParagraphBoundaryMode => this.session.boundaryMode(),
        confirmContentMetrics: (chapter: ReadingSessionChapter, map: ReadingSurfaceLayoutMap, current: () => boolean): Promise<boolean> =>
          this.ensureCurrentContentMetrics(chapter, map, current),
        applyPosition: (update: ReadingChapterPositionUpdate): void => {
          if (update.kind === 'requested') requestedOffset = update.offset;
          else this.entry.updateRestoredProgress(update.progress);
        },
        admit: (chapter: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection): void => {
          this.entry.discardPrepared();
          this.presentation.admitVersion(chapter.chapterIndex, chapter.contentVersion);
          this.presentation.setCurrentWindowChapter(chapter);
          this.presentation.retainWindow();
          const admission: ReaderAcquiredChapter = {
            chapter, projection, isInitial, lifecycleToken, selectionToken, requestedOffset, requestedProgress,
          };
          this.presentation.present(admission);
          if (chapter.positionMigration?.status === 'committed') {
            this.recovery.reloadBookmarks(chapter, lifecycleToken, selectionToken);
          }
          this.notifyPreservedContentRefresh(chapter, refreshContent, lifecycleToken, selectionToken);
        },
        fail: recover,
      });
    } catch (error) {
      await recover(error as Error);
      return;
    }
    await operation;
  }

  private notifyPreservedContentRefresh(chapter: ReadingSessionChapter, refreshContent: boolean,
    lifecycleToken: number, selectionToken: number): void {
    const preserved = refreshContent && chapter.positionMigration?.status === 'preserved';
    const refreshed = refreshContent && (chapter.positionMigration?.status === 'committed' ||
      chapter.positionMigration?.status === 'unchanged');
    if ((!preserved && !refreshed && chapter.cacheRefreshRequired !== true) ||
      !this.session.selectionActive(lifecycleToken, selectionToken)) {
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
      this.transientFeedback.show(() => this.recovery.uiContext(), { message }, (): boolean =>
        this.session.selectionActive(lifecycleToken, selectionToken) && this.recovery.feedbackForeground());
    } catch (_) {
      // Presentation failure cannot turn a preserved, readable chapter into a
      // load failure. The common short-feedback adapter owns native failures.
    }
  }

  /**
   * After current-page admission, expand the body window nearest-first.
   * One optional request at a time; the shared background lane leaves room
   * for explicit reading. Distant bodies do not create pages or textures.
   */
  prefetchNextChapter(
    current: ReadingSessionChapter,
    lifecycleToken: number,
    selectionToken: number,
  ): void {
    const page = this.pages.visiblePage();
    const facing = this.pages.hasFacingChapter();
    if ((!facing && current.documentRange !== undefined) || page === undefined ||
      !this.pages.stableVisibleOwner(page, current, selectionToken, lifecycleToken)) return;
    this.interactive.prefetch(this.session.window(), current, facing, {
      key: `${lifecycleToken}:${selectionToken}:${current.chapterIndex}:${page.startScalar}`,
      isCurrent: (): boolean => this.pages.stableVisibleOwner(page, current, selectionToken, lifecycleToken),
      load: (index: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> =>
        this.session.gateway().prefetchChapter(this.session.scope().bookId, index, isCurrent),
      publication: this.neighbourPublication(),
    }, (): void => {
      this.pages.reviseFacingSpread();
    });
  }

  /** Demand acquisition refills an evicted neighbour while its queued direction survives. */
  requestPageTurnChapter(direction: ReaderPageTurnDirection, chapterIndex: number): void {
    const page = this.pages.visiblePage();
    const origin = this.pages.chapter();
    if (page === undefined || origin === undefined || !this.pages.isReadableTarget(chapterIndex) ||
      this.session.window().get(chapterIndex) !== undefined) return;
    const generation = this.pages.turnGeneration();
    const scope = this.session.scope();
    const lifecycle = scope.lifecycleToken;
    const selection = scope.selectionToken;
    this.interactive.requestTurn(this.session.window(), chapterIndex, direction === 'next', {
      key: `${lifecycle}:${selection}:${generation}:${origin.chapterIndex}:${page.startScalar}:${direction}:${chapterIndex}`,
      isCurrent: (): boolean => generation === this.pages.turnGeneration() &&
        this.pages.stableVisibleOwner(page, origin, selection, lifecycle),
      load: (index: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> =>
        this.session.gateway().loadChapter(this.session.scope().bookId, index, isCurrent),
      publication: this.neighbourPublication(),
    }, (isCurrent: () => boolean): void => {
      if (this.pages.stillWantsNeighbour(direction)) {
        this.transientFeedback.show(() => this.recovery.uiContext(), {
          message: direction === 'previous' ? '上一章加载失败，请重试' : '下一章加载失败，请重试',
        }, (): boolean => isCurrent() && this.recovery.feedbackForeground());
      }
    });
  }

  private neighbourPublication(): ReadingNeighbourPublication {
    return {
      matchesIdentity: (chapter: ReadingSessionChapter): boolean => {
        const scope = this.session.scope();
        return chapter.sourceId === scope.sourceId && chapter.bookId === scope.bookId;
      },
      admitVersion: (index: number, version: string): void => this.presentation.admitVersion(index, version),
      retain: (): void => this.presentation.retainWindow(),
      prepareAdjacent: (forward: boolean): void => {
        this.pages.prepareAdjacent(forward ? 'next' : 'previous');
      },
    };
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
    if (!this.session.gateway().supportsExactContentMetrics()) {
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
    metrics = await this.session.gateway().loadContentMetrics(this.session.scope().bookId, isCurrent);
    if (!isCurrent()) {
      return false;
    }
    if (metrics === undefined) {
      throw new Error('READING_CONTENT_METRICS_MISSING');
    }
    validateContentMetricsAgainstToc(metrics, this.entry.toc());
    metric = this.contentMetricIndex.forChapter(metrics, chapter.chapterIndex);
    if (metric === undefined || metric.scalarLength !== scalarCount) {
      throw new Error('READING_CONTENT_METRICS_STALE');
    }
    this.publishContentMetrics(metrics);
    return true;
  }

  async loadContentMetricsIfNeeded(lifecycleToken: number): Promise<void> {
    if (!this.session.active(lifecycleToken) || this.contentMetrics !== undefined ||
      this.contentMetricsLoading || !this.session.hasGateway() || !this.session.gateway().supportsExactContentMetrics()) {
      return;
    }
    this.contentMetricsLoading = true;
    try {
      const isCurrent = (): boolean => this.session.active(lifecycleToken);
      const metrics = await this.session.gateway().loadContentMetrics(this.session.scope().bookId, isCurrent);
      if (!isCurrent() || metrics === undefined) {
        return;
      }
      validateContentMetricsAgainstToc(metrics, this.entry.toc());
      const sample = this.presentation.materializedSample();
      if (sample !== undefined) {
        const metric = this.contentMetricIndex.forChapter(metrics, sample.chapter.chapterIndex);
        if (metric === undefined || metric.scalarLength !== sample.map.scalarCount()) {
          return;
        }
      }
      this.publishContentMetrics(metrics);
    } catch (_error) {
      // Exact local metrics improve whole-book controls but are not required
      // to render or navigate the already materialized current chapter.
    } finally {
      if (this.session.mountedToken(lifecycleToken)) {
        this.contentMetricsLoading = false;
      }
    }
  }
}
