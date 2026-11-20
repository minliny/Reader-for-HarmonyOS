import url from '@ohos.url';
import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import type { WebDavCredentialStore } from '../features/sync/WebDavCredentialStore';

/** An identity only; its origin and admission facts remain Host-private. */
export interface ReaderStorageNetworkAuthority { readonly storageNetworkAuthority: true; }

interface StorageNetworkFact {
  owner: ReaderRuntimeOwner;
  store: WebDavCredentialStore;
  operationId: string;
  payloadHash: string;
  origin: string;
  directoryPath: string;
  baseUrl: string;
  configuredDirectory: string;
}

const authorities = new WeakMap<ReaderStorageNetworkAuthority, StorageNetworkFact>();
const storageMethods = ['GET', 'HEAD', 'PROPFIND', 'PUT', 'DELETE', 'MKCOL'];

function current(fact: StorageNetworkFact): boolean {
  return ReaderRuntimeOwner.isCurrent(fact.owner) && fact.owner.canConfigureBackupStorage();
}

function httpsUri(value: string): url.URL {
  if (typeof value !== 'string' || value.length < 1 || value.length > 16384 ||
    /[\\\u0000-\u0020\u007f?#]/.test(value) || /%(?:25)*(?:2f|5c|2e|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value) ||
    /%(?![0-9a-f]{2})/i.test(value)) throw new Error('STORAGE_NETWORK_URI_INVALID');
  const authority = value.split('://')[1]?.split('/')[0] ?? '';
  if (authority.includes('@')) throw new Error('STORAGE_NETWORK_URI_INVALID');
  let target: url.URL;
  try { target = new url.URL(value); } catch (_) { throw new Error('STORAGE_NETWORK_URI_INVALID'); }
  if (target.protocol !== 'https:' || target.hostname.length === 0 || target.username !== '' ||
    target.password !== '' || target.search !== '' || target.hash !== '') throw new Error('STORAGE_NETWORK_URI_INVALID');
  try { decodeURIComponent(target.pathname); } catch (_) { throw new Error('STORAGE_NETWORK_URI_INVALID'); }
  // URL parsing normalizes dot segments. Reject them in the original path,
  // before that normalization could conceal an escape from this directory.
  const afterAuthority = value.substring(value.indexOf('://') + 3 + authority.length);
  if (afterAuthority.split('/').some((part: string): boolean => part === '.' || part === '..'))
    throw new Error('STORAGE_NETWORK_URI_INVALID');
  return target;
}

function factOf(authority: ReaderStorageNetworkAuthority): StorageNetworkFact {
  const fact = authorities.get(authority);
  if (fact === undefined || !current(fact)) throw new Error('STORAGE_NETWORK_AUTHORITY_RETIRED');
  return fact;
}

async function requireConfig(fact: StorageNetworkFact): Promise<void> {
  if (!current(fact) || await fact.store.loadConfigIntent() !== undefined)
    throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
  const state = await fact.store.loadSerializedState();
  try {
    if (state.config === null || state.saveOperationId !== fact.operationId || state.savePayloadHash !== fact.payloadHash ||
      state.config.url !== fact.baseUrl || state.config.directory !== fact.configuredDirectory ||
      !await fact.store.hasSaveReceipt(fact.operationId) || await fact.store.loadConfigIntent() !== undefined || !current(fact))
      throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
    // Receipt/intent reads yield. Re-read the head after them so a complete
    // connection replacement during those awaits cannot admit the old head.
    const latest = await fact.store.loadSerializedState();
    try {
      if (latest.config === null || latest.saveOperationId !== fact.operationId || latest.savePayloadHash !== fact.payloadHash ||
        latest.config.url !== fact.baseUrl || latest.config.directory !== fact.configuredDirectory || !current(fact))
        throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
    } finally {
      if (latest.config !== null) { latest.config.password = ''; latest.config.backupPassword = ''; }
    }
  } finally {
    if (state.config !== null) { state.config.password = ''; state.config.backupPassword = ''; }
  }
}

export async function createReaderStorageNetworkAuthority(owner: ReaderRuntimeOwner, store: WebDavCredentialStore,
  operationId: string, payloadHash: string): Promise<ReaderStorageNetworkAuthority> {
  if (!ReaderRuntimeOwner.isCurrent(owner) || !owner.canConfigureBackupStorage() ||
    typeof operationId !== 'string' || operationId.length < 1 || operationId.length > 128 || !/^[0-9a-f]{64}$/.test(payloadHash) ||
    await store.loadConfigIntent() !== undefined) throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
  const state = await store.loadSerializedState();
  try {
    if (state.config === null || state.saveOperationId !== operationId || state.savePayloadHash !== payloadHash ||
      !await store.hasSaveReceipt(operationId)) throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
    const base = httpsUri(state.config.url);
    const response = await owner.request('sync.webdav.directory.list.plan', {
      baseUrl: state.config.url, directory: state.config.directory,
    });
    const request = response.data['request'];
    if (request === null || typeof request !== 'object' || Array.isArray(request) || request['method'] !== 'PROPFIND' ||
      typeof request['url'] !== 'string') throw new Error('STORAGE_NETWORK_DIRECTORY_INVALID');
    const directory = httpsUri(request['url']);
    if (directory.origin !== base.origin) throw new Error('STORAGE_NETWORK_DIRECTORY_INVALID');
    const fact: StorageNetworkFact = { owner, store, operationId, payloadHash, origin: base.origin,
      directoryPath: directory.pathname.replace(/\/+$/, '') || '/', baseUrl: state.config.url,
      configuredDirectory: state.config.directory };
    await requireConfig(fact);
    const authority: ReaderStorageNetworkAuthority = Object.freeze({ storageNetworkAuthority: true });
    authorities.set(authority, fact);
    return authority;
  } finally {
    if (state.config !== null) { state.config.password = ''; state.config.backupPassword = ''; }
  }
}

export function assertReaderStorageNetworkUri(authority: ReaderStorageNetworkAuthority, value: string,
  method?: string): void {
  const fact = factOf(authority);
  const target = httpsUri(value);
  if (method !== undefined && !storageMethods.includes(method)) throw new Error('STORAGE_NETWORK_METHOD_INVALID');
  if (target.origin !== fact.origin) throw new Error('STORAGE_NETWORK_ORIGIN_CHANGED');
  const path = target.pathname;
  const directory = fact.directoryPath;
  if (path === directory || (directory !== '/' && path === `${directory}/`)) return;
  if (method === 'MKCOL') throw new Error('STORAGE_NETWORK_DIRECTORY_CHANGED');
  const prefix = directory === '/' ? '/' : `${directory}/`;
  const child = path.startsWith(prefix) ? path.substring(prefix.length) : '';
  if (child.length === 0 || child.includes('/')) throw new Error('STORAGE_NETWORK_DIRECTORY_CHANGED');
}

export async function requireReaderStorageNetworkAuthority(authority: ReaderStorageNetworkAuthority, value: string,
  method?: string, operationId?: string, payloadHash?: string): Promise<void> {
  assertReaderStorageNetworkUri(authority, value, method);
  const fact = factOf(authority);
  if ((operationId !== undefined || payloadHash !== undefined) &&
    (fact.operationId !== operationId || fact.payloadHash !== payloadHash)) throw new Error('STORAGE_NETWORK_CONNECTION_CHANGED');
  await requireConfig(fact);
  assertReaderStorageNetworkUri(authority, value, method);
}
