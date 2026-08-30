import type { ReaderTextStyle } from '../common/ReaderTypography';
import {
  TYPE_READER_IMMERSIVE_PAGE_ORDINAL,
  TYPE_READER_IMMERSIVE_PROGRESS,
  TYPE_READER_IMMERSIVE_TIME,
} from '../common/ReaderTypography';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import { readerThemePalette } from './ReaderThemePalettes';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import {
  ReaderPageChromeMeasurements,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';

/**
 * Figma `Reader/ImmersiveInfo` + the page-owned part of
 * `Reader/ImmersiveFooterStatus`.
 *
 * This component is mounted inside ReadingSurface, so it becomes part of the
 * current/previous/next page image. The interactive session capsule remains a
 * sibling overlay; its measured footprint is supplied here to keep the page
 * ordinal on the same responsive footer track.
 */
@Component
export struct ReaderPageChrome {
  @Prop topStartText: string = '';
  @Prop topEndText: string = '';
  @Prop bottomStartText: string = '';
  @Prop bottomEndText: string = '';
  @Prop sessionVisible: boolean = false;
  @Prop sessionWidth: number = 0;
  @Prop sessionHeight: number = 0;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.topStartText.length > 0) {
        Text(this.topStartText)
          .fontFamily(TYPE_READER_IMMERSIVE_TIME.fontFamily)
          .fontWeight(TYPE_READER_IMMERSIVE_TIME.fontWeight)
          .fontSize(TYPE_READER_IMMERSIVE_TIME.fontSizeFp)
          .lineHeight(TYPE_READER_IMMERSIVE_TIME.lineHeightFp)
          .letterSpacing(TYPE_READER_IMMERSIVE_TIME.letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .constraintSize({ maxWidth: this.chromeLayout().topStartMaxWidth })
          .position({ x: this.chromeLayout().topStartX, y: this.chromeLayout().topStartY });
      }

      if (this.topEndText.length > 0) {
        Text(this.topEndText)
          .fontFamily(TYPE_READER_IMMERSIVE_TIME.fontFamily)
          .fontWeight(TYPE_READER_IMMERSIVE_TIME.fontWeight)
          .fontSize(TYPE_READER_IMMERSIVE_TIME.fontSizeFp)
          .lineHeight(TYPE_READER_IMMERSIVE_TIME.lineHeightFp)
          .letterSpacing(TYPE_READER_IMMERSIVE_TIME.letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .position({ x: this.chromeLayout().topEndX, y: this.chromeLayout().topEndY });
      }

      if (this.bottomStartText.length > 0) {
        Text(this.bottomStartText)
          .fontFamily(TYPE_READER_IMMERSIVE_PROGRESS.fontFamily)
          .fontWeight(TYPE_READER_IMMERSIVE_PROGRESS.fontWeight)
          .fontSize(TYPE_READER_IMMERSIVE_PROGRESS.fontSizeFp)
          .lineHeight(TYPE_READER_IMMERSIVE_PROGRESS.lineHeightFp)
          .letterSpacing(TYPE_READER_IMMERSIVE_PROGRESS.letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .constraintSize({ maxWidth: this.chromeLayout().bottomStartMaxWidth })
          .position({ x: this.chromeLayout().bottomStartX, y: this.chromeLayout().bottomStartY });
      }

      if (this.bottomEndText.length > 0 && this.chromeLayout().bottomEndMaxWidth > 0) {
        Text(this.bottomEndText)
          .fontFamily(TYPE_READER_IMMERSIVE_PAGE_ORDINAL.fontFamily)
          .fontWeight(TYPE_READER_IMMERSIVE_PAGE_ORDINAL.fontWeight)
          .fontSize(TYPE_READER_IMMERSIVE_PAGE_ORDINAL.fontSizeFp)
          .lineHeight(TYPE_READER_IMMERSIVE_PAGE_ORDINAL.lineHeightFp)
          .letterSpacing(TYPE_READER_IMMERSIVE_PAGE_ORDINAL.letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .constraintSize({ maxWidth: this.chromeLayout().bottomEndMaxWidth })
          .position({ x: this.chromeLayout().bottomEndX, y: this.chromeLayout().bottomEndY });
      }
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.None)
    .accessibilityGroup(false);
  }

  private chromeLayout(): ReaderPageChromeLayoutSnapshot {
    const topStart = this.textMeasure(this.topStartText, TYPE_READER_IMMERSIVE_TIME);
    const topEnd = this.textMeasure(this.topEndText, TYPE_READER_IMMERSIVE_TIME);
    const bottomStart = this.textMeasure(this.bottomStartText, TYPE_READER_IMMERSIVE_PROGRESS);
    const bottomEnd = this.textMeasure(this.bottomEndText, TYPE_READER_IMMERSIVE_PAGE_ORDINAL);
    return resolveReaderPageChromeLayout(this.layout, new ReaderPageChromeMeasurements(
      topStart.width,
      topStart.height,
      topEnd.width,
      topEnd.height,
      bottomStart.width,
      bottomStart.height,
      bottomEnd.width,
      bottomEnd.height,
      this.sessionVisible,
      this.sessionWidth,
      this.sessionHeight,
    ));
  }

  private textMeasure(text: string, style: ReaderTextStyle): Size {
    if (text.length === 0) {
      return { width: 0, height: 0 };
    }
    const context = this.getUIContext();
    const widthPx = context.getMeasureUtils().measureText({
      textContent: text,
      fontSize: style.fontSizeFp,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
    });
    const lineHeight = style.lineHeightFp ?? style.fontSizeFp;
    return {
      width: Math.max(0, context.px2vp(widthPx)),
      height: lineHeight * Math.max(1, this.layout.systemFontScale),
    };
  }

  private metaColor(): string {
    return readerThemePalette(this.appearance.activeTheme).chromeMeta;
  }

}
