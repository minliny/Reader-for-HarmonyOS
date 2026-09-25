import { FrameCallback } from '@kit.ArkUI';
import { ReaderDirectoryTrace } from './ReaderDirectoryTrace';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, openReaderDirectoryNavigation,
  readerDirectoryNoteMissingNavigation, readerDirectoryToggleCollapsed,
  type ReaderDirectoryNavigationNode, type ReaderDirectoryNavigationReady,
  type ReaderDirectoryNavigationPreparedPage } from './ReaderDirectoryNavigation';
import { ReaderDirectoryNavigationList, cacheReaderDirectoryNavigationPage } from './ReaderDirectoryNavigationList';
import { readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor } from './ReaderDirectoryViewport';
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
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onIdentityChanged') sourceId: string = 'local';
  @Prop @Watch('onViewInputsChanged') query: string = '';
  @Prop @Watch('onViewInputsChanged') ascending: boolean = true;
  @Prop @Watch('onViewInputsChanged') currentChapterIndex: number = -1;
  @Prop @Watch('onIdentityChanged') openRevision: string = '';
  @Prop interacted: boolean = false;
  @Prop rowHeight: number = 40;
  @Prop listPaddingX: number = 10;
  @Prop listPaddingY: number = 5;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop chapterEntries: LocalReadingTocEntry[] = [];
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: JsonObject): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onFirstLayout: () => void = (): void => {};
  onTreeStateChange: (active: boolean) => void = (_active: boolean): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  @BuilderParam fallbackBuilder: () => void;
  @State private view: ReaderDirectoryNavigationReady | undefined = undefined;
  private gateway: ReaderDirectoryNavigationGateway | undefined = undefined;
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
  private scrollIntentUnsubscribe: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.scrollIntentUnsubscribe = readerDirectoryObserveScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onProgrammaticScrollIntent());
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    this.gateway = new ReaderDirectoryNavigationGateway(ReaderRuntimeOwner.current());
    this.openTree(true);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.scrollIntentUnsubscribe?.();
    this.scrollIntentUnsubscribe = undefined;
  }

  private onIdentityChanged(): void {
    if (!this.mounted) return;
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.view = undefined;
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
    const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId));
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
    if (gateway === undefined || bookId.length === 0) return;
    const generation = ++this.generation;
    const trace = pendingTrace ?? new ReaderDirectoryTrace(reason);
    this.openingGeneration = generation;
    const query = this.query, descending = !this.ascending;
    const anchorNodeId = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId))?.nodeId;
    const chapterIndex = this.currentChapterIndex >= 0 ? this.currentChapterIndex : undefined;
    void openReaderDirectoryNavigation(gateway, { sourceId: this.sourceId, bookId, query, descending, chapterIndex, anchorNodeId, limit: 256 },
      (): boolean => this.mounted && generation === this.generation && this.bookId === bookId,
      (reason: string): void => { if (this.sourceId === 'local') readerDirectoryNoteMissingNavigation(bookId, reason); })
      .then(async (ready: ReaderDirectoryNavigationReady | undefined): Promise<void> => {
        trace.step('response', ready === undefined ? 'unavailable' : 'ready');
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId) return;
        if (ready === undefined) {
          this.openingGeneration = -1;
          if (first) {
            this.settledFlat = true;
            // The reading owner may repair old EPUBs after a readable first
            // frame. The visible directory never starts archive parsing.
          }
          return;
        }
        if (this.settledFlat || (first && (this.interacted || !this.interactionEnabled))) {
          this.openingGeneration = -1;
          this.settledFlat = true;
          return;
        }
        ready.preparedPages = await this.prepareVisiblePages(gateway, bookId, ready, generation);
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId) return;
        this.openingGeneration = -1;
        if (this.settledFlat || (first && (this.interacted || !this.interactionEnabled))) {
          this.settledFlat = true;
          return;
        }
        this.view = ready;
        this.onTreeStateChange(true);
        trace.step('published');
        if (trace.isEnabled()) try {
          this.getUIContext().postFrameCallback(new ReaderDirectoryTraceFrame((): void => {
            trace.step('frame-callback', this.mounted && generation === this.generation && this.view?.viewId === ready.viewId
              ? 'ready' : 'stale');
          }));
        } catch (_error) { trace.step('frame-callback', 'unavailable'); }
      }).catch((_error: Error): void => {
        trace.step('response', 'failed');
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId) return;
        this.openingGeneration = -1;
        if (first) this.settledFlat = true;
      });
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
    this.view = undefined;
    this.onTreeStateChange(false);
    this.settledFlat = true;
  }

  build() {
    if (this.view === undefined) {
      this.fallbackBuilder();
    } else {
      ReaderDirectoryNavigationList({
        view: this.view, sourceId: this.sourceId, bookId: this.bookId, rowHeight: this.rowHeight,
        listPaddingX: this.listPaddingX, listPaddingY: this.listPaddingY,
        edgeEffectMode: this.edgeEffectMode, interactionEnabled: this.interactionEnabled,
        chapterEntries: this.chapterEntries,
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        scroller: this.scroller,
        onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void =>
          this.onSelectTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
        onToggleNode: (node: ReaderDirectoryNavigationNode): void => this.toggle(node),
        onUserScrollIntent: (): void => this.onTreeUserScrollIntent(),
        onScrollSettled: (): void => this.onTreeScrollSettled(),
        onFirstLayout: (): void => this.onFirstLayout(),
        onInvalidated: (): void => this.invalidate(),
        onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          this.onCreateChapterStartBookmark(request),
      });
    }
  }
}
