import { MangaChapterPreparationCoordinator } from '../manga/MangaChapterPreparationCoordinator';
import type { CacheClearOperationIntentStore, ReadingOperationContext, ReadingOperationIntent, ReadingRecoveredOperation } from './ReadingOperationIntents';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { diagnosticCodeOf } from '../../app/LogPrivacy';
import type { BookAcquisitionCoordinator } from '../../app/BookAcquisitionCoordinator';
import { MangaSessionGateway } from '../manga/MangaSessionGateway';
import type { MangaChapterResult, MangaPreparedEntry } from '../manga/MangaContract';
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
import { materializeReadingDocument } from './ReadingDocumentProjection';
import {
  normalizeReadingOfflineMaterializationError,
  ReadingOfflineMaterializationError,
  type ReadingOfflineMaterializationErrorCode,
} from './ReadingOfflineContract';

type OfflineRequestGuard = () => boolean;
type OfflineChapterGuard = (chapterIndex: number) => boolean;

type MangaPendingClaim = {
  startInclusive: number;
  endExclusive: number;
  settled: Promise<void>;
};
type MangaMaterializationWork = {
  chapterIndex: number;
  started: boolean;
  settled: Promise<void>;
  finish: () => void;
  cancelIfExcluded: () => Promise<void>;
};


type CacheChapterProjection = {
  mangaManifestVersion?: string;
  chapterIndex: number;
  state: LocalReadingDownloadState;
  cachedBytes: number;
  lastError?: string;
};

type CacheChapterMaterializationLease = {
  manga?: MangaChapterResult;
  chapterIndex: number;
  token: string;
};

export type ReadingOfflineBookProgress = {
  processedChapters: number;
  completedChapters: number;
  cachedChapters: number;
  failedChapters: number;
  firstFailure?: { chapterIndex: number; reason: string };
  totalChapters: number;
  entries: LocalReadingTocEntry[];
};

type OfflineChapterProof = {
  identity: ReadingGatewayImageChapterIdentity;
  isCurrent: () => boolean;
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
  private readonly pendingMangaClaims: Set<MangaPendingClaim> = new Set();
  private readonly mangaMaterializations: Set<MangaMaterializationWork> = new Set();

  private clearIntents?: CacheClearOperationIntentStore;
  constructor(runtime: ReadingGatewayRuntime, clearIntents?: CacheClearOperationIntentStore) {
    this.runtime = runtime; this.clearIntents = clearIntents;
    this.remote = new RemoteReadingFlowGateway(runtime);
  }

  installClearAuthority(intents: CacheClearOperationIntentStore): void { this.clearIntents ??= intents; }

  async loadProjection(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    return (await this.loadProjectionResult(session, isCurrent)).entries;
  }

  /** Text directories need durable body availability only. Manga completion
   * also requires its retained exact manifest and the existing Host files. */
  async loadDirectoryProjection(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
  ): Promise<LocalReadingTocEntry[]> {
    return (await this.loadProjectionResult(session, isCurrent, undefined, session.contentKind === 'manga')).entries;
  }

  private async loadProjectionResult(
    session: RemoteReadingSession,
    isCurrent?: OfflineRequestGuard,
    proofs?: Map<string, OfflineChapterProof>,
    verifyImages: boolean = true,
  ): Promise<ReadingOfflineBookProgress> {
    // A mutation after an early worker finishes must invalidate the whole
    // returned projection, including its already checked chapters.
    const current = this.contentGuard(session, isCurrent);
    this.assertCurrent(current);
    const statuses = await this.loadCoreStatuses(session, current);
    const retained = new Map<string, string>();
    if (session.contentKind === 'manga') {
      const result = await this.runtime.request('manga.retention.list', {
        sourceId: session.identity.sourceId, bookId: session.identity.bookId,
      }, this.requestOptions(current));
      this.assertCurrent(current);
      if (!Array.isArray(result.data['retentions'])) throw new Error('manga retention projection is unavailable');
      for (const value of result.data['retentions'] as JsonObject[]) {
        const row = this.requireObject(value, 'manga.retention.list row');
        const chapter = this.requireObject(row['chapter'], 'manga retention chapter');
        if (chapter['sourceId'] !== session.identity.sourceId || chapter['bookId'] !== session.identity.bookId ||
          typeof chapter['chapterId'] !== 'string' || (chapter['chapterId'] as string).trim().length === 0 ||
          typeof row['manifestVersion'] !== 'string' || (row['manifestVersion'] as string).trim().length === 0 ||
          retained.has(chapter['chapterId'] as string)) throw new Error('manga retention identity changed');
        retained.set(chapter['chapterId'] as string, row['manifestVersion'] as string);
      }
    }
    const stateByChapter = new Map<number, LocalReadingDownloadState>();
    for (const status of statuses) {
      // A failed/cancelled image materialization must not hide the already
      // durable text body. Core remains the byte-level truth; `cached` means
      // text is readable while external images may still need a retry.
      stateByChapter.set(status.chapterIndex,
        session.contentKind !== 'manga' && status.cachedBytes > 0 && status.state !== 'completed' && status.state !== 'paused' ? 'cached' : status.state);
    }
    const entries: LocalReadingTocEntry[] = [];
    const manifestChecks: number[] = [];
    const readableIndexes = new Set<number>();
    for (let position = 0; position < session.entries.length; position += 1) {
      const tocEntry = session.entries[position];
      if (tocEntry.navigable === false || tocEntry.url.trim().length === 0) {
        entries.push({ index: tocEntry.index, title: tocEntry.title,
          displayTitle: tocEntry.displayTitle, isVip: tocEntry.isVip, isPay: tocEntry.isPay, contextTitle: tocEntry.contextTitle,
          ...(tocEntry.level === undefined ? {} : { level: tocEntry.level }), downloadState: 'unknown', navigable: false });
        continue;
      }
      readableIndexes.add(tocEntry.index);
      let state: LocalReadingDownloadState = stateByChapter.get(tocEntry.index) ?? 'missing';
      if (session.contentKind === 'manga' && state === 'completed' &&
        retained.get(tocEntry.url) !== statuses.find(status => status.chapterIndex === tocEntry.index)?.mangaManifestVersion) state = 'cached';
      if (state === 'completed' && verifyImages &&
        this.runtime.isOfflineImageChapterComplete !== undefined) {
        manifestChecks.push(position);
      } else if (state === 'completed') {
        // Core completion proves the body transaction only. Without the Host
        // manifest capability, images have not been proven offline-safe.
        state = 'cached';
      }
      entries.push({ index: tocEntry.index, title: tocEntry.title,
          displayTitle: tocEntry.displayTitle, isVip: tocEntry.isVip, isPay: tocEntry.isPay, contextTitle: tocEntry.contextTitle,
        ...(tocEntry.level === undefined ? {} : { level: tocEntry.level }), downloadState: state, navigable: true });
    }
    await this.forEachConcurrent(manifestChecks, READER_OFFLINE_MANIFEST_CONCURRENCY,
      async (position: number): Promise<void> => {
        this.assertCurrent(current);
        const entry = entries[position];
        if (session.contentKind === 'manga') {
          const version = statuses.find(status => status.chapterIndex === entry.index)?.mangaManifestVersion;
          let prepared: MangaPreparedEntry | null = null;
          if (version !== undefined) {
            try {
              prepared = await new MangaSessionGateway(this.runtime).entry(session.identity.sourceId,
                session.identity.bookId, entry.index, current);
            } catch (_) { this.assertCurrent(current); }
          }
          const materialized = prepared !== null && prepared.chapter.manifest.manifestVersion === version &&
            await this.runtime.isOfflineImageChapterComplete!({ sourceId: session.identity.sourceId,
              bookId: session.identity.bookId, chapterIndex: entry.index, chapterId: prepared.chapter.manifest.chapter.chapterId, contentVersion: version!,
              mangaDecodeRevision: prepared.chapter.manifest.decodeRevision }, true, current);
          this.assertCurrent(current);
          entry.downloadState = materialized ? 'completed' : 'cached';
          return;
        }
        const key = this.proofKey(session, entry.index);
        const saved = proofs?.get(key);
        const identity = saved !== undefined && saved.isCurrent() ? saved.identity :
          await this.currentChapterIdentity(session, position, current);
        this.assertCurrent(current);
        if (identity === undefined) {
          entry.downloadState = 'cached';
          return;
        }
        const materialized = await this.runtime.isOfflineImageChapterComplete!(identity);
        this.assertCurrent(current);
        if (saved !== undefined && identity === saved.identity) this.assertCurrent(saved.isCurrent);
        // The map belongs only to this explicit download. Every use still
        // checks the exact manifest and resource files; no completion is cached.
        proofs?.set(key, { identity, isCurrent: current });
        entry.downloadState = materialized ? 'completed' : 'cached';
      });
    this.assertCurrent(current);
    const failures = statuses.filter(status => status.state === 'failed' && readableIndexes.has(status.chapterIndex));
    const first = failures[0];
    return {
      processedChapters: 0,
      completedChapters: entries.filter(entry => entry.downloadState === 'completed').length,
      cachedChapters: entries.filter(entry => entry.downloadState === 'cached').length,
      failedChapters: failures.length,
      firstFailure: first === undefined ? undefined : {
        chapterIndex: first.chapterIndex, reason: this.failureReason(first.lastError),
      },
      totalChapters: entries.filter(entry => entry.navigable !== false).length,
      entries,
    };
  }

  private async currentChapterIdentity(
    session: RemoteReadingSession,
    position: number,
    current: OfflineRequestGuard,
  ): Promise<ReadingGatewayImageChapterIdentity | undefined> {
    // An older Core must never turn an unrecognized cacheOnly projection into
    // transport. Keep its body-only state until the exact read is supported.
    if (this.runtime.supportsCoreCapability?.('chapter.content.cacheOnly.v1') !== true) return undefined;
    const chapter = session.entries[position];
    this.assertCurrent(current);
    // Never use online loadChapter here: this is a read-only projection, even
    // when a body disappears after cache.book.status. Core enforces cacheOnly.
    const result = await this.runtime.request('chapter.content', {
      sourceId: session.identity.sourceId, bookId: session.identity.bookId,
      chapterIndex: chapter.index, chapterTitle: chapter.title, chapterUrl: chapter.url,
      cacheOnly: true,
    }, this.requestOptions(current));
    this.assertCurrent(current);
    if (result.data['sourceId'] !== session.identity.sourceId || result.data['bookId'] !== session.identity.bookId) {
      throw new Error('offline chapter projection returned a mismatched book identity');
    }
    const http = result.data['http'];
    let baseUrl = chapter.url;
    if (http !== undefined && http !== null) {
      const finalUrl = this.requireObject(http, 'chapter.content http')['finalUrl'];
      if (finalUrl !== undefined && finalUrl !== null) {
        if (typeof finalUrl !== 'string') throw new Error('chapter.content returned invalid finalUrl');
        baseUrl = finalUrl;
      }
    }
    // Use exactly the same canonical content/image identity as loadChapter and
    // markOfflineImageChapterComplete, including redirect base URL and geometry.
    const document = await materializeReadingDocument(result.data, session.identity.sourceId,
      baseUrl, this.runtime, current);
    this.assertCurrent(current);
    return { sourceId: session.identity.sourceId, bookId: session.identity.bookId,
      chapterIndex: chapter.index, contentVersion: document.contentVersion };
  }

  private contentGuard(session: RemoteReadingSession, isCurrent?: OfflineRequestGuard): OfflineRequestGuard {
    const contentCurrent = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    return (): boolean => isCurrent?.() !== false && contentCurrent?.() !== false;
  }

  private proofKey(session: RemoteReadingSession, chapterIndex: number): string {
    return JSON.stringify([session.identity.sourceId, session.identity.bookId, chapterIndex]);
  }

  private failureReason(error: string | undefined): string {
    if (error === 'storage_full') return '存储空间不足';
    const status = /\bHTTP(?:\s+status)?\s+([1-5][0-9]{2})\b/i.exec(error ?? '');
    if (status !== null) return `书源返回 HTTP ${status[1]}`;
    switch (diagnosticCodeOf(error ?? '')) {
      case 'CANCELLED': return '下载已取消';
      case 'TIMEOUT': return '请求超时';
      case 'NO_SPACE': return '存储空间不足';
      case 'NETWORK': return '网络请求失败';
      case 'INVALID_DATA': return '正文或图片解析失败';
      default: return '正文或图片处理失败';
    }
  }

  async prefetchChapter(
    session: RemoteReadingSession,
    chapterIndex: number,
    isCurrent?: OfflineRequestGuard,
    evidence?: ReaderWriteEvidence,
  ): Promise<LocalReadingTocEntry[]> {
    return this.prefetchRange(session, chapterIndex, chapterIndex + 1, isCurrent, evidence);
  }

  /** Explicit replacement only; the old selected download remains owned until
   * all new files are verified and Core completes the replacement transaction. */
  async updateMangaChapter(session: RemoteReadingSession, chapterIndex: number,
    isCurrent?: OfflineRequestGuard, evidence?: ReaderWriteEvidence): Promise<LocalReadingTocEntry[]> {
    if (session.contentKind !== 'manga') throw new Error('MANGA_UPDATE_REQUIRES_MANGA');
    const readable = session.entries.find(entry => entry.index === chapterIndex &&
      entry.navigable !== false && entry.url.trim().length > 0);
    if (readable === undefined) throw new Error('MANGA_UPDATE_REQUIRES_READABLE_CHAPTER');
    const valid = this.runtime.captureReadingContentValidity?.(session.identity.sourceId, session.identity.bookId);
    const current = (): boolean => isCurrent?.() !== false && valid?.() !== false;
    this.assertCurrent(current);
    const statuses = await this.loadCoreStatuses(session, current);
    if (statuses.some(status => status.chapterIndex === chapterIndex && status.state === 'paused'))
      throw new Error('MANGA_DOWNLOAD_PAUSED_RESUME_REQUIRED');
    evidence?.dispatched();
    const refreshed = await new MangaSessionGateway(this.runtime).chapter(session.identity.sourceId,
      session.identity.bookId, chapterIndex, 'refresh', current);
    this.assertCurrent(current);
    if (refreshed.manifest.chapter.chapterId !== readable.url) throw new Error('MANGA_DOWNLOAD_CATALOG_CHANGED_REOPEN_REQUIRED');
    evidence?.confirmed();
    return this.prefetchChapter(session, chapterIndex, current, evidence);
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
    evidenceOrChapterCurrent?: ReaderWriteEvidence | OfflineChapterGuard,
    requestedChapterCurrent?: OfflineChapterGuard,
  ): Promise<LocalReadingTocEntry[]> {
    const evidence = typeof evidenceOrChapterCurrent === 'function' ? undefined : evidenceOrChapterCurrent;
    const chapterCurrent = typeof evidenceOrChapterCurrent === 'function' ? evidenceOrChapterCurrent : requestedChapterCurrent;
    const totalChapters = session.entries.filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length;
    if (totalChapters === 0) {
      return this.loadProjection(session, isCurrent);
    }
    let projection: LocalReadingTocEntry[] = [];
    let processedChapters = 0;
    // Without a content lifetime fence, exact identities are never reused
    // across asynchronous batches. Production ReaderRuntimeOwner provides it.
    const proofs = this.runtime.captureReadingContentValidity === undefined ? undefined : new Map<string, OfflineChapterProof>();
    for (let startInclusive = 0; startInclusive < session.entries.length;
      startInclusive += READER_OFFLINE_BOOK_CHUNK_SIZE) {
      const endExclusive = Math.min(session.entries.length, startInclusive + READER_OFFLINE_BOOK_CHUNK_SIZE);
      const result = await this.prefetchRangeResult(session, startInclusive, endExclusive, isCurrent, proofs, false, evidence, chapterCurrent);
      projection = result.entries;
      this.assertCurrent(isCurrent);
      processedChapters += session.entries.slice(startInclusive, endExclusive).filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length;
      onProgress?.({
        ...result,
        processedChapters,
        totalChapters,
      });
    }
    return projection;
  }

  async prefetchRange(
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
    isCurrent?: OfflineRequestGuard,
    evidenceOrChapterCurrent?: ReaderWriteEvidence | OfflineChapterGuard,
    requestedChapterCurrent?: OfflineChapterGuard,
  ): Promise<LocalReadingTocEntry[]> {
    const evidence = typeof evidenceOrChapterCurrent === 'function' ? undefined : evidenceOrChapterCurrent;
    const chapterCurrent = typeof evidenceOrChapterCurrent === 'function' ? evidenceOrChapterCurrent : requestedChapterCurrent;
    const proofs = this.runtime.captureReadingContentValidity === undefined ? undefined : new Map<string, OfflineChapterProof>();
    return (await this.prefetchRangeResult(session, startInclusive, endExclusive, isCurrent, proofs, false, evidence, chapterCurrent)).entries;
  }

  /** Rolling reader work verifies only its requested window. A full directory
   * or explicit download still uses the complete projection above. */
  async prefetchWindow(
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
    isCurrent?: OfflineRequestGuard,
  ): Promise<ReadingOfflineBookProgress> {
    const runtime = this.runtime;
    const coordinator = runtime.bookAcquisitions?.();
    // Rolling work must not enter the manual-download foreground fence or
    // occupy the foreground's reserved request lane. Keep terminal lease
    // reports unguarded, exactly as in the explicit download path.
    const background: ReadingGatewayRuntime = coordinator === undefined ? runtime : {
      bookAcquisitions: (): BookAcquisitionCoordinator => coordinator,
      captureReadingContentValidity: runtime.captureReadingContentValidity === undefined ? undefined :
        (sourceId: string, bookId: string): (() => boolean) => runtime.captureReadingContentValidity!(sourceId, bookId),
      supportsCoreCapability: (capability: string): boolean => runtime.supportsCoreCapability?.(capability) === true,
      request: (method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> =>
        coordinator.request(method, params, options, 'background'),
      prefetchReadingImage: runtime.prefetchReadingImage === undefined ? undefined :
        (identity: ReadingGatewayImageCacheIdentity, current?: OfflineRequestGuard, sourceVersion?: string, allowNetwork?: boolean): Promise<void> => runtime.prefetchReadingImage!(identity, current, sourceVersion, allowNetwork),
      markOfflineImageChapterComplete: runtime.markOfflineImageChapterComplete === undefined ? undefined :
        (identity: ReadingGatewayImageChapterIdentity, resources: ReadingGatewayImageCacheIdentity[], current?: OfflineRequestGuard): Promise<void> =>
          runtime.markOfflineImageChapterComplete!(identity, resources, current),
      isOfflineImageChapterComplete: runtime.isOfflineImageChapterComplete === undefined ? undefined :
        (identity: ReadingGatewayImageChapterIdentity, manga?: boolean, current?: OfflineRequestGuard): Promise<boolean> => runtime.isOfflineImageChapterComplete!(identity, manga, current),
    };
    const proofs = runtime.captureReadingContentValidity === undefined ? undefined : new Map<string, OfflineChapterProof>();
    return new ReadingOfflineGateway(background)
      .prefetchRangeResult(session, startInclusive, endExclusive, isCurrent, proofs, true);
  }

  private async prefetchRangeResult(
    session: RemoteReadingSession,
    startInclusive: number,
    endExclusive: number,
    isCurrent?: OfflineRequestGuard,
    proofs?: Map<string, OfflineChapterProof>,
    projectWindowOnly: boolean = false,
    evidence?: ReaderWriteEvidence,
    chapterCurrent?: OfflineChapterGuard,
  ): Promise<ReadingOfflineBookProgress> {
    const current = this.contentGuard(session, isCurrent);
    this.assertCurrent(current);
    if (session.contentKind === 'manga') {
      const requestedSession = session;
      const coordinator = this.runtime.bookAcquisitions?.();
      if (coordinator !== undefined) {
        const version = await coordinator.currentSourceVersion(session.identity.sourceId);
        this.assertCurrent(current);
        const prior = this.refreshedMangaSession;
        if (prior !== undefined && prior.identity.sourceId === session.identity.sourceId &&
          prior.identity.bookId === session.identity.bookId && prior.sourceVersion === version) session = prior;
        if (version !== undefined && session.sourceVersion !== version) {
          const fresh = await this.remote.openSession({ ...session.book, ...session.identity,
            detailUrl: session.detailUrl, sourceVersion: version, contentKind: 'manga', searchVariables: [] },
            { forceRefresh: true, isCurrent: current });
          this.assertCurrent(current);
          if (fresh.contentKind !== 'manga') throw new Error('MANGA_DOWNLOAD_KIND_CHANGED_REOPEN_REQUIRED');
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
    const projectionSession: RemoteReadingSession = projectWindowOnly ? {
      ...session, entries: session.entries.slice(startInclusive, endExclusive), preparedChapter: undefined,
    } : session;
    if (session.contentKind === 'manga' && this.runtime.supportsCoreCapability?.('manga.offline.v1') !== true) throw new Error('MANGA_OFFLINE_CORE_REQUIRED');
    if (session.contentKind === 'manga' && chapterCurrent !== undefined &&
      session.entries.some(entry => entry.index >= startInclusive && entry.index < endExclusive && !chapterCurrent(entry.index))) {
      // Keep Core's contiguous lease transaction; excluded paused/cancelled
      // chapters cannot be reclaimed by a later whole-book slice.
      for (let start = startInclusive; start < endExclusive;) {
        if (!chapterCurrent(start)) { start += 1; continue; }
        let end = start + 1;
        while (end < endExclusive && chapterCurrent(end)) end += 1;
        await this.prefetchRangeResult(session, start, end, current, proofs, false, evidence, chapterCurrent);
        start = end;
      }
      return this.loadProjectionResult(projectionSession, current, proofs);
    }
    if (!session.entries.some(entry => entry.index >= startInclusive && entry.index < endExclusive && entry.navigable !== false && entry.url.trim().length > 0)) {
      return this.loadProjectionResult(projectionSession, isCurrent, proofs);
    }
    evidence?.dispatched();
    const params: JsonObject = {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      chapterRange: [startInclusive, endExclusive],
      priority: 0,
      requestedAt: Date.now(),
    };
    if (session.contentKind === 'manga') params['contentKind'] = 'manga';
    let finishClaim = (): void => {};
    const pending: MangaPendingClaim | undefined = session.contentKind === 'manga' ? {
      startInclusive, endExclusive, settled: new Promise<void>(resolve => { finishClaim = resolve; }),
    } : undefined;
    // Register before the native await: a pause can arrive before Core's
    // newly claimed lease is visible to the Host.
    if (pending !== undefined) this.pendingMangaClaims.add(pending);
    let materializations: CacheChapterMaterializationLease[];
    const mangaWorks: MangaMaterializationWork[] = [];
    try {
      const result = await this.runtime.request('cache.book.prefetch', params, evidence === undefined ? this.requestOptions(current, 300000) : { timeoutMs: 300000 });
      materializations = this.assertPrefetchResult(result, session, startInclusive, endExclusive);
      evidence?.confirmed();
      if (session.contentKind === 'manga') {
        for (const lease of materializations) {
          const chapterValid = (): boolean => current() && chapterCurrent?.(lease.chapterIndex) !== false;
          mangaWorks.push(this.registerMangaMaterialization(session, lease, chapterValid));
        }
      }
    } finally {
      if (pending !== undefined) this.pendingMangaClaims.delete(pending);
      // All chapter drains are registered before closing the claim gap.
      finishClaim();
    }
    if (session.contentKind === 'manga') {
      // Every claimed lease must settle, including work not started after a
      // cancellation or failure. Otherwise Core retains an InProgress row.
      let firstFailure: Error | undefined;
      for (let index = 0; index < materializations.length; index += 1) {
        const lease = materializations[index], work = mangaWorks[index];
        if (work.started) { await work.settled; continue; }
        work.started = true;
        try {
          if (firstFailure !== undefined || chapterCurrent?.(lease.chapterIndex) === false) {
            try { await this.reportMaterialization(session, lease, 'failed', 'cancelled'); }
            catch (error) { console.warn(`Manga lease settlement failed: ${diagnosticCodeOf((error as Error).message)}`); }
            continue;
          }
          try {
            await this.materializeManga(session, lease, (): boolean => current() && chapterCurrent?.(lease.chapterIndex) !== false);
          } catch (error) {
            // A Core-fenced chapter is isolated from the still-valid book.
            // Genuine content/book cancellation retains the old batch rules.
            if (!current() || chapterCurrent?.(lease.chapterIndex) !== false) firstFailure = error as Error;
          }
        } finally {
          work.finish();
        }
      }
      if (firstFailure !== undefined) throw firstFailure;
      return this.loadProjectionResult(projectionSession, current, proofs);
    }
    let materializationError: Error | undefined;
    await this.forEachConcurrent(materializations, READER_OFFLINE_CHAPTER_CONCURRENCY,
      async (materialization: CacheChapterMaterializationLease): Promise<void> => {
        // Core already granted these leases. Even if the caller leaves, every
        // lease must reach its guarded materialization or cancellation report;
        // one rejected worker must not strand the unclaimed remainder.
        try { await this.materializeChapter(session, materialization, isCurrent, proofs); }
        catch (error) { if (materializationError === undefined) materializationError = error as Error; }
      });
    if (materializationError !== undefined) throw materializationError;
    this.assertCurrent(isCurrent);
    return this.loadProjectionResult(projectionSession, isCurrent, proofs);
  }

  /** Wait only the target consumer, including a native claim not yet returned.
   * Unstarted excluded leases can settle while another chapter is still loading. */
  async waitForMangaChapter(chapterIndex: number): Promise<void> {
    for (;;) {
      const pending = Array.from(this.pendingMangaClaims).filter(claim =>
        chapterIndex >= claim.startInclusive && chapterIndex < claim.endExclusive);
      if (pending.length > 0) await Promise.all(pending.map(claim => claim.settled));
      const works = Array.from(this.mangaMaterializations).filter(work => work.chapterIndex === chapterIndex);
      await Promise.all(works.map(async (work): Promise<void> => {
        await work.cancelIfExcluded();
        await work.settled;
      }));
      if (!Array.from(this.pendingMangaClaims).some(claim => chapterIndex >= claim.startInclusive && chapterIndex < claim.endExclusive) &&
        !Array.from(this.mangaMaterializations).some(work => work.chapterIndex === chapterIndex)) return;
    }
  }

  private registerMangaMaterialization(session: RemoteReadingSession, lease: CacheChapterMaterializationLease,
    current: OfflineRequestGuard): MangaMaterializationWork {
    let resolveWork = (): void => {};
    const work: MangaMaterializationWork = {
      chapterIndex: lease.chapterIndex, started: false,
      settled: new Promise<void>(resolve => { resolveWork = resolve; }),
      finish: (): void => { this.mangaMaterializations.delete(work); resolveWork(); },
      cancelIfExcluded: async (): Promise<void> => {
        if (work.started || current()) return;
        work.started = true;
        try { await this.reportMaterialization(session, lease, 'failed', 'cancelled'); }
        catch (error) { console.warn(`Manga lease settlement failed: ${diagnosticCodeOf((error as Error).message)}`); }
        finally { work.finish(); }
      },
    };
    this.mangaMaterializations.add(work);
    return work;
  }

  private async materializeManga(session: RemoteReadingSession, lease: CacheChapterMaterializationLease,
    isCurrent: OfflineRequestGuard): Promise<void> {
    try {
      this.assertCurrent(isCurrent);
      if (this.runtime.prefetchReadingImage === undefined || this.runtime.markOfflineImageChapterComplete === undefined ||
        this.runtime.isOfflineImageChapterComplete === undefined || lease.manga === undefined) throw new Error('MANGA_OFFLINE_HOST_REQUIRED');
      const data = lease.manga;
      await MangaChapterPreparationCoordinator.forRuntime(this.runtime).prepareDownload(data, data.manifest.pages.length,
        (): boolean => isCurrent?.() !== false);
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
    proofs?: Map<string, OfflineChapterProof>,
  ): Promise<void> {
    const current = this.contentGuard(session, isCurrent);
    let identity: ReadingGatewayImageChapterIdentity | undefined = undefined;
    try {
      this.assertCurrent(current);
      const chapter = await this.remote.loadChapter(session, materialization.chapterIndex, current);
      this.assertCurrent(current);
      identity = this.chapterIdentity(chapter);
      const resources = this.imageResources(chapter);
      if (resources.length > 0) {
        this.requireImagePersistenceCapabilities();
      }
      await this.forEachConcurrent(resources, READER_OFFLINE_IMAGE_CONCURRENCY,
        async (resource: ReadingGatewayImageCacheIdentity): Promise<void> => {
          await this.runtime.prefetchReadingImage!(resource, current);
          this.assertCurrent(current);
        });
      if (this.runtime.markOfflineImageChapterComplete !== undefined) {
        await this.runtime.markOfflineImageChapterComplete(identity, resources);
        this.assertCurrent(current);
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
    this.assertCurrent(current);
    if (identity !== undefined) proofs?.set(this.proofKey(session, materialization.chapterIndex), { identity, isCurrent: current });
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

  async clearBook(session: RemoteReadingSession, isCurrent?: OfflineRequestGuard, evidence?: ReaderWriteEvidence): Promise<void> {
    return this.clearBookIdentity(
      session.identity.sourceId,
      session.identity.bookId,
      isCurrent,
      evidence,
      session.contentKind === 'manga',
    );
  }

  async clearBookIdentity(
    sourceId: string,
    bookId: string,
    isCurrent?: OfflineRequestGuard,
    evidence?: ReaderWriteEvidence,
    manga: boolean = false,
  ): Promise<void> {
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) {
      throw new Error('offline book identity must be non-blank');
    }
    if (this.runtime.clearOfflineBookImages === undefined) {
      throw new Error('offline reading image clear capability is unavailable');
    }
    this.assertCurrent(isCurrent);
    const params: JsonObject = { scope: 'book', sourceId, bookId };
    const qualify = (data: JsonObject): JsonObject => {
      if (data['scope'] !== 'book') throw new Error('cache.clear did not confirm the exact book scope');
      for (const key of ['cacheEntriesRemoved', 'chapterEntriesRemoved', 'queueEntriesRemoved', 'removedContentBytes']) this.requireNonNegativeInteger(data[key], key);
      return data;
    };
    if (this.clearIntents !== undefined) {
      await this.clearIntents.execute('cache.clear', params, { sourceId, bookId }, qualify, evidence, isCurrent ?? ((): boolean => true));
    } else {
      // Legacy API compatibility; current production owner supplies the
      // shared Reading/Settings finite cache-clear authority.
      evidence?.dispatched(); const result = await this.runtime.request('cache.clear', params, evidence === undefined ? this.requestOptions(isCurrent) : {});
      if (result.data['scope'] !== 'book') throw new Error('cache.clear did not confirm the exact book scope'); evidence?.confirmed();
    }
    this.assertCurrent(isCurrent);
    // Core confirmation and platform image cleanup are independent. Recovery
    // never silently repeats either destructive step.
    await this.runtime.clearOfflineBookImages(sourceId, bookId, manga);
    this.assertCurrent(isCurrent);
  }

  async pendingClearOperation(): Promise<ReadingOperationIntent | undefined> { return this.clearIntents?.pending(); }
  async reconcileClearOperation(context: ReadingOperationContext, current: () => boolean,
    evidence?: ReaderWriteEvidence, continueOriginal: boolean = false): Promise<ReadingRecoveredOperation | undefined> {
    const qualify = (data: JsonObject, intent: ReadingOperationIntent): JsonObject => {
      if (data['scope'] !== intent.params['scope']) throw new Error('cache.clear recovery scope mismatch');
      for (const key of ['cacheEntriesRemoved', 'chapterEntriesRemoved', 'queueEntriesRemoved', 'removedContentBytes']) this.requireNonNegativeInteger(data[key], key);
      return data;
    };
    return continueOriginal ? this.clearIntents?.continueOriginal(context, qualify, evidence, current) : this.clearIntents?.reconcile(context, qualify, current);
  }
  /** The platform step is separate from Core receipt recovery. It is never
   * silently launched by a pure query/status refresh. */
  async cleanupConfirmedImages(sourceId: string, bookId: string, current: () => boolean): Promise<void> {
    this.assertCurrent(current); if (this.runtime.clearOfflineBookImages === undefined) throw new Error('offline reading image clear capability is unavailable');
    await this.runtime.clearOfflineBookImages(sourceId, bookId); this.assertCurrent(current);
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
        lastError: typeof raw['lastError'] === 'string' ? raw['lastError'] : undefined,
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
      this.runtime.isOfflineImageChapterComplete === undefined) {
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
    if (value === 'missing' || value === 'queued' || value === 'paused' || value === 'inProgress' || value === 'cached' ||
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
