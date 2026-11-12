import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { mangaDirectoryColor } from '../foundation/ReaderDirectoryChromeVisual';
import { READER_FONT_NOTO_SERIF_SC_BOLD } from '../foundation/ReaderFontFamilies';
import { TYPE_READER_CONTROL_BOOK_TITLE, TYPE_READER_CONTROL_CHAPTER_SOURCE,
  TYPE_READER_DIRECTORY_BOOK_TITLE, TYPE_READER_DIRECTORY_CHAPTER } from '../foundation/ReaderTypography';
import { ReaderPanelFrame } from '../surfaces/ReaderPanelFrame';

type ReaderReadingTopBarVariant = 'reading' | 'directory' | 'manga';

export class ReaderReadingTopBarTitle implements AttributeModifier<TextAttribute> {
  private readonly variant: ReaderReadingTopBarVariant;
  private readonly primary: boolean;
  private readonly scheme: string;

  constructor(variant: ReaderReadingTopBarVariant, primary: boolean, scheme: string) {
    this.variant = variant;
    this.primary = primary;
    this.scheme = scheme;
  }

  applyNormalAttribute(instance: TextAttribute): void {
    instance.maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
    if (this.variant === 'manga') {
      if (this.primary) instance.fontFamily(READER_FONT_NOTO_SERIF_SC_BOLD).fontWeight(FontWeight.Bold);
      instance.fontSize(this.primary ? 17 : 11).fontColor(mangaDirectoryColor(this.primary ? 'ink' : 'muted', this.scheme));
      return;
    }
    const reading = this.variant === 'reading';
    const style = reading ? (this.primary ? TYPE_READER_CONTROL_BOOK_TITLE : TYPE_READER_CONTROL_CHAPTER_SOURCE) :
      (this.primary ? TYPE_READER_DIRECTORY_BOOK_TITLE : TYPE_READER_DIRECTORY_CHAPTER);
    if (reading) instance.width('100%').textAlign(TextAlign.Start)
      .lineHeight(style.lineHeightFp as number).letterSpacing(style.letterSpacingFp as number);
    else instance.width('100%').height(this.primary ? 22 : 17);
    instance.fontFamily(style.fontFamily).fontWeight(style.fontWeight).fontSize(style.fontSizeFp)
      .fontColor(readerAppColor(this.primary ? 'TOK_READ_INK' : 'TOK_READ_MUTED', this.scheme));
  }
}

/** Reading and its directory share a two-line chrome. The host supplies its own actions and frame bounds. */
@Component
export struct ReaderReadingTopBar {
  @Prop variant: ReaderReadingTopBarVariant = 'reading';
  @Prop barWidth: number | string = '100%';
  @Prop barHeight: number = 54;
  @Prop bookTitle: string = '';
  @Prop subtitle: string = '';
  @Prop scheme: string = 'day';
  @Prop inputEnabled: boolean = true;
  @BuilderParam leading: () => void = this.empty;
  @BuilderParam trailing: () => void = this.empty;

  @Builder private empty() {}

  build() {
    Row({ space: this.variant === 'reading' ? 8 : 0 }) {
      this.leading();
      Column({ space: this.variant === 'manga' ? 1 : this.variant === 'reading' ? 5 : 6 }) {
        Text(this.bookTitle).attributeModifier(new ReaderReadingTopBarTitle(this.variant, true, this.scheme));
        Text(this.subtitle).attributeModifier(new ReaderReadingTopBarTitle(this.variant, false, this.scheme));
      }.layoutWeight(1).height(this.variant === 'reading' ? 45 : undefined)
        .constraintSize({ minWidth: 0 })
        .margin({ left: this.variant === 'directory' ? 8 : 0 })
        .alignItems(this.variant === 'reading' ? HorizontalAlign.Start : HorizontalAlign.Center);
      this.trailing();
    }.width(this.barWidth).height(this.barHeight)
      .padding(this.variant === 'reading' ? { left: 13, right: 13 } : 0)
      .alignItems(VerticalAlign.Center).enabled(this.inputEnabled)
      .attributeModifier(new ReaderPanelFrame(this.variant === 'manga' ? 'manga-toolbar' : 'reader', this.scheme));
  }
}
