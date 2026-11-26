import fileIo from '@ohos.file.fs';
import fileUri from '@ohos.file.fileuri';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { replaceReaderAtomicSnapshot } from '../../../app/ReaderAtomicSnapshotFile';
import { readerHostFilesDirectory } from '../../../app/diagnostics/ReaderPublicFixtureScope';
import { isReaderLocalBookFileName } from '../../../app/ReaderLocalBookFormatAdmission';
import {
  LOCAL_RECOVERY_MAX_BYTES, LocalRecoveryFileError, openRecoveryFile, recoveryCopyBytes, recoveryDigest,
  recoveryHashFile, recoveryOutput, recoveryRead, recoveryReserve, recoveryText, recoveryUtf8,
  recoveryVisitFile, recoveryWithFile, sealRecoveryFile, selectRecoveryDocument,
} from '../../../platform/backup/LocalRecoveryFile';

export interface LocalRecoveryOutcome {
  state: 'cancelled' | 'preview' | 'exported' | 'restored' | 'rolledBack' | 'interrupted' | 'rejected' | 'failed' | 'tooLarge';
  included?: number;
  missing?: number;
}

export type LocalRecoveryArchiveReceiver = (destination: string) => Promise<boolean>;
export type LocalRecoveryArchiveConsumer = (path: string, sha256: string, size: number) => Promise<boolean>;

/** The system extension can build an archive from its isolated read-only source. */
export interface LocalRecoveryExportPort {
  readonly filesDir: string;
  capture(passphrase: string): Promise<LocalRecoveryExportCapture>;
  retainedLocalBookSourcePath(bookId: string, current: () => boolean): Promise<string | undefined>;
}

export interface LocalRecoveryExportCapture {
  content: string;
  packageSha256: string;
  localOriginals: unknown;
}

interface Original {
  sha256: string;
  byteLength: number;
  sourceFormat: string;
}

interface Row {
  bookId: string;
  original: Original | null;
  included: boolean;
}

interface Archive {
  packageSha256: string;
  content: string;
  rows: Row[];
}

interface Journal {
  schemaVersion: number;
  operationId: string;
  packageSha256: string;
  bundleSha256: string;
  rollbackKind: 'physical' | 'portable';
  rollbackId?: string;
  rollbackSha256: string;
  rollbackRequested?: boolean;
  origin?: 'system';
}

interface Preview {
  packageSha256: string;
  bundleSha256: string;
}

const MAX_HEADER_BYTES = 28 * 1024 * 1024;
const MAX_ORIGINAL_BYTES = 64 * 1024 * 1024;
const MAX_ORIGINALS = 10000;
const HASH = /^[a-f0-9]{64}$/;
const TIMEOUT = 120000;
const LOG_DOMAIN = 0x5244;

function systemRecoveryOperationId(digest: string): string {
  return `quarantined-v1-${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-` +
    `${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

function isSystemRecovery(journal: Journal): boolean {
  // Accept the pre-origin journal format using its exact deterministic owner.
  return journal.origin === 'system' || journal.operationId === systemRecoveryOperationId(journal.bundleSha256);
}

export class LocalRecoveryGateway {
  private static readonly active = new Set<string>();
  private preview: Preview | undefined;
  private readonly runtime: ReaderRuntimeOwner | undefined;
  private readonly exportPort: LocalRecoveryExportPort | undefined;
  private readonly directory: string;

  constructor(runtime?: ReaderRuntimeOwner, exportPort?: LocalRecoveryExportPort) {
    this.exportPort = exportPort;
    this.runtime = exportPort === undefined ? runtime ?? ReaderRuntimeOwner.current() : undefined;
    const directory = exportPort?.filesDir ?? readerHostFilesDirectory(this.requireRuntime().getUIAbilityContext().filesDir);
    this.directory = `${directory}/reader-local-recovery`;
  }

  async pending(): Promise<boolean> {
    return fileIo.access(this.journalPath());
  }

  async pendingAction(): Promise<'restore' | 'rollback' | 'system' | undefined> {
    const journal = await this.readJournal();
    if (journal === undefined) return undefined;
    if (isSystemRecovery(journal)) return 'system';
    return journal.rollbackRequested === true ? 'rollback' : 'restore';
  }

  clearPreview(): void {
    this.preview = undefined;
    // Only the file owner under the operation lane may unlink a staged pack.
  }

  exportPackage(passphrase: string, current: () => boolean): Promise<LocalRecoveryOutcome> {
    return this.exportStagedPackage(passphrase, true, async (path, sha256): Promise<boolean> => {
      const uri = await selectRecoveryDocument(this.requireRuntime().getUIAbilityContext(), true);
      if (uri === undefined) return false;
      this.checkCurrent(current);
      // Complete the bounded provider write after explicit selection. An
      // observed exact readback is the receipt for the export.
      await recoveryOutput(uri, async (emit): Promise<void> => {
        if (await recoveryVisitFile(path, emit, () => true) !== sha256) this.reject();
      });
      if (await recoveryHashFile(uri) !== sha256) this.reject();
      return true;
    }, current);
  }

  exportStagedPackage(passphrase: string, includeOriginals: boolean, consume: LocalRecoveryArchiveConsumer,
    current: () => boolean): Promise<LocalRecoveryOutcome> {
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      const pending = await this.pendingAction();
      if (pending !== undefined && pending !== 'system') return { state: 'interrupted' };
      const captured = await this.captureForExport(passphrase);
      const content = captured.content, packageSha256 = captured.packageSha256;
      const rows = captured.rows;
      const originals = new Map<string, string>();
      let bytes = recoveryUtf8(content).length;
      for (const row of rows) {
        this.checkCurrent(current);
        if (!includeOriginals || row.original === null || !this.canMaterialize(row.original)) continue;
        const expected = row.original;
        const port = this.exportPort ?? this.requireRuntime();
        const path = await port.retainedLocalBookSourcePath(`local:${expected.sha256}`, current);
        if (path === undefined || !(await fileIo.lstat(path)).isFile()) continue;
        if ((await fileIo.stat(path)).size !== expected.byteLength || await recoveryHashFile(path) !== expected.sha256) continue;
        originals.set(row.bookId, path);
        row.included = true;
        bytes += expected.byteLength;
      }
      if (bytes > LOCAL_RECOVERY_MAX_BYTES) throw new LocalRecoveryFileError('tooLarge');
      await recoveryReserve(this.directory, bytes);
      const archive: Archive = { packageSha256, content, rows };
      const header = recoveryUtf8(JSON.stringify(archive));
      if (header.length > MAX_HEADER_BYTES) throw new LocalRecoveryFileError('tooLarge');
      const size = new Uint8Array(4);
      new DataView(size.buffer).setUint32(0, header.length);
      const packagePath = `${work}/export.readerbackup`;
      await sealRecoveryFile(packagePath, passphrase, async (emit): Promise<void> => {
        await emit(size);
        await emit(header);
        for (const row of rows) {
          const path = originals.get(row.bookId);
          if (path === undefined || row.original === null) continue;
          const sha256 = await recoveryVisitFile(path, emit, current, row.original.byteLength);
          if (sha256 !== row.original.sha256) this.reject();
        }
      });
      this.checkCurrent(current);
      const expected = await recoveryHashFile(packagePath);
      const sizeBytes = (await fileIo.stat(packagePath)).size;
      if (!await consume(packagePath, expected, sizeBytes)) return { state: 'cancelled' };
      return this.outcome('exported', rows);
    });
  }

  inspectPackage(passphrase: string, current: () => boolean): Promise<LocalRecoveryOutcome> {
    return this.inspectStagedPackage(passphrase, async (staged): Promise<boolean> => {
      const uri = await selectRecoveryDocument(this.requireRuntime().getUIAbilityContext(), false);
      if (uri === undefined) return false;
      this.checkCurrent(current);
      const size = (await fileIo.stat(uri)).size;
      if (size > LOCAL_RECOVERY_MAX_BYTES) throw new LocalRecoveryFileError('tooLarge');
      await recoveryReserve(this.directory, 3 * size);
      await recoveryOutput(staged, async (emit): Promise<void> => { await recoveryVisitFile(uri, emit, current, size); });
      return true;
    }, current);
  }

  /** The system already authorized this transfer. A stable parent operation
   * resumes after a cold-start interruption or a lost system journal ACK. */
  restoreSystemStagedPackage(passphrase: string, expectedBundleSha256: string, receive: LocalRecoveryArchiveReceiver,
    current: () => boolean): Promise<LocalRecoveryOutcome> {
    this.requireRuntime();
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      if (!HASH.test(expectedBundleSha256)) this.reject();
      this.checkCurrent(current);
      const operationId = systemRecoveryOperationId(expectedBundleSha256);
      const accepted = await this.readJournal();
      if (accepted !== undefined) {
        if (!isSystemRecovery(accepted) || accepted.operationId !== operationId || accepted.bundleSha256 !== expectedBundleSha256 ||
          accepted.rollbackRequested === true) return { state: 'interrupted' };
        const archive = await this.openPending(work, passphrase, expectedBundleSha256);
        if (archive.packageSha256 !== accepted.packageSha256) this.reject();
        return this.apply(work, archive, accepted, passphrase);
      }

      const staged = `${work}/system.readerbackup`;
      if (!await receive(staged)) return { state: 'cancelled' };
      if (await recoveryHashFile(staged) !== expectedBundleSha256) this.reject();
      await recoveryReserve(this.directory, 2 * (await fileIo.stat(staged)).size + MAX_ORIGINAL_BYTES);
      const archive = await this.open(staged, work, passphrase, current);
      await this.checkOriginalsReadable(work, archive);
      this.checkCurrent(current);
      const intent: JsonObject = { operationId, packageSha256: archive.packageSha256 };
      const status = await this.request('library.package.restore.status', intent);
      if (status['operationId'] !== operationId || status['packageSha256'] !== archive.packageSha256 ||
        (status['status'] !== 'missing' && status['status'] !== 'committedCurrent')) return { state: 'interrupted' };
      this.checkCurrent(current);
      await this.clearUnaccepted();
      await fileIo.moveFile(staged, this.packagePath());
      await this.syncDirectory();
      const checkpoint = await this.prepareJournal(archive.packageSha256, expectedBundleSha256, passphrase, operationId);
      const journal: Journal = { ...checkpoint, origin: 'system' };
      this.checkCurrent(current);
      await replaceReaderAtomicSnapshot(this.journalPath(), this.directory, JSON.stringify(journal));
      this.preview = undefined;
      return this.apply(work, archive, journal, passphrase);
    });
  }

  inspectStagedPackage(passphrase: string, receive: LocalRecoveryArchiveReceiver,
    current: () => boolean): Promise<LocalRecoveryOutcome> {
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      if (await this.pending()) return { state: 'interrupted' };
      this.preview = undefined;
      await this.clearUnaccepted();
      this.checkCurrent(current);
      const staged = `${work}/selected.readerbackup`;
      if (!await receive(staged)) return { state: 'cancelled' };
      this.checkCurrent(current);
      const bundleSha256 = await recoveryHashFile(staged);
      const size = (await fileIo.stat(staged)).size;
      await recoveryReserve(this.directory, 2 * size);
      const archive = await this.open(staged, work, passphrase, current);
      this.checkCurrent(current);
      await fileIo.moveFile(staged, this.packagePath());
      await this.syncDirectory();
      if (!current()) {
        await this.clearUnaccepted();
        return { state: 'cancelled' };
      }
      this.preview = { packageSha256: archive.packageSha256, bundleSha256 };
      return this.outcome('preview', archive.rows);
    });
  }

  applyPackage(passphrase: string, admit?: () => Promise<void>): Promise<LocalRecoveryOutcome> {
    this.requireRuntime();
    const preview = this.preview;
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      if (await this.pending()) return { state: 'interrupted' };
      if (preview === undefined) return { state: 'rejected' };
      const archive = await this.openPending(work, passphrase, preview.bundleSha256);
      if (archive.packageSha256 !== preview.packageSha256) this.reject();
      await this.checkOriginalsReadable(work, archive);
      if (this.preview !== preview) return { state: 'cancelled' };
      if (admit !== undefined) await admit();
      const journal = await this.prepareJournal(archive.packageSha256, preview.bundleSha256, passphrase);
      if (this.preview !== preview) return { state: 'cancelled' };
      if (admit !== undefined) await admit();
      await replaceReaderAtomicSnapshot(this.journalPath(), this.directory, JSON.stringify(journal));
      this.preview = undefined;
      return this.apply(work, archive, journal, passphrase);
    });
  }

  resumePackage(passphrase: string): Promise<LocalRecoveryOutcome> {
    this.requireRuntime();
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      const journal = await this.readJournal();
      if (journal === undefined) return { state: 'cancelled' };
      if (isSystemRecovery(journal)) return { state: 'interrupted' };
      if (journal.rollbackRequested === true) return this.rollback(work, journal, passphrase);
      if (journal.rollbackKind === 'portable' && await recoveryHashFile(this.rollbackPath()) !== journal.rollbackSha256) {
        throw new Error('Core rollback snapshot changed');
      }
      const archive = await this.openPending(work, passphrase, journal.bundleSha256);
      if (archive.packageSha256 !== journal.packageSha256) this.reject();
      return this.apply(work, archive, journal, passphrase);
    });
  }

  rollbackPackage(passphrase: string): Promise<LocalRecoveryOutcome> {
    this.requireRuntime();
    return this.perform(passphrase, async (work): Promise<LocalRecoveryOutcome> => {
      const journal = await this.readJournal();
      if (journal === undefined) return { state: 'cancelled' };
      if (isSystemRecovery(journal)) return { state: 'interrupted' };
      if (journal.rollbackRequested === true) return this.rollback(work, journal, passphrase);
      // Authenticate before committing the user's choice. For an older
      // physical checkpoint the still-authenticated pending package supplies
      // this proof. Portable recovery can authenticate its own checkpoint.
      let portable: Archive | undefined;
      if (journal.rollbackKind === 'portable') {
        portable = await this.loadPortableRollback(journal, passphrase);
      } else {
        const archive = await this.openPending(work, passphrase, journal.bundleSha256);
        if (archive.packageSha256 !== journal.packageSha256) this.reject();
      }
      const rollback: Journal = { ...journal, rollbackRequested: true };
      await replaceReaderAtomicSnapshot(this.journalPath(), this.directory, JSON.stringify(rollback));
      return this.rollback(work, rollback, passphrase, portable);
    });
  }

  private async loadPortableRollback(journal: Journal, passphrase: string): Promise<Archive> {
    const target = this.rollbackPath();
    if (await recoveryHashFile(target) !== journal.rollbackSha256) this.reject();
    const content = await fileIo.readText(target);
    const rows = await this.inspectCore(content, journal.rollbackSha256, passphrase);
    return { content, packageSha256: journal.rollbackSha256, rows };
  }

  private async rollback(work: string, journal: Journal, passphrase: string, portable?: Archive):
    Promise<LocalRecoveryOutcome> {
    if (journal.rollbackKind === 'physical') {
      const restored = await this.request('runtime.storage.backup.restore', {
        backupId: journal.rollbackId, expectedSha256: journal.rollbackSha256,
      });
      if (restored['restored'] !== true || restored['backupId'] !== journal.rollbackId ||
        restored['sha256'] !== journal.rollbackSha256) return { state: 'interrupted' };
    } else {
      const operationId = 'rollback-v1-' + journal.operationId.slice('quarantined-v1-'.length);
      const intent: JsonObject = { operationId, packageSha256: journal.rollbackSha256 };
      const archive = portable ?? await this.loadPortableRollback(journal, passphrase);
      let receipt = await this.request('library.package.restore.status', intent);
      if (receipt['status'] === 'missing') {
        await this.request('library.package.restore.apply', { ...intent, content: archive.content, password: passphrase });
        receipt = await this.request('library.package.restore.status', intent);
      }
      if (receipt['operationId'] !== operationId || receipt['packageSha256'] !== journal.rollbackSha256 ||
        receipt['status'] !== 'committedCurrent') return { state: 'interrupted' };
      // A portable metadata restore revokes the previous local-resource
      // publication receipts. Re-adopt only originals still held in the
      // immutable Host archive, under the new rollback receipt identity.
      const rollbackParent: Journal = { ...journal, operationId, packageSha256: journal.rollbackSha256,
        bundleSha256: journal.rollbackSha256 };
      for (let index = 0; index < archive.rows.length; index++) {
        const row = archive.rows[index];
        const original = row.original;
        if (original === null || !this.canMaterialize(original)) continue;
        await this.adoptRollbackOriginal(work, index, row.bookId, original, rollbackParent);
      }
    }
    await this.finishJournal();
    return { state: 'rolledBack' };
  }

  private async adoptRollbackOriginal(work: string, index: number, bookId: string, original: Original, journal: Journal):
    Promise<void> {
    const current = (): boolean => true;
    const retained = await this.requireRuntime().retainedLocalBookSourcePath(`local:${original.sha256}`, current);
    if (retained === undefined) return;
    const path = this.originalPath(work, index, original);
    await recoveryOutput(path, async (emit): Promise<void> => {
      if (await recoveryVisitFile(retained, emit, current, original.byteLength) !== original.sha256) this.reject();
    });
    try { await this.restoreOriginal(path, bookId, original, journal); }
    finally { await fileIo.unlink(path).catch(() => {}); }
  }

  private async apply(work: string, archive: Archive, journal: Journal, passphrase: string): Promise<LocalRecoveryOutcome> {
    const intent: JsonObject = { operationId: journal.operationId, packageSha256: journal.packageSha256 };
    let status = await this.request('library.package.restore.status', intent);
    this.checkParent(status, journal);
    if (status['status'] === 'missing') {
      await this.request('library.package.restore.apply', { ...intent, content: archive.content, password: passphrase,
        quarantineRestoredRules: true });
      status = await this.request('library.package.restore.status', intent);
      this.checkParent(status, journal);
    }
    if (status['status'] !== 'committedCurrent') return { state: 'interrupted' };
    for (let index = 0; index < archive.rows.length; index++) {
      const row = archive.rows[index];
      if (row.included && row.original !== null) {
        await this.restoreOriginal(this.originalPath(work, index, row.original), row.bookId, row.original, journal);
      }
    }
    await this.finishJournal();
    return this.outcome('restored', archive.rows);
  }

  private async finishJournal(): Promise<void> {
    try { await fileIo.unlink(this.journalPath()); }
    catch (error) { if (!this.isMissingFile(error)) throw error; }
    try { await this.clearUnaccepted(); }
    catch (_) {
      // Core and every included original already have committed receipts.
      hilog.warn(LOG_DOMAIN, 'Reader', 'Completed local recovery cleanup deferred');
    }
  }

  private async prepareJournal(packageSha256: string, bundleSha256: string, passphrase: string,
    operationId: string = `quarantined-v1-${util.generateRandomUUID(true)}`): Promise<Journal> {
    const info = await this.request('core.info', {});
    const storage = this.object(info['storageFormat']);
    const capabilities = this.object(storage['capabilities']);
    if (capabilities['physicalBackup'] === true) {
      const backup = await this.request('runtime.storage.backup.create', {});
      const rollbackId = backup['backupId'];
      const rollbackSha256 = backup['sha256'];
      if (typeof rollbackId !== 'string' || !/^[a-f0-9]{32}$/.test(rollbackId) ||
        typeof rollbackSha256 !== 'string' || !HASH.test(rollbackSha256)) {
        throw new Error('Core physical rollback point is unconfirmed');
      }
      return { schemaVersion: 1, operationId, packageSha256, bundleSha256,
        rollbackKind: 'physical', rollbackId, rollbackSha256 };
    }
    if (capabilities['physicalBackup'] !== false) throw new Error('Core rollback capabilities are unavailable');
    // Fresh/legacy SQLite supports a consistent encrypted portable snapshot.
    // Existing originals stay in the immutable Host archive across a restore.
    const snapshot = await this.request('library.package.export', { password: passphrase });
    const content = snapshot['content'], rollbackSha256 = snapshot['packageSha256'];
    if (typeof content !== 'string' || typeof rollbackSha256 !== 'string') throw new Error('Core rollback snapshot is invalid');
    await this.inspectCore(content, rollbackSha256, passphrase);
    const target = this.rollbackPath();
    await replaceReaderAtomicSnapshot(target, this.directory, content);
    if (await recoveryHashFile(target) !== rollbackSha256) throw new Error('Core rollback snapshot is unconfirmed');
    return { schemaVersion: 1, operationId, packageSha256, bundleSha256,
      rollbackKind: 'portable', rollbackSha256 };
  }

  private async checkOriginalsReadable(work: string, archive: Archive): Promise<void> {
    for (let index = 0; index < archive.rows.length; index++) {
      const row = archive.rows[index];
      if (!row.included || row.original === null) continue;
      const path = this.originalPath(work, index, row.original);
      const parsed = await this.request('import.parse', { kind: 'localBook', input: {
        bookId: row.bookId, fileName: `book.${row.original.sourceFormat}`, filePath: path,
      } });
      const summary = this.object(this.object(parsed['preview'])['summary']);
      const readability = this.object(summary['integrity'])['readability'];
      if (readability !== 'complete' && readability !== 'recoverable') this.reject();
    }
  }

  private async restoreOriginal(path: string, bookId: string, original: Original, journal: Journal): Promise<void> {
    const childOperationId = 'resource-' + await recoveryDigest(recoveryUtf8(
      JSON.stringify([journal.operationId, 'local', bookId, original.sha256])));
    let binding: JsonObject = { schemaVersion: 1, parentOperationId: journal.operationId,
      packageSha256: journal.packageSha256, bundleSha256: journal.bundleSha256, childOperationId, bookId,
      originalSha256: original.sha256, originalBytes: original.byteLength, sourceFormat: original.sourceFormat };
    let receipt = await this.resourceStatus(binding);
    if (receipt['status'] === 'finalized') return;
    // Retain and verify original bytes before Core makes the book readable.
    const runtime = this.requireRuntime();
    const materialized = await runtime.prepareSystemLocalBookInput(fileUri.getUriFromPath(path));
    const hashBookId = `local:${original.sha256}`;
    if (materialized.state !== 'ready') throw new Error('Could not stage the original book');
    const input = materialized.input;
    try {
      if (input.bookId !== hashBookId) throw new Error('Original staging identity changed');
      const commit = await runtime.commitLocalBookInput(input);
      if (!(await fileIo.lstat(commit.path)).isFile() || await recoveryHashFile(commit.path) !== original.sha256)
        throw new Error('Retained original does not match the recovery receipt');
      if (receipt['status'] === 'missing') {
        const expectation = this.object(receipt['originalExpectation']);
        const basis = expectation['basis'];
        if (typeof basis !== 'string' || basis.length === 0) throw new Error('Original restore basis is missing');
        binding = { ...binding, targetBasis: basis };
        const parsed = await this.request('import.parse', { kind: 'localBook', input: {
          bookId, fileName: input.fileName, filePath: commit.path, originalExpectation: expectation,
          resourceRestoreBinding: binding,
        } });
        await this.request('library.resource.restore.persist', { binding, parsed });
        receipt = await this.resourceStatus(binding);
      }
      if (receipt['status'] === 'persisted') {
        await this.request('import.finalize', { rollbackToken: this.object(receipt['rollbackToken']) });
        receipt = await this.resourceStatus(binding);
      }
      if (receipt['status'] !== 'finalized') throw new Error('Original publication is unconfirmed');
    } finally { await runtime.discardLocalBookInput(input).catch(() => {}); }
  }

  private async resourceStatus(binding: JsonObject): Promise<JsonObject> {
    const receipt = await this.request('library.resource.restore.status', { binding });
    const actual = this.object(receipt['binding']);
    for (const field of Object.keys(binding)) {
      if (actual[field] !== binding[field]) throw new Error('Original restore receipt identity changed');
    }
    if (receipt['parentStatus'] !== 'current') throw new Error('Original has a retired library owner');
    return receipt;
  }

  private checkParent(status: JsonObject, journal: Journal): void {
    if (status['operationId'] !== journal.operationId || status['packageSha256'] !== journal.packageSha256) {
      throw new Error('Restore receipt identity changed');
    }
  }

  private async openPending(work: string, passphrase: string, bundleSha256: string): Promise<Archive> {
    const path = this.packagePath();
    if (await recoveryHashFile(path) !== bundleSha256) this.reject();
    await recoveryReserve(this.directory, 2 * (await fileIo.stat(path)).size + MAX_ORIGINAL_BYTES);
    return this.open(path, work, passphrase, () => true);
  }

  private async open(path: string, work: string, passphrase: string, current: () => boolean): Promise<Archive> {
    const plaintext = `${work}/quarantine`;
    let completed = false;
    try {
      await openRecoveryFile(path, plaintext, passphrase, current);
      const archive = await recoveryWithFile(plaintext, fileIo.OpenMode.READ_ONLY, async (file): Promise<Archive> => {
        const prefix = await recoveryRead(file.fd, 4);
        const length = new DataView(prefix.buffer).getUint32(0);
        if (length === 0 || length > MAX_HEADER_BYTES) this.reject();
        let decoded: JsonObject;
        try { decoded = this.object(JSON.parse(recoveryText(await recoveryRead(file.fd, length)))); }
        catch (_) { return this.reject(); }
        const content = decoded['content'];
        const packageSha256 = decoded['packageSha256'];
        if (typeof content !== 'string' || typeof packageSha256 !== 'string') this.reject();
        const rows = this.decodeRows(decoded['rows'], false);
        const expected = await this.inspectCore(content, packageSha256, passphrase);
        if (expected.length !== rows.length) this.reject();
        for (let index = 0; index < rows.length; index++) {
          this.checkCurrent(current);
          const row = rows[index], exact = expected[index];
          if (row.bookId !== exact.bookId || JSON.stringify(row.original) !== JSON.stringify(exact.original)) this.reject();
          if (!row.included || row.original === null) continue;
          const original = row.original;
          await recoveryOutput(this.originalPath(work, index, original), async (emit): Promise<void> => {
            if (await recoveryCopyBytes(file.fd, original.byteLength, emit, current) !== original.sha256) this.reject();
          });
        }
        if ((await fileIo.read(file.fd, new ArrayBuffer(1))) !== 0) this.reject();
        return { packageSha256, content, rows };
      });
      completed = true;
      return archive;
    } finally {
      try { await fileIo.unlink(plaintext); }
      catch (error) {
        // perform still reclaims the private work directory. Preserve the
        // actual archive failure when plaintext cleanup also fails.
        if (completed && !this.isMissingFile(error)) throw error;
      }
    }
  }

  private async inspectCore(content: string, packageSha256: string, passphrase: string): Promise<Row[]> {
    if (!HASH.test(packageSha256)) this.reject();
    let preview: JsonObject;
    try {
      preview = await this.request('library.package.inspect', { content, password: passphrase, includeLocalOriginals: true });
    } catch (_) { return this.reject(); }
    if (preview['packageSha256'] !== packageSha256 || preview['scope'] !== 'coreLibraryMetadata') this.reject();
    return this.decodeRows(preview['localOriginals'], true);
  }

  private async captureForExport(passphrase: string): Promise<Archive> {
    if (this.exportPort !== undefined) {
      const captured = await this.exportPort.capture(passphrase);
      if (!HASH.test(captured.packageSha256) || typeof captured.content !== 'string') this.reject();
      return { content: captured.content, packageSha256: captured.packageSha256,
        rows: this.decodeRows(captured.localOriginals, true) };
    }
    const exported = await this.request('library.package.export', { password: passphrase });
    const content = exported['content'], packageSha256 = exported['packageSha256'];
    if (typeof content !== 'string' || typeof packageSha256 !== 'string') return this.reject();
    const rows = await this.inspectCore(content, packageSha256, passphrase);
    return { content, packageSha256, rows };
  }

  private decodeRows(raw: unknown, fromCore: boolean): Row[] {
    if (!Array.isArray(raw) || raw.length > MAX_ORIGINALS) return this.reject();
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const value of raw) {
      const data = this.object(value);
      const bookId = data['bookId'];
      if (typeof bookId !== 'string' || bookId.length === 0 || bookId.length > 4096 || seen.has(bookId)) this.reject();
      seen.add(bookId);
      const included = !fromCore && data['included'] === true;
      if (!fromCore && typeof data['included'] !== 'boolean') this.reject();
      let original: Original | null = null;
      if (data['original'] !== null) {
        const descriptor = this.object(data['original']);
        const sha256 = descriptor['sha256'], byteLength = descriptor['byteLength'], sourceFormat = descriptor['sourceFormat'];
        if (typeof sha256 !== 'string' || !HASH.test(sha256) || typeof byteLength !== 'number' ||
          !Number.isSafeInteger(byteLength) || byteLength <= 0 || typeof sourceFormat !== 'string' ||
          !/^[a-z0-9-]{1,16}$/.test(sourceFormat)) this.reject();
        original = { sha256, byteLength, sourceFormat };
      }
      if (included && (original === null || !this.canMaterialize(original))) this.reject();
      rows.push({ bookId, original, included });
    }
    return rows;
  }

  private canMaterialize(original: Original): boolean {
    return original.byteLength <= MAX_ORIGINAL_BYTES && isReaderLocalBookFileName(`book.${original.sourceFormat}`);
  }

  private originalPath(work: string, index: number, original: Original): string {
    return `${work}/book-${index}.${original.sourceFormat}`;
  }

  private async perform(passphrase: string, action: (work: string) => Promise<LocalRecoveryOutcome>): Promise<LocalRecoveryOutcome> {
    const bytes = recoveryUtf8(passphrase).length;
    if (bytes === 0 || bytes > 1024) return { state: 'rejected' };
    if (LocalRecoveryGateway.active.has(this.directory)) return { state: 'failed' };
    LocalRecoveryGateway.active.add(this.directory);
    let work: string | undefined;
    try {
      if (!(await fileIo.access(this.directory))) await fileIo.mkdir(this.directory, true);
      // Any prior process died before removing these private staging bytes.
      for (const entry of await fileIo.listFile(this.directory)) {
        if (/^work-[a-zA-Z0-9]+$/.test(entry)) await this.removeWorkIfPresent(`${this.directory}/${entry}`);
      }
      work = await fileIo.mkdtemp(`${this.directory}/work-XXXXXX`);
      return await action(work);
    } catch (error) {
      if (error instanceof LocalRecoveryFileError) return { state: error.reason };
      return { state: await this.pending().catch(() => true) ? 'interrupted' : 'failed' };
    } finally {
      if (work !== undefined) await this.removeWorkIfPresent(work).catch(() => {});
      LocalRecoveryGateway.active.delete(this.directory);
    }
  }

  private async removeWorkIfPresent(path: string): Promise<void> {
    try { await fileIo.rmdir(path); }
    catch (error) { if (!this.isMissingFile(error)) throw error; }
  }

  private isMissingFile(error: unknown): boolean {
    const code = (error as { code?: number | string } | undefined)?.code;
    return code === 13900002 || code === 'ENOENT';
  }

  private async readJournal(): Promise<Journal | undefined> {
    if (!(await this.pending())) return undefined;
    const path = this.journalPath();
    if ((await fileIo.stat(path)).size > 2048) throw new Error('Recovery journal exceeds its limit');
    const journal = JSON.parse(await fileIo.readText(path)) as Journal;
    if (journal.schemaVersion !== 1 || !/^quarantined-v1-[a-f0-9-]{36}$/.test(journal.operationId) ||
      (journal.origin !== undefined && (journal.origin !== 'system' ||
        journal.operationId !== systemRecoveryOperationId(journal.bundleSha256))) ||
      (journal.rollbackRequested !== undefined && journal.rollbackRequested !== true) ||
      !HASH.test(journal.packageSha256) || !HASH.test(journal.bundleSha256) ||
      !HASH.test(journal.rollbackSha256) || (journal.rollbackKind !== 'portable' &&
        (journal.rollbackKind !== 'physical' || typeof journal.rollbackId !== 'string' ||
          !/^[a-f0-9]{32}$/.test(journal.rollbackId)))) {
      throw new Error('Recovery journal identity is invalid');
    }
    return journal;
  }

  private async syncDirectory(): Promise<void> {
    await recoveryWithFile(this.directory, fileIo.OpenMode.READ_ONLY, (dir): Promise<void> => fileIo.fsync(dir.fd));
  }

  private async clearUnaccepted(): Promise<void> {
    if (await this.pending()) return;
    const path = this.packagePath();
    if (!(await fileIo.access(path))) return;
    // Persist the journal's absence before deleting the archive it needs
    // if an interrupted directory update is replayed after a crash.
    await this.syncDirectory();
    try { await fileIo.unlink(path); }
    catch (error) { if (!this.isMissingFile(error)) throw error; }
  }

  private request(method: string, params: JsonObject): Promise<JsonObject> {
    return this.requireRuntime().request(method, params, { timeoutMs: TIMEOUT }).then((result) => result.data);
  }

  private requireRuntime(): ReaderRuntimeOwner {
    if (this.runtime === undefined) throw new Error('A read-only recovery owner cannot write application storage');
    return this.runtime;
  }

  private outcome(state: 'exported' | 'preview' | 'restored', rows: Row[]): LocalRecoveryOutcome {
    const included = rows.filter((row) => row.included).length;
    return { state, included, missing: rows.length - included };
  }

  private object(value: unknown): JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) this.reject();
    return value as JsonObject;
  }

  private reject(): never { throw new LocalRecoveryFileError('rejected'); }

  private checkCurrent(current: () => boolean): void {
    if (!current()) throw new LocalRecoveryFileError('cancelled');
  }

  private packagePath(): string { return `${this.directory}/pending.readerbackup`; }
  private journalPath(): string { return `${this.directory}/restore.json`; }
  private rollbackPath(): string { return `${this.directory}/rollback.metadata`; }
}
