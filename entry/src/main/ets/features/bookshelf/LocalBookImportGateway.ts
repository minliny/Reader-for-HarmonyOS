import { ReaderCoreGateway, type ShelfBookUpsert } from '../../app/ReaderCoreGateway';
import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../app/ErrorMessage';
import { localImportFailure, type LocalImportFailure } from '../../app/LocalImportFailure';
import type {
  LocalBookAssetCommit,
  LocalBookInput,
  LocalBookPreparation,
} from '../../app/ReaderHostRegistry';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

const DOMAIN = 0x5244;

export type LocalImportItem = {
  fileName: string;
  state: 'success' | 'failed';
  /** Only set from Core bookshelf.add's acknowledged created fact. */
  disposition?: 'created' | 'existing';
  failure?: LocalImportFailure;
};

export type LocalImportBatch = {
  state: 'cancelled' | 'completed';
  imported: number;
  failed: number;
  items: LocalImportItem[];
};

/**
 * Page-facing local-import boundary. It owns the Core command envelope and
 * turns a Host selection into plain import state; ArkUI never sees URIs,
 * file paths, rollback tokens, or Core result envelopes.
 */
export class LocalBookImportGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private readonly bookshelf: ReaderCoreGateway;
  private transactionSequence: number = 0;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
    this.bookshelf = new ReaderCoreGateway(runtimeOwner);
  }

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    return this.runtimeOwner.selectLocalBookInputs();
  }

  async releaseUnusedSelections(selections: LocalBookPreparation[]): Promise<void> {
    for (const selection of selections) {
      if (selection.state !== 'failed') await this.runtimeOwner.discardLocalBookInput(selection.input);
    }
  }

  async importPreparedSelections(selections: LocalBookPreparation[]): Promise<LocalImportBatch> {
    if (selections.length === 0) {
      return { state: 'cancelled', imported: 0, failed: 0, items: [] };
    }
    const items: LocalImportItem[] = [];
    let imported = 0;
    for (const selection of selections) {
      const item = await this.importPreparedSelection(selection);
      items.push(item);
      if (item.state === 'success') imported += 1;
    }
    return { state: 'completed', imported, failed: items.length - imported, items };
  }

  async importFromSystemPicker(): Promise<LocalImportBatch> {
    return this.importPreparedSelections(await this.selectLocalBookInputs());
  }

  private async importPreparedSelection(selection: LocalBookPreparation): Promise<LocalImportItem> {
    if (selection.state === 'failed') {
      return { fileName: selection.fileName, state: 'failed', failure: selection.failure ?? localImportFailure('read') };
    }

    let rollbackToken: JsonObject | undefined = undefined;
    let assetCommit: LocalBookAssetCommit | undefined = undefined;
    let persistenceStarted = false;
    let shelfAddStarted = false;
    try {
      const parsed = await this.runtimeOwner.request('import.parse', {
        kind: 'localBook',
        input: this.localBookParseParams(selection.input),
      });
      const preview = this.requiredObject(parsed.data, 'preview');
      const summary = this.requiredObject(preview, 'summary');
      const integrity = this.requiredObject(summary, 'integrity');
      if (integrity['schemaVersion'] !== 1 ||
        (integrity['readability'] !== 'complete' && integrity['readability'] !== 'recoverable')) {
        throw new Error('local_book_not_readable: incomplete content');
      }
      persistenceStarted = true;
      const persisted = await this.runtimeOwner.request('import.persist', {
        transactionId: this.nextTransactionId(selection.input.bookId),
        parsed: parsed.data,
      });
      rollbackToken = this.requiredObject(persisted.data, 'rollbackToken');
      const shelfParams = this.shelfAddParams(persisted);
      assetCommit = await this.runtimeOwner.commitLocalBookInput(selection.input);
      shelfAddStarted = true;
      // Reuse the existing full composite-key ACK decoder.
      const added = await this.bookshelf.upsertBook(shelfParams);
      await this.finalizeCommittedImport(rollbackToken);
      const item: LocalImportItem = { fileName: selection.input.fileName, state: 'success' };
      if (added.created === true) item.disposition = 'created';
      else if (added.created === false) item.disposition = 'existing';
      return item;
    } catch (error) {
      const message = errorMessageOf(error);
      // A missing persist reply cannot establish that Core did not commit.
      // Preserve completed EPUB resources until restart/reconciliation.
      // A structured deterministic Core rejection is different: import.persist
      // validates before its first storage mutation, so its staged input can
      // be discarded immediately instead of leaking a recovery orphan.
      let recoveryPending = persistenceStarted && rollbackToken === undefined &&
        !this.isDeterministicCoreRejection(error);
      // A matching later shelf row is readable state, not this operation's
      // ACK: the same metadata may predate the request. Keep the journal and
      // assets while a dispatched upsert has no authoritative terminal reply.
      if (shelfAddStarted && this.isShelfMutationOutcomeUnknown(error)) recoveryPending = true;
      hilog.error(DOMAIN, 'Reader', 'Local import failed: %{private}s', localImportFailure(message).code);
      if (!recoveryPending && rollbackToken !== undefined) {
        try {
          await this.runtimeOwner.request('import.rollback', { rollbackToken });
        } catch (_) {
          recoveryPending = true;
        }
      }
      try {
        if (recoveryPending) {
          // Preserve any committed asset still referenced by Core.
        } else if (assetCommit !== undefined) {
          await this.runtimeOwner.rollbackLocalBookAsset(assetCommit);
        } else {
          await this.runtimeOwner.discardLocalBookInput(selection.input);
        }
      } catch (_) {
        recoveryPending = true;
      }
      return { fileName: selection.input.fileName, state: 'failed', failure: localImportFailure(message, recoveryPending) };
    }
  }

  private async finalizeCommittedImport(rollbackToken: JsonObject): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.runtimeOwner.request('import.finalize', { rollbackToken });
        return true;
      } catch (error) {
        // Keep the opaque Core error out of logs; the bounded retry and queue
        // below are the only recovery state the Host needs to retain.
      }
    }
    // The shelf write is the durable commit point.  A cleanup/finalize
    // failure must remain observable for recovery, but must not turn an
    // already-readable book back into a failed import or trigger rollback.
    hilog.warn(DOMAIN, 'Reader', 'Local import finalize deferred after %{public}d attempts', 3);
    try {
      // Keep the opaque token in the app-private Host queue. The next Core
      // owner drains it before publishing a fresh runtime, so a process death
      // between shelf commit and cleanup cannot strand a large journal.
      await this.runtimeOwner.enqueuePendingLocalImportFinalize(rollbackToken);
    } catch (_) {
      // The readable shelf commit still wins. Do not roll it back merely
      // because the local cleanup queue itself was unavailable; the failure
      // remains visible through the warning above without exposing the token.
      hilog.error(DOMAIN, 'Reader', 'Local import finalize recovery queue unavailable');
    }
    return false;
  }

  private isShelfMutationOutcomeUnknown(error: unknown): boolean {
    // ReaderCoreRequestError carries the structured event, while transport
    // timeouts/cancellation and Host failures are ordinary Error instances.
    // Keep those latter cases conservative: the request may have reached Core
    // before its reply was lost, so the durable shelf state must be checked.
    if (typeof error !== 'object' || error === null) {
      return true;
    }
    const event = (error as { event?: unknown }).event;
    if (typeof event !== 'object' || event === null) {
      return true;
    }
    const structuredError = (event as { error?: unknown }).error;
    if (typeof structuredError !== 'object' || structuredError === null) {
      return true;
    }
    const code = (structuredError as { code?: unknown }).code;
    if (typeof code !== 'string') {
      return true;
    }
    switch (code) {
      // These errors are validated/rejected before bookshelf.add can commit.
      case 'UNKNOWN_METHOD':
      case 'INVALID_PARAMS':
      case 'INVALID_PROTOCOL_VERSION':
      case 'INVALID_MESSAGE':
        return false;
      default:
        return true;
    }
  }

  private isDeterministicCoreRejection(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const event = (error as { event?: unknown }).event;
    if (typeof event !== 'object' || event === null) {
      return false;
    }
    const structuredError = (event as { error?: unknown }).error;
    if (typeof structuredError !== 'object' || structuredError === null) {
      return false;
    }
    const code = (structuredError as { code?: unknown }).code;
    switch (code) {
      // These failures are rejected before import.persist commits any row or
      // returns a rollback token.
      case 'UNKNOWN_METHOD':
      case 'INVALID_PARAMS':
      case 'INVALID_PROTOCOL_VERSION':
      case 'INVALID_MESSAGE':
        return true;
      default:
        return false;
    }
  }

  private localBookParseParams(input: LocalBookInput): JsonObject {
    return {
      bookId: input.bookId,
      filePath: input.stagedPath,
      fileName: input.fileName,
    };
  }

  private shelfAddParams(result: ReaderCoreResultEvent): ShelfBookUpsert {
    const persisted = this.requiredObject(result.data, 'persisted');
    if (persisted['kind'] !== 'localBook') {
      throw new Error('import.persist returned a non-local-book result');
    }
    const importData = this.requiredObject(persisted, 'data');
    const book = this.requiredObject(importData, 'book');
    const params: ShelfBookUpsert = {
      sourceId: 'local',
      bookId: this.requiredString(book, 'bookId'),
      title: this.requiredString(book, 'title'),
      author: this.requiredString(book, 'author'),
    };
    params.coverUrl = this.optionalString(book, 'coverUrl');
    params.intro = this.optionalString(book, 'intro');
    params.kind = this.optionalString(book, 'kind');
    params.lastChapter = this.optionalString(book, 'lastChapter');
    return params;
  }

  private requiredObject(value: JsonObject, key: string): JsonObject {
    const candidate = value[key];
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      throw new Error(`Core result is missing object ${key}`);
    }
    return candidate as JsonObject;
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string') {
      throw new Error(`Core result is missing string ${key}`);
    }
    return candidate;
  }

  private optionalString(from: JsonObject, key: string): string | undefined {
    const candidate = from[key];
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`Core result has invalid ${key}`);
    }
    return candidate;
  }

  private nextTransactionId(bookId: string): string {
    this.transactionSequence += 1;
    return `local-import-${Date.now()}-${this.transactionSequence}-${bookId}`;
  }
}
