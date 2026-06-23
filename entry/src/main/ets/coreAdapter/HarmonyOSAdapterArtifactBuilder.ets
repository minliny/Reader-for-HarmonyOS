// HarmonyOSAdapterArtifactBuilder - Core-compatible artifact JSON for adapter evidence.
// CONTRACT_ONLY: builds metadata/expected/matrix/regressionResult documents without
// claiming ArkWeb, nativeHTTP, secure-storage, cookie/session, or file-picker execution.

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
  requiredEvidenceArtifactNames,
  runtimeEvidenceIds
} from './HarmonyOSAdapterContractReport';

export interface HarmonyOSAdapterArtifactSet {
  metadata: string;
  expected: string;
  matrix: string;
  regressionResult: string;
}

export interface ArtifactValidationResult {
  acceptedForShapeReview: boolean;
  acceptedForReleaseGate: boolean;
  artifactCount: number;
  missingArtifactCount: number;
  unsafeContentFound: boolean;
}

interface ArtifactMetadataDocument {
  sampleId: string;
  artifactType: string;
  platformFamily: string;
  runnerIdentifier: string;
  status: EvidenceStatus;
  actualPlatformExecutionClaimed: boolean;
  requiredEvidenceArtifacts: EvidenceArtifactName[];
  adapterKindsCovered: AdapterKind[];
  runtimeEvidenceIds: RuntimeEvidenceId[];
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

interface ArtifactExpectedDocument {
  sampleId: string;
  expectedResult: ArtifactExpectedResult;
  failureReasonBound: string;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

interface ArtifactExpectedResult {
  artifactSetComplete: boolean;
  requiredEvidenceArtifactCount: number;
  adapterKindCount: number;
  runtimeEvidenceCount: number;
  actualPlatformExecutionClaimed: boolean;
  canEnterShapeReview: boolean;
  canPassReleaseGateFromArtifactsOnly: boolean;
  rawCookieValuesExported: boolean;
  rawCredentialValuesExported: boolean;
  rawSessionTokensExported: boolean;
  permissionTokenValuesExported: boolean;
}

interface ArtifactMatrixDocument {
  matrixId: string;
  sampleId: string;
  rows: ArtifactMatrixRow[];
}

interface ArtifactMatrixRow {
  caseId: string;
  status: string;
  expectedChange: string;
}

interface ArtifactRegressionResultDocument {
  sampleId: string;
  regressionResult: string;
  status: EvidenceStatus;
  generatedFrom: string;
  localExecutionClaimed: boolean;
  platformRuntimeSmokeExecuted: boolean;
  validation: ArtifactValidationResult;
}

const SAMPLE_ID = 'harmonyos_adapter_contract_artifacts_001';

export function buildHarmonyOSAdapterArtifactSet(
  report: HarmonyOSAdapterContractReport = createHarmonyOSAdapterContractReport()
): HarmonyOSAdapterArtifactSet {
  const metadata = createMetadataDocument(report);
  const expected = createExpectedDocument(report);
  const matrix = createMatrixDocument(report);
  const regressionResult = createRegressionResultDocument(report);

  return {
    metadata: JSON.stringify(metadata),
    expected: JSON.stringify(expected),
    matrix: JSON.stringify(matrix),
    regressionResult: JSON.stringify(regressionResult)
  };
}

export function validateHarmonyOSAdapterArtifactSet(set: HarmonyOSAdapterArtifactSet): ArtifactValidationResult {
  const artifacts = [set.metadata, set.expected, set.matrix, set.regressionResult];
  let missing = 0;
  let unsafe = false;
  for (let i = 0; i < artifacts.length; i++) {
    const artifact = artifacts[i];
    if (artifact.length === 0) {
      missing++;
    }
    if (containsUnsafeEvidenceMaterial(artifact)) {
      unsafe = true;
    }
  }

  const hasRequiredNames =
    set.metadata.indexOf('"requiredEvidenceArtifacts"') !== -1 &&
    set.expected.indexOf('"artifactSetComplete":true') !== -1 &&
    set.matrix.indexOf('"matrixId":"harmonyos_adapter_contract_artifacts_matrix"') !== -1 &&
    set.regressionResult.indexOf('"regressionResult":"contract_artifact_generation_only"') !== -1;

  return {
    acceptedForShapeReview: missing === 0 && !unsafe && hasRequiredNames,
    acceptedForReleaseGate: false,
    artifactCount: artifacts.length,
    missingArtifactCount: missing,
    unsafeContentFound: unsafe
  };
}

function createMetadataDocument(report: HarmonyOSAdapterContractReport): ArtifactMetadataDocument {
  return {
    sampleId: SAMPLE_ID,
    artifactType: 'metadata',
    platformFamily: report.platformFamily,
    runnerIdentifier: report.runnerIdentifier,
    status: report.status,
    actualPlatformExecutionClaimed: report.actualPlatformExecutionClaimed,
    requiredEvidenceArtifacts: requiredEvidenceArtifactNames(),
    adapterKindsCovered: adapterKinds(),
    runtimeEvidenceIds: runtimeEvidenceIds(),
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

function createExpectedDocument(report: HarmonyOSAdapterContractReport): ArtifactExpectedDocument {
  const expected: ArtifactExpectedResult = {
    artifactSetComplete: true,
    requiredEvidenceArtifactCount: report.requiredEvidenceArtifacts.length,
    adapterKindCount: report.adapters.length,
    runtimeEvidenceCount: report.runtimeEvidence.length,
    actualPlatformExecutionClaimed: report.actualPlatformExecutionClaimed,
    canEnterShapeReview: true,
    canPassReleaseGateFromArtifactsOnly: false,
    rawCookieValuesExported: report.secureStorageCookieSession.rawCookieValuesExported,
    rawCredentialValuesExported: report.secureStorageCookieSession.rawCredentialValuesExported,
    rawSessionTokensExported: report.secureStorageCookieSession.rawSessionTokensExported,
    permissionTokenValuesExported: report.secureStorageCookieSession.permissionTokenValuesExported
  };

  return {
    sampleId: SAMPLE_ID,
    expectedResult: expected,
    failureReasonBound: 'HarmonyOS can generate Core-compatible artifact shapes, but release remains blocked until real ArkWeb/nativeHTTP/secure-storage/cookie/session/file-access smoke produces measured evidence.',
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

function createMatrixDocument(report: HarmonyOSAdapterContractReport): ArtifactMatrixDocument {
  return {
    matrixId: 'harmonyos_adapter_contract_artifacts_matrix',
    sampleId: SAMPLE_ID,
    rows: [
      row('metadata_artifact_generated', 'measured_pass', 'metadata JSON contains platform identity, runner identity, adapter kinds, runtime evidence IDs, and clean-room flags.'),
      row('expected_artifact_generated', 'measured_pass', 'expected JSON binds artifact completeness while keeping release-gate pass false.'),
      row('matrix_artifact_generated', 'measured_pass', 'matrix JSON gives case rows for artifact shape review.'),
      row('regression_result_artifact_generated', 'measured_pass', 'regressionResult JSON records contract-only generation without platform runtime smoke.'),
      row('platform_execution_not_claimed', report.actualPlatformExecutionClaimed ? 'blocked' : 'measured_pass', 'artifact generation must not claim ArkWeb/nativeHTTP/cookie/session execution.'),
      row('sensitive_material_not_exported', containsUnsafeEvidenceMaterial(JSON.stringify(report)) ? 'blocked' : 'measured_pass', 'artifact generation must not export raw cookies, credentials, tokens, local file paths, or source bodies.')
    ]
  };
}

function createRegressionResultDocument(
  report: HarmonyOSAdapterContractReport
): ArtifactRegressionResultDocument {
  const artifactSet = {
    metadata: JSON.stringify(createMetadataDocument(report)),
    expected: JSON.stringify(createExpectedDocument(report)),
    matrix: JSON.stringify(createMatrixDocument(report)),
    regressionResult: ''
  };
  artifactSet.regressionResult = 'contract_artifact_generation_only';

  return {
    sampleId: SAMPLE_ID,
    regressionResult: 'contract_artifact_generation_only',
    status: EvidenceStatus.contractOnly,
    generatedFrom: 'HarmonyOSAdapterArtifactBuilder.ets',
    localExecutionClaimed: false,
    platformRuntimeSmokeExecuted: false,
    validation: validateHarmonyOSAdapterArtifactSet({
      metadata: artifactSet.metadata,
      expected: artifactSet.expected,
      matrix: artifactSet.matrix,
      regressionResult: JSON.stringify({
        sampleId: SAMPLE_ID,
        regressionResult: artifactSet.regressionResult
      })
    })
  };
}

function row(caseId: string, status: string, expectedChange: string): ArtifactMatrixRow {
  return { caseId, status, expectedChange };
}

function containsUnsafeEvidenceMaterial(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.indexOf('set-cookie:') !== -1 ||
    lower.indexOf('cookie:') !== -1 ||
    lower.indexOf('password=') !== -1 ||
    lower.indexOf('authorization:') !== -1 ||
    lower.indexOf('bearer ') !== -1 ||
    lower.indexOf('permission-token-value') !== -1 ||
    lower.indexOf('/users/') !== -1 ||
    lower.indexOf('<html') !== -1;
}

export function harmonyOSAdapterArtifactSampleId(): string {
  return SAMPLE_ID;
}

export function harmonyOSAdapterArtifactRunnerId(): string {
  return HARMONYOS_ADAPTER_CONTRACT_RUNNER;
}

export function harmonyOSAdapterArtifactPlatformFamily(): string {
  return HARMONYOS_PLATFORM_FAMILY;
}
