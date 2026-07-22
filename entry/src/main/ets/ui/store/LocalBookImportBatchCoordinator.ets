// LocalBookImportBatchCoordinator — isolated, non-visual multi-file local
// import execution. It intentionally owns neither routes nor ArkUI state.
//
// The coordinator uses the already-frozen Host format boundary and Core's
// materializing `local_book.import` command. It reads original file bytes,
// sends them as base64 (so Core keeps encoding detection ownership), then adds
// the Core-returned book to the bookshelf. A batch is serial by design: the
// next file does not start until the previous file has either completed or
// failed. One failed file never prevents the rest of the selected files from
// being attempted.
//
// CoreRuntime currently exposes Promise-based localBookImport rather than a
// cancellable command handle. Cancellation therefore cannot retract a Core
// import already in flight; it prevents later file work and guards every
// subsequent host-visible side effect/result with the batch epoch.
import fs from '@ohos.file.fs';
import util from '@ohos.util';
import { CoreRuntime, type LocalBookParseOptions } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import { LocalBookFormatPolicy } from '../../host/LocalBookFormatPolicy';
import type { ReaderSelectedFile } from '../../host/adapters/FileSelectionHostAdapter';

export type LocalBookImportBatchFileStatus = 'success' | 'failure';

/** Minimal result projection for the confirmed in-place import dialog. */
export interface LocalBookImportBatchFileResult {
  fileName: string;
  status: LocalBookImportBatchFileStatus;
}

/** Batch-level lifecycle result. Stale batches are not UI results. */
export interface LocalBookImportBatchResult {
  epoch: number;
  cancelled: boolean;
  stale: boolean;
  results: LocalBookImportBatchFileResult[];
}

/** Reads the exact selected bytes; this boundary keeps picker I/O testable. */
export interface LocalBookImportBatchFileReader {
  readBase64(file: ReaderSelectedFile): Promise<string>;
}

/**
 * Existing Core operations used by the batch. They are deliberately split so
 * the coordinator can check its epoch after Core materializes a book and
 * before it makes the book visible through `bookshelf.add`.
 */
export interface LocalBookImportBatchCoreGateway {
  materialize(bookId: string, options: LocalBookParseOptions): Promise<JsonObject>;
  addToBookshelf(book: JsonObject): Promise<void>;
}

export type LocalBookImportBatchIdFactory = (epoch: number, fileIndex: number) => string;

/** Platform reader for paths returned by FileSelectionHostAdapter. */
export class HarmonyLocalBookImportBatchFileReader implements LocalBookImportBatchFileReader {
  async readBase64(file: ReaderSelectedFile): Promise<string> {
    const opened = fs.openSync(file.path, fs.OpenMode.READ_ONLY);
    try {
      const stat = fs.statSync(opened.fd);
      const size = stat.size;
      if (!Number.isSafeInteger(size) || size <= 0) {
        throw new Error('selected local book is empty');
      }
      const buffer = new ArrayBuffer(size);
      const bytesRead = fs.readSync(opened.fd, buffer);
      if (!Number.isSafeInteger(bytesRead) || bytesRead <= 0) {
        throw new Error('selected local book produced no bytes');
      }
      const bytes = new Uint8Array(buffer, 0, bytesRead);
      return new util.Base64Helper().encodeToStringSync(bytes);
    } finally {
      fs.closeSync(opened);
    }
  }
}

/** Production bridge for the existing local-book Core contracts. */
export class CoreRuntimeLocalBookImportBatchGateway implements LocalBookImportBatchCoreGateway {
  materialize(bookId: string, options: LocalBookParseOptions): Promise<JsonObject> {
    return CoreRuntime.get().localBookImport(bookId, options);
  }

  addToBookshelf(book: JsonObject): Promise<void> {
    return CoreRuntime.get().bookshelfAdd(book).then((): void => {});
  }
}

/**
 * Isolated multi-file import coordinator. UI/reducer integration is left to a
 * later, explicit action-flow task; callers only receive minimal results.
 */
export class LocalBookImportBatchCoordinator {
  private readonly fileReader: LocalBookImportBatchFileReader;
  private readonly core: LocalBookImportBatchCoreGateway;
  private readonly idFactory: LocalBookImportBatchIdFactory;
  private nextEpoch: number = 0;
  private activeEpoch: number = 0;
  private cancelledEpochs: number[] = [];

  constructor(
    fileReader: LocalBookImportBatchFileReader,
    core: LocalBookImportBatchCoreGateway = new CoreRuntimeLocalBookImportBatchGateway(),
    idFactory: LocalBookImportBatchIdFactory = LocalBookImportBatchCoordinator.defaultBookId,
  ) {
    this.fileReader = fileReader;
    this.core = core;
    this.idFactory = idFactory;
  }

  /** Start a new batch. A new epoch supersedes any prior in-flight batch. */
  async start(files: ReaderSelectedFile[]): Promise<LocalBookImportBatchResult> {
    const epoch = this.nextEpoch + 1;
    this.nextEpoch = epoch;
    this.activeEpoch = epoch;
    const results: LocalBookImportBatchFileResult[] = [];

    for (let index = 0; index < files.length; index += 1) {
      if (!this.isCurrent(epoch)) break;
      const file = files[index];
      const decision = LocalBookFormatPolicy.decide(file.name);
      // Existing Host policy is the capability boundary. In particular, PDF,
      // MOBI and UMD are recognized but must not be routed into TXT/EPUB Core
      // import until their dedicated host protocols are frozen.
      if (decision.admission !== 'core-import') {
        results.push({ fileName: file.name, status: 'failure' });
        continue;
      }

      try {
        const bytesBase64 = await this.fileReader.readBase64(file);
        if (!this.isCurrent(epoch)) break;
        if (bytesBase64.trim().length === 0) {
          results.push({ fileName: file.name, status: 'failure' });
          continue;
        }

        const options: LocalBookParseOptions = {
          fileName: file.name,
          format: decision.format,
          bytesBase64: bytesBase64,
        };
        const bookId = this.idFactory(epoch, index);
        if (bookId.trim().length === 0) throw new Error('local book id factory returned an empty id');

        const materialized = await this.core.materialize(bookId, options);
        if (!this.isCurrent(epoch)) break;
        const book = LocalBookImportBatchCoordinator.materializedBook(materialized);
        await this.core.addToBookshelf(book);
        if (!this.isCurrent(epoch)) break;
        results.push({ fileName: file.name, status: 'success' });
      } catch (_error) {
        // The confirmed result dialog displays only filename + outcome. It
        // intentionally does not manufacture a user-facing error taxonomy.
        if (!this.isCurrent(epoch)) break;
        results.push({ fileName: file.name, status: 'failure' });
      }
    }

    return this.finish(epoch, results);
  }

  /** Prevent later files and late callbacks from affecting the active batch. */
  cancel(): boolean {
    if (this.activeEpoch === 0) return false;
    this.cancelledEpochs.push(this.activeEpoch);
    this.activeEpoch = 0;
    return true;
  }

  currentEpoch(): number {
    return this.activeEpoch;
  }

  private finish(epoch: number, results: LocalBookImportBatchFileResult[]): LocalBookImportBatchResult {
    const cancelledIndex = this.cancelledEpochs.indexOf(epoch);
    const cancelled = cancelledIndex >= 0;
    // Cancellation is a one-batch fact. Consume it once the corresponding
    // async run observes the epoch so this bounded coordinator never retains
    // an unbounded cancellation history.
    if (cancelled) this.cancelledEpochs.splice(cancelledIndex, 1);
    const stale = !cancelled && this.activeEpoch !== epoch;
    if (this.activeEpoch === epoch) this.activeEpoch = 0;
    return {
      epoch: epoch,
      cancelled: cancelled,
      stale: stale,
      results: results,
    };
  }

  private isCurrent(epoch: number): boolean {
    return this.activeEpoch === epoch;
  }

  private static defaultBookId(epoch: number, fileIndex: number): string {
    return `local-${Date.now()}-${epoch}-${fileIndex}`;
  }

  private static materializedBook(data: JsonObject): JsonObject {
    const fields = data as Object as Record<string, Object>;
    const value: Object = fields['book'];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Core local_book.import did not return a materialized book');
    }
    const book = value as Object as JsonObject;
    // `bookshelf.add` requires the local source identity. The Core materialized
    // book is otherwise passed through unchanged; title/author are never
    // synthesized from the file name here.
    book['sourceId'] = 'local';
    return book;
  }
}
