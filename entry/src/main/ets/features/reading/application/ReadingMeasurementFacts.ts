import type { LocalReadingAnchor, LocalReadingRetainedProgressReceipt, LocalReadingToc, LocalReadingTocEntry, LocalReadingLayout } from './LocalReadingFlowTypes';
import type { ReaderDirectoryTargetProof } from './ReaderDirectoryTargetProof';

/** Core-facing scalar facts only. SDK text/layout objects remain in the UI adapter. */
export class CoreReadingAnchor implements LocalReadingAnchor {
  deviceId?: string;
  retainedProgressReceipt?: LocalReadingRetainedProgressReceipt;
  directoryTargetProof?: ReaderDirectoryTargetProof;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;

  bodyVersion?: string;
  processingVersion?: string;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number, bodyVersion?: string, processingVersion?: string, directoryTargetProof?: ReaderDirectoryTargetProof) {
    this.directoryTargetProof = directoryTargetProof;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.bodyVersion = bodyVersion; this.processingVersion = processingVersion;
  }
}

/** Original UTF-16 and Unicode-scalar boundaries for one measured paragraph. */
export class ParagraphRange {
  id: string;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;

  constructor(
    id: string,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
  ) {
    this.id = id;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
  }
}

export class MeasuredReadingLine {
  lineIndex: number;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;
  height: number;

  constructor(
    lineIndex: number,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
    height: number,
  ) {
    this.lineIndex = lineIndex;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.height = height;
  }
}

export class InitialReadingToc implements LocalReadingToc {
  bookId: string;
  entries: LocalReadingTocEntry[];

  constructor(bookId: string, entries: LocalReadingTocEntry[]) {
    this.bookId = bookId;
    this.entries = entries;
  }
}

export class CoreReadingLayout implements LocalReadingLayout {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight: number;

  constructor(
    viewportWidth: number,
    viewportHeight: number,
    fontScale: number,
    lineHeight: number,
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.fontScale = fontScale;
    this.lineHeight = lineHeight;
  }
}

/** Core takes a uint32 viewport snapshot; measurements retain fractional vp. */
export function createCoreReadingLayout(
  viewportWidth: number,
  viewportHeight: number,
  fontScale: number,
  lineHeight: number,
): CoreReadingLayout {
  return new CoreReadingLayout(
    Math.max(1, Math.round(viewportWidth)),
    Math.max(1, Math.round(viewportHeight)),
    fontScale,
    lineHeight,
  );
}
