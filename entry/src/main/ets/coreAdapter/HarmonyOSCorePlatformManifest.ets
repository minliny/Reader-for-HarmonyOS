// HarmonyOSCorePlatformManifest - Core contract constants copied from Reader-Core artifact shapes.
// This file mirrors identifiers only; it does not copy platform implementation code.

import {
  AdapterKind,
  EvidenceArtifactName,
  HARMONYOS_ADAPTER_CONTRACT_RUNNER,
  HARMONYOS_PLATFORM_FAMILY
} from './HarmonyOSAdapterContractReport';

export interface HarmonyOSManifestRequirement {
  kind: AdapterKind;
  requiredFeatureIDs: string[];
}

export function harmonyOSManifestRequirements(): HarmonyOSManifestRequirement[] {
  return [
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
  ];
}

export function harmonyOSRequiredEvidenceArtifacts(): EvidenceArtifactName[] {
  return [
    EvidenceArtifactName.metadata,
    EvidenceArtifactName.expected,
    EvidenceArtifactName.matrix,
    EvidenceArtifactName.regressionResult
  ];
}

export function harmonyOSHostOwnedCapabilityIDs(): string[] {
  return [
    'harmonyos.host.bookshelf',
    'harmonyos.host.reader-shell',
    'harmonyos.host.file-picker',
    'harmonyos.host.download-service',
    'harmonyos.host.tts',
    'harmonyos.host.notifications',
    'harmonyos.host.app-database'
  ];
}

export function harmonyOSUnsupportedCapabilityIDs(): string[] {
  return [
    'harmonyos.reader.readium-equivalent',
    'harmonyos.reader.full-epub-shell',
    'harmonyos.reader.pdf',
    'harmonyos.reader.cbz',
    'harmonyos.sync.legado-equivalent'
  ];
}

export function harmonyOSRequiredP2LocalBookMatrixIDs(): string[] {
  return [
    'epub_archive_adapter_bridge',
    'local_file_access_import_bridge',
    'host_file_picker_import_bridge',
    'txt_encoding_detector_handoff_bridge',
    'txt_oversized_fail_closed',
    'epub_spine_manifest_semantics',
    'epub_nav_fragment_sections'
  ];
}

export function harmonyOSRequiredP2RSSMatrixIDs(): string[] {
  return [
    'rss_atom_default_field_mapping',
    'rss_atom_pagination',
    'rss_product_gated_runtime_classification',
    'rss_json_feed_default_mapping'
  ];
}

export function harmonyOSRequiredRuntimeEvidenceIDs(): string[] {
  return [
    'credential_redaction_revocation_matrix',
    'product_gated_js_bridge_release_runner',
    'runtime_rollback_audit',
    'secure_storage_platform_audit',
    'session_cookie_login_platform_runner',
    'webview_cookie_mirror_audit',
    'webview_dom_platform_smoke_runner'
  ];
}

export function harmonyOSRequiredHostSmokeEvidenceIDs(): string[] {
  return [
    'host_bookshelf_ui_smoke',
    'host_bookshelf_state_persistence',
    'host_reader_shell_smoke',
    'host_reader_progress_navigation_smoke',
    'host_file_picker_permission_smoke',
    'file_access_permission_handoff',
    'host_download_service_smoke',
    'host_download_rollback_audit',
    'host_tts_playback_smoke',
    'host_tts_media_session_audit',
    'host_notification_permission_smoke',
    'host_notification_tap_route_smoke',
    'host_settings_persistence_smoke',
    'host_settings_reset_audit',
    'host_app_database_migration_smoke',
    'host_app_database_backup_policy_audit',
    'host_login_ui_authorization_audit',
    'session_cookie_login_platform_runner'
  ];
}

export function harmonyOSPlatformFamily(): string {
  return HARMONYOS_PLATFORM_FAMILY;
}

export function harmonyOSRunnerIdentifier(): string {
  return HARMONYOS_ADAPTER_CONTRACT_RUNNER;
}

export function harmonyOSRequiredCaseCount(): number {
  const requirements = harmonyOSManifestRequirements();
  let count = 0;
  for (let i = 0; i < requirements.length; i++) {
    count += requirements[i].requiredFeatureIDs.length;
  }
  return count;
}
