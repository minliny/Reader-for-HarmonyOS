import { readerFontFamilyReady } from '../foundation/ReaderFonts';
import type { UIContext } from '@ohos.arkui.UIContext';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerReadableFontScale } from '../foundation/ReaderSurfaceResolvers';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { mangaDirectoryColor } from '../foundation/ReaderDirectoryChromeVisual';
import { READER_FONT_NOTO_SERIF_SC_BOLD } from '../foundation/ReaderFontFamilies';
import { TYPE_READER_CONTROL_BOOK_TITLE, TYPE_READER_CONTROL_CHAPTER_SOURCE,
  TYPE_READER_DIRECTORY_BOOK_TITLE, TYPE_READER_DIRECTORY_CHAPTER } from '../foundation/ReaderTypography';
import { ReaderPanelFrame } from '../surfaces/ReaderPanelFrame';

export type ReaderReadingTopBarVariant = 'reading' | 'directory' | 'manga';

export function readerReadingTopBarFontsReady(variant: ReaderReadingTopBarVariant): boolean {
  if (variant === 'manga') return readerFontFamilyReady(READER_FONT_NOTO_SERIF_SC_BOLD);
  const primary = variant === 'reading' ? TYPE_READER_CONTROL_BOOK_TITLE : TYPE_READER_DIRECTORY_BOOK_TITLE;
  const secondary = variant === 'reading' ? TYPE_READER_CONTROL_CHAPTER_SOURCE : TYPE_READER_DIRECTORY_CHAPTER;
  return readerFontFamilyReady(primary.fontFamily) && readerFontFamilyReady(secondary.fontFamily);
}

/** The same native line boxes feed the visible bar and its host placement. */
export function readerReadingTopBarHeight(context: UIContext, variant: ReaderReadingTopBarVariant,
  minimumHeight: number): number {
  const height = (size: number, family: string | undefined, weight: number, line?: number): number => {
    try {
      const measured = context.getMeasureUtils().measureTextSize({ textContent: '字', fontSize: size,
        fontFamily: family, fontWeight: weight, lineHeight: line === undefined ? undefined : `${line}fp`, maxLines: 1 });
      const value = context.px2vp(Number(measured.height));
      if (Number.isFinite(value) && value > 0) return value;
    } catch (_) {}
    return (line ?? size * 1.5) * readerReadableFontScale(readerWindowMetrics().systemFontScale);
  };
  if (variant === 'manga') return Math.max(minimumHeight, 44,
    height(17, READER_FONT_NOTO_SERIF_SC_BOLD, 700) + height(11, undefined, 400) + 9);
  const primary = variant === 'reading' ? TYPE_READER_CONTROL_BOOK_TITLE : TYPE_READER_DIRECTORY_BOOK_TITLE;
  const secondary = variant === 'reading' ? TYPE_READER_CONTROL_CHAPTER_SOURCE : TYPE_READER_DIRECTORY_CHAPTER;
  const title = height(primary.fontSizeFp, primary.fontFamily, primary.fontWeight, primary.lineHeightFp) +
    height(secondary.fontSizeFp, secondary.fontFamily, secondary.fontWeight, secondary.lineHeightFp) +
    (variant === 'reading' ? 5 : 6);
  return Math.max(minimumHeight, title + 9, 44 + 8);
}

export class ReaderReadingTopBarTitle implements AttributeModifier<TextAttribute> {
  private readonly variant: ReaderReadingTopBarVariant;
  private readonly primary: boolean;
  private readonly scheme: string;
  private readonly fontScale: number;

  constructor(variant: ReaderReadingTopBarVariant, primary: boolean, scheme: string, fontScale: number = 1) {
    this.variant = variant;
    this.primary = primary;
    this.scheme = scheme;
    this.fontScale = fontScale;
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
    else instance.width('100%').height(Math.ceil((this.primary ? 22 : 17) * this.fontScale))
      .minFontScale(1).maxFontScale(this.fontScale);
    instance.fontFamily(style.fontFamily).fontWeight(style.fontWeight).fontSize(style.fontSizeFp)
      .fontColor(readerAppColor(this.primary ? 'TOK_READ_INK' : 'TOK_READ_MUTED', this.scheme));
  }
}

/** Reading and its directory share a two-line chrome. The host supplies its own actions and frame bounds. */
@Component
export struct ReaderReadingTopBar {
  @StorageLink('readerWindowMetricsRevision') private windowMetricsRevision: number = 0;
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

  private titleFontScale(): number {
    if (this.windowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private measuredHeightKey: string = '';
  private measuredHeight: number = 54;
  private resolvedHeight(): number {
    const key = `${this.variant}|${this.barHeight}|${this.windowMetricsRevision}`;
    const ready = readerReadingTopBarFontsReady(this.variant);
    if (!ready || this.measuredHeightKey !== key) {
      this.measuredHeight = readerReadingTopBarHeight(this.getUIContext(), this.variant, this.barHeight);
      this.measuredHeightKey = ready ? key : '';
    }
    return this.measuredHeight;
  }

  build() {
    Row({ space: this.variant === 'reading' ? 8 : 0 }) {
      this.leading();
      Column({ space: this.variant === 'manga' ? 1 : this.variant === 'reading' ? 5 : 6 }) {
        Text(this.bookTitle).attributeModifier(new ReaderReadingTopBarTitle(this.variant, true, this.scheme, this.titleFontScale()));
        Text(this.subtitle).attributeModifier(new ReaderReadingTopBarTitle(this.variant, false, this.scheme, this.titleFontScale()));
      }.layoutWeight(1)
        .constraintSize({ minWidth: 0 })
        .margin({ left: this.variant === 'directory' ? 8 : 0 })
        .alignItems(this.variant === 'reading' ? HorizontalAlign.Start : HorizontalAlign.Center);
      this.trailing();
    }.width(this.barWidth).height(this.resolvedHeight())
      .padding(this.variant === 'reading' ? { left: 13, right: 13 } : 0)
      .alignItems(VerticalAlign.Center).enabled(this.inputEnabled)
      .attributeModifier(new ReaderPanelFrame(this.variant === 'manga' ? 'manga-toolbar' : 'reader', this.scheme));
  }
}
