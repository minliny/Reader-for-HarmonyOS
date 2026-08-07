import { ReaderCard } from '../common/ReaderCard';
import { ReaderSectionHeading } from '../common/ReaderSectionHeading';
import {
  TOK_BORDER,
  TOK_CARD_BG,
} from '../common/ReaderTokens';


// CategorySection —— Settings / Sync 分类区块 (Figma Page/Settings General Section):
// 卡片容器 (bg TOK_CARD_BG + border TOK_BORDER + r8) + Heading 2 + 数据行栈。行由
// CategoryRow 提供, 调用方经 content @BuilderParam 注入。Width Fill / Height Hug。
// 普通页面不再复制 Card + Heading + row-stack 结构 (FIGMA_NATIVE_UI_ARCHITECTURE_PLAN §六)。
@Component
export struct CategorySection {
  @Prop title: string = '';
  @Prop cardWidth: number = 0; // 0 = Fill 撑满父宽
  @BuilderParam content: () => void;

  build() {
    ReaderCard({ bg: TOK_CARD_BG, cardBorder: TOK_BORDER, radius: 8, cardWidth: this.cardWidth }) {
      Column() {
        ReaderSectionHeading({ title: this.title });
        Column() {
          this.content();
        }
        .width('100%')
        .padding({ top: 5 });
      }
      .width('100%')
      .padding({ top: 9, bottom: 1 });
    }
  }
}