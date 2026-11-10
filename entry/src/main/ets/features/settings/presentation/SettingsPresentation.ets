import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { effectiveReaderWideNavigationRail, isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope';
import type { CommitReadbackSummary } from '../../../app/ReaderOperationFacts';
import { READER_REDUCE_MOTION_STORAGE_KEY } from '../../../ui/foundation/ReaderMotionPolicy';
import { createDefaultSettingsSnapshot, SettingsGateway, type GeneralSettingsKey, type SettingsSnapshot } from '../application/SettingsGateway';
import { SettingsHost } from '../application/SettingsHost';
import type { SettingsCacheCleanupSnapshot } from '../application/SettingsCacheCleanupOwner';
import type { SettingsOperationProjection } from '../application/SettingsOrchestrator';

export type SettingsRoute = 'settings' | 'bookshelfSettings';

interface SettingsOpening {
  owner: ReaderRuntimeOwner;
  route: SettingsRoute;
  identity: string;
  isRouteCurrent: () => boolean;
}

/** Publishes accepted preferences and binds one settings surface to the
 * existing runtime owner. Detaching a surface only retires its callbacks. */
@Observed
export class SettingsPresentation {
  snapshot: SettingsSnapshot = createDefaultSettingsSnapshot();
  operation: SettingsOperationProjection = { action: 'load' };
  cacheCleanup: SettingsCacheCleanupSnapshot | undefined;
  identity: string = '';
  private applicationSnapshot: SettingsSnapshot | undefined;
  private unsubscribe: (() => void) | undefined;
  private opening: SettingsOpening | undefined;
  private host: SettingsHost | undefined;

  private settingsHost(): SettingsHost {
    if (this.host === undefined) {
      this.host = new SettingsHost(
        (snapshot: SettingsSnapshot): void => {
          if (this.opening?.isRouteCurrent() !== true) return;
          this.snapshot = snapshot;
          AppStorage.setOrCreate<boolean>('readerWideNavigationRail', effectiveReaderWideNavigationRail(snapshot.wideNavigationRail));
        },
        (): SettingsSnapshot => this.snapshot,
        (): boolean => this.opening?.isRouteCurrent() === true,
        undefined,
        (operation: SettingsOperationProjection): void => {
          if (this.opening?.isRouteCurrent() === true) this.operation = operation;
        },
        (snapshot: SettingsCacheCleanupSnapshot, owner: ReaderRuntimeOwner): void => {
          if (this.opening?.owner === owner && this.opening?.route === 'settings' &&
            this.opening?.isRouteCurrent() === true) this.cacheCleanup = snapshot;
        },
      );
    }
    return this.host;
  }

  mount(owner: ReaderRuntimeOwner, changed: () => void): void {
    this.unsubscribe?.();
    AppStorage.setOrCreate<boolean>('readerWideNavigationRail', effectiveReaderWideNavigationRail(this.snapshot.wideNavigationRail === true));
    this.cacheCleanup = this.settingsHost().cacheCleanupSnapshot(owner);
    const gateway = new SettingsGateway(owner.getUIAbilityContext());
    this.unsubscribe = gateway.subscribe((snapshot: SettingsSnapshot): void => {
      this.applicationSnapshot = snapshot;
      AppStorage.setOrCreate<boolean>(READER_REDUCE_MOTION_STORAGE_KEY, snapshot.reduceMotion === true);
      AppStorage.setOrCreate<boolean>('readerWideNavigationRail', effectiveReaderWideNavigationRail(snapshot.wideNavigationRail === true));
      AppStorage.setOrCreate<boolean>('readerDeveloperMode', snapshot.developerMode === true);
      if (this.opening?.isRouteCurrent() !== true) this.snapshot = snapshot;
      changed();
    });
    void gateway.load().catch((): void => {});
  }

  ready(): boolean { return this.applicationSnapshot !== undefined; }

  autoCheckUpdateEnabled(): boolean {
    return this.applicationSnapshot?.autoCheckUpdate === true && this.snapshot.autoCheckUpdate;
  }

  open(owner: ReaderRuntimeOwner, route: SettingsRoute, identity: string, isRouteCurrent: () => boolean): void {
    if (!isRouteCurrent()) return;
    if (this.isCurrent(identity)) return;
    this.retire();
    const opening: SettingsOpening = { owner, route, identity, isRouteCurrent };
    this.opening = opening;
    const host = this.settingsHost();
    const bound = host.bindPresentation(owner, identity, (): boolean =>
      this.opening === opening && isRouteCurrent());
    if (!bound) {
      this.opening = undefined;
      return;
    }
    this.identity = identity;
    if (route === 'settings') {
      this.cacheCleanup = this.settingsHost().cacheCleanupSnapshot(owner);
      void this.reconcileCache(identity, undefined);
    }
    host.open(identity);
  }

  isCurrent(identity: string): boolean {
    const opening = this.opening;
    return identity.length > 0 && opening !== undefined && opening.identity === identity &&
      opening.isRouteCurrent() && this.host?.isPresentationCurrent(opening.owner, identity) === true;
  }

  retire(): void {
    this.host?.detachPresentation(this.identity);
    this.opening = undefined;
    this.identity = '';
  }

  dispose(): void {
    this.retire();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.applicationSnapshot = undefined;
  }

  toggle(identity: string, key: GeneralSettingsKey, value: boolean): void {
    if (key === 'wideNavigationRail' && !isReaderProductSurfaceEnabled('wideNavigationRail')) return;
    if (this.isCurrent(identity)) this.host?.toggle(key, value, identity);
  }

  restoreDefaults(identity: string): Promise<CommitReadbackSummary | undefined> {
    return this.isCurrent(identity) ? this.settingsHost().restoreDefaults(identity) : Promise.resolve(undefined);
  }

  reconcile(identity: string, expected: number, retry: boolean = false): void {
    if (!this.isCurrent(identity)) return;
    if (retry) this.host?.retryAccepted(expected, identity);
    else this.host?.reconcile(expected, identity);
  }

  async reconcileCache(identity: string, expected: number | undefined, continuing: boolean = false): Promise<void> {
    const opening = this.opening;
    const current = (): boolean => this.isCurrent(identity);
    if (opening === undefined || opening.route !== 'settings' || !current()) return;
    const host = this.settingsHost();
    const previous = host.cacheCleanupSnapshot(opening.owner);
    if (expected !== undefined && previous?.operation.generation !== expected) return;
    if (continuing && expected !== undefined) await host.continueOriginalCacheCleanup(opening.owner, expected, current);
    else await host.reconcileCacheCleanup(opening.owner, current);
  }

  async clearCache(identity: string): Promise<void> {
    const opening = this.opening;
    const current = (): boolean => this.isCurrent(identity);
    if (opening === undefined || opening.route !== 'settings' || !current()) return;
    await this.settingsHost().clearCache(opening.owner, current);
  }
}
