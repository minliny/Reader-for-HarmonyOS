import fileIo from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { readMangaAtomicPayload } from './MangaAtomicPayloadPort';
import { canonicalReadingImageBaseUrl } from '../../common/ReadingImageIdentity';
import { ReadingOfflineMaterializationError } from '../../features/reading/application/ReadingOfflineContract';
import {
  CACHE_FORMAT_VERSION,
  FILE_SYSTEM_NO_SPACE_ERROR,
  LEGACY_CACHE_FORMAT_VERSION,
  MANGA_AUTHORITY_BATCH_SIZE,
  MANGA_CACHE_BUDGET_MAX_BYTES,
  MANGA_DERIVED_BUDGET_RATIO,
  MANGA_FREE_RESERVE_BYTES,
  MANGA_MANIFEST_METADATA_BYTES,
  MANGA_SCRIPT_CACHE_PROFILE,
  MANGA_SYSTEM_RESERVE_FLOOR_BYTES,
  MANGA_SYSTEM_RESERVE_RATIO,
  MAX_READING_IMAGE_BYTES,
  READING_IMAGE_WRITE_CHUNK_BYTES,
  TEXT_CACHE_OWNER,
  type MangaExternalFile,
  type MangaInventoryFile,
  type MangaStorageAuthority,
  type MangaStorageBuckets,
  type MangaStorageCapacity,
  type MangaStorageChapter,
  type MangaStorageClass,
  type MangaStoragePolicy,
  type ReadingImageCacheIdentity,
  type ReadingImageChapterIdentity,
  type ReadingImageChapterManifest,
  type ReadingImageFreeSpaceProbe,
} from './ReadingImageDiskCacheTypes';

export function mangaChapterKey(chapter: MangaStorageChapter): string {
  return JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterId, chapter.contentVersion]);
}

export function mangaChapterOfIdentity(identity: ReadingImageChapterIdentity): MangaStorageChapter | undefined {
  if (identity.mangaDecodeRevision === undefined || identity.chapterId === undefined) return undefined;
  return {
    sourceId: identity.sourceId,
    bookId: identity.bookId,
    chapterId: identity.chapterId,
    contentVersion: identity.contentVersion,
  };
}

export function assertNonBlankValue(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be non-blank`);
  }
}

export function assertMangaStorageChapter(chapter: MangaStorageChapter): void {
  for (const value of [chapter.sourceId, chapter.bookId, chapter.chapterId, chapter.contentVersion]) {
    assertNonBlankValue(value, 'manga storage identity');
  }
}

export function bookMutationKey(sourceId: string, bookId: string): string {
  return JSON.stringify([sourceId, bookId]);
}

export function mangaCacheProfile(revision?: string): string | undefined {
  if (revision === 'bytes-v1') return MANGA_SCRIPT_CACHE_PROFILE;
  if (revision === undefined || revision === 'identity-v1') return undefined;
  throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
}

export function manifestPathForDirectory(directory: string, profile?: string): string {
  return profile === undefined ? `${directory}/manifest.json` : `${directory}/manifest-${profile}.json`;
}

export function hasUnambiguousLegacyResourceIdentity(identity: ReadingImageCacheIdentity): boolean {
  return identity.resourceRef === undefined && identity.imageUrl.indexOf('\u0000') < 0 &&
    (canonicalReadingImageBaseUrl(identity.baseUrl) ?? '').indexOf('\u0000') < 0;
}

export async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = cryptoFramework.createMd('SHA256');
  await digest.update({ data: value });
  const output = await digest.digest();
  const alphabet = '0123456789abcdef';
  let result = '';
  for (const byte of output.data) {
    result += alphabet.charAt((byte >>> 4) & 0x0f);
    result += alphabet.charAt(byte & 0x0f);
  }
  return result;
}

export async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new util.TextEncoder().encodeInto(value));
}

export async function bookHash(sourceId: string, bookId: string): Promise<string> {
  return sha256Text(JSON.stringify([sourceId, bookId]));
}

export async function legacyBookHash(sourceId: string, bookId: string): Promise<string> {
  return sha256Text(`${sourceId}\u0000${bookId}`);
}

export async function resourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
  if (identity.resourceRef !== undefined) {
    const profile = mangaCacheProfile(identity.mangaDecodeRevision);
    return profile === undefined ? legacyMangaResourceHash(identity) :
      sha256Text(JSON.stringify(['manga-resource-v2', profile, identity.contentVersion, identity.resourceRef]));
  }
  const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
  return sha256Text(JSON.stringify([identity.contentVersion, identity.imageUrl, baseUrl ?? '']));
}

export async function legacyMangaResourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
  return sha256Text(JSON.stringify(['manga-resource-v1', identity.contentVersion, identity.resourceRef]));
}

export async function legacyResourceHash(identity: ReadingImageCacheIdentity): Promise<string> {
  const baseUrl = canonicalReadingImageBaseUrl(identity.baseUrl);
  return sha256Text(`${identity.contentVersion}\u0000${identity.imageUrl}\u0000${baseUrl ?? ''}`);
}

export function isNotFoundError(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 13900002 || code === 'ENOENT';
}

export async function ensureDirectory(path: string): Promise<void> {
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

export async function statIfPresent(path: string): Promise<fileIo.Stat | undefined> {
  try { return await fileIo.stat(path); }
  catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

export async function listFileIfPresent(path: string): Promise<string[]> {
  try { return await fileIo.listFile(path); }
  catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }
}

export async function removeEmptyDirectory(directory: string): Promise<void> {
  try {
    if ((await fileIo.listFile(directory)).length === 0) await fileIo.rmdir(directory);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
}

export async function validResourceFile(path: string): Promise<boolean> {
  if (!(await fileIo.access(path))) return false;
  const stat = await fileIo.stat(path);
  return !stat.isDirectory() && Number.isSafeInteger(stat.size) && stat.size > 0 && stat.size <= MAX_READING_IMAGE_BYTES;
}

export function sameChapterIdentity(left: ReadingImageChapterIdentity, right: ReadingImageChapterIdentity): boolean {
  return left.sourceId === right.sourceId && left.bookId === right.bookId &&
    (left.chapterId !== undefined && right.chapterId !== undefined ? left.chapterId === right.chapterId : left.chapterIndex === right.chapterIndex) &&
    left.contentVersion === right.contentVersion;
}

export function assertOperationCurrent(isCurrent?: () => boolean): void {
  if (isCurrent !== undefined && !isCurrent()) throw new Error('offline reading image operation was superseded');
}

export function assertChapterIdentity(identity: ReadingImageChapterIdentity): void {
  assertNonBlankValue(identity.sourceId, 'sourceId');
  assertNonBlankValue(identity.bookId, 'bookId');
  assertNonBlankValue(identity.contentVersion, 'contentVersion');
  if (identity.chapterId !== undefined) assertNonBlankValue(identity.chapterId, 'chapterId');
  mangaCacheProfile(identity.mangaDecodeRevision);
  if (!Number.isSafeInteger(identity.chapterIndex) || identity.chapterIndex < 0) {
    throw new Error('chapterIndex must be a non-negative safe integer');
  }
}

export function assertResourceIdentity(identity: ReadingImageCacheIdentity): void {
  assertChapterIdentity(identity);
  if (identity.resourceRef !== undefined && identity.mangaDecodeRevision === undefined) throw new Error('MANGA_CACHE_PROFILE_REQUIRED');
  mangaCacheProfile(identity.mangaDecodeRevision);
  assertNonBlankValue(identity.imageUrl, 'imageUrl');
  if (identity.resourceRef !== undefined && !/^manga:mp1:[0-9a-f]{64}$/.test(identity.resourceRef)) {
    throw new Error('invalid manga resourceRef');
  }
}

export function assertSameChapterIdentity(chapter: ReadingImageChapterIdentity, resource: ReadingImageCacheIdentity): void {
  if (!sameChapterIdentity(resource, chapter)) {
    throw new Error('offline reading image resource belongs to a different chapter version');
  }
}

export function isTextOwnershipManifest(value: ReadingImageChapterManifest): boolean {
  return value.manga !== true && value.chapterId === undefined && value.mangaCacheProfile === undefined &&
    (value.cacheOwner === undefined || value.cacheOwner === TEXT_CACHE_OWNER) && Array.isArray(value.resourceHashes) &&
    value.resourceHashes.every((hash: string): boolean => typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash));
}

export async function readResourceFingerprint(path: string): Promise<string | undefined> {
  const stat = await fileIo.stat(path);
  if (!stat.isFile() || typeof stat.mtimeNs !== 'bigint' || typeof stat.ctimeNs !== 'bigint') return undefined;
  return `${stat.ino.toString()}:${stat.size}:${stat.mtimeNs.toString()}:${stat.ctimeNs.toString()}`;
}

export async function readMangaMetadataBytes(path: string, maximumBytes: number, isCurrent: () => boolean): Promise<Uint8Array> {
  assertOperationCurrent(isCurrent);
  const stat = await fileIo.stat(path);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maximumBytes) throw new Error('MANGA_ATOMIC_PAYLOAD_BUDGET');
  const bytes = await readMangaAtomicPayload(path, stat.size, maximumBytes, isCurrent, true);
  assertOperationCurrent(isCurrent);
  return bytes;
}

export async function readTextAtomicMetadataBytes(path: string, isCurrent: () => boolean): Promise<Uint8Array | undefined> {
  assertOperationCurrent(isCurrent);
  const stat = await fileIo.stat(path);
  if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0) return undefined;
  const bytes = await readMangaAtomicPayload(path, stat.size, stat.size, isCurrent, 'text-manifest');
  assertOperationCurrent(isCurrent);
  return bytes;
}

export async function readTextManifestIdentity(
  directory: string,
  formatVersion: number,
  isCurrent: () => boolean,
  fileName: string = 'manifest.json',
  retryIoErrors: boolean = false,
): Promise<ReadingImageChapterManifest | undefined> {
  const path = `${directory}/${fileName}`;
  if (!(await fileIo.access(path))) return undefined;
  let bytes: Uint8Array | undefined;
  try {
    bytes = await readTextAtomicMetadataBytes(path, isCurrent);
  } catch (error) {
    if (retryIoErrors && !isNotFoundError(error)) throw error;
    return undefined;
  }
  if (bytes === undefined) return undefined;
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

export async function readDiskManifestIdentity(
  directory: string,
  formatVersion: number,
  isCurrent: () => boolean,
  profile?: string,
  manga: boolean = false,
): Promise<ReadingImageChapterManifest | undefined> {
  const path = manifestPathForDirectory(directory, profile);
  if (!(await fileIo.access(path))) return undefined;
  try {
    const bytes = manga || directory.includes('/.manga/') || profile !== undefined ?
      await readMangaMetadataBytes(path, MANGA_MANIFEST_METADATA_BYTES, isCurrent) :
      await readTextAtomicMetadataBytes(path, isCurrent);
    if (bytes === undefined) return undefined;
    const raw = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
    const value = JSON.parse(raw) as ReadingImageChapterManifest;
    if (value.mangaCacheProfile !== profile || value.formatVersion !== formatVersion || typeof value.sourceId !== 'string' ||
      typeof value.bookId !== 'string' || !Number.isSafeInteger(value.chapterIndex) || value.chapterIndex < 0 ||
      typeof value.contentVersion !== 'string' || value.contentVersion.trim().length === 0) return undefined;
    return value;
  } catch (_) {
    return undefined;
  }
}

export async function containsMangaManifest(directory: string, isCurrent: () => boolean): Promise<boolean> {
  for (const name of await listFileIfPresent(directory)) {
    const path = `${directory}/${name}`;
    if (name === '.manga' || name === 'manga-identity.json' || name === 'manifest-script-bgra-v2.json') return true;
    const stat = await statIfPresent(path);
    if (stat === undefined) continue;
    if (stat.isDirectory()) {
      if (await containsMangaManifest(path, isCurrent)) return true;
    } else if (name === 'manifest.json') {
      const value = await readTextManifestIdentity(directory, CACHE_FORMAT_VERSION, isCurrent, name, true) ??
        await readTextManifestIdentity(directory, LEGACY_CACHE_FORMAT_VERSION, isCurrent, name, true);
      if (value?.manga === true || value?.chapterId !== undefined || value?.mangaCacheProfile !== undefined) return true;
    }
  }
  return false;
}

export async function readRawResourceBytes(path: string, isCurrent: () => boolean): Promise<Uint8Array | undefined> {
  assertOperationCurrent(isCurrent);
  if (!(await fileIo.access(path))) return undefined;
  const stat = await fileIo.stat(path);
  if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > MAX_READING_IMAGE_BYTES) return undefined;
  const bytes = await readMangaAtomicPayload(path, stat.size, MAX_READING_IMAGE_BYTES, isCurrent);
  assertOperationCurrent(isCurrent);
  return bytes;
}

export async function computeMangaStorageCapacity(
  probe: ReadingImageFreeSpaceProbe,
  path: string,
  configuredCacheLimitBytes: number | undefined,
): Promise<MangaStorageCapacity> {
  const freeBytes = await probe.getFreeBytes(path);
  const totalBytes = probe.getTotalBytes === undefined ? undefined : await probe.getTotalBytes(path);
  if (!Number.isSafeInteger(freeBytes) || freeBytes < 0 ||
    (totalBytes !== undefined && (!Number.isSafeInteger(totalBytes) || totalBytes < 0))) {
    throw new Error('MANGA_CACHE_STORAGE_CAPACITY_INVALID');
  }
  if (totalBytes === undefined) {
    return {
      freeBytes, totalBytes: undefined, systemReserveBytes: MANGA_FREE_RESERVE_BYTES,
      cacheBudgetBytes: configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
      originalBudgetBytes: configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
      derivedBudgetBytes: configuredCacheLimitBytes ?? MANGA_CACHE_BUDGET_MAX_BYTES,
    };
  }
  const systemReserveBytes = Math.min(
    MANGA_FREE_RESERVE_BYTES,
    Math.max(MANGA_SYSTEM_RESERVE_FLOOR_BYTES, Math.floor(totalBytes * MANGA_SYSTEM_RESERVE_RATIO)),
  );
  const volumeBudgetBytes = Math.min(MANGA_CACHE_BUDGET_MAX_BYTES, Math.max(0, totalBytes - systemReserveBytes));
  const cacheBudgetBytes = Math.min(volumeBudgetBytes, configuredCacheLimitBytes ?? volumeBudgetBytes);
  const derivedBudgetBytes = Math.floor(cacheBudgetBytes * MANGA_DERIVED_BUDGET_RATIO);
  return {
    freeBytes, totalBytes, systemReserveBytes, cacheBudgetBytes,
    derivedBudgetBytes, originalBudgetBytes: cacheBudgetBytes - derivedBudgetBytes,
  };
}

export async function fetchAuthorityClassSnapshot(
  authority: MangaStorageAuthority | undefined,
  chapters: MangaStorageChapter[],
): Promise<Map<string, MangaStorageClass>> {
  const result = new Map<string, MangaStorageClass>();
  if (authority === undefined || chapters.length === 0) return result;
  const batchSize = 32;
  const batches: MangaStorageChapter[][] = [];
  for (let start = 0; start < chapters.length; start += batchSize) {
    batches.push(chapters.slice(start, Math.min(chapters.length, start + batchSize)));
  }
  const values = new Array<MangaStorageClass>(chapters.length);
  let nextBatch = 0;
  const worker = async (): Promise<void> => {
    while (nextBatch < batches.length) {
      const batchIndex = nextBatch++;
      const batch = batches[batchIndex];
      const batchValues = authority.classifyBatch === undefined ?
        await Promise.all(batch.map((chapter): Promise<MangaStorageClass> => authority.classify(chapter))) :
        await authority.classifyBatch(batch);
      if (batchValues.length !== batch.length) throw new Error('MANGA_STORAGE_CLASS_SNAPSHOT_INVALID');
      batchValues.forEach((value, offset): void => { values[batchIndex * batchSize + offset] = value; });
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, batches.length) }, (): Promise<void> => worker()));
  chapters.forEach((chapter, index): void => {
    const value = values[index];
    if (value === undefined) throw new Error('MANGA_STORAGE_CLASS_SNAPSHOT_INVALID');
    result.set(mangaChapterKey(chapter), value);
  });
  return result;
}

export async function fetchAuthorityClassBatch(
  authority: MangaStorageAuthority | undefined,
  chapters: MangaStorageChapter[],
): Promise<MangaStorageClass[] | undefined> {
  if (authority?.classifyBatch === undefined || chapters.length === 0) return undefined;
  const values: MangaStorageClass[] = [];
  for (let start = 0; start < chapters.length; start += MANGA_AUTHORITY_BATCH_SIZE) {
    const batch = chapters.slice(start, Math.min(chapters.length, start + MANGA_AUTHORITY_BATCH_SIZE));
    const batchValues = await authority.classifyBatch(batch);
    if (batchValues.length !== batch.length) throw new Error('MANGA_CACHE_CLASSIFY_BATCH_INVALID');
    values.push(...batchValues);
  }
  return values;
}

export async function fetchAuthorityPolicyBatch(
  authority: MangaStorageAuthority | undefined,
  chapters: MangaStorageChapter[],
): Promise<MangaStoragePolicy[] | undefined> {
  if (authority?.policyBatch === undefined || chapters.length === 0) return undefined;
  const values: MangaStoragePolicy[] = [];
  for (let start = 0; start < chapters.length; start += MANGA_AUTHORITY_BATCH_SIZE) {
    const batch = chapters.slice(start, Math.min(chapters.length, start + MANGA_AUTHORITY_BATCH_SIZE));
    const batchValues = await authority.policyBatch(batch);
    if (batchValues.length !== batch.length) throw new Error('MANGA_CACHE_POLICY_BATCH_INVALID');
    values.push(...batchValues);
  }
  return values;
}

export async function computeMangaStorageBuckets(
  authority: MangaStorageAuthority | undefined,
  files: MangaInventoryFile[],
): Promise<MangaStorageBuckets> {
  const physical = new Map<string, { size: number; kind: 'original' | 'derived' | 'download'; }>();
  const classes = new Map<string, MangaStorageClass>();
  const originalOwners = new Map<string, MangaStorageChapter>();
  for (const file of files) if (!file.external) for (const owner of file.owners)
    originalOwners.set(mangaChapterKey(owner), owner);
  const snapshot = await fetchAuthorityClassSnapshot(authority, Array.from(originalOwners.values()));
  for (const file of files) {
    let kind: 'original' | 'derived' | 'download' = file.external ? 'derived' : 'original';
    if (!file.external) {
      for (const owner of file.owners) {
        const key = mangaChapterKey(owner);
        let classification = classes.get(key);
        if (classification === undefined) {
          classification = snapshot.get(key) ?? 'unknown'; classes.set(key, classification);
        }
        if (classification === 'download') kind = 'download';
      }
    }
    const existing = physical.get(file.physicalKey);
    if (existing !== undefined) {
      if (existing.kind === 'download' || kind === 'download') kind = 'download';
      else if (existing.kind === 'original' || kind === 'original') kind = 'original';
    }
    physical.set(file.physicalKey, { size: Math.max(file.size, existing?.size ?? 0), kind });
  }
  let originalBytes = 0, derivedBytes = 0, downloadBytes = 0;
  for (const item of physical.values()) {
    if (item.kind === 'download') downloadBytes += item.size;
    else if (item.kind === 'derived') derivedBytes += item.size;
    else originalBytes += item.size;
  }
  return { originalBytes, derivedBytes, downloadBytes, ordinaryBytes: originalBytes + derivedBytes };
}

export function mangaDerivedDeletionFilesForChapter(
  chapter: MangaStorageChapter,
  files: MangaInventoryFile[],
  hasInFlightWrite: (path: string) => boolean,
): MangaExternalFile[] | undefined {
  const key = mangaChapterKey(chapter);
  const matching = files.filter(file => file.external && file.owners.some(owner => mangaChapterKey(owner) === key));
  if (matching.length === 0) return undefined;
  const unsafe = new Set(files.filter(alias => !alias.external || alias.live ||
    alias.owners.length === 0 || alias.owners.some(owner => mangaChapterKey(owner) !== key)).map(alias => alias.physicalKey));
  for (const file of matching) {
    if (file.live || hasInFlightWrite(file.path) || file.owners.some(owner => mangaChapterKey(owner) !== key)) return undefined;
    if (unsafe.has(file.physicalKey)) return undefined;
  }
  return matching;
}

export async function performAtomicFileWrite(
  path: string,
  tmpPath: string,
  bytes: Uint8Array,
  isCurrent?: () => boolean,
): Promise<void> {
  try {
    assertOperationCurrent(isCurrent);
    const file = await fileIo.open(
      tmpPath,
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
    );
    let written = false;
    try {
      let writtenBytes = 0;
      while (writtenBytes < bytes.byteLength) {
        assertOperationCurrent(isCurrent);
        const chunk = bytes.slice(writtenBytes, Math.min(bytes.byteLength, writtenBytes + READING_IMAGE_WRITE_CHUNK_BYTES));
        const wrote = await fileIo.write(file.fd, chunk.buffer);
        if (!Number.isSafeInteger(wrote) || wrote <= 0 || wrote > chunk.byteLength) {
          throw new Error('offline reading image destination stopped accepting bytes');
        }
        writtenBytes += wrote;
      }
      await fileIo.fsync(file.fd);
      written = true;
    } finally {
      try { await fileIo.close(file); }
      catch (error) { if (written) throw error; }
    }
    assertOperationCurrent(isCurrent);
    await fileIo.rename(tmpPath, path);
  } catch (error) {
    try {
      await fileIo.unlink(tmpPath);
    } catch (_) {
    }
    if ((error as BusinessError).code === FILE_SYSTEM_NO_SPACE_ERROR) {
      throw new ReadingOfflineMaterializationError(
        'storage_full',
        'MANGA_CACHE_STORAGE_FULL',
      );
    }
    throw error;
  }
}
