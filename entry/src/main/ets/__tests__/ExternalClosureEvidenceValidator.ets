// ExternalClosureEvidenceValidator - validates emulator/corpus/release closure preflight.

import { ExternalClosureEvidenceRow, ExternalClosureStatus } from '../models/ExternalClosureModels';
import {
  buildHarmonyOSExternalClosureArtifactSet,
  buildHarmonyOSExternalClosureEvidenceBundle
} from '../coreAdapter/HarmonyOSExternalClosureEvidenceRunner';
import { harmonyOSRequiredRuntimeEvidenceIDs } from '../coreAdapter/HarmonyOSCorePlatformManifest';

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

export function runExternalClosureEvidenceTests(): TestRunner {
  const r = new TestRunner();
  const bundle = buildHarmonyOSExternalClosureEvidenceBundle();

  r.assert(bundle.sampleId === 'harmonyos_external_closure_evidence_001', 'sample id is stable');
  r.assert(bundle.rows.length === 9, 'nine external-closure rows are represented');
  r.assert(bundle.canEnterAuthorizedCorpusGate === true, 'authorized corpus gate can be entered');
  r.assert(bundle.canEnterReleaseGovernanceGate === true, 'release governance gate can be entered');
  r.assert(bundle.canEnterDeviceRuntimeGate === true, 'device runtime gate can be entered after emulator smoke');
  r.assert(bundle.canMutateReaderCoreProductionReleaseGate === false, 'HarmonyOS cannot mutate Core production release gate');
  r.assert(bundle.readerCoreRootArtifactsMutated === false, 'Reader-Core root artifacts are not mutated');
  r.assert(bundle.externalNetworkUsed === true, 'authorized corpus live execution uses external network');
  r.assert(bundle.deviceExecutorUsed === true, 'emulator app-shell smoke used the device executor');
  r.assert(bundle.allRowsRedacted === true, 'all rows are redacted');

  r.assert(bundle.deviceProvisioningAudit.hdcBinaryPresent === true, 'hdc binary is present');
  r.assert(bundle.deviceProvisioningAudit.emulatorBinaryPresent === true, 'emulator binary is present');
  r.assert(bundle.deviceProvisioningAudit.hdcTargetsEmpty === false, 'hdc target is present in observed smoke');
  r.assert(bundle.deviceProvisioningAudit.deviceManagerConfigPresent === false, 'deviceManager.xml is not required for hdc-observed smoke evidence');
  r.assert(bundle.deviceProvisioningAudit.emulatorInstanceConfigPresent === false, 'emulator config.ini is not required for hdc-observed smoke evidence');
  r.assert(bundle.deviceProvisioningAudit.canStartDeviceExecutor === true, 'device executor can start after virtual-device provisioning');
  r.assert(bundle.deviceProvisioningAudit.blocker.indexOf('127.0.0.1:5555') !== -1, 'connected emulator target is captured');

  r.assert(bundle.authorizedCorpusPreflight.runnerReady === true, 'authorized corpus runner is ready');
  r.assert(bundle.authorizedCorpusPreflight.targetCount === 4, 'four redacted target descriptors are bound');
  r.assert(bundle.authorizedCorpusPreflight.allTargetsAuthorized === true, 'all target descriptors are authorized by policy');
  r.assert(bundle.authorizedCorpusPreflight.redactedOnly === true, 'corpus descriptors are redacted');
  r.assert(bundle.authorizedCorpusPreflight.failureTaxonomyBound === true, 'corpus failure taxonomy is bound');
  r.assert(bundle.authorizedCorpusPreflight.sourceBackedDiffReady === true, 'source-backed diff shape is ready');
  r.assert(bundle.authorizedCorpusPreflight.executedTargetCount === 0, 'preflight itself does not claim live corpus execution');

  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.executedTargetCount === 2, 'authorized corpus live execution covers search and content');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.fullChainPassed === true, 'authorized corpus live execution full chain passes');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.searchResultCount > 0, 'authorized corpus live execution returns search results');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.externalNetworkUsed === true, 'authorized corpus live execution records external network use');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.redactedOnly === true, 'authorized corpus live execution is redacted');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.rawURLExported === false, 'authorized corpus live execution redacts raw URLs');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.rawResponseBodyExported === false, 'authorized corpus live execution redacts response bodies');
  r.assert(bundle.authorizedCorpusLiveExecutionEvidence.rawCredentialValueExported === false, 'authorized corpus live execution redacts credentials');

  const runtimeIds = harmonyOSRequiredRuntimeEvidenceIDs();
  r.assert(runtimeIds.every(id => bundle.runtimeDeviceRunnerPreflight.suppliedRuntimeEvidenceIDs.indexOf(id) !== -1), 'all required runtime evidence IDs are bound');
  r.assert(bundle.runtimeDeviceRunnerPreflight.arkWebRunnerReady === true, 'ArkWeb runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.jsEvalRunnerReady === true, 'JS eval runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.nativeHTTPRunnerReady === true, 'native HTTP runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.cookieMirrorRunnerReady === true, 'cookie mirror runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.sessionLoginRunnerReady === true, 'session login runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.secureStorageRunnerReady === true, 'secure storage runner preflight is ready');
  r.assert(bundle.runtimeDeviceRunnerPreflight.canExecuteAfterProvisioning === true, 'runtime preflight can execute after emulator provisioning');
  r.assert(bundle.runtimeDeviceRunnerPreflight.deviceExecutorUsed === false, 'runtime preflight does not claim full runtime runner execution');

  r.assert(bundle.secureStorageEntitlementEvidence.huksKitBound === true, 'HUKS kit is bound for secure-storage entitlement evidence');
  r.assert(bundle.secureStorageEntitlementEvidence.keyGenerateRunnerBound === true, 'secure-storage key generate runner is bound');
  r.assert(bundle.secureStorageEntitlementEvidence.rawExportDenialBound === true, 'secure-storage raw export denial is bound');
  r.assert(bundle.secureStorageEntitlementEvidence.keyDeleteRunnerBound === true, 'secure-storage key delete runner is bound');
  r.assert(bundle.secureStorageEntitlementEvidence.rawCredentialValueExported === false, 'secure-storage evidence redacts credentials');
  r.assert(bundle.secureStorageEntitlementEvidence.rawKeyMaterialExported === false, 'secure-storage evidence redacts key material');

  r.assert(bundle.releaseGovernancePreflight.evidenceIntakeReady === true, 'release evidence intake is ready');
  r.assert(bundle.releaseGovernancePreflight.productApprovalPacketReady === true, 'product approval packet shape is ready');
  r.assert(bundle.releaseGovernancePreflight.candidateRootGateExportReady === true, 'candidate root gate export shape is ready');
  r.assert(bundle.releaseGovernancePreflight.manualApplicationVerificationReady === true, 'manual application verification shape is ready');
  r.assert(bundle.releaseGovernancePreflight.finalConsistencyAuditReady === true, 'final consistency audit shape is ready');
  r.assert(bundle.releaseGovernancePreflight.canMutateProductionReleaseGate === false, 'release preflight cannot mutate Core gate');
  r.assert(bundle.releaseGovernancePreflight.requiresHumanApproval === true, 'release preflight requires human approval');

  r.assert(hasStatus(bundle.rows, 'emulator_toolchain_preflight', ExternalClosureStatus.measuredPass), 'emulator toolchain preflight passes');
  r.assert(hasStatus(bundle.rows, 'emulator_instance_start', ExternalClosureStatus.measuredPass), 'emulator instance start passes');
  r.assert(hasStatus(bundle.rows, 'device_runtime_native_http_arkweb_cookie_session_smoke', ExternalClosureStatus.measuredPass), 'nativeHTTP ArkWeb cookie session device smoke passes');
  r.assert(hasStatus(bundle.rows, 'secure_storage_entitlement_device_runner', ExternalClosureStatus.measuredPass), 'secure-storage entitlement runner passes');
  r.assert(hasStatus(bundle.rows, 'authorized_corpus_runner_preflight', ExternalClosureStatus.measuredPass), 'authorized corpus runner preflight passes');
  r.assert(hasStatus(bundle.rows, 'authorized_corpus_live_execution', ExternalClosureStatus.measuredPass), 'authorized corpus live execution passes');
  r.assert(hasStatus(bundle.rows, 'release_governance_preflight', ExternalClosureStatus.measuredPass), 'release governance preflight passes');
  r.assert(hasStatus(bundle.rows, 'core_root_gate_manual_application', ExternalClosureStatus.externalRequired), 'Core root gate application remains external');
  r.assert(bundle.rows.every((row: ExternalClosureEvidenceRow) => row.redactedSummary.indexOf('values:REDACTED') !== -1), 'every row has a redacted summary');

  const artifacts = buildHarmonyOSExternalClosureArtifactSet(bundle);
  r.assert(artifacts.expected.indexOf('"canEnterDeviceRuntimeGate":true') !== -1, 'expected records device runtime gate entry');
  r.assert(artifacts.deviceProvisioningAudit.indexOf('127.0.0.1:5555') !== -1, 'device provisioning artifact captures emulator target');
  r.assert(artifacts.authorizedCorpusPreflight.indexOf('"runnerReady":true') !== -1, 'corpus artifact captures runner readiness');
  r.assert(artifacts.authorizedCorpusLiveExecutionEvidence.indexOf('"fullChainPassed":true') !== -1, 'corpus live artifact captures full chain pass');
  r.assert(artifacts.releaseGovernancePreflight.indexOf('"manualApplicationVerificationReady":true') !== -1, 'release artifact captures manual verification readiness');
  r.assert(artifacts.regressionResult.indexOf('"result":"PASS"') !== -1, 'external closure regression passes');

  return r;
}

function hasStatus(rows: ExternalClosureEvidenceRow[], id: string, status: ExternalClosureStatus): boolean {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === id && rows[i].status === status) {
      return true;
    }
  }
  return false;
}
