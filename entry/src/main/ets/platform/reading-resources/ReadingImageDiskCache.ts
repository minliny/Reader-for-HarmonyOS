import { readerHostFilesDirectory } from '../../app/diagnostics/ReaderPublicFixtureScope';
import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { canonicalReadingImageBaseUrl } from '../../common/ReadingImageIdentity';
import {
  assertReadingOfflineWriteCapacity,
  ReadingOfflineMaterializationError,
} from '../../features/reading/application/ReadingOfflineContract';
import {
  CACHE_FORMAT_VERSION,
  LEGACY_CACHE_FORMAT_VERSION,
  TEXT_CACHE_OWNER,
  MAX_READING_IMAGE_BYTES,
  MIN_READING_IMAGE_FREE_RESERVE_BYTES,
  MANGA_FREE_RESERVE_BYTES,
  MANGA_CACHE_BUDGET_MAX_BYTES,
  MANGA_FOREGROUND_RESERVE_BYTES,
  MANGA_FOREGROUND_CHECK_MS,
  MANGA_BUDGET_CALIBRATION_MS,
  MANGA_READ_TTL_SECONDS,
  MANGA_IDENTITY_METADATA_BYTES,
  HarmonyReadingImageFreeSpaceProbe,
  type MangaStorageChapter,
  type MangaStorageClass,
  type MangaStorageReason,
  type MangaStorageScope,
  type MangaStorageCleanup,
  type MangaStorageGrant,
  type MangaStoragePolicy,
  type MangaExpiryGuard,
  type MangaStorageAuthority,
  type MangaExternalFile,
  type MangaExternalStorage,
  type MangaWriteReservation,
  type MangaInventoryFile,
  type MangaBudgetInventory,
  type SharedDownloadStoragePolicy,
  type ReadingTextStorageChapter,
  type ReadingTextStorageImageChapter,
  type ReadingTextStoragePolicy,
  type ReadingImageStorageSummary,
  type ReadingImageCleanupFile,
  type ReadingInventoryFile,
  type ReadingImageCleanupInventory,
  type ReadingImageStorageSnapshot,
  type ReadingImageDigestProof,
  type ReadingImageFreeSpaceProbe,
  type MangaStorageCapacity,
  type MangaStorageBuckets,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
  type ReadingImageChapterManifest,
} from './ReadingImageDiskCacheTypes';
import {
  clearCapturedTextFilesOps,
  finishPendingChapterClearsOps,
  finishPendingClearOps,
  type ReadingImageClearOpsContext,
} from './ReadingImageDiskClearOps';
import {
  assertChapterIdentity,
  assertMangaStorageChapter,
  assertNonBlankValue,
  assertOperationCurrent,
  assertResourceIdentity,
  assertSameChapterIdentity,
  bookHash,
  bookMutationKey,
  computeMangaStorageBuckets,
  computeMangaStorageCapacity,
  containsMangaManifest,
  ensureDirectory,
  fetchAuthorityClassBatch,
  fetchAuthorityClassSnapshot,
  fetchAuthorityPolicyBatch,
  hasUnambiguousLegacyResourceIdentity,
  isNotFoundError,
  isTextOwnershipManifest,
  legacyBookHash,
  legacyMangaResourceHash,
  legacyResourceHash,
  listFileIfPresent,
  mangaCacheProfile,
  mangaChapterKey,
  mangaChapterOfIdentity,
  mangaDerivedDeletionFilesForChapter,
  manifestPathForDirectory,
  performAtomicFileWrite,
  readDiskManifestIdentity,
  readMangaMetadataBytes,
  readRawResourceBytes,
  readResourceFingerprint,
  readTextManifestIdentity,
  resourceHash,
  sameChapterIdentity,
  sha256Bytes,
  sha256Text,
  statIfPresent,
  validResourceFile,
} from './ReadingImageDiskFsOps';

export type {
  MangaStorageChapter,
  MangaStorageClass,
  MangaStorageReason,
  MangaStorageScope,
  MangaStorageCleanup,
  MangaStorageGrant,
  MangaStoragePolicy,
  MangaExpiryGuard,
  MangaStorageAuthority,
  MangaExternalFile,
  MangaExternalStorage,
  MangaWriteReservation,
  SharedDownloadStoragePolicy,
  ReadingTextStorageChapter,
  ReadingTextStorageImageChapter,
  ReadingTextStoragePolicy,
  ReadingImageStorageSummary,
  ReadingImageCleanupFile,
  ReadingImageStorageSnapshot,
  ReadingImageFreeSpaceProbe,
  MangaStorageCapacity,
  ReadingImageCacheIdentity,
  ReadingImageChapterIdentity,
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
  private digestProofEpoch: number = 0;
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
  private mangaAuthorityReady: Promise<void> | undefined;
  private mangaExternal: MangaExternalStorage | undefined;
  private mangaPolicyTail: Promise<void> = Promise.resolve();
  private mangaExpiryTask: Promise<void> | undefined;
  private mangaExpiryTaskTtlSeconds: number | undefined;
  private mangaExpiryTaskScope: string = '';
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
  private mangaBudgetInventory: MangaBudgetInventory | undefined;
  private mangaInventoryRevision: number = 0;
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
    this.mangaAuthorityReady = undefined;
    void this.loadMangaStorageAuthority().catch((): void => {});
  }

  private async loadMangaStorageAuthority(): Promise<void> {
    const authority = this.mangaAuthority;
    if (authority === undefined) return;
    if (this.mangaAuthorityReady === undefined) {
      this.mangaAuthorityReady = this.enqueueMangaPolicy(async (): Promise<void> => {
        const pending = await authority.pending();
        if (this.mangaAuthority !== authority || this.closed) return;
        for (const grant of pending) this.mangaEvicting.set(mangaChapterKey(grant), grant);
      });
    }
    const work = this.mangaAuthorityReady;
    try { await work; }
    catch (error) {
      if (this.mangaAuthorityReady === work) this.mangaAuthorityReady = undefined;
      throw error;
    }
  }
  setMangaExternalStorage(storage: MangaExternalStorage): void {
    this.mangaExternal = storage;
    this.invalidateMangaBudgetInventory();
  }

  /** The Runtime invalidates content work and drains display writes first.
   * Serialize the Core restore with physical eviction, then replace local
   * tombstones using the resulting authority even when the restore failed. */
  async withMangaStorageRestore<T>(restore: () => Promise<T>): Promise<T> {
    this.mangaRestoreRequests += 1;
    this.mangaStorageEpoch += 1;
    this.invalidateMangaBudgetInventory();
    try {
      return await this.enqueueMangaPolicy(async (): Promise<T> => {
        await Promise.all(Array.from(this.bookMutationTails.values()).map(task => task.catch((): void => {})));
        let restored = false;
        try {
          const value = await restore();
          restored = true;
          return value;
        } finally {
          this.mangaRestoreBlocked = true;
          try {
            const pending = await this.mangaAuthority?.pending() ?? [];
            this.mangaEvicting.clear();
            for (const grant of pending) this.mangaEvicting.set(mangaChapterKey(grant), grant);
            this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
          } catch (error) {
            // Keep admission blocked until maintenance reconciles Core's
            // pending set. Preserve an earlier restore error for its owner.
            if (restored) throw error;
          }
        }
      });
    } finally { this.mangaRestoreRequests -= 1; }
  }

  /** Keep the current and two recent chapters pinned for the reading session. */
  pinMangaChapter(chapter: MangaStorageChapter): () => void {
    assertMangaStorageChapter(chapter);
    const key = mangaChapterKey(chapter);
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    if (this.closed || this.mangaEvicting.has(key) || this.mangaClaiming.has(key)) throw new Error('MANGA_CACHE_EVICTING');
    this.mangaBooks.add(bookMutationKey(chapter.sourceId, chapter.bookId));
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
    assertMangaStorageChapter(chapter);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid manga write reservation');
    const unpin = this.pinMangaChapter(chapter);
    let ordinaryReservation = false;
    try {
      await this.loadMangaStorageAuthority();
      await this.enqueueMangaPolicy(async (): Promise<void> => {
        if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
        if (this.mangaEvicting.has(mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
        ordinaryReservation = kind === 'derived' ||
          (await this.mangaAuthority?.classify(chapter) ?? 'unknown') !== 'download';
        let snapshot = await this.readMangaBudget();
        let buckets = snapshot.buckets;
        const headroom = priority === 'background' ? MANGA_FOREGROUND_RESERVE_BYTES : 0;
        let capacity = snapshot.capacity;
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
            snapshot = await this.readMangaBudget();
            buckets = snapshot.buckets;
            capacity = snapshot.capacity;
            freeBytes = capacity.freeBytes;
            return !overBudget() && !lowSpace();
          });
          snapshot = await this.readMangaBudget();
          buckets = snapshot.buckets;
          capacity = snapshot.capacity;
          freeBytes = capacity.freeBytes;
        }
        if (snapshot.revision !== this.mangaInventoryRevision) throw new Error('MANGA_CACHE_INVENTORY_CHANGED');
        if (overBudget() || lowSpace()) throw new ReadingOfflineMaterializationError('storage_full', 'MANGA_CACHE_STORAGE_FULL');
        if (this.closed || this.mangaEvicting.has(mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
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

  /** Core owns the read clock and LRU order; the saved policy supplies TTL. */
  async maintainMangaStorage(reason: MangaStorageReason = 'expiry', scope?: MangaStorageScope): Promise<void> {
    if (reason === 'expiry') { await this.maintainMangaExpiry(scope); return; }
    await this.enqueueMangaPolicy(async (): Promise<void> => {
      if (this.mangaRestoreRequests > 0) return;
      if (this.mangaRestoreBlocked) {
        const pending = await this.mangaAuthority?.pending() ?? [];
        this.mangaEvicting.clear();
        for (const grant of pending) this.mangaEvicting.set(mangaChapterKey(grant), grant);
        this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
      }
      await this.evictMangaCandidates(reason, scope);
    });
  }

  /** Idle scanning may await a large Core inventory. It cannot hold the
   * foreground budget lane across that wait or a whole historical cleanup.
   * One chapter transaction at a time retains the original exact grant fences. */
  private async maintainMangaExpiry(scope?: MangaStorageScope): Promise<void> {
    await this.loadStoragePolicy();
    const requestedScope = scope === undefined ? '' : JSON.stringify([scope.sourceId, scope.bookId]);
    while (!this.closed) {
      const ttlSeconds = this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS;
      const previous = this.mangaExpiryTask;
      if (previous !== undefined) {
        const previousTtl = this.mangaExpiryTaskTtlSeconds;
        const previousScope = this.mangaExpiryTaskScope;
        await previous;
        // A pass for an old policy or one book cannot satisfy a newly saved
        // global policy. Coalesce only work that actually covers this request.
        if (previousTtl === (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS) &&
          (previousScope.length === 0 || previousScope === requestedScope)) return;
        continue;
      }
      const task = this.runMangaExpiry(scope, ttlSeconds);
      this.mangaExpiryTask = task;
      this.mangaExpiryTaskTtlSeconds = ttlSeconds;
      this.mangaExpiryTaskScope = requestedScope;
      const finish = (): void => {
        if (this.mangaExpiryTask !== task) return;
        this.mangaExpiryTask = undefined;
        this.mangaExpiryTaskTtlSeconds = undefined;
        this.mangaExpiryTaskScope = '';
      };
      void task.then(finish, finish);
      await task;
      if (ttlSeconds === (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS)) return;
    }
  }

  private async runMangaExpiry(scope: MangaStorageScope | undefined, ttlSeconds: number): Promise<void> {
    await this.loadMangaStorageAuthority();
    const epoch = this.mangaStorageEpoch;
    const ready = await this.enqueueMangaPolicy(async (): Promise<boolean> => {
      if (this.closed || this.mangaRestoreRequests > 0 || epoch !== this.mangaStorageEpoch ||
        ttlSeconds !== (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS)) return false;
      if (this.mangaRestoreBlocked) {
        const pending = await this.mangaAuthority?.pending() ?? [];
        this.mangaEvicting.clear();
        for (const grant of pending) this.mangaEvicting.set(mangaChapterKey(grant), grant);
        this.mangaClaiming.clear(); this.mangaRestoreBlocked = false;
      }
      const elapsed = Date.now() - this.mangaLastForegroundCheck;
      return this.mangaLastForegroundCheck === 0 || elapsed < 0 || elapsed >= MANGA_FOREGROUND_CHECK_MS;
    });
    if (!ready || ttlSeconds !== (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS)) return;
    await this.evictMangaCandidates('expiry', scope, undefined, true);
    if (scope === undefined && !this.closed && epoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0 &&
      ttlSeconds === (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS))
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
    const capacity = await this.mangaStorageCapacity();
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
      const directory = `${readerHostFilesDirectory(this.context.filesDir)}/reader-offline`;
      await ensureDirectory(directory);
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
    await this.loadMangaStorageAuthority();
    const writeRevision = this.inFlightWriteRevision;
    const files = await this.readingInventory();
    const physical = new Map<string, ReadingInventoryFile[]>();
    for (const file of files) {
      const aliases = physical.get(file.physicalKey) ?? [];
      aliases.push(file); physical.set(file.physicalKey, aliases);
    }
    const chapters = new Map<string, ReadingTextStorageImageChapter>();
    const protectedChapters = new Map<string, ReadingTextStorageChapter>();
    let scanChanged = false;
    for (const aliases of physical.values()) {
      const text = aliases.filter(file => file.textOwner !== undefined);
      const owner = text[0]?.textOwner;
      if (owner === undefined) continue;
      const key = this.textStorageKey(owner);
      const measured = chapters.get(key) ?? { ...owner, contentBytes: 0 };
      measured.contentBytes += Math.max(...aliases.map(file => file.size));
      for (const file of aliases) {
        if (file.textOwner === undefined || file.live || this.inFlightWrites.has(file.path) ||
          this.bookMutationTails.has(bookMutationKey(owner.sourceId, owner.bookId)) ||
          this.textStorageKey(file.textOwner) !== key) protectedChapters.set(key, owner);
        const stat = await statIfPresent(file.path);
        if (stat === undefined || this.mangaPhysicalKey(stat) !== file.physicalKey || String(stat.mtimeNs) !== file.mtime) {
          scanChanged = true;
          protectedChapters.set(key, owner);
          continue;
        }
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
    return { files, writeRevision: scanChanged ? -1 : writeRevision,
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
      for (const owner of file.owners) owners.set(mangaChapterKey(owner), owner);
    }
    const classes = await fetchAuthorityClassSnapshot(this.mangaAuthority, Array.from(owners.values()));
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
          if (this.bookMutationTails.has(bookMutationKey(file.textOwner.sourceId, file.textOwner.bookId))) removable = false;
        } else if (file.owners.length > 0) {
          for (const owner of file.owners) {
            const classification = classes.get(mangaChapterKey(owner)) ?? 'unknown';
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
      const unknownOwner = unknown.has(await bookHash(sourceId, bookId)) || unknown.has(await legacyBookHash(sourceId, bookId));
      index.set(key, unknownOwner ? undefined : Array.from(physical.values()).reduce((sum, bytes) => sum + bytes, 0));
    }
    return index;
  }

  /** A successful Core image-only cleanup selector is not a disk receipt.
   * Compare actual remaining paths and inodes only after Host unlink settles. */
  async readingStorageCleanupReceipt(before: ReadingImageCleanupInventory): Promise<MangaStorageCleanup> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const writeRevision = this.inFlightWriteRevision;
      const after = await this.readingInventory();
      const retained = new Set(after.map(file => file.physicalKey));
      const released = new Set<string>();
      const removedPaths = new Set<string>();
      let deletedBytes = 0;
      for (const file of before.files) {
        if (await statIfPresent(file.path) !== undefined) continue;
        removedPaths.add(file.path);
        if (!retained.has(file.physicalKey) && !released.has(file.physicalKey)) {
          released.add(file.physicalKey); deletedBytes += file.size;
        }
      }
      if (!this.closed && writeRevision === this.inFlightWriteRevision)
        return { deletedBytes, deletedFiles: removedPaths.size };
    }
    throw new Error('DOWNLOAD_STORAGE_INVENTORY_CHANGED');
  }

  private textStorageKey(chapter: ReadingTextStorageChapter): string {
    return JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterIndex]);
  }

  private async readingInventory(): Promise<ReadingInventoryFile[]> {
    const result: ReadingInventoryFile[] = await this.mangaInventory();
    for (const root of [this.rootDirectory(), this.legacyRootDirectory()])
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
        const manifest = await readTextManifestIdentity(directory, format, (): boolean => !this.closed, name, true);
        if (manifest === undefined || !isTextOwnershipManifest(manifest)) continue;
        const expected = format === CACHE_FORMAT_VERSION ? await this.ordinalChapterDirectory(manifest) :
          await this.legacyChapterDirectory(manifest);
        if (directory !== expected || (name === 'text-identity.json' && manifest.cacheOwner !== TEXT_CACHE_OWNER)) continue;
        owner = { sourceId: manifest.sourceId, bookId: manifest.bookId, chapterIndex: manifest.chapterIndex };
        knownFiles.add(name);
        for (const hash of manifest.resourceHashes) knownFiles.add(`${hash}.bin`);
      }
    }
    for (const name of await listFileIfPresent(directory)) {
      const path = `${directory}/${name}`;
      const stat = await statIfPresent(path);
      if (stat === undefined) continue;
      if (stat.isDirectory()) {
        if (name !== '.manga' && name !== '.clear') await this.collectTextStorageFiles(path, result);
      } else if (stat.isFile() && owner !== undefined && knownFiles.has(name)) {
        result.push({ path, owners: [], textOwner: owner, live: false, size: stat.size,
          physicalKey: this.mangaPhysicalKey(stat), mtime: String(stat.mtimeNs), external: false });
      }
    }
  }

  private async loadStoragePolicy(): Promise<void> {
    if (this.storagePolicyReady === undefined) this.storagePolicyReady = this.readStoragePolicy();
    const work = this.storagePolicyReady;
    try { await work; }
    catch (error) {
      if (this.storagePolicyReady === work) this.storagePolicyReady = undefined;
      throw error;
    }
  }

  private async readStoragePolicy(): Promise<void> {
    const path = `${readerHostFilesDirectory(this.context.filesDir)}/reader-offline/storage-policy.json`;
    let bytes: Uint8Array;
    try {
      if (!(await fileIo.access(path))) return;
      bytes = await readMangaMetadataBytes(path, MANGA_IDENTITY_METADATA_BYTES, (): boolean => !this.closed);
    } catch (error) {
      // A missing or structurally invalid policy keeps the volume default.
      // Transient I/O must evict the failed shared read so the next user
      // action can observe the persisted policy instead of a permanent default.
      if (isNotFoundError(error) || (error instanceof Error && error.message === 'MANGA_ATOMIC_PAYLOAD_BUDGET')) return;
      throw error;
    }
    try {
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
    await this.loadMangaStorageAuthority();
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
    return this.mangaStorageCapacityForPath(readerHostFilesDirectory(this.context.filesDir));
  }

  private async mangaStorageCapacityForPath(directory: string): Promise<MangaStorageCapacity> {
    await this.loadStoragePolicy();
    return computeMangaStorageCapacity(this.freeSpaceProbe, directory, this.configuredCacheLimitBytes);
  }

  /**
   * Reclaim only rebuildable display derivatives.  Original manga bytes,
   * manifests, text books and user data are never passed to this entry point.
   */
  async clearMangaDerivedCache(scope?: MangaStorageScope): Promise<void> {
    await this.loadMangaStorageAuthority();
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
    assertNonBlankValue(sourceId, 'sourceId'); assertNonBlankValue(bookId, 'bookId');
    const epoch = this.mangaStorageEpoch;
    await this.loadMangaStorageAuthority();
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
    for (const value of [chapter.sourceId, chapter.bookId, chapter.chapterId]) assertNonBlankValue(value, 'manga storage identity');
    const epoch = this.mangaStorageEpoch;
    await this.loadMangaStorageAuthority();
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
        owners.set(mangaChapterKey(owner), owner);
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
    assertMangaStorageChapter(chapter);
    const epoch = this.mangaStorageEpoch;
    await this.loadMangaStorageAuthority();
    return this.enqueueMangaPolicy(async (): Promise<boolean> => {
      this.assertMangaPolicyCurrent(epoch, isCurrent);
      const authority = this.mangaAuthority;
      if (authority === undefined || this.closed) return false;
      const key = mangaChapterKey(chapter);
      if (this.mangaBusy.has(key) || this.mangaClaiming.has(key) ||
        this.bookMutationTails.has(bookMutationKey(chapter.sourceId, chapter.bookId))) return false;
      const pending = (await authority.pending()).find(grant => mangaChapterKey(grant) === key);
      if (pending !== undefined) return this.removeMangaGrant(pending,
        (): boolean => epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
      if (this.mangaEvicting.has(key)) return false;
      if (this.mangaDeletionFiles(chapter, await this.mangaInventory()) === undefined ||
        await authority.classify(chapter) !== 'cache') return false;
      this.assertMangaPolicyCurrent(epoch, isCurrent);
      if (this.mangaBusy.has(key) || this.bookMutationTails.has(bookMutationKey(chapter.sourceId, chapter.bookId))) return false;
      // Reserve the identity before awaiting Core: a new read/write must not
      // enter between the local live check and the transactional grant.
      this.mangaClaiming.add(key);
      let grant: MangaStorageGrant | undefined;
      try { grant = await authority.claim(chapter); }
      finally { this.mangaClaiming.delete(key); }
      if (grant === undefined) return false;
      if (mangaChapterKey(grant) !== key || grant.grantToken.trim().length === 0) throw new Error('invalid manga eviction grant');
      return this.removeMangaGrant(grant, (): boolean => epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
    });
  }

  private assertMangaPolicyCurrent(epoch: number, isCurrent?: () => boolean): void {
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    assertOperationCurrent((): boolean => !this.closed && epoch === this.mangaStorageEpoch && isCurrent?.() !== false);
  }

  private enqueueMangaPolicy<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.mangaPolicyTail.catch((): void => {}).then(operation);
    this.mangaPolicyTail = task.then((): void => {}, (): void => {});
    return task;
  }

  private async mangaStorageBuckets(files: MangaInventoryFile[]): Promise<MangaStorageBuckets> {
    return computeMangaStorageBuckets(this.mangaAuthority, files);
  }

  private async mangaOrdinaryBytes(files: MangaInventoryFile[]): Promise<number> {
    return (await this.mangaStorageBuckets(files)).ordinaryBytes;
  }

  private async mangaInventory(): Promise<MangaInventoryFile[]> {
    const result: MangaInventoryFile[] = [];
    // A missing/invalid identity is counted conservatively and never grants deletion.
    for (const root of [this.rootDirectory(), this.legacyRootDirectory()]) await this.collectMangaFiles(root, [], result);
    if (this.mangaExternal !== undefined) {
      for (const file of await this.mangaExternal.inventory()) {
        if (!file.path.startsWith(`${readerHostFilesDirectory(this.context.filesDir)}/`) || file.path.split('/').indexOf('..') >= 0) throw new Error('manga external path escapes app storage');
        const stat = await statIfPresent(file.path);
        if (stat === undefined || !stat.isFile()) continue;
        result.push({ ...file, size: stat.size, physicalKey: this.mangaPhysicalKey(stat), mtime: String(stat.mtimeNs), external: true });
      }
    }
    return result;
  }

  /** Capacity reads reuse physical metadata while policy, leases and actual
   * free space remain live. Deletion and receipts always call mangaInventory. */
  private async mangaInventoryForBudget(): Promise<MangaInventoryFile[]> {
    if (this.mangaExternal !== undefined && this.mangaExternal.tracksPublishedFiles !== true) return this.mangaInventory();
    const cached = this.mangaBudgetInventory;
    const now = Date.now();
    const epoch = this.mangaStorageEpoch;
    if (cached !== undefined && cached.epoch === epoch && now >= cached.calibratedAt &&
      now - cached.calibratedAt <= MANGA_BUDGET_CALIBRATION_MS) return Array.from(cached.files.values());
    const revision = this.mangaInventoryRevision;
    const files = await this.mangaInventory();
    if (!this.closed && epoch === this.mangaStorageEpoch && revision === this.mangaInventoryRevision) {
      const byPath = new Map<string, MangaInventoryFile>();
      for (const file of files) byPath.set(file.path, file);
      this.mangaBudgetInventory = { epoch, calibratedAt: now, files: byPath };
    }
    return files;
  }

  private async readMangaBudget(): Promise<{ buckets: MangaStorageBuckets; capacity: MangaStorageCapacity; revision: number }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const revision = this.mangaInventoryRevision;
      const buckets = await this.mangaStorageBuckets(await this.mangaInventoryForBudget());
      const capacity = await this.mangaStorageCapacity();
      // If an in-flight writer published while the classifier/free-space read
      // was pending, its reservation may no longer be in the live totals.
      if (revision === this.mangaInventoryRevision) return { buckets, capacity, revision };
    }
    throw new Error('MANGA_CACHE_INVENTORY_CHANGED');
  }

  private invalidateMangaBudgetInventory(): void {
    this.mangaInventoryRevision++;
    this.mangaBudgetInventory = undefined;
  }

  /** A failed or out-of-band publication must be recalibrated on next use. */
  async recordMangaDisplayPublication(files?: MangaExternalFile[]): Promise<void> {
    if (files === undefined) { this.invalidateMangaBudgetInventory(); return; }
    for (const file of files) await this.recordMangaBudgetPath(file.path, file.owners, true);
  }

  private async recordMangaBudgetPath(path: string, owners: MangaStorageChapter[], external: boolean): Promise<void> {
    this.mangaInventoryRevision++;
    const inventory = this.mangaBudgetInventory;
    if (inventory === undefined) return;
    try {
      if (!path.startsWith(`${readerHostFilesDirectory(this.context.filesDir)}/`) || path.split('/').includes('..')) {
        this.invalidateMangaBudgetInventory();
        return;
      }
      const stat = await statIfPresent(path);
      if (this.mangaBudgetInventory !== inventory) return;
      if (stat === undefined || !stat.isFile()) { this.invalidateMangaBudgetInventory(); return; }
      // First publication over orphaned bytes changes attribution for the
      // entire version directory. Let actual identity/manifest admission settle it.
      if (!external && path.endsWith('/manga-identity.json') && inventory.files.get(path)?.owners.length !== 1) {
        const prefix = path.slice(0, path.lastIndexOf('/') + 1);
        for (const knownPath of inventory.files.keys()) {
          if (knownPath !== path && knownPath.startsWith(prefix)) { this.invalidateMangaBudgetInventory(); return; }
        }
      }
      inventory.files.set(path, { path, owners, live: false, size: stat.size,
        physicalKey: this.mangaPhysicalKey(stat), mtime: String(stat.mtimeNs), external });
      // A warm budget may have copied the old entries while stat was pending.
      // Advance the revision in the same turn as publishing the new metadata.
      this.mangaInventoryRevision++;
    } catch (_) { this.invalidateMangaBudgetInventory(); }
  }

  private mangaBudgetFileRemoved(path: string): void {
    this.mangaInventoryRevision++;
    const files = this.mangaBudgetInventory?.files;
    files?.delete(path);
    if (files !== undefined && path.endsWith('/manga-identity.json')) {
      const prefix = path.slice(0, path.lastIndexOf('/') + 1);
      for (const knownPath of files.keys()) {
        if (knownPath.startsWith(prefix)) { this.invalidateMangaBudgetInventory(); return; }
      }
    }
  }

  private async removeMangaInventoryFiles(files: MangaExternalFile[], remove: () => Promise<boolean>): Promise<boolean> {
    let removed = false;
    try {
      removed = await remove();
      if (removed) for (const file of files) this.mangaBudgetFileRemoved(file.path);
      return removed;
    } finally {
      if (!removed) this.invalidateMangaBudgetInventory();
    }
  }

  private async collectMangaFiles(directory: string, inheritedOwners: MangaStorageChapter[], result: MangaInventoryFile[]): Promise<void> {
    let owners = inheritedOwners;
    const identityPath = `${directory}/manga-identity.json`;
    if (await fileIo.access(identityPath)) {
      try {
        const raw = await readMangaMetadataBytes(identityPath, MANGA_IDENTITY_METADATA_BYTES, (): boolean => !this.closed);
        const value = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(raw)) as MangaStorageChapter;
        assertMangaStorageChapter(value);
        const expected = `${this.rootDirectory()}/${await bookHash(value.sourceId, value.bookId)}/.manga/` +
          `${await sha256Text(value.chapterId)}/${await sha256Text(value.contentVersion)}`;
        owners = expected === directory ? [value] : [];
      } catch (_) { owners = []; }
    } else if (owners.length === 0) {
      const manifest = await readDiskManifestIdentity(directory, CACHE_FORMAT_VERSION, (): boolean => !this.closed, undefined, true) ??
        await readDiskManifestIdentity(directory, LEGACY_CACHE_FORMAT_VERSION, (): boolean => !this.closed, undefined, true);
      if (manifest !== undefined && manifest.manga !== true) return;
    }
    for (const name of await listFileIfPresent(directory)) {
      const path = `${directory}/${name}`;
      const stat = await statIfPresent(path);
      if (stat === undefined) continue;
      if (stat.isDirectory()) await this.collectMangaFiles(path, owners, result);
      else if (stat.isFile()) {
        // Exact novel manifests keep their existing quota policy. Unknown old
        // manga bytes remain protected, even when their ordinal is recognizable.
        result.push({ path, owners, live: false, size: stat.size, physicalKey: this.mangaPhysicalKey(stat),
          mtime: String(stat.mtimeNs), external: false });
      }
    }
  }

  private mangaPhysicalKey(stat: fileIo.Stat): string {
    // All inventory roots, including external display files, are confined to
    // this private filesDir on the same app-data volume. The public SDK exposes
    // bigint ino, not POSIX dev. Keep the sandbox namespace plus its exact inode
    // so hard-linked originals/display files still share one physical owner.
    return `${readerHostFilesDirectory(this.context.filesDir)}:${stat.ino}`;
  }

  /** Automatic maintenance shares the public total cache budget. Per-kind
   * partitions and incoming bytes stay with the write reservation's predicate.
   * Read directly inside the policy lane; re-enqueuing it would await itself. */
  private async mangaMaintenanceHasCapacity(): Promise<boolean> {
    const { buckets, capacity } = await this.readMangaBudget();
    return buckets.ordinaryBytes + this.mangaOrdinaryReservedBytes <= capacity.cacheBudgetBytes &&
      capacity.freeBytes >= capacity.systemReserveBytes + this.mangaReservedBytes;
  }

  private async evictMangaCandidates(reason: MangaStorageReason, scope?: MangaStorageScope, enough?: () => Promise<boolean>, batched: boolean = false): Promise<void> {
    const authority = this.mangaAuthority;
    if (authority === undefined || this.closed) return;
    const hasCapacity = enough ?? (reason === 'capacity' ?
      (): Promise<boolean> => this.mangaMaintenanceHasCapacity() : undefined);
    const epoch = this.mangaStorageEpoch;
    const expiry: MangaExpiryGuard | undefined = reason === 'expiry' ? {
      nowSeconds: Math.floor(Date.now() / 1000),
      ttlSeconds: this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS,
    } : undefined;
    const current = (): boolean => !this.closed && this.mangaAuthority === authority && epoch === this.mangaStorageEpoch &&
      this.mangaRestoreRequests === 0 && !this.mangaRestoreBlocked &&
      (expiry === undefined || expiry.ttlSeconds === (this.configuredCleanupTtlSeconds ?? MANGA_READ_TTL_SECONDS));
    const localAtRead = new Map(this.mangaEvicting);
    const pending = await authority.pending();
    const active = new Set(pending.map(grant => mangaChapterKey(grant)));
    await this.mangaPolicyStep(batched, async (): Promise<void> => {
      if (!current()) return;
      // Core may have completed a grant whose reply was lost. Retire only
      // unchanged local fences after the authoritative read outside the
      // foreground lane. A concurrent, newer grant keeps its own fence.
      for (const [key, grant] of localAtRead) {
        if (!active.has(key) && this.mangaEvicting.get(key) === grant) this.mangaEvicting.delete(key);
      }
    });
    if (!current()) return;
    for (const grant of pending) {
      if (!current()) return;
      if (scope !== undefined && (grant.sourceId !== scope.sourceId || grant.bookId !== scope.bookId)) continue;
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        if (!current() || this.bookMutationTails.has(bookMutationKey(grant.sourceId, grant.bookId))) return;
        if (batched && !(await authority.pending()).some(latest => latest.grantToken === grant.grantToken &&
          mangaChapterKey(latest) === mangaChapterKey(grant))) return;
        await this.removeMangaGrant(grant, current);
      });
      if (batched) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
    }
    if (hasCapacity !== undefined && await hasCapacity()) return;
    const candidates = await authority.candidates(reason, scope, expiry);
    const classSnapshot = new Map(candidates.map((candidate, index) => [mangaChapterKey(candidate), index]));
    const policySnapshot = candidates.length > 0 && reason === 'expiry' && authority.policyBatch !== undefined ?
      await fetchAuthorityPolicyBatch(this.mangaAuthority, candidates) : undefined;
    if (policySnapshot !== undefined && policySnapshot.length !== candidates.length) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
    const classes = candidates.length === 0 ? [] : policySnapshot?.map(policy => policy.status) ??
      (authority.classifyBatch === undefined ? undefined : await fetchAuthorityClassBatch(this.mangaAuthority, candidates));
    if (classes !== undefined && classes.length !== candidates.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
    for (const candidate of candidates) {
      if (!current()) return;
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        const key = mangaChapterKey(candidate);
        if (!current() || this.mangaBusy.has(key) || this.mangaEvicting.has(key)) return;
        if (this.bookMutationTails.has(bookMutationKey(candidate.sourceId, candidate.bookId))) return;
        const index = classSnapshot?.get(key);
        const classification = classes === undefined || index === undefined ? await authority.classify(candidate) : classes[index];
        if (classification !== 'cache') return;
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
        if (mangaChapterKey(grant) !== key || grant.grantToken.trim().length === 0) throw new Error('invalid manga eviction grant');
        this.mangaEvicting.set(key, grant);
        await this.removeMangaGrant(grant, current);
      });
      if (hasCapacity !== undefined && await hasCapacity()) return;
      if (batched) await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
    }
    if (!current()) return;
    await this.trimMangaDownloadDerived(reason, scope, hasCapacity, batched);
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
    const ordinaryCandidates = new Set((await authority.candidates('clear')).map(chapter => mangaChapterKey(chapter)));
    const chapters = new Map<string, MangaStorageChapter>();
    for (const file of files) if (file.external) for (const owner of file.owners)
      chapters.set(mangaChapterKey(owner), owner);
    const chapterValues = Array.from(chapters.values());
    let values: MangaStoragePolicy[];
    if (authority.policyBatch !== undefined) {
      values = await fetchAuthorityPolicyBatch(this.mangaAuthority, chapterValues) ?? [];
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
        file.owners.every(owner => eligible.has(mangaChapterKey(owner))) :
        file.owners.every(owner => ordinaryCandidates.has(mangaChapterKey(owner)));
      if (!ownersEligible) return false;
      return !file.owners.some(owner => {
        const key = mangaChapterKey(owner);
        return this.mangaBusy.has(key) || this.mangaEvicting.has(key) || this.mangaClaiming.has(key) ||
          this.bookMutationTails.has(bookMutationKey(owner.sourceId, owner.bookId));
      });
    };
    const eligibleByPhysicalKey = new Map<string, boolean>();
    for (const file of files)
      eligibleByPhysicalKey.set(file.physicalKey, eligibleByPhysicalKey.get(file.physicalKey) !== false && isEligible(file));
    for (const [key, eligible] of eligibleByPhysicalKey) if (eligible) physical.add(key);
    return physical;
  }

  private mangaDerivedDeletionFiles(chapter: MangaStorageChapter, files: MangaInventoryFile[]): MangaExternalFile[] | undefined {
    return mangaDerivedDeletionFilesForChapter(chapter, files, (path: string): boolean => this.inFlightWrites.has(path));
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
        candidates.set(mangaChapterKey(owner), owner);
      }
    }
    for (const chapter of candidates.values()) {
      await this.mangaPolicyStep(batched, async (): Promise<void> => {
        const key = mangaChapterKey(chapter);
        const bookKey = bookMutationKey(chapter.sourceId, chapter.bookId);
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
            await this.removeMangaInventoryFiles(selected, (): Promise<boolean> => external.removeDerived!(chapter, selected, current));
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
    const key = mangaChapterKey(chapter);
    const matching = files.filter(file => file.owners.some(owner => mangaChapterKey(owner) === key));
    const unsafe = new Set(files.filter(alias => alias.live || alias.owners.length === 0 ||
      alias.owners.some(owner => mangaChapterKey(owner) !== key)).map(alias => alias.physicalKey));
    for (const file of matching) {
      if (file.live || file.owners.some(owner => mangaChapterKey(owner) !== key) || this.inFlightWrites.has(file.path)) return undefined;
      if (unsafe.has(file.physicalKey)) return undefined;
    }
    return matching;
  }

  private async removeMangaGrant(grant: MangaStorageGrant, isCurrent?: () => boolean): Promise<boolean> {
    const key = mangaChapterKey(grant);
    this.mangaEvicting.set(key, grant);
    const authority = this.mangaAuthority;
    if (authority === undefined) return false;
    let removed = false;
    try {
      if (this.mangaBusy.has(key) || isCurrent?.() === false) return false;
      await this.enqueueBookMutation(bookMutationKey(grant.sourceId, grant.bookId), async (): Promise<void> => {
        if (this.mangaBusy.has(key) || isCurrent?.() === false) return;
        const files = await this.mangaInventory();
        const matching = this.mangaDeletionFiles(grant, files);
        if (matching === undefined || isCurrent?.() === false) return;
        const external = matching.filter(file => file.external);
        // Do not hold a display mutation lock during a Core operation.
        if (external.length > 0) {
          this.inFlightWriteRevision += 1;
          const storage = this.mangaExternal;
          if (storage === undefined ||
            !(await this.removeMangaInventoryFiles(external, (): Promise<boolean> => storage.remove(grant, external)))) return;
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
    const key = bookMutationKey(sourceId, bookId);
    const generation = this.bookClearGenerations.get(key) ?? 0;
    const mangaEpoch = this.mangaStorageEpoch;
    return (): boolean => !this.closed && (this.bookClearGenerations.get(key) ?? 0) === generation &&
      (!this.mangaBooks.has(key) || (mangaEpoch === this.mangaStorageEpoch && this.mangaRestoreRequests === 0 && !this.mangaRestoreBlocked)) &&
      (isCurrent === undefined || isCurrent());
  }

  close(): void {
    this.closed = true; this.trimVerifiedDigests(); this.invalidateMangaBudgetInventory();
  }

  trimVerifiedDigests(): void {
    this.digestProofEpoch++;
    this.verifiedDigests.clear();
  }

  private async loadTextResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<Uint8Array | undefined> {
    assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    let result: Uint8Array | undefined;
    await this.enqueueBookMutation(bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      assertOperationCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const path = await this.resourcePath(requestedIdentity);
      const legacyRevocation = `${await this.clearMarkerPath(requestedIdentity.sourceId, requestedIdentity.bookId)}.legacy-revoked`;
      // An old clear cannot delete unidentifiable bytes, but it also cannot
      // admit them again. Fresh text writes carry their own exact ownership.
      if (!(await fileIo.access(legacyRevocation)) || await this.ownsTextResource(requestedIdentity)) {
        result = await readRawResourceBytes(path, isCurrent);
      }
      if (result === undefined && hasUnambiguousLegacyResourceIdentity(requestedIdentity) &&
        !(await fileIo.access(legacyRevocation))) {
        // A legacy ordinal alone is never evidence. Only its exact manifest
        // identity/version and listed resource hash authorize byte migration.
        const directory = await this.legacyChapterDirectory(requestedIdentity);
        const manifest = await this.readValidManifest(directory, LEGACY_CACHE_FORMAT_VERSION);
        const hash = await legacyResourceHash(requestedIdentity);
        if (manifest !== undefined && sameChapterIdentity(manifest, requestedIdentity) &&
          manifest.resourceHashes.indexOf(hash) >= 0) {
          result = await readRawResourceBytes(`${directory}/${hash}.bin`, isCurrent);
          if (result !== undefined) {
            const target = await this.chapterDirectory(requestedIdentity);
            await ensureDirectory(target);
            await this.assertWriteCapacity(target, result.byteLength);
            await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
            await this.writeAtomicBytes(path, result, isCurrent);
          }
        }
      }
      assertOperationCurrent(isCurrent);
    });
    return result;
  }

  async loadResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<Uint8Array | undefined> {
    if (mangaChapterOfIdentity(identity) === undefined && identity.mangaDecodeRevision === undefined)
      return this.loadTextResource(identity, isCurrent);
    assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const unpin = this.beginMangaOperation(requestedIdentity);
    let result: Uint8Array | undefined;
    let migrationBytes: Uint8Array | undefined;
    try {
      await this.assertMangaAdmission(requestedIdentity);
      await this.enqueueBookMutation(bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
        assertOperationCurrent(isCurrent);
        await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
        const directory = await this.chapterDirectory(requestedIdentity);
        const path = await this.resourcePath(requestedIdentity);
        result = await this.readMangaResourceBytes(requestedIdentity, directory, path, isCurrent);
        const oldDirectory = await this.ordinalChapterDirectory(requestedIdentity);
        if (result === undefined && directory !== oldDirectory) {
          const manifest = await this.readValidManifest(oldDirectory, CACHE_FORMAT_VERSION,
            mangaCacheProfile(requestedIdentity.mangaDecodeRevision), isCurrent, true);
          const hash = await resourceHash(requestedIdentity);
          if (manifest !== undefined && sameChapterIdentity(manifest, requestedIdentity) &&
            manifest.manga === true && manifest.resourceHashes.indexOf(hash) >= 0) {
            result = await this.readMangaResourceBytes(requestedIdentity, oldDirectory, `${oldDirectory}/${hash}.bin`, isCurrent);
            if (result !== undefined) migrationBytes = result;
          }
        }
        if (result === undefined && mangaCacheProfile(requestedIdentity.mangaDecodeRevision) !== undefined &&
          (await validResourceFile(`${directory}/${await legacyMangaResourceHash(requestedIdentity)}.bin`) ||
            await validResourceFile(`${oldDirectory}/${await legacyMangaResourceHash(requestedIdentity)}.bin`))) {
          assertOperationCurrent(isCurrent); throw new Error('READING_IMAGE_REPROCESS_REQUIRED');
        }
        const legacyRevocation = `${await this.clearMarkerPath(requestedIdentity.sourceId, requestedIdentity.bookId)}.legacy-revoked`;
        if (result === undefined && hasUnambiguousLegacyResourceIdentity(requestedIdentity) && !(await fileIo.access(legacyRevocation))) {
          const legacy = await this.legacyChapterDirectory(requestedIdentity);
          const manifest = await this.readValidManifest(legacy, LEGACY_CACHE_FORMAT_VERSION);
          const hash = await legacyResourceHash(requestedIdentity);
          if (manifest !== undefined && sameChapterIdentity(manifest, requestedIdentity) && manifest.resourceHashes.indexOf(hash) >= 0) {
            result = await readRawResourceBytes(`${legacy}/${hash}.bin`, isCurrent);
            if (result !== undefined) {
              await ensureDirectory(directory); await this.assertWriteCapacity(directory, result.byteLength);
              await this.writeAtomicBytes(path, result, isCurrent);
            }
          }
        }
        assertOperationCurrent(isCurrent);
      });
      if (migrationBytes !== undefined) await this.migrateMangaResource(requestedIdentity,
        await this.resourcePath(requestedIdentity), migrationBytes, isCurrent);
    } finally { unpin(); }
    return result;
  }

  private beginMangaOperation(identity: ReadingImageChapterIdentity): () => void {
    if (identity.mangaDecodeRevision !== undefined) this.mangaBooks.add(bookMutationKey(identity.sourceId, identity.bookId));
    const chapter = mangaChapterOfIdentity(identity);
    return chapter === undefined ? (): void => {} : this.pinMangaChapter(chapter);
  }

  private async assertMangaAdmission(identity: ReadingImageChapterIdentity): Promise<void> {
    const chapter = mangaChapterOfIdentity(identity);
    if (chapter === undefined) return;
    await this.loadMangaStorageAuthority();
    if (this.mangaRestoreRequests > 0 || this.mangaRestoreBlocked) throw new Error('MANGA_CACHE_STORAGE_RESTORING');
    if (this.mangaEvicting.has(mangaChapterKey(chapter))) throw new Error('MANGA_CACHE_EVICTING');
  }

  private async readMangaResourceBytes(identity: ReadingImageCacheIdentity, directory: string, path: string,
    isCurrent: () => boolean): Promise<Uint8Array | undefined> {
    if (identity.resourceRef !== undefined && await validResourceFile(path)) {
      const hash = await resourceHash(identity);
      const manifest = await readDiskManifestIdentity(directory, CACHE_FORMAT_VERSION, isCurrent, mangaCacheProfile(identity.mangaDecodeRevision), true);
      const partialDigest = `${path}.sha256`;
      let expected: string | undefined;
      if (manifest !== undefined && sameChapterIdentity(manifest, identity) && manifest.manga === true && manifest.resourceHashes.indexOf(hash) >= 0) {
        expected = manifest.resourceDigests?.[hash];
      } else if (await fileIo.access(partialDigest)) {
        expected = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(await readMangaMetadataBytes(partialDigest, 64, isCurrent));
      }
      if (expected !== undefined) {
        if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error('MANGA_CACHE_RESOURCE_CORRUPT');
        const proofEpoch = this.digestProofEpoch;
        const bytes = await this.readVerifiedResourceBytes(path, expected, await readResourceFingerprint(path), proofEpoch, isCurrent);
        if (bytes === undefined) throw new Error('MANGA_CACHE_RESOURCE_CORRUPT');
        return bytes;
      }
      if (manifest?.manga === true && expected === undefined) throw new Error('MANGA_CACHE_RESOURCE_CORRUPT');
    }
    return readRawResourceBytes(path, isCurrent);
  }

  private async migrateMangaResource(identity: ReadingImageCacheIdentity, path: string, bytes: Uint8Array, valid: () => boolean): Promise<void> {
    const chapter = mangaChapterOfIdentity(identity);
    const reservation = chapter === undefined ? undefined : await this.reserveExternalWrite(chapter, bytes.byteLength + this.mangaIdentityBytes(chapter).byteLength + 64, identity.priority);
    try {
      await this.enqueueBookMutation(bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      const directory = await this.chapterDirectory(identity); await ensureDirectory(directory);
      if (chapter !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, this.mangaIdentityBytes(chapter), valid, chapter);
      await this.assertWriteCapacity(directory, bytes.byteLength, chapter !== undefined); await this.writeAtomicBytes(path, bytes, valid, chapter);
      await this.writeAtomicBytes(`${path}.sha256`, new util.TextEncoder().encodeInto(await sha256Bytes(bytes)), valid, chapter);
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
    assertResourceIdentity(identity);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`offline reading image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const payload = bytes.slice();
    const chapter = mangaChapterOfIdentity(requestedIdentity);
    const identityBytes = chapter === undefined ? undefined : this.mangaIdentityBytes(chapter);
    const reservation = chapter === undefined ? undefined : await this.reserveExternalWrite(chapter,
      payload.byteLength + (identityBytes?.byteLength ?? 0) + 64, identity.priority);
    const unpin = chapter === undefined ? this.beginMangaOperation(requestedIdentity) : (): void => {};
    try { await this.enqueueBookMutation(bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      assertOperationCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const directory = await this.chapterDirectory(requestedIdentity);
      await ensureDirectory(directory);
      if (chapter === undefined && requestedIdentity.mangaDecodeRevision === undefined)
        await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
      if (identityBytes !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, identityBytes, isCurrent, chapter);
      await this.assertWriteCapacity(directory, payload.byteLength, chapter !== undefined);
      const path = await this.resourcePath(requestedIdentity);
      await this.writeAtomicBytes(path, payload, isCurrent, chapter);
      if (chapter !== undefined) await this.writeAtomicBytes(`${path}.sha256`, new util.TextEncoder().encodeInto(await sha256Bytes(payload)), isCurrent, chapter);
    }); } finally { unpin(); reservation?.release(); }
  }

  async removeResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<void> {
    assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const unpin = this.beginMangaOperation(requestedIdentity);
    try { await this.assertMangaAdmission(requestedIdentity);
      await this.enqueueBookMutation(bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      assertOperationCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const path = await this.resourcePath(requestedIdentity);
      this.verifiedDigests.remove(path);
      await this.unlinkIfPresent(path);
      await this.unlinkIfPresent(`${path}.sha256`);
      // Do not permit a corrupt migrated resource to be loaded again from v1.
      const legacyDirectory = await this.legacyChapterDirectory(requestedIdentity);
      const manifest = await this.readValidManifest(legacyDirectory, LEGACY_CACHE_FORMAT_VERSION);
      const hash = await legacyResourceHash(requestedIdentity);
      if (manifest !== undefined && sameChapterIdentity(manifest, requestedIdentity) &&
        hasUnambiguousLegacyResourceIdentity(requestedIdentity) && manifest.resourceHashes.indexOf(hash) >= 0) {
        await this.unlinkIfPresent(`${legacyDirectory}/${hash}.bin`);
      }
    }); } finally { unpin(); }
  }

  async markChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
    isCurrent: () => boolean = this.captureValidity(chapter.sourceId, chapter.bookId),
  ): Promise<void> {
    assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const requestedResources = resources.map((resource: ReadingImageCacheIdentity): ReadingImageCacheIdentity => ({ ...resource }));
    const mangaChapter = mangaChapterOfIdentity(requestedChapter);
    const identityBytes = mangaChapter === undefined ? undefined : this.mangaIdentityBytes(mangaChapter);
    const reservation = mangaChapter === undefined ? undefined : await this.reserveExternalWrite(mangaChapter,
      (identityBytes?.byteLength ?? 0) * 2 + requestedResources.length * 220 + 1024, chapter.priority);
    const unpin = mangaChapter === undefined ? this.beginMangaOperation(requestedChapter) : (): void => {};
    try { await this.enqueueBookMutation(bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      assertOperationCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      const resourceHashes: string[] = [];
      const manga = requestedResources.some(resource => resource.resourceRef !== undefined);
      if (manga && requestedChapter.mangaDecodeRevision === undefined) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
      const profile = mangaCacheProfile(requestedChapter.mangaDecodeRevision);
      if (manga && requestedResources.some(resource => resource.resourceRef === undefined)) throw new Error('mixed manga resource manifest');
      const resourceDigests: Record<string, string> = {};
      const directory = await this.chapterDirectory(requestedChapter);
      for (const resource of requestedResources) {
        assertResourceIdentity(resource);
        assertSameChapterIdentity(requestedChapter, resource);
        if (manga && resource.mangaDecodeRevision !== requestedChapter.mangaDecodeRevision) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
        const hash = await resourceHash(resource);
        if (!(await validResourceFile(`${directory}/${hash}.bin`))) {
          throw new Error('offline reading image manifest cannot reference missing bytes');
        }
        if (manga) {
          const bytes = await readRawResourceBytes(`${directory}/${hash}.bin`, isCurrent);
          if (bytes === undefined) throw new Error('offline manga bytes disappeared');
          resourceDigests[hash] = await sha256Bytes(bytes);
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
      await ensureDirectory(directory);
      if (identityBytes !== undefined) await this.writeAtomicBytes(`${directory}/manga-identity.json`, identityBytes, isCurrent, mangaChapter);
      const manifestBytes = new util.TextEncoder().encodeInto(JSON.stringify(manifest));
      await this.assertWriteCapacity(directory, manifestBytes.byteLength, mangaChapter !== undefined);
      await this.writeAtomicBytes(manifestPathForDirectory(directory, profile), manifestBytes, isCurrent, mangaChapter);
      // Publication never reclaims another version (or an active display's
      // resources). Only an explicit Core-first book clear owns that decision.
    }); } finally { unpin(); reservation?.release(); }
  }

  async isChapterComplete(chapter: ReadingImageChapterIdentity): Promise<boolean> {
    assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const isCurrent = this.captureValidity(chapter.sourceId, chapter.bookId);
    let complete = false;
    const unpin = this.beginMangaOperation(requestedChapter);
    try { await this.assertMangaAdmission(requestedChapter);
      await this.enqueueBookMutation(bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      assertOperationCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      let value = await this.readValidManifest(await this.chapterDirectory(requestedChapter), CACHE_FORMAT_VERSION,
        mangaCacheProfile(requestedChapter.mangaDecodeRevision), isCurrent, requestedChapter.mangaDecodeRevision !== undefined);
      if (value === undefined && mangaChapterOfIdentity(requestedChapter) !== undefined) value = await this.readValidManifest(
        await this.ordinalChapterDirectory(requestedChapter), CACHE_FORMAT_VERSION, mangaCacheProfile(requestedChapter.mangaDecodeRevision), isCurrent, true);
      assertOperationCurrent(isCurrent);
      complete = value !== undefined && sameChapterIdentity(value, requestedChapter) &&
        (value.manga !== true || requestedChapter.mangaDecodeRevision !== undefined);
    }); } finally { unpin(); }
    return complete;
  }

  /** An ordinal without a body version cannot prove the current catalog's assets. */
  async isChapterMaterialized(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean> {
    assertNonBlankValue(sourceId, 'sourceId');
    assertNonBlankValue(bookId, 'bookId');
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
      const value = await readDiskManifestIdentity(directory, formatVersion, isCurrent, profile, manga);
      if (value === undefined || !Array.isArray(value.resourceHashes) ||
        (!manga && profile === undefined && !isTextOwnershipManifest(value))) return undefined;
      for (const hash of value.resourceHashes) {
        if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
          !(await validResourceFile(`${directory}/${hash}.bin`))) return undefined;
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

  private async matchesResourceDigest(path: string, expected: string,
    isCurrent: () => boolean = (): boolean => !this.closed): Promise<boolean> {
    assertOperationCurrent(isCurrent);
    const proofEpoch = this.digestProofEpoch;
    const before = await readResourceFingerprint(path);
    const verified = this.verifiedDigests.get(path);
    if (before !== undefined && verified?.fingerprint === before && verified.digest === expected) {
      assertOperationCurrent(isCurrent); return true;
    }
    return (await this.readVerifiedResourceBytes(path, expected, before, proofEpoch, isCurrent)) !== undefined;
  }

  private async readVerifiedResourceBytes(path: string, expected: string, before: string | undefined, proofEpoch: number,
    isCurrent: () => boolean): Promise<Uint8Array | undefined> {
    const proof = this.verifiedDigests.get(path);
    const alreadyVerified = before !== undefined && proof?.fingerprint === before && proof.digest === expected;
    if (!alreadyVerified) this.verifiedDigests.remove(path);
    const bytes = await readRawResourceBytes(path, isCurrent);
    if (bytes === undefined || (!alreadyVerified && await sha256Bytes(bytes) !== expected)) return undefined;
    const after = await readResourceFingerprint(path);
    assertOperationCurrent(isCurrent);
    if (before !== undefined && after !== before) return undefined;
    if (after !== undefined && before === after && proofEpoch === this.digestProofEpoch)
      this.verifiedDigests.put(path, { fingerprint: after, digest: expected });
    return bytes;
  }

  /** Called only after Core has invalidated the corresponding usable refs. */
  async clearBook(sourceId: string, bookId: string, manga: boolean = false): Promise<void> {
    assertNonBlankValue(sourceId, 'sourceId');
    assertNonBlankValue(bookId, 'bookId');
    const key = bookMutationKey(sourceId, bookId);
    if (manga) {
      this.mangaBooks.add(key);
      // Ordinary clear never turns a Core candidate into blanket book deletion.
      await this.maintainMangaStorage('clear', { sourceId, bookId });
      return;
    }
    this.bookClearGenerations.set(key, (this.bookClearGenerations.get(key) ?? 0) + 1);
    await this.enqueueBookMutation(key, async (): Promise<void> => {
      const directory = `${this.rootDirectory()}/${await bookHash(sourceId, bookId)}`;
      for (const proofPath of this.verifiedDigests.keys()) if (proofPath.startsWith(`${directory}/`)) this.verifiedDigests.remove(proofPath);
      const marker = await this.clearMarkerPath(sourceId, bookId);
      await ensureDirectory(`${this.rootDirectory()}/.clear`);
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
  async clearChapter(sourceId: string, bookId: string, chapterIndex: number, captured?: ReadingImageCleanupFile[],
    current?: () => boolean): Promise<void> {
    assertNonBlankValue(sourceId, 'sourceId'); assertNonBlankValue(bookId, 'bookId');
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) throw new Error('invalid chapterIndex');
    const key = bookMutationKey(sourceId, bookId);
    this.bookClearGenerations.set(key, (this.bookClearGenerations.get(key) ?? 0) + 1);
    await this.enqueueBookMutation(key, async (): Promise<void> => {
      if (captured !== undefined) {
        await this.clearCapturedTextFiles(sourceId, bookId, chapterIndex, captured, current);
        return;
      }
      await ensureDirectory(`${this.rootDirectory()}/.clear`);
      const marker = `${await this.clearMarkerPath(sourceId, bookId)}.chapter-${chapterIndex}`;
      await this.writeAtomicBytes(marker, new util.TextEncoder().encodeInto('clear'));
      await this.finishPendingChapterClears(sourceId, bookId);
    });
  }

  private clearOpsContext(): ReadingImageClearOpsContext {
    return {
      rootDirectory: (): string => this.rootDirectory(),
      legacyRootDirectory: (): string => this.legacyRootDirectory(),
      isOpen: (): boolean => !this.closed,
      mangaPhysicalKey: (stat: fileIo.Stat): string => this.mangaPhysicalKey(stat),
      removeVerifiedDigest: (path: string): void => { this.verifiedDigests.remove(path); },
      verifiedDigestKeys: (): string[] => this.verifiedDigests.keys(),
      writeAtomicBytes: (path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> =>
        this.writeAtomicBytes(path, bytes, isCurrent),
      unlinkIfPresent: (path: string): Promise<void> => this.unlinkIfPresent(path),
    };
  }

  private async clearCapturedTextFiles(sourceId: string, bookId: string, chapterIndex: number,
    captured: ReadingImageCleanupFile[], current?: () => boolean): Promise<void> {
    await clearCapturedTextFilesOps(this.clearOpsContext(), sourceId, bookId, chapterIndex, captured, current);
  }

  private async finishPendingChapterClears(sourceId: string, bookId: string): Promise<void> {
    await finishPendingChapterClearsOps(this.clearOpsContext(), sourceId, bookId);
  }

  private async finishPendingClear(sourceId: string, bookId: string): Promise<void> {
    await finishPendingClearOps(this.clearOpsContext(), sourceId, bookId);
  }

  private async ownsTextResource(identity: ReadingImageCacheIdentity): Promise<boolean> {
    const directory = await this.chapterDirectory(identity);
    const hash = await resourceHash(identity);
    for (const fileName of ['manifest.json', 'text-identity.json']) {
      const value = await readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, (): boolean => !this.closed, fileName, true);
      if (value !== undefined && isTextOwnershipManifest(value) && sameChapterIdentity(value, identity) &&
        (fileName !== 'text-identity.json' || value.cacheOwner === TEXT_CACHE_OWNER) && value.resourceHashes.indexOf(hash) >= 0) return true;
    }
    return false;
  }

  /** Partial writes need durable ownership without publishing completion. */
  private async recordTextResourceOwnership(identity: ReadingImageCacheIdentity, current: () => boolean): Promise<void> {
    const directory = await this.chapterDirectory(identity);
    if (await containsMangaManifest(directory, (): boolean => !this.closed)) throw new Error('text image cache cannot overwrite manga ownership');
    const previous = await readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, (): boolean => !this.closed, 'text-identity.json', true);
    if ((previous === undefined && await fileIo.access(`${directory}/text-identity.json`)) ||
      (previous !== undefined && (!isTextOwnershipManifest(previous) || previous.cacheOwner !== TEXT_CACHE_OWNER ||
      !sameChapterIdentity(previous, identity)))) throw new Error('text image cache ownership mismatch');
    const hashes = new Set<string>(previous?.resourceHashes ?? []);
    hashes.add(await resourceHash(identity));
    const ownership: ReadingImageChapterManifest = { formatVersion: CACHE_FORMAT_VERSION, cacheOwner: TEXT_CACHE_OWNER,
      sourceId: identity.sourceId, bookId: identity.bookId, chapterIndex: identity.chapterIndex,
      contentVersion: identity.contentVersion, resourceHashes: Array.from(hashes).sort(), completedAt: 0 };
    await this.writeAtomicBytes(`${directory}/text-identity.json`, new util.TextEncoder().encodeInto(JSON.stringify(ownership)), current);
  }

  private async clearMarkerPath(sourceId: string, bookId: string): Promise<string> {
    return `${this.rootDirectory()}/.clear/${await bookHash(sourceId, bookId)}.pending`;
  }

  private async chapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    const chapter = mangaChapterOfIdentity(identity);
    if (chapter !== undefined) return `${this.rootDirectory()}/${await bookHash(identity.sourceId, identity.bookId)}/` +
      `.manga/${await sha256Text(chapter.chapterId)}/${await sha256Text(chapter.contentVersion)}`;
    return this.ordinalChapterDirectory(identity);
  }

  private async ordinalChapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.rootDirectory()}/${await bookHash(identity.sourceId, identity.bookId)}/` +
      `${identity.chapterIndex}/${await sha256Text(identity.contentVersion)}`;
  }

  private async isMangaBook(sourceId: string, bookId: string): Promise<boolean> {
    const key = bookMutationKey(sourceId, bookId);
    if (this.mangaBooks.has(key)) return true;
    const directory = `${this.rootDirectory()}/${await bookHash(sourceId, bookId)}`;
    if (await fileIo.access(`${directory}/.manga`) || await containsMangaManifest(directory, (): boolean => !this.closed) ||
      await containsMangaManifest(`${this.legacyRootDirectory()}/${await legacyBookHash(sourceId, bookId)}`, (): boolean => !this.closed)) {
      this.mangaBooks.add(key); return true;
    }
    return false;
  }


  private async legacyChapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.legacyRootDirectory()}/${await legacyBookHash(identity.sourceId, identity.bookId)}/${identity.chapterIndex}`;
  }

  private async resourcePath(identity: ReadingImageCacheIdentity): Promise<string> {
    return `${await this.chapterDirectory(identity)}/${await resourceHash(identity)}.bin`;
  }

  private enqueueBookMutation(
    key: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    this.inFlightWriteRevision += 1;
    const previous = this.bookMutationTails.get(key) ?? Promise.resolve();
    const task = previous.catch((): void => {}).then(operation);
    const settled = task.catch((): void => {});
    this.bookMutationTails.set(key, settled);
    return task.finally((): void => {
      this.inFlightWriteRevision += 1;
      if (this.bookMutationTails.get(key) === settled) {
        this.bookMutationTails.delete(key);
      }
    });
  }

  private rootDirectory(): string {
    return `${readerHostFilesDirectory(this.context.filesDir)}/reader-offline/images-v2`;
  }

  private legacyRootDirectory(): string {
    return `${readerHostFilesDirectory(this.context.filesDir)}/reader-offline/images-v1`;
  }

  private async writeAtomicBytes(path: string, bytes: Uint8Array, isCurrent?: () => boolean,
    owner?: MangaStorageChapter): Promise<void> {
    this.verifiedDigests.remove(path);
    const existing = this.inFlightWrites.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.enqueueWrite(async (): Promise<void> => {
      const inventoried = path.startsWith(`${this.rootDirectory()}/`) || path.startsWith(`${this.legacyRootDirectory()}/`);
      try { await this.performAtomicWrite(path, bytes, isCurrent); }
      catch (error) { if (inventoried) this.invalidateMangaBudgetInventory(); throw error; }
      if (owner !== undefined) await this.recordMangaBudgetPath(path, [owner], false);
      else if (inventoried) this.invalidateMangaBudgetInventory();
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
    await performAtomicFileWrite(path, `${path}.tmp-${this.nextTemporaryFile}`, bytes, isCurrent);
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

  private async unlinkIfPresent(path: string): Promise<void> {
    try {
      await fileIo.unlink(path);
      this.inFlightWriteRevision += 1;
    } catch (error) {
      if (!isNotFoundError(error)) { this.invalidateMangaBudgetInventory(); throw error; }
    }
    this.mangaBudgetFileRemoved(path);
  }

}
