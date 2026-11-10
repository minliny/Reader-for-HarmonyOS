import { TYPE_SHELF_SELECTION_ACTION, TYPE_SHELF_SELECTION_AUTHOR, TYPE_SHELF_SELECTION_AUTHOR_WIDE, TYPE_SHELF_SELECTION_HEADING, TYPE_SHELF_SELECTION_REMOVE, TYPE_SHELF_SELECTION_TITLE, TYPE_SHELF_SELECTION_TITLE_WIDE } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { APP_HEADER_BAR_HEIGHT } from '../../../ui/foundation/ReaderHeaderMetrics';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { READER_ACTION_MIN_TARGET, ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ShelfBookListDetails } from './ShelfBookListDetails';
import { ShelfBookPresentation } from '../presentation/ShelfBookPresentation';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { NoCoverCover } from '../../../ui/patterns/NoCoverCover';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';

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

  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryInputsChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = 'cover';
  @StorageLink('readerBookshelfSelectedGroup') @Watch('reconcileSelection') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfReadingFilter') @Watch('reconcileSelection') private readingFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('reconcileSelection') private sourceFilter: string = 'all';
  @Prop @Watch('reconcileSelection') books: ShelfBook[] = [];
  @Prop initialSelectedKey: string = '';
  @Prop busy: boolean = false;
  @Prop ready: boolean = true;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onCancel: () => void = (): void => {};
  onRemoveSelected: (keys: string[]) => void = (_keys: string[]): void => {};
  @State private viewportWidth: number = 0;
  @State private selectedKeys: string[] = [];
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  private measurementRevision: number = 0;
  private viewportHeight: number = 0;
  private mounted: boolean = false;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    this.mounted = true;
    this.onGeometryInputsChanged();
    registerReaderFonts(this.getUIContext().getFont());
    if (this.initialSelectedKey.length > 0 && this.hasBookKey(this.initialSelectedKey)) {
      this.selectedKeys = [this.initialSelectedKey];
    }
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.measurements.clear();
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.measurementKey,
      content: (): void => { this.selectionList(); },
      header: (): void => { this.selectionTopBar(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('selection:header', height, presentedKey);
      },
      onFooterHeightChange: (height: number, presentedKey: number): void => {
        this.recordMeasurement('selection:footer', height, presentedKey);
      },
      footer: (): void => { this.removeBar(); },
    }).onAreaChange((_oldValue: Area, newValue: Area): void => {
      if (!this.mounted) return;
      const width = readerPageAreaLength(newValue.width);
      const height = readerPageAreaLength(newValue.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      if (Math.abs(width - this.viewportWidth) < 0.01 && Math.abs(height - this.viewportHeight) < 0.01) return;
      this.viewportWidth = width;
      this.viewportHeight = height;
      this.onGeometryInputsChanged();
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
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .alignListItem(ListItemAlign.Center)
    .scrollBar(BarState.Off);
  }

  @Builder
  private selectionTopBar() {
    Row() {
      this.selectionAction('取消', TextAlign.Start, (): void => this.onCancel());

      Text(`已选择 ${this.selectedKeys.length} 本`)
        .layoutWeight(1)
        .fontFamily(TYPE_SHELF_SELECTION_HEADING.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_HEADING.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1);

      this.selectionAction(this.allSelected() ? '取消全选' : '全选', TextAlign.End, (): void => this.toggleAll());
    }
    .width('100%')
    .height(APP_HEADER_BAR_HEIGHT)
    .padding({ left: 20, right: 20, top: 7, bottom: 7 })
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private selectionAction(label: string, alignment: TextAlign, action: () => void) {
    Button({ type: ButtonType.Normal }) {
      Text(label)
        .width('100%')
        .fontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_ACTION.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .textAlign(alignment)
        .accessibilityLevel('no');
    }
    .width(72).height(44).padding(0).backgroundColor(Color.Transparent).borderRadius(8)
    .enabled(this.selectionInputEnabled())
    .accessibilityText(label)
    .onClick((): void => { if (this.selectionInputEnabled()) action(); });
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
            .shadow({ radius: 26, color: readerAppColor('app.shadow.cover', this.appThemeScheme), offsetX: 0, offsetY: 8 });
        } else {
          NoCoverCover({ coverWidth: this.cardWidth(), coverHeight: this.coverHeight() });
        }

        this.selectionBadge(book, 4);
      }
      .width(this.cardWidth())
      .height(this.coverHeight());

      Text(book.title)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_SELECTION_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_TITLE.fontWeight)
        .fontSize(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.fontSizeFp : TYPE_SHELF_SELECTION_TITLE.fontSizeFp)
        .lineHeight(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.lineHeightFp as number : TYPE_SHELF_SELECTION_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(book.author)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_SELECTION_AUTHOR.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_AUTHOR.fontWeight)
        .fontSize(this.isWide() ? TYPE_SHELF_SELECTION_AUTHOR_WIDE.fontSizeFp : TYPE_SHELF_SELECTION_AUTHOR.fontSizeFp)
        .lineHeight(this.isWide() ? TYPE_SHELF_SELECTION_AUTHOR_WIDE.lineHeightFp as number : TYPE_SHELF_SELECTION_AUTHOR.lineHeightFp as number)
        .fontColor(readerAppColor('app.text.secondary', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.cardWidth())
    .height(this.cardHeight())
    .alignItems(HorizontalAlign.Start)
    .attributeModifier(this.selectionRowAction(book))
    .onClick((): void => this.toggleBook(book));
  }

  @Builder
  private removeBar() {
    Column({ space: 0 }) {
      Stack({ alignContent: Alignment.Center }) {
        // The native button owns input. The sibling keeps the authored
        // disabled opacity separate from the platform button's disabled tint.
        Column({ space: 6 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.reader_danger_trash_theme_night') : $r('app.media.reader_danger_trash'))
              .width(22).height(22).opacity(!this.ready || this.busy ? 0 : 1);
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
        }.width('100%').alignItems(HorizontalAlign.Center)
          .opacity(this.canRemoveSelection() ? 1 : 0.38)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
        Button({ type: ButtonType.Normal }) {}
          .width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent)
          .padding(0).borderRadius(8).backgroundColor(Color.Transparent)
          .accessibilityText('移除书架')
          .enabled(this.canRemoveSelection())
          .onClick((): void => this.removeVisibleSelection());
      }.width(74).constraintSize({ minHeight: READER_ACTION_MIN_TARGET });
    }
    .width('100%')
    .padding({ top: 12, bottom: this.bottomInset() })
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(readerAppColor('app.surface.dock', this.appThemeScheme))
    .border({ width: { top: 1 }, color: readerAppColor('app.border.control', this.appThemeScheme) })
    .borderRadius({ topLeft: 24, topRight: 24 })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private onGeometryInputsChanged(): void {
    if (!this.mounted) return;
    this.measurementKey += 1;
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.measurementKey || height <= 0) return;
    if (this.measurements.record(slot, height, presentedKey)) this.refreshGeometry();
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry, { mode: 'contentOffset' });
  }

  private refreshGeometry(): void {
    const input = new ReaderPageGeometryInput(ReaderWindowCoordinator.metrics());
    input.viewportWidth = this.liveWidth();
    input.viewportHeight = this.viewportHeight;
    input.measurementRevision = ++this.measurementRevision;
    input.headerHeight = this.measurements.readForGeneration('selection:header', this.measurementKey, APP_HEADER_BAR_HEIGHT);
    input.contentGap = 12;
    input.contentEndInset = this.removeBarClearance() + 20;
    this.geometry = resolveReaderPageGeometry(input);
  }

  private removeBarClearance(): number {
    return this.measurements.readForGeneration('selection:footer', this.measurementKey,
      12 + READER_ACTION_MIN_TARGET + this.bottomInset());
  }

  private reconcileSelection(): void {
    const visibleKeys = new Set(this.visibleBooks().map((book: ShelfBook): string => this.bookKey(book)));
    this.selectedKeys = this.selectedKeys.filter((key: string): boolean => visibleKeys.has(key));
  }

  private canRemoveSelection(): boolean {
    return this.selectionInputEnabled() && this.selectedKeys.length > 0;
  }

  private removeVisibleSelection(): void {
    if (!this.canRemoveSelection()) return;
    // Protect a click delivered before the Prop watcher has reconciled a
    // book whose progress/group changed underneath an active filter.
    this.reconcileSelection();
    if (this.selectedKeys.length > 0) this.onRemoveSelected(this.selectedKeys.slice());
  }

  private toggleBook(book: ShelfBook): void {
    if (!this.selectionInputEnabled()) return;
    if (!this.hasBookKey(this.bookKey(book))) return;
    const key = this.bookKey(book);
    if (this.selectedKeys.includes(key)) {
      this.selectedKeys = this.selectedKeys.filter((candidate: string): boolean => candidate !== key);
      return;
    }
    this.selectedKeys = [...this.selectedKeys, key];
  }

  private toggleAll(): void {
    if (!this.selectionInputEnabled()) return;
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

  private selectionInputEnabled(): boolean {
    return this.mounted && this.ready && !this.busy && (this.isInputAllowed?.() ?? true);
  }

  private selectionRowAction(book: ShelfBook): ReaderActionAccessibility {
    const selected = this.isSelected(book);
    return new ReaderActionAccessibility(`${book.title}，${selected ? '已选择' : '未选择'}`, this.selectionInputEnabled(), selected);
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
        this.selectionBadge(book, 2);
      }
      .width(48)
      .height(80);
      ShelfBookListDetails({ book }).layoutWeight(1).constraintSize({ minWidth: 0 });
    }
    .width(this.gridWidth())
    .height(80)
    .alignItems(VerticalAlign.Center)
    .attributeModifier(this.selectionRowAction(book))
    .onClick((): void => this.toggleBook(book));
  }

  @Builder
  private selectionBadge(book: ShelfBook, inset: number) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.isSelected(book)) {
        Image(readerActionIcon('check', this.appThemeScheme)).width(14).height(14).objectFit(ImageFit.Contain);
      }
    }
    .width(22).height(22).margin({ right: inset, bottom: inset })
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
}
