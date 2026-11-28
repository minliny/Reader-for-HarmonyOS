import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import type { BookRequestOptions } from './BookRequestScheduler';

export interface ReaderRuntimeRequestPort {
  request(method: string, params?: JsonObject, options?: BookRequestOptions): Promise<ReaderCoreResultEvent>;
  requestBook(
    method: string,
    params?: JsonObject,
    options?: RequestOptions,
    priority?: 'foreground' | 'background',
  ): Promise<ReaderCoreResultEvent>;
  readPreparedEntry(params: JsonObject): JsonObject;
  supportsCoreCapability(capability: string): boolean;
}

let getCurrentRequestPortFn: (() => ReaderRuntimeRequestPort) | undefined;

export function registerRuntimeRequestPort(getCurrent: () => ReaderRuntimeRequestPort): void {
  getCurrentRequestPortFn = getCurrent;
}

export function currentRuntimeRequestPort(): ReaderRuntimeRequestPort {
  if (getCurrentRequestPortFn === undefined) {
    throw new Error('ReaderRuntimeOwner must be installed by EntryAbility');
  }
  return getCurrentRequestPortFn();
}
