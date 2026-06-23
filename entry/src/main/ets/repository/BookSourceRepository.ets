// BookSourceRepository — store and manage BookSource objects
import { BookSource } from '../models/BookSource';
import { IStorageAdapter } from './BookshelfRepository';

const KEY_SOURCES = 'reader_sources';

export class BookSourceRepository {
  private sources: Map<string, BookSource> = new Map();
  private storage: IStorageAdapter;

  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  initialize(): void {
    try {
      const json = this.storage.read(KEY_SOURCES);
      if (json) {
        const arr: BookSource[] = JSON.parse(json);
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          this.sources.set(s.bookSourceUrl, s);
        }
      }
    } catch (_e) {
      // First run, empty
    }
  }

  private saveToStore(): void {
    const arr = this.getAllSources();
    this.storage.write(KEY_SOURCES, JSON.stringify(arr));
  }

  addSource(source: BookSource): boolean {
    if (this.sources.has(source.bookSourceUrl)) {
      return false;
    }
    this.sources.set(source.bookSourceUrl, source);
    this.saveToStore();
    return true;
  }

  removeSource(url: string): boolean {
    if (!this.sources.has(url)) {
      return false;
    }
    this.sources.delete(url);
    this.saveToStore();
    return true;
  }

  getSource(url: string): BookSource | undefined {
    return this.sources.get(url);
  }

  getAllSources(): BookSource[] {
    return Array.from(this.sources.values());
  }

  getEnabledSources(): BookSource[] {
    return this.getAllSources().filter(s => s.enabled);
  }

  count(): number {
    return this.sources.size;
  }

  // Import from JSON string (e.g., Legado-format book source JSON)
  importFromJSON(json: string): number {
    try {
      const parsed = JSON.parse(json) as BookSource[] | BookSource;
      const arr: BookSource[] = Array.isArray(parsed) ? parsed : [parsed];
      let added = 0;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s.bookSourceUrl && s.bookSourceName && this.addSource(s)) {
          added++;
        }
      }
      return added;
    } catch (_e) {
      return 0;
    }
  }

  // Export all as JSON array
  exportToJSON(): string {
    return JSON.stringify(this.getAllSources());
  }

  // Toggle enabled state
  setEnabled(url: string, enabled: boolean): boolean {
    const source = this.sources.get(url);
    if (!source) { return false; }
    source.enabled = enabled;
    this.sources.set(url, source);
    this.saveToStore();
    return true;
  }
}
