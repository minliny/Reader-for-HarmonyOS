import type { JsonObject, ReaderCoreAssetBridge, ReaderCoreErrorEvent, ReaderCoreHostRequestEvent, ReaderCoreResultEvent } from '@reader/core-harmony';

import type { MangaImageGraphicsAdapter } from './MangaImageGraphicsPlan';

const MAX_BYTES = 16 * 1024 * 1024;
const CHUNK_BYTES = 1024 * 1024;
interface DecodeRequestError extends Error { event?: ReaderCoreErrorEvent; }
interface DecodeTransfer {
  current: () => boolean;
  resourceRef: string;
  requestId?: number;
  bytes?: Uint8Array;
  inputReceived: boolean;
  maxBytes?: number;
  failure?: Error;
  graphicsRequested?: boolean;
}
export interface MangaImageDecodeTransport {
  graphics?: MangaImageGraphicsAdapter;
  fetch(request: JsonObject, current: () => boolean, maxBytes: number): Promise<Uint8Array>;
  validate(bytes: Uint8Array, current: () => boolean): Promise<void>;
}

/** Only a caller-owned live transfer may receive native output. Bytes never
 * travel in JSON and are consumed before Host acknowledges the output event. */
export class MangaImageDecodeHost {
  static readonly instance: MangaImageDecodeHost = new MangaImageDecodeHost();
  private sequence: number = 0;
  private readonly transfers: Map<string, DecodeTransfer> = new Map<string, DecodeTransfer>();

  async prepare(params: JsonObject, request: (params: JsonObject) => Promise<ReaderCoreResultEvent>,
    current: () => boolean): Promise<Uint8Array> {
    if (!current()) throw new Error('MANGA_DECODE_CANCELLED');
    if (this.transfers.size >= 2) throw new Error('MANGA_DECODE_CAPACITY');
    const resourceRef = params['resourceRef'];
    if (typeof resourceRef !== 'string' || resourceRef.length === 0) throw new Error('MANGA_DECODE_IDENTITY');
    const transferId = `manga-decode-${++this.sequence}`;
    const transfer: DecodeTransfer = { current, resourceRef, inputReceived: false };
    this.transfers.set(transferId, transfer);
    try {
      const result = await request({ ...params, transferId });
      const preparedBytes = result.data['bytes'];
      if (transfer.maxBytes !== undefined && typeof preparedBytes === 'number' && preparedBytes > transfer.maxBytes) this.rejectBudget(transfer);
      if (!current() || result.data['prepared'] !== true || result.data['transferId'] !== transferId ||
        result.data['resourceRef'] !== resourceRef || result.requestId !== transfer.requestId || transfer.bytes === undefined ||
        result.data['bytes'] !== transfer.bytes.length) {
        throw new Error('MANGA_DECODE_RECEIPT');
      }
      return transfer.bytes;
    } catch (error) {
      if (transfer.failure !== undefined) throw transfer.failure;
      // Online keys and libraries use Core's existing HTTP bridge. Keep their
      // typed status visible to the same login/retry flow as image requests.
      const details = error instanceof Error ? (error as DecodeRequestError).event?.error.details : undefined;
      if (details?.['reason'] === 'imageDecodeBudget') throw new Error('READING_IMAGE_DECODE_BUDGET');
      const status = details?.['httpStatus'];
      if (details?.['category'] === 'SOURCE_HTTP_FAILED' && typeof status === 'number') {
        if (status === 401) throw new Error('READING_IMAGE_AUTH_REQUIRED');
        if (status === 403) throw new Error('READING_IMAGE_ACCESS_DENIED');
        if (status === 429) throw new Error('READING_IMAGE_RATE_LIMITED');
        if (status >= 400 && status < 600) throw new Error('READING_IMAGE_HTTP_FAILED');
      }
      throw error;
    }
    finally { this.transfers.delete(transferId); }
  }

  cancel(event: ReaderCoreHostRequestEvent): void {
    const id = event.params['transferId'];
    if (typeof id === 'string') this.transfers.delete(id);
  }

  async handle(event: ReaderCoreHostRequestEvent, bridge: ReaderCoreAssetBridge,
    transport: MangaImageDecodeTransport): Promise<JsonObject> {
    const id = event.params['transferId'];
    const transfer = typeof id === 'string' ? this.transfers.get(id) : undefined;
    if (transfer === undefined || event.params['resourceRef'] !== transfer.resourceRef ||
      (transfer.requestId !== undefined && transfer.requestId !== event.requestId)) throw new Error('MANGA_DECODE_OWNER');
    transfer.requestId = event.requestId;
    const current = (): boolean => typeof id === 'string' && this.transfers.get(id) === transfer && transfer.current();
    if (!current()) throw new Error('MANGA_DECODE_CANCELLED');
    if (event.params['stage'] === 'input') {
      const maxBytes = event.params['maxBytes'];
      if (transfer.inputReceived || transfer.maxBytes !== undefined ||
        (maxBytes !== 8 * 1024 * 1024 && maxBytes !== MAX_BYTES)) throw new Error('MANGA_DECODE_STAGE');
      transfer.maxBytes = maxBytes;
      const descriptor = event.params['request'];
      if (descriptor === null || typeof descriptor !== 'object' || Array.isArray(descriptor)) throw new Error('MANGA_DECODE_REQUEST');
      let bytes: Uint8Array;
      try { bytes = await transport.fetch(descriptor as JsonObject, current, maxBytes); }
      catch (error) { transfer.failure = error instanceof Error ? error : new Error(String(error)); throw error; }
      if (!current() || bytes.length < 1) throw new Error('MANGA_DECODE_INPUT');
      if (bytes.length > maxBytes) this.rejectBudget(transfer);
      const inspect = event.params['inspectGraphics'] === true;
      if (inspect && transport.graphics === undefined) throw new Error('MANGA_GRAPHICS_UNAVAILABLE');
      const dimensions = inspect ? await transport.graphics?.inspect(bytes, current) : undefined;
      transfer.graphicsRequested = inspect;
      if (!current() || bytes.length < 1 || bytes.length > maxBytes) throw new Error('MANGA_DECODE_INPUT');
      const assetId = bridge.begin(event.requestId, event.operationId, bytes.length);
      try {
        for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
          if (!current()) throw new Error('MANGA_DECODE_CANCELLED');
          bridge.write(event.requestId, event.operationId, assetId, bytes.subarray(offset, Math.min(bytes.length, offset + CHUNK_BYTES)));
        }
        const committed = bridge.commit(event.requestId, event.operationId, assetId);
        if (committed !== bytes.length || !current()) throw new Error('MANGA_DECODE_COMMIT');
        transfer.inputReceived = true;
        return dimensions === undefined ? { assetId, operationId: event.operationId, bytes: committed } :
          { assetId, operationId: event.operationId, bytes: committed, width: dimensions.width, height: dimensions.height };
      } catch (error) { bridge.release(event.requestId, event.operationId, assetId); throw error; }
    }
    if (event.params['stage'] !== 'output' || !transfer.inputReceived || transfer.bytes !== undefined || bridge.read === undefined) {
      throw new Error('MANGA_DECODE_STAGE');
    }
    const assetId = this.positiveInteger(event.params['assetId']);
    const operationId = this.positiveInteger(event.params['operationId']);
    const count = this.positiveInteger(event.params['bytes']);
    try {
      if (transfer.maxBytes === undefined || count > transfer.maxBytes) this.rejectBudget(transfer);
      const bytes = new Uint8Array(count);
      for (let offset = 0; offset < count;) {
        if (!current()) throw new Error('MANGA_DECODE_CANCELLED');
        const limit = Math.min(CHUNK_BYTES, count - offset);
        const chunk = await bridge.read(event.requestId, operationId, assetId, offset, limit);
        if (!current() || chunk.length !== limit) throw new Error('MANGA_DECODE_OUTPUT_LENGTH');
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const plan = event.params['graphicsPlan'];
      let prepared = bytes;
      if (plan !== undefined && plan !== null) {
        if (!transfer.graphicsRequested || transport.graphics === undefined || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('MANGA_GRAPHICS_STAGE');
        prepared = await transport.graphics.transform(bytes, plan as JsonObject, current);
        if (!current() || prepared.length < 1) throw new Error('MANGA_GRAPHICS_OUTPUT_BUDGET');
        if (prepared.length > transfer.maxBytes) this.rejectBudget(transfer);
      }
      await transport.validate(prepared, current);
      if (!current()) throw new Error('MANGA_DECODE_CANCELLED');
      transfer.bytes = prepared;
      return { consumed: true, assetId, bytes: count, preparedBytes: prepared.length };
    } finally { bridge.release(event.requestId, operationId, assetId); }
  }

  private rejectBudget(transfer: DecodeTransfer): never {
    const failure = new Error('READING_IMAGE_DECODE_BUDGET');
    transfer.failure = failure;
    throw failure;
  }

  private positiveInteger(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('MANGA_DECODE_RECEIPT');
    return value;
  }
}
