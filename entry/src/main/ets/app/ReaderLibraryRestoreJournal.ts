import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { replaceReaderAtomicSnapshot } from './ReaderAtomicSnapshotFile';

const JOURNAL_FILE = 'reader-library-restore-pending-v1.json';
const MAX_JOURNAL_BYTES = 2048;

export interface ReaderLibraryRestoreIdentity {
  readonly operationId: string;
  readonly packageSha256: string;
}

export type ReaderLibraryRestorePhase = 'prepared' | 'mayApply' | 'coreCommitted';

export interface ReaderLibraryRestoreRecord extends ReaderLibraryRestoreIdentity {
  readonly version: 1;
  readonly phase: ReaderLibraryRestorePhase;
}

/** A projection of a real Core receipt lookup. Historical commits cannot
 * activate a writer; the Core/Runtime owner retains that decision. */
export interface ReaderLibraryRestoreCoreFact extends ReaderLibraryRestoreIdentity {
  readonly status: 'missing' | 'committedCurrent' | 'committedHistorical';
}

export type ReaderLibraryRestoreCoreQuery =
  (identity: ReaderLibraryRestoreIdentity) => Promise<ReaderLibraryRestoreCoreFact>;

/** One app-private metadata-restore intent. Only operation/hash/phase cross a
 * restart. Passwords, package bytes, writer nonces and Host locators never do.
 * This store neither stops IO nor supplies a Core receipt or ready decision. */
export class ReaderLibraryRestoreJournal {
  private static lane: Promise<void> = Promise.resolve();
  // A failed write/clear acknowledgement keeps the original admission barrier
  // in this process, including when a successor Ability creates a new store.
  private static unresolved: Map<string, ReaderLibraryRestoreRecord> = new Map();
  private readonly parent: string;
  private readonly path: string;
  private readonly current: () => boolean;

  constructor(filesDir: string, current: () => boolean) {
    if (typeof filesDir !== 'string' || !filesDir.startsWith('/') ||
      /[\u0000-\u001f\u007f]/.test(filesDir)) throw new Error('LIBRARY_RESTORE_JOURNAL_CONTEXT_INVALID');
    this.parent = filesDir;
    this.path = `${filesDir}/${JOURNAL_FILE}`;
    this.current = current;
  }

  read(): Promise<ReaderLibraryRestoreRecord | undefined> {
    return this.serial(async (): Promise<ReaderLibraryRestoreRecord | undefined> => {
      const record = await this.readCurrent();
      return record === undefined ? undefined : this.copy(record);
    });
  }

  /** The caller supplies the original operation and SHA of the actual package
   * bytes. Reusing an operation never replaces its hash or lowers its phase. */
  prepare(identity: ReaderLibraryRestoreIdentity): Promise<ReaderLibraryRestoreRecord> {
    const captured = this.identity(identity);
    return this.serial(async (): Promise<ReaderLibraryRestoreRecord> => {
      const old = await this.readCurrent();
      if (old !== undefined) this.requireIdentity(old, captured);
      const next: ReaderLibraryRestoreRecord = old ?? { version: 1, ...captured, phase: 'prepared' };
      await this.persist(next);
      return this.copy(next);
    });
  }

  /** Must be durably acknowledged before dispatching the real Core apply. */
  markMayApply(identity: ReaderLibraryRestoreIdentity): Promise<ReaderLibraryRestoreRecord> {
    return this.advance(this.identity(identity), 'mayApply');
  }

  /** Only the actual Core apply/query owner may provide this committed fact.
   * Recording it never clears the startup reconciliation requirement. */
  markCoreCommitted(fact: ReaderLibraryRestoreCoreFact): Promise<ReaderLibraryRestoreRecord> {
    const captured = this.coreFact(fact);
    if (captured.status === 'missing') throw new Error('LIBRARY_RESTORE_COMMIT_FACT_MISSING');
    return this.advance(captured, 'coreCommitted');
  }

  /** No record returns immediately. Every retained phase requires the actual
   * Core lookup before cleanup, including prepared and lost-ACK mayApply.
   * The callback must not call this journal recursively or invent a receipt. */
  reconcile(query: ReaderLibraryRestoreCoreQuery): Promise<ReaderLibraryRestoreCoreFact | undefined> {
    return this.serial(async (): Promise<ReaderLibraryRestoreCoreFact | undefined> => {
      const original = await this.readCurrent();
      if (original === undefined) return undefined;
      const fact = this.coreFact(await query(this.identity(original)));
      this.assertCurrent();
      this.requireIdentity(original, fact);
      const live = await this.readCurrent();
      if (live === undefined) throw new Error('LIBRARY_RESTORE_JOURNAL_CHANGED');
      this.requireIdentity(live, original);
      if (live.phase === 'coreCommitted' && fact.status === 'missing')
        throw new Error('LIBRARY_RESTORE_COMMIT_FACT_MISSING');
      // Persist an empty tombstone through the same atomic fsync boundary.
      // Lost cleanup ACK retains the original identity until another lookup.
      ReaderLibraryRestoreJournal.unresolved.set(this.path, this.copy(live));
      this.assertCurrent();
      await replaceReaderAtomicSnapshot(this.path, this.parent, '');
      this.assertCurrent();
      if (await this.readDisk() !== undefined) throw new Error('LIBRARY_RESTORE_JOURNAL_CLEAR_UNCONFIRMED');
      this.assertCurrent();
      ReaderLibraryRestoreJournal.unresolved.delete(this.path);
      return fact;
    });
  }

  private advance(identity: ReaderLibraryRestoreIdentity, phase: ReaderLibraryRestorePhase): Promise<ReaderLibraryRestoreRecord> {
    return this.serial(async (): Promise<ReaderLibraryRestoreRecord> => {
      const old = await this.readCurrent();
      if (old === undefined) throw new Error('LIBRARY_RESTORE_JOURNAL_MISSING');
      this.requireIdentity(old, identity);
      if (phase === 'coreCommitted' && old.phase === 'prepared')
        throw new Error('LIBRARY_RESTORE_APPLY_NOT_DISPATCHED');
      const next: ReaderLibraryRestoreRecord = this.rank(old.phase) >= this.rank(phase)
        ? old : { version: 1, ...this.identity(old), phase };
      // Re-establish durability even for an idempotent warm retry whose last
      // write may have published without returning its acknowledgement.
      await this.persist(next);
      return this.copy(next);
    });
  }

  private async readCurrent(): Promise<ReaderLibraryRestoreRecord | undefined> {
    this.assertCurrent();
    const disk = await this.readDisk();
    this.assertCurrent();
    const warm = ReaderLibraryRestoreJournal.unresolved.get(this.path);
    if (warm === undefined) return disk;
    if (disk === undefined) return this.copy(warm);
    this.requireIdentity(warm, disk);
    return this.rank(warm.phase) > this.rank(disk.phase) ? this.copy(warm) : disk;
  }

  private async persist(record: ReaderLibraryRestoreRecord): Promise<void> {
    this.assertCurrent();
    const captured = this.record(record);
    const raw = JSON.stringify(captured);
    if (new util.TextEncoder().encodeInto(raw).length > MAX_JOURNAL_BYTES)
      throw new Error('LIBRARY_RESTORE_JOURNAL_LIMIT');
    ReaderLibraryRestoreJournal.unresolved.set(this.path, captured);
    await replaceReaderAtomicSnapshot(this.path, this.parent, raw);
    this.assertCurrent();
    const disk = await this.readDisk();
    if (disk === undefined) throw new Error('LIBRARY_RESTORE_JOURNAL_WRITE_UNCONFIRMED');
    this.requireIdentity(disk, captured);
    if (disk.phase !== captured.phase) throw new Error('LIBRARY_RESTORE_JOURNAL_WRITE_UNCONFIRMED');
    this.assertCurrent();
    ReaderLibraryRestoreJournal.unresolved.delete(this.path);
  }

  private async readDisk(): Promise<ReaderLibraryRestoreRecord | undefined> {
    // Use the platform AtomicFile's published base handle. Both allocation and
    // read length are bounded before JSON/UTF-8 parsing, unlike readFully().
    let file: fileIo.File;
    try { file = new fileIo.AtomicFile(this.path).getBaseFile(); }
    catch (error) {
      if ((error as BusinessError).code === 13900002) return undefined;
      throw error;
    }
    try {
      const before = await fileIo.stat(file.fd);
      if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > MAX_JOURNAL_BYTES)
        throw new Error('LIBRARY_RESTORE_JOURNAL_LIMIT');
      const bytes = new Uint8Array(MAX_JOURNAL_BYTES + 1);
      let length = 0;
      while (length < bytes.length) {
        const chunk = new ArrayBuffer(bytes.length - length);
        const read = await fileIo.read(file.fd, chunk, { length: chunk.byteLength });
        if (!Number.isSafeInteger(read) || read < 0 || read > chunk.byteLength)
          throw new Error('LIBRARY_RESTORE_JOURNAL_CHANGED');
        if (read === 0) break;
        bytes.set(new Uint8Array(chunk, 0, read), length);
        length += read;
      }
      const after = await fileIo.stat(file.fd);
      if (length !== before.size || length > MAX_JOURNAL_BYTES || !after.isFile() || after.size !== before.size)
        throw new Error('LIBRARY_RESTORE_JOURNAL_CHANGED');
      if (length === 0) return undefined;
      const raw = util.TextDecoder.create('utf-8', { fatal: true })
        .decodeToString(bytes.subarray(0, length));
      return this.record(JSON.parse(raw) as ReaderLibraryRestoreRecord);
    } finally { await fileIo.close(file); }
  }

  private identity(value: ReaderLibraryRestoreIdentity): ReaderLibraryRestoreIdentity {
    if (value === undefined || value === null || typeof value.operationId !== 'string' ||
      value.operationId.length === 0 || /[\u0000-\u001f\u007f-\u009f]/.test(value.operationId) ||
      new util.TextEncoder().encodeInto(value.operationId).length > 128 ||
      typeof value.packageSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.packageSha256))
      throw new Error('LIBRARY_RESTORE_JOURNAL_IDENTITY_INVALID');
    return { operationId: value.operationId, packageSha256: value.packageSha256 };
  }

  private record(value: ReaderLibraryRestoreRecord): ReaderLibraryRestoreRecord {
    this.exactKeys(value, ['version', 'operationId', 'packageSha256', 'phase']);
    const identity = this.identity(value);
    if (value.version !== 1 || (value.phase !== 'prepared' && value.phase !== 'mayApply' && value.phase !== 'coreCommitted'))
      throw new Error('LIBRARY_RESTORE_JOURNAL_FORMAT_INVALID');
    return { version: 1, ...identity, phase: value.phase };
  }

  private coreFact(value: ReaderLibraryRestoreCoreFact): ReaderLibraryRestoreCoreFact {
    this.exactKeys(value, ['operationId', 'packageSha256', 'status']);
    const identity = this.identity(value);
    if (value.status !== 'missing' && value.status !== 'committedCurrent' && value.status !== 'committedHistorical')
      throw new Error('LIBRARY_RESTORE_CORE_FACT_INVALID');
    return { ...identity, status: value.status };
  }

  private exactKeys(value: Object, keys: string[]): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new Error('LIBRARY_RESTORE_JOURNAL_FORMAT_INVALID');
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some((key: string): boolean => !keys.includes(key)))
      throw new Error('LIBRARY_RESTORE_JOURNAL_FORMAT_INVALID');
  }

  private requireIdentity(actual: ReaderLibraryRestoreIdentity, expected: ReaderLibraryRestoreIdentity): void {
    if (actual.operationId !== expected.operationId || actual.packageSha256 !== expected.packageSha256)
      throw new Error('LIBRARY_RESTORE_JOURNAL_IDENTITY_CONFLICT');
  }

  private copy(value: ReaderLibraryRestoreRecord): ReaderLibraryRestoreRecord {
    return { version: 1, ...this.identity(value), phase: value.phase };
  }

  private rank(phase: ReaderLibraryRestorePhase): number {
    return phase === 'prepared' ? 0 : phase === 'mayApply' ? 1 : 2;
  }

  private assertCurrent(): void {
    if (!this.current()) throw new Error('LIBRARY_RESTORE_RUNTIME_RETIRED');
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const operation = ReaderLibraryRestoreJournal.lane.then(work);
    ReaderLibraryRestoreJournal.lane = operation.then((): void => {}, (): void => {});
    return operation;
  }
}
