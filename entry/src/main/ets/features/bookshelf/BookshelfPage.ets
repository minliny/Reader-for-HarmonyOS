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
  @Prop books: ShelfBook[];
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
  @State private viewportWidth: number = 0;
  @State private viewportHeight: number = 0;
  @State private viewMode: BookshelfViewMode = 'cover';
  @State private actionBook: ShelfBook | undefined = undefined;
  @State private moreMenuVisible: boolean = false;
  @State private moreAnchorRight: number = 0;
  @State private moreAnchorBottom: number = 0;
  @State private overlayOriginX: number = 0;
  @State private overlayOriginY: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
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
          const height = this.numericAreaLength(newValue.height);
          if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
            this.viewportWidth = width;
          }
          if (height > 0 && Math.abs(height - this.viewportHeight) >= 0.01) {
            this.viewportHeight = height;
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
          iconSize: 24,
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
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, false);
        }
        this.bookshelfSection(false);
      }
      .width(this.phoneContentWidth())
      .constraintSize({ minHeight: this.scrollContentMinHeight() })
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD })
      .alignItems(HorizontalAlign.Start)
      .align(Alignment.TopStart);
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.phoneContentFrame().left, right: this.phoneContentFrame().right })
    .scrollBar(BarState.Off);
  }

  @Builder
  private tabletContent() {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, true);
        }
        this.bookshelfSection(true);
      }
      .width(this.shelfContentWidth(true))
      .constraintSize({ minHeight: this.scrollContentMinHeight() })
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_MD })
      .alignItems(HorizontalAlign.Start)
      .align(Alignment.TopStart);
    }
    .width('100%')
    .height('100%')
    .padding({ left: this.tabletContentFrame().left, right: this.tabletContentFrame().right })
    .scrollBar(BarState.Off);
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
  private bookshelfSection(isTablet: boolean) {
    Column({ space: TOK_SPACE_CONTROL_INLINE }) {
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
            this.viewMode = 'cover';
          }, this.viewMode === 'cover');
          this.sectionAction('bookshelf_list', (): void => {
            this.viewMode = 'list';
          }, this.viewMode === 'list');
          this.sectionAction('bookshelf_filter', (): void => {}, false);
          this.sectionAction('bookshelf_settings', (): void => this.onBookshelfSettingsRequested(), false);
        }
        .height(34);
      }
      .width(this.shelfContentWidth(isTablet))
      .height(38)
      .alignItems(VerticalAlign.Center);

      if (this.viewMode === 'list') {
        Column({ space: TOK_SPACE_CONTROL_INLINE }) {
          ForEach(this.books, (book: ShelfBook, index: number) => {
            this.listBookCard(book, isTablet);
          }, (book: ShelfBook, index: number): string => this.bookListRenderKey(book, index));
        }
        .width(this.shelfContentWidth(isTablet));
      } else {
        Column({ space: TOK_SPACE_MD }) {
          ForEach(this.bookRows(3), (row: ShelfBook[], rowIndex: number) => {
            Row({ space: this.bookRowSpace(this.shelfContentWidth(isTablet), isTablet) }) {
              ForEach(row, (book: ShelfBook) => {
                this.bookCard(book, isTablet);
              }, (book: ShelfBook): string => `${book.sourceId}:${book.bookId}`);
            }
            .width(this.shelfContentWidth(isTablet))
            .alignItems(VerticalAlign.Top);
          }, (row: ShelfBook[], rowIndex: number): string => this.bookRowRenderKey(row, rowIndex));
        }
        .width(this.shelfContentWidth(isTablet));
      }
    }
    .width(this.shelfContentWidth(isTablet));
  }

  @Builder
  private sectionAction(assetName: string, action: () => void, active: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      if (assetName === 'bookshelf_grid') {
        Image($r('app.media.bookshelf_grid')).width(20).height(20)
          .fillColor(active ? TOK_GREEN : TOK_MUTED);
      } else if (assetName === 'bookshelf_list') {
        Image($r('app.media.bookshelf_list')).width(20).height(20)
          .fillColor(active ? TOK_GREEN : TOK_MUTED);
      } else if (assetName === 'bookshelf_filter') {
        Image($r('app.media.bookshelf_filter')).width(20).height(20).fillColor(TOK_MUTED);
      } else {
        Image($r('app.media.bookshelf_settings')).width(20).height(20).fillColor(TOK_MUTED);
      }
    }
    .width(34)
    .height(34)
    .borderRadius(17)
    // Figma `Library/SectionAction` (`487:40`) keeps a 34×34 visual actor
    // but expands its transparent hit target by 5vp on every side.
    .responseRegion({ x: -5, y: -5, width: 44, height: 44 })
    .accessibilityText(this.sectionActionLabel(assetName, active))
    .onClick(action);
  }

  @Builder
  private listBookCard(book: ShelfBook, isTablet: boolean) {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Row({ space: TOK_SPACE_CONTROL_INLINE }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(this.listCoverWidth(isTablet))
            .height(this.listCoverHeight(isTablet))
            .objectFit(ImageFit.Cover)
            .borderRadius(6)
            .shadow({ radius: 12, color: '#1F34261F', offsetX: 0, offsetY: 6 });
        } else {
          NoCoverCover({
            coverWidth: this.listCoverWidth(isTablet),
            coverHeight: this.listCoverHeight(isTablet),
          });
        }

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
      }
      .layoutWeight(1)
      .constraintSize({ minWidth: 0 })
      .height(this.listCoverHeight(isTablet))
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onBookSelected(book));

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more'))
          .width(20)
          .height(20);
      }
      .width(isTablet ? 44 : 34)
      .height(isTablet ? 44 : 34)
      .borderRadius(isTablet ? 22 : 17)
      .accessibilityText(`${book.title}更多操作`)
      .onClick((): void => this.presentBookActionSheet(book));
    }
    .width(this.shelfContentWidth(isTablet))
    .height(this.listCoverHeight(isTablet))
    .alignItems(VerticalAlign.Center)
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction((_event: GestureEvent): void => this.presentBookActionSheet(book)),
    );
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

  @Builder
  private bookCard(book: ShelfBook, isTablet: boolean) {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(this.shelfBookCardWidth(isTablet))
            .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
            .objectFit(ImageFit.Cover)
            .borderRadius(8)
            .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 });
        } else {
          // N-COVER-REMAP-01: Figma `BookCover` NoCover variant (`3612:1796`)
          // — cream + rules + "暂无封面". Not a green gradient.
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
            .margin({ top: 7, right: 7 });
        }
      }
      .width(this.shelfBookCardWidth(isTablet))
      .height(this.bookCardHeight(this.shelfBookCardWidth(isTablet), isTablet))
      .linearGradient({
        angle: 141.7,
        colors: [[TOK_PRIMARY_GRADIENT_START, 0.077], [TOK_PRIMARY_DARK, 0.923]],
      })
      .borderRadius(8)
      .clip(true);

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
        Text(`已读 ${Math.floor((book.readProgress ?? 0) / 100)}%`)
          .width(this.shelfBookCardWidth(isTablet))
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_GREEN)
          .maxLines(1);
      }
    }
    .width(this.shelfBookCardWidth(isTablet))
    .alignItems(HorizontalAlign.Start)
    .onClick((): void => this.onBookSelected(book))
    .gesture(
      LongPressGesture({ fingers: 1, repeat: false, duration: 500 })
        .onAction((_event: GestureEvent): void => this.presentBookActionSheet(book)),
    );
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
      return '筛选书架';
    }
    return '书架设置';
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

  private listProgressLabel(book: ShelfBook): string {
    if ((book.unreadCount ?? 0) > 0) {
      return `更新 ${book.unreadCount} 章`;
    }
    const progress = Math.floor((book.readProgress ?? 0) / 100);
    return progress > 0 ? `已读 ${progress}%` : '未读';
  }

  private shelfBookCardWidth(isTablet: boolean): number {
    return this.bookCardWidth(this.shelfContentWidth(isTablet), isTablet);
  }

  private scrollContentMinHeight(): number {
    return Math.max(0, this.viewportHeight);
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
        this.tabletNavigationItem('bookshelf_compass', '发现', 'discover', false);
        this.tabletNavigationItem('bookshelf_rss', 'RSS', 'rss', false);
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

  private bookRows(columns: number): ShelfBook[][] {
    const rows: ShelfBook[][] = [];
    for (let index = 0; index < this.books.length; index += columns) {
      rows.push(this.books.slice(index, index + columns));
    }
    return rows;
  }

  private bookRowRenderKey(row: ShelfBook[], rowIndex: number): string {
    // The row index alone is not a content identity: an import can replace
    // the books in row 0 while ForEach keeps the old row builder alive.  Bind
    // the key to every field rendered by bookCard so imports, progress, cover,
    // and catalog badges all redraw from the latest Core projection.
    let key = `bookshelf-row-${rowIndex}`;
    for (const book of row) {
      key += `|${book.sourceId}:${book.bookId}:${book.title}:${book.author}:` +
        `${book.coverUrl ?? ''}:${book.unreadCount ?? 0}:${book.readProgress ?? 0}`;
    }
    return key;
  }

  private bookListRenderKey(book: ShelfBook, index: number): string {
    return `bookshelf-list-${index}:${book.sourceId}:${book.bookId}:${book.title}:${book.author}:` +
      `${book.coverUrl ?? ''}:${book.currentChapterTitle ?? ''}:${book.lastChapter ?? ''}:` +
      `${book.unreadCount ?? 0}:${book.readProgress ?? 0}`;
  }

  private hasCover(book: ShelfBook): boolean {
    if (book.coverUrl === undefined) {
      return false;
    }
    return /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }
}
