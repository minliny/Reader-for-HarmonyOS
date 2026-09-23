import type { UIContext } from '@ohos.arkui.UIContext';
import type { MeasureOptions } from '@ohos.measure';
import { ReaderTextStyle, TYPE_READER_IMMERSIVE_TIME } from '../common/ReaderTypography';
import { READER_FONT_HARMONYOS_SANS } from '../common/ReaderFontFamilies';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

// Only font metrics are shared, never page/bookmark state. The bounded cache
// serves both page-owned chrome rasters and the live bookmark overlay.
export const readerPageChromeTextMeasurements: Map<string, Size> = new Map<string, Size>();

/**
 * OpenHarmony SystemUI ClockIcon uses body2, the system font and AUTO line
 * height (applications_systemui d0f84037f1975dd9bf13ccbd279bd2d9b56e8a01).
 * A public status rectangle is not an OEM glyph baseline. Resolve the public
 * typography resource instead of deriving a font size from that rectangle.
 */
export function readerPageChromeTopTextStyle(layout: ReaderReadingLayoutSnapshot,
  context: UIContext): ReaderTextStyle {
  if (layout.pageChromeStatusMetrics?.ready !== true || layout.pageChromeTopRegionHeight <= 0) {
    return TYPE_READER_IMMERSIVE_TIME;
  }
  try {
    // getNumber(id) returns px for an fp resource; px2fp prevents applying
    // density or accessibility scaling a second time in Text/MeasureUtils.
    const px = context.getHostContext()?.resourceManager.getNumber($r('sys.float.ohos_id_text_size_body2').id);
    const fp = px === undefined ? 0 : context.px2fp(px);
    if (Number.isFinite(fp) && fp > 0) {
      return new ReaderTextStyle(READER_FONT_HARMONYOS_SANS, 400, fp, undefined,
        undefined, 'system', 'platformCalibration');
    }
  } catch (_) {
    // An unavailable system resource retains the explicit design fallback;
    // never infer a replacement size from a cutout or status-area height.
  }
  return TYPE_READER_IMMERSIVE_TIME;
}

export function measureReaderPageChromeText(text: string, style: ReaderTextStyle,
  layout: ReaderReadingLayoutSnapshot, context: UIContext,
  cache: Map<string, Size> = readerPageChromeTextMeasurements): Size {
  if (text.length === 0) {
    return { width: 0, height: 0 };
  }
  const key = JSON.stringify([text, style.fontSizeFp, style.fontFamily,
    style.fontWeight, style.lineHeightFp, style.letterSpacingFp, layout.systemFontScale,
    context.px2vp(1), context.fp2px(1)]);
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const options: MeasureOptions = {
    textContent: text,
    fontSize: style.fontSizeFp,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacingFp,
  };
  const automatic = style.lineHeightFp === undefined ? context.getMeasureUtils().measureTextSize(options) : undefined;
  const widthPx = automatic === undefined ? context.getMeasureUtils().measureText(options) : Number(automatic.width ?? 0);
  const measured: Size = {
    width: Math.max(0, context.px2vp(widthPx)),
    height: automatic === undefined ?
      Math.max(0, context.px2vp(context.fp2px(style.lineHeightFp ?? style.fontSizeFp))) :
      Math.max(0, context.px2vp(Number(automatic.height ?? 0))),
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
