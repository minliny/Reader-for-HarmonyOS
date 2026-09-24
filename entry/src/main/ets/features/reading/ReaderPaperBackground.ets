import type { ReaderAppearanceTheme } from './ReaderAppearanceState';
import { readerAppearanceThemeStyle, type ReaderAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';

/** The same authored paper composition is used by pages and stationary system chrome. */
@Component
export struct ReaderPaperBackground {
  @Prop theme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;
  @Prop synchronousImages: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The paper color is the opaque base. Its translucent lighting must be
      // painted above it, while the repeating grain remains the top layer.
      Stack()
        .width('100%').height('100%')
        .linearGradient({
          direction: GradientDirection.Bottom,
          colors: [[this.themeStyle().paperStart, 0], [this.themeStyle().paperEnd, 1]],
        });
      if (this.themeStyle().sourcePaperLighting) {
        Image(this.paperShade())
          .syncLoad(this.synchronousImages)
          .width('100%').height('100%')
          .objectFit(ImageFit.Fill).interpolation(ImageInterpolation.High);
        Image(this.paperHighlight())
          .syncLoad(this.synchronousImages)
          .width('100%').height('100%')
          .objectFit(ImageFit.Fill).interpolation(ImageInterpolation.High);
      }
      if (this.themeStyle().paperTexture) {
        Stack()
          .width('100%').height('100%')
          .backgroundImage(this.paperTexture(), ImageRepeat.XY)
          .backgroundImageSize({ width: 100, height: 100 })
          .backgroundImagePosition(Alignment.TopStart);
      }
    }
    .width('100%').height('100%')
    .backgroundColor(this.themeStyle().paperStart)
    .hitTestBehavior(HitTestMode.None);
  }

  private themeStyle(): ReaderAppearanceThemeStyle {
    return readerAppearanceThemeStyle(this.theme);
  }

  private paperTexture(): Resource {
    return this.expanded ? $r('app.media.reading_paper_tablet') : $r('app.media.reading_paper_phone');
  }

  private paperHighlight(): Resource {
    return this.expanded ? $r('app.media.reading_paper_tablet_highlight') :
      $r('app.media.reading_paper_phone_highlight');
  }

  private paperShade(): Resource {
    return this.expanded ? $r('app.media.reading_paper_tablet_shade') : $r('app.media.reading_paper_phone_shade');
  }
}
