import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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
  private updateTail: Promise<void> = Promise.resolve();

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async load(): Promise<ReaderTtsPreferencesSnapshot> {
    await this.updateTail;
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

  async update(snapshot: ReaderTtsPreferencesSnapshot): Promise<ReaderTtsPreferencesSnapshot> {
    const requested = normalizeReaderTtsPreferencesSnapshot(snapshot);
    const previousUpdate = this.updateTail;
    let releaseUpdate: (() => void) | undefined = undefined;
    this.updateTail = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    // Keep retries independent after a transient preferences/flush failure.
    await previousUpdate.catch((): void => {});
    try {
      const store = await this.ensureStore();
      await store.put(READER_TTS_SNAPSHOT_KEY, JSON.stringify(requested));
      await store.flush();
      return copyReaderTtsPreferencesSnapshot(requested);
    } finally {
      releaseUpdate?.();
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
