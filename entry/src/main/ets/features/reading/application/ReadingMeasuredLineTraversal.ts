import { MeasuredReadingLine } from './ReadingMeasurementFacts.ts';
import type { ReadingSurfaceLayoutMap, ReadingSurfaceLineMetric } from './ReadingSurfaceLayoutMap.ts';

export interface ReadingMeasuredLinePort {
  lineEndUtf16: (index: number) => number;
  readLine: (index: number) => ReadingSurfaceLineMetric;
  exceedsCapacity: (firstLine: number, lastLine: number) => boolean;
}

export interface ReadingForwardMeasuredLinePort extends ReadingMeasuredLinePort {
  reportOverlap: (index: number, metric: ReadingSurfaceLineMetric, previousEnd: number) => void;
  reportEmpty: (firstLine: number) => void;
}

/** Search native line ends without copying the preceding lines from the layout manager. */
function firstEndingAfter(lineCount: number, requestedUtf16: number, port: ReadingMeasuredLinePort): number {
  let low = 0, high = lineCount;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (port.lineEndUtf16(middle) <= requestedUtf16) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function collectForwardMeasuredLines(
  map: ReadingSurfaceLayoutMap,
  chapterStartScalar: number,
  lineCount: number,
  requestedUtf16: number,
  port: ReadingForwardMeasuredLinePort,
): MeasuredReadingLine[] {
  const firstLine = firstEndingAfter(lineCount, requestedUtf16, port);
  const result: MeasuredReadingLine[] = [];
  let previousEnd = 0;
  for (let index = firstLine; index < lineCount; index += 1) {
    const metric = port.readLine(index);
    if (metric.startIndex < previousEnd) {
      port.reportOverlap(index, metric, previousEnd);
      throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
    }
    previousEnd = metric.endIndex;
    const local = map.linesFromArkUI([metric])[0];
    if (local.endScalar <= local.startScalar || local.height <= 0) continue;
    result.push(new MeasuredReadingLine(index, map.utf16ForScalar(local.startScalar),
      map.utf16ForScalar(local.endScalar), chapterStartScalar + local.startScalar,
      chapterStartScalar + local.endScalar, local.height));
    // Keep the first overflowing line so the page owner can commit the prefix.
    if (port.exceedsCapacity(firstLine, index)) break;
  }
  if (result.length === 0) {
    port.reportEmpty(firstLine);
    throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
  }
  return result;
}

export function collectReverseMeasuredLines(
  map: ReadingSurfaceLayoutMap,
  chapterStartScalar: number,
  lineCount: number,
  endUtf16: number,
  port: ReadingMeasuredLinePort,
): MeasuredReadingLine[] {
  const lastLine = firstEndingAfter(lineCount, endUtf16, port) - 1;
  const result: MeasuredReadingLine[] = [];
  for (let index = lastLine; index >= 0; index -= 1) {
    const metric = port.readLine(index);
    const line = map.linesFromArkUI([metric])[0];
    if (line.endScalar <= line.startScalar) continue;
    result.push(new MeasuredReadingLine(index, metric.startIndex, metric.endIndex,
      chapterStartScalar + line.startScalar, chapterStartScalar + line.endScalar, line.height));
    // Native work stops after the first real measurement proving overflow.
    if (port.exceedsCapacity(index, lastLine)) break;
  }
  return result;
}
