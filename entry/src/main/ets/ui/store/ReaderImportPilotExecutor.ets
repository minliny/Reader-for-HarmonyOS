// Correlation-scoped executor for the opt-in Reader-UI `import` Pilot.
//
// ReaderUIRuntime owns only the effect emission boundary. This file owns the
// one-to-one execution of its single next Core effect and retains parsed book
// context until that correlation has completed or been cancelled. It handles
// the three Core commands declared by runtime-actions.json:
//   import.start  → import.parse   (local_book.parse / source-package parse)
//   import.apply  → import.persist  (local_book.import + bookshelf.add)
//   import.cancel → import.rollback (clear pending import state)
import {
  type ReaderUIEffect,
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIState,
  validateReaderUITypedResult,
} from 'reader_ui_runtime';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import type { LocalBookParseOptions } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ReaderUiState,
  UiEvent,
} from './ReaderUiState';

/** Narrow structural view of a cancellable Core command handle for import. */
export interface ReaderImportCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

/**
 * Simple promise-wrapping handle. The existing CoreRuntime async methods
 * (localBookParse, localBookImport, bookshelfAdd) do not expose a cancellable
 * CoreCommandHandle; this wrapper sets an internal flag so late results are
 * ignored by the executor after cancellation.
 */
export class ReaderImportDeferredHandle implements ReaderImportCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  private cancelled: boolean = false;

  constructor(requestId: number, result: Promise<JsonObject>) {
    this.requestId = requestId;
    this.result = result;
  }

  cancel(): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    return true;
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }
}

/** Testable seam for exactly the Core commands used by an import sequence. */
export interface ReaderImportCoreGateway {
  beginImportParse(bookId: string, options: JsonObject): ReaderImportCommandHandle;
  beginImportPersist(bookId: string, options: JsonObject): ReaderImportCommandHandle;
  beginImportRollback(bookId: string): ReaderImportCommandHandle;
}

/** Production gateway. It is created lazily so Shadow mode never needs Core. */
export class CoreRuntimeImportGateway implements ReaderImportCoreGateway {
  private nextRequestId: number = 1;

  beginImportParse(bookId: string, options: JsonObject): ReaderImportCommandHandle {
    const runtime = CoreRuntime.get();
    const request = runtime.localBookParse(bookId, options as Object as LocalBookParseOptions);
    const handle = new ReaderImportDeferredHandle(this.nextRequestId, request);
    this.nextRequestId += 1;
    return handle;
  }

  beginImportPersist(bookId: string, options: JsonObject): ReaderImportCommandHandle {
    const runtime = CoreRuntime.get();
    const importPromise = runtime.localBookImport(bookId, options as Object as LocalBookParseOptions);
    // Persist chains local_book.import → bookshelf.add. The executor consumes
    // the materialized book from local_book.import and calls bookshelfAdd.
    const chained = importPromise.then((data: JsonObject): Promise<JsonObject> => {
      const fields = data as Object as Record<string, Object>;
      const bookValue: Object = fields['book'];
      if (bookValue === null || typeof bookValue !== 'object' || Array.isArray(bookValue)) {
        throw new Error('Core local_book.import 未返回有效 book');
      }
      const book = bookValue as Object as JsonObject;
      book['sourceId'] = 'local';
      return runtime.bookshelfAdd(book).then((): JsonObject => data);
    });
    const handle = new ReaderImportDeferredHandle(this.nextRequestId, chained);
    this.nextRequestId += 1;
    return handle;
  }

  beginImportRollback(_bookId: string): ReaderImportCommandHandle {
    // Rollback is a host-side state clear; no Core command is required. Return
    // a resolved handle so the executor follows the same completion path.
    const handle = new ReaderImportDeferredHandle(
      this.nextRequestId,
      Promise.resolve({} as JsonObject),
    );
    this.nextRequestId += 1;
    return handle;
  }
}

/** Adapter over ReaderUIRuntime's state observation. The import Pilot does not
  * use a runtime transaction (emitEffects has no acceptResult callback), so
  * the runtime gateway only reads state for the host projection. */
export interface ReaderImportRuntimeGateway {
  currentState(): ReaderUIState;
}

/** Store-owned projection seam. Domain events bypass ReaderEffects by design. */
export interface ReaderImportPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  applyDomainEvent(event: UiEvent): void;
}

export interface ReaderImportPilotContext {
  correlationId: string;
  bookId: string;
  origin: string;
  format: string;
  bytesBase64: string;
  text: string;
  fileName: string;
  importCount: number;
  inFlight?: ReaderImportCommandHandle;
  currentEffect?: string;
  parsedBook?: JsonObject;
}

export interface ReaderImportPilotSnapshot {
  activeCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateResults: number;
  cancelledCommands: number;
}

/**
 * One executor instance is created by the Store-owned rollout coordinator.
 * It accepts at most one active correlation because ReaderUIRuntime serializes
 * import.start/apply/cancel and returns superseded correlation ids explicitly.
 */
export class ReaderImportEffectExecutor {
  private readonly core: ReaderImportCoreGateway;
  private readonly runtime: ReaderImportRuntimeGateway;
  private readonly host: ReaderImportPilotHost;
  private active: ReaderImportPilotContext | null = null;
  private executedEffects: number = 0;
  private ignoredLateResults: number = 0;
  private cancelledCommands: number = 0;

  constructor(runtime: ReaderImportRuntimeGateway, host: ReaderImportPilotHost,
    core: ReaderImportCoreGateway = new CoreRuntimeImportGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
  }

  start(correlationId: string, payload: ReaderUIJSONPayload, effect: ReaderUIEffect): void {
    if (effect.correlationId !== correlationId) {
      throw new Error('import effect correlation does not match the runtime transaction');
    }
    if (this.active !== null) {
      throw new Error(`import executor already owns ${this.active.correlationId}`);
    }
    const context = this.createContext(correlationId, payload, effect.type);
    this.active = context;
    this.host.applyRuntimeState(this.runtime.currentState());
    this.execute(context, effect);
  }

  cancel(correlationId: string): boolean {
    const context = this.active;
    if (context === null || context.correlationId !== correlationId) return false;
    const handle = context.inFlight;
    if (handle !== undefined && handle.cancel()) {
      this.cancelledCommands += 1;
    }
    context.inFlight = undefined;
    context.currentEffect = undefined;
    this.active = null;
    return true;
  }

  hasActiveCorrelation(): boolean {
    return this.active !== null;
  }

  activeCorrelationId(): string {
    return this.active?.correlationId ?? '';
  }

  snapshot(): ReaderImportPilotSnapshot {
    return {
      activeCorrelationId: this.active?.correlationId ?? '',
      activeRequestId: this.active?.inFlight?.requestId ?? 0,
      executedEffects: this.executedEffects,
      ignoredLateResults: this.ignoredLateResults,
      cancelledCommands: this.cancelledCommands,
    };
  }

  private createContext(correlationId: string, payload: ReaderUIJSONPayload,
    effectType: string): ReaderImportPilotContext {
    const input = this.importInput(payload, effectType);
    const journal = this.importRollbackJournal(payload);
    const bookId = this.payloadString(input ?? journal ?? {}, 'bookId');
    const origin = 'ReaderUIRuntime';
    const format = this.payloadString(input ?? {}, 'format', 'txt');
    const bytesBase64 = this.payloadString(input ?? {}, 'bytesBase64');
    const text = this.payloadString(input ?? {}, 'text');
    const fileName = this.payloadString(input ?? {}, 'fileName');
    const importCount = 0;
    if (bookId.length === 0) {
      throw new Error('import Pilot requires non-empty bookId');
    }
    if (effectType !== 'import.rollback' && bytesBase64.length === 0 && text.length === 0) {
      throw new Error('import Pilot requires non-empty bytesBase64 or text');
    }
    return {
      correlationId: correlationId,
      bookId: bookId,
      origin: origin,
      format: format,
      bytesBase64: bytesBase64,
      text: text,
      fileName: fileName,
      importCount: Number.isFinite(importCount) ? importCount : 0,
    };
  }

  private execute(context: ReaderImportPilotContext, effect: ReaderUIEffect): void {
    if (!this.isActive(context) || effect.correlationId !== context.correlationId) {
      this.ignoredLateResults += 1;
      return;
    }
    if (context.inFlight !== undefined) {
      throw new Error(`import ${context.correlationId} attempted concurrent Core effect execution`);
    }
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'import.parse':
        this.executeParse(context);
        return;
      case 'import.persist':
        this.executePersist(context);
        return;
      case 'import.rollback':
        this.executeRollback(context);
        return;
      default:
        this.fail(context, effect.type, new Error(`unsupported import Core effect ${effect.type}`));
    }
  }

  private executeParse(context: ReaderImportPilotContext): void {
    try {
      const options: JsonObject = {};
      options['fileName'] = context.fileName;
      options['format'] = context.format;
      if (context.bytesBase64.length > 0) {
        options['bytesBase64'] = context.bytesBase64;
      } else if (context.text.length > 0) {
        options['text'] = context.text;
      }
      const handle = this.core.beginImportParse(context.bookId, options);
      this.attachHandle(context, 'import.parse', handle);
    } catch (error) {
      this.fail(context, 'import.parse', error as Error);
    }
  }

  private executePersist(context: ReaderImportPilotContext): void {
    try {
      if (context.parsedBook === undefined && context.bytesBase64.length === 0 && context.text.length === 0) {
        throw new Error('import.persist requires a prior import.parse or raw bytes');
      }
      const options: JsonObject = {};
      options['fileName'] = context.fileName;
      options['format'] = context.format;
      if (context.bytesBase64.length > 0) {
        options['bytesBase64'] = context.bytesBase64;
      } else if (context.text.length > 0) {
        options['text'] = context.text;
      }
      const handle = this.core.beginImportPersist(context.bookId, options);
      this.attachHandle(context, 'import.persist', handle);
    } catch (error) {
      this.fail(context, 'import.persist', error as Error);
    }
  }

  private executeRollback(context: ReaderImportPilotContext): void {
    try {
      const handle = this.core.beginImportRollback(context.bookId);
      this.attachHandle(context, 'import.rollback', handle);
    } catch (error) {
      this.fail(context, 'import.rollback', error as Error);
    }
  }

  private attachHandle(context: ReaderImportPilotContext, stage: string,
    handle: ReaderImportCommandHandle): void {
    if (!this.isActive(context)) {
      handle.cancel();
      this.ignoredLateResults += 1;
      return;
    }
    context.currentEffect = stage;
    context.inFlight = handle;
    this.executedEffects += 1;
    handle.result.then((data: JsonObject): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.acceptCoreData(context, stage, data);
    }).catch((error: Error): void => {
      if (!this.isActive(context) || context.inFlight !== handle) {
        this.ignoredLateResults += 1;
        return;
      }
      context.inFlight = undefined;
      this.fail(context, stage, error);
    });
  }

  private acceptCoreData(context: ReaderImportPilotContext, stage: string, data: JsonObject): void {
    try {
      validateReaderUITypedResult(
        stage === 'import.parse' ? 'import.start' :
          (stage === 'import.persist' ? 'import.apply' : 'import.cancel'),
        stage,
        data as Object as ReaderUIJSONResult,
      );
      switch (stage) {
        case 'import.parse': {
          const fields = data as Object as Record<string, Object>;
          const parsedBookValue: Object = fields['book'];
          if (parsedBookValue === null || typeof parsedBookValue !== 'object' ||
            Array.isArray(parsedBookValue)) {
            throw new Error('Core local_book.parse 未返回有效 book');
          }
          const parsedBook = parsedBookValue as Object as JsonObject;
          parsedBook['sourceId'] = 'local';
          context.parsedBook = parsedBook;
          const chapterCount = this.readNumber(data, 'chapterCount', 0);
          const parsedFormat = this.readString(data, 'format', context.format);
          const parsedEncoding = this.readString(data, 'encoding', '');
          this.host.applyDomainEvent({
            type: 'source.import.preview',
            importFormat: parsedFormat,
            importEncoding: parsedEncoding,
            importCount: chapterCount,
            localImportEpoch: 0,
          });
          this.complete(context);
          return;
        }
        case 'import.persist': {
          this.host.applyDomainEvent({
            type: 'source-import-committed',
            importCount: context.importCount,
          });
          this.complete(context);
          return;
        }
        case 'import.rollback': {
          this.host.applyDomainEvent({
            type: 'set-error',
            error: {
              code: 'IMPORT_CANCELLED',
              message: '导入已取消。',
              retryable: false,
            },
          });
          this.complete(context);
          return;
        }
        default:
          this.fail(context, stage, new Error(`unsupported accepted import stage ${stage}`));
      }
    } catch (error) {
      this.fail(context, stage, error as Error);
    }
  }

  private complete(context: ReaderImportPilotContext): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    this.active = null;
  }

  private fail(context: ReaderImportPilotContext, stage: string, error: Error): void {
    if (!this.isActive(context)) {
      this.ignoredLateResults += 1;
      return;
    }
    const message = error.message.length > 0 ? error.message : `import ${stage} failed`;
    this.host.applyDomainEvent({
      type: 'set-error',
      error: {
        code: 'IMPORT_PILOT_FAILED',
        message: message,
        retryable: true,
      },
    });
    this.active = null;
  }

  private isActive(context: ReaderImportPilotContext): boolean {
    return this.active !== null && this.active.correlationId === context.correlationId && this.active === context;
  }

  private readString(data: JsonObject, key: string, defaultValue: string): string {
    const fields = data as Object as Record<string, string>;
    const v: string = fields[key];
    return typeof v === 'string' ? v : defaultValue;
  }

  private readNumber(data: JsonObject, key: string, defaultValue: number): number {
    const fields = data as Object as Record<string, number>;
    const v: number = fields[key];
    return typeof v === 'number' ? v : defaultValue;
  }

  private payloadString(payload: ReaderUIJSONPayload, key: string,
    defaultValue: string = ''): string {
    const value = payload[key];
    return typeof value === 'string' ? value : defaultValue;
  }

  private payloadObject(payload: ReaderUIJSONPayload, key: string): ReaderUIJSONPayload | undefined {
    const value = payload[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Object as ReaderUIJSONPayload;
    }
    return undefined;
  }

  private importInput(payload: ReaderUIJSONPayload,
    effectType: string): ReaderUIJSONPayload | undefined {
    if (effectType === 'import.parse') return this.payloadObject(payload, 'input');
    if (effectType === 'import.persist') {
      const parsed = this.payloadObject(payload, 'parsed');
      const preview = parsed === undefined ? undefined : this.payloadObject(parsed, 'preview');
      return preview === undefined ? undefined : this.payloadObject(preview, 'input');
    }
    return undefined;
  }

  private importRollbackJournal(payload: ReaderUIJSONPayload): ReaderUIJSONPayload | undefined {
    const rollbackToken = this.payloadObject(payload, 'rollbackToken');
    const token = rollbackToken === undefined ? undefined : this.payloadObject(rollbackToken, 'token');
    return token === undefined ? undefined : this.payloadObject(token, 'journal');
  }
}
