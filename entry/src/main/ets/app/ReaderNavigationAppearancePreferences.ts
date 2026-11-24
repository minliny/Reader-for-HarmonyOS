import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import { readerHostPreferencesName } from './diagnostics/ReaderPublicFixtureScope';
import {
  normalizeReaderNavigationPreferences, type ReaderNavigationPreferenceChange, type ReaderNavigationPreferences,
} from './HarmonyCapabilityPolicy';

export const NAVIGATION_APPEARANCE_STORAGE_KEY = 'readerNavigationAppearancePreferences';
export const NAVIGATION_APPEARANCE_SAVE_PENDING_KEY = 'readerNavigationAppearanceSavePending';

const PREFERENCES_NAME = 'reader_navigation_appearance_v1';
const SNAPSHOT_KEY = 'snapshot';

/** Local visual preferences have their own domain and are never part of the
 * reading-theme snapshot, Core state or portable Host configuration. */
export class ReaderNavigationAppearancePreferences {
  private static context: common.UIAbilityContext | undefined;
  private static store: preferences.Preferences | undefined;
  private static pendingChange: ReaderNavigationPreferenceChange | undefined;
  private static generation: number = 0;
  private static tail: Promise<void> = Promise.resolve();

  static attach(context: common.UIAbilityContext): void {
    const generation = ++this.generation;
    this.context = context;
    this.store = undefined;
    this.pendingChange = undefined;
    AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, false);
    this.publish(normalizeReaderNavigationPreferences(undefined));
    void this.reload(generation).catch((): void => {});
  }

  static detach(): void {
    this.generation += 1;
    this.context = undefined;
    this.store = undefined;
    this.pendingChange = undefined;
  }

  static async save(change: ReaderNavigationPreferenceChange): Promise<void> {
    const generation = this.generation;
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      if (this.pendingChange !== undefined) return;
      this.pendingChange = change;
      await this.apply(generation);
    });
  }

  static async retry(): Promise<void> {
    const generation = this.generation;
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      if (this.pendingChange !== undefined) await this.apply(generation);
    });
  }

  private static async apply(generation: number): Promise<void> {
    const change = this.pendingChange!;
    try {
      const store = await this.open(generation);
      const current = await this.read(store);
      this.current(generation);
      const next = normalizeReaderNavigationPreferences({ override: change.override ?? current.override,
        reduceTransparency: change.reduceTransparency ?? current.reduceTransparency });
      await store.put(SNAPSHOT_KEY, JSON.stringify(next));
      await store.flush();
      this.current(generation);
      this.pendingChange = undefined;
      this.publish(next);
      AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, false);
    } catch (error) {
      if (generation === this.generation) AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, true);
      throw error;
    }
  }

  private static reload(generation: number): Promise<void> {
    return this.serialized(async (): Promise<void> => {
      const store = await this.open(generation);
      const value = await this.read(store);
      this.current(generation);
      this.publish(value);
    });
  }

  private static async read(store: preferences.Preferences): Promise<ReaderNavigationPreferences> {
    const raw = await store.get(SNAPSHOT_KEY, '');
    let decoded: ReaderNavigationPreferences | undefined;
    if (typeof raw === 'string' && raw.length > 0) {
      try { decoded = JSON.parse(raw) as ReaderNavigationPreferences; } catch (_) {}
    }
    return normalizeReaderNavigationPreferences(decoded);
  }

  private static async open(generation: number): Promise<preferences.Preferences> {
    this.current(generation);
    if (this.store !== undefined) return this.store;
    const context = this.context!;
    const store = await preferences.getPreferences(context, readerHostPreferencesName(context.filesDir, PREFERENCES_NAME));
    this.current(generation);
    this.store = store;
    return store;
  }

  private static current(generation: number): void {
    if (generation !== this.generation || this.context === undefined) throw new Error('NAVIGATION_PREFERENCES_RETIRED');
  }

  private static publish(value: ReaderNavigationPreferences): void {
    AppStorage.setOrCreate<ReaderNavigationPreferences>(NAVIGATION_APPEARANCE_STORAGE_KEY, value);
  }

  private static serialized(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation);
    this.tail = result.then((): void => {}, (): void => {});
    return result;
  }
}
