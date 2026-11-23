/**
 * The only progress datum emitted by the immersive reader. Its offset is a
 * Unicode-scalar index accepted by Reader Core, never an ArkUI UTF-16 index.
 */
export class ReadingCommit {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string | undefined;
  updatedAt: number;
  sourceSwitchTransactionId: string | undefined;
  bodyVersion: string | undefined;
  processingVersion: string | undefined;
  progressRevision: string | undefined;

  constructor(
    sourceId: string,
    bookId: string,
    chapterIndex: number,
    chapterOffset: number,
    chapterProgress: number,
    locationRevision: string | undefined,
    updatedAt: number = 0,
    sourceSwitchTransactionId: string | undefined = undefined,
    bodyVersion: string | undefined = undefined,
    processingVersion: string | undefined = undefined,
    progressRevision: string | undefined = undefined,
  ) {
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
    this.updatedAt = updatedAt;
    this.sourceSwitchTransactionId = sourceSwitchTransactionId;
    this.bodyVersion = bodyVersion;
    this.processingVersion = processingVersion;
    this.progressRevision = progressRevision;
  }
}
