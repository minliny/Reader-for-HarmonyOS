import { text as graphicsText } from '@kit.ArkGraphics2D';

interface SourceTextLine {
  start: number;
  end: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  baselinePx: number;
}

interface SourceTextLabelMetrics {
  role: string;
  lines: SourceTextLine[];
}

interface SourceTextRect {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
}

interface SourceTextRange {
  length: number;
  tailStart: number;
  prefix: boolean;
}

export interface SourceTextLayoutLabel extends SourceTextLabelMetrics {
  utf16Length: number;
  startUtf16: number;
  endUtf16: number;
  complete: boolean;
  rangeRects: SourceTextRect[];
  tailRects: SourceTextRect[];
}

const SOURCE_TEXT_PROBE_LINE_LIMIT = 4;
const SOURCE_TEXT_PROBE_PREFIX_LINE_LIMIT = 12;
const SOURCE_TEXT_PROBE_RECT_LIMIT = 12;
const SOURCE_TEXT_PROBE_LABEL_LIMIT = 9;
const SOURCE_TEXT_PROBE_LOGIN_ROLE = 'row/login';

function sourceTextLine(line: LineMetrics): SourceTextLine {
  return { start: line.startIndex, end: line.endIndex, leftPx: line.left, topPx: line.topHeight,
    widthPx: line.width, heightPx: line.height, baselinePx: line.baseline };
}

function sourceTextRects(layout: LayoutManager, start: number, end: number): SourceTextRect[] {
  const boxes = layout.getRectsForRange({ start, end }, graphicsText.RectWidthStyle.TIGHT, graphicsText.RectHeightStyle.TIGHT);
  if (boxes.length > SOURCE_TEXT_PROBE_RECT_LIMIT) return [];
  const result: SourceTextRect[] = [];
  for (const box of boxes) {
    const rect = box.rect;
    if (![rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) ||
      rect.right <= rect.left || rect.bottom <= rect.top) return [];
    result.push({ leftPx: rect.left, topPx: rect.top, rightPx: rect.right, bottomPx: rect.bottom });
  }
  return result;
}

/** Optional readers of mounted native Text nodes. No layout or style is overridden. */
export class ReaderSourceTextMetrics {
  private readonly sourceId: string;
  private readonly labels: Map<string, TextOptions> = new Map();
  private readonly tracked: Map<string, SourceTextRange> = new Map();

  constructor(sourceId: string) { this.sourceId = sourceId; }

  readonly options = (role: string, sourceId?: string): TextOptions | undefined => {
    if (sourceId !== undefined && sourceId !== this.sourceId) return undefined;
    const current = this.labels.get(role);
    if (current !== undefined) return current;
    const options: TextOptions = { controller: new TextController() };
    this.labels.set(role, options);
    return options;
  };

  track(role: string, text: string, prefix: boolean = false): TextOptions | undefined {
    const length = text.length;
    // The exact public Login fixture adds a single extra role to the normal row.
    const ordinaryLabels = this.tracked.size - (this.tracked.has(SOURCE_TEXT_PROBE_LOGIN_ROLE) ? 1 : 0);
    if (length === 0 || length > 512 || !this.tracked.has(role) && role !== SOURCE_TEXT_PROBE_LOGIN_ROLE &&
      ordinaryLabels >= SOURCE_TEXT_PROBE_LABEL_LIMIT)
      return undefined;
    const last = text.charCodeAt(length - 1);
    const preceding = length > 1 ? text.charCodeAt(length - 2) : 0;
    const tailStart = last >= 0xDC00 && last <= 0xDFFF && preceding >= 0xD800 && preceding <= 0xDBFF ? length - 2 : length - 1;
    this.tracked.set(role, { length, tailStart, prefix });
    return this.options(role);
  }

  readTracked(roles?: string[]): SourceTextLayoutLabel[] {
    const labels: SourceTextLayoutLabel[] = [];
    this.tracked.forEach((range: SourceTextRange, role: string): void => {
      if (roles !== undefined && !roles.includes(role)) return;
      const result: SourceTextLayoutLabel = { role, utf16Length: range.length, startUtf16: 0, endUtf16: 0,
        complete: false, lines: [], rangeRects: [], tailRects: [] };
      labels.push(result);
      try {
        const layout = this.labels.get(role)?.controller?.getLayoutManager();
        const count = layout?.getLineCount() ?? 0;
        if (layout === undefined || !Number.isSafeInteger(count) || count <= 0 ||
          count > (range.prefix ? SOURCE_TEXT_PROBE_PREFIX_LINE_LIMIT : SOURCE_TEXT_PROBE_LINE_LIMIT)) return;
        let contiguous = true;
        for (let index = 0; index < count; index += 1) {
          const line = sourceTextLine(layout.getLineMetrics(index));
          // A rich notice appends spacing for its overlaid actions. That spacing
          // lies outside the tracked tag and message and has no business tail.
          if (range.prefix && line.start >= range.length) break;
          if (range.prefix) line.end = Math.min(line.end, range.length);
          if (!Number.isSafeInteger(line.start) || !Number.isSafeInteger(line.end) || line.start < 0 ||
            line.start >= line.end || line.end > range.length ||
            ![line.leftPx, line.topPx, line.widthPx, line.heightPx, line.baselinePx].every(Number.isFinite) ||
            line.widthPx <= 0 || line.heightPx <= 0) return;
          if (index === 0) result.startUtf16 = line.start;
          contiguous = contiguous && line.start === result.endUtf16;
          result.endUtf16 = line.end;
          result.lines.push(line);
        }
        result.rangeRects = sourceTextRects(layout, result.startUtf16, result.endUtf16);
        result.tailRects = sourceTextRects(layout, range.tailStart, range.length);
        result.complete = contiguous && result.endUtf16 === range.length && result.rangeRects.length > 0 && result.tailRects.length > 0;
      } catch (_unavailable) {
        // No fresh mounted native Text observation for this range.
      }
    });
    return labels;
  }

  read(): SourceTextLabelMetrics[] {
    const labels: SourceTextLabelMetrics[] = [];
    this.labels.forEach((options: TextOptions, role: string): void => {
      const lines: SourceTextLine[] = [];
      try {
        const layout = options.controller.getLayoutManager();
        const count = layout.getLineCount();
        for (let index = 0; index < count; index += 1) {
          lines.push(sourceTextLine(layout.getLineMetrics(index)));
        }
      } catch (_unavailable) {
        // An unmounted or retired Text cannot supply a measurement.
        lines.length = 0;
      }
      labels.push({ role, lines });
    });
    return labels;
  }
}
