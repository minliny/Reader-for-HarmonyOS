import { SyncWriteObservation, type SyncPresentationFacts } from './SyncOperationProjection';
import { SyncHostConfigurationGateway } from './SyncHostConfiguration';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import type { JsonObject } from '@reader/core-harmony';
import util from '@ohos.util';
import url from '@ohos.url';
import systemDateTime from '@ohos.systemDateTime';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { HttpExecuteHost } from '../../../platform/network/HttpExecuteHost';
import fileIo from '@ohos.file.fs';
import { replaceReaderAtomicSnapshot } from '../../../app/ReaderAtomicSnapshotFile';
import { readerHostFilesDirectory } from '../../../app/diagnostics/ReaderPublicFixtureScope';
import { LOCAL_RECOVERY_MAX_BYTES, recoveryHashFile, recoveryOutput, recoveryReserve, recoveryVisitFile, recoveryWithFile } from '../../../platform/backup/LocalRecoveryFile';
import { LocalRecoveryGateway, type LocalRecoveryOutcome } from '../../bookshelf/application/LocalRecoveryGateway';
import { WEB_DAV_ARCHIVE_READ_WINDOW, WebDavLibraryBackup, WebDavLibraryBackupError,
  type WebDavArchiveRemoval, type WebDavArchiveRow, type WebDavArchiveVerification,
  type WebDavLibraryPublicationMetadata } from './WebDavLibraryBackup';
import {
  type StoredWebDavConfig,
  type StoredWebDavState,
  type WebDavBackupJournal,
  type WebDavConfigIntent,
  WebDavCredentialStore,
} from './WebDavCredentialStore';

const DEFAULT_WEBDAV_DIRECTORY = '/ReaderBackup/ReaderHarmony';
const MAX_TRANSACTION_STEPS = 12;
const MAX_TRANSACTION_REQUESTS = 100;
const MAX_WEBDAV_DIRECTORY_LENGTH = 4096;
const WEBDAV_AUTH_FAILED = 'WebDAV 认证失败或已过期，请更新账号与密码';
const WEBDAV_READBACK_FAILED = '上传结果尚待核对，请核对本次备份';
const WEBDAV_RETENTION_UNOWNED = '旧备份归属未核实，已保留远端历史';
const WEBDAV_PROVIDER_CHANGED = 'WebDAV 配置已变化，请重新选择恢复备份';
const WEBDAV_NOT_CONFIGURED = '请先安全保存 WebDAV 配置';
const WEBDAV_EMPTY = '此 WebDAV 目录暂无 Reader 配置备份';
const WEBDAV_INVALID_BACKUP = '此 WebDAV 配置备份损坏、超限或加密密码不正确';
const WEBDAV_RESTORE_PENDING = '上一次恢复仍待核对，请完成已有恢复后再执行新操作';
const WEBDAV_CANCELLED = '已取消 WebDAV 操作';
const WEBDAV_FAILURE = '操作未完成，请核对当前配置或已有恢复记录';

/** Project only finite messages. Raw native and HTTP errors can contain secrets. */
export function syncFailureMessage(error: unknown): string {
  if (error instanceof Error && [
    WEBDAV_AUTH_FAILED, WEBDAV_READBACK_FAILED, WEBDAV_RETENTION_UNOWNED, WEBDAV_PROVIDER_CHANGED, WEBDAV_NOT_CONFIGURED,
    WEBDAV_EMPTY, WEBDAV_INVALID_BACKUP, WEBDAV_RESTORE_PENDING, WEBDAV_CANCELLED,
  ].includes(error.message)) return error.message;
  if (error === null || typeof error !== 'object') return WEBDAV_FAILURE;
  const event = (error as { event?: { error?: { code?: string; message?: string } } }).event;
  const failure = event?.error;
  if (failure?.code === 'CANCELLED') return WEBDAV_CANCELLED;
  if (failure?.code === 'INVALID_PARAMS' &&
    failure.message === 'WebDAV directory contains no Reader storage backup') return WEBDAV_EMPTY;
  if (failure?.code === 'INVALID_PARAMS' && typeof failure.message === 'string' &&
    /^(WebDAV (backup |authenticated config |decrypted |restore body |config payload )|invalid WebDAV backup)/.test(failure.message)) {
    return WEBDAV_INVALID_BACKUP;
  }
  return WEBDAV_FAILURE;
}

export type SyncHistoryEntry = {
  timestamp: string;
  destination: string;
  size: number;
  ok: boolean;
};

export type SyncRestoreConflict = {
  transactionId: string;
  backupId: string;
  remotePath: string;
  localChecksum: string;
  remoteChecksum: string;
  localExportedAt: number;
  remoteExportedAt: number;
};

export type SyncSnapshot = {
  /** Actual committed save ID read from the same secure envelope. */
  configSaveOperationId?: string;
  /** Original unresolved identity overrides all historical envelope receipts. */
  configSaveIntent?: WebDavConfigIntent;
  configSaveHeadMatchesOriginal?: boolean;
  canContinueConfigSave?: boolean;
  configSavePayloadAvailable?: boolean;
  backupReceipt?: SyncBackupReceipt;
  restoreRecoveryOperationId?: string;
  webdavUrl: string;
  webdavUser: string;
  /** Persisted secrets are never emitted back into ArkUI state. */
  webdavPass: string;
  backupPass: string;
  webdavPath: string;
  saveLocation: string;
  backupFrequency: string;
  backupScope: string;
  history: SyncHistoryEntry[];
  statusMessage: string;
  restoreConflict?: SyncRestoreConflict;
  /** Separate read lifecycle and durable mutation receipt; never contains secrets. */
  facts?: SyncPresentationFacts;
};

export type SyncTestResult = { ok: boolean; error?: string; note?: string };
export type SyncSaveResult = { ok: boolean; error?: string; snapshot?: SyncSnapshot };
export type SyncBackupResult = { ok: boolean; size?: number; path?: string; error?: string };
export type SyncBackupReceipt = {
  operationId: string;
  receiptState: string;
  uploadQualified: boolean;
  retentionCompleted: boolean;
  retentionSkipped: boolean;
  undispatched: boolean;
  durable: boolean;
  remotePath?: string;
  contentBytes?: number;
};
type SyncBackupQuery = { receipt: SyncBackupReceipt; response?: JsonObject };

export type SyncRestoreResult = {
  ok: boolean;
  applied?: boolean;
  cancelled?: boolean;
  conflictInvalidated?: boolean;
  conflict?: SyncRestoreConflict;
  path?: string;
  error?: string;
};

export type SyncLibraryBackupState = LocalRecoveryOutcome['state'] | 'notConfigured' | 'authentication' |
  'readOnly' | 'empty' | 'missingDirectory' | 'providerChanged' | 'conflict' | 'unconfirmed' | 'cleanupPending' |
  'listed' | 'retirementPending' | 'retirementCompleted' | 'retirementAbandoned' | 'retirementPaused' |
  'deletionUnavailable' | 'cleanupFailed' | 'replacementUnverified' | 'replacementMissingOriginals';

export interface SyncLibraryBackupResult {
  state: SyncLibraryBackupState;
  included?: number;
  missing?: number;
  archives?: SyncLibraryArchiveRow[];
}

export interface SyncLibraryArchiveRow extends WebDavArchiveRow {
  providerIdentity: string;
}

export interface SyncLibraryBackupConfiguration {
  url: string;
  user: string;
  directory: string;
  configured: boolean;
  providerIdentity?: string;
  pendingPublication: boolean;
  publicationUnavailable?: boolean;
  cleanupReceipt?: string;
  pendingConfigId?: string;
  configNeedsOriginal?: boolean;
  removal?: SyncLibraryRemovalStatus;
  retirementUnavailable?: boolean;
}

export type SyncLibrarySweepStatus = 'done' | 'pending' | 'cancelled';

export interface SyncLibraryRemovalStatus {
  receipt: string;
  phase: 'manifest' | 'waiting' | 'parts';
  waitMinutes: number;
}

interface SyncLibraryProvider {
  config: StoredWebDavConfig;
  identity: string;
  assertCurrent: () => Promise<void>;
  transport: WebDavLibraryBackup;
}

interface SyncLibraryPublication {
  schemaVersion: number;
  configOperationId: string;
  sha256: string;
  bytes: number;
  remoteVerified?: boolean;
  metadata?: WebDavLibraryPublicationMetadata;
}

interface SyncLibraryRemovalJournal {
  schemaVersion: number;
  configOperationId: string;
  plan: WebDavArchiveRemoval;
  removedAtUptime?: number;
}

class SyncLibraryProviderChanged extends Error {}

type CoreWebDavTransaction = {
  transactionId: string;
  status: string;
  phase: string;
  requests: JsonObject[];
  storageApply?: JsonObject;
  hostConfig?: JsonObject;
  conflict?: JsonObject;
  backupId?: string;
  remotePath?: string;
  contentBytes?: number;
  deletedCount?: number;
};

export const DEFAULT_SYNC_SNAPSHOT: SyncSnapshot = {
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  backupPass: '',
  webdavPath: DEFAULT_WEBDAV_DIRECTORY,
  saveLocation: 'WebDAV',
  backupFrequency: '手动',
  backupScope: '配置数据（不含离线书籍和正文，AES 加密）',
  history: [],
  statusMessage: '',
};

/**
 * Foreground WebDAV product gateway.
 *
 * Core owns every transaction phase: configuration-only AES package creation, backup naming,
 * retention, restore selection, conflict and resolution. The Host owns only
 * AssetStore, real HTTP execution and forwarding Core's opaque storage-apply
 * descriptor through the standard runtime command.
 */
export class SyncGateway {
  private readonly hostConfiguration: SyncHostConfigurationGateway = new SyncHostConfigurationGateway();
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private readonly credentials: WebDavCredentialStore;
  private pendingRestoreTransactionId: string = '';
  private pendingRestoreConfig: StoredWebDavState | undefined = undefined;
  private static restoreRecoveries: Map<ReaderRuntimeOwner, Promise<boolean>> = new Map();
  private static readonly libraryOperations: Set<ReaderRuntimeOwner> = new Set<ReaderRuntimeOwner>();
  private static readonly librarySweeps: Set<ReaderRuntimeOwner> = new Set<ReaderRuntimeOwner>();
  private static readonly libraryStaging: Set<ReaderRuntimeOwner> = new Set<ReaderRuntimeOwner>();
  private libraryPreview: SyncLibraryProvider | undefined;

  constructor(
    runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    credentials: WebDavCredentialStore = WebDavCredentialStore.instance,
  ) {
    this.runtimeOwner = runtimeOwner;
    this.credentials = credentials;
  }

  /** Explicit foreground book-library backup alongside historical settings backups. */
  async libraryBackupConfiguration(): Promise<SyncLibraryBackupConfiguration> {
    this.assertOwner();
    const pendingConfig = await this.credentials.reconcileConfigIntent((): boolean => this.isOwner());
    const saved = await this.credentials.loadSerializedState();
    const identity = this.libraryProviderIdentity(saved);
    let publication: SyncLibraryPublication | undefined;
    let removal: SyncLibraryRemovalStatus | undefined;
    let publicationUnavailable = false;
    let retirementUnavailable = false;
    if (identity !== undefined) {
      try { publication = await this.libraryPublication(identity); }
      catch (_) { publicationUnavailable = true; }
      try {
        const retirement = await this.libraryRetirement(identity);
        if (retirement !== undefined) removal = this.libraryRetirementStatus(retirement);
      } catch (_) { retirementUnavailable = true; }
    }
    const configNeedsOriginal = pendingConfig !== undefined && !await this.credentials.canContinueConfigIntent(pendingConfig.operationId);
    this.assertOwner();
    return { url: saved.config?.url ?? '', user: saved.config?.user ?? '',
      directory: saved.config?.directory ?? DEFAULT_WEBDAV_DIRECTORY, configured: identity !== undefined, providerIdentity: identity,
      pendingPublication: publication !== undefined && publication.remoteVerified !== true,
      publicationUnavailable,
      cleanupReceipt: publication?.remoteVerified === true ? this.libraryCleanupReceipt(publication) : undefined,
      pendingConfigId: pendingConfig?.operationId,
      configNeedsOriginal, removal, retirementUnavailable };
  }

  async sweepLibraryPayloads(expectedIdentity: string, current: () => boolean): Promise<SyncLibrarySweepStatus> {
    if (!current() || !this.isOwner() || SyncGateway.librarySweeps.has(this.runtimeOwner)) return 'cancelled';
    SyncGateway.librarySweeps.add(this.runtimeOwner);
    try {
      const saved = await this.credentials.loadSerializedState();
      if (this.libraryProviderIdentity(saved) !== expectedIdentity) return 'cancelled';
      return await this.retireUnusedLibraryPayloads(saved, current);
    } catch (_) {
      return current() && this.isOwner() ? 'pending' : 'cancelled';
    } finally {
      SyncGateway.librarySweeps.delete(this.runtimeOwner);
    }
  }

  async backupLibrary(recovery: LocalRecoveryGateway, includeOriginals: boolean, current: () => boolean,
    cleanupReceipt?: string): Promise<SyncLibraryBackupResult> {
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      const directory = this.libraryDirectory(provider.identity);
      const pending = await this.libraryPublication(provider.identity);
      if (cleanupReceipt !== undefined &&
        (pending?.remoteVerified !== true || cleanupReceipt !== this.libraryCleanupReceipt(pending))) return { state: 'cancelled' };
      if (pending !== undefined) return this.publishLibraryBackup(provider, directory, pending);
      const before = await this.runtimeOwner.readLibraryBackupIdentity();
      let transferError: Error | undefined;
      let completion: SyncLibraryBackupResult | undefined;
      const result = await recovery.exportStagedPackage(provider.config.backupPassword, includeOriginals,
        async (path: string, sha256: string, bytes: number): Promise<boolean> => {
          try {
            await provider.assertCurrent();
            if (!(await fileIo.access(directory))) await fileIo.mkdir(directory, true);
            const captured = await this.runtimeOwner.readLibraryBackupIdentity();
            if (before?.libraryId !== captured?.libraryId || before?.writerInstanceId !== captured?.writerInstanceId) {
              throw new SyncLibraryProviderChanged();
            }
            const metadata: WebDavLibraryPublicationMetadata = { createdAt: Date.now(),
              libraryId: captured?.libraryId, writerInstanceId: captured?.writerInstanceId };
            await recoveryReserve(directory, bytes);
            const payloadPath = this.libraryPayload(directory, sha256);
            await recoveryOutput(payloadPath, async (emit): Promise<void> => {
              if (await recoveryVisitFile(path, emit, current, bytes) !== sha256) throw new Error('Staged backup digest changed');
            });
            if (await recoveryHashFile(payloadPath) !== sha256) throw new Error('Durable backup digest changed');
            const plan: SyncLibraryPublication = { schemaVersion: 1, configOperationId: provider.identity, sha256, bytes, metadata };
            await replaceReaderAtomicSnapshot(`${directory}/publish.json`, directory, JSON.stringify(plan));
            completion = await this.publishLibraryBackup(provider, directory, plan);
            return true;
          } catch (error) {
            transferError = error instanceof Error ? error : new Error('Library publication failed');
            return false;
          }
        }, current);
      if (transferError !== undefined) throw transferError;
      return completion ?? result;
    }, 'staging');
  }

  async previewLibraryBackup(recovery: LocalRecoveryGateway, current: () => boolean, row?: SyncLibraryArchiveRow): Promise<SyncLibraryBackupResult> {
    this.cancelLibraryPreview(recovery);
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      if (row !== undefined && row.providerIdentity !== provider.identity) return { state: 'providerChanged' };
      let empty = false;
      let transferError: Error | undefined;
      const result = await recovery.inspectStagedPackage(provider.config.backupPassword, async (destination): Promise<boolean> => {
        try {
          empty = await provider.transport.downloadLatest(destination, row?.sha256) === 'empty';
          return !empty;
        } catch (error) {
          transferError = error instanceof Error ? error : new Error('Library download failed');
          return false;
        }
      }, current);
      if (transferError !== undefined) throw transferError;
      if (empty) return { state: 'empty' };
      if (result.state === 'preview') {
        await provider.assertCurrent();
        this.libraryPreview = provider;
      }
      return result;
    });
  }

  async listLibraryArchives(current: () => boolean): Promise<SyncLibraryBackupResult> {
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      const identity = await this.runtimeOwner.readLibraryBackupIdentity();
      const remote = await provider.transport.listArchives(identity ?? {});
      const archives = remote.map((row: WebDavArchiveRow): SyncLibraryArchiveRow => ({
        sha256: row.sha256, manifestSha256: row.manifestSha256, bytes: row.bytes, createdAt: row.createdAt,
        latest: row.latest, canDelete: row.canDelete, library: row.library, providerIdentity: provider.identity,
      }));
      return archives.length === 0 ? { state: 'empty', archives } : { state: 'listed', archives };
    });
  }

  async removeLibraryArchive(row: SyncLibraryArchiveRow, current: () => boolean): Promise<SyncLibraryBackupResult> {
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      if (row.providerIdentity !== provider.identity) return { state: 'providerChanged' };
      if (!row.canDelete) return { state: 'conflict' };
      if (await this.libraryRetirement(provider.identity) !== undefined) return { state: 'retirementPending' };
      const directory = this.libraryDirectory(provider.identity);
      if (await this.libraryLocalStat(this.pausedLibraryRetirementPath(directory, row.sha256)) !== undefined) {
        return { state: 'retirementPaused' };
      }
      if (!await fileIo.access(directory)) await fileIo.mkdir(directory, true);
      return this.withLibraryArchiveVerification(provider, directory, current, async (verification): Promise<SyncLibraryBackupResult> => {
        const plan = await provider.transport.planRemoval(row.sha256, row.manifestSha256, verification);
        try { await provider.transport.proveConditionalDeletion(); }
        catch (error) {
          if (error instanceof WebDavLibraryBackupError && error.reason === 'readOnly') return { state: 'deletionUnavailable' };
          throw error;
        }
        await provider.assertCurrent();
        const journal: SyncLibraryRemovalJournal = { schemaVersion: 1, configOperationId: provider.identity, plan };
        await this.writeLibraryRetirement(directory, journal);
        return this.driveLibraryRetirement(provider, directory, journal, verification, true);
      });
    }, 'staging');
  }

  async resumeLibraryRetirement(receipt: string, current: () => boolean): Promise<SyncLibraryBackupResult> {
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      const journal = await this.libraryRetirement(provider.identity);
      if (journal === undefined || this.libraryRetirementStatus(journal).receipt !== receipt) return { state: 'cancelled' };
      const directory = this.libraryDirectory(provider.identity);
      return this.withLibraryArchiveVerification(provider, directory, current, (verification): Promise<SyncLibraryBackupResult> =>
        this.driveLibraryRetirement(provider, directory, journal, verification));
    }, 'staging');
  }

  async leaveLibraryRetirement(receipt: string, current: () => boolean): Promise<SyncLibraryBackupResult> {
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      const journal = await this.libraryRetirement(provider.identity);
      if (journal === undefined || this.libraryRetirementStatus(journal).receipt !== receipt) return { state: 'cancelled' };
      const directory = this.libraryDirectory(provider.identity);
      const active = `${directory}/retirement.json`;
      let discard = false;
      if (journal.removedAtUptime === undefined) {
        try { discard = await provider.transport.canDiscardRemovalPlan(journal.plan); }
        catch (_) { /* An ambiguous remote outcome requires a retained receipt. */ }
      }
      const paused = this.pausedLibraryRetirementPath(directory, journal.plan.sha256);
      if (!discard && await this.libraryLocalStat(paused) !== undefined) return { state: 'cleanupFailed' };
      await provider.assertCurrent();
      if (discard) await this.unlinkLibraryFile(active);
      else await fileIo.rename(active, paused);
      await recoveryWithFile(directory, fileIo.OpenMode.READ_ONLY, (file): Promise<void> => fileIo.fsync(file.fd));
      return { state: discard ? 'retirementAbandoned' : 'retirementPaused' };
    }, 'staging');
  }

  async resumeLibraryConfiguration(operationId: string, current: () => boolean, urlValue?: string,
    user?: string, password?: string, backupPassword?: string, directory?: string): Promise<boolean> {
    try {
      await this.continueConfigSave(operationId, new SyncWriteObservation(), current,
        urlValue, user, password, backupPassword, directory);
      return true;
    } catch (_) { return false; }
  }

  cancelLibraryPreview(recovery: LocalRecoveryGateway): void {
    this.libraryPreview = undefined;
    recovery.clearPreview();
  }

  async restoreLibraryBackup(recovery: LocalRecoveryGateway, current: () => boolean): Promise<SyncLibraryBackupResult> {
    const preview = this.libraryPreview;
    if (preview === undefined) return { state: 'cancelled' };
    return this.runLibraryOperation(current, async (provider): Promise<SyncLibraryBackupResult> => {
      if (provider.identity !== preview.identity || this.libraryPreview !== preview) {
        this.cancelLibraryPreview(recovery);
        return { state: 'providerChanged' };
      }
      await provider.assertCurrent();
      this.libraryPreview = undefined;
      let admissionError: Error | undefined;
      const outcome = await recovery.applyPackage(provider.config.backupPassword, async (): Promise<void> => {
        try { await provider.assertCurrent(); }
        catch (error) {
          admissionError = error instanceof Error ? error : new Error('Provider admission changed');
          throw admissionError;
        }
      });
      if (admissionError !== undefined) throw admissionError;
      return outcome;
    });
  }

  private async runLibraryOperation(current: () => boolean,
    action: (provider: SyncLibraryProvider) => Promise<SyncLibraryBackupResult>,
    operation: 'remote' | 'staging' = 'remote'): Promise<SyncLibraryBackupResult> {
    const usesStaging = operation === 'staging';
    if (!current() || SyncGateway.libraryOperations.has(this.runtimeOwner) ||
      (usesStaging && SyncGateway.libraryStaging.has(this.runtimeOwner))) return { state: 'cancelled' };
    SyncGateway.libraryOperations.add(this.runtimeOwner);
    if (usesStaging) SyncGateway.libraryStaging.add(this.runtimeOwner);
    try {
      this.assertOwner();
      await this.credentials.requireConfigSettled();
      const saved = await this.credentials.loadSerializedState();
      const identity = this.libraryProviderIdentity(saved);
      if (identity === undefined) return { state: 'notConfigured' };
      const config = await this.requireStoredConfig(saved.config);
      const assertCurrent = async (): Promise<void> => {
        this.assertAdmission(current);
        await this.credentials.requireConfigSettled();
        const actual = await this.credentials.loadSerializedState();
        if (this.libraryProviderIdentity(actual) !== identity || actual.savePayloadHash !== saved.savePayloadHash) {
          throw new SyncLibraryProviderChanged();
        }
        this.assertAdmission(current);
      };
      const transport = new WebDavLibraryBackup(this.runtimeOwner, config, this.authorization(config), assertCurrent,
        (): boolean => !this.isOwner() || !current());
      return await action({ config, identity, assertCurrent, transport });
    } catch (error) {
      if (!current() || !this.isOwner()) return { state: 'cancelled' };
      if (error instanceof SyncLibraryProviderChanged) return { state: 'providerChanged' };
      if (error instanceof WebDavLibraryBackupError) {
        switch (error.reason) {
          case 'missing': return { state: 'missingDirectory' };
          case 'corrupt': return { state: 'rejected' };
          default: return { state: error.reason };
        }
      }
      return { state: 'failed' };
    } finally {
      if (usesStaging) SyncGateway.libraryStaging.delete(this.runtimeOwner);
      SyncGateway.libraryOperations.delete(this.runtimeOwner);
    }
  }

  private libraryProviderIdentity(saved: StoredWebDavState): string | undefined {
    const id = saved.saveOperationId;
    return saved.config !== null && id !== undefined && /^[a-f0-9-]{36}$/.test(id) &&
      /^[a-f0-9]{64}$/.test(saved.savePayloadHash ?? '') ? id : undefined;
  }

  private libraryDirectory(identity: string): string {
    return `${this.libraryRoot()}/${identity}`;
  }

  private libraryRoot(): string {
    return `${readerHostFilesDirectory(this.runtimeOwner.getUIAbilityContext().filesDir)}/reader-webdav-library`;
  }

  private async unlinkLibraryFile(path: string): Promise<void> {
    try { await fileIo.unlink(path); }
    catch (error) {
      const code = (error as { code?: number | string }).code;
      if (code !== 13900002 && code !== 'ENOENT') throw error;
    }
  }

  /** An inaccessible journal must never be interpreted as absent. */
  private async libraryLocalStat(path: string): Promise<fileIo.Stat | undefined> {
    try { return await fileIo.lstat(path); }
    catch (error) {
      const code = (error as { code?: number | string }).code;
      if (code === 13900002 || code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private async retireUnusedLibraryPayloads(saved: StoredWebDavState, current: () => boolean): Promise<SyncLibrarySweepStatus> {
    const root = this.libraryRoot();
    const rootStat = await this.libraryLocalStat(root);
    if (rootStat === undefined) return 'done';
    if (!rootStat.isDirectory()) return 'pending';
    let pending = false;
    for (const identity of await fileIo.listFile(root)) {
      if (!current() || !this.isOwner() || SyncGateway.libraryStaging.has(this.runtimeOwner)) return 'cancelled';
      if (identity === saved.saveOperationId || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(identity)) continue;
      try {
        if (!await this.retireInactiveLibraryStaging(identity, saved, current)) return 'cancelled';
      } catch (_) { pending = true; }
    }
    return pending ? 'pending' : 'done';
  }

  private async retireInactiveLibraryStaging(identity: string, saved: StoredWebDavState,
    current: () => boolean): Promise<boolean> {
    if (!current() || !this.isOwner() || SyncGateway.libraryStaging.has(this.runtimeOwner)) return false;
    SyncGateway.libraryStaging.add(this.runtimeOwner);
    try {
      const directory = this.libraryDirectory(identity);
      if (!(await this.libraryLocalStat(directory))?.isDirectory()) return true;
      const publication = await this.libraryPublication(identity);
      if (publication !== undefined) {
        const path = this.libraryPayload(directory, publication.sha256);
        const stat = await this.libraryLocalStat(path);
        if (stat !== undefined && (!stat.isFile() || stat.size !== publication.bytes)) {
          throw new Error('Invalid retired WebDAV publication payload');
        }
        if (!await this.librarySweepIsCurrent(saved, current)) return false;
        if (stat !== undefined) await this.unlinkLibraryFile(path);
        // Keep identification until ciphertext removal is durable. Reopening
        // after interruption can finish a journal whose payload is absent.
        await recoveryWithFile(directory, fileIo.OpenMode.READ_ONLY, (file): Promise<void> => fileIo.fsync(file.fd));
        if (!await this.librarySweepIsCurrent(saved, current)) return false;
        await this.unlinkLibraryFile(`${directory}/publish.json`);
      }
      for (const name of await fileIo.listFile(directory)) {
        if (name === 'verify.readerbackup') {
          if (await this.libraryLocalStat(`${directory}/retirement.json`) !== undefined) continue;
        } else if (!/^[a-f0-9]{64}\.readerbackup$/.test(name)) continue;
        const path = `${directory}/${name}`;
        if (!(await this.libraryLocalStat(path))?.isFile()) continue;
        if (!await this.librarySweepIsCurrent(saved, current)) return false;
        await this.unlinkLibraryFile(path);
      }
      return true;
    } finally {
      SyncGateway.libraryStaging.delete(this.runtimeOwner);
    }
  }

  private async librarySweepIsCurrent(saved: StoredWebDavState, current: () => boolean): Promise<boolean> {
    await this.credentials.requireConfigSettled();
    const actual = await this.credentials.loadSerializedState();
    return current() && this.isOwner() && this.libraryProviderIdentity(actual) === saved.saveOperationId &&
      actual.savePayloadHash === saved.savePayloadHash;
  }

  private libraryPayload(directory: string, sha256: string): string { return `${directory}/${sha256}.readerbackup`; }

  private libraryCleanupReceipt(publication: SyncLibraryPublication): string {
    return `${publication.configOperationId}/${publication.sha256}`;
  }

  private async libraryPublication(identity: string): Promise<SyncLibraryPublication | undefined> {
    const path = `${this.libraryDirectory(identity)}/publish.json`;
    const stat = await this.libraryLocalStat(path);
    if (stat === undefined) return undefined;
    if (!stat.isFile() || stat.size <= 0 || stat.size > 1024) throw new Error('Invalid pending library publication');
    const saved = JSON.parse(await fileIo.readText(path)) as SyncLibraryPublication;
    if (saved.schemaVersion !== 1 || saved.configOperationId !== identity || typeof saved.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(saved.sha256) ||
      !Number.isSafeInteger(saved.bytes) || saved.bytes <= 0 || saved.bytes > LOCAL_RECOVERY_MAX_BYTES ||
      (saved.remoteVerified !== undefined && saved.remoteVerified !== true) || (saved.metadata !== undefined &&
        (!Number.isSafeInteger(saved.metadata.createdAt) || saved.metadata.createdAt <= 0 ||
          (saved.metadata.libraryId !== undefined && !/^[a-f0-9]{32}$/.test(saved.metadata.libraryId)) ||
          (saved.metadata.writerInstanceId !== undefined && !/^[a-f0-9]{64}$/.test(saved.metadata.writerInstanceId))))) {
      throw new Error('Invalid pending library publication identity');
    }
    return saved;
  }

  private async publishLibraryBackup(provider: SyncLibraryProvider, directory: string,
    publication: SyncLibraryPublication): Promise<SyncLibraryBackupResult> {
    const path = this.libraryPayload(directory, publication.sha256);
    await provider.assertCurrent();
    if (publication.remoteVerified !== true) {
      if (await recoveryHashFile(path) !== publication.sha256) throw new Error('Pending library publication bytes changed');
      // An unconfirmed response leaves the original journal and ciphertext.
      await provider.transport.publish(path, publication.sha256, publication.bytes, publication.metadata);
    }
    const journalPath = `${directory}/publish.json`;
    try {
      // Keep the verified receipt durable before retiring its ciphertext.
      const verified: SyncLibraryPublication = { schemaVersion: 1, configOperationId: publication.configOperationId,
        sha256: publication.sha256, bytes: publication.bytes, remoteVerified: true, metadata: publication.metadata };
      await replaceReaderAtomicSnapshot(journalPath, directory, JSON.stringify(verified));
      await this.unlinkLibraryFile(path);
      await recoveryWithFile(directory, fileIo.OpenMode.READ_ONLY, (file): Promise<void> => fileIo.fsync(file.fd));
      await fileIo.unlink(journalPath);
    } catch (_) {
      return { state: 'cleanupPending' };
    }
    return { state: 'exported' };
  }

  private async libraryRetirement(identity: string): Promise<SyncLibraryRemovalJournal | undefined> {
    const path = `${this.libraryDirectory(identity)}/retirement.json`;
    const stat = await this.libraryLocalStat(path);
    if (stat === undefined) return undefined;
    if (!stat.isFile() || stat.size < 1 || stat.size > 16 * 1024) throw new Error('Invalid WebDAV retirement journal');
    const journal = JSON.parse(await fileIo.readText(path)) as SyncLibraryRemovalJournal;
    const sha256 = /^[a-f0-9]{64}$/;
    const plan = journal.plan;
    const proof = plan?.replacementProof;
    if (journal.schemaVersion !== 1 || journal.configOperationId !== identity || plan === undefined ||
      !sha256.test(plan.sha256) || !sha256.test(plan.manifestSha256) || !sha256.test(plan.replacementSha256) ||
      plan.replacementSha256 === plan.sha256 || !/^"[^"\x00-\x20]{1,512}"$/.test(plan.manifestEtag) ||
      !Number.isSafeInteger(plan.bytes) || plan.bytes < 1 || plan.bytes > LOCAL_RECOVERY_MAX_BYTES ||
      !Array.isArray(plan.parts) || plan.parts.length !== Math.ceil(plan.bytes / (4 * 1024 * 1024)) ||
      !plan.parts.every((part: string): boolean => typeof part === 'string' && sha256.test(part)) ||
      (proof !== undefined && (proof === null || typeof proof.libraryId !== 'string' || !/^[a-f0-9]{32}$/.test(proof.libraryId) ||
        typeof proof.manifestSha256 !== 'string' || !sha256.test(proof.manifestSha256) ||
        typeof proof.manifestEtag !== 'string' || !/^"[^"\x00-\x20]{1,512}"$/.test(proof.manifestEtag) ||
        !Number.isSafeInteger(proof.createdAt) || proof.createdAt <= 0)) ||
      (journal.removedAtUptime !== undefined && (!Number.isSafeInteger(journal.removedAtUptime) || journal.removedAtUptime < 0))) {
      throw new Error('Invalid WebDAV retirement binding');
    }
    return journal;
  }

  private libraryRetirementStatus(journal: SyncLibraryRemovalJournal): SyncLibraryRemovalStatus {
    const receipt = `${journal.configOperationId}/${journal.plan.manifestSha256}`;
    if (journal.removedAtUptime === undefined) return { receipt, phase: 'manifest', waitMinutes: 0 };
    const uptime = systemDateTime.getUptime(systemDateTime.TimeType.STARTUP);
    const elapsed = uptime >= journal.removedAtUptime ? uptime - journal.removedAtUptime : 0;
    const waitMinutes = Math.max(0, Math.ceil((WEB_DAV_ARCHIVE_READ_WINDOW - elapsed) / 60000));
    return { receipt, phase: waitMinutes === 0 ? 'parts' : 'waiting', waitMinutes };
  }

  private writeLibraryRetirement(directory: string, journal: SyncLibraryRemovalJournal): Promise<void> {
    return replaceReaderAtomicSnapshot(`${directory}/retirement.json`, directory, JSON.stringify(journal));
  }

  private pausedLibraryRetirementPath(directory: string, sha256: string): string {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid paused archive identity');
    return `${directory}/retirement-paused-${sha256}.json`;
  }

  private async withLibraryArchiveVerification(provider: SyncLibraryProvider, directory: string, current: () => boolean,
    action: (verification: WebDavArchiveVerification) => Promise<SyncLibraryBackupResult>): Promise<SyncLibraryBackupResult> {
    const path = `${directory}/verify.readerbackup`;
    const recovery = new LocalRecoveryGateway(this.runtimeOwner);
    const verification: WebDavArchiveVerification = { path,
      inspect: (input: string) => recovery.verifyBackupArchive(input, provider.config.backupPassword,
        (): boolean => current() && this.isOwner()) };
    try { return await action(verification); }
    finally { await this.unlinkLibraryFile(path).catch((): void => {}); }
  }

  private async driveLibraryRetirement(provider: SyncLibraryProvider, directory: string,
    journal: SyncLibraryRemovalJournal, verification: WebDavArchiveVerification,
    conditionalDeletionProven: boolean = false): Promise<SyncLibraryBackupResult> {
    if (journal.removedAtUptime === undefined) {
      if (journal.plan.replacementProof === undefined) {
        journal.plan = await provider.transport.upgradeRemovalPlan(journal.plan, verification);
        await provider.assertCurrent();
        await this.writeLibraryRetirement(directory, journal);
      }
      await provider.transport.unpublish(journal.plan, verification, conditionalDeletionProven);
      journal.removedAtUptime = systemDateTime.getUptime(systemDateTime.TimeType.STARTUP);
      await this.writeLibraryRetirement(directory, journal);
      return { state: 'retirementPending' };
    }
    const now = systemDateTime.getUptime(systemDateTime.TimeType.STARTUP);
    if (now < journal.removedAtUptime) {
      // A reboot never credits time against an earlier boot's monotonic clock.
      journal.removedAtUptime = now;
      await this.writeLibraryRetirement(directory, journal);
    }
    if (this.libraryRetirementStatus(journal).phase !== 'parts') {
      await provider.transport.checkRetirementReplacement(journal.plan);
      return { state: 'retirementPending' };
    }
    try {
      await provider.transport.removeRetiredParts(journal.plan, verification);
      await this.unlinkLibraryFile(`${directory}/retirement.json`);
      await recoveryWithFile(directory, fileIo.OpenMode.READ_ONLY, (file): Promise<void> => fileIo.fsync(file.fd));
    } catch (error) {
      await provider.assertCurrent();
      if (error instanceof WebDavLibraryBackupError &&
        ['authentication', 'readOnly', 'conflict', 'replacementUnverified', 'replacementMissingOriginals'].includes(error.reason)) throw error;
      return { state: 'cleanupFailed' };
    }
    return { state: 'retirementCompleted' };
  }

  /** Runs before presenting the app and before any new sync. The durable
   * Core receipt proves whether the atomic Core apply happened, independently
   * of the old process's transient WebDAV transaction or lost response. */
  recoverInterruptedRestore(observation?: SyncWriteObservation): Promise<boolean> {
    const existing = SyncGateway.restoreRecoveries.get(this.runtimeOwner);
    if (existing !== undefined) {
      if (observation === undefined) return existing;
      return existing.then((recovered: boolean): boolean => {
        if (recovered) {
          observation.coreApplied = true; observation.hostApplied = true; observation.completed = true;
          if (observation.write.dispatchedCount === 0) observation.write.dispatched();
          if (observation.write.confirmation() !== 'confirmed') observation.write.confirmed();
        }
        return recovered;
      });
    }
    const recovery = this.recoverRestoreJournal(observation);
    SyncGateway.restoreRecoveries.set(this.runtimeOwner, recovery);
    void recovery.finally((): void => {
      if (SyncGateway.restoreRecoveries.get(this.runtimeOwner) === recovery) SyncGateway.restoreRecoveries.delete(this.runtimeOwner);
    }).catch((): void => {});
    return recovery;
  }

  private async recoverRestoreJournal(observation?: SyncWriteObservation): Promise<boolean> {
    this.assertOwner();
    const journal = await this.credentials.loadRestoreJournal();
    this.assertOwner();
    if (journal === undefined) return false;
    // A pending config blocks an actual restore, not unrelated startup/theme
    // recovery when no approved restore journal exists.
    await this.credentials.requireConfigSettled();
    const queried = await this.runtimeOwner.request('sync.webdav.transaction.commit', {
      transactionId: journal.operationId, appliedChecksum: journal.checksum, queryOnly: true,
    });
    this.assertOwner();
    const receipt = this.decodeTransaction(queried.data);
    this.assertTransactionIdentity(journal.operationId, receipt.transactionId, 'WebDAV restore receipt');
    if (receipt.phase === 'restoreReceiptMissing') {
      // Core config and receipt are one atomic SQLite replacement. With no
      // receipt, no Host choice has been applied: discard only the intent.
      await this.abortBestEffort(journal.operationId);
      await this.credentials.clearRestoreJournal(journal.operationId);
      return false;
    }
    if (receipt.phase !== 'restoreReceiptPresent') throw new Error('Core 恢复记录状态无效');
    if (observation !== undefined) {
      observation.coreApplied = true;
      if (observation.write.dispatchedCount === 0) observation.write.dispatched();
      if (observation.write.confirmation() !== 'confirmed') observation.write.confirmed();
    }
    this.assertOwner();
    if (receipt.hostConfig !== undefined) await this.hostConfiguration.apply(this.hostConfiguration.decode(receipt.hostConfig), journal.operationId);
    if (observation !== undefined) observation.hostApplied = true;
    this.assertOwner();
    const committed = await this.runtimeOwner.request('sync.webdav.transaction.commit', {
      transactionId: journal.operationId, appliedChecksum: journal.checksum,
      hostConfigApplied: receipt.hostConfig !== undefined,
    });
    this.assertOwner();
    const completed = this.decodeTransaction(committed.data);
    this.assertTransactionIdentity(journal.operationId, completed.transactionId, 'WebDAV restore receipt commit');
    if (completed.status !== 'completed' || completed.phase !== 'restoreCompleted') throw new Error('Core 未确认恢复完成');
    await this.credentials.clearRestoreJournal(journal.operationId);
    if (observation !== undefined) observation.completed = true;
    return true;
  }

  async loadSnapshot(recover: boolean = true): Promise<SyncSnapshot> {
    this.assertOwner();
    if (recover) await this.recoverInterruptedRestore();
    const configSaveIntent = await this.credentials.loadConfigIntent();
    const state = await this.credentials.loadSerializedState();
    const configSaveHeadMatchesOriginal = configSaveIntent !== undefined && state.config !== null && state.saveOperationId === configSaveIntent.operationId && state.savePayloadHash === configSaveIntent.payloadHash;
    const configSavePayloadAvailable = configSaveIntent !== undefined && await this.credentials.canContinueConfigIntent(configSaveIntent.operationId);
    const canContinueConfigSave = configSaveIntent !== undefined && !configSaveHeadMatchesOriginal;
    const config = state.config;
    const backupReceipt = await this.reconcileBackupReceipt(false);
    const restoreRecoveryOperationId = (await this.credentials.loadRestoreJournal())?.operationId;
    this.assertOwner();
    if (config === null) {
      return { ...this.copySnapshot(DEFAULT_SYNC_SNAPSHOT), statusMessage: WEBDAV_NOT_CONFIGURED,
        backupReceipt, restoreRecoveryOperationId, configSaveIntent, configSaveHeadMatchesOriginal, canContinueConfigSave, configSavePayloadAvailable };
    }
    return {
      ...this.copySnapshot(DEFAULT_SYNC_SNAPSHOT),
      webdavUrl: config.url,
      webdavUser: config.user,
      webdavPass: '',
      backupPass: '',
      webdavPath: config.directory,
      statusMessage: '已加载安全配置',
      configSaveOperationId: state.saveOperationId,
      configSaveIntent, configSaveHeadMatchesOriginal, canContinueConfigSave, configSavePayloadAvailable,
      backupReceipt, restoreRecoveryOperationId,
    };
  }

  async saveConfig(
    urlValue: string,
    userValue: string,
    passValue: string,
    backupPassValue: string,
    directoryValue: string,
    observation?: SyncWriteObservation,
    admitted?: () => boolean,
  ): Promise<SyncSaveResult> {
    try {
      if (SyncGateway.libraryOperations.has(this.runtimeOwner)) throw new Error('WebDAV library operation active');
      await this.requireBackupSettled();
      const existing = await this.credentials.loadSerialized();
      const normalizedUrl = this.requireBaseUrl(urlValue);
      const user = userValue.trim();
      const password = this.reuseSecret(passValue, existing, normalizedUrl, user, false);
      const backupPassword = this.reuseSecret(backupPassValue, existing, normalizedUrl, user, true);
      const config: StoredWebDavConfig = {
        url: normalizedUrl,
        user,
        password,
        backupPassword,
        directory: this.requireDirectory(directoryValue),
      };
      this.requireCredentialPair(config);
      if (config.backupPassword.length === 0) {
        throw new Error('请设置独立的备份加密密码');
      }
      this.assertAdmission(admitted);
      const operationId = util.generateRandomUUID(true);
      if (observation !== undefined) observation.operationId = operationId;
      await this.credentials.save(config, observation?.write, (): boolean => this.isOwner() && (admitted === undefined || admitted()), operationId);
      if (observation !== undefined) observation.configReceiptQualified = true;
      return {
        ok: true,
        snapshot: {
          ...this.copySnapshot(DEFAULT_SYNC_SNAPSHOT),
          webdavUrl: config.url,
          webdavUser: config.user,
          webdavPath: config.directory,
          statusMessage: '配置已写入系统安全存储',
        },
      };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  async reconcileSavedConfig(operationId: string): Promise<boolean> {
    this.assertOwner();
    const intent = await this.credentials.loadConfigIntent();
    if (intent !== undefined && intent.operationId !== operationId) return false;
    if (intent !== undefined && await this.credentials.reconcileConfigIntent((): boolean => this.isOwner()) !== undefined) return false;
    const confirmed = await this.credentials.hasSaveReceipt(operationId);
    this.assertOwner();
    return confirmed;
  }

  async continueConfigSave(operationId: string, observation: SyncWriteObservation, admitted?: () => boolean,
    urlValue?: string, userValue?: string, passValue?: string, backupPassValue?: string, directoryValue?: string): Promise<void> {
    await this.requireBackupSettled(false);
    this.assertAdmission(admitted);
    observation.operationId = operationId;
    let original: StoredWebDavConfig | undefined;
    if (!await this.credentials.canContinueConfigIntent(operationId)) {
      // Missing original secure staging is recoverable only with the complete
      // exact input. Never reuse a different old envelope's secrets here.
      if (urlValue === undefined || userValue === undefined || passValue === undefined || backupPassValue === undefined || directoryValue === undefined) throw new Error('请重新填写原配置后继续原操作');
      original = { url: this.requireBaseUrl(urlValue), user: userValue.trim(), password: passValue,
        backupPassword: backupPassValue, directory: this.requireDirectory(directoryValue) };
      this.requireCredentialPair(original);
      if (original.backupPassword.length === 0) throw new Error('请重新填写原备份加密密码');
    }
    await this.credentials.continueConfigIntent(operationId, observation.write,
      (): boolean => this.isOwner() && (admitted === undefined || admitted()), original);
    observation.configReceiptQualified = true; observation.completed = true;
  }

  async testConnection(
    urlValue: string,
    userValue: string,
    passValue: string,
    directoryValue: string,
    admitted?: () => boolean,
  ): Promise<SyncTestResult> {
    let transactionId = '';
    try {
      const config = await this.resolveConnectionConfig(urlValue, userValue, passValue, directoryValue);
      const started = await this.startTransaction('connectionTest', config, false, admitted);
      transactionId = started.transactionId;
      const completed = await this.driveTransaction(started, undefined, admitted);
      if (completed.status !== 'completed' || completed.phase !== 'connectionCompleted') {
        throw new Error('Core 未完成 WebDAV 连接事务');
      }
      return { ok: true, note: 'WebDAV 连接成功' };
    } catch (error) {
      await this.abortBestEffort(transactionId);
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  async triggerBackup(observation?: SyncWriteObservation, admitted?: () => boolean): Promise<SyncBackupResult> {
    let transactionId = '';
    const actual = observation ?? new SyncWriteObservation();
    try {
      await this.requireBackupSettled();
      const storedState = await this.credentials.loadSerializedState();
      const config = await this.requireStoredConfig(storedState.config);
      this.assertAdmission(admitted);
      transactionId = 'webdav-' + util.generateRandomUUID(true).replace(/-/g, '').toLowerCase();
      actual.operationId = transactionId;
      await this.credentials.saveBackupJournal({ version: 1, operationId: transactionId, phase: 'prepared', configSaveOperationId: storedState.saveOperationId });
      this.assertAdmission(admitted);
      const started = await this.startTransaction('backup', config, true, admitted, transactionId);
      this.assertTransactionIdentity(transactionId, started.transactionId, 'Core 备份创建');
      const completed = await this.driveTransaction(started, actual, admitted);
      if (completed.status !== 'completed' || completed.phase !== 'backupCompleted') {
        throw new Error('Core 未完成 WebDAV 备份事务');
      }
      if (actual.write.dispatchedCount > 0) actual.write.confirmed();
      actual.uploadQualified = true; actual.completed = true;
      await this.credentials.clearBackupJournal(transactionId);
      return {
        ok: true,
        size: completed.contentBytes ?? 0,
        path: completed.remotePath,
      };
    } catch (error) {
      // This qualification comes from the real HTTP dispatch counter, not
      // the kind/message of the error. Never discard a maybe-sent publisher.
      const undispatched = actual.write.dispatchedCount === 0;
      const aborted = await this.abortBestEffort(transactionId, undispatched);
      if (undispatched && transactionId.length > 0 && aborted) {
        try { await this.credentials.clearBackupJournal(transactionId); } catch (_) { /* exact Core undispatched receipt remains queryable */ }
      }
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  /** Read-only exact publication query. A matching GET qualifies the upload
   * only. Neither a new PUT nor retention DELETE is a recovery action. */
  async reconcileBackupReceipt(allowRemote: boolean = true): Promise<SyncBackupReceipt | undefined> {
    this.assertOwner();
    const journal = await this.credentials.loadBackupJournal();
    this.assertOwner(); if (journal === undefined) return undefined;
    return (await this.queryBackupReceipt(journal, allowRemote)).receipt;
  }

  /** Explicit user termination. The exact upload must still qualify; this
   * records skipped cleanup locally and never sends remote PUT or DELETE. */
  async skipBackupRetention(operationId: string, admitted?: () => boolean): Promise<SyncBackupReceipt> {
    this.assertAdmission(admitted);
    const journal = await this.credentials.loadBackupJournal();
    this.assertAdmission(admitted);
    if (journal === undefined || journal.operationId !== operationId) throw new Error('本次备份记录已变化');
    const checked = await this.queryBackupReceipt(journal, true, admitted);
    this.assertAdmission(admitted);
    if (!checked.receipt.uploadQualified || !checked.receipt.durable) throw new Error('本次上传尚未核实，不能结束清理');
    if (checked.receipt.retentionCompleted || checked.receipt.retentionSkipped) return checked.receipt;
    const result = await this.runtimeOwner.request('sync.webdav.backup.retention.skip', {
      transactionId: operationId, ...(checked.response === undefined ? {} : { response: checked.response }),
    });
    this.assertAdmission(admitted);
    const receipt = this.decodeBackupReceipt(result.data, journal);
    if (!receipt.retentionCompleted && !receipt.retentionSkipped) throw new Error('结束清理尚未获得本地回执');
    return receipt;
  }

  private async queryBackupReceipt(journal: WebDavBackupJournal, allowRemote: boolean,
    admitted?: () => boolean): Promise<SyncBackupQuery> {
    this.assertAdmission(admitted);
    const queried = await this.runtimeOwner.request('sync.webdav.backup.receipt.query', { transactionId: journal.operationId });
    this.assertAdmission(admitted);
    let receipt = this.decodeBackupReceipt(queried.data, journal);
    const requestValue = queried.data['request'];
    if (allowRemote && journal.phase === 'mayDispatch' && !receipt.uploadQualified && requestValue !== undefined) {
      const request = this.requireObject(requestValue, 'Core 备份核对请求');
      if (request['method'] !== 'GET' || typeof request['url'] !== 'string') throw new Error('备份核对必须是原路径只读请求');
      const current = await this.credentials.loadSerializedState(); this.assertAdmission(admitted);
      if (current.config === null || journal.configSaveOperationId !== undefined && current.saveOperationId !== journal.configSaveOperationId) throw new Error('原备份凭据已变化，不能核对远端');
      const configured = url.URL.parseURL(current.config.url), target = url.URL.parseURL(request['url'] as string);
      if (target.protocol !== 'https:' || target.origin !== configured.origin ||
        !target.pathname.startsWith(configured.pathname.replace(/\/$/, '') + '/')) throw new Error('备份核对地址不属于原安全配置');
      const headers = request['headers'] === undefined ? {} : this.requireObject(request['headers'], '备份核对请求头');
      const authorization = this.authorization(current.config); if (authorization !== undefined) headers['Authorization'] = authorization;
      const response = await HttpExecuteHost.instance.execute({ ...request, headers, httpsOnly: true, sameOriginRedirectsOnly: true });
      this.assertAdmission(admitted);
      if (response['status'] === 401 || response['status'] === 403) throw new Error(WEBDAV_AUTH_FAILED);
      const checked = await this.runtimeOwner.request('sync.webdav.backup.receipt.query', { transactionId: journal.operationId, response });
      this.assertAdmission(admitted); receipt = this.decodeBackupReceipt(checked.data, journal);
      return { receipt, response };
    }
    return { receipt };
  }

  private decodeBackupReceipt(data: JsonObject, journal: WebDavBackupJournal): SyncBackupReceipt {
    this.assertTransactionIdentity(journal.operationId, data['transactionId'] as string, '备份发布记录');
    const state = data['receiptState'], uploaded = data['uploadQualified'], completed = data['retentionCompleted'], durable = data['durable'];
    const skipped = data['retentionSkipped'] ?? false;
    if (typeof state !== 'string' || !['missing','prepared','undispatched','uploadAcknowledged','retentionCompleted','retentionSkipped'].includes(state) ||
      typeof uploaded !== 'boolean' || typeof completed !== 'boolean' || typeof durable !== 'boolean' || completed && !uploaded ||
      typeof skipped !== 'boolean' || skipped && (!uploaded || completed) ||
      (state === 'retentionSkipped') !== skipped || state === 'undispatched' && (uploaded || completed || skipped)) throw new Error('Core 备份发布记录无效');
    const undispatched = state === 'undispatched' || journal.phase === 'prepared' && !uploaded && !completed;
    const path = data['remotePath'], bytes = data['contentBytes'];
    if (path !== undefined && (typeof path !== 'string' || path.length > 4096) || bytes !== undefined && (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0)) throw new Error('Core 备份发布摘要无效');
    return { operationId: journal.operationId, receiptState: state, uploadQualified: uploaded && durable,
      retentionCompleted: completed && durable, retentionSkipped: skipped && durable, durable, undispatched, remotePath: path as string | undefined, contentBytes: bytes as number | undefined };
  }

  private async requireBackupSettled(checkConfig: boolean = true): Promise<void> {
    if (checkConfig) await this.credentials.requireConfigSettled();
    const receipt = await this.reconcileBackupReceipt(false);
    if (receipt === undefined) return;
    if (receipt.undispatched) {
      if (!await this.abortBestEffort(receipt.operationId, true)) throw new Error('上一次未发送备份仍在清理');
      this.assertOwner(); await this.credentials.clearBackupJournal(receipt.operationId); this.assertOwner(); return;
    }
    if (!receipt.retentionCompleted && !receipt.retentionSkipped) throw new Error('上一次备份发布或保留清理尚未核定，不重传');
    await this.credentials.clearBackupJournal(receipt.operationId); this.assertOwner();
  }

  async restoreLatest(observation?: SyncWriteObservation, admitted?: () => boolean): Promise<SyncRestoreResult> {
    this.assertAdmission(admitted);
    await this.requireRestoreSettled();
    // A conflict result intentionally leaves the Core transaction alive while
    // the user decides. If the user asks for the latest backup again before
    // resolving that conflict, close the old transaction first; merely
    // dropping the local id would strand its credentials/candidate snapshot
    // until the Core TTL and eventually consume the active-transaction quota.
    const stalePendingTransactionId = this.pendingRestoreTransactionId;
    const staleAborted = await this.abortBestEffort(stalePendingTransactionId);
    if (stalePendingTransactionId.length > 0 && !staleAborted) {
      // Do not start a second restore while the old conflict transaction is
      // still potentially holding credentials and a candidate snapshot. The
      // user can retry once the transient abort/Host failure has cleared.
      return { ok: false, error: '上一次恢复冲突仍在清理，请稍后重试' };
    }
    this.clearPendingRestore();
    let transactionId = '';
    try {
      const configState = await this.credentials.loadSerializedState();
      const config = await this.requireStoredConfig(configState.config);
      this.assertAdmission(admitted);
      const started = await this.startTransaction('restore', config, true, admitted);
      transactionId = started.transactionId;
      const outcome = await this.driveTransaction(started, observation, admitted);
      if (outcome.status === 'conflict') {
        const conflict = this.decodeConflict(outcome);
        this.pendingRestoreTransactionId = outcome.transactionId;
        this.pendingRestoreConfig = configState;
        return { ok: false, conflict, path: conflict.remotePath };
      }
      if (outcome.status !== 'completed' || outcome.phase !== 'restoreCompleted') {
        throw new Error('Core 未完成 WebDAV 恢复事务');
      }
      return { ok: true, applied: false, path: outcome.remotePath };
    } catch (error) {
      if (observation === undefined || observation.write.dispatchedCount === 0) await this.abortBestEffort(transactionId);
      return { ok: false, applied: observation?.coreApplied, error: this.errorMessage(error) };
    }
  }

  async resolveRestore(overwriteLocal: boolean, expectedTransactionId: string, observation?: SyncWriteObservation,
    admitted?: () => boolean): Promise<SyncRestoreResult> {
    await this.credentials.requireConfigSettled();
    this.assertAdmission(admitted);
    const transactionId = this.pendingRestoreTransactionId;
    if (transactionId.length === 0 || transactionId !== expectedTransactionId) {
      return { ok: false, error: '没有待处理的恢复冲突' };
    }
    try {
      if (overwriteLocal) {
        const current = await this.credentials.loadSerializedState();
        this.assertAdmission(admitted);
        if (!this.matchesPendingRestoreConfig(current)) {
          this.pendingRestoreConfig = undefined;
          if (await this.abortBestEffort(transactionId)) this.clearPendingRestore();
          return { ok: false, conflictInvalidated: true, error: WEBDAV_PROVIDER_CHANGED };
        }
      }
      const event = await this.runtimeOwner.request('sync.webdav.transaction.resolve', {
        transactionId,
        choice: overwriteLocal ? 'overwriteLocal' : 'cancel',
      });
      const resolved = this.decodeTransaction(event.data);
      this.assertTransactionIdentity(transactionId, resolved.transactionId,
        'sync.webdav.transaction.resolve');
      const outcome = await this.driveTransaction(resolved, observation, admitted);
      if (outcome.status !== 'completed') {
        throw new Error('Core 未关闭 WebDAV 恢复事务');
      }
      this.clearPendingRestore();
      return {
        ok: true,
        applied: overwriteLocal,
        cancelled: !overwriteLocal,
        path: outcome.remotePath,
      };
    } catch (error) {
      // Keep the ID when abort itself failed: a transient resolve/Host error
      // must remain retryable instead of silently orphaning the Core row.
      const dispatched = (observation?.write.dispatchedCount ?? 0) > 0;
      const aborted = !dispatched && await this.abortBestEffort(transactionId);
      if (aborted) {
        this.clearPendingRestore();
      }
      return { ok: false, applied: observation?.coreApplied, conflictInvalidated: dispatched || aborted,
        error: this.errorMessage(error) };
    }
  }

  private matchesPendingRestoreConfig(current: StoredWebDavState): boolean {
    const original = this.pendingRestoreConfig;
    const left = original?.config;
    const right = current.config;
    return original !== undefined && original.saveOperationId === current.saveOperationId && left != null && right !== null &&
      left.url === right.url && left.directory === right.directory && left.user === right.user &&
      left.password === right.password && left.backupPassword === right.backupPassword;
  }

  private clearPendingRestore(): void {
    this.pendingRestoreTransactionId = '';
    this.pendingRestoreConfig = undefined;
  }

  private async startTransaction(
    operation: string,
    config: StoredWebDavConfig,
    includeEncryption: boolean,
    admitted?: () => boolean,
    publisherOperationId?: string,
  ): Promise<CoreWebDavTransaction> {
    this.assertOwner();
    if (operation !== 'connectionTest') await ReaderThemeHost.prepareUserChange();
    this.assertOwner();
    if (operation !== 'connectionTest') await this.requireRestoreSettled();
    // The backup caller has already admitted old receipts and flushed its own
    // prepared identity. Do not treat that same new intent as an old recovery.
    await this.credentials.requireConfigSettled();
    if (operation !== 'connectionTest' && publisherOperationId === undefined) await this.requireBackupSettled();
    const params: JsonObject = {
      operation,
      baseUrl: config.url,
      directory: config.directory,
      maxBackups: 5,
    };
    if (publisherOperationId !== undefined) params['operationId'] = publisherOperationId;
    if (operation === 'backup' || operation === 'restore') {
      params['hostConfig'] = this.hostConfiguration.encode(await this.hostConfiguration.capture());
      params['systemScheme'] = ReaderThemeHost.observedSystemScheme();
    }
    const authorization = this.authorization(config);
    if (authorization !== undefined) {
      params['auth'] = authorization;
    }
    if (includeEncryption) {
      params['encryptionKey'] = config.backupPassword;
    }
    this.assertAdmission(admitted);
    const event = await this.runtimeOwner.request('sync.webdav.transaction.start', params, { timeoutMs: 30000 });
    return this.decodeTransaction(event.data);
  }

  private async driveTransaction(initial: CoreWebDavTransaction, observation?: SyncWriteObservation, admitted?: () => boolean): Promise<CoreWebDavTransaction> {
    let current = initial;
    for (let step = 0; step < MAX_TRANSACTION_STEPS; step += 1) {
      this.assertAdmission(admitted);
      if (current.status === 'completed' || current.status === 'conflict') {
        return current;
      }
      if (current.status === 'hostRequired') {
        if (current.requests.length === 0) {
          throw new Error('Core WebDAV 事务未提供 Host 请求');
        }
        const responses: JsonObject[] = [];
        for (let index = 0; index < current.requests.length; index += 1) {
          // Core owns WebDAV verbs and payloads; Host pins every hop to the
          // configured HTTPS origin so backup bytes cannot follow a downgrade
          // or cross-origin redirect.
          this.assertAdmission(admitted);
          const request = current.requests[index];
          const method = request['method'];
          if (typeof method === 'string' && method.toUpperCase() === 'DELETE') {
            // A matching filename does not establish ownership. Preserve the
            // verified publication and let the user finish through retention.skip.
            const receipt = await this.reconcileBackupReceipt(false);
            this.assertAdmission(admitted);
            if (receipt?.operationId === current.transactionId && receipt.uploadQualified && observation !== undefined) {
              observation.uploadQualified = true;
              if (observation.write.dispatchedCount > 0) observation.write.confirmed();
            }
            throw new Error(WEBDAV_RETENTION_UNOWNED);
          }
          const mutable = typeof method === 'string' && !['GET', 'HEAD', 'OPTIONS', 'PROPFIND'].includes(method.toUpperCase());
          const uploads = current.phase === 'backupUpload' && method === 'PUT';
          let publication: WebDavBackupJournal | undefined;
          if (uploads) {
            const journal = await this.credentials.loadBackupJournal();
            this.assertAdmission(admitted);
            if (journal === undefined || journal.operationId !== current.transactionId) throw new Error('备份发布记录已变化');
            publication = { ...journal, phase: 'mayDispatch' };
            await this.credentials.saveBackupJournal(publication);
            this.assertAdmission(admitted);
          }
          if (mutable && (current.phase !== 'backupUpload' || uploads) &&
            observation !== undefined && observation.write.dispatchedCount === 0) {
            observation.write.dispatched();
          }
          const headers = request['headers'] === undefined ? {} : this.requireObject(request['headers'], 'Core WebDAV 请求头');
          if (uploads) headers['If-None-Match'] = '*';
          const response = await HttpExecuteHost.instance.execute({
            ...request, headers,
            httpsOnly: true,
            sameOriginRedirectsOnly: true,
          });
          this.assertAdmission(admitted);
          if (response['status'] === 401 || response['status'] === 403) throw new Error(WEBDAV_AUTH_FAILED);
          if (publication !== undefined) {
            const checked = await this.queryBackupReceipt(publication, true, admitted);
            if (!checked.receipt.uploadQualified || !checked.receipt.durable) throw new Error(WEBDAV_READBACK_FAILED);
          }
          if (mutable && observation !== undefined && typeof response['status'] === 'number' &&
            (response['status'] as number) >= 200 && (response['status'] as number) < 300) observation.remoteConfirmedCount += 1;
          this.assertOwner();
          responses.push(response);
        }
        const event = await this.runtimeOwner.request('sync.webdav.transaction.advance', {
          transactionId: current.transactionId,
          responses,
        }, { timeoutMs: 30000 });
        const advanced = this.decodeTransaction(event.data);
        this.assertTransactionIdentity(current.transactionId, advanced.transactionId,
          'sync.webdav.transaction.advance');
        current = advanced;
        continue;
      }
      if (current.status === 'applyRequired') {
        const storageApply = current.storageApply;
        if (storageApply === undefined) {
          throw new Error('Core WebDAV 恢复事务缺少 storage apply 描述符');
        }
        const decodedHost = current.hostConfig === undefined ? undefined : this.hostConfiguration.decode(current.hostConfig);
        const expectedManifest = this.requireObject(storageApply['manifest'], 'WebDAV restore manifest');
        const checksum = expectedManifest['checksum'];
        if (typeof checksum !== 'string' || !/^[0-9a-f]{64}$/.test(checksum)) throw new Error('Core 恢复校验值无效');
        // Persist only identity/checksum. Config credentials and full snapshots
        // never enter Host Preferences. No Host theme changes precede Core apply.
        this.assertAdmission(admitted);
        await this.credentials.saveRestoreJournal({ version: 1, operationId: current.transactionId, checksum });
        let completed: CoreWebDavTransaction;
        try {
          this.assertAdmission(admitted);
          observation?.write.dispatched();
          const applied = await this.runtimeOwner.request('runtime.storage.apply', storageApply, { timeoutMs: 30000 });
          this.assertOwner();
          await this.runtimeOwner.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
          const manifest = this.requireObject(applied.data['manifest'], 'runtime.storage.apply manifest');
          if (typeof manifest['checksum'] !== 'string' || !/^[0-9a-f]{64}$/.test(manifest['checksum'] as string)) {
            throw new Error('Core 恢复结果校验值无效');
          }
          if (observation !== undefined) { observation.coreApplied = true; observation.write.confirmed(); }
          // Core may rebase approved configuration onto newer live progress.
          // The operation receipt binds the original descriptor checksum.
          this.assertOwner();
          if (decodedHost !== undefined) await this.hostConfiguration.apply(decodedHost, current.transactionId);
          if (observation !== undefined) observation.hostApplied = true;
          this.assertOwner();
          const committed = await this.runtimeOwner.request('sync.webdav.transaction.commit', {
            transactionId: current.transactionId, appliedChecksum: checksum,
            hostConfigApplied: current.hostConfig !== undefined,
          });
          completed = this.decodeTransaction(committed.data);
          this.assertTransactionIdentity(current.transactionId, completed.transactionId, 'sync.webdav.transaction.commit');
          this.assertOwner();
          if (completed.status !== 'completed' || completed.phase !== 'restoreCompleted') throw new Error('Core 未确认恢复完成');
          await this.credentials.clearRestoreJournal(current.transactionId);
          if (observation !== undefined) observation.completed = true;
        } catch (error) {
          // A response failure is not evidence that SQLite failed to commit.
          // Query its operation receipt before touching either prior or next data.
          if (!await this.recoverInterruptedRestore(observation)) throw error;
          completed = { ...current, status: 'completed', phase: 'restoreCompleted', requests: [], hostConfig: undefined, storageApply: undefined };
        }
        current = completed;
        continue;
      }
      throw new Error(`Core WebDAV 事务返回未知状态: ${current.status}`);
    }
    throw new Error(`Core WebDAV 事务超过 ${MAX_TRANSACTION_STEPS} 个阶段`);
  }

  private isOwner(): boolean { return ReaderRuntimeOwner.isCurrent(this.runtimeOwner); }

  private assertOwner(): void {
    if (!this.isOwner()) throw new Error('WebDAV runtime owner retired');
  }

  private assertAdmission(admitted?: () => boolean): void {
    this.assertOwner();
    if (admitted !== undefined && !admitted()) throw new Error('WebDAV route retired before dispatch');
  }

  private async requireRestoreSettled(): Promise<void> {
    const journal = await this.credentials.loadRestoreJournal();
    this.assertOwner();
    if (journal !== undefined) throw new Error(WEBDAV_RESTORE_PENDING);
  }

  private assertTransactionIdentity(expected: string, actual: string, operation: string): void {
    if (expected !== actual) {
      throw new Error(`${operation} 返回了不匹配的事务身份`);
    }
  }

  private decodeTransaction(data: JsonObject): CoreWebDavTransaction {
    const transactionId = data['transactionId'];
    const status = data['status'];
    const phase = data['phase'];
    if (typeof transactionId !== 'string' || transactionId.length === 0 || transactionId.length > 128 ||
      transactionId.trim() !== transactionId || /[\u0000-\u001f\u007f]/.test(transactionId) ||
      typeof status !== 'string' || !['hostRequired', 'conflict', 'applyRequired', 'completed'].includes(status) ||
      typeof phase !== 'string' || phase.length === 0 || phase.length > 256 ||
      phase.trim() !== phase || /[\u0000-\u001f\u007f]/.test(phase)) {
      throw new Error('Core 返回了无效的 WebDAV 事务');
    }
    const requestsValue = data['requests'];
    const requests: JsonObject[] = [];
    if (requestsValue !== undefined) {
      if (!Array.isArray(requestsValue)) {
        throw new Error('Core WebDAV requests 不是数组');
      }
      if (requestsValue.length > MAX_TRANSACTION_REQUESTS) {
        throw new Error(`Core WebDAV requests 超过 ${MAX_TRANSACTION_REQUESTS} 项`);
      }
      for (let index = 0; index < requestsValue.length; index += 1) {
        requests.push(this.requireObject(requestsValue[index], `Core WebDAV requests[${index}]`));
      }
    }
    const transaction: CoreWebDavTransaction = { transactionId, status, phase, requests };
    const migrationReason = data['themeMigrationReason'];
    if (migrationReason !== undefined) {
      if (typeof migrationReason !== 'string' || migrationReason.length > 256 || /[\u0000-\u001f\u007f]/.test(migrationReason)) {
        throw new Error('Core 主题迁移诊断无效');
      }
      if (migrationReason.length > 0) AppStorage.setOrCreate('readerThemeRestoreFallback', migrationReason);
    }
    if (data['storageApply'] !== undefined) {
      transaction.storageApply = this.requireObject(data['storageApply'], 'Core WebDAV storageApply');
    }
    if (data['hostConfig'] !== undefined) {
      if (status !== 'applyRequired' && !(status === 'completed' && phase === 'restoreReceiptPresent')) {
        throw new Error('未经手动确认不能应用本机配置');
      }
      transaction.hostConfig = this.requireObject(data['hostConfig'], 'Core WebDAV hostConfig');
      this.hostConfiguration.decode(transaction.hostConfig);
    }
    if (data['conflict'] !== undefined) {
      transaction.conflict = this.requireObject(data['conflict'], 'Core WebDAV conflict');
    }
    const backupId = data['backupId'];
    if (backupId !== undefined) {
      if (typeof backupId !== 'string' || backupId.length === 0 ||
        backupId.length > 256 || backupId.trim() !== backupId ||
        /[\u0000-\u001f\u007f]/.test(backupId)) {
        throw new Error('Core WebDAV backupId 无效');
      }
      transaction.backupId = backupId;
    }
    const remotePath = data['remotePath'];
    if (remotePath !== undefined) {
      if (typeof remotePath !== 'string' || remotePath.length === 0 ||
        remotePath.length > 4096 || remotePath.trim() !== remotePath ||
        /[\u0000-\u001f\u007f]/.test(remotePath)) {
        throw new Error('Core WebDAV remotePath 无效');
      }
      transaction.remotePath = remotePath;
    }
    if (data['contentBytes'] !== undefined) {
      if (typeof data['contentBytes'] !== 'number' || !Number.isSafeInteger(data['contentBytes']) ||
        data['contentBytes'] < 0) {
        throw new Error('Core WebDAV contentBytes 无效');
      }
      transaction.contentBytes = data['contentBytes'] as number;
    }
    if (data['deletedCount'] !== undefined) {
      if (typeof data['deletedCount'] !== 'number' || !Number.isSafeInteger(data['deletedCount']) ||
        data['deletedCount'] < 0) {
        throw new Error('Core WebDAV deletedCount 无效');
      }
      transaction.deletedCount = data['deletedCount'] as number;
    }
    return transaction;
  }

  private decodeConflict(transaction: CoreWebDavTransaction): SyncRestoreConflict {
    const conflict = transaction.conflict;
    if (conflict === undefined) {
      throw new Error('Core WebDAV 冲突结果缺少摘要');
    }
    const backupId = conflict['backupId'];
    const remotePath = conflict['remotePath'];
    const localChecksum = conflict['localChecksum'];
    const remoteChecksum = conflict['remoteChecksum'];
    const localExportedAt = conflict['localExportedAt'];
    const remoteExportedAt = conflict['remoteExportedAt'];
    if (typeof backupId !== 'string' || typeof remotePath !== 'string' ||
      typeof localChecksum !== 'string' || typeof remoteChecksum !== 'string' ||
      typeof localExportedAt !== 'number' || typeof remoteExportedAt !== 'number') {
      throw new Error('Core WebDAV 冲突摘要无效');
    }
    return {
      transactionId: transaction.transactionId,
      backupId,
      remotePath,
      localChecksum,
      remoteChecksum,
      localExportedAt,
      remoteExportedAt,
    };
  }

  private async abortBestEffort(transactionId: string, publisherUndispatched: boolean = false): Promise<boolean> {
    if (transactionId.length === 0) {
      return true;
    }
    try {
      await this.runtimeOwner.request('sync.webdav.transaction.abort', publisherUndispatched ? { transactionId, publisherUndispatched: true } : { transactionId });
      return true;
    } catch (error) {
      // Core removes a transaction atomically on completion/abort. If the
      // Host loses that acknowledgement, a follow-up abort returns this
      // deterministic INVALID_PARAMS error; treating it as success keeps a
      // stale restore id from becoming a permanent retry trap while still
      // preserving transient transport failures for a later retry.
      return this.isAlreadyClosedTransactionError(error);
    }
  }

  private isAlreadyClosedTransactionError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const event = (error as { event?: unknown })['event'];
    if (typeof event !== 'object' || event === null) {
      return false;
    }
    const structured = (event as { error?: unknown })['error'];
    if (typeof structured !== 'object' || structured === null) {
      return false;
    }
    const code = (structured as { code?: unknown })['code'];
    const message = (structured as { message?: unknown })['message'];
    return code === 'INVALID_PARAMS' && typeof message === 'string' &&
      message.includes('unknown or completed WebDAV transaction');
  }

  private async resolveConnectionConfig(
    urlValue: string,
    userValue: string,
    passValue: string,
    directoryValue: string,
  ): Promise<StoredWebDavConfig> {
    const existing = await this.credentials.loadSerialized();
    const normalizedUrl = this.requireBaseUrl(urlValue);
    const user = userValue.trim();
    const config: StoredWebDavConfig = {
      url: normalizedUrl,
      user,
      password: this.reuseSecret(passValue, existing, normalizedUrl, user, false),
      backupPassword: existing?.backupPassword ?? 'connection-test-only',
      directory: this.requireDirectory(directoryValue),
    };
    this.requireCredentialPair(config);
    return config;
  }

  private reuseSecret(
    entered: string,
    existing: StoredWebDavConfig | null,
    normalizedUrl: string,
    user: string,
    backup: boolean,
  ): string {
    if (entered.length > 0) {
      return entered;
    }
    if (existing !== null && existing.url === normalizedUrl && existing.user === user) {
      return backup ? existing.backupPassword : existing.password;
    }
    return '';
  }

  private async requireStoredConfig(observed?: StoredWebDavConfig | null): Promise<StoredWebDavConfig> {
    const config = observed === undefined ? await this.credentials.loadSerialized() : observed;
    if (config === null) {
      throw new Error(WEBDAV_NOT_CONFIGURED);
    }
    this.requireBaseUrl(config.url);
    this.requireDirectory(config.directory);
    this.requireCredentialPair(config);
    if (config.backupPassword.length === 0) {
      throw new Error('安全配置中没有备份加密密码');
    }
    return config;
  }

  private authorization(config: StoredWebDavConfig): string | undefined {
    if (config.user.length === 0) {
      return undefined;
    }
    const bytes = new util.TextEncoder('utf-8').encodeInto(`${config.user}:${config.password}`);
    return 'Basic ' + new util.Base64Helper().encodeToStringSync(bytes);
  }

  private requireCredentialPair(config: StoredWebDavConfig): void {
    if ((config.user.length === 0) !== (config.password.length === 0)) {
      throw new Error('WebDAV 账号和密码必须同时填写或同时留空');
    }
  }

  private requireBaseUrl(value: string): string {
    const normalized = value.trim().replace(/\/+$/, '');
    let parsed: url.URL;
    try {
      parsed = url.URL.parseURL(normalized);
    } catch (_) {
      throw new Error('WebDAV 服务器地址无效');
    }
    // WebDAV credentials and encrypted snapshots cross this boundary.  Keep
    // the product path HTTPS-only so an accidentally pasted `http://` URL
    // can never turn the following Basic Authorization header into cleartext
    // traffic.  Generic source HTTP remains a separate, explicitly bounded
    // transport and does not weaken this credential-bearing surface.
    if (parsed.protocol !== 'https:' || parsed.hostname.length === 0 ||
      parsed.username.length > 0 || parsed.password.length > 0 || parsed.search.length > 0 || parsed.hash.length > 0) {
      throw new Error('WebDAV 服务器地址必须是无凭据、query 和 fragment 的 HTTPS URL');
    }
    return normalized;
  }

  private requireDirectory(value: string): string {
    let normalized = value.trim();
    if (normalized.length === 0) {
      normalized = DEFAULT_WEBDAV_DIRECTORY;
    }
    // Keep this Host-side admission in lockstep with Core's path validator.
    // Encoded dot segments are decoded by some WebDAV servers, so rejecting
    // only a literal `..` would leave a configuration that can escape its
    // intended collection (or fail later after being persisted).
    if (normalized.length > MAX_WEBDAV_DIRECTORY_LENGTH ||
      !normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\') ||
      normalized.indexOf('?') !== -1 || normalized.indexOf('#') !== -1 ||
      /[\u0000-\u001f\u007f]/.test(normalized) ||
      normalized.toLowerCase().includes('%2e')) {
      throw new Error('WebDAV 同步目录必须是无上级跳转的绝对路径');
    }
    return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
  }

  private requireObject(value: unknown, name: string): JsonObject {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${name} 无效`);
    }
    return value as JsonObject;
  }

  private copySnapshot(snapshot: SyncSnapshot): SyncSnapshot {
    return {
      webdavUrl: snapshot.webdavUrl,
      webdavUser: snapshot.webdavUser,
      webdavPass: '',
      backupPass: '',
      webdavPath: snapshot.webdavPath,
      saveLocation: snapshot.saveLocation,
      backupFrequency: snapshot.backupFrequency,
      backupScope: snapshot.backupScope,
      history: snapshot.history.slice(),
      statusMessage: snapshot.statusMessage,
      restoreConflict: snapshot.restoreConflict,
    };
  }

  private errorMessage(error: unknown): string {
    return syncFailureMessage(error);
  }
}
