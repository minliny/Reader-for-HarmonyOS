// ExternalClosureModels - device/corpus/release closure evidence contracts.

export enum ExternalClosureStatus {
  measuredPass = 'MEASURED_PASS',
  readyNotExecuted = 'READY_NOT_EXECUTED',
  blockedByProvisioning = 'BLOCKED_BY_PROVISIONING',
  externalRequired = 'EXTERNAL_REQUIRED'
}

export interface ExternalClosureEvidenceRow {
  id: string;
  status: ExternalClosureStatus;
  domain: string;
  evidenceId: string;
  checksum: string;
  redactedSummary: string;
  canExecuteNow: boolean;
  requiresDeviceExecutor: boolean;
  requiresExternalNetwork: boolean;
  requiresProductGovernance: boolean;
  rawURLExported: boolean;
  rawCookieValueExported: boolean;
  rawCredentialValueExported: boolean;
  rawResponseBodyExported: boolean;
  readerCoreRootArtifactsMutated: boolean;
}

export interface DeviceProvisioningAudit {
  hdcBinaryPresent: boolean;
  emulatorBinaryPresent: boolean;
  devEcoStudioPresent: boolean;
  hdcTargetsEmpty: boolean;
  deviceManagerConfigPresent: boolean;
  emulatorInstanceConfigPresent: boolean;
  canStartDeviceExecutor: boolean;
  blocker: string;
  observedCommandCount: number;
  redactedAuditEntry: string;
  checksum: string;
}

export interface AuthorizedCorpusTargetDescriptor {
  targetId: string;
  kind: string;
  hostHash: string;
  requiresLogin: boolean;
  requiresCookieMirror: boolean;
  allowedByUser: boolean;
  rawURLExported: boolean;
}

export interface AuthorizedCorpusRunnerPreflight {
  runnerReady: boolean;
  targetCount: number;
  allTargetsAuthorized: boolean;
  redactedOnly: boolean;
  failureTaxonomyBound: boolean;
  sourceBackedDiffReady: boolean;
  canExecuteWhenNetworkAvailable: boolean;
  executedTargetCount: number;
  externalNetworkUsed: boolean;
  targets: AuthorizedCorpusTargetDescriptor[];
  checksum: string;
}

export interface AuthorizedCorpusLiveExecutionEvidence {
  executedTargetCount: number;
  fullChainPassed: boolean;
  searchResultCount: number;
  externalNetworkUsed: boolean;
  redactedOnly: boolean;
  rawURLExported: boolean;
  rawResponseBodyExported: boolean;
  rawCredentialValueExported: boolean;
  hostHashCount: number;
  checksum: string;
}

export interface RuntimeDeviceRunnerPreflight {
  arkWebRunnerReady: boolean;
  jsEvalRunnerReady: boolean;
  nativeHTTPRunnerReady: boolean;
  cookieMirrorRunnerReady: boolean;
  sessionLoginRunnerReady: boolean;
  secureStorageRunnerReady: boolean;
  runtimeRollbackRunnerReady: boolean;
  deviceExecutorUsed: boolean;
  canExecuteAfterProvisioning: boolean;
  suppliedRuntimeEvidenceIDs: string[];
  checksum: string;
}

export interface SecureStorageEntitlementEvidence {
  huksKitBound: boolean;
  keyGenerateRunnerBound: boolean;
  keyExistRunnerBound: boolean;
  rawExportDenialBound: boolean;
  keyDeleteRunnerBound: boolean;
  rawCredentialValueExported: boolean;
  rawKeyMaterialExported: boolean;
  devicePanelEvidenceId: string;
  checksum: string;
}

export interface ReleaseGovernancePreflight {
  evidenceIntakeReady: boolean;
  productApprovalPacketReady: boolean;
  candidateRootGateExportReady: boolean;
  manualApplicationVerificationReady: boolean;
  finalConsistencyAuditReady: boolean;
  canMutateProductionReleaseGate: boolean;
  requiresHumanApproval: boolean;
  requiredEvidenceIdCount: number;
  approvedEvidenceIdCount: number;
  checksum: string;
}

export interface ExternalClosureEvidenceBundle {
  sampleId: string;
  rows: ExternalClosureEvidenceRow[];
  deviceProvisioningAudit: DeviceProvisioningAudit;
  authorizedCorpusPreflight: AuthorizedCorpusRunnerPreflight;
  authorizedCorpusLiveExecutionEvidence: AuthorizedCorpusLiveExecutionEvidence;
  runtimeDeviceRunnerPreflight: RuntimeDeviceRunnerPreflight;
  secureStorageEntitlementEvidence: SecureStorageEntitlementEvidence;
  releaseGovernancePreflight: ReleaseGovernancePreflight;
  canEnterAuthorizedCorpusGate: boolean;
  canEnterReleaseGovernanceGate: boolean;
  canEnterDeviceRuntimeGate: boolean;
  canMutateReaderCoreProductionReleaseGate: boolean;
  readerCoreRootArtifactsMutated: boolean;
  externalNetworkUsed: boolean;
  deviceExecutorUsed: boolean;
  allRowsRedacted: boolean;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}
