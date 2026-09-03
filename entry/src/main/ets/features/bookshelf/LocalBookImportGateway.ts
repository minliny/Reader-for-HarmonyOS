import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { hilog } from '@kit.PerformanceAnalysisKit';
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

  async importFromSystemPicker(): Promise<LocalImportBatch> {
    const selections = await this.runtimeOwner.selectLocalBookInputs();
    if (selections.length === 0) {
      return { state: 'cancelled', imported: 0, failed: 0, items: [] };
    }

    const items: LocalImportItem[] = [];
    let imported = 0;
    for (const selection of selections) {
      const item = await this.importPreparedSelection(selection);
      items.push(item);
      if (item.state === 'success') {
        imported += 1;
      }
    }
    return {
      state: 'completed',
      imported,
      failed: items.length - imported,
      items,
    };
  }

  private async importPreparedSelection(selection: LocalBookPreparation): Promise<LocalImportItem> {
    if (selection.state === 'failed') {
      return { fileName: selection.fileName, state: 'failed' };
    }

    let rollbackToken: JsonObject | undefined = undefined;
    let assetCommit: LocalBookAssetCommit | undefined = undefined;
    try {
      const parsed = await this.runtimeOwner.request('import.parse', {
        kind: 'localBook',
        input: this.localBookParseParams(selection.input),
      });
      const persisted = await this.runtimeOwner.request('import.persist', {
        transactionId: this.nextTransactionId(selection.input.bookId),
        parsed: parsed.data,
      });
      rollbackToken = this.requiredObject(persisted.data, 'rollbackToken');
      const shelfParams = this.shelfAddParams(persisted);
      assetCommit = await this.runtimeOwner.commitLocalBookInput(selection.input);
      await this.runtimeOwner.request('bookshelf.add', shelfParams);
      return { fileName: selection.input.fileName, state: 'success' };
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      // The supplied Figma result state has only a filename and binary
      // success/failure marker. Keep the real failure reason in diagnostic
      // logs rather than inventing a fourth visible status or copy.
      hilog.error(DOMAIN, 'Reader', 'Local import failed for %{public}s: %{public}s',
        selection.input.fileName, message);
      if (rollbackToken !== undefined) {
        try {
          await this.runtimeOwner.request('import.rollback', { rollbackToken });
        } catch (_) {
          // A failed rollback must not be presented as a successful import.
          // The designed result state only distinguishes success from failure.
        }
      }
      try {
        if (assetCommit !== undefined) {
          await this.runtimeOwner.rollbackLocalBookAsset(assetCommit);
        } else {
          await this.runtimeOwner.discardLocalBookInput(selection.input);
        }
      } catch (_) {
        // Keep the visible result failed. A later import with the same
        // content identity safely reuses or replaces the Host asset.
      }
      return { fileName: selection.input.fileName, state: 'failed' };
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
