import type { MangaTile } from './MangaSessionController';

/**
 * Bounds a chapter's completed display leases. The cache owns one acquired
 * display lease per logical tile key; replacing, eviction and clear each
 * release exactly that one acquisition. Durable downloaded files are owned by
 * the Runtime/Host and are never deleted here.
 */
export interface MangaRetainedTileCacheOptions {
  /** Maximum completed leases retained for this chapter. */
  chapterMaxCount?: number;
  /** Maximum estimated decoded bytes retained for this chapter. */
  chapterMaxBytes?: number;
  /** Maximum completed leases retained by all live chapter caches. */
  globalMaxCount?: number;
  /** Maximum estimated decoded bytes retained by all live chapter caches. */
  globalMaxBytes?: number;
  /** Current/neighbor/active tiles are skipped by LRU eviction. */
  isProtected?: (tile: MangaTile, key: string) => boolean;
}

interface RetainedTileRecord {
  key: string;
  tile: MangaTile;
  bytes: number;
  ordinal: number;
  lastUsed: number;
}

const DEFAULT_CHAPTER_MAX_COUNT = 128;
const DEFAULT_CHAPTER_MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_GLOBAL_MAX_COUNT = 256;
const DEFAULT_GLOBAL_MAX_BYTES = 128 * 1024 * 1024;

/** One chapter's completed display leases. This is a Reader lifetime owner. */
export class MangaRetainedTileCache {
  private static readonly liveCaches: Set<MangaRetainedTileCache> = new Set();
  private static clock: number = 0;

  private readonly completed: Map<string, MangaTile> = new Map();
  private readonly records: Map<string, RetainedTileRecord> = new Map();
  private readonly ordinals: Map<number, number> = new Map();
  private readonly releaseTile: (tile: MangaTile) => void;
  private readonly chapterMaxCount: number;
  private readonly chapterMaxBytes: number;
  private readonly globalMaxCount: number;
  private readonly globalMaxBytes: number;
  private readonly isProtected: (tile: MangaTile, key: string) => boolean;
  private retainedBytes: number = 0;
  private registered: boolean = false;

  constructor(releaseTile: (tile: MangaTile) => void, options: MangaRetainedTileCacheOptions = {}) {
    this.releaseTile = releaseTile;
    this.chapterMaxCount = MangaRetainedTileCache.limit(options.chapterMaxCount, DEFAULT_CHAPTER_MAX_COUNT);
    this.chapterMaxBytes = MangaRetainedTileCache.limit(options.chapterMaxBytes, DEFAULT_CHAPTER_MAX_BYTES);
    this.globalMaxCount = MangaRetainedTileCache.limit(options.globalMaxCount, DEFAULT_GLOBAL_MAX_COUNT);
    this.globalMaxBytes = MangaRetainedTileCache.limit(options.globalMaxBytes, DEFAULT_GLOBAL_MAX_BYTES);
    this.isProtected = options.isProtected ?? ((): boolean => false);
  }

  private static limit(value: number | undefined, fallback: number): number {
    return value === undefined || value === Infinity ? fallback :
      Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback;
  }

  private static bytes(tile: MangaTile): number {
    const image = tile.image;
    if (image === undefined) return 0;
    // ReadingGatewayImage intentionally carries no encoded-file byte count.
    // The decoded RGBA footprint is a conservative runtime lease budget and
    // remains stable across the Host's display-file implementation.
    const width = Number.isFinite(image.width) && image.width > 0 ? image.width : 1;
    const height = Number.isFinite(image.height) && image.height > 0 ? image.height : 1;
    const value = Math.ceil(width) * Math.ceil(height) * 4;
    return Number.isSafeInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
  }

  private register(): void {
    if (this.registered) return;
    this.registered = true;
    MangaRetainedTileCache.liveCaches.add(this);
  }

  private unregisterIfEmpty(): void {
    if (this.completed.size !== 0 || !this.registered) return;
    this.registered = false;
    MangaRetainedTileCache.liveCaches.delete(this);
  }

  get length(): number { return this.completed.size; }
  get bytes(): number { return this.retainedBytes; }

  /** Diagnostics for contract tests and the retention evidence record. */
  limits(): { chapterMaxCount: number; chapterMaxBytes: number; globalMaxCount: number; globalMaxBytes: number } {
    return { chapterMaxCount: this.chapterMaxCount, chapterMaxBytes: this.chapterMaxBytes,
      globalMaxCount: this.globalMaxCount, globalMaxBytes: this.globalMaxBytes };
  }

  get(key: string): MangaTile | undefined {
    const tile = this.completed.get(key), record = this.records.get(key);
    if (tile === undefined || record === undefined) return undefined;
    record.lastUsed = ++MangaRetainedTileCache.clock;
    // Map insertion order is also the local LRU order, which makes the normal
    // chapter eviction path allocation-free.
    this.completed.delete(key); this.completed.set(key, tile);
    this.records.delete(key); this.records.set(key, record);
    return tile;
  }

  /** Success transfers one lease to this owner. Rejection leaves the incoming
   * lease with the caller; protected leases never relax either hard limit. */
  keep(key: string, tile: MangaTile): boolean {
    if (tile.image === undefined || tile.error !== undefined) {
      this.releaseTile(tile);
      return true;
    }
    const previous = this.records.get(key);
    if (previous !== undefined && previous.tile === tile) {
      previous.lastUsed = ++MangaRetainedTileCache.clock;
      this.completed.delete(key); this.completed.set(key, tile);
      this.records.delete(key); this.records.set(key, previous);
      return true;
    }
    const record: RetainedTileRecord = { key, tile, bytes: MangaRetainedTileCache.bytes(tile), ordinal: tile.ordinal,
      lastUsed: ++MangaRetainedTileCache.clock };
    if (record.bytes > this.chapterMaxBytes || record.bytes > this.globalMaxBytes) return false;
    const extraCount = previous === undefined ? 1 : 0;
    const extraBytes = record.bytes - (previous?.bytes ?? 0);
    while (this.completed.size + extraCount > this.chapterMaxCount || this.retainedBytes + extraBytes > this.chapterMaxBytes) {
      const candidate = this.oldestUnprotected(key);
      if (candidate === undefined) return false;
      this.remove(candidate.key, true);
    }
    while (true) {
      const limits = MangaRetainedTileCache.globalLimits();
      const count = Math.min(limits.count, this.globalMaxCount), bytes = Math.min(limits.bytes, this.globalMaxBytes);
      if (MangaRetainedTileCache.totalCount() + extraCount <= count && MangaRetainedTileCache.totalBytes() + extraBytes <= bytes) break;
      const owner = MangaRetainedTileCache.globalCandidate(this, key);
      const candidate = owner?.oldestUnprotected(owner === this ? key : undefined);
      if (owner === undefined || candidate === undefined) return false;
      owner.remove(candidate.key, true);
    }
    if (previous !== undefined) this.remove(key, true);
    this.completed.set(key, tile); this.records.set(key, record); this.retainedBytes += record.bytes;
    this.ordinals.set(record.ordinal, (this.ordinals.get(record.ordinal) ?? 0) + 1);
    this.register();
    return true;
  }

  take(key: string): MangaTile | undefined {
    const tile = this.completed.get(key), record = this.records.get(key);
    if (tile === undefined || record === undefined) return undefined;
    this.removeRecord(record);
    this.unregisterIfEmpty();
    return tile;
  }

  hasPage(ordinal: number): boolean { return (this.ordinals.get(ordinal) ?? 0) > 0; }

  clear(): void {
    // Remove the records first so a release callback cannot observe stale
    // ordinal/byte counts or recursively trigger another eviction.
    const records = Array.from(this.records.values());
    this.completed.clear(); this.records.clear(); this.ordinals.clear(); this.retainedBytes = 0;
    this.unregisterIfEmpty();
    for (const record of records) this.releaseTile(record.tile);
  }

  private removeRecord(record: RetainedTileRecord): void {
    if (this.records.get(record.key) !== record || this.completed.get(record.key) !== record.tile) return;
    this.completed.delete(record.key); this.records.delete(record.key);
    this.retainedBytes = Math.max(0, this.retainedBytes - record.bytes);
    const count = this.ordinals.get(record.ordinal) ?? 0;
    if (count <= 1) this.ordinals.delete(record.ordinal); else this.ordinals.set(record.ordinal, count - 1);
  }

  private remove(key: string, release: boolean): void {
    const record = this.records.get(key);
    if (record === undefined) return;
    this.removeRecord(record);
    this.unregisterIfEmpty();
    if (release) this.releaseTile(record.tile);
  }

  private oldestUnprotected(excludedKey?: string): RetainedTileRecord | undefined {
    for (const record of this.records.values()) {
      if (record.key !== excludedKey && !this.isProtected(record.tile, record.key)) return record;
    }
    return undefined;
  }

  private static totalCount(): number {
    let total = 0; for (const cache of MangaRetainedTileCache.liveCaches) total += cache.completed.size; return total;
  }

  private static totalBytes(): number {
    let total = 0; for (const cache of MangaRetainedTileCache.liveCaches) total += cache.retainedBytes; return total;
  }

  private static globalLimits(): { count: number; bytes: number } {
    let count = DEFAULT_GLOBAL_MAX_COUNT, bytes = DEFAULT_GLOBAL_MAX_BYTES;
    for (const cache of MangaRetainedTileCache.liveCaches) {
      // The strictest active budget wins, so one low-memory session cannot be
      // overrun by another chapter session sharing the same Runtime owner.
      count = Math.min(count, cache.globalMaxCount); bytes = Math.min(bytes, cache.globalMaxBytes);
    }
    return { count, bytes };
  }

  private static globalCandidate(excludedOwner: MangaRetainedTileCache, excludedKey: string): MangaRetainedTileCache | undefined {
    let owner: MangaRetainedTileCache | undefined;
    let oldest: RetainedTileRecord | undefined;
    for (const cache of MangaRetainedTileCache.liveCaches) {
      const candidate = cache.oldestUnprotected(cache === excludedOwner ? excludedKey : undefined);
      if (candidate !== undefined && (oldest === undefined || candidate.lastUsed < oldest.lastUsed)) {
        oldest = candidate; owner = cache;
      }
    }
    return owner;
  }

}
