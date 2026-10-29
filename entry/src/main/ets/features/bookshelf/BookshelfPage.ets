import { BOOKSHELF_GRID_TEXT_GAP } from './BookshelfGridSpec';
import { BOOKSHELF_COVER_SHADOW_RADIUS, BOOKSHELF_COVER_SHADOW_OFFSET_Y } from './BookshelfCoverVisual';
import { ReaderActionAccessibility } from '../common/ReaderActionAccessibility';
import { readerMainViewport } from '../shell/MainNavigationSpec';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../common/ReaderTransientFeedback';
import { ReaderPageState } from '../common/ReaderPageState';
import { BookshelfViewModeHost, type BookshelfViewModeSnapshot } from './BookshelfViewModeHost';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { TYPE_SHELF_UPDATE_BADGE, TYPE_SHELF_FILTER_LABEL, TYPE_APP_INHERITED_BODY, TYPE_APP_INHERITED_STATE, TYPE_SECTION_HEADING } from '../common/ReaderTypography';
import { readerIsExpandedWidth } from '../common/ReaderWidthClass';
import { bookshelfHeaderSpec } from '../common/ReaderHeaderSpecs';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  TYPE_SHELF_ACTION,
  TYPE_SHELF_CONTINUE_AUTHOR, TYPE_SHELF_CONTINUE_LABEL,
  TYPE_SHELF_CONTINUE_TITLE,
  TYPE_SHELF_LIST_AUTHOR,
  TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_TITLE,
} from '../common/ReaderTypography';
import { BookshelfSectionHeader } from './BookshelfSectionHeader';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from './ShelfBookPresentation';
import { MangaBookPresentation } from '../manga/MangaBookPresentation';
import { BookshelfViewState } from './BookshelfViewState';
import { bookshelfContinueCardFrame, BookshelfContinueCardFrame } from './BookshelfContinueCardSpec';
import { BookshelfBookOrigin } from './BookshelfNavigationMotion';
import { ReaderSurfaceRect, ReaderSurfaceRectIdentity } from '../common/ReaderSurfaceRect';
import { readerMeasureSurfaceRect } from '../common/ReaderSurfaceRectMeasurement';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { FrameCallback } from '@kit.ArkUI';
import { readerScrimmedOpaqueColor } from '../common/ReaderScrimColor';
import curves from '@ohos.curves';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { motionSegment, ReversibleMotionTimeline } from '../common/MotionTimeline';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PRIMARY_DARK,
  TOK_PRIMARY_GRADIENT_START,
  TOK_PRIMARY_SOFT,
  TOK_RADIUS_MD,
  TOK_SCREEN_INSET,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import { NoCoverCover } from './NoCoverCover';
import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { BookshelfBookActionSheet } from './BookshelfBookActionSheet';
import { SheetSurfaceSpec, resolveSheetSpec, readerSurfaceElevation } from '../common/ReaderSurfaceSpecs';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerFloatingBarBottomInset,
  readerFloatingTabContentInset,
} from '../common/ReaderFloatingBarMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../common/ReaderScrollLayout';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  readerMainNavigationMode,
  readerMainRailContentLeft,
  readerMainRailContentRight,
  type MainNavigationMode,
} from '../shell/MainNavigationSpec';
import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';
import {
  BookshelfViewMotionContract,
  bookshelfViewCoverDelayMs,
  bookshelfViewMotionContract,
  motionAnimateParam,
} from '../common/MotionSpec';
import { bookshelfCoverHeight, bookshelfGridFrame } from './BookshelfGridSpec';

const PHONE_LIST_COVER_WIDTH = 48;
const PHONE_LIST_COVER_HEIGHT = 72;
const TABLET_LIST_COVER_WIDTH = 64;
const TABLET_LIST_COVER_HEIGHT = 104;

type BookshelfViewMode = 'cover' | 'list';

interface BookshelfFilterFrame {
  generation: number;
  startedAt: number;
  fromHeight: number;
  toHeight: number;
  fromOpacity: number;
  toOpacity: number;
  heightDuration: number;
  contentDuration: number;
  heightCurve: curves.ICurve;
  contentCurve: curves.ICurve;
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

class BookshelfRowDataSource implements IDataSource {
  private items: ShelfBook[][] = [];
  private listeners: DataChangeListener[] = [];
  private keys: string[] = [];
  private readonly renderKey: (row: ShelfBook[]) => string;
  constructor(renderKey: (row: ShelfBook[]) => string) { this.renderKey = renderKey; }

  totalCount(): number { return this.items.length; }
  getData(index: number): ShelfBook[] { return this.items[index]; }
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
      else listener.onDataReloaded();
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
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  viewState: BookshelfViewState = new BookshelfViewState();
  private readonly shelfScroller: Scroller = new Scroller();
  private viewportRestored: boolean = false;
  private viewportRestoreGeneration: number = 0;
  private firstVisibleItem: number = 0;
  private headerScrollFrameQueued: string = '';
  private headerScrollPublishedNavigation: number = -1;
  private headerScrolled: boolean = false;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerMangaPresentationRevision') private mangaRevision: number = 0;

  @StorageLink('readerMainViewportRevision') @Watch('scheduleContinueCardMeasurement') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') @Watch('scheduleContinueCardMeasurement') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  // The bookshelf page is rebuilt when leaving and returning from reading.
  // Keep the user's projection choice in app storage so route recreation does
  // not silently restore the cover projection.
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = 'cover';
  // Retire the removed group selector's transient filter without changing book groups.
  @StorageLink('readerBookshelfSelectedGroup') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfContentFilter') @Watch('onShelfFiltersChanged') private contentFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('onShelfFiltersChanged') private sourceFilter: string = 'all';
  @Prop @Watch('onBooksChanged') books: ShelfBook[];
  @Prop serverFiltered: boolean = false;
  @Prop noticeTopInset: number = 0;
  /** Presented header bottom (top + measured height), owned by the route. */
  @Prop @Watch('scheduleContinueCardMeasurement') headerBottom: number = bookshelfHeaderSpec().frameHeight;
  /** Route increments this when the current main tab is tapped. */
  @Prop @Watch('onScrollToTopRequested') scrollToTopToken: number = 0;
  @Prop @Watch('onShelfPresentationChanged') navigationGeneration: number = 0;
  @Prop @Watch('scheduleReturnMotionOrigin') returnMotionBookKey: string = '';
  @Prop @Watch('modeFeedback') feedbackEnabled: boolean = true;
  @Prop unfilteredOnlineBooks: boolean = false;
  onNextPageRequested: (navigation?: number) => void = (): void => {};
  onPreviousPageRequested: (navigation?: number) => void = (): void => {};
  onFilterRequested: (readingState: string, sourceKind: string, contentKind?: string, navigation?: number) => void = (_readingState: string, _sourceKind: string): void => {};
  @Prop @Watch('onContinueReadingChanged') continueReading: ShelfBook | undefined;
  /** Keep the shelf slot stable when the IME leaves no room to cover the card. */
  @Prop continueCardSuppressed: boolean = false;
  onContinueCardRect: (rect: ReaderSurfaceRect | undefined, navigation: number, bookKey: string) => void =
    (_rect: ReaderSurfaceRect | undefined, _navigation: number, _bookKey: string): void => {};
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  onRssRequested: (navigation?: number) => void = (): void => {};
  onSettingsRequested: (navigation?: number) => void = (): void => {};
  onDiscoverRequested: (navigation?: number) => void = (): void => {};
  onBookSelected: (book: ShelfBook, navigation?: number, origin?: BookshelfBookOrigin) => void = (_book: ShelfBook): void => {};
  onReturnMotionOrigin: (origin: BookshelfBookOrigin, navigation?: number) => void = (_origin: BookshelfBookOrigin): void => {};
  onVisibleBooksChanged: (books: ShelfBook[], navigation?: number) => void = (_books: ShelfBook[]): void => {};
  onHeaderScrolledChanged: (scrolled: boolean, navigation: number) => void =
    (_scrolled: boolean, _navigation: number): void => {};
  isCurrentChromeHost: (navigation?: number) => boolean = (_navigation?: number): boolean => true;
  onBookMultiSelectRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  onBookGroupRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  onBookInfoRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  onBookRemoveRequested: (book: ShelfBook, navigation?: number) => void = (_book: ShelfBook): void => {};
  @State private viewMode: BookshelfViewMode = 'cover';
  @State private viewSwitchRunning: boolean = false;
  @State private viewSwitchHeaderOpacity: number = 1;
  @State private viewSwitchGridContentOpacity: number = 1;
  @State private viewSwitchListContentOpacity: number = 0;
  @State private viewSwitchDestinationCoverOpacity: number = 1;
  @State private viewSwitchMorphCoverOpacity: number = 0;
  @State private filterRowVisible: boolean = false;
  @State private filterPanelHeight: number = 0;
  @State private filterContentOpacity: number = 0;
  private filterNaturalHeight: number = 0;
  private filterMotionGeneration: number = 0;
  private filterMotionRunning: boolean = false;
  private returnMotionReported: string = '';
  private returnMotionFrameQueued: string = '';
  private continueCardMeasureQueued: string = '';
  private continueCardPublishedKey: string = '';
  private continueCardPublishedNavigation: number = -1;
  private continueCardPublishedRect: ReaderSurfaceRect | undefined = undefined;
  @State private viewModeError: string = '';
  private mounted: boolean = false;
  private projectionQueued: boolean = false;
  private projectionGeneration: number = 0;
  @State private viewModeSnapshot: BookshelfViewModeSnapshot = { canonical: undefined };
  private readonly viewModeHost: BookshelfViewModeHost = BookshelfViewModeHost.instance;
  private viewModeRevision: number = 0;
  private confirmedViewMode: BookshelfViewMode = 'cover';
  private requestedViewMode: BookshelfViewMode = 'cover';
  private viewModeReadFailed: boolean = false;
  @State private actionBook: ShelfBook | undefined = undefined;
  @State private bookActionSheetVisible: boolean = false;
  @State private actionSheetId: string = '';
  private actionSheetRevision: number = 0;
  private actionSheetNavigation: number = 0;
  private actionSheetAppearedId: string = '';
  private actionSheetChromeId: string = '';
  private pendingBookAction: (() => void) | undefined = undefined;
  @State private visibleBookCount: number = 0;
  private readonly viewMotion: BookshelfViewMotionContract = bookshelfViewMotionContract();
  private pendingViewMode: BookshelfViewMode = 'cover';
  private viewSwitchToken: number = 0;
  @State private viewSwitchTimeMs: number = 0;
  private viewSwitchSourceMode: BookshelfViewMode = 'cover';
  private viewSwitchDestinationMode: BookshelfViewMode = 'list';
  private viewTimeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
  private readonly rowDataSource: BookshelfRowDataSource = new BookshelfRowDataSource((row: ShelfBook[]): string => this.bookRowRenderKey(row, 0));
  private readonly webDavCredentials: WebDavCredentialStore = WebDavCredentialStore.instance;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderShelfFonts(this.getUIContext().getFont());
    const confirmedMode = this.webDavCredentials.currentBookshelfViewMode();
    const restoredMode: BookshelfViewMode = confirmedMode ?? (this.storedViewMode === 'list' ? 'list' : 'cover');
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

  private retryViewMode(generation: number = this.viewModeRecovery().generation): void {
    if (!this.mounted || this.modeReconcileBusy || generation !== this.viewModeRecovery().generation) return;
    this.lastModeFeedback = '';
    const revision = this.viewModeRevision;
    this.modeReconcileBusy = true;
    void this.viewModeHost.reconcile(generation, (): boolean => this.mounted && revision === this.viewModeRevision)
      .then((snapshot): void => {
        if (snapshot === undefined || !this.mounted || revision !== this.viewModeRevision) return;
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
    this.transientFeedback.reset();
    this.publishContinueCardRect(undefined);
    this.continueCardMeasureQueued = '';
    this.projectionGeneration += 1;
    this.projectionQueued = false;
    this.saveShelfViewport();
    this.viewState.filterExpanded = this.filterRowVisible;
    this.filterMotionGeneration += 1;
    this.filterMotionRunning = false;
    this.returnMotionFrameQueued = '';
    this.viewportRestoreGeneration += 1;
    this.headerScrollFrameQueued = '';
    this.mounted = false;
    this.modeReconcileBusy = false;
    this.bookActionSheetVisible = false;
    this.pendingBookAction = undefined;
    this.actionSheetAppearedId = '';
    if (this.actionSheetChromeId.length > 0 && this.isCurrentChromeHost(this.navigationGeneration)) ReaderWindowCoordinator.requestAppChrome();
    this.actionSheetChromeId = '';
    this.actionBook = undefined;
    this.actionSheetId = '';
    this.actionSheetRevision += 1;
    this.viewModeRevision += 1;
    this.resetViewSwitchMotion();
  }

  build() {
    this.bookshelfTabContent();
  }

  @Builder
  private bookshelfTabContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.isWideViewport()) {
        this.tabletContent();
      } else {
        this.phoneContent();
      }
      if (this.viewModePending()) {
        Column() {
          ReaderRecoveryNotice({ view: this.viewModeRecovery(), tag: '显示方式待确认', actionLabel: '核对显示方式',
            busy: this.modeReconcileBusy || this.viewModeSnapshot.receipt?.facts.fact === 'refreshing' || this.viewModeSnapshot.readFacts?.fact === 'refreshing',
            onReconcile: (generation: number): void => this.retryViewMode(generation) });
        }.width('100%').padding({ left: 17, right: 17, top: this.shelfHeaderClearance() + this.noticeTopInset })
          .hitTestBehavior(HitTestMode.Transparent);
      }
    }
    .width('100%')
    .height('100%')
    .bindSheet(this.bookActionSheetVisible, this.bookActionSheetContent, this.bookActionSheetOptions());
  }

  private bookActionSheetOptions(presentationId: string = this.actionSheetId,
    book: ShelfBook | undefined = this.actionBook): SheetOptions {
    return {
      height: SheetSize.FIT_CONTENT,
      width: this.bookActionWidth(),
      preferType: SheetType.BOTTOM,
      dragBar: false,
      showClose: false,
      backgroundColor: readerAppColor(this.bookActionSheetSpec().hostBackgroundRole, this.appThemeScheme),
      radius: { topLeft: this.bookActionSheetSpec().borderRadius, topRight: this.bookActionSheetSpec().borderRadius, bottomLeft: 0, bottomRight: 0 },
      maskColor: readerAppColor(this.bookActionSheetSpec().hostMaskRole, this.appThemeScheme),
      shadow: readerSurfaceElevation(this.bookActionSheetSpec().hostElevation, this.appThemeScheme),
      borderWidth: { top: this.bookActionSheetSpec().hostBorderWidth },
      borderColor: readerAppColor(this.bookActionSheetSpec().hostBorderRole, this.appThemeScheme),
      enableOutsideInteractive: false,
      onWillAppear: (): void => this.claimBookActionChrome(presentationId, book),
      onAppear: (): void => {
        if (this.isCurrentBookActionSheet(presentationId, book)) this.actionSheetAppearedId = presentationId;
      },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!this.isCurrentBookActionSheet(presentationId, book)) return;
        // Ignore the opening gesture's release/outside hit until the native
        // sheet has finished entering. Back remains an explicit dismissal.
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.actionSheetAppearedId !== presentationId) return;
        // Native sheet mask and system-bar chrome are separate render paths.
        // Release the latter at the same dismissal boundary; onDisappear keeps
        // the cleanup idempotent for interrupted/native teardown paths.
        this.releaseBookActionChrome(presentationId);
        this.dismissBookActionSheet(presentationId, book);
        dismissal.dismiss();
      },
      onDisappear: (): void => this.finishBookActionSheet(presentationId, book),
    };
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

  private releaseBookActionChrome(presentationId: string): void {
    if (!this.mounted || presentationId.length === 0 || presentationId !== this.actionSheetChromeId ||
      !this.isCurrentChromeHost(this.actionSheetNavigation)) return;
    this.actionSheetChromeId = '';
    ReaderWindowCoordinator.requestAppChrome();
  }

  private bookActionSheetSpec(): SheetSurfaceSpec {
    return resolveSheetSpec('bookshelf-book-action');
  }

  @Builder
  private bookActionSheetContent() {
    // V1 ordinary callbacks are constructor inputs. Only this small temporary
    // Sheet child remounts on a new presentation; the bookshelf stays mounted.
    ForEach([this.actionSheetId], (presentationId: string) => {
      this.bookActionSheetPresentation(presentationId, this.actionBook);
    }, (presentationId: string): string => presentationId);
  }

  @Builder
  private bookActionSheetPresentation(presentationId: string, book: ShelfBook | undefined) {
    BookshelfBookActionSheet({
      presentationId,
      isCurrent: (candidate: string): boolean => candidate === presentationId && this.isCurrentBookActionSheet(presentationId, book),
      onMultiSelect: (): void => this.performBookAction(presentationId, book, this.onBookMultiSelectRequested),
      onBookInfo: (): void => this.performBookAction(presentationId, book, this.onBookInfoRequested),
      onEditGroup: (): void => this.performBookAction(presentationId, book, this.onBookGroupRequested),
      onRemoveFromBookshelf: (): void => this.performBookAction(presentationId, book, this.onBookRemoveRequested),
    });
  }

  @Builder
  private phoneContent() {
    Column() {
      this.bookshelfList(false);
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.phoneContentFrame().left, right: this.phoneContentFrame().right });
  }

  @Builder
  private tabletContent() {
    Column() {
      this.bookshelfList(true);
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.tabletContentFrame().left, right: this.tabletContentFrame().right });
  }

  private continueCardFrame(expandedLayout: boolean): BookshelfContinueCardFrame {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return bookshelfContinueCardFrame(this.shelfContentWidth(expandedLayout), expandedLayout, scale);
  }

  private continueCardFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) ? Math.max(1, scale) : 1;
  }

  @Builder
  private continueCardCover(bookProvider: () => ShelfBook | undefined, expandedLayout: boolean) {
    Stack() {
      if (this.hasCover(bookProvider())) {
        Image(bookProvider()?.coverUrl ?? '')
          .width(this.continueCardFrame(expandedLayout).coverWidth)
          .height(this.continueCardFrame(expandedLayout).coverHeight)
          .objectFit(ImageFit.Cover).borderRadius(8);
      } else {
        NoCoverCover({ coverWidth: this.continueCardFrame(expandedLayout).coverWidth,
          coverHeight: this.continueCardFrame(expandedLayout).coverHeight });
      }
    }.width(this.continueCardFrame(expandedLayout).coverWidth)
      .height(this.continueCardFrame(expandedLayout).coverHeight).borderRadius(8).clip(true)
      .id(this.bookCoverMotionId(bookProvider(), true));
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
    }.layoutWeight(1).constraintSize({ minHeight: this.continueCardFrame(expandedLayout).textMinHeight })
      .alignItems(HorizontalAlign.Start).justifyContent(FlexAlign.Center);
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
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme)).borderRadius(12);
  }

  @Builder
  private continueReadingCard(bookProvider: () => ShelfBook | undefined, expandedLayout: boolean) {
    Column({ space: 6 }) {
      Text('继续阅读').width('100%')
        .fontFamily(TYPE_SHELF_CONTINUE_LABEL.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_LABEL.fontWeight)
        .fontSize(TYPE_SHELF_CONTINUE_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_CONTINUE_LABEL.lineHeightFp as number)
        .letterSpacing(TYPE_SHELF_CONTINUE_LABEL.letterSpacingFp as number)
        .minFontScale(1).maxFontScale(this.continueCardFontScale())
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
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
        .alignSelf(ItemAlign.Center)
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('app.border.contentCard', this.appThemeScheme) }).borderRadius(18)
        .id(this.continueCardRectId())
        .onAreaChange(this.continueCardAreaHandler())
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
      return this.mangaReadingPosition(book);
    }
    return ShelfBookPresentation.readingPosition(book);
  }

  @Builder
  private bookshelfList(expandedLayout: boolean) {
    List({ space: TOK_SPACE_CONTROL_INLINE, scroller: this.shelfScroller }) {
      if (this.continueReading !== undefined) {
        ListItem() {
          // Retained Builder observers must read the live Prop instead of
          // capturing the book that happened to be current when mounted.
          this.continueReadingCard((): ShelfBook | undefined => this.continueReading, expandedLayout);
        }.padding({ top: this.shelfFirstItemPadding() });
      }
      ListItem() {
        Column() {
          BookshelfSectionHeader({
            contentWidth: this.shelfContentWidth(expandedLayout),
            titleOpacity: this.viewSwitchHeaderOpacity,
            viewMode: this.viewMode,
            filterExpanded: this.filterRowVisible,
            hasActiveFilters: this.hasActiveFilters(),
            onCover: (): void => this.setViewMode('cover'),
            onList: (): void => this.setViewMode('list'),
            onFilter: (): void => this.setFilterExpanded(!this.filterRowVisible),
          });

          this.filterPanel();
        }
        .width(this.shelfContentWidth(expandedLayout))
        .padding({ top: this.continueReading === undefined ? this.shelfFirstItemPadding() : 0 });
      }

      if (this.visibleBookCount === 0) {
        ListItem() {
          ReaderPageState({ title: '没有符合条件的书籍', actionLabel: '清除全部条件',
            onAction: (): void => this.clearFilters() }).padding({ top: 40, bottom: 40 });
        }
      }

      // One stable row/card tree owns both projections. Replacing the list and
      // grid subtrees made ArkUI mount the target at its final geometry, so the
      // Figma shared-cover motion had no persistent actor to interpolate.
      LazyForEach(this.rowDataSource, (row: ShelfBook[], rowIndex: number) => {
        ListItem() {
          this.projectionRow(row, expandedLayout, rowIndex);
        }
      }, (row: ShelfBook[], rowIndex: number): string => this.bookRowRenderKey(row, rowIndex));
    }
    .width(this.shelfContentWidth(expandedLayout))
    .height('100%')
    .id(this.shelfViewportMotionId())
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .scrollBar(BarState.Off)
    .maintainVisibleContentPosition(true)
    .onScrollIndex(this.shelfScrollHandler())
    .onReachStart(this.shelfPageHandler(true))
    .onReachEnd(this.shelfPageHandler(false))
    .onScroll(this.shelfViewportScrollHandler())
    .onAppear((): void => this.restoreShelfViewport());
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
      if (!this.mounted || generation !== this.viewportRestoreGeneration) return;
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
        this.scheduleReturnMotionOrigin();
        return;
      }
      const item = anchor + this.shelfHeaderItems();
      this.firstVisibleItem = item;
      this.shelfScroller.scrollToIndex(item, false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
        if (!this.mounted || generation !== this.viewportRestoreGeneration) return;
        try { this.shelfScroller.scrollBy(0, this.shelfScroller.getItemRect(item).y - itemY); }
        catch (_error) { /* A concurrent removal may discard the saved anchor. */ }
        this.viewportRestored = true;
        this.publishVisibleReadingBooks();
        this.scheduleReturnMotionOrigin();
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
  private filterPanel() {
    // Scroll measures its content with an unbounded vertical constraint even
    // when the viewport is zero high. It is only a clip host: users cannot
    // scroll it. One live content tree therefore supplies the current height
    // after wrapping, window and font changes without a duplicate measure tree.
    Scroll() {
      Column() {
        this.filterRow();
      }
      .width('100%')
      .padding({ top: TOK_SPACE_CONTROL_INLINE })
      .opacity(this.filterContentOpacity)
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        this.onFilterContentMeasured(this.numericAreaLength(newValue.height));
      });
    }
    .width('100%')
    .height(this.filterPanelHeight)
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

  private setFilterExpanded(expanded: boolean): void {
    if (!this.mounted || expanded === this.filterRowVisible) return;
    this.filterRowVisible = expanded;
    this.viewState.filterExpanded = expanded;
    if (this.reduceMotion) this.settleFilterPanel();
    else this.animateFilterPanel();
  }

  private animateFilterPanel(): void {
    const generation = ++this.filterMotionGeneration;
    const expanded = this.filterRowVisible;
    this.filterMotionRunning = true;
    const height = motionAnimateParam(expanded ? 'bookshelf.filter.expand' : 'bookshelf.filter.collapse');
    const content = motionAnimateParam(expanded ? 'bookshelf.filter.content.in' : 'bookshelf.filter.content.out');
    // Reuse the page's frame clock and shared segment sampler. State holds
    // the displayed values, so a reversal starts there and reduced motion can
    // stop immediately without reassigning an implicit animation's old target.
    this.scheduleFilterFrame({ generation, startedAt: readerMotionNowMs(),
      fromHeight: this.filterPanelHeight, toHeight: expanded ? this.filterNaturalHeight : 0,
      fromOpacity: this.filterContentOpacity, toOpacity: expanded ? 1 : 0,
      heightDuration: height.duration ?? 0, contentDuration: content.duration ?? 0,
      // These registered filter tracks use native cubicBezierCurve objects.
      heightCurve: height.curve as curves.ICurve, contentCurve: content.curve as curves.ICurve });
  }

  private scheduleFilterFrame(frame: BookshelfFilterFrame): void {
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (!this.mounted || frame.generation !== this.filterMotionGeneration || !this.filterMotionRunning) return;
      const elapsed = Math.max(0, readerMotionNowMs() - frame.startedAt);
      const heightProgress = motionSegment(elapsed, 0, frame.heightDuration,
        (fraction: number): number => frame.heightCurve.interpolate(fraction));
      const contentProgress = motionSegment(elapsed, 0, frame.contentDuration,
        (fraction: number): number => frame.contentCurve.interpolate(fraction));
      this.filterPanelHeight = frame.fromHeight + (frame.toHeight - frame.fromHeight) * heightProgress;
      this.filterContentOpacity = frame.fromOpacity + (frame.toOpacity - frame.fromOpacity) * contentProgress;
      if (elapsed >= Math.max(frame.heightDuration, frame.contentDuration)) this.filterMotionRunning = false;
      else this.scheduleFilterFrame(frame);
    }));
  }

  private settleFilterPanel(): void {
    this.filterMotionGeneration += 1;
    this.filterMotionRunning = false;
    this.filterPanelHeight = this.filterRowVisible ? this.filterNaturalHeight : 0;
    this.filterContentOpacity = this.filterRowVisible ? 1 : 0;
  }

  /** PH60: view-only state/type conditions; grouping and updates have separate owners. */
  @Builder
  private filterRow() {
    Column({ space: 4 }) {
      Row({ space: TOK_SPACE_MD }) {
        Text('筛选').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Text('清除').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .constraintSize({ minHeight: 44 }).enabled(this.hasActiveFilters()).opacity(this.hasActiveFilters() ? 1 : 0.5)
          .attributeModifier(new ReaderActionAccessibility('清除内容类型和来源筛选', this.hasActiveFilters()))
          .onClick((): void => this.clearFilters());
        Text('收起').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .constraintSize({ minHeight: 44 }).attributeModifier(new ReaderActionAccessibility('收起筛选'))
          .onClick((): void => this.setFilterExpanded(false));
      }.width('100%');
      Text('内容类型').width('100%').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('content', 'all', '全部');
        this.filterChip('content', 'text', '小说');
        this.filterChip('content', 'manga', '漫画');
      }.width('100%');
      Text('来源').width('100%').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('source', 'all', '全部');
        this.filterChip('source', 'local', '本地');
        this.filterChip('source', 'online', '在线');
      }.width('100%');
    }.width('100%');
  }

  @Builder
  private filterChip(dimension: string, value: string, label: string) {
    Row() {
      Text(label)
        .fontFamily(TYPE_SHELF_FILTER_LABEL.fontFamily).fontWeight(TYPE_SHELF_FILTER_LABEL.fontWeight)
        .fontSize(TYPE_SHELF_FILTER_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_FILTER_LABEL.lineHeightFp as number)
        .fontColor(this.isFilterSelected(dimension, value) ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .constraintSize({ maxWidth: 136 }).textAlign(TextAlign.Center);
    }
      .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      // Keep the semantic soft token for existing filter contracts while the
      // visible selected layer uses the demo's dark-green capsule.
      .backgroundColor(this.isFilterSelected(dimension, value) ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .linearGradient({ angle: 0, colors: this.isFilterSelected(dimension, value) ?
        [[readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 0], [readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 1]] :
        [[Color.Transparent, 0], [Color.Transparent, 1]] })
      .border({ width: TOK_BORDER_W, color: this.isFilterSelected(dimension, value) ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(999).margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .constraintSize({ maxWidth: 160, minHeight: 44 })
      .attributeModifier(new ReaderActionAccessibility(`${dimension === 'content' ? '内容类型' : '来源'}：${label}`, true, this.isFilterSelected(dimension, value)))
      .onClick((): void => this.selectFilter(dimension, value));
  }

  private isFilterSelected(dimension: string, value: string): boolean {
    return (dimension === 'content' ? this.contentFilter : this.sourceFilter) === value;
  }

  private hasActiveFilters(): boolean {
    return this.contentFilter !== 'all' || this.sourceFilter !== 'all';
  }

  private selectFilter(dimension: string, value: string): void {
    if (dimension === 'content') this.contentFilter = value;
    else this.sourceFilter = value;
    this.queueShelfProjection();
  }

  private clearFilters(): void {
    this.contentFilter = 'all';
    this.sourceFilter = 'all';
    this.queueShelfProjection();
  }

  private onShelfFiltersChanged(): void {
    if (this.mounted && this.serverFiltered) this.onFilterRequested('all', this.sourceFilter, this.contentFilter, this.navigationGeneration);
    this.queueShelfProjection();
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
  private projectionRow(row: ShelfBook[], expandedLayout: boolean, rowIndex: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach(row, (book: ShelfBook, columnIndex: number) => {
        this.projectionBookCard(book, expandedLayout, (rowIndex * 3) + columnIndex, columnIndex);
      }, (book: ShelfBook): string => `${book.sourceId}:${book.bookId}`);
    }
    .width(this.shelfContentWidth(expandedLayout))
    .height(this.projectionRowHeight(row, expandedLayout, rowIndex * 3));
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
    index: number,
    columnIndex: number,
  ) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCover(book, expandedLayout, index);
      this.projectionGridDetails(book, expandedLayout);
      this.projectionListDetails(book, expandedLayout);
    }
    .width(this.projectionBookWidth(expandedLayout, index))
    .height(this.projectionBookHeight(book, expandedLayout, index))
    .translate({
      x: this.projectionBookTranslateX(columnIndex, expandedLayout, index),
      y: this.projectionBookTranslateY(columnIndex, expandedLayout, index),
    })
    .attributeModifier(new ReaderActionAccessibility(`${book.title}，${book.author}，${this.gridProgressLabel(book)}`))
    .onClick(this.bookSelectionHandler((): ShelfBook => book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction(this.bookActionPresentationHandler(book)),
    );
  }

  @Builder
  private projectionBookCover(book: ShelfBook, expandedLayout: boolean, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCoverLayer(book, expandedLayout, false, index);
      this.projectionBookCoverLayer(book, expandedLayout, true, index);
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
    .id(this.bookCoverMotionId(book, false))
    .borderRadius(this.projectionCoverRadius(expandedLayout, index))
    .clip(true)
    .scale({
      x: this.projectionCoverScale(expandedLayout, index),
      y: this.projectionCoverScale(expandedLayout, index),
      centerX: '50%',
      centerY: '50%',
    })
    .translate({
      x: this.projectionCoverCompensationX(expandedLayout, index),
      y: this.projectionCoverCompensationY(expandedLayout, index),
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
  private projectionBookCoverLayer(book: ShelfBook, expandedLayout: boolean, morphLayer: boolean, index: number) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.hasCover(book)) {
        Image(book.coverUrl as string)
          .width(this.shelfBookCardWidth(expandedLayout))
          .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
          .objectFit(ImageFit.Cover)
          .borderRadius(this.projectionCoverRadius(expandedLayout, index))
          .shadow({ radius: BOOKSHELF_COVER_SHADOW_RADIUS, color: readerAppColor('app.shadow.cover', this.appThemeScheme),
            offsetX: 0, offsetY: BOOKSHELF_COVER_SHADOW_OFFSET_Y });
      } else {
        NoCoverCover({
          coverWidth: this.shelfBookCardWidth(expandedLayout),
          coverHeight: this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout),
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
            .maxLines(1).textAlign(TextAlign.Center);
        }
          .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(999)
          .align(Alignment.TopEnd)
          .margin({ top: 7, right: 7 })
          .opacity(this.viewSwitchGridContentOpacity);
      }
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .height(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout))
    .linearGradient({
      angle: 141.7,
      colors: [[readerAppColor('TOK_PRIMARY_GRADIENT_START', this.appThemeScheme), 0.077], [readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 0.923]],
    })
    .borderRadius(this.projectionCoverRadius(expandedLayout, index))
    .clip(true)
    // Alpha belongs to the complete cover, including the fallback's paper,
    // rules and text. Otherwise the fading paper can cover the lower text
    // before its own fading glyphs draw. Keep this group stable at rest too.
    .renderGroup(true)
    .opacity(this.projectionCoverLayerOpacity(morphLayer))
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private projectionGridDetails(book: ShelfBook, expandedLayout: boolean) {
    Column({ space: BOOKSHELF_GRID_TEXT_GAP }) {
      Text(book.title)
        .width(this.shelfBookCardWidth(expandedLayout))
        .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_TITLE.lineHeightFp}fp`)
        .letterSpacing(TYPE_SHELF_LIST_TITLE.letterSpacingFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
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
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .maxLines(1);
      }
    }
    .width(this.shelfBookCardWidth(expandedLayout))
    .alignItems(HorizontalAlign.Start)
    .translate({ y: this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout) + BOOKSHELF_GRID_TEXT_GAP })
    .opacity(this.viewSwitchGridContentOpacity)
    .accessibilityLevel(this.viewMode === 'cover' ? 'auto' : 'no-hide-descendants')
    .enabled(this.viewMode === 'cover')
    .hitTestBehavior(this.viewMode === 'cover' ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private projectionListDetails(book: ShelfBook, expandedLayout: boolean) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ShelfBookListDetails({ book })
        .layoutWeight(1).constraintSize({ minWidth: 0 });

      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'))).width(44).height(44);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .attributeModifier(new ReaderActionAccessibility(`${book.title}更多操作`))
      .onClick(this.bookActionPresentationHandler(book));
    }
    .width(this.projectionListDetailsWidth(expandedLayout))
    .height(this.listCoverHeight(expandedLayout))
    .alignItems(VerticalAlign.Center)
    .translate({ x: this.listCoverWidth(expandedLayout) + TOK_SPACE_CONTROL_INLINE })
    .opacity(this.viewSwitchListContentOpacity)
    // None skips only this Row. Disable its retained More button whenever the
    // list projection is hidden so it cannot intercept a neighboring cover.
    .accessibilityLevel(this.viewMode === 'list' ? 'auto' : 'no-hide-descendants')
    .enabled(this.viewMode === 'list')
    .hitTestBehavior(this.viewMode === 'list' ? HitTestMode.Default : HitTestMode.None);
  }



  private presentBookActionSheet(book: ShelfBook): void {
    if (!this.mounted || this.actionBook !== undefined || !this.books.some((candidate: ShelfBook): boolean => candidate.sourceId === book.sourceId && candidate.bookId === book.bookId)) return;
    this.actionSheetId = `bookshelf-action:${++this.actionSheetRevision}`;
    this.actionSheetNavigation = this.navigationGeneration;
    this.actionSheetAppearedId = '';
    this.pendingBookAction = undefined;
    this.actionBook = book;
    this.bookActionSheetVisible = true;
  }

  private isCurrentBookActionSheet(presentationId: string, book: ShelfBook | undefined): boolean {
    // Builder arguments unwrap State proxies; the opening and compound book
    // identity own this callback across both representations.
    return this.mounted && this.bookActionSheetVisible && this.actionSheetNavigation === this.navigationGeneration && presentationId.length > 0 && presentationId === this.actionSheetId &&
      book !== undefined && this.actionBook !== undefined && this.actionBook.sourceId === book.sourceId && this.actionBook.bookId === book.bookId && this.books.some(
        (candidate: ShelfBook): boolean => candidate.sourceId === book.sourceId && candidate.bookId === book.bookId);
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
    this.pendingBookAction = undefined;
    this.bookActionSheetVisible = false;
    this.actionBook = undefined;
    this.actionSheetId = '';
    this.actionSheetAppearedId = '';
    if (this.actionSheetChromeId === presentationId) {
      this.actionSheetChromeId = '';
      if (this.isCurrentChromeHost(this.navigationGeneration)) ReaderWindowCoordinator.requestAppChrome();
    }
    if (navigation === this.navigationGeneration && action !== undefined) action();
  }

  private performBookAction(presentationId: string, book: ShelfBook | undefined, action: (book: ShelfBook, navigation?: number) => void): void {
    if (!this.isCurrentBookActionSheet(presentationId, book) || book === undefined) return;
    const navigation = this.actionSheetNavigation;
    this.pendingBookAction = (): void => action(book, navigation);
    // Keep the keyed content until native onDisappear; otherwise FIT_CONTENT
    // and route navigation can destroy the outgoing sheet before its motion.
    this.bookActionSheetVisible = false;
  }

  private bookActionWidth(): number {
    // Match the source drawer's live width cap, independently of shelf covers.
    return this.resolveContentFrame(new SurfaceWidthSpec(this.bookActionSheetSpec().maxWidth)).width;
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
      : readerFloatingTabContentInset(metrics);
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
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    return readerMainViewport(this.mainViewportRevision).width;
  }

  private isWideViewport(): boolean {
    return readerIsExpandedWidth(this.effectiveViewportWidth());
  }

  private listCoverWidth(expandedLayout: boolean): number {
    return expandedLayout ? TABLET_LIST_COVER_WIDTH : PHONE_LIST_COVER_WIDTH;
  }

  private listCoverHeight(expandedLayout: boolean): number {
    return expandedLayout ? TABLET_LIST_COVER_HEIGHT : PHONE_LIST_COVER_HEIGHT;
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

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private onShelfPresentationChanged(): void {
    // Props update the retained page; revoke only its temporary Sheet.
    this.dismissBookActionSheet(this.actionSheetId, this.actionBook);
    this.headerScrollPublishedNavigation = -1;
    this.publishVisibleReadingBooks();
    this.scheduleReturnMotionOrigin();
    this.scheduleContinueCardMeasurement();
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

  private continueCardAreaHandler(): (_old: Area, _area: Area) => void {
    const navigation = this.navigationGeneration;
    const key = this.continueCardBookKey();
    return (_old: Area, _area: Area): void => {
      if (!this.isShelfPresentationCurrent(navigation) || key !== this.continueCardBookKey()) return;
      this.scheduleContinueCardMeasurement();
    };
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

  private bookCoverMotionId(book: ShelfBook | undefined, continuing: boolean): string {
    return `reader.bookshelf.cover:${this.navigationGeneration}:${continuing ? 'continue' : 'shelf'}:${JSON.stringify([book?.sourceId ?? '', book?.bookId ?? ''])}`;
  }

  private shelfViewportMotionId(): string {
    return `reader.bookshelf.viewport:${this.navigationGeneration}`;
  }

  private measureBookOrigin(book: ShelfBook, continuing: boolean): BookshelfBookOrigin | undefined {
    if (!this.mounted || this.viewSwitchRunning || this.reduceMotion) return undefined;
    try {
      const context = this.getUIContext();
      const id = this.bookCoverMotionId(book, continuing);
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
      // A partially clipped/offscreen cover cannot safely own a shared actor.
      // Exclude the persistent header and floating navigation overlap as well.
      if (position.x < bounds.x - 0.5 || position.x + width > bounds.x + viewportWidth + 0.5 ||
        position.y < bounds.y + this.shelfHeaderClearance() - 0.5 ||
        position.y + height > bounds.y + viewportHeight - this.shelfContentEndInset() + 0.5) return undefined;
      return {
        sourceId: book.sourceId,
        bookId: book.bookId,
        coverUrl: book.coverUrl ?? '',
        title: book.title,
        rect: { x: position.x, y: position.y, width, height },
        radius: continuing || this.viewMode === 'cover' ? 8 : 6,
      };
    } catch (_error) {
      // Lazy rows can disappear between a route/frame callback and this read.
      return undefined;
    }
  }

  private scheduleReturnMotionOrigin(): void {
    const key = this.returnMotionBookKey;
    const navigation = this.navigationGeneration;
    const request = JSON.stringify([key, navigation]);
    if (!this.mounted || !this.viewportRestored || key.length === 0 || this.reduceMotion ||
      request === this.returnMotionReported || request === this.returnMotionFrameQueued) return;
    this.returnMotionFrameQueued = request;
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (this.returnMotionFrameQueued === request) this.returnMotionFrameQueued = '';
      if (!this.isShelfPresentationCurrent(navigation) || !this.viewportRestored ||
        key !== this.returnMotionBookKey || request === this.returnMotionReported) return;
      const continuing = key === this.viewState.openedBookKey && this.viewState.openedFromContinueReading;
      let book: ShelfBook | undefined = continuing && this.continueReading !== undefined &&
        JSON.stringify([this.continueReading.sourceId, this.continueReading.bookId]) === key ? this.continueReading : undefined;
      if (!continuing) {
        for (let index = 0; index < this.rowDataSource.totalCount() && book === undefined; index += 1) {
          book = this.rowDataSource.getData(index).find((candidate: ShelfBook): boolean =>
            JSON.stringify([candidate.sourceId, candidate.bookId]) === key);
        }
      }
      if (book === undefined) return;
      const origin = this.measureBookOrigin(book, continuing);
      if (origin === undefined) return;
      this.returnMotionReported = request;
      this.onReturnMotionOrigin(origin, navigation);
    }));
  }

  private bookSelectionHandler(provider: () => ShelfBook | undefined, continuing: boolean = false): () => void {
    const navigation = this.navigationGeneration;
    return (): void => {
      if (!this.isShelfPresentationCurrent(navigation) || this.actionBook !== undefined) return;
      const book = provider();
      if (book === undefined) return;
      this.viewState.openedBookKey = JSON.stringify([book.sourceId, book.bookId]);
      this.viewState.openedFromContinueReading = continuing;
      this.saveShelfViewport();
      this.onBookSelected(book, navigation, this.measureBookOrigin(book, continuing));
    };
  }

  private bookActionPresentationHandler(book: ShelfBook): () => void {
    const navigation = this.navigationGeneration;
    return (): void => { if (this.isShelfPresentationCurrent(navigation)) this.presentBookActionSheet(book); };
  }

  private shelfPageHandler(previous: boolean): () => void {
    const navigation = this.navigationGeneration;
    return (): void => {
      if (!this.isShelfPresentationCurrent(navigation)) return;
      if (previous) this.onPreviousPageRequested(navigation); else this.onNextPageRequested(navigation);
    };
  }

  private shelfScrollHandler(): (start: number) => void {
    const navigation = this.navigationGeneration;
    return (start: number): void => {
      if (!this.isShelfPresentationCurrent(navigation) || !this.viewportRestored) return;
      this.firstVisibleItem = start;
      this.saveShelfViewport(); this.publishVisibleReadingBooks();
      if (start <= this.shelfHeaderItems() + 4) this.onPreviousPageRequested(navigation);
      if (start + 8 >= this.shelfHeaderItems() + this.rowDataSource.totalCount()) this.onNextPageRequested(navigation);
    };
  }

  private shelfViewportScrollHandler(): () => void {
    const navigation = this.navigationGeneration;
    return (): void => {
      if (!this.isShelfPresentationCurrent(navigation) || !this.viewportRestored) return;
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
    if (this.actionBook !== undefined && !this.books.some((candidate: ShelfBook): boolean =>
      candidate.sourceId === this.actionBook?.sourceId && candidate.bookId === this.actionBook?.bookId)) {
      this.dismissBookActionSheet(this.actionSheetId, this.actionBook);
    }
    this.queueShelfProjection();
  }

  private rebuildShelfProjection(): void {
    const visible = this.serverFiltered ? this.books : ShelfBookPresentation.visible(this.books, '', 'all', this.sourceFilter).filter((book: ShelfBook): boolean => this.contentFilter === 'all' || (book.contentKind === 'manga' ? 'manga' : 'text') === this.contentFilter);
    this.visibleBookCount = visible.length;
    const rows: ShelfBook[][] = [];
    for (let index = 0; index < visible.length; index += 3) {
      rows.push(visible.slice(index, index + 3));
    }
    const oldFirst = this.rowDataSource.totalCount() > 0 ? this.rowDataSource.getData(0)[0] : undefined;
    const newFirst = rows.length > 0 ? rows[0][0] : undefined;
    const shifted = oldFirst !== undefined && newFirst !== undefined &&
      (oldFirst.sourceId !== newFirst.sourceId || oldFirst.bookId !== newFirst.bookId);
    const restore = shifted && this.mounted && this.viewportRestored && this.viewState.anchorKey.length > 0;
    // Native reload can synchronously report a new index. Fence that callback
    // before replacing rows so it cannot overwrite the old book/Y anchor.
    if (restore) this.viewportRestored = false;
    this.rowDataSource.replace(rows);
    if (restore) this.restoreShelfViewport();
    else {
      this.publishVisibleReadingBooks();
      this.scheduleReturnMotionOrigin();
    }
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
      book.sourceId, book.bookId, book.title, book.author,
      book.sourceName ?? '', book.coverUrl ?? '', book.contentKind ?? '', book.currentChapterTitle ?? '',
      book.currentChapterIndex ?? -1, book.chapterCount ?? -1, book.lastChapter ?? '',
      book.unreadCount ?? 0, book.readProgress ?? 0,
      book.readingPosition?.chapterIndex ?? -1, book.readingPosition?.chapterOffset ?? -1,
      book.readingPosition?.updatedAt ?? -1, book.readingPosition?.locationRevision ?? '',
      book.readingPosition?.bodyVersion ?? '', book.readingPosition?.processingVersion ?? '',
    ]));
  }

  private async persistRequestedViewMode(mode: BookshelfViewMode, revision: number): Promise<boolean> {
    const snapshot = await this.viewModeHost.save(mode, (): boolean => this.mounted && revision === this.viewModeRevision);
    if (snapshot === undefined) return false;
    if (snapshot.canonical !== undefined) this.confirmedViewMode = snapshot.canonical;
    if (this.mounted && revision === this.viewModeRevision) {
      this.viewModeSnapshot = snapshot;
      this.viewModeError = this.viewModeRecovery().message;
      this.modeFeedback();
      if (snapshot.receipt?.receipt.confirmation !== 'confirmed') this.applyViewModeSnapshot(snapshot);
    }
    return snapshot.receipt?.receipt.confirmation === 'confirmed';
  }

  private setViewMode(mode: BookshelfViewMode): void {
    if (!this.mounted || !this.viewModeHost.canSave()) return;
    this.modeReconcileBusy = false;
    const revision = ++this.viewModeRevision;
    this.requestedViewMode = mode;
    this.viewModeReadFailed = false;
    this.storedViewMode = mode;
    this.viewModeError = '';
    void this.persistRequestedViewMode(mode, revision).catch((error: Error): void => {
      if (!this.mounted || revision !== this.viewModeRevision) return;
      this.storedViewMode = this.confirmedViewMode;
      this.resetViewSwitchMotion();
      this.viewMode = this.confirmedViewMode;
      this.setRestingProjectionOpacity(this.confirmedViewMode);
      this.viewModeError = error.message === 'BOOKSHELF_RESTORE_PENDING' ?
        '请先在同步设置中重试未完成的恢复' : '显示方式保存失败，点击重试';
    });
    if (this.reduceMotion) {
      this.resetViewSwitchMotion();
      this.viewMode = mode;
      this.setRestingProjectionOpacity(mode);
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
    this.settleFilterPanel();
    if (!this.viewSwitchRunning) return;
    const target = this.pendingViewMode;
    this.resetViewSwitchMotion();
    this.viewMode = target;
    this.setRestingProjectionOpacity(target);
  }

  private startViewSwitch(mode: BookshelfViewMode): void {
    const token = ++this.viewSwitchToken;
    this.pendingViewMode = mode;
    this.viewSwitchSourceMode = this.viewMode;
    this.viewSwitchDestinationMode = mode;
    this.viewSwitchTimeMs = 0;
    this.viewTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
    this.viewTimeline.retarget(true, readerMotionNowMs());
    this.viewSwitchRunning = true;
    this.sampleViewSwitch();
    this.scheduleViewSwitchFrame(token);
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
    // Cover continuity is independent of the text reveal. In G, the upper
    // cover fades at 690–720ms but text is not opaque until 820ms. In H, the
    // upper cover fades in at 150–180ms. A second partial alpha beneath either
    // handoff dims the same book before it brightens again (most visible on
    // NoCoverCover's text/rules). The lower actor must remain opaque.
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

  private projectionListProgress(index: number, scale: boolean = false): number {
    if (!this.viewSwitchRunning || this.reduceMotion) return this.viewMode === 'list' ? 1 : 0;
    const progress = motionSegment(this.viewSwitchTimeMs,
      this.viewMotion.layoutCommitMs + bookshelfViewCoverDelayMs(index),
      scale ? this.viewMotion.coverScaleDurationMs : this.viewMotion.coverMoveDurationMs,
      (p: number): number => scale ? this.viewMotion.coverScaleCurve.interpolate(p) :
        this.viewMotion.coverMoveCurve.interpolate(p));
    return this.viewSwitchDestinationMode === 'list' ? progress : 1 - progress;
  }

  private projectionRowHeight(row: ShelfBook[], expandedLayout: boolean, index: number): number {
    let grid = 0;
    for (const book of row) grid = Math.max(grid, this.gridBookCardHeight(book, expandedLayout));
    const list = row.length * this.listCoverHeight(expandedLayout) +
      Math.max(0, row.length - 1) * TOK_SPACE_CONTROL_INLINE;
    return grid + (list - grid) * this.projectionListProgress(index);
  }

  private projectionBookWidth(expandedLayout: boolean, index: number): number {
    const grid = this.shelfBookCardWidth(expandedLayout);
    return grid + (this.shelfContentWidth(expandedLayout) - grid) * this.projectionListProgress(index);
  }

  private projectionBookHeight(book: ShelfBook, expandedLayout: boolean, index: number): number {
    const grid = this.gridBookCardHeight(book, expandedLayout);
    return grid + (this.listCoverHeight(expandedLayout) - grid) * this.projectionListProgress(index);
  }

  private projectionBookTranslateX(columnIndex: number, expandedLayout: boolean, index: number): number {
    return columnIndex * (this.shelfBookCardWidth(expandedLayout) +
      this.bookRowSpace(this.shelfContentWidth(expandedLayout), expandedLayout)) * (1 - this.projectionListProgress(index));
  }

  private projectionBookTranslateY(columnIndex: number, expandedLayout: boolean, index: number): number {
    return columnIndex * (this.listCoverHeight(expandedLayout) + TOK_SPACE_CONTROL_INLINE) * this.projectionListProgress(index);
  }

  private projectionCoverScale(expandedLayout: boolean, index: number): number {
    const list = this.listCoverWidth(expandedLayout) / this.shelfBookCardWidth(expandedLayout);
    return 1 + (list - 1) * this.projectionListProgress(index, true);
  }

  private projectionCoverRadius(expandedLayout: boolean, index: number): number {
    const list = 6 / (this.listCoverWidth(expandedLayout) / this.shelfBookCardWidth(expandedLayout));
    return 8 + (list - 8) * this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationX(expandedLayout: boolean, index: number): number {
    return -(this.shelfBookCardWidth(expandedLayout) - this.listCoverWidth(expandedLayout)) / 2 *
      this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationY(expandedLayout: boolean, index: number): number {
    return -(this.bookCardHeight(this.shelfBookCardWidth(expandedLayout), expandedLayout) -
      this.listCoverHeight(expandedLayout)) / 2 * this.projectionListProgress(index, true);
  }

  private projectionListDetailsWidth(expandedLayout: boolean): number {
    return Math.max(
      0,
      this.shelfContentWidth(expandedLayout) -
        this.listCoverWidth(expandedLayout) - TOK_SPACE_CONTROL_INLINE,
    );
  }

  private projectionCoverLayerOpacity(morphLayer: boolean): number {
    return morphLayer
      ? this.viewSwitchMorphCoverOpacity
      : this.viewSwitchDestinationCoverOpacity;
  }

  private gridBookCardHeight(book: ShelfBook, expandedLayout: boolean): number {
    return bookshelfGridFrame(this.shelfContentWidth(expandedLayout), expandedLayout,
      ReaderWindowCoordinator.metrics().systemFontScale, this.gridProgressLabel(book).length > 0).cardHeight;
  }

  private hasCover(book: ShelfBook | undefined): boolean {
    if (book?.coverUrl === undefined) {
      return false;
    }
    return /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }
}
