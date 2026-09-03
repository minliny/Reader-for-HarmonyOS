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
  // `update` writes a complete snapshot as four preference keys followed by a
  // flush. Keep those sequences ordered so overlapping page intents cannot
  // persist a mixed snapshot. The tail is always resolved in `finally`: a
  // rejected write must not prevent a later, independent update from running.
  private updateTail: Promise<void> = Promise.resolve();

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(): Promise<SettingsSnapshot> {
    // Do not expose a half-written four-key snapshot while an update is in
    // flight. `update` always releases this tail, including its error path.
    await this.updateTail;
    const store = await this.ensureStore();
    return this.readSnapshot(store);
  }

  async update(snapshot: SettingsSnapshot): Promise<SettingsSnapshot> {
    // A caller can retain and mutate its state object while this update waits
    // behind another write. Capture the full requested snapshot at call time.
    const requestedSnapshot = this.copySnapshot(snapshot);
    const previousUpdate = this.updateTail;
    let releaseUpdate: (() => void) | undefined = undefined;
    this.updateTail = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    await previousUpdate;

    try {
      const store = await this.ensureStore();
      await store.put('autoCheckUpdate', requestedSnapshot.autoCheckUpdate);
      await store.put('tapBottomScrollTop', requestedSnapshot.tapBottomScrollTop);
      await store.put('reduceMotion', requestedSnapshot.reduceMotion);
      await store.put('crashLog', requestedSnapshot.crashLog);
      await store.flush();
      return this.readSnapshot(store);
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
    }
  }

  private async readSnapshot(store: preferences.Preferences): Promise<SettingsSnapshot> {
    return {
      autoCheckUpdate: (await store.get('autoCheckUpdate', DEFAULT_SNAPSHOT.autoCheckUpdate)) as boolean,
      tapBottomScrollTop: (await store.get('tapBottomScrollTop', DEFAULT_SNAPSHOT.tapBottomScrollTop)) as boolean,
      reduceMotion: (await store.get('reduceMotion', DEFAULT_SNAPSHOT.reduceMotion)) as boolean,
      crashLog: (await store.get('crashLog', DEFAULT_SNAPSHOT.crashLog)) as boolean,
    };
  }

  private copySnapshot(snapshot: SettingsSnapshot): SettingsSnapshot {
    return {
      autoCheckUpdate: snapshot.autoCheckUpdate,
      tapBottomScrollTop: snapshot.tapBottomScrollTop,
      reduceMotion: snapshot.reduceMotion,
      crashLog: snapshot.crashLog,
    };
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) {
      return this.store;
    }
    this.store = await preferences.getPreferences(this.context, SETTINGS_PREFERENCES_NAME);
    return this.store;
  }
}
