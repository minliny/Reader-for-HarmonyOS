import { readerThemeDefinition } from '../common/ReaderThemeRegistry';
import type { ReaderTextStyle } from '../common/ReaderTypography';
import {
  TYPE_READER_IMMERSIVE_PAGE_ORDINAL,
  TYPE_READER_IMMERSIVE_PROGRESS,
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
  READER_PAGE_CHROME_BOOKMARK_SIZE,
  resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot,
} from './ReaderPageChromeLayout';

import { measureReaderPageChromeText, readerPageChromeTextMeasurements,
  readerPageChromeTopTextStyle } from './ReaderPageChromeTextMeasurement';

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
  @StorageLink('readerSessionChromeOverlayActive') private sessionOverlayActive: boolean = false;
  @Prop isSessionOverlay: boolean = false;
  @Prop incomingOpacity: number = 1;
  @Prop footerOpacity: number = 1;
  @Prop footerTranslateX: number = 0;
  @Prop sessionExitProgress: number = 0;

  @StorageLink('readerTopInfoSuppressed') private topInfoSuppressed: boolean = false;
  @Prop topStartText: string = '';
  @Prop topEndText: string = '';
  @Prop topTranslateY: number = 0;
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
  private noSessionChromeLayout: ReaderPageChromeLayoutSnapshot | undefined = undefined;
  private topTextStyleCacheKey: string = '';
  private topTextStyleCache: ReaderTextStyle | undefined = undefined;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (!this.topInfoSuppressed && this.topStartText.length > 0) {
        Text(this.topStartText)
          .fontFamily(this.topTextStyle().fontFamily)
          .fontWeight(this.topTextStyle().fontWeight)
          .fontSize(this.topTextStyle().fontSizeFp)
          .lineHeight(this.topTextStyle().lineHeightFp)
          .letterSpacing(this.topTextStyle().letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .constraintSize({ maxWidth: this.chromeLayout().topStartMaxWidth })
          .position({ x: this.chromeLayout().topStartX, y: this.chromeLayout().topStartY })
          .translate({ y: this.topTranslateY }).opacity(this.incomingOpacity);
      }

      if (!this.topInfoSuppressed && this.topEndText.length > 0) {
        Text(this.topEndText)
          .fontFamily(this.topTextStyle().fontFamily)
          .fontWeight(this.topTextStyle().fontWeight)
          .fontSize(this.topTextStyle().fontSizeFp)
          .lineHeight(this.topTextStyle().lineHeightFp)
          .letterSpacing(this.topTextStyle().letterSpacingFp)
          .fontColor(this.metaColor())
          .maxLines(1)
          .constraintSize({ maxWidth: this.chromeLayout().topEndMaxWidth })
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .position({ x: this.chromeLayout().topEndX, y: this.chromeLayout().topEndY })
          .translate({ y: this.topTranslateY }).opacity(this.incomingOpacity);
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
          .position({ x: this.chromeLayout().bottomStartX, y: this.chromeLayout().bottomStartY }).opacity(this.incomingOpacity);
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
          .position({ x: this.chromeLayout().bottomEndX, y: this.chromeLayout().bottomEndY })
          .translate({ x: this.footerTranslateX + this.footerExitX(), y: this.footerExitY() }).opacity(this.footerOpacity);
      }
    }
    .width('100%')
    .height('100%')
    .opacity(this.isSessionOverlay || !this.sessionOverlayActive ? 1 : 0)
    .hitTestBehavior(HitTestMode.None)
    .accessibilityGroup(false);
  }

  private chromeLayout(): ReaderPageChromeLayoutSnapshot {
    const layout = this.layout;
    const context = this.getUIContext();
    const topStyle = this.topTextStyle();
    const key = JSON.stringify([this.topStartText, this.topEndText, this.bottomStartText,
      this.bottomEndText, this.sessionVisible, this.sessionWidth, this.sessionHeight,
      layout.viewportWidth, layout.viewportHeight, layout.systemFontScale,
      layout.pageChromeVisualSafeLeft, layout.pageChromeVisualSafeRight,
      layout.pageChromeVisualSafeTop, layout.pageChromeTopRegionHeight, layout.pageChromeVisualSafeBottom,
      layout.pageChromeStatusMetrics?.revision,
      layout.pageChromeInteractiveSafeRight, layout.pageChromeInteractiveSafeBottom,
      context.px2vp(1), context.fp2px(1), topStyle.fontFamily, topStyle.fontSizeFp,
      topStyle.fontWeight, topStyle.lineHeightFp, topStyle.letterSpacingFp]);
    if (key === this.chromeLayoutCacheKey && this.chromeLayoutCache !== undefined) return this.chromeLayoutCache;
    const topStart = this.textMeasure(this.topStartText, topStyle);
    const topEnd = this.textMeasure(this.topEndText, topStyle);
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
      READER_PAGE_CHROME_BOOKMARK_SIZE, READER_PAGE_CHROME_BOOKMARK_SIZE,
    ));
    this.noSessionChromeLayout = resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(
      topStart.width, topStart.height, topEnd.width, topEnd.height, bottomStart.width, bottomStart.height,
      bottomEnd.width, bottomEnd.height, false, 0, 0,
      READER_PAGE_CHROME_BOOKMARK_SIZE, READER_PAGE_CHROME_BOOKMARK_SIZE));
    this.chromeLayoutCacheKey = key;
    this.chromeLayoutCache = result;
    return result;
  }

  private footerExitX(): number {
    const current = this.chromeLayout();
    return ((this.noSessionChromeLayout?.bottomEndX ?? current.bottomEndX) - current.bottomEndX) * this.sessionExitProgress;
  }

  private footerExitY(): number {
    const current = this.chromeLayout();
    return ((this.noSessionChromeLayout?.bottomEndY ?? current.bottomEndY) - current.bottomEndY) * this.sessionExitProgress;
  }

  private textMeasure(text: string, style: ReaderTextStyle): Size {
    return measureReaderPageChromeText(text, style, this.layout, this.getUIContext(), this.textMeasureCache);
  }

  private topTextStyle(): ReaderTextStyle {
    const context = this.getUIContext();
    const key = JSON.stringify([this.layout.pageChromeStatusMetrics?.revision,
      this.layout.pageChromeStatusMetrics?.ready, this.layout.pageChromeTopRegionHeight,
      this.layout.systemFontScale, context.px2vp(1), context.fp2px(1)]);
    if (key === this.topTextStyleCacheKey && this.topTextStyleCache !== undefined) return this.topTextStyleCache;
    const style = readerPageChromeTopTextStyle(this.layout, context);
    this.topTextStyleCacheKey = key;
    this.topTextStyleCache = style;
    return style;
  }

  private metaColor(): string {
    return readerThemeDefinition(this.appearance.activeTheme).chromeMeta;
  }

}
