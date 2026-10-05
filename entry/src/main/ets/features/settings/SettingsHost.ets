import { SettingsOrchestrator, type SettingsKey, type SettingsOperationProjection } from './SettingsOrchestrator';
import type { SettingsSnapshot } from './SettingsGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { common } from '@kit.AbilityKit';
import { SettingsCacheCleanupOwner, type SettingsCacheCleanupSnapshot } from './SettingsCacheCleanupOwner';
export type { SettingsOperationProjection } from './SettingsOrchestrator';
export type { SettingsCacheCleanupSnapshot } from './SettingsCacheCleanupOwner';

/**
 * Entry-owned Settings boundary. Index keeps the ArkUI snapshot projection
 * because other page shells consume it, while this host owns construction and
 * dispatch of the settings orchestrator and its context-bound gateway.
 */
let settingsHostPresentationSequence: number = 0;
export class SettingsHost {
  private orchestrator: SettingsOrchestrator | undefined = undefined;
  private boundOwner: ReaderRuntimeOwner | undefined;
  private presentationIdentity: string = '';
  private explicitBinding: boolean = false;
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

  bindPresentation(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): boolean {
    if (identity.length === 0) return false;
    try { if (!ReaderRuntimeOwner.isCurrent(owner) || !current()) return false; } catch (_) { return false; }
    if (this.boundOwner === owner && this.presentationIdentity === identity)
      return this.orchestrator?.isPresentationCurrent(identity) ?? false;
    const orchestrator = SettingsOrchestrator.forRuntime(owner, this.context());
    if (orchestrator === undefined || !orchestrator.attachPresentation(identity, this.emit, current, this.emitOperation)) return false;
    this.boundOwner = owner; this.presentationIdentity = identity; this.explicitBinding = true;
    this.orchestrator = orchestrator; return true;
  }
  isPresentationCurrent(owner: ReaderRuntimeOwner, identity: string): boolean {
    return this.boundOwner === owner && this.presentationIdentity === identity &&
      (this.orchestrator?.isPresentationCurrent(identity) ?? false);
  }
  detachPresentation(identity: string): void { this.orchestrator?.detachPresentation(identity); }
  open(identity?: string): void { this.admitted(identity)?.open(); }
  toggle(key: SettingsKey, value: boolean, identity?: string): void { this.admitted(identity)?.toggle(key, value); }
  restoreDefaults(identity?: string): Promise<boolean> { return this.admitted(identity)?.restoreDefaults() ?? Promise.resolve(false); }
  reconcile(generation: number, identity?: string): void { this.admitted(identity)?.reconcile(generation); }
  retryAccepted(generation: number, identity?: string): void { this.admitted(identity)?.retryAccepted(generation); }

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

  private admitted(identity?: string): SettingsOrchestrator | undefined {
    if (this.orchestrator === undefined) {
      const owner = ReaderRuntimeOwner.current();
      const legacyIdentity = `settings-host:${++settingsHostPresentationSequence}`;
      if (!this.bindPresentation(owner, legacyIdentity, this.isCurrent)) return undefined;
      this.explicitBinding = false;
    }
    if ((identity === undefined && this.explicitBinding) ||
      (identity !== undefined && identity !== this.presentationIdentity)) return undefined;
    return this.orchestrator?.isPresentationCurrent(this.presentationIdentity) ? this.orchestrator : undefined;
  }
}
