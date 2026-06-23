// HarmonyOSAdapterContractReport - host-owned Reader-Core platform evidence descriptor.
// CONTRACT_ONLY until hvigor/device smoke writes real metadata/expected/matrix/regressionResult artifacts.

export const HARMONYOS_PLATFORM_FAMILY = 'HarmonyOS';
export const HARMONYOS_ADAPTER_CONTRACT_RUNNER = 'reader-core.harmonyos.adapter.contract-runner';

export enum AdapterKind {
  archive = 'archive',
  localFileAccess = 'localFileAccess',
  markupParser = 'markupParser',
  feedParser = 'feedParser',
  textEncodingDetector = 'textEncodingDetector',
  runtimeHost = 'runtimeHost'
}

export enum EvidenceArtifactName {
  metadata = 'metadata',
  expected = 'expected',
  matrix = 'matrix',
  regressionResult = 'regressionResult'
}

export enum EvidenceStatus {
  contractOnly = 'CONTRACT_ONLY',
  notExecuted = 'NOT_EXECUTED',
  unsupported = 'UNSUPPORTED'
}

export enum RuntimeEvidenceId {
  credentialRedactionRevocationMatrix = 'credential_redaction_revocation_matrix',
  productGatedJsBridgeReleaseRunner = 'product_gated_js_bridge_release_runner',
  runtimeRollbackAudit = 'runtime_rollback_audit',
  secureStoragePlatformAudit = 'secure_storage_platform_audit',
  sessionCookieLoginPlatformRunner = 'session_cookie_login_platform_runner',
  webviewCookieMirrorAudit = 'webview_cookie_mirror_audit',
  webviewDomPlatformSmokeRunner = 'webview_dom_platform_smoke_runner'
}

export interface EvidenceArtifactDescriptor {
  name: EvidenceArtifactName;
  required: boolean;
  containsPrivateContent: boolean;
  containsRawCookieValue: boolean;
  containsRawCredentialValue: boolean;
}

export interface AdapterEvidenceDescriptor {
  kind: AdapterKind;
  status: EvidenceStatus;
  platformOwned: boolean;
  coreOwned: boolean;
  requiredArtifacts: EvidenceArtifactName[];
  evidenceSummary: string;
}

export interface RuntimeEvidenceDescriptor {
  id: RuntimeEvidenceId;
  status: EvidenceStatus;
  actualPlatformExecutionClaimed: boolean;
  requiredBeforeRelease: boolean;
  redactsCookieValues: boolean;
  redactsCredentialValues: boolean;
  redactsSessionTokens: boolean;
  summary: string;
}

export interface SecureStorageCookieSessionEvidence {
  gap: string;
  platformOwned: boolean;
  coreOwned: boolean;
  rawCookieValuesExported: boolean;
  rawCredentialValuesExported: boolean;
  rawSessionTokensExported: boolean;
  permissionTokenValuesExported: boolean;
  secureStorageBackend: string;
  cookieSessionBoundary: string;
  runtimeEvidenceIds: RuntimeEvidenceId[];
}

export interface UnsupportedReaderMarker {
  marker: string;
  status: EvidenceStatus;
  reason: string;
}

export interface HarmonyOSAdapterContractReport {
  platformFamily: string;
  runnerIdentifier: string;
  generatedBy: string;
  status: EvidenceStatus;
  actualPlatformExecutionClaimed: boolean;
  cleanRoomStatement: string;
  requiredEvidenceArtifacts: EvidenceArtifactDescriptor[];
  adapters: AdapterEvidenceDescriptor[];
  secureStorageCookieSession: SecureStorageCookieSessionEvidence;
  runtimeEvidence: RuntimeEvidenceDescriptor[];
  unsupportedReaderMarkers: UnsupportedReaderMarker[];
}

export function requiredEvidenceArtifactNames(): EvidenceArtifactName[] {
  return [
    EvidenceArtifactName.metadata,
    EvidenceArtifactName.expected,
    EvidenceArtifactName.matrix,
    EvidenceArtifactName.regressionResult
  ];
}

export function adapterKinds(): AdapterKind[] {
  return [
    AdapterKind.archive,
    AdapterKind.localFileAccess,
    AdapterKind.markupParser,
    AdapterKind.feedParser,
    AdapterKind.textEncodingDetector,
    AdapterKind.runtimeHost
  ];
}

export function runtimeEvidenceIds(): RuntimeEvidenceId[] {
  return [
    RuntimeEvidenceId.credentialRedactionRevocationMatrix,
    RuntimeEvidenceId.productGatedJsBridgeReleaseRunner,
    RuntimeEvidenceId.runtimeRollbackAudit,
    RuntimeEvidenceId.secureStoragePlatformAudit,
    RuntimeEvidenceId.sessionCookieLoginPlatformRunner,
    RuntimeEvidenceId.webviewCookieMirrorAudit,
    RuntimeEvidenceId.webviewDomPlatformSmokeRunner
  ];
}

export function unsupportedReaderMarkers(): UnsupportedReaderMarker[] {
  return [
    {
      marker: 'harmonyos.reader.readium-equivalent',
      status: EvidenceStatus.unsupported,
      reason: 'Readium-equivalent reader behavior is not implemented in the HarmonyOS host.'
    },
    {
      marker: 'harmonyos.reader.full-epub-shell',
      status: EvidenceStatus.unsupported,
      reason: 'Full EPUB reader shell support has no host implementation or smoke evidence.'
    },
    {
      marker: 'harmonyos.reader.pdf',
      status: EvidenceStatus.unsupported,
      reason: 'PDF reader support has no host implementation or smoke evidence.'
    },
    {
      marker: 'harmonyos.reader.cbz',
      status: EvidenceStatus.unsupported,
      reason: 'CBZ archive reader support has no host implementation or smoke evidence.'
    },
    {
      marker: 'harmonyos.sync.legado-equivalent',
      status: EvidenceStatus.unsupported,
      reason: 'Legado-equivalent sync behavior is outside the HarmonyOS MVP adapter scope.'
    }
  ];
}

export function createHarmonyOSAdapterContractReport(): HarmonyOSAdapterContractReport {
  const artifactNames = requiredEvidenceArtifactNames();

  return {
    platformFamily: HARMONYOS_PLATFORM_FAMILY,
    runnerIdentifier: HARMONYOS_ADAPTER_CONTRACT_RUNNER,
    generatedBy: 'HarmonyOSAdapterContractReport.ets',
    status: EvidenceStatus.contractOnly,
    actualPlatformExecutionClaimed: false,
    cleanRoomStatement: 'HarmonyOS host descriptor only; no external GPL implementation code copied, translated, or adapted.',
    requiredEvidenceArtifacts: createRequiredArtifacts(artifactNames),
    adapters: createAdapterDescriptors(artifactNames),
    secureStorageCookieSession: createSecureStorageCookieSessionEvidence(),
    runtimeEvidence: createRuntimeEvidenceDescriptors(),
    unsupportedReaderMarkers: unsupportedReaderMarkers()
  };
}

export function exportHarmonyOSAdapterContractReport(report?: HarmonyOSAdapterContractReport): string {
  const resolvedReport = report ?? createHarmonyOSAdapterContractReport();
  return JSON.stringify(resolvedReport);
}

function createRequiredArtifacts(names: EvidenceArtifactName[]): EvidenceArtifactDescriptor[] {
  const artifacts: EvidenceArtifactDescriptor[] = [];
  for (let i = 0; i < names.length; i++) {
    artifacts.push({
      name: names[i],
      required: true,
      containsPrivateContent: false,
      containsRawCookieValue: false,
      containsRawCredentialValue: false
    });
  }
  return artifacts;
}

function createAdapterDescriptors(requiredArtifacts: EvidenceArtifactName[]): AdapterEvidenceDescriptor[] {
  return [
    {
      kind: AdapterKind.archive,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host archive descriptor only; no ZIP/CBZ/PDF execution is claimed.'
    },
    {
      kind: AdapterKind.localFileAccess,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host file picker and permission-token handoff descriptor; token values must not be exported.'
    },
    {
      kind: AdapterKind.markupParser,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host markup parser evidence descriptor only; parser execution evidence is still pending.'
    },
    {
      kind: AdapterKind.feedParser,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host feed parser evidence descriptor only; network/feed execution evidence is still pending.'
    },
    {
      kind: AdapterKind.textEncodingDetector,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host TXT detector policy descriptor only; cross-runtime regression evidence is still pending.'
    },
    {
      kind: AdapterKind.runtimeHost,
      status: EvidenceStatus.contractOnly,
      platformOwned: true,
      coreOwned: false,
      requiredArtifacts,
      evidenceSummary: 'Host ArkWeb/nativeHTTP/secure-storage/cookie/session descriptor; runtime smoke is not claimed.'
    }
  ];
}

function createSecureStorageCookieSessionEvidence(): SecureStorageCookieSessionEvidence {
  return {
    gap: 'S9',
    platformOwned: true,
    coreOwned: false,
    rawCookieValuesExported: false,
    rawCredentialValuesExported: false,
    rawSessionTokensExported: false,
    permissionTokenValuesExported: false,
    secureStorageBackend: 'HOST_SECURE_STORAGE_REQUIRED',
    cookieSessionBoundary: 'REPORT_METADATA_ONLY_NO_RAW_COOKIE_OR_SESSION_VALUE',
    runtimeEvidenceIds: [
      RuntimeEvidenceId.credentialRedactionRevocationMatrix,
      RuntimeEvidenceId.secureStoragePlatformAudit,
      RuntimeEvidenceId.sessionCookieLoginPlatformRunner,
      RuntimeEvidenceId.webviewCookieMirrorAudit
    ]
  };
}

function createRuntimeEvidenceDescriptors(): RuntimeEvidenceDescriptor[] {
  const ids = runtimeEvidenceIds();
  const descriptors: RuntimeEvidenceDescriptor[] = [];
  for (let i = 0; i < ids.length; i++) {
    descriptors.push({
      id: ids[i],
      status: EvidenceStatus.notExecuted,
      actualPlatformExecutionClaimed: false,
      requiredBeforeRelease: true,
      redactsCookieValues: true,
      redactsCredentialValues: true,
      redactsSessionTokens: true,
      summary: 'Runtime CI evidence id reserved for HarmonyOS host smoke export; no platform execution claimed by this contract descriptor.'
    });
  }
  return descriptors;
}
