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
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | undefined = undefined;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(): Promise<ReaderAppearanceSnapshot> {
    const store = await this.ensureStore();
    const raw = (await store.get('snapshot', '')) as string;
    if (raw.length === 0) return createDefaultReaderAppearanceSnapshot();
    try {
      return normalizeReaderAppearanceSnapshot(JSON.parse(raw) as ReaderAppearanceSnapshot);
    } catch (_) {
      return createDefaultReaderAppearanceSnapshot();
    }
  }

  async save(snapshot: ReaderAppearanceSnapshot): Promise<void> {
    const store = await this.ensureStore();
    await store.put('snapshot', JSON.stringify(snapshot));
    await store.flush();
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store === undefined) {
      this.store = await preferences.getPreferences(this.context, 'reader_appearance_v1');
    }
    return this.store;
  }
}
