import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import url from '@ohos.url';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { HttpExecuteHost } from '../../app/HttpExecuteHost';
import { readerLibrarySyncHash, READER_LIBRARY_SYNC_MAX_BYTES } from './ReaderLibrarySyncJournal';
import { readerLibraryLogObject, type ReaderLibraryLogObject } from './ReaderLibraryLogSyncJournal';
import { ReaderWebDavStorageConnection, type ReaderWebDavStorageBinding } from './ReaderWebDavStorageConnection';

export interface ReaderLibraryLogListing { objects: ReaderLibraryLogObject[]; channels: string[]; }
export interface ReaderLibraryLogReadback { objectId: string; content: string; sha256: string; bytes: number; }
export type ReaderLibraryLogReadPhase = 'require' | 'plan' | 'validate' | 'authority' | 'execute' | 'readback';

/** Only immutable protocol objects beneath the already authorized directory.
 * No method chooses a winner, interprets a document, or widens credentials. */
export class ReaderLibraryLogSyncTransport {
  constructor(private readonly owner: ReaderRuntimeOwner, private readonly storage: ReaderWebDavStorageConnection) {}
  private current(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.owner.canConfigureBackupStorage(); }
  private async require(binding: ReaderWebDavStorageBinding): Promise<void> {
    if (!this.current() || !await this.storage.isCurrent(binding)) throw new Error('LIBRARY_LOG_CONNECTION_CHANGED');
  }
  private path(binding: ReaderWebDavStorageBinding, objectId: string): string {
    if (readerLibraryLogObject(objectId) === undefined) throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    return `${binding.config.directory.replace(/\/+$/, '')}/${objectId}`;
  }
  private exactObjectRequest(request: JsonObject, binding: ReaderWebDavStorageBinding, objectId: string): void {
    if (typeof request['url'] !== 'string') throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    const actual = new url.URL(request['url']), origin = new url.URL(binding.config.url);
    // Match the Core bridge's documented base + relative-path composition,
    // including a WebDAV service mounted beneath an existing base pathname.
    const path = this.path(binding, objectId);
    const expected = new url.URL(`${binding.config.url.replace(/\/+$/, '')}/${path.startsWith('/') ? path.substring(1) : path}`);
    if (actual.protocol !== 'https:' || actual.origin !== origin.origin || actual.username !== '' || actual.password !== '' ||
      actual.search !== '' || actual.hash !== '' || this.canonical(actual) !== this.canonical(expected))
      throw new Error('LIBRARY_LOG_OBJECT_INVALID');
  }
  private canonical(target: url.URL): string {
    return `${target.origin}${target.pathname}`.replace(/%([0-9a-f]{2})/gi, (_match: string, hex: string): string => {
      const character = String.fromCharCode(parseInt(hex, 16));
      return /^[A-Za-z0-9._~-]$/.test(character) ? character : `%${hex.toUpperCase()}`;
    });
  }
  async list(binding: ReaderWebDavStorageBinding): Promise<ReaderLibraryLogListing> {
    await this.require(binding);
    const objects = await this.storage.listLibrarySyncObjects(binding);
    await this.require(binding);
    return { objects, channels: Array.from(new Set(objects.map((object: ReaderLibraryLogObject): string => object.channelHash))).sort() };
  }
  private header(response: JsonObject, name: string): string | undefined {
    const headers = response['headers'];
    if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return undefined;
    const matches = Object.keys(headers).filter((key: string): boolean => key.toLowerCase() === name);
    if (matches.length > 1) throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    return matches.length === 1 && typeof headers[matches[0]] === 'string' ? headers[matches[0]] as string : undefined;
  }
  async read(binding: ReaderWebDavStorageBinding, objectId: string,
    onPhase?: (phase: ReaderLibraryLogReadPhase) => void): Promise<ReaderLibraryLogReadback | undefined> {
    const phase = (value: ReaderLibraryLogReadPhase): void => { try { onPhase?.(value); } catch (_) {} };
    phase('require');
    await this.require(binding);
    phase('validate');
    const object = readerLibraryLogObject(objectId);
    if (object === undefined) throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    phase('plan');
    const request = await this.storage.planRequest(binding, 'GET', this.path(binding, objectId), { 'Accept-Encoding': 'identity' });
    phase('validate');
    this.exactObjectRequest(request, binding, objectId);
    phase('authority');
    const authority = await this.storage.networkAuthority(binding);
    phase('execute');
    const response = await HttpExecuteHost.instance.executeBounded(request, READER_LIBRARY_SYNC_MAX_BYTES, undefined,
      (): boolean => !this.current(), authority);
    phase('readback');
    await this.require(binding);
    if (response['status'] === 404) return undefined;
    if (response['status'] !== 200 || this.header(response, 'content-range') !== undefined ||
      (this.header(response, 'content-encoding') ?? 'identity').toLowerCase() !== 'identity') throw new Error('LIBRARY_LOG_READ_UNCONFIRMED');
    let bytes: Uint8Array;
    let text: string | undefined;
    if (typeof response['bodyBase64'] === 'string') {
      // This fresh HTTP result belongs only to this read. Native dispatch has
      // settled; the encoded copy is no longer needed once bytes are decoded.
      try { bytes = new util.Base64Helper().decodeSync(response['bodyBase64']); }
      finally { delete response['bodyBase64']; }
    } else if (typeof response['body'] === 'string') {
      text = response['body']; bytes = new util.TextEncoder().encodeInto(text);
    }
    else throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    if (bytes.byteLength < 1 || bytes.byteLength > READER_LIBRARY_SYNC_MAX_BYTES || bytes.some((byte: number): boolean => byte > 127))
      throw new Error('LIBRARY_LOG_OBJECT_INVALID');
    const sha256 = await readerLibrarySyncHash(bytes);
    if (sha256 !== object.sha256) throw new Error('LIBRARY_LOG_OBJECT_CHANGED');
    // ASCII validation above proves the existing text is already the exact
    // UTF-8 representation. Binary reads still perform the strict decoder.
    const content = text ?? new util.TextDecoder('utf-8', { fatal: true }).decodeWithStream(bytes);
    return { objectId, content, sha256, bytes: bytes.byteLength };
  }
  async put(binding: ReaderWebDavStorageBinding, objectId: string, sourcePath: string, bytes: number,
    willDispatch: () => Promise<void>): Promise<void> {
    await this.require(binding);
    const request = await this.storage.planRequest(binding, 'PUT', this.path(binding, objectId), {
      'If-None-Match': '*', 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes) });
    this.exactObjectRequest(request, binding, objectId);
    const source = await fileIo.open(sourcePath, fileIo.OpenMode.READ_ONLY | fileIo.OpenMode.NOFOLLOW);
    try {
      // If-None-Match is an extra protection on capable servers. Correctness
      // here comes from the unique immutable name and full typed readback.
      await HttpExecuteHost.instance.executeLibraryPackagePutFromFile(request, source.fd, bytes,
        (): boolean => !this.current(), undefined, willDispatch, await this.storage.networkAuthority(binding));
    } finally { await fileIo.close(source); }
    await this.require(binding);
  }
  async remove(binding: ReaderWebDavStorageBinding, objectId: string): Promise<void> {
    await this.require(binding);
    const request = await this.storage.planRequest(binding, 'DELETE', this.path(binding, objectId), {});
    this.exactObjectRequest(request, binding, objectId);
    const response = await HttpExecuteHost.instance.executeBounded(request, 64 * 1024, undefined,
      (): boolean => !this.current(), await this.storage.networkAuthority(binding));
    await this.require(binding);
    if (![200, 204, 404].includes(response['status'] as number)) throw new Error('LIBRARY_LOG_CLEANUP_UNCONFIRMED');
    if (await this.read(binding, objectId) !== undefined) throw new Error('LIBRARY_LOG_CLEANUP_UNCONFIRMED');
  }
}
