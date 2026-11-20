import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import { readerLibrarySyncHash, READER_LIBRARY_SYNC_MAX_BYTES } from './ReaderLibrarySyncJournal';

export interface ReaderLibraryLogObject {
  objectId: string;
  channelHash: string;
  operationId: string;
  sha256: string;
  contentBytes?: number;
}
export function readerLibraryLogObject(objectId: string): ReaderLibraryLogObject | undefined {
  const match = /^reader-sync-log-v2-([0-9a-f]{64})-([0-9a-f]{32})-([0-9a-f]{64})\.reader$/.exec(objectId);
  return match === null ? undefined : { objectId, channelHash: match[1], operationId: `library-sync-${match[2]}`, sha256: match[3] };
}
export type ReaderLibraryLogSyncPhase = 'collecting' | 'review' | 'prepared' | 'mayPublish' | 'published' | 'committing' | 'cleanup' | 'needsRebase' | 'rebasing';
export interface ReaderLibraryLogSyncIntent {
  version: 2;
  operationId: string;
  configOperationId: string;
  configPayloadHash: string;
  directory: string;
  phase: ReaderLibraryLogSyncPhase;
  channelId?: string;
  channelHash?: string;
  planToken?: string;
  localBasis?: string;
  objectIds: string[];
  objectId?: string;
  publishSha256?: string;
  publishBytes?: number;
  retireObjects: string[];
  cleanupRemaining: string[];
  cleanupAuthorized: boolean;
  rebaseFromToken?: string;
  rebaseObjectIds?: string[];
}

/** A single original operation, ciphertext and exact cleanup responsibility.
 * It is independent of the v1 CAS journal, so old in-flight writes cannot be
 * reinterpreted as log publications. No credentials or password are saved. */
export class ReaderLibraryLogSyncJournal {
  private static tails: Map<string, Promise<void>> = new Map();
  private static uncertain: Map<string, ReaderLibraryLogSyncIntent> = new Map();
  private readonly path: string;
  constructor(private readonly parent: string) { this.path = `${parent}/reader-library-sync-log-v2.json`; }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const previous = ReaderLibraryLogSyncJournal.tails.get(this.path) ?? Promise.resolve();
    const next = previous.then(run);
    ReaderLibraryLogSyncJournal.tails.set(this.path, next.then((): void => {}, (): void => {}));
    return next;
  }
  private keys(values: string[], channelHash?: string): void {
    if (!Array.isArray(values) || values.length > 4096 || new Set(values).size !== values.length)
      throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    for (const value of values) {
      const parsed = typeof value === 'string' ? readerLibraryLogObject(value) : undefined;
      if (parsed === undefined || channelHash !== undefined && parsed.channelHash !== channelHash)
        throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    }
  }
  private validate(value: ReaderLibraryLogSyncIntent): ReaderLibraryLogSyncIntent {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || value.version !== 2 ||
      !/^library-sync-[0-9a-f]{32}$/.test(value.operationId) || typeof value.configOperationId !== 'string' ||
      value.configOperationId.length < 1 || value.configOperationId.length > 128 ||
      !/^[0-9a-f]{64}$/.test(value.configPayloadHash) || typeof value.directory !== 'string' ||
      value.directory.length < 1 || value.directory.length > 8192 || /[\u0000-\u001f\u007f]/.test(value.directory) ||
      !['collecting', 'review', 'prepared', 'mayPublish', 'published', 'committing', 'cleanup', 'needsRebase', 'rebasing'].includes(value.phase) ||
      typeof value.cleanupAuthorized !== 'boolean' ||
      value.channelId !== undefined && (typeof value.channelId !== 'string' || value.channelId.length < 1 || value.channelId.length > 128) ||
      value.channelHash !== undefined && !/^[0-9a-f]{64}$/.test(value.channelHash) ||
      value.planToken !== undefined && (typeof value.planToken !== 'string' || value.planToken.length < 1 || value.planToken.length > 256) ||
      value.localBasis !== undefined && (typeof value.localBasis !== 'string' || value.localBasis.length < 1 || value.localBasis.length > 256) ||
      value.phase !== 'collecting' && (value.planToken === undefined || value.localBasis === undefined))
      throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    this.keys(value.objectIds, value.channelHash); this.keys(value.retireObjects, value.channelHash); this.keys(value.cleanupRemaining, value.channelHash);
    if (value.phase === 'rebasing') {
      if (typeof value.rebaseFromToken !== 'string' || value.rebaseFromToken.length < 1 || value.rebaseFromToken.length > 256 ||
        value.rebaseObjectIds === undefined || value.channelId === undefined || value.channelHash === undefined)
        throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
      this.keys(value.rebaseObjectIds, value.channelHash);
    } else if (value.rebaseFromToken !== undefined || value.rebaseObjectIds !== undefined) throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    if (value.cleanupRemaining.some((key: string): boolean => !value.retireObjects.includes(key))) throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    if (value.objectId !== undefined) {
      const object = readerLibraryLogObject(value.objectId);
      if (object === undefined || object.operationId !== value.operationId || object.channelHash !== value.channelHash ||
        object.sha256 !== value.publishSha256 || value.retireObjects.includes(value.objectId)) throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    }
    if (value.publishSha256 !== undefined && !/^[0-9a-f]{64}$/.test(value.publishSha256) ||
      value.publishBytes !== undefined && (!Number.isSafeInteger(value.publishBytes) || value.publishBytes < 1 || value.publishBytes > READER_LIBRARY_SYNC_MAX_BYTES) ||
      (value.publishSha256 === undefined) !== (value.publishBytes === undefined) ||
      ['prepared', 'mayPublish', 'published', 'committing', 'cleanup'].includes(value.phase) &&
        (value.objectId === undefined || value.publishSha256 === undefined || !value.cleanupAuthorized))
      throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
    return { ...value, objectIds: [...value.objectIds], retireObjects: [...value.retireObjects], cleanupRemaining: [...value.cleanupRemaining],
      rebaseObjectIds: value.rebaseObjectIds === undefined ? undefined : [...value.rebaseObjectIds] };
  }
  private async disk(): Promise<ReaderLibraryLogSyncIntent | undefined> {
    let raw: string;
    try {
      const stat = await fileIo.stat(this.path);
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new Error('LIBRARY_LOG_JOURNAL_INVALID');
      raw = await fileIo.readText(this.path);
    } catch (error) { if ((error as { code?: number }).code === 13900002) return undefined; throw error; }
    return raw === '' ? undefined : this.validate(JSON.parse(raw) as ReaderLibraryLogSyncIntent);
  }
  load(): Promise<ReaderLibraryLogSyncIntent | undefined> {
    return this.serial(async (): Promise<ReaderLibraryLogSyncIntent | undefined> => {
      const disk = await this.disk(), warm = ReaderLibraryLogSyncJournal.uncertain.get(this.path);
      if (warm === undefined) return disk;
      if (disk !== undefined && disk.operationId !== warm.operationId) throw new Error('LIBRARY_LOG_JOURNAL_CHANGED');
      return this.validate(warm);
    });
  }
  save(value: ReaderLibraryLogSyncIntent): Promise<void> {
    const captured = this.validate(value);
    return this.serial(async (): Promise<void> => {
      const disk = await this.disk(), warm = ReaderLibraryLogSyncJournal.uncertain.get(this.path);
      if (disk === undefined && warm === undefined && captured.phase !== 'collecting')
        throw new Error('LIBRARY_LOG_JOURNAL_RETIRED');
      for (const previous of [disk, warm]) {
        if (previous === undefined) continue;
        if (previous.operationId !== captured.operationId || previous.configOperationId !== captured.configOperationId ||
          previous.configPayloadHash !== captured.configPayloadHash || previous.directory !== captured.directory)
          throw new Error('LIBRARY_LOG_ORIGINAL_OPERATION_PENDING');
        if (['mayPublish', 'published', 'committing', 'cleanup', 'rebasing'].includes(previous.phase) && previous.planToken === captured.planToken &&
          (previous.objectId !== captured.objectId || previous.publishSha256 !== captured.publishSha256 ||
           previous.publishBytes !== captured.publishBytes || JSON.stringify(previous.retireObjects) !== JSON.stringify(captured.retireObjects)))
          throw new Error('LIBRARY_LOG_ORIGINAL_SOURCE_CHANGED');
        if (previous.phase === 'rebasing' && previous.planToken !== previous.rebaseFromToken &&
          (captured.planToken !== previous.planToken ||
           JSON.stringify([...captured.objectIds].sort()) !== JSON.stringify([...(previous.rebaseObjectIds ?? [])].sort())))
          throw new Error('LIBRARY_LOG_ORIGINAL_SOURCE_CHANGED');
      }
      ReaderLibraryLogSyncJournal.uncertain.set(this.path, captured);
      await replaceReaderAtomicSnapshot(this.path, this.parent, JSON.stringify(captured));
      const actual = await this.disk();
      if (actual === undefined || JSON.stringify(actual) !== JSON.stringify(captured)) throw new Error('LIBRARY_LOG_JOURNAL_UNCONFIRMED');
      ReaderLibraryLogSyncJournal.uncertain.delete(this.path);
    });
  }
  sourcePath(operationId: string): string {
    if (!/^library-sync-[0-9a-f]{32}$/.test(operationId)) throw new Error('LIBRARY_LOG_OPERATION_INVALID');
    return `${this.parent}/${operationId}.log-v2.ciphertext`;
  }
  async prepareSource(operationId: string, content: string, sha256: string): Promise<number> {
    const bytes = new util.TextEncoder().encodeInto(content);
    if (bytes.byteLength < 1 || bytes.byteLength > READER_LIBRARY_SYNC_MAX_BYTES || await readerLibrarySyncHash(bytes) !== sha256)
      throw new Error('LIBRARY_LOG_SOURCE_INVALID');
    await replaceReaderAtomicSnapshot(this.sourcePath(operationId), this.parent, content);
    await this.verifySource(operationId, sha256, bytes.byteLength); return bytes.byteLength;
  }
  async verifySource(operationId: string, sha256: string, expectedBytes: number): Promise<string> {
    const path = this.sourcePath(operationId), stat = await fileIo.stat(path);
    if (!stat.isFile() || stat.size !== expectedBytes || stat.size > READER_LIBRARY_SYNC_MAX_BYTES) throw new Error('LIBRARY_LOG_SOURCE_CHANGED');
    const bytes = new util.TextEncoder().encodeInto(await fileIo.readText(path));
    if (bytes.byteLength !== expectedBytes || await readerLibrarySyncHash(bytes) !== sha256) throw new Error('LIBRARY_LOG_SOURCE_CHANGED');
    return path;
  }
  clear(operationId: string): Promise<void> {
    return this.serial(async (): Promise<void> => {
      const disk = await this.disk(), warm = ReaderLibraryLogSyncJournal.uncertain.get(this.path);
      if (disk !== undefined && disk.operationId !== operationId || warm !== undefined && warm.operationId !== operationId)
        throw new Error('LIBRARY_LOG_JOURNAL_CHANGED');
      await replaceReaderAtomicSnapshot(this.path, this.parent, '');
      if (await this.disk() !== undefined) throw new Error('LIBRARY_LOG_JOURNAL_UNCONFIRMED');
      ReaderLibraryLogSyncJournal.uncertain.delete(this.path);
      try { await fileIo.unlink(this.sourcePath(operationId)); }
      catch (error) { if ((error as { code?: number }).code !== 13900002) throw error; }
    });
  }
}
