import util from '@ohos.util';
import url from '@ohos.url';
import type { JsonObject } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import {
  LOCAL_RECOVERY_MAX_BYTES, recoveryDigest, recoveryOutput, recoveryReserve, recoveryText, recoveryUtf8, recoveryVisitFile,
} from '../../../platform/backup/LocalRecoveryFile';
import { HttpExecuteHost } from '../../../platform/network/HttpExecuteHost';

const PREFIX = 'reader-library-v1-';
const FORMAT = 'reader.library.webdav';
const SHA256 = /^[0-9a-f]{64}$/;
const MANIFEST_NAME = /^reader-library-v1-([0-9a-f]{64})\.manifest$/;
const PART_BYTES = 4 * 1024 * 1024;
const ENCODED_PART_BYTES = Math.ceil(PART_BYTES / 3) * 4;
const MAX_MANIFEST_BYTES = 16 * 1024;
const MAX_LIST_BYTES = 2 * 1024 * 1024;

export type WebDavLibraryBackupFailure = 'authentication' | 'readOnly' | 'missing' | 'corrupt' |
  'conflict' | 'unconfirmed' | 'failed';

export class WebDavLibraryBackupError extends Error {
  constructor(readonly reason: WebDavLibraryBackupFailure) { super(reason); }
}

interface WebDavBackupEndpoint {
  url: string;
  directory: string;
}

interface PublishedManifest {
  format: string;
  version: number;
  sha256: string;
  bytes: number;
  parts: string[];
}

interface RemoteObject {
  bytes: Uint8Array;
  etag?: string;
  exact: boolean;
}

interface ManifestEntry {
  name: string;
  modified: number;
}

function object(value: unknown): JsonObject {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new WebDavLibraryBackupError('failed');
  }
  return value as JsonObject;
}

function admittedSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= LOCAL_RECOVERY_MAX_BYTES;
}

function checkedUrl(value: string, base?: string): url.URL {
  try { return url.URL.parseURL(value, base); }
  catch (_) { throw new WebDavLibraryBackupError('failed'); }
}

function strongEtag(response: JsonObject): string | undefined {
  const supplied = response['headers'];
  if (supplied === undefined || supplied === null) return undefined;
  const headers = object(supplied);
  const values = Object.keys(headers).filter((name: string): boolean => name.toLowerCase() === 'etag');
  if (values.length !== 1) return undefined;
  const candidate = headers[values[0]];
  return typeof candidate === 'string' && /^"[\x21\x23-\x7e]{1,512}"$/.test(candidate) ? candidate : undefined;
}

function sameBytes(received: Uint8Array, expected: Uint8Array): boolean {
  if (received.length !== expected.length) return false;
  for (let index = 0; index < received.length; index++) {
    if (received[index] !== expected[index]) return false;
  }
  return true;
}

/** Manual backup publication in one user-configured collection. The transport
 * never receives a decryption key, invokes restore, or overwrites a commit. */
export class WebDavLibraryBackup {
  private readonly runtime: ReaderRuntimeOwner;
  private readonly baseUrl: string;
  private readonly directory: string;
  private readonly collection: string;
  private readonly authorization: string | undefined;
  private readonly assertCurrent: () => Promise<void>;
  private readonly isCancelled: () => boolean;

  constructor(runtime: ReaderRuntimeOwner, config: WebDavBackupEndpoint, authorization: string | undefined,
    assertCurrent: () => Promise<void>, isCancelled: () => boolean = (): boolean => false) {
    const base = checkedUrl(config.url);
    if (base.protocol !== 'https:' || base.hostname.length === 0 || base.username.length > 0 ||
      base.password.length > 0 || base.search.length > 0 || base.hash.length > 0 ||
      !config.directory.startsWith('/') || config.directory.includes('..') ||
      /[\\?#\u0000-\u001f\u007f]|%(?:25|2e|2f|5c)/i.test(config.directory)) {
      throw new WebDavLibraryBackupError('failed');
    }
    this.runtime = runtime;
    this.baseUrl = base.toString().replace(/\/+$/, '');
    this.directory = config.directory === '/' ? '/' : config.directory.replace(/\/+$/, '');
    this.collection = `${this.baseUrl}${this.directory === '/' ? '' : this.directory}`;
    this.authorization = authorization;
    this.assertCurrent = assertCurrent;
    this.isCancelled = isCancelled;
  }

  async publish(path: string, sha256: string, size: number): Promise<void> {
    if (!SHA256.test(sha256) || !admittedSize(size)) throw new WebDavLibraryBackupError('corrupt');
    await this.assertCurrent();
    const empty = async (_bytes: Uint8Array): Promise<void> => {};
    if (await recoveryVisitFile(path, empty, (): boolean => !this.isCancelled(), size) !== sha256) {
      throw new WebDavLibraryBackupError('corrupt');
    }
    const manifestName = `${PREFIX}${sha256}.manifest`;
    let listing = await this.listResponse();
    if (listing['status'] === 404) {
      const created = await this.request({ method: 'MKCOL', url: `${this.collection}/` }, MAX_MANIFEST_BYTES);
      if (![200, 201, 204, 405].includes(created['status'] as number)) {
        throw new WebDavLibraryBackupError(created['status'] === 409 ? 'missing' : 'readOnly');
      }
      listing = await this.listResponse();
    }
    if (listing['status'] !== 207) throw new WebDavLibraryBackupError('readOnly');
    await this.parseListing(listing);
    await this.proveConditionalCreation(sha256);

    const parts: string[] = [];
    const buffer = new Uint8Array(PART_BYTES);
    let offset = 0;
    const publishPart = async (bytes: Uint8Array): Promise<void> => {
      const digest = await recoveryDigest(bytes);
      const encoded = new util.Base64Helper().encodeToStringSync(bytes);
      const name = this.partName(sha256, parts.length);
      await this.publishImmutable(name, encoded, ENCODED_PART_BYTES);
      parts.push(digest);
    };
    const finalHash = await recoveryVisitFile(path, async (fragment: Uint8Array): Promise<void> => {
      let consumed = 0;
      while (consumed < fragment.length) {
        const length = Math.min(PART_BYTES - offset, fragment.length - consumed);
        buffer.set(fragment.subarray(consumed, consumed + length), offset);
        offset += length;
        consumed += length;
        if (offset === PART_BYTES) {
          await publishPart(buffer);
          offset = 0;
        }
      }
    }, (): boolean => !this.isCancelled(), size);
    if (finalHash !== sha256) throw new WebDavLibraryBackupError('corrupt');
    if (offset > 0) await publishPart(buffer.subarray(0, offset));
    const manifest: PublishedManifest = { format: FORMAT, version: 1, sha256, bytes: size, parts };
    await this.publishImmutable(manifestName, JSON.stringify(manifest), MAX_MANIFEST_BYTES);
    // The collection has no proof of ownership of other devices' objects.
    // Preserve history, including resources referenced by earlier commits.
  }

  async downloadLatest(destination: string): Promise<'downloaded' | 'empty'> {
    const listedResponse = await this.listResponse();
    const status = listedResponse['status'];
    if (status === 404) throw new WebDavLibraryBackupError('missing');
    if (status !== 207) throw new WebDavLibraryBackupError('failed');
    const entries = this.manifestEntries(await this.parseListing(listedResponse));
    if (entries.length === 0) return 'empty';
    entries.sort((a: ManifestEntry, b: ManifestEntry): number => b.modified - a.modified);
    if (entries.length > 1 && (entries.some((entry: ManifestEntry): boolean => !Number.isFinite(entry.modified)) ||
      entries[0].modified === entries[1].modified)) {
      throw new WebDavLibraryBackupError('conflict');
    }
    const name = entries[0].name;
    const initial = await this.getObject(name, MAX_MANIFEST_BYTES);
    if (initial === undefined) throw new WebDavLibraryBackupError('corrupt');
    const manifest = this.decodeManifest(name, initial.bytes);
    await recoveryReserve(destination.slice(0, destination.lastIndexOf('/')), manifest.bytes);
    await recoveryOutput(destination, async (emit: (bytes: Uint8Array) => Promise<void>): Promise<void> => {
      for (let index = 0; index < manifest.parts.length; index++) {
        const size = Math.min(PART_BYTES, manifest.bytes - PART_BYTES * index);
        const limit = Math.ceil(size / 3) * 4;
        const part = await this.getObject(this.partName(manifest.sha256, index), limit);
        if (part === undefined) throw new WebDavLibraryBackupError('corrupt');
        let decoded: Uint8Array;
        try {
          const encoded = recoveryText(part.bytes);
          const base64 = new util.Base64Helper();
          decoded = base64.decodeSync(encoded);
          if (decoded.length !== size || base64.encodeToStringSync(decoded) !== encoded) {
            throw new WebDavLibraryBackupError('corrupt');
          }
        } catch (_) {
          throw new WebDavLibraryBackupError('corrupt');
        }
        if (await recoveryDigest(decoded) !== manifest.parts[index]) throw new WebDavLibraryBackupError('corrupt');
        await this.assertCurrent();
        await emit(decoded);
      }
    });
    const published = await recoveryVisitFile(destination, async (_bytes: Uint8Array): Promise<void> => {},
      (): boolean => !this.isCancelled(), manifest.bytes);
    if (published !== manifest.sha256) throw new WebDavLibraryBackupError('corrupt');
    const final = await this.getObject(name, MAX_MANIFEST_BYTES, initial.etag);
    if (final === undefined || final.etag !== initial.etag || !sameBytes(final.bytes, initial.bytes)) {
      throw new WebDavLibraryBackupError('conflict');
    }
    return 'downloaded';
  }

  private async proveConditionalCreation(sha256: string): Promise<void> {
    const name = `${PREFIX}${sha256}.probe`;
    const original = `${FORMAT}\ncondition-probe\n${sha256}`;
    const before = await this.publishImmutable(name, original, MAX_MANIFEST_BYTES);
    // Only this isolated disposable probe object is eligible for the test.
    // An endpoint ignoring the condition may change the probe, never a package.
    const refused = await this.putObject(name, `${original}\nconflicting bytes`);
    if (refused['status'] !== 412) throw new WebDavLibraryBackupError('readOnly');
    const after = await this.getObject(name, MAX_MANIFEST_BYTES);
    if (after === undefined || !after.exact || after.etag !== before.etag ||
      !sameBytes(after.bytes, recoveryUtf8(original))) throw new WebDavLibraryBackupError('readOnly');
  }

  private async publishImmutable(name: string, content: string, limit: number): Promise<RemoteObject> {
    const expected = recoveryUtf8(content);
    const existing = await this.getObject(name, limit);
    if (existing !== undefined) return this.verifyPublication(existing, expected);
    let status = 0;
    try {
      const written = await this.putObject(name, content);
      status = written['status'] as number;
    } catch (error) {
      if (!(error instanceof WebDavLibraryBackupError) || error.reason !== 'failed') throw error;
      // A lost response cannot distinguish an absent object from an accepted PUT.
    }
    let received: RemoteObject | undefined;
    try {
      received = await this.getObject(name, limit);
    } catch (error) {
      if (error instanceof WebDavLibraryBackupError && error.reason === 'failed') {
        throw new WebDavLibraryBackupError('unconfirmed');
      }
      throw error;
    }
    if (received === undefined) {
      if (status === 405 || status === 501) throw new WebDavLibraryBackupError('readOnly');
      throw new WebDavLibraryBackupError('unconfirmed');
    }
    return this.verifyPublication(received, expected);
  }

  private verifyPublication(received: RemoteObject, expected: Uint8Array): RemoteObject {
    if (!received.exact || received.etag === undefined) throw new WebDavLibraryBackupError('readOnly');
    if (!sameBytes(received.bytes, expected)) throw new WebDavLibraryBackupError('conflict');
    return received;
  }

  private async putObject(name: string, content: string): Promise<JsonObject> {
    return this.request({ url: `${this.collection}/${name}`, method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'If-None-Match': '*' }, body: content }, MAX_MANIFEST_BYTES);
  }

  private async getObject(name: string, limit: number, expectedTag?: string): Promise<RemoteObject | undefined> {
    const headers: JsonObject = { 'Cache-Control': 'no-cache', Accept: 'application/octet-stream' };
    if (expectedTag !== undefined) headers['If-Match'] = expectedTag;
    const response = await this.request({ url: `${this.collection}/${name}`, method: 'GET',
      headers }, Math.max(limit, MAX_MANIFEST_BYTES));
    if (response['status'] === 404) return undefined;
    if (response['status'] === 412 && expectedTag !== undefined) throw new WebDavLibraryBackupError('conflict');
    if (response['status'] !== 200) throw new WebDavLibraryBackupError('failed');
    let bytes: Uint8Array;
    const binary = response['bodyBase64'];
    const body = response['body'];
    const exact = typeof binary === 'string' && binary.length > 0;
    try {
      if (exact && typeof binary === 'string') bytes = new util.Base64Helper().decodeSync(binary);
      else if (typeof body === 'string') bytes = recoveryUtf8(body);
      else throw new WebDavLibraryBackupError('corrupt');
    } catch (_) { throw new WebDavLibraryBackupError('corrupt'); }
    if (bytes.length === 0 || bytes.length > limit) throw new WebDavLibraryBackupError('corrupt');
    return { bytes, etag: strongEtag(response), exact };
  }

  private async listResponse(): Promise<JsonObject> {
    await this.assertCurrent();
    const plan = await this.runtime.request('sync.webdav.directory.list.plan', {
      baseUrl: this.baseUrl, directory: this.directory,
    });
    const request = object(plan.data['request']);
    const target = request['url'];
    if (request['method'] !== 'PROPFIND' || typeof target !== 'string' ||
      checkedUrl(target).toString().replace(/\/+$/, '') !== checkedUrl(this.collection).toString().replace(/\/+$/, '')) {
      throw new WebDavLibraryBackupError('failed');
    }
    return this.request({ ...request, url: `${this.collection}/` }, MAX_LIST_BYTES);
  }

  private async parseListing(response: JsonObject): Promise<unknown[]> {
    let resources: unknown;
    try {
      const parsed = await this.runtime.request('sync.webdav.multistatus.parse', { response });
      resources = parsed.data['resources'];
    } catch (_) {
      await this.assertCurrent();
      throw new WebDavLibraryBackupError('failed');
    }
    await this.assertCurrent();
    if (!Array.isArray(resources)) throw new WebDavLibraryBackupError('failed');
    return resources as unknown[];
  }

  private async request(descriptor: JsonObject, limit: number): Promise<JsonObject> {
    await this.assertCurrent();
    const source = descriptor['headers'];
    const headers: JsonObject = source === undefined ? {} : { ...object(source) };
    if (this.authorization !== undefined) headers['Authorization'] = this.authorization;
    let response: JsonObject;
    try {
      response = await HttpExecuteHost.instance.executeBounded({ ...descriptor, headers,
        httpsOnly: true, sameOriginRedirectsOnly: true, followRedirects: false }, limit, undefined, this.isCancelled);
    } catch (error) {
      await this.assertCurrent();
      // The shared Host preserves a known error status in this specific
      // diagnostic when native HTTP omits the response representation.
      const bodyless = error instanceof Error ?
        /^http\.execute: source returned HTTP ([45][0-9]{2}) without response content$/.exec(error.message) : null;
      if (bodyless === null) throw new WebDavLibraryBackupError('failed');
      response = { status: Number(bodyless[1]), body: '', headers: {} };
    }
    await this.assertCurrent();
    const status = response['status'];
    if (status === 401 || status === 403) throw new WebDavLibraryBackupError('authentication');
    if (typeof status !== 'number' || !Number.isInteger(status)) throw new WebDavLibraryBackupError('failed');
    return response;
  }

  private manifestEntries(resources: unknown[]): ManifestEntry[] {
    const entries: Map<string, ManifestEntry> = new Map();
    const collection = checkedUrl(`${this.collection}/`);
    for (const raw of resources) {
      const item = object(raw);
      const href = item['href'];
      if (typeof href !== 'string') continue;
      let candidate: url.URL;
      try { candidate = url.URL.parseURL(href, collection.toString()); }
      catch (_) { continue; }
      if (candidate.protocol !== collection.protocol || candidate.host !== collection.host ||
        candidate.username.length > 0 || candidate.password.length > 0 || candidate.search.length > 0 ||
        candidate.hash.length > 0 || !candidate.pathname.startsWith(collection.pathname)) continue;
      const name = candidate.pathname.slice(collection.pathname.length);
      if (!MANIFEST_NAME.test(name)) continue;
      const modified = item['lastModified'];
      const timestamp = typeof modified === 'string' ? Date.parse(modified) : Number.NaN;
      const prior = entries.get(name);
      if (prior !== undefined && !Object.is(prior.modified, timestamp)) throw new WebDavLibraryBackupError('conflict');
      entries.set(name, { name, modified: timestamp });
    }
    return Array.from(entries.values());
  }

  private decodeManifest(name: string, bytes: Uint8Array): PublishedManifest {
    try {
      const match = MANIFEST_NAME.exec(name);
      const decoded = object(JSON.parse(recoveryText(bytes)));
      const size = decoded['bytes'];
      const sha256 = decoded['sha256'];
      const parts = decoded['parts'];
      if (match === null || typeof sha256 !== 'string' || sha256 !== match[1] || !admittedSize(size) ||
        decoded['format'] !== FORMAT || decoded['version'] !== 1 || Object.keys(decoded).length !== 5 ||
        !Array.isArray(parts) || parts.length !== Math.ceil(size / PART_BYTES) ||
        !(parts as unknown[]).every((part: unknown): boolean => typeof part === 'string' && SHA256.test(part))) {
        throw new WebDavLibraryBackupError('corrupt');
      }
      return { format: FORMAT, version: 1, sha256, bytes: size, parts: parts as string[] };
    } catch (_) { throw new WebDavLibraryBackupError('corrupt'); }
  }

  private partName(sha256: string, index: number): string {
    return `${PREFIX}${sha256}.${index.toString().padStart(3, '0')}.part`;
  }
}
