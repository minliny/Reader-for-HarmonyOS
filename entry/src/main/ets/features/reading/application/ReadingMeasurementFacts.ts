import type { LocalReadingAnchor, LocalReadingRetainedProgressReceipt, LocalReadingToc, LocalReadingTocEntry, LocalReadingLayout } from './LocalReadingFlowGateway';
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

