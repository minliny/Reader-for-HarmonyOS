import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { readerAnimatePress, readerPressOpacity, readerPressPointer, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { bookCoverDisplayUrl, rememberBookCoverFailure } from '../../../app/library/BookCoverDisplay';
import { BookCoverFailureCache } from '../../../app/library/BookCoverFailureCache';
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
import { readerStableInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { TYPE_SHELF_UPDATE_BADGE, TYPE_SHELF_FILTER_LABEL, TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_STATE, TYPE_SECTION_HEADING } from '../../../ui/foundation/ReaderTypography';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { bookshelfHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import {
  TYPE_SHELF_ACTION,
  TYPE_SHELF_CONTINUE_AUTHOR, TYPE_SHELF_CONTINUE_LABEL,
  TYPE_SHELF_CONTINUE_TITLE,
  TYPE_SHELF_LIST_AUTHOR,
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

import { CoverProgressBadge } from '../../../ui/patterns/CoverProgressBadge';
import { NoCoverCover, noCoverGlyph } from '../../../ui/patterns/NoCoverCover';
import { noCoverFooterInsets } from '../../../ui/patterns/NoCoverLayout';
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
import {
  BookshelfBookActionFocusFrame,
  BookshelfBookSlot,
  BookshelfMotionFrameCallback,
  BookshelfRowDataSource,
  BookshelfRowSlot,
  bookshelfFileDropHint,
  bookshelfRowRenderKey,
  bookshelfRowSlotKey,
} from './BookshelfPageDataSource';
import { BookshelfContinueCard } from './BookshelfContinueCard';
import { BookshelfFilterContent } from './BookshelfFilterRow';
import {
  buildBookshelfProjectionMetrics,
  gridBookCardHeightValue,
  gridProgressLabelValue,
  projectionBookTranslateXForProgress,
  projectionBookTranslateYForProgress,
  projectionCoverCompensationXForProgress,
  projectionCoverCompensationYForProgress,
  projectionCoverRadiusForProgress,
  projectionCoverScaleForProgress,
  projectionListDetailsWidthValue,
  projectionListSlotX,
  projectionListSlotY,
  projectionRowHeightForProgress,
  projectionRowTopMarginForProgress,
  resolveBookshelfContentEndValue,
  resolveBookshelfPageGeometry,
  resolveBookshelfViewSwitchPlan,
  type BookshelfGeometryParams,
  type BookshelfProjectionMetrics,
} from './BookshelfProjectionGeometry';

export { bookshelfFileDropHint };

@Builder
function emptyBookshelfRowBuilder(_slot: BookshelfRowSlot, _expandedLayout: boolean): void {}

@Builder
function emptyBookshelfBookBuilder(
  _book: ShelfBook,
  _expandedLayout: boolean,
  _index: () => number,
  _columnIndex: number,
): void {}

@Component
struct BookshelfRowSlotHost {
  @ObjectLink slot: BookshelfRowSlot;
  @Prop expandedLayout: boolean = false;
  @Prop renderStateKey: string = '';
  @BuilderParam renderRow: (slot: BookshelfRowSlot, expandedLayout: boolean) => void = emptyBookshelfRowBuilder;

  build() {
    this.renderRow(this.slot, this.expandedLayout);
  }
}

@Component
struct BookshelfBookSlotHost {
  @ObjectLink bookSlot: BookshelfBookSlot;
  @Prop rowIndex: number = 0;
  @Prop expandedLayout: boolean = false;
  @Prop renderStateKey: string = '';
  @BuilderParam renderCard: (
    book: ShelfBook,
    expandedLayout: boolean,
    index: () => number,
    columnIndex: number,
  ) => void = emptyBookshelfBookBuilder;

  build() {
    this.renderCard(
      this.bookSlot.book,
      this.expandedLayout,
      (): number => this.rowIndex * bookshelfColumnCount(this.expandedLayout) + this.bookSlot.columnIndex,
      this.bookSlot.columnIndex,
    );
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
  @State private failedCoverUrls: string[] = BookCoverFailureCache.snapshotUrls();
  private coverFailureGeneration: number = 0;
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
  private viewSwitchRunning: boolean = false;
  @State private visualListProgress: number = DEFAULT_BOOKSHELF_VIEW === 'list' ? 1 : 0;
  @State private viewSwitchHeaderOpacity: number = 1;
  @State private viewSwitchGridContentOpacity: number = 0;
  @State private viewSwitchListContentOpacity: number = 1;
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
  private viewSwitchTimer: number = -1;
  private pendingConfirmedViewModeSnapshot: BookshelfViewModeSnapshot | undefined = undefined;
  private pendingConfirmedViewModeRevision: number = -1;
  private cachedProjectionMetricsKey: string = '';
  private cachedProjectionMetrics: BookshelfProjectionMetrics | undefined = undefined;
  private readonly rowDataSource: BookshelfRowDataSource = new BookshelfRowDataSource((row: ShelfBook[]): string => this.bookRowRenderKey(row, 0));
  private readonly webDavCredentials: WebDavCredentialStore = WebDavCredentialStore.instance;

  aboutToAppear(): void {
    this.mounted = true;
    this.failedCoverUrls = BookCoverFailureCache.snapshotUrls();
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
    this.visualListProgress = restoredMode === 'list' ? 1 : 0;
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
    this.visualListProgress = mode === 'list' ? 1 : 0;
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
    this.coverFailureGeneration += 1;
    this.failedCoverUrls = [];
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
    const bottom = Math.max(this.shelfContentEndInset(), readerStableInteractiveSafeBottom(metrics, false));
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
  private bookshelfList() {
    List({ space: 0, scroller: this.shelfScroller }) {
      if (this.continueReading !== undefined) {
        ListItem() {
          BookshelfContinueCard({
            continueReading: this.continueReading,
            expandedLayout: this.isWideViewport(),
            continueCardSuppressed: this.continueCardSuppressed,
            headerScrolled: this.headerScrolled,
            mangaRevision: this.mangaRevision,
            reduceMotion: this.reduceMotion,
            shelfPressKey: this.shelfPressKey,
            failedCoverUrls: this.failedCoverUrls,
            contentWidth: this.shelfContentWidth(this.isWideViewport()),
            rectId: this.continueCardRectId(),
            onCoverError: (url: string | undefined): void => this.coverErrorHandler(url)(),
            onAreaMeasured: (): void => this.scheduleContinueCardMeasurement(),
            onPressTouch: (event: TouchEvent): void => this.observeShelfPress(event, 'continue', !this.continueCardSuppressed),
            onSelect: this.bookSelectionHandler((): ShelfBook | undefined => this.continueReading, true),
          });
        }.padding({ top: this.shelfFirstItemPadding() }).margin({ bottom: TOK_SPACE_CONTROL_INLINE });
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
      }.margin({ bottom: TOK_SPACE_CONTROL_INLINE });

      if (this.currentFilterBookCount() === 0 && this.hasActiveFilters()) {
        ListItem() {
          Column() {
            ForEach([this.navigationGeneration], (navigation: number): void => {
              this.filteredEmptyCard(navigation);
            }, (navigation: number): string => `shelf-filter-empty:${navigation}`);
          }.width('100%');
        }.margin({ bottom: TOK_SPACE_CONTROL_INLINE });
      }

      // One stable row/card tree owns both projections. Keep LazyForEach row
      // slots keyed by index and mutate changed books in-place via @Observed
      // slots so background refreshes or returning from reading never reload covers.
      LazyForEach(this.rowDataSource, (slot: BookshelfRowSlot) => {
        ListItem() {
          BookshelfRowSlotHost({
            slot,
            expandedLayout: this.isWideViewport(),
            renderStateKey: this.slotRenderStateKey(),
            renderRow: (currentSlot: BookshelfRowSlot, expanded: boolean): void => {
              this.projectionRow(currentSlot, expanded);
            },
          });
        }.margin({ top: projectionRowTopMarginForProgress(this.isWideViewport(), slot.rowIndex, TOK_SPACE_CONTROL_INLINE, this.visualListProgress) });
      }, (slot: BookshelfRowSlot): string => bookshelfRowSlotKey(slot.rowIndex));
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
      const row = this.rowDataSource.booksAt(rowIndex);
      const key = row.length > 0 ?
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
        if (this.rowDataSource.booksAt(index).some((book: ShelfBook): boolean =>
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
        BookshelfFilterContent({
          navigation,
          contentFilter: this.contentFilter,
          sourceFilter: this.sourceFilter,
          reduceMotion: this.reduceMotion,
          shelfPressKey: this.shelfPressKey,
          onClearFilters: (): void => this.clearFilters(navigation),
          onCloseFilter: (): void => this.setFilterExpanded(false, navigation),
          onSelectFilter: (dimension: string, value: string): void => this.selectFilter(dimension, value, navigation),
          onFilterPress: (event: TouchEvent, key: string): void => this.observeShelfPress(event, key),
        });
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
  private projectionRow(slot: BookshelfRowSlot, expandedLayout: boolean) {
    this.projectionRowWithMetrics(slot, expandedLayout, this.projectionMetrics(expandedLayout));
  }

  @Builder
  private projectionRowWithMetrics(
    slot: BookshelfRowSlot,
    expandedLayout: boolean,
    metrics: BookshelfProjectionMetrics,
  ) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionListRowBackdrop(slot, expandedLayout, metrics);
      ForEach(slot.slots, (bookSlot: BookshelfBookSlot) => {
        BookshelfBookSlotHost({
          bookSlot,
          rowIndex: slot.rowIndex,
          expandedLayout,
          renderStateKey: this.slotRenderStateKey(),
          renderCard: (book: ShelfBook, cardExpanded: boolean, index: () => number, columnIndex: number): void => {
            this.projectionBookCard(book, cardExpanded, index, columnIndex);
          },
        });
      }, (bookSlot: BookshelfBookSlot): string => bookSlot.key);
    }
    .width(metrics.contentWidth)
    .height(this.projectionRowHeight(slot.books, expandedLayout, metrics))
    // The native no-expand child range can expose only the first generated
    // card of this ForEach row. Publish the already-mounted card and cover
    // actors by their stable ids so the developer scanner can resolve every
    // column and the cover boundary at each column.
    .customProperty('readerLayoutDebugMountedIds',
      this.layoutDebugMountedIds(slot.books));
  }

  @Builder
  private projectionListRowBackdrop(
    slot: BookshelfRowSlot,
    expandedLayout: boolean,
    metrics: BookshelfProjectionMetrics,
  ) {
    if (expandedLayout) {
      ForEach(slot.slots, (bookSlot: BookshelfBookSlot) => {
        Row()
          .width(metrics.listCardWidth)
          .height(metrics.listRowHeight)
          .translate({
            x: projectionListSlotX(metrics, bookSlot.columnIndex),
            y: projectionListSlotY(metrics, bookSlot.columnIndex),
          })
          .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .borderRadius(14)
          .shadow(readerSurfaceElevation('card', this.appThemeScheme))
          .opacity(this.viewSwitchListContentOpacity)
          .accessibilityLevel('no')
          .hitTestBehavior(HitTestMode.None);
      }, (bookSlot: BookshelfBookSlot): string => `backdrop:${bookSlot.key}`);
    } else {
      Row().width('100%').height('100%')
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({
          width: {
            left: TOK_BORDER_W,
            right: TOK_BORDER_W,
            top: slot.rowIndex === 0 ? TOK_BORDER_W : 0,
            bottom: slot.rowIndex === Math.max(0, this.rowDataSource.totalCount() - 1) ? TOK_BORDER_W : 0,
          },
          color: readerAppColor('TOK_LINE', this.appThemeScheme),
        })
        .borderRadius({
          topLeft: slot.rowIndex === 0 ? 14 : 0,
          topRight: slot.rowIndex === 0 ? 14 : 0,
          bottomLeft: slot.rowIndex === Math.max(0, this.rowDataSource.totalCount() - 1) ? 14 : 0,
          bottomRight: slot.rowIndex === Math.max(0, this.rowDataSource.totalCount() - 1) ? 14 : 0,
        })
        .opacity(this.viewSwitchListContentOpacity)
        .accessibilityLevel('no')
        .hitTestBehavior(HitTestMode.None);
      ForEach(slot.slots, (bookSlot: BookshelfBookSlot) => {
        if (slot.rowIndex * metrics.gridColumns + bookSlot.columnIndex > 0) {
          Row() {
            Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme));
          }
          .width('100%')
          .padding({ left: BOOKSHELF_LIST_CARD_PADDING, right: BOOKSHELF_LIST_CARD_PADDING })
          .translate({ y: projectionListSlotY(metrics, bookSlot.columnIndex) })
          .opacity(this.viewSwitchListContentOpacity)
          .accessibilityLevel('no')
          .hitTestBehavior(HitTestMode.None);
        }
      }, (bookSlot: BookshelfBookSlot): string => `divider:${bookSlot.key}`);
    }
  }

  private slotRenderStateKey(): string {
    return `${this.viewMode}:${this.visualListProgress}:${this.viewSwitchGridContentOpacity}:${this.viewSwitchListContentOpacity}:${this.visibleBookCount}:${this.failedCoverUrls.length}:${this.shelfPressKey}:${this.navigationGeneration}:${this.reduceMotion ? 1 : 0}:${this.appThemeScheme}:${this.readerWindowMetricsRevision}:${this.mainViewportRevision}:${this.wideNavigationRail ? 1 : 0}:${this.listTextFontRevision}:${this.paneWidth}`;
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
   * List row/card surfaces are owned by projectionListRowBackdrop so cards
   * animate translation without per-frame width/height relayout.
   */
  @Builder
  private projectionBookCard(
    book: ShelfBook,
    expandedLayout: boolean,
    index: () => number,
    columnIndex: number,
  ) {
    this.projectionBookCardWithMetrics(book, expandedLayout, index, columnIndex, this.projectionMetrics(expandedLayout));
  }

  @Builder
  private projectionBookCardWithMetrics(
    book: ShelfBook,
    expandedLayout: boolean,
    index: () => number,
    columnIndex: number,
    metrics: BookshelfProjectionMetrics,
  ) {
    Stack({ alignContent: Alignment.TopStart }) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCover(book, expandedLayout, metrics);
      this.projectionGridDetails(book, metrics);
      this.projectionListDetails(book, expandedLayout, metrics);
      Row().width('100%').height('100%')
        .borderRadius(expandedLayout || this.viewMode === 'cover' ? 14 : {
          topLeft: index() === 0 ? 14 : 0,
          topRight: index() === 0 ? 14 : 0,
          bottomLeft: index() === Math.max(0, this.visibleBookCount - 1) ? 14 : 0,
          bottomRight: index() === Math.max(0, this.visibleBookCount - 1) ? 14 : 0,
        })
        .backgroundColor(readerPressSurface(Color.Transparent, this.appThemeScheme,
          this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }.width('100%').height('100%')
      .scale(readerPressScale(this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
      .opacity(readerPressOpacity(this.shelfPressed(this.bookActionFocusKey(book, false)), this.reduceMotion))
      ;
    }
    .width(this.viewMode === 'list' ? metrics.listCardWidth : metrics.gridCardWidth)
    .height(this.viewMode === 'list' ? metrics.listRowHeight : this.gridBookCardHeight(book, metrics))
    .translate({
      x: projectionBookTranslateXForProgress(metrics, columnIndex, this.visualListProgress),
      y: projectionBookTranslateYForProgress(metrics, columnIndex, this.visualListProgress),
    })
    .id(this.bookActionFocusKey(book, false))
    .attributeModifier(new ReaderActionAccessibility(this.bookCardAccessibilityText(book)))
    .onTouch((event: TouchEvent): void => this.observeShelfPress(event, this.bookActionFocusKey(book, false)))
    .onClick(this.bookSelectionHandler((): ShelfBook => book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction(this.bookActionPresentationHandler(book, false)),
    );
  }

  private bookCardAccessibilityText(book: ShelfBook): string {
    const progress = this.gridProgressLabel(book);
    return `${book.title}，${book.author}${progress.length > 0 ? `，${progress}` : ''}${(book.unreadCount ?? 0) > 0 ? `，更新 ${book.unreadCount} 章` : ''}`;
  }

  @Builder
  private projectionBookCover(book: ShelfBook, expandedLayout: boolean, metrics: BookshelfProjectionMetrics) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCoverLayer(book, expandedLayout, metrics);
    }
    .width(metrics.gridCardWidth)
    .height(metrics.gridCoverHeight)
    .id(this.bookCoverMotionId(book))
    .backgroundColor(readerAppColor(
      this.hasCover(book) ? 'app.cover.placeholder' : 'app.cover.novelSurfaceStart',
      this.appThemeScheme,
    ))
    .borderRadius(this.projectionCoverRadius(expandedLayout))
    .shadow(readerSurfaceElevation('cover', this.appThemeScheme))
    .scale({
      x: projectionCoverScaleForProgress(metrics, this.visualListProgress),
      y: projectionCoverScaleForProgress(metrics, this.visualListProgress),
      centerX: '50%',
      centerY: '50%',
    })
    .translate({
      x: projectionCoverCompensationXForProgress(metrics, this.visualListProgress),
      y: projectionCoverCompensationYForProgress(metrics, this.visualListProgress),
    })
    .zIndex(4)
    // Visual actor only. The enclosing card alone owns click/long press;
    // None alone would still hit the Image descendants.
    .enabled(false)
    .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private projectionBookCoverLayer(book: ShelfBook, expandedLayout: boolean, metrics: BookshelfProjectionMetrics) {
    Stack({ alignContent: Alignment.TopEnd }) {
      if (this.hasCover(book)) {
        Image(this.coverUrl(book) as string)
          .width(metrics.gridCardWidth)
          .height(metrics.gridCoverHeight)
          .autoResize(true).sourceSize({ width: metrics.gridCardWidth, height: metrics.gridCoverHeight })
          .objectFit(ImageFit.Cover)
          .borderRadius(this.projectionCoverRadius(expandedLayout))
          .onError(this.coverErrorHandler(this.coverUrl(book)));
      } else {
        NoCoverCover({
          coverWidth: metrics.gridCardWidth,
          coverHeight: metrics.gridCoverHeight,
          glyph: noCoverGlyph(book.title),
          kindLabel: ShelfBookPresentation.contentLabel(book),
          cornerRadius: this.projectionCoverRadius(expandedLayout),
          reserveTopBadge: (book.unreadCount ?? 0) > 0,
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
            .constraintSize({ maxWidth: Math.max(0, metrics.gridCardWidth - 28) });
        }
          .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
          .constraintSize({ maxWidth: Math.max(0, metrics.gridCardWidth - 14) })
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(Math.min(Math.max(0, metrics.gridCardWidth - 14),
            (TYPE_SHELF_UPDATE_BADGE.lineHeightFp as number) * this.continueCardFontScale() + 6) / 2)
          .margin({ top: 7, right: 7 })
          .opacity(this.viewSwitchGridContentOpacity);
      }
      if (ShelfBookPresentation.progressPercent(book) > 0) {
        this.coverProgressOverlay(book, metrics);
      }
    }
    .width(metrics.gridCardWidth)
    .height(metrics.gridCoverHeight)
    .backgroundColor(readerAppColor(
      this.hasCover(book) ? 'app.cover.placeholder' : 'app.cover.novelSurfaceStart',
      this.appThemeScheme,
    ))
    .borderRadius(this.projectionCoverRadius(expandedLayout))
    .clip(true)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private coverProgressOverlay(book: ShelfBook, metrics: BookshelfProjectionMetrics) {
    Stack({ alignContent: Alignment.BottomEnd }) {
      if (this.hasCover(book)) {
        CoverProgressBadge({
          percent: ShelfBookPresentation.progressPercent(book),
          variant: 'pill',
          compactScale: noCoverFooterInsets(metrics.gridCardWidth, metrics.gridCoverHeight).scale,
        })
          .margin({ right: 5, bottom: 5 })
          .opacity(this.viewSwitchGridContentOpacity);
      } else {
        CoverProgressBadge({
          percent: ShelfBookPresentation.progressPercent(book),
          variant: 'inline',
          compactScale: noCoverFooterInsets(metrics.gridCardWidth, metrics.gridCoverHeight).scale,
        })
          .margin({
            right: noCoverFooterInsets(metrics.gridCardWidth, metrics.gridCoverHeight).right,
            bottom: noCoverFooterInsets(metrics.gridCardWidth, metrics.gridCoverHeight).bottom,
          })
          .opacity(this.viewSwitchGridContentOpacity);
      }
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants');
  }

  @Builder
  private projectionGridDetails(book: ShelfBook, metrics: BookshelfProjectionMetrics) {
    Column({ space: BOOKSHELF_GRID_TEXT_GAP }) {
      Text(book.title)
        .width(metrics.gridCardWidth)
        .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_TITLE.lineHeightFp}fp`)
        .letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(BOOKSHELF_GRID_TITLE_LINES)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(book.author)
        .width(metrics.gridCardWidth)
        .fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_AUTHOR.lineHeightFp}fp`)
        .letterSpacing(TYPE_SHELF_LIST_AUTHOR.letterSpacingFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(metrics.gridCardWidth)
    .alignItems(HorizontalAlign.Start)
    .translate({ y: metrics.gridDetailsY })
    .opacity(this.viewSwitchGridContentOpacity)
    .accessibilityLevel(this.viewMode === 'cover' ? 'auto' : 'no-hide-descendants')
    .enabled(this.viewMode === 'cover')
    .hitTestBehavior(this.viewMode === 'cover' ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private projectionListDetails(book: ShelfBook, expandedLayout: boolean, metrics: BookshelfProjectionMetrics) {
    Row() {
      ShelfBookListDetails({
        book, textFrame: this.listTextFrame(expandedLayout), targetHeight: metrics.listContentHeight,
        moreFocusId: this.bookActionFocusKey(book, true), moreAccessibilityLabel: `${book.title}更多操作`,
        moreEnabled: this.viewMode === 'list', onMore: this.bookActionPresentationHandler(book, true),
      });
    }
    .width(metrics.listDetailsWidth)
    .height(metrics.listContentHeight)
    .translate({
      x: metrics.listDetailsX,
      y: metrics.listDetailsY,
    })
    .opacity(this.viewSwitchListContentOpacity)
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

  private geometryParams(): BookshelfGeometryParams {
    return {
      viewportWidth: this.effectiveViewportWidth(),
      headerBottom: this.headerBottom,
      railActive: this.railActive(),
      metricsRevision: this.readerWindowMetricsRevision,
      wideViewport: this.isWideViewport(),
      measuredFooterHeight: this.measuredFooterHeight,
    };
  }

  private contentGeometry(expandedLayout: boolean): ReaderPageGeometry {
    return resolveBookshelfPageGeometry(expandedLayout, this.geometryParams());
  }

  private shelfContentEndValue(): number {
    return resolveBookshelfContentEndValue(this.geometryParams());
  }

  private gridProgressLabel(book: ShelfBook): string {
    return gridProgressLabelValue(book);
  }

  private bookRowRenderKey(row: ShelfBook[], rowIndex: number): string {
    return bookshelfRowRenderKey(row, rowIndex);
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
    if (this.books.length === 0 && this.continueReading === undefined && this.failedCoverUrls.length > 0) {
      this.coverFailureGeneration++;
      this.failedCoverUrls = [];
    }
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
    const oldFirst = this.rowDataSource.booksAt(0)[0];
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
      for (const book of this.rowDataSource.booksAt(index)) {
        if (books.length >= 6) break;
        if (!books.some((value: ShelfBook): boolean => value.sourceId === book.sourceId && value.bookId === book.bookId)) {
          books.push(book);
        }
      }
    }
    this.onVisibleBooksChanged(books, this.navigationGeneration);
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
        this.visualListProgress = this.confirmedViewMode === 'list' ? 1 : 0;
        this.setRestingProjectionOpacity(this.confirmedViewMode);
      }
      return false;
    }
    if (snapshot.canonical !== undefined) this.confirmedViewMode = snapshot.canonical;
    if (this.isShelfPresentationCurrent(navigation) && revision === this.viewModeRevision) {
      if (this.viewSwitchRunning && snapshot.receipt?.receipt.confirmation === 'confirmed' &&
        snapshot.receipt?.facts.blocked !== true) {
        this.pendingConfirmedViewModeSnapshot = snapshot;
        this.pendingConfirmedViewModeRevision = revision;
      } else {
        this.viewModeSnapshot = snapshot;
        this.viewModeError = this.viewModeRecovery().message;
        this.modeFeedback();
        if (snapshot.receipt?.receipt.confirmation !== 'confirmed') this.applyViewModeSnapshot(snapshot);
      }
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
    this.pendingConfirmedViewModeSnapshot = undefined;
    this.pendingConfirmedViewModeRevision = -1;
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
      this.visualListProgress = this.confirmedViewMode === 'list' ? 1 : 0;
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
      this.startViewSwitch(mode);
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
    this.visualListProgress = mode === 'list' ? 1 : 0;
    this.viewSwitchHeaderOpacity = 0.65;
    this.viewSwitchGridContentOpacity = mode === 'cover' ? 0.65 : 0;
    this.viewSwitchListContentOpacity = mode === 'list' ? 0.65 : 0;
    this.getUIContext().animateTo(readerMotionReducedFadeParam(), (): void => {
      this.viewSwitchHeaderOpacity = 1;
      this.setRestingProjectionOpacity(mode);
    });
  }

  private clearViewSwitchTimer(): void {
    if (this.viewSwitchTimer >= 0) {
      clearTimeout(this.viewSwitchTimer);
      this.viewSwitchTimer = -1;
    }
  }

  private startViewSwitch(mode: BookshelfViewMode): void {
    const token = ++this.viewSwitchToken;
    this.clearViewSwitchTimer();
    this.pendingViewMode = mode;
    this.viewSwitchRunning = true;
    this.viewMode = mode;
    this.viewSwitchHeaderOpacity = 1;
    const plan = resolveBookshelfViewSwitchPlan(
      mode,
      false,
      this.viewMotion.totalMs,
      this.viewMotion.outgoingDurationMs,
      this.viewMotion.contentIncomingDurationMs,
    );
    this.viewSwitchTimer = setTimeout((): void => {
      this.finishViewSwitch(token);
    }, plan.safetyTimeoutMs);
    const context = this.getUIContext();
    context.animateTo({
      duration: plan.outgoingDurationMs,
      curve: this.viewMotion.contentCurve,
    }, (): void => {
      if (plan.outgoingTarget === 'grid') {
        this.viewSwitchGridContentOpacity = plan.targetGridOpacity;
      } else {
        this.viewSwitchListContentOpacity = plan.targetListOpacity;
      }
    });
    context.animateTo({
      delay: plan.incomingDelayMs,
      duration: plan.incomingDurationMs,
      curve: this.viewMotion.contentCurve,
    }, (): void => {
      if (plan.outgoingTarget === 'grid') {
        this.viewSwitchListContentOpacity = plan.targetListOpacity;
      } else {
        this.viewSwitchGridContentOpacity = plan.targetGridOpacity;
      }
    });
    context.animateTo({
      duration: plan.reflowDurationMs,
      curve: this.viewMotion.coverMoveCurve,
      onFinish: (): void => { this.finishViewSwitch(token); },
    }, (): void => {
      this.visualListProgress = plan.targetListProgress;
    });
  }

  private finishViewSwitch(token: number): void {
    if (token !== this.viewSwitchToken) return;
    this.clearViewSwitchTimer();
    this.viewSwitchRunning = false;
    const pending = this.pendingConfirmedViewModeSnapshot;
    const pendingRevision = this.pendingConfirmedViewModeRevision;
    this.pendingConfirmedViewModeSnapshot = undefined;
    this.pendingConfirmedViewModeRevision = -1;
    if (pending !== undefined && this.mounted && pendingRevision === this.viewModeRevision) {
      this.viewModeSnapshot = pending;
      this.viewModeError = this.viewModeRecovery().message;
      this.modeFeedback();
    }
  }

  private resetViewSwitchMotion(): void {
    this.viewSwitchToken += 1;
    this.clearViewSwitchTimer();
    this.viewSwitchRunning = false;
    this.pendingConfirmedViewModeSnapshot = undefined;
    this.pendingConfirmedViewModeRevision = -1;
    this.viewSwitchHeaderOpacity = 1;
    this.setRestingProjectionOpacity(this.viewMode);
  }

  private setRestingProjectionOpacity(mode: BookshelfViewMode): void {
    this.viewSwitchGridContentOpacity = mode === 'cover' ? 1 : 0;
    this.viewSwitchListContentOpacity = mode === 'list' ? 1 : 0;
  }

  private projectionMetrics(expandedLayout: boolean): BookshelfProjectionMetrics {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    const contentWidth = this.shelfContentWidth(expandedLayout);
    const listCoverWidth = this.listCoverWidth(expandedLayout);
    const listContentHeight = this.listContentHeight(expandedLayout);
    const listRowHeight = listContentHeight + 2 * BOOKSHELF_LIST_CARD_PADDING;
    const key = `${expandedLayout ? 1 : 0}:${contentWidth}:${scale}:${listCoverWidth}:${listContentHeight}:${this.paneWidth}:${this.headerBottom}:${this.measuredFooterHeight}:${this.wideNavigationRail ? 1 : 0}:${this.mainViewportRevision}:${this.readerWindowMetricsRevision}:${this.listTextFontRevision}`;
    if (this.cachedProjectionMetrics !== undefined && this.cachedProjectionMetricsKey === key) {
      return this.cachedProjectionMetrics;
    }
    const metrics = buildBookshelfProjectionMetrics(
      contentWidth,
      expandedLayout,
      scale,
      listCoverWidth,
      listContentHeight,
      listRowHeight,
    );
    this.cachedProjectionMetricsKey = key;
    this.cachedProjectionMetrics = metrics;
    return metrics;
  }

  private rowHasGridProgress(_books: ShelfBook[]): boolean {
    return false;
  }

  private projectionRowHeight(
    books: ShelfBook[],
    expandedLayout: boolean,
    metrics: BookshelfProjectionMetrics = this.projectionMetrics(expandedLayout),
  ): number {
    return projectionRowHeightForProgress(
      metrics,
      books.length,
      this.rowHasGridProgress(books),
      this.visualListProgress,
    );
  }

  private projectionCoverRadius(expandedLayout: boolean): number {
    return projectionCoverRadiusForProgress(this.projectionMetrics(expandedLayout), this.visualListProgress);
  }

  private projectionListDetailsWidth(expandedLayout: boolean): number {
    return projectionListDetailsWidthValue(
      this.shelfContentWidth(expandedLayout),
      expandedLayout,
      this.listCoverWidth(expandedLayout),
    );
  }

  private gridBookCardHeight(_book: ShelfBook, metrics: BookshelfProjectionMetrics): number {
    return metrics.gridCardHeightNoProgress;
  }

  private hasCover(book: ShelfBook | undefined): boolean {
    return this.coverUrl(book) !== undefined;
  }

  private coverUrl(book: ShelfBook | undefined): string | undefined {
    const url = bookCoverDisplayUrl(book?.coverUrl);
    return url !== undefined && !this.failedCoverUrls.includes(url) ? url : undefined;
  }

  private coverErrorHandler(url: string | undefined): () => void {
    const generation = this.coverFailureGeneration;
    return (): void => {
      if (!this.mounted || generation !== this.coverFailureGeneration || url === undefined) return;
      BookCoverFailureCache.recordFailure(url);
      const next = rememberBookCoverFailure(this.failedCoverUrls, url);
      if (next !== this.failedCoverUrls) this.failedCoverUrls = next;
    };
  }
}
