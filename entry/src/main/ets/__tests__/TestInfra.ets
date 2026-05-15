// TestInfra — fixture test runner + manifest
// Aggregates all domain validators for headless QA
import { runBookshelfDomainTests } from './BookshelfDomainValidator';
import { runSearchDomainTests } from './SearchDomainValidator';
import { runTOCContentDomainTests } from './TOCContentDomainValidator';
import { runImportDomainTests } from './ImportDomainValidator';
import { runSyncDomainTests } from './SyncDomainValidator';

export interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  total: number;
}

export function runAllDomainTests(): TestSuiteResult[] {
  const results: TestSuiteResult[] = [];

  const bookshelf = runBookshelfDomainTests();
  results.push({ suite: 'Bookshelf', passed: bookshelf.passed, failed: bookshelf.failed, total: bookshelf.results.length });

  const search = runSearchDomainTests();
  results.push({ suite: 'Search', passed: search.passed, failed: search.failed, total: search.results.length });

  const tocContent = runTOCContentDomainTests();
  results.push({ suite: 'TOC/Content', passed: tocContent.passed, failed: tocContent.failed, total: tocContent.results.length });

  const import_ = runImportDomainTests();
  results.push({ suite: 'Import', passed: import_.passed, failed: import_.failed, total: import_.results.length });

  const sync = runSyncDomainTests();
  results.push({ suite: 'Sync', passed: sync.passed, failed: sync.failed, total: sync.results.length });

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
