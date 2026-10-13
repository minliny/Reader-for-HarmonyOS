import { TYPE_SHELF_SELECTION_ACTION, TYPE_SHELF_SELECTION_AUTHOR, TYPE_SHELF_SELECTION_AUTHOR_WIDE, TYPE_SHELF_SELECTION_CHECK, TYPE_SHELF_SELECTION_HEADING, TYPE_SHELF_SELECTION_REMOVE, TYPE_SHELF_SELECTION_TITLE, TYPE_SHELF_SELECTION_TITLE_WIDE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from './ShelfBookPresentation';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom } from '../common/ReaderWindowMetrics';
import { registerReaderFonts } from '../common/ReaderFonts';
import { NoCoverCover } from './NoCoverCover';
import { readerPageContentStartInset } from '../common/ReaderPageShell';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';

const WIDE_BREAKPOINT = 600;
const PHONE_GRID_WIDTH = 351;
const PHONE_CARD_WIDTH = 97;
const PHONE_COVER_HEIGHT = 145.44;
const PHONE_CARD_HEIGHT = 191;
const TABLET_GRID_WIDTH = 622;
const TABLET_CARD_WIDTH = 186.67;
const TABLET_COVER_HEIGHT = 280;
const TABLET_CARD_HEIGHT = 325.3;
const GRID_COLUMN_GAP = 30;
const GRID_ROW_GAP = 12;

/**
 * Figma `Bookshelf/MultiSelect` (`2956:1266`). Entry preselects exactly the
 * long-pressed book; top-bar entry starts empty. V1 exposes only remove from
 * bookshelf and deliberately does not reuse the unrelated Core data/group
 * management page.
 */
@Component
export struct BookshelfMultiSelectPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = 'cover';
  @StorageLink('readerBookshelfSelectedGroup') @Watch('reconcileSelection') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfReadingFilter') @Watch('reconcileSelection') private readingFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('reconcileSelection') private sourceFilter: string = 'all';
  @Prop @Watch('reconcileSelection') books: ShelfBook[] = [];
  @Prop initialSelectedKey: string = '';
  @Prop busy: boolean = false;
  @Prop ready: boolean = true;
  onCancel: () => void = (): void => {};
  onRemoveSelected: (keys: string[]) => void = (_keys: string[]): void => {};
  @State private viewportWidth: number = 0;
  @State private selectedKeys: string[] = [];
  @State private removeBarHeight: number = 0;
  @State private selectionHeaderHeight: number = readerPageContentStartInset();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    if (this.initialSelectedKey.length > 0 && this.hasBookKey(this.initialSelectedKey)) {
      this.selectedKeys = [this.initialSelectedKey];
    }
  }

  build() {
    ReaderPageScaffold({
      variant: 'selection', headerKind: 'selection',
      content: (): void => { this.selectionList(); },
      header: (): void => { this.selectionTopBar(); },
      onHeaderHeightChange: (height: number): void => {
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.selectionHeaderHeight) > .1)
          this.selectionHeaderHeight = height;
      },
      footer: (): void => { this.removeBar(); },
    }).onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private selectionList() {
    List({ space: GRID_ROW_GAP }) {
        Repeat(this.bookRows())
          .each((repeatItem: RepeatItem<ShelfBook[]>) => {
          ListItem() {
          Row({ space: GRID_COLUMN_GAP }) {
            ForEach(repeatItem.item, (book: ShelfBook) => {
              if (this.isListMode()) {
                this.selectionListCard(book);
              } else {
                this.selectionCard(book);
              }
            }, (book: ShelfBook): string => `bookshelf-multi-${this.bookKey(book)}`);
          }
          .width(this.gridWidth())
          .alignItems(VerticalAlign.Top);
          }
        })
        .key((row: ShelfBook[]): string =>
          `bookshelf-multi-row-${row.map((book: ShelfBook): string => this.bookKey(book)).join('|')}`)
        .virtualScroll({ reusable: true });
    }
    .height('100%')
    .width('100%')
    .contentStartOffset(this.selectionHeaderHeight + 12)
    .contentEndOffset(this.removeBarClearance() + 20)
    .alignListItem(ListItemAlign.Center)
    .scrollBar(BarState.Off);
  }

  @Builder
  private selectionTopBar() {
    Row() {
      Text('取消')
        .width(72)
        .fontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_ACTION.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionTopBar.fontColor.FF2D4A3E', this.appThemeScheme))
        .onClick((): void => {
          if (!this.busy && this.ready) {
            this.onCancel();
          }
        });

      Text(`已选择 ${this.selectedKeys.length} 本`)
        .layoutWeight(1)
        .fontFamily(TYPE_SHELF_SELECTION_HEADING.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_HEADING.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionTopBar.fontColor.FF1F1B17', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1);

      Text(this.allSelected() ? '取消全选' : '全选')
        .width(72)
        .fontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_ACTION.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionTopBar.fontColor.FF2D4A3E', this.appThemeScheme))
        .textAlign(TextAlign.End)
        .onClick((): void => {
          if (!this.busy && this.ready) {
            this.toggleAll();
          }
        });
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 8, bottom: 8 })
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private selectionCard(book: ShelfBook) {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(this.cardWidth())
            .height(this.coverHeight())
            .objectFit(ImageFit.Cover)
            .borderRadius(8)
            .shadow({ radius: 26, color: readerAppColor('app.BookshelfMultiSelectPage.selectionCard.color.1A594632', this.appThemeScheme), offsetX: 0, offsetY: 8 });
        } else {
          NoCoverCover({ coverWidth: this.cardWidth(), coverHeight: this.coverHeight() });
        }

        Stack({ alignContent: Alignment.Center }) {
          if (this.isSelected(book)) {
            Text('✓')
              .fontFamily(TYPE_SHELF_SELECTION_CHECK.fontFamily)
              .fontWeight(TYPE_SHELF_SELECTION_CHECK.fontWeight)
              .fontSize(TYPE_SHELF_SELECTION_CHECK.fontSizeFp)
              .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionCard.fontColor.FFFFFFFF', this.appThemeScheme))
              .textAlign(TextAlign.Center);
          }
        }
        .width(22)
        .height(22)
        .margin({ right: 4, bottom: 4 })
        .backgroundColor(this.isSelected(book) ? readerAppColor('app.BookshelfMultiSelectPage.selectionCard.backgroundColor.FFF58517', this.appThemeScheme) : readerAppColor('app.BookshelfMultiSelectPage.selectionCard.backgroundColor.FFFFFCF8', this.appThemeScheme))
        .border({ width: this.isSelected(book) ? 0 : 1.5, color: readerAppColor('app.BookshelfMultiSelectPage.selectionCard.color.FFC1C7CD', this.appThemeScheme) })
        .borderRadius(11)
        .shadow({ radius: 4, color: readerAppColor('app.BookshelfMultiSelectPage.selectionCard.color.26000000', this.appThemeScheme), offsetX: 0, offsetY: 2 });
      }
      .width(this.cardWidth())
      .height(this.coverHeight());

      Text(book.title)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_SELECTION_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_TITLE.fontWeight)
        .fontSize(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.fontSizeFp : TYPE_SHELF_SELECTION_TITLE.fontSizeFp)
        .lineHeight(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.lineHeightFp as number : TYPE_SHELF_SELECTION_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionCard.fontColor.FF1F1B17', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_SELECTION_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_AUTHOR.fontWeight)
        .fontSize(this.isWide() ? TYPE_SHELF_SELECTION_AUTHOR_WIDE.fontSizeFp : TYPE_SHELF_SELECTION_AUTHOR.fontSizeFp)
        .lineHeight(this.isWide() ? TYPE_SHELF_SELECTION_AUTHOR_WIDE.lineHeightFp as number : TYPE_SHELF_SELECTION_AUTHOR.lineHeightFp as number)
        .fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionCard.fontColor.FF756F69', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.cardWidth())
    .height(this.cardHeight())
    .alignItems(HorizontalAlign.Start)
    .accessibilityText(`${book.title}，${this.isSelected(book) ? '已选择' : '未选择'}`)
    .onClick((): void => {
      if (!this.busy && this.ready) {
        this.toggleBook(book);
      }
    });
  }

  @Builder
  private removeBar() {
    Column({ space: 0 }) {
      Column({ space: 6 }) {
        Image($r('app.media.bookshelf_multiselect_trash'))
          .width(22)
          .height(22);
        Text(!this.ready ? '正在读取书架' : this.busy ? '正在移除' : '移除书架')
          .fontFamily(TYPE_SHELF_SELECTION_REMOVE.fontFamily)
          .fontWeight(TYPE_SHELF_SELECTION_REMOVE.fontWeight)
          .fontSize(TYPE_SHELF_SELECTION_REMOVE.fontSizeFp)
          .lineHeight(TYPE_SHELF_SELECTION_REMOVE.lineHeightFp as number)
          .fontColor(readerAppColor('app.BookshelfMultiSelectPage.removeBar.fontColor.FFD7473E', this.appThemeScheme));
      }
      .width(74)
      .alignItems(HorizontalAlign.Center)
      .opacity(this.selectedKeys.length > 0 && !this.busy && this.ready ? 1 : 0.38)
      .onClick((): void => this.removeVisibleSelection());
    }
    .width('100%')
    .padding({ top: 12, bottom: this.bottomInset() })
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('app.BookshelfMultiSelectPage.removeBar.backgroundColor.EBFFFCF8', this.appThemeScheme))
    .border({ width: { top: 1 }, color: readerAppColor('app.BookshelfMultiSelectPage.removeBar.color.FFC1C7CD', this.appThemeScheme) })
    .borderRadius({ topLeft: 24, topRight: 24 })
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_old: Area, next: Area): void => {
      const height = this.numericAreaLength(next.height);
      if (height > 0 && Math.abs(height - this.removeBarHeight) > .1) { this.removeBarHeight = height; }
    });
  }

  private removeBarClearance(): number {
    return this.removeBarHeight > 0 ? this.removeBarHeight : 12 + 22 + 6 + 13.31 + this.bottomInset();
  }

  private reconcileSelection(): void {
    const visibleKeys = new Set(this.visibleBooks().map((book: ShelfBook): string => this.bookKey(book)));
    this.selectedKeys = this.selectedKeys.filter((key: string): boolean => visibleKeys.has(key));
  }

  private removeVisibleSelection(): void {
    if (this.busy || !this.ready) return;
    // Protect a click delivered before the Prop watcher has reconciled a
    // book whose progress/group changed underneath an active filter.
    this.reconcileSelection();
    if (this.selectedKeys.length > 0) this.onRemoveSelected(this.selectedKeys.slice());
  }

  private toggleBook(book: ShelfBook): void {
    if (this.busy || !this.ready) return;
    if (!this.hasBookKey(this.bookKey(book))) return;
    const key = this.bookKey(book);
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((candidate: string): boolean => candidate !== key);
      return;
    }
    this.selectedKeys = [...this.selectedKeys, key];
  }

  private toggleAll(): void {
    if (this.busy || !this.ready) return;
    const visible = this.visibleBooks();
    if (this.allSelected()) {
      this.selectedKeys = [];
      return;
    }
    this.selectedKeys = visible.map((book: ShelfBook): string => this.bookKey(book));
  }

  private allSelected(): boolean {
    const visible = this.visibleBooks();
    return visible.length > 0 && visible.every((book: ShelfBook): boolean =>
      this.selectedKeys.includes(this.bookKey(book)));
  }

  private isSelected(book: ShelfBook): boolean {
    return this.selectedKeys.includes(this.bookKey(book));
  }

  private hasBookKey(key: string): boolean {
    return this.visibleBooks().some((book: ShelfBook): boolean => this.bookKey(book) === key);
  }

  private visibleBooks(): ShelfBook[] {
    return ShelfBookPresentation.visible(this.books, this.storedSelectedGroup, this.readingFilter, this.sourceFilter);
  }

  private bookKey(book: ShelfBook): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  private bookRows(): ShelfBook[][] {
    const visible = this.visibleBooks();
    const rows: ShelfBook[][] = [];
    const columnCount = this.isListMode() ? 1 : 3;
    for (let index = 0; index < visible.length; index += columnCount) {
      rows.push(visible.slice(index, index + columnCount));
    }
    return rows;
  }

  @Builder
  private selectionListCard(book: ShelfBook) {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(48)
            .height(80)
            .objectFit(ImageFit.Cover)
            .borderRadius(6);
        } else {
          NoCoverCover({ coverWidth: 48, coverHeight: 80 });
        }
        this.selectionBadge(book);
      }
      .width(48)
      .height(80);
      ShelfBookListDetails({ book }).layoutWeight(1).constraintSize({ minWidth: 0 });
    }
    .width(this.gridWidth())
    .height(80)
    .alignItems(VerticalAlign.Center)
    .accessibilityText(`${book.title}，${this.isSelected(book) ? '已选择' : '未选择'}`)
    .onClick((): void => {
      if (!this.busy && this.ready) this.toggleBook(book);
    });
  }

  @Builder
  private selectionBadge(book: ShelfBook) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.isSelected(book)) {
        Text('✓').fontFamily(TYPE_SHELF_SELECTION_CHECK.fontFamily).fontWeight(TYPE_SHELF_SELECTION_CHECK.fontWeight).fontSize(TYPE_SHELF_SELECTION_CHECK.fontSizeFp).fontColor(readerAppColor('app.BookshelfMultiSelectPage.selectionBadge.fontColor.FFFFFFFF', this.appThemeScheme));
      }
    }
    .width(22).height(22).margin({ right: 2, bottom: 2 })
    .backgroundColor(this.isSelected(book) ? readerAppColor('app.BookshelfMultiSelectPage.selectionBadge.backgroundColor.FFF58517', this.appThemeScheme) : readerAppColor('app.BookshelfMultiSelectPage.selectionBadge.backgroundColor.FFFFFCF8', this.appThemeScheme))
    .border({ width: this.isSelected(book) ? 0 : 1.5, color: readerAppColor('app.BookshelfMultiSelectPage.selectionBadge.color.FFC1C7CD', this.appThemeScheme) })
    .borderRadius(11).shadow({ radius: 4, color: readerAppColor('app.BookshelfMultiSelectPage.selectionBadge.color.26000000', this.appThemeScheme), offsetX: 0, offsetY: 2 });
  }

  private isListMode(): boolean {
    return this.storedViewMode === 'list';
  }



  private hasCover(book: ShelfBook): boolean {
    return book.coverUrl !== undefined && book.coverUrl.trim().length > 0;
  }

  private isWide(): boolean {
    return this.liveWidth() >= WIDE_BREAKPOINT;
  }

  private liveWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const metricsWidth = ReaderWindowCoordinator.metrics().windowRect.width;
    return this.viewportWidth > 0 ? this.viewportWidth : metricsWidth;
  }

  private gridWidth(): number {
    return this.isWide() ? TABLET_GRID_WIDTH : PHONE_GRID_WIDTH;
  }

  private cardWidth(): number {
    return this.isWide() ? TABLET_CARD_WIDTH : PHONE_CARD_WIDTH;
  }

  private coverHeight(): number {
    return this.isWide() ? TABLET_COVER_HEIGHT : PHONE_COVER_HEIGHT;
  }

  private cardHeight(): number {
    return this.isWide() ? TABLET_CARD_HEIGHT : PHONE_CARD_HEIGHT;
  }

  private bottomInset(): number {
    return Math.max(12, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
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
}
