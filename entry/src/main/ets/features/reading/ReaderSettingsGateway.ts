import preferences from '@ohos.data.preferences';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  normalizeReaderSettingsSnapshot,
  type ReaderSettingsSnapshot,
  type ReaderSettingsSnapshotV1,
  type ReaderSettingsSnapshotV2,
  type ReaderSettingsSnapshotV3,
  type ReaderSettingsSnapshotV4,
} from './ReaderSettingsState';

const READER_SETTINGS_PREFERENCES_NAME = 'reader_reading_settings_v1';
const READER_SETTINGS_SNAPSHOT_KEY = 'snapshot';

export interface ReaderSettingsWriteFacts {
  acceptedRevision: number;
  savedRevision: number;
  pendingReconciliation: boolean;
  accepted?: ReaderSettingsSnapshot;
  saved?: ReaderSettingsSnapshot;
}

/** App-local whole-snapshot setters share one actual Preferences-file lane
 * across Ability/Runtime owners. Current presentation and flush ACK are
 * independent facts; an unknown flush never authorizes old compensation. */
export class ReaderSettingsGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private static writeTail: Promise<void> = Promise.resolve();
  private static accepted: ReaderSettingsSnapshot | undefined;
  private static saved: ReaderSettingsSnapshot | undefined;
  private static acceptedRevision: number = 0;
  private static savedRevision: number = 0;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /** Last admitted application snapshot, available before the reader's first build. */
  current(): ReaderSettingsSnapshot | undefined {
    const snapshot = ReaderSettingsGateway.accepted;
    return snapshot === undefined ? undefined : copyReaderSettingsSnapshot(snapshot);
  }

  writeFacts(): ReaderSettingsWriteFacts {
    return { acceptedRevision: ReaderSettingsGateway.acceptedRevision,
      savedRevision: ReaderSettingsGateway.savedRevision,
      pendingReconciliation: ReaderSettingsGateway.acceptedRevision !== ReaderSettingsGateway.savedRevision,
      accepted: this.current(), saved: ReaderSettingsGateway.saved === undefined ? undefined :
        copyReaderSettingsSnapshot(ReaderSettingsGateway.saved) };
  }

  async load(): Promise<ReaderSettingsSnapshot> {
    await ReaderThemeHost.prepareUserChange();
    return this.loadAdmittedSnapshot((): boolean => true);
  }

  /** Startup has already completed configuration recovery. Re-entering its
   * user-change barrier here would recursively wait on the same recovery. */
  loadAfterConfigurationRecovery(isCurrentOwner: () => boolean): Promise<ReaderSettingsSnapshot> {
    return this.loadAdmittedSnapshot(isCurrentOwner);
  }

  private loadAdmittedSnapshot(isCurrentOwner: () => boolean): Promise<ReaderSettingsSnapshot> {
    if (!this.admitted(isCurrentOwner)) return Promise.reject(new Error('READER_SETTINGS_OWNER_SUPERSEDED'));
    // Warm re-entry must not wait for an old unreturned flush. A current
    // snapshot here is not a confirmation of that pending durable operation.
    const current = this.current();
    if (current !== undefined) return Promise.resolve(current);
    return this.withSettingsAccess(async (): Promise<ReaderSettingsSnapshot> => {
      this.assertAdmitted(isCurrentOwner);
      const current = this.current();
      if (current !== undefined) return current;
      const store = await this.ensureStore();
      this.assertAdmitted(isCurrentOwner);
      return this.readSnapshot(store, isCurrentOwner);
    });
  }

  async update(snapshot: ReaderSettingsSnapshot, resetOwned: boolean = false,
    isAdmitted?: () => boolean): Promise<ReaderSettingsSnapshot> {
    const requestedSnapshot = normalizeReaderSettingsSnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    return this.withSettingsAccess(async (): Promise<ReaderSettingsSnapshot> => {
      const store = await this.ensureStore();
      await store.get(READER_SETTINGS_SNAPSHOT_KEY, '');
      this.assertAdmitted(isAdmitted);
      // Text forms own the text fields. Their whole-snapshot setter must not
      // erase already accepted manga choices, including an unconfirmed flush.
      // An explicitly admitted full reading reset retains its original scope.
      if (!resetOwned) {
        const latest = this.current() ?? await this.readSnapshot(store, (): boolean => isAdmitted?.() !== false);
        if (latest.mangaDirection !== undefined) requestedSnapshot.mangaDirection = latest.mangaDirection;
        if (latest.mangaFit !== undefined) requestedSnapshot.mangaFit = latest.mangaFit;
        if (latest.mangaBackground !== undefined) requestedSnapshot.mangaBackground = latest.mangaBackground;
        if (latest.mangaPageNumbers !== undefined) requestedSnapshot.mangaPageNumbers = latest.mangaPageNumbers;
      }
      this.assertAdmitted(isAdmitted);
      return this.writeSnapshot(store, requestedSnapshot);
    });
  }

  /** One finite idempotent retry. A cached get cannot settle an unknown ACK;
   * a queued retry may not borrow a newer accepted revision. */
  async retryAccepted(isAdmitted?: () => boolean): Promise<ReaderSettingsSnapshot> {
    const snapshot = this.current();
    if (snapshot === undefined) return this.load();
    const revision = ReaderSettingsGateway.acceptedRevision;
    return this.update(snapshot, false, (): boolean => revision === ReaderSettingsGateway.acceptedRevision && isAdmitted?.() !== false);
  }

  /** Initial migration and writes reuse the same file-local lane. Retirement
   * rejects first dispatch, while an actual put retains the lane through flush. */
  private async withSettingsAccess<T>(operation: () => Promise<T>): Promise<T> {
    const previousUpdate = ReaderSettingsGateway.writeTail;
    let releaseUpdate: (() => void) | undefined = undefined;
    const nextUpdate = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    ReaderSettingsGateway.writeTail = nextUpdate;
    await previousUpdate;

    try {
      return await operation();
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
    }
  }

  private async readSnapshot(store: preferences.Preferences, isCurrentOwner: () => boolean): Promise<ReaderSettingsSnapshot> {
    const fallback = createDefaultReaderSettingsSnapshot();
    const raw = (await store.get(READER_SETTINGS_SNAPSHOT_KEY, '')) as string;
    this.assertAdmitted(isCurrentOwner);
    if (raw.length === 0) { ReaderSettingsGateway.accepted = fallback; return copyReaderSettingsSnapshot(fallback); }
    let decoded: ReaderSettingsSnapshot | ReaderSettingsSnapshotV4 | ReaderSettingsSnapshotV3 | ReaderSettingsSnapshotV2 | ReaderSettingsSnapshotV1;
    try {
      decoded = JSON.parse(raw) as
        ReaderSettingsSnapshot | ReaderSettingsSnapshotV4 | ReaderSettingsSnapshotV3 | ReaderSettingsSnapshotV2 | ReaderSettingsSnapshotV1;
    } catch (_) {
      ReaderSettingsGateway.accepted = fallback; return copyReaderSettingsSnapshot(fallback);
    }
    const normalized = normalizeReaderSettingsSnapshot(decoded);
    this.assertAdmitted(isCurrentOwner);
    ReaderSettingsGateway.accepted = copyReaderSettingsSnapshot(normalized);
    if (decoded !== null && decoded.version !== 5) {
      try { await this.writeSnapshot(store, normalized); }
      catch (_) { /* Usable migrated choice retained; real write facts stay unknown. */ }
    }
    return copyReaderSettingsSnapshot(normalized);
  }

  private async writeSnapshot(store: preferences.Preferences, snapshot: ReaderSettingsSnapshot): Promise<ReaderSettingsSnapshot> {
    if (ReaderSettingsGateway.acceptedRevision >= Number.MAX_SAFE_INTEGER)
      throw new Error('READER_SETTINGS_REVISION_EXHAUSTED');
    const revision = ++ReaderSettingsGateway.acceptedRevision;
    ReaderSettingsGateway.accepted = copyReaderSettingsSnapshot(snapshot);
    await store.put(READER_SETTINGS_SNAPSHOT_KEY, JSON.stringify(snapshot));
    await store.flush();
    ReaderSettingsGateway.saved = copyReaderSettingsSnapshot(snapshot);
    ReaderSettingsGateway.savedRevision = revision;
    return copyReaderSettingsSnapshot(snapshot);
  }

  private admitted(isAdmitted?: () => boolean): boolean {
    return ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && isAdmitted?.() !== false;
  }
  private assertAdmitted(isAdmitted?: () => boolean): void {
    if (!this.admitted(isAdmitted)) throw new Error('READER_SETTINGS_OWNER_SUPERSEDED');
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
