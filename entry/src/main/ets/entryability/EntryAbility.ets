import { prepareReaderShelfFonts, prepareReaderFontFamily } from '../features/common/ReaderFonts';
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
import { ReaderStartupContentOwner } from '../app/ReaderStartupContentOwner';
import { installMangaAtomicPayloadReader } from '../app/MangaAtomicPayloadReader';
import { ReaderSystemFileOpenHost } from '../app/ReaderSystemFileOpenHost';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory, readerMangaOfflineProbeScope, readerMangaReadingProbeScope, readerMangaProbeSelectionMode } from '../app/ReaderControlVerificationLaunch';
import { ReaderEventLoopProbe, ReaderEventLoopSample, readerEventLoopProbeEnabled } from '../app/ReaderEventLoopProbe';
import { probeReaderAtomicSnapshot, type ReaderAtomicSnapshotSample } from '../app/ReaderAtomicSnapshotProbe';
import { probeReaderAssetInventory, type ReaderAssetInventorySample } from '../app/ReaderAssetInventoryProbe';
import { ReaderMangaPlatformDiagnostic } from '../app/ReaderMangaPlatformDiagnostic';
import { ReaderStartupTrace, type ReaderStartupSample } from '../app/ReaderStartupTrace';
import { ReaderCapacityProbe, type ReaderCapacityQueryOptions } from '../app/ReaderCapacityProbe';
import type { JsonObject } from '@reader/core-harmony';
import { readerMotionNowMs } from '../features/common/ReaderMotionClock';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { WebDavCredentialStore } from '../features/sync/WebDavCredentialStore';
const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  private windowStageGeneration: number = 0;
  private startupContent: ReaderStartupContentOwner | undefined = undefined;
  private coldStartPage: string = 'pages/Index';
  private runtimeOwner: ReaderRuntimeOwner | undefined = undefined;
  private themeReady: Promise<void> = Promise.resolve();
  private recoveryReady: Promise<void> = Promise.resolve();
  private bookshelfModeReady: Promise<void> = Promise.resolve();
  private shelfFontsReady: Promise<void> = Promise.resolve();
  private eventLoopProbe: ReaderEventLoopProbe | undefined = undefined;
  private capacityProbe: ReaderCapacityProbe | undefined = undefined;
  private mangaPlatformDiagnostic: ReaderMangaPlatformDiagnostic | undefined = undefined;
  private preparedReadingFontOwner: ReaderRuntimeOwner | undefined = undefined;
  private preparedReadingFontSnapshot: ReaderAppearanceSnapshot | undefined = undefined;

  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    installMangaAtomicPayloadReader();
    const trace = ReaderStartupTrace.install(readerMotionNowMs, (sample: ReaderStartupSample): void => {
      hilog.info(DOMAIN, 'Reader', 'READER_STARTUP %{public}s', JSON.stringify(sample));
    }, DEBUG === true && BUILD_MODE_NAME === 'debug', want.parameters?.readerTtsTrace === true);
    trace.mark('ability.create');
    // Diagnostics require a cold start, debug build, and exact primitive
    // boolean parameters. Warm file Wants use the guarded import/exit queue.
    this.coldStartPage = readerControlVerificationColdStartPage(
      DEBUG,
      BUILD_MODE_NAME,
      want.parameters?.readerControlMotionVerification,
      want.parameters?.readerOpenSourcePilot,
      want.parameters?.readerStartupMainLoadFailure,
    );
    if (readerEventLoopProbeEnabled(DEBUG, BUILD_MODE_NAME, want.parameters?.readerEventLoopProbe)) {
      this.eventLoopProbe = new ReaderEventLoopProbe(readerMotionNowMs,
        (sample: ReaderEventLoopSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_EVENT_LOOP %{public}s', JSON.stringify(sample));
        });
    }
    AppStorage.setOrCreate('readerAppForeground', true);
    WebDavCredentialStore.instance.attachContext(this.context);
    this.bookshelfModeReady = trace.measure('startup.bookshelf-mode',
      (): Promise<'cover' | 'list'> => WebDavCredentialStore.instance.loadBookshelfViewMode())
      .then((mode): void => {
        if (mode !== null) {
          AppStorage.setOrCreate('readerBookshelfViewMode', mode);
        }
      }).catch((): void => {});
    this.shelfFontsReady = trace.measure('startup.shelf-fonts', (): Promise<void> => prepareReaderShelfFonts())
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Shelf font preparation failed: %{private}s', error.message);
      });
    // Selection diagnostics have no inferred identity. Conflicting diagnostic
    // flags reject both selection modes; exact Want scope semantics stay intact.
    const mangaSelectFlag = want.parameters?.readerMangaOfflineProbeSelectManga === true ||
      want.parameters?.readerMangaReadingProbeSelectManga === true;
    const mangaSelectionMode = this.coldStartPage === 'pages/Index' ? readerMangaProbeSelectionMode(DEBUG, BUILD_MODE_NAME,
      want.parameters?.readerMangaOfflineProbeSelectManga, want.parameters?.readerMangaReadingProbeSelectManga,
      [want.parameters?.readerMangaOfflineProbe, want.parameters?.readerMangaReadingProbe,
        want.parameters?.readerControlMotionVerification, want.parameters?.readerOpenSourcePilot,
        want.parameters?.readerEventLoopProbe, want.parameters?.readerDisableOptionalEntryMemory]) : undefined;
    this.mangaPlatformDiagnostic = ReaderMangaPlatformDiagnostic.install(mangaSelectionMode,
      want.parameters?.readerMangaRecordedJankR31 === true);
    const owner = ReaderRuntimeOwner.install(this.context,
      readerDisableOptionalEntryMemory(DEBUG, BUILD_MODE_NAME, want.parameters?.readerDisableOptionalEntryMemory),
      this.coldStartPage === 'pages/Index' ? readerMangaOfflineProbeScope(DEBUG, BUILD_MODE_NAME,
        want.parameters?.readerMangaOfflineProbe, want.parameters?.readerMangaOfflineSourceId,
        want.parameters?.readerMangaOfflineBookId, mangaSelectFlag ? true : want.parameters?.readerMangaReadingProbe) : undefined,
      this.coldStartPage === 'pages/Index' ? readerMangaReadingProbeScope(DEBUG, BUILD_MODE_NAME,
        want.parameters?.readerMangaReadingProbe, want.parameters?.readerMangaOfflineSourceId,
        want.parameters?.readerMangaOfflineBookId, mangaSelectFlag ? true : want.parameters?.readerMangaOfflineProbe) : undefined,
      mangaSelectionMode);
    this.runtimeOwner = owner;
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && want.parameters?.readerCapacityTrace === true) {
      this.capacityProbe = ReaderCapacityProbe.create(DEBUG, BUILD_MODE_NAME, want.parameters?.readerCapacityTrace,
        async (method: string, params: JsonObject, options: ReaderCapacityQueryOptions): Promise<JsonObject> => (await owner.request(method, params, options)).data,
        (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner));
    }
    this.themeReady = trace.measure('startup.theme', (): Promise<void> => ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day'))
      .catch((error: Error): void => {
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
        hilog.error(DOMAIN, 'Reader', 'Core or confirmed restore recovery failed: %{private}s', error.message);
      });
    ReaderSystemFileOpenHost.install(owner, this.recoveryReady);
    ReaderSystemFileOpenHost.receive(want);
    // This diagnostic is an explicit cold debug Want only. Normal starts and
    // warm external files perform no synthetic filesystem work.
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && want.parameters?.readerAtomicSnapshotProbe === true) {
      void this.recoveryReady.then((): Promise<void> => probeReaderAtomicSnapshot(DEBUG, BUILD_MODE_NAME,
        true, this.context.filesDir, (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner),
        readerMotionNowMs, (sample: ReaderAtomicSnapshotSample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ATOMIC_SNAPSHOT %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
    if (DEBUG === true && BUILD_MODE_NAME === 'debug' && want.parameters?.readerAssetInventoryProbe === true) {
      void this.recoveryReady.then((): Promise<void> => probeReaderAssetInventory(DEBUG, BUILD_MODE_NAME,
        true, (): boolean => this.runtimeOwner === owner && ReaderRuntimeOwner.isCurrent(owner), readerMotionNowMs,
        (sample: ReaderAssetInventorySample): void => {
          hilog.info(DOMAIN, 'Reader', 'READER_ASSET_INVENTORY %{public}s', JSON.stringify(sample));
        })).catch((): void => {});
    }
  }

  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    // Never reload the window or route directly; Index saves the active
    // reading session before presenting a successfully imported file.
    ReaderSystemFileOpenHost.receive(want);
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

  onWindowStageCreate(windowStage: window.WindowStage): void {
    ReaderStartupTrace.current()?.mark('window.create');
    const generation = ++this.windowStageGeneration;
    this.startupContent?.close();
    let windowReady: Promise<boolean>;
    try {
      const win = windowStage.getMainWindowSync();
      windowReady = ReaderStartupTrace.measure('startup.window', (): Promise<boolean> => ReaderWindowCoordinator.install(win))
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
        this.eventLoopProbe?.start();
        this.capacityProbe?.start();
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
    this.eventLoopProbe?.stop('window-destroyed');
    this.capacityProbe?.stop();
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
    // scaledDensity can change without a window-size callback. Refreshing the
    // shared snapshot advances its revision, so the reading pagination
    // signature is recomputed before the next visible page is admitted.
    ReaderWindowCoordinator.refreshConfiguration();
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
    this.eventLoopProbe?.stop('background');
    this.capacityProbe?.stop();
    this.runtimeOwner?.flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{private}s', error.message);
    });
  }

  onMemoryLevel(_level: AbilityConstant.MemoryLevel): void {
    this.runtimeOwner?.releaseOptionalReadingEntryMemory();
  }

  onDestroy(): void {
    this.mangaPlatformDiagnostic?.stop(); this.mangaPlatformDiagnostic = undefined;
    this.eventLoopProbe?.stop('destroyed');
    this.capacityProbe?.stop();
    this.startupContent?.close();
    this.startupContent = undefined;
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
        this.eventLoopProbe?.start();
      }
      done?.(error.code);
    });
  }
}
