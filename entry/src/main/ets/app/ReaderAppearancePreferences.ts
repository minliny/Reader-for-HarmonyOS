import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import {
  createDefaultReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from '../features/reading/ReaderAppearanceState';
import type { ReaderAppearancePersistence } from '../features/reading/ReaderAppearanceStore';

/** Existing v3 snapshot and preferences keys remain readable across upgrades. */
export class ReaderAppearancePreferences implements ReaderAppearancePersistence {
  // One file/domain queue across Runtime replacements, not a UI task bus.
  private static ioTail: Promise<void> = Promise.resolve();
  private static unconfirmedSave: boolean = false;
  private static unconfirmedSnapshot: ReaderAppearanceSnapshot | undefined = undefined;
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | undefined = undefined;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  hasUnconfirmedSave(): boolean { return ReaderAppearancePreferences.unconfirmedSave; }

  async load(): Promise<ReaderAppearanceSnapshot> {
    return this.serialized(async (): Promise<ReaderAppearanceSnapshot> => {
      const store = await this.ensureStore();
      const pending = ReaderAppearancePreferences.unconfirmedSnapshot;
      if (pending !== undefined) return normalizeReaderAppearanceSnapshot(pending);
      const raw = (await store.get('snapshot', '')) as string;
      if (raw.length === 0) return createDefaultReaderAppearanceSnapshot();
      try {
        return normalizeReaderAppearanceSnapshot(JSON.parse(raw) as ReaderAppearanceSnapshot);
      } catch (_) {
        return createDefaultReaderAppearanceSnapshot();
      }
    });
  }

  async save(snapshot: ReaderAppearanceSnapshot): Promise<void> {
    const encoded = JSON.stringify(normalizeReaderAppearanceSnapshot(snapshot));
    return this.serialized(async (): Promise<void> => {
      const store = await this.ensureStore();
      // Mark before dispatch: neither rejected put nor rejected flush proves
      // that the snapshot did not persist. Only a fulfilled flush confirms it.
      ReaderAppearancePreferences.unconfirmedSnapshot = normalizeReaderAppearanceSnapshot(
        JSON.parse(encoded) as ReaderAppearanceSnapshot);
      ReaderAppearancePreferences.unconfirmedSave = true;
      await store.put('snapshot', encoded);
      await store.flush();
      ReaderAppearancePreferences.unconfirmedSave = false;
      ReaderAppearancePreferences.unconfirmedSnapshot = undefined;
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = ReaderAppearancePreferences.ioTail.then(operation);
    ReaderAppearancePreferences.ioTail = result.then((): void => {}, (): void => {});
    return result;
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store === undefined) {
      this.store = await preferences.getPreferences(this.context, 'reader_appearance_v1');
    }
    return this.store;
  }
}
