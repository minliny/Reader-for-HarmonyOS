import { readerQuoteSelection, readerShareSelectionMenu } from './ReaderSharePresentation';
import { FrameNode, LengthMetrics, typeNode } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { RectShape } from '@ohos.arkui.shape';
import { text as graphicsText } from '@kit.ArkGraphics2D';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderNativeLineExtents, type ReaderNativeLineBounds } from './ReaderNativeLineExtents';
import { ReaderNativeTextStyle, readerNativeTextGeometryKey, readerNativeTextNodeGeometry, readerNativeTextNodeContent,
  readerNativeTextPunctuationOverhang } from './ReaderNativeTextMeasurement';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { readerNativeTextSliceAudit } from '../../../ui/layout/ReaderNativeTextSliceAudit';

export interface ReaderNativeGlyphRect { left: number; top: number; right: number; bottom: number; }

/** Native ink extents for page admission before transferring node ownership. */
export function readerNativeParagraphHeight(manager: LayoutManager, firstLine: number, lastLine: number): number {
  return readerNativeParagraphLineExtents(manager).height(firstLine, lastLine);
}

/** Keep native glyph overhang in each measured line, including fallback runs. */
export function readerNativeParagraphLineExtents(manager: LayoutManager): ReaderNativeLineExtents {
  return new ReaderNativeLineExtents((index: number): ReaderNativeLineBounds => {
    const line = manager.getLineMetrics(index);
    let top = line.topHeight, bottom = line.topHeight + line.height;
    if (line.endIndex > line.startIndex) {
      for (const box of manager.getRectsForRange({ start: line.startIndex, end: line.endIndex },
        graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT)) {
        top = Math.min(top, box.rect.top); bottom = Math.max(bottom, box.rect.bottom);
      }
    }
    return { top, bottom };
  });
}

/** A viewport of one shaped native paragraph. The caller transfers its Text
 * node exactly once. No source string, row Text, or Unicode mapping is rebuilt.
 * This is a platform resource owner, not another pagination/cache engine. */
export class ReaderNativeTextWindow {
  private readonly context: UIContext;
  private readonly node: typeNode.Text;
  private readonly controller: TextController;
  private readonly widthPx: number;
  private readonly punctuationOverhangPx: number;
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
  private auditedTextId: number = 0;

  constructor(context: UIContext, node: typeNode.Text, controller: TextController, widthPx: number,
    firstLine: number = 0, lastLine?: number) {
    this.context = context;
    this.node = node;
    this.controller = controller;
    this.widthPx = widthPx;
    this.punctuationOverhangPx = readerNativeTextPunctuationOverhang(node);
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
      this.root.commonAttribute.width(`${widthPx}px`).clip(this.punctuationOverhangPx === 0);
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
    const auditSlice = READER_LAYOUT_DEBUG_BUILD && (firstLine !== 0 || lastLine !== this.baseLineCount - 1);
    let inkLeft = Infinity, inkTop = Infinity, inkRight = -Infinity, inkBottom = -Infinity;
    for (const box of boxes) {
      if (!Number.isFinite(box.rect.top) || !Number.isFinite(box.rect.bottom) || box.rect.bottom < box.rect.top)
        throw new Error('NATIVE_TEXT_WINDOW_GLYPH_GEOMETRY_INVALID');
      this.topPx = Math.min(this.topPx, box.rect.top);
      bottom = Math.max(bottom, box.rect.bottom);
      if (auditSlice && Number.isFinite(box.rect.left) && Number.isFinite(box.rect.right) &&
        box.rect.right > box.rect.left && box.rect.bottom > box.rect.top) {
        inkLeft = Math.min(inkLeft, box.rect.left);
        inkTop = Math.min(inkTop, box.rect.top);
        inkRight = Math.max(inkRight, box.rect.right);
        inkBottom = Math.max(inkBottom, box.rect.bottom);
      }
    }
    this.heightPx = bottom - this.topPx;
    if (!Number.isFinite(this.topPx) || !Number.isFinite(this.heightPx) || this.heightPx <= 0)
      throw new Error('NATIVE_TEXT_WINDOW_GEOMETRY_INVALID');
    this.startUtf16 = first.startIndex;
    this.endUtf16 = last.endIndex;
    this.root?.commonAttribute.height(`${this.heightPx}px`);
    if (this.punctuationOverhangPx > 0) {
      // Keep the original line width and vertical slice. Only the clip's
      // right edge extends into the paper margin for one full-width glyph.
      this.root?.commonAttribute.clipShape(new RectShape().width(`${this.widthPx + this.punctuationOverhangPx}px`)
        .height(`${this.heightPx}px`));
    }
    this.node.commonAttribute.translate({ y: `${-this.topPx}px` });
    this.retireSliceAudit();
    if (auditSlice && inkRight > inkLeft && inkBottom > inkTop) {
      const ownerId = this.root?.getUniqueId() ?? 0;
      const textId = this.node.getUniqueId();
      if (ownerId > 0 && textId > 0) {
        const context = this.context;
        readerNativeTextSliceAudit.publish(textId, ownerId, { x: context.px2vp(inkLeft), y: context.px2vp(inkTop),
          width: context.px2vp(inkRight - inkLeft), height: context.px2vp(inkBottom - inkTop) },
          context.px2vp(this.punctuationOverhangPx));
        this.auditedTextId = textId;
      }
    }
  }

  private retireSliceAudit(): void {
    if (this.auditedTextId === 0) return;
    readerNativeTextSliceAudit.retire(this.auditedTextId);
    this.auditedTextId = 0;
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
      const left = Math.max(0, box.rect.left), right = Math.min(this.widthPx + this.punctuationOverhangPx, box.rect.right);
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

  selection(enabled: boolean, background: ResourceColor, onCopy: (range: TextRange) => void,
    onShare?: (range: TextRange, quoteRequested: boolean) => void, onActivity?: (active: boolean) => void,
    quoteAvailable: boolean = false): void {
    if (this.closed) return;
    const epoch = ++this.selectionEpoch;
    if (!enabled) this.controller.closeSelectionMenu();
    this.node.attribute.onTextSelectionChange((start: number, end: number): void => {
      if (!this.closed && epoch === this.selectionEpoch) onActivity?.(enabled && start >= 0 && end > start);
    });
    this.node.attribute.copyOption(enabled ? CopyOptions.InApp : CopyOptions.None)
      .selectedBackgroundColor(background).editMenuOptions({
        onCreateMenu: (items: Array<TextMenuItem>): Array<TextMenuItem> =>
          onShare === undefined ? items : readerShareSelectionMenu(items, quoteAvailable),
        onMenuItemClick: (item: TextMenuItem, range: TextRange): boolean => {
          const quote = quoteAvailable && readerQuoteSelection(item.id);
          const share = onShare !== undefined && (quote || item.id.equals(TextMenuItemId.SHARE));
          if (!share && !item.id.equals(TextMenuItemId.COPY)) return false;
          if (!this.closed && enabled && epoch === this.selectionEpoch) {
            if (share) {
              this.controller.closeSelectionMenu();
              onShare?.(range, quote);
            } else {
              onCopy(range);
            }
          }
          return true;
        },
      });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.retireSliceAudit();
    const root = this.root;
    const attached = this.attached;
    this.root = undefined;
    this.attached = false;
    // The SDK can reject a node already retired by the native tree. Each
    // actor still gets its own disposal attempt and the owner can drain the
    // remaining paragraphs without masking a preceding shaping failure.
    try { if (attached) root?.removeChild(this.node); }
    catch (_) { hilog.warn(0x5244, 'Reader', 'Native text window detach failed'); }
    try { this.node.dispose(); }
    catch (_) { hilog.warn(0x5244, 'Reader', 'Native text window node disposal failed'); }
    try { root?.dispose(); }
    catch (_) { hilog.warn(0x5244, 'Reader', 'Native text window root disposal failed'); }
  }
}
