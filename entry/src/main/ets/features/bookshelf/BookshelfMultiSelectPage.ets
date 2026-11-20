import { TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_STATUS } from '../common/ReaderTypography';
import { BOOKSHELF_GRID_TEXT_GAP } from './BookshelfGridSpec';
import { BOOKSHELF_COVER_SHADOW_RADIUS, BOOKSHELF_COVER_SHADOW_OFFSET_Y } from './BookshelfCoverVisual';
import { ReaderActionAccessibility } from '../common/ReaderActionAccessibility';
import { TYPE_SHELF_SELECTION_ACTION, TYPE_SHELF_SELECTION_AUTHOR, TYPE_SHELF_SELECTION_AUTHOR_WIDE, TYPE_SHELF_SELECTION_HEADING, TYPE_SHELF_SELECTION_REMOVE, TYPE_SHELF_SELECTION_TITLE, TYPE_SHELF_SELECTION_TITLE_WIDE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderFrameStyle, readerFrameStyle } from '../common/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../common/ReaderScrollLayout';
import { readerActionIcon } from '../common/ReaderActionIconResources';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from './ShelfBookPresentation';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import { registerReaderFonts } from '../common/ReaderFonts';
import { NoCoverCover } from './NoCoverCover';
import { readerPageContentStartInset } from '../common/ReaderPageShell';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../common/ReaderPageGeometry';
import { readerIsExpandedWidth } from '../common/ReaderWidthClass';
import {
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_SCREEN_INSET,
  TOK_SPACE_MD,
} from '../common/ReaderTokens';
import { bookshelfGridFrame } from './BookshelfGridSpec';
import type { BookshelfGridFrame } from './BookshelfGridSpec';

const GRID_ROW_GAP = TOK_SPACE_MD;

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
  @StorageLink('readerBookshelfSourceFilter') @Watch('reconcileSelection') private sourceFilter: string = 'all';
  @Prop @Watch('reconcileSelection') books: ShelfBook[] = [];
  @Prop initialSelectedKey: string = '';
  @Prop busy: boolean = false;
  @Prop ready: boolean = true;
  onCancel: () => void = (): void => {};
  onRemoveSelected: (keys: string[]) => void = (_keys: string[]): void => {};
  @State private viewportWidth: number = 0;
  @State private selectedKeys: string[] = [];
  @State private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    if (this.initialSelectedKey.length > 0 && this.hasBookKey(this.initialSelectedKey)) {
      this.selectedKeys = [this.initialSelectedKey];
    }
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.pageGeometry(),
      headerMeasurementKey: this.measurementGeneration(),
      footerMeasurementKey: this.measurementGeneration(),
      content: (): void => { this.selectionList(); },
      header: (): void => { this.selectionTopBar(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        if (height > 0 && this.measurements.record('selection:header', height, presentedKey))
          this.measurementRevision += 1;
      },
      onFooterHeightChange: (height: number): void => {
        if (height > 0 && this.measurements.record('selection:footer', height, this.measurementGeneration()))
          this.measurementRevision += 1;
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
          Row({ space: this.gridFrame().columnGap }) {
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
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .alignListItem(ListItemAlign.Center)
    .scrollBar(BarState.Off);
  }

  @Builder
  private selectionTopAction(label: string, accessibilityLabel: string, enabled: boolean,
    alignEnd: boolean, action: () => void) {
    Row() {
      Text(label)
        .fontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_ACTION.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
    }
    .width(72)
    .height(44)
    .justifyContent(alignEnd ? FlexAlign.End : FlexAlign.Start)
    .alignItems(VerticalAlign.Center)
    .attributeModifier(new ReaderActionAccessibility(accessibilityLabel, enabled))
    .onClick((): void => {
      if (enabled) action();
    });
  }

  @Builder
  private selectionTopBar() {
    Row() {
      this.selectionTopAction('取消', '取消多选', !this.busy && this.ready, false,
        (): void => this.onCancel());
      Text(`已选择 ${this.selectedKeys.length} 本`)
        .layoutWeight(1)
        .fontFamily(TYPE_SHELF_SELECTION_HEADING.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_HEADING.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1);

      this.selectionTopAction(this.allSelected() ? '取消全选' : '全选',
        this.allSelected() ? '取消全选' : '全选', !this.busy && this.ready, true,
        (): void => this.toggleAll());
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 20, right: 20, top: 7, bottom: 7 })
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private selectionCard(book: ShelfBook) {
    Column({ space: BOOKSHELF_GRID_TEXT_GAP }) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        if (this.hasCover(book)) {
          Image(book.coverUrl as string)
            .width(this.cardWidth())
            .height(this.coverHeight())
            .objectFit(ImageFit.Cover)
            .borderRadius(8)
            .shadow({ radius: BOOKSHELF_COVER_SHADOW_RADIUS, color: readerAppColor('app.shadow.cover', this.appThemeScheme),
              offsetX: 0, offsetY: BOOKSHELF_COVER_SHADOW_OFFSET_Y });
        } else {
          NoCoverCover({ coverWidth: this.cardWidth(), coverHeight: this.coverHeight() });
        }

        Stack({ alignContent: Alignment.Center }) {
          if (this.isSelected(book)) {
            Image(readerActionIcon('check', this.appThemeScheme))
              .width(14).height(14).objectFit(ImageFit.Contain);
          }
        }
        .width(22)
        .height(22)
        .margin({ right: 4, bottom: 4 })
        .backgroundColor(this.isSelected(book) ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('app.surface.menuSolid', this.appThemeScheme))
        .border({ width: this.isSelected(book) ? 0 : 1.5, color: readerAppColor('app.border.control', this.appThemeScheme) })
        .borderRadius(11)
        .shadow({ radius: 4, color: readerAppColor('app.shadow.control', this.appThemeScheme), offsetX: 0, offsetY: 2 });
      }
      .width(this.cardWidth())
      .height(this.coverHeight());

      Text(book.title)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_LIST_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_TITLE.fontWeight)
        .fontSize(TYPE_SHELF_LIST_TITLE.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_TITLE.lineHeightFp}fp`)
        .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_LIST_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_LIST_AUTHOR.fontWeight)
        .fontSize(TYPE_SHELF_LIST_AUTHOR.fontSizeFp)
        .lineHeight(`${TYPE_SHELF_LIST_AUTHOR.lineHeightFp}fp`)
        .fontColor(readerAppColor('app.text.secondary', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      if (ShelfBookPresentation.progress(book, 'grid-caption').length > 0) {
        Text(ShelfBookPresentation.progress(book, 'grid-caption'))
          .width(this.cardWidth()).fontFamily(TYPE_SHELF_LIST_STATUS.fontFamily)
          .fontWeight(TYPE_SHELF_LIST_STATUS.fontWeight).fontSize(TYPE_SHELF_LIST_STATUS.fontSizeFp)
          .lineHeight(`${TYPE_SHELF_LIST_STATUS.lineHeightFp}fp`)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).maxLines(1);
      }
    }
    .width(this.cardWidth())
    .height(this.cardHeight(book))
    .alignItems(HorizontalAlign.Start)
    .attributeModifier(new ReaderActionAccessibility(`${book.title}，${book.author}`, !this.busy && this.ready, this.isSelected(book)))
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
        Stack({ alignContent: Alignment.Center }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.reader_danger_trash_theme_night') : $r('app.media.reader_danger_trash')).width(22).height(22)
            .opacity(!this.ready || this.busy ? 0 : 1);
          if (!this.ready || this.busy) {
            LoadingProgress().width(18).height(18).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
          }
        }.width(22).height(22);
        Text('移除书架')
          .fontFamily(TYPE_SHELF_SELECTION_REMOVE.fontFamily)
          .fontWeight(TYPE_SHELF_SELECTION_REMOVE.fontWeight)
          .fontSize(TYPE_SHELF_SELECTION_REMOVE.fontSizeFp)
          .lineHeight(TYPE_SHELF_SELECTION_REMOVE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_DOWNLOAD_DANGER', this.appThemeScheme));
      }
      .width(74)
      .alignItems(HorizontalAlign.Center)
      .opacity(this.selectedKeys.length > 0 && !this.busy && this.ready ? 1 : 0.38)
      .attributeModifier(new ReaderActionAccessibility('移除所选书籍', this.selectedKeys.length > 0 && !this.busy && this.ready))
      .onClick((): void => this.removeVisibleSelection());
    }
    .width('100%')
    .padding({ top: 12, bottom: this.bottomInset() })
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('app.surface.dock', this.appThemeScheme))
    .border({ width: { top: 1 }, color: readerAppColor('app.border.control', this.appThemeScheme) })
    .borderRadius({ topLeft: 24, topRight: 24 })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry(), { mode: 'contentOffset' });
  }

  private pageGeometry(): ReaderPageGeometry {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.viewportWidth = this.liveWidth();
    input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.measurements.read('selection:header', readerPageContentStartInset());
    input.contentGap = 12;
    input.contentEndInset = this.removeBarClearance() + 20;
    return resolveReaderPageGeometry(input);
  }

  private removeBarClearance(): number {
    return this.measurements.read('selection:footer', 12 + 22 + 6 + 13.31 + this.bottomInset());
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
    return ShelfBookPresentation.visible(this.books, this.storedSelectedGroup, 'all', this.sourceFilter);
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
    .constraintSize({ minHeight: 80 })
    .alignItems(VerticalAlign.Center)
    .attributeModifier(new ReaderActionAccessibility(`${book.title}，${book.author}`, !this.busy && this.ready, this.isSelected(book)))
    .onClick((): void => {
      if (!this.busy && this.ready) this.toggleBook(book);
    });
  }

  @Builder
  private selectionBadge(book: ShelfBook) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.isSelected(book)) {
        Image(readerActionIcon('check', this.appThemeScheme)).width(14).height(14).objectFit(ImageFit.Contain);
      }
    }
    .width(22).height(22).margin({ right: 2, bottom: 2 })
    .backgroundColor(this.isSelected(book) ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('app.surface.menuSolid', this.appThemeScheme))
    .border({ width: this.isSelected(book) ? 0 : 1.5, color: readerAppColor('app.border.control', this.appThemeScheme) })
    .borderRadius(11).shadow({ radius: 4, color: readerAppColor('app.shadow.control', this.appThemeScheme), offsetX: 0, offsetY: 2 });
  }

  private isListMode(): boolean {
    return this.storedViewMode === 'list';
  }



  private hasCover(book: ShelfBook): boolean {
    return book.coverUrl !== undefined && book.coverUrl.trim().length > 0;
  }

  private isWide(): boolean {
    return readerIsExpandedWidth(this.liveWidth());
  }

  private liveWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const metricsWidth = ReaderWindowCoordinator.metrics().windowRect.width;
    return this.viewportWidth > 0 ? this.viewportWidth : metricsWidth;
  }

  private gridFrame(): BookshelfGridFrame {
    return bookshelfGridFrame(this.gridContentWidth(this.isWide()), this.isWide());
  }

  private gridContentWidth(expanded: boolean): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      this.liveWidth(),
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(expanded ? TOK_CONTENT_RAIL_W_TABLET : TOK_CONTENT_MAX_W_PHONE,
        TOK_SCREEN_INSET, TOK_SCREEN_INSET, 'center'),
    ).width;
  }

  private gridWidth(): number {
    return this.gridFrame().rowWidth;
  }

  private cardWidth(): number {
    return this.gridFrame().cardWidth;
  }

  private coverHeight(): number {
    return this.gridFrame().coverHeight;
  }

  private cardHeight(book: ShelfBook): number {
    return bookshelfGridFrame(this.gridContentWidth(this.isWide()), this.isWide(),
      ReaderWindowCoordinator.metrics().systemFontScale, ShelfBookPresentation.progress(book, 'grid-caption').length > 0).cardHeight;
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
