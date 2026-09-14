import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_GREEN, TOK_CARD_BG, TOK_BORDER, TOK_PRIMARY_SOFT } from '../common/ReaderTokens';

/** V1 lightweight single-select group control; never mutates groups on open. */
@Component
export struct BookshelfGroupSelector {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop selected: boolean = false;
  @Prop activeGroup: string = '';
  @Prop busy: boolean = false;
  onSelect: () => void = (): void => {};
  onClear: () => void = (): void => {};

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(this.activeGroup.length > 0 ? `分组 · ${this.activeGroup}` : '分组').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).fontSize(12).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Text('清除').fontSize(12).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .height(28).enabled(this.activeGroup.length > 0 && !this.busy).opacity(this.activeGroup.length > 0 ? 1 : 0.5)
          .onClick((): void => this.onClear()).accessibilityText('清除分组条件，显示全部分组');
      }.width('100%');
      Text('默认').fontFamily('ReaderInter').fontWeight(FontWeight.Medium)
        .fontSize(12).lineHeight(18).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .padding({ left: 12, right: 12, top: 5, bottom: 5 })
        .backgroundColor(this.selected ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: 1, color: this.selected ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(999)
        .enabled(!this.busy).onClick((): void => this.onSelect())
        .accessibilityText(this.selected ? '默认分组，已选' : '选择默认分组');
    }.width('100%').padding({ top: 8, bottom: 8 }).alignItems(HorizontalAlign.Start);
  }
}
