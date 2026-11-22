import { readerHostPreferencesName } from '../../../app/diagnostics/ReaderPublicFixtureScope';
import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import {
  copyReaderTtsPreferencesSnapshot,
  copyReaderTtsPreferencesPatch,
  mergeReaderTtsPreferencesPatch,
  createDefaultReaderTtsPreferencesSnapshot,
  normalizeReaderTtsPreferencesSnapshot,
  type ReaderTtsPreferencesSnapshot,
  type ReaderTtsPreferencesPatch,
} from './ReaderTtsPreferencesState';

const READER_TTS_PREFERENCES_NAME = 'reader_tts_preferences_v1';
const READER_TTS_SNAPSHOT_KEY = 'snapshot';

export type ReaderTtsPreferenceWriteFacts = {
  acceptedRevision: number;
  savedRevision: number;
  pendingReconciliation: boolean;
  accepted: ReaderTtsPreferencesSnapshot | undefined;
  saved: ReaderTtsPreferencesSnapshot | undefined;
};

/** One Preferences-file domain across Runtime owners. A whole snapshot setter
 * is idempotent; unknown flush never warrants compensating to an old snapshot.
 * Core engine/queue and Coordinator playback keep their existing owners. */
export class ReaderTtsPreferencesGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private static writeTail: Promise<void> = Promise.resolve();
  private static accepted: ReaderTtsPreferencesSnapshot | undefined = undefined;
  private static saved: ReaderTtsPreferencesSnapshot | undefined = undefined;
  private static acceptedRevision: number = 0;
  private static savedRevision: number = 0;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) { this.runtimeOwner = runtimeOwner; }

  writeFacts(): ReaderTtsPreferenceWriteFacts {
    return { acceptedRevision: ReaderTtsPreferencesGateway.acceptedRevision,
      savedRevision: ReaderTtsPreferencesGateway.savedRevision,
      pendingReconciliation: ReaderTtsPreferencesGateway.acceptedRevision !== ReaderTtsPreferencesGateway.savedRevision,
      accepted: ReaderTtsPreferencesGateway.accepted === undefined ? undefined : copyReaderTtsPreferencesSnapshot(ReaderTtsPreferencesGateway.accepted),
      saved: ReaderTtsPreferencesGateway.saved === undefined ? undefined : copyReaderTtsPreferencesSnapshot(ReaderTtsPreferencesGateway.saved) };
  }

  async load(): Promise<ReaderTtsPreferencesSnapshot> {
    await ReaderThemeHost.prepareUserChange();
    // Warm re-entry consumes the accepted choice without waiting for an old
    // unreturned flush. This is current presentation, never a saved receipt.
    if (ReaderTtsPreferencesGateway.accepted !== undefined)
      return copyReaderTtsPreferencesSnapshot(ReaderTtsPreferencesGateway.accepted);
    return this.withFileAccess(async (): Promise<ReaderTtsPreferencesSnapshot> => {
      if (ReaderTtsPreferencesGateway.accepted !== undefined)
        return copyReaderTtsPreferencesSnapshot(ReaderTtsPreferencesGateway.accepted);
      return this.readSnapshot(await this.ensureStore());
    });
  }

  async update(snapshot: ReaderTtsPreferencesSnapshot, resetOwned: boolean = false,
    isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot> {
    const requested = normalizeReaderTtsPreferencesSnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    return this.withFileAccess(async (): Promise<ReaderTtsPreferencesSnapshot> => {
      const store = await this.ensureStore();
      await store.get(READER_TTS_SNAPSHOT_KEY, '');
      this.assertAdmitted(isAdmitted);
      return this.writeSnapshot(store, requested);
    });
  }

  /** Merge accepted fields against the actual full base inside this file's
   * existing lane. An unread or failed base is never replaced by UI defaults. */
  async patch(patch: ReaderTtsPreferencesPatch,
    isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot> {
    const requested = copyReaderTtsPreferencesPatch(patch);
    // Reset recovery can itself need this file lane, so wait outside it.
    await ReaderThemeHost.prepareUserChange();
    return this.withFileAccess(async (): Promise<ReaderTtsPreferencesSnapshot> => {
      const store = await this.ensureStore();
      const read = await this.readSnapshot(store);
      this.assertAdmitted(isAdmitted);
      const base = ReaderTtsPreferencesGateway.accepted ?? read;
      return this.writeSnapshot(store, mergeReaderTtsPreferencesPatch(base, requested));
    });
  }

  private async withFileAccess<T>(operation: () => Promise<T>): Promise<T> {
    const prior = ReaderTtsPreferencesGateway.writeTail;
    let release: (() => void) | undefined = undefined;
    const tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    ReaderTtsPreferencesGateway.writeTail = tail;
    await prior;
    try {
      return await operation();
    } finally { release?.(); }
  }

  private assertAdmitted(isAdmitted?: () => boolean): void {
    if (isAdmitted?.() === false || !ReaderRuntimeOwner.isCurrent(this.runtimeOwner))
      throw new Error('TTS_PREFERENCE_OWNER_SUPERSEDED');
  }

  private async readSnapshot(store: preferences.Preferences): Promise<ReaderTtsPreferencesSnapshot> {
    const raw = (await store.get(READER_TTS_SNAPSHOT_KEY, '')) as string;
    if (raw.length === 0) return createDefaultReaderTtsPreferencesSnapshot();
    try { return normalizeReaderTtsPreferencesSnapshot(JSON.parse(raw) as ReaderTtsPreferencesSnapshot); }
    catch (_) { return createDefaultReaderTtsPreferencesSnapshot(); }
  }

  private async writeSnapshot(store: preferences.Preferences,
    requested: ReaderTtsPreferencesSnapshot): Promise<ReaderTtsPreferencesSnapshot> {
    if (ReaderTtsPreferencesGateway.acceptedRevision >= Number.MAX_SAFE_INTEGER)
      throw new Error('TTS_PREFERENCE_REVISION_EXHAUSTED');
    const revision = ++ReaderTtsPreferencesGateway.acceptedRevision;
    ReaderTtsPreferencesGateway.accepted = copyReaderTtsPreferencesSnapshot(requested);
    // A dispatched put/flush settles independently of presentation retirement.
    await store.put(READER_TTS_SNAPSHOT_KEY, JSON.stringify(requested));
    await store.flush();
    ReaderTtsPreferencesGateway.saved = copyReaderTtsPreferencesSnapshot(requested);
    ReaderTtsPreferencesGateway.savedRevision = revision;
    return copyReaderTtsPreferencesSnapshot(requested);
  }

  /** A finite retry of the same accepted whole snapshot; no cached-get match
   * clears pendingReconciliation. Only its new actual flush ACK does. */
  async retryAccepted(isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot> {
    const snapshot = ReaderTtsPreferencesGateway.accepted;
    if (snapshot === undefined) return this.load();
    const revision = ReaderTtsPreferencesGateway.acceptedRevision;
    return this.update(snapshot, false, (): boolean =>
      revision === ReaderTtsPreferencesGateway.acceptedRevision && isAdmitted?.() !== false);
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) return this.store;
    const context = this.runtimeOwner.getUIAbilityContext();
    this.store = await preferences.getPreferences(context, readerHostPreferencesName(context.filesDir, READER_TTS_PREFERENCES_NAME));
    return this.store;
  }
}
