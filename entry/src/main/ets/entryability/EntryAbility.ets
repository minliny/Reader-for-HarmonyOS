import { SyncGateway } from '../features/sync/SyncGateway';
import { LocalConfigurationReset } from '../features/settings/LocalConfigurationReset';
import { ReaderThemeHost } from '../app/ReaderThemeHost';
import { AbilityConstant, ConfigurationConstant, type Configuration, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerControlVerificationColdStartPage } from '../app/ReaderControlVerificationLaunch';
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

  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    // Deliberately no onNewWant route switching: a warm request must not bypass
    // or reset the current reading session. Diagnostics require a cold start,
    // debug build, and exact primitive boolean parameters.
    this.coldStartPage = readerControlVerificationColdStartPage(
      DEBUG,
      BUILD_MODE_NAME,
      want.parameters?.readerControlMotionVerification,
      want.parameters?.readerOpenSourcePilot,
    );
    AppStorage.setOrCreate('readerAppForeground', true);
    WebDavCredentialStore.instance.attachContext(this.context);
    this.bookshelfModeReady = WebDavCredentialStore.instance.loadBookshelfViewMode()
      .then((mode): void => {
        if (mode !== null) {
          AppStorage.setOrCreate('readerBookshelfViewMode', mode);
        }
      }).catch((): void => {});
    const owner = ReaderRuntimeOwner.install(this.context);
    this.runtimeOwner = owner;
    this.themeReady = ReaderThemeHost.install(owner,
      this.context.config.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK ? 'night' : 'day')
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
    this.recoveryReady = Promise.all([this.themeReady, this.bookshelfModeReady, owner.start()])
      .then(async (): Promise<void> => {
        if (this.runtimeOwner === owner) {
          await sync.recoverInterruptedRestore();
          await LocalConfigurationReset.recover(owner);
        }
      }).catch((error: Error): void => {
        // The persistent receipt/journal remains pending; opening the UI permits retry.
        hilog.error(DOMAIN, 'Reader', 'Core or confirmed restore recovery failed: %{private}s', error.message);
      });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const generation = ++this.windowStageGeneration;
    const win = windowStage.getMainWindowSync();
    void ReaderWindowCoordinator.install(win).then((installed: boolean): void => {
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
    ReaderWindowCoordinator.reapplyChrome();
    ReaderWindowCoordinator.reapplyWindowPolicy();
  }

  onBackground(): void {
    AppStorage.setOrCreate('readerAppForeground', false);
    this.runtimeOwner?.flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{private}s', error.message);
    });
  }

  onDestroy(): void {
    ReaderThemeHost.detach();
    this.windowStageGeneration += 1;
    ReaderWindowCoordinator.detach();
    AppStorage.setOrCreate('readerAppForeground', false);
    const owner = this.runtimeOwner;
    this.runtimeOwner = undefined;
    owner?.release().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{private}s', error.message);
    });
  }

  private loadMainContent(windowStage: window.WindowStage): void {
    windowStage.loadContent(this.coldStartPage, (error): void => {
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{private}s', JSON.stringify(error));
      }
    });
  }
}
