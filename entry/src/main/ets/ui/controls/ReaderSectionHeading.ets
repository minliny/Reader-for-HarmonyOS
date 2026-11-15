import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TOK_SPACE_SM } from '../foundation/ReaderTokens';
import { TYPE_SECTION_HEADING, TYPE_SOURCE_TOOLS_HEADING } from '../foundation/ReaderTypography';

type ReaderSectionHeadingVariant = 'settings-section' | 'tool-card';

/** Settings keeps a 16vp minimum label slot. Both variants grow with their text. */
@Component
export struct ReaderSectionHeading {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop title: string = '';
  @Prop variant: ReaderSectionHeadingVariant = 'settings-section';

  build() {
    if (this.variant === 'tool-card') {
      Text(this.title)
        .width('100%')
        .fontFamily(TYPE_SOURCE_TOOLS_HEADING.fontFamily)
        .fontWeight(TYPE_SOURCE_TOOLS_HEADING.fontWeight)
        .fontSize(TYPE_SOURCE_TOOLS_HEADING.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
    } else {
      Text(this.title)
        .width('100%')
        .constraintSize({ minHeight: 16 })
        .fontFamily(TYPE_SECTION_HEADING.fontFamily)
        .fontWeight(TYPE_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_SECTION_HEADING.fontSizeFp)
        .lineHeight(TYPE_SECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
  }
}
