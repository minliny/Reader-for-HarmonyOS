import type { UIContext } from '@ohos.arkui.UIContext';
import type { ReaderTextStyle } from '../common/ReaderTypography';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

// Only font metrics are shared, never page/bookmark state. The bounded cache
// serves both page-owned chrome rasters and the live bookmark overlay.
export const readerPageChromeTextMeasurements: Map<string, Size> = new Map<string, Size>();

export function measureReaderPageChromeText(text: string, style: ReaderTextStyle,
  layout: ReaderReadingLayoutSnapshot, context: UIContext,
  cache: Map<string, Size> = readerPageChromeTextMeasurements): Size {
  if (text.length === 0) {
    return { width: 0, height: 0 };
  }
  const key = JSON.stringify([text, style.fontSizeFp, style.fontFamily,
    style.fontWeight, style.lineHeightFp, layout.systemFontScale,
    context.px2vp(1), context.fp2px(1)]);
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
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
    height: lineHeight * Math.max(1, layout.systemFontScale),
  };
  if (cache.size >= 64) {
    for (const oldest of cache.keys()) {
      cache.delete(oldest);
      break;
    }
  }
  cache.set(key, measured);
  return measured;
}
