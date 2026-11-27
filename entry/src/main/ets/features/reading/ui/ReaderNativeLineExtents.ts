export interface ReaderNativeLineBounds { top: number; bottom: number; }

/** A single shaped paragraph. Pagination grows each candidate by one adjacent
 * line, so its full native ink span can grow incrementally in either direction. */
export class ReaderNativeLineExtents {
  private readonly readLine: (index: number) => ReaderNativeLineBounds;
  private readonly lines = new Map<number, ReaderNativeLineBounds>();
  private first: number = -1;
  private last: number = -1;
  private top: number = Number.POSITIVE_INFINITY;
  private bottom: number = Number.NEGATIVE_INFINITY;

  constructor(readLine: (index: number) => ReaderNativeLineBounds) {
    this.readLine = readLine;
  }

  height(first: number, last: number): number {
    if (this.first >= 0 && first <= this.first && last >= this.last) {
      for (let index = first; index < this.first; index += 1) this.include(index);
      for (let index = this.last + 1; index <= last; index += 1) this.include(index);
    } else {
      this.top = Number.POSITIVE_INFINITY;
      this.bottom = Number.NEGATIVE_INFINITY;
      for (let index = first; index <= last; index += 1) this.include(index);
    }
    this.first = first;
    this.last = last;
    if (!Number.isFinite(this.top) || !Number.isFinite(this.bottom) || this.bottom <= this.top)
      throw new Error('NATIVE_TEXT_WINDOW_GEOMETRY_INVALID');
    return this.bottom - this.top;
  }

  private include(index: number): void {
    let line = this.lines.get(index);
    if (line === undefined) {
      line = this.readLine(index);
      this.lines.set(index, line);
    }
    this.top = Math.min(this.top, line.top);
    this.bottom = Math.max(this.bottom, line.bottom);
  }
}
