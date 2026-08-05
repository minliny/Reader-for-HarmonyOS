import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { NoCoverCover } from './NoCoverCover';

const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 620;
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
  onBookSelected: (book: ShelfBook) => void = (_book: ShelfBook): void => {};

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSansSC',
      familySrc: $rawfile('NotoSansSC-VF.otf'),
    });
  }

  build() {
    Column() {
      this.topBar();
      Stack({ alignContent: Alignment.TopStart }) {
        if (this.isTablet) {
          this.tabletContent();
          this.tabletNavigation();
        } else {
          this.phoneContent();
          this.phoneNavigation();
        }
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private topBar() {
    Row({ space: 18 }) {
      Text('书架')
        .layoutWeight(1)
        .height(38)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(38)
        .fontColor('#1F1B17');

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_search'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onSearchRequested());

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => {
        // H-NOTE-1: Tablet import was previously disabled. Until Figma
        // supplies a Tablet import final assembly, open the import dialog
        // on Tablet as well so the user has a working entry point.
        this.onImportRequested();
      });
    }
    .height(58)
    .width('100%')
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private phoneContent() {
    Scroll() {
      Column({ space: 8 }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, PHONE_CONTENT_WIDTH);
        }
        this.bookshelfSection(PHONE_CONTENT_WIDTH, false);
      }
      .width(PHONE_CONTENT_WIDTH)
      .padding({ top: 8, bottom: 628 });
    }
    .width('100%')
    .height('100%')
    .padding({ left: 19, right: 21 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private tabletContent() {
    Scroll() {
      Column({ space: 8 }) {
        if (this.continueReading !== undefined) {
          this.continueReadingCard(this.continueReading, TABLET_CONTENT_WIDTH);
        }
        this.bookshelfSection(TABLET_CONTENT_WIDTH, true);
      }
      .width(TABLET_CONTENT_WIDTH)
      .padding({ top: 8, bottom: 744 });
    }
    .width('100%')
    .height('100%')
    .padding({ left: 119, right: 21 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private continueReadingCard(book: ShelfBook, width: number) {
    Row({ space: 14 }) {
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
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor('#2D4A3E')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(6);

        Text(book.title)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(20)
          .lineHeight(24)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Blank().height(5);

        Text(book.author)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .height(67.4)
      .alignItems(HorizontalAlign.Start);

      Stack({ alignContent: Alignment.Center }) {
        Text('阅读')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor('#FFFAF4');
      }
      .width(82)
      .height(40)
      .backgroundColor('#2D4A3E')
      .borderRadius(20);
    }
    .width(width)
    .height(100)
    .padding({ left: 16.554, right: 16.554 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E0FFFFFF')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .onClick((): void => this.onBookSelected(book));
  }

  @Builder
  private bookshelfSection(width: number, isTablet: boolean) {
    Column({ space: 10 }) {
      Row() {
        Text('我的书架')
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18)
          .fontColor('#1F1B17');

        Row({ space: 8 }) {
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

      Column({ space: 16 }) {
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
        colors: [['#3D5A4C', 0.077], ['#1F3528', 0.923]],
      })
      .borderRadius(8)
      .clip(true);

      Text(book.title)
        .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18.3)
        .fontColor('#1F1B17')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .lineHeight(15)
        .fontColor('#756F69')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(isTablet ? TABLET_BOOK_WIDTH : PHONE_BOOK_WIDTH)
    .alignItems(HorizontalAlign.Start)
    .onClick((): void => this.onBookSelected(book));
  }

  @Builder
  private phoneNavigation() {
    Column() {
      Blank().layoutWeight(1);
      Row() {
        Row({ space: 0 }) {
          this.phoneNavigationItem('bookshelf_library', '书架', true);
          this.phoneNavigationItem('bookshelf_compass', '发现', false);
          this.phoneNavigationItem('bookshelf_rss', 'RSS', false);
          this.phoneNavigationItem('bookshelf_settings', '设置', false);
        }
        .width(360)
        .height(68)
        .padding(8)
        .backgroundColor('#E6FFFCF8')
        .border({ width: 1, color: '#C1C7CD' })
        .borderRadius(24);
      }
      .width('100%')
      .padding({ left: 14, right: 16 });
    }
    .width('100%')
    .height('100%')
    .padding({ bottom: 16 })
    // This full-height visual placement layer is painted over the Scroll.
    // Transparent keeps its bottom-navigation descendants interactive while
    // allowing cards behind its blank region to receive their own clicks.
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private phoneNavigationItem(assetName: string, label: string, active: boolean) {
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
      .width(30)
      .height(30);

      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(active ? '#FFFAF4' : '#756F69');
    }
    .width(86.5)
    .height(54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? '#1F3528' : Color.Transparent)
    .borderRadius(24)
    .onClick((): void => {
      if (assetName === 'bookshelf_rss') {
        this.onRssRequested();
      } else if (assetName === 'bookshelf_settings') {
        this.onSettingsRequested();
      }
    });
  }

  @Builder
  private tabletNavigation() {
    Column({ space: 0 }) {
      Blank().height(238);
      Column({ space: 6 }) {
        this.tabletNavigationItem('bookshelf_library', '书架', true);
        this.tabletNavigationItem('bookshelf_compass', '发现', false);
        this.tabletNavigationItem('bookshelf_rss', 'RSS', false);
        this.tabletNavigationItem('bookshelf_settings', '设置', false);
      }
      .width(82)
      .height(268)
      .padding(8)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor('#E6FFFCF8')
      .border({ width: 1, color: '#C1C7CD' })
      .borderRadius(24);
    }
    .width(98)
    .height('100%')
    .padding({ left: 16 })
    // Same placement rule as the Phone rail: do not turn its transparent
    // full-height region into a hit-test shield over shelf content.
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private tabletNavigationItem(assetName: string, label: string, active: boolean) {
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
        .fontColor(active ? '#FFFAF4' : '#756F69');
    }
    .width(66)
    .height(58)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? '#1F3528' : Color.Transparent)
    .borderRadius(24);
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
