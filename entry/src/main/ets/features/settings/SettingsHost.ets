import { SettingsOrchestrator, type SettingsKey, type SettingsOperationProjection } from './SettingsOrchestrator';
export type { SettingsOperationProjection } from './SettingsOrchestrator';
import type { SettingsSnapshot } from './SettingsGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { common } from '@kit.AbilityKit';
import { SettingsCacheCleanupOwner, type SettingsCacheCleanupSnapshot } from './SettingsCacheCleanupOwner';
export type { SettingsCacheCleanupSnapshot } from './SettingsCacheCleanupOwner';

/**
 * Entry-owned Settings boundary. Index keeps the ArkUI snapshot projection
 * because other page shells consume it, while this host owns construction and
 * dispatch of the settings orchestrator and its context-bound gateway.
 */
export class SettingsHost {
  private orchestrator: SettingsOrchestrator | undefined = undefined;
  private readonly emit: (snapshot: SettingsSnapshot) => void;
  private readonly read: () => SettingsSnapshot;
  private readonly isCurrent: () => boolean;
  private readonly context: () => common.UIAbilityContext;
  private readonly emitOperation: (projection: SettingsOperationProjection) => void;
  private cacheCleanup: SettingsCacheCleanupOwner | undefined = undefined;
  private readonly emitCacheCleanup: (snapshot: SettingsCacheCleanupSnapshot, owner: ReaderRuntimeOwner) => void;

  constructor(
    emit: (snapshot: SettingsSnapshot) => void,
    read: () => SettingsSnapshot,
    isCurrent: () => boolean,
    context?: () => common.UIAbilityContext,
    emitOperation: (projection: SettingsOperationProjection) => void = (_projection: SettingsOperationProjection): void => {},
    emitCacheCleanup: (snapshot: SettingsCacheCleanupSnapshot, owner: ReaderRuntimeOwner) => void =
      (_snapshot: SettingsCacheCleanupSnapshot, _owner: ReaderRuntimeOwner): void => {},
  ) {
    this.emit = emit;
    this.read = read;
    this.isCurrent = isCurrent;
    this.context = context ?? ((): common.UIAbilityContext => ReaderRuntimeOwner.current().getUIAbilityContext());
    this.emitOperation = emitOperation;
    this.emitCacheCleanup = emitCacheCleanup;
  }

  open(): void { this.getOrchestrator().open(); }
  toggle(key: SettingsKey, value: boolean): void { this.getOrchestrator().toggle(key, value); }
  restoreDefaults(): Promise<boolean> { return this.getOrchestrator().restoreDefaults(); }
  reconcile(generation: number): void { this.getOrchestrator().reconcile(generation); }
  retryAccepted(generation: number): void { this.getOrchestrator().retryAccepted(generation); }

  cacheCleanupSnapshot(owner: ReaderRuntimeOwner | undefined): SettingsCacheCleanupSnapshot | undefined {
    if (owner === undefined) return undefined;
    if (this.cacheCleanup?.owns(owner)) return this.cacheCleanup.current();
    return SettingsCacheCleanupOwner.peekForRuntime(owner)?.current();
  }

  clearCache(owner: ReaderRuntimeOwner, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (!this.cacheCleanupAdmitted(owner, current)) return Promise.resolve(this.cacheCleanup?.current() ?? new SettingsCacheCleanupOwner(owner, (_snapshot: SettingsCacheCleanupSnapshot): void => {}).current());
    return this.cacheCleanupOwner(owner).clear(current);
  }
  reconcileCacheCleanup(owner: ReaderRuntimeOwner, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (!this.cacheCleanupAdmitted(owner, current)) return Promise.resolve(this.cacheCleanup?.current() ?? new SettingsCacheCleanupOwner(owner, (_snapshot: SettingsCacheCleanupSnapshot): void => {}).current());
    return this.cacheCleanupOwner(owner).reconcile(current);
  }
  continueOriginalCacheCleanup(owner: ReaderRuntimeOwner, generation: number, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (!this.cacheCleanupAdmitted(owner, current)) return Promise.resolve(this.cacheCleanup?.current() ?? new SettingsCacheCleanupOwner(owner, (_snapshot: SettingsCacheCleanupSnapshot): void => {}).current());
    return this.cacheCleanupOwner(owner).continueOriginal(generation, current);
  }
  private cacheCleanupAdmitted(owner: ReaderRuntimeOwner, current: () => boolean): boolean {
    try { return ReaderRuntimeOwner.isCurrent(owner) && current(); } catch (_) { return false; }
  }
  private cacheCleanupOwner(owner: ReaderRuntimeOwner): SettingsCacheCleanupOwner {
    const shared = SettingsCacheCleanupOwner.forRuntime(owner, (snapshot: SettingsCacheCleanupSnapshot): void => {
      this.emitCacheCleanup(snapshot, owner);
    });
    if (shared === undefined) throw new Error('Settings cache Runtime retired before owner admission');
    this.cacheCleanup = shared;
    return shared;
  }

  private getOrchestrator(): SettingsOrchestrator {
    if (this.orchestrator === undefined || !this.orchestrator.owns(ReaderRuntimeOwner.current())) {
      this.orchestrator = new SettingsOrchestrator(this.emit, this.read, this.isCurrent, this.context(), this.emitOperation);
    }
    return this.orchestrator;
  }
}
