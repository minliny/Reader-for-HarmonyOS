/**
 * One materialized chapter consumed by the native reading session.
 *
 * Local and remote acquisition may use different Core commands, but after
 * materialization they must enter the same reading-session shape. Physical
 * pagination remains platform-owned and is deliberately not stored here.
 */
export type ReadingSessionChapter = {
  readonly sourceId: string;
  readonly bookId: string;
  readonly chapterIndex: number;
  readonly chapterTitle: string;
  readonly content: string;
  readonly images: ReadingSessionImage[];
  readonly contentVersion: string;
  readonly extractionVia: 'local' | 'rule' | 'js';
};

/** One body image anchored to Core's canonical chapter scalar space. */
export type ReadingSessionImage = {
  readonly source: string;
  readonly baseUrl: string | undefined;
  readonly startScalar: number;
  readonly endScalar: number;
  readonly state: 'pending' | 'ready' | 'failed';
  readonly pixelMap: image.PixelMap | undefined;
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  readonly revision: string;
};

/**
 * Bounded previous/current/next materialized chapter window.
 *
 * This mirrors Legado's ReadBook working set. It is not a general cache: a
 * current-chapter change immediately evicts every body outside the two TOC
 * neighbours, and it owns no persistence, retry policy, or background queue.
 */
export class ReadingChapterWindow {
  private sourceId: string = '';
  private bookId: string = '';
  private chapterOrder: number[] = [];
  private currentChapterIndex: number = -1;
  private chapters: ReadingSessionChapter[] = [];

  configure(sourceId: string, bookId: string, chapterOrder: number[]): void {
    requireNonBlank(sourceId, 'sourceId');
    requireNonBlank(bookId, 'bookId');
    validateChapterOrder(chapterOrder);
    const sameIdentity = this.sourceId === sourceId && this.bookId === bookId;
    const sameOrder = sameChapterOrder(this.chapterOrder, chapterOrder);
    if (sameIdentity && sameOrder) {
      return;
    }
    this.sourceId = sourceId;
    this.bookId = bookId;
    this.chapterOrder = chapterOrder.slice();
    this.currentChapterIndex = -1;
    this.chapters = [];
  }

  setCurrent(chapter: ReadingSessionChapter): void {
    this.validateChapter(chapter);
    this.requireKnownChapter(chapter.chapterIndex);
    this.upsert(chapter);
    this.currentChapterIndex = chapter.chapterIndex;
    this.pruneToCurrentWindow();
  }

  admitNeighbour(chapter: ReadingSessionChapter): boolean {
    this.validateChapter(chapter);
    if (this.currentChapterIndex < 0) {
      return false;
    }
    const currentPosition = this.positionOf(this.currentChapterIndex);
    const chapterPosition = this.positionOf(chapter.chapterIndex);
    if (chapterPosition < 0 || Math.abs(chapterPosition - currentPosition) > 1) {
      return false;
    }
    this.upsert(chapter);
    this.pruneToCurrentWindow();
    return true;
  }

  get(chapterIndex: number): ReadingSessionChapter | undefined {
    for (const chapter of this.chapters) {
      if (chapter.chapterIndex === chapterIndex) {
        return copyChapter(chapter);
      }
    }
    return undefined;
  }

  previous(): ReadingSessionChapter | undefined {
    return this.neighbour(-1);
  }

  next(): ReadingSessionChapter | undefined {
    return this.neighbour(1);
  }

  retainedChapterIndexes(): number[] {
    return this.chapters.map((chapter: ReadingSessionChapter): number => chapter.chapterIndex);
  }

  /** Native image handles still reachable from the bounded three-chapter set. */
  retainedImages(): ReadingSessionImage[] {
    const retained: ReadingSessionImage[] = [];
    for (const chapter of this.chapters) {
      for (const image of chapter.images) {
        retained.push(copyImage(image));
      }
    }
    return retained;
  }

  clear(): void {
    this.currentChapterIndex = -1;
    this.chapters = [];
  }

  private neighbour(delta: number): ReadingSessionChapter | undefined {
    if (this.currentChapterIndex < 0) {
      return undefined;
    }
    const targetPosition = this.positionOf(this.currentChapterIndex) + delta;
    if (targetPosition < 0 || targetPosition >= this.chapterOrder.length) {
      return undefined;
    }
    return this.get(this.chapterOrder[targetPosition]);
  }

  private upsert(chapter: ReadingSessionChapter): void {
    for (let index = 0; index < this.chapters.length; index += 1) {
      if (this.chapters[index].chapterIndex === chapter.chapterIndex) {
        this.chapters[index] = copyChapter(chapter);
        return;
      }
    }
    this.chapters.push(copyChapter(chapter));
  }

  private pruneToCurrentWindow(): void {
    const currentPosition = this.positionOf(this.currentChapterIndex);
    this.chapters = this.chapters.filter((chapter: ReadingSessionChapter): boolean => {
      const position = this.positionOf(chapter.chapterIndex);
      return position >= 0 && Math.abs(position - currentPosition) <= 1;
    });
  }

  private validateChapter(chapter: ReadingSessionChapter): void {
    if (chapter.sourceId !== this.sourceId || chapter.bookId !== this.bookId) {
      throw new Error('reading chapter does not belong to the configured session');
    }
    requireNonBlank(chapter.chapterTitle, 'chapterTitle');
    requireNonBlank(chapter.content, 'content');
    requireNonBlank(chapter.contentVersion, 'contentVersion');
    if (!Number.isSafeInteger(chapter.chapterIndex) || chapter.chapterIndex < 0) {
      throw new Error('chapterIndex must be a non-negative safe integer');
    }
  }

  private requireKnownChapter(chapterIndex: number): void {
    if (this.positionOf(chapterIndex) < 0) {
      throw new Error('reading chapter is not present in TOC order');
    }
  }

  private positionOf(chapterIndex: number): number {
    return this.chapterOrder.indexOf(chapterIndex);
  }
}

function copyChapter(chapter: ReadingSessionChapter): ReadingSessionChapter {
  return {
    sourceId: chapter.sourceId,
    bookId: chapter.bookId,
    chapterIndex: chapter.chapterIndex,
    chapterTitle: chapter.chapterTitle,
    content: chapter.content,
    images: chapter.images.map(copyImage),
    contentVersion: chapter.contentVersion,
    extractionVia: chapter.extractionVia,
  };
}

function copyImage(image: ReadingSessionImage): ReadingSessionImage {
  return {
    source: image.source,
    baseUrl: image.baseUrl,
    startScalar: image.startScalar,
    endScalar: image.endScalar,
    state: image.state,
    pixelMap: image.pixelMap,
    intrinsicWidth: image.intrinsicWidth,
    intrinsicHeight: image.intrinsicHeight,
    revision: image.revision,
  };
}

function validateChapterOrder(chapterOrder: number[]): void {
  if (chapterOrder.length === 0) {
    throw new Error('chapterOrder must contain at least one chapter');
  }
  const seen: number[] = [];
  for (const chapterIndex of chapterOrder) {
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
      throw new Error('chapterOrder must contain non-negative safe integers');
    }
    if (seen.indexOf(chapterIndex) >= 0) {
      throw new Error('chapterOrder must not contain duplicate chapters');
    }
    seen.push(chapterIndex);
  }
}

function sameChapterOrder(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function requireNonBlank(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-blank string`);
  }
}
import type { image } from '@kit.ImageKit';
