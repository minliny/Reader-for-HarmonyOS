import { TYPE_SHELF_COVER_PLACEHOLDER } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_META_BG,
} from '../foundation/ReaderTokens';
/**
 * Figma `Library/BookCover` `Book=NoCover` variant (`3612:1796`): cream
 * `#F5ECE6` background, two horizontal rules, and a centered label
 * (Noto Serif SC Bold 15, ink `#1F1B17`). The BookCover canvas is
 * 96.96 × 145.44; every element scales proportionally with the instance.
 *
 * The centered label is data-bound through `glyph` (default "暂无封面").
 * The visual skeleton — paper, rules, font, size, color, border — stays
 * exactly as the Figma variant defines; only the label content varies so
 * cover-less books are distinguishable. See docs/issues/bookshelf-cover-and-title-20261120.md.
 */

/**
 * Derive the centered placeholder glyph from a book title.
 * CJK titles keep the two leading characters for better discrimination;
 * Latin/digit titles use the uppercased initial. Empty titles fall back
 * to the Figma default label so the variant is never left blank.
 */
export function noCoverGlyph(title: string | undefined): string {
  const trimmed = (title ?? '').trim();
  if (trimmed.length === 0) {
    return '暂无封面';
  }
  const first = trimmed.charCodeAt(0);
  if (first >= 0x4E00 && first <= 0x9FFF) {
    return trimmed.slice(0, 2);
  }
  return trimmed.charAt(0).toUpperCase();
}

@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop coverWidth: number;
  @Prop coverHeight: number;
  @Prop glyph: string = '暂无封面';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(this.ruleWidth())
        .height(1)
        .backgroundColor(readerAppColor('app.cover.fallbackMask', this.appThemeScheme))
        .borderRadius(0.5)
        .position({ x: (this.coverWidth - this.ruleWidth()) / 2, y: 52 / 145.44 * this.coverHeight });

      Text(this.glyph)
        .width(this.labelWidth())
        .fontFamily(TYPE_SHELF_COVER_PLACEHOLDER.fontFamily)
        .fontWeight(TYPE_SHELF_COVER_PLACEHOLDER.fontWeight)
        .fontSize(`${TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96}vp`)
        .lineHeight(`${(TYPE_SHELF_COVER_PLACEHOLDER.lineHeightFp as number) * this.coverWidth / 96.96}vp`)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .position({ x: (this.coverWidth - this.labelWidth()) / 2, y: 63.57 / 145.44 * this.coverHeight })
        .maxLines(1)
        // 读屏名称由整卡的 ReaderActionAccessibility 提供完整书名；占位首字不重复朗读。
        .accessibilityLevel('no');

      Text('')
        .width(this.ruleWidth())
        .height(1)
        .backgroundColor(readerAppColor('app.cover.fallbackMask', this.appThemeScheme))
        .borderRadius(0.5)
        .position({ x: (this.coverWidth - this.ruleWidth()) / 2, y: 92.44 / 145.44 * this.coverHeight });
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor('TOK_META_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
