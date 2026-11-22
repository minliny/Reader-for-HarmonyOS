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
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../../ui/foundation/ReaderWindowMetrics';
import { prepareReaderFontFamily, readerFontFamilyReady, registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { NoCoverCover, noCoverGlyph } from '../../../ui/patterns/NoCoverCover';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { bookshelfGridFrame, BookshelfGridFrame, BookshelfListTextBudget, BookshelfListTextFrame, prepareBookshelfListTextFonts, bookshelfSelectionCardHeight } from './BookshelfGridSpec';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';

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
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;

  @StorageLink('readerWindowMetricsRevision') @Watch('onGeometryInputsChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerBookshelfViewMode') private storedViewMode: string = 'cover';
  @StorageLink('readerBookshelfSelectedGroup') @Watch('reconcileSelection') private storedSelectedGroup: string = '';
  @StorageLink('readerBookshelfReadingFilter') @Watch('reconcileSelection') private readingFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') @Watch('reconcileSelection') private sourceFilter: string = 'all';
  @StorageLink('readerMangaPresentationRevision') @Watch('onMangaPresentationChanged') private mangaRevision: number = 0;
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
  @State private footerMeasurementKey: number = 0;
  private headerInputs: string = '';
  private footerInputs: string = '';
  @State private headerFontRevision: number = 0;
  @State private listTextFontRevision: number = 0;
  private readonly listTextBudget: BookshelfListTextBudget = new BookshelfListTextBudget();
  private headerFontPreparationGeneration: number = 0;
  private listTextFontGeneration: number = 0;
  private measurementRevision: number = 0;
  private viewportHeight: number = 0;
  private mounted: boolean = false;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.prepareSelectionHeaderFonts();
    this.prepareListTextFonts();
    if (this.initialSelectedKey.length > 0 && this.canRetainSelectedKey(this.initialSelectedKey)) {
      this.selectedKeys = [this.initialSelectedKey];
    }
    this.onGeometryInputsChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.headerFontPreparationGeneration += 1;
    this.listTextFontGeneration += 1;
    this.measurements.clear();
    this.headerInputs = '';
    this.footerInputs = '';
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
      footerMeasurementKey: this.footerMeasurementKey,
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
    .width(this.geometry.content.frame.width)
    .margin({ left: this.geometry.content.frame.left })
    .contentStartOffset(readerScrollStartOffset(this.scrollLayout()))
    .contentEndOffset(readerScrollEndOffset(this.scrollLayout()))
    .alignListItem(ListItemAlign.Center)
    .scrollBar(BarState.Off);
  }

  @Builder
  private selectionTopBar() {
    Column({ space: 0 }) {
      if (this.selectionHeaderInline()) {
        Row() {
          this.selectionAction((): string => '取消', TextAlign.Start, (): void => this.onCancel());
          this.selectionHeading();
          this.selectionAction((): string => this.allSelected() ? '取消全选' : '全选', TextAlign.End, (): void => this.toggleAll());
        }.width('100%').alignItems(VerticalAlign.Center);
      } else {
        this.selectionHeading();
        Row() {
          this.selectionAction((): string => '取消', TextAlign.Start, (): void => this.onCancel());
          Blank().layoutWeight(1);
          this.selectionAction((): string => this.allSelected() ? '取消全选' : '全选', TextAlign.End, (): void => this.toggleAll());
        }.width('100%').alignItems(VerticalAlign.Center);
      }
    }
    .width('100%')
    .constraintSize({ minHeight: APP_HEADER_BAR_HEIGHT })
    .padding({ left: 20, right: 20, top: 7, bottom: 7 })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private selectionHeading() {
    Text(`已选择 ${this.selectedKeys.length} 本`)
      .width(this.selectionHeaderInline() ? undefined : '100%')
      .layoutWeight(this.selectionHeaderInline() ? 1 : 0)
      .fontFamily(TYPE_SHELF_SELECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SHELF_SELECTION_HEADING.fontWeight)
      .fontSize(TYPE_SHELF_SELECTION_HEADING.fontSizeFp)
      .lineHeight(TYPE_SHELF_SELECTION_HEADING.lineHeightFp as number)
      .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
      .textAlign(TextAlign.Center).maxLines(this.selectionHeaderInline() ? 1 : undefined)
      .textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  private prepareSelectionHeaderFonts(): void {
    const generation = ++this.headerFontPreparationGeneration;
    void Promise.all([prepareReaderFontFamily(TYPE_SHELF_SELECTION_HEADING.fontFamily),
      prepareReaderFontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)]).then((): void => {
      if (!this.mounted || generation !== this.headerFontPreparationGeneration) return;
      this.headerFontRevision += 1;
      this.onGeometryInputsChanged();
    }).catch((): void => {});
  }

  private selectionHeaderInline(): boolean {
    if (this.readerWindowMetricsRevision < 0 || this.headerFontRevision < 0 ||
      !readerFontFamilyReady(TYPE_SHELF_SELECTION_HEADING.fontFamily) ||
      !readerFontFamilyReady(TYPE_SHELF_SELECTION_ACTION.fontFamily)) return false;
    const width = this.selectionHeaderContentWidth();
    try {
      const context = this.getUIContext();
      const measure = (text: string, heading: boolean): number => {
        const style = heading ? TYPE_SHELF_SELECTION_HEADING : TYPE_SHELF_SELECTION_ACTION;
        return context.px2vp(context.getMeasureUtils().measureText({ textContent: text,
          fontSize: `${style.fontSizeFp}fp`, fontFamily: style.fontFamily, fontWeight: style.fontWeight }));
      };
      const heading = measure(`已选择 ${this.selectedKeys.length} 本`, true);
      const cancel = Math.max(72, measure('取消', false));
      const select = Math.max(72, measure(this.allSelected() ? '取消全选' : '全选', false));
      return Number.isFinite(heading) && Number.isFinite(cancel) && Number.isFinite(select) &&
        heading > 0 && heading + cancel + select <= width;
    } catch (_unavailableMeasure) {
      return false;
    }
  }

  @Builder
  private selectionAction(label: () => string, alignment: TextAlign, action: () => void) {
    Button({ type: ButtonType.Normal }) {
      Text(label())
        .constraintSize({ minWidth: 72 }).maxLines(1)
        .fontFamily(TYPE_SHELF_SELECTION_ACTION.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_ACTION.fontWeight)
        .fontSize(TYPE_SHELF_SELECTION_ACTION.fontSizeFp)
        .lineHeight(TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .textAlign(alignment)
        .accessibilityLevel('no');
    }
    .constraintSize({ minWidth: 72, minHeight: READER_ACTION_MIN_TARGET }).flexShrink(0)
    .padding(0).backgroundColor(Color.Transparent).borderRadius(8)
    .enabled(this.selectionInputEnabled())
    .accessibilityText(label())
    .onClick((): void => { if (this.selectionInputEnabled()) action(); });
  }

  @Builder
  private selectionCard(book: ShelfBook) {
    Column({ space: 6 }) {
      Stack({ alignContent: Alignment.BottomEnd }) {
        if (this.hasCover(this.currentBook(book))) {
          Image(this.currentBook(book).coverUrl as string)
            .width(this.cardWidth())
            .height(this.coverHeight())
            .objectFit(ImageFit.Cover)
            .borderRadius(8)
            .shadow({ radius: 26, color: readerAppColor('app.shadow.cover', this.appThemeScheme), offsetX: 0, offsetY: 8 });
        } else {
          NoCoverCover({ coverWidth: this.cardWidth(), coverHeight: this.coverHeight(),
            glyph: noCoverGlyph(this.currentBook(book).title) });
        }

        this.selectionBadge(book, 4);
      }
      .width(this.cardWidth())
      .height(this.coverHeight());

      Text(this.currentBook(book).title)
        .width(this.cardWidth())
        .fontFamily(TYPE_SHELF_SELECTION_TITLE.fontFamily)
        .fontWeight(TYPE_SHELF_SELECTION_TITLE.fontWeight)
        .fontSize(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.fontSizeFp : TYPE_SHELF_SELECTION_TITLE.fontSizeFp)
        .lineHeight(this.isWide() ? TYPE_SHELF_SELECTION_TITLE_WIDE.lineHeightFp as number : TYPE_SHELF_SELECTION_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('app.text.heading', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      Text(this.currentBook(book).author)
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
              LoadingProgress().width(18).height(18).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
                .enableLoading(this.appForeground && !this.appReduceMotion);
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
    const metrics = ReaderWindowCoordinator.metrics();
    const geometryInputs = JSON.stringify([this.liveWidth(), metrics.systemFontScale,
      metrics.densityPixels, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics)]);
    const headerInputs = JSON.stringify([geometryInputs, this.headerFontRevision]);
    const footerInputs = JSON.stringify([geometryInputs, this.bottomInset()]);
    if (headerInputs !== this.headerInputs) {
      this.headerInputs = headerInputs;
      this.measurementKey += 1;
    }
    if (footerInputs !== this.footerInputs) {
      this.footerInputs = footerInputs;
      this.footerMeasurementKey += 1;
    }
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    const currentKey = slot === 'selection:footer' ? this.footerMeasurementKey : this.measurementKey;
    if (!this.mounted || presentedKey !== currentKey || height < 0) return;
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
    input.headerHeight = this.measurements.readForGeneration('selection:header', this.measurementKey, this.selectionHeaderMinimumHeight());
    input.headerInsetLeft = readerInteractiveSafeLeft(input.metrics);
    input.headerInsetRight = readerInteractiveSafeRight(input.metrics);
    input.footerInsetLeft = input.headerInsetLeft;
    input.footerInsetRight = input.headerInsetRight;
    input.contentMaxWidth = this.isWide() ? 622 : 351;
    input.contentHorizontalPadding = this.isWide() ? 20 : 7.5;
    input.contentHorizontalSafeArea = 'interactive';
    input.contentGap = 12;
    input.contentEndInset = this.removeBarClearance() + 20;
    this.geometry = resolveReaderPageGeometry(input);
  }

  private removeBarClearance(): number {
    return this.measurements.readForGeneration('selection:footer', this.footerMeasurementKey,
      12 + READER_ACTION_MIN_TARGET + this.bottomInset());
  }

  private reconcileSelection(): void {
    this.selectedKeys = this.selectedKeys.filter((key: string): boolean => this.canRetainSelectedKey(key));
  }

  private onMangaPresentationChanged(): void {
    if (this.mounted) this.reconcileSelection();
  }

  private canRetainSelectedKey(key: string): boolean {
    if (this.hasBookKey(key)) return true;
    // A missing optional display receipt is not evidence that an explicitly
    // selected book became unread/read. Keep that identity pending, while the
    // submit fence below still requires the current confirmed filter match.
    return ShelfBookPresentation.visible(this.books, this.storedSelectedGroup, 'all', this.sourceFilter)
      .some((book: ShelfBook): boolean => this.bookKey(book) === key && ShelfBookPresentation.readingStatePending(book));
  }

  private canRemoveSelection(): boolean {
    return this.selectionInputEnabled() && this.selectedKeys.some((key: string): boolean => this.hasBookKey(key));
  }

  private removeVisibleSelection(): void {
    if (!this.canRemoveSelection()) return;
    // Protect a click delivered before the Prop watcher has reconciled a
    // book whose progress/group changed underneath an active filter.
    this.reconcileSelection();
    const keys = this.selectedKeys.filter((key: string): boolean => this.hasBookKey(key));
    if (keys.length > 0) this.onRemoveSelected(keys);
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
    const pending = this.selectedKeys.filter((key: string): boolean => !this.hasBookKey(key) && this.canRetainSelectedKey(key));
    this.selectedKeys = [...pending, ...visible.map((book: ShelfBook): string => this.bookKey(book))];
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
    return this.appForeground && this.mounted && this.ready && !this.busy && (this.isInputAllowed?.() ?? true);
  }

  private selectionRowAction(book: ShelfBook): ReaderActionAccessibility {
    const selected = this.isSelected(book);
    return new ReaderActionAccessibility(`${this.currentBook(book).title}，${selected ? '已选择' : '未选择'}`, this.selectionInputEnabled(), selected);
  }

  private currentBook(snapshot: ShelfBook): ShelfBook {
    return this.books.find((book: ShelfBook): boolean =>
      book.sourceId === snapshot.sourceId && book.bookId === snapshot.bookId) ?? snapshot;
  }

  private hasBookKey(key: string): boolean {
    return this.visibleBooks().some((book: ShelfBook): boolean => this.bookKey(book) === key);
  }

  private visibleBooks(): ShelfBook[] {
    if (this.mangaRevision < 0) return [];
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
        if (this.hasCover(this.currentBook(book))) {
          Image(this.currentBook(book).coverUrl as string)
            .width(48)
            .height(80)
            .objectFit(ImageFit.Cover)
            .borderRadius(6);
        } else {
          NoCoverCover({ coverWidth: 48, coverHeight: 80, glyph: noCoverGlyph(this.currentBook(book).title) });
        }
        this.selectionBadge(book, 2);
      }
      .width(48)
      .height(80);
      ShelfBookListDetails({ book: this.currentBook(book), textFrame: this.listTextFrame() }).layoutWeight(1).constraintSize({ minWidth: 0 });
    }
    .width(this.gridWidth())
    .height(Math.max(80, this.listTextFrame().height))
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

  private prepareListTextFonts(): void {
    const generation = ++this.listTextFontGeneration;
    void prepareBookshelfListTextFonts().then((): void => {
      if (this.mounted && generation === this.listTextFontGeneration) this.listTextFontRevision += 1;
    }).catch((): void => {});
  }

  private listTextFrame(): BookshelfListTextFrame {
    return this.listTextBudget.resolve(this.getUIContext(), Math.max(0, this.gridWidth() - 48 - 12),
      this.fontScale(), this.listTextFontRevision);
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    const scale = ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private selectionHeaderContentWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(0, this.liveWidth() - readerInteractiveSafeLeft(metrics) - readerInteractiveSafeRight(metrics) - 40);
  }

  private selectionHeaderMinimumHeight(): number {
    let heading = (TYPE_SHELF_SELECTION_HEADING.lineHeightFp as number) * this.fontScale();
    const inline = this.selectionHeaderInline();
    if (!inline) {
      try {
        const context = this.getUIContext();
        const style = TYPE_SHELF_SELECTION_HEADING;
        const measured = context.px2vp(Number(context.getMeasureUtils().measureTextSize({
          textContent: `已选择 ${this.selectedKeys.length} 本`, fontSize: `${style.fontSizeFp}fp`,
          fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: `${style.lineHeightFp}fp`,
          constraintWidth: `${this.selectionHeaderContentWidth()}vp`,
        }).height));
        if (Number.isFinite(measured) && measured > 0) heading = Math.max(heading, measured);
      } catch (_unavailableMeasure) {}
    }
    const action = Math.max(READER_ACTION_MIN_TARGET,
      (TYPE_SHELF_SELECTION_ACTION.lineHeightFp as number) * this.fontScale());
    return Math.max(APP_HEADER_BAR_HEIGHT, (inline ? Math.max(heading, action) : heading + action) + 14);
  }

  private gridFrame(): BookshelfGridFrame {
    return bookshelfGridFrame(this.geometry.content.frame.width, this.isWide(), this.fontScale());
  }

  private gridWidth(): number {
    return this.isListMode() ? this.geometry.content.frame.width : this.gridFrame().rowWidth;
  }

  private cardWidth(): number {
    return this.gridFrame().cardWidth;
  }

  private coverHeight(): number {
    return this.gridFrame().coverHeight;
  }

  private cardHeight(): number {
    return bookshelfSelectionCardHeight(this.coverHeight(), this.isWide(), this.fontScale());
  }

  private bottomInset(): number {
    this.readerWindowMetricsRevision;
    return Math.max(12, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
  }
}
