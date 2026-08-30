import type { image } from '@kit.ImageKit';
import { registerReaderFonts } from '../common/ReaderFonts';
import { readerThemePalette } from './ReaderThemePalettes';
import { TYPE_READER_CHAPTER_TITLE } from '../common/ReaderTypography';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import {
  readerAppearanceSnapshotFontFamily,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndentPrefix,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
  type ReaderAppearanceThemeStyle,
} from './ReaderAppearanceRenderStyle';
import {
  ReaderReadingLayoutSnapshot,
  createDefaultReaderReadingLayout,
} from './ReaderLayoutGeometry';
import { ReaderPageChrome } from './ReaderPageChrome';

/**
 * Figma-backed static reading body for `15 · Reader 2`:
 * - Phone `1023:18355` (390 × 844)
 * - TabletExpanded `1023:18371` (760 × 960)
 *
 * This is deliberately a presentation-only component. Its caller supplies
 * Core-materialized page text and the exact exported Figma PaperLayer assets;
 * it has no Core commands, navigation, controls, pagination, or motion.
 *
 * The paper texture and two lighting overlays are direct Figma exports for
 * each viewport. They are static paint layers, not a motion implementation.
 */
/**
 * One already-measured physical page fragment. `isParagraphStart` preserves
 * the Figma paragraph contract when a single Core paragraph crosses a page:
 * only the original first line receives the configured 2em indent, and the
 * 15.8px gap belongs only between original paragraphs.
 */
export class ReadingSurfacePageFragment {
  id: string;
  text: string;
  isParagraphStart: boolean;
  startScalar: number;
  endScalar: number;
  imageSource: image.PixelMap | undefined;
  fileUri: string | undefined;
  imageHeight: number;
  layoutHeight: number;

  constructor(
    id: string,
    text: string,
    isParagraphStart: boolean,
    startScalar: number = 0,
    endScalar?: number,
    imageSource?: image.PixelMap,
    imageHeight: number = 0,
    fileUri?: string,
    layoutHeight: number = imageHeight,
  ) {
    this.id = id;
    this.text = text;
    this.isParagraphStart = isParagraphStart;
    this.startScalar = startScalar;
    this.endScalar = endScalar ?? startScalar + text.length;
    this.imageSource = imageSource;
    this.imageHeight = imageHeight;
    this.fileUri = fileUri;
    this.layoutHeight = layoutHeight;
  }
}

class ReadingSurfaceHighlightRange {
  startUtf16: number;
  endUtf16: number;

  constructor(startUtf16: number, endUtf16: number) {
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
  }
}

/** Shared scalar-aware text primitive for paged and continuous reading. */
@Component
export struct ReaderReadingTextFragment {
  @Prop text: string = '';
  @Prop isParagraphStart: boolean = false;
  @Prop startScalar: number = 0;
  @Prop endScalar: number = 0;
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;

  build() {
    Text() {
      if (this.indentPrefix().length > 0) {
        Span(this.indentPrefix());
      }
      if (this.highlightPrefix().length > 0) {
        Span(this.highlightPrefix());
      }
      if (this.highlightBody().length > 0) {
        if (this.usesTtsHighlight()) {
          Span(this.highlightBody())
            .decoration({ type: TextDecorationType.Underline, color: this.themeStyle().ink });
        } else {
          Span(this.highlightBody())
            .textBackgroundStyle({ color: readerThemePalette(this.appearance.activeTheme).selection, radius: 2 });
        }
      }
      if (this.highlightSuffix().length > 0) {
        Span(this.highlightSuffix());
      }
    }
      .width('100%')
      .fontFamily(readerAppearanceSnapshotFontFamily(this.appearance))
      .fontWeight(FontWeight.Regular)
      .fontSize(this.appearance.fontSize)
      .lineHeight(readerAppearanceLineHeight(this.appearance))
      .letterSpacing(this.appearance.letterSpacing)
      .fontColor(this.themeStyle().ink)
      .copyOption(this.longPressSelectText ? CopyOptions.InApp : CopyOptions.None)
      .selectedBackgroundColor(readerThemePalette(this.appearance.activeTheme).selection)
      .textAlign(readerAppearanceUsesJustify(this.appearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start);
  }

  private indentPrefix(): string {
    return this.isParagraphStart ? readerAppearanceParagraphIndentPrefix(this.appearance.indent) : '';
  }

  private highlightPrefix(): string {
    const range = this.highlightRange();
    return this.text.substring(0, range.startUtf16);
  }

  private highlightBody(): string {
    const range = this.highlightRange();
    return this.text.substring(range.startUtf16, range.endUtf16);
  }

  private highlightSuffix(): string {
    const range = this.highlightRange();
    return this.text.substring(range.endUtf16);
  }

  private usesTtsHighlight(): boolean {
    const start = this.ttsHighlightStart;
    const end = this.ttsHighlightEnd;
    return start !== undefined && end !== undefined && Number.isFinite(start) &&
      Number.isFinite(end) && end > start;
  }

  private highlightRange(): ReadingSurfaceHighlightRange {
    let highlightStart = this.autoPageHighlightStart;
    let highlightEnd = this.autoPageHighlightEnd;
    if (this.usesTtsHighlight()) {
      highlightStart = this.ttsHighlightStart;
      highlightEnd = this.ttsHighlightEnd;
    }
    if (highlightStart === undefined || highlightEnd === undefined ||
      !Number.isFinite(highlightStart) || !Number.isFinite(highlightEnd) ||
      highlightEnd <= highlightStart || highlightEnd <= this.startScalar ||
      highlightStart >= this.endScalar) {
      return new ReadingSurfaceHighlightRange(0, 0);
    }
    const startScalar = Math.max(this.startScalar, highlightStart) - this.startScalar;
    const endScalar = Math.min(this.endScalar, highlightEnd) - this.startScalar;
    return new ReadingSurfaceHighlightRange(
      this.utf16ForScalar(startScalar),
      this.utf16ForScalar(endScalar),
    );
  }

  private utf16ForScalar(scalarOffset: number): number {
    let scalar = 0;
    let utf16 = 0;
    while (utf16 < this.text.length && scalar < scalarOffset) {
      const codePoint = this.text.codePointAt(utf16);
      utf16 += codePoint !== undefined && codePoint > 0xFFFF ? 2 : 1;
      scalar += 1;
    }
    return utf16;
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.appearance.activeTheme);
  }
}

@Component
export struct ReadingSurface {
  /** Core-materialized title for the current pagination-manifest page. */
  @Prop chapterTitle: string;
  /** The semantic chapter heading belongs only to the first physical page. */
  @Prop showChapterTitle: boolean = true;
  /**
   * Exact paragraph slices selected by the local pagination manifest for this
   * page. Each string is rendered verbatim: Core/newline/scalar normalization
   * is never repeated by the presentation layer.
   */
  @Prop pageParagraphs: string[] = [];
  /**
   * Preferred physical-page input. It is produced by the feature-local
   * measurement pass, rather than by this presentation component.
   */
  @Prop pageFragments: ReadingSurfacePageFragment[] = [];
  /** One owner-computed viewport/safe-area contract shared with pagination. */
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  /** UI-owned persisted appearance snapshot; no business/content state lives here. */
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  /** Per-gap full-page adjustment; zero for short/image-ending pages. */
  @Prop bottomJustifyGap: number = 0;
  @Prop longPressSelectText: boolean = false;
  @Prop chromeTopStartText: string = '';
  @Prop chromeTopEndText: string = '';
  @Prop chromeBottomStartText: string = '';
  @Prop chromeBottomEndText: string = '';
  @Prop chromeSessionVisible: boolean = false;
  @Prop chromeSessionWidth: number = 0;
  @Prop chromeSessionHeight: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      // The Figma background-image list is painted front-to-back: texture,
      // gradient, highlight, shade. Stack children paint back-to-front, so
      // keep the equivalent order explicit here rather than coalescing the
      // texture with the gradient and accidentally covering it with lighting.
      if (this.themeStyle().sourcePaperLighting) {
        Image(this.paperShade())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Fill)
          .interpolation(ImageInterpolation.High);

        Image(this.paperHighlight())
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Fill)
          .interpolation(ImageInterpolation.High);
      }

      Stack() {
      }
        .width('100%')
        .height('100%')
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [[this.themeStyle().paperStart, 0], [this.themeStyle().paperEnd, 1]],
        });

      if (this.themeStyle().paperTexture) {
        Stack() {
        }
          .width('100%')
          .height('100%')
          .backgroundImage(this.paperTexture(), ImageRepeat.XY)
          .backgroundImageSize({ width: 100, height: 100 })
          .backgroundImagePosition(Alignment.TopStart);
      }

      Column({ space: this.layout.titleToBodySpacingVp }) {
        if (this.showChapterTitle) {
          Text(this.chapterTitle)
            .width('100%')
            .fontFamily(TYPE_READER_CHAPTER_TITLE.fontFamily)
            .fontWeight(TYPE_READER_CHAPTER_TITLE.fontWeight)
            .fontSize(TYPE_READER_CHAPTER_TITLE.fontSizeFp)
            .lineHeight(this.layout.titleLineHeightFp)
            .fontColor(this.themeStyle().ink)
            .textAlign(TextAlign.Center)
            // The static ReadingSurface title track is exactly one Figma
            // line; wrapping would change the measured body origin.
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }

        Column() {
          if (this.pageFragments.length > 0) {
            ForEach(this.pageFragments, (fragment: ReadingSurfacePageFragment, index: number) => {
              if (index > 0 && this.bottomJustifyGap > 0) {
                Blank().height(this.bottomJustifyGap);
              }
              // A continuation is not a new semantic paragraph: it must not
              // acquire either a fresh 15.8px gap or a second 2em indent.
              if (index > 0 && fragment.isParagraphStart) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              if (fragment.fileUri !== undefined && fragment.fileUri.length > 0) {
                Image(fragment.fileUri)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageSource !== undefined) {
                Image(fragment.imageSource)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageHeight > 0) {
                // One stable, measurable failed-resource block. Resource
                // failure must not discard the rest of the chapter.
                Blank().height(fragment.imageHeight);
              } else {
                ReaderReadingTextFragment({
                  text: fragment.text,
                  isParagraphStart: fragment.isParagraphStart,
                  startScalar: fragment.startScalar,
                  endScalar: fragment.endScalar,
                  appearance: this.appearance,
                  ttsHighlightStart: this.ttsHighlightStart,
                  ttsHighlightEnd: this.ttsHighlightEnd,
                  autoPageHighlightStart: this.autoPageHighlightStart,
                  autoPageHighlightEnd: this.autoPageHighlightEnd,
                  longPressSelectText: this.longPressSelectText,
                });
              }
            }, (fragment: ReadingSurfacePageFragment): string => fragment.id);
          } else {
            // Retain the original public input for existing static callers.
            ForEach(this.pageParagraphs, (paragraph: string, index: number) => {
              if (index > 0) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              ReaderReadingTextFragment({
                text: paragraph,
                isParagraphStart: true,
                startScalar: 0,
                endScalar: Array.from(paragraph).length,
                appearance: this.appearance,
                ttsHighlightStart: this.ttsHighlightStart,
                ttsHighlightEnd: this.ttsHighlightEnd,
                autoPageHighlightStart: this.autoPageHighlightStart,
                autoPageHighlightEnd: this.autoPageHighlightEnd,
                longPressSelectText: this.longPressSelectText,
              });
            }, (paragraph: string, index: number): string => `${index}:${paragraph}`);
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%')
      .height('100%')
      .padding(this.contentInsets())
      .clip(true);
      }
      .width('100%')
      .height('100%')
      .clip(true);

      ReaderPageChrome({
        topStartText: this.chromeTopStartText,
        topEndText: this.chromeTopEndText,
        bottomStartText: this.chromeBottomStartText,
        bottomEndText: this.chromeBottomEndText,
        sessionVisible: this.chromeSessionVisible,
        sessionWidth: this.chromeSessionWidth,
        sessionHeight: this.chromeSessionHeight,
        layout: this.layout,
        appearance: this.appearance,
      });
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  private contentInsets(): Padding {
    return {
      top: this.layout.contentTop,
      right: this.layout.contentRight,
      bottom: this.layout.contentBottom,
      left: this.layout.contentLeft,
    };
  }

  private paperTexture(): Resource {
    return this.layout.widthClass === 'expanded' ?
      $r('app.media.reading_paper_tablet') : $r('app.media.reading_paper_phone');
  }

  private paperHighlight(): Resource {
    return this.layout.widthClass === 'expanded' ? $r('app.media.reading_paper_tablet_highlight') :
      $r('app.media.reading_paper_phone_highlight');
  }

  private paperShade(): Resource {
    return this.layout.widthClass === 'expanded' ? $r('app.media.reading_paper_tablet_shade') :
      $r('app.media.reading_paper_phone_shade');
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.appearance.activeTheme);
  }
}
