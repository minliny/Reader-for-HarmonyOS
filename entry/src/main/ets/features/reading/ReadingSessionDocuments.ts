import { ReadingChapterWindow, readingChapterRetainedBytes, type ReadingSessionChapter, type ReadingSessionImage } from './ReadingChapterWindow';
import { registerReadingEntryMemoryRelease } from './ReadingEntryHandoff';
import { readingChapterLayoutMap, readingChapterTextIdentity } from './ReadingSurfaceLayoutMap';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { RemoteReadingPositionContext } from './RemoteReadingPositionMigration';

function documentBytes(chapter: ReadingSessionChapter): number {
  // Text plus the lazily shared UTF-16/scalar maps, not native textures.
  return readingChapterRetainedBytes(chapter) + chapter.content.length * 10;
}

/** One process-owned reading data window. Page remounts own observers and
 * native images; this owner only retains immutable text and image descriptors.
 * Uses the existing +/-3 chapter policy, not a second eviction algorithm. */
export class ReadingSessionDocuments {
  private readonly window: ReadingChapterWindow = new ReadingChapterWindow(4 * 1024 * 1024, documentBytes);
  private sourceId: string = '';
  private bookId: string = '';
  private currentIndex: number = -1;
  private valid: (() => boolean) | undefined;

  configure(sourceId: string, bookId: string, order: number[], valid: () => boolean): void {
    if (!valid()) return;
    const same = sourceId === this.sourceId && bookId === this.bookId && this.valid?.() === true;
    const previous = same ? this.window.retainedChapterIndexes().map((i: number): ReadingSessionChapter | undefined => this.window.get(i)) : [];
    const current = same ? this.currentIndex : -1;
    if (!same) this.clear();
    this.sourceId = sourceId; this.bookId = bookId; this.valid = valid;
    this.window.configure(sourceId, bookId, order);
    const body = previous.find((c: ReadingSessionChapter | undefined): boolean => c?.chapterIndex === current);
    if (body !== undefined && this.window.contains(current)) {
      this.window.setCurrent(body); this.currentIndex = current;
      for (const chapter of previous) if (chapter !== undefined && chapter.chapterIndex !== current) this.window.admitNeighbour(chapter);
    } else this.currentIndex = -1;
  }

  read(sourceId: string, bookId: string, chapterIndex: number,
    context?: RemoteReadingPositionContext): ReadingSessionChapter | undefined {
    if (!this.matches(sourceId, bookId)) return undefined;
    const chapter = this.window.get(chapterIndex);
    if (chapter === undefined) return undefined;
    if (context !== undefined) {
      if (chapter.bodyVersion !== context.bodyVersion || chapter.processingVersion !== context.processingVersion) return undefined;
      const count = readingChapterLayoutMap(chapter).scalarCount();
      if (context.anchors.some((anchor): boolean => !Number.isSafeInteger(anchor.offset) || anchor.offset < 0 || anchor.offset > count))
        throw new Error('READING_POSITION_SCOPE_MISMATCH');
    }
    return chapter;
  }

  admit(chapter: ReadingSessionChapter, foreground: boolean): void {
    // Partial entry ranges belong to the range consumer. A full chapter read
    // must never hit a partial DTO merely because its chapter index matches.
    if (chapter.documentRange !== undefined && (chapter.documentRange.startScalar !== 0 ||
      chapter.documentRange.endScalar !== chapter.documentRange.totalScalars)) return;
    if (!this.matches(chapter.sourceId, chapter.bookId) || !this.window.contains(chapter.chapterIndex)) return;
    if (chapter.bodyVersion === undefined || chapter.processingVersion === undefined || chapter.content.trim().length === 0) return;
    const body: ReadingSessionChapter = { ...chapter,
      textLayoutIdentity: readingChapterTextIdentity(chapter),
      // Decoded handles and file leases stay exclusively in the view owner.
      images: chapter.images.map((item: ReadingSessionImage): ReadingSessionImage => ({ ...item, state: 'pending', pixelMap: undefined, fileUri: '' })) };
    if (documentBytes(body) > 16 * 1024 * 1024) {
      if (foreground) { this.window.clear(); this.currentIndex = -1; }
      return;
    }
    if (foreground) { this.window.setCurrent(body); this.currentIndex = body.chapterIndex; }
    else this.window.admitNeighbour(body);
  }

  private matches(sourceId: string, bookId: string): boolean {
    if (this.valid?.() !== true) { this.clear(); return false; }
    return this.sourceId === sourceId && this.bookId === bookId;
  }
  clear(): void { this.window.clear(); this.currentIndex = -1; this.valid = undefined; this.sourceId = ''; this.bookId = ''; }
}

const owners: WeakMap<object, ReadingSessionDocuments> = new WeakMap();
export function readingSessionDocuments(runtime: ReadingGatewayRuntime): ReadingSessionDocuments {
  let owner = owners.get(runtime);
  if (owner === undefined) {
    owner = new ReadingSessionDocuments(); owners.set(runtime, owner);
    const retained = owner;
    registerReadingEntryMemoryRelease(runtime, (): void => retained.clear());
  }
  return owner;
}
