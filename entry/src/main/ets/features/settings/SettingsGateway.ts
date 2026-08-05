import preferences from '@ohos.data.preferences';
import { common } from '@kit.AbilityKit';

const SETTINGS_PREFERENCES_NAME = 'reader_settings_v1';

export type SettingsSnapshot = {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
};

const DEFAULT_SNAPSHOT: SettingsSnapshot = {
  autoCheckUpdate: true,
  tapBottomScrollTop: true,
  reduceMotion: false,
  crashLog: true,
};

export class SettingsGateway {
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | undefined;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(): Promise<SettingsSnapshot> {
    const store = await this.ensureStore();
    return {
      autoCheckUpdate: (await store.get('autoCheckUpdate', DEFAULT_SNAPSHOT.autoCheckUpdate)) as boolean,
      tapBottomScrollTop: (await store.get('tapBottomScrollTop', DEFAULT_SNAPSHOT.tapBottomScrollTop)) as boolean,
      reduceMotion: (await store.get('reduceMotion', DEFAULT_SNAPSHOT.reduceMotion)) as boolean,
      crashLog: (await store.get('crashLog', DEFAULT_SNAPSHOT.crashLog)) as boolean,
    };
  }

  async update(snapshot: SettingsSnapshot): Promise<SettingsSnapshot> {
    const store = await this.ensureStore();
    await store.put('autoCheckUpdate', snapshot.autoCheckUpdate);
    await store.put('tapBottomScrollTop', snapshot.tapBottomScrollTop);
    await store.put('reduceMotion', snapshot.reduceMotion);
    await store.put('crashLog', snapshot.crashLog);
    await store.flush();
    return this.load();
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) {
      return this.store;
    }
    this.store = await preferences.getPreferences(this.context, SETTINGS_PREFERENCES_NAME);
    return this.store;
  }
}