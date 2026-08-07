import {
  TOK_BORDER,
  TOK_CARD_BG,
} from '../common/ReaderTokens';
// 卡片容器: 统一 bg/border/radius, content 为卡片内容 builder。
// Settings 分节卡与 Sync WebDAV/Auto/History 卡复用。
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
    .backgroundColor(this.bg)
    .border({ width: 0.556, color: this.cardBorder })
    .borderRadius(this.radius);
  }
}
