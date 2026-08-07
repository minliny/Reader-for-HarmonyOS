import {
  TOK_INK,
  TOK_ROW_DIVIDER,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';


// CategoryRow —— Settings 分类区块内的数据行 (Figma CategoryRow/Article): 28 icon 盒 +
// Label Fill + Trailing Hug, 高 57, 顶部 row divider, 左右 12 inset。leading 图标盒与 label
// 由组件统一提供; trailing 控件 (Switch/Select/Chevron/Action) 由调用方经 @BuilderParam
// 注入。普通页面不再复制 icon-box + row + divider 结构。
const ROW_ICON_BG = '#172379A4'; // rgba(35,121,164,0.09)

@Component
export struct CategoryRow {
  @Prop icon: Resource = $r('app.media.placeholder');
  @Prop label: string = '';
  @BuilderParam trailing: () => void;

  build() {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.icon).width(15).height(15);
      }
      .width(28)
      .height(28)
      .borderRadius(14)
      .backgroundColor(ROW_ICON_BG);

      Text(this.label)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(13)
        .lineHeight(15.6)
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      this.trailing();
    }
    .width('100%')
    .height(57)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Center)
    .border({ width: { top: 1 }, color: TOK_ROW_DIVIDER });
  }
}