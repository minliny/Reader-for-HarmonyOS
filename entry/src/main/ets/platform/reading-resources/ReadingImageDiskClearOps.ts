import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import {
  CACHE_FORMAT_VERSION,
  LEGACY_CACHE_FORMAT_VERSION,
  TEXT_CACHE_OWNER,
  type ReadingImageCleanupFile,
} from './ReadingImageDiskCacheTypes';
import {
  bookHash,
  containsMangaManifest,
  isNotFoundError,
  isTextOwnershipManifest,
  legacyBookHash,
  listFileIfPresent,
  readTextManifestIdentity,
  removeEmptyDirectory,
  sha256Text,
  statIfPresent,
} from './ReadingImageDiskFsOps';

export interface ReadingImageClearOpsContext {
  rootDirectory(): string;
  legacyRootDirectory(): string;
  isOpen(): boolean;
  mangaPhysicalKey(stat: fileIo.Stat): string;
  removeVerifiedDigest(path: string): void;
  verifiedDigestKeys(): string[];
  writeAtomicBytes(path: string, bytes: Uint8Array, isCurrent?: () => boolean): Promise<void>;
  unlinkIfPresent(path: string): Promise<void>;
}

/** Settings already durably recorded the exact Core ACK and captured files.
 * Reopening the app must not clear a newer publication at the same ordinal. */
export async function clearCapturedTextFilesOps(
  ctx: ReadingImageClearOpsContext,
  sourceId: string,
  bookId: string,
  chapterIndex: number,
  captured: ReadingImageCleanupFile[],
  current?: () => boolean,
): Promise<void> {
  const currentRoot = `${ctx.rootDirectory()}/${await bookHash(sourceId, bookId)}/${chapterIndex}/`;
  const legacy = `${ctx.legacyRootDirectory()}/${await legacyBookHash(sourceId, bookId)}/${chapterIndex}/`;
  const currentFile = /^[0-9a-f]{64}\/(?:manifest\.json|text-identity\.json|[0-9a-f]{64}\.bin)$/;
  const legacyFile = /^(?:manifest\.json|[0-9a-f]{64}\.bin)$/;
  for (const file of captured) {
    if (!(file.path.startsWith(currentRoot) && currentFile.test(file.path.substring(currentRoot.length))) &&
      !(file.path.startsWith(legacy) && legacyFile.test(file.path.substring(legacy.length)))) {
      throw new Error('TEXT_CACHE_CLEANUP_FILE_IDENTITY_INVALID');
    }
  }
  const ordered = [...captured].sort((a, b) => Number(a.path.endsWith('.json')) - Number(b.path.endsWith('.json')));
  for (const file of ordered) {
    const stat = await statIfPresent(file.path);
    if (stat === undefined || !stat.isFile() || ctx.mangaPhysicalKey(stat) !== file.physicalKey ||
      stat.size !== file.size || typeof stat.mtimeNs !== 'bigint' || stat.mtimeNs.toString() !== file.mtime) continue;
    if (current?.() === false) throw new Error('TEXT_CACHE_CLEANUP_PROTECTION_CHANGED');
    ctx.removeVerifiedDigest(file.path);
    try { await fileIo.unlink(file.path); }
    catch (error) { if (!isNotFoundError(error)) throw error; }
  }
}

export async function clearOwnedTextDirectoryOps(
  ctx: ReadingImageClearOpsContext,
  directory: string,
  formatVersion: number,
  sourceId: string,
  bookId: string,
  ordinal: string,
  version?: string,
): Promise<void> {
  if (await containsMangaManifest(directory, (): boolean => ctx.isOpen())) return;
  const files = formatVersion === CACHE_FORMAT_VERSION ? ['manifest.json', 'text-identity.json'] : ['manifest.json'];
  const ownedFiles: string[] = [];
  const hashes: Set<string> = new Set<string>();
  for (const fileName of files) {
    const value = await readTextManifestIdentity(directory, formatVersion, (): boolean => ctx.isOpen(), fileName, true);
    if (value === undefined || !isTextOwnershipManifest(value) || value.sourceId !== sourceId || value.bookId !== bookId ||
      `${value.chapterIndex}` !== ordinal || (version !== undefined && await sha256Text(value.contentVersion) !== version) ||
      (fileName === 'text-identity.json' && value.cacheOwner !== TEXT_CACHE_OWNER)) continue;
    ownedFiles.push(fileName);
    for (const hash of value.resourceHashes) hashes.add(hash);
  }
  if (ownedFiles.length === 0) return;
  for (const hash of hashes) {
    const path = `${directory}/${hash}.bin`;
    if ((await statIfPresent(path))?.isFile() === true) await ctx.unlinkIfPresent(path);
  }
  for (const fileName of ownedFiles) await ctx.unlinkIfPresent(`${directory}/${fileName}`);
  await removeEmptyDirectory(directory);
}

export async function finishPendingChapterClearsOps(
  ctx: ReadingImageClearOpsContext,
  sourceId: string,
  bookId: string,
): Promise<void> {
  const clearRoot = `${ctx.rootDirectory()}/.clear`;
  const entries = await listFileIfPresent(clearRoot);
  if (entries.length === 0) return;
  const prefix = `${await bookHash(sourceId, bookId)}.pending.chapter-`;
  for (const name of entries) {
    if (!name.startsWith(prefix) || !/^(0|[1-9][0-9]*)$/.test(name.substring(prefix.length))) continue;
    const ordinal = name.substring(prefix.length);
    const chapter = `${ctx.rootDirectory()}/${await bookHash(sourceId, bookId)}/${ordinal}`;
    if ((await statIfPresent(chapter))?.isDirectory() === true) {
      for (const version of await listFileIfPresent(chapter)) {
        if (!/^[0-9a-f]{64}$/.test(version)) continue;
        const directory = `${chapter}/${version}`;
        if ((await statIfPresent(directory))?.isDirectory() !== true) continue;
        for (const proof of ctx.verifiedDigestKeys()) {
          if (proof.startsWith(`${directory}/`)) ctx.removeVerifiedDigest(proof);
        }
        await clearOwnedTextDirectoryOps(ctx, directory, CACHE_FORMAT_VERSION, sourceId, bookId, ordinal, version);
      }
      await removeEmptyDirectory(chapter);
    }
    const legacy = `${ctx.legacyRootDirectory()}/${await legacyBookHash(sourceId, bookId)}/${ordinal}`;
    if ((await statIfPresent(legacy))?.isDirectory() === true) {
      await clearOwnedTextDirectoryOps(ctx, legacy, LEGACY_CACHE_FORMAT_VERSION, sourceId, bookId, ordinal);
    }
    await ctx.unlinkIfPresent(`${clearRoot}/${name}`);
  }
}

export async function finishPendingClearOps(
  ctx: ReadingImageClearOpsContext,
  sourceId: string,
  bookId: string,
): Promise<void> {
  await finishPendingChapterClearsOps(ctx, sourceId, bookId);
  const marker = `${ctx.rootDirectory()}/.clear/${await bookHash(sourceId, bookId)}.pending`;
  if (!(await fileIo.access(marker))) return;
  const book = `${ctx.rootDirectory()}/${await bookHash(sourceId, bookId)}`;
  if ((await statIfPresent(book))?.isDirectory() === true) {
    for (const ordinal of await listFileIfPresent(book)) {
      if (!/^(0|[1-9][0-9]*)$/.test(ordinal)) continue;
      const chapter = `${book}/${ordinal}`;
      if ((await statIfPresent(chapter))?.isDirectory() !== true) continue;
      for (const version of await listFileIfPresent(chapter)) {
        if (!/^[0-9a-f]{64}$/.test(version)) continue;
        const directory = `${chapter}/${version}`;
        if ((await statIfPresent(directory))?.isDirectory() !== true) continue;
        await clearOwnedTextDirectoryOps(ctx, directory, CACHE_FORMAT_VERSION, sourceId, bookId, ordinal, version);
      }
      await removeEmptyDirectory(chapter);
    }
    await removeEmptyDirectory(book);
  }
  const legacyBook = `${ctx.legacyRootDirectory()}/${await legacyBookHash(sourceId, bookId)}`;
  if ((await statIfPresent(legacyBook))?.isDirectory() === true) {
    for (const name of await listFileIfPresent(legacyBook)) {
      if (!/^(0|[1-9][0-9]*)$/.test(name)) continue;
      const directory = `${legacyBook}/${name}`;
      if ((await statIfPresent(directory))?.isDirectory() === true) {
        await clearOwnedTextDirectoryOps(ctx, directory, LEGACY_CACHE_FORMAT_VERSION, sourceId, bookId, name);
      }
    }
    await removeEmptyDirectory(legacyBook);
  }
  await ctx.writeAtomicBytes(`${marker}.legacy-revoked`, new util.TextEncoder().encodeInto('cleared'));
  await ctx.unlinkIfPresent(marker);
}
