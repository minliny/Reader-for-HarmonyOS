// HarmonyOSReleaseGate - Phase 4 Release Gate 分档校验器。
// 三档: adapter_mvp / product_runtime / release_candidate
//
// 对齐 Core: harmonyos_release_source_binding_20260623_expected.json not-covered 项。
// HOS-ADR-001: HarmonyOS 证据可作为局部运行证明，但不能直接改 release gate。

import { HarmonyOSRuntimeKit, HarmonyOSRuntimeKitReport } from '../runtime/HarmonyOSRuntimeKit';
import { ContractRunReportExportResult, exportHarmonyOSContractRunReport } from '../coreAdapter/HarmonyOSContractRunReportExporter';

// MARK: - Gate 分档定义

export enum ReleaseGateTier {
  adapterMvp = 'adapter_mvp',
  productRuntime = 'product_runtime',
  releaseCandidate = 'release_candidate'
}

export interface ReleaseGateRequirement {
  id: string;
  description: string;
  required: boolean;
}

export interface ReleaseGateTierResult {
  tier: ReleaseGateTier;
  accepted: boolean;
  satisfied: string[];
  missing: string[];
  requirements: ReleaseGateRequirement[];
}

export interface ReleaseGateReport {
  adapterMvp: ReleaseGateTierResult;
  productRuntime: ReleaseGateTierResult;
  releaseCandidate: ReleaseGateTierResult;
  overallAccepted: boolean;
  canMutateProductionReleaseGate: boolean;
  readerCoreRootArtifactsMutated: boolean;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

// MARK: - Gate 要求定义

function adapterMvpRequirements(): ReleaseGateRequirement[] {
  return [
    { id: 'archive', description: 'archive adapter (epub.zip/localbook.archive/safe-entry-path/opf-manifest-baseline)', required: true },
    { id: 'localFileAccess', description: 'localFileAccess adapter (file-picker-handoff/permission-token/permission-denied-mapping)', required: true },
    { id: 'markupParser', description: 'markupParser adapter (html.css/html.xpath/xml.xpath/attribute-extraction)', required: true },
    { id: 'feedParser', description: 'feedParser adapter (rss/atom/json-feed/feed-pagination-metadata/cookie-login-diagnostic)', required: true },
    { id: 'textEncodingDetector', description: 'textEncodingDetector adapter (txt.bom/txt.utf8/txt.gb18030/txt.fallback)', required: true },
    { id: 'runtimeHost', description: 'runtimeHost adapter (arkWeb/nativeHTTP/cookieStore/sessionPersistence/javascript/snapshotWrite)', required: true },
    { id: 'contractRunReportAccepted', description: 'HarmonyOSContractRunReportExporter validation accepted', required: true },
    { id: 'cleanRoomMaintained', description: 'cleanRoomMaintained=true, externalGPLCodeCopied=false, legadoSourceCopied=false', required: true }
  ];
}

function productRuntimeRequirements(): ReleaseGateRequirement[] {
  return [
    ...adapterMvpRequirements(),
    { id: 'nativeHTTP.evidence', description: 'nativeHTTP device evidence (not fixture-only)', required: true },
    { id: 'arkWeb.evidence', description: 'ArkWeb device evidence', required: true },
    { id: 'cookie.session.evidence', description: 'cookie/session device evidence', required: true },
    { id: 'huks.evidence', description: 'HUKS/SecurityKit device evidence', required: true },
    { id: 'rdb.evidence', description: 'RDB/Preferences schema/migration device evidence', required: true },
    { id: 'webdav.evidence', description: 'WebDAV PROPFIND/GET/PUT/DELETE device evidence', required: true },
    { id: 'tts.evidence', description: 'TTS/audio device evidence', required: true },
    { id: 'runtimeKit.allStagesPassed', description: 'HarmonyOSRuntimeKit all stages passed', required: true }
  ];
}

function releaseCandidateRequirements(): ReleaseGateRequirement[] {
  return [
    ...productRuntimeRequirements(),
    { id: 'rollback', description: 'runtime_rollback_audit evidence', required: true },
    { id: 'credential.revocation', description: 'credential_redaction_revocation_matrix evidence', required: true },
    { id: 'network.hardening', description: 'network_transport_hardening_matrix evidence', required: true },
    { id: 'real.corpus.benchmark', description: 'release_real_corpus_benchmark_report evidence', required: true },
    { id: 'product.gated.js.bridge', description: 'product_gated_js_bridge_release_runner evidence', required: true }
  ];
}

// MARK: - Gate 校验器

export function evaluateReleaseGate(): ReleaseGateReport {
  const contractExport = exportHarmonyOSContractRunReport();
  const kit = new HarmonyOSRuntimeKit();
  const kitReport = kit.buildKitReport();

  const adapterMvp = evaluateAdapterMvp(contractExport, kitReport);
  const productRuntime = evaluateProductRuntime(contractExport, kitReport);
  const releaseCandidate = evaluateReleaseCandidate(contractExport, kitReport);

  return {
    adapterMvp,
    productRuntime,
    releaseCandidate,
    overallAccepted: adapterMvp.accepted,
    canMutateProductionReleaseGate: false,
    readerCoreRootArtifactsMutated: false,
    cleanRoomMaintained: contractExport.runReport.cleanRoomMaintained,
    externalGPLCodeCopied: contractExport.runReport.externalGPLCodeCopied,
    legadoSourceCopied: contractExport.runReport.legadoSourceCopied
  };
}

function evaluateAdapterMvp(
  contractExport: ContractRunReportExportResult,
  kitReport: HarmonyOSRuntimeKitReport
): ReleaseGateTierResult {
  const requirements = adapterMvpRequirements();
  const satisfied: string[] = [];
  const missing: string[] = [];

  // adapter MVP 要求：contract run report accepted + clean room
  if (contractExport.validation.accepted) {
    satisfied.push('contractRunReportAccepted');
  } else {
    missing.push('contractRunReportAccepted');
  }

  if (contractExport.runReport.cleanRoomMaintained && !contractExport.runReport.externalGPLCodeCopied && !contractExport.runReport.legadoSourceCopied) {
    satisfied.push('cleanRoomMaintained');
  } else {
    missing.push('cleanRoomMaintained');
  }

  // 检查 6 个 adapter kind 都有 passed case
  const adapterKinds = ['archive', 'localFileAccess', 'markupParser', 'feedParser', 'textEncodingDetector', 'runtimeHost'];
  for (let i = 0; i < adapterKinds.length; i++) {
    const kind = adapterKinds[i];
    const hasPass = contractExport.runReport.caseResults.some(
      c => c.kind === kind && c.status === 'passed'
    );
    if (hasPass) {
      satisfied.push(kind);
    } else {
      missing.push(kind);
    }
  }

  const accepted = missing.length === 0;
  return { tier: ReleaseGateTier.adapterMvp, accepted, satisfied, missing, requirements };
}

function evaluateProductRuntime(
  contractExport: ContractRunReportExportResult,
  kitReport: HarmonyOSRuntimeKitReport
): ReleaseGateTierResult {
  const requirements = productRuntimeRequirements();
  const satisfied: string[] = [];
  const missing: string[] = [];

  // 继承 adapter MVP 要求
  const adapterMvp = evaluateAdapterMvp(contractExport, kitReport);
  if (adapterMvp.accepted) {
    satisfied.push(...adapterMvp.satisfied);
  } else {
    missing.push(...adapterMvp.missing);
  }

  // runtime kit all stages passed
  if (kitReport.allStagesPassed) {
    satisfied.push('runtimeKit.allStagesPassed');
  } else {
    missing.push('runtimeKit.allStagesPassed');
  }

  // device evidence — 当前只有 fixture/local 证据，标记为 missing
  const deviceEvidenceRequired = [
    'nativeHTTP.evidence',
    'arkWeb.evidence',
    'cookie.session.evidence',
    'huks.evidence',
    'rdb.evidence',
    'webdav.evidence',
    'tts.evidence'
  ];
  for (let i = 0; i < deviceEvidenceRequired.length; i++) {
    // 当前阶段: fixture 证据已就绪，device 证据待真机 CI
    // 标记为 missing 直到真机 CI 通过
    missing.push(deviceEvidenceRequired[i]);
  }

  const accepted = missing.length === 0;
  return { tier: ReleaseGateTier.productRuntime, accepted, satisfied, missing, requirements };
}

function evaluateReleaseCandidate(
  contractExport: ContractRunReportExportResult,
  kitReport: HarmonyOSRuntimeKitReport
): ReleaseGateTierResult {
  const requirements = releaseCandidateRequirements();
  const satisfied: string[] = [];
  const missing: string[] = [];

  // 继承 product runtime 要求
  const productRuntime = evaluateProductRuntime(contractExport, kitReport);
  if (productRuntime.accepted) {
    satisfied.push(...productRuntime.satisfied);
  } else {
    missing.push(...productRuntime.missing);
  }

  // release candidate 额外要求 — 对齐 harmonyos_release_source_binding not-covered 项
  const rcRequired = [
    'rollback',
    'credential.revocation',
    'network.hardening',
    'real.corpus.benchmark',
    'product.gated.js.bridge'
  ];
  for (let i = 0; i < rcRequired.length; i++) {
    missing.push(rcRequired[i]);
  }

  const accepted = missing.length === 0;
  return { tier: ReleaseGateTier.releaseCandidate, accepted, satisfied, missing, requirements };
}

// MARK: - 便捷导出

export function isAdapterMvpAccepted(): boolean {
  return evaluateReleaseGate().adapterMvp.accepted;
}

export function isProductRuntimeAccepted(): boolean {
  return evaluateReleaseGate().productRuntime.accepted;
}

export function isReleaseCandidateAccepted(): boolean {
  return evaluateReleaseGate().releaseCandidate.accepted;
}
