import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import statfs from '@ohos.file.statvfs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { readMangaAtomicPayload } from './MangaAtomicPayloadPort';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import {
  assertReadingOfflineWriteCapacity,
  ReadingOfflineMaterializationError,
} from '../features/reading/ReadingOfflineContract';

const CACHE_FORMAT_VERSION = 2;
const LEGACY_CACHE_FORMAT_VERSION = 1;
const TEXT_CACHE_OWNER = 'reader-text-images-v2';
const MANGA_SCRIPT_CACHE_PROFILE = 'script-bgra-v2';
const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
const READING_IMAGE_WRITE_CHUNK_BYTES = 1024 * 1024;
const MIN_READING_IMAGE_FREE_RESERVE_BYTES = 16 * 1024 * 1024;
const FILE_SYSTEM_NO_SPACE_ERROR = 13900025;
/**
 * The cache ceiling is a safety cap, not the default budget.  The actual
 * budget is derived from the volume reported by statvfs so a small VM cannot
 * consume its whole data partition.  A probe without total-size support keeps
 * the historical cap as a conservative compatibility fallback.
 */
const MANGA_CACHE_BUDGET_MAX_BYTES = 10 * 1024 * 1024 * 1024;
const MANGA_FREE_RESERVE_BYTES = 512 * 1024 * 1024;
const MANGA_FOREGROUND_RESERVE_BYTES = 32 * 1024 * 1024;
const MANGA_SYSTEM_RESERVE_RATIO = 0.10;
const MANGA_SYSTEM_RESERVE_FLOOR_BYTES = 64 * 1024 * 1024;
const MANGA_DERIVED_BUDGET_RATIO = 0.75;
const MANGA_FOREGROUND_CHECK_MS = 24 * 60 * 60 * 1000;
const MANGA_READ_TTL_SECONDS = 7 * 24 * 60 * 60;
const MANGA_IDENTITY_METADATA_BYTES = 64 * 1024;
const MANGA_MANIFEST_METADATA_BYTES = 2 * 1024 * 1024;
/**
 * Core's classify/policy batch contract accepts at most 256 chapters. Keep a
 * lower ceiling here so storage summaries and maintenance remain safe when a
 * large shelf is handed to the Host. The helper below restores the original
 * ordering after issuing one bounded request per slice.
 */
const MANGA_AUTHORITY_BATCH_SIZE = 128;

export type MangaStorageChapter = { sourceId: string; bookId: string; chapterId: string; contentVersion: string; };
export type MangaStorageClass = 'cache' | 'download' | 'protected' | 'unknown' | 'missing';
export type MangaStorageReason = 'expiry' | 'capacity' | 'clear';
export type MangaStorageScope = { sourceId: string; bookId: string; };
export type MangaStorageCleanup = { deletedBytes: number; deletedFiles: number; };
export type MangaStorageGrant = MangaStorageChapter & { grantToken: string; };
export type MangaStoragePolicy = { status: MangaStorageClass; inUse: boolean; lastReadAt: number | null; };
export type MangaExpiryGuard = { nowSeconds: number; ttlSeconds: number; };
export interface MangaStorageAuthority {
  classify(chapter: MangaStorageChapter): Promise<MangaStorageClass>;
  /** Optional one-snapshot classification seam. Core implementations can
   * answer this from a versioned book/status index; the compatibility path
   * below fans out only when an older authority has no batch method. */
  classifyBatch?(chapters: MangaStorageChapter[]): Promise<MangaStorageClass[]>;
  policy?(chapter: MangaStorageChapter): Promise<MangaStoragePolicy>;
  /** Optional ordered policy snapshot for expiry/maintenance passes. */
  policyBatch?(chapters: MangaStorageChapter[]): Promise<MangaStoragePolicy[]>;
  candidates(reason: MangaStorageReason, scope?: MangaStorageScope): Promise<MangaStorageChapter[]>;
  claim(chapter: MangaStorageChapter, expiry?: MangaExpiryGuard): Promise<MangaStorageGrant | undefined>;
  complete(grant: MangaStorageGrant, removed: boolean): Promise<void>;
  pending(): Promise<MangaStorageGrant[]>;
}
export type MangaExternalFile = { path: string; owners: MangaStorageChapter[]; live: boolean; };
export interface MangaExternalStorage {
  inventory(): Promise<MangaExternalFile[]>;
  /** The display owner rechecks its own live references under its mutation lock. */
  remove(grant: MangaStorageGrant, files: MangaExternalFile[]): Promise<boolean>;
  /** Rebuildable download display files use no original-content eviction grant.
   * Await the current authority guard before every unlink, then recheck live I/O. */
  removeDerived?(chapter: MangaStorageChapter, files: MangaExternalFile[], current: () => Promise<boolean>): Promise<boolean>;
}
export interface MangaWriteReservation { release(): void; }
type MangaInventoryFile = MangaExternalFile & { size: number; physicalKey: string; external: boolean; };
export type SharedDownloadStoragePolicy = { capacityBytes: number; expiryDays: number; };
export type ReadingTextStorageChapter = { sourceId: string; bookId: string; chapterIndex: number; };
export type ReadingTextStorageImageChapter = ReadingTextStorageChapter & { contentBytes: number; cachedAtSeconds?: number; };
export type ReadingTextStoragePolicy = { retained: boolean; inUse: boolean; };
export type ReadingImageStorageSummary = { totalBytes: number; retainedBytes: number; automaticBytes: number;
  cleanableBytes?: number; availableBytes?: number; classificationKnown: boolean; };
type ReadingInventoryFile = MangaInventoryFile & { textOwner?: ReadingTextStorageChapter; };
export type ReadingImageStorageSnapshot = { files: ReadingInventoryFile[]; writeRevision: number;
  hostImageChapters: ReadingTextStorageImageChapter[]; protectedChapters: ReadingTextStorageChapter[]; };


interface ReadingImageDigestProof { fingerprint: string; digest: string; }

export interface ReadingImageFreeSpaceProbe {
  getFreeBytes(path: string): Promise<number>;
  /** Optional on older SDK fixtures; production statvfs supports it. */
  getTotalBytes?(path: string): Promise<number | undefined>;
}

class HarmonyReadingImageFreeSpaceProbe implements ReadingImageFreeSpaceProbe {
  async getFreeBytes(path: string): Promise<number> {
    return statfs.getFreeSize(path);
  }
  async getTotalBytes(path: string): Promise<number | undefined> {
    // Older test/preview SDKs expose getFreeSize only.  Keep the fixed cap
    // fallback there; production API level 20 supplies getTotalSize.
    if (typeof statfs.getTotalSize !== 'function') return undefined;
    return statfs.getTotalSize(path);
  }
}

export type MangaStorageCapacity = {
  freeBytes: number;
  totalBytes: number | undefined;
  systemReserveBytes: number;
  cacheBudgetBytes: number;
  originalBudgetBytes: number;
  derivedBudgetBytes: number;
};

type MangaStorageBuckets = {
  ordinaryBytes: number;
  originalBytes: number;
  derivedBytes: number;
  downloadBytes: number;
};

export type ReadingImageCacheIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  contentVersion: string;
  mangaDecodeRevision?: string;
  priority?: 'foreground' | 'background';
  imageUrl: string;
  resourceRef?: string;
  baseUrl?: string;
};

export type ReadingImageChapterIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  contentVersion: string;
  mangaDecodeRevision?: string;
  priority?: 'foreground' | 'background';
};

/** One canonical identity form shared by projection, requests, and disk keys. */
type ReadingImageChapterManifest = {
  /** Upstream manga manifests and partial text ownership use separate files. */
  manga?: boolean;
  mangaCacheProfile?: string;
  chapterId?: string;
  cacheOwner?: string;
  resourceDigests?: Record<string, string>;
  formatVersion: number;
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
  resourceHashes: string[];
  completedAt: number;
};

/**
 * Durable Host-owned bytes for offline body images.
 *
 * Core continues to own the stable image locator and chapter body. The Host
 * stores only bounded resource bytes plus an exact chapter/content-version
 * manifest. Paths contain SHA-256 identities rather than URLs, cookies, or
 * source credentials. A manifest is published only after every resource file
 * exists, so restart can never mistake a partial range for offline-complete.
 */
export class ReadingImageDiskCache {
  private readonly context: common.UIAbilityContext;
  private readonly freeSpaceProbe: ReadingImageFreeSpaceProbe;
  // Reuse the platform LRU; this contains no pixels or credentials.
  private readonly verifiedDigests: util.LRUCache<string, ReadingImageDigestProof> = new util.LRUCache<string, ReadingImageDigestProof>(16384);
  private readonly inFlightWrites = new Map<string, Promise<void>>();
  private inFlightWriteRevision: number = 0;
  /**
   * Serializes destructive/constructive mutations for one book identity.
   * A chapter clear or corrupt-resource removal must not race a background
   * prefetch and recreate bytes after the caller has declared them gone.
   * Different books remain independent and still use the two write lanes.
   */
  private readonly bookMutationTails = new Map<string, Promise<void>>();
  private readonly bookClearGenerations = new Map<string, number>();
  private closed: boolean = false;
  private writeLaneA: Promise<void> = Promise.resolve();
  private writeLaneB: Promise<void> = Promise.resolve();
  private nextWriteLane: number = 0;
  private nextTemporaryFile: number = 0;
  private mangaAuthority: MangaStorageAuthority | undefined;
  private mangaAuthorityReady: Promise<void> = Promise.resolve();
  private mangaExternal: MangaExternalStorage | undefined;
  private mangaPolicyTail: Promise<void> = Promise.resolve();
  private mangaExpiryTask: Promise<void> | undefined;
  /** User-selected limits are bounded by the volume-aware safety budget. */
  private configuredCacheLimitBytes: number | undefined;
  private configuredCleanupTtlSeconds: number | undefined;
  private storagePolicyReady: Promise<void> | undefined;
  private mangaReservedBytes: number = 0;
  private mangaOrdinaryReservedBytes: number = 0;
  private mangaOriginalReservedBytes: number = 0;
  private mangaDerivedReservedBytes: number = 0;
  private readonly mangaBusy = new Map<string, number>();
  private readonly mangaEvicting = new Map<string, MangaStorageGrant>();
  private readonly mangaClaiming = new Set<string>();
  private readonly mangaBooks = new Set<string>();
  private mangaLastForegroundCheck: number = 0;
  private mangaStorageEpoch: number = 0;
  private mangaRestoreRequests: number = 0;
  private mangaRestoreBlocked: boolean = false;

  constructor(
    context: common.UIAbilityContext,
    freeSpaceProbe: ReadingImageFreeSpaceProbe = new HarmonyReadingImageFreeSpaceProbe(),
  ) {
    this.context = context;
    this.freeSpaceProbe = freeSpaceProbe;
  }

  setMangaStorageAuthority(authority: MangaStorageAuthority): void {
    this.mangaAuthority = authority;
    this.mangaAuthorityReady = this.enqueueMangaPolicy(async (): Promise<void> => {
      for (const grant of await authority.pending()) this.mangaEvicting.set(this.mangaChapterKey(grant), grant);
    });
    // Keep admission failures observable without an unhandled setup rejection.
    this.mangaAuthorityReady.catch((): void => {});
  }
  setMangaExternalStorage(storage: MangaExternalStorage): void { this.mangaExternal = storage; }

  /** The Runtime invalidates content work and drains display writes first.
   * Serialize the Core restore with physical eviction, then replace local
   * tombstones using the resulting authority even when the restore failed. */
  async withMangaStorageRestore<T>(restore: () => Promise<T>): Promise<T> {
    this.mangaRestoreRequests += 1;
    this.mangaStorageEpoch += 1;
    try {
      return await this.enqueueMangaPolicy(async (): Promise<T> => {
        await Promise.all(Array.from(this.bookMutationTails.values()).map(task => task.catch((): void => {})));
        try { return await restore(); }
        finally {
          this.mangaRestoreBlocked = true;
          const pending = await this.mangaAuthority?.pending() ?? [];
          this.mangaEvicting.clear();
          for (const grant of pending) this.mangaEvicting.set(this.mangaChapterKey(grant), grant);
          this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
        }
      });
    } finally { this.mangaRestoreRequests -= 1; }
  }

  /** Keep the current and two recent chapters pinned for the reading session. */
  pinMangaChapter(chapter: MangaStorageChapter): () => void {
    this.assertMangaStorageChapter(chapter);
    const key = this.mangaChapterKey(chapter);
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    if (this.closed || this.mangaEvicting.has(key) || this.mangaClaiming.has(key)) throw new Error('MANGA_CACHE_EVICTING');
    this.mangaBooks.add(this.bookMutationKey(chapter.sourceId, chapter.bookId));
    this.mangaBusy.set(key, (this.mangaBusy.get(key) ?? 0) + 1);
    let released = false;
    return (): void => {
      if (released) return;
      released = true;
      const count = (this.mangaBusy.get(key) ?? 1) - 1;
      if (count === 0) this.mangaBusy.delete(key); else this.mangaBusy.set(key, count);
    };
  }

  /** Reserve before entering a display/book mutation lock, release after publish/failure. */
  async reserveExternalWrite(
    chapter: MangaStorageChapter,
    bytes: number,
    priority: 'foreground' | 'background' = 'foreground',
    kind: 'original' | 'derived' = 'original',
  ): Promise<MangaWriteReservation> {
    this.assertMangaStorageChapter(chapter);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid manga write reservation');
    const unpin = this.pinMangaChapter(chapter);
    let ordinaryReservation = false;
    try {
      await this.mangaAuthorityReady;
      await this.enqueueMangaPolicy(async (): Promise<void> => {
        if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
        if (this.mangaEvicting.has(this.mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
        ordinaryReservation = kind === 'derived' ||
          (await this.mangaAuthority?.classify(chapter) ?? 'unknown') !== 'download';
        let inventory = await this.mangaInventory();
        let buckets = await this.mangaStorageBuckets(inventory);
        const headroom = priority === 'background' ? MANGA_FOREGROUND_RESERVE_BYTES : 0;
        let capacity = await this.mangaStorageCapacityForPath(this.context.filesDir);
        let freeBytes = capacity.freeBytes;
        const bucketBytes = (): number => kind === 'derived' ? buckets.derivedBytes : buckets.originalBytes;
        const bucketReservedBytes = (): number => kind === 'derived' ? this.mangaDerivedReservedBytes : this.mangaOriginalReservedBytes;
        const bucketBudgetBytes = (): number => kind === 'derived' ? capacity.derivedBudgetBytes : capacity.originalBudgetBytes;
        const overBudget = (): boolean => ordinaryReservation && (
          bucketBytes() + bucketReservedBytes() + bytes + headroom > bucketBudgetBytes() ||
          buckets.ordinaryBytes + this.mangaOrdinaryReservedBytes + bytes + headroom > capacity.cacheBudgetBytes
        );
        const lowSpace = (): boolean => freeBytes < capacity.systemReserveBytes + this.mangaReservedBytes + bytes + headroom;
        if (overBudget() || lowSpace()) {
          await this.evictMangaCandidates('capacity', undefined, async (): Promise<boolean> => {
            inventory = await this.mangaInventory();
            buckets = await this.mangaStorageBuckets(inventory);
            capacity = await this.mangaStorageCapacityForPath(this.context.filesDir);
            freeBytes = capacity.freeBytes;
            return !overBudget() && !lowSpace();
          });
          inventory = await this.mangaInventory();
          buckets = await this.mangaStorageBuckets(inventory);
          capacity = await this.mangaStorageCapacityForPath(this.context.filesDir);
          freeBytes = capacity.freeBytes;
        }
        if (overBudget() || lowSpace()) throw new ReadingOfflineMaterializationError('storage_full', 'MANGA_CACHE_STORAGE_FULL');
        if (this.closed || this.mangaEvicting.has(this.mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
        this.mangaReservedBytes += bytes;
        if (ordinaryReservation) {
          this.mangaOrdinaryReservedBytes += bytes;
          if (kind === 'derived') this.mangaDerivedReservedBytes += bytes;
          else this.mangaOriginalReservedBytes += bytes;
        }
      });
    } catch (error) { unpin(); throw error; }
    let released = false;
    return { release: (): void => {
      if (released) return;
      released = true; this.mangaReservedBytes -= bytes;
      if (ordinaryReservation) {
        this.mangaOrdinaryReservedBytes -= bytes;
        if (kind === 'derived') this.mangaDerivedReservedBytes -= bytes;
        else this.mangaOriginalReservedBytes -= bytes;
      }
      unpin();
    } };
  }

  /** Core owns the seven-day read clock and the LRU candidate order. */
  async maintainMangaStorage(reason: MangaStorageReason = 'expiry', scope?: MangaStorageScope): Promise<void> {
    if (reason === 'expiry') { await this.maintainMangaExpiry(scope); return; }
    await this.enqueueMangaPolicy(async (): Promise<void> => {
      if (this.mangaRestoreRequests > 0) return;
      if (this.mangaRestoreBlocked) {
        const pending = await this.mangaAuthority?.pending() ?? [];
        this.mangaEvicting.clear();
        for (const grant of pending) this.mangaEvicting.set(this.mangaChapterKey(grant), grant);
        this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
      }
      await this.evictMangaCandidates(reason, scope);
    });
  }

  /** Idle scanning may await a large Core inventory. It cannot hold the
   * foreground budget lane across that wait or a whole historical cleanup.
   * One chapter transaction at a time retains the original exact grant fences. */
  private async maintainMangaExpiry(scope?: MangaStorageScope): Promise<void> {
    if (this.mangaExpiryTask !== undefined) { await this.mangaExpiryTask; return; }
    const task = this.runMangaExpiry(scope);
    this.mangaExpiryTask = task;
    const finish = (): void => { if (this.mangaExpiryTask === task) this.mangaExpiryTask = undefined; };
    void task.then(finish, finish);
    await task;
  }

  private async runMangaExpiry(scope?: MangaStorageScope): Promise<void> {
    await this.loadStoragePolicy();
    await this.mangaAuthorityReady;
    const epoch = this.mangaStorageEpoch;
    const ready = await this.enqueueMangaPolicy(async (): Promise<boolean> => {
      if (this.closed || this.mangaRestoreRequests > 0 || epoch !== this.mangaStorageEpoch) return false;
      if (this.mangaRestoreBlocked) {
        const pending = await this.mangaAuthority?.pending() ?? [];
        this.mangaEvicting.clear();
        for (const grant of pending) this.mangaEvicting.set(this.mangaChapterKey(grant), grant);
        this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
      }
      const elapsed = Date.now() - this.mangaLastForegroundCheck;
      return this.mangaLastForegroundCheck === 0 || elapsed < 0 || elapsed >= MANGA_FOREGROUND_CHECK_MS;
    });
    if (!ready) return;
    await this.evictMangaCandidates('expiry', scope, undefined, true);
    if (!this.closed && epoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0)
      this.mangaLastForegroundCheck = Date.now();
  }

  private async mangaPolicyStep<T>(batched: boolean, operation: () => Promise<T>): Promise<T> {
    return batched ? this.enqueueMangaPolicy(operation) : operation();
  }

  /** Actual bytes, including manifests, temporary writes and derived display files. */
  async mangaStorageUsage(): Promise<{ ordinaryBytes: number; reservedBytes: number; }> {
    const inventory = await this.mangaInventory();
    return { ordinaryBytes: await this.mangaOrdinaryBytes(inventory), reservedBytes: this.mangaReservedBytes };
  }

  /** One inventory pass for storage-management surfaces. Unknown or
   * protected originals remain in the automatic bucket conservatively; only
   * Core-confirmed downloads are counted as retained content. */
  async mangaStorageSummary(): Promise<{
    totalBytes: number; retainedBytes: number; automaticBytes: number;
    cleanableBytes: number; availableBytes: number;
  }> {
    const inventory = await this.mangaInventory();
    const buckets = await this.mangaStorageBuckets(inventory);
    const capacity = await this.mangaStorageCapacityForPath(this.context.filesDir);
    const cleanableBytes = await this.mangaCleanableBytes(inventory);
    return {
      totalBytes: buckets.downloadBytes + buckets.ordinaryBytes,
      retainedBytes: buckets.downloadBytes,
      automaticBytes: buckets.ordinaryBytes,
      // Report only files the same derived-cache policy can currently claim
      // and unlink. Unknown/protected originals, active leases and shared
      // physical aliases stay outside this number.
      cleanableBytes,
      availableBytes: capacity.freeBytes,
    };
  }

  async configureStoragePolicy(limitMb: number, cleanupAfterDays: number): Promise<void> {
    if (!Number.isSafeInteger(limitMb) || limitMb < 128 || limitMb > 10 * 1024 ||
      !Number.isSafeInteger(cleanupAfterDays) || cleanupAfterDays < 1 || cleanupAfterDays > 365) {
      throw new Error('MANGA_CACHE_STORAGE_POLICY_INVALID');
    }
    await this.persistStoragePolicy(limitMb, cleanupAfterDays);
  }

  private async persistStoragePolicy(limitMb: number | undefined, cleanupAfterDays: number): Promise<void> {
    await this.loadStoragePolicy();
    await this.enqueueMangaPolicy(async (): Promise<void> => {
      if (this.closed) throw new Error('MANGA_CACHE_CLOSED');
      const directory = `${this.context.filesDir}/reader-offline`;
      await this.ensureDirectory(directory);
      await this.writeAtomicBytes(`${directory}/storage-policy.json`, new util.TextEncoder().encodeInto(
        JSON.stringify({ version: 1, limitMb, cleanupAfterDays })));
      // Publish only after the durable write succeeds, so a rejected setting
      // cannot silently alter the running budget or differ after restart.
      this.configuredCacheLimitBytes = limitMb === undefined ? undefined : limitMb * 1024 * 1024;
      this.configuredCleanupTtlSeconds = cleanupAfterDays * 24 * 60 * 60;
      this.mangaLastForegroundCheck = 0;
    });
  }

  /** The same durable, volume-bounded policy governs ordinary text and image
   * storage. There is no second preference with a fixed 10 GiB default. */
  async readPolicy(): Promise<SharedDownloadStoragePolicy> {
    const capacity = await this.mangaStorageCapacity();
    return { capacityBytes: capacity.cacheBudgetBytes,
      expiryDays: (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS) / 86400 };
  }

  async configurePolicy(policy: SharedDownloadStoragePolicy): Promise<SharedDownloadStoragePolicy> {
    if (!Number.isSafeInteger(policy.expiryDays) || policy.expiryDays < 1 || policy.expiryDays > 365 ||
      !Number.isSafeInteger(policy.capacityBytes) || policy.capacityBytes < 0)
      throw new Error('MANGA_CACHE_STORAGE_POLICY_INVALID');
    const capacity = await this.mangaStorageCapacity();
    // A measured automatic limit need not be a whole MiB. Saving the current
    // selection preserves its automatic/configured provenance and exact bytes.
    if (policy.capacityBytes === capacity.cacheBudgetBytes) {
      await this.persistStoragePolicy(this.configuredCacheLimitBytes === undefined ? undefined :
        this.configuredCacheLimitBytes / (1024 * 1024), policy.expiryDays);
    } else {
      const maximum = capacity.totalBytes === undefined ? MANGA_CACHE_BUDGET_MAX_BYTES :
        Math.min(MANGA_CACHE_BUDGET_MAX_BYTES, Math.max(0, capacity.totalBytes - capacity.systemReserveBytes));
      if (policy.capacityBytes < 128 * 1024 * 1024 || policy.capacityBytes > maximum ||
        policy.capacityBytes > MANGA_CACHE_BUDGET_MAX_BYTES || policy.capacityBytes % (1024 * 1024) !== 0)
        throw new Error('MANGA_CACHE_STORAGE_POLICY_INVALID');
      await this.configureStoragePolicy(policy.capacityBytes / (1024 * 1024), policy.expiryDays);
    }
    return this.readPolicy();
  }

  /** One actual file inventory is shared by the global summary, Core's
   * image-only selectors and all book rows. No per-book full disk walks. */
  async captureReadingStorageInventory(): Promise<ReadingImageStorageSnapshot> {
    await this.mangaAuthorityReady;
    const writeRevision = this.inFlightWriteRevision;
    const files = await this.readingInventory();
    const physical = new Map<string, ReadingInventoryFile[]>();
    for (const file of files) {
      const aliases = physical.get(file.physicalKey) ?? [];
      aliases.push(file); physical.set(file.physicalKey, aliases);
    }
    const chapters = new Map<string, ReadingTextStorageImageChapter>();
    const protectedChapters = new Map<string, ReadingTextStorageChapter>();
    for (const aliases of physical.values()) {
      const text = aliases.filter(file => file.textOwner !== undefined);
      const owner = text[0]?.textOwner;
      if (owner === undefined) continue;
      const key = this.textStorageKey(owner);
      const measured = chapters.get(key) ?? { ...owner, contentBytes: 0 };
      measured.contentBytes += Math.max(...aliases.map(file => file.size));
      for (const file of aliases) {
        if (file.textOwner === undefined || file.live || this.inFlightWrites.has(file.path) ||
          this.bookMutationTails.has(this.bookMutationKey(owner.sourceId, owner.bookId)) ||
          this.textStorageKey(file.textOwner) !== key) protectedChapters.set(key, owner);
        if (!(await fileIo.access(file.path))) continue;
        const stat = await fileIo.stat(file.path);
        const seconds = Math.floor(Number(stat.mtimeNs) / 1000000000);
        if (Number.isSafeInteger(seconds) && seconds >= 0)
          measured.cachedAtSeconds = Math.max(measured.cachedAtSeconds ?? 0, seconds);
      }
      if (protectedChapters.has(key)) for (const file of text) {
        const known = file.textOwner!;
        protectedChapters.set(this.textStorageKey(known), known);
      }
      chapters.set(key, measured);
    }
    return { files, writeRevision,
      hostImageChapters: Array.from(chapters.values()), protectedChapters: Array.from(protectedChapters.values()) };
  }

  isReadingStorageInventoryCurrent(snapshot: ReadingImageStorageSnapshot): boolean {
    return !this.closed && snapshot.writeRevision === this.inFlightWriteRevision;
  }

  async readingStorageSummary(snapshot: ReadingImageStorageSnapshot,
    textPolicy: (chapter: ReadingTextStorageChapter) => ReadingTextStoragePolicy | undefined): Promise<ReadingImageStorageSummary> {
    const physical = new Map<string, ReadingInventoryFile[]>();
    const owners = new Map<string, MangaStorageChapter>();
    for (const file of snapshot.files) {
      const aliases = physical.get(file.physicalKey) ?? [];
      aliases.push(file); physical.set(file.physicalKey, aliases);
      for (const owner of file.owners) owners.set(this.mangaChapterKey(owner), owner);
    }
    const classes = await this.mangaStorageClassSnapshot(Array.from(owners.values()));
    const mangaEligible = await this.mangaCleanablePhysicalKeys(snapshot.files);
    const protectedText = new Set(snapshot.protectedChapters.map(chapter => this.textStorageKey(chapter)));
    let totalBytes = 0, retainedBytes = 0, automaticBytes = 0, cleanableBytes = 0, classificationKnown = true;
    for (const [physicalKey, aliases] of physical) {
      const size = Math.max(...aliases.map(file => file.size));
      let retained = false, known = true, removable = true;
      const hasText = aliases.some(file => file.textOwner !== undefined);
      for (const file of aliases) {
        if (file.live || this.inFlightWrites.has(file.path)) removable = false;
        if (file.textOwner !== undefined) {
          const policy = textPolicy(file.textOwner);
          if (policy === undefined) { known = false; removable = false; }
          else { retained = retained || policy.retained; removable = removable && !policy.retained && !policy.inUse; }
          if (protectedText.has(this.textStorageKey(file.textOwner))) removable = false;
          if (this.bookMutationTails.has(this.bookMutationKey(file.textOwner.sourceId, file.textOwner.bookId))) removable = false;
        } else if (file.owners.length > 0) {
          for (const owner of file.owners) {
            const classification = classes.get(this.mangaChapterKey(owner)) ?? 'unknown';
            if (classification === 'unknown' || classification === 'missing') known = false;
            retained = retained || (!file.external && classification === 'download');
          }
          if (hasText || !mangaEligible.has(physicalKey)) removable = false;
        } else {
          // Policy and durable clear metadata are accounted, never candidates.
          if (!file.path.endsWith('/storage-policy.json') && !file.path.startsWith(`${this.rootDirectory()}/.clear/`)) known = false;
          removable = false;
        }
      }
      totalBytes += size;
      if (retained) retainedBytes += size;
      else {
        automaticBytes += size;
        if (known && removable) cleanableBytes += size;
      }
      classificationKnown = classificationKnown && known;
    }
    const capacity = await this.mangaStorageCapacity();
    return { totalBytes, retainedBytes, automaticBytes,
      cleanableBytes: !this.closed && snapshot.writeRevision === this.inFlightWriteRevision ? cleanableBytes : undefined,
      availableBytes: capacity.freeBytes, classificationKnown };
  }

  /** Book rows read this index built from the same snapshot, including physical
   * manga and text images. Inode aliases count once for each actual owner. */
  async readingStorageBookIndex(snapshot: ReadingImageStorageSnapshot): Promise<Map<string, number | undefined>> {
    const byBook = new Map<string, Map<string, number>>();
    for (const file of snapshot.files) {
      const owners: { sourceId: string; bookId: string; }[] = file.textOwner === undefined ? file.owners : [file.textOwner];
      for (const owner of owners) {
        const key = JSON.stringify([owner.sourceId, owner.bookId]);
        const physical = byBook.get(key) ?? new Map<string, number>();
        physical.set(file.physicalKey, Math.max(file.size, physical.get(file.physicalKey) ?? 0));
        byBook.set(key, physical);
      }
    }
    const unknown = new Set<string>();
    for (const file of snapshot.files) if (file.textOwner === undefined && file.owners.length === 0) {
      for (const root of [this.rootDirectory(), this.legacyRootDirectory()]) {
        if (!file.path.startsWith(`${root}/`)) continue;
        const hash = file.path.substring(root.length + 1).split('/')[0];
        if (/^[0-9a-f]{64}$/.test(hash)) unknown.add(hash);
      }
    }
    const index = new Map<string, number | undefined>();
    for (const [key, physical] of byBook) {
      const [sourceId, bookId] = JSON.parse(key) as string[];
      const unknownOwner = unknown.has(await this.bookHash(sourceId, bookId)) || unknown.has(await this.legacyBookHash(sourceId, bookId));
      index.set(key, unknownOwner ? undefined : Array.from(physical.values()).reduce((sum, bytes) => sum + bytes, 0));
    }
    return index;
  }

  /** A successful Core image-only cleanup selector is not a disk receipt.
   * Compare actual remaining paths and inodes only after Host unlink settles. */
  async readingStorageCleanupReceipt(before: ReadingImageStorageSnapshot): Promise<MangaStorageCleanup> {
    const after = await this.readingInventory();
    const retained = new Set(after.map(file => file.physicalKey));
    const released = new Set<string>();
    let deletedBytes = 0, deletedFiles = 0;
    for (const file of before.files) {
      if (await fileIo.access(file.path)) continue;
      deletedFiles += 1;
      if (!retained.has(file.physicalKey) && !released.has(file.physicalKey)) {
        released.add(file.physicalKey); deletedBytes += file.size;
      }
    }
    return { deletedBytes, deletedFiles };
  }

  private textStorageKey(chapter: ReadingTextStorageChapter): string {
    return JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex]);
  }

  private async readingInventory(): Promise<ReadingInventoryFile[]> {
    const result: ReadingInventoryFile[] = await this.mangaInventory();
    for (const root of [this.rootDirectory(), this.legacyRootDirectory()]) if (await fileIo.access(root))
      await this.collectTextStorageFiles(root, result);
    const paths = new Map<string, ReadingInventoryFile>();
    for (const file of result) {
      const previous = paths.get(file.path);
      if (previous === undefined || file.textOwner !== undefined) paths.set(file.path, file);
    }
    return Array.from(paths.values());
  }

  private async collectTextStorageFiles(directory: string, result: ReadingInventoryFile[]): Promise<void> {
    let owner: ReadingTextStorageChapter | undefined;
    const knownFiles = new Set<string>();
    for (const format of [CACHE_FORMAT_VERSION, LEGACY_CACHE_FORMAT_VERSION]) {
      for (const name of format === CACHE_FORMAT_VERSION ? ['manifest.json', 'text-identity.json'] : ['manifest.json']) {
        const manifest = await this.readTextManifestIdentity(directory, format, name, true);
        if (manifest === undefined || !this.isTextOwnership(manifest)) continue;
        const expected = format === CACHE_FORMAT_VERSION ? await this.ordinalChapterDirectory(manifest) :
          await this.legacyChapterDirectory(manifest);
        if (directory !== expected || (name === 'text-identity.json' && manifest.cacheOwner !== TEXT_CACHE_OWNER)) continue;
        owner = { sourceId: manifest.sourceId, bookId: manifest.bookId, chapterIndex: manifest.chapterIndex };
        knownFiles.add(name);
        for (const hash of manifest.resourceHashes) knownFiles.add(`${hash}.bin`);
      }
    }
    for (const name of await fileIo.listFile(directory)) {
      const path = `${directory}/${name}`;
      if (!(await fileIo.access(path))) continue;
      const stat = await fileIo.stat(path);
      if (stat.isDirectory()) {
        if (name !== '.manga' && name !== '.clear') await this.collectTextStorageFiles(path, result);
      } else if (stat.isFile() && owner !== undefined && knownFiles.has(name)) {
        result.push({ path, owners: [], textOwner: owner, live: false, size: stat.size,
          physicalKey: this.mangaPhysicalKey(stat), external: false });
      }
    }
  }

  private async loadStoragePolicy(): Promise<void> {
    if (this.storagePolicyReady === undefined) this.storagePolicyReady = this.readStoragePolicy();
    await this.storagePolicyReady;
  }

  private async readStoragePolicy(): Promise<void> {
    const path = `${this.context.filesDir}/reader-offline/storage-policy.json`;
    if (!(await fileIo.access(path))) return;
    try {
      const bytes = await this.readMangaMetadata(path, MANGA_IDENTITY_METADATA_BYTES);
      const value = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes)) as
        { version: number; limitMb?: number; cleanupAfterDays: number; };
      if (value.version !== 1 || (value.limitMb !== undefined &&
        (!Number.isSafeInteger(value.limitMb) || value.limitMb < 128 || value.limitMb > 10 * 1024)) ||
        !Number.isSafeInteger(value.cleanupAfterDays) || value.cleanupAfterDays < 1 || value.cleanupAfterDays > 365) return;
      this.configuredCacheLimitBytes = value.limitMb === undefined ? undefined : value.limitMb * 1024 * 1024;
      this.configuredCleanupTtlSeconds = value.cleanupAfterDays * 24 * 60 * 60;
    } catch (_) { /* Damaged settings use the safe volume default, never a guessed budget. */ }
  }

  /** Physical cleanup receipt, including partial I/O success. Count reclaimed
   * inodes once; unlinking one of several aliases never claims released bytes. */
  async clearMangaRebuildableCache(scope?: MangaStorageScope): Promise<MangaStorageCleanup> {
    await this.mangaAuthorityReady;
    return this.enqueueMangaPolicy(async (): Promise<MangaStorageCleanup> => {
      if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked || this.closed)
        return { deletedBytes: 0, deletedFiles: 0 };
      const before = await this.mangaInventory();
      await this.evictMangaCandidates('clear', scope);
      const after = await this.mangaInventory();
      const retained = new Set(after.map(file => file.physicalKey));
      const released = new Set<string>();
      let deletedBytes = 0, deletedFiles = 0;
      for (const file of before) {
        if (scope !== undefined && !file.owners.some(owner => owner.sourceId === scope.sourceId && owner.bookId === scope.bookId)) continue;
        if (await fileIo.access(file.path)) continue;
        deletedFiles += 1;
        if (!retained.has(file.physicalKey) && !released.has(file.physicalKey)) {
          released.add(file.physicalKey); deletedBytes += file.size;
        }
      }
      return { deletedBytes, deletedFiles };
    });
  }

  /**
   * Return the current volume-aware cache budget.  This is intentionally a
   * read-only Host API so a VM/evidence agent can decide whether a retry needs
   * derived-cache cleanup without being able to delete user downloads.
   */
  async mangaStorageCapacity(): Promise<MangaStorageCapacity> {
    return this.mangaStorageCapacityForPath(this.context.filesDir);
  }

  /**
   * Reclaim only rebuildable display derivatives.  Original manga bytes,
   * manifests, text books and user data are never passed to this entry point.
   */
  async clearMangaDerivedCache(scope?: MangaStorageScope): Promise<void> {
    await this.mangaAuthorityReady;
    await this.enqueueMangaPolicy(async (): Promise<void> => {
      if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked || this.closed) return;
      await this.trimMangaDownloadDerived('clear', scope);
    });
  }

  /** Download management is not limited by today's catalog. Preserve exact
   * historical chapter identities whenever known local bytes are still owned. */
  async listMangaDownloadChapters(
    sourceId: string,
    bookId: string,
    isCurrent?: () => boolean,
  ): Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>> {
    this.assertNonBlank(sourceId, 'sourceId'); this.assertNonBlank(bookId, 'bookId');
    const epoch = this.mangaStorageEpoch;
    await this.mangaAuthorityReady;
    return this.enqueueMangaPolicy(async (): Promise<Array<{ sourceId: string; bookId: string; chapterId: string; }>> => {
      const chapters = new Map<string, { sourceId: string; bookId: string; chapterId: string; }>();
      for (const owner of await this.mangaDownloadOwners(sourceId, bookId, undefined, epoch, isCurrent)) {
        chapters.set(JSON.stringify([owner.sourceId, owner.bookId, owner.chapterId]), {
          sourceId: owner.sourceId, bookId: owner.bookId, chapterId: owner.chapterId,
        });
      }
      return Array.from(chapters.values());
    });
  }

  /** Inventory includes partial originals and display files. Core alone decides
   * which exact versions are owned downloads; unknown history is not guessed. */
  async listMangaDownloadVersions(
    chapter: { sourceId: string; bookId: string; chapterId: string; },
    isCurrent?: () => boolean,
  ): Promise<string[]> {
    for (const value of [chapter.sourceId, chapter.bookId, chapter.chapterId]) this.assertNonBlank(value, 'manga storage identity');
    const epoch = this.mangaStorageEpoch;
    await this.mangaAuthorityReady;
    return this.enqueueMangaPolicy(async (): Promise<string[]> => {
      const owners = await this.mangaDownloadOwners(chapter.sourceId, chapter.bookId, chapter.chapterId, epoch, isCurrent);
      return owners.map(owner => owner.contentVersion);
    });
  }

  private async mangaDownloadOwners(
    sourceId: string,
    bookId: string,
    chapterId: string | undefined,
    epoch: number,
    isCurrent?: () => boolean,
  ): Promise<MangaStorageChapter[]> {
    this.assertMangaPolicyCurrent(epoch, isCurrent);
    const authority = this.mangaAuthority;
    if (authority === undefined) return [];
    const owners = new Map<string, MangaStorageChapter>();
    for (const file of await this.mangaInventory()) for (const owner of file.owners) {
      if (owner.sourceId === sourceId && owner.bookId === bookId && (chapterId === undefined || owner.chapterId === chapterId)) {
        owners.set(this.mangaChapterKey(owner), owner);
      }
    }
    const downloads: MangaStorageChapter[] = [];
    for (const owner of owners.values()) {
      this.assertMangaPolicyCurrent(epoch, isCurrent);
      if (await authority.classify(owner) === 'download') downloads.push(owner);
    }
    this.assertMangaPolicyCurrent(epoch, isCurrent);
    return downloads;
  }

  /** The Runtime releases the user's retention separately before this call.
   * A Core transaction must grant this exact version before any bytes move. */
  async deleteMangaVersion(chapter: MangaStorageChapter, isCurrent?: () => boolean): Promise<boolean> {
    this.assertMangaStorageChapter(chapter);
    const epoch = this.mangaStorageEpoch;
    await this.mangaAuthorityReady;
    return this.enqueueMangaPolicy(async (): Promise<boolean> => {
      this.assertMangaPolicyCurrent(epoch, isCurrent);
      const authority = this.mangaAuthority;
      if (authority === undefined || this.closed) return false;
      const key = this.mangaChapterKey(chapter);
      if (this.mangaBusy.has(key) || this.mangaClaiming.has(key) ||
        this.bookMutationTails.has(this.bookMutationKey(chapter.sourceId, chapter.bookId))) return false;
      const pending = (await authority.pending()).find(grant => this.mangaChapterKey(grant) === key);
      if (pending !== undefined) return this.removeMangaGrant(pending,
        (): boolean => epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
      if (this.mangaEvicting.has(key)) return false;
      if (this.mangaDeletionFiles(chapter, await this.mangaInventory()) === undefined ||
        await authority.classify(chapter) !== 'cache') return false;
      this.assertMangaPolicyCurrent(epoch, isCurrent);
      if (this.mangaBusy.has(key) || this.bookMutationTails.has(this.bookMutationKey(chapter.sourceId, chapter.bookId))) return false;
      // Reserve the identity before awaiting Core: a new read/write must not
      // enter between the local live check and the transactional grant.
      this.mangaClaiming.add(key);
      let grant: MangaStorageGrant | undefined;
      try { grant = await authority.claim(chapter); }
      finally { this.mangaClaiming.delete(key); }
      if (grant === undefined) return false;
      if (this.mangaChapterKey(grant) !== key || grant.grantToken.trim().length === 0) throw new Error('invalid manga eviction grant');
      return this.removeMangaGrant(grant, (): boolean => epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
    });
  }

  private assertMangaPolicyCurrent(epoch: number, isCurrent?: () => boolean): void {
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    this.assertCurrent((): boolean => !this.closed && epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
  }

  private enqueueMangaPolicy<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.mangaPolicyTail.catch((): void => {}).then(operation);
    this.mangaPolicyTail = task.then((): void => {}, (): void => {});
    return task;
  }

  private mangaChapterKey(chapter: MangaStorageChapter): string {
    return JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterId, chapter.contentVersion]);
  }

  private mangaChapter(identity: ReadingImageChapterIdentity): MangaStorageChapter | undefined {
    if (identity.mangaDecodeRevision === undefined || identity.chapterId === undefined) return undefined;
    return { sourceId: identity.sourceId, bookId: identity.bookId, chapterId: identity.chapterId, contentVersion: identity.contentVersion };
  }

  private assertMangaStorageChapter(chapter: MangaStorageChapter): void {
    for (const value of [chapter.sourceId, chapter.bookId, chapter.chapterId, chapter.contentVersion]) this.assertNonBlank(value, 'manga storage identity');
  }

  private async mangaStorageBuckets(files: MangaInventoryFile[]): Promise<MangaStorageBuckets> {
    const physical = new Map<string, { size: number; kind: 'original' | 'derived' | 'download'; }>();
    const classes = new Map<string, MangaStorageClass>();
    const originalOwners = new Map<string, MangaStorageChapter>();
    for (const file of files) if (!file.external) for (const owner of file.owners)
      originalOwners.set(this.mangaChapterKey(owner), owner);
    const snapshot = await this.mangaStorageClassSnapshot(Array.from(originalOwners.values()));
    for (const file of files) {
      let kind: 'original' | 'derived' | 'download' = file.external ? 'derived' : 'original';
      // Display derivatives always count toward ordinary cache. Only original
      // consumers need an authority read to exempt permanently owned bytes.
      if (!file.external) {
        for (const owner of file.owners) {
          const key = this.mangaChapterKey(owner);
          let classification = classes.get(key);
          if (classification === undefined) {
            classification = snapshot.get(key) ?? 'unknown'; classes.set(key, classification);
          }
          if (classification === 'download') kind = 'download';
        }
      }
      const existing = physical.get(file.physicalKey);
      // A hard-linked permanent original keeps every alias outside the cache
      // budget. Otherwise an external display file remains derived; an
      // ordinary original wins over that display alias for conservative
      // accounting.
      if (existing !== undefined) {
        if (existing.kind === 'download' || kind === 'download') kind = 'download';
        else if (existing.kind === 'original' || kind === 'original') kind = 'original';
      }
      physical.set(file.physicalKey, { size: Math.max(file.size, existing?.size ?? 0), kind });
    }
    let originalBytes = 0, derivedBytes = 0, downloadBytes = 0;
    for (const item of physical.values()) {
      if (item.kind === 'download') downloadBytes += item.size;
      else if (item.kind === 'derived') derivedBytes += item.size;
      else originalBytes += item.size;
    }
    return { originalBytes, derivedBytes, downloadBytes, ordinaryBytes: originalBytes + derivedBytes };
  }

  private async mangaStorageClassSnapshot(chapters: MangaStorageChapter[]): Promise<Map<string, MangaStorageClass>> {
    const authority = this.mangaAuthority;
    const result = new Map<string, MangaStorageClass>();
    if (authority === undefined || chapters.length === 0) return result;
    // Storage summaries are advisory and can cover a very large shelf. Keep
    // each Core batch small and cap the number of in-flight RPCs so a thousand
    // chapter book cannot monopolize the request lane or allocate one giant
    // result array. Ordering is restored before publishing the snapshot.
    const batchSize = 32;
    const batches: MangaStorageChapter[][] = [];
    for (let start = 0; start < chapters.length; start += batchSize)
      batches.push(chapters.slice(start, Math.min(chapters.length, start + batchSize)));
    const values = new Array<MangaStorageClass>(chapters.length);
    let nextBatch = 0;
    const worker = async (): Promise<void> => {
      while (nextBatch < batches.length) {
        const batchIndex = nextBatch++;
        const batch = batches[batchIndex];
        const batchValues = authority.classifyBatch === undefined ?
          await Promise.all(batch.map((chapter): Promise<MangaStorageClass> => authority.classify(chapter))) :
          await authority.classifyBatch(batch);
        if (batchValues.length !== batch.length) throw new Error('MANGA_STORAGE_CLASS_SNAPSHOT_INVALID');
        batchValues.forEach((value, offset): void => { values[batchIndex * batchSize + offset] = value; });
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, batches.length) }, (): Promise<void> => worker()));
    chapters.forEach((chapter, index): void => {
      const value = values[index];
      if (value === undefined) throw new Error('MANGA_STORAGE_CLASS_SNAPSHOT_INVALID');
      result.set(this.mangaChapterKey(chapter), value);
    });
    return result;
  }

  private async mangaAuthorityClassSnapshot(chapters: MangaStorageChapter[]): Promise<MangaStorageClass[] | undefined> {
    const authority = this.mangaAuthority;
    if (authority?.classifyBatch === undefined || chapters.length === 0) return undefined;
    const values: MangaStorageClass[] = [];
    for (let start = 0; start < chapters.length; start += MANGA_AUTHORITY_BATCH_SIZE) {
      const batch = chapters.slice(start, Math.min(chapters.length, start + MANGA_AUTHORITY_BATCH_SIZE));
      const batchValues = await authority.classifyBatch(batch);
      if (batchValues.length !== batch.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
      values.push(...batchValues);
    }
    return values;
  }

  private async mangaAuthorityPolicySnapshot(chapters: MangaStorageChapter[]): Promise<MangaStoragePolicy[] | undefined> {
    const authority = this.mangaAuthority;
    if (authority?.policyBatch === undefined || chapters.length === 0) return undefined;
    const values: MangaStoragePolicy[] = [];
    for (let start = 0; start < chapters.length; start += MANGA_AUTHORITY_BATCH_SIZE) {
      const batch = chapters.slice(start, Math.min(chapters.length, start + MANGA_AUTHORITY_BATCH_SIZE));
      const batchValues = await authority.policyBatch(batch);
      if (batchValues.length !== batch.length) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
      values.push(...batchValues);
    }
    return values;
  }

  private async mangaOrdinaryBytes(files: MangaInventoryFile[]): Promise<number> {
    return (await this.mangaStorageBuckets(files)).ordinaryBytes;
  }

  private async mangaStorageCapacityForPath(path: string): Promise<MangaStorageCapacity> {
    await this.loadStoragePolicy();
    const freeBytes = await this.freeSpaceProbe.getFreeBytes(path);
    const totalBytes = this.freeSpaceProbe.getTotalBytes === undefined ? undefined :
      await this.freeSpaceProbe.getTotalBytes(path);
    if (!Number.isSafeInteger(freeBytes) || freeBytes < 0 ||
      (totalBytes !== undefined && (!Number.isSafeInteger(totalBytes) || totalBytes < 0))) {
      throw new Error('MANGA_CACHE_STORAGE_CAPACITY_INVALID');
    }
    if (totalBytes === undefined) {
      return {
        freeBytes, totalBytes: undefined, systemReserveBytes: MANGA_FREE_RESERVE_BYTES,
        cacheBudgetBytes: this.configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
        originalBudgetBytes: this.configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
        derivedBudgetBytes: this.configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
      };
    }
    const systemReserveBytes = Math.min(
      MANGA_FREE_RESERVE_BYTES,
      Math.max(MANGA_SYSTEM_RESERVE_FLOOR_BYTES, Math.floor(totalBytes * MANGA_SYSTEM_RESERVE_RATIO)),
    );
    const volumeBudgetBytes = Math.min(MANGA_CACHE_BUDGET_MAX_BYTES, Math.max(0, totalBytes - systemReserveBytes));
    const cacheBudgetBytes = Math.min(volumeBudgetBytes, this.configuredCacheLimitBytes ?? volumeBudgetBytes);
    const derivedBudgetBytes = Math.floor(cacheBudgetBytes * MANGA_DERIVED_BUDGET_RATIO);
    return {
      freeBytes, totalBytes, systemReserveBytes, cacheBudgetBytes,
      derivedBudgetBytes, originalBudgetBytes: cacheBudgetBytes - derivedBudgetBytes,
    };
  }

  private async mangaInventory(): Promise<MangaInventoryFile[]> {
    const result: MangaInventoryFile[] = [];
    // A missing/invalid identity is counted conservatively and never grants deletion.
    for (const root of [this.rootDirectory(), this.legacyRootDirectory()]) {
      if (await fileIo.access(root)) await this.collectMangaFiles(root, [], result);
    }
    if (this.mangaExternal !== undefined) {
      for (const file of await this.mangaExternal.inventory()) {
        if (!file.path.startsWith(`${this.context.filesDir}/`) || file.path.split('/').indexOf('..') >= 0) throw new Error('manga external path escapes app storage');
        if (!(await fileIo.access(file.path))) continue;
        const stat = await fileIo.stat(file.path);
        if (!stat.isFile()) continue;
        result.push({ ...file, size: stat.size, physicalKey: this.mangaPhysicalKey(stat), external: true });
      }
    }
    return result;
  }

  private async collectMangaFiles(directory: string, inheritedOwners: MangaStorageChapter[], result: MangaInventoryFile[]): Promise<void> {
    let owners = inheritedOwners;
    const identityPath = `${directory}/manga-identity.json`;
    if (await fileIo.access(identityPath)) {
      try {
        const raw = await this.readMangaMetadata(identityPath, MANGA_IDENTITY_METADATA_BYTES);
        const value = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(raw)) as MangaStorageChapter;
        this.assertMangaStorageChapter(value);
        const expected = `${this.rootDirectory()}/${await this.bookHash(value.sourceId, value.bookId)}/.manga/` +
          `${await this.sha256(value.chapterId)}/${await this.sha256(value.contentVersion)}`;
        owners = expected === directory ? [value] : [];
      } catch (_) { owners = []; }
    } else if (owners.length === 0) {
      const manifest = await this.readManifestIdentity(directory, CACHE_FORMAT_VERSION, undefined, true) ??
        await this.readManifestIdentity(directory, LEGACY_CACHE_FORMAT_VERSION, undefined, true);
      if (manifest !== undefined && manifest.manga !== true) return;
    }
    for (const name of await fileIo.listFile(directory)) {
      const path = `${directory}/${name}`;
      if (!(await fileIo.access(path))) continue;
      const stat = await fileIo.stat(path);
      if (stat.isDirectory()) await this.collectMangaFiles(path, owners, result);
      else if (stat.isFile()) {
        // Exact novel manifests keep their existing quota policy. Unknown old
        // manga bytes remain protected, even when their ordinal is recognizable.
        result.push({ path, owners, live: false, size: stat.size, physicalKey: this.mangaPhysicalKey(stat), external: false });
      }
    }
  }

  private mangaPhysicalKey(stat: fileIo.Stat): string {
    // All inventory roots, including external display files, are confined to
    // this private filesDir on the same app-data volume. The public SDK exposes
    // bigint ino, not POSIX dev. Keep the sandbox namespace plus its exact inode
    // so hard-linked originals/display files still share one physical owner.
    return `${this.context.filesDir}:${stat.ino}`;
  }

  private async evictMangaCandidates(reason: MangaStorageReason, scope?: MangaStorageScope, enough?: () => Promise<boolean>, batched: boolean = false): Promise<void> {
    const authority = this.mangaAuthority;
    if (authority === undefined || this.closed) return;
    const epoch = this.mangaStorageEpoch;
    const current = (): boolean => !this.closed && epoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0 && !this.mangaRestoreBlocked;
    const pending = await authority.pending();
    for (const grant of pending) {
      if (!current()) return;
      if (scope !== undefined && (grant.sourceId !== scope.sourceId || grant.bookId !== scope.bookId)) continue;
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        if (!current() || this.bookMutationTails.has(this.bookMutationKey(grant.sourceId, grant.bookId))) return;
        if (batched && !(await authority.pending()).some(latest => latest.grantToken === grant.grantToken &&
          this.mangaChapterKey(latest) === this.mangaChapterKey(grant))) return;
        await this.removeMangaGrant(grant, current);
      });
      if (batched) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
    }
    if (enough !== undefined && await enough()) return;
    const candidates = await authority.candidates(reason, scope);
    const classSnapshot = new Map(candidates.map((candidate, index) => [this.mangaChapterKey(candidate), index]));
    const policySnapshot = candidates.length > 0 && reason === 'expiry' && authority.policyBatch !== undefined ?
      await this.mangaAuthorityPolicySnapshot(candidates) : undefined;
    if (policySnapshot !== undefined && policySnapshot.length !== candidates.length) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
    const classes = candidates.length === 0 ? [] : policySnapshot?.map(policy => policy.status) ??
      (authority.classifyBatch === undefined ? undefined : await this.mangaAuthorityClassSnapshot(candidates));
    if (classes !== undefined && classes.length !== candidates.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
    for (const candidate of candidates) {
      if (!current()) return;
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        const key = this.mangaChapterKey(candidate);
        if (!current() || this.mangaBusy.has(key) || this.mangaEvicting.has(key)) return;
        if (this.bookMutationTails.has(this.bookMutationKey(candidate.sourceId, candidate.bookId))) return;
        const index = classSnapshot?.get(key);
        const classification = classes === undefined || index === undefined ? await authority.classify(candidate) : classes[index];
        if (classification !== 'cache') return;
        const expiry: MangaExpiryGuard | undefined = reason === 'expiry' ?
          { nowSeconds: Math.floor(Date.now() / 1000), ttlSeconds: MANGA_READ_TTL_SECONDS } : undefined;
        if (expiry !== undefined && (policySnapshot !== undefined || authority.policy !== undefined)) {
          const policy = policySnapshot === undefined || index === undefined ? await authority.policy!(candidate) : policySnapshot[index];
          if (policy.status !== 'cache' || policy.inUse !== false || (policy.lastReadAt !== null &&
            (!Number.isSafeInteger(policy.lastReadAt) || policy.lastReadAt < 0 ||
              policy.lastReadAt >= expiry.nowSeconds - expiry.ttlSeconds))) return;
        }
        if (!current() || this.mangaBusy.has(key)) return;
        this.mangaClaiming.add(key);
        let grant: MangaStorageGrant | undefined;
        try { grant = await authority.claim(candidate, expiry); }
        finally { this.mangaClaiming.delete(key); }
        if (grant === undefined) return;
        if (this.mangaChapterKey(grant) !== key || grant.grantToken.trim().length === 0) throw new Error('invalid manga eviction grant');
        this.mangaEvicting.set(key, grant);
        await this.removeMangaGrant(grant, current);
      });
      if (enough !== undefined && await enough()) return;
      if (batched) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
    }
    if (!current()) return;
    await this.trimMangaDownloadDerived(reason, scope, enough, batched);
  }

  private mangaDerivedPolicyEligible(policy: MangaStoragePolicy, reason: MangaStorageReason): boolean {
    // Explicit cache cleanup may reclaim a derived alias for either a normal
    // cache chapter or a downloaded chapter.  Expiry/pressure stay narrower:
    // they only trim idle derivatives of permanent downloads and never infer
    // ownership for ordinary originals.
    if ((reason === 'clear' ? (policy.status !== 'cache' && policy.status !== 'download') : policy.status !== 'download') ||
      policy.inUse !== false) return false;
    if (policy.lastReadAt !== null && (!Number.isSafeInteger(policy.lastReadAt) || policy.lastReadAt < 0)) return false;
    return reason !== 'expiry' || policy.lastReadAt === null ||
      policy.lastReadAt < Math.floor(Date.now() / 1000) -
      (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS);
  }

  private async mangaCleanableBytes(files: MangaInventoryFile[]): Promise<number> {
    const physical = await this.mangaCleanablePhysicalKeys(files);
    const sizes = new Map<string, number>();
    for (const file of files) if (physical.has(file.physicalKey))
      sizes.set(file.physicalKey, Math.max(file.size, sizes.get(file.physicalKey) ?? 0));
    return Array.from(sizes.values()).reduce((sum, bytes) => sum + bytes, 0);
  }

  private async mangaCleanablePhysicalKeys(files: MangaInventoryFile[]): Promise<Set<string>> {
    const authority = this.mangaAuthority;
    if (authority?.policy === undefined || files.length === 0) return new Set<string>();
    const ordinaryCandidates = new Set((await authority.candidates('clear')).map(chapter => this.mangaChapterKey(chapter)));
    const chapters = new Map<string, MangaStorageChapter>();
    for (const file of files) if (file.external) for (const owner of file.owners)
      chapters.set(this.mangaChapterKey(owner), owner);
    const chapterValues = Array.from(chapters.values());
    let values: MangaStoragePolicy[];
    if (authority.policyBatch !== undefined) {
      values = await this.mangaAuthorityPolicySnapshot(chapterValues) ?? [];
    } else {
      // Compatibility authorities may expose only the single-chapter seam.
      // Keep the fallback bounded so a large shelf cannot create one promise
      // per chapter during a storage-page refresh.
      values = new Array<MangaStoragePolicy>(chapterValues.length);
      const batchSize = 32;
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < chapterValues.length) {
          const start = next; next = Math.min(chapterValues.length, next + batchSize);
          const batch = chapterValues.slice(start, next);
          const result = await Promise.all(batch.map(chapter => authority.policy!(chapter)));
          result.forEach((value, offset): void => { values[start + offset] = value; });
        }
      };
      await Promise.all([worker(), worker()]);
    }
    if (values.length !== chapters.size) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
    const eligible = new Set<string>();
    Array.from(chapters.keys()).forEach((key, index): void => {
      const policy = values[index];
      if (this.mangaDerivedPolicyEligible(policy, 'clear')) eligible.add(key);
    });
    const physical = new Set<string>();
    const isEligible = (file: MangaInventoryFile): boolean => {
      if (file.live || this.inFlightWrites.has(file.path) || file.owners.length === 0) return false;
      const ownersEligible = file.external ?
        file.owners.every(owner => eligible.has(this.mangaChapterKey(owner))) :
        file.owners.every(owner => ordinaryCandidates.has(this.mangaChapterKey(owner)));
      if (!ownersEligible) return false;
      return !file.owners.some(owner => {
        const key = this.mangaChapterKey(owner);
        return this.mangaBusy.has(key) || this.mangaEvicting.has(key) || this.mangaClaiming.has(key) ||
          this.bookMutationTails.has(this.bookMutationKey(owner.sourceId, owner.bookId));
      });
    };
    for (const file of files) {
      if (!isEligible(file) || files.some(alias => alias.physicalKey === file.physicalKey && !isEligible(alias)) ||
        physical.has(file.physicalKey)) continue;
      physical.add(file.physicalKey);
    }
    return physical;
  }

  private mangaDerivedDeletionFiles(chapter: MangaStorageChapter, files: MangaInventoryFile[]): MangaExternalFile[] | undefined {
    const key = this.mangaChapterKey(chapter);
    const matching = files.filter(file => file.external && file.owners.some(owner => this.mangaChapterKey(owner) === key));
    if (matching.length === 0) return undefined;
    for (const file of matching) {
      if (file.live || this.inFlightWrites.has(file.path) || file.owners.some(owner => this.mangaChapterKey(owner) !== key)) return undefined;
      // Even an exact derived alias must not unlink physical bytes shared with
      // an original, unknown historical owner, or another live consumer.
      if (files.some(alias => alias.physicalKey === file.physicalKey && (!alias.external || alias.live ||
        alias.owners.length === 0 || alias.owners.some(owner => this.mangaChapterKey(owner) !== key)))) return undefined;
    }
    return matching;
  }

  /** Ordinary Core candidates keep their LRU ordering. Only after that pass,
   * trim idle, reconstructable download display files from actual inventory.
   * No full Core snapshot, original tombstone, read-clock update or new LRU. */
  private async trimMangaDownloadDerived(reason: MangaStorageReason, scope?: MangaStorageScope, enough?: () => Promise<boolean>, batched: boolean = false): Promise<void> {
    const authority = this.mangaAuthority;
    const external = this.mangaExternal;
    if (authority?.policy === undefined || external?.removeDerived === undefined || this.closed) return;
    const epoch = this.mangaStorageEpoch;
    if (enough !== undefined && await enough()) return;
    const candidates = new Map<string, MangaStorageChapter>();
    for (const file of await this.mangaInventory()) if (file.external) for (const owner of file.owners) {
      if (scope === undefined || (owner.sourceId === scope.sourceId && owner.bookId === scope.bookId)) {
        candidates.set(this.mangaChapterKey(owner), owner);
      }
    }
    for (const chapter of candidates.values()) {
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        const key = this.mangaChapterKey(chapter);
        const bookKey = this.bookMutationKey(chapter.sourceId, chapter.bookId);
        if (this.mangaBusy.has(key) || this.mangaEvicting.has(key) || this.mangaClaiming.has(key) || this.bookMutationTails.has(bookKey)) return;
        const current = async (): Promise<boolean> => {
          if (this.closed || epoch !== this.mangaStorageEpoch || this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked ||
            this.mangaBusy.has(key) || this.mangaEvicting.has(key)) return false;
          const policy = await authority.policy!(chapter);
          return !this.closed && epoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0 && !this.mangaRestoreBlocked &&
            !this.mangaBusy.has(key) && !this.mangaEvicting.has(key) && this.mangaDerivedPolicyEligible(policy, reason);
        };
        // This fence is temporary and local; downloaded originals never get an
        // eviction claim or durable unreadable marker from derived maintenance.
        this.mangaClaiming.add(key);
        try {
          if (!(await current())) return;
          await this.enqueueBookMutation(bookKey, async (): Promise<void> => {
            if (!(await current())) return;
            const selected = this.mangaDerivedDeletionFiles(chapter, await this.mangaInventory());
            if (selected === undefined || !(await current())) return;
            this.inFlightWriteRevision += 1;
            await external.removeDerived!(chapter, selected, current);
          });
        } catch (_) {
          // The display adapter retains owner sidecars until its payloads are
          // removed; a later foreground/pressure pass can retry a partial failure.
        } finally { this.mangaClaiming.delete(key); }
      });
      if (enough !== undefined && await enough()) return;
      if (batched) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
    }
  }

  private mangaDeletionFiles(chapter: MangaStorageChapter, files: MangaInventoryFile[]): MangaInventoryFile[] | undefined {
    const key = this.mangaChapterKey(chapter);
    const matching = files.filter(file => file.owners.some(owner => this.mangaChapterKey(owner) === key));
    for (const file of matching) {
      if (file.live || file.owners.some(owner => this.mangaChapterKey(owner) !== key) || this.inFlightWrites.has(file.path)) return undefined;
      if (files.some(alias => alias.physicalKey === file.physicalKey &&
        (alias.live || alias.owners.length === 0 || alias.owners.some(owner => this.mangaChapterKey(owner) !== key)))) return undefined;
    }
    return matching;
  }

  private async removeMangaGrant(grant: MangaStorageGrant, isCurrent?: () => boolean): Promise<boolean> {
    const key = this.mangaChapterKey(grant);
    this.mangaEvicting.set(key, grant);
    const authority = this.mangaAuthority;
    if (authority === undefined) return false;
    let removed = false;
    try {
      if (this.mangaBusy.has(key) || isCurrent?.() === false) return false;
      await this.enqueueBookMutation(this.bookMutationKey(grant.sourceId, grant.bookId), async (): Promise<void> => {
        if (this.mangaBusy.has(key) || isCurrent?.() === false) return;
        const files = await this.mangaInventory();
        const matching = this.mangaDeletionFiles(grant, files);
        if (matching === undefined || isCurrent?.() === false) return;
        const external = matching.filter(file => file.external);
        // Do not hold a display mutation lock during a Core operation.
        if (external.length > 0) {
          this.inFlightWriteRevision += 1;
          if (this.mangaExternal === undefined || !(await this.mangaExternal.remove(grant, external))) return;
        }
        for (const file of matching) if (!file.external && !file.path.endsWith('/manga-identity.json')) {
          this.verifiedDigests.remove(file.path); await this.unlinkIfPresent(file.path);
        }
        for (const file of matching) if (!file.external && file.path.endsWith('/manga-identity.json')) await this.unlinkIfPresent(file.path);
        removed = true;
      });
    } catch (_) { removed = false; }
    finally {
      await authority.complete(grant, removed);
      if (removed) this.mangaEvicting.delete(key);
    }
    return removed;
  }

  /** Capture before a network request; a later clear/close cannot admit its bytes. */
  captureValidity(sourceId: string, bookId: string, isCurrent?: () => boolean): () => boolean {
    const key = this.bookMutationKey(sourceId, bookId);
    const generation = this.bookClearGenerations.get(key) ?? 0;
    const mangaEpoch = this.mangaStorageEpoch;
    return (): boolean => !this.closed && (this.bookClearGenerations.get(key) ?? 0) === generation &&
      (!this.mangaBooks.has(key) || (mangaEpoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0 && !this.mangaRestoreBlocked)) &&
      (isCurrent === undefined || isCurrent());
  }

  close(): void {
    this.closed = true; this.verifiedDigests.clear();
  }

  private async loadTextResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<Uint8Array | undefined> {
    this.assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    let result: Uint8Array | undefined;
    await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const path = await this.resourcePath(requestedIdentity);
      const legacyRevocation = `${await this.clearMarkerPath(requestedIdentity.sourceId, requestedIdentity.bookId)}.legacy-revoked`;
      // An old clear cannot delete unidentifiable bytes, but it also cannot
      // admit them again. Fresh text writes carry their own exact ownership.
      if (!(await fileIo.access(legacyRevocation)) || await this.ownsTextResource(requestedIdentity)) {
        result = await this.readResourceBytes(path);
      }
      if (result === undefined && this.hasUnambiguousLegacyResourceIdentity(requestedIdentity) &&
        !(await fileIo.access(legacyRevocation))) {
        // A legacy ordinal alone is never evidence. Only its exact manifest
        // identity/version and listed resource hash authorize byte migration.
        const directory = await this.legacyChapterDirectory(requestedIdentity);
        const manifest = await this.readValidManifest(directory, LEGACY_CACHE_FORMAT_VERSION);
        const hash = await this.legacyResourceHash(requestedIdentity);
        if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) &&
          manifest.resourceHashes.indexOf(hash) >= 0) {
          result = await this.readResourceBytes(`${directory}/${hash}.bin`);
          if (result !== undefined) {
            const target = await this.chapterDirectory(requestedIdentity);
            await this.ensureDirectory(target);
            await this.assertWriteCapacity(target, result.byteLength);
            await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
            await this.writeAtomicBytes(path, result, isCurrent);
          }
        }
      }
      this.assertCurrent(isCurrent);
    });
    return result;
  }

  async loadResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<Uint8Array | undefined> {
    if (this.mangaChapter(identity) === undefined && identity.mangaDecodeRevision === undefined)
      return this.loadTextResource(identity, isCurrent);
    this.assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const unpin = this.beginMangaOperation(requestedIdentity);
    let result: Uint8Array | undefined;
    let migrationBytes: Uint8Array | undefined;
    try {
      await this.assertMangaAdmission(requestedIdentity);
      await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
        this.assertCurrent(isCurrent);
        await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
        const directory = await this.chapterDirectory(requestedIdentity);
        const path = await this.resourcePath(requestedIdentity);
        result = await this.readMangaResourceBytes(requestedIdentity, directory, path, isCurrent);
        const oldDirectory = await this.ordinalChapterDirectory(requestedIdentity);
        if (result === undefined && directory !== oldDirectory) {
          const manifest = await this.readValidManifest(oldDirectory, CACHE_FORMAT_VERSION,
            this.mangaCacheProfile(requestedIdentity.mangaDecodeRevision), isCurrent, true);
          const resourceHash = await this.resourceHash(requestedIdentity);
          if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) &&
            manifest.manga === true && manifest.resourceHashes.indexOf(resourceHash) >= 0) {
            result = await this.readMangaResourceBytes(requestedIdentity, oldDirectory, `${oldDirectory}/${resourceHash}.bin`, isCurrent);
            if (result !== undefined) migrationBytes = result;
          }
        }
        if (result === undefined && this.mangaCacheProfile(requestedIdentity.mangaDecodeRevision) !== undefined &&
          (await this.validResourceFile(`${directory}/${await this.legacyMangaResourceHash(requestedIdentity)}.bin`) ||
            await this.validResourceFile(`${oldDirectory}/${await this.legacyMangaResourceHash(requestedIdentity)}.bin`))) {
          this.assertCurrent(isCurrent); throw new Error('READING_IMAGE_REPROCESS_REQUIRED');
        }
        const legacyRevocation = `${await this.clearMarkerPath(requestedIdentity.sourceId, requestedIdentity.bookId)}.legacy-revoked`;
        if (result === undefined && this.hasUnambiguousLegacyResourceIdentity(requestedIdentity) && !(await fileIo.access(legacyRevocation))) {
          const legacy = await this.legacyChapterDirectory(requestedIdentity);
          const manifest = await this.readValidManifest(legacy, LEGACY_CACHE_FORMAT_VERSION);
          const hash = await this.legacyResourceHash(requestedIdentity);
          if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) && manifest.resourceHashes.indexOf(hash) >= 0) {
            result = await this.readResourceBytes(`${legacy}/${hash}.bin`);
            if (result !== undefined) {
              await this.ensureDirectory(directory); await this.assertWriteCapacity(directory, result.byteLength);
              await this.writeAtomicBytes(path, result, isCurrent);
            }
          }
        }
        this.assertCurrent(isCurrent);
      });
      if (migrationBytes !== undefined) await this.migrateMangaResource(requestedIdentity,
        await this.resourcePath(requestedIdentity), migrationBytes, isCurrent);
    } finally { unpin(); }
    return result;
  }

  private beginMangaOperation(identity: ReadingImageChapterIdentity): () => void {
    if (identity.mangaDecodeRevision !== undefined) this.mangaBooks.add(this.bookMutationKey(identity.sourceId, identity.bookId));
    const chapter = this.mangaChapter(identity);
    return chapter === undefined ? (): void => {} : this.pinMangaChapter(chapter);
  }

  private async assertMangaAdmission(identity: ReadingImageChapterIdentity): Promise<void> {
    const chapter = this.mangaChapter(identity);
    if (chapter === undefined) return;
    await this.mangaAuthorityReady;
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    if (this.mangaEvicting.has(this.mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
  }

  private async readMangaResourceBytes(identity: ReadingImageCacheIdentity, directory: string, path: string,
    isCurrent: () => boolean): Promise<Uint8Array | undefined> {
    if (identity.resourceRef !== undefined && await this.validResourceFile(path)) {
      const hash = await this.resourceHash(identity);
      const manifest = await this.readManifestIdentity(directory, CACHE_FORMAT_VERSION, this.mangaCacheProfile(identity.mangaDecodeRevision), true, isCurrent);
      const partialDigest = `${path}.sha256`;
      let expected: string | undefined;
      if (manifest !== undefined && this.sameChapter(manifest, identity) && manifest.manga === true && manifest.resourceHashes.indexOf(hash) >= 0) {
        expected = manifest.resourceDigests?.[hash];
      } else if (await fileIo.access(partialDigest)) {
        expected = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(await this.readMangaMetadata(partialDigest, 64, isCurrent));
      }
      if (expected !== undefined && (!/^[0-9a-f]{64}$/.test(expected) || !(await this.matchesResourceDigest(path, expected, isCurrent)))) throw new Error('MANGA_CACHE_RESOURCE_CORRUPT');
      if (manifest?.manga === true && expected === undefined) throw new Error('MANGA_CACHE_RESOURCE_CORRUPT');
    }
    return this.readResourceBytes(path, identity.resourceRef !== undefined, isCurrent);
  }

  private async migrateMangaResource(identity: ReadingImageCacheIdentity, path: string, bytes: Uint8Array, valid: () => boolean): Promise<void> {
    const chapter = this.mangaChapter(identity);
    const reservation = chapter === undefined ? undefined : await this.reserveExternalWrite(chapter, bytes.byteLength + this.mangaIdentityBytes(chapter).byteLength + 64, identity.priority);
    try {
      await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      const directory = await this.chapterDirectory(identity); await this.ensureDirectory(directory);
      if (chapter !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, this.mangaIdentityBytes(chapter), valid);
      await this.assertWriteCapacity(directory, bytes.byteLength, chapter !== undefined); await this.writeAtomicBytes(path, bytes, valid);
      await this.writeAtomicBytes(`${path}.sha256`, new util.TextEncoder().encodeInto(await this.sha256Bytes(bytes)), valid);
      });
    } finally { reservation?.release(); }
  }

  private mangaIdentityBytes(chapter: MangaStorageChapter): Uint8Array {
    return new util.TextEncoder().encodeInto(JSON.stringify(chapter));
  }

  async storeResource(
    identity: ReadingImageCacheIdentity,
    bytes: Uint8Array,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<void> {
    this.assertResourceIdentity(identity);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`offline reading image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const payload = bytes.slice();
    const chapter = this.mangaChapter(requestedIdentity);
    const identityBytes = chapter === undefined ? undefined : this.mangaIdentityBytes(chapter);
    const reservation = chapter === undefined ? undefined : await this.reserveExternalWrite(chapter,
      payload.byteLength + (identityBytes?.byteLength ?? 0) + 64, identity.priority);
    const unpin = chapter === undefined ? this.beginMangaOperation(requestedIdentity) : (): void => {};
    try { await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const directory = await this.chapterDirectory(requestedIdentity);
      await this.ensureDirectory(directory);
      if (chapter === undefined && requestedIdentity.mangaDecodeRevision === undefined)
        await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
      if (identityBytes !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, identityBytes, isCurrent);
      await this.assertWriteCapacity(directory, payload.byteLength, chapter !== undefined);
      const path = await this.resourcePath(requestedIdentity);
      await this.writeAtomicBytes(path, payload, isCurrent);
      if (chapter !== undefined) await this.writeAtomicBytes(`${path}.sha256`, new util.TextEncoder().encodeInto(await this.sha256Bytes(payload)), isCurrent);
    }); } finally { unpin(); reservation?.release(); }
  }

  async removeResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<void> {
    this.assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const unpin = this.beginMangaOperation(requestedIdentity);
    try { await this.assertMangaAdmission(requestedIdentity);
      await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const path = await this.resourcePath(requestedIdentity);
      this.verifiedDigests.remove(path);
      await this.unlinkIfPresent(path);
      await this.unlinkIfPresent(`${path}.sha256`);
      // Do not permit a corrupt migrated resource to be loaded again from v1.
      const legacyDirectory = await this.legacyChapterDirectory(requestedIdentity);
      const manifest = await this.readValidManifest(legacyDirectory, LEGACY_CACHE_FORMAT_VERSION);
      const hash = await this.legacyResourceHash(requestedIdentity);
      if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) &&
        this.hasUnambiguousLegacyResourceIdentity(requestedIdentity) && manifest.resourceHashes.indexOf(hash) >= 0) {
        await this.unlinkIfPresent(`${legacyDirectory}/${hash}.bin`);
      }
    }); } finally { unpin(); }
  }

  async markChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
    isCurrent: () => boolean = this.captureValidity(chapter.sourceId, chapter.bookId),
  ): Promise<void> {
    this.assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const requestedResources = resources.map((resource: ReadingImageCacheIdentity): ReadingImageCacheIdentity => ({ ...resource }));
    const mangaChapter = this.mangaChapter(requestedChapter);
    const identityBytes = mangaChapter === undefined ? undefined : this.mangaIdentityBytes(mangaChapter);
    const reservation = mangaChapter === undefined ? undefined : await this.reserveExternalWrite(mangaChapter,
      (identityBytes?.byteLength ?? 0) * 2 + requestedResources.length * 220 + 1024, chapter.priority);
    const unpin = mangaChapter === undefined ? this.beginMangaOperation(requestedChapter) : (): void => {};
    try { await this.enqueueBookMutation(this.bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      const resourceHashes: string[] = [];
      const manga = requestedResources.some(resource => resource.resourceRef !== undefined);
      if (manga && requestedChapter.mangaDecodeRevision === undefined) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
      const profile = this.mangaCacheProfile(requestedChapter.mangaDecodeRevision);
      if (manga && requestedResources.some(resource => resource.resourceRef === undefined)) throw new Error('mixed manga resource manifest');
      const resourceDigests: Record<string, string> = {};
      const directory = await this.chapterDirectory(requestedChapter);
      for (const resource of requestedResources) {
        this.assertResourceIdentity(resource);
        this.assertSameChapter(requestedChapter, resource);
        if (manga && resource.mangaDecodeRevision !== requestedChapter.mangaDecodeRevision) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
        const hash = await this.resourceHash(resource);
        if (!(await this.validResourceFile(`${directory}/${hash}.bin`))) {
          throw new Error('offline reading image manifest cannot reference missing bytes');
        }
        if (manga) {
          const bytes = await this.readResourceBytes(`${directory}/${hash}.bin`, true, isCurrent);
          if (bytes === undefined) throw new Error('offline manga bytes disappeared');
          resourceDigests[hash] = await this.sha256Bytes(bytes);
        }
        if (resourceHashes.indexOf(hash) < 0) resourceHashes.push(hash);
      }
      resourceHashes.sort();
      const manifest: ReadingImageChapterManifest = {
        formatVersion: CACHE_FORMAT_VERSION,
        sourceId: requestedChapter.sourceId,
        bookId: requestedChapter.bookId,
        chapterIndex: requestedChapter.chapterIndex,
        contentVersion: requestedChapter.contentVersion,
        resourceHashes,
        completedAt: Date.now(),
      };
      if (requestedChapter.chapterId !== undefined && manga) manifest.chapterId = requestedChapter.chapterId;
      if (manga) { manifest.manga = true; manifest.resourceDigests = resourceDigests; }
      if (profile !== undefined) manifest.mangaCacheProfile = profile;
      await this.ensureDirectory(directory);
      if (identityBytes !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, identityBytes, isCurrent);
      const manifestBytes = new util.TextEncoder().encodeInto(JSON.stringify(manifest));
      await this.assertWriteCapacity(directory, manifestBytes.byteLength, mangaChapter !== undefined);
      await this.writeAtomicBytes(this.manifestPath(directory, profile), manifestBytes, isCurrent);
      // Publication never reclaims another version (or an active display's
      // resources). Only an explicit Core-first book clear owns that decision.
    }); } finally { unpin(); reservation?.release(); }
  }

  async isChapterComplete(chapter: ReadingImageChapterIdentity): Promise<boolean> {
    this.assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const isCurrent = this.captureValidity(chapter.sourceId, chapter.bookId);
    let complete = false;
    const unpin = this.beginMangaOperation(requestedChapter);
    try { await this.assertMangaAdmission(requestedChapter);
      await this.enqueueBookMutation(this.bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      let value = await this.readValidManifest(await this.chapterDirectory(requestedChapter), CACHE_FORMAT_VERSION,
        this.mangaCacheProfile(requestedChapter.mangaDecodeRevision), isCurrent, requestedChapter.mangaDecodeRevision !== undefined);
      if (value === undefined && this.mangaChapter(requestedChapter) !== undefined) value = await this.readValidManifest(
        await this.ordinalChapterDirectory(requestedChapter), CACHE_FORMAT_VERSION, this.mangaCacheProfile(requestedChapter.mangaDecodeRevision), isCurrent, true);
      this.assertCurrent(isCurrent);
      complete = value !== undefined && this.sameChapter(value, requestedChapter) &&
        (value.manga !== true || requestedChapter.mangaDecodeRevision !== undefined);
    }); } finally { unpin(); }
    return complete;
  }

  /** An ordinal without a body version cannot prove the current catalog's assets. */
  async isChapterMaterialized(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean> {
    this.assertNonBlank(sourceId, 'sourceId');
    this.assertNonBlank(bookId, 'bookId');
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
      throw new Error('chapterIndex must be a non-negative safe integer');
    }
    // Core must supply its stable chapter/body scope before this projection
    // can report completeness. Exact version checks remain available above.
    return false;
  }

  private async readValidManifest(directory: string, formatVersion: number, profile?: string,
    isCurrent: () => boolean = (): boolean => !this.closed, manga: boolean = false): Promise<ReadingImageChapterManifest | undefined> {
    try {
      const value = await this.readManifestIdentity(directory, formatVersion, profile, manga, isCurrent);
      if (value === undefined || !Array.isArray(value.resourceHashes) ||
        (!manga && profile === undefined && !this.isTextOwnership(value))) return undefined;
      for (const hash of value.resourceHashes) {
        if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
          !(await this.validResourceFile(`${directory}/${hash}.bin`))) return undefined;
        if (value.manga === true) {
          const expected = value.resourceDigests?.[hash];
          if (expected === undefined || !/^[0-9a-f]{64}$/.test(expected) ||
            !(await this.matchesResourceDigest(`${directory}/${hash}.bin`, expected, isCurrent))) return undefined;
        }
      }
      return value;
    } catch (_) {
      return undefined;
    }
  }

  /** Second-resolution stat values cannot safely cache same-size writes. */
  private async resourceFingerprint(path: string): Promise<string | undefined> {
    const stat = await fileIo.stat(path);
    if (!stat.isFile() || typeof stat.mtimeNs !== 'bigint' || typeof stat.ctimeNs !== 'bigint') return undefined;
    return `${stat.ino.toString()}:${stat.size}:${stat.mtimeNs.toString()}:${stat.ctimeNs.toString()}`;
  }

  private async matchesResourceDigest(path: string, expected: string,
    isCurrent: () => boolean = (): boolean => !this.closed): Promise<boolean> {
    this.assertCurrent(isCurrent);
    const before = await this.resourceFingerprint(path);
    const verified = this.verifiedDigests.get(path);
    if (before !== undefined && verified?.fingerprint === before && verified.digest === expected) {
      this.assertCurrent(isCurrent); return true;
    }
    this.verifiedDigests.remove(path);
    const bytes = await this.readResourceBytes(path, true, isCurrent);
    if (bytes === undefined || await this.sha256Bytes(bytes) !== expected) return false;
    const after = await this.resourceFingerprint(path);
    this.assertCurrent(isCurrent);
    if (before !== undefined && after !== before) return false;
    if (after !== undefined && before === after) this.verifiedDigests.put(path, { fingerprint: after, digest: expected });
    return true;
  }

  private async readMangaMetadata(path: string, maximumBytes: number,
    isCurrent: () => boolean = (): boolean => !this.closed): Promise<Uint8Array> {
    this.assertCurrent(isCurrent);
    const stat = await fileIo.stat(path);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maximumBytes) throw new Error('MANGA_ATOMIC_PAYLOAD_BUDGET');
    const bytes = await readMangaAtomicPayload(path, stat.size, maximumBytes, isCurrent, true);
    this.assertCurrent(isCurrent);
    return bytes;
  }

  private async readTextManifestIdentity(directory: string, formatVersion: number, fileName: string = 'manifest.json',
    retryIoErrors: boolean = false): Promise<ReadingImageChapterManifest | undefined> {
    const path = `${directory}/${fileName}`;
    if (!(await fileIo.access(path))) return undefined;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(new fileIo.AtomicFile(path).readFully());
    } catch (error) {
      if (retryIoErrors) throw error;
      return undefined;
    }
    try {
      const raw = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
      const value = JSON.parse(raw) as ReadingImageChapterManifest;
      if (value.formatVersion !== formatVersion || typeof value.sourceId !== 'string' ||
        typeof value.bookId !== 'string' || !Number.isSafeInteger(value.chapterIndex) || value.chapterIndex < 0 ||
        typeof value.contentVersion !== 'string' || value.contentVersion.trim().length === 0) return undefined;
      return value;
    } catch (_) {
      return undefined;
    }
  }

  private async readManifestIdentity(directory: string, formatVersion: number, profile?: string,
    manga: boolean = false, isCurrent: () => boolean = (): boolean => !this.closed): Promise<ReadingImageChapterManifest | undefined> {
    const path = this.manifestPath(directory, profile);
    if (!(await fileIo.access(path))) return undefined;
    let bytes: Uint8Array;
    try {
      const bytes = manga || directory.includes('/.manga/') || profile !== undefined ?
        await this.readMangaMetadata(path, MANGA_MANIFEST_METADATA_BYTES, isCurrent) :
        new Uint8Array(new fileIo.AtomicFile(path).readFully());
      const raw = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
      const value = JSON.parse(raw) as ReadingImageChapterManifest;
      if (value.mangaCacheProfile !== profile || value.formatVersion !== formatVersion || typeof value.sourceId !== 'string' ||
        typeof value.bookId !== 'string' || !Number.isSafeInteger(value.chapterIndex) || value.chapterIndex < 0 ||
        typeof value.contentVersion !== 'string' || value.contentVersion.trim().length === 0) return undefined;
      return value;
    } catch (_) {
      return undefined;
    }
  }

  /** Called only after Core has invalidated the corresponding usable refs. */
  async clearBook(sourceId: string, bookId: string, manga: boolean = false): Promise<void> {
    this.assertNonBlank(sourceId, 'sourceId');
    this.assertNonBlank(bookId, 'bookId');
    const key = this.bookMutationKey(sourceId, bookId);
    if (manga) {
      this.mangaBooks.add(key);
      // Ordinary clear never turns a Core candidate into blanket book deletion.
      await this.maintainMangaStorage('clear', { sourceId, bookId });
      return;
    }
    this.bookClearGenerations.set(key, (this.bookClearGenerations.get(key) ?? 0) + 1);
    await this.enqueueBookMutation(key, async (): Promise<void> => {
      const directory = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}`;
      for (const proofPath of this.verifiedDigests.keys()) if (proofPath.startsWith(`${directory}/`)) this.verifiedDigests.remove(proofPath);
      const marker = await this.clearMarkerPath(sourceId, bookId);
      await this.ensureDirectory(`${this.rootDirectory()}/.clear`);
      // Keep this small durable intent until deletion finishes. After a crash,
      // reads/writes resume the already-authorized deletion before admission.
      await this.writeAtomicBytes(marker, new util.TextEncoder().encodeInto('clear'));
      await this.finishPendingClear(sourceId, bookId);
    });
    // Record/recover the exact text clear before inspecting historical manga
    // owners: an ownership I/O failure must retain the durable pending intent.
    if (await this.isMangaBook(sourceId, bookId)) await this.maintainMangaStorage('clear', { sourceId, bookId });
  }

  /** Core and the download coordinator revoke the exact text consumer first.
   * A durable chapter intent shares the existing book mutation serialization. */
  async clearChapter(sourceId: string, bookId: string, chapterIndex: number): Promise<void> {
    this.assertNonBlank(sourceId, 'sourceId'); this.assertNonBlank(bookId, 'bookId');
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) throw new Error('invalid chapterIndex');
    const key = this.bookMutationKey(sourceId, bookId);
    this.bookClearGenerations.set(key, (this.bookClearGenerations.get(key) ?? 0) + 1);
    await this.enqueueBookMutation(key, async (): Promise<void> => {
      await this.ensureDirectory(`${this.rootDirectory()}/.clear`);
      const marker = `${await this.clearMarkerPath(sourceId, bookId)}.chapter-${chapterIndex}`;
      await this.writeAtomicBytes(marker, new util.TextEncoder().encodeInto('clear'));
      await this.finishPendingChapterClears(sourceId, bookId);
    });
  }

  private async finishPendingChapterClears(sourceId: string, bookId: string): Promise<void> {
    const clearRoot = `${this.rootDirectory()}/.clear`;
    if (!(await fileIo.access(clearRoot))) return;
    const prefix = `${await this.bookHash(sourceId, bookId)}.pending.chapter-`;
    for (const name of await fileIo.listFile(clearRoot)) {
      if (!name.startsWith(prefix) || !/^(0|[1-9][0-9]*)$/.test(name.substring(prefix.length))) continue;
      const ordinal = name.substring(prefix.length);
      const chapter = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}/${ordinal}`;
      if (await fileIo.access(chapter)) {
        for (const version of await fileIo.listFile(chapter)) {
          if (!/^[0-9a-f]{64}$/.test(version)) continue;
          const directory = `${chapter}/${version}`;
          if (!(await fileIo.stat(directory)).isDirectory()) continue;
          for (const proof of this.verifiedDigests.keys()) if (proof.startsWith(`${directory}/`)) this.verifiedDigests.remove(proof);
          await this.clearOwnedTextDirectory(directory, CACHE_FORMAT_VERSION, sourceId, bookId, ordinal, version);
        }
        await this.removeEmptyDirectory(chapter);
      }
      const legacy = `${this.legacyRootDirectory()}/${await this.legacyBookHash(sourceId, bookId)}/${ordinal}`;
      if (await fileIo.access(legacy) && (await fileIo.stat(legacy)).isDirectory())
        await this.clearOwnedTextDirectory(legacy, LEGACY_CACHE_FORMAT_VERSION, sourceId, bookId, ordinal);
      await this.unlinkIfPresent(`${clearRoot}/${name}`);
    }
  }

  private async finishPendingClear(sourceId: string, bookId: string): Promise<void> {
    await this.finishPendingChapterClears(sourceId, bookId);
    const marker = await this.clearMarkerPath(sourceId, bookId);
    if (!(await fileIo.access(marker))) return;
    const book = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}`;
    if (await fileIo.access(book)) {
      for (const ordinal of await fileIo.listFile(book)) {
        if (!/^(0|[1-9][0-9]*)$/.test(ordinal)) continue;
        const chapter = `${book}/${ordinal}`;
        if (!(await fileIo.stat(chapter)).isDirectory()) continue;
        for (const version of await fileIo.listFile(chapter)) {
          if (!/^[0-9a-f]{64}$/.test(version)) continue;
          const directory = `${chapter}/${version}`;
          if (!(await fileIo.stat(directory)).isDirectory()) continue;
          await this.clearOwnedTextDirectory(directory, CACHE_FORMAT_VERSION, sourceId, bookId, ordinal, version);
        }
        await this.removeEmptyDirectory(chapter);
      }
      await this.removeEmptyDirectory(book);
    }
    const legacyBook = `${this.legacyRootDirectory()}/${await this.legacyBookHash(sourceId, bookId)}`;
    if (await fileIo.access(legacyBook)) {
      for (const name of await fileIo.listFile(legacyBook)) {
        if (!/^(0|[1-9][0-9]*)$/.test(name)) continue;
        const directory = `${legacyBook}/${name}`;
        // v1 delimiter keys could collide. Never delete another pair's data,
        // nor claim unidentifiable legacy garbage merely by directory number.
        if ((await fileIo.stat(directory)).isDirectory()) {
          await this.clearOwnedTextDirectory(directory, LEGACY_CACHE_FORMAT_VERSION, sourceId, bookId, name);
        }
      }
      await this.removeEmptyDirectory(legacyBook);
    }
    // Revocation survives successful cleanup too: unreadable/unidentifiable
    // legacy leftovers must never become readable after a later restart.
    await this.writeAtomicBytes(`${marker}.legacy-revoked`, new util.TextEncoder().encodeInto('cleared'));
    await this.unlinkIfPresent(marker);
  }

  /** Same manga signals used by the upstream Host; no retention policy here. */

  private async containsMangaManifest(directory: string): Promise<boolean> {
    if (!(await fileIo.access(directory))) return false;
    for (const name of await fileIo.listFile(directory)) {
      const path = `${directory}/${name}`;
      if (name === '.manga' || name === 'manga-identity.json' || name === 'manifest-script-bgra-v2.json') return true;
      const stat = await fileIo.stat(path);
      if (stat.isDirectory()) {
        if (await this.containsMangaManifest(path)) return true;
      } else if (name === 'manifest.json') {
        const value = await this.readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, name, true) ??
          await this.readTextManifestIdentity(directory, LEGACY_CACHE_FORMAT_VERSION, name, true);
        if (value?.manga === true || value?.chapterId !== undefined || value?.mangaCacheProfile !== undefined) return true;
      }
    }
    return false;
  }

  private isTextOwnership(value: ReadingImageChapterManifest): boolean {
    return value.manga !== true && value.chapterId === undefined && value.mangaCacheProfile === undefined &&
      (value.cacheOwner === undefined || value.cacheOwner === TEXT_CACHE_OWNER) && Array.isArray(value.resourceHashes) &&
      value.resourceHashes.every((hash: string): boolean => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash));
  }

  private async clearOwnedTextDirectory(directory: string, formatVersion: number, sourceId: string, bookId: string,
    ordinal: string, version?: string): Promise<void> {
    if (await this.containsMangaManifest(directory)) return;
    const files = formatVersion === CACHE_FORMAT_VERSION ? ['manifest.json', 'text-identity.json'] : ['manifest.json'];
    const ownedFiles: string[] = [];
    const hashes: Set<string> = new Set<string>();
    for (const fileName of files) {
      const value = await this.readTextManifestIdentity(directory, formatVersion, fileName, true);
      if (value === undefined || !this.isTextOwnership(value) || value.sourceId !== sourceId || value.bookId !== bookId ||
        `${value.chapterIndex}` !== ordinal || (version !== undefined && await this.sha256(value.contentVersion) !== version) ||
        (fileName === 'text-identity.json' && value.cacheOwner !== TEXT_CACHE_OWNER)) continue;
      ownedFiles.push(fileName);
      for (const hash of value.resourceHashes) hashes.add(hash);
    }
    if (ownedFiles.length === 0) return;
    // Keep ownership until all named bytes have been removed. A failure must
    // leave both the original pending intent and enough proof for its retry.
    for (const hash of hashes) {
      const path = `${directory}/${hash}.bin`;
      if (await fileIo.access(path) && !(await fileIo.stat(path)).isDirectory()) await fileIo.unlink(path);
    }
    for (const fileName of ownedFiles) await this.unlinkIfPresent(`${directory}/${fileName}`);
    await this.removeEmptyDirectory(directory);
  }

  private async removeEmptyDirectory(directory: string): Promise<void> {
    if (await fileIo.access(directory) && (await fileIo.listFile(directory)).length === 0) await fileIo.rmdir(directory);
  }

  private async ownsTextResource(identity: ReadingImageCacheIdentity): Promise<boolean> {
    const directory = await this.chapterDirectory(identity);
    const hash = await this.resourceHash(identity);
    for (const fileName of ['manifest.json', 'text-identity.json']) {
      const value = await this.readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, fileName, true);
      if (value !== undefined && this.isTextOwnership(value) && this.sameChapter(value, identity) &&
        (fileName !== 'text-identity.json' || value.cacheOwner === TEXT_CACHE_OWNER) && value.resourceHashes.indexOf(hash) >= 0) return true;
    }
    return false;
  }

  /** Partial writes need durable ownership without publishing completion. */
  private async recordTextResourceOwnership(identity: ReadingImageCacheIdentity, current: () => boolean): Promise<void> {
    const directory = await this.chapterDirectory(identity);
    if (await this.containsMangaManifest(directory)) throw new Error('text image cache cannot overwrite manga ownership');
    const previous = await this.readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, 'text-identity.json', true);
    if ((previous === undefined && await fileIo.access(`${directory}/text-identity.json`)) ||
      (previous !== undefined && (!this.isTextOwnership(previous) || previous.cacheOwner !== TEXT_CACHE_OWNER ||
      !this.sameChapter(previous, identity)))) throw new Error('text image cache ownership mismatch');
    const hashes = new Set<string>(previous?.resourceHashes ?? []);
    hashes.add(await this.resourceHash(identity));
    const ownership: ReadingImageChapterManifest = { formatVersion: CACHE_FORMAT_VERSION, cacheOwner: TEXT_CACHE_OWNER,
      sourceId: identity.sourceId, bookId: identity.bookId, chapterIndex: identity.chapterIndex,
      contentVersion: identity.contentVersion, resourceHashes: Array.from(hashes).sort(), completedAt: 0 };
    await this.writeAtomicBytes(`${directory}/text-identity.json`, new util.TextEncoder().encodeInto(JSON.stringify(ownership)), current);
  }

  private async clearMarkerPath(sourceId: string, bookId: string): Promise<string> {
    return `${this.rootDirectory()}/.clear/${await this.bookHash(sourceId, bookId)}.pending`;
  }

  private async chapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    const chapter = this.mangaChapter(identity);
    if (chapter !== undefined) return `${this.rootDirectory()}/${await this.bookHash(identity.sourceId, identity.bookId)}/` +
      `.manga/${await this.sha256(chapter.chapterId)}/${await this.sha256(chapter.contentVersion)}`;
    return this.ordinalChapterDirectory(identity);
  }

  private async ordinalChapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.rootDirectory()}/${await this.bookHash(identity.sourceId, identity.bookId)}/` +
      `${identity.chapterIndex}/${await this.sha256(identity.contentVersion)}`;
  }

  private async isMangaBook(sourceId: string, bookId: string): Promise<boolean> {
    const key = this.bookMutationKey(sourceId, bookId);
    if (this.mangaBooks.has(key)) return true;
    const directory = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}`;
    if (await fileIo.access(`${directory}/.manga`) || await this.containsMangaManifest(directory) ||
      await this.containsMangaManifest(`${this.legacyRootDirectory()}/${await this.legacyBookHash(sourceId, bookId)}`)) {
      this.mangaBooks.add(key); return true;
    }
    return false;
  }


  private async legacyChapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.legacyRootDirectory()}/${await this.legacyBookHash(identity.sourceId, identity.bookId)}/${identity.chapterIndex}`;
  }

  private async resourcePath(identity: ReadingImageCacheIdentity): Promise<string> {
    return `${await this.chapterDirectory(identity)}/${await this.resourceHash(identity)}.bin`;
  }

  private async bookHash(sourceId: string, bookId: string): Promise<string> {
    return this.sha256(JSON.stringify([sourceId, bookId]));
  }

  private async legacyBookHash(sourceId: string, bookId: string): Promise<string> {
    return this.sha256(`${sourceId}\u0000${bookId}`);
  }

  private bookMutationKey(sourceId: string, bookId: string): string {
    // Do not use a delimiter-only key: although normal IDs are opaque strings,
    // a caller-controlled NUL could otherwise make two distinct pairs share a
    // mutation tail (for example `a\0b`/`c` and `a`/`b\0c`).
    return JSON.stringify([sourceId, bookId]);
  }

  private enqueueBookMutation(
    key: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.bookMutationTails.get(key) ?? Promise.resolve();
    const task = previous.catch((): void => {}).then(operation);
    const settled = task.catch((): void => {});
    this.bookMutationTails.set(key, settled);
    return task.finally((): void => {
      if (this.bookMutationTails.get(key) === settled) {
        this.bookMutationTails.delete(key);
      }
    });
  }

  private async resourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
    if (identity.resourceRef !== undefined) {
      const profile = this.mangaCacheProfile(identity.mangaDecodeRevision);
      return profile === undefined ? this.legacyMangaResourceHash(identity) :
        this.sha256(JSON.stringify(['manga-resource-v2', profile, identity.contentVersion, identity.resourceRef]));
    }
    const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
    return this.sha256(JSON.stringify([identity.contentVersion, identity.imageUrl, baseUrl ?? '']));
  }

  private async legacyMangaResourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
    return this.sha256(JSON.stringify(['manga-resource-v1', identity.contentVersion, identity.resourceRef]));
  }

  private mangaCacheProfile(revision?: string): string | undefined {
    if (revision === 'bytes-v1') return MANGA_SCRIPT_CACHE_PROFILE;
    if (revision === undefined || revision === 'identity-v1') return undefined;
    throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
  }

  private manifestPath(directory: string, profile?: string): string {
    return profile === undefined ? `${directory}/manifest.json` : `${directory}/manifest-${profile}.json`;
  }

  private hasUnambiguousLegacyResourceIdentity(identity: ReadingImageCacheIdentity): boolean {
    // v1 has no URL metadata to disambiguate delimiter-bearing resource keys.
    return identity.resourceRef === undefined && identity.imageUrl.indexOf('\u0000') < 0 &&
      (canonicalReadingImageBaseUrl(identity.baseUrl) ?? '').indexOf('\u0000') < 0;
  }

  private async legacyResourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
    const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
    return this.sha256(`${identity.contentVersion}\u0000${identity.imageUrl}\u0000${baseUrl ?? ''}`);
  }

  private async sha256(value: string): Promise<string> {
    return this.sha256Bytes(new util.TextEncoder().encodeInto(value));
  }

  private async sha256Bytes(value: Uint8Array): Promise<string> {
    const digest = cryptoFramework.createMd('SHA256');
    await digest.update({ data: value });
    const output = await digest.digest();
    const alphabet = '0123456789abcdef';
    let result = '';
    for (const byte of output.data) {
      result += alphabet.charAt((byte >>> 4) & 0x0f);
      result += alphabet.charAt(byte & 0x0f);
    }
    return result;
  }

  private rootDirectory(): string {
    return `${this.context.filesDir}/reader-offline/images-v2`;
  }

  private legacyRootDirectory(): string {
    return `${this.context.filesDir}/reader-offline/images-v1`;
  }

  private async writeAtomicBytes(path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> {
    this.verifiedDigests.remove(path);
    const existing = this.inFlightWrites.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.enqueueWrite(async (): Promise<void> => {
      await this.performAtomicWrite(path, bytes, isCurrent);
    });
    this.inFlightWriteRevision += 1;
    this.inFlightWrites.set(path, operation);
    try {
      await operation;
    } finally {
      if (this.inFlightWrites.get(path) === operation) {
        this.inFlightWrites.delete(path);
        this.inFlightWriteRevision += 1;
      }
    }
  }

  private async enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const laneA = this.nextWriteLane % 2 === 0;
    this.nextWriteLane += 1;
    const predecessor = laneA ? this.writeLaneA : this.writeLaneB;
    let release: () => void = (): void => {};
    const tail = new Promise<void>((resolve): void => {
      release = resolve;
    });
    if (laneA) {
      this.writeLaneA = tail;
    } else {
      this.writeLaneB = tail;
    }
    await predecessor;
    try {
      await operation();
    } finally {
      release();
    }
  }

  private async performAtomicWrite(path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> {
    this.nextTemporaryFile += 1;
    const tmpPath = `${path}.tmp-${this.nextTemporaryFile}`;
    try {
      this.assertCurrent(isCurrent);
      const file = await fileIo.open(
        tmpPath,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
      );
      try {
        let writtenBytes = 0;
        while (writtenBytes < bytes.byteLength) {
          this.assertCurrent(isCurrent);
          // FileIO has no source-buffer offset; reuse the bounded chunk pattern
          // of book/font staging and retry partial writes from the next byte.
          const chunk = bytes.slice(writtenBytes, Math.min(bytes.byteLength, writtenBytes + READING_IMAGE_WRITE_CHUNK_BYTES));
          const written = await fileIo.write(file.fd, chunk.buffer);
          if (!Number.isSafeInteger(written) || written <= 0 || written > chunk.byteLength) {
            throw new Error('offline reading image destination stopped accepting bytes');
          }
          writtenBytes += written;
        }
        await fileIo.fsync(file.fd);
      } finally {
        await fileIo.close(file);
      }
      this.assertCurrent(isCurrent);
      await fileIo.rename(tmpPath, path);
    } catch (error) {
      try {
        await fileIo.unlink(tmpPath);
      } catch (_) {
      }
      if ((error as BusinessError).code === FILE_SYSTEM_NO_SPACE_ERROR) {
        throw new ReadingOfflineMaterializationError(
          'storage_full',
          'MANGA_CACHE_STORAGE_FULL',
        );
      }
      throw error;
    }
  }

  private async assertWriteCapacity(directory: string, writeBytes: number, manga: boolean = false): Promise<void> {
    if (!manga) {
      const freeBytes = await this.freeSpaceProbe.getFreeBytes(directory);
      try {
        assertReadingOfflineWriteCapacity(freeBytes, writeBytes, MIN_READING_IMAGE_FREE_RESERVE_BYTES);
      } catch (error) {
        if (error instanceof ReadingOfflineMaterializationError &&
          (error as unknown as { code?: string }).code === 'storage_full') {
          throw new ReadingOfflineMaterializationError('storage_full', 'MANGA_CACHE_STORAGE_FULL');
        }
        throw error;
      }
      return;
    }
    const capacity = await this.mangaStorageCapacityForPath(directory);
    try {
      assertReadingOfflineWriteCapacity(
        capacity.freeBytes,
        Math.max(writeBytes, this.mangaReservedBytes),
        capacity.systemReserveBytes,
      );
    } catch (error) {
      if (error instanceof ReadingOfflineMaterializationError &&
        (error as unknown as { code?: string }).code === 'storage_full') {
        throw new ReadingOfflineMaterializationError('storage_full', 'MANGA_CACHE_STORAGE_FULL');
      }
      throw error;
    }
  }

  private async ensureDirectory(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      return;
    }
    try {
      await fileIo.mkdir(path, true);
    } catch (error) {
      if (!(await fileIo.access(path))) {
        throw error;
      }
    }
  }

  private async unlinkIfPresent(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      await fileIo.unlink(path);
      this.inFlightWriteRevision += 1;
    }
  }

  private async validResourceFile(path: string): Promise<boolean> {
    if (!(await fileIo.access(path))) return false;
    const stat = await fileIo.stat(path);
    return !stat.isDirectory() && Number.isSafeInteger(stat.size) && stat.size > 0 && stat.size <= MAX_READING_IMAGE_BYTES;
  }

  private async readResourceBytes(path: string, manga: boolean = false,
    isCurrent: () => boolean = (): boolean => !this.closed): Promise<Uint8Array | undefined> {
    if (!(await this.validResourceFile(path))) return undefined;
    const stat = await fileIo.stat(path);
    // Novel reads keep their existing path. Manga payloads retain AtomicFile's
    // recovery semantics, with the bounded full read dispatched by the SDK.
    if (manga) {
      this.assertCurrent(isCurrent);
      const bytes = await readMangaAtomicPayload(path, stat.size, MAX_READING_IMAGE_BYTES, isCurrent);
      this.assertCurrent(isCurrent);
      return bytes;
    }
    const buffer = new fileIo.AtomicFile(path).readFully();
    if (buffer.byteLength !== stat.size) throw new Error('offline reading image changed while being read');
    return new Uint8Array(buffer);
  }

  private sameChapter(left: ReadingImageChapterIdentity, right: ReadingImageChapterIdentity): boolean {
    return left.sourceId === right.sourceId && left.bookId === right.bookId &&
      (left.chapterId !== undefined && right.chapterId !== undefined ? left.chapterId === right.chapterId : left.chapterIndex === right.chapterIndex) &&
      left.contentVersion === right.contentVersion;
  }

  private assertCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) throw new Error('offline reading image operation was superseded');
  }

  private assertResourceIdentity(identity: ReadingImageCacheIdentity): void {
    this.assertChapterIdentity(identity);
    if (identity.resourceRef !== undefined && identity.mangaDecodeRevision === undefined) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
    this.mangaCacheProfile(identity.mangaDecodeRevision);
    this.assertNonBlank(identity.imageUrl, 'imageUrl');
    if (identity.resourceRef !== undefined && !/^manga:mp1:[0-9a-f]{64}$/.test(identity.resourceRef)) {
      throw new Error('invalid manga resourceRef');
    }
  }

  private assertChapterIdentity(identity: ReadingImageChapterIdentity): void {
    this.assertNonBlank(identity.sourceId, 'sourceId');
    this.assertNonBlank(identity.bookId, 'bookId');
    this.assertNonBlank(identity.contentVersion, 'contentVersion');
    if (identity.chapterId !== undefined) this.assertNonBlank(identity.chapterId, 'chapterId');
    this.mangaCacheProfile(identity.mangaDecodeRevision);
    if (!Number.isSafeInteger(identity.chapterIndex) || identity.chapterIndex < 0) {
      throw new Error('chapterIndex must be a non-negative safe integer');
    }
  }

  private assertSameChapter(
    chapter: ReadingImageChapterIdentity,
    resource: ReadingImageCacheIdentity,
  ): void {
    if (!this.sameChapter(resource, chapter)) {
      throw new Error('offline reading image resource belongs to a different chapter version');
    }
  }

  private assertNonBlank(value: string, field: string): void {
    if (value.trim().length === 0) {
      throw new Error(`${field} must be non-blank`);
    }
  }
}
