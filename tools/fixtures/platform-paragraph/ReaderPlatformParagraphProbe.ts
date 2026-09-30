import text from '@ohos.graphics.text';
import drawing from '@ohos.graphics.drawing';

export interface ReaderParagraphConfig {
  fontFamily: string;
  fontSizePx: number;
  lineHeightPx: number;
  letterSpacingPx: number;
  alignment: 'start' | 'justify';
  indentPx: number;
}

export function buildPlatformParagraph(value: string, widthPx: number,
  config: ReaderParagraphConfig): text.Paragraph {
  const style: text.ParagraphStyle = {
    align: config.alignment === 'justify' ? text.TextAlign.JUSTIFY : text.TextAlign.START,
    textDirection: text.TextDirection.LTR,
    textStyle: {
      fontSize: config.fontSizePx,
      fontFamilies: [config.fontFamily],
      letterSpacing: config.letterSpacingPx,
      heightOnly: true,
      heightScale: config.lineHeightPx / config.fontSizePx,
      halfLeading: true,
    },
  };
  const builder = new text.ParagraphBuilder(style, text.FontCollection.getGlobalInstance());
  // This declaration-only prototype is not a reading renderer. The runnable
  // isolated diagnostic is pages/ReaderParagraphDiagnostic.ets. Preserve the
  // original source string; placeholder indices remain explicitly unverified.
  if (config.indentPx > 0) {
    builder.addPlaceholder({ width: config.indentPx, height: 0,
      align: text.PlaceholderAlignment.FOLLOW_PARAGRAPH,
      baseline: text.TextBaseline.ALPHABETIC, baselineOffset: 0 });
  }
  builder.addText(value);
  const paragraph = builder.build();
  paragraph.layoutSync(widthPx);
  return paragraph;
}

export function platformParagraphLineCount(paragraph: text.Paragraph): number {
  return paragraph.getLineMetrics().length;
}

export function paintPlatformParagraph(paragraph: text.Paragraph, canvas: drawing.Canvas,
  x: number, y: number): void {
  paragraph.paint(canvas, x, y);
}
