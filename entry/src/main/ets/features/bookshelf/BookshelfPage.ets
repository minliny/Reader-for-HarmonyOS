import type { ShelfBook } from '../../app/ReaderCoreGateway';
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
import { registerReaderFonts } from '../common/ReaderFonts';
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
import {
  BookshelfViewMotionContract,
  bookshelfViewCoverMoveAnimation,
  bookshelfViewCoverScaleAnimation,
  bookshelfViewMotionContract,
} from '../common/MotionSpec';

const PHONE_BOOK_WIDTH = 96.656;
const PHONE_BOOK_HEIGHT_RATIO = 145.443 / PHONE_BOOK_WIDTH;
const TABLET_BOOK_WIDTH = 186.672;
const TABLET_BOOK_HEIGHT_RATIO = 280 / TABLET_BOOK_WIDTH;
const PHONE_LIST_COVER_WIDTH = 48;
const PHONE_LIST_COVER_HEIGHT = 72;
const TABLET_LIST_COVER_WIDTH = 64;
const TABLET_LIST_COVER_HEIGHT = 96;
const BOOKSHELF_WIDE_BREAKPOINT = 600;
const TABLET_RAIL_WIDTH = 82;
const TABLET_RAIL_LEFT_GAP = 17;
const TABLET_RAIL_CONTENT_GAP = 20;
const TABLET_CONTENT_RIGHT_GAP = 21;

type BookshelfViewMode = 'cover' | 'list';

class BookshelfRowDataSource implements IDataSource {
  private items: ShelfBook[][] = [];
  private listeners: DataChangeListener[] = [];

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
    this.items = items;
    for (const listener of this.listeners) listener.onDataReloaded();
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
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBooksChanged') books: ShelfBook[];
  @Prop continueReading: ShelfBook | undefined;
  @Prop reduceMotion: boolean = false;
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
  onBookMultiSelectRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onBookInfoRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  onBookRemoveRequested: (book: ShelfBook) => void = (_book: ShelfBook): void => {};
  // SHF-03: the host runs the foreground update queue; the page only emits
  // the intent and mirrors the sweep progress the host pushes back down.
  onCheckUpdatesRequested: () => void = (): void => {};
  @Prop updateRunning: boolean = false;
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
  @State private selectedGroup: string = '';
  @State private actionBook: ShelfBook | undefined = undefined;
  @State private moreMenuVisible: boolean = false;
  @State private moreAnchorRight: number = 0;
  @State private moreAnchorBottom: number = 0;
  @State private overlayOriginX: number = 0;
  @State private overlayOriginY: number = 0;
  @State private projectedGroups: string[] = [];
  private readonly viewMotion: BookshelfViewMotionContract = bookshelfViewMotionContract();
  private pendingViewMode: BookshelfViewMode = 'cover';
  private viewSwitchToken: number = 0;
  private viewSwitchCommitTimer: number = -1;
  private readonly rowDataSource: BookshelfRowDataSource = new BookshelfRowDataSource();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildShelfProjection();
  }

  aboutToDisappear(): void {
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
          onBatchManage: (): void => {
            this.moreMenuVisible = false;
            this.onBatchManageRequested();
          },
          onManageGroups: (): void => {
            this.moreMenuVisible = false;
            this.onManageRequested();
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
      height: 224,
      width: '100%',
      preferType: SheetType.BOTTOM,
      dragBar: false,
      showClose: false,
      backgroundColor: Color.Transparent,
      maskColor: Color.Transparent,
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
      onRemoveFromBookshelf: (): void => this.performBookAction(this.onBookRemoveRequested),
    });
  }

  @Builder
  private topBar() {
    AppTopBar({ title: '书架' }) {
      Row({ space: 18 }) {
        ReaderIconButton({
          icon: $r('app.media.bookshelf_search'),
          boxSize: 44,
          iconSize: 24,
          radius: 22,
          onTap: (): void => this.onSearchRequested(),
        });

        ReaderIconButton({
          icon: $r('app.media.bookshelf_more'),
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
          .fontColor(TOK_GREEN)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(6);

        Text(book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(20)
          .lineHeight(24)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(5);

        Text(book.author)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(TOK_MUTED)
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
          .fontColor(TOK_ON_PRIMARY);
      }
      .width(82)
      .height(40)
      .backgroundColor(TOK_GREEN)
      .borderRadius(20);
    }
    .width(this.shelfContentWidth(isTablet))
    .height(100)
    .padding({ left: 16.554, right: 16.554 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .onClick((): void => this.onBookSelected(book));
  }

  @Builder
  private bookshelfList(isTablet: boolean) {
    List({ space: TOK_SPACE_CONTROL_INLINE }) {
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
            .fontColor(TOK_INK);

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
            this.sectionAction('bookshelf_settings', (): void => this.onManageRequested());
          }
          .height(34);
        }
        .width(this.shelfContentWidth(isTablet))
        .height(38)
        .alignItems(VerticalAlign.Center)
        .opacity(this.viewSwitchHeaderOpacity);
      }

      if (this.filterRowVisible) {
        ListItem() {
          this.filterRow();
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
    .scrollBar(BarState.Off);
  }

  /**
   * SHF-02/03 shelf tools row, raised by the previously dead filter action:
   * group filter chips plus the shelf-wide manual update entry. The row is an
   * approved product extension (no Figma frame). The resting surface follows
   * the current four-action product decision: Cover/List/Filter/Management;
   * search remains solely in the AppTopBar.
   */
  @Builder
  private filterRow() {
    Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
      this.filterChip('全部', this.selectedGroup === '', (): void => {
        this.selectedGroup = '';
        this.rebuildShelfProjection();
      });
      ForEach(this.projectedGroups, (group: string) => {
        this.filterChip(group, this.selectedGroup === group, (): void => {
          this.selectedGroup = this.selectedGroup === group ? '' : group;
          this.rebuildShelfProjection();
        });
      }, (group: string): string => `shelf-group-${group}`);
      this.checkUpdatesChip();
    }
    .width('100%');
  }

  @Builder
  private filterChip(label: string, selected: boolean, onToggle: () => void) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Medium)
      .fontSize(12)
      .lineHeight(18)
      .fontColor(selected ? TOK_GREEN : TOK_INK)
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .backgroundColor(selected ? TOK_PRIMARY_SOFT : TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: selected ? TOK_GREEN : TOK_BORDER })
      .borderRadius(999)
      .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .constraintSize({ maxWidth: 160 })
      .onClick((): void => onToggle())
      .accessibilityText(selected ? `当前筛选:${label}` : `筛选:${label}`);
  }

  @Builder
  private checkUpdatesChip() {
    Text(this.updateActionLabel())
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .lineHeight(18)
      .fontColor(this.updateRunning ? TOK_MUTED : TOK_GREEN)
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: this.updateRunning ? TOK_BORDER : TOK_GREEN })
      .borderRadius(999)
      .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .maxLines(1)
      .onClick((): void => {
        if (!this.updateRunning) {
          this.onCheckUpdatesRequested();
        }
      })
      .accessibilityText(this.updateRunning ? '正在检查更新' : '检查书架更新');
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
      return this.filterRowVisible;
    }
    return false;
  }

  // A single unconditional Image per action: if/else nodes inside a
  // multi-instance @Builder get mis-diffed on state change and whole actions
  // vanish from the tree. Only the src attribute swaps.
  private sectionActionAsset(assetName: string): Resource {
    if (assetName === 'bookshelf_grid') {
      return this.viewMode === 'cover'
        ? $r('app.media.bookshelf_grid') : $r('app.media.bookshelf_grid_outline');
    }
    if (assetName === 'bookshelf_list') {
      return this.viewMode === 'list'
        ? $r('app.media.bookshelf_list_active') : $r('app.media.bookshelf_list');
    }
    if (assetName === 'bookshelf_filter') {
      return this.filterRowVisible
        ? $r('app.media.bookshelf_filter_active') : $r('app.media.bookshelf_filter');
    }
    return $r('app.media.bookshelf_settings');
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
    .height(this.projectionRowHeight(row, isTablet))
    .animation(bookshelfViewCoverMoveAnimation(rowIndex * 3));
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
    .width(this.projectionBookWidth(isTablet))
    .height(this.projectionBookHeight(book, isTablet))
    .translate({
      x: this.projectionBookTranslateX(columnIndex, isTablet),
      y: this.projectionBookTranslateY(columnIndex, isTablet),
    })
    .animation(bookshelfViewCoverMoveAnimation(index))
    .onClick((): void => this.onBookSelected(book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction((_event: GestureEvent): void => this.presentBookActionSheet(book)),
    );
  }

  @Builder
  private projectionBookCover(book: ShelfBook, isTablet: boolean, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.projectionBookCoverLayer(book, isTablet, false);
      this.projectionBookCoverLayer(book, isTablet, true);
    }
    .width(this.shelfBookCardWidth(isTablet))
    .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
    .borderRadius(this.projectionCoverRadius(isTablet))
    .clip(true)
    .scale({
      x: this.projectionCoverScale(isTablet),
      y: this.projectionCoverScale(isTablet),
      centerX: '50%',
      centerY: '50%',
    })
    .translate({
      x: this.projectionCoverCompensationX(isTablet),
      y: this.projectionCoverCompensationY(isTablet),
    })
    .animation(bookshelfViewCoverScaleAnimation(index))
    .zIndex(4)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  /**
   * Figma renders a shared morph cover above a separately fading destination
   * collection. Keeping both actors avoids the old jump where one cover had to
   * be both the moving layer and the final static layer at the same instant.
   */
  @Builder
  private projectionBookCoverLayer(book: ShelfBook, isTablet: boolean, morphLayer: boolean) {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.hasCover(book)) {
        Image(book.coverUrl as string)
          .width(this.shelfBookCardWidth(isTablet))
          .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
          .objectFit(ImageFit.Cover)
          .borderRadius(this.projectionCoverRadius(isTablet))
          .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 });
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
          .fontColor(TOK_ON_PRIMARY)
          .padding({ left: 7, right: 7, top: 3, bottom: 3 })
          .backgroundColor(TOK_GREEN)
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
      colors: [[TOK_PRIMARY_GRADIENT_START, 0.077], [TOK_PRIMARY_DARK, 0.923]],
    })
    .borderRadius(this.projectionCoverRadius(isTablet))
    .clip(true)
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
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Text(book.author)
        .width(this.shelfBookCardWidth(isTablet))
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(15)
        .fontColor(TOK_MUTED)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if ((book.readProgress ?? 0) > 0) {
        Text(this.gridProgressLabel(book))
          .width(this.shelfBookCardWidth(isTablet))
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_GREEN)
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
      Column({ space: 3 }) {
        Text(book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18.3)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Row({ space: 4 }) {
          Text(book.author)
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(15)
            .fontColor(TOK_MUTED)
            .maxLines(1);
          Text('·')
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(13.75)
            .fontColor(TOK_MUTED);
          Text(this.listChapter(book))
            .layoutWeight(1)
            .constraintSize({ minWidth: 0 })
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(13.75)
            .fontColor(TOK_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .width('100%')
        .height(15)
        .alignItems(VerticalAlign.Center);
        Row({ space: 6 }) {
          this.listStatusPill(this.listSourceLabel(book), false);
          this.listStatusPill(this.listProgressLabel(book), true);
        }
        .height(18);
      }
      .layoutWeight(1)
      .constraintSize({ minWidth: 0 })
      .height(58.3)
      .alignItems(HorizontalAlign.Start);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(20).height(20);
      }
      .width(isTablet ? 44 : 34)
      .height(isTablet ? 44 : 34)
      .borderRadius(isTablet ? 22 : 17)
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

  @Builder
  private listStatusPill(label: string, primary: boolean) {
    Text(label)
      .width(64)
      .height(18)
      .padding({ left: 6, right: 6 })
      .backgroundColor(primary ? '#F5ECE6' : TOK_CARD_BG)
      .borderRadius(999)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Regular)
      .fontSize(10)
      .lineHeight(12)
      .fontColor(primary ? TOK_GREEN : TOK_MUTED)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis });
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
      return active ? '筛选书架，当前已选' : '筛选书架';
    }
    return '书架管理';
  }

  private listCoverWidth(isTablet: boolean): number {
    return isTablet ? TABLET_LIST_COVER_WIDTH : PHONE_LIST_COVER_WIDTH;
  }

  private listCoverHeight(isTablet: boolean): number {
    return isTablet ? TABLET_LIST_COVER_HEIGHT : PHONE_LIST_COVER_HEIGHT;
  }

  private listSourceLabel(book: ShelfBook): string {
    return book.sourceId === 'local' ? '本地书' : '网络书';
  }

  private listChapter(book: ShelfBook): string {
    const chapter = book.currentChapterTitle?.trim() || book.lastChapter?.trim();
    return chapter !== undefined && chapter.length > 0 ? chapter : '尚未阅读';
  }

  /**
   * readProgress arrives in basis points (0..10000, Core remote.rs). A book
   * read past its first pages of a long title lands under 1% and a plain
   * floor() presented it as "已读 0%"; keep the sub-1% state visible instead.
   */
  private gridProgressLabel(book: ShelfBook): string {
    return this.shelfProgressText(book.readProgress ?? 0);
  }

  private listProgressLabel(book: ShelfBook): string {
    if ((book.unreadCount ?? 0) > 0) {
      return `更新 ${book.unreadCount} 章`;
    }
    if ((book.readProgress ?? 0) <= 0) {
      return '未读';
    }
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
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
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
          Image($r('app.media.bookshelf_compass')).width(24).height(24);
        } else if (assetName === 'bookshelf_rss') {
          Image($r('app.media.bookshelf_rss')).width(24).height(24);
        } else {
          Image($r('app.media.bookshelf_settings')).width(24).height(24);
        }
      }
      .width(32)
      .height(32);

      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(active ? TOK_ON_PRIMARY : TOK_MUTED);
    }
    .width(66)
    .height(58)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? TOK_PRIMARY_DARK : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (!active) {
        this.onMainTab(navKey);
      }
    });
  }

  private onBooksChanged(): void {
    this.rebuildShelfProjection();
  }

  private rebuildShelfProjection(): void {
    const visible: ShelfBook[] = [];
    const groups: string[] = [];
    const seenGroups: Set<string> = new Set<string>();
    for (const book of this.books) {
      if (this.selectedGroup === '' || book.group === this.selectedGroup) visible.push(book);
      const group = book.group?.trim() ?? '';
      if (group.length > 0 && !seenGroups.has(group)) {
        seenGroups.add(group);
        groups.push(group);
      }
    }
    const rows: ShelfBook[][] = [];
    for (let index = 0; index < visible.length; index += 3) {
      rows.push(visible.slice(index, index + 3));
    }
    this.rowDataSource.replace(rows);
    this.projectedGroups = groups;
  }

  private updateActionLabel(): string {
    if (this.updateRunning) {
      return `检查中 ${this.updateProgressDone}/${this.updateProgressTotal}`;
    }
    return '检查更新';
  }

  private bookRowRenderKey(row: ShelfBook[], rowIndex: number): string {
    // The row index alone is not a content identity: an import can replace
    // the books in row 0 while ForEach keeps the old row builder alive.  Bind
    // the key to every field rendered by bookCard so imports, progress, cover,
    // and catalog badges all redraw from the latest Core projection.
    let key = `bookshelf-row-${rowIndex}`;
    for (const book of row) {
      key += `|${book.sourceId}:${book.bookId}:${book.title}:${book.author}:` +
        `${book.coverUrl ?? ''}:${book.currentChapterTitle ?? ''}:${book.lastChapter ?? ''}:` +
        `${book.unreadCount ?? 0}:${book.readProgress ?? 0}`;
    }
    return key;
  }

  private setViewMode(mode: BookshelfViewMode): void {
    if (this.viewMode === mode || this.viewSwitchRunning) {
      return;
    }
    if (this.reduceMotion) {
      this.resetViewSwitchMotion();
      this.viewMode = mode;
      this.setRestingProjectionOpacity(mode);
      return;
    }
    this.startViewSwitch(mode);
  }

  private startViewSwitch(mode: BookshelfViewMode): void {
    this.cancelViewSwitchTimers();
    const token = this.viewSwitchToken + 1;
    this.viewSwitchToken = token;
    this.pendingViewMode = mode;
    this.viewSwitchRunning = true;
    this.viewSwitchHeaderOpacity = 1;
    this.setRestingProjectionOpacity(this.viewMode);

    this.runViewSwitchHeaderTimeline(token);
    this.runViewSwitchOutgoingContentTimeline(token, this.viewMode);
    this.runViewSwitchIncomingContentTimeline(token, mode);
    this.prepareViewSwitchCoverLayers(mode);
    this.runViewSwitchDestinationCoverTimeline(token, mode);
    this.runViewSwitchMorphCoverTimeline(token, mode);
    this.viewSwitchCommitTimer = setTimeout((): void => {
      this.commitViewSwitchTarget(token);
    }, this.viewMotion.layoutCommitMs);
  }

  private commitViewSwitchTarget(token: number): void {
    if (token !== this.viewSwitchToken || !this.viewSwitchRunning) {
      return;
    }
    // `projectionRow` and every `projectionBookCard` remain mounted. Updating
    // only the projection state lets their per-property animation modifiers
    // interpolate from the geometry already on screen.
    this.viewMode = this.pendingViewMode;
  }

  private runViewSwitchHeaderTimeline(token: number): void {
    const gapBeforeIncoming = this.viewMotion.headerIncomingStartMs -
      this.viewMotion.layoutCommitMs - this.viewMotion.outgoingDurationMs;
    const tail = this.viewMotion.totalMs - this.viewMotion.headerIncomingStartMs -
      this.viewMotion.headerIncomingDurationMs;
    this.getUIContext().keyframeAnimateTo({
      onFinish: (): void => this.finishViewSwitch(token),
    }, [
      {
        duration: this.viewMotion.layoutCommitMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setViewSwitchHeaderOpacity(token, 1),
      },
      {
        duration: this.viewMotion.outgoingDurationMs,
        curve: this.viewMotion.contentCurve,
        event: (): void => this.setViewSwitchHeaderOpacity(token, 0),
      },
      {
        duration: gapBeforeIncoming,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setViewSwitchHeaderOpacity(token, 0),
      },
      {
        duration: this.viewMotion.headerIncomingDurationMs,
        curve: this.viewMotion.contentCurve,
        event: (): void => this.setViewSwitchHeaderOpacity(token, 1),
      },
      {
        duration: tail,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setViewSwitchHeaderOpacity(token, 1),
      },
    ]);
  }

  private runViewSwitchOutgoingContentTimeline(token: number, source: BookshelfViewMode): void {
    const tail = this.viewMotion.totalMs - this.viewMotion.layoutCommitMs -
      this.viewMotion.outgoingDurationMs;
    this.getUIContext().keyframeAnimateTo({}, [
      {
        duration: this.viewMotion.layoutCommitMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setProjectionContentOpacity(token, source, 1),
      },
      {
        duration: this.viewMotion.outgoingDurationMs,
        curve: this.viewMotion.contentCurve,
        event: (): void => this.setProjectionContentOpacity(token, source, 0),
      },
      {
        duration: tail,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setProjectionContentOpacity(token, source, 0),
      },
    ]);
  }

  private runViewSwitchIncomingContentTimeline(token: number, target: BookshelfViewMode): void {
    const tail = this.viewMotion.totalMs - this.viewMotion.contentIncomingStartMs -
      this.viewMotion.contentIncomingDurationMs;
    this.getUIContext().keyframeAnimateTo({}, [
      {
        duration: this.viewMotion.contentIncomingStartMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setProjectionContentOpacity(token, target, 0),
      },
      {
        duration: this.viewMotion.contentIncomingDurationMs,
        curve: this.viewMotion.contentCurve,
        event: (): void => this.setProjectionContentOpacity(token, target, 1),
      },
      {
        duration: tail,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setProjectionContentOpacity(token, target, 1),
      },
    ]);
  }

  private prepareViewSwitchCoverLayers(target: BookshelfViewMode): void {
    if (target === 'list') {
      // Cover -> List: the source cover is already the morph actor.
      this.viewSwitchDestinationCoverOpacity = 0;
      this.viewSwitchMorphCoverOpacity = 1;
      return;
    }
    // List -> Cover: preserve the list cover until the morph actor enters at
    // the authored 15% -> 18% handoff.
    this.viewSwitchDestinationCoverOpacity = 1;
    this.viewSwitchMorphCoverOpacity = 0;
  }

  private runViewSwitchDestinationCoverTimeline(token: number, target: BookshelfViewMode): void {
    if (target === 'list') {
      const tail = this.viewMotion.totalMs - this.viewMotion.contentIncomingStartMs -
        this.viewMotion.contentIncomingDurationMs;
      this.getUIContext().keyframeAnimateTo({}, [
        {
          duration: this.viewMotion.contentIncomingStartMs,
          curve: this.viewMotion.holdCurve,
          event: (): void => this.setDestinationCoverOpacity(token, 0),
        },
        {
          duration: this.viewMotion.contentIncomingDurationMs,
          curve: this.viewMotion.contentCurve,
          event: (): void => this.setDestinationCoverOpacity(token, 1),
        },
        {
          duration: tail,
          curve: this.viewMotion.holdCurve,
          event: (): void => this.setDestinationCoverOpacity(token, 1),
        },
      ]);
      return;
    }

    const sourceFadeEndMs = this.viewMotion.morphCoverIncomingStartMs +
      this.viewMotion.morphCoverIncomingDurationMs;
    const holdBeforeTargetMs = this.viewMotion.contentIncomingStartMs - sourceFadeEndMs;
    const tail = this.viewMotion.totalMs - this.viewMotion.contentIncomingStartMs -
      this.viewMotion.contentIncomingDurationMs;
    this.getUIContext().keyframeAnimateTo({}, [
      {
        duration: this.viewMotion.morphCoverIncomingStartMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setDestinationCoverOpacity(token, 1),
      },
      {
        duration: this.viewMotion.morphCoverIncomingDurationMs,
        curve: this.viewMotion.coverFadeCurve,
        event: (): void => this.setDestinationCoverOpacity(token, 0),
      },
      {
        duration: holdBeforeTargetMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setDestinationCoverOpacity(token, 0),
      },
      {
        duration: this.viewMotion.contentIncomingDurationMs,
        curve: this.viewMotion.contentCurve,
        event: (): void => this.setDestinationCoverOpacity(token, 1),
      },
      {
        duration: tail,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setDestinationCoverOpacity(token, 1),
      },
    ]);
  }

  private runViewSwitchMorphCoverTimeline(token: number, target: BookshelfViewMode): void {
    if (target === 'cover') {
      const tail = this.viewMotion.totalMs - this.viewMotion.morphCoverIncomingStartMs -
        this.viewMotion.morphCoverIncomingDurationMs;
      this.getUIContext().keyframeAnimateTo({}, [
        {
          duration: this.viewMotion.morphCoverIncomingStartMs,
          curve: this.viewMotion.holdCurve,
          event: (): void => this.setMorphCoverOpacity(token, 0),
        },
        {
          duration: this.viewMotion.morphCoverIncomingDurationMs,
          curve: this.viewMotion.coverFadeCurve,
          event: (): void => this.setMorphCoverOpacity(token, 1),
        },
        {
          duration: tail,
          curve: this.viewMotion.holdCurve,
          event: (): void => this.setMorphCoverOpacity(token, 1),
        },
      ]);
      return;
    }

    const tail = this.viewMotion.totalMs - this.viewMotion.movingCoverFadeStartMs -
      this.viewMotion.movingCoverFadeDurationMs;
    this.getUIContext().keyframeAnimateTo({}, [
      {
        duration: this.viewMotion.movingCoverFadeStartMs,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setMorphCoverOpacity(token, 1),
      },
      {
        duration: this.viewMotion.movingCoverFadeDurationMs,
        curve: this.viewMotion.coverFadeCurve,
        event: (): void => this.setMorphCoverOpacity(token, 0),
      },
      {
        duration: tail,
        curve: this.viewMotion.holdCurve,
        event: (): void => this.setMorphCoverOpacity(token, 0),
      },
    ]);
  }

  private setDestinationCoverOpacity(token: number, opacity: number): void {
    if (token === this.viewSwitchToken && this.viewSwitchRunning) {
      this.viewSwitchDestinationCoverOpacity = opacity;
    }
  }

  private setMorphCoverOpacity(token: number, opacity: number): void {
    if (token === this.viewSwitchToken && this.viewSwitchRunning) {
      this.viewSwitchMorphCoverOpacity = opacity;
    }
  }

  private setViewSwitchHeaderOpacity(token: number, opacity: number): void {
    if (token === this.viewSwitchToken && this.viewSwitchRunning) {
      this.viewSwitchHeaderOpacity = opacity;
    }
  }

  private setProjectionContentOpacity(
    token: number,
    mode: BookshelfViewMode,
    opacity: number,
  ): void {
    if (token !== this.viewSwitchToken || !this.viewSwitchRunning) {
      return;
    }
    if (mode === 'cover') {
      this.viewSwitchGridContentOpacity = opacity;
    } else {
      this.viewSwitchListContentOpacity = opacity;
    }
  }

  private finishViewSwitch(token: number): void {
    if (token !== this.viewSwitchToken) {
      return;
    }
    this.cancelViewSwitchTimers();
    this.viewSwitchRunning = false;
    this.viewSwitchHeaderOpacity = 1;
    this.setRestingProjectionOpacity(this.viewMode);
  }

  private resetViewSwitchMotion(): void {
    this.viewSwitchToken += 1;
    this.cancelViewSwitchTimers();
    this.viewSwitchRunning = false;
    this.viewSwitchHeaderOpacity = 1;
    this.setRestingProjectionOpacity(this.viewMode);
  }

  private cancelViewSwitchTimers(): void {
    if (this.viewSwitchCommitTimer >= 0) {
      clearTimeout(this.viewSwitchCommitTimer);
      this.viewSwitchCommitTimer = -1;
    }
  }

  private setRestingProjectionOpacity(mode: BookshelfViewMode): void {
    this.viewSwitchGridContentOpacity = mode === 'cover' ? 1 : 0;
    this.viewSwitchListContentOpacity = mode === 'list' ? 1 : 0;
    this.viewSwitchDestinationCoverOpacity = 1;
    this.viewSwitchMorphCoverOpacity = 0;
  }

  private projectionRowHeight(row: ShelfBook[], isTablet: boolean): number {
    if (this.viewMode === 'list') {
      return (row.length * this.listCoverHeight(isTablet)) +
        (Math.max(0, row.length - 1) * TOK_SPACE_CONTROL_INLINE);
    }
    let height = 0;
    for (const book of row) {
      height = Math.max(height, this.gridBookCardHeight(book, isTablet));
    }
    return height;
  }

  private projectionBookWidth(isTablet: boolean): number {
    return this.viewMode === 'list'
      ? this.shelfContentWidth(isTablet)
      : this.shelfBookCardWidth(isTablet);
  }

  private projectionBookHeight(book: ShelfBook, isTablet: boolean): number {
    return this.viewMode === 'list'
      ? this.listCoverHeight(isTablet)
      : this.gridBookCardHeight(book, isTablet);
  }

  private projectionBookTranslateX(columnIndex: number, isTablet: boolean): number {
    if (this.viewMode === 'list') {
      return 0;
    }
    return columnIndex * (
      this.shelfBookCardWidth(isTablet) +
      this.bookRowSpace(this.shelfContentWidth(isTablet), isTablet)
    );
  }

  private projectionBookTranslateY(columnIndex: number, isTablet: boolean): number {
    if (this.viewMode === 'cover') {
      return 0;
    }
    return columnIndex * (this.listCoverHeight(isTablet) + TOK_SPACE_CONTROL_INLINE);
  }

  private projectionCoverScale(isTablet: boolean): number {
    if (this.viewMode === 'cover') {
      return 1;
    }
    if (!isTablet) {
      return 0.495;
    }
    const listScale = this.listCoverWidth(isTablet) / this.shelfBookCardWidth(isTablet);
    return listScale;
  }

  private projectionCoverRadius(isTablet: boolean): number {
    if (this.viewMode === 'cover') {
      return 8;
    }
    const listScale = this.listCoverWidth(isTablet) / this.shelfBookCardWidth(isTablet);
    return 6 / listScale;
  }

  private projectionCoverCompensationX(isTablet: boolean): number {
    if (this.viewMode === 'cover') {
      return 0;
    }
    return -(this.shelfBookCardWidth(isTablet) - this.listCoverWidth(isTablet)) / 2;
  }

  private projectionCoverCompensationY(isTablet: boolean): number {
    if (this.viewMode === 'cover') {
      return 0;
    }
    // Figma authors the morph dy (−21.727) in screen space; this slot needs the
    // card-local centering compensation. Hardcoding −21.727 here rendered list
    // thumbnails ~15vp low (VM-verified 2026-09-02).
    return -(
      this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet) -
      this.listCoverHeight(isTablet)
    ) / 2;
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
