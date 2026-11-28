import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import type { LocalReadingToc, LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { ReaderChineseConversionGateway, type ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import { ReadingAuxiliaryFlowBridge, type ReadingContentMutationGateway,
  type ReadingContentMutationPosition } from '../application/ReadingAuxiliaryFlowBridge';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { RemoteReadingPositionContext } from '../application/RemoteReadingPositionMigration';
import type { ReaderNavigationMode } from '../application/ReaderSettingsState';

export interface ReaderReadingContentScope {
  readonly lifecycleToken: number;
  readonly sourceId: string;
  readonly bookId: string;
  readonly selectionToken: number;
}

export interface ReaderReadingContentLifetime {
  readonly scope: () => ReaderReadingContentScope;
  readonly mounted: () => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly selectionActive: (lifecycle: number, selection: number) => boolean;
}

export interface ReaderReadingConversionView {
  readonly mode: () => ReaderChineseConversionMode;
  readonly publishMode: (mode: ReaderChineseConversionMode) => void;
  readonly operationId: () => string;
  readonly publishOperationId: (id: string) => void;
  readonly uiContext: () => UIContext;
  readonly foreground: () => boolean;
  readonly windowChromeActive: () => boolean;
}

export interface ReaderReadingContentPosition {
  readonly gateway: () => ReadingSessionFlowGateway;
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly ready: () => boolean;
  readonly failed: () => boolean;
  readonly navigationMode: () => ReaderNavigationMode;
  readonly hasVisiblePage: () => boolean;
  readonly visiblePageStart: () => number | undefined;
  readonly sampleContinuousAnchor: () => void;
  readonly continuousVisibleScalar: () => number;
  readonly awaitFirstPagePersistence: () => Promise<void>;
  readonly commitContinuousProgress: (lifecycle: number) => Promise<void>;
  readonly commitVisiblePage: (lifecycle: number) => Promise<void>;
  readonly committed: () => ReadingCommit | undefined;
  readonly selectMappedPosition: (chapterIndex: number, offset: number, context?: RemoteReadingPositionContext) => void;
  readonly retryReading: () => void;
  readonly showPositionRecovery: (message: string, label: string, retry: () => void) => void;
}

export interface ReaderReadingContentProjection {
  readonly settlementActive: () => boolean;
  readonly preparationActive: () => boolean;
  readonly chapterSelectionPending: () => boolean;
  readonly deferContentProjection: (chapterIndex: number) => void;
  readonly deferReplaceReload: () => void;
  readonly invalidatePageTurnRuntime: () => void;
  /** Retire derived chapter metrics, pagination and body window in their existing order. */
  readonly clearProcessedChapters: () => void;
  readonly retireQuickSearch: () => void;
  readonly admitToc: (entries: LocalReadingTocEntry[]) => void;
  readonly notifyDirectoryChanged: (entries: LocalReadingTocEntry[]) => void;
}

/** Owns the mounted reader's admission of processing changes and their mapped
 * Core position. The original mutation and progress gateways keep their lanes. */
export class ReaderReadingContentMutationHost {
  private readonly conversion: ReaderChineseConversionGateway;
  private readonly auxiliaryFlows: ReadingAuxiliaryFlowBridge;
  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly lifetime: ReaderReadingContentLifetime;
  private readonly view: ReaderReadingConversionView;
  private readonly position: ReaderReadingContentPosition;
  private readonly projection: ReaderReadingContentProjection;
  private conversionLoaded: boolean = false;
  private conversionMutationGeneration: number = 0;
  private conversionActorKey: string = '';
  private conversionActor: ((mode: ReaderChineseConversionMode) => void) | undefined = undefined;

  constructor(runtime: ReaderRuntimeOwner, auxiliaryFlows: ReadingAuxiliaryFlowBridge,
    transientFeedback: ReaderTransientFeedback, lifetime: ReaderReadingContentLifetime,
    view: ReaderReadingConversionView, position: ReaderReadingContentPosition,
    projection: ReaderReadingContentProjection) {
    this.conversion = new ReaderChineseConversionGateway(runtime);
    this.auxiliaryFlows = auxiliaryFlows;
    this.transientFeedback = transientFeedback;
    this.lifetime = lifetime;
    this.view = view;
    this.position = position;
    this.projection = projection;
  }

  resetConversionLoad(): void { this.conversionLoaded = false; }

  chineseConversionIdentity(): string {
    return this.conversionKey(this.lifetime.scope(), this.view.operationId());
  }

  dispatchChineseConversionAction(mode: ReaderChineseConversionMode, identity?: string): void {
    if (identity !== this.chineseConversionIdentity()) return;
    this.chineseConversionAction()(mode);
  }

  async loadChineseConversionMode(lifecycle: number): Promise<void> {
    if (this.conversionLoaded) return;
    const generation = this.conversionMutationGeneration;
    const scope = this.lifetime.scope();
    const current = (): boolean => this.conversionPresentationCurrent(scope, lifecycle) &&
      generation === this.conversionMutationGeneration;
    try {
      // A passive read can reconcile an old write, but never replay it.
      const original = await this.conversion.recoverOriginal(current);
      if (!current()) return;
      this.view.publishOperationId(original.blocked && original.method === 'reader.chinese-conversion.put' ?
        original.operationId ?? '' : '');
      const mode = await this.conversion.getMode(current);
      if (!current()) return;
      this.view.publishMode(mode);
      this.conversionLoaded = true;
    } catch (_) {
      if (!current()) return;
      const original = this.conversion.snapshot();
      this.view.publishOperationId(original.blocked && original.method === 'reader.chinese-conversion.put' ?
        original.operationId ?? '' : '');
    }
  }

  persistBeforeContentMutation(): Promise<() => boolean> {
    const scope = this.lifetime.scope();
    const lifecycle = scope.lifecycleToken;
    const active = (): boolean => this.lifetime.active(lifecycle) && this.matchesBook(scope);
    return this.auxiliaryFlows.confirmPositionForMutation({
      firstPagePersistence: (): Promise<void> => this.position.awaitFirstPagePersistence(),
      gateway: (): ReadingSessionFlowGateway => this.position.gateway(),
      capture: (gateway: ReadingContentMutationGateway): ReadingContentMutationPosition | undefined => {
        if (!active() || !this.position.ready()) return undefined;
        const chapter = this.position.chapter();
        if (chapter === undefined ||
          this.projection.settlementActive() || this.projection.preparationActive() ||
          this.projection.chapterSelectionPending() || gateway.hasPendingSourceSwitch()) return undefined;
        const selection = this.lifetime.scope().selectionToken;
        const continuous = this.position.navigationMode() === 'continuous';
        if (continuous) this.position.sampleContinuousAnchor();
        const offset = continuous ? this.position.continuousVisibleScalar() : this.position.visiblePageStart();
        if (offset === undefined) return undefined;
        return {
          sourceId: scope.sourceId, bookId: scope.bookId, chapterIndex: chapter.chapterIndex, offset,
          current: (): boolean => active() && this.position.chapter() === chapter &&
            this.lifetime.scope().selectionToken === selection && this.position.ready() &&
            this.position.navigationMode() === (continuous ? 'continuous' : 'paged') &&
            (continuous ? this.position.continuousVisibleScalar() : this.position.visiblePageStart()) === offset,
          persist: (): Promise<void> => continuous ? this.position.commitContinuousProgress(lifecycle) :
            this.position.commitVisiblePage(lifecycle),
        };
      },
      committed: (): ReadingCommit | undefined => this.position.committed(),
    });
  }

  reloadCurrentPageAfterReplacePersist(lifecycle: number, bookId: string): void {
    this.auxiliaryFlows.reloadAfterReplacement({
      active: (): boolean => this.lifetime.active(lifecycle) && this.lifetime.scope().bookId === bookId,
      retireSearchPublication: (): void => this.projection.retireQuickSearch(),
      deferDuringSettlement: (): boolean => {
        if (!this.projection.settlementActive()) return false;
        this.projection.deferReplaceReload();
        return true;
      },
      invalidateProcessedContent: (): void => {
        this.projection.invalidatePageTurnRuntime();
        // A replacement can affect later chapters even when this page's scalar count is unchanged.
        this.projection.clearProcessedChapters();
      },
      reopenMappedPosition: (): void => {
        if (this.position.chapter() === undefined || !this.position.hasVisiblePage()) {
          if (this.position.failed()) this.position.retryReading();
          return;
        }
        // Re-materializing the mapped anchor must not close an active control.
        void this.reloadMigratedContentPosition(lifecycle, bookId);
      },
    });
  }

  reloadCurrentChapterAfterContentProjectionChange(lifecycle: number, chapterIndex: number): void {
    if (!this.lifetime.active(lifecycle)) return;
    if (this.projection.settlementActive()) {
      this.projection.deferContentProjection(chapterIndex);
      return;
    }
    this.projection.invalidatePageTurnRuntime();
    if (this.position.chapter()?.chapterIndex !== chapterIndex) return;
    this.projection.clearProcessedChapters();
    if (this.position.hasVisiblePage()) {
      void this.reloadMigratedContentPosition(lifecycle, this.lifetime.scope().bookId);
    }
  }

  private conversionKey(scope: ReaderReadingContentScope, operationId: string): string {
    return JSON.stringify([scope.lifecycleToken, scope.sourceId, scope.bookId, operationId]);
  }

  private chineseConversionAction(): (mode: ReaderChineseConversionMode) => void {
    const scope = this.lifetime.scope();
    const operationId = this.view.operationId();
    const key = this.conversionKey(scope, operationId);
    if (this.conversionActorKey === key && this.conversionActor !== undefined) return this.conversionActor;
    this.conversionActorKey = key;
    this.conversionActor = (mode: ReaderChineseConversionMode): void => {
      if (this.lifetime.active(scope.lifecycleToken) && this.matchesBook(scope)) {
        this.changeChineseConversionMode(mode, operationId);
      }
    };
    return this.conversionActor;
  }

  private matchesBook(scope: ReaderReadingContentScope): boolean {
    const current = this.lifetime.scope();
    return current.bookId === scope.bookId && current.sourceId === scope.sourceId;
  }

  private conversionPresentationCurrent(scope: ReaderReadingContentScope, lifecycle: number): boolean {
    return this.matchesBook(scope) && this.lifetime.active(lifecycle);
  }

  private changeChineseConversionMode(mode: ReaderChineseConversionMode, capturedOperationId: string): void {
    if (!this.lifetime.mounted() || capturedOperationId !== this.view.operationId()) return;
    const original = this.conversion.snapshot();
    if (original.busy) return;
    const recovering = original.blocked && original.method === 'reader.chinese-conversion.put';
    if (mode === this.view.mode() && !recovering) return;
    this.conversionMutationGeneration = this.conversionMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.conversionMutationGeneration + 1;
    const generation = this.conversionMutationGeneration;
    const scope = this.lifetime.scope();
    const current = (): boolean => this.conversionPresentationCurrent(scope, scope.lifecycleToken) &&
      generation === this.conversionMutationGeneration;
    const barrier = recovering ? Promise.resolve(current) : this.persistBeforeContentMutation();
    void barrier.then((positionCurrent): Promise<ReaderChineseConversionMode> => {
      if (!positionCurrent() || !current()) throw new Error('READING_CONTENT_MUTATION_SUPERSEDED');
      const admitted = (): boolean => positionCurrent() && current();
      if (recovering) {
        // Resume the retained operation only. The new selector value cannot
        // replace that operation's accepted conversion tuple.
        return this.conversion.recoverOriginal(admitted, true).then((settled): Promise<ReaderChineseConversionMode> => {
          if (settled.blocked) throw new Error(settled.message);
          return this.conversion.getMode(admitted);
        });
      }
      return this.conversion.putMode(mode, admitted);
    }).then((storedMode: ReaderChineseConversionMode): void => {
      if (!current()) return;
      this.view.publishMode(storedMode);
      this.conversionLoaded = true;
      const settled = this.conversion.snapshot();
      this.view.publishOperationId(settled.blocked ? settled.operationId ?? '' : '');
      this.projection.retireQuickSearch();
      const chapter = this.position.chapter();
      if (chapter === undefined) {
        if (this.position.failed()) this.position.retryReading();
        return;
      }
      const chapterIndex = chapter.chapterIndex;
      void this.position.gateway().loadToc(this.lifetime.scope().bookId, current)
        .then((toc: LocalReadingToc): void => {
          if (!current()) return;
          this.projection.admitToc(toc.entries);
          this.projection.notifyDirectoryChanged(toc.entries);
          this.reloadCurrentChapterAfterContentProjectionChange(scope.lifecycleToken, chapterIndex);
        }).catch((_error: Error): void => {
          if (current()) this.reloadCurrentChapterAfterContentProjectionChange(scope.lifecycleToken, chapterIndex);
        });
    }).catch((_error: Error): void => {
      if (!current()) return;
      const fact = this.conversion.snapshot();
      this.view.publishOperationId(fact.blocked && fact.method === 'reader.chinese-conversion.put' ?
        fact.operationId ?? '' : '');
      const message = fact.confirmation === 'unknown' || fact.blocked ?
        '转换原操作尚未确认，已保留原内容；再次选择只会核对/继续原操作' :
        fact.confirmation === 'confirmed' ? '转换已保存，当前内容刷新尚未完成，请重试阅读' :
          '转换未能执行，请稍后重试；原内容已保留';
      try {
        this.transientFeedback.show(() => this.view.uiContext(), { message },
          (): boolean => current() && this.view.foreground() && this.view.windowChromeActive());
      } catch (_) {}
    });
  }

  private async reloadMigratedContentPosition(lifecycle: number, bookId: string): Promise<void> {
    const scope = this.lifetime.scope();
    const current = (): boolean => {
      if (!this.lifetime.selectionActive(lifecycle, scope.selectionToken)) return false;
      const live = this.lifetime.scope();
      return live.sourceId === scope.sourceId && live.bookId === bookId;
    };
    try {
      const restored = await this.position.gateway().loadProgress(bookId, current);
      if (!current()) return;
      if (restored.kind !== 'restored') throw new Error('READING_CONTENT_POSITION_NOT_CONFIRMED');
      const progress = restored.progress;
      const context: RemoteReadingPositionContext | undefined = progress.bodyVersion === undefined ||
        progress.processingVersion === undefined ? undefined : { bodyVersion: progress.bodyVersion,
          processingVersion: progress.processingVersion, anchors: [{ id: 'requested', offset: progress.chapterOffset }] };
      // Core provides both the mapped offset and its processed body identity.
      this.position.selectMappedPosition(progress.chapterIndex, progress.chapterOffset, context);
    } catch (error) {
      if (!current()) return;
      hilog.error(0x5244, 'Reader', '%{private}s', `Reading content position reload failed: ${(error as Error).message}`);
      this.position.showPositionRecovery('正文规则已更新，阅读位置暂未恢复。', '重试恢复',
        (): void => { if (current()) void this.reloadMigratedContentPosition(lifecycle, bookId); });
    }
  }
}
