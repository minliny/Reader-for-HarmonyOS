import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

const DOMAIN: number = 0x0000;
const TAG: string = 'PageTurnTestsMain';

// Minimal default-target ability. The default target exists only so this module
// is a valid HAP; the real suites run from the ohosTest target's TestAbility via
// @kit.TestKit. This ability loads a blank page and is never the test surface.
export default class MainAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'onCreate');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'onWindowStageCreate');
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'loadContent failed %{public}s', JSON.stringify(err));
      }
    });
  }
}
