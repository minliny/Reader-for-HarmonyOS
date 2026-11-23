import type { UIContext } from '@ohos.arkui.UIContext';
import type { MeasureOptions } from '@ohos.measure';
import type { ReaderTextStyle, ReaderInheritedTextStyle } from '../../../ui/foundation/ReaderTypography';

export interface ReaderControlTextExtent {
  widthVp: number;
  heightVp: number;
  singleLineWidthVp: number;
  fitsWidth: boolean;
}

/** Native text metrics only. This never mounts a component or invokes a task. */
export function measureReaderControlText(context: UIContext, text: string,
  style: ReaderTextStyle | ReaderInheritedTextStyle,
  widthVp: number, policy: 'singleLine' | 'wrap' = 'singleLine'): ReaderControlTextExtent | undefined {
  if (!Number.isFinite(widthVp) || widthVp <= 0) return undefined;
  try {
    const options: MeasureOptions = { textContent: text.length > 0 ? text : '字',
      fontSize: style.fontSizeFp, fontFamily: style.fontFamily, fontWeight: style.fontWeight,
      lineHeight: style.lineHeightFp === undefined ? undefined : `${style.lineHeightFp}fp`,
      letterSpacing: style.letterSpacingFp === undefined ? undefined : `${style.letterSpacingFp}fp`,
      constraintWidth: widthVp, maxLines: policy === 'singleLine' ? 1 : undefined,
      wordBreak: WordBreak.BREAK_WORD };
    const measured = context.getMeasureUtils().measureTextSize(options);
    const singleLineWidthVp = context.px2vp(context.getMeasureUtils().measureText(options));
    const width = context.px2vp(Number(measured.width));
    const height = context.px2vp(Number(measured.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(singleLineWidthVp) || height <= 0)
      return undefined;
    const result: ReaderControlTextExtent = { widthVp: Math.max(0, width), heightVp: height,
      singleLineWidthVp, fitsWidth: policy === 'wrap' || singleLineWidthVp <= widthVp + .1 };
    return result;
  } catch (_) {
    // Missing fonts/context/layout are not zero-height evidence of a fit.
    return undefined;
  }
}
