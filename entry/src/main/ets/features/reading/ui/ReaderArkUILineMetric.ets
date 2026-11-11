import type { ReadingSurfaceLineMetric } from '../application/ReadingSurfaceLayoutMap';

/** Copy one admitted SDK metric without changing its UTF-16 range or vp units. */
export class ArkUILineMetric implements ReadingSurfaceLineMetric {
  startIndex: number;
  endIndex: number;
  height: number;
  topHeight: number;
  width: number;
  baseline: number;

  constructor(
    metric: LineMetrics,
    heightVp: number,
    topHeightVp: number,
    widthVp: number,
    baselineVp: number,
  ) {
    this.startIndex = metric.startIndex;
    this.endIndex = metric.endIndex;
    this.height = heightVp;
    this.topHeight = topHeightVp;
    this.width = widthVp;
    this.baseline = baselineVp;
  }
}

