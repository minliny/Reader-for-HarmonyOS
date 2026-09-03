import {
  TOK_INK,
  TOK_SPACE_SM,
} from '../common/ReaderTokens';
import { TYPE_SECTION_HEADING } from './ReaderTypography';
// 分节标题: 对齐 Figma Heading 2 (348×16, Inter Black 13 #1F1B17, 左右 12 inset)。
// Settings 各节与 Sync 分节共用。
@Component
export struct ReaderSectionHeading {
  @Prop title: string = '';

  build() {
    Text(this.title)
      .width('100%')
      .height(16)
      .fontFamily(TYPE_SECTION_HEADING.fontFamily)
      .fontWeight(TYPE_SECTION_HEADING.fontWeight)
      .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
      .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number)
      .fontColor(TOK_INK)
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis });
  }
}
