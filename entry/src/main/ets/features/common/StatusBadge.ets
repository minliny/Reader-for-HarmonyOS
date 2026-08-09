import {
  TOK_CARD_BG,
} from '../common/ReaderTokens';
// 状态徽标:24×18 胶囊内一颗 7px 圆点,底色与点色由调用方传入。
// 全站统一胶囊圆角 999 (Settings/SourceManagement 两处调用点均显式传 999)。
@Component
export struct StatusBadge {
  @Prop bg: string = TOK_CARD_BG;
  @Prop dot: string = '#2F6B52';
  /** 徽标外圆角:统一 999(胶囊)。 */
  @Prop radius: number = 999;

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Text('')
        .width(7)
        .height(7)
        .borderRadius(3.5)
        .backgroundColor(this.dot);
    }
    .width(24)
    .height(18)
    .borderRadius(this.radius)
    .backgroundColor(this.bg);
  }
}
