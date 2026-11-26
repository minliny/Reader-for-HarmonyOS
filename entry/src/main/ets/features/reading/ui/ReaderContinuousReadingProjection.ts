import type { ReadingSessionChapter, ReadingSessionImage } from '../application/ReadingChapterWindow';
import { readerTtsChapterKey, type ReaderTtsContentVersion, type ReaderTtsState } from '../application/ReaderTtsState';
import type { ReaderParagraphLayoutRange } from './ReaderParagraphLayoutOwner';

export interface ReaderContinuousFragmentSpan {
  readonly text: string;
  readonly startScalar: number;
  readonly endScalar: number;
  continuousSpaceBefore?: boolean;
}

export interface ReaderContinuousAnchor {
  index: number;
  progress: number;
}

export interface ReaderContinuousVisibleRange {
  startIndex: number;
  endIndex: number;
  scalar: number;
}

export interface ReaderContinuousHighlight {
  start: number;
  end: number;
}

/** Owns the published fragment references and their scalar/index projection.
 * Native fragment construction and the revision observed by ArkUI are host-owned. */
export class ReaderContinuousReadingProjection<T extends ReaderContinuousFragmentSpan> {
  private items: T[] = [];
  private readonly byStartScalar: Map<number, number> = new Map<number, number>();
  private identity: string = 'continuous:empty';
  private title: string = '';
  private layoutKey: string = '';
  private ttsChapterKey: string = '';
  private ttsContentVersion: ReaderTtsContentVersion | undefined = undefined;
  private firstVisible: number = 0;
  private lastVisible: number = 0;

  get fragments(): T[] { return this.items; }
  get chapterIdentity(): string { return this.identity; }
  get chapterTitle(): string { return this.title; }
  get geometryKey(): string { return this.layoutKey; }
  get visibleStart(): number { return this.firstVisible; }
  get visibleEnd(): number { return this.lastVisible; }

  project(chapter: ReadingSessionChapter, ranges: ReaderParagraphLayoutRange[], retainExisting: boolean,
    imageAtScalar: (startScalar: number) => ReadingSessionImage | undefined,
    createImage: (id: string, image: ReadingSessionImage) => T,
    createText: (id: string, text: string, startScalar: number, endScalar: number) => T): T[] {
    const fragments: T[] = [];
    const retained = new Map<number, T>();
    if (retainExisting) {
      for (const fragment of this.items) retained.set(fragment.startScalar, fragment);
    }
    for (const range of ranges) {
      const existing = retained.get(range.startScalar);
      if (existing !== undefined && existing.endScalar === range.endScalar) {
        fragments.push(existing);
        continue;
      }
      const text = chapter.content.substring(range.startUtf16, range.endUtf16);
      const image = range.endScalar === range.startScalar + 1 && text === '\uFFFC' ?
        imageAtScalar(range.startScalar) : undefined;
      if (image !== undefined && image.endScalar === range.endScalar) {
        fragments.push(createImage(this.imageId(chapter, image), image));
      } else {
        fragments.push(createText(`continuous:${chapter.chapterIndex}:text:${range.startScalar}-${range.endScalar}`,
          text, range.startScalar, range.endScalar));
      }
    }
    return fragments;
  }

  commit(chapter: ReadingSessionChapter, fragments: T[], visibleScalar: number, geometryKey: () => string): void {
    for (let index = 0; index < fragments.length; index += 1) {
      fragments[index].continuousSpaceBefore = index > 0 || (chapter.documentRange?.startScalar ?? 0) > 0;
    }
    this.items = fragments;
    this.byStartScalar.clear();
    for (let index = 0; index < fragments.length; index += 1) {
      this.byStartScalar.set(fragments[index].startScalar, index);
    }
    this.focus(this.indexForScalar(visibleScalar));
    this.identity = `continuous:${JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex, chapter.contentVersion])}`;
    this.ttsChapterKey = readerTtsChapterKey(chapter.sourceId, chapter.bookId, chapter.chapterIndex);
    this.ttsContentVersion = chapter.contentVersion;
    this.title = (chapter.documentRange?.startScalar ?? 0) === 0 ? chapter.chapterTitle : '';
    this.layoutKey = geometryKey();
  }

  replaceResolvedImage(chapter: ReadingSessionChapter | undefined, image: ReadingSessionImage,
    create: (id: string, image: ReadingSessionImage) => T): number | undefined {
    if (chapter === undefined || image.state !== 'ready') return undefined;
    const index = this.byStartScalar.get(image.startScalar) ?? -1;
    if (index < 0) return undefined;
    const fragment = create(this.imageId(chapter, image), image);
    this.items.splice(index, 1, fragment);
    this.items[index].continuousSpaceBefore = index > 0 || (chapter.documentRange?.startScalar ?? 0) > 0;
    return index;
  }

  /** A batch pixel update keeps every row position and publishes a fresh array. */
  republishFragments(): void {
    this.items = this.items.slice();
  }

  clear(): void {
    this.items = [];
    this.byStartScalar.clear();
    this.identity = 'continuous:empty';
    this.title = '';
    this.ttsChapterKey = '';
    this.ttsContentVersion = undefined;
  }

  ttsHighlight(state: ReaderTtsState, enabled: boolean): ReaderContinuousHighlight | undefined {
    const start = state.charStart;
    const end = state.charEnd;
    if (!enabled || this.ttsChapterKey.length === 0 || this.ttsChapterKey !== state.chapterKey ||
      this.ttsContentVersion !== state.contentVersion || start === undefined || end === undefined || end <= start) return undefined;
    return { start, end };
  }

  anchor(scalar: number): ReaderContinuousAnchor {
    const index = this.indexForScalar(scalar);
    const fragment = this.items[index];
    const span = fragment === undefined ? 0 : Math.max(0, fragment.endScalar - fragment.startScalar);
    return { index: index, progress: span === 0 ? 0 : Math.max(0, Math.min(1, (scalar - fragment.startScalar) / span)) };
  }

  focus(index: number): void {
    this.firstVisible = index;
    this.lastVisible = index;
  }

  admitVisibleRange(start: number, end: number, startProgress: number): ReaderContinuousVisibleRange | undefined {
    if (this.items.length === 0) return undefined;
    const clampedStart = Math.max(0, Math.min(this.items.length - 1, start));
    const clampedEnd = Math.max(clampedStart, Math.min(this.items.length - 1, end));
    this.firstVisible = clampedStart;
    this.lastVisible = clampedEnd;
    const first = this.items[clampedStart];
    const span = Math.max(0, first.endScalar - first.startScalar);
    // Nearest canonical scalar: flooring both the viewport fraction and the
    // scalar conversion makes repeated restores drift backwards.
    const within = span === 0 ? 0 : Math.min(span - 1, Math.round(span * Math.max(0, Math.min(1, startProgress))));
    return { startIndex: clampedStart, endIndex: clampedEnd, scalar: first.startScalar + within };
  }

  resolveVisibleImages(start: number, end: number, resolve: (startScalar: number) => void): void {
    for (let index = start; index <= end; index += 1) {
      const fragment = this.items[index];
      if (fragment !== undefined && fragment.text.length === 0) resolve(fragment.startScalar);
    }
  }

  private imageId(chapter: ReadingSessionChapter, image: ReadingSessionImage): string {
    return `continuous:${chapter.chapterIndex}:image:${image.startScalar}-${image.endScalar}`;
  }

  private indexForScalar(scalar: number): number {
    if (this.items.length === 0) return 0;
    let lower = 0;
    let upper = this.items.length - 1;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (scalar < this.items[middle].endScalar) upper = middle;
      else lower = middle + 1;
    }
    return lower;
  }
}
