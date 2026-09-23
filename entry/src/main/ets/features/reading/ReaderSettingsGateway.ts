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
  private static updateTails: Map<ReaderRuntimeOwner, Promise<void>> = new Map();
  private static snapshots: WeakMap<ReaderRuntimeOwner, ReaderSettingsSnapshot> = new WeakMap();

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  /** Last admitted application snapshot, available before the reader's first build. */
  current(): ReaderSettingsSnapshot | undefined {
    const snapshot = ReaderSettingsGateway.snapshots.get(this.runtimeOwner);
    return snapshot === undefined ? undefined : copyReaderSettingsSnapshot(snapshot);
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
    return this.withSettingsAccess(async (): Promise<ReaderSettingsSnapshot> => {
      if (!isCurrentOwner()) throw new Error('READER_SETTINGS_OWNER_CHANGED');
      const current = this.current();
      if (current !== undefined) return current;
      const store = await this.ensureStore();
      if (!isCurrentOwner()) throw new Error('READER_SETTINGS_OWNER_CHANGED');
      const snapshot = await this.readSnapshot(store);
      if (!isCurrentOwner()) throw new Error('READER_SETTINGS_OWNER_CHANGED');
      ReaderSettingsGateway.snapshots.set(this.runtimeOwner, snapshot);
      return copyReaderSettingsSnapshot(snapshot);
    });
  }

  async update(snapshot: ReaderSettingsSnapshot, resetOwned: boolean = false): Promise<ReaderSettingsSnapshot> {
    const requestedSnapshot = normalizeReaderSettingsSnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    return this.withSettingsAccess(async (): Promise<ReaderSettingsSnapshot> => {
      const store = await this.ensureStore();
      const previous = await store.get(READER_SETTINGS_SNAPSHOT_KEY, '');
      try {
        await store.put(READER_SETTINGS_SNAPSHOT_KEY, JSON.stringify(requestedSnapshot));
        await store.flush();
      } catch (error) {
        await store.put(READER_SETTINGS_SNAPSHOT_KEY, previous);
        throw error;
      }
      ReaderSettingsGateway.snapshots.set(this.runtimeOwner, requestedSnapshot);
      return copyReaderSettingsSnapshot(requestedSnapshot);
    });
  }

  /** Initial reads/migrations share the existing write queue: they must not
   * publish a Preferences put that a pending failed flush will roll back. */
  private async withSettingsAccess<T>(operation: () => Promise<T>): Promise<T> {
    const previousUpdate = ReaderSettingsGateway.updateTails.get(this.runtimeOwner) ?? Promise.resolve();
    let releaseUpdate: (() => void) | undefined = undefined;
    const nextUpdate = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    ReaderSettingsGateway.updateTails.set(this.runtimeOwner, nextUpdate);
    // A failed flush must not poison every later retry in this process. Each
    // caller receives its own I/O error, while the serialized tail continues
    // from a settled point.
    await previousUpdate.catch((): void => {});

    try {
      return await operation();
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
      if (ReaderSettingsGateway.updateTails.get(this.runtimeOwner) === nextUpdate) ReaderSettingsGateway.updateTails.delete(this.runtimeOwner);
    }
  }

  private async readSnapshot(store: preferences.Preferences): Promise<ReaderSettingsSnapshot> {
    const fallback = createDefaultReaderSettingsSnapshot();
    const raw = (await store.get(READER_SETTINGS_SNAPSHOT_KEY, '')) as string;
    if (raw.length === 0) {
      return fallback;
    }
    try {
      const decoded = JSON.parse(raw) as
        ReaderSettingsSnapshot | ReaderSettingsSnapshotV4 | ReaderSettingsSnapshotV3 | ReaderSettingsSnapshotV2 | ReaderSettingsSnapshotV1;
      const normalized = normalizeReaderSettingsSnapshot(decoded);
      if (decoded.version !== 5) {
        try {
          await store.put(READER_SETTINGS_SNAPSHOT_KEY, JSON.stringify(normalized));
          await store.flush();
        } catch (_) {
          // A valid migrated snapshot remains usable for this session. A later
          // load/update retries persistence without exposing mixed legacy/V4 state.
        }
      }
      return normalized;
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
