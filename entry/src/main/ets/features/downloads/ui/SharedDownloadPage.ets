import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_ACTION } from '../../../ui/foundation/ReaderMessageStyle';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { DOWNLOAD_HEADER_HEIGHT, DOWNLOAD_HEADER_ACTION_WIDTH, DOWNLOAD_HEADER_ACTION_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { readerPageAreaLength, readerPresentedHeaderBottom } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { prepareSharedDownloadFonts } from '../../../ui/foundation/ReaderFonts';
import { DOWNLOAD_VISUAL, downloadVisualColor, downloadOverlayChromeStyle, sharedDownloadSheetMaxHeight, sharedDownloadContentInsets } from './SharedDownloadVisualSpec';
import { SharedDownloadBookCover } from './SharedDownloadBookCover';
import {
  TYPE_DOWNLOAD_CONTROL, TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_TAG,
  TYPE_DOWNLOAD_BOOK_TITLE, TYPE_DOWNLOAD_SHEET_TITLE, TYPE_DOWNLOAD_EMPTY_TITLE,
  TYPE_DOWNLOAD_CONFIRM_TITLE, TYPE_DOWNLOAD_META_LINE,
  TYPE_DOWNLOAD_STORAGE_META, TYPE_DOWNLOAD_STATUS_BODY, TYPE_DOWNLOAD_CONFIRM_BODY,
  TYPE_DOWNLOAD_TAB, TYPE_DOWNLOAD_TAB_SELECTED,
  TYPE_DOWNLOAD_SEARCH, TYPE_DOWNLOAD_LIST_TOOLS, TYPE_DOWNLOAD_SOURCE,
  TYPE_DOWNLOAD_CHAPTER_TITLE, TYPE_DOWNLOAD_QUICK_SELECT,
  TYPE_DOWNLOAD_STORAGE_TOTAL, TYPE_DOWNLOAD_STORAGE_VALUE,
} from './DownloadTypography';
import { TYPE_DOWNLOAD_BODY, TYPE_SELECT_DEFAULT_VALUE } from '../../../ui/foundation/ReaderTypography';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle } from '../../../app/ReaderWindowCoordinator';
import { ReaderInsetsVp, ReaderWindowMetricsSnapshot, readerVisualSafeLeft, readerVisualSafeRight, readerInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import type { DownloadBookView, DownloadChapterView, SharedDownloadFilters, DownloadReadingTarget, DownloadStorageSummary, DownloadStoragePolicyView } from '../presentation/SharedDownloadProjection';
import { filterDownloadBooks, describeDownloadReadingTarget, downloadChapterDetailLabel, formatDownloadStorageBytes, canCleanDownloadStorage, currentDownloadReadingChapterIndex } from '../presentation/SharedDownloadProjection';
import { FrameCallback, TextModifier, SymbolGlyphModifier } from '@kit.ArkUI';
import { readerScrimmedOpaqueColor } from '../../../ui/surfaces/ReaderScrimColor';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import { ReaderChoiceRow } from '../../../ui/controls/ReaderChoiceRow';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { resolveDrawerSpec, resolveActionSheetSpec, readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerAvailableWindowHeight, readerDynamicSurfaceWidth, readerSurfaceMaxHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import type { SharedDownloadReadingControl, SharedDownloadReadingFocus, SharedDownloadUiAction,
  SharedDownloadUiBookTarget, SharedDownloadUiIntent, SharedDownloadViewState } from '../presentation/SharedDownloadUiContract';
import type { SharedDownloadExpectedChapter } from '../application/SharedDownloadCoordinator';

interface DownloadChoice { id: string; label: string; }
interface SharedDownloadScrollAnchor {
  detailKey: string;
  offset: number;
  managing: boolean;
  identity: string;
  presentation: number;
  fonts: number;
  windowRevision: number;
}
class SharedDownloadIdleFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(): void {}
  onIdle(): void { this.action(); }
}

/** Native implementation of the user-approved shared-download-demo.html layout. */
@Component
export struct SharedDownloadPage {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') @Watch('syncOverlayChrome') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('onInputEligibilityChanged') private appForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBooksChanged') books: DownloadBookView[] = [];
  @Prop storageSummary: DownloadStorageSummary = {};
  @Prop storagePolicy: DownloadStoragePolicyView | undefined = undefined;
  @Prop storagePolicyBusy: boolean = false;
  @Prop storageCleanupBusy: boolean = false;
  @Prop @Watch('restoreChapterOffset') loading: boolean = false;
  @Prop @Watch('onMotionPreferenceChanged') reduceMotion: boolean = false;
  @Prop @Watch('onInputEligibilityChanged') covered: boolean = false;
  @Prop @Watch('onErrorChanged') error: string = '';
  @Prop batchRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop @Watch('onPresentationIdentityChanged') presentationIdentity: string = '';
  @Prop initialViewState: SharedDownloadViewState = {
    query: '', type: 'all', state: 'all', sourceId: 'all', sort: 'recent', direction: 'desc',
  };
  isOpeningCurrent: (() => boolean) | undefined = undefined;
  takeReadingFocus: () => SharedDownloadReadingFocus | undefined = (): SharedDownloadReadingFocus | undefined => undefined;
  onViewStateChanged: (state: SharedDownloadViewState) => void = (_state: SharedDownloadViewState): void => {};
  onBack: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onRefreshBatchRecovery: (generation: number) => void = (_generation: number): void => {};
  onRefreshStorage: () => void = (): void => {};
  onOpenBook: (book: DownloadBookView) => void = (_book: DownloadBookView): void => {};
  onIntent: (intent: SharedDownloadUiIntent) => void = (_intent: SharedDownloadUiIntent): void => {};
  onReadTarget: (target: DownloadReadingTarget, current: () => boolean, control: SharedDownloadReadingControl) => void =
    (_target: DownloadReadingTarget, _current: () => boolean, _control: SharedDownloadReadingControl): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};

  @State @Watch('onListFilterChanged') private query: string = '';
  @State private searchInputRevision: number = 0;
  @State @Watch('onListFilterChanged') private bookType: string = 'all';
  @State @Watch('onListFilterChanged') private stateFilter: string = 'all';
  @State @Watch('onListFilterChanged') private sourceFilter: string = 'all';
  @State @Watch('onListFilterChanged') private sortField: string = 'recent';
  @State @Watch('onListFilterChanged') private sortDirection: string = 'desc';
  @State @Watch('onDetailChanged') private detailKey: string = '';
  @State private managing: boolean = false;
  @State private managementGeneration: number = 0;
  @State private selectedBookKeys: string[] = [];
  @State private selectedChapters: Map<number, string> = new Map<number, string>();
  @State @Watch('onSheetChanged') private sheet: string = '';
  @State private filterSourceOptions: DownloadChoice[] = [];
  @State private actionBookKeys: string[] = [];
  @State private actionChapters: SharedDownloadExpectedChapter[] = [];
  @State @Watch('onConfirmationChanged') private confirmation: string = '';
  @State private rangeChoice: string = 'all';
  @State private rangeStart: string = '';
  @State private rangeEnd: string = '';
  @State private rangeBookKey: string = '';
  @State private rangeBookOptions: DownloadChoice[] = [];
  @State private rangeDraftRevision: number = 0;
  @State private rangeCatalog: SharedDownloadExpectedChapter[] | undefined = undefined;
  @State private rangeCatalogChanged: boolean = false;
  @State private fontsReady: boolean = false;
  @State private fontsFailed: boolean = false;
  @State private pageHeight: number = 0;
  // topBar renders in the fixed host or inline when chrome overflows; its own
  // measurement survives both placements. Wiring the scaffold callback would
  // feed back into mainChromeOverflow and oscillate.
  @State private measurementRevision: number = 0;
  @State private storageDockShape: ReaderRaisedShape | undefined = undefined;
  @State private selectionDockShape: ReaderRaisedShape | undefined = undefined;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @State private sheetTitleMeasuredHeight: number = DOWNLOAD_VISUAL.sheetTitleHeight;
  @State private operationsHeaderMeasuredHeight: number = 0;
  @State private bookOperationsBodyMeasuredHeight: number = 0;
  @State private dialogActionsMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight;
  @State private sheetFooterMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight + DOWNLOAD_VISUAL.sheetFooterTop + DOWNLOAD_VISUAL.sheetFooterBottom + DOWNLOAD_VISUAL.borderWidth;
  @State private bookCopyHeights: Map<string, number> = new Map<string, number>();
  @State private bookContentHeights: Map<string, number> = new Map<string, number>();
  private listScroller: Scroller = new Scroller();
  private chapterScroller: Scroller = new Scroller();
  private listOffset: number = 0;
  private chapterOffset: number = 0;
  private chapterLayoutReady: boolean = false;
  private chapterScrollRestorePending: boolean = false;
  private chapterScrollRestoreScheduled: boolean = false;
  private managingScrollRestore: SharedDownloadScrollAnchor | undefined;
  private managingScrollAnchor: SharedDownloadScrollAnchor | undefined;
  private managingDockMeasured: boolean = false;
  private mountedIdentity: string = '';
  private mounted: boolean = false;
  private fontPreparationGeneration: number = 0;
  private presentationGeneration: number = 0;
  private overlayChromeClaimed: boolean = false;
  private overlayChromeRequestGeneration: number = 0;
  private sheetWasVisible: boolean = false;
  private sheetMaskReady: boolean = false;
  @State private sheetExitPending: boolean = false;
  // One mounted download-sheet opening only. These are Native presentation
  // actors, not download/confirmation/operation state.
  private sheetActorGeneration: number = 0;
  private sheetActorAttachment: number = 0;
  private sheetActorOwner: number = -1;
  private sheetActors: string[] = [];
  @State private sheetOpeningGeneration: number = 0;
  @State private confirmationGeneration: number = 0;
  private previousConfirmation: string = '';
  private sheetTriggerKey: string = '';
  private managingTriggerKey: string = 'manage';
  private focusGeneration: number = 0;
  private readingHandoffRevision: number = 0;
  private readingReturnFocus: SharedDownloadReadingFocus | undefined;

  aboutToAppear(): void {
    this.presentationGeneration += 1;
    this.measurements.clear();
    this.storageDockShape = undefined;
    this.selectionDockShape = undefined;
    this.mountedIdentity = this.presentationIdentity;
    this.query = this.initialViewState.query;
    this.bookType = this.initialViewState.type;
    this.stateFilter = this.initialViewState.state;
    this.sourceFilter = this.initialViewState.sourceId;
    this.sortField = this.initialViewState.sort;
    this.sortDirection = this.initialViewState.direction;
    this.detailKey = this.initialViewState.detailKey ?? '';
    this.listOffset = this.initialViewState.listScroll ?? 0;
    this.chapterOffset = this.initialViewState.chapterScroll ?? 0;
    this.chapterLayoutReady = false;
    this.chapterScrollRestorePending = this.detailKey.length > 0;
    this.chapterScrollRestoreScheduled = false;
    this.mounted = true;
    this.onSheetChanged();
    this.readingReturnFocus = this.takeReadingFocus();
    this.prepareFonts();
    this.onErrorChanged();
    this.onTemporaryBackBridge((): boolean => this.consumeBack(), this.mountedIdentity);
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    this.fontPreparationGeneration += 1;
    this.publishViewState();
    // The scene may retire before ArkUI destroys its child. Release chrome
    // already acquired by this mount even though its input lease has ended.
    const restoreChrome = this.overlayChromeClaimed && this.mounted && this.presentationIdentity === this.mountedIdentity;
    this.presentationGeneration += 1;
    this.overlayChromeRequestGeneration += 1;
    this.retireSheetActors();
    this.focusGeneration += 1;
    this.readingReturnFocus = undefined;
    this.sheetWasVisible = false;
    this.sheetMaskReady = false;
    this.sheetExitPending = false;
    this.chapterLayoutReady = false;
    this.chapterScrollRestorePending = false;
    this.chapterScrollRestoreScheduled = false;
    this.mounted = false;
    this.measurements.clear();
    this.cancelManagingScroll();
    this.overlayChromeClaimed = false;
    if (restoreChrome) ReaderWindowCoordinator.requestAppChrome();
    this.onTemporaryBackBridge(undefined, this.mountedIdentity);
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.pageGeometry(),
      content: (): void => { this.pageContent(); },
      header: (): void => { this.fixedHeader(); },
      footer: (): void => { this.fixedDock(); },
      overlayContent: (): void => { this.pageOverlays(); },
    }).onAreaChange((_old: Area, area: Area): void => {
      const height = readerPageAreaLength(area.height);
      if (Number.isFinite(height) && height > 0 && Math.abs(height - this.pageHeight) > 0.5) this.pageHeight = height;
    });
  }

  @Builder
  private pageContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.pageBody();
    }.width('100%').height('100%').enabled(!this.modalBlocking())
      .accessibilityLevel(this.modalBlocking() ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.modalBlocking() ? HitTestMode.None : HitTestMode.Default);
  }

  @Builder
  private pageBody() {
    if (!this.fontsReady) {
      Column() {
        ReaderPageState({ title: this.fontsFailed ? '阅读字体暂不可用' : '正在准备下载管理…',
          loading: !this.fontsFailed, actionLabel: this.fontsFailed ? '重试' : '',
          onAction: (): void => { if (this.uiInputIsCurrent()) this.prepareFonts(); } });
      }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(), top: this.contentTop() });
    } else if (this.detail() !== undefined) {
      this.chapterPage(this.bookGetter(this.detail() as DownloadBookView));
    } else {
      this.bookPage();
    }
  }

  @Builder
  private fixedHeader() {
    if (this.fontsReady && !this.mainChromeOverflow()) {
      Column() { this.topBar(); }.width('100%')
        .padding({ top: this.headerTop(), left: this.leftInset(), right: this.rightInset() })
        .enabled(!this.modalBlocking())
        .accessibilityLevel(this.modalBlocking() ? 'no-hide-descendants' : 'auto')
        .hitTestBehavior(this.modalBlocking() ? HitTestMode.None : HitTestMode.Transparent);
    }
  }

  @Builder
  private fixedDock() {
    if (this.fontsReady && !this.mainChromeOverflow()) {
      Column() {
        if (this.managing || this.detail() !== undefined) { this.selectionDock(); }
        else { this.storageDock(); }
      }.width('100%').enabled(!this.modalBlocking())
        .accessibilityLevel(this.modalBlocking() ? 'no-hide-descendants' : 'auto')
        .hitTestBehavior(this.modalBlocking() ? HitTestMode.None : HitTestMode.Transparent);
    }
  }

  @Builder
  private pageOverlays() {
    if (this.batchRecovery.visible && this.appForeground && !this.covered && !this.modalBlocking()) {
      Column() {
        ReaderRecoveryNotice({ view: this.batchRecovery, tag: '下载待处理', actionLabel: '刷新列表', busy: this.loading,
          onReconcile: (generation: number): void => {
            if (this.uiInputIsCurrent() && !this.modalBlocking() &&
              this.batchRecovery.visible && generation === this.batchRecovery.generation) this.onRefreshBatchRecovery(generation);
          } });
      }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(), top: this.contentTop() })
        .hitTestBehavior(HitTestMode.Transparent);
    }
    if (this.sheet.length > 0 || this.sheetExitPending) {
      // Keep an empty carrier until its actually mounted Native actors exit.
      ForEach([this.sheetActorAttachment], (attachment: number): void => {
        Stack() { this.sheetOverlay(attachment, this.sheetActorOwner); }.width('100%').height('100%')
          // Keep the operations sheet mounted so cancel can return to it.
          // The confirmation still paints over the underlying page.
          .opacity(this.isOperationsSheet() && this.confirmation.length > 0 ? 0 : 1)
          .enabled(this.confirmation.length === 0)
          .accessibilityLevel(this.confirmation.length > 0 ? 'no-hide-descendants' : 'auto')
          .hitTestBehavior(this.confirmation.length > 0 ? HitTestMode.None : HitTestMode.Transparent);
      }, (attachment: number): string => attachment.toString());
    }
    if (this.confirmation.length > 0) {
      ForEach([this.confirmationGeneration], (opening: number): void => { this.confirmationOverlay(opening); },
        (opening: number): string => opening.toString());
    }
  }

  private lastErrorFeedback: string = '';
  private lastChapterFeedback: string = '';
  private onErrorChanged(): void {
    if (!this.error) { this.lastErrorFeedback = ''; return; }
    if (!this.mounted || !this.presentationIsCurrent() || this.books.length === 0 || !this.error || this.error === this.lastErrorFeedback) return;
    this.lastErrorFeedback = this.error;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: this.error, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.presentationIsCurrent()); } catch (_) {}
  }
  private onBooksChanged(): void {
    this.onErrorChanged();
    this.syncRangeCatalog();
    this.restoreChapterOffset();
    const book = this.detail();
    if (book?.projectionStatus === 'ready' && this.selectedChapters.size > 0) {
      const retained = new Map<number, string>();
      for (const chapter of book.chapters) {
        if (chapter.navigable && this.chapterSelected(chapter)) retained.set(chapter.index, chapter.chapterId);
      }
      if (retained.size !== this.selectedChapters.size) this.selectedChapters = retained;
    }
    if (book?.projectionStatus !== 'unavailable') { this.lastChapterFeedback = ''; return; }
    if (!this.mounted || !this.presentationIsCurrent() || book.chapters.length === 0) return;
    const message = book.projectionError ?? '章节下载情况暂不可用';
    const identity = JSON.stringify([book.key, message]);
    if (identity === this.lastChapterFeedback) return;
    this.lastChapterFeedback = identity;
    try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted && this.presentationIsCurrent()); } catch (_) {}
  }

  @Builder
  private topBar() {
    PageBackBar({ variant: 'download', title: this.detail() === undefined ? '下载管理' : '章节下载',
      backFocusId: this.focusKey('page-back'),
      backLabel: this.managing ? '退出管理' : this.detailKey.length > 0 ? '返回书籍列表' : '返回',
      onBack: (): void => this.back(), onHeightChange: this.headerHeightChangeHandler(),
      trailing: (): void => { this.manageHeaderAction(); },
    });
  }

  @Builder
  private manageHeaderAction() {
    Button({ type: ButtonType.Normal }) {
      Text(this.managing ? '完成' : '管理').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily)
        .fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp)
        .lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
    }.id(this.focusKey('manage')).width(DOWNLOAD_HEADER_ACTION_WIDTH)
      .constraintSize({ minHeight: DOWNLOAD_HEADER_ACTION_HEIGHT }).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .responseRegion(readerActionTouchRegion(DOWNLOAD_HEADER_ACTION_WIDTH, DOWNLOAD_HEADER_ACTION_HEIGHT))
      .enabled(this.books.length > 0).opacity(this.books.length > 0 ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => {
        if (this.uiInputIsCurrent()) this.setManaging(!this.managing);
      });
  }

  @Builder
  private compactHeader() {
    Column() { this.topBar(); }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(),
      top: this.headerTop(), bottom: this.contentTop() - this.headerTop() - this.resolvedHeaderHeight() });
  }

  @Builder
  private compactDock() {
    Column() {
      if (this.managing || this.detail() !== undefined) { this.selectionDock(); }
      else { this.storageDock(); }
    }.width('100%').padding({ left: this.dockLeftInset(), right: this.dockRightInset(),
      top: DOWNLOAD_VISUAL.dockBottom, bottom: this.bottomInset() });
  }

  @Builder
  private bookPage() {
    List({ scroller: this.listScroller }) {
      if (this.mainChromeOverflow()) { ListItem() { this.compactHeader(); } }
      ListItem() { Column() { this.listControls(); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      if (this.loading && this.books.length === 0) {
        ListItem() { Column() { ReaderPageState({ title: '正在读取书架…', loading: true }); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      } else if (this.error.length > 0 && this.books.length === 0) {
        ListItem() { Column() { ReaderPageState({ title: '下载信息读取失败', message: this.error, actionLabel: '重试', onAction: (): void => { if (this.uiInputIsCurrent()) this.onRefresh(); } }); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      if (this.visibleBooks().length === 0 && !this.loading && !(this.error.length > 0 && this.books.length === 0)) {
        ListItem() {
          Column() {
            ReaderPageState({ title: this.books.length === 0 ? '书架为空' : '没有匹配的书籍',
              message: this.books.length === 0 ? '加入书架后，可在这里管理下载' : '调整搜索关键词或筛选条件' });
          }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() });
        }
      }
      ForEach(this.visibleBooks(), (book: DownloadBookView) => {
        ListItem() { Column() { this.bookRow(this.bookGetter(book), false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }, (book: DownloadBookView): string => book.key);
      if (this.mainChromeOverflow()) { ListItem() { this.compactDock(); } }
    }.width('100%').height('100%').scrollBar(BarState.Auto).onScrollStop((): void => this.publishViewState())
      .onTouch((event: TouchEvent): void => this.onListTouch(event))
      .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
      .contentEndOffset(readerScrollEndOffset(this.scrollLayout()));
  }

  @Builder
  private listControls() {
    ForEach([this.searchInputIdentity()], (identity: string): void => {
    Column({ space: 0 }) {
      this.searchField(identity);
      Row({ space: DOWNLOAD_VISUAL.tabsGap }) {
        this.typeTab('all', '全部', identity);
        this.typeTab('manga', '漫画', identity);
        this.typeTab('novel', '小说', identity);
      }.width('100%').padding(DOWNLOAD_VISUAL.tabsPadding).backgroundColor(downloadVisualColor('soft', this.appThemeScheme)).borderRadius(DOWNLOAD_VISUAL.tabsRadius)
        .margin({ top: DOWNLOAD_VISUAL.tabsTop, bottom: DOWNLOAD_VISUAL.tabsBottom });
      Row({ space: DOWNLOAD_VISUAL.listToolsGap }) {
        Button({ type: ButtonType.Normal }) {
          Row({ space: DOWNLOAD_VISUAL.listToolIconGap }) {
            Image(this.visualIcon('filter'))
              .width(DOWNLOAD_VISUAL.listToolIconSize).height(DOWNLOAD_VISUAL.listToolIconSize);
            Text(this.filterLabel()).fontFamily(TYPE_DOWNLOAD_LIST_TOOLS.fontFamily).fontWeight(TYPE_DOWNLOAD_LIST_TOOLS.fontWeight)
              .fontSize(TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp).lineHeight(TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor('ink', this.appThemeScheme));
          }
        }.padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY }).constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolHeight }).borderRadius(0).backgroundColor(Color.Transparent)
          .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget }).id(this.focusKey('filter')).onClick((): void => {
            if (this.searchInputIsCurrent(identity)) this.openSheet('filter', 'filter');
          });
        Row({ space: DOWNLOAD_VISUAL.sortPairGap }) {
          Button({ type: ButtonType.Normal }) { this.sortBars(); }
            .width(DOWNLOAD_VISUAL.sortWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolHeight }).padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY }).borderRadius(0).backgroundColor(Color.Transparent)
            .responseRegion({ x: (DOWNLOAD_VISUAL.sortWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget })
            .accessibilityText(this.sortDirection === 'asc' ? '当前正序，切换为倒序' : '当前倒序，切换为正序')
            .onClick((): void => {
              if (this.searchInputIsCurrent(identity)) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            });
          Button({ type: ButtonType.Normal }) {
            Text(this.sortLabel()).fontFamily(TYPE_DOWNLOAD_LIST_TOOLS.fontFamily).fontWeight(TYPE_DOWNLOAD_LIST_TOOLS.fontWeight)
              .fontSize(TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp).lineHeight(TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor('ink', this.appThemeScheme));
          }.padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY }).constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolHeight }).borderRadius(0).backgroundColor(Color.Transparent)
            .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget }).id(this.focusKey('sort')).onClick((): void => {
              if (this.searchInputIsCurrent(identity)) this.openSheet('sort', 'sort');
            });
        }
        Blank().layoutWeight(1);
        Text(`${this.visibleBooks().length} / ${this.books.length} 本书`)
          .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolsHeight }).margin({ bottom: DOWNLOAD_VISUAL.listToolsBottom });
    }.width('100%');
    }, (identity: string): string => identity);
  }

  @Builder
  private searchField(identity: string = this.searchInputIdentity()) {
    Row({ space: DOWNLOAD_VISUAL.searchGap }) {
      Image(this.visualIcon('search')).width(DOWNLOAD_VISUAL.searchIconSize).height(DOWNLOAD_VISUAL.searchIconSize);
      TextInput({ text: this.query, placeholder: '搜索书名、作者、书源' }).layoutWeight(1)
        .fontFamily(TYPE_DOWNLOAD_SEARCH.fontFamily).fontWeight(TYPE_DOWNLOAD_SEARCH.fontWeight)
        .fontSize(TYPE_DOWNLOAD_SEARCH.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SEARCH.lineHeightFp as number)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).placeholderColor(downloadVisualColor('muted', this.appThemeScheme))
        .placeholderFont({ family: TYPE_DOWNLOAD_SEARCH.fontFamily, size: TYPE_DOWNLOAD_SEARCH.fontSizeFp, weight: TYPE_DOWNLOAD_SEARCH.fontWeight })
        .backgroundColor(Color.Transparent).caretColor(downloadVisualColor('ink', this.appThemeScheme)).borderRadius(0)
        .padding({ top: DOWNLOAD_VISUAL.searchPaddingY, bottom: DOWNLOAD_VISUAL.searchPaddingY, left: 0, right: 0 })
        .height(this.textControlHeight(DOWNLOAD_VISUAL.searchHeight - DOWNLOAD_VISUAL.borderWidth * 2,
          DOWNLOAD_VISUAL.searchLineHeight, DOWNLOAD_VISUAL.searchPaddingY * 2))
        .enterKeyType(EnterKeyType.Search).accessibilityText('搜索书架书籍')
        .onChange((value: string): void => this.changeSearchInput(value, identity));
      if (this.query.length > 0) {
        Button({ type: ButtonType.Normal }) {
          Image(this.visualIcon('clear')).width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
        }.width(DOWNLOAD_VISUAL.searchClearWidth).height(DOWNLOAD_VISUAL.headerIconHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .responseRegion({ x: (DOWNLOAD_VISUAL.searchClearWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('清除搜索')
          .onClick((): void => this.clearSearchInput(identity));
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.searchHeight }).padding({ left: DOWNLOAD_VISUAL.searchPaddingX, right: DOWNLOAD_VISUAL.searchPaddingX }).borderRadius(DOWNLOAD_VISUAL.searchRadius)
      .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: readerAppColor('app.border.searchField', this.appThemeScheme) });
  }

  private searchInputIdentity(): string {
    return JSON.stringify([this.mountedIdentity, this.presentationGeneration, this.searchInputRevision]);
  }

  private ownsSearchInput(identity: string): boolean {
    return this.presentationIsCurrent() && this.detailKey.length === 0 && identity === this.searchInputIdentity();
  }

  private searchInputIsCurrent(identity: string): boolean {
    return this.ownsSearchInput(identity) && this.uiInputIsCurrent() && !this.modalBlocking();
  }

  private changeSearchInput(value: string, identity: string): void {
    if (!this.ownsSearchInput(identity)) return;
    if (!this.searchInputIsCurrent(identity)) {
      // A native edit may have painted before its callback lost input rights.
      // Replace only this current field; an old opening cannot rebuild its successor.
      if (value !== this.query) this.searchInputRevision += 1;
      return;
    }
    this.cancelManagingScroll();
    this.query = value; this.selectedBookKeys = []; this.listScroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  private clearSearchInput(identity: string): void {
    if (!this.searchInputIsCurrent(identity) || this.query.length === 0) return;
    this.query = ''; this.selectedBookKeys = [];
  }

  @Builder
  private typeTab(id: string, label: string, identity: string = this.searchInputIdentity()) {
    Button({ type: ButtonType.Normal }) {
      Text(label).fontFamily(this.bookType === id ? TYPE_DOWNLOAD_TAB_SELECTED.fontFamily : TYPE_DOWNLOAD_TAB.fontFamily)
        .fontWeight(this.bookType === id ? TYPE_DOWNLOAD_TAB_SELECTED.fontWeight : TYPE_DOWNLOAD_TAB.fontWeight)
        .fontSize(TYPE_DOWNLOAD_TAB.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAB.lineHeightFp as number).halfLeading(true)
        .fontColor(this.tabInk(id));
    }.constraintSize({ minHeight: DOWNLOAD_VISUAL.tabHeight }).padding({ top: DOWNLOAD_VISUAL.tabPaddingY, bottom: DOWNLOAD_VISUAL.tabPaddingY, left: DOWNLOAD_VISUAL.tabPaddingX, right: DOWNLOAD_VISUAL.tabPaddingX }).layoutWeight(1).borderRadius(DOWNLOAD_VISUAL.tabRadius)
      .fontColor(this.tabInk(id))
      .backgroundColor(this.bookType === id ? downloadVisualColor('surface', this.appThemeScheme) : Color.Transparent)
      .shadow({ radius: this.bookType === id ? DOWNLOAD_VISUAL.tabShadowRadius : 0, color: downloadVisualColor('shadow', this.appThemeScheme), offsetX: DOWNLOAD_VISUAL.tabShadowX, offsetY: DOWNLOAD_VISUAL.tabShadowY })
      .accessibilityText(`${label}${this.bookType === id ? '，已选择' : ''}`)
      .onClick((): void => {
        if (!this.searchInputIsCurrent(identity)) return;
        this.bookType = id; this.selectedBookKeys = [];
      });
  }

  @Builder
  private sortBars() {
    Image(this.visualIcon(this.sortDirection === 'asc' ? 'sort_asc' : 'sort_desc'))
      .width(DOWNLOAD_VISUAL.sortIconSize).height(DOWNLOAD_VISUAL.sortIconSize);
  }

  @Builder
  private bookRow(book: () => DownloadBookView, secondary: boolean, ownerGeneration: number = this.presentationGeneration) {
    Row({ space: DOWNLOAD_VISUAL.bookGap }) {
      Stack() {
        SharedDownloadBookCover({ bookKey: book().key, coverUrl: book().coverUrl ?? '',
          presentationGeneration: ownerGeneration, coverWidth: DOWNLOAD_VISUAL.coverWidth,
          coverHeight: this.bookHeight(book().key) });
      }.width(DOWNLOAD_VISUAL.coverWidth).height(this.bookHeight(book().key)).borderRadius(DOWNLOAD_VISUAL.coverRadius).clip(true)
        .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', this.appThemeScheme) })
        .backgroundColor(downloadVisualColor(book().contentKind === 'manga' ? 'softGreen' : 'soft', this.appThemeScheme))
        .onClick((): void => { if (!secondary) this.openBook(book(), ownerGeneration); });
      Column({ space: 0 }) {
        Column({ space: 0 }) {
        Row({ space: DOWNLOAD_VISUAL.bookTopGap }) {
          Button({ type: ButtonType.Normal }) {
            Flex({ direction: FlexDirection.Row, justifyContent: FlexAlign.Start, alignItems: ItemAlign.Center }) {
              Text(book().title).fontFamily(TYPE_DOWNLOAD_BOOK_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_BOOK_TITLE.fontWeight)
                .fontSize(TYPE_DOWNLOAD_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BOOK_TITLE.lineHeightFp as number).halfLeading(true)
                .fontColor(downloadVisualColor('ink', this.appThemeScheme)).flexShrink(1).textAlign(TextAlign.Start).wordBreak(WordBreak.BREAK_WORD);
              if (!secondary) {
                Image(this.visualIcon('chevron')).width(DOWNLOAD_VISUAL.titleChevronSize).height(DOWNLOAD_VISUAL.titleChevronSize)
                  .flexShrink(0).margin({ left: DOWNLOAD_VISUAL.statusGap });
              }
            }.width('100%');
          }.id(secondary ? '' : this.focusKey('book-title:' + book().key))
            .padding(0).borderRadius(0).backgroundColor(Color.Transparent).layoutWeight(1)
            .constraintSize({ minHeight: DOWNLOAD_VISUAL.bookTopHeight }).onClick((): void => { if (!secondary) this.openBook(book(), ownerGeneration); });
          if (book().contentKind !== undefined) {
            Text(book().contentKind === 'manga' ? '漫画' : '小说')
              .fontFamily(TYPE_DOWNLOAD_TAG.fontFamily).fontWeight(TYPE_DOWNLOAD_TAG.fontWeight)
              .fontSize(TYPE_DOWNLOAD_TAG.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAG.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor('greenInk', this.appThemeScheme))
              .padding({ left: DOWNLOAD_VISUAL.tagPaddingX, right: DOWNLOAD_VISUAL.tagPaddingX }).backgroundColor(downloadVisualColor('green', this.appThemeScheme)).borderRadius(DOWNLOAD_VISUAL.tagRadius);
          }
          if (!secondary) {
            if (this.managing) {
              Checkbox().select(this.selectedBookKeys.includes(book().key)).width(DOWNLOAD_VISUAL.chapterCheckSize).height(DOWNLOAD_VISUAL.chapterCheckSize)
                .selectedColor(downloadVisualColor('green', this.appThemeScheme))
                .unselectedColor(downloadVisualColor('muted', this.appThemeScheme))
                .mark({ strokeColor: downloadVisualColor('greenInk', this.appThemeScheme) })
                .onChange((selected: boolean): void => {
                  const current = this.eventBook(book, ownerGeneration);
                  if (current !== undefined) this.toggleBook(current.key, selected);
                });
            } else {
              this.moreButton((): string => `${book().title}的书籍操作`, (): void => {
                const current = this.eventBook(book, ownerGeneration);
                if (current === undefined) return;
                this.actionBookKeys = [current.key]; this.actionChapters = [];
                this.openSheet('book-actions', 'book-menu:' + current.key);
              }, false, (): string => 'book-menu:' + book().key);
            }
          }
        }.constraintSize({ minHeight: DOWNLOAD_VISUAL.bookTopHeight }).width('100%').alignItems(VerticalAlign.Center);
        Text(this.authorSource(book())).fontFamily(TYPE_DOWNLOAD_SOURCE.fontFamily).fontWeight(TYPE_DOWNLOAD_SOURCE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_SOURCE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SOURCE.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme)).width('100%').wordBreak(WordBreak.BREAK_WORD)
          .constraintSize({ minHeight: DOWNLOAD_VISUAL.sourceLineHeight * this.fontScale() }).margin({ top: DOWNLOAD_VISUAL.sourceTop })
          .onClick((): void => { if (!secondary) this.openBook(book(), ownerGeneration); });
        Row({ space: DOWNLOAD_VISUAL.bookTopGap }) {
          Text(this.downloadCount(book(), secondary)).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('muted', this.appThemeScheme)).layoutWeight(1)
            .onClick((): void => { if (!secondary) this.openBook(book(), ownerGeneration); });
          if (secondary) {
            Text(book().stateLabel === '下载失败' ? '下载失败' : book().totalChapters === undefined ? '' : `目录 ${book().totalChapters}${this.unit(book())}`)
              .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
              .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor(book().stateLabel === '下载失败' ? 'danger' : 'green', this.appThemeScheme))
              .constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight });
          } else if (book().stateLabel.length > 0) {
            this.statusButton(book, ownerGeneration);
          } else {
            Blank().width(DOWNLOAD_VISUAL.statusWidth).height(DOWNLOAD_VISUAL.statusHeight);
          }
        }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight }).margin({ top: DOWNLOAD_VISUAL.progressTop });
        if (book().stateLabel === '下载失败' && (book().downloadError?.trim().length ?? 0) > 0) {
          Text(book().downloadError ?? '').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('danger', this.appThemeScheme)).width('100%').wordBreak(WordBreak.BREAK_WORD)
            .margin({ top: DOWNLOAD_VISUAL.progressGap });
        }
        }.width('100%').alignItems(HorizontalAlign.Start)
          .onAreaChange((_old: Area, area: Area): void => {
            const current = this.eventBook(book, ownerGeneration);
            if (current !== undefined) this.recordBookContentHeight(current.key, readerPageAreaLength(area.height));
          });
        Blank().height(this.bookProgressSpacer(book().key));
        Progress({ value: book().progressPercent ?? 0, total: 100, type: ProgressType.Linear })
          .width('100%').height(DOWNLOAD_VISUAL.progressHeight).color(downloadVisualColor('green', this.appThemeScheme))
          .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .style({ strokeWidth: DOWNLOAD_VISUAL.progressHeight, enableSmoothEffect: false }).visibility(book().progressPercent === undefined ? Visibility.Hidden : Visibility.Visible);
      }.layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.bookMinHeight }).alignItems(HorizontalAlign.Start)
        .onAreaChange((_old: Area, area: Area): void => {
          const current = this.eventBook(book, ownerGeneration);
          if (current !== undefined) this.recordBookHeight(current.key, readerPageAreaLength(area.height));
        });
    }.width('100%').alignItems(VerticalAlign.Top).padding({ top: DOWNLOAD_VISUAL.bookPaddingY, bottom: DOWNLOAD_VISUAL.bookPaddingY })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private statusButton(book: () => DownloadBookView, ownerGeneration: number = this.presentationGeneration) {
    if (book().stateLabel === '已下载') {
      Row({ space: DOWNLOAD_VISUAL.statusGap }) {
        Image(this.statusIcon(book())).width(DOWNLOAD_VISUAL.statusIconSize).height(DOWNLOAD_VISUAL.statusIconSize);
        Text(book().stateLabel).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(this.statusInk(book())).textAlign(TextAlign.Center).layoutWeight(1);
      }.width(DOWNLOAD_VISUAL.statusWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight }).padding({ left: DOWNLOAD_VISUAL.statusPaddingX, right: DOWNLOAD_VISUAL.statusPaddingX }).borderRadius(DOWNLOAD_VISUAL.statusRadius)
        .backgroundColor(downloadVisualColor('soft', this.appThemeScheme));
    } else {
    Button({ type: ButtonType.Normal }) {
      Row({ space: DOWNLOAD_VISUAL.statusGap }) {
        Image(this.statusIcon(book())).width(DOWNLOAD_VISUAL.statusIconSize).height(DOWNLOAD_VISUAL.statusIconSize);
        Text(book().stateLabel === '下载失败' ? '重试' : book().stateLabel).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(this.statusInk(book()))
          .textAlign(TextAlign.Center).layoutWeight(1);
      }.width('100%');
    }.id(this.focusKey('book-status:' + book().key)).width(DOWNLOAD_VISUAL.statusWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight }).padding({ left: DOWNLOAD_VISUAL.statusPaddingX, right: DOWNLOAD_VISUAL.statusPaddingX }).borderRadius(DOWNLOAD_VISUAL.statusRadius)
      .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
      .enabled(!this.managing).opacity(this.managing ? DOWNLOAD_VISUAL.disabledOpacity : 1)
      .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.statusHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget })
      .accessibilityText(`${book().title}，${book().stateLabel}${this.bookIsRunning(book()) ? '，暂停' : book().stateLabel === '下载失败' ? '，重试' : ''}`)
      .onClick((): void => {
        const current = this.eventBook(book, ownerGeneration);
        if (this.managing || current === undefined) return;
        this.actionBookKeys = [current.key]; this.actionChapters = [];
        if (this.bookIsRunning(current)) this.sendAction('pause');
        else { this.prepareRange(current.key); this.openSheet('range', 'book-status:' + current.key); }
      });
    }
  }

  @Builder
  private chapterToolbar(book: () => DownloadBookView, ownerGeneration: number = this.presentationGeneration) {
    Row({ space: DOWNLOAD_VISUAL.chapterToolbarGap }) {
      Text('章节内容').fontFamily(TYPE_DOWNLOAD_BOOK_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_BOOK_TITLE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BOOK_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme)).layoutWeight(1);
      if (this.managing) {
        ReaderInlineSelect({
          value: '快速选择',
          options: ['快速选择', '当前章节', '从当前往后', '全部章节'],
          controlWidth: this.selectClosedWidth('快速选择', ['快速选择', '当前章节', '从当前往后', '全部章节'],
            DOWNLOAD_VISUAL.chapterToolbarSelectMaxWidth, '章节内容', true),
          onSelect: (index: number, _value: string): void => {
            const current = this.eventBook(book, ownerGeneration);
            if (current !== undefined && this.detailKey === current.key) this.quickSelectChapters(index);
          },
        });
      } else {
        Text(book().totalChapters === undefined ? '' : `共 ${book().totalChapters}${this.unit(book())}`)
          .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      }
    }.width('100%').padding({ top: DOWNLOAD_VISUAL.chapterToolbarTop, bottom: DOWNLOAD_VISUAL.chapterToolbarBottom });
  }

  @Builder
  private chapterPage(book: () => DownloadBookView, ownerGeneration: number = this.presentationGeneration) {
    List({ scroller: this.chapterScroller }) {
      if (this.mainChromeOverflow()) { ListItem() { this.compactHeader(); } }
      ListItem() { Column() { this.bookRow(book, true, ownerGeneration); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      ListItem() { Column() { this.chapterToolbar(book, ownerGeneration); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      if (book().projectionStatus === 'unloaded' && book().chapters.length === 0) {
        ListItem() { Column() { ReaderPageState({ title: '正在读取章节下载情况…', loading: true }); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      } else if (book().projectionStatus === 'unavailable' && book().chapters.length === 0) {
        ListItem() { Column() { ReaderPageState({ title: '章节下载情况暂不可用', message: book().projectionError ?? '', actionLabel: '重试',
          onAction: (): void => { if (this.uiInputIsCurrent(ownerGeneration)) this.onOpenBook(book()); } }); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      ForEach(book().chapters, (chapter: DownloadChapterView) => {
        ListItem() {
          Column() {
            if (this.currentChapterView(book(), chapter).navigable) { this.chapterRow(book, this.chapterGetter(book, chapter), ownerGeneration); }
            else { this.chapterGroup(book, this.chapterGetter(book, chapter), ownerGeneration); }
          }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() });
        }
      }, (chapter: DownloadChapterView): string => JSON.stringify([chapter.key, chapter.chapterId]));
      if (this.mainChromeOverflow()) { ListItem() { this.compactDock(); } }
    }.width('100%').height('100%').scrollBar(BarState.Auto)
      .onScrollStop((): void => { this.captureChapterOffset(); this.publishViewState(); })
      .onTouch((event: TouchEvent): void => this.onListTouch(event))
      .onKeyEvent((): void => { this.readingReturnFocus = undefined; })
      .onAreaChange((_old: Area, area: Area): void => {
        const height = readerPageAreaLength(area.height);
        this.chapterLayoutReady = Number.isFinite(height) && height > 0;
        if (this.chapterLayoutReady) this.restoreChapterOffset();
      })
      .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
      .contentEndOffset(readerScrollEndOffset(this.scrollLayout()));
  }

  @Builder
  private chapterGroup(book: () => DownloadBookView, chapter: () => DownloadChapterView, ownerGeneration: number = this.presentationGeneration) {
    Row() {
      Text(chapter().title).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
      if (this.managing) {
        Button({ type: ButtonType.Normal }) {
          Text('选择本卷').fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
        }.constraintSize({ minHeight: DOWNLOAD_VISUAL.textActionHeight }).padding({ left: DOWNLOAD_VISUAL.progressGap, right: 0,
          top: DOWNLOAD_VISUAL.textActionPaddingY, bottom: DOWNLOAD_VISUAL.textActionPaddingY })
          .backgroundColor(Color.Transparent).borderRadius(0)
          .onClick((): void => {
            const currentBook = this.eventBook(book, ownerGeneration);
            const currentChapter = this.eventChapter(book, chapter, ownerGeneration);
            if (currentBook !== undefined && currentChapter !== undefined)
              this.selectChapters(this.groupChapters(currentBook, currentChapter), true);
          });
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterGroupHeight }).padding(DOWNLOAD_VISUAL.chapterGroupPadding).margin({ top: DOWNLOAD_VISUAL.chapterGroupTop }).backgroundColor(downloadVisualColor('soft', this.appThemeScheme));
  }

  @Builder
  private chapterRow(book: () => DownloadBookView, chapter: () => DownloadChapterView, ownerGeneration: number = this.presentationGeneration) {
    Row({ space: DOWNLOAD_VISUAL.chapterGap }) {
      if (this.managing) {
        Checkbox().select(this.chapterSelected(chapter())).width(DOWNLOAD_VISUAL.chapterCheckSize).height(DOWNLOAD_VISUAL.chapterCheckSize)
          .enabled(chapter().chapterId.length > 0)
          .selectedColor(downloadVisualColor('green', this.appThemeScheme))
          .unselectedColor(downloadVisualColor('muted', this.appThemeScheme))
          .mark({ strokeColor: downloadVisualColor('greenInk', this.appThemeScheme) })
          .onChange((selected: boolean): void => {
            const current = this.eventChapter(book, chapter, ownerGeneration);
            if (current !== undefined) this.toggleChapter(current, selected);
          });
      }
      Column({ space: 0 }) {
        Row({ space: DOWNLOAD_VISUAL.statusGap }) {
          Text(chapter().title).fontFamily(TYPE_DOWNLOAD_CHAPTER_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_CHAPTER_TITLE.fontWeight)
            .fontSize(TYPE_DOWNLOAD_CHAPTER_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CHAPTER_TITLE.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor(!chapter().localComplete && chapter().queueState === 'inProgress' ? 'green' : 'ink', this.appThemeScheme)).layoutWeight(1)
            .id(this.focusKey(this.chapterReadingFocusKey(chapter(), 'title'))).focusable(!this.managing)
            .onClick((): void => { if (!this.managing) this.showReadTarget(book(), chapter(), ownerGeneration); });
          if (this.currentChapterForBook(book())?.key === chapter().key) {
            Text('当前阅读').fontFamily(TYPE_DOWNLOAD_TAG.fontFamily).fontWeight(TYPE_DOWNLOAD_TAG.fontWeight)
              .fontSize(TYPE_DOWNLOAD_TAG.fontSizeFp).lineHeight(TYPE_DOWNLOAD_TAG.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor('green', this.appThemeScheme)).maxLines(1).flexShrink(0)
              .padding({ left: DOWNLOAD_VISUAL.tagPaddingX, right: DOWNLOAD_VISUAL.tagPaddingX })
              .backgroundColor(downloadVisualColor('softGreen', this.appThemeScheme)).borderRadius(DOWNLOAD_VISUAL.tagRadius);
          }
        }.width('100%');
        Text(downloadChapterDetailLabel(book().contentKind, chapter())).fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme)).width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.sourceLineHeight });
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      if (!this.managing) {
        Row({ space: DOWNLOAD_VISUAL.chapterTailGap }) {
        Button({ type: ButtonType.Normal }) {
          Text(this.chapterButtonLabel(chapter())).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
        }.constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterActionHeight })
          .id(chapter().localComplete ? this.focusKey(this.chapterReadingFocusKey(chapter(), 'action')) : '')
          .fontColor(this.primaryInk())
          .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .padding({ left: DOWNLOAD_VISUAL.chapterActionPaddingX, right: DOWNLOAD_VISUAL.chapterActionPaddingX, top: DOWNLOAD_VISUAL.chapterActionPaddingY, bottom: DOWNLOAD_VISUAL.chapterActionPaddingY }).borderRadius(DOWNLOAD_VISUAL.chapterActionRadius)
          .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.chapterActionHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget })
          .enabled(chapter().queueState !== 'unknown' || chapter().localComplete)
          .onClick((): void => {
            const currentBook = this.eventBook(book, ownerGeneration);
            const currentChapter = this.eventChapter(book, chapter, ownerGeneration);
            if (currentBook === undefined || currentChapter === undefined) return;
            if (currentChapter.localComplete) this.showReadTarget(currentBook, currentChapter, ownerGeneration, 'action');
            else {
              this.actionBookKeys = [currentBook.key]; this.actionChapters = [this.chapterProof(currentChapter)];
              this.sendAction(this.chapterIsRunning(currentChapter) ? 'pause' : 'download');
            }
          });
        this.moreButton((): string => `${chapter().title}的章节操作`, (): void => {
          const currentBook = this.eventBook(book, ownerGeneration);
          const currentChapter = this.eventChapter(book, chapter, ownerGeneration);
          if (currentBook === undefined || currentChapter === undefined) return;
          this.actionBookKeys = [currentBook.key]; this.actionChapters = [this.chapterProof(currentChapter)];
          this.openSheet('chapter-actions', this.chapterMenuFocusKey(currentChapter));
        }, true, (): string => this.chapterMenuFocusKey(chapter()));
        }
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterHeight }).padding({ left: DOWNLOAD_VISUAL.chapterPaddingX, right: DOWNLOAD_VISUAL.chapterPaddingX, top: DOWNLOAD_VISUAL.chapterPaddingY, bottom: DOWNLOAD_VISUAL.chapterPaddingY })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private moreButton(label: () => string, action: () => void, chapter: boolean = false, focusTarget: () => string = (): string => '') {
    Button({ type: ButtonType.Normal }) {
      Image(this.visualIcon('more'))
        .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
    }.id(this.focusKey(focusTarget())).width(chapter ? DOWNLOAD_VISUAL.chapterMoreWidth : DOWNLOAD_VISUAL.moreWidth)
      .height(chapter ? DOWNLOAD_VISUAL.chapterMoreHeight : DOWNLOAD_VISUAL.moreHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .responseRegion({ x: ((chapter ? DOWNLOAD_VISUAL.chapterMoreWidth : DOWNLOAD_VISUAL.moreWidth) - DOWNLOAD_VISUAL.touchTarget) / 2,
        y: ((chapter ? DOWNLOAD_VISUAL.chapterMoreHeight : DOWNLOAD_VISUAL.moreHeight) - DOWNLOAD_VISUAL.touchTarget) / 2,
        width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText(label()).onClick((): void => action());
  }

  @Builder
  private notice(message: () => string, retry: boolean, ownerGeneration: number = this.presentationGeneration) {
    Row({ space: DOWNLOAD_VISUAL.actionGap }) {
      Text(message()).fontFamily(TYPE_DOWNLOAD_STATUS_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_STATUS_BODY.fontWeight).fontSize(TYPE_DOWNLOAD_STATUS_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STATUS_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme)).layoutWeight(1);
      if (retry) {
        Button({ type: ButtonType.Normal }) {
          Text('重试').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
            .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
        }.constraintSize({ minHeight: DOWNLOAD_VISUAL.textActionHeight }).padding(0).borderRadius(0)
          .backgroundColor(Color.Transparent).onClick((): void => {
            if (!this.uiInputIsCurrent(ownerGeneration)) return;
            if (this.fontsFailed) { this.prepareFonts(); return; }
            const book = this.detail(); if (book !== undefined) this.onOpenBook(book); else this.onRefresh();
          });
      }
    }.width('100%').padding({ top: DOWNLOAD_VISUAL.rangePaddingY, bottom: DOWNLOAD_VISUAL.rangePaddingY });
  }

  @Builder
  private storageDock() {
    Stack({ alignContent: Alignment.TopStart }) {
    Row({ space: DOWNLOAD_VISUAL.dockGap }) {
      Column({ space: 0 }) {
        Text(this.totalBytesLabel()).fontFamily(TYPE_DOWNLOAD_STORAGE_META.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_STORAGE_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).width('100%')
          .constraintSize({ minHeight: DOWNLOAD_VISUAL.storageLineHeight * this.fontScale() });
        if (this.books.some((book: DownloadBookView): boolean => book.bytes === undefined)) {
          Text('容量暂未统计完整')
            .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
            .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('muted', this.appThemeScheme)).width('100%');
        }
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
      Button({ type: ButtonType.Normal }) {
        Image(this.visualIcon('storage'))
          .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
      }.width(DOWNLOAD_VISUAL.touchTarget).height(DOWNLOAD_VISUAL.touchTarget).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .id(this.focusKey('storage')).accessibilityText('存储管理')
        .onClick((): void => {
          if (!this.uiInputIsCurrent() || this.modalBlocking()) return;
          this.openSheet('settings', 'storage');
          this.onRefreshStorage();
        });
    }.width('100%').padding({ left: DOWNLOAD_VISUAL.dockPaddingX, right: DOWNLOAD_VISUAL.dockPaddingX,
      top: DOWNLOAD_VISUAL.dockPaddingY, bottom: DOWNLOAD_VISUAL.dockPaddingY })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(readerAppColor('app.surface.dock', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: readerAppColor('app.navigation.floatingBorder', this.appThemeScheme) }).borderRadius(this.dockMaterialRadius(false)).clip(true)
      .shadow(readerSurfaceElevation('raised', this.appThemeScheme))
      .onAreaChange(this.raisedDockAreaChangeHandler(false));
    }.width('100%').clip(false);
  }

  @Builder
  private selectionDock() {
    Stack({ alignContent: Alignment.TopStart }) {
    Column({ space: DOWNLOAD_VISUAL.selectionSummaryBottom }) {
      Row({ space: DOWNLOAD_VISUAL.selectionSummaryGap }) {
        Text(this.selectionLabel()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
        if (this.managing) {
          Button({ type: ButtonType.Normal }) {
            Text(this.allSelected() ? '取消全选' : '全选').fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
              .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
          }.id(this.focusKey('select-all')).constraintSize({ minHeight: DOWNLOAD_VISUAL.textActionHeight })
            .padding({ top: DOWNLOAD_VISUAL.textActionPaddingY, bottom: DOWNLOAD_VISUAL.textActionPaddingY }).backgroundColor(Color.Transparent).borderRadius(0)
            .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.textActionHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget })
            .onClick(this.manageSelectAllAction(this.managementGeneration));
        }
      }.width('100%');
      Row({ space: DOWNLOAD_VISUAL.actionGap }) {
        if (this.detail() !== undefined && !this.managing) {
          ForEach([this.detailKey], (bookKey: string): void => {
            this.actionButton((): string => '选择章节', true,
              (): boolean => this.detailKey === bookKey && this.detail() !== undefined && !this.managing,
              (): void => this.setManaging(true, 'select-chapters:' + bookKey), 'select-chapters:' + bookKey);
          }, (bookKey: string): string => bookKey);
          this.actionButton((): string => '定位当前', false, (): boolean => this.currentChapter() !== undefined, (): void => this.locateCurrent());
        } else if (this.detail() !== undefined) {
          this.actionButton((): string => '下载所选', true, (): boolean => this.selectedChapters.size > 0, (): void => {
            if (this.captureSelection(true)) this.sendAction('download');
          });
          this.actionButton((): string => '暂停所选', false, (): boolean => this.selectedChapters.size > 0, (): void => {
            if (this.captureSelection(true)) this.sendAction('pause');
          });
          this.actionButton((): string => '更多', false, (): boolean => this.selectedChapters.size > 0, (): void => {
            if (this.captureSelection(true)) this.openSheet('chapter-actions', 'selection-more');
          }, 'selection-more');
        } else {
          this.actionButton((): string => '下载所选书籍', true, (): boolean => this.selectedBookKeys.length > 0, (): void => {
            if (!this.captureSelection()) return;
            this.prepareRange(this.actionBookKeys[0] ?? '');
            this.openSheet('range', 'selection-download');
          }, 'selection-download');
          this.actionButton((): string => '更多书籍操作', false, (): boolean => this.selectedBookKeys.length > 0, (): void => {
            if (this.captureSelection()) this.openSheet('book-actions', 'selection-more');
          }, 'selection-more');
        }
      }.width('100%');
    }.width('100%').padding(DOWNLOAD_VISUAL.selectionPadding).backgroundColor(readerAppColor('app.surface.dock', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: readerAppColor('app.navigation.floatingBorder', this.appThemeScheme) }).borderRadius(this.dockMaterialRadius(true)).clip(true)
      .shadow(readerSurfaceElevation('raised', this.appThemeScheme))
      .onAreaChange(this.raisedDockAreaChangeHandler(true));
    }.width('100%').clip(false);
  }

  private raisedDockShapeIdentity(selection: boolean): string {
    return JSON.stringify(['download-dock', selection, this.mountedIdentity, this.presentationGeneration,
      this.detailKey, this.managing, this.readerWindowMetricsRevision]);
  }

  private currentRaisedDockShape(selection: boolean): ReaderRaisedShape | undefined {
    // A same-box input change need not cause another Native area callback.
    // Keep adopted geometry while rejecting stale callbacks independently.
    if (!this.presentationIsCurrent()) return undefined;
    return selection ? this.selectionDockShape : this.storageDockShape;
  }

  private dockMaterialRadius(selection: boolean): number {
    return this.currentRaisedDockShape(selection)?.radius ?? resolveReaderRaisedShape(this.raisedDockShapeIdentity(selection),
      this.currentMetrics().windowRect.width - this.dockLeftInset() - this.dockRightInset(),
      this.resolvedDockHeight(), DOWNLOAD_VISUAL.dockRadius)?.radius ?? 0;
  }

  private raisedDockAreaChangeHandler(selection: boolean): (_old: Area, area: Area) => void {
    const identity = this.raisedDockShapeIdentity(selection);
    return (_old: Area, area: Area): void => this.recordRaisedDockSurface(selection, area, identity);
  }

  private recordRaisedDockSurface(selection: boolean, area: Area, identity: string): void {
    if (!this.presentationIsCurrent() || identity !== this.raisedDockShapeIdentity(selection) ||
      selection !== (this.managing || this.detail() !== undefined)) return;
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const shape = resolveReaderRaisedShape(identity, width, height, DOWNLOAD_VISUAL.dockRadius);
    if (shape === undefined) return;
    const previous = selection ? this.selectionDockShape : this.storageDockShape;
    if (previous === undefined || previous.identity !== identity || Math.abs(previous.width - width) > .1 || Math.abs(previous.height - height) > .1) {
      if (selection) this.selectionDockShape = shape;
      else this.storageDockShape = shape;
    }
    this.recordDockHeight(height);
  }

  @Builder
  private actionButton(label: () => string, primary: boolean, enabled: () => boolean, action: () => void,
    focusTarget: string = '', inSheet: boolean = false, ownerGeneration: number = this.presentationGeneration) {
    Button({ type: ButtonType.Normal }) {
      Text(label()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
        .fontColor(this.actionInk(primary)).textAlign(TextAlign.Center);
    }.id(this.focusKey(focusTarget)).layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.buttonHeight })
      .padding({ left: DOWNLOAD_VISUAL.buttonPaddingX, right: DOWNLOAD_VISUAL.buttonPaddingX,
        top: DOWNLOAD_VISUAL.buttonPaddingY, bottom: DOWNLOAD_VISUAL.buttonPaddingY }).borderRadius(DOWNLOAD_VISUAL.buttonRadius)
      .backgroundColor(downloadVisualColor(primary ? 'green' : 'soft', this.appThemeScheme))
      .enabled(enabled()).opacity(enabled() ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => {
        if (this.uiInputIsCurrent(ownerGeneration) && (inSheet || !this.modalBlocking()) && enabled()) action();
      });
  }

  @Builder
  private sheetOverlay(attachment: number = this.sheetActorAttachment, ownerGeneration: number = this.sheetActorOwner) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.sheet.length > 0) {
        Rect().width('100%').height('100%').fill(this.sheetScrimColor())
          .onClick((): void => {
            if (this.uiInputIsCurrent() && this.sheetActorIsCurrent(attachment, ownerGeneration) &&
              this.sheetMaskReady && this.confirmation.length === 0)
              this.sheet = '';
          })
          .onAppear((): void => this.onSheetActorAppeared(attachment, ownerGeneration, 'scrim'))
          .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.asymmetric(
            TransitionEffect.OPACITY.animation(motionAnimateParam('source.switch.open')),
            TransitionEffect.OPACITY.animation(motionAnimateParam('source.switch.close'))),
            (transitionIn: boolean): void => this.onSheetActorTransitionFinished(attachment, ownerGeneration, 'scrim', transitionIn));
        ForEach([this.sheetOpeningGeneration], (opening: number): void => {
          if (this.isOperationsSheet()) this.operationsSurface(opening, attachment, ownerGeneration);
          else this.sheetSurface(opening, attachment, ownerGeneration);
        }, (opening: number): string => opening.toString());
      }
    }.width('100%').height('100%');
  }

  @Builder
  private sheetSurface(opening: number, attachment: number, ownerGeneration: number) {
    Column({ space: 0 }) {
      if (this.sheetChromeOverflow()) {
        Scroll() { Column({ space: 0 }) { this.sheetContent(true); }.width('100%'); }
          .width('100%').constraintSize({ maxHeight: this.sheetMaxHeight() }).scrollBar(BarState.Auto);
      } else {
        this.sheetContent(false);
      }
    }.width('100%').constraintSize({ maxHeight: this.sheetMaxHeight() })
      .backgroundColor(readerAppColor('app.surface.menuSolid', this.appThemeScheme))
      .borderRadius({ topLeft: DOWNLOAD_VISUAL.sheetRadius, topRight: DOWNLOAD_VISUAL.sheetRadius }).clip(true)
      .border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: readerAppColor('app.border.modalHighlight', this.appThemeScheme) })
      .shadow(readerSurfaceElevation('sheet', this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Default)
      .onAppear((): void => this.onSheetActorAppeared(attachment, ownerGeneration, 'sheet:' + opening, opening))
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.asymmetric(
        TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('source.switch.open')),
        TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('source.switch.close'))),
        (transitionIn: boolean): void => this.onSheetActorTransitionFinished(attachment, ownerGeneration, 'sheet:' + opening, transitionIn));
  }

  private isOperationsSheet(): boolean { return this.sheet === 'book-actions' || this.sheet === 'chapter-actions'; }

  private sheetScrimColor(): string {
    return readerAppColor(this.isOperationsSheet() ? resolveDrawerSpec('reader-action-sheet').scrimRole :
      'app.scrim.warmModal', this.appThemeScheme);
  }

  private operationsSurfaceWidth(): number {
    const metrics = this.currentMetrics();
    return readerDynamicSurfaceWidth(resolveDrawerSpec('reader-action-sheet').maxWidth,
      Math.max(0, metrics.windowRect.width - readerVisualSafeLeft(metrics) - readerVisualSafeRight(metrics)));
  }

  @Builder
  private operationsSurface(opening: number, attachment: number = this.sheetActorAttachment, ownerGeneration: number = this.sheetActorOwner) {
    Column() {
      ReaderBoundedSurface({ specId: 'reader-action-sheet', surfaceWidth: this.operationsSurfaceWidth(),
        maxSurfaceHeight: this.sheetMaxHeight(), scheme: this.appThemeScheme === 'night' ? 'night' : 'day',
        safeInsets: new ReaderInsetsVp(0, 0, 0, this.operationsBottomInset()),
        header: (): void => { this.operationsHeader(opening); }, body: (): void => { this.operationsBody(opening); } })
        .hitTestBehavior(HitTestMode.Default);
    }.width('100%')
      .padding({ left: readerVisualSafeLeft(this.currentMetrics()), right: readerVisualSafeRight(this.currentMetrics()) })
      .onAppear((): void => this.onSheetActorAppeared(attachment, ownerGeneration, 'operations:' + opening, opening))
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.asymmetric(
        TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('source.switch.open')),
        TransitionEffect.move(TransitionEdge.BOTTOM).animation(motionAnimateParam('source.switch.close'))),
        (transitionIn: boolean): void => this.onSheetActorTransitionFinished(attachment, ownerGeneration, 'operations:' + opening, transitionIn));
  }

  @Builder
  private operationsHeader(opening: number) {
    Column() {
      ReaderBoundedSurfaceHeader({ specId: 'reader-action-sheet', title: this.sheetTitle(),
        surfaceWidth: this.operationsSurfaceWidth(), scheme: this.appThemeScheme === 'night' ? 'night' : 'day',
        closeFocusId: this.focusKey('sheet'),
        onClose: (): void => { if (this.sheetOpeningIsCurrent(opening)) this.sheet = ''; } });
    }.width('100%').onAreaChange((_old: Area, area: Area): void => {
      const height = readerPageAreaLength(area.height);
      if (Number.isFinite(height) && height > 0 && Math.abs(height - this.operationsHeaderMeasuredHeight) > .5)
        this.operationsHeaderMeasuredHeight = height;
    });
  }

  @Builder
  private operationsBody(opening: number) {
    Scroll() {
      Column() { this.operationsSheet(this.presentationGeneration, opening); }.width('100%')
        .padding({ left: resolveDrawerSpec('reader-action-sheet').contentInset,
          right: resolveDrawerSpec('reader-action-sheet').contentInset,
          bottom: this.sheet === 'book-actions' ? 0 : resolveDrawerSpec('reader-action-sheet').contentInset })
        .onAreaChange((_old: Area, area: Area): void => {
          if (this.sheet !== 'book-actions') return;
          const height = readerPageAreaLength(area.height);
          if (Number.isFinite(height) && height > 0 && Math.abs(height - this.bookOperationsBodyMeasuredHeight) > .5)
            this.bookOperationsBodyMeasuredHeight = height;
        });
    }.width('100%').height(this.sheet === 'book-actions' ? this.bookOperationsBodyHeight() : undefined)
      .constraintSize({ maxHeight: Math.max(1,
        this.sheetMaxHeight() - this.operationsHeaderMeasuredHeight - this.operationsBottomInset()) }).scrollBar(BarState.Auto);
  }

  private operationsBottomInset(): number {
    const safe = readerInteractiveSafeBottom(this.currentMetrics());
    return this.sheet === 'book-actions' ? Math.max(20, safe) : safe;
  }

  private bookOperationsBodyHeight(): number {
    const spec = resolveActionSheetSpec('grouped');
    const fallback = this.operationsActions().length * spec.rowHeight + Math.max(0, this.operationsActions().length - 1) * spec.dividerHeight;
    return Math.max(1, Math.min(this.bookOperationsBodyMeasuredHeight > 0 ? this.bookOperationsBodyMeasuredHeight : fallback,
      this.sheetMaxHeight() - this.operationsHeaderMeasuredHeight - this.operationsBottomInset()));
  }

  @Builder
  private sheetContent(wholeDocument: boolean, opening: number = this.sheetOpeningGeneration) {
    Rect().width(DOWNLOAD_VISUAL.gripWidth).height(DOWNLOAD_VISUAL.gripHeight)
      .fill(downloadVisualColor('line', this.appThemeScheme)).radius(DOWNLOAD_VISUAL.gripRadius)
      .margin({ top: DOWNLOAD_VISUAL.gripTop, bottom: DOWNLOAD_VISUAL.gripBottom });
    Row() {
      Text(this.sheetTitle()).fontFamily(TYPE_DOWNLOAD_SHEET_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_SHEET_TITLE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_SHEET_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SHEET_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1).wordBreak(WordBreak.BREAK_WORD);
      Button({ type: ButtonType.Normal }) {
        Image(this.visualIcon('close')).width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
      }.id(this.focusKey('sheet')).height(DOWNLOAD_VISUAL.headerIconHeight).width(DOWNLOAD_VISUAL.headerIconWidth).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .responseRegion({ x: (DOWNLOAD_VISUAL.headerIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('关闭面板')
        .onClick((): void => { if (this.sheetOpeningIsCurrent(opening)) this.sheet = ''; });
    }.constraintSize({ minHeight: DOWNLOAD_VISUAL.sheetTitleHeight }).width('100%')
      .padding({ left: DOWNLOAD_VISUAL.sheetTitleLeft, right: DOWNLOAD_VISUAL.sheetTitleRight })
      .onAreaChange((_old: Area, area: Area): void => this.recordSheetTitleHeight(readerPageAreaLength(area.height)));
    if (wholeDocument) {
      this.sheetBody(opening);
    } else {
      Scroll() { this.sheetBody(opening); }.width('100%').constraintSize({ maxHeight: this.sheetBodyMaxHeight() }).scrollBar(BarState.Auto);
    }
    if (this.sheetHasFooter()) {
      if (this.sheet === 'settings') {
        Row() { this.clearStorageButton(); }
          .width('100%').padding({ left: DOWNLOAD_VISUAL.storageFooterSide, right: DOWNLOAD_VISUAL.storageFooterSide,
            top: DOWNLOAD_VISUAL.storageFooterTop, bottom: this.sheetFooterBottomInset() })
          .onAreaChange((_old: Area, area: Area): void => this.recordSheetFooterHeight(readerPageAreaLength(area.height)));
      } else {
        Row() {
        this.actionButton((): string => this.sheet === 'range' ? '开始下载' : '完成', true,
          (): boolean => this.sheet !== 'range' || this.rangeEligible(), (): void => {
            if (!this.sheetOpeningIsCurrent(opening)) return;
            if (this.sheet === 'range') this.sendRange(); else this.sheet = '';
          }, '', true);
      }.width('100%').padding({ left: DOWNLOAD_VISUAL.sheetFooterSide, right: DOWNLOAD_VISUAL.sheetFooterSide,
        top: DOWNLOAD_VISUAL.sheetFooterTop, bottom: this.sheetFooterBottomInset() })
        .border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) })
        .onAreaChange((_old: Area, area: Area): void => this.recordSheetFooterHeight(readerPageAreaLength(area.height)));
      }
    }
  }

  @Builder
  private sheetBody(opening: number = this.sheetOpeningGeneration) {
    Column({ space: 0 }) {
      if (this.sheet === 'filter') {
        ForEach([opening], (filterOpening: number): void => { this.filterSheet(filterOpening); },
          (filterOpening: number): string => filterOpening.toString());
      }
      else if (this.sheet === 'sort') { this.sortSheet(); }
      else if (this.sheet === 'settings') { this.settingsSheet(); }
      else if (this.sheet === 'range') { this.rangeSheet(opening); }
    }.width('100%').padding({ left: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
      right: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
      top: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodyTop : 0,
      bottom: this.sheetBodyBottomInset() });
  }

  @Builder
  private filterSheet(opening: number) {
    Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
      Text('下载状态').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
      ReaderInlineSelect({
        value: this.stateChoices().find((choice: DownloadChoice): boolean => choice.id === this.stateFilter)?.label ?? '全部状态',
        options: this.stateChoices().map((choice: DownloadChoice): string => choice.label),
        selectedIndex: Math.max(0, this.stateChoices().findIndex((choice: DownloadChoice): boolean => choice.id === this.stateFilter)),
        controlWidth: this.selectClosedWidth(this.stateChoices().find((choice: DownloadChoice): boolean => choice.id === this.stateFilter)?.label ?? '全部状态', this.stateChoices().map((choice: DownloadChoice): string => choice.label), DOWNLOAD_VISUAL.settingsSelectMaxWidth, '下载状态'),
        onSelect: (_index: number, value: string): void => {
          if (!this.sheetOpeningIsCurrent(opening) || this.sheet !== 'filter') return;
          const choice = this.stateChoices().find((option: DownloadChoice): boolean => option.label === value);
          if (choice === undefined) return;
          this.stateFilter = choice.id; this.selectedBookKeys = [];
        },
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
    Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
      Text('书源').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
      ReaderInlineSelect({
        value: this.sourceFilterLabel(),
        menuKind: 'source',
        options: this.filterSourceOptions.map((choice: DownloadChoice): string => choice.label),
        selectedIndex: Math.max(0, this.filterSourceOptions.findIndex((choice: DownloadChoice): boolean => choice.id === this.sourceFilter)),
        controlWidth: this.selectClosedWidth(this.sourceFilterLabel(),
          this.filterSourceOptions.map((choice: DownloadChoice): string => choice.label), DOWNLOAD_VISUAL.settingsSelectMaxWidth, '书源'),
        onSelect: (_index: number, value: string): void => {
          if (!this.sheetOpeningIsCurrent(opening) || this.sheet !== 'filter') return;
          const choice = this.filterSourceOptions.find((option: DownloadChoice): boolean => option.label === value);
          if (choice === undefined || (choice.id !== 'all' &&
            !this.books.some((book: DownloadBookView): boolean => book.sourceId === choice.id))) return;
          this.sourceFilter = choice.id; this.selectedBookKeys = [];
        },
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private sortSheet() {
    ForEach(this.sortChoices(), (choice: DownloadChoice) => {
      this.choiceRow(choice.id, choice.label, (): boolean => this.sortField === choice.id, (): void => { this.sortField = choice.id; });
    }, (choice: DownloadChoice): string => choice.id);
  }

  @Builder
  private choiceRow(optionId: string, label: string, selected: () => boolean, action: () => void,
    ownerGeneration: number = this.presentationGeneration, sheetId: string = this.sheet,
    sheetGeneration: number = this.sheetOpeningGeneration) {
    ReaderChoiceRow({ specId: 'download-radio', optionId: optionId, label: label, selected: selected(), scheme: this.appThemeScheme,
      groupId: `shared-download-${sheetId}-${sheetGeneration}`,
      onChoose: (id: string): void => {
        if (id === optionId && this.presentationIsCurrent(ownerGeneration) &&
          sheetId === this.sheet && this.sheetOpeningIsCurrent(sheetGeneration)) action();
      } });
  }

  @Builder
  private operationsSheet(ownerGeneration: number, opening: number) {
    ReaderActionMenuSurface({ variant: 'grouped', actions: this.operationsActions(), scheme: this.appThemeScheme === 'night' ? 'night' : 'day',
      onAction: (id: string): void => this.performOperationsAction(id, ownerGeneration, opening) });
  }

  private operationsActions(): ReaderMenuActionView[] {
    if (this.sheet === 'book-actions') {
      const books = this.actionBooks();
      const complete = books.length > 0 && books.every((book: DownloadBookView): boolean => book.projectionStatus === 'ready' &&
        book.totalChapters !== undefined && book.totalChapters > 0 && book.downloadedChapters === book.totalChapters &&
        book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).length === book.totalChapters &&
        book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).every((chapter: DownloadChapterView): boolean => chapter.localComplete));
      const cancel = !complete && this.actionAvailable('cancel');
      return [
        new ReaderMenuActionView(cancel ? 'cancel' : 'download', complete ? '已下载' : cancel ? '取消下载' : '下载',
          !complete && this.actionAvailable(cancel ? 'cancel' : 'download'), readerActionIcon(complete ? 'check' : cancel ? 'close' : 'download', this.appThemeScheme)),
        new ReaderMenuActionView('deleteLocal', '删除本地内容', this.actionAvailable('deleteLocal'),
          readerActionIcon('trash', this.appThemeScheme), '删除本地内容', '', '', '', 'danger'),
      ];
    }
    // Chapter actions retain their established download/pause/cancel entries.
    const running = this.selectedIsRunning();
    return [
      new ReaderMenuActionView(running ? 'pause' : 'download', running ? '暂停' : '下载',
        this.actionAvailable(running ? 'pause' : 'download'), readerActionIcon(running ? 'pause' : 'download', this.appThemeScheme)),
      new ReaderMenuActionView('cancel', '取消下载任务', this.actionAvailable('cancel'), readerActionIcon('close', this.appThemeScheme)),
      new ReaderMenuActionView('deleteLocal', '删除本地内容', this.actionAvailable('deleteLocal'),
        readerActionIcon('trash', this.appThemeScheme), '删除本地内容', '', '', '', 'danger'),
    ];
  }

  private performOperationsAction(id: string, ownerGeneration: number, opening: number): void {
    if (!this.uiInputIsCurrent(ownerGeneration) || !this.sheetOpeningIsCurrent(opening) || !this.isOperationsSheet()) return;
    const action = this.operationsActions().find((item: ReaderMenuActionView): boolean => item.id === id);
    if (action === undefined || !action.enabled) return;
    if (id === 'pause') this.sendAction('pause');
    else if (id === 'download') {
      if (this.sheet === 'book-actions') {
        this.prepareRange(this.actionBookKeys[0] ?? ''); this.sheet = 'range';
      } else this.sendAction('download');
    } else if (id === 'cancel' || id === 'deleteLocal') {
      this.confirmation = id;
    }
  }

  @Builder
  private settingsSheet(opening: number = this.sheetOpeningGeneration) {
    this.storageSummaryContent();
    Column({ space: 0 }) {
      Text('自动保存设置').width('100%').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme))
        .margin({ top: DOWNLOAD_VISUAL.storageSettingsTitleTop });
    Row({ space: DOWNLOAD_VISUAL.storageSettingsGap }) {
      Text('空间上限').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme));
      ReaderInlineSelect({
        value: this.limitLabels()[this.limitIndex()] ?? '暂不可用',
        options: this.limitLabels(),
        selectedIndex: this.limitIndex(),
        controlWidth: this.storageSelectWidth(),
        actionEnabled: this.storagePolicy !== undefined && !this.storagePolicyBusy,
        onSelect: (_index: number, value: string): void => this.changeStoragePolicy(opening, 'capacity', value),
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageSettingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
    Row({ space: DOWNLOAD_VISUAL.storageSettingsGap }) {
      Text('多久未阅读后清理').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme));
      ReaderInlineSelect({
        value: this.dayLabels()[this.daysIndex()] ?? '暂不可用',
        options: this.dayLabels(),
        selectedIndex: this.daysIndex(),
        controlWidth: this.storageSelectWidth(),
        actionEnabled: this.storagePolicy !== undefined && !this.storagePolicyBusy,
        onSelect: (_index: number, value: string): void => this.changeStoragePolicy(opening, 'expiry', value),
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageSettingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
    }.width('100%').border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private storageSummaryContent() {
    // Empty native Text has a different fallback baseline from Chromium.
    // Preserve the same numeric actor and the approved empty line box.
    Flex({ direction: FlexDirection.Row, alignItems: formatDownloadStorageBytes(this.storageSummary.totalBytes).length === 0 ? ItemAlign.Start : ItemAlign.Baseline }) {
      Text('已下载内容').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).margin({ right: DOWNLOAD_VISUAL.storageSummaryGap,
          top: formatDownloadStorageBytes(this.storageSummary.totalBytes).length === 0 ? DOWNLOAD_VISUAL.storageUnknownSummaryLabelTop * this.fontScale() : 0 });
      Text(formatDownloadStorageBytes(this.storageSummary.totalBytes))
        .fontFeature('"tnum" 1')
        .fontFamily(TYPE_DOWNLOAD_STORAGE_TOTAL.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_TOTAL.fontWeight)
        .fontSize(TYPE_DOWNLOAD_STORAGE_TOTAL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_TOTAL.lineHeightFp as number).halfLeading(true)
        .constraintSize({ minHeight: (TYPE_DOWNLOAD_STORAGE_TOTAL.lineHeightFp as number) * this.fontScale() })
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).textAlign(TextAlign.End);
    }.width('100%').constraintSize({ minHeight: formatDownloadStorageBytes(this.storageSummary.totalBytes).length === 0 ?
      DOWNLOAD_VISUAL.storageUnknownSummaryMinHeight * this.fontScale() : 0 });
    Column({ space: DOWNLOAD_VISUAL.storageBreakdownGap }) {
      this.storageRetentionRow('保留下载', '长期保留，仅手动删除', (): number | undefined => this.storageSummary.retainedBytes);
      this.storageRetentionRow('自动保存', '阅读时保存，按设置自动清理', (): number | undefined => this.storageSummary.automaticBytes);
    }.width('100%').margin({ top: DOWNLOAD_VISUAL.storageBreakdownTop });
    Row({ space: DOWNLOAD_VISUAL.storageFreeGap }) {
      Text('设备可用空间').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      Text(formatDownloadStorageBytes(this.storageSummary.availableBytes))
        .fontFeature('"tnum" 1')
        .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
        .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
        .constraintSize({ minHeight: (TYPE_DOWNLOAD_META.lineHeightFp as number) * this.fontScale() })
        .fontColor(downloadVisualColor('muted', this.appThemeScheme)).textAlign(TextAlign.End);
    }.width('100%').margin({ top: DOWNLOAD_VISUAL.storageFreeTop, bottom: DOWNLOAD_VISUAL.storageFreeBottom });
  }

  @Builder
  private storageRetentionRow(label: string, caption: string, bytes: () => number | undefined) {
    Row({ space: DOWNLOAD_VISUAL.storageRowGap }) {
      Column({ space: DOWNLOAD_VISUAL.storageCaptionGap }) {
        Text(label).width('100%').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
          .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme));
        Text(caption).width('100%').fontFamily(TYPE_DOWNLOAD_META_LINE.fontFamily).fontWeight(TYPE_DOWNLOAD_META_LINE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META_LINE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META_LINE.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      }.layoutWeight(1);
      Text(formatDownloadStorageBytes(bytes()))
        .fontFeature('"tnum" 1')
        .fontFamily(TYPE_DOWNLOAD_STORAGE_VALUE.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_VALUE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_STORAGE_VALUE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_VALUE.lineHeightFp as number).halfLeading(true)
        .constraintSize({ minHeight: (TYPE_DOWNLOAD_STORAGE_VALUE.lineHeightFp as number) * this.fontScale() })
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).textAlign(TextAlign.End);
    }.width('100%').alignItems(VerticalAlign.Top);
  }

  @Builder
  private clearStorageButton(ownerGeneration: number = this.presentationGeneration, opening: number = this.sheetOpeningGeneration) {
    // ButtonPattern dims its whole render layer when disabled. Keep the real
    // disabled Button as the event/accessibility owner, with authored pixels
    // on a non-interactive sibling. matchParent follows the Row's final size.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: DOWNLOAD_VISUAL.storageActionGap }) {
        Image(this.visualIcon(this.storageCleanupAvailable() ? 'trash' : 'trash_disabled'))
          .width(DOWNLOAD_VISUAL.storageActionIconSize).height(DOWNLOAD_VISUAL.storageActionIconSize);
        Text(this.storageCleanLabel()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor(this.storageCleanupAvailable() ? 'greenInk' : 'muted', this.appThemeScheme))
          .textAlign(TextAlign.Center);
      }.width('100%').justifyContent(FlexAlign.Center).constraintSize({ minHeight: DOWNLOAD_VISUAL.storageActionMinHeight })
      .padding({ left: DOWNLOAD_VISUAL.storageActionPaddingX, right: DOWNLOAD_VISUAL.storageActionPaddingX,
        top: DOWNLOAD_VISUAL.storageActionPaddingY, bottom: DOWNLOAD_VISUAL.storageActionPaddingY }).borderRadius(DOWNLOAD_VISUAL.storageActionRadius)
      .backgroundColor(downloadVisualColor(this.storageCleanupAvailable() ? 'green' : 'soft', this.appThemeScheme))
      .renderGroup(true).opacity(this.storageCleanupAvailable() ? 1 : DOWNLOAD_VISUAL.storageActionDisabledOpacity).hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no-hide-descendants');
      Button({ type: ButtonType.Normal }) {}
        .width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent).padding(0)
        .borderRadius(DOWNLOAD_VISUAL.storageActionRadius).backgroundColor(Color.Transparent)
        .id(this.focusKey('storage-clean')).accessibilityText(this.storageCleanLabel()).enabled(this.storageCleanupAvailable())
        .onClick((): void => this.openStorageCleanup(ownerGeneration, opening));
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageActionMinHeight });
  }

  @Builder
  private rangeSheet(opening: number = this.sheetOpeningGeneration) {
    if (this.actionBookKeys.length > 1) {
      ReaderInlineSelect({
        value: this.availableRangeBooks().find((choice: DownloadChoice): boolean => choice.id === this.rangeBookKey)?.label ?? '',
        options: this.availableRangeBooks().map((choice: DownloadChoice): string => choice.label),
        selectedIndex: Math.max(0, this.availableRangeBooks().findIndex((choice: DownloadChoice): boolean => choice.id === this.rangeBookKey)),
        controlWidth: 0,
        onSelect: (_index: number, value: string): void => {
          if (!this.sheetOpeningIsCurrent(opening) || this.sheet !== 'range') return;
          const choice = this.availableRangeBooks().find((option: DownloadChoice): boolean => option.label === value);
          if (choice !== undefined && choice.id !== this.rangeBookKey) this.resetRangeDraft(choice.id);
        },
      }).width('100%').margin({ bottom: DOWNLOAD_VISUAL.rangeBookBottom });
    }
    this.choiceRow('all', '全部章节', (): boolean => this.rangeChoice === 'all', (): void => this.selectRangeChoice('all'));
    this.choiceRow('forward', '从当前章节往后', (): boolean => this.rangeChoice === 'forward', (): void => this.selectRangeChoice('forward'));
    this.choiceRow('custom', '选择章节范围', (): boolean => this.rangeChoice === 'custom', (): void => this.selectRangeChoice('custom'));
    if (this.rangeChoice === 'custom') {
      ForEach([this.rangeDraftRevision], (revision: number): void => { this.rangeInputs(opening, revision); },
        (revision: number): string => revision.toString());
      if (this.rangeCatalogChanged) {
        ReaderRecoveryNotice({ tag: '目录更新', actionLabel: '重新填写',
          view: { message: '目录已变化，请按当前目录重新填写下载范围。', visible: true,
            canRetry: this.rangeBook()?.projectionStatus === 'ready', generation: this.rangeDraftRevision },
          onReconcile: (revision: number): void => {
            if (this.sheetOpeningIsCurrent(opening) && this.sheet === 'range' && this.rangeChoice === 'custom' &&
              revision === this.rangeDraftRevision && this.rangeCatalogChanged &&
              this.rangeBook()?.projectionStatus === 'ready') this.resetRangeDraft(this.rangeBookKey);
          } }).margin({ top: DOWNLOAD_VISUAL.rangeSelectionTop });
      }
    }
  }

  @Builder
  private rangeInputs(opening: number, revision: number) {
    Row({ space: DOWNLOAD_VISUAL.actionGap }) {
      this.rangeBoundInput(true, opening, revision);
      Text('至').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      this.rangeBoundInput(false, opening, revision);
    }.width('100%').margin({ top: DOWNLOAD_VISUAL.rangeSelectionTop });
  }

  @Builder
  private rangeBoundInput(start: boolean, opening: number, revision: number) {
    TextInput({ text: start ? this.rangeStart : this.rangeEnd, placeholder: start ? '起始序号' : '结束序号' })
      .layoutWeight(1).type(InputType.Number)
      .enabled(this.rangeCatalog !== undefined && !this.rangeCatalogChanged)
      .height(this.textControlHeight(DOWNLOAD_VISUAL.searchHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.searchPaddingY * 2))
      .fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
      .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number)
      .fontColor(downloadVisualColor('ink', this.appThemeScheme)).backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
      .onChange((value: string): void => this.updateRangeBound(value, start, opening, revision));
  }

  @Builder
  private confirmationOverlay(opening: number = this.confirmationGeneration) {
    Stack({ alignContent: Alignment.Center }) {
      Rect().width('100%').height('100%').fill(downloadVisualColor('scrim', this.appThemeScheme));
      Column() {
        ReaderDialogSurface({ specId: 'download-confirmation', body: (): void => { this.confirmationSurfaceBody(opening); } }).clip(true);
      }.width('100%').padding({ left: DOWNLOAD_VISUAL.dialogOuterSide, right: DOWNLOAD_VISUAL.dialogOuterSide,
        top: this.dialogOuterPaddingY(), bottom: this.dialogOuterPaddingY() });
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Default);
  }

  @Builder
  private confirmationSurfaceBody(opening: number = this.confirmationGeneration) {
    if (this.dialogChromeOverflow()) {
      // The shared frame owns the original 17vp inset. The viewport
      // excludes that same inset while the whole body/actions scroll.
      Scroll() { this.confirmationContent(true, this.presentationGeneration, opening); }.width('100%')
        .constraintSize({ maxHeight: Math.max(0, this.dialogMaxHeight() - 34) }).scrollBar(BarState.Auto);
    } else {
      this.confirmationContent(false, this.presentationGeneration, opening);
    }
  }

  @Builder
  private confirmationContent(wholeDocument: boolean, ownerGeneration: number = this.presentationGeneration,
    opening: number = this.confirmationGeneration) {
    Column({ space: 0 }) {
      if (wholeDocument) {
        this.confirmationBody();
      } else {
        Scroll() { this.confirmationBody(); }.width('100%')
          .constraintSize({ maxHeight: this.dialogBodyMaxHeight() }).scrollBar(BarState.Auto);
      }
      Row({ space: DOWNLOAD_VISUAL.actionGap }) {
        this.confirmationButton((): string => '取消', false, (): void => {
          if (this.confirmationIsCurrent(opening, ownerGeneration)) this.confirmation = '';
        });
        this.confirmationButton((): string => this.confirmation === 'cleanup' ? `清理 ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)}` :
          this.confirmation === 'cancel' ? '取消任务' : '删除内容', true, (): void => {
          if (!this.confirmationIsCurrent(opening, ownerGeneration) || !this.confirmationActionAvailable()) return;
          if (this.confirmation === 'cleanup') { this.confirmStorageCleanup(ownerGeneration); return; }
          const action = this.confirmation === 'cancel' ? 'cancel' : 'deleteLocal';
          this.confirmation = ''; this.sendAction(action);
        }, (): boolean => this.confirmationActionAvailable());
      }.width('100%').onAreaChange((_old: Area, area: Area): void => {
        const height = readerPageAreaLength(area.height);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.dialogActionsMeasuredHeight) > 0.5)
          this.dialogActionsMeasuredHeight = height;
      });
    }.width('100%');
  }

  @Builder
  private confirmationBody() {
    Column({ space: 0 }) {
      Text(this.confirmationTitle())
        .fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme)).width('100%').margin({ bottom: 16 });
      Text(this.confirmationCopy())
        .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight)
        .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme)).width('100%').margin({ bottom: 28 });
    }.width('100%');
  }

  @Builder
  private confirmationButton(label: () => string, danger: boolean, action: () => void, enabled: () => boolean = (): boolean => true) {
    Button({ type: ButtonType.Normal }) {
      Text(label()).fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight)
        .fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number).halfLeading(true)
        .fontColor(readerAppColor(danger ? 'TOK_MESSAGE_DANGER' : 'TOK_MESSAGE_SOFT_INK', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.id(this.focusKey(danger ? 'confirm' : 'confirm-cancel')).defaultFocus(!danger)
      .layoutWeight(1).constraintSize({ minHeight: 44 })
      .padding({ left: 12, right: 12, top: 10, bottom: 10 }).borderRadius(12)
      .backgroundColor(readerAppColor('TOK_MESSAGE_SOFT', this.appThemeScheme)).enabled(enabled())
      .onClick((): void => { if (enabled()) action(); });
  }

  private confirmationActionAvailable(): boolean {
    if (this.confirmation === 'cleanup') return this.storageCleanupAvailable();
    if (this.confirmation === 'cancel') return this.actionAvailable('cancel');
    return this.confirmation === 'deleteLocal' && this.actionAvailable('deleteLocal');
  }

  private confirmationTitle(): string {
    if (this.confirmation === 'cleanup') return '清理自动保存？';
    const books = this.actionBooks();
    const label = this.confirmation === 'cancel' ? '取消任务' : '删除内容';
    if (this.actionChapters.length > 0)
      return `确认${label} · ${this.actionChapters.length}${this.unit(books[0])}？`;
    const title = this.confirmation === 'cancel' ? '取消下载任务？' : '删除本地内容？';
    return `${title}（${books.length}本书）`;
  }
  private confirmationCopy(): string {
    if (this.confirmation === 'cleanup')
      return `将清理 ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)} 自动保存的内容。保留下载、正在阅读和下载的内容不受影响，书架与阅读记录保留。`;
    if (this.actionChapters.length > 0)
      return this.confirmation === 'cancel' ? '仅取消所选章节的剩余下载，已下载内容保留。' :
        '仅删除所选章节的本地内容，并取消这些章节的剩余下载。书架和阅读记录保留。';
    return this.confirmation === 'cancel' ? '已下载的内容会保留，可以继续阅读。' :
      '删除所选书籍的本地内容，之后阅读需要重新获取。书架与阅读记录保留。';
  }
  private primaryInk(): string { return downloadVisualColor('green', this.appThemeScheme); }

  private storageCleanupAvailable(): boolean {
    return !this.storageCleanupBusy && canCleanDownloadStorage(this.storageSummary);
  }
  private storageCleanLabel(): string {
    if (this.storageCleanupBusy) return '正在清理自动保存…';
    if (formatDownloadStorageBytes(this.storageSummary.cleanableBytes).length === 0) return '清理自动保存';
    return canCleanDownloadStorage(this.storageSummary) ?
      `清理自动保存 · ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)}` : '暂无可清理的自动保存';
  }
  private openStorageCleanup(generation: number = this.presentationGeneration, opening: number = this.sheetOpeningGeneration): void {
    if (!this.presentationIsCurrent(generation) || !this.sheetOpeningIsCurrent(opening) ||
      this.sheet !== 'settings' || !this.storageCleanupAvailable()) return;
    this.confirmation = 'cleanup';
  }
  private confirmStorageCleanup(generation: number = this.presentationGeneration): void {
    if (!this.uiInputIsCurrent(generation) || this.confirmation !== 'cleanup' || !this.storageCleanupAvailable()) return;
    this.confirmation = ''; this.sendAction('cleanup');
  }
  private tabInk(id: string): string {
    return downloadVisualColor(this.bookType === id ? 'green' : 'ink', this.appThemeScheme);
  }
  private statusInk(book: DownloadBookView): string {
    return downloadVisualColor(book.stateLabel === '下载失败' ? 'danger' : book.stateLabel === '未下载' ? 'muted' : 'green', this.appThemeScheme);
  }
  private actionInk(primary: boolean): string { return downloadVisualColor(primary ? 'greenInk' : 'ink', this.appThemeScheme); }

  private presentationIsCurrent(generation: number = this.presentationGeneration): boolean {
    return this.mounted && generation === this.presentationGeneration &&
      this.presentationIdentity === this.mountedIdentity && (this.isOpeningCurrent?.() ?? true);
  }

  private uiInputIsCurrent(generation: number = this.presentationGeneration): boolean {
    return this.presentationIsCurrent(generation) && this.appForeground && !this.covered;
  }

  private modalBlocking(): boolean {
    return this.sheet.length > 0 || this.confirmation.length > 0 || this.sheetExitPending;
  }

  private sheetOpeningIsCurrent(opening: number): boolean {
    return this.uiInputIsCurrent() && this.sheet.length > 0 &&
      this.sheetOpeningGeneration === opening && this.confirmation.length === 0;
  }

  private confirmationIsCurrent(opening: number, generation: number): boolean {
    return this.uiInputIsCurrent(generation) && this.confirmation.length > 0 &&
      this.confirmationGeneration === opening;
  }

  private focusKey(target: string): string { return target.length > 0 ? 'reader-download:' + target : ''; }

  private chapterMenuFocusKey(chapter: DownloadChapterView): string {
    return 'chapter-menu:' + JSON.stringify([chapter.key, chapter.chapterId]);
  }

  private chapterReadingFocusKey(chapter: DownloadChapterView, control: SharedDownloadReadingControl): string {
    return 'chapter-reading:' + JSON.stringify([chapter.key, chapter.chapterId, control]);
  }

  private chapterReadingFocusTarget(focus: SharedDownloadReadingFocus): string {
    const book = this.detail();
    const chapter = book?.key === focus.bookKey && book.projectionStatus === 'ready' ?
      book.chapters.find((row: DownloadChapterView): boolean =>
        row.navigable && row.key === focus.chapterKey && row.chapterId === focus.chapterId) : undefined;
    return chapter !== undefined && (focus.control === 'title' || chapter.localComplete) ?
      this.chapterReadingFocusKey(chapter, focus.control) : 'page-back';
  }

  private openSheet(kind: string, trigger: string): void {
    if (!this.uiInputIsCurrent() || this.modalBlocking()) return;
    if (kind === 'filter') this.filterSourceOptions = this.sourceChoices();
    this.sheetTriggerKey = trigger;
    this.sheet = kind;
  }

  private syncOverlayFocus(preferred: string = '', expectedManaging: boolean = this.managing,
    readingReturn?: SharedDownloadReadingFocus): void {
    if (!this.uiInputIsCurrent()) return;
    const generation = this.presentationGeneration;
    const focusGeneration = ++this.focusGeneration;
    const detailKey = this.detailKey;
    const returning = this.sheet.length === 0 && this.confirmation.length === 0;
    if (returning && this.sheetExitPending) return;
    const target = preferred.length > 0 ? preferred :
      this.confirmation.length > 0 ? 'confirm-cancel' : this.sheet.length > 0 ? 'sheet' : this.sheetTriggerKey;
    if (target.length === 0 && readingReturn === undefined) return;
    try {
      this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame((): void => {
        if (!this.uiInputIsCurrent(generation) || focusGeneration !== this.focusGeneration ||
          detailKey !== this.detailKey || expectedManaging !== this.managing || (returning && this.modalBlocking())) return;
        if (readingReturn !== undefined) {
          if (this.readingReturnFocus !== readingReturn || !this.appForeground || this.covered) return;
          this.readingReturnFocus = undefined;
        }
        if (returning) this.sheetTriggerKey = '';
        const resolved = readingReturn === undefined ? target : this.chapterReadingFocusTarget(readingReturn);
        const currentTarget = !resolved.startsWith('chapter-menu:') || (!this.managing &&
          this.detail()?.chapters.some((chapter: DownloadChapterView): boolean =>
            chapter.navigable && this.chapterMenuFocusKey(chapter) === resolved) === true);
        const targets: string[] = currentTarget ? [resolved] : [];
        if (returning) {
          if (readingReturn === undefined && this.books.length > 0 && target !== 'manage') targets.push('manage');
          if (resolved !== 'page-back') targets.push('page-back');
        } else if (this.confirmation.length === 0 && this.sheet.length > 0 && target !== 'sheet') {
          targets.push('sheet');
        }
        for (const candidate of targets) {
          try {
            this.getUIContext().getFocusController().requestFocus(this.focusKey(candidate));
            return;
          } catch (_missingOrDisabledTarget) {}
        }
      }));
    } catch (_unmounted) {}
  }

  private onSheetChanged(): void {
    this.searchInputRevision += 1;
    this.invalidateReadingHandoff();
    this.sheetOpeningGeneration += 1;
    const visible = this.sheet.length > 0;
    if (visible !== this.sheetWasVisible) {
      this.sheetWasVisible = visible;
      this.sheetMaskReady = visible && this.reduceMotion;
      if (visible) {
        this.sheetActorAttachment = ++this.sheetActorGeneration;
        this.sheetActorOwner = this.presentationGeneration;
        this.sheetActors = [];
        this.sheetExitPending = false;
      } else {
        this.sheetExitPending = !this.reduceMotion && this.sheetActors.length > 0;
        if (!this.sheetExitPending) this.retireSheetActors();
      }
    }
    this.syncOverlayChrome();
    this.syncOverlayFocus();
  }

  private onConfirmationChanged(): void {
    this.searchInputRevision += 1;
    this.invalidateReadingHandoff();
    this.confirmationGeneration += 1;
    const returnToCleanup = this.previousConfirmation === 'cleanup' &&
      this.confirmation.length === 0 && this.sheet === 'settings';
    this.previousConfirmation = this.confirmation;
    this.syncOverlayChrome();
    this.syncOverlayFocus(returnToCleanup ? 'storage-clean' : '');
  }

  private sheetActorIsCurrent(attachment: number, ownerGeneration: number): boolean {
    return attachment > 0 && attachment === this.sheetActorAttachment && ownerGeneration === this.sheetActorOwner &&
      this.presentationIsCurrent(ownerGeneration);
  }

  private onSheetActorAppeared(attachment: number, ownerGeneration: number, part: string, opening: number = -1): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || this.sheet.length === 0 || this.sheetExitPending ||
      (opening >= 0 && opening !== this.sheetOpeningGeneration) || this.sheetActors.includes(part)) return;
    this.sheetActors = [...this.sheetActors, part];
  }

  private onSheetActorTransitionFinished(attachment: number, ownerGeneration: number, part: string, transitionIn: boolean): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || !this.sheetActors.includes(part)) return;
    if (transitionIn) {
      if (part === 'scrim' && this.sheet.length > 0) this.sheetMaskReady = true;
      return;
    }
    this.sheetActors = this.sheetActors.filter((candidate: string): boolean => candidate !== part);
    if (this.sheetExitPending && this.sheetActors.length === 0) this.onSheetExitFinished(attachment, ownerGeneration);
  }

  private onSheetExitFinished(attachment: number, ownerGeneration: number): void {
    if (!this.sheetActorIsCurrent(attachment, ownerGeneration) || !this.sheetExitPending ||
      this.sheet.length > 0 || this.sheetActors.length > 0) return;
    this.retireSheetActors();
    this.sheetExitPending = false;
    this.syncOverlayChrome();
    this.syncOverlayFocus();
  }

  private retireSheetActors(): void {
    this.sheetActorGeneration += 1;
    this.sheetActorAttachment = 0;
    this.sheetActorOwner = -1;
    this.sheetActors = [];
  }

  private onMotionPreferenceChanged(): void {
    if (!this.reduceMotion) return;
    this.sheetMaskReady = this.sheet.length > 0;
    if (this.sheetExitPending) {
      this.sheetActors = [];
      this.onSheetExitFinished(this.sheetActorAttachment, this.sheetActorOwner);
      return;
    }
    this.syncOverlayChrome();
    this.syncOverlayFocus();
  }

  private syncOverlayChrome(): void {
    if (!this.presentationIsCurrent()) return;
    const identity = this.mountedIdentity;
    const generation = this.presentationGeneration;
    const requestGeneration = ++this.overlayChromeRequestGeneration;
    // sheet -> confirmation is one visible overlay transition. Read final
    // state after synchronous Watch callbacks, without exposing App chrome.
    void Promise.resolve().then((): void => {
      if (!this.presentationIsCurrent(generation) || this.mountedIdentity !== identity ||
        requestGeneration !== this.overlayChromeRequestGeneration) return;
      if (this.sheetExitPending && this.sheet.length === 0 && this.confirmation.length === 0) return;
      if (this.sheet.length > 0 || this.confirmation.length > 0) {
        const visual = downloadOverlayChromeStyle(this.appThemeScheme,
          this.sheet.length > 0 && this.confirmation.length === 0,
          this.sheet === 'settings' && this.confirmation === 'cleanup' ? 2 : 1);
        const actionSheet = this.isOperationsSheet() && this.confirmation.length === 0;
        let style = new ReaderWindowChromeStyle(visual.underlayColor, visual.tone, visual.contentColor);
        if (actionSheet) {
          const scrim = readerAppColor(resolveDrawerSpec('reader-action-sheet').scrimRole, this.appThemeScheme);
          style = new ReaderWindowChromeStyle(
            readerScrimmedOpaqueColor(downloadVisualColor('paper', this.appThemeScheme), scrim),
            visual.tone, readerScrimmedOpaqueColor(downloadVisualColor('ink', this.appThemeScheme), scrim));
        }
        style.navigationUnderlayColor = actionSheet ?
          readerAppColor(resolveDrawerSpec('reader-action-sheet').surfaceRole, this.appThemeScheme) : visual.navigationUnderlayColor;
        style.navigationContentColor = actionSheet ?
          readerAppColor(resolveDrawerSpec('reader-action-sheet').inkRole, this.appThemeScheme) : visual.navigationContentColor;
        ReaderWindowCoordinator.requestOverlayChrome(style);
        this.overlayChromeClaimed = true;
      } else if (this.overlayChromeClaimed) {
        ReaderWindowCoordinator.requestAppChrome();
        this.overlayChromeClaimed = false;
      }
    });
  }

  private onPresentationIdentityChanged(): void {
    if (!this.mounted || this.presentationIdentity === this.mountedIdentity) return;
    this.presentationGeneration += 1;
    this.cancelManagingScroll();
    this.overlayChromeRequestGeneration += 1;
    this.retireSheetActors();
    this.focusGeneration += 1;
    this.readingReturnFocus = undefined;
    this.sheetMaskReady = false;
    this.sheetExitPending = false;
    this.chapterLayoutReady = false;
    this.chapterScrollRestorePending = false;
    this.chapterScrollRestoreScheduled = false;
    if (this.overlayChromeClaimed) ReaderWindowCoordinator.requestAppChrome();
    this.overlayChromeClaimed = false;
  }

  /** Retained SDK observers resolve their DTO when they execute. A removed
   * identity may finish its last paint, but cannot deliver an event. */
  private bookGetter(snapshot: DownloadBookView): () => DownloadBookView {
    return (): DownloadBookView => this.currentBook(snapshot);
  }
  private currentBook(snapshot: DownloadBookView): DownloadBookView {
    return this.findCurrentBook(snapshot) ?? snapshot;
  }
  private findCurrentBook(snapshot: DownloadBookView): DownloadBookView | undefined {
    return this.books.find((current: DownloadBookView): boolean => current.key === snapshot.key &&
      current.sourceId === snapshot.sourceId && current.bookId === snapshot.bookId);
  }
  private chapterGetter(book: () => DownloadBookView, snapshot: DownloadChapterView): () => DownloadChapterView {
    return (): DownloadChapterView => this.currentChapterView(book(), snapshot);
  }
  private currentChapterView(book: DownloadBookView, snapshot: DownloadChapterView): DownloadChapterView {
    return this.findCurrentBook(book)?.chapters.find((current: DownloadChapterView): boolean =>
      current.key === snapshot.key && current.chapterId === snapshot.chapterId) ?? snapshot;
  }
  private eventBook(book: () => DownloadBookView, generation: number = this.presentationGeneration): DownloadBookView | undefined {
    return this.uiInputIsCurrent(generation) && !this.modalBlocking() ? this.findCurrentBook(book()) : undefined;
  }
  private eventChapter(book: () => DownloadBookView, chapter: () => DownloadChapterView,
    generation: number = this.presentationGeneration): DownloadChapterView | undefined {
    const currentBook = this.eventBook(book, generation);
    if (currentBook === undefined || currentBook.key !== this.detailKey) return undefined;
    const expected = chapter();
    return currentBook.chapters.find((current: DownloadChapterView): boolean =>
      current.key === expected.key && current.chapterId === expected.chapterId);
  }

  private filters(): SharedDownloadFilters {
    return { query: this.query, type: this.bookType as 'all' | 'novel' | 'manga',
      state: this.stateFilter as 'all' | 'downloading' | 'downloaded' | 'none', sourceId: this.sourceFilter,
      sort: this.sortField as 'recent' | 'title' | 'progress' | 'size', direction: this.sortDirection as 'asc' | 'desc' };
  }
  private visibleBooks(): DownloadBookView[] { return filterDownloadBooks(this.books, this.filters()); }
  private detail(): DownloadBookView | undefined { return this.books.find((book: DownloadBookView): boolean => book.key === this.detailKey); }
  private actionBooks(): DownloadBookView[] { return this.books.filter((book: DownloadBookView): boolean => this.actionBookKeys.includes(book.key)); }
  private unit(book: DownloadBookView | undefined): string {
    return book?.contentKind === 'novel' ? '章' : book?.contentKind === 'manga' ? '个条目' : '';
  }
  private authorSource(book: DownloadBookView): string {
    return [book.author, book.sourceLabel].filter((value: string): boolean => value.trim().length > 0).join(' · ');
  }
  private downloadCount(book: DownloadBookView, secondary: boolean): string {
    if (book.downloadedChapters === undefined) return '';
    if (secondary || book.totalChapters === undefined) return `已下载 ${book.downloadedChapters}${this.unit(book)}`;
    return `已下载 ${book.downloadedChapters} / ${book.totalChapters} ${this.unit(book)}`;
  }
  private totalBytesLabel(): string {
    const known = this.books.filter((book: DownloadBookView): boolean => book.bytes !== undefined);
    if (known.length !== this.books.length) return '已下载内容';
    const bytes = known.reduce((sum: number, book: DownloadBookView): number => sum + (book.bytes ?? 0), 0);
    if (bytes >= 1024 * 1024 * 1024) return `已下载 ${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `已下载 ${Math.round(bytes / (1024 * 1024))} MB`;
  }
  private sortLabel(): string { return this.sortChoices().find((choice: DownloadChoice): boolean => choice.id === this.sortField)?.label ?? '最近阅读'; }
  private filterLabel(): string {
    const count = Number(this.stateFilter !== 'all') + Number(this.sourceFilter !== 'all'); return count > 0 ? `筛选 · ${count}` : '筛选';
  }
  private stateChoices(): DownloadChoice[] {
    return [{ id: 'all', label: '全部状态' }, { id: 'downloading', label: '下载中' }, { id: 'downloaded', label: '已下载' }, { id: 'none', label: '未下载' }];
  }
  private sortChoices(): DownloadChoice[] {
    return [{ id: 'recent', label: '最近阅读' }, { id: 'title', label: '书名' }, { id: 'progress', label: '下载比例' }, { id: 'size', label: '下载大小' }];
  }
  private sourceFilterLabel(): string {
    return this.filterSourceOptions.find((choice: DownloadChoice): boolean => choice.id === this.sourceFilter)?.label ?? '全部书源';
  }
  private sourceChoices(): DownloadChoice[] {
    const names = new Map<string, string>();
    for (const book of this.books) {
      if (book.sourceId !== 'all' && !names.has(book.sourceId)) names.set(book.sourceId, book.sourceLabel || book.sourceId);
    }
    // ReaderInlineSelect reports the displayed value. Keep it unique for
    // this opening even when sources have identical user-facing names.
    const choices: DownloadChoice[] = [{ id: 'all', label: '全部书源' }];
    const assigned = new Set<string>(['全部书源']);
    const reserved = new Set<string>(names.values());
    names.forEach((name: string, id: string): void => {
      let label = name;
      let ordinal = 2;
      if (assigned.has(label)) {
        do {
          label = `${name} (${ordinal})`;
          ordinal += 1;
        } while (assigned.has(label) || reserved.has(label));
      }
      assigned.add(label);
      choices.push({ id, label });
    });
    return choices;
  }
  private bookIsRunning(book: DownloadBookView): boolean {
    return book.chapters.some((chapter: DownloadChapterView): boolean => chapter.navigable && this.chapterIsRunning(chapter));
  }
  private chapterIsRunning(chapter: DownloadChapterView): boolean {
    return !chapter.localComplete && (chapter.queueState === 'inProgress' || chapter.queueState === 'queued');
  }
  private chapterButtonLabel(chapter: DownloadChapterView): string {
    if (chapter.localComplete) return '阅读';
    if (this.chapterIsRunning(chapter)) return '暂停';
    if (chapter.queueState === 'failed') return '重试';
    if (chapter.queueState === 'paused') return '继续';
    return chapter.queueState === 'unknown' ? '' : '下载';
  }
  private statusIcon(book: DownloadBookView): Resource {
    if (book.stateLabel === '已下载') return this.visualIcon('check');
    if (book.stateLabel === '下载失败') return this.visualIcon('retry');
    if (this.bookIsRunning(book)) return this.visualIcon('pause');
    if (book.chapters.some((chapter: DownloadChapterView): boolean => chapter.queueState === 'paused' && !chapter.localComplete)) return this.visualIcon('play');
    return this.visualIcon('download');
  }
  private visualIcon(name: string): Resource {
    if (name === 'search') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_search_theme_night') : $r('app.media.download_visual_search');
    if (name === 'clear') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_close_theme_night') : $r('app.media.download_visual_close');
    if (name === 'filter') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_filter_theme_night') : $r('app.media.download_visual_filter');
    if (name === 'storage') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_storage_theme_night') : $r('app.media.download_visual_storage');
    if (name === 'trash') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_trash_theme_night') : $r('app.media.download_visual_trash');
    if (name === 'trash_disabled') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_trash_disabled_theme_night') : $r('app.media.download_visual_trash_disabled');
    if (name === 'more') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_more_theme_night') : $r('app.media.download_visual_more');
    if (name === 'close') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_close_theme_night') : $r('app.media.download_visual_close');
    if (name === 'download') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_download_theme_night') : $r('app.media.download_visual_download');
    if (name === 'pause') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_pause_theme_night') : $r('app.media.download_visual_pause');
    if (name === 'play') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_play_theme_night') : $r('app.media.download_visual_play');
    if (name === 'retry') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_retry_theme_night') : $r('app.media.download_visual_retry');
    if (name === 'check') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_check_theme_night') : $r('app.media.download_visual_check');
    if (name === 'chevron') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_chevron_theme_night') : $r('app.media.download_visual_chevron');
    if (name === 'empty') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_empty_theme_night') : $r('app.media.download_visual_empty');
    if (name === 'sort_asc') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_sort_asc_theme_night') : $r('app.media.download_visual_sort_asc');
    if (name === 'sort_desc') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_sort_desc_theme_night') : $r('app.media.download_visual_sort_desc');
    return this.appThemeScheme === 'night' ? $r('app.media.download_visual_more_theme_night') : $r('app.media.download_visual_more');
  }
  private openBook(snapshot: DownloadBookView, generation: number = this.presentationGeneration): void {
    const book = this.eventBook(this.bookGetter(snapshot), generation);
    if (book === undefined) return;
    if (this.managing) { this.toggleBook(book.key, !this.selectedBookKeys.includes(book.key)); return; }
    this.captureListOffset();
    this.cancelManagingScroll();
    this.chapterOffset = 0; this.chapterLayoutReady = false; this.chapterScrollRestorePending = false;
    this.detailKey = book.key; this.selectedChapters = new Map<number, string>(); this.onOpenBook(book);
  }
  private back(): void {
    if (!this.uiInputIsCurrent()) return;
    this.onBack();
  }
  private consumeBack(): boolean {
    if (!this.presentationIsCurrent()) return false;
    this.readingReturnFocus = undefined;
    const generation = this.presentationGeneration;
    if (consumeReaderControlKeyboardBack(this.currentMetrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.presentationIsCurrent(generation)) {
          hilog.warn(0x5244, 'Reader', 'Download keyboard dismissal: %{private}s', error.message);
        }
      },
    })) return true;
    if (this.confirmation.length > 0) { this.confirmation = ''; return true; }
    if (this.sheet.length > 0) { this.sheet = ''; return true; }
    if (this.sheetExitPending) return true;
    if (this.managing) { this.setManaging(false); return true; }
    if (this.detailKey.length > 0) {
      const trigger = 'book-title:' + this.detailKey;
      const offset = this.listOffset;
      this.cancelManagingScroll();
      this.chapterLayoutReady = false; this.chapterScrollRestorePending = false;
      this.detailKey = ''; this.selectedChapters = new Map<number, string>();
      this.restoreListOffset(offset, trigger);
      return true;
    }
    this.publishViewState();
    return false;
  }
  private toggleBook(key: string, selected: boolean): void {
    this.selectedBookKeys = selected ? this.selectedBookKeys.concat([key]).filter((value: string, index: number, all: string[]): boolean => all.indexOf(value) === index)
      : this.selectedBookKeys.filter((value: string): boolean => value !== key);
  }
  private setManaging(managing: boolean, triggerKey: string = 'manage'): void {
    if (this.managing === managing || !this.presentationIsCurrent() || !this.fontsReady || this.modalBlocking()) return;
    const retained = this.managingScrollAnchor;
    const offset = retained !== undefined && this.managingScrollIsCurrent(retained) ? retained.offset :
      this.detailKey.length > 0 ? this.captureChapterOffset() : this.captureListOffset();
    this.cancelManagingScroll();
    this.searchInputRevision += 1;
    this.invalidateReadingHandoff();
    this.managementGeneration += 1;
    this.managing = managing;
    if (managing) {
      this.managingTriggerKey = triggerKey;
      if (triggerKey === 'manage') this.focusGeneration += 1;
      else this.syncOverlayFocus('select-all', managing);
    }
    this.selectedBookKeys = [];
    this.selectedChapters = new Map<number, string>();
    // An unbound controller has no proven position. Do not invent a zero
    // anchor and scroll a newly attached List to it later.
    if (offset !== undefined) {
      const anchor: SharedDownloadScrollAnchor = { detailKey: this.detailKey, offset, managing,
        identity: this.mountedIdentity, presentation: this.presentationGeneration,
        fonts: this.fontPreparationGeneration, windowRevision: this.readerWindowMetricsRevision };
      this.managingScrollAnchor = anchor;
      this.managingScrollRestore = anchor;
      this.managingDockMeasured = false;
      this.restoreManagingScroll();
    }
    if (!managing) {
      const returnFocus = this.managingTriggerKey;
      this.managingTriggerKey = 'manage';
      this.syncOverlayFocus(returnFocus, managing);
    }
  }

  private managingScrollIsCurrent(anchor: SharedDownloadScrollAnchor): boolean {
    return this.presentationIsCurrent(anchor.presentation) && this.fontsReady &&
      this.mountedIdentity === anchor.identity && this.fontPreparationGeneration === anchor.fonts &&
      this.readerWindowMetricsRevision === anchor.windowRevision && this.managing === anchor.managing &&
      this.detailKey === anchor.detailKey && (anchor.detailKey.length === 0 || this.detail() !== undefined);
  }

  private restoreManagingScroll(): void {
    const pending = this.managingScrollRestore;
    if (pending === undefined) return;
    if (!this.managingScrollIsCurrent(pending)) { this.cancelManagingScroll(); return; }
    this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame((): void => {
      if (this.managingScrollRestore !== pending) return;
      if (!this.managingScrollIsCurrent(pending)) { this.cancelManagingScroll(); return; }
      try {
        const scroller = pending.detailKey.length > 0 ? this.chapterScroller : this.listScroller;
        scroller.scrollTo({ xOffset: 0, yOffset: pending.offset });
      } catch (_error) {
        this.cancelManagingScroll();
        return;
      }
      this.managingScrollRestore = undefined;
      if (this.managingDockMeasured) this.managingScrollAnchor = undefined;
    }));
  }

  private cancelManagingScroll(): void {
    this.managingScrollRestore = undefined;
    this.managingScrollAnchor = undefined;
  }

  private onListTouch(event: TouchEvent): void {
    if (event.type === TouchType.Down) {
      this.cancelManagingScroll();
      this.chapterScrollRestorePending = false;
      this.readingReturnFocus = undefined;
    }
  }

  private onListFilterChanged(): void {
    // Keyboard edits and overlay selections do not necessarily touch the
    // List. Their new content owns the viewport just like a direct gesture.
    this.cancelManagingScroll();
    this.publishViewState();
  }

  private captureChapterOffset(): number | undefined {
    if (this.chapterScrollRestorePending) return undefined;
    try {
      const offset = this.chapterScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset)) {
        this.chapterOffset = offset.yOffset;
        return offset.yOffset;
      }
    } catch (_error) {
      // The controller can detach while this page changes its content branch.
    }
    return undefined;
  }
  private chapterSelected(chapter: DownloadChapterView): boolean {
    return this.selectedChapters.get(chapter.index) === chapter.chapterId;
  }
  private toggleChapter(chapter: DownloadChapterView, selected: boolean): void {
    if (chapter.chapterId.length === 0 || this.chapterSelected(chapter) === selected) return;
    const next = new Map<number, string>(this.selectedChapters);
    if (selected) next.set(chapter.index, chapter.chapterId);
    else next.delete(chapter.index);
    this.selectedChapters = next;
  }
  private selectChapters(chapters: DownloadChapterView[], keepExisting: boolean = false): void {
    const next = keepExisting ? new Map<number, string>(this.selectedChapters) : new Map<number, string>();
    for (const chapter of chapters) {
      if (chapter.navigable && chapter.chapterId.length > 0) next.set(chapter.index, chapter.chapterId);
    }
    this.selectedChapters = next;
  }
  private groupChapters(book: DownloadBookView, group: DownloadChapterView): DownloadChapterView[] {
    const offset = book.chapters.findIndex((chapter: DownloadChapterView): boolean => chapter.key === group.key);
    const chapters: DownloadChapterView[] = [];
    for (let index = offset + 1; index < book.chapters.length; index += 1) {
      const chapter = book.chapters[index];
      if (!chapter.navigable && (chapter.level ?? 0) <= (group.level ?? 0)) break;
      if (chapter.navigable) chapters.push(chapter);
    }
    return chapters;
  }
  private currentChapter(): DownloadChapterView | undefined {
    const book = this.detail(); if (book === undefined) return undefined;
    return this.currentChapterForBook(book);
  }
  private currentChapterForBook(book: DownloadBookView): DownloadChapterView | undefined {
    const index = currentDownloadReadingChapterIndex(book);
    return index === undefined ? undefined : book.chapters.find((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.index === index);
  }
  private locateCurrent(): void {
    const chapter = this.currentChapter(); const book = this.detail(); if (chapter === undefined || book === undefined) return;
    this.cancelManagingScroll();
    this.chapterScroller.scrollToIndex(2 + Number(this.mainChromeOverflow()) + book.chapters.findIndex((item: DownloadChapterView): boolean => item.key === chapter.key), true, ScrollAlign.CENTER);
  }
  private allSelected(): boolean {
    const book = this.detail();
    if (book === undefined) return this.selectedBookKeys.length > 0 && this.selectedBookKeys.length === this.visibleBooks().length;
    const chapters = book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.chapterId.length > 0);
    return chapters.length > 0 && chapters.every((chapter: DownloadChapterView): boolean => this.chapterSelected(chapter));
  }
  private manageSelectAllAction(management: number): () => void {
    const presentation = this.presentationGeneration;
    const bookKey = this.detailKey;
    return (): void => {
      if (!this.uiInputIsCurrent(presentation) || !this.managing || management !== this.managementGeneration ||
        bookKey !== this.detailKey || this.modalBlocking()) return;
      this.toggleAll();
    };
  }

  private toggleAll(): void {
    const book = this.detail();
    if (book !== undefined) this.selectChapters(this.allSelected() ? [] : book.chapters);
    else this.selectedBookKeys = this.allSelected() ? [] : this.visibleBooks().map((item: DownloadBookView): string => item.key);
  }
  private selectionLabel(): string {
    const book = this.detail();
    if (book !== undefined) return this.managing ? `已选 ${this.selectedChapters.size}${this.unit(book)}` : this.downloadCount(book, false);
    return `已选 ${this.selectedBookKeys.length} 本书`;
  }
  private captureSelection(chapters: boolean = false): boolean {
    const book = this.detail();
    if (chapters ? book === undefined || this.selectedChapters.size === 0 :
      this.detailKey.length > 0 || this.selectedBookKeys.length === 0) return false;
    this.actionBookKeys = book === undefined ? this.selectedBookKeys.slice() : [book.key];
    const proofs: SharedDownloadExpectedChapter[] = [];
    if (chapters) this.selectedChapters.forEach((chapterId: string, chapterIndex: number): void => {
      proofs.push({ chapterIndex, chapterId });
    });
    this.actionChapters = proofs;
    return true;
  }
  private chapterProof(chapter: DownloadChapterView): SharedDownloadExpectedChapter {
    return { chapterIndex: chapter.index, chapterId: chapter.chapterId };
  }
  private actionChapterRows(book: DownloadBookView): DownloadChapterView[] {
    const expected = new Map<number, string>();
    this.actionChapters.forEach((chapter: SharedDownloadExpectedChapter): void => {
      if (chapter.chapterId.length > 0) expected.set(chapter.chapterIndex, chapter.chapterId);
    });
    return book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable &&
      (this.actionChapters.length === 0 || expected.get(chapter.index) === chapter.chapterId));
  }
  private selectedIsRunning(): boolean {
    return this.actionBooks().some((book: DownloadBookView): boolean =>
      this.actionChapterRows(book).some((chapter: DownloadChapterView): boolean => this.chapterIsRunning(chapter)));
  }
  private actionAvailable(action: SharedDownloadUiAction): boolean {
    return this.actionBooks().some((book: DownloadBookView): boolean => {
      if (book.projectionStatus !== 'ready') return false;
      const chapters = this.actionChapterRows(book);
      if (this.actionChapters.length > 0 && chapters.length !== this.actionChapters.length) return false;
      if (action === 'download') return chapters.some((chapter: DownloadChapterView): boolean => !chapter.localComplete && chapter.queueState !== 'unknown');
      if (action === 'pause') return chapters.some((chapter: DownloadChapterView): boolean => this.chapterIsRunning(chapter));
      if (action === 'cancel') return chapters.some((chapter: DownloadChapterView): boolean => this.chapterIsRunning(chapter) || chapter.queueState === 'paused' || chapter.queueState === 'failed');
      return chapters.some((chapter: DownloadChapterView): boolean => chapter.localComplete || (chapter.cachedBytes ?? 0) > 0);
    });
  }
  private sheetTitle(): string {
    if (this.sheet === 'filter') return '筛选'; if (this.sheet === 'sort') return '排序';
    if (this.sheet === 'settings') return '存储管理'; if (this.sheet === 'range') return '下载范围';
    return this.sheet === 'chapter-actions' ? `章节操作 · 已选 ${this.actionChapters.length}${this.unit(this.actionBooks()[0])}`
      : this.actionBooks().length === 1 ? this.actionBooks()[0].title : `书籍操作 · 已选 ${this.actionBooks().length} 本`;
  }
  private showReadTarget(snapshot: DownloadBookView, chapterSnapshot?: DownloadChapterView,
    generation: number = this.presentationGeneration, control: SharedDownloadReadingControl = 'title'): void {
    const book = this.eventBook(this.bookGetter(snapshot), generation);
    if (book === undefined || this.detailKey !== book.key || this.managing || this.covered || !this.appForeground) return;
    const chapter = chapterSnapshot === undefined ? undefined : book.chapters.find((current: DownloadChapterView): boolean =>
      current.key === chapterSnapshot.key && current.chapterId === chapterSnapshot.chapterId);
    if (chapterSnapshot !== undefined && chapter === undefined) return;
    const target = describeDownloadReadingTarget(book, chapter);
    const revision = ++this.readingHandoffRevision;
    this.publishViewState();
    this.onReadTarget(target, (): boolean => this.presentationIsCurrent(generation) &&
      revision === this.readingHandoffRevision && this.detailKey === book.key &&
      !this.managing && !this.modalBlocking() && !this.covered && this.appForeground &&
      this.findCurrentBook(book)?.chapters.some((row: DownloadChapterView): boolean =>
        row.navigable && row.index === target.chapterIndex && row.chapterId === (target.chapterId ?? '')) === true, control);
  }

  private invalidateReadingHandoff(): void {
    this.readingHandoffRevision += 1;
    this.readingReturnFocus = undefined;
  }

  private onInputEligibilityChanged(): void {
    this.searchInputRevision += 1;
    this.invalidateReadingHandoff();
    if (!this.appForeground || this.covered) this.focusGeneration += 1;
  }

  private onDetailChanged(): void {
    this.searchInputRevision += 1;
    this.invalidateReadingHandoff();
    this.publishViewState();
  }
  private prepareRange(bookKey: string): void {
    const books = this.actionBooks();
    const titleCounts = new Map<string, number>();
    for (const book of books) titleCounts.set(book.title, (titleCounts.get(book.title) ?? 0) + 1);
    const reserved = new Set<string>(books.map((book: DownloadBookView): string => book.title));
    // Freeze labels for this opening so a live list reorder or removal never
    // turns a previously displayed option into another book.
    this.rangeBookOptions = books.map((book: DownloadBookView): DownloadChoice => {
      if (titleCounts.get(book.title) === 1) return { id: book.key, label: book.title };
      const base = `${book.title} · ${book.sourceLabel.trim() || '同名书籍'}`;
      let label = base;
      let ordinal = 2;
      while (reserved.has(label)) {
        label = `${base} (${ordinal})`;
        ordinal += 1;
      }
      reserved.add(label);
      return { id: book.key, label };
    });
    this.rangeChoice = 'all';
    this.resetRangeDraft(bookKey);
  }
  private availableRangeBooks(): DownloadChoice[] {
    const currentKeys = new Set<string>(this.actionBooks().map((book: DownloadBookView): string => book.key));
    return this.rangeBookOptions.filter((choice: DownloadChoice): boolean => currentKeys.has(choice.id));
  }
  private resetRangeDraft(bookKey: string): void {
    this.rangeBookKey = bookKey;
    this.rangeStart = '';
    this.rangeEnd = '';
    this.rangeCatalog = undefined;
    this.rangeCatalogChanged = false;
    this.rangeDraftRevision += 1;
    this.syncRangeCatalog();
  }
  private selectRangeChoice(choice: string): void {
    if (choice === this.rangeChoice) return;
    this.rangeChoice = choice;
    this.rangeDraftRevision += 1;
    this.syncRangeCatalog();
  }
  private updateRangeBound(value: string, start: boolean, opening: number, revision: number): void {
    if (!this.sheetOpeningIsCurrent(opening) || this.sheet !== 'range' ||
      this.rangeChoice !== 'custom' || revision !== this.rangeDraftRevision ||
      this.rangeCatalog === undefined || this.rangeCatalogChanged) return;
    if (start) this.rangeStart = value;
    else this.rangeEnd = value;
  }
  private rangeBook(): DownloadBookView | undefined {
    return this.actionBooks().find((book: DownloadBookView): boolean => book.key === this.rangeBookKey);
  }
  private matchesRangeCatalog(book: DownloadBookView, catalog: SharedDownloadExpectedChapter[]): boolean {
    let ordinal = 0;
    for (const chapter of book.chapters) {
      if (!chapter.navigable) continue;
      const expected = catalog[ordinal++];
      if (expected === undefined || chapter.index !== expected.chapterIndex || chapter.chapterId !== expected.chapterId)
        return false;
    }
    return ordinal === catalog.length;
  }
  private syncRangeCatalog(): void {
    if (!this.presentationIsCurrent() || this.sheet !== 'range' || this.rangeCatalogChanged) return;
    const book = this.rangeBook();
    if (book?.projectionStatus !== 'ready') return;
    const catalog = this.rangeCatalog;
    if (catalog !== undefined && this.matchesRangeCatalog(book, catalog)) return;
    if (this.rangeStart.length > 0 || this.rangeEnd.length > 0) {
      this.rangeCatalogChanged = true;
    } else if (this.rangeChoice === 'custom') {
      this.rangeCatalog = book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable)
        .map((chapter: DownloadChapterView): SharedDownloadExpectedChapter => this.chapterProof(chapter));
    }
  }
  private rangeEligible(): boolean {
    if (this.actionBooks().length === 0) return false;
    if (this.rangeChoice === 'all') return this.actionAvailable('download');
    const book = this.rangeBook();
    if (book === undefined) return false;
    if (this.rangeChoice === 'forward') return this.currentChapterForBook(book) !== undefined;
    const catalog = this.rangeCatalog;
    if (book.projectionStatus !== 'ready' || catalog === undefined || this.rangeCatalogChanged) return false;
    const start = Number(this.rangeStart); const end = Number(this.rangeEnd);
    return this.rangeStart.length > 0 && this.rangeEnd.length > 0 && Number.isInteger(start) && Number.isInteger(end) &&
      start >= 1 && end >= start && end <= catalog.length && this.matchesRangeCatalog(book, catalog);
  }
  private sendRange(): void {
    if (!this.uiInputIsCurrent() || !this.rangeEligible()) return;
    const rangedBooks = this.rangeChoice === 'all' ? this.actionBooks() : this.actionBooks().filter((book: DownloadBookView): boolean => book.key === this.rangeBookKey);
    const targets: SharedDownloadUiBookTarget[] = rangedBooks.map((book: DownloadBookView): SharedDownloadUiBookTarget => {
      const chapters = book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable);
      if (this.rangeChoice === 'all') return { sourceId: book.sourceId, bookId: book.bookId };
      let selected: DownloadChapterView[];
      if (this.rangeChoice === 'forward') {
        const current = this.currentChapterForBook(book)?.index;
        selected = chapters.filter((chapter: DownloadChapterView): boolean => current !== undefined && chapter.index >= current);
      } else selected = chapters.slice(Number(this.rangeStart) - 1, Number(this.rangeEnd));
      return { sourceId: book.sourceId, bookId: book.bookId,
        chapterIndices: selected.map((chapter: DownloadChapterView): number => chapter.index),
        expectedChapters: selected.map((chapter: DownloadChapterView): SharedDownloadExpectedChapter => this.chapterProof(chapter)) };
    });
    this.sheet = ''; this.onIntent({ action: 'download', scope: 'books', books: targets });
  }
  private sendAction(action: 'download' | 'pause' | 'cancel' | 'deleteLocal' | 'cleanup'): void {
    if (!this.uiInputIsCurrent()) return;
    const storage = action === 'cleanup';
    const scoped = !storage && this.actionChapters.length > 0;
    if (scoped && !this.actionAvailable(action)) return;
    const targets = storage ? [] : this.actionBooks().map((book: DownloadBookView): SharedDownloadUiBookTarget => ({
      sourceId: book.sourceId, bookId: book.bookId,
      chapterIndices: scoped ? this.actionChapters.map((chapter: SharedDownloadExpectedChapter): number => chapter.chapterIndex) : undefined,
      expectedChapters: scoped ? this.actionChapters.slice() : undefined,
    }));
    if (!storage && targets.length === 0) return;
    this.sheet = '';
    this.onIntent({ action, scope: storage ? 'storage' : scoped ? 'chapters' : 'books', books: targets });
  }
  private quickSelectChapters(index: number): void {
    const book = this.detail(); if (book === undefined || index === 0) return;
    const current = this.currentChapter();
    if (index === 1) this.selectChapters(current === undefined ? [] : [current]);
    else if (index === 2) this.selectChapters(current === undefined ? [] : book.chapters
      .filter((chapter: DownloadChapterView): boolean => chapter.index >= current.index));
    else if (index === 3) this.selectChapters(book.chapters);
  }
  private limitChoices(): number[] {
    const capacity = this.storagePolicy?.capacityBytes;
    if (capacity === undefined) return [];
    const current = capacity / (1024 * 1024);
    const choices = [512, 1024, 2048, 4096];
    if (!choices.includes(current)) choices.push(current);
    return choices;
  }
  private limitLabels(): string[] {
    const labels = this.limitChoices().map((limit: number): string => formatDownloadStorageBytes(limit * 1024 * 1024));
    const last = labels.length - 1;
    if (last >= 0 && labels.indexOf(labels[last]) !== last) labels[last] += '（当前）';
    return labels;
  }
  private dayChoices(): number[] {
    const current = this.storagePolicy?.expiryDays;
    if (current === undefined) return [];
    const choices = [3, 7, 14, 30];
    if (!choices.includes(current)) choices.push(current);
    return choices;
  }
  private dayLabels(): string[] { return this.dayChoices().map((days: number): string => `${days} 天`); }
  private limitIndex(): number { return this.limitChoices().indexOf((this.storagePolicy?.capacityBytes ?? -1) / (1024 * 1024)); }
  private daysIndex(): number { return this.dayChoices().indexOf(this.storagePolicy?.expiryDays ?? -1); }
  private changeStoragePolicy(opening: number, kind: 'capacity' | 'expiry', value: string): void {
    if (!this.sheetOpeningIsCurrent(opening) || this.sheet !== 'settings' || this.storagePolicy === undefined || this.storagePolicyBusy) return;
    if (kind === 'capacity') {
      const limit = this.limitChoices()[this.limitLabels().indexOf(value)];
      if (limit !== undefined && limit * 1024 * 1024 !== this.storagePolicy.capacityBytes)
        this.onIntent({ action: 'configureStorage', scope: 'storage', books: [], cacheLimitMb: limit });
    } else {
      const days = this.dayChoices()[this.dayLabels().indexOf(value)];
      if (days !== undefined && days !== this.storagePolicy.expiryDays)
        this.onIntent({ action: 'configureStorage', scope: 'storage', books: [], cleanupAfterDays: days });
    }
  }
  private publishViewState(): void {
    if (!this.mounted) return;
    if (this.detailKey.length === 0) this.captureListOffset();
    else if (this.chapterLayoutReady) this.captureChapterOffset();
    this.onViewStateChanged({ query: this.query, type: this.bookType as 'all' | 'novel' | 'manga',
      state: this.stateFilter as 'all' | 'downloading' | 'downloaded' | 'none', sourceId: this.sourceFilter,
      sort: this.sortField as 'recent' | 'title' | 'progress' | 'size', direction: this.sortDirection as 'asc' | 'desc',
      listScroll: this.listOffset, chapterScroll: this.chapterOffset, detailKey: this.detailKey });
  }
  private captureListOffset(): number | undefined {
    // @Watch runs synchronously before the main List is reattached when
    // returning from chapters. The platform may have no current offset then;
    // retain the last proven position instead of dereferencing an empty result.
    try {
      const offset = this.listScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset)) {
        this.listOffset = offset.yOffset;
        return offset.yOffset;
      }
    } catch (_error) {
      // A retired/unbound native controller cannot replace a saved position.
    }
    return undefined;
  }
  private restoreListOffset(offset: number = this.listOffset, focusTarget: string = ''): void {
    if (!this.mounted || !this.fontsReady) return;
    const presentation = this.presentationGeneration;
    const generation = this.fontPreparationGeneration;
    const focusGeneration = focusTarget.length > 0 ? ++this.focusGeneration : this.focusGeneration;
    try {
      this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame((): void => {
        if (!this.presentationIsCurrent(presentation) || !this.fontsReady ||
          generation !== this.fontPreparationGeneration || this.detailKey.length > 0 ||
          (focusTarget.length > 0 && focusGeneration !== this.focusGeneration)) return;
        try { this.listScroller.scrollTo({ xOffset: 0, yOffset: offset }); } catch (_unboundList) {}
        // Let the restored list lay out the row before looking up its title.
        if (focusTarget.length > 0 && !this.modalBlocking() && !this.managing) this.syncOverlayFocus(focusTarget);
      }));
    } catch (_unmounted) {}
  }
  private restoreChapterOffset(): void {
    if (!this.mounted || !this.fontsReady || !this.chapterScrollRestorePending || this.chapterScrollRestoreScheduled) return;
    if (this.detail()?.projectionStatus !== 'ready') {
      if (!this.loading && this.readingReturnFocus !== undefined)
        this.syncOverlayFocus('', false, this.readingReturnFocus);
      return;
    }
    if (!this.chapterLayoutReady) return;
    const identity = this.mountedIdentity;
    const generation = this.fontPreparationGeneration;
    const presentation = this.presentationGeneration;
    const detailKey = this.detailKey;
    const offset = this.chapterOffset;
    this.chapterScrollRestoreScheduled = true;
    this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame((): void => {
      if (!this.presentationIsCurrent(presentation) || this.mountedIdentity !== identity ||
        generation !== this.fontPreparationGeneration) return;
      this.chapterScrollRestoreScheduled = false;
      if (!this.fontsReady || !this.chapterLayoutReady || !this.chapterScrollRestorePending ||
        this.detailKey !== detailKey || this.detail()?.projectionStatus !== 'ready') return;
      try {
        this.chapterScroller.scrollTo({ xOffset: 0, yOffset: offset });
        this.chapterScrollRestorePending = false;
        if (this.readingReturnFocus !== undefined) this.syncOverlayFocus('', false, this.readingReturnFocus);
      } catch (_) {
        // A not-yet-attached native List retains the pending position until
        // its next measured layout or book projection becomes available.
      }
    }));
  }
  private prepareFonts(): void {
    const identity = this.mountedIdentity;
    const generation = ++this.fontPreparationGeneration;
    this.chapterScrollRestoreScheduled = false;
    this.fontsFailed = false;
    prepareSharedDownloadFonts().then((ready: boolean): void => {
      if (!this.mounted || this.mountedIdentity !== identity || generation !== this.fontPreparationGeneration) return;
      this.fontsReady = ready; this.fontsFailed = !ready;
      if (ready) {
        if (this.detailKey.length > 0) this.restoreChapterOffset();
        else this.restoreListOffset();
      }
    }).catch((_error: Error): void => {
      if (this.mounted && this.mountedIdentity === identity && generation === this.fontPreparationGeneration) this.fontsFailed = true;
    });
  }
  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      headerTransparent: false, footerBackground: pageBackground });
  }

  private currentMetrics(): ReaderWindowMetricsSnapshot {
    // StorageLink is the reactive bridge to the coordinator-owned immutable
    // snapshot. Reading it inside the render callback records this dependency.
    void this.readerWindowMetricsRevision;
    return ReaderWindowCoordinator.metrics();
  }
  private fontScale(): number {
    const scale = this.currentMetrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }
  private selectTextModifier(quick: boolean = false): TextModifier {
    const modifier = new TextModifier();
    modifier.fontFamily(quick ? TYPE_DOWNLOAD_QUICK_SELECT.fontFamily : TYPE_DOWNLOAD_BODY.fontFamily)
      .fontWeight(quick ? TYPE_DOWNLOAD_QUICK_SELECT.fontWeight : TYPE_DOWNLOAD_BODY.fontWeight)
      .fontSize(quick ? TYPE_DOWNLOAD_QUICK_SELECT.fontSizeFp : TYPE_DOWNLOAD_BODY.fontSizeFp)
      .lineHeight(quick ? TYPE_DOWNLOAD_QUICK_SELECT.lineHeightFp as number : TYPE_DOWNLOAD_BODY.lineHeightFp as number)
      .halfLeading(true).fontColor(downloadVisualColor(quick ? 'muted' : 'ink', this.appThemeScheme));
    return modifier;
  }
  private selectArrowModifier(quick: boolean = false): SymbolGlyphModifier {
    const modifier = new SymbolGlyphModifier($r('sys.symbol.chevron_down'));
    modifier.fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp.toString() + 'vp').fontColor([downloadVisualColor(quick ? 'muted' : 'ink', this.appThemeScheme)]);
    return modifier;
  }
  private selectArrowGap(quick: boolean = false): number {
    return (quick ? DOWNLOAD_VISUAL.chapterQuickArrowSlot : DOWNLOAD_VISUAL.selectArrowSlot) - DOWNLOAD_VISUAL.controlFontSize;
  }
  private selectClosedWidth(value: string, options: string[], maximum: number, rowLabel: string, quick: boolean = false): number {
    const context = this.getUIContext();
    const measure = context.getMeasureUtils();
    // ReaderInlineSelect uses ReaderSelect's default trigger, including its
    // 12fp face and 20vp padding + 8vp gap + 12vp chevron + 2vp border.
    const style = TYPE_SELECT_DEFAULT_VALUE;
    const measured = measure.measureText({ textContent: value, fontSize: style.fontSizeFp,
      fontFamily: style.fontFamily, fontWeight: style.fontWeight });
    const valuePx = Number.isFinite(measured) && measured > 0 ? measured : 0;
    const labelStyle = quick ? TYPE_DOWNLOAD_BOOK_TITLE : TYPE_DOWNLOAD_BODY;
    const labelPx = measure.measureText({ textContent: rowLabel, fontSize: labelStyle.fontSizeFp,
      fontFamily: labelStyle.fontFamily, fontWeight: labelStyle.fontWeight });
    const metrics = this.currentMetrics();
    const side = quick ? this.contentLeftInset() + this.contentRightInset() : DOWNLOAD_VISUAL.sheetBodySide * 2;
    const gap = quick ? DOWNLOAD_VISUAL.chapterToolbarGap : DOWNLOAD_VISUAL.settingsGap;
    const available = Math.max(0, metrics.windowRect.width - side - gap - Math.max(0, context.px2vp(labelPx)));
    const desired = Math.ceil(context.px2vp(valuePx)) + 42;
    return Math.min(maximum, available, desired);
  }
  private textControlHeight(minimum: number, lineHeight: number, paddingY: number): number {
    return Math.max(minimum, lineHeight * this.fontScale() + paddingY);
  }
  private storageSelectWidth(): number {
    const available = Math.max(0, this.currentMetrics().windowRect.width - DOWNLOAD_VISUAL.sheetBodySide * 2 - DOWNLOAD_VISUAL.storageSettingsGap);
    return Math.min(DOWNLOAD_VISUAL.storageSelectWidth * this.fontScale(), available / 2);
  }
  private headerTop(): number {
    // Index already applies readerContentSafeTop to App routes. Add only the
    // approved gap inside that content frame; never count the status bar twice.
    return DOWNLOAD_VISUAL.headerTopGap;
  }
  private resolvedHeaderHeight(): number {
    return this.measurements.readForGeneration('download:header', this.measurementGeneration(), DOWNLOAD_HEADER_HEIGHT);
  }
  private resolvedDockHeight(): number {
    return this.measurements.readForGeneration('download:dock', this.measurementGeneration(),
      DOWNLOAD_VISUAL.dockPaddingY * 2 + DOWNLOAD_VISUAL.headerIconHeight + DOWNLOAD_VISUAL.borderWidth * 2);
  }
  private headerContentGap(): number {
    return DOWNLOAD_VISUAL.contentTop - DOWNLOAD_VISUAL.headerTopGap - DOWNLOAD_HEADER_HEIGHT;
  }
  private contentTop(): number {
    return readerPresentedHeaderBottom(this.headerTop(),
      Math.max(DOWNLOAD_HEADER_HEIGHT, this.resolvedHeaderHeight())) + this.headerContentGap();
  }
  private contentBottom(minimum: number): number {
    return Math.max(minimum, this.resolvedDockHeight() + this.bottomInset() + DOWNLOAD_VISUAL.dockBottom);
  }
  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = this.currentMetrics();
    const overflow = this.mainChromeOverflow();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = metrics.windowRect.width;
    input.viewportHeight = this.availableHeight();
    input.measurementRevision = this.measurementRevision;
    input.chromeMode = overflow ? 'inline' : 'overlay';
    // The existing fixed-header material also owns its top/side breathing
    // room, so scrolled search borders cannot paint through that lane.
    // Moving those offsets into the slot preserves the bar and list bounds.
    input.headerTop = 0;
    input.headerHeight = this.headerTop() + this.resolvedHeaderHeight();
    input.headerInsetLeft = 0;
    input.headerInsetRight = 0;
    input.contentGap = this.headerContentGap();
    input.footerHeight = this.resolvedDockHeight();
    input.footerBottom = this.bottomInset();
    input.footerInsetLeft = this.dockLeftInset();
    input.footerInsetRight = this.dockRightInset();
    input.contentEndInset = this.contentBottom(DOWNLOAD_VISUAL.contentBottom);
    return resolveReaderPageGeometry(input);
  }
  // Approved 2026-10-20 amendment: header frames the 18vp body rail;
  // lightweight docks sit 12vp inside it. Keep generated baseline values intact.
  private leftInset(): number { return Math.max(8, readerVisualSafeLeft(this.currentMetrics())); }
  private rightInset(): number { return Math.max(8, readerVisualSafeRight(this.currentMetrics())); }
  private dockLeftInset(): number { return Math.max(30, readerVisualSafeLeft(this.currentMetrics())); }
  private dockRightInset(): number { return Math.max(30, readerVisualSafeRight(this.currentMetrics())); }
  private contentLeftInset(): number {
    return sharedDownloadContentInsets(readerVisualSafeLeft(this.currentMetrics()), readerVisualSafeRight(this.currentMetrics())).left;
  }
  private contentRightInset(): number {
    return sharedDownloadContentInsets(readerVisualSafeLeft(this.currentMetrics()), readerVisualSafeRight(this.currentMetrics())).right;
  }
  private bottomInset(): number { return Math.max(DOWNLOAD_VISUAL.dockBottom, readerInteractiveSafeBottom(this.currentMetrics())); }
  private availableHeight(): number {
    // UIContext owns keyboard OFFSET/RESIZE. Measured page height already
    // reflects any platform resize; never subtract keyboardInsets a second time.
    return readerAvailableWindowHeight(this.currentMetrics(), this.pageHeight);
  }
  private sheetMaxHeight(): number { return sharedDownloadSheetMaxHeight(this.availableHeight(), 0, 0); }
  private sheetHasFooter(): boolean { return ['filter', 'sort', 'range', 'settings'].includes(this.sheet); }
  private sheetFooterBottomInset(): number {
    return Math.max(this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageFooterBottom : DOWNLOAD_VISUAL.sheetFooterBottom,
      readerInteractiveSafeBottom(this.currentMetrics()));
  }
  private sheetBodyBottomInset(): number {
    if (this.sheet === 'settings') return 0;
    return this.sheetHasFooter() ? DOWNLOAD_VISUAL.sheetBodyBottom :
      Math.max(DOWNLOAD_VISUAL.sheetBodyBottom, readerInteractiveSafeBottom(this.currentMetrics()));
  }
  private mainChromeOverflow(): boolean {
    return this.contentTop() + this.contentBottom(DOWNLOAD_VISUAL.contentBottom) >= this.availableHeight();
  }
  private sheetChromeHeight(): number {
    const grip = DOWNLOAD_VISUAL.gripTop + DOWNLOAD_VISUAL.gripHeight + DOWNLOAD_VISUAL.gripBottom;
    const title = Math.max(DOWNLOAD_VISUAL.sheetTitleHeight, this.sheetTitleMeasuredHeight);
    const footer = this.sheetHasFooter() ? Math.max(this.sheetFooterMeasuredHeight,
      this.textControlHeight(DOWNLOAD_VISUAL.buttonHeight, DOWNLOAD_VISUAL.controlLineHeight,
        DOWNLOAD_VISUAL.buttonPaddingY * 2) + (this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageFooterTop : DOWNLOAD_VISUAL.sheetFooterTop) +
          this.sheetFooterBottomInset() + (this.sheet === 'settings' ? 0 : DOWNLOAD_VISUAL.borderWidth)) : 0;
    return grip + title + footer;
  }
  private sheetChromeOverflow(): boolean { return this.sheetChromeHeight() >= this.sheetMaxHeight(); }
  private sheetBodyMaxHeight(): number { return readerSurfaceMaxHeight(this.sheetMaxHeight(), this.sheetChromeHeight()); }
  private dialogChromeHeight(): number {
    const button = Math.max(this.dialogActionsMeasuredHeight,
      this.textControlHeight(DOWNLOAD_VISUAL.buttonHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.buttonPaddingY * 2));
    return 34 + Math.max(44, button);
  }
  private dialogChromeOverflow(): boolean {
    return this.dialogChromeHeight() + DOWNLOAD_VISUAL.dialogOuterSide * 2 >= this.availableHeight();
  }
  private dialogOuterPaddingY(): number { return this.dialogChromeOverflow() ? 0 : DOWNLOAD_VISUAL.dialogOuterSide; }
  private dialogMaxHeight(): number {
    return readerSurfaceMaxHeight(this.availableHeight(), this.dialogOuterPaddingY() * 2);
  }
  private dialogBodyMaxHeight(): number {
    return readerSurfaceMaxHeight(this.dialogMaxHeight(), this.dialogChromeHeight());
  }
  private bookHeight(key: string): number { return Math.max(DOWNLOAD_VISUAL.coverHeight, this.bookCopyHeights.get(key) ?? DOWNLOAD_VISUAL.coverHeight); }
  private bookProgressSpacer(key: string): number {
    return Math.max(0, DOWNLOAD_VISUAL.bookMinHeight - (this.bookContentHeights.get(key) ??
      DOWNLOAD_VISUAL.bookTopHeight + DOWNLOAD_VISUAL.sourceLineHeight + DOWNLOAD_VISUAL.sourceTop + DOWNLOAD_VISUAL.statusHeight + DOWNLOAD_VISUAL.progressTop) - DOWNLOAD_VISUAL.progressHeight);
  }
  private recordBookHeight(key: string, height: number): void {
    if (!Number.isFinite(height) || height <= 0 || Math.abs(height - (this.bookCopyHeights.get(key) ?? 0)) < 0.5) return;
    const values = new Map(this.bookCopyHeights); values.set(key, height); this.bookCopyHeights = values;
  }
  private recordBookContentHeight(key: string, height: number): void {
    if (!Number.isFinite(height) || height <= 0 || Math.abs(height - (this.bookContentHeights.get(key) ?? 0)) < 0.5) return;
    const values = new Map(this.bookContentHeights); values.set(key, height); this.bookContentHeights = values;
  }
  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }
  private headerHeightChangeHandler(): (height: number) => void {
    const presentation = this.presentationGeneration;
    const layout = this.measurementGeneration();
    const detail = this.detailKey;
    const managing = this.managing;
    return (height: number): void => {
      if (!this.presentationIsCurrent(presentation) || layout !== this.measurementGeneration() ||
        detail !== this.detailKey || managing !== this.managing) return;
      this.recordHeaderHeight(height);
    };
  }
  private recordHeaderHeight(height: number): void {
    if (!Number.isFinite(height) || height <= 0) return;
    if (this.measurements.record('download:header', height, this.measurementGeneration(), 0.5))
      this.measurementRevision += 1;
  }
  private recordDockHeight(height: number): void {
    if (!Number.isFinite(height) || height <= 0) return;
    if (this.measurements.record('download:dock', height, this.measurementGeneration(), 0.5))
      this.measurementRevision += 1;
    const anchor = this.managingScrollAnchor;
    if (anchor === undefined) return;
    if (!this.managingScrollIsCurrent(anchor)) { this.cancelManagingScroll(); return; }
    // The dock may report its final size after the first frame restored the
    // List. Repeat once with the same proven offset, then retire the anchor.
    this.managingDockMeasured = true;
    if (this.managingScrollRestore === undefined) {
      this.managingScrollRestore = anchor;
      this.restoreManagingScroll();
    }
  }
  private recordSheetTitleHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.sheetTitleMeasuredHeight) > 0.5) this.sheetTitleMeasuredHeight = height;
  }
  private recordSheetFooterHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.sheetFooterMeasuredHeight) > 0.5) this.sheetFooterMeasuredHeight = height;
  }
}
