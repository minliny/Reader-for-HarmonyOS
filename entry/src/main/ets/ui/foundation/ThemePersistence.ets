// Reader for HarmonyOS - M8 跨层基础设施 - ThemePersistence.ets
import preferences from '@ohos.data.preferences';
import { ReaderLogger } from './ReaderLogger';

const STORE_NAME = 'reader-theme-store';
const KEY_THEME_SCHEME = 'themeScheme';
const KEY_READER_THEME_PREFIX = 'readerTheme:';

export class ThemePersistence {
  private static instance: ThemePersistence;
  private store: preferences.Preferences | null = null;

  static shared(): ThemePersistence {
    if (!ThemePersistence.instance) ThemePersistence.instance = new ThemePersistence();
    return ThemePersistence.instance;
  }

  async init(context: Context): Promise<void> {
    try {
      this.store = await preferences.getPreferences(context, STORE_NAME);
    } catch (e) {
      ReaderLogger.e('ThemePersistence', 'init failed', e as Error);
    }
  }

  async loadScheme(): Promise<'day' | 'night' | 'system'> {
    if (!this.store) return 'system';
    try {
      const v = await this.store.get(KEY_THEME_SCHEME, 'system') as string;
      return v as 'day' | 'night' | 'system';
    } catch (e) {
      ReaderLogger.e('ThemePersistence', 'loadScheme failed', e as Error);
      return 'system';
    }
  }

  async saveScheme(scheme: 'day' | 'night' | 'system'): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.put(KEY_THEME_SCHEME, scheme);
      await this.store.flush();
    } catch (e) {
      ReaderLogger.e('ThemePersistence', 'saveScheme failed', e as Error);
    }
  }

  async loadReaderTheme(bookId: string): Promise<string> {
    if (!this.store) return 'paper';
    try {
      const v = await this.store.get(`${KEY_READER_THEME_PREFIX}${bookId}`, 'paper') as string;
      return v;
    } catch (e) {
      return 'paper';
    }
  }

  async saveReaderTheme(bookId: string, themeValue: string): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.put(`${KEY_READER_THEME_PREFIX}${bookId}`, themeValue);
      await this.store.flush();
    } catch (e) {
      ReaderLogger.e('ThemePersistence', 'saveReaderTheme failed', e as Error);
    }
  }
}
