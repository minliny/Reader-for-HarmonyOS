import { prepareReaderFonts, prepareReaderFontFamily } from '../features/common/ReaderFonts';
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
import { ReaderSystemFileOpenHost } from '../app/ReaderSystemFileOpenHost';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerControlVerificationColdStartPage, readerDisableOptionalEntryMemory } from '../app/ReaderControlVerificationLaunch';
import { ReaderEventLoopProbe, ReaderEventLoopSample, readerEventLoopProbeEnabled } from '../app/ReaderEventLoopProbe';
import { ReaderStartupTrace, type ReaderStartupSample } from '../app/ReaderStartupTrace';
import { readerMotionNowMs } from '../features/common/ReaderMotionClock';
import { DEBUG, BUILD_MODE_NAME } from '../../../../build/default/generated/profile/default/BuildProfile';
import { WebDavCredentialStore } from '../features/sync/WebDavCredentialStore';
const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  private windowStageGeneration: number = 0;
  private coldStartPage: string = 'pages/Index';
  private runtimeOwner: ReaderRuntimeOwner | undefined = undefined;
  private themeReady: Promise<void> = Promise.resolve();
  private recoveryReady: Promise<void> = Promise.resolve();
  private bookshelfModeReady: Promise<void> = Promise.resolve();
  private eventLoopProbe: ReaderEventLoopProbe | undefined = undefined;
  private preparedReadingFontOwner: ReaderRuntimeOwner | undefined = undefined;
  private preparedReadingFontSnapshot: ReaderAppearanceSnapshot | undefined = undefined;

  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    const trace = ReaderStartupTrace.install(readerMotionNowMs, (sample: ReaderStartupSample): void => {
      hilog.info(DOMAIN, 'Reader', 'READER_STARTUP %{public}s', JSON.stringify(sample));
    }, DEBUG === true && BUILD_MODE_NAME === 'debug');
    trace.mark('ability.create');
    // Diagnostics require a cold start, debug build, and exact primitive
    // boolean parameters. Warm file Wants use the guarded import/exit queue.
    this.coldStartPage = readerControlVerificationColdStartPage(
      DEBUG,
      BUILD_MODE_NAME,
      want.parameters?.readerControlMotionVerification,
      want.parameters?.readerOpenSourcePilot,
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
    const fontsReady = trace.measure('startup.ui-fonts', (): Promise<void> => prepareReaderFonts());
    void fontsReady.catch((): void => {});
    const owner = ReaderRuntimeOwner.install(this.context,
      readerDisableOptionalEntryMemory(DEBUG, BUILD_MODE_NAME, want.parameters?.readerDisableOptionalEntryMemory));
    this.runtimeOwner = owner;
    this.themeReady = trace.measure('startup.theme', (): Promise<void> => ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day'))
      .then(async (): Promise<void> => {
        if (this.runtimeOwner !== owner) return;
        await Promise.all([fontsReady, trace.measure('startup.selected-font-initial',
          (): Promise<void> => this.prepareSelectedReadingFont(owner))]);
      })
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
          const syncRecovered = await trace.measure('startup.sync-recovery', (): Promise<boolean> => sync.recoverInterruptedRestore());
          const configurationRecovered = await trace.measure('startup.configuration-recovery', (): Promise<boolean> => LocalConfigurationReset.recover(owner));
          if (this.runtimeOwner !== owner) return;
          // Recovery can select a different face from the ordinary startup
          // snapshot. Admit that face and the small reading-settings snapshot
          // before Index, without re-entering the recovery barrier.
          await Promise.all([
            trace.measure('startup.selected-font-final', (): Promise<void> => this.prepareSelectedReadingFont(owner,
              syncRecovered === false && configurationRecovered === false)),
            trace.measure('startup.reading-settings', async (): Promise<void> => {
              await new ReaderSettingsGateway(owner).loadAfterConfigurationRecovery(
                (): boolean => this.runtimeOwner === owner);
            }),
          ]);
        }
      }).catch((error: Error): void => {
        // The persistent receipt/journal remains pending; opening the UI permits retry.
        hilog.error(DOMAIN, 'Reader', 'Core or confirmed restore recovery failed: %{private}s', error.message);
      });
    ReaderSystemFileOpenHost.install(owner, this.recoveryReady);
    ReaderSystemFileOpenHost.receive(want);
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
    const win = windowStage.getMainWindowSync();
    void ReaderStartupTrace.measure('startup.window', (): Promise<boolean> => ReaderWindowCoordinator.install(win))
      .then((installed: boolean): void => {
      if (installed && generation === this.windowStageGeneration) {
        void Promise.all([this.bookshelfModeReady, this.themeReady, this.recoveryReady]).then((): void => {
          if (generation === this.windowStageGeneration) this.loadMainContent(windowStage);
        });
      }
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Window metrics setup failed: %{private}s', error.message);
      // Window setup failure must not strand the application before its first
      // page. The default zero-inset snapshot keeps the UI recoverable.
      if (generation === this.windowStageGeneration) {
        void Promise.all([this.bookshelfModeReady, this.themeReady, this.recoveryReady]).then((): void => {
          if (generation === this.windowStageGeneration) this.loadMainContent(windowStage);
        });
      }
    });
  }

  onWindowStageDestroy(): void {
    this.eventLoopProbe?.stop('window-destroyed');
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
    this.eventLoopProbe?.stop('background');
    this.runtimeOwner?.flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{private}s', error.message);
    });
  }

  onMemoryLevel(_level: AbilityConstant.MemoryLevel): void {
    this.runtimeOwner?.releaseOptionalReadingEntryMemory();
  }

  onDestroy(): void {
    this.eventLoopProbe?.stop('destroyed');
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

  private loadMainContent(windowStage: window.WindowStage): void {
    const trace = ReaderStartupTrace.current();
    const startedAt = trace?.begin('startup.load-content') ?? -1;
    trace?.mark('startup.admission-settled');
    windowStage.loadContent(this.coldStartPage, (error): void => {
      // This is a platform callback, never evidence of a displayed shelf frame.
      trace?.end('startup.load-content', startedAt, error.code ? 'failed' : 'callback');
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{private}s', JSON.stringify(error));
      } else {
        this.eventLoopProbe?.start();
      }
    });
  }
}
