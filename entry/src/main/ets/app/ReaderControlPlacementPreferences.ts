import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import { readerHostPreferencesName } from './diagnostics/ReaderPublicFixtureScope';
import { readerControlAlignment, type ReaderControlAlignment } from '../features/reading/ui/ReaderControlPlacement';

const STORAGE_KEY = 'readerControlAlignment';
const PENDING_GENERATION_KEY = 'readerControlPlacementPendingGeneration';
const PREFERENCES_NAME = 'reader_control_placement_v1';
const ALIGNMENT_KEY = 'alignment';

interface ReaderControlPlacementSave {
  generation: number;
  alignment: ReaderControlAlignment;
}

export type ReaderControlPlacementSaveResult = 'ignored' | 'notDispatched' | 'pending' | 'confirmed';

export class ReaderControlPlacementPreferences {
  private static active: ReaderControlPlacementPreferences | undefined = undefined;
  // Finish dispatched I/O before a successor Ability opens the same store.
  private static tail: Promise<void> = Promise.resolve();
  private static generation: number = 0;
  private store: preferences.Preferences | undefined;
  private pending: ReaderControlPlacementSave | undefined;
  private readonly context: common.UIAbilityContext;
  private readonly ownerCurrent: () => boolean;

  private constructor(context: common.UIAbilityContext, ownerCurrent: () => boolean) {
    this.context = context;
    this.ownerCurrent = ownerCurrent;
  }

  static async install(context: common.UIAbilityContext, ownerCurrent: () => boolean): Promise<void> {
    if (!ownerCurrent()) return;
    const owner = new ReaderControlPlacementPreferences(context, ownerCurrent);
    ReaderControlPlacementPreferences.active = owner;
    AppStorage.setOrCreate(STORAGE_KEY, 'center');
    AppStorage.setOrCreate(PENDING_GENERATION_KEY, 0);
    await this.enqueue(async (): Promise<void> => {
      if (!owner.current()) return;
      const value = await (await owner.open()).get(ALIGNMENT_KEY, 'center');
      if (owner.current()) AppStorage.setOrCreate(STORAGE_KEY, readerControlAlignment(typeof value === 'string' ? value : undefined));
    });
  }

  static select(alignment: ReaderControlAlignment, inputCurrent: () => boolean): Promise<ReaderControlPlacementSaveResult> {
    const owner = ReaderControlPlacementPreferences.active;
    return this.enqueue(async (): Promise<ReaderControlPlacementSaveResult> => {
      if (owner === undefined || !owner.current() || !inputCurrent() || owner.pending !== undefined) return 'ignored';
      let store: preferences.Preferences;
      try { store = await owner.open(); }
      catch (_) { return owner.current() && inputCurrent() ? 'notDispatched' : 'ignored'; }
      if (!owner.current() || !inputCurrent()) return 'ignored';
      const original: ReaderControlPlacementSave = { generation: ++this.generation, alignment };
      owner.pending = original;
      return owner.write(store, original);
    });
  }

  static retry(generation: number, inputCurrent: () => boolean): Promise<ReaderControlPlacementSaveResult> {
    const owner = ReaderControlPlacementPreferences.active;
    return this.enqueue(async (): Promise<ReaderControlPlacementSaveResult> => {
      const original = owner?.pending;
      const store = owner?.store;
      if (owner === undefined || original === undefined || store === undefined || original.generation !== generation ||
        !owner.current() || !inputCurrent()) return 'ignored';
      return owner.write(store, original);
    });
  }

  static resetDefaults(): Promise<void> {
    const owner = this.active;
    return this.enqueue(async (): Promise<void> => {
      if (owner === undefined || !owner.current()) throw new Error('CONTROL_PLACEMENT_RETIRED');
      const store = await owner.open();
      if (!owner.current()) throw new Error('CONTROL_PLACEMENT_RETIRED');
      const original: ReaderControlPlacementSave = { generation: ++this.generation, alignment: 'center' };
      owner.pending = original;
      if (await owner.write(store, original) !== 'confirmed') throw new Error('CONTROL_PLACEMENT_RESET_UNCONFIRMED');
    });
  }

  private async open(): Promise<preferences.Preferences> {
    if (this.store !== undefined) return this.store;
    const store = await preferences.getPreferences(this.context, readerHostPreferencesName(this.context.filesDir, PREFERENCES_NAME));
    this.store = store;
    return store;
  }

  private async write(store: preferences.Preferences, original: ReaderControlPlacementSave): Promise<ReaderControlPlacementSaveResult> {
    try {
      await store.put(ALIGNMENT_KEY, original.alignment);
      await store.flush();
    } catch (_) {
      if (!this.current()) return 'ignored';
      AppStorage.setOrCreate(PENDING_GENERATION_KEY, original.generation);
      return 'pending';
    }
    if (!this.current()) return 'ignored';
    this.pending = undefined;
    AppStorage.setOrCreate(STORAGE_KEY, original.alignment);
    AppStorage.setOrCreate(PENDING_GENERATION_KEY, 0);
    return 'confirmed';
  }

  private current(): boolean {
    return ReaderControlPlacementPreferences.active === this && this.ownerCurrent();
  }

  private static enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then((): void => {}, (): void => {});
    return result;
  }
}
