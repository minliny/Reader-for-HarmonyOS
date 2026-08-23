import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  normalizeReaderSettingsSnapshot,
  type ReaderSettingsSnapshot,
  type ReaderSettingsSnapshotV1,
} from './ReaderSettingsState';

const READER_SETTINGS_PREFERENCES_NAME = 'reader_reading_settings_v1';
const READER_SETTINGS_SNAPSHOT_KEY = 'snapshot';

/**
 * App-local persistence for the Reader Settings module.
 *
 * Reader Core persistence is a fixed business snapshot, not a generic UI
 * settings store. This gateway therefore uses HarmonyOS Preferences through
 * the already-owned UIAbilityContext and serializes updates to avoid exposing
 * or persisting a mixed snapshot.
 */
export class ReaderSettingsGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private updateTail: Promise<void> = Promise.resolve();

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async load(): Promise<ReaderSettingsSnapshot> {
    await this.updateTail;
    const store = await this.ensureStore();
    return this.readSnapshot(store);
  }

  async update(snapshot: ReaderSettingsSnapshot): Promise<ReaderSettingsSnapshot> {
    const requestedSnapshot = normalizeReaderSettingsSnapshot(snapshot);
    const previousUpdate = this.updateTail;
    let releaseUpdate: (() => void) | undefined = undefined;
    this.updateTail = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    await previousUpdate;

    try {
      const store = await this.ensureStore();
      await store.put(READER_SETTINGS_SNAPSHOT_KEY, JSON.stringify(requestedSnapshot));
      await store.flush();
      return copyReaderSettingsSnapshot(requestedSnapshot);
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
    }
  }

  private async readSnapshot(store: preferences.Preferences): Promise<ReaderSettingsSnapshot> {
    const fallback = createDefaultReaderSettingsSnapshot();
    const raw = (await store.get(READER_SETTINGS_SNAPSHOT_KEY, '')) as string;
    if (raw.length === 0) {
      return fallback;
    }
    try {
      const decoded = JSON.parse(raw) as ReaderSettingsSnapshot | ReaderSettingsSnapshotV1;
      return normalizeReaderSettingsSnapshot(decoded);
    } catch (_) {
      return fallback;
    }
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) {
      return this.store;
    }
    this.store = await preferences.getPreferences(
      this.runtimeOwner.getUIAbilityContext(),
      READER_SETTINGS_PREFERENCES_NAME,
    );
    return this.store;
  }
}
