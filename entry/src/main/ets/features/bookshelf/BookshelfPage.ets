import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from './ShelfBookPresentation';
import { BookshelfViewState } from './BookshelfViewState';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { FrameCallback } from '@kit.ArkUI';
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
import { MainTabShell } from '../shell/MainTabShell';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { AppTopBar } from '../common/AppTopBar';
import { registerReaderShelfFonts } from '../common/ReaderFonts';
import { BookshelfBookActionSheet } from './BookshelfBookActionSheet';
import { BookshelfMoreMenu } from './BookshelfMoreMenu';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerInteractiveSafeLeft,
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import { isReaderProductSurfaceEnabled } from '../../app/ReaderProductScope';
import { WebDavCredentialStore } from '../sync/WebDavCredentialStore';
import {
  BookshelfViewMotionContract,
  bookshelfViewCoverDelayMs,
  bookshelfViewMotionContract,
} from '../common/MotionSpec';

const PHONE_BOOK_WIDTH = 96.656;
const PHONE_BOOK_HEIGHT_RATIO = 145.443 / PHONE_BOOK_WIDTH;
const TABLET_BOOK_WIDTH = 186.672;
const TABLET_BOOK_HEIGHT_RATIO = 280 / TABLET_BOOK_WIDTH;
const PHONE_LIST_COVER_WIDTH = 48;
const PHONE_LIST_COVER_HEIGHT = 80;
const TABLET_LIST_COVER_WIDTH = 64;
const TABLET_LIST_COVER_HEIGHT = 104;
const BOOKSHELF_WIDE_BREAKPOINT = 600;
const TABLET_RAIL_WIDTH = 82;
const TABLET_RAIL_LEFT_GAP = 17;
const TABLET_RAIL_CONTENT_GAP = 20;
const TABLET_CONTENT_RIGHT_GAP = 21;

type BookshelfViewMode = 'cover' | 'list';

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
  viewState: BookshelfViewState = new BookshelfViewState();
  private readonly shelfScroller: Scroller = new Scroller();
  private viewportRestored: boolean = false;
  private viewportRestoreGeneration: number = 0;
  private firstVisibleItem: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  // The bookshelf page is rebuilt when leaving and returning from reading.
  // Keep the user's projection choice in app storage so route recreation does
  // not silently restore the cover projection.
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = 'cover';
  // Retire the removed group selector's transient filter without changing book groups.
  @StorageLink('readerBookshelfSelectedGroup') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfReadingFilter') @Watch('onShelfFiltersChanged') private readingFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('onShelfFiltersChanged') private sourceFilter: string = 'all';
  @Prop @Watch('onBooksChanged') books: ShelfBook[];
  @Prop serverFiltered: boolean = false;
  @Prop unfilteredOnlineBooks: boolean = false;
  onNextPageRequested: () => void = (): void => {};
  onPreviousPageRequested: () => void = (): void => {};
  onFilterRequested: (readingState: string, sourceKind: string) => void = (_readingState: string, _sourceKind: string): void => {};
  @Prop continueReading: ShelfBook | undefined;
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onManageRequested: () => void = (): void => {};
  onBatchManageRequested: () => void = (): void => {};
  // Keep bookshelf settings separate from Core group/read-record management.
  // The host owns the settings route; this page only emits the semantic action.
  onBookshelfSettingsRequested: () => void = (): void => {};
  onBookSelected: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onVisibleBooksChanged: (books: ShelfBook[]) => void = (_books: ShelfBook[]): void => {};
  onBookMultiSelectRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onBookGroupRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onBookInfoRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onBookRemoveRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  // SHF-03: the host runs the foreground update queue; the page only emits
  // the intent and mirrors the sweep progress the host pushes back down.
  onCheckUpdatesRequested: () => void = (): void => {};
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  @Prop updateProgressDone: number = 0;
  @Prop updateProgressTotal: number = 0;
  @State private viewportWidth: number = 0;
  @State private viewMode: BookshelfViewMode = 'cover';
  @State private viewSwitchRunning: boolean = false;
  @State private viewSwitchHeaderOpacity: number = 1;
  @State private viewSwitchGridContentOpacity: number = 1;
  @State private viewSwitchListContentOpacity: number = 0;
  @State private viewSwitchDestinationCoverOpacity: number = 1;
  @State private viewSwitchMorphCoverOpacity: number = 0;
  @State private filterRowVisible: boolean = false;
  @State private viewModeError: string = '';
  private mounted: boolean = false;
  private projectionQueued: boolean = false;
  private projectionGeneration: number = 0;
  private viewModeRevision: number = 0;
  private confirmedViewMode: BookshelfViewMode = 'cover';
  private requestedViewMode: BookshelfViewMode = 'cover';
  private viewModeReadFailed: boolean = false;
  @State private actionBook: ShelfBook | undefined = undefined;
  @State private moreMenuVisible: boolean = false;
  @State private moreAnchorRight: number = 0;
  @State private moreAnchorBottom: number = 0;
  @State private overlayOriginX: number = 0;
  @State private overlayOriginY: number = 0;
  @State private visibleBookCount: number = 0;
  @State private hasOnlineBooks: boolean = false;
  private readonly viewMotion: BookshelfViewMotionContract = bookshelfViewMotionContract();
  private pendingViewMode: BookshelfViewMode = 'cover';
  private viewSwitchToken: number = 0;
  @State private viewSwitchTimeMs: number = 0;
  private viewSwitchSourceMode: BookshelfViewMode = 'cover';
  private viewSwitchDestinationMode: BookshelfViewMode = 'list';
  private viewTimeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
  private readonly viewFadeCurve = curves.cubicBezierCurve(0, 0, .58, 1);
  private readonly viewContentCurve = curves.cubicBezierCurve(.4, 0, .2, 1);
  private readonly viewMoveCurve = curves.cubicBezierCurve(.2, 0, 0, 1);
  private readonly viewScaleCurve = curves.cubicBezierCurve(.25, .1, 0, 1);
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
    this.storedViewMode = restoredMode;
    this.storedSelectedGroup = '';
    this.filterRowVisible = this.viewState.filterExpanded;
    this.viewportRestored = false;
    this.setRestingProjectionOpacity(restoredMode);
    this.rebuildShelfProjection();
    // EntryAbility has already read this choice and recovery may have replaced
    // it. Reuse the store's acknowledged value; retries and a remount during
    // an in-flight write still use the existing serialized load path.
    if (confirmedMode === undefined) this.loadViewMode();
  }

  private retryViewMode(): void {
    if (this.viewModeReadFailed) this.loadViewMode();
    else this.setViewMode(this.requestedViewMode);
  }

  private loadViewMode(): void {
    const revision = ++this.viewModeRevision;
    this.viewModeError = '';
    this.viewModeReadFailed = false;
    void this.webDavCredentials.loadBookshelfViewMode().then((mode): void => {
      if (!this.mounted || revision !== this.viewModeRevision) return;
      this.confirmedViewMode = mode;
      this.requestedViewMode = mode;
      this.storedViewMode = mode;
      if (this.viewMode === mode && !this.viewSwitchRunning) return;
      this.resetViewSwitchMotion();
      this.viewMode = mode;
      this.setRestingProjectionOpacity(mode);
      this.rebuildShelfProjection();
    }).catch((): void => {
      if (!this.mounted || revision !== this.viewModeRevision) return;
      this.viewModeReadFailed = true;
      this.viewModeError = '显示方式读取失败，点击重试';
    });
  }

  aboutToDisappear(): void {
    this.projectionGeneration += 1;
    this.projectionQueued = false;
    this.saveShelfViewport();
    this.viewState.filterExpanded = this.filterRowVisible;
    this.viewportRestoreGeneration += 1;
    this.mounted = false;
    this.viewModeRevision += 1;
    this.resetViewSwitchMotion();
  }

  build() {
    MainTabShell({
      activeTab: 'bookshelf',
      showBottomNav: !this.isWideViewport(),
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      this.bookshelfTabContent();
    }
  }

  @Builder
  private bookshelfTabContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        this.topBar();
        Stack({ alignContent: Alignment.TopStart }) {
          if (this.isWideViewport()) {
            this.tabletContent();
            this.tabletNavigation();
          } else {
            this.phoneContent();
          }
        }
        .layoutWeight(1)
        .width('100%')
        .onAreaChange((_oldValue: Area, newValue: Area): void => {
          const width = this.numericAreaLength(newValue.width);
          if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
            this.viewportWidth = width;
          }
        });
      }
      .width('100%')
      .height('100%');

      if (this.moreMenuVisible) {
        BookshelfMoreMenu({
          anchorRight: this.moreAnchorRight - this.overlayOriginX,
          anchorBottom: this.moreAnchorBottom - this.overlayOriginY,
          reduceMotion: this.reduceMotion,
          canCheckUpdates: this.hasOnlineBooks,
          updateRunning: this.updateRunning,
          backgroundUpdateRunning: this.backgroundUpdateRunning,
          updateProgressDone: this.updateProgressDone,
          updateProgressTotal: this.updateProgressTotal,
          onCheckUpdates: (): void => this.requestCheckUpdates(),
          onBatchManage: (): void => {
            this.moreMenuVisible = false;
            this.onBatchManageRequested();
          },
          onLocalImport: (): void => {
            this.moreMenuVisible = false;
            this.onImportRequested();
          },
          onBookshelfSettings: (): void => {
            this.moreMenuVisible = false;
            this.onBookshelfSettingsRequested();
          },
          onDismiss: (): void => {
            this.moreMenuVisible = false;
          },
        });
      }
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.overlayOriginX = Number(newValue.globalPosition.x);
      this.overlayOriginY = Number(newValue.globalPosition.y);
    })
    .bindSheet(this.actionBook !== undefined, this.bookActionSheetContent, {
      height: 270,
      width: this.bookActionWidth(),
      preferType: SheetType.CENTER,
      dragBar: false,
      showClose: false,
      backgroundColor: readerAppColor('app.BookshelfPage.bookshelfTabContent.bindSheet.FFFFFCF8', this.appThemeScheme),
      radius: { topLeft: 24, topRight: 24, bottomLeft: 0, bottomRight: 0 },
      maskColor: readerAppColor('app.BookshelfPage.bookshelfTabContent.bindSheet.52000000', this.appThemeScheme),
      enableOutsideInteractive: false,
      onDisappear: (): void => {
        this.actionBook = undefined;
      },
    });
  }

  @Builder
  private bookActionSheetContent() {
    BookshelfBookActionSheet({
      onMultiSelect: (): void => this.performBookAction(this.onBookMultiSelectRequested),
      onBookInfo: (): void => this.performBookAction(this.onBookInfoRequested),
      onEditGroup: (): void => this.performBookAction(this.onBookGroupRequested),
      onRemoveFromBookshelf: (): void => this.performBookAction(this.onBookRemoveRequested),
    });
  }

  @Builder
  private topBar() {
    AppTopBar({ title: '书架', divider: true }) {
      Row({ space: 18 }) {
        ReaderIconButton({
          icon: (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_search_theme_night') : $r('app.media.bookshelf_search')),
          boxSize: 44,
          iconSize: 24,
          radius: 22,
          onTap: (): void => this.onSearchRequested(),
        });

        ReaderIconButton({
          icon: (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more')),
          boxSize: 44,
          iconSize: 44,
          radius: 22,
          onTap: (): void => {
            this.moreMenuVisible = true;
          },
        })
          .accessibilityText('更多')
          .onAreaChange((_oldValue: Area, newValue: Area): void => {
            this.moreAnchorRight = Number(newValue.globalPosition.x) + Number(newValue.width);
            this.moreAnchorBottom = Number(newValue.globalPosition.y) + Number(newValue.height);
          });
      }
    }
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

  @Builder
  private continueReadingCard(book: ShelfBook, isTablet: boolean) {
    Row({ space: TOK_SPACE_CARD_PADDING }) {
      if (this.hasCover(book)) {
        Image(book.coverUrl as string)
          .width(62)
          .height(93)
          .objectFit(ImageFit.Cover)
          .borderRadius(6);
      } else {
        NoCoverCover({
          coverWidth: 62,
          coverHeight: 93,
        });
      }

      Column({ space: 0 }) {
        Text('继续阅读')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(6);

        Text(book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(20)
          .lineHeight(24)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(5);

        Text(book.author)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .height(67.4)
      .alignItems(HorizontalAlign.Start);

      Stack({ alignContent: Alignment.Center }) {
        Text('阅读')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }
      .width(82)
      .height(40)
      .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
      .borderRadius(20);
    }
    .width(this.shelfContentWidth(isTablet))
    .height(100)
    .padding({ left: 16.554, right: 16.554 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(8)
    .onClick((): void => this.onBookSelected(book));
  }

  @Builder
  private bookshelfList(isTablet: boolean) {
    List({ space: TOK_SPACE_CONTROL_INLINE, scroller: this.shelfScroller }) {
      if (this.continueReading !== undefined) {
        ListItem() {
          this.continueReadingCard(this.continueReading, isTablet);
        }
      }
      ListItem() {
        Row() {
          Text('我的书架')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(15)
            .lineHeight(18)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .opacity(this.viewSwitchHeaderOpacity);

          Row({ space: TOK_SPACE_XS }) {
            this.sectionAction('bookshelf_grid', (): void => {
              this.setViewMode('cover');
            });
            this.sectionAction('bookshelf_list', (): void => {
              this.setViewMode('list');
            });
            this.sectionAction('bookshelf_filter', (): void => {
              this.filterRowVisible = !this.filterRowVisible;
            });
          }
          .height(34);
        }
        .width(this.shelfContentWidth(isTablet))
        .height(38)
        // The title follows the projection transition. Its persistent action
        // siblings must stay visible while their selected asset changes.
        .alignItems(VerticalAlign.Center);
      }

      if (this.filterRowVisible) {
        ListItem() {
          this.filterRow();
        }
      }

      if (this.viewModeError.length > 0) {
        ListItem() {
          Text(this.viewModeError).fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .onClick((): void => this.retryViewMode());
        }
      }

      if (this.visibleBookCount === 0) {
        ListItem() {
          Column({ space: 8 }) {
            Text('没有符合条件的书籍').fontSize(14).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
            Text('清除全部条件').fontSize(12).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .height(36).onClick((): void => this.clearFilters());
          }.width('100%').padding({ top: 16, bottom: 16 });
        }
      }

      // One stable row/card tree owns both projections. Replacing the list and
      // grid subtrees made ArkUI mount the target at its final geometry, so the
      // Figma shared-cover motion had no persistent actor to interpolate.
      LazyForEach(this.rowDataSource, (row: ShelfBook[], rowIndex: number) => {
        ListItem() {
          this.projectionRow(row, isTablet, rowIndex);
        }
      }, (row: ShelfBook[], rowIndex: number): string => this.bookRowRenderKey(row, rowIndex));
    }
    .width(this.shelfContentWidth(isTablet))
    .height('100%')
    .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD })
    .scrollBar(BarState.Off)
    .maintainVisibleContentPosition(true)
    .onScrollIndex((start: number): void => {
      if (!this.viewportRestored) return;
      this.firstVisibleItem = start;
      this.saveShelfViewport();
      this.publishVisibleReadingBooks();
      if (start <= this.shelfHeaderItems() + 4) this.onPreviousPageRequested();
      if (start + 8 >= this.shelfHeaderItems() + this.rowDataSource.totalCount()) this.onNextPageRequested();
    })
    .onReachStart((): void => this.onPreviousPageRequested())
    .onReachEnd((): void => this.onNextPageRequested())
    .onScroll((): void => this.saveShelfViewport())
    .onAppear((): void => this.restoreShelfViewport());
  }

  private shelfHeaderItems(): number {
    return 1 + (this.continueReading === undefined ? 0 : 1) +
      (this.filterRowVisible ? 1 : 0) +
      (this.viewModeError.length > 0 ? 1 : 0);
  }

  private saveShelfViewport(): void {
    if (!this.viewportRestored) return;
    try {
      this.viewState.anchorOffset = this.shelfScroller.currentOffset().yOffset;
      const rowIndex = this.firstVisibleItem - this.shelfHeaderItems();
      const row = rowIndex >= 0 && rowIndex < this.rowDataSource.totalCount() ?
        this.rowDataSource.getData(rowIndex) : undefined;
      this.viewState.anchorKey = row !== undefined && row.length > 0 ?
        JSON.stringify([row[0].sourceId, row[0].bookId]) : '';
      this.viewState.anchorItemY = this.shelfScroller.getItemRect(this.firstVisibleItem).y;
    } catch (_error) { /* Keep the last measured position after native detach. */ }
  }

  private restoreShelfViewport(): void {
    const generation = ++this.viewportRestoreGeneration;
    const key = this.viewState.anchorKey;
    const itemY = this.viewState.anchorItemY;
    const offset = this.viewState.anchorOffset;
    this.viewportRestored = false;
    this.getUIContext().postFrameCallback(new BookshelfMotionFrameCallback((): void => {
      if (!this.mounted || generation !== this.viewportRestoreGeneration) return;
      let anchor = -1;
      for (let index = 0; index < this.rowDataSource.totalCount(); index += 1) {
        if (this.rowDataSource.getData(index).some((book: ShelfBook): boolean =>
          JSON.stringify([book.sourceId, book.bookId]) === key)) { anchor = index; break; }
      }
      if (anchor < 0) {
        this.shelfScroller.scrollTo({ xOffset: 0, yOffset: Math.max(0, offset), animation: false });
        this.viewportRestored = true;
        this.publishVisibleReadingBooks();
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
      }));
    }));
  }

  /** PH60: view-only state/type conditions; grouping and updates have separate owners. */
  @Builder
  private filterRow() {
    Column({ space: 4 }) {
      Row() {
        Text('筛选').fontSize(12).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Text('清除').fontSize(12).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .height(28).enabled(this.hasActiveFilters()).opacity(this.hasActiveFilters() ? 1 : 0.5)
          .onClick((): void => this.clearFilters()).accessibilityText('清除阅读状态和类型筛选');
      }.width('100%');
      Text('阅读状态').width('100%').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('reading', 'all', '全部');
        this.filterChip('reading', 'unread', '未读');
        this.filterChip('reading', 'reading', '在读');
        this.filterChip('reading', 'finished', '已读');
      }.width('100%');
      Text('书籍类型').width('100%').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('source', 'all', '全部');
        this.filterChip('source', 'local', '本地');
        this.filterChip('source', 'online', '在线');
      }.width('100%');
    }.width('100%');
  }

  @Builder
  private filterChip(dimension: string, value: string, label: string) {
    Text(label)
      .fontFamily('ReaderInter').fontWeight(FontWeight.Medium).fontSize(12).lineHeight(18)
      .fontColor(this.isFilterSelected(dimension, value) ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_INK', this.appThemeScheme))
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .backgroundColor(this.isFilterSelected(dimension, value) ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: this.isFilterSelected(dimension, value) ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(999).margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).constraintSize({ maxWidth: 160 })
      .onClick((): void => this.selectFilter(dimension, value))
      .accessibilityText(`${dimension === 'reading' ? '阅读状态' : '书籍类型'}:${label}${this.isFilterSelected(dimension, value) ? '，已选' : ''}`);
  }

  private isFilterSelected(dimension: string, value: string): boolean {
    return (dimension === 'reading' ? this.readingFilter : this.sourceFilter) === value;
  }

  private hasActiveFilters(): boolean {
    return this.readingFilter !== 'all' || this.sourceFilter !== 'all';
  }

  private selectFilter(dimension: string, value: string): void {
    if (dimension === 'reading') this.readingFilter = value;
    else this.sourceFilter = value;
    this.queueShelfProjection();
  }

  private clearFilters(): void {
    this.readingFilter = 'all';
    this.sourceFilter = 'all';
    this.queueShelfProjection();
  }

  private onShelfFiltersChanged(): void {
    if (this.mounted && this.serverFiltered) this.onFilterRequested(this.readingFilter, this.sourceFilter);
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

  private requestCheckUpdates(): void {
    if (!this.hasOnlineBooks || this.updateRunning || this.backgroundUpdateRunning) return;
    this.moreMenuVisible = false;
    this.onCheckUpdatesRequested();
  }

  // @Builder value parameters are not observed: the active variant must be
  // read from view state inside the builder or the icon never swaps.
  private isSectionActionActive(assetName: string): boolean {
    if (assetName === 'bookshelf_grid') {
      return this.viewMode === 'cover';
    }
    if (assetName === 'bookshelf_list') {
      return this.viewMode === 'list';
    }
    if (assetName === 'bookshelf_filter') {
      return this.filterRowVisible || this.hasActiveFilters();
    }
    return false;
  }

  // Keep the canonical active asset referenced for provenance and future
  // state-layer parity; Figma's current active treatment uses the default
  // outline glyph with a surrounding state layer.
  private canonicalFilterActiveAsset(): Resource {
    return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_active'));
  }

  // A single unconditional Image per action: if/else nodes inside a
  // multi-instance @Builder get mis-diffed on state change and whole actions
  // vanish from the tree. Only the src attribute swaps.
  private sectionActionAsset(assetName: string): Resource {
    if (assetName === 'bookshelf_grid') {
      return this.viewMode === 'cover'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_theme_night') : $r('app.media.bookshelf_grid')) : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_grid_outline_theme_night') : $r('app.media.bookshelf_grid_outline'));
    }
    if (assetName === 'bookshelf_list') {
      return this.viewMode === 'list'
        ? (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_active_theme_night') : $r('app.media.bookshelf_list_active')) : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_list_theme_night') : $r('app.media.bookshelf_list'));
    }
    if (assetName === 'bookshelf_filter') {
      return (this.filterRowVisible || this.hasActiveFilters())
        ? this.canonicalFilterActiveAsset()
        : (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter'));
    }
    return (this.appThemeScheme === 'night' ? $r('app.media.bookshelf_filter_theme_night') : $r('app.media.bookshelf_filter'));
  }

  @Builder
  private sectionAction(assetName: string, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      // State color lives in the asset variant (provenance palette):
      // Image.fillColor refills outline paths even with fill="none".
      Image(this.sectionActionAsset(assetName)).width(20).height(20);
    }
    .width(34)
    .height(34)
    .borderRadius(17)
    .backgroundColor(this.isSectionActionActive(assetName) ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : Color.Transparent)
    .border({ width: this.isSectionActionActive(assetName) ? 1 : 0, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    // Figma `Library/SectionAction` (`487:40`) keeps a 34×34 visual actor
    // but expands its transparent hit target by 5vp on every side.
    .responseRegion({ x: -5, y: -5, width: 44, height: 44 })
    .accessibilityText(this.sectionActionLabel(assetName, this.isSectionActionActive(assetName)))
    .onClick(action);
  }

  @Builder
  private projectionRow(row: ShelfBook[], isTablet: boolean, rowIndex: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      ForEach(row, (book: ShelfBook, columnIndex: number) => {
        this.projectionBookCard(book, isTablet, (rowIndex * 3) + columnIndex, columnIndex);
      }, (book: ShelfBook): string => `${book.sourceId}:${book.bookId}`);
    }
    .width(this.shelfContentWidth(isTablet))
    .height(this.projectionRowHeight(row, isTablet, rowIndex * 3));
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
    isTablet: boolean,
    index: number,
    columnIndex: number,
  ) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCover(book, isTablet, index);
      this.projectionGridDetails(book, isTablet);
      this.projectionListDetails(book, isTablet);
    }
    .width(this.projectionBookWidth(isTablet, index))
    .height(this.projectionBookHeight(book, isTablet, index))
    .translate({
      x: this.projectionBookTranslateX(columnIndex, isTablet, index),
      y: this.projectionBookTranslateY(columnIndex, isTablet, index),
    })
    .onClick((): void => this.onBookSelected(book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction((_event: GestureEvent): void => this.presentBookActionSheet(book)),
    );
  }

  @Builder
  private projectionBookCover(book: ShelfBook, isTablet: boolean, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCoverLayer(book, isTablet, false, index);
      this.projectionBookCoverLayer(book, isTablet, true, index);
    }
    .width(this.shelfBookCardWidth(isTablet))
    .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
    .borderRadius(this.projectionCoverRadius(isTablet, index))
    .clip(true)
    .scale({
      x: this.projectionCoverScale(isTablet, index),
      y: this.projectionCoverScale(isTablet, index),
      centerX: '50%',
      centerY: '50%',
    })
    .translate({
      x: this.projectionCoverCompensationX(isTablet, index),
      y: this.projectionCoverCompensationY(isTablet, index),
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
  private projectionBookCoverLayer(book: ShelfBook, isTablet: boolean, morphLayer: boolean, index: number) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.hasCover(book)) {
        Image(book.coverUrl as string)
          .width(this.shelfBookCardWidth(isTablet))
          .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
          .objectFit(ImageFit.Cover)
          .borderRadius(this.projectionCoverRadius(isTablet, index))
          .shadow({ radius: 26, color: readerAppColor('app.BookshelfPage.projectionBookCoverLayer.color.1A594632', this.appThemeScheme), offsetX: 0, offsetY: 8 });
      } else {
        NoCoverCover({
          coverWidth: this.shelfBookCardWidth(isTablet),
          coverHeight: this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet),
        });
      }
      if ((book.unreadCount ?? 0) > 0) {
        Text(`更新 ${book.unreadCount} 章`)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(999)
          .align(Alignment.TopEnd)
          .margin({ top: 7, right: 7 })
          .opacity(this.viewSwitchGridContentOpacity);
      }
    }
    .width(this.shelfBookCardWidth(isTablet))
    .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
    .linearGradient({
      angle: 141.7,
      colors: [[readerAppColor('TOK_PRIMARY_GRADIENT_START', this.appThemeScheme), 0.077], [readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme), 0.923]],
    })
    .borderRadius(this.projectionCoverRadius(isTablet, index))
    .clip(true)
    // Alpha belongs to the complete cover, including the fallback's paper,
    // rules and text. Otherwise the fading paper can cover the lower text
    // before its own fading glyphs draw. Keep this group stable at rest too.
    .renderGroup(true)
    .opacity(this.projectionCoverLayerOpacity(morphLayer))
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private projectionGridDetails(book: ShelfBook, isTablet: boolean) {
    Column({ space: 6 }) {
      Text(book.title)
        .width(this.shelfBookCardWidth(isTablet))
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18.3)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(book.author)
        .width(this.shelfBookCardWidth(isTablet))
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(15)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if ((book.readProgress ?? 0) > 0) {
        Text(this.gridProgressLabel(book))
          .width(this.shelfBookCardWidth(isTablet))
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .maxLines(1);
      }
    }
    .width(this.shelfBookCardWidth(isTablet))
    .alignItems(HorizontalAlign.Start)
    .translate({ y: this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet) + 6 })
    .opacity(this.viewSwitchGridContentOpacity)
    .hitTestBehavior(this.viewMode === 'cover' ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private projectionListDetails(book: ShelfBook, isTablet: boolean) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      ShelfBookListDetails({ book })
        .layoutWeight(1).constraintSize({ minWidth: 0 });

      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'))).width(44).height(44);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .accessibilityText(`${book.title}更多操作`)
      .onClick((): void => this.presentBookActionSheet(book));
    }
    .width(this.projectionListDetailsWidth(isTablet))
    .height(this.listCoverHeight(isTablet))
    .alignItems(VerticalAlign.Center)
    .translate({ x: this.listCoverWidth(isTablet) + TOK_SPACE_CONTROL_INLINE })
    .opacity(this.viewSwitchListContentOpacity)
    .hitTestBehavior(this.viewMode === 'list' ? HitTestMode.Default : HitTestMode.None);
  }



  private presentBookActionSheet(book: ShelfBook): void {
    this.actionBook = book;
  }

  private performBookAction(action: (book: ShelfBook) => void): void {
    const book = this.actionBook;
    if (book === undefined) {
      return;
    }
    this.actionBook = undefined;
    action(book);
  }

  private bookActionWidth(): number {
    // Same live horizontal frame as the outside edges of the shelf covers.
    return this.shelfContentWidth(this.isWideViewport());
  }

  private phoneContentWidth(): number {
    return this.phoneContentFrame().width;
  }

  private shelfContentWidth(isTablet: boolean): number {
    if (!isTablet) {
      return this.phoneContentWidth();
    }
    return this.tabletContentFrame().width;
  }

  private phoneContentFrame(): SurfaceHorizontalFrame {
    return this.resolveContentFrame(
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_PHONE, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
  }

  private tabletContentFrame(): SurfaceHorizontalFrame {
    return this.resolveContentFrame(
      new SurfaceWidthSpec(
        TOK_CONTENT_RAIL_W_TABLET,
        this.tabletContentLeftGap(),
        TABLET_CONTENT_RIGHT_GAP,
        'center',
      ),
    );
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
    const metricsWidth = ReaderWindowCoordinator.metrics().windowRect.width;
    return this.viewportWidth > 0 ? this.viewportWidth : metricsWidth;
  }

  private isWideViewport(): boolean {
    return this.effectiveViewportWidth() >= BOOKSHELF_WIDE_BREAKPOINT;
  }

  private tabletRailLeft(): number {
    return Math.max(
      TABLET_RAIL_LEFT_GAP,
      readerInteractiveSafeLeft(ReaderWindowCoordinator.metrics()),
    );
  }

  private tabletContentLeftGap(): number {
    return this.tabletRailLeft() + TABLET_RAIL_WIDTH + TABLET_RAIL_CONTENT_GAP;
  }

  private sectionActionLabel(assetName: string, active: boolean): string {
    if (assetName === 'bookshelf_grid') {
      return active ? '封面模式，当前已选' : '切换到封面模式';
    }
    if (assetName === 'bookshelf_list') {
      return active ? '列表模式，当前已选' : '切换到列表模式';
    }
    if (assetName === 'bookshelf_filter') {
      return this.hasActiveFilters() ? '筛选书架，已有筛选条件' : this.filterRowVisible ? '筛选书架，已展开' : '筛选书架';
    }
    return '';
  }

  private listCoverWidth(isTablet: boolean): number {
    return isTablet ? TABLET_LIST_COVER_WIDTH : PHONE_LIST_COVER_WIDTH;
  }

  private listCoverHeight(isTablet: boolean): number {
    return isTablet ? TABLET_LIST_COVER_HEIGHT : PHONE_LIST_COVER_HEIGHT;
  }





  /**
   * readProgress arrives in basis points (0..10000, Core remote.rs). A book
   * read past its first pages of a long title lands under 1% and a plain
   * floor() presented it as "已读 0%"; keep the sub-1% state visible instead.
   */
  private gridProgressLabel(book: ShelfBook): string {
    return this.shelfProgressText(book.readProgress ?? 0);
  }



  private shelfProgressText(readProgressBasisPoints: number): string {
    const percent = readProgressBasisPoints / 100;
    if (readProgressBasisPoints > 0 && percent < 1) {
      return '已读 <1%';
    }
    return `已读 ${Math.floor(percent)}%`;
  }

  private shelfBookCardWidth(isTablet: boolean): number {
    return this.bookCardWidth(this.shelfContentWidth(isTablet), isTablet);
  }

  private bookCardWidth(contentWidth: number, isTablet: boolean): number {
    if (isTablet) {
      return Math.min(TABLET_BOOK_WIDTH, Math.max(0, (contentWidth - (TOK_SPACE_XS * 2)) / 3));
    }
    return Math.min(PHONE_BOOK_WIDTH, Math.max(0, (contentWidth - (TOK_SPACE_XS * 2)) / 3));
  }

  private bookCardHeight(cardWidth: number, isTablet: boolean): number {
    return cardWidth * (isTablet ? TABLET_BOOK_HEIGHT_RATIO : PHONE_BOOK_HEIGHT_RATIO);
  }

  private bookRowSpace(contentWidth: number, isTablet: boolean): number {
    if (isTablet) {
      return Math.min(30,
        Math.max(0, (contentWidth - (this.bookCardWidth(contentWidth, true) * 3)) / 2));
    }
    return Math.min(30,
      Math.max(TOK_SPACE_XS, (contentWidth - (this.bookCardWidth(contentWidth, false) * 3)) / 2));
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

  private onMainTab(key: string): void {
    if (key === 'discover') {
      this.onDiscoverRequested();
    } else if (key === 'rss') {
      this.onRssRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'bookshelf' is this page; MainTabBar suppresses the current tab.
  }

  @Builder
  private tabletNavigation() {
    Stack({ alignContent: Alignment.Start }) {
      Column({ space: 6 }) {
        this.tabletNavigationItem('bookshelf_library', '书架', 'bookshelf', true);
        if (isReaderProductSurfaceEnabled('discover')) {
          this.tabletNavigationItem('bookshelf_compass', '发现', 'discover', false);
        }
        if (isReaderProductSurfaceEnabled('rss')) {
          this.tabletNavigationItem('bookshelf_rss', 'RSS', 'rss', false);
        }
        this.tabletNavigationItem('bookshelf_settings', '设置', 'settings', false);
      }
      .width(82)
      .height(332)
      .padding(TOK_SPACE_XS)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(24);
    }
    .width(this.tabletRailLeft() + TABLET_RAIL_WIDTH)
    .height('100%')
    .padding({ left: this.tabletRailLeft() })
    // Same placement rule as the Phone rail: do not turn its transparent
    // full-height region into a hit-test shield over shelf content.
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private tabletNavigationItem(assetName: string, label: string, navKey: string, active: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        if (assetName === 'bookshelf_library') {
          Image($r('app.media.bookshelf_library')).width(24).height(24);
        } else if (assetName === 'bookshelf_compass') {
          Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_compass_theme_night') : $r('app.media.bookshelf_compass'))).width(24).height(24);
        } else if (assetName === 'bookshelf_rss') {
          Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_rss_theme_night') : $r('app.media.bookshelf_rss'))).width(24).height(24);
        } else {
          Image((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_settings_theme_night') : $r('app.media.bookshelf_settings'))).width(24).height(24);
        }
      }
      .width(32)
      .height(32);

      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(active ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width(66)
    .height(58)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (!active) {
        this.onMainTab(navKey);
      }
    });
  }

  private onBooksChanged(): void {
    this.queueShelfProjection();
  }

  private rebuildShelfProjection(): void {
    const visible = this.serverFiltered ? this.books : ShelfBookPresentation.visible(this.books, '', this.readingFilter, this.sourceFilter);
    this.visibleBookCount = visible.length;
    this.hasOnlineBooks = this.serverFiltered ? this.unfilteredOnlineBooks : this.books.some((book: ShelfBook): boolean => book.sourceId !== 'local');
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
    else this.publishVisibleReadingBooks();
  }

  /** The displayed rows own preparation; scrolling replaces this fixed window. */
  private publishVisibleReadingBooks(): void {
    if (!this.mounted || !this.viewportRestored) return;
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
    this.onVisibleBooksChanged(books);
  }

  private bookRowRenderKey(row: ShelfBook[], rowIndex: number): string {
    // Row position is not identity. Reordering or trimming a page must not
    // replace all following native covers. Mutable display fields still
    // invalidate the affected row; tuple encoding avoids delimiter collisions.
    return JSON.stringify(row.map((book: ShelfBook): Array<string | number> => [
      book.sourceId, book.bookId, book.title, book.author,
      book.sourceName ?? '', book.coverUrl ?? '', book.currentChapterTitle ?? '', book.lastChapter ?? '',
      book.unreadCount ?? 0, book.readProgress ?? 0,
    ]));
  }

  private async persistRequestedViewMode(mode: BookshelfViewMode, revision: number): Promise<boolean> {
    await ReaderThemeHost.prepareUserChange();
    if (!this.mounted || revision !== this.viewModeRevision) return false;
    // Recovery may have replaced the durable baseline while this intent waited.
    this.confirmedViewMode = await this.webDavCredentials.loadBookshelfViewMode();
    if (!this.mounted || revision !== this.viewModeRevision) return false;
    await this.webDavCredentials.saveBookshelfViewMode(mode);
    return true;
  }

  private setViewMode(mode: BookshelfViewMode): void {
    const revision = ++this.viewModeRevision;
    this.requestedViewMode = mode;
    this.viewModeReadFailed = false;
    this.storedViewMode = mode;
    this.viewModeError = '';
    void this.persistRequestedViewMode(mode, revision).then((committed: boolean): void => {
      // The store serializes writes. Every durable acknowledgement advances
      // the rollback baseline, even if a newer UI intent is still pending.
      if (committed) this.confirmedViewMode = mode;
    }).catch((error: Error): void => {
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
    if (!this.reduceMotion || !this.viewSwitchRunning) return;
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
    const content = (p: number): number => this.viewContentCurve.interpolate(p);
    const fade = (p: number): number => this.viewFadeCurve.interpolate(p);
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
      (p: number): number => scale ? this.viewScaleCurve.interpolate(p) : this.viewMoveCurve.interpolate(p));
    return this.viewSwitchDestinationMode === 'list' ? progress : 1 - progress;
  }

  private projectionRowHeight(row: ShelfBook[], isTablet: boolean, index: number): number {
    let grid = 0;
    for (const book of row) grid = Math.max(grid, this.gridBookCardHeight(book, isTablet));
    const list = row.length * this.listCoverHeight(isTablet) +
      Math.max(0, row.length - 1) * TOK_SPACE_CONTROL_INLINE;
    return grid + (list - grid) * this.projectionListProgress(index);
  }

  private projectionBookWidth(isTablet: boolean, index: number): number {
    const grid = this.shelfBookCardWidth(isTablet);
    return grid + (this.shelfContentWidth(isTablet) - grid) * this.projectionListProgress(index);
  }

  private projectionBookHeight(book: ShelfBook, isTablet: boolean, index: number): number {
    const grid = this.gridBookCardHeight(book, isTablet);
    return grid + (this.listCoverHeight(isTablet) - grid) * this.projectionListProgress(index);
  }

  private projectionBookTranslateX(columnIndex: number, isTablet: boolean, index: number): number {
    return columnIndex * (this.shelfBookCardWidth(isTablet) +
      this.bookRowSpace(this.shelfContentWidth(isTablet), isTablet)) * (1 - this.projectionListProgress(index));
  }

  private projectionBookTranslateY(columnIndex: number, isTablet: boolean, index: number): number {
    return columnIndex * (this.listCoverHeight(isTablet) + TOK_SPACE_CONTROL_INLINE) * this.projectionListProgress(index);
  }

  private projectionCoverScale(isTablet: boolean, index: number): number {
    const list = isTablet ? this.listCoverWidth(isTablet) / this.shelfBookCardWidth(isTablet) : .495;
    return 1 + (list - 1) * this.projectionListProgress(index, true);
  }

  private projectionCoverRadius(isTablet: boolean, index: number): number {
    const list = 6 / (this.listCoverWidth(isTablet) / this.shelfBookCardWidth(isTablet));
    return 8 + (list - 8) * this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationX(isTablet: boolean, index: number): number {
    return -(this.shelfBookCardWidth(isTablet) - this.listCoverWidth(isTablet)) / 2 *
      this.projectionListProgress(index, true);
  }

  private projectionCoverCompensationY(isTablet: boolean, index: number): number {
    return -(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet) -
      this.listCoverHeight(isTablet)) / 2 * this.projectionListProgress(index, true);
  }

  private projectionListDetailsWidth(isTablet: boolean): number {
    return Math.max(
      0,
      this.shelfContentWidth(isTablet) -
        this.listCoverWidth(isTablet) - TOK_SPACE_CONTROL_INLINE,
    );
  }

  private projectionCoverLayerOpacity(morphLayer: boolean): number {
    return morphLayer
      ? this.viewSwitchMorphCoverOpacity
      : this.viewSwitchDestinationCoverOpacity;
  }

  private gridBookCardHeight(book: ShelfBook, isTablet: boolean): number {
    const coverHeight = this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet);
    const titleAndAuthor = 6 + 18.3 + 6 + 15;
    const progress = (book.readProgress ?? 0) > 0 ? 6 + 12 : 0;
    return coverHeight + titleAndAuthor + progress;
  }

  private hasCover(book: ShelfBook): boolean {
    if (book.coverUrl === undefined) {
      return false;
    }
    return /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }
}
