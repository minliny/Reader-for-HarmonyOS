// BookshelfComponents — bookshelf skeleton ported from render-runtime.js
// mainTabBookshelf() DOM: .fd-continue-card → .fd-bookshelf-shelf-section
// (wrapper, gap 10: .fd-section-head [h2 + 5 view-action buttons] + .fd-book-grid).
// No local category-chip row: the chips were invented and have no Figma source.
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';
import {
  BookshelfCacheStatus,
  CoreBookshelfBook,
  isLocalBookSourceId,
} from '../store/ReaderUiState';
import { SourceCoverImage } from './SourceCoverImage';

// Book entry passed from ViewStateRenderer (extracted from fixture BookCard children).
export interface BookEntry {
  sourceId?: string;
  bookId: string;
  title: string;
  author: string;
  coverKey: string;
  coverUrl?: string;
  latestChapter?: string;
  cacheStatus?: BookshelfCacheStatus;
}

// Whether the ContinueReadingCard should reserve a slot on the shelf view.
// Figma binds only the populated ContinueReadingCard: while the shelf is
// unresolved or empty, do not reserve a speculative skeleton/empty card slot.
// The current Core response is group-scoped, so a loaded empty group renders
// as empty rather than inventing a hidden recent-reading record from another
// group.
export function shouldRenderContinueReadingForShelf(
  isLoaded: boolean,
  books: CoreBookshelfBook[],
  _view: string,
): boolean {
  return isLoaded && books.length > 0;
}

// Whether a bookshelf route should embed the ContinueReadingCard itself.
// Only cover presentation owns the recent-reading card. The current Figma
// Phone list master begins directly with the shelf rows, so list mode must not
// reserve or render a second recent-reading region.
export function shouldEmbedContinueReadingForBookshelfRoute(routeId: string): boolean {
  return routeId === 'bookshelf-cover-mode';
}

// A bookId is loadable when it is a real source path (e.g. '/book/123' or a
// full 'https://...' URL). Fixture ids like 'bk-001' are NOT loadable. Guard
// this so fixture-only flows just route-push while real rows enter the
// sourceId-backed Core reading path.
function isLoadableBookId(bookId: string): boolean {
  return bookId.length > 0 && (bookId.startsWith('/') || bookId.startsWith('http'));
}

function bookshelfCoverResource(coverKey: string): Resource {
  switch (coverKey) {
    case 'longNight':
      return $r('app.media.bookshelf_cover_long_night');
    case 'mysteryLord':
      return $r('app.media.bookshelf_cover_mystery_lord');
    case 'brightMoon':
      return $r('app.media.bookshelf_cover_bright_moon');
    case 'renjian':
      return $r('app.media.bookshelf_cover_renjian_cihua');
    case 'androidNotes':
      return $r('app.media.bookshelf_cover_android_notes');
    case 'threeBody':
    default:
      return $r('app.media.bookshelf_cover_three_body');
  }
}

// Figma Bookshelf phone master: the content column is 350px wide and the
// continue card is 350×100.  The shell owns the responsive content width (the
// tablet shell supplies its 658px content column), while this component keeps
// the card's internal 10px vertical rhythm and its measured 62×93 cover. No
// persistent card elevation is part of this surface.
//   div: h2 "继续阅读" (13/900 primary) + strong (serif 20) + span author (14 muted).
//   button (.fd-continue-action-button) "阅读": min 74×40, pill, primary, 13/800.
// The card is driven by a separate global Core progress query, never by the
// first row of the currently filtered/sorted shelf. Loading, unavailable, and
// empty states stay explicit instead of falling back to a fixture book.
@Component
export struct ContinueReadingCard {
  @StorageProp('reader.continueReadingBook') continueReadingBook: CoreBookshelfBook | null = null;
  @StorageProp('reader.continueReadingLoaded') continueReadingLoaded: boolean = false;

  private coreContinueBook(): CoreBookshelfBook | null {
    return this.continueReadingLoaded ? this.continueReadingBook : null;
  }

  build() {
    if (this.coreContinueBook() !== null) {
      Row() {
        Stack({ alignContent: Alignment.TopEnd }) {
          SourceCoverImage({
            sourceId: this.coreContinueBook()?.sourceId ?? '',
            coverUrl: this.coreContinueBook()?.coverUrl ?? '',
          })
        }
        .width(62)
        .height(93)
        .borderRadius(6)
        .backgroundColor(ReaderUiVisualTokens.bookshelfSectionSurface)
        .onClick(() => this.openReader())

        Column() {
          Text('继续阅读')
            .fontSize(13)
            .fontWeight(900)
            .fontColor(ReaderUiVisualTokens.bookshelfActionPrimary)
            .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          Text(this.coreContinueBook()?.title ?? '')
            .fontSize(20)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.bookshelfInk)
            .fontFamily(ReaderUiVisualTokens.bookshelfBookTitleFontFamily)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 6 })
          if ((this.coreContinueBook()?.author ?? '').length > 0) {
            Text(this.coreContinueBook()?.author ?? '')
              .fontSize(14)
              .fontColor(ReaderUiVisualTokens.bookshelfMuted)
              .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .margin({ top: 5 })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 14, right: 14 })

        Text('阅读')
          .fontSize(13)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfActionLabel)
          .backgroundColor(ReaderUiVisualTokens.bookshelfActionPrimary)
          .borderRadius(20)
          .width(82)
          .height(40)
          .textAlign(TextAlign.Center)
          .onClick(() => this.openReader())
      }
      .width('100%')
      .height(100)
      .padding({ left: 16.5538, right: 16.5538 })
      .border({ width: 1, color: ReaderUiVisualTokens.bookshelfBorder })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.bookshelfSectionSurface)
      .alignItems(VerticalAlign.Center)
    }
  }

  private openReader(): void {
    const coreBook = this.coreContinueBook();
    if (coreBook === null) return;
    // Keep the card a direct reader entry, but never send it through the
    // chapterIndex=0 Book Open Pilot. The shared dispatch preserves the same
    // durable Core progress -> TOC identity -> canonical location recovery as
    // the detail page's “继续阅读” action.
    ReaderUiStore.dispatchContinueReading(coreBook.bookId, coreBook.sourceId);
  }
}

// .fd-section-head.fd-bookshelf-section-head: flex space-between, gap 12,
//   min-height 38. h2 "我的书架" 15/700. view-actions: 5 transparent 34×34
//   hit targets (grid/list/filter/search/settings), each with a 20×20 icon.
@Component
export struct ShelfSectionHeader {
  @Prop title: string = '我的书架';
  @Prop viewMode: string = 'cover';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Row() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.bookshelfInk)
        .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
      Blank()
      Row({ space: 8 }) {
        // 封面视图：route-replace 切换书架视图模式
        Column() {
          Image($r('app.media.bookshelf_icon_grid_primary'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick(() => {
          MotionAdapter.apply('bookshelf.view.switch', this.reducedMotion, this.getUIContext(), () => {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: 'cover' });
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-cover-mode' });
          });
        })

        // 列表视图：route-replace 切换书架视图模式
        Column() {
          Image($r('app.media.bookshelf_icon_list_dark'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick(() => {
          MotionAdapter.apply('bookshelf.view.switch', this.reducedMotion, this.getUIContext(), () => {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: 'list' });
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-list-mode' });
          });
        })

        // Figma supplies this control's appearance, but no separate filter
        // sheet or route is bound in the current visual registry. Keep it
        // visually faithful without inventing an unbound flow.
        Column() {
          Image($r('app.media.bookshelf_icon_filter_dark'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)

        // The current SectionHeader includes the same admitted search target
        // as the page top bar. It is a transparent icon hit target in Figma,
        // not a locally styled pill.
        Column() {
          Image($r('app.media.bookshelf_icon_search_dark'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'book-search' }))

        // Likewise, current Figma supplies the icon only; the old local
        // settings route has no bound page and must not be resurrected.
        Column() {
          Image($r('app.media.bookshelf_icon_gear_dark'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
      }
    }
    .width('100%')
    .height(38)
    .alignItems(VerticalAlign.Center)
  }
}

// .fd-bookshelf-shelf-section: grid, gap 10 — wrapper for section head + grid.
// Accepts title + books from ViewStateRenderer (extracted from fixture children).
@Component
export struct BookshelfShelfSection {
  @Prop title: string = '我的书架';
  @Prop books: BookEntry[] = [];
  @Prop viewMode: string = 'cover';
  @StorageProp('reader.bookshelfBooks') coreBooks: CoreBookshelfBook[] = [];

  private displayedBooks(): BookEntry[] {
    const result: BookEntry[] = [];
    for (let i = 0; i < this.coreBooks.length; i++) {
      const book = this.coreBooks[i];
      result.push({
        sourceId: book.sourceId,
        bookId: book.bookId,
        title: book.title,
        author: book.author,
        coverKey: '',
        coverUrl: book.coverUrl,
        latestChapter: book.lastChapter,
        cacheStatus: book.cacheStatus ?? 'unknown',
      });
    }
    return result;
  }

  build() {
    Column() {
      if (this.coreBooks.length === 0) {
        // Figma canonical State/BookshelfEmpty (286:31) is the entire empty
        // shelf body. Do not leave the populated-master section header or a
        // fabricated loading/empty composition above it.
        BookshelfEmptyState()
      } else {
        ShelfSectionHeader({ title: this.title, viewMode: this.viewMode })
        if (this.viewMode === 'list') {
          BookList({ books: this.displayedBooks() })
            .margin({ top: 10 })
        } else {
          BookGrid({ books: this.displayedBooks() })
            .margin({ top: 10 })
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
  }
}

// .fd-book-cover-frame: width 100%, aspect 2/3, radius-md(8), surface.
// The Figma bookshelf masters do not use a persistent cover elevation.
@Component
export struct BookCover {
  @Prop sourceId: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';

  private fallbackCover(): Resource | undefined {
    return this.coverKey.length > 0 ? bookshelfCoverResource(this.coverKey) : undefined;
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      SourceCoverImage({
        sourceId: this.sourceId,
        coverUrl: this.coverUrl,
        fallback: this.fallbackCover(),
      })
    }
    .width('100%')
    .aspectRatio(2 / 3)
    .borderRadius(8)
    .backgroundColor(ReaderUiVisualTokens.bookshelfSectionSurface)
    .shadow({ radius: 26, color: ReaderUiVisualTokens.bookshelfCoverShadow, offsetX: 0, offsetY: 8 })
  }
}

// .fd-book-card (cover mode): grid, gap 6. cover + strong (serif 15) + span
// (12 muted). Figma's Bookshelf entry is direct-to-Reader; detail inspection
// belongs to the long-press action sheet instead. The stable Core identity is
// always passed into the shared reader-entry owner.
@Component
export struct BookCard {
  @Prop sourceId: string = '';
  @Prop bookId: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private canOpen(): boolean {
    return this.bookId.length > 0 && (this.sourceId.length > 0 || isLoadableBookId(this.bookId));
  }

  private openBookActions(): void {
    if (!this.canOpen()) return;
    ReaderUiStore.requestBookshelfBookActions(this.bookId, this.sourceId);
  }

  private openReader(): void {
    if (!this.canOpen()) return;
    MotionAdapter.apply('card.press', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatchBookshelfCoverToReader(this.bookId, this.sourceId);
    });
  }

  build() {
    Column() {
      BookCover({
        sourceId: this.sourceId,
        coverKey: this.coverKey,
        coverUrl: this.coverUrl,
      })
      .gesture(
        GestureGroup(
          GestureMode.Exclusive,
          LongPressGesture({ repeat: false, duration: 500 })
            .onAction(() => this.openBookActions()),
          TapGesture()
            .onAction(() => this.openReader())
        )
      )
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.bookshelfInk)
        .fontFamily(ReaderUiVisualTokens.bookshelfBookTitleFontFamily)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
      if (this.author.length > 0) {
        Text(this.author)
          .fontSize(12)
          .fontColor(ReaderUiVisualTokens.bookshelfMuted)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .alignItems(HorizontalAlign.Start)
  }
}

// .fd-book-grid: repeat(3, 1fr); gap 16px 30px. The parent selects either its
// Core records, a loading skeleton, or an empty state; this leaf never invents
// a fallback book list.
@Component
export struct BookGrid {
  @Prop books: BookEntry[] = [];
  // ScreenGraph can reuse BookGrid for both cover and list variants. Keep the
  // same book identities and route actions while changing only presentation.
  @Prop viewMode: string = 'cover';

  build() {
    if (this.viewMode === 'list') {
      BookList({ books: this.books })
    } else {
      Grid() {
        ForEach(this.books, (b: BookEntry, i: number) => {
          GridItem() {
            BookCard({
              sourceId: b.sourceId ?? '',
              bookId: b.bookId,
              title: b.title,
              author: b.author,
              coverKey: b.coverKey,
              coverUrl: b.coverUrl ?? '',
            })
          }
        }, (b: BookEntry, i: number) => `${b.bookId}-${b.title}-${i}`)
      }
      .columnsTemplate('1fr 1fr 1fr')
      .rowsGap(16)
      .columnsGap(30)
      .width('100%')
    }
  }
}

// Figma Library/BookCard `Layout=List, Viewport=Phone` (493:191): one
// 350.9×72 row with a 48×72 cover, a 10px gap, 58.3px content column, and a
// visible 34×34 More affordance. There is intentionally no Tablet list master;
// viewport admission keeps this Phone-only rather than stretching it into a
// made-up tablet layout.
@Component
export struct BookListRow {
  @Prop sourceId: string = '';
  @Prop bookId: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop latestChapter: string = '';
  @Prop cacheStatus: BookshelfCacheStatus = 'unknown';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private canOpen(): boolean {
    return this.bookId.length > 0 && (this.sourceId.length > 0 || isLoadableBookId(this.bookId));
  }

  private openBookActions(): void {
    if (!this.canOpen()) return;
    ReaderUiStore.requestBookshelfBookActions(this.bookId, this.sourceId);
  }

  private openReader(): void {
    if (!this.canOpen()) return;
    MotionAdapter.apply('listRow.select', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatchBookshelfActionToReader(this.bookId, this.sourceId);
    });
  }

  private sourceLabel(): string {
    return isLocalBookSourceId(this.sourceId) ? '本地书' : '网络书';
  }

  private cacheLabel(): string {
    if (isLocalBookSourceId(this.sourceId)) return '离线可读';
    if (this.cacheStatus === 'cached') return '已缓存';
    if (this.cacheStatus === 'missing') return '未缓存';
    return '';
  }

  private cacheReadable(): boolean {
    return isLocalBookSourceId(this.sourceId) || this.cacheStatus === 'cached';
  }

  build() {
    Row({ space: 10 }) {
      // 48×72 封面（列表模式封面比网格模式矮）
      Stack({ alignContent: Alignment.TopEnd }) {
        SourceCoverImage({
          sourceId: this.sourceId,
          coverUrl: this.coverUrl,
          fallback: this.coverKey.length > 0 ? bookshelfCoverResource(this.coverKey) : undefined,
        })
      }
      .width(48)
      .height(72)
      .borderRadius(6)
      .shadow({ radius: 12, color: ReaderUiVisualTokens.bookshelfListCoverShadow, offsetX: 0, offsetY: 6 })
      .gesture(
        GestureGroup(
          GestureMode.Exclusive,
          LongPressGesture({ repeat: false, duration: 500 })
            .onAction(() => this.openBookActions()),
          TapGesture()
            .onAction(() => this.openReader())
        )
      )
      Column({ space: 2 }) {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.bookshelfInk)
          .fontFamily(ReaderUiVisualTokens.bookshelfBookTitleFontFamily)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Row({ space: 4 }) {
          if (this.author.length > 0) {
            Text(this.author)
              .fontSize(12)
              .fontColor(ReaderUiVisualTokens.bookshelfMuted)
              .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          if (this.author.length > 0 && this.latestChapter.length > 0) {
            Text('·')
              .fontSize(11)
              .fontColor(ReaderUiVisualTokens.bookshelfMuted)
          }
          if (this.latestChapter.length > 0) {
            Text(this.latestChapter)
              .fontSize(11)
              .fontColor(ReaderUiVisualTokens.bookshelfMuted)
              .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .layoutWeight(1)
          }
        }
        .width('100%')
        Row({ space: 6 }) {
          Text(this.sourceLabel())
            .fontSize(10)
            .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
            .fontColor(isLocalBookSourceId(this.sourceId)
              ? ReaderUiVisualTokens.bookshelfActionPrimary
              : ReaderUiVisualTokens.bookshelfMuted)
            .height(18)
            .padding({ left: 6, right: 6 })
            .borderRadius(9)
            .backgroundColor(isLocalBookSourceId(this.sourceId)
              ? ReaderUiVisualTokens.bookshelfEmptySecondarySurface
              : ReaderUiVisualTokens.bookshelfSectionSurface)
          if (this.cacheLabel().length > 0) {
            Text(this.cacheLabel())
              .fontSize(10)
              .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
              .fontColor(this.cacheReadable()
                ? ReaderUiVisualTokens.bookshelfActionPrimary
                : ReaderUiVisualTokens.bookshelfMuted)
              .height(18)
              .padding({ left: 6, right: 6 })
              .border({
                width: this.cacheReadable() ? 0 : 1,
                color: ReaderUiVisualTokens.bookshelfBorder,
              })
              .borderRadius(9)
              .backgroundColor(this.cacheReadable()
                ? ReaderUiVisualTokens.bookshelfEmptySecondarySurface
                : Color.Transparent)
          }
        }
        .width('100%')
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .height(58)
      .justifyContent(FlexAlign.Center)

      Column() {
        Image($r('app.media.reader_icon_more_dark'))
          .width(20)
          .height(20)
      }
      .width(34)
      .height(34)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .height(72)
    .alignItems(VerticalAlign.Center)
  }
}

// The demo's list route is semantically distinct from the cover grid.  Both
// consume the same Core-backed book records so switching view never falls
// back to fixture-only navigation.
@Component
export struct BookList {
  @Prop books: BookEntry[] = [];

  build() {
    List({ space: 0 }) {
      ForEach(this.books,
        (book: BookEntry, index: number) => {
          ListItem() {
            BookListRow({
              sourceId: book.sourceId ?? '',
              bookId: book.bookId,
              title: book.title,
              author: book.author,
              coverKey: book.coverKey,
              coverUrl: book.coverUrl ?? '',
              latestChapter: book.latestChapter ?? '',
              cacheStatus: book.cacheStatus ?? 'unknown',
            })
          }
        }, (book: BookEntry, index: number) => `${book.bookId}-${book.title}-${index}`)
    }
    .width('100%')
  }
}

// Figma State/BookshelfEmpty (286:31). The fixed 352×350 component is centered
// by BookshelfShelfSection; every color, type value, and surface comes from the
// generated Figma token ledger. The two action owners are explicitly bound by
// the F0 crosswalk: system multi-file picker and existing book-search route.
@Component
export struct BookshelfEmptyState {
  private openLocalImport(): void {
    ReaderUiStore.dispatch({ type: 'source-import-open' });
  }

  private openBookSearch(): void {
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-search' });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column()
          .width(72)
          .height(52)
          .border({ width: 1, color: ReaderUiVisualTokens.bookshelfEmptyBorder })
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.bookshelfEmptySurface)
          .rotate({ angle: -8 })
          .position({ x: 6, y: 32 })
        Column()
          .width(72)
          .height(52)
          .border({ width: 1, color: ReaderUiVisualTokens.bookshelfEmptyBorder })
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.bookshelfEmptySurface)
          .rotate({ angle: 8 })
          .position({ x: 34, y: 32 })
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.figma_bookshelf_empty_icon'))
            .width(32)
            .height(32)
        }
        .width(ReaderUiVisualTokens.bookshelfEmptyIconShellSize)
        .height(ReaderUiVisualTokens.bookshelfEmptyIconShellSize)
        .border({ width: 1, color: ReaderUiVisualTokens.bookshelfEmptyIconShellStroke })
        .borderRadius(ReaderUiVisualTokens.bookshelfEmptyIconShellRadius)
        .backgroundColor(ReaderUiVisualTokens.bookshelfEmptyIconShellSoft)
        .position({ x: 25, y: 8 })
      }
      .width(ReaderUiVisualTokens.bookshelfEmptyVisualWidth)
      .height(ReaderUiVisualTokens.bookshelfEmptyVisualHeight)
      .position({ x: 120, y: 28 })

      Text('书架还是空的')
        .fontSize(ReaderUiVisualTokens.bookshelfEmptyTitleSize)
        .fontWeight(700)
        .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfEmptyTitleInk)
        .lineHeight(23)
        .position({ x: 119, y: 138 })

      Text('导入本地书籍或通过搜索加入书架。')
        .fontSize(ReaderUiVisualTokens.bookshelfEmptyBodySize)
        .fontWeight(400)
        .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
        .fontColor(ReaderUiVisualTokens.bookshelfEmptyBodyInk)
        .lineHeight(16)
        .position({ x: 72, y: 174 })

      Stack({ alignContent: Alignment.TopStart }) {
        Text('导入本地书籍')
          .fontSize(13)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfEmptyPrimaryLabel)
          .lineHeight(16)
          .position({ x: 14, y: 18 })
      }
      .width(316)
      .height(ReaderUiVisualTokens.bookshelfEmptyActionHeight)
      .borderRadius(ReaderUiVisualTokens.bookshelfEmptyActionRadius)
      .backgroundColor(ReaderUiVisualTokens.bookshelfEmptyPrimarySurface)
      .position({ x: ReaderUiVisualTokens.bookshelfEmptyActionHorizontalInset, y: 220 })
      .onClick(() => this.openLocalImport())
      .accessibilityText('导入本地书籍')
      .accessibilityDescription('打开系统文件选择器，可多选')

      Stack({ alignContent: Alignment.TopStart }) {
        Text('搜索并加入书架')
          .fontSize(13)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.bookshelfControlFontFamily)
          .fontColor(ReaderUiVisualTokens.bookshelfEmptySecondaryInk)
          .lineHeight(16)
          .position({ x: 14, y: 18 })
      }
      .width(316)
      .height(ReaderUiVisualTokens.bookshelfEmptyActionHeight)
      .border({ width: 1, color: ReaderUiVisualTokens.bookshelfEmptySecondaryStroke })
      .borderRadius(ReaderUiVisualTokens.bookshelfEmptyActionRadius)
      .backgroundColor(ReaderUiVisualTokens.bookshelfEmptySecondarySurface)
      .position({ x: ReaderUiVisualTokens.bookshelfEmptyActionHorizontalInset, y: 282 })
      .onClick(() => this.openBookSearch())
      .accessibilityText('搜索并加入书架')
    }
    .width(ReaderUiVisualTokens.bookshelfEmptyWidth)
    .height(ReaderUiVisualTokens.bookshelfEmptyHeight)
    .border({ width: 1, color: ReaderUiVisualTokens.bookshelfEmptyBorder })
    .borderRadius(ReaderUiVisualTokens.bookshelfEmptyRadius)
    .backgroundColor(ReaderUiVisualTokens.bookshelfEmptySurface)
  }
}
