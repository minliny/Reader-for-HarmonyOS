// BookshelfComponents — bookshelf skeleton ported from render-runtime.js
// mainTabBookshelf() DOM: .fd-continue-card → .fd-bookshelf-shelf-section
// (wrapper, gap 10: .fd-section-head [h2 + 4 view-action buttons] + .fd-book-grid).
// NO ShelfChipGroup on bookshelf (the chips were invented, not in demo).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';

// Book entry passed from ViewStateRenderer (extracted from fixture BookCard children).
export interface BookEntry {
  bookId: string;
  title: string;
  author: string;
  coverKey: string;
}

interface BookshelfFilterOption {
  label: string;
  value: string;
  active: boolean;
}

// A bookId is loadable when it is a real source path (e.g. '/book/123' or a
// full 'https://...' URL). Fixture ids like 'bk-001' are NOT loadable —
// BookSourceRegistry.buildDetailUrl would produce an invalid URL. Guard with
// this so fixture-only flows just route-push (showing fixture content) while
// real search-result bookIds trigger the actual Host HTTP load.
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

// .fd-continue-card: grid 62px 1fr 82px; gap 14; min-height 100; padding 10 16.
//   cover (.fd-continue-cover-button): 62px, aspect 2/3, radius-sm, clickable.
//   div: h2 "继续阅读" (13/900 primary) + strong (serif 20) + span author (14 muted).
//   button (.fd-continue-action-button) "阅读": min 74×40, pill, primary, 13/800.
// Click dispatches route-push immersive-reading, then — only when bookId is a loadable
// source path — book-detail-load(bookId, loadFirstChapter) which populates
// currentBook and then reads the first chapter for the immersive reader route. Fixture
// ids (bk-001) skip the load and the reader shows its fixture fallback
// paragraphs.
@Component
export struct ContinueReadingCard {
  @Prop bookId: string = '';
  @Prop title: string = '长夜余火';
  @Prop author: string = '爱潜水的乌贼';
  @Prop coverKey: string = 'longNight';

  build() {
    Row() {
      Stack() {
        Image(bookshelfCoverResource(this.coverKey))
          .width('100%').height('100%')
          .objectFit(ImageFit.Cover)
      }
      .width(62)
      .aspectRatio(2 / 3)
      .borderRadius(DemoAliasTokens.radiusMd)
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
    ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
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
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.bookshelfFilter.view') bookshelfView: string = 'cover';

  build() {
    Row() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
      Blank()
      Row({ space: 8 }) {
        Column() {
          Image($r('app.media.bookshelf_icon_grid_primary'))
            .width(20)
            .height(20)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-cover-mode' }))
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: this.bookshelfView === 'cover' ? ColorTokens.primary : ColorTokens.border })
        .onClick(() => {
          MotionAdapter.apply('bookshelf.view.switch', this.reducedMotion, () => {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: 'cover' });
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-cover-mode' });
          });
        })

        Column() {
          Image($r('app.media.bookshelf_icon_list_dark'))
            .width(20)
            .height(20)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-list-mode' }))
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: this.bookshelfView === 'list' ? ColorTokens.primary : ColorTokens.border })
        .onClick(() => {
          MotionAdapter.apply('bookshelf.view.switch', this.reducedMotion, () => {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: 'list' });
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-list-mode' });
          });
        })

        Column() {
          Image($r('app.media.bookshelf_icon_filter_dark'))
            .width(20)
            .height(20)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'sort-filter' }))
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: ColorTokens.border })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'sort-filter' }))

        Column() {
          Image($r('app.media.bookshelf_icon_gear_dark'))
            .width(20)
            .height(20)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'bookshelf-search-settings' }))
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: ColorTokens.border })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'bookshelf-search-settings' }))
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
  @Prop filterOpen: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        ShelfSectionHeader({ title: this.title })
        BookGrid({ books: this.books })
          .margin({ top: 10 })
      }
      .width('100%')
      if (this.filterOpen) {
        BookshelfFilterPopover()
          .position({ x: 0, y: 48 })
          .zIndex(ZIndexTokens.settingsDropdown)
      }
    }
    .width('100%')
  }
}

@Component
struct BookshelfFilterGroup {
  @Prop title: string = '';
  @Prop options: BookshelfFilterOption[] = [];
  onSelect: (value: string) => void = (_value: string) => {};

  build() {
    Column() {
      Text(this.title)
        .fontSize(12)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
      Flex({ wrap: FlexWrap.Wrap }) {
        ForEach(this.options, (option: BookshelfFilterOption, idx: number) => {
          Text(option.label)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(option.active ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
            .height(30)
            .padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(option.active ? ColorTokens.primary : ColorTokens.metaBg)
            .border({ width: option.active ? 0 : 1, color: ColorTokens.border })
            .margin({ right: 8, top: 8 })
            .onClick(() => this.onSelect(option.value))
        }, (option: BookshelfFilterOption, idx: number) => `${option.label}-${idx}`)
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct BookshelfFilterPopover {
  @StorageProp('reader.bookshelfFilter.group') bookshelfGroup: string = 'all';
  @StorageProp('reader.bookshelfFilter.sort') bookshelfSort: string = 'recent';
  @StorageProp('reader.bookshelfFilter.filters') bookshelfFilters: string[] = [];

  private groupOptions(): BookshelfFilterOption[] {
    const opts: BookshelfFilterOption[] = [
      { label: '全部', value: 'all', active: this.bookshelfGroup === 'all' },
      { label: '默认', value: 'default', active: this.bookshelfGroup === 'default' },
      { label: '本地书', value: 'local', active: this.bookshelfGroup === 'local' },
      { label: '追更', value: 'following', active: this.bookshelfGroup === 'following' },
    ];
    return opts;
  }

  private sortOptions(): BookshelfFilterOption[] {
    const opts: BookshelfFilterOption[] = [
      { label: '最近更新', value: 'recent', active: this.bookshelfSort === 'recent' },
      { label: '阅读进度', value: 'progress', active: this.bookshelfSort === 'progress' },
      { label: '书名', value: 'title', active: this.bookshelfSort === 'title' },
      { label: '作者', value: 'author', active: this.bookshelfSort === 'author' },
    ];
    return opts;
  }

  private filterOptions(): BookshelfFilterOption[] {
    const filters = this.bookshelfFilters;
    const opts: BookshelfFilterOption[] = [
      { label: '全部', value: 'all', active: filters.length === 0 },
      { label: '未读', value: 'unread', active: filters.indexOf('unread') >= 0 },
      { label: '已完结', value: 'completed', active: filters.indexOf('completed') >= 0 },
      { label: '更新失败', value: 'failed', active: filters.indexOf('failed') >= 0 },
    ];
    return opts;
  }

  build() {
    Column() {
      BookshelfFilterGroup({
        title: '分组',
        options: this.groupOptions(),
        onSelect: (value: string) => {
          ReaderUiStore.dispatch({ type: 'set-bookshelf-group', bookshelfGroup: value });
        },
      })
      BookshelfFilterGroup({
        title: '排序',
        options: this.sortOptions(),
        onSelect: (value: string) => {
          ReaderUiStore.dispatch({ type: 'set-bookshelf-sort', bookshelfSort: value });
        },
      })
        .margin({ top: 12 })
      BookshelfFilterGroup({
        title: '筛选',
        options: this.filterOptions(),
        onSelect: (value: string) => {
          // 'all' clears filters (toggle off each). Simplified: toggle 'all'
          // has no effect since reducer treats it as a regular tag; the
          // active flag for 'all' is computed as filters.length === 0.
          if (value !== 'all') {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-filter-toggle', bookshelfFilterToggle: value });
          }
        },
      })
        .margin({ top: 12 })
    }
    .width('100%')
    .padding(14)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 6 })
    .alignItems(HorizontalAlign.Start)
  }
}

// .fd-book-cover-frame: width 100%, aspect 2/3, radius-md(8), surface, soft-shadow.
@Component
export struct BookCover {
  @Prop coverKey: string = 'threeBody';

  build() {
    Stack() {
      Image(bookshelfCoverResource(this.coverKey))
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
  @Prop title: string = '长夜余火';
  @Prop author: string = '爱潜水的乌贼';
  @Prop coverKey: string = 'longNight';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column() {
      BookCover({ coverKey: this.coverKey })
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
      MotionAdapter.apply('card.press', this.reducedMotion, () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
        // Guard: only dispatch book-detail-load when bookId is a loadable source
        // path. Fixture ids (bk-001) would produce an invalid URL via
        // BookSourceRegistry.buildDetailUrl and leave the detail page stuck on
        // loading (reducer sets pageState='loading' but the HTTP fails with a
        // non-retryable-looking error).
        if (isLoadableBookId(this.bookId)) {
          ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookId });
        }
      });
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
    { bookId: 'bk-demo-1', title: '长夜余火', author: '爱潜水的乌贼', coverKey: 'longNight' },
    { bookId: 'bk-demo-2', title: '诡秘之主', author: '爱潜水的乌贼', coverKey: 'mysteryLord' },
    { bookId: 'bk-demo-3', title: '明朝那些事儿', author: '当年明月', coverKey: 'brightMoon' },
  ];

  build() {
    Grid() {
      ForEach(this.books.length > 0 ? this.books : this.demoBooks, (b: BookEntry, i: number) => {
        GridItem() {
          BookCard({ bookId: b.bookId, title: b.title, author: b.author, coverKey: b.coverKey })
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

// .fd-book-grid.is-list-view: single column; each row is a 48px cover +
// minmax(0, 1fr) info row, min-height 66, gap 10, padding 8 12, border-top 1.
// Cover is 48×72 (shorter than grid-mode cover) per spec.
@Component
export struct BookListRow {
  @Prop cover: Resource | undefined = undefined;
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop latestChapter: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Row({ space: 10 }) {
      // 48×72 封面（列表模式封面比网格模式矮）
      Image(this.cover ?? $r('app.media.bookshelf_cover_long_night'))
        .width(48)
        .height(72)
        .borderRadius(DemoAliasTokens.radiusSm)
        .objectFit(ImageFit.Cover)
      Column({ space: 4 }) {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.author)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.latestChapter !== '') {
          Text(this.latestChapter)
            .fontSize(11)
            .fontColor(ColorTokens.primary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .constraintSize({ minHeight: 66 })
    .padding({ left: 12, right: 12, top: 8, bottom: 8 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => {
      MotionAdapter.apply('listRow.select', this.reducedMotion, () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
      });
    })
  }
}

// .fd-bookshelf-empty-state: min-height 350, centered Column.
// .fd-bookshelf-empty-visual: 112×92 graphic simulated with a Stack of rounded
// rectangles. Title 16/800 serif, subtitle 12 muted. Two pill actions ("去发现"
// primary, "导入本地" ghost). Three 10px muted hints below.
@Component
export struct BookshelfEmptyState {
  build() {
    Column({ space: 14 }) {
      // 112×92 图形：用 Stack + 几个圆角矩形模拟书堆
      Stack({ alignContent: Alignment.Center }) {
        Row({ space: 6 }) {
          Column()
            .width(34)
            .height(70)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
          Column()
            .width(34)
            .height(78)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBg)
            .border({ width: 1, color: ColorTokens.border })
            .margin({ bottom: 8 })
          Column()
            .width(34)
            .height(64)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.surfaceSoft)
            .border({ width: 1, color: ColorTokens.border })
        }
        .alignItems(VerticalAlign.Bottom)
      }
      .width(112)
      .height(92)

      Text('书架还空着')
        .fontSize(16)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
        .fontFamily(ReaderTypography.serifFamily())

      Text('从发现页添加你感兴趣的书')
        .fontSize(12)
        .fontColor(ColorTokens.muted)

      Row({ space: 10 }) {
        Text('去发现')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(40)
          .padding({ left: 20, right: 20 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primaryDark)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'discover' }))
        Text('导入本地')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ColorTokens.primary)
          .height(40)
          .padding({ left: 20, right: 20 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
      }

      Column({ space: 4 }) {
        Text('· 支持 EPUB / TXT 格式')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
        Text('· 支持书源规则')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
        Text('· 支持 WebDAV 同步')
          .fontSize(10)
          .fontColor(ColorTokens.muted)
      }
      .margin({ top: 6 })
    }
    .width('100%')
    .constraintSize({ minHeight: 350 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({ top: 40, bottom: 40 })
  }
}
