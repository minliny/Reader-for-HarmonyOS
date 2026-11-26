import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { bookCoverDisplayUrl } from '../../../app/library/BookCoverDisplay';
import { BOOKSHELF_GRID_TEXT_GAP, BOOKSHELF_GRID_TITLE_LINES } from './BookshelfGridSpec';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { readerMainViewport } from '../../shell/MainNavigationSpec';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { BookshelfViewModeHost, type BookshelfViewModeSnapshot } from '../application/BookshelfViewModeHost';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { readerSurfaceMaxHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { TYPE_SHELF_UPDATE_BADGE, TYPE_SHELF_FILTER_LABEL, TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_STATE, TYPE_SECTION_HEADING } from '../../../ui/foundation/ReaderTypography';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import {
  TYPE_SHELF_ACTION,
  TYPE_SHELF_CONTINUE_AUTHOR, TYPE_SHELF_CONTINUE_LABEL,
  TYPE_SHELF_CONTINUE_TITLE,
  TYPE_SHELF_LIST_AUTHOR,
  TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_TITLE,
} from '../../../ui/foundation/ReaderTypography';
import { BookshelfSectionHeader } from './BookshelfSectionHeader';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';
import { BookshelfInputAdmission } from '../presentation/BookshelfInputAdmission';
import { MangaBookPresentation } from '../../manga/presentation/MangaBookPresentation';
import { BookshelfViewState, type BookshelfDetailReturnFocus } from '../presentation/BookshelfViewState';
import { bookshelfContinueCardFrame, BookshelfContinueCardFrame } from './BookshelfContinueCardSpec';
import { ReaderSurfaceRect, ReaderSurfaceRectIdentity } from '../../../ui/layout/ReaderSurfaceRect';
import { readerMeasureSurfaceRect } from '../../../ui/layout/ReaderSurfaceRectMeasurement';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { readerScrimmedOpaqueColor } from '../../../ui/surfaces/ReaderScrimColor';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { motionSegment, ReversibleMotionTimeline } from '../../../ui/foundation/MotionTimeline';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import {
  TOK_BORDER_W,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_RADIUS_MD,
  TOK_SCREEN_INSET,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

import { NoCoverCover, noCoverGlyph } from '../../../ui/patterns/NoCoverCover';
import { registerReaderShelfFonts } from '../../../ui/foundation/ReaderFonts';
import { BookshelfBookActionSheet } from './BookshelfBookActionSheet';
import { ReaderBottomSheet } from '../../../ui/surfaces/ReaderBottomSheet';
import { SheetSurfaceSpec, readerSurfaceElevation, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  readerFloatingBarBottomInset,
  readerFloatingTabContentInset,
} from '../../../ui/layout/ReaderFloatingBarMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../../../ui/foundation/ReaderWindowMetrics';
import {
  readerMainNavigationMode,
  readerMainRailContentLeft,
  readerMainRailContentRight,
  type MainNavigationMode,
} from '../../shell/MainNavigationSpec';
import { WebDavCredentialStore } from '../../sync/application/WebDavCredentialStore';
import {
  BookshelfViewMotionContract,
  bookshelfViewCoverDelayMs,
  bookshelfViewMotionContract,
  motionAnimateParam,
} from '../../../ui/foundation/MotionSpec';
import {
  BOOKSHELF_LIST_CARD_PADDING, BOOKSHELF_LIST_COLUMN_GAP, BOOKSHELF_LIST_COVER_HEIGHT, BOOKSHELF_LIST_COVER_WIDTH,
  BOOKSHELF_LIST_DETAILS_GAP, BOOKSHELF_LIST_PROGRESS_STROKE, bookshelfColumnCount,
  bookshelfCoverHeight, bookshelfGridFrame, bookshelfListCardWidth, BookshelfListTextBudget, BookshelfListTextFrame,
  prepareBookshelfListTextFonts,
} from './BookshelfGridSpec';

import { DEFAULT_BOOKSHELF_VIEW, type BookshelfViewMode } from '../application/BookshelfViewMode';
import { bookshelfFileDropTypes, type BookshelfFileDrop } from '../application/BookshelfFileDrop';
import { dispatchBookshelfFileDrop, showBookshelfFileDropFeedback } from './BookshelfFileDropEvent';

@Builder
export function bookshelfFileDropHint(topInset: number, scheme: string) {
  Row() {
    Text('松开以导入书籍')
      .fontFamily(TYPE_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
      .fontColor(readerAppColor('TOK_PRIMARY_TEXT', scheme))
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .backgroundColor(readerAppColor('TOK_PAPER', scheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_PRIMARY_BORDER', scheme) })
      .borderRadius(TOK_RADIUS_MD);
  }
  .width('100%')
  .padding({ top: topInset + TOK_SPACE_MD })
  .justifyContent(FlexAlign.Center)
  .hitTestBehavior(HitTestMode.None);
}

class BookshelfMotionFrameCallback extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

class BookshelfBookActionFocusFrame extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

class BookshelfRowDataSource implements IDataSource {
  private items: ShelfBook[][] = [];
  private listeners: DataChangeListener[] = [];
  private keys: string[] = [];
  private readonly positions: Map<string, number> = new Map();
  private readonly renderKey: (row: ShelfBook[]) => string;
  constructor(renderKey: (row: ShelfBook[]) => string) { this.renderKey = renderKey; }

  totalCount(): number { return this.items.length; }
  getData(index: number): ShelfBook[] { return this.items[index]; }
  positionForKey(key: string, fallback: number): () => number {
    return (): number => this.positions.get(key) ?? fallback;
  }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(items: ShelfBook[][]): void {
    const keys = items.map((row: ShelfBook[]): string => this.renderKey(row));
    const previous = this.keys;
    const shared = Math.min(previous.length, keys.length);
    const samePrefix = previous.slice(0, shared).every((key: string, index: number): boolean => key === keys[index]);
    this.items = items;
    this.keys = keys;
    this.positions.clear();
    keys.forEach((key: string, index: number): void => { this.positions.set(key, index); });
    if (samePrefix && previous.length === keys.length) return;
    // Paging appends/removes whole rows. Tell ArkUI the exact operation so
    // existing covers/text retain their mounted state. Arbitrary regrouping
    // remains the platform's keyed comparison, not a Reader diff engine.
    for (const listener of this.listeners) {
      if (samePrefix && keys.length > previous.length) listener.onDatasetChange([{
        type: DataOperationType.ADD, index: previous.length,
        count: keys.length - previous.length, key: keys.slice(previous.length),
      }]);
      else if (samePrefix && keys.length < previous.length) listener.onDatasetChange([{
        type: DataOperationType.DELETE, index: keys.length, count: previous.length - keys.length,
      }]);
      else listener.onDatasetChange([{ type: DataOperationType.RELOAD }]);
    }
  }
}

/**
 * Figma-backed Bookshelf with the canonical Cover and List projections.
 *
 * Source: `23 · Pages · Final` `943:11` (Phone) and `943:437` (Tablet).
 * This component deliberately has no empty, no-cover, import, or motion
 * fallback: those states are not present in the corresponding Final pages.
 */
@Component
export struct BookshelfPage {
  private readonly listTextBudget: BookshelfListTextBudget = new BookshelfListTextBudget();
  @State private listTextFontRevision: number = 0;
  private listTextFontGeneration: number = 0;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  viewState: BookshelfViewState = new BookshelfViewState();
  private readonly shelfScroller: Scroller = new Scroller();
  @State private paneWidth: number = 0;
  private viewportRestored: boolean = false;
  @State private failedCoverUrls: string[] = [];
  private projectedWideLayout: boolean = false;
  private viewportRestoreGeneration: number = 0;
  private detailReturnFocus: BookshelfDetailReturnFocus | undefined;
  private bookActionFocusRevision: number = 0;
  private firstVisibleItem: number = 0;
  private lastVisibleItem: number = -1;
  private headerScrollFrameQueued: string = '';
  private headerScrollPublishedNavigation: number = -1;
  private headerScrolled: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMangaPresentationRevision') private mangaRevision: number = 0;

  @StorageLink('readerMainViewportRevision') @Watch('onShelfViewportChanged') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') @Watch('onShelfViewportChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  // The bookshelf page is rebuilt when leaving and returning from reading.
  // Keep the user's projection choice in app storage so route recreation does
  // not silently restore the cover projection.
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = DEFAULT_BOOKSHELF_VIEW;
  // Retire the removed group selector's transient filter without changing book groups.
  @StorageLink('readerBookshelfSelectedGroup') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfContentFilter') @Watch('onShelfFiltersChanged') private contentFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('onShelfFiltersChanged') private sourceFilter: string = 'all';
  @Prop @Watch('onBooksChanged') books: ShelfBook[];
  @Prop serverFiltered: boolean = false;
  @Prop projectedSourceFilter: string = 'all';
  @Prop projectedContentFilter: string = 'all';
  @Prop projectedBookCount: number = -1;
  @Prop noticeTopInset: number = 0;
  @State private recoveryViewportHeight: number = -1;
  @State private recoveryOriginY: number = 0;
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop @Watch('scheduleContinueCardMeasurement') headerBottom: number = bookshelfHeaderSpec().frameHeight;
  /** Full native footer slot, including the navigation's existing bottom margin. */
  @Prop @Watch('scheduleContinueCardMeasurement') measuredFooterHeight: number = 0;
  /** Route increments this when the current main tab is tapped. */
  @Prop @Watch('onScrollToTopRequested') scrollToTopToken: number = 0;
  @Prop @Watch('onShelfPresentationChanged') navigationGeneration: number = 0;
  @Prop @Watch('modeFeedback') feedbackEnabled: boolean = true;
  @Prop @Watch('resetFileDropHover') fileDropEnabled: boolean = false;
  @State private fileDropHover: boolean = false;
  @Prop unfilteredOnlineBooks: boolean = false;
  onNextPageRequested: (navigation?: number) => void = (): void => {};
  onPreviousPageRequested: (navigation?: number) => void = (): void => {};
  onFilterRequested: (readingState: string, sourceKind: string, contentKind?: string, navigation?: number) => void = (_readingState: string, _sourceKind: string): void => {};
  onEmptySearch: (navigation: number) => void = (_navigation: number): void => {};
  onEmptyImport: (navigation: number, focusTarget: string) => void = (_navigation: number, _focusTarget: string): void => {};
  onFilesDropped: (drop: BookshelfFileDrop, navigation: number) => boolean =
    (_drop: BookshelfFileDrop, _navigation: number): boolean => false;
  @Prop @Watch('onContinueReadingChanged') continueReading: ShelfBook | undefined;
  /** Keep the shelf slot stable when the IME leaves no room to cover the card. */
  @Prop continueCardSuppressed: boolean = false;
  onContinueCardRect: (rect: ReaderSurfaceRect | undefined, navigation: number, bookKey: string) => void =
    (_rect: ReaderSurfaceRect | undefined, _navigation: number, _bookKey: string): void => {};
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  @State private shelfPressKey: string = '';
  private shelfPressPointer: number = -1;
  onRssRequested: (navigation?: number) => void = (): void => {};
  onSettingsRequested: (navigation?: number) => void = (): void => {};
  onDiscoverRequested: (navigation?: number) => void = (): void => {};
  onBookSelected: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  onVisibleBooksChanged: (books: ShelfBook[], navigation?: number) => void = (_books: ShelfBook[]): void => {};
  onHeaderScrolledChanged: (scrolled: boolean, navigation: number) => void =
    (_scrolled: boolean, _navigation: number): void => {};
  isCurrentChromeHost: (navigation?: number) => boolean = (_navigation?: number): boolean => true;
  isCurrentShelfInput: (navigation: number) => boolean = (_navigation: number): boolean => false;
  onBookMultiSelectRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  onBookGroupRequested: (book: ShelfBook, navigation?: number, focusTarget?: string) => void = (_book: ShelfBook): void => {};
  onBookInfoRequested: (book: ShelfBook, navigation?: number, focus?: BookshelfDetailReturnFocus) => void =
    (_book: ShelfBook): void => {};
  takeDetailReturnFocus: (navigation: number) => BookshelfDetailReturnFocus | undefined =
    (_navigation: number): BookshelfDetailReturnFocus | undefined => undefined;
  onBookRemoveRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  @State private viewMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  @State private viewSwitchRunning: boolean = false;
  @State private viewSwitchHeaderOpacity: number = 1;
  @State private viewSwitchGridContentOpacity: number = 0;
  @State private viewSwitchListContentOpacity: number = 1;
  @State private viewSwitchDestinationCoverOpacity: number = 1;
  @State private viewSwitchMorphCoverOpacity: number = 0;
  @State private filterRowVisible: boolean = false;
  @State private filterPanelHeight: number = 0;
  @State private filterContentOpacity: number = 0;
  private filterNaturalHeight: number = 0;
  private filterMotionGeneration: number = 0;
  private filterMotionRunning: boolean = false;
  private continueCardMeasureQueued: string = '';
  private continueCardPublishedKey: string = '';
  private continueCardPublishedNavigation: number = -1;
  private continueCardPublishedRect: ReaderSurfaceRect | undefined = undefined;
  @State private viewModeError: string = '';
  private mounted: boolean = false;
  private readonly shelfInput: BookshelfInputAdmission = new BookshelfInputAdmission(
    (): number => this.navigationGeneration,
    (navigation: number): boolean => this.mounted && this.isCurrentShelfInput(navigation));
  private projectionQueued: boolean = false;
  private filterPublicationQueued: boolean = false;
  private projectionGeneration: number = 0;
  @State private viewModeSnapshot: BookshelfViewModeSnapshot = { canonical: undefined };
  private readonly viewModeHost: BookshelfViewModeHost = BookshelfViewModeHost.instance;
  private viewModeRevision: number = 0;
  private confirmedViewMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  private requestedViewMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  private viewModeReadFailed: boolean = false;
  @State private actionBook: ShelfBook | undefined = undefined;
  @State private bookActionSheetVisible: boolean = false;
  @State private actionSheetId: string = '';
  private actionSheetRevision: number = 0;
  private actionSheetNavigation: number = 0;
  private actionSheetFocusTarget: string | undefined = undefined;
  private actionSheetChromeId: string = '';
  private pendingBookAction: (() => void) | undefined = undefined;
  @State private visibleBookCount: number = 0;
  private readonly viewMotion: BookshelfViewMotionContract = bookshelfViewMotionContract();
  private pendingViewMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  private viewSwitchToken: number = 0;
  @State private viewSwitchTimeMs: number = 0;
  private viewSwitchSourceMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  private viewSwitchDestinationMode: BookshelfViewMode = 'cover';
  private viewSwitchRanks: Map<number, number> = new Map<number, number>();
  private viewTimeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
  private readonly rowDataSource: BookshelfRowDataSource = new BookshelfRowDataSource((row: ShelfBook[]): string => this.bookRowRenderKey(row, 0));
  private readonly webDavCredentials: WebDavCredentialStore = WebDavCredentialStore.instance;

  aboutToAppear(): void {
    this.mounted = true;
    this.detailReturnFocus = this.takeDetailReturnFocus(this.navigationGeneration);
    registerReaderShelfFonts(this.getUIContext().getFont());
    this.prepareListTextFonts();
    const confirmedMode = this.webDavCredentials.currentBookshelfViewMode();
    const restoredMode: BookshelfViewMode = confirmedMode ?? (this.storedViewMode === 'cover' ? 'cover' : DEFAULT_BOOKSHELF_VIEW);
    this.viewMode = restoredMode;
    this.confirmedViewMode = restoredMode;
    this.requestedViewMode = restoredMode;
    this.viewModeSnapshot = this.viewModeHost.current();
    this.viewModeError = this.viewModeRecovery().message;
    this.storedViewMode = restoredMode;
    this.storedSelectedGroup = '';
    this.filterRowVisible = this.viewState.filterExpanded;
    this.filterContentOpacity = this.filterRowVisible ? 1 : 0;
    this.filterPanelHeight = 0;
    this.filterNaturalHeight = 0;
    this.filterMotionRunning = false;
    this.viewportRestored = false;
    this.setRestingProjectionOpacity(restoredMode);
    this.rebuildShelfProjection();
    // EntryAbility has already read this choice and recovery may have replaced
    // it. Reuse the store's acknowledged value; retries and a remount during
    // an in-flight write still use the existing serialized load path.
    if (confirmedMode === undefined) this.loadViewMode();
  }

  private viewModePending(): boolean {
    return this.viewModeSnapshot.receipt?.receipt.confirmation === 'unknown' ||
      this.viewModeSnapshot.receipt?.facts.blocked === true;
  }
  private lastModeFeedback: string = '';
  @State private modeReconcileBusy: boolean = false;
  private modeFeedback(): void {
    if (!this.mounted || !this.feedbackEnabled) return;
    const view = this.viewModeRecovery();
    if (!view.visible || this.viewModePending()) { this.lastModeFeedback = ''; return; }
    if (view.message === this.lastModeFeedback) return;
    this.lastModeFeedback = view.message;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: view.message, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.feedbackEnabled); } catch (_) {}
  }
  private viewModeRecovery(): ReaderRecoveryView {
    const view = readerRecoveryView(this.viewModeSnapshot.receipt, this.viewModeSnapshot.readFacts);
    if (this.viewModeSnapshot.receipt?.facts.blockedReason === 'BOOKSHELF_RESTORE_PENDING') {
      return { message: '请先在同步设置中重试未完成的恢复', visible: true, canRetry: false, generation: view.generation };
    }
    return view;
  }

  private retryViewMode(generation: number = this.viewModeRecovery().generation,
    navigation: number = this.navigationGeneration): void {
    if (!this.isShelfPresentationCurrent(navigation) || !this.feedbackEnabled || !this.isCurrentShelfInput(navigation) ||
      this.modeReconcileBusy || generation !== this.viewModeRecovery().generation) return;
    this.lastModeFeedback = '';
    const revision = this.viewModeRevision;
    this.modeReconcileBusy = true;
    void this.viewModeHost.reconcile(generation, (): boolean => this.isShelfPresentationCurrent(navigation) &&
      revision === this.viewModeRevision)
      .then((snapshot): void => {
        if (snapshot === undefined || !this.isShelfPresentationCurrent(navigation) || revision !== this.viewModeRevision) return;
        this.applyViewModeSnapshot(snapshot);
      }).finally((): void => {
        if (this.mounted && revision === this.viewModeRevision) this.modeReconcileBusy = false;
      });
  }

  private applyViewModeSnapshot(snapshot: BookshelfViewModeSnapshot): void {
    this.viewModeSnapshot = snapshot;
    this.viewModeError = this.viewModeRecovery().message;
    this.modeFeedback();
    this.viewModeReadFailed = snapshot.readFacts?.canRetry === true;
    const mode = snapshot.canonical;
    if (mode === undefined) return;
    this.confirmedViewMode = mode;
    this.storedViewMode = mode;
    if (this.viewMode === mode && !this.viewSwitchRunning) return;
    this.resetViewSwitchMotion();
    this.viewMode = mode;
    this.setRestingProjectionOpacity(mode);
    this.rebuildShelfProjection();
  }

  private loadViewMode(): void {
    const revision = ++this.viewModeRevision;
    this.viewModeError = '';
    this.viewModeReadFailed = false;
    void this.viewModeHost.load((): boolean => this.mounted && revision === this.viewModeRevision)
      .then((snapshot): void => {
        if (snapshot === undefined || !this.mounted || revision !== this.viewModeRevision) return;
        this.applyViewModeSnapshot(snapshot);
      });
  }

  aboutToDisappear(): void {
    this.resetFileDropHover();
    this.resetShelfPress();
    this.listTextFontGeneration += 1;
    this.transientFeedback.reset();
    this.cancelBookActionFocus();
    this.publishContinueCardRect(undefined);
    this.continueCardMeasureQueued = '';
    this.projectionGeneration += 1;
    this.projectionQueued = false;
    this.filterPublicationQueued = false;
    this.saveShelfViewport();
    this.viewState.filterExpanded = this.filterRowVisible;
    this.filterMotionGeneration += 1;
    this.filterMotionRunning = false;
    this.viewportRestoreGeneration += 1;
    this.headerScrollFrameQueued = '';
    this.mounted = false;
    this.modeReconcileBusy = false;
    this.bookActionSheetVisible = false;
    this.pendingBookAction = undefined;
    if (this.actionSheetChromeId.length > 0 && this.isCurrentChromeHost(this.navigationGeneration)) ReaderWindowCoordinator.requestAppChrome();
    this.actionSheetChromeId = '';
    this.actionBook = undefined;
    this.actionSheetId = '';
    this.actionSheetFocusTarget = undefined;
    this.actionSheetRevision += 1;
    this.viewModeRevision += 1;
    this.resetViewSwitchMotion();
  }

  build() {
    this.bookshelfTabContent();
  }

  private resetFileDropHover(): void { this.fileDropHover = false; }

  private fileDropCurrent(): boolean {
    return this.fileDropEnabled && this.actionSheetId.length === 0 &&
      this.isCurrentShelfInput(this.navigationGeneration);
  }

  private onFileDrag(event: DragEvent): void {
    this.fileDropHover = showBookshelfFileDropFeedback(event, this.fileDropCurrent());
  }

  private onFileDrop(event: DragEvent): void {
    this.resetFileDropHover();
    dispatchBookshelfFileDrop(event, this.fileDropCurrent(), this.reduceMotion,
      (drop: BookshelfFileDrop): boolean => this.onFilesDropped(drop, this.navigationGeneration));
  }

  @Builder
  private bookshelfTabContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.shelfPane();
      if (this.fileDropHover && this.fileDropEnabled && this.actionSheetId.length === 0) {
        bookshelfFileDropHint(this.headerBottom, this.appThemeScheme);
      }
      if (this.viewModePending()) {
        Column() {
          ForEach([this.navigationGeneration], (navigation: number): void => {
            ReaderRecoveryNotice({ maxHeightVp: this.viewModeRecoveryMaxHeight(), view: this.viewModeRecovery(), tag: '显示方式待确认', actionLabel: '核对显示方式',
              busy: this.modeReconcileBusy || this.viewModeSnapshot.receipt?.facts.fact === 'refreshing' || this.viewModeSnapshot.readFacts?.fact === 'refreshing',
              onReconcile: this.viewModeReconcileAction(navigation) });
          }, (navigation: number): string => `view-mode-recovery:${navigation}`);
        }.width('100%').padding({ left: 17, right: 17, top: this.shelfHeaderClearance() + this.noticeTopInset })
          .hitTestBehavior(HitTestMode.Transparent);
      }
      if (this.actionSheetId.length > 0) {
        ForEach([this.actionSheetId], (id: string): void => {
          this.bookActionSheetHost(id, this.actionBook);
        }, (id: string): string => id);
      }
    }
    .width('100%')
    .height('100%')
    .allowDrop(this.fileDropEnabled ? bookshelfFileDropTypes() : null)
    .onDragEnter((event: DragEvent): void => this.onFileDrag(event))
    .onDragMove((event: DragEvent): void => this.onFileDrag(event))
    .onDragLeave((): void => this.resetFileDropHover())
    .onDrop((event: DragEvent): void => this.onFileDrop(event))
    .onAreaChange((_old: Area, area: Area): void => this.recordShelfPane(area));
  }

  private recordShelfPane(area: Area): void {
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const originY = readerPageAreaLength(area.globalPosition?.y ?? 0);
    if (Number.isFinite(width) && width > 0 && Math.abs(width - this.paneWidth) >= 0.01) {
      this.paneWidth = width;
      this.onShelfViewportChanged();
    }
    if (Number.isFinite(height) && height >= 0) this.recoveryViewportHeight = height;
    if (Number.isFinite(originY)) this.recoveryOriginY = originY;
  }

  private onShelfViewportChanged(): void {
    if (!this.mounted) return;
    if (this.projectedWideLayout !== this.isWideViewport()) this.queueShelfProjection();
    this.scheduleContinueCardMeasurement();
  }

  private viewModeRecoveryMaxHeight(): number {
    this.readerWindowMetricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    const windowHeight = Math.max(0, metrics.windowRect.height - this.recoveryOriginY);
    const height = Math.min(this.recoveryViewportHeight >= 0 ? this.recoveryViewportHeight : windowHeight, windowHeight);
    const bottom = Math.max(this.shelfContentEndInset(), readerInteractiveSafeBottom(metrics, false));
    return readerSurfaceMaxHeight(Math.min(height - bottom,
      readerKeyboardHostBottom(metrics, this.recoveryOriginY, height)), this.shelfHeaderClearance() + this.noticeTopInset + 8);
  }

  private claimBookActionChrome(presentationId: string, book: ShelfBook | undefined): void {
    if (!this.isCurrentChromeHost(this.actionSheetNavigation)) return;
    if (!this.isCurrentBookActionSheet(presentationId, book)) return;
    const mask = readerAppColor(this.bookActionSheetSpec().hostMaskRole, this.appThemeScheme);
    const paper = readerScrimmedOpaqueColor(readerAppColor('app.window.background', this.appThemeScheme), mask);
    const ink = readerScrimmedOpaqueColor(readerAppColor('app.window.foreground', this.appThemeScheme), mask);
    const style = new ReaderWindowChromeStyle(paper, this.appThemeScheme === 'night' ? 'light' : 'dark', ink);
    style.navigationUnderlayColor = readerAppColor(this.bookActionSheetSpec().hostBackgroundRole, this.appThemeScheme);
    style.navigationContentColor = readerAppColor('app.window.foreground', this.appThemeScheme);
    this.actionSheetChromeId = presentationId;
    ReaderWindowCoordinator.requestOverlayChrome(style);
  }

  private bookActionSheetSpec(): SheetSurfaceSpec {
    return resolveSheetSpec('bookshelf-book-action');
  }

  @Builder
  private bookActionSheetHost(id: string, book: ShelfBook | undefined) {
    ReaderBottomSheet({ visible: this.bookActionSheetVisible, specId: 'bookshelf-book-action',
      surfaceWidth: this.bookActionSheetSpec().maxWidth,
      scheme: this.appThemeScheme, reduceMotion: this.reduceMotion, nativeId: 'reader-bookshelf-book-action-sheet', drainPendingClose: true,
      content: (): void => { this.bookActionSheetPresentation(id, book); },
      onRequestClose: (): void => this.dismissBookActionSheet(id, book),
      onOpening: (): void => this.claimBookActionChrome(id, book),
      onClosed: (): void => this.finishBookActionSheet(id, book),
    });
  }

  @Builder
  private bookActionSheetPresentation(presentationId: string, book: ShelfBook | undefined) {
    BookshelfBookActionSheet({
      presentationId,
      isCurrent: (candidate: string): boolean => candidate === presentationId && this.isCurrentBookActionSheet(presentationId, book) &&
        this.isCurrentShelfInput(this.actionSheetNavigation),
      onMultiSelect: (): void => this.performBookAction(presentationId, book, this.onBookMultiSelectRequested),
      onBookInfo: (): void => this.performBookAction(presentationId, book,
        (selected: ShelfBook, navigation?: number, target?: string): void => {
          this.saveShelfViewport();
          const focus: BookshelfDetailReturnFocus | undefined = target === undefined ? undefined :
            { sourceId: selected.sourceId, bookId: selected.bookId, listMore: target === this.bookActionFocusKey(selected, true) };
          this.onBookInfoRequested(selected, navigation, focus);
        }),
      onEditGroup: (): void => this.performBookAction(presentationId, book, this.onBookGroupRequested),
      onRemoveFromBookshelf: (): void => this.performBookAction(presentationId, book, this.onBookRemoveRequested),
    });
  }

  @Builder
  private shelfPane() {
    Column() {
      this.bookshelfList();
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.shelfPaneFrame().left, right: this.shelfPaneFrame().right });
  }

  private shelfPaneFrame(): SurfaceHorizontalFrame {
    return this.isWideViewport() ? this.tabletContentFrame() : this.phoneContentFrame();
  }

  private continueCardFrame(expandedLayout: boolean): BookshelfContinueCardFrame {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return bookshelfContinueCardFrame(this.shelfContentWidth(expandedLayout), scale);
  }

  private continueCardFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) ? Math.max(1, scale) : 1;
  }

  @Builder
  private continueCardCover(bookProvider: () => ShelfBook | undefined, expandedLayout: boolean) {
    Stack() {
      if (this.hasCover(bookProvider())) {
        Image(this.coverUrl(bookProvider()) ?? '')
          .width(this.continueCardFrame(expandedLayout).coverWidth)
          .height(this.continueCardFrame(expandedLayout).coverHeight)
          .objectFit(ImageFit.Cover).borderRadius(8)
          .onError(this.coverErrorHandler(this.coverUrl(bookProvider())));
      } else {
        NoCoverCover({
          coverWidth: this.continueCardFrame(expandedLayout).coverWidth,
          coverHeight: this.continueCardFrame(expandedLayout).coverHeight,
          glyph: noCoverGlyph(bookProvider()?.title),
          kindLabel: ShelfBookPresentation.contentLabel(bookProvider()),
        });
      }
    }.width(this.continueCardFrame(expandedLayout).coverWidth)
      .height(this.continueCardFrame(expandedLayout).coverHeight).borderRadius(8).clip(true);
  }

  @Builder
  private continueCardCopy(bookProvider: () => ShelfBook | undefined, expandedLayout: boolean) {
    Column({ space: this.continueCardFrame(expandedLayout).textGap }) {
      Text(bookProvider()?.title ?? '').width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_TITLE.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_TITLE.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_TITLE.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_TITLE.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(bookProvider()?.author ?? '').width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_AUTHOR.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(this.continueReadingPosition(bookProvider())).width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_AUTHOR.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_AUTHOR.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_AUTHOR.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: 8 }) {
        Progress({ value: this.continueBookProgress(bookProvider()), total: 100, type: ProgressType.Linear })
          .layoutWeight(1).height(BOOKSHELF_LIST_PROGRESS_STROKE).color(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
          .style({ strokeWidth: BOOKSHELF_LIST_PROGRESS_STROKE, strokeRadius: 2, enableSmoothEffect: false })
          .hitTestBehavior(HitTestMode.None);
        Text(this.continueBookProgressLabel(bookProvider())).fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp).fontColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .fontFeature('"tnum" 1')
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width('100%').alignItems(VerticalAlign.Center);
    }.layoutWeight(1).constraintSize({ minHeight: this.continueCardFrame(expandedLayout).textMinHeight })
      .alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.Center);
  }

  private continueBookProgress(book: ShelfBook | undefined): number {
    return book === undefined ? 0 : ShelfBookPresentation.progressPercent(book);
  }

  private continueBookProgressLabel(book: ShelfBook | undefined): string {
    return book === undefined ? '' : ShelfBookPresentation.listProgress(book);
  }

  @Builder
  private continueCardReadAction(expandedLayout: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Text('阅读').fontFamily(TYPE_SHELF_ACTION.fontFamily).fontWeight(TYPE_SHELF_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_ACTION.fontSizeFp).lineHeight(TYPE_SHELF_ACTION.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_ACTION.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale()).maxLines(2).textAlign(TextAlign.Center)
        .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
    }.width(this.continueCardFrame(expandedLayout).actionWidth)
      .height(this.continueCardFrame(expandedLayout).actionHeight)
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
      .borderRadius(this.continueCardFrame(expandedLayout).actionHeight / 2);
  }

  private resetShelfPress(): void { this.shelfPressKey = ''; this.shelfPressPointer = -1; }

  private observeShelfPress(event: TouchEvent, key: string, enabled: boolean = true): void {
    if (this.shelfPressKey.length > 0 && this.shelfPressKey !== key) return;
    const current = enabled && this.isShelfPresentationCurrent(this.navigationGeneration) &&
      this.isCurrentShelfInput(this.navigationGeneration);
    const next = readerPressPointer(event, this.shelfPressPointer, current);
    if (next === this.shelfPressPointer) return;
    this.shelfPressPointer = next;
    readerAnimatePress(this.getUIContext(), this.reduceMotion, (): void => { this.shelfPressKey = next < 0 ? '' : key; });
  }

  private shelfPressed(key: string): boolean { return this.shelfPressKey === key; }

  @Builder
  private continueReadingCard(bookProvider: () => ShelfBook | undefined, expandedLayout: boolean) {
    Column({ space: 6 }) {
      Text('继续阅读').width('100%')
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
          ? { role: 'scroll-content', id: 'shelf-continue-heading', scope: 'bookshelf', active: !this.headerScrolled,
            expectedContentGapVp: bookshelfHeaderSpec().contentGap } as LayoutInvariantTag : undefined)
        .fontFamily(TYPE_SHELF_CONTINUE_LABEL.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_LABEL.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_LABEL.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_LABEL.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Stack() {
      Column({ space: this.continueCardFrame(expandedLayout).actionBelow ? this.continueCardFrame(expandedLayout).gap : 0 }) {
        Row({ space: this.continueCardFrame(expandedLayout).gap }) {
          this.continueCardCover(bookProvider, expandedLayout);
          this.continueCardCopy(bookProvider, expandedLayout);
          if (!this.continueCardFrame(expandedLayout).actionBelow) {
            this.continueCardReadAction(expandedLayout);
          }
        }.width('100%').constraintSize({ minHeight: this.continueCardFrame(expandedLayout).bodyMinHeight })
          .alignItems(VerticalAlign.Center);
        if (this.continueCardFrame(expandedLayout).actionBelow) {
          Row() {
            Blank().layoutWeight(1);
            this.continueCardReadAction(expandedLayout);
          }.width('100%');
        }
      }.width(this.continueCardFrame(expandedLayout).width)
        .constraintSize({ minHeight: this.continueCardFrame(expandedLayout).minHeight })
        .padding({ left: this.continueCardFrame(expandedLayout).paddingHorizontal,
          right: this.continueCardFrame(expandedLayout).paddingHorizontal,
          top: this.continueCardFrame(expandedLayout).paddingVertical,
          bottom: this.continueCardFrame(expandedLayout).paddingVertical })
        .backgroundColor(readerPressSurface(readerAppColor('TOK_CARD_BG', this.appThemeScheme), this.appThemeScheme,
          this.shelfPressed('continue'), this.reduceMotion))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(16)
        .shadow(readerSurfaceElevation('card', this.appThemeScheme))
        .scale(readerPressScale(this.shelfPressed('continue'), this.reduceMotion))
        .opacity(readerPressOpacity(this.shelfPressed('continue'), this.reduceMotion));
      }.width(this.continueCardFrame(expandedLayout).width).alignSelf(ItemAlign.Center)
        .id(this.continueCardRectId())
        .onAreaChange((): void => this.scheduleContinueCardMeasurement())
        .onTouch((event: TouchEvent): void => this.observeShelfPress(event, 'continue', !this.continueCardSuppressed))
        .onClick(this.bookSelectionHandler(bookProvider, true));
    }.width(this.shelfContentWidth(expandedLayout)).alignItems(HorizontalAlign.Start)
      .opacity(this.continueCardSuppressed ? 0 : 1)
      .enabled(!this.continueCardSuppressed)
      .hitTestBehavior(this.continueCardSuppressed ? HitTestMode.None : HitTestMode.Default)
      .accessibilityLevel(this.continueCardSuppressed ? 'no-hide-descendants' : 'auto');
  }

  private mangaReadingPosition(book: ShelfBook): string {
    if (this.mangaRevision < 0) return '';
    // Keep the shared presentation contract intact while using the compact
    // page copy from the manga demo on the bookshelf card.
    const position = ShelfBookPresentation.readingPosition(book);
    return position.replace(' · 第 ', ' · ').replace(/^第 /, '');
  }

  private continueReadingPosition(book: ShelfBook | undefined): string {
    if (book === undefined) return '';
    if (book.contentKind === 'manga') {
      if (this.mangaRevision < 0 || MangaBookPresentation.get(book.sourceId, book.bookId) === undefined) return '';
      return `读至：${this.mangaReadingPosition(book)}`;
    }
    return `读至：${ShelfBookPresentation.readingPosition(book)}`;
  }

  @Builder
  private bookshelfList() {
    List({ space: TOK_SPACE_CONTROL_INLINE, scroller: this.shelfScroller }) {
      if (this.continueReading !== undefined) {
        ListItem() {
          // Retained Builder observers must read the live Prop instead of
          // capturing the book that happened to be current when mounted.
          if (this.isWideViewport()) {
            this.continueReadingCard((): ShelfBook | undefined => this.continueReading, true);
          } else {
            this.continueReadingCard((): ShelfBook | undefined => this.continueReading, false);
          }
        }.padding({ top: this.shelfFirstItemPadding() });
      }
      ListItem() {
        Column() {
          ForEach([this.navigationGeneration], (navigation: number): void => {
            BookshelfSectionHeader({
              contentWidth: this.shelfContentWidth(this.isWideViewport()),
              titleOpacity: this.viewSwitchHeaderOpacity,
              viewMode: this.viewMode,
              filterExpanded: this.filterRowVisible,
              hasActiveFilters: this.hasActiveFilters(),
              bookCount: this.currentFilterBookCount(),
              onCover: this.viewModeAction('cover', navigation),
              onList: this.viewModeAction('list', navigation),
              onFilter: (): void => this.setFilterExpanded(!this.filterRowVisible, navigation),
            }).customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' &&
              READER_LAYOUT_DEBUG_BUILD && this.continueReading === undefined
              ? { role: 'scroll-content', id: 'shelf-section', scope: 'bookshelf', active: !this.headerScrolled,
                expectedContentGapVp: bookshelfHeaderSpec().contentGap } as LayoutInvariantTag : undefined);
          }, (navigation: number): string => `shelf-section:${navigation}`);

          ForEach([this.navigationGeneration], (navigation: number): void => {
            this.filterPanel(navigation);
          }, (navigation: number): string => `shelf-filters:${navigation}`);
        }
        .width(this.shelfContentWidth(this.isWideViewport()))
        .padding({ top: this.continueReading === undefined ? this.shelfFirstItemPadding() : 0 });
      }

      if (this.currentFilterBookCount() === 0 && this.hasActiveFilters()) {
        ListItem() {
          Column() {
            ForEach([this.navigationGeneration], (navigation: number): void => {
              this.filteredEmptyCard(navigation);
            }, (navigation: number): string => `shelf-filter-empty:${navigation}`);
          }.width('100%');
        }
      }

      // One stable row/card tree owns both projections. Replacing the list and
      // grid subtrees made ArkUI mount the target at its final geometry, so the
      // Figma shared-cover motion had no persistent actor to interpolate.
      LazyForEach(this.rowDataSource, (row: ShelfBook[], rowIndex: number) => {
        ListItem() {
          // Keep the ListItem and its stable key when its layout form changes.
          if (this.isWideViewport()) {
            this.projectionRow(row, true,
              this.rowDataSource.positionForKey(this.bookRowRenderKey(row, rowIndex), rowIndex));
          } else {
            this.projectionRow(row, false,
              this.rowDataSource.positionForKey(this.bookRowRenderKey(row, rowIndex), rowIndex));
          }
        }
      }, (row: ShelfBook[], rowIndex: number): string => this.bookRowRenderKey(row, rowIndex));
    }
    .width(this.shelfContentWidth(this.isWideViewport()))
    .height('100%')
    .id(this.shelfViewportMotionId())
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .scrollBar(BarState.Off)
    .maintainVisibleContentPosition(true)
    .onScrollIndex(this.shelfScrollHandler())
    .onReachStart(this.shelfPageHandler(true))
    .onReachEnd(this.shelfPageHandler(false))
    .onDidScroll(this.shelfViewportScrollHandler())
    .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.cancelBookActionFocus(); })
    .onKeyEvent((): void => this.cancelBookActionFocus())
    .onAppear((): void => this.restoreShelfViewport());
  }

  @Builder
  private filteredEmptyCard(navigation: number) {
    ReaderPageState({ title: '没有符合筛选条件的书籍', message: '试试放宽类型或来源筛选条件', customActions: true,
      leading: (): void => { this.filteredEmptyBadge(); },
      actionContent: (): void => { this.filteredEmptyActions(navigation); } })
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(18);
  }

  @Builder
  private filteredEmptyBadge() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.bookshelf_library_outline_theme_night') :
        $r('app.media.bookshelf_library_outline')).width(24).height(24);
    }.width(48).height(48).borderRadius(16)
      .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme)).accessibilityLevel('no-hide-descendants');
  }

  @Builder
  private filteredEmptyActions(navigation: number) {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center,
      space: { main: LengthMetrics.vp(8), cross: LengthMetrics.vp(8) } }) {
      ReaderButton({ specId: 'shelf-action', scheme: this.appThemeScheme, label: '重置筛选', variant: 'tonal', visualSize: 'medium',
        onAction: (): void => {
          this.clearFilters(navigation);
          this.setFilterExpanded(false, navigation);
        } });
      ReaderButton({ specId: 'search-primary', scheme: this.appThemeScheme, label: '搜索书籍', variant: 'primary', visualSize: 'medium',
        onAction: (): void => { if (this.isShelfPresentationCurrent(navigation)) this.onEmptySearch(navigation); } });
      ReaderButton({ specId: 'shelf-action', scheme: this.appThemeScheme, label: '本地导入', variant: 'subtle', visualSize: 'medium',
        focusId: 'reader-bookshelf-filtered-import',
        onAction: (): void => {
          if (this.isShelfPresentationCurrent(navigation)) this.onEmptyImport(navigation, 'reader-bookshelf-filtered-import');
        } });
    }.width('100%');
  }

  private shelfHeaderItems(): number {
    // Header and filter always share one ListItem; recovery is a separate overlay.
    return 1 + (this.continueReading === undefined ? 0 : 1);
  }

  private saveShelfViewport(): void {
    if (!this.viewportRestored) return;
    try {
      const offset = this.shelfScroller.currentOffset().yOffset;
      const itemY = this.shelfScroller.getItemRect(this.firstVisibleItem).y;
      if (!Number.isFinite(offset) || !Number.isFinite(itemY)) return;
      const rowIndex = this.firstVisibleItem - this.shelfHeaderItems();
      const row = rowIndex >= 0 && rowIndex < this.rowDataSource.totalCount() ?
        this.rowDataSource.getData(rowIndex) : undefined;
      const key = row !== undefined && row.length > 0 ?
        JSON.stringify([row[0].sourceId, row[0].bookId]) : '';
      // Publish the complete native sample together. An invalid/detached read
      // must not pair a new offset with the previous identity or item position.
      this.viewState.anchorKey = key;
      this.viewState.anchorOffset = offset;
      this.viewState.anchorItemY = itemY;
      this.viewState.anchorCaptured = true;
    } catch (_error) { /* Keep the last measured position after native detach. */ }
  }

  private restoreShelfViewport(): void {
    const navigation = this.navigationGeneration;
    const generation = ++this.viewportRestoreGeneration;
    const key = this.viewState.anchorKey;
    const itemY = this.viewState.anchorItemY;
    const offset = this.viewState.anchorOffset;
    const captured = this.viewState.anchorCaptured || key.length > 0 || (Number.isFinite(offset) && offset !== 0);
    // A real List top is -startInset, not zero. Publish the known restoration
    // target before its two native frames; do not flash idle for a saved row.
    this.publishHeaderScrolled(key.length > 0 || (captured && Number.isFinite(offset) &&
      offset + this.shelfContentStartInset() > bookshelfHeaderSpec().scrollThreshold));
    this.viewportRestored = false;
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (!this.isShelfPresentationCurrent(navigation) || generation !== this.viewportRestoreGeneration) return;
      let anchor = -1;
      for (let index = 0; index < this.rowDataSource.totalCount(); index += 1) {
        if (this.rowDataSource.getData(index).some((book: ShelfBook): boolean =>
          JSON.stringify([book.sourceId, book.bookId]) === key)) { anchor = index; break; }
      }
      if (anchor < 0) {
        if (captured && Number.isFinite(offset)) {
          this.shelfScroller.scrollTo({ xOffset: 0, yOffset: offset, animation: false });
        } else {
          // Native List's top edge includes contentStartOffset; scrollTo(0)
          // would remove the clearance on first entry. Saved signed offsets
          // retain partial scrolling through that clearance on route return.
          this.shelfScroller.scrollEdge(Edge.Top);
        }
        this.viewportRestored = true;
        this.publishVisibleReadingBooks();
        this.restoreDetailReturnFocus(generation);
        return;
      }
      const item = anchor + this.shelfHeaderItems();
      this.firstVisibleItem = item;
      this.shelfScroller.scrollToIndex(item, false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
        if (!this.isShelfPresentationCurrent(navigation) || generation !== this.viewportRestoreGeneration) return;
        try { this.shelfScroller.scrollBy(0, this.shelfScroller.getItemRect(item).y - itemY); }
        catch (_error) { /* A concurrent removal may discard the saved anchor. */ }
        this.viewportRestored = true;
        this.publishVisibleReadingBooks();
        this.restoreDetailReturnFocus(generation);
      }));
    }));
  }

  private onScrollToTopRequested(): void {
    if (!this.mounted || this.scrollToTopToken <= 0) return;
    this.viewState.anchorKey = '';
    this.viewState.anchorCaptured = false;
    this.viewState.anchorOffset = 0;
    try {
      this.shelfScroller.scrollEdge(Edge.Top);
    } catch (_error) { /* The List may not be attached during a route swap. */ }
  }

  @Builder
  private filterPanel(navigation: number) {
    // Scroll measures its content with an unbounded vertical constraint even
    // when the viewport is zero high. It is only a clip host: users cannot
    // scroll it. One live content tree therefore supplies the current height
    // after wrapping, window and font changes without a duplicate measure tree.
    Scroll() {
      Column() {
        this.filterRow(navigation);
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CONTROL_INLINE })
      .opacity(this.filterContentOpacity)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        this.onFilterContentMeasured(readerPageAreaLength(newValue.height));
      });
    }
    .width('100%')
    .height(this.filterPanelHeight)
    .align(Alignment.Top)
    .scrollable(ScrollDirection.Vertical)
    .enableScrollInteraction(false)
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.None)
    .clip(true)
    .enabled(this.filterRowVisible)
    .focusable(false)
    .accessibilityLevel(this.filterRowVisible ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(this.filterRowVisible ? HitTestMode.Default : HitTestMode.None);
  }

  private onFilterContentMeasured(height: number): void {
    if (!this.mounted || !Number.isFinite(height) || height <= 0 ||
      Math.abs(height - this.filterNaturalHeight) < 0.01) return;
    this.filterNaturalHeight = height;
    if (!this.filterRowVisible) return;
    if (this.filterMotionRunning && !this.reduceMotion) this.animateFilterPanel();
    else this.filterPanelHeight = height;
  }

  private setFilterExpanded(expanded: boolean, navigation: number): void {
    if (!this.isShelfPresentationCurrent(navigation) || !this.feedbackEnabled ||
      !this.isCurrentShelfInput(navigation) || expanded === this.filterRowVisible) return;
    this.filterRowVisible = expanded;
    this.viewState.filterExpanded = expanded;
    if (this.reduceMotion) this.settleFilterPanel();
    else this.animateFilterPanel();
  }

  private animateFilterPanel(): void {
    const generation = ++this.filterMotionGeneration;
    const expanded = this.filterRowVisible;
    this.filterMotionRunning = true;
    const context = this.getUIContext();
    context.animateTo(motionAnimateParam(expanded ? 'bookshelf.filter.expand' : 'bookshelf.filter.collapse', (): void => {
      if (this.mounted && generation === this.filterMotionGeneration) this.filterMotionRunning = false;
    }), (): void => { this.filterPanelHeight = expanded ? this.filterNaturalHeight : 0; });
    context.animateTo(motionAnimateParam(expanded ? 'bookshelf.filter.content.in' : 'bookshelf.filter.content.out'),
      (): void => { this.filterContentOpacity = expanded ? 1 : 0; });
  }

  private settleFilterPanel(): void {
    const generation = ++this.filterMotionGeneration;
    const expanded = this.filterRowVisible;
    this.filterMotionRunning = true;
    if (expanded) this.filterPanelHeight = this.filterNaturalHeight;
    this.getUIContext().animateTo(readerMotionReducedFadeParam((): void => {
      if (!this.mounted || generation !== this.filterMotionGeneration) return;
      if (!expanded) this.filterPanelHeight = 0;
      this.filterMotionRunning = false;
    }), (): void => { this.filterContentOpacity = expanded ? 1 : 0; });
  }

  /** PH60: view-only state/type conditions; grouping and updates have separate owners. */
  @Builder
  private filterRow(navigation: number) {
    Column({ space: 4 }) {
      Row({ space: TOK_SPACE_MD }) {
        Text('筛选').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('清除').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .constraintSize({ minHeight: 28 }).textAlign(TextAlign.Center);
        }.padding(0)
          .constraintSize({ minWidth: 44, minHeight: 44 }).enabled(this.hasActiveFilters()).opacity(this.hasActiveFilters() ? 1 : 0.5)
          .attributeModifier(new ReaderActionAccessibility('清除内容类型和来源筛选', this.hasActiveFilters(), false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 22, 22, this.hasActiveFilters()), 'nativeButton'))
          .onClick((): void => this.clearFilters(navigation));
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('收起').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .constraintSize({ minHeight: 28 }).textAlign(TextAlign.Center);
        }.padding(0)
          .constraintSize({ minWidth: 44, minHeight: 44 })
          .attributeModifier(new ReaderActionAccessibility('收起筛选', true, false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 22), 'nativeButton'))
          .onClick((): void => this.setFilterExpanded(false, navigation));
      }.width('100%');
      Text('内容类型').width('100%').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('content', 'all', '全部', navigation);
        this.filterChip('content', 'text', '小说', navigation);
        this.filterChip('content', 'manga', '漫画', navigation);
      }.width('100%');
      Text('来源').width('100%').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('source', 'all', '全部', navigation);
        this.filterChip('source', 'local', '本地', navigation);
        this.filterChip('source', 'online', '在线', navigation);
      }.width('100%');
    }.width('100%');
  }

  @Builder
  private filterChip(dimension: string, value: string, label: string, navigation: number) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row() {
      Text(label)
        .fontFamily(TYPE_SHELF_FILTER_LABEL.fontFamily).fontWeight(TYPE_SHELF_FILTER_LABEL.fontWeight)
        .fontSize(TYPE_SHELF_FILTER_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_FILTER_LABEL.lineHeightFp as number)
        .fontColor(this.isFilterSelected(dimension, value) ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .constraintSize({ maxWidth: 136 }).textAlign(TextAlign.Center);
      }.justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
        .constraintSize({ maxWidth: 160, minHeight: 32 }).padding({ left: 12, right: 12, top: 5, bottom: 5 })
        .backgroundColor(readerPressSurface(readerAppColor(this.isFilterSelected(dimension, value) ? 'TOK_PRIMARY_DARK' : 'TOK_CARD_BG', this.appThemeScheme),
          this.appThemeScheme, this.shelfPressed(`filter:${dimension}:${value}`), this.reduceMotion))
        .border({ width: TOK_BORDER_W, color: readerAppColor(this.isFilterSelected(dimension, value) ? 'TOK_PRIMARY_DARK' : 'TOK_BORDER', this.appThemeScheme) })
        .borderRadius(999).scale(readerPressScale(this.shelfPressed(`filter:${dimension}:${value}`), this.reduceMotion))
        .opacity(readerPressOpacity(this.shelfPressed(`filter:${dimension}:${value}`), this.reduceMotion));
    }.padding(0).backgroundColor(Color.Transparent)
      .id(`reader-bookshelf-filter-${dimension}-${value}`)
      .margin({ right: TOK_SPACE_XS / 2, bottom: TOK_SPACE_XS / 2 })
      .constraintSize({ maxWidth: 160, minWidth: 44, minHeight: 44 })
      .attributeModifier(new ReaderActionAccessibility(`${dimension === 'content' ? '内容类型' : '来源'}：${label}`, true, this.isFilterSelected(dimension, value), true, undefined, 'nativeButton'))
      .onTouch((event: TouchEvent): void => this.observeShelfPress(event, `filter:${dimension}:${value}`))
      .onClick((): void => this.selectFilter(dimension, value, navigation));
  }

  private isFilterSelected(dimension: string, value: string): boolean {
    return (dimension === 'content' ? this.contentFilter : this.sourceFilter) === value;
  }

  private hasActiveFilters(): boolean {
    return this.contentFilter !== 'all' || this.sourceFilter !== 'all';
  }

  private selectFilter(dimension: string, value: string, navigation: number): void {
    if (!this.isShelfPresentationCurrent(navigation) || !this.feedbackEnabled || !this.isCurrentShelfInput(navigation)) return;
    if (dimension === 'content') this.contentFilter = value;
    else this.sourceFilter = value;
    this.queueShelfProjection();
  }

  private clearFilters(navigation: number): void {
    if (!this.isShelfPresentationCurrent(navigation) || !this.feedbackEnabled || !this.isCurrentShelfInput(navigation)) return;
    this.contentFilter = 'all';
    this.sourceFilter = 'all';
    this.queueShelfProjection();
  }

  private onShelfFiltersChanged(): void {
    if (this.actionBook !== undefined && this.currentVisibleBook(this.actionBook) === undefined)
      this.dismissBookActionSheet(this.actionSheetId, this.actionBook);
    this.queueShelfProjection();
    if (!this.mounted || !this.serverFiltered || this.filterPublicationQueued) return;
    this.filterPublicationQueued = true;
    const generation = this.projectionGeneration;
    const navigation = this.navigationGeneration;
    void Promise.resolve().then((): void => {
      if (generation !== this.projectionGeneration) return;
      this.filterPublicationQueued = false;
      if (this.isShelfPresentationCurrent(navigation))
        this.onFilterRequested('all', this.sourceFilter, this.contentFilter, navigation);
    });
  }

  private queueShelfProjection(): void {
    if (!this.mounted || this.projectionQueued) return;
    this.projectionQueued = true;
    const generation = this.projectionGeneration;
    // StorageLink watchers and one user gesture can update several conditions.
    // Publish only the final combination once, without a timer/frame delay.
    void Promise.resolve().then((): void => {
      if (!this.mounted || generation !== this.projectionGeneration) return;
      this.projectionQueued = false;
      this.rebuildShelfProjection();
    });
  }

  @Builder
  private projectionRow(row: ShelfBook[], expandedLayout: boolean, rowIndex: () => number) {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach(row, (book: ShelfBook, columnIndex: number) => {
        this.projectionBookCard(book, expandedLayout, (): number => rowIndex() * bookshelfColumnCount(expandedLayout) + columnIndex, columnIndex);
      }, (book: ShelfBook): string => `${book.sourceId}:${book.bookId}`);
    }
    .width(this.shelfContentWidth(expandedLayout))
    .height(this.projectionRowHeight(row, expandedLayout, rowIndex() * bookshelfColumnCount(expandedLayout)))
    // The native no-expand child range can expose only the first generated
    // card of this ForEach row. Publish the already-mounted card and cover
    // actors by their stable ids so the developer scanner can resolve every
    // column and the cover boundary at each column.
    .customProperty('readerLayoutDebugMountedIds',
      this.layoutDebugMountedIds(row));
  }

  private layoutDebugMountedIds(row: ShelfBook[]): string {
    const ids: string[] = [];
    for (const book of row) {
      ids.push(this.bookActionFocusKey(book, false));
      ids.push(this.bookCoverMotionId(book));
    }
    return JSON.stringify(ids);
  }

  /**
   * A book card is mounted once and survives both projections. The outer actor
   * owns the grid/list position; the cover child owns scale and corner radius.
   * Only the local text layers cross-fade. This is the Figma G/H shared-element
   * contract and avoids ArkUI's non-animated conditional-subtree replacement.
   */
  @Builder
  private projectionBookCard(
    book: ShelfBook,
    expandedLayout: boolean,
    index: () => number,
    columnIndex: number,
  ) {
    Stack({ alignContent: Alignment.TopStart }) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width('100%').height('100%')
        .backgroundColor(readerPressSurface(readerAppColor('TOK_CARD_BG', this.appThemeScheme), this.appThemeScheme,
          this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(14)
        .shadow(readerSurfaceElevation('card', this.appThemeScheme))
        .opacity(this.projectionDetailsOpacity('list', index()))
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      this.projectionBookCover(book, expandedLayout, index);
      this.projectionGridDetails(book, expandedLayout, index);
      this.projectionListDetails(book, expandedLayout, index);
      Row().width('100%').height('100%').borderRadius(14)
        .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme,
          this.viewMode === 'cover' && this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }.width('100%').height('100%')
      .scale(readerPressScale(this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
      .opacity(readerPressOpacity(this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
      ;
    }
    .width(this.projectionBookWidth(expandedLayout, index()))
    .height(this.projectionBookHeight(book, expandedLayout, index()))
    .translate({
      x: this.projectionBookTranslateX(columnIndex, expandedLayout, index()),
      y: this.projectionBookTranslateY(columnIndex, expandedLayout, index()),
    })
    .id(this.bookActionFocusKey(book, false))
    .attributeModifier(new ReaderActionAccessibility(`${book.title}，${book.author}，${this.gridProgressLabel(book)}` +
      ((book.unreadCount ?? 0) > 0 ? `，更新 ${book.unreadCount} 章` : '')))
    .onTouch((event: TouchEvent): void => this.observeShelfPress(event, this.bookActionFocusKey(book, false)))
    .onClick(this.bookSelectionHandler((): ShelfBook => book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction(this.bookActionPresentationHandler(book, false)),
    );
  }

  @Builder
  private projectionBookCover(book: ShelfBook, expandedLayout: boolean, index: () => number) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCoverLayer(book, expandedLayout, false, index);
      this.projectionBookCoverLayer(book, expandedLayout, true, index);
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
    .id(this.bookCoverMotionId(book))
    .backgroundColor(readerAppColor('TOK_META_BG', this.appThemeScheme))
    .borderRadius(this.projectionCoverRadius(expandedLayout, index()))
    .shadow(readerSurfaceElevation(this.hasCover(book) ? 'cover' : 'embedded', this.appThemeScheme))
    .scale({
      x: this.projectionCoverScale(expandedLayout, index()),
      y: this.projectionCoverScale(expandedLayout, index()),
      centerX: '50%',
      centerY: '50%',
    })
    .translate({
      x: this.projectionCoverCompensationX(expandedLayout, index()),
      y: this.projectionCoverCompensationY(expandedLayout, index()),
    })
    .zIndex(4)
    // Both cover layers are visual actors. The enclosing card alone owns
    // click/long press; None alone would still hit the Image descendants.
    .enabled(false)
    .hitTestBehavior(HitTestMode.None);
  }

  /**
   * Keep the shared morph actor above a continuously opaque destination cover.
   * Both have the same parent transform, so fading the lower cover with the
   * incoming text would expose the shelf when the upper actor hands off.
   */
  @Builder
  private projectionBookCoverLayer(book: ShelfBook, expandedLayout: boolean, morphLayer: boolean, index: () => number) {
    Stack({ alignContent: Alignment.TopEnd }) {
      if (this.hasCover(book)) {
        Image(this.coverUrl(book) as string)
          .width(this.shelfBookCardWidth(expandedLayout))
          .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
          .objectFit(ImageFit.Cover)
          .borderRadius(this.projectionCoverRadius(expandedLayout, index()))
          .onError(this.coverErrorHandler(this.coverUrl(book)));
      } else {
        NoCoverCover({
          coverWidth: this.shelfBookCardWidth(expandedLayout),
          coverHeight: this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout),
          glyph: noCoverGlyph(book.title),
          kindLabel: ShelfBookPresentation.contentLabel(book),
        });
      }
      if ((book.unreadCount ?? 0) > 0) {
        Row() {
          Text(`更新 ${book.unreadCount} 章`)
            .fontFamily(TYPE_SHELF_UPDATE_BADGE.fontFamily)
            .fontWeight(TYPE_SHELF_UPDATE_BADGE.fontWeight)
            .fontSize(TYPE_SHELF_UPDATE_BADGE.fontSizeFp)
            .lineHeight(TYPE_SHELF_UPDATE_BADGE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).textAlign(TextAlign.Center)
            .constraintSize({ maxWidth: Math.max(0, this.shelfBookCardWidth(expandedLayout) - 28) });
        }
          .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
          .constraintSize({ maxWidth: Math.max(0, this.shelfBookCardWidth(expandedLayout) - 14) })
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(Math.min(Math.max(0, this.shelfBookCardWidth(expandedLayout) - 14),
            (TYPE_SHELF_UPDATE_BADGE.lineHeightFp as number) * this.continueCardFontScale() + 6) / 2)
          .margin({ top: 7, right: 7 })
          .opacity(this.viewSwitchGridContentOpacity);
      }
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
    .linearGradient({
      angle: 141.7,
      colors: this.hasCover(book) ?
        [[readerAppColor('TOK_PRIMARY_GRADIENT_START', this.appThemeScheme), 0.077],
          [readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 0.923]] :
        [[readerAppColor('TOK_META_BG', this.appThemeScheme), 0],
          [readerAppColor('TOK_META_BG', this.appThemeScheme), 1]],
    })
    .borderRadius(this.projectionCoverRadius(expandedLayout, index()))
    .clip(true)
    // Alpha belongs to the complete cover, including the fallback's paper,
    // rules and text. Otherwise the fading paper can cover the lower text
    // before its own fading glyphs draw. Keep this group stable at rest too.
    .renderGroup(true)
    .opacity(this.projectionCoverLayerOpacity(morphLayer))
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private projectionGridDetails(book: ShelfBook, expandedLayout: boolean, index?: () => number) {
    Column({ space: BOOKSHELF_GRID_TEXT_GAP }) {
      Text(book.title)
        .width(this.shelfBookCardWidth(expandedLayout))
        .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_TITLE.lineHeightFp}fp`)
        .letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(BOOKSHELF_GRID_TITLE_LINES)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(book.author)
        .width(this.shelfBookCardWidth(expandedLayout))
        .fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_AUTHOR.lineHeightFp}fp`)
        .letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.gridProgressLabel(book).length > 0) {
        Text(this.gridProgressLabel(book))
          .width(this.shelfBookCardWidth(expandedLayout))
          .fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
          .fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight)
          .fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp)
          .lineHeight(`${TYPE_SHELF_LIST_STATUS.lineHeightFp}fp`)
          .letterSpacing(TYPE_SHELF_LIST_STATUS.letterSpacingFp)
          .fontColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .alignItems(HorizontalAlign.Start)
    .translate({ y: this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout) + BOOKSHELF_GRID_TEXT_GAP })
    .opacity(this.projectionDetailsOpacity('cover', index?.()))
    .accessibilityLevel(this.viewMode === 'cover' ? 'auto' : 'no-hide-descendants')
    .enabled(this.viewMode === 'cover')
    .hitTestBehavior(this.viewMode === 'cover' ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private projectionListDetails(book: ShelfBook, expandedLayout: boolean, index?: () => number) {
    Row() {
      ShelfBookListDetails({
        book, textFrame: this.listTextFrame(expandedLayout), targetHeight: this.listContentHeight(expandedLayout),
        moreFocusId: this.bookActionFocusKey(book, true), moreAccessibilityLabel: `${book.title}更多操作`,
        moreEnabled: this.viewMode === 'list', onMore: this.bookActionPresentationHandler(book, true),
      });
    }
    .width(this.projectionListDetailsWidth(expandedLayout))
    .height(this.listContentHeight(expandedLayout))
    .translate({
      x: BOOKSHELF_LIST_CARD_PADDING + this.listCoverWidth(expandedLayout) + BOOKSHELF_LIST_DETAILS_GAP,
      y: BOOKSHELF_LIST_CARD_PADDING,
    })
    .opacity(this.projectionDetailsOpacity('list', index?.()))
    // None skips only this Row. Disable its retained More button whenever the
    // list projection is hidden so it cannot intercept a neighboring cover.
    .accessibilityLevel(this.viewMode === 'list' ? 'auto' : 'no-hide-descendants')
    .enabled(this.viewMode === 'list')
    .hitTestBehavior(this.viewMode === 'list' ? HitTestMode.Default : HitTestMode.None);
  }



  private presentBookActionSheet(book: ShelfBook, navigation: number, focusTarget: string): void {
    if (!this.shelfInput.isCurrent(navigation) || this.actionBook !== undefined ||
      this.currentVisibleBook(book) === undefined) return;
    this.actionSheetId = `bookshelf-action:${++this.actionSheetRevision}`;
    this.actionSheetNavigation = navigation;
    this.actionSheetFocusTarget = focusTarget;
    this.pendingBookAction = undefined;
    this.actionBook = book;
    this.bookActionSheetVisible = true;
  }

  private isCurrentBookActionSheet(presentationId: string, book: ShelfBook | undefined): boolean {
    // Builder arguments unwrap State proxies; the opening and compound book
    // identity own this callback across both representations.
    return this.mounted && this.bookActionSheetVisible && this.actionSheetNavigation === this.navigationGeneration && presentationId.length > 0 && presentationId === this.actionSheetId &&
      book !== undefined && this.actionBook !== undefined && this.actionBook.sourceId === book.sourceId &&
      this.actionBook.bookId === book.bookId && this.currentVisibleBook(book) !== undefined;
  }

  private dismissBookActionSheet(presentationId: string, book: ShelfBook | undefined): void {
    if (!this.mounted || presentationId.length === 0 || presentationId !== this.actionSheetId ||
      book === undefined || this.actionBook === undefined || this.actionBook.sourceId !== book.sourceId || this.actionBook.bookId !== book.bookId) return;
    this.pendingBookAction = undefined;
    this.bookActionSheetVisible = false;
  }

  private finishBookActionSheet(presentationId: string, book: ShelfBook | undefined): void {
    if (!this.mounted || presentationId.length === 0 || presentationId !== this.actionSheetId ||
      book === undefined || this.actionBook === undefined || this.actionBook.sourceId !== book.sourceId || this.actionBook.bookId !== book.bookId) return;
    const action = this.pendingBookAction;
    const navigation = this.actionSheetNavigation;
    const focusTarget = this.actionSheetFocusTarget;
    const revision = this.actionSheetRevision;
    this.pendingBookAction = undefined;
    this.bookActionSheetVisible = false;
    this.actionBook = undefined;
    this.actionSheetId = '';
    this.actionSheetNavigation = 0;
    this.actionSheetFocusTarget = undefined;
    if (this.actionSheetChromeId === presentationId) {
      this.actionSheetChromeId = '';
      if (this.isCurrentChromeHost(this.navigationGeneration)) ReaderWindowCoordinator.requestAppChrome();
    }
    if (navigation !== this.navigationGeneration) return;
    if (action !== undefined) action();
    else if (focusTarget !== undefined) this.restoreBookActionFocus(book, focusTarget, navigation, revision);
  }

  private cancelBookActionFocus(): void {
    this.detailReturnFocus = undefined;
    this.bookActionFocusRevision += 1;
  }

  private restoreDetailReturnFocus(viewport: number): void {
    const origin = this.detailReturnFocus;
    this.detailReturnFocus = undefined;
    if (origin === undefined) return;
    const book = this.books.find((candidate: ShelfBook): boolean =>
      candidate.sourceId === origin.sourceId && candidate.bookId === origin.bookId);
    const target = book === undefined ? '' : this.bookActionFocusKey(book, origin.listMore);
    this.restoreBookActionFocus(book, target, this.navigationGeneration, this.actionSheetRevision, viewport);
  }

  private restoreBookActionFocus(book: ShelfBook | undefined, target: string, navigation: number, revision: number,
    viewport?: number): void {
    const focusRevision = this.bookActionFocusRevision;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new BookshelfBookActionFocusFrame((): void => {
        if (!this.shelfInput.isCurrent(navigation) ||
          this.actionSheetRevision !== revision || this.bookActionFocusRevision !== focusRevision || this.actionBook !== undefined ||
          (viewport !== undefined && (!this.viewportRestored || viewport !== this.viewportRestoreGeneration))) return;
        const focus = context.getFocusController();
        if (book !== undefined && (target !== this.bookActionFocusKey(book, true) || this.viewMode === 'list') &&
          this.books.some((candidate: ShelfBook): boolean => candidate.sourceId === book.sourceId && candidate.bookId === book.bookId)) {
          try {
            if (context.getFrameNodeById(target) !== null) {
              focus.requestFocus(target);
              return;
            }
          } catch (_unavailableTarget) {}
        }
        try { focus.requestFocus('reader-bookshelf-search-entry'); } catch (_unavailableFallback) {}
      }));
    } catch (_detached) {}
  }

  private performBookAction(presentationId: string, book: ShelfBook | undefined,
    action: (book: ShelfBook, navigation?: number, focusTarget?: string) => void): void {
    if (!this.isCurrentBookActionSheet(presentationId, book) || !this.isCurrentShelfInput(this.actionSheetNavigation) ||
      book === undefined) return;
    const navigation = this.actionSheetNavigation;
    const focusTarget = this.actionSheetFocusTarget;
    this.pendingBookAction = (): void => {
      const current = this.currentVisibleBook(book);
      if (current !== undefined && this.shelfInput.isCurrent(navigation))
        action(current, navigation, focusTarget);
    };
    // The keyed presentation and selected book remain owned until the exit.
    this.bookActionSheetVisible = false;
  }

  private phoneContentWidth(): number {
    return this.phoneContentFrame().width;
  }

  private shelfContentWidth(expandedLayout: boolean): number {
    if (!expandedLayout) {
      return this.phoneContentWidth();
    }
    return this.tabletContentFrame().width;
  }

  private phoneContentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) return new SurfaceHorizontalFrame(0, 0, 0);
    return this.contentGeometry(false).content.frame;
  }

  private tabletContentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) return new SurfaceHorizontalFrame(0, 0, 0);
    return this.contentGeometry(true).content.frame;
  }

  private contentGeometry(expandedLayout: boolean): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.effectiveViewportWidth();
    input.headerHeight = this.headerBottom;
    input.contentGap = bookshelfHeaderSpec().contentGap;
    input.contentUnderlap = bookshelfHeaderSpec().contentUnderlap;
    input.contentEndInset = this.shelfContentEndValue();
    input.contentMaxWidth = expandedLayout ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
    input.contentLeftGap = expandedLayout ?
      (this.railActive() ? readerMainRailContentLeft() : TOK_SCREEN_INSET) : TOK_SCREEN_INSET;
    input.contentRightGap = expandedLayout ?
      (this.railActive() ? readerMainRailContentRight() : TOK_SCREEN_INSET) : TOK_SCREEN_INSET;
    return resolveReaderPageGeometry(input);
  }

  private navigationMode(): MainNavigationMode {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision, this.readerWindowMetricsRevision);
  }

  private railActive(): boolean {
    return this.navigationMode() === 'rail';
  }

  private pageGeometry(): ReaderPageGeometry {
    return this.contentGeometry(this.isWideViewport());
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private shelfContentStartInset(): number {
    return this.scrollLayout().startInset;
  }

  private shelfHeaderClearance(): number {
    return this.pageGeometry().header.clearance;
  }

  private shelfFirstItemPadding(): number {
    const spec = bookshelfHeaderSpec();
    return spec.contentGap + spec.contentUnderlap;
  }

  private shelfContentEndInset(): number {
    return this.scrollLayout().endInset;
  }

  private shelfContentEndValue(): number {
    if (this.readerWindowMetricsRevision < 0) return TOK_SPACE_MD;
    const metrics = ReaderWindowCoordinator.metrics();
    return this.isWideViewport() && this.railActive()
      ? Math.max(24, readerFloatingBarBottomInset(metrics, TOK_SPACE_MD))
      : readerFloatingTabContentInset(metrics, this.measuredFooterHeight);
  }

  private resolveContentFrame(spec: SurfaceWidthSpec): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      this.effectiveViewportWidth(),
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      spec,
    );
  }

  private effectiveViewportWidth(): number {
    if (this.paneWidth > 0) return this.paneWidth;
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    return readerMainViewport(this.mainViewportRevision).width;
  }

  private isWideViewport(): boolean {
    return readerIsExpandedWidth(this.effectiveViewportWidth());
  }

  private listCoverWidth(_expandedLayout: boolean): number {
    return BOOKSHELF_LIST_COVER_WIDTH;
  }

  private listCoverHeight(expandedLayout: boolean): number {
    return bookshelfCoverHeight(this.listCoverWidth(expandedLayout), expandedLayout);
  }

  private prepareListTextFonts(): void {
    const generation = ++this.listTextFontGeneration;
    void prepareBookshelfListTextFonts().then((): void => {
      if (this.mounted && generation === this.listTextFontGeneration) this.listTextFontRevision += 1;
    }).catch((): void => {});
  }

  private listTextFrame(expandedLayout: boolean): BookshelfListTextFrame {
    const width = this.projectionListDetailsWidth(expandedLayout);
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return this.listTextBudget.resolve(this.getUIContext(), width, scale, this.listTextFontRevision);
  }

  private listContentHeight(expandedLayout: boolean): number {
    return Math.max(BOOKSHELF_LIST_COVER_HEIGHT, this.listTextFrame(expandedLayout).height);
  }

  private listRowHeight(expandedLayout: boolean): number {
    return this.listContentHeight(expandedLayout) + 2 * BOOKSHELF_LIST_CARD_PADDING;
  }





  /** Grid hides the unread caption; the shared whole-book projection owns
   * basis-point normalization, bounds and the positive sub-1% label. */
  private gridProgressLabel(book: ShelfBook): string {
    return ShelfBookPresentation.progress(book, 'grid-caption');
  }

  private shelfBookCardWidth(expandedLayout: boolean): number {
    return this.bookCardWidth(this.shelfContentWidth(expandedLayout), expandedLayout);
  }

  private bookCardWidth(contentWidth: number, expandedLayout: boolean): number {
    return bookshelfGridFrame(contentWidth, expandedLayout).cardWidth;
  }

  private bookCardHeight(cardWidth: number, expandedLayout: boolean): number {
    return bookshelfCoverHeight(cardWidth, expandedLayout);
  }

  private bookRowSpace(contentWidth: number, expandedLayout: boolean): number {
    return bookshelfGridFrame(contentWidth, expandedLayout).columnGap;
  }

  private onShelfPresentationChanged(): void {
    if (!this.mounted) return;
    this.resetFileDropHover();
    this.resetShelfPress();
    // Props update the retained page; revoke only its temporary Sheet.
    this.dismissBookActionSheet(this.actionSheetId, this.actionBook);
    this.cancelBookActionFocus();
    this.detailReturnFocus = this.takeDetailReturnFocus(this.navigationGeneration);
    this.headerScrollPublishedNavigation = -1;
    if (!this.viewportRestored) {
      this.restoreShelfViewport();
      return;
    }
    this.publishVisibleReadingBooks();
    this.scheduleContinueCardMeasurement();
    this.restoreDetailReturnFocus(this.viewportRestoreGeneration);
  }

  private continueCardBookKey(): string {
    const book = this.continueReading;
    return book === undefined ? '' : JSON.stringify([book.sourceId, book.bookId]);
  }

  private continueCardRectId(): string {
    return `reader.bookshelf.continue-card:${this.navigationGeneration}:${this.continueCardBookKey()}`;
  }

  private continueCardRectIdentity(): ReaderSurfaceRectIdentity {
    return { route: 'bookshelf', owner: `continue-card:${this.continueCardBookKey()}`,
      generation: this.navigationGeneration };
  }

  private onContinueReadingChanged(): void {
    if (!this.mounted) return;
    if (this.continueCardBookKey() !== this.continueCardPublishedKey) this.publishContinueCardRect(undefined);
    this.scheduleContinueCardMeasurement();
  }

  private publishContinueCardRect(rect: ReaderSurfaceRect | undefined): void {
    const navigation = this.navigationGeneration;
    const key = this.continueCardBookKey();
    const previous = this.continueCardPublishedRect;
    const sameRect = previous === undefined ? rect === undefined : rect !== undefined &&
      Math.abs(previous.x - rect.x) < 0.1 && Math.abs(previous.y - rect.y) < 0.1 &&
      Math.abs(previous.width - rect.width) < 0.1 && Math.abs(previous.height - rect.height) < 0.1;
    if (navigation === this.continueCardPublishedNavigation && key === this.continueCardPublishedKey && sameRect) return;
    this.continueCardPublishedNavigation = navigation;
    this.continueCardPublishedKey = key;
    this.continueCardPublishedRect = rect;
    this.onContinueCardRect(rect, navigation, key);
  }

  /** The card's real layout bounds are separate from the cover flight origin.
   * Read a settled native frame, including scroll translation, and report vp
   * window coordinates to Index. Suppression keeps this layout measurable. */
  private scheduleContinueCardMeasurement(): void {
    if (!this.mounted || !this.viewportRestored) return;
    this.scheduleHeaderScrollMeasurement();
    const navigation = this.navigationGeneration;
    const key = this.continueCardBookKey();
    if (key.length === 0) { this.publishContinueCardRect(undefined); return; }
    const request = JSON.stringify([navigation, key]);
    if (request === this.continueCardMeasureQueued) return;
    this.continueCardMeasureQueued = request;
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (this.continueCardMeasureQueued !== request) return;
      this.continueCardMeasureQueued = '';
      if (!this.isShelfPresentationCurrent(navigation) || key !== this.continueCardBookKey() || !this.viewportRestored) return;
      const context = this.getUIContext();
      const local = readerMeasureSurfaceRect(context, this.continueCardRectId(), this.shelfViewportMotionId(),
        this.continueCardRectIdentity(), (): ReaderSurfaceRectIdentity => this.continueCardRectIdentity());
      if (local === undefined) { this.publishContinueCardRect(undefined); return; }
      try {
        const viewport = context.getFrameNodeById(this.shelfViewportMotionId());
        if (viewport === null) { this.publishContinueCardRect(undefined); return; }
        const bounds = context.getComponentUtils().getRectangleById(this.shelfViewportMotionId());
        const height = context.px2vp(bounds.size.height);
        if (local.y + local.height <= this.shelfHeaderClearance() ||
          local.y >= height - this.shelfContentEndInset()) {
          this.publishContinueCardRect(undefined); return;
        }
        const position = viewport.getPositionToWindowWithTransform();
        if (!this.isShelfPresentationCurrent(navigation) || key !== this.continueCardBookKey()) return;
        this.publishContinueCardRect({ x: local.x + position.x, y: local.y + position.y,
          width: local.width, height: local.height });
      } catch (_error) { this.publishContinueCardRect(undefined); }
    }));
  }

  private isShelfPresentationCurrent(navigation: number): boolean {
    return this.mounted && navigation === this.navigationGeneration;
  }

  private bookCoverMotionId(book: ShelfBook): string {
    return `reader.bookshelf.cover:${this.navigationGeneration}:shelf:${JSON.stringify([book.sourceId, book.bookId])}`;
  }

  private shelfViewportMotionId(): string {
    return `reader.bookshelf.viewport:${this.navigationGeneration}`;
  }

  private measureBookOrigin(book: ShelfBook): ReaderSurfaceRect | undefined {
    if (!this.mounted || this.viewSwitchRunning || this.reduceMotion) return undefined;
    try {
      const context = this.getUIContext();
      const id = this.bookCoverMotionId(book);
      const node = context.getFrameNodeById(id);
      const viewport = context.getFrameNodeById(this.shelfViewportMotionId());
      if (node === null || viewport === null) return undefined;
      const cover = context.getComponentUtils().getRectangleById(id);
      const list = context.getComponentUtils().getRectangleById(this.shelfViewportMotionId());
      // ComponentInfo.size is px before drawing scale; transformed FrameNode
      // positions are vp and include the parent card's projection translation.
      const position = node.getPositionToWindowWithTransform();
      const bounds = viewport.getPositionToWindowWithTransform();
      const width = context.px2vp(cover.size.width) * cover.scale.x;
      const height = context.px2vp(cover.size.height) * cover.scale.y;
      const viewportWidth = context.px2vp(list.size.width);
      const viewportHeight = context.px2vp(list.size.height);
      if (![position.x, position.y, width, height, bounds.x, bounds.y, viewportWidth, viewportHeight]
        .every((value: number): boolean => Number.isFinite(value)) || width <= 0 || height <= 0) return undefined;
      const expanded = this.isWideViewport();
      const coverWidth = this.viewMode === 'list' ? this.listCoverWidth(expanded) : this.shelfBookCardWidth(expanded);
      const coverHeight = this.viewMode === 'list' ? this.listCoverHeight(expanded) : this.bookCardHeight(coverWidth, expanded);
      if (Math.abs(width - coverWidth) > 2 || Math.abs(height - coverHeight) > 2 ||
        Math.abs(viewportWidth - this.shelfContentWidth(expanded)) > 2) return undefined;
      // Rank only fully visible covers, excluding the header and floating navigation.
      if (position.x < bounds.x - 0.5 || position.x + width > bounds.x + viewportWidth + 0.5 ||
        position.y < bounds.y + this.shelfHeaderClearance() - 0.5 ||
        position.y + height > bounds.y + viewportHeight - this.shelfContentEndInset() + 0.5) return undefined;
      return { x: position.x, y: position.y, width, height };
    } catch (_error) {
      // Lazy rows may be unavailable when the view switch begins.
      return undefined;
    }
  }

  private bookSelectionHandler(provider: () => ShelfBook | undefined, continuing: boolean = false): () => void {
    return (): void => {
      const navigation = this.shelfInput.begin();
      if (navigation === undefined || this.actionBook !== undefined) return;
      const snapshot = provider();
      const book = snapshot === undefined || continuing ? snapshot : this.currentVisibleBook(snapshot);
      if (book === undefined) return;
      this.saveShelfViewport();
      this.onBookSelected(book, navigation);
    };
  }

  private bookActionFocusKey(book: ShelfBook, listMore: boolean, navigation: number = this.navigationGeneration): string {
    return `reader-shelf-book-action:${JSON.stringify([navigation, book.sourceId, book.bookId, listMore])}`;
  }

  private bookActionPresentationHandler(book: ShelfBook, listMore: boolean): () => void {
    return (): void => {
      const navigation = this.shelfInput.begin();
      if (navigation === undefined || (listMore && this.viewMode !== 'list')) return;
      // Retained cards keep their visual identity across group-only refreshes.
      // Resolve the action's current DTO instead of retaining its old group.
      const current = this.currentVisibleBook(book);
      if (current !== undefined) {
        this.presentBookActionSheet(current, navigation, this.bookActionFocusKey(current, listMore, navigation));
      }
    };
  }

  private shelfPageHandler(previous: boolean): () => void {
    return (): void => {
      const navigation = this.shelfInput.begin();
      if (navigation === undefined) return;
      if (previous) this.onPreviousPageRequested(navigation); else this.onNextPageRequested(navigation);
    };
  }

  private shelfScrollHandler(): (start: number, end: number) => void {
    return (start: number, end: number): void => {
      if (!this.mounted) return;
      if (Number.isFinite(end)) this.lastVisibleItem = end;
      const navigation = this.shelfInput.begin();
      if (!this.viewportRestored || navigation === undefined) return;
      this.firstVisibleItem = start;
      this.saveShelfViewport(); this.publishVisibleReadingBooks();
      if (start <= this.shelfHeaderItems() + 4) this.onPreviousPageRequested(navigation);
      if (start + 8 >= this.shelfHeaderItems() + this.rowDataSource.totalCount()) this.onNextPageRequested(navigation);
    };
  }

  private shelfViewportScrollHandler(): () => void {
    return (): void => {
      if (!this.viewportRestored || this.shelfInput.begin() === undefined) return;
      this.saveShelfViewport();
      this.scheduleContinueCardMeasurement();
    };
  }

  private publishHeaderScrolled(scrolled: boolean): void {
    if (!this.mounted) return;
    const navigation = this.navigationGeneration;
    if (navigation === this.headerScrollPublishedNavigation && scrolled === this.headerScrolled) return;
    this.headerScrollPublishedNavigation = navigation;
    this.headerScrolled = scrolled;
    this.onHeaderScrolledChanged(scrolled, navigation);
  }

  private scheduleHeaderScrollMeasurement(): void {
    if (!this.mounted || !this.viewportRestored) return;
    const navigation = this.navigationGeneration;
    const restoration = this.viewportRestoreGeneration;
    const request = JSON.stringify([navigation, restoration]);
    if (request === this.headerScrollFrameQueued) return;
    this.headerScrollFrameQueued = request;
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (this.headerScrollFrameQueued !== request) return;
      this.headerScrollFrameQueued = '';
      if (!this.isShelfPresentationCurrent(navigation) || !this.viewportRestored ||
        restoration !== this.viewportRestoreGeneration) return;
      if (this.firstVisibleItem > 0) { this.publishHeaderScrolled(true); return; }
      try {
        const first = this.shelfScroller.getItemRect(0);
        if (!Number.isFinite(first.y) || !Number.isFinite(first.height) || first.height <= 0) return;
        // P0 native sample: start=80 => item.y=80/offset=-80; scrollBy(8)
        // => item.y=72/offset=-72. Sample item position after layout settles.
        this.publishHeaderScrolled(this.shelfContentStartInset() - first.y > bookshelfHeaderSpec().scrollThreshold);
      } catch (_error) { /* Detached native List keeps its last published material. */ }
    }));
  }

  private onBooksChanged(): void {
    if (this.actionBook !== undefined && this.currentVisibleBook(this.actionBook) === undefined) {
      this.dismissBookActionSheet(this.actionSheetId, this.actionBook);
    }
    this.queueShelfProjection();
  }

  private rebuildShelfProjection(): void {
    const visible = this.projectedBooks();
    this.visibleBookCount = visible.length;
    const wide = this.isWideViewport();
    const regroup = this.projectedWideLayout !== wide;
    this.projectedWideLayout = wide;
    const columns = bookshelfColumnCount(wide);
    const rows: ShelfBook[][] = [];
    for (let index = 0; index < visible.length; index += columns) {
      rows.push(visible.slice(index, index + columns));
    }
    const oldFirst = this.rowDataSource.totalCount() > 0 ? this.rowDataSource.getData(0)[0] : undefined;
    const newFirst = rows.length > 0 ? rows[0][0] : undefined;
    const shifted = oldFirst !== undefined && newFirst !== undefined &&
      (oldFirst.sourceId !== newFirst.sourceId || oldFirst.bookId !== newFirst.bookId);
    const restore = (shifted || regroup) && this.mounted && this.viewportRestored && this.viewState.anchorKey.length > 0;
    // Native reload can synchronously report a new index. Fence that callback
    // before replacing rows so it cannot overwrite the old book/Y anchor.
    if (restore) this.viewportRestored = false;
    this.rowDataSource.replace(rows);
    if (restore) this.restoreShelfViewport();
    else this.publishVisibleReadingBooks();
  }

  private projectedBooks(): ShelfBook[] {
    return ShelfBookPresentation.visible(this.books, '', 'all', this.sourceFilter, this.contentFilter);
  }

  private currentFilterBookCount(): number {
    if (!this.serverFiltered) return this.visibleBookCount;
    if (this.sourceFilter !== this.projectedSourceFilter || this.contentFilter !== this.projectedContentFilter) return -1;
    return this.projectedBookCount;
  }

  private currentVisibleBook(book: ShelfBook): ShelfBook | undefined {
    return this.projectedBooks().find((candidate: ShelfBook): boolean =>
      candidate.sourceId === book.sourceId && candidate.bookId === book.bookId && candidate.addedAt === book.addedAt);
  }

  /** The displayed rows own preparation; scrolling replaces this fixed window. */
  private publishVisibleReadingBooks(): void {
    if (!this.mounted || !this.viewportRestored) return;
    this.scheduleContinueCardMeasurement();
    const books: ShelfBook[] = [];
    if (this.firstVisibleItem < this.shelfHeaderItems() && this.continueReading !== undefined) {
      books.push(this.continueReading);
    }
    const firstRow = Math.max(0, this.firstVisibleItem - this.shelfHeaderItems());
    for (let index = firstRow; index < this.rowDataSource.totalCount() && books.length < 6; index += 1) {
      for (const book of this.rowDataSource.getData(index)) {
        if (books.length >= 6) break;
        if (!books.some((value: ShelfBook): boolean => value.sourceId === book.sourceId && value.bookId === book.bookId)) {
          books.push(book);
        }
      }
    }
    this.onVisibleBooksChanged(books, this.navigationGeneration);
  }

  private bookRowRenderKey(row: ShelfBook[], rowIndex: number): string {
    // Row position is not identity. Reordering or trimming a page must not
    // replace all following native covers. Mutable display fields still
    // invalidate the affected row; tuple encoding avoids delimiter collisions.
    return JSON.stringify(row.map((book: ShelfBook): Array<string | number> => [
      book.sourceId, book.bookId, book.addedAt, book.title, book.author,
      book.sourceName ?? '', book.coverUrl ?? '', book.kind ?? '', book.contentKind ?? '', book.currentChapterTitle ?? '',
      book.currentChapterIndex ?? -1, book.chapterCount ?? -1, book.lastChapter ?? '',
      book.unreadCount ?? 0, book.readProgress ?? -1,
      book.readingPosition?.chapterIndex ?? -1, book.readingPosition?.chapterOffset ?? -1,
      book.readingPosition?.updatedAt ?? -1, book.readingPosition?.locationRevision ?? '',
      book.readingPosition?.bodyVersion ?? '', book.readingPosition?.processingVersion ?? '',
    ]));
  }

  private async persistRequestedViewMode(mode: BookshelfViewMode, revision: number,
    navigation: number = this.navigationGeneration): Promise<boolean> {
    const snapshot = await this.viewModeHost.save(mode, (): boolean => this.isShelfPresentationCurrent(navigation) &&
      this.feedbackEnabled && this.isCurrentShelfInput(navigation) && revision === this.viewModeRevision);
    if (snapshot === undefined) {
      if (this.isShelfPresentationCurrent(navigation) && revision === this.viewModeRevision) {
        this.storedViewMode = this.confirmedViewMode;
        this.resetViewSwitchMotion();
        this.viewMode = this.confirmedViewMode;
        this.setRestingProjectionOpacity(this.confirmedViewMode);
      }
      return false;
    }
    if (snapshot.canonical !== undefined) this.confirmedViewMode = snapshot.canonical;
    if (this.isShelfPresentationCurrent(navigation) && revision === this.viewModeRevision) {
      this.viewModeSnapshot = snapshot;
      this.viewModeError = this.viewModeRecovery().message;
      this.modeFeedback();
      if (snapshot.receipt?.receipt.confirmation !== 'confirmed') this.applyViewModeSnapshot(snapshot);
    }
    return snapshot.receipt?.receipt.confirmation === 'confirmed';
  }

  private viewModeAction(mode: BookshelfViewMode, navigation: number = this.navigationGeneration): () => void {
    return (): void => this.setViewMode(mode, navigation);
  }

  private viewModeReconcileAction(navigation: number = this.navigationGeneration): (generation: number) => void {
    return (generation: number): void => this.retryViewMode(generation, navigation);
  }

  private setViewMode(mode: BookshelfViewMode, navigation: number = this.navigationGeneration): void {
    if (!this.isShelfPresentationCurrent(navigation) || !this.feedbackEnabled ||
      !this.isCurrentShelfInput(navigation) || !this.viewModeHost.canSave()) return;
    this.modeReconcileBusy = false;
    const revision = ++this.viewModeRevision;
    this.requestedViewMode = mode;
    this.viewModeReadFailed = false;
    this.storedViewMode = mode;
    this.viewModeError = '';
    void this.persistRequestedViewMode(mode, revision, navigation).catch((error: Error): void => {
      if (!this.isShelfPresentationCurrent(navigation) || revision !== this.viewModeRevision) return;
      this.storedViewMode = this.confirmedViewMode;
      this.resetViewSwitchMotion();
      this.viewMode = this.confirmedViewMode;
      this.setRestingProjectionOpacity(this.confirmedViewMode);
      this.viewModeError = error.message === 'BOOKSHELF_RESTORE_PENDING' ?
        '请先在同步设置中重试未完成的恢复' : '显示方式保存失败，点击重试';
    });
    if (this.reduceMotion) {
      this.fadeViewSwitch(mode);
      return;
    }
    if (this.viewSwitchRunning) {
      if (mode === this.pendingViewMode) return;
      this.pendingViewMode = mode;
      this.viewTimeline.retarget(mode === this.viewSwitchDestinationMode, readerMotionNowMs());
      return;
    }
    if (this.viewMode !== mode) this.startViewSwitch(mode);
  }

  private onReduceMotionChanged(): void {
    if (!this.mounted || !this.reduceMotion) return;
    if (this.filterMotionRunning) this.settleFilterPanel();
    if (!this.viewSwitchRunning) return;
    this.fadeViewSwitch(this.pendingViewMode);
  }

  private fadeViewSwitch(mode: BookshelfViewMode): void {
    this.resetViewSwitchMotion();
    this.viewMode = mode;
    this.viewSwitchHeaderOpacity = 0.65;
    this.viewSwitchGridContentOpacity = mode === 'cover' ? 0.65 : 0;
    this.viewSwitchListContentOpacity = mode === 'list' ? 0.65 : 0;
    this.getUIContext().animateTo(readerMotionReducedFadeParam(), (): void => {
      this.viewSwitchHeaderOpacity = 1;
      this.setRestingProjectionOpacity(mode);
    });
  }

  private startViewSwitch(mode: BookshelfViewMode): void {
    const token = ++this.viewSwitchToken;
    this.pendingViewMode = mode;
    this.viewSwitchSourceMode = this.viewMode;
    this.viewSwitchDestinationMode = mode;
    this.captureViewSwitchRanks();
    this.viewSwitchTimeMs = 0;
    this.viewTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
    this.viewTimeline.retarget(true, readerMotionNowMs());
    this.viewSwitchRunning = true;
    this.sampleViewSwitch();
    this.scheduleViewSwitchFrame(token);
  }

  private captureViewSwitchRanks(): void {
    this.viewSwitchRanks.clear();
    const leadingItems = this.shelfHeaderItems();
    const firstRow = Math.max(0, this.firstVisibleItem - leadingItems);
    const lastRow = Math.min(this.rowDataSource.totalCount() - 1, this.lastVisibleItem - leadingItems);
    for (let row = firstRow; row <= lastRow && this.viewSwitchRanks.size < 9; row += 1) {
      const books = this.rowDataSource.getData(row);
      for (let column = 0; column < books.length && this.viewSwitchRanks.size < 9; column += 1) {
        if (this.measureBookOrigin(books[column]) === undefined) continue;
        this.viewSwitchRanks.set(row * bookshelfColumnCount(this.projectedWideLayout) + column, this.viewSwitchRanks.size);
      }
    }
  }

  private scheduleViewSwitchFrame(token: number): void {
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (token !== this.viewSwitchToken || !this.viewSwitchRunning) return;
      const now = readerMotionNowMs();
      this.viewSwitchTimeMs = this.viewTimeline.sample(now);
      this.sampleViewSwitch();
      if (!this.viewTimeline.running(now)) {
        this.viewMode = this.pendingViewMode;
        this.resetViewSwitchMotion();
      } else this.scheduleViewSwitchFrame(token);
    }));
  }

  private sampleViewSwitch(): void {
    const t = this.viewSwitchTimeMs;
    const m = this.viewMotion;
    const content = (p: number): number => this.viewMotion.contentCurve.interpolate(p);
    const fade = (p: number): number => this.viewMotion.coverFadeCurve.interpolate(p);
    const outgoing = 1 - motionSegment(t, m.layoutCommitMs, m.outgoingDurationMs, content);
    const incoming = motionSegment(t, m.contentIncomingStartMs, m.contentIncomingDurationMs, content);
    this.viewSwitchHeaderOpacity = outgoing +
      motionSegment(t, m.headerIncomingStartMs, m.headerIncomingDurationMs, content);
    this.viewSwitchGridContentOpacity = this.viewSwitchSourceMode === 'cover' ? outgoing : incoming;
    this.viewSwitchListContentOpacity = this.viewSwitchSourceMode === 'list' ? outgoing : incoming;
    // The stable lower cover stays opaque while the upper cover hands off.
    // Text reveal and whole-cover paint are independent.
    this.viewSwitchDestinationCoverOpacity = 1;
    if (this.viewSwitchDestinationMode === 'list') {
      this.viewSwitchMorphCoverOpacity = 1 - motionSegment(t,
        m.movingCoverFadeStartMs, m.movingCoverFadeDurationMs, fade);
    } else {
      const handoff = motionSegment(t, m.morphCoverIncomingStartMs, m.morphCoverIncomingDurationMs, fade);
      this.viewSwitchMorphCoverOpacity = handoff;
    }
    this.viewMode = t < m.layoutCommitMs ? this.viewSwitchSourceMode : this.viewSwitchDestinationMode;
  }

  private resetViewSwitchMotion(): void {
    this.viewSwitchToken += 1;
    this.viewSwitchRunning = false;
    this.viewSwitchHeaderOpacity = 1;
    this.setRestingProjectionOpacity(this.viewMode);
  }

  private setRestingProjectionOpacity(mode: BookshelfViewMode): void {
    this.viewSwitchGridContentOpacity = mode === 'cover' ? 1 : 0;
    this.viewSwitchListContentOpacity = mode === 'list' ? 1 : 0;
    this.viewSwitchDestinationCoverOpacity = 1;
    this.viewSwitchMorphCoverOpacity = 0;
  }

  private projectionDetailsOpacity(mode: BookshelfViewMode, index?: number): number {
    if (this.viewSwitchRunning && index !== undefined && !this.viewSwitchRanks.has(index)) {
      return this.pendingViewMode === mode ? 1 : 0;
    }
    return mode === 'cover' ? this.viewSwitchGridContentOpacity : this.viewSwitchListContentOpacity;
  }

  private projectionListProgress(index: number, scale: boolean = false, columnCount: number = 1): number {
    if (!this.viewSwitchRunning || this.reduceMotion) return this.viewMode === 'list' ? 1 : 0;
    let visibleIndex = this.viewSwitchRanks.get(index);
    for (let column = 1; visibleIndex === undefined && column < columnCount; column += 1) {
      visibleIndex = this.viewSwitchRanks.get(index + column);
    }
    if (visibleIndex === undefined) return this.pendingViewMode === 'list' ? 1 : 0;
    const progress = motionSegment(this.viewSwitchTimeMs,
      this.viewMotion.layoutCommitMs + bookshelfViewCoverDelayMs(visibleIndex),
      scale ? this.viewMotion.coverScaleDurationMs : this.viewMotion.coverMoveDurationMs,
      (p: number): number => scale ? this.viewMotion.coverScaleCurve.interpolate(p) :
        this.viewMotion.coverMoveCurve.interpolate(p));
    return this.viewSwitchDestinationMode === 'list' ? progress : 1 - progress;
  }

  private projectionRowHeight(row: ShelfBook[], expandedLayout: boolean, index: number): number {
    let grid = 0;
    for (const book of row) grid = Math.max(grid, this.gridBookCardHeight(book, expandedLayout));
    const listRows = Math.ceil(row.length / bookshelfColumnCount(expandedLayout, true));
    const list = listRows * this.listRowHeight(expandedLayout) +
      Math.max(0, listRows - 1) * TOK_SPACE_CONTROL_INLINE;
    return grid + (list - grid) * this.projectionListProgress(index, false, bookshelfColumnCount(expandedLayout));
  }

  private projectionBookWidth(expandedLayout: boolean, index: number): number {
    const grid = this.shelfBookCardWidth(expandedLayout);
    const list = bookshelfListCardWidth(this.shelfContentWidth(expandedLayout), expandedLayout);
    return grid + (list - grid) * this.projectionListProgress(index);
  }

  private projectionBookHeight(book: ShelfBook, expandedLayout: boolean, index: number): number {
    const grid = this.gridBookCardHeight(book, expandedLayout);
    return grid + (this.listRowHeight(expandedLayout) - grid) * this.projectionListProgress(index);
  }

  private projectionBookTranslateX(columnIndex: number, expandedLayout: boolean, index: number): number {
    const width = this.shelfContentWidth(expandedLayout);
    const grid = columnIndex * (this.shelfBookCardWidth(expandedLayout) + this.bookRowSpace(width, expandedLayout));
    const list = (columnIndex % bookshelfColumnCount(expandedLayout, true)) *
      (bookshelfListCardWidth(width, expandedLayout) + BOOKSHELF_LIST_COLUMN_GAP);
    return grid + (list - grid) * this.projectionListProgress(index);
  }

  private projectionBookTranslateY(columnIndex: number, expandedLayout: boolean, index: number): number {
    const row = Math.floor(columnIndex / bookshelfColumnCount(expandedLayout, true));
    return row * (this.listRowHeight(expandedLayout) + TOK_SPACE_CONTROL_INLINE) * this.projectionListProgress(index);
  }

  private projectionCoverScale(expandedLayout: boolean, index: number): number {
    const list = this.listCoverWidth(expandedLayout) / Math.max(1, this.shelfBookCardWidth(expandedLayout));
    return 1 + (list - 1) * this.projectionListProgress(index, true);
  }

  private projectionCoverRadius(expandedLayout: boolean, index: number): number {
    const list = 6 / (this.listCoverWidth(expandedLayout) / this.shelfBookCardWidth(expandedLayout));
    return 8 + (list - 8) * this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationX(expandedLayout: boolean, index: number): number {
    const gridCenter = this.shelfBookCardWidth(expandedLayout) / 2;
    const listCenter = BOOKSHELF_LIST_CARD_PADDING + this.listCoverWidth(expandedLayout) / 2;
    return (listCenter - gridCenter) * this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationY(expandedLayout: boolean, index: number): number {
    const gridCenter = this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout) / 2;
    const listCenter = this.listRowHeight(expandedLayout) / 2;
    return (listCenter - gridCenter) * this.projectionListProgress(index, true);
  }

  private projectionListDetailsWidth(expandedLayout: boolean): number {
    return Math.max(
      0,
      bookshelfListCardWidth(this.shelfContentWidth(expandedLayout), expandedLayout) -
        this.listCoverWidth(expandedLayout) - 2 * BOOKSHELF_LIST_CARD_PADDING - BOOKSHELF_LIST_DETAILS_GAP,
    );
  }

  private projectionCoverLayerOpacity(morphLayer: boolean): number {
    return morphLayer
      ? this.viewSwitchMorphCoverOpacity
      : this.viewSwitchDestinationCoverOpacity;
  }

  private gridBookCardHeight(book: ShelfBook, expandedLayout: boolean): number {
    return bookshelfGridFrame(this.shelfContentWidth(expandedLayout), expandedLayout,
      ReaderWindowCoordinator.metrics().systemFontScale, this.gridProgressLabel(book).length > 0,
      BOOKSHELF_GRID_TITLE_LINES).cardHeight;
  }

  private hasCover(book: ShelfBook | undefined): boolean {
    return this.coverUrl(book) !== undefined;
  }

  private coverUrl(book: ShelfBook | undefined): string | undefined {
    const url = bookCoverDisplayUrl(book?.coverUrl);
    return url !== undefined && !this.failedCoverUrls.includes(url) ? url : undefined;
  }

  private coverErrorHandler(url: string | undefined): () => void {
    return (): void => {
      if (!this.mounted || url === undefined || this.failedCoverUrls.includes(url)) return;
      this.failedCoverUrls = [...this.failedCoverUrls, url];
    };
  }
}
