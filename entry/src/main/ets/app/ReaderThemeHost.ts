import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import { ReaderWindowCoordinator, ReaderWindowChromeStyle } from './ReaderWindowCoordinator';
import { ReaderAppearanceStore, ReaderAppearanceCommit, ReaderAppearanceSaveUnconfirmedError } from '../features/reading/application/ReaderAppearanceStore';
import {
  appearanceThemeSelection, applyAppearanceThemeSelection, changeAppearanceThemeSelection,
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from '../features/reading/application/ReaderAppearanceState';
import {
  effectiveAppScheme, encodeReaderThemeSelection, restoreReaderThemeSelection,
  type ReaderThemeIntent, type ReaderThemeSelectionBackup,
} from './ReaderThemeSelection';
import { readerAppColor, readerThemeDefinition, type ReaderThemeId, type ReaderThemeScheme, type ReaderAppThemeMode } from '../ui/foundation/ReaderThemeRegistry';

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
    await owner.waitForPredecessorClose();
    if (generation !== ReaderThemeHost.generation || !ReaderRuntimeOwner.isCurrent(owner)) return;
    const store = owner.getAppearanceStore();
    ReaderThemeHost.store = store;
    const snapshot = await store.load();
    if (generation !== ReaderThemeHost.generation) return;
    // Keep a chosen same-scheme reading theme across restart. A changed system
    // scheme must reconcile both scopes before the first page is mounted.
    let reconciled: ReaderAppearanceCommit | undefined;
    if (snapshot.appThemeMode === 'system' && readerThemeDefinition(snapshot.activeTheme).scheme !== ReaderThemeHost.systemScheme) {
      reconciled = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
        changeAppearanceThemeSelection(current, 'system', '', ReaderThemeHost.systemScheme),
        (): boolean => generation === ReaderThemeHost.generation && store === ReaderThemeHost.store && ReaderRuntimeOwner.isCurrent(owner));
    }
    if (generation !== ReaderThemeHost.generation) return;
    ReaderThemeHost.unsubscribe = store.subscribe((current: ReaderAppearanceSnapshot, revision: number): void => {
      if (generation === ReaderThemeHost.generation) ReaderThemeHost.publish(current, revision);
    });
    await reconciled?.saved;
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
    const generation = ReaderThemeHost.generation;
    ReaderThemeHost.systemScheme = scheme;
    AppStorage.setOrCreate('readerSystemScheme', scheme);
    await ReaderThemeHost.prepareUserChange();
    if (generation !== ReaderThemeHost.generation) throw new Error('THEME_OWNER_CHANGED');
    const store = ReaderThemeHost.store;
    if (store === undefined) return;
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      changeAppearanceThemeSelection(current, 'system', '', scheme),
      (): boolean => generation === ReaderThemeHost.generation && store === ReaderThemeHost.store && scheme === ReaderThemeHost.systemScheme);
    await commit?.saved;
  }

  static async selectApp(mode: ReaderAppThemeMode, isInputCurrent: () => boolean = (): boolean => true): Promise<void> {
    const commit = await ReaderThemeHost.commitSelection('app', mode, isInputCurrent);
    await commit.saved.catch((error: Error): void => { throw new ReaderAppearanceSaveUnconfirmedError(error); });
  }

  static async selectManga(scheme: ReaderThemeScheme, isInputCurrent: () => boolean): Promise<void> {
    const commit = await ReaderThemeHost.commitSelection('manga', scheme, isInputCurrent);
    await commit.saved.catch((error: Error): void => { throw new ReaderAppearanceSaveUnconfirmedError(error); });
  }

  static selectReader(theme: ReaderThemeId, isInputCurrent: () => boolean): Promise<ReaderAppearanceCommit> {
    return ReaderThemeHost.commitSelection('reader', theme, isInputCurrent);
  }

  static selectReaderDefault(theme: ReaderThemeId, isInputCurrent: () => boolean): Promise<ReaderAppearanceCommit> {
    return ReaderThemeHost.commitSelection('default', theme, isInputCurrent);
  }

  private static async commitSelection(intent: ReaderThemeIntent, value: string,
    isInputCurrent: () => boolean): Promise<ReaderAppearanceCommit> {
    const generation = ReaderThemeHost.generation;
    if (!isInputCurrent()) throw new Error('THEME_OWNER_CHANGED');
    await ReaderThemeHost.prepareUserChange();
    if (generation !== ReaderThemeHost.generation || !isInputCurrent()) throw new Error('THEME_OWNER_CHANGED');
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      intent === 'default' && current.activeTheme !== value ? current :
        changeAppearanceThemeSelection(current, intent, value, ReaderThemeHost.systemScheme),
      (): boolean => generation === ReaderThemeHost.generation && store === ReaderThemeHost.store && isInputCurrent());
    if (commit === undefined) throw new Error('THEME_OWNER_CHANGED');
    return commit;
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
    const generation = ReaderThemeHost.generation;
    const store = ReaderThemeHost.store;
    if (store === undefined) throw new Error('THEME_NOT_READY');
    const restored = restoreReaderThemeSelection(backup, ReaderThemeHost.systemScheme);
    const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      applyAppearanceThemeSelection(current, restored.selection),
      (): boolean => generation === ReaderThemeHost.generation && store === ReaderThemeHost.store);
    if (commit === undefined) throw new Error('THEME_OWNER_CHANGED');
    await commit.saved;
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
