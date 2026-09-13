import {
  SettingsGateway,
  type SettingsSnapshot,
} from './SettingsGateway';
import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { LocalConfigurationReset } from './LocalConfigurationReset';

const DOMAIN = 0x5244;

export type SettingsKey =
  'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog';

/**
 * Owns the Settings page's orchestration. A plain class: entry load and the
 * optimistic toggle write are guarded by an entry `session` plus a per-write
 * `writeGeneration`, so a stale completion can never repaint a newer intent or
 * a later re-entry. Emits typed `SettingsSnapshot`s; Index only forwards them.
 *
 * `read()` returns the current snapshot (Index's @State) so an intent is built
 * from the latest user-visible state, exactly like the previous Index inline code.
 */
export class SettingsOrchestrator {
  private gateway: SettingsGateway;
  private emit: (snapshot: SettingsSnapshot) => void;
  private read: () => SettingsSnapshot;
  private isCurrent: () => boolean;
  private session: number = 0;
  private writeGeneration: number = 0;
  private resetting: boolean = false;

  constructor(
    emit: (snapshot: SettingsSnapshot) => void,
    read: () => SettingsSnapshot,
    isCurrent: () => boolean,
    context: common.UIAbilityContext,
  ) {
    this.gateway = new SettingsGateway(context);
    this.emit = emit;
    this.read = read;
    this.isCurrent = isCurrent;
  }

  /** Enter the Settings page: reload the authoritative Host snapshot. */
  open(): void {
    this.session += 1;
    const session = this.session;
    const expectedWrite = this.writeGeneration;
    this.gateway.load()
      .then((snapshot: SettingsSnapshot): void => {
        // A read started before a switch write may return an older coherent
        // snapshot. Do not repaint a newer user intent with it.
        if (!this.isCurrentSession(session, expectedWrite)) {
          return;
        }
        this.emit(snapshot);
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session, expectedWrite)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Settings load failed: %{private}s', error.message);
      });
  }

  /** Optimistically flip one switch; persist async, roll back on failure. */
  toggle(key: SettingsKey, value: boolean): void {
    if (this.resetting) return;
    // Optimistic in-page update; persist asynchronously to the Host
    // preferences store (app-level settings, not Core-owned).
    const intent = this.withSetting(key, value);
    const writeGeneration = this.writeGeneration + 1;
    this.writeGeneration = writeGeneration;
    this.emit(intent);
    this.gateway.update(intent, false, key)
      .then((snapshot: SettingsSnapshot): void => {
        if (writeGeneration !== this.writeGeneration || !this.isCurrent()) {
          return;
        }
        this.emit(snapshot);
      })
      .catch((error: Error): void => {
        if (writeGeneration !== this.writeGeneration || !this.isCurrent()) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Settings update failed: %{private}s', error.message);
        // No Figma failure affordance exists for this row. Restore the actual
        // Host-owned values rather than leaving the optimistic switch in a
        // state that did not persist.
        this.gateway.load()
          .then((snapshot: SettingsSnapshot): void => {
            if (writeGeneration === this.writeGeneration && this.isCurrent()) {
              this.emit(snapshot);
            }
          })
          .catch((reloadError: Error): void => {
            hilog.error(DOMAIN, 'Reader', 'Settings recovery load failed: %{private}s', reloadError.message);
          });
      });
  }

  async restoreDefaults(): Promise<boolean> {
    if (this.resetting) return false;
    this.resetting = true;
    const session = this.session;
    const generation = ++this.writeGeneration;
    try {
      await LocalConfigurationReset.request(ReaderRuntimeOwner.current());
      const snapshot = await this.gateway.load();
      if (this.isCurrentSession(session, generation)) this.emit(snapshot);
      return true;
    } catch (error) {
      hilog.error(DOMAIN, 'Reader', 'Configuration reset remains retryable: %{private}s', (error as Error).message);
      throw error as Error;
    } finally { this.resetting = false; }
  }

  private isCurrentSession(session: number, expectedWrite: number): boolean {
    return this.isCurrent() && session === this.session && expectedWrite === this.writeGeneration;
  }

  private withSetting(key: SettingsKey, value: boolean): SettingsSnapshot {
    const current = this.read();
    return {
      autoCheckUpdate: key === 'autoCheckUpdate' ? value : current.autoCheckUpdate,
      tapBottomScrollTop: key === 'tapBottomScrollTop' ? value : current.tapBottomScrollTop,
      reduceMotion: key === 'reduceMotion' ? value : current.reduceMotion,
      crashLog: key === 'crashLog' ? value : current.crashLog,
    };
  }
}
