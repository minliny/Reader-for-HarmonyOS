import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, openReaderDirectoryNavigation,
  readerDirectoryNoteMissingNavigation, readerDirectoryToggleCollapsed,
  type ReaderDirectoryNavigationNode, type ReaderDirectoryNavigationReady } from './ReaderDirectoryNavigation';
import { ReaderDirectoryNavigationList } from './ReaderDirectoryNavigationList';
import { readerDirectoryViewportAnchor } from './ReaderDirectoryViewport';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';

/** A directory opening is admitted once. If navigation is absent or an index
 * is not ready, the supplied chapter list stays visible for this opening. */
@Component
export struct ReaderDirectoryNavigationSurface {
  @Prop @Watch('onIdentityChanged') bookId: string = '';
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
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope: RemoteReadingPositionScope) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope: RemoteReadingPositionScope): void => {};
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
  private lastQuery: string = '';
  private lastAscending: boolean = true;
  private lastChapterIndex: number = -1;

  aboutToAppear(): void {
    this.mounted = true;
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
    else this.openTree(this.view === undefined);
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
  }

  private scheduleQueryOpen(): void {
    const generation = this.generation;
    const bookId = this.bookId;
    this.queryTimer = setTimeout((): void => {
      this.queryTimer = -1;
      if (!this.mounted || this.settledFlat || this.generation !== generation || this.bookId !== bookId) return;
      if (!this.interactionEnabled) {
        this.pendingRefresh = true;
        this.pendingQueryRefresh = true;
        return;
      }
      this.openTree(this.view === undefined);
    }, 150);
  }

  private openTree(first: boolean): void {
    const gateway = this.gateway;
    const bookId = this.bookId;
    if (gateway === undefined || bookId.length === 0) return;
    const generation = ++this.generation;
    this.openingGeneration = generation;
    const query = this.query, descending = !this.ascending;
    const anchorNodeId = readerDirectoryViewportAnchor(bookId)?.nodeId;
    const chapterIndex = this.currentChapterIndex >= 0 ? this.currentChapterIndex : undefined;
    void openReaderDirectoryNavigation(gateway, { bookId, query, descending, chapterIndex, anchorNodeId, limit: 256 },
      (): boolean => this.mounted && generation === this.generation && this.bookId === bookId,
      (reason: string): void => readerDirectoryNoteMissingNavigation(bookId, reason))
      .then((ready: ReaderDirectoryNavigationReady | undefined): void => {
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId) return;
        this.openingGeneration = -1;
        if (ready === undefined) {
          if (first) {
            this.settledFlat = true;
            // The reading owner may repair old EPUBs after a readable first
            // frame. The visible directory never starts archive parsing.
          }
          return;
        }
        if (this.settledFlat || (first && (this.interacted || !this.interactionEnabled))) {
          this.settledFlat = true;
          return;
        }
        this.view = ready;
        this.onTreeStateChange(true);
      }).catch((_error: Error): void => {
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
    readerDirectoryToggleCollapsed(this.bookId, view.navigationRevision, node.nodeId);
    this.openTree(false);
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
        view: this.view, bookId: this.bookId, rowHeight: this.rowHeight,
        listPaddingX: this.listPaddingX, listPaddingY: this.listPaddingY,
        edgeEffectMode: this.edgeEffectMode, interactionEnabled: this.interactionEnabled,
        chapterEntries: this.chapterEntries,
        chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
        scroller: this.scroller,
        onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope: RemoteReadingPositionScope): void =>
          this.onSelectTarget(chapterIndex, chapterOffsetScalar, positionScope),
        onToggleNode: (node: ReaderDirectoryNavigationNode): void => this.toggle(node),
        onUserScrollIntent: (): void => this.onUserScrollIntent(),
        onFirstLayout: (): void => this.onFirstLayout(),
        onInvalidated: (): void => this.invalidate(),
        onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          this.onCreateChapterStartBookmark(request),
      });
    }
  }
}
