import { diagnosticCodeOf } from '../../app/LogPrivacy';
import { MangaSessionGateway } from '../manga/MangaSessionGateway';
import type { MangaChapterResult } from '../manga/MangaContract';
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
  mangaManifestVersion?: string;
  chapterIndex: number;
  state: LocalReadingDownloadState;
  cachedBytes: number;
};

type CacheChapterMaterializationLease = {
  manga?: MangaChapterResult;
  chapterIndex: number;
  token: string;
};

export type ReadingOfflineBookProgress = {
  completedChapters: number;
  totalChapters: number;
  entries: LocalReadingTocEntry[];
};

const READER_OFFLINE_BOOK_CHUNK_SIZE = 20;
const READER_OFFLINE_MANIFEST_CONCURRENCY = 8;
const READER_OFFLINE_CHAPTER_CONCURRENCY = 2;
const READER_OFFLINE_IMAGE_CONCURRENCY = 3;

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
  private refreshedMangaSession?: RemoteReadingSession;

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
    const manifestChecks: number[] = [];
    for (let position = 0; position < session.entries.length; position += 1) {
      const tocEntry = session.entries[position];
      if (tocEntry.navigable === false || tocEntry.url.trim().length === 0) {
        entries.push({ index: tocEntry.index, title: tocEntry.title,
          ...(tocEntry.level === undefined ? {} : { level: tocEntry.level }), downloadState: 'unknown', navigable: false });
        continue;
      }
      let state: LocalReadingDownloadState = stateByChapter.get(tocEntry.index) ?? 'missing';
      if (state === 'completed' &&
        (session.contentKind === 'manga' ? this.runtime.isOfflineImageChapterComplete !== undefined : this.runtime.isOfflineImageChapterMaterialized !== undefined)) {
        manifestChecks.push(position);
      } else if (state === 'completed') {
        // Core completion proves the body transaction only. Without the Host
        // manifest capability, images have not been proven offline-safe.
        state = 'cached';
      }
      entries.push({ index: tocEntry.index, title: tocEntry.title,
        ...(tocEntry.level === undefined ? {} : { level: tocEntry.level }), downloadState: state, navigable: true });
    }
    await this.forEachConcurrent(manifestChecks, READER_OFFLINE_MANIFEST_CONCURRENCY,
      async (position: number): Promise<void> => {
        this.assertCurrent(isCurrent);
        const entry = entries[position];
        const version = statuses.find(status => status.chapterIndex === entry.index)?.mangaManifestVersion;
        const materialized = session.contentKind === 'manga' ? (version !== undefined && await this.runtime.isOfflineImageChapterComplete!({
          sourceId: session.identity.sourceId, bookId: session.identity.bookId, chapterIndex: entry.index, contentVersion: version,
        })) : await this.runtime.isOfflineImageChapterMaterialized!(
          session.identity.sourceId,
          session.identity.bookId,
          entry.index,
        );
        this.assertCurrent(isCurrent);
        entry.downloadState = materialized ? 'completed' : 'cached';
      });
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
    const totalChapters = session.entries.filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length;
    if (totalChapters === 0) {
      return this.loadProjection(session, isCurrent);
    }
    let projection: LocalReadingTocEntry[] = [];
    let completedChapters = 0;
    for (let startInclusive = 0; startInclusive < session.entries.length;
      startInclusive += READER_OFFLINE_BOOK_CHUNK_SIZE) {
      const endExclusive = Math.min(session.entries.length, startInclusive + READER_OFFLINE_BOOK_CHUNK_SIZE);
      projection = await this.prefetchRange(session, startInclusive, endExclusive, isCurrent);
      this.assertCurrent(isCurrent);
      completedChapters += session.entries.slice(startInclusive, endExclusive).filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length;
      onProgress?.({
        completedChapters,
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
    const callerCurrent = isCurrent;
    const refreshValid = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    isCurrent = (): boolean => callerCurrent?.() !== false && refreshValid?.() !== false;
    this.assertCurrent(isCurrent);
    if (session.contentKind === 'manga') {
      const requestedSession = session;
      const coordinator = this.runtime.bookAcquisitions?.();
      if (coordinator !== undefined) {
        const version = await coordinator.currentSourceVersion(session.identity.sourceId);
        this.assertCurrent(isCurrent);
        const prior = this.refreshedMangaSession;
        if (prior !== undefined && prior.identity.sourceId === session.identity.sourceId &&
          prior.identity.bookId === session.identity.bookId && prior.sourceVersion === version) session = prior;
        if (version !== undefined && session.sourceVersion !== version) {
          const fresh = await this.remote.openSession({ ...session.book, ...session.identity,
            detailUrl: session.detailUrl, sourceVersion: version, contentKind: 'manga', searchVariables: [] },
            { forceRefresh: true, isCurrent });
          this.assertCurrent(isCurrent);
          this.refreshedMangaSession = fresh;
          session = fresh;
        }
        // Reusing a refreshed catalog must also preserve every requested identity.
        for (const old of requestedSession.entries.filter(entry => entry.index >= startInclusive && entry.index < endExclusive)) {
          if (!session.entries.some(entry => entry.index === old.index && entry.url === old.url &&
            (old.navigable === false || entry.navigable !== false))) {
            throw new Error('MANGA_DOWNLOAD_CATALOG_CHANGED_REOPEN_REQUIRED');
          }
        }
      }
    }
    this.assertRange(session, startInclusive, endExclusive);
    this.assertCurrent(isCurrent);
    if (session.contentKind === 'manga' && this.runtime.supportsCoreCapability?.('manga.offline.v1') !== true) throw new Error('MANGA_OFFLINE_CORE_REQUIRED');
    if (!session.entries.some(entry => entry.index >= startInclusive && entry.index < endExclusive && entry.navigable !== false && entry.url.trim().length > 0)) {
      return this.loadProjection(session, isCurrent);
    }
    const contentValid = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    const current = (): boolean => isCurrent?.() !== false && contentValid?.() !== false;
    const params: JsonObject = {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      chapterRange: [startInclusive, endExclusive],
      priority: 0,
      requestedAt: Date.now(),
    };
    if (session.contentKind === 'manga') params['contentKind'] = 'manga';
    const result = await this.runtime.request('cache.book.prefetch', params, this.requestOptions(current, 300000));
    const materializations = this.assertPrefetchResult(
      result,
      session,
      startInclusive,
      endExclusive,
    );
    if (session.contentKind === 'manga') {
      // Every claimed lease must settle, including work not started after a
      // cancellation or failure. Otherwise Core retains an InProgress row.
      let firstFailure: Error | undefined;
      for (const lease of materializations) {
        if (firstFailure !== undefined) {
          try { await this.reportMaterialization(session, lease, 'failed', 'cancelled'); }
          catch (error) { console.warn(`Manga lease settlement failed: ${diagnosticCodeOf((error as Error).message)}`); }
          continue;
        }
        try { await this.materializeManga(session, lease, current); }
        catch (error) { firstFailure = error as Error; }
      }
      if (firstFailure !== undefined) throw firstFailure;
      return this.loadProjection(session, isCurrent);
    }
    this.assertCurrent(isCurrent);

    await this.forEachConcurrent(materializations, READER_OFFLINE_CHAPTER_CONCURRENCY,
      async (materialization: CacheChapterMaterializationLease): Promise<void> => {
        await this.materializeChapter(session, materialization, current);
      });
    return this.loadProjection(session, isCurrent);
  }

  private async materializeManga(session: RemoteReadingSession, lease: CacheChapterMaterializationLease,
    isCurrent: OfflineRequestGuard): Promise<void> {
    try {
      this.assertCurrent(isCurrent);
      if (this.runtime.prefetchReadingImage === undefined || this.runtime.markOfflineImageChapterComplete === undefined ||
        this.runtime.isOfflineImageChapterComplete === undefined || lease.manga === undefined) throw new Error('MANGA_OFFLINE_HOST_REQUIRED');
      const data = lease.manga;
      const manifest = data.manifest;
      const identities: ReadingGatewayImageCacheIdentity[] = [];
      for (const page of manifest.pages) {
        this.assertCurrent(isCurrent);
        const request = data.resources.find(resource => resource.resourceRef === page.resourceRef)?.request;
        const identity: ReadingGatewayImageCacheIdentity = { sourceId: manifest.chapter.sourceId, bookId: manifest.chapter.bookId,
          chapterIndex: data.chapterIndex, contentVersion: manifest.manifestVersion, resourceRef: page.resourceRef,
          imageUrl: request?.requestRule ?? request?.url ?? page.resourceRef, baseUrl: manifest.chapter.chapterId };
        await this.runtime.prefetchReadingImage(identity, isCurrent, manifest.sourceRuleVersion, request !== undefined);
        identities.push(identity);
      }
      this.assertCurrent(isCurrent);
      const chapter: ReadingGatewayImageChapterIdentity = { sourceId: manifest.chapter.sourceId, bookId: manifest.chapter.bookId,
        chapterIndex: data.chapterIndex, contentVersion: manifest.manifestVersion };
      await this.runtime.markOfflineImageChapterComplete(chapter, identities, isCurrent);
      if (!(await this.runtime.isOfflineImageChapterComplete(chapter))) throw new Error('MANGA_OFFLINE_MANIFEST_MISSING');
      this.assertCurrent(isCurrent);
    } catch (error) {
      const failure = normalizeReadingOfflineMaterializationError(error);
      await this.reportMaterialization(session, lease, 'failed', failure.code);
      throw failure;
    }
    await this.reportMaterialization(session, lease, 'completed');
  }

  private async materializeChapter(
    session: RemoteReadingSession,
    materialization: CacheChapterMaterializationLease,
    isCurrent?: OfflineRequestGuard,
  ): Promise<void> {
    try {
      const chapter = await this.remote.loadChapter(session, materialization.chapterIndex, isCurrent);
      this.assertCurrent(isCurrent);
      const resources = this.imageResources(chapter);
      if (resources.length > 0) {
        this.requireImagePersistenceCapabilities();
      }
      await this.forEachConcurrent(resources, READER_OFFLINE_IMAGE_CONCURRENCY,
        async (resource: ReadingGatewayImageCacheIdentity): Promise<void> => {
          await this.runtime.prefetchReadingImage!(resource, isCurrent);
          this.assertCurrent(isCurrent);
        });
      if (this.runtime.markOfflineImageChapterComplete !== undefined) {
        await this.runtime.markOfflineImageChapterComplete(this.chapterIdentity(chapter), resources);
        this.assertCurrent(isCurrent);
      }
    } catch (error) {
      const failure = normalizeReadingOfflineMaterializationError(error as Error);
      try {
        await this.reportMaterialization(session, materialization, 'failed', failure.code);
      } catch (reportError) {
        throw new ReadingOfflineMaterializationError(
          failure.code,
          `${failure.message}; Core materialization failure report failed: ${(reportError as Error).message}`,
        );
      }
      if (failure.code === 'cancelled') {
        throw failure;
      }
      console.warn(`ReadingOfflineGateway image materialization incomplete: ${diagnosticCodeOf(failure.message)}`);
      return;
    }
    await this.reportMaterialization(session, materialization, 'completed');
  }

  private async forEachConcurrent<T>(
    items: T[],
    concurrency: number,
    work: (item: T) => Promise<void>,
  ): Promise<void> {
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    const workers: Promise<void>[] = [];
    for (let worker = 0; worker < workerCount; worker += 1) {
      workers.push((async (): Promise<void> => {
        while (nextIndex < items.length) {
          const index = nextIndex;
          nextIndex += 1;
          await work(items[index]);
        }
      })());
    }
    await Promise.all(workers);
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
      includeGlobalStats: false,
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
        mangaManifestVersion: typeof raw['mangaManifestVersion'] === 'string' && (raw['mangaManifestVersion'] as string).length > 0 ? raw['mangaManifestVersion'] as string : undefined,
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
        !session.entries.some(entry => entry.index === chapterIndex && entry.navigable !== false && entry.url.trim().length > 0) ||
        seenIndexes.has(chapterIndex) || typeof token !== 'string' || token.trim().length === 0) {
        throw new Error('cache.book.prefetch returned an invalid materialization lease');
      }
      seenIndexes.add(chapterIndex);
      let manga: MangaChapterResult | undefined = undefined;
      if (session.contentKind === 'manga') {
        manga = new MangaSessionGateway(this.runtime).validateChapter(raw['manga'] as unknown as MangaChapterResult,
          session.identity.sourceId, session.identity.bookId, chapterIndex);
        if (manga.manifest.chapter.chapterId !== session.entries.find(entry => entry.index === chapterIndex)?.url) throw new Error('MANGA_OFFLINE_CATALOG_CHANGED');
      } else if (raw['manga'] !== undefined) throw new Error('MANGA_OFFLINE_KIND_MISMATCH');
      materializations.push({ chapterIndex, token, manga });
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
    if (materialization.manga !== undefined) {
      const manifest = materialization.manga.manifest;
      params['manga'] = { chapter: manifest.chapter as unknown as JsonObject, manifestVersion: manifest.manifestVersion,
        resourceRefs: manifest.pages.map(page => page.resourceRef) };
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
          result.data['state'] !== outcome || result.data['retainedCachedBody'] !== (materialization.manga === undefined)) {
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
