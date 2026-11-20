import { ReaderCrashEvidence } from '../app/ReaderCrashEvidence';
import { prepareReaderShelfFonts, prepareReaderFontFamily } from '../features/common/ReaderFonts';
import { READER_REDUCE_MOTION_STORAGE_KEY } from '../features/common/ReaderMotionPolicy';
import { readerAppearanceSnapshotFontFamily } from '../features/reading/ReaderAppearanceRenderStyle';
import { setReaderAppearanceFont, type ReaderAppearanceSnapshot } from '../features/reading/ReaderAppearanceState';
import { ReaderCustomFontHost } from '../app/ReaderCustomFontHost';
import { ReaderSettingsGateway } from '../features/reading/ReaderSettingsGateway';
import { SyncGateway } from '../features/sync/SyncGateway';
import { LocalConfigurationReset } from '../features/settings/LocalConfigurationReset';
import { ReaderThemeHost } from '../app/ReaderThemeHost';
import { AbilityConstant, ConfigurationConstant, type Configuration, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { errorMessageOf, localReadFailureSummary } from '../app/ErrorMessage';
import { ReaderStartupContentOwner } from '../app/ReaderStartupContentOwner';
import { installMangaAtomicPayloadReader } from '../app/MangaAtomicPayloadReader';
import { ReaderSystemFileOpenHost } from '../app/ReaderSystemFileOpenHost';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { ReaderEntryDiagnostics } from '../app/ReaderEntryDiagnostics';
import { ReaderStartupTrace, type ReaderStartupSample } from '../app/ReaderStartupTrace';
import { readerMotionNowMs } from '../features/common/ReaderMotionClock';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { WebDavCredentialStore } from '../features/sync/WebDavCredentialStore';
import { READER_TRANSIENT_TOAST_STORAGE_KEY, READER_TRANSIENT_HOST_STORAGE_KEY, createReaderTransientToastState } from '../features/common/ReaderTransientFeedback';
const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  private windowStageGeneration: number = 0;
  private startupContent: ReaderStartupContentOwner | undefined = undefined;
  private coldStartPage: string = 'pages/Index';
  private runtimeOwner: ReaderRuntimeOwner | undefined = undefined;
  private activeWindowStage: window.WindowStage | undefined = undefined;
  private libraryRestoreHandoffDetach: (() => void) | undefined = undefined;
  private libraryRestoreAdoptionPending: ReaderRuntimeOwner | undefined = undefined;
  private libraryRestoreAdoption: Promise<void> | undefined = undefined;
  private themeReady: Promise<void> = Promise.resolve();
  private recoveryReady: Promise<void> = Promise.resolve();
  private bookshelfModeReady: Promise<void> = Promise.resolve();
  private shelfFontsReady: Promise<void> = Promise.resolve();
  private diagnostics: ReaderEntryDiagnostics | undefined = undefined;
  private crashEvidence: ReaderCrashEvidence | undefined = undefined;
  private preparedReadingFontOwner: ReaderRuntimeOwner | undefined = undefined;
  private preparedReadingFontSnapshot: ReaderAppearanceSnapshot | undefined = undefined;

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.crashEvidence = ReaderCrashEvidence.install(DEBUG === true && BUILD_MODE_NAME === 'debug',
      this.context.filesDir, launchParam);
    installMangaAtomicPayloadReader();
    const trace = ReaderStartupTrace.install(readerMotionNowMs, (sample: ReaderStartupSample): void => {
      hilog.info(DOMAIN, 'Reader', 'READER_STARTUP %{public}s', JSON.stringify(sample));
    }, DEBUG === true && BUILD_MODE_NAME === 'debug', want.parameters?.readerTtsTrace === true);
    trace.mark('ability.create');
    this.diagnostics = ReaderEntryDiagnostics.forColdStart(DEBUG, BUILD_MODE_NAME, want, readerMotionNowMs);
    this.coldStartPage = this.diagnostics?.coldStartPage ?? 'pages/Index';
    AppStorage.setOrCreate('readerAppForeground', true);
    AppStorage.setOrCreate(READER_REDUCE_MOTION_STORAGE_KEY, false);
    // The app-owned short-feedback host is mounted by Index. Initialize its
    // state before any startup owner can publish a result.
    AppStorage.setOrCreate(READER_TRANSIENT_TOAST_STORAGE_KEY, createReaderTransientToastState());
    AppStorage.setOrCreate(READER_TRANSIENT_HOST_STORAGE_KEY, 0);
    WebDavCredentialStore.instance.attachContext(this.context);
    const bookshelfModeReady = trace.measure('startup.bookshelf-mode',
      (): Promise<'cover' | 'list'> => WebDavCredentialStore.instance.loadBookshelfViewMode())
      .then((mode): void => {
        if (mode !== null) {
          AppStorage.setOrCreate('readerBookshelfViewMode', mode);
        }
      });
    this.bookshelfModeReady = bookshelfModeReady.catch((): void => {});
    this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts())
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Shelf font preparation failed: %{private}s', error.message);
      });
    const owner = ReaderRuntimeOwner.install(this.context,
      this.diagnostics?.disableOptionalEntryMemory ?? false, this.diagnostics?.offlineScope,
      this.diagnostics?.readingScope, this.diagnostics?.selectionMode);
    this.runtimeOwner = owner;
    this.diagnostics?.bindOwner(owner, (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner));
    const themeReady = trace.measure('startup.theme', (): Promise<void> => ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day'));
    this.themeReady = themeReady.catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Theme restoration failed: %{private}s', error.message);
      });
    const sync = new SyncGateway(owner);
    ReaderThemeHost.setRecoveryBarrier(async (): Promise<void> => {
      await Promise.all([this.themeReady, this.bookshelfModeReady, owner.start()]);
      if (this.runtimeOwner !== owner) throw new Error('CONFIGURATION_OWNER_CHANGED');
      await sync.recoverInterruptedRestore();
      await LocalConfigurationReset.recover(owner);
    });
    const coreReady = trace.measure('startup.core', (): Promise<void> => owner.start());
    this.recoveryReady = Promise.all([this.themeReady, this.bookshelfModeReady, coreReady])
      .then(async (): Promise<void> => {
        if (this.runtimeOwner === owner) {
          await trace.measure('startup.sync-recovery', (): Promise<boolean> => sync.recoverInterruptedRestore());
          await trace.measure('startup.configuration-recovery', (): Promise<boolean> => LocalConfigurationReset.recover(owner));
          if (this.runtimeOwner !== owner) return;
          this.publishConfirmedBookshelfMode(owner);
          // Reader-only fonts can prepare after confirmed recovery without
          // withholding the bookshelf. The reader still checks the native
          // receipt before it admits text layout.
          void trace.measure('startup.selected-font-final',
            (): Promise<void> => this.prepareSelectedReadingFont(owner))
            .catch((error: Error): void => {
              hilog.error(DOMAIN, 'Reader', 'Selected reading font preparation failed: %{private}s', error.message);
            });
          await trace.measure('startup.reading-settings', async (): Promise<void> => {
            await new ReaderSettingsGateway(owner).loadAfterConfigurationRecovery(
              (): boolean => this.runtimeOwner === owner);
          });
        }
      }).catch((error: Error): void => {
        // The persistent receipt/journal remains pending; opening the UI permits retry.
        hilog.error(DOMAIN, 'Reader', 'Core or confirmed restore recovery failed summary=%{public}s detail=%{private}s',
          localReadFailureSummary(error), errorMessageOf(error));
      });
    void this.recoveryReady.then((): void => this.bindLibraryRestoreHandoff(owner)).catch((): void => {});
    // Method-level probes may execute onCreate without private helpers; the
    // production class still owns the concrete scheduler below.
    this.scheduleRebuildableCacheClear?.(want, owner);
    ReaderSystemFileOpenHost.install(owner, this.recoveryReady);
    ReaderSystemFileOpenHost.receive(want);
    this.diagnostics?.afterRecovery(this.recoveryReady, this.context.filesDir,
      (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner));
  }

  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    // Never reload the window or route directly; Index saves the active
    // reading session before presenting a successfully imported file.
    this.scheduleRebuildableCacheClear?.(want, this.runtimeOwner);
    ReaderSystemFileOpenHost.receive(want);
  }

  private scheduleRebuildableCacheClear(want: Want, owner: ReaderRuntimeOwner | undefined): void {
    ReaderEntryDiagnostics.scheduleCacheClear(DEBUG, BUILD_MODE_NAME, want, owner, this.recoveryReady,
      (): boolean => owner !== undefined && this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner));
  }

  private async prepareSelectedReadingFont(owner: ReaderRuntimeOwner, reusePrepared: boolean = false): Promise<void> {
    const store = owner.getAppearanceStore();
    while (this.runtimeOwner === owner) {
      const snapshot = store.current();
      // Ordinary startup already checked this immutable native face. Reuse
      // only that acknowledged owner/choice, never a failed load or a result
      // inferred solely from the absence of a configuration recovery journal.
      if (reusePrepared && this.preparedReadingFontOwner === owner &&
        this.preparedReadingFontSnapshot !== undefined &&
        this.sameSelectedReadingFont(this.preparedReadingFontSnapshot, snapshot)) return;
      this.preparedReadingFontOwner = undefined;
      this.preparedReadingFontSnapshot = undefined;
      await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
      if (this.runtimeOwner !== owner) return;
      if (!this.sameSelectedReadingFont(snapshot, store.current())) continue;
      if (snapshot.font !== 'custom' || snapshot.customFont === undefined) {
        this.preparedReadingFontOwner = owner;
        this.preparedReadingFontSnapshot = snapshot;
        return;
      }
      const registered = await new ReaderCustomFontHost(this.context).registerPersisted(undefined, snapshot.customFont);
      if (this.runtimeOwner !== owner) return;
      if (!this.sameSelectedReadingFont(snapshot, store.current())) continue;
      if (registered) {
        this.preparedReadingFontOwner = owner;
        this.preparedReadingFontSnapshot = snapshot;
        return;
      }
      // Match the reader's existing missing/invalid custom-file recovery. A
      // checked native load error still rejects; it is never called ready.
      const commit = await store.change((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
        setReaderAppearanceFont(current, 'serif'),
        (current: ReaderAppearanceSnapshot): boolean => this.runtimeOwner === owner &&
          this.sameSelectedReadingFont(snapshot, current));
      await commit?.saved;
    }
  }

  private sameSelectedReadingFont(first: ReaderAppearanceSnapshot, second: ReaderAppearanceSnapshot): boolean {
    return first.font === second.font && (first.font !== 'custom' ||
      JSON.stringify(first.customFont) === JSON.stringify(second.customFont));
  }

  /** Only the Ability can replace its Runtime lease and the root page together.
   * The old owner invokes this after its actual Core and physical IO are closed. */
  private bindLibraryRestoreHandoff(owner: ReaderRuntimeOwner): void {
    if (this.runtimeOwner !== owner || !ReaderRuntimeOwner.isCurrent(owner)) return;
    this.libraryRestoreHandoffDetach?.();
    this.libraryRestoreHandoffDetach = owner.registerLibraryRestoreHandoff(
      (): Promise<void> => this.adoptLibraryRestore(owner));
  }

  private adoptLibraryRestore(previous: ReaderRuntimeOwner): Promise<void> {
    if (this.libraryRestoreAdoption !== undefined) return this.libraryRestoreAdoption;
    if (this.runtimeOwner !== previous) return Promise.reject(new Error('LIBRARY_RESTORE_ABILITY_RETIRED'));
    this.libraryRestoreAdoptionPending = previous;
    const stage = this.activeWindowStage;
    if (stage === undefined) return Promise.reject(new Error('LIBRARY_RESTORE_WINDOW_UNAVAILABLE'));
    const task = this.adoptLibraryRestoreInWindow(previous, stage);
    this.libraryRestoreAdoption = task;
    void task.finally((): void => {
      if (this.libraryRestoreAdoption === task) this.libraryRestoreAdoption = undefined;
    }).catch((): void => {});
    return task;
  }

  private async adoptLibraryRestoreInWindow(previous: ReaderRuntimeOwner, stage: window.WindowStage): Promise<void> {
    const generation = this.windowStageGeneration;
    const ownsWindow = (): boolean => this.runtimeOwner === previous && this.activeWindowStage === stage &&
      generation === this.windowStageGeneration;
    if (!ownsWindow()) throw new Error('LIBRARY_RESTORE_ABILITY_RETIRED');
    this.startupContent?.close(); this.startupContent = undefined;
    this.diagnostics?.stop('library-restore');
    ReaderSystemFileOpenHost.detach(previous);
    ReaderThemeHost.detach();
    await previous.release();
    if (!ownsWindow()) throw new Error('LIBRARY_RESTORE_ABILITY_RETIRED');
    let installed: ReaderRuntimeOwner | undefined = undefined;
    try { installed = ReaderRuntimeOwner.current(); } catch (_) {}
    // Another Ability may have installed a successor during the asynchronous
    // close. This Ability must not adopt that unrelated activation or lease.
    if (installed !== undefined) throw new Error('LIBRARY_RESTORE_RUNTIME_OWNER_CHANGED');
    const owner = ReaderRuntimeOwner.install(this.context);
    this.runtimeOwner = owner;
    this.libraryRestoreAdoptionPending = undefined;
    this.preparedReadingFontOwner = undefined; this.preparedReadingFontSnapshot = undefined;
    this.coldStartPage = 'pages/Index';
    const current = (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner);
    this.themeReady = ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day');
    const sync = new SyncGateway(owner);
    const bookshelfModeReady = WebDavCredentialStore.instance.loadBookshelfViewMode().then((): void => {});
    this.bookshelfModeReady = bookshelfModeReady;
    const coreReady = owner.start();
    ReaderThemeHost.setRecoveryBarrier(async (): Promise<void> => {
      await Promise.all([this.themeReady, this.bookshelfModeReady, coreReady]);
      if (!current()) throw new Error('CONFIGURATION_OWNER_CHANGED');
      await sync.recoverInterruptedRestore();
      await LocalConfigurationReset.recover(owner);
    });
    // This barrier intentionally retains rejection: a failed durable recovery
    // must reach the existing startup recovery surface, never mount an Index.
    this.recoveryReady = Promise.all([this.themeReady, this.bookshelfModeReady, coreReady]).then(async (): Promise<void> => {
      if (!current()) throw new Error('LIBRARY_RESTORE_ABILITY_RETIRED');
      await sync.recoverInterruptedRestore();
      await LocalConfigurationReset.recover(owner);
      if (!current()) throw new Error('LIBRARY_RESTORE_ABILITY_RETIRED');
      this.publishConfirmedBookshelfMode(owner);
      await new ReaderSettingsGateway(owner).loadAfterConfigurationRecovery(current);
      if (!current()) throw new Error('LIBRARY_RESTORE_ABILITY_RETIRED');
      void this.prepareSelectedReadingFont(owner).catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Restored reading font preparation failed: %{private}s', error.message);
      });
      this.bindLibraryRestoreHandoff(owner);
    });
    ReaderSystemFileOpenHost.install(owner, this.recoveryReady);
    this.onWindowStageCreate(stage);
    const content = this.startupContent;
    if (content === undefined) throw new Error('LIBRARY_RESTORE_WINDOW_UNAVAILABLE');
    await this.waitForRestoredContent(content, owner);
  }

  /** Core/system restore may change the mode after the early preference read.
   * Publish only the original owner's acknowledged result before Index mounts. */
  private publishConfirmedBookshelfMode(owner: ReaderRuntimeOwner): void {
    if (this.runtimeOwner !== owner || !ReaderRuntimeOwner.isCurrent(owner)) return;
    const mode = WebDavCredentialStore.instance.currentBookshelfViewMode();
    if (mode !== undefined) AppStorage.setOrCreate('readerBookshelfViewMode', mode);
  }

  private waitForRestoredContent(content: ReaderStartupContentOwner, owner: ReaderRuntimeOwner): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      let settled = false;
      let detach: () => void = (): void => {};
      detach = content.subscribe((state): void => {
        if (settled) return;
        const retired = this.startupContent !== content || this.runtimeOwner !== owner;
        if (state.phase === 'ready' && !retired) { settled = true; detach(); resolve(); }
        else if (retired || state.phase === 'recovery' || state.phase === 'platform-unavailable' || state.phase === 'retired') {
          settled = true; detach(); reject(new Error('LIBRARY_RESTORE_CONTENT_NOT_READY'));
        }
      });
      if (settled) detach();
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    this.activeWindowStage = windowStage;
    const pending = this.libraryRestoreAdoptionPending;
    if (pending !== undefined && this.runtimeOwner === pending) {
      void this.adoptLibraryRestore(pending).catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Library restore Ability adoption failed: %{private}s', error.message);
      });
      return;
    }
    ReaderStartupTrace.current()?.mark('window.create');
    const generation = ++this.windowStageGeneration;
    this.startupContent?.close();
    let windowReady: Promise<boolean>;
    try {
      const win = windowStage.getMainWindowSync();
      windowReady = ReaderStartupTrace.measure('startup.window', (): Promise<boolean> => ReaderWindowCoordinator.install(win, this.context.config))
        .catch((error: Error): boolean => {
          hilog.error(DOMAIN, 'Reader', 'Window metrics setup failed: %{private}s', error.message);
          return false;
        });
    } catch (error) {
      hilog.error(DOMAIN, 'Reader', 'Main window access failed: %{private}s', (error as Error).message);
      windowReady = Promise.resolve(false);
    }
    // Window metrics can fall back to their existing zero-inset snapshot.
    // A bounded admission failure is displayed outside the not-yet-mounted Index.
    const admission = Promise.all([windowReady, this.recoveryReady, this.shelfFontsReady]).then((): void => {});
    this.startupContent = new ReaderStartupContentOwner(admission, {
      loadMain: (done: (code: number) => void): void => this.loadMainContent(windowStage, done),
      loadRecovery: (done: (code: number) => void): void => {
        windowStage.loadContent('pages/ReaderStartupRecovery', (error): void => done(error.code));
      },
      ready: (): void => { if (generation === this.windowStageGeneration) {
        this.diagnostics?.start();
      } },
      unavailable: (): void => {
        hilog.error(DOMAIN, 'Reader', 'Startup recovery content could not be mounted; platform recovery remains unavailable');
      },
      exit: (): Promise<void> => this.context.terminateSelf(),
      observerFailed: (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Startup projection failed: %{private}s', error.message),
    });
    this.startupContent.start();
  }

  onWindowStageDestroy(): void {
    this.activeWindowStage = undefined;
    this.diagnostics?.stop('window-destroyed');
    this.startupContent?.close();
    this.startupContent = undefined;
    this.windowStageGeneration += 1;
    ReaderWindowCoordinator.detach();
  }

  onConfigurationUpdate(newConfig: Configuration): void {
    if (newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ||
        newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT) {
      void ReaderThemeHost.systemChanged(newConfig.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day')
        .catch((error: Error): void => hilog.error(DOMAIN, 'Reader', 'System theme write failed: %{private}s', error.message));
    }
    // Font configuration can change without Display density/window callbacks.
    // Only this live stage may publish it; retired windows cannot affect a successor.
    const stage = this.activeWindowStage;
    if (stage !== undefined) {
      try { ReaderWindowCoordinator.refreshConfiguration(newConfig, stage.getMainWindowSync()); } catch (_error) {}
    }
  }

  onForeground(): void {
    AppStorage.setOrCreate('readerAppForeground', true);
    this.runtimeOwner?.setReadingPreparationContext(true, false);
    ReaderWindowCoordinator.reapplyChrome();
    ReaderWindowCoordinator.reapplyWindowPolicy();
  }

  onBackground(): void {
    AppStorage.setOrCreate('readerAppForeground', false);
    this.runtimeOwner?.setReadingPreparationContext(false, false);
    this.runtimeOwner?.releaseMangaOfflineProbe();
    this.diagnostics?.stop('background');
    this.runtimeOwner?.flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{private}s', error.message);
    });
  }

  onMemoryLevel(_level: AbilityConstant.MemoryLevel): void {
    this.runtimeOwner?.releaseOptionalReadingEntryMemory();
  }

  onDestroy(): void {
    this.crashEvidence?.stop(); this.crashEvidence = undefined;
    this.diagnostics?.close(); this.diagnostics = undefined;
    this.startupContent?.close();
    this.startupContent = undefined;
    this.activeWindowStage = undefined;
    this.libraryRestoreAdoptionPending = undefined;
    this.libraryRestoreHandoffDetach?.(); this.libraryRestoreHandoffDetach = undefined;
    ReaderThemeHost.detach();
    this.windowStageGeneration += 1;
    ReaderWindowCoordinator.detach();
    AppStorage.setOrCreate('readerAppForeground', false);
    const owner = this.runtimeOwner;
    ReaderSystemFileOpenHost.detach(owner);
    this.runtimeOwner = undefined;
    owner?.release().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{private}s', error.message);
    });
  }

  private loadMainContent(windowStage: window.WindowStage, done?: (code: number) => void): void {
    const generation = this.windowStageGeneration;
    const trace = ReaderStartupTrace.current();
    const startedAt = trace?.begin('startup.load-content') ?? -1;
    trace?.mark('startup.admission-settled');
    const page = this.coldStartPage;
    // A debug fault is one real dispatch, never a synthetic error callback.
    // Consume before calling the platform so both callback failure and a
    // synchronous dispatch throw retry the actual Index on the next request.
    if (page === 'pages/__ReaderStartupMainLoadFailure') {
      this.coldStartPage = 'pages/Index';
      trace?.mark('startup.main-load-fault-request');
    }
    windowStage.loadContent(page, (error): void => {
      if (generation !== this.windowStageGeneration) return;
      // This is a platform callback, never evidence of a displayed shelf frame.
      trace?.end('startup.load-content', startedAt, error.code ? 'failed' : 'callback');
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{private}s', JSON.stringify(error));
      } else if (done === undefined) {
        this.diagnostics?.startEventLoop();
      }
      done?.(error.code);
    });
  }
}
