import type { image } from '@kit.ImageKit';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import {
  readerAppearanceFontFamily,
  readerAppearanceLineHeight,
  readerAppearanceParagraphIndent,
  readerAppearanceThemeStyle,
  readerAppearanceUsesJustify,
  type ReaderAppearanceThemeStyle,
} from './ReaderAppearanceRenderStyle';

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

  constructor(
    id: string,
    text: string,
    isParagraphStart: boolean,
    startScalar: number = 0,
    endScalar?: number,
    imageSource?: image.PixelMap,
    imageHeight: number = 0,
    fileUri?: string,
  ) {
    this.id = id;
    this.text = text;
    this.isParagraphStart = isParagraphStart;
    this.startScalar = startScalar;
    this.endScalar = endScalar ?? startScalar + text.length;
    this.imageSource = imageSource;
    this.imageHeight = imageHeight;
    this.fileUri = fileUri;
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
  /** Selects the source-backed Phone or TabletExpanded inset variant. */
  @Prop isTablet: boolean;
  /** Optional host-provided Figma canvas width; 0 fills the containing page. */
  @Prop surfaceWidth: number = 0;
  /** UI-owned persisted appearance snapshot; no business/content state lives here. */
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
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

      Column({ space: 18 }) {
        if (this.showChapterTitle) {
          Text(this.chapterTitle)
            .width('100%')
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(23)
            .lineHeight(28.75)
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
                this.fragmentText(fragment);
              }
            }, (fragment: ReadingSurfacePageFragment): string => fragment.id);
          } else {
            // Retain the original public input for existing static callers.
            ForEach(this.pageParagraphs, (paragraph: string, index: number) => {
              if (index > 0) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              this.fragmentText(new ReadingSurfacePageFragment(`legacy-${index}`, paragraph, true));
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
    .width(this.resolvedSurfaceWidth())
    .height('100%')
    .clip(true);
  }

  private contentInsets(): Padding {
    if (this.isTablet) {
      return { top: 92.44, right: 44.44, bottom: 56.44, left: 44.44 };
    }
    return { top: 72, right: 32, bottom: 47.99, left: 32 };
  }

  private resolvedSurfaceWidth(): Length {
    return this.surfaceWidth > 0 ? this.surfaceWidth : '100%';
  }

  @Builder
  private fragmentText(fragment: ReadingSurfacePageFragment) {
    Text() {
      if (this.highlightPrefix(fragment).length > 0) {
        Span(this.highlightPrefix(fragment));
      }
      if (this.highlightBody(fragment).length > 0) {
        Span(this.highlightBody(fragment))
          .decoration({ type: TextDecorationType.Underline, color: this.themeStyle().ink });
      }
      if (this.highlightSuffix(fragment).length > 0) {
        Span(this.highlightSuffix(fragment));
      }
    }
      .width('100%')
      .fontFamily(readerAppearanceFontFamily(this.appearance.font))
      .fontWeight(FontWeight.Regular)
      .fontSize(this.appearance.fontSize)
      .lineHeight(readerAppearanceLineHeight(this.appearance))
      .letterSpacing(this.appearance.letterSpacing)
      .fontColor(this.themeStyle().ink)
      .textAlign(readerAppearanceUsesJustify(this.appearance.alignment) ? TextAlign.JUSTIFY : TextAlign.Start)
      .textIndent(fragment.isParagraphStart ?
        readerAppearanceParagraphIndent(this.appearance.fontSize, this.appearance.indent) : 0);
  }

  private highlightPrefix(fragment: ReadingSurfacePageFragment): string {
    const range = this.fragmentHighlightRange(fragment);
    return fragment.text.substring(0, range.startUtf16);
  }

  private highlightBody(fragment: ReadingSurfacePageFragment): string {
    const range = this.fragmentHighlightRange(fragment);
    return fragment.text.substring(range.startUtf16, range.endUtf16);
  }

  private highlightSuffix(fragment: ReadingSurfacePageFragment): string {
    const range = this.fragmentHighlightRange(fragment);
    return fragment.text.substring(range.endUtf16);
  }

  private fragmentHighlightRange(fragment: ReadingSurfacePageFragment): ReadingSurfaceHighlightRange {
    const highlightStart = this.ttsHighlightStart;
    const highlightEnd = this.ttsHighlightEnd;
    if (highlightStart === undefined || highlightEnd === undefined || highlightEnd <= fragment.startScalar ||
      highlightStart >= fragment.endScalar) {
      return new ReadingSurfaceHighlightRange(0, 0);
    }
    const startScalar = Math.max(fragment.startScalar, highlightStart) - fragment.startScalar;
    const endScalar = Math.min(fragment.endScalar, highlightEnd) - fragment.startScalar;
    return new ReadingSurfaceHighlightRange(
      this.utf16ForScalar(fragment.text, startScalar),
      this.utf16ForScalar(fragment.text, endScalar),
    );
  }

  private utf16ForScalar(text: string, scalarOffset: number): number {
    let scalar = 0;
    let utf16 = 0;
    while (utf16 < text.length && scalar < scalarOffset) {
      const codePoint = text.codePointAt(utf16);
      utf16 += codePoint !== undefined && codePoint > 0xFFFF ? 2 : 1;
      scalar += 1;
    }
    return utf16;
  }

  private paperTexture(): Resource {
    return this.isTablet ? $r('app.media.reading_paper_tablet') : $r('app.media.reading_paper_phone');
  }

  private paperHighlight(): Resource {
    return this.isTablet ? $r('app.media.reading_paper_tablet_highlight') :
      $r('app.media.reading_paper_phone_highlight');
  }

  private paperShade(): Resource {
    return this.isTablet ? $r('app.media.reading_paper_tablet_shade') :
      $r('app.media.reading_paper_phone_shade');
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.appearance.activeTheme);
  }
}
