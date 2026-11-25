import { ReaderCoreRequestError, isReaderCoreTransactionPendingError, type JsonObject } from '@reader/core-harmony';
import type { ReaderWriteEvidence } from '../../../app/ReaderWriteEvidence';
import type { ReadingGatewayRuntime } from '../../reading/application/ReadingGatewayRuntime';
import type { DownloadStorageSummary } from '../presentation/SharedDownloadProjection';
import type { ReadingImageDiskCache, ReadingImageStorageSnapshot, ReadingTextStorageChapter,
  ReadingImageCleanupFile, SharedDownloadStoragePolicy } from '../../../platform/reading-resources/ReadingImageDiskCache';
import { SharedDownloadIntentPreferences } from './SharedDownloadIntentPreferences';

export interface SharedDownloadStorageBindings {
  retainedChapters: ReadingTextStorageChapter[];
  protectedChapters: ReadingTextStorageChapter[];
}
export interface SharedDownloadStorageRuntime extends ReadingGatewayRuntime {
  readDownloadStorageBindings(): Promise<SharedDownloadStorageBindings>;
  captureDownloadStorageValidity?(): () => boolean;
  protectsDownloadStorageChapter?(chapter: ReadingTextStorageChapter): boolean;
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
  version: 2; scope: 'text'; phase: 'pending' | 'core_confirmed' | 'host_completed' | 'confirmed';
  result?: SharedDownloadCleanupResult;
  removedContentBytes?: number;
  beforeTextFiles?: ReadingImageCleanupFile[];
  pendingHostChapters?: ReadingTextStorageChapter[];
  cleanupError?: string;
}
interface StorageCleanupOptions { textOnly?: boolean; evidence?: ReaderWriteEvidence; current?: () => boolean; }
export interface SharedDownloadStoragePolicyResult extends SharedDownloadStoragePolicy { maintenanceMessage?: string; }

const TEXT_PREFETCH_HEADROOM_BYTES = 32 * 1024 * 1024;

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
  private settingsCoreAcknowledgement: SettingsTextCleanupJournal | undefined;

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

  /** Check shared automatic-cache use before a single optional chapter.
   * Keep room above the system reserve for SQLite writes and foreground work. */
  async canPrefetchTextChapter(current: () => boolean): Promise<boolean> {
    if (!current() || this.hasActiveMutation()) return false;
    const revision = this.summaryRevision;
    try {
      const owned = this.runtime.captureDownloadStorageValidity?.();
      const capacity = await this.disk.mangaStorageCapacity();
      const minimumFree = capacity.systemReserveBytes + TEXT_PREFETCH_HEADROOM_BYTES;
      if (!current() || revision !== this.summaryRevision || capacity.freeBytes < minimumFree ||
        capacity.cacheBudgetBytes < TEXT_PREFETCH_HEADROOM_BYTES) return false;

      const usage = await this.summary();
      return current() && revision === this.summaryRevision && owned?.() !== false &&
        this.indexedInventory !== undefined && this.disk.isReadingStorageInventoryCurrent(this.indexedInventory) &&
        this.number(usage.automaticBytes) <= capacity.cacheBudgetBytes - TEXT_PREFETCH_HEADROOM_BYTES &&
        this.number(usage.availableBytes) >= minimumFree;
    } catch (_) {
      return false;
    }
  }

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
    const activeImages = snapshot.hostImageChapters.filter(chapter => this.runtime.protectsDownloadStorageChapter?.(chapter) === true);
    return { retainedChapters: this.unique(actual.retainedChapters),
      protectedChapters: this.unique([...actual.protectedChapters, ...this.legacyProtection ?? [], ...snapshot.protectedChapters, ...activeImages]) };
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
    if (this.settingsCoreAcknowledgement !== undefined) return Promise.resolve(this.settingsCoreAcknowledgement);
    if (this.persistence.loadSettingsTextCleanup === undefined) throw new Error('TEXT_CACHE_CLEANUP_PERSISTENCE_UNAVAILABLE');
    return this.persistence.loadSettingsTextCleanup();
  }
  cleanupSettingsText(evidence: ReaderWriteEvidence, current: () => boolean): Promise<SharedDownloadCleanupResult> {
    return this.serialized(async () => {
      if (!current()) throw new Error('TEXT_CACHE_CLEANUP_RETIRED');
      const previous = await this.readSettingsTextCleanup();
      if (previous?.phase === 'pending') throw new Error('TEXT_CACHE_CLEANUP_UNCONFIRMED');
      if (previous !== undefined && previous.phase !== 'confirmed')
        throw new Error('TEXT_CACHE_CLEANUP_RECONCILIATION_REQUIRED');
      await this.restoreLegacyProtection();
      const policy = await this.readPolicy();
      let checkpoint: SettingsTextCleanupJournal | undefined;
      const acknowledgedChapters = new Set<string>();
      for (;;) {
        const owned = this.runtime.captureDownloadStorageValidity?.() ?? ((): boolean => true);
        const admitted = (): boolean => owned() && current();
        const snapshot = await this.disk.captureReadingStorageInventory();
        const bindings = await this.bindings(snapshot);
        if (!admitted()) {
          if (checkpoint === undefined) throw new Error('TEXT_CACHE_CLEANUP_NOT_DISPATCHED');
          break;
        }
        // An exact Host file can survive a confirmed batch. Keep its chapter
        // out of later Core selections while allowing the remaining batch.
        const acknowledgedImages = snapshot.hostImageChapters.filter(chapter => acknowledgedChapters.has(this.key(chapter)));
        if (acknowledgedImages.length > 0)
          bindings.protectedChapters = this.unique([...bindings.protectedChapters, ...acknowledgedImages]);
        let data: JsonObject;
        let removedContentBytes: number;
        try {
          // Arm every batch. A crash or lost Core response after this write
          // leaves an unknown batch, even when earlier batches were confirmed.
          await this.saveSettingsTextCleanup({ ...checkpoint, version: 2, scope: 'text', phase: 'pending' });
          const canDispatch = (): boolean => admitted() && this.disk.isReadingStorageInventoryCurrent(snapshot);
          data = await this.requestCleanup('clear', policy, policy.capacityBytes, snapshot, bindings, canDispatch, { textOnly: true, evidence });
          this.validateCore(data);
          removedContentBytes = this.sum(checkpoint?.removedContentBytes ?? 0, data['removedContentBytes']);
        } catch (error) {
          if (evidence.confirmation() === 'unknown') throw new Error('TEXT_CACHE_CLEANUP_UNCONFIRMED');
          await this.saveSettingsTextCleanup(checkpoint ?? previous);
          if (checkpoint !== undefined) break;
          if (evidence.hasDispatched()) throw new Error('TEXT_CACHE_CLEANUP_NOT_DISPATCHED');
          throw error as Error;
        }
        const returned = this.unique(this.chapters(data['removedChapters']));
        const chapters = returned.filter(chapter => !acknowledgedChapters.has(this.key(chapter)));
        const selected = new Set(chapters.map(chapter => this.key(chapter)));
        for (const key of selected) acknowledgedChapters.add(key);
        const files = snapshot.files.filter(file => file.textOwner !== undefined && selected.has(this.key(file.textOwner)));
        const beforeTextFiles = [...checkpoint?.beforeTextFiles ?? []];
        const existing = new Set(beforeTextFiles.map(file => JSON.stringify([file.path, file.physicalKey, file.mtime])));
        for (const file of files) {
          const key = JSON.stringify([file.path, file.physicalKey, file.mtime]);
          if (existing.has(key)) continue;
          existing.add(key);
          beforeTextFiles.push({ path: file.path, physicalKey: file.physicalKey, size: file.size, mtime: file.mtime,
            textOwner: file.textOwner });
        }
        const more = data['hasMore'] === true;
        const blocked = typeof data['cleanupError'] === 'string' || chapters.length !== returned.length ||
          (more && chapters.length === 0);
        evidence.confirmed();
        const confirmed: SettingsTextCleanupJournal = { version: 2, scope: 'text', phase: 'core_confirmed',
          removedContentBytes, beforeTextFiles, pendingHostChapters: chapters,
          cleanupError: more || blocked ? 'TEXT_CACHE_CLEANUP_PARTIAL' : undefined };
        await this.persistSettingsCoreAcknowledgement(confirmed);
        checkpoint = await this.completeSettingsTextHost(confirmed);
        if (!more || blocked || !admitted()) break;
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
      if (checkpoint === undefined) throw new Error('TEXT_CACHE_CLEANUP_NOT_DISPATCHED');
      return this.finishSettingsTextReceipt(checkpoint);
    });
  }

  reconcileSettingsTextCleanup(current: () => boolean): Promise<SharedDownloadCleanupResult | undefined> {
    return this.serialized(async () => {
      if (!current()) return undefined;
      const journal = await this.readSettingsTextCleanup();
      if (journal === undefined || !current()) return undefined;
      if (journal.phase === 'pending') throw new Error('TEXT_CACHE_CLEANUP_UNCONFIRMED');
      if (journal.phase === 'confirmed') return journal.result;
      if (journal === this.settingsCoreAcknowledgement) await this.persistSettingsCoreAcknowledgement(journal);
      const completed = journal.phase === 'core_confirmed' ? await this.completeSettingsTextHost(journal) : journal;
      return this.finishSettingsTextReceipt(completed);
    });
  }

  private saveSettingsTextCleanup(journal: SettingsTextCleanupJournal | undefined): Promise<void> {
    if (this.persistence.saveSettingsTextCleanup === undefined) throw new Error('TEXT_CACHE_CLEANUP_PERSISTENCE_UNAVAILABLE');
    return this.persistence.saveSettingsTextCleanup(journal);
  }

  private async persistSettingsCoreAcknowledgement(journal: SettingsTextCleanupJournal): Promise<void> {
    // Retain the exact acknowledged batch in this live owner if the durable
    // write fails. A new owner reads the still-unknown on-disk marker instead.
    this.settingsCoreAcknowledgement = journal;
    await this.saveSettingsTextCleanup(journal);
    this.settingsCoreAcknowledgement = undefined;
  }

  private async completeSettingsTextHost(journal: SettingsTextCleanupJournal): Promise<SettingsTextCleanupJournal> {
    const chapters = journal.pendingHostChapters;
    const files = journal.beforeTextFiles;
    if (chapters === undefined || files === undefined) throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
    const pendingKeys = new Set(chapters.map(chapter => this.key(chapter)));
    const byChapter = new Map<string, ReadingImageCleanupFile[]>();
    for (const file of files) if (file.textOwner !== undefined) {
      const key = this.key(file.textOwner);
      if (!pendingKeys.has(key)) continue;
      const bucket = byChapter.get(key) ?? [];
      bucket.push(file);
      byChapter.set(key, bucket);
    }
    const protectedKeys = new Set<string>();
    let current: (() => boolean) | undefined;
    if (byChapter.size > 0) {
      // Core can commit while a retained download or active reader changes.
      // Both the first handoff and an interrupted handoff use fresh authority.
      await this.restoreLegacyProtection();
      current = this.runtime.captureDownloadStorageValidity?.();
      const bindings = await this.runtime.readDownloadStorageBindings();
      for (const chapter of [...bindings.retainedChapters, ...bindings.protectedChapters, ...this.legacyProtection ?? []])
        protectedKeys.add(this.key(chapter));
    }
    let cleanupError = journal.cleanupError;
    for (const chapter of chapters) {
      const key = this.key(chapter);
      const exact = byChapter.get(key);
      if (exact === undefined) continue;
      const reading = (): boolean => this.runtime.protectsDownloadStorageChapter?.(chapter) === true;
      if (protectedKeys.has(key) || reading()) {
        cleanupError = 'TEXT_CACHE_CLEANUP_PARTIAL';
        continue;
      }
      if (current?.() === false) throw new Error('TEXT_CACHE_CLEANUP_PROTECTION_CHANGED');
      await this.disk.clearChapter(chapter.sourceId, chapter.bookId, chapter.chapterIndex, exact,
        (): boolean => current?.() !== false && !reading());
    }
    const completed: SettingsTextCleanupJournal = { ...journal, phase: 'host_completed', pendingHostChapters: undefined, cleanupError };
    await this.saveSettingsTextCleanup(completed);
    return completed;
  }

  private async finishSettingsTextReceipt(journal: SettingsTextCleanupJournal): Promise<SharedDownloadCleanupResult> {
    if (journal.beforeTextFiles === undefined || journal.removedContentBytes === undefined)
      throw new Error('TEXT_CACHE_CLEANUP_JOURNAL_INVALID');
    const result = await this.cleanupReceipt(journal.beforeTextFiles, journal.removedContentBytes, journal.cleanupError);
    const capturedPaths = new Set(journal.beforeTextFiles.map(file => file.path));
    if (result.deletedFiles < capturedPaths.size) result.cleanupError = 'TEXT_CACHE_CLEANUP_PARTIAL';
    await this.saveSettingsTextCleanup({ version: 2, scope: 'text', phase: 'confirmed', result });
    return result;
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
        const canDispatch = (): boolean => current() && (reason !== 'capacity' || this.disk.isReadingStorageInventoryCurrent(snapshot));
        if (!canDispatch()) throw new Error('DOWNLOAD_STORAGE_OWNERSHIP_UNAVAILABLE');
        const data = await this.requestCleanup(reason, policy, capacityBytes, snapshot, bindings, canDispatch, options);
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
    if (reason !== 'clear' && cleanupError !== undefined) throw new Error(cleanupError);
    return this.cleanupReceipt(options.textOnly ? before.files.filter(file => file.textOwner !== undefined) : before.files,
      removedContentBytes, cleanupError);
  }

  private async requestCleanup(reason: 'clear' | 'expiry' | 'capacity', policy: SharedDownloadStoragePolicy,
    capacityBytes: number, snapshot: ReadingImageStorageSnapshot, bindings: SharedDownloadStorageBindings,
    current: () => boolean, options: StorageCleanupOptions): Promise<JsonObject> {
    try {
      const event = await this.runtime.request('cache.storage.cleanup', {
        ...this.params(bindings, snapshot), reason, nowSeconds: Math.floor(Date.now() / 1000),
        ttlSeconds: policy.expiryDays * 86400, capacityBytes,
        ...(options.textOnly ? { contentScope: 'text' } : {}),
      }, { timeoutMs: 30000, canDispatch: current, canContinue: current,
        onDispatch: (): void => { options.evidence?.dispatched(); },
      });
      return event.data;
    } catch (error) {
      if (isReaderCoreTransactionPendingError(error) || (error instanceof ReaderCoreRequestError &&
        error.event.error.details?.['nonExecution'] === true)) options.evidence?.rejectedBeforeExecution();
      throw error as Error;
    }
  }

  private async cleanupReceipt(files: ReadingImageCleanupFile[], removedContentBytes: number,
    cleanupError: string | undefined): Promise<SharedDownloadCleanupResult> {
    const actual = await this.disk.readingStorageCleanupReceipt({ files });
    let summary: DownloadStorageSummary = {};
    try { summary = await this.summary(); } catch (_) { /* A later read cannot invalidate a qualified deletion receipt. */ }
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
