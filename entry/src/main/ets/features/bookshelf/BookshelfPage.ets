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

const PHONE_BOOK_WIDTH = 96.656;
const TABLET_BOOK_WIDTH = 186.672;

/**
 * Figma-backed Bookshelf for the one fully specified state: a shelf whose
 * entries and continue-reading item both have a real displayable cover.
 *
 * Source: `23 · Pages · Final` `943:11` (Phone) and `943:437` (Tablet).
 * This component deliberately has no empty, no-cover, import, or motion
 * fallback: those states are not present in the corresponding Final pages.
 */
@Component
export struct BookshelfPage {
  @Prop books: ShelfBook[];
  @Prop continueReading: ShelfBook | undefined;
  @Prop isTablet: boolean;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onBookSelected: (book: ShelfBook) => void = (_book: ShelfBook): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    MainTabShell({
      activeTab: 'bookshelf',
      showBottomNav: !this.isTablet,
      onMainTab: (key: string): void => this.onMainTab(key),
    }) {
      this.bookshelfTabContent();
    }
  }

  @Builder
  private bookshelfTabContent() {
    Column() {
      this.topBar();
      Stack({ alignContent: Alignment.TopStart }) {
        if (this.isTablet) {
          this.tabletContent();
          this.tabletNavigation();
        } else {
          this.phoneContent();
        }
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%');
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
            // H-NOTE-1: Tablet import was previously disabled. Until Figma
            // supplies a Tablet import final assembly, open the import dialog
            // on Tablet as well so the user has a working entry point.
            this.onImportRequested();
          },
        });
      }
    }
  }

  @Builder
  private phoneContent() {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, TOK_CONTENT_MAX_W_PHONE);
        }
        this.bookshelfSection(TOK_CONTENT_MAX_W_PHONE, false);
      }
      .width(TOK_CONTENT_MAX_W_PHONE)
      .padding({ top: TOK_SPACE_XS, bottom: 628 });
    }
    .width('100%')
    .height('100%')
    .padding({ left: TOK_SCREEN_INSET, right: 21 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private tabletContent() {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, TOK_CONTENT_RAIL_W_TABLET);
        }
        this.bookshelfSection(TOK_CONTENT_RAIL_W_TABLET, true);
      }
      .width(TOK_CONTENT_RAIL_W_TABLET)
      .padding({ top: TOK_SPACE_XS, bottom: 744 });
    }
    .width('100%')
    .height('100%')
    .padding({ left: 119, right: 21 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private continueReadingCard(book: ShelfBook, width: number) {
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
    .width(width)
    .height(100)
    .padding({ left: 16.554, right: 16.554 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .onClick((): void => this.onBookSelected(book));
  }

  @Builder
  private bookshelfSection(width: number, isTablet: boolean) {
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
          this.sectionAction('bookshelf_grid');
          this.sectionAction('bookshelf_list');
          this.sectionAction('bookshelf_filter');
          this.sectionAction('bookshelf_search');
          this.sectionAction('bookshelf_settings');
        }
        .height(34);
      }
      .width(width)
      .height(38)
      .alignItems(VerticalAlign.Center);

      Column({ space: TOK_SPACE_MD }) {
        ForEach(this.bookRows(3), (row: ShelfBook[], rowIndex: number) => {
          Row({ space: 30 }) {
            ForEach(row, (book: ShelfBook) => {
              this.bookCard(book, isTablet);
            }, (book: ShelfBook): string => `${book.sourceId}:${book.bookId}`);
          }
          .width(width)
          .alignItems(VerticalAlign.Top);
        }, (_: ShelfBook[], rowIndex: number): string => `bookshelf-row-${rowIndex}`);
      }
      .width(width);
    }
    .width(width);
  }

  @Builder
  private sectionAction(assetName: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (assetName === 'bookshelf_grid') {
        Image($r('app.media.bookshelf_grid')).width(20).height(20);
      } else if (assetName === 'bookshelf_list') {
        Image($r('app.media.bookshelf_list')).width(20).height(20);
      } else if (assetName === 'bookshelf_filter') {
        Image($r('app.media.bookshelf_filter')).width(20).height(20);
      } else if (assetName === 'bookshelf_search') {
        Image($r('app.media.bookshelf_section_search')).width(20).height(20);
      } else {
        Image($r('app.media.bookshelf_settings')).width(20).height(20);
      }
    }
    .width(34)
    .height(34)
    .borderRadius(17);
  }

  @Builder
  private bookCard(book: ShelfBook, isTablet: boolean) {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
            .height(isTablet ? 280 : 145.443)
            .objectFit(ImageFit.Cover)
            .borderRadius(8)
            .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 });
        } else {
          // N-COVER-REMAP-01: Figma `BookCover` NoCover variant (`3612:1796`)
          // — cream + rules + "暂无封面". Not a green gradient.
          NoCoverCover({
            coverWidth: isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH,
            coverHeight: isTablet ? 280 : 145.443,
          });
        }
      }
      .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
      .height(isTablet ? 280 : 145.443)
      .linearGradient({
        angle: 141.7,
        colors: [[TOK_PRIMARY_GRADIENT_START, 0.077], [TOK_PRIMARY_DARK, 0.923]],
      })
      .borderRadius(8)
      .clip(true);

      Text(book.title)
        .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18.3)
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(15)
        .fontColor(TOK_MUTED)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
    .alignItems(HorizontalAlign.Start)
    .onClick((): void => this.onBookSelected(book));
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
    Column({ space: 0 }) {
      Blank().height(238);
      Column({ space: 6 }) {
        this.tabletNavigationItem('bookshelf_library', '书架', 'bookshelf', true);
        this.tabletNavigationItem('bookshelf_compass', '发现', 'discover', false);
        this.tabletNavigationItem('bookshelf_rss', 'RSS', 'rss', false);
        this.tabletNavigationItem('bookshelf_settings', '设置', 'settings', false);
      }
      .width(82)
      .height(268)
      .padding(TOK_SPACE_XS)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(TOK_CARD_BG)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(24);
    }
    .width(98)
    .height('100%')
    .padding({ left: TOK_SPACE_MD })
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
        .fontFamily('ReaderInter')
        .fontWeight(800)
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

  private hasCover(book: ShelfBook): boolean {
    if (book.coverUrl === undefined) {
      return false;
    }
    return /^(data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }
}
