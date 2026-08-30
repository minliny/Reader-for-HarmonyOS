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

const CACHE_FORMAT_VERSION = 1;
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

  async loadResource(identity: ReadingImageCacheIdentity): Promise<Uint8Array | undefined> {
    this.assertResourceIdentity(identity);
    const path = await this.resourcePath(identity);
    if (!(await fileIo.access(path))) {
      return undefined;
    }
    const stat = await fileIo.stat(path);
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > MAX_READING_IMAGE_BYTES) {
      await this.unlinkIfPresent(path);
      return undefined;
    }
    const buffer = new fileIo.AtomicFile(path).readFully();
    if (buffer.byteLength !== stat.size) {
      throw new Error('offline reading image changed while being read');
    }
    return new Uint8Array(buffer);
  }

  async storeResource(identity: ReadingImageCacheIdentity, bytes: Uint8Array): Promise<void> {
    this.assertResourceIdentity(identity);
    if (bytes.length === 0 || bytes.length > MAX_READING_IMAGE_BYTES) {
      throw new Error(`offline reading image must contain 1..${MAX_READING_IMAGE_BYTES} bytes`);
    }
    const chapterDirectory = await this.chapterDirectory(identity);
    await this.ensureDirectory(chapterDirectory);
    await this.assertWriteCapacity(chapterDirectory, bytes.byteLength);
    await this.writeAtomicBytes(await this.resourcePath(identity), bytes);
  }

  async removeResource(identity: ReadingImageCacheIdentity): Promise<void> {
    this.assertResourceIdentity(identity);
    await this.unlinkIfPresent(await this.resourcePath(identity));
  }

  async markChapterComplete(
    chapter: ReadingImageChapterIdentity,
    resources: ReadingImageCacheIdentity[],
  ): Promise<void> {
    this.assertChapterIdentity(chapter);
    const resourceHashes: string[] = [];
    for (const resource of resources) {
      this.assertSameChapter(chapter, resource);
      const hash = await this.resourceHash(resource);
      if (!(await fileIo.access(`${await this.chapterDirectory(chapter)}/${hash}.bin`))) {
        throw new Error('offline reading image manifest cannot reference missing bytes');
      }
      resourceHashes.push(hash);
    }
    resourceHashes.sort();
    const manifest: ReadingImageChapterManifest = {
      formatVersion: CACHE_FORMAT_VERSION,
      sourceId: chapter.sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      contentVersion: chapter.contentVersion,
      resourceHashes,
      completedAt: Date.now(),
    };
    const directory = await this.chapterDirectory(chapter);
    await this.ensureDirectory(directory);
    const manifestText = JSON.stringify(manifest);
    const manifestBytes = new util.TextEncoder().encodeInto(manifestText);
    await this.assertWriteCapacity(directory, manifestBytes.byteLength);
    await this.writeAtomicBytes(`${directory}/manifest.json`, manifestBytes);
    try {
      await this.pruneUnreferencedResources(directory, resourceHashes);
    } catch (_) {
      // The atomic manifest is already authoritative. Stale unreachable bytes
      // may be reclaimed by the next successful prefetch or exact book clear.
    }
  }

  async isChapterComplete(chapter: ReadingImageChapterIdentity): Promise<boolean> {
    this.assertChapterIdentity(chapter);
    const directory = await this.chapterDirectory(chapter);
    const value = await this.readValidManifest(directory);
    return value !== undefined && value.sourceId === chapter.sourceId && value.bookId === chapter.bookId &&
      value.chapterIndex === chapter.chapterIndex && value.contentVersion === chapter.contentVersion;
  }

  /** Lightweight directory projection; exact version is rechecked on use. */
  async isChapterMaterialized(sourceId: string, bookId: string, chapterIndex: number): Promise<boolean> {
    this.assertNonBlank(sourceId, 'sourceId');
    this.assertNonBlank(bookId, 'bookId');
    if (!Number.isSafeInteger(chapterIndex) || chapterIndex < 0) {
      throw new Error('chapterIndex must be a non-negative safe integer');
    }
    const directory = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}/${chapterIndex}`;
    const value = await this.readValidManifest(directory);
    return value !== undefined && value.sourceId === sourceId && value.bookId === bookId &&
      value.chapterIndex === chapterIndex;
  }

  private async readValidManifest(directory: string): Promise<ReadingImageChapterManifest | undefined> {
    const manifestPath = `${directory}/manifest.json`;
    if (!(await fileIo.access(manifestPath))) {
      return undefined;
    }
    try {
      const raw = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(
        new Uint8Array(new fileIo.AtomicFile(manifestPath).readFully()),
      );
      const value = JSON.parse(raw) as ReadingImageChapterManifest;
      if (value.formatVersion !== CACHE_FORMAT_VERSION || typeof value.sourceId !== 'string' ||
        typeof value.bookId !== 'string' || !Number.isSafeInteger(value.chapterIndex) ||
        typeof value.contentVersion !== 'string' || !Array.isArray(value.resourceHashes)) {
        return undefined;
      }
      for (const hash of value.resourceHashes) {
        if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
          !(await fileIo.access(`${directory}/${hash}.bin`))) {
          return undefined;
        }
      }
      return value;
    } catch (_) {
      return undefined;
    }
  }

  async clearBook(sourceId: string, bookId: string): Promise<void> {
    this.assertNonBlank(sourceId, 'sourceId');
    this.assertNonBlank(bookId, 'bookId');
    const path = `${this.rootDirectory()}/${await this.bookHash(sourceId, bookId)}`;
    await this.removeTree(path);
  }

  private async chapterDirectory(identity: ReadingImageChapterIdentity): Promise<string> {
    return `${this.rootDirectory()}/${await this.bookHash(identity.sourceId, identity.bookId)}/` +
      `${identity.chapterIndex}`;
  }

  private async resourcePath(identity: ReadingImageCacheIdentity): Promise<string> {
    return `${await this.chapterDirectory(identity)}/${await this.resourceHash(identity)}.bin`;
  }

  private async bookHash(sourceId: string, bookId: string): Promise<string> {
    return this.sha256(`${sourceId}\u0000${bookId}`);
  }

  private async resourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
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
    return `${this.context.filesDir}/reader-offline/images-v1`;
  }

  private async writeAtomicBytes(path: string, bytes: Uint8Array): Promise<void> {
    const existing = this.inFlightWrites.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const operation = this.enqueueWrite(async (): Promise<void> => {
      await this.performAtomicWrite(path, bytes);
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

  private async performAtomicWrite(path: string, bytes: Uint8Array): Promise<void> {
    this.nextTemporaryFile += 1;
    const tmpPath = `${path}.tmp-${this.nextTemporaryFile}`;
    try {
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

  private async removeTree(path: string): Promise<void> {
    if (!(await fileIo.access(path))) {
      return;
    }
    const names = await fileIo.listFile(path);
    for (const name of names) {
      const child = `${path}/${name}`;
      const stat = await fileIo.stat(child);
      if (stat.isDirectory()) {
        await this.removeTree(child);
      } else {
        await fileIo.unlink(child);
      }
    }
    await fileIo.rmdir(path);
  }

  private async pruneUnreferencedResources(directory: string, resourceHashes: string[]): Promise<void> {
    const names = await fileIo.listFile(directory);
    for (const name of names) {
      if (!name.endsWith('.bin')) {
        continue;
      }
      const hash = name.substring(0, name.length - 4);
      if (resourceHashes.indexOf(hash) < 0) {
        await fileIo.unlink(`${directory}/${name}`);
      }
    }
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
