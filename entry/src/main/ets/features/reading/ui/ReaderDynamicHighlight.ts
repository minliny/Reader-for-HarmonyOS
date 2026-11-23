/** Geometry/state stays in ArkUI. Native applies these marks in page UV space,
 * so a curl never freezes them into a text/image snapshot. */
export interface ReaderDynamicHighlightRect {
  left: number; top: number; right: number; bottom: number;
  color: string; multiply: boolean;
}
export function readerDynamicHighlightRectsEqual(a: ReaderDynamicHighlightRect[], b: ReaderDynamicHighlightRect[]): boolean {
  return a.length === b.length && a.every((rect: ReaderDynamicHighlightRect, index: number): boolean => {
    const other = b[index];
    return rect.left === other.left && rect.top === other.top && rect.right === other.right &&
      rect.bottom === other.bottom && rect.color === other.color && rect.multiply === other.multiply;
  });
}
export function readerHighlightValuesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value: number, index: number): boolean => value === b[index]);
}

export interface ReaderHighlightTextSlice {
  startUtf16: number; endUtf16: number;
  prefix: string; body: string; suffix: string;
}

/** One bounded entry per mounted fragment; scan Unicode once, not once per Span attribute. */
export class ReaderHighlightTextCache {
  private text: string | undefined = undefined;
  private start: number = -1;
  private end: number = -1;
  private value: ReaderHighlightTextSlice = { startUtf16: 0, endUtf16: 0, prefix: '', body: '', suffix: '' };
  sample(text: string, fragmentStart: number, fragmentEnd: number,
    highlightStart: number | undefined, highlightEnd: number | undefined): ReaderHighlightTextSlice {
    const valid = highlightStart !== undefined && highlightEnd !== undefined &&
      Number.isFinite(highlightStart) && Number.isFinite(highlightEnd) && highlightEnd > highlightStart &&
      highlightEnd > fragmentStart && highlightStart < fragmentEnd;
    const start = valid ? Math.max(fragmentStart, highlightStart!) - fragmentStart : 0;
    const end = valid ? Math.min(fragmentEnd, highlightEnd!) - fragmentStart : 0;
    if (this.text === text && this.start === start && this.end === end) return this.value;
    let scalar = 0;
    let utf16 = 0;
    let startUtf16 = 0;
    const startBoundary = Math.ceil(start);
    while (utf16 < text.length && scalar < end) {
      const point = text.codePointAt(utf16);
      utf16 += point !== undefined && point > 0xFFFF ? 2 : 1;
      scalar += 1;
      if (scalar <= startBoundary) startUtf16 = utf16;
    }
    this.text = text; this.start = start; this.end = end;
    this.value = { startUtf16, endUtf16: utf16, prefix: text.substring(0, startUtf16),
      body: text.substring(startUtf16, utf16), suffix: text.substring(utf16) };
    return this.value;
  }
}
export function readerHighlightColor(color: string): number[] {
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) throw new Error('READING_HIGHLIGHT_COLOR_INVALID');
  const alpha = color.length === 9 ? Number.parseInt(color.slice(1, 3), 16) / 255 : 1;
  const start = color.length === 9 ? 3 : 1;
  return [Number.parseInt(color.slice(start, start + 2), 16) / 255,
    Number.parseInt(color.slice(start + 2, start + 4), 16) / 255,
    Number.parseInt(color.slice(start + 4, start + 6), 16) / 255, alpha];
}
export function readerHighlightCanvasColor(color: string): string {
  const rgba = readerHighlightColor(color);
  return `rgba(${Math.round(rgba[0] * 255)},${Math.round(rgba[1] * 255)},${Math.round(rgba[2] * 255)},${rgba[3]})`;
}
export function readerNativeHighlightValues(rects: ReaderDynamicHighlightRect[], width: number, height: number): number[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  if (rects.length > 64) throw new Error('READING_HIGHLIGHT_RECT_LIMIT');
  const values: number[] = [];
  for (const rect of rects) {
    if (![rect.left, rect.top, rect.right, rect.bottom].every((value: number): boolean => Number.isFinite(value))) {
      throw new Error('READING_HIGHLIGHT_RECT_INVALID');
    }
    const left = Math.max(0, Math.min(1, rect.left / width));
    const right = Math.max(0, Math.min(1, rect.right / width));
    const top = Math.max(0, Math.min(1, rect.top / height));
    const bottom = Math.max(0, Math.min(1, rect.bottom / height));
    if (right <= left || bottom <= top) continue;
    const rgba = readerHighlightColor(rect.color);
    values.push(left, top, right, bottom, rgba[0], rgba[1], rgba[2], rect.multiply ? -rgba[3] : rgba[3]);
  }
  return values;
}
