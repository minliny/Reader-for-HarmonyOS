import { ReaderCoreRequestError, isReaderCoreTransactionPendingError, type JsonObject } from '@reader/core-harmony';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { DownloadStorageSummary } from './SharedDownloadProjection';
import type { ReadingImageDiskCache, ReadingImageStorageSnapshot, ReadingTextStorageChapter,
  SharedDownloadStoragePolicy } from '../../app/ReadingImageDiskCache';
import { SharedDownloadIntentPreferences } from './SharedDownloadIntentPreferences';

export interface SharedDownloadStorageBindings {
  retainedChapters: ReadingTextStorageChapter[];
  protectedChapters: ReadingTextStorageChapter[];
}
export interface SharedDownloadStorageRuntime extends ReadingGatewayRuntime {
  readDownloadStorageBindings(): Promise<SharedDownloadStorageBindings>;
  captureDownloadStorageValidity?(): () => boolean;
}
export interface SharedDownloadLegacyProtectionPersistence {
  loadLegacyProtection(): Promise<ReadingTextStorageChapter[] | undefined>;
  saveLegacyProtection(chapters: ReadingTextStorageChapter[]): Promise<void>;
  loadSettingsTextCleanup?(): Promise<SettingsTextCleanupJournal | undefined>;
  saveSettingsTextCleanup?(journal: SettingsTextCleanupJournal | undefined): Promise<void>;
}
export interface SharedDownloadCleanupResult extends DownloadStorageSummary {
  /** Core canonical UTF-8 body bytes; SQLite file shrink is not promised. */
  removedContentBytes: number;
  /** Host inodes actually released after the exact claim/unlink handoff. */
  deletedBytes: number;
  deletedFiles: number;
  cleanupError?: string;
}
export interface SettingsTextCleanupJournal {
  version: 2; scope: 'text'; phase: 'pending' | 'confirmed'; result?: SharedDownloadCleanupResult;
}
interface StorageCleanupOptions { textOnly?: boolean; evidence?: ReaderWriteEvidence; current?: () => boolean; }
export interface SharedDownloadStoragePolicyResult extends SharedDownloadStoragePolicy { maintenanceMessage?: string; }

/** Reader ownership adapter joining existing Core transactions with existing
 * Host image grants. No second cache, LRU, queue, or guessed physical receipt. */
export class SharedDownloadStorageGateway {
  private readonly runtime: SharedDownloadStorageRuntime;
  private readonly disk: ReadingImageDiskCache;
  private readonly persistence: SharedDownloadLegacyProtectionPersistence;
  private legacyProtection: ReadingTextStorageChapter[] | undefined;
  private legacyWork: Promise<void> | undefined;
  private mutationTail: Promise<void> = Promise.resolve();
  private activeMutations: number = 0;
  private summaryRevision: number = 0;
  private summaryRead?: { revision: number; current: () => boolean; work: Promise<DownloadStorageSummary>; };
  private imageBookBytes: Map<string, number | undefined> = new Map();
  private indexedInventory: ReadingImageStorageSnapshot | undefined;

  constructor(runtime: SharedDownloadStorageRuntime, disk: ReadingImageDiskCache,
    persistence?: SharedDownloadLegacyProtectionPersistence) {
    this.runtime = runtime; this.disk = disk;
    if (persistence !== undefined) this.persistence = persistence;
    else {
      const context = runtime.getUIAbilityContext?.();
      if (context === undefined) throw new Error('DOWNLOAD_STORAGE_PERSISTENCE_REQUIRED');
      this.persistence = new SharedDownloadIntentPreferences(context);
    }
  }

  readPolicy(): Promise<SharedDownloadStoragePolicy> { return this.disk.readPolicy(); }
  hasActiveMutation(): boolean { return this.activeMutations > 0; }
  waitForActiveMutation(): Promise<void> { return this.mutationTail; }
  bookImageBytes(sourceId: string, bookId: string): number | undefined {
    if (this.indexedInventory === undefined || !this.disk.isReadingStorageInventoryCurrent(this.indexedInventory)) return undefined;
    return this.imageBookBytes.get(JSON.stringify([sourceId, bookId]));
  }

  async confirmExplicitDeletion(sourceId: string, bookId: string, chapterIndexes?: number[]): Promise<void> {
    await this.restoreLegacyProtection();
    const selected = chapterIndexes === undefined ? undefined : new Set(chapterIndexes);
    const next = (this.legacyProtection ?? []).filter(chapter => chapter.sourceId !== sourceId || chapter.bookId !== bookId ||
      (selected !== undefined && !selected.has(chapter.chapterIndex)));
    await this.persistence.saveLegacyProtection(next);
    this.legacyProtection = next; this.summaryRevision += 1;
  }

  /** Complete every migration page before any cleanup is admitted. Unknown
   * old download intent is protected, never relabelled as permanent download. */
  restoreLegacyProtection(): Promise<void> {
    if (this.legacyWork !== undefined) return this.legacyWork;
    const work = (async (): Promise<void> => {
      const stored = await this.persistence.loadLegacyProtection();
      if (stored !== undefined) { this.legacyProtection = this.chapters(stored); return; }
      const accumulated = new Map<string, ReadingTextStorageChapter>();
      let after: ReadingTextStorageChapter | undefined;
      for (;;) {
        const data = (await this.runtime.request('cache.storage.summary', after === undefined ? {} :
          { completedQueueAfter: after }, { timeoutMs: 30000 })).data;
        const page = this.chapters(data['completedQueueChapters']);
        if (page.length > 128 || typeof data['completedQueueHasMore'] !== 'boolean')
          throw new Error('DOWNLOAD_LEGACY_PROTECTION_INVALID');
        for (const chapter of page) {
          const key = this.key(chapter);
          if (accumulated.has(key)) throw new Error('DOWNLOAD_LEGACY_PROTECTION_NO_PROGRESS');
          accumulated.set(key, chapter);
        }
        if (accumulated.size > 100000) throw new Error('DOWNLOAD_STORAGE_SCOPE_CAPACITY');
        if (data['completedQueueHasMore'] !== true) break;
        if (page.length === 0) throw new Error('DOWNLOAD_LEGACY_PROTECTION_NO_PROGRESS');
        after = page[page.length - 1];
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
      const chapters = Array.from(accumulated.values());
      await this.persistence.saveLegacyProtection(chapters);
      this.legacyProtection = chapters;
    })();
    this.legacyWork = work;
    void work.catch((): void => { if (this.legacyWork === work) this.legacyWork = undefined; });
    return work;
  }

  async summary(): Promise<DownloadStorageSummary> {
    const existing = this.summaryRead;
    if (existing !== undefined && existing.revision === this.summaryRevision && existing.current())
      return { ...await existing.work };
    const current = this.runtime.captureDownloadStorageValidity?.() ?? ((): boolean => true);
    const work = this.measureSummary();
    const read = { revision: this.summaryRevision, current, work };
    this.summaryRead = read;
    const finish = (): void => { if (this.summaryRead === read) this.summaryRead = undefined; };
    void work.then(finish, finish);
    return { ...await work };
  }

  private async bindings(snapshot: ReadingImageStorageSnapshot): Promise<SharedDownloadStorageBindings> {
    await this.restoreLegacyProtection();
    const actual = await this.runtime.readDownloadStorageBindings();
    return { retainedChapters: this.unique(actual.retainedChapters),
      protectedChapters: this.unique([...actual.protectedChapters, ...this.legacyProtection ?? [], ...snapshot.protectedChapters]) };
  }

  private async measureSummary(): Promise<DownloadStorageSummary> {
    const snapshot = await this.disk.captureReadingStorageInventory();
    const bindings = await this.bindings(snapshot);
    const core = (await this.runtime.request('cache.storage.summary', this.params(bindings, snapshot), { timeoutMs: 30000 })).data;
    this.validateCore(core);
    const retained = new Set(bindings.retainedChapters.map(chapter => this.key(chapter)));
    const protectedKeys = new Set([...bindings.protectedChapters, ...this.chapters(core['protectedChapters'])].map(chapter => this.key(chapter)));
    const images = await this.disk.readingStorageSummary(snapshot, chapter => ({
      retained: chapter.sourceId === 'local' || retained.has(this.key(chapter)), inUse: protectedKeys.has(this.key(chapter)) }));
    this.imageBookBytes = await this.disk.readingStorageBookIndex(snapshot);
    this.indexedInventory = snapshot;
    return { totalBytes: this.sum(core['totalBytes'], images.totalBytes),
      retainedBytes: this.sum(core['retainedBytes'], images.retainedBytes),
      automaticBytes: this.sum(core['automaticBytes'], images.automaticBytes),
      cleanableBytes: images.cleanableBytes === undefined ? undefined : this.sum(core['cleanableBytes'], images.cleanableBytes),
      availableBytes: images.availableBytes };
  }

  configurePolicy(policy: SharedDownloadStoragePolicy): Promise<SharedDownloadStoragePolicyResult> {
    return this.serialized(async () => {
      const saved = await this.disk.configurePolicy(policy);
      try { await this.maintain('expiry'); await this.maintain('capacity'); }
      catch (_) { return { ...saved, maintenanceMessage: '设置已保存，自动清理暂未完成' }; }
      return saved;
    });
  }
  cleanup(options: StorageCleanupOptions = {}): Promise<SharedDownloadCleanupResult> {
    return this.serialized(() => this.maintain('clear', options));
  }
  readSettingsTextCleanup(): Promise<SettingsTextCleanupJournal | undefined> {
    if (this.persistence.loadSettingsTextCleanup === undefined) throw new Error('TEXT_CACHE_CLEANUP_PERSISTENCE_UNAVAILABLE');
    return this.persistence.loadSettingsTextCleanup();
  }
  cleanupSettingsText(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SharedDownloadCleanupResult> {
    return this.serialized(async () => {
      if (!current()) throw new Error('TEXT_CACHE_CLEANUP_RETIRED');
      const previous = await this.readSettingsTextCleanup();
      if (previous?.phase === 'pending') throw new Error('TEXT_CACHE_CLEANUP_UNCONFIRMED');
      if (this.persistence.saveSettingsTextCleanup === undefined) throw new Error('TEXT_CACHE_CLEANUP_PERSISTENCE_UNAVAILABLE');
      let result: SharedDownloadCleanupResult;
      try {
        await this.persistence.saveSettingsTextCleanup({ version: 2, scope: 'text', phase: 'pending' });
        result = await this.maintain('clear', { textOnly: true, evidence, current });
      }
      catch (error) {
        if (evidence.confirmation() === 'undispatched') {
          try { await this.persistence.saveSettingsTextCleanup(undefined); } catch (_) { /* The warm evidence still proves no Core dispatch. */ }
        }
        throw error;
      }
      if (evidence.confirmation() === 'unknown') {
        await this.persistence.saveSettingsTextCleanup({ version: 2, scope: 'text', phase: 'pending', result });
        throw new Error('TEXT_CACHE_CLEANUP_UNCONFIRMED');
      }
      if (evidence.confirmation() === 'undispatched') {
        await this.persistence.saveSettingsTextCleanup(undefined);
        throw new Error('TEXT_CACHE_CLEANUP_NOT_DISPATCHED');
      }
      // The local journal is the actual aggregate ACK, never an inferred Core
      // receipt. Unknown batches remain pending across restart without replay.
      await this.persistence.saveSettingsTextCleanup({ version: 2, scope: 'text', phase: 'confirmed', result });
      return result;
    });
  }
  maintainAutomaticStorage(): Promise<void> {
    return this.serialized(async (): Promise<void> => { await this.maintain('expiry'); await this.maintain('capacity'); });
  }

  private async maintain(reason: 'clear' | 'expiry' | 'capacity', options: StorageCleanupOptions = {}): Promise<SharedDownloadCleanupResult> {
    await this.restoreLegacyProtection();
    const before = await this.disk.captureReadingStorageInventory();
    let removedContentBytes = 0, cleanupError: string | undefined;
    try {
      if (!options.textOnly) {
        if (reason === 'clear') await this.disk.clearMangaRebuildableCache();
        else await this.disk.maintainMangaStorage(reason);
      }
      const policy = await this.readPolicy();
      for (;;) {
        const owned = this.runtime.captureDownloadStorageValidity?.() ?? ((): boolean => true);
        const current = (): boolean => owned() && options.current?.() !== false;
        const snapshot = await this.disk.captureReadingStorageInventory();
        const bindings = await this.bindings(snapshot);
        const retained = new Set(bindings.retainedChapters.map(chapter => this.key(chapter)));
        let capacityBytes = policy.capacityBytes;
        if (reason === 'capacity') {
          const summary = (await this.runtime.request('cache.storage.summary', this.params(bindings, snapshot), { timeoutMs: 30000 })).data;
          this.validateCore(summary);
          const protectedKeys = new Set([...bindings.protectedChapters, ...this.chapters(summary['protectedChapters'])].map(chapter => this.key(chapter)));
          const images = await this.disk.readingStorageSummary(snapshot, chapter => ({
            retained: chapter.sourceId === 'local' || retained.has(this.key(chapter)), inUse: protectedKeys.has(this.key(chapter)) }));
          if (!images.classificationKnown || images.cleanableBytes === undefined)
            throw new Error('DOWNLOAD_STORAGE_OWNERSHIP_UNAVAILABLE');
          const textImages = snapshot.hostImageChapters.filter(chapter => chapter.sourceId !== 'local' && !retained.has(this.key(chapter)))
            .reduce((sum, chapter) => sum + chapter.contentBytes, 0);
          capacityBytes = Math.max(0, policy.capacityBytes - Math.max(0, images.automaticBytes - textImages));
        }
        if (!current()) break;
        // No shouldCancel after dispatch: a committed body deletion still owns
        // its exact Host-file handoff even when page protection changes.
        let data: JsonObject;
        try {
          data = (await this.runtime.request('cache.storage.cleanup', {
            ...this.params(bindings, snapshot), reason, nowSeconds: Math.floor(Date.now() / 1000),
            ttlSeconds: policy.expiryDays * 86400, capacityBytes,
            ...(options.textOnly ? { contentScope: 'text' } : {}),
          }, { timeoutMs: 30000, canDispatch: current, canContinue: current,
            onDispatch: (): void => { options.evidence?.dispatched(); },
          })).data;
        } catch (error) {
          if (isReaderCoreTransactionPendingError(error) || (error instanceof ReaderCoreRequestError &&
            error.event.error.details?.['nonExecution'] === true)) options.evidence?.rejectedBeforeExecution();
          throw error;
        }
        this.validateCore(data);
        const actualContentBytes = this.number(data['removedContentBytes']);
        options.evidence?.confirmed();
        removedContentBytes = this.sum(removedContentBytes, actualContentBytes);
        const removed = this.chapters(data['removedChapters']);
        for (const chapter of removed) await this.disk.clearChapter(chapter.sourceId, chapter.bookId, chapter.chapterIndex);
        if (typeof data['cleanupError'] === 'string') throw new Error(data['cleanupError'] as string);
        if (!current() || data['hasMore'] !== true) break;
        if (removed.length === 0) throw new Error('DOWNLOAD_STORAGE_CLEANUP_NO_PROGRESS');
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
    } catch (error) { cleanupError = (error as Error).message || 'DOWNLOAD_STORAGE_CLEANUP_FAILED'; }
    const actual = await this.disk.readingStorageCleanupReceipt(options.textOnly ?
      { ...before, files: before.files.filter(file => file.textOwner !== undefined) } : before);
    let summary: DownloadStorageSummary = {};
    try { summary = await this.summary(); } catch (_) { /* The actual removal receipt remains valid when a later read fails. */ }
    if (reason !== 'clear' && cleanupError !== undefined) throw new Error(cleanupError);
    return { ...summary, removedContentBytes, ...actual, cleanupError };
  }

  private params(bindings: SharedDownloadStorageBindings, snapshot: ReadingImageStorageSnapshot): JsonObject {
    if (bindings.retainedChapters.length > 100000 || bindings.protectedChapters.length > 100000 || snapshot.hostImageChapters.length > 100000)
      throw new Error('DOWNLOAD_STORAGE_SCOPE_CAPACITY');
    return { retainedChapters: bindings.retainedChapters, protectedChapters: bindings.protectedChapters,
      hostImageChapters: snapshot.hostImageChapters };
  }
  private validateCore(data: JsonObject): void {
    for (const field of ['totalBytes', 'retainedBytes', 'automaticBytes', 'cleanableBytes']) this.number(data[field]);
    if ((data['retainedBytes'] as number) + (data['automaticBytes'] as number) !== data['totalBytes'] ||
      (data['cleanableBytes'] as number) > (data['automaticBytes'] as number) || typeof data['hasMore'] !== 'boolean')
      throw new Error('DOWNLOAD_STORAGE_MEASUREMENT_INVALID');
    this.chapters(data['protectedChapters']); this.chapters(data['removedChapters']);
  }
  private chapters(value: unknown): ReadingTextStorageChapter[] {
    if (!Array.isArray(value)) throw new Error('DOWNLOAD_STORAGE_SCOPE_UNAVAILABLE');
    return value.map(raw => {
      const chapter = raw as ReadingTextStorageChapter;
      if (chapter === null || typeof chapter !== 'object' || typeof chapter.sourceId !== 'string' || !chapter.sourceId.trim() ||
        typeof chapter.bookId !== 'string' || !chapter.bookId.trim()) throw new Error('DOWNLOAD_STORAGE_SCOPE_INVALID');
      return { sourceId: chapter.sourceId, bookId: chapter.bookId, chapterIndex: this.number(chapter.chapterIndex) };
    });
  }
  private unique(chapters: ReadingTextStorageChapter[]): ReadingTextStorageChapter[] {
    return Array.from(new Map(chapters.map(chapter => [this.key(chapter), chapter])).values());
  }
  private key(chapter: ReadingTextStorageChapter): string { return JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex]); }
  private number(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('DOWNLOAD_STORAGE_MEASUREMENT_INVALID');
    return value;
  }
  private sum(a: unknown, b: unknown): number { return this.number(this.number(a) + this.number(b)); }
  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    this.activeMutations += 1; this.summaryRevision += 1;
    const work = this.mutationTail.then(operation);
    this.mutationTail = work.then((): void => { this.activeMutations -= 1; this.summaryRevision += 1; },
      (): void => { this.activeMutations -= 1; this.summaryRevision += 1; });
    return work;
  }
}
