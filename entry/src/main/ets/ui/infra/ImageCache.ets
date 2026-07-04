// Reader for HarmonyOS - L5 应用基础设施层 - ImageCache
// 图片缓存,LRU + 内存 + 磁盘二级缓存

import { ReaderLogger } from '../foundation/ReaderLogger';

interface CacheEntry {
  key: string;
  data: PixelMap | string;  // PixelMap 或 base64
  size: number;
  lastAccess: number;
}

export class ImageCache {
  private static instance: ImageCache;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private maxMemoryEntries: number = 50;
  private maxMemorySize: number = 20 * 1024 * 1024;  // 20MB
  private currentSize: number = 0;

  static shared(): ImageCache {
    if (!ImageCache.instance) ImageCache.instance = new ImageCache();
    return ImageCache.instance;
  }

  get(key: string): PixelMap | string | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    entry.lastAccess = Date.now();
    return entry.data;
  }

  put(key: string, data: PixelMap | string, size: number): void {
    // 移除旧条目(如果存在)
    if (this.memoryCache.has(key)) {
      const old = this.memoryCache.get(key)!;
      this.currentSize -= old.size;
      this.memoryCache.delete(key);
    }
    // 检查容量,LRU 淘汰
    while (this.memoryCache.size >= this.maxMemoryEntries || this.currentSize + size > this.maxMemorySize) {
      this.evictLRU();
    }
    this.memoryCache.set(key, {
      key: key,
      data: data,
      size: size,
      lastAccess: Date.now()
    });
    this.currentSize += size;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime: number = Date.now();
    for (const [k, v] of this.memoryCache) {
      if (v.lastAccess < oldestTime) {
        oldestTime = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const entry = this.memoryCache.get(oldestKey)!;
      this.currentSize -= entry.size;
      this.memoryCache.delete(oldestKey);
    }
  }

  remove(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.memoryCache.delete(key);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    this.currentSize = 0;
  }

  size(): number { return this.memoryCache.size; }
  bytes(): number { return this.currentSize; }
}
