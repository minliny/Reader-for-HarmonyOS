import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom } from '../common/ReaderWindowMetrics';
import { registerReaderFonts } from '../common/ReaderFonts';
import { NoCoverCover } from './NoCoverCover';

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
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop books: ShelfBook[] = [];
  @Prop initialSelectedKey: string = '';
  @Prop busy: boolean = false;
  onCancel: () => void = (): void => {};
  onRemoveSelected: (keys: string[]) => void = (_keys: string[]): void => {};
  @State private viewportWidth: number = 0;
  @State private selectedKeys: string[] = [];

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    if (this.initialSelectedKey.length > 0 && this.hasBookKey(this.initialSelectedKey)) {
      this.selectedKeys = [this.initialSelectedKey];
    }
  }

  build() {
    Column() {
      this.selectionTopBar();
      List({ space: GRID_ROW_GAP }) {
          Repeat(this.bookRows())
            .each((repeatItem: RepeatItem<ShelfBook[]>) => {
            ListItem() {
            Row({ space: GRID_COLUMN_GAP }) {
              ForEach(repeatItem.item, (book: ShelfBook) => {
                this.selectionCard(book);
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
      .layoutWeight(1)
      .width('100%')
      .padding({ top: 12, bottom: 20 })
      .alignListItem(ListItemAlign.Center)
      .scrollBar(BarState.Off);
      this.removeBar();
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC')
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private selectionTopBar() {
    Row() {
      Text('取消')
        .width(72)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(15.6)
        .fontColor('#2D4A3E')
        .onClick((): void => {
          if (!this.busy) {
            this.onCancel();
          }
        });

      Text(`已选择 ${this.selectedKeys.length} 本`)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(34.49)
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center)
        .maxLines(1);

      Text(this.allSelected() ? '取消全选' : '全选')
        .width(72)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(15.6)
        .fontColor('#2D4A3E')
        .textAlign(TextAlign.End)
        .onClick((): void => {
          if (!this.busy) {
            this.toggleAll();
          }
        });
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 8, bottom: 8 })
    .alignItems(VerticalAlign.Center);
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
            .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 });
        } else {
          NoCoverCover({ coverWidth: this.cardWidth(), coverHeight: this.coverHeight() });
        }

        Stack({ alignContent: Alignment.Center }) {
          if (this.isSelected(book)) {
            Text('✓')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Bold)
              .fontSize(14)
              .fontColor('#FFFFFF')
              .textAlign(TextAlign.Center);
          }
        }
        .width(22)
        .height(22)
        .margin({ right: 4, bottom: 4 })
        .backgroundColor(this.isSelected(book) ? '#F58517' : '#FFFCF8')
        .border({ width: this.isSelected(book) ? 0 : 1.5, color: '#C1C7CD' })
        .borderRadius(11)
        .shadow({ radius: 4, color: '#26000000', offsetX: 0, offsetY: 2 });
      }
      .width(this.cardWidth())
      .height(this.coverHeight());

      Text(book.title)
        .width(this.cardWidth())
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(this.isWide() ? 16 : 13)
        .lineHeight(this.isWide() ? 19.5 : 16)
        .fontColor('#1F1B17')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(this.cardWidth())
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(this.isWide() ? 13 : 11)
        .lineHeight(this.isWide() ? 16 : 13.5)
        .fontColor('#756F69')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.cardWidth())
    .height(this.cardHeight())
    .alignItems(HorizontalAlign.Start)
    .accessibilityText(`${book.title}，${this.isSelected(book) ? '已选择' : '未选择'}`)
    .onClick((): void => {
      if (!this.busy) {
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
        Text(this.busy ? '正在移除' : '移除书架')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .lineHeight(13.31)
          .fontColor('#D7473E');
      }
      .width(74)
      .alignItems(HorizontalAlign.Center)
      .opacity(this.selectedKeys.length > 0 && !this.busy ? 1 : 0.38)
      .onClick((): void => {
        if (this.selectedKeys.length > 0 && !this.busy) {
          this.onRemoveSelected(this.selectedKeys.slice());
        }
      });
    }
    .width('100%')
    .padding({ top: 12, bottom: this.bottomInset() })
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#EBFFFCF8')
    .border({ width: { top: 1 }, color: '#C1C7CD' })
    .borderRadius({ topLeft: 24, topRight: 24 });
  }

  private toggleBook(book: ShelfBook): void {
    const key = this.bookKey(book);
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((candidate: string): boolean => candidate !== key);
      return;
    }
    this.selectedKeys = [...this.selectedKeys, key];
  }

  private toggleAll(): void {
    if (this.allSelected()) {
      this.selectedKeys = [];
      return;
    }
    this.selectedKeys = this.books.map((book: ShelfBook): string => this.bookKey(book));
  }

  private allSelected(): boolean {
    return this.books.length > 0 && this.selectedKeys.length === this.books.length;
  }

  private isSelected(book: ShelfBook): boolean {
    return this.selectedKeys.includes(this.bookKey(book));
  }

  private hasBookKey(key: string): boolean {
    return this.books.some((book: ShelfBook): boolean => this.bookKey(book) === key);
  }

  private bookKey(book: ShelfBook): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  private bookRows(): ShelfBook[][] {
    const rows: ShelfBook[][] = [];
    for (let index = 0; index < this.books.length; index += 3) {
      rows.push(this.books.slice(index, index + 3));
    }
    return rows;
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
