// CoreAdapterCompleteEvidenceValidator - validates complete HarmonyOS adapter evidence closure.

import { AdapterKind } from '../coreAdapter/HarmonyOSAdapterContractReport';
import {
  CoreCaseStatus,
  FirstBatchValidationResult,
  LocalEvidenceStatus,
  validateHarmonyOSFirstBatchArtifactSet
} from '../coreAdapter/HarmonyOSFirstBatchEvidenceRunner';
import {
  HarmonyOSCompleteEvidenceBundle,
  buildHarmonyOSCompleteArtifactSet,
  buildHarmonyOSCompleteEvidenceBundle
} from '../coreAdapter/HarmonyOSCompleteEvidenceRunner';
import {
  harmonyOSRequiredCaseCount,
  harmonyOSRequiredHostSmokeEvidenceIDs,
  harmonyOSRequiredRuntimeEvidenceIDs
} from '../coreAdapter/HarmonyOSCorePlatformManifest';

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

export function runCoreAdapterCompleteEvidenceTests(): TestRunner {
  const r = new TestRunner();
  const bundle = buildHarmonyOSCompleteEvidenceBundle('local-complete-validation-commit', 'local-complete-validation-job', 'local-complete-validation-artifact');

  r.assert(bundle.sampleId === 'harmonyos_adapter_complete_evidence_001', 'complete sample id is stable');
  r.assert(bundle.caseBundle.caseVectors.length === harmonyOSRequiredCaseCount(), 'complete bundle covers every Core manifest feature');
  r.assert(bundle.runReport.caseResults.length === bundle.caseBundle.caseVectors.length, 'complete run report has one result per case vector');
  r.assert(bundle.runReport.caseResults.every(result => result.status === CoreCaseStatus.passed), 'all Core case results pass');
  r.assert(bundle.localEvidence.every(evidence => evidence.localStatus === LocalEvidenceStatus.measuredPass), 'all local evidence rows are measured pass');

  r.assert(bundle.canEnterLocalBookPlatformGate === true, 'local-book platform gate passes');
  r.assert(bundle.canEnterFeedParserPlatformGate === true, 'feed parser platform gate remains passing');
  r.assert(bundle.canEnterPlatformRuntimeCIGate === true, 'platform runtime CI gate passes');
  r.assert(bundle.canEnterHostAppSmokeGate === true, 'host app smoke gate passes');
  r.assert(bundle.canEnterPlatformEvidenceGate === true, 'whole platform evidence gate passes');

  r.assert(hasCoreStatus(bundle, AdapterKind.archive, 'epub.zip', CoreCaseStatus.passed), 'EPUB ZIP archive evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.archive, 'opf-manifest-baseline', CoreCaseStatus.passed), 'OPF manifest evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.archive, 'deflate-zlib', CoreCaseStatus.passed), 'deflate-zlib archive evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.archive, 'cbz', CoreCaseStatus.passed), 'CBZ archive evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.localFileAccess, 'file-picker', CoreCaseStatus.passed), 'file-picker adapter evidence passes as device-ready local-validated');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'encrypted-credential', CoreCaseStatus.passed), 'encrypted-credential evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'system-tts', CoreCaseStatus.passed), 'system-tts evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'webdav-client', CoreCaseStatus.passed), 'webdav-client evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'cookie-persistence', CoreCaseStatus.passed), 'cookie-persistence evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'audiobook-player', CoreCaseStatus.passed), 'audiobook-player evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'pdf-render', CoreCaseStatus.passed), 'pdf-render evidence passes (reader-shell PDF marker preserved)');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'http-tts', CoreCaseStatus.passed), 'http-tts contract-only evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.localFileAccess, 'permission-token', CoreCaseStatus.passed), 'permission token evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.markupParser, 'html.css', CoreCaseStatus.passed), 'HTML CSS parser evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.markupParser, 'xml.xpath', CoreCaseStatus.passed), 'XML XPath parser evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'arkWeb', CoreCaseStatus.passed), 'ArkWeb DOM smoke evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'nativeHTTP', CoreCaseStatus.passed), 'native HTTP runtime evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'cookieStore', CoreCaseStatus.passed), 'cookie mirror evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'sessionPersistence', CoreCaseStatus.passed), 'session persistence evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'javascript', CoreCaseStatus.passed), 'JS bridge evidence passes');
  r.assert(hasCoreStatus(bundle, AdapterKind.runtimeHost, 'snapshotWrite', CoreCaseStatus.passed), 'snapshot rollback evidence passes');

  const runtimeIds = harmonyOSRequiredRuntimeEvidenceIDs();
  r.assert(runtimeIds.every(id => bundle.runtimeHostEvidence.suppliedRuntimeEvidenceIDs.indexOf(id) !== -1), 'all runtime evidence IDs are supplied');
  r.assert(bundle.runtimeHostEvidence.externalNetworkUsed === false, 'runtime evidence uses no external network');
  r.assert(bundle.runtimeHostEvidence.deviceExecutorReady === true, 'runtime evidence is device-executor ready');
  r.assert(bundle.runtimeHostEvidence.deviceExecutorUsed === false, 'local validation does not pretend device executor ran');
  r.assert(bundle.runtimeHostEvidence.authorizationAudit.indexOf('values:REDACTED') !== -1, 'runtime authorization audit is redacted');
  r.assert(bundle.runtimeHostEvidence.rawCookieValueExported === false, 'runtime evidence redacts cookie values');
  r.assert(bundle.runtimeHostEvidence.rawCredentialValueExported === false, 'runtime evidence redacts credentials');
  r.assert(bundle.runtimeHostEvidence.rawSessionTokenExported === false, 'runtime evidence redacts session tokens');

  const hostIds = harmonyOSRequiredHostSmokeEvidenceIDs();
  r.assert(hostIds.every(id => bundle.hostSmokeEvidence.passedEvidenceIDs.indexOf(id) !== -1), 'all host smoke evidence IDs pass');
  r.assert(bundle.hostSmokeEvidence.rawLocalPathExported === false, 'host smoke redacts local paths');
  r.assert(bundle.hostSmokeEvidence.rawCredentialValueExported === false, 'host smoke redacts credentials');
  r.assert(bundle.hostSmokeEvidence.rawCookieValueExported === false, 'host smoke redacts cookies');

  r.assert(bundle.releaseCloseoutEvidence.canEnterReleaseEvidenceIntake === true, 'release evidence intake can accept HarmonyOS complete evidence');
  r.assert(bundle.releaseCloseoutEvidence.canProposeProductionGateDowngrade === true, 'release closeout can propose production gate downgrade');
  r.assert(bundle.releaseCloseoutEvidence.canMutateProductionReleaseGate === false, 'HarmonyOS evidence cannot mutate Reader-Core production gate');
  r.assert(bundle.releaseCloseoutEvidence.readerCoreRootArtifactsMutated === false, 'Reader-Core root artifacts are not mutated');

  const artifacts = buildHarmonyOSCompleteArtifactSet(bundle);
  const validation: FirstBatchValidationResult = validateHarmonyOSFirstBatchArtifactSet(artifacts);
  r.assert(validation.artifactCount === 10, 'complete artifact set preserves ten Core intake artifacts');
  r.assert(validation.allRequiredArtifactsPresent === true, 'complete artifact set has required metadata/expected/matrix/regressionResult');
  r.assert(validation.unsafeContentFound === false, 'complete artifacts contain no unsafe material');
  r.assert(validation.acceptedByCoreRunReport === true, 'complete artifact set is accepted by Core run report');
  r.assert(artifacts.platformRuntimeCI.indexOf('"missingRuntimeEvidenceIDs":[]') !== -1, 'runtime artifact has no missing runtime IDs');
  r.assert(artifacts.hostAppIntegrationSmokeReport.indexOf('"canEnterHostAppEvidenceGate":true') !== -1, 'host smoke artifact passes');
  r.assert(artifacts.releaseEvidenceCloseout.indexOf('"readerCoreRootArtifactsMutated":false') !== -1, 'release closeout preserves Core root boundary');

  return r;
}

function hasCoreStatus(bundle: HarmonyOSCompleteEvidenceBundle, kind: AdapterKind, featureID: string, status: CoreCaseStatus): boolean {
  for (let i = 0; i < bundle.runReport.caseResults.length; i++) {
    const result = bundle.runReport.caseResults[i];
    if (result.kind === kind && result.featureID === featureID && result.status === status) {
      return true;
    }
  }
  return false;
}
