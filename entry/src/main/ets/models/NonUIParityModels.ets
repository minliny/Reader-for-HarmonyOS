// NonUIParityModels - clean-room Legado non-UI parity evidence contracts.

export enum NonUIParityPriority {
  p0 = 'P0',
  p1 = 'P1',
  p2 = 'P2'
}

export enum NonUIParityStatus {
  measuredPass = 'MEASURED_PASS',
  readyNotExecuted = 'READY_NOT_EXECUTED',
  externalRequired = 'EXTERNAL_REQUIRED',
  blocked = 'BLOCKED'
}

export interface NonUIParityEvidenceRow {
  id: string;
  priority: NonUIParityPriority;
  domain: string;
  legadoCapability: string;
  harmonyOSCapability: string;
  status: NonUIParityStatus;
  evidenceId: string;
  checksum: string;
  redactedSummary: string;
  requiresDeviceExecution: boolean;
  requiresExternalNetwork: boolean;
  requiresProductGovernance: boolean;
  rawValueExported: boolean;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

export interface NonUIParityEvidenceBundle {
  sampleId: string;
  rows: NonUIParityEvidenceRow[];
  p0MeasuredPassCount: number;
  p1MeasuredPassCount: number;
  p2MeasuredPassCount: number;
  readyNotExecutedCount: number;
  externalRequiredCount: number;
  blockedCount: number;
  localCodeOwnedGapsClosed: boolean;
  allRowsRedacted: boolean;
  canEnterCoreExternalEvidenceIntake: boolean;
  canMutateReaderCoreProductionReleaseGate: boolean;
  readerCoreRootArtifactsMutated: boolean;
  deviceExecutorUsed: boolean;
  externalNetworkUsed: boolean;
  cleanRoomMaintained: boolean;
  externalGPLCodeCopied: boolean;
  legadoSourceCopied: boolean;
}

export const LEGADO_NON_UI_CAPABILITY_IDS: string[] = [
  'source_full_chain_runtime',
  'js_runtime_bridge',
  'webview_dom_runtime',
  'cookie_session_runtime',
  'native_http_runtime',
  'persistent_database_schema',
  'local_book_multiformat',
  'epub_external_corpus_readiness',
  'rss_feed_runtime',
  'webdav_backup_restore',
  'download_cache_scheduler',
  'tts_http_tts_runtime',
  'content_processing_rules',
  'source_management_persistence',
  'search_history_cache',
  'reading_progress_bookmark',
  'file_permission_lifecycle',
  'secure_storage_boundary',
  'headless_background_jobs',
  'local_debug_transport',
  'release_evidence_governance'
];
