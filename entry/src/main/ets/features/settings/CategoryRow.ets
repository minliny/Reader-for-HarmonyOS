import {
  TOK_BORDER_W,
  TOK_INK,
  TOK_ROW_DIVIDER,
  TOK_SETTING_ICON_BG,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';


// CategoryRow —— Settings 分类区块内的数据行 (Figma CategoryRow/Article): 28 icon 盒 +
// Label Fill + Trailing Hug, 高 57, 顶部 row divider, 左右 12 inset。leading 图标盒与 label
// 由组件统一提供; trailing 控件 (Switch/Chevron/Action) 由调用方经 @BuilderParam
// content 注入; 导航行经 onRowClick 触发。普通页面不再复制 icon-box + row + divider 结构。

@Component
export struct CategoryRow {
  @Prop icon: Resource = $r('app.media.rss_chevron');
  @Prop label: string = '';
  onRowClick: () => void = (): void => {};
  @BuilderParam content: () => void;

  build() {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.icon).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(TOK_SETTING_ICON_BG);

      Text(this.label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(13)
        .lineHeight(15.6)
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      this.content();
    }
    .width('100%')
    .constraintSize({ minHeight: 57 })
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_ROW_DIVIDER })
    .onClick((): void => this.onRowClick());
  }
}