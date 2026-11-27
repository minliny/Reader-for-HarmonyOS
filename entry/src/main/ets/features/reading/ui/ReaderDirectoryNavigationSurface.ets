import { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderDirectoryTrace } from './ReaderDirectoryTrace';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderScrollLayout } from '../../../ui/layout/ReaderScrollLayout';
import { prepareMangaSheetFonts } from '../../../ui/foundation/ReaderFonts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderDirectoryNavigationGateway, type ReaderDirectoryNavigationPort, type ReaderDirectoryNavigationPortFactory, readerDirectoryScopeKey,
  backfillRetainedReaderDirectoryNavigation, isReaderDirectoryViewStale, readerDirectoryNoteMissingNavigation,
  type ReaderDirectoryBackfillResult, type ReaderDirectoryNavigationNode, type ReaderDirectoryNavigationReady,
  type ReaderDirectoryNavigationPreparedPage } from '../application/ReaderDirectoryNavigation';
import { openReaderDirectoryNavigation, readerDirectoryToggleCollapsed } from '../presentation/ReaderDirectoryNavigationSession';
import { ReaderDirectoryLocalPreparation } from '../application/ReaderDirectoryBackfill';
import { ReaderDirectoryNavigationList, cacheReaderDirectoryNavigationPage } from './ReaderDirectoryNavigationList';
import { readerHarmonyApi24 } from '../../../app/HarmonyCapabilityProbe';
import { readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor } from '../presentation/ReaderDirectoryViewport';
import { projectReaderDirectoryEntries } from '../presentation/ReaderDirectoryProjection';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';

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
  inputCurrent: (() => boolean) | undefined = undefined;
  chapterInputCurrent: ((chapter: LocalReadingTocEntry) => boolean) | undefined = undefined;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onIdentityChanged') sourceId: string = 'local';
  @Prop @Watch('onViewInputsChanged') query: string = '';
  @Prop @Watch('onViewInputsChanged') ascending: boolean = true;
  @Prop @Watch('onViewInputsChanged') currentChapterIndex: number = -1;
  @Prop @Watch('onLocateCurrent') locateCurrentRevision: number = 0;
  @Prop @Watch('onIdentityChanged') openRevision: string = '';
  @Prop @Watch('onRefreshRevisionChanged') refreshRevision: number = 0;
  @Prop prepareLocalTxt: boolean = false;
  @Prop interacted: boolean = false;
  @Prop rowHeight: number = 44;
  @Prop mangaDisplay: boolean = false;
  @Prop mangaFullCatalog: boolean = false;
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
  @Prop scrollLayout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'contentOffset');
  @Prop listPaddingTop: number = -1;
  @Prop listPaddingBottom: number = -1;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  @Prop @Watch('onInteractionChanged') interactionEnabled: boolean = true;
  chapterEntries: LocalReadingTocEntry[] = [];
  directoryPublication: ReaderDirectoryDataPublication | undefined = undefined;
  @Prop directoryEntriesRevision: number = 0;
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.directoryPublication?.entriesAt(this.directoryEntriesRevision) ?? this.chapterEntries;
  }
  @Prop showLoadStatus: boolean = true;
  @Prop chapterDownloadEnabled: boolean = false;
  /** Manga uses existing markers to manage active/retained downloads. */
  @Prop chapterDownloadActionsEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop bookmarkActionsEnabled: boolean = true;
  /** Optional native-only prefix used by the constrained text control host. */
  @Prop headerCount: number = 0;
  @Prop prefixHeight: number = 0;
  @Prop tailHeight: number = 0;
  @Prop prefixIdentity: string = '';
  @Prop prefixRevealRevision: number = 0;
  @Prop verificationChapterActions: boolean = false;
  @BuilderParam prefixBuilder: () => void = this.emptyPrefix;
  @BuilderParam mangaTailBuilder: () => void = this.emptyPrefix;
  @BuilderParam tailBuilder: () => void = this.emptyPrefix;
  scroller: Scroller | undefined = undefined;
  onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onObservedScrollSettled: (() => void) | undefined = undefined;
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
  @State private awaitingRulesRefresh: boolean = false;
  @State private mangaFontsReady: boolean = false;
  private mangaFontGeneration: number = 0;
  private mangaFontTask: Promise<boolean> | undefined = undefined;
  /** Optional dependency only; absent callers keep the production Gateway. */
  navigationPortFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
  private gateway: ReaderDirectoryNavigationPort | undefined = undefined;
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
  private inputOwnerKey: string = '';
  private openedInputKey: string = '';
  private locateCurrentPending: boolean = false;
  private locateExpectsQueryClear: boolean = false;
  private acceptedCatalogFilter: string | undefined = undefined;
  private scrollIntentUnsubscribe: (() => void) | undefined = undefined;
  private readonly localPreparation: ReaderDirectoryLocalPreparation = new ReaderDirectoryLocalPreparation();
  private staleRetryInput: string = '';
  private neighborPages: number[] = [];

  aboutToAppear(): void {
    this.mounted = true;
    this.inputOwnerKey = this.currentInputOwnerKey();
    if (this.mangaDisplay) {
      void this.prepareMangaFonts();
    }
    this.scrollIntentUnsubscribe = readerDirectoryObserveScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId),
      (): void => this.onProgrammaticScrollIntent());
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    if (this.navigationPortFactory !== undefined) {
      this.runtimeOwner = undefined;
      this.gateway = this.navigationPortFactory();
    } else {
      this.runtimeOwner = ReaderRuntimeOwner.current();
      this.gateway = new ReaderDirectoryNavigationGateway(this.runtimeOwner);
    }
    this.openTree(true);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.inputOwnerKey = '';
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
    this.inputOwnerKey = this.currentInputOwnerKey();
    this.feedback.reset();
    this.cancelQueryTimer();
    this.locateCurrentPending = false;
    this.locateExpectsQueryClear = false;
    this.generation += 1;
    this.openingGeneration = -1;
    this.view = undefined;
    this.acceptedCatalogFilter = undefined;
    this.loadPending = false;
    this.loadFailed = false;
    this.awaitingRulesRefresh = false;
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
    const generation = this.generation, sourceId = this.sourceId, bookId = this.bookId;
    this.getUIContext().postFrameCallback(new ReaderDirectoryTraceFrame((): void => {
      if (this.mounted && generation === this.generation && sourceId === this.sourceId && bookId === this.bookId &&
        this.view === undefined) this.onTreeStateChange(false);
    }));
  }

  private onRefreshRevisionChanged(): void {
    if (!this.mounted) return;
    this.awaitingRulesRefresh = true;
    this.settledFlat = false;
    this.cancelQueryTimer();
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.openTree(false, 'rules-refresh');
  }

  private onViewInputsChanged(): void {
    if (!this.mounted) return;
    const queryChanged = this.query !== this.lastQuery;
    const otherChanged = this.ascending !== this.lastAscending || this.currentChapterIndex !== this.lastChapterIndex;
    this.lastQuery = this.query;
    this.lastAscending = this.ascending;
    this.lastChapterIndex = this.currentChapterIndex;
    if (this.settledFlat || !queryChanged && !otherChanged) return;
    // The parent clears the query and increments the locate revision together.
    // Either Watch can arrive first. A clear following the locate already uses
    // the unfiltered query and must preserve its generation.
    if (queryChanged) {
      const pairedClear = this.locateExpectsQueryClear && this.query.trim().length === 0;
      this.locateExpectsQueryClear = false;
      if (pairedClear && !otherChanged) return;
      if (this.query.trim().length > 0) this.locateCurrentPending = false;
    }
    this.cancelQueryTimer();
    // Cancel an in-flight view before the debounce, so an old query cannot
    // publish while the user is still editing the search.
    this.generation += 1;
    if (!this.interactionEnabled) {
      this.pendingRefresh = true;
      this.pendingQueryRefresh = queryChanged && !otherChanged;
      return;
    }
    if (this.locateCurrentPending) this.openTree(false, 'locate-current');
    else if (queryChanged && !otherChanged) this.scheduleQueryOpen();
    else this.openTree(this.view === undefined, 'sort-or-position');
  }

  private onLocateCurrent(): void {
    if (!this.mounted || this.currentChapterIndex < 0) return;
    this.cancelQueryTimer();
    this.locateCurrentPending = true;
    this.locateExpectsQueryClear = this.query.trim().length > 0;
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
    if (this.mounted) this.onObservedScrollSettled?.();
    if (!this.mounted || this.settledFlat || !this.interactionEnabled || !this.pendingRefresh) return;
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.openTree(this.view === undefined);
  }

  private async prepareVisiblePages(gateway: ReaderDirectoryNavigationPort, bookId: string,
    ready: ReaderDirectoryNavigationReady, generation: number): Promise<ReaderDirectoryNavigationPreparedPage[]> {
    const pageSize = 256;
    if (ready.nodes.length !== Math.min(pageSize, ready.visibleTotal))
      throw new Error('directory first page is incomplete');
    if (ready.visibleTotal === 0) return [];
    cacheReaderDirectoryNavigationPage(ready, 0, { viewId: ready.viewId, visibleTotal: ready.visibleTotal, nodes: ready.nodes, nextOffset: ready.nextOffset });
    ready.nodes = [];
    const anchor = ready.locateCurrent || ready.startAtCatalogTop ? undefined :
      readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId));
    const sameRevision = anchor?.navigationRevision === ready.navigationRevision;
    const anchorIndex = sameRevision ?
      ready.anchorVisibleIndex ?? (anchor?.viewId === ready.viewId ? anchor?.visibleIndex : undefined) : undefined;
    const target = ready.startAtCatalogTop ? 0 : (anchorIndex ?? ready.currentVisibleIndex ?? 0);
    const offset = Math.floor(target / pageSize) * pageSize;
    this.neighborPages = [offset - pageSize, offset + pageSize]
      .filter((candidate: number): boolean => candidate > 0 && candidate < ready.visibleTotal);
    if (offset === 0) return [];
    const isCurrent = (): boolean => this.mounted && generation === this.generation && this.bookId === bookId;
    const page = await gateway.page(bookId, ready.viewId, offset, isCurrent);
    if (!isCurrent() || page.viewId !== ready.viewId || page.visibleTotal !== ready.visibleTotal ||
      page.nodes.length !== Math.min(pageSize, ready.visibleTotal - offset))
      throw new Error('directory prepared page is stale or incomplete');
    return [{ offset, page: cacheReaderDirectoryNavigationPage(ready, offset, page) }];
  }

  private openTree(first: boolean, reason: string = 'open', pendingTrace?: ReaderDirectoryTrace,
    automaticRetry: boolean = false): void {
    const gateway = this.gateway;
    const bookId = this.bookId;
    const sourceId = this.sourceId;
    if (gateway === undefined || bookId.length === 0) return;
    this.openedInputKey = this.currentReadInputKey();
    if (!automaticRetry) this.staleRetryInput = '';
    this.neighborPages = [];
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
    const explicitLocateCurrent = this.locateCurrentPending;
    const query = explicitLocateCurrent ? '' : this.query, descending = !this.ascending;
    const catalogFilter = this.mangaFullCatalog ? JSON.stringify([query.trim(), descending]) : undefined;
    // Full opens with the actual search rail and the first chapter. A Quick
    // viewport anchor describes a different list and must not hide this rail.
    const startAtCatalogTop = catalogFilter !== undefined && !explicitLocateCurrent &&
      (this.acceptedCatalogFilter === undefined ||
        (this.headerCount === 0 && catalogFilter !== this.acceptedCatalogFilter));
    // A fresh Quick opening starts at the current chapter, even when Full left
    // a different browsing anchor. Paging still prepares only its bounded window.
    const locateCurrent = explicitLocateCurrent || first && this.mangaDisplay && this.mangaQuickDisplay &&
      query.trim().length === 0 && this.currentChapterIndex >= 0;
    const anchorNodeId = locateCurrent || startAtCatalogTop ? undefined :
      readerDirectoryViewportAnchor(readerDirectoryScopeKey(this.sourceId, bookId))?.nodeId;
    const chapterIndex = this.currentChapterIndex >= 0 ? this.currentChapterIndex : undefined;
    const runtimeOwner = this.runtimeOwner;
    const displayEpoch = this.openRevision;
    let unavailableReason = '';
    let backfill: Promise<ReaderDirectoryBackfillResult> | undefined;
    const current = (): boolean => this.mounted && generation === this.generation &&
      this.bookId === bookId && this.sourceId === sourceId;
    const open = (allowBackfill: boolean): Promise<ReaderDirectoryNavigationReady | undefined> => openReaderDirectoryNavigation(gateway,
      { sourceId, bookId, query, descending, chapterIndex, anchorNodeId, limit: 256, locateCurrent,
        collapsedNodeIds: this.mangaDisplay && this.mangaQuickDisplay && query.trim().length === 0 ? [] : undefined },
      current, (failure: string): void => {
        unavailableReason = failure;
        if (!allowBackfill || sourceId !== 'local' || failure !== 'navigationMissingOrStale') return;
        // The standalone catalog can be opened before the book ever reaches a
        // readable frame. Only its explicit TXT open may prepare from stored text.
        if (this.prepareLocalTxt && runtimeOwner !== undefined) {
          backfill = this.localPreparation.run(bookId, displayEpoch,
            (): Promise<ReaderDirectoryBackfillResult> => backfillRetainedReaderDirectoryNavigation(runtimeOwner, bookId,
              (): boolean => this.mounted && this.bookId === bookId && this.sourceId === sourceId &&
                this.openRevision === displayEpoch && ReaderRuntimeOwner.isCurrent(runtimeOwner), 'txt'));
        } else {
          backfill = readerDirectoryNoteMissingNavigation(bookId, failure, reason === 'retry');
        }
      });
    const prepare = async (): Promise<ReaderDirectoryNavigationReady | undefined> => {
      const ready = await open(true);
      if (ready !== undefined || backfill === undefined || !current()) return ready;
      const result = await backfill;
      if (!current()) return undefined;
      if (result.status === 'ready') return open(false);
      if (result.reason === 'NoStructure') unavailableReason = 'NoStructure';
      return undefined;
    };
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
      return prepare();
    }) : prepare();
    void opening
      .then(async (ready: ReaderDirectoryNavigationReady | undefined): Promise<void> => {
        trace.step('response', ready === undefined ? 'unavailable' : 'ready');
        if (!this.mounted || generation !== this.generation || this.bookId !== bookId || this.sourceId !== sourceId) return;
        if (ready === undefined) {
          this.openingGeneration = -1;
          this.loadPending = false;
          // A confirmed flat catalog can use its existing chapters. Other
          // unavailable results remain recoverable from the same opening.
          this.settledFlat = unavailableReason === 'unsupported' ||
            (unavailableReason === 'NoStructure' && this.currentDirectoryEntries().length > 0);
          this.loadFailed = !this.settledFlat;
          if (this.settledFlat) {
            this.locateCurrentPending = false;
            if (this.awaitingRulesRefresh || explicitLocateCurrent && this.view !== undefined) {
              this.view = undefined;
              this.awaitingRulesRefresh = false;
              this.onTreeStateChange(false);
            }
          }
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
        if (this.mangaFullCatalog) ready.startAtCatalogTop = startAtCatalogTop;
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
          ready.currentDisplayCentered = explicitLocateCurrent && this.mangaFullCatalog;
        }
        this.acceptedCatalogFilter = catalogFilter;
        this.view = ready;
        this.loadFailed = false;
        this.awaitingRulesRefresh = false;
        this.locateCurrentPending = false;
        this.onTreeStateChange(true);
        trace.step('published');
        const neighborPages = this.neighborPages;
        if (trace.isEnabled() || neighborPages.length > 0) try {
          this.getUIContext().postFrameCallback(new ReaderDirectoryTraceFrame((): void => {
            trace.step('frame-callback', this.mounted && generation === this.generation && this.view?.viewId === ready.viewId
              ? 'ready' : 'stale');
            if (!current() || this.view?.viewId !== ready.viewId) return;
            for (const offset of neighborPages) {
              void gateway.page(bookId, ready.viewId, offset, current).then((page): void => {
                if (current() && this.view?.viewId === ready.viewId && page.viewId === ready.viewId &&
                  page.visibleTotal === ready.visibleTotal && page.nodes.length === Math.min(256, ready.visibleTotal - offset))
                  cacheReaderDirectoryNavigationPage(ready, offset, page);
              }).catch((): void => { /* Actual viewport admission owns retry and stale recovery. */ });
            }
          }));
        } catch (_error) { trace.step('frame-callback', 'unavailable'); }
      }).catch((_error: Error): void => {
        const current = this.mounted && generation === this.generation && this.bookId === bookId && this.sourceId === sourceId;
        trace.step('response', current ? 'failed' : 'cancelled');
        if (!current) return;
        if (isReaderDirectoryViewStale(_error) && this.reopenStale(first)) return;
        this.openingGeneration = -1;
        this.loadPending = false;
        this.loadFailed = true;
        this.notifyReadFailure(generation, sourceId, bookId);
      });
  }

  private hasRetainedContent(): boolean {
    if (this.view !== undefined) return this.view.visibleTotal > 0;
    if (this.query.length === 0) return this.currentDirectoryEntries().length > 0;
    return projectReaderDirectoryEntries(this.currentDirectoryEntries(), this.query, true, this.mangaDisplay).length > 0;
  }

  private notifyReadFailure(generation: number, sourceId: string, bookId: string): void {
    this.feedback.show(() => this.getUIContext(), {
      message: '目录刷新失败，已保留当前条目，可重试加载目录', key: `${sourceId}\u0000${bookId}\u0000directory-read-failed`,
    }, (): boolean => this.mounted && this.interactionEnabled && this.showLoadStatus && this.loadFailed &&
      generation === this.generation && sourceId === this.sourceId && bookId === this.bookId &&
      this.runtimeOwner !== undefined && ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && this.hasRetainedContent());
  }

  private retryOpen(): void {
    if (!this.recoveryInputCurrent(this.generation) || this.loadPending) return;
    this.cancelQueryTimer();
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    this.settledFlat = false;
    this.openTree(false, 'retry');
  }

  private toggle(node: ReaderDirectoryNavigationNode): void {
    const view = this.view;
    if (!this.directoryInputCurrent() || view === undefined || !node.hasChildren) return;
    this.cancelQueryTimer();
    this.pendingRefresh = false;
    this.pendingQueryRefresh = false;
    readerDirectoryToggleCollapsed(readerDirectoryScopeKey(this.sourceId, this.bookId), view.navigationRevision, node.nodeId);
    this.openTree(false, 'fold');
  }

  private reopenStale(first: boolean): boolean {
    const key = this.currentReadInputKey();
    if (this.staleRetryInput === key) return false;
    this.staleRetryInput = key;
    this.cancelQueryTimer();
    this.openTree(first, 'stale-view', undefined, true);
    return true;
  }

  private invalidate(stale: boolean = false): void {
    if (stale && this.reopenStale(false)) return;
    this.cancelQueryTimer();
    this.generation += 1;
    this.openingGeneration = -1;
    this.loadPending = false;
    this.loadFailed = true;
    this.settledFlat = false;
    this.notifyReadFailure(this.generation, this.sourceId, this.bookId);
  }

  @Builder
  private emptyPrefix() {}

  private hasPrefix(): boolean { return !this.mangaDisplay && this.headerCount === 1; }

  private titleMaxLines(): number { return !this.mangaDisplay && readerHarmonyApi24() ? 2 : 1; }

  private resolvedRowHeight(): number {
    if (this.mangaDisplay) return this.rowHeight;
    // The owner already adds the extra height for a single scaled line. A
    // second title line needs the same font growth above its normal row.
    const extraLineHeight = Math.max(0, this.rowHeight - 44);
    if (this.titleMaxLines() === 2) return 56 + 2 * extraLineHeight;
    return extraLineHeight > 0 ? this.rowHeight : 40;
  }

  private currentInputOwnerKey(): string {
    return JSON.stringify([this.sourceId, this.bookId, this.openRevision]);
  }

  private currentReadInputKey(): string {
    return JSON.stringify([this.currentInputOwnerKey(), this.query, this.ascending, this.currentChapterIndex]);
  }

  private openingInputCurrent(): boolean {
    return this.mounted && this.interactionEnabled &&
      this.inputOwnerKey === this.currentInputOwnerKey() && (this.inputCurrent?.() ?? true);
  }

  private directoryInputCurrent(): boolean {
    return !this.awaitingRulesRefresh && this.openingInputCurrent();
  }

  private recoveryInputCurrent(expected: number): boolean {
    return this.openingInputCurrent() && expected === this.generation && this.lastQuery === this.query &&
      this.lastAscending === this.ascending && this.lastChapterIndex === this.currentChapterIndex &&
      (this.navigationPortFactory !== undefined ||
        (this.runtimeOwner !== undefined && ReaderRuntimeOwner.isCurrent(this.runtimeOwner)));
  }

  private retryInputCurrent(): boolean {
    return this.recoveryInputCurrent(this.generation) && this.showLoadStatus && this.loadFailed &&
      !this.loadPending && this.openedInputKey === this.currentReadInputKey();
  }

  private retryCurrent(expected: number): void {
    if (expected === this.generation && this.retryInputCurrent()) this.retryOpen();
  }

  private clearInputCurrent(): boolean {
    return this.recoveryInputCurrent(this.generation) && this.query.trim().length > 0;
  }

  private clearCurrent(expected: number): void {
    if (expected === this.generation && this.clearInputCurrent()) this.onClearSearch();
  }

  @Builder
  private treeEmptyState(includeLoadState: boolean = true) {
    if (includeLoadState && this.showLoadStatus && (this.loadPending || this.loadFailed)) {
      ReaderPageState({ loading: this.loadPending, message: this.loadFailed ? '目录加载失败' : '正在加载目录',
        padded: false, actionLabel: this.loadFailed ? '重试加载目录' : '', actionEnabled: this.retryInputCurrent(),
        actionGeneration: this.generation, mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
        onAction: (expected: number): void => this.retryCurrent(expected) });
    } else {
      ReaderPageState({ message: '没有匹配的目录项', padded: false,
        actionLabel: this.query.trim().length > 0 ? '清除搜索' : '', actionEnabled: this.clearInputCurrent(),
        actionGeneration: this.generation, onAction: (expected: number): void => this.clearCurrent(expected),
        mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme) });
    }
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Stack() {
        if (this.mangaDisplay && !this.mangaFontsReady) {
          Blank().width('100%').height('100%');
        } else if (this.showLoadStatus && !this.hasRetainedContent() &&
          !(this.view !== undefined && this.headerCount === 1) &&
          (this.loadPending || this.loadFailed)) {
          if (this.hasPrefix() || this.tailHeight > 0) {
            List({ space: 0, scroller: this.scroller }) {
              if (this.hasPrefix()) {
                ListItem() { this.prefixBuilder(); }.width('100%').constraintSize({ minHeight: Math.max(0, this.prefixHeight) });
              }
              ListItem() {
                ReaderPageState({ loading: this.loadPending, message: this.loadFailed ? '目录加载失败' : '正在加载目录',
                  actionLabel: this.loadFailed ? '重试加载目录' : '', actionEnabled: this.retryInputCurrent(),
                  actionGeneration: this.generation,
                  mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
                  onAction: (expected: number): void => this.retryCurrent(expected) });
              }.width('100%').constraintSize({ minHeight: 44 });
              if (this.tailHeight > 0) {
                ListItem() { this.tailBuilder(); }.width('100%').constraintSize({ minHeight: this.tailHeight });
              }
            }.width('100%').height('100%').scrollBar(BarState.Off).edgeEffect(this.edgeEffectMode)
              .enableScrollInteraction(this.interactionEnabled).onWillStartDragging((): void => { if (this.mounted) this.onTreeUserScrollIntent(); })
              .onAreaChange((_old: Area, area: Area): void => { if (this.mounted && Number(area.height) > 0) this.onFirstLayout(); });
          } else {
            Column() {
              ReaderPageState({ loading: this.loadPending, message: this.loadFailed ? '目录加载失败' : '正在加载目录',
                actionLabel: this.loadFailed ? '重试加载目录' : '', actionEnabled: this.retryInputCurrent(),
                actionGeneration: this.generation,
                mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
                onAction: (expected: number): void => this.retryCurrent(expected) });
            }.width('100%').height('100%').justifyContent(FlexAlign.Center);
          }
        } else if (this.view === undefined) {
          this.fallbackBuilder();
        } else {
          Stack({ alignContent: this.mangaDisplay ? Alignment.TopStart : Alignment.Center }) {
            ReaderDirectoryNavigationList({
              inputCurrent: (): boolean => this.directoryInputCurrent(),
              chapterInputCurrent: this.chapterInputCurrent,
              verificationChapterActions: this.verificationChapterActions,
              navigationPortFactory: this.navigationPortFactory,
              view: this.view, sourceId: this.sourceId, bookId: this.bookId,
              rowHeight: this.resolvedRowHeight(), titleMaxLines: this.titleMaxLines(),
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
              scrollLayout: this.scrollLayout,
              edgeEffectMode: this.edgeEffectMode, interactionEnabled: this.interactionEnabled && !this.awaitingRulesRefresh,
              directoryPublication: this.directoryPublication, directoryEntriesRevision: this.directoryEntriesRevision,
              chapterDownloadEnabled: this.chapterDownloadEnabled,
              chapterDownloadActionsEnabled: this.chapterDownloadActionsEnabled,
              chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
              bookmarkActionsEnabled: this.bookmarkActionsEnabled,
              headerCount: this.headerCount, prefixHeight: this.prefixHeight, prefixIdentity: this.prefixIdentity,
              prefixRevealRevision: this.prefixRevealRevision,
              prefixBuilder: (): void => this.prefixBuilder(),
              tailHeight: this.tailHeight, tailBuilder: (): void => this.tailBuilder(),
              mangaTailBuilder: (): void => this.mangaTailBuilder(),
              emptyBuilder: (): void => this.treeEmptyState(),
              emptyReadStateVisible: this.showLoadStatus && (this.loadPending || this.loadFailed),
              scroller: this.scroller,
              onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
                if (this.directoryInputCurrent()) this.onSelectTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
              },
              onToggleNode: (node: ReaderDirectoryNavigationNode): void => {
                if (this.directoryInputCurrent()) this.toggle(node);
              },
              onUserScrollIntent: (): void => this.onTreeUserScrollIntent(),
              onScrollSettled: (): void => this.onTreeScrollSettled(),
              onFirstLayout: (): void => { if (this.mounted) this.onFirstLayout(); },
              onScrollOffset: (offset: number): void => this.onScrollOffset(offset),
              onClearSearch: (): void => this.onClearSearch(),
              onInvalidated: (stale: boolean): void => { if (!this.awaitingRulesRefresh && !this.loadPending) this.invalidate(stale); },
              onDeleteBookmarks: (times: number[]): void => {
                if (this.directoryInputCurrent() && this.bookmarkActionsEnabled) this.onDeleteBookmarks(times);
              },
              onDownloadChapter: (chapterIndex: number): void => {
                if (this.directoryInputCurrent()) this.onDownloadChapter(chapterIndex);
              },
              onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
                if (this.directoryInputCurrent() && this.bookmarkActionsEnabled) this.onCreateChapterStartBookmark(request);
              },
            });
            if (this.view.visibleTotal === 0 && !this.mangaDisplay && !this.hasPrefix() && this.tailHeight <= 0) {
              this.treeEmptyState(false);
            }
          }.width('100%').height('100%');
        }
      }.width('100%').height('100%');
      if (this.showLoadStatus && this.loadFailed && this.hasRetainedContent()) {
        Row() {
          ReaderRecoveryAction({ label: '重试加载目录', generation: this.generation,
            actionEnabled: this.retryInputCurrent(),
            onReconcile: (expected: number): void => this.retryCurrent(expected) });
        }.constraintSize({ maxWidth: '100%' }).margin({ right: 8, bottom: 8 })
          .hitTestBehavior(HitTestMode.Default)
          .onTouch((event: TouchEvent): void => { event.stopPropagation(); }).zIndex(1);
      }
    }.width('100%').height('100%');
  }
}
