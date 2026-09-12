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
const MAX_TRANSACTION_REQUESTS = 100;
const MAX_WEBDAV_DIRECTORY_LENGTH = 4096;

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
    // A conflict result intentionally leaves the Core transaction alive while
    // the user decides. If the user asks for the latest backup again before
    // resolving that conflict, close the old transaction first; merely
    // dropping the local id would strand its credentials/candidate snapshot
    // until the Core TTL and eventually consume the active-transaction quota.
    const stalePendingTransactionId = this.pendingRestoreTransactionId;
    this.pendingRestoreTransactionId = '';
    const staleAborted = await this.abortBestEffort(stalePendingTransactionId);
    if (stalePendingTransactionId.length > 0 && !staleAborted) {
      // Do not start a second restore while the old conflict transaction is
      // still potentially holding credentials and a candidate snapshot. The
      // user can retry once the transient abort/Host failure has cleared.
      this.pendingRestoreTransactionId = stalePendingTransactionId;
      return { ok: false, error: '上一次恢复冲突仍在清理，请稍后重试' };
    }
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
    try {
      const event = await this.runtimeOwner.request('sync.webdav.transaction.resolve', {
        transactionId,
        choice: overwriteLocal ? 'overwriteLocal' : 'cancel',
      });
      const resolved = this.decodeTransaction(event.data);
      this.assertTransactionIdentity(transactionId, resolved.transactionId,
        'sync.webdav.transaction.resolve');
      const outcome = await this.driveTransaction(resolved);
      if (outcome.status !== 'completed') {
        throw new Error('Core 未关闭 WebDAV 恢复事务');
      }
      this.pendingRestoreTransactionId = '';
      return {
        ok: true,
        applied: overwriteLocal,
        cancelled: !overwriteLocal,
        path: outcome.remotePath,
      };
    } catch (error) {
      // Keep the ID when abort itself failed: a transient resolve/Host error
      // must remain retryable instead of silently orphaning the Core row.
      if (await this.abortBestEffort(transactionId)) {
        this.pendingRestoreTransactionId = '';
      } else {
        this.pendingRestoreTransactionId = transactionId;
      }
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
        const completed = this.decodeTransaction(committed.data);
        this.assertTransactionIdentity(current.transactionId, completed.transactionId,
          'sync.webdav.transaction.commit');
        current = completed;
        continue;
      }
      throw new Error(`Core WebDAV 事务返回未知状态: ${current.status}`);
    }
    throw new Error(`Core WebDAV 事务超过 ${MAX_TRANSACTION_STEPS} 个阶段`);
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
    if (data['storageApply'] !== undefined) {
      transaction.storageApply = this.requireObject(data['storageApply'], 'Core WebDAV storageApply');
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

  private async abortBestEffort(transactionId: string): Promise<boolean> {
    if (transactionId.length === 0) {
      return true;
    }
    try {
      await this.runtimeOwner.request('sync.webdav.transaction.abort', { transactionId });
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
    return errorMessageOf(error);
  }
}
