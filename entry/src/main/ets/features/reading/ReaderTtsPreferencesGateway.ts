import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import {
  copyReaderTtsPreferencesSnapshot,
  createDefaultReaderTtsPreferencesSnapshot,
  normalizeReaderTtsPreferencesSnapshot,
  type ReaderTtsPreferencesSnapshot,
} from './ReaderTtsPreferencesState';

const READER_TTS_PREFERENCES_NAME = 'reader_tts_preferences_v1';
const READER_TTS_SNAPSHOT_KEY = 'snapshot';

/** App-local presentation and Host policy; Core remains owner of queue and engine URL configuration. */
export class ReaderTtsPreferencesGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private static updateTails: Map<ReaderRuntimeOwner, Promise<void>> = new Map();

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async load(): Promise<ReaderTtsPreferencesSnapshot> {
    await ReaderThemeHost.prepareUserChange();
    await ReaderTtsPreferencesGateway.updateTails.get(this.runtimeOwner);
    const store = await this.ensureStore();
    const fallback = createDefaultReaderTtsPreferencesSnapshot();
    const raw = (await store.get(READER_TTS_SNAPSHOT_KEY, '')) as string;
    if (raw.length === 0) return fallback;
    try {
      return normalizeReaderTtsPreferencesSnapshot(JSON.parse(raw) as ReaderTtsPreferencesSnapshot);
    } catch (_) {
      return fallback;
    }
  }

  async update(snapshot: ReaderTtsPreferencesSnapshot, resetOwned: boolean = false): Promise<ReaderTtsPreferencesSnapshot> {
    const requested = normalizeReaderTtsPreferencesSnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    const previousUpdate = ReaderTtsPreferencesGateway.updateTails.get(this.runtimeOwner) ?? Promise.resolve();
    let releaseUpdate: (() => void) | undefined = undefined;
    const nextUpdate = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    ReaderTtsPreferencesGateway.updateTails.set(this.runtimeOwner, nextUpdate);
    // Keep retries independent after a transient preferences/flush failure.
    await previousUpdate.catch((): void => {});
    try {
      const store = await this.ensureStore();
      const previous = await store.get(READER_TTS_SNAPSHOT_KEY, '');
      try {
        await store.put(READER_TTS_SNAPSHOT_KEY, JSON.stringify(requested));
        await store.flush();
      } catch (error) {
        await store.put(READER_TTS_SNAPSHOT_KEY, previous);
        throw error;
      }
      return copyReaderTtsPreferencesSnapshot(requested);
    } finally {
      releaseUpdate?.();
      if (ReaderTtsPreferencesGateway.updateTails.get(this.runtimeOwner) === nextUpdate) ReaderTtsPreferencesGateway.updateTails.delete(this.runtimeOwner);
    }
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) return this.store;
    this.store = await preferences.getPreferences(
      this.runtimeOwner.getUIAbilityContext(),
      READER_TTS_PREFERENCES_NAME,
    );
    return this.store;
  }
}
