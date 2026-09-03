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
export class ReadingSurfaceLayoutMap {
  private readonly scalarBoundaries: number[] = [0];

  constructor(private readonly content: string) {
    let utf16Offset = 0;
    for (const scalar of content) {
      utf16Offset += scalar.length;
      this.scalarBoundaries.push(utf16Offset);
    }
  }

  scalarCount(): number {
    return this.scalarBoundaries.length - 1;
  }

  utf16Length(): number {
    return this.content.length;
  }

  utf16ForScalar(scalarOffset: number): number {
    this.requireScalarOffset(scalarOffset);
    return this.scalarBoundaries[scalarOffset];
  }

  scalarForUtf16(utf16Offset: number): number {
    this.requireUtf16Offset(utf16Offset);
    let low = 0;
    let high = this.scalarBoundaries.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = this.scalarBoundaries[middle];
      if (candidate === utf16Offset) {
        return middle;
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
      this.scalarBoundaries[startScalar],
      this.scalarBoundaries[endScalar],
    );
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
    if (!Number.isSafeInteger(value) || value < 0 || value > this.scalarCount()) {
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
