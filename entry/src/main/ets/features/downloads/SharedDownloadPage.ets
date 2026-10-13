import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import { prepareSharedDownloadFonts } from '../common/ReaderFonts';
import { DOWNLOAD_VISUAL, downloadVisualColor, downloadOverlayChromeStyle, sharedDownloadSheetMaxHeight, sharedDownloadContentInsets } from '../common/SharedDownloadVisualSpec';
import {
  TYPE_DOWNLOAD_CONTROL, TYPE_DOWNLOAD_META, TYPE_DOWNLOAD_BODY, TYPE_DOWNLOAD_TAG,
  TYPE_DOWNLOAD_BOOK_TITLE, TYPE_DOWNLOAD_SHEET_TITLE, TYPE_DOWNLOAD_EMPTY_TITLE,
  TYPE_DOWNLOAD_CONFIRM_TITLE, TYPE_DOWNLOAD_META_LINE,
  TYPE_DOWNLOAD_STORAGE_META, TYPE_DOWNLOAD_STATUS_BODY, TYPE_DOWNLOAD_CONFIRM_BODY,
  TYPE_DOWNLOAD_HEADER_TITLE, TYPE_DOWNLOAD_COVER, TYPE_DOWNLOAD_TAB, TYPE_DOWNLOAD_TAB_SELECTED,
  TYPE_DOWNLOAD_SEARCH, TYPE_DOWNLOAD_LIST_TOOLS, TYPE_DOWNLOAD_SOURCE, TYPE_DOWNLOAD_SETTINGS_HINT,
  TYPE_DOWNLOAD_CHAPTER_TITLE, TYPE_DOWNLOAD_READ_BOOK_TITLE, TYPE_DOWNLOAD_QUICK_SELECT,
  TYPE_DOWNLOAD_STORAGE_TOTAL, TYPE_DOWNLOAD_STORAGE_VALUE,
} from '../common/ReaderTypography';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle } from '../../app/ReaderWindowCoordinator';
import { ReaderWindowMetricsSnapshot, readerVisualSafeLeft, readerVisualSafeRight, readerVisualSafeTop, readerInteractiveSafeBottom } from '../common/ReaderWindowMetrics';
import type { DownloadBookView, DownloadChapterView, SharedDownloadFilters, DownloadReadingTarget, DownloadStorageSummary } from './SharedDownloadProjection';
import { filterDownloadBooks, describeDownloadReadingTarget, downloadChapterDetailLabel, formatDownloadStorageBytes, canCleanDownloadStorage } from './SharedDownloadProjection';
import { FrameCallback, TextModifier, SymbolGlyphModifier } from '@kit.ArkUI';
import { ReaderInlineSelect } from '../common/ReaderInlineSelect';

export type SharedDownloadUiAction = 'download' | 'pause' | 'cancel' | 'deleteLocal' | 'cleanup' | 'configureStorage';
export interface SharedDownloadUiBookTarget {
  sourceId: string;
  bookId: string;
  chapterIndices?: number[];
}
/** Presentation intent only. This page never mutates queue, retention, files or shelf. */
export interface SharedDownloadUiIntent {
  action: SharedDownloadUiAction;
  scope: 'books' | 'chapters' | 'storage';
  books: SharedDownloadUiBookTarget[];
  cacheLimitMb?: number;
  cleanupAfterDays?: number;
}
interface DownloadSourceChoice { id: string; label: string; }
interface DownloadChoice { id: string; label: string; }
export interface SharedDownloadViewState extends SharedDownloadFilters {
  listScroll?: number;
  detailKey?: string;
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
  @StorageLink('readerAppScheme') @Watch('syncOverlayChrome') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop books: DownloadBookView[] = [];
  @Prop storageSummary: DownloadStorageSummary = {};
  @Prop loading: boolean = false;
  @Prop error: string = '';
  @Prop pendingMessage: string = '';
  @Prop @Watch('onPresentationIdentityChanged') presentationIdentity: string = '';
  @Prop initialViewState: SharedDownloadViewState = {
    query: '', type: 'all', state: 'all', sourceId: 'all', sort: 'recent', direction: 'desc',
  };
  onViewStateChanged: (state: SharedDownloadViewState) => void = (_state: SharedDownloadViewState): void => {};
  onBack: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onOpenBook: (book: DownloadBookView) => void = (_book: DownloadBookView): void => {};
  onIntent: (intent: SharedDownloadUiIntent) => void = (_intent: SharedDownloadUiIntent): void => {};
  onReadTarget: (target: DownloadReadingTarget) => void = (_target: DownloadReadingTarget): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};

  @State @Watch('publishViewState') private query: string = '';
  @State @Watch('publishViewState') private bookType: string = 'all';
  @State @Watch('publishViewState') private stateFilter: string = 'all';
  @State @Watch('publishViewState') private sourceFilter: string = 'all';
  @State @Watch('publishViewState') private sortField: string = 'recent';
  @State @Watch('publishViewState') private sortDirection: string = 'desc';
  @State @Watch('publishViewState') private detailKey: string = '';
  @State private managing: boolean = false;
  @State private selectedBookKeys: string[] = [];
  @State private selectedChapterIndices: number[] = [];
  @State @Watch('syncOverlayChrome') private sheet: string = '';
  @State private actionBookKeys: string[] = [];
  @State private actionChapterIndices: number[] = [];
  @State @Watch('syncOverlayChrome') private confirmation: string = '';
  @State private rangeChoice: string = 'all';
  @State private rangeStart: string = '';
  @State private rangeEnd: string = '';
  @State private rangeBookKey: string = '';
  @State private readingDescription: string = '';
  @State private readingBookTitle: string = '';
  @State private readingChapterTitle: string = '';
  @State private fontsReady: boolean = false;
  @State private fontsFailed: boolean = false;
  @State private pageHeight: number = 0;
  @State private headerMeasuredHeight: number = DOWNLOAD_VISUAL.headerHeight;
  @State private dockMeasuredHeight: number = DOWNLOAD_VISUAL.dockPaddingY * 2 + DOWNLOAD_VISUAL.headerIconHeight + DOWNLOAD_VISUAL.borderWidth * 2;
  @State private sheetTitleMeasuredHeight: number = DOWNLOAD_VISUAL.sheetTitleHeight;
  @State private dialogActionsMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight;
  @State private sheetFooterMeasuredHeight: number = DOWNLOAD_VISUAL.buttonHeight + DOWNLOAD_VISUAL.sheetFooterTop + DOWNLOAD_VISUAL.sheetFooterBottom + DOWNLOAD_VISUAL.borderWidth;
  @State private bookCopyHeights: Map<string, number> = new Map<string, number>();
  @State private bookContentHeights: Map<string, number> = new Map<string, number>();
  @State private cacheLimitMb: number = 2048;
  @State private cleanupAfterDays: number = 7;
  private listScroller: Scroller = new Scroller();
  private chapterScroller: Scroller = new Scroller();
  private listOffset: number = 0;
  private mountedIdentity: string = '';
  private mounted: boolean = false;
  private fontPreparationGeneration: number = 0;
  private presentationGeneration: number = 0;
  private overlayChromeClaimed: boolean = false;
  private overlayChromeRequestGeneration: number = 0;

  aboutToAppear(): void {
    this.presentationGeneration += 1;
    this.mountedIdentity = this.presentationIdentity;
    this.query = this.initialViewState.query;
    this.bookType = this.initialViewState.type;
    this.stateFilter = this.initialViewState.state;
    this.sourceFilter = this.initialViewState.sourceId;
    this.sortField = this.initialViewState.sort;
    this.sortDirection = this.initialViewState.direction;
    this.detailKey = this.initialViewState.detailKey ?? '';
    this.listOffset = this.initialViewState.listScroll ?? 0;
    this.mounted = true;
    this.syncOverlayChrome();
    this.prepareFonts();
    this.onTemporaryBackBridge((): boolean => this.consumeBack(), this.mountedIdentity);
  }
  aboutToDisappear(): void {
    this.fontPreparationGeneration += 1;
    this.publishViewState();
    const restoreChrome = this.overlayChromeClaimed && this.presentationIsCurrent();
    this.presentationGeneration += 1;
    this.overlayChromeRequestGeneration += 1;
    this.mounted = false;
    this.overlayChromeClaimed = false;
    if (restoreChrome) ReaderWindowCoordinator.requestAppChrome();
    this.onTemporaryBackBridge(undefined, this.mountedIdentity);
  }

  build() {
    ReaderPageScaffold({
      variant: 'download', headerKind: 'floating',
      headerTop: this.headerTop(), headerInsetLeft: this.leftInset(), headerInsetRight: this.rightInset(),
      footerInsetLeft: this.leftInset(), footerInsetRight: this.rightInset(), footerBottom: this.bottomInset(),
      content: (): void => { this.pageContent(); },
      header: (): void => { this.fixedHeader(); },
      footer: (): void => { this.fixedDock(); },
      overlay: (): void => { this.pageOverlays(); },
    }).onAreaChange((_old: Area, area: Area): void => {
      const height = Number(area.height);
      if (Number.isFinite(height) && height > 0 && Math.abs(height - this.pageHeight) > 0.5) this.pageHeight = height;
    });
  }

  @Builder
  private pageContent() {
    if (!this.fontsReady) {
      Column() {
        if (this.fontsFailed) { this.notice((): string => '阅读字体暂不可用', true); }
      }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(), top: this.contentTop() });
    } else if (this.detail() !== undefined) {
      this.chapterPage(this.bookGetter(this.detail() as DownloadBookView));
    } else {
      this.bookPage();
    }
  }

  @Builder
  private fixedHeader() {
    if (this.fontsReady && !this.mainChromeOverflow()) { this.topBar(); }
  }

  @Builder
  private fixedDock() {
    if (this.fontsReady && !this.mainChromeOverflow()) {
      if (this.managing || this.detail() !== undefined) { this.selectionDock(); }
      else { this.storageDock(); }
    }
  }

  @Builder
  private pageOverlays() {
    if (this.sheet.length > 0) { this.sheetOverlay(); }
    if (this.confirmation.length > 0) { this.confirmationOverlay(); }
  }

  @Builder
  private topBar() {
    Row() {
      Row() {
        Button({ type: ButtonType.Normal }) {
          Image(this.visualIcon('back'))
            .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
        }.width(DOWNLOAD_VISUAL.headerIconWidth).height(DOWNLOAD_VISUAL.headerIconHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .responseRegion({ x: (DOWNLOAD_VISUAL.headerIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('返回书籍列表')
          .onClick((): void => this.back());
      }.width(DOWNLOAD_VISUAL.headerSlotWidth);
      Text(this.detail() === undefined ? '下载管理' : '章节下载')
        .fontFamily(TYPE_DOWNLOAD_HEADER_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_HEADER_TITLE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_HEADER_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_HEADER_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).textAlign(TextAlign.Center).layoutWeight(1);
      Row() {
        Blank().layoutWeight(1);
        Button({ type: ButtonType.Normal }) {
          Text(this.managing ? '完成' : '管理').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily)
            .fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp)
            .lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
        }.width(DOWNLOAD_VISUAL.headerIconWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.headerIconHeight }).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .responseRegion({ x: (DOWNLOAD_VISUAL.headerIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget })
          .enabled(this.books.length > 0).opacity(this.books.length > 0 ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => {
            this.managing = !this.managing; this.selectedBookKeys = []; this.selectedChapterIndices = [];
          });
      }.width(DOWNLOAD_VISUAL.headerSlotWidth);
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.headerHeight }).padding(DOWNLOAD_VISUAL.headerPadding)
      .backgroundColor(downloadVisualColor('surface', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', this.appThemeScheme) }).borderRadius(DOWNLOAD_VISUAL.headerRadius)
      .shadow({ radius: DOWNLOAD_VISUAL.headerShadowRadius, color: downloadVisualColor('shadow', this.appThemeScheme), offsetX: DOWNLOAD_VISUAL.headerShadowX, offsetY: DOWNLOAD_VISUAL.headerShadowY })
      .onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.headerMeasuredHeight) > 0.5) this.headerMeasuredHeight = height;
      });
  }

  @Builder
  private compactHeader() {
    Column() { this.topBar(); }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(),
      top: this.headerTop(), bottom: this.contentTop() - this.headerTop() - this.headerMeasuredHeight });
  }

  @Builder
  private compactDock() {
    Column() {
      if (this.managing || this.detail() !== undefined) { this.selectionDock(); }
      else { this.storageDock(); }
    }.width('100%').padding({ left: this.leftInset(), right: this.rightInset(),
      top: DOWNLOAD_VISUAL.dockBottom, bottom: this.bottomInset() });
  }

  @Builder
  private bookPage() {
    List({ scroller: this.listScroller }) {
      if (this.mainChromeOverflow()) { ListItem() { this.compactHeader(); } }
      ListItem() { Column() { this.listControls(); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      if (this.loading && this.books.length === 0) {
        ListItem() { Column() { this.notice((): string => '正在读取书架…', false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      } else if (this.error.length > 0) {
        ListItem() { Column() { this.notice((): string => this.error, true); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      if (this.pendingMessage.length > 0) {
        ListItem() { Column() { this.notice((): string => this.pendingMessage, false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      if (this.visibleBooks().length === 0 && !this.loading) {
        ListItem() {
          Column() {
            Column({ space: DOWNLOAD_VISUAL.emptyGap }) {
              Image(this.visualIcon('empty')).width(DOWNLOAD_VISUAL.emptyIconSize).height(DOWNLOAD_VISUAL.emptyIconSize);
              Text(this.books.length === 0 ? '书架为空' : '没有匹配的书籍')
                .fontFamily(TYPE_DOWNLOAD_EMPTY_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_EMPTY_TITLE.fontWeight)
                .fontSize(TYPE_DOWNLOAD_EMPTY_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_EMPTY_TITLE.lineHeightFp as number).halfLeading(true)
                .fontColor(downloadVisualColor('ink', this.appThemeScheme));
              Text(this.books.length === 0 ? '加入书架后，可在这里管理下载' : '调整搜索关键词或筛选条件')
                .fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
                .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
                .fontColor(downloadVisualColor('muted', this.appThemeScheme));
            }.width('100%').padding({ top: DOWNLOAD_VISUAL.emptyTop, bottom: DOWNLOAD_VISUAL.emptyBottom,
              left: DOWNLOAD_VISUAL.emptySide, right: DOWNLOAD_VISUAL.emptySide });
          }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() });
        }
      }
      ForEach(this.visibleBooks(), (book: DownloadBookView) => {
        ListItem() { Column() { this.bookRow(this.bookGetter(book), false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }, (book: DownloadBookView): string => book.key);
      if (this.mainChromeOverflow()) { ListItem() { this.compactDock(); } }
    }.width('100%').height('100%').scrollBar(BarState.Auto).onScrollStop((): void => this.publishViewState())
      .padding({ top: this.mainChromeOverflow() ? 0 : this.contentTop(),
        bottom: this.mainChromeOverflow() ? 0 : this.contentBottom(DOWNLOAD_VISUAL.contentBottom) });
  }

  @Builder
  private listControls() {
    Column({ space: 0 }) {
      this.searchField();
      Row({ space: DOWNLOAD_VISUAL.tabsGap }) {
        this.typeTab('all', '全部');
        this.typeTab('manga', '漫画');
        this.typeTab('novel', '小说');
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
          .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget }).onClick((): void => { this.sheet = 'filter'; });
        Row({ space: DOWNLOAD_VISUAL.sortPairGap }) {
          Button({ type: ButtonType.Normal }) { this.sortBars(); }
            .width(DOWNLOAD_VISUAL.sortWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolHeight }).padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY }).borderRadius(0).backgroundColor(Color.Transparent)
            .responseRegion({ x: (DOWNLOAD_VISUAL.sortWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget })
            .accessibilityText(this.sortDirection === 'asc' ? '当前正序，切换为倒序' : '当前倒序，切换为正序')
            .onClick((): void => { this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'; });
          Button({ type: ButtonType.Normal }) {
            Text(this.sortLabel()).fontFamily(TYPE_DOWNLOAD_LIST_TOOLS.fontFamily).fontWeight(TYPE_DOWNLOAD_LIST_TOOLS.fontWeight)
              .fontSize(TYPE_DOWNLOAD_LIST_TOOLS.fontSizeFp).lineHeight(TYPE_DOWNLOAD_LIST_TOOLS.lineHeightFp as number).halfLeading(true)
              .fontColor(downloadVisualColor('ink', this.appThemeScheme));
          }.padding({ top: DOWNLOAD_VISUAL.toolPaddingY, bottom: DOWNLOAD_VISUAL.toolPaddingY }).constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolHeight }).borderRadius(0).backgroundColor(Color.Transparent)
            .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.listToolHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget }).onClick((): void => { this.sheet = 'sort'; });
        }
        Blank().layoutWeight(1);
        Text(`${this.visibleBooks().length} / ${this.books.length} 本书`)
          .fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme));
      }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.listToolsHeight }).margin({ bottom: DOWNLOAD_VISUAL.listToolsBottom });
    }.width('100%');
  }

  @Builder
  private searchField() {
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
        .onChange((value: string): void => {
          this.query = value; this.selectedBookKeys = []; this.listScroller.scrollTo({ xOffset: 0, yOffset: 0 });
        });
      if (this.query.length > 0) {
        Button({ type: ButtonType.Normal }) {
          Image(this.visualIcon('clear')).width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
        }.width(DOWNLOAD_VISUAL.searchClearWidth).height(DOWNLOAD_VISUAL.headerIconHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .responseRegion({ x: (DOWNLOAD_VISUAL.searchClearWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('清除搜索')
          .onClick((): void => { this.query = ''; this.selectedBookKeys = []; });
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.searchHeight }).padding({ left: DOWNLOAD_VISUAL.searchPaddingX, right: DOWNLOAD_VISUAL.searchPaddingX }).borderRadius(DOWNLOAD_VISUAL.searchRadius)
      .backgroundColor(downloadVisualColor('surface', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private typeTab(id: string, label: string) {
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
      .onClick((): void => { this.bookType = id; this.selectedBookKeys = []; });
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
        if ((book().coverUrl?.trim().length ?? 0) > 0) {
          Image(book().coverUrl ?? '').width(DOWNLOAD_VISUAL.coverWidth).height(this.bookHeight(book().key)).objectFit(ImageFit.Contain);
        } else {
          Text(book().title).fontFamily(TYPE_DOWNLOAD_COVER.fontFamily).fontWeight(TYPE_DOWNLOAD_COVER.fontWeight)
            .fontSize(TYPE_DOWNLOAD_COVER.fontSizeFp).lineHeight(TYPE_DOWNLOAD_COVER.lineHeightFp as number).halfLeading(true)
            .fontColor(downloadVisualColor('ink', this.appThemeScheme)).textAlign(TextAlign.Center).padding(DOWNLOAD_VISUAL.coverPadding);
        }
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
          }.padding(0).borderRadius(0).backgroundColor(Color.Transparent).layoutWeight(1)
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
                .onChange((selected: boolean): void => {
                  const current = this.eventBook(book, ownerGeneration);
                  if (current !== undefined) this.toggleBook(current.key, selected);
                });
            } else {
              this.moreButton((): string => `${book().title}的书籍操作`, (): void => {
                const current = this.eventBook(book, ownerGeneration);
                if (current === undefined) return;
                this.actionBookKeys = [current.key]; this.actionChapterIndices = []; this.sheet = 'book-actions';
              });
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
        }.width('100%').alignItems(HorizontalAlign.Start)
          .onAreaChange((_old: Area, area: Area): void => {
            const current = this.eventBook(book, ownerGeneration);
            if (current !== undefined) this.recordBookContentHeight(current.key, Number(area.height));
          });
        Blank().height(this.bookProgressSpacer(book().key));
        Progress({ value: book().progressPercent ?? 0, total: 100, type: ProgressType.Linear })
          .width('100%').height(DOWNLOAD_VISUAL.progressHeight).color(downloadVisualColor('green', this.appThemeScheme))
          .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .style({ strokeWidth: DOWNLOAD_VISUAL.progressHeight, enableSmoothEffect: false }).visibility(book().progressPercent === undefined ? Visibility.Hidden : Visibility.Visible);
      }.layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.bookMinHeight }).alignItems(HorizontalAlign.Start)
        .onAreaChange((_old: Area, area: Area): void => {
          const current = this.eventBook(book, ownerGeneration);
          if (current !== undefined) this.recordBookHeight(current.key, Number(area.height));
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
        Text(book().stateLabel).fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true)
          .fontColor(this.statusInk(book()))
          .textAlign(TextAlign.Center).layoutWeight(1);
      }.width('100%');
    }.width(DOWNLOAD_VISUAL.statusWidth).constraintSize({ minHeight: DOWNLOAD_VISUAL.statusHeight }).padding({ left: DOWNLOAD_VISUAL.statusPaddingX, right: DOWNLOAD_VISUAL.statusPaddingX }).borderRadius(DOWNLOAD_VISUAL.statusRadius)
      .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
      .enabled(!this.managing).opacity(this.managing ? DOWNLOAD_VISUAL.disabledOpacity : 1)
      .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.statusHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget })
      .accessibilityText(`${book().title}，${book().stateLabel}${this.bookIsRunning(book()) ? '，暂停' : ''}`)
      .onClick((): void => {
        const current = this.eventBook(book, ownerGeneration);
        if (this.managing || current === undefined) return;
        this.actionBookKeys = [current.key]; this.actionChapterIndices = [];
        if (this.bookIsRunning(current)) this.sendAction('pause');
        else { this.rangeBookKey = current.key; this.rangeChoice = 'all'; this.sheet = 'range'; }
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
      if (book().projectionStatus === 'unloaded') {
        ListItem() { Column() { this.notice((): string => '正在读取章节下载情况…', false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      } else if (book().projectionStatus === 'unavailable') {
        ListItem() { Column() { this.notice((): string => book().projectionError ?? '章节下载情况暂不可用', true); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      if (this.pendingMessage.length > 0) {
        ListItem() { Column() { this.notice((): string => this.pendingMessage, false); }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() }); }
      }
      ForEach(book().chapters, (chapter: DownloadChapterView) => {
        ListItem() {
          Column() {
            if (this.currentChapterView(book(), chapter).navigable) { this.chapterRow(book, this.chapterGetter(book, chapter), ownerGeneration); }
            else { this.chapterGroup(book, this.chapterGetter(book, chapter), ownerGeneration); }
          }.width('100%').padding({ left: this.contentLeftInset(), right: this.contentRightInset() });
        }
      }, (chapter: DownloadChapterView): string => chapter.key);
      if (this.mainChromeOverflow()) { ListItem() { this.compactDock(); } }
    }.width('100%').height('100%').scrollBar(BarState.Auto)
      .padding({ top: this.mainChromeOverflow() ? 0 : this.contentTop(),
        bottom: this.mainChromeOverflow() ? 0 : this.contentBottom(DOWNLOAD_VISUAL.contentBottom) });
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
              this.selectedChapterIndices = this.mergeIndices(this.selectedChapterIndices, this.groupIndices(currentBook, currentChapter));
          });
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterGroupHeight }).padding(DOWNLOAD_VISUAL.chapterGroupPadding).margin({ top: DOWNLOAD_VISUAL.chapterGroupTop }).backgroundColor(downloadVisualColor('soft', this.appThemeScheme));
  }

  @Builder
  private chapterRow(book: () => DownloadBookView, chapter: () => DownloadChapterView, ownerGeneration: number = this.presentationGeneration) {
    Row({ space: DOWNLOAD_VISUAL.chapterGap }) {
      if (this.managing) {
        Checkbox().select(this.selectedChapterIndices.includes(chapter().index)).width(DOWNLOAD_VISUAL.chapterCheckSize).height(DOWNLOAD_VISUAL.chapterCheckSize)
          .selectedColor(downloadVisualColor('green', this.appThemeScheme))
          .onChange((selected: boolean): void => {
            const current = this.eventChapter(book, chapter, ownerGeneration);
            if (current !== undefined) this.toggleChapter(current.index, selected);
          });
      }
      Column({ space: 0 }) {
        Text(chapter().title).fontFamily(TYPE_DOWNLOAD_CHAPTER_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_CHAPTER_TITLE.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CHAPTER_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CHAPTER_TITLE.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor(!chapter().localComplete && chapter().queueState === 'inProgress' ? 'green' : 'ink', this.appThemeScheme)).width('100%')
          .onClick((): void => { if (!this.managing) this.showReadTarget(book(), chapter(), ownerGeneration); });
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
          .fontColor(this.primaryInk())
          .backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .padding({ left: DOWNLOAD_VISUAL.chapterActionPaddingX, right: DOWNLOAD_VISUAL.chapterActionPaddingX, top: DOWNLOAD_VISUAL.chapterActionPaddingY, bottom: DOWNLOAD_VISUAL.chapterActionPaddingY }).borderRadius(DOWNLOAD_VISUAL.chapterActionRadius)
          .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.chapterActionHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget })
          .enabled(chapter().queueState !== 'unknown' || chapter().localComplete)
          .onClick((): void => {
            const currentBook = this.eventBook(book, ownerGeneration);
            const currentChapter = this.eventChapter(book, chapter, ownerGeneration);
            if (currentBook === undefined || currentChapter === undefined) return;
            if (currentChapter.localComplete) this.showReadTarget(book(), chapter(), ownerGeneration);
            else {
              this.actionBookKeys = [currentBook.key]; this.actionChapterIndices = [currentChapter.index];
              this.sendAction(this.chapterIsRunning(currentChapter) ? 'pause' : 'download');
            }
          });
        this.moreButton((): string => `${chapter().title}的章节操作`, (): void => {
          const currentBook = this.eventBook(book, ownerGeneration);
          const currentChapter = this.eventChapter(book, chapter, ownerGeneration);
          if (currentBook === undefined || currentChapter === undefined) return;
          this.actionBookKeys = [currentBook.key]; this.actionChapterIndices = [currentChapter.index]; this.sheet = 'chapter-actions';
        }, true);
        }
      }
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterHeight }).padding({ left: DOWNLOAD_VISUAL.chapterPaddingX, right: DOWNLOAD_VISUAL.chapterPaddingX, top: DOWNLOAD_VISUAL.chapterPaddingY, bottom: DOWNLOAD_VISUAL.chapterPaddingY })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private moreButton(label: () => string, action: () => void, chapter: boolean = false) {
    Button({ type: ButtonType.Normal }) {
      Image(this.visualIcon('more'))
        .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
    }.width(chapter ? DOWNLOAD_VISUAL.chapterMoreWidth : DOWNLOAD_VISUAL.moreWidth)
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
            if (!this.presentationIsCurrent(ownerGeneration)) return;
            if (this.fontsFailed) { this.prepareFonts(); return; }
            const book = this.detail(); if (book !== undefined) this.onOpenBook(book); else this.onRefresh();
          });
      }
    }.width('100%').padding({ top: DOWNLOAD_VISUAL.rangePaddingY, bottom: DOWNLOAD_VISUAL.rangePaddingY });
  }

  @Builder
  private storageDock() {
    Row({ space: DOWNLOAD_VISUAL.dockGap }) {
      Column({ space: 0 }) {
        Text(this.totalBytesLabel()).fontFamily(TYPE_DOWNLOAD_STORAGE_META.fontFamily).fontWeight(TYPE_DOWNLOAD_STORAGE_META.fontWeight)
          .fontSize(TYPE_DOWNLOAD_STORAGE_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_STORAGE_META.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).width('100%')
          .constraintSize({ minHeight: DOWNLOAD_VISUAL.storageLineHeight * this.fontScale() });
        Text('').height(DOWNLOAD_VISUAL.storageLineHeight * this.fontScale()).width('100%');
      }.layoutWeight(1);
      Button({ type: ButtonType.Normal }) {
        Image(this.visualIcon('storage'))
          .width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
      }.width(DOWNLOAD_VISUAL.dockIconWidth).height(DOWNLOAD_VISUAL.headerIconHeight).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .responseRegion({ x: (DOWNLOAD_VISUAL.dockIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget })
        .accessibilityText('存储管理').onClick((): void => { this.sheet = 'settings'; });
    }.width('100%').padding({ left: DOWNLOAD_VISUAL.dockPaddingX, right: DOWNLOAD_VISUAL.dockPaddingX,
      top: DOWNLOAD_VISUAL.dockPaddingY, bottom: DOWNLOAD_VISUAL.dockPaddingY })
      .backgroundColor(downloadVisualColor('surface', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', this.appThemeScheme) }).borderRadius(DOWNLOAD_VISUAL.dockRadius)
      .shadow({ radius: DOWNLOAD_VISUAL.headerShadowRadius, color: downloadVisualColor('shadow', this.appThemeScheme), offsetX: DOWNLOAD_VISUAL.headerShadowX, offsetY: DOWNLOAD_VISUAL.headerShadowY })
      .onAreaChange((_old: Area, area: Area): void => this.recordDockHeight(Number(area.height)));
  }

  @Builder
  private selectionDock() {
    Column({ space: DOWNLOAD_VISUAL.selectionSummaryBottom }) {
      Row({ space: DOWNLOAD_VISUAL.selectionSummaryGap }) {
        Text(this.selectionLabel()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
        if (this.managing) {
          Button({ type: ButtonType.Normal }) {
            Text(this.allSelected() ? '取消全选' : '全选').fontFamily(TYPE_DOWNLOAD_META.fontFamily).fontWeight(TYPE_DOWNLOAD_META.fontWeight)
              .fontSize(TYPE_DOWNLOAD_META.fontSizeFp).lineHeight(TYPE_DOWNLOAD_META.lineHeightFp as number).halfLeading(true).fontColor(this.primaryInk());
          }.constraintSize({ minHeight: DOWNLOAD_VISUAL.textActionHeight })
            .padding({ top: DOWNLOAD_VISUAL.textActionPaddingY, bottom: DOWNLOAD_VISUAL.textActionPaddingY }).backgroundColor(Color.Transparent).borderRadius(0)
            .responseRegion({ x: 0, y: (DOWNLOAD_VISUAL.textActionHeight - DOWNLOAD_VISUAL.touchTarget) / 2, width: '100%', height: DOWNLOAD_VISUAL.touchTarget }).onClick((): void => this.toggleAll());
        }
      }.width('100%');
      Row({ space: DOWNLOAD_VISUAL.actionGap }) {
        if (this.detail() !== undefined && !this.managing) {
          this.actionButton((): string => '选择章节', true, (): boolean => true, (): void => { this.managing = true; });
          this.actionButton((): string => '定位当前', false, (): boolean => this.currentChapter() !== undefined, (): void => this.locateCurrent());
        } else if (this.detail() !== undefined) {
          this.actionButton((): string => '下载所选', true, (): boolean => this.selectedChapterIndices.length > 0, (): void => {
            this.captureSelection(); this.sendAction('download');
          });
          this.actionButton((): string => '暂停所选', false, (): boolean => this.selectedChapterIndices.length > 0, (): void => {
            this.captureSelection(); this.sendAction('pause');
          });
          this.actionButton((): string => '更多', false, (): boolean => this.selectedChapterIndices.length > 0, (): void => {
            this.captureSelection(); this.sheet = 'chapter-actions';
          });
        } else {
          this.actionButton((): string => '下载所选书籍', true, (): boolean => this.selectedBookKeys.length > 0, (): void => {
            this.captureSelection(); this.rangeBookKey = this.actionBookKeys[0] ?? ''; this.rangeChoice = 'all'; this.sheet = 'range';
          });
          this.actionButton((): string => '更多书籍操作', false, (): boolean => this.selectedBookKeys.length > 0, (): void => {
            this.captureSelection(); this.sheet = 'book-actions';
          });
        }
      }.width('100%');
    }.width('100%').padding(DOWNLOAD_VISUAL.selectionPadding).backgroundColor(downloadVisualColor('surface', this.appThemeScheme))
      .border({ width: DOWNLOAD_VISUAL.borderWidth, color: downloadVisualColor('line', this.appThemeScheme) }).borderRadius(DOWNLOAD_VISUAL.dockRadius)
      .shadow({ radius: DOWNLOAD_VISUAL.headerShadowRadius, color: downloadVisualColor('shadow', this.appThemeScheme), offsetX: DOWNLOAD_VISUAL.headerShadowX, offsetY: DOWNLOAD_VISUAL.headerShadowY })
      .onAreaChange((_old: Area, area: Area): void => this.recordDockHeight(Number(area.height)));
  }

  @Builder
  private actionButton(label: () => string, primary: boolean, enabled: () => boolean, action: () => void, ownerGeneration: number = this.presentationGeneration) {
    Button({ type: ButtonType.Normal }) {
      Text(label()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
        .fontColor(this.actionInk(primary)).textAlign(TextAlign.Center);
    }.layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.buttonHeight })
      .padding({ left: DOWNLOAD_VISUAL.buttonPaddingX, right: DOWNLOAD_VISUAL.buttonPaddingX,
        top: DOWNLOAD_VISUAL.buttonPaddingY, bottom: DOWNLOAD_VISUAL.buttonPaddingY }).borderRadius(DOWNLOAD_VISUAL.buttonRadius)
      .backgroundColor(downloadVisualColor(primary ? 'green' : 'soft', this.appThemeScheme))
      .enabled(enabled()).opacity(enabled() ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => { if (this.presentationIsCurrent(ownerGeneration) && enabled()) action(); });
  }

  @Builder
  private sheetOverlay() {
    Stack({ alignContent: Alignment.Bottom }) {
      Rect().width('100%').height('100%').fill(downloadVisualColor('scrim', this.appThemeScheme))
        .onClick((): void => { this.sheet = ''; });
      Column({ space: 0 }) {
        if (this.sheetChromeOverflow()) {
          Scroll() { Column({ space: 0 }) { this.sheetContent(true); }.width('100%'); }
            .width('100%').constraintSize({ maxHeight: this.sheetMaxHeight() }).scrollBar(BarState.Auto);
        } else {
          this.sheetContent(false);
        }
      }.width('100%').constraintSize({ maxHeight: this.sheetMaxHeight() })
        .backgroundColor(downloadVisualColor('surface', this.appThemeScheme))
        .borderRadius({ topLeft: DOWNLOAD_VISUAL.sheetRadius, topRight: DOWNLOAD_VISUAL.sheetRadius }).clip(true)
        .shadow({ radius: DOWNLOAD_VISUAL.sheetShadowRadius, color: downloadVisualColor('shadow', this.appThemeScheme), offsetX: DOWNLOAD_VISUAL.sheetShadowX, offsetY: DOWNLOAD_VISUAL.sheetShadowY });
    }.width('100%').height('100%');
  }

  @Builder
  private sheetContent(wholeDocument: boolean) {
    Rect().width(DOWNLOAD_VISUAL.gripWidth).height(DOWNLOAD_VISUAL.gripHeight)
      .fill(downloadVisualColor('line', this.appThemeScheme)).radius(DOWNLOAD_VISUAL.gripRadius)
      .margin({ top: DOWNLOAD_VISUAL.gripTop, bottom: DOWNLOAD_VISUAL.gripBottom });
    Row() {
      Text(this.sheetTitle()).fontFamily(TYPE_DOWNLOAD_SHEET_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_SHEET_TITLE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_SHEET_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SHEET_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1).wordBreak(WordBreak.BREAK_WORD);
      Button({ type: ButtonType.Normal }) {
        Image(this.visualIcon('close')).width(DOWNLOAD_VISUAL.moreIconSize).height(DOWNLOAD_VISUAL.moreIconSize);
      }.height(DOWNLOAD_VISUAL.headerIconHeight).width(DOWNLOAD_VISUAL.headerIconWidth).padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .responseRegion({ x: (DOWNLOAD_VISUAL.headerIconWidth - DOWNLOAD_VISUAL.touchTarget) / 2, y: 0, width: DOWNLOAD_VISUAL.touchTarget, height: DOWNLOAD_VISUAL.touchTarget }).accessibilityText('关闭面板')
        .onClick((): void => { this.sheet = ''; });
    }.constraintSize({ minHeight: DOWNLOAD_VISUAL.sheetTitleHeight }).width('100%')
      .padding({ left: DOWNLOAD_VISUAL.sheetTitleLeft, right: DOWNLOAD_VISUAL.sheetTitleRight })
      .onAreaChange((_old: Area, area: Area): void => this.recordSheetTitleHeight(Number(area.height)));
    if (wholeDocument) {
      this.sheetBody();
    } else {
      Scroll() { this.sheetBody(); }.width('100%').constraintSize({ maxHeight: this.sheetBodyMaxHeight() }).scrollBar(BarState.Auto);
    }
    if (this.sheetHasFooter()) {
      if (this.sheet === 'settings') {
        Row() { this.clearStorageButton(); }
          .width('100%').padding({ left: DOWNLOAD_VISUAL.storageFooterSide, right: DOWNLOAD_VISUAL.storageFooterSide,
            top: DOWNLOAD_VISUAL.storageFooterTop, bottom: this.sheetFooterBottomInset() })
          .onAreaChange((_old: Area, area: Area): void => this.recordSheetFooterHeight(Number(area.height)));
      } else {
        Row() {
        this.actionButton((): string => this.sheet === 'range' ? '开始下载' : this.sheet === 'read' ? '返回章节下载' : '完成', true,
          (): boolean => this.sheet !== 'range' || this.rangeEligible(), (): void => {
            if (this.sheet === 'range') this.sendRange(); else this.sheet = '';
          });
      }.width('100%').padding({ left: DOWNLOAD_VISUAL.sheetFooterSide, right: DOWNLOAD_VISUAL.sheetFooterSide,
        top: DOWNLOAD_VISUAL.sheetFooterTop, bottom: this.sheetFooterBottomInset() })
        .border({ width: { top: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) })
        .onAreaChange((_old: Area, area: Area): void => this.recordSheetFooterHeight(Number(area.height)));
      }
    }
  }

  @Builder
  private sheetBody() {
    Column({ space: 0 }) {
      if (this.sheet === 'filter') { this.filterSheet(); }
      else if (this.sheet === 'sort') { this.sortSheet(); }
      else if (this.sheet === 'settings') { this.settingsSheet(); }
      else if (this.sheet === 'read') { this.readSheet(); }
      else if (this.sheet === 'range') { this.rangeSheet(); }
      else { this.operationsSheet(); }
    }.width('100%').padding({ left: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
      right: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodySide : DOWNLOAD_VISUAL.sheetBodySide,
      top: this.sheet === 'settings' ? DOWNLOAD_VISUAL.storageBodyTop : 0,
      bottom: this.sheetBodyBottomInset() });
  }

  @Builder
  private filterSheet() {
    Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
      Text('下载状态').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
      ReaderInlineSelect({
        value: this.stateChoices().find((choice: DownloadChoice): boolean => choice.id === this.stateFilter)?.label ?? '全部状态',
        options: this.stateChoices().map((choice: DownloadChoice): string => choice.label),
        selectedIndex: Math.max(0, this.stateChoices().findIndex((choice: DownloadChoice): boolean => choice.id === this.stateFilter)),
        controlWidth: this.selectClosedWidth(this.stateChoices().find((choice: DownloadChoice): boolean => choice.id === this.stateFilter)?.label ?? '全部状态', this.stateChoices().map((choice: DownloadChoice): string => choice.label), DOWNLOAD_VISUAL.settingsSelectMaxWidth, '下载状态'),
        onSelect: (index: number, _value: string): void => { this.stateFilter = this.stateChoices()[index]?.id ?? 'all'; this.selectedBookKeys = []; },
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
    Row({ space: DOWNLOAD_VISUAL.settingsGap }) {
      Text('书源').fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).layoutWeight(1);
      ReaderInlineSelect({
        value: this.sourceChoices().find((choice: DownloadSourceChoice): boolean => choice.id === this.sourceFilter)?.label ?? '全部书源',
        options: this.sourceChoices().map((choice: DownloadSourceChoice): string => choice.label),
        selectedIndex: Math.max(0, this.sourceChoices().findIndex((choice: DownloadSourceChoice): boolean => choice.id === this.sourceFilter)),
        controlWidth: this.selectClosedWidth(this.sourceChoices().find((choice: DownloadSourceChoice): boolean => choice.id === this.sourceFilter)?.label ?? '全部书源', this.sourceChoices().map((choice: DownloadSourceChoice): string => choice.label), DOWNLOAD_VISUAL.settingsSelectMaxWidth, '书源'),
        onSelect: (index: number, _value: string): void => { this.sourceFilter = this.sourceChoices()[index]?.id ?? 'all'; this.selectedBookKeys = []; },
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.settingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
  }

  @Builder
  private sortSheet() {
    ForEach(this.sortChoices(), (choice: DownloadChoice) => {
      this.choiceRow(choice.label, (): boolean => this.sortField === choice.id, (): void => { this.sortField = choice.id; });
    }, (choice: DownloadChoice): string => choice.id);
  }

  @Builder
  private choiceRow(label: string, selected: () => boolean, action: () => void, ownerGeneration: number = this.presentationGeneration) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: DOWNLOAD_VISUAL.rangeGap }) {
        Radio({ value: label, group: `shared-download-${this.sheet}` }).checked(selected())
          .width(DOWNLOAD_VISUAL.radioSize).height(DOWNLOAD_VISUAL.radioSize).padding(0)
          .radioStyle({ checkedBackgroundColor: downloadVisualColor('green', this.appThemeScheme),
            uncheckedBorderColor: downloadVisualColor('muted', this.appThemeScheme), indicatorColor: downloadVisualColor('surface', this.appThemeScheme) })
          .onChange((checked: boolean): void => { if (checked && this.presentationIsCurrent(ownerGeneration)) action(); });
        Text(label).layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight).fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme));
      }.width('100%');
    }.constraintSize({ minHeight: DOWNLOAD_VISUAL.rangeHeight }).width('100%')
      .padding({ left: 0, right: 0, top: DOWNLOAD_VISUAL.rangePaddingY, bottom: DOWNLOAD_VISUAL.rangePaddingY }).borderRadius(0).backgroundColor(Color.Transparent)
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) })
      .accessibilityText(`${label}${selected() ? '，已选择' : ''}`).onClick((): void => { if (this.presentationIsCurrent(ownerGeneration)) action(); });
  }

  @Builder
  private operationsSheet() {
    this.menuAction((): string => this.selectedIsRunning() ? '暂停' : '下载', false,
      (): boolean => this.actionAvailable(this.selectedIsRunning() ? 'pause' : 'download'), (): void => {
        if (this.selectedIsRunning()) this.sendAction('pause');
        else if (this.sheet === 'book-actions') {
          this.rangeBookKey = this.actionBookKeys[0] ?? ''; this.rangeChoice = 'all'; this.sheet = 'range';
        } else this.sendAction('download');
      });
    this.menuAction((): string => '取消下载任务', false, (): boolean => this.actionAvailable('cancel'), (): void => { this.sheet = ''; this.confirmation = 'cancel'; });
    this.menuAction((): string => '删除本地内容', true, (): boolean => this.actionAvailable('deleteLocal'), (): void => { this.sheet = ''; this.confirmation = 'deleteLocal'; });
  }

  @Builder
  private menuAction(label: () => string, danger: boolean, enabled: () => boolean, action: () => void, ownerGeneration: number = this.presentationGeneration) {
    Button({ type: ButtonType.Normal }) {
      Text(label()).width('100%').textAlign(TextAlign.Start)
        .fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight).fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(this.operationInk(danger));
    }.constraintSize({ minHeight: DOWNLOAD_VISUAL.chapterMenuHeight }).width('100%')
      .padding({ left: 0, right: 0, top: DOWNLOAD_VISUAL.chapterMenuPaddingY, bottom: DOWNLOAD_VISUAL.chapterMenuPaddingY }).borderRadius(0)
      .backgroundColor(Color.Transparent).border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) })
      .enabled(enabled()).opacity(enabled() ? 1 : DOWNLOAD_VISUAL.disabledOpacity).onClick((): void => { if (this.presentationIsCurrent(ownerGeneration) && enabled()) action(); });
  }

  @Builder
  private settingsSheet() {
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
        value: this.cacheLimitMb === 512 ? '512 MB' : `${this.cacheLimitMb / 1024} GB`,
        options: ['512 MB', '1 GB', '2 GB', '4 GB'],
        selectedIndex: this.limitIndex(),
        controlWidth: this.storageSelectWidth(),
        onSelect: (index: number, _value: string): void => { this.cacheLimitMb = [512, 1024, 2048, 4096][index]; },
      });
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageSettingsHeight })
      .border({ width: { bottom: DOWNLOAD_VISUAL.borderWidth }, color: downloadVisualColor('line', this.appThemeScheme) });
    Row({ space: DOWNLOAD_VISUAL.storageSettingsGap }) {
      Text('多久未阅读后清理').layoutWeight(1).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme));
      ReaderInlineSelect({
        value: `${this.cleanupAfterDays} 天`,
        options: ['3 天', '7 天', '14 天', '30 天'],
        selectedIndex: this.daysIndex(),
        controlWidth: this.storageSelectWidth(),
        onSelect: (index: number, _value: string): void => { this.cleanupAfterDays = [3, 7, 14, 30][index]; },
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
  private clearStorageButton(ownerGeneration: number = this.presentationGeneration) {
    // ButtonPattern dims its whole render layer when disabled. Keep the real
    // disabled Button as the event/accessibility owner, with authored pixels
    // on a non-interactive sibling. matchParent follows the Row's final size.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: DOWNLOAD_VISUAL.storageActionGap }) {
        Image(this.visualIcon(canCleanDownloadStorage(this.storageSummary) ? 'trash' : 'trash_disabled'))
          .width(DOWNLOAD_VISUAL.storageActionIconSize).height(DOWNLOAD_VISUAL.storageActionIconSize);
        Text(this.storageCleanLabel()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
          .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor(canCleanDownloadStorage(this.storageSummary) ? 'greenInk' : 'muted', this.appThemeScheme))
          .textAlign(TextAlign.Center);
      }.width('100%').justifyContent(FlexAlign.Center).constraintSize({ minHeight: DOWNLOAD_VISUAL.storageActionMinHeight })
      .padding({ left: DOWNLOAD_VISUAL.storageActionPaddingX, right: DOWNLOAD_VISUAL.storageActionPaddingX,
        top: DOWNLOAD_VISUAL.storageActionPaddingY, bottom: DOWNLOAD_VISUAL.storageActionPaddingY }).borderRadius(DOWNLOAD_VISUAL.storageActionRadius)
      .backgroundColor(downloadVisualColor(canCleanDownloadStorage(this.storageSummary) ? 'green' : 'soft', this.appThemeScheme))
      .renderGroup(true).opacity(canCleanDownloadStorage(this.storageSummary) ? 1 : DOWNLOAD_VISUAL.storageActionDisabledOpacity).hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no-hide-descendants');
      Button({ type: ButtonType.Normal }) {}
        .width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent).padding(0)
        .borderRadius(DOWNLOAD_VISUAL.storageActionRadius).backgroundColor(Color.Transparent)
        .accessibilityText(this.storageCleanLabel()).enabled(canCleanDownloadStorage(this.storageSummary))
        .onClick((): void => this.openStorageCleanup(ownerGeneration));
    }.width('100%').constraintSize({ minHeight: DOWNLOAD_VISUAL.storageActionMinHeight });
  }

  @Builder
  private readSheet() {
    Text(this.readingBookTitle).fontFamily(TYPE_DOWNLOAD_READ_BOOK_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_READ_BOOK_TITLE.fontWeight)
      .fontSize(TYPE_DOWNLOAD_READ_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_READ_BOOK_TITLE.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', this.appThemeScheme)).width('100%').margin({ bottom: DOWNLOAD_VISUAL.rangeBookBottom });
    Text(this.readingChapterTitle).fontFamily(TYPE_DOWNLOAD_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_BODY.fontWeight)
      .fontSize(TYPE_DOWNLOAD_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_BODY.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('ink', this.appThemeScheme)).width('100%');
    Text(this.readingDescription).fontFamily(TYPE_DOWNLOAD_SETTINGS_HINT.fontFamily).fontWeight(TYPE_DOWNLOAD_SETTINGS_HINT.fontWeight)
      .fontSize(TYPE_DOWNLOAD_SETTINGS_HINT.fontSizeFp).lineHeight(TYPE_DOWNLOAD_SETTINGS_HINT.lineHeightFp as number).halfLeading(true)
      .fontColor(downloadVisualColor('muted', this.appThemeScheme)).width('100%')
      .margin({ top: DOWNLOAD_VISUAL.settingsHintMargin, bottom: DOWNLOAD_VISUAL.settingsHintMargin });
  }

  @Builder
  private rangeSheet() {
    if (this.actionBookKeys.length > 1) {
      ReaderInlineSelect({
        value: this.actionBooks().find((book: DownloadBookView): boolean => book.key === this.rangeBookKey)?.title ?? '',
        options: this.actionBooks().map((book: DownloadBookView): string => book.title),
        selectedIndex: Math.max(0, this.actionBooks().findIndex((book: DownloadBookView): boolean => book.key === this.rangeBookKey)),
        controlWidth: 0,
        onSelect: (index: number, _value: string): void => { this.rangeBookKey = this.actionBooks()[index]?.key ?? ''; },
      }).width('100%').margin({ bottom: DOWNLOAD_VISUAL.rangeBookBottom });
    }
    this.choiceRow('全部章节', (): boolean => this.rangeChoice === 'all', (): void => { this.rangeChoice = 'all'; });
    this.choiceRow('从当前章节往后', (): boolean => this.rangeChoice === 'forward', (): void => { this.rangeChoice = 'forward'; });
    this.choiceRow('选择章节范围', (): boolean => this.rangeChoice === 'custom', (): void => { this.rangeChoice = 'custom'; });
    if (this.rangeChoice === 'custom') {
      Row({ space: DOWNLOAD_VISUAL.actionGap }) {
        TextInput({ text: this.rangeStart, placeholder: '起始序号' }).layoutWeight(1).type(InputType.Number)
          .height(this.textControlHeight(DOWNLOAD_VISUAL.searchHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.searchPaddingY * 2))
          .fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .onChange((value: string): void => { this.rangeStart = value; });
        Text('至').fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
          .fontColor(downloadVisualColor('muted', this.appThemeScheme));
        TextInput({ text: this.rangeEnd, placeholder: '结束序号' }).layoutWeight(1).type(InputType.Number)
          .height(this.textControlHeight(DOWNLOAD_VISUAL.searchHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.searchPaddingY * 2))
          .fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight).fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number)
          .fontColor(downloadVisualColor('ink', this.appThemeScheme)).backgroundColor(downloadVisualColor('soft', this.appThemeScheme))
          .onChange((value: string): void => { this.rangeEnd = value; });
      }.width('100%').margin({ top: DOWNLOAD_VISUAL.rangeSelectionTop });
    }
  }

  @Builder
  private confirmationOverlay() {
    Stack({ alignContent: Alignment.Center }) {
      Rect().width('100%').height('100%').fill(downloadVisualColor('scrim', this.appThemeScheme));
      Column() {
        Column({ space: 0 }) {
          if (this.dialogChromeOverflow()) {
            Scroll() { this.confirmationContent(true); }.width('100%')
              .constraintSize({ maxHeight: this.dialogMaxHeight() }).scrollBar(BarState.Auto);
          } else {
            this.confirmationContent(false);
          }
        }.width('100%').borderRadius(DOWNLOAD_VISUAL.dialogRadius).clip(true)
          .backgroundColor(downloadVisualColor('surface', this.appThemeScheme));
      }.width('100%').padding({ left: DOWNLOAD_VISUAL.dialogOuterSide, right: DOWNLOAD_VISUAL.dialogOuterSide,
        top: this.dialogOuterPaddingY(), bottom: this.dialogOuterPaddingY() });
    }.width('100%').height('100%');
  }

  @Builder
  private confirmationContent(wholeDocument: boolean, ownerGeneration: number = this.presentationGeneration) {
    Column({ space: 0 }) {
      if (wholeDocument) {
        this.confirmationBody();
      } else {
        Scroll() { this.confirmationBody(); }.width('100%')
          .constraintSize({ maxHeight: this.dialogBodyMaxHeight() }).scrollBar(BarState.Auto);
      }
      Row({ space: DOWNLOAD_VISUAL.actionGap }) {
        this.confirmationButton((): string => '取消', false, (): void => {
          if (this.presentationIsCurrent(ownerGeneration)) this.confirmation = '';
        });
        this.confirmationButton((): string => this.confirmation === 'cleanup' ? `清理 ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)}` :
          this.confirmation === 'cancel' ? '取消任务' : '删除内容', true, (): void => {
          if (!this.presentationIsCurrent(ownerGeneration)) return;
          if (this.confirmation === 'cleanup') { this.confirmStorageCleanup(ownerGeneration); return; }
          const action: SharedDownloadUiAction = this.confirmation === 'cancel' ? 'cancel' : 'deleteLocal';
          this.confirmation = ''; this.sendAction(action);
        }, (): boolean => this.confirmation !== 'cleanup' || canCleanDownloadStorage(this.storageSummary));
      }.width('100%').onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.dialogActionsMeasuredHeight) > 0.5)
          this.dialogActionsMeasuredHeight = height;
      });
    }.width('100%').padding({ top: DOWNLOAD_VISUAL.dialogTop, left: DOWNLOAD_VISUAL.dialogSide,
      right: DOWNLOAD_VISUAL.dialogSide, bottom: DOWNLOAD_VISUAL.dialogBottom });
  }

  @Builder
  private confirmationBody() {
    Column({ space: 0 }) {
      Text(this.confirmationTitle())
        .fontFamily(TYPE_DOWNLOAD_CONFIRM_TITLE.fontFamily).fontWeight(TYPE_DOWNLOAD_CONFIRM_TITLE.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONFIRM_TITLE.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONFIRM_TITLE.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('ink', this.appThemeScheme)).width('100%').margin({ bottom: DOWNLOAD_VISUAL.dialogTitleBottom });
      Text(this.confirmationCopy())
        .fontFamily(TYPE_DOWNLOAD_CONFIRM_BODY.fontFamily).fontWeight(TYPE_DOWNLOAD_CONFIRM_BODY.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONFIRM_BODY.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONFIRM_BODY.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor('muted', this.appThemeScheme)).width('100%').margin({ bottom: DOWNLOAD_VISUAL.dialogBodyBottom });
    }.width('100%');
  }

  @Builder
  private confirmationButton(label: () => string, danger: boolean, action: () => void, enabled: () => boolean = (): boolean => true) {
    Button({ type: ButtonType.Normal }) {
      Text(label()).fontFamily(TYPE_DOWNLOAD_CONTROL.fontFamily).fontWeight(TYPE_DOWNLOAD_CONTROL.fontWeight)
        .fontSize(TYPE_DOWNLOAD_CONTROL.fontSizeFp).lineHeight(TYPE_DOWNLOAD_CONTROL.lineHeightFp as number).halfLeading(true)
        .fontColor(downloadVisualColor(danger ? 'danger' : 'ink', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.layoutWeight(1).constraintSize({ minHeight: DOWNLOAD_VISUAL.buttonHeight })
      .padding({ left: DOWNLOAD_VISUAL.buttonPaddingX, right: DOWNLOAD_VISUAL.buttonPaddingX,
        top: DOWNLOAD_VISUAL.buttonPaddingY, bottom: DOWNLOAD_VISUAL.buttonPaddingY }).borderRadius(DOWNLOAD_VISUAL.buttonRadius)
      .backgroundColor(downloadVisualColor('soft', this.appThemeScheme)).enabled(enabled())
      .onClick((): void => { if (enabled()) action(); });
  }

  private confirmationTitle(): string {
    if (this.confirmation === 'cleanup') return '清理自动保存？';
    const books = this.actionBooks();
    const label = this.confirmation === 'cancel' ? '取消任务' : '删除内容';
    if (this.actionChapterIndices.length > 0)
      return `确认${label} · ${this.actionChapterIndices.length}${this.unit(books[0])}？`;
    const title = this.confirmation === 'cancel' ? '取消下载任务？' : '删除本地内容？';
    return `${title}（${books.length}本书）`;
  }
  private confirmationCopy(): string {
    if (this.confirmation === 'cleanup')
      return `将清理 ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)} 自动保存的内容。保留下载、正在阅读和下载的内容不受影响，书架与阅读记录保留。`;
    if (this.actionChapterIndices.length > 0)
      return this.confirmation === 'cancel' ? '仅取消所选章节的剩余下载，已下载内容保留。' :
        '仅删除所选章节的本地内容，并取消这些章节的剩余下载。书架和阅读记录保留。';
    return this.confirmation === 'cancel' ? '已下载的内容会保留，可以继续阅读。' :
      '删除所选书籍的本地内容，之后阅读需要重新获取。书架与阅读记录保留。';
  }
  private primaryInk(): string { return downloadVisualColor('green', this.appThemeScheme); }

  private storageCleanLabel(): string {
    if (formatDownloadStorageBytes(this.storageSummary.cleanableBytes).length === 0) return '清理自动保存';
    return canCleanDownloadStorage(this.storageSummary) ?
      `清理自动保存 · ${formatDownloadStorageBytes(this.storageSummary.cleanableBytes)}` : '暂无可清理的自动保存';
  }
  private openStorageCleanup(generation: number = this.presentationGeneration): void {
    if (!this.presentationIsCurrent(generation) || this.sheet !== 'settings' || !canCleanDownloadStorage(this.storageSummary)) return;
    this.confirmation = 'cleanup';
  }
  private confirmStorageCleanup(generation: number = this.presentationGeneration): void {
    if (!this.presentationIsCurrent(generation) || this.confirmation !== 'cleanup' || !canCleanDownloadStorage(this.storageSummary)) return;
    this.confirmation = ''; this.sendAction('cleanup');
  }
  private tabInk(id: string): string {
    return downloadVisualColor(this.bookType === id ? 'green' : 'ink', this.appThemeScheme);
  }
  private statusInk(book: DownloadBookView): string {
    return downloadVisualColor(book.stateLabel === '下载失败' ? 'danger' : book.stateLabel === '未下载' ? 'muted' : 'green', this.appThemeScheme);
  }
  private actionInk(primary: boolean): string { return downloadVisualColor(primary ? 'greenInk' : 'ink', this.appThemeScheme); }
  private operationInk(danger: boolean): string { return downloadVisualColor(danger ? 'danger' : 'ink', this.appThemeScheme); }

  private presentationIsCurrent(generation: number = this.presentationGeneration): boolean {
    return this.mounted && generation === this.presentationGeneration &&
      this.presentationIdentity === this.mountedIdentity;
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
      if (this.sheet.length > 0 || this.confirmation.length > 0) {
        const visual = downloadOverlayChromeStyle(this.appThemeScheme,
          this.sheet.length > 0 && this.confirmation.length === 0,
          this.sheet === 'settings' && this.confirmation === 'cleanup' ? 2 : 1);
        const style = new ReaderWindowChromeStyle(visual.underlayColor, visual.tone, visual.contentColor);
        style.navigationUnderlayColor = visual.navigationUnderlayColor;
        style.navigationContentColor = visual.navigationContentColor;
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
    this.overlayChromeRequestGeneration += 1;
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
    return this.findCurrentBook(book)?.chapters.find((current: DownloadChapterView): boolean => current.key === snapshot.key) ?? snapshot;
  }
  private eventBook(book: () => DownloadBookView, generation: number = this.presentationGeneration): DownloadBookView | undefined {
    return this.presentationIsCurrent(generation) ? this.findCurrentBook(book()) : undefined;
  }
  private eventChapter(book: () => DownloadBookView, chapter: () => DownloadChapterView,
    generation: number = this.presentationGeneration): DownloadChapterView | undefined {
    return this.eventBook(book, generation)?.chapters.find((current: DownloadChapterView): boolean => current.key === chapter().key);
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
    if (known.length !== this.books.length) return '';
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
  private sourceChoices(): DownloadSourceChoice[] {
    const choices: DownloadSourceChoice[] = [{ id: 'all', label: '全部书源' }];
    this.books.forEach((book: DownloadBookView): void => {
      if (!choices.some((choice: DownloadSourceChoice): boolean => choice.id === book.sourceId))
        choices.push({ id: book.sourceId, label: book.sourceLabel || book.sourceId });
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
    if (name === 'back') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_back_theme_night') : $r('app.media.download_visual_back');
    if (name === 'search') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_search_theme_night') : $r('app.media.download_visual_search');
    if (name === 'clear') return this.appThemeScheme === 'night' ? $r('app.media.download_visual_clear_theme_night') : $r('app.media.download_visual_clear');
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
    this.detailKey = book.key; this.selectedChapterIndices = []; this.onOpenBook(book);
  }
  private back(): void {
    if (!this.consumeBack()) {
      this.publishViewState();
      this.onBack();
    }
  }
  private consumeBack(): boolean {
    if (this.confirmation.length > 0) { this.confirmation = ''; return true; }
    if (this.sheet.length > 0) { this.sheet = ''; return true; }
    if (this.managing) { this.managing = false; this.selectedBookKeys = []; this.selectedChapterIndices = []; return true; }
    if (this.detailKey.length > 0) {
      this.detailKey = ''; this.selectedChapterIndices = [];
      this.restoreListOffset(); return true;
    }
    this.publishViewState();
    return false;
  }
  private toggleBook(key: string, selected: boolean): void {
    this.selectedBookKeys = selected ? this.selectedBookKeys.concat([key]).filter((value: string, index: number, all: string[]): boolean => all.indexOf(value) === index)
      : this.selectedBookKeys.filter((value: string): boolean => value !== key);
  }
  private toggleChapter(index: number, selected: boolean): void {
    this.selectedChapterIndices = selected ? this.mergeIndices(this.selectedChapterIndices, [index])
      : this.selectedChapterIndices.filter((value: number): boolean => value !== index);
  }
  private mergeIndices(left: number[], right: number[]): number[] {
    return left.concat(right).filter((value: number, index: number, all: number[]): boolean => all.indexOf(value) === index).sort((a: number, b: number): number => a - b);
  }
  private groupIndices(book: DownloadBookView, group: DownloadChapterView): number[] {
    const offset = book.chapters.findIndex((chapter: DownloadChapterView): boolean => chapter.key === group.key);
    const indices: number[] = [];
    for (let index = offset + 1; index < book.chapters.length; index += 1) {
      const chapter = book.chapters[index];
      if (!chapter.navigable && (chapter.level ?? 0) <= (group.level ?? 0)) break;
      if (chapter.navigable) indices.push(chapter.index);
    }
    return indices;
  }
  private currentChapter(): DownloadChapterView | undefined {
    const book = this.detail(); if (book === undefined) return undefined;
    return this.currentChapterForBook(book);
  }
  private currentChapterForBook(book: DownloadBookView): DownloadChapterView | undefined {
    const index = book.shelfBook.currentChapterIndex ?? book.shelfBook.readingPosition?.chapterIndex;
    return index === undefined ? undefined : book.chapters.find((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.index === index);
  }
  private locateCurrent(): void {
    const chapter = this.currentChapter(); const book = this.detail(); if (chapter === undefined || book === undefined) return;
    this.chapterScroller.scrollToIndex(2 + Number(this.mainChromeOverflow()) + book.chapters.findIndex((item: DownloadChapterView): boolean => item.key === chapter.key), true, ScrollAlign.CENTER);
  }
  private allSelected(): boolean {
    const book = this.detail();
    return book !== undefined ? this.selectedChapterIndices.length > 0 && this.selectedChapterIndices.length === book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).length
      : this.selectedBookKeys.length > 0 && this.selectedBookKeys.length === this.visibleBooks().length;
  }
  private toggleAll(): void {
    const book = this.detail();
    if (book !== undefined) this.selectedChapterIndices = this.allSelected() ? [] : book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).map((chapter: DownloadChapterView): number => chapter.index);
    else this.selectedBookKeys = this.allSelected() ? [] : this.visibleBooks().map((item: DownloadBookView): string => item.key);
  }
  private selectionLabel(): string {
    const book = this.detail();
    if (book !== undefined) return this.managing ? `已选 ${this.selectedChapterIndices.length}${this.unit(book)}` : this.downloadCount(book, false);
    return `已选 ${this.selectedBookKeys.length} 本书`;
  }
  private captureSelection(): void {
    const book = this.detail();
    this.actionBookKeys = book === undefined ? this.selectedBookKeys.slice() : [book.key];
    this.actionChapterIndices = book === undefined ? [] : this.selectedChapterIndices.slice();
  }
  private selectedIsRunning(): boolean {
    return this.actionBooks().some((book: DownloadBookView): boolean => this.actionChapterIndices.length === 0
      ? this.bookIsRunning(book) : book.chapters.some((chapter: DownloadChapterView): boolean => this.actionChapterIndices.includes(chapter.index) && this.chapterIsRunning(chapter)));
  }
  private actionAvailable(action: SharedDownloadUiAction): boolean {
    return this.actionBooks().some((book: DownloadBookView): boolean => {
      if (book.projectionStatus !== 'ready') return false;
      const chapters = this.actionChapterIndices.length > 0 ? book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable && this.actionChapterIndices.includes(chapter.index)) : book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable);
      if (action === 'download') return chapters.some((chapter: DownloadChapterView): boolean => !chapter.localComplete && chapter.queueState !== 'unknown');
      if (action === 'pause') return chapters.some((chapter: DownloadChapterView): boolean => this.chapterIsRunning(chapter));
      if (action === 'cancel') return chapters.some((chapter: DownloadChapterView): boolean => this.chapterIsRunning(chapter) || chapter.queueState === 'paused' || chapter.queueState === 'failed');
      return chapters.some((chapter: DownloadChapterView): boolean => chapter.localComplete || (chapter.cachedBytes ?? 0) > 0);
    });
  }
  private sheetTitle(): string {
    if (this.sheet === 'filter') return '筛选'; if (this.sheet === 'sort') return '排序';
    if (this.sheet === 'settings') return '存储管理'; if (this.sheet === 'range') return '下载范围';
    if (this.sheet === 'read') return '阅读入口';
    return this.sheet === 'chapter-actions' ? `章节操作 · 已选 ${this.actionChapterIndices.length}${this.unit(this.actionBooks()[0])}`
      : this.actionBooks().length === 1 ? `${this.actionBooks()[0].title} · 书籍操作` : `书籍操作 · 已选 ${this.actionBooks().length} 本`;
  }
  private showReadTarget(snapshot: DownloadBookView, chapterSnapshot?: DownloadChapterView,
    generation: number = this.presentationGeneration): void {
    const book = this.eventBook(this.bookGetter(snapshot), generation);
    if (book === undefined) return;
    const chapter = chapterSnapshot === undefined ? undefined : book.chapters.find((current: DownloadChapterView): boolean => current.key === chapterSnapshot.key);
    if (chapterSnapshot !== undefined && chapter === undefined) return;
    const target = describeDownloadReadingTarget(book, chapter);
    this.readingDescription = target.description;
    this.readingBookTitle = book.title;
    this.readingChapterTitle = target.chapterTitle ?? '';
    this.sheet = 'read'; this.onReadTarget(target);
  }
  private rangeEligible(): boolean {
    if (this.actionBooks().length === 0) return false;
    if (this.rangeChoice === 'all') return this.actionAvailable('download');
    const book = this.actionBooks().find((item: DownloadBookView): boolean => item.key === this.rangeBookKey);
    if (book === undefined) return false;
    if (this.rangeChoice === 'forward') return this.currentChapterForBook(book) !== undefined;
    const start = Number(this.rangeStart); const end = Number(this.rangeEnd);
    return this.rangeStart.length > 0 && this.rangeEnd.length > 0 && Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable).length;
  }
  private sendRange(): void {
    if (!this.presentationIsCurrent() || !this.rangeEligible()) return;
    const rangedBooks = this.rangeChoice === 'all' ? this.actionBooks() : this.actionBooks().filter((book: DownloadBookView): boolean => book.key === this.rangeBookKey);
    const targets: SharedDownloadUiBookTarget[] = rangedBooks.map((book: DownloadBookView): SharedDownloadUiBookTarget => {
      const chapters = book.chapters.filter((chapter: DownloadChapterView): boolean => chapter.navigable);
      if (this.rangeChoice === 'all') return { sourceId: book.sourceId, bookId: book.bookId };
      if (this.rangeChoice === 'forward') {
        const current = this.currentChapterForBook(book)?.index;
        return { sourceId: book.sourceId, bookId: book.bookId, chapterIndices: chapters.filter((chapter: DownloadChapterView): boolean => current !== undefined && chapter.index >= current).map((chapter: DownloadChapterView): number => chapter.index) };
      }
      return { sourceId: book.sourceId, bookId: book.bookId, chapterIndices: chapters.slice(Number(this.rangeStart) - 1, Number(this.rangeEnd)).map((chapter: DownloadChapterView): number => chapter.index) };
    });
    this.sheet = ''; this.onIntent({ action: 'download', scope: 'books', books: targets });
  }
  private sendAction(action: SharedDownloadUiAction): void {
    if (!this.presentationIsCurrent()) return;
    const storage = action === 'cleanup' || action === 'configureStorage';
    const targets = storage ? [] : this.actionBooks().map((book: DownloadBookView): SharedDownloadUiBookTarget => ({
      sourceId: book.sourceId, bookId: book.bookId,
      chapterIndices: this.actionChapterIndices.length > 0 ? this.actionChapterIndices.slice() : undefined,
    }));
    if (!storage && targets.length === 0) return;
    this.sheet = '';
    this.onIntent({ action, scope: storage ? 'storage' : this.actionChapterIndices.length > 0 ? 'chapters' : 'books',
      books: targets, cacheLimitMb: storage ? this.cacheLimitMb : undefined, cleanupAfterDays: storage ? this.cleanupAfterDays : undefined });
  }
  private quickSelectChapters(index: number): void {
    const book = this.detail(); if (book === undefined || index === 0) return;
    const current = this.currentChapter();
    if (index === 1) this.selectedChapterIndices = current === undefined ? [] : [current.index];
    else if (index === 2) this.selectedChapterIndices = current === undefined ? [] : book.chapters
      .filter((chapter: DownloadChapterView): boolean => chapter.navigable && chapter.index >= current.index)
      .map((chapter: DownloadChapterView): number => chapter.index);
    else if (index === 3) this.selectedChapterIndices = book.chapters
      .filter((chapter: DownloadChapterView): boolean => chapter.navigable).map((chapter: DownloadChapterView): number => chapter.index);
  }
  private limitIndex(): number { return [512, 1024, 2048, 4096].indexOf(this.cacheLimitMb); }
  private daysIndex(): number { return [3, 7, 14, 30].indexOf(this.cleanupAfterDays); }
  private publishViewState(): void {
    if (!this.mounted) return;
    if (this.detailKey.length === 0) this.captureListOffset();
    this.onViewStateChanged({ query: this.query, type: this.bookType as 'all' | 'novel' | 'manga',
      state: this.stateFilter as 'all' | 'downloading' | 'downloaded' | 'none', sourceId: this.sourceFilter,
      sort: this.sortField as 'recent' | 'title' | 'progress' | 'size', direction: this.sortDirection as 'asc' | 'desc',
      listScroll: this.listOffset, detailKey: this.detailKey });
  }
  private captureListOffset(): void {
    // @Watch runs synchronously before the main List is reattached when
    // returning from chapters. The platform may have no current offset then;
    // retain the last proven position instead of dereferencing an empty result.
    try {
      const offset = this.listScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset)) this.listOffset = offset.yOffset;
    } catch (_error) {
      // A retired/unbound native controller cannot replace a saved position.
    }
  }
  private restoreListOffset(): void {
    if (!this.mounted || !this.fontsReady) return;
    const identity = this.mountedIdentity;
    const generation = this.fontPreparationGeneration;
    this.getUIContext().postFrameCallback(new SharedDownloadIdleFrame((): void => {
      if (this.mounted && this.fontsReady && this.mountedIdentity === identity &&
        generation === this.fontPreparationGeneration && this.detailKey.length === 0)
        this.listScroller.scrollTo({ xOffset: 0, yOffset: this.listOffset });
    }));
  }
  private prepareFonts(): void {
    const identity = this.mountedIdentity;
    const generation = ++this.fontPreparationGeneration;
    this.fontsFailed = false;
    prepareSharedDownloadFonts().then((ready: boolean): void => {
      if (!this.mounted || this.mountedIdentity !== identity || generation !== this.fontPreparationGeneration) return;
      this.fontsReady = ready; this.fontsFailed = !ready;
      if (ready) this.restoreListOffset();
    }).catch((_error: Error): void => {
      if (this.mounted && this.mountedIdentity === identity && generation === this.fontPreparationGeneration) this.fontsFailed = true;
    });
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
    const style = quick ? TYPE_DOWNLOAD_QUICK_SELECT : TYPE_DOWNLOAD_BODY;
    let longestPx = 0;
    for (const text of [value, ...options]) {
      const measured = measure.measureText({ textContent: text, fontSize: style.fontSizeFp,
        fontFamily: style.fontFamily, fontWeight: style.fontWeight });
      if (Number.isFinite(measured) && measured > longestPx) longestPx = measured;
    }
    const labelStyle = quick ? TYPE_DOWNLOAD_BOOK_TITLE : TYPE_DOWNLOAD_BODY;
    const labelPx = measure.measureText({ textContent: rowLabel, fontSize: labelStyle.fontSizeFp,
      fontFamily: labelStyle.fontFamily, fontWeight: labelStyle.fontWeight });
    const metrics = this.currentMetrics();
    const side = quick ? this.contentLeftInset() + this.contentRightInset() : DOWNLOAD_VISUAL.sheetBodySide * 2;
    const gap = quick ? DOWNLOAD_VISUAL.chapterToolbarGap : DOWNLOAD_VISUAL.settingsGap;
    const available = Math.max(0, metrics.windowRect.width - side - gap - Math.max(0, context.px2vp(labelPx)));
    const desired = Math.ceil(context.px2vp(longestPx)) + (quick ? DOWNLOAD_VISUAL.chapterQuickArrowSlot : DOWNLOAD_VISUAL.selectArrowSlot) + DOWNLOAD_VISUAL.settingsSelectPadding * 2;
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
  private contentTop(): number {
    const gap = DOWNLOAD_VISUAL.contentTop - DOWNLOAD_VISUAL.headerTopGap - DOWNLOAD_VISUAL.headerHeight;
    return this.headerTop() + Math.max(DOWNLOAD_VISUAL.headerHeight, this.headerMeasuredHeight) + gap;
  }
  private contentBottom(minimum: number): number {
    return Math.max(minimum, this.dockMeasuredHeight + this.bottomInset() + DOWNLOAD_VISUAL.dockBottom);
  }
  private leftInset(): number { return Math.max(DOWNLOAD_VISUAL.headerSide, readerVisualSafeLeft(this.currentMetrics())); }
  private rightInset(): number { return Math.max(DOWNLOAD_VISUAL.headerSide, readerVisualSafeRight(this.currentMetrics())); }
  private contentLeftInset(): number {
    return sharedDownloadContentInsets(readerVisualSafeLeft(this.currentMetrics()), readerVisualSafeRight(this.currentMetrics())).left;
  }
  private contentRightInset(): number {
    return sharedDownloadContentInsets(readerVisualSafeLeft(this.currentMetrics()), readerVisualSafeRight(this.currentMetrics())).right;
  }
  private bottomInset(): number { return Math.max(DOWNLOAD_VISUAL.dockBottom, readerInteractiveSafeBottom(this.currentMetrics())); }
  private availableHeight(): number {
    const metrics = this.currentMetrics();
    // UIContext owns keyboard OFFSET/RESIZE. Measured page height already
    // reflects any platform resize; never subtract keyboardInsets a second time.
    return this.pageHeight > 0 ? this.pageHeight : Math.max(0, metrics.windowRect.height - readerVisualSafeTop(metrics));
  }
  private sheetMaxHeight(): number { return sharedDownloadSheetMaxHeight(this.availableHeight(), 0, 0); }
  private sheetHasFooter(): boolean { return ['filter', 'sort', 'read', 'range', 'settings'].includes(this.sheet); }
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
  private sheetBodyMaxHeight(): number { return Math.max(0, this.sheetMaxHeight() - this.sheetChromeHeight()); }
  private dialogChromeHeight(): number {
    const button = Math.max(this.dialogActionsMeasuredHeight,
      this.textControlHeight(DOWNLOAD_VISUAL.buttonHeight, DOWNLOAD_VISUAL.controlLineHeight, DOWNLOAD_VISUAL.buttonPaddingY * 2));
    return DOWNLOAD_VISUAL.dialogTop + DOWNLOAD_VISUAL.dialogBottom + button;
  }
  private dialogChromeOverflow(): boolean {
    return this.dialogChromeHeight() + DOWNLOAD_VISUAL.dialogOuterSide * 2 >= this.availableHeight();
  }
  private dialogOuterPaddingY(): number { return this.dialogChromeOverflow() ? 0 : DOWNLOAD_VISUAL.dialogOuterSide; }
  private dialogMaxHeight(): number { return Math.max(0, this.availableHeight() - this.dialogOuterPaddingY() * 2); }
  private dialogBodyMaxHeight(): number { return Math.max(0, this.dialogMaxHeight() - this.dialogChromeHeight()); }
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
  private recordDockHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.dockMeasuredHeight) > 0.5) this.dockMeasuredHeight = height;
  }
  private recordSheetTitleHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.sheetTitleMeasuredHeight) > 0.5) this.sheetTitleMeasuredHeight = height;
  }
  private recordSheetFooterHeight(height: number): void {
    if (Number.isFinite(height) && height > 0 && Math.abs(height - this.sheetFooterMeasuredHeight) > 0.5) this.sheetFooterMeasuredHeight = height;
  }
}
