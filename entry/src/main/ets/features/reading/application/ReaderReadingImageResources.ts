import type image from '@ohos.multimedia.image';
import { hasKnownReadingImageGeometry, type ReadingSessionChapter, type ReadingSessionImage } from './ReadingChapterWindow.ts';

/** The allocator owns native/file reference counts. This owner only tracks the
 * leases retained by one reader's presented/prepared chapter contexts. */
export interface ReaderReadingImageAllocator {
  releaseReadingImage(fileUri: string, pixelMap?: image.PixelMap): void;
}

export interface ReaderImageResolution {
  load(chapter: ReadingSessionChapter, image: ReadingSessionImage, isCurrent: () => boolean): Promise<ReadingSessionImage>;
  admit(requested: ReadingSessionImage, resolved: ReadingSessionImage): void;
  fail(error: Error): void;
}

export interface ReaderContinuousImageResolution extends ReaderImageResolution {
  captureCurrent(chapter: ReadingSessionChapter): () => boolean;
  resolveGeometry(chapter: ReadingSessionChapter, image: ReadingSessionImage): void;
}

export interface ReaderGeometryImageResolution {
  captureCurrent(): () => boolean;
  ownerCandidates(chapter: ReadingSessionChapter): (ReadingSessionChapter | undefined)[];
  load(chapter: ReadingSessionChapter, image: ReadingSessionImage, isCurrent: () => boolean): Promise<ReadingSessionImage>;
  ready(): void;
  fail(error: Error): void;
}

interface DeferredReadingImagePixels {
  chapter: ReadingSessionChapter;
  requested: ReadingSessionImage;
  resolved?: ReadingSessionImage;
  isCurrent: () => boolean;
}

export function sameReaderReadingImageResource(left: ReadingSessionImage, right: ReadingSessionImage): boolean {
  if (left.fileUri.length > 0 || right.fileUri.length > 0) {
    return left.fileUri.length > 0 && left.fileUri === right.fileUri;
  }
  return left.pixelMap !== undefined && left.pixelMap === right.pixelMap;
}

export function sameReadingImageChapter(candidate: ReadingSessionChapter | undefined, chapter: ReadingSessionChapter): boolean {
  return candidate !== undefined && candidate.sourceId === chapter.sourceId && candidate.bookId === chapter.bookId &&
    candidate.chapterIndex === chapter.chapterIndex && candidate.contentVersion === chapter.contentVersion;
}

function readingImageKey(image: ReadingSessionImage): string {
  return `${image.source}\u0000${image.baseUrl ?? ''}\u0000${image.startScalar}\u0000${image.endScalar}`;
}

function matchingOwners(chapter: ReadingSessionChapter, candidates: (ReadingSessionChapter | undefined)[]): ReadingSessionChapter[] {
  const owners: ReadingSessionChapter[] = [];
  for (const candidate of candidates) {
    if (candidate !== undefined && sameReadingImageChapter(candidate, chapter) && owners.indexOf(candidate) < 0) {
      owners.push(candidate);
    }
  }
  return owners;
}

/** Cleanup uses the allocator captured at creation, including after Runtime's
 * static current slot is retired. It never acquires a replacement Runtime. */
export class ReaderReadingImageResources {
  private readonly retained: ReadingSessionImage[] = [];
  private readonly geometryRequests: Map<string, DeferredReadingImagePixels> = new Map();
  private readonly continuousResolutions: Set<number> = new Set();
  private readonly byStartScalar: Map<number, ReadingSessionImage> = new Map();
  private readonly positionByKey: Map<string, number> = new Map();
  private failedReleaseCount: number = 0;

  private readonly allocator: ReaderReadingImageAllocator;
  private readonly onReleaseError: (error: Error) => void;

  constructor(allocator: ReaderReadingImageAllocator,
    onReleaseError: (error: Error) => void = (_error: Error): void => {}) {
    this.allocator = allocator;
    this.onReleaseError = onReleaseError;
  }

  get length(): number { return this.retained.length; }

  /** A thrown allocator release has no atomic receipt. Do not blindly replay
   * a possibly partial decrement; native Ability teardown remains the fallback. */
  releaseFailures(): number { return this.failedReleaseCount; }

  resetChapter(): void {
    this.continuousResolutions.clear();
    this.byStartScalar.clear();
    this.positionByKey.clear();
  }

  indexChapter(chapter: ReadingSessionChapter): void {
    this.byStartScalar.clear();
    this.positionByKey.clear();
    for (let index = 0; index < chapter.images.length; index += 1) {
      const image = chapter.images[index];
      this.byStartScalar.set(image.startScalar, image);
      this.positionByKey.set(readingImageKey(image), index);
    }
  }

  atScalar(startScalar: number): ReadingSessionImage | undefined {
    return this.byStartScalar.get(startScalar);
  }

  replacePending(chapter: ReadingSessionChapter, displayed: boolean, requested: ReadingSessionImage, resolved: ReadingSessionImage): boolean {
    const key = readingImageKey(requested);
    const index = displayed ? this.positionByKey.get(key) :
      chapter.images.findIndex((image: ReadingSessionImage): boolean => readingImageKey(image) === key);
    if (index === undefined || index < 0 || chapter.images[index].state !== 'pending') return false;
    chapter.images[index] = resolved;
    if (displayed) {
      this.byStartScalar.set(resolved.startScalar, resolved);
      this.positionByKey.delete(key);
      this.positionByKey.set(readingImageKey(resolved), index);
    }
    return true;
  }

  resolveContinuous(chapter: ReadingSessionChapter | undefined, startScalar: number, host: ReaderContinuousImageResolution): void {
    if (chapter === undefined || this.continuousResolutions.has(startScalar)) return;
    const requested = this.atScalar(startScalar);
    if (requested === undefined || requested.state !== 'pending') return;
    if (hasKnownReadingImageGeometry(requested)) {
      host.resolveGeometry(chapter, requested);
      return;
    }
    const isCurrent = host.captureCurrent(chapter);
    this.continuousResolutions.add(startScalar);
    void this.resolvePending(chapter, requested, isCurrent, host).finally((): void => {
      this.continuousResolutions.delete(startScalar);
    });
  }

  resolvePending(chapter: ReadingSessionChapter, requested: ReadingSessionImage, isCurrent: () => boolean,
    host: ReaderImageResolution): Promise<void> {
    return host.load(chapter, requested, isCurrent).then((resolved: ReadingSessionImage): void => {
      if (!isCurrent()) {
        this.releaseUnadmitted(resolved);
        return;
      }
      this.adopt(resolved);
      host.admit(requested, resolved);
    }).catch((error: Error): void => {
      if (isCurrent()) host.fail(error);
    });
  }

  /** A geometry-known image is decoded once and waits for the UI's admitted publication frame. */
  resolveGeometry(chapter: ReadingSessionChapter, requested: ReadingSessionImage, host: ReaderGeometryImageResolution): void {
    const imageKey = readingImageKey(requested);
    const key = JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex, chapter.contentVersion, imageKey]);
    if (this.geometryRequests.has(key) || requested.state !== 'pending' || !hasKnownReadingImageGeometry(requested)) return;
    const lease = host.captureCurrent();
    const current = (): boolean => lease() && matchingOwners(chapter, host.ownerCandidates(chapter)).some(
      (owner: ReadingSessionChapter): boolean => owner.images.some((image: ReadingSessionImage): boolean =>
        readingImageKey(image) === imageKey && image.intrinsicWidth === requested.intrinsicWidth &&
        image.intrinsicHeight === requested.intrinsicHeight));
    const pending: DeferredReadingImagePixels = { chapter, requested, isCurrent: current };
    this.geometryRequests.set(key, pending);
    void host.load(chapter, requested, current).then((resolved: ReadingSessionImage): void => {
      if (this.geometryRequests.get(key) !== pending || !current()) {
        this.releaseUnadmitted(resolved);
        if (this.geometryRequests.get(key) === pending) this.geometryRequests.delete(key);
        return;
      }
      pending.resolved = resolved;
      host.ready();
    }).catch((error: Error): void => {
      if (this.geometryRequests.get(key) === pending) this.geometryRequests.delete(key);
      if (current()) host.fail(error);
    });
  }

  flushGeometry(
    ownerCandidates: (chapter: ReadingSessionChapter) => (ReadingSessionChapter | undefined)[],
    publish: (chapter: ReadingSessionChapter, owners: ReadingSessionChapter[], image: ReadingSessionImage) => boolean,
  ): boolean {
    let changed = false;
    this.geometryRequests.forEach((pending: DeferredReadingImagePixels, key: string): void => {
      const resolved = pending.resolved;
      if (resolved === undefined) return;
      this.geometryRequests.delete(key);
      if (!pending.isCurrent()) {
        this.releaseUnadmitted(resolved);
        return;
      }
      const owners = matchingOwners(pending.chapter, ownerCandidates(pending.chapter));
      const imageKey = readingImageKey(pending.requested);
      let adopted = false;
      for (const owner of owners) {
        const index = owner.images.findIndex((candidate: ReadingSessionImage): boolean =>
          readingImageKey(candidate) === imageKey && candidate.state === 'pending');
        if (index >= 0) { owner.images[index] = resolved; adopted = true; }
      }
      if (!adopted) {
        this.releaseUnadmitted(resolved);
        return;
      }
      this.adopt(resolved);
      changed = publish(pending.chapter, owners, resolved) || changed;
    });
    return changed;
  }

  adopt(resource: ReadingSessionImage): void {
    if (resource.state !== 'ready' || !this.hasResource(resource)) return;
    for (const retained of this.retained) {
      if (sameReaderReadingImageResource(retained, resource)) {
        // Each Host load acquired a reference; one retained lease is enough
        // for identical bytes appearing at several anchors.
        this.releaseUnadmitted(resource);
        return;
      }
    }
    this.retained.push(resource);
  }

  releaseUnadmitted(resource: ReadingSessionImage): void {
    if (!this.hasResource(resource)) return;
    try {
      this.allocator.releaseReadingImage(resource.fileUri, resource.pixelMap);
    } catch (error) {
      this.failedReleaseCount += 1;
      try { this.onReleaseError(error as Error); } catch (_diagnosticError) {}
    }
  }

  prune(isRetained: (resource: ReadingSessionImage) => boolean): void {
    for (let index = this.retained.length - 1; index >= 0; index -= 1) {
      const resource = this.retained[index];
      if (isRetained(resource)) continue;
      this.retained.splice(index, 1);
      this.releaseUnadmitted(resource);
    }
  }

  close(): void {
    for (const pending of this.geometryRequests.values()) {
      if (pending.resolved !== undefined) this.releaseUnadmitted(pending.resolved);
    }
    this.geometryRequests.clear();
    const resources = this.retained.splice(0, this.retained.length);
    for (const resource of resources) this.releaseUnadmitted(resource);
  }

  private hasResource(resource: ReadingSessionImage): boolean {
    return resource.fileUri.length > 0 || resource.pixelMap !== undefined;
  }
}
