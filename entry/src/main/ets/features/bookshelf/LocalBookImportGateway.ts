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
  private transactionSequence: number = 0;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    return this.runtimeOwner.selectLocalBookInputs();
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
    let shelfParams: JsonObject | undefined = undefined;
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
      shelfParams = this.shelfAddParams(persisted);
      assetCommit = await this.runtimeOwner.commitLocalBookInput(selection.input);
      shelfAddStarted = true;
      await this.runtimeOwner.request('bookshelf.add', shelfParams);
      await this.finalizeCommittedImport(rollbackToken);
      return { fileName: selection.input.fileName, state: 'success' };
    } catch (error) {
      const message = errorMessageOf(error);
      // A missing persist reply cannot establish that Core did not commit.
      // Preserve completed EPUB resources until restart/reconciliation.
      // A structured deterministic Core rejection is different: import.persist
      // validates before its first storage mutation, so its staged input can
      // be discarded immediately instead of leaking a recovery orphan.
      let recoveryPending = persistenceStarted && rollbackToken === undefined &&
        !this.isDeterministicCoreRejection(error);
      // Only reconcile when the mutation outcome could have been lost.  A
      // deterministic Core rejection (for example INVALID_PARAMS) proves
      // that bookshelf.add did not commit; querying an old row for the same
      // identity in that case could turn a failed import into a false
      // success and leave the old row pointing at rolled-back content.
      if (shelfAddStarted && shelfParams !== undefined && this.isShelfMutationOutcomeUnknown(error)) {
        const shelfState = await this.reconcileShelfAdd(shelfParams);
        if (shelfState === 'committed') {
          // The write committed and only its response was lost. Report the
          // durable truth instead of compensating a successful import. The
          // same opaque token also consumes any large Core compensation
          // journal now that both the asset and shelf reference are durable.
          if (rollbackToken !== undefined) {
            await this.finalizeCommittedImport(rollbackToken);
          }
          return { fileName: selection.input.fileName, state: 'success' };
        }
        if (shelfState === 'unknown') {
          // Never roll body/assets back while a shelf reference may exist.
          recoveryPending = true;
        }
      }
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

  private async reconcileShelfAdd(params: JsonObject): Promise<'committed' | 'absent' | 'unknown'> {
    const sourceId = this.requiredString(params, 'sourceId');
    const bookId = this.requiredString(params, 'bookId');
    try {
      const result = await this.runtimeOwner.request('bookshelf.get', { sourceId, bookId });
      const rawBook = result.data['book'];
      if (rawBook === null || rawBook === undefined) {
        return 'absent';
      }
      const book = this.requiredObject(result.data, 'book');
      return book['sourceId'] === sourceId && book['bookId'] === bookId ? 'committed' : 'unknown';
    } catch (_) {
      return 'unknown';
    }
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

  private shelfAddParams(result: ReaderCoreResultEvent): JsonObject {
    const persisted = this.requiredObject(result.data, 'persisted');
    if (persisted['kind'] !== 'localBook') {
      throw new Error('import.persist returned a non-local-book result');
    }
    const importData = this.requiredObject(persisted, 'data');
    const book = this.requiredObject(importData, 'book');
    const params: JsonObject = {
      sourceId: 'local',
      bookId: this.requiredString(book, 'bookId'),
      title: this.requiredString(book, 'title'),
      author: this.requiredString(book, 'author'),
    };
    this.copyOptionalString(book, params, 'coverUrl');
    this.copyOptionalString(book, params, 'intro');
    this.copyOptionalString(book, params, 'kind');
    this.copyOptionalString(book, params, 'lastChapter');
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

  private copyOptionalString(from: JsonObject, to: JsonObject, key: string): void {
    const candidate = from[key];
    if (candidate === undefined || candidate === null) {
      return;
    }
    if (typeof candidate !== 'string') {
      throw new Error(`Core result has invalid ${key}`);
    }
    to[key] = candidate;
  }

  private nextTransactionId(bookId: string): string {
    this.transactionSequence += 1;
    return `local-import-${Date.now()}-${this.transactionSequence}-${bookId}`;
  }
}
