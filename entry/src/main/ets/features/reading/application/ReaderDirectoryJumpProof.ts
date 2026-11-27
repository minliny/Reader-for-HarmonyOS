import type { ReadingSessionChapter } from './ReadingChapterWindow';
import type { ReaderDirectoryTargetProof } from './ReaderDirectoryTargetProof';

/** A directory proof authorizes entry into one target, until Core acknowledges
 * its position. The reusable chapter body never owns that selection authority. */
export class ReaderDirectoryJumpProof {
  private proof: ReaderDirectoryTargetProof | undefined = undefined;
  private selection: number = -1;

  admit(chapter: ReadingSessionChapter, selection: number,
    proof: ReaderDirectoryTargetProof | undefined): ReadingSessionChapter {
    this.proof = proof;
    this.selection = selection;
    return chapter.directoryTargetProof === undefined ? chapter : { ...chapter, directoryTargetProof: undefined };
  }

  forProgress(chapter: ReadingSessionChapter, selection: number): ReaderDirectoryTargetProof | undefined {
    const proof = this.proof;
    if (proof === undefined || this.selection !== selection || proof.chapterIndex !== chapter.chapterIndex ||
      proof.bookId !== chapter.bookId || proof.sourceId !== chapter.sourceId) return undefined;
    return proof;
  }

  acknowledge(selection: number, proof: ReaderDirectoryTargetProof, bookId: string, chapterIndex: number): void {
    if (this.proof === proof && this.selection === selection &&
      bookId === proof.bookId && chapterIndex === proof.chapterIndex) this.clear();
  }

  clear(): void {
    this.proof = undefined;
    this.selection = -1;
  }
}
