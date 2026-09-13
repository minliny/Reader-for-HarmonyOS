import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_GREEN, TOK_CARD_BG, TOK_BORDER, TOK_PRIMARY_SOFT } from '../common/ReaderTokens';

/** V1 lightweight single-select group control; never mutates groups on open. */
@Component
export struct BookshelfGroupSelector {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop selected: boolean = false;
  @Prop busy: boolean = false;
  onSelect: () => void = (): void => {};

  build() {
    Row() {
      Text('默认').fontFamily('ReaderInter').fontWeight(FontWeight.Medium)
        .fontSize(12).lineHeight(18).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
        .padding({ left: 12, right: 12, top: 5, bottom: 5 })
        .backgroundColor(this.selected ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: 1, color: this.selected ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(999)
        .enabled(!this.busy).onClick((): void => this.onSelect())
        .accessibilityText(this.selected ? '默认分组，已选' : '选择默认分组');
    }.width('100%').padding({ top: 8, bottom: 8 });
  }
}
