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

interface ReaderNavigationPreferenceWrite {
  change: ReaderNavigationPreferenceChange;
  snapshot?: ReaderNavigationPreferences;
}

/** Local visual preferences have their own domain and are never part of the
 * reading-theme snapshot, Core state or portable Host configuration. */
export class ReaderNavigationAppearancePreferences {
  private static context: common.UIAbilityContext | undefined;
  private static store: preferences.Preferences | undefined;
  private static pendingWrites: Map<string, ReaderNavigationPreferenceWrite> = new Map();
  private static publishedDirectory: string | undefined;
  private static generation: number = 0;
  private static tail: Promise<void> = Promise.resolve();

  static attach(context: common.UIAbilityContext): void {
    const generation = ++this.generation;
    this.context = context;
    this.store = undefined;
    AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, this.pendingWrites.has(context.filesDir));
    if (this.publishedDirectory !== context.filesDir) this.publish(normalizeReaderNavigationPreferences(undefined));
    void this.reload(generation).catch((): void => {});
  }

  static detach(): void {
    this.generation += 1;
    this.context = undefined;
    this.store = undefined;
  }

  static async save(change: ReaderNavigationPreferenceChange): Promise<void> {
    const generation = this.generation;
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      const directory = this.context!.filesDir;
      if (this.pendingWrites.has(directory)) return;
      this.pendingWrites.set(directory, { change: { ...change } });
      await this.apply(generation);
    });
  }

  static async retry(): Promise<void> {
    const generation = this.generation;
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      await this.apply(generation);
    });
  }

  static resetDefaults(ownerCurrent: () => boolean): Promise<void> {
    const generation = this.generation;
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      const directory = this.context!.filesDir;
      const store = await this.open(generation);
      if (!ownerCurrent()) throw new Error('NAVIGATION_PREFERENCES_RETIRED');
      const defaults = normalizeReaderNavigationPreferences(undefined);
      await store.put(SNAPSHOT_KEY, JSON.stringify(defaults));
      await store.flush();
      this.pendingWrites.delete(directory);
      this.current(generation);
      if (!ownerCurrent()) throw new Error('NAVIGATION_PREFERENCES_RETIRED');
      this.publish(defaults);
      AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, false);
    });
  }

  private static async apply(generation: number): Promise<void> {
    const directory = this.context!.filesDir;
    const pending = this.pendingWrites.get(directory);
    if (pending === undefined) return;
    try {
      const store = await this.open(generation);
      let next = pending.snapshot;
      if (next === undefined) {
        const current = await this.read(store);
        this.current(generation);
        next = normalizeReaderNavigationPreferences({ override: pending.change.override ?? current.override,
          reduceTransparency: pending.change.reduceTransparency ?? current.reduceTransparency });
        pending.snapshot = next;
      }
      this.current(generation);
      await store.put(SNAPSHOT_KEY, JSON.stringify(next));
      await store.flush();
      this.pendingWrites.delete(directory);
      this.current(generation);
      this.publish(next);
      AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, false);
    } catch (error) {
      if (generation === this.generation) AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, true);
      throw error;
    }
  }

  private static reload(generation: number): Promise<void> {
    return this.serialized(async (): Promise<void> => {
      this.current(generation);
      const pending = this.pendingWrites.has(this.context!.filesDir);
      AppStorage.setOrCreate<boolean>(NAVIGATION_APPEARANCE_SAVE_PENDING_KEY, pending);
      if (pending) return; // The SDK cache may contain the original, unconfirmed put.
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
    this.publishedDirectory = this.context?.filesDir;
    AppStorage.setOrCreate<ReaderNavigationPreferences>(NAVIGATION_APPEARANCE_STORAGE_KEY, value);
  }

  private static serialized(operation: () => Promise<void>): Promise<void> {
    const result = this.tail.then(operation);
    this.tail = result.then((): void => {}, (): void => {});
    return result;
  }
}
