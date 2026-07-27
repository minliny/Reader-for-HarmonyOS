import { abilityDelegatorRegistry, TestRunner } from '@kit.TestKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { Hypium } from '@ohos/hypium';
import testsuite from '../test/List.test';

const DOMAIN: number = 0x0000;
const TAG: string = 'ReaderOhosTest';

// This is the official Stage-model Hypium runner shape. It is intentionally
// test-only: the production EntryAbility and Reader UI route tree are never
// used as a substitute for a test harness.
export default class OpenHarmonyTestRunner implements TestRunner {
  onPrepare(): void {
    hilog.info(DOMAIN, TAG, '%{public}s', 'onPrepare');
  }

  onRun(): void {
    const delegator = abilityDelegatorRegistry.getAbilityDelegator();
    const delegatorArguments = abilityDelegatorRegistry.getArguments();
    hilog.info(DOMAIN, TAG, '%{public}s', 'running Reader ArkTS suite');
    Hypium.hypiumTest(delegator, delegatorArguments, testsuite);
  }
}
