import { ReaderDelayedRowPress, readerAnimatePress, readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { ReaderDirectoryDataPublication, sameReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { mangaDirectoryDisplay, type MangaDirectoryDisplayProjection } from '../../manga/ui/MangaDirectoryDisplay';
import { mangaDirectoryDownloadStatusText, mangaDirectoryDownloadStatusWidth } from '../../manga/ui/MangaDirectoryState';
import { TYPE_APP_INHERITED_HINT, TYPE_READER_DIRECTORY_TITLE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, mangaDirectoryScale } from '../../manga/ui/MangaDirectoryVisual';
import { MangaDirectoryPressFeedback } from '../../../ui/foundation/MangaDirectoryPressFeedback';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, type ReaderDirectoryNavigationPort, type ReaderDirectoryNavigationPortFactory, readerDirectoryScopeKey, isReaderDirectoryViewStale, type ReaderDirectoryNavigationNode,
  type ReaderDirectoryNavigationReady, type ReaderDirectoryNavigationPage } from '../application/ReaderDirectoryNavigation';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { LengthMetrics } from '@kit.ArkUI';
import { util } from '@kit.ArkTS';
import { readerDirectoryObserveScrollCommand, readerDirectoryObserveScrollIntent, readerDirectorySaveViewportAnchor, readerDirectoryViewportAnchor,
  type ReaderDirectoryViewportAnchor } from '../presentation/ReaderDirectoryViewport';
import { mangaDirectoryNodePlacement, mangaDirectoryNodePlacements, mangaDirectorySameNodeRun,
  type MangaDirectoryNodePlacement } from '../../manga/ui/MangaDirectoryLayout';

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

function cachedDirectoryPage(view: ReaderDirectoryNavigationReady, offset: number): ReaderDirectoryNavigationPage | undefined {
  const nodes = directoryPages.get(`${directoryPagePrefix(view)}${offset}`);
  if (nodes === undefined) return undefined;
  return { viewId: view.viewId, visibleTotal: view.visibleTotal, nodes,
    nextOffset: offset + nodes.length < view.visibleTotal ? offset + nodes.length : undefined };
}

export class ReaderDirectoryPageWindow {
  private prefix: string = '';
  bind(view: ReaderDirectoryNavigationReady): void {
    this.prefix = directoryPagePrefix(view);
  }
  clear(): void {
    if (this.prefix.length === 0) return;
    for (const key of directoryPages.keys()) if (key.startsWith(this.prefix)) directoryPages.remove(key);
    this.prefix = '';
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
  leadingInsetProgress?: number;
  align: ScrollAlign;
  currentInset?: number;
  smooth?: boolean;
  startAtCatalogTop?: boolean;
}

class ReaderDirectoryNavigationDataSource implements IDataSource {
  private view: ReaderDirectoryNavigationReady | undefined = undefined;
  private pages: ReaderDirectoryPageWindow = new ReaderDirectoryPageWindow();
  private pending: Set<number> = new Set<number>();
  /** Cache ownership and native publication are separate during motion. */
  private admittedPages: Set<number> = new Set<number>();
  private listeners: DataChangeListener[] = [];
  private itemsById: Map<string, ReaderDirectoryNavigationItem> = new Map();
  private deferredChanges: Map<number, number[]> = new Map();
  private viewportFirst: number = 0;
  private viewportLast: number = 0;
  private viewportNoticeQueued: boolean = false;
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
    for (const listener of this.listeners) listener.onDataChange(displayIndex);
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
    const item = this.itemsById.get(nodeId);
    if (item === undefined) return undefined;
    const node = this.loadedNode(item.index);
    if (node?.nodeId === nodeId) return { key: item.key, index: item.index, node };
    this.itemsById.delete(nodeId);
    return undefined;
  }
  private indexPage(offset: number, nodes: ReaderDirectoryNavigationNode[]): void {
    nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
      this.itemsById.set(node.nodeId, { key: node.nodeId, index: offset + index });
    });
  }
  setViewport(first: number, last: number): void {
    const changed = this.viewportFirst !== first || this.viewportLast !== last;
    this.viewportFirst = first;
    this.viewportLast = last;
    if (changed)
      for (let index = Math.floor(first / DIRECTORY_PAGE_SIZE) * DIRECTORY_PAGE_SIZE; index <= last; index += DIRECTORY_PAGE_SIZE)
        this.requestPage(index);
    if (this.viewportNoticeQueued || this.deferredChanges.size === 0) return;
    this.viewportNoticeQueued = true;
    // onScrollIndex can run inside native layout. Apply only the latest
    // viewport's notifications after the current List/Grid pass returns.
    setTimeout((): void => {
      this.viewportNoticeQueued = false;
      for (const entry of this.deferredChanges) {
        const offset = entry[0];
        if (!this.inViewport(offset)) continue;
        this.deferredChanges.delete(offset);
        for (const index of entry[1]) this.notifyCoreChanged(index);
      }
    }, 0);
  }
  inViewport(offset: number): boolean {
    return offset <= this.viewportLast && offset + DIRECTORY_PAGE_SIZE > this.viewportFirst;
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
    this.itemsById.clear();
    this.deferredChanges.clear();
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
    for (const offset of this.admittedPages) {
      const nodes = this.pages.get(offset);
      if (nodes !== undefined) this.indexPage(offset, nodes);
    }
    for (const listener of this.listeners) listener.onDataReloaded();
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
    for (const old of previousPage ?? []) this.itemsById.delete(old.nodeId);
    if (page.nodes.length > 0) this.pages.put(offset, page.nodes);
    this.admittedPages.add(offset);
    this.indexPage(offset, page.nodes);
    const resident = this.pages.keys();
    for (const oldOffset of this.admittedPages) {
      if (resident.includes(oldOffset)) continue;
      this.admittedPages.delete(oldOffset);
      this.deferredChanges.delete(oldOffset);
      for (const entry of this.itemsById) {
        const item = entry[1];
        if (item.index >= oldOffset && item.index < oldOffset + DIRECTORY_PAGE_SIZE) this.itemsById.delete(entry[0]);
      }
    }
    const changed = this.deferredChanges.get(offset) ?? [];
    const needsNotification = new Set<number>(changed);
    page.nodes.forEach((node: ReaderDirectoryNavigationNode, index: number): void => {
      const previous = previousPage?.[index];
      if (previous?.nodeId === node.nodeId && previous.expanded === node.expanded && previous.title === node.title &&
        previous.displayTitle === node.displayTitle && previous.isVip === node.isVip && previous.isPay === node.isPay &&
        previous.contextTitle === node.contextTitle && previous.parentTitle === node.parentTitle &&
        previous.readableDescendantCount === node.readableDescendantCount && previous.depth === node.depth &&
        previous.kind === node.kind) return;
      needsNotification.add(offset + index);
    });
    if (this.inViewport(offset)) {
      this.deferredChanges.delete(offset);
      for (const index of needsNotification) this.notifyCoreChanged(index);
    } else if (needsNotification.size > 0) this.deferredChanges.set(offset, Array.from(needsNotification));
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

/** Only the pressed text target repaints. Selection still belongs to the list. */
@Component
struct ReaderDirectoryTreeTitle {
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @Prop title: string = '';
  @Prop label: string = '';
  @Prop focusId: string = '';
  @Prop rowHeight: number = 44;
  @Prop leftPadding: number = 9;
  @Prop titleMaxLines: number = 1;
  @Prop scheme: string = 'day';
  @Prop dimmed: boolean = false;
  @Prop @Watch('clearPress') inputEnabled: boolean = true;
  @Prop @Watch('clearPress') viewId: string = '';
  activate: () => void = (): void => {};
  @State private pressed: boolean = false;
  private readonly delayedPress: ReaderDelayedRowPress = new ReaderDelayedRowPress((key: string): void => {
    if (key.length === 0) this.pressed = false;
    else readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.pressed = true; });
  });

  private clearPress(): void {
    this.delayedPress.cancel();
  }
  aboutToDisappear(): void { this.clearPress(); }

  build() {
    Text(this.title).id(this.focusId).height(this.rowHeight).layoutWeight(1)
      .padding({ left: this.leftPadding, right: 9 })
      .fontFamily(TYPE_READER_DIRECTORY_TITLE.fontFamily).fontSize(TYPE_READER_DIRECTORY_TITLE.fontSizeFp)
      .fontWeight(TYPE_READER_DIRECTORY_TITLE.fontWeight)
      .fontColor(readerAppColor(this.dimmed ? 'TOK_READ_MUTED' : 'TOK_READ_INK', this.scheme))
      .maxLines(this.titleMaxLines).textOverflow({ overflow: TextOverflow.Ellipsis })
      .backgroundColor(readerPressSurface(Color.Transparent, this.scheme, this.pressed, this.reduceMotion))
      .scale(readerPressScale(this.pressed, this.reduceMotion)).opacity(readerPressOpacity(this.pressed, this.reduceMotion))
      .accessibilityText(this.label).responseRegion(readerActionTouchRegion('100%', '100%'))
      .attributeModifier(new ReaderActionAccessibility(this.label, this.inputEnabled, false))
      .onTouch((event: TouchEvent): void => {
        this.delayedPress.observe(event, 'title', this.inputEnabled);
      })
      .onClick((): void => { if (this.inputEnabled) this.activate(); });
  }
}

/** Virtual, Core-paged display rows. Its placeholders never claim a chapter identity. */
@Component
export struct ReaderDirectoryNavigationList {
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
  @Prop @Watch('onViewChanged') view: ReaderDirectoryNavigationReady;
  @Prop bookId: string = '';
  @Prop sourceId: string = 'local';
  @Prop @Watch('onControlRowHeightChanged') rowHeight: number = 44;
  @Prop titleMaxLines: number = 1;
  @Prop mangaDisplay: boolean = false;
  @Prop @Watch('onMangaQuickChanged') mangaQuickDisplay: boolean = false;
  @Prop mangaRowMinHeight: number = 58;
  @Prop mangaCatalogDisplay: boolean = false;
  @Prop mangaCatalogNarrow: boolean | undefined = undefined;
  @Prop mangaInitialViewportWidth: number = 0;
  /** Parent-owned fixed header bottom in this scroll viewport's coordinates. */
  @Prop mangaVisibleTopInset: number = 0;
  @Prop @Watch('onMangaQuickChanged') mangaSearchActive: boolean = false;
  @State private rowPresentationRevision: number = 0;
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
  inputCurrent: (() => boolean) | undefined = undefined;
  chapterInputCurrent: ((chapter: LocalReadingTocEntry) => boolean) | undefined = undefined;
  chapterEntries: LocalReadingTocEntry[] = [];
  directoryPublication: ReaderDirectoryDataPublication | undefined = undefined;
  @Prop @Watch('onChapterEntriesChanged') directoryEntriesRevision: number = 0;
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.directoryPublication?.entriesAt(this.directoryEntriesRevision) ?? this.chapterEntries;
  }
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop chapterDownloadActionsEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop bookmarkActionsEnabled: boolean = true;
  @Prop verificationChapterActions: boolean = false;
  /** One optional native-only prefix; Core/page ranks stay zero based. */
  @Prop @Watch('onPrefixChanged') headerCount: number = 0;
  @Prop @Watch('onPrefixChanged') prefixHeight: number = 0;
  @Prop @Watch('onPrefixChanged') prefixIdentity: string = '';
  @Prop @Watch('onPrefixReveal') prefixRevealRevision: number = 0;
  @BuilderParam prefixBuilder: () => void = this.emptyPrefix;
  @BuilderParam mangaTailBuilder: () => void = this.emptyPrefix;
  @Prop tailHeight: number = 0;
  @BuilderParam tailBuilder: () => void = this.emptyPrefix;
  @BuilderParam emptyBuilder: () => void = this.emptyPrefix;
  @Prop emptyReadStateVisible: boolean = false;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  onToggleNode: (node: ReaderDirectoryNavigationNode) => void = (_node: ReaderDirectoryNavigationNode): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onScrollSettled: () => void = (): void => {};
  onScrollOffset: (offset: number) => void = (_offset: number): void => {};
  onClearSearch: () => void = (): void => {};
  onFirstLayout: () => void = (): void => {};
  onInvalidated: (stale: boolean) => void = (_stale: boolean): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  private dataSource: ReaderDirectoryNavigationDataSource =
    new ReaderDirectoryNavigationDataSource((offset: number): void => this.loadPage(offset));
  /** Optional dependency only; absent callers keep the production Gateway. */
  navigationPortFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
  private gateway: ReaderDirectoryNavigationPort | undefined = undefined;
  @State private chapterPressKey: string = '';
  private readonly chapterDelayedPress: ReaderDelayedRowPress = new ReaderDelayedRowPress((key: string): void => {
    if (key.length === 0) this.chapterPressKey = '';
    else readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.chapterPressKey = key; });
  });
  private mounted: boolean = false;
  private generation: number = 0;
  private layoutReady: boolean = false;
  private mangaViewportHeight: number = 0;
  private chapterByIndex: Map<number, LocalReadingTocEntry> = new Map<number, LocalReadingTocEntry>();
  private loadedChapters: Map<number, LocalReadingTocEntry> = new Map<number, LocalReadingTocEntry>();
  private chapterSource: LocalReadingTocEntry[] | undefined = undefined;
  private initialPositionPending: boolean = true;
  private positionPlan: ReaderDirectoryPositionPlan | undefined = undefined;
  private firstVisibleIndex: number = 0;
  private boundHeaderCount: number = 0;
  private boundPrefixIdentity: string = '';
  private boundPrefixHeight: number = 0;
  private prefixLayoutGeneration: number = 0;
  private prefixChangePending: boolean = false;
  private prefixChangeHadHeader: boolean = false;
  private prefixChangeIdentity: string = '';
  private prefixChangeOffset: number = 0;
  private prefixRevealActive: boolean = false;
  private prefixEverMounted: boolean = false;
  private prefixScrollIntentUnsubscribe: (() => void) | undefined = undefined;
  private selectionGeneration: number = 0;
  private pendingPages: ReaderDirectoryNavigationPendingPage[] = [];
  private scrollCommandUnsubscribe: (() => void) | undefined = undefined;
  // Numeric layout metadata only: chapter nodes remain solely in the shared
  // 12-page LRU, including while a different directory owns the viewport.
  private mangaGridSpans: Map<number, number> = new Map<number, number>();
  private mangaLayoutByNode: Map<string, MangaDirectoryNodePlacement> = new Map<string, MangaDirectoryNodePlacement>();
  private mangaLayoutSignature: string = '';
  private mangaDisplayCache: WeakMap<ReaderDirectoryNavigationNode, MangaDirectoryDisplayProjection> = new WeakMap();
  private gridProjectionRevision: number = 0;
  private gridOptionsRevision: number = -1;
  private gridOptionsPrefix: number = -1;
  private gridOptionsTail: number = -1;
  private gridOptions: GridLayoutOptions = { regularSize: [1, 1] };
  private mangaLayoutPageRefs: Map<number, ReaderDirectoryNavigationNode[]> = new Map<number, ReaderDirectoryNavigationNode[]>();
  private mangaDragging: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    this.layoutReady = false;
    this.mangaViewportHeight = 0;
    this.initialPositionPending = true;
    this.mangaDragging = false;
    this.pendingPages = [];
    this.boundHeaderCount = this.nativeHeaderCount();
    if (this.boundHeaderCount === 1) this.prefixEverMounted = true;
    this.boundPrefixIdentity = this.prefixIdentity;
    this.boundPrefixHeight = this.prefixHeight;
    this.prefixRevealActive = false; this.prefixChangePending = false;
    this.bindPrefixScrollIntent();
    if (this.navigationPortFactory !== undefined) {
      this.gateway = this.navigationPortFactory();
    } else {
      this.gateway = new ReaderDirectoryNavigationGateway(ReaderRuntimeOwner.current());
    }
    this.scrollCommandUnsubscribe = readerDirectoryObserveScrollCommand(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onScrollCommand());
    this.dataSource.replace(this.view);
    this.rowPresentationRevision += 1;
    this.positionPlan = this.planPosition(true);
    this.onChapterEntriesChanged();
  }

  aboutToDisappear(): void {
    this.clearChapterPress();
    this.captureViewportAnchor();
    this.scrollCommandUnsubscribe?.();
    this.scrollCommandUnsubscribe = undefined;
    this.prefixScrollIntentUnsubscribe?.(); this.prefixScrollIntentUnsubscribe = undefined;
    this.mounted = false; this.generation += 1; this.selectionGeneration += 1; this.prefixLayoutGeneration += 1; this.pendingPages = [];
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
    this.clearChapterPress();
    if (!this.mounted) return;
    if (this.dataSource.currentView()?.viewId === this.view.viewId) return;
    if (!this.prefixChangePending) this.captureViewportAnchor();
    this.prefixLayoutGeneration += 1; this.prefixChangePending = false;
    this.prefixRevealActive = false;
    this.generation += 1;
    this.selectionGeneration += 1;
    this.pendingPages = [];
    this.positionPlan = this.planPosition(true);
    this.initialPositionPending = this.positionPlan !== undefined;
    this.dataSource.replace(this.view);
    this.rowPresentationRevision += 1;
    this.schedulePosition();
  }

  private onMangaQuickChanged(): void {
    if (!this.mounted) return;
    this.selectionGeneration += 1;
    this.captureViewportAnchor();
    this.rowPresentationRevision += 1;
    this.positionPlan = this.planPosition();
    this.initialPositionPending = this.positionPlan !== undefined;
    this.schedulePosition();
  }

  private onControlRowHeightChanged(): void {
    if (!this.mounted || this.mangaDisplay || this.initialPositionPending) return;
    this.captureViewportAnchor();
    const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId));
    if (anchor === undefined || anchor.viewId !== this.view.viewId ||
      anchor.navigationRevision !== this.view.navigationRevision) return;
    this.positionPlan = { viewId: this.view.viewId, index: anchor.visibleIndex,
      rowFraction: anchor.rowFraction, align: ScrollAlign.START };
    this.initialPositionPending = true;
    this.schedulePosition();
  }

  private onInteractionChanged(): void {
    if (!this.interactionEnabled) this.clearChapterPress();
    if (!this.mounted) return;
    if (!this.interactionEnabled) {
      this.retirePrefixPosition();
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
      const pages = this.takePendingViewportPages();
      for (const item of pages) this.dataSource.admit(item.offset, item.page);
      if (pages.length > 0) this.rowPresentationRevision += 1;
      const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId));
      if (anchor !== undefined && anchor.viewId === this.view.viewId &&
        anchor.navigationRevision === this.view.navigationRevision) {
        this.positionPlan = { viewId: this.view.viewId, index: anchor.visibleIndex,
          rowFraction: anchor.rowFraction, leadingInsetProgress: anchor.leadingInsetProgress, align: ScrollAlign.START };
        this.initialPositionPending = true;
        this.positionInitialCurrent();
      }
    }, 0);
  }

  @Builder
  private emptyPrefix() {}

  private nativeHeaderCount(): number { return this.headerCount === 1 ? 1 : 0; }

  private retirePrefixPosition(): void {
    if (this.nativeHeaderCount() !== 1 && !this.prefixChangePending) return;
    this.prefixLayoutGeneration += 1; this.prefixChangePending = false;
    this.prefixRevealActive = false;
    this.initialPositionPending = false; this.positionPlan = undefined;
  }

  private onPrefixReveal(): void {
    this.retirePrefixPosition();
    if (this.nativeHeaderCount() === 1) this.prefixRevealActive = true;
  }

  private bindPrefixScrollIntent(): void {
    this.prefixScrollIntentUnsubscribe?.(); this.prefixScrollIntentUnsubscribe = undefined;
    if (this.nativeHeaderCount() === 1) {
      this.prefixScrollIntentUnsubscribe = readerDirectoryObserveScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId),
        (): void => this.retirePrefixPosition());
    }
  }

  private nativeDisplayIndex(index: number, headerCount: number = this.nativeHeaderCount()): number | undefined {
    const total = this.dataSource.currentView()?.visibleTotal ?? this.view.visibleTotal;
    if (!Number.isInteger(index) || index < 0 || index >= total) return undefined;
    const display = this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive ?
      this.dataSource.displayIndex(index) : index;
    return display === undefined ? undefined : display + headerCount;
  }

  private dataIndex(nativeIndex: number): number {
    const index = nativeIndex - this.nativeHeaderCount();
    if (!Number.isInteger(index) || index < 0) return -1;
    return this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive ?
      this.dataSource.coreIndex(index) : index < this.view.visibleTotal ? index : -1;
  }

  private onPrefixChanged(): void {
    if (!this.mounted) return;
    const count = this.nativeHeaderCount();
    if (count === 1) this.prefixEverMounted = true;
    if (count === this.boundHeaderCount && this.prefixIdentity === this.boundPrefixIdentity &&
      this.prefixHeight === this.boundPrefixHeight) return;
    // One reconciliation may update count, identity and measured height. Only
    // its first watch still owns the old native index space.
    if (!this.prefixChangePending) {
      this.captureViewportAnchor(this.boundHeaderCount);
      this.prefixChangeHadHeader = this.prefixRevealActive || this.boundHeaderCount > 0 && this.firstVisibleIndex < 0;
      this.prefixChangeIdentity = this.boundPrefixIdentity;
      this.prefixChangeOffset = 0;
      if (this.prefixChangeHadHeader && !this.prefixRevealActive) {
        try { this.prefixChangeOffset = Math.max(0, this.scroller?.currentOffset().yOffset ?? 0); } catch (_error) {}
      }
      this.prefixChangePending = true;
    }
    if (count !== this.boundHeaderCount) this.layoutReady = false;
    this.boundHeaderCount = count; this.boundPrefixIdentity = this.prefixIdentity; this.boundPrefixHeight = this.prefixHeight;
    this.bindPrefixScrollIntent();
    const epoch = ++this.prefixLayoutGeneration, generation = this.generation, viewId = this.view.viewId;
    setTimeout((): void => {
      if (!this.mounted || !this.interactionEnabled || epoch !== this.prefixLayoutGeneration ||
        generation !== this.generation || viewId !== this.view.viewId) return;
      const prefixWasVisible = this.prefixChangeHadHeader;
      const prefixOffset = this.prefixChangeIdentity === this.prefixIdentity ? this.prefixChangeOffset : 0;
      this.prefixChangePending = false;
      if (prefixWasVisible) {
        // Prefix pixels are UI state only. Never save them as Core rank zero.
        this.initialPositionPending = false; this.positionPlan = undefined;
        try {
          if (count > 0) this.scroller?.scrollTo({ xOffset: 0, yOffset: Math.min(prefixOffset, Math.max(0, this.prefixHeight)) });
          else if (this.view.visibleTotal > 0) this.scroller?.scrollToIndex(0, false, ScrollAlign.START);
        } catch (_error) {}
      } else {
        this.positionPlan = this.planPosition();
        this.initialPositionPending = this.positionPlan !== undefined;
        this.positionInitialCurrent();
      }
    }, 0);
  }

  private captureViewportAnchor(headerCount: number = this.nativeHeaderCount()): void {
    const view = this.dataSource.currentView();
    const index = this.firstVisibleIndex;
    const node = this.dataSource.loadedNode(index);
    if (view === undefined || node === undefined || this.scroller === undefined) return;
    try {
      const displayIndex = this.nativeDisplayIndex(index, headerCount);
      if (displayIndex === undefined) return;
      const rect = this.scroller.getItemRect(displayIndex);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return;
      const anchor: ReaderDirectoryViewportAnchor = { bookId: readerDirectoryScopeKey(this.sourceId, this.bookId),
        navigationRevision: view.navigationRevision, viewId: view.viewId,
        nodeId: node.nodeId, visibleIndex: index, rowFraction: -rect.y / rect.height };
      if (this.mangaDisplay && !this.mangaQuickDisplay && headerCount === 0 && index === 0 && rect.y > 0) {
        const inset = this.mangaContentStartOffset();
        // Space before the first row is measured chrome. Saving only the
        // clamped row fraction would move that row under the fixed header.
        if (inset > 0) anchor.leadingInsetProgress = Math.max(0, 1 - rect.y / inset);
      }
      readerDirectorySaveViewportAnchor(anchor);
    } catch (_error) { /* The native List may be between layout frames. */ }
  }

  private planPosition(adoptingView: boolean = false): ReaderDirectoryPositionPlan | undefined {
    if (adoptingView && this.mangaDisplay && this.view.startAtCatalogTop) {
      return { viewId: this.view.viewId, index: 0, rowFraction: 0, align: ScrollAlign.START, startAtCatalogTop: true };
    }
    if (this.view.locateCurrent && this.view.currentVisibleIndex !== undefined)
      return { viewId: this.view.viewId, index: this.view.currentVisibleIndex,
        rowFraction: 0, align: this.mangaDisplay && this.view.currentDisplayCentered !== true ? ScrollAlign.START : ScrollAlign.CENTER,
        currentInset: this.mangaDisplay ? (this.view.currentDisplayInset ?? 12) : undefined,
        smooth: this.mangaDisplay && this.view.currentDisplaySmooth === true };
    const anchor = readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId));
    if (anchor !== undefined && anchor.navigationRevision === this.view.navigationRevision) {
      const index = this.view.anchorVisibleIndex ??
        (anchor.viewId === this.view.viewId ? anchor.visibleIndex : undefined);
      if (index !== undefined && index < this.view.visibleTotal) {
        return { viewId: this.view.viewId, index, rowFraction: anchor.rowFraction,
          leadingInsetProgress: anchor.leadingInsetProgress, align: ScrollAlign.START };
      }
    }
    if (this.view.currentVisibleIndex !== undefined)
      return { viewId: this.view.viewId, index: this.view.currentVisibleIndex,
        rowFraction: 0, align: this.mangaDisplay ? ScrollAlign.START : ScrollAlign.CENTER,
        currentInset: this.mangaDisplay ? (this.view.currentDisplayInset ?? 50) : undefined,
        smooth: false };
    if (this.mangaDisplay && this.nativeHeaderCount() === 1) return undefined;
    if (this.view.visibleTotal > 0) {
      // An unanchored full manga catalog retains the measured title and query
      // inset by using START without applying a second offset.
      return { viewId: this.view.viewId, index: 0, rowFraction: 0, align: ScrollAlign.START,
        startAtCatalogTop: this.mangaDisplay && !this.mangaQuickDisplay };
    }
    return undefined;
  }

  private schedulePosition(): void {
    const generation = this.generation, prefixEpoch = this.prefixLayoutGeneration;
    const apply = (): void => {
      if (this.mounted && generation === this.generation && prefixEpoch === this.prefixLayoutGeneration) this.positionInitialCurrent();
    };
    if (this.positionPlan?.startAtCatalogTop) {
      const context = this.getUIContext();
      // LazyForEach must adopt the accepted view before its first item can align.
      context.postFrameCallback(new ReaderPostLayoutFrame(context, apply));
    } else {
      setTimeout(apply, 0);
    }
  }

  private chapterEntry(index: number): LocalReadingTocEntry | undefined {
    if (this.directoryPublication !== undefined) return this.directoryPublication.entryAt(this.directoryEntriesRevision, index);
    return this.chapterByIndex.get(index);
  }

  private onChapterEntriesChanged(): void {
    const source = this.currentDirectoryEntries();
    if (this.chapterSource === source) return;
    this.chapterSource = source;
    if (this.directoryPublication === undefined) {
      this.chapterByIndex.clear();
      for (const chapter of source) this.chapterByIndex.set(chapter.index, chapter);
    }
    const previous = this.loadedChapters;
    const next = new Map<number, LocalReadingTocEntry>();
    const changed = new Set<number>();
    for (const page of this.dataSource.loadedPages()) for (const node of page.nodes) {
      const index = node.chapterIndex;
      if (index === undefined || next.has(index)) continue;
      const chapter = this.chapterEntry(index);
      const earlier = previous.get(index);
      if (chapter !== undefined) next.set(index, chapter);
      if (chapter === undefined || earlier === undefined) {
        if (chapter !== earlier) changed.add(index);
      } else if (chapter !== earlier && !sameReaderDirectoryData([earlier], [chapter])) changed.add(index);
    }
    this.loadedChapters = next;
    this.dataSource.changedChapters(changed);
    // Stable native row IDs still consume changed marker facts even if their
    // builder was retained by LazyForEach.
    if (changed.size > 0) this.rowPresentationRevision += 1;
  }

  private bookmarkActionEnabled(chapter: LocalReadingTocEntry | undefined): boolean {
    return this.directoryInputCurrent() && this.bookmarkActionsEnabled && chapter !== undefined &&
      (this.chapterInputCurrent?.(chapter) ?? true) &&
      chapter.navigable !== false && chapter.bookmarks !== undefined &&
      (chapter.bookmarks.length > 0 || this.chapterStartBookmarkCreationEnabled);
  }

  private marker(chapter: LocalReadingTocEntry): void {
    if (!this.bookmarkActionEnabled(chapter)) return;
    const state = readerDirectoryBookmarkMarkerState(chapter);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled)
      this.onCreateChapterStartBookmark(state.createRequest);
  }

  private directoryInputCurrent(): boolean {
    return this.mounted && this.interactionEnabled && (this.inputCurrent?.() ?? true);
  }

  private toggleNode(node: ReaderDirectoryNavigationNode): void {
    if (!this.directoryInputCurrent()) return;
    this.captureViewportAnchor();
    this.onToggleNode(node);
  }

  private canDownloadTarget(node: ReaderDirectoryNavigationNode, admitted?: LocalReadingTocEntry): boolean {
    if (!this.directoryInputCurrent() || !this.chapterDownloadEnabled || node.kind !== 'target' || node.chapterIndex === undefined) return false;
    if (this.mangaDisplay) {
      const revision = this.rowPresentationRevision;
      const current = this.dataSource.loadedItemById(node.nodeId)?.node;
      if (revision < 0 || this.dataSource.currentView()?.viewId !== this.view.viewId ||
        current?.kind !== 'target' || current.chapterIndex !== node.chapterIndex) return false;
    }
    if (this.mangaQuickDisplay && !this.mangaSearchActive) {
      const index = this.dataSource.loadedItemById(node.nodeId)?.index;
      if (index === undefined || this.dataSource.displayIndex(index) === undefined) return false;
    }
    const chapter = admitted ?? this.chapterEntry(node.chapterIndex);
    return chapter !== undefined && (this.chapterInputCurrent?.(chapter) ?? true) && chapter.navigable !== false &&
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
      }).catch((_error: Error): void => { if (current()) this.onInvalidated(isReaderDirectoryViewStale(_error)); });
  }

  private positionInitialCurrent(): void {
    if (!this.initialPositionPending || this.scroller === undefined) return;
    const plan = this.positionPlan ?? this.planPosition();
    if (plan === undefined || plan.viewId !== this.view.viewId) return;
    if (plan.startAtCatalogTop) {
      if (!this.layoutReady) return;
      try {
        this.scroller.scrollToIndex(0, false, ScrollAlign.START);
        this.initialPositionPending = false;
        this.positionPlan = undefined;
      } catch (_detached) { /* The first native layout can still admit this plan. */ }
      return;
    }
    const displayIndex = this.nativeDisplayIndex(plan.index);
    if (displayIndex === undefined) return;
    try {
      if (plan.align === ScrollAlign.START) {
        const startOffset = this.mangaDisplay && this.nativeHeaderCount() === 0 ? this.mangaContentStartOffset() : 0;
        const visibleTop = this.mangaDisplay ? Math.max(0, this.mangaVisibleTopInset) : 0;
        const currentInset = this.mangaDisplay && this.nativeHeaderCount() === 1 && this.mangaViewportHeight > 0 &&
          plan.currentInset !== undefined ? Math.min(plan.currentInset,
            Math.max(0, this.mangaViewportHeight - visibleTop - this.positionRowHeight(plan.index))) : plan.currentInset;
        // Official START aligns the item to contentStartOffset. Translate only
        // viewport geometry; canonical Core ranks and target proofs stay intact.
        const progress = plan.leadingInsetProgress;
        const offset = currentInset !== undefined ? startOffset - visibleTop - currentInset :
          startOffset > 0 && !this.mangaQuickDisplay && plan.index === 0 && progress !== undefined ?
            startOffset * progress :
            startOffset + plan.rowFraction * (this.mangaDisplay ? this.positionRowHeight(plan.index) : this.rowHeight);
        this.scroller.scrollToIndex(displayIndex, plan.smooth === true && !this.reduceMotion, ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(offset) });
      } else if (this.mangaDisplay && this.mangaQuickDisplay && !this.mangaSearchActive) {
        this.scroller.scrollToIndex(displayIndex, false, ScrollAlign.CENTER);
      } else {
        this.scroller.scrollToIndex(displayIndex, false, ScrollAlign.CENTER);
      }
      this.initialPositionPending = false;
      this.positionPlan = undefined;
    } catch (_error) { /* Native layout will call again after its first frame. */ }
  }

  private selectTarget(node: ReaderDirectoryNavigationNode): void {
    if (!this.directoryInputCurrent() || node.kind !== 'target' || node.chapterIndex === undefined || this.gateway === undefined) {
      return;
    }
    const generation = this.generation;
    const selection = ++this.selectionGeneration;
    const viewId = this.view.viewId, bookId = this.bookId;
    void this.gateway.resolveTarget(bookId, viewId, node.nodeId,
      (): boolean => this.mounted && generation === this.generation && selection === this.selectionGeneration &&
        this.directoryInputCurrent() && viewId === this.view.viewId && bookId === this.bookId &&
        !(this.mangaQuickDisplay && !this.mangaSearchActive &&
          this.dataSource.displayIndex(this.dataSource.loadedItemById(node.nodeId)?.index ?? -1) === undefined))
      .then((target): void => {
        if (!this.directoryInputCurrent() || generation !== this.generation || selection !== this.selectionGeneration ||
          viewId !== this.view.viewId || bookId !== this.bookId) {
          return;
        }
        if (this.mangaQuickDisplay && !this.mangaSearchActive &&
          this.dataSource.displayIndex(this.dataSource.loadedItemById(node.nodeId)?.index ?? -1) === undefined) {
          return;
        }
        this.onSelectTarget(target.chapterIndex, target.chapterOffsetScalar, target.positionScope, target.directoryTargetProof);
      }).catch((_error: Error): void => {
        if (this.directoryInputCurrent() && generation === this.generation &&
          selection === this.selectionGeneration && viewId === this.view.viewId && bookId === this.bookId)
          this.onInvalidated(isReaderDirectoryViewStale(_error));
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
      const cached = cachedDirectoryPage(this.view, offset);
      const read = cached === undefined ? gateway.page(bookId, viewId, offset,
        (): boolean => this.mounted && generation === this.generation && viewId === this.view.viewId) : Promise.resolve(cached);
      void read
        .then((page: ReaderDirectoryNavigationPage): void => {
          if (!this.mounted || generation !== this.generation || viewId !== this.view.viewId) return;
          if (page.viewId !== viewId || page.visibleTotal !== this.view.visibleTotal) {
            this.dataSource.failed(offset);
            return;
          }
          if (!this.pageMayPublish(offset)) {
            // LazyForEach can request a buffered row well before it comes
            // onscreen. A late completion can only warm the bounded cache.
            cacheReaderDirectoryNavigationPage(this.view, offset, page);
            this.dataSource.failed(offset);
            return;
          }
          if (this.interactionEnabled && !(this.mangaDisplay && this.mangaDragging)) {
            if (this.mangaDisplay) this.admitMangaPages([{ offset, page }]);
            else {
              this.dataSource.admit(offset, page);
              this.rowPresentationRevision += 1;
            }
          }
          else {
            const pending: ReaderDirectoryNavigationPendingPage = { offset, page: cacheReaderDirectoryNavigationPage(this.view, offset, page) };
            this.pendingPages.push(pending);
          }
        }).catch((_error: Error): void => {
          if (!this.mounted || generation !== this.generation || viewId !== this.view.viewId || bookId !== this.bookId) return;
          this.dataSource.failed(offset);
          if (this.interactionEnabled && this.pageMayPublish(offset)) this.onInvalidated(isReaderDirectoryViewStale(_error));
        });
    }, 0);
  }

  private admitMangaPages(pages: ReaderDirectoryNavigationPendingPage[]): void {
    const currentPages = this.currentViewportPages(pages);
    if (currentPages.length === 0) return;
    const index = this.firstVisibleIndex;
    const hadNode = this.dataSource.loadedNode(index) !== undefined;
    if (hadNode) this.captureViewportAnchor();
    const anchor = hadNode ? readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, this.bookId)) : undefined;
    for (const item of currentPages) this.dataSource.admit(item.offset, item.page);
    this.rowPresentationRevision += 1;
    if (this.initialPositionPending) {
      this.schedulePosition();
      return;
    }
    if (this.mangaDragging || index < 0 || this.dataSource.loadedNode(index) === undefined ||
      this.dataSource.displayIndex(index) === undefined) return;
    // Only an actual pre-admission node rect contributes a pixel fraction.
    // A placeholder becoming a target restores its canonical index at START.
    const current = anchor?.viewId === this.view.viewId && anchor.visibleIndex === index ? anchor : undefined;
    this.positionPlan = { viewId: this.view.viewId, index, rowFraction: current?.rowFraction ?? 0,
      leadingInsetProgress: current?.leadingInsetProgress, align: ScrollAlign.START };
    this.initialPositionPending = true;
    this.schedulePosition();
  }

  private pageMayPublish(offset: number): boolean {
    if (this.dataSource.inViewport(offset)) return true;
    const plan = this.positionPlan;
    return this.initialPositionPending && plan !== undefined && plan.viewId === this.view.viewId &&
      plan.index >= offset && plan.index < offset + DIRECTORY_PAGE_SIZE;
  }

  private currentViewportPages(pages: ReaderDirectoryNavigationPendingPage[]): ReaderDirectoryNavigationPendingPage[] {
    const visible: ReaderDirectoryNavigationPendingPage[] = [];
    for (const item of pages) {
      if (this.pageMayPublish(item.offset)) visible.push(item);
      else this.dataSource.failed(item.offset);
    }
    return visible;
  }

  private takePendingViewportPages(): ReaderDirectoryNavigationPendingPage[] {
    const visible = this.currentViewportPages(this.pendingPages);
    this.pendingPages = [];
    return visible;
  }

  private observeViewport(start: number, end: number): void {
    this.firstVisibleIndex = this.dataIndex(start);
    const first = Math.max(0, this.firstVisibleIndex);
    const last = Math.max(first, this.dataIndex(end));
    this.dataSource.setViewport(first, last);
  }

  private settleMangaScroll(): void {
    this.mangaDragging = false;
    if (!this.interactionEnabled) { this.captureViewportAnchor(); this.onScrollSettled(); return; }
    const pages = this.takePendingViewportPages();
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

  /** Manga disclosure keeps its Image actor for rotation. Both row variants
   * read current bounded data. Text keeps its disclosure identity policy,
   * while viewport identity remains nodeId. */
  private rowKey(item: ReaderDirectoryNavigationItem): string {
    if (this.mangaDisplay && item.node?.kind === 'group')
      return `reader-navigation:${JSON.stringify([item.key, 'manga-group'])}`;
    if (this.mangaDisplay)
      return `reader-navigation:${JSON.stringify([item.key, item.node?.kind,
        item.node?.hasChildren === true ? item.node.expanded : null])}`;
    return `reader-navigation:${JSON.stringify([item.key,
      item.node?.hasChildren === true ? item.node.expanded : null])}`;
  }

  private currentPaintNode(node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode {
    // Register dependencies on both a published view and same-view page
    // admission. The Builder argument itself is retained by LazyForEach.
    const revision = this.rowPresentationRevision;
    const viewId = this.view.viewId;
    const current = this.dataSource.loadedItemById(node.nodeId);
    return revision >= 0 && this.dataSource.currentView()?.viewId === viewId ? current?.node ?? node : node;
  }

  private mangaGroupNode(node: ReaderDirectoryNavigationNode): ReaderDirectoryNavigationNode {
    return this.currentPaintNode(node);
  }

  private mangaChapter(item: ReaderDirectoryNavigationItem): LocalReadingTocEntry | undefined {
    const revision = this.rowPresentationRevision;
    const node = item.node === undefined ? undefined : this.dataSource.loadedItemById(item.node.nodeId)?.node;
    return revision >= 0 && this.dataSource.currentView()?.viewId === this.view.viewId &&
      node?.kind === 'target' && node.chapterIndex !== undefined ?
      this.chapterEntry(node.chapterIndex) : undefined;
  }

  private mangaRowAdmitted(item: ReaderDirectoryNavigationItem): boolean {
    const revision = this.rowPresentationRevision;
    if (item.node === undefined) return true; // Genuine loading slots remain visible.
    if (revision < 0 || this.dataSource.currentView()?.viewId !== this.view.viewId) return false;
    const current = this.dataSource.loadedItemById(item.node.nodeId);
    return current?.node !== undefined && !(this.mangaQuickDisplay && !this.mangaSearchActive &&
      this.dataSource.displayIndex(current.index) === undefined);
  }

  private mangaDisplayNode(node: ReaderDirectoryNavigationNode, resident: boolean = false): ReaderDirectoryNavigationNode {
    const current = resident ? node : this.currentPaintNode(node);
    return current;
  }

  private mangaTitle(node: ReaderDirectoryNavigationNode): string {
    return this.mangaDisplayProjection(this.mangaDisplayNode(node)).title;
  }

  private mangaDisplayProjection(node: ReaderDirectoryNavigationNode): MangaDirectoryDisplayProjection {
    const existing = this.mangaDisplayCache.get(node);
    if (existing !== undefined) return existing;
    const projection = mangaDirectoryDisplay(node);
    this.mangaDisplayCache.set(node, projection);
    return projection;
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
    const current = resident ? node : this.currentPaintNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterEntry(current.chapterIndex);
    return current.kind === 'target' && this.chapterDownloadEnabled && chapter !== undefined &&
      chapter.navigable !== false && chapter.downloadState !== 'unknown';
  }

  private mangaStatusText(node: ReaderDirectoryNavigationNode): string {
    const current = this.mangaDisplayNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterEntry(current.chapterIndex);
    return [this.mangaDisplayProjection(current).statusText,
      mangaDirectoryDownloadStatusText(chapter?.downloadState, this.mangaDownloadable(current))]
      .filter((text: string): boolean => text.length > 0).join(' · ');
  }

  private mangaAccessoryWidth(node: ReaderDirectoryNavigationNode, resident: boolean = false): number {
    const current = resident ? node : this.currentPaintNode(node);
    const chapter = current.chapterIndex === undefined ? undefined : this.chapterEntry(current.chapterIndex);
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
    const revision = this.rowPresentationRevision;
    const viewId = this.view.viewId;
    if (revision < 0 || this.dataSource.currentView()?.viewId !== viewId) return -1;
    // A retained row's original index can change after a fold/search/order.
    // Only the currently bound bounded page window defines the first row.
    return item.node === undefined ? item.index : this.dataSource.loadedItemById(item.node.nodeId)?.index ?? -1;
  }

  private mangaRowPaddingLeft(item: ReaderDirectoryNavigationItem): number {
    if (item.node?.kind === 'group') return MANGA_DIRECTORY_VISUAL.groupPaddingX;
    return this.mangaSearchActive || item.node === undefined || this.displayLevel(this.currentPaintNode(item.node)) <= 1 ?
      MANGA_DIRECTORY_VISUAL.namedPaddingX : MANGA_DIRECTORY_VISUAL.childPaddingLeft;
  }

  private positionRowHeight(index: number): number {
    if (!this.mangaDisplay) return this.rowHeight;
    try {
      const displayIndex = this.nativeDisplayIndex(index);
      const rect = displayIndex === undefined ? undefined : this.scroller?.getItemRect(displayIndex);
      if (rect !== undefined && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
    } catch (_error) { /* A row outside the materialized viewport uses its minimum. */ }
    const node = this.dataSource.loadedNode(index);
    if (node !== undefined && this.mangaCellPlacement({ key: node.nodeId, node, index })?.kind !== 'row') return this.mangaCellHeight() + MANGA_DIRECTORY_VISUAL.gridGap;
    return node?.kind === 'group' ? Math.max(MANGA_DIRECTORY_VISUAL.groupMinHeight,
      44 + MANGA_DIRECTORY_VISUAL.groupPaddingY * 2,
      MANGA_DIRECTORY_VISUAL.groupLineHeight * this.mangaFontScale() + MANGA_DIRECTORY_VISUAL.groupPaddingY * 2) +
      this.mangaGroupSpacing({ node, index, key: node.nodeId }) :
      Math.max(MANGA_DIRECTORY_VISUAL.namedMinHeight, MANGA_DIRECTORY_VISUAL.namedPaddingY * 2 +
        MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale() + MANGA_DIRECTORY_VISUAL.gridBorder);
  }

  private isCurrentMangaNode(item: ReaderDirectoryNavigationItem): boolean {
    const node = item.node === undefined ? undefined : this.currentPaintNode(item.node);
    return node?.kind === 'target' && this.currentChapterIndex >= 0 &&
      node.chapterIndex === this.currentChapterIndex;
  }

  private mangaColor(role: string): string {
    return mangaDirectoryColor(role, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme);
  }

  private mangaFontScale(): number {
    const revision = this.windowMetricsRevision;
    return revision >= 0 ? mangaDirectoryScale(readerWindowMetrics().systemFontScale) : 1;
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
    return Math.max(44 + MANGA_DIRECTORY_VISUAL.gridBorder * 2,
      MANGA_DIRECTORY_VISUAL.gridHeight, MANGA_DIRECTORY_VISUAL.gridPaddingY * 2 +
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
      if (Number.isFinite(offset)) this.onScrollOffset(offset + (this.nativeHeaderCount() === 1 ? 0 : this.mangaContentStartOffset()));
    } catch (_error) { /* An unattached native scroller has no geometry yet. */ }
  }

  private selectMangaRow(item: ReaderDirectoryNavigationItem): void {
    if (!this.interactionEnabled) {
      return;
    }
    const nodeId = item.node?.nodeId;
    if (nodeId === undefined || this.dataSource.currentView()?.viewId !== this.view.viewId) {
      return;
    }
    const itemNow = this.dataSource.loadedItemById(nodeId);
    if (itemNow?.node === undefined || itemNow.node.kind === 'disabled' ||
      this.mangaQuickDisplay && !this.mangaSearchActive && this.dataSource.displayIndex(itemNow.index) === undefined) {
      return;
    }
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
    const signature = JSON.stringify([this.view.viewId, this.generation, this.rowPresentationRevision,
      this.windowMetricsRevision, this.mangaContentWidth(), this.mangaFontScale(), this.mangaGridNarrow(),
      this.mangaSearchActive, this.chapterDownloadEnabled,
      resident.map((page: ReaderDirectoryLoadedPage): string => `${page.offset}:${page.nodes.length}`).sort()]);
    const samePages = resident.length === this.mangaLayoutPageRefs.size &&
      resident.every((page: ReaderDirectoryLoadedPage): boolean => this.mangaLayoutPageRefs.get(page.offset) === page.nodes);
    if (signature === this.mangaLayoutSignature && samePages) return;
    this.mangaLayoutSignature = signature;
    this.gridProjectionRevision += 1;
    this.mangaGridSpans.clear(); this.mangaLayoutByNode.clear(); this.mangaLayoutPageRefs.clear();
    for (const page of resident) this.mangaLayoutPageRefs.set(page.offset, page.nodes);
    const pages: ReaderDirectoryLoadedPage[] = this.mangaLoadedRuns(resident);
    if (this.rowPresentationRevision >= 0) for (const page of pages) {
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
    const prefix = this.nativeHeaderCount();
    const tail = Math.max(1, this.view.visibleTotal) + prefix;
    if (this.gridOptionsRevision === this.gridProjectionRevision && this.gridOptionsPrefix === prefix &&
      this.gridOptionsTail === tail) return this.gridOptions;
    this.gridOptionsRevision = this.gridProjectionRevision;
    this.gridOptionsPrefix = prefix;
    this.gridOptionsTail = tail;
    const irregularIndexes = Array.from(this.mangaGridSpans.keys()).map((index: number): number => index + prefix);
    if (prefix === 1) { irregularIndexes.unshift(0); irregularIndexes.push(tail); }
    this.gridOptions = { regularSize: [1, 1], irregularIndexes,
      onGetIrregularSizeByIndex: (index: number): [number, number] =>
        [1, prefix === 1 && (index === 0 || index === tail) ? 12 : this.mangaGridSpans.get(index - prefix) ?? 12] };
    return this.gridOptions;
  }

  @Builder
  private mangaEmptyActions(viewId: string) {
    if (this.mangaSearchActive) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text('清除搜索').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(MANGA_DIRECTORY_VISUAL.bodyFontWeight)
          .fontSize(MANGA_DIRECTORY_VISUAL.quietEmptyFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.quietEmptyLineHeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
          .constraintSize({ minHeight: Math.max(44, MANGA_DIRECTORY_VISUAL.quietEmptyClearHeight) })
          .fontColor(this.mangaColor('accent')).textAlign(TextAlign.Center).accessibilityLevel('no');
      }.padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .constraintSize({ minHeight: Math.max(44, MANGA_DIRECTORY_VISUAL.quietEmptyClearHeight) })
        .accessibilityText('清除搜索').enabled(this.interactionEnabled)
        .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme, 'nativeButton'))
        .onClick((): void => {
          if (this.mounted && this.interactionEnabled && this.mangaSearchActive &&
            viewId === this.view.viewId && this.dataSource.currentView()?.viewId === viewId) this.onClearSearch();
        });
    }
  }

  @Builder
  private mangaEmptyState() {
    if (this.emptyReadStateVisible) {
      this.emptyBuilder();
    } else {
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
  }

  private mangaQuickContextTitle(item: ReaderDirectoryNavigationItem): string {
    const revision = this.rowPresentationRevision;
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
              .fontFamily(this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_MEDIUM : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight)
              .fontWeight(this.isCurrentMangaNode(item) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight)
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
              Button({ type: ButtonType.Normal, stateEffect: false }) {
                Image(this.mangaChapter(item)?.downloadState === 'completed' ?
                ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                  $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
                ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                  $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
                .width(12).height(12).accessibilityLevel('no');
            }.width(MANGA_DIRECTORY_VISUAL.downloadGridWidth).height(this.mangaCellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2)
              .padding(0).borderRadius(0).backgroundColor(Color.Transparent).enabled(this.canDownloadTarget(this.currentPaintNode(item.node)))
              .accessibilityText(this.chapterDownloadActionsEnabled ? `管理${this.mangaTitle(item.node)}下载` :
                this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节')
      .responseRegion( readerActionTouchRegion(MANGA_DIRECTORY_VISUAL.downloadGridWidth, this.mangaCellHeight() - MANGA_DIRECTORY_VISUAL.gridBorder * 2))
      .attributeModifier(new ReaderActionAccessibility(this.chapterDownloadActionsEnabled ? `管理${this.mangaTitle(item.node)}下载` :
                this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节', this.canDownloadTarget(this.currentPaintNode(item.node)), false))
              .onClick((): void => { if (item.node !== undefined) this.downloadTarget(this.currentPaintNode(item.node)); });
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
        .backgroundColor(readerPressSurface(this.mangaColor(this.isCurrentMangaNode(item) ? 'active' : 'soft'),
          this.mangaPressScheme(), this.chapterPressKey === item.key, this.reduceMotion))
        .scale(readerPressScale(this.chapterPressKey === item.key, this.reduceMotion))
        .opacity(readerPressOpacity(this.chapterPressKey === item.key, this.reduceMotion,
          this.interactionEnabled ? 1 : MANGA_DIRECTORY_VISUAL.disabledOpacity))
        .enabled(this.interactionEnabled)
        .attributeModifier(new ReaderActionAccessibility(this.mangaRowAccessibility(item, true), this.interactionEnabled, false, true, new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.mangaPressScheme(), 'custom', true)))
        .enabled(this.interactionEnabled)
        .accessibilityText(this.mangaRowAccessibility(item, true))
      .responseRegion( readerActionTouchRegion(this.mangaCellWidth(item), this.mangaCellHeight()))
        .onTouch((event: TouchEvent): void => this.observeChapterPress(event, item.key, this.interactionEnabled))
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
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_down_theme_night') : $r('app.media.manga_sheet_chevron_down'))
            .width(MANGA_DIRECTORY_VISUAL.groupIconSize).height(MANGA_DIRECTORY_VISUAL.groupIconSize)
            .rotate({ angle: this.reduceMotion || this.mangaGroupNode(item.node).expanded ? 0 : -90 })
            .animation(readerMotionAnimateParam('manga.directory.fold', this.reduceMotion)).accessibilityLevel('no');
        }.width(44).height(44).padding(0).borderRadius(0).backgroundColor(Color.Transparent).margin({ left: 8, right: 8 })
          .enabled(this.interactionEnabled && !this.mangaSearchActive)
          .attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled && !this.mangaSearchActive, true, this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme, 'nativeButton'))
          .accessibilityText(`${this.currentPaintNode(item.node).title}，展开或收起子目录`)
      .responseRegion( readerActionTouchRegion(44, 44))
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
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.groupFontSize).lineHeight(MANGA_DIRECTORY_VISUAL.groupLineHeight)
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
              // The static UI Medium face supplies the current-title outlines.
              // Its explicit 500 weight stays aligned with the checked native face.
              .fontFamily(this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_MEDIUM : READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontSize(MANGA_DIRECTORY_VISUAL.namedFontSize)
              .lineHeight(MANGA_DIRECTORY_VISUAL.namedLineHeight)
              .fontWeight(this.isCurrentMangaNode(item) ? MANGA_DIRECTORY_VISUAL.currentFontWeight : MANGA_DIRECTORY_VISUAL.bodyFontWeight)
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
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Image(this.mangaChapter(item)?.downloadState === 'completed' ?
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
              ((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
                $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
              .width(15).height(15).accessibilityLevel('no');
          }.width(44).height(Math.max(44, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale()))
            .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
            .accessibilityText(this.chapterDownloadActionsEnabled ? '管理本章下载' :
              this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节')
            .enabled(this.canDownloadTarget(this.currentPaintNode(item.node)))
      .responseRegion( readerActionTouchRegion(44, Math.max(44, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale())))
      .attributeModifier(new ReaderActionAccessibility(this.chapterDownloadActionsEnabled ? '管理本章下载' :
              this.mangaChapter(item)?.downloadState === 'completed' ? '已下载' : '下载章节', this.canDownloadTarget(this.currentPaintNode(item.node)), false, true,
              new ReaderPressFeedback(Color.Transparent, this.mangaPressScheme(), 0, 0,
                this.canDownloadTarget(this.currentPaintNode(item.node)),
                this.chapterPressKey === `manga-dl:${item.key}`, false), 'nativeButton'))
            .onTouch((event: TouchEvent): void => {
              this.observeChapterPress(event, `manga-dl:${item.key}`,
                item.node !== undefined && this.canDownloadTarget(this.currentPaintNode(item.node)));
            })
            .onClick((): void => { if (item.node !== undefined) this.downloadTarget(this.currentPaintNode(item.node)); });
          }.width(44).height(Math.max(44, MANGA_DIRECTORY_VISUAL.namedLineHeight * this.mangaFontScale()))
            .focusable(false).accessibilityLevel('no').onClick((): void => {});
        }
        if (item.node.kind === 'group' && this.mangaGroupNode(item.node).hasChildren && !this.mangaQuickDisplay) {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image((this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme) === 'night' ?
            $r('app.media.manga_sheet_chevron_down_theme_night') : $r('app.media.manga_sheet_chevron_down'))
            .width(16).height(16).rotate({ angle: this.reduceMotion || this.mangaGroupNode(item.node).expanded ? 0 : -90 })
            .animation(readerMotionAnimateParam('manga.directory.fold', this.reduceMotion)).accessibilityLevel('no');
          }.width(44).height(44).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
            .accessibilityText(`${this.mangaGroupNode(item.node).expanded ? '折叠' : '展开'}${this.mangaGroupNode(item.node).title}子目录`)
            .responseRegion(readerActionTouchRegion(44, 44))
            .attributeModifier(new ReaderActionAccessibility(`${this.mangaGroupNode(item.node).expanded ? '折叠' : '展开'}${this.mangaGroupNode(item.node).title}子目录`, this.interactionEnabled && !this.mangaSearchActive, false, true,
              new ReaderPressFeedback(Color.Transparent, this.mangaPressScheme(), 0, 0,
                this.interactionEnabled && !this.mangaSearchActive,
                this.chapterPressKey === `manga-fold:${item.key}`, false), 'nativeButton'))
            .onTouch((event: TouchEvent): void => {
              this.observeChapterPress(event, `manga-fold:${item.key}`, this.interactionEnabled && !this.mangaSearchActive);
            })
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
      .backgroundColor(readerPressSurface(item.node?.kind === 'target' && this.isCurrentMangaNode(item) ?
        this.mangaColor('active') : item.node?.kind === 'group' ? this.mangaColor('soft') : Color.Transparent,
        this.mangaPressScheme(), this.chapterPressKey === item.key, this.reduceMotion))
      .visibility(this.mangaRowAdmitted(item) ? Visibility.Visible : Visibility.Hidden)
      .scale(readerPressScale(this.chapterPressKey === item.key, this.reduceMotion))
      .opacity(readerPressOpacity(this.chapterPressKey === item.key, this.reduceMotion,
        item.node?.kind === 'disabled' || !this.interactionEnabled ? MANGA_DIRECTORY_VISUAL.disabledOpacity : 1))

      .enabled(this.interactionEnabled && item.node?.kind !== 'disabled' && !(item.node?.kind === 'group' && this.mangaSearchActive))
      .attributeModifier(new ReaderActionAccessibility(this.mangaRowAccessibility(item, false), this.interactionEnabled && item.node?.kind !== 'disabled' && !(item.node?.kind === 'group' && this.mangaSearchActive), false, true, new MangaDirectoryPressFeedback(this.interactionEnabled && item.node?.kind !== 'disabled' &&
        (item.node?.kind !== 'group' || !this.mangaSearchActive),
        item.node?.kind !== 'group' || this.interactionEnabled && !this.mangaSearchActive,
        this.mangaPressScheme(), 'custom', true)))
      .accessibilityText(this.mangaRowAccessibility(item, false))
      .responseRegion( readerActionTouchRegion('100%', '100%'))
      .onTouch((event: TouchEvent): void => this.observeChapterPress(event, item.key, this.interactionEnabled &&
        item.node?.kind !== 'disabled' && !(item.node?.kind === 'group' && this.mangaSearchActive)))
      .onClick((): void => this.selectMangaRow(item));
  }

  private textRowAccessibility(node: ReaderDirectoryNavigationNode): string {
    if (node.kind === 'disabled') return `${node.title}，目标不可用`;
    if (node.kind === 'group') {
      return `${node.nodeId === this.view.currentAncestorNodeId ? '当前章在此组，' : ''}第${this.displayLevel(node)}级分组：${node.title}，${node.expanded ? '已展开' : '已折叠'}`;
    }
    return `${node.nodeId === this.view.currentAncestorNodeId ? '当前章在此标题下，' : ''}第${this.displayLevel(node)}级，打开${node.title}`;
  }

  private clearChapterPress(): void {
    this.chapterDelayedPress.cancel();
  }

  private observeChapterPress(event: TouchEvent, key: string, enabled: boolean): void {
    this.chapterDelayedPress.observe(event, key, this.mounted && enabled);
  }

  private mangaPressScheme(): string {
    return this.mangaScheme === 'theme-dark' ? 'night' : this.mangaScheme.length > 0 ? this.mangaScheme : this.appThemeScheme;
  }

  private verificationChapterSelectionId(node: ReaderDirectoryNavigationNode, active: boolean): string {
    const chapter = node.chapterIndex;
    return this.verificationChapterActions && node.kind === 'target' && chapter !== undefined && chapter >= 0 && !active &&
      chapter !== this.currentChapterIndex ? `reader-control-directory-chapter:${chapter}` : '';
  }

  @Builder
  private row(item: ReaderDirectoryNavigationItem) {
    if (item.node === undefined) {
      Row() {
        Text('…').fontFamily(TYPE_APP_INHERITED_HINT.fontFamily).fontWeight(TYPE_APP_INHERITED_HINT.fontWeight)
          .fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      }.width('100%').height(this.rowHeight);
    } else {
      this.textChapterRow(this.currentPaintNode(item.node), this.isCurrentNode(item), this.view.viewId);
    }
  }

  @Builder
  private textChapterRow(node: ReaderDirectoryNavigationNode, active: boolean, viewId: string) {
    Row() {
      if (active) {
        Row().width(3).height(this.rowHeight).borderRadius(1.5)
          .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
      }
      ReaderDirectoryTreeTitle({
        title: node.title, label: this.textRowAccessibility(node),
        focusId: this.verificationChapterSelectionId(node, active), rowHeight: this.rowHeight,
        leftPadding: 9 + Math.min(3, this.displayLevel(node) - 1) * 12, titleMaxLines: this.titleMaxLines,
        scheme: this.appThemeScheme, inputEnabled: this.interactionEnabled && node.kind !== 'disabled', dimmed: node.kind === 'disabled',
        viewId: viewId,
        activate: (): void => {
          if (this.view.viewId !== viewId) return;
          const current = this.dataSource.loadedItemById(node.nodeId)?.node;
          if (current === undefined) return;
          if (current.kind === 'group') this.toggleNode(current);
          else this.selectTarget(current);
        },
      });
      if (node.hasChildren) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(16).height(16).rotate({ angle: node.expanded ? 90 : 0 })
            .fillColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).accessibilityLevel('no');
        }.width(44).height(this.rowHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .accessibilityText(`${node.expanded ? '折叠' : '展开'}${node.title}子目录`)
          .responseRegion(readerActionTouchRegion(44, '100%'))
          .attributeModifier(new ReaderActionAccessibility(`${node.expanded ? '折叠' : '展开'}${node.title}子目录`,
            this.interactionEnabled, false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 0, this.interactionEnabled,
              this.chapterPressKey === `text-fold:${node.nodeId}`, false), 'nativeButton'))
          .onTouch((event: TouchEvent): void => {
            this.observeChapterPress(event, `text-fold:${node.nodeId}`, this.interactionEnabled);
          })
          .onClick((): void => {
            if (this.view.viewId !== viewId) return;
            const current = this.dataSource.loadedItemById(node.nodeId)?.node;
            if (current !== undefined) this.toggleNode(current);
          });
      }
      if (node.kind === 'target' && node.chapterIndex !== undefined) {
        this.textChapterAccessories(node, this.chapterEntry(node.chapterIndex), viewId);
      }
    }.width('100%').height(this.rowHeight).borderRadius(6)
      .backgroundColor(active ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
  }

  private downloadLabel(entry: LocalReadingTocEntry): string {
    if (this.chapterDownloadActionsEnabled) return '管理本章下载';
    return entry.downloadState === 'completed' ? '已下载' : '下载章节';
  }

  private bookmarkLabel(entry: LocalReadingTocEntry): string {
    return (entry.bookmarks?.length ?? 0) > 0 ? '删除本章已有书签' : '添加本章章首书签';
  }

  @Builder
  private textChapterAccessories(node: ReaderDirectoryNavigationNode, entry: LocalReadingTocEntry | undefined, viewId: string) {
    if (entry !== undefined && this.chapterDownloadEnabled && entry.navigable !== false && entry.downloadState !== 'unknown') {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image(entry.downloadState === 'completed' ?
          (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
          (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
          .width(15).height(15).accessibilityLevel('no');
      }.width(44).height(this.rowHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .accessibilityText(this.downloadLabel(entry)).enabled(this.canDownloadTarget(node, entry))
        .responseRegion(readerActionTouchRegion(44, '100%'))
        .attributeModifier(new ReaderActionAccessibility(this.downloadLabel(entry), this.canDownloadTarget(node, entry), false, true,
          new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 0, this.canDownloadTarget(node, entry),
            this.chapterPressKey === `text-dl:${node.nodeId}`, false), 'nativeButton'))
        .onTouch((event: TouchEvent): void => {
          this.observeChapterPress(event, `text-dl:${node.nodeId}`, this.canDownloadTarget(node, entry));
        })
        .onClick((): void => {
          if (this.view.viewId !== viewId) return;
          const current = this.dataSource.loadedItemById(node.nodeId)?.node;
          if (current !== undefined) this.downloadTarget(current);
        });
    }
    if (entry !== undefined && entry.bookmarks !== undefined) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Image((entry.bookmarks?.length ?? 0) > 0 ?
          (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
          (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
          .width(15).height(15).accessibilityLevel('no');
      }.width(44).height(this.rowHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .accessibilityText(this.bookmarkLabel(entry)).enabled(this.bookmarkActionEnabled(entry))
        .responseRegion(readerActionTouchRegion(44, '100%'))
        .attributeModifier(new ReaderActionAccessibility(this.bookmarkLabel(entry), this.bookmarkActionEnabled(entry), false, true,
          new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 0, this.bookmarkActionEnabled(entry),
            this.chapterPressKey === `text-bm:${node.nodeId}`, false), 'nativeButton'))
        .onTouch((event: TouchEvent): void => {
          this.observeChapterPress(event, `text-bm:${node.nodeId}`, this.bookmarkActionEnabled(entry));
        })
        .onClick((): void => {
          if (this.view.viewId !== viewId) return;
          const currentNode = this.dataSource.loadedItemById(node.nodeId)?.node;
          const current = currentNode?.chapterIndex === undefined ? undefined : this.chapterEntry(currentNode.chapterIndex);
          if (current !== undefined) this.marker(current);
        });
    }
  }

  build() {
    if (this.mangaDisplay) {
      Grid(this.scroller, this.mangaGridLayoutOptions()) {
        if (this.nativeHeaderCount() === 1) {
          GridItem() { this.prefixBuilder(); }.width('100%').height(Math.max(0, this.prefixHeight));
        }
        if (this.view.visibleTotal === 0) {
          GridItem() { this.mangaEmptyState(); }.width('100%');
        }
        LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
          GridItem() {
            if (this.mangaCellPlacement(item) !== undefined && this.mangaCellPlacement(item)?.kind !== 'row') this.mangaNumberCell(item);
            else this.mangaRow(item);
          }.width('100%');
        }, (item: ReaderDirectoryNavigationItem): string => this.rowKey(item));
        if (this.nativeHeaderCount() === 1) {
          GridItem() { this.mangaTailBuilder(); }.width('100%')
            .padding({ bottom: this.mangaContentEndOffset() });
        }
      }.columnsTemplate('1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr')
        .columnsGap(0).rowsGap(0).width('100%').height('100%')
        .padding({ left: this.listPaddingX, right: this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX,
          top: 0, bottom: 0 })
        .contentStartOffset(this.nativeHeaderCount() === 1 ? 0 : this.mangaContentStartOffset())
        .contentEndOffset(this.nativeHeaderCount() === 1 ? 0 : this.mangaContentEndOffset())
        .scrollBar(BarState.Auto).scrollBarWidth(MANGA_DIRECTORY_VISUAL.scrollbarWidth).scrollBarColor(this.mangaColor('scrollbar')).edgeEffect(this.edgeEffectMode)
        .enableScrollInteraction(this.interactionEnabled).cachedCount(4)
        .onWillStartDragging((): void => {
          this.clearChapterPress();
          this.mangaDragging = true;
          this.initialPositionPending = false;
          this.positionPlan = undefined;
          this.onUserScrollIntent();
        })
        .onScrollStart((): void => this.clearChapterPress())
        .onScrollIndex((start: number, _end: number): void => {
          this.observeViewport(start, _end);
          if (!this.initialPositionPending) this.captureViewportAnchor();
        })
        .onDidScroll((): void => this.publishMangaScrollOffset())
        .onScrollStop((): void => { this.publishMangaScrollOffset(); this.settleMangaScroll(); })
        .onAreaChange((_oldArea: Area, newArea: Area): void => {
          const width = Number(newArea.width);
          const height = Number(newArea.height);
          if (Number.isFinite(width) && width > 0 && this.mangaViewportWidth !== width) this.mangaViewportWidth = width;
          if (Number.isFinite(height) && height > 0) this.mangaViewportHeight = height;
          if (!this.layoutReady && height > 0) {
            this.layoutReady = true;
            this.onFirstLayout();
            this.positionInitialCurrent();
          }
        });
    } else {
      List({ space: 0, scroller: this.scroller }) {
      if (this.nativeHeaderCount() === 1) {
        ListItem() { this.prefixBuilder(); }.width('100%').constraintSize({ minHeight: Math.max(0, this.prefixHeight) });
      }
      if (this.view.visibleTotal === 0 && (this.nativeHeaderCount() === 1 || this.tailHeight > 0)) {
        ListItem() { this.emptyBuilder(); }.width('100%').constraintSize({ minHeight: 44 });
      }
      LazyForEach(this.dataSource, (item: ReaderDirectoryNavigationItem) => {
        ListItem() {
          if (this.mangaDisplay) this.mangaRow(item);
          else this.row(item);
        }.width('100%').height(this.mangaDisplay ? undefined : this.rowHeight);
      }, (item: ReaderDirectoryNavigationItem): string => this.rowKey(item));
      if (this.tailHeight > 0) {
        ListItem() { this.tailBuilder(); }.width('100%').constraintSize({ minHeight: this.tailHeight });
      }
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
      this.clearChapterPress();
      if (this.prefixEverMounted && !this.mounted) return;
      this.prefixLayoutGeneration += 1;
      this.prefixChangePending = false;
      this.prefixRevealActive = false;
      this.initialPositionPending = false;
      this.positionPlan = undefined;
      this.onUserScrollIntent();
    })
    .onScrollStart((): void => this.clearChapterPress())
    .onScrollIndex((start: number, _end: number, _center: number): void => {
      if (this.prefixEverMounted && !this.mounted) return;
      this.observeViewport(start, _end);
      if (!this.initialPositionPending) this.captureViewportAnchor();
    })
    .onDidScroll((): void => this.publishMangaScrollOffset())
    .onScrollStop((): void => { if (this.prefixEverMounted && !this.mounted) return; this.publishMangaScrollOffset(); this.captureViewportAnchor(); this.onScrollSettled(); })
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      if (this.prefixEverMounted && !this.mounted) return;
      if (Number(newArea.height) > 0 && (!this.layoutReady || this.nativeHeaderCount() === 1)) {
        this.layoutReady = true;
        this.onFirstLayout();
        this.positionInitialCurrent();
      }
      });
    }
  }
}
