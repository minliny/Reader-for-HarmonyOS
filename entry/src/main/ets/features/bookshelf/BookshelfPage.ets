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
  bookshelfViewCoverDelayMs,
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
  @State private viewSwitchTimeMs: number = 0;
  private viewSwitchSourceMode: BookshelfViewMode = 'cover';
  private viewSwitchDestinationMode: BookshelfViewMode = 'list';
  private viewTimeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(this.viewMotion.totalMs);
  private readonly viewFadeCurve = curves.cubicBezierCurve(0, 0, .58, 1);
  private readonly viewContentCurve = curves.cubicBezierCurve(.4, 0, .2, 1);
  private readonly viewMoveCurve = curves.cubicBezierCurve(.2, 0, 0, 1);
  private readonly viewScaleCurve = curves.cubicBezierCurve(.25, .1, 0, 1);
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
   * group filters and a separate shelf-wide manual update action. The row is an
   * approved product extension (no Figma frame). The resting surface follows
   * the current four-action product decision: Cover/List/Filter/Management;
   * search remains solely in the AppTopBar.
   */
  @Builder
  private filterRow() {
    Column() {
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('全部', this.selectedGroup === '', (): void => {
          this.selectedGroup = '';
          this.rebuildShelfProjection();
        });
        ForEach(this.projectedGroups, (group: string) => {
          this.filterChip(group, this.selectedGroup === group, (): void => {
            this.selectedGroup = group;
            this.rebuildShelfProjection();
          });
        }, (group: string): string => `shelf-group-${group}`);
      }
      .width('100%');
      Row() {
        Blank();
        this.checkUpdatesAction();
      }
      .width('100%');
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
  private checkUpdatesAction() {
    Button(this.updateActionLabel(), { type: ButtonType.Normal })
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .fontColor(this.updateRunning ? TOK_MUTED : TOK_GREEN)
      .padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: this.updateRunning ? TOK_BORDER : TOK_GREEN })
      .borderRadius(TOK_RADIUS_MD)
      .constraintSize({ minHeight: 44 })
      .enabled(!this.updateRunning)
      .margin({ right: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .labelStyle({ maxLines: 1, overflow: TextOverflow.Ellipsis })
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
   * Figma renders a shared morph cover above a separately fading destination
   * collection. Keeping both actors avoids the old jump where one cover had to
   * be both the moving layer and the final static layer at the same instant.
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
    .borderRadius(this.projectionCoverRadius(isTablet, index))
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
      if (this.selectedGroup === '' || this.selectedGroup === '默认') visible.push(book);
      const group = '默认';
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
    if (this.viewSwitchDestinationMode === 'list') {
      this.viewSwitchDestinationCoverOpacity = incoming;
      this.viewSwitchMorphCoverOpacity = 1 - motionSegment(t,
        m.movingCoverFadeStartMs, m.movingCoverFadeDurationMs, fade);
    } else {
      const handoff = motionSegment(t, m.morphCoverIncomingStartMs, m.morphCoverIncomingDurationMs, fade);
      this.viewSwitchDestinationCoverOpacity = 1 - handoff + incoming;
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
