import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import cryptoFramework from '@ohos.security.cryptoFramework';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';

export type ReaderLibrarySyncPhase = 'planning' | 'review' | 'prepared' | 'mayPublish' | 'published' | 'committing' | 'needsRebase';
export interface ReaderLibrarySyncIntent {
  version: 1;
  operationId: string;
  configOperationId: string;
  configPayloadHash: string;
  remotePath: string;
  planToken?: string;
  localBasis?: string;
  expectedRevision?: string;
  publishedRevision?: string;
  publishSha256?: string;
  publishBytes?: number;
  phase: ReaderLibrarySyncPhase;
}

export const READER_LIBRARY_SYNC_MAX_BYTES: number = 24 * 1024 * 1024;
export function readerLibrarySyncStrongRevision(value: string): boolean {
  return typeof value === 'string' && value.length <= 1024 && /^"[\x21\x23-\x7e\x80-\xff]*"$/.test(value);
}
export async function readerLibrarySyncHash(bytes: Uint8Array): Promise<string> {
  const digest = cryptoFramework.createMd('SHA256');
  await digest.update({ data: bytes });
  return Array.from((await digest.digest()).data).map((byte: number): string => byte.toString(16).padStart(2, '0')).join('');
}

/** One accepted library-sync operation. The source is already encrypted by
 * Core; passwords, server credentials and document plaintext are never saved. */
export class ReaderLibrarySyncJournal {
  private static tails: Map<string, Promise<void>> = new Map();
  private static uncertain: Map<string, ReaderLibrarySyncIntent> = new Map();
  private readonly path: string;
  constructor(private readonly parent: string) { this.path = `${parent}/reader-library-sync-v1.json`; }
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const previous = ReaderLibrarySyncJournal.tails.get(this.path) ?? Promise.resolve();
    const next = previous.then(run);
    ReaderLibrarySyncJournal.tails.set(this.path, next.then((): void => {}, (): void => {}));
    return next;
  }
  private validate(value: ReaderLibrarySyncIntent): ReaderLibrarySyncIntent {
    const stages = ['planning', 'review', 'prepared', 'mayPublish', 'published', 'committing', 'needsRebase'];
    if (value === null || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 ||
      !/^library-sync-[0-9a-f]{32}$/.test(value.operationId) || typeof value.configOperationId !== 'string' ||
      value.configOperationId.length < 1 || value.configOperationId.length > 128 ||
      !/^[0-9a-f]{64}$/.test(value.configPayloadHash) || typeof value.remotePath !== 'string' ||
      value.remotePath.length < 1 || value.remotePath.length > 8192 || /[\u0000-\u001f\u007f]/.test(value.remotePath) ||
      value.phase !== 'planning' && (typeof value.planToken !== 'string' || value.planToken.length < 1 || value.planToken.length > 256 ||
      typeof value.localBasis !== 'string' || value.localBasis.length < 1 || value.localBasis.length > 256) ||
      !stages.includes(value.phase) ||
      value.expectedRevision !== undefined && !readerLibrarySyncStrongRevision(value.expectedRevision) ||
      value.publishedRevision !== undefined && !readerLibrarySyncStrongRevision(value.publishedRevision) ||
      value.publishSha256 !== undefined && !/^[0-9a-f]{64}$/.test(value.publishSha256) ||
      value.publishBytes !== undefined && (!Number.isSafeInteger(value.publishBytes) || value.publishBytes < 1 || value.publishBytes > READER_LIBRARY_SYNC_MAX_BYTES) ||
      (value.publishSha256 === undefined) !== (value.publishBytes === undefined) ||
      ['prepared', 'mayPublish', 'published', 'committing'].includes(value.phase) && value.publishSha256 === undefined ||
      ['published', 'committing'].includes(value.phase) && value.publishedRevision === undefined)
      throw new Error('LIBRARY_SYNC_JOURNAL_INVALID');
    return { ...value };
  }
  private async disk(): Promise<ReaderLibrarySyncIntent | undefined> {
    let raw: string;
    try {
      const stat = await fileIo.stat(this.path);
      if (!stat.isFile() || stat.size > 16 * 1024) throw new Error('LIBRARY_SYNC_JOURNAL_INVALID');
      raw = await fileIo.readText(this.path);
    } catch (error) { if ((error as { code?: number }).code === 13900002) return undefined; throw error; }
    if (raw === '') return undefined;
    return this.validate(JSON.parse(raw) as ReaderLibrarySyncIntent);
  }
  load(): Promise<ReaderLibrarySyncIntent | undefined> {
    return this.serial(async (): Promise<ReaderLibrarySyncIntent | undefined> => {
      const disk = await this.disk(), warm = ReaderLibrarySyncJournal.uncertain.get(this.path);
      if (warm === undefined) return disk;
      if (disk !== undefined && disk.operationId !== warm.operationId) throw new Error('LIBRARY_SYNC_JOURNAL_CHANGED');
      // A published atomic write may have lost its acknowledgement. Keep its
      // exact identity until the same operation is reconciled or re-persisted.
      return this.validate(warm);
    });
  }
  save(value: ReaderLibrarySyncIntent): Promise<void> {
    const captured = this.validate(value);
    return this.serial(async (): Promise<void> => {
      const previous = await this.disk(), warm = ReaderLibrarySyncJournal.uncertain.get(this.path);
      for (const original of [previous, warm]) {
        if (original !== undefined && (original.operationId !== captured.operationId ||
          original.configOperationId !== captured.configOperationId || original.configPayloadHash !== captured.configPayloadHash ||
          original.remotePath !== captured.remotePath)) throw new Error('LIBRARY_SYNC_ORIGINAL_OPERATION_PENDING');
        if (original !== undefined && ['mayPublish', 'published', 'committing'].includes(original.phase) &&
          captured.planToken === original.planToken && (captured.publishSha256 !== original.publishSha256 || captured.publishBytes !== original.publishBytes))
          throw new Error('LIBRARY_SYNC_ORIGINAL_SOURCE_CHANGED');
      }
      ReaderLibrarySyncJournal.uncertain.set(this.path, captured);
      await replaceReaderAtomicSnapshot(this.path, this.parent, JSON.stringify(captured));
      const actual = await this.disk();
      if (actual === undefined || JSON.stringify(actual) !== JSON.stringify(captured)) throw new Error('LIBRARY_SYNC_JOURNAL_UNCONFIRMED');
      ReaderLibrarySyncJournal.uncertain.delete(this.path);
    });
  }
  sourcePath(operationId: string): string {
    if (!/^library-sync-[0-9a-f]{32}$/.test(operationId)) throw new Error('LIBRARY_SYNC_OPERATION_INVALID');
    return `${this.parent}/${operationId}.ciphertext`;
  }
  async prepareSource(operationId: string, content: string, expectedSha256: string): Promise<number> {
    const bytes = new util.TextEncoder().encodeInto(content);
    if (bytes.byteLength < 1 || bytes.byteLength > READER_LIBRARY_SYNC_MAX_BYTES ||
      await readerLibrarySyncHash(bytes) !== expectedSha256) throw new Error('LIBRARY_SYNC_SOURCE_INVALID');
    await replaceReaderAtomicSnapshot(this.sourcePath(operationId), this.parent, content);
    await this.verifySource(operationId, expectedSha256, bytes.byteLength);
    return bytes.byteLength;
  }
  async verifySource(operationId: string, sha256: string, expectedBytes: number): Promise<string> {
    const path = this.sourcePath(operationId), stat = await fileIo.stat(path);
    if (!stat.isFile() || stat.size !== expectedBytes || stat.size > READER_LIBRARY_SYNC_MAX_BYTES) throw new Error('LIBRARY_SYNC_SOURCE_CHANGED');
    const bytes = new util.TextEncoder().encodeInto(await fileIo.readText(path));
    if (bytes.byteLength !== expectedBytes || await readerLibrarySyncHash(bytes) !== sha256) throw new Error('LIBRARY_SYNC_SOURCE_CHANGED');
    return path;
  }
  clear(operationId: string): Promise<void> {
    return this.serial(async (): Promise<void> => {
      const value = await this.disk(), warm = ReaderLibrarySyncJournal.uncertain.get(this.path);
      if (value !== undefined && value.operationId !== operationId || warm !== undefined && warm.operationId !== operationId)
        throw new Error('LIBRARY_SYNC_JOURNAL_CHANGED');
      await replaceReaderAtomicSnapshot(this.path, this.parent, '');
      if (await this.disk() !== undefined) throw new Error('LIBRARY_SYNC_JOURNAL_UNCONFIRMED');
      ReaderLibrarySyncJournal.uncertain.delete(this.path);
      try { await fileIo.unlink(this.sourcePath(operationId)); }
      catch (error) { if ((error as { code?: number }).code !== 13900002) throw error; }
    });
  }
}
