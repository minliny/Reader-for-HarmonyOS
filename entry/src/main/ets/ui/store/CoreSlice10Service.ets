// CoreSlice10Service — narrow HarmonyOS boundary for the cache/undo Core
// commands introduced by the Reader UI 3.0 contract.
//
// The service deliberately owns only transport validation and exact DTO
// forwarding. Cache lifecycle, queueing, clear scopes, undo-token integrity,
// expiry and optimistic concurrency remain Reader-Core-Native semantics.
import {
  type ReaderUIJSONPayload,
  type ReaderUIJSONResult,
  type ReaderUIJSONValue,
  validateReaderUITypedPayload,
  validateReaderUITypedResult,
} from 'reader_ui_runtime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import { CoreRuntime } from '../../bridge/CoreRuntime';

export interface CoreSlice10CommandDispatcher {
  execute(method: string, params: JsonObject, timeoutMs: number): Promise<JsonObject>;
}

export class CoreRuntimeSlice10CommandDispatcher implements CoreSlice10CommandDispatcher {
  execute(method: string, params: JsonObject, timeoutMs: number): Promise<JsonObject> {
    return CoreRuntime.get().executeCoreMethod(method, params, timeoutMs);
  }
}

export class CoreSlice10Service {
  private readonly dispatcher: CoreSlice10CommandDispatcher;

  constructor(dispatcher: CoreSlice10CommandDispatcher = new CoreRuntimeSlice10CommandDispatcher()) {
    this.dispatcher = dispatcher;
  }

  cacheBookStatus(payload: ReaderUIJSONPayload): Promise<JsonObject> {
    CoreSlice10Service.validatePayload('reader.bookCache.open', payload);
    const sourceId = CoreSlice10Service.requiredPayloadString(payload, 'sourceId', 'cache.book.status');
    const bookId = CoreSlice10Service.requiredPayloadString(payload, 'bookId', 'cache.book.status');
    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    return this.execute('cache.book.status', params, 15000);
  }

  cacheBookPrefetch(payload: ReaderUIJSONPayload): Promise<JsonObject> {
    CoreSlice10Service.validatePayload('download.task.retry', payload);
    const sourceId = CoreSlice10Service.requiredPayloadString(payload, 'sourceId', 'cache.book.prefetch');
    const bookId = CoreSlice10Service.requiredPayloadString(payload, 'bookId', 'cache.book.prefetch');
    const chapterRangeValue = payload['chapterRange'];
    if (!Array.isArray(chapterRangeValue) || chapterRangeValue.length !== 2) {
      throw new Error('cache.book.prefetch chapterRange must be [startInclusive, endExclusive]');
    }
    const chapterRange = chapterRangeValue as number[];
    const startInclusive = chapterRange[0];
    const endExclusive = chapterRange[1];
    if (!Number.isSafeInteger(startInclusive) || startInclusive < 0 ||
      !Number.isSafeInteger(endExclusive) || endExclusive < 0 || startInclusive >= endExclusive) {
      throw new Error('cache.book.prefetch chapterRange must be a non-empty non-negative [startInclusive, endExclusive] range');
    }

    const params: JsonObject = {};
    params['sourceId'] = sourceId;
    params['bookId'] = bookId;
    // Keep the canonical two-element tuple intact. In particular, do not
    // reinterpret endExclusive as an inclusive chapter index.
    params['chapterRange'] = chapterRange;
    CoreSlice10Service.copyOptionalPayloadValue(payload, params, 'priority');
    CoreSlice10Service.copyOptionalPayloadValue(payload, params, 'requestedAt');
    return this.execute('cache.book.prefetch', params, 30000);
  }

  cacheClear(payload: ReaderUIJSONPayload): Promise<JsonObject> {
    CoreSlice10Service.validatePayload('settings.cache.clear', payload);
    const scope = CoreSlice10Service.requiredPayloadString(payload, 'scope', 'cache.clear');
    const sourceIdValue = payload['sourceId'];
    const bookIdValue = payload['bookId'];
    const hasSourceId = sourceIdValue !== undefined;
    const hasBookId = bookIdValue !== undefined;
    if (hasSourceId !== hasBookId) {
      throw new Error('cache.clear book selector requires both sourceId and bookId');
    }
    if (scope === 'book' && (!hasSourceId || !hasBookId)) {
      throw new Error('cache.clear scope book requires sourceId and bookId');
    }

    const params: JsonObject = {};
    params['scope'] = scope;
    if (hasSourceId && hasBookId) {
      // Forward the exact selector. Core remains authoritative for deciding
      // whether a selector is valid for the requested scope.
      params['sourceId'] = CoreSlice10Service.requiredPayloadString(payload, 'sourceId', 'cache.clear');
      params['bookId'] = CoreSlice10Service.requiredPayloadString(payload, 'bookId', 'cache.clear');
    }
    return this.execute('cache.clear', params, 30000);
  }

  replacePersistCreate(payload: ReaderUIJSONPayload): Promise<JsonObject> {
    CoreSlice10Service.validatePayload('reader.replace.create', payload);
    const operation = CoreSlice10Service.requiredPayloadString(payload, 'operation', 'replace.persist');
    if (operation !== 'create') throw new Error('replace.persist native create owner only accepts operation=create');
    const paramsValue = payload['params'];
    if (paramsValue === null || paramsValue === undefined ||
      typeof paramsValue !== 'object' || Array.isArray(paramsValue)) {
      throw new Error('replace.persist requires the canonical params object');
    }
    const params: JsonObject = {};
    params['operation'] = operation;
    params['params'] = paramsValue;
    CoreSlice10Service.copyOptionalPayloadValue(payload, params, 'transactionId');
    CoreSlice10Service.copyOptionalPayloadValue(payload, params, 'undoTtlSeconds');
    return this.execute('replace.persist', params, 15000);
  }

  replaceUndo(payload: ReaderUIJSONPayload): Promise<JsonObject> {
    CoreSlice10Service.validatePayload('reader.replace.undo', payload);
    const undoTokenValue = payload['undoToken'];
    if (undoTokenValue === null || undoTokenValue === undefined ||
      typeof undoTokenValue !== 'object' || Array.isArray(undoTokenValue) ||
      Object.keys(undoTokenValue).length === 0) {
      throw new Error('replace.undo requires the complete Core-issued undoToken object');
    }
    const params: JsonObject = {};
    // Never reconstruct this object from transactionId/ruleId. Its revision,
    // before/after snapshots and timestamps are all Core-validated material.
    params['undoToken'] = undoTokenValue;
    return this.execute('replace.undo', params, 15000);
  }

  private execute(method: string, params: JsonObject, timeoutMs: number): Promise<JsonObject> {
    return this.dispatcher.execute(method, params, timeoutMs).then((result: JsonObject): JsonObject => {
      validateReaderUITypedResult(
        CoreSlice10Service.eventForMethod(method), method, result as Object as ReaderUIJSONResult,
      );
      CoreSlice10Service.validateResult(method, params, result);
      return result;
    });
  }

  private static validatePayload(event: string, payload: ReaderUIJSONPayload): void {
    validateReaderUITypedPayload(event, payload);
  }

  private static eventForMethod(method: string): string {
    switch (method) {
      case 'cache.book.status': return 'reader.bookCache.open';
      case 'cache.book.prefetch': return 'download.task.retry';
      case 'cache.clear': return 'settings.cache.clear';
      case 'replace.persist': return 'reader.replace.create';
      case 'replace.undo': return 'reader.replace.undo';
      default: throw new Error(`unsupported Slice 10 Core method ${method}`);
    }
  }

  private static requiredPayloadString(payload: ReaderUIJSONPayload, key: string, method: string): string {
    const value = payload[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${method} requires non-blank ${key}`);
    }
    // Validation may inspect whitespace, but transport must not silently
    // rewrite a contract value before Core sees it.
    return value;
  }

  private static copyOptionalPayloadValue(from: ReaderUIJSONPayload, to: JsonObject, key: string): void {
    const value: ReaderUIJSONValue | undefined = from[key];
    if (value !== undefined) to[key] = value;
  }

  private static validateResult(method: string, params: JsonObject, result: JsonObject): void {
    if (result === null || result === undefined || typeof result !== 'object' ||
      Array.isArray(result) || Object.keys(result).length === 0) {
      throw new Error(`${method} returned no result data`);
    }
    switch (method) {
      case 'cache.book.status':
        CoreSlice10Service.validateBookStatusResult(params, result);
        return;
      case 'cache.book.prefetch':
        CoreSlice10Service.validatePrefetchResult(params, result);
        return;
      case 'cache.clear':
        CoreSlice10Service.validateClearResult(params, result);
        return;
      case 'replace.persist':
        // Generated typed-result validation above owns the complete
        // operation/data/undoToken shape. No request echo exists for persist.
        return;
      case 'replace.undo':
        CoreSlice10Service.validateUndoResult(result);
        return;
      default:
        throw new Error(`unsupported Slice 10 Core method ${method}`);
    }
  }

  private static validateBookStatusResult(params: JsonObject, result: JsonObject): void {
    CoreSlice10Service.requireMatchingString(result, params, 'sourceId', 'cache.book.status');
    CoreSlice10Service.requireMatchingString(result, params, 'bookId', 'cache.book.status');
    CoreSlice10Service.requireBoolean(result, 'tocAvailable', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'chapterCount', 'cache.book.status');
    CoreSlice10Service.requireArray(result, 'chapters', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'cachedCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'queuedCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'inProgressCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'completedCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'failedCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'cancelledCount', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(result, 'missingCount', 'cache.book.status');
    const globalStats = CoreSlice10Service.requireObject(result, 'globalStats', 'cache.book.status');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'entryCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'totalContentBytes', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'queueEntryCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'queuedCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'inProgressCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'completedCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'failedCount', 'cache.book.status globalStats');
    CoreSlice10Service.requireNonNegativeInteger(globalStats, 'cancelledCount', 'cache.book.status globalStats');
  }

  private static validatePrefetchResult(params: JsonObject, result: JsonObject): void {
    CoreSlice10Service.requireMatchingString(result, params, 'sourceId', 'cache.book.prefetch');
    CoreSlice10Service.requireMatchingString(result, params, 'bookId', 'cache.book.prefetch');
    const expectedRange = params['chapterRange'] as Object;
    const actualRange = result['chapterRange'] as Object;
    if (!Array.isArray(expectedRange) || !Array.isArray(actualRange) || actualRange.length !== 2 ||
      actualRange[0] !== expectedRange[0] || actualRange[1] !== expectedRange[1]) {
      throw new Error('cache.book.prefetch returned a missing or mismatched chapterRange');
    }
    CoreSlice10Service.requireNonNegativeInteger(result, 'chapterCount', 'cache.book.prefetch');
    CoreSlice10Service.requireNonNegativeInteger(result, 'prefetchedCount', 'cache.book.prefetch');
    CoreSlice10Service.requireArray(result, 'queuedIndexes', 'cache.book.prefetch');
    CoreSlice10Service.requireArray(result, 'alreadyQueuedIndexes', 'cache.book.prefetch');
    CoreSlice10Service.requireArray(result, 'skippedCachedIndexes', 'cache.book.prefetch');
  }

  private static validateClearResult(params: JsonObject, result: JsonObject): void {
    CoreSlice10Service.requireMatchingString(result, params, 'scope', 'cache.clear');
    CoreSlice10Service.requireNonNegativeInteger(result, 'cacheEntriesRemoved', 'cache.clear');
    CoreSlice10Service.requireNonNegativeInteger(result, 'chapterEntriesRemoved', 'cache.clear');
    CoreSlice10Service.requireNonNegativeInteger(result, 'queueEntriesRemoved', 'cache.clear');
    CoreSlice10Service.requireNonNegativeInteger(result, 'removedContentBytes', 'cache.clear');
  }

  private static validateUndoResult(result: JsonObject): void {
    CoreSlice10Service.requireNonBlankString(result, 'transactionId', 'replace.undo');
    CoreSlice10Service.requireNonBlankString(result, 'revision', 'replace.undo');
    CoreSlice10Service.requireNonBlankString(result, 'operation', 'replace.undo');
    CoreSlice10Service.requireInteger(result, 'ruleId', 'replace.undo');
    CoreSlice10Service.requireBoolean(result, 'changed', 'replace.undo');
    CoreSlice10Service.requireInteger(result, 'undoneAt', 'replace.undo');
  }

  private static requireMatchingString(data: JsonObject, expected: JsonObject,
    key: string, method: string): void {
    const actualValue = data[key] as Object;
    const expectedValue = expected[key] as Object;
    if (typeof actualValue !== 'string' || actualValue.length === 0 || actualValue !== expectedValue) {
      throw new Error(`${method} returned a missing or mismatched ${key}`);
    }
  }

  private static requireNonBlankString(data: JsonObject, key: string, method: string): void {
    const value = data[key] as Object;
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${method} result requires non-blank ${key}`);
    }
  }

  private static requireBoolean(data: JsonObject, key: string, method: string): void {
    const value = data[key] as Object;
    if (typeof value !== 'boolean') throw new Error(`${method} result requires boolean ${key}`);
  }

  private static requireInteger(data: JsonObject, key: string, method: string): void {
    const value = data[key] as Object;
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new Error(`${method} result requires integer ${key}`);
    }
  }

  private static requireNonNegativeInteger(data: JsonObject, key: string, method: string): void {
    const value = data[key] as Object;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${method} result requires non-negative integer ${key}`);
    }
  }

  private static requireArray(data: JsonObject, key: string, method: string): void {
    if (!Array.isArray(data[key] as Object)) throw new Error(`${method} result requires array ${key}`);
  }

  private static requireObject(data: JsonObject, key: string, method: string): JsonObject {
    const value = data[key] as Object;
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${method} result requires object ${key}`);
    }
    return value as Object as JsonObject;
  }
}
