import { TYPE_READER_CHAPTER_TITLE, TYPE_SHELF_COVER_PLACEHOLDER,
  TYPE_SHELF_SELECTION_AUTHOR_WIDE } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';

/** The caller continues to own the book identity and accessible title. */
export function noCoverGlyph(title: string | undefined): string {
  return title?.trim() || '未命名';
}

/**
 * Generated default cover drawn on a 90 x 124 unit grid.
 * Novel: paper book with a spine groove, single frame, seal and serif title.
 * Comic: panel border, tinted top band with speed lines and burst, bold sans title and badge.
 * The cover never prints "no cover"; it shows the book's title and its kind.
 */
@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop coverWidth: number = 0;
  @Prop coverHeight: number = 0;
  @Prop glyph: string = '';
  @Prop kindLabel: string = '';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.isComic()) {
        // Panel frame and tinted top band.
        Row().width(this.x(78)).height(this.y(30))
          .backgroundColor(readerAppColor('app.status.warningSoft', this.appThemeScheme))
          .position({ x: this.x(6), y: this.y(6) });
        Row().width(this.x(78)).height(this.scaleCoverUnit(1.2))
          .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .position({ x: this.x(6), y: this.y(36) });
        Row().width(this.x(78)).height(this.y(112)).borderRadius(this.scaleCoverUnit(3))
          .border({ width: this.scaleCoverUnit(1.2), color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
          .position({ x: this.x(6), y: this.y(6) });
        // Speed lines and an action burst.
        Row().width(this.x(22)).height(this.scaleCoverUnit(1)).borderRadius(this.scaleCoverUnit(0.5))
          .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .position({ x: this.x(13), y: this.y(15) });
        Row().width(this.x(30)).height(this.scaleCoverUnit(1)).borderRadius(this.scaleCoverUnit(0.5))
          .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .position({ x: this.x(13), y: this.y(21) });
        Row().width(this.x(16)).height(this.scaleCoverUnit(1)).borderRadius(this.scaleCoverUnit(0.5))
          .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .position({ x: this.x(13), y: this.y(27) });
        Row().width(this.scaleCoverUnit(13)).height(this.scaleCoverUnit(13)).borderRadius(this.scaleCoverUnit(6.5))
          .backgroundColor(readerAppColor('app.status.warning', this.appThemeScheme))
          .position({ x: this.x(62), y: this.y(12) });
        Row().width(this.scaleCoverUnit(6)).height(this.scaleCoverUnit(6)).borderRadius(this.scaleCoverUnit(3))
          .border({ width: this.scaleCoverUnit(1), color: readerAppColor('app.status.warning', this.appThemeScheme) })
          .position({ x: this.x(54), y: this.y(25) });
      } else {
        // Spine, groove, frame and seal of a paper book.
        Row().width(this.x(8)).height(this.coverHeight)
          .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
          .position({ x: 0, y: 0 });
        Row().width(this.scaleCoverUnit(1)).height(this.coverHeight)
          .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .position({ x: this.x(8), y: 0 });
        Row().width(this.x(73)).height(this.y(108)).borderRadius(this.scaleCoverUnit(2))
          .border({ width: this.scaleCoverUnit(0.8), color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
          .position({ x: this.x(12), y: this.y(8) });
        Row().width(this.scaleCoverUnit(8)).height(this.scaleCoverUnit(8)).borderRadius(this.scaleCoverUnit(1.5))
          .backgroundColor(readerAppColor('app.status.sealSoft', this.appThemeScheme))
          .border({ width: this.scaleCoverUnit(0.7), color: readerAppColor('TOK_ACCENT', this.appThemeScheme) })
          .position({ x: this.x(72), y: this.y(13) });
      }

      Stack({ alignContent: Alignment.Center }) {
        Text(this.glyph.trim() || '未命名')
          .width('100%')
          .fontFamily(this.isComic() ? TYPE_SHELF_COVER_PLACEHOLDER.fontFamily : TYPE_READER_CHAPTER_TITLE.fontFamily)
          .fontWeight(this.isComic() ? TYPE_SHELF_COVER_PLACEHOLDER.fontWeight : TYPE_READER_CHAPTER_TITLE.fontWeight)
          .fontSize(`${this.scaleCoverUnit(this.titleUnits())}vp`)
          .lineHeight(`${this.scaleCoverUnit(this.titleUnits() * 1.3)}vp`)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .wordBreak(WordBreak.BREAK_ALL)
          .maxLines(5)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width(this.x(70)).height(this.isComic() ? this.y(62) : this.y(72))
        .position({ x: this.isComic() ? this.x(10) : this.x(14), y: this.isComic() ? this.y(39) : this.y(23) });

      if (this.kindLabel.trim().length > 0) {
        if (this.isComic()) {
          Row() {
            Text(this.kindLabel.trim())
              .fontFamily(TYPE_SHELF_COVER_PLACEHOLDER.fontFamily).fontWeight(TYPE_SHELF_COVER_PLACEHOLDER.fontWeight)
              .fontSize(`${this.scaleCoverUnit(7)}vp`).lineHeight(`${this.scaleCoverUnit(10)}vp`)
              .fontColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
              .backgroundColor(readerAppColor('app.status.warning', this.appThemeScheme))
              .borderRadius(this.scaleCoverUnit(5)).padding({ left: this.scaleCoverUnit(5), right: this.scaleCoverUnit(5) })
              .maxLines(1);
          }.width(this.x(66)).justifyContent(FlexAlign.Center)
            .position({ x: this.x(12), y: this.y(103) });
        } else {
          Row().width(this.x(12)).height(this.scaleCoverUnit(1))
            .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
            .position({ x: this.x(42), y: this.y(97) });
          Text(this.kindLabel.trim())
            .width(this.x(66)).textAlign(TextAlign.Center)
            .fontFamily(TYPE_SHELF_SELECTION_AUTHOR_WIDE.fontFamily).fontWeight(TYPE_SHELF_SELECTION_AUTHOR_WIDE.fontWeight)
            .fontSize(`${this.scaleCoverUnit(7)}vp`).lineHeight(`${this.scaleCoverUnit(10)}vp`).letterSpacing(this.scaleCoverUnit(1))
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
            .position({ x: this.x(15), y: this.y(101) });
        }
      }
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
    .borderRadius(8)
    .clip(true)
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants');
  }

  private isComic(): boolean { return this.kindLabel.trim() === '漫画'; }
  private titleUnits(): number {
    const length = Array.from(this.glyph.trim()).length;
    if (length <= 4) return 15;
    if (length <= 8) return 13;
    if (length <= 14) return 11.5;
    if (length <= 28) return 10;
    return length <= 35 ? 9 : 8.5;
  }
  private x(units: number): number { return units * this.coverWidth / 90; }
  private y(units: number): number { return units * this.coverHeight / 124; }
  private scaleCoverUnit(units: number): number { return units * Math.min(this.coverWidth / 90, this.coverHeight / 124); }
}
