// StorageAdapter — @ohos.data.preferences-backed key-value storage
// Implements IStorageAdapter interface from BookshelfRepository
import { preferences } from '@kit.ArkData';
import { IStorageAdapter } from '../repository/BookshelfRepository';

const STORE_NAME = 'reader_storage';

export class PreferencesStorageAdapter implements IStorageAdapter {
  private store: preferences.Preferences | null = null;

  async initialize(context: Context): Promise<void> {
    this.store = preferences.getPreferencesSync(context, { name: STORE_NAME });
  }

  read(key: string): string | null {
    if (!this.store) { return null; }
    try {
      return this.store.getSync(key, '') as string || null;
    } catch (_e) {
      return null;
    }
  }

  write(key: string, value: string): void {
    if (!this.store) { return; }
    this.store.putSync(key, value);
    this.store.flushSync();
  }

  remove(key: string): void {
    if (!this.store) { return; }
    this.store.deleteSync(key);
    this.store.flushSync();
  }

  keys(): string[] {
    // preferences doesn't support key enumeration directly
    return [];
  }
}

// In-memory adapter for testing
export class MemoryStorageAdapter implements IStorageAdapter {
  private data: Map<string, string> = new Map();

  read(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}
