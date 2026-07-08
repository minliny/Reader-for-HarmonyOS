// BookshelfComponents — bookshelf skeleton ported from render-runtime.js
// mainTabBookshelf() DOM: .fd-continue-card → .fd-bookshelf-shelf-section
// (wrapper, gap 10: .fd-section-head [h2 + 4 view-action buttons] + .fd-book-grid).
// NO ShelfChipGroup on bookshelf (the chips were invented, not in demo).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

// Book entry passed from ViewStateRenderer (extracted from fixture BookCard children).
export interface BookEntry {
  bookId: string;
  title: string;
  author: string;
}

// A bookId is loadable when it is a real source path (e.g. '/book/123' or a
// full 'https://...' URL). Fixture ids like 'bk-001' are NOT loadable —
// BookSourceRegistry.buildDetailUrl would produce an invalid URL. Guard with
// this so fixture-only flows just route-push (showing fixture content) while
// real search-result bookIds trigger the actual Host HTTP load.
function isLoadableBookId(bookId: string): boolean {
  return bookId.length > 0 && (bookId.startsWith('/') || bookId.startsWith('http'));
}

// .fd-continue-card: grid 62px 1fr 82px; gap 14; min-height 100; padding 10 16.
//   cover (.fd-continue-cover-button): 62px, aspect 2/3, radius-sm, clickable.
//   div: h2 "继续阅读" (13/900 primary) + strong (serif 20) + span author (14 muted).
//   button (.fd-continue-action-button) "阅读": min 74×40, pill, primary, 13/800.
// Click dispatches route-push reader, then — only when bookId is a loadable
// source path — book-detail-load(bookId, loadFirstChapter) which populates
// currentBook and then reads the first chapter for the reader route. Fixture
// ids (bk-001) skip the load and the reader shows its fixture fallback
// paragraphs.
@Component
export struct ContinueReadingCard {
  @Prop bookId: string = '';
  @Prop title: string = '示例书';
  @Prop author: string = '示例作者';

  build() {
    Row() {
      Stack() {
        Image($r('app.media.bookshelf_cover_three_body'))
          .width('100%').height('100%')
          .objectFit(ImageFit.Cover)
      }
      .width(62)
      .aspectRatio(2 / 3)
      .borderRadius(DemoAliasTokens.radiusSm)
      .backgroundColor(ColorTokens.metaBg)
      .onClick(() => this.openReader())

      Column() {
        Text('继续阅读')
          .fontSize(13)
          .fontWeight(900)
          .fontColor(ColorTokens.primary)
          .fontFamily(ReaderTypography.sansFamily())
        Text(this.title)
          .fontSize(20)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 6 })
        Text(this.author)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 14, right: 14 })

      Text('阅读')
        .fontSize(13)
        .fontWeight(800)
        .fontColor(DemoAliasTokens.onPrimary)
        .backgroundColor(ColorTokens.primary)
        .borderRadius(DemoAliasTokens.radiusPill)
        .height(40)
        .padding({ left: 14, right: 14 })
        .onClick(() => this.openReader())
    }
    .width('100%')
    .padding({ top: 10, bottom: 10, left: 16, right: 16 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
  }

  private openReader(): void {
    ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' });
    // Only dispatch book-detail-load when bookId is a loadable source path.
    // Fixture ids (bk-001) skip the load to avoid invalid URL + stuck loading.
    // The reader page's ReadingTextFlow falls back to fixture paragraphs when
    // chapterContent is empty.
    if (isLoadableBookId(this.bookId)) {
      ReaderUiStore.dispatch({
        type: 'book-detail-load',
        bookId: this.bookId,
        loadFirstChapter: true,
      });
    }
  }
}

// .fd-section-head.fd-bookshelf-section-head: flex space-between, gap 12,
//   min-height 38. h2 "我的书架" 15/700. view-actions: 4 buttons (grid/list/
//   filter/gear), each 34×34 circle with 20×20 fd-small-icon.
@Component
export struct ShelfSectionHeader {
  @Prop title: string = '我的书架';

  build() {
    Row() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      Blank()
      Row() {
        Image($r('app.media.reader_icon_more_dark')).width(20).height(20)
        Image($r('app.media.reader_icon_more_dark')).width(20).height(20).margin({ left: 8 })
        Image($r('app.media.reader_icon_more_dark')).width(20).height(20).margin({ left: 8 })
        Image($r('app.media.bookshelf_icon_gear_dark')).width(20).height(20).margin({ left: 8 })
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

  build() {
    Column() {
      ShelfSectionHeader({ title: this.title })
      BookGrid({ books: this.books })
        .margin({ top: 10 })
    }
    .width('100%')
  }
}

// .fd-book-cover-frame: width 100%, aspect 2/3, radius-md(8), surface, soft-shadow.
@Component
export struct BookCover {
  build() {
    Stack() {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width('100%').height('100%')
        .objectFit(ImageFit.Cover)
    }
    .width('100%')
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 6 })
  }
}

// .fd-book-card (cover mode): grid, gap 6. cover + strong (serif 15) + span (12 muted).
// Click dispatches route-push book-detail, then — only when bookId is a
// loadable source path — book-detail-load(bookId) so the reducer pushes the
// route first (pageState resets to default), then the load effect fires on the
// new route (pageState -> loading -> default on success). Fixture ids (bk-001)
// skip the load; the detail page shows its fixture ViewState body.
@Component
export struct BookCard {
  @Prop bookId: string = '';
  @Prop title: string = '三体';
  @Prop author: string = '刘慈欣';

  build() {
    Column() {
      BookCover()
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
      Text(this.author)
        .fontSize(12)
        .fontColor(ColorTokens.muted)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
      // Guard: only dispatch book-detail-load when bookId is a loadable source
      // path. Fixture ids (bk-001) would produce an invalid URL via
      // BookSourceRegistry.buildDetailUrl and leave the detail page stuck on
      // loading (reducer sets pageState='loading' but the HTTP fails with a
      // non-retryable-looking error).
      if (isLoadableBookId(this.bookId)) {
        ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookId });
      }
    })
  }
}

// .fd-book-grid: repeat(3, 1fr); gap 16px 30px.
// Books come from ViewStateRenderer (extracted from fixture BookCard children).
// Falls back to demo entries when no books are passed (e.g. standalone usage or
// fixture missing children) so the grid is never empty.
@Component
export struct BookGrid {
  @Prop books: BookEntry[] = [];
  private demoBooks: BookEntry[] = [
    { bookId: 'bk-demo-1', title: '三体', author: '刘慈欣' },
    { bookId: 'bk-demo-2', title: '基地', author: '阿西莫夫' },
    { bookId: 'bk-demo-3', title: '球状闪电', author: '刘慈欣' },
  ];

  build() {
    Grid() {
      ForEach(this.books.length > 0 ? this.books : this.demoBooks, (b: BookEntry, i: number) => {
        GridItem() {
          BookCard({ bookId: b.bookId, title: b.title, author: b.author })
        }
      }, (b: BookEntry, i: number) => `${b.bookId}-${b.title}-${i}`)
    }
    .columnsTemplate('1fr 1fr 1fr')
    .rowsGap(16)
    .columnsGap(30)
    .width('100%')
  }
}

// .fd-chip-row — NOT used on bookshelf (kept for other routes that may use chips).
@Component
export struct ShelfChipGroup {
  private chips: string[] = ['全部', '在读', '已读', '本地'];
  private active: string = '全部';

  build() {
    Row() {
      ForEach(this.chips, (c: string) => {
        Text(c)
          .fontSize(14)
          .fontWeight(700)
          .fontColor(c === this.active ? DemoAliasTokens.onPrimary : ColorTokens.ink)
          .backgroundColor(c === this.active ? ColorTokens.primary : DemoAliasTokens.surface)
          .borderRadius(DemoAliasTokens.radiusPill)
          .padding({ left: 12, right: 12, top: 8, bottom: 8 })
          .height(34)
          .margin({ right: 8 })
      }, (c: string) => c)
    }
    .width('100%')
    .height(34)
  }
}
