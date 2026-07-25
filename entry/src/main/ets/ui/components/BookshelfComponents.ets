// BookshelfComponents — bookshelf skeleton ported from render-runtime.js
// mainTabBookshelf() DOM: .fd-continue-card → .fd-bookshelf-shelf-section
// (wrapper, gap 10: .fd-section-head [h2 + 4 view-action buttons] + .fd-book-grid).
// NO ShelfChipGroup on bookshelf (the chips were invented, not in demo).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { FigmaReadingVisualTokens } from '../tokens/FigmaReadingVisualTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { CoreBookshelfBook, CoreBookGroup } from '../store/ReaderUiState';
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
}

interface BookshelfFilterOption {
  label: string;
  value: string;
  active: boolean;
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
// The cover and list presentation routes own the card through their generated
// ViewState tree; the default and filter routes already include it via their
// own ViewState tree, so embedding it again would duplicate the card.
export function shouldEmbedContinueReadingForBookshelfRoute(routeId: string): boolean {
  return routeId === 'bookshelf-cover-mode' || routeId === 'bookshelf-list-mode';
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
  @Prop bookId: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop coverKey: string = '';
  @StorageProp('reader.continueReadingBook') continueReadingBook: CoreBookshelfBook | null = null;
  @StorageProp('reader.continueReadingLoaded') continueReadingLoaded: boolean = false;
  @StorageProp('reader.continueReadingError') continueReadingError: string = '';
  @StorageProp('reader.settingsToggles.showLocalBookBadge') showLocalBookBadge: boolean = true;

  private coreContinueBook(): CoreBookshelfBook | null {
    return this.continueReadingLoaded ? this.continueReadingBook : null;
  }

  build() {
    Row() {
      if (!this.continueReadingLoaded) {
        Column()
          .width(62)
          .height(93)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
        Column({ space: 8 }) {
          Text('正在读取继续阅读…')
            .fontSize(16)
            .fontWeight(700)
            .fontColor(ColorTokens.ink)
            .fontFamily(ReaderTypography.serifFamily())
          Text('正在从 Core 核验上次阅读位置。')
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .lineHeight(13 * 1.5)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .margin({ left: 14 })
      } else if (this.continueReadingError.length > 0) {
        Column()
          .width(62)
          .height(93)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
        Column({ space: 8 }) {
          Text('继续阅读暂不可用')
            .fontSize(16)
            .fontWeight(700)
            .fontColor(ColorTokens.ink)
            .fontFamily(ReaderTypography.serifFamily())
          Text(this.continueReadingError)
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .lineHeight(13 * 1.5)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .margin({ left: 14 })
      } else if (this.coreContinueBook() === null) {
        Column()
          .width(62)
          .height(93)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
        Column({ space: 8 }) {
          Text('暂无可继续阅读的书籍')
            .fontSize(16)
            .fontWeight(700)
            .fontColor(ColorTokens.ink)
            .fontFamily(ReaderTypography.serifFamily())
          Text('打开并阅读书架中的书籍后会显示在这里。')
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .lineHeight(13 * 1.5)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
        .margin({ left: 14 })
      } else {
        Stack({ alignContent: Alignment.TopEnd }) {
          SourceCoverImage({
            sourceId: this.coreContinueBook()?.sourceId ?? '',
            coverUrl: this.coreContinueBook()?.coverUrl ?? '',
          })
          if (this.showLocalBookBadge && this.coreContinueBook()?.sourceId === 'local') {
            LocalBookBadge()
              .margin({ top: 5, right: 5 })
          }
        }
        .width(62)
        .height(93)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .onClick(() => this.openReader())

        Column() {
          Text('继续阅读')
            .fontSize(13)
            .fontWeight(900)
            .fontColor(ColorTokens.primary)
            .fontFamily(ReaderTypography.sansFamily())
          Text(this.coreContinueBook()?.title ?? '未命名书籍')
            .fontSize(20)
            .fontWeight(700)
            .fontColor(ColorTokens.ink)
            .fontFamily(ReaderTypography.serifFamily())
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 6 })
          if ((this.coreContinueBook()?.author ?? '').length > 0) {
            Text(this.coreContinueBook()?.author ?? '')
              .fontSize(14)
              .fontColor(ColorTokens.muted)
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
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .backgroundColor(ColorTokens.primary)
          .borderRadius(DemoAliasTokens.radiusPill)
          .height(40)
          .padding({ left: 14, right: 14 })
          .onClick(() => this.openReader())
      }
    }
    .width('100%')
    .height(100)
    .padding({ top: 10, bottom: 10, left: 16, right: 16 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(VerticalAlign.Center)
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
//   min-height 38. h2 "我的书架" 15/700. view-actions: 4 buttons (grid/list/
//   filter/gear), each 34×34 circle with 20×20 fd-small-icon.
@Component
export struct ShelfSectionHeader {
  @Prop title: string = '我的书架';
  @Prop viewMode: string = 'cover';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
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
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: this.viewMode === 'cover' ? ColorTokens.primary : ColorTokens.border })
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
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: this.viewMode === 'list' ? ColorTokens.primary : ColorTokens.border })
        .onClick(() => {
          MotionAdapter.apply('bookshelf.view.switch', this.reducedMotion, this.getUIContext(), () => {
            ReaderUiStore.dispatch({ type: 'set-bookshelf-view', bookshelfView: 'list' });
            ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf-list-mode' });
          });
        })

        // 筛选：route-push 到 sort-filter 路由
        Column() {
          Image($r('app.media.bookshelf_icon_filter_dark'))
            .width(20)
            .height(20)
        }
        .width(34).height(34)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.surface)
        .border({ width: 1, color: this.overlayKind === 'sort-filter' ? ColorTokens.primary : ColorTokens.border })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'sort-filter' }))

        // 书架搜索设置：合法的 route-push（SettingsShell 路由）
        Column() {
          Image($r('app.media.bookshelf_icon_gear_dark'))
            .width(20)
            .height(20)
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
  @Prop viewMode: string = 'cover';
  @Prop filterOpen: boolean = false;
  @StorageProp('reader.overlay') overlayKind: string = '';
  @StorageProp('reader.bookshelfBooks') coreBooks: CoreBookshelfBook[] = [];
  @StorageProp('reader.bookshelfLoaded') bookshelfLoaded: boolean = false;
  @StorageProp('reader.bookshelfFilter.group') bookshelfGroup: string = 'all';

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
      });
    }
    return result;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        ShelfSectionHeader({ title: this.title, viewMode: this.viewMode })
        if (!this.bookshelfLoaded) {
          BookshelfLoadingState()
            .margin({ top: 10 })
        } else if (this.coreBooks.length === 0) {
          BookshelfEmptyState({ group: this.bookshelfGroup })
            .margin({ top: 10 })
        } else if (this.viewMode === 'list') {
          BookList({ books: this.displayedBooks() })
            .margin({ top: 10 })
        } else {
          BookGrid({ books: this.displayedBooks() })
            .margin({ top: 10 })
        }
      }
      .width('100%')
      if (this.filterOpen || this.overlayKind === 'sort-filter') {
        BookshelfFilterPopover()
          .position({ x: 0, y: 48 })
          .zIndex(ZIndexTokens.settingsDropdown)
      }
    }
    .width('100%')
  }
}

@Component
struct BookshelfLoadingState {
  build() {
    Column({ space: 14 }) {
      Row({ space: 16 }) {
        ForEach([0, 1, 2], (slot: number) => {
          Column({ space: 8 }) {
            Column()
              .width('100%')
              .aspectRatio(2 / 3)
              .borderRadius(DemoAliasTokens.radiusMd)
              .backgroundColor(ColorTokens.metaBg)
            Row()
              .width('72%')
              .height(12)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
            Row()
              .width('48%')
              .height(10)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.surfaceSoft)
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start)
        }, (slot: number) => `bookshelf-loading-${slot}`)
      }
      .width('100%')
      Text('正在从 Core 读取书架…')
        .fontSize(13)
        .fontColor(ColorTokens.muted)
        .textAlign(TextAlign.Center)
        .width('100%')
    }
    .width('100%')
    .padding({ top: 18, bottom: 18 })
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
  @StorageProp('reader.bookGroups') bookGroups: CoreBookGroup[] = [];

  private groupOptions(): BookshelfFilterOption[] {
    const opts: BookshelfFilterOption[] = [{ label: '全部', value: 'all', active: this.bookshelfGroup === 'all' }];
    for (let index = 0; index < this.bookGroups.length; index++) {
      const group = this.bookGroups[index];
      if (group.groupName.length === 0) continue;
      opts.push({
        label: group.groupName,
        value: group.groupName,
        active: this.bookshelfGroup === group.groupName,
      });
    }
    return opts;
  }

  private sortOptions(): BookshelfFilterOption[] {
    const opts: BookshelfFilterOption[] = [
      { label: '最近阅读', value: 'recent', active: this.bookshelfSort === 'recent' },
      { label: '书名', value: 'title', active: this.bookshelfSort === 'title' },
      { label: '作者', value: 'author', active: this.bookshelfSort === 'author' },
    ];
    return opts;
  }

  private filterOptions(): BookshelfFilterOption[] {
    // Core bookshelf.list has no unread/completed/failed filter DTO.  Keep
    // only the executable clear state instead of letting UI-only tags imply a
    // filtered Core query.
    return [{ label: '全部（Core 未提供状态筛选）', value: 'all', active: this.bookshelfFilters.length === 0 }];
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
          if (value === 'all') ReaderUiStore.dispatch({ type: 'set-bookshelf-filter-clear' });
        },
      })
        .margin({ top: 12 })
    }
    .width('100%')
    .padding(14)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(HorizontalAlign.Start)
  }
}

// Presentation-only local-book marker. Its truth source is the canonical Core
// bookshelf identity (`sourceId=local`); filenames, cover availability and
// fixture ids are deliberately never used as local-book heuristics.
@Component
struct LocalBookBadge {
  build() {
    Text('本地')
      .fontSize(9)
      .fontWeight(800)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(20)
      .padding({ left: 7, right: 7 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primaryDark)
      .textAlign(TextAlign.Center)
  }
}

// .fd-book-cover-frame: width 100%, aspect 2/3, radius-md(8), surface.
// The Figma bookshelf masters do not use a persistent cover elevation.
@Component
export struct BookCover {
  @Prop sourceId: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';
  @Prop showLocalBadge: boolean = true;

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
      if (this.showLocalBadge && this.sourceId === 'local') {
        LocalBookBadge()
          .margin({ top: 7, right: 7 })
      }
    }
    .width('100%')
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: FigmaReadingVisualTokens.shelfCoverShadow, offsetX: 0, offsetY: 8 })
  }
}

// .fd-book-card (cover mode): grid, gap 6. cover + strong (serif 15) + span (12 muted).
// Click dispatches route-push book-detail, then — only when bookId is a
// loadable source path — book-detail-load(bookId) so the reducer pushes the
// route first (pageState resets to default), then the load effect fires on the
// new route (pageState -> loading -> default on success).
@Component
export struct BookCard {
  @Prop sourceId: string = '';
  @Prop bookId: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.settingsToggles.showLocalBookBadge') showLocalBookBadge: boolean = true;

  private canOpen(): boolean {
    return this.bookId.length > 0 && (this.sourceId.length > 0 || isLoadableBookId(this.bookId));
  }

  build() {
    Column() {
      BookCover({
        sourceId: this.sourceId,
        coverKey: this.coverKey,
        coverUrl: this.coverUrl,
        showLocalBadge: this.showLocalBookBadge,
      })
      Text(this.title.length > 0 ? this.title : '未提供书籍信息')
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .fontFamily(ReaderTypography.serifFamily())
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })
      if (this.author.length > 0) {
        Text(this.author)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
    }
    .alignItems(HorizontalAlign.Start)
    .onClick(() => {
      if (!this.canOpen()) return;
      MotionAdapter.apply('card.press', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
        if (this.sourceId.length > 0) {
          ReaderUiStore.dispatch({ type: 'bookshelf-book-open', sourceId: this.sourceId, bookId: this.bookId });
        } else if (isLoadableBookId(this.bookId)) {
          ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookId });
        }
      });
    })
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
  // `coverColumns` is a real reducer-backed setting.  Keep the grid within
  // its declared 1–5 range instead of hardcoding the demo's three columns.
  @StorageProp('reader.coverColumns') coverColumns: number = 3;

  private columnsTemplate(): string {
    const requested = Math.floor(this.coverColumns);
    const columns = requested < 1 ? 1 : (requested > 5 ? 5 : requested);
    let template = '';
    for (let index = 0; index < columns; index++) {
      if (index > 0) template += ' ';
      template += '1fr';
    }
    return template;
  }

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
      .columnsTemplate(this.columnsTemplate())
      .rowsGap(16)
      .columnsGap(30)
      .width('100%')
    }
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
  @Prop sourceId: string = '';
  @Prop bookId: string = '';
  @Prop coverKey: string = '';
  @Prop coverUrl: string = '';
  @Prop title: string = '';
  @Prop author: string = '';
  @Prop latestChapter: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.settingsToggles.showLocalBookBadge') showLocalBookBadge: boolean = true;

  private canOpen(): boolean {
    return this.bookId.length > 0 && (this.sourceId.length > 0 || isLoadableBookId(this.bookId));
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
        if (this.showLocalBookBadge && this.sourceId === 'local') {
          LocalBookBadge()
            .margin({ top: 4, right: 4 })
        }
      }
      .width(48)
      .height(72)
      .borderRadius(DemoAliasTokens.radiusSm)
      .shadow({ radius: 12, color: FigmaReadingVisualTokens.shelfListCoverShadow, offsetX: 0, offsetY: 6 })
      Column({ space: 4 }) {
        Text(this.title.length > 0 ? this.title : '未提供书籍信息')
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.author.length > 0) {
          Text(this.author)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
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
      if (!this.canOpen()) return;
      MotionAdapter.apply('listRow.select', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
        if (this.sourceId.length > 0) {
          ReaderUiStore.dispatch({ type: 'bookshelf-book-open', sourceId: this.sourceId, bookId: this.bookId });
        } else if (isLoadableBookId(this.bookId)) {
          ReaderUiStore.dispatch({ type: 'book-detail-load', bookId: this.bookId });
        }
      });
    })
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
            })
          }
        }, (book: BookEntry, index: number) => `${book.bookId}-${book.title}-${index}`)
    }
    .width('100%')
  }
}

// .fd-bookshelf-empty-state: min-height 350, centered Column.
// .fd-bookshelf-empty-visual: 112×92 graphic simulated with a Stack of rounded
// rectangles. Title 16/800 serif, subtitle 12 muted. Two pill actions ("去发现"
// primary, "导入本地" ghost). Three 10px muted hints below.
@Component
export struct BookshelfEmptyState {
  @Prop group: string = 'all';

  private filteredEmpty(): boolean {
    return this.group !== 'all';
  }

  private title(): string {
    return this.filteredEmpty() ? '当前分组暂无书籍' : '书架还空着';
  }

  private message(): string {
    return this.filteredEmpty()
      ? '其他分组中的书籍不会显示在这里。'
      : '从发现页添加你感兴趣的书';
  }

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

      Text(this.title())
        .fontSize(16)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
        .fontFamily(ReaderTypography.serifFamily())

      Text(this.message())
        .fontSize(12)
        .fontColor(ColorTokens.muted)

      Row({ space: 10 }) {
        if (this.filteredEmpty()) {
          Text('查看全部')
            .fontSize(13)
            .fontWeight(700)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(40)
            .padding({ left: 20, right: 20 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            .textAlign(TextAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-bookshelf-group', bookshelfGroup: 'all' }))
        } else {
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
        }
        Text('导入本地')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ColorTokens.primary)
          .height(40)
          .padding({ left: 20, right: 20 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'source.import.open' }))
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
