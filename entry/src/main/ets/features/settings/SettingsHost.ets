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

  cacheCleanupSnapshot(owner: ReaderRuntimeOwner | undefined): SettingsCacheCleanupSnapshot | undefined {
    return owner !== undefined && this.cacheCleanup?.owns(owner) ? this.cacheCleanup.current() : undefined;
  }

  clearCache(owner: ReaderRuntimeOwner, current: () => boolean): Promise<SettingsCacheCleanupSnapshot> {
    if (this.cacheCleanup === undefined || !this.cacheCleanup.owns(owner)) {
      this.cacheCleanup = new SettingsCacheCleanupOwner(owner, (snapshot: SettingsCacheCleanupSnapshot): void => {
        this.emitCacheCleanup(snapshot, owner);
      });
    }
    return this.cacheCleanup.clear(current);
  }

  private getOrchestrator(): SettingsOrchestrator {
    if (this.orchestrator === undefined || !this.orchestrator.owns(ReaderRuntimeOwner.current())) {
      this.orchestrator = new SettingsOrchestrator(this.emit, this.read, this.isCurrent, this.context(), this.emitOperation);
    }
    return this.orchestrator;
  }
}
