import fileIo from '@ohos.file.fs';
import {
  BookCoverFailureEntry,
  parseBookCoverFailureCache,
  pruneBookCoverFailureEntries,
  recordBookCoverFailureEntry,
  serializeBookCoverFailureCache,
} from './BookCoverDisplay';

const FAILED_COVER_CACHE_FILENAME = 'reader-failed-cover-urls.v1.json';

class BookCoverFailureStore {
  private filePath: string = '';
  private entries: BookCoverFailureEntry[] = [];
  private writeTail: Promise<void> = Promise.resolve();
  private flushScheduled: boolean = false;
  private generation: number = 0;

  async attachCacheDir(cacheDir: string): Promise<void> {
    const trimmed = cacheDir.trim();
    if (trimmed.length === 0) return;
    const path = `${trimmed.replace(/\/+$/, '')}/${FAILED_COVER_CACHE_FILENAME}`;
    const currentGeneration = ++this.generation;
    this.filePath = path;
    try {
      const content = await fileIo.readText(path);
      if (currentGeneration !== this.generation || this.filePath !== path) return;
      const loaded = parseBookCoverFailureCache(content, Date.now());
      const merged = new Map<string, BookCoverFailureEntry>();
      for (const entry of loaded) merged.set(entry.url, entry);
      for (const entry of this.entries) {
        const existing = merged.get(entry.url);
        if (existing === undefined || existing.failedAtMs < entry.failedAtMs) merged.set(entry.url, entry);
      }
      this.entries = pruneBookCoverFailureEntries(Array.from(merged.values()), Date.now());
    } catch (_error) {
      // Missing or unreadable rebuildable cache starts empty without blocking startup.
    }
  }

  snapshotUrls(nowMs: number = Date.now()): string[] {
    this.entries = pruneBookCoverFailureEntries(this.entries, nowMs);
    return this.entries.map((entry: BookCoverFailureEntry): string => entry.url);
  }

  recordFailure(url: string, nowMs: number = Date.now()): string[] {
    const next = recordBookCoverFailureEntry(this.entries, url, nowMs);
    this.entries = next;
    this.scheduleWrite();
    return next.map((entry: BookCoverFailureEntry): string => entry.url);
  }

  clear(): void {
    this.generation += 1;
    this.entries = [];
    this.flushScheduled = false;
    const path = this.filePath;
    if (path.length === 0) return;
    this.writeTail = this.writeTail
      .then((): Promise<void> => fileIo.unlink(path))
      .catch((): void => {});
  }

  private scheduleWrite(): void {
    if (this.filePath.length === 0 || this.flushScheduled) return;
    this.flushScheduled = true;
    const generation = this.generation;
    const path = this.filePath;
    void Promise.resolve().then((): void => {
      this.flushScheduled = false;
      if (generation !== this.generation || path !== this.filePath) return;
      const payload = serializeBookCoverFailureCache(this.entries);
      this.writeTail = this.writeTail
        .then(async (): Promise<void> => {
          if (generation !== this.generation || path !== this.filePath) return;
          const file = await fileIo.open(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
          try {
            await fileIo.write(file.fd, payload);
          } finally {
            await fileIo.close(file);
          }
        })
        .catch((): void => {});
    });
  }
}

export const BookCoverFailureCache = new BookCoverFailureStore();
