import type { ReaderTextStyle } from '../common/ReaderTypography';
import {
  TYPE_READER_IMMERSIVE_PAGE_ORDINAL,
  TYPE_READER_IMMERSIVE_PROGRESS,
  TYPE_READER_IMMERSIVE_TIME,
} from '../common/ReaderTypography';
import {
  TOK_READ_IMMERSIVE_META,
  TOK_READ_IMMERSIVE_META_NIGHT,
} from '../common/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import { readerAppearanceChromeTone } from './ReaderAppearanceRenderStyle';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import {
  ReaderPageChromeMeasurements,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';

// Font metrics are shared by mounted pages and short-lived offscreen rasters.
// The key includes typography, density and system scale; retain only 64 labels.
const readerPageChromeTextMeasurements: Map<string, Size> = new Map<string, Size>();

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
  // Geometry expressions request the same four labels repeatedly in one update.
  // Share bounded metrics across slot promotion and offscreen raster creation.
  private textMeasureCache: Map<string, Size> = readerPageChromeTextMeasurements;
  private chromeLayoutCacheKey: string = '';
  private chromeLayoutCache: ReaderPageChromeLayoutSnapshot | undefined = undefined;

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
    const layout = this.layout;
    const context = this.getUIContext();
    const key = JSON.stringify([this.topStartText, this.topEndText, this.bottomStartText,
      this.bottomEndText, this.sessionVisible, this.sessionWidth, this.sessionHeight,
      layout.viewportWidth, layout.viewportHeight, layout.systemFontScale,
      layout.pageChromeVisualSafeLeft, layout.pageChromeVisualSafeRight,
      layout.pageChromeVisualSafeTop, layout.pageChromeVisualSafeBottom,
      layout.pageChromeInteractiveSafeRight, layout.pageChromeInteractiveSafeBottom,
      context.px2vp(1), context.fp2px(1)]);
    if (key === this.chromeLayoutCacheKey && this.chromeLayoutCache !== undefined) return this.chromeLayoutCache;
    const topStart = this.textMeasure(this.topStartText, TYPE_READER_IMMERSIVE_TIME);
    const topEnd = this.textMeasure(this.topEndText, TYPE_READER_IMMERSIVE_TIME);
    const bottomStart = this.textMeasure(this.bottomStartText, TYPE_READER_IMMERSIVE_PROGRESS);
    const bottomEnd = this.textMeasure(this.bottomEndText, TYPE_READER_IMMERSIVE_PAGE_ORDINAL);
    const result = resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(
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
    this.chromeLayoutCacheKey = key;
    this.chromeLayoutCache = result;
    return result;
  }

  private textMeasure(text: string, style: ReaderTextStyle): Size {
    if (text.length === 0) {
      return { width: 0, height: 0 };
    }
    const context = this.getUIContext();
    const key = JSON.stringify([text, style.fontSizeFp, style.fontFamily,
      style.fontWeight, style.lineHeightFp, this.layout.systemFontScale,
      context.px2vp(1), context.fp2px(1)]);
    const cached = this.textMeasureCache.get(key);
    if (cached !== undefined) {
      this.textMeasureCache.delete(key);
      this.textMeasureCache.set(key, cached);
      return cached;
    }
    const widthPx = context.getMeasureUtils().measureText({
      textContent: text,
      fontSize: style.fontSizeFp,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
    });
    const lineHeight = style.lineHeightFp ?? style.fontSizeFp;
    const measured: Size = {
      width: Math.max(0, context.px2vp(widthPx)),
      height: lineHeight * Math.max(1, this.layout.systemFontScale),
    };
    if (this.textMeasureCache.size >= 64) {
      for (const oldest of this.textMeasureCache.keys()) {
        this.textMeasureCache.delete(oldest);
        break;
      }
    }
    this.textMeasureCache.set(key, measured);
    return measured;
  }

  private metaColor(): string {
    return readerAppearanceChromeTone(this.appearance.activeTheme) === 'light' ?
      TOK_READ_IMMERSIVE_META_NIGHT : TOK_READ_IMMERSIVE_META;
  }

}
