import {
  TOK_INK,
  TOK_SPACE_CONTROL_INLINE,
} from './ReaderTokens';

// 二级页面统一返回栏:44×44 圆角返回钮 + 24px 思源宋体标题,58 高、20vp 内边距。
// 曾被 Settings/SourceManagement/Sync/Rss/LocalBookDetail 各自复制实现。
@Component
export struct PageBackBar {
  title: string = '';
  /** 默认 `search_back`;详情页等可传其他返回图标。 */
  backIcon?: Resource;
  /** 标题颜色,默认 ink #1F1B17;个别页(Sync)用更深 #1A1612。 */
  titleColor: string = TOK_INK;
  onBack: () => void = (): void => {};
  /** 可选尾部槽 (如 SourceManagement 的 44×44 more 钮); 未传时不渲染。 */
  @BuilderParam trailing?: () => void;

  build() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.backIcon !== undefined ? this.backIcon : $r('app.media.search_back'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text(this.title)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor(this.titleColor)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1);

      if (this.trailing !== undefined) {
        this.trailing();
      }
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20 })
    .alignItems(VerticalAlign.Center);
  }
}
