import { readingChapterTextIdentity, type ReadingDocumentRange } from './ReadingSurfaceLayoutMap.ts';
import type { RemoteReadingPositionMigration } from './RemoteReadingPositionMigration';

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
  /** Exact remote TOC URL used by source-backed chapter tools. */
  readonly chapterUrl: string | undefined;
  readonly content: string;
  readonly documentRange?: ReadingDocumentRange;
  /** Shared text-only identity across defensive DTO copies; owns no native images. */
  readonly textLayoutIdentity?: { readonly content: string; readonly documentRange?: ReadingDocumentRange };
  readonly images: ReadingSessionImage[];
  readonly contentVersion: string;
  /** Core canonical/processing evidence, distinct from the Host document hash. */
  readonly bodyVersion?: string;
  readonly processingVersion?: string;
  readonly positionMigration?: RemoteReadingPositionMigration;
  /** Older bytes remain usable offline without claiming new-extractor proof. */
  readonly cacheRefreshRequired?: boolean;
  readonly sourceCorrectionRequired?: boolean;
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
  readonly fileUri: string;
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  readonly imageWidthBasisPoints?: number;
  readonly revision: string;
};

/** Geometry from Core's bounded immutable local-image header projection.
 * Actual locator/path validation still belongs to LocalEpubResourceHost before I/O. */
export function hasKnownReadingImageGeometry(image: ReadingSessionImage): boolean {
  return hasImmutableLocalReadingImageSource(image.source) &&
    Number.isSafeInteger(image.intrinsicWidth) && image.intrinsicWidth > 0 && image.intrinsicWidth <= 4096 &&
    Number.isSafeInteger(image.intrinsicHeight) && image.intrinsicHeight > 0 && image.intrinsicHeight <= 4096 &&
    image.intrinsicWidth * image.intrinsicHeight <= 4 * 1024 * 1024;
}

/** Core uses padded URL-safe Base64 for both locator segments. Older Host
 * callers also supply unpadded tokens. Full hash/path decoding remains in the
 * existing platform resource adapter before archive access. */
export function hasImmutableLocalReadingImageSource(source: string): boolean {
  return /^reader-local-(epub|mobi):\/\/bG9jYWw6[A-Za-z0-9_-]{86}(?:==)?\/[A-Za-z0-9_-]+={0,2}$/.test(source);
}

/**
 * Bounded current chapter plus the three TOC neighbours in each direction.
 *
 * This mirrors Legado's ReadBook working set. It is not a general cache: a
 * current-chapter change immediately evicts every body outside the six TOC
 * neighbours, and it owns no persistence, retry policy, or background queue.
 */
export class ReadingChapterWindow {
  private readonly neighbourBytes: number;
  private readonly estimateBytes: (chapter: ReadingSessionChapter) => number;
  private sourceId: string = '';
  private bookId: string = '';
  private chapterOrder: number[] = [];
  private chapterPositions: Map<number, number> = new Map();
  private currentChapterIndex: number = -1;
  private chapters: ReadingSessionChapter[] = [];

  constructor(neighbourBytes: number = 4 * 1024 * 1024,
    estimateBytes: (chapter: ReadingSessionChapter) => number = readingChapterRetainedBytes) {
    if (!Number.isSafeInteger(neighbourBytes) || neighbourBytes < 0) throw new Error('invalid neighbour byte budget');
    this.neighbourBytes = neighbourBytes;
    this.estimateBytes = estimateBytes;
  }

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
    this.chapterPositions = buildChapterPositions(this.chapterOrder);
    this.currentChapterIndex = -1;
    this.chapters = [];
  }

  setCurrent(chapter: ReadingSessionChapter): void {
    if (chapter.sourceCorrectionRequired === true) throw new Error('source content correction requires foreground reading');
    this.validateChapter(chapter);
    this.requireKnownChapter(chapter.chapterIndex);
    this.upsert(chapter);
    this.currentChapterIndex = chapter.chapterIndex;
    this.pruneToCurrentWindow();
  }

  admitNeighbour(chapter: ReadingSessionChapter): boolean {
    if (chapter.sourceCorrectionRequired === true) return false;
    this.validateChapter(chapter);
    if (this.currentChapterIndex < 0) {
      return false;
    }
    const currentPosition = this.positionOf(this.currentChapterIndex);
    const chapterPosition = this.positionOf(chapter.chapterIndex);
    if (chapterPosition < 0 || Math.abs(chapterPosition - currentPosition) > 3) {
      return false;
    }
    this.upsert(chapter);
    this.pruneToCurrentWindow();
    return this.chapters.some((retained: ReadingSessionChapter): boolean => retained.chapterIndex === chapter.chapterIndex);
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

  contains(chapterIndex: number): boolean {
    return this.chapterPositions.has(chapterIndex);
  }

  position(chapterIndex: number): number {
    return this.positionOf(chapterIndex);
  }

  adjacentChapterIndex(chapterIndex: number, delta: number): number | undefined {
    const position = this.positionOf(chapterIndex);
    const target = position + delta;
    return position >= 0 && target >= 0 && target < this.chapterOrder.length ?
      this.chapterOrder[target] : undefined;
  }

  /** Native image handles still reachable from the bounded chapter set. */
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
      return position >= 0 && Math.abs(position - currentPosition) <= 3;
    });
    // This is a reading-window policy, not an LRU cache: nearest TOC
    // neighbours win, with forward reading first at equal distance. The
    // admitted current chapter is never evicted to make room for speculation.
    const neighbours = this.chapters.filter((chapter: ReadingSessionChapter): boolean =>
      chapter.chapterIndex !== this.currentChapterIndex).sort((left: ReadingSessionChapter, right: ReadingSessionChapter): number => {
      const a = this.positionOf(left.chapterIndex) - currentPosition;
      const b = this.positionOf(right.chapterIndex) - currentPosition;
      return Math.abs(a) - Math.abs(b) || b - a;
    });
    const retained = new Set<number>([this.currentChapterIndex]);
    let bytes = 0;
    for (const chapter of neighbours) {
      const size = this.estimateBytes(chapter);
      if (bytes + size > this.neighbourBytes) continue;
      bytes += size;
      retained.add(chapter.chapterIndex);
    }
    this.chapters = this.chapters.filter((chapter: ReadingSessionChapter): boolean => retained.has(chapter.chapterIndex));
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
    return this.chapterPositions.get(chapterIndex) ?? -1;
  }
}

/** Conservative DTO/native-image estimate for optional chapter retention. */
export function readingChapterRetainedBytes(chapter: ReadingSessionChapter): number {
  let bytes = 256 + 2 * (chapter.sourceId.length + chapter.bookId.length + chapter.chapterTitle.length +
    (chapter.chapterUrl?.length ?? 0) + chapter.content.length + chapter.contentVersion.length +
    (chapter.bodyVersion?.length ?? 0) + (chapter.processingVersion?.length ?? 0));
  for (const item of chapter.images) {
    bytes += 128 + 2 * (item.source.length + (item.baseUrl?.length ?? 0) + item.fileUri.length + item.revision.length);
    if (item.pixelMap !== undefined) {
      const pixels = item.intrinsicWidth * item.intrinsicHeight;
      if (!Number.isFinite(pixels) || pixels <= 0) return Number.POSITIVE_INFINITY;
      bytes += pixels * 4;
    }
  }
  const migration = chapter.positionMigration;
  if (migration !== undefined) {
    bytes += 256 + 2 * ((migration.reason?.length ?? 0) + migration.previousBodyVersion.length +
      migration.bodyVersion.length + migration.previousProcessingVersion.length + migration.processingVersion.length);
    for (const anchor of migration.anchors) bytes += 64 + anchor.id.length * 2;
    const progress = migration.progress;
    if (progress !== undefined) bytes += 128 + 2 * (progress.sourceId.length + progress.bookId.length +
      (progress.locationRevision?.length ?? 0) + (progress.bodyVersion?.length ?? 0) + (progress.processingVersion?.length ?? 0));
  }
  return bytes;
}

function copyChapter(chapter: ReadingSessionChapter): ReadingSessionChapter {
  return {
    sourceId: chapter.sourceId,
    bookId: chapter.bookId,
    chapterIndex: chapter.chapterIndex,
    chapterTitle: chapter.chapterTitle,
    chapterUrl: chapter.chapterUrl,
    content: chapter.content,
    documentRange: chapter.documentRange === undefined ? undefined : { ...chapter.documentRange },
    textLayoutIdentity: readingChapterTextIdentity(chapter),
    images: chapter.images.map(copyImage),
    contentVersion: chapter.contentVersion,
    bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
    positionMigration: chapter.positionMigration === undefined ? undefined : { ...chapter.positionMigration,
      anchors: chapter.positionMigration.anchors.map((anchor) => ({ ...anchor })),
      progress: chapter.positionMigration.progress === undefined ? undefined : { ...chapter.positionMigration.progress } },
    extractionVia: chapter.extractionVia,
    cacheRefreshRequired: chapter.cacheRefreshRequired,
    sourceCorrectionRequired: chapter.sourceCorrectionRequired,
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
    fileUri: image.fileUri,
    intrinsicWidth: image.intrinsicWidth,
    intrinsicHeight: image.intrinsicHeight,
    imageWidthBasisPoints: image.imageWidthBasisPoints,
    revision: image.revision,
  };
}

function validateChapterOrder(chapterOrder: number[]): void {
  if (chapterOrder.length === 0) {
    throw new Error('chapterOrder must contain at least one chapter');
  }
  const seen = new Set<number>();
  for (const chapterIndex of chapterOrder) {
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
      throw new Error('chapterOrder must contain non-negative safe integers');
    }
    if (seen.has(chapterIndex)) {
      throw new Error('chapterOrder must not contain duplicate chapters');
    }
    seen.add(chapterIndex);
  }
}

function buildChapterPositions(chapterOrder: number[]): Map<number, number> {
  const positions = new Map<number, number>();
  for (let position = 0; position < chapterOrder.length; position += 1) {
    positions.set(chapterOrder[position], position);
  }
  return positions;
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

/** The visible view owns decoded handles. Expanding the same Core document
 * retains matching handles without transferring ownership to the process cache. */
export function retainReadingEntryImageHandles(full: ReadingSessionChapter, previous: ReadingSessionChapter): ReadingSessionChapter {
  if (full.sourceId !== previous.sourceId || full.bookId !== previous.bookId || full.chapterIndex !== previous.chapterIndex ||
    full.bodyVersion !== previous.bodyVersion || full.processingVersion !== previous.processingVersion ||
    full.contentVersion !== previous.contentVersion) throw new Error('entry image ownership scope mismatch');
  return { ...full, textLayoutIdentity: readingChapterTextIdentity(full), images: full.images.map((image: ReadingSessionImage): ReadingSessionImage =>
    previous.images.find((old: ReadingSessionImage): boolean => old.startScalar === image.startScalar &&
      old.endScalar === image.endScalar && old.source === image.source && old.baseUrl === image.baseUrl) ?? image) };
}
