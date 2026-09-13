import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  TOK_INK,
  TOK_META_BG,
} from '../common/ReaderTokens';
/**
 * Figma `Library/BookCover` `Book=NoCover` variant (`3612:1796`): cream
 * `#F5ECE6` background, two horizontal rules, and a centered "暂无封面"
 * label (Noto Serif SC Bold 15, ink `#1F1B17`). The BookCover canvas is
 * 96.96 × 145.44; every element scales proportionally with the instance.
 */
@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop coverWidth: number;
  @Prop coverHeight: number;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(this.ruleWidth())
        .height(1)
        .backgroundColor(readerAppColor('app.NoCoverCover.build.backgroundColor.2E41484C', this.appThemeScheme))
        .borderRadius(0.5)
        .position({ x: (this.coverWidth - this.ruleWidth()) / 2, y: 52 / 145.44 * this.coverHeight });

      Text('暂无封面')
        .width(this.labelWidth())
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15 * this.coverWidth / 96.96)
        .lineHeight(18.3 * this.coverWidth / 96.96)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .position({ x: (this.coverWidth - this.labelWidth()) / 2, y: 63.57 / 145.44 * this.coverHeight })
        .maxLines(1);

      Text('')
        .width(this.ruleWidth())
        .height(1)
        .backgroundColor(readerAppColor('app.NoCoverCover.build.backgroundColor.2E41484C', this.appThemeScheme))
        .borderRadius(0.5)
        .position({ x: (this.coverWidth - this.ruleWidth()) / 2, y: 92.44 / 145.44 * this.coverHeight });
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor('TOK_META_BG', this.appThemeScheme))
    .borderRadius(8)
    .clip(true);
  }

  private ruleWidth(): number {
    return 40 / 96.96 * this.coverWidth;
  }

  private labelWidth(): number {
    return 72 / 96.96 * this.coverWidth;
  }
}