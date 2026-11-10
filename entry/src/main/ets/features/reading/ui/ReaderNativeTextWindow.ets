import { FrameNode, LengthMetrics, typeNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { text as graphicsText } from '@kit.ArkGraphics2D';
import { ReaderNativeTextStyle, readerNativeTextGeometryKey, readerNativeTextNodeGeometry, readerNativeTextNodeContent } from './ReaderNativeTextMeasurement';

export interface ReaderNativeGlyphRect { left: number; top: number; right: number; bottom: number; }

/** Native ink extents for page admission before transferring node ownership. */
export function readerNativeParagraphHeight(manager: LayoutManager, firstLine: number, lastLine: number): number {
  const first = manager.getLineMetrics(firstLine), last = manager.getLineMetrics(lastLine);
  let top = first.topHeight, bottom = last.topHeight + last.height;
  for (const box of manager.getRectsForRange({ start: first.startIndex, end: last.endIndex },
    graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT)) {
    top = Math.min(top, box.rect.top); bottom = Math.max(bottom, box.rect.bottom);
  }
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top)
    throw new Error('NATIVE_TEXT_WINDOW_GEOMETRY_INVALID');
  return bottom - top;
}

/** A viewport of one shaped native paragraph. The caller transfers its Text
 * node exactly once. No source string, row Text, or Unicode mapping is rebuilt.
 * This is a platform resource owner, not another pagination/cache engine. */
export class ReaderNativeTextWindow {
  private readonly context: UIContext;
  private readonly node: typeNode.Text;
  private readonly controller: TextController;
  private readonly widthPx: number;
  private readonly geometryKey: string | undefined;
  private readonly originalText: string | undefined;
  private readonly density: number;
  private readonly fontScalePx: number;
  private root: FrameNode | undefined;
  private readonly base: Map<number, LineMetrics> = new Map();
  private baseLineCount: number = 0;
  private attached: boolean = false;
  private closed: boolean = false;
  private gapVp: number = 0;
  private topPx: number = 0;
  private heightPx: number = 0;
  private startUtf16: number = 0;
  private endUtf16: number = 0;
  private selectionEpoch: number = 0;

  constructor(context: UIContext, node: typeNode.Text, controller: TextController, widthPx: number,
    firstLine: number = 0, lastLine?: number) {
    this.context = context;
    this.node = node;
    this.controller = controller;
    this.widthPx = widthPx;
    this.geometryKey = readerNativeTextNodeGeometry(node);
    this.originalText = readerNativeTextNodeContent(node);
    this.density = context.vp2px(1);
    this.fontScalePx = context.fp2px(1);
    try {
      this.root = new FrameNode(context);
      if (!Number.isFinite(widthPx) || widthPx <= 0) throw new Error('NATIVE_TEXT_WINDOW_WIDTH_INVALID');
      const manager = controller.getLayoutManager();
      this.baseLineCount = manager.getLineCount();
      if (this.baseLineCount === 0) throw new Error('NATIVE_TEXT_WINDOW_EMPTY');
      const last = lastLine ?? this.baseLineCount - 1;
      if (!Number.isSafeInteger(firstLine) || !Number.isSafeInteger(last) || firstLine < 0 ||
        last < firstLine || last >= this.baseLineCount) throw new Error('NATIVE_TEXT_WINDOW_RANGE_INVALID');
      // The production owner supplies just its admitted visible range. Keep
      // baseline/width evidence for that range without a whole-paragraph copy.
      for (let line = firstLine; line <= last; line += 1) this.base.set(line, manager.getLineMetrics(line));
      this.root.commonAttribute.width(`${widthPx}px`).clip(true);
      this.root.appendChild(node);
      this.attached = true;
    } catch (error) {
      this.close();
      throw error as Error;
    }
  }

  configure(firstLine: number, lastLine: number, gapVp: number = 0): void {
    if (this.closed) throw new Error('NATIVE_TEXT_WINDOW_CLOSED');
    if (!Number.isSafeInteger(firstLine) || !Number.isSafeInteger(lastLine) || firstLine < 0 ||
      lastLine < firstLine || !this.base.has(firstLine) || !this.base.has(lastLine) || !Number.isFinite(gapVp) || gapVp < 0)
      throw new Error('NATIVE_TEXT_WINDOW_RANGE_INVALID');
    if (gapVp !== this.gapVp) {
      this.node.attribute.lineSpacing(LengthMetrics.vp(gapVp), { onlyBetweenLines: true });
      this.node.measure({ minSize: { width: this.widthPx, height: 0 },
        maxSize: { width: this.widthPx, height: 1048576 },
        percentReference: { width: this.widthPx, height: 1048576 } });
      this.node.layout({ x: 0, y: 0 });
      this.gapVp = gapVp;
    }
    const manager = this.controller.getLayoutManager();
    if (manager.getLineCount() !== this.baseLineCount) throw new Error('NATIVE_TEXT_WINDOW_REFLOWED');
    for (const entry of this.base) {
      const metric = manager.getLineMetrics(entry[0]), original = entry[1];
      if (metric.startIndex !== original.startIndex || metric.endIndex !== original.endIndex ||
        Math.abs(metric.width - original.width) > 0.01) throw new Error('NATIVE_TEXT_WINDOW_REFLOWED');
    }
    const first = manager.getLineMetrics(firstLine), last = manager.getLineMetrics(lastLine);
    const originalFirst = this.base.get(firstLine)!, originalLast = this.base.get(lastLine)!;
    // Native between-line spacing changes topHeight and baseline independently
    // for fallback fonts. Keep the original top/bottom ink allowance, using the
    // final baseline separation. topHeight alone would shift or clip the text.
    this.topPx = first.baseline - (originalFirst.baseline - originalFirst.topHeight);
    let bottom = last.baseline + originalLast.topHeight + originalLast.height - originalLast.baseline;
    // Fallback glyph runs (notably Emoji) can extend beyond the line's
    // primary-font baseline box. The same layout manager owns those bounds;
    // retaining old descent alone is insufficient after line-spacing changes.
    const boxes = manager.getRectsForRange({ start: first.startIndex, end: last.endIndex },
      graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT);
    for (const box of boxes) {
      if (!Number.isFinite(box.rect.top) || !Number.isFinite(box.rect.bottom) || box.rect.bottom < box.rect.top)
        throw new Error('NATIVE_TEXT_WINDOW_GLYPH_GEOMETRY_INVALID');
      this.topPx = Math.min(this.topPx, box.rect.top);
      bottom = Math.max(bottom, box.rect.bottom);
    }
    this.heightPx = bottom - this.topPx;
    if (!Number.isFinite(this.topPx) || !Number.isFinite(this.heightPx) || this.heightPx <= 0)
      throw new Error('NATIVE_TEXT_WINDOW_GEOMETRY_INVALID');
    this.startUtf16 = first.startIndex;
    this.endUtf16 = last.endIndex;
    this.root?.commonAttribute.height(`${this.heightPx}px`);
    this.node.commonAttribute.translate({ y: `${-this.topPx}px` });
  }

  frame(): FrameNode | null { return this.closed ? null : this.root ?? null; }
  clipTopPx(): number { return this.topPx; }
  clipHeightPx(): number { return this.heightPx; }
  clipHeightVp(): number { return this.context.px2vp(this.heightPx); }

  visibleStartUtf16(): number { return this.startUtf16; }
  visibleEndUtf16(): number { return this.endUtf16; }
  lineCount(): number { return this.baseLineCount; }
  coversWholeParagraph(): boolean { return this.base.has(0) && this.base.has(this.baseLineCount - 1); }

  matchesGeometry(context: UIContext, style: ReaderNativeTextStyle, text: string): boolean {
    return !this.closed && this.geometryKey === readerNativeTextGeometryKey(style) && this.originalText === text &&
      this.density === context.vp2px(1) && this.fontScalePx === context.fp2px(1);
  }

  /** The Text has always shaped the original complete paragraph. A fresh,
   * unmounted page window can expose that same shape without measuring again.
   * The resource owner must reject mounted windows before calling this. */
  prepareWholeParagraph(): boolean {
    if (this.closed || this.gapVp !== 0) return false;
    const manager = this.controller.getLayoutManager();
    if (manager.getLineCount() !== this.baseLineCount) return false;
    for (let line = 0; line < this.baseLineCount; line += 1) {
      if (!this.base.has(line)) this.base.set(line, manager.getLineMetrics(line));
    }
    this.configure(0, this.baseLineCount - 1, 0);
    return true;
  }

  /** Continuous restoration uses the same native line facts as selection;
   * character fractions are not proportional to wrapped pixel heights. */
  lineTopForUtf16(offset: number): number {
    if (this.closed) return 0;
    const manager = this.controller.getLayoutManager();
    let low = 0, high = this.baseLineCount - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (manager.getLineMetrics(middle).endIndex <= offset) low = middle + 1;
      else high = middle;
    }
    return this.context.px2vp(Math.max(0, manager.getLineMetrics(low).topHeight - this.topPx));
  }

  lineStartForY(yVp: number): number {
    if (this.closed) return 0;
    const manager = this.controller.getLayoutManager();
    const y = this.context.vp2px(Math.max(0, yVp)) + this.topPx;
    let low = 0, high = this.baseLineCount - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (manager.getLineMetrics(middle).topHeight <= y) low = middle;
      else high = middle - 1;
    }
    return Math.max(this.startUtf16, Math.min(this.endUtf16, manager.getLineMetrics(low).startIndex));
  }

  /** Selection/TTS use this same native layout, translated into the visible
   * window. Returning no rectangles after release fences late audio callbacks. */
  glyphRects(start: number, end: number): ReaderNativeGlyphRect[] {
    if (this.closed || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) return [];
    const first = Math.max(start, this.startUtf16), last = Math.min(end, this.endUtf16);
    if (last <= first) return [];
    const boxes = this.controller.getLayoutManager().getRectsForRange({ start: first, end: last },
      graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT);
    const result: ReaderNativeGlyphRect[] = [];
    for (const box of boxes) {
      const left = Math.max(0, box.rect.left), right = Math.min(this.widthPx, box.rect.right);
      const top = Math.max(0, box.rect.top - this.topPx);
      const bottom = Math.min(this.heightPx, box.rect.bottom - this.topPx);
      if (![left, right, top, bottom].every((value: number): boolean => Number.isFinite(value)))
        throw new Error('NATIVE_TEXT_WINDOW_GLYPH_GEOMETRY_INVALID');
      if (right > left && bottom > top) result.push({ left, right, top, bottom });
    }
    return result;
  }

  color(value: ResourceColor): void {
    if (!this.closed) this.node.attribute.fontColor(value);
  }

  selection(enabled: boolean, background: ResourceColor, onCopy: (range: TextRange) => void): void {
    if (this.closed) return;
    const epoch = ++this.selectionEpoch;
    if (!enabled) this.controller.closeSelectionMenu();
    this.node.attribute.copyOption(enabled ? CopyOptions.InApp : CopyOptions.None)
      .selectedBackgroundColor(background).editMenuOptions({
        onCreateMenu: (items: Array<TextMenuItem>): Array<TextMenuItem> => items,
        onMenuItemClick: (item: TextMenuItem, range: TextRange): boolean => {
          if (!item.id.equals(TextMenuItemId.COPY)) return false;
          if (!this.closed && enabled && epoch === this.selectionEpoch) onCopy(range);
          return true;
        },
      });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.attached) this.root?.removeChild(this.node);
    } finally {
      this.attached = false;
      try { this.node.dispose(); }
      finally { this.root?.dispose(); this.root = undefined; }
    }
  }
}
