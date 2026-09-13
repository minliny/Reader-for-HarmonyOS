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

export type StoredWebDavConfig = {
  url: string;
  user: string;
  password: string;
  backupPassword: string;
  directory: string;
  /** Local bookshelf projection; kept beside the WebDAV credentials. */
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

  /** Attach the ability context for non-secret WebDAV-adjacent preferences. */
  attachContext(context: common.UIAbilityContext): void {
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
      bookshelfViewMode: envelope.config.bookshelfViewMode ?? 'cover',
    };
  }

  async loadBookshelfViewMode(): Promise<'cover' | 'list' | null> {
    const config = await this.load();
    if (config?.bookshelfViewMode !== undefined) return config.bookshelfViewMode;
    const store = await this.ensureLocalPreferences();
    if (store === undefined) return null;
    const mode = await store.get(LOCAL_VIEW_MODE_KEY, '') as string;
    return mode === 'list' || mode === 'cover' ? mode : null;
  }

  /** Update only the local projection while preserving every WebDAV field. */
  async saveBookshelfViewMode(mode: 'cover' | 'list'): Promise<void> {
    const previous = this.localModeWriteTail;
    let release: (() => void) | undefined;
    this.localModeWriteTail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    await previous;
    try {
      const store = await this.ensureLocalPreferences();
      if (store !== undefined) {
        await store.put(LOCAL_VIEW_MODE_KEY, mode);
        await store.flush();
      }
    } finally {
      if (release !== undefined) release();
    }
    const existing = await this.load();
    if (existing === null) {
      // Keep credentials absent when WebDAV is not configured. The local
      // preference above still makes the bookshelf choice survive a restart.
      return;
    }
    await this.save({ ...existing, bookshelfViewMode: mode });
  }

  private async ensureLocalPreferences(): Promise<preferences.Preferences | undefined> {
    if (this.localPreferences !== undefined) return this.localPreferences;
    if (this.context === undefined) return undefined;
    this.localPreferences = await preferences.getPreferences(this.context, LOCAL_PREFERENCES_NAME);
    return this.localPreferences;
  }

  save(config: StoredWebDavConfig): Promise<void> {
    const normalized = this.normalize(config);
    const next = this.writeTail.catch((): void => {}).then((): Promise<void> => this.persist(normalized));
    // Preserve the error for this caller, but do not let one transient
    // AssetStore failure poison every later save/clear in this process.
    this.writeTail = next.catch((): void => {});
    return next;
  }

  clear(): Promise<void> {
    const next = this.writeTail.catch((): void => {}).then((): Promise<void> => this.remove());
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
      bookshelfViewMode: config.bookshelfViewMode === 'list' ? 'list' : 'cover',
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
