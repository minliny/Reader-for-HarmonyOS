import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import statfs from '@ohos.file.statvfs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { canonicalReadingImageBaseUrl } from '../common/ReadingImageIdentity';
import {
  assertReadingOfflineWriteCapacity,
  ReadingOfflineMaterializationError,
} from '../features/reading/ReadingOfflineContract';

const CACHE_FORMAT_VERSION = 2;
const LEGACY_CACHE_FORMAT_VERSION = 1;
const TEXT_CACHE_OWNER = 'reader-text-images-v2';
const MAX_READING_IMAGE_BYTES = 16 * 1024 * 1024;
const MIN_READING_IMAGE_FREE_RESERVE_BYTES = 16 * 1024 * 1024;
const FILE_SYSTEM_NO_SPACE_ERROR = 13900025;

export interface ReadingImageFreeSpaceProbe {
  getFreeBytes(path: string): Promise<number>;
}

class HarmonyReadingImageFreeSpaceProbe implements ReadingImageFreeSpaceProbe {
  async getFreeBytes(path: string): Promise<number> {
    return statfs.getFreeSize(path);
  }
}

export type ReadingImageCacheIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
  imageUrl: string;
  baseUrl?: string;
};

export type ReadingImageChapterIdentity = {
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
};

/** One canonical identity form shared by projection, requests, and disk keys. */
type ReadingImageChapterManifest = {
  /** Upstream manga manifests and partial text ownership use separate files. */
  manga?: boolean;
  mangaCacheProfile?: string;
  chapterId?: string;
  cacheOwner?: string;
  formatVersion: number;
  sourceId: string;
  bookId: string;
  chapterIndex: number;
  contentVersion: string;
  resourceHashes: string[];
  completedAt: number;
};

/**
 * Durable Host-owned bytes for offline body images.
 *
 * Core continues to own the stable image locator and chapter body. The Host
 * stores only bounded resource bytes plus an exact chapter/content-version
 * manifest. Paths contain SHA-256 identities rather than URLs, cookies, or
 * source credentials. A manifest is published only after every resource file
 * exists, so restart can never mistake a partial range for offline-complete.
 */
export class ReadingImageDiskCache {
  private readonly context: common.UIAbilityContext;
  private readonly freeSpaceProbe: ReadingImageFreeSpaceProbe;
  private readonly inFlightWrites = new Map<string, Promise<void>>();
  /**
   * Serializes destructive/constructive mutations for one book identity.
   * A chapter clear or corrupt-resource removal must not race a background
   * prefetch and recreate bytes after the caller has declared them gone.
   * Different books remain independent and still use the two write lanes.
   */
  private readonly bookMutationTails = new Map<string, Promise<void>>();
  private readonly bookClearGenerations = new Map<string, number>();
  private closed: boolean = false;
  private writeLaneA: Promise<void> = Promise.resolve();
  private writeLaneB: Promise<void> = Promise.resolve();
  private nextWriteLane: number = 0;
  private nextTemporaryFile: number = 0;

  constructor(
    context: common.UIAbilityContext,
    freeSpaceProbe: ReadingImageFreeSpaceProbe = new HarmonyReadingImageFreeSpaceProbe(),
  ) {
    this.context = context;
    this.freeSpaceProbe = freeSpaceProbe;
  }

  /** Capture before a network request; a later clear/close cannot admit its bytes. */
  captureValidity(sourceId: string, bookId: string, isCurrent?: () => boolean): () => boolean {
    const key = this.bookMutationKey(sourceId, bookId);
    const generation = this.bookClearGenerations.get(key) ?? 0;
    return (): boolean => !this.closed && (this.bookClearGenerations.get(key) ?? 0) === generation &&
      (isCurrent === undefined || isCurrent());
  }

  close(): void {
    this.closed = true;
  }

  async loadResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<Uint8Array | undefined> {
    this.assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    let result: Uint8Array | undefined;
    await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const path = await this.resourcePath(requestedIdentity);
      const legacyRevocation = `${await this.clearMarkerPath(requestedIdentity.sourceId, requestedIdentity.bookId)}.legacy-revoked`;
      // An old clear cannot delete unidentifiable bytes, but it also cannot
      // admit them again. Fresh text writes carry their own exact ownership.
      if (!(await fileIo.access(legacyRevocation)) || await this.ownsTextResource(requestedIdentity)) {
        result = await this.readResourceBytes(path);
      }
      if (result === undefined && this.hasUnambiguousLegacyResourceIdentity(requestedIdentity) &&
        !(await fileIo.access(legacyRevocation))) {
        // A legacy ordinal alone is never evidence. Only its exact manifest
        // identity/version and listed resource hash authorize byte migration.
        const directory = await this.legacyChapterDirectory(requestedIdentity);
        const manifest = await this.readValidManifest(directory, LEGACY_CACHE_FORMAT_VERSION);
        const hash = await this.legacyResourceHash(requestedIdentity);
        if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) &&
          manifest.resourceHashes.indexOf(hash) >= 0) {
          result = await this.readResourceBytes(`${directory}/${hash}.bin`);
          if (result !== undefined) {
            const target = await this.chapterDirectory(requestedIdentity);
            await this.ensureDirectory(target);
            await this.assertWriteCapacity(target, result.byteLength);
            await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
            await this.writeAtomicBytes(path, result, isCurrent);
          }
        }
      }
      this.assertCurrent(isCurrent);
    });
    return result;
  }

  async storeResource(
    identity: ReadingImageCacheIdentity,
    bytes: Uint8Array,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<void> {
    this.assertResourceIdentity(identity);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`offline reading image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    const payload = bytes.slice();
    await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      const directory = await this.chapterDirectory(requestedIdentity);
      await this.ensureDirectory(directory);
      await this.assertWriteCapacity(directory, payload.byteLength);
      await this.recordTextResourceOwnership(requestedIdentity, isCurrent);
      await this.writeAtomicBytes(await this.resourcePath(requestedIdentity), payload, isCurrent);
    });
  }

  async removeResource(
    identity: ReadingImageCacheIdentity,
    isCurrent: () => boolean = this.captureValidity(identity.sourceId, identity.bookId),
  ): Promise<void> {
    this.assertResourceIdentity(identity);
    const requestedIdentity: ReadingImageCacheIdentity = { ...identity };
    await this.enqueueBookMutation(this.bookMutationKey(identity.sourceId, identity.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedIdentity.sourceId, requestedIdentity.bookId);
      await this.unlinkIfPresent(await this.resourcePath(requestedIdentity));
      // Do not permit a corrupt migrated resource to be loaded again from v1.
      const legacyDirectory = await this.legacyChapterDirectory(requestedIdentity);
      const manifest = await this.readValidManifest(legacyDirectory, LEGACY_CACHE_FORMAT_VERSION);
      const hash = await this.legacyResourceHash(requestedIdentity);
      if (manifest !== undefined && this.sameChapter(manifest, requestedIdentity) &&
        this.hasUnambiguousLegacyResourceIdentity(requestedIdentity) && manifest.resourceHashes.indexOf(hash) >= 0) {
        await this.unlinkIfPresent(`${legacyDirectory}/${hash}.bin`);
      }
    });
  }

  async markChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
    isCurrent: () => boolean = this.captureValidity(chapter.sourceId, chapter.bookId),
  ): Promise<void> {
    this.assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const requestedResources = resources.map((resource: ReadingImageCacheIdentity): ReadingImageCacheIdentity => ({ ...resource }));
    await this.enqueueBookMutation(this.bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      const resourceHashes: string[] = [];
      const directory = await this.chapterDirectory(requestedChapter);
      for (const resource of requestedResources) {
        this.assertResourceIdentity(resource);
        this.assertSameChapter(requestedChapter, resource);
        const hash = await this.resourceHash(resource);
        if (!(await this.validResourceFile(`${directory}/${hash}.bin`))) {
          throw new Error('offline reading image manifest cannot reference missing bytes');
        }
        if (resourceHashes.indexOf(hash) < 0) resourceHashes.push(hash);
      }
      resourceHashes.sort();
      const manifest: ReadingImageChapterManifest = {
        formatVersion: CACHE_FORMAT_VERSION,
        sourceId: requestedChapter.sourceId,
        bookId: requestedChapter.bookId,
        chapterIndex: requestedChapter.chapterIndex,
        contentVersion: requestedChapter.contentVersion,
        resourceHashes,
        completedAt: Date.now(),
      };
      await this.ensureDirectory(directory);
      const manifestBytes = new util.TextEncoder().encodeInto(JSON.stringify(manifest));
      await this.assertWriteCapacity(directory, manifestBytes.byteLength);
      await this.writeAtomicBytes(`${directory}/manifest.json`, manifestBytes, isCurrent);
      // Publication never reclaims another version (or an active display's
      // resources). Only an explicit Core-first book clear owns that decision.
    });
  }

  async isChapterComplete(chapter: ReadingImageChapterIdentity): Promise<boolean> {
    this.assertChapterIdentity(chapter);
    const requestedChapter: ReadingImageChapterIdentity = { ...chapter };
    const isCurrent = this.captureValidity(chapter.sourceId, chapter.bookId);
    let complete = false;
    await this.enqueueBookMutation(this.bookMutationKey(chapter.sourceId, chapter.bookId), async (): Promise<void> => {
      this.assertCurrent(isCurrent);
      await this.finishPendingClear(requestedChapter.sourceId, requestedChapter.bookId);
      const value = await this.readValidManifest(await this.chapterDirectory(requestedChapter), CACHE_FORMAT_VERSION);
      this.assertCurrent(isCurrent);
      complete = value !== undefined && this.sameChapter(value, requestedChapter);
    });
    return complete;
  }

  private async readValidManifest(directory: string, formatVersion: number): Promise<ReadingImageChapterManifest | undefined> {
    try {
      const value = await this.readManifestIdentity(directory, formatVersion);
      if (value === undefined || !this.isTextOwnership(value)) return undefined;
      for (const hash of value.resourceHashes) {
        if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
          !(await this.validResourceFile(`${directory}/${hash}.bin`))) return undefined;
      }
      return value;
    } catch (_) {
      return undefined;
    }
  }

  private async readManifestIdentity(directory: string, formatVersion: number, fileName: string = 'manifest.json',
    retryIoErrors: boolean = false): Promise<ReadingImageChapterManifest | undefined> {
    const path = `${directory}/${fileName}`;
    if (!(await fileIo.access(path))) return undefined;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(new fileIo.AtomicFile(path).readFully());
    } catch (error) {
      if (retryIoErrors) throw error;
      return undefined;
    }
    try {
      const raw = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
      const value = JSON.parse(raw) as ReadingImageChapterManifest;
      if (value.formatVersion !== formatVersion || typeof value.sourceId !== 'string' ||
        typeof value.bookId !== 'string' || !Number.isSafeInteger(value.chapterIndex) || value.chapterIndex < 0 ||
        typeof value.contentVersion !== 'string' || value.contentVersion.trim().length === 0) return undefined;
      return value;
    } catch (_) {
      return undefined;
    }
  }

  /** Called only after Core has invalidated the corresponding usable refs. */
  async clearBook(sourceId: string, bookId: string): Promise<void> {
    this.assertNonBlank(sourceId, 'sourceId');
    this.assertNonBlank(bookId, 'bookId');
    const key = this.bookMutationKey(sourceId, bookId);
    this.bookClearGenerations.set(key, (this.bookClearGenerations.get(key) ?? 0) + 1);
    await this.enqueueBookMutation(key, async (): Promise<void> => {
      const marker = await this.clearMarkerPath(sourceId, bookId);
      await this.ensureDirectory(`${this.rootDirectory()}/.clear`);
      // Keep this small durable intent until deletion finishes. After a crash,
      // reads/writes resume the already-authorized deletion before admission.
      await this.writeAtomicBytes(marker, new util.TextEncoder().encodeInto('clear'));
      await this.finishPendingClear(sourceId, bookId);
    });
  }

  private async finishPendingClear(sourceId: string, bookId: string): Promise<void> {
    const marker = await this.clearMarkerPath(sourceId, bookId);
    if (!(await fileIo.access(marker))) return;
    const book = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}`;
    if (await fileIo.access(book)) {
      for (const ordinal of await fileIo.listFile(book)) {
        if (!/^(0|[1-9][0-9]*)$/.test(ordinal)) continue;
        const chapter = `${book}/${ordinal}`;
        if (!(await fileIo.stat(chapter)).isDirectory()) continue;
        for (const version of await fileIo.listFile(chapter)) {
          if (!/^[0-9a-f]{64}$/.test(version)) continue;
          const directory = `${chapter}/${version}`;
          if (!(await fileIo.stat(directory)).isDirectory()) continue;
          await this.clearOwnedTextDirectory(directory, CACHE_FORMAT_VERSION, sourceId, bookId, ordinal, version);
        }
        await this.removeEmptyDirectory(chapter);
      }
      await this.removeEmptyDirectory(book);
    }
    const legacyBook = `${this.legacyRootDirectory()}/${await this.legacyBookHash(sourceId, bookId)}`;
    if (await fileIo.access(legacyBook)) {
      for (const name of await fileIo.listFile(legacyBook)) {
        if (!/^(0|[1-9][0-9]*)$/.test(name)) continue;
        const directory = `${legacyBook}/${name}`;
        // v1 delimiter keys could collide. Never delete another pair's data,
        // nor claim unidentifiable legacy garbage merely by directory number.
        if ((await fileIo.stat(directory)).isDirectory()) {
          await this.clearOwnedTextDirectory(directory, LEGACY_CACHE_FORMAT_VERSION, sourceId, bookId, name);
        }
      }
      await this.removeEmptyDirectory(legacyBook);
    }
    // Revocation survives successful cleanup too: unreadable/unidentifiable
    // legacy leftovers must never become readable after a later restart.
    await this.writeAtomicBytes(`${marker}.legacy-revoked`, new util.TextEncoder().encodeInto('cleared'));
    await this.unlinkIfPresent(marker);
  }

  /** Same manga signals used by the upstream Host; no retention policy here. */
  private async containsMangaManifest(directory: string): Promise<boolean> {
    for (const name of await fileIo.listFile(directory)) {
      const path = `${directory}/${name}`;
      if (name === '.manga' || name === 'manga-identity.json' || name === 'manifest-script-bgra-v2.json') return true;
      const stat = await fileIo.stat(path);
      if (stat.isDirectory()) {
        if (await this.containsMangaManifest(path)) return true;
      } else if (name === 'manifest.json') {
        const value = await this.readManifestIdentity(directory, CACHE_FORMAT_VERSION, name, true) ??
          await this.readManifestIdentity(directory, LEGACY_CACHE_FORMAT_VERSION, name, true);
        if (value?.manga === true || value?.chapterId !== undefined || value?.mangaCacheProfile !== undefined) return true;
      }
    }
    return false;
  }

  private isTextOwnership(value: ReadingImageChapterManifest): boolean {
    return value.manga !== true && value.chapterId === undefined && value.mangaCacheProfile === undefined &&
      (value.cacheOwner === undefined || value.cacheOwner === TEXT_CACHE_OWNER) && Array.isArray(value.resourceHashes) &&
      value.resourceHashes.every((hash: string): boolean => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash));
  }

  private async clearOwnedTextDirectory(directory: string, formatVersion: number, sourceId: string, bookId: string,
    ordinal: string, version?: string): Promise<void> {
    if (await this.containsMangaManifest(directory)) return;
    const files = formatVersion === CACHE_FORMAT_VERSION ? ['manifest.json', 'text-identity.json'] : ['manifest.json'];
    const ownedFiles: string[] = [];
    const hashes: Set<string> = new Set<string>();
    for (const fileName of files) {
      const value = await this.readManifestIdentity(directory, formatVersion, fileName, true);
      if (value === undefined || !this.isTextOwnership(value) || value.sourceId !== sourceId || value.bookId !== bookId ||
        `${value.chapterIndex}` !== ordinal || (version !== undefined && await this.sha256(value.contentVersion) !== version) ||
        (fileName === 'text-identity.json' && value.cacheOwner !== TEXT_CACHE_OWNER)) continue;
      ownedFiles.push(fileName);
      for (const hash of value.resourceHashes) hashes.add(hash);
    }
    if (ownedFiles.length === 0) return;
    // Keep ownership until all named bytes have been removed. A failure must
    // leave both the original pending intent and enough proof for its retry.
    for (const hash of hashes) {
      const path = `${directory}/${hash}.bin`;
      if (await fileIo.access(path) && !(await fileIo.stat(path)).isDirectory()) await fileIo.unlink(path);
    }
    for (const fileName of ownedFiles) await this.unlinkIfPresent(`${directory}/${fileName}`);
    await this.removeEmptyDirectory(directory);
  }

  private async removeEmptyDirectory(directory: string): Promise<void> {
    if (await fileIo.access(directory) && (await fileIo.listFile(directory)).length === 0) await fileIo.rmdir(directory);
  }

  private async ownsTextResource(identity: ReadingImageCacheIdentity): Promise<boolean> {
    const directory = await this.chapterDirectory(identity);
    const hash = await this.resourceHash(identity);
    for (const fileName of ['manifest.json', 'text-identity.json']) {
      const value = await this.readManifestIdentity(directory, CACHE_FORMAT_VERSION, fileName, true);
      if (value !== undefined && this.isTextOwnership(value) && this.sameChapter(value, identity) &&
        (fileName !== 'text-identity.json' || value.cacheOwner === TEXT_CACHE_OWNER) && value.resourceHashes.indexOf(hash) >= 0) return true;
    }
    return false;
  }

  /** Partial writes need durable ownership without publishing completion. */
  private async recordTextResourceOwnership(identity: ReadingImageCacheIdentity, current: () => boolean): Promise<void> {
    const directory = await this.chapterDirectory(identity);
    if (await this.containsMangaManifest(directory)) throw new Error('text image cache cannot overwrite manga ownership');
    const previous = await this.readManifestIdentity(directory, CACHE_FORMAT_VERSION, 'text-identity.json', true);
    if ((previous === undefined && await fileIo.access(`${directory}/text-identity.json`)) ||
      (previous !== undefined && (!this.isTextOwnership(previous) || previous.cacheOwner !== TEXT_CACHE_OWNER ||
      !this.sameChapter(previous, identity)))) throw new Error('text image cache ownership mismatch');
    const hashes = new Set<string>(previous?.resourceHashes ?? []);
    hashes.add(await this.resourceHash(identity));
    const ownership: ReadingImageChapterManifest = { formatVersion: CACHE_FORMAT_VERSION, cacheOwner: TEXT_CACHE_OWNER,
      sourceId: identity.sourceId, bookId: identity.bookId, chapterIndex: identity.chapterIndex,
      contentVersion: identity.contentVersion, resourceHashes: Array.from(hashes).sort(), completedAt: 0 };
    await this.writeAtomicBytes(`${directory}/text-identity.json`, new util.TextEncoder().encodeInto(JSON.stringify(ownership)), current);
  }

  private async clearMarkerPath(sourceId: string, bookId: string): Promise<string> {
    return `${this.rootDirectory()}/.clear/${await this.bookHash(sourceId, bookId)}.pending`;
  }

  private async chapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    // This is the existing exact identity, not a fabricated stable chapter ID.
    return `${this.rootDirectory()}/${await this.bookHash(identity.sourceId, identity.bookId)}/` +
      `${identity.chapterIndex}/${await this.sha256(identity.contentVersion)}`;
  }

  private async legacyChapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.legacyRootDirectory()}/${await this.legacyBookHash(identity.sourceId, identity.bookId)}/${identity.chapterIndex}`;
  }

  private async resourcePath(identity: ReadingImageCacheIdentity): Promise<string> {
    return `${await this.chapterDirectory(identity)}/${await this.resourceHash(identity)}.bin`;
  }

  private async bookHash(sourceId: string, bookId: string): Promise<string> {
    return this.sha256(JSON.stringify([sourceId, bookId]));
  }

  private async legacyBookHash(sourceId: string, bookId: string): Promise<string> {
    return this.sha256(`${sourceId}\u0000${bookId}`);
  }

  private bookMutationKey(sourceId: string, bookId: string): string {
    // Do not use a delimiter-only key: although normal IDs are opaque strings,
    // a caller-controlled NUL could otherwise make two distinct pairs share a
    // mutation tail (for example `a\0b`/`c` and `a`/`b\0c`).
    return JSON.stringify([sourceId, bookId]);
  }

  private enqueueBookMutation(
    key: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.bookMutationTails.get(key) ?? Promise.resolve();
    const task = previous.catch((): void => {}).then(operation);
    const settled = task.catch((): void => {});
    this.bookMutationTails.set(key, settled);
    return task.finally((): void => {
      if (this.bookMutationTails.get(key) === settled) {
        this.bookMutationTails.delete(key);
      }
    });
  }

  private async resourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
    const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
    return this.sha256(JSON.stringify([identity.contentVersion, identity.imageUrl, baseUrl ?? '']));
  }

  private hasUnambiguousLegacyResourceIdentity(identity: ReadingImageCacheIdentity): boolean {
    // v1 has no URL metadata to disambiguate delimiter-bearing resource keys.
    return identity.imageUrl.indexOf('\u0000') < 0 &&
      (canonicalReadingImageBaseUrl(identity.baseUrl) ?? '').indexOf('\u0000') < 0;
  }

  private async legacyResourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
    const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
    return this.sha256(`${identity.contentVersion}\u0000${identity.imageUrl}\u0000${baseUrl ?? ''}`);
  }

  private async sha256(value: string): Promise<string> {
    const digest = cryptoFramework.createMd('SHA256');
    await digest.update({ data: new util.TextEncoder().encodeInto(value) });
    const output = await digest.digest();
    const alphabet = '0123456789abcdef';
    let result = '';
    for (const byte of output.data) {
      result += alphabet.charAt((byte >>> 4) & 0x0f);
      result += alphabet.charAt(byte & 0x0f);
    }
    return result;
  }

  private rootDirectory(): string {
    return `${this.context.filesDir}/reader-offline/images-v2`;
  }

  private legacyRootDirectory(): string {
    return `${this.context.filesDir}/reader-offline/images-v1`;
  }

  private async writeAtomicBytes(path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> {
    const existing = this.inFlightWrites.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.enqueueWrite(async (): Promise<void> => {
      await this.performAtomicWrite(path, bytes, isCurrent);
    });
    this.inFlightWrites.set(path, operation);
    try {
      await operation;
    } finally {
      if (this.inFlightWrites.get(path) === operation) {
        this.inFlightWrites.delete(path);
      }
    }
  }

  private async enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const laneA = this.nextWriteLane % 2 === 0;
    this.nextWriteLane += 1;
    const predecessor = laneA ? this.writeLaneA : this.writeLaneB;
    let release: () => void = (): void => {};
    const tail = new Promise<void>((resolve): void => {
      release = resolve;
    });
    if (laneA) {
      this.writeLaneA = tail;
    } else {
      this.writeLaneB = tail;
    }
    await predecessor;
    try {
      await operation();
    } finally {
      release();
    }
  }

  private async performAtomicWrite(path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void> {
    this.nextTemporaryFile += 1;
    const tmpPath = `${path}.tmp-${this.nextTemporaryFile}`;
    try {
      this.assertCurrent(isCurrent);
      const file = await fileIo.open(
        tmpPath,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
      );
      try {
        let writtenBytes = 0;
        while (writtenBytes < bytes.byteLength) {
          const chunk = bytes.slice(writtenBytes);
          const written = await fileIo.write(file.fd, chunk.buffer);
          if (!Number.isSafeInteger(written) || written <= 0 || written > chunk.byteLength) {
            throw new Error('offline reading image destination stopped accepting bytes');
          }
          writtenBytes += written;
        }
        await fileIo.fsync(file.fd);
      } finally {
        await fileIo.close(file);
      }
      this.assertCurrent(isCurrent);
      await fileIo.rename(tmpPath, path);
    } catch (error) {
      try {
        await fileIo.unlink(tmpPath);
      } catch (_) {
      }
      if ((error as BusinessError).code === FILE_SYSTEM_NO_SPACE_ERROR) {
        throw new ReadingOfflineMaterializationError(
          'storage_full',
          'offline reading image storage is full',
        );
      }
      throw error;
    }
  }

  private async assertWriteCapacity(directory: string, writeBytes: number): Promise<void> {
    const freeBytes = await this.freeSpaceProbe.getFreeBytes(directory);
    assertReadingOfflineWriteCapacity(
      freeBytes,
      writeBytes,
      MIN_READING_IMAGE_FREE_RESERVE_BYTES,
    );
  }

  private async ensureDirectory(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      return;
    }
    try {
      await fileIo.mkdir(path, true);
    } catch (error) {
      if (!(await fileIo.access(path))) {
        throw error;
      }
    }
  }

  private async unlinkIfPresent(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      await fileIo.unlink(path);
    }
  }

  private async validResourceFile(path: string): Promise<boolean> {
    if (!(await fileIo.access(path))) return false;
    const stat = await fileIo.stat(path);
    return !stat.isDirectory() && Number.isSafeInteger(stat.size) && stat.size > 0 && stat.size <= MAX_READING_IMAGE_BYTES;
  }

  private async readResourceBytes(path: string): Promise<Uint8Array | undefined> {
    if (!(await this.validResourceFile(path))) return undefined;
    const stat = await fileIo.stat(path);
    const buffer = new fileIo.AtomicFile(path).readFully();
    if (buffer.byteLength !== stat.size) throw new Error('offline reading image changed while being read');
    return new Uint8Array(buffer);
  }

  private sameChapter(left: ReadingImageChapterIdentity, right: ReadingImageChapterIdentity): boolean {
    return left.sourceId === right.sourceId && left.bookId === right.bookId &&
      left.chapterIndex === right.chapterIndex && left.contentVersion === right.contentVersion;
  }

  private assertCurrent(isCurrent?: () => boolean): void {
    if (isCurrent !== undefined && !isCurrent()) throw new Error('offline reading image operation was superseded');
  }

  private assertResourceIdentity(identity: ReadingImageCacheIdentity): void {
    this.assertChapterIdentity(identity);
    this.assertNonBlank(identity.imageUrl, 'imageUrl');
  }

  private assertChapterIdentity(identity: ReadingImageChapterIdentity): void {
    this.assertNonBlank(identity.sourceId, 'sourceId');
    this.assertNonBlank(identity.bookId, 'bookId');
    this.assertNonBlank(identity.contentVersion, 'contentVersion');
    if (!Number.isSafeInteger(identity.chapterIndex) || identity.chapterIndex < 0) {
      throw new Error('chapterIndex must be a non-negative safe integer');
    }
  }

  private assertSameChapter(
    chapter: ReadingImageChapterIdentity,
    resource: ReadingImageCacheIdentity,
  ): void {
    if (resource.sourceId !== chapter.sourceId || resource.bookId !== chapter.bookId ||
      resource.chapterIndex !== chapter.chapterIndex || resource.contentVersion !== chapter.contentVersion) {
      throw new Error('offline reading image resource belongs to a different chapter version');
    }
  }

  private assertNonBlank(value: string, field: string): void {
    if (value.trim().length === 0) {
      throw new Error(`${field} must be non-blank`);
    }
  }
}
