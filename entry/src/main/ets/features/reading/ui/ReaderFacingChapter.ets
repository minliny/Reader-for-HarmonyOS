import { READER_FONT_HARMONYOS_SANS } from '../../../ui/foundation/ReaderFontFamilies';
import { readerRegisteredFontFamily } from '../../../ui/foundation/ReaderFonts';
import { readerAppColor, readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { createDefaultReaderAppearanceSnapshot, type ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { readerAppearanceLineHeight, readerAppearanceParagraphIndentPrefix, readerAppearanceSnapshotFontFamily,
  readerAppearanceUsesJustify } from './ReaderAppearanceRenderStyle';
import { createDefaultReaderReadingLayout, READER_FACING_CHAPTER_GAP_VP,
  type ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

/** Bounded display text supplied by the current book's admitted adjacent chapter. */
export class ReaderFacingChapter {
  readonly title: string;
  readonly paragraphs: string[];
  readonly identity: string;

  constructor(title: string, paragraphs: string[], identity: string = '') {
    this.title = title;
    this.paragraphs = paragraphs;
    this.identity = identity;
  }
}

/** Passive right leaf in a full-viewport reading stack. */
@Component
export struct ReaderFacingChapterColumn {
  @Prop chapter: ReaderFacingChapter | undefined = undefined;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  private contentHeight(): number {
    return Math.max(0, this.layout.viewportHeight - this.layout.contentTop - this.layout.contentBottom);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.layout.facingChapterWidth > 0 && this.contentHeight() > 0) {
        Rect()
          .width(1)
          .height(Math.max(0, this.contentHeight() - 16))
          .position({ x: 0, y: 8 })
          .fill(readerAppColor('TOK_LINE', readerThemeDefinition(this.appearance.activeTheme).scheme))
          .opacity(0.55)
          .accessibilityLevel('no');

        if (this.chapter !== undefined) {
          Column({ space: this.appearance.paragraphSpacing }) {
            if ((this.chapter?.title.trim().length ?? 0) > 0) {
              Text(this.chapter?.title ?? '')
                .width('100%')
                .fontFamily(READER_FONT_HARMONYOS_SANS)
                .fontSize(11)
                .fontWeight(FontWeight.Medium)
                .fontColor(readerThemeDefinition(this.appearance.activeTheme).chromeMeta)
                .opacity(0.65)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
            ForEach(this.chapter?.paragraphs ?? [], (paragraph: string) => {
              Text(readerAppearanceParagraphIndentPrefix(this.appearance.indent) + paragraph)
                .width('100%')
                .fontFamily(readerRegisteredFontFamily(this.getUIContext().getFont(),
                  readerAppearanceSnapshotFontFamily(this.appearance)))
                .fontSize(this.appearance.fontSize)
                .fontWeight(FontWeight.Regular)
                .lineHeight(readerAppearanceLineHeight(this.appearance))
                .letterSpacing(this.appearance.letterSpacing)
                .fontColor(readerThemeDefinition(this.appearance.activeTheme).ink)
                .textAlign(readerAppearanceUsesJustify(this.appearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start)
                .copyOption(CopyOptions.None);
            }, (paragraph: string, index: number): string => `${index}:${paragraph}`);
          }
          .width(this.layout.facingChapterWidth)
          .height(this.contentHeight())
          .alignItems(HorizontalAlign.Start)
          .position({ x: READER_FACING_CHAPTER_GAP_VP / 2, y: 0 })
          .clip(true);
        }
      }
    }
    .width(this.layout.facingChapterWidth > 0 ? this.layout.facingChapterWidth + READER_FACING_CHAPTER_GAP_VP / 2 : 0)
    .height(this.layout.facingChapterWidth > 0 ? this.contentHeight() : 0)
    .position({ x: this.layout.contentLeft + this.layout.bodyWidth() + READER_FACING_CHAPTER_GAP_VP / 2,
      y: this.layout.contentTop })
    .focusable(false)
    .hitTestBehavior(HitTestMode.None)
    .clip(true);
  }
}
