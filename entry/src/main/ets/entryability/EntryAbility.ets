import { UIAbility, Want, AbilityConstant } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerRuntimeNetworkConfig } from '../services/RuntimeNetworkConfig';
import { runAllDomainTests, summarizeResults, TestSuiteResult } from '../__tests__/TestInfra';

const TAG = 'EntryAbility';
const HEADLESS_TEST_FLAG = 'readerHeadlessTest';

interface HeadlessTestSummaryFields {
  passed: number;
  failed: number;
  total: number;
}

interface HeadlessTestSummary {
  schemaVersion: string;
  status: string;
  generatedAt: string;
  summary: HeadlessTestSummaryFields;
  suites: TestSuiteResult[];
}

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    readerRuntimeNetworkConfig.applyLaunchParameters(want.parameters);
    hilog.info(0x0000, TAG, 'Ability onCreate');

    if (want.parameters?.[HEADLESS_TEST_FLAG] === '1') {
      hilog.info(0x0000, TAG, 'HEADLESS_TEST_MODE detected, running validators');
      try {
        const results: TestSuiteResult[] = runAllDomainTests();
        const report: string = summarizeResults(results);
        hilog.info(0x0000, TAG, `HEADLESS_TEST_REPORT ${report.replace(/\n/g, ' | ')}`);

        const totalPassed: number = results.reduce((sum: number, r: TestSuiteResult) => sum + r.passed, 0);
        const totalFailed: number = results.reduce((sum: number, r: TestSuiteResult) => sum + r.failed, 0);
        const totalTests: number = results.reduce((sum: number, r: TestSuiteResult) => sum + r.total, 0);
        const status: string = totalFailed === 0 ? 'PASS' : 'FAIL';

        const summary: HeadlessTestSummary = {
          schemaVersion: 'headless-test.v1',
          status,
          generatedAt: new Date().toISOString(),
          summary: { passed: totalPassed, failed: totalFailed, total: totalTests } as HeadlessTestSummaryFields,
          suites: results
        };
        const json: string = JSON.stringify(summary);
        hilog.info(0x0000, TAG, `HEADLESS_TEST_JSON ${json}`);
        hilog.info(0x0000, TAG, `HEADLESS_TEST_MODE ${status}`);
      } catch (e) {
        const errMsg = (e instanceof Error) ? e.message : String(e);
        hilog.error(0x0000, TAG, `HEADLESS_TEST_MODE error: ${errMsg}`);
      }
      this.context.terminateSelf();
      return;
    }
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    readerRuntimeNetworkConfig.applyLaunchParameters(want.parameters);
    hilog.info(0x0000, TAG, 'Ability onNewWant');
  }

  onDestroy(): void {
    hilog.info(0x0000, TAG, 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(0x0000, TAG, 'Ability onWindowStageCreate');

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(0x0000, TAG, `Failed to load content: ${JSON.stringify(err)}`);
        return;
      }
      hilog.info(0x0000, TAG, 'WindowStage content loaded');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(0x0000, TAG, 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(0x0000, TAG, 'Ability onForeground');
  }

  onBackground(): void {
    hilog.info(0x0000, TAG, 'Ability onBackground');
  }
}
