// CoreAdapterEvidenceValidator - validates HarmonyOS host adapter contract evidence shape.
import {
  AdapterKind,
  EvidenceArtifactName,
  EvidenceStatus,
  HARMONYOS_ADAPTER_CONTRACT_RUNNER,
  HARMONYOS_PLATFORM_FAMILY,
  HarmonyOSAdapterContractReport,
  RuntimeEvidenceId,
  adapterKinds,
  createHarmonyOSAdapterContractReport,
  exportHarmonyOSAdapterContractReport,
  requiredEvidenceArtifactNames,
  runtimeEvidenceIds
} from '../coreAdapter/HarmonyOSAdapterContractReport';
import {
  buildHarmonyOSAdapterArtifactSet,
  harmonyOSAdapterArtifactPlatformFamily,
  harmonyOSAdapterArtifactRunnerId,
  harmonyOSAdapterArtifactSampleId,
  validateHarmonyOSAdapterArtifactSet
} from '../coreAdapter/HarmonyOSAdapterArtifactBuilder';

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

export function runCoreAdapterEvidenceTests(): TestRunner {
  const r = new TestRunner();
  const report = createHarmonyOSAdapterContractReport();

  r.assert(report.platformFamily === HARMONYOS_PLATFORM_FAMILY, 'platformFamily is HarmonyOS');
  r.assert(report.runnerIdentifier === HARMONYOS_ADAPTER_CONTRACT_RUNNER, 'runnerIdentifier matches Core contract runner');
  r.assert(report.actualPlatformExecutionClaimed === false, 'contract report does not claim actual platform execution');
  r.assert(report.status === EvidenceStatus.contractOnly, 'report is CONTRACT_ONLY');

  const expectedArtifacts = requiredEvidenceArtifactNames();
  r.assert(expectedArtifacts.length === 4, 'exactly four required artifact names');
  r.assert(hasArtifact(expectedArtifacts, EvidenceArtifactName.metadata), 'metadata artifact required');
  r.assert(hasArtifact(expectedArtifacts, EvidenceArtifactName.expected), 'expected artifact required');
  r.assert(hasArtifact(expectedArtifacts, EvidenceArtifactName.matrix), 'matrix artifact required');
  r.assert(hasArtifact(expectedArtifacts, EvidenceArtifactName.regressionResult), 'regressionResult artifact required');
  r.assert(report.requiredEvidenceArtifacts.length === expectedArtifacts.length, 'report exposes all required artifact descriptors');
  r.assert(report.requiredEvidenceArtifacts[0].containsPrivateContent === false, 'artifact descriptors redact private content');
  r.assert(report.requiredEvidenceArtifacts[0].containsRawCookieValue === false, 'artifact descriptors redact raw cookie values');
  r.assert(report.requiredEvidenceArtifacts[0].containsRawCredentialValue === false, 'artifact descriptors redact raw credentials');

  const expectedKinds = adapterKinds();
  r.assert(expectedKinds.length === 6, 'exactly six adapter kinds');
  r.assert(hasKind(expectedKinds, AdapterKind.archive), 'archive adapter kind present');
  r.assert(hasKind(expectedKinds, AdapterKind.localFileAccess), 'localFileAccess adapter kind present');
  r.assert(hasKind(expectedKinds, AdapterKind.markupParser), 'markupParser adapter kind present');
  r.assert(hasKind(expectedKinds, AdapterKind.feedParser), 'feedParser adapter kind present');
  r.assert(hasKind(expectedKinds, AdapterKind.textEncodingDetector), 'textEncodingDetector adapter kind present');
  r.assert(hasKind(expectedKinds, AdapterKind.runtimeHost), 'runtimeHost adapter kind present');
  r.assert(report.adapters.length === expectedKinds.length, 'report exposes all adapter descriptors');
  for (let i = 0; i < report.adapters.length; i++) {
    const adapter = report.adapters[i];
    r.assert(adapter.platformOwned === true, `${adapter.kind} marked platform-owned`);
    r.assert(adapter.coreOwned === false, `${adapter.kind} not marked Core-owned`);
    r.assert(adapter.status === EvidenceStatus.contractOnly, `${adapter.kind} remains contract-only`);
    r.assert(adapter.requiredArtifacts.length === expectedArtifacts.length, `${adapter.kind} requires all evidence artifacts`);
  }

  r.assert(report.secureStorageCookieSession.gap === 'S9', 'secure-storage/cookie/session descriptor advances S9');
  r.assert(report.secureStorageCookieSession.platformOwned === true, 'S9 descriptor is platform-owned');
  r.assert(report.secureStorageCookieSession.coreOwned === false, 'S9 descriptor is not Core-owned');
  r.assert(report.secureStorageCookieSession.rawCookieValuesExported === false, 'S9 does not export raw cookie values');
  r.assert(report.secureStorageCookieSession.rawCredentialValuesExported === false, 'S9 does not export raw credentials');
  r.assert(report.secureStorageCookieSession.rawSessionTokensExported === false, 'S9 does not export raw session tokens');
  r.assert(report.secureStorageCookieSession.permissionTokenValuesExported === false, 'S9 does not export permission token values');
  r.assert(hasRuntimeId(report.secureStorageCookieSession.runtimeEvidenceIds, RuntimeEvidenceId.secureStoragePlatformAudit), 'S9 includes secure_storage_platform_audit id');
  r.assert(hasRuntimeId(report.secureStorageCookieSession.runtimeEvidenceIds, RuntimeEvidenceId.sessionCookieLoginPlatformRunner), 'S9 includes session_cookie_login_platform_runner id');
  r.assert(hasRuntimeId(report.secureStorageCookieSession.runtimeEvidenceIds, RuntimeEvidenceId.webviewCookieMirrorAudit), 'S9 includes webview_cookie_mirror_audit id');

  const expectedRuntimeIds = runtimeEvidenceIds();
  r.assert(expectedRuntimeIds.length === 7, 'all runtime CI evidence ids are reserved');
  r.assert(report.runtimeEvidence.length === expectedRuntimeIds.length, 'report exposes all runtime evidence descriptors');
  for (let j = 0; j < report.runtimeEvidence.length; j++) {
    const evidence = report.runtimeEvidence[j];
    r.assert(evidence.status === EvidenceStatus.notExecuted, `${evidence.id} is NOT_EXECUTED`);
    r.assert(evidence.actualPlatformExecutionClaimed === false, `${evidence.id} does not claim platform execution`);
    r.assert(evidence.redactsCookieValues === true, `${evidence.id} redacts cookie values`);
    r.assert(evidence.redactsCredentialValues === true, `${evidence.id} redacts credential values`);
    r.assert(evidence.redactsSessionTokens === true, `${evidence.id} redacts session tokens`);
  }

  r.assert(report.unsupportedReaderMarkers.length === 5, 'unsupported reader markers are preserved');
  r.assert(hasUnsupportedMarker(report, 'harmonyos.reader.readium-equivalent'), 'readium-equivalent marker preserved');
  r.assert(hasUnsupportedMarker(report, 'harmonyos.reader.full-epub-shell'), 'full-epub-shell marker preserved');
  r.assert(hasUnsupportedMarker(report, 'harmonyos.reader.pdf'), 'pdf marker preserved');
  r.assert(hasUnsupportedMarker(report, 'harmonyos.reader.cbz'), 'cbz marker preserved');
  r.assert(hasUnsupportedMarker(report, 'harmonyos.sync.legado-equivalent'), 'sync marker preserved');

  const json = exportHarmonyOSAdapterContractReport(report);
  r.assert(json.indexOf(HARMONYOS_ADAPTER_CONTRACT_RUNNER) !== -1, 'exported JSON contains runnerIdentifier');
  r.assert(json.indexOf('rawCookieValuesExported":false') !== -1, 'exported JSON records cookie redaction');
  r.assert(json.indexOf('actualPlatformExecutionClaimed":false') !== -1, 'exported JSON records no execution claim');

  const artifacts = buildHarmonyOSAdapterArtifactSet(report);
  const artifactValidation = validateHarmonyOSAdapterArtifactSet(artifacts);
  r.assert(artifactValidation.artifactCount === 4, 'artifact builder emits four documents');
  r.assert(artifactValidation.missingArtifactCount === 0, 'artifact builder has no missing documents');
  r.assert(artifactValidation.unsafeContentFound === false, 'artifact builder omits unsafe material');
  r.assert(artifactValidation.acceptedForShapeReview === true, 'artifact set can enter shape review');
  r.assert(artifactValidation.acceptedForReleaseGate === false, 'artifact set cannot pass release gate');

  r.assert(harmonyOSAdapterArtifactSampleId() === 'harmonyos_adapter_contract_artifacts_001', 'artifact sample id is stable');
  r.assert(harmonyOSAdapterArtifactRunnerId() === HARMONYOS_ADAPTER_CONTRACT_RUNNER, 'artifact runner id matches Core manifest');
  r.assert(harmonyOSAdapterArtifactPlatformFamily() === HARMONYOS_PLATFORM_FAMILY, 'artifact platform family matches Core manifest');

  r.assert(artifacts.metadata.indexOf('"platformFamily":"HarmonyOS"') !== -1, 'metadata artifact contains platform family');
  r.assert(artifacts.metadata.indexOf('"runnerIdentifier":"reader-core.harmonyos.adapter.contract-runner"') !== -1, 'metadata artifact contains runner id');
  r.assert(artifacts.metadata.indexOf('"actualPlatformExecutionClaimed":false') !== -1, 'metadata artifact does not claim execution');
  r.assert(artifacts.expected.indexOf('"canPassReleaseGateFromArtifactsOnly":false') !== -1, 'expected artifact keeps release gate blocked');
  r.assert(artifacts.matrix.indexOf('"platform_execution_not_claimed"') !== -1, 'matrix artifact records no-execution case');
  r.assert(artifacts.regressionResult.indexOf('"platformRuntimeSmokeExecuted":false') !== -1, 'regression artifact records no runtime smoke');

  return r;
}

function hasArtifact(artifacts: EvidenceArtifactName[], artifact: EvidenceArtifactName): boolean {
  return artifacts.indexOf(artifact) !== -1;
}

function hasKind(kinds: AdapterKind[], kind: AdapterKind): boolean {
  return kinds.indexOf(kind) !== -1;
}

function hasRuntimeId(ids: RuntimeEvidenceId[], id: RuntimeEvidenceId): boolean {
  return ids.indexOf(id) !== -1;
}

function hasUnsupportedMarker(report: HarmonyOSAdapterContractReport, marker: string): boolean {
  for (let i = 0; i < report.unsupportedReaderMarkers.length; i++) {
    const item = report.unsupportedReaderMarkers[i];
    if (item.marker === marker && item.status === EvidenceStatus.unsupported) {
      return true;
    }
  }
  return false;
}
