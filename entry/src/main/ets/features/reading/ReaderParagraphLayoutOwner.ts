/** Reader batch planning only. Native shaping, bidi, graphemes and Text nodes
 * remain owned by the platform measurement/resource adapters. */
export interface ReaderParagraphLayoutRange {
  readonly id: string;
  readonly startUtf16: number;
  readonly endUtf16: number;
  readonly startScalar: number;
  readonly endScalar: number;
}

export class ReaderParagraphLayoutOwner<TRange extends ReaderParagraphLayoutRange, TParagraph> {
  ranges: TRange[] = [];
  readonly batch: TParagraph[] = [];
  nextRangeIndex: number = 0;
  firstRangeStartScalar: number = 0;

  prepareBatch(content: string, ranges: TRange[], maxParagraphs: number, maxUtf16: number,
    releaseMeasurement: () => void,
    create: (range: TRange, index: number, text: string, requestedStartScalar: number) => TParagraph): boolean {
    releaseMeasurement();
    this.batch.length = 0;
    let totalUtf16 = 0;
    while (this.nextRangeIndex < ranges.length && this.batch.length < maxParagraphs) {
      const range = ranges[this.nextRangeIndex];
      const startScalar = Math.max(range.startScalar, this.firstRangeStartScalar);
      const utf16Length = range.endUtf16 - range.startUtf16;
      if (startScalar >= range.endScalar || utf16Length <= 0) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      // A single giant paragraph stays whole. Splitting it without a native
      // shaping checkpoint would invent new bidi/grapheme context.
      if (this.batch.length > 0 && totalUtf16 + utf16Length > maxUtf16) break;
      this.batch.push(create(range, this.nextRangeIndex,
        content.substring(range.startUtf16, range.endUtf16), startScalar));
      totalUtf16 += utf16Length;
      this.nextRangeIndex += 1;
      this.firstRangeStartScalar = 0;
    }
    return this.batch.length > 0;
  }

  rangeIndexForOffset(ranges: TRange[], offset: number): number {
    for (let index = 0; index < ranges.length; index += 1) {
      if (offset < ranges[index].endScalar) return index;
    }
    return Math.max(0, ranges.length - 1);
  }

  previousRangeIndex(ranges: TRange[], endScalar: number): number {
    let index = ranges.length - 1;
    while (index >= 0 && ranges[index].startScalar >= endScalar) index -= 1;
    return index;
  }

  preparePrevious(content: string, ranges: TRange[], index: number, releaseMeasurement: () => void,
    create: (range: TRange, index: number, text: string, requestedStartScalar: number) => TParagraph): number | undefined {
    if (index < 0) return undefined;
    const range = ranges[index];
    releaseMeasurement();
    // A reverse page still measures one complete original paragraph. Its
    // transaction captures the returned next index, while this owner holds the
    // current native batch shared by forward and reverse measurement adapters.
    this.batch.splice(0, this.batch.length, create(range, index,
      content.substring(range.startUtf16, range.endUtf16), range.startScalar));
    return index - 1;
  }
}
