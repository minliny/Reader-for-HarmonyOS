import type { JsonObject } from '@reader/core-harmony';
import { errorMessageOf } from '../../app/ErrorMessage';
import util from '@ohos.util';
import url from '@ohos.url';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { HttpExecuteHost } from '../../app/HttpExecuteHost';
import {
  type StoredWebDavConfig,
  WebDavCredentialStore,
} from './WebDavCredentialStore';

const DEFAULT_WEBDAV_DIRECTORY = '/ReaderBackup/ReaderHarmony';
const MAX_TRANSACTION_STEPS = 12;

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
};

export type SyncTestResult = { ok: boolean; error?: string; note?: string };
export type SyncSaveResult = { ok: boolean; error?: string; snapshot?: SyncSnapshot };
export type SyncBackupResult = { ok: boolean; size?: number; path?: string; error?: string };
export type SyncRestoreResult = {
  ok: boolean;
  applied?: boolean;
  cancelled?: boolean;
  conflict?: SyncRestoreConflict;
  path?: string;
  error?: string;
};

type CoreWebDavTransaction = {
  transactionId: string;
  status: string;
  phase: string;
  requests: JsonObject[];
  storageApply?: JsonObject;
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
  backupScope: '完整 Core 数据（AES 加密）',
  history: [],
  statusMessage: '',
};

/**
 * Foreground WebDAV product gateway.
 *
 * Core owns every transaction phase: AES package creation, backup naming,
 * retention, restore selection, conflict and resolution. The Host owns only
 * AssetStore, real HTTP execution and forwarding Core's opaque storage-apply
 * descriptor through the standard runtime command.
 */
export class SyncGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private readonly credentials: WebDavCredentialStore;
  private pendingRestoreTransactionId: string = '';

  constructor(
    runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
    credentials: WebDavCredentialStore = WebDavCredentialStore.instance,
  ) {
    this.runtimeOwner = runtimeOwner;
    this.credentials = credentials;
  }

  async loadSnapshot(): Promise<SyncSnapshot> {
    const config = await this.credentials.load();
    if (config === null) {
      return this.copySnapshot(DEFAULT_SYNC_SNAPSHOT);
    }
    return {
      ...this.copySnapshot(DEFAULT_SYNC_SNAPSHOT),
      webdavUrl: config.url,
      webdavUser: config.user,
      webdavPass: '',
      backupPass: '',
      webdavPath: config.directory,
      statusMessage: '已加载安全配置',
    };
  }

  async saveConfig(
    urlValue: string,
    userValue: string,
    passValue: string,
    backupPassValue: string,
    directoryValue: string,
  ): Promise<SyncSaveResult> {
    try {
      const existing = await this.credentials.load();
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
      await this.credentials.save(config);
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

  async testConnection(
    urlValue: string,
    userValue: string,
    passValue: string,
    directoryValue: string,
  ): Promise<SyncTestResult> {
    let transactionId = '';
    try {
      const config = await this.resolveConnectionConfig(urlValue, userValue, passValue, directoryValue);
      const started = await this.startTransaction('connectionTest', config, false);
      transactionId = started.transactionId;
      const completed = await this.driveTransaction(started);
      if (completed.status !== 'completed' || completed.phase !== 'connectionCompleted') {
        throw new Error('Core 未完成 WebDAV 连接事务');
      }
      return { ok: true, note: 'WebDAV 连接成功' };
    } catch (error) {
      await this.abortBestEffort(transactionId);
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  async triggerBackup(): Promise<SyncBackupResult> {
    let transactionId = '';
    try {
      const config = await this.requireStoredConfig();
      const started = await this.startTransaction('backup', config, true);
      transactionId = started.transactionId;
      const completed = await this.driveTransaction(started);
      if (completed.status !== 'completed' || completed.phase !== 'backupCompleted') {
        throw new Error('Core 未完成 WebDAV 备份事务');
      }
      return {
        ok: true,
        size: completed.contentBytes ?? 0,
        path: completed.remotePath,
      };
    } catch (error) {
      await this.abortBestEffort(transactionId);
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  async restoreLatest(): Promise<SyncRestoreResult> {
    this.pendingRestoreTransactionId = '';
    let transactionId = '';
    try {
      const config = await this.requireStoredConfig();
      const started = await this.startTransaction('restore', config, true);
      transactionId = started.transactionId;
      const outcome = await this.driveTransaction(started);
      if (outcome.status === 'conflict') {
        const conflict = this.decodeConflict(outcome);
        this.pendingRestoreTransactionId = outcome.transactionId;
        return { ok: false, conflict, path: conflict.remotePath };
      }
      if (outcome.status !== 'completed' || outcome.phase !== 'restoreCompleted') {
        throw new Error('Core 未完成 WebDAV 恢复事务');
      }
      return { ok: true, applied: false, path: outcome.remotePath };
    } catch (error) {
      await this.abortBestEffort(transactionId);
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  async resolveRestore(overwriteLocal: boolean): Promise<SyncRestoreResult> {
    const transactionId = this.pendingRestoreTransactionId;
    if (transactionId.length === 0) {
      return { ok: false, error: '没有待处理的恢复冲突' };
    }
    this.pendingRestoreTransactionId = '';
    try {
      const event = await this.runtimeOwner.request('sync.webdav.transaction.resolve', {
        transactionId,
        choice: overwriteLocal ? 'overwriteLocal' : 'cancel',
      });
      const outcome = await this.driveTransaction(this.decodeTransaction(event.data));
      if (outcome.status !== 'completed') {
        throw new Error('Core 未关闭 WebDAV 恢复事务');
      }
      return {
        ok: true,
        applied: overwriteLocal,
        cancelled: !overwriteLocal,
        path: outcome.remotePath,
      };
    } catch (error) {
      await this.abortBestEffort(transactionId);
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  private async startTransaction(
    operation: string,
    config: StoredWebDavConfig,
    includeEncryption: boolean,
  ): Promise<CoreWebDavTransaction> {
    const params: JsonObject = {
      operation,
      baseUrl: config.url,
      directory: config.directory,
      maxBackups: 5,
    };
    const authorization = this.authorization(config);
    if (authorization !== undefined) {
      params['auth'] = authorization;
    }
    if (includeEncryption) {
      params['encryptionKey'] = config.backupPassword;
    }
    const event = await this.runtimeOwner.request('sync.webdav.transaction.start', params, { timeoutMs: 30000 });
    return this.decodeTransaction(event.data);
  }

  private async driveTransaction(initial: CoreWebDavTransaction): Promise<CoreWebDavTransaction> {
    let current = initial;
    for (let step = 0; step < MAX_TRANSACTION_STEPS; step += 1) {
      if (current.status === 'completed' || current.status === 'conflict') {
        return current;
      }
      if (current.status === 'hostRequired') {
        if (current.requests.length === 0) {
          throw new Error('Core WebDAV 事务未提供 Host 请求');
        }
        const responses: JsonObject[] = [];
        for (let index = 0; index < current.requests.length; index += 1) {
          responses.push(await HttpExecuteHost.instance.execute(current.requests[index]));
        }
        const event = await this.runtimeOwner.request('sync.webdav.transaction.advance', {
          transactionId: current.transactionId,
          responses,
        }, { timeoutMs: 30000 });
        current = this.decodeTransaction(event.data);
        continue;
      }
      if (current.status === 'applyRequired') {
        const storageApply = current.storageApply;
        if (storageApply === undefined) {
          throw new Error('Core WebDAV 恢复事务缺少 storage apply 描述符');
        }
        const applied = await this.runtimeOwner.request('runtime.storage.apply', storageApply, { timeoutMs: 30000 });
        await this.runtimeOwner.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
        const manifest = this.requireObject(applied.data['manifest'], 'runtime.storage.apply manifest');
        const checksum = manifest['checksum'];
        if (typeof checksum !== 'string') {
          throw new Error('runtime.storage.apply 未返回 checksum');
        }
        const committed = await this.runtimeOwner.request('sync.webdav.transaction.commit', {
          transactionId: current.transactionId,
          appliedChecksum: checksum,
        });
        current = this.decodeTransaction(committed.data);
        continue;
      }
      throw new Error(`Core WebDAV 事务返回未知状态: ${current.status}`);
    }
    throw new Error(`Core WebDAV 事务超过 ${MAX_TRANSACTION_STEPS} 个阶段`);
  }

  private decodeTransaction(data: JsonObject): CoreWebDavTransaction {
    const transactionId = data['transactionId'];
    const status = data['status'];
    const phase = data['phase'];
    if (typeof transactionId !== 'string' || transactionId.length === 0 ||
      typeof status !== 'string' || typeof phase !== 'string') {
      throw new Error('Core 返回了无效的 WebDAV 事务');
    }
    const requestsValue = data['requests'];
    const requests: JsonObject[] = [];
    if (requestsValue !== undefined) {
      if (!Array.isArray(requestsValue)) {
        throw new Error('Core WebDAV requests 不是数组');
      }
      for (let index = 0; index < requestsValue.length; index += 1) {
        requests.push(this.requireObject(requestsValue[index], `Core WebDAV requests[${index}]`));
      }
    }
    const transaction: CoreWebDavTransaction = { transactionId, status, phase, requests };
    if (data['storageApply'] !== undefined) {
      transaction.storageApply = this.requireObject(data['storageApply'], 'Core WebDAV storageApply');
    }
    if (data['conflict'] !== undefined) {
      transaction.conflict = this.requireObject(data['conflict'], 'Core WebDAV conflict');
    }
    if (typeof data['backupId'] === 'string') {
      transaction.backupId = data['backupId'] as string;
    }
    if (typeof data['remotePath'] === 'string') {
      transaction.remotePath = data['remotePath'] as string;
    }
    if (typeof data['contentBytes'] === 'number') {
      transaction.contentBytes = data['contentBytes'] as number;
    }
    if (typeof data['deletedCount'] === 'number') {
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

  private async abortBestEffort(transactionId: string): Promise<void> {
    if (transactionId.length === 0) {
      return;
    }
    try {
      await this.runtimeOwner.request('sync.webdav.transaction.abort', { transactionId });
    } catch (_) {
      // Advance may already have atomically removed a failed transaction.
    }
  }

  private async resolveConnectionConfig(
    urlValue: string,
    userValue: string,
    passValue: string,
    directoryValue: string,
  ): Promise<StoredWebDavConfig> {
    const existing = await this.credentials.load();
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

  private async requireStoredConfig(): Promise<StoredWebDavConfig> {
    const config = await this.credentials.load();
    if (config === null) {
      throw new Error('请先安全保存 WebDAV 配置');
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
    const bytes = new util.TextEncoder('utf-8').encode(`${config.user}:${config.password}`);
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
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.hostname.length === 0 ||
      parsed.username.length > 0 || parsed.password.length > 0 || parsed.search.length > 0 || parsed.hash.length > 0) {
      throw new Error('WebDAV 服务器地址必须是无凭据、query 和 fragment 的 http(s) URL');
    }
    return normalized;
  }

  private requireDirectory(value: string): string {
    let normalized = value.trim();
    if (normalized.length === 0) {
      normalized = DEFAULT_WEBDAV_DIRECTORY;
    }
    if (!normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\\') ||
      normalized.indexOf('?') !== -1 || normalized.indexOf('#') !== -1) {
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
    return errorMessageOf(error);
  }
}
