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

  constructor(id: string, text: string, isParagraphStart: boolean) {
    this.id = id;
    this.text = text;
    this.isParagraphStart = isParagraphStart;
  }
}

@Component
export struct ReadingSurface {
  /** Core-materialized title for the current pagination-manifest page. */
  @Prop chapterTitle: string;
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

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The Figma background-image list is painted front-to-back: texture,
      // gradient, highlight, shade. Stack children paint back-to-front, so
      // keep the equivalent order explicit here rather than coalescing the
      // texture with the gradient and accidentally covering it with lighting.
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

      Stack() {
      }
        .width('100%')
        .height('100%')
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [['#FBF4E9', 0], ['#EFE2D0', 1]],
        });

      Stack() {
      }
        .width('100%')
        .height('100%')
        .backgroundImage(this.paperTexture(), ImageRepeat.XY)
        .backgroundImageSize({ width: 100, height: 100 })
        .backgroundImagePosition(Alignment.TopStart);

      Column({ space: 18 }) {
          Text(this.chapterTitle)
            .width('100%')
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(23)
            .lineHeight(28.75)
            .fontColor('#2B241D')
            .textAlign(TextAlign.Center)
            // The static ReadingSurface title track is exactly one Figma
            // line; wrapping would change the measured body origin.
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

        Column() {
          if (this.pageFragments.length > 0) {
            ForEach(this.pageFragments, (fragment: ReadingSurfacePageFragment, index: number) => {
              // A continuation is not a new semantic paragraph: it must not
              // acquire either a fresh 15.8px gap or a second 2em indent.
              if (index > 0 && fragment.isParagraphStart) {
                Blank().height(15.8);
              }
              this.fragmentText(fragment);
            }, (fragment: ReadingSurfacePageFragment): string => fragment.id);
          } else {
            // Retain the original public input for existing static callers.
            ForEach(this.pageParagraphs, (paragraph: string, index: number) => {
              if (index > 0) {
                Blank().height(15.8);
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
    Text(fragment.text)
      .width('100%')
      .fontFamily('ReaderNotoSerifSCRegular')
      .fontWeight(FontWeight.Regular)
      .fontSize(18)
      .lineHeight(35.28)
      .fontColor('#2B241D')
      // Figma's Double indent is 2em: 36px at the supplied 18px body size.
      .textIndent(fragment.isParagraphStart ? 36 : 0);
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
}
