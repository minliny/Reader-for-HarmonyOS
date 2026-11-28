import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TYPE_CARD_SECTION_HEADING, TYPE_SECTION_HEADING } from '../foundation/ReaderTypography';

type ReaderSectionHeadingVariant = 'settings-section' | 'tool-card';

/** Settings keeps a 16vp minimum label slot. Both variants grow with their text. */
@Component
export struct ReaderSectionHeading {
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop title: string = '';
  @Prop variant: ReaderSectionHeadingVariant = 'settings-section';

  build() {
    if (this.variant === 'tool-card') {
      Text(this.title)
        .width('100%')
        .fontFamily(TYPE_CARD_SECTION_HEADING.fontFamily)
        .fontWeight(TYPE_CARD_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_CARD_SECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_CARD_SECTION_HEADING.lineHeightFp as number).halfLeading(true)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
    } else {
      Text(this.title)
        .width('100%')
        .constraintSize({ minHeight: 16 })
        .fontFamily(TYPE_SECTION_HEADING.fontFamily)
        .fontWeight(TYPE_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number).halfLeading(true)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .padding({ left: 4, right: 4 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
  }
}
