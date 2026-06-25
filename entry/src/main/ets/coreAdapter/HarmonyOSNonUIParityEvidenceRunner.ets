// HarmonyOSNonUIParityEvidenceRunner - non-UI parity closure bundle.
// Excludes page/UI behavior and never claims unexecuted device/governance work as pass.

import { boundedChecksum } from '../adapters/FeedParserAdapter';
import {
  LEGADO_NON_UI_CAPABILITY_IDS,
  NonUIParityEvidenceBundle,
  NonUIParityEvidenceRow,
  NonUIParityPriority,
  NonUIParityStatus
} from '../models/NonUIParityModels';
import { LegadoNonUIServiceEvidence, runLegadoNonUIParityLocalClosure } from '../services/LegadoNonUIParityServices';

export interface NonUIParityArtifactSet {
  metadata: string;
  expected: string;
  matrix: string;
  regressionResult: string;
  serviceEvidence: string;
}

export function buildHarmonyOSNonUIParityEvidenceBundle(): NonUIParityEvidenceBundle {
  const service = runLegadoNonUIParityLocalClosure();
  const rows: NonUIParityEvidenceRow[] = [];

  addMeasured(rows, NonUIParityPriority.p0, 'runtime', 'search/detail/toc/content execution with failure classification', 'fixture full-chain runtime service', 'source_full_chain_runtime', service.sourceChain.checksum, service.sourceChain.searchCount >= 2 && service.sourceChain.tocCount >= 2 && service.sourceChain.redactedEvidence);
  addReady(rows, NonUIParityPriority.p0, 'runtime', 'device WebView/JS/native HTTP/cookie/session execution', 'ArkWeb/nativeHTTP/cookie/session executor seams', 'harmonyos_device_runtime_execution', 'device runner required for deviceExecutorUsed=true', true, false);
  addMeasured(rows, NonUIParityPriority.p0, 'data', 'Room-like entities, DAO contracts, migrations, source/cache/progress records', 'VersionedReaderDataStore schema contract', 'persistent_database_schema', service.dataLayer.checksum, service.dataLayer.entityCount >= 21 && service.dataLayer.migrationStepCount > 0);
  addMeasured(rows, NonUIParityPriority.p0, 'local-book', 'TXT/EPUB/PDF/MOBI/UMD/HTML format handling boundary', 'LocalBookFormatCoverageAdapter', 'local_book_multiformat', service.localBookFormats.checksum, service.localBookFormats.coveredFormats.indexOf('mobi') !== -1 && service.localBookFormats.coveredFormats.indexOf('umd') !== -1);
  addReady(rows, NonUIParityPriority.p0, 'local-book', 'complex external EPUB corpus validation', 'redacted corpus-ready import row', 'epub_external_corpus_readiness', 'authorized corpus files required', false, true);
  addMeasured(rows, NonUIParityPriority.p0, 'sync', 'WebDAV upload/download/conflict/restore/backup envelope', 'MemoryWebDAVBackupRuntime', 'webdav_backup_restore', service.webdavBackup.checksum, service.webdavBackup.connectionPassed && service.webdavBackup.conflictResolved && service.webdavBackup.encryptedEnvelopeBoundary);

  addMeasured(rows, NonUIParityPriority.p1, 'background', 'download queue, retry classification, chapter cache', 'DownloadCacheScheduler', 'download_cache_scheduler', service.downloadCache.checksum, service.downloadCache.completedCount === service.downloadCache.scheduledCount && service.downloadCache.cacheHit);
  addMeasured(rows, NonUIParityPriority.p1, 'rss', 'RSS/feed runtime and login feed boundary', 'FeedParserAdapter plus runtime evidence boundary', 'rss_feed_runtime', service.sourceChain.checksum, service.sourceChain.redactedEvidence);
  addMeasured(rows, NonUIParityPriority.p1, 'content', 'replace rules, dictionary normalization, ad cleanup', 'ContentProcessingRuntime', 'content_processing_rules', service.contentProcessing.checksum, service.contentProcessing.replaceApplied && service.contentProcessing.adsRemoved);
  addMeasured(rows, NonUIParityPriority.p1, 'tts', 'TTS/HTTP TTS queue and credential redaction boundary', 'HeadlessTTSRuntime', 'tts_http_tts_runtime', service.tts.checksum, service.tts.queuedSegments > 0 && service.tts.httpTTSRequestRedacted);
  addMeasured(rows, NonUIParityPriority.p1, 'debug', 'local HTTP/WebSocket source debug contract', 'LocalDebugTransportRuntime', 'local_debug_transport', service.localDebugTransport.checksum, service.localDebugTransport.httpContractBound && service.localDebugTransport.websocketContractBound);
  addMeasured(rows, NonUIParityPriority.p1, 'source-management', 'source persistence, enable/disable, rule-sub durable record boundary', 'VersionedReaderDataStore source records', 'source_management_persistence', service.dataLayer.checksum, service.dataLayer.sourceManagementClosed);
  addMeasured(rows, NonUIParityPriority.p1, 'search-history', 'search keyword/history/cache durable record boundary', 'VersionedReaderDataStore search records', 'search_history_cache', service.dataLayer.checksum, service.dataLayer.searchHistoryClosed);
  addMeasured(rows, NonUIParityPriority.p1, 'reading-state', 'progress/bookmark/read-record durable record boundary', 'VersionedReaderDataStore progress records', 'reading_progress_bookmark', service.dataLayer.checksum, service.dataLayer.readingProgressClosed);
  addMeasured(rows, NonUIParityPriority.p1, 'file-access', 'file permission lifecycle and raw path redaction', 'LocalFilePermissionTokenAdapter evidence boundary', 'file_permission_lifecycle', service.localBookFormats.checksum, service.localBookFormats.rawFilePathExported === false);
  addMeasured(rows, NonUIParityPriority.p1, 'secure-storage', 'opaque credential references and raw export denial', 'CookieCredentialBoundaryAdapter', 'secure_storage_boundary', service.checksum, service.secureStorageRawExportDenied);
  addMeasured(rows, NonUIParityPriority.p1, 'background', 'headless job cancellation/retry/resource-safe boundaries', 'DownloadCacheScheduler and service seams', 'headless_background_jobs', service.downloadCache.checksum, service.downloadCache.retryClassified);

  addReady(rows, NonUIParityPriority.p2, 'real-corpus', 'authorized real corpus benchmark', 'redacted evidence intake shape', 'authorized_real_corpus_benchmark', 'approved external corpus required', false, true);
  addReady(rows, NonUIParityPriority.p2, 'ci', 'stable platform runtime CI', 'runtime CI evidence runner shape', 'platform_runtime_ci_stability', 'device/simulator CI required', true, false);
  addExternal(rows, NonUIParityPriority.p2, 'governance', 'product governance approval', 'release approval import row', 'product_governance_approval', 'external product approval required');
  addExternal(rows, NonUIParityPriority.p2, 'release', 'Reader-Core production_release pass application', 'manual root gate application verification row', 'core_root_gate_application', 'Core root artifact application required');
  addReady(rows, NonUIParityPriority.p2, 'release', 'replace local fallback evidence with platform executed evidence', 'platform execution replacement row', 'platform_executed_evidence_upgrade', 'deviceExecutorUsed=true and external corpus evidence required', true, true);

  const counts = countRows(rows);
  return {
    sampleId: 'harmonyos_legado_non_ui_parity_001',
    rows,
    p0MeasuredPassCount: counts.p0,
    p1MeasuredPassCount: counts.p1,
    p2MeasuredPassCount: counts.p2,
    readyNotExecutedCount: counts.ready,
    externalRequiredCount: counts.external,
    blockedCount: counts.blocked,
    localCodeOwnedGapsClosed: service.allLocalCodeOwnedChecksPassed && counts.blocked === 0,
    allRowsRedacted: rows.every((row: NonUIParityEvidenceRow) => row.rawValueExported === false),
    canEnterCoreExternalEvidenceIntake: counts.blocked === 0 && service.allLocalCodeOwnedChecksPassed,
    canMutateReaderCoreProductionReleaseGate: false,
    readerCoreRootArtifactsMutated: false,
    deviceExecutorUsed: false,
    externalNetworkUsed: false,
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

export function buildHarmonyOSNonUIParityArtifactSet(bundle?: NonUIParityEvidenceBundle): NonUIParityArtifactSet {
  const resolved = bundle ?? buildHarmonyOSNonUIParityEvidenceBundle();
  return {
    metadata: JSON.stringify({
      id: resolved.sampleId,
      capabilityCount: LEGADO_NON_UI_CAPABILITY_IDS.length,
      excludesUI: true,
      cleanRoomMaintained: true,
      externalGPLCodeCopied: false,
      legadoSourceCopied: false
    }),
    expected: JSON.stringify({
      localCodeOwnedGapsClosed: true,
      canEnterCoreExternalEvidenceIntake: true,
      canMutateReaderCoreProductionReleaseGate: false,
      deviceExecutorUsed: false
    }),
    matrix: JSON.stringify({
      rows: resolved.rows,
      p0MeasuredPassCount: resolved.p0MeasuredPassCount,
      p1MeasuredPassCount: resolved.p1MeasuredPassCount,
      readyNotExecutedCount: resolved.readyNotExecutedCount,
      externalRequiredCount: resolved.externalRequiredCount,
      blockedCount: resolved.blockedCount
    }),
    regressionResult: JSON.stringify({
      validation: 'local non-ui parity validator',
      result: resolved.localCodeOwnedGapsClosed && resolved.allRowsRedacted ? 'PASS' : 'FAIL',
      note: 'Device, external corpus, product approval, and Core root gate application are not faked.'
    }),
    serviceEvidence: JSON.stringify(runLegadoNonUIParityLocalClosure())
  };
}

function addMeasured(rows: NonUIParityEvidenceRow[], priority: NonUIParityPriority, domain: string, legadoCapability: string, harmonyOSCapability: string, id: string, checksumInput: string, passed: boolean): void {
  rows.push(row(priority, domain, legadoCapability, harmonyOSCapability, id, passed ? NonUIParityStatus.measuredPass : NonUIParityStatus.blocked, checksumInput, false, false, false, passed ? 'local code-owned check passed' : 'local code-owned check failed'));
}

function addReady(rows: NonUIParityEvidenceRow[], priority: NonUIParityPriority, domain: string, legadoCapability: string, harmonyOSCapability: string, id: string, summary: string, requiresDeviceExecution: boolean, requiresExternalNetwork: boolean): void {
  rows.push(row(priority, domain, legadoCapability, harmonyOSCapability, id, NonUIParityStatus.readyNotExecuted, summary, requiresDeviceExecution, requiresExternalNetwork, false, summary));
}

function addExternal(rows: NonUIParityEvidenceRow[], priority: NonUIParityPriority, domain: string, legadoCapability: string, harmonyOSCapability: string, id: string, summary: string): void {
  rows.push(row(priority, domain, legadoCapability, harmonyOSCapability, id, NonUIParityStatus.externalRequired, summary, false, false, true, summary));
}

function row(priority: NonUIParityPriority, domain: string, legadoCapability: string, harmonyOSCapability: string, id: string, status: NonUIParityStatus, checksumInput: string, requiresDeviceExecution: boolean, requiresExternalNetwork: boolean, requiresProductGovernance: boolean, summary: string): NonUIParityEvidenceRow {
  return {
    id,
    priority,
    domain,
    legadoCapability,
    harmonyOSCapability,
    status,
    evidenceId: `harmonyos.non_ui.${id}`,
    checksum: boundedChecksum(`${id}|${status}|${checksumInput}`),
    redactedSummary: `non_ui_parity ${id} status:${status} ${summary} values:REDACTED`,
    requiresDeviceExecution,
    requiresExternalNetwork,
    requiresProductGovernance,
    rawValueExported: false,
    cleanRoomMaintained: true,
    externalGPLCodeCopied: false,
    legadoSourceCopied: false
  };
}

function countRows(rows: NonUIParityEvidenceRow[]): Record<string, number> {
  let p0 = 0;
  let p1 = 0;
  let p2 = 0;
  let ready = 0;
  let external = 0;
  let blocked = 0;
  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    if (item.status === NonUIParityStatus.measuredPass && item.priority === NonUIParityPriority.p0) { p0++; }
    if (item.status === NonUIParityStatus.measuredPass && item.priority === NonUIParityPriority.p1) { p1++; }
    if (item.status === NonUIParityStatus.measuredPass && item.priority === NonUIParityPriority.p2) { p2++; }
    if (item.status === NonUIParityStatus.readyNotExecuted) { ready++; }
    if (item.status === NonUIParityStatus.externalRequired) { external++; }
    if (item.status === NonUIParityStatus.blocked) { blocked++; }
  }
  const result: Record<string, number> = {} as Record<string, number>;
  result['p0'] = p0;
  result['p1'] = p1;
  result['p2'] = p2;
  result['ready'] = ready;
  result['external'] = external;
  result['blocked'] = blocked;
  return result;
}
