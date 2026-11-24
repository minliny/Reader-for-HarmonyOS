import { TYPE_SHELF_COVER_PLACEHOLDER } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';

/** The caller continues to own the book identity and accessible title. */
export function noCoverGlyph(title: string | undefined): string {
  return title?.trim() || '暂无封面';
}

@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop coverWidth: number = 0;
  @Prop coverHeight: number = 0;
  @Prop glyph: string = '暂无封面';
  @Prop kindLabel: string = '';

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.x(2)).height(this.coverHeight)
        .backgroundColor(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
        .position({ x: this.x(6), y: 0 });

      Row().width(this.x(68)).height(this.y(104)).borderRadius(this.scaleCoverUnit(2.5))
        .border({ width: this.scaleCoverUnit(1), color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) })
        .position({ x: this.x(11), y: this.y(10) });
      Row().width(this.x(61)).height(this.y(97)).borderRadius(this.scaleCoverUnit(1.5))
        .border({ width: this.scaleCoverUnit(0.7), color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .position({ x: this.x(14.5), y: this.y(13.5) });

      Row().width(this.scaleCoverUnit(10)).height(this.scaleCoverUnit(10)).borderRadius(this.scaleCoverUnit(2))
        .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
        .border({ width: this.scaleCoverUnit(0.7), color: readerAppColor('TOK_GREEN', this.appThemeScheme) })
        .position({ x: this.x(61), y: this.y(18) });

      Stack({ alignContent: Alignment.Center }) {
        Text(this.glyph.trim() || '暂无封面')
          .width('100%')
          .fontFamily(TYPE_SHELF_COVER_PLACEHOLDER.fontFamily)
          .fontWeight(TYPE_SHELF_COVER_PLACEHOLDER.fontWeight)
          .fontSize(`${this.scaleCoverUnit(12.5)}vp`)
          .lineHeight(`${this.scaleCoverUnit(16)}vp`)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width(this.x(58)).height(this.y(43))
        .position({ x: this.x(16), y: this.y(33) });

      Text(this.kindLabel.trim().length > 0 ? `无封面 · ${this.kindLabel}` : '无封面')
        .width(this.x(58)).textAlign(TextAlign.Center)
        .fontSize(`${this.scaleCoverUnit(7)}vp`)
        .lineHeight(`${this.scaleCoverUnit(10)}vp`)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: this.x(16), y: this.y(89) });
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor('TOK_FIELD_SURFACE', this.appThemeScheme))
    .borderRadius(8)
    .clip(true)
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants');
  }

  private x(units: number): number { return units * this.coverWidth / 90; }
  private y(units: number): number { return units * this.coverHeight / 124; }
  private scaleCoverUnit(units: number): number { return units * Math.min(this.coverWidth / 90, this.coverHeight / 124); }
}
