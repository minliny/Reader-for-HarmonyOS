import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import preferences from '@ohos.data.preferences';
import asset from '@ohos.security.asset';
import util from '@ohos.util';
import { errorMessageOf } from '../../app/ErrorMessage';
import type { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';

const ASSET_ALIAS = 'reader.webdav.config.v2';
const CONFIG_RECORD_PREFIX = 'reader.webdav.config-save.';
const CONFIG_HEAD_FILE = 'reader-webdav-config-head-v1.json';
const CONFIG_INTENT_FILE = 'reader-webdav-config-intent-v1.json';
const FORMAT_VERSION = 2;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 4096;
const LOCAL_PREFERENCES_NAME = 'reader_webdav_local_v1';
const LOCAL_VIEW_MODE_KEY = 'bookshelfViewMode';
const LOCAL_MIGRATION_KEY = 'bookshelfConfigVersion';
const LOCAL_CONFIG_VERSION = 1;
const LOCAL_RESTORE_JOURNAL_KEY = 'webdavRestoreJournal';
const LOCAL_BACKUP_JOURNAL_KEY = 'webdavBackupJournal';

export interface WebDavBackupJournal {
  version: number;
  operationId: string;
  phase: 'prepared' | 'mayDispatch';
  configSaveOperationId?: string;
}

export interface WebDavRestoreJournal {
  version: number;
  operationId: string;
  checksum: string;
}

export type StoredWebDavConfig = {
  url: string;
  user: string;
  password: string;
  backupPassword: string;
  directory: string;
  /** Legacy migration input only. New Asset records never contain this field. */
  bookshelfViewMode?: 'cover' | 'list';
};

type StoredWebDavEnvelope = {
  formatVersion: number;
  config: StoredWebDavConfig;
  /** Non-secret identity committed atomically with this exact configuration. */
  saveOperationId?: string;
  savePayloadHash?: string;
};

export interface WebDavConfigIntent {
  version: 1;
  operationId: string;
  payloadHash: string;
  phase: 'prepared' | 'mayDispatch' | 'confirmed';
  previousOperationId?: string;
  previousPayloadHash?: string;
  previousWasLegacy?: boolean;
}

interface WebDavConfigHead { version: 1; operationId: string; payloadHash: string; }

export interface StoredWebDavState {
  config: StoredWebDavConfig | null;
  saveOperationId?: string;
  savePayloadHash?: string;
}

/**
 * Sole persistent authority for WebDAV credentials.
 *
 * The password never enters Core-owned storage or the ArkUI snapshot. The
 * complete configuration is kept in AssetStore so a copied application data
 * file cannot reveal the server credential. The AssetStore record is removed
 * with the application; it deliberately does not use the uninstall-persistent
 * tag.
 */
export class WebDavCredentialStore {
  static readonly instance: WebDavCredentialStore = new WebDavCredentialStore();

  private static writeTail: Promise<void> = Promise.resolve();
  private static warmIntent: WebDavConfigIntent | undefined;
  private static warmPath: string = '';
  private static activeConfig: boolean = false;
  private localModeWriteTail: Promise<void> = Promise.resolve();
  private context: common.UIAbilityContext | undefined;
  private localPreferences: preferences.Preferences | undefined;
  private contextGeneration: number = 0;
  private confirmedBookshelfMode: 'cover' | 'list' | undefined;
  private pendingBookshelfModeWrites: number = 0;

  /** Attach the ability context for non-secret WebDAV-adjacent preferences. */
  attachContext(context: common.UIAbilityContext): void {
    if (this.context === context) return;
    this.contextGeneration += 1;
    this.context = context;
    this.localPreferences = undefined;
    this.confirmedBookshelfMode = undefined;
  }

  async load(): Promise<StoredWebDavConfig | null> {
    return (await this.loadState()).config;
  }

  private async loadState(alias?: string, path: string = this.intentPath()): Promise<StoredWebDavState> {
    if (alias === undefined) {
      const head = await this.readConfigHead(path);
      if (head === null) return { config: null };
      if (head === undefined) return this.loadState(ASSET_ALIAS, path);
      const state = await this.loadState(this.configRecordAlias(head.operationId), path);
      if (!this.matchesConfigIntent(state, head)) throw new Error('WebDAV current immutable configuration binding invalid');
      return state;
    }
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(alias));
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    let records: Array<asset.AssetMap>;
    try {
      records = await asset.query(query);
    } catch (error) {
      if (this.errorCode(error) === asset.ErrorCode.NOT_FOUND) {
        return { config: null };
      }
      throw new Error(`WebDAV secure configuration cannot be read: ${this.errorMessage(error)}`);
    }
    if (records.length === 0) {
      return { config: null };
    }
    const secret = records[0].get(asset.Tag.SECRET);
    if (!(secret instanceof Uint8Array)) {
      throw new Error('WebDAV secure configuration has no secret payload');
    }
    let envelope: StoredWebDavEnvelope;
    try {
      envelope = JSON.parse(util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(secret)) as
        StoredWebDavEnvelope;
    } catch (error) {
      throw new Error(`WebDAV secure configuration is invalid: ${this.errorMessage(error)}`);
    }
    if (envelope.formatVersion !== FORMAT_VERSION || !this.isConfig(envelope.config)) {
      throw new Error('WebDAV secure configuration has an unsupported format');
    }
    if (envelope.saveOperationId !== undefined) this.validateSaveOperationId(envelope.saveOperationId);
    if (envelope.savePayloadHash !== undefined && (typeof envelope.savePayloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.savePayloadHash) ||
      envelope.savePayloadHash !== await this.configHash(this.normalize(envelope.config)))) throw new Error('WebDAV secure payload binding is invalid');
    return { saveOperationId: envelope.saveOperationId, savePayloadHash: envelope.savePayloadHash, config: {
      url: envelope.config.url,
      user: envelope.config.user,
      password: envelope.config.password,
      backupPassword: envelope.config.backupPassword,
      directory: envelope.config.directory,
      bookshelfViewMode: envelope.config.bookshelfViewMode,
    } };
  }

  /** Reuse the current context's acknowledged choice after startup/recovery.
   * Pending writes must take the serialized read path on a route remount. */
  currentBookshelfViewMode(): 'cover' | 'list' | undefined {
    return this.pendingBookshelfModeWrites === 0 ? this.confirmedBookshelfMode : undefined;
  }

  bookshelfModeContextGeneration(): number { return this.contextGeneration; }

  loadBookshelfViewMode(allowMigration: boolean = true): Promise<'cover' | 'list'> {
    const generation = this.contextGeneration;
    const next = this.localModeWriteTail.then(async (): Promise<'cover' | 'list'> => {
      try {
        if (generation !== this.contextGeneration) throw new Error('BOOKSHELF_VIEW_MODE_RETIRED');
        const mode = await this.readOrMigrateViewMode(allowMigration);
        if (generation !== this.contextGeneration) throw new Error('BOOKSHELF_VIEW_MODE_RETIRED');
        if (generation === this.contextGeneration) this.confirmedBookshelfMode = mode;
        return mode;
      } catch (error) {
        if (generation === this.contextGeneration) this.confirmedBookshelfMode = undefined;
        throw error;
      }
    });
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  /** One serialized non-secret authority; credential edits never mirror mode. */
  saveBookshelfViewMode(mode: 'cover' | 'list', restoreOperationId?: string,
    observation?: ReaderWriteEvidence, isCurrent: () => boolean = (): boolean => true): Promise<void> {
    const generation = this.contextGeneration;
    this.pendingBookshelfModeWrites += 1;
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      if (generation !== this.contextGeneration || !isCurrent()) throw new Error('BOOKSHELF_VIEW_MODE_RETIRED');
      await this.readOrMigrateViewMode();
      if (generation !== this.contextGeneration || !isCurrent()) throw new Error('BOOKSHELF_VIEW_MODE_RETIRED');
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_RESTORE_JOURNAL_KEY, '');
      if (raw !== '') {
        if (typeof raw !== 'string') throw new Error('BOOKSHELF_RESTORE_PENDING');
        const journal = JSON.parse(raw) as WebDavRestoreJournal;
        this.validateRestoreJournal(journal);
        if (journal.operationId !== restoreOperationId) throw new Error('BOOKSHELF_RESTORE_PENDING');
      }
      await this.writeLocalViewMode(store, mode, observation,
        (): boolean => generation === this.contextGeneration && isCurrent());
      if (generation === this.contextGeneration) this.confirmedBookshelfMode = mode;
    }).catch((error: Error): never => {
      if (generation === this.contextGeneration) this.confirmedBookshelfMode = undefined;
      throw error;
    }).finally((): void => {
      this.pendingBookshelfModeWrites -= 1;
    });
    this.localModeWriteTail = next.catch((): void => {});
    return next;
  }

  private async readOrMigrateViewMode(allowMigration: boolean = true): Promise<'cover' | 'list'> {
    const store = await this.ensureLocalPreferences();
    const present = await store.has(LOCAL_VIEW_MODE_KEY);
    const stored = await store.get(LOCAL_VIEW_MODE_KEY, 'cover');
    const version = await store.get(LOCAL_MIGRATION_KEY, 0);
    if (present) {
      if (stored !== 'cover' && stored !== 'list') throw new Error('BOOKSHELF_VIEW_MODE_INVALID');
      const mode = stored === 'list' ? 'list' : 'cover';
      if (allowMigration && version !== LOCAL_CONFIG_VERSION) await this.writeLocalViewMode(store, mode);
      return mode;
    }
    if (!allowMigration) throw new Error('BOOKSHELF_VIEW_MODE_MISSING');
    // Only a truly absent local key may consult the legacy raw Asset field.
    // Never interpret load()'s former synthetic cover as a prior user choice.
    const legacy = version === LOCAL_CONFIG_VERSION ? null : await this.load();
    const mode = legacy?.bookshelfViewMode === 'list' ? 'list' : 'cover';
    await this.writeLocalViewMode(store, mode);
    return mode;
  }

  private async writeLocalViewMode(store: preferences.Preferences, mode: 'cover' | 'list',
    observation?: ReaderWriteEvidence, isCurrent: () => boolean = (): boolean => true): Promise<void> {
    const hadMode = await store.has(LOCAL_VIEW_MODE_KEY);
    const priorMode = await store.get(LOCAL_VIEW_MODE_KEY, 'cover');
    const priorVersion = await store.get(LOCAL_MIGRATION_KEY, 0);
    if (!isCurrent()) throw new Error('BOOKSHELF_VIEW_MODE_RETIRED');
    observation?.dispatched();
    try {
      await store.put(LOCAL_VIEW_MODE_KEY, mode);
      await store.put(LOCAL_MIGRATION_KEY, LOCAL_CONFIG_VERSION);
      await store.flush();
      observation?.confirmed();
    } catch (error) {
      // Preferences keeps pending values in memory after a failed flush. Undo
      // those values so a later read cannot acknowledge an uncommitted choice.
      if (hadMode) await store.put(LOCAL_VIEW_MODE_KEY, priorMode);
      else await store.delete(LOCAL_VIEW_MODE_KEY);
      await store.put(LOCAL_MIGRATION_KEY, priorVersion);
      throw error;
    }
  }

  loadRestoreJournal(): Promise<WebDavRestoreJournal | undefined> {
    const next = this.localModeWriteTail.then(async (): Promise<WebDavRestoreJournal | undefined> => {
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_RESTORE_JOURNAL_KEY, '');
      if (raw === '') return undefined;
      if (typeof raw !== 'string' || raw.length > 1024) throw new Error('恢复记录无效，请保留当前数据');
      const value = JSON.parse(raw) as WebDavRestoreJournal;
      this.validateRestoreJournal(value);
      return value;
    });
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  loadBackupJournal(): Promise<WebDavBackupJournal | undefined> {
    const generation = this.contextGeneration;
    const next = this.localModeWriteTail.then(async (): Promise<WebDavBackupJournal | undefined> => {
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_BACKUP_JOURNAL_KEY, '');
      if (generation !== this.contextGeneration) throw new Error('备份记录所属窗口已变化');
      if (raw === '') return undefined;
      if (typeof raw !== 'string' || raw.length > 1024) throw new Error('备份记录无效，请保留当前数据');
      const value = JSON.parse(raw) as WebDavBackupJournal;
      this.validateBackupJournal(value); return value;
    });
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  saveBackupJournal(value: WebDavBackupJournal): Promise<void> {
    this.validateBackupJournal(value);
    const generation = this.contextGeneration;
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      const store = await this.ensureLocalPreferences();
      const prior = await store.get(LOCAL_BACKUP_JOURNAL_KEY, '');
      if (generation !== this.contextGeneration) throw new Error('备份记录所属窗口已变化');
      if (prior !== '') {
        if (typeof prior !== 'string' || prior.length > 1024) throw new Error('备份记录无效');
        const previous = JSON.parse(prior) as WebDavBackupJournal;
        this.validateBackupJournal(previous);
        if (previous.operationId !== value.operationId || previous.phase === 'mayDispatch' && value.phase !== 'mayDispatch' ||
          previous.configSaveOperationId !== value.configSaveOperationId) throw new Error('上一次备份尚未核定');
      }
      try { await store.put(LOCAL_BACKUP_JOURNAL_KEY, JSON.stringify(value)); await store.flush(); }
      catch (error) { await store.put(LOCAL_BACKUP_JOURNAL_KEY, prior); throw error; }
    });
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  clearBackupJournal(operationId: string): Promise<void> {
    const generation = this.contextGeneration;
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_BACKUP_JOURNAL_KEY, '');
      if (generation !== this.contextGeneration) throw new Error('备份记录所属窗口已变化');
      if (raw === '') return;
      if (typeof raw !== 'string' || raw.length > 1024) throw new Error('备份记录无效');
      const prior = JSON.parse(raw) as WebDavBackupJournal; this.validateBackupJournal(prior);
      if (prior.operationId !== operationId) throw new Error('备份记录已被替换');
      try { await store.delete(LOCAL_BACKUP_JOURNAL_KEY); await store.flush(); }
      catch (error) { await store.put(LOCAL_BACKUP_JOURNAL_KEY, raw); throw error; }
    });
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  private validateBackupJournal(value: WebDavBackupJournal): void {
    if (value.version !== 1 || typeof value.operationId !== 'string' || !/^webdav-[0-9a-f]{32}$/.test(value.operationId) ||
      !['prepared', 'mayDispatch'].includes(value.phase)) throw new Error('备份记录无效');
    if (value.configSaveOperationId !== undefined) this.validateSaveOperationId(value.configSaveOperationId);
  }

  saveRestoreJournal(value: WebDavRestoreJournal): Promise<void> {
    this.validateRestoreJournal(value);
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      const store = await this.ensureLocalPreferences();
      const prior = await store.get(LOCAL_RESTORE_JOURNAL_KEY, '');
      const encoded = JSON.stringify(value);
      if (prior !== '' && prior !== encoded) throw new Error('上一次恢复尚未完成');
      try { await store.put(LOCAL_RESTORE_JOURNAL_KEY, encoded); await store.flush(); }
      catch (error) { await store.put(LOCAL_RESTORE_JOURNAL_KEY, prior); throw error; }
    });
    this.localModeWriteTail = next.catch((): void => {});
    return next;
  }

  clearRestoreJournal(operationId: string): Promise<void> {
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_RESTORE_JOURNAL_KEY, '');
      if (raw === '') return;
      if (typeof raw !== 'string') throw new Error('恢复记录无效');
      const prior = JSON.parse(raw) as WebDavRestoreJournal;
      this.validateRestoreJournal(prior);
      if (prior.operationId !== operationId) throw new Error('恢复记录已被替换');
      try { await store.delete(LOCAL_RESTORE_JOURNAL_KEY); await store.flush(); }
      catch (error) { await store.put(LOCAL_RESTORE_JOURNAL_KEY, raw); throw error; }
    });
    this.localModeWriteTail = next.catch((): void => {});
    return next;
  }

  private validateRestoreJournal(value: WebDavRestoreJournal): void {
    if (value.version !== 1 || typeof value.operationId !== 'string' || value.operationId.length === 0 ||
      value.operationId.length > 128 || /[\u0000-\u001f\u007f]/.test(value.operationId) ||
      typeof value.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(value.checksum)) throw new Error('恢复记录无效');
  }

  private async ensureLocalPreferences(): Promise<preferences.Preferences> {
    if (this.localPreferences !== undefined) return this.localPreferences;
    if (this.context === undefined) throw new Error('本机配置尚未就绪，请重试');
    const generation = this.contextGeneration;
    const store = await preferences.getPreferences(this.context, LOCAL_PREFERENCES_NAME);
    if (generation !== this.contextGeneration) throw new Error('本机配置所属窗口已变化，请重试');
    this.localPreferences = store;
    return this.localPreferences;
  }

  /** Serialized read-back; never replays a save or guesses a lost ACK. */
  loadSerialized(): Promise<StoredWebDavConfig | null> {
    const path = this.intentPath(), generation = this.contextGeneration;
    return WebDavCredentialStore.writeTail.then(async (): Promise<StoredWebDavConfig | null> => {
      const state = await this.loadState(undefined, path);
      this.assertAdmission((): boolean => generation === this.contextGeneration); return state.config;
    });
  }

  /** One atomic read of config plus its qualified commit identity. */
  loadSerializedState(): Promise<StoredWebDavState> {
    const path = this.intentPath(), generation = this.contextGeneration;
    return WebDavCredentialStore.writeTail.then(async (): Promise<StoredWebDavState> => {
      const state = await this.loadState(undefined, path);
      this.assertAdmission((): boolean => generation === this.contextGeneration); return state;
    });
  }

  /** Exact receipt query. Matching fields, old envelopes and absence prove no
   * specific save; this query never writes or migrates local preferences. */
  hasSaveReceipt(operationId: string): Promise<boolean> {
    this.validateSaveOperationId(operationId);
    const path = this.intentPath(), generation = this.contextGeneration;
    return WebDavCredentialStore.writeTail.then(async (): Promise<boolean> => {
      if (await this.readConfigIntent(path) !== undefined) return false;
      const state = await this.loadState(undefined, path);
      this.assertAdmission((): boolean => generation === this.contextGeneration);
      return state.config !== null && state.saveOperationId === operationId;
    });
  }

  /** One exact intent survives preparation, dispatch and cleanup ACK loss. */
  save(config: StoredWebDavConfig, evidence?: ReaderWriteEvidence, admitted?: () => boolean,
    operationId?: string): Promise<void> {
    const normalized = this.normalize(config), identity = operationId ?? util.generateRandomUUID(true);
    this.validateSaveOperationId(identity);
    const path = this.intentPath(), generation = this.contextGeneration;
    const current = (): boolean => generation === this.contextGeneration && (admitted === undefined || admitted());
    const next = WebDavCredentialStore.writeTail.then(async (): Promise<void> => {
      this.assertAdmission(current);
      await this.loadBookshelfViewMode();
      this.assertAdmission(current);
      if (await this.readConfigIntent(path) !== undefined) throw new Error('WebDAV previous configuration intent must be reconciled');
      const payloadHash = await this.configHash(normalized);
      this.validatePayloadCapacity(normalized, identity, payloadHash);
      const existing = await this.loadState(undefined, path);
      if (existing.saveOperationId === identity) {
        if (existing.savePayloadHash !== payloadHash) throw new Error('WebDAV configuration identity has different original payload');
        return;
      }
      if ((await this.loadState(this.configRecordAlias(identity), path)).config !== null) throw new Error('WebDAV save identity already has a different historical record');
      this.assertAdmission(current);
      const head = await this.readConfigHead(path);
      const intent: WebDavConfigIntent = { version: 1, operationId: identity, payloadHash,
        previousOperationId: head?.operationId, previousPayloadHash: head?.payloadHash, previousWasLegacy: head === undefined && existing.config !== null, phase: 'prepared' };
      WebDavCredentialStore.activeConfig = true;
      try {
        await this.writeConfigIntent(intent, evidence, path);
        this.assertAdmission(current);
        await this.persist(normalized, evidence, identity, payloadHash, this.configRecordAlias(identity));
        this.assertAdmission(current);
        await this.writeConfigIntent({ ...intent, phase: 'mayDispatch' }, evidence, path);
        this.assertAdmission(current);
        await this.writeConfigHead(intent, evidence, path, current);
        await this.finishConfigIntent(intent, evidence, path, current);
      } finally { WebDavCredentialStore.activeConfig = false; }
    });
    WebDavCredentialStore.writeTail = next.catch((): void => {});
    return next;
  }

  /** Only exact current secure receipt qualifies cleanup. Old or absent
   * envelopes never confirm the original pending operation. */
  reconcileConfigIntent(admitted?: () => boolean): Promise<WebDavConfigIntent | undefined> {
    const path = this.intentPath(), generation = this.contextGeneration;
    const current = (): boolean => generation === this.contextGeneration && (admitted === undefined || admitted());
    const next = WebDavCredentialStore.writeTail.then(async (): Promise<WebDavConfigIntent | undefined> => {
      this.assertAdmission(current);
      const intent = await this.readConfigIntent(path);
      if (intent === undefined) return undefined;
      if (this.matchesConfigIntent(await this.loadState(undefined, path), intent)) { await this.finishConfigIntent(intent, undefined, path, current); return undefined; }
      return { ...intent };
    });
    WebDavCredentialStore.writeTail = next.then((): void => {}, (): void => {});
    return next;
  }

  /** Explicit continuation only creates/qualifies the immutable original UUID
   * record and commits its exact head. No changed DTO or automatic replay. */
  continueConfigIntent(operationId: string, evidence?: ReaderWriteEvidence,
    admitted?: () => boolean, originalConfig?: StoredWebDavConfig): Promise<void> {
    this.validateSaveOperationId(operationId);
    const path = this.intentPath(), generation = this.contextGeneration;
    const current = (): boolean => generation === this.contextGeneration && (admitted === undefined || admitted());
    const next = WebDavCredentialStore.writeTail.then(async (): Promise<void> => {
      this.assertAdmission(current);
      const intent = await this.readConfigIntent(path);
      if (intent === undefined || intent.operationId !== operationId) throw new Error('WebDAV original configuration identity unavailable');
      if (this.matchesConfigIntent(await this.loadState(undefined, path), intent)) { await this.finishConfigIntent(intent, evidence, path, current); return; }
      let pending = await this.loadState(this.configRecordAlias(intent.operationId));
      if (pending.config === null) {
        if (originalConfig === undefined) throw new Error('WebDAV original secure payload unavailable; re-enter original configuration');
        const original = this.normalize(originalConfig);
        if (await this.configHash(original) !== intent.payloadHash) throw new Error('WebDAV original configuration input differs; original intent retained');
        this.validatePayloadCapacity(original, intent.operationId, intent.payloadHash);
        this.assertAdmission(current);
        await this.writeConfigIntent(intent, evidence, path);
        this.assertAdmission(current);
        await this.persist(original, evidence, intent.operationId, intent.payloadHash, this.configRecordAlias(intent.operationId), true);
        pending = await this.loadState(this.configRecordAlias(intent.operationId));
      }
      if (!this.matchesConfigIntent(pending, intent) || pending.config === null) throw new Error('WebDAV original secure payload binding invalid; original intent retained');
      this.assertAdmission(current);
      WebDavCredentialStore.activeConfig = true;
      try {
        await this.writeConfigIntent({ ...intent, phase: 'mayDispatch' }, evidence, path);
        this.assertAdmission(current);
        await this.writeConfigHead(intent, evidence, path, current);
        await this.finishConfigIntent(intent, evidence, path, current);
      } finally { WebDavCredentialStore.activeConfig = false; }
    });
    WebDavCredentialStore.writeTail = next.catch((): void => {});
    return next;
  }

  loadConfigIntent(): Promise<WebDavConfigIntent | undefined> {
    const path = this.intentPath(), generation = this.contextGeneration;
    return WebDavCredentialStore.writeTail.then(async (): Promise<WebDavConfigIntent | undefined> => {
      const intent = await this.readConfigIntent(path);
      this.assertAdmission((): boolean => generation === this.contextGeneration); return intent === undefined ? undefined : { ...intent };
    });
  }

  canContinueConfigIntent(operationId: string): Promise<boolean> {
    const path = this.intentPath(), generation = this.contextGeneration;
    return WebDavCredentialStore.writeTail.then(async (): Promise<boolean> => {
      const intent = await this.readConfigIntent(path);
      const qualified = intent?.operationId === operationId && this.matchesConfigIntent(await this.loadState(this.configRecordAlias(intent.operationId), path), intent);
      this.assertAdmission((): boolean => generation === this.contextGeneration); return qualified;
    });
  }

  async requireConfigSettled(): Promise<void> {
    if (WebDavCredentialStore.activeConfig || await this.loadConfigIntent() !== undefined) throw new Error('WebDAV original configuration intent remains unresolved');
  }

  private assertAdmission(admitted?: () => boolean): void {
    if (admitted !== undefined && !admitted()) throw new Error('WebDAV configuration owner retired before dispatch');
  }
  private matchesConfigIntent(state: StoredWebDavState, intent: { operationId: string; payloadHash: string }): boolean {
    return state.config !== null && state.saveOperationId === intent.operationId && state.savePayloadHash === intent.payloadHash;
  }
  private intentPath(): string {
    if (this.context === undefined || typeof this.context.filesDir !== 'string' || this.context.filesDir.length === 0) throw new Error('WebDAV local intent context unavailable');
    return this.context.filesDir + '/' + CONFIG_INTENT_FILE;
  }
  private async readConfigIntent(path: string = this.intentPath()): Promise<WebDavConfigIntent | undefined> { let disk: WebDavConfigIntent | undefined;
    try {
      const raw = await fileIo.readText(path);
      if (raw.length > 512) throw new Error('WebDAV fixed intent metadata exceeds format capacity');
      if (raw !== '') { disk = JSON.parse(raw) as WebDavConfigIntent; this.validateConfigIntent(disk); }
    } catch (error) {
      if ((error as Record<string, unknown>)['code'] !== 13900002) throw new Error('WebDAV original intent cannot be read; retained');
    }
    const warm = WebDavCredentialStore.warmPath === path ? WebDavCredentialStore.warmIntent : undefined;
    if (warm !== undefined && disk !== undefined && (warm.operationId !== disk.operationId || warm.payloadHash !== disk.payloadHash)) throw new Error('WebDAV original intent identity conflict; retained');
    const intent = warm ?? disk;
    WebDavCredentialStore.warmPath = path; WebDavCredentialStore.warmIntent = intent;
    return intent;
  }
  private validateConfigIntent(value: WebDavConfigIntent): void {
    if (value?.version !== 1 || (value.phase !== 'prepared' && value.phase !== 'mayDispatch' && value.phase !== 'confirmed') ||
      typeof value.payloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.payloadHash)) throw new Error('WebDAV original intent binding invalid');
    this.validateSaveOperationId(value.operationId);
    if (value.previousOperationId !== undefined) { this.validateSaveOperationId(value.previousOperationId); if (typeof value.previousPayloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.previousPayloadHash)) throw new Error('WebDAV previous immutable binding invalid'); }
    if (value.previousPayloadHash !== undefined && value.previousOperationId === undefined ||
      value.previousWasLegacy !== undefined && typeof value.previousWasLegacy !== 'boolean' ||
      value.previousWasLegacy === true && value.previousOperationId !== undefined) throw new Error('WebDAV previous/legacy binding invalid');
  }
  private async writeConfigIntent(intent: WebDavConfigIntent, evidence?: ReaderWriteEvidence, path: string = this.intentPath()): Promise<void> { this.validateConfigIntent(intent);
    WebDavCredentialStore.warmPath = path; WebDavCredentialStore.warmIntent = intent;
    evidence?.dispatched();
    await replaceReaderAtomicSnapshot(path, path.substring(0, path.lastIndexOf('/')), JSON.stringify(intent)); evidence?.confirmed();
  }
  private async finishConfigIntent(intent: WebDavConfigIntent, evidence?: ReaderWriteEvidence, path: string = this.intentPath(), admitted?: () => boolean): Promise<void> {
    const live = await this.readConfigIntent(path);
    if (live === undefined || live.operationId !== intent.operationId || live.payloadHash !== intent.payloadHash ||
      !this.matchesConfigIntent(await this.loadState(undefined, path), intent)) throw new Error('WebDAV original save receipt not qualified');
    this.assertAdmission(admitted);
    await this.writeConfigIntent({ ...intent, phase: 'confirmed' }, evidence, path);
    // Re-establish current head durability before releasing the original barrier.
    // An old native add/remove can only touch its own opaque UUID alias.
    this.assertAdmission(admitted);
    await this.writeConfigHead(intent, evidence, path, admitted);
    if (intent.previousOperationId !== undefined) {
      if (intent.previousOperationId === intent.operationId) throw new Error('WebDAV previous configuration identity conflict');
      const previous = await this.loadState(this.configRecordAlias(intent.previousOperationId));
      if (previous.config !== null && (previous.saveOperationId !== intent.previousOperationId || previous.savePayloadHash !== intent.previousPayloadHash)) throw new Error('WebDAV previous immutable configuration changed');
      this.assertAdmission(admitted);
      if (previous.config !== null) await this.remove(evidence, this.configRecordAlias(intent.previousOperationId));
    }
    this.assertAdmission(admitted);
    if (intent.previousWasLegacy === true && (await this.loadState(ASSET_ALIAS, path)).config !== null) await this.remove(evidence, ASSET_ALIAS);
    this.assertAdmission(admitted);
    evidence?.dispatched();
    await replaceReaderAtomicSnapshot(path, path.substring(0, path.lastIndexOf('/')), ''); evidence?.confirmed();
    if (WebDavCredentialStore.warmPath !== path || WebDavCredentialStore.warmIntent?.operationId !== intent.operationId) throw new Error('WebDAV original cleanup identity retired');
    WebDavCredentialStore.warmIntent = undefined;
  }
  private configRecordAlias(operationId: string): string {
    this.validateSaveOperationId(operationId); return CONFIG_RECORD_PREFIX + operationId;
  }
  private async readConfigHead(intentPath: string = this.intentPath()): Promise<WebDavConfigHead | null | undefined> {
    const path = intentPath.replace(CONFIG_INTENT_FILE, CONFIG_HEAD_FILE);
    let raw: string;
    try { raw = await fileIo.readText(path); }
    catch (error) { if ((error as Record<string, unknown>)['code'] === 13900002) return undefined; throw new Error('WebDAV current configuration head cannot be read'); }
    if (raw.length > 256) throw new Error('WebDAV current configuration head invalid');
    const value = JSON.parse(raw) as WebDavConfigHead & { cleared?: boolean };
    if (value?.version === 1 && value.cleared === true && value.operationId === undefined && value.payloadHash === undefined) return null;
    if (value?.version !== 1 || typeof value.payloadHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.payloadHash)) throw new Error('WebDAV current configuration head binding invalid');
    this.validateSaveOperationId(value.operationId); return value;
  }
  private async writeConfigHead(intent: WebDavConfigIntent, evidence?: ReaderWriteEvidence, intentPath: string = this.intentPath(), admitted?: () => boolean): Promise<void> {
    const live = await this.readConfigIntent(intentPath);
    if (live?.operationId !== intent.operationId || live.payloadHash !== intent.payloadHash) throw new Error('WebDAV original head update identity changed');
    const head = await this.readConfigHead(intentPath);
    if (head?.operationId !== intent.operationId) {
      if (intent.previousOperationId !== undefined && (head?.operationId !== intent.previousOperationId || head?.payloadHash !== intent.previousPayloadHash) ||
        intent.previousOperationId === undefined && head !== undefined && head !== null ||
        intent.previousWasLegacy === true && head !== undefined) throw new Error('WebDAV current head moved beyond original configuration');
    }
    const record = await this.loadState(this.configRecordAlias(intent.operationId));
    if (!this.matchesConfigIntent(record, intent)) throw new Error('WebDAV immutable original payload not qualified');
    const path = intentPath.replace(CONFIG_INTENT_FILE, CONFIG_HEAD_FILE);
    this.assertAdmission(admitted);
    evidence?.dispatched();
    await replaceReaderAtomicSnapshot(path, path.substring(0, path.lastIndexOf('/')), JSON.stringify({ version: 1, operationId: intent.operationId, payloadHash: intent.payloadHash }));
    evidence?.confirmed();
  }

  private async configHash(config: StoredWebDavConfig): Promise<string> {
    const digest = cryptoFramework.createMd('SHA256');
    await digest.update({ data: this.utf8(JSON.stringify(this.normalize(config))) });
    const output = await digest.digest(); let hex = '';
    for (let index = 0; index < output.data.length; index += 1) hex += output.data[index].toString(16).padStart(2, '0');
    return hex;
  }
  private validatePayloadCapacity(config: StoredWebDavConfig, operationId: string, payloadHash: string): void {
    if (this.utf8(JSON.stringify({ formatVersion: FORMAT_VERSION, config, saveOperationId: operationId, savePayloadHash: payloadHash })).length > MAX_CONFIG_BYTES) throw new Error(`WebDAV secure configuration exceeds ${MAX_CONFIG_BYTES} bytes`);
  }

  clear(evidence?: ReaderWriteEvidence, admitted?: () => boolean): Promise<void> {
    const next = WebDavCredentialStore.writeTail.catch((): void => {}).then(async (): Promise<void> => {
      if (admitted !== undefined && !admitted()) throw new Error('WebDAV configuration owner retired before dispatch');
      await this.loadBookshelfViewMode();
      if (admitted !== undefined && !admitted()) throw new Error('WebDAV configuration owner retired before dispatch');
      if (await this.readConfigIntent() !== undefined) throw new Error('WebDAV original configuration intent remains unresolved');
      const head = await this.readConfigHead();
      if (head !== undefined && head !== null) {
        const path = this.intentPath().replace(CONFIG_INTENT_FILE, CONFIG_HEAD_FILE);
        evidence?.dispatched();
        await replaceReaderAtomicSnapshot(path, path.substring(0, path.lastIndexOf('/')), JSON.stringify({ version: 1, cleared: true })); evidence?.confirmed();
        await this.remove(evidence, this.configRecordAlias(head.operationId));
      } else await this.remove(evidence);
    });
    WebDavCredentialStore.writeTail = next.catch((): void => {});
    return next;
  }

  private async persist(config: StoredWebDavConfig, evidence?: ReaderWriteEvidence, operationId?: string, payloadHash?: string, alias: string = ASSET_ALIAS, qualifyExisting: boolean = false): Promise<void> {
    const payload = this.utf8(JSON.stringify({ formatVersion: FORMAT_VERSION, config, saveOperationId: operationId, savePayloadHash: payloadHash }));
    if (payload.length > MAX_CONFIG_BYTES) {
      throw new Error(`WebDAV secure configuration exceeds ${MAX_CONFIG_BYTES} bytes`);
    }
    const attributes = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.utf8(alias));
    attributes.set(asset.Tag.SECRET, payload);
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_POWERED_ON);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.THROW_ERROR);
    try {
      evidence?.dispatched();
      await asset.add(attributes);
      evidence?.confirmed();
    } catch (error) {
      if (qualifyExisting && this.errorCode(error) === asset.ErrorCode.DUPLICATED && operationId !== undefined && payloadHash !== undefined &&
        this.matchesConfigIntent(await this.loadState(alias), { operationId, payloadHash })) { return; }
      throw new Error(`WebDAV secure configuration cannot be written: ${this.errorMessage(error)}`);
    }
  }

  private async remove(evidence?: ReaderWriteEvidence, alias: string = ASSET_ALIAS): Promise<void> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(alias));
    try {
      evidence?.dispatched();
      await asset.remove(query);
      evidence?.confirmed();
    } catch (error) {
      if (this.errorCode(error) !== asset.ErrorCode.NOT_FOUND) {
        throw new Error(`WebDAV secure configuration cannot be cleared: ${this.errorMessage(error)}`);
      }
      evidence?.confirmed();
    }
  }

  private validateSaveOperationId(operationId: string): void {
    if (typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) {
      throw new Error('WebDAV secure configuration receipt identity is invalid');
    }
  }

  private normalize(config: StoredWebDavConfig): StoredWebDavConfig {
    const normalized: StoredWebDavConfig = {
      url: this.field(config.url, 'server URL'),
      user: this.field(config.user, 'user', true),
      password: this.field(config.password, 'password', true, false),
      backupPassword: this.field(config.backupPassword, 'backup password', false, false),
      directory: this.field(config.directory, 'directory'),
    };
    if ((normalized.user.length === 0) !== (normalized.password.length === 0)) {
      throw new Error('WebDAV user and password must either both be set or both be empty');
    }
    return normalized;
  }

  private field(value: string, name: string, emptyAllowed: boolean = false, trimValue: boolean = true): string {
    if (typeof value !== 'string') {
      throw new Error(`WebDAV ${name} must be a string`);
    }
    const normalized = trimValue ? value.trim() : value;
    if (!emptyAllowed && normalized.length === 0) {
      throw new Error(`WebDAV ${name} must not be empty`);
    }
    if (normalized.length > MAX_FIELD_LENGTH || this.hasControl(normalized)) {
      throw new Error(`WebDAV ${name} is invalid`);
    }
    return normalized;
  }

  private isConfig(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    try {
      this.normalize(value as StoredWebDavConfig);
      return true;
    } catch (_) {
      return false;
    }
  }

  private hasControl(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
      if (value.charCodeAt(index) < 0x20 || value.charCodeAt(index) === 0x7f) {
        return true;
      }
    }
    return false;
  }

  private utf8(value: string): Uint8Array {
    return new util.TextEncoder('utf-8').encode(value);
  }

  private errorCode(error: unknown): number | null {
    if (error !== null && typeof error === 'object') {
      const code = (error as Record<string, unknown>)['code'];
      return typeof code === 'number' ? code : null;
    }
    return null;
  }

  private errorMessage(error: unknown): string {
    return errorMessageOf(error);
  }
}
