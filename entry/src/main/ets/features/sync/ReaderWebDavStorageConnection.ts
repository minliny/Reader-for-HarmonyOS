import util from '@ohos.util';
import url from '@ohos.url';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { HttpExecuteHost } from '../../app/HttpExecuteHost';
import { createReaderStorageNetworkAuthority, type ReaderStorageNetworkAuthority } from '../../app/ReaderStorageNetworkAuthority';
import { WebDavCredentialStore, type StoredWebDavConfig } from './WebDavCredentialStore';
import { readerLibraryLogObject, type ReaderLibraryLogObject } from './ReaderLibraryLogSyncJournal';
export interface ReaderWebDavStorageBinding { config: StoredWebDavConfig; operationId: string; payloadHash: string; }
type ConnectionBinding = ReaderWebDavStorageBinding;
export class ReaderWebDavStorageConnection {
  private readonly owner: ReaderRuntimeOwner;
  private readonly credentials: WebDavCredentialStore;
  private readonly networkAuthorities = new WeakMap<ReaderWebDavStorageBinding, ReaderStorageNetworkAuthority>();
  constructor(owner: ReaderRuntimeOwner, credentials: WebDavCredentialStore) { this.owner = owner; this.credentials = credentials; }
  private current(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.owner.canConfigureBackupStorage(); }
  private requireCurrent(): void { if (!this.current()) throw new Error('BACKUP_STORAGE_RUNTIME_RETIRED'); }
  async networkAuthority(binding: ReaderWebDavStorageBinding): Promise<ReaderStorageNetworkAuthority> {
    await this.requireBinding(binding);
    let authority = this.networkAuthorities.get(binding);
    if (authority === undefined) {
      authority = await createReaderStorageNetworkAuthority(this.owner, this.credentials, binding.operationId, binding.payloadHash);
      await this.requireBinding(binding);
      this.networkAuthorities.set(binding, authority);
    }
    return authority;
  }
  async planRequest(binding: ConnectionBinding, method: 'GET' | 'PUT' | 'DELETE' | 'MKCOL', remotePath: string, headers: Record<string, string>, body?: string): Promise<JsonObject> {
    if (!await this.isCurrent(binding)) throw new Error('BACKUP_STORAGE_CONNECTION_CHANGED');
    if (body !== undefined && (method !== 'PUT' || body.length > 1024 || /[^\x20-\x7e\n]/.test(body))) throw new Error('BACKUP_STORAGE_PROBE_BODY_INVALID');
    const params: JsonObject = { baseUrl: binding.config.url, requests: [{ method, path: remotePath,
      headers: Object.entries(headers), depth: null, acceptedStatusCodes: method === 'GET' ? [200, 404] : method === 'MKCOL' ? [201, 405] : [200, 201, 204, 404, 412],
      ...(body === undefined ? {} : { body: Array.from(new util.TextEncoder().encodeInto(body)) }) }] };
    const authorization = this.auth(binding.config); if (authorization !== undefined) params['auth'] = authorization;
    const event = await this.owner.request('sync.webdav.plan', params);
    if (!await this.isCurrent(binding)) throw new Error('BACKUP_STORAGE_CONNECTION_CHANGED');
    const requests = event.data['requests'];
    if (!Array.isArray(requests) || requests.length !== 1) throw new Error('BACKUP_STORAGE_PLAN_INVALID');
    const request = requests[0] as JsonObject;
    if (request['method'] !== method || typeof request['url'] !== 'string') throw new Error('BACKUP_STORAGE_PLAN_INVALID');
    const target = new url.URL(request['url']), origin = new url.URL(binding.config.url);
    if (target.protocol !== 'https:' || target.origin !== origin.origin || target.username !== '' || target.password !== '' || target.search !== '' || target.hash !== '')
      throw new Error('BACKUP_STORAGE_PLAN_INVALID');
    return { ...request, followRedirects: false, maxRedirects: 0, retry: null, usePlatformCookieJar: false, responseAsset: false };
  }
  async open(probeOperationId?: string): Promise<ConnectionBinding> {
    this.requireCurrent();
    const probe = await this.credentials.loadStorageProbeIntent();
    if (probe !== undefined && probe.stage !== 'completed' && probe.stage !== 'abandoned' && probe.operationId !== probeOperationId)
      throw new Error('BACKUP_STORAGE_PROBE_PENDING');
    if (await this.credentials.loadConfigIntent() !== undefined || await this.credentials.loadBackupJournal() !== undefined ||
      await this.credentials.loadRestoreJournal() !== undefined || await this.credentials.loadRestoreDownloadIntent() !== undefined)
      throw new Error('BACKUP_PACKAGE_ORIGINAL_OPERATION_PENDING');
    const value = await this.credentials.loadSerializedState(); this.requireCurrent();
    if (value.config === null || value.saveOperationId === undefined || value.savePayloadHash === undefined ||
      !/^[0-9a-f]{64}$/.test(value.savePayloadHash) || !await this.credentials.hasSaveReceipt(value.saveOperationId))
      throw new Error('BACKUP_PACKAGE_CONNECTION_REQUIRED');
    const target = new url.URL(value.config.url);
    if (target.protocol !== 'https:' || target.username !== '' || target.password !== '' || target.search !== '' || target.hash !== '')
      throw new Error('BACKUP_PACKAGE_CONNECTION_INVALID');
    this.requireCurrent();
    return { config: value.config, operationId: value.saveOperationId, payloadHash: value.savePayloadHash };
  }
  async isCurrent(binding: ConnectionBinding): Promise<boolean> {
    if (!this.current() || await this.credentials.loadConfigIntent() !== undefined) return false;
    const value = await this.credentials.loadSerializedState();
    return this.current() && value.saveOperationId === binding.operationId && value.savePayloadHash === binding.payloadHash && value.config !== null;
  }
  private auth(config: StoredWebDavConfig): string | undefined {
    return config.user.length === 0 ? undefined : 'Basic ' + new util.Base64Helper().encodeToStringSync(
      new util.TextEncoder('utf-8').encode(`${config.user}:${config.password}`));
  }
  private async requireBinding(binding: ConnectionBinding): Promise<void> {
    if (!await this.isCurrent(binding)) throw new Error('BACKUP_STORAGE_CONNECTION_CHANGED');
  }
  private canonical(target: url.URL): string {
    return `${target.origin}${target.pathname}`.replace(/%([0-9a-f]{2})/gi, (_match: string, hex: string): string => {
      const character = String.fromCharCode(parseInt(hex, 16));
      return /^[A-Za-z0-9._~-]$/.test(character) ? character : `%${hex.toUpperCase()}`;
    });
  }
  /** Log storage is an explicit protocol namespace, not the backup candidate
   * list: its authenticated content hash replaces an HTTP ETag, and malformed
   * matching entries must fail the whole discovery instead of being hidden. */
  async listLibrarySyncObjects(binding: ConnectionBinding): Promise<ReaderLibraryLogObject[]> {
    await this.requireBinding(binding);
    const params: JsonObject = { baseUrl: binding.config.url, directory: binding.config.directory };
    const auth = this.auth(binding.config); if (auth !== undefined) params['auth'] = auth;
    const plan = await this.owner.request('sync.webdav.directory.list.plan', params); await this.requireBinding(binding);
    const request = plan.data['request'] as JsonObject;
    if (request === null || typeof request !== 'object' || request['method'] !== 'PROPFIND' || typeof request['url'] !== 'string')
      throw new Error('LIBRARY_LOG_DISCOVERY_INVALID');
    const origin = new url.URL(binding.config.url), directory = new url.URL(request['url']);
    const configured = binding.config.directory;
    const expectedDirectory = new url.URL(`${binding.config.url.replace(/\/+$/, '')}/${configured.startsWith('/') ? configured.substring(1) : configured}`);
    if (directory.protocol !== 'https:' || directory.origin !== origin.origin || directory.username !== '' ||
      directory.password !== '' || directory.search !== '' || directory.hash !== '' ||
      this.canonical(directory).replace(/\/+$/, '') !== this.canonical(expectedDirectory).replace(/\/+$/, ''))
      throw new Error('LIBRARY_LOG_DISCOVERY_INVALID');
    const prefix = this.canonical(directory).replace(/\/+$/, '') + '/';
    const response = await HttpExecuteHost.instance.executeBounded({ ...request, followRedirects: false, maxRedirects: 0,
      retry: null, usePlatformCookieJar: false, responseAsset: false }, 2 * 1024 * 1024, undefined,
      (): boolean => !this.current(), await this.networkAuthority(binding));
    await this.requireBinding(binding);
    if (response['status'] !== 207) throw new Error('LIBRARY_LOG_DISCOVERY_UNCONFIRMED');
    const parsed = await this.owner.request('sync.webdav.multistatus.parse', { response }); await this.requireBinding(binding);
    const resources = parsed.data['resources'];
    if (!Array.isArray(resources) || resources.length > 4096) throw new Error('LIBRARY_LOG_DISCOVERY_BUDGET');
    const seen: Set<string> = new Set(); const result: ReaderLibraryLogObject[] = [];
    for (const resource of resources) {
      if (resource === null || typeof resource !== 'object' || Array.isArray(resource) || typeof resource['href'] !== 'string')
        throw new Error('LIBRARY_LOG_DISCOVERY_INVALID');
      let target: url.URL;
      try { target = new url.URL(resource['href'], request['url']); } catch (_) { throw new Error('LIBRARY_LOG_DISCOVERY_INVALID'); }
      if (target.protocol !== 'https:' || target.origin !== origin.origin || target.username !== '' || target.password !== '' ||
        target.search !== '' || target.hash !== '') throw new Error('LIBRARY_LOG_DISCOVERY_INVALID');
      const href = this.canonical(target);
      if (!href.startsWith(prefix)) continue;
      const tail = href.substring(prefix.length);
      if (tail.length === 0 || tail.includes('/')) continue;
      let name: string;
      try { name = decodeURIComponent(tail); } catch (_) { throw new Error('LIBRARY_LOG_DISCOVERY_INVALID'); }
      if (!name.startsWith('reader-sync-log-v2-')) continue;
      const object = readerLibraryLogObject(name), length = resource['contentLength'];
      // Core's multistatus DTO contains files only: it filters collections
      // before serialization and does not publish an isCollection field.
      if (object === undefined || typeof length !== 'number' ||
        !Number.isSafeInteger(length) || length < 1 || length > 24 * 1024 * 1024 || seen.has(name))
        throw new Error('LIBRARY_LOG_DISCOVERY_INVALID');
      seen.add(name); result.push({ ...object, contentBytes: length });
    }
    result.sort((left: ReaderLibraryLogObject, right: ReaderLibraryLogObject): number => left.objectId.localeCompare(right.objectId));
    await this.requireBinding(binding); return result;
  }

}
