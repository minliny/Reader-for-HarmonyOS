import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle } from './ReaderWindowCoordinator';
import { ReaderAppearanceStore } from '../features/reading/ReaderAppearanceStore';
import {
  appearanceThemeSelection, applyAppearanceThemeSelection, changeAppearanceThemeSelection,
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from '../features/reading/ReaderAppearanceState';
import {
  effectiveAppScheme, encodeReaderThemeSelection, restoreReaderThemeSelection,
  type ReaderThemeSelectionBackup,
} from '../features/common/ReaderThemeSelection';
import { readerAppColor, readerThemeDefinition, type ReaderThemeScheme, type ReaderAppThemeMode } from '../features/common/ReaderThemeRegistry';

/** One platform publisher. Rendering consumers never write a second theme preference. */
export class ReaderThemeHost {
  private static store: ReaderAppearanceStore | undefined = undefined;
  private static systemScheme: ReaderThemeScheme = 'day';
  private static generation: number = 0;
  private static recoveryBarrier: (() => Promise<void>) | undefined = undefined;
  private static unsubscribe: (() => void) | undefined = undefined;

  static async install(owner: ReaderRuntimeOwner, scheme: ReaderThemeScheme): Promise<void> {
    ReaderThemeHost.detach();
    const generation = ReaderThemeHost.generation;
    ReaderThemeHost.systemScheme = scheme;
    AppStorage.setOrCreate('readerSystemScheme', scheme);
    const store = owner.getAppearanceStore();
    ReaderThemeHost.store = store;
    ReaderThemeHost.unsubscribe = store.subscribe((snapshot: ReaderAppearanceSnapshot, revision: number): void => {
      if (generation === ReaderThemeHost.generation) ReaderThemeHost.publish(snapshot, revision);
    });
    const snapshot = await store.load();
    if (generation !== ReaderThemeHost.generation) return;
    // Keep a chosen same-scheme reading theme across restart. A changed system
    // scheme must reconcile both scopes before the first page is mounted.
    if (snapshot.appThemeMode === 'system' && readerThemeDefinition(snapshot.activeTheme).scheme !== ReaderThemeHost.systemScheme) {
      const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
        changeAppearanceThemeSelection(current, 'system', '', ReaderThemeHost.systemScheme));
      await commit?.saved;
    }
    if (generation === ReaderThemeHost.generation) ReaderThemeHost.publish(store.current(), store.currentRevision());
  }

  static detach(): void {
    ReaderThemeHost.generation += 1;
    ReaderThemeHost.unsubscribe?.();
    ReaderThemeHost.unsubscribe = undefined;
    ReaderThemeHost.store = undefined;
    ReaderThemeHost.recoveryBarrier = undefined;
  }

  static setRecoveryBarrier(barrier: () => Promise<void>): void {
    ReaderThemeHost.recoveryBarrier = barrier;
  }

  /** Runtime observation only; never part of a theme-selection backup. */
  static observedSystemScheme(): ReaderThemeScheme { return ReaderThemeHost.systemScheme; }

  /** Finish an already-approved restore before accepting a newer user choice.
   * Sync restore itself does not enter this barrier, so it cannot await itself. */
  static async prepareUserChange(): Promise<void> {
    const generation = ReaderThemeHost.generation;
    await ReaderThemeHost.recoveryBarrier?.();
    if (generation !== ReaderThemeHost.generation) throw new Error('THEME_OWNER_CHANGED');
  }

  static async systemChanged(scheme: ReaderThemeScheme): Promise<void> {
    if (scheme === ReaderThemeHost.systemScheme) return;
    ReaderThemeHost.systemScheme = scheme;
    AppStorage.setOrCreate('readerSystemScheme', scheme);
    await ReaderThemeHost.prepareUserChange();
    const store = ReaderThemeHost.store;
    if (store === undefined) return;
    const generation = ReaderThemeHost.generation;
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      changeAppearanceThemeSelection(current, 'system', '', scheme),
      (): boolean => generation === ReaderThemeHost.generation && scheme === ReaderThemeHost.systemScheme);
    await commit?.saved;
  }

  static async selectApp(mode: ReaderAppThemeMode): Promise<void> {
    await ReaderThemeHost.prepareUserChange();
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      changeAppearanceThemeSelection(current, 'app', mode, ReaderThemeHost.systemScheme));
    await commit?.saved;
  }

  static async durableBackup(): Promise<ReaderThemeSelectionBackup> {
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    await store.flush();
    if (store !== ReaderThemeHost.store) throw new Error('THEME_OWNER_CHANGED');
    return encodeReaderThemeSelection(appearanceThemeSelection(store.current()));
  }

  static backup(): ReaderThemeSelectionBackup {
    if (ReaderThemeHost.store === undefined) throw new Error('THEME_NOT_READY');
    return encodeReaderThemeSelection(appearanceThemeSelection(ReaderThemeHost.store.current()));
  }

  /** Configuration-reset coordinator already owns the recovery barrier. */
  static async resetAppearanceDefaults(): Promise<void> {
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    const generation = ReaderThemeHost.generation;
    const commit = await store.change((): ReaderAppearanceSnapshot =>
      changeAppearanceThemeSelection(createDefaultReaderAppearanceSnapshot(), 'system', '', ReaderThemeHost.systemScheme),
      (): boolean => generation === ReaderThemeHost.generation && store === ReaderThemeHost.store);
    if (commit === undefined) throw new Error('THEME_OWNER_CHANGED');
    await commit.saved;
  }

  /** Caller must have resolved any sync conflict with the user's explicit choice. */
  static async restore(backup: ReaderThemeSelectionBackup): Promise<string> {
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    const restored = restoreReaderThemeSelection(backup, ReaderThemeHost.systemScheme);
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      applyAppearanceThemeSelection(current, restored.selection));
    await commit?.saved;
    return restored.fallbackReason;
  }

  private static publish(snapshot: ReaderAppearanceSnapshot, revision: number): void {
    const scheme = effectiveAppScheme(appearanceThemeSelection(snapshot), ReaderThemeHost.systemScheme);
    AppStorage.setOrCreate('readerAppThemeMode', snapshot.appThemeMode);
    AppStorage.setOrCreate('readerAppScheme', scheme);
    AppStorage.setOrCreate('readerAppearanceRevision', revision);
    ReaderWindowCoordinator.updateAppChromeStyle(new ReaderWindowChromeStyle(
      readerAppColor('app.window.background', scheme), scheme === 'night' ? 'light' : 'dark',
      readerAppColor('app.window.foreground', scheme)));
  }
}
