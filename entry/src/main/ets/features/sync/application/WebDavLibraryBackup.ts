import util from '@ohos.util';
import url from '@ohos.url';
import systemDateTime from '@ohos.systemDateTime';
import type { JsonObject } from '@reader/core-harmony';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import {
  LOCAL_RECOVERY_MAX_BYTES, recoveryDigest, recoveryOutput, recoveryReserve, recoveryText, recoveryUtf8, recoveryVisitFile,
} from '../../../platform/backup/LocalRecoveryFile';
import { HttpExecuteHost, type HttpBytesResponse } from '../../../platform/network/HttpExecuteHost';
import type { LocalRecoveryArchiveProof } from '../../bookshelf/application/LocalRecoveryGateway';

const PREFIX = 'reader-library-v1-';
const FORMAT = 'reader.library.webdav';
const SHA256 = /^[0-9a-f]{64}$/;
const MANIFEST_NAME = /^reader-library-v1-([0-9a-f]{64})\.manifest$/;
const PART_BYTES = 4 * 1024 * 1024;
const ENCODED_PART_BYTES = Math.ceil(PART_BYTES / 3) * 4;
const MAX_MANIFEST_BYTES = 16 * 1024;
const MAX_LIST_BYTES = 2 * 1024 * 1024;
const CONDITIONAL_PROBE = 'reader-library-conditional-v2.probe';
export const WEB_DAV_ARCHIVE_READ_WINDOW = 30 * 60 * 1000;

export type WebDavLibraryBackupFailure = 'authentication' | 'readOnly' | 'missing' | 'corrupt' |
  'conflict' | 'unconfirmed' | 'cleanupFailed' | 'failed' | 'replacementUnverified' | 'replacementMissingOriginals';

export class WebDavLibraryBackupError extends Error {
  constructor(readonly reason: WebDavLibraryBackupFailure) { super(reason); }
}

interface WebDavBackupEndpoint {
  url: string;
  directory: string;
}

export interface WebDavLibraryIdentity {
  libraryId?: string;
  writerInstanceId?: string;
}

export interface WebDavLibraryPublicationMetadata extends WebDavLibraryIdentity {
  createdAt: number;
}

export interface WebDavArchiveRow {
  sha256: string;
  manifestSha256: string;
  bytes: number;
  createdAt?: number;
  latest: boolean;
  canDelete: boolean;
  library: 'same' | 'other' | 'unknown';
}

export interface WebDavArchiveRemoval {
  sha256: string;
  manifestSha256: string;
  manifestEtag: string;
  replacementSha256: string;
  bytes: number;
  parts: string[];
  replacementProof?: WebDavReplacementProof;
}

export interface WebDavReplacementProof {
  libraryId: string;
  createdAt: number;
  manifestSha256: string;
  manifestEtag: string;
}

export interface WebDavArchiveVerification {
  path: string;
  inspect: (path: string) => Promise<LocalRecoveryArchiveProof>;
}

interface PublishedManifest extends WebDavLibraryIdentity {
  format: string;
  version: number;
  sha256: string;
  bytes: number;
  parts: string[];
  createdAt?: number;
  pinned?: boolean;
}

interface RemoteObject {
  bytes: Uint8Array;
  etag?: string;
}

interface ManifestEntry {
  name: string;
  modified?: number;
}

interface ReadableArchive {
  name: string;
  object: RemoteObject;
  manifest: PublishedManifest;
  timestamp?: number;
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

function admittedTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function admittedIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
}

function admittedEtag(value: unknown): value is string {
  return typeof value === 'string' && /^"[\x21\x23-\x7e]{1,512}"$/.test(value);
}

function admittedParts(value: unknown, size: number): value is string[] {
  return Array.isArray(value) && value.length === Math.ceil(size / PART_BYTES) &&
    (value as unknown[]).every((part: unknown): boolean => typeof part === 'string' && SHA256.test(part));
}

function strongEtag(response: JsonObject): string | undefined {
  const supplied = response['headers'];
  if (supplied === undefined || supplied === null) return undefined;
  const headers = object(supplied);
  const values = Object.keys(headers).filter((name: string): boolean => name.toLowerCase() === 'etag');
  if (values.length !== 1) return undefined;
  const candidate = headers[values[0]];
  return admittedEtag(candidate) ? candidate : undefined;
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

  async publish(path: string, sha256: string, size: number, metadata?: WebDavLibraryPublicationMetadata): Promise<void> {
    if (!SHA256.test(sha256) || !admittedSize(size)) throw new WebDavLibraryBackupError('corrupt');
    if (metadata !== undefined && (!admittedTimestamp(metadata.createdAt) ||
      (metadata.libraryId !== undefined && !admittedIdentity(metadata.libraryId)) ||
      (metadata.writerInstanceId !== undefined && !admittedIdentity(metadata.writerInstanceId)))) {
      throw new WebDavLibraryBackupError('corrupt');
    }
    await this.assertCurrent();
    const empty = async (_bytes: Uint8Array): Promise<void> => {};
    if (await recoveryVisitFile(path, empty, (): boolean => !this.isCancelled(), size) !== sha256) {
      throw new WebDavLibraryBackupError('corrupt');
    }
    const manifestName = `${PREFIX}${sha256}.manifest`;
    let listing = await this.listResponse();
    if (listing['status'] === 404) {
      await this.createDirectory();
      listing = await this.listResponse();
    }
    if (listing['status'] !== 207) throw new WebDavLibraryBackupError('readOnly');
    await this.parseListing(listing);
    await this.ensureNotRetired(sha256);
    await this.proveConditionalCreation();

    const parts: string[] = [];
    const buffer = new Uint8Array(PART_BYTES);
    let offset = 0;
    const publishPart = async (bytes: Uint8Array): Promise<void> => {
      const digest = await recoveryDigest(bytes);
      const encoded = new util.Base64Helper().encodeToStringSync(bytes);
      const name = this.partName(sha256, parts.length);
      await this.ensureNotRetired(sha256);
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
    const manifest: PublishedManifest = metadata === undefined ? { format: FORMAT, version: 1, sha256, bytes: size, parts } :
      { format: FORMAT, version: 2, sha256, bytes: size, parts, libraryId: metadata.libraryId,
        writerInstanceId: metadata.writerInstanceId, createdAt: metadata.createdAt, pinned: false };
    await this.ensureNotRetired(sha256);
    await this.publishImmutable(manifestName, JSON.stringify(manifest), MAX_MANIFEST_BYTES);
    await this.ensureNotRetired(sha256);
  }

  async listArchives(identity: WebDavLibraryIdentity): Promise<WebDavArchiveRow[]> {
    const archives = await this.readableArchives();
    const latest = archives[0];
    const rows: WebDavArchiveRow[] = [];
    for (const archive of archives) {
      const manifest = archive.manifest;
      const library = identity.libraryId === undefined || manifest.libraryId === undefined ? 'unknown' :
        identity.libraryId === manifest.libraryId ? 'same' : 'other';
      rows.push({ sha256: manifest.sha256, manifestSha256: await recoveryDigest(archive.object.bytes),
        bytes: manifest.bytes, createdAt: archive.timestamp, latest: archive === latest,
        canDelete: archives.some((candidate: ReadableArchive): boolean => this.canRemove(archive, candidate)), library });
    }
    return rows;
  }

  async downloadLatest(destination: string, selectedSha256?: string): Promise<'downloaded' | 'empty'> {
    if (selectedSha256 !== undefined && !SHA256.test(selectedSha256)) throw new WebDavLibraryBackupError('corrupt');
    const latest = (await this.readableArchives(selectedSha256))[0];
    if (latest === undefined) {
      if (selectedSha256 !== undefined) throw new WebDavLibraryBackupError('missing');
      return 'empty';
    }
    await this.downloadArchive(latest, destination);
    return 'downloaded';
  }

  async planRemoval(sha256: string, exactManifestSha256: string, verification: WebDavArchiveVerification,
    originalReplacementSha256?: string): Promise<WebDavArchiveRemoval> {
    if (!SHA256.test(sha256) || !SHA256.test(exactManifestSha256)) throw new WebDavLibraryBackupError('cleanupFailed');
    const archives = await this.readableArchives();
    const target = archives.find((archive: ReadableArchive): boolean => archive.manifest.sha256 === sha256);
    const etag = target?.object.etag;
    if (target === undefined || etag === undefined ||
      await recoveryDigest(target.object.bytes) !== exactManifestSha256) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
    if (originalReplacementSha256 === undefined && await this.hasRetirementMarker(sha256)) {
      throw new WebDavLibraryBackupError('conflict');
    }
    const candidates = archives.filter((candidate: ReadableArchive): boolean =>
      (originalReplacementSha256 === undefined || candidate.manifest.sha256 === originalReplacementSha256) &&
      this.canRemove(target, candidate));
    if (candidates.length === 0) throw new WebDavLibraryBackupError('replacementUnverified');
    const original = await this.authenticateArchive(target, verification);
    const libraryId = original.libraryId;
    const createdAt = original.createdAt;
    if (libraryId === undefined || createdAt === undefined) {
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    let failure = new WebDavLibraryBackupError('replacementUnverified');
    for (const replacement of candidates) {
      const replacementEtag = replacement.object.etag;
      if (replacementEtag === undefined || await this.hasRetirementMarker(replacement.manifest.sha256)) continue;
      try {
        const newer = await this.authenticateArchive(replacement, verification);
        if (newer.libraryId !== libraryId || newer.createdAt === undefined || newer.createdAt <= createdAt) continue;
        const included = new Set<string>(newer.includedOriginals);
        if (!original.includedOriginals.every((digest: string): boolean => included.has(digest))) {
          failure = new WebDavLibraryBackupError('replacementMissingOriginals');
          continue;
        }
        const replacementProof: WebDavReplacementProof = { libraryId, createdAt: newer.createdAt,
          manifestSha256: await recoveryDigest(replacement.object.bytes), manifestEtag: replacementEtag };
        return { sha256, manifestSha256: exactManifestSha256, manifestEtag: etag,
          replacementSha256: replacement.manifest.sha256, bytes: target.manifest.bytes, parts: target.manifest.parts, replacementProof };
      } catch (error) {
        if (!(error instanceof WebDavLibraryBackupError) ||
          !['replacementUnverified', 'corrupt', 'missing', 'conflict'].includes(error.reason)) throw error;
        await this.assertCurrent();
        if (failure.reason !== 'replacementMissingOriginals') failure = error;
      }
    }
    throw failure;
  }

  /** Older journals can be upgraded only while the exact selected manifest
   * is still readable and the originally recorded replacement still qualifies. */
  async upgradeRemovalPlan(plan: WebDavArchiveRemoval, verification: WebDavArchiveVerification): Promise<WebDavArchiveRemoval> {
    const previous = this.retirementContent(plan);
    if (plan.replacementProof !== undefined) return plan;
    if (await this.getObject(`${PREFIX}${plan.sha256}.manifest`, MAX_MANIFEST_BYTES) === undefined) {
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    const upgraded = await this.planRemoval(plan.sha256, plan.manifestSha256, verification, plan.replacementSha256);
    if (this.retirementContent(upgraded) !== previous) {
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    return upgraded;
  }

  async canDiscardRemovalPlan(plan: WebDavArchiveRemoval): Promise<boolean> {
    this.retirementContent(plan);
    if (await this.hasRetirementMarker(plan.sha256)) return false;
    const target = await this.getObject(`${PREFIX}${plan.sha256}.manifest`, MAX_MANIFEST_BYTES);
    return target !== undefined && target.etag === plan.manifestEtag &&
      await recoveryDigest(target.bytes) === plan.manifestSha256 && !await this.hasRetirementMarker(plan.sha256);
  }

  async checkRetirementReplacement(plan: WebDavArchiveRemoval): Promise<void> {
    await this.readReplacementManifest(plan);
  }

  async unpublish(plan: WebDavArchiveRemoval, verification: WebDavArchiveVerification,
    conditionalDeletionProven: boolean = false): Promise<void> {
    const markerContent = this.retirementContent(plan);
    const markerName = this.retirementName(plan.sha256);
    const removedName = this.removedName(plan.sha256);
    const name = `${PREFIX}${plan.sha256}.manifest`;
    const marker = await this.getObject(markerName, MAX_MANIFEST_BYTES);
    if (marker !== undefined && !sameBytes(marker.bytes, recoveryUtf8(markerContent))) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
    const visible = await this.getObject(name, MAX_MANIFEST_BYTES);
    if (visible === undefined) {
      if (marker === undefined) throw new WebDavLibraryBackupError('cleanupFailed');
      await this.confirmReplacement(plan, verification);
      await this.confirmRemoved(name, removedName, markerContent);
      return;
    }
    if (visible.etag !== plan.manifestEtag || await recoveryDigest(visible.bytes) !== plan.manifestSha256) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
    const target = this.decodeManifest(name, visible.bytes);
    if (target.version !== 2 || target.pinned === true || target.bytes !== plan.bytes ||
      target.libraryId !== plan.replacementProof?.libraryId ||
      !target.parts.every((part: string, index: number): boolean => part === plan.parts[index])) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
    await this.confirmReplacement(plan, verification);
    if (!conditionalDeletionProven) await this.proveConditionalDeletion();
    if (marker === undefined) await this.publishImmutable(markerName, markerContent, MAX_MANIFEST_BYTES);
    await this.readReplacementManifest(plan);
    await this.deleteExact(name, plan.manifestEtag, MAX_MANIFEST_BYTES);
    await this.confirmRemoved(name, removedName, markerContent);
  }

  async removeRetiredParts(plan: WebDavArchiveRemoval, verification: WebDavArchiveVerification): Promise<void> {
    const expected = recoveryUtf8(this.retirementContent(plan));
    await this.ensureRetired(plan.sha256, expected);
    await this.confirmReplacement(plan, verification);
    await this.proveConditionalDeletion();
    for (let index = 0; index < plan.parts.length; index++) {
      const size = Math.min(PART_BYTES, plan.bytes - PART_BYTES * index);
      const limit = Math.ceil(size / 3) * 4;
      const name = this.partName(plan.sha256, index);
      let part: RemoteObject | undefined;
      try { part = await this.getObject(name, limit); }
      catch (error) {
        if (error instanceof WebDavLibraryBackupError && error.reason === 'corrupt') {
          throw new WebDavLibraryBackupError('cleanupFailed');
        }
        throw error;
      }
      if (part === undefined) continue;
      if (part.etag === undefined) throw new WebDavLibraryBackupError('cleanupFailed');
      try { await this.decodePart(part.bytes, size, plan.parts[index]); }
      catch (_) { throw new WebDavLibraryBackupError('cleanupFailed'); }
      await this.ensureRetired(plan.sha256, expected);
      await this.readReplacementManifest(plan);
      await this.deleteExact(name, part.etag, limit);
    }
  }

  private async authenticateArchive(archive: ReadableArchive,
    verification: WebDavArchiveVerification): Promise<LocalRecoveryArchiveProof> {
    await this.downloadArchive(archive, verification.path);
    let proof: LocalRecoveryArchiveProof;
    try { proof = await verification.inspect(verification.path); }
    catch (_) {
      await this.assertCurrent();
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    await this.assertCurrent();
    if (proof.libraryId === undefined || proof.libraryId !== archive.manifest.libraryId) {
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    return proof;
  }

  private async confirmReplacement(plan: WebDavArchiveRemoval, verification: WebDavArchiveVerification): Promise<void> {
    const replacement = await this.readReplacementManifest(plan);
    const proof = plan.replacementProof;
    if (proof === undefined) throw new WebDavLibraryBackupError('replacementUnverified');
    const authenticated = await this.authenticateArchive(replacement, verification);
    if (authenticated.createdAt !== proof.createdAt) throw new WebDavLibraryBackupError('replacementUnverified');
  }

  private async readReplacementManifest(plan: WebDavArchiveRemoval): Promise<ReadableArchive> {
    const proof = plan.replacementProof;
    if (proof === undefined) throw new WebDavLibraryBackupError('replacementUnverified');
    // The two marker lookups exclude replacements already being retired,
    // including ones that are still readable while deletion is incomplete.
    if (await this.hasRetirementMarker(plan.replacementSha256)) {
      throw new WebDavLibraryBackupError('replacementUnverified');
    }
    const name = `${PREFIX}${plan.replacementSha256}.manifest`;
    const current = await this.getObject(name, MAX_MANIFEST_BYTES);
    if (current === undefined || current.etag !== proof.manifestEtag ||
      await recoveryDigest(current.bytes) !== proof.manifestSha256) throw new WebDavLibraryBackupError('replacementUnverified');
    const manifest = this.decodeManifest(name, current.bytes);
    if (manifest.libraryId !== proof.libraryId) throw new WebDavLibraryBackupError('replacementUnverified');
    return { name, object: current, manifest, timestamp: manifest.createdAt };
  }

  private async hasRetirementMarker(sha256: string): Promise<boolean> {
    return await this.getObject(this.retirementName(sha256), MAX_MANIFEST_BYTES) !== undefined ||
      await this.getObject(this.removedName(sha256), MAX_MANIFEST_BYTES) !== undefined;
  }

  private canRemove(target: ReadableArchive, replacement: ReadableArchive): boolean {
    // Older readers can still be reading a v1 archive when its manifest is rechecked.
    return target.manifest.version === 2 && target.manifest.sha256 !== replacement.manifest.sha256 && target.manifest.pinned !== true &&
      target.object.etag !== undefined && replacement.object.etag !== undefined &&
      target.manifest.libraryId !== undefined && target.manifest.libraryId === replacement.manifest.libraryId &&
      target.timestamp !== undefined && replacement.timestamp !== undefined &&
      target.timestamp < replacement.timestamp;
  }

  private async readableArchives(selectedSha256?: string): Promise<ReadableArchive[]> {
    const response = await this.listResponse();
    if (response['status'] === 404) throw new WebDavLibraryBackupError('missing');
    if (response['status'] !== 207) throw new WebDavLibraryBackupError('failed');
    const entries = this.manifestEntries(await this.parseListing(response));
    const archives: ReadableArchive[] = [];
    let corrupt = false;
    for (const entry of entries) {
      if (selectedSha256 !== undefined && entry.name !== `${PREFIX}${selectedSha256}.manifest`) continue;
      try {
        const initial = await this.getObject(entry.name, MAX_MANIFEST_BYTES);
        if (initial === undefined) continue;
        const manifest = this.decodeManifest(entry.name, initial.bytes);
        const archive: ReadableArchive = { name: entry.name, object: initial, manifest,
          timestamp: manifest.version === 1 ? entry.modified : manifest.createdAt };
        if (await this.allowsArchiveRead(archive)) archives.push(archive);
      } catch (error) {
        if (!(error instanceof WebDavLibraryBackupError) || error.reason !== 'corrupt') throw error;
        corrupt = true;
      }
    }
    if (archives.length === 0 && corrupt) throw new WebDavLibraryBackupError('corrupt');
    archives.sort((a: ReadableArchive, b: ReadableArchive): number => (b.timestamp ?? 0) - (a.timestamp ?? 0) ||
      a.name.localeCompare(b.name, 'en'));
    return archives;
  }

  private async downloadArchive(archive: ReadableArchive, destination: string): Promise<void> {
    const started = systemDateTime.getUptime(systemDateTime.TimeType.STARTUP);
    const withinWindow = (): boolean => {
      const elapsed = systemDateTime.getUptime(systemDateTime.TimeType.STARTUP) - started;
      return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < WEB_DAV_ARCHIVE_READ_WINDOW;
    };
    const assertWindow = (): void => {
      if (!withinWindow()) throw new WebDavLibraryBackupError('conflict');
    };
    const manifest = archive.manifest;
    // Admit an exact manifest before the first part GET. Already-admitted readers
    // finish within the read window that precedes physical part reclamation.
    const admitted = await this.getObject(archive.name, MAX_MANIFEST_BYTES, archive.object.etag);
    if (admitted === undefined || admitted.etag !== archive.object.etag || !sameBytes(admitted.bytes, archive.object.bytes)) {
      throw new WebDavLibraryBackupError('conflict');
    }
    if (!await this.allowsArchiveRead(archive)) throw new WebDavLibraryBackupError('missing');
    assertWindow();
    await recoveryReserve(destination.slice(0, destination.lastIndexOf('/')), manifest.bytes);
    await recoveryOutput(destination, async (emit: (bytes: Uint8Array) => Promise<void>): Promise<void> => {
      for (let index = 0; index < manifest.parts.length; index++) {
        assertWindow();
        const size = Math.min(PART_BYTES, manifest.bytes - PART_BYTES * index);
        const part = await this.getObject(this.partName(manifest.sha256, index), Math.ceil(size / 3) * 4);
        if (part === undefined) throw new WebDavLibraryBackupError('corrupt');
        const decoded = await this.decodePart(part.bytes, size, manifest.parts[index]);
        await this.assertCurrent();
        assertWindow();
        await emit(decoded);
      }
    });
    assertWindow();
    const published = await recoveryVisitFile(destination, async (_bytes: Uint8Array): Promise<void> => {},
      (): boolean => !this.isCancelled() && withinWindow(), manifest.bytes);
    assertWindow();
    if (published !== manifest.sha256) throw new WebDavLibraryBackupError('corrupt');
  }

  private async decodePart(bytes: Uint8Array, size: number, sha256: string): Promise<Uint8Array> {
    try {
      const encoded = recoveryText(bytes);
      const base64 = new util.Base64Helper();
      const decoded = base64.decodeSync(encoded);
      if (decoded.length !== size || base64.encodeToStringSync(decoded) !== encoded || await recoveryDigest(decoded) !== sha256) {
        throw new WebDavLibraryBackupError('corrupt');
      }
      return decoded;
    } catch (_) { throw new WebDavLibraryBackupError('corrupt'); }
  }

  private async createDirectory(): Promise<void> {
    let parent = this.baseUrl;
    for (const segment of this.directory.split('/').filter((item: string): boolean => item.length > 0)) {
      parent += `/${segment}`;
      const created = await this.request({ method: 'MKCOL', url: `${parent}/` }, MAX_MANIFEST_BYTES);
      if (![200, 201, 204, 405].includes(created.status)) {
        throw new WebDavLibraryBackupError(created.status === 409 ? 'missing' : 'readOnly');
      }
    }
  }

  private async proveConditionalCreation(): Promise<RemoteObject> {
    const original = `${FORMAT}\ncondition-probe\nv2`;
    const before = await this.publishImmutable(CONDITIONAL_PROBE, original, MAX_MANIFEST_BYTES);
    // Only this isolated disposable probe object is eligible for the test.
    // An endpoint ignoring the condition may change the probe, never a package.
    const refused = await this.putObject(CONDITIONAL_PROBE, `${original}\nconflicting bytes`);
    if (refused.status !== 412) throw new WebDavLibraryBackupError('readOnly');
    const after = await this.getObject(CONDITIONAL_PROBE, MAX_MANIFEST_BYTES);
    if (after === undefined || after.etag !== before.etag ||
      !sameBytes(after.bytes, recoveryUtf8(original))) throw new WebDavLibraryBackupError('readOnly');
    return after;
  }

  async proveConditionalDeletion(): Promise<void> {
    const before = await this.proveConditionalCreation();
    const wrongTag = before.etag === '"reader-retirement-test"' ? '"reader-retirement-mismatch"' : '"reader-retirement-test"';
    const refused = await this.deleteObject(CONDITIONAL_PROBE, wrongTag);
    if (refused.status !== 412) throw new WebDavLibraryBackupError('readOnly');
    const after = await this.getObject(CONDITIONAL_PROBE, MAX_MANIFEST_BYTES, before.etag);
    if (after === undefined || after.etag !== before.etag || !sameBytes(after.bytes, before.bytes)) {
      throw new WebDavLibraryBackupError('readOnly');
    }
    const etag = after.etag;
    if (etag === undefined) throw new WebDavLibraryBackupError('readOnly');
    const deleted = await this.deleteObject(CONDITIONAL_PROBE, etag);
    if (![200, 202, 204].includes(deleted.status) || await this.getObject(CONDITIONAL_PROBE, MAX_MANIFEST_BYTES) !== undefined) {
      throw new WebDavLibraryBackupError('readOnly');
    }
  }

  private async deleteExact(name: string, etag: string, limit: number): Promise<void> {
    let status = 0;
    try {
      status = (await this.deleteObject(name, etag)).status;
    } catch (error) {
      if (!(error instanceof WebDavLibraryBackupError) || error.reason !== 'failed') throw error;
    }
    if (status === 405 || status === 501) throw new WebDavLibraryBackupError('readOnly');
    if (await this.getObject(name, limit) !== undefined) throw new WebDavLibraryBackupError('cleanupFailed');
  }

  private async deleteObject(name: string, etag: string): Promise<HttpBytesResponse> {
    return this.request({ url: `${this.collection}/${name}`, method: 'DELETE', headers: { 'If-Match': etag } },
      MAX_MANIFEST_BYTES);
  }

  private async ensureNotRetired(sha256: string): Promise<void> {
    if (await this.getObject(this.retirementName(sha256), MAX_MANIFEST_BYTES) !== undefined ||
      await this.getObject(this.removedName(sha256), MAX_MANIFEST_BYTES) !== undefined) {
      throw new WebDavLibraryBackupError('conflict');
    }
  }

  private async allowsArchiveRead(archive: ReadableArchive): Promise<boolean> {
    const sha256 = archive.manifest.sha256;
    const pending = await this.getObject(this.retirementName(sha256), MAX_MANIFEST_BYTES);
    if (pending !== undefined) {
      // A denied or interrupted DELETE leaves the exact archive available.
      try {
        const marker = object(JSON.parse(recoveryText(pending.bytes)));
        if (archive.manifest.version !== 2 || marker['format'] !== FORMAT || marker['version'] !== 1 ||
          marker['sha256'] !== sha256 || marker['manifestSha256'] !== await recoveryDigest(archive.object.bytes)) return false;
      } catch (_) { return false; }
    }
    return await this.getObject(this.removedName(sha256), MAX_MANIFEST_BYTES) === undefined;
  }

  private async ensureRetired(sha256: string, expected: Uint8Array): Promise<void> {
    const marker = await this.getObject(this.retirementName(sha256), MAX_MANIFEST_BYTES);
    const removed = await this.getObject(this.removedName(sha256), MAX_MANIFEST_BYTES);
    if (marker === undefined || !sameBytes(marker.bytes, expected) ||
      removed === undefined || !sameBytes(removed.bytes, expected) ||
      await this.getObject(`${PREFIX}${sha256}.manifest`, MAX_MANIFEST_BYTES) !== undefined) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
  }

  private async confirmRemoved(manifestName: string, removedName: string, markerContent: string): Promise<void> {
    await this.publishImmutable(removedName, markerContent, MAX_MANIFEST_BYTES);
    if (await this.getObject(manifestName, MAX_MANIFEST_BYTES) !== undefined) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
  }

  private retirementName(sha256: string): string {
    return `${PREFIX}${sha256}.retired`;
  }

  private removedName(sha256: string): string {
    return `${PREFIX}${sha256}.removed`;
  }

  private retirementContent(plan: WebDavArchiveRemoval): string {
    if (!SHA256.test(plan.sha256) || !SHA256.test(plan.manifestSha256) || !admittedEtag(plan.manifestEtag) ||
      plan.sha256 === plan.replacementSha256 || !SHA256.test(plan.replacementSha256) ||
      !admittedSize(plan.bytes) || !admittedParts(plan.parts, plan.bytes)) {
      throw new WebDavLibraryBackupError('cleanupFailed');
    }
    return JSON.stringify({ format: FORMAT, version: 1, sha256: plan.sha256, manifestSha256: plan.manifestSha256,
      manifestEtag: plan.manifestEtag, replacementSha256: plan.replacementSha256, bytes: plan.bytes, parts: plan.parts });
  }

  private async publishImmutable(name: string, content: string, limit: number): Promise<RemoteObject> {
    const expected = recoveryUtf8(content);
    const existing = await this.getObject(name, limit);
    if (existing !== undefined) return this.verifyPublication(existing, expected);
    let status = 0;
    try {
      const written = await this.putObject(name, content);
      status = written.status;
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
    if (received.etag === undefined) throw new WebDavLibraryBackupError('readOnly');
    if (!sameBytes(received.bytes, expected)) throw new WebDavLibraryBackupError('conflict');
    return received;
  }

  private async putObject(name: string, content: string): Promise<HttpBytesResponse> {
    return this.request({ url: `${this.collection}/${name}`, method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'If-None-Match': '*' }, body: content }, MAX_MANIFEST_BYTES);
  }

  private async getObject(name: string, limit: number, expectedTag?: string): Promise<RemoteObject | undefined> {
    const headers: JsonObject = { 'Cache-Control': 'no-cache', Accept: 'application/octet-stream' };
    if (expectedTag !== undefined) headers['If-Match'] = expectedTag;
    const response = await this.request({ url: `${this.collection}/${name}`, method: 'GET',
      headers }, Math.max(limit, MAX_MANIFEST_BYTES));
    if (response.status === 404) return undefined;
    if (response.status === 412 && expectedTag !== undefined) throw new WebDavLibraryBackupError('conflict');
    if (response.status !== 200) throw new WebDavLibraryBackupError('failed');
    const bytes = response.bytes;
    if (bytes.length === 0 || bytes.length > limit) throw new WebDavLibraryBackupError('corrupt');
    return { bytes, etag: strongEtag({ headers: response.headers }) };
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
    const response = await this.request({ ...request, url: `${this.collection}/` }, MAX_LIST_BYTES);
    return { status: response.status, body: response.status === 207 ? recoveryText(response.bytes) : '', headers: response.headers };
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

  private async request(descriptor: JsonObject, limit: number): Promise<HttpBytesResponse> {
    await this.assertCurrent();
    const source = descriptor['headers'];
    const headers: JsonObject = source === undefined ? {} : { ...object(source) };
    if (this.authorization !== undefined) headers['Authorization'] = this.authorization;
    let response: HttpBytesResponse;
    try {
      response = await HttpExecuteHost.instance.executeWebDav(this.baseUrl, { ...descriptor, headers }, limit, this.isCancelled);
    } catch (error) {
      await this.assertCurrent();
      // The shared Host preserves a known error status in this specific
      // diagnostic when native HTTP omits the response representation.
      const bodyless = error instanceof Error ?
        /^http\.execute: source returned HTTP ([45][0-9]{2}) without response content$/.exec(error.message) : null;
      if (bodyless === null) throw new WebDavLibraryBackupError('failed');
      response = { status: Number(bodyless[1]), bytes: new Uint8Array(0), headers: {}, finalUrl: '' };
    }
    await this.assertCurrent();
    const status = response.status;
    if (status === 401) throw new WebDavLibraryBackupError('authentication');
    if (status === 403) {
      const method = descriptor['method'];
      throw new WebDavLibraryBackupError(method === 'GET' || method === 'PROPFIND' ? 'authentication' : 'readOnly');
    }
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
      const parsed = typeof modified === 'string' ? Date.parse(modified) : undefined;
      const timestamp = admittedTimestamp(parsed) ? parsed : undefined;
      const prior = entries.get(name);
      entries.set(name, { name, modified: prior !== undefined && prior.modified !== timestamp ? undefined : timestamp });
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
      const version = decoded['version'];
      if (match === null || typeof sha256 !== 'string' || sha256 !== match[1] || !admittedSize(size) ||
        decoded['format'] !== FORMAT || !admittedParts(parts, size)) {
        throw new WebDavLibraryBackupError('corrupt');
      }
      if (version === 1 && Object.keys(decoded).length === 5) {
        return { format: FORMAT, version, sha256, bytes: size, parts };
      }
      const createdAt = decoded['createdAt'];
      const libraryId = decoded['libraryId'];
      const writerInstanceId = decoded['writerInstanceId'];
      const pinned = decoded['pinned'];
      if (version !== 2 || Object.keys(decoded).some((key: string): boolean =>
        !['format', 'version', 'sha256', 'bytes', 'parts', 'createdAt', 'libraryId', 'writerInstanceId', 'pinned'].includes(key)) ||
        (createdAt !== undefined && !admittedTimestamp(createdAt)) ||
        (libraryId !== undefined && !admittedIdentity(libraryId)) ||
        (writerInstanceId !== undefined && !admittedIdentity(writerInstanceId)) || typeof pinned !== 'boolean') {
        throw new WebDavLibraryBackupError('corrupt');
      }
      return { format: FORMAT, version, sha256, bytes: size, parts, pinned,
        createdAt: admittedTimestamp(createdAt) ? createdAt : undefined,
        libraryId: admittedIdentity(libraryId) ? libraryId : undefined,
        writerInstanceId: admittedIdentity(writerInstanceId) ? writerInstanceId : undefined };
    } catch (_) { throw new WebDavLibraryBackupError('corrupt'); }
  }

  private partName(sha256: string, index: number): string {
    return `${PREFIX}${sha256}.${index.toString().padStart(3, '0')}.part`;
  }
}
