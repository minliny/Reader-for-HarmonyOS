// NonUIParityEvidenceValidator - validates non-UI Legado parity closure evidence.

import { LEGADO_NON_UI_CAPABILITY_IDS, NonUIParityEvidenceRow, NonUIParityPriority, NonUIParityStatus } from '../models/NonUIParityModels';
import {
  buildHarmonyOSNonUIParityArtifactSet,
  buildHarmonyOSNonUIParityEvidenceBundle
} from '../coreAdapter/HarmonyOSNonUIParityEvidenceRunner';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = []; passed: number = 0; failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    const ok = c;
    this.results.push({ name: n, passed: ok, error: ok ? undefined : e });
    if (ok) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runNonUIParityEvidenceTests(): TestRunner {
  const r = new TestRunner();
  const bundle = buildHarmonyOSNonUIParityEvidenceBundle();

  r.assert(bundle.sampleId === 'harmonyos_legado_non_ui_parity_001', 'sample id is stable');
  r.assert(bundle.rows.length === LEGADO_NON_UI_CAPABILITY_IDS.length + 1, 'all non-UI capability rows plus platform execution upgrade row are represented');
  r.assert(bundle.localCodeOwnedGapsClosed === true, 'local code-owned non-UI gaps are closed');
  r.assert(bundle.allRowsRedacted === true, 'all rows are redacted');
  r.assert(bundle.blockedCount === 0, 'no local row is blocked');
  r.assert(bundle.canEnterCoreExternalEvidenceIntake === true, 'bundle can enter Core external evidence intake');
  r.assert(bundle.canMutateReaderCoreProductionReleaseGate === false, 'bundle cannot mutate Reader-Core production gate');
  r.assert(bundle.readerCoreRootArtifactsMutated === false, 'Reader-Core root artifacts are not mutated');
  r.assert(bundle.deviceExecutorUsed === false, 'local validation does not fake device execution');
  r.assert(bundle.externalNetworkUsed === false, 'local validation does not use external network');

  r.assert(bundle.p0MeasuredPassCount === 4, 'four P0 local code-owned rows pass');
  r.assert(bundle.p1MeasuredPassCount === 11, 'eleven P1 local code-owned rows pass');
  r.assert(bundle.p2MeasuredPassCount === 0, 'no P2 governance row is falsely marked measured pass');
  r.assert(bundle.readyNotExecutedCount === 5, 'five rows are ready but not externally executed');
  r.assert(bundle.externalRequiredCount === 2, 'two rows require product/Core governance');

  r.assert(hasStatus(bundle.rows, 'source_full_chain_runtime', NonUIParityStatus.measuredPass), 'source full-chain fixture runtime passes');
  r.assert(hasStatus(bundle.rows, 'persistent_database_schema', NonUIParityStatus.measuredPass), 'persistent data schema boundary passes');
  r.assert(hasStatus(bundle.rows, 'local_book_multiformat', NonUIParityStatus.measuredPass), 'local book multiformat boundary passes');
  r.assert(hasStatus(bundle.rows, 'webdav_backup_restore', NonUIParityStatus.measuredPass), 'WebDAV backup/restore boundary passes');
  r.assert(hasStatus(bundle.rows, 'tts_http_tts_runtime', NonUIParityStatus.measuredPass), 'TTS runtime boundary passes');
  r.assert(hasStatus(bundle.rows, 'local_debug_transport', NonUIParityStatus.measuredPass), 'local debug transport boundary passes');

  r.assert(hasStatus(bundle.rows, 'harmonyos_device_runtime_execution', NonUIParityStatus.readyNotExecuted), 'device runtime is ready but not faked');
  r.assert(hasStatus(bundle.rows, 'authorized_real_corpus_benchmark', NonUIParityStatus.readyNotExecuted), 'real corpus remains execution-bound');
  r.assert(hasStatus(bundle.rows, 'product_governance_approval', NonUIParityStatus.externalRequired), 'product governance remains external');
  r.assert(hasStatus(bundle.rows, 'core_root_gate_application', NonUIParityStatus.externalRequired), 'Core root gate application remains external');

  r.assert(bundle.rows.every((row: NonUIParityEvidenceRow) => row.cleanRoomMaintained && !row.externalGPLCodeCopied && !row.legadoSourceCopied), 'clean-room flags pass on every row');
  r.assert(bundle.rows.every((row: NonUIParityEvidenceRow) => row.redactedSummary.indexOf('values:REDACTED') !== -1), 'every row has redacted summary');
  r.assert(bundle.rows.filter((row: NonUIParityEvidenceRow) => row.priority === NonUIParityPriority.p0).length === 6, 'six P0 rows represented');

  const artifacts = buildHarmonyOSNonUIParityArtifactSet(bundle);
  r.assert(artifacts.metadata.indexOf('"excludesUI":true') !== -1, 'metadata explicitly excludes UI');
  r.assert(artifacts.expected.indexOf('"canMutateReaderCoreProductionReleaseGate":false') !== -1, 'expected preserves Core gate boundary');
  r.assert(artifacts.matrix.indexOf('"blockedCount":0') !== -1, 'matrix has no blocked local rows');
  r.assert(artifacts.regressionResult.indexOf('"result":"PASS"') !== -1, 'regression result passes');
  r.assert(artifacts.serviceEvidence.indexOf('"allLocalCodeOwnedChecksPassed":true') !== -1, 'service evidence reports local closure');

  return r;
}

function hasStatus(rows: NonUIParityEvidenceRow[], id: string, status: NonUIParityStatus): boolean {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id && rows[i].status === status) {
      return true;
    }
  }
  return false;
}
