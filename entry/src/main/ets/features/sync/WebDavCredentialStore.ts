import common from '@ohos.app.ability.common';
import preferences from '@ohos.data.preferences';
import asset from '@ohos.security.asset';
import util from '@ohos.util';
import { errorMessageOf } from '../../app/ErrorMessage';

const ASSET_ALIAS = 'reader.webdav.config.v2';
const FORMAT_VERSION = 2;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 4096;
const LOCAL_PREFERENCES_NAME = 'reader_webdav_local_v1';
const LOCAL_VIEW_MODE_KEY = 'bookshelfViewMode';
const LOCAL_MIGRATION_KEY = 'bookshelfConfigVersion';
const LOCAL_CONFIG_VERSION = 1;
const LOCAL_RESTORE_JOURNAL_KEY = 'webdavRestoreJournal';

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
};

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

  private writeTail: Promise<void> = Promise.resolve();
  private localModeWriteTail: Promise<void> = Promise.resolve();
  private context: common.UIAbilityContext | undefined;
  private localPreferences: preferences.Preferences | undefined;
  private contextGeneration: number = 0;

  /** Attach the ability context for non-secret WebDAV-adjacent preferences. */
  attachContext(context: common.UIAbilityContext): void {
    if (this.context === context) return;
    this.contextGeneration += 1;
    this.context = context;
    this.localPreferences = undefined;
  }

  async load(): Promise<StoredWebDavConfig | null> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    let records: Array<asset.AssetMap>;
    try {
      records = await asset.query(query);
    } catch (error) {
      if (this.errorCode(error) === asset.ErrorCode.NOT_FOUND) {
        return null;
      }
      throw new Error(`WebDAV secure configuration cannot be read: ${this.errorMessage(error)}`);
    }
    if (records.length === 0) {
      return null;
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
    return {
      url: envelope.config.url,
      user: envelope.config.user,
      password: envelope.config.password,
      backupPassword: envelope.config.backupPassword,
      directory: envelope.config.directory,
      bookshelfViewMode: envelope.config.bookshelfViewMode,
    };
  }

  loadBookshelfViewMode(): Promise<'cover' | 'list'> {
    const next = this.localModeWriteTail.then((): Promise<'cover' | 'list'> => this.readOrMigrateViewMode());
    this.localModeWriteTail = next.then((): void => {}, (): void => {});
    return next;
  }

  /** One serialized non-secret authority; credential edits never mirror mode. */
  saveBookshelfViewMode(mode: 'cover' | 'list', restoreOperationId?: string): Promise<void> {
    const next = this.localModeWriteTail.then(async (): Promise<void> => {
      await this.readOrMigrateViewMode();
      const store = await this.ensureLocalPreferences();
      const raw = await store.get(LOCAL_RESTORE_JOURNAL_KEY, '');
      if (raw !== '') {
        if (typeof raw !== 'string') throw new Error('BOOKSHELF_RESTORE_PENDING');
        const journal = JSON.parse(raw) as WebDavRestoreJournal;
        this.validateRestoreJournal(journal);
        if (journal.operationId !== restoreOperationId) throw new Error('BOOKSHELF_RESTORE_PENDING');
      }
      await this.writeLocalViewMode(store, mode);
    });
    this.localModeWriteTail = next.catch((): void => {});
    return next;
  }

  private async readOrMigrateViewMode(): Promise<'cover' | 'list'> {
    const store = await this.ensureLocalPreferences();
    const present = await store.has(LOCAL_VIEW_MODE_KEY);
    const stored = await store.get(LOCAL_VIEW_MODE_KEY, 'cover');
    const version = await store.get(LOCAL_MIGRATION_KEY, 0);
    if (present) {
      const mode = stored === 'list' ? 'list' : 'cover';
      if (version !== LOCAL_CONFIG_VERSION) await this.writeLocalViewMode(store, mode);
      return mode;
    }
    // Only a truly absent local key may consult the legacy raw Asset field.
    // Never interpret load()'s former synthetic cover as a prior user choice.
    const legacy = version === LOCAL_CONFIG_VERSION ? null : await this.load();
    const mode = legacy?.bookshelfViewMode === 'list' ? 'list' : 'cover';
    await this.writeLocalViewMode(store, mode);
    return mode;
  }

  private async writeLocalViewMode(store: preferences.Preferences, mode: 'cover' | 'list'): Promise<void> {
    const hadMode = await store.has(LOCAL_VIEW_MODE_KEY);
    const priorMode = await store.get(LOCAL_VIEW_MODE_KEY, 'cover');
    const priorVersion = await store.get(LOCAL_MIGRATION_KEY, 0);
    try {
      await store.put(LOCAL_VIEW_MODE_KEY, mode);
      await store.put(LOCAL_MIGRATION_KEY, LOCAL_CONFIG_VERSION);
      await store.flush();
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

  save(config: StoredWebDavConfig): Promise<void> {
    const normalized = this.normalize(config);
    const next = this.writeTail.catch((): void => {}).then(async (): Promise<void> => {
      // Migrate before removing the legacy field from the next secure record.
      await this.loadBookshelfViewMode();
      await this.persist(normalized);
    });
    // Preserve the error for this caller, but do not let one transient
    // AssetStore failure poison every later save/clear in this process.
    this.writeTail = next.catch((): void => {});
    return next;
  }

  clear(): Promise<void> {
    const next = this.writeTail.catch((): void => {}).then(async (): Promise<void> => {
      await this.loadBookshelfViewMode();
      await this.remove();
    });
    this.writeTail = next.catch((): void => {});
    return next;
  }

  private async persist(config: StoredWebDavConfig): Promise<void> {
    const payload = this.utf8(JSON.stringify({ formatVersion: FORMAT_VERSION, config }));
    if (payload.length > MAX_CONFIG_BYTES) {
      throw new Error(`WebDAV secure configuration exceeds ${MAX_CONFIG_BYTES} bytes`);
    }
    const attributes = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
    attributes.set(asset.Tag.SECRET, payload);
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_POWERED_ON);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    try {
      await asset.add(attributes);
    } catch (error) {
      throw new Error(`WebDAV secure configuration cannot be written: ${this.errorMessage(error)}`);
    }
  }

  private async remove(): Promise<void> {
    const query = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.utf8(ASSET_ALIAS));
    try {
      await asset.remove(query);
    } catch (error) {
      if (this.errorCode(error) !== asset.ErrorCode.NOT_FOUND) {
        throw new Error(`WebDAV secure configuration cannot be cleared: ${this.errorMessage(error)}`);
      }
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
