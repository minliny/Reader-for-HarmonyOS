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
    await ReaderTtsPreferencesGateway.writeTail;
    if (ReaderTtsPreferencesGateway.accepted !== undefined)
      return copyReaderTtsPreferencesSnapshot(ReaderTtsPreferencesGateway.accepted);
    const store = await this.ensureStore();
    const raw = (await store.get(READER_TTS_SNAPSHOT_KEY, '')) as string;
    const fallback = createDefaultReaderTtsPreferencesSnapshot();
    if (raw.length === 0) return fallback;
    try { return normalizeReaderTtsPreferencesSnapshot(JSON.parse(raw) as ReaderTtsPreferencesSnapshot); }
    catch (_) { return fallback; }
  }

  async update(snapshot: ReaderTtsPreferencesSnapshot, resetOwned: boolean = false,
    isAdmitted?: () => boolean): Promise<ReaderTtsPreferencesSnapshot> {
    const requested = normalizeReaderTtsPreferencesSnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    const prior = ReaderTtsPreferencesGateway.writeTail;
    let release: (() => void) | undefined = undefined;
    const tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    ReaderTtsPreferencesGateway.writeTail = tail;
    await prior;
    try {
      const store = await this.ensureStore();
      // Keep the real read boundary before first dispatch. It does not prove
      // an unknown flush durable and its cached value is never compensation.
      await store.get(READER_TTS_SNAPSHOT_KEY, '');
      if (isAdmitted?.() === false || !ReaderRuntimeOwner.isCurrent(this.runtimeOwner))
        throw new Error('TTS_PREFERENCE_OWNER_SUPERSEDED');
      if (ReaderTtsPreferencesGateway.acceptedRevision >= Number.MAX_SAFE_INTEGER)
        throw new Error('TTS_PREFERENCE_REVISION_EXHAUSTED');
      ReaderTtsPreferencesGateway.acceptedRevision += 1;
      const revision = ReaderTtsPreferencesGateway.acceptedRevision;
      ReaderTtsPreferencesGateway.accepted = copyReaderTtsPreferencesSnapshot(requested);
      // Once put has dispatched, UI retirement must not cancel its flush or
      // allow a new Runtime to write the same file concurrently.
      await store.put(READER_TTS_SNAPSHOT_KEY, JSON.stringify(requested));
      await store.flush();
      ReaderTtsPreferencesGateway.saved = copyReaderTtsPreferencesSnapshot(requested);
      ReaderTtsPreferencesGateway.savedRevision = revision;
      return copyReaderTtsPreferencesSnapshot(requested);
    } finally { release?.(); }
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
    this.store = await preferences.getPreferences(this.runtimeOwner.getUIAbilityContext(), READER_TTS_PREFERENCES_NAME);
    return this.store;
  }
}
