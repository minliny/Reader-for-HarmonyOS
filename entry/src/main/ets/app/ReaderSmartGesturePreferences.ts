import { common } from '@kit.AbilityKit';
import preferences from '@ohos.data.preferences';
import { readerHostPreferencesName } from './diagnostics/ReaderPublicFixtureScope';
import { DEFAULT_READER_SMART_GESTURES, normalizeReaderSmartGestureSettings,
  type ReaderSmartGestureSettings } from '../features/reading/application/ReaderSmartGesturePolicy';

const STORE_NAME = 'reader_smart_gestures_v1';
const PREFERENCE_KEY = 'settings';
const STATE_KEY = 'readerSmartGestureSettings';

/** The host preference store is independent of the portable library. */
export class ReaderSmartGesturePreferences {
  private static generation: number = 0;
  private static store: Promise<preferences.Preferences> | undefined;
  private static tail: Promise<void> = Promise.resolve();

  static attach(context: common.UIAbilityContext): void {
    const generation = ++this.generation;
    AppStorage.setOrCreate(STATE_KEY, DEFAULT_READER_SMART_GESTURES);
    const store = this.tail.then((): Promise<preferences.Preferences> =>
      preferences.getPreferences(context, readerHostPreferencesName(context.filesDir, STORE_NAME)));
    this.store = store;
    const read = store.then(async (owner): Promise<void> => {
      const encoded = await owner.get(PREFERENCE_KEY, '');
      if (generation !== this.generation || typeof encoded !== 'string' || encoded.length === 0) return;
      const settings = JSON.parse(encoded) as ReaderSmartGestureSettings;
      AppStorage.setOrCreate(STATE_KEY, normalizeReaderSmartGestureSettings(settings.enabled === true, settings.tapAction));
    });
    this.tail = read.catch((): void => {});
  }

  static detach(): void {
    this.generation += 1;
    this.store = undefined;
  }

  static resetDefaults(current: () => boolean): Promise<void> {
    return this.write(DEFAULT_READER_SMART_GESTURES, current, true);
  }

  static select(settings: ReaderSmartGestureSettings, current: () => boolean): Promise<void> {
    return this.write(settings, current, false);
  }

  private static write(settings: ReaderSmartGestureSettings, current: () => boolean, required: boolean): Promise<void> {
    const generation = this.generation;
    const store = this.store;
    const admitted = (): boolean => {
      if (generation === this.generation && current()) return true;
      if (required) throw new Error('SMART_GESTURE_PREFERENCES_RETIRED');
      return false;
    };
    const operation = this.tail.then(async (): Promise<void> => {
      if (!admitted()) return;
      if (store === undefined) throw new Error('SMART_GESTURE_PREFERENCES_UNAVAILABLE');
      const owner = await store;
      if (!admitted()) return;
      await owner.put(PREFERENCE_KEY, JSON.stringify(settings));
      await owner.flush();
      if (required) admitted();
      if (generation === this.generation) AppStorage.setOrCreate(STATE_KEY, settings);
    });
    this.tail = operation.catch((): void => {});
    return operation;
  }
}
