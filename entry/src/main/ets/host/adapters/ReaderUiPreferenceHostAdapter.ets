// ReaderUiPreferenceHostAdapter — platform-owned persistence for the narrow
// Reader UI allowlist. Business/domain data must never enter this store.
//
// This allowlist contains only presentation-owned preferences: reduced motion
// and the global five-value page-turn selection. First-run completion,
// app-theme, per-book overrides and all domain data stay out until their
// owner/migration contract is frozen.
import dataPreferences from '@ohos.data.preferences';
import common from '@ohos.app.ability.common';

const PREFERENCES_NAME: string = 'reader_ui_preferences_v1';
const KEY_SCHEMA_VERSION: string = 'schemaVersion';
const KEY_REDUCED_MOTION: string = 'reducedMotion';
const KEY_PAGE_ANIMATION: string = 'pageAnimation';
const KEY_PAGE_MODE: string = 'pageMode';
const SCHEMA_VERSION: number = 1;
const DEFAULT_PAGE_ANIMATION: ReaderPageAnimationPreference = 'slide';
const DEFAULT_PAGE_MODE: ReaderPageModePreference = 'horizontal';

// Keep these values in their stable implementation form, never the visible
// Figma labels. The reducer translates labels only at the UI boundary.
export type ReaderPageAnimationPreference =
  'cover' | 'slide' | 'simulation' | 'scroll' | 'none';
export type ReaderPageModePreference = 'horizontal' | 'vertical';

export interface ReaderPageTurnPreference {
  pageAnimation: ReaderPageAnimationPreference;
  // This is a checked compatibility mirror, not a separately writable choice.
  // `scroll` is the sole vertical layout; every other animation is horizontal.
  pageMode: ReaderPageModePreference;
}

export interface ReaderUiPreferenceSnapshot extends ReaderPageTurnPreference {
  schemaVersion: number;
  reducedMotion: boolean;
}

function isPageAnimationPreference(value: string): boolean {
  return value === 'cover' || value === 'slide' || value === 'simulation' ||
    value === 'scroll' || value === 'none';
}

function isPageModePreference(value: string): boolean {
  return value === 'horizontal' || value === 'vertical';
}

function pageModeForAnimation(pageAnimation: ReaderPageAnimationPreference): ReaderPageModePreference {
  return pageAnimation === 'scroll' ? 'vertical' : 'horizontal';
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
      const schemaVersion = await preferences.get(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
      if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) ||
        schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`unsupported Reader UI preference schema ${schemaVersion}`);
      }
      const reducedMotion = await preferences.get(KEY_REDUCED_MOTION, false);
      if (typeof reducedMotion !== 'boolean') {
        throw new Error('invalid Reader UI preference reducedMotion');
      }
      // These defaults keep existing v1 reduced-motion-only records compatible.
      // Once either page-turn key is present, however, the pair must be
      // complete. This rejects a partial interrupted write even when the
      // missing value would otherwise coincide with the default.
      const hasPageAnimation = await preferences.has(KEY_PAGE_ANIMATION);
      const hasPageMode = await preferences.has(KEY_PAGE_MODE);
      if (hasPageAnimation !== hasPageMode) {
        throw new Error('incomplete Reader UI preference pageAnimation/pageMode');
      }
      if (!hasPageAnimation) {
        return {
          schemaVersion: SCHEMA_VERSION,
          reducedMotion: reducedMotion,
          pageAnimation: DEFAULT_PAGE_ANIMATION,
          pageMode: DEFAULT_PAGE_MODE,
        };
      }
      // Any present non-string, non-five-value, or inconsistent pair fails
      // closed rather than being normalized and silently written back.
      const pageAnimation = await preferences.get(KEY_PAGE_ANIMATION, DEFAULT_PAGE_ANIMATION);
      const pageMode = await preferences.get(KEY_PAGE_MODE, DEFAULT_PAGE_MODE);
      if (typeof pageAnimation !== 'string' || !isPageAnimationPreference(pageAnimation)) {
        throw new Error('invalid Reader UI preference pageAnimation');
      }
      if (typeof pageMode !== 'string' || !isPageModePreference(pageMode)) {
        throw new Error('invalid Reader UI preference pageMode');
      }
      if (pageMode !== pageModeForAnimation(pageAnimation as ReaderPageAnimationPreference)) {
        throw new Error('inconsistent Reader UI preference pageAnimation/pageMode');
      }
      return {
        schemaVersion: SCHEMA_VERSION,
        reducedMotion: reducedMotion,
        pageAnimation: pageAnimation as ReaderPageAnimationPreference,
        pageMode: pageMode as ReaderPageModePreference,
      };
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.load failed: ${e}`);
    }
  }

  async saveReducedMotion(enabled: boolean): Promise<void> {
    try {
      if (typeof enabled !== 'boolean') throw new Error('reducedMotion must be boolean');
      const preferences = await this.ensurePreferences();
      await preferences.put(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
      await preferences.put(KEY_REDUCED_MOTION, enabled);
      await preferences.flush();
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.saveReducedMotion failed: ${e}`);
    }
  }

  async savePageTurnPreference(pageAnimation: string, pageMode: string): Promise<void> {
    try {
      if (!isPageAnimationPreference(pageAnimation)) {
        throw new Error('pageAnimation must be one of cover/slide/simulation/scroll/none');
      }
      if (!isPageModePreference(pageMode) ||
        pageMode !== pageModeForAnimation(pageAnimation as ReaderPageAnimationPreference)) {
        throw new Error('pageMode must match the selected pageAnimation');
      }
      const preferences = await this.ensurePreferences();
      await preferences.put(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
      await preferences.put(KEY_PAGE_ANIMATION, pageAnimation);
      await preferences.put(KEY_PAGE_MODE, pageMode);
      await preferences.flush();
    } catch (e) {
      throw new Error(`ReaderUiPreferenceHostAdapter.savePageTurnPreference failed: ${e}`);
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
