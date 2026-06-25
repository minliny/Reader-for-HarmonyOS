// ContractRunReportValidator - Phase 1 唯一验收口测试。
// 验证 HarmonyOSContractRunReportExporter 输出格式正确，且 fail-closed 校验覆盖所有违规场景。
//
// 对齐 Core: ReaderCorePlatformAdapterContractRunReport.canBeAcceptedByCoreGate
// 绑定: metadata/expected/matrix/regressionResult

import { AdapterKind, EvidenceArtifactName, HARMONYOS_ADAPTER_CONTRACT_RUNNER, HARMONYOS_PLATFORM_FAMILY } from '../coreAdapter/HarmonyOSAdapterContractReport';
import { CoreCaseResult, CoreCaseStatus, CoreRunReport } from '../coreAdapter/HarmonyOSFirstBatchEvidenceRunner';
import { HarmonyOSCompleteArtifactSet, HarmonyOSCompleteEvidenceBundle, buildHarmonyOSCompleteArtifactSet, buildHarmonyOSCompleteEvidenceBundle } from '../coreAdapter/HarmonyOSCompleteEvidenceRunner';
import {
  ContractRunReportExportResult,
  ContractRunReportValidation,
  FailClosedViolation,
  coreHarmonyOSReferenceManifest,
  exportHarmonyOSContractRunReport,
  exportHarmonyOSContractRunReportJSON,
  isContractRunReportAccepted,
  validateContractRunReportFailClosed
} from '../coreAdapter/HarmonyOSContractRunReportExporter';

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

export function runContractRunReportValidatorTests(): TestRunner {
  const r = new TestRunner();

  // ---------- 正常导出 ----------
  const exportResult = exportHarmonyOSContractRunReport();
  const manifest = coreHarmonyOSReferenceManifest();

  r.assert(exportResult.exporterIdentifier === 'reader-core.harmonyos.adapter.contract-runner.exporter', 'exporter identifier stable');
  r.assert(exportResult.runReport.platformFamily === HARMONYOS_PLATFORM_FAMILY, 'runReport platformFamily is HarmonyOS');
  r.assert(exportResult.runReport.runnerIdentifier === HARMONYOS_ADAPTER_CONTRACT_RUNNER, 'runReport runnerIdentifier is contract-runner');
  r.assert(exportResult.runReport.manifestPlatformFamily === HARMONYOS_PLATFORM_FAMILY, 'runReport manifestPlatformFamily matches');
  r.assert(exportResult.runReport.manifestRunnerIdentifier === HARMONYOS_ADAPTER_CONTRACT_RUNNER, 'runReport manifestRunnerIdentifier matches');
  r.assert(exportResult.runReport.caseResults.length > 0, 'runReport caseResults non-empty');
  r.assert(exportResult.runReport.evidenceArtifacts.length === 4, 'runReport evidenceArtifacts has 4 entries');
  r.assert(exportResult.runReport.cleanRoomMaintained === true, 'runReport cleanRoomMaintained true');
  r.assert(exportResult.runReport.externalGPLCodeCopied === false, 'runReport externalGPLCodeCopied false');
  r.assert(exportResult.runReport.legadoSourceCopied === false, 'runReport legadoSourceCopied false');
  r.assert(exportResult.runReport.externalNetworkUsed === false, 'runReport externalNetworkUsed false');

  // ---------- JSON 格式 ----------
  const json = exportResult.runReportJSON;
  r.assert(json.length > 0, 'runReportJSON non-empty');
  r.assert(json.indexOf('"platformFamily":"HarmonyOS"') !== -1, 'JSON contains platformFamily');
  r.assert(json.indexOf('"runnerIdentifier":"reader-core.harmonyos.adapter.contract-runner"') !== -1, 'JSON contains runnerIdentifier');
  r.assert(json.indexOf('"caseResults"') !== -1, 'JSON contains caseResults');
  r.assert(json.indexOf('"unsupportedCapabilityIDs"') !== -1, 'JSON contains unsupportedCapabilityIDs');
  r.assert(json.indexOf('"evidenceArtifacts"') !== -1, 'JSON contains evidenceArtifacts');
  r.assert(json.indexOf('"cleanRoomMaintained":true') !== -1, 'JSON contains cleanRoomMaintained');
  r.assert(json.indexOf('"externalGPLCodeCopied":false') !== -1, 'JSON contains externalGPLCodeCopied');
  r.assert(json.indexOf('"legadoSourceCopied":false') !== -1, 'JSON contains legadoSourceCopied');

  // ---------- artifacts 完整 ----------
  r.assert(exportResult.artifacts.metadata.length > 0, 'metadata artifact non-empty');
  r.assert(exportResult.artifacts.expected.length > 0, 'expected artifact non-empty');
  r.assert(exportResult.artifacts.matrix.length > 0, 'matrix artifact non-empty');
  r.assert(exportResult.artifacts.regressionResult.length > 0, 'regressionResult artifact non-empty');

  // ---------- 正常情况 accepted == true ----------
  r.assert(exportResult.validation.accepted === true, `validation accepted on clean bundle (violations: ${exportResult.validation.violations.map(v => v.code).join(',')})`);
  r.assert(exportResult.validation.violations.length === 0, `no violations on clean bundle`);
  r.assert(exportResult.validation.manifestMatchesRunner === true, 'manifestMatchesRunner true');
  r.assert(exportResult.validation.missingArtifacts.length === 0, 'no missing artifacts');
  r.assert(exportResult.validation.missingRequiredFeatures.length === 0, `no missing required features (got: ${exportResult.validation.missingRequiredFeatures.join(',')})`);
  r.assert(exportResult.validation.unsupportedDisguisedAsPass.length === 0, 'no unsupported disguised as pass');
  r.assert(exportResult.validation.failedCaseCount === 0, 'no failed cases');
  r.assert(exportResult.validation.unsupportedRequiredCaseCount === 0, 'no unsupported required cases');
  r.assert(exportResult.validation.unsupportedCapabilityIDsPreserved === true, 'unsupportedCapabilityIDs preserved');

  // ---------- 便捷 API ----------
  r.assert(isContractRunReportAccepted() === true, 'isContractRunReportAccepted returns true on clean bundle');
  r.assert(exportHarmonyOSContractRunReportJSON().length > 0, 'exportHarmonyOSContractRunReportJSON returns non-empty string');

  // ---------- manifest reference 对齐 Core harmonyOSReference ----------
  r.assert(manifest.platformFamily === 'HarmonyOS', 'manifest platformFamily HarmonyOS');
  r.assert(manifest.runnerIdentifier === 'reader-core.harmonyos.adapter.contract-runner', 'manifest runnerIdentifier');
  r.assert(manifest.requirements.length === 6, 'manifest has 6 requirements');
  r.assert(manifest.requiredEvidenceArtifacts.length === 4, 'manifest requiredEvidenceArtifacts 4');
  r.assert(manifest.hostOwnedCapabilityIDs.length === 7, 'manifest hostOwnedCapabilityIDs 7');
  r.assert(manifest.unsupportedCapabilityIDs.length === 5, 'manifest unsupportedCapabilityIDs 5');

  // archive required features 对齐 Core
  const archiveReq = manifest.requirements.find(req => req.kind === AdapterKind.archive);
  r.assert(archiveReq !== undefined && archiveReq.requiredFeatureIDs.length === 4, 'archive requirement has 4 features');
  r.assert(archiveReq !== undefined && archiveReq.requiredFeatureIDs.indexOf('epub.zip') !== -1, 'archive has epub.zip');
  r.assert(archiveReq !== undefined && archiveReq.requiredFeatureIDs.indexOf('opf-manifest-baseline') !== -1, 'archive has opf-manifest-baseline');

  // runtimeHost required features 对齐 Core
  const runtimeReq = manifest.requirements.find(req => req.kind === AdapterKind.runtimeHost);
  r.assert(runtimeReq !== undefined && runtimeReq.requiredFeatureIDs.length === 6, 'runtimeHost requirement has 6 features');
  r.assert(runtimeReq !== undefined && runtimeReq.requiredFeatureIDs.indexOf('arkWeb') !== -1, 'runtimeHost has arkWeb');
  r.assert(runtimeReq !== undefined && runtimeReq.requiredFeatureIDs.indexOf('snapshotWrite') !== -1, 'runtimeHost has snapshotWrite');

  // ---------- fail-closed: 缺 artifact ----------
  const missingArtifactBundle = buildHarmonyOSCompleteEvidenceBundle();
  const baseArtifacts1 = buildHarmonyOSCompleteArtifactSet(missingArtifactBundle);
  const emptyArtifacts: HarmonyOSCompleteArtifactSet = {
    metadata: '',
    expected: '',
    matrix: baseArtifacts1.matrix,
    regressionResult: baseArtifacts1.regressionResult,
    platformAdapterContractRunReport: baseArtifacts1.platformAdapterContractRunReport,
    platformAdapterExternalExecution: baseArtifacts1.platformAdapterExternalExecution,
    localBookPlatformExecution: baseArtifacts1.localBookPlatformExecution,
    feedParserPlatformExecution: baseArtifacts1.feedParserPlatformExecution,
    platformRuntimeCI: baseArtifacts1.platformRuntimeCI,
    hostAppIntegrationSmokeReport: baseArtifacts1.hostAppIntegrationSmokeReport,
    releaseEvidenceCloseout: baseArtifacts1.releaseEvidenceCloseout
  };
  const missingArtifactValidation = validateContractRunReportFailClosed(missingArtifactBundle.runReport, emptyArtifacts, manifest);
  r.assert(missingArtifactValidation.accepted === false, 'fail-closed on missing artifacts');
  r.assert(hasViolation(missingArtifactValidation, 'missing_evidence_artifacts'), 'missing_evidence_artifacts violation present');
  r.assert(missingArtifactValidation.missingArtifacts.indexOf('metadata:empty') !== -1, 'metadata:empty in missingArtifacts');
  r.assert(missingArtifactValidation.missingArtifacts.indexOf('expected:empty') !== -1, 'expected:empty in missingArtifacts');

  // ---------- fail-closed: 缺 required feature ----------
  const missingFeatureReport = cloneRunReport(exportResult.runReport);
  // 移除 archive:epub.zip 的 passed case
  missingFeatureReport.caseResults = missingFeatureReport.caseResults.filter(
    (c: CoreCaseResult) => !(c.kind === AdapterKind.archive && c.featureID === 'epub.zip')
  );
  const missingFeatureArtifacts = buildHarmonyOSCompleteArtifactSet();
  const missingFeatureValidation = validateContractRunReportFailClosed(missingFeatureReport, missingFeatureArtifacts, manifest);
  r.assert(missingFeatureValidation.accepted === false, 'fail-closed on missing required feature');
  r.assert(hasViolation(missingFeatureValidation, 'missing_required_features'), 'missing_required_features violation present');
  r.assert(missingFeatureValidation.missingRequiredFeatures.indexOf('archive:epub.zip') !== -1, 'archive:epub.zip in missingRequiredFeatures');

  // ---------- fail-closed: failed case ----------
  const failedCaseReport = cloneRunReport(exportResult.runReport);
  for (let i = 0; i < failedCaseReport.caseResults.length; i++) {
    if (failedCaseReport.caseResults[i].kind === AdapterKind.archive && failedCaseReport.caseResults[i].featureID === 'epub.zip') {
      const orig = failedCaseReport.caseResults[i];
      failedCaseReport.caseResults[i] = { kind: orig.kind, featureID: orig.featureID, status: CoreCaseStatus.failed, evidenceID: orig.evidenceID, redactedSummary: orig.redactedSummary };
      break;
    }
  }
  const failedCaseValidation = validateContractRunReportFailClosed(failedCaseReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(failedCaseValidation.accepted === false, 'fail-closed on failed case');
  r.assert(hasViolation(failedCaseValidation, 'failed_cases_present'), 'failed_cases_present violation present');
  r.assert(failedCaseValidation.failedCaseCount === 1, 'failedCaseCount is 1');

  // ---------- fail-closed: unsupported required case ----------
  const unsupportedCaseReport = cloneRunReport(exportResult.runReport);
  for (let i = 0; i < unsupportedCaseReport.caseResults.length; i++) {
    if (unsupportedCaseReport.caseResults[i].kind === AdapterKind.runtimeHost && unsupportedCaseReport.caseResults[i].featureID === 'arkWeb') {
      const orig2 = unsupportedCaseReport.caseResults[i];
      unsupportedCaseReport.caseResults[i] = { kind: orig2.kind, featureID: orig2.featureID, status: CoreCaseStatus.unsupported, evidenceID: orig2.evidenceID, redactedSummary: orig2.redactedSummary };
      break;
    }
  }
  const unsupportedCaseValidation = validateContractRunReportFailClosed(unsupportedCaseReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(unsupportedCaseValidation.accepted === false, 'fail-closed on unsupported required case');
  r.assert(hasViolation(unsupportedCaseValidation, 'unsupported_required_cases'), 'unsupported_required_cases violation present');
  r.assert(unsupportedCaseValidation.unsupportedRequiredCaseCount === 1, 'unsupportedRequiredCaseCount is 1');

  // ---------- fail-closed: cleanRoomMaintained == false ----------
  const dirtyReport = cloneRunReport(exportResult.runReport);
  dirtyReport.cleanRoomMaintained = false;
  const dirtyValidation = validateContractRunReportFailClosed(dirtyReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(dirtyValidation.accepted === false, 'fail-closed on cleanRoomMaintained false');
  r.assert(hasViolation(dirtyValidation, 'clean_room_violation'), 'clean_room_violation present');

  // ---------- fail-closed: externalGPLCodeCopied == true ----------
  const gplReport = cloneRunReport(exportResult.runReport);
  gplReport.externalGPLCodeCopied = true;
  const gplValidation = validateContractRunReportFailClosed(gplReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(gplValidation.accepted === false, 'fail-closed on externalGPLCodeCopied true');
  r.assert(hasViolation(gplValidation, 'gpl_code_copied'), 'gpl_code_copied present');

  // ---------- fail-closed: legadoSourceCopied == true ----------
  const legadoReport = cloneRunReport(exportResult.runReport);
  legadoReport.legadoSourceCopied = true;
  const legadoValidation = validateContractRunReportFailClosed(legadoReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(legadoValidation.accepted === false, 'fail-closed on legadoSourceCopied true');
  r.assert(hasViolation(legadoValidation, 'legado_source_copied'), 'legado_source_copied present');

  // ---------- fail-closed: externalNetworkUsed == true ----------
  const networkReport = cloneRunReport(exportResult.runReport);
  networkReport.externalNetworkUsed = true;
  const networkValidation = validateContractRunReportFailClosed(networkReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(networkValidation.accepted === false, 'fail-closed on externalNetworkUsed true');
  r.assert(hasViolation(networkValidation, 'external_network_used'), 'external_network_used present');

  // ---------- fail-closed: manifest runner mismatch ----------
  const mismatchReport = cloneRunReport(exportResult.runReport);
  mismatchReport.runnerIdentifier = 'wrong.runner';
  const mismatchValidation = validateContractRunReportFailClosed(mismatchReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(mismatchValidation.accepted === false, 'fail-closed on runner mismatch');
  r.assert(hasViolation(mismatchValidation, 'manifest_runner_mismatch'), 'manifest_runner_mismatch present');
  r.assert(mismatchValidation.manifestMatchesRunner === false, 'manifestMatchesRunner false');

  // ---------- fail-closed: unsupportedCapabilityIDs drift ----------
  const driftReport = cloneRunReport(exportResult.runReport);
  driftReport.unsupportedCapabilityIDs = ['harmonyos.reader.pdf']; // 缺少 4 个
  const driftValidation = validateContractRunReportFailClosed(driftReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(driftValidation.accepted === false, 'fail-closed on unsupportedCapabilityIDs drift');
  r.assert(hasViolation(driftValidation, 'unsupported_capability_ids_drift'), 'unsupported_capability_ids_drift present');
  r.assert(driftValidation.unsupportedCapabilityIDsPreserved === false, 'unsupportedCapabilityIDsPreserved false');

  // ---------- fail-closed: empty caseResults ----------
  const emptyReport = cloneRunReport(exportResult.runReport);
  emptyReport.caseResults = [];
  const emptyValidation = validateContractRunReportFailClosed(emptyReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(emptyValidation.accepted === false, 'fail-closed on empty caseResults');
  r.assert(hasViolation(emptyValidation, 'empty_case_results'), 'empty_case_results present');

  // ---------- fail-closed: unsafe content (localhost bridge 引用) ----------
  const unsafeReport = cloneRunReport(exportResult.runReport);
  const origUnsafe = unsafeReport.caseResults[0];
  unsafeReport.caseResults[0] = {
    kind: origUnsafe.kind,
    featureID: origUnsafe.featureID,
    status: origUnsafe.status,
    evidenceID: origUnsafe.evidenceID,
    redactedSummary: 'localhost:8899 bridge reference leaked'
  };
  const unsafeValidation = validateContractRunReportFailClosed(unsafeReport, buildHarmonyOSCompleteArtifactSet(), manifest);
  r.assert(unsafeValidation.accepted === false, 'fail-closed on unsafe content (localhost bridge)');
  r.assert(hasViolation(unsafeValidation, 'unsafe_content_exported'), 'unsafe_content_exported present');

  // ---------- unsupportedCapabilityIDs 内容对齐 Core ----------
  r.assert(exportResult.runReport.unsupportedCapabilityIDs.indexOf('harmonyos.reader.readium-equivalent') !== -1, 'unsupported readium marker preserved');
  r.assert(exportResult.runReport.unsupportedCapabilityIDs.indexOf('harmonyos.reader.pdf') !== -1, 'unsupported pdf marker preserved');
  r.assert(exportResult.runReport.unsupportedCapabilityIDs.indexOf('harmonyos.reader.cbz') !== -1, 'unsupported cbz marker preserved');
  r.assert(exportResult.runReport.unsupportedCapabilityIDs.indexOf('harmonyos.sync.legado-equivalent') !== -1, 'unsupported sync marker preserved');

  // ---------- hostOwnedCapabilityIDs 内容对齐 Core ----------
  r.assert(exportResult.runReport.hostOwnedCapabilityIDs.indexOf('harmonyos.host.bookshelf') !== -1, 'host bookshelf preserved');
  r.assert(exportResult.runReport.hostOwnedCapabilityIDs.indexOf('harmonyos.host.app-database') !== -1, 'host app-database preserved');

  return r;
}

function cloneRunReport(report: CoreRunReport): CoreRunReport {
  return {
    platformFamily: report.platformFamily,
    runnerIdentifier: report.runnerIdentifier,
    manifestPlatformFamily: report.manifestPlatformFamily,
    manifestRunnerIdentifier: report.manifestRunnerIdentifier,
    caseResults: report.caseResults.map((c: CoreCaseResult): CoreCaseResult => {
      const result: CoreCaseResult = {
        kind: c.kind,
        featureID: c.featureID,
        status: c.status,
        evidenceID: c.evidenceID,
        redactedSummary: c.redactedSummary
      };
      return result;
    }),
    evidenceArtifacts: report.evidenceArtifacts.slice(),
    hostOwnedCapabilityIDs: report.hostOwnedCapabilityIDs.slice(),
    unsupportedCapabilityIDs: report.unsupportedCapabilityIDs.slice(),
    cleanRoomMaintained: report.cleanRoomMaintained,
    externalGPLCodeCopied: report.externalGPLCodeCopied,
    legadoSourceCopied: report.legadoSourceCopied,
    externalNetworkUsed: report.externalNetworkUsed
  };
}

function hasViolation(validation: ContractRunReportValidation, code: string): boolean {
  for (let i = 0; i < validation.violations.length; i++) {
    if (validation.violations[i].code === code) {
      return true;
    }
  }
  return false;
}
