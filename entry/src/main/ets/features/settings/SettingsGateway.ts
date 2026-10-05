import preferences from '@ohos.data.preferences';
import { common } from '@kit.AbilityKit';
import { ReaderThemeHost } from '../../app/ReaderThemeHost';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';

const SETTINGS_PREFERENCES_NAME = 'reader_settings_v1';

export type SettingsSnapshot = {
  autoCheckUpdate: boolean;
  tapBottomScrollTop: boolean;
  reduceMotion: boolean;
  crashLog: boolean;
};
export type GeneralSettingsKey = 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog';
export interface GeneralSettingsWriteFacts {
  acceptedRevision: number;
  savedRevision: number;
  pendingReconciliation: boolean;
  busy: boolean;
  action: string;
  accepted?: SettingsSnapshot;
  saved?: SettingsSnapshot;
}
const DEFAULT_SNAPSHOT: SettingsSnapshot = {
  autoCheckUpdate: true, tapBottomScrollTop: true, reduceMotion: false, crashLog: true,
};
export function createDefaultSettingsSnapshot(): SettingsSnapshot {
  return { autoCheckUpdate: true, tapBottomScrollTop: true, reduceMotion: false, crashLog: true };
}

/** One real Preferences file, one IO lane across Ability/Runtime contexts.
 * Accepted choices and flush-confirmed choices are separate facts. Cached get
 * cannot prove an old flush durable; no failure authorizes an old-value write. */
export class SettingsGateway {
  private readonly context: common.UIAbilityContext;
  private store: preferences.Preferences | undefined;
  private static writeTail: Promise<void> = Promise.resolve();
  private static activeWrites: number = 0;
  private static accepted: SettingsSnapshot | undefined;
  private static saved: SettingsSnapshot | undefined;
  private static acceptedRevision: number = 0;
  private static savedRevision: number = 0;
  private static action: string = 'load';
  private static listeners: Set<(snapshot: SettingsSnapshot) => void> = new Set();

  constructor(context: common.UIAbilityContext) { this.context = context; }

  /** Background consumers receive coherent reads and flush-confirmed writes;
   * the page separately presents the accepted snapshot with its pending fact. */
  subscribe(listener: (snapshot: SettingsSnapshot) => void): () => void {
    SettingsGateway.listeners.add(listener);
    return (): void => { SettingsGateway.listeners.delete(listener); };
  }
  private publish(snapshot: SettingsSnapshot): void {
    for (const listener of SettingsGateway.listeners) {
      try { listener(this.copySnapshot(snapshot)); } catch (_) {}
    }
  }
  current(): SettingsSnapshot | undefined {
    return SettingsGateway.accepted === undefined ? undefined : this.copySnapshot(SettingsGateway.accepted);
  }
  writeFacts(): GeneralSettingsWriteFacts {
    return { acceptedRevision: SettingsGateway.acceptedRevision, savedRevision: SettingsGateway.savedRevision,
      pendingReconciliation: SettingsGateway.acceptedRevision !== SettingsGateway.savedRevision,
      busy: SettingsGateway.activeWrites > 0, action: SettingsGateway.action,
      accepted: this.current(), saved: SettingsGateway.saved === undefined ? undefined : this.copySnapshot(SettingsGateway.saved) };
  }

  async load(isAdmitted?: () => boolean): Promise<SettingsSnapshot> {
    await ReaderThemeHost.prepareUserChange();
    this.assertAdmitted(isAdmitted);
    // Rebuilt UI can show the complete accepted choice while an old flush is
    // unsettled. It must not publish that choice as a confirmed background fact.
    const facts = this.writeFacts();
    if (facts.pendingReconciliation && facts.accepted !== undefined) return facts.accepted;
    return this.withSettingsAccess(async (): Promise<SettingsSnapshot> => {
      this.assertAdmitted(isAdmitted);
      const facts = this.writeFacts();
      if (facts.pendingReconciliation && facts.accepted !== undefined) return facts.accepted;
      const store = await this.ensureStore();
      const snapshot = await this.readSnapshot(store);
      this.assertAdmitted(isAdmitted);
      SettingsGateway.accepted = this.copySnapshot(snapshot);
      this.publish(snapshot);
      return snapshot;
    });
  }

  async update(snapshot: SettingsSnapshot, resetOwned: boolean = false,
    changedKey?: GeneralSettingsKey, evidence?: ReaderWriteEvidence,
    isAdmitted?: () => boolean): Promise<SettingsSnapshot> {
    const requested = this.copySnapshot(snapshot);
    if (!resetOwned) await ReaderThemeHost.prepareUserChange();
    return this.writeRequested(requested, changedKey, evidence, isAdmitted);
  }

  /** Explicit finite idempotent setter retry. A queued callback cannot borrow
   * a newer accepted revision, and it never replays a reset or unrelated field. */
  async retryAccepted(evidence?: ReaderWriteEvidence, isAdmitted?: () => boolean): Promise<SettingsSnapshot> {
    const facts = this.writeFacts();
    if (!facts.pendingReconciliation || facts.accepted === undefined) throw new Error('SETTINGS_NO_PENDING_SAVE');
    const revision = facts.acceptedRevision;
    await ReaderThemeHost.prepareUserChange();
    return this.writeRequested(facts.accepted, undefined, evidence, (): boolean =>
      revision === SettingsGateway.acceptedRevision && this.admitted(isAdmitted));
  }

  private writeRequested(requested: SettingsSnapshot, changedKey?: GeneralSettingsKey,
    evidence?: ReaderWriteEvidence, isAdmitted?: () => boolean): Promise<SettingsSnapshot> {
    return this.withSettingsAccess(async (): Promise<SettingsSnapshot> => {
      const store = await this.ensureStore();
      const previous = this.current() ?? await this.readSnapshot(store);
      const snapshot: SettingsSnapshot = changedKey === undefined ? requested : {
        autoCheckUpdate: changedKey === 'autoCheckUpdate' ? requested.autoCheckUpdate : previous.autoCheckUpdate,
        tapBottomScrollTop: changedKey === 'tapBottomScrollTop' ? requested.tapBottomScrollTop : previous.tapBottomScrollTop,
        reduceMotion: changedKey === 'reduceMotion' ? requested.reduceMotion : previous.reduceMotion,
        crashLog: changedKey === 'crashLog' ? requested.crashLog : previous.crashLog,
      };
      // Actual first platform put is the dispatch boundary. Once dispatched,
      // retirement suppresses publication, not the already accepted flush.
      this.assertAdmitted(isAdmitted);
      if (SettingsGateway.acceptedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('SETTINGS_REVISION_EXHAUSTED');
      const revision = ++SettingsGateway.acceptedRevision;
      SettingsGateway.accepted = this.copySnapshot(snapshot);
      SettingsGateway.action = changedKey ?? 'save';
      SettingsGateway.activeWrites += 1;
      try {
        evidence?.dispatched();
        await this.writeSnapshot(store, snapshot);
        await store.flush();
        evidence?.confirmed();
        SettingsGateway.saved = this.copySnapshot(snapshot);
        SettingsGateway.savedRevision = revision;
        this.publish(snapshot);
        return this.copySnapshot(snapshot);
      } finally { SettingsGateway.activeWrites -= 1; }
    });
  }

  private async withSettingsAccess<T>(operation: () => Promise<T>): Promise<T> {
    const previous = SettingsGateway.writeTail;
    let release: (() => void) | undefined;
    SettingsGateway.writeTail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release?.(); }
  }
  private admitted(isAdmitted?: () => boolean): boolean {
    try { return isAdmitted?.() !== false; } catch (_) { return false; }
  }
  private assertAdmitted(isAdmitted?: () => boolean): void {
    if (!this.admitted(isAdmitted)) throw new Error('SETTINGS_OWNER_SUPERSEDED');
  }
  private async writeSnapshot(store: preferences.Preferences, snapshot: SettingsSnapshot): Promise<void> {
    await store.put('autoCheckUpdate', snapshot.autoCheckUpdate);
    await store.put('tapBottomScrollTop', snapshot.tapBottomScrollTop);
    await store.put('reduceMotion', snapshot.reduceMotion);
    await store.put('crashLog', snapshot.crashLog);
  }
  private async readSnapshot(store: preferences.Preferences): Promise<SettingsSnapshot> {
    const snapshot: SettingsSnapshot = {
      autoCheckUpdate: (await store.get('autoCheckUpdate', DEFAULT_SNAPSHOT.autoCheckUpdate)) as boolean,
      tapBottomScrollTop: (await store.get('tapBottomScrollTop', DEFAULT_SNAPSHOT.tapBottomScrollTop)) as boolean,
      reduceMotion: (await store.get('reduceMotion', DEFAULT_SNAPSHOT.reduceMotion)) as boolean,
      crashLog: (await store.get('crashLog', DEFAULT_SNAPSHOT.crashLog)) as boolean,
    };
    if (typeof snapshot.autoCheckUpdate !== 'boolean' || typeof snapshot.tapBottomScrollTop !== 'boolean' ||
      typeof snapshot.reduceMotion !== 'boolean' || typeof snapshot.crashLog !== 'boolean') throw new Error('设置持久化数据格式异常');
    return snapshot;
  }
  private copySnapshot(snapshot: SettingsSnapshot): SettingsSnapshot {
    return { autoCheckUpdate: snapshot.autoCheckUpdate, tapBottomScrollTop: snapshot.tapBottomScrollTop,
      reduceMotion: snapshot.reduceMotion, crashLog: snapshot.crashLog };
  }
  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store === undefined) this.store = await preferences.getPreferences(this.context, SETTINGS_PREFERENCES_NAME);
    return this.store;
  }
}
