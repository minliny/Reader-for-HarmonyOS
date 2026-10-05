import type { JsonObject } from '@reader/core-harmony';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600 } from '../common/ReaderFontFamilies';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, type ReaderDirectoryNavigationNode,
  type ReaderDirectoryNavigationReady, type ReaderDirectoryNavigationPage } from './ReaderDirectoryNavigation';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { LengthMetrics } from '@kit.ArkUI';
import { util } from '@kit.ArkTS';
import { readerDirectoryObserveScrollCommand, readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor,
  type ReaderDirectoryViewportAnchor } from './ReaderDirectoryViewport';

const DIRECTORY_PAGE_SIZE: number = 256;
const DIRECTORY_RETAINED_PAGES: number = 12;

// One platform LRU across Quick, Full, detail and their prepared windows.
const directoryPages: util.LRUCache<string, ReaderDirectoryNavigationNode[]> =
  new util.LRUCache<string, ReaderDirectoryNavigationNode[]>(DIRECTORY_RETAINED_PAGES);

function directoryPagePrefix(view: ReaderDirectoryNavigationReady): string {
  const identity = view.identity;
  return `${JSON.stringify([readerDirectoryScopeKey(identity?.sourceId ?? 'local', identity?.bookId ?? ''), view.navigationRevision, view.viewId])}:`;
}

/** Prepared and motion-deferred pages consume the same global 12-page budget. */
export function cacheReaderDirectoryNavigationPage(view: ReaderDirectoryNavigationReady, offset: number,
  page: ReaderDirectoryNavigationPage): ReaderDirectoryNavigationPage {
  if (page.nodes.length > 0) directoryPages.put(`${directoryPagePrefix(view)}${offset}`, page.nodes);
  return { viewId: page.viewId, visibleTotal: page.visibleTotal, nextOffset: page.nextOffset, nodes: [] };
}

class ReaderDirectoryPageWindow {
  private prefix: string = '';
  bind(view: ReaderDirectoryNavigationReady): void {
    this.prefix = directoryPagePrefix(view);
  }
  get(offset: number): ReaderDirectoryNavigationNode[] | undefined { return directoryPages.get(`${this.prefix}${offset}`); }
  put(offset: number, nodes: ReaderDirectoryNavigationNode[]): void { directoryPages.put(`${this.prefix}${offset}`, nodes); }
  keys(): number[] {
    return directoryPages.keys().filter((key: string): boolean => key.startsWith(this.prefix))
      .map((key: string): number => Number(key.substring(this.prefix.length)));
  }
}

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
  currentInset?: number;
  smooth?: boolean;
}

class ReaderDirectoryNavigationDataSource implements IDataSource {
  private view: ReaderDirectoryNavigationReady | undefined = undefined;
  private pages: ReaderDirectoryPageWindow = new ReaderDirectoryPageWindow();
  private pending: Set<number> = new Set<number>();
  private listeners: DataChangeListener[] = [];
  private load: (offset: number) => void;

  constructor(load: (offset: number) => void) { this.load = load; }
  totalCount(): number { return this.view?.visibleTotal ?? 0; }
  currentView(): ReaderDirectoryNavigationReady | undefined { return this.view; }
  loadedNode(index: number): ReaderDirectoryNavigationNode | undefined {
    const offset = Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE;
    return this.pages.get(offset)?.[index - offset];
  }
  loadedItemById(nodeId: string): ReaderDirectoryNavigationItem | undefined {
    // Only the existing 12-page window is searched. Core owns the full tree.
    for (const offset of this.pages.keys()) {
      const page = this.pages.get(offset);
      if (page === undefined) continue;
      const index = page.findIndex((node: ReaderDirectoryNavigationNode): boolean => node.nodeId === nodeId);
      if (index >= 0) return { key: nodeId, node: page[index], index: offset + index };
    }
    return undefined;
  }
  getData(index: number): ReaderDirectoryNavigationItem {
    const node = this.loadedNode(index);
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
    const previousById: Map<string, ReaderDirectoryNavigationNode> = new Map<string, ReaderDirectoryNavigationNode>();
    for (const offset of this.pages.keys()) {
      this.pages.get(offset)?.forEach((node: ReaderDirectoryNavigationNode): void => {
        previousById.set(node.nodeId, node);
      });
    }
    const highlighted: Set<string> = new Set<string>();
    if (this.view?.currentAncestorNodeId !== undefined) highlighted.add(this.view.currentAncestorNodeId);
    const oldCurrent = this.view?.currentVisibleIndex === undefined ? undefined :
      this.loadedNode(this.view.currentVisibleIndex);
    if (oldCurrent !== undefined) highlighted.add(oldCurrent.nodeId);
    this.view = view;
    this.pages.bind(view); this.pending.clear();
    if (view.nodes.length > 0) this.pages.put(0, view.nodes);
    for (const prepared of view.preparedPages ?? []) {
      if (prepared.offset <= 0 || prepared.page.viewId !== view.viewId ||
        prepared.page.visibleTotal !== view.visibleTotal) continue;
      if (prepared.page.nodes.length > 0) this.pages.put(prepared.offset, prepared.page.nodes);
    }
    // Pages are now owned solely by the bounded process cache.
    view.nodes = [];
    view.preparedPages = undefined;
    if (view.currentAncestorNodeId !== undefined) highlighted.add(view.currentAncestorNodeId);
    const newCurrent = view.currentVisibleIndex === undefined ? undefined : this.loadedNode(view.currentVisibleIndex);
    if (newCurrent !== undefined) highlighted.add(newCurrent.nodeId);
    const changed: Set<number> = new Set<number>();
    // A reload reuses equal nodeId children. Refresh only loaded rows whose
    // captured expanded bit or current-row styling may have changed.
    for (const offset of this.pages.keys()) {
      this.pages.get(offset)?.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
        const old = previousById.get(node.nodeId);
        if (old !== undefined && (old.expanded !== node.expanded || old.title !== node.title ||
          old.parentTitle !== node.parentTitle || old.readableDescendantCount !== node.readableDescendantCount ||
          old.depth !== node.depth || old.kind !== node.kind || highlighted.has(node.nodeId)))
          changed.add(offset + index);
      });
    }
    for (const listener of this.listeners) listener.onDataReloaded();
    if (changed.size > 0) setTimeout((): void => {
      if (this.view?.viewId !== view.viewId) return;
      for (const position of changed) {
        for (const listener of this.listeners) listener.onDataChanged(position);
      }
    }, 0);
  }
  admit(offset: number, page: ReaderDirectoryNavigationPage): void {
    if (this.view === undefined || page.viewId !== this.view.viewId || page.visibleTotal !== this.view.visibleTotal) return;
    this.pending.delete(offset);
    if (page.nodes.length === 0) {
      const cached = this.pages.get(offset);
      if (cached === undefined) { this.load(offset); return; }
      page = { viewId: page.viewId, visibleTotal: page.visibleTotal, nextOffset: page.nextOffset, nodes: cached };
    }
    const previousPage = this.pages.get(offset);
    if (page.nodes.length > 0) this.pages.put(offset, page.nodes);
    page.nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
      const position = offset + index;
      const previous = previousPage?.[index];
      if (previous?.nodeId === node.nodeId && previous.expanded === node.expanded && previous.title === node.title &&
        previous.parentTitle === node.parentTitle && previous.readableDescendantCount === node.readableDescendantCount &&
        previous.depth === node.depth && previous.kind === node.kind) return;
      for (const listener of this.listeners) listener.onDataChanged(position);
    });
  }
  failed(offset: number): void { this.pending.delete(offset); }
  changedChapters(chapters: Set<number>): void {
    if (chapters.size === 0) return;
    for (const offset of this.pages.keys()) {
      const page = this.pages.get(offset);
      page?.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
        if (node.chapterIndex === undefined || !chapters.has(node.chapterIndex)) return;
        for (const listener of this.listeners) listener.onDataChanged(offset + index);
      });
    }
  }
}

/** Virtual, Core-paged display rows. Its placeholders never claim a chapter identity. */
@Component
export struct ReaderDirectoryNavigationList {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onViewChanged') view: ReaderDirectoryNavigationReady;
  @Prop bookId: string = '';
  @Prop sourceId: string = 'local';
  @Prop rowHeight: number = 40;
  @Prop mangaDisplay: boolean = false;
  @Prop mangaRowMinHeight: number = 58;
  @Prop mangaCatalogDisplay: boolean = false;
  @Prop mangaCatalogNarrow: boolean = false;
  @Prop mangaSearchActive: boolean = false;
  @State private mangaPresentationRevision: number = 0;
  @Prop mangaScheme: string = '';
  @Prop currentChapterIndex: number = -1;
  @Prop listPaddingX: number = 10;
  @Prop listPaddingRight: number = -1;
  @Prop listPaddingY: number = 5;
  @Prop listPaddingTop: number = -1;
  @Prop listPaddingBottom: number = -1;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('onChapterEntriesChanged') chapterEntries: LocalReadingTocEntry[] = [];
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop chapterDownloadActionsEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: JsonObject): void => {};
  onToggleNode: (node: ReaderDirectoryNavigationNode) => void = (_node: ReaderDirectoryNavigationNode): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onScrollSettled: () => void = (): void => {};
  onFirstLayout: () => void = (): void => {};
  onInvalidated: () => void = (): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
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
  private scrollCommandUnsubscribe: (() => void) | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.layoutReady = false;
    this.initialPositionPending = true;
    this.pendingPages = [];
    this.gateway = new ReaderDirectoryNavigationGateway(ReaderRuntimeOwner.current());
    this.scrollCommandUnsubscribe = readerDirectoryObserveScrollCommand(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onScrollCommand());
    this.dataSource.replace(this.view);
    this.mangaPresentationRevision += 1;
    this.positionPlan = this.planPosition();
    this.onChapterEntriesChanged();
  }

  aboutToDisappear(): void {
    this.captureViewportAnchor();
    this.scrollCommandUnsubscribe?.();
    this.scrollCommandUnsubscribe = undefined;
    this.mounted = false; this.generation += 1; this.selectionGeneration += 1; this.pendingPages = [];
  }

  private onScrollCommand(): void {
    const generation = this.generation;
    // A no-op at the current edge need not produce ArkUI onScrollStop. Let
    // scrollEdge update native geometry, then reuse the normal settle path.
    setTimeout((): void => {
      if (!this.mounted || generation !== this.generation) return;
      this.captureViewportAnchor();
      this.onScrollSettled();
    }, 0);
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
    this.mangaPresentationRevision += 1;
    this.schedulePosition();
  }

  private onInteractionChanged(): void {
    if (!this.mounted) return;
    if (!this.interactionEnabled) {
      this.selectionGeneration += 1;
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
      if (pages.length > 0) this.mangaPresentationRevision += 1;
      const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId));
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
      const anchor: ReaderDirectoryViewportAnchor = { bookId: readerDirectoryScopeKey(this.sourceId, this.bookId),
        navigationRevision: view.navigationRevision, viewId: view.viewId,
        nodeId: node.nodeId, visibleIndex: index, rowFraction: -rect.y / rect.height };
      readerDirectorySaveViewportAnchor(anchor);
    } catch (_error) { /* The native List may be between layout frames. */ }
  }

  private planPosition(): ReaderDirectoryPositionPlan | undefined {
    if (this.view.locateCurrent && this.view.currentVisibleIndex !== undefined)
      return { viewId: this.view.viewId, index: this.view.currentVisibleIndex,
        rowFraction: 0, align: this.mangaDisplay ? ScrollAlign.START : ScrollAlign.CENTER,
        currentInset: this.mangaDisplay ? (this.view.currentDisplayInset ?? 12) : undefined,
        smooth: this.mangaDisplay && this.view.currentDisplaySmooth === true };
    const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId));
    if (anchor !== undefined && anchor.navigationRevision === this.view.navigationRevision) {
      const index = this.view.anchorVisibleIndex ??
        (anchor.viewId === this.view.viewId ? anchor.visibleIndex : undefined);
      if (index !== undefined && index < this.view.visibleTotal) {
        return { viewId: this.view.viewId, index, rowFraction: anchor.rowFraction, align: ScrollAlign.START };
      }
    }
    if (this.view.currentVisibleIndex !== undefined)
      return { viewId: this.view.viewId, index: this.view.currentVisibleIndex,
        rowFraction: 0, align: this.mangaDisplay ? ScrollAlign.START : ScrollAlign.CENTER,
        currentInset: this.mangaDisplay ? (this.view.currentDisplayInset ?? 50) : undefined,
        smooth: false };
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
      const signature = `${chapter.title}:${chapter.navigable}:${chapter.downloadState}:${chapter.bookmarks === undefined ? '?' :
        chapter.bookmarks.map((bookmark): number => bookmark.time).join(',')}`;
      next.set(chapter.index, signature);
      if (previous.get(chapter.index) !== signature) changed.add(chapter.index);
    }
    for (const index of previous.keys()) if (!next.has(index)) changed.add(index);
    this.chapterSignatures = next;
    this.dataSource.changedChapters(changed);
  }

  private marker(chapter: LocalReadingTocEntry): void {
    if (this.interactionEnabled === false) return;
    const state = readerDirectoryBookmarkMarkerState(chapter);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled)
      this.onCreateChapterStartBookmark(state.createRequest);
  }

  private toggleNode(node: ReaderDirectoryNavigationNode): void {
    if (this.interactionEnabled === false) return;
    this.captureViewportAnchor();
    this.onToggleNode(node);
  }

  private canDownloadTarget(node: ReaderDirectoryNavigationNode): boolean {
    if (!this.interactionEnabled || !this.chapterDownloadEnabled || node.kind !== 'target' || node.chapterIndex === undefined) return false;
    const chapter = this.chapterByIndex.get(node.chapterIndex);
    return chapter !== undefined && chapter.navigable !== false &&
      (this.chapterDownloadActionsEnabled && chapter.downloadState !== 'unknown' ||
        chapter.downloadState === 'missing' || chapter.downloadState === 'cached' ||
        chapter.downloadState === 'failed' || chapter.downloadState === 'cancelled');
  }

  private downloadTarget(node: ReaderDirectoryNavigationNode): void {
    if (!this.canDownloadTarget(node) || this.gateway === undefined) return;
    const generation = this.generation, viewId = this.view.viewId, bookId = this.bookId, sourceId = this.sourceId;
    const current = (): boolean => this.mounted && generation === this.generation && viewId === this.view.viewId &&
      bookId === this.bookId && sourceId === this.sourceId;
    // Download the canonical chapter only after the same Core revision/target
    // proof used by reading selection succeeds. This never changes progress.
    void this.gateway.resolveTarget(bookId, viewId, node.nodeId, current)
      .then((target): void => {
        if (!current() || target.chapterIndex !== node.chapterIndex || !this.canDownloadTarget(node)) return;
        this.onDownloadChapter(target.chapterIndex);
      }).catch((_error: Error): void => { if (current()) this.onInvalidated(); });
  }

  private positionInitialCurrent(): void {
    if (!this.initialPositionPending || this.scroller === undefined) return;
    const plan = this.positionPlan ?? this.planPosition();
    if (plan === undefined || plan.viewId !== this.view.viewId) return;
    try {
      if (plan.align === ScrollAlign.START) {
        this.scroller.scrollToIndex(plan.index, plan.smooth === true, ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(plan.currentInset === undefined ?
            plan.rowFraction * (this.mangaDisplay ? this.positionRowHeight(plan.index) : this.rowHeight) : -plan.currentInset) });
      } else {
        this.scroller.scrollToIndex(plan.index, false, ScrollAlign.CENTER);
      }
      this.initialPositionPending = false;
      this.positionPlan = undefined;
    } catch (_error) { /* Native layout will call again after its first frame. */ }
  }

  private selectTarget(node: ReaderDirectoryNavigationNode): void {
    if (this.interactionEnabled === false || node.kind !== 'target' || node.chapterIndex === undefined || this.gateway === undefined) return;
    const generation = this.generation;
    const selection = ++this.selectionGeneration;
    const viewId = this.view.viewId, bookId = this.bookId;
    void this.gateway.resolveTarget(bookId, viewId, node.nodeId,
      (): boolean => this.mounted && generation === this.generation && selection === this.selectionGeneration &&
        this.interactionEnabled !== false && viewId === this.view.viewId && bookId === this.bookId)
      .then((target): void => {
        if (!this.mounted || this.interactionEnabled === false || generation !== this.generation || selection !== this.selectionGeneration ||
          viewId !== this.view.viewId || bookId !== this.bookId) return;
        this.onSelectTarget(target.chapterIndex, target.chapterOffsetScalar, target.positionScope, target.directoryTargetProof);
      }).catch((_error: Error): void => {
        if (this.mounted && this.interactionEnabled !== false && generation === this.generation &&
          selection === this.selectionGeneration && viewId === this.view.viewId && bookId === this.bookId)
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
          if (this.interactionEnabled) {
            this.dataSource.admit(offset, page);
            this.mangaPresentationRevision += 1;
          }
          else {
            const pending: ReaderDirectoryNavigationPendingPage = { offset, page: cacheReaderDirectoryNavigationPage(this.view, offset, page) };
            this.pendingPages.push(pending);
          }
        }).catch((_error: Error): void => {
          this.dataSource.failed(offset);
          if (this.mounted && this.interactionEnabled !== false &&
            generation === this.generation && viewId === this.view.viewId && bookId === this.bookId) this.onInvalidated();
        });
    }, 0);
  }

  private isCurrentNode(item: ReaderDirectoryNavigationItem): boolean {
    const nodeId = item.node?.nodeId;
    if (nodeId === undefined) return false;
    if (nodeId === this.view.currentAncestorNodeId) return true;
    const current = this.view.currentVisibleIndex;
    return current !== undefined && this.dataSource.loadedNode(current)?.nodeId === nodeId;
  }

  /** Manga disclosure keeps its Image actor for rotation. Its observers read
   * the current bounded row data below; the legacy text disclosure keeps its
   * existing capture-refresh identity. Viewport identity remains nodeId. */
  private rowKey(item: ReaderDirectoryNavigationItem): string {
    if (this.mangaDisplay && item.node?.kind === 'group')
      return `reader-navigation:${JSON.stringify([item.key, 'manga-group'])}`;
    return `reader-navigation:${JSON.stringify([item.key,
      item.node?.hasChildren === true ? item.node.expanded : null])}`;
  }

  private mangaGroupNode(node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode {
    // Register dependencies on both a published view and same-view page
    // admission. The Builder argument itself is retained by LazyForEach.
    const revision = this.mangaPresentationRevision;
    const viewId = this.view.viewId;
    const current = this.dataSource.loadedItemById(node.nodeId);
    return revision >= 0 && this.dataSource.currentView()?.viewId === viewId ? current?.node ?? node : node;
  }

  private displayLevel(node: ReaderDirectoryNavigationNode): number {
    // The gateway normalizes v2 zero-based wire depth once. Both admitted
    // versions use one-based display depth; never normalize it again here.
    return Math.max(1, node.depth);
  }

  private mangaGroupSpacing(item: ReaderDirectoryNavigationItem): number {
    if (item.node?.kind !== 'group') return 0;
    return this.mangaRowIndex(item) > 0 && !this.mangaSearchActive ? 12 : 0;
  }

  private mangaRowIndex(item: ReaderDirectoryNavigationItem): number {
    const revision = this.mangaPresentationRevision;
    const viewId = this.view.viewId;
    if (revision < 0 || this.dataSource.currentView()?.viewId !== viewId) return -1;
    // A retained row's original index can change after a fold/search/order.
    // Only the currently bound bounded page window defines the first row.
    return item.node === undefined ? item.index : this.dataSource.loadedItemById(item.node.nodeId)?.index ?? -1;
  }

  private mangaRowPaddingLeft(item: ReaderDirectoryNavigationItem): number {
    if (item.node?.kind === 'group') return this.mangaCatalogDisplay ? 15 : 12;
    if (this.mangaSearchActive) return 10;
    const level = item.node === undefined ? 1 : this.displayLevel(item.node);
    if (this.mangaCatalogDisplay) return this.mangaCatalogNarrow ? (level > 1 ? 20 : 12) : (level > 1 ? 28 : 15);
    return 10 + Math.min(4, Math.max(0, level - 1)) * 16;
  }

  private positionRowHeight(index: number): number {
    if (!this.mangaDisplay) return this.rowHeight;
    try {
      const rect = this.scroller?.getItemRect(index);
      if (rect !== undefined && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
    } catch (_error) { /* A row outside the materialized viewport uses its minimum. */ }
    const node = this.dataSource.loadedNode(index);
    return node?.kind === 'group' ? (this.mangaCatalogDisplay ? 44 : 48) + this.mangaGroupSpacing({ node, index, key: node.nodeId }) :
      this.mangaCatalogDisplay ? 48 : this.mangaRowMinHeight;
  }

  private isCurrentMangaNode(item: ReaderDirectoryNavigationItem): boolean {
    return item.node?.kind === 'target' && this.currentChapterIndex >= 0 &&
      item.node.chapterIndex === this.currentChapterIndex;
  }

  private mangaColor(role: string): string {
    const night = (this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night';
    if (role === 'accent') return night ? '#B9CEB1' : '#425D45';
    if (role === 'muted') return night ? '#ABA99F' : '#756F69';
    if (role === 'faint') return night ? '#767D71' : '#A39C90';
    if (role === 'line') return night ? '#3B4036' : '#E7E0D5';
    if (role === 'active') return night ? '#303C2D' : '#E8EDE2';
    if (role === 'soft') return night ? '#30342D' : '#F0ECE3';
    return night ? '#EAE7DE' : '#1F1B17';
  }

  private selectMangaRow(item: ReaderDirectoryNavigationItem): void {
    if (!this.interactionEnabled || item.node?.kind === 'disabled') return;
    const node = item.node;
    if (node === undefined) return;
    if (node.kind === 'group') {
      const current = this.dataSource.loadedItemById(node.nodeId)?.node;
      if (this.dataSource.currentView()?.viewId === this.view.viewId && current?.kind === 'group') this.toggleNode(current);
    } else this.selectTarget(node);
  }

  @Builder
  private mangaRow(item: ReaderDirectoryNavigationItem) {
    Row({ space: item.node?.kind === 'group' ? 14 : this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 5 : 12 }) {
      if (item.node === undefined) {
        Text('…').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
          .fontSize(13).fontColor(this.mangaColor('muted'));
      } else {
        if (item.node.kind === 'group') {
          Flex({ direction: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? FlexDirection.Column : FlexDirection.Row,
            alignItems: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? ItemAlign.Start : ItemAlign.Baseline }) {
            Text(this.mangaGroupNode(item.node).title).flexShrink(1).constraintSize({ minWidth: 0 })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).fontSize(13).lineHeight(21)
              .fontWeight(600).fontColor(this.mangaColor('ink'));
            if (this.mangaGroupNode(item.node).readableDescendantCount !== undefined) {
              Text(`${this.mangaGroupNode(item.node).readableDescendantCount} 个可读条目`).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(400).fontSize(10).lineHeight(16)
                .fontColor(this.mangaColor('muted')).maxLines(1).flexShrink(0)
                .margin({ left: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 0 : 9,
                  top: this.mangaCatalogDisplay && this.mangaCatalogNarrow ? 1 : 0 });
            }
          }.layoutWeight(1).constraintSize({ minWidth: 0 })
            .onClick((): void => this.selectMangaRow(item));
        } else {
          Column({ space: 4 }) {
            Text(item.node.title).width('100%')
              // The 550 outlines are baked into their own face. Keep normal
              // native styling; a non-hundred request is not axis proof.
              .fontFamily(this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .fontSize(this.mangaCatalogDisplay ? (this.mangaCatalogNarrow ? 11 : 12) : 13)
              .lineHeight(this.mangaCatalogDisplay ? 20 : 22).fontWeight(400)
              .fontColor(this.mangaColor(this.isCurrentMangaNode(item) ? 'accent' : item.node.kind === 'disabled' ? 'muted' : 'ink'));
            if (this.mangaSearchActive && item.node.parentTitle !== undefined) {
              Text(item.node.parentTitle).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(400).fontSize(10).lineHeight(16)
                .fontColor(this.mangaColor('muted'));
            }
          }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start)
            .onClick((): void => this.selectMangaRow(item));
        }
        if (item.node.kind === 'target' && item.node.chapterIndex !== undefined && this.chapterDownloadEnabled &&
          this.chapterByIndex.get(item.node.chapterIndex) !== undefined &&
          this.chapterByIndex.get(item.node.chapterIndex)?.navigable !== false &&
          this.chapterByIndex.get(item.node.chapterIndex)?.downloadState !== 'unknown') {
          Stack() {
            Image(this.chapterByIndex.get(item.node.chapterIndex)?.downloadState === 'completed' ?
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
              .width(15).height(15);
          }.width(26).height(this.mangaCatalogDisplay ? 48 : this.mangaRowMinHeight)
            .accessibilityText(this.chapterDownloadActionsEnabled ? '管理本章下载' :
              this.chapterByIndex.get(item.node.chapterIndex)?.downloadState === 'completed' ? '已下载' : '下载章节')
            .enabled(this.canDownloadTarget(item.node))
            .onClick((): void => {
              if (item.node !== undefined) this.downloadTarget(item.node);
            });
        }
        if (item.node.kind === 'group' && this.mangaGroupNode(item.node).hasChildren) {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_down_theme_night') : $r('app.media.manga_sheet_chevron_down'))
            .width(16).height(16).rotate({ angle: this.mangaGroupNode(item.node).expanded ? 0 : -90 })
            .animation({ duration: 180, curve: 'ease' })
            .onClick((): void => this.selectMangaRow(item));
        } else if (item.node.kind === 'target' && this.isCurrentMangaNode(item)) {
          Text('正在读').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
            .fontSize(this.mangaCatalogDisplay ? (this.mangaCatalogNarrow ? 8 : 9) : 10)
            .lineHeight(17).fontColor(this.mangaColor('accent'))
            .onClick((): void => this.selectMangaRow(item));
        } else if (item.node.kind === 'target') {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_right_theme_night') : $r('app.media.manga_sheet_chevron_right'))
            .width(13).height(13).onClick((): void => this.selectMangaRow(item));
        }
      }
    }.width('100%').constraintSize({ minHeight: item.node?.kind === 'group' ? (this.mangaCatalogDisplay ? 44 : 48) :
      this.mangaCatalogDisplay ? 48 : this.mangaRowMinHeight })
      .padding({ left: this.mangaRowPaddingLeft(item),
        right: item.node?.kind === 'group' ? (this.mangaCatalogDisplay ? 15 : 12) : this.mangaCatalogDisplay && !this.mangaCatalogNarrow ? 15 : 10,
        top: item.node?.kind === 'group' ? (this.mangaCatalogDisplay ? 10 : 11) : this.mangaCatalogDisplay ? 11 : 14,
        bottom: item.node?.kind === 'group' ? (this.mangaCatalogDisplay ? 10 : 11) : this.mangaCatalogDisplay ? 11 : 14 })
      .margin({ top: this.mangaGroupSpacing(item) })
      .border({ width: { top: !this.mangaCatalogDisplay && this.mangaRowIndex(item) === 0 ? 1 : 0, bottom: item.node?.kind === 'group' ? 0 : 1 },
        color: { top: this.mangaColor('line'), bottom: this.mangaColor('line') } })
      .backgroundColor(item.node?.kind === 'target' && this.isCurrentMangaNode(item) ?
        this.mangaColor('active') : item.node?.kind === 'group' ? this.mangaColor('soft') : Color.Transparent)
      .enabled(this.interactionEnabled && item.node?.kind !== 'disabled')
      .accessibilityText(item.node === undefined ? '目录加载中' : item.node.kind === 'group' ?
        `${this.mangaGroupNode(item.node).title}，分组，${this.mangaGroupNode(item.node).expanded ? '已展开' : '已折叠'}` :
        `${item.node.title}${this.isCurrentMangaNode(item) ? '，正在读' : ''}`);
  }

  @Builder
  private row(item: ReaderDirectoryNavigationItem) {
    Row() {
      if (item.node === undefined) {
        Text('…').fontSize(11).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      } else {
        if (this.isCurrentNode(item)) {
          Row().width(3).height(this.rowHeight).borderRadius(999)
            .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(item.node.title)
          .layoutWeight(1)
          .padding({ left: 9 + Math.min(3, this.displayLevel(item.node) - 1) * 12, right: 9 })
          .fontFamily('ReaderNotoSansSC').fontSize(11).fontWeight(500)
          .fontColor(readerAppColor(item.node.kind === 'disabled' ? 'TOK_READ_MUTED' : 'TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(item.node.kind === 'disabled' ? `${item.node.title}，目标不可用` : item.node.kind === 'group' ?
            `${item.node.nodeId === this.view.currentAncestorNodeId ? '当前章在此组，' : ''}第${this.displayLevel(item.node)}级分组：${item.node.title}，${item.node.expanded ? '已展开' : '已折叠'}` :
            `${item.node.nodeId === this.view.currentAncestorNodeId ? '当前章在此标题下，' : ''}第${this.displayLevel(item.node)}级，打开${item.node.title}`)
          .onClick((): void => {
            const node = item.node;
            if (node === undefined) return;
            if (node.kind === 'group') this.toggleNode(node);
            else this.selectTarget(node);
          });
        if (item.node.hasChildren) {
          Text(item.node.expanded ? '⌄' : '›')
            .width(34).height(this.rowHeight).fontSize(18)
            .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center)
            .accessibilityText(`${item.node.expanded ? '折叠' : '展开'}${item.node.title}子目录`)
            .onClick((): void => { if (item.node !== undefined) this.toggleNode(item.node); });
        }
        if (item.node.kind === 'target' && item.node.chapterIndex !== undefined && this.chapterDownloadEnabled &&
          this.chapterByIndex.get(item.node.chapterIndex) !== undefined &&
          this.chapterByIndex.get(item.node.chapterIndex)?.navigable !== false &&
          this.chapterByIndex.get(item.node.chapterIndex)?.downloadState !== 'unknown') {
          Stack() {
            Image(this.chapterByIndex.get(item.node.chapterIndex)?.downloadState === 'completed' ?
              (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
              (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
              .width(15).height(15);
          }.width(26).height(this.rowHeight)
            .accessibilityText(this.chapterDownloadActionsEnabled ? '管理本章下载' :
              this.chapterByIndex.get(item.node.chapterIndex)?.downloadState === 'completed' ? '已下载' : '下载章节')
            .enabled(this.canDownloadTarget(item.node))
            .onClick((): void => { if (item.node !== undefined) this.downloadTarget(item.node); });
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
    .backgroundColor(this.isCurrentNode(item) ?
      readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
  }

  build() {
    List({ space: 0, scroller: this.scroller }) {
      LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
        ListItem() {
          if (this.mangaDisplay) this.mangaRow(item);
          else this.row(item);
        }.width('100%');
      }, (item: ReaderDirectoryNavigationItem): string => this.rowKey(item));
    }
    .width('100%').height('100%')
    .padding({ left: this.listPaddingX, right: this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX,
      top: this.mangaDisplay ? 0 : this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY,
      bottom: this.mangaDisplay ? 0 : this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY })
    .contentStartOffset(this.mangaDisplay ? (this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY) : 0)
    .contentEndOffset(this.mangaDisplay ? this.mangaCatalogDisplay ? 18 :
      (this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY) + 14 : 0)
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
    .onScrollStop((): void => { this.captureViewportAnchor(); this.onScrollSettled(); })
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      if (!this.layoutReady && Number(newArea.height) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
        this.positionInitialCurrent();
      }
    });
  }
}
