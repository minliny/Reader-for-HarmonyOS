import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, type ReaderDirectoryNavigationNode,
  type ReaderDirectoryNavigationReady, type ReaderDirectoryNavigationPage } from './ReaderDirectoryNavigation';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { LengthMetrics } from '@kit.ArkUI';
import { readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor,
  type ReaderDirectoryViewportAnchor } from './ReaderDirectoryViewport';

const DIRECTORY_PAGE_SIZE: number = 256;
const DIRECTORY_RETAINED_PAGES: number = 12;

interface ReaderDirectoryNavigationItem {
  key: string;
  node?: ReaderDirectoryNavigationNode;
  index: number;
}

interface ReaderDirectoryNavigationPendingPage {
  offset: number;
  page: ReaderDirectoryNavigationPage;
}

interface ReaderDirectoryPositionPlan {
  viewId: string;
  index: number;
  rowFraction: number;
  align: ScrollAlign;
}

class ReaderDirectoryNavigationDataSource implements IDataSource {
  private view: ReaderDirectoryNavigationReady | undefined = undefined;
  private nodes: Map<number, ReaderDirectoryNavigationNode> = new Map<number, ReaderDirectoryNavigationNode>();
  private pageOrder: number[] = [];
  private pending: Set<number> = new Set<number>();
  private listeners: DataChangeListener[] = [];
  private load: (offset: number) => void;

  constructor(load: (offset: number) => void) { this.load = load; }
  totalCount(): number { return this.view?.visibleTotal ?? 0; }
  currentView(): ReaderDirectoryNavigationReady | undefined { return this.view; }
  loadedNode(index: number): ReaderDirectoryNavigationNode | undefined { return this.nodes.get(index); }
  private touchPage(offset: number): void {
    const previous = this.pageOrder.indexOf(offset);
    if (previous >= 0) this.pageOrder.splice(previous, 1);
    this.pageOrder.push(offset);
    while (this.pageOrder.length > DIRECTORY_RETAINED_PAGES) {
      const oldest = this.pageOrder.shift() as number;
      for (let index = oldest; index < oldest + DIRECTORY_PAGE_SIZE; index += 1) this.nodes.delete(index);
    }
  }
  getData(index: number): ReaderDirectoryNavigationItem {
    const node = this.nodes.get(index);
    if (node !== undefined) this.touchPage(Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE);
    if (node === undefined && index >= 0 && index < this.totalCount()) {
      const offset = Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE;
      if (!this.pending.has(offset)) {
        this.pending.add(offset);
        this.load(offset);
      }
    }
    return { key: node?.nodeId ?? `loading:${index}`, node, index };
  }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((item: DataChangeListener): boolean => item !== listener);
  }
  replace(view: ReaderDirectoryNavigationReady): void {
    if (this.view?.viewId === view.viewId) return;
    this.view = view;
    this.nodes.clear(); this.pending.clear(); this.pageOrder = [];
    view.nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => { this.nodes.set(index, node); });
    if (view.nodes.length > 0) this.touchPage(0);
    for (const listener of this.listeners) listener.onDataReloaded();
  }
  admit(offset: number, page: ReaderDirectoryNavigationPage): void {
    if (this.view === undefined || page.viewId !== this.view.viewId || page.visibleTotal !== this.view.visibleTotal) return;
    this.pending.delete(offset);
    if (page.nodes.length > 0) this.touchPage(offset);
    page.nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
      const position = offset + index;
      const previous = this.nodes.get(position);
      if (previous?.nodeId === node.nodeId && previous.expanded === node.expanded) return;
      this.nodes.set(position, node);
      for (const listener of this.listeners) listener.onDataChanged(position);
    });
  }
  failed(offset: number): void { this.pending.delete(offset); }
  changedChapters(chapters: Set<number>): void {
    if (chapters.size === 0) return;
    this.nodes.forEach((node: ReaderDirectoryNavigationNode, position: number): void => {
      if (node.chapterIndex === undefined || !chapters.has(node.chapterIndex)) return;
      for (const listener of this.listeners) listener.onDataChanged(position);
    });
  }
}

/** Virtual, Core-paged display rows. Its placeholders never claim a chapter identity. */
@Component
export struct ReaderDirectoryNavigationList {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onViewChanged') view: ReaderDirectoryNavigationReady;
  @Prop bookId: string = '';
  @Prop rowHeight: number = 40;
  @Prop listPaddingX: number = 10;
  @Prop listPaddingY: number = 5;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('onChapterEntriesChanged') chapterEntries: LocalReadingTocEntry[] = [];
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope: RemoteReadingPositionScope) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope: RemoteReadingPositionScope): void => {};
  onToggleNode: (node: ReaderDirectoryNavigationNode) => void = (_node: ReaderDirectoryNavigationNode): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onFirstLayout: () => void = (): void => {};
  onInvalidated: () => void = (): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  private dataSource: ReaderDirectoryNavigationDataSource =
    new ReaderDirectoryNavigationDataSource((offset: number): void => this.loadPage(offset));
  private gateway: ReaderDirectoryNavigationGateway | undefined = undefined;
  private mounted: boolean = false;
  private generation: number = 0;
  private layoutReady: boolean = false;
  private chapterByIndex: Map<number, LocalReadingTocEntry> = new Map<number, LocalReadingTocEntry>();
  private chapterSignatures: Map<number, string> = new Map<number, string>();
  private chapterSource: LocalReadingTocEntry[] | undefined = undefined;
  private initialPositionPending: boolean = true;
  private positionPlan: ReaderDirectoryPositionPlan | undefined = undefined;
  private firstVisibleIndex: number = 0;
  private selectionGeneration: number = 0;
  private pendingPages: ReaderDirectoryNavigationPendingPage[] = [];

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.layoutReady = false;
    this.initialPositionPending = true;
    this.pendingPages = [];
    this.gateway = new ReaderDirectoryNavigationGateway(ReaderRuntimeOwner.current());
    this.dataSource.replace(this.view);
    this.positionPlan = this.planPosition();
    this.onChapterEntriesChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false; this.generation += 1; this.selectionGeneration += 1; this.pendingPages = [];
  }

  private onViewChanged(): void {
    if (!this.mounted) return;
    if (this.dataSource.currentView()?.viewId === this.view.viewId) return;
    this.captureViewportAnchor();
    this.generation += 1;
    this.selectionGeneration += 1;
    this.pendingPages = [];
    this.positionPlan = this.planPosition();
    this.initialPositionPending = this.positionPlan !== undefined;
    this.dataSource.replace(this.view);
    this.schedulePosition();
  }

  private onInteractionChanged(): void {
    if (!this.mounted) return;
    if (!this.interactionEnabled) {
      this.captureViewportAnchor();
      return;
    }
    const generation = this.generation;
    // @Watch runs in ArkUI reconciliation. Publish DataSource notifications
    // on the next turn, after the motion endpoint's component update exits.
    setTimeout((): void => {
      if (!this.mounted || !this.interactionEnabled || generation !== this.generation) return;
      const pages = this.pendingPages;
      this.pendingPages = [];
      for (const item of pages) this.dataSource.admit(item.offset, item.page);
      const anchor = readerDirectoryViewportAnchor(this.bookId);
      if (anchor !== undefined && anchor.viewId === this.view.viewId &&
        anchor.navigationRevision === this.view.navigationRevision) {
        this.positionPlan = { viewId: this.view.viewId, index: anchor.visibleIndex,
          rowFraction: anchor.rowFraction, align: ScrollAlign.START };
        this.initialPositionPending = true;
        this.positionInitialCurrent();
      }
    }, 0);
  }

  private captureViewportAnchor(): void {
    const view = this.dataSource.currentView();
    const index = this.firstVisibleIndex;
    const node = this.dataSource.loadedNode(index);
    if (view === undefined || node === undefined || this.scroller === undefined) return;
    try {
      const rect = this.scroller.getItemRect(index);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return;
      const anchor: ReaderDirectoryViewportAnchor = { bookId: this.bookId,
        navigationRevision: view.navigationRevision, viewId: view.viewId,
        nodeId: node.nodeId, visibleIndex: index, rowFraction: -rect.y / rect.height };
      readerDirectorySaveViewportAnchor(anchor);
    } catch (_error) { /* The native List may be between layout frames. */ }
  }

  private planPosition(): ReaderDirectoryPositionPlan | undefined {
    const anchor = readerDirectoryViewportAnchor(this.bookId);
    if (anchor !== undefined && anchor.navigationRevision === this.view.navigationRevision) {
      const index = this.view.anchorVisibleIndex ??
        (anchor.viewId === this.view.viewId ? anchor.visibleIndex : undefined);
      if (index !== undefined && index < this.view.visibleTotal) {
        return { viewId: this.view.viewId, index, rowFraction: anchor.rowFraction, align: ScrollAlign.START };
      }
    }
    if (this.view.currentVisibleIndex !== undefined)
      return { viewId: this.view.viewId, index: this.view.currentVisibleIndex,
        rowFraction: 0, align: ScrollAlign.CENTER };
    if (this.view.visibleTotal > 0)
      return { viewId: this.view.viewId, index: 0, rowFraction: 0, align: ScrollAlign.START };
    return undefined;
  }

  private schedulePosition(): void {
    const generation = this.generation;
    setTimeout((): void => {
      if (this.mounted && generation === this.generation) this.positionInitialCurrent();
    }, 0);
  }

  private onChapterEntriesChanged(): void {
    if (this.chapterSource === this.chapterEntries) return;
    this.chapterSource = this.chapterEntries;
    const previous = this.chapterSignatures;
    const next = new Map<number, string>();
    const changed = new Set<number>();
    this.chapterByIndex.clear();
    for (const chapter of this.chapterEntries) {
      this.chapterByIndex.set(chapter.index, chapter);
      const signature = `${chapter.title}:${chapter.bookmarks === undefined ? '?' :
        chapter.bookmarks.map((bookmark): number => bookmark.time).join(',')}`;
      next.set(chapter.index, signature);
      if (previous.get(chapter.index) !== signature) changed.add(chapter.index);
    }
    for (const index of previous.keys()) if (!next.has(index)) changed.add(index);
    this.chapterSignatures = next;
    this.dataSource.changedChapters(changed);
  }

  private marker(chapter: LocalReadingTocEntry): void {
    const state = readerDirectoryBookmarkMarkerState(chapter);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled)
      this.onCreateChapterStartBookmark(state.createRequest);
  }

  private positionInitialCurrent(): void {
    if (!this.initialPositionPending || this.scroller === undefined) return;
    const plan = this.positionPlan ?? this.planPosition();
    if (plan === undefined || plan.viewId !== this.view.viewId) return;
    try {
      if (plan.align === ScrollAlign.START) {
        this.scroller.scrollToIndex(plan.index, false, ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(plan.rowFraction * this.rowHeight) });
      } else {
        this.scroller.scrollToIndex(plan.index, false, ScrollAlign.CENTER);
      }
      this.initialPositionPending = false;
      this.positionPlan = undefined;
    } catch (_error) { /* Native layout will call again after its first frame. */ }
  }

  private selectTarget(node: ReaderDirectoryNavigationNode): void {
    if (node.kind !== 'target' || node.chapterIndex === undefined || this.gateway === undefined) return;
    const generation = this.generation;
    const selection = ++this.selectionGeneration;
    const viewId = this.view.viewId, bookId = this.bookId;
    void this.gateway.resolveTarget(bookId, viewId, node.nodeId,
      (): boolean => this.mounted && generation === this.generation && selection === this.selectionGeneration &&
        viewId === this.view.viewId && bookId === this.bookId)
      .then((target): void => {
        if (!this.mounted || generation !== this.generation || selection !== this.selectionGeneration ||
          viewId !== this.view.viewId || bookId !== this.bookId) return;
        this.onSelectTarget(target.chapterIndex, target.chapterOffsetScalar, target.positionScope);
      }).catch((_error: Error): void => {
        if (this.mounted && generation === this.generation && selection === this.selectionGeneration)
          this.onInvalidated();
      });
  }

  private loadPage(offset: number): void {
    const generation = this.generation;
    const viewId = this.view.viewId;
    const bookId = this.bookId;
    const gateway = this.gateway;
    if (gateway === undefined) return;
    // LazyForEach can ask for data during render. Defer all Core and List
    // mutations until after that render has returned.
    setTimeout((): void => {
      if (!this.mounted || generation !== this.generation || viewId !== this.view.viewId) return;
      void gateway.page(bookId, viewId, offset,
        (): boolean => this.mounted && generation === this.generation && viewId === this.view.viewId)
        .then((page: ReaderDirectoryNavigationPage): void => {
          if (!this.mounted || generation !== this.generation || viewId !== this.view.viewId) return;
          if (this.interactionEnabled) this.dataSource.admit(offset, page);
          else {
            const pending: ReaderDirectoryNavigationPendingPage = { offset, page };
            this.pendingPages.push(pending);
          }
        }).catch((_error: Error): void => {
          this.dataSource.failed(offset);
          if (this.mounted && generation === this.generation && viewId === this.view.viewId) this.onInvalidated();
        });
    }, 0);
  }

  @Builder
  private row(item: ReaderDirectoryNavigationItem) {
    Row() {
      if (item.node === undefined) {
        Text('…').fontSize(11).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      } else {
        if (item.index === this.view.currentVisibleIndex || item.node.nodeId === this.view.currentAncestorNodeId) {
          Row().width(3).height(this.rowHeight).borderRadius(999)
            .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(item.node.title)
          .layoutWeight(1)
          .padding({ left: 9 + Math.min(3, Math.max(0, item.node.depth - 1)) * 12, right: 9 })
          .fontFamily('ReaderNotoSansSC').fontSize(11).fontWeight(500)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(item.node.kind === 'group' ?
            `${item.node.nodeId === this.view.currentAncestorNodeId ? '当前章在此组，' : ''}第${item.node.depth}级分组：${item.node.title}，${item.node.expanded ? '已展开' : '已折叠'}` :
            `${item.node.nodeId === this.view.currentAncestorNodeId ? '当前章在此标题下，' : ''}第${item.node.depth}级，打开${item.node.title}`)
          .onClick((): void => {
            const node = item.node;
            if (node === undefined) return;
            if (node.kind === 'group') this.onToggleNode(node);
            else this.selectTarget(node);
          });
        if (item.node.hasChildren) {
          Text(item.node.expanded ? '⌄' : '›')
            .width(34).height(this.rowHeight).fontSize(18)
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center)
            .accessibilityText(`${item.node.expanded ? '折叠' : '展开'}${item.node.title}子目录`)
            .onClick((): void => { if (item.node !== undefined) this.onToggleNode(item.node); });
        }
        if (item.node.kind === 'target' && item.node.chapterIndex !== undefined &&
          this.chapterByIndex.get(item.node.chapterIndex)?.bookmarks !== undefined) {
          Stack() {
            Image((this.chapterByIndex.get(item.node.chapterIndex)?.bookmarks?.length ?? 0) > 0 ?
              (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
              (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
              .width(15).height(15);
          }.width(26).height(this.rowHeight)
            .accessibilityText((this.chapterByIndex.get(item.node.chapterIndex)?.bookmarks?.length ?? 0) > 0 ?
              '删除本章已有书签' : '添加本章章首书签')
            .onClick((): void => {
              const chapter = this.chapterByIndex.get(item.node?.chapterIndex ?? -1);
              if (chapter !== undefined) this.marker(chapter);
            });
        }
      }
    }
    .width('100%').height(this.rowHeight).borderRadius(6)
    .backgroundColor(item.index === this.view.currentVisibleIndex ||
      item.node?.nodeId === this.view.currentAncestorNodeId ?
      readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
  }

  build() {
    List({ space: 0, scroller: this.scroller }) {
      LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
        ListItem() { this.row(item); }.width('100%').height(this.rowHeight);
      }, (item: ReaderDirectoryNavigationItem): string => `reader-navigation:${item.key}`);
    }
    .width('100%').height('100%')
    .padding({ left: this.listPaddingX, right: this.listPaddingX,
      top: this.listPaddingY, bottom: this.listPaddingY })
    .scrollBar(BarState.Off).edgeEffect(this.edgeEffectMode)
    .enableScrollInteraction(this.interactionEnabled)
    .cachedCount(4)
    .onWillStartDragging((): void => {
      this.initialPositionPending = false;
      this.positionPlan = undefined;
      this.onUserScrollIntent();
    })
    .onScrollIndex((start: number, _end: number, _center: number): void => {
      this.firstVisibleIndex = start;
      if (!this.initialPositionPending) this.captureViewportAnchor();
    })
    .onScrollStop((): void => this.captureViewportAnchor())
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      if (!this.layoutReady && Number(newArea.height) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
        this.positionInitialCurrent();
      }
    });
  }
}
