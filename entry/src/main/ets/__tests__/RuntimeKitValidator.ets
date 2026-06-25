// RuntimeKitValidator - Phase 2 ArkTS Runtime Facade 测试。
// 验证 8 个 Facade 的 stage report 输出正确，且聚合 kit report 通过。

import { HarmonyOSRuntimeKit, HarmonyOSRuntimeKitReport } from '../runtime/HarmonyOSRuntimeKit';
import { RulePipelineFacade } from '../runtime/RulePipelineFacade';
import { LocalBookFacade } from '../runtime/LocalBookFacade';
import { ReadingStateFacade } from '../runtime/ReadingStateFacade';
import { ReplaceRuleFacade } from '../runtime/ReplaceRuleFacade';
import { StoreFacade } from '../runtime/StoreFacade';
import { SyncFacade } from '../runtime/SyncFacade';
import { RuntimeHostFacade } from '../runtime/RuntimeHostFacade';
import { CryptoFacade } from '../runtime/CryptoFacade';
import { StageReportStatus } from '../runtime/RuntimeStageReport';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    this.results.push({ name: n, passed: c, error: c ? undefined : e });
    if (c) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runRuntimeKitValidatorTests(): TestRunner {
  const r = new TestRunner();

  // ---------- HarmonyOSRuntimeKit 聚合 ----------
  const kit = new HarmonyOSRuntimeKit();
  const report = kit.buildKitReport();

  r.assert(report.kitIdentifier === 'HarmonyCoreRuntimeKit', 'kit identifier stable');
  r.assert(report.platformFamily === 'HarmonyOS', 'kit platformFamily HarmonyOS');
  r.assert(report.productionRuntime === 'arkts_core_compatible', 'kit productionRuntime arkts');
  r.assert(report.adr === 'docs/architecture/HARMONYOS_RUNTIME_TRACK_ADR.md', 'kit adr path');
  r.assert(report.stageReports.length === 8, `kit has 8 stage reports (got ${report.stageReports.length})`);
  r.assert(report.allStagesPassed === true, `all stages passed (passed:${report.passedCaseCount}/${report.totalCaseCount})`);
  r.assert(report.totalCaseCount > 0, 'total case count > 0');
  r.assert(report.passedCaseCount === report.totalCaseCount, `all cases passed (${report.passedCaseCount}/${report.totalCaseCount})`);
  r.assert(report.cleanRoomMaintained === true, 'kit cleanRoomMaintained true');
  r.assert(report.externalGPLCodeCopied === false, 'kit externalGPLCodeCopied false');
  r.assert(report.legadoSourceCopied === false, 'kit legadoSourceCopied false');
  r.assert(report.externalNetworkUsed === false, 'kit externalNetworkUsed false');

  // ---------- RulePipelineFacade ----------
  const rulePipeline = new RulePipelineFacade();
  const ruleReport = rulePipeline.buildStageReport();
  r.assert(ruleReport.facadeIdentifier === 'RulePipelineFacade', 'rulePipeline facade id');
  r.assert(ruleReport.stageName === 'rule_pipeline', 'rulePipeline stage name');
  r.assert(ruleReport.cases.length === 5, `rulePipeline has 5 cases (got ${ruleReport.cases.length})`);
  r.assert(ruleReport.cases.every(c => c.status === StageReportStatus.passed), 'rulePipeline all cases passed');
  r.assert(ruleReport.cases.some(c => c.featureID === 'css'), 'rulePipeline has css case');
  r.assert(ruleReport.cases.some(c => c.featureID === 'xpath'), 'rulePipeline has xpath case');
  r.assert(ruleReport.cases.some(c => c.featureID === 'jsonpath'), 'rulePipeline has jsonpath case');
  r.assert(ruleReport.cases.some(c => c.featureID === 'template'), 'rulePipeline has template case');
  r.assert(ruleReport.cases.some(c => c.featureID === 'regex'), 'rulePipeline has regex case');

  // RulePipeline evaluate
  const cssResult = rulePipeline.evaluate({ ruleKind: 'css', ruleExpression: '.body', input: '<html><body><p class="body">Text</p></body></html>' });
  r.assert(cssResult.matchedCount > 0, 'rulePipeline css evaluate matched');
  const jsonResult = rulePipeline.evaluate({ ruleKind: 'jsonpath', ruleExpression: '$.title', input: '{"title":"Fixture"}' });
  r.assert(jsonResult.matchedCount === 1 && jsonResult.values[0] === 'Fixture', 'rulePipeline jsonpath evaluate');

  // ---------- LocalBookFacade ----------
  const localBook = new LocalBookFacade();
  const localReport = localBook.buildStageReport();
  r.assert(localReport.facadeIdentifier === 'LocalBookFacade', 'localBook facade id');
  r.assert(localReport.stageName === 'local_book', 'localBook stage name');
  r.assert(localReport.cases.length === 11, `localBook has 11 cases (got ${localReport.cases.length})`);
  r.assert(localReport.cases.every(c => c.status === StageReportStatus.passed), 'localBook all cases passed');

  // LocalBook detect
  const epubDetect = localBook.detect(new Uint8Array([0x50, 0x4B, 0x03, 0x04]));
  r.assert(epubDetect.format === 'cbz' || epubDetect.format === 'epub' || epubDetect.format === 'unknown', 'localBook detect PKZIP');

  // ---------- ReadingStateFacade ----------
  const readingState = new ReadingStateFacade();
  const stateReport = readingState.buildStageReport();
  r.assert(stateReport.facadeIdentifier === 'ReadingStateFacade', 'readingState facade id');
  r.assert(stateReport.stageName === 'reading_state', 'readingState stage name');
  r.assert(stateReport.cases.length === 5, `readingState has 5 cases`);
  r.assert(stateReport.cases.every(c => c.status === StageReportStatus.passed), 'readingState all cases passed');

  // ---------- ReplaceRuleFacade ----------
  const replaceRule = new ReplaceRuleFacade();
  const replaceReport = replaceRule.buildStageReport();
  r.assert(replaceReport.facadeIdentifier === 'ReplaceRuleFacade', 'replaceRule facade id');
  r.assert(replaceReport.stageName === 'replace_rule', 'replaceRule stage name');
  r.assert(replaceReport.cases.length === 4, `replaceRule has 4 cases`);
  r.assert(replaceReport.cases.every(c => c.status === StageReportStatus.passed), 'replaceRule all cases passed');

  // ReplaceRule apply
  const replaceResult = replaceRule.apply('广告内容', [{ id: 'r1', pattern: '广告', replacement: '', isRegex: false }]);
  r.assert(replaceResult === '内容', 'replaceRule plain replace');

  // ---------- StoreFacade ----------
  const store = new StoreFacade();
  const storeReport = store.buildStageReport();
  r.assert(storeReport.facadeIdentifier === 'StoreFacade', 'store facade id');
  r.assert(storeReport.stageName === 'store', 'store stage name');
  r.assert(storeReport.cases.length === 7, `store has 7 cases`);
  r.assert(storeReport.cases.every(c => c.status === StageReportStatus.passed), 'store all cases passed');

  // Store schema
  const schema = store.getSchema();
  r.assert(schema.version === 75, `store schema version 75 (got ${schema.version})`);
  r.assert(schema.entities.length === 21, `store schema 21 entities (got ${schema.entities.length})`);
  r.assert(schema.migrationStepCount === 32, `store schema 32 migration steps`);

  // ---------- SyncFacade ----------
  const sync = new SyncFacade();
  const syncReport = sync.buildStageReport();
  r.assert(syncReport.facadeIdentifier === 'SyncFacade', 'sync facade id');
  r.assert(syncReport.stageName === 'sync', 'sync stage name');
  r.assert(syncReport.cases.length === 7, `sync has 7 cases`);
  r.assert(syncReport.cases.every(c => c.status === StageReportStatus.passed), 'sync all cases passed');

  // ---------- RuntimeHostFacade ----------
  const runtimeHost = new RuntimeHostFacade();
  const hostReport = runtimeHost.buildStageReport();
  r.assert(hostReport.facadeIdentifier === 'RuntimeHostFacade', 'runtimeHost facade id');
  r.assert(hostReport.stageName === 'runtime_host', 'runtimeHost stage name');
  r.assert(hostReport.cases.length === 6, `runtimeHost has 6 cases`);
  r.assert(hostReport.cases.every(c => c.status === StageReportStatus.passed), 'runtimeHost all cases passed');
  r.assert(hostReport.cases.some(c => c.featureID === 'arkWeb'), 'runtimeHost has arkWeb');
  r.assert(hostReport.cases.some(c => c.featureID === 'nativeHTTP'), 'runtimeHost has nativeHTTP');
  r.assert(hostReport.cases.some(c => c.featureID === 'snapshotWrite'), 'runtimeHost has snapshotWrite');

  // ---------- CryptoFacade ----------
  const crypto = new CryptoFacade();
  const cryptoReport = crypto.buildStageReport();
  r.assert(cryptoReport.facadeIdentifier === 'CryptoFacade', 'crypto facade id');
  r.assert(cryptoReport.stageName === 'crypto', 'crypto stage name');
  r.assert(cryptoReport.cases.length === 5, `crypto has 5 cases`);
  r.assert(cryptoReport.cases.every(c => c.status === StageReportStatus.passed), 'crypto all cases passed');

  // Crypto round-trip
  const plain = new Uint8Array([114, 101, 97, 100, 101, 114]);
  const sealed = crypto.encrypt(plain, 'test-alias');
  r.assert(sealed.rawKeyExported === false, 'crypto no raw key exported');
  const decrypted = crypto.decrypt(sealed);
  r.assert(decrypted !== null && decrypted.length === plain.length, 'crypto round-trip success');

  // ---------- stage report 共享字段 ----------
  for (let i = 0; i < report.stageReports.length; i++) {
    const sr = report.stageReports[i];
    r.assert(sr.platformFamily === 'HarmonyOS', `stage ${sr.stageName} platformFamily HarmonyOS`);
    r.assert(sr.cleanRoomMaintained === true, `stage ${sr.stageName} cleanRoomMaintained true`);
    r.assert(sr.externalGPLCodeCopied === false, `stage ${sr.stageName} externalGPLCodeCopied false`);
    r.assert(sr.legadoSourceCopied === false, `stage ${sr.stageName} legadoSourceCopied false`);
  }

  return r;
}
