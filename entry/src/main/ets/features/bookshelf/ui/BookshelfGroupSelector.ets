import { TYPE_APP_FILTER_OPTION, TYPE_APP_INHERITED_BODY } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TOK_GREEN, TOK_CARD_BG, TOK_BORDER, TOK_PRIMARY_SOFT } from '../../../ui/foundation/ReaderTokens';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';

/** V1 lightweight single-select group control; never mutates groups on open. */
@Component
export struct BookshelfGroupSelector {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop selected: boolean = false;
  @Prop busy: boolean = false;
  @Prop focusId: string = '';
  onSelect: () => void = (): void => {};

  build() {
    Column({ space: 8 }) {
      Row() {
        Text('分组').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1);
        Text('清除').fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .height(28).enabled(false).opacity(0.5).accessibilityLevel('no');
      }.width('100%');
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text('默认').fontFamily(TYPE_APP_FILTER_OPTION.fontFamily).fontWeight(TYPE_APP_FILTER_OPTION.fontWeight)
          .fontSize(TYPE_APP_FILTER_OPTION.fontSizeFp).lineHeight(TYPE_APP_FILTER_OPTION.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).accessibilityLevel('no');
      }
        .constraintSize({ minWidth: 0, minHeight: 0 })
        .padding({ left: 12, right: 12, top: 5, bottom: 5 })
        .backgroundColor(this.selected ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: 1, color: this.selected ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(999)
        .id(this.focusId)
        .attributeModifier(new ReaderActionAccessibility('默认分组', !this.busy, this.selected, true, undefined, 'nativeButton'))
        .onClick((): void => { if (!this.busy) this.onSelect(); });
    }.width('100%').padding({ top: 8, bottom: 8 }).alignItems(HorizontalAlign.Start);
  }
}
