import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';

/** Bounded display text supplied by the current book's admitted adjacent chapter. */
export class ReaderFacingChapter {
  readonly title: string;
  readonly paragraphs: string[];
  readonly identity: string;

  constructor(title: string, paragraphs: string[], identity: string = '') {
    this.title = title;
    this.paragraphs = paragraphs;
    this.identity = identity;
  }
}

/** Holds a bounded projection of the exact facing chapter. */
export class ReaderFacingChapterPreview {
  private readonly facingChapters: Map<number, ReaderFacingChapter> = new Map<number, ReaderFacingChapter>();

  current(sourceId: string, bookId: string, nextIndex: number, candidate: ReadingSessionChapter | undefined,
    readEntry: () => LocalReadingTocEntry | undefined): ReaderFacingChapter | undefined {
    const chapter = candidate?.sourceId === sourceId && candidate.bookId === bookId &&
      candidate.chapterIndex === nextIndex && candidate.sourceCorrectionRequired !== true &&
      (candidate.documentRange?.startScalar ?? 0) === 0 ? candidate : undefined;
    const entry = readEntry();
    const title = chapter?.chapterTitle ?? entry?.displayTitle ?? entry?.title ?? '';
    if (title.length === 0 && chapter === undefined) return undefined;
    const identity = JSON.stringify([sourceId, bookId, nextIndex, chapter?.contentVersion, title]);
    const cached = this.facingChapters.get(nextIndex);
    if (cached?.identity === identity) return cached;
    // Paint only a bounded head of the exact admitted next chapter. The
    // right leaf never owns pagination, selection, TTS or progress.
    const text = chapter?.content.slice(0, 4096) ?? '';
    const paragraphs = text.split(/\r\n|\r|\n/).map((value: string): string => value.trim())
      .filter((value: string): boolean => value.length > 0).slice(0, 64);
    const preview = new ReaderFacingChapter(title, paragraphs, identity);
    if (this.facingChapters.size >= 3) this.facingChapters.clear();
    this.facingChapters.set(nextIndex, preview);
    return preview;
  }
}
