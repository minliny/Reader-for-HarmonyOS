import type { UIContext } from '@ohos.arkui.UIContext';
import type { ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import type { ReaderSettingsSnapshot, ReaderWidePageLayout } from '../application/ReaderSettingsState';
import { READER_BOOKMARK_RIBBON_HEIGHT, READER_BOOKMARK_RIBBON_WIDTH }
  from '../presentation/ReaderPageBookmarkModel';
import { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout,
  type ReaderPageChromeLayoutSnapshot } from './ReaderPageChromeLayout';
import { measureReaderPageChromeText, readerPageChromeTopTextStyle } from './ReaderPageChromeTextMeasurement';
import { READER_PAGE_CHROME_TOP_ROW_PADDING_VP, resolveReaderReadingLayout, type ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

interface ReaderReadingLayoutCache {
  layout: ReaderReadingLayoutSnapshot;
  width: number;
  height: number;
  windowRevision: number;
  expanded: boolean;
  cutout: boolean;
  hideStatusBar: boolean;
  hideNavigationBar: boolean;
  paged: boolean;
  wide: ReaderWidePageLayout;
  margin: number;
}

/** Retains geometry and native text measurements for the reading paper and bookmark chrome. */
export class ReaderPageGeometryHost {
  private readingLayoutCache: ReaderReadingLayoutCache | undefined;
  private bookmarkCornerLayoutCacheKey: string = '';
  private bookmarkCornerLayoutCache: ReaderPageChromeLayoutSnapshot | undefined = undefined;
  bookmarkHintX: number = 0;
  bookmarkHintY: number = 0;
  bookmarkHintWidth: number = 0;
  bookmarkHintHeight: number = 0;
  private bookmarkHintBodyTop: number = 0;

  readingLayout(width: number, height: number, metrics: ReaderWindowMetricsSnapshot, expanded: boolean,
    settings: ReaderSettingsSnapshot, margin: number, measureFooter: () => number,
    getUIContext: () => UIContext, bookTitle: () => string, clockText: () => string): ReaderReadingLayoutSnapshot {
    const cutout = settings.extendIntoCutout;
    const hideStatusBar = settings.hideStatusBar === true;
    const hideNavigationBar = settings.hideNavigationBar === true;
    const paged = settings.navigationMode === 'paged';
    const wide = settings.widePageLayout ?? 'spread';
    const cache = this.readingLayoutCache;
    if (cache !== undefined && cache.width === width && cache.height === height &&
      cache.windowRevision === metrics.revision && cache.expanded === expanded &&
      cache.cutout === cutout && cache.hideStatusBar === hideStatusBar &&
      cache.hideNavigationBar === hideNavigationBar && cache.paged === paged &&
      cache.wide === wide && cache.margin === margin) {
      return cache.layout;
    }
    // Size the shared footer for accessible text once per layout. A session
    // changes only the occupants of this band, so pagination stays stable.
    const footerHeight = measureFooter();
    let layout = resolveReaderReadingLayout(width, height, expanded, metrics, cutout,
      undefined, 0, 0, wide, margin, footerHeight, hideNavigationBar);
    if (metrics.ready && layout.pageChromeTopRegionHeight > 0) {
      const context = getUIContext();
      const topStyle = readerPageChromeTopTextStyle(layout, context);
      const title = measureReaderPageChromeText(bookTitle(), topStyle, layout, context);
      const clock = measureReaderPageChromeText(clockText(), topStyle, layout, context);
      const informationHeight = Math.max(title.height, clock.height);
      const measuredInformationLane = informationHeight + READER_PAGE_CHROME_TOP_ROW_PADDING_VP * 2;
      if (measuredInformationLane > layout.pageChromeTopRegionHeight) {
        layout = resolveReaderReadingLayout(width, height, expanded, metrics, cutout,
          undefined, informationHeight, 0, wide, margin, footerHeight, hideNavigationBar);
      }
    }
    // Reserve the full opening below the system status crop. Pagination and
    // every retained page share this settings-sensitive layout snapshot.
    layout.contentTop = Math.max(layout.contentTop, this.bookmarkRibbonPaperTop(layout, hideStatusBar) + READER_BOOKMARK_RIBBON_HEIGHT);
    this.readingLayoutCache = {
      layout, width, height, windowRevision: metrics.revision, expanded,
      cutout, hideStatusBar, hideNavigationBar, paged, wide, margin,
    };
    return layout;
  }

  bookmarkRibbonX(layout: ReaderPageChromeLayoutSnapshot): number {
    return layout.topAccessoryX + Math.max(0, (layout.topAccessoryWidth - READER_BOOKMARK_RIBBON_WIDTH) / 2);
  }

  private bookmarkFeedbackTopBoundary(layout: ReaderReadingLayoutSnapshot): number {
    const metrics = layout.pageChromeStatusMetrics;
    const status = metrics?.statusBarRect;
    const cutout = metrics?.statusBarCutoutRect;
    return Math.max(0, layout.pageChromeVisualSafeTop + layout.pageChromeTopRegionHeight,
      metrics?.ready === true && status !== undefined && status.height > 0 ? status.top + status.height : 0,
      metrics?.ready === true && cutout !== undefined && cutout.height > 0 ? cutout.top + cutout.height : 0);
  }

  bookmarkRibbonPaperTop(layout: ReaderReadingLayoutSnapshot, hideStatusBar: boolean): number {
    return hideStatusBar ? layout.pageChromeVisualSafeTop : this.bookmarkFeedbackTopBoundary(layout);
  }

  bookmarkCornerLayout(layout: ReaderReadingLayoutSnapshot, context: UIContext,
    bookTitle: string, clockText: string, settings: ReaderSettingsSnapshot): ReaderPageChromeLayoutSnapshot {
    const topStyle = readerPageChromeTopTextStyle(layout, context);
    const key = JSON.stringify([bookTitle, clockText, layout.viewportWidth,
      layout.viewportHeight, layout.contentTop, layout.contentLeft, layout.contentRight, layout.systemFontScale,
      layout.pageChromeVisualSafeTop, layout.pageChromeVisualSafeLeft, layout.pageChromeVisualSafeRight,
      layout.pageChromeTopRegionHeight, layout.pageChromeStatusMetrics?.revision,
      settings.hideStatusBar === true,
      settings.navigationMode,
      context.px2vp(1), context.fp2px(1), topStyle.fontFamily, topStyle.fontSizeFp,
      topStyle.fontWeight, topStyle.lineHeightFp, topStyle.letterSpacingFp]);
    if (key === this.bookmarkCornerLayoutCacheKey && this.bookmarkCornerLayoutCache !== undefined)
      return this.bookmarkCornerLayoutCache;
    const clock = measureReaderPageChromeText(clockText, topStyle, layout, context);
    const title = measureReaderPageChromeText(bookTitle, topStyle, layout, context);
    const result = resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(
      title.width, title.height, clock.width, clock.height, 0, 0, 0, 0, false, 0, 0,
      READER_PAGE_CHROME_BOOKMARK_SIZE, READER_PAGE_CHROME_BOOKMARK_SIZE));
    const hint = measureReaderPageChromeText('松手移除本页书签', MESSAGE_META, layout, context);
    const hintHeight = hint.height;
    this.bookmarkHintX = Math.max(layout.contentLeft, layout.pageChromeVisualSafeLeft);
    this.bookmarkHintWidth = Math.max(0, layout.viewportWidth - this.bookmarkHintX -
      Math.max(layout.contentRight, layout.pageChromeVisualSafeRight));
    this.bookmarkHintHeight = hintHeight;
    this.bookmarkHintBodyTop = layout.contentTop;
    this.bookmarkHintY = Math.max(layout.pageChromeVisualSafeTop + layout.pageChromeTopRegionHeight,
      result.topStartY + title.height, result.topEndY + clock.height,
      result.topAccessoryY + result.topAccessoryHeight, layout.contentTop - hintHeight);
    this.bookmarkCornerLayoutCacheKey = key;
    this.bookmarkCornerLayoutCache = result;
    return result;
  }

  bookmarkUnavailableHintFits(): boolean {
    return this.bookmarkHintWidth > 0 && this.bookmarkHintHeight > 0 &&
      this.bookmarkHintY + this.bookmarkHintHeight <= this.bookmarkHintBodyTop;
  }
}
