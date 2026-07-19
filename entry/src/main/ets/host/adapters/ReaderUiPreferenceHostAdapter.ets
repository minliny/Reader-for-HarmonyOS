// ReaderUiPreferenceHostAdapter — platform-owned persistence for the narrow
// Reader UI allowlist. Business/domain data must never enter this store.
//
// Slice 12 currently admits only reducedMotion, which CORE_HOST_BOUNDARY.md
// explicitly allows HarmonyOS to persist in preferences. First-run completion,
// app-theme and other setting keys stay out until their owner/migration contract
// is frozen.
import dataPreferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';

const PREFERENCES_NAME: string = 'reader_ui_preferences_v1';
const KEY_SCHEMA_VERSION: string = 'schemaVersion';
const KEY_REDUCED_MOTION: string = 'reducedMotion';
const SCHEMA_VERSION: number = 1;

export interface ReaderUiPreferenceSnapshot {
  schemaVersion: number;
  reducedMotion: boolean;
}

export class ReaderUiPreferenceHostAdapter {
  private context: common.Context;
  private preferences: dataPreferences.Preferences | null = null;

  constructor(context: common.Context) {
    this.context = context;
  }

  async load(): Promise<ReaderUiPreferenceSnapshot> {
    try {
      const preferences = await this.ensurePreferences();
      const schemaVersion = await preferences.get(KEY_SCHEMA_VERSION, SCHEMA_VERSION) as number;
      if (schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`unsupported Reader UI preference schema ${schemaVersion}`);
      }
      const reducedMotion = await preferences.get(KEY_REDUCED_MOTION, false) as boolean;
      return { schemaVersion: SCHEMA_VERSION, reducedMotion: reducedMotion };
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.load failed: ${e}`);
    }
  }

  async saveReducedMotion(enabled: boolean): Promise<void> {
    try {
      const preferences = await this.ensurePreferences();
      await preferences.put(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
      await preferences.put(KEY_REDUCED_MOTION, enabled);
      await preferences.flush();
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.saveReducedMotion failed: ${e}`);
    }
  }

  async resetAccessibility(): Promise<void> {
    await this.saveReducedMotion(false);
  }

  private async ensurePreferences(): Promise<dataPreferences.Preferences> {
    if (this.preferences !== null) return this.preferences;
    try {
      this.preferences = await dataPreferences.getPreferences(this.context, PREFERENCES_NAME);
      return this.preferences;
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.ensurePreferences failed: ${e}`);
    }
  }
}
