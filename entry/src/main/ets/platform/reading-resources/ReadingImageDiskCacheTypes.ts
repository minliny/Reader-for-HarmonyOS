import statfs from '@ohos.file.statvfs';

export const CACHE_FORMAT_VERSION = 2;
export const LEGACY_CACHE_FORMAT_VERSION = 1;
export const TEXT_CACHE_OWNER = 'reader-text-images-v2';
export const MANGA_SCRIPT_CACHE_PROFILE = 'script-bgra-v2';
export const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
export const READING_IMAGE_WRITE_CHUNK_BYTES = 1024 * 1024;
export const MIN_READING_IMAGE_FREE_RESERVE_BYTES = 16 * 1024 * 1024;
export const FILE_SYSTEM_NO_SPACE_ERROR = 13900025;
/**
 * The cache ceiling is a safety cap, not the default budget.  The actual
 * budget is derived from the volume reported by statvfs so a small VM cannot
 * consume its whole data partition.  A probe without total-size support keeps
 * the historical cap as a conservative compatibility fallback.
 */
export const MANGA_CACHE_BUDGET_MAX_BYTES = 10 * 1024 * 1024 * 1024;
export const MANGA_FREE_RESERVE_BYTES = 512 * 1024 * 1024;
export const MANGA_FOREGROUND_RESERVE_BYTES = 32 * 1024 * 1024;
export const MANGA_SYSTEM_RESERVE_RATIO = 0.10;
export const MANGA_SYSTEM_RESERVE_FLOOR_BYTES = 64 * 1024 * 1024;
export const MANGA_DERIVED_BUDGET_RATIO = 0.75;
export const MANGA_FOREGROUND_CHECK_MS = 24 * 60 * 60 * 1000;
export const MANGA_BUDGET_CALIBRATION_MS = 60 * 1000;
export const MANGA_READ_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MANGA_IDENTITY_METADATA_BYTES = 64 * 1024;
export const MANGA_MANIFEST_METADATA_BYTES = 2 * 1024 * 1024;
/**
 * Core's classify/policy batch contract accepts at most 256 chapters. Keep a
 * lower ceiling here so storage summaries and maintenance remain safe when a
 * large shelf is handed to the Host. The helper below restores the original
 * ordering after issuing one bounded request per slice.
 */
export const MANGA_AUTHORITY_BATCH_SIZE = 128;

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
  candidates(reason: MangaStorageReason, scope?: MangaStorageScope, expiry?: MangaExpiryGuard): Promise<MangaStorageChapter[]>;
  claim(chapter: MangaStorageChapter, expiry?: MangaExpiryGuard): Promise<MangaStorageGrant | undefined>;
  complete(grant: MangaStorageGrant, removed: boolean): Promise<void>;
  pending(): Promise<MangaStorageGrant[]>;
}
export type MangaExternalFile = { path: string; owners: MangaStorageChapter[]; live: boolean; };
export interface MangaExternalStorage {
  inventory(): Promise<MangaExternalFile[]>;
  /** This adapter reports successful publications and invalidates uncertain mutations. */
  tracksPublishedFiles?: boolean;
  /** The display owner rechecks its own live references under its mutation lock. */
  remove(grant: MangaStorageGrant, files: MangaExternalFile[]): Promise<boolean>;
  /** Rebuildable download display files use no original-content eviction grant.
   * Await the current authority guard before every unlink, then recheck live I/O. */
  removeDerived?(chapter: MangaStorageChapter, files: MangaExternalFile[], current: () => Promise<boolean>): Promise<boolean>;
}
export interface MangaWriteReservation { release(): void; }
export type MangaInventoryFile = MangaExternalFile & { size: number; physicalKey: string; mtime: string; external: boolean; };
export interface MangaBudgetInventory {
  epoch: number;
  calibratedAt: number;
  files: Map<string, MangaInventoryFile>;
}
export type SharedDownloadStoragePolicy = { capacityBytes: number; expiryDays: number; };
export type ReadingTextStorageChapter = { sourceId: string; bookId: string; chapterIndex: number; };
export type ReadingTextStorageImageChapter = ReadingTextStorageChapter & { contentBytes: number; cachedAtSeconds?: number; };
export type ReadingTextStoragePolicy = { retained: boolean; inUse: boolean; };
export type ReadingImageStorageSummary = { totalBytes: number; retainedBytes: number; automaticBytes: number;
  cleanableBytes?: number; availableBytes?: number; classificationKnown: boolean; };
export type ReadingImageCleanupFile = { path: string; physicalKey: string; size: number; mtime: string;
  textOwner?: ReadingTextStorageChapter; };
export type ReadingInventoryFile = MangaInventoryFile & { textOwner?: ReadingTextStorageChapter; };
export type ReadingImageCleanupInventory = { files: ReadingImageCleanupFile[]; };
export type ReadingImageStorageSnapshot = { files: ReadingInventoryFile[]; writeRevision: number;
  hostImageChapters: ReadingTextStorageImageChapter[]; protectedChapters: ReadingTextStorageChapter[]; };

export interface ReadingImageDigestProof { fingerprint: string; digest: string; }

export interface ReadingImageFreeSpaceProbe {
  getFreeBytes(path: string): Promise<number>;
  /** Optional on older SDK fixtures; production statvfs supports it. */
  getTotalBytes?(path: string): Promise<number | undefined>;
}

export class HarmonyReadingImageFreeSpaceProbe implements ReadingImageFreeSpaceProbe {
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

export type MangaStorageBuckets = {
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
export type ReadingImageChapterManifest = {
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
