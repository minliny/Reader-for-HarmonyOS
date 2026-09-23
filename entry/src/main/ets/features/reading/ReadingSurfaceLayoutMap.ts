/**
 * ReadingSurface-only position bridge.
 *
 * Reader Core persists a chapter offset as a Unicode-scalar count. ArkUI's
 * TextController LayoutManager reports line ranges in UTF-16 code units. This
 * map is deliberately small and feature-local: it prevents a layout line from
 * being passed to Core with the wrong index unit; it is not a general text
 * engine or a second reading-position store.
 */

export type ReadingSurfaceLineMetric = {
  startIndex: number;
  endIndex: number;
  height: number;
  topHeight: number;
  width: number;
  baseline: number;
};

export type ReadingSurfaceLine = {
  startScalar: number;
  endScalar: number;
  height: number;
  topHeight: number;
  width: number;
  baseline: number;
};

/**
 * Exact boundary table for one unmodified Core chapter string. A boundary is
 * present before the first scalar, after every scalar, and at the UTF-16 end.
 */
/** A resident range in the immutable chapter's absolute scalar space. */
export type ReadingDocumentRange = {
  readonly startScalar: number;
  readonly endScalar: number;
  readonly totalScalars: number;
};

export class ReadingSurfaceLayoutMap {
  private readonly scalarBoundaries: number[] = [0];

  private content: string;

  private range: ReadingDocumentRange;

  constructor(content: string, range?: ReadingDocumentRange) {
    this.content = content;
    let utf16Offset = 0;
    for (const scalar of content) {
      utf16Offset += scalar.length;
      this.scalarBoundaries.push(utf16Offset);
    }
    this.range = { startScalar: 0, endScalar: 0, totalScalars: 0 };
    this.finishRange(range);
  }

  /** Build an optional large chapter map without monopolizing the UI thread.
   * The instance remains private until complete; cancellation publishes none. */
  static async prepare(content: string, range: ReadingDocumentRange | undefined,
    isCurrent: () => boolean): Promise<ReadingSurfaceLayoutMap> {
    const map = new ReadingSurfaceLayoutMap('');
    map.content = content;
    let utf16Offset = 0, batch = 0;
    if (!isCurrent()) throw new Error('reading layout map preparation cancelled');
    for (const scalar of content) {
      utf16Offset += scalar.length;
      map.scalarBoundaries.push(utf16Offset);
      if (++batch === 8192) {
        batch = 0;
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
        if (!isCurrent()) throw new Error('reading layout map preparation cancelled');
      }
    }
    if (!isCurrent()) throw new Error('reading layout map preparation cancelled');
    map.finishRange(range);
    return map;
  }

  private finishRange(range?: ReadingDocumentRange): void {
    const count = this.scalarBoundaries.length - 1;
    this.range = range === undefined ? { startScalar: 0, endScalar: count, totalScalars: count } : { ...range };
    if (![this.range.startScalar, this.range.endScalar, this.range.totalScalars].every(
      (value: number): boolean => Number.isSafeInteger(value) && value >= 0) ||
      this.range.endScalar - this.range.startScalar !== count || this.range.endScalar > this.range.totalScalars) {
      throw new Error('ReadingSurface resident range is invalid');
    }
  }

  scalarCount(): number { return this.range.totalScalars; }
  residentStart(): number { return this.range.startScalar; }
  residentEnd(): number { return this.range.endScalar; }
  isComplete(): boolean { return this.residentStart() === 0 && this.residentEnd() === this.scalarCount(); }
  containsScalar(offset: number): boolean {
    return Number.isSafeInteger(offset) && offset >= this.residentStart() && offset <= this.residentEnd();
  }

  utf16Length(): number {
    return this.content.length;
  }

  utf16ForScalar(scalarOffset: number): number {
    this.requireScalarOffset(scalarOffset);
    return this.scalarBoundaries[scalarOffset - this.residentStart()];
  }

  scalarForUtf16(utf16Offset: number): number {
    this.requireUtf16Offset(utf16Offset);
    let low = 0;
    let high = this.scalarBoundaries.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = this.scalarBoundaries[middle];
      if (candidate === utf16Offset) {
        return this.residentStart() + middle;
      }
      if (candidate < utf16Offset) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    throw new Error('ArkUI line boundary splits a Unicode scalar');
  }

  sliceByScalar(startScalar: number, endScalar: number): string {
    this.requireScalarOffset(startScalar);
    this.requireScalarOffset(endScalar);
    if (endScalar < startScalar) {
      throw new Error('ReadingSurface scalar range is reversed');
    }
    return this.content.substring(
      this.scalarBoundaries[startScalar - this.residentStart()],
      this.scalarBoundaries[endScalar - this.residentStart()],
    );
  }

  /** Derive a paragraph window from validated boundaries without scanning
   * Unicode text again. Absolute chapter offsets and total length survive. */
  slice(startScalar: number, endScalar: number): ReadingSurfaceLayoutMap {
    const content = this.sliceByScalar(startScalar, endScalar);
    const map = new ReadingSurfaceLayoutMap('');
    map.content = content;
    const start = startScalar - this.residentStart();
    const end = endScalar - this.residentStart();
    const origin = this.scalarBoundaries[start];
    for (let index = start + 1; index <= end; index += 1) {
      map.scalarBoundaries.push(this.scalarBoundaries[index] - origin);
    }
    map.finishRange({ startScalar, endScalar, totalScalars: this.scalarCount() });
    return map;
  }

  linesFromArkUI(metrics: ReadingSurfaceLineMetric[]): ReadingSurfaceLine[] {
    const lines: ReadingSurfaceLine[] = [];
    let previousEnd = 0;
    for (const metric of metrics) {
      this.requireMetric(metric);
      if (metric.startIndex < previousEnd) {
        throw new Error('ArkUI line metrics are not monotonic');
      }
      const startScalar = this.scalarForUtf16(metric.startIndex);
      const endScalar = this.scalarForUtf16(metric.endIndex);
      if (endScalar < startScalar) {
        throw new Error('ArkUI line metric range is reversed');
      }
      lines.push({
        startScalar,
        endScalar,
        height: metric.height,
        topHeight: metric.topHeight,
        width: metric.width,
        baseline: metric.baseline,
      });
      previousEnd = metric.endIndex;
    }
    return lines;
  }

  private requireScalarOffset(value: number): void {
    if (!this.containsScalar(value)) {
      throw new Error('ReadingSurface scalar offset is out of range');
    }
  }

  private requireUtf16Offset(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > this.utf16Length()) {
      throw new Error('ArkUI UTF-16 offset is out of range');
    }
  }

  private requireMetric(metric: ReadingSurfaceLineMetric): void {
    if (!Number.isSafeInteger(metric.startIndex) || !Number.isSafeInteger(metric.endIndex) ||
      metric.startIndex < 0 || metric.endIndex < metric.startIndex ||
      metric.endIndex > this.utf16Length()) {
      throw new Error('ArkUI line metric has an invalid UTF-16 range');
    }
    if (!Number.isFinite(metric.height) || metric.height < 0 ||
      !Number.isFinite(metric.topHeight) || metric.topHeight < 0 ||
      !Number.isFinite(metric.width) || metric.width < 0 ||
      !Number.isFinite(metric.baseline)) {
      throw new Error('ArkUI line metric has invalid geometry');
    }
  }
}

/** A chapter object is immutable. Its text boundary table is shared by layout,
 * anchor restoration and page-turn preparation and released with that object. */
export type ReadingChapterText = { readonly content: string; readonly documentRange?: ReadingDocumentRange; readonly textLayoutIdentity?: { readonly content: string; readonly documentRange?: ReadingDocumentRange } };
const chapterTextIdentities: WeakMap<ReadingChapterText, ReadingChapterText> = new WeakMap();
/** Give the original DTO and every defensive copy the same text-only owner. */
export function readingChapterTextIdentity(chapter: ReadingChapterText): ReadingChapterText {
  if (chapter.textLayoutIdentity?.content === chapter.content && sameResidentRange(chapter.textLayoutIdentity.documentRange, chapter.documentRange)) return chapter.textLayoutIdentity;
  let identity = chapterTextIdentities.get(chapter);
  if (identity === undefined || identity.content !== chapter.content || !sameResidentRange(identity.documentRange, chapter.documentRange)) {
    identity = { content: chapter.content, documentRange: chapter.documentRange === undefined ? undefined : { ...chapter.documentRange } };
    chapterTextIdentities.set(chapter, identity);
  }
  return identity;
}
const chapterLayoutMaps: WeakMap<ReadingChapterText, ReadingSurfaceLayoutMap> = new WeakMap();
export function readingChapterLayoutMap(chapter: ReadingChapterText): ReadingSurfaceLayoutMap {
  const identity = readingChapterTextIdentity(chapter);
  let map = chapterLayoutMaps.get(identity);
  if (map === undefined) {
    map = new ReadingSurfaceLayoutMap(chapter.content, chapter.documentRange);
    chapterLayoutMaps.set(identity, map);
  }
  return map;
}

/** Only this module can seed a map from an existing validated text owner. */
export function sliceReadingChapterText(chapter: ReadingChapterText,
  startScalar: number, endScalar: number): ReadingChapterText {
  const map = readingChapterLayoutMap(chapter);
  if (startScalar === map.residentStart() && endScalar === map.residentEnd())
    return readingChapterTextIdentity(chapter);
  const sliced = map.slice(startScalar, endScalar);
  const text: ReadingChapterText = { content: sliced.sliceByScalar(startScalar, endScalar),
    documentRange: sliced.isComplete() ? undefined : { startScalar, endScalar, totalScalars: sliced.scalarCount() } };
  const identity = readingChapterTextIdentity(text);
  chapterLayoutMaps.set(identity, sliced);
  return { ...text, textLayoutIdentity: identity };
}

export async function prepareReadingChapterLayoutMap(chapter: ReadingChapterText,
  isCurrent: () => boolean): Promise<ReadingSurfaceLayoutMap> {
  if (!isCurrent()) throw new Error('reading layout map preparation cancelled');
  const identity = readingChapterTextIdentity(chapter);
  const existing = chapterLayoutMaps.get(identity);
  if (existing !== undefined) return existing;
  const prepared = await ReadingSurfaceLayoutMap.prepare(chapter.content, chapter.documentRange, isCurrent);
  if (!isCurrent()) throw new Error('reading layout map preparation cancelled');
  // A concurrent consumer may already have completed this exact immutable
  // identity. Keep one shared map and do not publish a cancelled partial map.
  const admitted = chapterLayoutMaps.get(identity) ?? prepared;
  chapterLayoutMaps.set(identity, admitted);
  return admitted;
}

function sameResidentRange(left: ReadingDocumentRange | undefined, right: ReadingDocumentRange | undefined): boolean {
  return left === undefined || right === undefined ? left === right :
    left.startScalar === right.startScalar && left.endScalar === right.endScalar && left.totalScalars === right.totalScalars;
}
