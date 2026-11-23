import type image from '@ohos.multimedia.image';
import type { ReadingSessionImage } from './ReadingChapterWindow';

/** The allocator owns native/file reference counts. This owner only tracks the
 * leases retained by one reader's presented/prepared chapter contexts. */
export interface ReaderReadingImageAllocator {
  releaseReadingImage(fileUri: string, pixelMap?: image.PixelMap): void;
}

export function sameReaderReadingImageResource(left: ReadingSessionImage, right: ReadingSessionImage): boolean {
  if (left.fileUri.length > 0 || right.fileUri.length > 0) {
    return left.fileUri.length > 0 && left.fileUri === right.fileUri;
  }
  return left.pixelMap !== undefined && left.pixelMap === right.pixelMap;
}

/** Cleanup uses the allocator captured at creation, including after Runtime's
 * static current slot is retired. It never acquires a replacement Runtime. */
export class ReaderReadingImageResources {
  private readonly retained: ReadingSessionImage[] = [];
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
    const resources = this.retained.splice(0, this.retained.length);
    for (const resource of resources) this.releaseUnadmitted(resource);
  }

  private hasResource(resource: ReadingSessionImage): boolean {
    return resource.fileUri.length > 0 || resource.pixelMap !== undefined;
  }
}
