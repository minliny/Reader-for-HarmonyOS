// CoreAdapterFirstBatchEvidenceValidator - validates first measured HarmonyOS adapter evidence artifacts.

import { AdapterKind } from '../coreAdapter/HarmonyOSAdapterContractReport';
import {
  CoreCaseStatus,
  FirstBatchEvidenceBundle,
  LocalEvidenceStatus,
  buildHarmonyOSFirstBatchArtifactSet,
  buildHarmonyOSFirstBatchEvidenceBundle,
  harmonyOSFirstBatchSampleId,
  validateHarmonyOSFirstBatchArtifactSet
} from '../coreAdapter/HarmonyOSFirstBatchEvidenceRunner';
import {
  harmonyOSRequiredCaseCount,
  harmonyOSRequiredRuntimeEvidenceIDs,
  harmonyOSUnsupportedCapabilityIDs
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

export function runCoreAdapterFirstBatchEvidenceTests(): TestRunner {
  const r = new TestRunner();
  const bundle = buildHarmonyOSFirstBatchEvidenceBundle('local-validation-commit', 'local-validation-job', 'local-validation-artifact');

  r.assert(bundle.sampleId === harmonyOSFirstBatchSampleId(), 'first batch sample id is stable');
  r.assert(bundle.platformFamily === 'HarmonyOS', 'platform family is HarmonyOS');
  r.assert(bundle.runnerIdentifier === 'reader-core.harmonyos.adapter.contract-runner', 'runner identifier matches Core manifest');
  r.assert(bundle.caseBundle.caseVectors.length === harmonyOSRequiredCaseCount(), 'case bundle covers every Core manifest feature');
  r.assert(bundle.runReport.caseResults.length === bundle.caseBundle.caseVectors.length, 'run report has one result per case vector');
  r.assert(bundle.executedCaseIDs.length === bundle.caseBundle.caseVectors.length, 'executed case ids mirror exported case vectors');
  r.assert(bundle.externalNetworkUsed === false, 'external network remains disabled');
  r.assert(bundle.cleanRoomMaintained === true, 'clean-room flag is true');
  r.assert(bundle.externalGPLCodeCopied === false, 'external GPL copied flag is false');
  r.assert(bundle.legadoSourceCopied === false, 'Legado copied flag is false');

  r.assert(hasLocalStatus(bundle, AdapterKind.feedParser, 'rss', LocalEvidenceStatus.measuredPass), 'RSS fixture evidence measured');
  r.assert(hasLocalStatus(bundle, AdapterKind.feedParser, 'atom', LocalEvidenceStatus.measuredPass), 'Atom fixture evidence measured');
  r.assert(hasLocalStatus(bundle, AdapterKind.feedParser, 'json-feed', LocalEvidenceStatus.measuredPass), 'JSON Feed fixture evidence measured');
  r.assert(hasCoreStatus(bundle, AdapterKind.feedParser, 'cookie-login-diagnostic', CoreCaseStatus.passed), 'cookie/login feed diagnostic passes without runtime execution');
  r.assert(bundle.canEnterFeedParserPlatformGate === true, 'feed parser platform gate can pass from local fixtures');

  r.assert(hasLocalStatus(bundle, AdapterKind.textEncodingDetector, 'txt.bom', LocalEvidenceStatus.measuredPass), 'TXT BOM detector evidence measured');
  r.assert(hasLocalStatus(bundle, AdapterKind.textEncodingDetector, 'txt.utf8', LocalEvidenceStatus.measuredPass), 'TXT UTF-8 detector evidence measured');
  r.assert(hasLocalStatus(bundle, AdapterKind.textEncodingDetector, 'txt.gb18030', LocalEvidenceStatus.measuredPass), 'TXT GB18030 detector evidence measured');
  r.assert(hasLocalStatus(bundle, AdapterKind.textEncodingDetector, 'txt.fallback', LocalEvidenceStatus.measuredPass), 'TXT fallback detector evidence measured');

  r.assert(hasCoreStatus(bundle, AdapterKind.archive, 'epub.zip', CoreCaseStatus.failed), 'archive stays non-passing until real adapter exists');
  r.assert(hasCoreStatus(bundle, AdapterKind.localFileAccess, 'permission-token', CoreCaseStatus.failed), 'file permission token stays non-passing until host picker smoke exists');
  r.assert(hasLocalStatus(bundle, AdapterKind.runtimeHost, 'arkWeb', LocalEvidenceStatus.envBlocked), 'ArkWeb case is ENV_BLOCKED, not passed');
  r.assert(hasLocalStatus(bundle, AdapterKind.runtimeHost, 'nativeHTTP', LocalEvidenceStatus.envBlocked), 'native HTTP case is ENV_BLOCKED until runtime request execution');
  r.assert(hasLocalStatus(bundle, AdapterKind.runtimeHost, 'cookieStore', LocalEvidenceStatus.envBlocked), 'cookie mirror case is ENV_BLOCKED until ArkWeb store execution');
  r.assert(bundle.canEnterPlatformEvidenceGate === false, 'first batch does not pass whole Core platform evidence gate');
  r.assert(bundle.canEnterLocalBookPlatformGate === false, 'local-book gate stays blocked by archive/file-picker gaps');
  r.assert(bundle.canEnterPlatformRuntimeCIGate === false, 'runtime CI gate stays blocked by ArkWeb/session gaps');
  r.assert(bundle.canEnterHostAppSmokeGate === false, 'host app smoke gate stays blocked');

  const runtimeEvidence = harmonyOSRequiredRuntimeEvidenceIDs();
  r.assert(runtimeEvidence.length === 7, 'seven runtime evidence IDs are required');
  r.assert(runtimeEvidence.indexOf('webview_dom_platform_smoke_runner') !== -1, 'WebView DOM runtime ID is required');
  r.assert(runtimeEvidence.indexOf('webview_cookie_mirror_audit') !== -1, 'WebView cookie mirror runtime ID is required');
  r.assert(harmonyOSUnsupportedCapabilityIDs().length === 5, 'all Core HarmonyOS unsupported markers are mirrored');

  const artifacts = buildHarmonyOSFirstBatchArtifactSet(bundle);
  const validation = validateHarmonyOSFirstBatchArtifactSet(artifacts);
  r.assert(validation.artifactCount === 10, 'first batch emits ten artifacts');
  r.assert(validation.allRequiredArtifactsPresent === true, 'metadata expected matrix regression artifacts are present');
  r.assert(validation.unsafeContentFound === false, 'artifacts contain no unsafe material');
  r.assert(validation.measuredPassCount >= 9, 'measured local fixture evidence count is nonzero');
  r.assert(validation.envBlockedCount >= 3, 'environment blocked runtime cases are preserved');
  r.assert(validation.acceptedByCoreRunReport === false, 'validation preserves non-accepted run report status');
  r.assert(validation.externalNetworkUsed === false, 'validation confirms no external network use');

  r.assert(artifacts.platformAdapterContractRunReport.indexOf('"status":"failed"') !== -1, 'run report records failed required cases');
  r.assert(artifacts.feedParserPlatformExecution.indexOf('"canEnterRSSPlatformAdapterEvidenceGate":true') !== -1, 'feed artifact records gate pass');
  r.assert(artifacts.platformRuntimeCI.indexOf('"missingRuntimeEvidenceIDs"') !== -1, 'runtime CI artifact records missing IDs');
  r.assert(artifacts.hostAppIntegrationSmokeReport.indexOf('"canEnterHostAppEvidenceGate":false') !== -1, 'host smoke artifact stays blocked');

  return r;
}

function hasLocalStatus(bundle: FirstBatchEvidenceBundle, kind: AdapterKind, featureID: string, status: LocalEvidenceStatus): boolean {
  for (let i = 0; i < bundle.localEvidence.length; i++) {
    const evidence = bundle.localEvidence[i];
    if (evidence.kind === kind && evidence.featureID === featureID && evidence.localStatus === status) {
      return true;
    }
  }
  return false;
}

function hasCoreStatus(bundle: FirstBatchEvidenceBundle, kind: AdapterKind, featureID: string, status: CoreCaseStatus): boolean {
  for (let i = 0; i < bundle.runReport.caseResults.length; i++) {
    const result = bundle.runReport.caseResults[i];
    if (result.kind === kind && result.featureID === featureID && result.status === status) {
      return true;
    }
  }
  return false;
}
