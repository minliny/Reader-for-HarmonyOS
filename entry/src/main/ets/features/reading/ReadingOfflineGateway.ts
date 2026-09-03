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
import {
  normalizeReadingOfflineMaterializationError,
  ReadingOfflineMaterializationError,
  type ReadingOfflineMaterializationErrorCode,
} from './ReadingOfflineContract';

type OfflineRequestGuard = () => boolean;

type CacheChapterProjection = {
  chapterIndex: number;
  state: LocalReadingDownloadState;
  cachedBytes: number;
};

type CacheChapterMaterializationLease = {
  chapterIndex: number;
  token: string;
};

export type ReadingOfflineBookProgress = {
  completedChapters: number;
  totalChapters: number;
  entries: LocalReadingTocEntry[];
};

const READER_OFFLINE_BOOK_CHUNK_SIZE = 20;

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
    const stateByChapter = new Map<number, LocalReadingDownloadState>();
    for (const status of statuses) {
      // A failed/cancelled image materialization must not hide the already
      // durable text body. Core remains the byte-level truth; `cached` means
      // text is readable while external images may still need a retry.
      stateByChapter.set(status.chapterIndex,
        status.cachedBytes > 0 && status.state !== 'completed' ? 'cached' : status.state);
    }
    const entries: LocalReadingTocEntry[] = [];
    for (const tocEntry of session.entries) {
      let state: LocalReadingDownloadState = stateByChapter.get(tocEntry.index) ?? 'missing';
      if (state === 'completed' &&
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

  /**
   * Resumes a whole-book request in bounded slices while Core remains the only
   * durable queue and byte store. Re-entering this method is safe: Core skips
   * bodies that are already durable and returns fresh materialization leases
   * only for the chapters that still need Host image work.
   */
  async prefetchBook(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
    onProgress?: (progress: ReadingOfflineBookProgress) => void,
  ): Promise<LocalReadingTocEntry[]> {
    const totalChapters = session.entries.length;
    if (totalChapters === 0) {
      return this.loadProjection(session, isCurrent);
    }
    let projection: LocalReadingTocEntry[] = [];
    for (let startInclusive = 0; startInclusive < totalChapters;
      startInclusive += READER_OFFLINE_BOOK_CHUNK_SIZE) {
      const endExclusive = Math.min(totalChapters, startInclusive + READER_OFFLINE_BOOK_CHUNK_SIZE);
      projection = await this.prefetchRange(session, startInclusive, endExclusive, isCurrent);
      this.assertCurrent(isCurrent);
      onProgress?.({
        completedChapters: endExclusive,
        totalChapters,
        entries: projection,
      });
    }
    return projection;
  }

  async prefetchRange(
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    this.assertRange(session, startInclusive, endExclusive);
    this.assertCurrent(isCurrent);
    const result = await this.runtime.request('cache.book.prefetch', {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      chapterRange: [startInclusive, endExclusive],
      priority: 0,
      requestedAt: Date.now(),
    }, this.requestOptions(isCurrent, 300000));
    const materializations = this.assertPrefetchResult(
      result,
      session,
      startInclusive,
      endExclusive,
    );
    this.assertCurrent(isCurrent);

    for (const materialization of materializations) {
      try {
        const chapter = await this.remote.loadChapter(session, materialization.chapterIndex, isCurrent);
        this.assertCurrent(isCurrent);
        const resources = this.imageResources(chapter);
        if (resources.length > 0) {
          this.requireImagePersistenceCapabilities();
        }
        for (const resource of resources) {
          await this.runtime.prefetchReadingImage!(resource, isCurrent);
          this.assertCurrent(isCurrent);
        }
        if (this.runtime.markOfflineImageChapterComplete !== undefined) {
          await this.runtime.markOfflineImageChapterComplete(this.chapterIdentity(chapter), resources);
          this.assertCurrent(isCurrent);
        }
      } catch (error) {
        const failure = normalizeReadingOfflineMaterializationError(error as Error);
        try {
          await this.reportMaterialization(
            session,
            materialization,
            'failed',
            failure.code,
          );
        } catch (reportError) {
          throw new ReadingOfflineMaterializationError(
            failure.code,
            `${failure.message}; Core materialization failure report failed: ${(reportError as Error).message}`,
          );
        }
        if (failure.code === 'cancelled') {
          throw failure;
        }
        // The Core prefetch already made the chapter body durable. Keep the
        // download usable as `cached` and let a later user retry complete L2
        // images instead of promoting an image failure to a text failure.
        console.warn(`ReadingOfflineGateway image materialization incomplete: ${failure.message}`);
        continue;
      }
      await this.reportMaterialization(session, materialization, 'completed');
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
      statuses.push({
        chapterIndex,
        state: this.requireDownloadState(raw['state']),
        cachedBytes: this.requireNonNegativeInteger(raw['cachedBytes'] ?? 0, 'cachedBytes'),
      });
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
  ): CacheChapterMaterializationLease[] {
    if (result.data['sourceId'] !== session.identity.sourceId ||
      result.data['bookId'] !== session.identity.bookId) {
      throw new Error('cache.book.prefetch returned a mismatched book identity');
    }
    const range = result.data['chapterRange'];
    if (!Array.isArray(range) || range.length !== 2 ||
      range[0] !== startInclusive || range[1] !== endExclusive) {
      throw new Error('cache.book.prefetch returned a mismatched chapter range');
    }
    const rawMaterializations = result.data['materializations'];
    if (!Array.isArray(rawMaterializations)) {
      throw new Error('cache.book.prefetch returned invalid materializations');
    }
    const materializations: CacheChapterMaterializationLease[] = [];
    const seenIndexes = new Set<number>();
    for (const rawValue of rawMaterializations) {
      const raw = this.requireObject(rawValue, 'cache.book.prefetch materialization');
      const chapterIndex = this.requireNonNegativeInteger(raw['chapterIndex'], 'chapterIndex');
      const token = raw['token'];
      if (chapterIndex < startInclusive || chapterIndex >= endExclusive ||
        seenIndexes.has(chapterIndex) || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('cache.book.prefetch returned an invalid materialization lease');
      }
      seenIndexes.add(chapterIndex);
      materializations.push({ chapterIndex, token });
    }
    return materializations;
  }

  private async reportMaterialization(
    session: RemoteReadingSession,
    materialization: CacheChapterMaterializationLease,
    outcome: 'completed' | 'failed',
    errorCode?: ReadingOfflineMaterializationErrorCode,
  ): Promise<void> {
    const params: JsonObject = {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      chapterIndex: materialization.chapterIndex,
      token: materialization.token,
      outcome,
      reportedAt: Date.now(),
    };
    if (errorCode !== undefined) {
      params['errorCode'] = errorCode;
    }
    // This terminal report deliberately has no route cancellation guard. The
    // opaque token makes it safe after navigation and prevents a stale task
    // from changing a newer attempt.
    let lastError: Error | undefined = undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.runtime.request(
          'cache.chapter.materialization.report',
          params,
          { timeoutMs: 30000 },
        );
        if (result.data['sourceId'] !== session.identity.sourceId ||
          result.data['bookId'] !== session.identity.bookId ||
          result.data['chapterIndex'] !== materialization.chapterIndex ||
          result.data['state'] !== outcome || result.data['retainedCachedBody'] !== true) {
          throw new Error('cache.chapter.materialization.report returned a mismatched result');
        }
        return;
      } catch (error) {
        lastError = error as Error;
      }
    }
    throw lastError ?? new Error('cache.chapter.materialization.report failed');
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
