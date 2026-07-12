// Reader UI 2.5 WebDAV adapter. Network I/O is performed by the existing
// request-scoped HttpHostAdapter; backup/restore payloads come from and return
// to Core's portable storage APIs. No local/demo snapshot is manufactured.
import util from '@ohos.util';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import type {
  HostCredentialGetRequest,
  HostCredentialGetResponse,
  HostHttpRequest,
  HostHttpResponse,
} from '../types';

const DEFAULT_BACKUP_PATH: string = 'ReaderBackup/ReaderHarmonyOS/reader-core-storage-v1.json';

export interface ReaderWebDavCredentials {
  serverURL: string;
  username: string;
  password: string;
}

export interface ReaderWebDavConnectResponse {
  connected: boolean;
  statusCode: number;
  message: string;
}

export interface ReaderWebDavBackupResponse {
  backedUp: boolean;
  remoteURL: string;
  statusCode: number;
  resourceCount: number;
}

export interface ReaderWebDavRestoreResponse {
  restored: boolean;
  remoteURL: string;
  statusCode: number;
  applied: boolean;
}

interface CoreBackupEnvelope {
  manifest: JsonObject;
  payload: string;
}

export type CoreStorageExportCallback = () => Promise<JsonObject>;
export type CoreStorageApplyCallback = (manifest: JsonObject, payload: string) => Promise<JsonObject>;

export interface WebDavHttpExecutor {
  execute(request: HostHttpRequest, requestId?: string): Promise<HostHttpResponse>;
}

export interface WebDavCredentialReader {
  get(request: HostCredentialGetRequest): Promise<HostCredentialGetResponse>;
}

function ensureHttpUrl(value: string, field: string): string {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if ((!lower.startsWith('https://') && !lower.startsWith('http://')) || normalized.indexOf(' ') >= 0) {
    throw new Error(`${field} must be an absolute http(s) URL`);
  }
  return normalized;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export class WebDavHostAdapter {
  private httpAdapter: WebDavHttpExecutor;
  private credentialAdapter: WebDavCredentialReader;
  private exportStorage: CoreStorageExportCallback;
  private applyStorage: CoreStorageApplyCallback;
  private nextRequestId: number = 1;

  constructor(httpAdapter: WebDavHttpExecutor, credentialAdapter: WebDavCredentialReader,
    exportStorage: CoreStorageExportCallback, applyStorage: CoreStorageApplyCallback) {
    this.httpAdapter = httpAdapter;
    this.credentialAdapter = credentialAdapter;
    this.exportStorage = exportStorage;
    this.applyStorage = applyStorage;
  }

  async connect(override?: ReaderWebDavCredentials, legacyURL?: string): Promise<ReaderWebDavConnectResponse> {
    const credentials = await this.resolveCredentials(override, legacyURL);
    const request = this.request(credentials, credentials.serverURL, 'PROPFIND');
    request.headers['Depth'] = '0';
    const response = await this.httpAdapter.execute(request, this.requestId('connect'));
    if (response.status !== 207) {
      throw new Error(`webdav.connect expected HTTP 207, got ${response.status}`);
    }
    return { connected: true, statusCode: response.status, message: 'OK' };
  }

  async backup(override?: ReaderWebDavCredentials): Promise<ReaderWebDavBackupResponse> {
    const credentials = await this.resolveCredentials(override);
    const remoteURL = this.backupURL(credentials.serverURL);
    const exported = await this.exportStorage();
    const envelope = this.envelopeFromExport(exported);
    const body = JSON.stringify({
      format: 'reader-core-storage-backup',
      formatVersion: 1,
      manifest: envelope.manifest,
      payload: envelope.payload,
    });
    const request = this.request(credentials, remoteURL, 'PUT', body);
    const response = await this.httpAdapter.execute(request, this.requestId('backup'));
    if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
      throw new Error(`webdav.backup PUT failed with HTTP ${response.status}`);
    }
    return {
      backedUp: true,
      remoteURL: remoteURL,
      statusCode: response.status,
      resourceCount: 1,
    };
  }

  async restore(remoteURL: string, override?: ReaderWebDavCredentials): Promise<ReaderWebDavRestoreResponse> {
    const normalizedRemoteURL = ensureHttpUrl(remoteURL, 'remoteURL');
    const credentials = await this.resolveCredentials(override);
    const request = this.request(credentials, normalizedRemoteURL, 'GET');
    const response = await this.httpAdapter.execute(request, this.requestId('restore'));
    if (response.status !== 200) {
      throw new Error(`webdav.restore GET failed with HTTP ${response.status}`);
    }
    const envelope = this.parseEnvelope(response.body);
    await this.applyStorage(envelope.manifest, envelope.payload);
    return {
      restored: true,
      remoteURL: normalizedRemoteURL,
      statusCode: response.status,
      applied: true,
    };
  }

  private async resolveCredentials(override?: ReaderWebDavCredentials,
    legacyURL?: string): Promise<ReaderWebDavCredentials> {
    if (override !== undefined) {
      return {
        serverURL: ensureHttpUrl(override.serverURL, 'serverURL'),
        username: override.username,
        password: override.password,
      };
    }
    const storedURL = await this.credentialAdapter.get({ key: 'webdav.url' });
    const storedUser = await this.credentialAdapter.get({ key: 'webdav.user' });
    const storedPassword = await this.credentialAdapter.get({ key: 'webdav.password' });
    const serverURL = legacyURL !== undefined
      ? ensureHttpUrl(legacyURL, 'url')
      : (storedURL.exists && storedURL.value !== undefined
        ? ensureHttpUrl(storedURL.value, 'webdav.url')
        : '');
    if (serverURL.length === 0) throw new Error('WebDAV credentials are not configured');
    return {
      serverURL: serverURL,
      username: storedUser.exists && storedUser.value !== undefined ? storedUser.value : '',
      password: storedPassword.exists && storedPassword.value !== undefined ? storedPassword.value : '',
    };
  }

  private request(credentials: ReaderWebDavCredentials, url: string,
    method: 'GET' | 'PUT' | 'PROPFIND', body?: string): HostHttpRequest {
    const headers: Record<string, string> = {};
    if (credentials.username.length > 0 || credentials.password.length > 0) {
      const encoder = util.TextEncoder.create('utf-8');
      const encoded = encoder.encodeInto(`${credentials.username}:${credentials.password}`);
      const base64 = new util.Base64Helper();
      headers['Authorization'] = 'Basic ' + base64.encodeToStringSync(encoded);
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
    const request: HostHttpRequest = {
      url: ensureHttpUrl(url, 'url'),
      method: method,
      headers: headers,
      followRedirects: true,
      maxRedirects: 5,
    };
    if (body !== undefined) request.body = body;
    return request;
  }

  private envelopeFromExport(exported: JsonObject): CoreBackupEnvelope {
    const fields = exported as Object as Record<string, Object>;
    return this.validateEnvelope(fields['manifest'], fields['payload']);
  }

  private parseEnvelope(raw: string): CoreBackupEnvelope {
    let parsed: Object;
    try {
      parsed = JSON.parse(raw) as Object;
    } catch (e) {
      throw new Error(`webdav.restore backup is not valid JSON: ${e}`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('webdav.restore backup root must be an object');
    }
    const fields = parsed as Record<string, Object>;
    if (fields['format'] !== 'reader-core-storage-backup' || fields['formatVersion'] !== 1) {
      throw new Error('webdav.restore backup format is unsupported');
    }
    return this.validateEnvelope(fields['manifest'], fields['payload']);
  }

  private validateEnvelope(manifestRaw: Object, payloadRaw: Object): CoreBackupEnvelope {
    if (manifestRaw === null || typeof manifestRaw !== 'object' || Array.isArray(manifestRaw) ||
      typeof payloadRaw !== 'string' || payloadRaw.length === 0) {
      throw new Error('Core backup must contain an object manifest and non-empty payload');
    }
    const manifest = manifestRaw as Object as JsonObject;
    const fields = manifestRaw as Record<string, Object>;
    const schemaVersion = fields['schemaVersion'];
    const bytes = fields['bytes'];
    const checksum = fields['checksum'];
    const exportedAt = fields['exportedAt'];
    if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 0 ||
      typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0 ||
      typeof checksum !== 'string' || !new RegExp('^[0-9a-f]{64}$').test(checksum) ||
      typeof exportedAt !== 'number' || !Number.isInteger(exportedAt) || exportedAt < 0) {
      throw new Error('Core backup manifest is invalid');
    }
    const actualBytes = utf8ByteLength(payloadRaw);
    if (actualBytes !== bytes) {
      throw new Error(`Core backup byte length mismatch: manifest=${bytes}, actual=${actualBytes}`);
    }
    return { manifest: manifest, payload: payloadRaw };
  }

  private backupURL(baseURL: string): string {
    return baseURL.endsWith('/') ? baseURL + DEFAULT_BACKUP_PATH : baseURL + '/' + DEFAULT_BACKUP_PATH;
  }

  private requestId(operation: string): string {
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return `reader-ui-webdav-${operation}-${id}`;
  }
}
