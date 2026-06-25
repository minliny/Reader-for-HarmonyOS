// HarmonyOSContractRunReportExporter - Phase 1 唯一验收口。
// 输出 Core 期望的统一 ReaderCorePlatformAdapterContractRunReport JSON，
// 并在导出前运行 fail-closed 校验。
//
// 对齐 Core: Sources/ReaderCoreProtocols/PlatformAdapterContracts.swift
//   - ReaderCorePlatformAdapterContractRunReport.canBeAcceptedByCoreGate
//   - ReaderCorePlatformAdapterContractManifest.harmonyOSReference
//
// HOS-ADR-001: localhost bridge 不计入本验收口；本验收口只接受 ArkTS runtime 证据。

import { AdapterKind, EvidenceArtifactName, HARMONYOS_ADAPTER_CONTRACT_RUNNER, HARMONYOS_PLATFORM_FAMILY } from './HarmonyOSAdapterContractReport';
import {
  CoreCaseResult,
  CoreCaseStatus,
  CoreRunReport
} from './HarmonyOSFirstBatchEvidenceRunner';
import {
  buildHarmonyOSCompleteArtifactSet,
  buildHarmonyOSCompleteEvidenceBundle,
  HarmonyOSCompleteArtifactSet,
  HarmonyOSCompleteEvidenceBundle
} from './HarmonyOSCompleteEvidenceRunner';

// MARK: - Core manifest reference (镜像 Core 端 harmonyOSReference，不得漂移)

export interface CoreManifestRequirement {
  kind: AdapterKind;
  requiredFeatureIDs: string[];
}

export interface CoreManifestReference {
  platformFamily: string;
  runnerIdentifier: string;
  requirements: CoreManifestRequirement[];
  requiredEvidenceArtifacts: EvidenceArtifactName[];
  hostOwnedCapabilityIDs: string[];
  unsupportedCapabilityIDs: string[];
}

export function coreHarmonyOSReferenceManifest(): CoreManifestReference {
  return {
    platformFamily: HARMONYOS_PLATFORM_FAMILY,
    runnerIdentifier: HARMONYOS_ADAPTER_CONTRACT_RUNNER,
    requirements: [
      {
        kind: AdapterKind.archive,
        requiredFeatureIDs: ['epub.zip', 'localbook.archive', 'safe-entry-path', 'opf-manifest-baseline']
      },
      {
        kind: AdapterKind.localFileAccess,
        requiredFeatureIDs: ['localbook.file-picker-handoff', 'permission-token', 'permission-denied-mapping']
      },
      {
        kind: AdapterKind.markupParser,
        requiredFeatureIDs: ['html.css', 'html.xpath', 'xml.xpath', 'attribute-extraction']
      },
      {
        kind: AdapterKind.feedParser,
        requiredFeatureIDs: ['rss', 'atom', 'json-feed', 'feed-pagination-metadata', 'cookie-login-diagnostic']
      },
      {
        kind: AdapterKind.textEncodingDetector,
        requiredFeatureIDs: ['txt.bom', 'txt.utf8', 'txt.gb18030', 'txt.fallback']
      },
      {
        kind: AdapterKind.runtimeHost,
        requiredFeatureIDs: ['arkWeb', 'nativeHTTP', 'cookieStore', 'sessionPersistence', 'javascript', 'snapshotWrite']
      }
    ],
    requiredEvidenceArtifacts: [
      EvidenceArtifactName.metadata,
      EvidenceArtifactName.expected,
      EvidenceArtifactName.matrix,
      EvidenceArtifactName.regressionResult
    ],
    hostOwnedCapabilityIDs: [
      'harmonyos.host.bookshelf',
      'harmonyos.host.reader-shell',
      'harmonyos.host.file-picker',
      'harmonyos.host.download-service',
      'harmonyos.host.tts',
      'harmonyos.host.notifications',
      'harmonyos.host.app-database'
    ],
    unsupportedCapabilityIDs: [
      'harmonyos.reader.readium-equivalent',
      'harmonyos.reader.full-epub-shell',
      'harmonyos.reader.pdf',
      'harmonyos.reader.cbz',
      'harmonyos.sync.legado-equivalent'
    ]
  };
}

// MARK: - Fail-closed 校验

export interface FailClosedViolation {
  code: string;
  detail: string;
}

export interface ContractRunReportValidation {
  accepted: boolean;
  violations: FailClosedViolation[];
  manifestMatchesRunner: boolean;
  missingArtifacts: string[];
  missingRequiredFeatures: string[];
  unsupportedDisguisedAsPass: string[];
  failedCaseCount: number;
  unsupportedRequiredCaseCount: number;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
  externalNetworkUsed: boolean;
  unsupportedCapabilityIDsPreserved: boolean;
}

// MARK: - 导出结果

export interface ContractRunReportExportResult {
  runReport: CoreRunReport;
  runReportJSON: string;
  artifacts: HarmonyOSCompleteArtifactSet;
  validation: ContractRunReportValidation;
  exportedAt: string;
  exporterIdentifier: string;
  manifestReference: CoreManifestReference;
}

const EXPORTER_IDENTIFIER = 'reader-core.harmonyos.adapter.contract-runner.exporter';
const REQUIRED_ARTIFACT_NAMES: string[] = ['metadata', 'expected', 'matrix', 'regressionResult'];

// MARK: - 主入口

export function exportHarmonyOSContractRunReport(
  bundle?: HarmonyOSCompleteEvidenceBundle
): ContractRunReportExportResult {
  const resolved = bundle ?? buildHarmonyOSCompleteEvidenceBundle();
  const artifacts = buildHarmonyOSCompleteArtifactSet(resolved);
  const manifest = coreHarmonyOSReferenceManifest();
  const validation = validateContractRunReportFailClosed(resolved.runReport, artifacts, manifest);

  return {
    runReport: resolved.runReport,
    runReportJSON: JSON.stringify(resolved.runReport),
    artifacts,
    validation,
    exportedAt: new Date().toISOString(),
    exporterIdentifier: EXPORTER_IDENTIFIER,
    manifestReference: manifest
  };
}

// MARK: - Fail-closed 校验器

export function validateContractRunReportFailClosed(
  runReport: CoreRunReport,
  artifacts: HarmonyOSCompleteArtifactSet,
  manifest: CoreManifestReference
): ContractRunReportValidation {
  const violations: FailClosedViolation[] = [];

  // 1. manifestMatchesRunner
  const manifestMatchesRunner =
    runReport.platformFamily === manifest.platformFamily &&
    runReport.runnerIdentifier === manifest.runnerIdentifier &&
    runReport.manifestPlatformFamily === manifest.platformFamily &&
    runReport.manifestRunnerIdentifier === manifest.runnerIdentifier;
  if (!manifestMatchesRunner) {
    violations.push({
      code: 'manifest_runner_mismatch',
      detail: `platformFamily=${runReport.platformFamily} runnerIdentifier=${runReport.runnerIdentifier} manifestPlatformFamily=${runReport.manifestPlatformFamily} manifestRunnerIdentifier=${runReport.manifestRunnerIdentifier}`
    });
  }

  // 2. evidenceArtifacts 完整性
  const missingArtifacts: string[] = [];
  const suppliedArtifacts = runReport.evidenceArtifacts.map((a: EvidenceArtifactName) => String(a));
  for (let i = 0; i < REQUIRED_ARTIFACT_NAMES.length; i++) {
    if (suppliedArtifacts.indexOf(REQUIRED_ARTIFACT_NAMES[i]) === -1) {
      missingArtifacts.push(REQUIRED_ARTIFACT_NAMES[i]);
    }
  }
  // 同时校验 artifact 字符串非空
  if (artifacts.metadata.length === 0) { missingArtifacts.push('metadata:empty'); }
  if (artifacts.expected.length === 0) { missingArtifacts.push('expected:empty'); }
  if (artifacts.matrix.length === 0) { missingArtifacts.push('matrix:empty'); }
  if (artifacts.regressionResult.length === 0) { missingArtifacts.push('regressionResult:empty'); }
  if (missingArtifacts.length > 0) {
    violations.push({
      code: 'missing_evidence_artifacts',
      detail: `missing=${missingArtifacts.join(',')}`
    });
  }

  // 3. missingRequiredFeatureIDs（对照 Core manifest harmonyOSReference）
  const missingRequiredFeatures = computeMissingRequiredFeatures(runReport, manifest);
  if (missingRequiredFeatures.length > 0) {
    violations.push({
      code: 'missing_required_features',
      detail: `missing=${missingRequiredFeatures.join(',')}`
    });
  }

  // 4. failedCaseCount == 0
  const failedCaseCount = countByStatus(runReport.caseResults, CoreCaseStatus.failed);
  if (failedCaseCount > 0) {
    violations.push({
      code: 'failed_cases_present',
      detail: `failedCaseCount=${failedCaseCount}`
    });
  }

  // 5. unsupportedRequiredCaseCount == 0
  //    required feature 的 case 不能是 unsupported（unsupported 只允许出现在 unsupportedCapabilityIDs）
  const unsupportedRequiredCaseCount = countUnsupportedRequired(runReport, manifest);
  if (unsupportedRequiredCaseCount > 0) {
    violations.push({
      code: 'unsupported_required_cases',
      detail: `unsupportedRequiredCaseCount=${unsupportedRequiredCaseCount}`
    });
  }

  // 6. unsupported 能力伪装成 pass 检测
  //    unsupportedCapabilityIDs 里的能力不得在 caseResults 里以 passed 出现
  const unsupportedDisguisedAsPass = detectUnsupportedDisguisedAsPass(runReport, manifest);
  if (unsupportedDisguisedAsPass.length > 0) {
    violations.push({
      code: 'unsupported_disguised_as_pass',
      detail: `features=${unsupportedDisguisedAsPass.join(',')}`
    });
  }

  // 7. unsupportedCapabilityIDs 保留
  const unsupportedCapabilityIDsPreserved =
    arraysEqualAsSets(runReport.unsupportedCapabilityIDs, manifest.unsupportedCapabilityIDs);
  if (!unsupportedCapabilityIDsPreserved) {
    violations.push({
      code: 'unsupported_capability_ids_drift',
      detail: `expected=${manifest.unsupportedCapabilityIDs.join(',')} actual=${runReport.unsupportedCapabilityIDs.join(',')}`
    });
  }

  // 8. clean room
  if (!runReport.cleanRoomMaintained) {
    violations.push({ code: 'clean_room_violation', detail: 'cleanRoomMaintained=false' });
  }
  if (runReport.externalGPLCodeCopied) {
    violations.push({ code: 'gpl_code_copied', detail: 'externalGPLCodeCopied=true' });
  }
  if (runReport.legadoSourceCopied) {
    violations.push({ code: 'legado_source_copied', detail: 'legadoSourceCopied=true' });
  }

  // 9. externalNetworkUsed — Core external execution gate 要求 false
  if (runReport.externalNetworkUsed) {
    violations.push({ code: 'external_network_used', detail: 'externalNetworkUsed=true' });
  }

  // 10. hostOwnedCapabilityIDs 保留
  if (!arraysEqualAsSets(runReport.hostOwnedCapabilityIDs, manifest.hostOwnedCapabilityIDs)) {
    violations.push({
      code: 'host_owned_capability_ids_drift',
      detail: `expected=${manifest.hostOwnedCapabilityIDs.join(',')} actual=${runReport.hostOwnedCapabilityIDs.join(',')}`
    });
  }

  // 11. caseResults 非空
  if (runReport.caseResults.length === 0) {
    violations.push({ code: 'empty_case_results', detail: 'caseResults is empty' });
  }

  // 12. unsafe content 检测（redaction）
  const unsafeFindings = detectUnsafeContent(runReport, artifacts);
  if (unsafeFindings.length > 0) {
    violations.push({
      code: 'unsafe_content_exported',
      detail: `findings=${unsafeFindings.join('|')}`
    });
  }

  const accepted = violations.length === 0;

  return {
    accepted,
    violations,
    manifestMatchesRunner,
    missingArtifacts,
    missingRequiredFeatures,
    unsupportedDisguisedAsPass,
    failedCaseCount,
    unsupportedRequiredCaseCount,
    cleanRoomMaintained: runReport.cleanRoomMaintained,
    externalGPLCodeCopied: runReport.externalGPLCodeCopied,
    legadoSourceCopied: runReport.legadoSourceCopied,
    externalNetworkUsed: runReport.externalNetworkUsed,
    unsupportedCapabilityIDsPreserved
  };
}

// MARK: - 校验辅助

function computeMissingRequiredFeatures(runReport: CoreRunReport, manifest: CoreManifestReference): string[] {
  const missing: string[] = [];
  for (let i = 0; i < manifest.requirements.length; i++) {
    const req = manifest.requirements[i];
    for (let j = 0; j < req.requiredFeatureIDs.length; j++) {
      const featureID = req.requiredFeatureIDs[j];
      if (!hasPassedFeature(runReport.caseResults, req.kind, featureID)) {
        missing.push(`${req.kind}:${featureID}`);
      }
    }
  }
  return missing;
}

function hasPassedFeature(results: CoreCaseResult[], kind: AdapterKind, featureID: string): boolean {
  for (let i = 0; i < results.length; i++) {
    if (results[i].kind === kind && results[i].featureID === featureID && results[i].status === CoreCaseStatus.passed) {
      return true;
    }
  }
  return false;
}

function countByStatus(results: CoreCaseResult[], status: CoreCaseStatus): number {
  let count = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === status) {
      count++;
    }
  }
  return count;
}

function countUnsupportedRequired(runReport: CoreRunReport, manifest: CoreManifestReference): number {
  let count = 0;
  for (let i = 0; i < manifest.requirements.length; i++) {
    const req = manifest.requirements[i];
    for (let j = 0; j < req.requiredFeatureIDs.length; j++) {
      const featureID = req.requiredFeatureIDs[j];
      for (let k = 0; k < runReport.caseResults.length; k++) {
        const r = runReport.caseResults[k];
        if (r.kind === req.kind && r.featureID === featureID && r.status === CoreCaseStatus.unsupported) {
          count++;
        }
      }
    }
  }
  return count;
}

function detectUnsupportedDisguisedAsPass(runReport: CoreRunReport, manifest: CoreManifestReference): string[] {
  const disguised: string[] = [];
  for (let i = 0; i < manifest.unsupportedCapabilityIDs.length; i++) {
    const marker = manifest.unsupportedCapabilityIDs[i];
    for (let j = 0; j < runReport.caseResults.length; j++) {
      const r = runReport.caseResults[j];
      if (r.status === CoreCaseStatus.passed) {
        const composite = `${r.kind}:${r.featureID}`;
        if (composite.indexOf(marker) !== -1 || r.featureID.indexOf(marker) !== -1) {
          disguised.push(`${marker}->${composite}`);
        }
      }
    }
  }
  return disguised;
}

function detectUnsafeContent(runReport: CoreRunReport, artifacts: HarmonyOSCompleteArtifactSet): string[] {
  const findings: string[] = [];
  const runReportSerialized = JSON.stringify(runReport);
  const blob = runReportSerialized + artifacts.metadata + artifacts.expected + artifacts.matrix + artifacts.regressionResult;
  const lower = blob.toLowerCase();
  const unsafeTokens = [
    'set-cookie:',
    'cookie: raw',
    'authorization:',
    'bearer ',
    'token=',
    'password',
    'secret',
    '/users/',
    '<html',
    '</html>',
    'permission-token-value',
    'http://localhost:8899',
    'localhost:8899'
  ];
  for (let i = 0; i < unsafeTokens.length; i++) {
    if (lower.indexOf(unsafeTokens[i]) !== -1) {
      findings.push(`token:${unsafeTokens[i]}`);
    }
  }
  return findings;
}

function arraysEqualAsSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set<string>();
  for (let i = 0; i < b.length; i++) {
    setB.add(b[i]);
  }
  for (let i = 0; i < a.length; i++) {
    if (!setB.has(a[i])) {
      return false;
    }
  }
  return true;
}

// runReportJSON 用于 unsafe content 检测的序列化（避免循环引用 runReport 对象）

// MARK: - 便捷导出

export function exportHarmonyOSContractRunReportJSON(bundle?: HarmonyOSCompleteEvidenceBundle): string {
  return exportHarmonyOSContractRunReport(bundle).runReportJSON;
}

export function isContractRunReportAccepted(bundle?: HarmonyOSCompleteEvidenceBundle): boolean {
  return exportHarmonyOSContractRunReport(bundle).validation.accepted;
}
