import preferences from '@ohos.data.preferences';
import { common } from '@kit.AbilityKit';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';

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

export function createDefaultSettingsSnapshot(): SettingsSnapshot {
  return { autoCheckUpdate: true, tapBottomScrollTop: true, reduceMotion: false, crashLog: true };
}

export class SettingsGateway {
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | undefined;
  // `update` writes a complete snapshot as four preference keys followed by a
  // flush. Keep those sequences ordered so overlapping page intents cannot
  // persist a mixed snapshot. The tail is always resolved in `finally`: a
  // rejected write must not prevent a later, independent update from running.
  private static updateTails: Map<common.UIAbilityContext, Promise<void>> = new Map();

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async load(): Promise<SettingsSnapshot> {
    await ReaderThemeHost.prepareUserChange();
    // Do not expose a half-written four-key snapshot while an update is in
    // flight. `update` always releases this tail, including its error path.
    const previous = SettingsGateway.updateTails.get(this.context);
    let release: (() => void) | undefined = undefined;
    const tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    SettingsGateway.updateTails.set(this.context, tail);
    await previous;
    try { return await this.readSnapshot(await this.ensureStore()); }
    finally {
      release?.();
      if (SettingsGateway.updateTails.get(this.context) === tail) SettingsGateway.updateTails.delete(this.context);
    }
  }

  async update(snapshot: SettingsSnapshot, resetOwned: boolean = false,
    changedKey?: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog'): Promise<SettingsSnapshot> {
    // A caller can retain and mutate its state object while this update waits
    // behind another write. Capture the full requested snapshot at call time.
    let requestedSnapshot = this.copySnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    const previousUpdate = SettingsGateway.updateTails.get(this.context);
    let releaseUpdate: (() => void) | undefined = undefined;
    const nextUpdate = new Promise<void>((resolve: () => void): void => {
      releaseUpdate = resolve;
    });
    SettingsGateway.updateTails.set(this.context, nextUpdate);
    await previousUpdate;

    try {
      const store = await this.ensureStore();
      const previous = await this.readSnapshot(store);
      if (changedKey !== undefined) {
        // A user toggle admitted after recovery changes only its own field.
        // Never replay its pre-recovery siblings over the restored defaults.
        requestedSnapshot = {
          autoCheckUpdate: changedKey === 'autoCheckUpdate' ? requestedSnapshot.autoCheckUpdate : previous.autoCheckUpdate,
          tapBottomScrollTop: changedKey === 'tapBottomScrollTop' ? requestedSnapshot.tapBottomScrollTop : previous.tapBottomScrollTop,
          reduceMotion: changedKey === 'reduceMotion' ? requestedSnapshot.reduceMotion : previous.reduceMotion,
          crashLog: changedKey === 'crashLog' ? requestedSnapshot.crashLog : previous.crashLog,
        };
      }
      try {
        await this.writeSnapshot(store, requestedSnapshot);
        await store.flush();
      } catch (error) {
        // A failed flush must not leave unconfirmed values readable from the
        // Preferences in-memory cache. A durable reset intent remains retryable.
        await this.writeSnapshot(store, previous);
        throw error;
      }
      return this.copySnapshot(requestedSnapshot);
    } finally {
      if (releaseUpdate !== undefined) {
        releaseUpdate();
      }
      if (SettingsGateway.updateTails.get(this.context) === nextUpdate) SettingsGateway.updateTails.delete(this.context);
    }
  }

  private async writeSnapshot(store: preferences.Preferences, snapshot: SettingsSnapshot): Promise<void> {
    await store.put('autoCheckUpdate', snapshot.autoCheckUpdate);
    await store.put('tapBottomScrollTop', snapshot.tapBottomScrollTop);
    await store.put('reduceMotion', snapshot.reduceMotion);
    await store.put('crashLog', snapshot.crashLog);
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
