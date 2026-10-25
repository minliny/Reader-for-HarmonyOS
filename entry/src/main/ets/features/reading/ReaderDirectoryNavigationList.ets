import { mangaDirectoryDisplay } from '../manga/MangaDirectoryDisplay';
import { mangaDirectoryDownloadStatusText, mangaDirectoryDownloadStatusWidth } from '../manga/MangaDirectoryState';
import { TYPE_APP_INHERITED_HINT, TYPE_READER_DIRECTORY_DISCLOSURE, TYPE_READER_DIRECTORY_TITLE } from '../common/ReaderTypography';
import type { JsonObject } from '@reader/core-harmony';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { motionAnimateParam } from '../common/MotionSpec';
import { ReaderScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../common/ReaderScrollLayout';
import { ReaderPageState } from '../common/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600 } from '../common/ReaderFontFamilies';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, mangaDirectoryScale } from '../manga/MangaDirectoryVisual';
import { MangaDirectoryPressFeedback } from '../manga/MangaDirectoryPressFeedback';
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
import { mangaDirectoryNodePlacement, mangaDirectoryNodePlacements, mangaDirectorySameNodeRun,
  type MangaDirectoryNodePlacement } from '../manga/MangaDirectoryLayout';

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

interface ReaderDirectoryLoadedPage {
  offset: number;
  nodes: ReaderDirectoryNavigationNode[];
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
  /** Cache ownership and native publication are separate during motion. */
  private admittedPages: Set<number> = new Set<number>();
  private listeners: DataChangeListener[] = [];
  private load: (offset: number) => void;

  constructor(load: (offset: number) => void) { this.load = load; }
  /** Quick changes the containing chrome, never the authoritative Core view. */
  totalCount(): number { return this.view?.visibleTotal ?? 0; }
  coreIndex(displayIndex: number): number { return displayIndex; }
  displayIndex(coreIndex: number): number | undefined {
    return Number.isInteger(coreIndex) && coreIndex >= 0 && coreIndex < this.totalCount() ? coreIndex : undefined;
  }
  private requestPage(index: number): void {
    if (index < 0 || index >= (this.view?.visibleTotal ?? 0)) return;
    const offset = Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE;
    const cached = this.pages.get(offset);
    if (cached === undefined) this.admittedPages.delete(offset);
    if (this.admittedPages.has(offset) && cached !== undefined || this.pending.has(offset)) return;
    this.pending.add(offset);
    this.load(offset);
  }
  private notifyCoreChanged(index: number): void {
    const displayIndex = this.displayIndex(index);
    if (displayIndex === undefined) return;
    for (const listener of this.listeners) listener.onDataChanged(displayIndex);
  }
  currentView(): ReaderDirectoryNavigationReady | undefined { return this.view; }
  loadedNode(index: number): ReaderDirectoryNavigationNode | undefined {
    const offset = Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE;
    const page = this.pages.get(offset);
    if (page === undefined) { this.admittedPages.delete(offset); return undefined; }
    return this.admittedPages.has(offset) ? page[index - offset] : undefined;
  }
  loadedPages(): ReaderDirectoryLoadedPage[] {
    const result: ReaderDirectoryLoadedPage[] = [];
    for (const offset of this.pages.keys()) {
      if (!this.admittedPages.has(offset)) continue;
      const nodes = this.pages.get(offset);
      if (nodes !== undefined) result.push({ offset, nodes });
    }
    return result;
  }
  loadedPageAt(index: number): ReaderDirectoryLoadedPage | undefined {
    const offset = Math.floor(index / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE;
    if (!this.admittedPages.has(offset)) return undefined;
    const nodes = this.pages.get(offset);
    return nodes === undefined ? undefined : { offset, nodes };
  }
  loadedItemById(nodeId: string): ReaderDirectoryNavigationItem | undefined {
    // Only the existing 12-page window is searched. Core owns the full tree.
    for (const offset of this.pages.keys()) {
      if (!this.admittedPages.has(offset)) continue;
      const page = this.pages.get(offset);
      if (page === undefined) continue;
      const index = page.findIndex((node: ReaderDirectoryNavigationNode): boolean => node.nodeId === nodeId);
      if (index >= 0) return { key: nodeId, node: page[index], index: offset + index };
    }
    return undefined;
  }
  getData(index: number): ReaderDirectoryNavigationItem {
    const coreIndex = this.coreIndex(index);
    const node = this.loadedNode(coreIndex);
    if (node === undefined) this.requestPage(coreIndex);
    return { key: node?.nodeId ?? `loading:${coreIndex}`, node, index: coreIndex };
  }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((item: DataChangeListener): boolean => item !== listener);
  }
  replace(view: ReaderDirectoryNavigationReady): void {
    if (this.view?.viewId === view.viewId) return;
    const previousById: Map<string, ReaderDirectoryNavigationNode> = new Map<string, ReaderDirectoryNavigationNode>();
    for (const offset of this.pages.keys()) {
      if (!this.admittedPages.has(offset)) continue;
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
    this.admittedPages = new Set<number>(this.pages.keys());
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
        if (old !== undefined && (old.expanded !== node.expanded || old.title !== node.title || old.displayTitle !== node.displayTitle || old.isVip !== node.isVip || old.isPay !== node.isPay || old.contextTitle !== node.contextTitle ||
          old.parentTitle !== node.parentTitle || old.readableDescendantCount !== node.readableDescendantCount ||
          old.depth !== node.depth || old.kind !== node.kind || highlighted.has(node.nodeId)))
          changed.add(offset + index);
      });
    }
    for (const listener of this.listeners) listener.onDataReloaded();
    if (changed.size > 0) setTimeout((): void => {
      if (this.view?.viewId !== view.viewId) return;
      for (const position of changed) this.notifyCoreChanged(position);
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
    const previousPage = this.admittedPages.has(offset) ? this.pages.get(offset) : undefined;
    if (page.nodes.length > 0) this.pages.put(offset, page.nodes);
    this.admittedPages.add(offset);
    const resident = this.pages.keys();
    this.admittedPages = new Set<number>(resident.filter((offset: number): boolean => this.admittedPages.has(offset)));
    page.nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
      const position = offset + index;
      const previous = previousPage?.[index];
      if (previous?.nodeId === node.nodeId && previous.expanded === node.expanded && previous.title === node.title && previous.displayTitle === node.displayTitle && previous.isVip === node.isVip && previous.isPay === node.isPay && previous.contextTitle === node.contextTitle &&
        previous.parentTitle === node.parentTitle && previous.readableDescendantCount === node.readableDescendantCount &&
        previous.depth === node.depth && previous.kind === node.kind) return;
      this.notifyCoreChanged(position);
    });
  }
  failed(offset: number): void { this.pending.delete(offset); }
  changedChapters(chapters: Set<number>): void {
    if (chapters.size === 0) return;
    for (const offset of this.pages.keys()) {
      if (!this.admittedPages.has(offset)) continue;
      const page = this.pages.get(offset);
      page?.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
        if (node.chapterIndex === undefined || !chapters.has(node.chapterIndex)) return;
        this.notifyCoreChanged(offset + index);
      });
    }
  }
}

/** Virtual, Core-paged display rows. Its placeholders never claim a chapter identity. */
@Component
export struct ReaderDirectoryNavigationList {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
  @Prop @Watch('onViewChanged') view: ReaderDirectoryNavigationReady;
  @Prop bookId: string = '';
  @Prop sourceId: string = 'local';
  @Prop rowHeight: number = 40;
  @Prop mangaDisplay: boolean = false;
  @Prop @Watch('onMangaQuickChanged') mangaQuickDisplay: boolean = false;
  @Prop mangaRowMinHeight: number = 58;
  @Prop mangaCatalogDisplay: boolean = false;
  @Prop mangaCatalogNarrow: boolean | undefined = undefined;
  @Prop mangaInitialViewportWidth: number = 0;
  /** Parent-owned fixed header bottom in this scroll viewport's coordinates. */
  @Prop mangaVisibleTopInset: number = 0;
  @Prop @Watch('onMangaQuickChanged') mangaSearchActive: boolean = false;
  @State private mangaPresentationRevision: number = 0;
  @State private mangaViewportWidth: number = 0;
  @Prop mangaScheme: string = '';
  @Prop currentChapterIndex: number = -1;
  @Prop listPaddingX: number = 10;
  @Prop listPaddingRight: number = -1;
  @Prop listPaddingY: number = 5;
  @Prop scrollLayout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'contentOffset');
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
  onScrollOffset: (offset: number) => void = (_offset: number): void => {};
  onClearSearch: () => void = (): void => {};
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
  // Numeric layout metadata only: chapter nodes remain solely in the shared
  // 12-page LRU, including while a different directory owns the viewport.
  private mangaGridSpans: Map<number, number> = new Map<number, number>();
  private mangaLayoutByNode: Map<string, MangaDirectoryNodePlacement> = new Map<string, MangaDirectoryNodePlacement>();
  private mangaLayoutSignature: string = '';
  private mangaLayoutPageRefs: Map<number, ReaderDirectoryNavigationNode[]> = new Map<number, ReaderDirectoryNavigationNode[]>();
  private mangaDragging: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.layoutReady = false;
    this.initialPositionPending = true;
    this.mangaDragging = false;
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
    this.mangaLayoutByNode.clear(); this.mangaGridSpans.clear(); this.mangaLayoutPageRefs.clear(); this.mangaLayoutSignature = '';
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

  private onMangaQuickChanged(): void {
    if (!this.mounted) return;
    this.selectionGeneration += 1;
    this.captureViewportAnchor();
    this.mangaPresentationRevision += 1;
    this.positionPlan = this.planPosition();
    this.initialPositionPending = this.positionPlan !== undefined;
    this.schedulePosition();
  }

  private onInteractionChanged(): void {
    if (!this.mounted) return;
    if (!this.interactionEnabled) {
      this.mangaDragging = false;
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
      const displayIndex = this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive ?
        this.dataSource.displayIndex(index) : index;
      if (displayIndex === undefined) return;
      const rect = this.scroller.getItemRect(displayIndex);
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
    // LazyForEach preserves equal keys. Its old Builder closure cannot observe
    // writes to this plain Map through a data notification alone.
    if (this.mangaDisplay && changed.size > 0) this.mangaPresentationRevision += 1;
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
    if (this.mangaDisplay) {
      const revision = this.mangaPresentationRevision;
      const current = this.dataSource.loadedItemById(node.nodeId)?.node;
      if (revision < 0 || this.dataSource.currentView()?.viewId !== this.view.viewId ||
        current?.kind !== 'target' || current.chapterIndex !== node.chapterIndex) return false;
    }
    if (this.mangaQuickDisplay && !this.mangaSearchActive) {
      const index = this.dataSource.loadedItemById(node.nodeId)?.index;
      if (index === undefined || this.dataSource.displayIndex(index) === undefined) return false;
    }
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
    const displayIndex = this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive ?
      this.dataSource.displayIndex(plan.index) : plan.index;
    if (displayIndex === undefined) return;
    try {
      if (plan.align === ScrollAlign.START) {
        const startOffset = this.mangaDisplay ? this.mangaContentStartOffset() : 0;
        const visibleTop = this.mangaDisplay ? Math.max(0, this.mangaVisibleTopInset) : 0;
        // Official START aligns the item to contentStartOffset. Translate only
        // viewport geometry; canonical Core ranks and target proofs stay intact.
        this.scroller.scrollToIndex(displayIndex, plan.smooth === true, ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(plan.currentInset === undefined ?
            startOffset + plan.rowFraction * (this.mangaDisplay ? this.positionRowHeight(plan.index) : this.rowHeight) :
            startOffset - visibleTop - plan.currentInset) });
      } else if (this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive) {
        this.scroller.scrollToIndex(displayIndex, false, ScrollAlign.CENTER);
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
        this.interactionEnabled !== false && viewId === this.view.viewId && bookId === this.bookId &&
        !(this.mangaQuickDisplay && !this.mangaSearchActive &&
          this.dataSource.displayIndex(this.dataSource.loadedItemById(node.nodeId)?.index ?? -1) === undefined))
      .then((target): void => {
        if (!this.mounted || this.interactionEnabled === false || generation !== this.generation || selection !== this.selectionGeneration ||
          viewId !== this.view.viewId || bookId !== this.bookId) return;
        if (this.mangaQuickDisplay && !this.mangaSearchActive &&
          this.dataSource.displayIndex(this.dataSource.loadedItemById(node.nodeId)?.index ?? -1) === undefined) return;
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
          if (this.interactionEnabled && !(this.mangaDisplay && this.mangaDragging)) {
            if (this.mangaDisplay) this.admitMangaPages([{ offset, page }]);
            else {
              this.dataSource.admit(offset, page);
              this.mangaPresentationRevision += 1;
            }
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

  private admitMangaPages(pages: ReaderDirectoryNavigationPendingPage[]): void {
    if (pages.length === 0) return;
    const index = this.firstVisibleIndex;
    const hadNode = this.dataSource.loadedNode(index) !== undefined;
    if (hadNode) this.captureViewportAnchor();
    const anchor = hadNode ? readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId)) : undefined;
    for (const item of pages) this.dataSource.admit(item.offset, item.page);
    this.mangaPresentationRevision += 1;
    if (this.initialPositionPending) {
      this.schedulePosition();
      return;
    }
    if (this.mangaDragging || index < 0 || this.dataSource.loadedNode(index) === undefined ||
      this.dataSource.displayIndex(index) === undefined) return;
    // Only an actual pre-admission node rect contributes a pixel fraction.
    // A placeholder becoming a target restores its canonical index at START.
    this.positionPlan = { viewId: this.view.viewId, index,
      rowFraction: anchor?.viewId === this.view.viewId && anchor.visibleIndex === index ? anchor.rowFraction : 0,
      align: ScrollAlign.START };
    this.initialPositionPending = true;
    this.schedulePosition();
  }

  private settleMangaScroll(): void {
    this.mangaDragging = false;
    if (!this.interactionEnabled) { this.captureViewportAnchor(); this.onScrollSettled(); return; }
    const pages = this.pendingPages;
    this.pendingPages = [];
    this.admitMangaPages(pages);
    // Admission has scheduled a native index restore. Do not snapshot the
    // just-replaced placeholder rect before that native layout is updated.
    if (pages.length === 0) this.captureViewportAnchor();
    this.onScrollSettled();
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
    if (this.mangaDisplay)
      return `reader-navigation:${JSON.stringify([item.key, item.node?.kind,
        item.node?.hasChildren === true ? item.node.expanded : null])}`;
    return `reader-navigation:${JSON.stringify([item.key,
      item.node?.hasChildren === true ? item.node.expanded : null])}`;
  }

  private mangaPaintNode(node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode {
    // Register dependencies on both a published view and same-view page
    // admission. The Builder argument itself is retained by LazyForEach.
    const revision = this.mangaPresentationRevision;
    const viewId = this.view.viewId;
    const current = this.dataSource.loadedItemById(node.nodeId);
    return revision >= 0 && this.dataSource.currentView()?.viewId === viewId ? current?.node ?? node : node;
  }

  private mangaGroupNode(node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode {
    return this.mangaPaintNode(node);
  }

  private mangaChapter(item: ReaderDirectoryNavigationItem): LocalReadingTocEntry | undefined {
    const revision = this.mangaPresentationRevision;
    const node = item.node === undefined ? undefined : this.dataSource.loadedItemById(item.node.nodeId)?.node;
    return revision >= 0 && this.dataSource.currentView()?.viewId === this.view.viewId &&
      node?.kind === 'target' && node.chapterIndex !== undefined ?
      this.chapterByIndex.get(node.chapterIndex) : undefined;
  }

  private mangaRowAdmitted(item: ReaderDirectoryNavigationItem): boolean {
    const revision = this.mangaPresentationRevision;
    if (item.node === undefined) return true; // Genuine loading slots remain visible.
    if (revision < 0 || this.dataSource.currentView()?.viewId !== this.view.viewId) return false;
    const current = this.dataSource.loadedItemById(item.node.nodeId);
    return current?.node !== undefined && !(this.mangaQuickDisplay && !this.mangaSearchActive &&
      this.dataSource.displayIndex(current.index) === undefined);
  }

  private mangaDisplayNode(node: ReaderDirectoryNavigationNode, resident: boolean = false): ReaderDirectoryNavigationNode {
    const current = resident ? node : this.mangaPaintNode(node);
    return current;
  }

  private mangaTitle(node: ReaderDirectoryNavigationNode): string {
    return mangaDirectoryDisplay(this.mangaDisplayNode(node)).title;
  }

  private mangaContextTitle(node: ReaderDirectoryNavigationNode): string {
    const current = this.mangaDisplayNode(node);
    if (current.contextTitle?.trim().length) return current.contextTitle;
    const titles: string[] = [], seen: Set<string> = new Set<string>([current.nodeId]);
    let parentId = current.parentId, depth = current.depth;
    for (let steps = 0; steps < 64 && parentId !== undefined && !seen.has(parentId); steps += 1) {
      seen.add(parentId);
      const parent = this.dataSource.loadedItemById(parentId)?.node;
      if (parent === undefined || parent.depth < 1 || parent.depth >= depth) {
        if (titles.length === 0 && current.parentTitle !== undefined) titles.unshift(current.parentTitle);
        break;
      }
      titles.unshift(this.mangaTitle(parent)); depth = parent.depth; parentId = parent.parentId;
    }
    return titles.join(' / ');
  }

  private mangaDownloadable(node: ReaderDirectoryNavigationNode, resident: boolean = false): boolean {
    const current = resident ? node : this.mangaPaintNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterByIndex.get(current.chapterIndex);
    return current.kind === 'target' && this.chapterDownloadEnabled && chapter !== undefined &&
      chapter.navigable !== false && chapter.downloadState !== 'unknown';
  }

  private mangaStatusText(node: ReaderDirectoryNavigationNode): string {
    const current = this.mangaDisplayNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterByIndex.get(current.chapterIndex);
    return [mangaDirectoryDisplay(current).statusText,
      mangaDirectoryDownloadStatusText(chapter?.downloadState, this.mangaDownloadable(current))]
      .filter((text: string): boolean => text.length > 0).join(' · ');
  }

  private mangaAccessoryWidth(node: ReaderDirectoryNavigationNode, resident: boolean = false): number {
    const current = resident ? node : this.mangaPaintNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterByIndex.get(current.chapterIndex);
    const glyph = this.mangaDownloadable(current, resident);
    return (this.chapterDownloadEnabled ? MANGA_DIRECTORY_VISUAL.downloadGridWidth : 0) +
      mangaDirectoryDownloadStatusWidth(chapter?.downloadState, glyph, this.mangaFontScale());
  }

  private mangaRowAccessibility(item: ReaderDirectoryNavigationItem, context: boolean): string {
    if (item.node === undefined) return '目录加载中';
    const node = this.mangaDisplayNode(item.node);
    const path = context || this.mangaQuickDisplay ? this.mangaContextTitle(node) : '';
    const metadata = this.mangaStatusText(node);
    const chapter = this.mangaChapter(item);
    const state = node.kind === 'group' ? `，分组，${node.expanded ? '已展开' : '已折叠'}` :
      node.kind === 'disabled' ? '，暂不可读' : '，打开章节';
    return `${path ? `${path}，` : ''}${this.mangaTitle(node)}${state}${this.isCurrentMangaNode(item) ? '，正在读' : ''}` +
      `${metadata ? `，${metadata}` : ''}${chapter?.downloadState === 'completed' && this.mangaDownloadable(node) ? '，已下载' : ''}`;
  }

  private displayLevel(node: ReaderDirectoryNavigationNode): number {
    // The gateway normalizes v2 zero-based wire depth once. Both admitted
    // versions use one-based display depth; never normalize it again here.
    return Math.max(1, node.depth);
  }

  private mangaGroupSpacing(item: ReaderDirectoryNavigationItem): number {
    if (item.node?.kind !== 'group') return 0;
    const previous = this.dataSource.loadedNode(this.mangaRowIndex(item) - 1);
    return previous?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.gridRunMargin : 0;
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
    if (item.node?.kind === 'group') return MANGA_DIRECTORY_VISUAL.groupPaddingX;
    return this.mangaSearchActive || item.node === undefined || this.displayLevel(this.mangaPaintNode(item.node)) <= 1 ?
      MANGA_DIRECTORY_VISUAL.namedPaddingX : MANGA_DIRECTORY_VISUAL.childPaddingLeft;
  }

  private positionRowHeight(index: number): number {
    if (!this.mangaDisplay) return this.rowHeight;
    try {
      const displayIndex = this.mangaQuickDisplay && !this.mangaSearchActive ? this.dataSource.displayIndex(index) : index;
      const rect = displayIndex === undefined ? undefined : this.scroller?.getItemRect(displayIndex);
      if (rect !== undefined && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
    } catch (_error) { /* A row outside the materialized viewport uses its minimum. */ }
    const node = this.dataSource.loadedNode(index);
    if (node !== undefined && this.mangaCellPlacement({ key: node.nodeId, node, index })?.kind !== 'row') return this.mangaCellHeight() + MANGA_DIRECTORY_VISUAL.gridGap;
    return node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupMinHeight + this.mangaGroupSpacing({ node, index, key: node.nodeId }) :
      Math.max(MANGA_DIRECTORY_VISUAL.namedMinHeight, MANGA_DIRECTORY_VISUAL.namedPaddingY * 2 +
        MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale() + MANGA_DIRECTORY_VISUAL.gridBorder);
  }

  private isCurrentMangaNode(item: ReaderDirectoryNavigationItem): boolean {
    const node = item.node === undefined ? undefined : this.mangaPaintNode(item.node);
    return node?.kind === 'target' && this.currentChapterIndex >= 0 &&
      node.chapterIndex === this.currentChapterIndex;
  }

  private mangaColor(role: string): string {
    return mangaDirectoryColor(role, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme);
  }

  private mangaFontScale(): number {
    const revision = this.windowMetricsRevision;
    return revision >= 0 ? mangaDirectoryScale(ReaderWindowCoordinator.metrics().systemFontScale) : 1;
  }

  private mangaContentWidth(): number {
    const width = this.mangaViewportWidth > 0 ? this.mangaViewportWidth : this.mangaInitialViewportWidth;
    return Math.max(0, width - this.listPaddingX -
      (this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX));
  }

  private mangaContentStartOffset(): number {
    return Math.max(0, this.scrollLayout.startInset) +
      Math.max(0, this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY);
  }

  private mangaContentEndOffset(): number {
    return Math.max(0, this.scrollLayout.endInset) + (this.mangaCatalogDisplay ? 18 :
      Math.max(0, this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY) +
      (this.mangaQuickDisplay ? MANGA_DIRECTORY_VISUAL.quickScrollBottom : 0));
  }

  private mangaCellHeight(): number {
    return Math.max(MANGA_DIRECTORY_VISUAL.gridHeight, MANGA_DIRECTORY_VISUAL.gridPaddingY * 2 +
      MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale() + MANGA_DIRECTORY_VISUAL.gridBorder * 2);
  }

  private mangaFirstDisplayRow(item: ReaderDirectoryNavigationItem): boolean {
    return this.mangaRowIndex(item) === 0;
  }

  private mangaFirstGridRun(item: ReaderDirectoryNavigationItem): boolean {
    const placement = this.mangaCellPlacement(item);
    if (placement === undefined || placement.kind === 'row') return false;
    // The first numeric row spans all twelve lanes, including empty cells.
    // Its border precedes the 12vp run margin instead of hugging the cell.
    return placement.startIndex === 0;
  }

  private publishMangaScrollOffset(): void {
    if (!this.mangaDisplay || this.scroller === undefined) return;
    try {
      const offset = this.scroller.currentOffset().yOffset;
      // Grid currentOffset begins at -contentStartOffset. Chrome observes the
      // corresponding scroll-content origin, including signed native bounce.
      if (Number.isFinite(offset)) this.onScrollOffset(offset + this.mangaContentStartOffset());
    } catch (_error) { /* An unattached native scroller has no geometry yet. */ }
  }

  private selectMangaRow(item: ReaderDirectoryNavigationItem): void {
    if (!this.interactionEnabled) return;
    const nodeId = item.node?.nodeId;
    if (nodeId === undefined || this.dataSource.currentView()?.viewId !== this.view.viewId) return;
    const itemNow = this.dataSource.loadedItemById(nodeId);
    if (itemNow?.node === undefined || itemNow.node.kind === 'disabled' ||
      this.mangaQuickDisplay && !this.mangaSearchActive && this.dataSource.displayIndex(itemNow.index) === undefined) return;
    if (itemNow.node.kind === 'group') {
      if (!this.mangaSearchActive && !this.mangaQuickDisplay) this.toggleNode(itemNow.node);
    }
    else this.selectTarget(itemNow.node);
  }

  private toggleMangaRow(item: ReaderDirectoryNavigationItem): void {
    if (!this.interactionEnabled || this.mangaSearchActive || this.mangaQuickDisplay || item.node === undefined || this.dataSource.currentView()?.viewId !== this.view.viewId) return;
    const current = this.dataSource.loadedItemById(item.node.nodeId);
    if (current?.node !== undefined && current.node.hasChildren && current.node.kind !== 'disabled' &&
      !(this.mangaQuickDisplay && !this.mangaSearchActive && this.dataSource.displayIndex(current.index) === undefined)) this.toggleNode(current.node);
  }

  private mangaGridNarrow(): boolean {
    const width = this.mangaViewportWidth > 0 ? this.mangaViewportWidth : this.mangaInitialViewportWidth;
    return this.mangaCatalogNarrow !== undefined ? this.mangaCatalogNarrow : width > 0 && width <= MANGA_DIRECTORY_VISUAL.narrowWidth;
  }

  /** Join only adjacent resident Core pages. This transient projection never
   * fetches another page or owns a second catalog; missing predecessors keep
   * their explicit boundary instead of inventing a global run offset. */
  private mangaLoadedRuns(residentPages: ReaderDirectoryLoadedPage[] = this.dataSource.loadedPages()): ReaderDirectoryLoadedPage[] {
    const resident = residentPages.sort((left: ReaderDirectoryLoadedPage,
      right: ReaderDirectoryLoadedPage): number => left.offset - right.offset);
    const runs: ReaderDirectoryLoadedPage[] = [];
    for (const page of resident) {
      const previous = runs[runs.length - 1];
      if (previous !== undefined && previous.offset + previous.nodes.length === page.offset)
        previous.nodes = previous.nodes.concat(page.nodes.map((node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode => this.mangaDisplayNode(node, true)));
      else runs.push({ offset: page.offset, nodes: page.nodes.map((node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode => this.mangaDisplayNode(node, true)) });
    }
    return runs;
  }

  private mangaCellPlacement(item: ReaderDirectoryNavigationItem): MangaDirectoryNodePlacement | undefined {
    if (item.node === undefined || this.dataSource.currentView()?.viewId !== this.view.viewId) return undefined;
    this.prepareMangaGridProjection();
    return this.mangaLayoutByNode.get(item.node.nodeId);
  }

  private mangaCellOrdinal(item: ReaderDirectoryNavigationItem): number {
    const placement = this.mangaCellPlacement(item);
    const index = this.mangaRowIndex(item);
    const ordinal = index;
    return placement === undefined || ordinal < 0 ? 0 : ordinal - placement.startIndex;
  }

  private mangaCellWidth(item: ReaderDirectoryNavigationItem): number {
    const columns = this.mangaCellPlacement(item)?.columns ?? 1;
    return Math.max(1, (this.mangaContentWidth() - (columns - 1) * MANGA_DIRECTORY_VISUAL.gridGap) / columns);
  }

  private mangaCellTop(item: ReaderDirectoryNavigationItem): number {
    const placement = this.mangaCellPlacement(item);
    if (placement === undefined) return 0;
    const previousCore = placement.startIndex - 1;
    const previous = this.dataSource.loadedNode(previousCore);
    const first = placement.nodes[0];
    return previous === undefined || first === undefined || !mangaDirectorySameNodeRun(previous, first) ? MANGA_DIRECTORY_VISUAL.gridRunMargin : 0;
  }

  private mangaCellBottom(item: ReaderDirectoryNavigationItem): number {
    const placement = this.mangaCellPlacement(item);
    if (placement === undefined) return MANGA_DIRECTORY_VISUAL.gridGap;
    const nextIndex = placement.startIndex + placement.rowLength;
    const nextCore = nextIndex;
    const next = this.dataSource.loadedNode(nextCore);
    const last = placement.nodes[placement.rowLength - 1];
    return next === undefined || last === undefined || !mangaDirectorySameNodeRun(last, next) ? MANGA_DIRECTORY_VISUAL.gridRunMargin : MANGA_DIRECTORY_VISUAL.gridGap;
  }

  private prepareMangaGridProjection(): void {
    const resident = this.dataSource.loadedPages();
    const signature = JSON.stringify([this.view.viewId, this.generation, this.mangaPresentationRevision,
      this.windowMetricsRevision, this.mangaContentWidth(), this.mangaFontScale(), this.mangaGridNarrow(),
      this.mangaSearchActive, this.chapterDownloadEnabled,
      resident.map((page: ReaderDirectoryLoadedPage): string => `${page.offset}:${page.nodes.length}`).sort()]);
    const samePages = resident.length === this.mangaLayoutPageRefs.size &&
      resident.every((page: ReaderDirectoryLoadedPage): boolean => this.mangaLayoutPageRefs.get(page.offset) === page.nodes);
    if (signature === this.mangaLayoutSignature && samePages) return;
    this.mangaLayoutSignature = signature;
    this.mangaGridSpans.clear(); this.mangaLayoutByNode.clear(); this.mangaLayoutPageRefs.clear();
    for (const page of resident) this.mangaLayoutPageRefs.set(page.offset, page.nodes);
    const pages: ReaderDirectoryLoadedPage[] = this.mangaLoadedRuns(resident);
    if (this.mangaPresentationRevision >= 0) for (const page of pages) {
      const placements = mangaDirectoryNodePlacements(page.nodes, this.mangaGridNarrow(), page.offset,
        this.mangaFontScale(), this.mangaContentWidth(),
        (node: ReaderDirectoryNavigationNode): number => this.mangaAccessoryWidth(node, true), this.mangaSearchActive ? 'search' : '');
      placements.forEach((placement: MangaDirectoryNodePlacement, ordinal: number): void => {
        const node = page.nodes[ordinal];
        if (node !== undefined) this.mangaLayoutByNode.set(node.nodeId, placement);
        const position = page.offset + ordinal;
        const column = position - placement.startIndex;
        const span = placement.kind === 'row' ? 12 :
          (column === placement.rowLength - 1 ? placement.columns - column : 1) * (12 / placement.columns);
        this.mangaGridSpans.set(position, span);
      });
    }
    if (this.view.visibleTotal === 0) this.mangaGridSpans.set(0, 12);
  }

  private mangaGridLayoutOptions(): GridLayoutOptions {
    this.prepareMangaGridProjection();
    return { regularSize: [1, 1], irregularIndexes: Array.from(this.mangaGridSpans.keys()),
      onGetIrregularSizeByIndex: (index: number): [number, number] => [1, this.mangaGridSpans.get(index) ?? 12] };
  }

  @Builder
  private mangaEmptyActions(viewId: string) {
    if (this.mangaSearchActive) {
      Text('清除搜索').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
        .fontSize(MANGA_DIRECTORY_VISUAL.quietEmptyFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.quietEmptyLineHeight)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
        .constraintSize({ minHeight: MANGA_DIRECTORY_VISUAL.quietEmptyClearHeight })
        .fontColor(this.mangaColor('accent')).textAlign(TextAlign.Center).enabled(this.interactionEnabled)
        .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme))
        .onClick((): void => {
          if (this.mounted && this.interactionEnabled && this.mangaSearchActive &&
            viewId === this.view.viewId && this.dataSource.currentView()?.viewId === viewId) this.onClearSearch();
        });
    }
  }

  @Builder
  private mangaEmptyState() {
    Column({ space: MANGA_DIRECTORY_VISUAL.quietEmptyGap }) {
      ForEach([this.view.viewId], (viewId: string): void => {
        ReaderPageState({ message: this.mangaSearchActive ? '没有匹配的章节' : '暂无章节信息',
          padded: false, mutedColor: this.mangaColor('muted'), customActions: true,
          actionContent: (): void => this.mangaEmptyActions(viewId) });
      }, (viewId: string): string => viewId);
    }.width('100%').constraintSize({ minHeight: MANGA_DIRECTORY_VISUAL.quietEmptyMinHeight })
      .padding({ top: MANGA_DIRECTORY_VISUAL.quietEmptyPaddingY, bottom: MANGA_DIRECTORY_VISUAL.quietEmptyPaddingY,
        left: MANGA_DIRECTORY_VISUAL.quietEmptyPaddingX, right: MANGA_DIRECTORY_VISUAL.quietEmptyPaddingX })
      .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
      .border({ width: { top: MANGA_DIRECTORY_VISUAL.gridBorder }, color: this.mangaColor('line') });
  }

  private mangaQuickContextTitle(item: ReaderDirectoryNavigationItem): string {
    const revision = this.mangaPresentationRevision;
    if (revision < 0 || item.node === undefined || this.dataSource.currentView()?.viewId !== this.view.viewId) return '';
    const node = this.dataSource.loadedItemById(item.node.nodeId)?.node;
    if (node === undefined) return '';
    const context = this.mangaContextTitle(node);
    return context ? `${context} / ${this.mangaTitle(node)}` : this.mangaTitle(node);
  }

  @Builder
  private mangaQuickContextRow(item: ReaderDirectoryNavigationItem) {
    Text(this.mangaQuickContextTitle(item)).width('100%')
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
      .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
      .fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
      .fontColor(this.mangaColor('muted')).padding({ left: MANGA_DIRECTORY_VISUAL.namedPaddingX, right: MANGA_DIRECTORY_VISUAL.namedPaddingX,
        top: MANGA_DIRECTORY_VISUAL.contextPaddingTop, bottom: MANGA_DIRECTORY_VISUAL.contextPaddingBottom })
      .border({ width: { bottom: 1 }, color: this.mangaColor('line') })
      .hitTestBehavior(HitTestMode.None).accessibilityText(this.mangaQuickContextTitle(item));
  }

  @Builder
  private mangaNumberCell(item: ReaderDirectoryNavigationItem) {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Row({ space: 0 }) {
          Row({ space: 0 }) {
            Text(this.mangaCellPlacement(item)?.labels[this.mangaCellOrdinal(item)]?.numberText ?? item.node?.title ?? '…')
              .fontFamily(this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight)
              .fontWeight(this.isCurrentMangaNode(item) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight, { enableVariableFontWeight: true })
              .fontColor(this.mangaColor(this.isCurrentMangaNode(item) ? 'accent' : 'ink'))
              .maxLines(1);
            if (this.mangaQuickDisplay && !this.mangaSearchActive && item.node?.kind === 'group') this.mangaQuickContextRow(item);
            else if (this.mangaCellPlacement(item)?.kind === 'parts') {
              Text(` · ${this.mangaCellPlacement(item)?.labels[this.mangaCellOrdinal(item)]?.part ?? ''}`)
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
                .fontColor(this.mangaColor(this.isCurrentMangaNode(item) ? 'accent' : 'muted'));
            }
            if (item.node !== undefined && this.mangaStatusText(item.node).length > 0) {
              Text(this.mangaStatusText(item.node)).flexShrink(0).maxLines(1)
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
                .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
                .fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
                .fontColor(this.mangaColor('muted')).margin({ left: MANGA_DIRECTORY_VISUAL.contentGap });
            }
          }.layoutWeight(1).constraintSize({ minWidth: 0 }).height(this.mangaCellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2).justifyContent(FlexAlign.Center);
          if (item.node?.kind === 'target' && item.node.chapterIndex !== undefined && this.chapterDownloadEnabled &&
            this.mangaChapter(item) !== undefined &&
            this.mangaChapter(item)?.navigable !== false &&
            this.mangaChapter(item)?.downloadState !== 'unknown') {
            Stack() {
              Stack() {
                Image(this.mangaChapter(item)?.downloadState === 'completed' ?
                ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                  $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
                ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                  $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
                .width(12).height(12);
            }.width(MANGA_DIRECTORY_VISUAL.downloadGridWidth).height(this.mangaCellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2).enabled(this.canDownloadTarget(this.mangaPaintNode(item.node)))
              .accessibilityText(this.chapterDownloadActionsEnabled ? `管理${this.mangaTitle(item.node)}下载` :
                this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节')
              .onClick((): void => { if (item.node !== undefined) this.downloadTarget(this.mangaPaintNode(item.node)); });
            }.width(MANGA_DIRECTORY_VISUAL.downloadGridWidth).height(this.mangaCellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2)
              .focusable(false).accessibilityLevel('no').onClick((): void => {});
          }
        }.width('100%').constraintSize({ minWidth: 0 }).justifyContent(FlexAlign.Center);
        if (this.isCurrentMangaNode(item)) {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_locate_theme_night') : $r('app.media.manga_sheet_locate'))
            .width(MANGA_DIRECTORY_VISUAL.gridMarkSize).height(MANGA_DIRECTORY_VISUAL.gridMarkSize).align(Alignment.TopEnd)
            .margin({ top: MANGA_DIRECTORY_VISUAL.gridMarkInset, right: MANGA_DIRECTORY_VISUAL.gridMarkInset })
            .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
        }
      }.width(this.mangaCellWidth(item)).height(this.mangaCellHeight())
        .padding({ left: MANGA_DIRECTORY_VISUAL.gridPaddingX, right: MANGA_DIRECTORY_VISUAL.gridPaddingX })
        .border({ width: MANGA_DIRECTORY_VISUAL.gridBorder, color: this.mangaColor('line') }).borderRadius(MANGA_DIRECTORY_VISUAL.gridRadius)
        .backgroundColor(this.mangaColor(this.isCurrentMangaNode(item) ? 'active' : 'soft'))
        .enabled(this.interactionEnabled)
        .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme))
        .enabled(this.interactionEnabled)
        .accessibilityText(this.mangaRowAccessibility(item, true))
        .onClick((): void => this.selectMangaRow(item));
    }.width('100%').justifyContent(FlexAlign.Start)
      .visibility(this.mangaRowAdmitted(item) ? Visibility.Visible : Visibility.Hidden)
      .padding({ left: this.mangaCellOrdinal(item) * MANGA_DIRECTORY_VISUAL.gridGap / (this.mangaCellPlacement(item)?.columns ?? 1),
        top: this.mangaCellTop(item), bottom: this.mangaCellBottom(item) })
      .border({ width: { top: this.mangaFirstGridRun(item) ? MANGA_DIRECTORY_VISUAL.gridBorder : 0 }, color: this.mangaColor('line') });
  }

  @Builder
  private mangaRow(item: ReaderDirectoryNavigationItem) {
    if (item.node?.kind === 'target' && item.node.hasChildren && !this.mangaQuickDisplay) {
      Row({ space: 0 }) {
        this.mangaRowBody(item);
        Stack() {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_down_theme_night') : $r('app.media.manga_sheet_chevron_down'))
            .width(MANGA_DIRECTORY_VISUAL.groupIconSize).height(MANGA_DIRECTORY_VISUAL.groupIconSize)
            .rotate({ angle: this.mangaGroupNode(item.node).expanded ? 0 : -90 })
            .animation(motionAnimateParam('manga.directory.fold'));
        }.width(32).height(32).margin({ left: 8, right: 8 })
          .enabled(this.interactionEnabled && !this.mangaSearchActive)
          .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled && !this.mangaSearchActive, true, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme))
          .accessibilityText(`${this.mangaPaintNode(item.node).title}，展开或收起子目录`)
          .onClick((): void => this.toggleMangaRow(item));
      }.width('100%').visibility(this.mangaRowAdmitted(item) ? Visibility.Visible : Visibility.Hidden).border({ width: { top: this.mangaFirstDisplayRow(item) ? MANGA_DIRECTORY_VISUAL.gridBorder : 0,
        bottom: MANGA_DIRECTORY_VISUAL.gridBorder }, color: this.mangaColor('line') });
    } else {
      this.mangaRowBody(item);
    }
  }

  @Builder
  private mangaRowBody(item: ReaderDirectoryNavigationItem) {
    Row({ space: item.node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupGap : MANGA_DIRECTORY_VISUAL.namedGap }) {
      if (item.node === undefined) {
        Text('…').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(13).fontColor(this.mangaColor('muted'));
      } else {
        if (item.node.kind === 'group') {
          Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, alignItems: ItemAlign.Baseline }) {
            Text(this.mangaTitle(item.node)).flexShrink(1).constraintSize({ minWidth: 0 })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_600).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.groupFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.groupLineHeight)
              .fontWeight(MANGA_DIRECTORY_VISUAL.groupFontWeight).fontColor(this.mangaColor('ink'));
            if (this.mangaGroupNode(item.node).readableDescendantCount !== undefined) {
              Text(`${this.mangaGroupNode(item.node).readableDescendantCount} 个可读条目`).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
                .fontColor(this.mangaColor('muted')).wordBreak(WordBreak.BREAK_WORD).constraintSize({ maxWidth: '100%' }).flexShrink(1)
                .margin({ left: MANGA_DIRECTORY_VISUAL.groupCountGap });
            }
          }.layoutWeight(1).constraintSize({ minWidth: 0 });
        } else {
          Column({ space: MANGA_DIRECTORY_VISUAL.contentGap }) {
            Text(this.mangaTitle(item.node)).width('100%').wordBreak(WordBreak.BREAK_WORD)
              // The fixed 550 face supplies the outlines. API 12 admits the
              // matching non-hundred declaration without relying on a VF axis.
              .fontFamily(this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize)
              .lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight)
              .fontWeight(this.isCurrentMangaNode(item) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight, { enableVariableFontWeight: true })
              .fontColor(this.mangaColor(this.isCurrentMangaNode(item) ? 'accent' : 'ink'));
            if (this.mangaStatusText(item.node).length > 0) {
              Text(this.mangaStatusText(item.node)).width('100%').wordBreak(WordBreak.BREAK_WORD)
                .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
                .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
                .fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
                .fontColor(this.mangaColor('muted'));
            }
            if (this.mangaSearchActive && this.mangaContextTitle(item.node).length > 0) {
              Text(this.mangaContextTitle(item.node)).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight)
                .fontColor(this.mangaColor('muted'));
            }
            if (item.node.kind === 'target' && item.node.hasChildren) {
              Text('可直接阅读').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.metaFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.metaLineHeight).fontColor(this.mangaColor('muted'));
            }
          }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
        }
        if (item.node.kind === 'target' && item.node.chapterIndex !== undefined && this.chapterDownloadEnabled &&
          this.mangaChapter(item) !== undefined &&
          this.mangaChapter(item)?.navigable !== false &&
          this.mangaChapter(item)?.downloadState !== 'unknown') {
          Stack() {
            Stack() {
              Image(this.mangaChapter(item)?.downloadState === 'completed' ?
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
              .width(15).height(15);
          }.width(26).height(Math.max(28, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale()))
            .accessibilityText(this.chapterDownloadActionsEnabled ? '管理本章下载' :
              this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节')
            .enabled(this.canDownloadTarget(this.mangaPaintNode(item.node)))
            .onClick((): void => { if (item.node !== undefined) this.downloadTarget(this.mangaPaintNode(item.node)); });
          }.width(26).height(Math.max(28, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale()))
            .focusable(false).accessibilityLevel('no').onClick((): void => {});
        }
        if (item.node.kind === 'group' && this.mangaGroupNode(item.node).hasChildren && !this.mangaQuickDisplay) {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_down_theme_night') : $r('app.media.manga_sheet_chevron_down'))
            .width(16).height(16).rotate({ angle: this.mangaGroupNode(item.node).expanded ? 0 : -90 })
            .animation(motionAnimateParam('manga.directory.fold'))
            .accessibilityText(`${this.mangaGroupNode(item.node).expanded ? '折叠' : '展开'}${this.mangaGroupNode(item.node).title}子目录`)
            .onClick((): void => this.toggleMangaRow(item));
        } else if (item.node.kind === 'target' && this.isCurrentMangaNode(item)) {
          Text('正在读').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
            .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.stateFontSize)
            .lineHeight(MANGA_DIRECTORY_VISUAL.stateLineHeight).fontColor(this.mangaColor('accent'));
        } else if (item.node.kind === 'target') {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_right_theme_night') : $r('app.media.manga_sheet_chevron_right'))
            .width(13).height(13);
        } else if (item.node.kind === 'disabled') {
          Text('暂不可读').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
            .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.stateFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.stateLineHeight).fontColor(this.mangaColor('muted'));
        }
      }
    }.width('100%').layoutWeight(1)
      .constraintSize({ minHeight: item.node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupMinHeight : MANGA_DIRECTORY_VISUAL.namedMinHeight })
      .padding({ left: this.mangaRowPaddingLeft(item),
        right: item.node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupPaddingX : MANGA_DIRECTORY_VISUAL.namedPaddingX,
        top: item.node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupPaddingY : MANGA_DIRECTORY_VISUAL.namedPaddingY,
        bottom: item.node?.kind === 'group' ? MANGA_DIRECTORY_VISUAL.groupPaddingY : MANGA_DIRECTORY_VISUAL.namedPaddingY })
      .margin({ top: this.mangaGroupSpacing(item) })
      .border({ width: { top: this.mangaFirstDisplayRow(item) &&
        !(item.node?.kind === 'target' && item.node.hasChildren && !this.mangaQuickDisplay) ? MANGA_DIRECTORY_VISUAL.gridBorder : 0,
        bottom: item.node?.kind === 'group' || item.node?.kind === 'target' && item.node.hasChildren && !this.mangaQuickDisplay ?
          0 : MANGA_DIRECTORY_VISUAL.gridBorder },
        color: { top: this.mangaColor('line'), bottom: this.mangaColor('line') } })
      .backgroundColor(item.node?.kind === 'target' && this.isCurrentMangaNode(item) ?
        this.mangaColor('active') : item.node?.kind === 'group' ? this.mangaColor('soft') : Color.Transparent)
      .visibility(this.mangaRowAdmitted(item) ? Visibility.Visible : Visibility.Hidden)
      .opacity(item.node?.kind === 'disabled' ? MANGA_DIRECTORY_VISUAL.disabledOpacity : 1)
      .enabled(this.interactionEnabled && item.node?.kind !== 'disabled' && !(item.node?.kind === 'group' && this.mangaSearchActive))
      .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled && item.node?.kind !== 'disabled' &&
        (item.node?.kind !== 'group' || !this.mangaSearchActive),
        item.node?.kind !== 'group' || this.interactionEnabled && !this.mangaSearchActive,
        this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme))
      .accessibilityText(this.mangaRowAccessibility(item, false))
      .onClick((): void => this.selectMangaRow(item));
  }

  @Builder
  private row(item: ReaderDirectoryNavigationItem) {
    Row() {
      if (item.node === undefined) {
        Text('…').fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      } else {
        if (this.isCurrentNode(item)) {
          Row().width(3).height(this.rowHeight).borderRadius(999)
            .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(item.node.title)
          .layoutWeight(1)
          .padding({ left: 9 + Math.min(3, this.displayLevel(item.node) - 1) * 12, right: 9 })
          .fontFamily(TYPE_READER_DIRECTORY_TITLE.fontFamily).fontSize(TYPE_READER_DIRECTORY_TITLE.fontSizeFp).fontWeight(TYPE_READER_DIRECTORY_TITLE.fontWeight)
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
            .width(34).height(this.rowHeight).fontSize(TYPE_READER_DIRECTORY_DISCLOSURE.fontSizeFp)
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
    if (this.mangaDisplay) {
      Grid(this.scroller, this.mangaGridLayoutOptions()) {
        if (this.view.visibleTotal === 0) {
          GridItem() { this.mangaEmptyState(); }.width('100%');
        }
        LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
          GridItem() {
            if (this.mangaCellPlacement(item) !== undefined && this.mangaCellPlacement(item)?.kind !== 'row') this.mangaNumberCell(item);
            else this.mangaRow(item);
          }.width('100%');
        }, (item: ReaderDirectoryNavigationItem): string => this.rowKey(item));
      }.columnsTemplate('1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr')
        .columnsGap(0).rowsGap(0).width('100%').height('100%')
        .padding({ left: this.listPaddingX, right: this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX,
          top: 0, bottom: 0 })
        .contentStartOffset(this.mangaContentStartOffset()).contentEndOffset(this.mangaContentEndOffset())
        .scrollBar(BarState.Auto).scrollBarWidth(MANGA_DIRECTORY_VISUAL.scrollbarWidth).scrollBarColor(this.mangaColor('scrollbar')).edgeEffect(this.edgeEffectMode)
        .enableScrollInteraction(this.interactionEnabled).cachedCount(4)
        .onWillStartDragging((): void => {
          this.mangaDragging = true;
          this.initialPositionPending = false;
          this.positionPlan = undefined;
          this.onUserScrollIntent();
        })
        .onScrollIndex((start: number, _end: number): void => {
          this.firstVisibleIndex = this.dataSource.coreIndex(start);
          if (!this.initialPositionPending) this.captureViewportAnchor();
        })
        .onScroll((): void => this.publishMangaScrollOffset())
        .onScrollStop((): void => { this.publishMangaScrollOffset(); this.settleMangaScroll(); })
        .onAreaChange((_oldArea: Area, newArea: Area): void => {
          const width = Number(newArea.width);
          if (Number.isFinite(width) && width > 0 && this.mangaViewportWidth !== width) this.mangaViewportWidth = width;
          if (!this.layoutReady && Number(newArea.height) > 0) {
            this.layoutReady = true;
            this.onFirstLayout();
            this.positionInitialCurrent();
          }
        });
    } else {
      List({ space: 0, scroller: this.scroller }) {
      LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
        ListItem() {
          if (this.mangaDisplay) this.mangaRow(item);
          else this.row(item);
        }.width('100%').height(this.mangaDisplay ? undefined : this.rowHeight);
      }, (item: ReaderDirectoryNavigationItem): string => this.rowKey(item));
    }
    .width('100%').height('100%')
    .padding({ left: this.listPaddingX, right: this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX,
      top: this.mangaDisplay ? 0 : this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY,
      bottom: this.mangaDisplay ? 0 : this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY })
    .contentStartOffset(this.mangaDisplay ? (this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY) :
      readerScrollStartOffset(this.scrollLayout))
    .contentEndOffset(this.mangaDisplay ? this.mangaCatalogDisplay ? 18 :
      (this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY) +
      (this.mangaQuickDisplay ? MANGA_DIRECTORY_VISUAL.quickScrollBottom : 0) :
      readerScrollEndOffset(this.scrollLayout))
    .scrollBar(this.mangaDisplay ? BarState.Auto : BarState.Off)
    .scrollBarWidth(this.mangaDisplay ? MANGA_DIRECTORY_VISUAL.scrollbarWidth : undefined)
    .scrollBarColor(this.mangaDisplay ? this.mangaColor('scrollbar') : undefined).edgeEffect(this.edgeEffectMode)
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
    .onScroll((): void => this.publishMangaScrollOffset())
    .onScrollStop((): void => { this.publishMangaScrollOffset(); this.captureViewportAnchor(); this.onScrollSettled(); })
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      if (!this.layoutReady && Number(newArea.height) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
        this.positionInitialCurrent();
      }
      });
    }
  }
}
