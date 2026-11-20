import { ReaderActionAccessibility } from '../common/ReaderActionAccessibility';
import { TYPE_APP_ROW_LABEL } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';
import {
  TOK_BORDER_W,
  TOK_INK,
  TOK_ROW_DIVIDER,
  TOK_SETTING_ICON_BG,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';


// CategoryRow —— Settings 分类区块内的数据行 (Figma CategoryRow/Article): 28 icon 盒 +
// Label Fill + Trailing Hug, 高 58, 顶部 row divider, 左右 12 inset。leading 图标盒与 label
// 由组件统一提供; trailing 控件 (Switch/Chevron/Action) 由调用方经 @BuilderParam
// content 注入; 导航行经 onRowClick 触发。普通页面不再复制 icon-box + row + divider 结构。

@Component
export struct CategoryRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop icon: Resource = (this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'));
  @Prop label: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop actionSelected: boolean = false;
  onRowClick: (() => void) | undefined = undefined;
  @BuilderParam content: () => void;

  build() {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.icon).width(15).height(15).objectFit(ImageFit.Contain).accessibilityLevel('no');
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(readerAppColor('TOK_SETTING_ICON_BG', this.appThemeScheme));

      Text(this.label)
        .layoutWeight(1)
        .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
        .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));

      this.content();
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 8, bottom: 8 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 14,
      this.onRowClick !== undefined))
    .attributeModifier(new ReaderActionAccessibility(this.label, this.actionEnabled, this.actionSelected, this.onRowClick !== undefined))
    .onClick((): void => this.onRowClick?.());
  }
}
