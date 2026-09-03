import asset from '@ohos.security.asset';
import util from '@ohos.util';

const ASSET_ALIAS = 'reader.webdav.config.v2';
const FORMAT_VERSION = 2;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_FIELD_LENGTH = 4096;

export type StoredWebDavConfig = {
  url: string;
  user: string;
  password: string;
  backupPassword: string;
  directory: string;
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
    };
  }

  save(config: StoredWebDavConfig): Promise<void> {
    const normalized = this.normalize(config);
    this.writeTail = this.writeTail.then((): Promise<void> => this.persist(normalized));
    return this.writeTail;
  }

  clear(): Promise<void> {
    this.writeTail = this.writeTail.then((): Promise<void> => this.remove());
    return this.writeTail;
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
    return error instanceof Error ? error.message : `${error}`;
  }
}
