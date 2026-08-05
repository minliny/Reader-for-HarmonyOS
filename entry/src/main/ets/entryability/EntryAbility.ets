import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';

const DOMAIN = 0x5244;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    const owner = ReaderRuntimeOwner.install(this.context);
    owner.start().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core startup failed: %{public}s', error.message);
    });
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error): void => {
      if (error.code) {
        hilog.error(DOMAIN, 'Reader', 'Failed to load main page: %{public}s', JSON.stringify(error));
      }
    });
  }

  onBackground(): void {
    ReaderRuntimeOwner.current().flush().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core storage flush failed: %{public}s', error.message);
    });
  }

  onDestroy(): void {
    ReaderRuntimeOwner.current().close().catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Core close failed: %{public}s', error.message);
    });
  }
}
