import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import type { LocalReadingDownloadState, LocalReadingTocEntry } from './LocalReadingFlowGateway';
import {
  RemoteReadingFlowGateway,
  type RemoteReadingSession,
} from './RemoteReadingFlowGateway';
import type {
  ReadingGatewayImageCacheIdentity,
  ReadingGatewayImageChapterIdentity,
  ReadingGatewayRuntime,
} from './ReadingGatewayRuntime';
import type { ReadingSessionChapter, ReadingSessionImage } from './ReadingChapterWindow';

type OfflineRequestGuard = () => boolean;

type CacheChapterProjection = {
  chapterIndex: number;
  state: LocalReadingDownloadState;
};

/**
 * Feature orchestration over Core's existing durable download queue.
 *
 * This class deliberately owns no queue, retry counter, socket, or body
 * database. Core performs the exact half-open range transaction; the Host
 * validates and persists bounded image bytes before publishing its chapter
 * manifest. A body-only result remains `cached`, never falsely `completed`.
 */
export class ReadingOfflineGateway {
  private readonly runtime: ReadingGatewayRuntime;
  private readonly remote: RemoteReadingFlowGateway;

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime;
    this.remote = new RemoteReadingFlowGateway(runtime);
  }

  async loadProjection(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    const statuses = await this.loadCoreStatuses(session, isCurrent);
    const entries: LocalReadingTocEntry[] = [];
    for (const tocEntry of session.entries) {
      let state: LocalReadingDownloadState = 'missing';
      for (const status of statuses) {
        if (status.chapterIndex === tocEntry.index) {
          state = status.state;
          break;
        }
      }
      if ((state === 'cached' || state === 'completed') &&
        this.runtime.isOfflineImageChapterMaterialized !== undefined) {
        this.assertCurrent(isCurrent);
        const materialized = await this.runtime.isOfflineImageChapterMaterialized(
          session.identity.sourceId,
          session.identity.bookId,
          tocEntry.index,
        );
        this.assertCurrent(isCurrent);
        state = materialized ? 'completed' : 'cached';
      } else if (state === 'completed') {
        // Core completion proves the body transaction only. Without the Host
        // manifest capability, images have not been proven offline-safe.
        state = 'cached';
      }
      entries.push({ index: tocEntry.index, title: tocEntry.title, downloadState: state });
    }
    return entries;
  }

  async prefetchChapter(
    session: RemoteReadingSession,
    chapterIndex: number,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    return this.prefetchRange(session, chapterIndex, chapterIndex + 1, isCurrent);
  }

  async prefetchRange(
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    this.assertRange(session, startInclusive, endExclusive);
    this.requireImagePersistenceCapabilities();
    this.assertCurrent(isCurrent);
    const result = await this.runtime.request('cache.book.prefetch', {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      chapterRange: [startInclusive, endExclusive],
      priority: 0,
      requestedAt: Date.now(),
    }, this.requestOptions(isCurrent, 300000));
    this.assertPrefetchResult(result, session, startInclusive, endExclusive);
    this.assertCurrent(isCurrent);

    for (let chapterIndex = startInclusive; chapterIndex < endExclusive; chapterIndex += 1) {
      const chapter = await this.remote.loadChapter(session, chapterIndex, isCurrent);
      this.assertCurrent(isCurrent);
      const resources = this.imageResources(chapter);
      for (const resource of resources) {
        await this.runtime.prefetchReadingImage!(resource, isCurrent);
        this.assertCurrent(isCurrent);
      }
      await this.runtime.markOfflineImageChapterComplete!(this.chapterIdentity(chapter), resources);
      this.assertCurrent(isCurrent);
    }
    return this.loadProjection(session, isCurrent);
  }

  async clearBook(session: RemoteReadingSession, isCurrent?: OfflineRequestGuard): Promise<void> {
    return this.clearBookIdentity(
      session.identity.sourceId,
      session.identity.bookId,
      isCurrent,
    );
  }

  async clearBookIdentity(
    sourceId: string,
    bookId: string,
    isCurrent?: OfflineRequestGuard,
  ): Promise<void> {
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) {
      throw new Error('offline book identity must be non-blank');
    }
    if (this.runtime.clearOfflineBookImages === undefined) {
      throw new Error('offline reading image clear capability is unavailable');
    }
    this.assertCurrent(isCurrent);
    const result = await this.runtime.request('cache.clear', {
      scope: 'book',
      sourceId,
      bookId,
    }, this.requestOptions(isCurrent));
    if (result.data['scope'] !== 'book') {
      throw new Error('cache.clear did not confirm the exact book scope');
    }
    this.assertCurrent(isCurrent);
    // Core clears first, so a Host cleanup failure can only leave unreachable
    // files; retrying the same exact book clear remains safe and monotonic.
    await this.runtime.clearOfflineBookImages(sourceId, bookId);
    this.assertCurrent(isCurrent);
  }

  private async loadCoreStatuses(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
  ): Promise<CacheChapterProjection[]> {
    const result = await this.runtime.request('cache.book.status', {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
    }, this.requestOptions(isCurrent));
    if (result.data['sourceId'] !== session.identity.sourceId ||
      result.data['bookId'] !== session.identity.bookId) {
      throw new Error('cache.book.status returned a mismatched book identity');
    }
    const rawChapters = result.data['chapters'];
    if (!Array.isArray(rawChapters)) {
      throw new Error('cache.book.status returned invalid chapters');
    }
    const statuses: CacheChapterProjection[] = [];
    for (const rawValue of rawChapters) {
      const raw = this.requireObject(rawValue, 'cache.book.status chapter');
      const chapterIndex = this.requireNonNegativeInteger(raw['chapterIndex'], 'chapterIndex');
      statuses.push({ chapterIndex, state: this.requireDownloadState(raw['state']) });
    }
    return statuses;
  }

  private imageResources(chapter: ReadingSessionChapter): ReadingGatewayImageCacheIdentity[] {
    const resources: ReadingGatewayImageCacheIdentity[] = [];
    for (const image of chapter.images) {
      if (this.isEmbeddedImage(image)) {
        continue;
      }
      resources.push({
        sourceId: chapter.sourceId,
        bookId: chapter.bookId,
        chapterIndex: chapter.chapterIndex,
        contentVersion: chapter.contentVersion,
        imageUrl: image.source,
        baseUrl: image.baseUrl,
      });
    }
    return resources;
  }

  private isEmbeddedImage(image: ReadingSessionImage): boolean {
    return image.source.trim().toLowerCase().startsWith('data:image/');
  }

  private chapterIdentity(chapter: ReadingSessionChapter): ReadingGatewayImageChapterIdentity {
    return {
      sourceId: chapter.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      contentVersion: chapter.contentVersion,
    };
  }

  private assertPrefetchResult(
    result: ReaderCoreResultEvent,
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
  ): void {
    if (result.data['sourceId'] !== session.identity.sourceId ||
      result.data['bookId'] !== session.identity.bookId) {
      throw new Error('cache.book.prefetch returned a mismatched book identity');
    }
    const range = result.data['chapterRange'];
    if (!Array.isArray(range) || range.length !== 2 ||
      range[0] !== startInclusive || range[1] !== endExclusive) {
      throw new Error('cache.book.prefetch returned a mismatched chapter range');
    }
  }

  private assertRange(session: RemoteReadingSession, startInclusive: number, endExclusive: number): void {
    if (!Number.isSafeInteger(startInclusive) || !Number.isSafeInteger(endExclusive) ||
      startInclusive < 0 || endExclusive <= startInclusive || endExclusive > session.entries.length) {
      throw new Error('offline chapter range must be a non-empty in-TOC half-open range');
    }
    for (let chapterIndex = startInclusive; chapterIndex < endExclusive; chapterIndex += 1) {
      if (session.entries[chapterIndex].index !== chapterIndex) {
        throw new Error('offline prefetch requires a contiguous zero-based TOC');
      }
    }
  }

  private requireImagePersistenceCapabilities(): void {
    if (this.runtime.prefetchReadingImage === undefined ||
      this.runtime.markOfflineImageChapterComplete === undefined ||
      this.runtime.isOfflineImageChapterMaterialized === undefined) {
      throw new Error('offline reading image persistence capability is unavailable');
    }
  }

  private requireObject(value: unknown, context: string): JsonObject {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${context} must be an object`);
    }
    return value as JsonObject;
  }

  private requireNonNegativeInteger(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`cache.book.status returned invalid ${field}`);
    }
    return value;
  }

  private requireDownloadState(value: unknown): LocalReadingDownloadState {
    if (value === 'missing' || value === 'queued' || value === 'inProgress' || value === 'cached' ||
      value === 'completed' || value === 'failed' || value === 'cancelled') {
      return value;
    }
    throw new Error('cache.book.status returned invalid chapter state');
  }

  private requestOptions(isCurrent: OfflineRequestGuard | undefined, timeoutMs?: number): RequestOptions {
    const options: RequestOptions = {};
    if (isCurrent !== undefined) {
      options.shouldCancel = (): boolean => !isCurrent();
    }
    if (timeoutMs !== undefined) {
      options.timeoutMs = timeoutMs;
    }
    return options;
  }

  private assertCurrent(isCurrent: OfflineRequestGuard | undefined): void {
    if (isCurrent !== undefined && !isCurrent()) {
      throw new Error('reading offline request was superseded');
    }
  }
}
