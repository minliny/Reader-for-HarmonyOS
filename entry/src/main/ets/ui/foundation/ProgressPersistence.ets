// Reader for HarmonyOS - M8 跨层基础设施 - ProgressPersistence.ets
import preferences from '@ohos.data.preferences';
import { ReaderLogger } from './ReaderLogger';

const STORE_NAME = 'reader-progress-store';
const KEY_PREFIX = 'progress:';
const FLUSH_DEBOUNCE_MS = 1000;

export interface ReadingProgress {
  bookId: string;
  chapterId: string;
  pageIndex: number;
  pageCount: number;
  progressPercent: number;
  pageAnchor: string;
  updatedAt: number;
}

export class ProgressPersistence {
  private static instance: ProgressPersistence;
  private store: preferences.Preferences | null = null;
  private cache: Map<string, ReadingProgress> = new Map();
  private flushTimer: number | null = null;

  static shared(): ProgressPersistence {
    if (!ProgressPersistence.instance) ProgressPersistence.instance = new ProgressPersistence();
    return ProgressPersistence.instance;
  }

  async init(context: Context): Promise<void> {
    try {
      this.store = await preferences.getPreferences(context, STORE_NAME);
    } catch (e) {
      ReaderLogger.e('ProgressPersistence', 'init failed', e as Error);
    }
  }

  // 1. 写入内存 cache
  // 2. 异步写入 preferences(debounce 1s)
  async save(bookId: string, progress: ReadingProgress): Promise<void> {
    this.cache.set(bookId, progress);
    this.scheduleFlush();
  }

  async load(bookId: string): Promise<ReadingProgress | null> {
    if (this.cache.has(bookId)) return this.cache.get(bookId)!;
    if (!this.store) return null;
    try {
      const v = await this.store.get(`${KEY_PREFIX}${bookId}`, '') as string;
      if (!v) return null;
      return JSON.parse(v) as ReadingProgress;
    } catch (e) {
      ReaderLogger.e('ProgressPersistence', 'load failed', e as Error);
      return null;
    }
  }

  async listAll(): Promise<ReadingProgress[]> {
    if (!this.store) return [];
    try {
      const all = await this.store.getAll() as Record<string, string>;
      const result: ReadingProgress[] = [];
      for (const k in all) {
        if (k.startsWith(KEY_PREFIX)) {
          try {
            result.push(JSON.parse(all[k]) as ReadingProgress);
          } catch (e) { /* skip */ }
        }
      }
      return result;
    } catch (e) {
      return [];
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushNow();
      this.flushTimer = null;
    }, FLUSH_DEBOUNCE_MS) as number;
  }

  private async flushNow(): Promise<void> {
    if (!this.store) return;
    try {
      for (const [bookId, progress] of this.cache) {
        await this.store.put(`${KEY_PREFIX}${bookId}`, JSON.stringify(progress));
      }
      await this.store.flush();
    } catch (e) {
      ReaderLogger.e('ProgressPersistence', 'flush failed', e as Error);
    }
  }
}
