import { MESSAGE_BODY } from '../common/ReaderMessageStyle';
import { ReaderPageState } from '../common/ReaderPageState';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { ReaderTransientFeedback } from '../common/ReaderTransientFeedback';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderDirectoryTrace } from './ReaderDirectoryTrace';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { prepareMangaSheetFonts } from '../common/ReaderFonts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../common/ReaderFontFamilies';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, openReaderDirectoryNavigation,
  readerDirectoryNoteMissingNavigation, readerDirectoryToggleCollapsed,
  type ReaderDirectoryNavigationNode, type ReaderDirectoryNavigationReady,
  type ReaderDirectoryNavigationPreparedPage } from './ReaderDirectoryNavigation';
import { ReaderDirectoryNavigationList, cacheReaderDirectoryNavigationPage } from './ReaderDirectoryNavigationList';
import { readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor } from './ReaderDirectoryViewport';
import { projectReaderDirectoryEntries } from './ReaderDirectoryProjection';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';

class ReaderDirectoryTraceFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** A directory opening is admitted once. If navigation is absent or an index
 * is not ready, the supplied chapter list stays visible for this opening. */
@Component
export struct ReaderDirectoryNavigationSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onIdentityChanged') sourceId: string = 'local';
  @Prop @Watch('onViewInputsChanged') query: string = '';
  @Prop @Watch('onViewInputsChanged') ascending: boolean = true;
  @Prop @Watch('onViewInputsChanged') currentChapterIndex: number = -1;
  @Prop @Watch('onLocateCurrent') locateCurrentRevision: number = 0;
  @Prop @Watch('onIdentityChanged') openRevision: string = '';
  @Prop interacted: boolean = false;
  @Prop rowHeight: number = 40;
  @Prop mangaDisplay: boolean = false;
  @Prop mangaRowMinHeight: number = 58;
  @Prop mangaCatalogDisplay: boolean = false;
  @Prop mangaQuickDisplay: boolean = false;
  @Prop mangaCatalogNarrow: boolean | undefined = undefined;
  @Prop mangaInitialViewportWidth: number = 0;
  @Prop mangaVisibleTopInset: number = 0;
  @Prop mangaCurrentOpenInset: number = 50;
  @Prop mangaScheme: string = '';
  @Prop listPaddingX: number = 10;
  @Prop listPaddingRight: number = -1;
  @Prop listPaddingY: number = 5;
  @Prop contentStartInset: number = 0;
  @Prop contentEndInset: number = 0;
  @Prop listPaddingTop: number = -1;
  @Prop listPaddingBottom: number = -1;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop chapterEntries: LocalReadingTocEntry[] = [];
  @Prop showLoadStatus: boolean = true;
  @Prop chapterDownloadEnabled: boolean = false;
  /** Manga uses existing markers to manage active/retained downloads. */
  @Prop chapterDownloadActionsEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: JsonObject): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onFirstLayout: () => void = (): void => {};
  onScrollOffset: (offset: number) => void = (_offset: number): void => {};
  onTreeStateChange: (active: boolean) => void = (_active: boolean): void => {};
  onClearSearch: () => void = (): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  @BuilderParam fallbackBuilder: () => void;
  @State private view: ReaderDirectoryNavigationReady | undefined = undefined;
  @State private loadPending: boolean = false;
  @State private loadFailed: boolean = false;
  @State private mangaFontsReady: boolean = false;
  private mangaFontGeneration: number = 0;
  private mangaFontTask: Promise<boolean> | undefined = undefined;
  private gateway: ReaderDirectoryNavigationGateway | undefined = undefined;
  private runtimeOwner: ReaderRuntimeOwner | undefined = undefined;
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private mounted: boolean = false;
  private generation: number = 0;
  private openingGeneration: number = -1;
  private settledFlat: boolean = false;
  private pendingRefresh: boolean = false;
  private pendingQueryRefresh: boolean = false;
  private queryTimer: number = -1;
  private queryTrace: ReaderDirectoryTrace | undefined = undefined;
  private lastQuery: string = '';
  private lastAscending: boolean = true;
  private lastChapterIndex: number = -1;
  private locateCurrentPending: boolean = false;
  private scrollIntentUnsubscribe: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.mangaDisplay) {
      void this.prepareMangaFonts();
    }
    this.scrollIntentUnsubscribe = readerDirectoryObserveScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onProgrammaticScrollIntent());
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    this.runtimeOwner = ReaderRuntimeOwner.current();
    this.gateway = new ReaderDirectoryNavigationGateway(this.runtimeOwner);
    this.openTree(true);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.feedback.reset();
    this.runtimeOwner = undefined;
    this.mangaFontGeneration += 1;
    this.mangaFontTask = undefined;
    this.mangaFontsReady = false;
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.scrollIntentUnsubscribe?.();
    this.scrollIntentUnsubscribe = undefined;
  }

  private prepareMangaFonts(): Promise<boolean> {
    if (!this.mounted || !this.mangaDisplay) return Promise.resolve(false);
    if (this.mangaFontsReady) return Promise.resolve(true);
    if (this.mangaFontTask !== undefined) return this.mangaFontTask;
    const generation = ++this.mangaFontGeneration;
    const task = prepareMangaSheetFonts().then((ready: boolean): boolean => {
      if (!this.mounted || generation !== this.mangaFontGeneration || !this.mangaDisplay) return false;
      // Font registration belongs to this mounted display, independently of
      // tree/query generations and the entering/retained-exit interaction gate.
      this.mangaFontsReady = ready;
      return ready;
    }).catch((_error: Error): boolean => false);
    this.mangaFontTask = task;
    void task.then((): void => {
      if (generation === this.mangaFontGeneration && this.mangaFontTask === task) this.mangaFontTask = undefined;
    });
    return task;
  }

  private onIdentityChanged(): void {
    if (!this.mounted) return;
    this.feedback.reset();
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.view = undefined;
    this.loadPending = false;
    this.loadFailed = false;
    this.onTreeStateChange(false);
    this.settledFlat = false;
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.scrollIntentUnsubscribe?.();
    this.scrollIntentUnsubscribe = readerDirectoryObserveScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onProgrammaticScrollIntent());
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    this.openTree(true);
  }

  private onViewInputsChanged(): void {
    if (!this.mounted || this.settledFlat) return;
    const queryChanged = this.query !== this.lastQuery;
    const otherChanged = this.ascending !== this.lastAscending || this.currentChapterIndex !== this.lastChapterIndex;
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    this.cancelQueryTimer();
    // Cancel an in-flight view before the debounce, so an old query cannot
    // publish while the user is still editing the search.
    this.generation += 1;
    if (!this.interactionEnabled) {
      this.pendingRefresh = true;
      this.pendingQueryRefresh = queryChanged && !otherChanged;
      return;
    }
    if (queryChanged && !otherChanged) this.scheduleQueryOpen();
    else this.openTree(this.view === undefined, 'sort-or-position');
  }

  private onLocateCurrent(): void {
    if (!this.mounted || this.currentChapterIndex < 0) return;
    this.cancelQueryTimer();
    this.locateCurrentPending = true;
    this.settledFlat = false;
    this.openTree(false, 'locate-current');
  }

  private onInteractionChanged(): void {
    if (!this.mounted || this.settledFlat) return;
    if (!this.interactionEnabled) {
      const queryScheduled = this.queryTimer >= 0;
      const opening = this.openingGeneration === this.generation;
      if (queryScheduled) {
        this.cancelQueryTimer();
      }
      if (queryScheduled || opening) {
        this.pendingRefresh = true;
        this.pendingQueryRefresh = queryScheduled;
        this.generation += 1;
        this.openingGeneration = -1;
        this.loadPending = false;
      }
      return;
    }
    if (!this.pendingRefresh) return;
    this.pendingRefresh = false;
    const queryOnly = this.pendingQueryRefresh;
    this.pendingQueryRefresh = false;
    if (queryOnly) this.scheduleQueryOpen();
    else this.openTree(this.view === undefined);
  }

  private cancelQueryTimer(): void {
    if (this.queryTimer < 0) return;
    clearTimeout(this.queryTimer);
    this.queryTimer = -1;
    this.queryTrace?.step('cancelled', 'cancelled');
    this.queryTrace = undefined;
  }

  private scheduleQueryOpen(): void {
    const generation = this.generation;
    const bookId = this.bookId;
    const trace = new ReaderDirectoryTrace('search');
    this.queryTrace = trace;
    this.queryTimer = setTimeout((): void => {
      this.queryTimer = -1;
      this.queryTrace = undefined;
      if (!this.mounted || this.settledFlat || this.generation !== generation || this.bookId !== bookId) {
        trace.step('discarded', 'stale');
        return;
      }
      if (!this.interactionEnabled) {
        this.pendingRefresh = true;
        this.pendingQueryRefresh = true;
        return;
      }
      this.openTree(this.view === undefined, 'search', trace);
    }, 150);
  }

  private onTreeUserScrollIntent(): void {
    const opening = this.openingGeneration === this.generation;
    if (opening || this.queryTimer >= 0) {
      this.cancelQueryTimer();
      this.generation += 1;
      this.openingGeneration = -1;
      this.loadPending = false;
      this.pendingRefresh = true;
      this.pendingQueryRefresh = false;
    }
    this.onUserScrollIntent();
  }

  private onProgrammaticScrollIntent(): void {
    if (!this.mounted || this.settledFlat) return;
    const opening = this.openingGeneration === this.generation;
    if (!opening && this.queryTimer < 0) return;
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.loadPending = false;
    if (this.view === undefined) {
      // A first-opening flat list has no tree scroll-stop callback. Keep its
      // user-chosen viewport stable for this opening.
      this.settledFlat = true;
    } else {
      this.pendingRefresh = true;
      this.pendingQueryRefresh = false;
    }
  }

  private onTreeScrollSettled(): void {
    if (!this.mounted || this.settledFlat || !this.interactionEnabled || !this.pendingRefresh) return;
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.openTree(this.view === undefined);
  }

  private async prepareVisiblePages(gateway: ReaderDirectoryNavigationGateway, bookId: string,
    ready: ReaderDirectoryNavigationReady, generation: number): Promise<ReaderDirectoryNavigationPreparedPage[]> {
    const pageSize = 256;
    if (ready.nodes.length !== Math.min(pageSize, ready.visibleTotal))
      throw new Error('directory first page is incomplete');
    if (ready.visibleTotal === 0) return [];
    cacheReaderDirectoryNavigationPage(ready, 0, { viewId: ready.viewId, visibleTotal: ready.visibleTotal, nodes: ready.nodes, nextOffset: ready.nextOffset });
    ready.nodes = [];
    const anchor = ready.locateCurrent ? undefined : readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId));
    const sameRevision = anchor?.navigationRevision === ready.navigationRevision;
    const target = sameRevision && ready.anchorVisibleIndex !== undefined ? ready.anchorVisibleIndex :
      (ready.currentVisibleIndex ?? 0);
    const offsets: Set<number> = new Set<number>();
    const includeWindow = (index: number): void => {
      const center = Math.floor(index / pageSize) * pageSize;
      for (const offset of [center - pageSize, center, center + pageSize]) {
        if (offset > 0 && offset < ready.visibleTotal) offsets.add(offset);
      }
    };
    includeWindow(target);
    // onDataReloaded may ask the old physical viewport before the saved node
    // is repositioned. Keep that window resolved as well, never as placeholders.
    if (this.view?.viewId === anchor?.viewId &&
      anchor !== undefined && anchor.visibleIndex < ready.visibleTotal)
      includeWindow(anchor.visibleIndex);
    const isCurrent = (): boolean => this.mounted && generation === this.generation && this.bookId === bookId;
    return Promise.all(Array.from(offsets).map(async (offset: number): Promise<ReaderDirectoryNavigationPreparedPage> => {
      const page = await gateway.page(bookId, ready.viewId, offset, isCurrent);
      if (!isCurrent() || page.viewId !== ready.viewId || page.visibleTotal !== ready.visibleTotal ||
        page.nodes.length !== Math.min(pageSize, ready.visibleTotal - offset))
        throw new Error('directory prepared page is stale or incomplete');
      return { offset, page: cacheReaderDirectoryNavigationPage(ready, offset, page) };
    }));
  }

  private openTree(first: boolean, reason: string = 'open', pendingTrace?: ReaderDirectoryTrace): void {
    const gateway = this.gateway;
    const bookId = this.bookId;
    const sourceId = this.sourceId;
    if (gateway === undefined || bookId.length === 0) return;
    const generation = ++this.generation;
    this.loadPending = false;
    this.loadFailed = false;
    if (!this.interactionEnabled) {
      // A Surface may mount inside the initial Quick/Full transition. Keep
      // its ready flat rows visible and admit the tree at the motion endpoint.
      // This is not a missing-navigation or user-interaction flat decision.
      this.openingGeneration = -1;
      this.pendingRefresh = true;
      this.pendingQueryRefresh = false;
      pendingTrace?.step('deferred', 'motion');
      return;
    }
    const trace = pendingTrace ?? new ReaderDirectoryTrace(reason);
    this.openingGeneration = generation;
    this.loadPending = true;
    const query = this.query, descending = !this.ascending;
    const explicitLocateCurrent = this.locateCurrentPending;
    // A fresh Quick opening starts at the current chapter, even when Full left
    // a different browsing anchor. Paging still prepares only its bounded window.
    const locateCurrent = explicitLocateCurrent || first && this.mangaDisplay && this.mangaQuickDisplay &&
      query.trim().length === 0 && this.currentChapterIndex >= 0;
    const anchorNodeId = locateCurrent ? undefined : readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId))?.nodeId;
    const chapterIndex = this.currentChapterIndex >= 0 ? this.currentChapterIndex : undefined;
    let unavailableReason = '';
    const open = (): Promise<ReaderDirectoryNavigationReady | undefined> => openReaderDirectoryNavigation(gateway,
      { sourceId, bookId, query, descending, chapterIndex, anchorNodeId, limit: 256, locateCurrent,
        collapsedNodeIds: this.mangaDisplay && this.mangaQuickDisplay && query.trim().length === 0 ? [] : undefined },
      (): boolean => this.mounted && generation === this.generation && this.bookId === bookId && this.sourceId === sourceId,
      (reason: string): void => {
        unavailableReason = reason;
        if (this.sourceId === 'local') readerDirectoryNoteMissingNavigation(bookId, reason);
      });
    // The permanent tablet catalog can mount without a phone-sheet opening.
    // Admit neither its tree nor its fallback text before the same receipts.
    // Novel callers preserve their existing direct navigation task.
    const opening = this.mangaDisplay ? this.prepareMangaFonts().then((ready: boolean): Promise<ReaderDirectoryNavigationReady | undefined> | undefined => {
      if (!this.mounted || generation !== this.generation || this.bookId !== bookId || this.sourceId !== sourceId) return undefined;
      if (!ready) throw new Error('manga directory fonts are unavailable');
      if (!this.interactionEnabled) {
        this.generation += 1;
        this.openingGeneration = -1;
        this.pendingRefresh = true;
        this.pendingQueryRefresh = false;
        return undefined;
      }
      return open();
    }) : open();
    void opening
      .then(async (ready: ReaderDirectoryNavigationReady | undefined): Promise<void> => {
        trace.step('response', ready === undefined ? 'unavailable' : 'ready');
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId || this.sourceId !== sourceId) return;
        if (ready === undefined) {
          this.openingGeneration = -1;
          this.loadPending = false;
          // Capability absence can use the complete flat catalog. A missing
          // index or failed request remains a recoverable read for this view.
          this.settledFlat = unavailableReason === 'unsupported';
          this.loadFailed = !this.settledFlat;
          if (this.loadFailed) this.notifyReadFailure(generation, sourceId, bookId);
          return;
        }
        if (this.settledFlat || (first && this.interacted)) {
          this.openingGeneration = -1;
          this.loadPending = false;
          this.settledFlat = true;
          return;
        }
        if (!this.interactionEnabled) {
          this.openingGeneration = -1;
          this.loadPending = false;
          this.pendingRefresh = true;
          this.pendingQueryRefresh = false;
          return;
        }
        ready.preparedPages = await this.prepareVisiblePages(gateway, bookId, ready, generation);
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId || this.sourceId !== sourceId) return;
        this.openingGeneration = -1;
        this.loadPending = false;
        if (this.settledFlat || (first && this.interacted)) {
          this.settledFlat = true;
          return;
        }
        if (!this.interactionEnabled) {
          this.pendingRefresh = true;
          this.pendingQueryRefresh = false;
          return;
        }
        if (this.mangaDisplay) {
          ready.currentDisplayInset = explicitLocateCurrent ? 12 : this.mangaCurrentOpenInset;
          ready.currentDisplaySmooth = explicitLocateCurrent;
        }
        this.view = ready;
        this.loadFailed = false;
        this.locateCurrentPending = false;
        this.onTreeStateChange(true);
        trace.step('published');
        if (trace.isEnabled()) try {
          this.getUIContext().postFrameCallback(new ReaderDirectoryTraceFrame((): void => {
            trace.step('frame-callback', this.mounted && generation === this.generation && this.view?.viewId === ready.viewId
              ? 'ready' : 'stale');
          }));
        } catch (_error) { trace.step('frame-callback', 'unavailable'); }
      }).catch((_error: Error): void => {
        const current = this.mounted && generation === this.generation && this.bookId === bookId && this.sourceId === sourceId;
        trace.step('response', current ? 'failed' : 'cancelled');
        if (!current) return;
        this.openingGeneration = -1;
        this.loadPending = false;
        this.loadFailed = true;
        this.notifyReadFailure(generation, sourceId, bookId);
      });
  }

  private hasRetainedContent(): boolean {
    if (this.view !== undefined) return this.view.visibleTotal > 0;
    if (this.query.length === 0) return this.chapterEntries.length > 0;
    return projectReaderDirectoryEntries(this.chapterEntries, this.query, true, this.mangaDisplay).length > 0;
  }

  private notifyReadFailure(generation: number, sourceId: string, bookId: string): void {
    this.feedback.show(() => this.getUIContext(), {
      message: '目录刷新失败，已保留当前条目，可重试加载目录', key: `${sourceId}\u0000${bookId}\u0000directory-read-failed`,
    }, (): boolean => this.mounted && this.interactionEnabled && this.showLoadStatus && this.loadFailed &&
      generation === this.generation && sourceId === this.sourceId && bookId === this.bookId &&
      this.runtimeOwner !== undefined && ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && this.hasRetainedContent());
  }

  private retryOpen(): void {
    if (!this.mounted || !this.interactionEnabled || this.loadPending) return;
    this.cancelQueryTimer();
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.settledFlat = false;
    this.openTree(false, 'retry');
  }

  private toggle(node: ReaderDirectoryNavigationNode): void {
    const view = this.view;
    if (view === undefined || !node.hasChildren) return;
    this.cancelQueryTimer();
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    readerDirectoryToggleCollapsed(readerDirectoryScopeKey(this.sourceId, this.bookId), view.navigationRevision, node.nodeId);
    this.openTree(false, 'fold');
  }

  private invalidate(): void {
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.loadPending = false;
    this.loadFailed = true;
    this.settledFlat = false;
    this.notifyReadFailure(this.generation, this.sourceId, this.bookId);
  }

  build() {
    Column() {
      if (this.showLoadStatus && (this.loadPending || this.loadFailed) &&
        this.hasRetainedContent()) {
        Row({ space: 6 }) {
          if (this.loadPending) {
            Text('正在加载目录')
              .layoutWeight(1).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
              .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
              .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number);
          } else {
            Blank().layoutWeight(1);
          }
          if (this.loadFailed) {
            ReaderRecoveryAction({ label: '重试加载目录', actionEnabled: this.interactionEnabled,
              onReconcile: (): void => this.retryOpen() });
          }
        }.width('100%').padding({ left: 8, right: 8, top: 2, bottom: 2 });
      }
      Stack() {
        if (this.mangaDisplay && !this.mangaFontsReady) {
          Blank().width('100%').height('100%');
        } else if (this.showLoadStatus && !this.hasRetainedContent() &&
          (this.loadPending || this.loadFailed)) {
          Column() {
            ReaderPageState({ loading: this.loadPending, message: this.loadFailed ? '目录加载失败' : '正在加载目录',
              actionLabel: this.loadFailed ? '重试加载目录' : '', actionEnabled: this.interactionEnabled,
              mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
              onAction: (): void => this.retryOpen() });
          }.width('100%').height('100%').justifyContent(FlexAlign.Center);
        } else if (this.view === undefined) {
          this.fallbackBuilder();
        } else {
          Stack({ alignContent: this.mangaDisplay ? Alignment.TopStart : Alignment.Center }) {
            ReaderDirectoryNavigationList({
              view: this.view, sourceId: this.sourceId, bookId: this.bookId, rowHeight: this.rowHeight,
              mangaDisplay: this.mangaDisplay, mangaRowMinHeight: this.mangaRowMinHeight, mangaScheme: this.mangaScheme,
              mangaCatalogDisplay: this.mangaCatalogDisplay, mangaCatalogNarrow: this.mangaCatalogNarrow,
              mangaInitialViewportWidth: this.mangaInitialViewportWidth,
              mangaVisibleTopInset: this.mangaVisibleTopInset,
              mangaQuickDisplay: this.mangaQuickDisplay,
              mangaSearchActive: this.mangaDisplay && this.query.trim().length > 0,
              currentChapterIndex: this.currentChapterIndex,
              listPaddingX: this.listPaddingX, listPaddingY: this.listPaddingY,
              listPaddingRight: this.listPaddingRight,
              listPaddingTop: this.listPaddingTop, listPaddingBottom: this.listPaddingBottom,
              contentStartInset: this.contentStartInset, contentEndInset: this.contentEndInset,
              edgeEffectMode: this.edgeEffectMode, interactionEnabled: this.interactionEnabled,
              chapterEntries: this.chapterEntries,
              chapterDownloadEnabled: this.chapterDownloadEnabled,
              chapterDownloadActionsEnabled: this.chapterDownloadActionsEnabled,
              chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
              scroller: this.scroller,
              onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void =>
                this.onSelectTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
              onToggleNode: (node: ReaderDirectoryNavigationNode): void => this.toggle(node),
              onUserScrollIntent: (): void => this.onTreeUserScrollIntent(),
              onScrollSettled: (): void => this.onTreeScrollSettled(),
              onFirstLayout: (): void => this.onFirstLayout(),
              onScrollOffset: (offset: number): void => this.onScrollOffset(offset),
              onClearSearch: (): void => this.onClearSearch(),
              onInvalidated: (): void => this.invalidate(),
              onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
              onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
              onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
                this.onCreateChapterStartBookmark(request),
            });
            if (this.view.visibleTotal === 0 && !this.mangaDisplay) {
              ReaderPageState({ message: '没有匹配的目录项', padded: false,
                mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) })
                .hitTestBehavior(HitTestMode.None);
            }
          }.width('100%').height('100%');
        }
      }.width('100%').layoutWeight(1);
    }.width('100%').height('100%');
  }
}
