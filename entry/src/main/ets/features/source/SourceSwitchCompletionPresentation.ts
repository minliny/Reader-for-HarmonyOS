/** A one-shot visual receipt emitted only after the existing exact canonical
 * source-switch ACK has been accepted. It carries no transaction authority. */
export class SourceSwitchCompletionPresentation {
  readonly transactionId: string;
  readonly sourceId: string;
  readonly bookId: string;
  readonly readingReadyGeneration: number;
  readonly sourceName: string;
  readonly chapterIndex: number;
  readonly chapterOffset: number;

  constructor(transactionId: string, sourceId: string, bookId: string,
    readingReadyGeneration: number, sourceName: string, chapterIndex: number, chapterOffset: number) {
    this.transactionId = transactionId;
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.readingReadyGeneration = readingReadyGeneration;
    this.sourceName = sourceName;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
  }
}
