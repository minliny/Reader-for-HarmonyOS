import { AbilityConstant, type Configuration, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';

const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    AppStorage.setOrCreate('readerAppForeground', true);
    const owner = ReaderRuntimeOwner.install(this.context);
    owner.start().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core startup failed: %{public}s', error.message);
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const win = windowStage.getMainWindowSync();
    void ReaderWindowCoordinator.install(win).then((): void => {
      this.loadMainContent(windowStage);
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Window metrics setup failed: %{public}s', error.message);
      // Window setup failure must not strand the application before its first
      // page. The default zero-inset snapshot keeps the UI recoverable.
      this.loadMainContent(windowStage);
    });
  }

  onWindowStageDestroy(): void {
    ReaderWindowCoordinator.detach();
  }

  onConfigurationUpdate(_newConfig: Configuration): void {
    // scaledDensity can change without a window-size callback. Refreshing the
    // shared snapshot advances its revision, so the reading pagination
    // signature is recomputed before the next visible page is admitted.
    ReaderWindowCoordinator.refreshConfiguration();
  }

  onForeground(): void {
    AppStorage.setOrCreate('readerAppForeground', true);
    ReaderWindowCoordinator.reapplyChrome();
  }

  onBackground(): void {
    AppStorage.setOrCreate('readerAppForeground', false);
    ReaderRuntimeOwner.current().flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{public}s', error.message);
    });
  }

  onDestroy(): void {
    AppStorage.setOrCreate('readerAppForeground', false);
    ReaderRuntimeOwner.current().close().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{public}s', error.message);
    });
  }

  private loadMainContent(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error): void => {
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{public}s', JSON.stringify(error));
      }
    });
  }
}
