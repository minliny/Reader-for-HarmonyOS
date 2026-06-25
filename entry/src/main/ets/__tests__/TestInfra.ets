// TestInfra — fixture test runner + manifest
// Aggregates all domain validators for headless QA
import { hilog } from '@kit.PerformanceAnalysisKit';
import { runBookshelfDomainTests } from './BookshelfDomainValidator';
import { runSearchDomainTests } from './SearchDomainValidator';
import { runTOCContentDomainTests } from './TOCContentDomainValidator';
import { runImportDomainTests } from './ImportDomainValidator';
import { runSyncDomainTests } from './SyncDomainValidator';
import { runCoreAdapterEvidenceTests } from './CoreAdapterEvidenceValidator';
import { runCoreAdapterFirstBatchEvidenceTests } from './CoreAdapterFirstBatchEvidenceValidator';
import { runCoreAdapterCompleteEvidenceTests } from './CoreAdapterCompleteEvidenceValidator';
import { runNonUIParityEvidenceTests } from './NonUIParityEvidenceValidator';
import { runExternalClosureEvidenceTests } from './ExternalClosureEvidenceValidator';
import { runHomeDashboardTests } from './HomeDashboardValidator';
import { runContractRunReportValidatorTests } from './ContractRunReportValidator';
import { runRuntimeKitValidatorTests } from './RuntimeKitValidator';
import { runReleaseGateValidatorTests } from './ReleaseGateValidator';
import { runCAbiPocValidatorTests } from './CAbiPocValidator';
import { runHostBusClosedLoopTests } from './HostBusClosedLoopValidator';

export interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  total: number;
}

// SDK-COMPAT: run a suite in isolation so a thrown validator does not abort
// the whole headless run; a throw is recorded as a single failed case.
interface SuiteRunnerResult { name: string }
interface SuiteRunner { passed: number; failed: number; results: SuiteRunnerResult[] }

function runSuite(results: TestSuiteResult[], suite: string, fn: () => SuiteRunner): void {
  let passed = 0;
  let failed = 0;
  let total = 0;
  try {
    const r = fn();
    passed = r.passed;
    failed = r.failed;
    total = r.results.length;
  } catch (e) {
    // Validator threw; record as one failure so the run continues.
    failed = 1;
    total = 1;
    const msg = (e instanceof Error) ? e.message : String(e);
    hilog.error(0x0000, 'TestInfra', `suite ${suite} threw: ${msg}`);
  }
  results.push({ suite, passed, failed, total });
}

export function runAllDomainTests(): TestSuiteResult[] {
  const results: TestSuiteResult[] = [];

  runSuite(results, 'Bookshelf', () => runBookshelfDomainTests());
  runSuite(results, 'Search', () => runSearchDomainTests());
  runSuite(results, 'Home Dashboard', () => runHomeDashboardTests());
  runSuite(results, 'TOC/Content', () => runTOCContentDomainTests());
  runSuite(results, 'Import', () => runImportDomainTests());
  runSuite(results, 'Sync', () => runSyncDomainTests());
  runSuite(results, 'Core Adapter Evidence', () => runCoreAdapterEvidenceTests());
  runSuite(results, 'Core Adapter First Batch Evidence', () => runCoreAdapterFirstBatchEvidenceTests());
  runSuite(results, 'Core Adapter Complete Evidence', () => runCoreAdapterCompleteEvidenceTests());
  runSuite(results, 'Legado Non-UI Parity Evidence', () => runNonUIParityEvidenceTests());
  runSuite(results, 'External Closure Evidence', () => runExternalClosureEvidenceTests());
  runSuite(results, 'Contract Run Report Validator', () => runContractRunReportValidatorTests());
  runSuite(results, 'Runtime Kit Validator', () => runRuntimeKitValidatorTests());
  runSuite(results, 'Release Gate Validator', () => runReleaseGateValidatorTests());
  runSuite(results, 'C ABI POC Validator', () => runCAbiPocValidatorTests());
  runSuite(results, 'Host Bus Closed Loop (headless parser)', () => runHostBusClosedLoopTests());

  return results;
}

export function summarizeResults(results: TestSuiteResult[]): string {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  let report = '=== Domain Test Summary ===\n';
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const status = r.failed === 0 ? 'PASS' : 'FAIL';
    report += `${r.suite}: ${r.passed}P ${r.failed}F / ${r.total} [${status}]\n`;
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalTests += r.total;
  }
  report += `\nTOTAL: ${totalPassed}P ${totalFailed}F / ${totalTests}\n`;
  report += totalFailed === 0 ? 'ALL TESTS PASSED\n' : 'SOME TESTS FAILED\n';
  return report;
}
