import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CONTENT_MAX_W_TABLET,
} from '../common/ReaderTokens';
// 卡片容器: 统一 bg/border/radius, content 为卡片内容 builder。
// Settings 分节卡与 Sync WebDAV/Auto/History 卡复用。
// 描边按平台校准(§八): Figma 0.556px 在 ArkUI 栅格化后对比度消失, 提到 TOK_BORDER_W(1vp)。
@Component
export struct ReaderCard {
  @Prop bg: string = TOK_CARD_BG;
  @Prop cardBorder: string = TOK_BORDER;
  @Prop radius: number = 8;
  @Prop cardWidth: number = 0; // 0 = 撑满父宽
  @BuilderParam content: () => void;

  build() {
    Column() {
      this.content();
    }
    .width(this.cardWidth > 0 ? this.cardWidth : '100%')
    // 内容最大宽约束 (Fill 相应, 宽屏不超 722): 页面两档 cardWidth 由此单点取代。
    .constraintSize({ maxWidth: TOK_CONTENT_MAX_W_TABLET })
    .backgroundColor(this.bg)
    .border({ width: TOK_BORDER_W, color: this.cardBorder })
    .borderRadius(this.radius);
  }
}
