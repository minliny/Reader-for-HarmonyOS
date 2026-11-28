import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_SPACE_MD, TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';
import { TYPE_APP_INHERITED_BODY, TYPE_SHELF_FILTER_LABEL } from '../../../ui/foundation/ReaderTypography';

@Component
export struct BookshelfFilterContent {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop navigation: number = 0;
  @Prop contentFilter: string = 'all';
  @Prop sourceFilter: string = 'all';
  @Prop reduceMotion: boolean = false;
  @Prop shelfPressKey: string = '';
  onClearFilters: () => void = (): void => {};
  onCloseFilter: () => void = (): void => {};
  onSelectFilter: (dimension: string, value: string) => void = (_dimension: string, _value: string): void => {};
  onFilterPress: (event: TouchEvent, key: string) => void = (_event: TouchEvent, _key: string): void => {};

  private isFilterSelected(dimension: string, value: string): boolean {
    return (dimension === 'content' ? this.contentFilter : this.sourceFilter) === value;
  }

  private hasActiveFilters(): boolean {
    return this.contentFilter !== 'all' || this.sourceFilter !== 'all';
  }

  @Builder
  private filterChip(dimension: string, value: string, label: string) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row() {
        Text(label)
          .fontFamily(TYPE_SHELF_FILTER_LABEL.fontFamily).fontWeight(TYPE_SHELF_FILTER_LABEL.fontWeight)
          .fontSize(TYPE_SHELF_FILTER_LABEL.fontSizeFp).lineHeight(TYPE_SHELF_FILTER_LABEL.lineHeightFp as number)
          .fontColor(this.isFilterSelected(dimension, value)
            ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme)
            : readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .constraintSize({ maxWidth: 136 }).textAlign(TextAlign.Center);
      }
      .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
      .constraintSize({ maxWidth: 160, minHeight: 32 }).padding({ left: 12, right: 12, top: 5, bottom: 5 })
      .backgroundColor(readerPressSurface(
        readerAppColor(this.isFilterSelected(dimension, value) ? 'TOK_PRIMARY_DARK' : 'TOK_CARD_BG', this.appThemeScheme),
        this.appThemeScheme, this.shelfPressKey === `filter:${dimension}:${value}`, this.reduceMotion))
      .border({
        width: TOK_BORDER_W,
        color: readerAppColor(this.isFilterSelected(dimension, value) ? 'TOK_PRIMARY_DARK' : 'TOK_BORDER', this.appThemeScheme),
      })
      .borderRadius(999)
      .scale(readerPressScale(this.shelfPressKey === `filter:${dimension}:${value}`, this.reduceMotion))
      .opacity(readerPressOpacity(this.shelfPressKey === `filter:${dimension}:${value}`, this.reduceMotion));
    }
    .padding(0).backgroundColor(Color.Transparent)
    .id(`reader-bookshelf-filter-${dimension}-${value}`)
    .margin({ right: TOK_SPACE_XS / 2, bottom: TOK_SPACE_XS / 2 })
    .constraintSize({ maxWidth: 160, minWidth: 44, minHeight: 44 })
    .attributeModifier(new ReaderActionAccessibility(
      `${dimension === 'content' ? '内容类型' : '来源'}：${label}`,
      true, this.isFilterSelected(dimension, value), true, undefined, 'nativeButton'))
    .onTouch((event: TouchEvent): void => this.onFilterPress(event, `filter:${dimension}:${value}`))
    .onClick((): void => this.onSelectFilter(dimension, value));
  }

  build() {
    Column({ space: 4 }) {
      Row({ space: TOK_SPACE_MD }) {
        Text('筛选').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily)
          .fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
          .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('清除').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily)
            .fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .constraintSize({ minHeight: 28 }).textAlign(TextAlign.Center);
        }
        .padding(0)
        .constraintSize({ minWidth: 44, minHeight: 44 })
        .enabled(this.hasActiveFilters())
        .opacity(this.hasActiveFilters() ? 1 : 0.5)
        .attributeModifier(new ReaderActionAccessibility('清除内容类型和来源筛选', this.hasActiveFilters(), false, true,
          new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 22, 22, this.hasActiveFilters()), 'nativeButton'))
        .onClick((): void => this.onClearFilters());
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text('收起').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily)
            .fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .constraintSize({ minHeight: 28 }).textAlign(TextAlign.Center);
        }
        .padding(0)
        .constraintSize({ minWidth: 44, minHeight: 44 })
        .attributeModifier(new ReaderActionAccessibility('收起筛选', true, false, true,
          new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 22), 'nativeButton'))
        .onClick((): void => this.onCloseFilter());
      }.width('100%');
      Text('内容类型').width('100%').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily)
        .fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('content', 'all', '全部');
        this.filterChip('content', 'text', '小说');
        this.filterChip('content', 'manga', '漫画');
      }.width('100%');
      Text('来源').width('100%').fontFamily(TYPE_APP_INHERITED_BODY.fontFamily)
        .fontWeight(TYPE_APP_INHERITED_BODY.fontWeight).fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
        this.filterChip('source', 'all', '全部');
        this.filterChip('source', 'local', '本地');
        this.filterChip('source', 'online', '在线');
      }.width('100%');
    }.width('100%');
  }
}
