import type { JsonObject, ReaderCoreStorageProbe } from '@reader/core-harmony';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderStartupTrace } from './ReaderStartupTrace';

const LOG_DOMAIN = 0x5244;

export type CoreBuildIdentity = {
  schemaVersion: number;
  buildId: string;
  gitCommit: string;
  gitDirty: boolean;
  cargoLockSha256: string;
  protocolSha256: string;
  rustProfile: string;
  storageCompatibility?: CoreStorageCompatibility;
  sqliteUserVersion?: number;
};

type CoreStorageCompatibility = {
  sqliteMaxUserVersion: number;
  sqliteStorageSourceSha256: string;
};

/** Legacy recovery facts that older Core builds could return in core.info. */
type LegacyCoreStorageCapabilities = {
  logicalExport: boolean;
  logicalRestore: boolean;
  legacyHostImport: boolean;
  physicalBackup: boolean;
  physicalRestore: boolean;
  webdavConfigRestore: boolean;
  activeLibrarySync: false;
  logicalExportRequiresDataPreflight: true;
  logicalRestoreRequiresCompleteCoverage: boolean;
  resourceEvidenceOnly: true;
  externalFilesIncluded: false;
};

export type LegacyCoreStorageFormat = {
  format: 'legacy' | 'library47';
  portableSnapshotSupported: boolean;
  capabilities?: LegacyCoreStorageCapabilities;
};

export async function requireStorageProbeIdentity(probe: ReaderCoreStorageProbe, current: () => boolean,
  readIdentity: () => Promise<string>): Promise<void> {
  const raw = await readIdentity();
  if (!current() || raw.length > 4096) throw new Error('STORAGE_BOOTSTRAP_IDENTITY_RETIRED');
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('STORAGE_BOOTSTRAP_IDENTITY_MISMATCH');
  }
  const expected = value as JsonObject;
  if (Object.keys(expected).length !== 5 || expected['format'] !== 'reader.storage-bootstrap-identity' ||
    expected['version'] !== 1 || !isLowerHex(expected['buildId'], 64, 64) ||
    !isLowerHex(expected['contractSha256'], 64, 64) ||
    !isLowerHex(expected['coreInputFingerprint'], 64, 64) ||
    expected['buildId'] !== probe.buildIdentity['buildId'] || expected['contractSha256'] !== probe.contractSha256 ||
    expected['coreInputFingerprint'] !== probe.coreInputFingerprint) {
    throw new Error('STORAGE_BOOTSTRAP_IDENTITY_MISMATCH');
  }
  if (!current()) throw new Error('STORAGE_BOOTSTRAP_IDENTITY_RETIRED');
  const receipt = JSON.stringify({ schemaVersion: 1, buildId: expected['buildId'], contractSha256: expected['contractSha256'],
    coreInputFingerprint: expected['coreInputFingerprint'], matched: true });
  hilog.info(LOG_DOMAIN, 'Reader', 'Storage bootstrap identity: %{public}s', receipt);
  ReaderStartupTrace.current()?.mark('startup.storage-identity', 'matched');
}

export function requireCoreBuildIdentity(value: unknown): CoreBuildIdentity {
  if (typeof value !== 'object' || value === null) {
    throw new Error('core.info did not return buildIdentity');
  }
  const identity = value as Record<string, unknown>;
  const gitCommit = identity['gitCommit'];
  if (identity['schemaVersion'] !== 1 ||
    !isLowerHex(identity['buildId'], 64, 64) ||
    !(gitCommit === 'unknown' || isLowerHex(gitCommit, 40, 64)) ||
    typeof identity['gitDirty'] !== 'boolean' ||
    !isLowerHex(identity['cargoLockSha256'], 64, 64) ||
    !isLowerHex(identity['protocolSha256'], 64, 64) ||
    typeof identity['rustProfile'] !== 'string' || identity['rustProfile'].trim().length === 0) {
    throw new Error('core.info returned an invalid buildIdentity');
  }
  const result: CoreBuildIdentity = {
    schemaVersion: 1,
    buildId: identity['buildId'],
    gitCommit: gitCommit,
    gitDirty: identity['gitDirty'],
    cargoLockSha256: identity['cargoLockSha256'],
    protocolSha256: identity['protocolSha256'],
    rustProfile: identity['rustProfile'],
  };
  const storage = identity['storageCompatibility'];
  if (storage !== undefined) {
    if (typeof storage !== 'object' || storage === null) {
      throw new Error('core.info returned invalid storage compatibility');
    }
    const fields = storage as Record<string, unknown>;
    const version = fields['sqliteMaxUserVersion'];
    const source = fields['sqliteStorageSourceSha256'];
    if (typeof version !== 'number' || !Number.isSafeInteger(version) || version <= 0 || version > 0x7fffffff ||
      !isLowerHex(source, 64, 64)) {
      throw new Error('core.info returned invalid storage compatibility');
    }
    result.storageCompatibility = { sqliteMaxUserVersion: version, sqliteStorageSourceSha256: source };
  }
  return result;
}

export function requireCoreStorageFormat(value: unknown): LegacyCoreStorageFormat | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('core.info returned invalid storage format capability');
  }
  const fields = value as Record<string, unknown>;
  const format = fields['format'];
  const portable = fields['portableSnapshotSupported'];
  if ((format !== 'legacy' && format !== 'library47') || typeof portable !== 'boolean' ||
    Object.keys(fields).some((key: string): boolean => !['format', 'portableSnapshotSupported', 'capabilities'].includes(key))) {
    throw new Error('core.info returned invalid storage format capability');
  }
  if (fields['capabilities'] === undefined) return { format, portableSnapshotSupported: portable };
  const capabilities = requireCoreStorageCapabilities(fields['capabilities']);
  if (portable !== (capabilities.logicalExport && capabilities.logicalRestore && capabilities.legacyHostImport) ||
    (format === 'library47' && !capabilities.logicalRestoreRequiresCompleteCoverage) ||
    (format !== 'library47' && (capabilities.physicalBackup || capabilities.physicalRestore))) {
    throw new Error('core.info returned invalid storage format capability');
  }
  return { format, portableSnapshotSupported: portable, capabilities };
}

function requireCoreStorageCapabilities(value: unknown): LegacyCoreStorageCapabilities {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('core.info returned invalid storage format capability');
  }
  const fields = value as Record<string, unknown>;
  const keys: string[] = ['logicalExport', 'logicalRestore', 'legacyHostImport', 'physicalBackup', 'physicalRestore',
    'webdavConfigRestore', 'activeLibrarySync', 'logicalExportRequiresDataPreflight',
    'logicalRestoreRequiresCompleteCoverage', 'resourceEvidenceOnly', 'externalFilesIncluded'];
  if (Object.keys(fields).length !== keys.length || keys.some((key: string): boolean => typeof fields[key] !== 'boolean') ||
    fields['activeLibrarySync'] !== false || fields['logicalExportRequiresDataPreflight'] !== true ||
    fields['resourceEvidenceOnly'] !== true ||
    fields['externalFilesIncluded'] !== false) {
    throw new Error('core.info returned invalid storage format capability');
  }
  return { logicalExport: fields['logicalExport'] as boolean, logicalRestore: fields['logicalRestore'] as boolean,
    legacyHostImport: fields['legacyHostImport'] as boolean, physicalBackup: fields['physicalBackup'] as boolean,
    physicalRestore: fields['physicalRestore'] as boolean, webdavConfigRestore: fields['webdavConfigRestore'] as boolean,
    activeLibrarySync: false, logicalExportRequiresDataPreflight: true,
    logicalRestoreRequiresCompleteCoverage: fields['logicalRestoreRequiresCompleteCoverage'] as boolean,
    resourceEvidenceOnly: true, externalFilesIncluded: false };
}

export function requireSourceSwitchRecoveryCount(value: unknown): number {
  if (!Array.isArray(value)) {
    throw new Error('source.switch.recover returned invalid recovered data');
  }
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error('source.switch.recover returned a non-object transaction');
    }
    const transaction = raw as Record<string, unknown>;
    if (typeof transaction['transactionId'] !== 'string' ||
      transaction['transactionId'].trim().length === 0 ||
      transaction['phase'] !== 'rolledBack' || typeof transaction['changed'] !== 'boolean') {
      throw new Error('source.switch.recover returned an invalid transaction result');
    }
  }
  return value.length;
}

function isLowerHex(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength &&
    /^[0-9a-f]+$/.test(value);
}
